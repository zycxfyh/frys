/**
 * WokeFlow - 分布式追踪器 (Tracer)
 * 管理和协调所有追踪操作的核心组件
 */

import { Span } from './Span.js';
import { SamplingStrategy } from './SamplingStrategy.js';
import { TracingReporter } from './TracingReporter.js';
import { logger } from '../../utils/logger.js';

export class Tracer {
  constructor(config = {}) {
    this.serviceName = config.serviceName || 'wokeflow';
    this.serviceVersion = config.serviceVersion || '1.0.0';
    this.samplingStrategy = config.samplingStrategy || new SamplingStrategy();
    this.reporter =
      config.reporter || new TracingReporter(config.reporterConfig);
    this.activeSpans = new Map();
    this.finishedSpans = [];
    this.maxActiveSpans = config.maxActiveSpans || 1000;
    this.maxFinishedSpans = config.maxFinishedSpans || 10000;
    this.reportInterval = config.reportInterval || 5000; // 5秒上报间隔
    this.reportTimer = null;
    this.isRunning = false;

    // 统计信息
    this.stats = {
      spansCreated: 0,
      spansFinished: 0,
      spansReported: 0,
      spansDropped: 0,
      tracesCreated: 0,
    };

    // 绑定方法
    this._onSpanFinished = this._onSpanFinished.bind(this);
    this._reportSpans = this._reportSpans.bind(this);
  }

  /**
   * 启动追踪器
   */
  async start() {
    if (this.isRunning) {
      logger.warn('追踪器已在运行中');
      return;
    }

    this.isRunning = true;
    logger.info('启动分布式追踪器', {
      serviceName: this.serviceName,
      serviceVersion: this.serviceVersion,
    });

    // 启动定期上报
    this.reportTimer = setInterval(this._reportSpans, this.reportInterval);

    // 启动采样策略
    if (this.samplingStrategy.start) {
      await this.samplingStrategy.start();
    }

    // 启动上报器
    if (this.reporter.start) {
      await this.reporter.start();
    }
  }

  /**
   * 停止追踪器
   */
  async stop() {
    if (!this.isRunning) {
      return;
    }

    logger.info('停止分布式追踪器');
    this.isRunning = false;

    if (this.reportTimer) {
      clearInterval(this.reportTimer);
      this.reportTimer = null;
    }

    // 上报剩余的跨度
    await this._reportSpans();

    // 停止采样策略
    if (this.samplingStrategy.stop) {
      await this.samplingStrategy.stop();
    }

    // 停止上报器
    if (this.reporter.stop) {
      await this.reporter.stop();
    }

    // 清理活动跨度
    this.activeSpans.clear();
  }

  /**
   * 创建新的跨度
   * @param {string} name - 跨度名称
   * @param {object} options - 选项
   */
  createSpan(name, options = {}) {
    // 检查是否应该采样
    const shouldSample = this.samplingStrategy.shouldSample(name, options);
    if (!shouldSample) {
      this.stats.spansDropped++;
      return null; // 不采样，返回空跨度
    }

    // 检查活动跨度数量限制
    if (this.activeSpans.size >= this.maxActiveSpans) {
      logger.warn('活动跨度数量达到上限，跳过创建', {
        activeCount: this.activeSpans.size,
        maxActive: this.maxActiveSpans,
      });
      this.stats.spansDropped++;
      return null;
    }

    const span = new Span(this, name, {
      ...options,
      serviceName: this.serviceName,
      serviceVersion: this.serviceVersion,
    });

    // 注册到活动跨度
    this.activeSpans.set(span.spanId, span);
    this.stats.spansCreated++;

    // 如果是根跨度，增加追踪计数
    if (!span.parentSpanId) {
      this.stats.tracesCreated++;
    }

    logger.debug('创建追踪跨度', {
      spanId: span.spanId,
      traceId: span.traceId,
      name: span.name,
    });

    return span;
  }

  /**
   * 获取当前活动跨度
   */
  getCurrentSpan() {
    // 返回最近创建的活动跨度（简化实现）
    const spans = Array.from(this.activeSpans.values());
    return spans[spans.length - 1] || null;
  }

  /**
   * 从上下文创建跨度
   * @param {object} context - 追踪上下文
   * @param {string} name - 跨度名称
   * @param {object} options - 选项
   */
  createSpanFromContext(context, name, options = {}) {
    if (!context) {
      return this.createSpan(name, options);
    }

    return this.createSpan(name, {
      ...options,
      traceId: context.traceId,
      parentSpanId: context.spanId,
    });
  }

  /**
   * 包装函数以自动创建跨度
   * @param {string} name - 跨度名称
   * @param {Function} fn - 要包装的函数
   * @param {object} options - 选项
   */
  async traceFunction(name, fn, options = {}) {
    const span = this.createSpan(name, options);

    if (!span) {
      // 不采样，直接执行函数
      return await fn();
    }

    try {
      const result = await fn(span);
      span.finish();
      return result;
    } catch (error) {
      span.setError(error);
      span.finish();
      throw error;
    }
  }

  /**
   * 包装方法以自动创建跨度
   * @param {object} target - 目标对象
   * @param {string} methodName - 方法名
   * @param {object} options - 选项
   */
  traceMethod(target, methodName, options = {}) {
    const originalMethod = target[methodName];
    const spanName = options.name || `${target.constructor.name}.${methodName}`;

    target[methodName] = async function (...args) {
      const span = this.tracer?.createSpan(spanName, {
        ...options,
        component: target.constructor.name,
        operation: methodName,
      });

      if (!span) {
        return await originalMethod.apply(this, args);
      }

      try {
        // 记录方法参数（如果启用）
        if (options.recordArgs) {
          span.log('method_call', {
            args: this._sanitizeArgs(args, options.maxArgLength || 100),
          });
        }

        const result = await originalMethod.apply(this, args);

        // 记录方法结果（如果启用）
        if (options.recordResult) {
          span.log('method_return', {
            result: this._sanitizeResult(
              result,
              options.maxResultLength || 100,
            ),
          });
        }

        span.finish();
        return result;
      } catch (error) {
        span.setError(error);
        span.finish();
        throw error;
      }
    }.bind(target);
  }

  /**
   * 创建子跨度
   * @param {Span} parentSpan - 父跨度
   * @param {string} name - 子跨度名称
   * @param {object} options - 选项
   */
  createChildSpan(parentSpan, name, options = {}) {
    if (!parentSpan) {
      return this.createSpan(name, options);
    }

    return parentSpan.createChild(name, options);
  }

  /**
   * 跨度完成回调
   * @param {Span} span - 完成的跨度
   */
  _onSpanFinished(span) {
    // 从活动跨度中移除
    this.activeSpans.delete(span.spanId);

    // 添加到完成队列
    this.finishedSpans.push(span);
    this.stats.spansFinished++;

    // 如果完成队列过大，立即上报
    if (this.finishedSpans.length >= this.maxFinishedSpans) {
      this._reportSpans();
    }

    logger.debug('跨度已完成', {
      spanId: span.spanId,
      traceId: span.traceId,
      duration: span.duration,
    });
  }

  /**
   * 上报跨度数据
   */
  async _reportSpans() {
    if (this.finishedSpans.length === 0) {
      return;
    }

    const spansToReport = [...this.finishedSpans];
    this.finishedSpans = [];

    try {
      await this.reporter.report(spansToReport);
      this.stats.spansReported += spansToReport.length;

      logger.debug('跨度数据已上报', {
        count: spansToReport.length,
        totalReported: this.stats.spansReported,
      });
    } catch (error) {
      logger.error('上报跨度数据失败', error);

      // 重新放回队列（最多重试一次）
      if (this.finishedSpans.length === 0) {
        this.finishedSpans = spansToReport;
      }
    }
  }

  /**
   * 清理过期数据
   */
  cleanup() {
    // 清理超时的活动跨度
    const now = Date.now();
    const timeoutMs = 300000; // 5分钟超时

    for (const [spanId, span] of this.activeSpans) {
      if (now - span.startTime > timeoutMs) {
        logger.warn('清理超时的活动跨度', {
          spanId,
          traceId: span.traceId,
          age: now - span.startTime,
        });
        span.finish(now);
      }
    }
  }

  /**
   * 获取追踪统计信息
   */
  getStats() {
    return {
      ...this.stats,
      activeSpans: this.activeSpans.size,
      finishedSpans: this.finishedSpans.length,
      isRunning: this.isRunning,
      serviceName: this.serviceName,
      serviceVersion: this.serviceVersion,
    };
  }

  /**
   * 获取活动跨度列表
   */
  getActiveSpans() {
    return Array.from(this.activeSpans.values()).map((span) => ({
      spanId: span.spanId,
      traceId: span.traceId,
      name: span.name,
      startTime: span.startTime,
      duration: Date.now() - span.startTime,
    }));
  }

  /**
   * 设置采样率
   * @param {number} rate - 采样率 (0-1)
   */
  setSamplingRate(rate) {
    if (this.samplingStrategy.setSamplingRate) {
      this.samplingStrategy.setSamplingRate(rate);
      logger.info('更新采样率', { rate });
    }
  }

  /**
   * 清理方法参数（用于记录）
   */
  _sanitizeArgs(args, maxLength) {
    return args.map((arg) => {
      if (typeof arg === 'string' && arg.length > maxLength) {
        return arg.substring(0, maxLength) + '...';
      }
      if (arg && typeof arg === 'object') {
        // 简化对象表示
        return `[${arg.constructor.name}]`;
      }
      return arg;
    });
  }

  /**
   * 清理方法结果（用于记录）
   */
  _sanitizeResult(result, maxLength) {
    if (typeof result === 'string' && result.length > maxLength) {
      return result.substring(0, maxLength) + '...';
    }
    if (result && typeof result === 'object') {
      return `[${result.constructor.name}]`;
    }
    return result;
  }

  /**
   * 创建追踪上下文
   */
  createTraceContext(span) {
    if (!span) return null;

    return {
      traceId: span.traceId,
      spanId: span.spanId,
      parentSpanId: span.parentSpanId,
      sampled: true,
      baggage: new Map(), // 用于传递额外数据
    };
  }

  /**
   * 设置追踪上下文
   */
  setTraceContext(context) {
    this.currentContext = context;
  }

  /**
   * 获取追踪上下文
   */
  getTraceContext() {
    return this.currentContext || null;
  }
}
