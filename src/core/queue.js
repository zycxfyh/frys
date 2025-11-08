/**
 * frys 消息队列配置
 * 使用 Bull.js + Redis 替代自建的 NATS-inspired 消息队列
 */

import Queue from 'bull';
import Redis from 'ioredis';
import { resolve } from './container.js';
import { logger } from '../utils/logger.js';
import { config } from '../utils/config.js';

// 队列配置
const QUEUE_CONFIG = {
  redis: {
    host: config.redis?.host || 'localhost',
    port: config.redis?.port || 6379,
    password: config.redis?.password,
    db: config.redis?.db || 0,
  },
  defaultJobOptions: {
    removeOnComplete: 50,    // 完成任务保留数量
    removeOnFail: 100,      // 失败任务保留数量
    attempts: 3,            // 重试次数
    backoff: {
      type: 'exponential',
      delay: 2000,          // 初始延迟2秒
    },
  },
};

// 创建队列实例
const queues = new Map();

// 工作进程管理
const workers = new Map();

/**
 * 创建或获取队列实例
 */
export function getQueue(name, options = {}) {
  if (!queues.has(name)) {
    const queueOptions = {
      ...QUEUE_CONFIG,
      ...options,
    };

    const queue = new Queue(name, queueOptions);
    queues.set(name, queue);

    // 设置队列事件监听
    setupQueueEvents(queue, name);

    logger.debug(`📋 队列已创建: ${name}`);
  }

  return queues.get(name);
}

/**
 * 设置队列事件监听
 */
function setupQueueEvents(queue, queueName) {
  queue.on('ready', () => {
    logger.debug(`📋 队列就绪: ${queueName}`);
  });

  queue.on('error', (error) => {
    // 在开发/测试环境中，如果是Redis连接错误，只显示一次警告
    if (error.code === 'ECONNREFUSED' && (config.env === 'development' || config.env === 'test')) {
      if (!queue.redisConnectionWarned) {
        logger.warn(`📋 Redis未连接 [${queueName}] - 队列功能将被禁用`);
        queue.redisConnectionWarned = true;
      }
    } else {
    logger.error(`📋 队列错误 [${queueName}]`, error);
    }
  });

  queue.on('waiting', (jobId) => {
    logger.debug(`📋 任务等待中 [${queueName}]: ${jobId}`);
  });

  queue.on('active', (job, jobPromise) => {
    logger.debug(`📋 任务开始执行 [${queueName}]: ${job.id}`);
  });

  queue.on('completed', (job, result) => {
    logger.debug(`📋 任务完成 [${queueName}]: ${job.id}`, { result });
  });

  queue.on('failed', (job, err) => {
    logger.error(`📋 任务失败 [${queueName}]: ${job.id}`, {
      error: err.message,
      attemptsMade: job.attemptsMade,
      attemptsRemaining: job.opts.attempts - job.attemptsMade,
    });
  });

  queue.on('stalled', (job) => {
    logger.warn(`📋 任务停滞 [${queueName}]: ${job.id}`);
  });
}

/**
 * 添加任务到队列
 */
export async function addJob(queueName, jobName, data, options = {}) {
  const queue = getQueue(queueName);
  const job = await queue.add(jobName, data, {
    ...QUEUE_CONFIG.defaultJobOptions,
    ...options,
  });

  logger.debug(`📋 任务已添加 [${queueName}]: ${job.id}`, { jobName, data });
  return job;
}

/**
 * 创建工作进程
 */
export function createWorker(queueName, processor, options = {}) {
  const queue = getQueue(queueName);

  const workerOptions = {
    concurrency: options.concurrency || 5, // 并发数
    limiter: options.limiter || {
      max: 1000,     // 每 duration 毫秒最多处理的任务数
      duration: 5000,
    },
    ...options,
  };

  // 停止现有工作进程
  if (workers.has(queueName)) {
    workers.get(queueName).close();
  }

  const worker = queue.process(workerOptions.concurrency, async (job) => {
    const startTime = Date.now();

    try {
      logger.debug(`⚙️ 开始处理任务 [${queueName}]: ${job.id}`, {
        jobName: job.name,
        data: job.data,
      });

      const result = await processor(job);

      const duration = Date.now() - startTime;
      logger.debug(`⚙️ 任务处理完成 [${queueName}]: ${job.id}`, {
        duration: `${duration}ms`,
        result,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`⚙️ 任务处理失败 [${queueName}]: ${job.id}`, {
        duration: `${duration}ms`,
        error: error.message,
        stack: error.stack,
        attempts: job.attemptsMade,
      });

      throw error;
    }
  });

  workers.set(queueName, worker);

  logger.info(`⚙️ 工作进程已创建 [${queueName}]`, {
    concurrency: workerOptions.concurrency,
    limiter: workerOptions.limiter,
  });

  return worker;
}

/**
 * 暂停队列
 */
export async function pauseQueue(queueName) {
  const queue = queues.get(queueName);
  if (queue) {
    await queue.pause();
    logger.info(`⏸️ 队列已暂停: ${queueName}`);
  }
}

/**
 * 恢复队列
 */
export async function resumeQueue(queueName) {
  const queue = queues.get(queueName);
  if (queue) {
    await queue.resume();
    logger.info(`▶️ 队列已恢复: ${queueName}`);
  }
}

/**
 * 清空队列
 */
export async function emptyQueue(queueName) {
  const queue = queues.get(queueName);
  if (queue) {
    await queue.empty();
    logger.info(`🗑️ 队列已清空: ${queueName}`);
  }
}

/**
 * 获取队列状态
 */
export async function getQueueStatus(queueName) {
  const queue = queues.get(queueName);
  if (!queue) {
    return null;
  }

  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaiting(),
    queue.getActive(),
    queue.getCompleted(),
    queue.getFailed(),
    queue.getDelayed(),
  ]);

  return {
    name: queueName,
    waiting: waiting.length,
    active: active.length,
    completed: completed.length,
    failed: failed.length,
    delayed: delayed.length,
    isPaused: await queue.isPaused(),
  };
}

/**
 * 获取所有队列状态
 */
export async function getAllQueuesStatus() {
  const statuses = {};

  for (const queueName of queues.keys()) {
    statuses[queueName] = await getQueueStatus(queueName);
  }

  return {
    queues: statuses,
    totalQueues: queues.size,
    workers: workers.size,
  };
}

/**
 * 关闭所有队列和工作进程
 */
export async function closeAllQueues() {
  logger.info('🛑 正在关闭所有队列和工作进程...');

  // 关闭工作进程
  for (const [queueName, worker] of workers) {
    try {
      await worker.close();
      logger.debug(`⚙️ 工作进程已关闭: ${queueName}`);
    } catch (error) {
      logger.error(`⚙️ 工作进程关闭失败: ${queueName}`, error);
    }
  }
  workers.clear();

  // 关闭队列
  for (const [queueName, queue] of queues) {
    try {
      await queue.close();
      logger.debug(`📋 队列已关闭: ${queueName}`);
    } catch (error) {
      logger.error(`📋 队列关闭失败: ${queueName}`, error);
    }
  }
  queues.clear();

  logger.info('✅ 所有队列和工作进程已关闭');
}

/**
 * 健康检查
 */
export async function healthCheck() {
  try {
    const statuses = await getAllQueuesStatus();
    const hasErrors = Object.values(statuses.queues).some(
      (status) => !status || status.failed > 100 // 失败任务过多视为不健康
    );

    return {
      healthy: !hasErrors,
      status: statuses,
      timestamp: Date.now(),
    };
  } catch (error) {
    logger.error('队列健康检查失败', error);
    return {
      healthy: false,
      error: error.message,
      timestamp: Date.now(),
    };
  }
}

// 导出便捷方法
export {
  addJob as publish,
  getQueue as subscribe,
  createWorker as registerProcessor,
};
