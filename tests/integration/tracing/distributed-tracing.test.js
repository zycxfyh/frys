/**
 * 分布式追踪集成测试
 * 测试追踪器、跨度、中间件和上下文管理的集成功能
 */

import { describe, it, expect, beforeAll, afterAll, vi, beforeEach, afterEach } from 'vitest';
import { Tracer } from '../../../src/infrastructure/tracing/Tracer.js';
import { Span } from '../../../src/infrastructure/tracing/Span.js';
import { SamplingStrategy, AlwaysOnSampling } from '../../../src/infrastructure/tracing/SamplingStrategy.js';
import { ConsoleReporter } from '../../../src/infrastructure/tracing/TracingReporter.js';
import { TracingMiddleware } from '../../../src/infrastructure/tracing/TracingMiddleware.js';
import { TraceContext, TraceContextManager } from '../../../src/infrastructure/tracing/TraceContext.js';
import { logger } from '../../../src/utils/logger.js';

// Mock logger
vi.spyOn(logger, 'info').mockImplementation(() => {});
vi.spyOn(logger, 'warn').mockImplementation(() => {});
vi.spyOn(logger, 'error').mockImplementation(() => {});
vi.spyOn(logger, 'debug').mockImplementation(() => {});

// Mock fetch for HTTP requests
global.fetch = vi.fn();

describe('分布式追踪集成测试', () => {
  let tracer;
  let mockReporter;

  beforeAll(() => {
    // Mock fetch
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({})
    });
  });

  beforeEach(() => {
    mockReporter = {
      report: vi.fn().mockResolvedValue(true),
      start: vi.fn().mockResolvedValue(true),
      stop: vi.fn().mockResolvedValue(true)
    };

    tracer = new Tracer({
      serviceName: 'test-service',
      serviceVersion: '1.0.0',
      samplingStrategy: new AlwaysOnSampling(), // 总是采样以便测试
      reporter: mockReporter,
      reportInterval: 1000 // 1秒上报间隔，用于测试
    });
  });

  afterEach(async () => {
    if (tracer && tracer.isRunning) {
      await tracer.stop();
    }
  });

  describe('追踪器核心功能', () => {
    it('应该创建和完成跨度', async () => {
      await tracer.start();

      const span = tracer.createSpan('test_operation', {
        component: 'test',
        'test.key': 'test_value'
      });

      expect(span).toBeTruthy();
      expect(span.name).toBe('test_operation');
      expect(span.tags.get('component')).toBe('test');
      expect(span.tags.get('test.key')).toBe('test_value');

      // 完成跨度
      span.finish();

      // 等待上报
      await new Promise(resolve => setTimeout(resolve, 1100));

      expect(mockReporter.report).toHaveBeenCalled();
      const reportedSpans = mockReporter.report.mock.calls[0][0];
      expect(reportedSpans).toHaveLength(1);
      expect(reportedSpans[0].name).toBe('test_operation');
    });

    it('应该支持嵌套跨度', async () => {
      await tracer.start();

      const parentSpan = tracer.createSpan('parent_operation');
      const childSpan = tracer.createChildSpan(parentSpan, 'child_operation');

      expect(childSpan).toBeTruthy();
      expect(childSpan.traceId).toBe(parentSpan.traceId);
      expect(childSpan.parentSpanId).toBe(parentSpan.spanId);

      childSpan.finish();
      parentSpan.finish();

      // 等待上报
      await new Promise(resolve => setTimeout(resolve, 1100));

      expect(mockReporter.report).toHaveBeenCalled();
      const reportedSpans = mockReporter.report.mock.calls[0][0];
      expect(reportedSpans).toHaveLength(2);

      const parentReported = reportedSpans.find(s => s.name === 'parent_operation');
      const childReported = reportedSpans.find(s => s.name === 'child_operation');

      expect(parentReported).toBeTruthy();
      expect(childReported).toBeTruthy();
      expect(childReported.parentSpanId).toBe(parentReported.spanId);
    });

    it('应该包装函数自动创建跨度', async () => {
      await tracer.start();

      const testFunction = async (param) => {
        return `result_${param}`;
      };

      const result = await tracer.traceFunction('wrapped_function', () => testFunction('test'));

      expect(result).toBe('result_test');

      // 等待上报
      await new Promise(resolve => setTimeout(resolve, 1100));

      expect(mockReporter.report).toHaveBeenCalled();
      const reportedSpans = mockReporter.report.mock.calls[0][0];
      expect(reportedSpans[0].name).toBe('wrapped_function');
    });
  });

  describe('跨度功能', () => {
    let span;

    beforeEach(async () => {
      await tracer.start();
      span = tracer.createSpan('test_span');
    });

    it('应该设置和获取标签', () => {
      span.setTag('string_tag', 'value');
      span.setTag('number_tag', 42);
      span.setTag('boolean_tag', true);

      expect(span.getTag('string_tag')).toBe('value');
      expect(span.getTag('number_tag')).toBe(42);
      expect(span.getTag('boolean_tag')).toBe(true);
    });

    it('应该记录日志', () => {
      span.log('test_event', { key: 'value' });

      expect(span.logs).toHaveLength(1);
      expect(span.logs[0].event).toBe('test_event');
      expect(span.logs[0].fields.key).toBe('value');
    });

    it('应该处理错误', () => {
      const error = new Error('Test error');
      span.setError(error);

      expect(span.status).toBe('error');
      expect(span.error.name).toBe('Error');
      expect(span.error.message).toBe('Test error');
      expect(span.tags.get('error')).toBe(true);
    });

    it('应该注入和提取上下文', () => {
      const carrier = {};
      span.inject(carrier, 'http_headers');

      expect(carrier['x-trace-id']).toBe(span.traceId);
      expect(carrier['x-span-id']).toBe(span.spanId);

      const extracted = Span.extract(carrier, 'http_headers');
      expect(extracted.traceId).toBe(span.traceId);
      expect(extracted.spanId).toBe(span.spanId);
    });

    it('应该转换为JSON格式', () => {
      span.setTag('test', 'value');
      span.log('test_log', { data: 'test' });
      span.finish();

      const json = span.toJSON();

      expect(json.traceId).toBe(span.traceId);
      expect(json.spanId).toBe(span.spanId);
      expect(json.name).toBe(span.name);
      expect(json.tags.test).toBe('value');
      expect(json.logs).toHaveLength(1);
      expect(json.duration).toBeGreaterThan(0);
    });
  });

  describe('采样策略', () => {
    it('应该支持概率采样', () => {
      const strategy = new SamplingStrategy({ samplingRate: 0.5 });

      // 由于是概率采样，我们运行多次来验证
      let sampled = 0;
      let total = 1000;

      for (let i = 0; i < total; i++) {
        if (strategy.shouldSample('test')) {
          sampled++;
        }
      }

      // 采样率应该接近0.5（允许一些误差）
      const actualRate = sampled / total;
      expect(actualRate).toBeGreaterThan(0.4);
      expect(actualRate).toBeLessThan(0.6);
    });

    it('应该支持总是采样', () => {
      const strategy = new AlwaysOnSampling();

      for (let i = 0; i < 100; i++) {
        expect(strategy.shouldSample('test')).toBe(true);
      }
    });

    it('应该支持基于规则的采样', () => {
      const strategy = new SamplingStrategy({
        type: 'rules_based',
        rules: [
          { operationPattern: 'error_.*', sample: true },
          { operationPattern: 'normal_.*', sample: false }
        ]
      });

      expect(strategy.shouldSample('error_operation')).toBe(true);
      expect(strategy.shouldSample('normal_operation')).toBe(false);
      expect(strategy.shouldSample('other_operation')).toBe(true); // 默认概率采样
    });
  });

  describe('HTTP中间件', () => {
    let middleware;

    beforeEach(() => {
      middleware = new TracingMiddleware(tracer, {
        includeHeaders: true,
        includeQuery: true,
        excludePaths: ['/health']
      });
    });

    it('应该为HTTP请求创建跨度', async () => {
      await tracer.start();

      const mockReq = {
        method: 'GET',
        path: '/api/test',
        originalUrl: '/api/test?param=value',
        protocol: 'http',
        get: vi.fn((header) => {
          if (header === 'host') return 'localhost:3000';
          if (header === 'user-agent') return 'test-agent';
          return undefined;
        }),
        headers: {
          'x-trace-id': 'test-trace-id',
          'x-span-id': 'test-span-id'
        },
        query: { param: 'value' },
        socket: { remoteAddress: '127.0.0.1', remotePort: 12345 }
      };

      const mockRes = {
        writeHead: vi.fn(),
        setHeader: vi.fn(),
        end: vi.fn(),
        statusCode: 200,
        getHeader: vi.fn(() => '123')
      };

      let nextCalled = false;
      const next = () => { nextCalled = true; };

      // 执行中间件
      await middleware.middleware()(mockReq, mockRes, next);

      // 完成响应
      mockRes.end();

      expect(nextCalled).toBe(true);
      expect(mockReq.tracingSpan).toBeTruthy();
      expect(mockReq.tracingSpan.name).toBe('GET /api/test');

      // 等待上报
      await new Promise(resolve => setTimeout(resolve, 1100));
      expect(mockReporter.report).toHaveBeenCalled();
    });

    it('应该跳过排除的路径', async () => {
      const mockReq = {
        method: 'GET',
        path: '/health',
        originalUrl: '/health',
        protocol: 'http',
        get: vi.fn(() => 'localhost:3000'),
        headers: {},
        query: {}
      };

      const mockRes = {
        writeHead: vi.fn(),
        setHeader: vi.fn(),
        end: vi.fn(),
        statusCode: 200
      };

      let nextCalled = false;
      const next = () => { nextCalled = true; };

      await middleware.middleware()(mockReq, mockRes, next);

      expect(nextCalled).toBe(true);
      expect(mockReq.tracingSpan).toBeUndefined();
    });
  });

  describe('追踪上下文', () => {
    let contextManager;

    beforeEach(() => {
      contextManager = new TraceContextManager();
    });

    it('应该管理上下文生命周期', async () => {
      const context = { traceId: 'test-trace', spanId: 'test-span' };

      let capturedContext = null;
      await contextManager.withContext(context, async () => {
        capturedContext = contextManager.traceContext.getCurrent();
        expect(capturedContext.traceId).toBe('test-trace');
        expect(capturedContext.spanId).toBe('test-span');
      });

      // 上下文应该在执行后清理
      expect(contextManager.traceContext.getCurrent()).toBeUndefined();
    });

    it('应该支持嵌套上下文', async () => {
      const rootContext = { traceId: 'root-trace', spanId: 'root-span' };
      const childContext = { spanId: 'child-span' };

      await contextManager.withContext(rootContext, async () => {
        expect(contextManager.traceContext.getCurrent().traceId).toBe('root-trace');

        await contextManager.withChildContext(childContext, async () => {
          const current = contextManager.traceContext.getCurrent();
          expect(current.traceId).toBe('root-trace');
          expect(current.spanId).toBe('child-span');
          expect(current.parentSpanId).toBe('root-span');
        });

        // 回到父上下文
        expect(contextManager.traceContext.getCurrent().spanId).toBe('root-span');
      });
    });

    it('应该支持上下文注入和提取', () => {
      const context = {
        traceId: 'inject-trace',
        spanId: 'inject-span',
        baggage: new Map([['user', 'test-user']])
      };

      const carrier = {};
      TraceContext.inject(context, carrier, 'http_headers');

      expect(carrier['x-trace-id']).toBe('inject-trace');
      expect(carrier['x-span-id']).toBe('inject-span');
      expect(carrier['x-baggage-user']).toBe('test-user');

      const extracted = TraceContext.extract(carrier, 'http_headers');
      expect(extracted.traceId).toBe('inject-trace');
      expect(extracted.spanId).toBe('inject-span');
      expect(extracted.baggage.get('user')).toBe('test-user');
    });
  });

  describe('端到端场景', () => {
    it('应该支持完整的请求追踪流程', async () => {
      await tracer.start();

      // 1. 创建根跨度（模拟HTTP请求）
      const rootSpan = tracer.createSpan('http_request', {
        'http.method': 'GET',
        'http.url': '/api/users',
        component: 'http'
      });

      // 2. 在上下文中执行数据库查询
      await tracer.traceFunction('db_query', async () => {
        // 模拟数据库查询
        await new Promise(resolve => setTimeout(resolve, 10));

        // 创建子跨度（模拟缓存查询）
        const cacheSpan = tracer.createChildSpan(rootSpan, 'cache_get', {
          component: 'redis',
          'cache.key': 'users:list'
        });

        cacheSpan.log('cache_miss');
        cacheSpan.finish();

        return { users: [] };
      });

      // 3. 创建外部API调用跨度
      const apiSpan = tracer.createChildSpan(rootSpan, 'external_api_call', {
        component: 'http_client',
        'http.method': 'GET',
        'http.url': 'https://api.example.com/data'
      });

      apiSpan.setTag('http.status_code', 200);
      apiSpan.finish();

      // 4. 完成根跨度
      rootSpan.setTag('http.status_code', 200);
      rootSpan.finish();

      // 等待上报
      await new Promise(resolve => setTimeout(resolve, 1100));

      expect(mockReporter.report).toHaveBeenCalled();
      const reportedSpans = mockReporter.report.mock.calls[0][0];

      // 应该有4个跨度：根跨度 + db_query + cache_get + external_api_call
      expect(reportedSpans).toHaveLength(4);

      // 验证跨度关系
      const rootReported = reportedSpans.find(s => s.name === 'http_request');
      const dbReported = reportedSpans.find(s => s.name === 'db_query');
      const cacheReported = reportedSpans.find(s => s.name === 'cache_get');
      const apiReported = reportedSpans.find(s => s.name === 'external_api_call');

      expect(rootReported).toBeTruthy();
      expect(dbReported.parentSpanId).toBe(rootReported.spanId);
      expect(cacheReported.parentSpanId).toBe(dbReported.spanId);
      expect(apiReported.parentSpanId).toBe(rootReported.spanId);

      // 验证标签和日志
      expect(rootReported.tags['http.method']).toBe('GET');
      expect(apiReported.tags['http.status_code']).toBe(200);
      expect(cacheReported.logs.some(log => log.event === 'cache_miss')).toBe(true);
    });

    it('应该处理错误场景', async () => {
      await tracer.start();

      const span = tracer.createSpan('error_operation');

      try {
        // 模拟抛出错误的操作
        throw new Error('Something went wrong');
      } catch (error) {
        span.setError(error);
      } finally {
        span.finish();
      }

      // 等待上报
      await new Promise(resolve => setTimeout(resolve, 1100));

      expect(mockReporter.report).toHaveBeenCalled();
      const reportedSpans = mockReporter.report.mock.calls[0][0];
      expect(reportedSpans).toHaveLength(1);

      const reported = reportedSpans[0];
      expect(reported.status).toBe('error');
      expect(reported.error.message).toBe('Something went wrong');
      expect(reported.tags.error).toBe(true);
    });
  });

  describe('性能和资源管理', () => {
    it('应该限制活动跨度数量', async () => {
      const limitedTracer = new Tracer({
        maxActiveSpans: 2,
        samplingStrategy: new AlwaysOnSampling(),
        reporter: mockReporter
      });

      await limitedTracer.start();

      // 创建2个跨度（达到限制）
      const span1 = limitedTracer.createSpan('span1');
      const span2 = limitedTracer.createSpan('span2');

      expect(span1).toBeTruthy();
      expect(span2).toBeTruthy();

      // 第3个应该被拒绝
      const span3 = limitedTracer.createSpan('span3');
      expect(span3).toBeNull();

      span1.finish();
      span2.finish();

      await limitedTracer.stop();
    });

    it('应该定期清理和上报', async () => {
      await tracer.start();

      // 创建多个跨度
      for (let i = 0; i < 5; i++) {
        const span = tracer.createSpan(`test_span_${i}`);
        span.finish();
      }

      // 等待上报
      await new Promise(resolve => setTimeout(resolve, 1100));

      expect(mockReporter.report).toHaveBeenCalled();
      const reportedSpans = mockReporter.report.mock.calls[0][0];
      expect(reportedSpans.length).toBeGreaterThan(0);
    });
  });
});
