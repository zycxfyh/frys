/**
 * frys - 健康检查器接口
 * 定义容器化应用健康检查的标准接口
 */

import { logger } from '../../shared/utils/logger.js';
import { EventBus } from '../../shared/kernel/EventBus.js';

export class HealthChecker {
  constructor(config = {}) {
    this.eventBus = config.eventBus || new EventBus();
    this.checkInterval = config.checkInterval || 30000; // 30秒
    this.timeout = config.timeout || 5000; // 5秒超时
    this.failureThreshold = config.failureThreshold || 3;
    this.successThreshold = config.successThreshold || 1;
    this.isRunning = false;
    this.checks = new Map();
    this.results = new Map();
    this.checkTimer = null;

    // 绑定方法
    this._performHealthChecks = this._performHealthChecks.bind(this);
  }

  /**
   * 注册健康检查
   * @param {string} name - 检查名称
   * @param {object} check - 检查配置
   */
  registerCheck(name, check) {
    this.checks.set(name, {
      name,
      checkFunction: check.check,
      interval: check.interval || this.checkInterval,
      timeout: check.timeout || this.timeout,
      critical: check.critical !== false, // 默认关键检查
      dependencies: check.dependencies || [],
      lastCheck: 0,
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
      status: 'unknown',
      enabled: check.enabled !== false,
    });

    logger.debug('健康检查已注册', { name, critical: check.critical });
  }

  /**
   * 注销健康检查
   * @param {string} name - 检查名称
   */
  unregisterCheck(name) {
    if (this.checks.has(name)) {
      this.checks.delete(name);
      this.results.delete(name);
      logger.debug('健康检查已注销', { name });
    }
  }

  /**
   * 启动健康检查
   */
  async start() {
    if (this.isRunning) {
      logger.warn('健康检查器已在运行中');
      return;
    }

    this.isRunning = true;
    logger.info('启动健康检查器');

    // 执行初始检查
    await this._performHealthChecks();

    // 启动定期检查
    this.checkTimer = setInterval(
      this._performHealthChecks,
      this.checkInterval,
    );
  }

  /**
   * 停止健康检查
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }

    logger.info('停止健康检查器');
  }

  /**
   * 执行单个健康检查
   * @param {object} checkConfig - 检查配置
   */
  async _executeCheck(checkConfig) {
    const startTime = Date.now();
    const result = {
      name: checkConfig.name,
      status: 'unknown',
      duration: 0,
      error: null,
      timestamp: startTime,
      details: {},
    };

    try {
      // 创建带超时的检查Promise
      const checkPromise = checkConfig.checkFunction();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(
          () => reject(new Error('Health check timeout')),
          checkConfig.timeout,
        );
      });

      const checkResult = await Promise.race([checkPromise, timeoutPromise]);

      result.duration = Date.now() - startTime;
      result.status = 'healthy';
      result.details = checkResult || {};

      // 更新连续计数
      checkConfig.consecutiveFailures = 0;
      checkConfig.consecutiveSuccesses++;
    } catch (error) {
      result.duration = Date.now() - startTime;
      result.status = 'unhealthy';
      result.error = {
        message: error.message,
        code: error.code,
        details: error.details,
      };

      // 更新连续计数
      checkConfig.consecutiveFailures++;
      checkConfig.consecutiveSuccesses = 0;

      logger.warn('健康检查失败', {
        name: checkConfig.name,
        error: error.message,
        duration: result.duration,
        consecutiveFailures: checkConfig.consecutiveFailures,
      });
    }

    // 更新检查配置
    checkConfig.lastCheck = Date.now();
    checkConfig.status = result.status;

    return result;
  }

  /**
   * 执行所有健康检查
   */
  async _performHealthChecks() {
    if (!this.isRunning) return;

    const checkPromises = Array.from(this.checks.values())
      .filter((check) => check.enabled)
      .map((check) => this._executeCheck(check));

    const results = await Promise.allSettled(checkPromises);

    // 处理结果
    const checkResults = results
      .filter((result) => result.status === 'fulfilled')
      .map((result) => result.value);

    // 更新结果缓存
    checkResults.forEach((result) => {
      this.results.set(result.name, result);
    });

    // 计算整体健康状态
    const overallHealth = this._calculateOverallHealth(checkResults);

    // 发布健康状态事件
    this.eventBus.publish('healthCheckCompleted', {
      timestamp: Date.now(),
      overallHealth,
      checks: checkResults,
      summary: this._createHealthSummary(checkResults),
    });

    logger.debug('健康检查完成', {
      totalChecks: checkResults.length,
      overallHealth: overallHealth.status,
      duration: Date.now() - (checkResults[0]?.timestamp || Date.now()),
    });
  }

  /**
   * 计算整体健康状态
   * @param {Array} results - 检查结果数组
   */
  _calculateOverallHealth(results) {
    const criticalChecks = results.filter((r) => {
      const check = this.checks.get(r.name);
      return check && check.critical;
    });

    const unhealthyCritical = criticalChecks.filter(
      (r) => r.status === 'unhealthy',
    );
    const unhealthyTotal = results.filter(
      (r) => r.status === 'unhealthy',
    ).length;

    let status = 'healthy';
    let severity = 'info';

    if (unhealthyCritical.length > 0) {
      status = 'unhealthy';
      severity = 'critical';
    } else if (unhealthyTotal > 0) {
      status = 'degraded';
      severity = 'warning';
    }

    return {
      status,
      severity,
      totalChecks: results.length,
      healthyChecks: results.filter((r) => r.status === 'healthy').length,
      unhealthyChecks: unhealthyTotal,
      criticalChecks: criticalChecks.length,
      unhealthyCriticalChecks: unhealthyCritical.length,
      timestamp: Date.now(),
    };
  }

  /**
   * 创建健康摘要
   * @param {Array} results - 检查结果数组
   */
  _createHealthSummary(results) {
    const summary = {
      total: results.length,
      healthy: 0,
      unhealthy: 0,
      degraded: 0,
      critical: [],
      warnings: [],
    };

    results.forEach((result) => {
      const check = this.checks.get(result.name);

      if (result.status === 'healthy') {
        summary.healthy++;
      } else if (result.status === 'unhealthy') {
        summary.unhealthy++;

        if (check && check.critical) {
          summary.critical.push({
            name: result.name,
            error: result.error?.message,
            duration: result.duration,
          });
        } else {
          summary.warnings.push({
            name: result.name,
            error: result.error?.message,
            duration: result.duration,
          });
        }
      }
    });

    return summary;
  }

  /**
   * 获取健康状态
   * @param {string} checkName - 可选的检查名称
   */
  getHealth(checkName = null) {
    if (checkName) {
      return this.results.get(checkName) || null;
    }

    const allResults = Array.from(this.results.values());
    return {
      overall: this._calculateOverallHealth(allResults),
      checks: allResults,
      timestamp: Date.now(),
    };
  }

  /**
   * 获取健康摘要
   */
  getHealthSummary() {
    const allResults = Array.from(this.results.values());
    return {
      overall: this._calculateOverallHealth(allResults),
      summary: this._createHealthSummary(allResults),
      lastUpdate: Math.max(...allResults.map((r) => r.timestamp), 0),
    };
  }

  /**
   * 手动执行健康检查
   * @param {string} checkName - 可选的检查名称
   */
  async checkNow(checkName = null) {
    if (checkName) {
      const check = this.checks.get(checkName);
      if (!check) {
        throw new Error(`检查不存在: ${checkName}`);
      }
      const result = await this._executeCheck(check);
      this.results.set(checkName, result);
      return result;
    } else {
      await this._performHealthChecks();
      return this.getHealthSummary();
    }
  }

  /**
   * 启用/禁用检查
   * @param {string} checkName - 检查名称
   * @param {boolean} enabled - 是否启用
   */
  setCheckEnabled(checkName, enabled) {
    const check = this.checks.get(checkName);
    if (check) {
      check.enabled = enabled;
      logger.info('检查状态已更新', { checkName, enabled });
    }
  }

  /**
   * 获取检查配置
   */
  getChecksConfig() {
    return Array.from(this.checks.values()).map((check) => ({
      name: check.name,
      enabled: check.enabled,
      critical: check.critical,
      interval: check.interval,
      timeout: check.timeout,
      dependencies: check.dependencies,
      status: check.status,
      consecutiveFailures: check.consecutiveFailures,
      lastCheck: check.lastCheck,
    }));
  }

  /**
   * 重置检查状态
   * @param {string} checkName - 可选的检查名称
   */
  resetCheck(checkName = null) {
    if (checkName) {
      const check = this.checks.get(checkName);
      if (check) {
        check.consecutiveFailures = 0;
        check.consecutiveSuccesses = 0;
        check.status = 'unknown';
        logger.info('检查状态已重置', { checkName });
      }
    } else {
      this.checks.forEach((check) => {
        check.consecutiveFailures = 0;
        check.consecutiveSuccesses = 0;
        check.status = 'unknown';
      });
      logger.info('所有检查状态已重置');
    }
  }

  /**
   * 清理过期结果
   * @param {number} maxAge - 最大年龄（毫秒）
   */
  cleanup(maxAge = 3600000) {
    // 默认1小时
    const cutoffTime = Date.now() - maxAge;

    for (const [name, result] of this.results) {
      if (result.timestamp < cutoffTime) {
        this.results.delete(name);
      }
    }

    logger.debug('过期健康检查结果已清理', { maxAge });
  }
}

/**
 * 预定义健康检查函数
 */

// 数据库连接检查
export const databaseHealthCheck = (connection) => async () => {
  try {
    // 执行简单查询
    if (connection.query) {
      await connection.query('SELECT 1');
    } else if (connection.ping) {
      await connection.ping();
    } else {
      throw new Error('Unsupported database connection type');
    }

    return { status: 'connected', type: connection.constructor.name };
  } catch (error) {
    throw new Error(`Database connection failed: ${error.message}`);
  }
};

// Redis连接检查
export const redisHealthCheck = (client) => async () => {
  try {
    await client.ping();
    return { status: 'connected', type: 'Redis' };
  } catch (error) {
    throw new Error(`Redis connection failed: ${error.message}`);
  }
};

// HTTP服务检查
export const httpServiceHealthCheck =
  (url, options = {}) =>
  async () => {
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        options.timeout || 5000,
      );

      const response = await fetch(url, {
        method: 'GET',
        headers: options.headers || {},
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok && !options.allowNon200) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const responseTime = Date.now() - startTime;

      return {
        status: response.status,
        statusText: response.statusText,
        responseTime,
        healthy: response.ok || options.allowNon200,
      };
    } catch (error) {
      throw new Error(`HTTP service check failed: ${error.message}`);
    }
  };

// 文件系统检查
export const filesystemHealthCheck =
  (paths = ['.']) =>
  async () => {
    const results = {};

    for (const path of paths) {
      try {
        const fs = await import('fs/promises');
        const stats = await fs.stat(path);
        results[path] = {
          exists: true,
          isDirectory: stats.isDirectory(),
          size: stats.size,
          modified: stats.mtime,
        };
      } catch (error) {
        results[path] = {
          exists: false,
          error: error.message,
        };

        if (error.code !== 'ENOENT') {
          throw new Error(
            `Filesystem check failed for ${path}: ${error.message}`,
          );
        }
      }
    }

    return results;
  };

// 内存使用检查
export const memoryHealthCheck =
  (thresholds = {}) =>
  async () => {
    const memUsage = process.memoryUsage();
    const totalMemory = memUsage.heapTotal + memUsage.external;
    const usedMemory = memUsage.heapUsed + memUsage.external;
    const usagePercent = (usedMemory / totalMemory) * 100;

    const thresholdsToCheck = {
      heapUsed: thresholds.heapUsed || 0.9, // 90%
      heapTotal: thresholds.heapTotal || 0.95, // 95%
      external: thresholds.external || 0.8, // 80%
      ...thresholds,
    };

    const issues = [];

    Object.entries(thresholdsToCheck).forEach(([key, threshold]) => {
      const value = memUsage[key];
      const maxValue = key === 'heapUsed' ? memUsage.heapTotal : Infinity;
      const percent = maxValue > 0 ? value / maxValue : 0;

      if (percent > threshold) {
        issues.push({
          type: key,
          value,
          percent,
          threshold,
        });
      }
    });

    if (issues.length > 0) {
      throw new Error(
        `Memory usage too high: ${issues.map((i) => `${i.type}: ${(i.percent * 100).toFixed(1)}%`).join(', ')}`,
      );
    }

    return {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      usagePercent,
      rss: memUsage.rss,
    };
  };

// CPU使用检查
export const cpuHealthCheck =
  (threshold = 0.8) =>
  async () => {
    const startUsage = process.cpuUsage();

    // 等待100ms采样
    await new Promise((resolve) => setTimeout(resolve, 100));

    const endUsage = process.cpuUsage(startUsage);
    const totalUsage = (endUsage.user + endUsage.system) / 1000; // 转换为毫秒
    const usagePercent = totalUsage / 100; // 相对于100ms采样期的百分比

    if (usagePercent > threshold) {
      throw new Error(
        `CPU usage too high: ${(usagePercent * 100).toFixed(1)}%`,
      );
    }

    return {
      user: endUsage.user,
      system: endUsage.system,
      total: totalUsage,
      usagePercent,
    };
  };

// 磁盘空间检查
export const diskSpaceHealthCheck =
  (path = '.', threshold = 0.9) =>
  async () => {
    try {
      const fs = await import('fs/promises');
      const stats = await fs.statvfs(path);

      const totalSpace = stats.f_blocks * stats.f_frsize;
      const freeSpace = stats.f_bavail * stats.f_frsize;
      const usedSpace = totalSpace - freeSpace;
      const usagePercent = usedSpace / totalSpace;

      if (usagePercent > threshold) {
        throw new Error(
          `Disk usage too high: ${(usagePercent * 100).toFixed(1)}% used`,
        );
      }

      return {
        total: totalSpace,
        used: usedSpace,
        free: freeSpace,
        usagePercent,
      };
    } catch (error) {
      // 如果statvfs不可用，使用简化的检查
      try {
        const fs = await import('fs/promises');
        const stats = await fs.stat(path);
        return {
          path,
          exists: true,
          modified: stats.mtime,
          note: 'Detailed disk stats not available',
        };
      } catch (fallbackError) {
        throw new Error(`Disk space check failed: ${error.message}`);
      }
    }
  };
