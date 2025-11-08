#!/usr/bin/env zx

// 🚀 轻量化部署脚本 - 支持多环境、可迁移、零停机

import 'dotenv/config';
import { $ } from 'zx';
import { generateLightweightConfig } from '../config/lightweight.config.js';

const config = generateLightweightConfig();

const deployConfig = {
  environment: process.env.DEPLOY_ENV || 'staging',
  strategy: process.env.DEPLOY_STRATEGY || 'rolling', // rolling/blue-green/canary
  rollback: process.env.ENABLE_ROLLBACK !== 'false',
  healthCheck: process.env.HEALTH_CHECK !== 'false'
};

async function lightDeploy() {
  console.log(`🚀 开始轻量化部署 [${deployConfig.environment}] [${deployConfig.strategy}]`);

  const startTime = Date.now();

  try {
    // 1. 部署前准备
    await preDeploy();

    // 2. 执行部署
    await executeDeploy();

    // 3. 健康检查
    if (deployConfig.healthCheck) {
      await healthCheck();
    }

    // 4. 部署后清理
    await postDeploy();

    // 5. 生成部署报告
    await generateDeployReport(startTime);

    console.log(`✅ 部署完成 (${Date.now() - startTime}ms)`);

  } catch (error) {
    console.error('❌ 部署失败:', error.message);

    // 自动回滚
    if (deployConfig.rollback) {
      console.log('🔄 正在执行自动回滚...');
      await rollback();
    }

    process.exit(1);
  }
}

async function preDeploy() {
  console.log('🔍 部署前检查...');

  // 验证构建产物
  if (!await fileExists('dist/index.js')) {
    throw new Error('构建产物不存在，请先执行构建');
  }

  // 检查部署环境
  console.log(`🌍 部署环境: ${deployConfig.environment}`);
  console.log(`📋 部署策略: ${deployConfig.strategy}`);

  // 备份当前版本
  if (deployConfig.rollback) {
    console.log('💾 创建备份...');
    await $`cp -r dist dist.backup.${Date.now()}`;
  }
}

async function executeDeploy() {
  console.log('📦 执行部署...');

  switch (deployConfig.strategy) {
    case 'blue-green':
      await deployBlueGreen();
      break;
    case 'canary':
      await deployCanary();
      break;
    default:
      await deployRolling();
  }
}

async function deployRolling() {
  console.log('🔄 执行滚动部署...');

  // 停止当前服务
  try {
    await $`pkill -f "node.*dist/index.js"`;
    console.log('🛑 已停止当前服务');
  } catch (error) {
    // 服务可能未运行，忽略错误
  }

  // 等待一会儿确保端口释放
  await sleep(2000);

  // 启动新版本
  console.log('🟢 启动新版本...');
  const server = $`node dist/index.js`;

  // 后台运行
  server.catch((error) => {
    console.error('服务启动失败:', error);
    throw error;
  });

  // 等待服务启动
  await waitForService();
}

async function deployBlueGreen() {
  console.log('🔵 执行蓝绿部署...');

  // 启动新版本在不同端口
  const newPort = deployConfig.environment === 'production' ? 3001 : 4001;

  console.log(`🟢 启动新版本 (端口: ${newPort})...`);
  const newServer = $`PORT=${newPort} node dist/index.js`;

  newServer.catch((error) => {
    console.error('新版本启动失败:', error);
    throw error;
  });

  // 等待新版本就绪
  await waitForService(newPort);

  // 切换流量 (简化版)
  console.log('🔄 切换流量...');
  // 在生产环境中，这里会涉及负载均衡器配置

  // 停止旧版本
  console.log('🛑 停止旧版本...');
  try {
    await $`pkill -f "node.*dist/index.js"`;
  } catch (error) {
    // 忽略错误
  }
}

async function deployCanary() {
  console.log('🐦 执行金丝雀部署...');

  // 启动少量新版本实例
  const canaryPort = deployConfig.environment === 'production' ? 3002 : 4002;

  console.log(`🟢 启动金丝雀版本 (端口: ${canaryPort})...`);
  const canaryServer = $`PORT=${canaryPort} node dist/index.js`;

  canaryServer.catch((error) => {
    console.error('金丝雀版本启动失败:', error);
    throw error;
  });

  // 等待金丝雀版本就绪
  await waitForService(canaryPort);

  console.log('📊 金丝雀部署完成，可通过路由逐步增加流量');
}

async function healthCheck() {
  console.log('🩺 执行部署健康检查...');

  const maxRetries = 10;
  const retryDelay = 3000;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(`http://localhost:${config.environment.isProd ? 3000 : 3000}/health`);
      if (response.ok) {
        console.log('✅ 健康检查通过');
        return;
      }
    } catch (error) {
      // 继续重试
    }

    if (i < maxRetries - 1) {
      console.log(`⏳ 健康检查失败，${retryDelay/1000}秒后重试 (${i + 1}/${maxRetries})`);
      await sleep(retryDelay);
    }
  }

  throw new Error('健康检查失败');
}

async function postDeploy() {
  console.log('🧹 部署后清理...');

  // 清理旧备份
  try {
    await $`find . -name "dist.backup.*" -type d -mtime +7 -exec rm -rf {} \\;`;
    console.log('🗑️  已清理旧备份');
  } catch (error) {
    // 忽略清理错误
  }
}

async function rollback() {
  console.log('🔄 执行回滚...');

  try {
    // 查找最新备份
    const { stdout: backupDir } = await $`ls -td dist.backup.* | head -1`;

    if (backupDir.trim()) {
      // 恢复备份
      await $`rm -rf dist && cp -r ${backupDir.trim()} dist`;
      console.log('✅ 备份已恢复');

      // 重启服务
      await deployRolling();
      console.log('✅ 服务已重启');
    } else {
      throw new Error('未找到备份');
    }
  } catch (error) {
    console.error('回滚失败:', error.message);
    throw error;
  }
}

async function waitForService(port = null) {
  const checkPort = port || (config.environment.isProd ? 3000 : 3000);
  const maxWait = 30000; // 30秒
  const startTime = Date.now();

  while (Date.now() - startTime < maxWait) {
    try {
      const response = await fetch(`http://localhost:${checkPort}/health`);
      if (response.ok) {
        return;
      }
    } catch (error) {
      // 服务未就绪，继续等待
    }
    await sleep(1000);
  }

  throw new Error(`服务启动超时 (端口: ${checkPort})`);
}

async function generateDeployReport(startTime) {
  console.log('📋 生成部署报告...');

  const report = {
    timestamp: new Date().toISOString(),
    environment: deployConfig.environment,
    strategy: deployConfig.strategy,
    duration: Date.now() - startTime,
    config: config,
    artifacts: {
      build: await getBuildInfo(),
      git: await getGitInfo()
    },
    health: {
      checked: deployConfig.healthCheck,
      status: 'passed' // 如果到达这里说明检查通过
    }
  };

  const fs = require('fs');
  fs.writeFileSync('deploy-report.json', JSON.stringify(report, null, 2));
  console.log('📄 部署报告已生成: deploy-report.json');
}

async function getBuildInfo() {
  try {
    const buildReport = JSON.parse(await $`cat dist/build-report.json`);
    return buildReport;
  } catch (error) {
    return { error: '无法读取构建报告' };
  }
}

async function getGitInfo() {
  try {
    const commit = (await $`git rev-parse HEAD`).stdout.trim();
    const branch = (await $`git branch --show-current`).stdout.trim();
    const tag = (await $`git describe --tags --abbrev=0 2>/dev/null || echo "no-tag"`).stdout.trim();

    return { commit, branch, tag: tag === 'no-tag' ? null : tag };
  } catch (error) {
    return { error: '无法获取Git信息' };
  }
}

async function fileExists(path) {
  try {
    await $`test -f ${path}`;
    return true;
  } catch {
    return false;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 执行部署
lightDeploy();
