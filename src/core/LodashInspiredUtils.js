/**
 * Lodash 风格的工具函数库 (函数式编程增强版)
 * 借鉴 Lodash 的函数式编程和性能优化理念
 */

import { BaseModule } from './BaseModule.js';
import { frysError } from './error-handler.js';
import { pipe, curry, memoize, compose } from './FunctionalUtils.js';
import { logger } from '../utils/logger.js';

class LodashInspiredUtils extends BaseModule {
  getDefaultConfig() {
    return {
      ...super.getDefaultConfig(),
      enableStats: true,
      maxCacheSize: 1000,
      performanceTracking: true,
    };
  }

  constructor() {
    super('utils');
  }

  async onInitialize() {
    this.operations = [];
    this.cache = new Map();
    this.performanceStats = {
      totalOperations: 0,
      avgExecutionTime: 0,
      cacheHits: 0,
      cacheMisses: 0,
    };

    // 创建函数式组合工具
    // this.chain = this.createChain(); // 移除这个，直接使用方法
    this.compose = compose;
    this.pipe = pipe;
    this.curry = curry;
    this.memoize = memoize;

    logger.info('函数式工具库已初始化');
  }

  async onDestroy() {
    this.operations = [];
    this.cache.clear();
    this.performanceStats = {};
  }

  uniq(array) {
    if (!Array.isArray(array)) {
      throw frysError.validation('Input must be an array', 'array');
    }

    const startTime = Date.now();

    // 函数式实现：使用Set进行去重
    const seen = new Set();
    const result = array.filter((item) => {
      let key;
      if (typeof item === 'object' && item !== null) {
        try {
          key = JSON.stringify(item);
        } catch (error) {
          key = item;
        }
      } else {
        key = item;
      }

      if (!seen.has(key)) {
        seen.add(key);
        return true;
      }
      return false;
    });

    this._recordOperation(
      'uniq',
      array.length,
      result.length,
      Date.now() - startTime,
    );
    return result;
  }

  /**
   * 记录操作统计
   */
  _recordOperation(type, inputSize, outputSize, executionTime) {
    if (!this.config.enableStats) return;

    this.operations.push({
      type,
      inputSize,
      outputSize,
      executionTime,
      timestamp: Date.now(),
    });

    // 限制操作历史长度
    if (this.operations.length > 1000) {
      this.operations = this.operations.slice(-500);
    }

    // 更新性能统计
    if (this.config.performanceTracking) {
      this.performanceStats.totalOperations++;
      this.performanceStats.avgExecutionTime =
        (this.performanceStats.avgExecutionTime + executionTime) /
        this.performanceStats.totalOperations;
    }
  }

  groupBy(array, iteratee) {
    if (!Array.isArray(array)) {
      throw frysError.validation('Input must be an array', 'array');
    }

    const startTime = Date.now();

    // 函数式实现：使用reduce进行分组
    const fn =
      typeof iteratee === 'function' ? iteratee : (item) => item[iteratee];

    const result = array.reduce((groups, item) => {
      const key = fn(item);
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(item);
      return groups;
    }, {});

    const groupCount = Object.keys(result).length;
    this._recordOperation(
      'groupBy',
      array.length,
      groupCount,
      Date.now() - startTime,
    );

    return result;
  }

  /**
   * 创建链式调用对象
   */
  createChain(value) {
    const chain = {
      _value: value,
      get value() {
        return this._value;
      },
      set value(newValue) {
        this._value = newValue;
      },
      through: (fn) => {
        chain._value = fn(chain._value);
        return chain;
      },
      map: (fn) => {
        chain._value = Array.isArray(chain._value)
          ? chain._value.map(fn)
          : fn(chain._value);
        return chain;
      },
      filter: (fn) => {
        if (Array.isArray(chain._value)) {
          chain._value = chain._value.filter(fn);
        }
        return chain;
      },
      reduce: (fn, initial) => {
        if (Array.isArray(chain._value)) {
          chain._value = chain._value.reduce(fn, initial);
        }
        return chain;
      },
      uniq: () => {
        if (Array.isArray(chain._value)) {
          const uniqueItems = [];
          const seen = new Set();
          for (const item of chain._value) {
            const key = typeof item === 'object' ? JSON.stringify(item) : item;
            if (!seen.has(key)) {
              seen.add(key);
              uniqueItems.push(item);
            }
          }
          chain._value = uniqueItems;
        }
        return chain;
      },
      groupBy: (iteratee) => {
        if (Array.isArray(chain._value)) {
          const groups = {};
          for (const item of chain._value) {
            const key =
              typeof iteratee === 'function' ? iteratee(item) : item[iteratee];
            if (!groups[key]) {
              groups[key] = [];
            }
            groups[key].push(item);
          }
          chain._value = groups;
        }
        return chain;
      },
      // Alias methods for compatibility
      getValue() {
        return chain.value;
      },
      get() {
        return chain._value;
      },
      commit() {
        return chain.value;
      },
    };
    return chain;
  }

  /**
   * 函数式管道操作
   */
  pipeline(...fns) {
    return (value) => pipe(...fns)(value);
  }

  /**
   * 函数组合
   */
  combine(...fns) {
    return (value) => pipe(...fns)(value);
  }

  /**
   * 条件执行
   */
  when(condition, trueFn, falseFn = (x) => x) {
    return (value) => (condition(value) ? trueFn(value) : falseFn(value));
  }

  /**
   * 批量映射
   */
  map(collection, iteratee) {
    if (!collection) return [];

    const fn =
      typeof iteratee === 'function' ? iteratee : (item) => item[iteratee];

    if (Array.isArray(collection)) {
      return collection.map(fn);
    }

    if (typeof collection === 'object') {
      return Object.keys(collection).map((key) => fn(collection[key], key));
    }

    return [];
  }

  /**
   * 批量过滤
   */
  filter(collection, predicate) {
    if (!collection) return [];

    if (Array.isArray(collection)) {
      return collection.filter(predicate);
    }

    if (typeof collection === 'object') {
      const result = {};
      Object.keys(collection).forEach((key) => {
        if (predicate(collection[key], key)) {
          result[key] = collection[key];
        }
      });
      return result;
    }

    return [];
  }

  /**
   * 查找元素
   */
  find(collection, predicate, defaultValue = undefined) {
    if (!collection) return defaultValue;

    if (Array.isArray(collection)) {
      return collection.find(predicate) || defaultValue;
    }

    if (typeof collection === 'object') {
      for (const [key, value] of Object.entries(collection)) {
        if (predicate(value, key)) {
          return value;
        }
      }
    }

    return defaultValue;
  }

  /**
   * 深度克隆 (函数式实现)
   */
  cloneDeep(obj) {
    if (obj === null || obj === undefined) {
      return obj;
    }

    const startTime = Date.now();

    try {
      const result = JSON.parse(JSON.stringify(obj));
      const inputSize = JSON.stringify(obj).length;

      this._recordOperation(
        'cloneDeep',
        inputSize,
        inputSize,
        Date.now() - startTime,
      );
      return result;
    } catch (error) {
      let inputSize = -1;
      try {
        inputSize = JSON.stringify(obj).length;
      } catch (e) {
        // 无法序列化的对象
      }

      this._recordOperation('cloneDeep', inputSize, 0, Date.now() - startTime);

      if (error.message.includes('Converting circular structure to JSON')) {
        throw frysError.validation(
          'Object is not serializable',
          'circular_reference',
        );
      }

      throw frysError.system('深度克隆失败', 'clone_error');
    }
  }

  /**
   * 健康检查
   */
  async onHealthCheck() {
    const operationCount = this.operations.length;
    const cacheSize = this.cache.size;
    const avgExecutionTime = this.performanceStats.avgExecutionTime;

    return {
      operations: operationCount,
      cacheSize,
      avgExecutionTime: Math.round(avgExecutionTime * 100) / 100,
      cacheEfficiency:
        cacheSize > 0
          ? (this.performanceStats.cacheHits /
              (this.performanceStats.cacheHits +
                this.performanceStats.cacheMisses)) *
            100
          : 0,
      status: operationCount >= 0 ? 'healthy' : 'error',
    };
  }

  /**
   * 获取统计信息
   */
  getStats() {
    const operationTypes = [...new Set(this.operations.map((op) => op.type))];
    const operationCounts = operationTypes.reduce((acc, type) => {
      acc[type] = this.operations.filter((op) => op.type === type).length;
      return acc;
    }, {});

    return {
      operations: this.operations.length,
      types: operationTypes,
      operationTypes,
      operationCounts,
      performance: this.performanceStats,
      cacheSize: this.cache.size,
      config: this.config.enableStats ? this.config : '[hidden]',
    };
  }

  /**
   * 清空缓存
   */
  clearCache() {
    this.cache.clear();
    this.performanceStats.cacheHits = 0;
    this.performanceStats.cacheMisses = 0;
    logger.info('工具库缓存已清空');
  }

  /**
   * 创建链式调用对象
   * @param {*} value - 初始值
   * @returns {Object} 链式调用对象
   */
  chain(value) {
    return this.createChain(value);
  }

  /**
   * 重置统计信息
   */
  resetStats() {
    this.operations = [];
    this.performanceStats = {
      totalOperations: 0,
      avgExecutionTime: 0,
      cacheHits: 0,
      cacheMisses: 0,
    };
    logger.info('工具库统计信息已重置');
  }
}

export default LodashInspiredUtils;
