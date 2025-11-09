import {
  createDetailedErrorReporter,
  createStrictTestCleanup,
  setupStrictTestEnvironment,
  strictAssert,
  withTimeout,
} from './test-helpers.js';

/**
 * 异常处理集成测试
 * 测试全局异常处理器、优雅关闭管理器、资源清理器等组件的集成功能
 */

import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { CoreServiceProtector } from '../../../src/infrastructure/exception-handling/CoreServiceProtector.js';
import { ExceptionRecoveryStrategies } from '../../../src/infrastructure/exception-handling/ExceptionRecoveryStrategies.js';
import { GlobalExceptionHandler } from '../../../src/infrastructure/exception-handling/GlobalExceptionHandler.js';
import { GracefulShutdownManager } from '../../../src/infrastructure/exception-handling/GracefulShutdownManager.js';
import { ResourceCleaner } from '../../../src/infrastructure/exception-handling/ResourceCleaner.js';
import { EventBus } from '../../../src/shared/kernel/EventBus.js';
import { logger } from '../../../src/shared/utils/logger.js';

// Mock logger
vi.spyOn(logger, 'info').mockImplementation(() => {});
vi.spyOn(logger, 'warn').mockImplementation(() => {});
vi.spyOn(logger, 'error').mockImplementation(() => {});
vi.spyOn(logger, 'debug').mockImplementation(() => {});

describe('异常处理集成测试', () => {
  let eventBus;
  let globalHandler;
  let shutdownManager;
  let resourceCleaner;
  let serviceProtector;
  let recoveryStrategies;

  beforeAll(() => {
    eventBus = new EventBus();
  });

  beforeEach(() => {
    // 重置所有组件
    globalHandler = new GlobalExceptionHandler({
      eventBus,
      gracefulShutdown: vi.fn(),
    });

    shutdownManager = new GracefulShutdownManager({
      eventBus,
      shutdownTimeout: 5000, // 5秒，用于测试
    });

    resourceCleaner = new ResourceCleaner();
    resourceCleaner.initializePresetTypes();

    serviceProtector = new CoreServiceProtector({
      eventBus,
      healthCheckInterval: 1000, // 1秒，用于测试
    });

    recoveryStrategies = new ExceptionRecoveryStrategies({
      eventBus,
      recoveryTimeout: 2000, // 2秒，用于测试
    });
    recoveryStrategies.initializePresetStrategies();
  });

  afterEach(async () => {
    // 清理资源
    if (globalHandler) {
      globalHandler.uninstall();
    }
    if (shutdownManager) {
      await shutdownManager.stop();
    }
    if (serviceProtector) {
      serviceProtector.stop();
    }
  });

  describe('全局异常处理器集成', () => {
    it('应该正确处理未捕获异常', () => {
      const mockShutdown = vi.fn();
      globalHandler = new GlobalExceptionHandler({
        eventBus,
        gracefulShutdown: mockShutdown,
      });

      globalHandler.install();

      // 模拟未捕获异常
      const testError = new Error('Test uncaught exception');
      globalHandler.handleUncaughtException(testError);

      expect(mockShutdown).toHaveBeenCalled();
    });

    it('应该处理未处理的Promise拒绝', () => {
      globalHandler.install();

      const testError = new Error('Test unhandled rejection');
      const testPromise = Promise.reject(testError);

      // 手动触发未处理拒绝处理
      globalHandler.handleUnhandledRejection(testError, testPromise);

      expect(globalHandler.unhandledRejectionCount).toBe(1);
    });

    it('应该在过多未处理拒绝时执行紧急关闭', () => {
      const mockShutdown = vi.fn();
      globalHandler = new GlobalExceptionHandler({
        eventBus,
        gracefulShutdown: mockShutdown,
        maxUnhandledRejections: 2,
      });

      globalHandler.install();

      // 触发两次未处理拒绝
      const testError = new Error('Test rejection');
      globalHandler.handleUnhandledRejection(
        testError,
        Promise.reject(testError),
      );
      globalHandler.handleUnhandledRejection(
        testError,
        Promise.reject(testError),
      );

      expect(mockShutdown).toHaveBeenCalled();
    });
  });

  describe('优雅关闭管理器集成', () => {
    beforeEach(() => {
      shutdownManager.registerPresetCleaners();
    });

    it('应该按优先级顺序清理资源', async () => {
      const cleanupOrder = [];

      // 注册测试资源
      shutdownManager.registerResource('high_priority', {
        cleaner: async () => {
          cleanupOrder.push('high');
        },
        priority: 10,
      });

      shutdownManager.registerResource('medium_priority', {
        cleaner: async () => {
          cleanupOrder.push('medium');
        },
        priority: 50,
      });

      shutdownManager.registerResource('low_priority', {
        cleaner: async () => {
          cleanupOrder.push('low');
        },
        priority: 100,
      });

      await shutdownManager.performGracefulShutdown('test');

      expect(cleanupOrder).toEqual(['high', 'medium', 'low']);
    });

    it('应该处理资源清理失败', async () => {
      shutdownManager.registerResource('failing_resource', {
        cleaner: async () => {
          throw new Error('Cleanup failed');
        },
        priority: 10,
      });

      const result = await shutdownManager.performGracefulShutdown('test');

      expect(result.failedCleanups).toBe(1);
      expect(result.successfulCleanups).toBe(0);
    });

    it('应该在超时后强制完成', async () => {
      shutdownManager = new GracefulShutdownManager({
        eventBus,
        shutdownTimeout: 100, // 100ms超时
      });

      shutdownManager.registerResource('slow_resource', {
        cleaner: async () => {
          await new Promise((resolve) => setTimeout(resolve, 200)); // 200ms延迟
        },
        priority: 10,
      });

      const startTime = Date.now();
      await shutdownManager.performGracefulShutdown('test');
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(500); // 应该在500ms内完成
    });
  });

  describe('资源清理器集成', () => {
    it('应该清理指定类型的资源', async () => {
      // 注册不同类型的资源
      resourceCleaner.register('timer1', 'timers', [
        setTimeout(() => {}, 1000),
      ]);
      resourceCleaner.register('timer2', 'timers', [
        setTimeout(() => {}, 1000),
      ]);
      resourceCleaner.register('connection1', 'connections', { end: vi.fn() });

      const results = await resourceCleaner.cleanupByType('timers');

      expect(results.length).toBe(2);
      expect(results.every((r) => r.success)).toBe(true);
    });

    it('应该清理所有资源', async () => {
      // 注册各种资源
      resourceCleaner.register('timer', 'timers', [setTimeout(() => {}, 1000)]);
      resourceCleaner.register('connection', 'connections', {
        end: vi.fn().mockResolvedValue(true),
      });

      const results = await resourceCleaner.cleanupAll();

      expect(results.total).toBe(2);
      expect(results.successful).toBe(2);
      expect(results.failed).toBe(0);
    });

    it('应该支持资源作用域', async () => {
      const scope = resourceCleaner.createScope('test_scope');

      scope.register('scoped_timer', 'timers', [setTimeout(() => {}, 1000)]);
      scope.register('scoped_connection', 'connections', {
        end: vi.fn().mockResolvedValue(true),
      });

      // 清理作用域
      const results = await scope.cleanup();

      expect(results.length).toBe(2);
      expect(results.every((r) => r.success)).toBe(true);

      // 作用域资源应该已被清理
      expect(scope.list()).toHaveLength(0);
    });
  });

  describe('核心服务保护器集成', () => {
    beforeEach(async () => {
      // 注册测试服务
      serviceProtector.registerService('database', {
        name: 'Database Service',
        healthCheck: vi.fn().mockResolvedValue(true),
        fallback: vi.fn().mockResolvedValue('fallback_data'),
        timeout: 1000,
      });

      serviceProtector.registerService('cache', {
        name: 'Cache Service',
        healthCheck: vi.fn().mockResolvedValue(true),
        fallback: vi.fn().mockResolvedValue('cache_fallback'),
        timeout: 1000,
      });
    });

    it('应该在服务正常时执行操作', async () => {
      const result = await serviceProtector.executeProtected(
        'database',
        async () => {
          return 'operation_result';
        },
      );

      expect(result).toBe('operation_result');

      const status = serviceProtector.getServiceStatus('database');
      expect(status.health.successRate).toBe(1);
    });

    it('应该在服务失败时使用降级方案', async () => {
      const result = await serviceProtector.executeProtected(
        'database',
        async () => {
          throw new Error('Service unavailable');
        },
      );

      expect(result).toBe('fallback_data');

      const status = serviceProtector.getServiceStatus('database');
      expect(status.health.successRate).toBe(0);
    });

    it('应该在多次失败后打开断路器', async () => {
      // 模拟多次失败
      for (let i = 0; i < 6; i++) {
        await serviceProtector.executeProtected('database', async () => {
          throw new Error('Persistent failure');
        });
      }

      const status = serviceProtector.getServiceStatus('database');
      expect(status.circuitBreaker.state).toBe('open');
    });

    it('应该在断路器打开时直接使用降级方案', async () => {
      // 先打开断路器
      serviceProtector.forceOpenCircuit('database');

      const result = await serviceProtector.executeProtected(
        'database',
        async () => {
          return 'should_not_execute';
        },
      );

      expect(result).toBe('fallback_data');
    });

    it('应该执行健康检查', async () => {
      await serviceProtector.start();

      // 等待健康检查执行
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const status = serviceProtector.getServiceStatus('database');
      expect(status.health.status).toBe('healthy');
    });
  });

  describe('异常恢复策略集成', () => {
    it('应该成功恢复连接异常', async () => {
      const recoveryResult = await recoveryStrategies.recover(
        new Error('connect ECONNREFUSED 127.0.0.1:5432'),
        {
          reconnect: vi.fn().mockResolvedValue('reconnected'),
        },
      );

      expect(recoveryResult).toBe('reconnected');

      const history = recoveryStrategies.getRecoveryHistory();
      expect(history[0].status).toBe('success');
      expect(history[0].exceptionType).toBe('connection_refused');
    });

    it('应该在恢复失败后重新抛出异常', async () => {
      await expect(
        recoveryStrategies.recover(
          new Error('connect ECONNREFUSED 127.0.0.1:5432'),
          {
            reconnect: vi.fn().mockRejectedValue(new Error('Still failing')),
          },
        ),
      ).rejects.toThrow('Still failing');

      const history = recoveryStrategies.getRecoveryHistory();
      expect(history[0].status).toBe('failed');
    });

    it('应该重试失败的恢复操作', async () => {
      let attempts = 0;
      const mockReconnect = vi
        .fn()
        .mockImplementationOnce(() => {
          attempts++;
          throw new Error('Attempt 1 failed');
        })
        .mockImplementationOnce(() => {
          attempts++;
          throw new Error('Attempt 2 failed');
        })
        .mockImplementationOnce(() => {
          attempts++;
          return 'success_on_third_try';
        });

      const result = await recoveryStrategies.recover(
        new Error('connect ECONNREFUSED 127.0.0.1:5432'),
        { reconnect: mockReconnect },
      );

      expect(result).toBe('success_on_third_try');
      expect(attempts).toBe(3);

      const history = recoveryStrategies.getRecoveryHistory();
      expect(history[0].attempts.length).toBe(3);
    });

    it('应该正确分类异常类型', () => {
      const testCases = [
        {
          error: new Error('connect ECONNREFUSED'),
          expected: 'connection_refused',
        },
        {
          error: new Error('getaddrinfo ENOTFOUND'),
          expected: 'dns_lookup_failed',
        },
        { error: new Error('Validation failed'), expected: 'validation_error' },
        { error: new Error('Some random error'), expected: 'generic_error' },
      ];

      for (const { error, expected } of testCases) {
        const classified = recoveryStrategies.classifyException(error);
        expect(classified).toBe(expected);
      }
    });

    it('应该提供恢复统计信息', async () => {
      // 执行几次恢复
      await recoveryStrategies.recover(new Error('connect ECONNREFUSED'), {
        reconnect: vi.fn().mockResolvedValue('ok'),
      });

      await recoveryStrategies.recover(new Error('connect ECONNREFUSED'), {
        reconnect: vi.fn().mockRejectedValue(new Error('fail')),
      });

      const stats = recoveryStrategies.getRecoveryStats();
      expect(stats.total).toBe(2);
      expect(stats.successful).toBe(1);
      expect(stats.failed).toBe(1);
      expect(stats.successRate).toBe(0.5);
    });
  });

  describe('完整异常处理流程', () => {
    it('应该集成所有组件处理复杂异常场景', async () => {
      // 1. 设置资源清理器
      const timerId = setTimeout(() => {}, 1000);
      resourceCleaner.register('test_timer', 'timers', [timerId]);

      // 2. 设置服务保护器
      serviceProtector.registerService('critical_service', {
        name: 'Critical Service',
        healthCheck: vi.fn().mockResolvedValue(false), // 模拟不健康
        fallback: vi.fn().mockResolvedValue('service_fallback'),
      });

      // 3. 设置优雅关闭管理器
      shutdownManager.registerResource('test_resource', {
        cleaner: async () => {
          logger.info('Cleaning test resource');
          return true;
        },
        priority: 10,
      });

      // 4. 模拟服务调用失败并使用恢复策略
      try {
        await serviceProtector.executeProtected(
          'critical_service',
          async () => {
            throw new Error('connect ECONNREFUSED 127.0.0.1:8080');
          },
        );
      } catch (error) {
        // 服务调用失败，使用降级
        expect(error.message).toContain('ECONNREFUSED');
      }

      // 5. 尝试恢复异常
      await recoveryStrategies.recover(
        new Error('connect ECONNREFUSED 127.0.0.1:8080'),
        {
          reconnect: vi.fn().mockResolvedValue('recovered_connection'),
        },
      );

      // 6. 执行优雅关闭
      const shutdownResult =
        await shutdownManager.performGracefulShutdown('integration_test');

      // 验证结果
      expect(shutdownResult.successfulCleanups).toBeGreaterThan(0);
      expect(shutdownResult.failedCleanups).toBe(0);

      // 验证资源已被清理
      const remainingResources = resourceCleaner.list();
      expect(remainingResources.length).toBe(0);

      // 验证恢复历史
      const recoveryHistory = recoveryStrategies.getRecoveryHistory();
      expect(recoveryHistory.length).toBeGreaterThan(0);
      expect(recoveryHistory[0].status).toBe('success');
    });
  });
});
