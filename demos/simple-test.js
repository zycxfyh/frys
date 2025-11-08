#!/usr/bin/env node

import { TextInstructionParser } from './src/core/plugin/TextInstructionParser.js';

const parser = new TextInstructionParser();

console.log('🧪 测试TextInstructionParser...\n');

// 测试正确的指令格式
const correctInstruction = `<<<[TOOL_REQUEST]>>>tool_name:「始」WeatherTool「末」,city:「始」北京「末」<<<[END_TOOL_REQUEST]>>>`;

console.log('✅ 测试正确格式:');
console.log('指令:', correctInstruction);

const result = parser.parseInstructions(correctInstruction);
console.log('解析结果:', result.length, '个指令');

if (result.length > 0) {
  console.log('工具名称:', result[0].toolName);
  console.log('参数:', result[0].parameters);
} else {
  console.log('❌ 解析失败');
}

// 测试格式化
console.log('\n📤 测试格式化:');
const formatted = parser.formatInstruction('CalculatorTool', { expression: '2+3*4' });
console.log('格式化结果:', formatted);

// 测试解析格式化后的指令
console.log('\n🔄 测试解析格式化后的指令:');
const parsedAgain = parser.parseInstructions(formatted);
console.log('再次解析结果:', parsedAgain.length, '个指令');

if (parsedAgain.length > 0) {
  console.log('工具名称:', parsedAgain[0].toolName);
  console.log('参数:', parsedAgain[0].parameters);
}
