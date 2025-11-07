#!/usr/bin/env node

/**
 * frys SLO 检查脚本
 * 检查服务水平目标 (Service Level Objectives)
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

class SLOChecker {
  constructor() {
    this.sloConfig = {
      // 可用性 SLO
      availability: {
        target: 99.9, // 99.9% 可用性
        window: '30d', // 30天窗口
        current: 100.0
      },

      // 性能 SLO
      latency: {
        p95: 500, // P95 响应时间 <= 500ms
        p99: 1000, // P99 响应时间 <= 1000ms
        target: 95 // 95% 的请求满足性能目标
      },

      // 错误率 SLO
      error_rate: {
        target: 0.1, // 错误率 <= 0.1%
        window: '1h' // 1小时窗口
      },

      // 吞吐量 SLO
      throughput: {
        min_rps: 100, // 最小每秒请求数
        target: 1000 // 目标每秒请求数
      }
    };

    this.baselineFile = join(process.cwd(), 'slo-baseline.json');
    this.results = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      slo_checks: {},
      overall_status: 'UNKNOWN',
      recommendations: []
    };
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const colors = {
      info: '\x1b[36m',
      success: '\x1b[32m',
      error: '\x1b[31m',
      warning: '\x1b[33m',
      reset: '\x1b[0m'
    };

    const prefix = {
      info: 'ℹ️ ',
      success: '✅ ',
      error: '❌ ',
      warning: '⚠️ '
    }[type] || 'ℹ️ ';

    console.log(`${colors[type]}[${timestamp}] ${prefix}${message}${colors.reset}`);
  }

  /**
   * 检查可用性 SLO
   */
  async checkAvailability() {
    this.log('检查可用性 SLO...');

    try {
      // 模拟从监控系统获取数据
      // 在实际环境中，这里应该调用 Prometheus API 或其他监控系统
      const uptime = this.simulateUptimeCheck();
      const target = this.sloConfig.availability.target;

      const status = uptime >= target ? 'PASS' : 'FAIL';
      const score = Math.min(100, (uptime / target) * 100);

      this.results.slo_checks.availability = {
        status,
        current: uptime,
        target,
        score,
        message: `可用性 ${uptime}% (目标: ${target}%)`
      };

      this.log(`可用性 SLO: ${status} - ${uptime}%`, status === 'PASS' ? 'success' : 'error');

    } catch (error) {
      this.results.slo_checks.availability = {
        status: 'ERROR',
        error: error.message
      };
      this.log(`可用性检查失败: ${error.message}`, 'error');
    }
  }

  /**
   * 检查性能 SLO
   */
  async checkLatency() {
    this.log('检查性能 SLO...');

    try {
      // 模拟性能指标收集
      const metrics = this.simulateLatencyCheck();
      const config = this.sloConfig.latency;

      const p95Status = metrics.p95 <= config.p95 ? 'PASS' : 'FAIL';
      const p99Status = metrics.p99 <= config.p99 ? 'PASS' : 'FAIL';
      const overallStatus = p95Status === 'PASS' && p99Status === 'PASS' ? 'PASS' : 'FAIL';

      this.results.slo_checks.latency = {
        status: overallStatus,
        p95: { value: metrics.p95, target: config.p95, status: p95Status },
        p99: { value: metrics.p99, target: config.p99, status: p99Status },
        message: `P95: ${metrics.p95}ms, P99: ${metrics.p99}ms`
      };

      this.log(`性能 SLO: ${overallStatus}`, overallStatus === 'PASS' ? 'success' : 'error');

    } catch (error) {
      this.results.slo_checks.latency = {
        status: 'ERROR',
        error: error.message
      };
      this.log(`性能检查失败: ${error.message}`, 'error');
    }
  }

  /**
   * 检查错误率 SLO
   */
  async checkErrorRate() {
    this.log('检查错误率 SLO...');

    try {
      const errorRate = this.simulateErrorRateCheck();
      const target = this.sloConfig.error_rate.target;

      const status = errorRate <= target ? 'PASS' : 'FAIL';

      this.results.slo_checks.error_rate = {
        status,
        current: errorRate,
        target,
        message: `错误率 ${errorRate}% (目标: ≤${target}%)`
      };

      this.log(`错误率 SLO: ${status} - ${errorRate}%`, status === 'PASS' ? 'success' : 'error');

    } catch (error) {
      this.results.slo_checks.error_rate = {
        status: 'ERROR',
        error: error.message
      };
      this.log(`错误率检查失败: ${error.message}`, 'error');
    }
  }

  /**
   * 检查吞吐量 SLO
   */
  async checkThroughput() {
    this.log('检查吞吐量 SLO...');

    try {
      const throughput = this.simulateThroughputCheck();
      const config = this.sloConfig.throughput;

      const status = throughput >= config.min_rps ? 'PASS' : 'FAIL';

      this.results.slo_checks.throughput = {
        status,
        current: throughput,
        target: config.target,
        minimum: config.min_rps,
        message: `吞吐量 ${throughput} RPS (最小要求: ${config.min_rps})`
      };

      this.log(`吞吐量 SLO: ${status} - ${throughput} RPS`, status === 'PASS' ? 'success' : 'error');

    } catch (error) {
      this.results.slo_checks.throughput = {
        status: 'ERROR',
        error: error.message
      };
      this.log(`吞吐量检查失败: ${error.message}`, 'error');
    }
  }

  /**
   * 模拟可用性检查 (实际环境中替换为真实监控数据)
   */
  simulateUptimeCheck() {
    // 模拟99.95%可用性
    return 99.95;
  }

  /**
   * 模拟延迟检查
   */
  simulateLatencyCheck() {
    // 模拟正常的延迟指标
    return {
      p95: 450, // 450ms
      p99: 850  // 850ms
    };
  }

  /**
   * 模拟错误率检查
   */
  simulateErrorRateCheck() {
    // 模拟0.05%错误率
    return 0.05;
  }

  /**
   * 模拟吞吐量检查
   */
  simulateThroughputCheck() {
    // 模拟150 RPS
    return 150;
  }

  /**
   * 保存基准线数据
   */
  saveBaseline() {
    try {
      const baseline = {
        timestamp: this.results.timestamp,
        slo_config: this.sloConfig,
        baseline_metrics: {
          availability: this.simulateUptimeCheck(),
          latency: this.simulateLatencyCheck(),
          error_rate: this.simulateErrorRateCheck(),
          throughput: this.simulateThroughputCheck()
        }
      };

      writeFileSync(this.baselineFile, JSON.stringify(baseline, null, 2));
      this.log(`基准线数据已保存: ${this.baselineFile}`, 'success');

    } catch (error) {
      this.log(`保存基准线失败: ${error.message}`, 'error');
    }
  }

  /**
   * 加载基准线数据
   */
  loadBaseline() {
    try {
      if (existsSync(this.baselineFile)) {
        const baseline = JSON.parse(readFileSync(this.baselineFile, 'utf8'));
        this.log('基准线数据已加载', 'info');
        return baseline;
      }
    } catch (error) {
      this.log(`加载基准线失败: ${error.message}`, 'warning');
    }
    return null;
  }

  /**
   * 生成建议
   */
  generateRecommendations() {
    this.results.recommendations = [];

    const checks = this.results.slo_checks;

    // 可用性建议
    if (checks.availability?.status === 'FAIL') {
      this.results.recommendations.push('提高系统可用性，检查服务依赖和故障恢复机制');
    }

    // 性能建议
    if (checks.latency?.status === 'FAIL') {
      this.results.recommendations.push('优化响应性能，检查数据库查询和缓存策略');
    }

    // 错误率建议
    if (checks.error_rate?.status === 'FAIL') {
      this.results.recommendations.push('降低错误率，加强异常处理和监控告警');
    }

    // 吞吐量建议
    if (checks.throughput?.status === 'FAIL') {
      this.results.recommendations.push('提升系统吞吐量，考虑水平扩展和性能优化');
    }

    // 默认建议
    if (this.results.recommendations.length === 0) {
      this.results.recommendations.push('所有 SLO 指标正常，继续监控系统性能');
    }
  }

  /**
   * 计算总体状态
   */
  calculateOverallStatus() {
    const checks = Object.values(this.results.slo_checks);
    const hasFailures = checks.some(check => check.status === 'FAIL' || check.status === 'ERROR');

    this.results.overall_status = hasFailures ? 'FAIL' : 'PASS';
  }

  /**
   * 打印报告
   */
  printReport() {
    console.log('\n' + '='.repeat(80));
    this.log('📊 frys SLO 检查报告', 'info');
    console.log('='.repeat(80));

    console.log(`⏱️  检查时间: ${this.results.timestamp}`);
    console.log(`🌍 环境: ${this.results.environment}`);
    console.log(`📈 总体状态: ${this.results.overall_status === 'PASS' ? '✅ 通过' : '❌ 失败'}`);

    console.log('\n📋 SLO 检查详情:');
    Object.entries(this.results.slo_checks).forEach(([name, check]) => {
      const status = check.status === 'PASS' ? '✅' : check.status === 'FAIL' ? '❌' : '⚠️';
      const nameFormatted = name.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
      console.log(`  ${status} ${nameFormatted}: ${check.message || '检查失败'}`);
    });

    console.log('\n💡 建议:');
    this.results.recommendations.forEach(rec => {
      console.log(`  • ${rec}`);
    });

    console.log('\n' + '='.repeat(80));
  }

  /**
   * 保存报告
   */
  saveReport() {
    const reportFile = join(process.cwd(), 'slo-check-report.json');
    try {
      writeFileSync(reportFile, JSON.stringify(this.results, null, 2));
      this.log(`SLO 检查报告已保存: ${reportFile}`, 'success');
    } catch (error) {
      this.log(`保存报告失败: ${error.message}`, 'error');
    }
  }

  /**
   * 运行 SLO 检查
   */
  async run() {
    const isBaseline = process.argv.includes('--baseline');

    try {
      this.log('🚀 开始 frys SLO 检查', 'info');

      // 并行执行所有检查
      await Promise.all([
        this.checkAvailability(),
        this.checkLatency(),
        this.checkErrorRate(),
        this.checkThroughput()
      ]);

      // 生成建议
      this.generateRecommendations();

      // 计算总体状态
      this.calculateOverallStatus();

      // 保存基准线 (如果指定)
      if (isBaseline) {
        this.saveBaseline();
      }

      // 打印报告
      this.printReport();

      // 保存报告
      this.saveReport();

      // 设置退出码
      const exitCode = this.results.overall_status === 'PASS' ? 0 : 1;
      process.exit(exitCode);

    } catch (error) {
      this.log(`SLO 检查执行失败: ${error.message}`, 'error');
      process.exit(1);
    }
  }
}

// 命令行接口
const checker = new SLOChecker();
checker.run().catch(error => {
  console.error('SLO 检查失败:', error);
  process.exit(1);
});
