/**
 * 缓存装饰器
 * 为方法和类提供声明式的缓存功能
 */

import { logger } from '../logger.js';

/**
 * 方法缓存装饰器
 */
export function Cached(options = {}) {
  return function (target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;
    const cacheKeyPrefix =
      options.keyPrefix || `${target.constructor.name}.${propertyKey}`;
    const ttl = options.ttl || 300000; // 5分钟默认TTL
    const strategy = options.strategy || 'default';

    // 为类实例创建缓存存储
    if (!target._cacheStore) {
      target._cacheStore = new Map();
    }

    descriptor.value = async function (...args) {
      // 生成缓存键
      const cacheKey = generateCacheKey(
        cacheKeyPrefix,
        args,
        options.keyGenerator,
      );

      // 检查缓存
      if (target._cacheStore.has(cacheKey)) {
        const cached = target._cacheStore.get(cacheKey);
        if (cached.expiry > Date.now()) {
          logger.debug(`缓存命中: ${cacheKey}`);
          return cached.value;
        } else {
          // 删除过期缓存
          target._cacheStore.delete(cacheKey);
        }
      }

      // 执行原方法
      logger.debug(`缓存未命中，执行方法: ${propertyKey}`);
      const startTime = Date.now();
      const result = await originalMethod.apply(this, args);
      const executionTime = Date.now() - startTime;

      // 缓存结果
      const expiry = Date.now() + ttl;
      target._cacheStore.set(cacheKey, {
        value: result,
        expiry,
        executionTime,
      });

      // 记录缓存操作
      if (options.enableMetrics) {
        logger.debug(`方法缓存: ${propertyKey}`, {
          cacheKey,
          executionTime,
          ttl,
          strategy,
        });
      }

      return result;
    };

    return descriptor;
  };
}

/**
 * 条件缓存装饰器
 */
export function ConditionalCache(conditionFn, options = {}) {
  return function (target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;
    const cachedDecorator = Cached(options);

    descriptor.value = async function (...args) {
      // 检查条件
      const shouldCache = await conditionFn.apply(this, args);

      if (shouldCache) {
        // 应用缓存装饰器
        return cachedDecorator(target, propertyKey, descriptor).value.apply(
          this,
          args,
        );
      } else {
        // 直接执行原方法
        return originalMethod.apply(this, args);
      }
    };

    return descriptor;
  };
}

/**
 * 缓存失效装饰器
 */
export function CacheInvalidate(pattern, options = {}) {
  return function (target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args) {
      // 执行原方法
      const result = await originalMethod.apply(this, args);

      // 失效相关缓存
      try {
        if (target._cacheStore) {
          const keysToDelete = [];

          for (const [key] of target._cacheStore) {
            if (matchesPattern(key, pattern)) {
              keysToDelete.push(key);
            }
          }

          keysToDelete.forEach((key) => target._cacheStore.delete(key));

          if (keysToDelete.length > 0) {
            logger.debug(`缓存失效: ${keysToDelete.length} 个项目`, {
              pattern,
              method: propertyKey,
            });
          }
        }
      } catch (error) {
        logger.error('缓存失效失败', error);
      }

      return result;
    };

    return descriptor;
  };
}

/**
 * 类级缓存装饰器
 */
export function Cacheable(options = {}) {
  return function (target) {
    // 为类添加缓存管理方法
    target.prototype.clearCache = function (pattern = null) {
      if (!this._cacheStore) return;

      if (pattern) {
        const keysToDelete = [];
        for (const [key] of this._cacheStore) {
          if (matchesPattern(key, pattern)) {
            keysToDelete.push(key);
          }
        }
        keysToDelete.forEach((key) => this._cacheStore.delete(key));
      } else {
        this._cacheStore.clear();
      }
    };

    target.prototype.getCacheStats = function () {
      if (!this._cacheStore) {
        return { entries: 0, size: 0 };
      }

      return {
        entries: this._cacheStore.size,
        keys: Array.from(this._cacheStore.keys()),
      };
    };

    // 设置缓存配置
    target._cacheConfig = options;
  };
}

/**
 * 缓存预热装饰器
 */
export function CacheWarmup(keysGenerator, options = {}) {
  return function (target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;

    // 添加预热方法
    target[
      `warmup${propertyKey.charAt(0).toUpperCase() + propertyKey.slice(1)}`
    ] = async function (...args) {
      try {
        const keys = await keysGenerator.apply(this, args);

        logger.info(`开始预热缓存: ${propertyKey}`, { keysCount: keys.length });

        const results = [];
        for (const key of keys) {
          try {
            const result = await originalMethod.apply(this, [key]);
            results.push({ key, success: true, result });
          } catch (error) {
            results.push({ key, success: false, error: error.message });
          }
        }

        const successful = results.filter((r) => r.success).length;
        logger.info(`缓存预热完成: ${successful}/${keys.length} 成功`);

        return results;
      } catch (error) {
        logger.error('缓存预热失败', error);
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * 生成缓存键
 */
function generateCacheKey(prefix, args, keyGenerator) {
  if (keyGenerator) {
    return keyGenerator(...args);
  }

  // 默认键生成策略
  const argsKey =
    args.length > 0
      ? args
          .map((arg) => {
            if (typeof arg === 'object' && arg !== null) {
              // 对对象参数进行序列化
              try {
                return JSON.stringify(arg);
              } catch (error) {
                return String(arg);
              }
            }
            return String(arg);
          })
          .join(':')
      : 'no-args';

  return `${prefix}:${argsKey}`;
}

/**
 * 模式匹配
 */
function matchesPattern(key, pattern) {
  if (typeof pattern === 'string') {
    // 简单字符串匹配
    return key.includes(pattern);
  } else if (pattern instanceof RegExp) {
    // 正则表达式匹配
    return pattern.test(key);
  } else if (typeof pattern === 'function') {
    // 函数匹配
    return pattern(key);
  }

  return false;
}

/**
 * 创建缓存键生成器
 */
export function createKeyGenerator(template) {
  return (...args) => {
    return template.replace(/{(\d+)}/g, (match, index) => {
      const argIndex = parseInt(index);
      return args[argIndex] !== undefined ? String(args[argIndex]) : match;
    });
  };
}

/**
 * 创建条件函数
 */
export function createCacheCondition(condition) {
  if (typeof condition === 'function') {
    return condition;
  }

  if (typeof condition === 'object') {
    return (result) => {
      // 检查结果是否满足条件
      for (const [key, expected] of Object.entries(condition)) {
        if (result[key] !== expected) {
          return false;
        }
      }
      return true;
    };
  }

  return () => Boolean(condition);
}
