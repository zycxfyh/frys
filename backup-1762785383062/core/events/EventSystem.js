/**
 * 事件系统
 * 提供异步事件处理、中间件支持和性能优化
 */

import { logger } from '../../shared/utils/logger.js';
import { ErrorHandlerUtils } from '../../shared/utils/ErrorHandlerUtils.js';
import { ResourceCleanupUtils } from '../../shared/utils/ResourceCleanupUtils.js';
import { TimerManager } from '../../shared/utils/TimerManager.js';

export class EventSystem {
  constructor(options = {}) {
    this.options = {
      enableAsync: true,
      enableMiddleware: true,
      enableMetrics: true,
      maxListeners: 100,
      maxQueueSize: 10000,
      retryAttempts: 3,
      timeout: 30000,
      enableBuffering: true,
      bufferSize: 100,
      ...options
    };

    // 事件监听器
    this.listeners = new Map();
    this.onceListeners = new Map();

    // 中间件
    this.middlewares = new Map();
    this.globalMiddlewares = [];

    // 事件队列
    this.eventQueue = [];
    this.processing = false;

    // 性能监控
    this.metrics = {
      eventsEmitted: 0,
      eventsProcessed: 0,
      eventsFailed: 0,
      averageProcessingTime: 0,
      peakQueueSize: 0
    };

    // 定时器管理器
    this.timerManager = new TimerManager();

    // 清理管理器
    this.cleanupManager = ResourceCleanupUtils.createCleanupManager('event_system');

    logger.info('Event system initialized', {
      async: this.options.enableAsync,
      middleware: this.options.enableMiddleware,
      maxListeners: this.options.maxListeners
    });
  }

  /**
   * 注册事件监听器
   * @param {string} event - 事件名称
   * @param {Function} listener - 监听器函数
   * @param {Object} options - 监听选项
   * @returns {string} 监听器ID
   */
  on(event, listener, options = {}) {
    return this._addListener(event, listener, {
      once: false,
      priority: 0,
      ...options
    });
  }

  /**
   * 注册一次性事件监听器
   * @param {string} event - 事件名称
   * @param {Function} listener - 监听器函数
   * @param {Object} options - 监听选项
   * @returns {string} 监听器ID
   */
  once(event, listener, options = {}) {
    return this._addListener(event, listener, {
      once: true,
      priority: 0,
      ...options
    });
  }

  /**
   * 移除事件监听器
   * @param {string} event - 事件名称
   * @param {string} listenerId - 监听器ID
   * @returns {boolean} 是否成功移除
   */
  off(event, listenerId) {
    const eventListeners = this.listeners.get(event);
    const onceListeners = this.onceListeners.get(event);

    let removed = false;

    if (eventListeners) {
      const index = eventListeners.findIndex(l => l.id === listenerId);
      if (index >= 0) {
        eventListeners.splice(index, 1);
        removed = true;
      }
    }

    if (onceListeners) {
      const index = onceListeners.findIndex(l => l.id === listenerId);
      if (index >= 0) {
        onceListeners.splice(index, 1);
        removed = true;
      }
    }

    if (removed) {
      logger.debug(`Event listener removed: ${event}`, { listenerId });
    }

    return removed;
  }

  /**
   * 移除所有监听器
   * @param {string} event - 事件名称（可选，不传则移除所有）
   */
  removeAllListeners(event) {
    if (event) {
      this.listeners.delete(event);
      this.onceListeners.delete(event);
      logger.debug(`All listeners removed for event: ${event}`);
    } else {
      this.listeners.clear();
      this.onceListeners.clear();
      logger.debug('All event listeners removed');
    }
  }

  /**
   * 触发事件
   * @param {string} event - 事件名称
   * @param {*} data - 事件数据
   * @param {Object} options - 触发选项
   * @returns {Promise<Array>} 处理结果数组
   */
  async emit(event, data = {}, options = {}) {
    const {
      async = this.options.enableAsync,
      timeout = this.options.timeout,
      skipMiddleware = false
    } = options;

    this.metrics.eventsEmitted++;

    try {
      // 应用全局中间件
      let processedData = data;
      if (!skipMiddleware && this.options.enableMiddleware) {
        processedData = await this._applyGlobalMiddlewares(event, data);
      }

      // 创建事件上下文
      const context = {
        event,
        data: processedData,
        timestamp: Date.now(),
        async,
        timeout,
        metadata: options.metadata || {}
      };

      if (async) {
        // 异步处理
        this._enqueueEvent(context);
        return [{ status: 'queued', event }];
      } else {
        // 同步处理
        return await this._processEvent(context);
      }

    } catch (error) {
      this.metrics.eventsFailed++;
      logger.error(`Event emission failed: ${event}`, {
        error: error.message,
        data: typeof data === 'object' ? JSON.stringify(data).slice(0, 200) : String(data)
      });
      throw error;
    }
  }

  /**
   * 等待事件处理完成
   * @param {string} event - 事件名称
   * @param {number} timeout - 等待超时时间
   * @returns {Promise<Array>} 处理结果
   */
  async waitFor(event, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Timeout waiting for event: ${event}`));
      }, timeout);

      this.once(event, (results) => {
        clearTimeout(timeoutId);
        resolve(results);
      });
    });
  }

  /**
   * 注册中间件
   * @param {string} event - 事件名称（为空表示全局中间件）
   * @param {Function} middleware - 中间件函数
   * @param {Object} options - 中间件选项
   * @returns {string} 中间件ID
   */
  use(event, middleware, options = {}) {
    if (!this.options.enableMiddleware) {
      logger.warn('Middleware system is disabled');
      return null;
    }

    const middlewareId = `middleware_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const middlewareInfo = {
      id: middlewareId,
      middleware,
      options: {
        priority: 0,
        timeout: 10000,
        ...options
      },
      registeredAt: Date.now()
    };

    if (event) {
      // 事件特定中间件
      if (!this.middlewares.has(event)) {
        this.middlewares.set(event, []);
      }
      this.middlewares.get(event).push(middlewareInfo);

      // 按优先级排序
      this.middlewares.get(event).sort((a, b) => b.options.priority - a.options.priority);
    } else {
      // 全局中间件
      this.globalMiddlewares.push(middlewareInfo);
      this.globalMiddlewares.sort((a, b) => b.options.priority - a.options.priority);
    }

    logger.debug(`Middleware registered: ${event || 'global'}`, { middlewareId });
    return middlewareId;
  }

  /**
   * 移除中间件
   * @param {string} event - 事件名称
   * @param {string} middlewareId - 中间件ID
   * @returns {boolean} 是否成功移除
   */
  removeMiddleware(event, middlewareId) {
    let removed = false;

    if (event) {
      const eventMiddlewares = this.middlewares.get(event);
      if (eventMiddlewares) {
        const index = eventMiddlewares.findIndex(m => m.id === middlewareId);
        if (index >= 0) {
          eventMiddlewares.splice(index, 1);
          removed = true;
        }
      }
    } else {
      const index = this.globalMiddlewares.findIndex(m => m.id === middlewareId);
      if (index >= 0) {
        this.globalMiddlewares.splice(index, 1);
        removed = true;
      }
    }

    if (removed) {
      logger.debug(`Middleware removed: ${event || 'global'}`, { middlewareId });
    }

    return removed;
  }

  /**
   * 获取事件统计信息
   * @returns {Object}
   */
  getStats() {
    const listenerCount = Array.from(this.listeners.values()).reduce((sum, listeners) => sum + listeners.length, 0);
    const onceListenerCount = Array.from(this.onceListeners.values()).reduce((sum, listeners) => sum + listeners.length, 0);
    const middlewareCount = Array.from(this.middlewares.values()).reduce((sum, middlewares) => sum + middlewares.length, 0) + this.globalMiddlewares.length;

    return {
      listeners: {
        regular: listenerCount,
        once: onceListenerCount,
        total: listenerCount + onceListenerCount
      },
      middlewares: {
        eventSpecific: middlewareCount - this.globalMiddlewares.length,
        global: this.globalMiddlewares.length,
        total: middlewareCount
      },
      events: {
        emitted: this.metrics.eventsEmitted,
        processed: this.metrics.eventsProcessed,
        failed: this.metrics.eventsFailed,
        queued: this.eventQueue.length
      },
      performance: {
        averageProcessingTime: this.metrics.averageProcessingTime,
        peakQueueSize: this.metrics.peakQueueSize
      },
      options: this.options
    };
  }

  /**
   * 销毁事件系统
   */
  async destroy() {
    logger.info('Destroying event system...');

    // 停止处理队列
    this.processing = false;

    // 清空队列
    this.eventQueue = [];

    // 移除所有监听器和中间件
    this.listeners.clear();
    this.onceListeners.clear();
    this.middlewares.clear();
    this.globalMiddlewares = [];

    // 停止定时器
    this.timerManager.destroy();

    // 清理资源
    await this.cleanupManager.cleanup();

    logger.info('Event system destroyed');
  }

  /**
   * 添加监听器
   */
  _addListener(event, listener, options) {
    const listenerId = `listener_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const listenerInfo = {
      id: listenerId,
      listener,
      options,
      registeredAt: Date.now()
    };

    const targetMap = options.once ? this.onceListeners : this.listeners;

    if (!targetMap.has(event)) {
      targetMap.set(event, []);
    }

    const eventListeners = targetMap.get(event);

    // 检查监听器数量限制
    if (eventListeners.length >= this.options.maxListeners) {
      logger.warn(`Max listeners exceeded for event: ${event}`, {
        current: eventListeners.length,
        max: this.options.maxListeners
      });
    }

    eventListeners.push(listenerInfo);

    // 按优先级排序
    eventListeners.sort((a, b) => b.options.priority - a.options.priority);

    logger.debug(`Event listener added: ${event}`, {
      listenerId,
      once: options.once,
      priority: options.priority
    });

    return listenerId;
  }

  /**
   * 入队事件
   */
  _enqueueEvent(context) {
    if (this.eventQueue.length >= this.options.maxQueueSize) {
      logger.warn('Event queue is full, dropping event', {
        event: context.event,
        queueSize: this.eventQueue.length
      });
      return;
    }

    this.eventQueue.push(context);
    this.metrics.peakQueueSize = Math.max(this.metrics.peakQueueSize, this.eventQueue.length);

    // 开始处理队列
    if (!this.processing) {
      this._processQueue();
    }
  }

  /**
   * 处理事件队列
   */
  async _processQueue() {
    if (this.processing || this.eventQueue.length === 0) return;

    this.processing = true;

    try {
      while (this.eventQueue.length > 0) {
        const context = this.eventQueue.shift();
        if (context) {
          await this._processEvent(context);
        }
      }
    } finally {
      this.processing = false;
    }
  }

  /**
   * 处理单个事件
   */
  async _processEvent(context) {
    const startTime = Date.now();
    const results = [];

    try {
      // 应用事件特定中间件
      if (this.options.enableMiddleware) {
        context.data = await this._applyEventMiddlewares(context.event, context.data);
      }

      // 获取监听器
      const regularListeners = this.listeners.get(context.event) || [];
      const onceListeners = this.onceListeners.get(context.event) || [];
      const allListeners = [...regularListeners, ...onceListeners];

      if (allListeners.length === 0) {
        logger.debug(`No listeners for event: ${context.event}`);
        return results;
      }

      // 并行处理监听器
      const promises = allListeners.map(async (listenerInfo) => {
        return this._executeListener(listenerInfo, context);
      });

      const listenerResults = await Promise.allSettled(promises);

      // 处理结果
      for (let i = 0; i < listenerResults.length; i++) {
        const result = listenerResults[i];
        const listenerInfo = allListeners[i];

        if (result.status === 'fulfilled') {
          results.push({
            listenerId: listenerInfo.id,
            status: 'success',
            result: result.value
          });
        } else {
          results.push({
            listenerId: listenerInfo.id,
            status: 'error',
            error: result.reason.message
          });

          logger.error(`Event listener failed: ${context.event}`, {
            listenerId: listenerInfo.id,
            error: result.reason.message
          });
        }

        // 移除一次性监听器
        if (listenerInfo.options.once) {
          this.onceListeners.get(context.event)?.splice(i, 1);
        }
      }

      // 更新指标
      this.metrics.eventsProcessed++;
      const processingTime = Date.now() - startTime;
      this._updateAverageProcessingTime(processingTime);

      logger.debug(`Event processed: ${context.event}`, {
        listeners: allListeners.length,
        processingTime,
        results: results.length
      });

      return results;

    } catch (error) {
      logger.error(`Event processing failed: ${context.event}`, {
        error: error.message,
        processingTime: Date.now() - startTime
      });

      results.push({
        status: 'error',
        error: error.message
      });

      return results;
    }
  }

  /**
   * 执行监听器
   */
  async _executeListener(listenerInfo, context) {
    const { listener, options } = listenerInfo;

    // 创建超时控制器
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => {
      timeoutController.abort();
    }, options.timeout || this.options.timeout);

    try {
      // 检查是否已超时
      if (timeoutController.signal.aborted) {
        throw new Error('Listener execution timeout');
      }

      // 执行监听器
      const result = await listener(context.data, context);

      clearTimeout(timeoutId);
      return result;

    } catch (error) {
      clearTimeout(timeoutId);

      // 重试逻辑
      if (options.retryAttempts && options.retryAttempts > 0) {
        return this._retryListenerExecution(listenerInfo, context, options.retryAttempts);
      }

      throw error;
    }
  }

  /**
   * 重试监听器执行
   */
  async _retryListenerExecution(listenerInfo, context, remainingAttempts) {
    try {
      logger.debug(`Retrying listener execution`, {
        listenerId: listenerInfo.id,
        event: context.event,
        remainingAttempts
      });

      return await this._executeListener(listenerInfo, context);

    } catch (error) {
      if (remainingAttempts > 1) {
        // 指数退避重试
        const delay = Math.pow(2, this.options.retryAttempts - remainingAttempts) * 100;
        await new Promise(resolve => setTimeout(resolve, delay));

        return this._retryListenerExecution(listenerInfo, context, remainingAttempts - 1);
      }

      throw error;
    }
  }

  /**
   * 应用全局中间件
   */
  async _applyGlobalMiddlewares(event, data) {
    let result = data;

    for (const middlewareInfo of this.globalMiddlewares) {
      result = await this._executeMiddleware(middlewareInfo, event, result);
    }

    return result;
  }

  /**
   * 应用事件特定中间件
   */
  async _applyEventMiddlewares(event, data) {
    const eventMiddlewares = this.middlewares.get(event);
    if (!eventMiddlewares) return data;

    let result = data;

    for (const middlewareInfo of eventMiddlewares) {
      result = await this._executeMiddleware(middlewareInfo, event, result);
    }

    return result;
  }

  /**
   * 执行中间件
   */
  async _executeMiddleware(middlewareInfo, event, data) {
    const { middleware, options } = middlewareInfo;

    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => {
      timeoutController.abort();
    }, options.timeout);

    try {
      const context = {
        event,
        timestamp: Date.now(),
        middlewareId: middlewareInfo.id
      };

      const result = await middleware(data, context);

      clearTimeout(timeoutId);
      return result !== undefined ? result : data;

    } catch (error) {
      clearTimeout(timeoutId);
      logger.error(`Middleware execution failed: ${event}`, {
        middlewareId: middlewareInfo.id,
        error: error.message
      });
      return data; // 中间件失败时返回原始数据
    }
  }

  /**
   * 更新平均处理时间
   */
  _updateAverageProcessingTime(processingTime) {
    const currentAverage = this.metrics.averageProcessingTime;
    const totalProcessed = this.metrics.eventsProcessed;

    // 指数移动平均
    const alpha = 0.1;
    this.metrics.averageProcessingTime = currentAverage * (1 - alpha) + processingTime * alpha;
  }
}

/**
 * 创建事件系统的工厂函数
 * @param {Object} options - 选项
 * @returns {EventSystem}
 */
export function createEventSystem(options = {}) {
  return new EventSystem(options);
}

/**
 * 全局事件系统实例
 */
export const globalEventSystem = createEventSystem();
