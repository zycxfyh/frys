/**
 * 🔄 frys 非线性超异步工作流执行器
 *
 * 借鉴VCPToolBox的非线性工作流理念，实现：
 * - 非线性任务执行：支持条件分支、并行执行、循环
 * - 超异步处理：基于Promise和EventEmitter的异步编排
 * - 智能调度：根据依赖关系和资源情况自动调度
 * - 错误恢复：节点级错误处理和自动重试
 * - 状态追踪：完整的工作流执行状态监控
 */

import { EventEmitter } from 'events';
import { logger } from '../../shared/utils/logger.js';
import { frysError } from '../ErrorHandlerConfig.js';

class WorkflowNode {
  constructor(id, type, config = {}) {
    this.id = id;
    this.type = type; // task, condition, parallel, loop, wait, end
    this.config = {
      retryAttempts: 3,
      retryDelay: 1000,
      timeout: 30000,
      ...config,
    };

    this.dependencies = new Set();
    this.outputs = new Map();
    this.state = 'pending'; // pending, running, completed, failed, skipped
    this.attempts = 0;
    this.startedAt = null;
    this.completedAt = null;
    this.error = null;
    this.result = null;
  }

  addDependency(nodeId) {
    this.dependencies.add(nodeId);
  }

  canExecute(completedNodes) {
    return Array.from(this.dependencies).every((depId) =>
      completedNodes.has(depId),
    );
  }

  async execute(context, inputs = {}) {
    this.state = 'running';
    this.startedAt = new Date();
    this.attempts++;

    try {
      const result = await this.run(context, inputs);
      this.state = 'completed';
      this.completedAt = new Date();
      this.result = result;

      logger.debug(`Node ${this.id} executed successfully`, {
        type: this.type,
        attempts: this.attempts,
        duration: this.completedAt - this.startedAt,
      });

      return result;
    } catch (error) {
      this.error = error;
      this.state = 'failed';

      // 检查是否可以重试
      if (this.attempts < this.config.retryAttempts) {
        this.state = 'pending'; // 重置为pending，等待重试
        logger.warn(
          `Node ${this.id} failed, will retry (${this.attempts}/${this.config.retryAttempts})`,
          {
            error: error.message,
          },
        );
        throw error; // 重新抛出错误，由执行器处理重试
      } else {
        logger.error(`Node ${this.id} failed permanently`, {
          error: error.message,
          attempts: this.attempts,
        });
        throw error;
      }
    }
  }

  async run() {
    // 子类实现具体的执行逻辑
    throw new Error(`Node type '${this.type}' execution not implemented`);
  }
}

class TaskNode extends WorkflowNode {
  constructor(id, taskFunction, config = {}) {
    super(id, 'task', config);
    this.taskFunction = taskFunction;
  }

  async run(context, inputs) {
    const result = await this.taskFunction(context, inputs);
    this.outputs.set('result', result);
    return result;
  }
}

class ConditionNode extends WorkflowNode {
  constructor(id, conditionFunction, config = {}) {
    super(id, 'condition', config);
    this.conditionFunction = conditionFunction;
  }

  async run(context, inputs) {
    const result = await this.conditionFunction(context, inputs);
    this.outputs.set('result', result);
    return result;
  }
}

class ParallelNode extends WorkflowNode {
  constructor(id, subWorkflows, config = {}) {
    super(id, 'parallel', config);
    this.subWorkflows = subWorkflows; // 数组，每个元素是一个workflow定义
  }

  async run(context, inputs) {
    const promises = this.subWorkflows.map(async (workflow) => {
      const executor = new AsyncWorkflowExecutor(workflow);
      return executor.execute(context, inputs);
    });

    const results = await Promise.allSettled(promises);
    const successful = results
      .filter((r) => r.status === 'fulfilled')
      .map((r) => r.value);
    const failed = results
      .filter((r) => r.status === 'rejected')
      .map((r) => r.reason);

    if (failed.length > 0) {
      throw frysError.system(
        `Parallel execution failed: ${failed.length} of ${results.length} tasks failed`,
      );
    }

    return successful;
  }
}

class LoopNode extends WorkflowNode {
  constructor(id, loopFunction, config = {}) {
    super(id, 'loop', {
      maxIterations: 100,
      ...config,
    });
    this.loopFunction = loopFunction;
  }

  async run(context, inputs) {
    const results = [];
    let iteration = 0;

    while (iteration < this.config.maxIterations) {
      const shouldContinue = await this.loopFunction(
        context,
        inputs,
        iteration,
        results,
      );

      if (!shouldContinue) break;

      // 执行循环体（这里简化处理，实际可能需要子工作流）
      const result = { iteration, timestamp: new Date() };
      results.push(result);

      iteration++;

      // 防止无限循环
      if (iteration >= this.config.maxIterations) {
        throw frysError.system(
          `Loop exceeded maximum iterations (${this.config.maxIterations})`,
        );
      }
    }

    return results;
  }
}

class WaitNode extends WorkflowNode {
  constructor(id, waitCondition, config = {}) {
    super(id, 'wait', {
      maxWaitTime: 300000, // 5分钟
      checkInterval: 5000, // 5秒检查一次
      ...config,
    });
    this.waitCondition = waitCondition;
  }

  async run(context, inputs) {
    const startTime = Date.now();
    const maxWaitTime = this.config.maxWaitTime;
    const checkInterval = this.config.checkInterval;

    while (Date.now() - startTime < maxWaitTime) {
      const conditionMet = await this.waitCondition(context, inputs);

      if (conditionMet) {
        return { waited: Date.now() - startTime, conditionMet: true };
      }

      await new Promise((resolve) => setTimeout(resolve, checkInterval));
    }

    throw frysError.system(`Wait condition not met within ${maxWaitTime}ms`);
  }
}

/**
 * 🔄 AsyncWorkflowExecutor - 非线性超异步工作流执行器
 */
export class AsyncWorkflowExecutor extends EventEmitter {
  constructor(workflowDefinition = null, config = {}) {
    super();

    // 支持两种调用方式：new AsyncWorkflowExecutor(definition, config) 或 new AsyncWorkflowExecutor(config)
    if (
      workflowDefinition &&
      typeof workflowDefinition === 'object' &&
      !workflowDefinition.nodes &&
      !workflowDefinition.connections
    ) {
      // 如果第一个参数看起来像配置对象，则交换参数
      config = workflowDefinition;
      workflowDefinition = null;
    }

    this.definition = workflowDefinition;
    this.config = {
      maxParallelTasks: 5,
      enableTracing: false,
      defaultTimeout: 30000,
      ...config,
    };

    this.nodes = new Map();
    this.nodeStates = new Map(); // 节点状态映射
    this.nodeConnections = new Map(); // 节点连接映射
    this.executionId = `wf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.state = 'created'; // created, running, completed, failed, cancelled
    this.context = {};
    this.completedNodes = new Set();
    this.runningNodes = new Set();
    this.failedNodes = new Set();

    this.stats = {
      startedAt: null,
      completedAt: null,
      duration: 0,
      totalNodes: 0,
      completedNodes: 0,
      failedNodes: 0,
      skippedNodes: 0,
    };

    // 只有在有definition时才构建工作流
    if (this.definition) {
      this.buildWorkflow();
    }
  }

  /**
   * 初始化工作流执行器
   */
  initialize() {
    // 初始化逻辑（如果需要）
    logger.debug(`AsyncWorkflowExecutor initialized: ${this.executionId}`);
  }

  /**
   * 设置工作流定义并构建工作流
   */
  setWorkflowDefinition(definition) {
    this.definition = definition;
    if (this.definition) {
      this.buildWorkflow();
    }
  }

  buildWorkflow() {
    if (!this.definition) {
      throw new frysError('工作流定义未设置', 'VALIDATION_ERROR');
    }

    const { nodes: nodeDefinitions, connections } = this.definition;

    // 创建节点实例
    for (const [nodeId, nodeDef] of Object.entries(nodeDefinitions)) {
      const node = this.createNode(nodeId, nodeDef);
      this.nodes.set(nodeId, node);
    }

    // 建立依赖关系
    for (const connection of connections || []) {
      const { from, to } = connection;
      if (this.nodes.has(to)) {
        this.nodes.get(to).addDependency(from);
      }
    }

    this.stats.totalNodes = this.nodes.size;
    logger.info(
      `Workflow ${this.executionId} built with ${this.stats.totalNodes} nodes`,
    );
  }

  createNode(nodeId, nodeDef) {
    switch (nodeDef.type) {
      case 'task':
        return new TaskNode(nodeId, nodeDef.taskFunction, nodeDef.config);
      case 'condition':
        return new ConditionNode(
          nodeId,
          nodeDef.conditionFunction,
          nodeDef.config,
        );
      case 'parallel':
        return new ParallelNode(nodeId, nodeDef.subWorkflows, nodeDef.config);
      case 'loop':
        return new LoopNode(nodeId, nodeDef.loopFunction, nodeDef.config);
      case 'wait':
        return new WaitNode(nodeId, nodeDef.waitCondition, nodeDef.config);
      default:
        throw frysError.validation(`Unknown node type: ${nodeDef.type}`);
    }
  }

  async execute(initialContext = {}, inputs = {}) {
    if (this.state !== 'created') {
      throw frysError.conflict(
        `Workflow ${this.executionId} is already ${this.state}`,
      );
    }

    this.state = 'running';
    this.stats.startedAt = new Date();
    this.context = { ...initialContext };

    this.emit('workflow:started', {
      executionId: this.executionId,
      nodeCount: this.stats.totalNodes,
      startedAt: this.stats.startedAt,
    });

    try {
      await this.executeWorkflow(inputs);
      this.state = 'completed';
      this.stats.completedAt = new Date();
      this.stats.duration = this.stats.completedAt - this.stats.startedAt;

      this.emit('workflow:completed', {
        executionId: this.executionId,
        stats: this.stats,
        context: this.context,
      });

      return {
        success: true,
        executionId: this.executionId,
        result: this.context.result,
        stats: this.stats,
      };
    } catch (error) {
      this.state = 'failed';
      this.stats.completedAt = new Date();
      this.stats.duration = this.stats.completedAt - this.stats.startedAt;

      this.emit('workflow:failed', {
        executionId: this.executionId,
        error: error.message,
        stats: this.stats,
      });

      throw error;
    }
  }

  async executeWorkflow(inputs) {
    const pendingNodes = new Set(this.nodes.keys());
    const readyQueue = this.initializeReadyQueue();

    await this.executeWorkflowLoop(pendingNodes, readyQueue, inputs);
    this.checkWorkflowCompletion();
    const outputs = this.collectOutputs();

    this.finalizeWorkflow(outputs);

    return {
      success: true,
      executionId: this.executionId,
      outputs,
      stats: this.stats,
    };
  }

  initializeReadyQueue() {
    const readyQueue = [];
    for (const [nodeId, node] of this.nodes) {
      if (node.dependencies.size === 0) {
        readyQueue.push(nodeId);
      }
    }
    return readyQueue;
  }

  async executeWorkflowLoop(pendingNodes, readyQueue, inputs) {
    while (readyQueue.length > 0 || this.runningNodes.size > 0) {
      this.startReadyNodes(pendingNodes, readyQueue, inputs);

      if (this.runningNodes.size > 0) {
        await this.waitForAnyNodeCompletion();
      }

      this.updateReadyQueue(pendingNodes, readyQueue);
    }
  }

  startReadyNodes(pendingNodes, readyQueue, inputs) {
    while (readyQueue.length > 0) {
      const nodeId = readyQueue.shift();
      if (!pendingNodes.has(nodeId) || this.completedNodes.has(nodeId))
        continue;
      this.executeNodeAsync(nodeId, inputs);
    }
  }

  updateReadyQueue(pendingNodes, readyQueue) {
    for (const nodeId of pendingNodes) {
      if (!this.runningNodes.has(nodeId) && !this.completedNodes.has(nodeId)) {
        const node = this.nodes.get(nodeId);
        if (node.canExecute(this.completedNodes)) {
          readyQueue.push(nodeId);
        }
      }
    }
  }

  checkWorkflowCompletion() {
    if (this.completedNodes.size !== this.nodes.size) {
      const failedNodes = Array.from(this.failedNodes);
      throw frysError.system(
        `Workflow incomplete: ${failedNodes.length} nodes failed: ${failedNodes.join(', ')}`,
      );
    }
  }

  collectOutputs() {
    const outputs = {};
    for (const [nodeId, node] of this.nodes) {
      if (node.outputs && node.outputs.has('result')) {
        outputs[nodeId] = node.outputs.get('result');
      }
    }
    return outputs;
  }

  finalizeWorkflow(outputs) {
    this.stats.completedAt = new Date();
    this.stats.duration = this.stats.completedAt - this.stats.startedAt;
    this.state = 'completed';

    this.emit('completed', {
      executionId: this.executionId,
      duration: this.stats.duration,
      outputs,
    });
  }

  async executeNodeAsync(nodeId, inputs) {
    const node = this.nodes.get(nodeId);
    this.runningNodes.add(nodeId);

    this.emit('node:started', {
      executionId: this.executionId,
      nodeId,
      type: node.type,
    });

    try {
      const result = await node.execute(this.context, inputs);

      // 处理条件分支
      if (node.type === 'condition') {
        const branches = this.getConditionalBranches(nodeId, result);
        for (const branch of branches) {
          // 动态添加依赖关系或跳过节点
          this.handleConditionalBranch(nodeId, branch, result);
        }
      }

      this.completedNodes.add(nodeId);
      this.stats.completedNodes++;

      this.emit('node:completed', {
        executionId: this.executionId,
        nodeId,
        result,
        duration: node.completedAt - node.startedAt,
      });
    } catch (error) {
      // 处理重试逻辑
      if (
        node.state === 'pending' &&
        node.attempts < node.config.retryAttempts
      ) {
        // 重试：延迟后重新加入队列
        setTimeout(() => {
          this.runningNodes.delete(nodeId);
          // 重试逻辑会由execute方法处理
        }, node.config.retryDelay);
        return;
      }

      // 永久失败
      this.failedNodes.add(nodeId);
      this.stats.failedNodes++;

      this.emit('node:failed', {
        executionId: this.executionId,
        nodeId,
        error: error.message,
        attempts: node.attempts,
      });

      // 对于非关键节点，继续执行；对于关键节点，中止工作流
      if (this.isCriticalNode(nodeId)) {
        throw error;
      }
    } finally {
      this.runningNodes.delete(nodeId);
    }
  }

  waitForAnyNodeCompletion() {
    return new Promise((resolve) => {
      const checkCompletion = () => {
        if (
          this.runningNodes.size === 0 ||
          this.completedNodes.size + this.failedNodes.size === this.nodes.size
        ) {
          resolve();
        } else {
          setTimeout(checkCompletion, 100);
        }
      };
      checkCompletion();
    });
  }

  getConditionalBranches(nodeId, conditionResult) {
    // 从工作流定义中查找条件分支
    const branches = [];
    for (const connection of this.definition.connections || []) {
      if (connection.from === nodeId && connection.condition !== undefined) {
        if (connection.condition === conditionResult) {
          branches.push(connection);
        }
      }
    }
    return branches;
  }

  handleConditionalBranch(conditionNodeId, branch, conditionResult) {
    // 处理条件分支逻辑
    const targetNode = this.nodes.get(branch.to);
    if (!targetNode) return;

    if (conditionResult) {
      // 条件满足，启用目标节点
      // 可以在这里动态修改依赖关系
    } else {
      // 条件不满足，跳过目标节点
      targetNode.state = 'skipped';
      this.stats.skippedNodes++;
    }
  }

  isCriticalNode(nodeId) {
    // 判断节点是否为关键节点（没有替代路径）
    // 简化实现：检查是否有其他路径可以到达结束节点
    const endNodes = Array.from(this.nodes.values())
      .filter((node) => node.type === 'end')
      .map((node) => node.id);

    if (endNodes.length === 0) return false;

    // 简单的关键路径检查（可扩展为更复杂的算法）
    return endNodes.some((endId) =>
      this.hasPathToEnd(nodeId, endId, new Set()),
    );
  }

  hasPathToEnd(fromId, endId, visited) {
    if (visited.has(fromId)) return false;
    visited.add(fromId);

    // 查找从fromId到endId的路径
    for (const connection of this.definition.connections || []) {
      if (connection.from === fromId) {
        if (connection.to === endId) return true;
        if (this.hasPathToEnd(connection.to, endId, new Set(visited)))
          return true;
      }
    }

    return false;
  }

  async cancel() {
    if (this.state !== 'running') return;

    this.state = 'cancelled';

    // 取消所有正在运行的节点
    for (const nodeId of this.runningNodes) {
      const node = this.nodes.get(nodeId);
      if (node && typeof node.cancel === 'function') {
        await node.cancel();
      }
    }

    this.emit('workflow:cancelled', {
      executionId: this.executionId,
      reason: 'User cancelled',
    });

    logger.info(`Workflow ${this.executionId} cancelled`);
  }

  getStatus() {
    return {
      executionId: this.executionId,
      state: this.state,
      stats: this.stats,
      nodes: Array.from(this.nodes.entries()).map(([id, node]) => ({
        id,
        type: node.type,
        state: node.state,
        attempts: node.attempts,
        startedAt: node.startedAt,
        completedAt: node.completedAt,
        error: node.error?.message,
      })),
    };
  }

  // 静态方法：创建常见工作流模式
  static createSequentialWorkflow(tasks) {
    const nodes = {};
    const connections = [];

    tasks.forEach((task, index) => {
      const nodeId = `task_${index}`;
      nodes[nodeId] = {
        type: 'task',
        taskFunction: task,
      };

      if (index > 0) {
        connections.push({
          from: `task_${index - 1}`,
          to: nodeId,
        });
      }
    });

    return { nodes, connections };
  }

  static createParallelWorkflow(tasks) {
    const nodes = {
      parallel: {
        type: 'parallel',
        subWorkflows: tasks.map((task) => ({
          nodes: {
            task: { type: 'task', taskFunction: task },
          },
          connections: [],
        })),
      },
    };

    return { nodes, connections: [] };
  }

  static createConditionalWorkflow(condition, trueTask, falseTask) {
    const nodes = {
      condition: {
        type: 'condition',
        conditionFunction: condition,
      },
      trueTask: {
        type: 'task',
        taskFunction: trueTask,
      },
      falseTask: {
        type: 'task',
        taskFunction: falseTask,
      },
    };

    const connections = [
      { from: 'condition', to: 'trueTask', condition: true },
      { from: 'condition', to: 'falseTask', condition: false },
    ];

    return { nodes, connections };
  }

  /**
   * 关闭工作流执行器，清理资源
   */
  shutdown() {
    try {
      // 停止所有正在执行的工作流
      if (this.executionTimeout) {
        clearTimeout(this.executionTimeout);
        this.executionTimeout = null;
      }

      // 清理节点状态
      this.nodes.clear();
      this.nodeStates.clear();

      // 清理连接
      this.nodeConnections.clear();

      logger.info('AsyncWorkflowExecutor shut down successfully');
    } catch (error) {
      logger.error('Error during AsyncWorkflowExecutor shutdown:', error);
      throw error;
    }
  }
}

export default AsyncWorkflowExecutor;
