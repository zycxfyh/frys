/**
 * 🧠 frys Agent系统 - 借鉴VCPToolBox的独立多Agent封装理念
 *
 * 核心特性：
 * - 独立Agent封装：每个Agent都是自治的执行单元
 * - 智能协作：Agent间可通过消息队列协作
 * - 状态管理：每个Agent维护自己的状态和上下文
 * - 生命周期管理：创建、激活、休眠、销毁的完整生命周期
 * - 权限控制：细粒度的权限和资源访问控制
 */

import { EventEmitter } from 'events';
import { logger } from '../shared/utils/logger.js';
import { frysError } from './error-handler.js';

class AgentContainer extends EventEmitter {
  constructor(agentId, config = {}) {
    super();
    this.agentId = agentId;
    this.config = {
      maxConcurrency: 5,
      timeout: 30000,
      retryAttempts: 3,
      memoryLimit: 100 * 1024 * 1024, // 100MB
      ...config,
    };

    this.state = 'inactive'; // inactive, active, suspended, terminated
    this.tasks = new Map();
    this.memory = new Map();
    this.capabilities = new Set();
    this.permissions = new Set();

    this.createdAt = new Date();
    this.lastActive = null;
    this.taskCount = 0;
    this.errorCount = 0;

    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.on('task:start', (taskId) => {
      this.lastActive = new Date();
      this.taskCount++;
      logger.debug(`Agent ${this.agentId}: Task ${taskId} started`);
    });

    this.on('task:complete', (taskId, result) => {
      logger.debug(`Agent ${this.agentId}: Task ${taskId} completed`, {
        result,
      });
    });

    this.on('task:error', (taskId, error) => {
      this.errorCount++;
      logger.error(`Agent ${this.agentId}: Task ${taskId} failed`, {
        error: error.message,
      });
    });

    this.on('state:change', (oldState, newState) => {
      logger.info(
        `Agent ${this.agentId}: State changed from ${oldState} to ${newState}`,
      );
    });
  }

  async activate() {
    if (this.state === 'active') return;

    const oldState = this.state;
    this.state = 'active';
    this.lastActive = new Date();

    await this.initializeCapabilities();
    await this.loadMemory();

    this.emit('state:change', oldState, this.state);
    this.emit('activated');

    logger.info(`Agent ${this.agentId} activated successfully`);
  }

  async suspend() {
    if (this.state === 'suspended') return;

    const oldState = this.state;
    this.state = 'suspended';

    await this.saveMemory();
    this.emit('state:change', oldState, this.state);
    this.emit('suspended');
  }

  async terminate() {
    if (this.state === 'terminated') return;

    const oldState = this.state;
    this.state = 'terminated';

    // 清理资源
    await this.cleanup();

    this.emit('state:change', oldState, this.state);
    this.emit('terminated');

    // 移除所有事件监听器
    this.removeAllListeners();
  }

  async executeTask(taskId, taskFunction, context = {}) {
    if (this.state !== 'active') {
      throw frysError.system(`Agent ${this.agentId} is not active`);
    }

    if (this.tasks.size >= this.config.maxConcurrency) {
      throw frysError.system(
        `Agent ${this.agentId} reached max concurrency limit`,
      );
    }

    this.emit('task:start', taskId);

    try {
      // 设置超时
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(
          () => reject(frysError.system(`Task ${taskId} timeout`)),
          this.config.timeout,
        );
      });

      // 执行任务
      const taskPromise = this.runTask(taskFunction, context);
      const result = await Promise.race([taskPromise, timeoutPromise]);

      this.emit('task:complete', taskId, result);
      return result;
    } catch (error) {
      this.emit('task:error', taskId, error);
      throw error;
    } finally {
      this.tasks.delete(taskId);
    }
  }

  runTask(taskFunction, context) {
    // 创建任务执行环境
    const executionContext = {
      agentId: this.agentId,
      capabilities: Array.from(this.capabilities),
      permissions: Array.from(this.permissions),
      memory: this.memory,
      ...context,
    };

    return taskFunction(executionContext);
  }

  addCapability(capability) {
    this.capabilities.add(capability);
    this.emit('capability:added', capability);
  }

  removeCapability(capability) {
    this.capabilities.delete(capability);
    this.emit('capability:removed', capability);
  }

  hasCapability(capability) {
    return this.capabilities.has(capability);
  }

  grantPermission(permission) {
    this.permissions.add(permission);
    this.emit('permission:granted', permission);
  }

  revokePermission(permission) {
    this.permissions.delete(permission);
    this.emit('permission:revoked', permission);
  }

  hasPermission(permission) {
    return this.permissions.has(permission);
  }

  initializeCapabilities() {
    // 子类重写此方法来初始化特定能力
    throw new Error('initializeCapabilities must be implemented by subclass');
  }

  async loadMemory() {
    // 从持久化存储加载记忆
    // 子类可以重写此方法
  }

  async saveMemory() {
    // 保存记忆到持久化存储
    // 子类可以重写此方法
  }

  cleanup() {
    // 清理资源
    this.tasks.clear();
    this.memory.clear();
  }

  getStats() {
    return {
      agentId: this.agentId,
      state: this.state,
      taskCount: this.taskCount,
      errorCount: this.errorCount,
      activeTasks: this.tasks.size,
      capabilities: Array.from(this.capabilities),
      permissions: Array.from(this.permissions),
      memoryUsage: this.memory.size,
      createdAt: this.createdAt,
      lastActive: this.lastActive,
      uptime: this.lastActive ? Date.now() - this.lastActive.getTime() : 0,
    };
  }
}

/**
 * 🤖 AIServiceAgent - AI服务代理
 * 专门处理AI API调用的智能代理
 */
export class AIServiceAgent extends AgentContainer {
  constructor(agentId, aiService, config = {}) {
    super(agentId, config);
    this.aiService = aiService;
    this.serviceStats = {
      requests: 0,
      tokens: 0,
      cost: 0,
      errors: 0,
    };
  }

  initializeCapabilities() {
    // 根据AI服务类型添加能力
    if (this.aiService.constructor.name.includes('OpenAI')) {
      this.addCapability('text-generation');
      this.addCapability('image-generation');
      this.addCapability('audio-transcription');
      this.addCapability('embeddings');
    } else if (this.aiService.constructor.name.includes('Claude')) {
      this.addCapability('text-generation');
      this.addCapability('long-context');
      this.addCapability('safe-content');
    } else if (this.aiService.constructor.name.includes('Gemini')) {
      this.addCapability('text-generation');
      this.addCapability('multimodal');
      this.addCapability('google-integration');
    }
    // 其他服务类型...
  }

  executeAIRequest(taskId, request) {
    return this.executeTask(taskId, async () => {
      this.serviceStats.requests++;

      try {
        const result = await this.aiService.chat(request);

        // 更新统计信息
        this.serviceStats.tokens += result.usage?.total_tokens || 0;
        this.serviceStats.cost += result.cost || 0;

        // 存储到记忆中
        this.memory.set(`task_${taskId}`, {
          request,
          result: result.choices[0]?.message,
          timestamp: new Date(),
          tokens: result.usage?.total_tokens || 0,
          cost: result.cost || 0,
        });

        return result;
      } catch (error) {
        this.serviceStats.errors++;
        throw error;
      }
    });
  }

  getServiceStats() {
    return {
      ...this.getStats(),
      serviceStats: this.serviceStats,
      successRate:
        this.serviceStats.requests > 0
          ? ((this.serviceStats.requests - this.serviceStats.errors) /
              this.serviceStats.requests) *
            100
          : 0,
    };
  }
}

/**
 * 🔄 WorkflowAgent - 工作流代理
 * 处理复杂工作流执行的智能代理
 */
export class WorkflowAgent extends AgentContainer {
  constructor(agentId, workflowEngine, config = {}) {
    super(agentId, config);
    this.workflowEngine = workflowEngine;
    this.activeWorkflows = new Map();
  }

  initializeCapabilities() {
    this.addCapability('workflow-execution');
    this.addCapability('task-coordination');
    this.addCapability('error-recovery');
    this.addCapability('parallel-processing');
  }

  executeWorkflow(taskId, workflowDefinition, inputData) {
    return this.executeTask(taskId, async () => {
      const workflowId = `wf_${taskId}_${Date.now()}`;
      this.activeWorkflows.set(workflowId, {
        definition: workflowDefinition,
        status: 'running',
        startedAt: new Date(),
        tasks: [],
      });

      try {
        const result = await this.workflowEngine.execute(
          workflowDefinition,
          inputData,
        );

        // 更新工作流状态
        this.activeWorkflows.get(workflowId).status = 'completed';
        this.activeWorkflows.get(workflowId).completedAt = new Date();

        return result;
      } catch (error) {
        // 更新工作流状态
        this.activeWorkflows.get(workflowId).status = 'failed';
        this.activeWorkflows.get(workflowId).error = error.message;
        this.activeWorkflows.get(workflowId).failedAt = new Date();

        throw error;
      }
    });
  }

  getActiveWorkflows() {
    return Array.from(this.activeWorkflows.entries()).map(([id, workflow]) => ({
      id,
      status: workflow.status,
      startedAt: workflow.startedAt,
      completedAt: workflow.completedAt,
      failedAt: workflow.failedAt,
      error: workflow.error,
    }));
  }
}

/**
 * 🧠 MemoryAgent - 记忆网络代理
 * 管理跨会话记忆和知识图谱的智能代理
 */
export class MemoryAgent extends AgentContainer {
  constructor(agentId, memoryStore, config = {}) {
    super(agentId, config);
    this.memoryStore = memoryStore;
    this.knowledgeGraph = new Map();
    this.semanticIndex = new Map();
  }

  initializeCapabilities() {
    this.addCapability('memory-storage');
    this.addCapability('knowledge-graph');
    this.addCapability('semantic-search');
    this.addCapability('context-retrieval');
  }

  storeMemory(taskId, key, data, metadata = {}) {
    return this.executeTask(taskId, async () => {
      const memoryEntry = {
        key,
        data,
        metadata: {
          ...metadata,
          agentId: this.agentId,
          timestamp: new Date(),
          accessCount: 0,
          lastAccessed: new Date(),
        },
      };

      await this.memoryStore.set(key, memoryEntry);

      // 更新知识图谱
      this.updateKnowledgeGraph(key, data, metadata);

      return { key, stored: true };
    });
  }

  retrieveMemory(taskId, key) {
    return this.executeTask(taskId, async () => {
      const entry = await this.memoryStore.get(key);
      if (!entry) return null;

      // 更新访问统计
      entry.metadata.accessCount++;
      entry.metadata.lastAccessed = new Date();
      await this.memoryStore.set(key, entry);

      return entry;
    });
  }

  semanticSearch(taskId, query, options = {}) {
    return this.executeTask(taskId, () => {
      // 简单的语义搜索实现
      const results = [];

      for (const [key, entry] of this.memory.entries()) {
        const score = this.calculateSemanticSimilarity(query, entry.data);
        if (score > (options.threshold || 0.3)) {
          results.push({
            key,
            data: entry.data,
            score,
            metadata: entry.metadata,
          });
        }
      }

      return results.sort((a, b) => b.score - a.score);
    });
  }

  updateKnowledgeGraph(key, data) {
    // 构建简单的知识图谱关系
    const entities = this.extractEntities(data);
    const relations = this.extractRelations(data);

    entities.forEach((entity) => {
      if (!this.knowledgeGraph.has(entity)) {
        this.knowledgeGraph.set(entity, new Set());
      }
      this.knowledgeGraph.get(entity).add(key);
    });

    // 存储关系
    relations.forEach((relation) => {
      const relationKey = `${relation.from}_${relation.type}_${relation.to}`;
      this.knowledgeGraph.set(relationKey, new Set([key]));
    });
  }

  extractEntities(data) {
    // 简单的实体提取（可扩展为NLP）
    const entities = [];
    if (typeof data === 'string') {
      // 提取@mentions、#hashtags等
      const mentions = data.match(/@(\w+)/g) || [];
      const hashtags = data.match(/#(\w+)/g) || [];
      entities.push(...mentions, ...hashtags);
    }
    return entities;
  }

  extractRelations() {
    // 简单的关系提取
    return []; // 可扩展实现
  }

  calculateSemanticSimilarity(query, data) {
    // 简单的相似度计算（可扩展为向量相似度）
    if (typeof query !== 'string' || typeof data !== 'string') return 0;

    const queryWords = query.toLowerCase().split(/\s+/);
    const dataWords = data.toLowerCase().split(/\s+/);

    const intersection = queryWords.filter((word) => dataWords.includes(word));
    const union = new Set([...queryWords, ...dataWords]);

    return intersection.length / union.size;
  }
}

/**
 * 🌐 AgentManager - Agent管理系统
 * 借鉴VCPToolBox的多Agent管理理念
 */
export class AgentManager {
  constructor() {
    this.agents = new Map();
    this.agentRegistry = new Map(); // agent类型注册表
    this.globalStats = {
      totalAgents: 0,
      activeAgents: 0,
      totalTasks: 0,
      totalErrors: 0,
    };

    this.registerDefaultAgents();
  }

  registerDefaultAgents() {
    // 注册默认Agent类型
    this.agentRegistry.set('ai-service', AIServiceAgent);
    this.agentRegistry.set('workflow', WorkflowAgent);
    this.agentRegistry.set('memory', MemoryAgent);
  }

  initialize() {
    // 初始化Agent管理器
    logger.debug('AgentManager initialized');
  }

  shutdown() {
    // 关闭所有Agent
    for (const [agentId, agent] of this.agents) {
      try {
        if (agent.shutdown && typeof agent.shutdown === 'function') {
          agent.shutdown();
        }
      } catch (error) {
        logger.error(`Failed to shutdown agent ${agentId}`, error);
      }
    }
    this.agents.clear();
    logger.debug('AgentManager shut down');
  }

  registerAgentType(type, AgentClass) {
    this.agentRegistry.set(type, AgentClass);
    logger.info(`Agent type '${type}' registered`);
  }

  createAgent(agentId, type, config = {}) {
    if (this.agents.has(agentId)) {
      throw frysError.conflict(`Agent ${agentId} already exists`);
    }

    const AgentClass = this.agentRegistry.get(type);
    if (!AgentClass) {
      throw frysError.notFound(`Agent type '${type}' not registered`);
    }

    const agent = new AgentClass(agentId, config);
    this.agents.set(agentId, agent);
    this.globalStats.totalAgents++;

    // 监听状态变化
    agent.on('state:change', (oldState, newState) => {
      if (newState === 'active') {
        this.globalStats.activeAgents++;
      } else if (oldState === 'active') {
        this.globalStats.activeAgents--;
      }
    });

    logger.info(`Agent ${agentId} of type '${type}' created`);
    return agent;
  }

  getAgent(agentId) {
    return this.agents.get(agentId);
  }

  async activateAgent(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw frysError.notFound(`Agent ${agentId} not found`);
    }

    await agent.activate();
    return agent;
  }

  async suspendAgent(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw frysError.notFound(`Agent ${agentId} not found`);
    }

    await agent.suspend();
    return agent;
  }

  async terminateAgent(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw frysError.notFound(`Agent ${agentId} not found`);
    }

    await agent.terminate();
    this.agents.delete(agentId);
    this.globalStats.totalAgents--;

    return true;
  }

  executeOnAgent(agentId, method, ...args) {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw frysError.notFound(`Agent ${agentId} not found`);
    }

    if (typeof agent[method] !== 'function') {
      throw frysError.notFound(
        `Method '${method}' not found on agent ${agentId}`,
      );
    }

    this.globalStats.totalTasks++;
    try {
      return agent[method](...args);
    } catch (error) {
      this.globalStats.totalErrors++;
      throw error;
    }
  }

  getAgentStats(agentId = null) {
    if (agentId) {
      const agent = this.agents.get(agentId);
      return agent ? agent.getStats() : null;
    }

    const agentStats = {};
    for (const [id, agent] of this.agents) {
      agentStats[id] = agent.getStats();
    }

    return {
      global: this.globalStats,
      agents: agentStats,
    };
  }

  getActiveAgents() {
    return Array.from(this.agents.values())
      .filter((agent) => agent.state === 'active')
      .map((agent) => ({
        id: agent.agentId,
        type: agent.constructor.name,
        capabilities: Array.from(agent.capabilities),
        stats: agent.getStats(),
      }));
  }

  cleanup() {
    for (const [agentId, agent] of this.agents) {
      if (agent.state !== 'terminated') {
        this.terminateAgent(agentId);
      }
    }
    logger.info('All agents cleaned up');
  }
}

// AgentSystem主类 - 统一入口
export class AgentSystem {
  constructor(config = {}) {
    this.config = {
      maxConcurrentAgents: config.maxConcurrentAgents || 10,
      defaultTimeout: config.defaultTimeout || 30000,
      enableMetrics: config.enableMetrics !== false,
      ...config,
    };

    this.agentManager = new AgentManager();
    this.initialized = false;
    logger.info('AgentSystem initialized with config:', this.config);
  }

  initialize() {
    if (this.initialized) return;

    this.agentManager.initialize();
    this.initialized = true;
    logger.info('AgentSystem fully initialized');
  }

  shutdown() {
    if (!this.initialized) return;

    this.agentManager.shutdown();
    this.initialized = false;
    logger.info('AgentSystem shut down');
  }

  // 代理AgentManager的方法
  createAgent(config) {
    const { name, type, ...agentConfig } = config;
    return this.agentManager.createAgent(name, type, agentConfig);
  }

  getAgent(agentId) {
    return this.agentManager.getAgent(agentId);
  }

  listAgents() {
    return this.agentManager.listAgents();
  }

  getStats() {
    return this.agentManager.getStats();
  }
}

// 创建全局Agent管理器实例
export const agentManager = new AgentManager();

export default {
  AgentSystem,
  AgentContainer,
  AIServiceAgent,
  WorkflowAgent,
  MemoryAgent,
  AgentManager,
  agentManager,
};
