/**
 * frys - 扩容策略
 * 定义不同的自动扩容策略和决策逻辑
 */

import { logger } from '../../utils/logger.js';

export class ScalingPolicy {
  constructor(config = {}) {
    this.name = config.name || 'default';
    this.type = config.type || 'cpu'; // cpu, memory, requests, custom
    this.scaleUpThreshold = config.scaleUpThreshold || 0.8; // 80%
    this.scaleDownThreshold = config.scaleDownThreshold || 0.3; // 30%
    this.cooldownPeriod = config.cooldownPeriod || 300000; // 5分钟冷却期
    this.minInstances = config.minInstances || 1;
    this.maxInstances = config.maxInstances || 10;
    this.scaleFactor = config.scaleFactor || 1.5; // 扩容倍数
    this.lastScaleTime = 0;
    this.enabled = config.enabled !== false;
  }

  /**
   * 检查是否需要扩容
   * @param {object} metrics - 当前指标
   * @param {number} currentInstances - 当前实例数
   * @returns {object} 扩容决策
   */
  shouldScaleUp(metrics, currentInstances) {
    if (!this.enabled || currentInstances >= this.maxInstances) {
      return {
        shouldScale: false,
        reason: 'Policy disabled or at max capacity',
      };
    }

    // 检查冷却期
    if (Date.now() - this.lastScaleTime < this.cooldownPeriod) {
      return { shouldScale: false, reason: 'Cooldown period active' };
    }

    const threshold = this._calculateThreshold(metrics);
    if (threshold > this.scaleUpThreshold) {
      const targetInstances = Math.min(
        Math.ceil(currentInstances * this.scaleFactor),
        this.maxInstances,
      );

      return {
        shouldScale: true,
        targetInstances,
        reason: `${this.type} usage ${Math.round(threshold * 100)}% exceeds threshold ${Math.round(this.scaleUpThreshold * 100)}%`,
        policy: this.name,
      };
    }

    return { shouldScale: false, reason: 'Threshold not exceeded' };
  }

  /**
   * 检查是否需要缩容
   * @param {object} metrics - 当前指标
   * @param {number} currentInstances - 当前实例数
   * @returns {object} 缩容决策
   */
  shouldScaleDown(metrics, currentInstances) {
    if (!this.enabled || currentInstances <= this.minInstances) {
      return {
        shouldScale: false,
        reason: 'Policy disabled or at min capacity',
      };
    }

    // 检查冷却期
    if (Date.now() - this.lastScaleTime < this.cooldownPeriod) {
      return { shouldScale: false, reason: 'Cooldown period active' };
    }

    const threshold = this._calculateThreshold(metrics);
    if (threshold < this.scaleDownThreshold) {
      const targetInstances = Math.max(
        Math.floor(currentInstances / this.scaleFactor),
        this.minInstances,
      );

      return {
        shouldScale: true,
        targetInstances,
        reason: `${this.type} usage ${Math.round(threshold * 100)}% below threshold ${Math.round(this.scaleDownThreshold * 100)}%`,
        policy: this.name,
      };
    }

    return { shouldScale: false, reason: 'Threshold not met' };
  }

  /**
   * 计算当前指标阈值
   * @param {object} metrics - 指标数据
   * @returns {number} 阈值 (0-1)
   */
  _calculateThreshold(metrics) {
    switch (this.type) {
      case 'cpu':
        return metrics.cpuUsage || 0;
      case 'memory':
        return metrics.memoryUsage || 0;
      case 'requests':
        return metrics.requestRate
          ? metrics.requestRate / metrics.maxRequestRate
          : 0;
      case 'response_time':
        return metrics.avgResponseTime
          ? Math.min(metrics.avgResponseTime / 5000, 1)
          : 0; // 5秒为最大响应时间
      case 'custom':
        return this._calculateCustomThreshold(metrics);
      default:
        return 0;
    }
  }

  /**
   * 计算自定义阈值
   * @param {object} metrics - 指标数据
   * @returns {number} 自定义阈值
   */
  _calculateCustomThreshold(metrics) {
    // 可以根据业务逻辑自定义计算
    // 例如：综合考虑多个指标
    const cpuWeight = 0.4;
    const memoryWeight = 0.3;
    const requestWeight = 0.3;

    const cpuThreshold = (metrics.cpuUsage || 0) * cpuWeight;
    const memoryThreshold = (metrics.memoryUsage || 0) * memoryWeight;
    const requestThreshold = metrics.requestRate
      ? (metrics.requestRate / metrics.maxRequestRate) * requestWeight
      : 0;

    return cpuThreshold + memoryThreshold + requestThreshold;
  }

  /**
   * 更新最后扩容时间
   */
  updateLastScaleTime() {
    this.lastScaleTime = Date.now();
  }

  /**
   * 获取策略配置
   */
  getConfig() {
    return {
      name: this.name,
      type: this.type,
      scaleUpThreshold: this.scaleUpThreshold,
      scaleDownThreshold: this.scaleDownThreshold,
      cooldownPeriod: this.cooldownPeriod,
      minInstances: this.minInstances,
      maxInstances: this.maxInstances,
      scaleFactor: this.scaleFactor,
      enabled: this.enabled,
      lastScaleTime: this.lastScaleTime,
    };
  }

  /**
   * 更新策略配置
   */
  updateConfig(config) {
    Object.assign(this, config);
    logger.info('扩容策略配置已更新', { policy: this.name, config });
  }
}

/**
 * CPU使用率扩容策略
 */
export class CpuScalingPolicy extends ScalingPolicy {
  constructor(config = {}) {
    super({
      name: 'cpu_policy',
      type: 'cpu',
      scaleUpThreshold: config.scaleUpThreshold || 0.75,
      scaleDownThreshold: config.scaleDownThreshold || 0.25,
      ...config,
    });
  }
}

/**
 * 内存使用率扩容策略
 */
export class MemoryScalingPolicy extends ScalingPolicy {
  constructor(config = {}) {
    super({
      name: 'memory_policy',
      type: 'memory',
      scaleUpThreshold: config.scaleUpThreshold || 0.8,
      scaleDownThreshold: config.scaleDownThreshold || 0.3,
      ...config,
    });
  }
}

/**
 * 请求率扩容策略
 */
export class RequestScalingPolicy extends ScalingPolicy {
  constructor(config = {}) {
    super({
      name: 'request_policy',
      type: 'requests',
      scaleUpThreshold: config.scaleUpThreshold || 0.85,
      scaleDownThreshold: config.scaleDownThreshold || 0.2,
      ...config,
    });
  }
}

/**
 * 复合扩容策略（同时考虑多个指标）
 */
export class CompositeScalingPolicy extends ScalingPolicy {
  constructor(policies = [], config = {}) {
    super({
      name: 'composite_policy',
      type: 'custom',
      ...config,
    });
    this.policies = policies;
  }

  shouldScaleUp(metrics, currentInstances) {
    // 任意策略要求扩容时就扩容
    for (const policy of this.policies) {
      const decision = policy.shouldScaleUp(metrics, currentInstances);
      if (decision.shouldScale) {
        return {
          shouldScale: true,
          targetInstances: decision.targetInstances,
          reason: `Composite policy triggered by: ${decision.reason}`,
          policy: this.name,
        };
      }
    }
    return {
      shouldScale: false,
      reason: 'No composite policy triggered scale up',
    };
  }

  shouldScaleDown(metrics, currentInstances) {
    // 所有策略都同意缩容时才缩容
    const decisions = this.policies.map((policy) =>
      policy.shouldScaleDown(metrics, currentInstances),
    );
    const allAgree = decisions.every((decision) => decision.shouldScale);

    if (allAgree && decisions.length > 0) {
      const maxTargetInstances = Math.max(
        ...decisions.map((d) => d.targetInstances),
      );
      return {
        shouldScale: true,
        targetInstances: maxTargetInstances,
        reason: 'All composite policies agree to scale down',
        policy: this.name,
      };
    }

    return {
      shouldScale: false,
      reason: 'Composite policies do not all agree to scale down',
    };
  }
}
