#!/usr/bin/env node

/**
 * 部署验证脚本
 * 验证轻量化重构后的系统部署状态
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 开始部署验证...\n');

// 验证构建产物
console.log('📦 检查构建产物...');
const distPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
  const files = fs.readdirSync(distPath);
  console.log(`✅ 构建目录存在，包含 ${files.length} 个文件`);
  console.log(`   文件列表: ${files.join(', ')}\n`);
} else {
  console.log('❌ 构建目录不存在\n');
  process.exit(1);
}

// 验证核心模块
console.log('🔧 检查核心模块...');
const coreModules = [
  'BaseModule.js',
  'LightweightContainer.js',
  'UnifiedErrorHandler.js',
  'PluginManager.js',
  'FunctionalUtils.js',
  'AxiosInspiredHTTP.js',
  'JWTInspiredAuth.js',
  'ZustandInspiredState.js',
  'LodashInspiredUtils.js'
];

let coreModulesValid = true;
coreModules.forEach(module => {
  const modulePath = path.join(__dirname, '..', 'src', 'core', module);
  if (fs.existsSync(modulePath)) {
    console.log(`✅ ${module} 存在`);
  } else {
    console.log(`❌ ${module} 不存在`);
    coreModulesValid = false;
  }
});

if (coreModulesValid) {
  console.log('\n✅ 所有核心模块验证通过\n');
} else {
  console.log('\n❌ 部分核心模块缺失\n');
}

// 验证配置文件
console.log('⚙️ 检查配置文件...');
const configFiles = ['package.json', 'vitest.config.js'];
let configValid = true;

configFiles.forEach(file => {
  const filePath = path.join(__dirname, '..', file);
  if (fs.existsSync(filePath)) {
    console.log(`✅ ${file} 存在`);
  } else {
    console.log(`❌ ${file} 不存在`);
    configValid = false;
  }
});

if (configValid) {
  console.log('\n✅ 配置文件验证通过\n');
} else {
  console.log('\n❌ 配置文件缺失\n');
}

// 验证文档
console.log('📚 检查文档...');
const docs = [
  'README.md',
  'docs/lightweight-refactor-plan.md',
  'docs/lightweight-refactor-summary.md',
  'docs/pr-review-checklist.md'
];

let docsValid = true;
docs.forEach(doc => {
  const docPath = path.join(__dirname, '..', doc);
  if (fs.existsSync(docPath)) {
    console.log(`✅ ${doc} 存在`);
  } else {
    console.log(`❌ ${doc} 不存在`);
    docsValid = false;
  }
});

if (docsValid) {
  console.log('\n✅ 文档验证通过\n');
} else {
  console.log('\n❌ 部分文档缺失\n');
}

// 验证测试覆盖
console.log('🧪 检查测试覆盖...');
const testDirs = ['tests/unit', 'tests/integration', 'tests/regression'];
let testsValid = true;

testDirs.forEach(dir => {
  const dirPath = path.join(__dirname, '..', dir);
  if (fs.existsSync(dirPath)) {
    const files = fs.readdirSync(dirPath);
    const testFiles = files.filter(file => file.endsWith('.test.js'));
    console.log(`✅ ${dir}: ${testFiles.length} 个测试文件`);
  } else {
    console.log(`❌ ${dir} 目录不存在`);
    testsValid = false;
  }
});

if (testsValid) {
  console.log('\n✅ 测试结构验证通过\n');
} else {
  console.log('\n❌ 测试结构不完整\n');
}

// 最终报告
console.log('🎯 部署验证完成\n');

const allValid = coreModulesValid && configValid && docsValid && testsValid;

if (allValid) {
  console.log('🎉 所有验证通过！系统已准备好部署。\n');
  console.log('🚀 下一步操作建议:');
  console.log('1. 运行: npm run staging:setup');
  console.log('2. 运行: npm run staging:up');
  console.log('3. 验证: npm run staging:test');
  console.log('4. 部署: npm run deploy:staging\n');

  process.exit(0);
} else {
  console.log('⚠️ 发现问题，需要修复后才能部署。\n');
  process.exit(1);
}
