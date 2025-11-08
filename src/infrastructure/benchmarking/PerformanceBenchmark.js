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
      ...options,
    };

    this.results = {
      metadata: {
        timestamp: new Date().toISOString(),
        options: this.options,
      },
      benchmarks: new Map(),
      system: {},
      recommendations: [],
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

    logger.info('开始运行基准测试', { name, description });

    const result = {
      name,
      description,
      timestamp: new Date().toISOString(),
      metrics: {},
      errors: [],
      phases: {},
    };

    try {
      // 准备阶段
      result.phases.setup = await this._timePhase(async () => {
        if (setup) await setup();
      });

      // 预热阶段
      result.phases.warmup = await this._timePhase(async () => {
        for (let i = 0; i < this.options.warmupIterations; i++) {
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
}

export default PerformanceBenchmark;
