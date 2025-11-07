#!/usr/bin/env node

/**
 * WokeFlow 开源项目集成演示
 * 展示基于优秀开源项目的现代化架构
 */

// 直接导入源模块（用于开发环境）
import { logger } from './src/utils/logger.js';
import { config } from './src/utils/config.js';
import { getContainer } from './src/core/container.js';
import { eventSystem } from './src/core/events.js';
import { errorHandler } from './src/core/error-handler.js';
import { pluginManager } from './src/core/plugin-system.js';

// 模拟演示配置
const demoConfig = {
  env: 'development',
  port: 3001,
  host: 'localhost',
  redis: {
    host: 'localhost',
    port: 6379,
  },
  sentry: {
    dsn: process.env.SENTRY_DSN || null,
  }
};

// 合并配置
Object.assign(config, demoConfig);

async function runDemoLogic() {
  // 1. 初始化错误处理器 (快速失败)
  console.log('1️⃣ 初始化 Sentry 错误处理器...');
  try {
    await Promise.race([
      errorHandler.initialize(),
      new Promise((_, reject) => setTimeout(() => reject(new Error()), 2000))
    ]);
    console.log('✅ Sentry 错误处理器已初始化');
  } catch (error) {
    console.log('⚠️ 错误处理器初始化失败');
  }

  // 2. 初始化依赖注入容器 (快速失败)
  console.log('2️⃣ 初始化 Awilix 依赖注入容器...');
  let container;
  try {
    const containerPromise = getContainer(); // 已经是异步的
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error()), 2000));

    container = await Promise.race([containerPromise, timeoutPromise]);
    console.log('✅ Awilix 容器已初始化');
  } catch (error) {
    console.log('❌ 容器初始化失败');
    throw error;
  }

  // 3. 初始化插件系统 (快速失败)
  console.log('3️⃣ 初始化 fastify-plugin 插件系统...');
  try {
    await Promise.race([
      pluginManager.initialize(),
      new Promise((_, reject) => setTimeout(() => reject(new Error()), 2000))
    ]);
    console.log('✅ 插件系统已初始化');
  } catch (error) {
    console.log('⚠️ 插件系统初始化失败');
  }

    // 4. 测试核心服务 (带快速失败机制)
    console.log('4️⃣ 测试核心服务...');

    const services = [
      { name: 'http', emoji: '📡', description: 'HTTP客户端' },
      { name: 'state', emoji: '📊', description: '状态管理' },
      { name: 'auth', emoji: '🔐', description: '认证服务' },
      { name: 'date', emoji: '📅', description: '日期处理' },
      { name: 'utils', emoji: '🛠️', description: '工具库' },
    ];

    for (const service of services) {
      try {
        const result = container.resolve(service.name);

        if (result && typeof result === 'object') {
          console.log(`${service.emoji} ${service.description}: ${result.constructor.name}`);
        } else {
          console.log(`${service.emoji} ${service.description}: ${typeof result}`);
        }
      } catch (error) {
        console.log(`❌ ${service.description}: 失败 - ${error.message}`);
      }
    }

    console.log('✅ 核心服务测试完成');

    // 5. 测试事件系统
    console.log('5️⃣ 测试 EventEmitter3 事件系统...');

    try {
      let eventReceived = false;
      eventSystem.on('demo:test', (data) => {
        eventReceived = true;
      });

      eventSystem.emit('demo:test', { message: 'Hello from EventEmitter3!' });

      // 等待事件处理
      await new Promise(resolve => setTimeout(resolve, 100));

      if (eventReceived) {
        console.log('✅ EventEmitter3 事件系统工作正常');
      } else {
        console.log('❌ EventEmitter3 事件系统测试失败');
      }
    } catch (error) {
      console.log('❌ EventEmitter3 事件系统测试失败');
    }

    // 6. 测试消息适配器
    console.log('6️⃣ 测试消息适配器...');

    try {
      const messaging = container.resolve('messaging');
      console.log(`📨 消息适配器: ${messaging.constructor.name}`);

      // 测试消息发布
      try {
        await messaging.publish('demo:message', {
          content: 'Hello from Bull.js!',
          timestamp: Date.now()
        });
        console.log('✅ 消息适配器工作正常');
      } catch (error) {
        console.log('⚠️ 消息适配器需要Redis支持');
      }
    } catch (error) {
      console.log('❌ 消息适配器解析失败');
    }

    // 7. 测试业务服务 (快速失败)
    console.log('7️⃣ 测试业务服务...');

    const businessServices = [
      { name: 'workflowEngine', emoji: '⚙️', description: '工作流引擎' },
      { name: 'userService', emoji: '👤', description: '用户服务' },
    ];

    for (const service of businessServices) {
      try {
        const resolvedService = container.resolve(service.name);

        if (resolvedService && typeof resolvedService === 'object') {
          console.log(`${service.emoji} ${service.description}: ${resolvedService.constructor.name}`);
        } else {
          console.log(`${service.emoji} ${service.description}: ${typeof resolvedService}`);
        }
      } catch (error) {
        console.log(`❌ ${service.description}: 失败 - ${error.message}`);
      }
    }

    console.log('✅ 业务服务测试完成');

    // 显示架构信息
    console.log('🏗️ 核心开源项目:');
    console.log('  Awilix, Fastify, Bull.js, EventEmitter3, Sentry');

    console.log('✅ WokeFlow 开源项目集成演示完成');
}

// 设置全局超时机制 (15秒)
const GLOBAL_TIMEOUT = 15000;

async function runDemo() {
  console.log('🚀 WokeFlow 开源项目集成演示');

  // 创建全局超时Promise
  const globalTimeout = new Promise((_, reject) => {
    setTimeout(() => {
      console.error('❌ 演示脚本超时退出 (15秒)');
      process.exit(1);
    }, GLOBAL_TIMEOUT);
  });

  try {
    // 运行演示逻辑，带全局超时
    await Promise.race([runDemoLogic(), globalTimeout]);
  } catch (error) {
    console.error('❌ 演示失败:', error.message);
    process.exit(1);
  }
}

// 运行演示
runDemo().catch(error => {
  console.error('💥 演示崩溃:', error);
  process.exit(1);
});
