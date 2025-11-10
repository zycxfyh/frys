/**
 * frys - 追踪数据上报器
 * 负责将追踪数据上报到外部系统
 */

import { logger } from '../../shared/utils/logger.js';

export class TracingReporter {
  constructor(config = {}) {
    this.type = config.type || 'console'; // console, http, kafka, file, advanced
    this.endpoint = config.endpoint || 'http://localhost:9411/api/v2/spans';
    this.batchSize = config.batchSize || 100;
    this.flushInterval = config.flushInterval || 5000; // 5秒
    this.maxRetries = config.maxRetries || 3;
    this.timeout = config.timeout || 5000; // 5秒超时
    this.headers = config.headers || {
      'Content-Type': 'application/json',
    };

    // 高级跟踪报告算法配置
    this.advancedConfig = {
      intelligentBatching: config.intelligentBatching !== false,
      adaptiveCompression: config.adaptiveCompression !== false,
      priorityReporting: config.priorityReporting !== false,
      predictiveReporting: config.predictiveReporting !== false,
      anomalyDetection: config.anomalyDetection !== false,
      costOptimization: config.costOptimization !== false,
      multiDestination: config.multiDestination !== false,
      qualityOfService: config.qualityOfService !== false,
    };

    this.pendingSpans = [];
    this.flushTimer = null;
    this.isRunning = false;

    // 高级数据结构
    this.spanPriorities = new Map(); // span优先级
    this.spanRelationships = new Map(); // span关系图
    this.reportingHistory = new Map(); // 报告历史
    this.destinationStats = new Map(); // 目标统计
    this.compressionStats = new Map(); // 压缩统计
    this.anomalyPatterns = new Map(); // 异常模式
    this.costMetrics = new Map(); // 成本指标

    // 自适应算法参数
    this.batchSizeAdaptation = {
      currentBatchSize: this.batchSize,
      minBatchSize: 10,
      maxBatchSize: 1000,
      adaptationRate: 0.1,
      lastAdjustment: Date.now(),
    };

    this.stats = {
      spansReceived: 0,
      spansReported: 0,
      batchesSent: 0,
      batchesFailed: 0,
      bytesSent: 0,
      compressionSavings: 0,
      prioritySpans: 0,
      anomalySpans: 0,
      costSavings: 0,
    };
  }

  /**
   * 启动上报器
   */
  async start() {
    if (this.isRunning) return;
    this.isRunning = true;

    // 启动定期刷新定时器
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.flushInterval);

    logger.info('启动追踪数据上报器', {
      type: this.type,
      endpoint: this.endpoint,
      batchSize: this.batchSize,
    });
  }

  /**
   * 停止上报器
   */
  async stop() {
    if (!this.isRunning) return;
    this.isRunning = false;

    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // 最后一次刷新
    await this.flush();

    logger.info('停止追踪数据上报器');
  }

  /**
   * 上报跨度数据
   * @param {Array} spans - 跨度数组
   */
  async report(spans) {
    if (!Array.isArray(spans)) {
      spans = [spans];
    }

    const startTime = Date.now();

    // 智能span处理
    for (const span of spans) {
      await this._processSpan(span);
    }

    this.pendingSpans.push(...spans);
    this.stats.spansReceived += spans.length;

    // 应用高级报告策略
    if (this.advancedConfig.intelligentBatching) {
      await this._applyIntelligentBatching();
    } else {
      // 如果达到批量大小，立即刷新
      if (this.pendingSpans.length >= this.batchSizeAdaptation.currentBatchSize) {
        await this.flush();
      }
    }

    // 记录报告指标
    this._updateReportingMetrics(spans, Date.now() - startTime);
  }

  /**
   * 刷新待上报数据
   */
  async flush() {
    if (this.pendingSpans.length === 0) {
      return;
    }

    const spansToSend = [...this.pendingSpans];
    this.pendingSpans = [];

    try {
      await this._sendBatch(spansToSend);
      this.stats.spansReported += spansToSend.length;
      this.stats.batchesSent++;

      logger.debug('追踪数据批量上报成功', {
        batchSize: spansToSend.length,
        totalReported: this.stats.spansReported,
      });
    } catch (error) {
      logger.error('追踪数据批量上报失败', error);

      // 重新放回队列（最多重试一次）
      if (this.pendingSpans.length === 0) {
        this.pendingSpans = spansToSend;
      }

      this.stats.batchesFailed++;
    }
  }

  /**
   * 发送数据批次
   * @param {Array} spans - 跨度数组
   */
  async _sendBatch(spans) {
    switch (this.type) {
      case 'console':
        return this._sendToConsole(spans);
      case 'http':
        return this._sendToHttp(spans);
      case 'file':
        return this._sendToFile(spans);
      case 'kafka':
        return this._sendToKafka(spans);
      default:
        throw new Error(`不支持的上报类型: ${this.type}`);
    }
  }

  /**
   * 发送到控制台（开发环境）
   */
  async _sendToConsole(spans) {
    console.log('📊 追踪数据:', JSON.stringify(spans, null, 2));
  }

  /**
   * 发送到HTTP端点
   */
  async _sendToHttp(spans) {
    const payload = JSON.stringify(spans);
    this.stats.bytesSent += Buffer.byteLength(payload, 'utf8');

    let lastError;

    // 重试逻辑
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(this.endpoint, {
          method: 'POST',
          headers: this.headers,
          body: payload,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return;
      } catch (error) {
        lastError = error;
        logger.warn(`HTTP上报尝试 ${attempt} 失败`, { error: error.message });

        if (attempt < this.maxRetries) {
          // 指数退避
          await new Promise((resolve) =>
            setTimeout(resolve, 2 ** attempt * 1000),
          );
        }
      }
    }

    throw lastError;
  }

  /**
   * 发送到文件
   */
  async _sendToFile(spans) {
    const fs = await import('fs/promises');
    const path = await import('path');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `traces-${timestamp}.json`;
    const filepath = path.join(process.cwd(), 'traces', filename);

    // 确保目录存在
    await fs.mkdir(path.dirname(filepath), { recursive: true });

    const payload = JSON.stringify(spans, null, 2);
    this.stats.bytesSent += Buffer.byteLength(payload, 'utf8');

    await fs.writeFile(filepath, payload, 'utf8');

    logger.debug('追踪数据已写入文件', { filepath, spanCount: spans.length });
  }

  /**
   * 发送到Kafka（生产环境）
   */
  async _sendToKafka(spans) {
    // 这里需要集成Kafka客户端
    // 为了简化，我们使用HTTP代理到Kafka REST API
    const kafkaPayload = {
      records: [
        {
          value: {
            spans,
            timestamp: Date.now(),
          },
        },
      ],
    };

    await this._sendToHttp(kafkaPayload);
  }

  /**
   * 转换为Jaeger格式
   * @param {Array} spans - frys跨度
   */
  _convertToJaegerFormat(spans) {
    // Jaeger格式转换（简化实现）
    return spans.map((span) => ({
      traceId: span.traceId,
      spanId: span.spanId,
      operationName: span.name,
      references: span.references.map((ref) => ({
        refType: ref.type === 'child_of' ? 'CHILD_OF' : 'FOLLOWS_FROM',
        traceId: ref.traceId,
        spanId: ref.spanId,
      })),
      startTime: span.startTime * 1000, // 微秒
      duration: span.duration * 1000, // 微秒
      tags: Object.entries(span.tags).map(([key, value]) => ({
        key,
        value: String(value),
        type: typeof value === 'number' ? 'int64' : 'string',
      })),
      logs: span.logs.map((log) => ({
        timestamp: log.timestamp * 1000,
        fields: Object.entries(log.fields).map(([key, value]) => ({
          key,
          value: String(value),
          type: typeof value === 'number' ? 'int64' : 'string',
        })),
      })),
    }));
  }

  /**
   * 转换为Zipkin格式
   * @param {Array} spans - frys跨度
   */
  _convertToZipkinFormat(spans) {
    // Zipkin格式转换（简化实现）
    return spans.map((span) => ({
      traceId: span.traceId,
      parentId: span.parentSpanId,
      id: span.spanId,
      kind: span.kind.toUpperCase(),
      name: span.name,
      timestamp: span.startTime * 1000, // 微秒
      duration: span.duration * 1000, // 微秒
      localEndpoint: {
        serviceName: span.tags.get('service.name') || 'unknown',
      },
      tags: Object.fromEntries(span.tags),
      annotations: span.logs.map((log) => ({
        timestamp: log.timestamp * 1000,
        value: log.event,
      })),
    }));
  }

  /**
   * 获取上报统计信息
   */
  getStats() {
    return {
      ...this.stats,
      pendingSpans: this.pendingSpans.length,
      isRunning: this.isRunning,
      type: this.type,
      endpoint: this.endpoint,
      batchSize: this.batchSize,
    };
  }

  /**
   * 设置上报端点
   * @param {string} endpoint - 新端点
   */
  setEndpoint(endpoint) {
    this.endpoint = endpoint;
    logger.info('更新上报端点', { endpoint });
  }

  /**
   * 设置请求头
   * @param {object} headers - 请求头
   */
  setHeaders(headers) {
    this.headers = { ...this.headers, ...headers };
    logger.info('更新请求头', { headers });
  }

  /**
   * 健康检查
   */
  async healthCheck() {
    if (this.type === 'http') {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(
          this.endpoint.replace('/api/v2/spans', '/health'),
          {
            method: 'GET',
            signal: controller.signal,
          },
        );

        clearTimeout(timeoutId);
        return response.ok;
      } catch (error) {
        return false;
      }
    }

    return true; // 其他类型的上报器默认健康
  }
}

/**
 * 预定义上报器
 */

// 控制台上报器（开发环境）
export class ConsoleReporter extends TracingReporter {
  constructor() {
    super({ type: 'console' });
  }
}

// HTTP上报器（生产环境）
export class HttpReporter extends TracingReporter {
  constructor(config = {}) {
    super({
      type: 'http',
      endpoint:
        config.endpoint ||
        process.env.TRACING_ENDPOINT ||
        'http://localhost:9411/api/v2/spans',
      headers: {
        'Content-Type': 'application/json',
        Authorization: config.apiKey ? `Bearer ${config.apiKey}` : undefined,
        ...config.headers,
      },
      ...config,
    });
  }
}

// Jaeger上报器
export class JaegerReporter extends TracingReporter {
  constructor(config = {}) {
    super({
      type: 'http',
      endpoint: config.endpoint || 'http://localhost:14268/api/traces',
      batchSize: config.batchSize || 50,
      ...config,
    });
  }

  async _sendBatch(spans) {
    const jaegerSpans = this._convertToJaegerFormat(spans);
    const payload = JSON.stringify({
      data: jaegerSpans,
    });

    // 调用父类的HTTP发送方法
    return super._sendToHttp(jaegerSpans);
  }
}

// Zipkin上报器
export class ZipkinReporter extends TracingReporter {
  constructor(config = {}) {
    super({
      type: 'http',
      endpoint: config.endpoint || 'http://localhost:9411/api/v2/spans',
      ...config,
    });
  }

  async _sendBatch(spans) {
    const zipkinSpans = this._convertToZipkinFormat(spans);
    return super._sendToHttp(zipkinSpans);
  }

}

// 文件上报器（调试环境）
export class FileReporter extends TracingReporter {
  constructor(config = {}) {
    super({
      type: 'file',
      flushInterval: config.flushInterval || 10000, // 10秒
      ...config,
    });
  }
}
