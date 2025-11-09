/**
 * frys 多AI服务API使用示例
 *
 * 这个文件展示了如何使用frys的多AI服务API，
 * 包括所有支持的AI供应商的使用方法
 */

import fetch from 'node-fetch';

// 基础配置
const BASE_URL = 'http://localhost:3000';

/**
 * 通用API请求工具函数
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const config = {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  if (options.body) {
    config.body = JSON.stringify(options.body);
  }

  try {
    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        `API请求失败: ${response.status} - ${data.error || response.statusText}`,
      );
    }

    return data;
  } catch (error) {
    console.error(`请求 ${endpoint} 失败:`, error.message);
    throw error;
  }
}

/**
 * 示例1: 获取所有AI供应商信息
 */
async function example1_getProviders() {
  console.log('\n=== 示例1: 获取AI供应商信息 ===');

  try {
    const result = await apiRequest('/api/ai/providers');

    console.log('✅ 成功获取供应商信息:');
    result.data.forEach((provider) => {
      console.log(`  ${provider.name} (${provider.id}):`);
      console.log(`    - 状态: ${provider.status}`);
      console.log(`    - 模型数量: ${provider.models}`);
      console.log(`    - API端点: ${provider.endpoints.join(', ')}`);
    });

    return result.data;
  } catch (error) {
    console.error('❌ 获取供应商信息失败:', error.message);
  }
}

/**
 * 示例2: OpenAI聊天API使用
 */
async function example2_openAIChat() {
  console.log('\n=== 示例2: OpenAI聊天API ===');

  const messages = [
    { role: 'system', content: '你是一个有帮助的AI助手，请用中文回答问题。' },
    { role: 'user', content: '请解释什么是机器学习，以及它有哪些应用场景？' },
  ];

  try {
    const result = await apiRequest('/api/ai/openai/chat', {
      method: 'POST',
      body: {
        model: 'gpt-3.5-turbo',
        messages: messages,
        temperature: 0.7,
        maxTokens: 1000,
      },
    });

    console.log('✅ OpenAI响应:');
    console.log(`  模型: ${result.data.model}`);
    console.log(`  响应时间: ${result.data.responseTime}ms`);
    console.log(`  Token消耗: ${result.data.usage.total_tokens}`);
    console.log(`  费用: $${result.data.cost.toFixed(6)}`);
    console.log(
      `  内容: ${result.data.choices[0].message.content.substring(0, 200)}...`,
    );

    return result.data;
  } catch (error) {
    console.error('❌ OpenAI聊天请求失败:', error.message);
  }
}

/**
 * 示例3: Claude聊天API使用
 */
async function example3_claudeChat() {
  console.log('\n=== 示例3: Claude聊天API ===');

  const messages = [{ role: 'user', content: '请写一首关于人工智能的短诗。' }];

  try {
    const result = await apiRequest('/api/ai/claude/chat', {
      method: 'POST',
      body: {
        model: 'claude-3-haiku-20240307',
        messages: messages,
        temperature: 0.8,
        maxTokens: 500,
      },
    });

    console.log('✅ Claude响应:');
    console.log(`  模型: ${result.data.model}`);
    console.log(`  响应时间: ${result.data.responseTime}ms`);
    console.log(`  Token消耗: ${result.data.usage.total_tokens}`);
    console.log(`  费用: $${result.data.cost.toFixed(6)}`);
    console.log(`  内容: ${result.data.choices[0].message.content}`);

    return result.data;
  } catch (error) {
    console.error('❌ Claude聊天请求失败:', error.message);
  }
}

/**
 * 示例4: Gemini聊天API使用
 */
async function example4_geminiChat() {
  console.log('\n=== 示例4: Gemini聊天API ===');

  const messages = [
    { role: 'user', content: '用简单的语言解释什么是区块链技术。' },
  ];

  try {
    const result = await apiRequest('/api/ai/gemini/chat', {
      method: 'POST',
      body: {
        model: 'gemini-1.5-flash',
        messages: messages,
        temperature: 0.7,
        maxTokens: 800,
      },
    });

    console.log('✅ Gemini响应:');
    console.log(`  模型: ${result.data.model}`);
    console.log(`  响应时间: ${result.data.responseTime}ms`);
    console.log(`  Token消耗: ${result.data.usage.total_tokens}`);
    console.log(`  费用: $${result.data.cost.toFixed(6)}`);
    console.log(
      `  内容: ${result.data.choices[0].message.content.substring(0, 200)}...`,
    );

    return result.data;
  } catch (error) {
    console.error('❌ Gemini聊天请求失败:', error.message);
  }
}

/**
 * 示例5: DeepSeek聊天API使用（成本优化）
 */
async function example5_deepSeekChat() {
  console.log('\n=== 示例5: DeepSeek聊天API（高性价比） ===');

  const messages = [
    { role: 'user', content: '给我推荐5个学习编程的在线资源。' },
  ];

  try {
    const result = await apiRequest('/api/ai/deepseek/chat', {
      method: 'POST',
      body: {
        model: 'deepseek-chat',
        messages: messages,
        temperature: 0.6,
        maxTokens: 600,
      },
    });

    console.log('✅ DeepSeek响应:');
    console.log(`  模型: ${result.data.model}`);
    console.log(`  响应时间: ${result.data.responseTime}ms`);
    console.log(`  Token消耗: ${result.data.usage.total_tokens}`);
    console.log(`  费用: $${result.data.cost.toFixed(6)} (极低成本)`);
    console.log(
      `  内容: ${result.data.choices[0].message.content.substring(0, 200)}...`,
    );

    return result.data;
  } catch (error) {
    console.error('❌ DeepSeek聊天请求失败:', error.message);
  }
}

/**
 * 示例6: 通义千问聊天API使用（中文优化）
 */
async function example6_alibabaChat() {
  console.log('\n=== 示例6: 通义千问聊天API（中文优化） ===');

  const messages = [
    {
      role: 'user',
      content:
        '请详细介绍一下中国的传统节日春节，包括起源、习俗和现代庆祝方式。',
    },
  ];

  try {
    const result = await apiRequest('/api/ai/alibaba/chat', {
      method: 'POST',
      body: {
        model: 'qwen-plus',
        messages: messages,
        temperature: 0.7,
        maxTokens: 1200,
      },
    });

    console.log('✅ 通义千问响应:');
    console.log(`  模型: ${result.data.model}`);
    console.log(`  响应时间: ${result.data.responseTime}ms`);
    console.log(`  Token消耗: ${result.data.usage.total_tokens}`);
    console.log(`  费用: $${result.data.cost.toFixed(6)}`);
    console.log(
      `  内容: ${result.data.choices[0].message.content.substring(0, 200)}...`,
    );

    return result.data;
  } catch (error) {
    console.error('❌ 通义千问聊天请求失败:', error.message);
  }
}

/**
 * 示例7: 获取各服务统计信息
 */
async function example7_getStats() {
  console.log('\n=== 示例7: 获取AI服务统计信息 ===');

  try {
    const result = await apiRequest('/api/ai/stats');

    console.log('✅ AI服务统计信息:');
    console.log(`  总请求数: ${result.data.summary.totalRequests}`);
    console.log(`  总错误数: ${result.data.summary.totalErrors}`);
    console.log(`  总Token消耗: ${result.data.summary.totalTokens}`);
    console.log(`  总费用: $${result.data.summary.totalCost.toFixed(4)}`);
    console.log(
      `  平均响应时间: ${result.data.summary.avgResponseTime.toFixed(0)}ms`,
    );

    console.log('\n各服务详情:');
    Object.entries(result.data.providers).forEach(([provider, stats]) => {
      console.log(`  ${stats.name}:`);
      console.log(`    - 请求数: ${stats.requests}`);
      console.log(`    - 错误率: ${(stats.errorRate * 100).toFixed(2)}%`);
      console.log(`    - Token消耗: ${stats.tokens}`);
      console.log(`    - 费用: $${stats.cost.toFixed(4)}`);
      console.log(`    - 平均响应时间: ${stats.avgResponseTime.toFixed(0)}ms`);
    });

    return result.data;
  } catch (error) {
    console.error('❌ 获取统计信息失败:', error.message);
  }
}

/**
 * 示例8: OpenAI图像生成
 */
async function example8_openAIImage() {
  console.log('\n=== 示例8: OpenAI图像生成 ===');

  try {
    const result = await apiRequest('/api/ai/openai/images', {
      method: 'POST',
      body: {
        prompt:
          'A beautiful sunset over mountains with a lake, digital art style',
        n: 1,
        size: '1024x1024',
      },
    });

    console.log('✅ OpenAI图像生成:');
    console.log(`  费用: $${result.data.cost.toFixed(4)}`);
    console.log(`  响应时间: ${result.data.responseTime}ms`);
    console.log(`  图像URL: ${result.data.images[0].url}`);

    return result.data;
  } catch (error) {
    console.error('❌ OpenAI图像生成失败:', error.message);
  }
}

/**
 * 示例9: 性能对比测试
 */
async function example9_performanceComparison() {
  console.log('\n=== 示例9: AI服务性能对比测试 ===');

  const testPrompt = '请用100字以内解释量子计算的基本原理。';
  const messages = [{ role: 'user', content: testPrompt }];

  const providers = [
    {
      id: 'openai',
      name: 'OpenAI',
      model: 'gpt-3.5-turbo',
      endpoint: '/api/ai/openai/chat',
    },
    {
      id: 'claude',
      name: 'Claude',
      model: 'claude-3-haiku-20240307',
      endpoint: '/api/ai/claude/chat',
    },
    {
      id: 'gemini',
      name: 'Gemini',
      model: 'gemini-1.5-flash',
      endpoint: '/api/ai/gemini/chat',
    },
    {
      id: 'deepseek',
      name: 'DeepSeek',
      model: 'deepseek-chat',
      endpoint: '/api/ai/deepseek/chat',
    },
    {
      id: 'alibaba',
      name: '通义千问',
      model: 'qwen-turbo',
      endpoint: '/api/ai/alibaba/chat',
    },
  ];

  const results = [];

  for (const provider of providers) {
    try {
      console.log(`\n测试 ${provider.name}...`);

      const startTime = Date.now();
      const result = await apiRequest(provider.endpoint, {
        method: 'POST',
        body: {
          model: provider.model,
          messages: messages,
          temperature: 0.7,
          maxTokens: 300,
        },
      });

      const totalTime = Date.now() - startTime;

      results.push({
        provider: provider.name,
        responseTime: result.data.responseTime,
        totalTime: totalTime,
        tokens: result.data.usage.total_tokens,
        cost: result.data.cost,
        success: true,
      });

      console.log(
        `  ✅ ${provider.name}: ${result.data.responseTime}ms, $${result.data.cost.toFixed(6)}`,
      );
    } catch (error) {
      results.push({
        provider: provider.name,
        success: false,
        error: error.message,
      });

      console.log(`  ❌ ${provider.name}: 失败 - ${error.message}`);
    }
  }

  // 输出对比结果
  console.log('\n📊 性能对比结果:');
  console.log('Provider    | Response Time | Cost      | Tokens | Status');
  console.log('-------------|---------------|-----------|--------|--------');

  results.forEach((result) => {
    if (result.success) {
      console.log(
        `${result.provider.padEnd(12)} | ${result.responseTime.toString().padStart(13)}ms | $${result.cost.toFixed(6).padStart(8)} | ${result.tokens.toString().padStart(6)} | ✅`,
      );
    } else {
      console.log(
        `${result.provider.padEnd(12)} | ${'N/A'.padStart(13)} | ${'N/A'.padStart(9)} | ${'N/A'.padStart(6)} | ❌`,
      );
    }
  });

  return results;
}

/**
 * 主函数：运行所有示例
 */
async function main() {
  console.log('🚀 frys 多AI服务API使用示例');
  console.log('================================');

  try {
    // 基础信息查询
    await example1_getProviders();

    // 各AI服务测试
    await example2_openAIChat();
    await example3_claudeChat();
    await example4_geminiChat();
    await example5_deepSeekChat();
    await example6_alibabaChat();

    // 高级功能
    await example8_openAIImage();

    // 统计信息
    await example7_getStats();

    // 性能对比
    await example9_performanceComparison();

    console.log('\n🎉 所有示例运行完成！');
    console.log('\n💡 提示:');
    console.log('  - 确保frys服务器正在运行 (npm start)');
    console.log('  - 配置相应的API密钥到环境变量');
    console.log('  - 查看完整API文档: http://localhost:3000/api/docs');
  } catch (error) {
    console.error('\n❌ 示例运行失败:', error.message);
    process.exit(1);
  }
}

// 如果直接运行此文件，执行所有示例
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export {
  apiRequest,
  example1_getProviders,
  example2_openAIChat,
  example3_claudeChat,
  example4_geminiChat,
  example5_deepSeekChat,
  example6_alibabaChat,
  example7_getStats,
  example8_openAIImage,
  example9_performanceComparison,
};
