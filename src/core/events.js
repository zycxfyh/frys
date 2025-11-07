/**
 * WokeFlow 事件系统配置
 * 使用 EventEmitter3 替代自建的 EventStream
 */

import { EventEmitter } from 'eventemitter3';
import { resolve } from './container.js';
import { logger } from '../utils/logger.js';

// 创建全局事件发射器实例
const eventEmitter = new EventEmitter();

// 设置最大监听器数量（避免内存泄漏警告）
if (typeof eventEmitter.setMaxListeners === 'function') {
  eventEmitter.setMaxListeners(100);
}

/**
 * 事件系统类
 */
class EventSystem {
  constructor() {
    this.emitter = eventEmitter;
    this.listeners = new Map();
    this.middlewares = [];
  }

  /**
   * 监听事件
   */
  on(event, listener, context = null) {
    const wrappedListener = this._wrapWithMiddleware(event, listener, context);

    this.emitter.on(event, wrappedListener);

    // 记录监听器以便后续清理
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add({ listener, wrappedListener, context });

    logger.debug(`📡 事件监听器已注册: ${event}`, {
      context: context?.constructor?.name || 'anonymous',
    });

    return this;
  }

  /**
   * 监听一次性事件
   */
  once(event, listener, context = null) {
    const wrappedListener = this._wrapWithMiddleware(event, listener, context);

    this.emitter.once(event, wrappedListener);

    logger.debug(`📡 一次性事件监听器已注册: ${event}`, {
      context: context?.constructor?.name || 'anonymous',
    });

    return this;
  }

  /**
   * 移除事件监听器
   */
  off(event, listener = null, context = null) {
    if (listener) {
      // 移除特定监听器
      const eventListeners = this.listeners.get(event);
      if (eventListeners) {
        const toRemove = Array.from(eventListeners).find(
          (item) => item.listener === listener && item.context === context
        );

        if (toRemove) {
          this.emitter.off(event, toRemove.wrappedListener);
          eventListeners.delete(toRemove);
          logger.debug(`📡 事件监听器已移除: ${event}`);
        }
      }
    } else {
      // 移除所有该事件的监听器
      this.emitter.removeAllListeners(event);
      this.listeners.delete(event);
      logger.debug(`📡 所有事件监听器已移除: ${event}`);
    }

    return this;
  }

  /**
   * 发射事件
   */
  emit(event, ...args) {
    logger.debug(`📡 事件已发射: ${event}`, {
      argsCount: args.length,
      args: args.map(arg => typeof arg === 'object' ? '[Object]' : arg),
    });

    this.emitter.emit(event, ...args);
    return this;
  }

  /**
   * 获取事件监听器数量
   */
  listenerCount(event) {
    return this.emitter.listenerCount(event);
  }

  /**
   * 获取所有事件名称
   */
  eventNames() {
    return this.emitter.eventNames();
  }

  /**
   * 添加中间件
   */
  use(middleware) {
    this.middlewares.push(middleware);
    logger.debug('📡 事件中间件已添加');
    return this;
  }

  /**
   * 用中间件包装监听器
   */
  _wrapWithMiddleware(event, listener, context) {
    let wrappedListener = listener;

    // 从后往前应用中间件
    for (let i = this.middlewares.length - 1; i >= 0; i--) {
      const middleware = this.middlewares[i];
      const originalListener = wrappedListener;

      wrappedListener = async (...args) => {
        try {
          await middleware(event, originalListener, context, ...args);
        } catch (error) {
          logger.error(`📡 事件中间件执行失败: ${event}`, error);
          // 中间件失败时仍执行原始监听器
          await originalListener(...args);
        }
      };
    }

    return wrappedListener;
  }

  /**
   * 等待事件（Promise 版本）
   */
  waitFor(event, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.off(event, eventListener);
        reject(new Error(`等待事件超时: ${event} (${timeout}ms)`));
      }, timeout);

      const eventListener = (...args) => {
        clearTimeout(timeoutId);
        this.off(event, eventListener);
        resolve(args);
      };

      this.once(event, eventListener);
    });
  }

  /**
   * 创建命名空间事件发射器
   */
  of(namespace) {
    const namespacedEmitter = {
      on: (event, listener, context) => this.on(`${namespace}:${event}`, listener, context),
      once: (event, listener, context) => this.once(`${namespace}:${event}`, listener, context),
      off: (event, listener, context) => this.off(`${namespace}:${event}`, listener, context),
      emit: (event, ...args) => this.emit(`${namespace}:${event}`, ...args),
      waitFor: (event, timeout) => this.waitFor(`${namespace}:${event}`, timeout),
    };

    return namespacedEmitter;
  }

  /**
   * 获取统计信息
   */
  getStats() {
    const eventNames = this.eventNames();
    const stats = {
      totalEvents: eventNames.length,
      totalListeners: 0,
      events: {},
      middlewares: this.middlewares.length,
    };

    for (const eventName of eventNames) {
      const count = this.listenerCount(eventName);
      stats.totalListeners += count;
      stats.events[eventName] = count;
    }

    return stats;
  }

  /**
   * 清理所有监听器
   */
  removeAllListeners() {
    this.emitter.removeAllListeners();
    this.listeners.clear();
    logger.info('🧹 所有事件监听器已清理');
  }
}

// 创建全局事件系统实例
const eventSystem = new EventSystem();

// 添加默认中间件：错误处理和日志记录
eventSystem.use(async (event, listener, context, ...args) => {
  try {
    await listener(...args);
  } catch (error) {
    logger.error(`📡 事件处理失败: ${event}`, {
      error: error.message,
      stack: error.stack,
      context: context?.constructor?.name || 'anonymous',
    });

    // 发射错误事件
    eventSystem.emit('event:error', {
      event,
      error,
      context,
      args,
      timestamp: Date.now(),
    });

    // 尝试使用错误处理器
    try {
      const errorHandler = resolve('errorHandler');
      if (errorHandler) {
        await errorHandler.handle(error, {
          context: 'event_processing',
          event,
          eventArgs: args,
        });
      }
    } catch (handlerError) {
      logger.error('📡 事件错误处理器执行失败', handlerError);
    }
  }
});

// 导出
export { eventSystem, EventSystem };
export default eventSystem;
