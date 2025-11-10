/**
 * 基础可初始化类
 * 提供统一的异步初始化和管理功能
 */

import { logger } from '../utils/logger.js';

export class BaseInitializable {
  constructor() {
    this._isInitialized = false;
    this._isInitializing = false;
    this._initializationPromise = null;
    this._initStartTime = null;
    this._initEndTime = null;
  }

  /**
   * 异步初始化方法
   */
  async initialize(options = {}) {
    if (this._isInitialized) {
      logger.debug(`${this.constructor.name} already initialized`);
      return this;
    }

    if (this._isInitializing) {
      logger.debug(`${this.constructor.name} initialization in progress, waiting...`);
      return this._initializationPromise;
    }

    this._isInitializing = true;
    this._initStartTime = Date.now();

    try {
      logger.info(`Initializing ${this.constructor.name}...`, {
        options: this._sanitizeOptions(options)
      });

      // 执行初始化前准备
      await this._beforeInitialize(options);

      // 执行具体初始化逻辑
      await this._doInitialize(options);

      // 执行初始化后清理
      await this._afterInitialize(options);

      this._isInitialized = true;
      this._initEndTime = Date.now();

      const initDuration = this._initEndTime - this._initStartTime;
      logger.info(`${this.constructor.name} initialized successfully`, {
        duration: initDuration,
        timestamp: new Date().toISOString()
      });

      return this;

    } catch (error) {
      this._isInitializing = false;
      logger.error(`${this.constructor.name} initialization failed`, {
        error: error.message,
        duration: Date.now() - (this._initStartTime || Date.now()),
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * 初始化前准备
   */
  async _beforeInitialize(options) {
    // 子类可以重写此方法
  }

  /**
   * 执行具体初始化逻辑
   */
  async _doInitialize(options) {
    // 子类必须实现此方法
    throw new Error(`${this.constructor.name} must implement _doInitialize method`);
  }

  /**
   * 初始化后清理
   */
  async _afterInitialize(options) {
    // 子类可以重写此方法
  }

  /**
   * 检查是否已初始化
   */
  get isInitialized() {
    return this._isInitialized;
  }

  /**
   * 检查是否正在初始化
   */
  get isInitializing() {
    return this._isInitializing;
  }

  /**
   * 获取初始化持续时间
   */
  get initializationDuration() {
    if (!this._initEndTime || !this._initStartTime) return null;
    return this._initEndTime - this._initStartTime;
  }

  /**
   * 等待初始化完成
   */
  async waitForInitialization(timeout = 30000) {
    if (this._isInitialized) {
      return;
    }

    if (!this._isInitializing) {
      throw new Error(`${this.constructor.name} is not initializing`);
    }

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`${this.constructor.name} initialization timeout after ${timeout}ms`));
      }, timeout);
    });

    await Promise.race([
      this._initializationPromise || Promise.resolve(),
      timeoutPromise
    ]);
  }

  /**
   * 重新初始化
   */
  async reinitialize(options = {}) {
    if (this._isInitialized) {
      await this.destroy();
    }

    this._isInitialized = false;
    this._isInitializing = false;
    this._initializationPromise = null;
    this._initStartTime = null;
    this._initEndTime = null;

    return this.initialize(options);
  }

  /**
   * 销毁实例
   */
  async destroy() {
    if (!this._isInitialized) {
      return;
    }

    try {
      logger.info(`Destroying ${this.constructor.name}...`);

      await this._beforeDestroy();
      await this._doDestroy();
      await this._afterDestroy();

      this._isInitialized = false;
      this._isInitializing = false;
      this._initializationPromise = null;

      logger.info(`${this.constructor.name} destroyed successfully`);

    } catch (error) {
      logger.error(`${this.constructor.name} destroy failed`, {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * 销毁前准备
   */
  async _beforeDestroy() {
    // 子类可以重写此方法
  }

  /**
   * 执行具体销毁逻辑
   */
  async _doDestroy() {
    // 子类可以重写此方法
  }

  /**
   * 销毁后清理
   */
  async _afterDestroy() {
    // 子类可以重写此方法
  }

  /**
   * 清理敏感选项信息
   */
  _sanitizeOptions(options) {
    const sensitiveKeys = ['password', 'secret', 'token', 'key', 'credentials'];
    const sanitized = { ...options };

    for (const key of sensitiveKeys) {
      if (key in sanitized) {
        sanitized[key] = '***';
      }
    }

    return sanitized;
  }

  /**
   * 获取初始化统计信息
   */
  getInitializationStats() {
    return {
      isInitialized: this._isInitialized,
      isInitializing: this._isInitializing,
      initializationDuration: this.initializationDuration,
      initStartTime: this._initStartTime,
      initEndTime: this._initEndTime,
      className: this.constructor.name
    };
  }
}

/**
 * 初始化工具函数
 */
export const InitializationUtils = {
  /**
   * 创建初始化包装器
   */
  createInitializationWrapper(initializeFn, destroyFn = null) {
    let isInitialized = false;
    let isInitializing = false;

    const wrappedInitialize = async (options = {}) => {
      if (isInitialized) return;
      if (isInitializing) return;

      isInitializing = true;
      try {
        await initializeFn(options);
        isInitialized = true;
      } finally {
        isInitializing = false;
      }
    };

    const wrappedDestroy = async () => {
      if (!isInitialized) return;

      try {
        if (destroyFn) {
          await destroyFn();
        }
        isInitialized = false;
      } catch (error) {
        logger.error('Destroy function failed', { error: error.message });
        throw error;
      }
    };

    return {
      initialize: wrappedInitialize,
      destroy: wrappedDestroy,
      get isInitialized() { return isInitialized; },
      get isInitializing() { return isInitializing; }
    };
  },

  /**
   * 顺序初始化多个组件
   */
  async initializeSequentially(components, options = {}) {
    const results = [];
    const startTime = Date.now();

    logger.info('Starting sequential initialization', { count: components.length });

    for (let i = 0; i < components.length; i++) {
      const component = components[i];
      const componentStartTime = Date.now();

      try {
        logger.debug(`Initializing component ${i + 1}/${components.length}`, {
          name: component.constructor?.name || component.name || 'unknown'
        });

        await component.initialize(options);
        const duration = Date.now() - componentStartTime;

        results.push({
          index: i,
          success: true,
          duration,
          component: component.constructor?.name || 'unknown'
        });

      } catch (error) {
        results.push({
          index: i,
          success: false,
          error: error.message,
          component: component.constructor?.name || 'unknown'
        });

        // 如果设置为失败时停止，则抛出错误
        if (options.stopOnFailure !== false) {
          throw error;
        }
      }
    }

    const totalDuration = Date.now() - startTime;
    const successCount = results.filter(r => r.success).length;

    logger.info('Sequential initialization completed', {
      total: components.length,
      successful: successCount,
      failed: components.length - successCount,
      totalDuration
    });

    return results;
  },

  /**
   * 并行初始化多个组件
   */
  async initializeParallel(components, options = {}) {
    const startTime = Date.now();

    logger.info('Starting parallel initialization', { count: components.length });

    const promises = components.map(async (component, index) => {
      const componentStartTime = Date.now();

      try {
        await component.initialize(options);
        const duration = Date.now() - componentStartTime;

        return {
          index,
          success: true,
          duration,
          component: component.constructor?.name || 'unknown'
        };

      } catch (error) {
        return {
          index,
          success: false,
          error: error.message,
          component: component.constructor?.name || 'unknown'
        };
      }
    });

    const results = await Promise.all(promises);
    const totalDuration = Date.now() - startTime;
    const successCount = results.filter(r => r.success).length;

    logger.info('Parallel initialization completed', {
      total: components.length,
      successful: successCount,
      failed: components.length - successCount,
      totalDuration
    });

    return results;
  }
};
