/**
 * 基准测试管理器
 * 统一管理和执行各种类型的性能测试
 */

import { PerformanceBenchmark } from './PerformanceBenchmark.js';
import { LoadTester } from './LoadTester.js';
import { StressTester } from './StressTester.js';
import { logger } from '../../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';

export class BenchmarkManager {
  constructor(options = {}) {
    this.options = {
      resultsDir: options.resultsDir || './benchmark-results',
      enableHistoricalComparison: options.enableHistoricalComparison !== false,
      autoSave: options.autoSave !== false,
      reportFormats: options.reportFormats || ['json', 'html'],
      ...options,
    };

    this.benchmarks = new Map();
    this.results = new Map();
    this.history = new Map();

    this.isRunning = false;
  }

  /**
   * 初始化基准测试管理器
   */
  async initialize() {
    // 确保结果目录存在
    await fs.mkdir(this.options.resultsDir, { recursive: true });

    // 加载历史结果
    if (this.options.enableHistoricalComparison) {
      await this._loadHistoricalResults();
    }

    logger.info('基准测试管理器初始化完成', {
      resultsDir: this.options.resultsDir,
      historicalResults: this.history.size,
    });
  }

  /**
   * 注册基准测试
   */
  registerBenchmark(name, config) {
    this.benchmarks.set(name, {
      name,
      ...config,
      registeredAt: new Date().toISOString(),
    });

    logger.info('基准测试已注册', { name });
  }

  /**
   * 运行单个基准测试
   */
  async runBenchmark(name, options = {}) {
    const benchmark = this.benchmarks.get(name);
    if (!benchmark) {
      throw new Error(`Benchmark '${name}' not found`);
    }

    logger.info('开始运行基准测试', { name });

    this.isRunning = true;

    try {
      const tester = this._createTester(benchmark.type);
      const result = await tester.runBenchmarkSuite(name, [benchmark]);

      this.results.set(name, result);

      if (this.options.autoSave) {
        await this.saveResult(name, result);
      }

      logger.info('基准测试完成', { name });
      return result;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * 运行基准测试套件
   */
  async runBenchmarkSuite(suiteName, benchmarkNames, options = {}) {
    const benchmarks = benchmarkNames
      .map((name) => this.benchmarks.get(name))
      .filter((benchmark) => benchmark !== undefined);

    if (benchmarks.length === 0) {
      throw new Error('No valid benchmarks found in suite');
    }

    logger.info('开始运行基准测试套件', {
      suiteName,
      benchmarkCount: benchmarks.length,
    });

    this.isRunning = true;

    try {
      const tester = new PerformanceBenchmark();
      const result = await tester.runBenchmarkSuite(suiteName, benchmarks);

      this.results.set(suiteName, result);

      if (this.options.autoSave) {
        await this.saveResult(suiteName, result);
      }

      logger.info('基准测试套件完成', { suiteName });
      return result;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * 运行负载测试
   */
  async runLoadTest(scenario, options = {}) {
    logger.info('开始运行负载测试', { name: scenario.name });

    this.isRunning = true;

    try {
      const tester = new LoadTester();
      const result = await tester.runLoadTest(scenario);

      const resultKey = `load_${scenario.name}_${Date.now()}`;
      this.results.set(resultKey, result);

      if (this.options.autoSave) {
        await this.saveResult(resultKey, result);
      }

      logger.info('负载测试完成', { name: scenario.name });
      return result;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * 运行压力测试
   */
  async runStressTest(testConfig, options = {}) {
    logger.info('开始运行压力测试', { name: testConfig.name });

    this.isRunning = true;

    try {
      const tester = new StressTester();
      const result = await tester.runStressTest(testConfig);

      const resultKey = `stress_${testConfig.name}_${Date.now()}`;
      this.results.set(resultKey, result);

      if (this.options.autoSave) {
        await this.saveResult(resultKey, result);
      }

      logger.info('压力测试完成', { name: testConfig.name });
      return result;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * 运行全面性能评估
   */
  async runComprehensiveAssessment(config = {}) {
    const {
      includeBenchmarks = true,
      includeLoadTests = true,
      includeStressTests = true,
      benchmarkSuite = 'comprehensive',
      loadScenarios = [],
      stressTests = [],
    } = config;

    logger.info('开始运行全面性能评估');

    const assessment = {
      timestamp: new Date().toISOString(),
      phases: [],
      results: {},
      analysis: {},
      recommendations: [],
    };

    try {
      // 1. 基准测试阶段
      if (includeBenchmarks && this.benchmarks.size > 0) {
        const benchmarkNames = Array.from(this.benchmarks.keys());
        const benchmarkResult = await this.runBenchmarkSuite(
          benchmarkSuite,
          benchmarkNames,
        );
        assessment.phases.push({
          name: 'benchmarks',
          completedAt: new Date().toISOString(),
        });
        assessment.results.benchmarks = benchmarkResult;
      }

      // 2. 负载测试阶段
      if (includeLoadTests && loadScenarios.length > 0) {
        assessment.results.loadTests = {};
        for (const scenario of loadScenarios) {
          const result = await this.runLoadTest(scenario);
          assessment.results.loadTests[scenario.name] = result;
        }
        assessment.phases.push({
          name: 'load_tests',
          completedAt: new Date().toISOString(),
        });
      }

      // 3. 压力测试阶段
      if (includeStressTests && stressTests.length > 0) {
        assessment.results.stressTests = {};
        for (const testConfig of stressTests) {
          const result = await this.runStressTest(testConfig);
          assessment.results.stressTests[testConfig.name] = result;
        }
        assessment.phases.push({
          name: 'stress_tests',
          completedAt: new Date().toISOString(),
        });
      }

      // 4. 生成综合分析
      assessment.analysis = this._generateComprehensiveAnalysis(
        assessment.results,
      );
      assessment.recommendations = this._generateComprehensiveRecommendations(
        assessment.analysis,
      );

      // 保存评估结果
      const assessmentKey = `assessment_${Date.now()}`;
      this.results.set(assessmentKey, assessment);

      if (this.options.autoSave) {
        await this.saveResult(assessmentKey, assessment);
      }

      logger.info('全面性能评估完成');
      return assessment;
    } catch (error) {
      logger.error('全面性能评估失败', error);
      assessment.error = error.message;
      return assessment;
    }
  }

  /**
   * 保存测试结果
   */
  async saveResult(key, result) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${key}_${timestamp}`;

    for (const format of this.options.reportFormats) {
      try {
        const content = this._formatResult(result, format);
        const filepath = path.join(
          this.options.resultsDir,
          `${filename}.${format}`,
        );
        await fs.writeFile(filepath, content, 'utf8');

        logger.debug('测试结果已保存', { key, format, filepath });
      } catch (error) {
        logger.error('保存测试结果失败', { key, format, error: error.message });
      }
    }

    // 更新历史记录
    if (!this.history.has(key)) {
      this.history.set(key, []);
    }
    this.history.get(key).push({
      timestamp: result.timestamp || new Date().toISOString(),
      result: result,
    });

    // 限制历史记录数量
    const history = this.history.get(key);
    if (history.length > 10) {
      history.shift();
    }
  }

  /**
   * 加载历史结果
   */
  async _loadHistoricalResults() {
    try {
      const files = await fs.readdir(this.options.resultsDir);
      const jsonFiles = files.filter((file) => file.endsWith('.json'));

      for (const file of jsonFiles) {
        try {
          const filepath = path.join(this.options.resultsDir, file);
          const content = await fs.readFile(filepath, 'utf8');
          const result = JSON.parse(content);

          // 从文件名提取key
          const key = file.replace(
            /_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.json$/,
            '',
          );

          if (!this.history.has(key)) {
            this.history.set(key, []);
          }
          this.history.get(key).push(result);
        } catch (error) {
          logger.warn('加载历史结果失败', { file, error: error.message });
        }
      }

      logger.info('历史结果加载完成', { filesLoaded: jsonFiles.length });
    } catch (error) {
      logger.warn('加载历史结果目录失败', error);
    }
  }

  /**
   * 获取结果比较
   */
  getResultComparison(key, count = 5) {
    const history = this.history.get(key);
    if (!history || history.length < 2) {
      return null;
    }

    const recent = history
      .slice(-count)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    const comparison = {
      key,
      periods: recent.length,
      trends: {},
      improvements: [],
      regressions: [],
    };

    // 分析趋势
    if (recent.length >= 2) {
      const latest = recent[recent.length - 1];
      const previous = recent[recent.length - 2];

      comparison.trends = this._compareResults(previous.result, latest.result);
    }

    return comparison;
  }

  /**
   * 比较两个结果
   */
  _compareResults(previous, current) {
    const trends = {};

    // 比较基准测试结果
    if (previous.benchmarks && current.benchmarks) {
      for (const [name, currentResult] of Object.entries(current.benchmarks)) {
        const previousResult = previous.benchmarks[name];
        if (previousResult) {
          trends[name] = this._calculateTrend(previousResult, currentResult);
        }
      }
    }

    return trends;
  }

  /**
   * 计算趋势
   */
  _calculateTrend(previous, current) {
    const trend = {
      performance: 'stable',
      change: {},
    };

    // 比较关键指标
    if (previous.metrics?.summary && current.metrics?.summary) {
      const prevSummary = previous.metrics.summary;
      const currSummary = current.metrics.summary;

      // 吞吐量变化
      if (prevSummary.bestThroughput && currSummary.bestThroughput) {
        const throughputChange =
          ((currSummary.bestThroughput - prevSummary.bestThroughput) /
            prevSummary.bestThroughput) *
          100;
        trend.change.throughput = throughputChange;

        if (Math.abs(throughputChange) > 5) {
          trend.performance = throughputChange > 0 ? 'improving' : 'degrading';
        }
      }

      // 错误率变化
      if (
        prevSummary.errorRate !== undefined &&
        currSummary.errorRate !== undefined
      ) {
        const errorChange = currSummary.errorRate - prevSummary.errorRate;
        trend.change.errorRate = errorChange;
      }
    }

    return trend;
  }

  /**
   * 创建测试器实例
   */
  _createTester(type) {
    switch (type) {
      case 'load':
        return new LoadTester();
      case 'stress':
        return new StressTester();
      default:
        return new PerformanceBenchmark();
    }
  }

  /**
   * 格式化结果
   */
  _formatResult(result, format) {
    switch (format) {
      case 'json':
        return JSON.stringify(result, null, 2);
      case 'html':
        return this._generateHtmlReport(result);
      case 'csv':
        return this._generateCsvReport(result);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * 生成HTML报告
   */
  _generateHtmlReport(result) {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Performance Benchmark Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .summary { background: #f0f0f0; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
        .metric { background: white; padding: 10px; border: 1px solid #ddd; border-radius: 5px; }
        .recommendations { background: #fff3cd; padding: 15px; border-radius: 5px; margin-top: 20px; }
    </style>
</head>
<body>
    <h1>Performance Benchmark Report</h1>
    <div class="summary">
        <h2>Summary</h2>
        <p><strong>Timestamp:</strong> ${result.timestamp || 'N/A'}</p>
        <p><strong>Duration:</strong> ${result.duration || 'N/A'}</p>
    </div>

    <div class="metrics">
        ${this._renderMetrics(result)}
    </div>

    ${
      result.recommendations
        ? `
    <div class="recommendations">
        <h2>Recommendations</h2>
        <ul>
            ${result.recommendations.map((rec) => `<li><strong>${rec.type}:</strong> ${rec.message}</li>`).join('')}
        </ul>
    </div>
    `
        : ''
    }
</body>
</html>`;
  }

  /**
   * 渲染指标
   */
  _renderMetrics(result) {
    if (!result.metrics) return '';

    const metrics = [];

    if (result.metrics.summary) {
      const summary = result.metrics.summary;
      metrics.push(`
        <div class="metric">
          <h3>Performance Summary</h3>
          <p>Optimal Concurrency: ${summary.optimalConcurrency}</p>
          <p>Best Throughput: ${summary.bestThroughput?.toFixed(2) || 'N/A'}</p>
          <p>Error Rate: ${summary.errorRate?.toFixed(2) || 'N/A'}%</p>
        </div>
      `);
    }

    return metrics.join('');
  }

  /**
   * 生成CSV报告
   */
  _generateCsvReport(result) {
    const lines = ['Metric,Value,Timestamp'];

    if (result.metrics?.summary) {
      const summary = result.metrics.summary;
      lines.push(
        `OptimalConcurrency,${summary.optimalConcurrency},${result.timestamp}`,
      );
      lines.push(
        `BestThroughput,${summary.bestThroughput || 0},${result.timestamp}`,
      );
      lines.push(`ErrorRate,${summary.errorRate || 0},${result.timestamp}`);
    }

    return lines.join('\n');
  }

  /**
   * 生成综合分析
   */
  _generateComprehensiveAnalysis(results) {
    const analysis = {
      overall: {
        score: 100,
        issues: [],
        strengths: [],
      },
      benchmarks: {},
      loadTests: {},
      stressTests: {},
    };

    let totalScore = 0;
    let componentCount = 0;

    // 分析基准测试
    if (results.benchmarks?.analysis) {
      analysis.benchmarks = results.benchmarks.analysis;
      totalScore += this._calculateAnalysisScore(results.benchmarks.analysis);
      componentCount++;
    }

    // 分析负载测试
    if (results.loadTests) {
      for (const [name, testResult] of Object.entries(results.loadTests)) {
        analysis.loadTests[name] = testResult.analysis || {};
        if (testResult.analysis) {
          totalScore += this._calculateAnalysisScore(testResult.analysis);
          componentCount++;
        }
      }
    }

    // 分析压力测试
    if (results.stressTests) {
      for (const [name, testResult] of Object.entries(results.stressTests)) {
        analysis.stressTests[name] = testResult.analysis || {};
        if (testResult.analysis) {
          totalScore += this._calculateAnalysisScore(testResult.analysis);
          componentCount++;
        }
      }
    }

    analysis.overall.score =
      componentCount > 0 ? totalScore / componentCount : 100;

    return analysis;
  }

  /**
   * 计算分析得分
   */
  _calculateAnalysisScore(analysis) {
    let score = 100;

    // 基于瓶颈数量扣分
    if (analysis.bottlenecks) {
      score -= analysis.bottlenecks.length * 10;
    }

    // 基于性能指标调整得分
    if (analysis.performance) {
      const perf = analysis.performance;
      if (perf.scalingEfficiency < 0.5) score -= 20;
      if (perf.errorRate > 10) score -= 15;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * 生成综合建议
   */
  _generateComprehensiveRecommendations(analysis) {
    const recommendations = [];

    if (analysis.overall.score < 70) {
      recommendations.push({
        type: 'critical_performance',
        priority: 'high',
        message: '系统整体性能需要重大改进',
        actions: [
          '进行全面的性能分析',
          '优化关键瓶颈',
          '考虑架构重构',
          '增加系统资源',
        ],
      });
    } else if (analysis.overall.score < 85) {
      recommendations.push({
        type: 'performance_optimization',
        priority: 'medium',
        message: '系统性能需要优化',
        actions: [
          '优化数据库查询',
          '改进缓存策略',
          '增加资源池化',
          '优化并发处理',
        ],
      });
    }

    // 基于具体分析添加更多建议
    if (analysis.benchmarks?.bottlenecks?.length > 0) {
      recommendations.push({
        type: 'benchmark_issues',
        priority: 'medium',
        message: `发现 ${analysis.benchmarks.bottlenecks.length} 个基准测试瓶颈`,
        actions: ['查看详细的基准测试报告', '针对性优化瓶颈点'],
      });
    }

    return recommendations;
  }

  /**
   * 停止所有运行中的测试
   */
  stopAll() {
    this.isRunning = false;
    logger.info('所有性能测试已停止');
  }

  /**
   * 获取管理器状态
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      registeredBenchmarks: this.benchmarks.size,
      completedResults: this.results.size,
      historicalResults: this.history.size,
      resultsDir: this.options.resultsDir,
      timestamp: new Date().toISOString(),
    };
  }
}

export default BenchmarkManager;
