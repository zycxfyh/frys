/**
 * AI API 供应商管理系统 - 集成示例
 * 展示如何在实际项目中集成和使用AI供应商管理功能
 */

import { AIProviderManager } from '../src/services/AIProviderManager.js';
import { logger } from '../src/utils/logger.js';

/**
 * 示例1: 基础使用 - 注册和管理单个供应商
 */
async function basicUsageExample() {
  console.log('🚀 AI供应商管理 - 基础使用示例');

  // 1. 创建AI供应商管理器
  const providerManager = new AIProviderManager({
    cacheTTL: 3600000, // 1小时缓存
    maxRetries: 3,
    timeout: 30000
  });

  try {
    // 2. 注册OpenAI供应商
    await providerManager.registerProvider({
      id: 'openai',
      name: 'OpenAI',
      type: 'openai',
      apiKey: process.env.OPENAI_API_KEY || 'your-openai-api-key',
      baseURL: 'https://api.openai.com/v1',
      config: {
        timeout: 30000,
        maxRetries: 3
      }
    });

    console.log('✅ OpenAI供应商注册成功');

    // 3. 发现可用模型
    const models = await providerManager.discoverProviderModels('openai');
    console.log('📊 发现的模型:', models.map(m => m.name));

    // 4. 调用AI API
    const response = await providerManager.call({
      providerId: 'openai',
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: '你是一个有帮助的AI助手。' },
        { role: 'user', content: '请介绍一下JavaScript的基本特点。' }
      ],
      temperature: 0.7,
      maxTokens: 500
    });

    console.log('🤖 AI回复:', response.choices[0].message.content);

    // 5. 查看使用统计
    const stats = await providerManager.getProviderStats('openai');
    console.log('📈 使用统计:', {
      请求数: stats.totalRequests,
      平均响应时间: `${stats.avgResponseTime}ms`,
      健康评分: stats.healthScore
    });

  } catch (error) {
    console.error('❌ 基础使用示例失败:', error.message);
    logger.error('基础使用示例失败', error);
  }
}

/**
 * 示例2: 多供应商配置 - 智能路由和降级
 */
async function multiProviderExample() {
  console.log('\n🔄 AI供应商管理 - 多供应商示例');

  const providerManager = new AIProviderManager();

  try {
    // 1. 注册多个供应商
    const providers = [
      {
        id: 'openai',
        name: 'OpenAI',
        type: 'openai',
        apiKey: process.env.OPENAI_API_KEY || 'your-openai-key',
        baseURL: 'https://api.openai.com/v1'
      },
      {
        id: 'deepseek',
        name: 'DeepSeek',
        type: 'deepseek',
        apiKey: process.env.DEEPSEEK_API_KEY || 'your-deepseek-key',
        baseURL: 'https://api.deepseek.com/v1'
      },
      {
        id: 'alibaba',
        name: '通义千问',
        type: 'alibaba',
        apiKey: process.env.ALIBABA_API_KEY || 'your-alibaba-key',
        baseURL: 'https://dashscope.aliyuncs.com/api/v1'
      }
    ];

    // 并发注册所有供应商
    await Promise.all(
      providers.map(provider => providerManager.registerProvider(provider))
    );

    console.log('✅ 所有供应商注册完成');

    // 2. 智能路由 - 成本优化策略
    const costEffectiveResponse = await providerManager.route({
      model: 'gpt-3.5-turbo', // 通用模型
      messages: [{ role: 'user', content: '解释什么是机器学习' }],
      strategy: 'cost-effective', // 选择成本最低的供应商
      fallback: true, // 启用降级
      temperature: 0.7
    });

    console.log('💰 成本优化路由结果:', {
      供应商: '自动选择',
      模型: 'gpt-3.5-turbo',
      回复: costEffectiveResponse.choices[0].message.content.substring(0, 100) + '...'
    });

    // 3. 智能路由 - 速度优先策略
    const fastestResponse = await providerManager.route({
      model: 'gpt-4',
      messages: [{ role: 'user', content: '写一个简单的Hello World程序' }],
      strategy: 'fastest', // 选择响应最快的供应商
      fallback: true,
      temperature: 0.3
    });

    console.log('⚡ 速度优先路由结果:', {
      供应商: '自动选择',
      模型: 'gpt-4',
      回复: fastestResponse.choices[0].message.content.substring(0, 100) + '...'
    });

    // 4. 查看所有供应商统计
    const allStats = await providerManager.getAllStats();
    console.log('📊 供应商统计:');
    Object.entries(allStats).forEach(([id, stats]) => {
      console.log(`  ${id}: 健康${stats.healthScore}/100, 请求${stats.totalRequests}次`);
    });

  } catch (error) {
    console.error('❌ 多供应商示例失败:', error.message);
    logger.error('多供应商示例失败', error);
  }
}

/**
 * 示例3: 实时监控和错误处理
 */
async function monitoringExample() {
  console.log('\n📊 AI供应商管理 - 监控示例');

  const providerManager = new AIProviderManager();

  // 注册事件监听器
  providerManager.manager.eventSystem.on('ai:call:completed', (data) => {
    console.log(`✅ AI调用完成: ${data.providerId} - ${data.duration}ms - 消耗${data.tokens.total_tokens}tokens`);
  });

  providerManager.manager.eventSystem.on('ai:call:error', (data) => {
    console.log(`❌ AI调用失败: ${data.providerId} - ${data.error}`);
  });

  providerManager.manager.eventSystem.on('ai:provider:degraded', (data) => {
    console.log(`⚠️ 供应商降级: ${data.providerId}`);
  });

  try {
    // 注册供应商
    await providerManager.registerProvider({
      id: 'openai',
      name: 'OpenAI',
      type: 'openai',
      apiKey: process.env.OPENAI_API_KEY || 'your-openai-key'
    });

    // 模拟连续调用
    const requests = Array.from({ length: 5 }, (_, i) => ({
      providerId: 'openai',
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: `这是测试请求 ${i + 1}` }],
      temperature: 0.7
    }));

    console.log('🚀 开始批量测试调用...');

    for (const request of requests) {
      try {
        await providerManager.call(request);
        // 添加延迟避免速率限制
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.log(`⚠️ 请求失败: ${error.message}`);
      }
    }

    // 查看最终统计
    const finalStats = await providerManager.getProviderStats('openai');
    console.log('🏁 最终统计:', {
      总请求数: finalStats.totalRequests,
      平均响应时间: `${finalStats.avgResponseTime}ms`,
      健康评分: finalStats.healthScore,
      错误率: finalStats.errorRate
    });

  } catch (error) {
    console.error('❌ 监控示例失败:', error.message);
  }
}

/**
 * 示例4: 配置管理和持久化
 */
async function configurationExample() {
  console.log('\n💾 AI供应商管理 - 配置管理示例');

  const providerManager = new AIProviderManager();

  try {
    // 1. 从环境变量或配置文件加载供应商配置
    const providerConfigs = loadProviderConfigsFromEnv();

    // 2. 批量注册供应商
    for (const config of providerConfigs) {
      try {
        await providerManager.registerProvider(config);
        console.log(`✅ 供应商 ${config.name} 注册成功`);
      } catch (error) {
        console.log(`⚠️ 供应商 ${config.name} 注册失败: ${error.message}`);
      }
    }

    // 3. 保存配置到本地存储
    await saveProviderConfigs(providerManager);

    // 4. 导出配置用于备份
    const exportData = await exportProviderConfigs(providerManager);
    console.log('📤 配置导出完成，包含', exportData.providers.length, '个供应商');

    // 5. 验证配置完整性
    const validation = await validateProviderConfigs(providerManager);
    console.log('🔍 配置验证结果:', validation);

  } catch (error) {
    console.error('❌ 配置管理示例失败:', error.message);
  }
}

function loadProviderConfigsFromEnv() {
  const configs = [];

  // OpenAI配置
  if (process.env.OPENAI_API_KEY) {
    configs.push({
      id: 'openai',
      name: 'OpenAI',
      type: 'openai',
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
      organization: process.env.OPENAI_ORGANIZATION
    });
  }

  // DeepSeek配置
  if (process.env.DEEPSEEK_API_KEY) {
    configs.push({
      id: 'deepseek',
      name: 'DeepSeek',
      type: 'deepseek',
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1'
    });
  }

  // 通义千问配置
  if (process.env.ALIBABA_API_KEY) {
    configs.push({
      id: 'alibaba',
      name: '通义千问',
      type: 'alibaba',
      apiKey: process.env.ALIBABA_API_KEY,
      baseURL: process.env.ALIBABA_BASE_URL || 'https://dashscope.aliyuncs.com/api/v1'
    });
  }

  return configs;
}

async function saveProviderConfigs(providerManager) {
  // 在实际应用中，这里会保存到数据库或配置文件
  const configs = Array.from(providerManager.providers.entries()).map(([id, provider]) => ({
    id,
    name: provider.name,
    type: provider.type,
    apiKey: provider.apiKey, // 注意：实际应用中应该加密存储
    baseURL: provider.baseURL,
    status: provider.status,
    registeredAt: provider.registeredAt
  }));

  console.log('💾 已保存', configs.length, '个供应商配置');
  return configs;
}

async function exportProviderConfigs(providerManager) {
  const exportData = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    providers: []
  };

  for (const [id, provider] of providerManager.providers) {
    exportData.providers.push({
      id,
      name: provider.name,
      type: provider.type,
      baseURL: provider.baseURL,
      status: provider.status,
      models: await providerManager.discoverProviderModels(id),
      stats: await providerManager.getProviderStats(id)
    });
  }

  return exportData;
}

async function validateProviderConfigs(providerManager) {
  const results = {
    total: 0,
    valid: 0,
    invalid: 0,
    issues: []
  };

  for (const [id, provider] of providerManager.providers) {
    results.total++;

    try {
      // 测试连接
      await providerManager.manager.testProviderConnection(provider.instance);
      results.valid++;
    } catch (error) {
      results.invalid++;
      results.issues.push({
        provider: id,
        issue: 'connection_failed',
        error: error.message
      });
    }
  }

  return results;
}

/**
 * 示例5: 高级功能 - 自定义策略和钩子
 */
async function advancedExample() {
  console.log('\n⚡ AI供应商管理 - 高级功能示例');

  const providerManager = new AIProviderManager();

  // 1. 注册供应商
  await providerManager.registerProvider({
    id: 'openai',
    name: 'OpenAI',
    type: 'openai',
    apiKey: process.env.OPENAI_API_KEY || 'your-openai-key'
  });

  // 2. 自定义路由策略
  const customStrategy = {
    name: 'chinese-optimized',
    selectProvider: (availableProviders, request) => {
      // 优先选择中文优化的供应商
      const chineseProviders = availableProviders.filter(p =>
        ['deepseek', 'alibaba', 'baidu'].includes(p.id)
      );

      if (chineseProviders.length > 0) {
        // 选择健康度最高的中文学派供应商
        return chineseProviders.sort((a, b) => b.healthScore - a.healthScore)[0];
      }

      // 降级到其他供应商
      return availableProviders[0];
    }
  };

  // 3. 使用自定义策略
  const response = await providerManager.route({
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: '请用中文解释什么是人工智能' }],
    strategy: customStrategy,
    fallback: true
  });

  console.log('🎯 自定义策略路由结果:', {
    回复语言: '中文',
    内容: response.choices[0].message.content.substring(0, 100) + '...'
  });

  // 4. 添加自定义钩子
  providerManager.manager.eventSystem.on('ai:call:started', (data) => {
    console.log(`🚀 AI调用开始: ${data.providerId} - ${data.model}`);
    // 可以在这里添加请求日志、监控等
  });

  providerManager.manager.eventSystem.on('ai:call:completed', (data) => {
    console.log(`✅ AI调用完成: ${data.duration}ms, ${data.tokens.total_tokens}tokens`);
    // 可以在这里添加费用计算、使用统计等
  });

  // 5. 使用上下文管理
  const contextManager = {
    conversations: new Map(),

    getConversation(userId) {
      if (!this.conversations.has(userId)) {
        this.conversations.set(userId, []);
      }
      return this.conversations.get(userId);
    },

    addMessage(userId, message) {
      const conversation = this.getConversation(userId);
      conversation.push(message);

      // 保持最近20条消息
      if (conversation.length > 20) {
        conversation.splice(0, conversation.length - 20);
      }
    }
  };

  // 6. 带上下文的对话
  const userId = 'user_123';
  const userMessage = '什么是机器学习？';

  // 添加用户消息到上下文
  contextManager.addMessage(userId, { role: 'user', content: userMessage });

  // 获取完整对话历史
  const conversationHistory = contextManager.getConversation(userId);

  const contextualResponse = await providerManager.call({
    providerId: 'openai',
    model: 'gpt-3.5-turbo',
    messages: conversationHistory,
    temperature: 0.7
  });

  // 添加AI回复到上下文
  contextManager.addMessage(userId, {
    role: 'assistant',
    content: contextualResponse.choices[0].message.content
  });

  console.log('💬 上下文对话回复:', contextualResponse.choices[0].message.content.substring(0, 100) + '...');
}

/**
 * 主函数 - 运行所有示例
 */
async function main() {
  console.log('🤖 AI API 供应商管理系统 - 集成示例演示');
  console.log('=' .repeat(50));

  try {
    // 基础使用示例
    await basicUsageExample();

    // 多供应商示例
    await multiProviderExample();

    // 监控示例
    await monitoringExample();

    // 配置管理示例
    await configurationExample();

    // 高级功能示例
    await advancedExample();

    console.log('\n🎉 所有示例演示完成！');
    console.log('📖 更多用法请参考: docs/modules/ai-provider-management.md');

  } catch (error) {
    console.error('❌ 示例演示失败:', error);
    logger.error('示例演示失败', error);
    process.exit(1);
  }
}

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export {
  basicUsageExample,
  multiProviderExample,
  monitoringExample,
  configurationExample,
  advancedExample
};
