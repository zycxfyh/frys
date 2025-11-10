#!/usr/bin/env node

/**
 * frys - 轻量级工作流编排引擎
 * 重构后的主入口文件
 */

import { WorkflowEngine } from './workflow/WorkflowEngine.js';
import { TaskScheduler } from './workflow/TaskScheduler.js';
import { WorkflowState } from './workflow/WorkflowState.js';
import { WorkflowDefinition } from './workflow/WorkflowDefinition.js';
import { WorkflowAPI } from './presentation/controllers/WorkflowAPI.js';
import { HealthAPI } from './presentation/controllers/HealthAPI.js';
import { config } from './shared/utils/config.js';
import { logger } from './shared/utils/logger.js';
import { EventBus } from './shared/kernel/EventBus.js';
// 简单的依赖容器（可选）

// 加载配置
config.loadFromEnv();

// 创建事件总线实例
const eventBus = new EventBus();

class frysApp {
  constructor() {
    this.workflowEngine = null;
    this.taskScheduler = null;
    this.workflowState = null;
    this.server = null;
    this.apis = [];
  }

  async initialize() {
    logger.info('🚀 初始化 frys 工作流引擎');

    try {
      // 初始化核心服务
      this.taskScheduler = new TaskScheduler();
      this.workflowState = new WorkflowState({ logger });

      // 初始化工作流引擎
      this.workflowEngine = new WorkflowEngine({
        logger,
        onWorkflowEvent: this.handleWorkflowEvent.bind(this),
        onTaskEvent: this.handleTaskEvent.bind(this),
      });

      // 服务已初始化

      // 初始化API
      this.apis = [
        new WorkflowAPI(this.workflowEngine, { logger }),
        new HealthAPI({ logger }),
      ];

      logger.info('✅ frys 初始化完成');
    } catch (error) {
      logger.error('❌ frys 初始化失败', error);
      throw error;
    }
  }

  handleWorkflowEvent(event, data) {
    logger.info(`工作流事件: ${event}`, { workflowId: data.id });

    // 发布到事件总线
    eventBus.emit(`workflow:${event}`, data);

    // 保存状态
    if (this.workflowState) {
      this.workflowState.saveWorkflow(data).catch(error => {
        logger.error('保存工作流状态失败', error);
      });
    }
  }

  handleTaskEvent(event, data) {
    logger.debug(`任务事件: ${event}`, {
      workflowId: data.workflowId,
      taskId: data.taskId,
    });

    // 发布到事件总线
    eventBus.emit(`task:${event}`, data);
  }

  async createWorkflow(definition) {
    // 验证定义
    const validation = WorkflowDefinition.validate(definition);
    if (!validation.isValid) {
      throw new Error(`工作流定义无效: ${validation.errors.join(', ')}`);
    }

    // 创建工作流
    const workflowId = this.workflowEngine.createWorkflow(definition);
    logger.info(`工作流创建成功: ${definition.name} (${workflowId})`);

    return workflowId;
  }

  async startWorkflow(workflowId, params = {}) {
    await this.workflowEngine.startWorkflow(workflowId, params);
    logger.info(`工作流启动成功: ${workflowId}`);
  }

  getWorkflow(workflowId) {
    return this.workflowEngine.getWorkflow(workflowId);
  }

  getAllWorkflows() {
    return this.workflowEngine.getAllWorkflows();
  }

  getRunningWorkflows() {
    return this.workflowEngine.getRunningWorkflows();
  }

  getStats() {
    const workflows = this.getAllWorkflows();
    const running = this.getRunningWorkflows();

    return {
      total: workflows.length,
      running: running.length,
      byStatus: workflows.reduce((acc, wf) => {
        acc[wf.status] = (acc[wf.status] || 0) + 1;
        return acc;
      }, {}),
    };
  }

  // 启动HTTP服务器（可选）
  async startServer(port = config.get('server.port')) {
    try {
      const express = await import('express');

      const app = express.default();
      app.use(express.json());

      // 注册API路由
      for (const api of this.apis) {
        const routes = api.getRoutes();
        for (const route of routes) {
          const { method, path, handler, description } = route;
          app[method.toLowerCase()](path, handler);
          logger.debug(`注册路由: ${method} ${path} - ${description}`);
        }
      }

      // 启动服务器
      return new Promise((resolve, reject) => {
        const server = app.listen(port, (error) => {
          if (error) {
            logger.error(`服务器启动失败: ${error.message}`);
            reject(error);
          } else {
            logger.info(`✅ 服务器启动成功，监听端口 ${port}`);
            this.server = server;
            resolve(server);
          }
        });
      });
    } catch (error) {
      logger.warn('HTTP服务器不可用，使用命令行模式');
      return null;
    }
  }

  async stop() {
    logger.info('🛑 停止 frys 工作流引擎');

    if (this.server) {
      this.server.close();
      logger.debug('HTTP服务器已停止');
    }

    logger.info('✅ frys 已停止');
  }

  // 工具方法
  createExampleWorkflow(name) {
    return WorkflowDefinition.createExample(name);
  }

  validateWorkflowDefinition(definition) {
    return WorkflowDefinition.validate(definition);
  }

  analyzeWorkflowComplexity(definition) {
    return WorkflowDefinition.analyzeComplexity(definition);
  }
}

// 创建应用实例
const app = new frysApp();

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
  app.initialize().then(async () => {
    // 检查命令行参数
    const args = process.argv.slice(2);

    if (args.includes('--server') || args.includes('-s')) {
      // 启动服务器模式
      const port = config.get('server.port');
      await app.startServer(port);

      // 保持进程运行
      process.on('SIGINT', async () => {
        await app.stop();
        process.exit(0);
      });

      process.on('SIGTERM', async () => {
        await app.stop();
        process.exit(0);
      });
    } else if (args.includes('--example') || args.includes('-e')) {
      // 创建示例工作流
      const example = app.createExampleWorkflow('示例工作流');
      const workflowId = await app.createWorkflow(example);
      await app.startWorkflow(workflowId);
      logger.info(`示例工作流已启动: ${workflowId}`);
    } else {
      // 显示帮助信息
      console.log(`
frys - 轻量级工作流编排引擎

使用方法:
  node src/index.js --server          # 启动HTTP服务器
  node src/index.js --example         # 运行示例工作流
  node src/index.js --help           # 显示此帮助信息

API端点 (服务器模式):
  GET  /api/workflows              # 获取所有工作流
  GET  /api/workflows/:id          # 获取指定工作流
  POST /api/workflows              # 创建工作流
  POST /api/workflows/:id/start    # 启动工作流
  POST /api/workflows/:id/pause    # 暂停工作流
  POST /api/workflows/:id/resume   # 恢复工作流
  POST /api/workflows/:id/cancel   # 取消工作流
  GET  /api/health                 # 健康检查
      `);
    }
  }).catch((error) => {
    logger.error('应用启动失败', error);
    process.exit(1);
  });
}

// 导出供外部使用
export { app, frysApp, WorkflowEngine, TaskScheduler, WorkflowState, WorkflowDefinition };