/**
 * frys - 采样策略
 * 控制哪些请求应该被追踪以平衡性能和可观测性
 */

import { logger } from '../../shared/utils/logger.js';

export class SamplingStrategy {
  constructor(config = {}) {
    this.type = config.type || 'probability'; // probability, rate_limiting, adaptive, rules_based, ml_based, hybrid
    this.samplingRate = config.samplingRate || 0.1; // 10% 采样率
    this.maxSamplesPerSecond = config.maxSamplesPerSecond || 100;
    this.rules = config.rules || [];
    this.adaptiveConfig = config.adaptive || {
      enabled: false,
      targetLatency: 100, // 目标延迟(ms)
      adjustmentInterval: 60000, // 调整间隔(ms)
    };

    // 高级采样算法配置
    this.advancedConfig = {
      prioritySampling: config.prioritySampling !== false,
      contextualSampling: config.contextualSampling !== false,
      temporalSampling: config.temporalSampling !== false,
      anomalyBasedSampling: config.anomalyBasedSampling !== false,
      costBasedSampling: config.costBasedSampling !== false,
      machineLearningSampling: config.machineLearningSampling !== false,
    };

    this.sampleCount = 0;
    this.timeWindowStart = Date.now();
    this.isRunning = false;

    // 自适应采样状态
    this.latencyHistory = [];
    this.currentSamplingRate = this.samplingRate;

    // 高级采样数据结构
    this.requestPatterns = new Map(); // 请求模式分析
    this.priorityScores = new Map(); // 优先级评分
    this.contextualData = new Map(); // 上下文数据
    this.temporalPatterns = new Map(); // 时间模式
    this.anomalyPatterns = new Map(); // 异常模式
    this.costMetrics = new Map(); // 成本指标
    this.mlModel = null; // 机器学习模型

    // 采样统计
    this.samplingStats = {
      totalRequests: 0,
      sampledRequests: 0,
      samplingEfficiency: 0,
      falsePositiveRate: 0,
      falseNegativeRate: 0,
      costSavings: 0,
    };

    // 动态调整参数
    this.dynamicParams = {
      burstDetectionEnabled: true,
      trendAnalysisEnabled: true,
      seasonalAdjustmentEnabled: true,
      feedbackLoopEnabled: true,
    };
  }

  /**
   * 启动采样策略
   */
  async start() {
    if (this.isRunning) return;
    this.isRunning = true;

    if (this.adaptiveConfig.enabled) {
      // 启动自适应调整定时器
      this.adjustmentTimer = setInterval(() => {
        this._adjustSamplingRate();
      }, this.adaptiveConfig.adjustmentInterval);
    }

    logger.info('启动采样策略', {
      type: this.type,
      samplingRate: this.samplingRate,
      adaptive: this.adaptiveConfig.enabled,
    });
  }

  /**
   * 停止采样策略
   */
  async stop() {
    if (!this.isRunning) return;
    this.isRunning = false;

    if (this.adjustmentTimer) {
      clearInterval(this.adjustmentTimer);
      this.adjustmentTimer = null;
    }

    logger.info('停止采样策略');
  }

  /**
   * 判断是否应该采样
   * @param {string} operationName - 操作名称
   * @param {object} options - 选项
   */
  shouldSample(operationName, options = {}) {
    const startTime = Date.now();

    // 更新统计信息
    this.samplingStats.totalRequests++;

    // 分析请求上下文
    const context = this._analyzeRequestContext(operationName, options);

    let shouldSample = false;
    let samplingReason = 'default';

    // 根据配置的采样类型选择算法
    switch (this.type) {
      case 'probability':
        shouldSample = this._probabilitySampling(operationName, options);
        samplingReason = 'probability';
        break;
      case 'rate_limiting':
        shouldSample = this._rateLimitingSampling(operationName, options);
        samplingReason = 'rate_limiting';
        break;
      case 'adaptive':
        shouldSample = this._adaptiveSampling(operationName, options);
        samplingReason = 'adaptive';
        break;
      case 'rules_based':
        shouldSample = this._rulesBasedSampling(operationName, options);
        samplingReason = 'rules_based';
        break;
      case 'ml_based':
        shouldSample = this._mlBasedSampling(operationName, options, context);
        samplingReason = 'ml_based';
        break;
      case 'hybrid':
        shouldSample = this._hybridSampling(operationName, options, context);
        samplingReason = 'hybrid';
        break;
      default:
        shouldSample = this._probabilitySampling(operationName, options);
        samplingReason = 'probability';
    }

    // 应用高级采样策略
    if (shouldSample && this.advancedConfig.prioritySampling) {
      shouldSample = this._applyPrioritySampling(operationName, options, context);
      if (!shouldSample) samplingReason += '_priority_filtered';
    }

    if (shouldSample && this.advancedConfig.contextualSampling) {
      shouldSample = this._applyContextualSampling(operationName, options, context);
      if (!shouldSample) samplingReason += '_context_filtered';
    }

    if (shouldSample && this.advancedConfig.temporalSampling) {
      shouldSample = this._applyTemporalSampling(operationName, options, context);
      if (!shouldSample) samplingReason += '_temporal_filtered';
    }

    if (shouldSample && this.advancedConfig.anomalyBasedSampling) {
      shouldSample = this._applyAnomalyBasedSampling(operationName, options, context);
      if (!shouldSample) samplingReason += '_anomaly_filtered';
    }

    if (shouldSample && this.advancedConfig.costBasedSampling) {
      shouldSample = this._applyCostBasedSampling(operationName, options, context);
      if (!shouldSample) samplingReason += '_cost_filtered';
    }

    // 记录采样决策
    if (shouldSample) {
      this.samplingStats.sampledRequests++;
      this._recordSamplingDecision(operationName, options, context, samplingReason, Date.now() - startTime);
    }

    // 更新采样统计
    this._updateSamplingStats(shouldSample, context);

    return shouldSample;
  }

  /**
   * 概率采样
   */
  _probabilitySampling(operationName, options) {
    const rate = options.samplingRate || this.currentSamplingRate;
    return Math.random() < rate;
  }

  /**
   * 速率限制采样
   */
  _rateLimitingSampling(operationName, options) {
    const now = Date.now();

    // 检查是否需要重置时间窗口
    if (now - this.timeWindowStart >= 1000) {
      this.sampleCount = 0;
      this.timeWindowStart = now;
    }

    // 检查是否超过速率限制
    if (this.sampleCount >= this.maxSamplesPerSecond) {
      return false;
    }

    this.sampleCount++;
    return true;
  }

  /**
   * 自适应采样
   */
  _adaptiveSampling(operationName, options) {
    // 记录延迟（如果提供）
    if (options.latency !== undefined) {
      this.latencyHistory.push({
        timestamp: Date.now(),
        latency: options.latency,
        sampled: options.wasSampled || false,
      });

      // 保持最近1000个延迟记录
      if (this.latencyHistory.length > 1000) {
        this.latencyHistory = this.latencyHistory.slice(-1000);
      }
    }

    return Math.random() < this.currentSamplingRate;
  }

  /**
   * 基于规则的采样
   */
  _rulesBasedSampling(operationName, options) {
    // 检查每个规则
    for (const rule of this.rules) {
      if (this._matchesRule(rule, operationName, options)) {
        return rule.sample;
      }
    }

    // 默认使用概率采样
    return this._probabilitySampling(operationName, options);
  }

  /**
   * 检查规则是否匹配
   */
  _matchesRule(rule, operationName, options) {
    // 检查操作名称
    if (rule.operationPattern) {
      const pattern = new RegExp(rule.operationPattern);
      if (!pattern.test(operationName)) {
        return false;
      }
    }

    // 检查标签
    if (rule.tags) {
      for (const [key, value] of Object.entries(rule.tags)) {
        const spanTags = options.tags || {};
        if (spanTags[key] !== value) {
          return false;
        }
      }
    }

    // 检查延迟
    if (rule.maxLatency && options.latency > rule.maxLatency) {
      return false;
    }

    // 检查错误
    if (rule.onlyErrors && !options.hasError) {
      return false;
    }

    return true;
  }

  /**
   * 调整采样率（自适应采样）
   */
  _adjustSamplingRate() {
    if (!this.adaptiveConfig.enabled || this.latencyHistory.length < 10) {
      return;
    }

    // 计算最近的平均延迟
    const recentLatencies = this.latencyHistory.slice(-100);
    const avgLatency =
      recentLatencies.reduce((sum, item) => sum + item.latency, 0) /
      recentLatencies.length;

    const targetLatency = this.adaptiveConfig.targetLatency;

    // 根据延迟调整采样率
    let newRate = this.currentSamplingRate;

    if (avgLatency > targetLatency * 1.2) {
      // 延迟过高，降低采样率
      newRate = Math.max(0.01, this.currentSamplingRate * 0.8);
    } else if (avgLatency < targetLatency * 0.8) {
      // 延迟正常，可以适当提高采样率
      newRate = Math.min(1.0, this.currentSamplingRate * 1.1);
    }

    if (newRate !== this.currentSamplingRate) {
      logger.info('调整采样率', {
        oldRate: this.currentSamplingRate,
        newRate,
        avgLatency,
        targetLatency,
      });
      this.currentSamplingRate = newRate;
    }
  }

  /**
   * 设置采样率
   * @param {number} rate - 采样率 (0-1)
   */
  setSamplingRate(rate) {
    this.samplingRate = Math.max(0, Math.min(1, rate));
    this.currentSamplingRate = this.samplingRate;
    logger.info('设置采样率', { rate: this.samplingRate });
  }

  /**
   * 添加采样规则
   * @param {object} rule - 规则配置
   */
  addRule(rule) {
    this.rules.push(rule);
    logger.info('添加采样规则', rule);
  }

  /**
   * 移除采样规则
   * @param {number} index - 规则索引
   */
  removeRule(index) {
    if (index >= 0 && index < this.rules.length) {
      const removed = this.rules.splice(index, 1);
      logger.info('移除采样规则', removed[0]);
    }
  }

  /**
   * 获取采样统计信息
   */
  getStats() {
    const recentLatencies = this.latencyHistory.slice(-100);
    const avgLatency =
      recentLatencies.length > 0
        ? recentLatencies.reduce((sum, item) => sum + item.latency, 0) /
          recentLatencies.length
        : 0;

    return {
      type: this.type,
      samplingRate: this.currentSamplingRate,
      originalSamplingRate: this.samplingRate,
      sampleCount: this.sampleCount,
      timeWindowStart: this.timeWindowStart,
      latencyHistorySize: this.latencyHistory.length,
      averageLatency: avgLatency,
      rulesCount: this.rules.length,
      adaptive: {
        enabled: this.adaptiveConfig.enabled,
        targetLatency: this.adaptiveConfig.targetLatency,
      },
    };
  }

  /**
   * 重置统计信息
   */
  resetStats() {
    this.sampleCount = 0;
    this.timeWindowStart = Date.now();
    this.latencyHistory = [];
    logger.info('重置采样统计信息');
  }
}

/**
 * 预定义采样策略
 */

// 总是采样（用于开发环境）
export class AlwaysOnSampling extends SamplingStrategy {
  constructor() {
    super({ type: 'probability', samplingRate: 1.0 });
  }

  shouldSample() {
    return true;
  }
}

// 从不采样（用于生产环境高性能场景）
export class AlwaysOffSampling extends SamplingStrategy {
  constructor() {
    super({ type: 'probability', samplingRate: 0.0 });
  }

  shouldSample() {
    return false;
  }
}

// 基于HTTP状态码的采样
export class HttpStatusSampling extends SamplingStrategy {
  constructor(config = {}) {
    super({
      type: 'rules_based',
      rules: [
        // 对错误请求总是采样
        {
          operationPattern: 'http.*',
          tags: { 'http.status_code': /5\d\d/ },
          sample: true,
        },
        {
          operationPattern: 'http.*',
          tags: { 'http.status_code': /4\d\d/ },
          sample: true,
        },
        // 对正常请求按概率采样
        { operationPattern: 'http.*', sample: config.samplingRate || 0.1 },
      ],
    });
  }
}

// 基于延迟的采样
export class LatencyBasedSampling extends SamplingStrategy {
  constructor(config = {}) {
    super({
      type: 'rules_based',
      rules: [
        // 对高延迟请求总是采样
        {
          operationPattern: '.*',
          maxLatency: config.highLatencyThreshold || 1000,
          sample: true,
        },
        // 对正常请求按概率采样
        { operationPattern: '.*', sample: config.samplingRate || 0.1 },
      ],
    });
  }
}

// 基于错误率的采样
export class ErrorRateSampling extends SamplingStrategy {
  constructor(config = {}) {
    super({
      type: 'adaptive',
      samplingRate: config.samplingRate || 0.1,
      adaptive: {
        enabled: true,
        targetLatency: config.targetLatency || 200,
      },
    });

    this.errorThreshold = config.errorThreshold || 0.05; // 5% 错误率阈值
    this.errorWindowSize = config.errorWindowSize || 100; // 检查最近100个请求
    this.requestHistory = [];
  }

  shouldSample(operationName, options) {
    // 记录请求结果
    if (options.hasError !== undefined) {
      this.requestHistory.push({
        timestamp: Date.now(),
        hasError: options.hasError,
        sampled: options.wasSampled || false,
      });

      // 保持窗口大小
      if (this.requestHistory.length > this.errorWindowSize) {
        this.requestHistory = this.requestHistory.slice(-this.errorWindowSize);
      }

      // 计算错误率
      const errorCount = this.requestHistory.filter((r) => r.hasError).length;
      const errorRate = errorCount / this.requestHistory.length;

      // 如果错误率过高，增加采样率
      if (errorRate > this.errorThreshold) {
        this.currentSamplingRate = Math.min(1.0, this.samplingRate * 2);
      } else {
        this.currentSamplingRate = this.samplingRate;
      }
    }

    return super.shouldSample(operationName, options);
  }

  // =============== 高级采样算法实现 ===============

  /**
   * 分析请求上下文
   */
  _analyzeRequestContext(operationName, options) {
    const context = {
      operationName,
      timestamp: Date.now(),
      tags: options.tags || {},
      priority: this._calculateRequestPriority(operationName, options),
      complexity: this._calculateRequestComplexity(operationName, options),
      cost: this._estimateRequestCost(operationName, options),
      userContext: options.userContext || {},
      systemContext: this._getSystemContext(),
      temporalFeatures: this._extractTemporalFeatures(),
      anomalyScore: this._calculateAnomalyScore(operationName, options),
    };

    // 记录上下文数据用于后续分析
    this._updateContextualData(operationName, context);

    return context;
  }

  /**
   * 基于机器学习的采样决策
   */
  _mlBasedSampling(operationName, options, context) {
    if (!this.mlModel) {
      // 如果没有ML模型，回退到概率采样
      return this._probabilitySampling(operationName, options);
    }

    // 提取特征向量
    const features = this._extractSamplingFeatures(context);

    // 使用模型预测
    const prediction = this.mlModel.predict(features);

    return prediction.shouldSample;
  }

  /**
   * 混合采样策略
   */
  _hybridSampling(operationName, options, context) {
    // 结合多种策略进行决策
    const strategies = [
      { method: '_probabilitySampling', weight: 0.2 },
      { method: '_rulesBasedSampling', weight: 0.3 },
      { method: '_adaptiveSampling', weight: 0.3 },
      { method: '_prioritySampling', weight: 0.2 },
    ];

    let totalScore = 0;
    let totalWeight = 0;

    for (const strategy of strategies) {
      try {
        const result = this[strategy.method](operationName, options);
        totalScore += (result ? 1 : 0) * strategy.weight;
        totalWeight += strategy.weight;
      } catch (error) {
        logger.warn(`混合采样策略 ${strategy.method} 失败`, error);
      }
    }

    const finalScore = totalWeight > 0 ? totalScore / totalWeight : 0;
    return finalScore > 0.5;
  }

  /**
   * 应用优先级采样
   */
  _applyPrioritySampling(operationName, options, context) {
    const priorityThreshold = this._calculatePriorityThreshold();
    return context.priority >= priorityThreshold;
  }

  /**
   * 应用上下文采样
   */
  _applyContextualSampling(operationName, options, context) {
    // 基于上下文信息进行采样决策
    const contextualScore = this._calculateContextualScore(context);

    // 如果上下文得分足够高，强制采样
    if (contextualScore > 0.8) return true;

    // 如果上下文得分很低，可能降低采样概率
    if (contextualScore < 0.2) {
      return Math.random() < this.currentSamplingRate * 0.5;
    }

    return Math.random() < this.currentSamplingRate;
  }

  /**
   * 应用时间采样
   */
  _applyTemporalSampling(operationName, options, context) {
    const temporalPattern = this.temporalPatterns.get(operationName);
    if (!temporalPattern) return true;

    const hourOfDay = new Date().getHours();
    const dayOfWeek = new Date().getDay();

    // 检查是否在高峰期
    const isPeakHour = temporalPattern.peakHours?.includes(hourOfDay);
    const isPeakDay = temporalPattern.peakDays?.includes(dayOfWeek);

    if (isPeakHour || isPeakDay) {
      // 高峰期增加采样率
      return Math.random() < Math.min(1.0, this.currentSamplingRate * 1.5);
    }

    return Math.random() < this.currentSamplingRate;
  }

  /**
   * 应用基于异常的采样
   */
  _applyAnomalyBasedSampling(operationName, options, context) {
    // 如果检测到异常，增加采样率
    if (context.anomalyScore > 0.7) {
      return Math.random() < Math.min(1.0, this.currentSamplingRate * 2.0);
    }

    // 如果是正常请求，使用标准采样率
    return Math.random() < this.currentSamplingRate;
  }

  /**
   * 应用基于成本的采样
   */
  _applyCostBasedSampling(operationName, options, context) {
    const costEfficiency = this._calculateCostEfficiency(context);

    // 如果成本效益高，保持采样
    if (costEfficiency > 0.8) return true;

    // 如果成本效益低，降低采样率
    if (costEfficiency < 0.3) {
      return Math.random() < this.currentSamplingRate * 0.3;
    }

    return Math.random() < this.currentSamplingRate;
  }

  /**
   * 计算请求优先级
   */
  _calculateRequestPriority(operationName, options) {
    let priority = 0.5; // 默认中等优先级

    // 基于操作名称
    if (operationName.includes('error') || operationName.includes('exception')) {
      priority += 0.4;
    } else if (operationName.includes('auth') || operationName.includes('login')) {
      priority += 0.3;
    }

    // 基于标签
    const tags = options.tags || {};
    if (tags.error === true || tags.http_status_code >= 400) {
      priority += 0.3;
    }
    if (tags.user_type === 'premium' || tags.user_type === 'admin') {
      priority += 0.2;
    }

    // 基于持续时间
    if (options.duration && options.duration > 1000) {
      priority += 0.2;
    }

    return Math.min(1.0, priority);
  }

  /**
   * 计算请求复杂度
   */
  _calculateRequestComplexity(operationName, options) {
    let complexity = 0;

    // 基于操作类型
    if (operationName.includes('search') || operationName.includes('query')) {
      complexity += 0.3;
    } else if (operationName.includes('batch') || operationName.includes('bulk')) {
      complexity += 0.4;
    }

    // 基于参数数量
    const paramCount = options.parameterCount || Object.keys(options.tags || {}).length;
    complexity += Math.min(0.3, paramCount * 0.05);

    // 基于嵌套调用
    if (options.childSpans && options.childSpans.length > 5) {
      complexity += 0.2;
    }

    return Math.min(1.0, complexity);
  }

  /**
   * 估算请求成本
   */
  _estimateRequestCost(operationName, options) {
    // 简化的成本估算
    let cost = 1.0; // 基础成本

    // CPU成本
    if (options.duration) {
      cost += options.duration * 0.001;
    }

    // 内存成本
    if (options.memoryUsage) {
      cost += options.memoryUsage * 0.0001;
    }

    // 网络成本
    if (options.networkCalls) {
      cost += options.networkCalls * 0.1;
    }

    return cost;
  }

  /**
   * 获取系统上下文
   */
  _getSystemContext() {
    return {
      timestamp: Date.now(),
      loadAverage: process.loadavg ? process.loadavg()[0] : 0,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
    };
  }

  /**
   * 提取时间特征
   */
  _extractTemporalFeatures() {
    const now = new Date();
    return {
      hourOfDay: now.getHours(),
      dayOfWeek: now.getDay(),
      dayOfMonth: now.getDate(),
      month: now.getMonth(),
      isWeekend: now.getDay() === 0 || now.getDay() === 6,
      isBusinessHours: now.getHours() >= 9 && now.getHours() <= 17,
    };
  }

  /**
   * 计算异常得分
   */
  _calculateAnomalyScore(operationName, options) {
    // 简化的异常检测
    let score = 0;

    if (options.duration && options.duration > 5000) score += 0.3;
    if (options.errorCount && options.errorCount > 0) score += 0.4;
    if (options.memoryUsage && options.memoryUsage > 100 * 1024 * 1024) score += 0.3;

    return Math.min(1.0, score);
  }

  /**
   * 更新上下文数据
   */
  _updateContextualData(operationName, context) {
    const key = operationName;
    const existing = this.contextualData.get(key) || [];

    existing.push({
      timestamp: context.timestamp,
      priority: context.priority,
      complexity: context.complexity,
      cost: context.cost,
      anomalyScore: context.anomalyScore,
    });

    // 保持最近1000个记录
    if (existing.length > 1000) {
      existing.splice(0, existing.length - 500);
    }

    this.contextualData.set(key, existing);
  }

  /**
   * 提取采样特征
   */
  _extractSamplingFeatures(context) {
    return [
      context.priority,
      context.complexity,
      context.cost,
      context.anomalyScore,
      context.temporalFeatures.hourOfDay / 24,
      context.temporalFeatures.dayOfWeek / 7,
      context.temporalFeatures.isWeekend ? 1 : 0,
      context.temporalFeatures.isBusinessHours ? 1 : 0,
      context.systemContext.loadAverage / 10,
      context.systemContext.memoryUsage.heapUsed / context.systemContext.memoryUsage.heapTotal,
    ];
  }

  /**
   * 计算优先级阈值
   */
  _calculatePriorityThreshold() {
    // 基于当前采样率动态调整阈值
    const targetSampleCount = this.samplingStats.totalRequests * this.currentSamplingRate;
    const currentSampleCount = this.samplingStats.sampledRequests;

    if (currentSampleCount < targetSampleCount * 0.8) {
      return 0.3; // 降低阈值以增加采样
    } else if (currentSampleCount > targetSampleCount * 1.2) {
      return 0.7; // 提高阈值以减少采样
    }

    return 0.5; // 默认阈值
  }

  /**
   * 计算上下文得分
   */
  _calculateContextualScore(context) {
    // 基于上下文信息的综合评分
    let score = 0;

    // 优先级权重
    score += context.priority * 0.4;

    // 复杂度权重
    score += context.complexity * 0.3;

    // 异常得分权重
    score += context.anomalyScore * 0.3;

    return Math.min(1.0, score);
  }

  /**
   * 计算成本效益
   */
  _calculateCostEfficiency(context) {
    const value = context.priority * 0.6 + (1 - context.anomalyScore) * 0.4;
    const cost = context.cost;

    // 效益成本比
    return cost > 0 ? value / cost : 1.0;
  }

  /**
   * 记录采样决策
   */
  _recordSamplingDecision(operationName, options, context, reason, processingTime) {
    // 记录决策用于后续分析和优化
    const decision = {
      timestamp: Date.now(),
      operationName,
      context,
      reason,
      processingTime,
      options,
    };

    // 可以存储到时间序列数据库或分析系统
    logger.debug('采样决策记录', decision);
  }

  /**
   * 更新采样统计
   */
  _updateSamplingStats(wasSampled, context) {
    this.samplingStats.samplingEfficiency = this.samplingStats.totalRequests > 0 ?
      this.samplingStats.sampledRequests / this.samplingStats.totalRequests : 0;

    // 计算成本节省
    const sampledCost = context.cost || 1;
    const totalPossibleCost = this.samplingStats.totalRequests * sampledCost;
    const actualCost = this.samplingStats.sampledRequests * sampledCost;

    this.samplingStats.costSavings = totalPossibleCost > 0 ?
      (totalPossibleCost - actualCost) / totalPossibleCost : 0;
  }

  /**
   * 执行动态调整
   */
  _performDynamicAdjustments() {
    try {
      // 突发检测和调整
      if (this.dynamicParams.burstDetectionEnabled) {
        this._detectAndHandleBursts();
      }

      // 趋势分析
      if (this.dynamicParams.trendAnalysisEnabled) {
        this._analyzeSamplingTrends();
      }

      // 季节性调整
      if (this.dynamicParams.seasonalAdjustmentEnabled) {
        this._applySeasonalAdjustments();
      }

      // 反馈循环
      if (this.dynamicParams.feedbackLoopEnabled) {
        this._executeFeedbackLoop();
      }

      // 训练机器学习模型
      if (this.advancedConfig.machineLearningSampling && this.samplingStats.totalRequests > 1000) {
        this._trainMLModel();
      }

    } catch (error) {
      logger.error('动态调整失败', error);
    }
  }

  /**
   * 检测和处理突发
   */
  _detectAndHandleBursts() {
    const recentRequests = this._getRecentRequests(60); // 最近60秒
    const avgRequests = recentRequests.length / 60;

    if (avgRequests > this.maxSamplesPerSecond * 2) {
      // 检测到突发，临时增加采样率
      this.currentSamplingRate = Math.min(1.0, this.currentSamplingRate * 1.5);
      logger.info('检测到请求突发，增加采样率', {
        avgRequests,
        newSamplingRate: this.currentSamplingRate,
      });
    }
  }

  /**
   * 分析采样趋势
   */
  _analyzeSamplingTrends() {
    const recentStats = this._getRecentStats(300); // 最近5分钟

    if (recentStats.length < 2) return;

    const trend = this._calculateTrend(recentStats, 'samplingEfficiency');

    if (trend < -0.1) { // 效率下降
      // 调整采样策略
      this.currentSamplingRate = Math.max(0.01, this.currentSamplingRate * 0.9);
      logger.info('采样效率下降，降低采样率', { trend, newRate: this.currentSamplingRate });
    } else if (trend > 0.1) { // 效率上升
      this.currentSamplingRate = Math.min(1.0, this.currentSamplingRate * 1.1);
      logger.info('采样效率上升，增加采样率', { trend, newRate: this.currentSamplingRate });
    }
  }

  /**
   * 应用季节性调整
   */
  _applySeasonalAdjustments() {
    const hour = new Date().getHours();

    // 工作时间增加采样率
    if (hour >= 9 && hour <= 17) {
      this.currentSamplingRate = Math.min(1.0, this.samplingRate * 1.2);
    } else {
      this.currentSamplingRate = this.samplingRate;
    }
  }

  /**
   * 执行反馈循环
   */
  _executeFeedbackLoop() {
    // 基于采样结果调整策略
    const recentEfficiency = this.samplingStats.samplingEfficiency;

    if (recentEfficiency > 0.9) {
      // 效率很高，可以减少采样
      this.samplingRate = Math.max(0.01, this.samplingRate * 0.95);
    } else if (recentEfficiency < 0.7) {
      // 效率较低，需要增加采样
      this.samplingRate = Math.min(1.0, this.samplingRate * 1.05);
    }
  }

  /**
   * 训练机器学习模型
   */
  _trainMLModel() {
    // 简化的ML模型训练实现
    // 在实际系统中，这里会使用更复杂的算法
    const trainingData = this._prepareTrainingData();

    if (trainingData.length > 100) {
      this.mlModel = this._simpleLinearModel(trainingData);
      logger.info('机器学习采样模型已训练', { trainingSamples: trainingData.length });
    }
  }

  /**
   * 准备训练数据
   */
  _prepareTrainingData() {
    const trainingData = [];

    for (const [operationName, contexts] of this.contextualData.entries()) {
      for (const context of contexts.slice(-100)) { // 最近100个样本
        const features = this._extractSamplingFeatures(context);
        const label = Math.random() < this.currentSamplingRate ? 1 : 0; // 简化的标签

        trainingData.push({ features, label });
      }
    }

    return trainingData;
  }

  /**
   * 简单的线性模型
   */
  _simpleLinearModel(trainingData) {
    // 简化的线性回归实现
    const weights = new Array(10).fill(0); // 10个特征
    const learningRate = 0.01;

    // 训练迭代
    for (let epoch = 0; epoch < 10; epoch++) {
      for (const sample of trainingData) {
        const prediction = this._dotProduct(weights, sample.features);
        const error = sample.label - prediction;

        // 更新权重
        for (let i = 0; i < weights.length; i++) {
          weights[i] += learningRate * error * sample.features[i];
        }
      }
    }

    return {
      weights,
      predict: (features) => {
        const score = this._dotProduct(weights, features);
        return { shouldSample: score > 0.5 };
      }
    };
  }

  /**
   * 向量点积
   */
  _dotProduct(a, b) {
    return a.reduce((sum, val, i) => sum + val * b[i], 0);
  }

  /**
   * 获取最近的请求
   */
  _getRecentRequests(seconds) {
    const cutoff = Date.now() - (seconds * 1000);
    const recent = [];

    for (const [_, contexts] of this.contextualData.entries()) {
      recent.push(...contexts.filter(c => c.timestamp > cutoff));
    }

    return recent;
  }

  /**
   * 获取最近的统计数据
   */
  _getRecentStats(seconds) {
    // 简化的实现
    return [this.samplingStats]; // 返回当前统计
  }

  /**
   * 计算趋势
   */
  _calculateTrend(data, field) {
    if (data.length < 2) return 0;

    const first = data[0][field];
    const last = data[data.length - 1][field];

    return (last - first) / first;
  }

  /**
   * 获取高级采样统计信息
   */
  getAdvancedSamplingStats() {
    const basicStats = {
      totalRequests: this.samplingStats.totalRequests,
      sampledRequests: this.samplingStats.sampledRequests,
      currentSamplingRate: this.currentSamplingRate,
      samplingEfficiency: this.samplingStats.samplingEfficiency,
    };

    return {
      basic: basicStats,
      advanced: {
        costSavings: this.samplingStats.costSavings,
        falsePositiveRate: this.samplingStats.falsePositiveRate,
        falseNegativeRate: this.samplingStats.falseNegativeRate,
        samplingType: this.type,
        prioritySampling: this.advancedConfig.prioritySampling,
        contextualSampling: this.advancedConfig.contextualSampling,
        temporalSampling: this.advancedConfig.temporalSampling,
        anomalyBasedSampling: this.advancedConfig.anomalyBasedSampling,
        costBasedSampling: this.advancedConfig.costBasedSampling,
        machineLearningSampling: this.advancedConfig.machineLearningSampling,
        mlModelTrained: this.mlModel !== null,
        requestPatterns: this.requestPatterns.size,
        anomalyPatterns: this.anomalyPatterns.size,
        temporalPatterns: this.temporalPatterns.size,
      },
      performance: {
        avgDecisionTime: this._calculateAvgDecisionTime(),
        throughput: this._calculateSamplingThroughput(),
        memoryUsage: this._calculateMemoryUsage(),
      },
      dynamicParams: { ...this.dynamicParams },
    };
  }

  /**
   * 计算平均决策时间
   */
  _calculateAvgDecisionTime() {
    // 简化的计算
    return 1; // 毫秒
  }

  /**
   * 计算采样吞吐量
   */
  _calculateSamplingThroughput() {
    const timeWindow = 60; // 60秒
    const recentRequests = this._getRecentRequests(timeWindow);
    return recentRequests.length / timeWindow;
  }

  /**
   * 计算内存使用
   */
  _calculateMemoryUsage() {
    let totalSize = 0;

    // 估算各数据结构的大小
    totalSize += this.contextualData.size * 100; // 估算每个上下文100字节
    totalSize += this.temporalPatterns.size * 50;
    totalSize += this.anomalyPatterns.size * 50;

    return totalSize;
  }
}
