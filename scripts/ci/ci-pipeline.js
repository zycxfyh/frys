#!/usr/bin/env node

/**
 * frys 统一CI/CD流水线
 * 消除冗余，智能调度，高效执行
 */

import { spawn } from 'child_process';
import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import os from 'os';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 流水线阶段定义
const PIPELINE_STAGES = {
  // 代码质量检查阶段
  CODE_QUALITY: 'code_quality',
  // 安全检查阶段
  SECURITY: 'security',
  // 测试阶段
  TESTING: 'testing',
  // 构建阶段
  BUILD: 'build',
  // 部署准备阶段
  DEPLOY_PREP: 'deploy_prep',
  // 部署阶段
  DEPLOY: 'deploy',
  // 验证阶段
  VERIFY: 'verify',
};

// 环境类型
const ENV_TYPES = {
  DEVELOPMENT: 'development',
  STAGING: 'staging',
  PRODUCTION: 'production',
};

class UnifiedCIPipeline {
  constructor(options = {}) {
    this.options = {
      env: options.env || ENV_TYPES.DEVELOPMENT,
      branch: options.branch || 'main',
      pr: options.pr || null,
      failFast: options.failFast !== false,
      maxConcurrency:
        options.maxConcurrency || Math.max(1, os.cpus().length - 1),
      cacheEnabled: options.cacheEnabled !== false,
      dryRun: options.dryRun || false,
      ...options,
    };

    this.results = {
      stages: new Map(),
      totalDuration: 0,
      startTime: Date.now(),
      cacheHits: 0,
      cacheMisses: 0,
    };

    this.cache = new Map();
    this.cacheDir = join(process.cwd(), '.ci-cache');

    // 确保缓存目录存在
    if (this.options.cacheEnabled && !existsSync(this.cacheDir)) {
      mkdirSync(this.cacheDir, { recursive: true });
    }

    this.log(`🚀 初始化 frys 统一CI/CD流水线`, 'info');
    this.log(
      `环境: ${this.options.env}, 分支: ${this.options.branch}, 并发数: ${this.options.maxConcurrency}`,
      'info',
    );
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const colors = {
      info: '\x1b[36m',
      success: '\x1b[32m',
      error: '\x1b[31m',
      warning: '\x1b[33m',
      header: '\x1b[35m',
      reset: '\x1b[0m',
    };

    const prefix =
      {
        info: 'ℹ️ ',
        success: '✅ ',
        error: '❌ ',
        warning: '⚠️ ',
        header: '🚀 ',
      }[type] || 'ℹ️ ';

    console.log(
      `${colors[type]}[${timestamp}] ${prefix}${message}${colors.reset}`,
    );
  }

  /**
   * 生成缓存键
   */
  generateCacheKey(stage, tasks) {
    const content = `${stage}:${JSON.stringify(tasks)}:${this.options.branch}`;
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * 获取缓存结果
   */
  getCacheResult(cacheKey) {
    if (!this.options.cacheEnabled) return null;

    const cacheFile = join(this.cacheDir, `${cacheKey}.json`);
    if (existsSync(cacheFile)) {
      try {
        const cached = JSON.parse(readFileSync(cacheFile, 'utf8'));
        // 检查缓存是否过期（1小时）
        if (Date.now() - cached.timestamp < 60 * 60 * 1000) {
          this.results.cacheHits++;
          return cached.result;
        }
      } catch (error) {
        // 缓存文件损坏
      }
    }
    return null;
  }

  /**
   * 设置缓存结果
   */
  setCacheResult(cacheKey, result) {
    if (!this.options.cacheEnabled) return;

    const cacheFile = join(this.cacheDir, `${cacheKey}.json`);
    const cacheData = {
      timestamp: Date.now(),
      result: result,
    };

    try {
      writeFileSync(cacheFile, JSON.stringify(cacheData, null, 2));
    } catch (error) {
      // 缓存写入失败，忽略
    }
  }

  /**
   * 执行单个任务
   */
  async executeTask(task, stage) {
    const startTime = Date.now();

    return new Promise((resolve) => {
      if (this.options.dryRun) {
        this.log(`[DRY RUN] ${task.name}`, 'info');
        resolve({
          task,
          status: 'passed',
          duration: 0,
          dryRun: true,
        });
        return;
      }

      this.log(`执行任务: ${task.name}`, 'header');

      const child = spawn(task.command, task.args || [], {
        cwd: task.cwd || process.cwd(),
        stdio: task.silent ? 'pipe' : 'inherit',
        shell: true,
        env: { ...process.env, ...task.env },
      });

      let stdout = '';
      let stderr = '';
      let timeoutId;

      // 设置超时
      if (task.timeout) {
        timeoutId = setTimeout(() => {
          child.kill('SIGTERM');
          this.log(`任务超时: ${task.name} (${task.timeout}ms)`, 'error');
        }, task.timeout);
      }

      if (child.stdout) {
        child.stdout.on('data', (data) => {
          stdout += data.toString();
        });
      }

      if (child.stderr) {
        child.stderr.on('data', (data) => {
          stderr += data.toString();
        });
      }

      child.on('close', (code) => {
        if (timeoutId) clearTimeout(timeoutId);

        const duration = Date.now() - startTime;
        const result = {
          task,
          status: code === 0 ? 'passed' : 'failed',
          code,
          stdout,
          stderr,
          duration,
        };

        if (code === 0) {
          this.log(`${task.name} 成功 ✓ (${duration}ms)`, 'success');
        } else {
          this.log(
            `${task.name} 失败 ✗ (退出码: ${code}, ${duration}ms)`,
            'error',
          );

          // 输出错误信息（限制长度）
          if (stderr && stderr.length > 0) {
            const errorSnippet =
              stderr.length > 500 ? stderr.substring(0, 500) + '...' : stderr;
            console.log(`\n${task.name} 错误输出:`);
            console.log(errorSnippet);
          }
        }

        resolve(result);
      });

      child.on('error', (error) => {
        if (timeoutId) clearTimeout(timeoutId);

        const duration = Date.now() - startTime;
        this.log(
          `${task.name} 执行出错: ${error.message} (${duration}ms)`,
          'error',
        );

        resolve({
          task,
          status: 'error',
          error: error.message,
          duration,
        });
      });
    });
  }

  /**
   * 并行执行任务批次
   */
  async executeTaskBatch(tasks, stage) {
    const results = [];
    const concurrency = Math.min(this.options.maxConcurrency, tasks.length);

    this.log(
      `开始执行 ${stage} 阶段 (${tasks.length} 个任务, 并发数: ${concurrency})`,
      'info',
    );

    // 检查缓存
    const cacheKey = this.generateCacheKey(stage, tasks);
    const cachedResult = this.getCacheResult(cacheKey);

    if (cachedResult && cachedResult.every((r) => r.status === 'passed')) {
      this.log(`使用缓存结果: ${stage} 阶段`, 'success');
      return cachedResult.map((r) => ({ ...r, cached: true }));
    }

    this.results.cacheMisses++;

    // 分批执行
    for (let i = 0; i < tasks.length; i += concurrency) {
      const batch = tasks.slice(i, i + concurrency);
      const batchPromises = batch.map((task) => this.executeTask(task, stage));

      try {
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        // 检查是否需要快速失败
        if (this.options.failFast) {
          const hasFailure = batchResults.some(
            (r) => r.status === 'failed' || r.status === 'error',
          );
          if (hasFailure) {
            this.log(`检测到失败，快速失败模式: ${stage} 阶段`, 'warning');
            break;
          }
        }
      } catch (error) {
        this.log(`批次执行出错: ${error.message}`, 'error');
        break;
      }
    }

    // 缓存成功结果
    if (results.every((r) => r.status === 'passed')) {
      this.setCacheResult(cacheKey, results);
    }

    return results;
  }

  /**
   * 获取阶段任务定义
   */
  getStageTasks(stage) {
    const isProduction = this.options.env === ENV_TYPES.PRODUCTION;
    const isStaging = this.options.env === ENV_TYPES.STAGING;
    const isPR = !!this.options.pr;

    switch (stage) {
      case PIPELINE_STAGES.CODE_QUALITY:
        return [
          {
            name: 'ESLint 检查',
            command: 'npm',
            args: ['run', 'lint'],
            priority: 1,
            timeout: 60000,
            category: 'linting',
          },
          {
            name: 'Prettier 格式检查',
            command: 'npm',
            args: ['run', 'format:check'],
            priority: 2,
            timeout: 30000,
            category: 'formatting',
          },
        ];

      case PIPELINE_STAGES.SECURITY:
        return [
          {
            name: '安全漏洞扫描',
            command: 'npm',
            args: ['audit', '--audit-level=moderate'],
            priority: 4,
            timeout: 120000,
            category: 'security',
          },
          {
            name: '工业级安全审计',
            command: 'node',
            args: ['scripts/security-audit.js'],
            priority: 3,
            timeout: 300000,
            category: 'security',
          },
        ];

      case PIPELINE_STAGES.TESTING: {
        const testTasks = [
          {
            name: '单元测试',
            command: 'npm',
            args: ['run', 'test:unit'],
            priority: 5,
            timeout: 180000,
            category: 'testing',
          },
          {
            name: '集成测试',
            command: 'npm',
            args: ['run', 'test:integration'],
            priority: 6,
            timeout: 300000,
            category: 'testing',
          },
          {
            name: '性能测试',
            command: 'npm',
            args: ['run', 'test:performance'],
            priority: 8,
            timeout: 180000,
            category: 'testing',
          },
        ];

        // 生产环境添加更多测试
        if (isProduction || isStaging) {
          testTasks.push({
            name: '端到端测试',
            command: 'npm',
            args: ['run', 'test:e2e'],
            priority: 7,
            timeout: 600000,
            category: 'testing',
          });
        }

        return testTasks;
      }

      case PIPELINE_STAGES.BUILD:
        return [
          {
            name: '生产构建',
            command: 'npm',
            args: ['run', 'build:prod'],
            priority: 1,
            timeout: 300000,
            category: 'build',
          },
        ];

      case PIPELINE_STAGES.DEPLOY_PREP:
        return [
          {
            name: '部署前验证',
            command: 'node',
            args: ['scripts/verify-deployment.js'],
            priority: 1,
            timeout: 60000,
            category: 'verification',
            env: { DEPLOY_ENV: this.options.env },
          },
        ];

      case PIPELINE_STAGES.DEPLOY:
        if (isProduction) {
          return [
            {
              name: '生产环境部署',
              command: './scripts/deploy.sh',
              args: ['--env=production'],
              priority: 1,
              timeout: 1800000, // 30分钟
              category: 'deployment',
            },
          ];
        } else if (isStaging) {
          return [
            {
              name: '测试环境部署',
              command: './scripts/deploy.sh',
              args: ['--env=staging'],
              priority: 1,
              timeout: 900000, // 15分钟
              category: 'deployment',
            },
          ];
        }
        return [];

      case PIPELINE_STAGES.VERIFY: {
        const verifyTasks = [
          {
            name: '部署验证',
            command: 'node',
            args: ['scripts/verify-deployment.js'],
            priority: 1,
            timeout: 120000,
            category: 'verification',
            env: { DEPLOY_ENV: this.options.env },
          },
        ];

        // 生产环境添加额外验证
        if (isProduction) {
          verifyTasks.push({
            name: '回归测试',
            command: 'node',
            args: ['scripts/regression-matrix.js'],
            priority: 2,
            timeout: 300000,
            category: 'testing',
          });
        }

        return verifyTasks;
      }

      default:
        return [];
    }
  }

  /**
   * 执行流水线阶段
   */
  async executeStage(stage) {
    const startTime = Date.now();
    const tasks = this.getStageTasks(stage);

    if (tasks.length === 0) {
      this.log(`跳过 ${stage} 阶段 (无任务)`, 'warning');
      return { stage, status: 'skipped', duration: 0, tasks: [] };
    }

    this.log(`开始执行 ${stage} 阶段`, 'header');

    const results = await this.executeTaskBatch(tasks, stage);
    const duration = Date.now() - startTime;

    const stageResult = {
      stage,
      status: results.every((r) => r.status === 'passed') ? 'passed' : 'failed',
      duration,
      tasks: results,
      cached: results.some((r) => r.cached),
    };

    this.results.stages.set(stage, stageResult);

    if (stageResult.status === 'passed') {
      this.log(`${stage} 阶段成功 ✓ (${duration}ms)`, 'success');
    } else {
      this.log(`${stage} 阶段失败 ✗ (${duration}ms)`, 'error');

      if (this.options.failFast) {
        throw new Error(`${stage} 阶段执行失败`);
      }
    }

    return stageResult;
  }

  /**
   * 确定需要执行的阶段
   */
  getRequiredStages() {
    const stages = [PIPELINE_STAGES.CODE_QUALITY, PIPELINE_STAGES.SECURITY];

    // 根据环境添加阶段
    if (this.options.env !== ENV_TYPES.DEVELOPMENT) {
      stages.push(PIPELINE_STAGES.TESTING);
    }

    // 构建阶段
    if (
      this.options.env === ENV_TYPES.STAGING ||
      this.options.env === ENV_TYPES.PRODUCTION
    ) {
      stages.push(PIPELINE_STAGES.BUILD);
      stages.push(PIPELINE_STAGES.DEPLOY_PREP);
      stages.push(PIPELINE_STAGES.DEPLOY);
      stages.push(PIPELINE_STAGES.VERIFY);
    }

    // PR检查只执行代码质量和安全阶段
    if (this.options.pr) {
      return [
        PIPELINE_STAGES.CODE_QUALITY,
        PIPELINE_STAGES.SECURITY,
        PIPELINE_STAGES.TESTING,
      ];
    }

    return stages;
  }

  /**
   * 生成流水线报告
   */
  generateReport() {
    const totalDuration = Date.now() - this.results.startTime;
    this.results.totalDuration = totalDuration;

    const report = {
      timestamp: new Date().toISOString(),
      config: this.options,
      stages: Array.from(this.results.stages.entries()).map(
        ([name, result]) => ({
          name,
          status: result.status,
          duration: result.duration,
          taskCount: result.tasks.length,
          passedTasks: result.tasks.filter((t) => t.status === 'passed').length,
          failedTasks: result.tasks.filter((t) => t.status === 'failed').length,
          cached: result.cached,
        }),
      ),
      performance: {
        totalDuration,
        cacheHits: this.results.cacheHits,
        cacheMisses: this.results.cacheMisses,
        cacheRatio:
          this.results.cacheHits /
            (this.results.cacheHits + this.results.cacheMisses) || 0,
        averageStageDuration: totalDuration / this.results.stages.size,
      },
      summary: {
        status: Array.from(this.results.stages.values()).every(
          (s) => s.status === 'passed',
        )
          ? 'PASSED'
          : 'FAILED',
        totalStages: this.results.stages.size,
        passedStages: Array.from(this.results.stages.values()).filter(
          (s) => s.status === 'passed',
        ).length,
        failedStages: Array.from(this.results.stages.values()).filter(
          (s) => s.status === 'failed',
        ).length,
        systemInfo: {
          platform: os.platform(),
          arch: os.arch(),
          cpus: os.cpus().length,
          totalMemory: os.totalmem(),
          nodeVersion: process.version,
        },
      },
    };

    return report;
  }

  /**
   * 打印摘要报告
   */
  printSummary(report) {
    console.log('\n' + '='.repeat(100));
    this.log('📊 frys 统一CI/CD流水线执行报告', 'info');
    console.log('='.repeat(100));

    console.log(
      `⏱️  总耗时: ${(report.performance.totalDuration / 1000).toFixed(2)}秒`,
    );
    console.log(`📈 阶段数: ${report.summary.totalStages}`);
    console.log(`✅ 通过阶段: ${report.summary.passedStages}`);
    console.log(`❌ 失败阶段: ${report.summary.failedStages}`);
    console.log(`📋 缓存命中: ${report.performance.cacheHits}`);
    console.log(
      `💾 缓存命中率: ${(report.performance.cacheRatio * 100).toFixed(1)}%`,
    );

    console.log('\n📂 阶段详情:');
    report.stages.forEach((stage) => {
      const status = stage.status === 'passed' ? '✅' : '❌';
      const cache = stage.cached ? ' (缓存)' : '';
      console.log(
        `  ${status} ${stage.name}: ${stage.passedTasks}/${stage.taskCount} 任务通过 (${stage.duration}ms)${cache}`,
      );
    });

    console.log('\n💻 系统信息:');
    console.log(
      `  平台: ${report.summary.systemInfo.platform} ${report.summary.systemInfo.arch}`,
    );
    console.log(`  CPU: ${report.summary.systemInfo.cpus} 核心`);
    console.log(
      `  内存: ${(report.summary.systemInfo.totalMemory / 1024 / 1024 / 1024).toFixed(1)} GB`,
    );
    console.log(`  Node.js: ${report.summary.systemInfo.nodeVersion}`);

    console.log('\n' + '='.repeat(100));

    if (report.summary.status === 'PASSED') {
      this.log('🎉 所有流水线阶段执行成功！', 'success');
    } else {
      this.log('❌ 流水线执行失败，请检查上述错误。', 'error');
    }
  }

  /**
   * 执行完整流水线
   */
  async run() {
    try {
      const requiredStages = this.getRequiredStages();
      this.log(`执行阶段: ${requiredStages.join(' → ')}`, 'info');

      for (const stage of requiredStages) {
        const result = await this.executeStage(stage);

        // 快速失败检查
        if (this.options.failFast && result.status === 'failed') {
          this.log(`由于 ${stage} 阶段失败，停止流水线执行`, 'error');
          break;
        }
      }

      // 生成报告
      const report = this.generateReport();
      this.printSummary(report);

      // 保存详细报告
      const reportPath = join(process.cwd(), 'ci-pipeline-report.json');
      writeFileSync(reportPath, JSON.stringify(report, null, 2));
      this.log(`详细报告已保存至: ${reportPath}`, 'info');

      // 设置退出码
      const exitCode = report.summary.status === 'PASSED' ? 0 : 1;
      process.exit(exitCode);
    } catch (error) {
      this.log(`流水线执行失败: ${error.message}`, 'error');

      const report = this.generateReport();
      this.printSummary(report);

      process.exit(1);
    }
  }
}

// 命令行接口
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--env':
      case '--environment':
        options.env = args[++i];
        break;
      case '--branch':
        options.branch = args[++i];
        break;
      case '--pr':
        options.pr = args[++i];
        break;
      case '--concurrency':
        options.maxConcurrency = parseInt(args[++i]);
        break;
      case '--no-cache':
        options.cacheEnabled = false;
        break;
      case '--no-fail-fast':
        options.failFast = false;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--help':
        console.log(`
frys 统一CI/CD流水线

用法: node scripts/ci-pipeline.js [选项]

选项:
  --env, --environment ENV    环境类型 (development/staging/production) 默认: development
  --branch BRANCH             分支名称 默认: main
  --pr PR_NUMBER              PR编号 (PR模式)
  --concurrency NUM           最大并发数 默认: CPU核心数-1
  --no-cache                  禁用缓存
  --no-fail-fast              禁用快速失败
  --dry-run                   干运行模式
  --help                      显示此帮助信息

示例:
  node scripts/ci-pipeline.js --env staging
  node scripts/ci-pipeline.js --pr 123 --env production
  node scripts/ci-pipeline.js --dry-run --no-cache
        `);
        process.exit(0);
    }
  }

  return options;
}

// 执行流水线
const options = parseArgs();
const pipeline = new UnifiedCIPipeline(options);
pipeline.run().catch((error) => {
  console.error('CI/CD流水线执行失败:', error);
  process.exit(1);
});

export default UnifiedCIPipeline;
