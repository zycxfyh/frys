/**
 * 数据库监控器
 * 实时监控数据库性能指标和健康状态
 */

import { logger } from '../../shared/utils/logger.js';

export class DatabaseMonitor {
  constructor(connectionPool, optimizer) {
    this.pool = connectionPool;
    this.optimizer = optimizer;
    this.isMonitoring = false;
    this.monitoringInterval = null;
    this.metrics = {
      performance: [],
      connections: [],
      queries: [],
      tables: [],
      alerts: [],
    };

    // 监控配置
    this.config = {
      interval: 60000, // 1分钟
      retentionPeriod: 24 * 60 * 60 * 1000, // 24小时
      thresholds: {
        connectionPoolUsage: 0.8, // 连接池使用率80%
        slowQueryThreshold: 1000, // 慢查询阈值1秒
        maxConnections: 100, // 最大连接数
        memoryUsage: 0.9, // 内存使用率90%
      },
    };
  }

  /**
   * 启动监控
   */
  async startMonitoring() {
    if (this.isMonitoring) {
      logger.warn('数据库监控已在运行');
      return;
    }

    logger.info('启动数据库监控', {
      interval: this.config.interval,
      retentionPeriod: this.config.retentionPeriod,
    });

    this.isMonitoring = true;

    // 立即执行一次监控
    await this.collectMetrics();

    // 设置定时监控
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.collectMetrics();
        await this.checkAlerts();
        await this.cleanupOldMetrics();
      } catch (error) {
        logger.error('数据库监控执行失败', error);
      }
    }, this.config.interval);
  }

  /**
   * 停止监控
   */
  stopMonitoring() {
    if (!this.isMonitoring) {
      return;
    }

    logger.info('停止数据库监控');

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.isMonitoring = false;
  }

  /**
   * 收集监控指标
   */
  async collectMetrics() {
    const timestamp = new Date().toISOString();

    try {
      // 收集连接池指标
      const poolStats = this.pool.getPoolStats();
      this.metrics.connections.push({
        timestamp,
        ...poolStats,
      });

      // 收集查询性能指标
      const queryMetrics = this.pool.getMetrics();
      this.metrics.queries.push({
        timestamp,
        ...queryMetrics,
      });

      // 收集数据库性能指标
      const dbMetrics = await this.collectDatabaseMetrics();
      this.metrics.performance.push({
        timestamp,
        ...dbMetrics,
      });

      // 收集表统计信息
      const tableStats = await this.optimizer.getTableSizes();
      this.metrics.tables.push({
        timestamp,
        tables: tableStats,
      });

      logger.debug('数据库指标收集完成', { timestamp });
    } catch (error) {
      logger.error('数据库指标收集失败', error);
    }
  }

  /**
   * 收集数据库特定指标
   */
  async collectDatabaseMetrics() {
    try {
      const metrics = {};

      // 活跃连接数
      const activeConnections = await this.pool.query(`
        SELECT count(*) as active_connections
        FROM pg_stat_activity
        WHERE state = 'active'
      `);
      metrics.activeConnections = parseInt(
        activeConnections.rows[0].active_connections,
      );

      // 等待连接数
      const waitingConnections = await this.pool.query(`
        SELECT count(*) as waiting_connections
        FROM pg_stat_activity
        WHERE wait_event_type IS NOT NULL
      `);
      metrics.waitingConnections = parseInt(
        waitingConnections.rows[0].waiting_connections,
      );

      // 数据库大小
      const dbSize = await this.pool.query(`
        SELECT pg_size_pretty(pg_database_size(current_database())) as db_size,
               pg_database_size(current_database()) as db_size_bytes
      `);
      metrics.databaseSize = dbSize.rows[0].db_size;
      metrics.databaseSizeBytes = parseInt(dbSize.rows[0].db_size_bytes);

      // 缓存命中率
      const cacheHit = await this.pool.query(`
        SELECT
          sum(blks_hit) * 100 / (sum(blks_hit) + sum(blks_read)) as cache_hit_ratio
        FROM pg_stat_database
        WHERE datname = current_database()
      `);
      metrics.cacheHitRatio = parseFloat(cacheHit.rows[0].cache_hit_ratio) || 0;

      // 慢查询数量
      const slowQueries = await this.optimizer.analyzeSlowQueries(
        this.config.thresholds.slowQueryThreshold,
      );
      metrics.slowQueriesCount = slowQueries.length;

      // 锁等待情况
      const lockWaits = await this.pool.query(`
        SELECT count(*) as lock_waits
        FROM pg_stat_activity
        WHERE wait_event_type = 'Lock'
      `);
      metrics.lockWaits = parseInt(lockWaits.rows[0].lock_waits);

      return metrics;
    } catch (error) {
      logger.error('收集数据库指标失败', error);
      return {};
    }
  }

  /**
   * 检查告警条件
   */
  async checkAlerts() {
    const alerts = [];

    try {
      const latestMetrics = this.getLatestMetrics();

      // 检查连接池使用率
      const poolUsage =
        latestMetrics.pool?.totalCount / this.config.thresholds.maxConnections;
      if (poolUsage > this.config.thresholds.connectionPoolUsage) {
        alerts.push({
          type: 'connection_pool_high_usage',
          severity: 'warning',
          message: `连接池使用率过高: ${(poolUsage * 100).toFixed(1)}%`,
          value: poolUsage,
          threshold: this.config.thresholds.connectionPoolUsage,
        });
      }

      // 检查慢查询
      if (latestMetrics.performance?.slowQueriesCount > 10) {
        alerts.push({
          type: 'high_slow_queries',
          severity: 'warning',
          message: `慢查询数量过多: ${latestMetrics.performance.slowQueriesCount}`,
          value: latestMetrics.performance.slowQueriesCount,
          threshold: 10,
        });
      }

      // 检查锁等待
      if (latestMetrics.performance?.lockWaits > 5) {
        alerts.push({
          type: 'high_lock_waits',
          severity: 'error',
          message: `锁等待过多: ${latestMetrics.performance.lockWaits}`,
          value: latestMetrics.performance.lockWaits,
          threshold: 5,
        });
      }

      // 检查缓存命中率
      if (latestMetrics.performance?.cacheHitRatio < 0.9) {
        alerts.push({
          type: 'low_cache_hit_ratio',
          severity: 'warning',
          message: `缓存命中率过低: ${(latestMetrics.performance.cacheHitRatio * 100).toFixed(1)}%`,
          value: latestMetrics.performance.cacheHitRatio,
          threshold: 0.9,
        });
      }

      // 记录告警
      if (alerts.length > 0) {
        alerts.forEach((alert) => {
          alert.timestamp = new Date().toISOString();
          logger.warn('数据库告警', alert);
        });

        this.metrics.alerts.push(...alerts);
      }
    } catch (error) {
      logger.error('检查告警失败', error);
    }
  }

  /**
   * 清理过期指标
   */
  cleanupOldMetrics() {
    const cutoffTime = Date.now() - this.config.retentionPeriod;

    Object.keys(this.metrics).forEach((key) => {
      if (Array.isArray(this.metrics[key])) {
        this.metrics[key] = this.metrics[key].filter(
          (metric) => new Date(metric.timestamp).getTime() > cutoffTime,
        );
      }
    });

    logger.debug('过期指标清理完成');
  }

  /**
   * 获取最新指标
   */
  getLatestMetrics() {
    return {
      pool: this.metrics.connections[this.metrics.connections.length - 1],
      queries: this.metrics.queries[this.metrics.queries.length - 1],
      performance:
        this.metrics.performance[this.metrics.performance.length - 1],
      tables: this.metrics.tables[this.metrics.tables.length - 1],
    };
  }

  /**
   * 获取指标历史
   */
  getMetricsHistory(hours = 1) {
    const cutoffTime = Date.now() - hours * 60 * 60 * 1000;

    const filterByTime = (metrics) =>
      metrics.filter(
        (metric) => new Date(metric.timestamp).getTime() > cutoffTime,
      );

    return {
      connections: filterByTime(this.metrics.connections),
      queries: filterByTime(this.metrics.queries),
      performance: filterByTime(this.metrics.performance),
      tables: filterByTime(this.metrics.tables),
      alerts: filterByTime(this.metrics.alerts),
    };
  }

  /**
   * 获取监控状态
   */
  getStatus() {
    const latestMetrics = this.getLatestMetrics();

    return {
      isMonitoring: this.isMonitoring,
      config: this.config,
      latestMetrics,
      alertsCount: this.metrics.alerts.length,
      dataPoints: {
        connections: this.metrics.connections.length,
        queries: this.metrics.queries.length,
        performance: this.metrics.performance.length,
        tables: this.metrics.tables.length,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 生成监控报告
   */
  async generateReport(options = {}) {
    const hours = options.hours || 24;
    const history = this.getMetricsHistory(hours);
    const recommendations =
      await this.optimizer.getOptimizationRecommendations();

    const report = {
      period: `${hours} hours`,
      timestamp: new Date().toISOString(),
      summary: {
        totalConnections: history.connections.length,
        totalQueries: history.queries.reduce(
          (sum, q) => sum + (q.queries?.total || 0),
          0,
        ),
        avgQueryTime:
          history.queries.reduce(
            (sum, q) => sum + (q.performance?.avgQueryTime || 0),
            0,
          ) / history.queries.length,
        alertsTriggered: history.alerts.length,
        slowQueriesDetected: history.performance.reduce(
          (sum, p) => sum + (p.slowQueriesCount || 0),
          0,
        ),
      },
      trends: this.analyzeTrends(history),
      alerts: history.alerts.slice(-20), // 最近20个告警
      recommendations,
      health: await this.assessHealth(),
    };

    return report;
  }

  /**
   * 分析趋势
   */
  analyzeTrends(history) {
    const trends = {};

    // 查询性能趋势
    if (history.queries.length > 1) {
      const recentQueries = history.queries.slice(-10);
      const avgQueryTime =
        recentQueries.reduce(
          (sum, q) => sum + (q.performance?.avgQueryTime || 0),
          0,
        ) / recentQueries.length;

      const earlierQueries = history.queries.slice(-20, -10);
      const earlierAvg =
        earlierQueries.length > 0
          ? earlierQueries.reduce(
              (sum, q) => sum + (q.performance?.avgQueryTime || 0),
              0,
            ) / earlierQueries.length
          : avgQueryTime;

      trends.queryPerformance = {
        current: avgQueryTime,
        change: `${(((avgQueryTime - earlierAvg) / earlierAvg) * 100).toFixed(2)}%`,
        trend: avgQueryTime > earlierAvg ? 'worsening' : 'improving',
      };
    }

    // 连接池使用趋势
    if (history.connections.length > 1) {
      const recentConnections = history.connections.slice(-10);
      const avgUsage =
        recentConnections.reduce((sum, c) => sum + (c.totalCount || 0), 0) /
        recentConnections.length;

      trends.connectionUsage = {
        current: avgUsage,
        peak: Math.max(...recentConnections.map((c) => c.totalCount || 0)),
        trend:
          avgUsage > this.config.thresholds.maxConnections * 0.7
            ? 'high'
            : 'normal',
      };
    }

    return trends;
  }

  /**
   * 评估健康状态
   */
  async assessHealth() {
    try {
      const latestMetrics = this.getLatestMetrics();
      const health = {
        status: 'healthy',
        score: 100,
        issues: [],
        timestamp: new Date().toISOString(),
      };

      // 检查连接池健康
      const poolUsage =
        latestMetrics.pool?.totalCount / this.config.thresholds.maxConnections;
      if (poolUsage > 0.9) {
        health.score -= 30;
        health.issues.push('连接池使用率过高');
      } else if (poolUsage > 0.7) {
        health.score -= 10;
        health.issues.push('连接池使用率较高');
      }

      // 检查查询性能
      if (latestMetrics.performance?.slowQueriesCount > 20) {
        health.score -= 25;
        health.issues.push('慢查询数量过多');
      }

      // 检查锁等待
      if (latestMetrics.performance?.lockWaits > 10) {
        health.score -= 20;
        health.issues.push('锁等待严重');
      }

      // 检查缓存命中率
      if (latestMetrics.performance?.cacheHitRatio < 0.8) {
        health.score -= 15;
        health.issues.push('缓存命中率偏低');
      }

      // 确定整体状态
      if (health.score < 50) {
        health.status = 'critical';
      } else if (health.score < 80) {
        health.status = 'warning';
      }

      return health;
    } catch (error) {
      logger.error('健康评估失败', error);
      return {
        status: 'unknown',
        score: 0,
        issues: ['健康评估失败'],
        error: error.message,
      };
    }
  }

  /**
   * 配置监控参数
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    logger.info('数据库监控配置已更新', this.config);
  }

  /**
   * 重置监控数据
   */
  resetMetrics() {
    Object.keys(this.metrics).forEach((key) => {
      if (Array.isArray(this.metrics[key])) {
        this.metrics[key] = [];
      }
    });

    logger.info('数据库监控数据已重置');
  }
}

export default DatabaseMonitor;
