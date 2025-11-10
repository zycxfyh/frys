/**
 * 指标收集工具类
 * 统一内存统计、CPU统计等收集逻辑
 */

import { logger } from '../utils/logger.js';
import os from 'os';

export class MetricsCollectorUtils {
  /**
   * 收集内存统计信息
   */
  static collectMemoryStats(options = {}) {
    const memUsage = process.memoryUsage();

    const stats = {
      rss: memUsage.rss,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      arrayBuffers: memUsage.arrayBuffers || 0,

      // 计算使用率
      heapUsagePercent: (memUsage.heapUsed / memUsage.heapTotal) * 100,
      totalUsagePercent: (memUsage.rss / os.totalmem()) * 100,

      // 系统内存信息
      systemTotal: os.totalmem(),
      systemFree: os.freemem(),
      systemUsed: os.totalmem() - os.freemem(),
      systemUsagePercent: ((os.totalmem() - os.freemem()) / os.totalmem()) * 100,

      timestamp: Date.now()
    };

    if (options.includeDetails) {
      stats.details = {
        heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
        rssMB: Math.round(memUsage.rss / 1024 / 1024),
        externalMB: Math.round(memUsage.external / 1024 / 1024),
        systemTotalGB: Math.round(os.totalmem() / 1024 / 1024 / 1024),
        systemFreeGB: Math.round(os.freemem() / 1024 / 1024 / 1024),
        systemUsedGB: Math.round((os.totalmem() - os.freemem()) / 1024 / 1024 / 1024)
      };
    }

    return stats;
  }

  /**
   * 收集CPU统计信息
   */
  static collectCPUStats(options = {}) {
    const cpus = os.cpus();
    const loadAvg = os.loadavg();

    const stats = {
      loadAverage: {
        '1min': loadAvg[0],
        '5min': loadAvg[1],
        '15min': loadAvg[2]
      },

      coreCount: cpus.length,
      model: cpus[0]?.model || 'unknown',
      speed: cpus[0]?.speed || 0,

      timestamp: Date.now()
    };

    if (options.includeDetails) {
      // 计算每个CPU核心的使用率
      const previousUsage = options.previousUsage || cpus.map(() => ({ idle: 0, total: 0 }));

      stats.cores = cpus.map((cpu, index) => {
        const prev = previousUsage[index];
        const curr = {
          idle: cpu.times.idle,
          total: Object.values(cpu.times).reduce((sum, time) => sum + time, 0)
        };

        const idleDiff = curr.idle - prev.idle;
        const totalDiff = curr.total - prev.total;

        const usagePercent = totalDiff > 0 ? ((totalDiff - idleDiff) / totalDiff) * 100 : 0;

        return {
          core: index,
          model: cpu.model,
          speed: cpu.speed,
          usagePercent: Math.round(usagePercent * 100) / 100,
          times: cpu.times
        };
      });

      stats.overallUsage = stats.cores.reduce((sum, core) => sum + core.usagePercent, 0) / stats.cores.length;
      stats.previousUsage = cpus.map(cpu => ({
        idle: cpu.times.idle,
        total: Object.values(cpu.times).reduce((sum, time) => sum + time, 0)
      }));
    }

    return stats;
  }

  /**
   * 收集磁盘I/O统计信息
   */
  static collectDiskStats(options = {}) {
    // 注意：Node.js 标准库不直接提供磁盘I/O统计
    // 这里返回基本的磁盘使用信息
    const stats = {
      timestamp: Date.now(),
      note: 'Basic disk stats - for detailed I/O stats, consider using system-specific APIs'
    };

    try {
      // 在某些系统上可以获取磁盘使用情况
      if (os.platform() === 'linux' || os.platform() === 'darwin') {
        // 这里可以集成系统特定的磁盘统计
        stats.available = 'System-dependent';
      }
    } catch (error) {
      logger.debug('Disk stats collection failed', { error: error.message });
    }

    return stats;
  }

  /**
   * 收集网络统计信息
   */
  static collectNetworkStats(options = {}) {
    const networkInterfaces = os.networkInterfaces();

    const stats = {
      interfaces: {},
      timestamp: Date.now()
    };

    for (const [name, interfaces] of Object.entries(networkInterfaces)) {
      if (!interfaces) continue;

      stats.interfaces[name] = interfaces.map(iface => ({
        address: iface.address,
        netmask: iface.netmask,
        family: iface.family,
        mac: iface.mac,
        internal: iface.internal,
        cidr: iface.cidr
      }));
    }

    return stats;
  }

  /**
   * 收集垃圾回收统计信息
   */
  static collectGCStats(options = {}) {
    // V8 垃圾回收统计需要特殊处理
    const stats = {
      timestamp: Date.now(),
      note: 'GC stats require V8-specific APIs or monitoring tools'
    };

    // 如果有性能观察器，尝试获取GC信息
    if (typeof performance !== 'undefined' && performance.memory) {
      stats.memory = {
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        totalJSHeapSize: performance.memory.totalJSHeapSize,
        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
      };
    }

    return stats;
  }

  /**
   * 收集事件循环统计信息
   */
  static collectEventLoopStats(options = {}) {
    const stats = {
      timestamp: Date.now(),
      uptime: process.uptime(),
      pid: process.pid,
      ppid: process.ppid,
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version
    };

    return stats;
  }

  /**
   * 收集综合系统指标
   */
  static collectSystemStats(options = {}) {
    const stats = {
      timestamp: Date.now(),
      memory: this.collectMemoryStats(options),
      cpu: this.collectCPUStats(options),
      network: this.collectNetworkStats(options),
      eventLoop: this.collectEventLoopStats(options)
    };

    if (options.includeDisk) {
      stats.disk = this.collectDiskStats(options);
    }

    if (options.includeGC) {
      stats.gc = this.collectGCStats(options);
    }

    return stats;
  }

  /**
   * 创建指标收集器
   */
  static createCollector(config = {}) {
    const {
      interval = 5000,
      metrics = ['memory', 'cpu'],
      historySize = 100,
      onCollect = null,
      onThresholdExceeded = null,
      thresholds = {}
    } = config;

    const history = new Map();
    let intervalId = null;

    const collector = {
      start: () => {
        if (intervalId) return;

        intervalId = setInterval(async () => {
          try {
            const stats = {};

            for (const metric of metrics) {
              switch (metric) {
                case 'memory':
                  stats.memory = this.collectMemoryStats(config);
                  break;
                case 'cpu':
                  stats.cpu = this.collectCPUStats(config);
                  break;
                case 'disk':
                  stats.disk = this.collectDiskStats(config);
                  break;
                case 'network':
                  stats.network = this.collectNetworkStats(config);
                  break;
                case 'gc':
                  stats.gc = this.collectGCStats(config);
                  break;
                case 'eventLoop':
                  stats.eventLoop = this.collectEventLoopStats(config);
                  break;
              }
            }

            // 检查阈值
            if (onThresholdExceeded) {
              const violations = this.checkThresholds(stats, thresholds);
              if (violations.length > 0) {
                onThresholdExceeded(violations, stats);
              }
            }

            // 存储历史
            const timestamp = Date.now();
            history.set(timestamp, stats);

            // 限制历史大小
            if (history.size > historySize) {
              const oldestKey = Math.min(...history.keys());
              history.delete(oldestKey);
            }

            // 回调
            if (onCollect) {
              await onCollect(stats);
            }

          } catch (error) {
            logger.error('Metrics collection failed', {
              error: error.message,
              stack: error.stack
            });
          }
        }, interval);

        logger.info('Metrics collector started', { interval, metrics: metrics.join(',') });
      },

      stop: () => {
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
          logger.info('Metrics collector stopped');
        }
      },

      getHistory: () => Array.from(history.entries()),

      getLatest: () => {
        const timestamps = Array.from(history.keys()).sort((a, b) => b - a);
        return timestamps.length > 0 ? history.get(timestamps[0]) : null;
      },

      clearHistory: () => {
        history.clear();
        logger.debug('Metrics history cleared');
      },

      isRunning: () => !!intervalId
    };

    return collector;
  }

  /**
   * 检查阈值违规
   */
  static checkThresholds(stats, thresholds) {
    const violations = [];

    const checkValue = (value, threshold, path) => {
      if (threshold.max !== undefined && value > threshold.max) {
        violations.push({
          path,
          value,
          threshold: threshold.max,
          type: 'max',
          severity: threshold.severity || 'warning'
        });
      }

      if (threshold.min !== undefined && value < threshold.min) {
        violations.push({
          path,
          value,
          threshold: threshold.min,
          type: 'min',
          severity: threshold.severity || 'warning'
        });
      }
    };

    const checkObject = (obj, thresholdObj, prefix = '') => {
      for (const [key, threshold] of Object.entries(thresholdObj)) {
        const fullPath = prefix ? `${prefix}.${key}` : key;
        const value = obj[key];

        if (typeof threshold === 'object' && threshold !== null && !Array.isArray(threshold)) {
          // 嵌套阈值
          if (typeof value === 'object' && value !== null) {
            checkObject(value, threshold, fullPath);
          }
        } else if (typeof threshold === 'object' && (threshold.max !== undefined || threshold.min !== undefined)) {
          // 简单阈值
          if (typeof value === 'number') {
            checkValue(value, threshold, fullPath);
          }
        }
      }
    };

    checkObject(stats, thresholds);
    return violations;
  }

  /**
   * 计算指标趋势
   */
  static calculateTrend(history, metricPath, windowSize = 10) {
    if (history.length < windowSize) {
      return { trend: 'insufficient_data', confidence: 0 };
    }

    const values = history.slice(-windowSize).map(entry => {
      const keys = metricPath.split('.');
      let value = entry[1]; // entry[1] 是实际的stats对象

      for (const key of keys) {
        if (value && typeof value === 'object') {
          value = value[key];
        } else {
          return null;
        }
      }

      return typeof value === 'number' ? value : null;
    }).filter(v => v !== null);

    if (values.length < 2) {
      return { trend: 'insufficient_data', confidence: 0 };
    }

    // 简单线性回归计算趋势
    const n = values.length;
    const sumX = values.reduce((sum, _, i) => sum + i, 0);
    const sumY = values.reduce((sum, v) => sum + v, 0);
    const sumXY = values.reduce((sum, v, i) => sum + v * i, 0);
    const sumXX = values.reduce((sum, _, i) => sum + i * i, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

    const trend = slope > 0.01 ? 'increasing' :
                  slope < -0.01 ? 'decreasing' : 'stable';

    const confidence = Math.min(Math.abs(slope) * 100, 1);

    return {
      trend,
      slope,
      confidence,
      values,
      description: `${trend} trend detected (slope: ${slope.toFixed(4)})`
    };
  }

  /**
   * 聚合指标数据
   */
  static aggregateMetrics(history, aggregation = {}) {
    if (history.length === 0) return {};

    const aggregated = {};

    for (const [metricPath, aggType] of Object.entries(aggregation)) {
      const values = history.map(entry => {
        const keys = metricPath.split('.');
        let value = entry[1];

        for (const key of keys) {
          if (value && typeof value === 'object') {
            value = value[key];
          } else {
            return null;
          }
        }

        return typeof value === 'number' ? value : null;
      }).filter(v => v !== null);

      if (values.length === 0) continue;

      switch (aggType) {
        case 'avg':
          aggregated[metricPath] = values.reduce((sum, v) => sum + v, 0) / values.length;
          break;
        case 'min':
          aggregated[metricPath] = Math.min(...values);
          break;
        case 'max':
          aggregated[metricPath] = Math.max(...values);
          break;
        case 'sum':
          aggregated[metricPath] = values.reduce((sum, v) => sum + v, 0);
          break;
        case 'count':
          aggregated[metricPath] = values.length;
          break;
        case 'percentile':
          // 简化的百分位数计算
          const sorted = values.sort((a, b) => a - b);
          const p95Index = Math.floor(sorted.length * 0.95);
          aggregated[metricPath] = sorted[p95Index];
          break;
      }
    }

    return aggregated;
  }
}
