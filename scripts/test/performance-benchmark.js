#!/usr/bin/env node

/**
 * 性能基准测试脚本
 * 运行各种性能测试并生成基准报告
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

class PerformanceBenchmark {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      environment: this.getEnvironmentInfo(),
      benchmarks: {},
    };
  }

  async run() {
    console.log('⚡ 开始性能基准测试...');

    try {
      await this.runStartupBenchmark();
      await this.runMemoryBenchmark();
      await this.runCPUBenchmark();
      await this.runAPIBenchmark();
      await this.runDatabaseBenchmark();

      await this.generateBenchmarkReport();
      await this.compareWithBaseline();

      console.log('✅ 性能基准测试完成');
    } catch (error) {
      console.error('❌ 性能基准测试失败:', error.message);
      process.exit(1);
    }
  }

  getEnvironmentInfo() {
    return {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      cpus: require('os').cpus().length,
      totalMemory: require('os').totalmem(),
      freeMemory: require('os').freemem(),
    };
  }

  async runStartupBenchmark() {
    console.log('🚀 测试应用启动性能...');

    const results = [];

    // 测试冷启动时间
    for (let i = 0; i < 3; i++) {
      const startTime = process.hrtime.bigint();

      try {
        // 这里可以替换为实际的启动命令
        execSync('timeout 10s npm run start || true', {
          cwd: rootDir,
          stdio: 'pipe'
        });
      } catch (error) {
        // 预期会因为timeout而失败
      }

      const endTime = process.hrtime.bigint();
      const startupTime = Number(endTime - startTime) / 1e6; // 转换为毫秒

      results.push(startupTime);
      console.log(`  冷启动 ${i + 1}: ${startupTime.toFixed(2)}ms`);
    }

    this.results.benchmarks.startup = {
      coldStart: {
        min: Math.min(...results),
        max: Math.max(...results),
        avg: results.reduce((a, b) => a + b, 0) / results.length,
        samples: results,
      },
    };
  }

  async runMemoryBenchmark() {
    console.log('💾 测试内存使用情况...');

    // 运行内存压力测试
    const memoryResults = {
      rss: [],
      heapUsed: [],
      heapTotal: [],
      external: [],
    };

    // 这里可以运行内存密集型的测试
    // 暂时使用简单的内存监控

    for (let i = 0; i < 5; i++) {
      // 强制垃圾回收（如果可用）
      if (global.gc) {
        global.gc();
      }

      const memUsage = process.memoryUsage();
      memoryResults.rss.push(memUsage.rss);
      memoryResults.heapUsed.push(memUsage.heapUsed);
      memoryResults.heapTotal.push(memUsage.heapTotal);
      memoryResults.external.push(memUsage.external);

      await this.sleep(100);
    }

    this.results.benchmarks.memory = {
      peak: {
        rss: Math.max(...memoryResults.rss),
        heapUsed: Math.max(...memoryResults.heapUsed),
        heapTotal: Math.max(...memoryResults.heapTotal),
        external: Math.max(...memoryResults.external),
      },
      average: {
        rss: memoryResults.rss.reduce((a, b) => a + b, 0) / memoryResults.rss.length,
        heapUsed: memoryResults.heapUsed.reduce((a, b) => a + b, 0) / memoryResults.heapUsed.length,
        heapTotal: memoryResults.heapTotal.reduce((a, b) => a + b, 0) / memoryResults.heapTotal.length,
        external: memoryResults.external.reduce((a, b) => a + b, 0) / memoryResults.external.length,
      },
    };

    console.log(`  峰值内存使用: ${(this.results.benchmarks.memory.peak.heapUsed / 1024 / 1024).toFixed(2)}MB`);
  }

  async runCPUBenchmark() {
    console.log('🖥️  测试CPU性能...');

    const startTime = process.hrtime.bigint();
    const startUsage = process.cpuUsage();

    // 执行CPU密集型任务
    let result = 0;
    for (let i = 0; i < 1000000; i++) {
      result += Math.sin(i) * Math.cos(i);
    }

    const endTime = process.hrtime.bigint();
    const endUsage = process.cpuUsage(startUsage);

    const executionTime = Number(endTime - startTime) / 1e6; // 毫秒
    const cpuTime = (endUsage.user + endUsage.system) / 1000; // 毫秒

    this.results.benchmarks.cpu = {
      executionTime,
      cpuTime,
      efficiency: cpuTime / executionTime,
      result, // 确保计算被执行
    };

    console.log(`  CPU执行时间: ${cpuTime.toFixed(2)}ms`);
    console.log(`  总执行时间: ${executionTime.toFixed(2)}ms`);
  }

  async runAPIBenchmark() {
    console.log('🔌 测试API性能...');

    // 这里可以添加API性能测试
    // 例如：测试不同端点的响应时间、并发处理能力等

    this.results.benchmarks.api = {
      endpoints: {},
      concurrent: {},
      latency: {},
    };

    // 示例：测试健康检查端点
    try {
      const startTime = Date.now();
      execSync('curl -f http://localhost:3000/health || echo "Service not running"', {
        timeout: 5000,
        stdio: 'pipe'
      });
      const responseTime = Date.now() - startTime;

      this.results.benchmarks.api.endpoints.health = {
        responseTime,
        status: 'success',
      };
    } catch (error) {
      this.results.benchmarks.api.endpoints.health = {
        status: 'failed',
        error: error.message,
      };
    }
  }

  async runDatabaseBenchmark() {
    console.log('🗄️  测试数据库性能...');

    // 这里可以添加数据库性能测试
    // 例如：连接时间、查询性能、并发操作等

    this.results.benchmarks.database = {
      connections: {},
      queries: {},
      transactions: {},
    };

    console.log('  数据库基准测试暂未实现');
  }

  async generateBenchmarkReport() {
    const reportPath = path.join(rootDir, 'test-results', 'benchmark-report.json');
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));

    // 生成人类可读的报告
    const summaryPath = path.join(rootDir, 'test-results', 'benchmark-summary.txt');
    const summary = this.generateBenchmarkSummary();
    fs.writeFileSync(summaryPath, summary);

    console.log('📊 基准测试报告已生成');
  }

  generateBenchmarkSummary() {
    const results = this.results;

    return `
性能基准测试报告
==================

生成时间: ${new Date(results.timestamp).toLocaleString('zh-CN')}

环境信息:
- Node.js版本: ${results.environment.nodeVersion}
- 平台: ${results.environment.platform}
- CPU核心数: ${results.environment.cpus}
- 总内存: ${(results.environment.totalMemory / 1024 / 1024 / 1024).toFixed(2)}GB

启动性能:
${results.benchmarks.startup ? `
- 冷启动时间:
  • 最小: ${results.benchmarks.startup.coldStart.min.toFixed(2)}ms
  • 最大: ${results.benchmarks.startup.coldStart.max.toFixed(2)}ms
  • 平均: ${results.benchmarks.startup.coldStart.avg.toFixed(2)}ms
` : '- 未测试'}

内存使用:
${results.benchmarks.memory ? `
- 峰值堆使用: ${(results.benchmarks.memory.peak.heapUsed / 1024 / 1024).toFixed(2)}MB
- 平均堆使用: ${(results.benchmarks.memory.average.heapUsed / 1024 / 1024).toFixed(2)}MB
- RSS峰值: ${(results.benchmarks.memory.peak.rss / 1024 / 1024).toFixed(2)}MB
` : '- 未测试'}

CPU性能:
${results.benchmarks.cpu ? `
- CPU时间: ${results.benchmarks.cpu.cpuTime.toFixed(2)}ms
- 执行时间: ${results.benchmarks.cpu.executionTime.toFixed(2)}ms
- CPU效率: ${(results.benchmarks.cpu.efficiency * 100).toFixed(2)}%
` : '- 未测试'}

API性能:
${results.benchmarks.api.endpoints.health ? `
- 健康检查响应时间: ${results.benchmarks.api.endpoints.health.responseTime || 'N/A'}ms
- 状态: ${results.benchmarks.api.endpoints.health.status}
` : '- 未测试'}
`;
  }

  async compareWithBaseline() {
    const baselinePath = path.join(rootDir, 'test-results', 'benchmark-baseline.json');

    if (!fs.existsSync(baselinePath)) {
      console.log('📝 保存当前结果作为基准线');
      fs.writeFileSync(baselinePath, JSON.stringify(this.results, null, 2));
      return;
    }

    const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
    const comparison = this.compareBenchmarks(baseline, this.results);

    const comparisonPath = path.join(rootDir, 'test-results', 'benchmark-comparison.json');
    fs.writeFileSync(comparisonPath, JSON.stringify(comparison, null, 2));

    console.log('⚖️  基准线对比完成');
    this.logComparisonResults(comparison);
  }

  compareBenchmarks(baseline, current) {
    const comparison = {
      timestamp: new Date().toISOString(),
      baselineDate: baseline.timestamp,
      currentDate: current.timestamp,
      comparisons: {},
    };

    // 比较启动性能
    if (baseline.benchmarks.startup && current.benchmarks.startup) {
      comparison.comparisons.startup = {
        coldStart: this.compareMetric(
          baseline.benchmarks.startup.coldStart.avg,
          current.benchmarks.startup.coldStart.avg,
          'lower-better' // 更低的启动时间更好
        ),
      };
    }

    // 比较内存使用
    if (baseline.benchmarks.memory && current.benchmarks.memory) {
      comparison.comparisons.memory = {
        heapUsed: this.compareMetric(
          baseline.benchmarks.memory.peak.heapUsed,
          current.benchmarks.memory.peak.heapUsed,
          'lower-better'
        ),
      };
    }

    // 比较CPU性能
    if (baseline.benchmarks.cpu && current.benchmarks.cpu) {
      comparison.comparisons.cpu = {
        executionTime: this.compareMetric(
          baseline.benchmarks.cpu.executionTime,
          current.benchmarks.cpu.executionTime,
          'lower-better'
        ),
      };
    }

    return comparison;
  }

  compareMetric(baseline, current, preference = 'higher-better') {
    const diff = current - baseline;
    const percentChange = baseline !== 0 ? (diff / baseline) * 100 : 0;

    let status = 'unchanged';
    if (preference === 'lower-better') {
      if (percentChange < -5) status = 'improved';
      else if (percentChange > 5) status = 'regressed';
    } else {
      if (percentChange > 5) status = 'improved';
      else if (percentChange < -5) status = 'regressed';
    }

    return {
      baseline,
      current,
      difference: diff,
      percentChange,
      status,
    };
  }

  logComparisonResults(comparison) {
    console.log('\n📊 基准线对比结果:');

    Object.entries(comparison.comparisons).forEach(([category, metrics]) => {
      console.log(`\n${category.toUpperCase()}:`);
      Object.entries(metrics).forEach(([metric, result]) => {
        const statusEmoji = {
          improved: '✅',
          regressed: '❌',
          unchanged: '➖',
        }[result.status] || '❓';

        console.log(`  ${statusEmoji} ${metric}: ${result.percentChange.toFixed(2)}% (${result.status})`);
      });
    });
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  const benchmark = new PerformanceBenchmark();
  benchmark.run();
}

export default PerformanceBenchmark;
