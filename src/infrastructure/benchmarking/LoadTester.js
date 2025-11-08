/**
 * 负载测试器
 * 提供各种负载模式的测试功能
 */

import { PerformanceBenchmark } from './PerformanceBenchmark.js';
import { logger } from '../../shared/utils/logger.js';

export class LoadTester extends PerformanceBenchmark {
  constructor(options = {}) {
    super(options);

    this.loadPatterns = {
      constant: this._constantLoad.bind(this),
      ramp: this._rampLoad.bind(this),
      step: this._stepLoad.bind(this),
      spike: this._spikeLoad.bind(this),
      random: this._randomLoad.bind(this),
      sinusoidal: this._sinusoidalLoad.bind(this),
    };
  }

  /**
   * 运行负载测试
   */
  async runLoadTest(scenario) {
    const {
      name,
      description,
      pattern = 'ramp',
      duration = 60000, // 1分钟
      targetConcurrency = 50,
      setup,
      execute,
      teardown,
      beforeEach,
      afterEach,
      monitoring = {},
    } = scenario;

    logger.info('开始负载测试', { name, pattern, duration, targetConcurrency });

    const results = {
      name,
      description,
      pattern,
      duration,
      targetConcurrency,
      timestamp: new Date().toISOString(),
      phases: [],
      metrics: {},
      monitoring: {},
      analysis: {},
    };

    try {
      // 准备阶段
      if (setup) {
        results.phases.push({
          name: 'setup',
          startTime: Date.now(),
          ...(await this._timePhase(setup)),
        });
      }

      // 负载测试阶段
      const loadResult = await this._runLoadPattern(
        pattern,
        duration,
        targetConcurrency,
        execute,
        beforeEach,
        afterEach,
        monitoring,
      );

      results.phases.push({
        name: 'load_test',
        startTime: Date.now(),
        ...loadResult,
      });

      results.metrics = loadResult.metrics;
      results.monitoring = loadResult.monitoring;

      // 分析阶段
      results.analysis = this._analyzeLoadTest(results);

      // 清理阶段
      if (teardown) {
        results.phases.push({
          name: 'teardown',
          startTime: Date.now(),
          ...(await this._timePhase(teardown)),
        });
      }

      logger.info('负载测试完成', {
        name,
        totalOperations: results.metrics.totalOperations,
        avgThroughput: results.metrics.avgThroughput,
        errorRate: results.metrics.errorRate,
      });

      return results;
    } catch (error) {
      logger.error('负载测试失败', { name, error: error.message });
      results.error = error.message;
      return results;
    }
  }

  /**
   * 运行负载模式
   */
  async _runLoadPattern(
    pattern,
    duration,
    targetConcurrency,
    execute,
    beforeEach,
    afterEach,
    monitoring,
  ) {
    const loadFunction = this.loadPatterns[pattern];
    if (!loadFunction) {
      throw new Error(`Unknown load pattern: ${pattern}`);
    }

    const startTime = Date.now();
    const endTime = startTime + duration;

    const metrics = {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      throughput: [],
      latencies: [],
      concurrency: [],
      errors: [],
      timestamps: [],
    };

    const monitoringData = {
      memory: [],
      cpu: [],
      custom: monitoring.custom || {},
    };

    // 初始化监控
    let monitoringInterval;
    if (monitoring.enabled) {
      monitoringInterval = setInterval(() => {
        const timestamp = Date.now();
        monitoringData.memory.push({
          timestamp,
          ...this._collectMemoryStats(),
        });

        if (monitoring.cpu) {
          monitoringData.cpu.push({
            timestamp,
            usage: process.cpuUsage(),
          });
        }
      }, monitoring.interval || 5000);
    }

    try {
      await loadFunction(
        duration,
        targetConcurrency,
        async (concurrency) => {
          // 执行并发操作
          const batchStart = Date.now();
          const operations = Array(concurrency)
            .fill()
            .map(async () => {
              const opStart = process.hrtime.bigint();

              try {
                if (beforeEach) await beforeEach();
                await execute();
                if (afterEach) await afterEach();

                const opEnd = process.hrtime.bigint();
                const latency = Number(opEnd - opStart) / 1000000; // 毫秒

                return { success: true, latency };
              } catch (error) {
                return { success: false, error: error.message };
              }
            });

          const results = await Promise.all(operations);
          const batchEnd = Date.now();
          const batchDuration = batchEnd - batchStart;

          // 记录指标
          const successful = results.filter((r) => r.success).length;
          const failed = results.filter((r) => !r.success).length;
          const latencies = results
            .filter((r) => r.success)
            .map((r) => r.latency);

          metrics.totalOperations += concurrency;
          metrics.successfulOperations += successful;
          metrics.failedOperations += failed;
          metrics.throughput.push(concurrency / (batchDuration / 1000)); // 操作/秒
          metrics.latencies.push(...latencies);
          metrics.concurrency.push(concurrency);
          metrics.timestamps.push(batchEnd);

          // 记录错误
          results
            .filter((r) => !r.success)
            .forEach((r) => {
              metrics.errors.push({
                timestamp: batchEnd,
                error: r.error,
              });
            });
        },
        endTime,
      );

      // 计算最终指标
      const totalTime = Date.now() - startTime;
      metrics.avgThroughput =
        metrics.throughput.reduce((sum, t) => sum + t, 0) /
        metrics.throughput.length;
      metrics.errorRate =
        (metrics.failedOperations / metrics.totalOperations) * 100;
      metrics.latencyStats = this._calculateLatencies(metrics.latencies);

      return {
        duration: totalTime,
        metrics,
        monitoring: monitoringData,
      };
    } finally {
      if (monitoringInterval) {
        clearInterval(monitoringInterval);
      }
    }
  }

  /**
   * 恒定负载模式
   */
  async _constantLoad(duration, targetConcurrency, executeBatch, endTime) {
    const interval = 1000; // 1秒间隔

    while (Date.now() < endTime && this.isRunning) {
      await executeBatch(targetConcurrency);
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  }

  /**
   * 渐进负载模式
   */
  async _rampLoad(duration, targetConcurrency, executeBatch, endTime) {
    const rampUpTime = duration * 0.3; // 30%时间用于预热
    const steadyTime = duration * 0.6; // 60%时间保持峰值
    const rampDownTime = duration * 0.1; // 10%时间降低负载

    const startTime = Date.now();
    const rampUpEnd = startTime + rampUpTime;
    const steadyEnd = rampUpEnd + steadyTime;

    while (Date.now() < endTime && this.isRunning) {
      const now = Date.now();
      let currentConcurrency;

      if (now < rampUpEnd) {
        // 预热阶段：线性增加
        const progress = (now - startTime) / rampUpTime;
        currentConcurrency = Math.max(
          1,
          Math.floor(targetConcurrency * progress),
        );
      } else if (now < steadyEnd) {
        // 稳定阶段：保持峰值
        currentConcurrency = targetConcurrency;
      } else {
        // 降温阶段：线性减少
        const progress = (now - steadyEnd) / rampDownTime;
        currentConcurrency = Math.max(
          1,
          Math.floor(targetConcurrency * (1 - progress)),
        );
      }

      await executeBatch(currentConcurrency);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  /**
   * 阶梯负载模式
   */
  async _stepLoad(duration, targetConcurrency, executeBatch, endTime) {
    const steps = 5;
    const stepDuration = duration / steps;
    const concurrencyStep = targetConcurrency / steps;

    for (
      let step = 1;
      step <= steps && Date.now() < endTime && this.isRunning;
      step++
    ) {
      const stepConcurrency = Math.floor(concurrencyStep * step);
      const stepEndTime = Date.now() + stepDuration;

      while (
        Date.now() < stepEndTime &&
        Date.now() < endTime &&
        this.isRunning
      ) {
        await executeBatch(stepConcurrency);
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }
  }

  /**
   * 峰值负载模式
   */
  async _spikeLoad(duration, targetConcurrency, executeBatch, endTime) {
    const spikeInterval = 10000; // 10秒间隔
    const spikeDuration = 2000; // 2秒峰值
    const baseConcurrency = Math.floor(targetConcurrency * 0.2); // 基础负载20%

    while (Date.now() < endTime && this.isRunning) {
      // 正常负载
      await executeBatch(baseConcurrency);
      await new Promise((resolve) =>
        setTimeout(resolve, spikeInterval - spikeDuration),
      );

      // 峰值负载
      const spikeEnd = Date.now() + spikeDuration;
      while (Date.now() < spikeEnd && Date.now() < endTime && this.isRunning) {
        await executeBatch(targetConcurrency);
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }
  }

  /**
   * 随机负载模式
   */
  async _randomLoad(duration, targetConcurrency, executeBatch, endTime) {
    while (Date.now() < endTime && this.isRunning) {
      // 随机并发数 (10%-100%)
      const concurrency = Math.max(
        1,
        Math.floor(targetConcurrency * (0.1 + Math.random() * 0.9)),
      );
      await executeBatch(concurrency);

      // 随机间隔 (100-500ms)
      const delay = 100 + Math.random() * 400;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  /**
   * 正弦负载模式
   */
  async _sinusoidalLoad(duration, targetConcurrency, executeBatch, endTime) {
    const startTime = Date.now();

    while (Date.now() < endTime && this.isRunning) {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / duration;

      // 使用正弦函数创建波形负载
      const sineValue = Math.sin(progress * Math.PI * 4); // 2个完整周期
      const concurrency = Math.max(
        1,
        Math.floor(targetConcurrency * (0.5 + 0.4 * sineValue)),
      );

      await executeBatch(concurrency);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  /**
   * 分析负载测试结果
   */
  _analyzeLoadTest(results) {
    const analysis = {
      performance: {},
      stability: {},
      bottlenecks: [],
      recommendations: [],
    };

    const metrics = results.metrics;

    // 性能分析
    analysis.performance = {
      totalThroughput: metrics.avgThroughput,
      peakThroughput: Math.max(...metrics.throughput),
      avgLatency: metrics.latencyStats?.mean || 0,
      percentile95: metrics.latencyStats?.p95 || 0,
      errorRate: metrics.errorRate,
      totalOperations: metrics.totalOperations,
    };

    // 稳定性分析
    const throughputVariance = this._calculateVariance(metrics.throughput);
    const latencyVariance = this._calculateVariance(metrics.latencies);

    analysis.stability = {
      throughputStability: throughputVariance / (metrics.avgThroughput || 1),
      latencyStability: latencyVariance / (metrics.latencyStats?.mean || 1),
      errorDistribution: this._analyzeErrorDistribution(metrics.errors),
    };

    // 识别瓶颈
    if (metrics.errorRate > 10) {
      analysis.bottlenecks.push({
        type: 'high_error_rate',
        severity: 'high',
        message: `错误率过高: ${metrics.errorRate.toFixed(2)}%`,
      });
    }

    if (analysis.stability.throughputStability > 0.5) {
      analysis.bottlenecks.push({
        type: 'throughput_instability',
        severity: 'medium',
        message: '吞吐量不稳定，可能存在资源竞争',
      });
    }

    if (metrics.latencyStats?.p95 > 1000) {
      analysis.bottlenecks.push({
        type: 'high_latency',
        severity: 'medium',
        message: `95%分位延迟过高: ${metrics.latencyStats.p95.toFixed(2)}ms`,
      });
    }

    // 生成建议
    analysis.recommendations = this._generateLoadTestRecommendations(analysis);

    return analysis;
  }

  /**
   * 计算方差
   */
  _calculateVariance(values) {
    if (values.length === 0) return 0;

    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance =
      values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;

    return variance;
  }

  /**
   * 分析错误分布
   */
  _analyzeErrorDistribution(errors) {
    const distribution = {};
    const timeWindows = {};

    // 按时间窗口分组错误
    errors.forEach((error) => {
      const window = Math.floor(error.timestamp / 10000) * 10000; // 10秒窗口
      timeWindows[window] = (timeWindows[window] || 0) + 1;

      const errorType = error.error.split(':')[0];
      distribution[errorType] = (distribution[errorType] || 0) + 1;
    });

    return {
      byType: distribution,
      byTime: timeWindows,
      burstPeriods: Object.entries(timeWindows)
        .filter(([, count]) => count > 5)
        .map(([window, count]) => ({ window: parseInt(window), count })),
    };
  }

  /**
   * 生成负载测试建议
   */
  _generateLoadTestRecommendations(analysis) {
    const recommendations = [];

    const perf = analysis.performance;
    const stability = analysis.stability;

    if (perf.errorRate > 5) {
      recommendations.push({
        type: 'reliability',
        priority: 'high',
        message: '需要改进错误处理和系统稳定性',
        actions: [
          '增加超时重试机制',
          '优化资源管理',
          '增加熔断器保护',
          '改善错误恢复能力',
        ],
      });
    }

    if (stability.throughputStability > 0.3) {
      recommendations.push({
        type: 'performance',
        priority: 'medium',
        message: '系统吞吐量不稳定，需要优化',
        actions: ['检查资源竞争情况', '优化锁机制', '增加缓存层', '使用连接池'],
      });
    }

    if (perf.percentile95 > 500) {
      recommendations.push({
        type: 'latency',
        priority: 'medium',
        message: '系统延迟较高',
        actions: ['优化数据库查询', '增加缓存', '使用异步处理', '优化网络调用'],
      });
    }

    if (stability.errorDistribution.burstPeriods.length > 0) {
      recommendations.push({
        type: 'burst_handling',
        priority: 'high',
        message: '存在错误爆发期，需要改进突发负载处理',
        actions: [
          '实现请求队列',
          '添加负载均衡',
          '使用熔断器模式',
          '增加自动扩容',
        ],
      });
    }

    return recommendations;
  }

  /**
   * 创建预定义测试场景
   */
  static createScenario(name, config) {
    return {
      name,
      description: config.description,
      pattern: config.pattern || 'ramp',
      duration: config.duration || 30000,
      targetConcurrency: config.targetConcurrency || 50,
      monitoring: {
        enabled: true,
        interval: 5000,
        cpu: true,
        custom: config.customMonitoring || {},
        ...config.monitoring,
      },
      ...config,
    };
  }

  /**
   * 运行多场景测试
   */
  async runMultiScenarioTest(scenarios) {
    const results = {
      timestamp: new Date().toISOString(),
      scenarios: [],
      comparison: {},
    };

    for (const scenario of scenarios) {
      logger.info('运行测试场景', { name: scenario.name });
      const result = await this.runLoadTest(scenario);
      results.scenarios.push(result);
    }

    // 生成场景对比
    results.comparison = this._compareScenarios(results.scenarios);

    return results;
  }

  /**
   * 对比多个场景
   */
  _compareScenarios(scenarios) {
    if (scenarios.length === 0) return {};

    const comparison = {
      bestPerformer: null,
      worstPerformer: null,
      throughputRanking: [],
      latencyRanking: [],
      stabilityRanking: [],
    };

    const rankings = scenarios.map((scenario) => ({
      name: scenario.name,
      throughput: scenario.metrics.avgThroughput,
      latency: scenario.metrics.latencyStats?.mean || 0,
      errorRate: scenario.metrics.errorRate,
      stability: 1 - scenario.metrics.errorRate / 100, // 简化的稳定性指标
    }));

    // 排序
    comparison.throughputRanking = rankings.sort(
      (a, b) => b.throughput - a.throughput,
    );
    comparison.latencyRanking = rankings.sort((a, b) => a.latency - b.latency);
    comparison.stabilityRanking = rankings.sort(
      (a, b) => b.stability - a.stability,
    );

    comparison.bestPerformer = comparison.throughputRanking[0];
    comparison.worstPerformer =
      comparison.throughputRanking[comparison.throughputRanking.length - 1];

    return comparison;
  }
}

export default LoadTester;
