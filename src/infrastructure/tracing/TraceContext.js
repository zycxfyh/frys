/**
 * frys - 追踪上下文管理器
 * 管理追踪上下文的存储和传递
 */

import { AsyncLocalStorage } from 'async_hooks';

export class TraceContext {
  constructor() {
    // 使用AsyncLocalStorage来存储上下文
    this.storage = new AsyncLocalStorage();
    this.contexts = new Map();
  }

  /**
   * 在上下文中运行函数
   * @param {object} context - 追踪上下文
   * @param {Function} fn - 要运行的函数
   */
  run(context, fn) {
    return this.storage.run(context, fn);
  }

  /**
   * 获取当前上下文
   */
  getCurrent() {
    return this.storage.getStore();
  }

  /**
   * 设置当前上下文
   * @param {object} context - 追踪上下文
   */
  setCurrent(context) {
    // 注意：这个方法应该在run()的回调中调用
    const store = this.storage.getStore();
    if (store) {
      Object.assign(store, context);
    }
  }

  /**
   * 创建子上下文
   * @param {object} parentContext - 父上下文
   * @param {object} overrides - 覆盖的属性
   */
  createChildContext(parentContext, overrides = {}) {
    if (!parentContext) {
      return this.createRootContext(overrides);
    }

    return {
      ...parentContext,
      spanId: overrides.spanId || this._generateSpanId(),
      parentSpanId: parentContext.spanId,
      ...overrides,
    };
  }

  /**
   * 创建根上下文
   * @param {object} overrides - 覆盖的属性
   */
  createRootContext(overrides = {}) {
    return {
      traceId: overrides.traceId || this._generateTraceId(),
      spanId: overrides.spanId || this._generateSpanId(),
      parentSpanId: null,
      sampled: overrides.sampled !== false,
      baggage: new Map(),
      ...overrides,
    };
  }

  /**
   * 从载体提取上下文
   * @param {object} carrier - 载体对象
   * @param {string} format - 格式
   */
  static extract(carrier, format = 'http_headers') {
    if (format === 'http_headers') {
      return {
        traceId: carrier['x-trace-id'] || carrier['x-b3-traceid'],
        spanId: carrier['x-span-id'] || carrier['x-b3-spanid'],
        parentSpanId:
          carrier['x-parent-span-id'] || carrier['x-b3-parentspanid'],
        sampled: carrier['x-sampled'] !== '0',
        baggage: TraceContext._extractBaggage(carrier),
      };
    } else if (format === 'binary') {
      return {
        traceId: carrier.traceId,
        spanId: carrier.spanId,
        parentSpanId: carrier.parentSpanId,
        sampled: carrier.sampled,
        baggage: carrier.baggage || new Map(),
      };
    }

    return null;
  }

  /**
   * 将上下文注入到载体
   * @param {object} context - 追踪上下文
   * @param {object} carrier - 载体对象
   * @param {string} format - 格式
   */
  static inject(context, carrier, format = 'http_headers') {
    if (!context) return carrier;

    if (format === 'http_headers') {
      carrier['x-trace-id'] = context.traceId;
      carrier['x-span-id'] = context.spanId;
      if (context.parentSpanId) {
        carrier['x-parent-span-id'] = context.parentSpanId;
      }
      carrier['x-sampled'] = context.sampled ? '1' : '0';

      // 注入baggage
      TraceContext._injectBaggage(context.baggage, carrier);
    } else if (format === 'binary') {
      carrier.traceId = context.traceId;
      carrier.spanId = context.spanId;
      carrier.parentSpanId = context.parentSpanId;
      carrier.sampled = context.sampled;
      carrier.baggage = context.baggage;
    }

    return carrier;
  }

  /**
   * 获取baggage项
   * @param {string} key - 键
   */
  getBaggageItem(key) {
    const context = this.getCurrent();
    return context?.baggage?.get(key);
  }

  /**
   * 设置baggage项
   * @param {string} key - 键
   * @param {string} value - 值
   */
  setBaggageItem(key, value) {
    const context = this.getCurrent();
    if (context?.baggage) {
      context.baggage.set(key, value);
    }
  }

  /**
   * 移除baggage项
   * @param {string} key - 键
   */
  removeBaggageItem(key) {
    const context = this.getCurrent();
    if (context?.baggage) {
      context.baggage.delete(key);
    }
  }

  /**
   * 获取所有baggage项
   */
  getBaggage() {
    const context = this.getCurrent();
    return context?.baggage || new Map();
  }

  /**
   * 清理上下文
   * @param {string} traceId - 追踪ID
   */
  cleanup(traceId) {
    this.contexts.delete(traceId);
  }

  /**
   * 提取baggage
   */
  static _extractBaggage(carrier) {
    const baggage = new Map();

    // 从特殊头中提取baggage
    Object.keys(carrier).forEach((key) => {
      if (key.startsWith('x-baggage-')) {
        const baggageKey = key.substring('x-baggage-'.length);
        baggage.set(baggageKey, carrier[key]);
      }
    });

    return baggage;
  }

  /**
   * 注入baggage
   */
  static _injectBaggage(baggage, carrier) {
    if (baggage) {
      for (const [key, value] of baggage) {
        carrier[`x-baggage-${key}`] = value;
      }
    }
  }

  /**
   * 生成追踪ID
   */
  _generateTraceId() {
    return this._generateId(32);
  }

  /**
   * 生成跨度ID
   */
  _generateSpanId() {
    return this._generateId(16);
  }

  /**
   * 生成随机ID
   */
  _generateId(length) {
    const chars = '0123456789abcdef';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}

/**
 * 全局追踪上下文实例
 */
export const globalTraceContext = new TraceContext();

/**
 * 在上下文中运行函数的辅助函数
 */
export function runInTraceContext(context, fn) {
  return globalTraceContext.run(context, fn);
}

/**
 * 获取当前追踪上下文的辅助函数
 */
export function getCurrentTraceContext() {
  return globalTraceContext.getCurrent();
}

/**
 * 设置当前追踪上下文的辅助函数
 */
export function setCurrentTraceContext(context) {
  globalTraceContext.setCurrent(context);
}

/**
 * 创建子上下文的辅助函数
 */
export function createChildTraceContext(overrides = {}) {
  const current = getCurrentTraceContext();
  return globalTraceContext.createChildContext(current, overrides);
}

/**
 * 创建根上下文的辅助函数
 */
export function createRootTraceContext(overrides = {}) {
  return globalTraceContext.createRootContext(overrides);
}

/**
 * 上下文管理器类（用于自动上下文管理）
 */
export class TraceContextManager {
  constructor(traceContext = globalTraceContext) {
    this.traceContext = traceContext;
  }

  /**
   * 在新上下文中执行函数
   */
  async withContext(context, fn) {
    return this.traceContext.run(context, async () => {
      try {
        return await fn();
      } catch (error) {
        // 可以在这里添加错误处理逻辑
        throw error;
      }
    });
  }

  /**
   * 在子上下文中执行函数
   */
  async withChildContext(overrides, fn) {
    const currentContext = this.traceContext.getCurrent();
    const childContext = this.traceContext.createChildContext(
      currentContext,
      overrides,
    );

    return this.withContext(childContext, fn);
  }

  /**
   * 在根上下文中执行函数
   */
  async withRootContext(overrides, fn) {
    const rootContext = this.traceContext.createRootContext(overrides);
    return this.withContext(rootContext, fn);
  }

  /**
   * 中间件版本的上下文管理
   */
  middleware() {
    return (req, res, next) => {
      // 从请求头提取上下文
      const extractedContext = TraceContext.extract(req.headers);

      if (extractedContext) {
        // 在提取的上下文中运行
        this.traceContext.run(extractedContext, () => {
          next();
        });
      } else {
        // 创建新的根上下文
        const rootContext = this.traceContext.createRootContext();
        this.traceContext.run(rootContext, () => {
          next();
        });
      }
    };
  }
}
