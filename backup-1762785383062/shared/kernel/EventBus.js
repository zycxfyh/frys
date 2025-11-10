/**
 * 事件总线
 * 实现发布-订阅模式，支持异步事件处理
 */

export class EventBus {
  constructor() {
    this._handlers = new Map();
    this._middlewares = [];
    this._processingQueue = [];
    this._isProcessing = false;
  }

  /**
   * 订阅事件
   */
  subscribe(event, handler, priority = 0) {
    if (!this._handlers.has(event)) {
      this._handlers.set(event, []);
    }

    this._handlers.get(event).push({ handler, priority });
    // 按优先级排序（高优先级先执行）
    this._handlers.get(event).sort((a, b) => b.priority - a.priority);

    return this;
  }

  /**
   * 取消订阅
   */
  unsubscribe(event, handler) {
    if (this._handlers.has(event)) {
      const handlers = this._handlers.get(event);
      const index = handlers.findIndex((h) => h.handler === handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
    return this;
  }

  /**
   * 发布事件
   */
  async publish(event, data = {}) {
    const eventPayload = {
      type: event,
      data,
      timestamp: new Date().toISOString(),
      id: this._generateId(),
    };

    // 添加到处理队列
    this._processingQueue.push(eventPayload);

    // 开始处理（如果没有正在处理）
    if (!this._isProcessing) {
      await this._processQueue();
    }

    return eventPayload.id;
  }

  /**
   * 添加中间件
   */
  use(middleware) {
    this._middlewares.push(middleware);
    return this;
  }

  /**
   * 处理事件队列
   */
  async _processQueue() {
    if (this._isProcessing || this._processingQueue.length === 0) {
      return;
    }

    this._isProcessing = true;

    while (this._processingQueue.length > 0) {
      const event = this._processingQueue.shift();
      await this._processEvent(event);
    }

    this._isProcessing = false;
  }

  /**
   * 处理单个事件
   */
  async _processEvent(event) {
    const handlers = this._handlers.get(event.type) || [];

    if (handlers.length === 0) {
      console.warn(`No handlers found for event: ${event.type}`);
      return;
    }

    // 执行中间件链
    let context = { event, handlers: [...handlers] };

    for (const middleware of this._middlewares) {
      context = await middleware(context);
    }

    // 执行处理器
    const results = [];
    for (const { handler } of context.handlers) {
      try {
        const result = await handler(event.data, event);
        results.push({ success: true, result });
      } catch (error) {
        console.error(`Event handler failed for ${event.type}:`, error);
        results.push({ success: false, error: error.message });

        // 可以在这里添加重试逻辑或死信队列
      }
    }

    return results;
  }

  /**
   * 获取事件处理器
   */
  getHandlers(event) {
    return this._handlers.get(event) || [];
  }

  /**
   * 获取所有事件类型
   */
  getEventTypes() {
    return Array.from(this._handlers.keys());
  }

  /**
   * 清空所有处理器
   */
  clear() {
    this._handlers.clear();
    this._middlewares = [];
    this._processingQueue = [];
  }

  /**
   * 获取状态
   */
  getStatus() {
    return {
      eventTypes: this.getEventTypes().length,
      totalHandlers: Array.from(this._handlers.values()).reduce(
        (sum, handlers) => sum + handlers.length,
        0,
      ),
      queuedEvents: this._processingQueue.length,
      isProcessing: this._isProcessing,
      middlewares: this._middlewares.length,
    };
  }

  /**
   * 生成事件ID
   */
  _generateId() {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 创建一次性处理器
   */
  once(event, handler, priority = 0) {
    const onceHandler = async (data, eventData) => {
      this.unsubscribe(event, onceHandler);
      return await handler(data, eventData);
    };

    return this.subscribe(event, onceHandler, priority);
  }

  /**
   * 等待事件
   */
  async waitFor(event, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.unsubscribe(event, handler);
        reject(new Error(`Timeout waiting for event: ${event}`));
      }, timeout);

      const handler = (data, eventData) => {
        clearTimeout(timeoutId);
        resolve({ data, event: eventData });
      };

      this.once(event, handler);
    });
  }
}
