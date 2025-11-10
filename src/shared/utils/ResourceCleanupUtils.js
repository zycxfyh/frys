/**
 * 资源清理工具类
 * 统一Map、Set和其他资源的清理逻辑
 */

import { logger } from '../utils/logger.js';

export class ResourceCleanupUtils {
  /**
   * 清理Map资源
   */
  static cleanupMap(map, name = 'unnamed_map') {
    if (!map || typeof map.clear !== 'function') {
      logger.debug(`Map ${name} is not a valid Map object`);
      return false;
    }

    try {
      const size = map.size;
      map.clear();

      logger.debug(`Cleaned up Map ${name}`, {
        originalSize: size,
        finalSize: map.size
      });

      return true;
    } catch (error) {
      logger.error(`Failed to cleanup Map ${name}`, {
        error: error.message,
        stack: error.stack
      });
      return false;
    }
  }

  /**
   * 清理Set资源
   */
  static cleanupSet(set, name = 'unnamed_set') {
    if (!set || typeof set.clear !== 'function') {
      logger.debug(`Set ${name} is not a valid Set object`);
      return false;
    }

    try {
      const size = set.size;
      set.clear();

      logger.debug(`Cleaned up Set ${name}`, {
        originalSize: size,
        finalSize: set.size
      });

      return true;
    } catch (error) {
      logger.error(`Failed to cleanup Set ${name}`, {
        error: error.message,
        stack: error.stack
      });
      return false;
    }
  }

  /**
   * 清理数组资源
   */
  static cleanupArray(array, name = 'unnamed_array') {
    if (!Array.isArray(array)) {
      logger.debug(`Array ${name} is not a valid Array object`);
      return false;
    }

    try {
      const originalLength = array.length;
      array.length = 0; // 清空数组

      logger.debug(`Cleaned up Array ${name}`, {
        originalLength,
        finalLength: array.length
      });

      return true;
    } catch (error) {
      logger.error(`Failed to cleanup Array ${name}`, {
        error: error.message,
        stack: error.stack
      });
      return false;
    }
  }

  /**
   * 清理对象资源
   */
  static cleanupObject(obj, name = 'unnamed_object') {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      logger.debug(`Object ${name} is not a valid Object`);
      return false;
    }

    try {
      const keys = Object.keys(obj);
      for (const key of keys) {
        delete obj[key];
      }

      logger.debug(`Cleaned up Object ${name}`, {
        originalKeysCount: keys.length,
        finalKeysCount: Object.keys(obj).length
      });

      return true;
    } catch (error) {
      logger.error(`Failed to cleanup Object ${name}`, {
        error: error.message,
        stack: error.stack
      });
      return false;
    }
  }

  /**
   * 清理定时器资源
   */
  static cleanupTimer(timerId, name = 'unnamed_timer') {
    if (!timerId) {
      logger.debug(`Timer ${name} is not valid`);
      return false;
    }

    try {
      clearTimeout(timerId);
      clearInterval(timerId);

      logger.debug(`Cleaned up Timer ${name}`);
      return true;
    } catch (error) {
      logger.error(`Failed to cleanup Timer ${name}`, {
        error: error.message,
        stack: error.stack
      });
      return false;
    }
  }

  /**
   * 清理事件监听器
   */
  static cleanupEventListeners(emitter, eventName, name = 'unnamed_emitter') {
    if (!emitter || typeof emitter.removeAllListeners !== 'function') {
      logger.debug(`Emitter ${name} is not a valid EventEmitter`);
      return false;
    }

    try {
      if (eventName) {
        emitter.removeAllListeners(eventName);
        logger.debug(`Cleaned up event listeners for ${eventName} on ${name}`);
      } else {
        emitter.removeAllListeners();
        logger.debug(`Cleaned up all event listeners on ${name}`);
      }

      return true;
    } catch (error) {
      logger.error(`Failed to cleanup event listeners on ${name}`, {
        error: error.message,
        stack: error.stack
      });
      return false;
    }
  }

  /**
   * 清理文件流资源
   */
  static cleanupStream(stream, name = 'unnamed_stream') {
    if (!stream || typeof stream.destroy !== 'function') {
      logger.debug(`Stream ${name} is not a valid stream`);
      return false;
    }

    try {
      if (!stream.destroyed) {
        stream.destroy();
        logger.debug(`Cleaned up Stream ${name}`);
      } else {
        logger.debug(`Stream ${name} was already destroyed`);
      }

      return true;
    } catch (error) {
      logger.error(`Failed to cleanup Stream ${name}`, {
        error: error.message,
        stack: error.stack
      });
      return false;
    }
  }

  /**
   * 清理数据库连接
   */
  static async cleanupDatabaseConnection(connection, name = 'unnamed_connection') {
    if (!connection || typeof connection.end !== 'function') {
      logger.debug(`Database connection ${name} is not valid`);
      return false;
    }

    try {
      await connection.end();
      logger.debug(`Cleaned up database connection ${name}`);
      return true;
    } catch (error) {
      logger.error(`Failed to cleanup database connection ${name}`, {
        error: error.message,
        stack: error.stack
      });
      return false;
    }
  }

  /**
   * 清理HTTP服务器
   */
  static cleanupHttpServer(server, name = 'unnamed_server') {
    if (!server || typeof server.close !== 'function') {
      logger.debug(`HTTP server ${name} is not valid`);
      return false;
    }

    return new Promise((resolve) => {
      server.close((error) => {
        if (error) {
          logger.error(`Failed to cleanup HTTP server ${name}`, {
            error: error.message,
            stack: error.stack
          });
          resolve(false);
        } else {
          logger.debug(`Cleaned up HTTP server ${name}`);
          resolve(true);
        }
      });
    });
  }

  /**
   * 创建资源清理器
   */
  static createCleanupManager(name = 'unnamed_manager') {
    const resources = {
      maps: new Map(),
      sets: new Map(),
      arrays: new Map(),
      objects: new Map(),
      timers: new Map(),
      emitters: new Map(),
      streams: new Map(),
      connections: new Map(),
      servers: new Map(),
      custom: new Map()
    };

    return {
      /**
       * 注册资源
       */
      register: (type, resource, resourceName = 'unnamed') => {
        if (!resources[type]) {
          logger.warn(`Unknown resource type: ${type}`);
          return false;
        }

        resources[type].set(resourceName, resource);
        logger.debug(`Registered ${type} resource: ${resourceName}`);
        return true;
      },

      /**
       * 注销资源
       */
      unregister: (type, resourceName) => {
        if (!resources[type]) {
          logger.warn(`Unknown resource type: ${type}`);
          return false;
        }

        const removed = resources[type].delete(resourceName);
        if (removed) {
          logger.debug(`Unregistered ${type} resource: ${resourceName}`);
        }
        return removed;
      },

      /**
       * 清理所有资源
       */
      cleanup: async () => {
        const results = {
          total: 0,
          successful: 0,
          failed: 0,
          details: {}
        };

        logger.info(`Starting cleanup for manager: ${name}`);

        // 清理Map资源
        for (const [resourceName, resource] of resources.maps) {
          results.total++;
          if (this.cleanupMap(resource, resourceName)) {
            results.successful++;
          } else {
            results.failed++;
            results.details[`map_${resourceName}`] = 'failed';
          }
        }

        // 清理Set资源
        for (const [resourceName, resource] of resources.sets) {
          results.total++;
          if (this.cleanupSet(resource, resourceName)) {
            results.successful++;
          } else {
            results.failed++;
            results.details[`set_${resourceName}`] = 'failed';
          }
        }

        // 清理数组资源
        for (const [resourceName, resource] of resources.arrays) {
          results.total++;
          if (this.cleanupArray(resource, resourceName)) {
            results.successful++;
          } else {
            results.failed++;
            results.details[`array_${resourceName}`] = 'failed';
          }
        }

        // 清理对象资源
        for (const [resourceName, resource] of resources.objects) {
          results.total++;
          if (this.cleanupObject(resource, resourceName)) {
            results.successful++;
          } else {
            results.failed++;
            results.details[`object_${resourceName}`] = 'failed';
          }
        }

        // 清理定时器资源
        for (const [resourceName, resource] of resources.timers) {
          results.total++;
          if (this.cleanupTimer(resource, resourceName)) {
            results.successful++;
          } else {
            results.failed++;
            results.details[`timer_${resourceName}`] = 'failed';
          }
        }

        // 清理事件监听器
        for (const [resourceName, resource] of resources.emitters) {
          results.total++;
          if (this.cleanupEventListeners(resource, null, resourceName)) {
            results.successful++;
          } else {
            results.failed++;
            results.details[`emitter_${resourceName}`] = 'failed';
          }
        }

        // 清理流资源
        for (const [resourceName, resource] of resources.streams) {
          results.total++;
          if (this.cleanupStream(resource, resourceName)) {
            results.successful++;
          } else {
            results.failed++;
            results.details[`stream_${resourceName}`] = 'failed';
          }
        }

        // 清理数据库连接
        for (const [resourceName, resource] of resources.connections) {
          results.total++;
          const success = await this.cleanupDatabaseConnection(resource, resourceName);
          if (success) {
            results.successful++;
          } else {
            results.failed++;
            results.details[`connection_${resourceName}`] = 'failed';
          }
        }

        // 清理HTTP服务器
        for (const [resourceName, resource] of resources.servers) {
          results.total++;
          const success = await this.cleanupHttpServer(resource, resourceName);
          if (success) {
            results.successful++;
          } else {
            results.failed++;
            results.details[`server_${resourceName}`] = 'failed';
          }
        }

        // 清理自定义资源
        for (const [resourceName, cleanupFn] of resources.custom) {
          results.total++;
          try {
            await cleanupFn();
            results.successful++;
            logger.debug(`Cleaned up custom resource: ${resourceName}`);
          } catch (error) {
            results.failed++;
            results.details[`custom_${resourceName}`] = error.message;
            logger.error(`Failed to cleanup custom resource: ${resourceName}`, {
              error: error.message
            });
          }
        }

        // 清空注册表
        for (const resourceType of Object.keys(resources)) {
          resources[resourceType].clear();
        }

        logger.info(`Cleanup completed for manager: ${name}`, {
          total: results.total,
          successful: results.successful,
          failed: results.failed
        });

        return results;
      },

      /**
       * 获取状态
       */
      getStatus: () => {
        const status = {};
        for (const [type, resourceMap] of Object.entries(resources)) {
          status[type] = resourceMap.size;
        }
        return {
          manager: name,
          resources: status,
          totalResources: Object.values(status).reduce((sum, count) => sum + count, 0)
        };
      }
    };
  }

  /**
   * 批量清理工具函数
   */
  static async batchCleanup(cleanupTasks, options = {}) {
    const {
      continueOnError = false,
      concurrency = 5,
      name = 'batch_cleanup'
    } = options;

    const results = {
      total: cleanupTasks.length,
      successful: 0,
      failed: 0,
      errors: []
    };

    logger.info(`Starting batch cleanup: ${name}`, { total: cleanupTasks.length });

    // 分批处理
    for (let i = 0; i < cleanupTasks.length; i += concurrency) {
      const batch = cleanupTasks.slice(i, i + concurrency);
      const batchPromises = batch.map(async (task, index) => {
        const taskIndex = i + index;

        try {
          await task.cleanup();
          results.successful++;
          return { index: taskIndex, success: true };

        } catch (error) {
          results.failed++;
          results.errors.push({
            index: taskIndex,
            task: task.name || `task_${taskIndex}`,
            error: error.message
          });

          logger.error(`Batch cleanup task failed: ${task.name || `task_${taskIndex}`}`, {
            error: error.message,
            stack: error.stack
          });

          if (!continueOnError) {
            throw error;
          }

          return { index: taskIndex, success: false, error: error.message };
        }
      });

      await Promise.allSettled(batchPromises);
    }

    logger.info(`Batch cleanup completed: ${name}`, {
      total: results.total,
      successful: results.successful,
      failed: results.failed
    });

    return results;
  }

  /**
   * 内存泄漏检测
   */
  static detectMemoryLeaks(initialSnapshot, finalSnapshot, name = 'unnamed_check') {
    const leaks = {
      detected: false,
      details: {},
      recommendations: []
    };

    // 比较内存使用情况
    const memoryLeak = (finalSnapshot.heapUsed - initialSnapshot.heapUsed) > (1024 * 1024); // 1MB阈值
    const externalLeak = (finalSnapshot.external - initialSnapshot.external) > (512 * 1024); // 512KB阈值

    if (memoryLeak) {
      leaks.detected = true;
      leaks.details.heapLeak = {
        initial: initialSnapshot.heapUsed,
        final: finalSnapshot.heapUsed,
        difference: finalSnapshot.heapUsed - initialSnapshot.heapUsed
      };
      leaks.recommendations.push('Check for object references not being released');
    }

    if (externalLeak) {
      leaks.detected = true;
      leaks.details.externalLeak = {
        initial: initialSnapshot.external,
        final: finalSnapshot.external,
        difference: finalSnapshot.external - initialSnapshot.external
      };
      leaks.recommendations.push('Check for external resources (buffers, C++ objects) not being released');
    }

    if (leaks.detected) {
      logger.warn(`Memory leak detected in ${name}`, leaks);
    } else {
      logger.debug(`No memory leaks detected in ${name}`);
    }

    return leaks;
  }

  /**
   * 创建资源使用监控器
   */
  static createResourceMonitor(name = 'unnamed_monitor', options = {}) {
    const {
      interval = 30000, // 30秒
      thresholds = {},
      onThresholdExceeded = null
    } = options;

    let intervalId = null;
    let lastSnapshot = null;

    return {
      start: () => {
        if (intervalId) return;

        intervalId = setInterval(() => {
          try {
            const currentSnapshot = this.takeResourceSnapshot();

            if (lastSnapshot) {
              // 检查阈值
              const violations = this.checkResourceThresholds(lastSnapshot, currentSnapshot, thresholds);

              if (violations.length > 0 && onThresholdExceeded) {
                onThresholdExceeded(violations, {
                  previous: lastSnapshot,
                  current: currentSnapshot
                });
              }
            }

            lastSnapshot = currentSnapshot;

          } catch (error) {
            logger.error(`Resource monitoring failed for ${name}`, {
              error: error.message,
              stack: error.stack
            });
          }
        }, interval);

        logger.info(`Resource monitor started: ${name}`, { interval });
      },

      stop: () => {
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
          logger.info(`Resource monitor stopped: ${name}`);
        }
      },

      getLastSnapshot: () => lastSnapshot,

      isRunning: () => !!intervalId
    };
  }

  /**
   * 获取资源快照
   */
  static takeResourceSnapshot() {
    const memUsage = process.memoryUsage();

    return {
      timestamp: Date.now(),
      memory: {
        rss: memUsage.rss,
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        arrayBuffers: memUsage.arrayBuffers || 0
      },
      cpu: process.cpuUsage(),
      uptime: process.uptime(),
      pid: process.pid
    };
  }

  /**
   * 检查资源阈值
   */
  static checkResourceThresholds(previous, current, thresholds) {
    const violations = [];

    // 内存使用率检查
    if (thresholds.memoryUsage) {
      const memoryUsagePercent = (current.memory.heapUsed / current.memory.heapTotal) * 100;
      if (memoryUsagePercent > thresholds.memoryUsage) {
        violations.push({
          type: 'memory_usage',
          value: memoryUsagePercent,
          threshold: thresholds.memoryUsage,
          severity: 'high'
        });
      }
    }

    // 内存增长检查
    if (thresholds.memoryGrowth) {
      const growth = current.memory.heapUsed - previous.memory.heapUsed;
      if (growth > thresholds.memoryGrowth) {
        violations.push({
          type: 'memory_growth',
          value: growth,
          threshold: thresholds.memoryGrowth,
          severity: 'medium'
        });
      }
    }

    // CPU使用率检查（简化的）
    if (thresholds.cpuUsage) {
      const cpuUsage = (current.cpu.user + current.cpu.system) / 1000000; // 转换为秒
      if (cpuUsage > thresholds.cpuUsage) {
        violations.push({
          type: 'cpu_usage',
          value: cpuUsage,
          threshold: thresholds.cpuUsage,
          severity: 'high'
        });
      }
    }

    return violations;
  }
}
