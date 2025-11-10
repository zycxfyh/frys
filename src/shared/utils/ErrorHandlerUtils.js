/**
 * 错误处理工具类
 * 提供统一的错误处理和日志记录功能
 */

import { logger } from '../utils/logger.js';

export class ErrorHandlerUtils {
  /**
   * 创建标准化的错误处理包装器
   */
  static createErrorHandler(operationName, context = {}) {
    return async (operation, options = {}) => {
      const startTime = Date.now();

      try {
        logger.debug(`Starting operation: ${operationName}`, {
          ...context,
          timestamp: new Date().toISOString()
        });

        const result = await operation();
        const duration = Date.now() - startTime;

        logger.debug(`Operation completed: ${operationName}`, {
          ...context,
          duration,
          success: true
        });

        return result;

      } catch (error) {
        const duration = Date.now() - startTime;

        const errorContext = {
          ...context,
          operation: operationName,
          duration,
          error: error.message,
          stack: options.includeStack ? error.stack : undefined,
          timestamp: new Date().toISOString()
        };

        logger.error(`Operation failed: ${operationName}`, errorContext);

        // 如果指定了重试逻辑
        if (options.retry && typeof options.retry === 'function') {
          try {
            logger.info(`Retrying operation: ${operationName}`, context);
            return await options.retry(error);
          } catch (retryError) {
            logger.error(`Retry failed: ${operationName}`, {
              ...context,
              originalError: error.message,
              retryError: retryError.message
            });
            throw retryError;
          }
        }

        // 如果指定了默认值
        if (options.defaultValue !== undefined) {
          logger.warn(`Using default value for failed operation: ${operationName}`, {
            ...context,
            defaultValue: options.defaultValue
          });
          return options.defaultValue;
        }

        throw error;
      }
    };
  }

  /**
   * 标准化catch块处理
   */
  static handleError(error, context = {}, options = {}) {
    const errorInfo = {
      message: error.message,
      name: error.name,
      code: error.code,
      stack: options.includeStack ? error.stack : undefined,
      ...context
    };

    const level = options.level || 'error';
    logger[level](`Error handled: ${error.message}`, errorInfo);

    if (options.rethrow !== false) {
      throw error;
    }

    return options.defaultReturnValue;
  }

  /**
   * 创建资源清理包装器
   */
  static createResourceWrapper(resourceName, acquireFn, releaseFn) {
    return async (operation) => {
      let resource = null;

      try {
        logger.debug(`Acquiring resource: ${resourceName}`);
        resource = await acquireFn();

        logger.debug(`Resource acquired: ${resourceName}`);
        const result = await operation(resource);

        logger.debug(`Operation with resource completed: ${resourceName}`);
        return result;

      } finally {
        if (resource && releaseFn) {
          try {
            logger.debug(`Releasing resource: ${resourceName}`);
            await releaseFn(resource);
            logger.debug(`Resource released: ${resourceName}`);
          } catch (releaseError) {
            logger.error(`Failed to release resource: ${resourceName}`, {
              error: releaseError.message,
              resourceName
            });
          }
        }
      }
    };
  }

  /**
   * 批量操作错误处理
   */
  static async handleBatchOperation(operations, options = {}) {
    const results = {
      successful: [],
      failed: [],
      total: operations.length
    };

    const {
      continueOnError = false,
      maxConcurrency = 5,
      operationName = 'batch_operation'
    } = options;

    logger.info(`Starting batch operation: ${operationName}`, {
      total: operations.length,
      maxConcurrency
    });

    // 分批处理
    for (let i = 0; i < operations.length; i += maxConcurrency) {
      const batch = operations.slice(i, i + maxConcurrency);
      const batchPromises = batch.map(async (op, index) => {
        const operationIndex = i + index;

        try {
          const result = await this.createErrorHandler(
            `${operationName}_${operationIndex}`,
            { batchIndex: operationIndex }
          )(op);

          results.successful.push({
            index: operationIndex,
            result
          });

          return result;

        } catch (error) {
          results.failed.push({
            index: operationIndex,
            error: error.message
          });

          if (!continueOnError) {
            throw error;
          }
        }
      });

      await Promise.allSettled(batchPromises);
    }

    logger.info(`Batch operation completed: ${operationName}`, {
      successful: results.successful.length,
      failed: results.failed.length,
      total: results.total
    });

    return results;
  }

  /**
   * 超时包装器
   */
  static createTimeoutWrapper(timeoutMs, operationName = 'operation') {
    return async (operation) => {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`${operationName} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      });

      return Promise.race([operation(), timeoutPromise]);
    };
  }

  /**
   * 重试包装器
   */
  static createRetryWrapper(maxRetries = 3, delayMs = 1000, operationName = 'operation') {
    return async (operation) => {
      let lastError;

      for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        try {
          return await operation();

        } catch (error) {
          lastError = error;

          if (attempt <= maxRetries) {
            logger.warn(`Operation failed, retrying: ${operationName}`, {
              attempt,
              maxRetries,
              error: error.message,
              nextRetryIn: delayMs
            });

            await new Promise(resolve => setTimeout(resolve, delayMs));
            delayMs *= 2; // 指数退避
          }
        }
      }

      logger.error(`Operation failed after ${maxRetries + 1} attempts: ${operationName}`, {
        error: lastError.message
      });

      throw lastError;
    };
  }

  /**
   * 断路器包装器
   */
  static createCircuitBreakerWrapper(threshold = 5, timeoutMs = 60000, operationName = 'operation') {
    let failureCount = 0;
    let lastFailureTime = 0;
    let isOpen = false;

    return async (operation) => {
      if (isOpen) {
        const timeSinceLastFailure = Date.now() - lastFailureTime;
        if (timeSinceLastFailure < timeoutMs) {
          throw new Error(`Circuit breaker is open for ${operationName}`);
        } else {
          // 半开状态，允许一次尝试
          isOpen = false;
          logger.info(`Circuit breaker half-open for ${operationName}`);
        }
      }

      try {
        const result = await operation();
        failureCount = 0; // 重置失败计数
        return result;

      } catch (error) {
        failureCount++;
        lastFailureTime = Date.now();

        if (failureCount >= threshold) {
          isOpen = true;
          logger.warn(`Circuit breaker opened for ${operationName}`, {
            failureCount,
            threshold
          });
        }

        throw error;
      }
    };
  }

  /**
   * 创建条件错误处理器
   */
  static createConditionalHandler(conditions, operationName = 'operation') {
    return (error, context = {}) => {
      for (const condition of conditions) {
        if (condition.test(error)) {
          return condition.handler(error, context);
        }
      }

      // 默认处理
      return this.handleError(error, context);
    };
  }

  /**
   * 标准化错误转换
   */
  static normalizeError(error, mapping = {}) {
    const normalized = {
      message: error.message || 'Unknown error',
      code: error.code || error.name || 'UNKNOWN_ERROR',
      statusCode: error.statusCode || error.status || 500,
      details: error.details || {},
      originalError: error
    };

    // 应用映射
    for (const [key, value] of Object.entries(mapping)) {
      if (normalized[key]) {
        normalized[key] = typeof value === 'function' ? value(normalized[key]) : value;
      }
    }

    return normalized;
  }

  /**
   * 创建错误聚合器
   */
  static createErrorAggregator(operationName = 'aggregated_operation') {
    const errors = [];
    let hasErrors = false;

    return {
      add: (error, context = {}) => {
        hasErrors = true;
        errors.push({
          error: this.normalizeError(error),
          context,
          timestamp: new Date().toISOString()
        });
      },

      hasErrors: () => hasErrors,

      throwIfAny: (message = `Multiple errors occurred in ${operationName}`) => {
        if (hasErrors) {
          const aggregatedError = new Error(message);
          aggregatedError.details = errors;
          aggregatedError.code = 'AGGREGATED_ERRORS';
          throw aggregatedError;
        }
      },

      getErrors: () => errors,

      logAll: () => {
        if (hasErrors) {
          logger.error(`Aggregated errors in ${operationName}`, {
            errorCount: errors.length,
            errors: errors.map(e => ({
              message: e.error.message,
              code: e.error.code,
              context: e.context
            }))
          });
        }
      }
    };
  }
}

/**
 * 日志工具函数
 */
export const LoggingUtils = {
  /**
   * 创建结构化日志记录器
   */
  createStructuredLogger(componentName, defaultContext = {}) {
    return {
      debug: (message, context = {}) => logger.debug(`[${componentName}] ${message}`, { ...defaultContext, ...context }),
      info: (message, context = {}) => logger.info(`[${componentName}] ${message}`, { ...defaultContext, ...context }),
      warn: (message, context = {}) => logger.warn(`[${componentName}] ${message}`, { ...defaultContext, ...context }),
      error: (message, context = {}) => logger.error(`[${componentName}] ${message}`, { ...defaultContext, ...context }),

      // 性能日志
      performance: (operation, duration, context = {}) => {
        logger.info(`[${componentName}] Performance: ${operation}`, {
          ...defaultContext,
          ...context,
          operation,
          duration,
          performance: true
        });
      },

      // 错误日志
      operationError: (operation, error, context = {}) => {
        logger.error(`[${componentName}] Operation failed: ${operation}`, {
          ...defaultContext,
          ...context,
          operation,
          error: error.message,
          stack: error.stack
        });
      },

      // 生命周期日志
      lifecycle: (event, context = {}) => {
        logger.info(`[${componentName}] Lifecycle: ${event}`, {
          ...defaultContext,
          ...context,
          lifecycle: true,
          event
        });
      }
    };
  },

  /**
   * 创建指标日志记录器
   */
  createMetricsLogger(componentName) {
    return {
      gauge: (name, value, context = {}) => {
        logger.info(`[${componentName}] Gauge: ${name}`, {
          metric: { type: 'gauge', name, value },
          ...context
        });
      },

      counter: (name, increment = 1, context = {}) => {
        logger.info(`[${componentName}] Counter: ${name}`, {
          metric: { type: 'counter', name, increment },
          ...context
        });
      },

      histogram: (name, value, context = {}) => {
        logger.info(`[${componentName}] Histogram: ${name}`, {
          metric: { type: 'histogram', name, value },
          ...context
        });
      },

      timing: (name, duration, context = {}) => {
        logger.info(`[${componentName}] Timing: ${name}`, {
          metric: { type: 'timing', name, duration },
          ...context
        });
      }
    };
  }
};
