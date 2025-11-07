/**
 * 🎨 frys 可视化工作流设计器使用示例
 *
 * 演示如何使用VisualWorkflowDesigner创建、编辑和执行工作流
 */

import { VisualWorkflowDesigner } from '../src/core/VisualWorkflowDesigner.js';
import { logger } from '../src/utils/logger.js';

/**
 * 示例1: 基本工作流创建和执行
 */
async function example1_basicWorkflow() {
  console.log('\n=== 示例1: 基本工作流创建和执行 ===');

  const designer = new VisualWorkflowDesigner();

  try {
    // 添加触发器节点
    const triggerNode = designer.addNode('trigger', {
      position: { x: 100, y: 100 },
      data: {
        triggerType: 'manual',
        schedule: 'immediate',
        payload: { message: 'Hello World' }
      }
    });
    console.log(`✅ 添加触发器节点: ${triggerNode.id}`);

    // 添加AI处理节点
    const aiNode = designer.addNode('ai', {
      position: { x: 300, y: 100 },
      data: {
        model: 'gpt-4',
        prompt: '请分析以下消息并提供回复建议'
      }
    });
    console.log(`✅ 添加AI节点: ${aiNode.id}`);

    // 添加条件判断节点
    const conditionNode = designer.addNode('condition', {
      position: { x: 500, y: 100 },
      data: {
        condition: (data) => data.response && data.response.length > 10
      }
    });
    console.log(`✅ 添加条件节点: ${conditionNode.id}`);

    // 连接节点
    const conn1 = designer.addConnection(triggerNode.id, 'output', aiNode.id, 'input');
    const conn2 = designer.addConnection(aiNode.id, 'output', conditionNode.id, 'input');
    console.log(`✅ 添加连接: ${conn1.id}, ${conn2.id}`);

    // 执行工作流
    console.log('🚀 执行工作流...');
    const result = await designer.executeWorkflow({
      message: '用户咨询产品功能'
    });

    console.log('📊 执行结果:', {
      success: result.success,
      executionTime: result.executionTime,
      nodeResults: Object.keys(result.results)
    });

    // 显示节点状态
    console.log('📋 节点状态:');
    for (const [nodeId, node] of designer.nodes) {
      console.log(`  ${nodeId} (${node.type}): ${node.state}`);
    }

  } catch (error) {
    console.error('❌ 工作流执行失败:', error.message);
  } finally {
    designer.destroy();
  }
}

/**
 * 示例2: 模板加载和自定义
 */
async function example2_templateWorkflow() {
  console.log('\n=== 示例2: 模板加载和自定义 ===');

  const designer = new VisualWorkflowDesigner();

  try {
    // 加载客户支持模板
    console.log('📋 加载客户支持模板...');
    const result = designer.loadTemplate('customer-support');
    console.log(`✅ 模板加载完成: ${result.nodes.length} 个节点, ${result.connections.length} 个连接`);

    // 自定义节点配置
    const aiNode = Array.from(designer.nodes.values()).find(node => node.type === 'ai');
    if (aiNode) {
      designer.updateNode(aiNode.id, {
        data: {
          ...aiNode.data,
          model: 'gpt-4-turbo',
          prompt: '作为专业的客服代表，请用友好的语气回复客户咨询'
        }
      });
      console.log('✅ 自定义AI节点配置');
    }

    // 执行自定义工作流
    console.log('🚀 执行自定义工作流...');
    const executionResult = await designer.executeWorkflow({
      customerQuery: '你们的软件支持哪些操作系统？',
      customerInfo: { name: '张三', level: 'VIP' }
    });

    console.log('📊 执行结果:', executionResult.success ? '成功' : '失败');

  } catch (error) {
    console.error('❌ 模板工作流执行失败:', error.message);
  } finally {
    designer.destroy();
  }
}

/**
 * 示例3: 数据处理管道
 */
async function example3_dataProcessingPipeline() {
  console.log('\n=== 示例3: 数据处理管道 ===');

  const designer = new VisualWorkflowDesigner();

  try {
    // 创建数据处理管道
    const triggerNode = designer.addNode('trigger', {
      position: { x: 100, y: 100 },
      data: {
        triggerType: 'data',
        payload: [
          { id: 1, name: '产品A', sales: 100, category: '电子产品' },
          { id: 2, name: '产品B', sales: 200, category: '服装' },
          { id: 3, name: '产品C', sales: 150, category: '电子产品' },
          { id: 4, name: '产品D', sales: 300, category: '家居' }
        ]
      }
    });

    // 过滤电子产品
    const filterNode = designer.addNode('data-processing', {
      position: { x: 300, y: 100 },
      data: {
        operation: 'filter',
        condition: (item) => item.category === '电子产品'
      }
    });

    // 聚合销售额
    const aggregateNode = designer.addNode('data-processing', {
      position: { x: 500, y: 100 },
      data: {
        operation: 'aggregate',
        aggregateOperation: 'sum',
        field: 'sales'
      }
    });

    // AI分析结果
    const aiNode = designer.addNode('ai', {
      position: { x: 700, y: 100 },
      data: {
        model: 'gpt-4',
        prompt: '基于以下销售数据，生成分析报告'
      }
    });

    // 连接节点
    designer.addConnection(triggerNode.id, 'output', filterNode.id, 'input');
    designer.addConnection(filterNode.id, 'output', aggregateNode.id, 'input');
    designer.addConnection(aggregateNode.id, 'output', aiNode.id, 'input');

    console.log('✅ 数据处理管道创建完成');

    // 执行管道
    console.log('🚀 执行数据处理管道...');
    const result = await designer.executeWorkflow();

    console.log('📊 处理结果:', {
      success: result.success,
      totalExecutionTime: result.executionTime,
      aiAnalysis: result.results[aiNode.id]?.response?.substring(0, 100) + '...'
    });

  } catch (error) {
    console.error('❌ 数据处理管道执行失败:', error.message);
  } finally {
    designer.destroy();
  }
}

/**
 * 示例4: 循环和条件分支
 */
async function example4_advancedWorkflow() {
  console.log('\n=== 示例4: 高级工作流（循环和条件分支） ===');

  const designer = new VisualWorkflowDesigner();

  try {
    // 创建包含循环和条件的工作流
    const triggerNode = designer.addNode('trigger', {
      position: { x: 100, y: 100 },
      data: {
        triggerType: 'batch',
        payload: [
          { task: '代码审查', priority: 'high', assignee: 'alice' },
          { task: '文档编写', priority: 'medium', assignee: 'bob' },
          { task: '测试执行', priority: 'high', assignee: 'charlie' },
          { task: '部署上线', priority: 'low', assignee: 'diana' }
        ]
      }
    });

    // 循环处理每个任务
    const loopNode = designer.addNode('loop', {
      position: { x: 300, y: 100 },
      data: {
        loopType: 'forEach',
        processor: (task) => ({
          ...task,
          processed: true,
          timestamp: new Date().toISOString()
        })
      }
    });

    // 条件分支：高优先级任务
    const conditionNode = designer.addNode('condition', {
      position: { x: 500, y: 100 },
      data: {
        condition: (task) => task.priority === 'high'
      }
    });

    // 高优先级处理
    const urgentNode = designer.addNode('ai', {
      position: { x: 700, y: 50 },
      data: {
        model: 'gpt-4',
        prompt: '这是一个紧急任务，请立即分配资源处理'
      }
    });

    // 普通任务处理
    const normalNode = designer.addNode('ai', {
      position: { x: 700, y: 150 },
      data: {
        model: 'gpt-3.5-turbo',
        prompt: '这是一个普通任务，请按计划处理'
      }
    });

    // 连接节点
    designer.addConnection(triggerNode.id, 'output', loopNode.id, 'input');
    designer.addConnection(loopNode.id, 'output', conditionNode.id, 'input');
    designer.addConnection(conditionNode.id, 'true', urgentNode.id, 'input');
    designer.addConnection(conditionNode.id, 'false', normalNode.id, 'input');

    console.log('✅ 高级工作流创建完成');

    // 执行工作流
    console.log('🚀 执行高级工作流...');
    const result = await designer.executeWorkflow();

    console.log('📊 执行统计:', {
      success: result.success,
      executionTime: result.executionTime,
      processedTasks: result.results[loopNode.id]?.length || 0,
      urgentTasks: result.results[urgentNode.id] ? 1 : 0,
      normalTasks: result.results[normalNode.id] ? 1 : 0
    });

  } catch (error) {
    console.error('❌ 高级工作流执行失败:', error.message);
  } finally {
    designer.destroy();
  }
}

/**
 * 示例5: 智能推荐和模板管理
 */
async function example5_smartFeatures() {
  console.log('\n=== 示例5: 智能推荐和模板管理 ===');

  const designer = new VisualWorkflowDesigner();

  try {
    // 添加初始节点
    const triggerNode = designer.addNode('trigger', {
      position: { x: 100, y: 100 },
      data: { triggerType: 'webhook' }
    });

    // 获取智能推荐
    const recommendations = designer.recommendNodes({
      goal: 'customer support automation'
    });

    console.log('🤖 智能推荐的下一个节点:');
    recommendations.forEach((rec, index) => {
      console.log(`  ${index + 1}. ${rec.type}: ${rec.reason}`);
    });

    // 添加推荐的节点
    const aiNode = designer.addNode('ai', {
      position: { x: 300, y: 100 },
      data: {
        model: 'gpt-4',
        prompt: '作为客服代表，回复客户咨询'
      }
    });

    // 连接节点
    designer.addConnection(triggerNode.id, 'output', aiNode.id, 'input');

    // 保存为模板
    const templateId = designer.saveAsTemplate(
      '智能客服工作流',
      '基于AI的自动化客服回复系统'
    );
    console.log(`✅ 保存为模板: ${templateId}`);

    // 显示设计器统计
    const stats = designer.getStats();
    console.log('📊 设计器统计:', {
      节点数量: stats.nodeCount,
      连接数量: stats.connectionCount,
      模板数量: stats.templateCount,
      节点类型: stats.nodeTypes
    });

  } catch (error) {
    console.error('❌ 智能功能演示失败:', error.message);
  } finally {
    designer.destroy();
  }
}

/**
 * 主函数：运行所有示例
 */
async function main() {
  console.log('🎨 frys 可视化工作流设计器演示');
  console.log('==================================');

  try {
    // 按顺序运行示例
    await example1_basicWorkflow();
    await example2_templateWorkflow();
    await example3_dataProcessingPipeline();
    await example4_advancedWorkflow();
    await example5_smartFeatures();

    console.log('\n🎉 所有示例运行完成！');
    console.log('\n💡 接下来你可以：');
    console.log('  1. 运行 npm run build 构建项目');
    console.log('  2. 查看 docs/modules/future-blueprint-comprehensive.md 了解完整蓝图');
    console.log('  3. 探索其他核心系统：Agent、记忆网络、插件协议等');
    console.log('  4. 尝试集成到你的应用中');

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
  example1_basicWorkflow,
  example2_templateWorkflow,
  example3_dataProcessingPipeline,
  example4_advancedWorkflow,
  example5_smartFeatures
};
