#!/usr/bin/env node

/**
 * frys 工业级质量检查系统 - 智能快速失败机制
 * 并发执行质量检查，支持优先级调度、缓存和详细报告
 */

import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { createHash } from 'crypto';
import os from 'os';

// 信号量实现，用于控制并发
class Semaphore {
  constructor(maxConcurrency) {
    this.maxConcurrency = maxConcurrency;
    this.currentCount = 0;
    this.waitQueue = [];
  }

  async acquire() {
    return new Promise((resolve) => {
      if (this.currentCount < this.maxConcurrency) {
        this.currentCount++;
        resolve();
      } else {
        this.waitQueue.push(resolve);
      }
    });
  }

  release() {
    this.currentCount--;
    if (this.waitQueue.length > 0) {
      this.currentCount++;
      const resolve = this.waitQueue.shift();
      resolve();
    }
  }
}

const __dirname = dirname(fileURLToPath(import.meta.url));

class IndustrialQualityChecker {
  constructor(config = {}) {
    this.config = {
      maxConcurrency: config.maxConcurrency || Math.max(1, os.cpus().length - 1),
      failFast: config.failFast !== false, // 默认启用快速失败
      cacheEnabled: config.cacheEnabled !== false,
      reportFormat: config.reportFormat || 'json',
      cacheDir: config.cacheDir || join(process.cwd(), '.quality-cache'),
      timeout: config.timeout || 300000, // 5分钟超时
      // 新增：简化模式，减少与CI/CD流水线的重复
      simplified: config.simplified || false,
      ...config
    };

    this.checks = this.loadChecks();
    this.running = new Map();
    this.completed = new Map();
    this.failed = false;
    this.startTime = Date.now();
    this.cache = new Map();

    // 确保缓存目录存在
    if (this.config.cacheEnabled && !existsSync(this.config.cacheDir)) {
      mkdirSync(this.config.cacheDir, { recursive: true });
    }

    if (this.config.simplified) {
      this.log('🔄 运行简化质量检查模式 (减少重复)', 'info');
    }
  }

  loadChecks() {
    let checks = [];

    if (this.config.simplified) {
      // 简化模式：只运行核心检查，避免与CI/CD流水线重复
      checks = [
        {
          id: 'eslint',
          name: 'ESLint 代码规范检查',
          command: 'npm',
          args: ['run', 'lint'],
          cwd: process.cwd(),
          priority: 1,
          timeout: 60000,
          category: 'linting'
        },
        {
          id: 'prettier',
          name: 'Prettier 代码格式检查',
          command: 'npm',
          args: ['run', 'format:check'],
          cwd: process.cwd(),
          priority: 2,
          timeout: 30000,
          category: 'formatting'
        },
        {
          id: 'industrial-security-audit',
          name: '工业级安全审计 (简化版)',
          command: 'node',
          args: ['scripts/security-audit.js', '--quick'],
          cwd: process.cwd(),
          priority: 3,
          timeout: 180000, // 缩短超时时间
          category: 'security'
        }
      ];
    } else {
      // 完整模式：运行所有检查
      checks = [
        {
          id: 'eslint',
          name: 'ESLint 代码规范检查',
          command: 'npm',
          args: ['run', 'lint'],
          cwd: process.cwd(),
          priority: 1,
          timeout: 60000,
          category: 'linting'
        },
        {
          id: 'prettier',
          name: 'Prettier 代码格式检查',
          command: 'npm',
          args: ['run', 'format:check'],
          cwd: process.cwd(),
          priority: 2,
          timeout: 30000,
          category: 'formatting'
        },
        {
          id: 'security-audit',
          name: '安全漏洞扫描',
          command: 'npm',
          args: ['audit', '--audit-level=moderate'],
          cwd: process.cwd(),
          priority: 4,
          timeout: 120000,
          category: 'security'
        },
        {
          id: 'industrial-security-audit',
          name: '工业级安全审计',
          command: 'node',
          args: ['scripts/security-audit.js'],
          cwd: process.cwd(),
          priority: 3, // 比npm audit优先级更高
          timeout: 300000,
          category: 'security'
        },
        {
          id: 'unit-tests',
          name: '单元测试执行',
          command: 'npm',
          args: ['run', 'test:unit'],
          cwd: process.cwd(),
          priority: 5,
          timeout: 180000,
          category: 'testing'
        },
        {
          id: 'integration-tests',
          name: '集成测试执行',
          command: 'npm',
          args: ['run', 'test:integration'],
          cwd: process.cwd(),
          priority: 6,
          timeout: 300000,
          category: 'testing'
        },
        {
          id: 'coverage',
          name: '测试覆盖率检查',
          command: 'npm',
          args: ['run', 'test:coverage'],
          cwd: process.cwd(),
          priority: 7,
          timeout: 300000,
          category: 'testing'
        }
      ];
    }

    // 只有当项目中有tsconfig.json时才添加TypeScript检查
    // 注意：这是一个纯JavaScript项目，所以默认跳过TypeScript检查
    // 如果将来项目迁移到TypeScript，可以取消注释以下代码
    /*
    try {
      const fs = await import('fs');
      const path = await import('path');
      if (fs.existsSync(path.join(process.cwd(), 'tsconfig.json'))) {
        checks.push({
          id: 'typescript',
          name: 'TypeScript 类型检查',
          command: 'npx',
          args: ['tsc', '--noEmit'],
          cwd: process.cwd(),
          priority: 3,
          timeout: 60000,
          category: 'type-checking'
        });
      }
    } catch (error) {
      // 如果无法检查文件，跳过TypeScript检查
      this.log('跳过TypeScript检查：无法访问文件系统', 'warning');
    }
    */

    return checks.sort((a, b) => a.priority - b.priority); // 按优先级排序
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const colors = {
      info: '\x1b[36m',    // 青色
      success: '\x1b[32m', // 绿色
      error: '\x1b[31m',   // 红色
      warning: '\x1b[33m', // 黄色
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

  generateCacheKey(check) {
    const keyData = `${check.command} ${check.args.join(' ')} ${check.cwd}`;
    return createHash('sha256').update(keyData).digest('hex');
  }

  getCacheResult(check) {
    if (!this.config.cacheEnabled) return null;

    const cacheKey = this.generateCacheKey(check);
    const cacheFile = join(this.config.cacheDir, `${cacheKey}.json`);

    if (existsSync(cacheFile)) {
      try {
        const cached = JSON.parse(readFileSync(cacheFile, 'utf8'));
        // 检查缓存是否过期（24小时）
        if (Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) {
          this.log(`📋 使用缓存结果: ${check.name}`, 'info');
          return cached.result;
        }
      } catch (error) {
        // 缓存文件损坏，忽略
      }
    }
    return null;
  }

  setCacheResult(check, result) {
    if (!this.config.cacheEnabled) return;

    const cacheKey = this.generateCacheKey(check);
    const cacheFile = join(this.config.cacheDir, `${cacheKey}.json`);

    const cacheData = {
      timestamp: Date.now(),
      check: check.id,
      result: result
    };

    try {
      writeFileSync(cacheFile, JSON.stringify(cacheData, null, 2));
    } catch (error) {
      // 缓存写入失败，忽略
    }
  }

  async runCheck(check) {
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      if (this.failed && this.config.failFast) {
        resolve({
          check,
          status: 'skipped',
          reason: '快速失败模式：其他检查已失败',
          duration: 0
        });
        return;
      }

      // 检查缓存
      const cachedResult = this.getCacheResult(check);
      if (cachedResult && cachedResult.status === 'passed') {
        resolve({
          ...cachedResult,
          cached: true,
          duration: Date.now() - startTime
        });
        return;
      }

      this.running.set(check.id, check);
      this.log(`🚀 开始执行: ${check.name}`, 'info');

      const child = spawn(check.command, check.args, {
        cwd: check.cwd,
        stdio: ['inherit', 'pipe', 'pipe'],
        shell: true
      });

      let stdout = '';
      let stderr = '';
      let timeoutId;

      // 设置超时
      if (check.timeout) {
        timeoutId = setTimeout(() => {
          child.kill('SIGTERM');
          this.log(`⏰ ${check.name} 超时 (${check.timeout}ms)`, 'error');
        }, check.timeout);
      }

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (timeoutId) clearTimeout(timeoutId);
        this.running.delete(check.id);

        const duration = Date.now() - startTime;
        const result = {
          check,
          status: code === 0 ? 'passed' : 'failed',
          code,
          stdout,
          stderr,
          duration,
          cached: false
        };

        if (code === 0) {
          this.log(`${check.name} 通过 ✓ (${duration}ms)`, 'success');
          // 缓存成功结果
          this.setCacheResult(check, result);
        } else {
          if (this.config.failFast) {
            this.failed = true;
          }
          this.log(`${check.name} 失败 ✗ (退出码: ${code}, ${duration}ms)`, 'error');

          // 输出错误信息（限制长度）
          if (stderr && stderr.length > 0) {
            const errorSnippet = stderr.length > 500 ?
              stderr.substring(0, 500) + '...' : stderr;
            console.log(`\n${check.name} 错误输出:`);
            console.log(errorSnippet);
          }
        }

        resolve(result);
      });

      child.on('error', (error) => {
        if (timeoutId) clearTimeout(timeoutId);
        this.running.delete(check.id);

        const duration = Date.now() - startTime;
        if (!this.failed || !this.config.failFast) {
          this.failed = true;
        }

        this.log(`${check.name} 执行出错: ${error.message} (${duration}ms)`, 'error');

        resolve({
          check,
          status: 'error',
          error: error.message,
          duration,
          cached: false
        });
      });
    });
  }

  async runConcurrentChecks() {
    const results = [];
    const runningPromises = [];
    const maxConcurrent = Math.min(this.config.maxConcurrency || os.cpus().length, this.checks.length);

    this.log(`🎯 启动 ${maxConcurrent} 个并发检查任务`, 'info');

    // 分批执行检查
    for (let i = 0; i < this.checks.length; i += maxConcurrent) {
      const batch = this.checks.slice(i, i + maxConcurrent);
      const batchPromises = batch.map(check => this.runCheck(check));

      try {
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        // 检查是否需要快速失败
        if (this.config.failFast) {
          const hasFailure = batchResults.some(r => r.status === 'failed' || r.status === 'error');
          if (hasFailure) {
            this.log('⚡ 检测到失败，启用快速失败模式', 'warning');
            break;
          }
        }
      } catch (error) {
        this.log(`批次执行出错: ${error.message}`, 'error');
        break;
      }
    }

    return results;
  }

  async runAllChecks() {
    this.log('🚀 开始工业级质量检查系统', 'info');
    this.log(`📊 并发数: ${this.config.maxConcurrency}, 快速失败: ${this.config.failFast ? '启用' : '禁用'}, 缓存: ${this.config.cacheEnabled ? '启用' : '禁用'}`, 'info');

    const results = await this.runConcurrentChecks();
    const duration = Date.now() - this.startTime;

    // 生成详细报告
    const report = this.generateReport(results, duration);

    // 输出控制台摘要
    this.printSummary(report);

    // 保存报告文件
    this.saveReport(report);

    // 退出码处理
    if (this.failed) {
      this.log('❌ 质量检查失败！请修复上述问题后重试。', 'error');
      process.exit(1);
    } else {
      this.log('🎉 所有质量检查通过！代码质量优秀。', 'success');
      process.exit(0);
    }
  }

  generateReport(results, totalDuration) {
    const stats = {
      total: results.length,
      passed: results.filter(r => r.status === 'passed').length,
      failed: results.filter(r => r.status === 'failed').length,
      error: results.filter(r => r.status === 'error').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      cached: results.filter(r => r.cached).length
    };

    const categoryStats = {};
    results.forEach(result => {
      const category = result.check.category;
      if (!categoryStats[category]) {
        categoryStats[category] = { total: 0, passed: 0, failed: 0 };
      }
      categoryStats[category].total++;
      if (result.status === 'passed') categoryStats[category].passed++;
      if (result.status === 'failed') categoryStats[category].failed++;
    });

    const performanceStats = {
      totalDuration,
      averageDuration: results.length > 0 ? totalDuration / results.length : 0,
      slowestCheck: results.reduce((max, r) => r.duration > max.duration ? r : max, { duration: 0 }),
      fastestCheck: results.reduce((min, r) => r.duration < min.duration ? r : min, { duration: Infinity })
    };

    return {
      timestamp: new Date().toISOString(),
      config: this.config,
      stats,
      categoryStats,
      performanceStats,
      results: results.map(r => ({
        id: r.check.id,
        name: r.check.name,
        category: r.check.category,
        priority: r.check.priority,
        status: r.status,
        duration: r.duration,
        cached: r.cached,
        ...(r.status === 'failed' && { code: r.code }),
        ...(r.error && { error: r.error }),
        ...(r.stderr && r.stderr.length > 0 && { errorSnippet: r.stderr.substring(0, 200) })
      })),
      systemInfo: {
        platform: os.platform(),
        arch: os.arch(),
        cpus: os.cpus().length,
        totalMemory: os.totalmem(),
        freeMemory: os.freemem()
      }
    };
  }

  printSummary(report) {
    console.log('\n' + '='.repeat(80));
    this.log('📊 frys 工业级质量检查报告', 'info');
    console.log('='.repeat(80));

    console.log(`⏱️  总耗时: ${(report.performanceStats.totalDuration / 1000).toFixed(2)}秒`);
    console.log(`📈 检查总数: ${report.stats.total}`);
    console.log(`✅ 通过: ${report.stats.passed}`);
    console.log(`❌ 失败: ${report.stats.failed}`);
    console.log(`💥 错误: ${report.stats.error}`);
    console.log(`⏭️  跳过: ${report.stats.skipped}`);
    console.log(`📋 缓存命中: ${report.stats.cached}`);

    console.log('\n📂 分类统计:');
    Object.entries(report.categoryStats).forEach(([category, stats]) => {
      const successRate = stats.total > 0 ? ((stats.passed / stats.total) * 100).toFixed(1) : '0.0';
      console.log(`  ${category}: ${stats.passed}/${stats.total} (${successRate}%)`);
    });

    console.log('\n⚡ 性能统计:');
    console.log(`  平均耗时: ${(report.performanceStats.averageDuration).toFixed(0)}ms`);
    if (report.performanceStats.slowestCheck.duration > 0) {
      console.log(`  最慢检查: ${report.performanceStats.slowestCheck.check.name} (${report.performanceStats.slowestCheck.duration}ms)`);
    }
    if (report.performanceStats.fastestCheck.duration < Infinity) {
      console.log(`  最快检查: ${report.performanceStats.fastestCheck.check.name} (${report.performanceStats.fastestCheck.duration}ms)`);
    }

    // 显示失败的检查详情
    const failedResults = report.results.filter(r => r.status === 'failed' || r.status === 'error');
    if (failedResults.length > 0) {
      console.log('\n❌ 失败详情:');
      failedResults.forEach(result => {
        console.log(`  • ${result.name} (${result.duration}ms)`);
        if (result.error) {
          console.log(`    错误: ${result.error}`);
        }
        if (result.errorSnippet) {
          console.log(`    输出: ${result.errorSnippet}...`);
        }
      });
    }

    console.log('\n💾 报告已保存至: quality-report.json');
    console.log('='.repeat(80));
  }

  saveReport(report) {
    const reportPath = join(process.cwd(), 'quality-report.json');
    try {
      writeFileSync(reportPath, JSON.stringify(report, null, 2));
    } catch (error) {
      this.log(`保存报告失败: ${error.message}`, 'warning');
    }
  }
}

// 解析命令行参数
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--simplified':
      case '--quick':
        config.simplified = true;
        break;
      case '--concurrency':
        config.maxConcurrency = parseInt(args[++i]);
        break;
      case '--no-cache':
        config.cacheEnabled = false;
        break;
      case '--no-fail-fast':
        config.failFast = false;
        break;
      case '--help':
        console.log(`
frys 工业级质量检查系统

用法: node scripts/quality-check.js [选项]

选项:
  --simplified, --quick    简化模式 (减少与CI/CD流水线重复)
  --concurrency NUM        最大并发数
  --no-cache               禁用缓存
  --no-fail-fast           禁用快速失败
  --help                   显示此帮助信息

环境变量:
  QUALITY_MAX_CONCURRENCY  最大并发数
  QUALITY_FAIL_FAST        是否启用快速失败 (true/false)
  QUALITY_CACHE_ENABLED    是否启用缓存 (true/false)
  QUALITY_REPORT_FORMAT    报告格式 (json)

示例:
  node scripts/quality-check.js --simplified
  node scripts/quality-check.js --concurrency 4 --no-cache
        `);
        process.exit(0);
    }
  }

  return config;
}

// 直接运行质量检查系统
const argsConfig = parseArgs();
const config = {
  // 命令行参数优先级高于环境变量
  ...argsConfig,
  // 可以从环境变量读取默认配置
  maxConcurrency: argsConfig.maxConcurrency || parseInt(process.env.QUALITY_MAX_CONCURRENCY) || undefined,
  failFast: argsConfig.failFast !== undefined ? argsConfig.failFast : (process.env.QUALITY_FAIL_FAST !== 'false'),
  cacheEnabled: argsConfig.cacheEnabled !== undefined ? argsConfig.cacheEnabled : (process.env.QUALITY_CACHE_ENABLED !== 'false'),
  reportFormat: process.env.QUALITY_REPORT_FORMAT || 'json'
};

const checker = new IndustrialQualityChecker(config);
checker.runAllChecks().catch(error => {
  console.error('❌ 质量检查系统执行出错:', error);
  process.exit(1);
});

export default IndustrialQualityChecker;
