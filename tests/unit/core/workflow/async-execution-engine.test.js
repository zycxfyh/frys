import {
  createDetailedErrorReporter,
  createStrictTestCleanup,
  setupStrictTestEnvironment,
  strictAssert,
  withTimeout,
} from '../../../test-helpers.js';

/**
 * AsyncExecutionEngine 单元测试
 */

import { AsyncExecutionEngine } from '../../../../src/core/workflow/AsyncExecutionEngine.js';

describe('AsyncExecutionEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new AsyncExecutionEngine({
      maxConcurrency: 5,
      resourcePoolSize: 10,
      monitoring: false, // 测试时关闭监控
    });
  });

  afterEach(() => {
    engine.cleanup();
  });

  test('should execute tasks in parallel', async () => {
    const tasks = [
      { id: 'task1', action: 'delay', delay: 100 },
      { id: 'task2', action: 'delay', delay: 100 },
      { id: 'task3', action: 'delay', delay: 100 },
    ];

    const startTime = Date.now();
    const results = await engine.executeTasks(tasks, { strategy: 'parallel' });
    const duration = Date.now() - startTime;

    expect(results).toHaveLength(3);
    expect(duration).toBeLessThan(200); // 并发执行应该很快完成
    results.forEach((result) => {
      expect(result.success).toBe(true);
      expect(result.executionTime).toBeGreaterThan(90);
    });
  });

  test('should execute tasks serially', async () => {
    const tasks = [
      { id: 'task1', action: 'delay', delay: 100 },
      { id: 'task2', action: 'delay', delay: 100 },
      { id: 'task3', action: 'delay', delay: 100 },
    ];

    const startTime = Date.now();
    const results = await engine.executeTasks(tasks, { strategy: 'serial' });
    const duration = Date.now() - startTime;

    expect(results).toHaveLength(3);
    expect(duration).toBeGreaterThan(250); // 串行执行应该较慢
    results.forEach((result) => {
      expect(result.success).toBe(true);
    });
  });

  test('should handle task failures gracefully', async () => {
    const tasks = [
      { id: 'task1', action: 'delay', delay: 50 },
      {
        id: 'task2',
        execute: async () => {
          throw new Error('Task failed');
        },
      },
      { id: 'task3', action: 'delay', delay: 50 },
    ];

    const results = await engine.executeTasks(tasks);
    expect(results).toHaveLength(3);

    const failedTask = results.find((r) => r.taskId === 'task2');
    expect(failedTask.success).toBe(false);
    expect(failedTask.error).toBe('Task failed');
  });

  test('should respect concurrency limits', async () => {
    engine = new AsyncExecutionEngine({
      maxConcurrency: 2,
      resourcePoolSize: 10,
      monitoring: false,
    });

    let runningCount = 0;
    let maxRunning = 0;

    const tasks = Array.from({ length: 5 }, (_, i) => ({
      id: `task${i}`,
      execute: async () => {
        runningCount++;
        maxRunning = Math.max(maxRunning, runningCount);
        await new Promise((resolve) => setTimeout(resolve, 50));
        runningCount--;
        return `result${i}`;
      },
    }));

    const results = await engine.executeTasks(tasks);
    expect(results).toHaveLength(5);
    expect(maxRunning).toBeLessThanOrEqual(2); // 不超过并发限制
  });

  test('should support adaptive concurrency', async () => {
    const tasks = [
      { id: 'task1', action: 'delay', delay: 50 },
      { id: 'task2', action: 'delay', delay: 50 },
      { id: 'task3', action: 'delay', delay: 50 },
    ];

    const results = await engine.executeTasks(tasks, { strategy: 'adaptive' });
    expect(results).toHaveLength(3);
    results.forEach((result) => {
      expect(result.success).toBe(true);
    });
  });

  test('should handle timeouts', async () => {
    const tasks = [
      {
        id: 'slow-task',
        execute: async () => {
          await new Promise((resolve) => setTimeout(resolve, 200));
          return 'completed';
        },
      },
    ];

    const results = await engine.executeTasks(tasks, { timeout: 100 });
    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
    expect(results[0].error).toContain('timeout');
  });

  test('should provide execution status', () => {
    const status = engine.getStatus();
    expect(status).toHaveProperty('isRunning');
    expect(status).toHaveProperty('currentConcurrency');
    expect(status).toHaveProperty('maxConcurrency');
    expect(status).toHaveProperty('resourcePool');
    expect(status).toHaveProperty('metrics');
  });
});
