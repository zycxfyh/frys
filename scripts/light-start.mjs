#!/usr/bin/env zx

// 🪶 轻量化启动脚本 - 支持多环境、热重载、最小化依赖

import 'dotenv/config';
import { $ } from 'zx';

// 配置检测和优化
const config = {
  env: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 3000,
  mode: process.env.LIGHT_MODE || 'full', // full/minimal/micro
  features: process.env.FEATURE_FLAGS?.split(',') || [],
};

// 轻量化启动逻辑
async function lightStart() {
  console.log('🪶 启动轻量化模式:', config.mode);

  try {
    // 1. 环境健康检查
    await healthCheck();

    // 2. 根据模式选择启动策略
    switch (config.mode) {
      case 'micro':
        await startMicro();
        break;
      case 'minimal':
        await startMinimal();
        break;
      default:
        await startFull();
    }

    // 3. 启动监控
    await startMonitoring();

    console.log(`✅ 服务已启动: http://localhost:${config.port}`);
  } catch (error) {
    console.error('❌ 启动失败:', error.message);
    process.exit(1);
  }
}

async function healthCheck() {
  console.log('🔍 执行环境健康检查...');

  // 检查关键依赖
  const checks = [
    { name: 'Node.js', cmd: 'node --version' },
    { name: 'NPM', cmd: 'npm --version' },
    { name: 'Git', cmd: 'git --version' },
  ];

  for (const check of checks) {
    try {
      await $`${check.cmd.split(' ')}`;
      console.log(`✅ ${check.name} ✓`);
    } catch {
      console.log(`⚠️  ${check.name} 未找到`);
    }
  }
}

async function startMicro() {
  console.log('🦠 启动微服务模式...');

  // 使用 esbuild 进行快速编译和启动
  await $`esbuild src/index.js --bundle --minify --platform=node --outfile=dist/micro.js`;

  // 轻量化服务器
  const server = $`node dist/micro.js`;

  // 热重载监听
  if (config.env === 'development') {
    const watcher = $`npx nodemon --exec "node dist/micro.js" --watch src --ext js`;
    watcher.catch(() => {}); // 忽略错误，让主进程继续
  }

  return server;
}

async function startMinimal() {
  console.log('⚡ 启动最小化模式...');

  // 只启动核心服务，禁用非必要功能
  process.env.DISABLE_ANALYTICS = 'true';
  process.env.DISABLE_CACHING = 'true';
  process.env.MINIMAL_MODE = 'true';

  await $`node src/index.js`;
}

async function startFull() {
  console.log('🚀 启动完整模式...');
  await $`node src/index.js`;
}

async function startMonitoring() {
  if (config.env === 'development') {
    console.log('📊 启动开发监控...');

    // 轻量化监控：只监控关键指标
    setInterval(async () => {
      try {
        const response = await fetch(`http://localhost:${config.port}/health`);
        if (!response.ok) {
          console.warn('⚠️  服务健康检查失败');
        }
      } catch (error) {
        // 静默处理，避免干扰主要输出
      }
    }, 30000); // 30秒检查一次
  }
}

// 优雅关闭处理
process.on('SIGINT', () => {
  console.log('\n🛑 正在关闭服务...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 正在关闭服务...');
  process.exit(0);
});

// 启动服务
lightStart();
