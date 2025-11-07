#!/usr/bin/env node

/**
 * 工业化测试执行器
 * 统一管理所有测试流程和报告生成
 */

import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class TestRunner {
  constructor() {
    this.results = {
      startTime: new Date(),
      phases: [],
      summary: {},
      coverage: null,
      errors: []
    };
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = {
      info: 'ℹ️ ',
      success: '✅',
      error: '❌',
      warning: '⚠️ ',
      phase: '🔄'
    }[type] || '📝';

    console.log(`[${timestamp}] ${prefix} ${message}`);
  }

  async runCommand(command, options = {}) {
    const { silent = false, timeout = 300000 } = options;

    return new Promise((resolve, reject) => {
      try {
        if (!silent) this.log(`执行: ${command}`, 'phase');

        const result = execSync(command, {
          encoding: 'utf8',
          timeout,
          stdio: silent ? 'pipe' : 'inherit',
          cwd: path.resolve(__dirname, '..')
        });

        resolve(result);
      } catch (error) {
        this.results.errors.push({
          command,
          error: error.message,
          code: error.status
        });
        reject(error);
      }
    });
  }

  async runPhase(name, command, options = {}) {
    const phase = {
      name,
      startTime: new Date(),
      status: 'running'
    };

    this.results.phases.push(phase);

    try {
      this.log(`开始执行: ${name}`, 'phase');
      await this.runCommand(command, options);
      phase.status = 'passed';
      phase.endTime = new Date();
      phase.duration = phase.endTime - phase.startTime;
      this.log(`${name} 执行成功 (${phase.duration}ms)`, 'success');
    } catch (error) {
      phase.status = 'failed';
      phase.endTime = new Date();
      phase.duration = phase.endTime - phase.startTime;
      phase.error = error.message;
      this.log(`${name} 执行失败: ${error.message}`, 'error');
      throw error;
    }
  }

  async prepareEnvironment() {
    this.log('准备测试环境', 'phase');

    // 确保必要的目录存在
    const dirs = ['coverage', 'test-results', 'logs'];
    dirs.forEach(dir => {
      const dirPath = path.join(__dirname, '..', dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        this.log(`创建目录: ${dir}`);
      }
    });

    // 清理旧的测试结果
    await this.runCommand('rm -rf coverage/* test-results/*', { silent: true });

    this.log('测试环境准备完成', 'success');
  }

  async runUnitTests() {
    await this.runPhase(
      '单元测试',
      'npm run test:unit',
      { timeout: 120000 }
    );
  }

  async runIntegrationTests() {
    await this.runPhase(
      '集成测试',
      'npm run test:integration',
      { timeout: 180000 }
    );
  }

  async runPerformanceTests() {
    await this.runPhase(
      '性能测试',
      'npm run test:performance',
      { timeout: 120000 }
    );
  }

  async runSecurityTests() {
    await this.runPhase(
      '安全测试',
      'npm run test:security',
      { timeout: 90000 }
    );
  }

  async runRedTeamTests() {
    await this.runPhase(
      '红队测试',
      'vitest run tests/red-team/',
      { timeout: 120000 }
    );
  }

  async runRegressionTests() {
    await this.runPhase(
      '回归测试',
      'npm run test:regression',
      { timeout: 90000 }
    );
  }

  async runE2ETests() {
    await this.runPhase(
      '端到端测试',
      'npm run test:e2e',
      { timeout: 180000 }
    );
  }

  async generateCoverageReport() {
    try {
      this.log('生成覆盖率报告', 'phase');

      // 运行完整测试套件以获取覆盖率
      await this.runCommand('npm run test:coverage', { timeout: 300000 });

      // 读取覆盖率报告
      const coveragePath = path.join(__dirname, '..', 'coverage', 'coverage-summary.json');
      if (fs.existsSync(coveragePath)) {
        const coverageData = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
        this.results.coverage = coverageData;

        this.log('覆盖率报告生成完成', 'success');
        this.logCoverageSummary(coverageData);
      }
    } catch (error) {
      this.log(`覆盖率报告生成失败: ${error.message}`, 'warning');
    }
  }

  logCoverageSummary(coverageData) {
    const total = coverageData.total;
    this.log('=== 覆盖率摘要 ===', 'info');
    this.log(`语句覆盖率: ${total.statements.pct}%`, 'info');
    this.log(`分支覆盖率: ${total.branches.pct}%`, 'info');
    this.log(`函数覆盖率: ${total.functions.pct}%`, 'info');
    this.log(`行覆盖率: ${total.lines.pct}%`, 'info');
  }

  generateSummaryReport() {
    const endTime = new Date();
    const totalDuration = endTime - this.results.startTime;

    this.results.summary = {
      totalDuration,
      phasesRun: this.results.phases.length,
      phasesPassed: this.results.phases.filter(p => p.status === 'passed').length,
      phasesFailed: this.results.phases.filter(p => p.status === 'failed').length,
      errors: this.results.errors.length
    };

    this.log('\n=== 测试执行摘要 ===', 'info');
    this.log(`总执行时间: ${totalDuration}ms`, 'info');
    this.log(`执行阶段: ${this.results.summary.phasesRun}`, 'info');
    this.log(`成功阶段: ${this.results.summary.phasesPassed}`, 'success');
    this.log(`失败阶段: ${this.results.summary.phasesFailed}`, 'error');
    this.log(`错误数量: ${this.results.summary.errors}`, this.results.summary.errors > 0 ? 'error' : 'success');

    if (this.results.coverage) {
      const total = this.results.coverage.total;
      this.log(`代码覆盖率: ${total.lines.pct}%`, 'info');
    }

    // 保存详细报告
    this.saveReport();
  }

  saveReport() {
    const reportPath = path.join(__dirname, '..', 'test-results', 'industrial-test-report.json');
    const htmlReportPath = path.join(__dirname, '..', 'test-results', 'test-report.html');

    // JSON报告
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
    this.log(`详细报告已保存: ${reportPath}`, 'success');

    // HTML报告
    this.generateHtmlReport(htmlReportPath);
  }

  generateHtmlReport(filePath) {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>frys 工业化测试报告</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f0f0f0; padding: 20px; border-radius: 5px; }
        .phase { margin: 10px 0; padding: 10px; border-left: 4px solid #ddd; }
        .passed { border-left-color: #4CAF50; background: #f8fff8; }
        .failed { border-left-color: #f44336; background: #fff8f8; }
        .running { border-left-color: #2196F3; background: #f8f8ff; }
        .summary { background: #e8f5e8; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .error { color: #f44336; }
        .success { color: #4CAF50; }
        .coverage { background: #fff3e0; padding: 15px; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>frys 工业化测试报告</h1>
        <p>执行时间: ${this.results.startTime.toISOString()}</p>
        <p>总耗时: ${this.results.summary.totalDuration}ms</p>
    </div>

    <div class="summary">
        <h2>执行摘要</h2>
        <p class="${this.results.summary.phasesFailed > 0 ? 'error' : 'success'}">
            阶段: ${this.results.summary.phasesPassed}/${this.results.summary.phasesRun} 通过
        </p>
        ${this.results.coverage ? `
        <div class="coverage">
            <h3>代码覆盖率</h3>
            <p>语句: ${this.results.coverage.total.statements.pct}%</p>
            <p>分支: ${this.results.coverage.total.branches.pct}%</p>
            <p>函数: ${this.results.coverage.total.functions.pct}%</p>
            <p>行: ${this.results.coverage.total.lines.pct}%</p>
        </div>
        ` : ''}
    </div>

    <h2>测试阶段详情</h2>
    ${this.results.phases.map(phase => `
    <div class="phase ${phase.status}">
        <h3>${phase.name}</h3>
        <p>状态: ${phase.status}</p>
        <p>耗时: ${phase.duration}ms</p>
        ${phase.error ? `<p class="error">错误: ${phase.error}</p>` : ''}
    </div>
    `).join('')}

    ${this.results.errors.length > 0 ? `
    <h2>错误详情</h2>
    ${this.results.errors.map(error => `
    <div class="phase failed">
        <h3>${error.command}</h3>
        <p class="error">${error.error}</p>
    </div>
    `).join('')}
    ` : ''}
</body>
</html>`;

    fs.writeFileSync(filePath, html);
    this.log(`HTML报告已保存: ${filePath}`, 'success');
  }

  async runAllTests() {
    try {
      await this.prepareEnvironment();

      // 按依赖顺序执行测试
      await this.runUnitTests();
      await this.runIntegrationTests();
      await this.runPerformanceTests();
      await this.runSecurityTests();
      await this.runRedTeamTests();
      await this.runRegressionTests();
      await this.runE2ETests();

      // 生成覆盖率报告
      await this.generateCoverageReport();

    } catch (error) {
      this.log(`测试执行中断: ${error.message}`, 'error');
    } finally {
      this.generateSummaryReport();

      const success = this.results.summary.phasesFailed === 0;
      process.exit(success ? 0 : 1);
    }
  }

  async runSmokeTests() {
    try {
      await this.prepareEnvironment();
      await this.runUnitTests();
      await this.generateCoverageReport();
    } catch (error) {
      this.log(`冒烟测试失败: ${error.message}`, 'error');
    } finally {
      this.generateSummaryReport();
      process.exit(this.results.summary.phasesFailed === 0 ? 0 : 1);
    }
  }

  async runCriticalTests() {
    try {
      await this.prepareEnvironment();
      await this.runUnitTests();
      await this.runSecurityTests();
      await this.runRegressionTests();
    } catch (error) {
      this.log(`关键测试失败: ${error.message}`, 'error');
    } finally {
      this.generateSummaryReport();
      process.exit(this.results.summary.phasesFailed === 0 ? 0 : 1);
    }
  }
}

// 主执行逻辑
const args = process.argv.slice(2);
const testRunner = new TestRunner();

switch (args[0]) {
  case 'smoke':
    await testRunner.runSmokeTests();
    break;
  case 'critical':
    await testRunner.runCriticalTests();
    break;
  case 'all':
  default:
    await testRunner.runAllTests();
    break;
}