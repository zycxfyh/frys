#!/usr/bin/env node

/**
 * frys GitHub 配置验证脚本
 * 验证 CI/CD 工作流配置的完整性
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

class GitHubSetupValidator {
  constructor() {
    this.issues = [];
    this.successes = [];
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

  checkFile(filePath, description) {
    const fullPath = join(rootDir, filePath);
    if (existsSync(fullPath)) {
      this.successes.push(`${description}: ${filePath}`);
      this.log(`${description} ✓`, 'success');
      return true;
    } else {
      this.issues.push(`缺少 ${description}: ${filePath}`);
      this.log(`缺少 ${description}: ${filePath}`, 'error');
      return false;
    }
  }

  checkWorkflowFile(filePath) {
    const fullPath = join(rootDir, filePath);
    if (!existsSync(fullPath)) {
      this.issues.push(`缺少工作流文件: ${filePath}`);
      return false;
    }

    try {
      const content = readFileSync(fullPath, 'utf8');
      const workflow = YAML.parse(content);

      // 检查基本结构
      if (!workflow.name) {
        this.issues.push(`${filePath}: 缺少工作流名称`);
      }
      if (!workflow.on) {
        this.issues.push(`${filePath}: 缺少触发器配置`);
      }
      if (!workflow.jobs) {
        this.issues.push(`${filePath}: 缺少作业配置`);
      }

      this.successes.push(`工作流文件有效: ${filePath}`);
      return true;
    } catch (error) {
      this.issues.push(`${filePath}: YAML 解析错误 - ${error.message}`);
      return false;
    }
  }

  validateGitHubWorkflows() {
    this.log('🔍 验证 GitHub Actions 配置...', 'info');

    // 检查工作流文件
    this.checkWorkflowFile('.github/workflows/ci-cd-pipeline.yml');

    // 检查配置文件
    this.checkFile('.github/CODEOWNERS', '代码所有者配置');
    this.checkFile('.github/dependabot.yml', 'Dependabot 配置');
    this.checkFile('.github/README.md', 'GitHub 配置指南');

    // 检查模板
    this.checkFile('.github/PULL_REQUEST_TEMPLATE/default.md', 'PR 模板');
    this.checkFile('.github/ISSUE_TEMPLATE/bug-report.yml', 'Bug 报告模板');
    this.checkFile('.github/ISSUE_TEMPLATE/feature-request.yml', '功能请求模板');

    return this.issues.length === 0;
  }

  validatePackageScripts() {
    this.log('🔍 验证 package.json 脚本...', 'info');

    const packageJson = join(rootDir, 'package.json');
    if (!existsSync(packageJson)) {
      this.issues.push('缺少 package.json 文件');
      return false;
    }

    try {
      const pkg = JSON.parse(readFileSync(packageJson, 'utf8'));
      const requiredScripts = [
        'test:ci:unit',
        'test:ci:integration',
        'security:audit:ci',
        'pr:check',
        'deploy',
        'rollback:staging',
        'rollback:smart',
        'slo:check',
        'github:setup'
      ];

      for (const script of requiredScripts) {
        if (!pkg.scripts[script]) {
          this.issues.push(`缺少 npm 脚本: ${script}`);
        } else {
          this.successes.push(`npm 脚本存在: ${script}`);
        }
      }

      return true;
    } catch (error) {
      this.issues.push(`package.json 解析错误: ${error.message}`);
      return false;
    }
  }

  validateLefthookConfig() {
    this.log('🔍 验证 lefthook 配置...', 'info');

    const lefthookFile = join(rootDir, 'lefthook.yml');
    if (!existsSync(lefthookFile)) {
      this.issues.push('缺少 lefthook.yml 文件');
      return false;
    }

    try {
      const content = readFileSync(lefthookFile, 'utf8');
      // 基本检查：确保包含必要的钩子
      const requiredHooks = ['pre-commit', 'pre-push', 'commit-msg'];

      for (const hook of requiredHooks) {
        if (!content.includes(`${hook}:`)) {
          this.issues.push(`lefthook.yml 缺少 ${hook} 钩子配置`);
        } else {
          this.successes.push(`Git 钩子配置存在: ${hook}`);
        }
      }

      return true;
    } catch (error) {
      this.issues.push(`lefthook.yml 读取错误: ${error.message}`);
      return false;
    }
  }

  validateScripts() {
    this.log('🔍 验证脚本文件...', 'info');

    const requiredScripts = [
      'scripts/ci-pipeline.js',
      'scripts/pr-check.js',
      'scripts/security-audit.js',
      'scripts/deploy.sh',
      'scripts/rollback.sh',
      'scripts/smart-rollback.js',
      'scripts/slo-check.js',
      'scripts/setup-github-repo.sh'
    ];

    for (const script of requiredScripts) {
      this.checkFile(script, `脚本文件`);
    }
  }

  generateReport() {
    console.log('\n' + '='.repeat(80));
    this.log('📊 GitHub 配置验证报告', 'info');
    console.log('='.repeat(80));

    console.log(`✅ 通过检查: ${this.successes.length}`);
    console.log(`❌ 发现问题: ${this.issues.length}`);

    if (this.successes.length > 0) {
      console.log('\n✅ 通过的项目:');
      this.successes.forEach(item => console.log(`  • ${item}`));
    }

    if (this.issues.length > 0) {
      console.log('\n❌ 需要修复的问题:');
      this.issues.forEach(issue => console.log(`  • ${issue}`));
    }

    console.log('\n💡 建议的修复步骤:');

    if (this.issues.some(i => i.includes('工作流文件'))) {
      console.log('  1. 确保 .github/workflows/ 目录存在');
      console.log('  2. 复制或创建 CI/CD 工作流文件');
    }

    if (this.issues.some(i => i.includes('npm 脚本'))) {
      console.log('  1. 检查 package.json 中的 scripts 部分');
      console.log('  2. 添加缺失的 CI/CD 相关脚本');
    }

    if (this.issues.some(i => i.includes('Git 钩子'))) {
      console.log('  1. 安装 lefthook: npm install -g @arkweid/lefthook');
      console.log('  2. 初始化 lefthook: lefthook install');
    }

    console.log('\n🔗 相关文档:');
    console.log('  • .github/README.md - GitHub 配置指南');
    console.log('  • docs/github-workflow-guide.md - 工作流详细指南');

    console.log('='.repeat(80));

    return this.issues.length === 0;
  }

  async run() {
    try {
      this.log('🚀 开始验证 frys GitHub 配置', 'info');

      this.validateGitHubWorkflows();
      this.validatePackageScripts();
      this.validateLefthookConfig();
      this.validateScripts();

      const success = this.generateReport();

      if (success) {
        this.log('🎉 所有配置验证通过！', 'success');
        process.exit(0);
      } else {
        this.log('❌ 配置验证失败，请修复上述问题。', 'error');
        process.exit(1);
      }

    } catch (error) {
      this.log(`验证过程出错: ${error.message}`, 'error');
      process.exit(1);
    }
  }
}

// 简单的 YAML 解析器 (基础实现)
class YAML {
  static parse(content) {
    // 基础的 YAML 解析，仅用于验证工作流结构
    const lines = content.split('\n');
    const result = {};

    let currentKey = '';
    let inMultiline = false;

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith('#') || trimmed === '') continue;

      if (trimmed.includes(':')) {
        const [key, ...valueParts] = trimmed.split(':');
        currentKey = key.trim();
        const value = valueParts.join(':').trim();

        if (value === '|' || value === '>') {
          inMultiline = true;
          result[currentKey] = '';
        } else if (value) {
          result[currentKey] = value.replace(/^["']|["']$/g, '');
          inMultiline = false;
        } else {
          result[currentKey] = {};
          inMultiline = false;
        }
      } else if (inMultiline && trimmed) {
        result[currentKey] += trimmed + '\n';
      }
    }

    return result;
  }
}

// 执行验证
const validator = new GitHubSetupValidator();
validator.run().catch(error => {
  console.error('验证失败:', error);
  process.exit(1);
});
