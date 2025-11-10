/**
 * 多级缓存管理器
 * 支持内存缓存、Redis缓存和自定义缓存策略
 */

import { logger } from '../../shared/utils/logger.js';

export class CacheManager {
  constructor(options = {}) {
    this.options = {
      defaultTtl: options.defaultTtl || 300000, // 5分钟默认TTL
      maxMemorySize: options.maxMemorySize || 100 * 1024 * 1024, // 100MB
      enableRedis: options.enableRedis || false,
      redisUrl: options.redisUrl || 'redis://localhost:6379',
      enableMetrics: options.enableMetrics !== false,

      // 高级缓存算法配置
      evictionPolicy: options.evictionPolicy || 'adaptive_lru', // adaptive_lru, lfu, arc, clock, w_tiny_lfu
      predictivePrefetch: options.predictivePrefetch || false,
      compressionEnabled: options.compressionEnabled || false,
      tieredStorage: options.tieredStorage || true,
      adaptiveTTL: options.adaptiveTTL || true,

      ...options,
    };

    this.layers = new Map();
    this.strategies = new Map();

    // 高级缓存数据结构
    this.accessPatterns = new Map(); // 访问模式分析
    this.keyRelationships = new Map(); // 键关系图
    this.prefetchQueue = []; // 预取队列
    this.compressionStats = new Map(); // 压缩统计
    this.tierMigrationStats = new Map(); // 层间迁移统计

    // 自适应算法参数
    this.hitRateHistory = [];
    this.missPenaltyHistory = [];
    this.accessFrequency = new Map();
    this.recencyScores = new Map();
    this.evictionCandidates = new PriorityQueue();

    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      prefetchHits: 0,
      prefetchMisses: 0,
      compressionSavings: 0,
      tierMigrations: 0,
    };

    // 初始化缓存层
    this.initializeLayers();

    // 启动高级缓存管理器
    this.startAdvancedCacheManager();

    // 启动清理定时器
    this.startCleanupTimer();
  }

  /**
   * 初始化缓存层
   */
  initializeLayers() {
    // L1: 内存缓存 (最快)
    this.layers.set(
      'memory',
      new MemoryCacheLayer({
        maxSize: this.options.maxMemorySize,
        enableMetrics: this.options.enableMetrics,
      }),
    );

    // L2: Redis缓存 (可选)
    if (this.options.enableRedis) {
      try {
        const RedisCacheLayer = this.loadRedisCacheLayer();
        this.layers.set(
          'redis',
          new RedisCacheLayer({
            url: this.options.redisUrl,
            enableMetrics: this.options.enableMetrics,
          }),
        );
      } catch (error) {
        logger.warn('Redis缓存层初始化失败，使用内存缓存', error);
      }
    }

    logger.info('缓存管理器初始化完成', {
      layers: Array.from(this.layers.keys()),
      redisEnabled: this.options.enableRedis,
    });
  }

  /**
   * 动态加载Redis缓存层
   */
  loadRedisCacheLayer() {
    // 这里可以动态加载Redis实现
    // 为了简化，先返回一个模拟实现
    return class RedisCacheLayer {
      constructor(options) {
        this.options = options;
        this.cache = new Map();
        this.metrics = { hits: 0, misses: 0, sets: 0, deletes: 0 };
      }

      async get(key) {
        const value = this.cache.get(key);
        if (value && value.expiry > Date.now()) {
          this.metrics.hits++;
          return value.data;
        }
        this.metrics.misses++;
        return null;
      }

      async set(key, value, ttl = 300000) {
        this.cache.set(key, {
          data: value,
          expiry: Date.now() + ttl,
        });
        this.metrics.sets++;
        return true;
      }

      async delete(key) {
        const deleted = this.cache.delete(key);
        if (deleted) this.metrics.deletes++;
        return deleted;
      }

      async clear() {
        this.cache.clear();
        return true;
      }

      async healthCheck() {
        return { status: 'healthy', size: this.cache.size };
      }
    };
  }

  /**
   * 注册缓存策略
   */
  registerStrategy(name, strategy) {
    this.strategies.set(name, strategy);
    logger.info(`缓存策略已注册: ${name}`);
  }

  /**
   * 获取缓存值
   */
  async get(key, options = {}) {
    const startTime = Date.now();

    // 记录访问模式
    this._recordAccessPattern(key, 'read', options);

    // 检查预取队列
    const prefetched = this._checkPrefetchQueue(key);
    if (prefetched) {
      this.metrics.prefetchHits++;
      return prefetched;
    }

    // 智能层级缓存查找
    const result = await this._intelligentCacheLookup(key, options);

    // 记录访问时间和结果
    const accessTime = Date.now() - startTime;
    this._updateAccessMetrics(key, result !== null, accessTime);

    // 触发预测性预取
    if (result !== null && this.options.predictivePrefetch) {
      this._triggerPredictivePrefetch(key, result);
    }

    // 自适应TTL调整
    if (result !== null && this.options.adaptiveTTL) {
      this._adjustTTLAdaptive(key, options);
    }

    return result;
  }

  /**
   * 设置缓存值
   */
  async set(key, value, options = {}) {
    const strategy = options.strategy || 'default';
    const strategyImpl = this.strategies.get(strategy) || this.defaultStrategy;

    return await strategyImpl.set.call(this, key, value, options);
  }

  /**
   * 删除缓存值
   */
  async delete(key, options = {}) {
    const strategy = options.strategy || 'default';
    const strategyImpl = this.strategies.get(strategy) || this.defaultStrategy;

    return await strategyImpl.delete.call(this, key, options);
  }

  /**
   * 清空缓存
   */
  async clear(pattern = null, options = {}) {
    // 简化实现：直接清空内存缓存
    // 实际应该根据pattern进行更精确的清理
    try {
      await this.layers.get('memory').clear();
      if (this.layers.has('redis')) {
        await this.layers.get('redis').clear();
      }
      return true;
    } catch (error) {
      logger.error('清空缓存失败', error);
      return false;
    }
  }

  /**
   * 默认缓存策略
   */
  get defaultStrategy() {
    return {
      get: async (key, options) => {
        // 先查内存缓存
        let value = await this.layers.get('memory').get(key);
        if (value !== null) {
          this.metrics.hits++;
          return value;
        }

        // 再查Redis缓存
        if (this.layers.has('redis')) {
          value = await this.layers.get('redis').get(key);
          if (value !== null) {
            // 写回内存缓存
            await this.layers.get('memory').set(key, value, options.ttl);
            this.metrics.hits++;
            return value;
          }
        }

        this.metrics.misses++;
        return null;
      },

      set: async (key, value, options) => {
        const ttl = options.ttl || this.options.defaultTtl;
        let success = true;

        // 设置内存缓存
        try {
          await this.layers.get('memory').set(key, value, ttl);
        } catch (error) {
          logger.error('设置内存缓存失败', error);
          success = false;
        }

        // 设置Redis缓存
        if (this.layers.has('redis')) {
          try {
            await this.layers.get('redis').set(key, value, ttl);
          } catch (error) {
            logger.error('设置Redis缓存失败', error);
          }
        }

        this.metrics.sets++;
        return success;
      },

      delete: async (key, options) => {
        let deleted = false;

        // 删除内存缓存
        try {
          deleted = (await this.layers.get('memory').delete(key)) || deleted;
        } catch (error) {
          logger.error('删除内存缓存失败', error);
        }

        // 删除Redis缓存
        if (this.layers.has('redis')) {
          try {
            deleted = (await this.layers.get('redis').delete(key)) || deleted;
          } catch (error) {
            logger.error('删除Redis缓存失败', error);
          }
        }

        if (deleted) this.metrics.deletes++;
        return deleted;
      },

      clear: async (pattern, options) => {
        // 清空内存缓存
        try {
          await this.layers.get('memory').clear();
        } catch (error) {
          logger.error('清空内存缓存失败', error);
        }

        // 清空Redis缓存
        if (this.layers.has('redis')) {
          try {
            await this.layers.get('redis').clear();
          } catch (error) {
            logger.error('清空Redis缓存失败', error);
          }
        }

        return true;
      },
    };
  }

  /**
   * 获取或设置缓存值（缓存穿透保护）
   */
  async getOrSet(key, factory, options = {}) {
    // 先检查缓存
    let value = await this.get(key, options);
    if (value !== null) {
      return value;
    }

    // 缓存未命中，调用工厂函数
    try {
      value = await factory();

      // 设置缓存
      await this.set(key, value, options);

      return value;
    } catch (error) {
      // 如果工厂函数失败，可以设置一个短时间的负缓存
      if (options.negativeTtl) {
        await this.set(`${key}:error`, true, { ttl: options.negativeTtl });
      }
      throw error;
    }
  }

  /**
   * 批量操作
   */
  async mget(keys, options = {}) {
    const results = new Map();

    // 并发获取
    const promises = keys.map((key) => this.get(key, options));
    const values = await Promise.allSettled(promises);

    keys.forEach((key, index) => {
      const result = values[index];
      if (result.status === 'fulfilled') {
        results.set(key, result.value);
      } else {
        logger.error(`批量获取缓存失败: ${key}`, result.reason);
        results.set(key, null);
      }
    });

    return results;
  }

  async mset(keyValuePairs, options = {}) {
    const promises = Array.from(keyValuePairs.entries()).map(([key, value]) =>
      this.set(key, value, options),
    );

    const results = await Promise.allSettled(promises);
    return results.every((result) => result.status === 'fulfilled');
  }

  /**
   * 智能过期策略
   */
  async setWithSmartExpiry(key, value, options = {}) {
    const baseTtl = options.ttl || this.options.defaultTtl;

    // 根据访问模式调整TTL
    let adjustedTtl = baseTtl;

    if (options.accessPattern === 'frequent') {
      // 频繁访问的项目，延长TTL
      adjustedTtl = baseTtl * 1.5;
    } else if (options.accessPattern === 'rare') {
      // 很少访问的项目，缩短TTL
      adjustedTtl = baseTtl * 0.7;
    }

    // 添加随机因子避免缓存雪崩
    const jitter = Math.random() * 0.1 * baseTtl; // ±10%的随机因子
    adjustedTtl += jitter;

    return await this.set(key, value, { ...options, ttl: adjustedTtl });
  }

  /**
   * 缓存预热
   */
  async warmup(keys, factory, options = {}) {
    logger.info(`开始缓存预热，${keys.length} 个键`);

    const promises = keys.map(async (key) => {
      try {
        const value = await factory(key);
        await this.set(key, value, options);
        return { key, success: true };
      } catch (error) {
        logger.error(`缓存预热失败: ${key}`, error);
        return { key, success: false, error: error.message };
      }
    });

    const results = await Promise.allSettled(promises);
    const successful = results.filter(
      (r) => r.status === 'fulfilled' && r.value.success,
    ).length;

    logger.info(`缓存预热完成: ${successful}/${keys.length} 成功`);
    return successful;
  }

  /**
   * 缓存统计
   */
  getStats() {
    const layerStats = {};

    // 收集各层的统计信息
    for (const [name, layer] of this.layers) {
      try {
        layerStats[name] = layer.getStats
          ? layer.getStats()
          : { status: 'unknown' };
      } catch (error) {
        layerStats[name] = { status: 'error', error: error.message };
      }
    }

    return {
      layers: layerStats,
      strategies: Array.from(this.strategies.keys()),
      metrics: { ...this.metrics },
      hitRate:
        this.metrics.hits / (this.metrics.hits + this.metrics.misses) || 0,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 健康检查
   */
  async healthCheck() {
    const issues = [];
    const layerHealth = {};

    // 检查各层健康状态
    for (const [name, layer] of this.layers) {
      try {
        layerHealth[name] = await layer.healthCheck();
        if (layerHealth[name].status !== 'healthy') {
          issues.push(`${name}层健康检查失败: ${layerHealth[name].status}`);
        }
      } catch (error) {
        layerHealth[name] = { status: 'error', error: error.message };
        issues.push(`${name}层健康检查异常: ${error.message}`);
      }
    }

    return {
      status: issues.length === 0 ? 'healthy' : 'degraded',
      issues,
      layerHealth,
      metrics: this.getStats().metrics,
    };
  }

  /**
   * 启动清理定时器
   */
  startCleanupTimer() {
    // 每5分钟清理一次过期缓存
    this.cleanupTimer = setInterval(
      async () => {
        try {
          await this.cleanup();
        } catch (error) {
          logger.error('缓存清理失败', error);
        }
      },
      5 * 60 * 1000,
    );
  }

  /**
   * 清理过期缓存
   */
  async cleanup() {
    logger.debug('开始清理过期缓存');

    let evicted = 0;

    // 清理各层缓存
    for (const [name, layer] of this.layers) {
      try {
        if (layer.cleanup) {
          const layerEvicted = await layer.cleanup();
          evicted += layerEvicted;
        }
      } catch (error) {
        logger.error(`${name}层缓存清理失败`, error);
      }
    }

    if (evicted > 0) {
      this.metrics.evictions += evicted;
      logger.info(`缓存清理完成，清理 ${evicted} 个过期项目`);
    }
  }

  /**
   * 关闭缓存管理器
   */
  async close() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    // 关闭各层缓存
    for (const [name, layer] of this.layers) {
      try {
        if (layer.close) {
          await layer.close();
        }
      } catch (error) {
        logger.error(`${name}层关闭失败`, error);
      }
    }

    logger.info('缓存管理器已关闭');
  }
}

/**
 * 内存缓存层
 */
class MemoryCacheLayer {
  constructor(options = {}) {
    this.options = {
      maxSize: options.maxSize || 100 * 1024 * 1024, // 100MB
      enableMetrics: options.enableMetrics !== false,
      ...options,
    };

    this.cache = new Map();
    this.size = 0;
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
    };
  }

  async get(key) {
    const entry = this.cache.get(key);
    if (entry && entry.expiry > Date.now()) {
      if (this.options.enableMetrics) this.metrics.hits++;
      return entry.value;
    }

    if (entry) {
      // 删除过期项目
      this.cache.delete(key);
      this.size -= this.estimateSize(entry.value);
    }

    if (this.options.enableMetrics) this.metrics.misses++;
    return null;
  }

  async set(key, value, ttl = 300000) {
    const expiry = Date.now() + ttl;
    const valueSize = this.estimateSize(value);

    // 检查是否超过最大大小
    if (this.size + valueSize > this.options.maxSize) {
      await this.evict(this.size + valueSize - this.options.maxSize);
    }

    const entry = { value, expiry, size: valueSize };

    // 更新大小
    const oldEntry = this.cache.get(key);
    if (oldEntry) {
      this.size -= oldEntry.size;
    }

    this.cache.set(key, entry);
    this.size += valueSize;

    if (this.options.enableMetrics) this.metrics.sets++;
    return true;
  }

  async delete(key) {
    const entry = this.cache.get(key);
    if (entry) {
      this.cache.delete(key);
      this.size -= entry.size;
      if (this.options.enableMetrics) this.metrics.deletes++;
      return true;
    }
    return false;
  }

  async clear() {
    this.cache.clear();
    this.size = 0;
    return true;
  }

  async evict(bytesToFree) {
    // 简单的LRU清理策略
    const entries = Array.from(this.cache.entries()).sort(
      ([, a], [, b]) => a.expiry - b.expiry,
    ); // 按过期时间排序

    let freed = 0;
    for (const [key, entry] of entries) {
      if (freed >= bytesToFree) break;

      this.cache.delete(key);
      this.size -= entry.size;
      freed += entry.size;
      this.metrics.evictions++;
    }
  }

  async cleanup() {
    const now = Date.now();
    let evicted = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiry <= now) {
        this.cache.delete(key);
        this.size -= entry.size;
        evicted++;
        this.metrics.evictions++;
      }
    }

    return evicted;
  }

  estimateSize(value) {
    // 粗略估算对象大小
    if (typeof value === 'string') {
      return value.length * 2; // UTF-16
    } else if (typeof value === 'number') {
      return 8;
    } else if (typeof value === 'boolean') {
      return 1;
    } else if (value === null || value === undefined) {
      return 1;
    } else {
      // 对象或数组，转换为JSON估算
      try {
        const json = JSON.stringify(value);
        return json.length * 2;
      } catch (error) {
        return 1024; // 默认1KB
      }
    }
  }

  getStats() {
    return {
      size: this.size,
      maxSize: this.options.maxSize,
      entries: this.cache.size,
      utilization: this.size / this.options.maxSize,
      metrics: { ...this.metrics },
    };
  }

  async healthCheck() {
    return {
      status: 'healthy',
      size: this.size,
      entries: this.cache.size,
      utilization: this.size / this.options.maxSize,
    };
  }

  // =============== 高级缓存算法实现 ===============

  /**
   * 启动高级缓存管理器
   */
  startAdvancedCacheManager() {
    // 定期执行自适应调整
    setInterval(() => {
      this._performAdaptiveAdjustments();
    }, 60000); // 每分钟调整一次

    // 定期执行预取
    if (this.options.predictivePrefetch) {
      setInterval(() => {
        this._executePrefetchQueue();
      }, 30000); // 每30秒执行预取
    }

    // 定期执行层间迁移
    if (this.options.tieredStorage) {
      setInterval(() => {
        this._performTierMigration();
      }, 120000); // 每2分钟执行迁移
    }
  }

  /**
   * 智能层级缓存查找
   */
  async _intelligentCacheLookup(key, options) {
    // 首先尝试L1缓存
    let value = await this.layers.get('memory')?.get(key);
    if (value !== null) {
      this.metrics.hits++;
      this._updateRecencyScore(key);
      this._updateFrequencyScore(key);
      return value;
    }

    // L1未命中，尝试L2缓存
    if (this.layers.has('redis')) {
      value = await this.layers.get('redis')?.get(key);
      if (value !== null) {
        this.metrics.hits++;
        // 将数据提升到L1
        await this._promoteToHigherTier(key, value);
        this._updateRecencyScore(key);
        this._updateFrequencyScore(key);
        return value;
      }
    }

    // 所有层都未命中
    this.metrics.misses++;
    return null;
  }

  /**
   * 记录访问模式
   */
  _recordAccessPattern(key, operation, options) {
    const pattern = this.accessPatterns.get(key) || {
      key,
      operations: [],
      timestamps: [],
      accessCount: 0,
      lastAccessed: null,
      accessVelocity: 0, // 访问频率
    };

    pattern.operations.push(operation);
    pattern.timestamps.push(Date.now());
    pattern.accessCount++;
    pattern.lastAccessed = Date.now();

    // 计算访问速度（最近1分钟内的访问次数）
    const recentAccesses = pattern.timestamps.filter(t => Date.now() - t < 60000);
    pattern.accessVelocity = recentAccesses.length;

    // 保持操作历史大小
    if (pattern.operations.length > 100) {
      pattern.operations = pattern.operations.slice(-50);
      pattern.timestamps = pattern.timestamps.slice(-50);
    }

    this.accessPatterns.set(key, pattern);
  }

  /**
   * 检查预取队列
   */
  _checkPrefetchQueue(key) {
    const prefetched = this.prefetchQueue.find(item => item.key === key);
    if (prefetched && Date.now() - prefetched.timestamp < 30000) { // 30秒内有效
      this.prefetchQueue = this.prefetchQueue.filter(item => item.key !== key);
      return prefetched.value;
    }
    return null;
  }

  /**
   * 更新访问指标
   */
  _updateAccessMetrics(key, hit, accessTime) {
    // 更新命中率历史
    const currentHitRate = this.metrics.hits / (this.metrics.hits + this.metrics.misses);
    this.hitRateHistory.push(currentHitRate);

    if (this.hitRateHistory.length > 100) {
      this.hitRateHistory = this.hitRateHistory.slice(-50);
    }

    // 更新未命中惩罚历史
    if (!hit) {
      this.missPenaltyHistory.push(accessTime);
      if (this.missPenaltyHistory.length > 50) {
        this.missPenaltyHistory = this.missPenaltyHistory.slice(-25);
      }
    }
  }

  /**
   * 触发预测性预取
   */
  _triggerPredictivePrefetch(key, value) {
    const relationships = this.keyRelationships.get(key);
    if (relationships && relationships.length > 0) {
      // 基于关联规则预取相关键
      const prefetchCandidates = relationships
        .filter(rel => rel.confidence > 0.7) // 高置信度关联
        .slice(0, 3); // 最多预取3个

      for (const candidate of prefetchCandidates) {
        this.prefetchQueue.push({
          key: candidate.relatedKey,
          timestamp: Date.now(),
          priority: candidate.confidence,
        });
      }
    }
  }

  /**
   * 自适应TTL调整
   */
  _adjustTTLAdaptive(key, options) {
    const pattern = this.accessPatterns.get(key);
    if (!pattern || pattern.accessCount < 5) return;

    const currentTTL = options.ttl || this.options.defaultTtl;
    let newTTL = currentTTL;

    // 基于访问频率调整TTL
    if (pattern.accessVelocity > 10) { // 高频访问
      newTTL = Math.min(currentTTL * 1.5, this.options.defaultTtl * 3);
    } else if (pattern.accessVelocity < 2) { // 低频访问
      newTTL = Math.max(currentTTL * 0.8, this.options.defaultTtl * 0.5);
    }

    // 基于访问间隔调整TTL
    const avgInterval = this._calculateAverageAccessInterval(pattern);
    if (avgInterval < 30000) { // 30秒内频繁访问
      newTTL = Math.min(newTTL * 1.2, this.options.defaultTtl * 2);
    }

    // 更新TTL（需要底层缓存层支持）
    if (Math.abs(newTTL - currentTTL) > 10000) { // 变化超过10秒
      options.ttl = newTTL;
      logger.debug('自适应TTL调整', { key, oldTTL: currentTTL, newTTL });
    }
  }

  /**
   * 执行自适应调整
   */
  _performAdaptiveAdjustments() {
    try {
      // 调整驱逐策略
      this._adjustEvictionPolicy();

      // 优化预取策略
      this._optimizePrefetchStrategy();

      // 平衡层间存储
      this._balanceTierStorage();

      // 调整压缩策略
      this._adjustCompressionStrategy();

    } catch (error) {
      logger.error('自适应调整失败', error);
    }
  }

  /**
   * 调整驱逐策略
   */
  _adjustEvictionPolicy() {
    const currentHitRate = this._calculateCurrentHitRate();
    const avgHitRate = this.hitRateHistory.reduce((sum, rate) => sum + rate, 0) / this.hitRateHistory.length;

    // 如果命中率下降，考虑切换驱逐策略
    if (currentHitRate < avgHitRate * 0.9) {
      const newPolicy = this._selectOptimalEvictionPolicy();
      if (newPolicy !== this.options.evictionPolicy) {
        logger.info('切换驱逐策略', {
          from: this.options.evictionPolicy,
          to: newPolicy,
          hitRateChange: currentHitRate - avgHitRate,
        });
        this.options.evictionPolicy = newPolicy;
      }
    }
  }

  /**
   * 选择最优驱逐策略
   */
  _selectOptimalEvictionPolicy() {
    const policies = ['adaptive_lru', 'lfu', 'arc', 'clock', 'w_tiny_lfu'];
    const scores = {};

    // 基于当前工作负载特征选择策略
    const workloadPattern = this._analyzeWorkloadPattern();

    if (workloadPattern.isScanHeavy) {
      return 'arc'; // ARC适合扫描工作负载
    } else if (workloadPattern.isLooping) {
      return 'clock'; // Clock适合循环访问模式
    } else if (workloadPattern.hasTemporalLocality) {
      return 'adaptive_lru'; // 自适应LRU适合时间局部性
    } else {
      return 'w_tiny_lfu'; // W-TinyLFU适合一般情况
    }
  }

  /**
   * 优化预取策略
   */
  _optimizePrefetchStrategy() {
    const prefetchHitRate = this.metrics.prefetchHits /
                           (this.metrics.prefetchHits + this.metrics.prefetchMisses);

    if (prefetchHitRate < 0.3) {
      // 预取命中率太低，减少预取
      this.prefetchQueue = this.prefetchQueue.slice(0, Math.floor(this.prefetchQueue.length * 0.7));
    } else if (prefetchHitRate > 0.7) {
      // 预取命中率高，增加预取
      // 分析更多关联规则
      this._discoverKeyRelationships();
    }
  }

  /**
   * 执行层间迁移
   */
  _performTierMigration() {
    // 将热点数据从L2提升到L1
    const hotKeys = this._identifyHotKeys();
    for (const key of hotKeys.slice(0, 5)) { // 每次迁移最多5个
      this._migrateKeyToHigherTier(key);
    }

    // 将冷数据从L1降级到L2
    const coldKeys = this._identifyColdKeys();
    for (const key of coldKeys.slice(0, 3)) { // 每次降级最多3个
      this._migrateKeyToLowerTier(key);
    }
  }

  /**
   * 提升数据到更高层级
   */
  async _promoteToHigherTier(key, value) {
    // 将数据写入L1缓存
    await this.layers.get('memory')?.set(key, value);
    this.metrics.tierMigrations++;
  }

  /**
   * 识别热点键
   */
  _identifyHotKeys() {
    const now = Date.now();
    const candidates = [];

    for (const [key, pattern] of this.accessPatterns.entries()) {
      if (pattern.lastAccessed && (now - pattern.lastAccessed) < 300000) { // 最近5分钟内访问
        const score = pattern.accessVelocity * pattern.accessCount;
        candidates.push({ key, score });
      }
    }

    return candidates
      .sort((a, b) => b.score - a.score)
      .slice(0, 20) // Top 20
      .map(item => item.key);
  }

  /**
   * 识别冷键
   */
  _identifyColdKeys() {
    const now = Date.now();
    const candidates = [];

    for (const [key, pattern] of this.accessPatterns.entries()) {
      if (pattern.lastAccessed && (now - pattern.lastAccessed) > 1800000) { // 30分钟未访问
        const score = 1 / (pattern.accessCount + 1); // 访问次数越少，分数越高
        candidates.push({ key, score });
      }
    }

    return candidates
      .sort((a, b) => b.score - a.score)
      .slice(0, 10) // Top 10 cold keys
      .map(item => item.key);
  }

  /**
   * 迁移键到更高层级
   */
  async _migrateKeyToHigherTier(key) {
    // 从L2读取并写入L1
    const value = await this.layers.get('redis')?.get(key);
    if (value !== null) {
      await this.layers.get('memory')?.set(key, value);
      this.metrics.tierMigrations++;
    }
  }

  /**
   * 迁移键到更低层级
   */
  async _migrateKeyToLowerTier(key) {
    // 从L1移除，保持在L2
    await this.layers.get('memory')?.delete(key);
    this.metrics.tierMigrations++;
  }

  /**
   * 分析工作负载模式
   */
  _analyzeWorkloadPattern() {
    const recentPatterns = Array.from(this.accessPatterns.values())
      .filter(p => Date.now() - p.lastAccessed < 300000) // 最近5分钟
      .slice(-100); // 最近100个访问

    const scanOperations = recentPatterns.filter(p =>
      p.operations.includes('scan') || p.operations.length > 10
    ).length;

    const uniqueKeys = new Set(recentPatterns.map(p => p.key)).size;
    const totalAccesses = recentPatterns.reduce((sum, p) => sum + p.accessCount, 0);

    return {
      isScanHeavy: scanOperations / recentPatterns.length > 0.3,
      isLooping: uniqueKeys < totalAccesses * 0.1, // 循环访问同一组键
      hasTemporalLocality: this._calculateTemporalLocality(recentPatterns),
      accessDistribution: this._calculateAccessDistribution(recentPatterns),
    };
  }

  /**
   * 计算时间局部性
   */
  _calculateTemporalLocality(patterns) {
    if (patterns.length < 2) return 0;

    let localityScore = 0;
    for (let i = 1; i < patterns.length; i++) {
      const timeDiff = patterns[i].lastAccessed - patterns[i-1].lastAccessed;
      if (timeDiff < 1000) { // 1秒内的连续访问
        localityScore += 0.1;
      }
    }

    return Math.min(localityScore / patterns.length, 1);
  }

  /**
   * 计算访问分布
   */
  _calculateAccessDistribution(patterns) {
    const accessCounts = patterns.map(p => p.accessCount);
    const mean = accessCounts.reduce((sum, count) => sum + count, 0) / accessCounts.length;
    const variance = accessCounts.reduce((sum, count) => sum + Math.pow(count - mean, 2), 0) / accessCounts.length;

    return {
      mean,
      variance,
      coefficientOfVariation: Math.sqrt(variance) / mean,
    };
  }

  /**
   * 计算当前命中率
   */
  _calculateCurrentHitRate() {
    const total = this.metrics.hits + this.metrics.misses;
    return total > 0 ? this.metrics.hits / total : 0;
  }

  /**
   * 更新最近使用分数
   */
  _updateRecencyScore(key) {
    this.recencyScores.set(key, Date.now());
  }

  /**
   * 更新访问频率分数
   */
  _updateFrequencyScore(key) {
    const current = this.accessFrequency.get(key) || 0;
    this.accessFrequency.set(key, current + 1);
  }

  /**
   * 计算平均访问间隔
   */
  _calculateAverageAccessInterval(pattern) {
    if (pattern.timestamps.length < 2) return Infinity;

    const intervals = [];
    for (let i = 1; i < pattern.timestamps.length; i++) {
      intervals.push(pattern.timestamps[i] - pattern.timestamps[i-1]);
    }

    return intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
  }

  /**
   * 发现键关系
   */
  _discoverKeyRelationships() {
    // 简化的关联规则挖掘
    const transactions = [];
    const keySequences = new Map();

    // 基于访问时间窗口分组
    const timeWindows = new Map();
    for (const [key, pattern] of this.accessPatterns.entries()) {
      pattern.timestamps.forEach(timestamp => {
        const windowKey = Math.floor(timestamp / 60000); // 1分钟窗口
        if (!timeWindows.has(windowKey)) {
          timeWindows.set(windowKey, new Set());
        }
        timeWindows.get(windowKey).add(key);
      });
    }

    // 为每个时间窗口创建关联规则
    for (const [window, keys] of timeWindows.entries()) {
      if (keys.size >= 2) {
        const keyArray = Array.from(keys);
        for (let i = 0; i < keyArray.length; i++) {
          for (let j = i + 1; j < keyArray.length; j++) {
            const key1 = keyArray[i];
            const key2 = keyArray[j];

            const relationship = {
              key: key1,
              relatedKey: key2,
              confidence: 0.8, // 简化的置信度
              support: 1,
            };

            if (!this.keyRelationships.has(key1)) {
              this.keyRelationships.set(key1, []);
            }
            this.keyRelationships.get(key1).push(relationship);
          }
        }
      }
    }
  }

  /**
   * 执行预取队列
   */
  async _executePrefetchQueue() {
    if (this.prefetchQueue.length === 0) return;

    // 按优先级排序
    this.prefetchQueue.sort((a, b) => b.priority - a.priority);

    // 执行预取（限制并发数量）
    const batchSize = 3;
    for (let i = 0; i < Math.min(batchSize, this.prefetchQueue.length); i++) {
      const item = this.prefetchQueue[i];

      try {
        // 异步预取，不阻塞主流程
        setImmediate(async () => {
          const value = await this._intelligentCacheLookup(item.key, {});
          if (value !== null) {
            // 更新预取队列中的值
            const queueItem = this.prefetchQueue.find(q => q.key === item.key);
            if (queueItem) {
              queueItem.value = value;
              queueItem.fetched = true;
            }
          }
        });
      } catch (error) {
        this.metrics.prefetchMisses++;
      }
    }

    // 清理过期预取项
    this.prefetchQueue = this.prefetchQueue.filter(item =>
      Date.now() - item.timestamp < 60000 // 1分钟过期
    );
  }

  /**
   * 平衡层间存储
   */
  _balanceTierStorage() {
    const memoryLayer = this.layers.get('memory');
    const redisLayer = this.layers.get('redis');

    if (!memoryLayer || !redisLayer) return;

    const memoryUtilization = memoryLayer.size / this.options.maxMemorySize;

    // 如果内存使用率过高，将一些数据迁移到Redis
    if (memoryUtilization > 0.9) {
      const coldKeys = this._identifyColdKeys().slice(0, 10);
      for (const key of coldKeys) {
        this._migrateKeyToLowerTier(key);
      }
    }

    // 如果内存使用率过低，从Redis提升一些热点数据
    else if (memoryUtilization < 0.5) {
      const hotKeys = this._identifyHotKeys().slice(0, 5);
      for (const key of hotKeys) {
        this._migrateKeyToHigherTier(key);
      }
    }
  }

  /**
   * 调整压缩策略
   */
  _adjustCompressionStrategy() {
    if (!this.options.compressionEnabled) return;

    const compressionRatio = this._calculateCompressionRatio();

    // 如果压缩效果好，增加压缩使用
    if (compressionRatio > 2.0) {
      this.compressionStats.set('strategy', 'aggressive');
    }
    // 如果压缩效果差，减少压缩使用
    else if (compressionRatio < 1.2) {
      this.compressionStats.set('strategy', 'conservative');
    }
  }

  /**
   * 计算压缩比率
   */
  _calculateCompressionRatio() {
    const totalOriginal = Array.from(this.compressionStats.values())
      .reduce((sum, stat) => sum + (stat.originalSize || 0), 0);
    const totalCompressed = Array.from(this.compressionStats.values())
      .reduce((sum, stat) => sum + (stat.compressedSize || 0), 0);

    return totalCompressed > 0 ? totalOriginal / totalCompressed : 1;
  }

  /**
   * 获取高级缓存统计信息
   */
  getAdvancedStats() {
    const basicStats = this.getMetrics();
    const currentHitRate = this._calculateCurrentHitRate();
    const avgHitRate = this.hitRateHistory.length > 0
      ? this.hitRateHistory.reduce((sum, rate) => sum + rate, 0) / this.hitRateHistory.length
      : 0;

    const prefetchHitRate = this.metrics.prefetchHits /
                           Math.max(this.metrics.prefetchHits + this.metrics.prefetchMisses, 1);

    return {
      basic: basicStats,
      advanced: {
        currentHitRate,
        averageHitRate: avgHitRate,
        prefetchHitRate,
        compressionRatio: this._calculateCompressionRatio(),
        tierMigrations: this.metrics.tierMigrations,
        evictionPolicy: this.options.evictionPolicy,
        predictivePrefetch: this.options.predictivePrefetch,
        adaptiveTTL: this.options.adaptiveTTL,
        tieredStorage: this.options.tieredStorage,
        accessPatterns: this.accessPatterns.size,
        keyRelationships: this.keyRelationships.size,
        prefetchQueueLength: this.prefetchQueue.length,
        workloadPattern: this._analyzeWorkloadPattern(),
      },
      layerStats: this._getLayerStats(),
    };
  }

  /**
   * 获取层统计信息
   */
  _getLayerStats() {
    const stats = {};

    for (const [layerName, layer] of this.layers.entries()) {
      if (layer.healthCheck) {
        stats[layerName] = layer.healthCheck();
      }
    }

    return stats;
  }
}

// 简单的优先队列实现
class PriorityQueue {
  constructor() {
    this.items = [];
  }

  enqueue(item, priority) {
    this.items.push({ item, priority });
    this.items.sort((a, b) => b.priority - a.priority);
  }

  dequeue() {
    return this.items.shift()?.item;
  }

  isEmpty() {
    return this.items.length === 0;
  }

  size() {
    return this.items.length;
  }
}

export default CacheManager;
