/**
 * 工作流状态管理器 - 管理工作流和任务的状态
 */

export class WorkflowState {
  constructor(options = {}) {
    this.workflows = new Map();
    this.listeners = new Map();
    this.persistence = options.persistence || null;
    this.logger = options.logger || console;
  }

  /**
   * 保存工作流状态
   */
  async saveWorkflow(workflow) {
    this.workflows.set(workflow.id, { ...workflow });

    if (this.persistence) {
      await this.persistence.saveWorkflow(workflow);
    }

    this.notifyListeners('workflow:updated', workflow);
  }

  /**
   * 获取工作流状态
   */
  getWorkflow(workflowId) {
    return this.workflows.get(workflowId);
  }

  /**
   * 获取所有工作流
   */
  getAllWorkflows() {
    return Array.from(this.workflows.values());
  }

  /**
   * 根据状态过滤工作流
   */
  getWorkflowsByStatus(status) {
    return Array.from(this.workflows.values())
      .filter(workflow => workflow.status === status);
  }

  /**
   * 更新工作流状态
   */
  async updateWorkflowStatus(workflowId, status, additionalData = {}) {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`工作流不存在: ${workflowId}`);
    }

    const oldStatus = workflow.status;
    workflow.status = status;
    workflow.updatedAt = new Date();

    // 添加状态相关的元数据
    switch (status) {
      case 'running':
        workflow.startedAt = workflow.startedAt || new Date();
        break;
      case 'completed':
        workflow.completedAt = new Date();
        break;
      case 'failed':
        workflow.failedAt = new Date();
        if (additionalData.error) {
          workflow.error = additionalData.error;
        }
        break;
      case 'cancelled':
        workflow.cancelledAt = new Date();
        break;
    }

    // 合并额外数据
    Object.assign(workflow, additionalData);

    await this.saveWorkflow(workflow);

    this.logger.info(`工作流状态更新: ${workflowId} ${oldStatus} -> ${status}`);
    this.notifyListeners('workflow:status_changed', {
      workflowId,
      oldStatus,
      newStatus: status,
      workflow,
    });
  }

  /**
   * 更新任务状态
   */
  async updateTaskStatus(workflowId, taskId, status, additionalData = {}) {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`工作流不存在: ${workflowId}`);
    }

    const task = workflow.tasks.find(t => t.id === taskId);
    if (!task) {
      throw new Error(`任务不存在: ${taskId}`);
    }

    const oldStatus = task.status;
    task.status = status;
    task.updatedAt = new Date();

    // 添加状态相关的元数据
    switch (status) {
      case 'running':
        task.startedAt = task.startedAt || new Date();
        break;
      case 'completed':
        task.completedAt = new Date();
        if (additionalData.result !== undefined) {
          task.result = additionalData.result;
        }
        break;
      case 'failed':
        task.failedAt = new Date();
        if (additionalData.error) {
          task.error = additionalData.error;
        }
        break;
      case 'retrying':
        task.retryCount = (task.retryCount || 0) + 1;
        break;
    }

    // 合并额外数据
    Object.assign(task, additionalData);

    await this.saveWorkflow(workflow);

    this.logger.info(`任务状态更新: ${taskId} ${oldStatus} -> ${status}`);
    this.notifyListeners('task:status_changed', {
      workflowId,
      taskId,
      oldStatus,
      newStatus: status,
      task,
      workflow,
    });
  }

  /**
   * 获取工作流统计信息
   */
  getWorkflowStats() {
    const workflows = Array.from(this.workflows.values());
    const stats = {
      total: workflows.length,
      byStatus: {},
      completedTasks: 0,
      failedTasks: 0,
      runningTasks: 0,
      avgExecutionTime: 0,
    };

    let totalExecutionTime = 0;
    let completedWorkflows = 0;

    workflows.forEach(workflow => {
      // 按状态统计
      stats.byStatus[workflow.status] = (stats.byStatus[workflow.status] || 0) + 1;

      // 统计任务
      workflow.tasks.forEach(task => {
        switch (task.status) {
          case 'completed':
            stats.completedTasks++;
            break;
          case 'failed':
            stats.failedTasks++;
            break;
          case 'running':
            stats.runningTasks++;
            break;
        }
      });

      // 计算执行时间
      if (workflow.status === 'completed' && workflow.startedAt && workflow.completedAt) {
        const executionTime = workflow.completedAt - workflow.startedAt;
        totalExecutionTime += executionTime;
        completedWorkflows++;
      }
    });

    if (completedWorkflows > 0) {
      stats.avgExecutionTime = totalExecutionTime / completedWorkflows;
    }

    return stats;
  }

  /**
   * 清理过期的工作流数据
   */
  async cleanupExpiredWorkflows(maxAge = 30 * 24 * 60 * 60 * 1000) { // 30天
    const now = Date.now();
    const expiredWorkflows = [];

    for (const [workflowId, workflow] of this.workflows) {
      const age = now - new Date(workflow.createdAt).getTime();
      if (age > maxAge && ['completed', 'failed', 'cancelled'].includes(workflow.status)) {
        expiredWorkflows.push(workflowId);
      }
    }

    for (const workflowId of expiredWorkflows) {
      this.workflows.delete(workflowId);
      if (this.persistence) {
        await this.persistence.deleteWorkflow(workflowId);
      }
    }

    if (expiredWorkflows.length > 0) {
      this.logger.info(`清理过期工作流: ${expiredWorkflows.length}个`);
    }

    return expiredWorkflows;
  }

  /**
   * 添加事件监听器
   */
  addListener(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  /**
   * 移除事件监听器
   */
  removeListener(event, callback) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * 通知监听器
   */
  notifyListeners(event, data) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          this.logger.error(`事件监听器执行失败: ${event}`, error);
        }
      });
    }
  }

  /**
   * 导出状态快照
   */
  exportSnapshot() {
    return {
      workflows: Array.from(this.workflows.entries()),
      timestamp: new Date(),
      stats: this.getWorkflowStats(),
    };
  }

  /**
   * 从快照导入状态
   */
  async importSnapshot(snapshot) {
    if (!snapshot.workflows) {
      throw new Error('无效的快照数据');
    }

    this.workflows.clear();
    for (const [workflowId, workflow] of snapshot.workflows) {
      this.workflows.set(workflowId, workflow);
    }

    if (this.persistence) {
      await this.persistence.saveSnapshot(snapshot);
    }

    this.logger.info(`从快照导入状态: ${snapshot.workflows.length}个工作流`);
  }
}
