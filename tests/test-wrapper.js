/**
 * 🚀 通用测试包装器 - 严格快速失败机制
 * GitHub社区最佳实践
 */

import {
  setupStrictTestEnvironment,
  createStrictTestCleanup,
  strictAssert,
  withTimeout,
  createDetailedErrorReporter
} from './test-helpers.js';

/**
 * 创建严格测试套件包装器
 * @param {string} suiteName - 测试套件名称
 * @param {Function} testSuite - 测试套件函数
 * @param {Object} options - 配置选项
 */
export function createStrictTestSuite(suiteName, testSuite, options = {}) {
  const isCI = process.env.CI === 'true';
  const testTimeout = options.timeout || (isCI ? 2000 : 5000);

  describe(suiteName, () => {
    let monitor;
    let cleanup;
    let errorReporter;

    beforeAll(() => {
      // 🔧 设置严格测试环境
      const env = setupStrictTestEnvironment({
        timeout: testTimeout,
        testName: suiteName,
        ...options
      });
      monitor = env.monitor;
      cleanup = env.cleanup;
      errorReporter = createDetailedErrorReporter(suiteName);
    });

    afterAll(async () => {
      // 🧹 严格清理
      await cleanup();
    });

    // 执行原始测试套件
    testSuite();
  });
}

/**
 * 严格异步测试包装器
 * @param {Function} testFn - 测试函数
 * @param {Object} options - 配置选项
 */
export async function strictAsyncTest(testFn, options = {}) {
  const isCI = process.env.CI === 'true';
  const timeout = options.timeout || (isCI ? 2000 : 5000);

  return withTimeout(testFn(), timeout, options.operationName || 'test operation');
}

/**
 * 快速失败断言包装器
 * @param {boolean} condition - 断言条件
 * @param {string} message - 错误消息
 * @param {Object} details - 详细信息
 */
export function strictTestAssert(condition, message, details = {}) {
  return strictAssert(condition, message, details);
}

/**
 * 创建带超时的测试钩子
 * @param {Function} hookFn - 钩子函数
 * @param {number} timeout - 超时时间
 */
export function createTimeoutHook(hookFn, timeout = 2000) {
  return async () => {
    await withTimeout(hookFn(), timeout, 'test hook');
  };
}
