/**
 * frys 轻量级核心 - 基础模块
 * 提供统一的模块生命周期管理和错误处理
 */

import { logger } from '../utils/logger.js';

/**
 * 基础模块类
 * 所有核心模块都应该继承此类
 */
export class BaseModule {
  constructor(name, config = {}) {
    this.name = name;
    this.config = { ...this.getDefaultConfig(), ...config };
    this.initialized = false;
    this.destroyed = false;
    this._hooks = new Map();
    this._middlewares = [];
  }

  /**
   * 获取默认配置
   */
  getDefaultConfig() {
    return {
      enabled: true,
      debug: false,
      timeout: 30000,
    };
  }

  /**
   * 初始化模块
   */
  async initialize() {
    if (this.initialized) {
      return this;
    }

    try {
      await this._runHooks('beforeInitialize');

      logger.info(`🔧 初始化 ${this.name} 模块`, {
        config: this.config.debug ? this.config : '[hidden]',
      });

      await this.onInitialize();

      this.initialized = true;

      await this._runHooks('afterInitialize');

      logger.info(`✅ ${this.name} 模块初始化完成`);

      return this;
    } catch (error) {
      logger.error(`❌ ${this.name} 模块初始化失败`, error);
      throw error;
    }
  }

  /**
   * 启动模块
   */
  async start() {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      await this._runHooks('beforeStart');

      logger.info(`🚀 启动 ${this.name} 模块`);
      await this.onStart();

      await this._runHooks('afterStart');

      logger.info(`✅ ${this.name} 模块启动完成`);

      return this;
    } catch (error) {
      logger.error(`❌ ${this.name} 模块启动失败`, error);
      throw error;
    }
  }

  /**
   * 停止模块
   */
  async stop() {
    if (!this.initialized || this.destroyed) {
      return this;
    }

    try {
      await this._runHooks('beforeStop');

      logger.info(`🛑 停止 ${this.name} 模块`);
      await this.onStop();

      await this._runHooks('afterStop');

      logger.info(`✅ ${this.name} 模块停止完成`);

      return this;
    } catch (error) {
      logger.error(`❌ ${this.name} 模块停止失败`, error);
      throw error;
    }
  }

  /**
   * 销毁模块
   */
  async destroy() {
    if (this.destroyed) {
      return this;
    }

    try {
      await this.stop();

      await this._runHooks('beforeDestroy');

      logger.info(`💥 销毁 ${this.name} 模块`);
      await this.onDestroy();

      this.destroyed = true;
      this._hooks.clear();
      this._middlewares = [];

      await this._runHooks('afterDestroy');

      logger.info(`✅ ${this.name} 模块销毁完成`);

      return this;
    } catch (error) {
      logger.error(`❌ ${this.name} 模块销毁失败`, error);
      throw error;
    }
  }

  /**
   * 获取模块状态
   */
  getStatus() {
    return {
      name: this.name,
      initialized: this.initialized,
      destroyed: this.destroyed,
      config: this.config.debug ? this.config : '[hidden]',
      hooks: Array.from(this._hooks.keys()),
      middlewares: this._middlewares.length,
    };
  }

  /**
   * 健康检查
   */
  async healthCheck() {
    try {
      const result = await this.onHealthCheck();
      return {
        healthy: true,
        name: this.name,
        ...result,
      };
    } catch (error) {
      return {
        healthy: false,
        name: this.name,
        error: error.message,
      };
    }
  }

  // === 钩子系统 ===

  /**
   * 注册钩子
   */
  hook(event, handler, priority = 0) {
    if (!this._hooks.has(event)) {
      this._hooks.set(event, []);
    }

    this._hooks.get(event).push({ handler, priority });
    this._hooks.get(event).sort((a, b) => b.priority - a.priority);

    return this;
  }

  /**
   * 移除钩子
   */
  unhook(event, handler) {
    if (this._hooks.has(event)) {
      const hooks = this._hooks.get(event);
      const index = hooks.findIndex((h) => h.handler === handler);
      if (index > -1) {
        hooks.splice(index, 1);
      }
    }
    return this;
  }

  /**
   * 执行钩子
   */
  async _runHooks(event, ...args) {
    const hooks = this._hooks.get(event) || [];
    for (const { handler } of hooks) {
      try {
        await handler(...args);
      } catch (error) {
        logger.error(`钩子执行失败: ${event}`, error);
      }
    }
  }

  // === 中间件系统 ===

  /**
   * 添加中间件
   */
  use(middleware) {
    this._middlewares.push(middleware);
    return this;
  }

  /**
   * 执行中间件链
   */
  async _runMiddlewares(context, finalHandler) {
    let index = 0;

    const next = async () => {
      if (index < this._middlewares.length) {
        const middleware = this._middlewares[index++];
        return middleware(context, next);
      } else {
        return finalHandler(context);
      }
    };

    return await next();
  }

  // === 统一错误处理 ===

  /**
   * 包装异步方法，提供统一错误处理
   */
  async _safeAsync(method, ...args) {
    try {
      return await method.apply(this, args);
    } catch (error) {
      return this._handleError(error, method.name);
    }
  }

  /**
   * 错误处理
   */
  _handleError(error, context = '') {
    logger.error(`${this.name} 错误 [${context}]`, error);

    // 可以在这里添加错误上报、恢复逻辑等
    if (this.config.debug) {
      console.error(error.stack);
    }

    throw error;
  }

  // === 子类需要实现的抽象方法 ===

  /**
   * 初始化逻辑
   */
  async onInitialize() {
    // 子类实现
  }

  /**
   * 启动逻辑
   */
  async onStart() {
    // 子类实现
  }

  /**
   * 停止逻辑
   */
  async onStop() {
    // 子类实现
  }

  /**
   * 销毁逻辑
   */
  async onDestroy() {
    // 子类实现
  }

  /**
   * 健康检查逻辑
   */
  async onHealthCheck() {
    return { status: 'ok' };
  }

  // === 工具方法 ===

  /**
   * 延迟执行
   */
  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 重试机制
   */
  async retry(fn, maxAttempts = 3, delay = 1000) {
    let lastError;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (attempt < maxAttempts) {
          logger.warn(
            `${this.name} 重试 ${attempt}/${maxAttempts}`,
            error.message,
          );
          await this.delay(delay);
        }
      }
    }

    throw lastError;
  }

  /**
   * 超时包装
   */
  withTimeout(promise, timeoutMs = this.config.timeout) {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error(`操作超时: ${timeoutMs}ms`)),
          timeoutMs,
        ),
      ),
    ]);
  }
}

/**
 * 创建模块装饰器
 */
export function Module(config = {}) {
  return function (constructor) {
    // 扩展构造函数
    const originalConstructor = constructor;

    constructor = function (...args) {
      const instance = new originalConstructor(...args);

      // 应用配置
      if (config.name) {
        instance.name = config.name;
      }

      if (config.hooks) {
        Object.entries(config.hooks).forEach(([event, handler]) => {
          instance.hook(event, handler);
        });
      }

      return instance;
    };

    constructor.prototype = originalConstructor.prototype;
    return constructor;
  };
}

/**
 * 依赖注入装饰器
 */
export function Inject(dependencyName) {
  return function (target, propertyKey) {
    target._injections = target._injections || new Map();
    target._injections.set(propertyKey, dependencyName);
  };
}

/**
 * 缓存装饰器
 */
export function Cached(ttl = 300000) {
  // 5分钟默认
  return function (target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;
    const cache = new Map();

    descriptor.value = async function (...args) {
      const key = JSON.stringify(args);
      const now = Date.now();

      // 检查缓存
      if (cache.has(key)) {
        const { value, timestamp } = cache.get(key);
        if (now - timestamp < ttl) {
          return value;
        }
        cache.delete(key);
      }

      // 执行原方法
      const result = await originalMethod.apply(this, args);

      // 缓存结果
      cache.set(key, { value: result, timestamp: now });

      return result;
    };

    return descriptor;
  };
}
