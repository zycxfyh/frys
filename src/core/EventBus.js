/**
 * 轻量级事件总线
 */

export class EventBus {
  constructor() {
    this.listeners = new Map();
    this.middlewares = [];
  }

  /**
   * 订阅事件
   */
  on(event, listener) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(listener);
  }

  /**
   * 取消订阅事件
   */
  off(event, listener) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.delete(listener);
      if (listeners.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  /**
   * 订阅一次性事件
   */
  once(event, listener) {
    const onceListener = (...args) => {
      this.off(event, onceListener);
      listener(...args);
    };
    this.on(event, onceListener);
  }

  /**
   * 发布事件
   */
  async emit(event, ...args) {
    const listeners = this.listeners.get(event);
    if (!listeners || listeners.size === 0) {
      return;
    }

    // 应用中间件
    let processedArgs = args;
    for (const middleware of this.middlewares) {
      try {
        processedArgs = await middleware(event, ...processedArgs);
        if (processedArgs === false) {
          return; // 中间件阻止事件传播
        }
      } catch (error) {
        console.error(`事件中间件执行失败: ${event}`, error);
      }
    }

    // 通知所有监听器
    const promises = Array.from(listeners).map(async (listener) => {
      try {
        await listener(...processedArgs);
      } catch (error) {
        console.error(`事件监听器执行失败: ${event}`, error);
      }
    });

    await Promise.all(promises);
  }

  /**
   * 添加中间件
   */
  use(middleware) {
    this.middlewares.push(middleware);
  }

  /**
   * 移除中间件
   */
  removeMiddleware(middleware) {
    const index = this.middlewares.indexOf(middleware);
    if (index > -1) {
      this.middlewares.splice(index, 1);
    }
  }

  /**
   * 获取事件监听器数量
   */
  listenerCount(event) {
    const listeners = this.listeners.get(event);
    return listeners ? listeners.size : 0;
  }

  /**
   * 获取所有事件名称
   */
  eventNames() {
    return Array.from(this.listeners.keys());
  }

  /**
   * 清空所有监听器
   */
  clear() {
    this.listeners.clear();
    this.middlewares.length = 0;
  }

  /**
   * 创建命名空间事件总线
   */
  namespace(ns) {
    const namespaced = Object.create(this);
    namespaced.namespace = ns;

    // 重写方法以添加命名空间
    namespaced.on = (event, listener) => {
      this.on(`${ns}:${event}`, listener);
    };

    namespaced.off = (event, listener) => {
      this.off(`${ns}:${event}`, listener);
    };

    namespaced.once = (event, listener) => {
      this.once(`${ns}:${event}`, listener);
    };

    namespaced.emit = (event, ...args) => {
      return this.emit(`${ns}:${event}`, ...args);
    };

    return namespaced;
  }
}

// 导出单例实例
export const eventBus = new EventBus();
