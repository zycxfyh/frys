/**
 * frys 轻量级核心 - 函数式编程工具
 * 提供现代化的函数式编程模式和工具函数
 */

/**
 * 函数组合
 */
export const compose =
  (...fns) =>
  (x) =>
    fns.reduceRight((v, f) => f(v), x);

/**
 * 函数管道
 */
export const pipe =
  (...fns) =>
  (x) =>
    fns.reduce((v, f) => f(v), x);

/**
 * 柯里化
 */
export const curry = (fn, arity = fn.length) => {
  return function curried(...args) {
    if (args.length >= arity) {
      return fn(...args);
    }
    return (...moreArgs) => curried(...args, ...moreArgs);
  };
};

/**
 * 部分应用
 */
export const partial =
  (fn, ...presetArgs) =>
  (...laterArgs) =>
    fn(...presetArgs, ...laterArgs);

/**
 * 记忆化
 */
export const memoize = (fn, getKey = (...args) => JSON.stringify(args)) => {
  const cache = new Map();
  return (...args) => {
    const key = getKey(...args);
    if (cache.has(key)) {
      return cache.get(key);
    }
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
};

/**
 * 防抖
 */
export const debounce = (fn, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};

/**
 * 节流
 */
export const throttle = (fn, limit) => {
  let inThrottle;
  return (...args) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

/**
 * 重试机制
 */
export const retry = async (fn, maxAttempts = 3, delay = 1000) => {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
};

/**
 * 条件执行
 */
export const when = (condition, fn) => (x) => (condition(x) ? fn(x) : x);

/**
 * 条件分支
 */
export const cond = (pairs) => (x) => {
  for (const [condition, fn] of pairs) {
    if (condition(x)) {
      return fn(x);
    }
  }
  return x;
};

/**
 * 空值检查
 */
export const isNil = (x) => x === null || x === undefined;

/**
 * 非空检查
 */
export const isNotNil = (x) => !isNil(x);

/**
 * 类型检查
 */
export const isType = (type) => (x) => typeof x === type;

/**
 * 数组检查
 */
export const isArray = Array.isArray;

/**
 * 对象检查
 */
export const isObject = (x) =>
  typeof x === 'object' && x !== null && !Array.isArray(x);

/**
 * 函数检查
 */
export const isFunction = isType('function');

/**
 * 字符串检查
 */
export const isString = isType('string');

/**
 * 数字检查
 */
export const isNumber = (x) => isType('number')(x) && !isNaN(x);

/**
 * 布尔值检查
 */
export const isBoolean = isType('boolean');

/**
 * Maybe Monad 简单实现
 */
export class Maybe {
  constructor(value) {
    this.value = value;
  }

  static of(value) {
    return new Maybe(value);
  }

  static empty() {
    return new Maybe(null);
  }

  isEmpty() {
    return isNil(this.value);
  }

  map(fn) {
    return this.isEmpty() ? Maybe.empty() : Maybe.of(fn(this.value));
  }

  flatMap(fn) {
    return this.isEmpty() ? Maybe.empty() : fn(this.value);
  }

  getOrElse(defaultValue) {
    return this.isEmpty() ? defaultValue : this.value;
  }

  orElse(fn) {
    return this.isEmpty() ? fn() : this;
  }
}

/**
 * Either Monad 简单实现
 */
export class Either {
  constructor(left, right) {
    this.left = left;
    this.right = right;
  }

  static left(value) {
    return new Either(value, null);
  }

  static right(value) {
    return new Either(null, value);
  }

  isLeft() {
    return this.left !== null;
  }

  isRight() {
    return this.right !== null;
  }

  map(fn) {
    return this.isLeft() ? this : Either.right(fn(this.right));
  }

  flatMap(fn) {
    return this.isLeft() ? this : fn(this.right);
  }

  getOrElse(defaultValue) {
    return this.isLeft() ? defaultValue : this.right;
  }

  fold(leftFn, rightFn) {
    return this.isLeft() ? leftFn(this.left) : rightFn(this.right);
  }
}

/**
 * IO Monad 简单实现
 */
export class IO {
  constructor(fn) {
    this.fn = fn;
  }

  static of(fn) {
    return new IO(fn);
  }

  map(fn) {
    return new IO(() => fn(this.fn()));
  }

  flatMap(fn) {
    return new IO(() => fn(this.fn()).run());
  }

  run() {
    return this.fn();
  }
}

/**
 * 异步流程控制
 */
export class AsyncFlow {
  constructor() {
    this.steps = [];
  }

  static create() {
    return new AsyncFlow();
  }

  step(fn) {
    this.steps.push(fn);
    return this;
  }

  catch(errorHandler) {
    this.errorHandler = errorHandler;
    return this;
  }

  async run(initialValue) {
    let result = initialValue;

    try {
      for (const step of this.steps) {
        result = await step(result);
      }
      return result;
    } catch (error) {
      if (this.errorHandler) {
        return await this.errorHandler(error, result);
      }
      throw error;
    }
  }
}

/**
 * 事件流处理
 */
export class EventStream {
  constructor() {
    this.listeners = new Map();
    this.middlewares = [];
  }

  on(event, listener) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(listener);
    return this;
  }

  off(event, listener) {
    if (this.listeners.has(event)) {
      const listeners = this.listeners.get(event);
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
    return this;
  }

  use(middleware) {
    this.middlewares.push(middleware);
    return this;
  }

  async emit(event, data) {
    const listeners = this.listeners.get(event) || [];

    // 应用中间件
    let context = { event, data };
    for (const middleware of this.middlewares) {
      context = await middleware(context);
      if (context.stopped) return;
    }

    // 触发监听器
    for (const listener of listeners) {
      try {
        await listener(context.data);
      } catch (error) {
        console.error(`Event listener error for ${event}:`, error);
      }
    }
  }

  async emitParallel(event, data) {
    const listeners = this.listeners.get(event) || [];
    const promises = listeners.map(async (listener) => {
      try {
        return await listener(data);
      } catch (error) {
        console.error(`Event listener error for ${event}:`, error);
        return null;
      }
    });

    return await Promise.all(promises);
  }
}

/**
 * 响应式状态管理
 */
export class ReactiveState {
  constructor(initialState = {}) {
    this.state = { ...initialState };
    this.listeners = new Map();
    this.middlewares = [];
  }

  getState() {
    return { ...this.state };
  }

  setState(updater) {
    const prevState = { ...this.state };
    const nextState =
      typeof updater === 'function' ? updater(prevState) : updater;

    this.state = { ...prevState, ...nextState };

    // 通知监听器
    this._notify(prevState, this.state);
  }

  subscribe(path, listener) {
    if (!this.listeners.has(path)) {
      this.listeners.set(path, []);
    }
    this.listeners.get(path).push(listener);

    // 返回取消订阅函数
    return () => {
      const listeners = this.listeners.get(path);
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }

  use(middleware) {
    this.middlewares.push(middleware);
    return this;
  }

  select(selector) {
    return selector(this.state);
  }

  _notify(prevState, nextState) {
    for (const [path, listeners] of this.listeners) {
      const prevValue = this._getValueByPath(prevState, path);
      const nextValue = this._getValueByPath(nextState, path);

      if (prevValue !== nextValue) {
        listeners.forEach((listener) => {
          try {
            listener(nextValue, prevValue);
          } catch (error) {
            console.error(`State listener error for ${path}:`, error);
          }
        });
      }
    }
  }

  _getValueByPath(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
}

/**
 * 实用工具函数
 */
export const utils = {
  /**
   * 深度克隆
   */
  deepClone: (obj) => JSON.parse(JSON.stringify(obj)),

  /**
   * 深度合并
   */
  deepMerge: (target, source) => {
    const result = { ...target };
    for (const key in source) {
      if (
        source[key] &&
        typeof source[key] === 'object' &&
        !Array.isArray(source[key])
      ) {
        result[key] = utils.deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  },

  /**
   * 安全获取嵌套属性
   */
  safeGet: (obj, path, defaultValue = undefined) => {
    return (
      path.split('.').reduce((current, key) => current?.[key], obj) ??
      defaultValue
    );
  },

  /**
   * 延迟执行
   */
  delay: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),

  /**
   * 生成UUID
   */
  uuid: () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  },

  /**
   * 格式化时间
   */
  formatTime: (date, format = 'YYYY-MM-DD HH:mm:ss') => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');

    return format
      .replace('YYYY', year)
      .replace('MM', month)
      .replace('DD', day)
      .replace('HH', hours)
      .replace('mm', minutes)
      .replace('ss', seconds);
  },
};

/**
 * 函数式管道操作符
 */
export const F = {
  compose,
  pipe,
  curry,
  partial,
  memoize,
  debounce,
  throttle,
  retry,
  when,
  cond,
  isNil,
  isNotNil,
  isType,
  isArray,
  isObject,
  isFunction,
  isString,
  isNumber,
  isBoolean,
  Maybe,
  Either,
  IO,
  AsyncFlow,
  EventStream,
  ReactiveState,
  ...utils,
};
