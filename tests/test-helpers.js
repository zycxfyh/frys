/**
 * 🏃‍♂️ 严格快速失败测试辅助工具 (GitHub社区最佳实践)
 *
 * 特性:
 * - 严格超时控制
 * - 内存泄漏检测
 * - 快速失败机制
 * - 详细错误报告
 * - 资源清理保证
 */

import { performance } from 'perf_hooks';
import { logger } from '../src/shared/utils/logger.js';

// 📊 测试性能监控
class TestPerformanceMonitor {
  constructor() {
    this.startTime = performance.now();
    this.memoryStart = process.memoryUsage();
    this.timeouts = new Set();
  }

  // 记录超时句柄用于清理
  addTimeout(timeoutId) {
    this.timeouts.add(timeoutId);
    return timeoutId;
  }

  // 清理所有超时
  clearAllTimeouts() {
    this.timeouts.forEach(id => clearTimeout(id));
    this.timeouts.clear();
  }

  // 检测内存泄漏
  checkMemoryLeak() {
    const memoryEnd = process.memoryUsage();
    const memoryDiff = {
      rss: memoryEnd.rss - this.memoryStart.rss,
      heapUsed: memoryEnd.heapUsed - this.memoryStart.heapUsed,
      external: memoryEnd.external - this.memoryStart.external,
    };

    // 警告阈值 (MB)
    const WARNING_THRESHOLD = 50 * 1024 * 1024; // 50MB

    if (Math.abs(memoryDiff.heapUsed) > WARNING_THRESHOLD) {
      logger.warn('🚨 可能的内存泄漏检测到', {
        memoryDiff: {
          rss: `${(memoryDiff.rss / 1024 / 1024).toFixed(2)}MB`,
          heapUsed: `${(memoryDiff.heapUsed / 1024 / 1024).toFixed(2)}MB`,
          external: `${(memoryDiff.external / 1024 / 1024).toFixed(2)}MB`,
        },
        testDuration: `${(performance.now() - this.startTime).toFixed(2)}ms`,
      });
    }
  }

  // 获取性能报告
  getReport() {
    const duration = performance.now() - this.startTime;
    return {
      duration: `${duration.toFixed(2)}ms`,
      memoryUsage: process.memoryUsage(),
    };
  }
}

// 🏁 严格测试环境设置
export function setupStrictTestEnvironment(options = {}) {
  const monitor = new TestPerformanceMonitor();
  const isCI = process.env.CI === 'true';

  // 🚀 设置严格超时
  const TEST_TIMEOUT = options.timeout || (isCI ? 3000 : 5000); // CI环境更严格
  const HOOK_TIMEOUT = options.hookTimeout || (isCI ? 1000 : 2000);

  // 设置Jest兼容的超时
  if (typeof jest !== 'undefined') {
    jest.setTimeout(TEST_TIMEOUT);
  }

  // 🔒 全局错误处理
  const originalOnError = process.listeners('uncaughtException')[0];
  const originalOnRejection = process.listeners('unhandledRejection')[0];

  process.on('uncaughtException', (error) => {
    logger.error('💥 未捕获的异常 - 快速失败', {
      error: error.message,
      stack: error.stack?.split('\n').slice(0, 5).join('\n'),
      testFile: expect.getState?.()?.testPath || 'unknown',
    });
    monitor.clearAllTimeouts();
    throw error; // 重新抛出以触发快速失败
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('💥 未处理的Promise拒绝 - 快速失败', {
      reason: reason?.message || reason,
      testFile: expect.getState?.()?.testPath || 'unknown',
    });
    monitor.clearAllTimeouts();
    throw reason; // 重新抛出以触发快速失败
  });

  return {
    monitor,
    TEST_TIMEOUT,
    HOOK_TIMEOUT,
    cleanup: () => {
      // 恢复原始错误处理器
      if (originalOnError) {
        process.off('uncaughtException', originalOnError);
        process.on('uncaughtException', originalOnError);
      }
      if (originalOnRejection) {
        process.off('unhandledRejection', originalOnRejection);
        process.on('unhandledRejection', originalOnRejection);
      }

      monitor.clearAllTimeouts();
      monitor.checkMemoryLeak();
    }
  };
}

// 🧹 严格的测试清理工具
export function createStrictTestCleanup(monitor) {
  return async () => {
    try {
      // 强制垃圾回收 (如果可用)
      if (global.gc) {
        global.gc();
      }

      // 检查内存泄漏
      monitor.checkMemoryLeak();

      // 清理可能的全局状态
      if (typeof jest !== 'undefined') {
        // 清理Jest mocks
        jest.clearAllMocks();
        jest.clearAllTimers();
      }

      // 清理事件监听器
      process.removeAllListeners('warning');

      // 性能报告
      const report = monitor.getReport();
      if (report.duration > 1000) { // 超过1秒的测试发出警告
        logger.warn('🐌 慢测试检测', report);
      }

    } catch (error) {
      logger.error('🧹 测试清理失败', { error: error.message });
      throw error;
    }
  };
}

// 🚦 快速失败断言工具
export function strictAssert(condition, message, details = {}) {
  if (!condition) {
    const error = new Error(`🚫 严格断言失败: ${message}`);
    error.details = details;
    error.strictFailure = true; // 标记为严格失败，CI环境会立即停止

    logger.error('🚫 严格断言失败', {
      message,
      details,
      testFile: expect.getState?.()?.testPath || 'unknown',
      currentTest: expect.getState?.()?.currentTestName || 'unknown',
    });

    throw error;
  }
}

// ⏱️ 带超时的异步操作包装器
export function withTimeout(promise, timeoutMs, operationName = 'operation') {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      const error = new Error(`⏰ ${operationName} 超时 (${timeoutMs}ms)`);
      error.timeout = true;
      reject(error);
    }, timeoutMs);

    promise
      .then(result => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch(error => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

// 🔍 资源泄漏检测器
export class ResourceLeakDetector {
  constructor() {
    this.initialResources = this.captureResources();
  }

  captureResources() {
    return {
      listeners: {
        uncaughtException: process.listenerCount('uncaughtException'),
        unhandledRejection: process.listenerCount('unhandledRejection'),
        warning: process.listenerCount('warning'),
      },
      timers: this.countActiveTimers(),
      memory: process.memoryUsage(),
    };
  }

  countActiveTimers() {
    // 这是一个近似值，实际很难精确统计
    return 0; // Node.js没有直接的方法获取活跃定时器数量
  }

  checkLeaks() {
    const currentResources = this.captureResources();
    const leaks = [];

    // 检查事件监听器泄漏
    Object.keys(currentResources.listeners).forEach(event => {
      const diff = currentResources.listeners[event] - this.initialResources.listeners[event];
      if (diff > 0) {
        leaks.push(`${event} listeners: +${diff}`);
      }
    });

    // 检查内存使用异常
    const memoryDiff = currentResources.memory.heapUsed - this.initialResources.memory.heapUsed;
    if (memoryDiff > 10 * 1024 * 1024) { // 10MB
      leaks.push(`内存泄漏: +${(memoryDiff / 1024 / 1024).toFixed(2)}MB`);
    }

    if (leaks.length > 0) {
      logger.warn('🚨 资源泄漏检测', { leaks });
      return leaks;
    }

    return null;
  }
}

// 📝 详细错误报告器
export function createDetailedErrorReporter(testName) {
  return (error) => {
    const errorDetails = {
      testName,
      errorType: error.constructor.name,
      message: error.message,
      stack: error.stack?.split('\n').slice(0, 10).join('\n'),
      timestamp: new Date().toISOString(),
    };

    // 添加额外上下文
    if (error.details) {
      errorDetails.context = error.details;
    }

    if (error.timeout) {
      errorDetails.timeout = true;
    }

    if (error.strictFailure) {
      errorDetails.strictFailure = true;
    }

    logger.error('💥 测试失败详情', errorDetails);

    // 在CI环境中提供GitHub Actions格式的输出
    if (process.env.CI) {
      console.log(`::error title=${testName}::${error.message}`);
    }

    return errorDetails;
  };
}

// 🎯 快速失败测试包装器
export function createFastFailTest(testFn, options = {}) {
  return async () => {
    const { monitor, cleanup } = setupStrictTestEnvironment(options);
    const leakDetector = new ResourceLeakDetector();
    const errorReporter = createDetailedErrorReporter(options.testName || 'unknown');

    try {
      // 执行测试
      const result = await testFn();

      // 检查资源泄漏
      const leaks = leakDetector.checkLeaks();
      if (leaks && options.failOnLeaks !== false) {
        throw new Error(`资源泄漏检测失败: ${leaks.join(', ')}`);
      }

      return result;

    } catch (error) {
      // 详细错误报告
      errorReporter(error);

      // 重新抛出以触发vitest的失败处理
      throw error;

    } finally {
      // 确保清理
      await cleanup();
    }
  };
}
