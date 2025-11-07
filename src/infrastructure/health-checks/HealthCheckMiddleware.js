/**
 * frys - 健康检查中间件
 * 为Express应用提供健康检查端点
 */

import { logger } from '../../utils/logger.js';

export class HealthCheckMiddleware {
  constructor(healthChecker, config = {}) {
    this.healthChecker = healthChecker;
    this.config = {
      endpoint: config.endpoint || '/health',
      detailedEndpoint: config.detailedEndpoint || '/health/detailed',
      metricsEndpoint: config.metricsEndpoint || '/health/metrics',
      livenessEndpoint: config.livenessEndpoint || '/health/liveness',
      readinessEndpoint: config.readinessEndpoint || '/health/readiness',
      cacheTimeout: config.cacheTimeout || 5000, // 5秒缓存
      includeDetails: config.includeDetails !== false,
      exposeErrors: config.exposeErrors !== false,
      ...config,
    };

    this.healthCache = null;
    this.cacheTimestamp = 0;
  }

  /**
   * 获取Express中间件
   */
  getMiddleware() {
    return (req, res, next) => {
      this._handleHealthRequest(req, res, next);
    };
  }

  /**
   * 处理健康检查请求
   */
  async _handleHealthRequest(req, res, next) {
    const url = req.url;

    try {
      // 路由到不同的处理函数
      switch (url) {
        case this.config.endpoint:
          await this._handleBasicHealth(req, res);
          break;
        case this.config.detailedEndpoint:
          await this._handleDetailedHealth(req, res);
          break;
        case this.config.metricsEndpoint:
          await this._handleMetricsHealth(req, res);
          break;
        case this.config.livenessEndpoint:
          await this._handleLivenessHealth(req, res);
          break;
        case this.config.readinessEndpoint:
          await this._handleReadinessHealth(req, res);
          break;
        default:
          next();
          return;
      }
    } catch (error) {
      logger.error('健康检查中间件错误', error);

      if (this.config.exposeErrors) {
        res.status(500).json({
          status: 'error',
          message: 'Health check failed',
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      } else {
        res.status(500).json({
          status: 'unhealthy',
          message: 'Internal server error',
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  /**
   * 处理基本健康检查
   */
  async _handleBasicHealth(req, res) {
    const health = await this._getCachedHealth();

    const statusCode =
      health.overall.status === 'healthy'
        ? 200
        : health.overall.status === 'degraded'
          ? 200
          : 503;

    const response = {
      status: health.overall.status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
    };

    // 在 degraded 状态下仍返回 200，但包含警告
    if (health.overall.status === 'degraded') {
      response.warnings = health.summary.warnings.length;
    }

    res.status(statusCode).json(response);
  }

  /**
   * 处理详细健康检查
   */
  async _handleDetailedHealth(req, res) {
    if (!this.config.includeDetails) {
      res.status(403).json({
        error: 'Detailed health checks are disabled',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const health = await this._getCachedHealth();

    const statusCode = health.overall.status === 'healthy' ? 200 : 503;

    const response = {
      status: health.overall.status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      overall: health.overall,
      summary: health.summary,
      checks: health.checks.map((check) => ({
        name: check.name,
        status: check.status,
        duration: check.duration,
        timestamp: new Date(check.timestamp).toISOString(),
        ...(check.error && this.config.exposeErrors
          ? { error: check.error.message }
          : {}),
      })),
    };

    res.status(statusCode).json(response);
  }

  /**
   * 处理指标健康检查
   */
  async _handleMetricsHealth(req, res) {
    // 执行即时健康检查（不使用缓存）
    await this.healthChecker.checkNow();

    const health = this.healthChecker.getHealthSummary();

    const response = {
      status: health.overall.status,
      timestamp: new Date().toISOString(),
      metrics: {
        total_checks: health.summary.total,
        healthy_checks: health.summary.healthy,
        unhealthy_checks: health.summary.unhealthy,
        critical_failures: health.summary.critical.length,
        warnings: health.summary.warnings.length,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
      },
    };

    const statusCode = health.overall.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(response);
  }

  /**
   * 处理存活探针
   */
  async _handleLivenessHealth(req, res) {
    // 存活探针检查应用是否还活着
    // 如果应用能响应这个请求，就认为它是活的
    const response = {
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage().heapUsed,
      pid: process.pid,
    };

    res.status(200).json(response);
  }

  /**
   * 处理就绪探针
   */
  async _handleReadinessHealth(req, res) {
    // 就绪探针检查应用是否准备好接收流量
    const health = await this._getCachedHealth();

    const isReady =
      health.overall.status === 'healthy' ||
      (health.overall.status === 'degraded' &&
        health.summary.critical.length === 0);

    const response = {
      status: isReady ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      overall_health: health.overall.status,
      critical_issues: health.summary.critical.length,
      uptime: process.uptime(),
    };

    const statusCode = isReady ? 200 : 503;
    res.status(statusCode).json(response);
  }

  /**
   * 获取缓存的健康状态
   */
  async _getCachedHealth() {
    const now = Date.now();

    // 检查缓存是否过期
    if (
      this.healthCache &&
      now - this.cacheTimestamp < this.config.cacheTimeout
    ) {
      return this.healthCache;
    }

    // 获取新的健康状态
    this.healthCache = this.healthChecker.getHealthSummary();
    this.cacheTimestamp = now;

    return this.healthCache;
  }

  /**
   * 创建Kubernetes探针配置
   */
  static createKubernetesProbes(config = {}) {
    const baseConfig = {
      httpGet: {
        path: config.endpoint || '/health',
        port: config.port || 3000,
        scheme: 'HTTP',
      },
      initialDelaySeconds: config.initialDelaySeconds || 30,
      periodSeconds: config.periodSeconds || 10,
      timeoutSeconds: config.timeoutSeconds || 5,
      successThreshold: config.successThreshold || 1,
      failureThreshold: config.failureThreshold || 3,
    };

    return {
      livenessProbe: {
        ...baseConfig,
        httpGet: {
          ...baseConfig.httpGet,
          path: config.livenessEndpoint || '/health/liveness',
        },
      },
      readinessProbe: {
        ...baseConfig,
        httpGet: {
          ...baseConfig.httpGet,
          path: config.readinessEndpoint || '/health/readiness',
        },
      },
      startupProbe: config.startupProbe || {
        ...baseConfig,
        httpGet: {
          ...baseConfig.httpGet,
          path: config.startupEndpoint || '/health',
        },
        initialDelaySeconds: config.startupDelaySeconds || 10,
        periodSeconds: config.startupPeriodSeconds || 5,
        failureThreshold: config.startupFailureThreshold || 6,
      },
    };
  }

  /**
   * 创建Docker健康检查配置
   */
  static createDockerHealthCheck(config = {}) {
    return {
      test: [
        'CMD',
        'curl',
        '-f',
        `http://localhost:${config.port || 3000}${config.endpoint || '/health'}`,
      ],
      interval: config.interval || 30000000000, // 30秒
      timeout: config.timeout || 10000000000, // 10秒
      retries: config.retries || 3,
      start_period: config.startPeriod || 40000000000, // 40秒
    };
  }

  /**
   * 创建Prometheus指标端点
   */
  static createPrometheusEndpoint(healthChecker) {
    return async (req, res) => {
      const health = healthChecker.getHealthSummary();

      // 生成Prometheus格式的指标
      const metrics = [
        '# HELP health_check_status 健康检查状态 (0=healthy, 1=degraded, 2=unhealthy)',
        '# TYPE health_check_status gauge',
        `health_check_status ${health.overall.status === 'healthy' ? 0 : health.overall.status === 'degraded' ? 1 : 2}`,
        '',
        '# HELP health_check_total_checks 总检查数',
        '# TYPE health_check_total_checks gauge',
        `health_check_total_checks ${health.summary.total}`,
        '',
        '# HELP health_check_healthy_checks 健康检查数',
        '# TYPE health_check_healthy_checks gauge',
        `health_check_healthy_checks ${health.summary.healthy}`,
        '',
        '# HELP health_check_unhealthy_checks 不健康检查数',
        '# TYPE health_check_unhealthy_checks gauge',
        `health_check_unhealthy_checks ${health.summary.unhealthy}`,
        '',
        '# HELP health_check_critical_failures 关键故障数',
        '# TYPE health_check_critical_failures gauge',
        `health_check_critical_failures ${health.summary.critical.length}`,
        '',
        '# HELP application_uptime 应用运行时间',
        '# TYPE application_uptime gauge',
        `application_uptime ${process.uptime()}`,
      ];

      res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
      res.status(200).send(metrics.join('\n'));
    };
  }

  /**
   * 创建Grafana仪表盘配置
   */
  static createGrafanaDashboard(healthChecker) {
    return {
      dashboard: {
        title: 'Application Health Dashboard',
        tags: ['health', 'monitoring'],
        timezone: 'browser',
        panels: [
          {
            title: 'Overall Health Status',
            type: 'stat',
            targets: [
              {
                expr: 'health_check_status',
                legendFormat: 'Health Status',
              },
            ],
          },
          {
            title: 'Check Results',
            type: 'bargauge',
            targets: [
              {
                expr: 'health_check_healthy_checks',
                legendFormat: 'Healthy',
              },
              {
                expr: 'health_check_unhealthy_checks',
                legendFormat: 'Unhealthy',
              },
            ],
          },
          {
            title: 'Application Uptime',
            type: 'stat',
            targets: [
              {
                expr: 'application_uptime',
                legendFormat: 'Uptime (seconds)',
              },
            ],
            format: 'duration',
          },
        ],
      },
    };
  }

  /**
   * 集成到现有Express应用
   */
  static integrate(app, healthChecker, config = {}) {
    const middleware = new HealthCheckMiddleware(healthChecker, config);

    // 注册健康检查路由
    app.get(middleware.config.endpoint, middleware.getMiddleware());
    app.get(middleware.config.detailedEndpoint, middleware.getMiddleware());
    app.get(middleware.config.metricsEndpoint, middleware.getMiddleware());
    app.get(middleware.config.livenessEndpoint, middleware.getMiddleware());
    app.get(middleware.config.readinessEndpoint, middleware.getMiddleware());

    logger.info('健康检查中间件已集成', {
      endpoints: [
        middleware.config.endpoint,
        middleware.config.detailedEndpoint,
        middleware.config.metricsEndpoint,
        middleware.config.livenessEndpoint,
        middleware.config.readinessEndpoint,
      ],
    });

    return middleware;
  }
}
