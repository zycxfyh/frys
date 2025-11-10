/**
 * 定时器管理器
 * 统一管理setInterval/clearInterval的创建和清理
 */

import { logger } from '../utils/logger.js';

export class TimerManager {
  constructor() {
    this.timers = new Map();
    this.timerMetadata = new Map();
    this.isDestroyed = false;
  }

  /**
   * 创建定时器
   */
  createTimer(name, callback, interval, options = {}) {
    if (this.isDestroyed) {
      throw new Error('TimerManager is destroyed');
    }

    if (this.timers.has(name)) {
      logger.warn(`Timer '${name}' already exists, replacing...`);
      this.clearTimer(name);
    }

    const {
      immediate = false,
      maxRuns = null,
      autoStart = true,
      context = {},
      onError = null
    } = options;

    let runCount = 0;

    const wrappedCallback = async () => {
      try {
        if (maxRuns && runCount >= maxRuns) {
          logger.debug(`Timer '${name}' reached max runs (${maxRuns}), stopping`);
          this.clearTimer(name);
          return;
        }

        runCount++;
        await callback();

      } catch (error) {
        logger.error(`Timer '${name}' callback failed`, {
          error: error.message,
          runCount,
          stack: error.stack,
          ...context
        });

        if (onError) {
          try {
            await onError(error, runCount);
          } catch (onErrorFailure) {
            logger.error(`Timer '${name}' error handler failed`, {
              originalError: error.message,
              handlerError: onErrorFailure.message
            });
          }
        }

        // 如果出错且没有错误处理器，停止定时器
        if (!onError) {
          logger.warn(`Stopping timer '${name}' due to unhandled error`);
          this.clearTimer(name);
        }
      }
    };

    const timerId = setInterval(wrappedCallback, interval);

    this.timers.set(name, timerId);
    this.timerMetadata.set(name, {
      interval,
      createdAt: Date.now(),
      runCount: 0,
      maxRuns,
      context,
      options
    });

    logger.debug(`Timer '${name}' created`, {
      interval,
      immediate,
      maxRuns,
      autoStart,
      ...context
    });

    if (immediate) {
      // 立即执行一次
      setTimeout(wrappedCallback, 0);
    }

    return name;
  }

  /**
   * 创建一次性定时器
   */
  createTimeout(name, callback, delay, options = {}) {
    if (this.isDestroyed) {
      throw new Error('TimerManager is destroyed');
    }

    const { context = {}, onError = null } = options;

    const wrappedCallback = async () => {
      try {
        await callback();
        // 一次性定时器执行完成后自动清理
        this.timerMetadata.delete(name);

      } catch (error) {
        logger.error(`Timeout '${name}' callback failed`, {
          error: error.message,
          stack: error.stack,
          ...context
        });

        if (onError) {
          try {
            await onError(error);
          } catch (onErrorFailure) {
            logger.error(`Timeout '${name}' error handler failed`, {
              originalError: error.message,
              handlerError: onErrorFailure.message
            });
          }
        }

        this.timerMetadata.delete(name);
      }
    };

    const timerId = setTimeout(wrappedCallback, delay);

    this.timers.set(name, timerId);
    this.timerMetadata.set(name, {
      type: 'timeout',
      delay,
      createdAt: Date.now(),
      context,
      options
    });

    logger.debug(`Timeout '${name}' created`, {
      delay,
      ...context
    });

    return name;
  }

  /**
   * 清除定时器
   */
  clearTimer(name) {
    const timerId = this.timers.get(name);
    if (!timerId) {
      logger.debug(`Timer '${name}' not found`);
      return false;
    }

    const metadata = this.timerMetadata.get(name);
    const clearFn = metadata?.type === 'timeout' ? clearTimeout : clearInterval;

    clearFn(timerId);
    this.timers.delete(name);
    this.timerMetadata.delete(name);

    logger.debug(`Timer '${name}' cleared`, {
      type: metadata?.type || 'interval',
      runCount: metadata?.runCount || 0
    });

    return true;
  }

  /**
   * 检查定时器是否存在
   */
  hasTimer(name) {
    return this.timers.has(name);
  }

  /**
   * 获取定时器信息
   */
  getTimerInfo(name) {
    const metadata = this.timerMetadata.get(name);
    if (!metadata) return null;

    const timerId = this.timers.get(name);
    const age = Date.now() - metadata.createdAt;

    return {
      name,
      timerId,
      type: metadata.type || 'interval',
      interval: metadata.interval,
      delay: metadata.delay,
      createdAt: metadata.createdAt,
      age,
      runCount: metadata.runCount,
      maxRuns: metadata.maxRuns,
      isActive: !!timerId
    };
  }

  /**
   * 获取所有定时器信息
   */
  getAllTimersInfo() {
    const timers = [];
    for (const name of this.timers.keys()) {
      const info = this.getTimerInfo(name);
      if (info) timers.push(info);
    }
    return timers;
  }

  /**
   * 暂停定时器
   */
  pauseTimer(name) {
    const timerId = this.timers.get(name);
    if (!timerId) return false;

    clearInterval(timerId);
    this.timers.delete(name);

    const metadata = this.timerMetadata.get(name);
    if (metadata) {
      metadata.pausedAt = Date.now();
      metadata.isPaused = true;
    }

    logger.debug(`Timer '${name}' paused`);
    return true;
  }

  /**
   * 恢复定时器
   */
  resumeTimer(name) {
    const metadata = this.timerMetadata.get(name);
    if (!metadata || !metadata.isPaused) return false;

    const callback = metadata.options?.originalCallback;
    if (!callback) {
      logger.warn(`Cannot resume timer '${name}': no original callback`);
      return false;
    }

    const remainingInterval = metadata.interval - (Date.now() - metadata.pausedAt);

    // 如果剩余时间很短，立即重新创建定时器
    const newInterval = Math.max(remainingInterval, 100);

    const newTimerId = setInterval(callback, newInterval);
    this.timers.set(name, newTimerId);

    metadata.isPaused = false;
    metadata.pausedAt = null;

    logger.debug(`Timer '${name}' resumed`, { remainingInterval, newInterval });
    return true;
  }

  /**
   * 重置定时器运行计数
   */
  resetTimer(name) {
    const metadata = this.timerMetadata.get(name);
    if (metadata) {
      metadata.runCount = 0;
      metadata.createdAt = Date.now();
      logger.debug(`Timer '${name}' reset`);
      return true;
    }
    return false;
  }

  /**
   * 批量清除所有定时器
   */
  clearAllTimers() {
    const names = Array.from(this.timers.keys());
    let cleared = 0;

    for (const name of names) {
      if (this.clearTimer(name)) {
        cleared++;
      }
    }

    logger.info(`Cleared ${cleared} timers`);
    return cleared;
  }

  /**
   * 按模式清除定时器
   */
  clearTimersByPattern(pattern) {
    const names = Array.from(this.timers.keys());
    let cleared = 0;

    for (const name of names) {
      if (pattern.test(name)) {
        if (this.clearTimer(name)) {
          cleared++;
        }
      }
    }

    logger.info(`Cleared ${cleared} timers matching pattern: ${pattern}`);
    return cleared;
  }

  /**
   * 创建定时器组
   */
  createTimerGroup(groupName, timers) {
    const group = {
      name: groupName,
      timers: [],
      createdAt: Date.now()
    };

    for (const timerConfig of timers) {
      const { name, callback, interval, options = {} } = timerConfig;
      const fullName = `${groupName}:${name}`;

      this.createTimer(fullName, callback, interval, options);
      group.timers.push(fullName);
    }

    logger.info(`Timer group '${groupName}' created`, {
      timerCount: group.timers.length
    });

    return group;
  }

  /**
   * 清除定时器组
   */
  clearTimerGroup(groupName) {
    const pattern = new RegExp(`^${groupName}:`);
    return this.clearTimersByPattern(pattern);
  }

  /**
   * 获取定时器统计信息
   */
  getStats() {
    const timers = this.getAllTimersInfo();
    const now = Date.now();

    const stats = {
      total: timers.length,
      byType: {},
      averageAge: 0,
      oldestTimer: null,
      newestTimer: null,
      totalRunCount: 0
    };

    let totalAge = 0;

    for (const timer of timers) {
      // 按类型统计
      const type = timer.type;
      stats.byType[type] = (stats.byType[type] || 0) + 1;

      // 年龄统计
      totalAge += timer.age;

      // 最老/最新定时器
      if (!stats.oldestTimer || timer.createdAt < stats.oldestTimer.createdAt) {
        stats.oldestTimer = timer;
      }
      if (!stats.newestTimer || timer.createdAt > stats.newestTimer.createdAt) {
        stats.newestTimer = timer;
      }

      // 运行计数
      stats.totalRunCount += timer.runCount || 0;
    }

    stats.averageAge = timers.length > 0 ? totalAge / timers.length : 0;

    return stats;
  }

  /**
   * 销毁管理器
   */
  destroy() {
    if (this.isDestroyed) return;

    logger.info('Destroying TimerManager...');

    this.clearAllTimers();
    this.timers.clear();
    this.timerMetadata.clear();
    this.isDestroyed = true;

    logger.info('TimerManager destroyed');
  }

  /**
   * 检查是否已销毁
   */
  get destroyed() {
    return this.isDestroyed;
  }
}

/**
 * 定时器工具函数
 */
export const TimerUtils = {
  /**
   * 创建延迟执行器
   */
  createDelayer(baseDelay = 1000, maxDelay = 30000) {
    return {
      execute: async (operation, attempt = 1) => {
        const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);

        if (attempt > 1) {
          logger.debug(`Delaying execution for ${delay}ms (attempt ${attempt})`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        return operation();
      }
    };
  },

  /**
   * 创建节流执行器
   */
  createThrottler(interval = 1000) {
    let lastExecution = 0;

    return {
      execute: async (operation) => {
        const now = Date.now();
        const timeSinceLast = now - lastExecution;

        if (timeSinceLast < interval) {
          const waitTime = interval - timeSinceLast;
          logger.debug(`Throttling execution, waiting ${waitTime}ms`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }

        lastExecution = Date.now();
        return operation();
      }
    };
  },

  /**
   * 创建防抖执行器
   */
  createDebouncer(delay = 300) {
    let timeoutId = null;

    return {
      execute: (operation) => {
        return new Promise((resolve, reject) => {
          if (timeoutId) {
            clearTimeout(timeoutId);
          }

          timeoutId = setTimeout(async () => {
            try {
              const result = await operation();
              resolve(result);
            } catch (error) {
              reject(error);
            }
          }, delay);
        });
      },

      cancel: () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
      }
    };
  }
};
