/**
 * 统计报告工具类
 * 统一getAdvanced*Stats方法的结构和实现
 */

import { logger } from '../utils/logger.js';

export class StatsReporterUtils {
  /**
   * 创建统计报告生成器
   */
  static createReporter(componentName, baseStatsProvider, options = {}) {
    const {
      includePerformance = true,
      includeHealth = true,
      includeTrends = false,
      customMetrics = {},
      retentionPeriod = 3600000 // 1小时
    } = options;

    const history = [];
    const trends = new Map();

    return {
      /**
       * 生成高级统计报告
       */
      getAdvancedStats: () => {
        try {
          const baseStats = baseStatsProvider();
          const timestamp = Date.now();

          const report = {
            component: componentName,
            timestamp,
            generatedAt: new Date(timestamp).toISOString(),
            basic: baseStats,
            advanced: {}
          };

          // 性能指标
          if (includePerformance) {
            report.advanced.performance = this.calculatePerformanceMetrics(baseStats, history);
          }

          // 健康状态
          if (includeHealth) {
            report.advanced.health = this.assessHealthStatus(baseStats);
          }

          // 趋势分析
          if (includeTrends && history.length > 1) {
            report.advanced.trends = this.analyzeTrends(history, trends);
          }

          // 自定义指标
          if (Object.keys(customMetrics).length > 0) {
            report.advanced.custom = this.calculateCustomMetrics(baseStats, customMetrics);
          }

          // 存储历史记录
          history.push({
            timestamp,
            stats: baseStats
          });

          // 清理过期记录
          const cutoffTime = timestamp - retentionPeriod;
          while (history.length > 0 && history[0].timestamp < cutoffTime) {
            history.shift();
          }

          // 限制历史记录数量
          if (history.length > 1000) {
            history.splice(0, history.length - 500);
          }

          return report;

        } catch (error) {
          logger.error(`Failed to generate advanced stats for ${componentName}`, {
            error: error.message,
            stack: error.stack
          });

          // 返回基本的错误报告
          return {
            component: componentName,
            timestamp: Date.now(),
            error: error.message,
            basic: baseStatsProvider()
          };
        }
      },

      /**
       * 获取历史统计数据
       */
      getHistory: (limit = 100) => {
        return history.slice(-limit).map(entry => ({
          timestamp: entry.timestamp,
          stats: entry.stats
        }));
      },

      /**
       * 获取趋势数据
       */
      getTrends: () => {
        return Object.fromEntries(trends);
      },

      /**
       * 清除历史数据
       */
      clearHistory: () => {
        history.length = 0;
        trends.clear();
        logger.debug(`Cleared stats history for ${componentName}`);
      },

      /**
       * 获取统计摘要
       */
      getSummary: () => {
        if (history.length === 0) {
          return { component: componentName, message: 'No historical data available' };
        }

        const latest = history[history.length - 1];
        const oldest = history[0];
        const duration = latest.timestamp - oldest.timestamp;

        return {
          component: componentName,
          duration,
          recordCount: history.length,
          averageInterval: history.length > 1 ? duration / (history.length - 1) : 0,
          latestTimestamp: latest.timestamp,
          oldestTimestamp: oldest.timestamp
        };
      }
    };
  }

  /**
   * 计算性能指标
   */
  static calculatePerformanceMetrics(stats, history) {
    const performance = {
      throughput: this.calculateThroughput(stats, history),
      latency: this.calculateLatency(stats, history),
      errorRate: this.calculateErrorRate(stats),
      utilization: this.calculateUtilization(stats),
      efficiency: this.calculateEfficiency(stats)
    };

    // 计算百分位数
    if (history.length > 10) {
      performance.percentiles = this.calculatePercentiles(history);
    }

    return performance;
  }

  /**
   * 计算吞吐量
   */
  static calculateThroughput(stats, history) {
    const currentThroughput = stats.totalOperations || stats.requests || 0;

    if (history.length < 2) {
      return { current: currentThroughput, average: currentThroughput };
    }

    const recentHistory = history.slice(-10);
    const totalThroughput = recentHistory.reduce((sum, entry) =>
      sum + (entry.stats.totalOperations || entry.stats.requests || 0), 0
    );
    const averageThroughput = totalThroughput / recentHistory.length;

    return {
      current: currentThroughput,
      average: averageThroughput,
      trend: this.calculateTrend(recentHistory.map(h => h.stats.totalOperations || h.stats.requests || 0))
    };
  }

  /**
   * 计算延迟
   */
  static calculateLatency(stats, history) {
    const currentLatency = stats.avgLatency || stats.latency || 0;

    if (history.length < 2) {
      return { current: currentLatency, average: currentLatency };
    }

    const latencies = history.slice(-10).map(h => h.stats.avgLatency || h.stats.latency || 0);
    const averageLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;

    return {
      current: currentLatency,
      average: averageLatency,
      min: Math.min(...latencies),
      max: Math.max(...latencies),
      trend: this.calculateTrend(latencies)
    };
  }

  /**
   * 计算错误率
   */
  static calculateErrorRate(stats) {
    const total = stats.totalOperations || stats.requests || 1;
    const errors = stats.failedOperations || stats.errors || 0;
    const errorRate = (errors / total) * 100;

    return {
      current: errorRate,
      totalErrors: errors,
      totalOperations: total,
      isHealthy: errorRate < 5 // 5%以下认为是健康的
    };
  }

  /**
   * 计算利用率
   */
  static calculateUtilization(stats) {
    const utilization = {
      cpu: stats.cpuUsage || 0,
      memory: stats.memoryUsage || 0,
      connections: stats.activeConnections ? (stats.activeConnections / (stats.maxConnections || 100)) * 100 : 0
    };

    // 计算整体利用率
    const values = Object.values(utilization).filter(v => typeof v === 'number');
    utilization.overall = values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;

    return utilization;
  }

  /**
   * 计算效率
   */
  static calculateEfficiency(stats) {
    const throughput = stats.totalOperations || stats.requests || 0;
    const resourceUsage = (stats.cpuUsage || 0) + (stats.memoryUsage || 0);

    if (resourceUsage === 0) {
      return { score: 0, description: 'No resource usage data available' };
    }

    const efficiency = throughput / resourceUsage;

    let description = 'Low efficiency';
    if (efficiency > 10) description = 'High efficiency';
    else if (efficiency > 5) description = 'Good efficiency';
    else if (efficiency > 2) description = 'Moderate efficiency';

    return {
      score: efficiency,
      description,
      throughput,
      resourceUsage
    };
  }

  /**
   * 计算百分位数
   */
  static calculatePercentiles(history, percentiles = [50, 90, 95, 99]) {
    const latencies = history
      .map(h => h.stats.avgLatency || h.stats.latency)
      .filter(lat => lat !== undefined && lat !== null)
      .sort((a, b) => a - b);

    if (latencies.length === 0) return {};

    const result = {};
    for (const p of percentiles) {
      const index = Math.ceil((p / 100) * latencies.length) - 1;
      result[`p${p}`] = latencies[Math.max(0, Math.min(index, latencies.length - 1))];
    }

    return result;
  }

  /**
   * 计算趋势
   */
  static calculateTrend(values) {
    if (values.length < 3) {
      return { direction: 'insufficient_data', slope: 0, confidence: 0 };
    }

    // 简单线性回归
    const n = values.length;
    const sumX = values.reduce((sum, _, i) => sum + i, 0);
    const sumY = values.reduce((sum, v) => sum + v, 0);
    const sumXY = values.reduce((sum, v, i) => sum + v * i, 0);
    const sumXX = values.reduce((sum, _, i) => sum + i * i, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const direction = slope > 1 ? 'increasing' :
                     slope < -1 ? 'decreasing' : 'stable';
    const confidence = Math.min(Math.abs(slope) * 10, 1);

    return { direction, slope, confidence };
  }

  /**
   * 评估健康状态
   */
  static assessHealthStatus(stats) {
    const health = {
      overall: 'unknown',
      indicators: {},
      issues: [],
      recommendations: []
    };

    // 检查错误率
    const errorRate = this.calculateErrorRate(stats);
    health.indicators.errorRate = {
      value: errorRate.current,
      status: errorRate.isHealthy ? 'healthy' : 'unhealthy'
    };

    if (!errorRate.isHealthy) {
      health.issues.push(`High error rate: ${errorRate.current.toFixed(2)}%`);
      health.recommendations.push('Investigate error causes and implement error handling');
    }

    // 检查延迟
    const latency = stats.avgLatency || stats.latency || 0;
    health.indicators.latency = {
      value: latency,
      status: latency < 1000 ? 'healthy' : latency < 5000 ? 'warning' : 'unhealthy'
    };

    if (latency >= 5000) {
      health.issues.push(`High latency: ${latency}ms`);
      health.recommendations.push('Optimize performance and consider scaling');
    }

    // 检查资源利用率
    const utilization = this.calculateUtilization(stats);
    health.indicators.utilization = {
      value: utilization.overall,
      status: utilization.overall < 70 ? 'healthy' : utilization.overall < 85 ? 'warning' : 'unhealthy'
    };

    if (utilization.overall >= 85) {
      health.issues.push(`High resource utilization: ${utilization.overall.toFixed(1)}%`);
      health.recommendations.push('Monitor resource usage and consider scaling');
    }

    // 确定整体健康状态
    const statuses = Object.values(health.indicators).map(ind => ind.status);
    if (statuses.every(s => s === 'healthy')) {
      health.overall = 'healthy';
    } else if (statuses.some(s => s === 'unhealthy')) {
      health.overall = 'unhealthy';
    } else {
      health.overall = 'warning';
    }

    return health;
  }

  /**
   * 分析趋势
   */
  static analyzeTrends(history, trends) {
    const metrics = ['totalOperations', 'avgLatency', 'errorRate', 'cpuUsage', 'memoryUsage'];
    const analysis = {};

    for (const metric of metrics) {
      const values = history.map(h => h.stats[metric]).filter(v => v !== undefined);
      if (values.length > 2) {
        const trend = this.calculateTrend(values);
        analysis[metric] = trend;

        // 更新趋势历史
        if (!trends.has(metric)) {
          trends.set(metric, []);
        }
        const metricTrends = trends.get(metric);
        metricTrends.push({ timestamp: Date.now(), ...trend });

        // 保留最近的趋势数据
        if (metricTrends.length > 100) {
          metricTrends.splice(0, 50);
        }
      }
    }

    return analysis;
  }

  /**
   * 计算自定义指标
   */
  static calculateCustomMetrics(stats, customMetrics) {
    const result = {};

    for (const [name, calculator] of Object.entries(customMetrics)) {
      try {
        if (typeof calculator === 'function') {
          result[name] = calculator(stats);
        } else {
          // 如果是表达式，尝试简单计算
          result[name] = this.evaluateExpression(calculator, stats);
        }
      } catch (error) {
        logger.warn(`Failed to calculate custom metric ${name}`, {
          error: error.message,
          calculator
        });
        result[name] = null;
      }
    }

    return result;
  }

  /**
   * 评估简单表达式
   */
  static evaluateExpression(expression, stats) {
    // 简化的表达式评估器
    // 支持基本的算术运算和字段访问
    try {
      // 替换字段引用
      const expr = expression.replace(/\$(\w+)/g, (match, field) => {
        const value = stats[field];
        return typeof value === 'number' ? value : 0;
      });

      // 使用Function构造函数评估（注意：这有安全风险，仅用于可信代码）
      return new Function('stats', `return ${expr}`)(stats);
    } catch (error) {
      throw new Error(`Expression evaluation failed: ${error.message}`);
    }
  }

  /**
   * 导出统计数据
   */
  static exportStats(reporter, format = 'json') {
    const summary = reporter.getSummary();
    const history = reporter.getHistory();
    const trends = reporter.getTrends();

    const exportData = {
      summary,
      history,
      trends,
      exportedAt: new Date().toISOString()
    };

    switch (format) {
      case 'json':
        return JSON.stringify(exportData, null, 2);
      case 'csv':
        return this.convertToCSV(exportData);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * 转换为CSV格式
   */
  static convertToCSV(data) {
    // 简化的CSV转换
    const lines = ['timestamp,metric,value'];

    for (const entry of data.history) {
      for (const [key, value] of Object.entries(entry.stats)) {
        if (typeof value === 'number') {
          lines.push(`${entry.timestamp},${key},${value}`);
        }
      }
    }

    return lines.join('\n');
  }
}
