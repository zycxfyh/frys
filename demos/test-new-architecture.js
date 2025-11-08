#!/usr/bin/env node

/**
 * 测试新的VCPToolBox风格架构
 * 验证文本协议+子进程模式的插件系统
 */

import { SimplePluginManager } from './src/core/plugin/SimplePluginManager.js';
import { TextInstructionParser } from './src/core/plugin/TextInstructionParser.js';
import { SimpleMessageProcessor } from './src/core/SimpleMessageProcessor.js';

async function testPluginManager() {
  console.log('🧪 测试插件管理器...\n');

  const manager = new SimplePluginManager();

  // 发现插件
  await manager.discoverPlugins();
  const plugins = manager.getPlugins();

  console.log(`📦 发现 ${plugins.length} 个插件：`);
  plugins.forEach(plugin => {
    console.log(`  - ${plugin.name}: ${plugin.displayName}`);
  });

  // 测试工具执行
  if (plugins.length > 0) {
    console.log('\n🔧 测试工具执行...\n');

    // 测试天气工具
    const weatherInstruction = `<<<[TOOL_REQUEST]>>>tool_name:「始」WeatherTool「末」,city:「始」北京「末」<<<[END_TOOL_REQUEST]>>>`;

    console.log('🌤️ 测试天气工具...');
    console.log('指令:', weatherInstruction);

    try {
      const weatherResult = await manager.executeTool(weatherInstruction);
      console.log('结果:', weatherResult);
    } catch (error) {
      console.log('❌ 天气工具执行失败:', error.message);
    }

    // 测试计算器工具
    const calcInstruction = `<<<[TOOL_REQUEST]>>>tool_name:「始」CalculatorTool「末」,expression:「始」2+3*4「末」<<<[END_TOOL_REQUEST]>>>`;

    console.log('\n🧮 测试计算器工具...');
    console.log('指令:', calcInstruction);

    try {
      const calcResult = await manager.executeTool(calcInstruction);
      console.log('结果:', calcResult);
    } catch (error) {
      console.log('❌ 计算器工具执行失败:', error.message);
    }

    // 测试文本处理工具
    const textInstruction = `<<<[TOOL_REQUEST]>>>tool_name:「始」TextProcessorTool「末」,text:「始」Hello World「末」,operation:「始」uppercase「末」<<<[END_TOOL_REQUEST]>>>`;

    console.log('\n📝 测试文本处理工具...');
    console.log('指令:', textInstruction);

    try {
      const textResult = await manager.executeTool(textInstruction);
      console.log('结果:', textResult);
    } catch (error) {
      console.log('❌ 文本处理工具执行失败:', error.message);
    }
  }

  await manager.shutdown();
  return plugins.length > 0;
}

async function testInstructionParser() {
  console.log('\n🧪 测试指令解析器...\n');

  const parser = new TextInstructionParser();

  // 测试解析
  const testMessage = `今天天气怎么样？
<<<[TOOL_REQUEST]>>>tool_name:「始」WeatherTool「末」,city:「始」北京「末」<<<[END_TOOL_REQUEST]>>>

让我算一下2+3*4等于多少？
<<<[TOOL_REQUEST]>>>tool_name:「始」CalculatorTool「末」,expression:「始」2+3*4「末」<<<[END_TOOL_REQUEST]>>>`;

  console.log('📝 测试消息:');
  console.log(testMessage);
  console.log('\n🔍 解析结果:');

  const instructions = parser.parseInstructions(testMessage);
  console.log(`发现 ${instructions.length} 个指令:`);
  console.log('指令详情:', instructions);

  instructions.forEach((instruction, index) => {
    console.log(`${index + 1}. 工具: ${instruction.toolName}`);
    console.log(`   参数:`, instruction.parameters);
  });

  // 测试格式化
  console.log('\n📤 测试指令格式化:');
  const formatted = parser.formatInstruction('WeatherTool', { city: '上海' });
  console.log('格式化结果:', formatted);

  return instructions.length === 2;
}

async function testMessageProcessor() {
  console.log('\n🧪 测试消息处理器...\n');

  const processor = new SimpleMessageProcessor();
  await processor.initialize();

  // 测试包含工具调用的消息
  const testMessage = `你好！我想知道北京的天气情况。

<<<[TOOL_REQUEST]>>>tool_name:「始」WeatherTool「末」,city:「始」北京「末」<<<[END_TOOL_REQUEST]>>>

另外，计算一下15除以3的结果。
<<<[TOOL_REQUEST]>>>tool_name:「始」CalculatorTool「末」,expression:「始」15/3「末」<<<[END_TOOL_REQUEST]>>>`;

  console.log('📨 原始消息:');
  console.log(testMessage);
  console.log('\n⚙️ 处理结果:');

  const processedMessage = await processor.processMessage(testMessage);

  console.log('处理后的消息:');
  console.log(processedMessage);

  // 获取统计
  const stats = processor.getStats();
  console.log('\n📊 处理统计:', stats);

  await processor.shutdown();
  return stats.toolsExecuted > 0;
}

async function testVariableReplacement() {
  console.log('\n🧪 测试变量替换...\n');

  const { PlaceholderSystem } = await import('./src/core/utils/PlaceholderSystem.js');
  const placeholderSystem = new PlaceholderSystem();

  const testText = `当前时间：{{timestamp}}
用户信息：{{user.name}} (ID: {{user.id}})
系统状态：{{status}}
计算结果：{{2+3*4}}`;

  const context = {
    user: { name: 'Alice', id: 123 },
    status: '正常运行',
    timestamp: new Date().toLocaleString()
  };

  console.log('📝 原始文本:');
  console.log(testText);
  console.log('\n🔄 上下文:');
  console.log(JSON.stringify(context, null, 2));
  console.log('\n✨ 替换结果:');

  const result = placeholderSystem.processString(testText, context);
  console.log(result);

  return result !== testText;
}

async function runAllTests() {
  console.log('🚀 开始测试新的VCPToolBox风格架构\n');
  console.log('=' .repeat(60));

  const results = {
    pluginManager: false,
    instructionParser: false,
    messageProcessor: false,
    variableReplacement: false
  };

  try {
    console.log('\n1️⃣ 测试插件管理器');
    console.log('-'.repeat(30));
    results.pluginManager = await testPluginManager();

    console.log('\n2️⃣ 测试指令解析器');
    console.log('-'.repeat(30));
    results.instructionParser = await testInstructionParser();

    console.log('\n3️⃣ 测试消息处理器');
    console.log('-'.repeat(30));
    results.messageProcessor = await testMessageProcessor();

    console.log('\n4️⃣ 测试变量替换');
    console.log('-'.repeat(30));
    results.variableReplacement = await testVariableReplacement();

  } catch (error) {
    console.error('\n❌ 测试过程中发生错误:', error);
  }

  // 输出测试结果
  console.log('\n' + '='.repeat(60));
  console.log('📋 测试结果汇总');
  console.log('='.repeat(60));

  const passed = Object.values(results).filter(Boolean).length;
  const total = Object.keys(results).length;

  Object.entries(results).forEach(([test, passed]) => {
    const status = passed ? '✅ 通过' : '❌ 失败';
    const testName = {
      pluginManager: '插件管理器',
      instructionParser: '指令解析器',
      messageProcessor: '消息处理器',
      variableReplacement: '变量替换'
    }[test] || test;

    console.log(`${status} ${testName}`);
  });

  console.log('\n📊 总体结果:');
  console.log(`通过: ${passed}/${total} (${Math.round(passed/total*100)}%)`);

  if (passed === total) {
    console.log('\n🎉 所有测试通过！新的架构工作正常。');
  } else {
    console.log('\n⚠️ 部分测试失败，需要进一步调试。');
  }

  console.log('\n' + '='.repeat(60));
}

// 运行测试
runAllTests().catch(console.error);
