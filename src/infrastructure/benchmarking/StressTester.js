/**
 * 压力测试器
 * 专门用于测试系统在极端条件下的表现
 */

import { logger } from '../../shared/utils/logger.js';
import { LoadTester } from './LoadTester.js';

export class StressTester extends LoadTester {
  constructor(options = {}) {
    super({
      duration: 300000, // 5分钟
      targetConcurrency: 100,
      monitoring: {
        enabled: true,
        interval: 2000,
        cpu: true,
        memory: true,
      },
      ...options,
    });

    this.stressPatterns = {
      overload: this._overloadPattern.bind(this),
      memory_pressure: this._memoryPressurePattern.bind(this),
      disk_io: this._diskIOPattern.bind(this),
      network_saturation: this._networkSaturationPattern.bind(this),
      mixed_workload: this._mixedWorkloadPattern.bind(this),
      cascading_failure: this._cascadingFailurePattern.bind(this),
    };
  }

  /**
   * 运行压力测试
   */
  async runStressTest(testConfig) {
    const {
      name,
      description,
      stressType = 'overload',
      intensity = 'high',
      recoveryTest = true,
      failureThresholds = {},
      ...config
    } = testConfig;

    logger.info('开始压力测试', { name, stressType, intensity });

    const results = {
      name,
      description,
      stressType,
      intensity,
      timestamp: new Date().toISOString(),
      phases: [],
      failurePoints: [],
      recoveryMetrics: null,
      analysis: {},
      recommendations: [],
    };

    try {
      // 基线测试阶段
      results.phases.push(await this._runBaselineTest(config));

      // 压力测试阶段
      const stressResult = await this._runStressPattern(
        stressType,
        intensity,
        config,
        failureThresholds,
      );
      results.phases.push(stressResult);

      // 恢复测试阶段
      if (recoveryTest) {
        results.recoveryMetrics = await this._runRecoveryTest(config);
        results.phases.push({
          name: 'recovery_test',
          ...results.recoveryMetrics,
        });
      }

      // 分析结果
      results.analysis = this._analyzeStressTest(results);
      results.recommendations = this._generateStressRecommendations(results);

      logger.info('压力测试完成', {
        name,
        failurePoints: results.failurePoints.length,
        recoverySuccessful: results.recoveryMetrics?.successful || false,
      });

      return results;
    } catch (error) {
      logger.error('压力测试失败', { name, error: error.message });
      results.error = error.message;
      return results;
    }
  }

  /**
   * 运行基线测试
   */
  async _runBaselineTest(config) {
    logger.info('运行基线测试');

    const baselineResult = await this.runLoadTest({
      name: 'baseline',
      pattern: 'constant',
      duration: 30000, // 30秒
      targetConcurrency: Math.floor(this.options.targetConcurrency * 0.3), // 30%负载
      ...config,
    });

    return {
      name: 'baseline',
      ...baselineResult,
    };
  }

  /**
   * 运行压力模式
   */
  async _runStressPattern(stressType, intensity, config, failureThresholds) {
    const stressFunction = this.stressPatterns[stressType];
    if (!stressFunction) {
      throw new Error(`Unknown stress pattern: ${stressType}`);
    }

    logger.info('运行压力模式', { stressType, intensity });

    const intensityConfig = this._getIntensityConfig(intensity);
    const result = await stressFunction({
      ...config,
      ...intensityConfig,
      failureThresholds,
    });

    return {
      name: 'stress_test',
      stressType,
      intensity,
      ...result,
    };
  }

  /**
   * 获取强度配置
   */
  _getIntensityConfig(intensity) {
    const configs = {
      low: {
        multiplier: 1.5,
        duration: 60000,
        rampUpTime: 10000,
      },
      medium: {
        multiplier: 2.0,
        duration: 120000,
        rampUpTime: 20000,
      },
      high: {
        multiplier: 3.0,
        duration: 180000,
        rampUpTime: 30000,
      },
      extreme: {
        multiplier: 5.0,
        duration: 300000,
        rampUpTime: 60000,
      },
    };

    return configs[intensity] || configs.medium;
  }

  /**
   * 过载压力模式
   */
  async _overloadPattern(config) {
    const {
      execute,
      beforeEach,
      afterEach,
      multiplier,
      duration,
      rampUpTime,
      failureThresholds,
    } = config;

    const baseConcurrency = this.options.targetConcurrency;
    const maxConcurrency = Math.floor(baseConcurrency * multiplier);

    const results = {
      maxConcurrency,
      failurePoints: [],
      metrics: {
        breakingPoint: null,
        recoveryTime: null,
        errorSpike: [],
      },
    };

    let currentConcurrency = baseConcurrency;
    const startTime = Date.now();
    const endTime = startTime + duration;
    const rampEndTime = startTime + rampUpTime;

    while (Date.now() < endTime && this.isRunning) {
      const now = Date.now();

      // 渐进增加并发
      if (now < rampEndTime) {
        const progress = (now - startTime) / rampUpTime;
        currentConcurrency = Math.floor(
          baseConcurrency + (maxConcurrency - baseConcurrency) * progress,
        );
      } else {
        currentConcurrency = maxConcurrency;
      }

      // 执行测试批次
      const batchResult = await this._executeStressBatch(
        currentConcurrency,
        execute,
        beforeEach,
        afterEach,
      );

      // 检查失败阈值
      const failurePoint = this._checkFailureThresholds(
        batchResult,
        failureThresholds,
        currentConcurrency,
      );

      if (failurePoint) {
        results.failurePoints.push({
          concurrency: currentConcurrency,
          timestamp: now,
          ...failurePoint,
        });

        // 如果是严重失败，可能需要停止测试
        if (failurePoint.severity === 'critical') {
          results.metrics.breakingPoint = {
            concurrency: currentConcurrency,
            timestamp: now,
            reason: failurePoint.reason,
          };
          break;
        }
      }

      results.metrics.errorSpike.push({
        concurrency: currentConcurrency,
        errorRate: batchResult.errorRate,
        timestamp: now,
      });

      await new Promise((resolve) => setTimeout(resolve, 1000)); // 1秒间隔
    }

    return results;
  }

  /**
   * 内存压力模式
   */
  async _memoryPressurePattern(config) {
    const { execute, beforeEach, afterEach, duration, failureThresholds } =
      config;

    const results = {
      memoryGrowth: [],
      gcEvents: [],
      memoryLeaks: [],
      failurePoints: [],
    };

    const startTime = Date.now();
    const endTime = startTime + duration;

    let lastMemoryUsage = this._collectMemoryStats();
    let iteration = 0;

    while (Date.now() < endTime && this.isRunning) {
      iteration++;

      // 执行操作
      const batchResult = await this._executeStressBatch(
        Math.floor(this.options.targetConcurrency * 0.8), // 80%负载
        execute,
        beforeEach,
        afterEach,
      );

      // 监控内存使用
      const currentMemory = this._collectMemoryStats();
      const memoryDelta = {
        rss: currentMemory.rss - lastMemoryUsage.rss,
        heapUsed: currentMemory.heapUsed - lastMemoryUsage.heapUsed,
        timestamp: Date.now(),
      };

      results.memoryGrowth.push({
        iteration,
        ...memoryDelta,
        totalMemory: currentMemory,
      });

      // 检查内存泄漏
      if (iteration > 10 && memoryDelta.heapUsed > 10 * 1024 * 1024) {
        // 10MB增长
        results.memoryLeaks.push({
          iteration,
          growth: memoryDelta.heapUsed,
          timestamp: Date.now(),
        });
      }

      // 检查失败阈值
      const failurePoint = this._checkFailureThresholds(
        batchResult,
        failureThresholds,
      );
      if (failurePoint) {
        results.failurePoints.push({
          iteration,
          timestamp: Date.now(),
          ...failurePoint,
        });
      }

      lastMemoryUsage = currentMemory;
      await new Promise((resolve) => setTimeout(resolve, 2000)); // 2秒间隔
    }

    return results;
  }

  /**
   * 磁盘I/O压力模式
   */
  async _diskIOPattern(config) {
    // 实现磁盘I/O密集型压力测试
    const { execute, beforeEach, afterEach, duration, failureThresholds } =
      config;

    const results = {
      ioOperations: [],
      diskUtilization: [],
      slowOperations: [],
      failurePoints: [],
    };

    const startTime = Date.now();
    const endTime = startTime + duration;

    while (Date.now() < endTime && this.isRunning) {
      // 执行I/O密集型操作
      const batchResult = await this._executeStressBatch(
        Math.floor(this.options.targetConcurrency * 0.6), // 60%负载
        execute,
        beforeEach,
        afterEach,
      );

      // 监控I/O性能（这里需要具体的I/O监控实现）
      results.ioOperations.push({
        timestamp: Date.now(),
        operations: batchResult.totalOperations,
        avgLatency: batchResult.latencyStats?.mean || 0,
      });

      // 检查慢操作
      if (batchResult.latencyStats?.p95 > 5000) {
        // 5秒
        results.slowOperations.push({
          timestamp: Date.now(),
          p95Latency: batchResult.latencyStats.p95,
          errorRate: batchResult.errorRate,
        });
      }

      const failurePoint = this._checkFailureThresholds(
        batchResult,
        failureThresholds,
      );
      if (failurePoint) {
        results.failurePoints.push(failurePoint);
      }

      await new Promise((resolve) => setTimeout(resolve, 3000)); // 3秒间隔
    }

    return results;
  }

  /**
   * 网络饱和压力模式
   */
  async _networkSaturationPattern(config) {
    // 实现网络密集型压力测试
    const { execute, beforeEach, afterEach, duration, failureThresholds } =
      config;

    const results = {
      networkRequests: [],
      connectionErrors: [],
      timeoutErrors: [],
      failurePoints: [],
    };

    const startTime = Date.now();
    const endTime = startTime + duration;

    while (Date.now() < endTime && this.isRunning) {
      // 执行网络密集型操作
      const batchResult = await this._executeStressBatch(
        Math.floor(this.options.targetConcurrency * 0.7), // 70%负载
        execute,
        beforeEach,
        afterEach,
      );

      // 分析网络相关错误
      const networkErrors = batchResult.errors.filter(
        (error) =>
          error.includes('ECONNREFUSED') ||
          error.includes('ENOTFOUND') ||
          error.includes('timeout'),
      );

      results.networkRequests.push({
        timestamp: Date.now(),
        totalRequests: batchResult.totalOperations,
        networkErrors: networkErrors.length,
        successRate:
          ((batchResult.totalOperations - networkErrors.length) /
            batchResult.totalOperations) *
          100,
      });

      // 分类错误
      networkErrors.forEach((error) => {
        if (error.includes('timeout')) {
          results.timeoutErrors.push({ timestamp: Date.now(), error });
        } else {
          results.connectionErrors.push({ timestamp: Date.now(), error });
        }
      });

      const failurePoint = this._checkFailureThresholds(
        batchResult,
        failureThresholds,
      );
      if (failurePoint) {
        results.failurePoints.push(failurePoint);
      }

      await new Promise((resolve) => setTimeout(resolve, 2000)); // 2秒间隔
    }

    return results;
  }

  /**
   * 混合工作负载模式
   */
  async _mixedWorkloadPattern(config) {
    const { execute, beforeEach, afterEach, duration, failureThresholds } =
      config;

    const results = {
      workloadDistribution: [],
      resourceContention: [],
      failurePoints: [],
    };

    const startTime = Date.now();
    const endTime = startTime + duration;

    while (Date.now() < endTime && this.isRunning) {
      // 混合不同类型的操作
      const workloadTypes = ['cpu', 'memory', 'io', 'network'];
      const resultsByType = {};

      for (const type of workloadTypes) {
        const batchResult = await this._executeStressBatch(
          Math.floor(this.options.targetConcurrency * 0.25), // 25%负载每种
          execute,
          beforeEach,
          afterEach,
        );

        resultsByType[type] = {
          operations: batchResult.totalOperations,
          avgLatency: batchResult.latencyStats?.mean || 0,
          errorRate: batchResult.errorRate,
        };
      }

      results.workloadDistribution.push({
        timestamp: Date.now(),
        ...resultsByType,
      });

      // 检查资源竞争
      const totalOperations = Object.values(resultsByType).reduce(
        (sum, type) => sum + type.operations,
        0,
      );
      const avgErrorRate =
        Object.values(resultsByType).reduce(
          (sum, type) => sum + type.errorRate,
          0,
        ) / workloadTypes.length;

      if (avgErrorRate > 10) {
        results.resourceContention.push({
          timestamp: Date.now(),
          errorRate: avgErrorRate,
          totalOperations,
        });
      }

      const failurePoint = this._checkFailureThresholds(
        {
          totalOperations,
          errorRate: avgErrorRate,
        },
        failureThresholds,
      );
      if (failurePoint) {
        results.failurePoints.push(failurePoint);
      }

      await new Promise((resolve) => setTimeout(resolve, 5000)); // 5秒间隔
    }

    return results;
  }

  /**
   * 级联故障模式
   */
  async _cascadingFailurePattern(config) {
    // 模拟级联故障场景
    const { execute, beforeEach, afterEach, duration, failureThresholds } =
      config;

    const results = {
      failureCascade: [],
      recoveryAttempts: [],
      systemDegradation: [],
      failurePoints: [],
    };

    let failureCount = 0;
    const startTime = Date.now();
    const endTime = startTime + duration;

    while (Date.now() < endTime && this.isRunning) {
      const batchResult = await this._executeStressBatch(
        this.options.targetConcurrency,
        execute,
        beforeEach,
        afterEach,
      );

      // 模拟级联故障：错误会引发更多错误
      if (batchResult.errorRate > 5) {
        failureCount++;

        results.failureCascade.push({
          timestamp: Date.now(),
          errorRate: batchResult.errorRate,
          failureCount,
          cascading: failureCount > 1,
        });

        // 增加后续操作的失败概率
        if (failureCount > 3) {
          results.failurePoints.push({
            timestamp: Date.now(),
            type: 'cascading_failure',
            severity: 'critical',
            reason: 'Multiple cascading failures detected',
          });
          break;
        }
      } else {
        failureCount = Math.max(0, failureCount - 1); // 逐渐恢复
      }

      const failurePoint = this._checkFailureThresholds(
        batchResult,
        failureThresholds,
      );
      if (failurePoint) {
        results.failurePoints.push(failurePoint);
      }

      await new Promise((resolve) => setTimeout(resolve, 3000)); // 3秒间隔
    }

    return results;
  }

  /**
   * 执行压力测试批次
   */
  async _executeStressBatch(concurrency, execute, beforeEach, afterEach) {
    const results = [];
    const errors = [];
    const startTime = process.hrtime.bigint();

    const operations = Array(concurrency)
      .fill()
      .map(async () => {
        const opStart = process.hrtime.bigint();

        try {
          if (beforeEach) await beforeEach();
          await execute();
          if (afterEach) await afterEach();

          const opEnd = process.hrtime.bigint();
          const latency = Number(opEnd - opStart) / 1000000;

          return { success: true, latency };
        } catch (error) {
          return { success: false, error: error.message };
        }
      });

    const operationResults = await Promise.all(operations);
    const endTime = process.hrtime.bigint();
    const totalTime = Number(endTime - startTime) / 1000000;

    operationResults.forEach((result) => {
      if (result.success) {
        results.push(result.latency);
      } else {
        errors.push(result.error);
      }
    });

    return {
      totalOperations: concurrency,
      successfulOperations: results.length,
      failedOperations: errors.length,
      errorRate: (errors.length / concurrency) * 100,
      latencyStats: this._calculateLatencies(results),
      errors,
      avgLatency:
        results.length > 0
          ? results.reduce((sum, l) => sum + l, 0) / results.length
          : 0,
      throughput: results.length / (totalTime / 1000),
    };
  }

  /**
   * 检查失败阈值
   */
  _checkFailureThresholds(metrics, thresholds, concurrency = null) {
    const {
      maxErrorRate = 50,
      maxLatency = 30000,
      maxMemoryUsage = 0.9,
      minThroughput = 0,
    } = thresholds;

    if (metrics.errorRate > maxErrorRate) {
      return {
        type: 'error_rate_threshold',
        severity: 'high',
        reason: `Error rate ${metrics.errorRate.toFixed(2)}% exceeds threshold ${maxErrorRate}%`,
        value: metrics.errorRate,
        threshold: maxErrorRate,
      };
    }

    if (metrics.latencyStats?.p95 > maxLatency) {
      return {
        type: 'latency_threshold',
        severity: 'high',
        reason: `95th percentile latency ${metrics.latencyStats.p95.toFixed(2)}ms exceeds threshold ${maxLatency}ms`,
        value: metrics.latencyStats.p95,
        threshold: maxLatency,
      };
    }

    if (metrics.throughput < minThroughput) {
      return {
        type: 'throughput_threshold',
        severity: 'medium',
        reason: `Throughput ${metrics.throughput.toFixed(2)} ops/sec below threshold ${minThroughput} ops/sec`,
        value: metrics.throughput,
        threshold: minThroughput,
      };
    }

    // 检查内存使用
    const memoryUsage = this._collectMemoryStats();
    const heapUsageRatio = memoryUsage.heapUsed / memoryUsage.heapTotal;

    if (heapUsageRatio > maxMemoryUsage) {
      return {
        type: 'memory_threshold',
        severity: 'high',
        reason: `Memory usage ${(heapUsageRatio * 100).toFixed(1)}% exceeds threshold ${maxMemoryUsage * 100}%`,
        value: heapUsageRatio,
        threshold: maxMemoryUsage,
      };
    }

    return null;
  }

  /**
   * 运行恢复测试
   */
  async _runRecoveryTest(config) {
    logger.info('运行恢复测试');

    const recoveryStart = Date.now();

    // 逐步降低负载，观察系统恢复
    const recoverySteps = [0.8, 0.6, 0.4, 0.2, 0.1];

    const recoveryResults = [];

    for (const loadFactor of recoverySteps) {
      const concurrency = Math.floor(
        this.options.targetConcurrency * loadFactor,
      );

      const batchResult = await this._executeStressBatch(
        concurrency,
        config.execute,
        config.beforeEach,
        config.afterEach,
      );

      recoveryResults.push({
        loadFactor,
        concurrency,
        ...batchResult,
        timestamp: Date.now(),
      });

      await new Promise((resolve) => setTimeout(resolve, 5000)); // 5秒观察期
    }

    const recoveryTime = Date.now() - recoveryStart;

    // 评估恢复成功性
    const finalResult = recoveryResults[recoveryResults.length - 1];
    const successful =
      finalResult.errorRate < 5 && finalResult.avgLatency < 1000;

    return {
      recoveryTime,
      steps: recoveryResults,
      successful,
      finalMetrics: {
        errorRate: finalResult.errorRate,
        avgLatency: finalResult.avgLatency,
        throughput: finalResult.throughput,
      },
    };
  }

  /**
   * 分析压力测试结果
   */
  _analyzeStressTest(results) {
    const analysis = {
      breakingPoints: [],
      recoveryCapability: {},
      systemLimits: {},
      recommendations: [],
    };

    // 分析故障点
    analysis.breakingPoints = results.failurePoints.filter(
      (point) => point.severity === 'critical',
    );

    // 分析恢复能力
    if (results.recoveryMetrics) {
      const recovery = results.recoveryMetrics;
      analysis.recoveryCapability = {
        recoveryTime: recovery.recoveryTime,
        successful: recovery.successful,
        finalErrorRate: recovery.finalMetrics.errorRate,
        finalLatency: recovery.finalMetrics.avgLatency,
        degradationLevel: this._calculateDegradation(results),
      };
    }

    // 识别系统极限
    analysis.systemLimits = this._identifySystemLimits(results);

    return analysis;
  }

  /**
   * 计算性能下降程度
   */
  _calculateDegradation(results) {
    const baseline = results.phases.find((p) => p.name === 'baseline');
    const recovery = results.phases.find((p) => p.name === 'recovery_test');

    if (!baseline || !recovery) return 0;

    const baselineLatency = baseline.metrics?.latencyStats?.mean || 0;
    const recoveryLatency = recovery.finalMetrics?.avgLatency || 0;

    if (baselineLatency === 0) return 0;

    return ((recoveryLatency - baselineLatency) / baselineLatency) * 100;
  }

  /**
   * 识别系统极限
   */
  _identifySystemLimits(results) {
    const limits = {};

    // 查找第一个故障点
    const firstFailure = results.failurePoints
      .filter((p) => p.severity === 'critical')
      .sort((a, b) => a.timestamp - b.timestamp)[0];

    if (firstFailure) {
      limits.maxSafeConcurrency = firstFailure.concurrency || 0;
      limits.failureTrigger = firstFailure.reason;
    }

    // 分析内存压力测试
    const memoryStress = results.phases.find(
      (p) => p.stressType === 'memory_pressure',
    );
    if (memoryStress) {
      const significantLeaks = memoryStress.memoryLeaks.filter(
        (leak) => leak.growth > 50 * 1024 * 1024,
      ); // 50MB
      limits.memoryLeakThreshold =
        significantLeaks.length > 0 ? 'detected' : 'none';
    }

    return limits;
  }

  /**
   * 生成压力测试建议
   */
  _generateStressRecommendations(results) {
    const recommendations = [];

    const analysis = results.analysis;

    // 基于故障点
    if (analysis.breakingPoints.length > 0) {
      recommendations.push({
        type: 'capacity_planning',
        priority: 'high',
        message: `系统在 ${analysis.breakingPoints[0].concurrency || '高'} 并发时出现故障`,
        actions: [
          '设置适当的并发限制',
          '实现自动扩容机制',
          '增加负载均衡',
          '优化资源分配',
        ],
      });
    }

    // 基于恢复能力
    if (!analysis.recoveryCapability.successful) {
      recommendations.push({
        type: 'resilience',
        priority: 'high',
        message: '系统恢复能力不足',
        actions: [
          '实现优雅降级',
          '增加重试机制',
          '改善错误处理',
          '添加健康检查',
        ],
      });
    }

    // 基于系统极限
    if (analysis.systemLimits.memoryLeakThreshold === 'detected') {
      recommendations.push({
        type: 'memory_management',
        priority: 'high',
        message: '检测到内存泄漏',
        actions: ['修复内存泄漏', '实现对象池', '定期重启服务', '增加内存监控'],
      });
    }

    return recommendations;
  }

  /**
   * 创建预定义压力测试场景
   */
  static createStressScenario(name, config) {
    return {
      name,
      description: config.description || `Stress test for ${name}`,
      stressType: config.stressType || 'overload',
      intensity: config.intensity || 'high',
      recoveryTest: config.recoveryTest !== false,
      failureThresholds: {
        maxErrorRate: 20,
        maxLatency: 5000,
        maxMemoryUsage: 0.85,
        minThroughput: 10,
        ...config.failureThresholds,
      },
      ...config,
    };
  }
}

export default StressTester;
