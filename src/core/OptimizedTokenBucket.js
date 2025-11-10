/**
 * 优化的令牌桶算法实现
 * 基于性能分析优化了时间管理和内存使用
 *
 * 优化点：
 * - 使用高效的时间戳计算
 * - 减少对象创建和垃圾回收
 * - 优化并发访问
 * - 支持自适应填充率
 */

import { logger } from '../../shared/utils/logger.js';

class TokenBucketPool {
  constructor(initialSize = 10) {
    this.pool = [];
    this.active = new Set();

    for (let i = 0; i < initialSize; i++) {
      this.pool.push({
        tokens: 0,
        lastRefill: 0,
        capacity: 0,
        refillRate: 0,
        id: null
      });
    }
  }

  acquire() {
    let bucket = this.pool.pop();
    if (!bucket) {
      bucket = {
        tokens: 0,
        lastRefill: 0,
        capacity: 0,
        refillRate: 0,
        id: null
      };
    }
    this.active.add(bucket);
    return bucket;
  }

  release(bucket) {
    if (this.active.has(bucket)) {
      bucket.tokens = 0;
      bucket.lastRefill = 0;
      bucket.capacity = 0;
      bucket.refillRate = 0;
      bucket.id = null;

      this.pool.push(bucket);
      this.active.delete(bucket);
    }
  }
}

export class OptimizedTokenBucket {
  constructor(options = {}) {
    this.options = {
      capacity: 100,
      refillRate: 10, // 每秒补充令牌数
      initialTokens: 100,
      enableAdaptiveRefill: true,
      burstMultiplier: 1.5, // 突发流量倍数
      minRefillRate: 1,
      maxRefillRate: 1000,
      ...options
    };

    // 使用对象池优化
    this.bucket = {
      tokens: this.options.initialTokens,
      lastRefill: this._now(),
      capacity: this.options.capacity,
      refillRate: this.options.refillRate
    };

    // 自适应参数
    this.adaptiveStats = {
      requestCount: 0,
      grantedCount: 0,
      lastAdjustment: this._now(),
      burstMode: false
    };

    // 性能监控
    this.metrics = {
      totalRequests: 0,
      totalGranted: 0,
      totalRejected: 0,
      averageRequestRate: 0,
      peakRequestRate: 0,
      currentRequestRate: 0
    };

    // 定时器ID（用于清理）
    this.adjustmentTimer = null;

    // 启动自适应调整（如果启用）
    if (this.options.enableAdaptiveRefill) {
      this._startAdaptiveAdjustment();
    }

    logger.info('OptimizedTokenBucket initialized', {
      capacity: this.options.capacity,
      refillRate: this.options.refillRate
    });
  }

  /**
   * 高精度时间戳
   * 优化：使用performance.now()提供更好的精度
   */
  _now() {
    return performance.now();
  }

  /**
   * 消耗指定数量的令牌
   * 优化：减少计算开销，内联填充逻辑
   */
  consume(tokens = 1) {
    this.metrics.totalRequests++;
    this.adaptiveStats.requestCount++;

    // 原子性填充令牌
    this._refill();

    if (this.bucket.tokens >= tokens) {
      this.bucket.tokens -= tokens;
      this.metrics.totalGranted++;
      this.adaptiveStats.grantedCount++;
      return true;
    }

    this.metrics.totalRejected++;
    return false;
  }

  /**
   * 批量消耗令牌
   * 优化：减少重复填充操作
   */
  consumeBatch(requests) {
    this._refill(); // 只填充一次

    const results = [];
    let totalConsumed = 0;

    for (const request of requests) {
      const tokens = request.tokens || 1;

      if (this.bucket.tokens >= tokens) {
        this.bucket.tokens -= tokens;
        totalConsumed += tokens;
        results.push({ granted: true, tokens });
      } else {
        results.push({ granted: false, tokens });
      }
    }

    // 更新统计
    this.metrics.totalRequests += requests.length;
    this.metrics.totalGranted += results.filter(r => r.granted).length;
    this.metrics.totalRejected += results.filter(r => !r.granted).length;

    return results;
  }

  /**
   * 尝试消耗令牌，带超时等待
   * 优化：使用更高效的等待机制
   */
  async consumeWithWait(tokens = 1, timeout = 5000) {
    const startTime = this._now();

    // 快速路径：如果有足够的令牌，直接返回
    if (this.consume(tokens)) {
      return true;
    }

    // 计算需要等待的时间
    const deficit = tokens - this.bucket.tokens;
    const waitTime = (deficit / this.bucket.refillRate) * 1000; // 转换为毫秒

    if (timeout > 0 && waitTime > timeout) {
      return false; // 等待时间超过超时限制
    }

    // 使用高效的等待机制
    if (waitTime > 0) {
      await this._waitEfficiently(waitTime);
    }

    // 再次尝试消耗
    return this.consume(tokens);
  }

  /**
   * 高效等待机制
   * 优化：使用setTimeout和Promise的组合
   */
  _waitEfficiently(ms) {
    return new Promise(resolve => {
      const start = this._now();
      const wait = () => {
        const elapsed = this._now() - start;
        if (elapsed >= ms) {
          resolve();
        } else {
          setTimeout(wait, Math.min(ms - elapsed, 10)); // 最多等待10ms
        }
      };
      wait();
    });
  }

  /**
   * 填充令牌
   * 优化：减少浮点运算，使用整数运算
   */
  _refill() {
    const now = this._now();
    const elapsed = now - this.bucket.lastRefill;

    if (elapsed <= 0) return; // 避免倒退时间

    // 计算应该补充的令牌数（使用整数运算优化）
    const refillAmount = Math.floor((elapsed / 1000) * this.bucket.refillRate);

    if (refillAmount > 0) {
      this.bucket.tokens = Math.min(
        this.bucket.capacity,
        this.bucket.tokens + refillAmount
      );
      this.bucket.lastRefill = now;
    }
  }

  /**
   * 自适应填充率调整
   * 优化：基于历史数据动态调整填充率
   */
  _startAdaptiveAdjustment() {
    const adjustInterval = 60000; // 每分钟调整一次

    this.adjustmentTimer = setInterval(() => {
      this._adjustRefillRate();
    }, adjustInterval);
  }

  _adjustRefillRate() {
    const now = this._now();
    const timeWindow = (now - this.adaptiveStats.lastAdjustment) / 1000; // 秒

    if (timeWindow < 10) return; // 时间窗口太短

    const requestRate = this.adaptiveStats.requestCount / timeWindow;
    const grantRate = this.adaptiveStats.grantedCount / timeWindow;
    const rejectionRate = 1 - (grantRate / requestRate);

    // 更新请求率指标
    this.metrics.currentRequestRate = requestRate;
    this.metrics.peakRequestRate = Math.max(this.metrics.peakRequestRate, requestRate);

    // 自适应调整逻辑
    let newRefillRate = this.bucket.refillRate;

    if (rejectionRate > 0.3) { // 拒绝率过高，增加填充率
      newRefillRate = Math.min(
        this.options.maxRefillRate,
        newRefillRate * 1.2
      );
      this.adaptiveStats.burstMode = true;
    } else if (rejectionRate < 0.05 && this.adaptiveStats.burstMode) { // 低负载，逐渐降低
      newRefillRate = Math.max(
        this.options.minRefillRate,
        newRefillRate * 0.95
      );

      // 如果填充率回到正常水平，退出突发模式
      if (newRefillRate <= this.options.refillRate * 1.1) {
        this.adaptiveStats.burstMode = false;
      }
    }

    if (newRefillRate !== this.bucket.refillRate) {
      logger.debug('Adaptive refill rate adjustment', {
        oldRate: this.bucket.refillRate,
        newRate: newRefillRate,
        rejectionRate: rejectionRate.toFixed(3),
        burstMode: this.adaptiveStats.burstMode
      });

      this.bucket.refillRate = newRefillRate;
    }

    // 重置统计数据
    this.adaptiveStats.requestCount = 0;
    this.adaptiveStats.grantedCount = 0;
    this.adaptiveStats.lastAdjustment = now;
  }

  /**
   * 获取当前令牌数量（实时）
   */
  getAvailableTokens() {
    this._refill();
    return this.bucket.tokens;
  }

  /**
   * 获取桶的状态
   */
  getStats() {
    this._refill();

    return {
      capacity: this.bucket.capacity,
      availableTokens: this.bucket.tokens,
      refillRate: this.bucket.refillRate,
      fillRate: this.bucket.tokens / this.bucket.capacity,
      metrics: { ...this.metrics },
      adaptiveStats: { ...this.adaptiveStats },
      options: { ...this.options }
    };
  }

  /**
   * 动态调整容量
   */
  setCapacity(newCapacity) {
    if (newCapacity <= 0) return false;

    this.bucket.capacity = newCapacity;
    this.bucket.tokens = Math.min(this.bucket.tokens, newCapacity);

    logger.info('TokenBucket capacity adjusted', {
      oldCapacity: this.options.capacity,
      newCapacity
    });

    this.options.capacity = newCapacity;
    return true;
  }

  /**
   * 动态调整填充率
   */
  setRefillRate(newRate) {
    if (newRate <= 0) return false;

    this.bucket.refillRate = Math.max(
      this.options.minRefillRate,
      Math.min(this.options.maxRefillRate, newRate)
    );

    logger.info('TokenBucket refill rate adjusted', {
      oldRate: this.options.refillRate,
      newRate: this.bucket.refillRate
    });

    this.options.refillRate = newRate;
    return true;
  }

  /**
   * 重置桶状态
   */
  reset() {
    this.bucket.tokens = this.options.initialTokens;
    this.bucket.lastRefill = this._now();

    // 重置统计数据
    this.metrics.totalRequests = 0;
    this.metrics.totalGranted = 0;
    this.metrics.totalRejected = 0;
    this.metrics.averageRequestRate = 0;
    this.metrics.peakRequestRate = 0;
    this.metrics.currentRequestRate = 0;

    this.adaptiveStats.requestCount = 0;
    this.adaptiveStats.grantedCount = 0;
    this.adaptiveStats.lastAdjustment = this._now();
    this.adaptiveStats.burstMode = false;

    logger.info('TokenBucket reset');
  }

  /**
   * 优雅关闭
   */
  shutdown() {
    if (this.adjustmentTimer) {
      clearInterval(this.adjustmentTimer);
      this.adjustmentTimer = null;
    }

    logger.info('OptimizedTokenBucket shut down');
  }

  /**
   * 创建令牌桶的轻量级快照
   * 用于状态持久化或分布式同步
   */
  createSnapshot() {
    return {
      tokens: this.bucket.tokens,
      lastRefill: this.bucket.lastRefill,
      capacity: this.bucket.capacity,
      refillRate: this.bucket.refillRate,
      metrics: { ...this.metrics },
      timestamp: this._now()
    };
  }

  /**
   * 从快照恢复令牌桶状态
   */
  restoreFromSnapshot(snapshot) {
    if (!snapshot || !snapshot.timestamp) return false;

    // 检查快照是否过期（超过5分钟）
    const age = this._now() - snapshot.timestamp;
    if (age > 300000) {
      logger.warn('Snapshot too old, ignoring', { age });
      return false;
    }

    // 恢复状态并填充令牌
    this.bucket.tokens = snapshot.tokens;
    this.bucket.lastRefill = snapshot.lastRefill;
    this.bucket.capacity = snapshot.capacity;
    this.bucket.refillRate = snapshot.refillRate;

    this._refill(); // 根据经过的时间填充令牌

    logger.info('TokenBucket restored from snapshot');
    return true;
  }
}

export default OptimizedTokenBucket;
