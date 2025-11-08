/**
 * frys 错误处理配置
 * 使用 Sentry 替代自建的 UnifiedErrorHandler
 */

import * as Sentry from '@sentry/node';
import * as Profiling from '@sentry/profiling-node';
import { logger } from '../utils/logger.js';
import { config } from '../utils/config.js';

// Sentry 配置 - 只有在配置了DSN时才启用
const SENTRY_CONFIG = config.sentry?.dsn ? {
  dsn: config.sentry.dsn,
  environment: config.env || 'development',
  release: config.version || '1.0.0',
  integrations: [
    // 性能分析 (如果可用)
    ...(Profiling.nodeProfilingIntegration ? [Profiling.nodeProfilingIntegration()] : []),
  ],

  // 性能监控
  tracesSampleRate: config.sentry?.tracesSampleRate || 0.1, // 10% 的请求会被追踪
  profilesSampleRate: config.sentry?.profilesSampleRate || 0.1, // 10% 的性能分析

  // 错误采样
  sampleRate: config.sentry?.sampleRate || 1.0,

  // 调试模式
  debug: config.env === 'development',

  // 敏感数据过滤
  beforeSend(event, hint) {
    // 过滤敏感信息
    if (event.request) {
      if (event.request.headers) {
        // 移除敏感头部
        delete event.request.headers.authorization;
        delete event.request.headers['x-api-key'];
        delete event.request.headers.cookie;
      }

      if (event.request.data) {
        // 过滤请求数据中的敏感字段
        const data = event.request.data;
        if (typeof data === 'object') {
          filterSensitiveData(data);
        }
      }
    }

    return event;
  },

  // 性能监控过滤
  beforeSendTransaction(event) {
    // 只监控重要的交易
    if (event.transaction && event.transaction.includes('/health')) {
      return null; // 不监控健康检查
    }
    return event;
  },
} : null;

/**
 * 过滤敏感数据
 */
function filterSensitiveData(obj) {
  const sensitiveKeys = [
    'password', 'token', 'secret', 'key', 'apiKey', 'auth',
    'creditCard', 'ssn', 'socialSecurity', 'passport'
  ];

  for (const key in obj) {
    if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
      obj[key] = '[FILTERED]';
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      filterSensitiveData(obj[key]);
    }
  }
}

/**
 * 初始化 Sentry
 */
export function initializeSentry() {
  if (SENTRY_CONFIG) {
    Sentry.init(SENTRY_CONFIG);

    // 设置用户上下文（如果有的话）
    if (config.sentry?.user) {
      Sentry.setUser(config.sentry.user);
    }

    // 设置标签
    Sentry.setTags({
      service: 'frys',
      version: config.version || '1.0.0',
      environment: config.env || 'development',
    });

    logger.info('🛡️ Sentry 错误监控已初始化');
  } else {
    // 在开发环境中不显示警告，只在生产环境中提示
    if (config.env === 'production') {
      logger.warn('⚠️ Sentry DSN 未配置，生产环境中建议启用错误监控');
    } else {
      logger.debug('ℹ️ Sentry DSN 未配置，使用本地错误处理');
    }
  }
}

/**
 * 错误处理器类
 */
class ErrorHandler {
  constructor() {
    this.initialized = false;
  }

  /**
   * 初始化错误处理器
   */
  async initialize() {
    initializeSentry();
    this.setupGlobalHandlers();
    this.initialized = true;
    logger.info('🛡️ 错误处理器已初始化');
  }

  /**
   * 设置全局错误处理器
   */
  setupGlobalHandlers() {
    // 未捕获的异常
    process.on('uncaughtException', (error) => {
      this.handle(error, { context: 'uncaught_exception' });
      // 在生产环境中退出进程
      if (config.env === 'production') {
        setTimeout(() => process.exit(1), 1000);
      }
    });

    // 未处理的Promise拒绝
    process.on('unhandledRejection', (reason, promise) => {
      const error = reason instanceof Error ? reason : new Error(String(reason));
      this.handle(error, {
        context: 'unhandled_rejection',
        promise: promise.toString(),
      });
    });

    // 警告监听
    process.on('warning', (warning) => {
      logger.warn('⚠️ 进程警告', {
        message: warning.message,
        name: warning.name,
        stack: warning.stack,
      });

      // 只在 Sentry 中记录严重的警告
      if (config.sentry?.dsn && warning.name === 'DeprecationWarning') {
        Sentry.captureMessage(`Deprecation Warning: ${warning.message}`, 'warning');
      }
    });
  }

  /**
   * 处理错误
   */
  async handle(error, context = {}) {
    // 记录到日志
    logger.error('🔥 错误发生', {
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString(),
    });

    // 发送到 Sentry
    if (config.sentry?.dsn) {
      Sentry.withScope((scope) => {
        // 设置上下文信息
        scope.setTag('context', context.context || 'unknown');
        scope.setTag('service', 'frys');

        if (context.userId) {
          scope.setUser({ id: context.userId });
        }

        if (context.request) {
          scope.setContext('request', {
            method: context.request.method,
            url: context.request.url,
            headers: context.request.headers,
            body: typeof context.request.body === 'object'
              ? JSON.stringify(context.request.body).substring(0, 1000)
              : context.request.body,
          });
        }

        if (context.workflowId) {
          scope.setTag('workflow_id', context.workflowId);
        }

        if (context.taskId) {
          scope.setTag('task_id', context.taskId);
        }

        // 设置额外上下文
        Object.keys(context).forEach(key => {
          if (!['context', 'userId', 'request', 'workflowId', 'taskId'].includes(key)) {
            scope.setContext(key, context[key]);
          }
        });

        // 发送错误
        Sentry.captureException(error);
      });
    }

    // 发射错误事件
    try {
      // 只有在容器初始化后才发射事件
      const { resolve } = await import('./container.js');
      const eventSystem = resolve('eventSystem');
      if (eventSystem) {
        eventSystem.emit('error:occurred', {
          error,
          context,
          timestamp: Date.now(),
        });
      }
    } catch (eventError) {
      // 静默忽略容器未初始化时的错误
      if (!eventError.message.includes("Could not resolve 'eventSystem'")) {
      logger.error('发射错误事件失败', eventError);
      }
    }
  }

  /**
   * 包装异步函数以自动错误处理
   */
  wrapAsync(fn, context = {}) {
    return async (...args) => {
      try {
        return await fn(...args);
      } catch (error) {
        await this.handle(error, context);
        throw error; // 重新抛出错误，保持原有行为
      }
    };
  }

  /**
   * 创建错误边界
   */
  createErrorBoundary(name) {
    return {
      execute: async (fn, context = {}) => {
        try {
          return await fn();
        } catch (error) {
          await this.handle(error, {
            ...context,
            boundary: name,
          });
          throw error;
        }
      },
    };
  }

  /**
   * 记录性能问题
   */
  recordPerformance( name, duration, context = {}) {
    if (config.sentry?.dsn && duration > (config.sentry?.slowQueryThreshold || 1000)) {
      Sentry.withScope((scope) => {
        scope.setTag('performance', 'slow_operation');
        scope.setTag('operation', name);
        scope.setContext('performance', {
          duration,
          threshold: config.sentry?.slowQueryThreshold || 1000,
          ...context,
        });

        Sentry.captureMessage(`Slow operation detected: ${name}`, 'warning');
      });
    }
  }

  /**
   * 健康检查
   */
  async healthCheck() {
    return {
      healthy: true,
      sentry: {
        enabled: !!config.sentry?.dsn,
        environment: config.env,
      },
      timestamp: Date.now(),
    };
  }

  /**
   * 创建标准化的错误对象 (保持向后兼容性)
   */
  createError(type, message, context = {}, code = 500) {
    const error = new frysError(message, type, code, context);
    this.handle(error, { context: 'error_creation' });
    return error;
  }

  /**
   * 清理资源
   */
  async destroy() {
    if (config.sentry?.dsn) {
      await Sentry.close(2000); // 等待2秒让事件发送完成
    }
    this.initialized = false;
    logger.info('🛡️ 错误处理器已清理');
  }
}

/**
 * 错误类型枚举 - 保持向后兼容性
 */
export const ErrorType = {
  UNKNOWN: 'UNKNOWN_ERROR',
  VALIDATION: 'VALIDATION_ERROR',
  AUTHENTICATION: 'AUTHENTICATION_ERROR',
  AUTHORIZATION: 'AUTHORIZATION_ERROR',
  NETWORK: 'NETWORK_ERROR',
  DATABASE: 'DATABASE_ERROR',
  CONFIGURATION: 'CONFIGURATION_ERROR',
  SYSTEM: 'SYSTEM_ERROR',
};

/**
 * frys 错误类 - 保持向后兼容性
 */
export class frysError extends Error {
  constructor(message, type = 'UNKNOWN_ERROR', code = 500, context = {}) {
    super(message);
    this.name = 'frysError';
    this.type = type;
    this.code = code;
    this.context = context;
    this.timestamp = Date.now();

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, frysError);
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      type: this.type,
      code: this.code,
      context: this.context,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }

  // 便捷的错误创建方法
  static authentication(message, context = {}) {
    return new frysError(message, 'AUTHENTICATION_ERROR', 401, context);
  }

  static authorization(message, context = {}) {
    return new frysError(message, 'AUTHORIZATION_ERROR', 403, context);
  }

  static validation(message, context = {}) {
    return new frysError(message, 'VALIDATION_ERROR', 400, context);
  }

  static notFound(message, context = {}) {
    return new frysError(message, 'NOT_FOUND_ERROR', 404, context);
  }

  static conflict(message, context = {}) {
    return new frysError(message, 'CONFLICT_ERROR', 409, context);
  }

  static network(message, context = {}) {
    return new frysError(message, 'NETWORK_ERROR', 500, context);
  }

  static system(message, context = {}) {
    return new frysError(message, 'SYSTEM_ERROR', 500, context);
  }
}

// 创建全局错误处理器实例
const errorHandler = new ErrorHandler();

// 导出
export { errorHandler, ErrorHandler };
export default errorHandler;
