/**
 * 🚀 VCP异步执行引擎
 *
 * 借鉴VCPToolBox的核心执行理念，实现：
 * - 智能并发控制：根据系统负载动态调整
 * - 资源池管理：避免系统过载
 * - 优先级调度：支持任务优先级
 * - 执行策略：串行/并行/混合模式
 * - 性能监控：实时性能指标
 */

import { EventEmitter } from 'events';
import { logger } from '../../shared/utils/logger.js';

export class AsyncExecutionEngine extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      maxConcurrency: options.maxConcurrency || 10,
      enablePriority: options.enablePriority || true,
      resourcePoolSize: options.resourcePoolSize || 20,
      adaptiveConcurrency: options.adaptiveConcurrency || true,
      monitoring: options.monitoring || true,
      ...options,
    };

    // 执行队列
    this.executionQueue = [];
    this.runningTasks = new Map();
    this.completedTasks = new Set();

    // 资源管理
    this.resourcePool = {
      available: this.options.resourcePoolSize,
      used: 0,
      max: this.options.resourcePoolSize,
    };

    // 性能监控
    this.metrics = {
      totalExecuted: 0,
      totalFailed: 0,
      averageExecutionTime: 0,
      peakConcurrency: 0,
      resourceUtilization: 0,
    };

    // 并发控制
    this.currentConcurrency = 0;
    this.maxConcurrency = this.options.maxConcurrency;

    // 状态
    this.isRunning = false;
    this.isPaused = false;

    this.initialize();
  }

  initialize() {
    // 设置性能监控
    if (this.options.monitoring) {
      this.monitoringInterval = setInterval(() => {
        this.updateMetrics();
      }, 5000);
    }

    logger.info('AsyncExecutionEngine initialized', {
      maxConcurrency: this.maxConcurrency,
      resourcePoolSize: this.options.resourcePoolSize,
    });
  }

  /**
   * 执行任务列表
   */
  async executeTasks(tasks, options = {}) {
    if (this.isRunning) {
      throw new Error('Execution engine is already running');
    }

    this.isRunning = true;
    this.executionQueue = [...tasks];
    this.completedTasks.clear();

    // 设置执行选项
    const executionOptions = {
      strategy: options.strategy || 'parallel', // parallel, serial, adaptive
      priority: options.priority || false,
      timeout: options.timeout || 300000, // 5分钟
      ...options,
    };

    logger.info('Starting task execution', {
      taskCount: tasks.length,
      strategy: executionOptions.strategy,
      maxConcurrency: this.maxConcurrency,
    });

    try {
      const results = await this.executeWithStrategy(executionOptions);
      this.isRunning = false;
      this.emit('execution:completed', results);
      return results;
    } catch (error) {
      this.isRunning = false;
      this.emit('execution:failed', error);
      throw error;
    }
  }

  /**
   * 根据策略执行任务
   */
  async executeWithStrategy(options) {
    switch (options.strategy) {
      case 'serial':
        return this.executeSerial(options);
      case 'parallel':
        return this.executeParallel(options);
      case 'adaptive':
        return this.executeAdaptive(options);
      default:
        return this.executeParallel(options);
    }
  }

  /**
   * 串行执行
   */
  async executeSerial(options) {
    const results = [];
    for (const task of this.executionQueue) {
      const result = await this.executeTask(task, options);
      results.push(result);
      this.completedTasks.add(task.id);
    }
    return results;
  }

  /**
   * 并行执行
   */
  async executeParallel(options) {
    const results = [];
    const executing = new Set();

    while (this.executionQueue.length > 0 || executing.size > 0) {
      // 启动新任务
      while (this.executionQueue.length > 0 && this.canStartMoreTasks()) {
        const task = this.executionQueue.shift();
        executing.add(task.id);
        this.executeTaskAsync(task, options)
          .then((result) => {
            results.push(result);
            executing.delete(task.id);
            this.completedTasks.add(task.id);
          })
          .catch((error) => {
            logger.error('Task execution failed', { taskId: task.id, error });
            executing.delete(task.id);
          });
      }

      // 等待任务完成
      if (executing.size > 0) {
        await this.waitForTasks(executing, options.timeout, results);
      }
    }

    return results;
  }

  /**
   * 自适应执行
   */
  async executeAdaptive(options) {
    const results = [];
    const systemLoad = this.getSystemLoad();

    // 根据系统负载调整并发度
    this.adjustConcurrency(systemLoad);

    // 使用调整后的并发度执行
    const parallelResults = await this.executeParallel({
      ...options,
      maxConcurrency: this.maxConcurrency,
    });

    results.push(...parallelResults);
    return results;
  }

  /**
   * 执行单个任务
   */
  async executeTask(task, options) {
    const startTime = Date.now();

    try {
      // 分配资源
      this.allocateResource();

      // 设置超时
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(
          () => reject(new Error(`Task timeout: ${task.id}`)),
          options.timeout,
        );
      });

      // 执行任务
      const executionPromise = this.runTask(task);
      const result = await Promise.race([executionPromise, timeoutPromise]);

      const executionTime = Date.now() - startTime;
      this.updateMetrics(executionTime);

      logger.info('Task completed', {
        taskId: task.id,
        executionTime,
        result: typeof result,
      });

      return {
        taskId: task.id,
        success: true,
        result,
        executionTime,
        completedAt: new Date(),
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.metrics.totalFailed++;

      logger.error('Task failed', {
        taskId: task.id,
        executionTime,
        error: error.message,
      });

      return {
        taskId: task.id,
        success: false,
        error: error.message,
        executionTime,
        failedAt: new Date(),
      };
    } finally {
      // 释放资源
      this.releaseResource();
    }
  }

  /**
   * 异步执行任务
   */
  async executeTaskAsync(task, options) {
    return new Promise((resolve, reject) => {
      this.executeTask(task, options).then(resolve).catch(reject);
    });
  }

  /**
   * 运行任务逻辑
   */
  async runTask(task) {
    // 任务执行逻辑
    if (typeof task.execute === 'function') {
      return task.execute(task.context || {});
    } else if (task.action) {
      // 内置任务类型
      return this.executeBuiltInTask(task);
    } else {
      throw new Error(`Unknown task type: ${task.type}`);
    }
  }

  /**
   * 执行内置任务
   */
  async executeBuiltInTask(task) {
    switch (task.action) {
      case 'delay':
        return new Promise((resolve) =>
          setTimeout(resolve, task.delay || 1000),
        );
      case 'http':
        return this.executeHttpTask(task);
      case 'script':
        return this.executeScriptTask(task);
      default:
        throw new Error(`Unknown built-in action: ${task.action}`);
    }
  }

  /**
   * 执行HTTP任务
   */
  async executeHttpTask(task) {
    const axios = (await import('axios')).default;
    const response = await axios({
      method: task.method || 'GET',
      url: task.url,
      data: task.data,
      timeout: task.timeout || 30000,
    });
    return response.data;
  }

  /**
   * 执行脚本任务
   */
  async executeScriptTask(task) {
    // 简单脚本执行（生产环境应使用沙箱）
    try {
      const func = new Function('context', task.script);
      return await func(task.context || {});
    } catch (error) {
      throw new Error(`Script execution failed: ${error.message}`);
    }
  }

  /**
   * 判断是否可以启动更多任务
   */
  canStartMoreTasks() {
    return (
      this.currentConcurrency < this.maxConcurrency &&
      this.resourcePool.available > 0 &&
      !this.isPaused
    );
  }

  /**
   * 等待任务完成
   */
  async waitForTasks(executingTasks, timeout, results) {
    const startTime = Date.now();

    while (executingTasks.size > 0) {
      if (Date.now() - startTime > timeout) {
        // 为超时的任务创建错误结果
        for (const taskId of executingTasks) {
          const timeoutResult = {
            taskId,
            success: false,
            error: 'Task execution timeout',
            duration: Date.now() - startTime,
          };
          results.push(timeoutResult);
          executingTasks.delete(taskId);
        }
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 10));

      // 检查是否有任务完成
      for (const taskId of executingTasks) {
        if (this.completedTasks.has(taskId)) {
          executingTasks.delete(taskId);
        }
      }
    }
  }

  /**
   * 分配资源
   */
  allocateResource() {
    if (this.resourcePool.available > 0) {
      this.resourcePool.available--;
      this.resourcePool.used++;
      this.currentConcurrency++;
    }
  }

  /**
   * 释放资源
   */
  releaseResource() {
    if (this.resourcePool.used > 0) {
      this.resourcePool.used--;
      this.resourcePool.available++;
      this.currentConcurrency--;
    }
  }

  /**
   * 获取系统负载
   */
  getSystemLoad() {
    const load = process.cpuUsage();
    return {
      cpu: (load.user + load.system) / 1000000, // CPU使用率
      memory: process.memoryUsage(),
      concurrency: this.currentConcurrency / this.maxConcurrency,
    };
  }

  /**
   * 调整并发度
   */
  adjustConcurrency(systemLoad) {
    const { cpu, memory, concurrency } = systemLoad;

    // CPU使用率过高，降低并发度
    if (cpu > 0.8) {
      this.maxConcurrency = Math.max(1, this.maxConcurrency - 2);
    }
    // CPU使用率较低，提高并发度
    else if (cpu < 0.3 && concurrency < 0.5) {
      this.maxConcurrency = Math.min(
        this.options.maxConcurrency,
        this.maxConcurrency + 1,
      );
    }

    // 内存使用率过高，降低并发度
    const memoryUsage = memory.heapUsed / memory.heapTotal;
    if (memoryUsage > 0.8) {
      this.maxConcurrency = Math.max(1, this.maxConcurrency - 1);
    }
  }

  /**
   * 更新性能指标
   */
  updateMetrics(executionTime) {
    if (executionTime) {
      this.metrics.totalExecuted++;
      this.metrics.averageExecutionTime =
        (this.metrics.averageExecutionTime * (this.metrics.totalExecuted - 1) +
          executionTime) /
        this.metrics.totalExecuted;
    }

    this.metrics.peakConcurrency = Math.max(
      this.metrics.peakConcurrency,
      this.currentConcurrency,
    );
    this.metrics.resourceUtilization =
      this.resourcePool.used / this.resourcePool.max;

    // 发出监控事件
    this.emit('metrics:updated', { ...this.metrics });
  }

  /**
   * 暂停执行
   */
  pause() {
    this.isPaused = true;
    logger.info('Execution engine paused');
  }

  /**
   * 恢复执行
   */
  resume() {
    this.isPaused = false;
    logger.info('Execution engine resumed');
  }

  /**
   * 停止执行
   */
  stop() {
    this.isRunning = false;
    this.isPaused = false;
    this.executionQueue = [];
    logger.info('Execution engine stopped');
  }

  /**
   * 获取状态
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      currentConcurrency: this.currentConcurrency,
      maxConcurrency: this.maxConcurrency,
      queueLength: this.executionQueue.length,
      runningTasks: Array.from(this.runningTasks.keys()),
      resourcePool: { ...this.resourcePool },
      metrics: { ...this.metrics },
    };
  }

  /**
   * 清理资源
   */
  cleanup() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    this.stop();
    logger.info('AsyncExecutionEngine cleaned up');
  }
}

export default AsyncExecutionEngine;
