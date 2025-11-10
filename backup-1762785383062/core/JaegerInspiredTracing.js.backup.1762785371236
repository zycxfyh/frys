import { logger } from '../../shared/utils/logger.js';

/**
 * Jaeger 风格的分布式追踪
 * 借鉴 Jaeger 的追踪和可视化理念
 */

class JaegerInspiredTracing {
  constructor() {
    this.traces = new Map();
    this.spans = new Map();
  }

  createTrace(traceId) {
    const trace = {
      id: traceId,
      spans: [],
      startedAt: Date.now(),
    };

    this.traces.set(traceId, trace);
    logger.info(`��� 追踪已创建: ${traceId}`);
    return trace;
  }

  createSpan(traceId, operationName, parentSpanId = null) {
    const span = {
      id: `span_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      traceId,
      operationName,
      parentSpanId,
      tags: new Map(),
      logs: [],
      startedAt: Date.now(),
    };

    const trace = this.traces.get(traceId);
    if (trace) {
      trace.spans.push(span);
    }

    this.spans.set(span.id, span);
    logger.info(`  ��� Span已创建: ${operationName}`);
    return span;
  }

  finishSpan(spanId) {
    const span = this.spans.get(spanId);
    if (span) {
      span.finishedAt = Date.now();
      span.duration = span.finishedAt - span.startedAt;
      logger.info(
        `  ✅ Span已完成: ${span.operationName} (${span.duration}ms)`,
      );
    }
  }

  getStats() {
    return {
      traces: this.traces.size,
      spans: this.spans.size,
    };
  }
}

export default JaegerInspiredTracing;
