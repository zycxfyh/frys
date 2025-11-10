#!/usr/bin/env node

/**
 * 简单功能测试
 */

import { WorkflowEngine, WorkflowDefinition } from './src/index.js';

console.log('🧪 简单功能测试...');

try {
  // 创建工作流引擎
  const engine = new WorkflowEngine({
    logger: console,
    onWorkflowEvent: (event, data) => {
      console.log(`📢 工作流事件: ${event}`, data.id);
    },
    onTaskEvent: (event, data) => {
      console.log(`🔧 任务事件: ${event}`, data.taskId);
    },
  });

  // 创建示例工作流
  const definition = WorkflowDefinition.createExample('测试工作流');
  console.log('📋 工作流定义:', definition.name, '任务数量:', definition.tasks.length);

  // 验证定义
  const validation = WorkflowDefinition.validate(definition);
  console.log('✅ 定义验证:', validation.isValid ? '通过' : '失败');

  // 创建工作流
  const workflowId = engine.createWorkflow(definition);
  console.log('✅ 工作流创建成功:', workflowId);

  // 启动工作流
  await engine.startWorkflow(workflowId);
  console.log('✅ 工作流启动成功');

  // 等待执行
  await new Promise(resolve => setTimeout(resolve, 2000));

  // 检查状态
  const workflow = engine.getWorkflow(workflowId);
  console.log('📊 工作流状态:', workflow.status);

  console.log('🎉 测试完成！');

} catch (error) {
  console.error('❌ 测试失败:', error);
  process.exit(1);
}
