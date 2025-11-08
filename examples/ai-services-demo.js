/**
 * frys AI服务集成示例
 * 演示如何使用LangChain、Cognee记忆系统和对话管理
 */

import { LangChainService } from '../src/application/services/ai/LangChainService.js';
import { CogneeMemoryService } from '../src/application/services/ai/CogneeMemoryService.js';
import { ConversationManager } from '../src/application/services/ConversationManager.js';
import { logger } from '../src/utils/logger.js';

/**
 * LangChain集成示例
 */
async function langChainExample() {
  console.log('\n🚀 LangChain集成示例');

  try {
    const langChainService = new LangChainService();

    // 创建对话链
    console.log('📝 创建对话链...');
    const chainResult = await langChainService.createConversationChain({
      model: 'openai', // 需要配置OPENAI_API_KEY环境变量
      memoryType: 'buffer',
      promptTemplate: `
你是一个智能助手。请基于以下对话历史和用户输入，给出有帮助的回复。

对话历史:
{chat_history}

用户输入: {input}

助手回复:`
    });

    console.log('✅ 对话链创建成功:', chainResult);

    // 执行对话
    console.log('💬 执行对话...');
    const conversationResult = await langChainService.runConversation(
      chainResult.chainId,
      '你好，请介绍一下自己'
    );

    console.log('✅ 对话结果:', conversationResult);

    // 获取对话历史
    console.log('📚 获取对话历史...');
    const historyResult = await langChainService.getConversationHistory(chainResult.chainId);
    console.log('✅ 对话历史:', historyResult);

  } catch (error) {
    console.error('❌ LangChain示例失败:', error.message);
  }
}

/**
 * Cognee记忆系统示例
 */
async function cogneeExample() {
  console.log('\n🧠 Cognee记忆系统示例');

  try {
    const cogneeService = new CogneeMemoryService();

    // 测试连接
    console.log('🔗 测试Cognee连接...');
    const connectionResult = await cogneeService.testConnection();
    console.log('✅ 连接测试结果:', connectionResult);

    // 存储记忆
    console.log('💾 存储记忆...');
    const memoryResult = await cogneeService.storeMemory({
      content: '用户喜欢使用Python进行数据分析',
      type: 'fact',
      metadata: {
        userId: 'user123',
        confidence: 0.9,
        source: 'conversation'
      },
      userId: 'user123',
      sessionId: 'session456',
      tags: ['preference', 'python', 'data-analysis']
    });

    console.log('✅ 记忆存储结果:', memoryResult);

    // 检索记忆
    console.log('🔍 检索记忆...');
    const searchResult = await cogneeService.retrieveMemory(
      '用户编程偏好',
      {
        userId: 'user123',
        limit: 5
      }
    );

    console.log('✅ 记忆检索结果:', searchResult);

  } catch (error) {
    console.error('❌ Cognee示例失败:', error.message);
  }
}

/**
 * 对话管理系统示例
 */
async function conversationExample() {
  console.log('\n💬 对话管理系统示例');

  try {
    const conversationManager = new ConversationManager();

    // 创建对话
    console.log('🎯 创建对话...');
    const conversationResult = await conversationManager.createConversation({
      userId: 'user123',
      sessionId: 'session456',
      model: 'openai',
      memory: true,
      persistMemory: true,
      systemPrompt: '你是一个友好的AI助手，擅长解答技术问题。'
    });

    console.log('✅ 对话创建结果:', conversationResult);

    // 发送消息
    console.log('📨 发送消息...');
    const messageResult = await conversationManager.sendMessage(
      conversationResult.data.conversationId,
      '请解释什么是微服务架构'
    );

    console.log('✅ 消息发送结果:', messageResult);

    // 获取对话历史
    console.log('📜 获取对话历史...');
    const historyResult = await conversationManager.getConversationHistory(
      conversationResult.data.conversationId,
      { limit: 10 }
    );

    console.log('✅ 对话历史:', historyResult);

    // 获取对话统计
    console.log('📊 获取对话统计...');
    const statsResult = await conversationManager.getConversationStats(
      conversationResult.data.conversationId
    );

    console.log('✅ 对话统计:', statsResult);

    // 结束对话
    console.log('🏁 结束对话...');
    const endResult = await conversationManager.endConversation(
      conversationResult.data.conversationId
    );

    console.log('✅ 对话结束结果:', endResult);

  } catch (error) {
    console.error('❌ 对话管理示例失败:', error.message);
  }
}

/**
 * 综合AI服务演示
 */
async function comprehensiveExample() {
  console.log('\n🎭 综合AI服务演示');

  try {
    const conversationManager = new ConversationManager();

    // 创建带记忆的对话
    const conversation = await conversationManager.createConversation({
      userId: 'demo_user',
      model: 'openai',
      memory: true,
      persistMemory: true
    });

    console.log('✅ 创建对话:', conversation.data);

    // 进行多轮对话
    const messages = [
      '我叫张三，是一名软件工程师',
      '我主要使用Python和JavaScript',
      '我对AI和机器学习很感兴趣',
      '请根据我们的对话，总结一下我的个人信息'
    ];

    for (const message of messages) {
      console.log(`📤 发送: ${message}`);
      const result = await conversationManager.sendMessage(
        conversation.data.conversationId,
        message
      );
      console.log(`📥 回复: ${result.data.message.content.substring(0, 100)}...`);
    }

    // 获取对话统计
    const stats = await conversationManager.getConversationStats(
      conversation.data.conversationId
    );

    console.log('📊 对话统计:', {
      总消息数: stats.data.totalMessages,
      用户消息: stats.data.userMessages,
      助手消息: stats.data.assistantMessages,
      平均响应时间: `${stats.data.averageResponseTime}ms`
    });

    // 结束对话
    await conversationManager.endConversation(conversation.data.conversationId);
    console.log('✅ 综合演示完成');

  } catch (error) {
    console.error('❌ 综合演示失败:', error.message);
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('🎯 frys AI服务集成演示');
  console.log('================================');

  // 检查环境变量
  console.log('🔍 检查环境变量...');
  const requiredEnvVars = [
    'OPENAI_API_KEY',
    'COGNEE_API_KEY'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  if (missingVars.length > 0) {
    console.log('⚠️  缺少必要的环境变量，请设置以下变量以获得最佳体验:');
    missingVars.forEach(varName => console.log(`   - ${varName}`));
    console.log('继续演示，但某些功能可能不可用...\n');
  }

  try {
    // 演示各个服务
    await langChainExample();
    await cogneeExample();
    await conversationExample();
    await comprehensiveExample();

    console.log('\n🎉 所有演示完成！');
    console.log('💡 提示: 请确保设置了相应的API密钥以获得完整功能');

  } catch (error) {
    console.error('❌ 演示过程中发生错误:', error.message);
    process.exit(1);
  }
}

// 运行演示
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ 演示失败:', error.message);
    process.exit(1);
  });
}

export {
  langChainExample,
  cogneeExample,
  conversationExample,
  comprehensiveExample
};
