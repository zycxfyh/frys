#!/usr/bin/env zx

// 🏗️ 轻量化构建脚本 - 支持多目标、增量构建、优化打包

import 'dotenv/config';
import { $ } from 'zx';
import { readFileSync, writeFileSync, existsSync } from 'fs';

const config = {
  target: process.env.BUILD_TARGET || 'node', // node/browser/both
  mode: process.env.BUILD_MODE || 'development', // development/production
  optimize: process.env.BUILD_OPTIMIZE !== 'false', // 是否优化
  incremental: process.env.BUILD_INCREMENTAL !== 'false', // 增量构建
  builder: process.env.BUILDER || 'esbuild' // esbuild/swc
};

async function lightBuild() {
  console.log(`🏗️  开始轻量化构建 [${config.target}] [${config.mode}]`);

  const startTime = Date.now();

  try {
    // 1. 构建前准备
    await preBuild();

    // 2. 根据目标选择构建策略
    switch (config.target) {
      case 'browser':
        await buildBrowser();
        break;
      case 'both':
        await Promise.all([buildNode(), buildBrowser()]);
        break;
      default:
        await buildNode();
    }

    // 3. 构建后优化
    if (config.optimize) {
      await postBuild();
    }

    // 4. 生成构建报告
    await generateReport(startTime);

    const duration = Date.now() - startTime;
    console.log(`✅ 构建完成 (${duration}ms)`);

  } catch (error) {
    console.error('❌ 构建失败:', error.message);
    process.exit(1);
  }
}

async function preBuild() {
  console.log('🔍 构建前准备...');

  // 创建输出目录
  await $`mkdir -p dist`;

  // 检查依赖
  if (!existsSync('package.json')) {
    throw new Error('package.json not found');
  }

  // 增量构建检查
  if (config.incremental) {
    console.log('🔄 执行增量构建...');
    // 这里可以实现更复杂的增量构建逻辑
  }
}

async function buildNode() {
  console.log(`📦 构建Node.js版本 [${config.builder}]...`);

  if (config.builder === 'swc') {
    await buildNodeWithSWC();
  } else {
    await buildNodeWithEsbuild();
  }
}

async function buildNodeWithEsbuild() {
  const esbuildCmd = [
    'esbuild',
    'src/index.js',
    '--bundle',
    '--platform=node',
    '--format=esm',
    '--outfile=dist/index.js',
    '--loader:.node=file'
  ];

  if (config.mode === 'production') {
    esbuildCmd.push('--minify', '--sourcemap');
  }

  if (config.optimize) {
    esbuildCmd.push('--tree-shaking=true');
  }

  await $`${esbuildCmd}`;
}

async function buildNodeWithSWC() {
  const swcCmd = [
    'swc',
    'src/index.js',
    '-o',
    'dist/index.js'
  ];

  // SWC配置通过.sswcrc文件处理
  if (config.mode === 'production') {
    process.env.NODE_ENV = 'production';
  }

  await $`${swcCmd}`;

  // 如果需要bundle，使用esbuild进行bundling（SWC主要用于编译）
  if (config.optimize) {
    console.log('🔗 使用esbuild进行bundling...');
    await $`esbuild src/index.js --bundle --platform=node --format=esm --outfile=dist/index.bundle.js --tree-shaking=true --loader:.node=file`;
    // 替换为bundle版本
    await $`mv dist/index.bundle.js dist/index.js`;
  }
}


async function buildBrowser() {
  console.log('🌐 构建浏览器版本...');

  await $`esbuild src/index.js --bundle --platform=browser --format=iife --global-name=Frys --outfile=dist/browser.js`;

  if (config.mode === 'production') {
    await $`esbuild dist/browser.js --minify --outfile=dist/browser.min.js`;
  }
}

async function postBuild() {
  console.log('⚡ 执行构建优化...');

  // 分析包大小
  try {
    const { stdout: size } = await $`du -sh dist/`;
    console.log(`📊 构建产物大小: ${size.trim()}`);
  } catch (error) {
    // 忽略大小检查错误
  }

  // 生成压缩版本
  if (existsSync('dist/index.js')) {
    await $`gzip -9 -c dist/index.js > dist/index.js.gz`;
    console.log('🗜️  生成压缩版本');
  }
}

async function generateReport(startTime) {
  console.log('📋 生成构建报告...');

  const report = {
    timestamp: new Date().toISOString(),
    config,
    build: {
      duration: Date.now() - startTime,
      target: config.target,
      mode: config.mode,
      optimize: config.optimize
    },
    artifacts: {}
  };

    // 分析构建产物
  const fs = require('fs');
  if (existsSync('dist')) {
    const files = await $`find dist -type f -exec ls -lh {} \\;`;
    report.artifacts = {
      files: files.stdout.trim().split('\n').filter(Boolean),
      total_size: (await $`du -sb dist/`).stdout.trim().split('\t')[0]
    };
  }

  writeFileSync('dist/build-report.json', JSON.stringify(report, null, 2));
  console.log('📄 构建报告已生成: dist/build-report.json');

  return report;
}

// 执行构建
lightBuild();
