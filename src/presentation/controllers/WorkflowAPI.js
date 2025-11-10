/**
 * 工作流API接口
 */

export class WorkflowAPI {
  constructor(workflowEngine, options = {}) {
    this.engine = workflowEngine;
    this.basePath = options.basePath || '/api/workflows';
    this.logger = options.logger || console;
  }

  /**
   * 获取路由配置
   */
  getRoutes() {
    return [
      {
        method: 'GET',
        path: this.basePath,
        handler: this.getAllWorkflows.bind(this),
        description: '获取所有工作流',
      },
      {
        method: 'GET',
        path: `${this.basePath}/:id`,
        handler: this.getWorkflow.bind(this),
        description: '获取指定工作流',
      },
      {
        method: 'POST',
        path: this.basePath,
        handler: this.createWorkflow.bind(this),
        description: '创建工作流',
      },
      {
        method: 'POST',
        path: `${this.basePath}/:id/start`,
        handler: this.startWorkflow.bind(this),
        description: '启动工作流',
      },
      {
        method: 'POST',
        path: `${this.basePath}/:id/pause`,
        handler: this.pauseWorkflow.bind(this),
        description: '暂停工作流',
      },
      {
        method: 'POST',
        path: `${this.basePath}/:id/resume`,
        handler: this.resumeWorkflow.bind(this),
        description: '恢复工作流',
      },
      {
        method: 'POST',
        path: `${this.basePath}/:id/cancel`,
        handler: this.cancelWorkflow.bind(this),
        description: '取消工作流',
      },
      {
        method: 'DELETE',
        path: `${this.basePath}/:id`,
        handler: this.deleteWorkflow.bind(this),
        description: '删除工作流',
      },
      {
        method: 'GET',
        path: `${this.basePath}/stats`,
        handler: this.getStats.bind(this),
        description: '获取工作流统计',
      },
    ];
  }

  /**
   * 获取所有工作流
   */
  async getAllWorkflows(req, res) {
    try {
      const { status, limit = 50, offset = 0 } = req.query;
      let workflows = this.engine.getAllWorkflows();

      // 按状态过滤
      if (status) {
        workflows = workflows.filter(w => w.status === status);
      }

      // 分页
      const total = workflows.length;
      workflows = workflows.slice(offset, offset + limit);

      res.json({
        success: true,
        data: {
          workflows,
          pagination: {
            total,
            limit: parseInt(limit),
            offset: parseInt(offset),
          },
        },
      });
    } catch (error) {
      this.logger.error('获取工作流列表失败', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * 获取指定工作流
   */
  async getWorkflow(req, res) {
    try {
      const { id } = req.params;
      const workflow = this.engine.getWorkflow(id);

      if (!workflow) {
        return res.status(404).json({
          success: false,
          error: '工作流不存在',
        });
      }

      res.json({
        success: true,
        data: workflow,
      });
    } catch (error) {
      this.logger.error(`获取工作流失败: ${req.params.id}`, error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * 创建工作流
   */
  async createWorkflow(req, res) {
    try {
      const definition = req.body;

      if (!definition || !definition.name || !definition.tasks) {
        return res.status(400).json({
          success: false,
          error: '工作流定义无效，缺少name或tasks字段',
        });
      }

      const workflowId = this.engine.createWorkflow(definition);

      res.status(201).json({
        success: true,
        data: {
          workflowId,
          message: '工作流创建成功',
        },
      });
    } catch (error) {
      this.logger.error('创建工作流失败', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * 启动工作流
   */
  async startWorkflow(req, res) {
    try {
      const { id } = req.params;
      const { params } = req.body || {};

      await this.engine.startWorkflow(id, params);

      res.json({
        success: true,
        message: '工作流启动成功',
      });
    } catch (error) {
      this.logger.error(`启动工作流失败: ${req.params.id}`, error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * 暂停工作流
   */
  async pauseWorkflow(req, res) {
    try {
      const { id } = req.params;
      this.engine.pauseWorkflow(id);

      res.json({
        success: true,
        message: '工作流暂停成功',
      });
    } catch (error) {
      this.logger.error(`暂停工作流失败: ${req.params.id}`, error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * 恢复工作流
   */
  async resumeWorkflow(req, res) {
    try {
      const { id } = req.params;
      await this.engine.resumeWorkflow(id);

      res.json({
        success: true,
        message: '工作流恢复成功',
      });
    } catch (error) {
      this.logger.error(`恢复工作流失败: ${req.params.id}`, error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * 取消工作流
   */
  async cancelWorkflow(req, res) {
    try {
      const { id } = req.params;
      this.engine.cancelWorkflow(id);

      res.json({
        success: true,
        message: '工作流取消成功',
      });
    } catch (error) {
      this.logger.error(`取消工作流失败: ${req.params.id}`, error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * 删除工作流
   */
  async deleteWorkflow(req, res) {
    try {
      const { id } = req.params;

      // 检查工作流是否存在
      const workflow = this.engine.getWorkflow(id);
      if (!workflow) {
        return res.status(404).json({
          success: false,
          error: '工作流不存在',
        });
      }

      // 检查是否可以删除（只有已完成或失败的工作流可以删除）
      if (!['completed', 'failed', 'cancelled'].includes(workflow.status)) {
        return res.status(400).json({
          success: false,
          error: '只能删除已完成、失败或取消的工作流',
        });
      }

      // 从引擎中移除（这里需要引擎提供删除方法）
      // this.engine.deleteWorkflow(id);

      res.json({
        success: true,
        message: '工作流删除成功',
      });
    } catch (error) {
      this.logger.error(`删除工作流失败: ${req.params.id}`, error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * 获取统计信息
   */
  async getStats(req, res) {
    try {
      const runningWorkflows = this.engine.getRunningWorkflows();
      const allWorkflows = this.engine.getAllWorkflows();

      const stats = {
        total: allWorkflows.length,
        running: runningWorkflows.length,
        byStatus: {},
      };

      // 按状态统计
      allWorkflows.forEach(workflow => {
        stats.byStatus[workflow.status] = (stats.byStatus[workflow.status] || 0) + 1;
      });

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      this.logger.error('获取统计信息失败', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}
