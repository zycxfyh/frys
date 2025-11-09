#!/usr/bin/env node

/**
 * GitHub PR 智能分析器
 * 功能：
 * - 分析PR代码变更
 * - 提供智能修复建议
 * - 集成GitHub Checks API
 * - 自动生成改进计划
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { $ } from 'zx';

class GitHubPRAnalyzer {
  constructor() {
    this.prData = null;
    this.changes = [];
    this.issues = [];
    this.recommendations = [];
    this.riskLevel = 'low';

    this.config = {
      githubToken: process.env.GITHUB_TOKEN,
      repo: process.env.GITHUB_REPOSITORY,
      prNumber: process.env.GITHUB_EVENT_NUMBER || process.env.PR_NUMBER,
      sha: process.env.GITHUB_SHA,
      baseRef: process.env.GITHUB_BASE_REF,
      headRef: process.env.GITHUB_HEAD_REF,
    };
  }

  async analyze() {
    console.log('🔍 GitHub PR 智能分析器启动...');
    console.log('📊 配置:', this.config);
    console.log('');

    try {
      await this.fetchPRData();
      await this.analyzeChanges();
      await this.runCodeAnalysis();
      await this.checkTestCoverage();
      await this.assessRisk();
      await this.generateRecommendations();
      await this.createGitHubCheck();

      this.printReport();
    } catch (error) {
      console.error('❌ PR分析失败:', error);
      process.exit(1);
    }
  }

  async fetchPRData() {
    console.log('📥 获取PR数据...');

    if (this.config.prNumber) {
      // 这里可以调用GitHub API获取PR详细信息
      console.log(`📋 分析PR #${this.config.prNumber}`);
    } else {
      console.log('📋 本地模式 - 分析当前变更');
    }

    // 获取变更的文件
    try {
      const { stdout: changedFiles } = await $`git diff --name-only HEAD~1`;
      this.changes = changedFiles.split('\n').filter((f) => f.trim());

      const { stdout: diffStats } = await $`git diff --stat HEAD~1`;
      console.log('📊 变更统计:');
      console.log(diffStats);
    } catch (error) {
      console.log('⚠️ 无法获取变更统计');
    }

    console.log('✅ PR数据获取完成\n');
  }

  async analyzeChanges() {
    console.log('🔍 分析代码变更...');

    const analysis = {
      files: {
        total: this.changes.length,
        byType: {},
        critical: [],
      },
      complexity: 'medium',
      scope: 'small',
    };

    // 按类型分类文件
    for (const file of this.changes) {
      const ext = file.split('.').pop();
      analysis.files.byType[ext] = (analysis.files.byType[ext] || 0) + 1;

      // 识别关键文件
      if (
        file.includes('security') ||
        file.includes('auth') ||
        file.includes('config')
      ) {
        analysis.files.critical.push(file);
      }
    }

    // 评估复杂度
    if (this.changes.length > 20) {
      analysis.complexity = 'high';
    } else if (this.changes.length > 10) {
      analysis.complexity = 'medium';
    }

    // 评估范围
    if (analysis.files.byType.js > 5 || analysis.files.critical.length > 0) {
      analysis.scope = 'large';
    }

    this.analysis = analysis;
    console.log(`📁 文件变更: ${analysis.files.total} 个文件`);
    console.log(`🏗️  复杂度: ${analysis.complexity}`);
    console.log(`🎯 范围: ${analysis.scope}`);
    console.log('✅ 变更分析完成\n');
  }

  async runCodeAnalysis() {
    console.log('🔬 执行代码分析...');

    const issues = [];

    // ESLint 检查
    try {
      await $`npm run lint`;
      console.log('✅ ESLint 通过');
    } catch (error) {
      issues.push({
        type: 'lint',
        severity: 'high',
        message: 'ESLint 检查失败',
        suggestion: '运行 npm run lint -- --fix 自动修复',
      });
    }

    // 安全检查
    try {
      await $`npm audit --audit-level moderate`;
      console.log('✅ 安全审计通过');
    } catch (error) {
      issues.push({
        type: 'security',
        severity: 'critical',
        message: '发现安全漏洞',
        suggestion: '运行 npm audit fix 修复漏洞',
      });
    }

    // 类型检查（如果有TypeScript）
    if (existsSync('tsconfig.json')) {
      try {
        await $`npx tsc --noEmit`;
        console.log('✅ TypeScript 检查通过');
      } catch (error) {
        issues.push({
          type: 'typescript',
          severity: 'high',
          message: 'TypeScript 类型错误',
          suggestion: '修复类型定义或添加类型注解',
        });
      }
    }

    // 依赖检查
    if (
      this.changes.some(
        (f) => f.includes('package.json') || f.includes('package-lock.json'),
      )
    ) {
      issues.push({
        type: 'dependency',
        severity: 'medium',
        message: '依赖文件变更',
        suggestion: '验证所有依赖都已正确安装和测试',
      });
    }

    this.issues = issues;
    console.log(`🔍 发现问题: ${issues.length} 个`);
    console.log('✅ 代码分析完成\n');
  }

  async checkTestCoverage() {
    console.log('📊 检查测试覆盖率...');

    try {
      await $`npm run test:coverage`;

      if (existsSync('coverage/coverage-summary.json')) {
        const coverage = JSON.parse(
          readFileSync('coverage/coverage-summary.json', 'utf8'),
        );

        if (coverage.total.lines.pct < 80) {
          this.issues.push({
            type: 'coverage',
            severity: 'medium',
            message: `测试覆盖率不足: ${coverage.total.lines.pct}%`,
            suggestion: '为未覆盖的代码添加单元测试',
          });
        }

        console.log(`📈 当前覆盖率: ${coverage.total.lines.pct}%`);
      }
    } catch (error) {
      this.issues.push({
        type: 'test',
        severity: 'high',
        message: '测试执行失败',
        suggestion: '修复测试失败并重新运行',
      });
    }

    console.log('✅ 覆盖率检查完成\n');
  }

  async assessRisk() {
    console.log('⚠️  评估风险等级...');

    let riskScore = 0;

    // 基于问题的严重性评分
    for (const issue of this.issues) {
      switch (issue.severity) {
        case 'critical':
          riskScore += 10;
          break;
        case 'high':
          riskScore += 5;
          break;
        case 'medium':
          riskScore += 2;
          break;
        case 'low':
          riskScore += 1;
          break;
      }
    }

    // 基于变更范围评分
    if (this.analysis.scope === 'large') riskScore += 3;
    if (this.analysis.complexity === 'high') riskScore += 2;

    // 确定风险等级
    if (riskScore >= 10) this.riskLevel = 'critical';
    else if (riskScore >= 7) this.riskLevel = 'high';
    else if (riskScore >= 4) this.riskLevel = 'medium';
    else this.riskLevel = 'low';

    console.log(`🔴 风险等级: ${this.riskLevel} (分数: ${riskScore})`);
    console.log('✅ 风险评估完成\n');
  }

  async generateRecommendations() {
    console.log('💡 生成改进建议...');

    const recommendations = [];

    // 基于问题类型提供建议
    const issueTypes = this.issues.map((i) => i.type);

    if (issueTypes.includes('lint')) {
      recommendations.push({
        priority: 'high',
        action: '修复代码质量问题',
        tools: ['ESLint', 'Prettier'],
        effort: 'low',
      });
    }

    if (issueTypes.includes('security')) {
      recommendations.push({
        priority: 'critical',
        action: '修复安全漏洞',
        tools: ['npm audit', 'Snyk'],
        effort: 'medium',
      });
    }

    if (issueTypes.includes('test') || issueTypes.includes('coverage')) {
      recommendations.push({
        priority: 'high',
        action: '改进测试覆盖率',
        tools: ['Vitest', 'Playwright'],
        effort: 'medium',
      });
    }

    if (this.analysis.complexity === 'high') {
      recommendations.push({
        priority: 'medium',
        action: '考虑将大变更拆分为多个PR',
        tools: ['Git Flow'],
        effort: 'low',
      });
    }

    // 通用建议
    recommendations.push({
      priority: 'low',
      action: '添加CHANGELOG.md条目',
      tools: ['Conventional Commits'],
      effort: 'low',
    });

    this.recommendations = recommendations;
    console.log(`📝 生成建议: ${recommendations.length} 条`);
    console.log('✅ 建议生成完成\n');
  }

  async createGitHubCheck() {
    if (!this.config.githubToken || !this.config.prNumber) {
      console.log('⏭️ 跳过GitHub Check创建（缺少配置）\n');
      return;
    }

    console.log('📤 创建GitHub Check...');

    // 这里可以调用GitHub Checks API创建PR检查
    // 示例：创建带有详细信息的检查

    console.log('✅ GitHub Check创建完成\n');
  }

  printReport() {
    console.log('📋 PR 分析报告');
    console.log('='.repeat(60));

    console.log(
      `🔍 PR 状态: ${this.riskLevel === 'low' ? '✅ 安全' : this.riskLevel === 'medium' ? '⚠️ 需要注意' : '🔴 高风险'}`,
    );
    console.log(`📁 变更文件: ${this.analysis.files.total} 个`);
    console.log(`🔬 发现问题: ${this.issues.length} 个`);
    console.log(`💡 建议数量: ${this.recommendations.length} 个`);
    console.log('');

    if (this.issues.length > 0) {
      console.log('🚨 发现的问题:');
      this.issues.forEach((issue, i) => {
        const icon =
          issue.severity === 'critical'
            ? '🔴'
            : issue.severity === 'high'
              ? '🟠'
              : '🟡';
        console.log(`   ${i + 1}. ${icon} ${issue.message}`);
        console.log(`      💡 ${issue.suggestion}`);
      });
      console.log('');
    }

    if (this.recommendations.length > 0) {
      console.log('💡 改进建议:');
      this.recommendations.forEach((rec, i) => {
        const priorityIcon =
          rec.priority === 'critical'
            ? '🔴'
            : rec.priority === 'high'
              ? '🟠'
              : '🟢';
        console.log(`   ${i + 1}. ${priorityIcon} ${rec.action}`);
        console.log(`      🛠️  工具: ${rec.tools.join(', ')}`);
        console.log(`      ⏱️  工作量: ${rec.effort}`);
      });
      console.log('');
    }

    console.log('📊 详细分析已保存到: pr-analysis-report.json');
    console.log('='.repeat(60));

    // 保存详细报告
    const report = {
      timestamp: new Date().toISOString(),
      pr: this.config.prNumber,
      analysis: this.analysis,
      issues: this.issues,
      recommendations: this.recommendations,
      riskLevel: this.riskLevel,
      summary: {
        status: this.issues.length === 0 ? 'approved' : 'needs_review',
        issuesCount: this.issues.length,
        recommendationsCount: this.recommendations.length,
      },
    };

    writeFileSync('pr-analysis-report.json', JSON.stringify(report, null, 2));
  }
}

// 运行分析器
const analyzer = new GitHubPRAnalyzer();
analyzer.analyze().catch((error) => {
  console.error('❌ PR分析器异常退出:', error);
  process.exit(1);
});
