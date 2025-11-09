/**
 * 工作线程池
 * 管理工作线程的创建、分配和生命周期
 */

import path from 'path';
import { Worker } from 'worker_threads';
import { logger } from '../../shared/utils/logger.js';
import { AbstractResourcePool } from './AbstractResourcePool.js';

export class WorkerPool extends AbstractResourcePool {
  constructor(workerScript, options = {}) {
    super({
      min: options.min || 1,
      max: options.max || Math.max(1, require('os').cpus().length - 1),
      idleTimeoutMillis: options.idleTimeoutMillis || 300000, // 5分钟
      acquireTimeoutMillis: options.acquireTimeoutMillis || 30000, // 30秒
      ...options,
    });

    this.workerScript = path.resolve(workerScript);
    this.workerData = options.workerData || {};
    this.resourceLimits = options.resourceLimits || {};

    this.taskStats = {
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      avgExecutionTime: 0,
      totalExecutionTime: 0,
    };
  }

  getResourceType() {
    return 'worker_thread';
  }

  async _createResource() {
    try {
      const worker = new Worker(this.workerScript, {
        workerData: this.workerData,
        resourceLimits: this.resourceLimits,
      });

      // 为worker添加元数据
      worker._poolMetadata = {
        createdAt: Date.now(),
        lastUsed: Date.now(),
        taskCount: 0,
        threadId: worker.threadId,
        poolId: Math.random().toString(36).substr(2, 9),
      };

      // 设置错误处理
      worker.on('error', (error) => {
        logger.error('Worker线程错误', {
          threadId: worker.threadId,
          poolId: worker._poolMetadata.poolId,
          error: error.message,
        });
      });

      worker.on('exit', (code) => {
        logger.debug('Worker线程退出', {
          threadId: worker.threadId,
          poolId: worker._poolMetadata.poolId,
          code,
        });
      });

      // 等待worker初始化完成
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Worker initialization timeout'));
        }, 10000); // 10秒超时

        worker.once('message', (message) => {
          if (message.type === 'ready') {
            clearTimeout(timeout);
            resolve();
          }
        });

        worker.once('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      logger.debug('创建Worker线程', {
        threadId: worker.threadId,
        poolId: worker._poolMetadata.poolId,
      });

      return worker;
    } catch (error) {
      logger.error('创建Worker线程失败', error);
      throw error;
    }
  }

  async _destroyResource(worker) {
    try {
      // 发送终止信号
      worker.postMessage({ type: 'terminate' });

      // 等待worker自行终止，或强制终止
      const terminationPromise = new Promise((resolve) => {
        const timeout = setTimeout(() => {
          worker.terminate().then(() => resolve());
        }, 5000); // 5秒后强制终止

        worker.once('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });

      await terminationPromise;

      const metadata = worker._poolMetadata;
      logger.debug('销毁Worker线程', {
        threadId: metadata?.threadId,
        poolId: metadata?.poolId,
        taskCount: metadata?.taskCount,
        lifetime: metadata ? Date.now() - metadata.createdAt : 0,
      });
    } catch (error) {
      logger.error('销毁Worker线程失败', error);
    }
  }

  async _validateResource(worker) {
    try {
      // 检查worker是否仍然活跃
      if (worker.threadId === undefined) {
        return false;
      }

      // 发送心跳检查
      const isAlive = await new Promise((resolve) => {
        const timeout = setTimeout(() => resolve(false), 2000);

        const messageHandler = (message) => {
          if (message.type === 'heartbeat') {
            clearTimeout(timeout);
            worker.removeListener('message', messageHandler);
            resolve(true);
          }
        };

        worker.on('message', messageHandler);
        worker.postMessage({ type: 'heartbeat' });
      });

      return isAlive;
    } catch (error) {
      logger.error('验证Worker线程失败', error);
      return false;
    }
  }

  /**
   * 执行任务
   */
  async executeTask(taskData, options = {}) {
    return this.use(async (worker) => {
      const startTime = Date.now();

      try {
        // 更新任务计数
        worker._poolMetadata.taskCount++;
        this.taskStats.totalTasks++;

        // 发送任务
        const result = await this._sendTaskToWorker(
          worker,
          taskData,
          options.timeout || 30000,
        );

        const executionTime = Date.now() - startTime;
        this.taskStats.completedTasks++;
        this.taskStats.totalExecutionTime += executionTime;
        this.taskStats.avgExecutionTime =
          this.taskStats.totalExecutionTime / this.taskStats.completedTasks;

        logger.debug('任务执行成功', {
          threadId: worker.threadId,
          executionTime,
          taskType: taskData.type || 'unknown',
        });

        return result;
      } catch (error) {
        const executionTime = Date.now() - startTime;
        this.taskStats.failedTasks++;

        logger.error('任务执行失败', {
          threadId: worker.threadId,
          executionTime,
          error: error.message,
          taskType: taskData.type || 'unknown',
        });

        throw error;
      }
    });
  }

  /**
   * 向worker发送任务并等待结果
   */
  _sendTaskToWorker(worker, taskData, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Task execution timeout after ${timeout}ms`));
      }, timeout);

      const messageHandler = (message) => {
        if (message.type === 'task_result') {
          clearTimeout(timeoutId);
          worker.removeListener('message', messageHandler);
          worker.removeListener('error', errorHandler);

          if (message.error) {
            reject(new Error(message.error));
          } else {
            resolve(message.result);
          }
        }
      };

      const errorHandler = (error) => {
        clearTimeout(timeoutId);
        worker.removeListener('message', messageHandler);
        worker.removeListener('error', errorHandler);
        reject(error);
      };

      worker.on('message', messageHandler);
      worker.on('error', errorHandler);

      worker.postMessage({
        type: 'task',
        data: taskData,
        taskId: Math.random().toString(36).substr(2, 9),
      });
    });
  }

  /**
   * 批量执行任务
   */
  async executeTasks(tasks, options = {}) {
    const { concurrency = this.options.max, timeout } = options;

    const results = [];
    const errors = [];

    // 分批执行以控制并发
    for (let i = 0; i < tasks.length; i += concurrency) {
      const batch = tasks.slice(i, i + concurrency);

      const batchPromises = batch.map(async (task, index) => {
        try {
          const result = await this.executeTask(task, { timeout });
          return { index: i + index, result, success: true };
        } catch (error) {
          errors.push({ index: i + index, error: error.message });
          return { index: i + index, error: error.message, success: false };
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);

      for (const promiseResult of batchResults) {
        if (promiseResult.status === 'fulfilled') {
          results.push(promiseResult.value);
        } else {
          errors.push({
            index: results.length,
            error: promiseResult.reason.message,
          });
        }
      }
    }

    return {
      results,
      errors,
      stats: {
        total: tasks.length,
        successful: results.filter((r) => r.success).length,
        failed: errors.length,
      },
    };
  }

  /**
   * 获取工作线程池统计信息
   */
  getWorkerStats() {
    const stats = this.getStats();

    return {
      ...stats,
      workers: {
        ...this.taskStats,
        successRate:
          this.taskStats.totalTasks > 0
            ? (this.taskStats.completedTasks / this.taskStats.totalTasks) * 100
            : 0,
        errorRate:
          this.taskStats.totalTasks > 0
            ? (this.taskStats.failedTasks / this.taskStats.totalTasks) * 100
            : 0,
      },
      script: this.workerScript,
      workerData: Object.keys(this.workerData).length,
    };
  }

  /**
   * 重新加载Worker脚本
   */
  async reloadWorkers() {
    logger.info('重新加载Worker线程');

    // 清空当前池
    await this.clear();

    // 重新创建最小数量的工作线程
    await this._ensureMinIdle();

    logger.info('Worker线程重新加载完成');
  }

  /**
   * 广播消息到所有Worker
   */
  async broadcastMessage(message) {
    const promises = [];

    // 广播给空闲的worker
    for (const worker of this.resources) {
      promises.push(this._sendMessageToWorker(worker, message));
    }

    // 广播给正在使用的worker
    for (const worker of this.borrowed.keys()) {
      promises.push(this._sendMessageToWorker(worker, message));
    }

    const results = await Promise.allSettled(promises);

    const successCount = results.filter((r) => r.status === 'fulfilled').length;
    const failureCount = results.filter((r) => r.status === 'rejected').length;

    logger.info('广播消息完成', {
      total: promises.length,
      successful: successCount,
      failed: failureCount,
    });

    return { successCount, failureCount };
  }

  /**
   * 向单个Worker发送消息
   */
  _sendMessageToWorker(worker, message) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Message send timeout'));
      }, 5000);

      // 对于广播消息，我们不等待响应
      worker.postMessage({
        type: 'broadcast',
        data: message,
        timestamp: Date.now(),
      });

      // 简单的延迟resolve，因为广播不期望响应
      setTimeout(() => {
        clearTimeout(timeout);
        resolve();
      }, 100);
    });
  }

  /**
   * 获取Worker性能指标
   */
  getPerformanceMetrics() {
    const metrics = {
      pool: this.getWorkerStats(),
      system: {
        cpuCount: require('os').cpus().length,
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime(),
      },
      timestamp: new Date().toISOString(),
    };

    return metrics;
  }
}

/**
 * 创建计算密集型任务的Worker池
 */
export function createComputeWorkerPool(options = {}) {
  return new WorkerPool(path.join(__dirname, 'workers', 'compute.worker.js'), {
    objectType: 'compute_worker',
    ...options,
  });
}

/**
 * 创建I/O密集型任务的Worker池
 */
export function createIOWorkerPool(options = {}) {
  return new WorkerPool(path.join(__dirname, 'workers', 'io.worker.js'), {
    objectType: 'io_worker',
    ...options,
  });
}

/**
 * 创建数据处理任务的Worker池
 */
export function createDataProcessingWorkerPool(options = {}) {
  return new WorkerPool(
    path.join(__dirname, 'workers', 'data-processing.worker.js'),
    {
      objectType: 'data_processing_worker',
      ...options,
    },
  );
}
