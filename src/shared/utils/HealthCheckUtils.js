/**
 * 健康检查工具类
 * 提取重复的健康检查逻辑
 */

import { logger } from '../utils/logger.js';

export class HealthCheckUtils {
  /**
   * 创建健康检查器
   */
  static createHealthChecker(config = {}) {
    const {
      name = 'health_checker',
      checks = [],
      interval = 30000, // 30秒
      timeout = 5000,   // 5秒超时
      failureThreshold = 3,
      successThreshold = 1,
      onStatusChange = null
    } = config;

    const state = {
      isHealthy: true,
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
      lastCheck: null,
      lastSuccess: null,
      lastFailure: null,
      checkHistory: []
    };

    let intervalId = null;

    const checker = {
      /**
       * 启动健康检查
       */
      start: () => {
        if (intervalId) return;

        logger.info(`Starting health checker: ${name}`, {
          checksCount: checks.length,
          interval,
          timeout
        });

        intervalId = setInterval(async () => {
          await this.performHealthCheck(checker, checks, state, config);
        }, interval);

        // 立即执行一次
        setTimeout(() => {
          this.performHealthCheck(checker, checks, state, config);
        }, 100);
      },

      /**
       * 停止健康检查
       */
      stop: () => {
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
          logger.info(`Stopped health checker: ${name}`);
        }
      },

      /**
       * 手动执行健康检查
       */
      check: async () => {
        return await this.performHealthCheck(checker, checks, state, config);
      },

      /**
       * 获取健康状态
       */
      getStatus: () => ({
        name,
        isHealthy: state.isHealthy,
        consecutiveFailures: state.consecutiveFailures,
        consecutiveSuccesses: state.consecutiveSuccesses,
        lastCheck: state.lastCheck,
        lastSuccess: state.lastSuccess,
        lastFailure: state.lastFailure,
        uptime: state.lastSuccess ? Date.now() - state.lastSuccess : 0,
        downtime: state.lastFailure ? Date.now() - state.lastFailure : 0
      }),

      /**
       * 获取检查历史
       */
      getHistory: (limit = 50) => {
        return state.checkHistory.slice(-limit);
      },

      /**
       * 重置状态
       */
      reset: () => {
        state.consecutiveFailures = 0;
        state.consecutiveSuccesses = 0;
        state.checkHistory.length = 0;
        logger.info(`Reset health checker state: ${name}`);
      },

      /**
       * 是否正在运行
       */
      isRunning: () => !!intervalId
    };

    return checker;
  }

  /**
   * 执行健康检查
   */
  static async performHealthCheck(checker, checks, state, config) {
    const { timeout, failureThreshold, successThreshold, onStatusChange, name } = config;
    const startTime = Date.now();

    try {
      // 执行所有检查
      const results = await Promise.allSettled(
        checks.map(async (check) => {
          const checkStart = Date.now();

          try {
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error(`Check timeout after ${timeout}ms`)), timeout);
            });

            const result = await Promise.race([check.fn(), timeoutPromise]);
            const duration = Date.now() - checkStart;

            return {
              name: check.name,
              status: 'passed',
              result,
              duration,
              timestamp: Date.now()
            };

          } catch (error) {
            const duration = Date.now() - checkStart;

            return {
              name: check.name,
              status: 'failed',
              error: error.message,
              duration,
              timestamp: Date.now()
            };
          }
        })
      );

      // 评估整体健康状态
      const passed = results.filter(r => r.status === 'fulfilled' && r.value.status === 'passed');
      const failed = results.filter(r =>
        r.status === 'rejected' ||
        (r.status === 'fulfilled' && r.value.status === 'failed')
      );

      const isHealthy = failed.length === 0;
      const totalDuration = Date.now() - startTime;

      // 更新状态
      const previousHealth = state.isHealthy;
      state.lastCheck = Date.now();

      if (isHealthy) {
        state.consecutiveSuccesses++;
        state.consecutiveFailures = 0;
        state.lastSuccess = Date.now();
        state.isHealthy = state.consecutiveSuccesses >= successThreshold;
      } else {
        state.consecutiveFailures++;
        state.consecutiveSuccesses = 0;
        state.lastFailure = Date.now();
        state.isHealthy = !(state.consecutiveFailures >= failureThreshold);
      }

      // 记录历史
      state.checkHistory.push({
        timestamp: Date.now(),
        isHealthy,
        passed: passed.length,
        failed: failed.length,
        totalDuration,
        checks: results.map(r => r.status === 'fulfilled' ? r.value : {
          name: r.reason?.name || 'unknown',
          status: 'failed',
          error: r.reason?.message || 'Unknown error',
          duration: 0
        })
      });

      // 保持历史记录大小
      if (state.checkHistory.length > 1000) {
        state.checkHistory.splice(0, 500);
      }

      // 状态变化通知
      if (previousHealth !== state.isHealthy && onStatusChange) {
        try {
          await onStatusChange(state.isHealthy, {
            previousHealth,
            currentHealth: state.isHealthy,
            consecutiveFailures: state.consecutiveFailures,
            consecutiveSuccesses: state.consecutiveSuccesses,
            failedChecks: failed.map(r => r.status === 'fulfilled' ? r.value : r.reason)
          });
        } catch (callbackError) {
          logger.error(`Health status change callback failed for ${name}`, {
            error: callbackError.message
          });
        }
      }

      // 日志记录
      if (!isHealthy) {
        logger.warn(`Health check failed for ${name}`, {
          passed: passed.length,
          failed: failed.length,
          totalDuration,
          failures: failed.map(r => ({
            check: r.status === 'fulfilled' ? r.value.name : 'unknown',
            error: r.status === 'fulfilled' ? r.value.error : r.reason?.message
          }))
        });
      } else {
        logger.debug(`Health check passed for ${name}`, {
          passed: passed.length,
          failed: failed.length,
          totalDuration
        });
      }

      return {
        isHealthy,
        passed: passed.length,
        failed: failed.length,
        totalDuration,
        results: results.map(r => r.status === 'fulfilled' ? r.value : r.reason)
      };

    } catch (error) {
      logger.error(`Health check execution failed for ${name}`, {
        error: error.message,
        duration: Date.now() - startTime
      });

      // 标记为不健康
      state.consecutiveFailures++;
      state.lastFailure = Date.now();
      state.isHealthy = false;

      throw error;
    }
  }

  /**
   * 创建数据库健康检查
   */
  static createDatabaseHealthCheck(connectionPool, options = {}) {
    const {
      name = 'database',
      query = 'SELECT 1',
      timeout = 5000
    } = options;

    return {
      name,
      fn: async () => {
        const connection = await connectionPool.getConnection();
        try {
          await connection.query(query);
          return { status: 'ok', message: 'Database connection successful' };
        } finally {
          connection.release();
        }
      }
    };
  }

  /**
   * 创建HTTP服务健康检查
   */
  static createHttpHealthCheck(url, options = {}) {
    const {
      name = 'http_service',
      method = 'GET',
      expectedStatus = 200,
      timeout = 5000,
      headers = {}
    } = options;

    return {
      name,
      fn: async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
          const response = await fetch(url, {
            method,
            headers,
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          if (response.status !== expectedStatus) {
            throw new Error(`Unexpected status: ${response.status}, expected: ${expectedStatus}`);
          }

          return {
            status: 'ok',
            message: 'HTTP service responding',
            statusCode: response.status,
            responseTime: Date.now()
          };

        } catch (error) {
          clearTimeout(timeoutId);

          if (error.name === 'AbortError') {
            throw new Error(`Request timeout after ${timeout}ms`);
          }

          throw error;
        }
      }
    };
  }

  /**
   * 创建内存健康检查
   */
  static createMemoryHealthCheck(options = {}) {
    const {
      name = 'memory',
      maxUsagePercent = 85,
      maxHeapSize = null
    } = options;

    return {
      name,
      fn: () => {
        const memUsage = process.memoryUsage();
        const usagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

        if (usagePercent > maxUsagePercent) {
          throw new Error(`Memory usage too high: ${usagePercent.toFixed(1)}% > ${maxUsagePercent}%`);
        }

        if (maxHeapSize && memUsage.heapUsed > maxHeapSize) {
          throw new Error(`Heap size too large: ${memUsage.heapUsed} > ${maxHeapSize}`);
        }

        return {
          status: 'ok',
          message: 'Memory usage within limits',
          usagePercent: usagePercent.toFixed(1),
          heapUsed: memUsage.heapUsed,
          heapTotal: memUsage.heapTotal
        };
      }
    };
  }

  /**
   * 创建磁盘空间健康检查
   */
  static createDiskHealthCheck(options = {}) {
    const {
      name = 'disk',
      path = './',
      minFreeSpaceMB = 100
    } = options;

    return {
      name,
      fn: async () => {
        try {
          const fs = await import('fs/promises');
          const stats = await fs.statvfs(path);

          const freeSpaceMB = (stats.f_bavail * stats.f_frsize) / (1024 * 1024);

          if (freeSpaceMB < minFreeSpaceMB) {
            throw new Error(`Insufficient disk space: ${freeSpaceMB.toFixed(1)}MB < ${minFreeSpaceMB}MB`);
          }

          return {
            status: 'ok',
            message: 'Disk space sufficient',
            freeSpaceMB: freeSpaceMB.toFixed(1),
            totalSpaceMB: ((stats.f_blocks * stats.f_frsize) / (1024 * 1024)).toFixed(1)
          };

        } catch (error) {
          // 如果statvfs不可用，使用简化的检查
          if (error.code === 'ENOTSUP') {
            logger.debug('statvfs not supported, skipping disk check');
            return {
              status: 'ok',
              message: 'Disk check skipped (not supported)',
              note: 'statvfs not available on this platform'
            };
          }
          throw error;
        }
      }
    };
  }

  /**
   * 创建复合健康检查
   */
  static createCompositeHealthCheck(checks, options = {}) {
    const {
      name = 'composite',
      requireAll = true, // true: 所有检查通过才算健康, false: 任意检查通过就算健康
      weights = {} // 检查权重，用于计算整体健康分数
    } = options;

    return {
      name,
      fn: async () => {
        const results = await Promise.allSettled(
          checks.map(async (check) => {
            try {
              const result = await check.fn();
              return {
                name: check.name,
                passed: true,
                result,
                weight: weights[check.name] || 1
              };
            } catch (error) {
              return {
                name: check.name,
                passed: false,
                error: error.message,
                weight: weights[check.name] || 1
              };
            }
          })
        );

        const passed = results.filter(r => r.status === 'fulfilled' && r.value.passed);
        const failed = results.filter(r =>
          r.status === 'rejected' ||
          (r.status === 'fulfilled' && !r.value.passed)
        );

        // 计算健康分数
        const totalWeight = results.reduce((sum, r) => {
          return sum + (r.status === 'fulfilled' ? r.value.weight : (weights[r.reason?.name] || 1));
        }, 0);

        const passedWeight = passed.reduce((sum, r) => sum + r.weight, 0);
        const healthScore = totalWeight > 0 ? (passedWeight / totalWeight) * 100 : 0;

        const isHealthy = requireAll ? failed.length === 0 : passed.length > 0;

        if (!isHealthy) {
          const errorMessages = failed.map(r =>
            r.status === 'fulfilled' ? `${r.value.name}: ${r.value.error}` : `${r.reason?.name}: ${r.reason?.message}`
          );

          throw new Error(`Composite health check failed: ${errorMessages.join(', ')}`);
        }

        return {
          status: 'ok',
          message: `Composite health check passed (${passed.length}/${results.length})`,
          passed: passed.length,
          failed: failed.length,
          total: results.length,
          healthScore: healthScore.toFixed(1),
          details: results.map(r => r.status === 'fulfilled' ? r.value : r.reason)
        };
      }
    };
  }

  /**
   * 创建外部服务健康检查
   */
  static createExternalServiceHealthCheck(serviceUrl, options = {}) {
    const {
      name = 'external_service',
      healthEndpoint = '/health',
      expectedResponse = { status: 'ok' },
      timeout = 10000
    } = options;

    return {
      name,
      fn: async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
          const response = await fetch(`${serviceUrl}${healthEndpoint}`, {
            signal: controller.signal,
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'HealthChecker/1.0'
            }
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            throw new Error(`Service returned ${response.status}: ${response.statusText}`);
          }

          const data = await response.json();

          // 检查期望的响应
          if (expectedResponse) {
            for (const [key, expectedValue] of Object.entries(expectedResponse)) {
              if (data[key] !== expectedValue) {
                throw new Error(`Unexpected response: ${key}=${data[key]}, expected ${expectedValue}`);
              }
            }
          }

          return {
            status: 'ok',
            message: 'External service healthy',
            responseTime: Date.now(),
            data
          };

        } catch (error) {
          clearTimeout(timeoutId);

          if (error.name === 'AbortError') {
            throw new Error(`External service timeout after ${timeout}ms`);
          }

          throw error;
        }
      }
    };
  }

  /**
   * 创建缓存健康检查
   */
  static createCacheHealthCheck(cacheClient, options = {}) {
    const {
      name = 'cache',
      testKey = 'health_check_test',
      testValue = 'ok',
      timeout = 5000
    } = options;

    return {
      name,
      fn: async () => {
        const startTime = Date.now();

        try {
          // 测试写入
          await cacheClient.set(testKey, testValue, { EX: 10 });

          // 测试读取
          const retrieved = await cacheClient.get(testKey);

          if (retrieved !== testValue) {
            throw new Error(`Cache consistency check failed: expected ${testValue}, got ${retrieved}`);
          }

          // 清理测试数据
          await cacheClient.del(testKey);

          const responseTime = Date.now() - startTime;

          return {
            status: 'ok',
            message: 'Cache service healthy',
            responseTime,
            operations: ['set', 'get', 'del']
          };

        } catch (error) {
          const responseTime = Date.now() - startTime;

          if (responseTime > timeout) {
            throw new Error(`Cache operation timeout after ${timeout}ms`);
          }

          throw error;
        }
      }
    };
  }

  /**
   * 创建消息队列健康检查
   */
  static createQueueHealthCheck(queueClient, options = {}) {
    const {
      name = 'queue',
      testQueue = 'health_check_queue',
      timeout = 5000
    } = options;

    return {
      name,
      fn: async () => {
        const startTime = Date.now();

        try {
          const testMessage = { test: true, timestamp: Date.now() };

          // 发送测试消息
          await queueClient.send(testQueue, testMessage);

          // 尝试接收消息（如果支持）
          if (typeof queueClient.receive === 'function') {
            const received = await queueClient.receive(testQueue, { timeout: 1000 });
            if (received && received.test) {
              // 确认消息处理
              if (typeof queueClient.ack === 'function') {
                await queueClient.ack(received.id);
              }
            }
          }

          const responseTime = Date.now() - startTime;

          return {
            status: 'ok',
            message: 'Queue service healthy',
            responseTime,
            operations: ['send', 'receive']
          };

        } catch (error) {
          const responseTime = Date.now() - startTime;

          if (responseTime > timeout) {
            throw new Error(`Queue operation timeout after ${timeout}ms`);
          }

          throw error;
        }
      }
    };
  }
}
