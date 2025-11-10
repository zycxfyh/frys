/**
 * 缓存策略集合
 * 提供不同场景下的智能缓存策略
 */

export class CacheStrategies {
  constructor(cacheManager) {
    this.cacheManager = cacheManager;
    this.strategies = new Map();
    this.initializeStrategies();
  }

  /**
   * 初始化内置策略
   */
  initializeStrategies() {
    // 数据库查询缓存策略
    this.registerStrategy('database', {
      name: 'Database Query Cache',
      description: '缓存数据库查询结果，减少数据库压力',

      get: async (key, options) => {
        return await this.cacheManager.layers.get('memory').get(`db:${key}`);
      },

      set: async (key, value, options) => {
        // 数据库数据通常有较长的TTL
        const ttl = options.ttl || 10 * 60 * 1000; // 10分钟
        return await this.cacheManager.layers
          .get('memory')
          .set(`db:${key}`, value, ttl);
      },

      delete: async (key, options) => {
        return await this.cacheManager.layers.get('memory').delete(`db:${key}`);
      },

      clear: async (pattern, options) => {
        // 使相关缓存失效 - 这里简化实现，实际应该更复杂
        return true;
      },

      invalidate: async (pattern) => {
        // 使相关缓存失效
        return await this.cacheManager.clear(`db:${pattern}`);
      },
    });

    // API响应缓存策略
    this.registerStrategy('api', {
      name: 'API Response Cache',
      description: '缓存API响应，减少外部调用',

      get: async (key, options) => {
        return await this.cacheManager.layers.get('memory').get(`api:${key}`);
      },

      set: async (key, value, options) => {
        // API数据通常有中等TTL
        const ttl = options.ttl || 5 * 60 * 1000; // 5分钟
        return await this.cacheManager.layers
          .get('memory')
          .set(`api:${key}`, value, ttl);
      },

      delete: async (key, options) => {
        return await this.cacheManager.layers
          .get('memory')
          .delete(`api:${key}`);
      },

      clear: async (pattern, options) => {
        // 简化实现
        return true;
      },

      invalidate: async (endpoint) => {
        return await this.cacheManager.clear(`api:${endpoint}*`);
      },
    });

    // 用户会话缓存策略
    this.registerStrategy('session', {
      name: 'User Session Cache',
      description: '缓存用户会话数据，提升认证性能',

      get: async (key, options) => {
        return await this.cacheManager.layers
          .get('memory')
          .get(`session:${key}`);
      },

      set: async (key, value, options) => {
        // 会话数据TTL较短
        const ttl = options.ttl || 30 * 60 * 1000; // 30分钟
        return await this.cacheManager.layers
          .get('memory')
          .set(`session:${key}`, value, ttl);
      },

      delete: async (key, options) => {
        return await this.cacheManager.layers
          .get('memory')
          .delete(`session:${key}`);
      },

      clear: async (pattern, options) => {
        return true;
      },

      invalidate: async (userId) => {
        return await this.cacheManager.delete(`session:${userId}`);
      },
    });

    // 配置缓存策略
    this.registerStrategy('config', {
      name: 'Configuration Cache',
      description: '缓存配置数据，支持热更新',

      get: async (key, options) => {
        return await this.cacheManager.layers
          .get('memory')
          .get(`config:${key}`);
      },

      set: async (key, value, options) => {
        // 配置数据TTL较长
        const ttl = options.ttl || 60 * 60 * 1000; // 1小时
        return await this.cacheManager.layers
          .get('memory')
          .set(`config:${key}`, value, ttl);
      },

      delete: async (key, options) => {
        return await this.cacheManager.layers
          .get('memory')
          .delete(`config:${key}`);
      },

      clear: async (pattern, options) => {
        return true;
      },

      invalidate: async (namespace) => {
        return await this.cacheManager.clear(`config:${namespace}*`);
      },
    });

    // 页面缓存策略
    this.registerStrategy('page', {
      name: 'Page Cache',
      description: '缓存渲染后的页面内容',

      get: async (key, options) => {
        return await this.cacheManager.layers.get('memory').get(`page:${key}`);
      },

      set: async (key, value, options) => {
        // 页面缓存TTL中等
        const ttl = options.ttl || 15 * 60 * 1000; // 15分钟
        return await this.cacheManager.layers
          .get('memory')
          .set(`page:${key}`, value, ttl);
      },

      delete: async (key, options) => {
        return await this.cacheManager.layers
          .get('memory')
          .delete(`page:${key}`);
      },

      clear: async (pattern, options) => {
        return true;
      },

      invalidate: async (path) => {
        return await this.cacheManager.clear(`page:${path}*`);
      },
    });

    // 文件缓存策略
    this.registerStrategy('file', {
      name: 'File Cache',
      description: '缓存文件内容，减少文件I/O',

      get: async (key, options) => {
        return await this.cacheManager.layers.get('memory').get(`file:${key}`);
      },

      set: async (key, value, options) => {
        // 文件缓存TTL较长
        const ttl = options.ttl || 24 * 60 * 60 * 1000; // 24小时
        return await this.cacheManager.layers
          .get('memory')
          .set(`file:${key}`, value, ttl);
      },

      delete: async (key, options) => {
        return await this.cacheManager.layers
          .get('memory')
          .delete(`file:${key}`);
      },

      clear: async (pattern, options) => {
        return true;
      },

      invalidate: async (pattern) => {
        return await this.cacheManager.clear(`file:${pattern}`);
      },
    });

    // 计算结果缓存策略
    this.registerStrategy('computation', {
      name: 'Computation Cache',
      description: '缓存计算密集型操作的结果',

      get: async (key, options) => {
        return await this.cacheManager.layers.get('memory').get(`comp:${key}`);
      },

      set: async (key, value, options) => {
        // 计算结果TTL根据计算复杂度调整
        const baseTtl =
          options.complexity === 'high' ? 60 * 60 * 1000 : 30 * 60 * 1000;
        const ttl = options.ttl || baseTtl;
        return await this.cacheManager.layers
          .get('memory')
          .set(`comp:${key}`, value, ttl);
      },

      delete: async (key, options) => {
        return await this.cacheManager.layers
          .get('memory')
          .delete(`comp:${key}`);
      },

      clear: async (pattern, options) => {
        return true;
      },

      invalidate: async (functionName) => {
        return await this.cacheManager.clear(`comp:${functionName}*`);
      },
    });
  }

  /**
   * 注册缓存策略
   */
  registerStrategy(name, strategy) {
    this.strategies.set(name, {
      ...strategy,
      registeredAt: new Date().toISOString(),
    });
  }

  /**
   * 获取缓存策略
   */
  getStrategy(name) {
    return this.strategies.get(name);
  }

  /**
   * 获取所有策略名称
   */
  getStrategyNames() {
    return Array.from(this.strategies.keys());
  }

  /**
   * 创建智能缓存策略
   */
  createSmartStrategy(options = {}) {
    return {
      name: 'Smart Cache Strategy',
      description: '根据访问模式智能调整缓存行为',

      get: async (key, getOptions) => {
        const strategy = this.selectStrategy(key, getOptions);
        return await strategy.get(key, getOptions);
      },

      set: async (key, value, setOptions) => {
        const strategy = this.selectStrategy(key, setOptions);

        // 使用智能过期
        return await this.cacheManager.setWithSmartExpiry(
          `${strategy.prefix || ''}${key}`,
          value,
          setOptions,
        );
      },

      delete: async (key, deleteOptions) => {
        // 尝试所有相关策略
        const results = [];
        for (const [name, strategy] of this.strategies) {
          try {
            const result = await strategy.delete(key, deleteOptions);
            results.push({ strategy: name, result });
          } catch (error) {
            results.push({
              strategy: name,
              result: false,
              error: error.message,
            });
          }
        }
        return results.some((r) => r.result);
      },

      clear: async (pattern, clearOptions) => {
        const results = [];
        for (const [name, strategy] of this.strategies) {
          try {
            const result = await strategy.clear(pattern, clearOptions);
            results.push({ strategy: name, result });
          } catch (error) {
            results.push({
              strategy: name,
              result: false,
              error: error.message,
            });
          }
        }
        return results;
      },
    };
  }

  /**
   * 根据键和选项选择最合适的策略
   */
  selectStrategy(key, options) {
    // 基于键的模式匹配
    if (key.startsWith('user:') || key.includes('session')) {
      return this.strategies.get('session');
    } else if (key.startsWith('api:') || key.includes('endpoint')) {
      return this.strategies.get('api');
    } else if (key.startsWith('db:') || key.includes('query')) {
      return this.strategies.get('database');
    } else if (key.startsWith('config:')) {
      return this.strategies.get('config');
    } else if (key.startsWith('page:')) {
      return this.strategies.get('page');
    } else if (key.startsWith('file:')) {
      return this.strategies.get('file');
    } else if (key.startsWith('comp:')) {
      return this.strategies.get('computation');
    }

    // 默认策略
    return this.cacheManager.defaultStrategy;
  }

  /**
   * 创建基于访问模式的策略
   */
  createAccessPatternStrategy(pattern) {
    const patterns = {
      read_heavy: {
        ttlMultiplier: 2.0,
        description: '读密集型，延长TTL',
      },
      write_heavy: {
        ttlMultiplier: 0.5,
        description: '写密集型，缩短TTL',
      },
      bursty: {
        ttlMultiplier: 1.5,
        description: '突发访问，适度延长TTL',
      },
      steady: {
        ttlMultiplier: 1.0,
        description: '稳定访问，标准TTL',
      },
    };

    const config = patterns[pattern] || patterns.steady;

    return {
      name: `Access Pattern: ${pattern}`,
      description: config.description,

      get: async (key, options) => {
        return await this.cacheManager.get(key, options);
      },

      set: async (key, value, options) => {
        const adjustedTtl = (options.ttl || 300000) * config.ttlMultiplier;
        return await this.cacheManager.set(key, value, {
          ...options,
          ttl: adjustedTtl,
          accessPattern: pattern,
        });
      },

      delete: async (key, options) => {
        return await this.cacheManager.delete(key, options);
      },

      clear: async (pattern, options) => {
        return await this.cacheManager.clear(pattern, options);
      },
    };
  }

  /**
   * 创建基于数据新鲜度的策略
   */
  createFreshnessStrategy(freshness) {
    const freshnessLevels = {
      realtime: {
        ttl: 60 * 1000, // 1分钟
        description: '实时数据，TTL很短',
      },
      fresh: {
        ttl: 5 * 60 * 1000, // 5分钟
        description: '新鲜数据，TTL较短',
      },
      normal: {
        ttl: 30 * 60 * 1000, // 30分钟
        description: '正常数据，标准TTL',
      },
      stale_ok: {
        ttl: 2 * 60 * 60 * 1000, // 2小时
        description: '允许过期，TTL较长',
      },
    };

    const config = freshnessLevels[freshness] || freshnessLevels.normal;

    return {
      name: `Freshness: ${freshness}`,
      description: config.description,

      get: async (key, options) => {
        return await this.cacheManager.get(key, options);
      },

      set: async (key, value, options) => {
        return await this.cacheManager.set(key, value, {
          ...options,
          ttl: config.ttl,
        });
      },

      delete: async (key, options) => {
        return await this.cacheManager.delete(key, options);
      },

      clear: async (pattern, options) => {
        return await this.cacheManager.clear(pattern, options);
      },
    };
  }

  /**
   * 创建复合策略
   */
  createCompositeStrategy(strategies, combiner = 'first') {
    return {
      name: 'Composite Strategy',
      description: `组合策略: ${strategies.join(', ')}`,

      get: async (key, options) => {
        if (combiner === 'first') {
          // 第一个成功的结果
          for (const strategyName of strategies) {
            const strategy = this.strategies.get(strategyName);
            if (strategy) {
              try {
                const result = await strategy.get(key, options);
                if (result !== null) {
                  return result;
                }
              } catch (error) {
                // 继续尝试下一个策略
              }
            }
          }
          return null;
        } else if (combiner === 'all') {
          // 返回所有策略的结果
          const results = [];
          for (const strategyName of strategies) {
            const strategy = this.strategies.get(strategyName);
            if (strategy) {
              try {
                const result = await strategy.get(key, options);
                results.push({ strategy: strategyName, result });
              } catch (error) {
                results.push({
                  strategy: strategyName,
                  result: null,
                  error: error.message,
                });
              }
            }
          }
          return results;
        }
      },

      set: async (key, value, options) => {
        const results = [];
        for (const strategyName of strategies) {
          const strategy = this.strategies.get(strategyName);
          if (strategy) {
            try {
              const result = await strategy.set(key, value, options);
              results.push({ strategy: strategyName, success: result });
            } catch (error) {
              results.push({
                strategy: strategyName,
                success: false,
                error: error.message,
              });
            }
          }
        }
        return results.every((r) => r.success);
      },

      delete: async (key, options) => {
        const results = [];
        for (const strategyName of strategies) {
          const strategy = this.strategies.get(strategyName);
          if (strategy) {
            try {
              const result = await strategy.delete(key, options);
              results.push({ strategy: strategyName, deleted: result });
            } catch (error) {
              results.push({
                strategy: strategyName,
                deleted: false,
                error: error.message,
              });
            }
          }
        }
        return results.some((r) => r.deleted);
      },

      clear: async (pattern, options) => {
        const results = [];
        for (const strategyName of strategies) {
          const strategy = this.strategies.get(strategyName);
          if (strategy) {
            try {
              const result = await strategy.clear(pattern, options);
              results.push({ strategy: strategyName, cleared: result });
            } catch (error) {
              results.push({
                strategy: strategyName,
                cleared: false,
                error: error.message,
              });
            }
          }
        }
        return results;
      },
    };
  }

  /**
   * 获取策略统计
   */
  getStrategyStats() {
    const stats = {};

    for (const [name, strategy] of this.strategies) {
      stats[name] = {
        name: strategy.name,
        description: strategy.description,
        registeredAt: strategy.registeredAt,
      };
    }

    return stats;
  }

  /**
   * 导出策略配置
   */
  exportStrategies() {
    const exported = {};

    for (const [name, strategy] of this.strategies) {
      exported[name] = {
        name: strategy.name,
        description: strategy.description,
        config: strategy.config || {},
      };
    }

    return exported;
  }

  /**
   * 导入策略配置
   */
  importStrategies(config) {
    for (const [name, strategyConfig] of Object.entries(config)) {
      if (strategyConfig.type === 'access_pattern') {
        this.registerStrategy(
          name,
          this.createAccessPatternStrategy(strategyConfig.pattern),
        );
      } else if (strategyConfig.type === 'freshness') {
        this.registerStrategy(
          name,
          this.createFreshnessStrategy(strategyConfig.freshness),
        );
      } else if (strategyConfig.type === 'composite') {
        this.registerStrategy(
          name,
          this.createCompositeStrategy(
            strategyConfig.strategies,
            strategyConfig.combiner,
          ),
        );
      }
    }
  }
}

export default CacheStrategies;
