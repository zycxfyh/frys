/**
 * frys 统一错误处理工具
 * 为所有模块提供一致的错误处理和日志记录机制
 */

import frysError from './frysError.js';
import { logger } from '../utils/logger.js';

class ErrorHandler {
  constructor(options = {}) {
    this.options = {
      logErrors: true,
      throwErrors: true,
      collectStats: true,
      ...options,
    };
    this.stats = {
      totalErrors: 0,
      errorsByCode: new Map(),
      errorsByModule: new Map(),
      recentErrors: [],
    };
  }

  handle(error, context = {}) {
    const {
      module = 'Unknown',
      code = frysError.CODES.OPERATION_FAILED,
      message,
      rethrow = this.options.throwErrors,
    } = context;

    const wokeFlowError =
      error instanceof frysError
        ? error
        : new frysError(code, message || error.message, module, error);

    if (this.options.collectStats) {
      this.recordError(wokeFlowError);
    }

    if (this.options.logErrors) {
      this.logError(wokeFlowError, context);
    }

    if (rethrow) {
      throw wokeFlowError;
    }

    return wokeFlowError;
  }

  recordError(error) {
    this.stats.totalErrors++;
    const codeKey = error.code;
    const moduleKey = error.module;

    this.stats.errorsByCode.set(
      codeKey,
      (this.stats.errorsByCode.get(codeKey) || 0) + 1,
    );
    this.stats.errorsByModule.set(
      moduleKey,
      (this.stats.errorsByModule.get(moduleKey) || 0) + 1,
    );

    this.stats.recentErrors.unshift({
      timestamp: Date.now(),
      error: error.message,
      code: error.code,
      module: error.module,
    });

    if (this.stats.recentErrors.length > 100) {
      this.stats.recentErrors.pop();
    }
  }

  logError(error, context) {
    logger.error(`错误: ${error.module} - ${error.message}`, {
      module: error.module,
      operation: context.operation,
      timestamp: new Date().toISOString()
    });
  }

  getStats() {
    return {
      totalErrors: this.stats.totalErrors,
      errorsByCode: Object.fromEntries(this.stats.errorsByCode),
      errorsByModule: Object.fromEntries(this.stats.errorsByModule),
      recentErrorsCount: this.stats.recentErrors.length,
    };
  }
}

export const globalErrorHandler = new ErrorHandler();
export default ErrorHandler;
