/**
 * frys - 全局异常处理器
 * 捕获和处理应用程序中的未处理异常和未捕获的Promise拒绝
 */

import { logger } from '../../shared/utils/logger.js';
import { EventBus } from '../../shared/kernel/EventBus.js';

export class GlobalExceptionHandler {
  constructor(config = {}) {
    this.eventBus = config.eventBus || new EventBus();
    this.gracefulShutdown = config.gracefulShutdown || (() => process.exit(1));
    this.maxUnhandledRejections = config.maxUnhandledRejections || 10;
    this.unhandledRejectionCount = 0;
    this.isShuttingDown = false;

    // 绑定方法以保持正确的this上下文
    this.handleUncaughtException = this.handleUncaughtException.bind(this);
    this.handleUnhandledRejection = this.handleUnhandledRejection.bind(this);
    this.handleWarning = this.handleWarning.bind(this);
    this.handleSIGTERM = this.handleSIGTERM.bind(this);
    this.handleSIGINT = this.handleSIGINT.bind(this);
  }

  /**
   * 安装全局异常处理器
   */
  install() {
    // 处理未捕获的异常
    process.on('uncaughtException', this.handleUncaughtException);

    // 处理未处理的Promise拒绝
    process.on('unhandledRejection', this.handleUnhandledRejection);

    // 处理警告
    process.on('warning', this.handleWarning);

    // 处理终止信号
    process.on('SIGTERM', this.handleSIGTERM);
    process.on('SIGINT', this.handleSIGINT);

    // 处理进程退出
    process.on('exit', (code) => {
      logger.info('进程退出', {
        exitCode: code,
        isShuttingDown: this.isShuttingDown,
      });
    });

    // 处理未捕获的异常监控（如果可用）
    if (process.listenerCount('uncaughtExceptionMonitor') === 0) {
      process.on('uncaughtExceptionMonitor', (error, origin) => {
        logger.error('未捕获异常监控', {
          error: error.message,
          stack: error.stack,
          origin,
        });
      });
    }

    logger.info('全局异常处理器已安装');
  }

  /**
   * 卸载全局异常处理器
   */
  uninstall() {
    process.removeListener('uncaughtException', this.handleUncaughtException);
    process.removeListener('unhandledRejection', this.handleUnhandledRejection);
    process.removeListener('warning', this.handleWarning);
    process.removeListener('SIGTERM', this.handleSIGTERM);
    process.removeListener('SIGINT', this.handleSIGINT);

    logger.info('全局异常处理器已卸载');
  }

  /**
   * 处理未捕获的异常
   */
  handleUncaughtException(error) {
    logger.error('未捕获的异常', {
      error: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
      errno: error.errno,
      syscall: error.syscall,
    });

    // 发布异常事件
    this.eventBus.publish('uncaughtException', {
      error,
      timestamp: Date.now(),
      type: 'uncaughtException',
    });

    // 对于严重的未捕获异常，立即关闭应用
    this.performEmergencyShutdown('uncaughtException', error);
  }

  /**
   * 处理未处理的Promise拒绝
   */
  handleUnhandledRejection(reason, promise) {
    this.unhandledRejectionCount++;

    const errorInfo = {
      reason: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
      promise: promise.toString(),
      count: this.unhandledRejectionCount,
    };

    logger.error('未处理的Promise拒绝', errorInfo);

    // 发布拒绝事件
    this.eventBus.publish('unhandledRejection', {
      reason,
      promise,
      count: this.unhandledRejectionCount,
      timestamp: Date.now(),
      type: 'unhandledRejection',
    });

    // 如果未处理拒绝次数过多，执行紧急关闭
    if (this.unhandledRejectionCount >= this.maxUnhandledRejections) {
      logger.error('未处理拒绝次数过多，执行紧急关闭', {
        count: this.unhandledRejectionCount,
        maxAllowed: this.maxUnhandledRejections,
      });
      this.performEmergencyShutdown('tooManyUnhandledRejections', reason);
    }
  }

  /**
   * 处理警告
   */
  handleWarning(warning) {
    // 过滤一些常见的非关键警告
    const ignoredWarnings = [
      'MaxListenersExceededWarning',
      'DeprecationWarning',
    ];

    if (ignoredWarnings.some((type) => warning.name.includes(type))) {
      return;
    }

    logger.warn('进程警告', {
      name: warning.name,
      message: warning.message,
      stack: warning.stack,
      code: warning.code,
    });

    // 发布警告事件
    this.eventBus.publish('processWarning', {
      warning,
      timestamp: Date.now(),
      type: 'processWarning',
    });
  }

  /**
   * 处理SIGTERM信号
   */
  handleSIGTERM() {
    logger.info('收到SIGTERM信号，开始优雅关闭');
    this.performGracefulShutdown('SIGTERM');
  }

  /**
   * 处理SIGINT信号 (Ctrl+C)
   */
  handleSIGINT() {
    logger.info('收到SIGINT信号，开始优雅关闭');
    this.performGracefulShutdown('SIGINT');
  }

  /**
   * 执行优雅关闭
   */
  async performGracefulShutdown(signal) {
    if (this.isShuttingDown) {
      logger.warn('关闭已在进行中，忽略重复信号', { signal });
      return;
    }

    this.isShuttingDown = true;

    try {
      logger.info('开始优雅关闭流程', { signal });

      // 发布关闭事件
      this.eventBus.publish('gracefulShutdown', {
        signal,
        timestamp: Date.now(),
        type: 'gracefulShutdown',
      });

      // 等待一段时间让正在处理的请求完成
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // 调用配置的优雅关闭函数
      await this.gracefulShutdown(signal);
    } catch (error) {
      logger.error('优雅关闭过程中发生错误', error);
      // 即使优雅关闭失败，也要退出进程
      process.exit(1);
    }
  }

  /**
   * 执行紧急关闭
   */
  performEmergencyShutdown(reason, error) {
    logger.error('执行紧急关闭', {
      reason,
      error: error instanceof Error ? error.message : String(error),
    });

    // 发布紧急关闭事件
    this.eventBus.publish('emergencyShutdown', {
      reason,
      error,
      timestamp: Date.now(),
      type: 'emergencyShutdown',
    });

    // 使用配置的退出函数
    this.gracefulShutdown(1);
  }

  /**
   * 获取处理器状态
   */
  getStatus() {
    return {
      isShuttingDown: this.isShuttingDown,
      unhandledRejectionCount: this.unhandledRejectionCount,
      maxUnhandledRejections: this.maxUnhandledRejections,
      listeners: {
        uncaughtException: process.listenerCount('uncaughtException'),
        unhandledRejection: process.listenerCount('unhandledRejection'),
        warning: process.listenerCount('warning'),
        SIGTERM: process.listenerCount('SIGTERM'),
        SIGINT: process.listenerCount('SIGINT'),
      },
    };
  }

  /**
   * 重置未处理拒绝计数器
   * 用于测试或手动重置
   */
  resetUnhandledRejectionCount() {
    this.unhandledRejectionCount = 0;
    logger.info('未处理拒绝计数器已重置');
  }

  /**
   * 手动触发优雅关闭
   * 用于测试或编程控制
   */
  async triggerGracefulShutdown(reason = 'manual') {
    logger.info('手动触发优雅关闭', { reason });
    await this.performGracefulShutdown(reason);
  }
}
