/**
 * frys - 优雅关闭管理器
 * 协调应用程序的优雅关闭过程，确保资源正确清理
 */

import { logger } from '../../utils/logger.js';
import { EventBus } from '../../shared/kernel/EventBus.js';

export class GracefulShutdownManager {
  constructor(config = {}) {
    this.eventBus = config.eventBus || new EventBus();
    this.shutdownTimeout = config.shutdownTimeout || 30000; // 30秒超时
    this.shutdownPhases = config.shutdownPhases || [
      'http_server',
      'database',
      'cache',
      'message_queue',
      'external_services',
      'file_handles',
      'timers',
    ];

    this.resources = new Map(); // 资源注册表
    this.isShuttingDown = false;
    this.shutdownPromise = null;

    // 绑定事件处理器
    this.handleShutdownSignal = this.handleShutdownSignal.bind(this);
    this.handleEmergencyShutdown = this.handleEmergencyShutdown.bind(this);
  }

  /**
   * 注册资源清理器
   * @param {string} name - 资源名称
   * @param {object} cleaner - 清理器配置
   */
  registerResource(name, cleaner) {
    if (this.resources.has(name)) {
      logger.warn('资源已注册，将被覆盖', { resource: name });
    }

    this.resources.set(name, {
      name,
      cleaner: cleaner.cleaner || cleaner,
      priority: cleaner.priority || 100,
      timeout: cleaner.timeout || 10000,
      required: cleaner.required !== false, // 默认必需
      phase: cleaner.phase || 'default',
    });

    logger.debug('资源清理器已注册', {
      resource: name,
      priority: cleaner.priority,
    });
  }

  /**
   * 注销资源清理器
   * @param {string} name - 资源名称
   */
  unregisterResource(name) {
    if (this.resources.has(name)) {
      this.resources.delete(name);
      logger.debug('资源清理器已注销', { resource: name });
    }
  }

  /**
   * 预定义资源清理器
   */
  registerPresetCleaners() {
    // HTTP服务器清理器
    this.registerResource('http_server', {
      cleaner: async (server) => {
        return new Promise((resolve) => {
          server.close((err) => {
            if (err) {
              logger.error('HTTP服务器关闭失败', err);
              resolve(false);
            } else {
              logger.info('HTTP服务器已关闭');
              resolve(true);
            }
          });
        });
      },
      priority: 10,
      phase: 'http_server',
    });

    // 数据库连接清理器
    this.registerResource('database', {
      cleaner: async (connection) => {
        try {
          if (connection.end) {
            await connection.end();
          } else if (connection.close) {
            await connection.close();
          } else if (connection.destroy) {
            connection.destroy();
          }
          logger.info('数据库连接已关闭');
          return true;
        } catch (error) {
          logger.error('数据库连接关闭失败', error);
          return false;
        }
      },
      priority: 20,
      phase: 'database',
    });

    // 缓存清理器
    this.registerResource('cache', {
      cleaner: async (cacheManager) => {
        try {
          if (cacheManager.close) {
            await cacheManager.close();
          } else if (cacheManager.disconnect) {
            await cacheManager.disconnect();
          }
          logger.info('缓存连接已关闭');
          return true;
        } catch (error) {
          logger.error('缓存连接关闭失败', error);
          return false;
        }
      },
      priority: 30,
      phase: 'cache',
    });

    // 消息队列清理器
    this.registerResource('message_queue', {
      cleaner: async (queueManager) => {
        try {
          if (queueManager.close) {
            await queueManager.close();
          } else if (queueManager.disconnect) {
            await queueManager.disconnect();
          }
          logger.info('消息队列连接已关闭');
          return true;
        } catch (error) {
          logger.error('消息队列连接关闭失败', error);
          return false;
        }
      },
      priority: 40,
      phase: 'message_queue',
    });

    // 定时器清理器
    this.registerResource('timers', {
      cleaner: async (timers) => {
        try {
          let clearedCount = 0;
          for (const timer of timers) {
            if (timer && typeof timer === 'object') {
              if (timer.clearInterval) {
                clearInterval(timer);
                clearedCount++;
              } else if (timer.clearTimeout) {
                clearTimeout(timer);
                clearedCount++;
              } else if (typeof timer === 'number') {
                clearTimeout(timer);
                clearedCount++;
              }
            }
          }
          logger.info('定时器已清理', { count: clearedCount });
          return true;
        } catch (error) {
          logger.error('定时器清理失败', error);
          return false;
        }
      },
      priority: 200,
      phase: 'timers',
    });

    // 文件句柄清理器
    this.registerResource('file_handles', {
      cleaner: async (fileHandles) => {
        try {
          let closedCount = 0;
          for (const handle of fileHandles) {
            if (handle && handle.close) {
              await new Promise((resolve) => {
                handle.close(resolve);
              });
              closedCount++;
            }
          }
          logger.info('文件句柄已关闭', { count: closedCount });
          return true;
        } catch (error) {
          logger.error('文件句柄关闭失败', error);
          return false;
        }
      },
      priority: 150,
      phase: 'file_handles',
    });

    logger.info('预定义资源清理器已注册');
  }

  /**
   * 启动关闭监听器
   */
  startShutdownListeners() {
    // 监听关闭事件
    this.eventBus.subscribe('gracefulShutdown', this.handleShutdownSignal);
    this.eventBus.subscribe('emergencyShutdown', this.handleEmergencyShutdown);

    // 监听进程信号
    process.on('SIGTERM', () =>
      this.eventBus.publish('gracefulShutdown', { signal: 'SIGTERM' }),
    );
    process.on('SIGINT', () =>
      this.eventBus.publish('gracefulShutdown', { signal: 'SIGINT' }),
    );

    logger.info('关闭监听器已启动');
  }

  /**
   * 处理关闭信号
   */
  async handleShutdownSignal(event) {
    if (this.isShuttingDown) {
      logger.warn('关闭已在进行中，忽略重复信号', event);
      return;
    }

    logger.info('开始优雅关闭流程', event);
    await this.performGracefulShutdown(event.signal || 'unknown');
  }

  /**
   * 处理紧急关闭
   */
  handleEmergencyShutdown(event) {
    logger.error('收到紧急关闭信号，立即终止', event);
    process.exit(1);
  }

  /**
   * 执行优雅关闭
   */
  async performGracefulShutdown(signal) {
    if (this.isShuttingDown) {
      return this.shutdownPromise;
    }

    this.isShuttingDown = true;
    const shutdownStartTime = Date.now();

    this.shutdownPromise = this._executeShutdownProcess(signal);
    return this.shutdownPromise;
  }

  /**
   * 执行关闭过程
   */
  async _executeShutdownProcess(signal) {
    logger.info('开始执行关闭过程', {
      signal,
      resourceCount: this.resources.size,
    });

    const results = {
      signal,
      startTime: Date.now(),
      phases: {},
      totalResources: this.resources.size,
      successfulCleanups: 0,
      failedCleanups: 0,
      timedOutCleanups: 0,
    };

    try {
      // 按阶段和优先级排序资源
      const sortedResources = this._sortResourcesByPriority();

      // 分阶段执行清理
      for (const phase of this.shutdownPhases) {
        const phaseResources = sortedResources.filter((r) => r.phase === phase);
        if (phaseResources.length === 0) continue;

        logger.info(`开始清理阶段: ${phase}`, {
          resourceCount: phaseResources.length,
        });

        const phaseResults = await this._cleanupPhase(phaseResources, phase);
        results.phases[phase] = phaseResults;

        results.successfulCleanups += phaseResults.successful;
        results.failedCleanups += phaseResults.failed;
        results.timedOutCleanups += phaseResults.timedOut;

        // 检查是否超时
        if (Date.now() - results.startTime > this.shutdownTimeout) {
          logger.warn('关闭超时，强制退出', {
            elapsed: Date.now() - results.startTime,
          });
          break;
        }
      }

      // 最后的清理阶段（默认阶段）
      const defaultResources = sortedResources.filter(
        (r) => r.phase === 'default',
      );
      if (defaultResources.length > 0) {
        logger.info('开始清理默认阶段', {
          resourceCount: defaultResources.length,
        });
        const defaultResults = await this._cleanupPhase(
          defaultResources,
          'default',
        );
        results.phases.default = defaultResults;

        results.successfulCleanups += defaultResults.successful;
        results.failedCleanups += defaultResults.failed;
        results.timedOutCleanups += defaultResults.timedOut;
      }
    } catch (error) {
      logger.error('关闭过程执行失败', error);
      results.error = error.message;
    }

    results.endTime = Date.now();
    results.duration = results.endTime - results.startTime;

    logger.info('关闭过程完成', {
      signal,
      duration: results.duration,
      successful: results.successfulCleanups,
      failed: results.failedCleanups,
      timedOut: results.timedOutCleanups,
    });

    // 发布关闭完成事件
    this.eventBus.publish('shutdownCompleted', results);

    return results;
  }

  /**
   * 清理单个阶段的资源
   */
  async _cleanupPhase(resources, phase) {
    const results = {
      phase,
      successful: 0,
      failed: 0,
      timedOut: 0,
      details: [],
    };

    // 并行清理同一阶段的资源
    const cleanupPromises = resources.map(async (resource) => {
      const startTime = Date.now();
      let result = { success: false, error: null, timedOut: false };

      try {
        // 创建带超时的清理Promise
        const cleanupPromise = resource.cleaner(resource.instance);
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(
            () => reject(new Error('Cleanup timeout')),
            resource.timeout,
          );
        });

        await Promise.race([cleanupPromise, timeoutPromise]);
        result.success = true;
      } catch (error) {
        result.error = error.message;
        result.success = false;

        if (error.message === 'Cleanup timeout') {
          result.timedOut = true;
          results.timedOut++;
        } else {
          results.failed++;
        }
      }

      const duration = Date.now() - startTime;

      results.details.push({
        resource: resource.name,
        success: result.success,
        error: result.error,
        timedOut: result.timedOut,
        duration,
      });

      if (result.success) {
        results.successful++;
        logger.debug(`资源清理成功: ${resource.name}`, { duration });
      } else {
        logger.error(`资源清理失败: ${resource.name}`, {
          error: result.error,
          timedOut: result.timedOut,
          duration,
        });
      }

      return result;
    });

    await Promise.allSettled(cleanupPromises);

    return results;
  }

  /**
   * 按优先级排序资源
   */
  _sortResourcesByPriority() {
    return Array.from(this.resources.values()).sort(
      (a, b) => a.priority - b.priority,
    );
  }

  /**
   * 获取关闭状态
   */
  getStatus() {
    return {
      isShuttingDown: this.isShuttingDown,
      resourceCount: this.resources.size,
      shutdownTimeout: this.shutdownTimeout,
      shutdownPhases: this.shutdownPhases,
      resources: Array.from(this.resources.keys()),
    };
  }

  /**
   * 强制重置状态（用于测试）
   */
  reset() {
    this.isShuttingDown = false;
    this.shutdownPromise = null;
    logger.info('优雅关闭管理器状态已重置');
  }
}
