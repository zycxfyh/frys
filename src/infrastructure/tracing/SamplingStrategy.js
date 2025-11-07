/**
 * frys - 采样策略
 * 控制哪些请求应该被追踪以平衡性能和可观测性
 */

import { logger } from '../../utils/logger.js';

export class SamplingStrategy {
  constructor(config = {}) {
    this.type = config.type || 'probability'; // probability, rate_limiting, adaptive, rules_based
    this.samplingRate = config.samplingRate || 0.1; // 10% 采样率
    this.maxSamplesPerSecond = config.maxSamplesPerSecond || 100;
    this.rules = config.rules || [];
    this.adaptiveConfig = config.adaptive || {
      enabled: false,
      targetLatency: 100, // 目标延迟(ms)
      adjustmentInterval: 60000, // 调整间隔(ms)
    };

    this.sampleCount = 0;
    this.timeWindowStart = Date.now();
    this.isRunning = false;

    // 自适应采样状态
    this.latencyHistory = [];
    this.currentSamplingRate = this.samplingRate;
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
    switch (this.type) {
      case 'probability':
        return this._probabilitySampling(operationName, options);
      case 'rate_limiting':
        return this._rateLimitingSampling(operationName, options);
      case 'adaptive':
        return this._adaptiveSampling(operationName, options);
      case 'rules_based':
        return this._rulesBasedSampling(operationName, options);
      default:
        return this._probabilitySampling(operationName, options);
    }
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
}
