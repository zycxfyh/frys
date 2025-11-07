/**
 * frys - 扩容指标收集器
 * 收集和分析用于扩容决策的系统指标
 */

import { logger } from '../../utils/logger.js';
import * as os from 'os';

export class ScalingMetrics {
  constructor(config = {}) {
    this.collectionInterval = config.collectionInterval || 30000; // 30秒
    this.retentionPeriod = config.retentionPeriod || 3600000; // 1小时
    this.metrics = {
      cpu: [],
      memory: [],
      requests: [],
      responseTime: [],
      errorRate: [],
      custom: new Map(),
    };
    this.collectionTimer = null;
    this.isCollecting = false;
    this.hooks = {
      onMetricsCollected: config.onMetricsCollected || (() => {}),
      onAnomalyDetected: config.onAnomalyDetected || (() => {}),
    };
  }

  /**
   * 开始收集指标
   */
  async startCollection() {
    if (this.isCollecting) {
      logger.warn('指标收集已在运行中');
      return;
    }

    this.isCollecting = true;
    logger.info('开始收集扩容指标');

    this.collectionTimer = setInterval(() => {
      this._collectMetrics();
    }, this.collectionInterval);

    // 立即收集一次
    await this._collectMetrics();
  }

  /**
   * 停止收集指标
   */
  stopCollection() {
    if (this.collectionTimer) {
      clearInterval(this.collectionTimer);
      this.collectionTimer = null;
    }
    this.isCollecting = false;
    logger.info('停止收集扩容指标');
  }

  /**
   * 收集当前指标
   */
  async _collectMetrics() {
    try {
      const timestamp = Date.now();
      const metrics = await this._gatherSystemMetrics();

      // 添加时间戳
      const metricsWithTimestamp = { ...metrics, timestamp };

      // 存储指标
      this._storeMetrics(metricsWithTimestamp);

      // 清理过期数据
      this._cleanupOldMetrics();

      // 检查异常
      this._checkForAnomalies(metricsWithTimestamp);

      // 触发回调
      this.hooks.onMetricsCollected(metricsWithTimestamp);

      logger.debug('指标收集完成', metricsWithTimestamp);
    } catch (error) {
      logger.error('指标收集失败', error);
    }
  }

  /**
   * 收集系统指标
   */
  async _gatherSystemMetrics() {
    const cpus = os.cpus();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();

    // CPU使用率
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach((cpu) => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const cpuUsage = 1 - idle / total;

    // 内存使用率
    const memoryUsage = 1 - freeMemory / totalMemory;

    // 网络和磁盘指标（简化实现）
    const networkStats = await this._getNetworkStats();
    const diskStats = await this._getDiskStats();

    return {
      cpuUsage: Math.max(0, Math.min(1, cpuUsage)), // 确保在0-1范围内
      memoryUsage: Math.max(0, Math.min(1, memoryUsage)),
      totalMemory,
      freeMemory,
      usedMemory: totalMemory - freeMemory,
      loadAverage: os.loadavg(),
      networkRx: networkStats.rx || 0,
      networkTx: networkStats.tx || 0,
      diskRead: diskStats.read || 0,
      diskWrite: diskStats.write || 0,
      uptime: os.uptime(),
    };
  }

  /**
   * 获取网络统计信息
   */
  async _getNetworkStats() {
    try {
      // 简化实现，实际应该从系统API获取
      // 这里返回模拟数据
      return {
        rx: Math.random() * 1000000, // 模拟接收字节数
        tx: Math.random() * 1000000, // 模拟发送字节数
      };
    } catch (error) {
      logger.warn('获取网络统计失败', error);
      return { rx: 0, tx: 0 };
    }
  }

  /**
   * 获取磁盘统计信息
   */
  async _getDiskStats() {
    try {
      // 简化实现，实际应该从系统API获取
      // 这里返回模拟数据
      return {
        read: Math.random() * 100000,
        write: Math.random() * 100000,
      };
    } catch (error) {
      logger.warn('获取磁盘统计失败', error);
      return { read: 0, write: 0 };
    }
  }

  /**
   * 记录请求指标
   * @param {object} requestMetrics - 请求指标
   */
  recordRequest(requestMetrics) {
    const { responseTime, statusCode, method, url } = requestMetrics;
    const timestamp = Date.now();

    const metric = {
      timestamp,
      responseTime,
      statusCode,
      method,
      url,
      isError: statusCode >= 400,
    };

    this.metrics.requests.push(metric);
    this.metrics.responseTime.push({
      timestamp,
      value: responseTime,
      method,
      url,
    });

    // 计算错误率
    this._updateErrorRate();
  }

  /**
   * 更新错误率
   */
  _updateErrorRate() {
    const recentRequests = this.metrics.requests.slice(-100); // 最近100个请求
    if (recentRequests.length === 0) return;

    const errorCount = recentRequests.filter((r) => r.isError).length;
    const errorRate = errorCount / recentRequests.length;

    this.metrics.errorRate.push({
      timestamp: Date.now(),
      value: errorRate,
    });
  }

  /**
   * 记录自定义指标
   * @param {string} name - 指标名称
   * @param {number} value - 指标值
   * @param {object} metadata - 元数据
   */
  recordCustomMetric(name, value, metadata = {}) {
    if (!this.metrics.custom.has(name)) {
      this.metrics.custom.set(name, []);
    }

    const metric = {
      timestamp: Date.now(),
      value,
      ...metadata,
    };

    this.metrics.custom.get(name).push(metric);
  }

  /**
   * 存储指标数据
   * @param {object} metrics - 指标数据
   */
  _storeMetrics(metrics) {
    // 存储系统指标
    this.metrics.cpu.push({
      timestamp: metrics.timestamp,
      value: metrics.cpuUsage,
    });

    this.metrics.memory.push({
      timestamp: metrics.timestamp,
      value: metrics.memoryUsage,
    });
  }

  /**
   * 清理过期指标数据
   */
  _cleanupOldMetrics() {
    const cutoffTime = Date.now() - this.retentionPeriod;

    Object.keys(this.metrics).forEach((key) => {
      if (Array.isArray(this.metrics[key])) {
        this.metrics[key] = this.metrics[key].filter(
          (m) => m.timestamp > cutoffTime,
        );
      }
    });

    // 清理自定义指标
    for (const [name, metricArray] of this.metrics.custom) {
      this.metrics.custom.set(
        name,
        metricArray.filter((m) => m.timestamp > cutoffTime),
      );
    }
  }

  /**
   * 检查异常指标
   * @param {object} currentMetrics - 当前指标
   */
  _checkForAnomalies(currentMetrics) {
    const anomalies = [];

    // CPU使用率异常
    if (currentMetrics.cpuUsage > 0.95) {
      anomalies.push({
        type: 'cpu',
        severity: 'critical',
        message: `CPU使用率异常高: ${Math.round(currentMetrics.cpuUsage * 100)}%`,
        value: currentMetrics.cpuUsage,
      });
    } else if (currentMetrics.cpuUsage > 0.85) {
      anomalies.push({
        type: 'cpu',
        severity: 'high',
        message: `CPU使用率较高: ${Math.round(currentMetrics.cpuUsage * 100)}%`,
        value: currentMetrics.cpuUsage,
      });
    }

    // 内存使用率异常
    if (currentMetrics.memoryUsage > 0.95) {
      anomalies.push({
        type: 'memory',
        severity: 'critical',
        message: `内存使用率异常高: ${Math.round(currentMetrics.memoryUsage * 100)}%`,
        value: currentMetrics.memoryUsage,
      });
    } else if (currentMetrics.memoryUsage > 0.9) {
      anomalies.push({
        type: 'memory',
        severity: 'high',
        message: `内存使用率较高: ${Math.round(currentMetrics.memoryUsage * 100)}%`,
        value: currentMetrics.memoryUsage,
      });
    }

    // 触发异常回调
    if (anomalies.length > 0) {
      this.hooks.onAnomalyDetected(anomalies);
    }
  }

  /**
   * 获取当前指标快照
   * @returns {object} 当前指标
   */
  getCurrentMetrics() {
    const getLatest = (array) => array[array.length - 1]?.value || 0;
    const getAverage = (array, count = 5) => {
      const recent = array.slice(-count);
      if (recent.length === 0) return 0;
      return recent.reduce((sum, m) => sum + m.value, 0) / recent.length;
    };

    return {
      cpuUsage: getAverage(this.metrics.cpu),
      memoryUsage: getAverage(this.metrics.memory),
      requestRate: this._calculateRequestRate(),
      avgResponseTime: this._calculateAverageResponseTime(),
      errorRate: getLatest(this.metrics.errorRate),
      timestamp: Date.now(),
    };
  }

  /**
   * 计算请求率（每分钟请求数）
   */
  _calculateRequestRate() {
    const recentRequests = this.metrics.requests.slice(-60); // 最近60个请求
    if (recentRequests.length < 2) return 0;

    const timeSpan =
      recentRequests[recentRequests.length - 1].timestamp -
      recentRequests[0].timestamp;
    if (timeSpan === 0) return 0;

    return (recentRequests.length / timeSpan) * 60000; // 转换为每分钟
  }

  /**
   * 计算平均响应时间
   */
  _calculateAverageResponseTime() {
    const recentResponses = this.metrics.responseTime.slice(-50); // 最近50个响应
    if (recentResponses.length === 0) return 0;

    return (
      recentResponses.reduce((sum, r) => sum + r.value, 0) /
      recentResponses.length
    );
  }

  /**
   * 获取指标历史数据
   * @param {string} metricType - 指标类型
   * @param {number} duration - 时间范围（毫秒）
   * @returns {Array} 历史数据
   */
  getMetricHistory(metricType, duration = 3600000) {
    const cutoffTime = Date.now() - duration;

    if (this.metrics[metricType]) {
      return this.metrics[metricType].filter((m) => m.timestamp > cutoffTime);
    }

    if (this.metrics.custom.has(metricType)) {
      return this.metrics.custom
        .get(metricType)
        .filter((m) => m.timestamp > cutoffTime);
    }

    return [];
  }

  /**
   * 获取指标统计信息
   */
  getMetricsStats() {
    return {
      cpu: this._getStatsForMetric(this.metrics.cpu),
      memory: this._getStatsForMetric(this.metrics.memory),
      requests: {
        total: this.metrics.requests.length,
        recent: this.metrics.requests.slice(-100).length,
        rate: this._calculateRequestRate(),
      },
      responseTime: this._getStatsForMetric(
        this.metrics.responseTime.map((m) => ({
          timestamp: m.timestamp,
          value: m.value,
        })),
      ),
      errorRate: this._getStatsForMetric(this.metrics.errorRate),
      custom: Object.fromEntries(
        Array.from(this.metrics.custom.entries()).map(([name, metrics]) => [
          name,
          this._getStatsForMetric(metrics),
        ]),
      ),
    };
  }

  /**
   * 获取单个指标的统计信息
   */
  _getStatsForMetric(metrics) {
    if (metrics.length === 0) {
      return { count: 0, avg: 0, min: 0, max: 0 };
    }

    const values = metrics.map((m) => m.value);
    return {
      count: metrics.length,
      avg: values.reduce((sum, v) => sum + v, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
    };
  }

  /**
   * 设置回调钩子
   */
  setHooks(hooks) {
    Object.assign(this.hooks, hooks);
  }

  /**
   * 获取配置
   */
  getConfig() {
    return {
      collectionInterval: this.collectionInterval,
      retentionPeriod: this.retentionPeriod,
      isCollecting: this.isCollecting,
    };
  }
}
