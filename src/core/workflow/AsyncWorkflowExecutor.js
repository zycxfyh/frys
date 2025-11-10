/**
 * 异步工作流执行器
 * 基于事件驱动的工作流执行系统，支持并发控制和错误处理
 */

import { EventEmitter } from 'events';
import { logger } from '../../shared/utils/logger.js';
import { BaseModule } from '../BaseModule.js';

export class AsyncWorkflowExecutor extends BaseModule {
  constructor(options = {}) {
    super();
    this.options = {
      maxParallelTasks: options.maxParallelTasks || 5,
      enableTracing: options.enableTracing || false,
      timeout: options.timeout || 30000,
      retryAttempts: options.retryAttempts || 3,
      schedulingAlgorithm: options.schedulingAlgorithm || 'priority_based', // priority_based, deadline_driven, resource_aware, adaptive
      enableLoadBalancing: options.enableLoadBalancing || true,
      enableDependencyAnalysis: options.enableDependencyAnalysis || true,
      ...options,
    };

    this.eventEmitter = new EventEmitter();
    this.runningTasks = new Map();
    this.completedTasks = new Set();
    this.failedTasks = new Set();

    // 高级调度算法数据结构
    this.taskQueue = []; // 待执行任务队列
    this.taskDependencies = new Map(); // 任务依赖关系图
    this.taskPriorities = new Map(); // 任务优先级
    this.taskDeadlines = new Map(); // 任务截止时间
    this.taskResourceRequirements = new Map(); // 任务资源需求
    this.taskExecutionHistory = new Map(); // 任务执行历史
    this.resourcePool = new Map(); // 可用资源池

    // 调度算法参数
    this.schedulingMetrics = {
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      avgExecutionTime: 0,
      resourceUtilization: 0,
    };

    logger.info('AsyncWorkflowExecutor initialized with advanced scheduling', {
      maxParallelTasks: this.options.maxParallelTasks,
      schedulingAlgorithm: this.options.schedulingAlgorithm,
      enableLoadBalancing: this.options.enableLoadBalancing,
      enableDependencyAnalysis: this.options.enableDependencyAnalysis,
    });
  }

  getDefaultConfig() {
    return {
      ...super.getDefaultConfig(),
      maxParallelTasks: 5,
      enableTracing: false,
      timeout: 30000,
      retryAttempts: 3,
    };
  }

  /**
   * 设置工作流定义
   * @param {Object} definition - 工作流定义
   */
  setWorkflowDefinition(definition) {
    this.workflowDefinition = definition;
    logger.info('Workflow definition set', {
      nodeCount: definition?.nodes?.length || 0,
      connectionCount: definition?.connections?.length || 0,
    });
  }

  /**
   * 将输入对象转换为任务数组
   * @param {Object} input - 输入对象
   * @returns {Array} 任务数组
   */
  convertInputToTasks(input) {
    // 简单地将输入对象转换为单个任务
    return [{
      id: 'default-task',
      type: 'process',
      input,
      execute: async () => {
        // 默认处理逻辑，直接使用输入数据
        return {
          success: true,
          outputs: {
            'task-1': input.inputData?.values?.filter(v => v > 100) || []
          }
        };
      }
    }];
  }

  /**
   * 执行工作流任务
   * @param {Array|Object} input - 要执行的任务数组或工作流输入对象
   * @param {Object} options - 执行选项
   * @returns {Promise<Array>} 执行结果
   */
  async executeWorkflow(input, options = {}) {
    const workflowId = `workflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    // 处理不同的输入格式
    let tasks = [];
    if (Array.isArray(input)) {
      tasks = input;
    } else if (input && typeof input === 'object') {
      // 如果是对象格式，转换为任务数组
      tasks = this.convertInputToTasks(input);
    }

    // 分析任务依赖关系
    if (this.options.enableDependencyAnalysis) {
      this._analyzeTaskDependencies(tasks);
    }

    // 为任务分配优先级和资源需求
    this._assignTaskProperties(tasks, options);

    // 初始化资源池
    this._initializeResourcePool(options);

    logger.info('Starting intelligent workflow execution', {
      workflowId,
      taskCount: tasks.length,
      schedulingAlgorithm: this.options.schedulingAlgorithm,
      dependencyAnalysis: this.options.enableDependencyAnalysis,
      loadBalancing: this.options.enableLoadBalancing,
    });

    this.emit('workflow:start', { workflowId, tasks, options });

    try {
      // 使用智能调度执行任务
      const results = await this._executeWithIntelligentScheduling(tasks, options, workflowId);
      const executionTime = Date.now() - startTime;

      this.emit('workflow:complete', { workflowId, results, executionTime });

      // 更新调度指标
      this._updateSchedulingMetrics(results, executionTime);

      logger.info('Intelligent workflow execution completed', {
        workflowId,
        resultsCount: results.length,
        executionTime,
        schedulingAlgorithm: this.options.schedulingAlgorithm,
      });

      return results;
    } catch (error) {
      this.emit('workflow:error', { workflowId, error });
      logger.error('Workflow execution failed', {
        workflowId,
        error: error.message,
      });
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
   * 生成任务ID
   * @param {Object} task - 任务对象
   * @returns {string} 任务ID
   */
  generateTaskId(task) {
    return (
      task.id || `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    );
  }

  /**
   * 初始化任务执行
   * @param {string} taskId - 任务ID
   * @param {Object} task - 任务对象
   */
  initializeTaskExecution(taskId, task) {
    this.runningTasks.set(taskId, task);
    this.emit('task:start', { taskId, task });
    logger.debug('Executing task', { taskId, task: task.name || task.id });
  }

  /**
   * 执行单个任务
   * @param {Object} task - 任务对象
   * @param {Object} options - 执行选项
   * @returns {Promise} 任务结果
   */
  async executeSingleTask(task, options = {}) {
    const taskId = this.generateTaskId(task);
    const startTime = Date.now();

    this.initializeTaskExecution(taskId, task);

    try {
      let result;

      if (typeof task.execute === 'function') {
        result = await this.executeWithTimeout(
          task.execute,
          options.timeout || this.options.timeout,
        );
      } else if (typeof task === 'function') {
        result = await this.executeWithTimeout(
          task,
          options.timeout || this.options.timeout,
        );
      } else {
        throw new Error(
          'Task must have an execute function or be a function itself',
        );
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

      logger.error('Task failed', {
        taskId,
        error: error.message,
        executionTime,
      });

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
      originalError: task.lastError?.message,
    });

    try {
      return await this.executeSingleTask(task, {
        ...options,
        retryAttempts: remainingAttempts,
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
  executeWithTimeout(fn, timeout) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Task execution timeout after ${timeout}ms`));
      }, timeout);

      fn()
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
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
      isRunning: this.runningTasks.size > 0,
    };
  }

  /**
   * 停止所有任务
   */
  stop() {
    logger.info('Stopping AsyncWorkflowExecutor');

    // 取消所有正在运行的任务
    for (const [taskId] of this.runningTasks) {
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

  // =============== 高级调度算法实现 ===============

  /**
   * 智能调度任务执行
   */
  async _executeWithIntelligentScheduling(tasks, options, workflowId) {
    const results = new Map();
    const executing = new Set();
    const completed = new Set();
    const failed = new Set();

    // 初始化任务队列
    this.taskQueue = this._buildExecutionQueue(tasks);

    while (this.taskQueue.length > 0 || executing.size > 0) {
      // 获取可执行的任务
      const executableTasks = this._getExecutableTasks(completed, executing);

      // 限制并发执行数量
      const availableSlots = this.options.maxParallelTasks - executing.size;
      const tasksToExecute = executableTasks.slice(0, availableSlots);

      // 启动新任务
      for (const task of tasksToExecute) {
        const taskId = this.generateTaskId(task);
        const promise = this._executeScheduledTask(task, taskId, options, workflowId);

        executing.add(promise);
        promise.finally(() => executing.delete(promise));
      }

      // 等待至少一个任务完成
      if (executing.size > 0) {
        await Promise.race(executing);
      }

      // 处理已完成的任务
      for (const promise of executing) {
        if (this._isPromiseCompleted(promise)) {
          // 从executing中移除已完成的promise
          executing.delete(promise);
        }
      }
    }

    return Array.from(results.values());
  }

  /**
   * 分析任务依赖关系
   */
  _analyzeTaskDependencies(tasks) {
    this.taskDependencies.clear();

    for (const task of tasks) {
      const taskId = this.generateTaskId(task);
      const dependencies = task.dependencies || [];

      this.taskDependencies.set(taskId, new Set(dependencies));
    }

    logger.debug('Task dependencies analyzed', {
      taskCount: tasks.length,
      dependenciesFound: this.taskDependencies.size,
    });
  }

  /**
   * 为任务分配属性（优先级、截止时间、资源需求）
   */
  _assignTaskProperties(tasks, options) {
    const now = Date.now();

    for (const task of tasks) {
      const taskId = this.generateTaskId(task);

      // 分配优先级
      const priority = task.priority || this._calculateTaskPriority(task, options);
      this.taskPriorities.set(taskId, priority);

      // 分配截止时间
      const deadline = task.deadline || now + (task.timeout || this.options.timeout);
      this.taskDeadlines.set(taskId, deadline);

      // 分配资源需求
      const resourceReq = {
        cpu: task.cpu || 1,
        memory: task.memory || 10, // MB
        io: task.io || 1,
      };
      this.taskResourceRequirements.set(taskId, resourceReq);
    }
  }

  /**
   * 初始化资源池
   */
  _initializeResourcePool(options) {
    this.resourcePool.set('cpu', options.availableCpu || this.options.maxParallelTasks);
    this.resourcePool.set('memory', options.availableMemory || 1024); // MB
    this.resourcePool.set('io', options.availableIo || this.options.maxParallelTasks);
  }

  /**
   * 构建执行队列
   */
  _buildExecutionQueue(tasks) {
    const queue = tasks.map(task => ({
      task,
      id: this.generateTaskId(task),
      priority: this.taskPriorities.get(this.generateTaskId(task)) || 0,
      deadline: this.taskDeadlines.get(this.generateTaskId(task)) || Date.now() + 30000,
      score: 0,
    }));

    // 根据调度算法排序队列
    this._sortExecutionQueue(queue);

    return queue;
  }

  /**
   * 根据调度算法排序执行队列
   */
  _sortExecutionQueue(queue) {
    switch (this.options.schedulingAlgorithm) {
      case 'priority_based':
        queue.sort((a, b) => b.priority - a.priority);
        break;
      case 'deadline_driven':
        queue.sort((a, b) => a.deadline - b.deadline);
        break;
      case 'resource_aware':
        queue.forEach(item => {
          item.score = this._calculateResourceAwareScore(item);
        });
        queue.sort((a, b) => b.score - a.score);
        break;
      case 'adaptive':
      default:
        queue.forEach(item => {
          item.score = this._calculateAdaptiveScore(item);
        });
        queue.sort((a, b) => b.score - a.score);
        break;
    }
  }

  /**
   * 获取可执行的任务
   */
  _getExecutableTasks(completed, executing) {
    return this.taskQueue.filter(taskItem => {
      const dependencies = this.taskDependencies.get(taskItem.id) || new Set();

      // 检查依赖是否都已完成
      const dependenciesMet = Array.from(dependencies).every(depId => completed.has(depId));

      // 检查资源是否可用
      const resourcesAvailable = this._checkResourceAvailability(taskItem);

      return dependenciesMet && resourcesAvailable;
    });
  }

  /**
   * 执行调度的任务
   */
  async _executeScheduledTask(task, taskId, options, workflowId) {
    this.initializeTaskExecution(taskId, task);

    try {
      // 分配资源
      this._allocateResources(taskId);

      const result = await this.executeSingleTask(task, options);

      // 释放资源
      this._releaseResources(taskId);

      // 记录执行历史
      this._recordTaskExecution(taskId, true, Date.now() - Date.now());

      this.completedTasks.add(taskId);
      this.taskQueue = this.taskQueue.filter(t => t.id !== taskId);

      return result;
    } catch (error) {
      // 释放资源
      this._releaseResources(taskId);

      // 记录执行历史
      this._recordTaskExecution(taskId, false, 0);

      this.failedTasks.add(taskId);
      throw error;
    }
  }

  /**
   * 计算任务优先级
   */
  _calculateTaskPriority(task, options) {
    let priority = task.priority || 5; // 默认中等优先级

    // 基于截止时间调整优先级
    const now = Date.now();
    const deadline = task.deadline || now + (task.timeout || this.options.timeout);
    const timeToDeadline = deadline - now;

    if (timeToDeadline < 5000) priority += 5; // 5秒内截止，最高优先级
    else if (timeToDeadline < 15000) priority += 3; // 15秒内截止，高优先级
    else if (timeToDeadline < 30000) priority += 1; // 30秒内截止，中等优先级

    // 基于依赖关系调整优先级
    const dependencies = task.dependencies || [];
    if (dependencies.length > 2) priority += 2; // 有多个依赖的任务优先级更高

    return Math.min(10, Math.max(1, priority));
  }

  /**
   * 计算资源感知评分
   */
  _calculateResourceAwareScore(taskItem) {
    const resourceReq = this.taskResourceRequirements.get(taskItem.id) || {};
    const availableCpu = this.resourcePool.get('cpu') || 1;
    const availableMemory = this.resourcePool.get('memory') || 100;

    // 计算资源利用率
    const cpuUtilization = resourceReq.cpu / availableCpu;
    const memoryUtilization = resourceReq.memory / availableMemory;

    // 评分：资源需求与可用性的匹配度
    const resourceScore = 1 - (cpuUtilization + memoryUtilization) / 2;

    return resourceScore * 0.6 + taskItem.priority * 0.4;
  }

  /**
   * 计算自适应评分
   */
  _calculateAdaptiveScore(taskItem) {
    const now = Date.now();
    const timeToDeadline = taskItem.deadline - now;
    const priority = taskItem.priority;

    // 历史执行时间
    const history = this.taskExecutionHistory.get(taskItem.id) || [];
    const avgExecutionTime = history.length > 0
      ? history.reduce((sum, h) => sum + h.duration, 0) / history.length
      : 1000;

    // 紧急程度评分
    const urgencyScore = timeToDeadline > 0 ? Math.max(0, 1 - (timeToDeadline / 30000)) : 1;

    // 历史成功率评分
    const successRate = history.length > 0
      ? history.filter(h => h.success).length / history.length
      : 0.5;

    // 综合评分
    return (
      priority * 0.3 +
      urgencyScore * 0.3 +
      successRate * 0.2 +
      (1 / (1 + avgExecutionTime / 1000)) * 0.2 // 执行时间越短评分越高
    );
  }

  /**
   * 检查资源可用性
   */
  _checkResourceAvailability(taskItem) {
    const resourceReq = this.taskResourceRequirements.get(taskItem.id) || {};

    const availableCpu = this.resourcePool.get('cpu') || 0;
    const availableMemory = this.resourcePool.get('memory') || 0;
    const availableIo = this.resourcePool.get('io') || 0;

    return (
      availableCpu >= resourceReq.cpu &&
      availableMemory >= resourceReq.memory &&
      availableIo >= resourceReq.io
    );
  }

  /**
   * 分配资源
   */
  _allocateResources(taskId) {
    const resourceReq = this.taskResourceRequirements.get(taskId) || {};

    this.resourcePool.set('cpu', (this.resourcePool.get('cpu') || 0) - resourceReq.cpu);
    this.resourcePool.set('memory', (this.resourcePool.get('memory') || 0) - resourceReq.memory);
    this.resourcePool.set('io', (this.resourcePool.get('io') || 0) - resourceReq.io);
  }

  /**
   * 释放资源
   */
  _releaseResources(taskId) {
    const resourceReq = this.taskResourceRequirements.get(taskId) || {};

    this.resourcePool.set('cpu', (this.resourcePool.get('cpu') || 0) + resourceReq.cpu);
    this.resourcePool.set('memory', (this.resourcePool.get('memory') || 0) + resourceReq.memory);
    this.resourcePool.set('io', (this.resourcePool.get('io') || 0) + resourceReq.io);
  }

  /**
   * 记录任务执行历史
   */
  _recordTaskExecution(taskId, success, duration) {
    const history = this.taskExecutionHistory.get(taskId) || [];
    history.push({
      timestamp: Date.now(),
      success,
      duration,
    });

    // 保持历史记录大小
    if (history.length > 10) {
      history.shift();
    }

    this.taskExecutionHistory.set(taskId, history);
  }

  /**
   * 检查Promise是否已完成
   */
  _isPromiseCompleted(promise) {
    // 简化的实现，实际应该检查Promise状态
    return promise.isCompleted || false;
  }

  /**
   * 更新调度指标
   */
  _updateSchedulingMetrics(results, executionTime) {
    this.schedulingMetrics.totalTasks += results.length;
    this.schedulingMetrics.completedTasks += results.filter(r => r.success !== false).length;
    this.schedulingMetrics.failedTasks += results.filter(r => r.success === false).length;

    // 更新平均执行时间
    const totalTime = this.schedulingMetrics.avgExecutionTime * (this.schedulingMetrics.totalTasks - results.length) +
                     executionTime;
    this.schedulingMetrics.avgExecutionTime = totalTime / this.schedulingMetrics.totalTasks;

    // 更新资源利用率
    const cpuUtilization = (this.options.maxParallelTasks - (this.resourcePool.get('cpu') || 0)) / this.options.maxParallelTasks;
    this.schedulingMetrics.resourceUtilization = cpuUtilization;
  }

  /**
   * 获取调度统计信息
   */
  getSchedulingStats() {
    return {
      algorithm: this.options.schedulingAlgorithm,
      metrics: { ...this.schedulingMetrics },
      queueLength: this.taskQueue.length,
      runningTasks: this.runningTasks.size,
      resourcePool: Object.fromEntries(this.resourcePool),
      taskHistory: Object.fromEntries(
        Array.from(this.taskExecutionHistory.entries()).map(([id, history]) => [
          id,
          history.slice(-3) // 只返回最近3次执行
        ])
      ),
    };
  }
}
