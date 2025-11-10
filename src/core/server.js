/**
 * frys Web服务器配置
 * 使用 Fastify 替代自建的 HTTP 处理逻辑
 */

import Fastify from 'fastify';
import fastifyPlugin from 'fastify-plugin';
import { config } from '../../shared/utils/config.js';
import { logger } from '../../shared/utils/logger.js';
import { resolve } from './container.js';

// 导入插件
import { pluginManager } from './PluginSystem.js';

/**
 * 创建 Fastify 应用实例
 */
function createFastifyApp() {
  const app = Fastify({
    logger: false, // 我们使用自己的logger
    disableRequestLogging: true, // 避免重复日志
    routerOptions: {
      ignoreTrailingSlash: true,
      maxParamLength: 500,
    },
    bodyLimit: 1048576, // 1MB
  });

  return app;
}

/**
 * 配置中间件和插件
 */
async function configureApp(app) {
  // 注册自定义插件
  app.register(
    fastifyPlugin(async (fastify) => {
      // 添加请求日志中间件
      fastify.addHook('onRequest', async (request) => {
        const start = Date.now();
        request.startTime = start;

        logger.debug('📨 请求开始', {
          method: request.method,
          url: request.url,
          ip: request.ip,
          userAgent: request.headers['user-agent'],
        });
      });

      // 添加响应日志中间件
      fastify.addHook('onResponse', async (request, reply) => {
        const duration = Date.now() - request.startTime;

        logger.debug('📤 响应完成', {
          method: request.method,
          url: request.url,
          statusCode: reply.statusCode,
          duration: `${duration}ms`,
        });
      });

      // 添加错误处理中间件
      fastify.addHook('onError', async (request, reply, error) => {
        logger.error('🔥 请求错误', {
          method: request.method,
          url: request.url,
          error: error.message,
          stack: error.stack,
        });
      });

      // 设置全局错误处理器
      fastify.setErrorHandler(async (error, request, reply) => {
        const errorHandler = resolve('errorHandler');
        if (errorHandler) {
          await errorHandler.handle(error, {
            context: 'http_request',
            request: {
              method: request.method,
              url: request.url,
              headers: request.headers,
              body: request.body,
            },
          });
        }

        // 返回标准错误响应
        const statusCode = error.statusCode || 500;
        const message =
          config.env === 'production' ? 'Internal Server Error' : error.message;

        reply.status(statusCode).send({
          error: {
            message,
            statusCode,
            timestamp: new Date().toISOString(),
          },
        });
      });

      // 设置未找到处理器
      fastify.setNotFoundHandler(async (request, reply) => {
        logger.warn('🚫 路由未找到', {
          method: request.method,
          url: request.url,
        });

        reply.status(404).send({
          error: {
            message: 'Not Found',
            statusCode: 404,
            timestamp: new Date().toISOString(),
          },
        });
      });
    }),
  );

  // 注册插件管理器的路由
  await pluginManager.registerRoutes(app);
}

/**
 * 配置路由
 */
async function configureRoutes(app) {
  // 等待容器初始化
  const { getContainer } = await import('./container.js');
  const container = await getContainer();

  const workflowEngine = container.resolve('workflowEngine');
  const userService = container.resolve('userService');
  const authService = container.resolve('authenticationService');
  const conversationManager = container.resolve('conversationManager');

  // 健康检查路由 (不需要认证)
  app.get('/health', async (request, reply) => {
    const health = await getSystemHealth();
    reply.status(health.healthy ? 200 : 503).send(health);
  });

  // 认证路由 (Fastify格式)
  app.post('/api/auth/register', async (request, reply) => {
    try {
      const result = await authService.register(request.body);
      reply.code(201).send(result);
    } catch (error) {
      reply.code(400).send({ error: error.message });
    }
  });

  app.post('/api/auth/login', async (request, reply) => {
    try {
      const result = await authService.login(request.body);
      reply.send(result);
    } catch (error) {
      reply.code(401).send({ error: error.message });
    }
  });

  // AI路由 (Fastify格式)
  app.post('/api/ai/conversations', async (request, reply) => {
    try {
      const result = await conversationManager.createConversation(request.body);
      reply.code(201).send(result);
    } catch (error) {
      reply.code(400).send({ error: error.message });
    }
  });

  app.post(
    '/api/ai/conversations/:conversationId/messages',
    async (request, reply) => {
      try {
        const result = await conversationManager.sendMessage(
          request.params.conversationId,
          request.body.message,
          { userId: 'test-user' },
        );
        reply.send(result);
      } catch (error) {
        reply.code(400).send({ error: error.message });
      }
    },
  );

  // API v1 路由组 (需要认证)
  app.register(
    async (apiRoutes) => {
      // JWT 认证中间件
      apiRoutes.addHook('preHandler', async (request, reply) => {
        const authHeader = request.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return reply.status(401).send({ error: 'Unauthorized' });
        }

        const token = authHeader.substring(7);
        try {
          const payload = authService.verifyAccessToken(token);
          request.user = payload.user;
          request.sessionId = payload.sessionId;
        } catch (error) {
          return reply.status(401).send({ error: 'Invalid token' });
        }
      });

      // 工作流路由
      apiRoutes.get('/workflows', async (request, reply) => {
        try {
          const workflows = await workflowEngine.getWorkflows(request.user.id);
          reply.send({ workflows });
        } catch (error) {
          reply.status(500).send({ error: error.message });
        }
      });

      apiRoutes.post('/workflows', async (request, reply) => {
        try {
          const workflow = await workflowEngine.createWorkflow(
            request.body,
            request.user.id,
          );
          reply.status(201).send({ workflow });
        } catch (error) {
          reply.status(400).send({ error: error.message });
        }
      });

      apiRoutes.post('/workflows/:id/start', async (request, reply) => {
        try {
          const result = await workflowEngine.startWorkflow(
            request.params.id,
            request.user.id,
          );
          reply.send({ result });
        } catch (error) {
          reply.status(400).send({ error: error.message });
        }
      });

      // 用户路由
      apiRoutes.get('/users/profile', async (request, reply) => {
        try {
          const profile = await userService.getProfile(request.user.id);
          reply.send({ profile });
        } catch (error) {
          reply.status(500).send({ error: error.message });
        }
      });
    },
    { prefix: '/api/v1' },
  );
}

/**
 * 获取系统健康状态
 */
async function getSystemHealth() {
  const checks = {
    timestamp: Date.now(),
    services: {},
  };

  try {
    // 检查核心服务
    const services = [
      'http',
      'messaging',
      'state',
      'auth',
      'workflowEngine',
      'userService',
    ];

    // 等待容器初始化
    const { getContainer } = await import('./container.js');
    const container = await getContainer();

    for (const serviceName of services) {
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

    // 总体健康状态
    const serviceStatuses = Object.values(checks.services);
    checks.healthy = serviceStatuses.every(
      (status) =>
        status === 'healthy' ||
        (typeof status === 'object' && status.healthy !== false),
    );

    checks.uptime = process.uptime();
    checks.memory = process.memoryUsage();
    checks.version = config.version || '1.0.0';
  } catch (error) {
    checks.healthy = false;
    checks.error = error.message;
    logger.error('健康检查失败', error);
  }

  return checks;
}

/**
 * 启动服务器
 */
export async function startServer(
  port = config.port || 3000,
  host = '0.0.0.0',
) {
  const app = createFastifyApp();

  // 配置应用
  await configureApp(app);
  await configureRoutes(app);

  try {
    await app.listen({ port, host });
    logger.info(`🚀 frys 服务器已启动 http://${host}:${port}`);

    return app;
  } catch (error) {
    logger.error('服务器启动失败', error);
    throw error;
  }
}

/**
 * 停止服务器
 */
export async function stopServer(app) {
  if (app) {
    await app.close();
    logger.info('🛑 frys 服务器已停止');
  }
}

export { createFastifyApp, configureApp, configureRoutes, getSystemHealth };
