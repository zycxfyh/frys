/**
 * 资源池管理器
 * 统一管理所有类型的资源池
 */

import { DatabaseConnectionPool } from '../database/DatabaseConnectionPool.js';
import { HttpClientPool } from './HttpClientPool.js';
import { GenericObjectPool, ObjectPoolFactories } from './GenericObjectPool.js';
import { WorkerPool } from './WorkerPool.js';
import { logger } from '../../utils/logger.js';

export class ResourcePoolManager {
  constructor(options = {}) {
    this.options = {
      enableMetrics: options.enableMetrics !== false,
      metricsInterval: options.metricsInterval || 60000, // 1分钟
      autoCleanup: options.autoCleanup !== false,
      cleanupInterval: options.cleanupInterval || 300000, // 5分钟
      ...options,
    };

    this.pools = new Map();
    this.metrics = {
      pools: new Map(),
      system: {},
      timestamp: null,
    };

    this.metricsTimer = null;
    this.cleanupTimer = null;
    this.isInitialized = false;
  }

  /**
   * 初始化资源池管理器
   */
  async initialize() {
    if (this.isInitialized) {
      return this;
    }

    logger.info('初始化资源池管理器');

    // 启动指标收集
    if (this.options.enableMetrics) {
      this._startMetricsCollection();
    }

    // 启动自动清理
    if (this.options.autoCleanup) {
      this._startAutoCleanup();
    }

    this.isInitialized = true;
    logger.info('资源池管理器初始化完成');

    return this;
  }

  /**
   * 销毁资源池管理器
   */
  async destroy() {
    if (!this.isInitialized) {
      return;
    }

    logger.info('销毁资源池管理器');

    // 停止定时器
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
      this.metricsTimer = null;
    }

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    // 销毁所有池
    const destroyPromises = Array.from(this.pools.values()).map((pool) =>
      pool.destroy ? pool.destroy() : Promise.resolve(),
    );

    await Promise.allSettled(destroyPromises);
    this.pools.clear();

    this.isInitialized = false;
    logger.info('资源池管理器销毁完成');
  }

  /**
   * 创建数据库连接池
   */
  createDatabasePool(name, options = {}) {
    const pool = new DatabaseConnectionPool(options);
    this.pools.set(name, pool);

    logger.info('创建数据库连接池', { name, config: options });
    return pool;
  }

  /**
   * 创建HTTP客户端池
   */
  createHttpClientPool(name, options = {}) {
    const pool = new HttpClientPool(options);
    this.pools.set(name, pool);

    logger.info('创建HTTP客户端池', { name, config: options });
    return pool;
  }

  /**
   * 创建通用对象池
   */
  createObjectPool(name, factory, options = {}) {
    const pool = new GenericObjectPool(factory, options);
    this.pools.set(name, pool);

    logger.info('创建通用对象池', {
      name,
      type: factory.objectType || 'unknown',
    });
    return pool;
  }

  /**
   * 创建工作线程池
   */
  createWorkerPool(name, workerScript, options = {}) {
    const pool = new WorkerPool(workerScript, options);
    this.pools.set(name, pool);

    logger.info('创建工作线程池', { name, script: workerScript });
    return pool;
  }

  /**
   * 创建预定义对象池
   */
  createBufferPool(name, size = 1024, options = {}) {
    return this.createObjectPool(name, ObjectPoolFactories.buffer(size), {
      objectType: 'buffer',
      ...options,
    });
  }

  createArrayPool(name, initialSize = 10, options = {}) {
    return this.createObjectPool(name, ObjectPoolFactories.array(initialSize), {
      objectType: 'array',
      ...options,
    });
  }

  createMapPool(name, options = {}) {
    return this.createObjectPool(name, ObjectPoolFactories.map(), {
      objectType: 'map',
      ...options,
    });
  }

  createSetPool(name, options = {}) {
    return this.createObjectPool(name, ObjectPoolFactories.set(), {
      objectType: 'set',
      ...options,
    });
  }

  /**
   * 获取池
   */
  getPool(name) {
    return this.pools.get(name);
  }

  /**
   * 删除池
   */
  async removePool(name) {
    const pool = this.pools.get(name);
    if (pool) {
      await pool.destroy();
      this.pools.delete(name);
      this.metrics.pools.delete(name);

      logger.info('删除资源池', { name });
    }
  }

  /**
   * 获取所有池的状态
   */
  getAllPoolStats() {
    const stats = {};

    for (const [name, pool] of this.pools) {
      try {
        stats[name] = pool.getStats ? pool.getStats() : { status: 'unknown' };
      } catch (error) {
        stats[name] = { status: 'error', error: error.message };
      }
    }

    return stats;
  }

  /**
   * 获取综合统计信息
   */
  getComprehensiveStats() {
    const poolStats = this.getAllPoolStats();

    // 计算总体统计
    const summary = {
      totalPools: this.pools.size,
      healthyPools: 0,
      unhealthyPools: 0,
      totalResources: 0,
      activeResources: 0,
      idleResources: 0,
    };

    for (const stats of Object.values(poolStats)) {
      if (stats.health?.status === 'healthy') {
        summary.healthyPools++;
      } else {
        summary.unhealthyPools++;
      }

      summary.totalResources += stats.runtime?.total || 0;
      summary.activeResources += stats.runtime?.active || 0;
      summary.idleResources += stats.runtime?.idle || 0;
    }

    return {
      summary,
      pools: poolStats,
      system: this._getSystemStats(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 获取系统统计信息
   */
  _getSystemStats() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    return {
      memory: {
        rss: `${Math.round(memUsage.rss / 1024 / 1024)  }MB`,
        heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)  }MB`,
        heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)  }MB`,
        external: `${Math.round(memUsage.external / 1024 / 1024)  }MB`,
      },
      cpu: {
        user: `${Math.round(cpuUsage.user / 1000)  }ms`,
        system: `${Math.round(cpuUsage.system / 1000)  }ms`,
      },
      uptime: `${Math.round(process.uptime())  }s`,
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
    };
  }

  /**
   * 启动指标收集
   */
  _startMetricsCollection() {
    this.metricsTimer = setInterval(() => {
      try {
        this._collectMetrics();
      } catch (error) {
        logger.error('指标收集失败', error);
      }
    }, this.options.metricsInterval);

    // 立即收集一次
    this._collectMetrics();
  }

  /**
   * 收集指标
   */
  _collectMetrics() {
    const timestamp = new Date().toISOString();

    // 收集每个池的指标
    for (const [name, pool] of this.pools) {
      try {
        const stats = pool.getStats ? pool.getStats() : null;
        if (stats) {
          this.metrics.pools.set(name, {
            ...stats,
            collectedAt: timestamp,
          });
        }
      } catch (error) {
        logger.error('收集池指标失败', { pool: name, error: error.message });
      }
    }

    // 收集系统指标
    this.metrics.system = this._getSystemStats();
    this.metrics.timestamp = timestamp;

    logger.debug('指标收集完成', {
      poolsCollected: this.metrics.pools.size,
      timestamp,
    });
  }

  /**
   * 启动自动清理
   */
  _startAutoCleanup() {
    this.cleanupTimer = setInterval(async () => {
      try {
        await this._performCleanup();
      } catch (error) {
        logger.error('自动清理失败', error);
      }
    }, this.options.cleanupInterval);
  }

  /**
   * 执行清理
   */
  async _performCleanup() {
    let cleanedPools = 0;

    for (const [name, pool] of this.pools) {
      try {
        if (pool.clear && typeof pool.clear === 'function') {
          await pool.clear();
          cleanedPools++;
        }
      } catch (error) {
        logger.error('清理池失败', { pool: name, error: error.message });
      }
    }

    if (cleanedPools > 0) {
      logger.info('自动清理完成', { cleanedPools });
    }
  }

  /**
   * 健康检查
   */
  async healthCheck() {
    const results = {
      status: 'healthy',
      pools: {},
      issues: [],
      timestamp: new Date().toISOString(),
    };

    for (const [name, pool] of this.pools) {
      try {
        let health = { status: 'unknown' };

        if (pool.healthCheck) {
          health = await pool.healthCheck();
        } else if (pool.getStats) {
          const stats = pool.getStats();
          health = stats.health || { status: 'unknown' };
        }

        results.pools[name] = health;

        if (health.status !== 'healthy') {
          results.status = 'degraded';
          results.issues.push(`${name}: ${health.status}`);
        }
      } catch (error) {
        results.pools[name] = { status: 'error', error: error.message };
        results.status = 'unhealthy';
        results.issues.push(`${name}: ${error.message}`);
      }
    }

    return results;
  }

  /**
   * 获取池性能报告
   */
  generatePerformanceReport() {
    const report = {
      timestamp: new Date().toISOString(),
      period: 'current',
      summary: this.getComprehensiveStats(),
      recommendations: this._generateRecommendations(),
      alerts: this._checkAlerts(),
    };

    return report;
  }

  /**
   * 生成优化建议
   */
  _generateRecommendations() {
    const recommendations = [];
    const stats = this.getComprehensiveStats();

    // 检查池大小
    for (const [name, poolStats] of Object.entries(stats.pools)) {
      if (poolStats.health?.status !== 'healthy') {
        recommendations.push({
          type: 'pool_health',
          priority: 'high',
          pool: name,
          message: `池 ${name} 健康状态异常: ${poolStats.health?.status}`,
          action: 'investigate_pool_health',
        });
      }

      // 检查利用率
      const utilization =
        poolStats.runtime?.total > 0
          ? (poolStats.runtime.active / poolStats.runtime.total) * 100
          : 0;

      if (utilization > 90) {
        recommendations.push({
          type: 'high_utilization',
          priority: 'medium',
          pool: name,
          message: `池 ${name} 利用率过高: ${utilization.toFixed(1)}%`,
          action: 'increase_pool_size',
        });
      } else if (utilization < 30 && poolStats.runtime.total > 5) {
        recommendations.push({
          type: 'low_utilization',
          priority: 'low',
          pool: name,
          message: `池 ${name} 利用率偏低: ${utilization.toFixed(1)}%`,
          action: 'decrease_pool_size',
        });
      }
    }

    // 检查系统资源
    const memUsage = stats.system.memory;
    const heapUsagePercent =
      (parseInt(memUsage.heapUsed) / parseInt(memUsage.heapTotal)) * 100;

    if (heapUsagePercent > 80) {
      recommendations.push({
        type: 'high_memory_usage',
        priority: 'high',
        message: `内存使用率过高: ${heapUsagePercent.toFixed(1)}%`,
        action: 'optimize_memory_usage',
      });
    }

    return recommendations;
  }

  /**
   * 检查告警
   */
  _checkAlerts() {
    const alerts = [];
    const stats = this.getComprehensiveStats();

    // 严重的健康问题
    if (stats.summary.unhealthyPools > 0) {
      alerts.push({
        level: 'critical',
        message: `${stats.summary.unhealthyPools} 个资源池健康状态异常`,
        timestamp: new Date().toISOString(),
      });
    }

    // 高利用率告警
    for (const [name, poolStats] of Object.entries(stats.pools)) {
      const utilization =
        poolStats.runtime?.total > 0
          ? (poolStats.runtime.active / poolStats.runtime.total) * 100
          : 0;

      if (utilization > 95) {
        alerts.push({
          level: 'warning',
          message: `资源池 ${name} 利用率极高: ${utilization.toFixed(1)}%`,
          timestamp: new Date().toISOString(),
        });
      }
    }

    return alerts;
  }

  /**
   * 导出配置
   */
  exportConfiguration() {
    const config = {
      pools: {},
      options: this.options,
      timestamp: new Date().toISOString(),
    };

    for (const [name, pool] of this.pools) {
      if (pool.options) {
        config.pools[name] = {
          type: pool.constructor.name,
          options: pool.options,
        };
      }
    }

    return config;
  }

  /**
   * 导入配置
   */
  async importConfiguration(config) {
    if (config.options) {
      this.options = { ...this.options, ...config.options };
    }

    if (config.pools) {
      for (const [name, poolConfig] of Object.entries(config.pools)) {
        // 这里可以根据配置重新创建池
        logger.info('导入池配置', { name, type: poolConfig.type });
      }
    }
  }
}

export default ResourcePoolManager;
