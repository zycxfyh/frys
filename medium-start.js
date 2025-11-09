#!/usr/bin/env node

/**
 * 中等复杂度的Frys启动脚本
 * 逐步添加核心组件，找出问题所在
 */

import express from 'express';
import { config } from './src/shared/utils/config.js';
import { logger } from './src/shared/utils/logger.js';

console.log('🚀 Frys 中等复杂度启动脚本');

// 测试基础模块导入
try {
  console.log('📦 测试基础模块导入...');

  // 测试容器导入
  const { getContainer } = await import('./src/core/container.js');
  console.log('✅ 容器模块导入成功');

  // 测试事件系统导入
  const { eventSystem } = await import('./src/core/event/EventBus.js');
  console.log('✅ 事件系统导入成功');

  // 测试错误处理器导入
  const { errorHandler } = await import('./src/core/ErrorHandlerConfig.js');
  console.log('✅ 错误处理器导入成功');

  // 测试插件系统导入
  const { pluginManager } = await import('./src/core/PluginSystem.js');
  console.log('✅ 插件系统导入成功');

  console.log('🎉 所有基础模块导入成功！');
} catch (error) {
  console.error('❌ 模块导入失败:', error.message);
  process.exit(1);
}

// 创建Express服务器
const app = express();
app.use(express.json());

// 初始化服务
let authService = null;
let conversationManager = null;

// Mock仓库类
class MockUserRepository {
  constructor() {
    this.users = new Map();
  }

  async findByEmail(email) {
    return this.users.get(email) || null;
  }

  async findByUsername(username) {
    for (const user of this.users.values()) {
      if (user.username === username) return user;
    }
    return null;
  }

  async save(user) {
    this.users.set(user.email, user);
    return user;
  }
}

// 预初始化服务
async function initializeServices() {
  console.log('🔧 初始化服务...');

  // 直接创建认证服务实例
  const { AuthenticationService } = await import(
    './src/domain/services/auth/AuthenticationService.js'
  );
  const userRepository = new MockUserRepository();

  authService = new AuthenticationService({
    userRepository,
    tokenRepository: null,
    sessionRepository: null,
  });

  // 简单的对话管理器
  conversationManager = {
    createConversation: async (data) => ({
      conversationId: 'mock-conversation-' + Date.now(),
      model: data.model || 'gpt-4',
      hasMemory: false,
      createdAt: new Date().toISOString(),
    }),
    sendMessage: async (conversationId, message) => ({
      message: {
        content: 'Mock AI response to: ' + message,
        role: 'assistant',
        responseTime: 100,
      },
      conversation: { id: conversationId },
    }),
  };

  console.log('✅ 服务初始化完成');
  return true;
}

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'frys-medium',
    timestamp: new Date().toISOString(),
    version: '1.0.0-medium',
    modules: {
      logger: true,
      config: true,
      container: true,
      eventSystem: true,
      errorHandler: true,
      pluginManager: true,
      authService: !!authService,
      conversationManager: !!conversationManager,
    },
  });
});

// 测试业务服务导入
app.get('/test-modules', async (req, res) => {
  const results = {};

  try {
    // 测试工作流引擎
    await import('./src/application/services/WorkflowEngine.js');
    results.workflowEngine = true;
  } catch (e) {
    results.workflowEngine = false;
    results.workflowError = e.message;
  }

  try {
    // 测试用户服务
    await import('./src/shared/services/UserService.js');
    results.userService = true;
  } catch (e) {
    results.userService = false;
    results.userError = e.message;
  }

  try {
    // 测试对话管理器
    await import('./src/application/services/ConversationManager.js');
    results.conversationManager = true;
  } catch (e) {
    results.conversationManager = false;
    results.conversationError = e.message;
  }

  res.json({
    timestamp: new Date().toISOString(),
    moduleTests: results,
  });
});

// 认证路由
app.post('/api/auth/register', async (req, res) => {
  try {
    console.log('注册请求:', req.body);
    console.log('authService exists:', !!authService);
    console.log(
      'authService.register exists:',
      !!(authService && authService.register),
    );
    console.log(
      'authService.userRepository exists:',
      !!(authService && authService.userRepository),
    );

    if (!authService || !authService.register) {
      return res
        .status(500)
        .json({ error: 'Authentication service not initialized' });
    }

    if (!authService.userRepository) {
      return res.status(500).json({ error: 'User repository not available' });
    }

    console.log('开始注册...');
    const result = await authService.register(req.body);
    console.log('注册成功:', result);
    res.status(201).json(result);
  } catch (error) {
    console.error('注册失败:', error);
    console.error('错误堆栈:', error.stack);
    res.status(400).json({ error: error.message, stack: error.stack });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const result = await authService.login(req.body);
    res.json(result);
  } catch (error) {
    console.error('登录失败:', error);
    res.status(401).json({ error: error.message });
  }
});

// AI路由
app.post('/api/ai/conversations', async (req, res) => {
  try {
    const result = await conversationManager.createConversation(req.body);
    res.status(201).json(result);
  } catch (error) {
    console.error('创建对话失败:', error);
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/ai/conversations/:conversationId/messages', async (req, res) => {
  try {
    const result = await conversationManager.sendMessage(
      req.params.conversationId,
      req.body.message,
    );
    res.json(result);
  } catch (error) {
    console.error('发送消息失败:', error);
    res.status(400).json({ error: error.message });
  }
});

// 启动服务器
const PORT = 3002;

// 先初始化服务，然后启动服务器
initializeServices()
  .then((success) => {
    app.listen(PORT, () => {
      console.log(`✅ Frys 中等复杂度服务器运行在 http://localhost:${PORT}`);
      console.log(`📊 健康检查: http://localhost:${PORT}/health`);
      console.log(`🔧 模块测试: http://localhost:${PORT}/test-modules`);
      console.log(
        `🔐 用户注册: POST http://localhost:${PORT}/api/auth/register`,
      );
      console.log(`🔑 用户登录: POST http://localhost:${PORT}/api/auth/login`);
      console.log(
        `🤖 创建对话: POST http://localhost:${PORT}/api/ai/conversations`,
      );
      console.log(
        `💬 发送消息: POST http://localhost:${PORT}/api/ai/conversations/{id}/messages`,
      );
      console.log(`\n🔄 服务状态: ${success ? '真实服务' : '模拟服务'}`);
    });
  })
  .catch((error) => {
    console.error('❌ 服务器启动失败:', error);
    process.exit(1);
  });
