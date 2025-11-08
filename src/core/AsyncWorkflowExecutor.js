/**
 * 异步工作流执行器
 * 基于事件驱动的工作流执行系统，支持并发控制和错误处理
 */

import { BaseModule } from './BaseModule.js';
import { logger } from '../shared/utils/logger.js';
import { EventEmitter } from 'events';

export class AsyncWorkflowExecutor extends BaseModule {
  constructor(options = {}) {
    super();
    this.options = {
      maxParallelTasks: options.maxParallelTasks || 5,
      enableTracing: options.enableTracing || false,
      timeout: options.timeout || 30000,
      retryAttempts: options.retryAttempts || 3,
      ...options
    };

    this.eventEmitter = new EventEmitter();
    this.runningTasks = new Map();
    this.completedTasks = new Set();
    this.failedTasks = new Set();

    logger.info('AsyncWorkflowExecutor initialized', {
      maxParallelTasks: this.options.maxParallelTasks,
      enableTracing: this.options.enableTracing
    });
  }

  getDefaultConfig() {
    return {
      ...super.getDefaultConfig(),
      maxParallelTasks: 5,
      enableTracing: false,
      timeout: 30000,
      retryAttempts: 3
    };
  }

  /**
   * 执行工作流任务
   * @param {Array} tasks - 要执行的任务数组
   * @param {Object} options - 执行选项
   * @returns {Promise<Array>} 执行结果
   */
  async executeWorkflow(tasks, options = {}) {
    const workflowId = `workflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    logger.info('Starting workflow execution', {
      workflowId,
      taskCount: tasks.length,
      options
    });

    this.emit('workflow:start', { workflowId, tasks, options });

    try {
      const results = await this.executeTasksInParallel(tasks, options);
      this.emit('workflow:complete', { workflowId, results });

      logger.info('Workflow execution completed', {
        workflowId,
        resultsCount: results.length
      });

      return results;
    } catch (error) {
      this.emit('workflow:error', { workflowId, error });
      logger.error('Workflow execution failed', { workflowId, error: error.message });
      throw error;
    }
  }

  /**
   * 并行执行任务
   * @param {Array} tasks - 任务数组
   * @param {Object} options - 执行选项
   * @returns {Promise<Array>} 任务结果
   */
  async executeTasksInParallel(tasks, options = {}) {
    const maxParallel = options.maxParallel || this.options.maxParallelTasks;
    const results = [];
    const executing = new Set();

    for (const task of tasks) {
      if (executing.size >= maxParallel) {
        // 等待一个任务完成
        await Promise.race(executing);
      }

      const promise = this.executeSingleTask(task, options);
      executing.add(promise);

      promise.finally(() => executing.delete(promise));
      results.push(promise);
    }

    return Promise.all(results);
  }

  /**
   * 执行单个任务
   * @param {Object} task - 任务对象
   * @param {Object} options - 执行选项
   * @returns {Promise} 任务结果
   */
  async executeSingleTask(task, options = {}) {
    const taskId = task.id || `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    this.runningTasks.set(taskId, task);
    this.emit('task:start', { taskId, task });

    logger.debug('Executing task', { taskId, task: task.name || task.id });

    try {
      let result;

      if (typeof task.execute === 'function') {
        result = await this.executeWithTimeout(task.execute, options.timeout || this.options.timeout);
      } else if (typeof task === 'function') {
        result = await this.executeWithTimeout(task, options.timeout || this.options.timeout);
      } else {
        throw new Error('Task must have an execute function or be a function itself');
      }

      const executionTime = Date.now() - startTime;
      this.completedTasks.add(taskId);
      this.runningTasks.delete(taskId);

      this.emit('task:complete', { taskId, result, executionTime });

      logger.debug('Task completed', { taskId, executionTime });

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.failedTasks.add(taskId);
      this.runningTasks.delete(taskId);

      this.emit('task:error', { taskId, error, executionTime });

      logger.error('Task failed', { taskId, error: error.message, executionTime });

      // 如果启用了重试，尝试重试
      if (options.retryAttempts > 0) {
        return this.retryTask(task, options.retryAttempts - 1, options);
      }

      throw error;
    }
  }

  /**
   * 重试任务
   * @param {Object} task - 任务对象
   * @param {number} remainingAttempts - 剩余重试次数
   * @param {Object} options - 执行选项
   * @returns {Promise} 重试结果
   */
  async retryTask(task, remainingAttempts, options) {
    logger.warn('Retrying task', {
      taskId: task.id,
      remainingAttempts,
      originalError: task.lastError?.message
    });

    try {
      return await this.executeSingleTask(task, {
        ...options,
        retryAttempts: remainingAttempts
      });
    } catch (error) {
      if (remainingAttempts > 0) {
        return this.retryTask(task, remainingAttempts - 1, options);
      }
      throw error;
    }
  }

  /**
   * 带超时的函数执行
   * @param {Function} fn - 要执行的函数
   * @param {number} timeout - 超时时间（毫秒）
   * @returns {Promise} 执行结果
   */
  async executeWithTimeout(fn, timeout) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Task execution timeout after ${timeout}ms`));
      }, timeout);

      fn()
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * 获取执行状态
   * @returns {Object} 状态信息
   */
  getStatus() {
    return {
      runningTasks: this.runningTasks.size,
      completedTasks: this.completedTasks.size,
      failedTasks: this.failedTasks.size,
      isRunning: this.runningTasks.size > 0
    };
  }

  /**
   * 停止所有任务
   */
  async stop() {
    logger.info('Stopping AsyncWorkflowExecutor');

    // 取消所有正在运行的任务
    for (const [taskId, task] of this.runningTasks) {
      this.emit('task:cancelled', { taskId });
      logger.debug('Task cancelled', { taskId });
    }

    this.runningTasks.clear();
    this.emit('executor:stopped');

    logger.info('AsyncWorkflowExecutor stopped');
  }

  /**
   * 清理资源
   */
  cleanup() {
    this.stop();
    this.completedTasks.clear();
    this.failedTasks.clear();
    this.eventEmitter.removeAllListeners();
  }

  /**
   * 事件发射
   * @param {string} event - 事件名
   * @param {*} data - 事件数据
   */
  emit(event, data) {
    this.eventEmitter.emit(event, data);

    if (this.options.enableTracing) {
      logger.debug('Workflow event emitted', { event, data });
    }
  }

  /**
   * 事件监听
   * @param {string} event - 事件名
   * @param {Function} listener - 监听器函数
   */
  on(event, listener) {
    this.eventEmitter.on(event, listener);
  }

  /**
   * 移除事件监听器
   * @param {string} event - 事件名
   * @param {Function} listener - 监听器函数
   */
  off(event, listener) {
    this.eventEmitter.off(event, listener);
  }
}
