/**
 * frys - 异常恢复策略
 * 提供各种异常恢复机制和自动修复策略
 */

import { logger } from '../../utils/logger.js';
import { EventBus } from '../../shared/kernel/EventBus.js';

export class ExceptionRecoveryStrategies {
  constructor(config = {}) {
    this.eventBus = config.eventBus || new EventBus();
    this.strategies = new Map();
    this.recoveryHistory = [];
    this.maxHistorySize = config.maxHistorySize || 1000;
    this.recoveryTimeout = config.recoveryTimeout || 30000; // 30秒超时
  }

  /**
   * 注册恢复策略
   * @param {string} exceptionType - 异常类型
   * @param {object} strategy - 恢复策略配置
   */
  registerStrategy(exceptionType, strategy) {
    this.strategies.set(exceptionType, {
      exceptionType,
      name: strategy.name || `${exceptionType}_recovery`,
      condition: strategy.condition || (() => true),
      recovery: strategy.recovery,
      priority: strategy.priority || 100,
      maxRetries: strategy.maxRetries || 3,
      backoffMs: strategy.backoffMs || 1000,
      timeout: strategy.timeout || this.recoveryTimeout,
      enabled: strategy.enabled !== false,
    });

    logger.debug('恢复策略已注册', { exceptionType, name: strategy.name });
  }

  /**
   * 执行异常恢复
   * @param {Error} exception - 异常对象
   * @param {object} context - 恢复上下文
   */
  async recover(exception, context = {}) {
    const exceptionType = this.classifyException(exception);
    const strategy = this.strategies.get(exceptionType);

    if (!strategy || !strategy.enabled) {
      logger.warn('没有找到适用的恢复策略', {
        exceptionType,
        exception: exception.message,
      });
      throw exception; // 重新抛出异常
    }

    // 检查恢复条件
    if (!strategy.condition(exception, context)) {
      logger.info('恢复条件不满足，跳过恢复', { exceptionType });
      throw exception;
    }

    const recoveryAttempt = {
      id: `recovery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      exceptionType,
      exception: exception.message,
      strategy: strategy.name,
      context,
      attempts: [],
      startTime: Date.now(),
      status: 'in_progress',
    };

    this.recoveryHistory.push(recoveryAttempt);

    try {
      logger.info('开始异常恢复', { exceptionType, strategy: strategy.name });

      // 执行恢复策略
      const result = await this.executeRecoveryStrategy(
        strategy,
        exception,
        context,
        recoveryAttempt,
      );

      recoveryAttempt.status = 'success';
      recoveryAttempt.endTime = Date.now();
      recoveryAttempt.duration =
        recoveryAttempt.endTime - recoveryAttempt.startTime;

      // 发布恢复成功事件
      this.eventBus.publish('recoverySuccess', {
        recoveryId: recoveryAttempt.id,
        exceptionType,
        strategy: strategy.name,
        duration: recoveryAttempt.duration,
        attempts: recoveryAttempt.attempts.length,
      });

      logger.info('异常恢复成功', {
        exceptionType,
        strategy: strategy.name,
        attempts: recoveryAttempt.attempts.length,
        duration: recoveryAttempt.duration,
      });

      return result;
    } catch (recoveryError) {
      recoveryAttempt.status = 'failed';
      recoveryAttempt.endTime = Date.now();
      recoveryAttempt.duration =
        recoveryAttempt.endTime - recoveryAttempt.startTime;
      recoveryAttempt.error = recoveryError.message;

      // 发布恢复失败事件
      this.eventBus.publish('recoveryFailed', {
        recoveryId: recoveryAttempt.id,
        exceptionType,
        strategy: strategy.name,
        attempts: recoveryAttempt.attempts.length,
        error: recoveryError.message,
      });

      logger.error('异常恢复失败', {
        exceptionType,
        strategy: strategy.name,
        attempts: recoveryAttempt.attempts.length,
        error: recoveryError.message,
      });

      throw recoveryError;
    } finally {
      // 限制历史记录大小
      if (this.recoveryHistory.length > this.maxHistorySize) {
        this.recoveryHistory = this.recoveryHistory.slice(-this.maxHistorySize);
      }
    }
  }

  /**
   * 执行恢复策略（带重试）
   */
  async executeRecoveryStrategy(strategy, exception, context, recoveryAttempt) {
    let lastError = exception;

    for (let attempt = 1; attempt <= strategy.maxRetries; attempt++) {
      const attemptStartTime = Date.now();

      try {
        logger.debug(`执行恢复尝试 ${attempt}/${strategy.maxRetries}`, {
          exceptionType: strategy.exceptionType,
          strategy: strategy.name,
        });

        // 创建带超时的恢复Promise
        const recoveryPromise = strategy.recovery(exception, context);
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('恢复超时')), strategy.timeout);
        });

        const result = await Promise.race([recoveryPromise, timeoutPromise]);

        // 记录成功尝试
        recoveryAttempt.attempts.push({
          attempt,
          status: 'success',
          duration: Date.now() - attemptStartTime,
        });

        return result;
      } catch (error) {
        lastError = error;
        const duration = Date.now() - attemptStartTime;

        // 记录失败尝试
        recoveryAttempt.attempts.push({
          attempt,
          status: 'failed',
          error: error.message,
          duration,
        });

        logger.warn(`恢复尝试 ${attempt} 失败`, {
          exceptionType: strategy.exceptionType,
          strategy: strategy.name,
          error: error.message,
          duration,
        });

        // 如果不是最后一次尝试，等待退避时间
        if (attempt < strategy.maxRetries) {
          const backoffTime = strategy.backoffMs * Math.pow(2, attempt - 1); // 指数退避
          await new Promise((resolve) => setTimeout(resolve, backoffTime));
        }
      }
    }

    throw lastError;
  }

  /**
   * 分类异常类型
   * @param {Error} exception - 异常对象
   */
  classifyException(exception) {
    // 基于异常类型和消息进行分类
    if (exception.code) {
      // 网络相关异常
      if (exception.code === 'ECONNREFUSED') return 'connection_refused';
      if (exception.code === 'ENOTFOUND') return 'dns_lookup_failed';
      if (exception.code === 'ETIMEDOUT') return 'connection_timeout';

      // 数据库相关异常
      if (exception.code.startsWith('42'))
        return 'database_constraint_violation';
      if (exception.code === '23505') return 'database_unique_violation';

      // 文件系统异常
      if (exception.code === 'ENOENT') return 'file_not_found';
      if (exception.code === 'EACCES') return 'permission_denied';
    }

    // 基于异常名称分类
    if (exception.name) {
      if (exception.name === 'ValidationError') return 'validation_error';
      if (exception.name === 'TimeoutError') return 'timeout_error';
      if (exception.name === 'TypeError') return 'type_error';
      if (exception.name === 'ReferenceError') return 'reference_error';
    }

    // 基于消息内容分类
    const message = exception.message.toLowerCase();
    if (message.includes('econnrefused')) return 'connection_refused';
    if (message.includes('enotfound')) return 'dns_lookup_failed';
    if (message.includes('etimedout')) return 'connection_timeout';
    if (message.includes('connection')) return 'connection_error';
    if (message.includes('timeout')) return 'timeout_error';
    if (message.includes('memory')) return 'memory_error';
    if (message.includes('disk')) return 'disk_error';

    // 默认分类
    return 'generic_error';
  }

  /**
   * 初始化预定义恢复策略
   */
  initializePresetStrategies() {
    // 连接拒绝恢复策略
    this.registerStrategy('connection_refused', {
      name: 'connection_retry',
      condition: (error, context) => context.retryable !== false,
      recovery: async (error, context) => {
        // 简单的重连逻辑
        if (context.reconnect) {
          return await context.reconnect();
        }
        throw new Error('无法重新连接');
      },
      maxRetries: 5,
      backoffMs: 2000,
      priority: 10,
    });

    // DNS查找失败恢复策略
    this.registerStrategy('dns_lookup_failed', {
      name: 'dns_fallback',
      condition: (error, context) =>
        context.fallbackHosts && context.fallbackHosts.length > 0,
      recovery: async (error, context) => {
        // 尝试备用主机
        for (const host of context.fallbackHosts) {
          try {
            if (context.testConnection) {
              await context.testConnection(host);
              return host;
            }
          } catch (e) {
            continue;
          }
        }
        throw new Error('所有备用主机都不可用');
      },
      maxRetries: 3,
      backoffMs: 1000,
      priority: 20,
    });

    // 连接超时恢复策略
    this.registerStrategy('connection_timeout', {
      name: 'timeout_retry',
      condition: (error, context) => context.retryable !== false,
      recovery: async (error, context) => {
        // 增加超时时间重试
        if (context.retryWithLongerTimeout) {
          return await context.retryWithLongerTimeout();
        }
        throw error;
      },
      maxRetries: 3,
      backoffMs: 3000,
      priority: 15,
    });

    // 数据库约束违反恢复策略
    this.registerStrategy('database_constraint_violation', {
      name: 'constraint_retry',
      condition: (error, context) => context.canRetry !== false,
      recovery: async (error, context) => {
        // 对于某些约束违反，可以重试（比如乐观锁）
        if (context.retryOperation) {
          return await context.retryOperation();
        }
        throw error; // 其他约束违反不应该重试
      },
      maxRetries: 2,
      backoffMs: 500,
      priority: 30,
    });

    // 文件未找到恢复策略
    this.registerStrategy('file_not_found', {
      name: 'file_fallback',
      condition: (error, context) => context.fallbackPath,
      recovery: async (error, context) => {
        // 尝试备用文件路径
        if (context.tryFallbackPath) {
          return await context.tryFallbackPath(context.fallbackPath);
        }
        throw error;
      },
      maxRetries: 1,
      backoffMs: 0,
      priority: 25,
    });

    // 内存错误恢复策略
    this.registerStrategy('memory_error', {
      name: 'memory_cleanup',
      condition: (error, context) => true,
      recovery: async (error, context) => {
        // 强制垃圾回收（如果可用）
        if (global.gc) {
          global.gc();
          logger.info('已执行垃圾回收');
          return true;
        }
        throw error;
      },
      maxRetries: 1,
      backoffMs: 0,
      priority: 5,
    });

    // 验证错误恢复策略
    this.registerStrategy('validation_error', {
      name: 'validation_fix',
      condition: (error, context) => context.fixValidation,
      recovery: async (error, context) => {
        // 尝试修复验证数据
        return await context.fixValidation(error);
      },
      maxRetries: 1,
      backoffMs: 0,
      priority: 40,
    });

    logger.info('预定义恢复策略已初始化');
  }

  /**
   * 获取恢复历史
   * @param {object} filters - 过滤条件
   */
  getRecoveryHistory(filters = {}) {
    let history = [...this.recoveryHistory];

    // 应用过滤器
    if (filters.exceptionType) {
      history = history.filter(
        (h) => h.exceptionType === filters.exceptionType,
      );
    }

    if (filters.status) {
      history = history.filter((h) => h.status === filters.status);
    }

    if (filters.strategy) {
      history = history.filter((h) => h.strategy === filters.strategy);
    }

    if (filters.since) {
      history = history.filter((h) => h.startTime >= filters.since);
    }

    if (filters.limit) {
      history = history.slice(-filters.limit);
    }

    return history;
  }

  /**
   * 获取恢复统计信息
   */
  getRecoveryStats() {
    const stats = {
      total: this.recoveryHistory.length,
      successful: 0,
      failed: 0,
      byType: {},
      byStrategy: {},
      averageDuration: 0,
      totalDuration: 0,
    };

    for (const record of this.recoveryHistory) {
      if (record.status === 'success') {
        stats.successful++;
      } else if (record.status === 'failed') {
        stats.failed++;
      }

      // 按类型统计
      if (!stats.byType[record.exceptionType]) {
        stats.byType[record.exceptionType] = {
          total: 0,
          successful: 0,
          failed: 0,
        };
      }
      stats.byType[record.exceptionType].total++;
      if (record.status === 'success') {
        stats.byType[record.exceptionType].successful++;
      } else if (record.status === 'failed') {
        stats.byType[record.exceptionType].failed++;
      }

      // 按策略统计
      if (!stats.byStrategy[record.strategy]) {
        stats.byStrategy[record.strategy] = {
          total: 0,
          successful: 0,
          failed: 0,
        };
      }
      stats.byStrategy[record.strategy].total++;
      if (record.status === 'success') {
        stats.byStrategy[record.strategy].successful++;
      } else if (record.status === 'failed') {
        stats.byStrategy[record.strategy].failed++;
      }

      // 计算持续时间
      if (record.duration) {
        stats.totalDuration += record.duration;
      }
    }

    stats.averageDuration =
      stats.total > 0 ? stats.totalDuration / stats.total : 0;
    stats.successRate = stats.total > 0 ? stats.successful / stats.total : 0;

    return stats;
  }

  /**
   * 清除恢复历史
   */
  clearHistory() {
    this.recoveryHistory = [];
    logger.info('恢复历史已清除');
  }

  /**
   * 启用/禁用策略
   * @param {string} exceptionType - 异常类型
   * @param {boolean} enabled - 是否启用
   */
  setStrategyEnabled(exceptionType, enabled) {
    const strategy = this.strategies.get(exceptionType);
    if (strategy) {
      strategy.enabled = enabled;
      logger.info('恢复策略状态已更新', { exceptionType, enabled });
    }
  }

  /**
   * 获取所有策略
   */
  getAllStrategies() {
    return Array.from(this.strategies.values()).map((strategy) => ({
      exceptionType: strategy.exceptionType,
      name: strategy.name,
      priority: strategy.priority,
      maxRetries: strategy.maxRetries,
      enabled: strategy.enabled,
    }));
  }
}
