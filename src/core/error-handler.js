/**
 * Frys 错误处理系统
 * 统一的错误创建和处理机制
 */

import { logger } from '../shared/utils/logger.js';

/**
 * 错误类型枚举
 */
export const ErrorTypes = {
  VALIDATION: 'VALIDATION_ERROR',
  SYSTEM: 'SYSTEM_ERROR',
  NOT_FOUND: 'NOT_FOUND_ERROR',
  CONFLICT: 'CONFLICT_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED_ERROR',
  FORBIDDEN: 'FORBIDDEN_ERROR',
  TIMEOUT: 'TIMEOUT_ERROR',
  NETWORK: 'NETWORK_ERROR',
};

/**
 * 错误类
 */
export class FrysError extends Error {
  constructor(type, message, code = null, details = {}) {
    super(message);
    this.name = 'FrysError';
    this.type = type;
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();

    // 记录错误
    logger.error('FrysError created', {
      type,
      code,
      message,
      details,
      stack: this.stack,
    });
  }
}

/**
 * 错误工厂函数
 */
export const frysError = {
  /**
   * 验证错误
   */
  validation(message, code = null, details = {}) {
    return new FrysError(ErrorTypes.VALIDATION, message, code, details);
  },

  /**
   * 系统错误
   */
  system(message, code = null, details = {}) {
    return new FrysError(ErrorTypes.SYSTEM, message, code, details);
  },

  /**
   * 未找到错误
   */
  notFound(message, code = null, details = {}) {
    return new FrysError(ErrorTypes.NOT_FOUND, message, code, details);
  },

  /**
   * 冲突错误
   */
  conflict(message, code = null, details = {}) {
    return new FrysError(ErrorTypes.CONFLICT, message, code, details);
  },

  /**
   * 未授权错误
   */
  unauthorized(message, code = null, details = {}) {
    return new FrysError(ErrorTypes.UNAUTHORIZED, message, code, details);
  },

  /**
   * 禁止访问错误
   */
  forbidden(message, code = null, details = {}) {
    return new FrysError(ErrorTypes.FORBIDDEN, message, code, details);
  },

  /**
   * 超时错误
   */
  timeout(message, code = null, details = {}) {
    return new FrysError(ErrorTypes.TIMEOUT, message, code, details);
  },

  /**
   * 网络错误
   */
  network(message, code = null, details = {}) {
    return new FrysError(ErrorTypes.NETWORK, message, code, details);
  },
};

/**
 * 通用错误处理器
 */
export class ErrorHandler {
  constructor(options = {}) {
    this.logErrors = options.logErrors !== false;
    this.throwOnError = options.throwOnError !== false;
    this.errorCallbacks = [];
  }

  /**
   * 处理错误
   */
  handle(error, context = {}) {
    // 记录错误
    if (this.logErrors) {
      logger.error('Error handled', {
        error: error.message,
        type: error.type || error.name,
        code: error.code,
        context,
        stack: error.stack,
      });
    }

    // 触发回调
    this.errorCallbacks.forEach((callback) => {
      try {
        callback(error, context);
      } catch (callbackError) {
        logger.error('Error callback failed', {
          callbackError: callbackError.message,
        });
      }
    });

    // 重新抛出错误
    if (this.throwOnError) {
      throw error;
    }

    return error;
  }

  /**
   * 包装异步函数
   */
  async wrap(fn, context = {}) {
    try {
      return await fn();
    } catch (error) {
      return this.handle(error, context);
    }
  }

  /**
   * 包装同步函数
   */
  wrapSync(fn, context = {}) {
    try {
      return fn();
    } catch (error) {
      return this.handle(error, context);
    }
  }

  /**
   * 添加错误回调
   */
  onError(callback) {
    this.errorCallbacks.push(callback);
    return () => {
      const index = this.errorCallbacks.indexOf(callback);
      if (index > -1) {
        this.errorCallbacks.splice(index, 1);
      }
    };
  }
}

/**
 * 默认错误处理器实例
 */
export const errorHandler = new ErrorHandler();
