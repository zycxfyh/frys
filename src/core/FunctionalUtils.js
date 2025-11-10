/**
 * 函数式编程工具函数
 * 提供管道、柯里化、记忆化等函数式编程原语
 */

import { logger } from '../../shared/utils/logger.js';

/**
 * 管道函数 - 从左到右执行函数组合
 * @param {...Function} fns - 要组合的函数
 * @returns {Function} 组合后的函数
 */
export function pipe(...fns) {
  return (x) => fns.reduce((v, f) => f(v), x);
}

/**
 * 函数柯里化
 * @param {Function} fn - 要柯里化的函数
 * @returns {Function} 柯里化后的函数
 */
export function curry(fn) {
  return function curried(...args) {
    if (args.length >= fn.length) {
      return fn.apply(this, args);
    } else {
      return function (...args2) {
        return curried.apply(this, args.concat(args2));
      };
    }
  };
}

/**
 * 函数记忆化 - 缓存函数结果以提高性能
 * @param {Function} fn - 要记忆化的函数
 * @param {Function} getKey - 可选的缓存键生成函数
 * @returns {Function} 记忆化后的函数
 */
export function memoize(fn, getKey = null) {
  const cache = new Map();

  return function (...args) {
    const key = getKey ? getKey.apply(this, args) : JSON.stringify(args);

    if (cache.has(key)) {
      logger.debug('Memoize cache hit', { key });
      return cache.get(key);
    }

    const result = fn.apply(this, args);
    cache.set(key, result);

    // 限制缓存大小，防止内存泄漏
    if (cache.size > 1000) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }

    logger.debug('Memoize cache miss', { key });
    return result;
  };
}

/**
 * 函数组合 - 从右到左执行函数组合
 * @param {...Function} fns - 要组合的函数
 * @returns {Function} 组合后的函数
 */
export function compose(...fns) {
  return (x) => fns.reduceRight((v, f) => f(v), x);
}

/**
 * 部分应用函数
 * @param {Function} fn - 目标函数
 * @param {...*} presetArgs - 预设的参数
 * @returns {Function} 部分应用后的函数
 */
export function partial(fn, ...presetArgs) {
  return (...laterArgs) => fn(...presetArgs, ...laterArgs);
}

/**
 * 函数节流 - 限制函数调用频率
 * @param {Function} fn - 要节流的函数
 * @param {number} delay - 延迟时间（毫秒）
 * @returns {Function} 节流后的函数
 */
export function throttle(fn, delay) {
  let lastCall = 0;
  return function (...args) {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      return fn.apply(this, args);
    }
  };
}

/**
 * 函数防抖 - 延迟函数执行
 * @param {Function} fn - 要防抖的函数
 * @param {number} delay - 延迟时间（毫秒）
 * @returns {Function} 防抖后的函数
 */
export function debounce(fn, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * 创建惰性求值函数
 * @param {Function} fn - 要延迟执行的函数
 * @returns {Function} 惰性求值函数
 */
export function lazy(fn) {
  let result;
  let computed = false;

  return () => {
    if (!computed) {
      result = fn();
      computed = true;
    }
    return result;
  };
}

/**
 * 创建条件执行函数
 * @param {Function} predicate - 条件函数
 * @param {Function} fn - 要执行的函数
 * @returns {Function} 条件执行函数
 */
export function when(predicate, fn) {
  return function (...args) {
    if (predicate.apply(this, args)) {
      return fn.apply(this, args);
    }
    return undefined;
  };
}

/**
 * 函数执行时间测量
 * @param {Function} fn - 要测量的函数
 * @returns {Function} 包装后的函数
 */
export function withTiming(fn) {
  return function (...args) {
    const start = performance.now();
    const result = fn.apply(this, args);
    const end = performance.now();

    logger.info('Function execution timing', {
      function: fn.name,
      duration: `${(end - start).toFixed(3)}ms`,
      args: args.length,
    });

    return result;
  };
}
