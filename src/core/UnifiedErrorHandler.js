/**
 * frys 轻量级核心 - 统一错误处理
 * 提供集中化的错误处理、日志记录和恢复机制
 */

import { logger } from '../utils/logger.js';

/**
 * 错误类型枚举
 */
export const ErrorType = {
  VALIDATION: 'VALIDATION',
  AUTHENTICATION: 'AUTHENTICATION',
  AUTHORIZATION: 'AUTHORIZATION',
  NETWORK: 'NETWORK',
  DATABASE: 'DATABASE',
  CONFIGURATION: 'CONFIGURATION',
  BUSINESS_LOGIC: 'BUSINESS_LOGIC',
  SYSTEM: 'SYSTEM',
  UNKNOWN: 'UNKNOWN',
};

/**
 * 错误严重级别
 */
export const ErrorSeverity = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
};

/**
 * 统一错误类
 */
export class frysError extends Error {
  constructor(
    message,
    type = ErrorType.UNKNOWN,
    severity = ErrorSeverity.MEDIUM,
    context = {},
  ) {
    super(message);
    this.name = 'frysError';
    this.type = type;
    this.severity = severity;
    this.context = context;
    this.timestamp = new Date();
    this.id = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 保持正确的堆栈跟踪
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, frysError);
    }
  }

  /**
   * 创建验证错误
   */
  static validation(message, field, value) {
    return new frysError(message, ErrorType.VALIDATION, ErrorSeverity.LOW, {
      field,
      value,
    });
  }

  /**
   * 创建认证错误
   */
  static authentication(message, username) {
    return new frysError(
      message,
      ErrorType.AUTHENTICATION,
      ErrorSeverity.MEDIUM,
      { username },
    );
  }

  /**
   * 创建授权错误
   */
  static authorization(message, userId, resource) {
    return new frysError(
      message,
      ErrorType.AUTHORIZATION,
      ErrorSeverity.HIGH,
      { userId, resource },
    );
  }

  /**
   * 创建网络错误
   */
  static network(message, url, statusCode) {
    return new frysError(message, ErrorType.NETWORK, ErrorSeverity.MEDIUM, {
      url,
      statusCode,
    });
  }

  /**
   * 创建数据库错误
   */
  static database(message, operation, table) {
    return new frysError(message, ErrorType.DATABASE, ErrorSeverity.HIGH, {
      operation,
      table,
    });
  }

  /**
   * 创建系统错误
   */
  static system(message, component) {
    return new frysError(
      message,
      ErrorType.SYSTEM,
      ErrorSeverity.CRITICAL,
      { component },
    );
  }

  /**
   * 转换为可序列化对象
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      message: this.message,
      type: this.type,
      severity: this.severity,
      context: this.context,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }
}

/**
 * 统一错误处理器
 */
export class UnifiedErrorHandler {
  constructor(config = {}) {
    this.config = {
      enableLogging: true,
      enableReporting: false,
      maxRetries: 3,
      ...config,
    };

    this._handlers = new Map();
    this._recoveryStrategies = new Map();
    this._errorStats = new Map();
  }

  /**
   * 注册错误处理器
   */
  registerHandler(errorType, handler) {
    this._handlers.set(errorType, handler);
    return this;
  }

  /**
   * 注册恢复策略
   */
  registerRecovery(errorType, strategy) {
    this._recoveryStrategies.set(errorType, strategy);
    return this;
  }

  /**
   * 处理错误
   */
  async handle(error, context = {}) {
    try {
      // 标准化错误
      const normalizedError = this._normalizeError(error);

      // 更新统计信息
      this._updateStats(normalizedError);

      // 记录错误
      if (this.config.enableLogging) {
        this._logError(normalizedError, context);
      }

      // 上报错误
      if (this.config.enableReporting) {
        this._reportError(normalizedError, context);
      }

      // 尝试恢复
      const recovered = await this._tryRecovery(normalizedError, context);
      if (recovered) {
        logger.info('错误已恢复', { errorId: normalizedError.id });
        return recovered;
      }

      // 使用特定处理器
      const handler = this._handlers.get(normalizedError.type);
      if (handler) {
        return await handler(normalizedError, context);
      }

      // 默认处理
      return this._defaultHandle(normalizedError, context);
    } catch (handlerError) {
      logger.error('错误处理器自身出错', handlerError);
      return this._defaultHandle(error, context);
    }
  }

  /**
   * 包装异步函数
   */
  wrap(fn, context = {}) {
    return async (...args) => {
      try {
        return await fn.apply(this, args);
      } catch (error) {
        return await this.handle(error, {
          ...context,
          function: fn.name,
          args,
        });
      }
    };
  }

  /**
   * 重试包装器
   */
  withRetry(fn, maxRetries = this.config.maxRetries, context = {}) {
    return async (...args) => {
      let lastError;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          return await fn.apply(this, args);
        } catch (error) {
          lastError = error;

          if (attempt < maxRetries) {
            logger.warn(`重试 ${attempt}/${maxRetries}`, {
              error: error.message,
              context: { ...context, attempt },
            });

            // 指数退避
            await this._delay(Math.pow(2, attempt) * 1000);
          }
        }
      }

      // 所有重试都失败，抛出最后一个错误
      throw lastError;
    };
  }

  /**
   * 标准化错误
   */
  _normalizeError(error) {
    if (error instanceof frysError) {
      return error;
    }

    // 根据错误消息推断类型
    let type = ErrorType.UNKNOWN;
    let severity = ErrorSeverity.MEDIUM;

    const message = error.message?.toLowerCase() || '';

    if (message.includes('validation') || message.includes('invalid')) {
      type = ErrorType.VALIDATION;
      severity = ErrorSeverity.LOW;
    } else if (
      message.includes('unauthorized') ||
      message.includes('authentication')
    ) {
      type = ErrorType.AUTHENTICATION;
      severity = ErrorSeverity.MEDIUM;
    } else if (
      message.includes('forbidden') ||
      message.includes('permission')
    ) {
      type = ErrorType.AUTHORIZATION;
      severity = ErrorSeverity.HIGH;
    } else if (message.includes('network') || message.includes('connection')) {
      type = ErrorType.NETWORK;
      severity = ErrorSeverity.MEDIUM;
    } else if (message.includes('database') || message.includes('sql')) {
      type = ErrorType.DATABASE;
      severity = ErrorSeverity.HIGH;
    } else if (message.includes('config') || message.includes('environment')) {
      type = ErrorType.CONFIGURATION;
      severity = ErrorSeverity.HIGH;
    }

    return new frysError(error.message || '未知错误', type, severity, {
      originalError: error,
    });
  }

  /**
   * 更新统计信息
   */
  _updateStats(error) {
    const key = `${error.type}:${error.severity}`;
    const current = this._errorStats.get(key) || { count: 0, lastSeen: null };
    this._errorStats.set(key, {
      count: current.count + 1,
      lastSeen: new Date(),
    });
  }

  /**
   * 记录错误
   */
  _logError(error, context) {
    const logData = {
      errorId: error.id,
      type: error.type,
      severity: error.severity,
      message: error.message,
      context: { ...error.context, ...context },
    };

    switch (error.severity) {
      case ErrorSeverity.LOW:
        logger.debug('低优先级错误', logData);
        break;
      case ErrorSeverity.MEDIUM:
        logger.warn('中等优先级错误', logData);
        break;
      case ErrorSeverity.HIGH:
        logger.error('高优先级错误', logData);
        break;
      case ErrorSeverity.CRITICAL:
        logger.error('严重错误', logData);
        // 可以在这里触发告警
        break;
    }
  }

  /**
   * 上报错误
   */
  _reportError(error, context) {
    // 这里可以集成错误上报服务，如 Sentry、LogRocket 等
    if (typeof global !== 'undefined' && global.errorReporting) {
      global.errorReporting.report(error, context);
    }
  }

  /**
   * 尝试恢复
   */
  async _tryRecovery(error, context) {
    const strategy = this._recoveryStrategies.get(error.type);
    if (strategy) {
      try {
        logger.info('尝试恢复错误', { errorId: error.id, type: error.type });
        return await strategy(error, context);
      } catch (recoveryError) {
        logger.warn('恢复策略失败', {
          errorId: error.id,
          recoveryError: recoveryError.message,
        });
      }
    }
    return null;
  }

  /**
   * 默认错误处理
   */
  _defaultHandle(error, context) {
    // 根据严重程度决定是否抛出
    if (error.severity === ErrorSeverity.CRITICAL) {
      throw error;
    }

    // 对于非严重错误，返回 null 或默认值
    return null;
  }

  /**
   * 延迟函数
   */
  _delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 获取错误统计
   */
  getStats() {
    return {
      total: Array.from(this._errorStats.values()).reduce(
        (sum, stat) => sum + stat.count,
        0,
      ),
      byType: Object.fromEntries(this._errorStats),
    };
  }

  /**
   * 清理统计数据
   */
  clearStats() {
    this._errorStats.clear();
  }
}

/**
 * 全局错误处理器实例
 */
export const errorHandler = new UnifiedErrorHandler();

/**
 * 错误处理装饰器
 */
export function HandleErrors(options = {}) {
  return function (target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args) {
      try {
        return await originalMethod.apply(this, args);
      } catch (error) {
        return await errorHandler.handle(error, {
          className: target.constructor.name,
          methodName: propertyKey,
          args,
          ...options,
        });
      }
    };

    return descriptor;
  };
}

/**
 * 重试装饰器
 */
export function Retry(maxRetries = 3, delay = 1000) {
  return function (target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = errorHandler.withRetry(originalMethod, maxRetries, {
      className: target.constructor.name,
      methodName: propertyKey,
    });

    return descriptor;
  };
}

/**
 * 超时装饰器
 */
export function Timeout(ms = 30000) {
  return function (target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args) {
      return await Promise.race([
        originalMethod.apply(this, args),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(frysError.system(`操作超时: ${ms}ms`, 'timeout')),
            ms,
          ),
        ),
      ]);
    };

    return descriptor;
  };
}

/**
 * 死信队列管理器
 */
export class DeadLetterQueue {
  constructor(options = {}) {
    this.options = {
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 1000,
      maxQueueSize: options.maxQueueSize || 1000,
      ttl: options.ttl || 24 * 60 * 60 * 1000, // 24小时
      ...options,
    };

    this.queues = new Map();
    this.processors = new Map();
    this.stats = {
      totalProcessed: 0,
      totalFailed: 0,
      queuesCreated: 0,
    };

    // 定期清理过期消息
    this.cleanupTimer = setInterval(
      () => {
        this.cleanup();
      },
      60 * 60 * 1000,
    ); // 每小时清理一次
  }

  /**
   * 创建或获取死信队列
   */
  getQueue(queueName) {
    if (!this.queues.has(queueName)) {
      this.queues.set(queueName, []);
      this.stats.queuesCreated++;
      logger.info(`死信队列已创建: ${queueName}`);
    }
    return this.queues.get(queueName);
  }

  /**
   * 添加消息到死信队列
   */
  async addToQueue(queueName, message, error, context = {}) {
    const queue = this.getQueue(queueName);

    // 检查队列大小限制
    if (queue.length >= this.options.maxQueueSize) {
      logger.warn(`死信队列已满，丢弃消息: ${queueName}`, {
        queueSize: queue.length,
        maxSize: this.options.maxQueueSize,
      });
      return false;
    }

    const deadLetterMessage = {
      id: `dlq_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      originalMessage: message,
      error: {
        message: error.message,
        type: error.type || 'UNKNOWN',
        severity: error.severity || 'MEDIUM',
        stack: error.stack,
      },
      context,
      timestamp: new Date(),
      retryCount: 0,
      maxRetries: this.options.maxRetries,
      nextRetry: new Date(Date.now() + this.options.retryDelay),
      status: 'queued',
    };

    queue.push(deadLetterMessage);

    logger.warn(`消息已添加到死信队列: ${queueName}`, {
      messageId: deadLetterMessage.id,
      errorType: error.type,
      queueSize: queue.length,
    });

    return deadLetterMessage.id;
  }

  /**
   * 注册消息处理器
   */
  registerProcessor(queueName, processor) {
    this.processors.set(queueName, processor);
    logger.info(`死信队列处理器已注册: ${queueName}`);
  }

  /**
   * 处理队列中的消息
   */
  async processQueue(queueName) {
    const queue = this.queues.get(queueName);
    if (!queue || queue.length === 0) return;

    const processor = this.processors.get(queueName);
    if (!processor) {
      logger.warn(`未找到死信队列处理器: ${queueName}`);
      return;
    }

    const now = new Date();
    const messagesToProcess = queue.filter(
      (msg) => msg.status === 'queued' && msg.nextRetry <= now,
    );

    for (const message of messagesToProcess) {
      try {
        message.status = 'processing';
        message.retryCount++;

        await processor(message.originalMessage, message.context);

        // 处理成功，从队列中移除
        const index = queue.indexOf(message);
        if (index > -1) {
          queue.splice(index, 1);
        }

        this.stats.totalProcessed++;
        logger.info(`死信队列消息处理成功: ${queueName}`, {
          messageId: message.id,
          retryCount: message.retryCount,
        });
      } catch (error) {
        message.status = 'queued';

        if (message.retryCount >= message.maxRetries) {
          // 达到最大重试次数，标记为失败
          message.status = 'failed';
          message.finalError = {
            message: error.message,
            timestamp: new Date(),
          };
          this.stats.totalFailed++;

          logger.error(`死信队列消息处理最终失败: ${queueName}`, {
            messageId: message.id,
            retryCount: message.retryCount,
            error: error.message,
          });
        } else {
          // 计算下次重试时间（指数退避）
          const delay =
            this.options.retryDelay * Math.pow(2, message.retryCount - 1);
          message.nextRetry = new Date(Date.now() + delay);

          logger.warn(`死信队列消息处理失败，将重试: ${queueName}`, {
            messageId: message.id,
            retryCount: message.retryCount,
            nextRetry: message.nextRetry,
            error: error.message,
          });
        }
      }
    }
  }

  /**
   * 清理过期消息
   */
  cleanup() {
    const now = new Date();
    const ttl = this.options.ttl;
    let totalCleaned = 0;

    for (const [queueName, queue] of this.queues) {
      const initialSize = queue.length;
      const filtered = queue.filter((message) => {
        const age = now - message.timestamp;
        return age < ttl;
      });

      const cleaned = initialSize - filtered.length;
      if (cleaned > 0) {
        this.queues.set(queueName, filtered);
        totalCleaned += cleaned;
        logger.info(`死信队列清理完成: ${queueName}`, {
          cleaned,
          remaining: filtered.length,
        });
      }
    }

    if (totalCleaned > 0) {
      logger.info('死信队列全局清理完成', { totalCleaned });
    }
  }

  /**
   * 获取队列统计信息
   */
  getStats() {
    const queueStats = {};
    for (const [queueName, queue] of this.queues) {
      const stats = {
        size: queue.length,
        queued: queue.filter((m) => m.status === 'queued').length,
        processing: queue.filter((m) => m.status === 'processing').length,
        failed: queue.filter((m) => m.status === 'failed').length,
        oldest:
          queue.length > 0
            ? Math.min(...queue.map((m) => m.timestamp.getTime()))
            : null,
        newest:
          queue.length > 0
            ? Math.max(...queue.map((m) => m.timestamp.getTime()))
            : null,
      };
      queueStats[queueName] = stats;
    }

    return {
      global: this.stats,
      queues: queueStats,
    };
  }

  /**
   * 停止死信队列管理器
   */
  stop() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    // 处理所有队列中的剩余消息
    for (const [queueName] of this.queues) {
      // 这里可以选择要么等待处理完成，要么直接丢弃
      logger.info(`停止死信队列: ${queueName}`);
    }

    logger.info('死信队列管理器已停止');
  }
}

/**
 * 全局死信队列实例
 */
export const deadLetterQueue = new DeadLetterQueue({
  maxRetries: 5,
  retryDelay: 2000,
  maxQueueSize: 5000,
  ttl: 7 * 24 * 60 * 60 * 1000, // 7天
});

/**
 * 死信队列装饰器
 */
export function WithDeadLetterQueue(queueName) {
  return function (target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args) {
      try {
        return await originalMethod.apply(this, args);
      } catch (error) {
        // 添加到死信队列
        const messageId = await deadLetterQueue.addToQueue(
          queueName,
          { method: propertyKey, args },
          error,
          { className: target.constructor.name },
        );

        // 重新抛出错误，但包含死信队列信息
        const enhancedError = new frysError(
          `操作失败，已添加到死信队列: ${error.message}`,
          error.type || ErrorType.SYSTEM,
          error.severity || ErrorSeverity.HIGH,
          {
            ...error.context,
            deadLetterQueueId: messageId,
            originalError: error.message,
          },
        );

        throw enhancedError;
      }
    };

    return descriptor;
  };
}
