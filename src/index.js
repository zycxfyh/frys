#!/usr/bin/env node

/**
 * WokeFlow Production - 主入口文件
 * 企业级工作流管理系统 (基于开源项目重构)
 */

import { logger } from './utils/logger.js';
import { config } from './utils/config.js';

// 导入新的开源组件
import { getContainer, registerValue } from './core/container.js';
import { startServer, stopServer } from './core/server.js';
import { getQueue, createWorker, closeAllQueues } from './core/queue.js';
import { eventSystem } from './core/events.js';
import { errorHandler } from './core/error-handler.js';
import { pluginManager } from './core/plugin-system.js';

// 导入业务服务
import { WorkflowEngine } from './services/WorkflowEngine.js';
import { UserService } from './services/UserService.js';

// 获取依赖注入容器
const container = await getContainer();

// 注册全局值
registerValue('eventSystem', eventSystem);
registerValue('errorHandler', errorHandler);
registerValue('pluginManager', pluginManager);

/**
 * WokeFlow Production - 基于开源项目的应用类
 */
class WokeFlowProduction {
  constructor() {
    this.container = container;
    this.eventSystem = eventSystem;
    this.server = null;
    this.initialized = false;
    this.workers = new Map();
  }

  async initialize() {
    try {
      logger.info('🚀 初始化 WokeFlow Production 系统 (开源项目重构)');

      // 1. 初始化错误处理器
      await errorHandler.initialize();

      // 2. 初始化插件系统
      await pluginManager.initialize();

      // 3. 初始化核心服务
      await this.initializeCoreServices();

      // 4. 设置事件监听器
      await this.setupEventListeners();

      // 5. 设置消息队列处理器
      await this.setupQueueProcessors();

      // 6. 更新系统状态
      const state = container.resolve('state');
      if (state && typeof state.setState === 'function') {
      state.setState((currentState) => ({
        system: {
          ...currentState.system,
          status: 'ready',
            version: '3.0.0-open-source',
            architecture: 'open-source-based',
        },
      }));
      }

      this.initialized = true;
      logger.info('✅ WokeFlow Production 系统初始化完成 (开源项目重构)');
    } catch (error) {
      await errorHandler.handle(error, { context: 'system_initialization' });
      throw error;
    }
  }

  async initializeCoreServices() {
    logger.debug('初始化核心服务...');

    // 初始化 HTTP 客户端
    const http = container.resolve('http');
    if (http && typeof http.initialize === 'function') {
      await http.initialize();
    }

    // 初始化认证服务
    const auth = container.resolve('auth');
    if (auth && typeof auth.setSecret === 'function') {
      auth.setSecret('default', config.auth?.secret || 'default-secret');
    }

    // 初始化状态管理
    const state = container.resolve('state');
    if (state && typeof state.initialize === 'function') {
      await state.initialize();
    }

    // 初始化业务服务
    const workflowEngine = container.resolve('workflowEngine');
    if (workflowEngine && typeof workflowEngine.initialize === 'function') {
      await workflowEngine.initialize();
    }

    const userService = container.resolve('userService');
    if (userService && typeof userService.initialize === 'function') {
      await userService.initialize();
    }

    logger.debug('核心服务初始化完成');
  }

  async setupEventListeners() {
    // 设置业务事件监听器
    eventSystem.on('user.created', (user) => {
      logger.info('新用户创建', { userId: user.id, username: user.username });
      // 发布到消息队列
      const userCreatedQueue = getQueue('user-events');
      userCreatedQueue.add('user.created', user).catch(error => {
        logger.error('发布用户创建事件失败', error);
      });
    });

    eventSystem.on('workflow.started', (workflow) => {
      logger.info('工作流启动', {
        workflowId: workflow.id,
        name: workflow.name,
      });
      // 发布到消息队列
      const workflowQueue = getQueue('workflow-events');
      workflowQueue.add('workflow.started', workflow).catch(error => {
        logger.error('发布工作流启动事件失败', error);
      });
    });

    eventSystem.on('task.completed', (task) => {
      logger.info('任务完成', { taskId: task.id, workflowId: task.workflowId });
      // 发布到消息队列
      const taskQueue = getQueue('task-events');
      taskQueue.add('task.completed', task).catch(error => {
        logger.error('发布任务完成事件失败', error);
      });
    });

    eventSystem.on('system.error', async (error) => {
      logger.error('系统错误', error);
      await errorHandler.handle(error, { context: 'system_event' });
    });

    // 监听插件事件
    pluginManager.hook('plugin:registered', (data) => {
      logger.info(`插件已注册: ${data.plugin.name}`);
    });

    pluginManager.hook('plugin:started', (data) => {
      logger.info(`插件已启动: ${data.plugin.name}`);
    });

    logger.debug('事件监听器设置完成');
  }

  async setupQueueProcessors() {
    const workflowEngine = container.resolve('workflowEngine');
    const userService = container.resolve('userService');

    // 创建用户事件处理器
    this.workers.set('user-events', createWorker('user-events', async (job) => {
      const { name, data } = job;
      logger.debug(`处理用户事件: ${name}`, { userId: data.id });

      // 这里可以添加用户事件的具体处理逻辑
      // 例如：发送欢迎邮件、更新统计信息等
    }));

    // 创建工作流事件处理器
    this.workers.set('workflow-events', createWorker('workflow-events', async (job) => {
      const { name, data } = job;
      logger.debug(`处理工作流事件: ${name}`, { workflowId: data.id });

      if (name === 'workflow.started') {
        // 工作流启动后的处理逻辑
        // 例如：通知相关人员、初始化监控等
      }
    }));

    // 创建任务事件处理器
    this.workers.set('task-events', createWorker('task-events', async (job) => {
      const { name, data } = job;
      logger.debug(`处理任务事件: ${name}`, { taskId: data.id, workflowId: data.workflowId });

      if (name === 'task.completed') {
        // 任务完成后的处理逻辑
        // 例如：检查工作流是否完成、触发下一个任务等
        if (workflowEngine && typeof workflowEngine.onTaskCompleted === 'function') {
          await workflowEngine.onTaskCompleted(data);
        }
      }
    }));

    // 创建失败任务重试处理器
    this.workers.set('retry-queue', createWorker('retry-queue', async (job) => {
      const { name, data } = job;
      logger.debug(`处理重试任务: ${name}`, { attempts: job.attemptsMade });

      try {
        if (name === 'retry-workflow') {
          if (workflowEngine && typeof workflowEngine.retryWorkflow === 'function') {
            await workflowEngine.retryWorkflow(data.workflowId, data.context);
        }
        } else if (name === 'retry-user-operation') {
          if (userService && typeof userService.retryOperation === 'function') {
            await userService.retryOperation(data.operation, data.params);
          }
        }
      } catch (error) {
        logger.error(`重试任务失败: ${name}`, error);
        throw error; // 让 Bull.js 处理重试逻辑
      }
    }));

    logger.info('消息队列处理器设置完成');
  }

  async start() {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      logger.info('🎯 WokeFlow Production 系统启动 (开源项目重构)');

      // 启动Web服务器
      this.server = await startServer(config.port, config.host);

      // 启动业务服务
      const workflowEngine = container.resolve('workflowEngine');
      if (workflowEngine && typeof workflowEngine.start === 'function') {
        await workflowEngine.start();
        logger.debug('工作流引擎已启动');
      }

      const userService = container.resolve('userService');
      if (userService && typeof userService.start === 'function') {
        await userService.start();
        logger.debug('用户服务已启动');
      }

      // 启动插件系统
      await pluginManager.startAll();

      logger.info('✅ 所有服务启动完成 (开源项目重构)');

      // 保持进程运行
      this.keepAlive();
    } catch (error) {
      await errorHandler.handle(error, { context: 'system_start' });
      throw error;
    }
  }

  keepAlive() {
    // 定期健康检查
    this.healthCheckTimer = setInterval(async () => {
      try {
        const health = await this.healthCheck();
        if (!health.healthy) {
          logger.warn('健康检查失败', health);
          eventSystem.emit('system:health_check_failed', health);
        } else {
          eventSystem.emit('system:health_check_passed', health);
        }
      } catch (error) {
        logger.error('健康检查异常', error);
        await errorHandler.handle(error, { context: 'health_check' });
      }
    }, 30000); // 每30秒检查一次

    // 优雅关闭处理
    process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));
    process.on('uncaughtException', (error) => {
      logger.error('未捕获的异常', error);
      this.gracefulShutdown('uncaughtException');
    });
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('未处理的Promise拒绝', { reason, promise });
      this.gracefulShutdown('unhandledRejection');
    });
  }

  async healthCheck() {
    const checks = {
      timestamp: Date.now(),
      services: {},
      container: container ? 'healthy' : 'unhealthy',
      plugins: pluginManager ? await pluginManager.healthCheck() : 'unhealthy',
      queues: {},
    };

    try {
      // 检查核心服务状态
      const serviceNames = [
        'http',
        'auth',
        'state',
        'date',
        'utils',
        'workflowEngine',
        'userService',
      ];

      for (const serviceName of serviceNames) {
        try {
          const service = container.resolve(serviceName);
        if (service && typeof service.healthCheck === 'function') {
          checks.services[serviceName] = await service.healthCheck();
        } else {
          checks.services[serviceName] = service ? 'healthy' : 'unhealthy';
        }
        } catch (error) {
          checks.services[serviceName] = 'error';
        }
      }

      // 检查队列状态
      try {
        const { getAllQueuesStatus } = await import('./core/queue.js');
        const queueStatus = await getAllQueuesStatus();
        checks.queues = queueStatus;
      } catch (error) {
        checks.queues = { error: error.message };
      }

      // 检查系统状态
      const state = container.resolve('state');
      const systemState = state && typeof state.getState === 'function' ? state.getState() : {};
      checks.services.system =
        systemState.system?.status === 'ready' ? 'healthy' : 'unhealthy';

      // 检查错误处理器
      checks.services.errorHandler = errorHandler ? await errorHandler.healthCheck() : 'unhealthy';

      // 总体健康状态
      const serviceStatuses = Object.values(checks.services);
      const queueHealthy = !checks.queues.error;
      checks.healthy = serviceStatuses.every(
        (status) =>
          status === 'healthy' ||
          (typeof status === 'object' && status.healthy !== false),
      ) && queueHealthy;

      checks.architecture = 'open-source-based';
      checks.version = '3.0.0';
    } catch (error) {
      checks.healthy = false;
      checks.error = error.message;
      logger.error('健康检查失败', error);
    }

    return checks;
  }

  async gracefulShutdown(signal) {
    logger.info(`收到 ${signal} 信号，开始优雅关闭 (开源项目重构)`);

    try {
      // 清理定时器
      if (this.healthCheckTimer) {
        clearInterval(this.healthCheckTimer);
      }

      // 停止Web服务器
      if (this.server) {
        await stopServer(this.server);
        logger.debug('Web服务器已停止');
      }

      // 停止插件系统
      await pluginManager.stopAll();

      // 停止业务服务
      const workflowEngine = container.resolve('workflowEngine');
      if (workflowEngine && typeof workflowEngine.stop === 'function') {
        await workflowEngine.stop();
        logger.debug('工作流引擎已停止');
      }

      const userService = container.resolve('userService');
      if (userService && typeof userService.stop === 'function') {
        await userService.stop();
        logger.debug('用户服务已停止');
          }

      // 停止消息队列工作进程和队列
      await closeAllQueues();
      logger.debug('消息队列已停止');

      // 停止错误处理器
      if (errorHandler && typeof errorHandler.destroy === 'function') {
        await errorHandler.destroy();
        logger.debug('错误处理器已停止');
        }

      logger.info('✅ 系统优雅关闭完成 (开源项目重构)');
      process.exit(0);
    } catch (error) {
      logger.error('优雅关闭失败', error);
      await errorHandler.handle(error, {
        context: 'graceful_shutdown',
        signal,
      });
      process.exit(1);
    }
  }

  // 公开API接口 (开源项目重构)

  /**
   * 获取指定服务
   */
  getService(name) {
    return container.resolve(name);
  }

  /**
   * 获取容器实例
   */
  getContainer() {
    return container;
  }

  /**
   * 获取事件系统
   */
  getEventSystem() {
    return eventSystem;
  }

  /**
   * 获取插件管理器
   */
  getPluginManager() {
    return pluginManager;
  }

  /**
   * 获取错误处理器
   */
  getErrorHandler() {
    return errorHandler;
  }

  /**
   * 获取系统状态
   */
  getSystemStatus() {
    return {
      initialized: this.initialized,
      container: 'awilix',
      eventSystem: 'eventemitter3',
      messaging: 'bull',
      webFramework: 'fastify',
      errorHandler: 'sentry',
      pluginSystem: 'fastify-plugin',
      architecture: 'open-source-based',
      version: '3.0.0',
    };
  }
}

// 创建全局实例
const app = new WokeFlowProduction();

// 导出供外部使用
export { app, WokeFlowProduction };

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
  app.start().catch((error) => {
    logger.error('应用启动失败', error);
    process.exit(1);
  });
}
