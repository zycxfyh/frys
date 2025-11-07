/**
 * 多级缓存管理器
 * 支持内存缓存、Redis缓存和自定义缓存策略
 */

import { logger } from '../../utils/logger.js';

export class CacheManager {
  constructor(options = {}) {
    this.options = {
      defaultTtl: options.defaultTtl || 300000, // 5分钟默认TTL
      maxMemorySize: options.maxMemorySize || 100 * 1024 * 1024, // 100MB
      enableRedis: options.enableRedis || false,
      redisUrl: options.redisUrl || 'redis://localhost:6379',
      enableMetrics: options.enableMetrics !== false,
      ...options,
    };

    this.layers = new Map();
    this.strategies = new Map();
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
    };

    // 初始化缓存层
    this.initializeLayers();

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
    const strategy = options.strategy || 'default';
    const strategyImpl = this.strategies.get(strategy) || this.defaultStrategy;

    return await strategyImpl.get.call(this, key, options);
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
}

export default CacheManager;
