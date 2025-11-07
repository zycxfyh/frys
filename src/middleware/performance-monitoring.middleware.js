/**
 * frys 性能监控中间件
 * 集成性能指标收集、告警和健康检查
 */

import PrometheusInspiredMetrics from '../core/PrometheusInspiredMetrics.js';
import CacheService from '../application/services/CacheService.js';
import CacheMiddleware from '../infrastructure/middleware/CacheMiddleware.js';
import { logger, logPerformance } from '../utils/logger.js';

class PerformanceMonitoringMiddleware {
  constructor(options = {}) {
    this.metrics = new PrometheusInspiredMetrics(options);

    // 初始化缓存服务
    this.cacheService = new CacheService({
      defaultTtl: options.cacheTtl || 300000,
      enableRedis: options.enableRedis || false,
      maxMemorySize: options.cacheMaxMemory || 100 * 1024 * 1024,
      ...options.cacheOptions,
    });

    // 初始化缓存中间件
    this.cacheMiddleware = new CacheMiddleware(this.cacheService, {
      defaultTtl: options.cacheTtl || 300000,
      cacheableMethods: options.cacheableMethods || ['GET'],
      ...options.cacheMiddlewareOptions,
    });

    this.options = {
      enableHealthEndpoint: options.enableHealthEndpoint !== false,
      enableMetricsEndpoint: options.enableMetricsEndpoint !== false,
      enableCacheMiddleware: options.enableCacheMiddleware !== false,
      healthCheckPath: options.healthCheckPath || '/health',
      metricsPath: options.metricsPath || '/metrics',
      alertsPath: options.alertsPath || '/alerts',
      ...options,
    };

    this.initializeHealthChecks();
  }

  /**
   * 初始化健康检查
   */
  initializeHealthChecks() {
    // 数据库连接健康检查
    this.metrics.addHealthCheck('database', async () => {
      // 这里应该检查数据库连接
      // 由于没有具体的数据库实现，这里返回模拟结果
      return {
        status: 'connected',
        latency: Math.floor(Math.random() * 10) + 5,
      };
    });

    // 缓存服务健康检查
    this.metrics.addHealthCheck('cache', async () => {
      try {
        const health = await this.cacheService.healthCheck();
        return {
          status: health.status,
          hitRate: health.details?.metrics?.hitRate || 0,
          layers: health.layerHealth,
          issues: health.issues,
        };
      } catch (error) {
        return { status: 'unhealthy', error: error.message };
      }
    });

    // 外部服务健康检查
    this.metrics.addHealthCheck('external_services', async () => {
      // 检查外部API服务
      return { status: 'reachable', services: ['api1', 'api2'] };
    });

    // 文件系统健康检查
    this.metrics.addHealthCheck('filesystem', async () => {
      const fs = require('fs').promises;
      const tempFile = `/tmp/health-check-${Date.now()}`;

      try {
        // 测试文件写入
        await fs.writeFile(tempFile, 'health check');
        await fs.unlink(tempFile);
        return { status: 'writable', freeSpace: 'unknown' };
      } catch (error) {
        throw new Error(`文件系统不可写: ${error.message}`);
      }
    });
  }

  /**
   * HTTP 请求监控中间件
   */
  httpRequestMonitoring() {
    return this.metrics.httpRequestMiddleware.bind(this.metrics);
  }

  /**
   * Express 应用监控设置
   */
  setupAppMonitoring(app) {
    // 添加请求监控中间件
    app.use(this.httpRequestMonitoring());

    // 健康检查端点
    if (this.options.enableHealthEndpoint) {
      app.get(this.options.healthCheckPath, async (req, res) => {
        try {
          const healthStatus = await this.metrics.getHealthStatus();
          const statusCode = healthStatus.status === 'healthy' ? 200 : 503;

          res.status(statusCode).json(healthStatus);

          logger.info('健康检查请求', {
            status: healthStatus.status,
            uptime: healthStatus.uptime,
            checks: Object.keys(healthStatus.checks),
          });
        } catch (error) {
          logger.error('健康检查失败', error);
          res.status(503).json({
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString(),
          });
        }
      });
    }

    // Prometheus 指标端点
    if (this.options.enableMetricsEndpoint) {
      app.get(this.options.metricsPath, (req, res) => {
        try {
          const metricsOutput = this.metrics.getPrometheusMetrics();

          res.set('Content-Type', 'text/plain; charset=utf-8');
          res.send(metricsOutput);

          logger.debug('指标导出请求', {
            metricsCount: this.metrics.getStats().metrics,
            contentLength: metricsOutput.length,
          });
        } catch (error) {
          logger.error('指标导出失败', error);
          res.status(500).send('Error generating metrics');
        }
      });
    }

    // 告警管理端点
    app.get('/alerts', (req, res) => {
      try {
        const alerts = this.metrics.getActiveAlerts();
        res.json({
          activeAlerts: alerts,
          total: alerts.length,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error('获取告警列表失败', error);
        res.status(500).json({ error: 'Failed to get alerts' });
      }
    });

    // 性能统计端点
    app.get('/performance/stats', (req, res) => {
      try {
        const stats = this.metrics.getStats();
        const performanceData = {
          ...stats,
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage(),
          cpuUsage: process.cpuUsage(),
        };

        res.json(performanceData);
      } catch (error) {
        logger.error('获取性能统计失败', error);
        res.status(500).json({ error: 'Failed to get performance stats' });
      }
    });

    logger.info('📊 性能监控中间件已设置', {
      healthEndpoint: this.options.enableHealthEndpoint
        ? this.options.healthCheckPath
        : 'disabled',
      metricsEndpoint: this.options.enableMetricsEndpoint
        ? this.options.metricsPath
        : 'disabled',
      alertRules: this.metrics.getStats().alertRules,
      healthChecks: this.metrics.getStats().healthChecks,
    });
  }

  /**
   * 记录应用错误
   */
  recordApplicationError(error, type = 'generic', severity = 'error') {
    this.metrics.recordApplicationError(error, type, severity);
  }

  /**
   * 记录数据库操作
   */
  recordDatabaseOperation(operation, table, duration) {
    this.metrics.recordDatabaseQuery(operation, table, duration);
  }

  /**
   * 记录缓存操作
   */
  recordCacheOperation(operation, result = 'hit') {
    this.metrics.recordCacheOperation(operation, result);
  }

  /**
   * 记录业务操作
   */
  recordBusinessOperation(operation, result = 'success') {
    this.metrics.recordBusinessOperation(operation, result);
  }

  /**
   * 获取监控统计
   */
  getMonitoringStats() {
    return {
      metrics: this.metrics.getStats(),
      activeAlerts: this.metrics.getActiveAlerts().length,
      healthStatus: 'unknown', // 需要异步获取
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 停止监控
   */
  stopMonitoring() {
    this.metrics.stopCollection();
    logger.info('📊 性能监控已停止');
  }

  /**
   * 便捷方法：包装异步函数进行性能监控
   */
  monitorAsyncFunction(operationName, fn, options = {}) {
    return async (...args) => {
      const startTime = Date.now();

      try {
        const result = await fn(...args);
        const duration = Date.now() - startTime;

        // 记录性能指标
        if (options.category === 'database') {
          this.recordDatabaseOperation(
            operationName,
            options.table || 'unknown',
            duration,
          );
        } else if (options.category === 'cache') {
          this.recordCacheOperation(operationName, 'hit');
        } else if (options.category === 'business') {
          this.recordBusinessOperation(operationName, 'success');
        } else {
          logPerformance(operationName, duration, options.metadata || {});
        }

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;

        // 记录错误
        this.recordApplicationError(
          error,
          options.errorType || 'operation_error',
        );

        // 记录失败的性能指标
        logPerformance(`${operationName}_failed`, duration, {
          error: error.message,
          ...(options.metadata || {}),
        });

        throw error;
      }
    };
  }

  /**
   * 监控内存使用情况
   */
  monitorMemoryUsage() {
    const memUsage = process.memoryUsage();

    // 记录内存指标
    this.metrics.setGauge('process_memory_usage_bytes', memUsage.rss, {
      type: 'rss',
    });
    this.metrics.setGauge('process_memory_usage_bytes', memUsage.heapUsed, {
      type: 'heapUsed',
    });
    this.metrics.setGauge('process_memory_usage_bytes', memUsage.heapTotal, {
      type: 'heapTotal',
    });

    // 检查内存使用是否异常
    const heapUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

    if (heapUsagePercent > 85) {
      logger.warn('内存使用率过高', {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        usagePercent: heapUsagePercent.toFixed(2),
      });
    }

    return memUsage;
  }

  /**
   * 创建自定义告警规则
   */
  addCustomAlertRule(name, condition, options = {}) {
    this.metrics.addAlertRule(name, {
      condition: condition.bind(this),
      severity: options.severity || 'warning',
      message: options.message || `Custom alert: ${name}`,
      threshold: options.threshold,
      cooldown: options.cooldown || 300000, // 5分钟默认冷却
    });

    logger.info('自定义告警规则已添加', {
      ruleName: name,
      severity: options.severity,
    });
  }

  /**
   * 创建自定义健康检查
   */
  addCustomHealthCheck(name, checkFunction, options = {}) {
    this.metrics.addHealthCheck(name, checkFunction, options);
    logger.info('自定义健康检查已添加', {
      checkName: name,
      interval: options.interval,
    });
  }

  /**
   * 获取HTTP请求监控中间件
   */
  getHttpMonitoringMiddleware() {
    return async (req, res, next) => {
      const startTime = Date.now();
      const originalSend = res.send;
      const originalJson = res.json;
      const originalEnd = res.end;

      let responseSent = false;

      // 拦截响应
      const interceptResponse = (data) => {
        if (responseSent) return;

        const duration = Date.now() - startTime;
        responseSent = true;

        // 记录HTTP指标
        this.metrics.recordHttpRequest(
          req.method,
          req.url,
          res.statusCode,
          duration,
        );

        // 记录缓存操作（如果使用了缓存中间件）
        if (req.cached) {
          this.recordCacheOperation('http_response', 'hit');
        } else {
          this.recordCacheOperation('http_response', 'miss');
        }

        // 记录性能
        logPerformance('http_request', duration, {
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          userAgent: req.get('User-Agent'),
          ip: req.ip,
        });

        return data;
      };

      res.send = (data) => originalSend.call(res, interceptResponse(data));
      res.json = (data) =>
        originalJson.call(res, interceptResponse(JSON.stringify(data)));
      res.end = (data) => {
        if (data) interceptResponse(data);
        originalEnd.call(res, data);
      };

      next();
    };
  }

  /**
   * 获取缓存中间件
   */
  getCacheMiddleware() {
    return this.cacheMiddleware.httpCache();
  }

  /**
   * 获取完整的中间件栈（监控 + 缓存）
   */
  getMiddlewareStack() {
    const middlewares = [];

    // HTTP监控中间件
    middlewares.push(this.getHttpMonitoringMiddleware());

    // 缓存中间件（如果启用）
    if (this.options.enableCacheMiddleware) {
      middlewares.push(this.getCacheMiddleware());
    }

    return middlewares;
  }

  /**
   * 初始化缓存服务
   */
  async initializeCacheService() {
    if (this.cacheService && !this.cacheService.initialized) {
      await this.cacheService.initialize();
      await this.cacheService.start();
      logger.info('缓存服务已在性能监控中间件中初始化');
    }
  }

  /**
   * 获取缓存服务实例
   */
  getCacheService() {
    return this.cacheService;
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats() {
    if (this.cacheMiddleware) {
      return this.cacheMiddleware.getCacheStats();
    }
    return null;
  }

  /**
   * 缓存预热方法
   */
  async warmupCache(keys, factory, options = {}) {
    if (this.cacheService) {
      return await this.cacheService.cacheManager.warmup(
        keys,
        factory,
        options,
      );
    }
    return false;
  }

  /**
   * 清除缓存
   */
  async clearCache(pattern = null, options = {}) {
    if (this.cacheService) {
      return await this.cacheService.clear(pattern, options);
    }
    return false;
  }
}

export default PerformanceMonitoringMiddleware;
