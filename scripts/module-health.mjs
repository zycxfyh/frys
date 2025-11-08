#!/usr/bin/env zx

// 🔍 模块化健康检查脚本 - 轻量化、模块化、可配置

import 'dotenv/config';
import { $ } from 'zx';
import { generateLightweightConfig, validateConfig } from '../config/lightweight.config.js';

const config = generateLightweightConfig();

async function moduleHealthCheck() {
  console.log('🔍 开始模块化健康检查...');

  const results = {
    timestamp: new Date().toISOString(),
    environment: config.environment,
    checks: {},
    summary: {
      total: 0,
      passed: 0,
      failed: 0,
      warnings: 0
    }
  };

  try {
    // 1. 配置检查
    results.checks.config = await checkConfig();

    // 2. 模块检查
    results.checks.modules = await checkModules();

    // 3. 依赖检查
    results.checks.dependencies = await checkDependencies();

    // 4. 环境检查
    results.checks.environment = await checkEnvironment();

    // 5. 性能检查
    results.checks.performance = await checkPerformance();

    // 6. 安全检查
    results.checks.security = await checkSecurity();

    // 计算汇总
    calculateSummary(results);

    // 输出结果
    printResults(results);

    // 保存报告
    await saveReport(results);

    // 根据结果决定退出码
    if (results.summary.failed > 0) {
      console.log('❌ 健康检查失败');
      process.exit(1);
    } else if (results.summary.warnings > 0) {
      console.log('⚠️  健康检查通过但有警告');
      process.exit(0);
    } else {
      console.log('✅ 健康检查全部通过');
      process.exit(0);
    }

  } catch (error) {
    console.error('❌ 健康检查执行失败:', error.message);
    process.exit(1);
  }
}

async function checkConfig() {
  console.log('⚙️  检查配置...');

  const validation = validateConfig(config);
  const result = {
    status: validation.valid ? 'passed' : 'failed',
    details: validation.errors,
    config: {
      environment: config.environment.env,
      features: Object.keys(config.features).length,
      modules: config.modules.core.length,
      adapters: Object.keys(config.adapters).length
    }
  };

  return result;
}

async function checkModules() {
  console.log('📦 检查模块...');

  const modules = [
    ...config.modules.core,
    ...Object.values(config.modules.optional).flat()
  ];

  const results = [];

  for (const modulePath of modules) {
    try {
      // 检查文件是否存在
      const exists = await $`test -f ${modulePath}`.exitCode === 0;

      if (exists) {
        // 尝试加载模块
        const module = await import(modulePath);
        results.push({
          path: modulePath,
          status: 'passed',
          loaded: true,
          exports: Object.keys(module).length
        });
      } else {
        results.push({
          path: modulePath,
          status: 'failed',
          error: '文件不存在'
        });
      }
    } catch (error) {
      results.push({
        path: modulePath,
        status: 'failed',
        error: error.message
      });
    }
  }

  const passed = results.filter(r => r.status === 'passed').length;
  const failed = results.filter(r => r.status === 'failed').length;

  return {
    status: failed === 0 ? 'passed' : 'failed',
    total: modules.length,
    passed,
    failed,
    details: results
  };
}

async function checkDependencies() {
  console.log('📋 检查依赖...');

  try {
    // 检查package.json
    const packageJson = JSON.parse(await $`cat package.json`);
    const deps = Object.keys(packageJson.dependencies || {});
    const devDeps = Object.keys(packageJson.devDependencies || {});

    // 检查依赖是否已安装
    await $`npm ls --depth=0`;

    return {
      status: 'passed',
      dependencies: deps.length,
      devDependencies: devDeps.length,
      total: deps.length + devDeps.length
    };
  } catch (error) {
    return {
      status: 'failed',
      error: error.message
    };
  }
}

async function checkEnvironment() {
  console.log('🌍 检查环境...');

  const checks = [
    { name: 'Node.js', cmd: 'node --version', required: true },
    { name: 'NPM', cmd: 'npm --version', required: true },
    { name: 'Git', cmd: 'git --version', required: false },
    { name: 'Docker', cmd: 'docker --version', required: false }
  ];

  const results = [];

  for (const check of checks) {
    try {
      const output = await $`${check.cmd.split(' ')}`;
      results.push({
        name: check.name,
        status: 'passed',
        version: output.stdout.trim(),
        required: check.required
      });
    } catch (error) {
      results.push({
        name: check.name,
        status: check.required ? 'failed' : 'warning',
        error: error.message,
        required: check.required
      });
    }
  }

  const failed = results.filter(r => r.status === 'failed').length;
  const warnings = results.filter(r => r.status === 'warning').length;

  return {
    status: failed === 0 ? 'passed' : 'failed',
    total: checks.length,
    passed: results.filter(r => r.status === 'passed').length,
    failed,
    warnings,
    details: results
  };
}

async function checkPerformance() {
  console.log('⚡ 检查性能...');

  const results = [];

  try {
    // 检查内存使用
    const memUsage = process.memoryUsage();
    results.push({
      metric: 'memory_usage',
      value: memUsage.heapUsed / 1024 / 1024, // MB
      unit: 'MB',
      status: memUsage.heapUsed < 100 * 1024 * 1024 ? 'passed' : 'warning'
    });

    // 检查CPU使用（简单检查）
    results.push({
      metric: 'cpu_cores',
      value: require('os').cpus().length,
      unit: 'cores',
      status: 'passed'
    });

  } catch (error) {
    results.push({
      metric: 'performance_check',
      status: 'failed',
      error: error.message
    });
  }

  return {
    status: results.some(r => r.status === 'failed') ? 'failed' : 'passed',
    metrics: results
  };
}

async function checkSecurity() {
  console.log('🔒 检查安全...');

  const results = [];

  try {
    // 检查敏感文件
    const sensitiveFiles = ['.env', 'secrets.json', '.secrets.json'];
    for (const file of sensitiveFiles) {
      const exists = await $`test -f ${file}`.exitCode === 0;
      if (exists) {
        results.push({
          check: `sensitive_file_${file}`,
          status: 'warning',
          message: `敏感文件存在: ${file}`
        });
      }
    }

    // 检查权限
    const permissions = await $`ls -la package.json`;
    const isWorldWritable = permissions.stdout.includes('-rw-rw-rw');
    results.push({
      check: 'file_permissions',
      status: isWorldWritable ? 'warning' : 'passed',
      message: isWorldWritable ? '文件权限过于宽松' : '文件权限正常'
    });

  } catch (error) {
    results.push({
      check: 'security_check',
      status: 'failed',
      error: error.message
    });
  }

  return {
    status: results.some(r => r.status === 'failed') ? 'failed' : 'passed',
    checks: results
  };
}

function calculateSummary(results) {
  const checks = Object.values(results.checks);

  results.summary.total = checks.length;
  results.summary.passed = checks.filter(c => c.status === 'passed').length;
  results.summary.failed = checks.filter(c => c.status === 'failed').length;
  results.summary.warnings = checks.filter(c => c.status === 'warning').length;
}

function printResults(results) {
  console.log('\n📊 健康检查结果:');
  console.log('='.repeat(50));

  Object.entries(results.checks).forEach(([name, check]) => {
    const icon = check.status === 'passed' ? '✅' :
                 check.status === 'failed' ? '❌' : '⚠️';
    console.log(`${icon} ${name}: ${check.status}`);
  });

  console.log('='.repeat(50));
  console.log(`📈 汇总: ${results.summary.passed}/${results.summary.total} 通过, ${results.summary.failed} 失败, ${results.summary.warnings} 警告`);
}

async function saveReport(results) {
  const fs = require('fs');
  const reportPath = 'health-report.json';

  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`💾 健康检查报告已保存: ${reportPath}`);
}

// 执行健康检查
moduleHealthCheck();
