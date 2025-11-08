#!/usr/bin/env node

/**
 * 负载生成器
 * 模拟用户请求生成测试负载
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class LoadGenerator {
  constructor(options = {}) {
    this.targetUrl = options.targetUrl || 'http://localhost:3000';
    this.duration = options.duration || 60000; // 1分钟
    this.concurrency = options.concurrency || 10; // 并发数
    this.rampUp = options.rampUp || 5000; // 启动时间
    this.requests = [];
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      responseTimes: [],
      errors: []
    };

    this.isRunning = false;
    this.startTime = null;
  }

  async start() {
    if (this.isRunning) {
      console.log('⚠️  负载生成器已经在运行中');
      return;
    }

    this.isRunning = true;
    this.startTime = Date.now();

    console.log('🚀 启动负载生成器...');
    console.log(`🎯 目标URL: ${this.targetUrl}`);
    console.log(`⏱️  测试时长: ${this.duration / 1000}秒`);
    console.log(`👥 并发数: ${this.concurrency}`);
    console.log(`📈 启动时间: ${this.rampUp / 1000}秒`);

    // 启动负载生成
    await this.generateLoad();

    return this;
  }

  async generateLoad() {
    const workers = [];

    // 创建工作进程
    for (let i = 0; i < this.concurrency; i++) {
      workers.push(this.createWorker(i));
    }

    // 等待所有工作进程完成
    await Promise.all(workers);

    this.printResults();
  }

  createWorker(workerId) {
    return new Promise((resolve) => {
      const worker = spawn('node', ['-e', this.generateWorkerScript(workerId)], {
        cwd: __dirname,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';

      worker.stdout.on('data', (data) => {
        output += data.toString();
      });

      worker.stderr.on('data', (data) => {
        console.error(`Worker ${workerId} error:`, data.toString());
      });

      worker.on('close', (code) => {
        try {
          const workerStats = JSON.parse(output.trim());
          this.mergeStats(workerStats);
        } catch (error) {
          console.error(`Worker ${workerId} output parse error:`, error);
        }
        resolve();
      });

      // 设置worker超时
      setTimeout(() => {
        worker.kill();
        resolve();
      }, this.duration + 5000);
    });
  }

  generateWorkerScript(workerId) {
    return `
      const stats = {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        responseTimes: [],
        errors: []
      };

      const targetUrl = '${this.targetUrl}';
      const duration = ${this.duration};
      const workerId = ${workerId};

      async function makeRequest(endpoint, method = 'GET', body = null) {
        const startTime = Date.now();
        stats.totalRequests++;

        try {
          const options = {
            method,
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'frys-load-generator/1.0'
            }
          };

          if (body) {
            options.body = JSON.stringify(body);
          }

          const response = await fetch(\`\${targetUrl}\${endpoint}\`, options);

          if (response.ok) {
            stats.successfulRequests++;
          } else {
            stats.failedRequests++;
            stats.errors.push(\`HTTP \${response.status}: \${response.statusText}\`);
          }

          stats.responseTimes.push(Date.now() - startTime);

        } catch (error) {
          stats.failedRequests++;
          stats.errors.push(error.message);
        }
      }

      async function simulateUser() {
        const userId = \`load_test_user_\${workerId}_\${Date.now()}\`;

        // 模拟用户行为模式
        const actions = [
          // 健康检查
          () => makeRequest('/health'),

          // 创建对话
          () => makeRequest('/api/ai/conversations', 'POST', {
            userId,
            sessionId: \`session_\${workerId}\`,
            model: 'openai',
            memory: true
          }),

          // 发送消息
          () => makeRequest('/api/ai/conversations/conv_123/messages', 'POST', {
            message: '你好，这是一个负载测试消息'
          }),

          // 获取对话历史
          () => makeRequest('/api/ai/conversations/conv_123/history'),

          // LangChain测试
          () => makeRequest('/api/ai/langchain/chains', 'POST', {
            model: 'openai',
            memoryType: 'buffer'
          }),

          // 记忆存储测试
          () => makeRequest('/api/ai/memory/store', 'POST', {
            content: \`测试记忆内容 from user \${userId}\`,
            type: 'conversation',
            userId,
            tags: ['test', 'load']
          }),

          // 记忆检索测试
          () => makeRequest('/api/ai/memory/search', 'POST', {
            query: '测试',
            options: { userId, limit: 5 }
          })
        ];

        const endTime = Date.now() + duration;

        while (Date.now() < endTime) {
          // 随机选择一个动作
          const action = actions[Math.floor(Math.random() * actions.length)];
          await action();

          // 随机延迟 100-1000ms
          await new Promise(resolve => setTimeout(resolve, Math.random() * 900 + 100));
        }
      }

      // 延迟启动以实现渐进负载
      setTimeout(() => {
        simulateUser().then(() => {
          console.log(JSON.stringify(stats));
        });
      }, Math.random() * ${this.rampUp});
    `;
  }

  mergeStats(workerStats) {
    this.stats.totalRequests += workerStats.totalRequests;
    this.stats.successfulRequests += workerStats.successfulRequests;
    this.stats.failedRequests += workerStats.failedRequests;
    this.stats.responseTimes.push(...workerStats.responseTimes);
    this.stats.errors.push(...workerStats.errors);
  }

  printResults() {
    const duration = Date.now() - this.startTime;
    const successRate = this.stats.totalRequests > 0
      ? (this.stats.successfulRequests / this.stats.totalRequests * 100).toFixed(2)
      : 0;

    const avgResponseTime = this.stats.responseTimes.length > 0
      ? (this.stats.responseTimes.reduce((a, b) => a + b, 0) / this.stats.responseTimes.length).toFixed(2)
      : 0;

    const p95ResponseTime = this.calculatePercentile(this.stats.responseTimes, 95);
    const p99ResponseTime = this.calculatePercentile(this.stats.responseTimes, 99);
    const requestsPerSecond = (this.stats.totalRequests / (duration / 1000)).toFixed(2);

    console.log('\n' + '='.repeat(60));
    console.log('📊 负载测试结果');
    console.log('='.repeat(60));
    console.log(`测试时长: ${(duration / 1000).toFixed(2)}秒`);
    console.log(`总请求数: ${this.stats.totalRequests}`);
    console.log(`成功请求: ${this.stats.successfulRequests}`);
    console.log(`失败请求: ${this.stats.failedRequests}`);
    console.log(`成功率: ${successRate}%`);
    console.log(`平均响应时间: ${avgResponseTime}ms`);
    console.log(`P95响应时间: ${p95ResponseTime}ms`);
    console.log(`P99响应时间: ${p99ResponseTime}ms`);
    console.log(`QPS (每秒请求数): ${requestsPerSecond}`);
    console.log('='.repeat(60));

    if (this.stats.errors.length > 0) {
      console.log('\n❌ 错误统计 (前10个):');
      const errorCounts = {};
      this.stats.errors.forEach(error => {
        errorCounts[error] = (errorCounts[error] || 0) + 1;
      });

      Object.entries(errorCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .forEach(([error, count]) => {
          console.log(`  ${error}: ${count}次`);
        });
    }

    // 生成详细报告
    this.generateDetailedReport();
  }

  calculatePercentile(values, percentile) {
    if (values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  generateDetailedReport() {
    const report = {
      timestamp: new Date().toISOString(),
      configuration: {
        targetUrl: this.targetUrl,
        duration: this.duration,
        concurrency: this.concurrency,
        rampUp: this.rampUp
      },
      results: {
        ...this.stats,
        successRate: this.stats.totalRequests > 0
          ? (this.stats.successfulRequests / this.stats.totalRequests * 100)
          : 0,
        avgResponseTime: this.stats.responseTimes.length > 0
          ? this.stats.responseTimes.reduce((a, b) => a + b, 0) / this.stats.responseTimes.length
          : 0,
        minResponseTime: this.stats.responseTimes.length > 0 ? Math.min(...this.stats.responseTimes) : 0,
        maxResponseTime: this.stats.responseTimes.length > 0 ? Math.max(...this.stats.responseTimes) : 0,
        p50ResponseTime: this.calculatePercentile(this.stats.responseTimes, 50),
        p95ResponseTime: this.calculatePercentile(this.stats.responseTimes, 95),
        p99ResponseTime: this.calculatePercentile(this.stats.responseTimes, 99),
        requestsPerSecond: this.stats.totalRequests / ((Date.now() - this.startTime) / 1000)
      },
      errorSummary: this.summarizeErrors()
    };

    const reportPath = path.join(__dirname, '../reports/load-test-report.json');

    // 确保reports目录存在
    const reportsDir = path.dirname(reportPath);
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📄 详细报告已保存: ${reportPath}`);
  }

  summarizeErrors() {
    const errorCounts = {};
    this.stats.errors.forEach(error => {
      errorCounts[error] = (errorCounts[error] || 0) + 1;
    });

    return Object.entries(errorCounts)
      .sort(([, a], [, b]) => b - a)
      .map(([error, count]) => ({ error, count }));
  }

  // 静态方法：快速负载测试
  static async quickTest(targetUrl, duration = 10000, concurrency = 5) {
    console.log('⚡ 快速负载测试开始...');

    const generator = new LoadGenerator({
      targetUrl,
      duration,
      concurrency,
      rampUp: 1000
    });

    await generator.start();
    return generator.stats;
  }

  // 静态方法：压力测试
  static async stressTest(targetUrl, maxConcurrency = 50, duration = 30000) {
    console.log('💪 压力测试开始...');

    const results = [];

    for (let concurrency = 5; concurrency <= maxConcurrency; concurrency += 5) {
      console.log(`\n🔄 测试并发数: ${concurrency}`);

      const generator = new LoadGenerator({
        targetUrl,
        duration,
        concurrency,
        rampUp: 2000
      });

      await generator.start();

      results.push({
        concurrency,
        ...generator.stats,
        successRate: generator.stats.totalRequests > 0
          ? (generator.stats.successfulRequests / generator.stats.totalRequests * 100)
          : 0,
        avgResponseTime: generator.stats.responseTimes.length > 0
          ? generator.stats.responseTimes.reduce((a, b) => a + b, 0) / generator.stats.responseTimes.length
          : 0,
        requestsPerSecond: generator.stats.totalRequests / (duration / 1000)
      });
    }

    // 生成压力测试报告
    const report = {
      timestamp: new Date().toISOString(),
      targetUrl,
      duration,
      results
    };

    const reportPath = path.join(__dirname, '../reports/stress-test-report.json');
    const reportsDir = path.dirname(reportPath);
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log('\n📊 压力测试完成');
    console.log(`📄 报告已保存: ${reportPath}`);

    return results;
  }
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  const main = async () => {
    const args = process.argv.slice(2);

    if (args.length === 0) {
      console.log('使用方法:');
      console.log('  node load-generator.js <target-url> [options]');
      console.log('选项:');
      console.log('  --duration <ms>     测试时长 (默认: 60000)');
      console.log('  --concurrency <n>   并发数 (默认: 10)');
      console.log('  --ramp-up <ms>      启动时间 (默认: 5000)');
      console.log('  --quick             快速测试 (10秒, 5并发)');
      console.log('  --stress            压力测试 (逐步增加并发数)');
      console.log('示例:');
      console.log('  node load-generator.js http://localhost:3000 --duration 30000 --concurrency 20');
      console.log('  node load-generator.js http://localhost:3000 --quick');
      console.log('  node load-generator.js http://localhost:3000 --stress');
      process.exit(1);
    }

    const targetUrl = args[0];
    const options = {};

    for (let i = 1; i < args.length; i++) {
      switch (args[i]) {
        case '--duration':
          options.duration = parseInt(args[++i]);
          break;
        case '--concurrency':
          options.concurrency = parseInt(args[++i]);
          break;
        case '--ramp-up':
          options.rampUp = parseInt(args[++i]);
          break;
        case '--quick':
          try {
            await LoadGenerator.quickTest(targetUrl);
            console.log('✅ 快速测试完成');
            return;
          } catch (error) {
            console.error('❌ 快速测试失败:', error.message);
            process.exit(1);
          }
        case '--stress':
          try {
            await LoadGenerator.stressTest(targetUrl);
            console.log('✅ 压力测试完成');
            return;
          } catch (error) {
            console.error('❌ 压力测试失败:', error.message);
            process.exit(1);
          }
        default:
          console.log(`未知选项: ${args[i]}`);
          process.exit(1);
      }
    }

    // 启动标准负载测试
    const generator = new LoadGenerator({
      targetUrl,
      ...options
    });

    try {
      await generator.start();
    } catch (error) {
      console.error('❌ 负载测试失败:', error.message);
      process.exit(1);
    }

    // 处理退出信号
    process.on('SIGINT', () => {
      console.log('\n⏹️  正在停止负载测试...');
      generator.isRunning = false;
      process.exit(0);
    });
  };

  main().catch(error => {
    console.error('❌ 程序执行失败:', error.message);
    process.exit(1);
  });
}

export { LoadGenerator };
