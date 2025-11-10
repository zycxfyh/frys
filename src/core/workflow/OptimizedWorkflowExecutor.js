/**
 * 优化的异步工作流执行器
 * 基于性能分析结果优化了核心算法和数据结构
 *
 * 优化点：
 * - 使用高效的优先队列替代数组排序
 * - 优化内存使用和垃圾回收
 * - 减少对象创建和函数调用开销
 * - 改进并发控制算法
 */

import { logger } from '../../shared/utils/logger.js';

class PriorityQueue {
  constructor(comparator = (a, b) => a.priority - b.priority) {
    this.heap = [];
    this.comparator = comparator;
  }

  push(item) {
    this.heap.push(item);
    this._bubbleUp(this.heap.length - 1);
    return this;
  }

  pop() {
    if (this.heap.length === 0) return null;
    const root = this.heap[0];
    const last = this.heap.pop();
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this._sinkDown(0);
    }
    return root;
  }

  peek() {
    return this.heap.length > 0 ? this.heap[0] : null;
  }

  size() {
    return this.heap.length;
  }

  _bubbleUp(index) {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (this.comparator(this.heap[index], this.heap[parentIndex]) >= 0) break;
      [this.heap[index], this.heap[parentIndex]] = [this.heap[parentIndex], this.heap[index]];
      index = parentIndex;
    }
  }

  _sinkDown(index) {
    const length = this.heap.length;
    while (true) {
      const left = 2 * index + 1;
      const right = 2 * index + 2;
      let smallest = index;

      if (left < length && this.comparator(this.heap[left], this.heap[smallest]) < 0) {
        smallest = left;
      }
      if (right < length && this.comparator(this.heap[right], this.heap[smallest]) < 0) {
        smallest = right;
      }

      if (smallest === index) break;

      [this.heap[index], this.heap[smallest]] = [this.heap[smallest], this.heap[index]];
      index = smallest;
    }
  }
}

class ObjectPool {
  constructor(factory, reset, initialSize = 10) {
    this.factory = factory;
    this.reset = reset;
    this.pool = [];
    this.active = new Set();

    // 预分配对象
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(factory());
    }
  }

  acquire() {
    let obj = this.pool.pop();
    if (!obj) {
      obj = this.factory();
    }
    this.active.add(obj);
    return obj;
  }

  release(obj) {
    if (this.active.has(obj)) {
      this.reset(obj);
      this.pool.push(obj);
      this.active.delete(obj);
    }
  }

  size() {
    return this.pool.length;
  }
}

export class OptimizedWorkflowExecutor {
  constructor(options = {}) {
    this.options = {
      maxParallelTasks: options.maxParallelTasks || 10,
      enableTracing: options.enableTracing || false,
      timeout: options.timeout || 30000,
      retryAttempts: options.retryAttempts || 3,
      ...options
    };

    // 使用优化的数据结构
    this.taskQueue = new PriorityQueue((a, b) => b.priority - a.priority);
    this.runningTasks = new Map();
    this.completedTasks = new Set();
    this.failedTasks = new Set();

    // 对象池优化内存使用
    this.taskContextPool = new ObjectPool(
      () => ({
        id: '',
        priority: 0,
        dependencies: [],
        startTime: 0,
        timeoutId: null,
        retryCount: 0
      }),
      (obj) => {
        obj.id = '';
        obj.priority = 0;
        obj.dependencies.length = 0;
        obj.startTime = 0;
        obj.timeoutId = null;
        obj.retryCount = 0;
      },
      50
    );

    // 性能监控
    this.metrics = {
      tasksProcessed: 0,
      averageExecutionTime: 0,
      peakConcurrentTasks: 0,
      memoryUsage: 0
    };

    this.isRunning = false;
    this.abortController = new AbortController();

    logger.info('OptimizedWorkflowExecutor initialized', {
      maxParallelTasks: this.options.maxParallelTasks
    });
  }

  /**
   * 提交任务到执行器
   * 优化：减少对象创建，使用对象池
   */
  submitTask(taskDefinition) {
    const taskContext = this.taskContextPool.acquire();
    taskContext.id = taskDefinition.id || `task_${Date.now()}_${Math.random()}`;
    taskContext.priority = taskDefinition.priority || 0;
    taskContext.dependencies = taskDefinition.dependencies || [];

    this.taskQueue.push(taskContext);

    logger.debug('Task submitted to optimized executor', {
      taskId: taskContext.id,
      priority: taskContext.priority,
      queueSize: this.taskQueue.size()
    });

    // 如果没有在运行，开始处理队列
    if (!this.isRunning) {
      this._startProcessing();
    }

    return taskContext.id;
  }

  /**
   * 批量提交任务
   * 优化：减少循环开销，使用批量操作
   */
  submitTasks(taskDefinitions) {
    const taskIds = [];

    // 批量添加到队列，避免多次排序
    for (const taskDef of taskDefinitions) {
      const taskContext = this.taskContextPool.acquire();
      taskContext.id = taskDef.id || `task_${Date.now()}_${Math.random()}`;
      taskContext.priority = taskDef.priority || 0;
      taskContext.dependencies = taskDef.dependencies || [];

      this.taskQueue.push(taskContext);
      taskIds.push(taskContext.id);
    }

    logger.debug('Batch tasks submitted', {
      count: taskIds.length,
      queueSize: this.taskQueue.size()
    });

    if (!this.isRunning) {
      this._startProcessing();
    }

    return taskIds;
  }

  /**
   * 开始处理任务队列
   * 优化：使用更高效的并发控制
   */
  async _startProcessing() {
    if (this.isRunning) return;

    this.isRunning = true;
    const { signal } = this.abortController;

    try {
      while (!signal.aborted && this.taskQueue.size() > 0) {
        const availableSlots = this.options.maxParallelTasks - this.runningTasks.size;

        if (availableSlots <= 0) {
          await this._waitForTaskCompletion();
          continue;
        }

        // 批量启动任务
        const tasksToStart = Math.min(availableSlots, this.taskQueue.size());
        const startedTasks = [];

        for (let i = 0; i < tasksToStart; i++) {
          const taskContext = this.taskQueue.pop();
          if (taskContext && this._canExecuteTask(taskContext)) {
            this._executeTask(taskContext);
            startedTasks.push(taskContext);
          }
        }

        // 更新并发峰值
        this.metrics.peakConcurrentTasks = Math.max(
          this.metrics.peakConcurrentTasks,
          this.runningTasks.size
        );

        // 如果没有新任务启动，等待现有任务完成
        if (startedTasks.length === 0 && this.runningTasks.size > 0) {
          await this._waitForTaskCompletion();
        }
      }
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * 检查任务是否可以执行
   * 优化：使用Set进行O(1)查找
   */
  _canExecuteTask(taskContext) {
    if (!taskContext.dependencies || taskContext.dependencies.length === 0) {
      return true;
    }

    return taskContext.dependencies.every(depId => this.completedTasks.has(depId));
  }

  /**
   * 执行单个任务
   * 优化：减少异步开销，优化错误处理
   */
  _executeTask(taskContext) {
    const startTime = performance.now();
    taskContext.startTime = startTime;

    this.runningTasks.set(taskContext.id, taskContext);

    // 设置超时
    if (this.options.timeout > 0) {
      taskContext.timeoutId = setTimeout(() => {
        this._handleTaskTimeout(taskContext);
      }, this.options.timeout);
    }

    // 执行任务
    const taskPromise = this._runTaskLogic(taskContext);

    taskPromise
      .then(result => {
        this._handleTaskSuccess(taskContext, result, performance.now() - startTime);
      })
      .catch(error => {
        this._handleTaskFailure(taskContext, error, performance.now() - startTime);
      });
  }

  /**
   * 运行任务逻辑
   * 占位符：实际实现需要根据具体任务类型定制
   */
  async _runTaskLogic(taskContext) {
    // 这里应该是具体的任务执行逻辑
    // 为了演示，我们使用一个简单的延迟
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100));

    return { success: true, data: `Task ${taskContext.id} completed` };
  }

  /**
   * 处理任务成功
   */
  _handleTaskSuccess(taskContext, result, executionTime) {
    if (taskContext.timeoutId) {
      clearTimeout(taskContext.timeoutId);
    }

    this.runningTasks.delete(taskContext.id);
    this.completedTasks.add(taskContext.id);

    // 更新性能指标
    this._updateMetrics(executionTime);

    // 释放对象回池
    this.taskContextPool.release(taskContext);

    logger.debug('Task completed successfully', {
      taskId: taskContext.id,
      executionTime,
      remainingTasks: this.taskQueue.size()
    });
  }

  /**
   * 处理任务失败
   */
  _handleTaskFailure(taskContext, error, executionTime) {
    if (taskContext.timeoutId) {
      clearTimeout(taskContext.timeoutId);
    }

    this.runningTasks.delete(taskContext.id);

    // 重试逻辑
    if (taskContext.retryCount < this.options.retryAttempts) {
      taskContext.retryCount++;
      logger.warn('Task failed, retrying', {
        taskId: taskContext.id,
        retryCount: taskContext.retryCount,
        error: error.message
      });
      // 重新加入队列
      this.taskQueue.push(taskContext);
    } else {
      this.failedTasks.add(taskContext.id);
      this.taskContextPool.release(taskContext);

      logger.error('Task failed permanently', {
        taskId: taskContext.id,
        error: error.message
      });
    }
  }

  /**
   * 处理任务超时
   */
  _handleTaskTimeout(taskContext) {
    logger.warn('Task timed out', { taskId: taskContext.id });
    this._handleTaskFailure(taskContext, new Error('Task timeout'), this.options.timeout);
  }

  /**
   * 等待任务完成
   */
  async _waitForTaskCompletion() {
    return new Promise(resolve => {
      const checkCompletion = () => {
        if (this.runningTasks.size < this.options.maxParallelTasks) {
          resolve();
        } else {
          setImmediate(checkCompletion);
        }
      };
      checkCompletion();
    });
  }

  /**
   * 更新性能指标
   */
  _updateMetrics(executionTime) {
    this.metrics.tasksProcessed++;
    this.metrics.averageExecutionTime =
      (this.metrics.averageExecutionTime * (this.metrics.tasksProcessed - 1) + executionTime) /
      this.metrics.tasksProcessed;

    // 定期更新内存使用情况
    if (this.metrics.tasksProcessed % 10 === 0) {
      this.metrics.memoryUsage = process.memoryUsage().heapUsed;
    }
  }

  /**
   * 获取执行器状态
   */
  getStats() {
    return {
      isRunning: this.isRunning,
      queueSize: this.taskQueue.size(),
      runningTasks: this.runningTasks.size,
      completedTasks: this.completedTasks.size,
      failedTasks: this.failedTasks.size,
      metrics: { ...this.metrics }
    };
  }

  /**
   * 优雅关闭
   */
  async shutdown() {
    this.abortController.abort();

    // 等待运行中的任务完成
    while (this.runningTasks.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // 清理资源
    this.taskQueue = new PriorityQueue();
    this.runningTasks.clear();
    this.completedTasks.clear();
    this.failedTasks.clear();

    logger.info('OptimizedWorkflowExecutor shut down gracefully');
  }
}

export default OptimizedWorkflowExecutor;
