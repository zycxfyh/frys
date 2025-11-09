/**
 * frys VCP系统端到端演示
 * 展示所有VCPToolBox启发系统的协同工作
 */

import { AgentSystem } from '../src/core/AgentSystem.js';
import { AsyncWorkflowExecutor } from '../src/core/AsyncWorkflowExecutor.js';
import { MemoryNetwork } from '../src/core/MemoryNetwork.js';
import { PluginProtocolSystem } from '../src/core/PluginProtocolSystem.js';
import { RealtimeCommunication } from '../src/core/RealtimeCommunication.js';

class VCPSystemDemo {
  constructor() {
    this.agentSystem = null;
    this.workflowExecutor = null;
    this.memoryNetwork = null;
    this.pluginSystem = null;
    this.realtimeComm = null;
    this.isInitialized = false;
  }

  async initialize() {
    console.log('🚀 初始化frys VCP系统演示...\n');

    try {
      // 1. 初始化所有VCP系统
      console.log('📦 初始化核心系统...');

      this.agentSystem = new AgentSystem({
        maxConcurrentAgents: 5,
        defaultTimeout: 30000,
      });
      await this.agentSystem.initialize();
      console.log('✅ AgentSystem 初始化完成');

      this.workflowExecutor = new AsyncWorkflowExecutor({
        maxParallelTasks: 10,
        enableTracing: true,
      });
      // AsyncWorkflowExecutor 自动构建工作流
      console.log('✅ AsyncWorkflowExecutor 初始化完成');

      this.memoryNetwork = new MemoryNetwork({
        vectorDimension: 768,
        maxConnections: 1000,
      });
      await this.memoryNetwork.initialize();
      console.log('✅ MemoryNetwork 初始化完成');

      this.pluginSystem = new PluginProtocolSystem();
      await this.pluginSystem.initialize();
      console.log('✅ PluginProtocolSystem 初始化完成');

      this.realtimeComm = new RealtimeCommunication({
        maxConnections: 100,
        heartbeatInterval: 30000,
      });
      await this.realtimeComm.initialize();
      console.log('✅ RealtimeCommunication 初始化完成');

      this.isInitialized = true;
      console.log('\n🎉 所有VCP系统初始化完成！\n');
    } catch (error) {
      console.error('❌ 系统初始化失败:', error);
      throw error;
    }
  }

  async demonstrateAgentWorkflowIntegration() {
    console.log('🤖 演示1: Agent与工作流集成\n');

    try {
      // 创建一个数据分析Agent
      const dataAnalyzer = await this.agentSystem.createAgent({
        name: '数据分析Agent',
        type: 'analysis',
        capabilities: ['analyze', 'summarize', 'visualize'],
        config: {
          memoryEnabled: true,
          realtimeEnabled: true,
        },
      });

      console.log(
        `✅ 创建Agent: ${dataAnalyzer.name} (ID: ${dataAnalyzer.id})`,
      );

      // 定义一个简单的工作流
      const analysisWorkflow = {
        id: 'data-analysis-workflow',
        name: '数据分析工作流',
        nodes: {
          'data-input': {
            id: 'data-input',
            type: 'data-source',
            config: { format: 'json' },
          },
          'data-analysis': {
            id: 'data-analysis',
            type: 'agent-task',
            agentId: dataAnalyzer.id,
            config: {
              task: 'analyze',
              params: { analysisType: 'trend' },
            },
          },
          'result-output': {
            id: 'result-output',
            type: 'output-formatter',
            config: { format: 'markdown' },
          },
        },
        connections: [
          { from: 'data-input', to: 'data-analysis' },
          { from: 'data-analysis', to: 'result-output' },
        ],
      };

      console.log('🔄 执行工作流...');
      const result = await this.workflowExecutor.executeWorkflow(
        analysisWorkflow,
        {
          data: {
            metrics: [
              { date: '2024-01', value: 1200 },
              { date: '2024-02', value: 1350 },
              { date: '2024-03', value: 1180 },
              { date: '2024-04', value: 1420 },
            ],
          },
        },
      );

      console.log('📊 工作流执行结果:', result.output);
      console.log('✅ Agent与工作流集成演示完成\n');
    } catch (error) {
      console.error('❌ Agent工作流集成演示失败:', error);
    }
  }

  async demonstrateMemoryNetwork() {
    console.log('🧠 演示2: 记忆网络系统\n');

    try {
      // 创建记忆节点
      const userPreference = await this.memoryNetwork.createNode({
        type: 'user_preference',
        content: '用户偏好使用详细的分析报告',
        metadata: {
          userId: 'demo-user-123',
          context: 'report_format',
          confidence: 0.95,
        },
      });

      const analysisPattern = await this.memoryNetwork.createNode({
        type: 'pattern',
        content: '销售数据分析通常需要关注趋势和异常值',
        metadata: {
          patternType: 'analysis_workflow',
          frequency: 'high',
          domain: 'sales',
        },
      });

      console.log(`✅ 创建记忆节点: 用户偏好 (ID: ${userPreference.id})`);
      console.log(`✅ 创建记忆节点: 分析模式 (ID: ${analysisPattern.id})`);

      // 创建连接
      await this.memoryNetwork.createConnection(
        userPreference.id,
        analysisPattern.id,
        {
          type: 'related',
          strength: 0.8,
          context: 'workflow_optimization',
        },
      );

      console.log('🔗 创建记忆节点连接');

      // 搜索相关记忆
      const relatedMemories = await this.memoryNetwork.search({
        query: '销售数据分析',
        limit: 3,
      });

      console.log(`🔍 找到 ${relatedMemories.length} 个相关记忆`);
      console.log('✅ 记忆网络演示完成\n');
    } catch (error) {
      console.error('❌ 记忆网络演示失败:', error);
    }
  }

  async demonstratePluginSystem() {
    console.log('🔌 演示3: 插件协议系统\n');

    try {
      // 注册一个演示插件
      const demoPlugin = {
        name: 'DataTransformerPlugin',
        version: '1.0.0',
        protocols: ['http', 'websocket'],
        capabilities: ['data-transformation', 'format-conversion'],
        execute: async (input) => {
          console.log(`🔄 插件处理数据: ${input.type}`);

          return {
            success: true,
            output: {
              ...input,
              transformed: true,
              timestamp: new Date().toISOString(),
              plugin: 'DataTransformerPlugin',
            },
            metadata: {
              processingTime: Date.now(),
              pluginVersion: '1.0.0',
            },
          };
        },
      };

      await this.pluginSystem.registerPlugin(demoPlugin);
      console.log('✅ 注册数据转换插件');

      // 通过HTTP协议调用插件
      const httpResult = await this.pluginSystem.sendMessage('http', {
        type: 'transform',
        data: { value: 42, format: 'number' },
        target: 'DataTransformerPlugin',
      });

      console.log('🌐 HTTP协议调用结果:', httpResult);
      console.log('✅ 插件系统演示完成\n');
    } catch (error) {
      console.error('❌ 插件系统演示失败:', error);
    }
  }

  async demonstrateRealtimeCommunication() {
    console.log('📡 演示4: 实时通信系统\n');

    try {
      // 订阅工作流状态更新
      const unsubscribe = this.realtimeComm.subscribe(
        'workflow-updates',
        (update) => {
          console.log('📨 收到工作流更新:', update);
        },
      );

      console.log('📡 订阅工作流状态更新');

      // 发送一个实时消息
      await this.realtimeComm.sendMessage('system-announcements', {
        type: 'demo',
        message: 'VCP系统演示进行中',
        timestamp: new Date().toISOString(),
      });

      console.log('📤 发送实时消息');

      // 模拟一些延迟
      await new Promise((resolve) => setTimeout(resolve, 100));

      unsubscribe();
      console.log('✅ 实时通信演示完成\n');
    } catch (error) {
      console.error('❌ 实时通信演示失败:', error);
    }
  }

  async demonstrateCompleteVCPSCollaboration() {
    console.log('🎯 演示5: 完整VCP系统协作\n');

    try {
      // 创建协作Agent
      const researchAgent = await this.agentSystem.createAgent({
        name: '研究Agent',
        type: 'research',
        capabilities: ['research', 'analyze'],
        config: { memoryEnabled: true, realtimeEnabled: true },
      });

      const creativeAgent = await this.agentSystem.createAgent({
        name: '创意Agent',
        type: 'creative',
        capabilities: ['generate', 'innovate'],
        config: { memoryEnabled: true, realtimeEnabled: true },
      });

      console.log('🤖 创建协作Agent:', researchAgent.name, creativeAgent.name);

      // 定义协作工作流
      const collaborationWorkflow = {
        id: 'agi-collaboration-workflow',
        name: 'AGI协作工作流',
        nodes: {
          'topic-input': {
            id: 'topic-input',
            type: 'user-input',
            config: { required: true },
          },
          'research-phase': {
            id: 'research-phase',
            type: 'agent-task',
            agentId: researchAgent.id,
            config: {
              task: 'comprehensive-research',
              memory: 'use-existing',
              collaboration: true,
            },
          },
          'creative-phase': {
            id: 'creative-phase',
            type: 'agent-task',
            agentId: creativeAgent.id,
            config: {
              task: 'innovative-solution',
              inspiration: 'research-results',
              collaboration: true,
            },
          },
          'memory-update': {
            id: 'memory-update',
            type: 'memory-update',
            config: {
              updateType: 'collaboration-result',
              shareWith: 'all-agents',
            },
          },
          'final-output': {
            id: 'final-output',
            type: 'output-formatter',
            config: {
              format: 'structured-report',
              includeMetadata: true,
            },
          },
        },
        connections: [
          { from: 'topic-input', to: 'research-phase' },
          { from: 'research-phase', to: 'creative-phase' },
          { from: 'creative-phase', to: 'memory-update' },
          { from: 'memory-update', to: 'final-output' },
        ],
      };

      console.log('🔄 执行AGI协作工作流...');
      const result = await this.workflowExecutor.executeWorkflow(
        collaborationWorkflow,
        {
          topic: '设计下一代智能工作流系统',
          userContext: {
            expertise: 'workflow-design',
            preferences: 'innovative-solutions',
          },
        },
      );

      console.log('🎉 协作工作流执行完成!');
      console.log('📋 最终结果:', result.output);
      console.log('✅ 完整VCP协作演示完成\n');
    } catch (error) {
      console.error('❌ VCP协作演示失败:', error);
    }
  }

  async runFullDemo() {
    console.log('🎬 开始frys VCP系统完整演示\n');
    console.log('='.repeat(50));

    await this.initialize();

    await this.demonstrateAgentWorkflowIntegration();
    await this.demonstrateMemoryNetwork();
    await this.demonstratePluginSystem();
    await this.demonstrateRealtimeCommunication();
    await this.demonstrateCompleteVCPSCollaboration();

    console.log('='.repeat(50));
    console.log('🎊 frys VCP系统演示完成！');
    console.log('\n✨ 所有VCP系统协同工作完美！');

    await this.cleanup();
  }

  async cleanup() {
    console.log('\n🧹 清理VCP系统...');

    try {
      if (this.agentSystem) await this.agentSystem.shutdown();
      if (this.workflowExecutor) await this.workflowExecutor.shutdown();
      if (this.memoryNetwork) await this.memoryNetwork.shutdown();
      if (this.pluginSystem) await this.pluginSystem.shutdown();
      if (this.realtimeComm) await this.realtimeComm.shutdown();

      console.log('✅ 所有系统清理完成');
    } catch (error) {
      console.error('❌ 清理过程中出现错误:', error);
    }
  }
}

// 运行演示
async function main() {
  const demo = new VCPSystemDemo();

  try {
    await demo.runFullDemo();
  } catch (error) {
    console.error('💥 演示执行失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { VCPSystemDemo };
export default VCPSystemDemo;
