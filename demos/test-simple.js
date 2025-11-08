#!/usr/bin/env node

import { TextInstructionParser } from './src/core/plugin/TextInstructionParser.js';
import { SimplePluginManager } from './src/core/plugin/SimplePluginManager.js';

async function testParser() {
  console.log('🧪 测试指令解析器...\n');

  const parser = new TextInstructionParser();

  // 使用formatInstruction生成正确的指令
  const weatherInstruction = parser.formatInstruction('WeatherTool', { city: '北京' });
  const calcInstruction = parser.formatInstruction('CalculatorTool', { expression: '2+3*4' });

  console.log('🌤️ 测试天气指令:');
  console.log(weatherInstruction);

  const weatherResult = parser.parseInstructions(weatherInstruction);
  console.log('解析结果:', weatherResult);

  if (weatherResult.length > 0) {
    console.log('✅ 工具名称:', weatherResult[0].toolName);
    console.log('✅ 参数:', weatherResult[0].parameters);
  }

  console.log('\n🧮 测试计算器指令:');
  console.log(calcInstruction);

  const calcResult = parser.parseInstructions(calcInstruction);
  console.log('解析结果:', calcResult);

  if (calcResult.length > 0) {
    console.log('✅ 工具名称:', calcResult[0].toolName);
    console.log('✅ 参数:', calcResult[0].parameters);
  }

  return (weatherResult.length === 1 && calcResult.length === 1 &&
          weatherResult[0].toolName === 'WeatherTool' &&
          calcResult[0].toolName === 'CalculatorTool');
}

async function testPluginManager() {
  console.log('\n🧪 测试插件管理器...\n');

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
    const parser = new TextInstructionParser();
    const weatherInstruction = parser.formatInstruction('WeatherTool', { city: '北京' });

    console.log('\n🔧 测试天气工具执行...');
    console.log('指令:', weatherInstruction);

    try {
      const result = await manager.executeTool(weatherInstruction);
      console.log('✅ 执行结果:', result);
      return result.status === 'success';
    } catch (error) {
      console.log('❌ 执行失败:', error.message);
      return false;
    }
  }

  await manager.shutdown();
  return plugins.length > 0;
}

async function main() {
  console.log('🚀 简单架构测试\n');

  try {
    const parserOk = await testParser();
    console.log(`\n📋 指令解析器: ${parserOk ? '✅ 通过' : '❌ 失败'}`);

    const pluginOk = await testPluginManager();
    console.log(`📋 插件管理器: ${pluginOk ? '✅ 通过' : '❌ 失败'}`);

    const totalOk = parserOk && pluginOk;
    console.log(`\n🎯 总体结果: ${totalOk ? '✅ 通过' : '❌ 失败'}`);

  } catch (error) {
    console.error('\n❌ 测试失败:', error);
  }
}

main().catch(console.error);
