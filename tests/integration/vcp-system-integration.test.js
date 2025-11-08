/**
 * VCP系统集成测试
 * 测试所有VCPToolBox启发系统的协同工作
 */

import { describe, it, beforeEach, afterEach, expect } from 'vitest';

// 导入所有VCP系统
import { AgentSystem } from '../../src/core/AgentSystem.js';
import { AsyncWorkflowExecutor } from '../../src/core/AsyncWorkflowExecutor.js';
import { MemoryNetwork } from '../../src/core/MemoryNetwork.js';
import { PluginProtocolSystem } from '../../src/core/PluginProtocolSystem.js';
import { RealtimeCommunication } from '../../src/core/RealtimeCommunication.js';

describe('VCP系统集成测试', () => {
    let agentSystem;
    let workflowExecutor;
    let memoryNetwork;
    let pluginSystem;
    let realtimeComm;

    beforeEach(async () => {
        // 初始化所有系统
        agentSystem = new AgentSystem({
            maxConcurrentAgents: 5,
            defaultTimeout: 30000
        });

        workflowExecutor = new AsyncWorkflowExecutor({
            maxParallelTasks: 10,
            enableTracing: true
        });

        memoryNetwork = new MemoryNetwork({
            vectorDimension: 768,
            maxConnections: 1000
        });

        pluginSystem = new PluginProtocolSystem({
            sandboxEnabled: true,
            maxPlugins: 20
        });

        realtimeComm = new RealtimeCommunication({
            maxConnections: 100,
            heartbeatInterval: 30000
        });

        // 等待所有系统初始化完成
        await Promise.all([
            agentSystem.initialize(),
            workflowExecutor.initialize(),
            memoryNetwork.initialize(),
            pluginSystem.initialize(),
            realtimeComm.initialize()
        ]);
    });

    afterEach(async () => {
        // 清理所有系统
        await Promise.all([
            agentSystem.shutdown(),
            workflowExecutor.shutdown(),
            memoryNetwork.shutdown(),
            pluginSystem.shutdown(),
            realtimeComm.shutdown()
        ]);
    });

    describe('Agent与工作流集成', () => {
        it('应该能够创建Agent并在工作流中执行', async () => {
            // 创建一个AI服务Agent
            const agent = await agentSystem.createAgent({
                name: 'DataProcessor',
                type: 'ai-service',
                capabilities: ['filter', 'transform', 'aggregate'],
                config: {
                    memoryEnabled: true,
                    realtimeEnabled: false
                }
            });

            expect(agent).to.have.property('agentId');
            expect(agent.state).to.equal('inactive');

            // 创建一个简单的工作流
            const workflow = {
                id: 'test-workflow-1',
                name: '数据处理工作流',
                nodes: {
                    'task-1': {
                        id: 'task-1',
                        type: 'task',
                        taskFunction: async (context, inputs) => {
                            // 模拟数据过滤任务
                            const values = inputs?.inputData?.values || inputs?.values || [];
                            return values.filter(v => v > 100);
                        },
                        config: {}
                    }
                },
                connections: []
            };

            // 设置工作流并执行
            workflowExecutor.setWorkflowDefinition(workflow);
            const result = await workflowExecutor.executeWorkflow({
                inputData: { values: [50, 150, 200, 75] }
            });

            expect(result).to.have.property('success', true);
            expect(result.outputs['task-1']).to.deep.equal([150, 200]);
        });

        it('应该支持Agent间的协作', async () => {
            // 创建两个协作的Agent
            const analyzerAgent = await agentSystem.createAgent({
                name: 'DataAnalyzer',
                type: 'analysis',
                capabilities: ['analyze', 'summarize']
            });

            const reporterAgent = await agentSystem.createAgent({
                name: 'ReportGenerator',
                type: 'content',
                capabilities: ['generate', 'format']
            });

            // 创建协作工作流
            const collaborativeWorkflow = {
                id: 'collaborative-workflow',
                nodes: {
                    'data-input': {
                        id: 'data-input',
                        type: 'data-source',
                        config: { source: 'api' }
                    },
                    'analysis': {
                        id: 'analysis',
                        type: 'agent-task',
                        agentId: analyzerAgent.id,
                        config: { task: 'analyze' }
                    },
                    'reporting': {
                        id: 'reporting',
                        type: 'agent-task',
                        agentId: reporterAgent.id,
                        config: { task: 'generate_report' }
                    }
                },
                connections: [
                    { from: 'data-input', to: 'analysis' },
                    { from: 'analysis', to: 'reporting' }
                ]
            };

            const result = await workflowExecutor.executeWorkflow(collaborativeWorkflow, {
                data: {
                    metrics: [1.2, 3.4, 2.1, 4.5],
                    labels: ['Q1', 'Q2', 'Q3', 'Q4']
                }
            });

            expect(result.success).to.be.true;
            expect(result.output).to.have.property('analysis');
            expect(result.output).to.have.property('report');
        });
    });

    describe('记忆网络与工作流集成', () => {
        it('应该能够在工作流执行中利用记忆网络', async () => {
            // 创建记忆节点
            const memoryNode1 = await memoryNetwork.createNode({
                type: 'knowledge',
                content: '用户偏好使用JSON格式输出',
                metadata: { userId: 'user123', context: 'output_format' }
            });

            const memoryNode2 = await memoryNetwork.createNode({
                type: 'pattern',
                content: '数据分析任务通常需要统计摘要',
                metadata: { pattern: 'analysis_workflow', frequency: 'high' }
            });

            // 连接记忆节点
            await memoryNetwork.createConnection(memoryNode1.id, memoryNode2.id, {
                type: 'related',
                strength: 0.8
            });

            // 创建使用记忆的工作流
            const memoryAwareWorkflow = {
                id: 'memory-aware-workflow',
                nodes: {
                    'input-processor': {
                        id: 'input-processor',
                        type: 'memory-lookup',
                        config: {
                            query: '用户偏好',
                            context: 'output_format'
                        }
                    },
                    'pattern-matcher': {
                        id: 'pattern-matcher',
                        type: 'memory-match',
                        config: {
                            pattern: 'analysis_workflow'
                        }
                    },
                    'intelligent-processor': {
                        id: 'intelligent-processor',
                        type: 'ai-task',
                        config: {
                            useMemory: true,
                            adaptToUser: true
                        }
                    }
                },
                connections: [
                    { from: 'input-processor', to: 'pattern-matcher' },
                    { from: 'pattern-matcher', to: 'intelligent-processor' }
                ]
            };

            const result = await workflowExecutor.executeWorkflow(memoryAwareWorkflow, {
                input: '请分析这份销售数据',
                userId: 'user123'
            });

            expect(result.success).to.be.true;
            expect(result.output).to.have.property('format', 'json');
            expect(result.output).to.have.property('summary');
        });

        it('应该能够在执行后更新记忆网络', async () => {
            const workflow = {
                id: 'learning-workflow',
                nodes: [
                    {
                        id: 'task-executor',
                        type: 'generic-task',
                        config: { operation: 'process_data' }
                    },
                    {
                        id: 'memory-updater',
                        type: 'memory-update',
                        config: { updateType: 'execution_result' }
                    }
                ],
                connections: [
                    { from: 'task-executor', to: 'memory-updater' }
                ]
            };

            const result = await workflowExecutor.executeWorkflow(workflow, {
                task: '数据验证',
                success: true,
                executionTime: 1500
            });

            // 验证记忆网络是否被更新
            const relatedMemories = await memoryNetwork.search({
                query: '数据验证任务',
                limit: 5
            });

            expect(relatedMemories.length).to.be.greaterThan(0);
            const latestMemory = relatedMemories[0];
            expect(latestMemory.content).to.include('数据验证');
            expect(latestMemory.metadata).to.have.property('executionTime', 1500);
        });
    });

    describe('插件协议系统集成', () => {
        it('应该能够加载和执行插件', async () => {
            // 注册一个测试插件
            const testPlugin = {
                name: 'TestPlugin',
                version: '1.0.0',
                protocols: ['http', 'websocket'],
                capabilities: ['data-transformation'],
                execute: async (input) => {
                    return {
                        success: true,
                        output: `Processed: ${input}`,
                        metadata: { plugin: 'TestPlugin', timestamp: Date.now() }
                    };
                }
            };

            await pluginSystem.registerPlugin(testPlugin);

            // 创建使用插件的工作流
            const pluginWorkflow = {
                id: 'plugin-workflow',
                nodes: [
                    {
                        id: 'data-input',
                        type: 'data-source',
                        config: { format: 'json' }
                    },
                    {
                        id: 'plugin-processor',
                        type: 'plugin-task',
                        config: {
                            pluginName: 'TestPlugin',
                            protocol: 'http'
                        }
                    }
                ],
                connections: [
                    { from: 'data-input', to: 'plugin-processor' }
                ]
            };

            const result = await workflowExecutor.executeWorkflow(pluginWorkflow, {
                data: 'test input'
            });

            expect(result.success).to.be.true;
            expect(result.output).to.equal('Processed: test input');
            expect(result.metadata).to.have.property('plugin', 'TestPlugin');
        });

        it('应该支持插件间的通信', async () => {
            // 注册两个通信插件
            const senderPlugin = {
                name: 'SenderPlugin',
                protocols: ['websocket'],
                send: async (message, target) => {
                    return await pluginSystem.sendMessage('websocket', {
                        type: 'data',
                        payload: message,
                        target: target
                    });
                }
            };

            const receiverPlugin = {
                name: 'ReceiverPlugin',
                protocols: ['websocket'],
                onMessage: null,
                receive: function(callback) {
                    this.onMessage = callback;
                }
            };

            await Promise.all([
                pluginSystem.registerPlugin(senderPlugin),
                pluginSystem.registerPlugin(receiverPlugin)
            ]);

            // 设置消息监听
            let receivedMessage = null;
            receiverPlugin.receive((message) => {
                receivedMessage = message;
            });

            // 发送消息
            await senderPlugin.send('Hello from sender', 'ReceiverPlugin');

            // 等待消息处理
            await new Promise(resolve => setTimeout(resolve, 100));

            expect(receivedMessage).to.not.be.null;
            expect(receivedMessage.payload).to.equal('Hello from sender');
        });
    });

    describe('实时通信系统集成', () => {
        it('应该支持工作流执行状态的实时更新', async () => {
            let statusUpdates = [];

            // 订阅工作流状态更新
            const unsubscribe = realtimeComm.subscribe('workflow-updates', (update) => {
                statusUpdates.push(update);
            });

            // 执行一个耗时的工作流
            const longRunningWorkflow = {
                id: 'long-running-workflow',
                nodes: [
                    {
                        id: 'slow-task-1',
                        type: 'async-task',
                        config: { delay: 500 }
                    },
                    {
                        id: 'slow-task-2',
                        type: 'async-task',
                        config: { delay: 500 }
                    },
                    {
                        id: 'slow-task-3',
                        type: 'async-task',
                        config: { delay: 500 }
                    }
                ],
                connections: [
                    { from: 'slow-task-1', to: 'slow-task-2' },
                    { from: 'slow-task-2', to: 'slow-task-3' }
                ]
            };

            const execution = workflowExecutor.executeWorkflow(longRunningWorkflow);

            // 等待状态更新
            await new Promise(resolve => setTimeout(resolve, 800));

            expect(statusUpdates.length).to.be.greaterThan(0);
            expect(statusUpdates.some(update =>
                update.type === 'node-started' || update.type === 'node-completed'
            )).to.be.true;

            unsubscribe();
            await execution;
        });

        it('应该支持Agent间的实时通信', async () => {
            // 创建两个Agent
            const agent1 = await agentSystem.createAgent({
                name: 'Communicator1',
                type: 'communication',
                realtimeEnabled: true
            });

            const agent2 = await agentSystem.createAgent({
                name: 'Communicator2',
                type: 'communication',
                realtimeEnabled: true
            });

            let receivedMessages = [];

            // Agent2监听消息
            const unsubscribe = realtimeComm.subscribe(`agent-${agent2.id}`, (message) => {
                receivedMessages.push(message);
            });

            // Agent1发送消息给Agent2
            await realtimeComm.sendMessage(`agent-${agent2.id}`, {
                from: agent1.id,
                type: 'collaboration-request',
                payload: { task: 'joint-analysis', priority: 'high' }
            });

            // 等待消息传递
            await new Promise(resolve => setTimeout(resolve, 100));

            expect(receivedMessages.length).to.equal(1);
            expect(receivedMessages[0].from).to.equal(agent1.id);
            expect(receivedMessages[0].payload.task).to.equal('joint-analysis');

            unsubscribe();
        });
    });

    describe('完整VCP系统协同', () => {
        it('应该支持复杂的AGI协作场景', async () => {
            // 创建完整的AGI协作场景
            const researchAgent = await agentSystem.createAgent({
                name: 'ResearchAgent',
                type: 'research',
                capabilities: ['search', 'analyze', 'summarize'],
                memoryEnabled: true,
                realtimeEnabled: true
            });

            const creativeAgent = await agentSystem.createAgent({
                name: 'CreativeAgent',
                type: 'creative',
                capabilities: ['generate', 'innovate', 'design'],
                memoryEnabled: true,
                realtimeEnabled: true
            });

            // 注册协作插件
            const collaborationPlugin = {
                name: 'CollaborationPlugin',
                protocols: ['websocket', 'message-queue'],
                execute: async (context) => {
                    // 在Agent间协调任务
                    const coordination = await pluginSystem.sendMessage('message-queue', {
                        type: 'task-coordination',
                        agents: [researchAgent.id, creativeAgent.id],
                        context: context
                    });

                    return coordination;
                }
            };

            await pluginSystem.registerPlugin(collaborationPlugin);

            // 创建复杂的协作工作流
            const agiWorkflow = {
                id: 'agi-collaboration-workflow',
                name: 'AGI协作创新工作流',
                nodes: [
                    {
                        id: 'topic-input',
                        type: 'user-input',
                        config: { required: true }
                    },
                    {
                        id: 'research-phase',
                        type: 'agent-task',
                        agentId: researchAgent.id,
                        config: {
                            task: 'comprehensive-research',
                            memory: 'use-existing',
                            collaboration: true
                        }
                    },
                    {
                        id: 'creative-phase',
                        type: 'agent-task',
                        agentId: creativeAgent.id,
                        config: {
                            task: 'innovative-solution',
                            inspiration: 'research-results',
                            collaboration: true
                        }
                    },
                    {
                        id: 'collaboration-sync',
                        type: 'plugin-task',
                        config: {
                            pluginName: 'CollaborationPlugin',
                            protocol: 'websocket'
                        }
                    },
                    {
                        id: 'memory-update',
                        type: 'memory-update',
                        config: {
                            updateType: 'collaboration-result',
                            shareWith: 'all-agents'
                        }
                    },
                    {
                        id: 'final-output',
                        type: 'output-formatter',
                        config: {
                            format: 'structured-report',
                            includeMetadata: true
                        }
                    }
                ],
                connections: [
                    { from: 'topic-input', to: 'research-phase' },
                    { from: 'research-phase', to: 'collaboration-sync' },
                    { from: 'collaboration-sync', to: 'creative-phase' },
                    { from: 'creative-phase', to: 'memory-update' },
                    { from: 'memory-update', to: 'final-output' }
                ]
            };

            // 执行AGI协作工作流
            const result = await workflowExecutor.executeWorkflow(agiWorkflow, {
                topic: '未来智能工作流系统的设计理念',
                userContext: {
                    expertise: 'workflow-system-design',
                    preferences: 'innovative-solutions'
                }
            });

            // 验证结果
            expect(result.success).to.be.true;
            expect(result.output).to.have.property('research');
            expect(result.output).to.have.property('creative');
            expect(result.output).to.have.property('collaboration');
            expect(result.output).to.have.property('finalReport');

            // 验证记忆网络更新
            const relatedMemories = await memoryNetwork.search({
                query: '智能工作流系统设计',
                limit: 3
            });

            expect(relatedMemories.length).to.be.greaterThan(0);

            // 验证Agent状态
            const updatedResearchAgent = await agentSystem.getAgent(researchAgent.id);
            const updatedCreativeAgent = await agentSystem.getAgent(creativeAgent.id);

            expect(updatedResearchAgent.stats.collaborations).to.be.greaterThan(0);
            expect(updatedCreativeAgent.stats.collaborations).to.be.greaterThan(0);
        });

        it('应该能够处理系统故障和恢复', async () => {
            // 创建容错工作流
            const resilientWorkflow = {
                id: 'resilient-workflow',
                name: '容错工作流',
                nodes: [
                    {
                        id: 'unreliable-task',
                        type: 'unreliable-task',
                        config: { failureRate: 0.3 }
                    },
                    {
                        id: 'retry-handler',
                        type: 'retry-logic',
                        config: { maxRetries: 3, backoff: 'exponential' }
                    },
                    {
                        id: 'fallback-task',
                        type: 'fallback-task',
                        config: { alternative: 'safe-mode' }
                    },
                    {
                        id: 'recovery-agent',
                        type: 'agent-task',
                        agentId: 'recovery-agent',
                        config: { task: 'analyze-failure' }
                    }
                ],
                connections: [
                    { from: 'unreliable-task', to: 'retry-handler' },
                    { from: 'retry-handler', to: 'fallback-task', condition: 'failure' },
                    { from: 'fallback-task', to: 'recovery-agent' }
                ]
            };

            // 执行容错工作流
            const result = await workflowExecutor.executeWorkflow(resilientWorkflow, {
                critical: true,
                timeout: 10000
            });

            // 即使有故障，也应该成功完成
            expect(result.success).to.be.true;
            expect(result.recovery).to.have.property('attempts');
            expect(result.fallback).to.have.property('used', true);
        });
    });
});
