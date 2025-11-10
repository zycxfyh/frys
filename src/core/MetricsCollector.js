/**
 * Prometheus 风格的指标收集和监控系统
 * 借鉴 Prometheus 的指标类型，支持告警和健康检查
 */

import { logger } from '../../shared/utils/logger.js';

class MetricsCollector {
  constructor(options = {}) {
    this.metrics = new Map();
    this.builtInMetrics = new Map();
    this.alerts = new Map();
    this.healthChecks = new Map();
    this.alertRules = new Map();
    this.options = {
      collectInterval: options.collectInterval || 30000, // 30秒收集间隔
      alertInterval: options.alertInterval || 60000, // 60秒告警检查间隔
      ...options,
    };

    this.initializeBuiltInMetrics();
    this.initializeAlertRules();
    this.startCollection();
  }

  initializeBuiltInMetrics() {
    // HTTP 相关指标
    this.createCounter('http_requests_total', 'Total HTTP requests', [
      'method',
      'route',
      'status',
    ]);
    this.createGauge('http_active_connections', 'Active HTTP connections');
    this.createHistogram(
      'http_request_duration_seconds',
      'HTTP request duration',
      {
        buckets: [0.1, 0.5, 1, 2.5, 5, 10],
      },
      ['method', 'route', 'status'],
    );

    // 系统资源指标
    this.createGauge(
      'process_memory_usage_bytes',
      'Process memory usage in bytes',
      ['type'],
    );
    this.createGauge(
      'process_cpu_usage_percent',
      'Process CPU usage percentage',
    );
    this.createGauge('system_memory_total_bytes', 'Total system memory');
    this.createGauge('system_memory_free_bytes', 'Free system memory');
    this.createGauge('system_cpu_cores', 'Number of CPU cores');

    // 应用性能指标
    this.createCounter('application_errors_total', 'Total application errors', [
      'type',
      'severity',
    ]);
    this.createGauge(
      'application_uptime_seconds',
      'Application uptime in seconds',
    );
    this.createHistogram(
      'database_query_duration_seconds',
      'Database query duration',
      {
        buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
      },
      ['operation', 'table'],
    );

    // 缓存指标
    this.createGauge('cache_hit_ratio', 'Cache hit ratio');
    this.createCounter('cache_operations_total', 'Total cache operations', [
      'operation',
      'result',
    ]);

    // 业务指标
    this.createCounter(
      'business_operations_total',
      'Total business operations',
      ['operation', 'result'],
    );
    this.createGauge('queue_length', 'Queue length', ['queue']);
  }

  /**
   * 初始化告警规则
   */
  initializeAlertRules() {
    // 内存使用告警
    this.addAlertRule('high_memory_usage', {
      condition: () => {
        const memoryUsage = this.getMetricValue('process_memory_usage_bytes', {
          type: 'heapUsed',
        });
        const memoryTotal = this.getMetricValue('system_memory_total_bytes');
        return memoryUsage && memoryTotal && memoryUsage / memoryTotal > 0.8; // 80% 内存使用
      },
      severity: 'warning',
      message: 'High memory usage detected',
      threshold: 0.8,
      cooldown: 300000, // 5分钟冷却
    });

    // 高错误率告警
    this.addAlertRule('high_error_rate', {
      condition: () => {
        const totalRequests = this.getMetricValue('http_requests_total');
        const errorRequests = this.getMetricValue('http_requests_total', {
          status: '5xx',
        });
        return (
          totalRequests > 100 &&
          errorRequests &&
          errorRequests / totalRequests > 0.05
        ); // 5% 错误率
      },
      severity: 'critical',
      message: 'High error rate detected',
      threshold: 0.05,
      cooldown: 60000, // 1分钟冷却
    });

    // 响应时间告警
    this.addAlertRule('slow_response_time', {
      condition: () => {
        const avgResponseTime = this.calculateAverageResponseTime();
        return avgResponseTime > 5000; // 5秒平均响应时间
      },
      severity: 'warning',
      message: 'Slow response time detected',
      threshold: 5000,
      cooldown: 120000, // 2分钟冷却
    });

    // 系统负载告警
    this.addAlertRule('high_system_load', {
      condition: () => {
        const cpuUsage = this.getMetricValue('process_cpu_usage_percent');
        return cpuUsage && cpuUsage > 90; // 90% CPU 使用率
      },
      severity: 'warning',
      message: 'High system load detected',
      threshold: 90,
      cooldown: 180000, // 3分钟冷却
    });
  }

  /**
   * 开始自动收集指标
   */
  startCollection() {
    // 立即收集一次
    this.collectSystemMetrics();

    // 设置定时收集
    this.collectionTimer = setInterval(() => {
      this.collectSystemMetrics();
    }, this.options.collectInterval);

    // 设置告警检查
    this.alertTimer = setInterval(() => {
      this.checkAlerts();
    }, this.options.alertInterval);

    logger.info('📊 性能监控系统已启动', {
      collectInterval: this.options.collectInterval,
      alertInterval: this.options.alertInterval,
    });
  }

  /**
   * 停止收集
   */
  stopCollection() {
    if (this.collectionTimer) {
      clearInterval(this.collectionTimer);
      this.collectionTimer = null;
    }
    if (this.alertTimer) {
      clearInterval(this.alertTimer);
      this.alertTimer = null;
    }
    logger.info('📊 性能监控系统已停止');
  }

  /**
   * 添加告警规则
   */
  addAlertRule(name, rule) {
    this.alertRules.set(name, {
      ...rule,
      lastTriggered: 0,
      enabled: true,
    });
  }

  /**
   * 收集系统指标
   */
  collectSystemMetrics() {
    const startTime = Date.now();

    try {
      // 内存指标
      const memUsage = process.memoryUsage();
      this.setGauge('process_memory_usage_bytes', memUsage.rss, {
        type: 'rss',
      });
      this.setGauge('process_memory_usage_bytes', memUsage.heapUsed, {
        type: 'heapUsed',
      });
      this.setGauge('process_memory_usage_bytes', memUsage.heapTotal, {
        type: 'heapTotal',
      });
      this.setGauge('process_memory_usage_bytes', memUsage.external, {
        type: 'external',
      });

      // CPU 指标（简化版）
      const cpuUsage = process.cpuUsage();
      const totalCPUTime = cpuUsage.user + cpuUsage.system;
      const cpuPercent = totalCPUTime / 1000000 / (process.uptime() * 100); // 简化计算
      this.setGauge(
        'process_cpu_usage_percent',
        Math.min(cpuPercent * 100, 100),
      );

      // 系统信息
      const os = require('os');
      this.setGauge('system_memory_total_bytes', os.totalmem());
      this.setGauge('system_memory_free_bytes', os.freemem());
      this.setGauge('system_cpu_cores', os.cpus().length);

      // 应用运行时间
      this.setGauge('application_uptime_seconds', process.uptime());

      // 活动连接数（如果有HTTP服务器信息）
      if (global.httpServerConnections !== undefined) {
        this.setGauge('http_active_connections', global.httpServerConnections);
      }

      const duration = Date.now() - startTime;
      logPerformance('collect_system_metrics', duration, {
        collectedMetrics: this.metrics.size,
      });
    } catch (error) {
      logger.error('收集系统指标失败', error);
    }
  }

  /**
   * 检查告警条件
   */
  checkAlerts() {
    const now = Date.now();

    for (const [ruleName, rule] of this.alertRules) {
      if (!rule.enabled) continue;

      // 检查冷却时间
      if (now - rule.lastTriggered < rule.cooldown) continue;

      try {
        if (rule.condition(this.metrics)) {
          this.triggerAlert(ruleName, rule);
          rule.lastTriggered = now;
        }
      } catch (error) {
        logger.error(`告警规则 ${ruleName} 检查失败`, error);
      }
    }
  }

  /**
   * 触发告警
   */
  triggerAlert(ruleName, rule) {
    const alert = {
      name: ruleName,
      severity: rule.severity,
      message: rule.message,
      threshold: rule.threshold,
      timestamp: new Date().toISOString(),
      metrics: this.getCurrentMetricsSnapshot(),
    };

    this.alerts.set(ruleName, alert);

    logger.warn(`🚨 告警触发: ${ruleName}`, {
      alert: ruleName,
      severity: rule.severity,
      message: rule.message,
      threshold: rule.threshold,
    });

    // TODO: 发送告警通知（邮件、Slack、Webhook等）
    this.sendAlertNotification(alert);
  }

  /**
   * 发送告警通知
   */
  sendAlertNotification(alert) {
    // 这里可以集成各种通知渠道
    // 目前只是记录日志，实际实现可以添加邮件、Slack等通知

    logger.error(`告警通知: ${alert.name}`, {
      severity: alert.severity,
      message: alert.message,
      threshold: alert.threshold,
      timestamp: alert.timestamp,
    });

    // 可以在这里添加:
    // - 发送邮件通知
    // - 发送Slack消息
    // - 调用Webhook
    // - 写入告警数据库
  }

  /**
   * 获取当前指标快照
   */
  getCurrentMetricsSnapshot() {
    const snapshot = {};

    for (const [name, metric] of this.metrics) {
      snapshot[name] = {
        type: metric.type,
        help: metric.help,
        values: Object.fromEntries(metric.values),
      };
    }

    return snapshot;
  }

  /**
   * 获取指标值
   */
  getMetricValue(name, labels = {}) {
    const metric = this.metrics.get(name);
    if (!metric) return null;

    const key = this.getLabelKey(labels, metric.labels);
    return metric.values.get(key) || 0;
  }

  /**
   * 计算平均响应时间
   */
  calculateAverageResponseTime() {
    // 简化实现，实际应该从直方图中计算
    const histogram = this.metrics.get('http_request_duration_seconds');
    if (!histogram) return 0;

    // 这里应该实现更复杂的计算逻辑
    return 100; // 占位符
  }

  /**
   * HTTP 请求中间件
   */
  httpRequestMiddleware(req, res, next) {
    const startTime = Date.now();
    const method = req.method;
    const route = req.route?.path || req.path || '/';

    // 增加请求计数
    this.increment('http_requests_total', 1, { method, route });

    // 增加活动连接数
    this.setGauge(
      'http_active_connections',
      (this.getMetricValue('http_active_connections') || 0) + 1,
    );

    // 记录响应
    res.on('finish', () => {
      const duration = (Date.now() - startTime) / 1000; // 转换为秒
      const status = res.statusCode.toString();
      const statusCategory = status.startsWith('5')
        ? '5xx'
        : status.startsWith('4')
          ? '4xx'
          : status.startsWith('3')
            ? '3xx'
            : '2xx';

      // 记录响应时间直方图
      this.observeHistogram('http_request_duration_seconds', duration, {
        method,
        route,
        status,
      });

      // 更新请求计数（按状态码）
      this.increment('http_requests_total', 1, {
        method,
        route,
        status: statusCategory,
      });

      // 减少活动连接数
      this.setGauge(
        'http_active_connections',
        Math.max(0, (this.getMetricValue('http_active_connections') || 0) - 1),
      );

      // 性能日志
      logPerformance(
        'http_request',
        duration * 1000,
        {
          method,
          route,
          status: res.statusCode,
          contentLength: res.get('Content-Length'),
        },
        req.requestId,
      );
    });

    next();
  }

  /**
   * 记录应用错误
   */
  recordApplicationError(error, type = 'generic', severity = 'error') {
    this.increment('application_errors_total', 1, { type, severity });

    // 安全地处理错误对象
    const errorInfo = {
      errorType: type,
      errorSeverity: severity,
      errorName: error && error.name ? error.name : 'UnknownError',
      errorMessage:
        error && error.message
          ? error.message
          : String(error || 'Unknown error'),
      errorStack: error && error.stack ? error.stack : undefined,
    };

    logger.error('应用错误记录', errorInfo);
  }

  /**
   * 记录数据库查询
   */
  recordDatabaseQuery(operation, table, duration) {
    this.observeHistogram('database_query_duration_seconds', duration / 1000, {
      operation,
      table,
    });

    logPerformance('database_query', duration, { operation, table });
  }

  /**
   * 记录缓存操作
   */
  recordCacheOperation(operation, result) {
    this.increment('cache_operations_total', 1, { operation, result });
  }

  /**
   * 记录业务操作
   */
  recordBusinessOperation(operation, result) {
    this.increment('business_operations_total', 1, { operation, result });
  }

  /**
   * 添加健康检查
   */
  addHealthCheck(name, checkFunction, options = {}) {
    this.healthChecks.set(name, {
      name,
      check: checkFunction,
      interval: options.interval || 30000,
      timeout: options.timeout || 5000,
      lastCheck: null,
      lastResult: null,
      consecutiveFailures: 0,
      ...options,
    });
  }

  /**
   * 执行健康检查
   */
  async runHealthChecks() {
    const results = {};

    for (const [name, check] of this.healthChecks) {
      try {
        const startTime = Date.now();
        const result = await Promise.race([
          check.check(),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error('Health check timeout')),
              check.timeout,
            ),
          ),
        ]);

        const duration = Date.now() - startTime;
        check.lastCheck = new Date();
        check.lastResult = { status: 'healthy', duration, details: result };
        check.consecutiveFailures = 0;

        results[name] = check.lastResult;
      } catch (error) {
        check.lastCheck = new Date();
        check.consecutiveFailures = (check.consecutiveFailures || 0) + 1;
        check.lastResult = {
          status: 'unhealthy',
          error: error.message,
          duration: 0,
          consecutiveFailures: check.consecutiveFailures,
        };

        results[name] = check.lastResult;

        logger.warn(`健康检查失败: ${name}`, {
          error: error.message,
          consecutiveFailures: check.consecutiveFailures,
        });
      }
    }

    return results;
  }

  /**
   * 获取健康状态
   */
  async getHealthStatus() {
    const healthResults = await this.runHealthChecks();

    const overallStatus = Object.values(healthResults).every(
      (result) => result.status === 'healthy',
    )
      ? 'healthy'
      : 'unhealthy';

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.version,
      checks: healthResults,
      metrics: {
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        activeConnections: this.getMetricValue('http_active_connections') || 0,
      },
    };
  }

  createCounter(name, help, labels = []) {
    const metric = {
      name,
      help,
      type: 'counter',
      labels,
      values: new Map(),
    };

    this.metrics.set(name, metric);
    return metric;
  }

  createGauge(name, help, labels = []) {
    const metric = {
      name,
      help,
      type: 'gauge',
      labels,
      values: new Map(),
    };

    this.metrics.set(name, metric);
    return metric;
  }

  createHistogram(name, help, config = {}, labels = []) {
    const metric = {
      name,
      help,
      type: 'histogram',
      labels,
      buckets: config.buckets || [
        0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10,
      ],
      values: new Map(),
    };

    this.metrics.set(name, metric);
    return metric;
  }

  increment(name, value = 1, labels = {}) {
    const metric = this.metrics.get(name);
    if (!metric || metric.type !== 'counter') {
      throw new Error(`Counter metric ${name} not found`);
    }

    const key = this.getLabelKey(labels, metric.labels);
    const currentValue = metric.values.get(key) || 0;
    metric.values.set(key, currentValue + value);
  }

  setGauge(name, value, labels = {}) {
    const metric = this.metrics.get(name);
    if (!metric || metric.type !== 'gauge') {
      throw new Error(`Gauge metric ${name} not found`);
    }

    const key = this.getLabelKey(labels, metric.labels);
    metric.values.set(key, value);
  }

  observeHistogram(name, value) {
    const metric = this.metrics.get(name);
    if (!metric || metric.type !== 'histogram') {
      throw new Error(`Histogram metric ${name} not found`);
    }

    // 简化的直方图逻辑
    logger.info(`��� 观察直方图: ${name} = ${value}`);
  }

  getLabelKey(labels, expectedLabels) {
    const sortedLabels = expectedLabels
      .filter((label) => labels[label] !== undefined)
      .sort()
      .map((label) => `${label}="${labels[label]}"`)
      .join(',');

    return sortedLabels ? `{${sortedLabels}}` : '';
  }

  /**
   * 获取 Prometheus 格式的指标输出
   */
  getPrometheusMetrics() {
    let output = '# frys Application Metrics\n';

    for (const [name, metric] of this.metrics) {
      output += `\n# HELP ${name} ${metric.help}\n`;
      output += `# TYPE ${name} ${metric.type}\n`;

      output += this.formatMetricValues(name, metric);
    }

    return output;
  }

  /**
   * 格式化指标值
   */
  formatMetricValues(name, metric) {
    let output = '';

    for (const [labelKey, value] of metric.values) {
      if (metric.type === 'histogram') {
        output += this.formatHistogramMetric(name, labelKey, value);
      } else {
        output += `${name}${labelKey} ${value}\n`;
      }
    }

    return output;
  }

  /**
   * 格式化直方图指标
   */
  formatHistogramMetric(name, labelKey, value) {
    let output = `${name}_sum${labelKey} ${value.sum || 0}\n`;
    output += `${name}_count${labelKey} ${value.count || 0}\n`;

    if (value.buckets) {
      output += this.formatHistogramBuckets(name, labelKey, value.buckets);
    }

    return output;
  }

  /**
   * 格式化直方图桶
   */
  formatHistogramBuckets(name, labelKey, buckets) {
    let output = '';
    const labelSuffix = labelKey.replace('{', '').replace('}', '');

    for (const [bucket, count] of Object.entries(buckets)) {
      output += `${name}_bucket{le="${bucket}"}${labelSuffix} ${count}\n`;
    }

    return output;
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      metrics: this.metrics.size,
      alerts: this.alerts.size,
      healthChecks: this.healthChecks.size,
      alertRules: this.alertRules.size,
      totalValues: Array.from(this.metrics.values()).reduce(
        (sum, metric) => sum + metric.values.size,
        0,
      ),
      collectionInterval: this.options.collectInterval,
      alertInterval: this.options.alertInterval,
    };
  }

  /**
   * 获取活跃告警
   */
  getActiveAlerts() {
    return Array.from(this.alerts.values());
  }

  /**
   * 清除告警
   */
  clearAlert(alertName) {
    return this.alerts.delete(alertName);
  }

  /**
   * 启用/禁用告警规则
   */
  setAlertRuleEnabled(ruleName, enabled) {
    const rule = this.alertRules.get(ruleName);
    if (rule) {
      rule.enabled = enabled;
    }
  }

  /**
   * 销毁实例，清理所有资源
   */
  destroy() {
    // 停止所有定时器
    if (this.collectionTimer) {
      clearInterval(this.collectionTimer);
      this.collectionTimer = null;
    }

    if (this.alertTimer) {
      clearInterval(this.alertTimer);
      this.alertTimer = null;
    }

    // 清理数据
    this.metrics.clear();
    this.alertRules.clear();
    this.alertHistory = [];

    logger.info('MetricsCollector instance destroyed');
  }
}

export default MetricsCollector;
