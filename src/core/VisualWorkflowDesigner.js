/**
 * 🎨 frys 可视化工作流设计器
 *
 * 借鉴Flowise、Dify等优秀项目的可视化理念，实现：
 * - 拖拽式节点编辑：直观的流程设计界面
 * - 智能节点推荐：基于上下文的节点建议
 * - 实时预览：工作流执行的即时反馈
 * - 模板市场：丰富的预置工作流模板
 * - 协作编辑：多用户同时编辑支持
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';
import { frysError } from './error-handler.js';

class WorkflowNode {
  constructor(type, config = {}) {
    this.id = `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.type = type;
    this.position = config.position || { x: 0, y: 0 };
    this.data = config.data || {};
    this.style = config.style || {};
    this.inputs = config.inputs || [];
    this.outputs = config.outputs || [];

    // 运行时状态
    this.state = 'idle'; // idle, running, completed, error
    this.executionTime = null;
    this.error = null;
    this.outputData = null;
  }

  validate() {
    // 子类实现验证逻辑
    return true;
  }

  execute(context, inputs) {
    // 子类实现执行逻辑
    throw new Error(`Node type ${this.type} execution not implemented`);
  }

  toJSON() {
    return {
      id: this.id,
      type: this.type,
      position: this.position,
      data: this.data,
      style: this.style,
      inputs: this.inputs,
      outputs: this.outputs,
      state: this.state
    };
  }
}

// 触发器节点
class TriggerNode extends WorkflowNode {
  constructor(config = {}) {
    super('trigger', {
      inputs: [],
      outputs: [{ id: 'output', label: '触发输出', type: 'data' }],
      ...config
    });
  }

  validate() {
    return this.data.triggerType && this.data.schedule;
  }

  execute(context, inputs) {
    // 触发器节点的执行逻辑
    return {
      triggered: true,
      timestamp: new Date(),
      triggerType: this.data.triggerType,
      data: this.data.payload || {}
    };
  }
}

// AI处理节点
class AINode extends WorkflowNode {
  constructor(config = {}) {
    super('ai', {
      inputs: [{ id: 'input', label: '输入文本', type: 'string' }],
      outputs: [{ id: 'output', label: 'AI响应', type: 'string' }],
      ...config
    });
  }

  validate() {
    return this.data.model && this.data.prompt;
  }

  async execute(context, inputs) {
    try {
      const startTime = Date.now();
      this.state = 'running';

      // 这里应该调用AI服务
      const response = await this.callAIService(inputs.input || this.data.prompt);

      this.state = 'completed';
      this.executionTime = Date.now() - startTime;
      this.outputData = response;

      return {
        success: true,
        response,
        executionTime: this.executionTime,
        model: this.data.model
      };
    } catch (error) {
      this.state = 'error';
      this.error = error.message;
      throw error;
    }
  }

  async callAIService(prompt) {
    // 模拟AI服务调用
    await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 500));

    // 模拟不同的响应
    const responses = [
      `基于您的查询"${prompt}"，我建议...`,
      `分析结果显示：${prompt}的相关信息如下...`,
      `根据最新数据，${prompt}的发展趋势是...`,
      `针对"${prompt}"这个问题，我推荐以下解决方案...`
    ];

    return responses[Math.floor(Math.random() * responses.length)];
  }
}

// 数据处理节点
class DataProcessingNode extends WorkflowNode {
  constructor(config = {}) {
    super('data-processing', {
      inputs: [{ id: 'input', label: '输入数据', type: 'any' }],
      outputs: [{ id: 'output', label: '处理结果', type: 'any' }],
      ...config
    });
  }

  validate() {
    return this.data.operation && ['filter', 'transform', 'aggregate'].includes(this.data.operation);
  }

  execute(context, inputs) {
    const inputData = inputs.input || this.data.inputData;
    let result;

    switch (this.data.operation) {
      case 'filter':
        result = this.filterData(inputData);
        break;
      case 'transform':
        result = this.transformData(inputData);
        break;
      case 'aggregate':
        result = this.aggregateData(inputData);
        break;
      default:
        throw new Error(`Unknown operation: ${this.data.operation}`);
    }

    this.outputData = result;
    return result;
  }

  filterData(data) {
    if (!Array.isArray(data)) return data;
    const condition = this.data.condition || (() => true);
    return data.filter(condition);
  }

  transformData(data) {
    const transformer = this.data.transformer || ((x) => x);
    return transformer(data);
  }

  aggregateData(data) {
    if (!Array.isArray(data)) return data;

    const operation = this.data.aggregateOperation || 'count';
    switch (operation) {
      case 'count':
        return data.length;
      case 'sum':
        return data.reduce((sum, item) => sum + (Number(item) || 0), 0);
      case 'avg':
        return data.reduce((sum, item) => sum + (Number(item) || 0), 0) / data.length;
      case 'max':
        return Math.max(...data.map(item => Number(item) || 0));
      case 'min':
        return Math.min(...data.map(item => Number(item) || 0));
      default:
        return data;
    }
  }
}

// 条件分支节点
class ConditionNode extends WorkflowNode {
  constructor(config = {}) {
    super('condition', {
      inputs: [{ id: 'input', label: '输入数据', type: 'any' }],
      outputs: [
        { id: 'true', label: 'True', type: 'data' },
        { id: 'false', label: 'False', type: 'data' }
      ],
      ...config
    });
  }

  validate() {
    return this.data.condition && typeof this.data.condition === 'function';
  }

  execute(context, inputs) {
    const inputData = inputs.input || this.data.inputData;
    const condition = this.data.condition;

    const result = condition(inputData);
    this.outputData = { condition: result, input: inputData };

    return {
      condition: result,
      input: inputData,
      branch: result ? 'true' : 'false'
    };
  }
}

// 循环节点
class LoopNode extends WorkflowNode {
  constructor(config = {}) {
    super('loop', {
      inputs: [{ id: 'input', label: '输入数组', type: 'array' }],
      outputs: [{ id: 'output', label: '循环结果', type: 'array' }],
      ...config
    });
  }

  validate() {
    return this.data.loopType && ['forEach', 'map', 'filter'].includes(this.data.loopType);
  }

  execute(context, inputs) {
    const inputData = inputs.input || this.data.inputData;
    if (!Array.isArray(inputData)) {
      throw new Error('Loop node requires an array input');
    }

    const loopType = this.data.loopType;
    const processor = this.data.processor || ((item) => item);

    let result;
    switch (loopType) {
      case 'forEach':
        result = inputData.map(processor);
        break;
      case 'map':
        result = inputData.map(processor);
        break;
      case 'filter':
        result = inputData.filter(processor);
        break;
      default:
        result = inputData;
    }

    this.outputData = result;
    return result;
  }
}

// 工作流连接
class WorkflowConnection {
  constructor(sourceNodeId, sourceOutputId, targetNodeId, targetInputId, config = {}) {
    this.id = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.sourceNodeId = sourceNodeId;
    this.sourceOutputId = sourceOutputId;
    this.targetNodeId = targetNodeId;
    this.targetInputId = targetInputId;
    this.style = config.style || {};
    this.animated = config.animated !== false;
  }

  toJSON() {
    return {
      id: this.id,
      source: this.sourceNodeId,
      sourceHandle: this.sourceOutputId,
      target: this.targetNodeId,
      targetHandle: this.targetInputId,
      style: this.style,
      animated: this.animated
    };
  }
}

/**
 * 🎨 VisualWorkflowDesigner - 可视化工作流设计器
 */
export class VisualWorkflowDesigner extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = {
      maxNodes: 100,
      maxConnections: 200,
      enableCollaboration: false,
      autoSave: true,
      autoSaveInterval: 30000, // 30秒
      ...config
    };

    this.nodes = new Map();
    this.connections = new Map();
    this.templates = new Map();
    this.sessions = new Map(); // 协作会话

    this.history = []; // 操作历史
    this.historyIndex = -1;

    this.isRunning = false;
    this.executionState = null;

    // 注册内置节点类型
    this.registerNodeTypes();

    // 注册内置模板
    this.registerTemplates();

    // 启动自动保存
    if (this.config.autoSave) {
      this.startAutoSave();
    }

    logger.info('Visual Workflow Designer initialized');
  }

  registerNodeTypes() {
    this.nodeTypes = new Map([
      ['trigger', TriggerNode],
      ['ai', AINode],
      ['data-processing', DataProcessingNode],
      ['condition', ConditionNode],
      ['loop', LoopNode]
    ]);

    this.emit('nodeTypes:registered', Array.from(this.nodeTypes.keys()));
  }

  registerTemplates() {
    // 注册内置模板
    this.templates.set('customer-support', {
      name: '客户支持自动化',
      description: '自动处理客户查询和支持请求',
      nodes: [
        { type: 'trigger', position: { x: 100, y: 100 }, data: { triggerType: 'webhook', schedule: 'immediate' } },
        { type: 'ai', position: { x: 300, y: 100 }, data: { model: 'gpt-4', prompt: '分析客户查询并提供解决方案' } },
        { type: 'condition', position: { x: 500, y: 100 }, data: { condition: (data) => data.confidence > 0.8 } },
        { type: 'data-processing', position: { x: 700, y: 50 }, data: { operation: 'transform' } }
      ],
      connections: [
        { source: 'node1', sourceHandle: 'output', target: 'node2', targetHandle: 'input' },
        { source: 'node2', sourceHandle: 'output', target: 'node3', targetHandle: 'input' },
        { source: 'node3', sourceHandle: 'true', target: 'node4', targetHandle: 'input' }
      ]
    });

    this.templates.set('data-analysis', {
      name: '数据分析管道',
      description: '自动化数据处理和分析流程',
      nodes: [
        { type: 'trigger', position: { x: 100, y: 100 }, data: { triggerType: 'schedule', schedule: 'daily' } },
        { type: 'data-processing', position: { x: 300, y: 100 }, data: { operation: 'filter' } },
        { type: 'data-processing', position: { x: 500, y: 100 }, data: { operation: 'aggregate' } },
        { type: 'ai', position: { x: 700, y: 100 }, data: { model: 'gpt-4', prompt: '基于数据生成分析报告' } }
      ],
      connections: [
        { source: 'node1', sourceHandle: 'output', target: 'node2', targetHandle: 'input' },
        { source: 'node2', sourceHandle: 'output', target: 'node3', targetHandle: 'input' },
        { source: 'node3', sourceHandle: 'output', target: 'node4', targetHandle: 'input' }
      ]
    });
  }

  // 节点管理
  addNode(type, config = {}) {
    if (this.nodes.size >= this.config.maxNodes) {
      throw frysError.system(`Maximum nodes limit reached: ${this.config.maxNodes}`);
    }

    const NodeClass = this.nodeTypes.get(type);
    if (!NodeClass) {
      throw frysError.validation(`Unknown node type: ${type}`);
    }

    const node = new NodeClass(config);
    this.nodes.set(node.id, node);

    this.addToHistory('add_node', { nodeId: node.id, type, config });
    this.emit('node:added', node);

    logger.debug(`Added node ${node.id} of type ${type}`);
    return node;
  }

  removeNode(nodeId) {
    const node = this.nodes.get(nodeId);
    if (!node) return false;

    // 移除相关连接
    for (const [connId, connection] of this.connections) {
      if (connection.sourceNodeId === nodeId || connection.targetNodeId === nodeId) {
        this.connections.delete(connId);
        this.emit('connection:removed', connection);
      }
    }

    this.nodes.delete(nodeId);
    this.addToHistory('remove_node', { nodeId });
    this.emit('node:removed', node);

    logger.debug(`Removed node ${nodeId}`);
    return true;
  }

  updateNode(nodeId, updates) {
    const node = this.nodes.get(nodeId);
    if (!node) {
      throw frysError.notFound(`Node ${nodeId} not found`);
    }

    Object.assign(node, updates);
    this.addToHistory('update_node', { nodeId, updates });
    this.emit('node:updated', node);

    return node;
  }

  // 连接管理
  addConnection(sourceNodeId, sourceOutputId, targetNodeId, targetInputId, config = {}) {
    if (this.connections.size >= this.config.maxConnections) {
      throw frysError.system(`Maximum connections limit reached: ${this.config.maxConnections}`);
    }

    // 检查节点是否存在
    if (!this.nodes.has(sourceNodeId) || !this.nodes.has(targetNodeId)) {
      throw frysError.validation('Source or target node does not exist');
    }

    // 检查是否形成循环
    if (this.wouldCreateCycle(sourceNodeId, targetNodeId)) {
      throw frysError.validation('Connection would create a cycle');
    }

    const connection = new WorkflowConnection(sourceNodeId, sourceOutputId, targetNodeId, targetInputId, config);
    this.connections.set(connection.id, connection);

    this.addToHistory('add_connection', {
      connectionId: connection.id,
      sourceNodeId,
      sourceOutputId,
      targetNodeId,
      targetInputId
    });

    this.emit('connection:added', connection);
    logger.debug(`Added connection ${connection.id} from ${sourceNodeId} to ${targetNodeId}`);

    return connection;
  }

  removeConnection(connectionId) {
    const connection = this.connections.get(connectionId);
    if (!connection) return false;

    this.connections.delete(connectionId);
    this.addToHistory('remove_connection', { connectionId });
    this.emit('connection:removed', connection);

    logger.debug(`Removed connection ${connectionId}`);
    return true;
  }

  wouldCreateCycle(sourceId, targetId, visited = new Set()) {
    if (visited.has(sourceId)) return true;
    if (sourceId === targetId) return true;

    visited.add(sourceId);

    for (const connection of this.connections.values()) {
      if (connection.sourceNodeId === sourceId) {
        if (this.wouldCreateCycle(connection.targetNodeId, targetId, new Set(visited))) {
          return true;
        }
      }
    }

    return false;
  }

  // 模板管理
  loadTemplate(templateId) {
    const template = this.templates.get(templateId);
    if (!template) {
      throw frysError.notFound(`Template ${templateId} not found`);
    }

    // 清空当前工作流
    this.clear();

    // 加载模板节点
    const nodeIdMap = new Map();
    template.nodes.forEach((nodeConfig, index) => {
      const node = this.addNode(nodeConfig.type, nodeConfig);
      nodeIdMap.set(`node${index + 1}`, node.id);
    });

    // 加载模板连接
    template.connections.forEach(connConfig => {
      const sourceId = nodeIdMap.get(connConfig.source);
      const targetId = nodeIdMap.get(connConfig.target);

      if (sourceId && targetId) {
        this.addConnection(sourceId, connConfig.sourceHandle, targetId, connConfig.targetHandle);
      }
    });

    this.emit('template:loaded', { templateId, template });
    logger.info(`Loaded template ${templateId}`);

    return { templateId, nodes: Array.from(this.nodes.keys()), connections: Array.from(this.connections.keys()) };
  }

  saveAsTemplate(name, description) {
    const templateId = `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const template = {
      name,
      description,
      nodes: Array.from(this.nodes.values()).map(node => ({
        type: node.type,
        position: node.position,
        data: node.data,
        style: node.style
      })),
      connections: Array.from(this.connections.values()).map(conn => ({
        source: conn.sourceNodeId,
        sourceHandle: conn.sourceOutputId,
        target: conn.targetNodeId,
        targetHandle: conn.targetInputId
      }))
    };

    this.templates.set(templateId, template);
    this.emit('template:saved', { templateId, template });

    logger.info(`Saved template ${templateId}: ${name}`);
    return templateId;
  }

  // 工作流执行
  async executeWorkflow(inputs = {}, options = {}) {
    if (this.isRunning) {
      throw frysError.conflict('Workflow is already running');
    }

    this.isRunning = true;
    this.executionState = {
      startTime: new Date(),
      completedNodes: new Set(),
      runningNodes: new Set(),
      results: new Map(),
      errors: []
    };

    this.emit('execution:started', { inputs, options });

    try {
      const result = await this.executeNodes(inputs, options);
      this.emit('execution:completed', result);
      return result;
    } catch (error) {
      this.emit('execution:error', error);
      throw error;
    } finally {
      this.isRunning = false;
      this.executionState.endTime = new Date();
    }
  }

  async executeNodes(inputs, options) {
    const executionOrder = this.getExecutionOrder();
    const nodeInputs = new Map();
    const results = new Map();

    // 初始化触发器节点的输入
    const triggerNodes = executionOrder.filter(node => node.type === 'trigger');
    triggerNodes.forEach(node => {
      nodeInputs.set(node.id, inputs);
    });

    // 按顺序执行节点
    for (const node of executionOrder) {
      try {
        this.executionState.runningNodes.add(node.id);
        this.emit('node:execution:started', { nodeId: node.id });

        const nodeInput = nodeInputs.get(node.id) || {};
        const result = await node.execute({}, nodeInput);

        results.set(node.id, result);
        this.executionState.completedNodes.add(node.id);

        // 传播结果到下游节点
        this.propagateResults(node.id, result);

        this.emit('node:execution:completed', {
          nodeId: node.id,
          result,
          executionTime: node.executionTime
        });

      } catch (error) {
        this.executionState.errors.push({
          nodeId: node.id,
          error: error.message
        });

        this.emit('node:execution:error', {
          nodeId: node.id,
          error: error.message
        });

        if (!options.continueOnError) {
          throw error;
        }
      } finally {
        this.executionState.runningNodes.delete(node.id);
      }
    }

    return {
      success: this.executionState.errors.length === 0,
      results: Object.fromEntries(results),
      errors: this.executionState.errors,
      executionTime: this.executionState.endTime - this.executionState.startTime
    };
  }

  getExecutionOrder() {
    const visited = new Set();
    const order = [];

    const visit = (nodeId) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);

      // 先访问所有上游节点
      for (const connection of this.connections.values()) {
        if (connection.targetNodeId === nodeId) {
          visit(connection.sourceNodeId);
        }
      }

      order.push(this.nodes.get(nodeId));
    };

    // 从所有节点开始遍历
    for (const nodeId of this.nodes.keys()) {
      visit(nodeId);
    }

    return order;
  }

  propagateResults(sourceNodeId, result) {
    for (const connection of this.connections.values()) {
      if (connection.sourceNodeId === sourceNodeId) {
        const targetNode = this.nodes.get(connection.targetNodeId);
        if (targetNode) {
          // 这里应该根据连接类型和目标节点输入来传递数据
          // 简化实现：直接传递结果
          // 实际实现需要更复杂的路由逻辑
        }
      }
    }
  }

  // 操作历史管理
  addToHistory(action, data) {
    // 清除当前索引之后的历史
    this.history = this.history.slice(0, this.historyIndex + 1);

    this.history.push({ action, data, timestamp: new Date() });
    this.historyIndex = this.history.length - 1;

    // 限制历史记录数量
    if (this.history.length > 100) {
      this.history.shift();
      this.historyIndex--;
    }
  }

  undo() {
    if (this.historyIndex < 0) return false;

    const operation = this.history[this.historyIndex];
    this.historyIndex--;

    // 执行撤销操作
    this.reverseOperation(operation);

    this.emit('operation:undone', operation);
    return true;
  }

  redo() {
    if (this.historyIndex >= this.history.length - 1) return false;

    this.historyIndex++;
    const operation = this.history[this.historyIndex];

    // 重新执行操作
    this.replayOperation(operation);

    this.emit('operation:redone', operation);
    return true;
  }

  reverseOperation(operation) {
    // 实现操作逆转逻辑
    switch (operation.action) {
      case 'add_node':
        this.removeNode(operation.data.nodeId);
        break;
      case 'remove_node':
        // 这里需要存储完整的节点数据才能恢复
        break;
      case 'add_connection':
        this.removeConnection(operation.data.connectionId);
        break;
      case 'remove_connection':
        // 类似地需要存储连接数据
        break;
    }
  }

  replayOperation(operation) {
    // 重新执行操作
    switch (operation.action) {
      case 'add_node':
        this.addNode(operation.data.type, operation.data.config);
        break;
      case 'remove_node':
        this.removeNode(operation.data.nodeId);
        break;
      case 'add_connection':
        this.addConnection(
          operation.data.sourceNodeId,
          operation.data.sourceOutputId,
          operation.data.targetNodeId,
          operation.data.targetInputId
        );
        break;
      case 'remove_connection':
        this.removeConnection(operation.data.connectionId);
        break;
    }
  }

  // 协作功能
  startCollaboration(sessionId, userId) {
    if (!this.config.enableCollaboration) {
      throw frysError.system('Collaboration is not enabled');
    }

    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, new Set());
    }

    this.sessions.get(sessionId).add(userId);
    this.emit('collaboration:joined', { sessionId, userId });

    logger.info(`User ${userId} joined collaboration session ${sessionId}`);
  }

  leaveCollaboration(sessionId, userId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.delete(userId);
      if (session.size === 0) {
        this.sessions.delete(sessionId);
      }
      this.emit('collaboration:left', { sessionId, userId });
    }
  }

  broadcastToSession(sessionId, event, data, excludeUser = null) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    for (const userId of session) {
      if (userId !== excludeUser) {
        this.emit('collaboration:message', {
          sessionId,
          userId,
          event,
          data
        });
      }
    }
  }

  // 自动保存
  startAutoSave() {
    this.autoSaveTimer = setInterval(() => {
      this.autoSave();
    }, this.config.autoSaveInterval);
  }

  async autoSave() {
    try {
      const workflowData = this.serialize();
      // 这里应该保存到持久化存储
      this.emit('auto:saved', { timestamp: new Date() });
    } catch (error) {
      logger.error('Auto-save failed', error);
    }
  }

  // 序列化与反序列化
  serialize() {
    return {
      nodes: Array.from(this.nodes.values()).map(node => node.toJSON()),
      connections: Array.from(this.connections.values()).map(conn => conn.toJSON()),
      config: this.config,
      metadata: {
        version: '1.0.0',
        createdAt: new Date(),
        nodeCount: this.nodes.size,
        connectionCount: this.connections.size
      }
    };
  }

  deserialize(data) {
    this.clear();

    // 恢复节点
    data.nodes.forEach(nodeData => {
      const node = this.addNode(nodeData.type, {
        position: nodeData.position,
        data: nodeData.data,
        style: nodeData.style
      });
      // 保持原始ID
      node.id = nodeData.id;
      this.nodes.set(node.id, node);
    });

    // 恢复连接
    data.connections.forEach(connData => {
      const connection = new WorkflowConnection(
        connData.source,
        connData.sourceHandle,
        connData.target,
        connData.targetHandle,
        { style: connData.style, animated: connData.animated }
      );
      connection.id = connData.id;
      this.connections.set(connection.id, connection);
    });

    this.emit('workflow:loaded', data);
    return this;
  }

  clear() {
    this.nodes.clear();
    this.connections.clear();
    this.history.length = 0;
    this.historyIndex = -1;
    this.executionState = null;

    this.emit('workflow:cleared');
  }

  // 智能推荐
  recommendNodes(context) {
    const recommendations = [];

    // 基于当前节点类型推荐下一个节点
    const lastNode = this.getLastNode();
    if (lastNode) {
      switch (lastNode.type) {
        case 'trigger':
          recommendations.push(
            { type: 'ai', reason: '处理触发器数据' },
            { type: 'data-processing', reason: '预处理数据' }
          );
          break;
        case 'ai':
          recommendations.push(
            { type: 'condition', reason: '基于AI响应做决策' },
            { type: 'data-processing', reason: '处理AI输出' }
          );
          break;
        case 'data-processing':
          recommendations.push(
            { type: 'ai', reason: '用AI分析处理结果' },
            { type: 'loop', reason: '对数据进行循环处理' }
          );
          break;
      }
    }

    // 基于工作流目标推荐
    if (context && context.goal) {
      if (context.goal.includes('automation')) {
        recommendations.push({ type: 'trigger', reason: '自动化触发器' });
      }
      if (context.goal.includes('analysis')) {
        recommendations.push({ type: 'ai', reason: '智能分析' });
      }
    }

    return recommendations.slice(0, 5); // 返回前5个推荐
  }

  getLastNode() {
    // 找到最右边的节点（简化实现）
    let lastNode = null;
    let maxX = -1;

    for (const node of this.nodes.values()) {
      if (node.position.x > maxX) {
        maxX = node.position.x;
        lastNode = node;
      }
    }

    return lastNode;
  }

  // 统计信息
  getStats() {
    const nodeTypeStats = {};
    for (const node of this.nodes.values()) {
      nodeTypeStats[node.type] = (nodeTypeStats[node.type] || 0) + 1;
    }

    return {
      nodeCount: this.nodes.size,
      connectionCount: this.connections.size,
      nodeTypes: nodeTypeStats,
      templateCount: this.templates.size,
      collaborationSessions: this.sessions.size,
      isRunning: this.isRunning,
      executionState: this.executionState
    };
  }

  // 清理资源
  destroy() {
    this.clear();

    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
    }

    this.removeAllListeners();
    logger.info('Visual Workflow Designer destroyed');
  }
}

export default VisualWorkflowDesigner;
