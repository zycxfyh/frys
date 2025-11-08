#!/usr/bin/env zx

// 🧪 轻量化测试脚本 - 支持并行执行、增量测试、智能跳过

import 'dotenv/config';
import { $ } from 'zx';
import { generateLightweightConfig } from '../config/lightweight.config.js';

const config = generateLightweightConfig();

const testConfig = {
  mode: process.env.TEST_MODE || 'smart', // smart/fast/full
  parallel: process.env.TEST_PARALLEL !== 'false',
  incremental: process.env.TEST_INCREMENTAL !== 'false',
  coverage: process.env.TEST_COVERAGE !== 'false',
  timeout: parseInt(process.env.TEST_TIMEOUT) || 30000
};

async function lightTest() {
  console.log(`🧪 开始轻量化测试 [${testConfig.mode}]`);

  const startTime = Date.now();

  try {
    // 1. 测试前准备
    await preTest();

    // 2. 根据模式选择测试策略
    let results;
    switch (testConfig.mode) {
      case 'fast':
        results = await runFastTests();
        break;
      case 'full':
        results = await runFullTests();
        break;
      default:
        results = await runSmartTests();
    }

    // 3. 测试后处理
    await postTest(results);

    // 4. 生成测试报告
    await generateTestReport(results, startTime);

    console.log(`✅ 测试完成 (${Date.now() - startTime}ms)`);

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    process.exit(1);
  }
}

async function preTest() {
  console.log('🔍 测试前准备...');

  // 检查测试环境
  const testDir = 'tests';
  if (!await fileExists(testDir)) {
    throw new Error(`测试目录不存在: ${testDir}`);
  }

  // 检查是否有测试文件
  const testFiles = await $`find tests -name "*.test.js" -o -name "*.spec.js" | wc -l`;
  console.log(`发现测试文件: ${testFiles.stdout.trim()} 个`);

  // 准备测试数据库（如果需要）
  if (config.adapters.database === 'sqlite') {
    console.log('📊 使用SQLite测试数据库');
  }
}

async function runSmartTests() {
  console.log('🧠 执行智能测试...');

  const results = {
    unit: { status: 'pending', duration: 0 },
    integration: { status: 'pending', duration: 0 },
    e2e: { status: 'pending', duration: 0 }
  };

  // 1. 快速单元测试
  console.log('🏃 执行单元测试...');
  const unitStart = Date.now();
  try {
    await $`npm run test:unit -- --reporter=json --outputFile=test-results/unit-results.json`;
    results.unit.status = 'passed';
  } catch (error) {
    results.unit.status = 'failed';
    console.log('⚠️ 单元测试失败，继续其他测试...');
  }
  results.unit.duration = Date.now() - unitStart;

  // 2. 条件集成测试（仅在单元测试通过时）
  if (results.unit.status === 'passed') {
    console.log('🔗 执行集成测试...');
    const integrationStart = Date.now();
    try {
      await $`npm run test:integration:light -- --reporter=json --outputFile=test-results/integration-results.json`;
      results.integration.status = 'passed';
    } catch (error) {
      results.integration.status = 'failed';
    }
    results.integration.duration = Date.now() - integrationStart;
  } else {
    console.log('⏭️ 跳过集成测试（单元测试失败）');
    results.integration.status = 'skipped';
  }

  // 3. 可选E2E测试（仅在集成测试通过时）
  if (results.integration.status === 'passed' && config.environment.isCI) {
    console.log('🌐 执行E2E测试...');
    const e2eStart = Date.now();
    try {
      await $`npm run test:e2e:api -- --reporter=json --outputFile=test-results/e2e-results.json`;
      results.e2e.status = 'passed';
    } catch (error) {
      results.e2e.status = 'failed';
    }
    results.e2e.duration = Date.now() - e2eStart;
  } else {
    results.e2e.status = 'skipped';
  }

  return results;
}

async function runFastTests() {
  console.log('🏃 执行快速测试...');

  const results = {
    unit: { status: 'pending', duration: 0 }
  };

  const startTime = Date.now();
  try {
    // 只运行最关键的单元测试，跳过慢速测试
    await $`npm run test:unit -- --grep="fast" --reporter=json --outputFile=test-results/fast-results.json`;
    results.unit.status = 'passed';
  } catch (error) {
    results.unit.status = 'failed';
  }
  results.unit.duration = Date.now() - startTime;

  return results;
}

async function runFullTests() {
  console.log('📋 执行完整测试...');

  const results = {
    comprehensive: { status: 'pending', duration: 0 }
  };

  const startTime = Date.now();
  try {
    // 运行所有测试类型
    await $`npm run test:all -- --reporter=json --outputFile=test-results/comprehensive-results.json`;
    results.comprehensive.status = 'passed';
  } catch (error) {
    results.comprehensive.status = 'failed';
  }
  results.comprehensive.duration = Date.now() - startTime;

  return results;
}

async function postTest(results) {
  console.log('🧹 测试后处理...');

  // 清理测试数据库
  if (config.adapters.database === 'sqlite') {
    try {
      await $`rm -f test.db test.db-*`;
      console.log('🗑️ 已清理测试数据库');
    } catch (error) {
      // 忽略清理错误
    }
  }

  // 检查覆盖率
  if (testConfig.coverage) {
    await checkCoverage();
  }
}

async function checkCoverage() {
  console.log('📊 检查测试覆盖率...');

  try {
    if (await fileExists('coverage/coverage-summary.json')) {
      const coverage = JSON.parse(await $`cat coverage/coverage-summary.json`);
      const linesPct = coverage.total.lines.pct;

      console.log(`覆盖率: ${linesPct}%`);

      if (linesPct < 70) {
        console.log('⚠️ 覆盖率偏低，建议增加测试');
      }
    }
  } catch (error) {
    console.log('⚠️ 无法读取覆盖率报告');
  }
}

async function generateTestReport(results, startTime) {
  console.log('📋 生成测试报告...');

  const report = {
    timestamp: new Date().toISOString(),
    config: testConfig,
    environment: config.environment,
    duration: Date.now() - startTime,
    results,
    summary: {
      total: Object.keys(results).length,
      passed: Object.values(results).filter(r => r.status === 'passed').length,
      failed: Object.values(results).filter(r => r.status === 'failed').length,
      skipped: Object.values(results).filter(r => r.status === 'skipped').length
    }
  };

  const fs = require('fs');
  fs.writeFileSync('light-test-report.json', JSON.stringify(report, null, 2));
  console.log('📄 轻量化测试报告已生成: light-test-report.json');
}

async function fileExists(path) {
  try {
    await $`test -f ${path}`;
    return true;
  } catch {
    return false;
  }
}

// 执行测试
lightTest();
