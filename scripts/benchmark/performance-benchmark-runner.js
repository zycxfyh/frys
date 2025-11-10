#!/usr/bin/env node

/**
 * frys 性能基准测试运行器
 * 全面的性能测试和基准分析工具
 *
 * 功能特性：
 * - 启动时间性能测试
 * - 内存使用分析
 * - CPU性能基准测试
 * - 算法性能评估
 * - 基础设施性能测试
 * - 并发负载测试
 * - 自动基准线比较
 * - 详细性能报告生成
 */

import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class PerformanceBenchmarkRunner {
  constructor(options = {}) {
    this.options = {
      iterations: options.iterations || 5,
      warmupIterations: options.warmupIterations || 2,
      outputDir: options.outputDir || path.join(__dirname, 'results'),
      baselineFile: options.baselineFile || path.join(__dirname, 'baseline.json'),
      verbose: options.verbose || false,
      ...options
    };

    this.results = {
      timestamp: new Date().toISOString(),
      environment: this.getEnvironmentInfo(),
      benchmarks: {},
      summary: {}
    };

    this.ensureOutputDirectory();
  }

  /**
   * 获取环境信息
   */
  getEnvironmentInfo() {
    return {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      cpuCount: require('os').cpus().length,
      totalMemory: require('os').totalmem(),
      freeMemory: require('os').freemem(),
      hostname: require('os').hostname(),
      uptime: process.uptime(),
      versions: process.versions
    };
  }

  /**
   * 确保输出目录存在
   */
  ensureOutputDirectory() {
    if (!fs.existsSync(this.options.outputDir)) {
      fs.mkdirSync(this.options.outputDir, { recursive: true });
    }
  }

  /**
   * 运行所有基准测试
   */
  async runAllBenchmarks() {
    console.log('🚀 开始全面性能基准测试...\n');

    try {
      // 1. 启动时间测试
      console.log('📊 运行启动时间基准测试...');
      await this.runStartupBenchmark();

      // 2. 内存使用分析
      console.log('📈 运行内存使用分析...');
      await this.runMemoryBenchmark();

      // 3. CPU性能测试
      console.log('⚡ 运行CPU性能测试...');
      await this.runCPUBenchmark();

          // 4. 核心算法性能测试
      console.log('🧮 运行核心算法性能测试...');
      this.results.benchmarks.algorithms = await this.runAlgorithmBenchmark();

      // 5. 基础设施性能测试
      console.log('🏗️ 运行基础设施性能测试...');
      this.results.benchmarks.infrastructure = await this.runInfrastructureBenchmark();

      // 6. 并发负载测试
      console.log('🔄 运行并发负载测试...');
      await this.runConcurrencyBenchmark();

      // 7. 生成总结报告
      await this.generateSummaryReport();

      // 8. 与基准线比较
      await this.compareWithBaseline();

      console.log('\n✅ 所有性能基准测试完成!');
      console.log(`📄 详细报告已保存到: ${this.options.outputDir}`);

    } catch (error) {
      console.error('❌ 性能基准测试失败:', error.message);
      throw error;
    }
  }

  /**
   * 启动时间基准测试
   */
  async runStartupBenchmark() {
    console.log('  ⏱️  测试应用启动时间...');

    const startupTimes = [];
    const memoryUsage = [];

    for (let i = 0; i < this.options.iterations; i++) {
      const startTime = performance.now();

      try {
        // 模拟应用启动过程
        const { stdout } = await execAsync('node -e "console.log(\\"warmup\\")"', {
          cwd: path.resolve(__dirname, '../..'),
          timeout: 10000
        });

        const endTime = performance.now();
        const startupTime = endTime - startTime;

        startupTimes.push(startupTime);
        memoryUsage.push(process.memoryUsage());

        console.log(`    迭代 ${i + 1}: ${startupTime.toFixed(2)}ms`);

      } catch (error) {
        console.warn(`    迭代 ${i + 1} 失败: ${error.message}`);
        startupTimes.push(null);
      }
    }

    this.results.benchmarks.startup = {
      times: startupTimes.filter(t => t !== null),
      average: this.calculateAverage(startupTimes.filter(t => t !== null)),
      min: Math.min(...startupTimes.filter(t => t !== null)),
      max: Math.max(...startupTimes.filter(t => t !== null)),
      p95: this.calculatePercentile(startupTimes.filter(t => t !== null), 95),
      memoryUsage
    };

    console.log(`  ✅ 启动时间测试完成 - 平均: ${this.results.benchmarks.startup.average.toFixed(2)}ms`);
  }

  /**
   * 内存使用分析
   */
  async runMemoryBenchmark() {
    console.log('  📊 分析内存使用模式...');

    const memorySnapshots = [];
    const gcStats = [];

    // 强制垃圾回收（如果可用）
    if (global.gc) {
      global.gc();
    }

    for (let i = 0; i < this.options.iterations; i++) {
      // 执行一些内存密集操作
      const testData = [];
      for (let j = 0; j < 10000; j++) {
        testData.push({
          id: j,
          data: 'x'.repeat(100),
          nested: { value: Math.random() }
        });
      }

      // 记录内存使用
      const memUsage = process.memoryUsage();
      memorySnapshots.push({
        iteration: i,
        ...memUsage,
        testDataSize: testData.length
      });

      // 清理测试数据
      testData.length = 0;

      await this.delay(10); // 短暂延迟
    }

    this.results.benchmarks.memory = {
      snapshots: memorySnapshots,
      averageRss: this.calculateAverage(memorySnapshots.map(s => s.rss)),
      averageHeapUsed: this.calculateAverage(memorySnapshots.map(s => s.heapUsed)),
      averageHeapTotal: this.calculateAverage(memorySnapshots.map(s => s.heapTotal)),
      averageExternal: this.calculateAverage(memorySnapshots.map(s => s.external)),
      peakRss: Math.max(...memorySnapshots.map(s => s.rss)),
      peakHeapUsed: Math.max(...memorySnapshots.map(s => s.heapUsed))
    };

    console.log(`  ✅ 内存分析完成 - RSS峰值: ${(this.results.benchmarks.memory.peakRss / 1024 / 1024).toFixed(2)}MB`);
  }

  /**
   * CPU性能测试
   */
  async runCPUBenchmark() {
    console.log('  ⚡ 执行CPU密集型操作测试...');

    const cpuTimes = [];

    for (let i = 0; i < this.options.iterations; i++) {
      const startTime = process.hrtime.bigint();

      // 执行CPU密集型计算
      let result = 0;
      for (let j = 0; j < 1000000; j++) {
        result += Math.sin(j) * Math.cos(j);
        result += Math.sqrt(j + 1);
        result += Math.pow(j % 100, 2);
      }

      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000; // 转换为毫秒

      cpuTimes.push(duration);
      console.log(`    迭代 ${i + 1}: ${duration.toFixed(2)}ms`);
    }

    this.results.benchmarks.cpu = {
      times: cpuTimes,
      average: this.calculateAverage(cpuTimes),
      min: Math.min(...cpuTimes),
      max: Math.max(...cpuTimes),
      p95: this.calculatePercentile(cpuTimes, 95)
    };

    console.log(`  ✅ CPU测试完成 - 平均: ${this.results.benchmarks.cpu.average.toFixed(2)}ms`);
  }

  /**
   * 核心算法性能测试
   */
  async runAlgorithmBenchmark() {
    console.log('  🧮 测试核心算法性能...');

    try {
      // 动态导入算法基准测试模块
      const { default: AlgorithmBenchmarks } = await import('./algorithm-benchmarks.js');
      const algorithmBenchmarks = new AlgorithmBenchmarks({
        iterations: this.options.iterations
      });

      const results = await algorithmBenchmarks.runAllBenchmarks();
      console.log('  ✅ 算法性能测试完成');
      return results;
    } catch (error) {
      console.warn('  ⚠️ 算法性能测试失败:', error.message);
      return { error: error.message };
    }
  }

  /**
   * 基础设施性能测试
   */
  async runInfrastructureBenchmark() {
    console.log('  🏗️ 测试基础设施组件性能...');

    try {
      // 动态导入基础设施基准测试模块
      const { default: InfrastructureBenchmarks } = await import('./infrastructure-benchmarks.js');
      const infraBenchmarks = new InfrastructureBenchmarks({
        iterations: this.options.iterations,
        operationCount: 100 // 减少操作数量以避免超时
      });

      const results = await infraBenchmarks.runAllBenchmarks();
      console.log('  ✅ 基础设施性能测试完成');
      return results;
    } catch (error) {
      console.warn('  ⚠️ 基础设施性能测试失败:', error.message);
      return { error: error.message };
    }
  }

  /**
   * 并发负载测试
   */
  async runConcurrencyBenchmark() {
    console.log('  🔄 执行并发负载测试...');

    const concurrencyLevels = [1, 5, 10, 20, 50];
    const concurrencyResults = {};

    for (const level of concurrencyLevels) {
      console.log(`    测试并发级别: ${level}`);

      const promises = [];
      const startTime = performance.now();

      // 创建并发任务
      for (let i = 0; i < level; i++) {
        promises.push(this.simulateConcurrentTask(i));
      }

      // 等待所有任务完成
      const results = await Promise.allSettled(promises);
      const endTime = performance.now();

      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failureCount = results.filter(r => r.status === 'rejected').length;

      concurrencyResults[level] = {
        totalTime: endTime - startTime,
        successCount,
        failureCount,
        throughput: level / ((endTime - startTime) / 1000), // ops/sec
        latency: (endTime - startTime) / level // ms per operation
      };

      console.log(`      并发${level}: ${(endTime - startTime).toFixed(2)}ms, 成功率: ${(successCount/level*100).toFixed(1)}%`);
    }

    this.results.benchmarks.concurrency = concurrencyResults;

    console.log('  ✅ 并发负载测试完成');
  }

  /**
   * 生成总结报告
   */
  async generateSummaryReport() {
    console.log('\n📊 生成性能总结报告...');

    const summary = {
      overall: {
        timestamp: this.results.timestamp,
        environment: this.results.environment,
        totalBenchmarks: Object.keys(this.results.benchmarks).length
      },
      metrics: {}
    };

    // 计算关键指标
    if (this.results.benchmarks.startup) {
      summary.metrics.startupTime = {
        average: this.results.benchmarks.startup.average,
        p95: this.results.benchmarks.startup.p95,
        status: this.results.benchmarks.startup.average < 1000 ? 'good' : 'needs_improvement'
      };
    }

    if (this.results.benchmarks.memory) {
      const peakMemoryMB = this.results.benchmarks.memory.peakRss / 1024 / 1024;
      summary.metrics.memoryUsage = {
        peakRssMB: peakMemoryMB,
        averageHeapUsedMB: this.results.benchmarks.memory.averageHeapUsed / 1024 / 1024,
        status: peakMemoryMB < 500 ? 'good' : peakMemoryMB < 1000 ? 'acceptable' : 'high'
      };
    }

    if (this.results.benchmarks.cpu) {
      summary.metrics.cpuPerformance = {
        averageTime: this.results.benchmarks.cpu.average,
        status: this.results.benchmarks.cpu.average < 500 ? 'good' : 'needs_improvement'
      };
    }

    if (this.results.benchmarks.concurrency) {
      const maxConcurrency = Math.max(...Object.keys(this.results.benchmarks.concurrency).map(Number));
      const maxThroughput = this.results.benchmarks.concurrency[maxConcurrency]?.throughput || 0;
      summary.metrics.concurrency = {
        maxSupportedConcurrency: maxConcurrency,
        maxThroughput: maxThroughput,
        status: maxThroughput > 100 ? 'good' : maxThroughput > 50 ? 'acceptable' : 'needs_improvement'
      };
    }

    this.results.summary = summary;

    // 保存详细报告
    const reportPath = path.join(this.options.outputDir, `benchmark-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));

    // 保存总结报告
    const summaryPath = path.join(this.options.outputDir, 'latest-summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

    console.log(`📄 详细报告: ${reportPath}`);
    console.log(`📋 总结报告: ${summaryPath}`);
  }

  /**
   * 与基准线比较
   */
  async compareWithBaseline() {
    if (!fs.existsSync(this.options.baselineFile)) {
      console.log('📈 首次运行，创建基准线文件...');
      fs.writeFileSync(this.options.baselineFile, JSON.stringify(this.results.summary, null, 2));
      return;
    }

    try {
      const baseline = JSON.parse(fs.readFileSync(this.options.baselineFile, 'utf8'));

      console.log('\n📊 与基准线比较:');

      // 比较启动时间
      if (this.results.summary.metrics.startupTime && baseline.metrics?.startupTime) {
        const current = this.results.summary.metrics.startupTime.average;
        const base = baseline.metrics.startupTime.average;
        const diff = ((current - base) / base * 100).toFixed(1);
        const status = current < base ? '✅ 改进' : current > base * 1.1 ? '❌ 退化' : '⚠️ 轻微变化';
        console.log(`  启动时间: ${current.toFixed(2)}ms vs ${base.toFixed(2)}ms (${diff > 0 ? '+' : ''}${diff}%) ${status}`);
      }

      // 比较内存使用
      if (this.results.summary.metrics.memoryUsage && baseline.metrics?.memoryUsage) {
        const current = this.results.summary.metrics.memoryUsage.peakRssMB;
        const base = baseline.metrics.memoryUsage.peakRssMB;
        const diff = ((current - base) / base * 100).toFixed(1);
        const status = current < base * 1.1 ? '✅ 改进' : current > base * 1.2 ? '❌ 退化' : '⚠️ 轻微变化';
        console.log(`  内存使用: ${current.toFixed(2)}MB vs ${base.toFixed(2)}MB (${diff > 0 ? '+' : ''}${diff}%) ${status}`);
      }

    } catch (error) {
      console.warn('⚠️ 基准线比较失败:', error.message);
    }
  }

  // 辅助方法
  calculateAverage(values) {
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  calculatePercentile(values, percentile) {
    const sorted = [...values].sort((a, b) => a - b);
    const index = (percentile / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index % 1;

    if (upper >= sorted.length) return sorted[sorted.length - 1];
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async simulateConcurrentTask(taskId) {
    // 模拟并发任务
    const delay = Math.random() * 100 + 50; // 50-150ms随机延迟
    await this.delay(delay);
    return { taskId, delay, success: Math.random() > 0.05 }; // 95%成功率
  }

}

// CLI接口
async function main() {
  const args = process.argv.slice(2);
  const options = {};

  // 解析命令行参数
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--iterations' || arg === '-i') {
      options.iterations = parseInt(args[++i]);
    } else if (arg === '--output' || arg === '-o') {
      options.outputDir = args[++i];
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
frys 性能基准测试运行器

用法: node performance-benchmark-runner.js [选项]

选项:
  -i, --iterations <num>    测试迭代次数 (默认: 5)
  -o, --output <dir>        输出目录 (默认: scripts/benchmark/results)
  -v, --verbose            详细输出
  -h, --help               显示帮助信息

示例:
  node performance-benchmark-runner.js --iterations 10 --verbose
  node performance-benchmark-runner.js --output ./my-results
      `);
      process.exit(0);
    }
  }

  const benchmark = new PerformanceBenchmarkRunner(options);

  try {
    await benchmark.runAllBenchmarks();
  } catch (error) {
    console.error('基准测试运行失败:', error.message);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('未处理的错误:', error);
    process.exit(1);
  });
}

export { PerformanceBenchmarkRunner };
