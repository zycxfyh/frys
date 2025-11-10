/**
 * 性能基准测试
 * 提供全面的性能测试和基准分析功能
 */

import { EventEmitter } from 'events';
import { logger } from '../../shared/utils/logger.js';

export class PerformanceBenchmark extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      warmupIterations: options.warmupIterations || 100,
      measurementIterations: options.measurementIterations || 1000,
      concurrencyLevels: options.concurrencyLevels || [1, 5, 10, 25, 50, 100],
      duration: options.duration || 30000, // 30秒
      rampUpTime: options.rampUpTime || 5000, // 5秒
      coolDownTime: options.coolDownTime || 2000, // 2秒
      percentiles: options.percentiles || [50, 90, 95, 99, 99.9],
      enableGc: options.enableGc !== false,
      collectMemoryStats: options.collectMemoryStats !== false,

      // 高级性能基准算法配置
      adaptiveLoadGeneration: options.adaptiveLoadGeneration !== false,
      intelligentWarmup: options.intelligentWarmup !== false,
      statisticalAnalysis: options.statisticalAnalysis !== false,
      regressionDetection: options.regressionDetection !== false,
      bottleneckAnalysis: options.bottleneckAnalysis !== false,
      predictiveModeling: options.predictiveModeling !== false,
      comparativeAnalysis: options.comparativeAnalysis !== false,
      anomalyDetection: options.anomalyDetection !== false,

      ...options,
    };

    // 高级数据结构
    this.historicalData = new Map(); // 历史基准数据
    this.baselineMetrics = new Map(); // 基准指标
    this.performanceModels = new Map(); // 性能预测模型
    this.anomalyPatterns = new Map(); // 异常模式
    this.bottleneckIndicators = new Map(); // 瓶颈指标
    this.regressionHistory = new Map(); // 回归历史

    // 自适应算法参数
    this.adaptiveParams = {
      confidenceLevel: 0.95,
      statisticalSignificance: 0.05,
      minimumSampleSize: 30,
      outlierThreshold: 3.0, // 标准差倍数
      trendWindow: 10, // 趋势分析窗口
    };

    this.results = {
      metadata: {
        timestamp: new Date().toISOString(),
        options: this.options,
      },
      benchmarks: new Map(),
      system: {},
      recommendations: [],
      advanced: {
        regressions: [],
        anomalies: [],
        bottlenecks: [],
        predictions: [],
        comparisons: [],
      },
    };

    this.isRunning = false;
  }

  /**
   * 运行基准测试套件
   */
  async runBenchmarkSuite(suiteName, benchmarks) {
    logger.info('开始运行基准测试套件', {
      suiteName,
      benchmarkCount: benchmarks.length,
    });

    this.isRunning = true;
    this.results.metadata.suiteName = suiteName;
    this.results.system = this._collectSystemInfo();

    try {
      for (const benchmark of benchmarks) {
        if (!this.isRunning) break;

        const result = await this.runBenchmark(benchmark);
        this.results.benchmarks.set(benchmark.name, result);

        this.emit('benchmarkComplete', { benchmark: benchmark.name, result });
      }

      // 生成分析报告
      this.results.analysis = this._analyzeResults();
      this.results.recommendations = this._generateRecommendations();

      logger.info('基准测试套件完成', {
        suiteName,
        benchmarksRun: this.results.benchmarks.size,
      });

      return this.results;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * 运行单个基准测试
   */
  async runBenchmark(benchmark) {
    const {
      name,
      description,
      setup,
      execute,
      teardown,
      beforeEach,
      afterEach,
    } = benchmark;

    logger.info('开始运行智能基准测试', { name, description });

    const result = {
      name,
      description,
      timestamp: new Date().toISOString(),
      metrics: {},
      errors: [],
      phases: {},
      advanced: {
        anomalies: [],
        regressions: [],
        predictions: [],
        bottlenecks: [],
      },
    };

    try {
      // 智能准备阶段
      result.phases.setup = await this._timePhase(async () => {
        if (setup) await setup();
        // 应用智能配置
        if (this.options.adaptiveLoadGeneration) {
          await this._configureAdaptiveLoad(name);
        }
      });

      // 智能预热阶段
      result.phases.warmup = await this._timePhase(async () => {
        const warmupIterations = this.options.intelligentWarmup
          ? await this._calculateOptimalWarmupIterations(name)
          : this.options.warmupIterations;

        for (let i = 0; i < warmupIterations; i++) {
          if (beforeEach) await beforeEach();
          await execute();
          if (afterEach) await afterEach();
        }
      });

      // 测量阶段 - 不同并发级别
      result.phases.measurement = {};
      for (const concurrency of this.options.concurrencyLevels) {
        if (!this.isRunning) break;

        const concurrencyResult = await this._runConcurrencyTest(
          concurrency,
          execute,
          beforeEach,
          afterEach,
        );

        result.phases.measurement[concurrency] = concurrencyResult;
        result.metrics[`concurrency_${concurrency}`] = concurrencyResult;

        this.emit('concurrencyComplete', {
          benchmark: name,
          concurrency,
          result: concurrencyResult,
        });
      }

      // 压力测试阶段
      if (this.options.duration > 0) {
        result.phases.stress = await this._runStressTest(
          execute,
          beforeEach,
          afterEach,
        );
        result.metrics.stress = result.phases.stress;
      }

      // 清理阶段
      result.phases.teardown = await this._timePhase(async () => {
        if (teardown) await teardown();
      });

      // 计算总体指标
      result.metrics.summary = this._calculateSummaryMetrics(result);
    } catch (error) {
      result.errors.push({
        phase: 'benchmark',
        error: error.message,
        stack: error.stack,
      });
      logger.error('基准测试失败', { name, error: error.message });
    }

    return result;
  }

  /**
   * 运行并发测试
   */
  async _runConcurrencyTest(concurrency, execute, beforeEach, afterEach) {
    const results = [];
    const errors = [];
    const startTime = Date.now();

    // 创建并发任务
    const tasks = Array(concurrency)
      .fill()
      .map(async (_, index) => {
        const taskResults = [];

        try {
          for (let i = 0; i < this.options.measurementIterations; i++) {
            const iterationStart = process.hrtime.bigint();

            try {
              if (beforeEach) await beforeEach();
              await execute();
              if (afterEach) await afterEach();

              const iterationEnd = process.hrtime.bigint();
              const duration = Number(iterationEnd - iterationStart) / 1000000; // 转换为毫秒

              taskResults.push(duration);
            } catch (error) {
              errors.push({ iteration: i, error: error.message });
              taskResults.push(null); // 记录失败的迭代
            }
          }
        } catch (error) {
          errors.push({ task: index, error: error.message });
        }

        return taskResults;
      });

    // 等待所有任务完成
    const taskResults = await Promise.all(tasks);
    const totalTime = Date.now() - startTime;

    // 合并结果
    const allDurations = taskResults
      .flat()
      .filter((duration) => duration !== null);

    return {
      concurrency,
      totalTime,
      iterations: allDurations.length,
      throughput: allDurations.length / (totalTime / 1000), // 操作/秒
      latencies: this._calculateLatencies(allDurations),
      errors,
      memoryUsage: this._collectMemoryStats(),
    };
  }

  /**
   * 运行压力测试
   */
  async _runStressTest(execute, beforeEach, afterEach) {
    const results = [];
    const errors = [];
    const startTime = Date.now();
    const endTime = startTime + this.options.duration;
    let iterations = 0;

    // 渐进式负载增加
    const rampUpEnd = startTime + this.options.rampUpTime;
    let currentConcurrency = 1;
    const maxConcurrency = Math.max(...this.options.concurrencyLevels);

    while (Date.now() < endTime && this.isRunning) {
      const now = Date.now();
      const progress = (now - startTime) / this.options.duration;

      // 根据进度调整并发度
      if (now < rampUpEnd) {
        // 预热阶段：线性增加并发
        const rampProgress = (now - startTime) / this.options.rampUpTime;
        currentConcurrency = Math.max(
          1,
          Math.floor(maxConcurrency * rampProgress),
        );
      } else {
        // 满载阶段：保持最大并发
        currentConcurrency = maxConcurrency;
      }

      // 执行一批操作
      const batchPromises = Array(currentConcurrency)
        .fill()
        .map(async () => {
          const iterationStart = process.hrtime.bigint();

          try {
            if (beforeEach) await beforeEach();
            await execute();
            if (afterEach) await afterEach();

            const iterationEnd = process.hrtime.bigint();
            const duration = Number(iterationEnd - iterationStart) / 1000000;

            results.push(duration);
            return { success: true, duration };
          } catch (error) {
            errors.push({ error: error.message, timestamp: now });
            return { success: false, error: error.message };
          }
        });

      await Promise.all(batchPromises);
      iterations += currentConcurrency;

      // 小延迟避免过度消耗CPU
      await new Promise((resolve) => setTimeout(resolve, 1));
    }

    const totalTime = Date.now() - startTime;
    const successfulOperations = results.length;

    return {
      duration: totalTime,
      totalIterations: iterations,
      successfulIterations: successfulOperations,
      failedIterations: errors.length,
      throughput: successfulOperations / (totalTime / 1000),
      avgLatency:
        results.reduce((sum, duration) => sum + duration, 0) / results.length,
      latencies: this._calculateLatencies(results),
      errors,
      concurrencyProfile: {
        maxConcurrency,
        rampUpTime: this.options.rampUpTime,
        steadyStateTime: totalTime - this.options.rampUpTime,
      },
      memoryUsage: this._collectMemoryStats(),
    };
  }

  /**
   * 计算延迟统计
   */
  _calculateLatencies(durations) {
    if (durations.length === 0) return {};

    const sorted = durations.sort((a, b) => a - b);

    const latencies = {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean: sorted.reduce((sum, d) => sum + d, 0) / sorted.length,
      median: sorted[Math.floor(sorted.length / 2)],
    };

    // 计算百分位数
    for (const percentile of this.options.percentiles) {
      const index = Math.floor((percentile / 100) * (sorted.length - 1));
      latencies[`p${percentile}`] = sorted[index];
    }

    return latencies;
  }

  /**
   * 计时阶段执行
   */
  async _timePhase(phaseFn) {
    const startTime = process.hrtime.bigint();
    const startMemory = this._collectMemoryStats();

    try {
      await phaseFn();

      const endTime = process.hrtime.bigint();
      const endMemory = this._collectMemoryStats();

      return {
        duration: Number(endTime - startTime) / 1000000, // 毫秒
        memoryDelta: {
          rss: endMemory.rss - startMemory.rss,
          heapUsed: endMemory.heapUsed - startMemory.heapUsed,
          heapTotal: endMemory.heapTotal - startMemory.heapTotal,
        },
      };
    } catch (error) {
      const endTime = process.hrtime.bigint();
      return {
        duration: Number(endTime - startTime) / 1000000,
        error: error.message,
      };
    }
  }

  /**
   * 收集内存统计
   */
  _collectMemoryStats() {
    const memUsage = process.memoryUsage();
    return {
      rss: memUsage.rss,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      arrayBuffers: memUsage.arrayBuffers || 0,
    };
  }

  /**
   * 收集系统信息
   */
  _collectSystemInfo() {
    const os = require('os');

    return {
      platform: os.platform(),
      arch: os.arch(),
      release: os.release(),
      cpuCount: os.cpus().length,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      loadAverage: os.loadavg(),
      nodeVersion: process.version,
      v8Version: process.versions.v8,
    };
  }

  /**
   * 计算汇总指标
   */
  _calculateSummaryMetrics(benchmarkResult) {
    const summary = {
      bestConcurrency: 0,
      bestThroughput: 0,
      optimalConcurrency: 0,
      scalingEfficiency: 0,
      errorRate: 0,
    };

    let totalOperations = 0;
    let totalErrors = 0;
    let maxThroughput = 0;

    // 分析不同并发级别的性能
    for (const [concurrency, result] of Object.entries(
      benchmarkResult.metrics,
    )) {
      if (concurrency.startsWith('concurrency_')) {
        const level = parseInt(concurrency.split('_')[1]);
        const throughput = result.throughput || 0;
        const errors = result.errors?.length || 0;

        totalOperations += result.iterations || 0;
        totalErrors += errors;

        if (throughput > maxThroughput) {
          maxThroughput = throughput;
          summary.bestConcurrency = level;
          summary.bestThroughput = throughput;
        }

        // 计算扩展效率（每增加一个并发线程的吞吐量提升）
        if (level > 1) {
          const previousResult =
            benchmarkResult.metrics[`concurrency_${level - 1}`];
          if (previousResult) {
            const efficiency =
              (throughput - (previousResult.throughput || 0)) / throughput;
            summary.scalingEfficiency += efficiency;
          }
        }
      }
    }

    summary.optimalConcurrency = summary.bestConcurrency;
    summary.scalingEfficiency =
      summary.scalingEfficiency /
      Math.max(1, this.options.concurrencyLevels.length - 1);
    summary.errorRate =
      totalOperations > 0 ? (totalErrors / totalOperations) * 100 : 0;

    return summary;
  }

  /**
   * 分析结果
   */
  _analyzeResults() {
    const analysis = {
      performance: {},
      bottlenecks: [],
      scalability: {},
      recommendations: [],
    };

    // 分析性能特征
    for (const [name, result] of this.results.benchmarks) {
      const summary = result.metrics.summary;

      analysis.performance[name] = {
        optimalConcurrency: summary.optimalConcurrency,
        bestThroughput: summary.bestThroughput,
        scalingEfficiency: summary.scalingEfficiency,
        errorRate: summary.errorRate,
      };

      // 识别瓶颈
      if (summary.scalingEfficiency < 0.5) {
        analysis.bottlenecks.push({
          benchmark: name,
          type: 'poor_scalability',
          message: '扩展效率低下，可能存在资源竞争或锁竞争',
        });
      }

      if (summary.errorRate > 5) {
        analysis.bottlenecks.push({
          benchmark: name,
          type: 'high_error_rate',
          message: `错误率过高: ${summary.errorRate.toFixed(2)}%`,
        });
      }
    }

    // 分析可扩展性
    const concurrencyLevels = this.options.concurrencyLevels;
    const throughputByConcurrency = new Map();

    for (const [name, result] of this.results.benchmarks) {
      for (const [key, metrics] of Object.entries(result.metrics)) {
        if (key.startsWith('concurrency_')) {
          const concurrency = parseInt(key.split('_')[1]);
          const throughput = metrics.throughput || 0;

          if (!throughputByConcurrency.has(concurrency)) {
            throughputByConcurrency.set(concurrency, []);
          }
          throughputByConcurrency.get(concurrency).push(throughput);
        }
      }
    }

    // 计算平均吞吐量
    const avgThroughputByConcurrency = [];
    for (const concurrency of concurrencyLevels) {
      const throughputs = throughputByConcurrency.get(concurrency) || [];
      if (throughputs.length > 0) {
        avgThroughputByConcurrency.push({
          concurrency,
          throughput:
            throughputs.reduce((sum, t) => sum + t, 0) / throughputs.length,
        });
      }
    }

    analysis.scalability = {
      throughputCurve: avgThroughputByConcurrency,
      kneePoint: this._findKneePoint(avgThroughputByConcurrency),
      maxSustainableConcurrency: this._findMaxSustainableConcurrency(
        avgThroughputByConcurrency,
      ),
    };

    return analysis;
  }

  /**
   * 生成建议
   */
  _generateRecommendations() {
    const recommendations = [];
    const analysis = this.results.analysis;

    // 基于性能分析生成建议
    for (const [benchmarkName, perf] of Object.entries(analysis.performance)) {
      if (perf.scalingEfficiency < 0.7) {
        recommendations.push({
          type: 'optimization',
          priority: 'high',
          benchmark: benchmarkName,
          message: '考虑优化资源竞争或锁竞争问题',
          actions: [
            '检查数据库连接池配置',
            '优化缓存策略',
            '考虑使用连接池或对象池',
            '检查是否有不必要的同步操作',
          ],
        });
      }

      if (perf.errorRate > 2) {
        recommendations.push({
          type: 'reliability',
          priority: 'high',
          benchmark: benchmarkName,
          message: `需要降低错误率 (${perf.errorRate.toFixed(2)}%)`,
          actions: [
            '检查错误处理逻辑',
            '增加超时重试机制',
            '优化资源管理',
            '监控系统资源使用情况',
          ],
        });
      }

      if (perf.optimalConcurrency < this.options.concurrencyLevels[0]) {
        recommendations.push({
          type: 'configuration',
          priority: 'medium',
          benchmark: benchmarkName,
          message: '考虑降低默认并发配置以节省资源',
          actions: ['调整线程池大小', '优化连接池配置', '检查资源限制设置'],
        });
      }
    }

    // 基于可扩展性分析生成建议
    const scalability = analysis.scalability;
    if (scalability.kneePoint) {
      recommendations.push({
        type: 'scaling',
        priority: 'medium',
        message: `系统拐点出现在 ${scalability.kneePoint.concurrency} 并发`,
        actions: [
          `生产环境并发数建议不超过 ${scalability.kneePoint.concurrency}`,
          '考虑在拐点附近设置自动扩容阈值',
          '监控系统在高并发下的稳定性',
        ],
      });
    }

    if (scalability.maxSustainableConcurrency) {
      recommendations.push({
        type: 'capacity',
        priority: 'medium',
        message: `系统最大可持续并发数约为 ${scalability.maxSustainableConcurrency}`,
        actions: [
          '基于此并发数规划系统容量',
          '设置适当的负载均衡策略',
          '准备水平扩展方案',
        ],
      });
    }

    return recommendations;
  }

  /**
   * 查找拐点（性能开始下降的点）
   */
  _findKneePoint(throughputCurve) {
    if (throughputCurve.length < 3) return null;

    let maxEfficiency = 0;
    let kneePoint = null;

    for (let i = 1; i < throughputCurve.length - 1; i++) {
      const prev = throughputCurve[i - 1];
      const current = throughputCurve[i];
      const next = throughputCurve[i + 1];

      // 计算边际效率
      const efficiency1 =
        (current.throughput - prev.throughput) / prev.throughput;
      const efficiency2 =
        (next.throughput - current.throughput) / current.throughput;

      // 拐点：效率开始显著下降
      if (efficiency1 > 0.1 && efficiency2 < efficiency1 * 0.5) {
        if (efficiency1 > maxEfficiency) {
          maxEfficiency = efficiency1;
          kneePoint = current;
        }
      }
    }

    return kneePoint;
  }

  /**
   * 查找最大可持续并发数
   */
  _findMaxSustainableConcurrency(throughputCurve) {
    if (throughputCurve.length === 0) return null;

    // 找到吞吐量开始下降的点
    let maxThroughput = 0;
    let maxConcurrency = 0;

    for (const point of throughputCurve) {
      if (point.throughput > maxThroughput) {
        maxThroughput = point.throughput;
        maxConcurrency = point.concurrency;
      }
    }

    return maxConcurrency;
  }

  /**
   * 停止基准测试
   */
  stop() {
    this.isRunning = false;
    this.emit('stopped');
  }

  /**
   * 导出结果
   */
  exportResults(format = 'json') {
    switch (format) {
      case 'json':
        return JSON.stringify(this.results, null, 2);
      case 'csv':
        return this._exportToCSV();
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * 导出为CSV
   */
  _exportToCSV() {
    const lines = [
      'Benchmark,Concurrency,Throughput,Latency_p50,Latency_p95,Latency_p99,Errors',
    ];

    for (const [name, result] of this.results.benchmarks) {
      for (const [key, metrics] of Object.entries(result.metrics)) {
        if (key.startsWith('concurrency_')) {
          const concurrency = key.split('_')[1];
          const throughput = metrics.throughput || 0;
          const p50 = metrics.latencies?.p50 || 0;
          const p95 = metrics.latencies?.p95 || 0;
          const p99 = metrics.latencies?.p99 || 0;
          const errors = metrics.errors?.length || 0;

          lines.push(
            `${name},${concurrency},${throughput},${p50},${p95},${p99},${errors}`,
          );
        }
      }
    }

    return lines.join('\n');
  }

  // =============== 高级性能基准算法实现 ===============

  /**
   * 配置自适应负载生成
   */
  async _configureAdaptiveLoad(benchmarkName) {
    const baseline = this.baselineMetrics.get(benchmarkName);
    if (!baseline) return;

    // 基于历史数据调整负载生成参数
    const recentHistory = this.historicalData.get(benchmarkName) || [];
    if (recentHistory.length > 5) {
      const avgPerformance = this._calculateAveragePerformance(recentHistory);

      // 动态调整并发级别
      this.options.concurrencyLevels = this._optimizeConcurrencyLevels(
        this.options.concurrencyLevels,
        avgPerformance
      );

      logger.debug('自适应负载配置已调整', {
        benchmarkName,
        newConcurrencyLevels: this.options.concurrencyLevels,
      });
    }
  }

  /**
   * 计算最优预热迭代次数
   */
  async _calculateOptimalWarmupIterations(benchmarkName) {
    const history = this.historicalData.get(benchmarkName) || [];
    if (history.length < 3) {
      return this.options.warmupIterations; // 使用默认值
    }

    // 分析历史数据中的预热效果
    const warmupEffects = history.map(h => h.warmupEffect || 0);
    const avgWarmupEffect = warmupEffects.reduce((a, b) => a + b, 0) / warmupEffects.length;

    // 根据预热效果调整迭代次数
    let optimalIterations = this.options.warmupIterations;

    if (avgWarmupEffect > 0.8) {
      // 预热效果好，减少迭代次数
      optimalIterations = Math.max(10, Math.floor(this.options.warmupIterations * 0.7));
    } else if (avgWarmupEffect < 0.3) {
      // 预热效果差，增加迭代次数
      optimalIterations = Math.min(500, Math.floor(this.options.warmupIterations * 1.5));
    }

    return optimalIterations;
  }

  /**
   * 执行智能测量阶段
   */
  async _executeIntelligentMeasurement(benchmark, result) {
    const measurementStrategies = [];

    if (this.options.adaptiveLoadGeneration) {
      measurementStrategies.push('adaptive');
    }

    if (this.options.statisticalAnalysis) {
      measurementStrategies.push('statistical');
    }

    if (measurementStrategies.includes('adaptive')) {
      return await this._executeAdaptiveMeasurement(benchmark, result);
    } else if (measurementStrategies.includes('statistical')) {
      return await this._executeStatisticalMeasurement(benchmark, result);
    } else {
      return await this._executeStandardMeasurement(benchmark, result);
    }
  }

  /**
   * 执行自适应测量
   */
  async _executeAdaptiveMeasurement(benchmark, result) {
    const measurements = [];
    let currentConcurrency = 1;
    const maxConcurrency = Math.max(...this.options.concurrencyLevels);

    // 动态调整并发级别
    while (currentConcurrency <= maxConcurrency && this.isRunning) {
      const measurement = await this._measureAtConcurrency(benchmark, currentConcurrency, result);

      measurements.push({
        concurrency: currentConcurrency,
        ...measurement,
      });

      // 基于测量结果调整下一个并发级别
      const nextConcurrency = this._calculateNextConcurrencyLevel(
        currentConcurrency,
        measurement,
        measurements
      );

      if (nextConcurrency <= currentConcurrency) break; // 性能开始下降
      currentConcurrency = nextConcurrency;
    }

    return measurements;
  }

  /**
   * 计算下一个并发级别
   */
  _calculateNextConcurrencyLevel(currentConcurrency, measurement, history) {
    const recentMeasurements = history.slice(-3);

    if (recentMeasurements.length < 2) {
      // 初始阶段，保守增加
      return currentConcurrency * 2;
    }

    // 分析趋势
    const throughputTrend = this._calculateTrend(recentMeasurements, 'throughput');
    const latencyTrend = this._calculateTrend(recentMeasurements, 'avgLatency');

    if (throughputTrend < -0.1 || latencyTrend > 0.2) {
      // 性能下降，停止增加并发
      return currentConcurrency;
    } else if (throughputTrend > 0.1) {
      // 性能上升，加速增加
      return Math.min(currentConcurrency * 3, currentConcurrency + 20);
    } else {
      // 性能稳定，正常增加
      return Math.min(currentConcurrency * 1.5, currentConcurrency + 10);
    }
  }

  /**
   * 执行统计测量
   */
  async _executeStatisticalMeasurement(benchmark, result) {
    const measurements = [];

    for (const concurrency of this.options.concurrencyLevels) {
      if (!this.isRunning) break;

      // 多次测量以获得统计意义
      const samples = [];
      const sampleCount = Math.max(this.adaptiveParams.minimumSampleSize, 10);

      for (let i = 0; i < sampleCount; i++) {
        const sample = await this._measureAtConcurrency(benchmark, concurrency, result);
        samples.push(sample);

        // 检查是否需要提前停止（统计收敛）
        if (i >= this.adaptiveParams.minimumSampleSize) {
          const stats = this._calculateSampleStatistics(samples);
          if (stats.confidenceInterval < 0.05) { // 置信区间足够小
            break;
          }
        }
      }

      measurements.push({
        concurrency,
        samples,
        statistics: this._calculateSampleStatistics(samples),
      });
    }

    return measurements;
  }

  /**
   * 执行标准测量
   */
  async _executeStandardMeasurement(benchmark, result) {
    const measurements = [];

    for (const concurrency of this.options.concurrencyLevels) {
      if (!this.isRunning) break;

      const measurement = await this._measureAtConcurrency(benchmark, concurrency, result);
      measurements.push({
        concurrency,
        ...measurement,
      });
    }

    return measurements;
  }

  /**
   * 在指定并发级别下进行测量
   */
  async _measureAtConcurrency(benchmark, concurrency, result) {
    const startTime = Date.now();
    const latencies = [];
    const errors = [];

    // 创建并发执行器
    const workers = [];
    for (let i = 0; i < concurrency; i++) {
      workers.push(this._createWorker(benchmark, result));
    }

    // 等待测量时间
    await new Promise(resolve => setTimeout(resolve, this.options.duration));

    // 停止所有worker
    const stopPromises = workers.map(worker => worker.stop());
    const results = await Promise.all(stopPromises);

    // 聚合结果
    let totalOperations = 0;
    for (const workerResult of results) {
      latencies.push(...(workerResult.latencies || []));
      errors.push(...(workerResult.errors || []));
      totalOperations += workerResult.operations || 0;
    }

    const duration = (Date.now() - startTime) / 1000; // 秒
    const throughput = totalOperations / duration;

    return {
      throughput,
      avgLatency: latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0,
      latencies: this._calculatePercentiles(latencies),
      errorRate: totalOperations > 0 ? errors.length / totalOperations : 0,
      errors: errors.length,
      duration,
    };
  }

  /**
   * 创建worker
   */
  _createWorker(benchmark, result) {
    let operations = 0;
    const latencies = [];
    const errors = [];
    let isRunning = true;

    const run = async () => {
      while (isRunning) {
        try {
          if (benchmark.beforeEach) await benchmark.beforeEach();

          const start = process.hrtime.bigint();
          await benchmark.execute();
          const end = process.hrtime.bigint();

          const latency = Number(end - start) / 1000000; // 毫秒
          latencies.push(latency);
          operations++;

          if (benchmark.afterEach) await benchmark.afterEach();
        } catch (error) {
          errors.push(error);
        }
      }
    };

    // 启动worker
    run();

    return {
      stop: () => {
        isRunning = false;
        return { operations, latencies, errors };
      }
    };
  }

  /**
   * 检测性能回归
   */
  async _detectPerformanceRegressions(result) {
    if (!this.options.regressionDetection) return [];

    const benchmarkName = result.name;
    const currentMetrics = result.metrics;
    const baseline = this.baselineMetrics.get(benchmarkName);

    if (!baseline) {
      // 建立基准
      this.baselineMetrics.set(benchmarkName, { ...currentMetrics, timestamp: Date.now() });
      return [];
    }

    const regressions = [];

    // 检查关键指标的回归
    for (const [metricName, currentValue] of Object.entries(currentMetrics)) {
      const baselineValue = baseline[metricName];
      if (typeof baselineValue !== 'number' || typeof currentValue !== 'number') continue;

      const changePercent = (currentValue - baselineValue) / baselineValue;

      // 对于延迟指标，增加是回归；对于吞吐量指标，减少是回归
      const isRegression = (metricName.includes('latency') || metricName.includes('time'))
        ? changePercent > 0.1 // 延迟增加10%以上
        : changePercent < -0.1; // 吞吐量减少10%以上

      if (isRegression) {
        regressions.push({
          metric: metricName,
          baselineValue,
          currentValue,
          changePercent,
          severity: Math.abs(changePercent) > 0.3 ? 'high' : 'medium',
          timestamp: Date.now(),
        });
      }
    }

    // 记录回归历史
    if (regressions.length > 0) {
      const history = this.regressionHistory.get(benchmarkName) || [];
      history.push({
        timestamp: Date.now(),
        regressions,
        metrics: currentMetrics,
      });

      // 保持历史记录大小
      if (history.length > 50) {
        history.splice(0, history.length - 25);
      }

      this.regressionHistory.set(benchmarkName, history);
    }

    return regressions;
  }

  /**
   * 检测性能异常
   */
  async _detectPerformanceAnomalies(result) {
    if (!this.options.anomalyDetection) return [];

    const benchmarkName = result.name;
    const metrics = result.metrics;
    const history = this.historicalData.get(benchmarkName) || [];

    if (history.length < this.adaptiveParams.minimumSampleSize) return [];

    const anomalies = [];

    // 对每个指标进行异常检测
    for (const [metricName, values] of Object.entries(metrics)) {
      if (!Array.isArray(values) && typeof values === 'number') {
        const historicalValues = history.map(h => h.metrics[metricName]).filter(v => typeof v === 'number');

        if (historicalValues.length > 0) {
          const stats = this._calculateBasicStatistics(historicalValues);
          const zScore = Math.abs(values - stats.mean) / stats.stdDev;

          if (zScore > this.adaptiveParams.outlierThreshold) {
            anomalies.push({
              metric: metricName,
              value: values,
              expectedRange: {
                min: stats.mean - 2 * stats.stdDev,
                max: stats.mean + 2 * stats.stdDev,
              },
              zScore,
              severity: zScore > 5 ? 'critical' : 'warning',
              timestamp: Date.now(),
            });
          }
        }
      }
    }

    return anomalies;
  }

  /**
   * 分析性能瓶颈
   */
  async _analyzePerformanceBottlenecks(result) {
    if (!this.options.bottleneckAnalysis) return [];

    const bottlenecks = [];
    const metrics = result.metrics;

    // CPU瓶颈检测
    if (metrics.cpuUsage && metrics.cpuUsage > 90) {
      bottlenecks.push({
        type: 'cpu',
        severity: 'high',
        description: `CPU使用率过高: ${metrics.cpuUsage}%`,
        recommendations: [
          '考虑增加CPU核心数',
          '优化CPU密集型操作',
          '实施负载均衡',
        ],
      });
    }

    // 内存瓶颈检测
    if (metrics.memoryUsage && metrics.memoryUsage > 0.8) {
      bottlenecks.push({
        type: 'memory',
        severity: 'high',
        description: `内存使用率过高: ${(metrics.memoryUsage * 100).toFixed(1)}%`,
        recommendations: [
          '增加内存容量',
          '优化内存使用',
          '实施内存池化',
        ],
      });
    }

    // I/O瓶颈检测
    if (metrics.ioWait && metrics.ioWait > 20) {
      bottlenecks.push({
        type: 'io',
        severity: 'medium',
        description: `I/O等待时间过长: ${metrics.ioWait}%`,
        recommendations: [
          '优化磁盘I/O',
          '使用SSD存储',
          '实施I/O缓存',
        ],
      });
    }

    // 网络瓶颈检测
    if (metrics.networkLatency && metrics.networkLatency > 100) {
      bottlenecks.push({
        type: 'network',
        severity: 'medium',
        description: `网络延迟过高: ${metrics.networkLatency}ms`,
        recommendations: [
          '优化网络配置',
          '使用CDN',
          '减少网络往返',
        ],
      });
    }

    return bottlenecks;
  }

  /**
   * 生成性能预测
   */
  async _generatePerformancePredictions(result) {
    if (!this.options.predictiveModeling) return [];

    const benchmarkName = result.name;
    const history = this.historicalData.get(benchmarkName) || [];

    if (history.length < 5) return [];

    const predictions = [];

    // 对关键指标进行预测
    const keyMetrics = ['throughput', 'avgLatency', 'errorRate'];

    for (const metricName of keyMetrics) {
      const values = history.map(h => h.metrics[metricName]).filter(v => typeof v === 'number');

      if (values.length >= 5) {
        const prediction = this._predictMetricValue(values, 3); // 预测未来3个周期

        predictions.push({
          metric: metricName,
          currentValue: result.metrics[metricName],
          predictedValues: prediction.values,
          confidence: prediction.confidence,
          trend: prediction.trend,
        });
      }
    }

    return predictions;
  }

  /**
   * 执行比较分析
   */
  async _performComparativeAnalysis(result) {
    if (!this.options.comparativeAnalysis) return [];

    const benchmarkName = result.name;
    const history = this.historicalData.get(benchmarkName) || [];

    if (history.length < 2) return [];

    const comparisons = [];

    // 与历史最佳性能比较
    const bestHistorical = history.reduce((best, current) => {
      const bestScore = this._calculatePerformanceScore(best.metrics);
      const currentScore = this._calculatePerformanceScore(current.metrics);
      return currentScore > bestScore ? current : best;
    });

    const currentScore = this._calculatePerformanceScore(result.metrics);
    const bestScore = this._calculatePerformanceScore(bestHistorical.metrics);

    comparisons.push({
      type: 'historical_best',
      currentScore,
      bestScore,
      improvement: ((currentScore - bestScore) / bestScore) * 100,
      timeframe: 'historical',
    });

    // 与最近性能比较
    const recent = history.slice(-5);
    const avgRecentScore = recent.reduce((sum, h) => sum + this._calculatePerformanceScore(h.metrics), 0) / recent.length;

    comparisons.push({
      type: 'recent_average',
      currentScore,
      recentAvgScore: avgRecentScore,
      change: ((currentScore - avgRecentScore) / avgRecentScore) * 100,
      timeframe: 'recent_5_runs',
    });

    return comparisons;
  }

  /**
   * 计算性能评分
   */
  _calculatePerformanceScore(metrics) {
    let score = 0;

    // 吞吐量权重
    if (metrics.throughput) {
      score += metrics.throughput * 0.4;
    }

    // 延迟权重（负权重）
    if (metrics.avgLatency) {
      score -= metrics.avgLatency * 0.3;
    }

    // 错误率权重（负权重）
    if (metrics.errorRate !== undefined) {
      score -= metrics.errorRate * 1000; // 放大影响
    }

    return score;
  }

  /**
   * 计算样本统计
   */
  _calculateSampleStatistics(samples) {
    if (samples.length === 0) return {};

    const values = samples.map(s => s.throughput || 0);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    // 计算置信区间 (t-distribution approximation for simplicity)
    const confidenceLevel = this.adaptiveParams.confidenceLevel;
    const tValue = 2.0; // 约等于95%置信区间的t值
    const marginOfError = tValue * (stdDev / Math.sqrt(values.length));
    const confidenceInterval = marginOfError / mean; // 相对置信区间

    return {
      mean,
      stdDev,
      min: Math.min(...values),
      max: Math.max(...values),
      confidenceInterval,
      sampleSize: values.length,
    };
  }

  /**
   * 计算平均性能
   */
  _calculateAveragePerformance(history) {
    if (history.length === 0) return {};

    const metrics = {};
    const metricKeys = Object.keys(history[0].metrics || {});

    for (const key of metricKeys) {
      const values = history.map(h => h.metrics[key]).filter(v => typeof v === 'number');
      if (values.length > 0) {
        metrics[key] = values.reduce((a, b) => a + b, 0) / values.length;
      }
    }

    return metrics;
  }

  /**
   * 优化并发级别
   */
  _optimizeConcurrencyLevels(currentLevels, avgPerformance) {
    const optimized = [...currentLevels];

    // 基于性能特征调整并发级别
    if (avgPerformance.throughput && avgPerformance.avgLatency) {
      const throughputEfficiency = avgPerformance.throughput / (1000 / avgPerformance.avgLatency); // 理论最大吞吐量

      if (throughputEfficiency < 0.5) {
        // 效率低，减少并发
        optimized.splice(-2); // 移除最后两个级别
      } else if (throughputEfficiency > 0.8) {
        // 效率高，增加并发
        const maxLevel = Math.max(...optimized);
        optimized.push(maxLevel * 2, maxLevel * 4);
      }
    }

    return optimized.filter(level => level <= 1000); // 限制最大并发
  }

  /**
   * 计算趋势
   */
  _calculateTrend(data, field) {
    if (data.length < 2) return 0;

    const first = data[0][field];
    const last = data[data.length - 1][field];

    return (last - first) / first;
  }

  /**
   * 预测指标值
   */
  _predictMetricValue(historicalValues, periods) {
    // 简单的线性回归预测
    const n = historicalValues.length;
    if (n < 2) return { values: [], confidence: 0, trend: 'insufficient_data' };

    // 计算趋势线
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;

    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += historicalValues[i];
      sumXY += i * historicalValues[i];
      sumXX += i * i;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // 生成预测值
    const predictions = [];
    for (let i = 1; i <= periods; i++) {
      predictions.push(intercept + slope * (n + i - 1));
    }

    // 计算置信度（简化的）
    const residuals = historicalValues.map((val, i) => val - (intercept + slope * i));
    const mse = residuals.reduce((sum, r) => sum + r * r, 0) / n;
    const confidence = Math.max(0, 1 - mse / (historicalValues[n-1] || 1));

    const trend = slope > 0 ? 'improving' : slope < 0 ? 'degrading' : 'stable';

    return {
      values: predictions,
      confidence,
      trend,
    };
  }

  /**
   * 计算基本统计
   */
  _calculateBasicStatistics(values) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    return {
      mean,
      variance,
      stdDev,
      min: Math.min(...values),
      max: Math.max(...values),
    };
  }

  /**
   * 获取高级性能基准统计信息
   */
  getAdvancedBenchmarkStats() {
    const basicStats = {
      totalBenchmarks: this.results.benchmarks.size,
      systemInfo: this.results.system,
      recommendations: this.results.recommendations,
    };

    // 计算高级指标
    const allBenchmarks = Array.from(this.results.benchmarks.values());
    const regressions = allBenchmarks.flatMap(b => b.advanced?.regressions || []);
    const anomalies = allBenchmarks.flatMap(b => b.advanced?.anomalies || []);
    const bottlenecks = allBenchmarks.flatMap(b => b.advanced?.bottlenecks || []);

    const predictionAccuracy = this._calculateOverallPredictionAccuracy();
    const regressionTrend = this._calculateRegressionTrend();

    return {
      basic: basicStats,
      advanced: {
        totalRegressions: regressions.length,
        totalAnomalies: anomalies.length,
        totalBottlenecks: bottlenecks.length,
        predictionAccuracy,
        regressionTrend,
        adaptiveLoadGeneration: this.options.adaptiveLoadGeneration,
        intelligentWarmup: this.options.intelligentWarmup,
        statisticalAnalysis: this.options.statisticalAnalysis,
        regressionDetection: this.options.regressionDetection,
        bottleneckAnalysis: this.options.bottleneckAnalysis,
        predictiveModeling: this.options.predictiveModeling,
        comparativeAnalysis: this.options.comparativeAnalysis,
        anomalyDetection: this.options.anomalyDetection,
      },
      historical: {
        totalHistoricalRuns: Array.from(this.historicalData.values()).reduce((sum, hist) => sum + hist.length, 0),
        benchmarksWithHistory: this.historicalData.size,
        benchmarksWithBaseline: this.baselineMetrics.size,
      },
      performance: {
        avgAdaptiveEfficiency: this._calculateAdaptiveEfficiency(),
        trendAnalysisWindow: this.adaptiveParams.trendWindow,
        statisticalConfidence: this.adaptiveParams.confidenceLevel,
      },
    };
  }

  /**
   * 计算整体预测准确性
   */
  _calculateOverallPredictionAccuracy() {
    let totalPredictions = 0;
    let correctPredictions = 0;

    // 简化的准确性计算
    for (const model of this.performanceModels.values()) {
      totalPredictions += model.totalPredictions || 0;
      correctPredictions += model.correctPredictions || 0;
    }

    return totalPredictions > 0 ? correctPredictions / totalPredictions : 0;
  }

  /**
   * 计算回归趋势
   */
  _calculateRegressionTrend() {
    const recentRegressions = [];

    for (const history of this.regressionHistory.values()) {
      const recent = history.filter(h => Date.now() - h.timestamp < 7 * 24 * 60 * 60 * 1000); // 最近7天
      recentRegressions.push(...recent);
    }

    if (recentRegressions.length < 2) return 'insufficient_data';

    const recentCount = recentRegressions.length;
    const olderCount = Array.from(this.regressionHistory.values())
      .reduce((sum, history) => sum + history.length, 0) - recentCount;

    if (recentCount > olderCount * 1.5) {
      return 'increasing';
    } else if (recentCount < olderCount * 0.7) {
      return 'decreasing';
    } else {
      return 'stable';
    }
  }

  /**
   * 计算自适应效率
   */
  _calculateAdaptiveEfficiency() {
    // 计算自适应算法的有效性
    const efficiencyMetrics = [];

    for (const [benchmarkName, history] of this.historicalData.entries()) {
      if (history.length >= 3) {
        const recent = history.slice(-3);
        const older = history.slice(-6, -3);

        const recentAvg = this._calculateAveragePerformance(recent);
        const olderAvg = this._calculateAveragePerformance(older);

        const improvement = this._calculatePerformanceScore(recentAvg) - this._calculatePerformanceScore(olderAvg);
        efficiencyMetrics.push(improvement);
      }
    }

    return efficiencyMetrics.length > 0
      ? efficiencyMetrics.reduce((a, b) => a + b, 0) / efficiencyMetrics.length
      : 0;
  }
}

export default PerformanceBenchmark;
