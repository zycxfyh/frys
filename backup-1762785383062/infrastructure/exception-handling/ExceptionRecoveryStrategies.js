/**
 * frys - 异常恢复策略
 * 提供各种异常恢复机制和自动修复策略
 */

import { EventBus } from '../../shared/kernel/EventBus.js';
import { logger } from '../../shared/utils/logger.js';

export class ExceptionRecoveryStrategies {
  constructor(config = {}) {
    this.eventBus = config.eventBus || new EventBus();
    this.strategies = new Map();
    this.recoveryHistory = [];
    this.maxHistorySize = config.maxHistorySize || 1000;
    this.recoveryTimeout = config.recoveryTimeout || 30000; // 30秒超时

    // 高级恢复算法参数
    this.learningEnabled = config.learningEnabled || true;
    this.adaptiveTimeouts = config.adaptiveTimeouts || true;
    this.strategyWeights = new Map(); // 策略成功率权重
    this.contextPatterns = new Map(); // 上下文模式识别
    this.recoveryMetrics = new Map(); // 恢复策略性能指标
    this.failurePatterns = new Map(); // 失败模式分析
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
    const contextFingerprint = this._generateContextFingerprint(context);

    // 记录失败模式用于学习
    this._recordFailurePattern(exception, context, contextFingerprint);

    // 选择最佳恢复策略
    const selectedStrategy = await this._selectOptimalStrategy(exceptionType, exception, context, contextFingerprint);

    if (!selectedStrategy) {
      logger.warn('没有找到适用的恢复策略', {
        exceptionType,
        contextFingerprint,
        exception: exception.message,
      });
      throw exception; // 重新抛出异常
    }

    // 自适应超时调整
    const adaptiveTimeout = this.adaptiveTimeouts
      ? this._calculateAdaptiveTimeout(selectedStrategy, exceptionType, contextFingerprint)
      : selectedStrategy.timeout;

    // 检查恢复条件
    if (!selectedStrategy.condition(exception, context)) {
      logger.info('恢复条件不满足，跳过恢复', { exceptionType, contextFingerprint });
      throw exception;
    }

    const recoveryAttempt = {
      id: `recovery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      exceptionType,
      exception: exception.message,
      strategy: selectedStrategy.name,
      context,
      contextFingerprint,
      attempts: [],
      startTime: Date.now(),
      status: 'in_progress',
      adaptiveTimeout,
    };

    this.recoveryHistory.push(recoveryAttempt);

    try {
      logger.info('开始异常恢复', { exceptionType, strategy: selectedStrategy.name, contextFingerprint });

      // 执行恢复策略
      const result = await this.executeRecoveryStrategy(
        selectedStrategy,
        exception,
        context,
        recoveryAttempt,
        adaptiveTimeout,
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
  async executeRecoveryStrategy(strategy, exception, context, recoveryAttempt, adaptiveTimeout = null) {
    let lastError = exception;

    for (let attempt = 1; attempt <= strategy.maxRetries; attempt++) {
      const attemptStartTime = Date.now();

      try {
        logger.debug(`执行恢复尝试 ${attempt}/${strategy.maxRetries}`, {
          exceptionType: strategy.exceptionType,
          strategy: strategy.name,
        });

        // 创建带超时的恢复Promise (使用自适应超时)
        const recoveryPromise = strategy.recovery(exception, context);
        const effectiveTimeout = adaptiveTimeout || strategy.timeout;
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('恢复超时')), effectiveTimeout);
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
          const backoffTime = strategy.backoffMs * 2 ** (attempt - 1); // 指数退避
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
          } catch (e) {}
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
      weight: this.strategyWeights.get(strategy.exceptionType) || 1.0,
    }));
  }

  // =============== 高级恢复算法实现 ===============

  /**
   * 选择最优恢复策略 - 基于机器学习和历史数据
   */
  async _selectOptimalStrategy(exceptionType, exception, context, contextFingerprint) {
    // 获取所有可用的策略
    const availableStrategies = this._getAvailableStrategies(exceptionType);

    if (availableStrategies.length === 0) {
      return null;
    }

    if (!this.learningEnabled || availableStrategies.length === 1) {
      return availableStrategies[0];
    }

    // 基于上下文模式选择策略
    const contextPattern = this.contextPatterns.get(contextFingerprint);
    if (contextPattern && contextPattern.bestStrategy) {
      const recommendedStrategy = availableStrategies.find(s => s.name === contextPattern.bestStrategy);
      if (recommendedStrategy) {
        logger.debug('基于上下文模式选择策略', {
          contextFingerprint,
          recommendedStrategy: recommendedStrategy.name,
          confidence: contextPattern.confidence
        });
        return recommendedStrategy;
      }
    }

    // 基于策略权重和性能指标选择
    const scoredStrategies = availableStrategies.map(strategy => {
      const weight = this.strategyWeights.get(strategy.exceptionType) || 1.0;
      const metrics = this.recoveryMetrics.get(strategy.name) || {
        successRate: 0.5,
        avgRecoveryTime: strategy.timeout,
        failureRate: 0.5
      };

      // 综合评分算法
      const score = this._calculateStrategyScore(strategy, metrics, weight, context);

      return { strategy, score, metrics };
    });

    scoredStrategies.sort((a, b) => b.score - a.score);

    const bestStrategy = scoredStrategies[0].strategy;
    logger.debug('选择最优恢复策略', {
      exceptionType,
      selectedStrategy: bestStrategy.name,
      score: scoredStrategies[0].score,
      alternatives: scoredStrategies.slice(1, 3).map(s => ({ name: s.strategy.name, score: s.score }))
    });

    return bestStrategy;
  }

  /**
   * 获取可用的恢复策略
   */
  _getAvailableStrategies(exceptionType) {
    const strategies = [];

    // 首先尝试精确匹配
    const exactStrategy = this.strategies.get(exceptionType);
    if (exactStrategy && exactStrategy.enabled) {
      strategies.push(exactStrategy);
    }

    // 然后尝试通用策略
    const generalStrategy = this.strategies.get('general');
    if (generalStrategy && generalStrategy.enabled) {
      strategies.push(generalStrategy);
    }

    return strategies;
  }

  /**
   * 计算策略评分
   */
  _calculateStrategyScore(strategy, metrics, weight, context) {
    // 基础评分因子
    const successRate = metrics.successRate;
    const efficiency = 1 / (1 + metrics.avgRecoveryTime / 1000); // 时间效率
    const reliability = 1 - metrics.failureRate;
    const contextRelevance = this._calculateContextRelevance(strategy, context);

    // 加权综合评分
    const score = (
      successRate * 0.4 +      // 成功率权重
      efficiency * 0.2 +       // 效率权重
      reliability * 0.2 +      // 可靠性权重
      weight * 0.1 +           // 历史权重
      contextRelevance * 0.1   // 上下文相关性
    );

    return Math.max(0, Math.min(1, score));
  }

  /**
   * 计算上下文相关性
   */
  _calculateContextRelevance(strategy, context) {
    // 基于上下文特征计算相关性
    let relevance = 0.5; // 基础相关性

    // 时间相关性（某些异常在特定时间更可能发生）
    const hour = new Date().getHours();
    if (strategy.name.includes('maintenance') && (hour >= 2 && hour <= 4)) {
      relevance += 0.2; // 维护时间相关性更高
    }

    // 负载相关性
    if (context.loadFactor && context.loadFactor > 0.8 && strategy.name.includes('throttle')) {
      relevance += 0.3; // 高负载时节流策略更相关
    }

    // 错误模式相关性
    if (context.errorPattern && strategy.name.toLowerCase().includes(context.errorPattern)) {
      relevance += 0.4; // 策略名称匹配错误模式
    }

    return Math.min(1.0, relevance);
  }

  /**
   * 生成上下文指纹
   */
  _generateContextFingerprint(context) {
    const keyFeatures = [
      context.serviceName,
      context.operation,
      context.loadFactor ? Math.floor(context.loadFactor * 10) : 'normal',
      context.errorPattern,
      new Date().getHours(), // 小时作为时间特征
    ].filter(Boolean);

    // 简单的哈希生成
    return keyFeatures.join('|');
  }

  /**
   * 记录失败模式
   */
  _recordFailurePattern(exception, context, contextFingerprint) {
    const pattern = this.failurePatterns.get(contextFingerprint) || {
      exceptionType: this.classifyException(exception),
      context: { ...context },
      occurrences: 0,
      lastSeen: null,
      strategiesTried: new Set(),
      successfulStrategies: new Set(),
    };

    pattern.occurrences++;
    pattern.lastSeen = Date.now();

    this.failurePatterns.set(contextFingerprint, pattern);
  }

  /**
   * 计算自适应超时
   */
  _calculateAdaptiveTimeout(strategy, exceptionType, contextFingerprint) {
    const metrics = this.recoveryMetrics.get(strategy.name);
    const contextPattern = this.contextPatterns.get(contextFingerprint);

    let baseTimeout = strategy.timeout;

    // 基于历史性能调整
    if (metrics && metrics.avgRecoveryTime) {
      const historicalAvg = metrics.avgRecoveryTime;
      // 如果历史平均时间比当前超时短，可以稍微减少超时
      if (historicalAvg < baseTimeout * 0.7) {
        baseTimeout = Math.max(baseTimeout * 0.8, historicalAvg * 1.5);
      }
      // 如果历史平均时间较长，需要增加超时
      else if (historicalAvg > baseTimeout * 1.3) {
        baseTimeout = Math.min(baseTimeout * 1.5, historicalAvg * 2);
      }
    }

    // 基于上下文调整
    if (contextPattern && contextPattern.avgRecoveryTime) {
      baseTimeout = (baseTimeout + contextPattern.avgRecoveryTime) / 2;
    }

    return Math.min(baseTimeout, this.recoveryTimeout); // 不超过全局最大超时
  }

  /**
   * 更新学习数据
   */
  updateLearningData(recoveryAttempt, success) {
    if (!this.learningEnabled) return;

    const { exceptionType, strategy, contextFingerprint, duration } = recoveryAttempt;

    // 更新策略权重
    const currentWeight = this.strategyWeights.get(exceptionType) || 1.0;
    const adjustment = success ? 0.05 : -0.02; // 成功增加权重，失败减少权重
    this.strategyWeights.set(exceptionType, Math.max(0.1, currentWeight + adjustment));

    // 更新策略性能指标
    const metrics = this.recoveryMetrics.get(strategy) || {
      totalAttempts: 0,
      successfulAttempts: 0,
      totalRecoveryTime: 0,
      avgRecoveryTime: 0,
      successRate: 0,
      failureRate: 0,
    };

    metrics.totalAttempts++;
    metrics.totalRecoveryTime += duration;
    metrics.avgRecoveryTime = metrics.totalRecoveryTime / metrics.totalAttempts;

    if (success) {
      metrics.successfulAttempts++;
    }

    metrics.successRate = metrics.successfulAttempts / metrics.totalAttempts;
    metrics.failureRate = 1 - metrics.successRate;

    this.recoveryMetrics.set(strategy, metrics);

    // 更新上下文模式
    this._updateContextPattern(contextFingerprint, strategy, success, duration);
  }

  /**
   * 更新上下文模式
   */
  _updateContextPattern(contextFingerprint, strategy, success, duration) {
    const pattern = this.contextPatterns.get(contextFingerprint) || {
      totalAttempts: 0,
      successfulAttempts: 0,
      totalRecoveryTime: 0,
      avgRecoveryTime: 0,
      bestStrategy: null,
      confidence: 0,
      lastUpdated: Date.now(),
    };

    pattern.totalAttempts++;
    pattern.totalRecoveryTime += duration;
    pattern.avgRecoveryTime = pattern.totalRecoveryTime / pattern.totalAttempts;
    pattern.lastUpdated = Date.now();

    if (success) {
      pattern.successfulAttempts++;

      // 更新最佳策略
      if (!pattern.bestStrategy || pattern.successfulAttempts > pattern.confidence * pattern.totalAttempts) {
        pattern.bestStrategy = strategy;
        pattern.confidence = pattern.successfulAttempts / pattern.totalAttempts;
      }
    }

    this.contextPatterns.set(contextFingerprint, pattern);
  }

  /**
   * 获取学习统计信息
   */
  getLearningStats() {
    return {
      strategyWeights: Object.fromEntries(this.strategyWeights),
      recoveryMetrics: Object.fromEntries(
        Array.from(this.recoveryMetrics.entries()).map(([name, metrics]) => [
          name,
          { ...metrics, successRate: metrics.successRate }
        ])
      ),
      contextPatternsCount: this.contextPatterns.size,
      failurePatternsCount: this.failurePatterns.size,
      learningEnabled: this.learningEnabled,
      adaptiveTimeouts: this.adaptiveTimeouts,
    };
  }
}
