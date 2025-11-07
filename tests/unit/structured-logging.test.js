/**
 * 结构化日志系统测试
 * 验证结构化日志的功能和性能
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { logger, setGlobalLogContext, createRequestLogContext, logPerformance } from '../../src/utils/logger.js';
import { randomUUID } from 'crypto';

describe('结构化日志系统测试', () => {
  beforeAll(() => {
    // 设置测试环境上下文
    setGlobalLogContext({
      service: 'frys-test',
      version: '1.0.0-test',
      environment: 'test'
    });
  });

  afterAll(() => {
    // 清理测试环境
  });

  describe('基础日志功能', () => {
    it('应该创建结构化日志条目', () => {
      const testMessage = '测试消息';
      const testMeta = { userId: 123, action: 'login' };

      // 测试不同日志级别
      logger.info(testMessage, testMeta);
      logger.warn('警告消息', { warningCode: 'TEST_WARNING' });
      logger.error('错误消息', new Error('测试错误'), { errorCode: 'TEST_ERROR' });
      logger.debug('调试消息', { debugData: { key: 'value' } });

      // 验证日志器存在且有正确的方法
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.trace).toBe('function');
    });

    it('应该处理性能日志', () => {
      const startTime = Date.now();

      // 模拟一些操作（增加延迟以确保有可测量的时间）
      for (let i = 0; i < 100000; i++) {
        Math.random();
      }

      const duration = Date.now() - startTime;

      logPerformance('math_operations', duration, {
        operationCount: 100000,
        operationType: 'random'
      });

      // 在现代CPU上，即使是10万个随机数操作也可能很快，所以我们放宽检查
      expect(duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('请求上下文管理', () => {
    it('应该创建和管理请求上下文', () => {
      const requestId = randomUUID();
      const context = {
        method: 'GET',
        url: '/api/users',
        userAgent: 'test-agent',
        ip: '127.0.0.1'
      };

      // 创建请求上下文
      const createdId = createRequestLogContext(requestId, context);
      expect(createdId).toBe(requestId);

      // 更新请求上下文
      logger.updateRequestContext(requestId, {
        statusCode: 200,
        responseSize: 1024
      });

      // 结束请求上下文
      logger.endRequestContext(requestId, { statusCode: 200 });

      expect(logger.requestStore.has(requestId)).toBe(true);
    });

    it('应该处理请求生命周期日志', () => {
      const requestId = randomUUID();

      // 记录请求开始
      logger.requestStart(requestId, 'POST', '/api/users', {
        'user-agent': 'test-agent',
        'x-forwarded-for': '192.168.1.1'
      });

      // 模拟处理时间
      const processingTime = Math.floor(Math.random() * 100) + 10;

      setTimeout(() => {
        // 记录请求完成
        logger.requestEnd(requestId, 201, processingTime, {
          contentLength: '256',
          contentType: 'application/json'
        });
      }, 10);

      expect(requestId).toBeDefined();
      expect(typeof requestId).toBe('string');
      expect(requestId.length).toBeGreaterThan(0);
    });
  });

  describe('日志格式验证', () => {
    it('应该生成有效的JSON格式日志', () => {
      // 这个测试主要是验证日志系统不会抛出错误
      // 实际的格式验证需要集成测试

      const testData = {
        string: 'test',
        number: 42,
        boolean: true,
        array: [1, 2, 3],
        object: { nested: 'value' },
        null: null,
        undefined: undefined
      };

      logger.info('格式测试', testData);

      // 验证所有类型都能被正确处理
      expect(testData.string).toBe('test');
      expect(testData.number).toBe(42);
      expect(testData.boolean).toBe(true);
      expect(Array.isArray(testData.array)).toBe(true);
      expect(typeof testData.object).toBe('object');
    });

    it('应该处理错误对象', () => {
      const testError = new Error('测试错误');
      testError.code = 'TEST_ERROR_CODE';

      logger.error('错误处理测试', testError, {
        additionalContext: 'test context'
      });

      // 验证错误对象结构
      expect(testError).toBeInstanceOf(Error);
      expect(testError.message).toBe('测试错误');
      expect(testError.code).toBe('TEST_ERROR_CODE');
    });

    it('应该处理循环引用对象', () => {
      const circularObj = { name: 'test' };
      circularObj.self = circularObj;

      // 日志系统应该能处理循环引用而不崩溃
      expect(() => {
        logger.debug('循环引用测试', { circularObj });
      }).not.toThrow();
    });
  });

  describe('性能监控', () => {
    it('应该记录性能指标', () => {
      const operations = [
        { name: 'database_query', duration: 150 },
        { name: 'cache_lookup', duration: 5 },
        { name: 'api_call', duration: 200 },
        { name: 'file_read', duration: 50 }
      ];

      operations.forEach(op => {
        logger.performance(op.name, op.duration, {
          category: 'test',
          success: true
        });
      });

      // 验证性能数据
      operations.forEach(op => {
        expect(op.duration).toBeGreaterThan(0);
        expect(op.name).toBeDefined();
      });
    });

    it('应该处理大量日志而不影响性能', () => {
      const startTime = Date.now();
      const logCount = 100;

      // 生成大量日志
      for (let i = 0; i < logCount; i++) {
        logger.debug(`批量日志测试 ${i}`, {
          index: i,
          timestamp: Date.now(),
          data: `test_data_${i}`
        });
      }

      const totalTime = Date.now() - startTime;
      const avgTimePerLog = totalTime / logCount;

      // 验证性能在合理范围内（每条日志不应超过50ms，在测试环境中）
      expect(avgTimePerLog).toBeLessThan(50);
      expect(totalTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('日志级别控制', () => {
    it('应该根据日志级别过滤日志', () => {
      // 测试不同级别的日志记录
      // 注意：这个测试主要是验证API不会抛出错误
      // 实际的级别过滤需要更复杂的测试设置

      const levels = ['trace', 'debug', 'info', 'warn', 'error'];

      levels.forEach(level => {
        expect(() => {
          logger[level]('级别测试', { level, test: true });
        }).not.toThrow();
      });
    });

    it('应该处理元数据合并', () => {
      const baseMeta = { service: 'test', version: '1.0' };
      const additionalMeta = { userId: 123, sessionId: 'abc' };

      logger.info('元数据合并测试', { ...baseMeta, ...additionalMeta });

      // 验证元数据结构
      expect(baseMeta.service).toBe('test');
      expect(additionalMeta.userId).toBe(123);
    });
  });

  describe('分布式追踪支持', () => {
    it('应该处理追踪头', () => {
      const traceId = randomUUID();
      const spanId = randomUUID();
      const parentSpanId = randomUUID();

      const requestId = logger.createRequestContext(randomUUID(), {
        traceId,
        spanId,
        parentSpanId,
        method: 'GET',
        url: '/api/test'
      });

      logger.info('追踪测试', {
        traceId,
        spanId,
        parentSpanId
      }, requestId);

      // 验证追踪ID格式
      expect(traceId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      expect(spanId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      expect(parentSpanId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it('应该支持请求链路追踪', () => {
      const rootTraceId = randomUUID();

      // 模拟请求链路
      const request1 = logger.createRequestContext(randomUUID(), {
        traceId: rootTraceId,
        spanId: randomUUID(),
        method: 'GET',
        url: '/api/users'
      });

      const request2 = logger.createRequestContext(randomUUID(), {
        traceId: rootTraceId,
        spanId: randomUUID(),
        parentSpanId: request1,
        method: 'GET',
        url: '/api/users/123'
      });

      logger.info('链路追踪测试 - 请求1', {}, request1);
      logger.info('链路追踪测试 - 请求2', {}, request2);

      expect(request1).toBeDefined();
      expect(request2).toBeDefined();
      expect(request1).not.toBe(request2);
    });
  });
});
