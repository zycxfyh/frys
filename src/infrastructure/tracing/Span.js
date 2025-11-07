/**
 * WokeFlow - 追踪跨度 (Span)
 * 分布式追踪的基本单位，代表一个操作或工作单元
 */

export class Span {
  constructor(tracer, name, options = {}) {
    this.tracer = tracer;
    this.name = name;
    this.traceId = options.traceId || this._generateTraceId();
    this.spanId = options.spanId || this._generateSpanId();
    this.parentSpanId = options.parentSpanId || null;
    this.startTime = options.startTime || Date.now();
    this.endTime = null;
    this.duration = null;
    this.tags = new Map();
    this.logs = [];
    this.references = options.references || [];
    this.kind = options.kind || 'internal'; // client, server, producer, consumer, internal
    this.status = 'ok'; // ok, error
    this.error = null;
    this.finished = false;

    // 性能指标
    this.metrics = {
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      eventLoopDelay: 0,
    };

    // 设置默认标签
    this.setTag('service.name', options.serviceName || 'wokeflow');
    this.setTag('service.version', options.serviceVersion || '1.0.0');
    this.setTag('span.kind', this.kind);
    this.setTag('component', options.component || 'unknown');

    // 如果是根跨度，设置根标签
    if (!this.parentSpanId) {
      this.setTag('span.root', true);
    }
  }

  /**
   * 设置跨度标签
   * @param {string} key - 标签键
   * @param {any} value - 标签值
   */
  setTag(key, value) {
    if (value !== null && value !== undefined) {
      this.tags.set(key, value);
    }
    return this;
  }

  /**
   * 获取标签值
   * @param {string} key - 标签键
   */
  getTag(key) {
    return this.tags.get(key);
  }

  /**
   * 批量设置标签
   * @param {object} tags - 标签对象
   */
  setTags(tags) {
    Object.entries(tags).forEach(([key, value]) => {
      this.setTag(key, value);
    });
    return this;
  }

  /**
   * 记录日志
   * @param {string} event - 日志事件
   * @param {object} fields - 日志字段
   * @param {number} timestamp - 时间戳
   */
  log(event, fields = {}, timestamp = Date.now()) {
    this.logs.push({
      timestamp,
      event,
      fields: { ...fields },
    });
    return this;
  }

  /**
   * 记录错误
   * @param {Error} error - 错误对象
   */
  setError(error) {
    this.status = 'error';
    this.error = {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error.code,
    };

    // 设置错误标签
    this.setTag('error', true);
    this.setTag('error.name', error.name);
    this.setTag('error.message', error.message);

    // 记录错误日志
    this.log('error', {
      error: error.message,
      stack: error.stack,
    });

    return this;
  }

  /**
   * 添加子跨度引用
   * @param {Span} childSpan - 子跨度
   */
  addChild(childSpan) {
    this.references.push({
      type: 'child_of',
      traceId: childSpan.traceId,
      spanId: childSpan.spanId,
    });
    return this;
  }

  /**
   * 添加跟随跨度引用
   * @param {Span} followedSpan - 被跟随的跨度
   */
  addFollowsFrom(followedSpan) {
    this.references.push({
      type: 'follows_from',
      traceId: followedSpan.traceId,
      spanId: followedSpan.spanId,
    });
    return this;
  }

  /**
   * 完成跨度
   * @param {number} endTime - 结束时间
   */
  finish(endTime = Date.now()) {
    if (this.finished) {
      return;
    }

    this.finished = true;
    this.endTime = endTime;
    this.duration = this.endTime - this.startTime;

    // 更新性能指标
    this.metrics.endMemoryUsage = process.memoryUsage();
    this.metrics.endCpuUsage = process.cpuUsage();

    // 计算资源使用差异
    this.metrics.memoryDelta =
      this.metrics.endMemoryUsage.heapUsed - this.metrics.memoryUsage.heapUsed;
    this.metrics.cpuDelta = {
      user: this.metrics.endCpuUsage.user - this.metrics.cpuUsage.user,
      system: this.metrics.endCpuUsage.system - this.metrics.cpuUsage.system,
    };

    // 设置持续时间标签
    this.setTag('duration_ms', this.duration);

    // 通知追踪器
    if (this.tracer) {
      this.tracer._onSpanFinished(this);
    }

    return this;
  }

  /**
   * 获取跨度上下文
   */
  getContext() {
    return {
      traceId: this.traceId,
      spanId: this.spanId,
      parentSpanId: this.parentSpanId,
      sampled: true, // 简化实现，总是采样
    };
  }

  /**
   * 转换为传输格式
   */
  toJSON() {
    return {
      traceId: this.traceId,
      spanId: this.spanId,
      parentSpanId: this.parentSpanId,
      name: this.name,
      kind: this.kind,
      startTime: this.startTime,
      endTime: this.endTime,
      duration: this.duration,
      status: this.status,
      error: this.error,
      tags: Object.fromEntries(this.tags),
      logs: this.logs,
      references: this.references,
      metrics: this.metrics,
    };
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
   * @param {number} length - ID长度
   */
  _generateId(length) {
    const chars = '0123456789abcdef';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * 创建子跨度
   * @param {string} name - 子跨度名称
   * @param {object} options - 选项
   */
  createChild(name, options = {}) {
    return this.tracer.createSpan(name, {
      ...options,
      traceId: this.traceId,
      parentSpanId: this.spanId,
    });
  }

  /**
   * 创建跟随跨度
   * @param {string} name - 跟随跨度名称
   * @param {object} options - 选项
   */
  createFollowsFrom(name, options = {}) {
    const span = this.tracer.createSpan(name, {
      ...options,
      traceId: this.traceId,
    });

    this.addFollowsFrom(span);
    return span;
  }

  /**
   * 注入上下文到载体
   * @param {object} carrier - 载体对象
   * @param {string} format - 格式
   */
  inject(carrier, format = 'http_headers') {
    if (format === 'http_headers') {
      carrier['x-trace-id'] = this.traceId;
      carrier['x-span-id'] = this.spanId;
      if (this.parentSpanId) {
        carrier['x-parent-span-id'] = this.parentSpanId;
      }
    } else if (format === 'binary') {
      // 二进制格式（简化实现）
      carrier.traceId = this.traceId;
      carrier.spanId = this.spanId;
      carrier.parentSpanId = this.parentSpanId;
    }

    return carrier;
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
      };
    } else if (format === 'binary') {
      return {
        traceId: carrier.traceId,
        spanId: carrier.spanId,
        parentSpanId: carrier.parentSpanId,
      };
    }

    return null;
  }
}
