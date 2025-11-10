/**
 * 轻量级工作流引擎 - 核心功能
 * 专注于工作流定义、执行和状态管理
 */

export class WorkflowEngine {
  constructor(options = {}) {
    this.workflows = new Map();
    this.runningWorkflows = new Set();
    this.logger = options.logger || console;
    this.onWorkflowEvent = options.onWorkflowEvent || (() => {});
    this.onTaskEvent = options.onTaskEvent || (() => {});
  }

  /**
   * 创建新工作流
   */
  createWorkflow(definition) {
    if (!definition.name || !definition.tasks || !Array.isArray(definition.tasks)) {
      throw new Error('工作流定义无效：缺少name或tasks');
    }

    const workflowId = this.generateId('wf');
    const workflow = {
      id: workflowId,
      name: definition.name,
      description: definition.description || '',
      status: 'created',
      tasks: definition.tasks.map(task => ({
        id: task.id || this.generateId('task'),
        name: task.name,
        type: task.type,
        config: task.config || {},
        status: 'pending',
        dependencies: task.dependencies || [],
        retryCount: 0,
        maxRetries: task.maxRetries || 3,
        retryDelay: task.retryDelay || 1000,
        createdAt: new Date(),
      })),
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: definition.metadata || {},
    };

    this.workflows.set(workflowId, workflow);
    this.onWorkflowEvent('created', workflow);

    this.logger.info(`工作流创建成功: ${workflow.name} (${workflowId})`);
    return workflowId;
  }

  /**
   * 启动工作流
   */
  async startWorkflow(workflowId, params = {}) {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`工作流不存在: ${workflowId}`);
    }

    if (workflow.status !== 'created' && workflow.status !== 'paused') {
      throw new Error(`工作流状态不允许启动: ${workflow.status}`);
    }

    workflow.status = 'running';
    workflow.startedAt = new Date();
    workflow.params = params;
    workflow.updatedAt = new Date();

    this.runningWorkflows.add(workflowId);
    this.onWorkflowEvent('started', workflow);

    this.logger.info(`工作流启动: ${workflow.name} (${workflowId})`);

    // 开始执行任务
    await this.executeWorkflowTasks(workflowId);
  }

  /**
   * 暂停工作流
   */
  pauseWorkflow(workflowId) {
    const workflow = this.workflows.get(workflowId);
    if (!workflow || workflow.status !== 'running') {
      return;
    }

    workflow.status = 'paused';
    workflow.updatedAt = new Date();
    this.runningWorkflows.delete(workflowId);

    this.onWorkflowEvent('paused', workflow);
    this.logger.info(`工作流暂停: ${workflowId}`);
  }

  /**
   * 恢复工作流
   */
  async resumeWorkflow(workflowId) {
    const workflow = this.workflows.get(workflowId);
    if (!workflow || workflow.status !== 'paused') {
      return;
    }

    workflow.status = 'running';
    workflow.updatedAt = new Date();
    this.runningWorkflows.add(workflowId);

    this.onWorkflowEvent('resumed', workflow);
    this.logger.info(`工作流恢复: ${workflowId}`);

    await this.executeWorkflowTasks(workflowId);
  }

  /**
   * 取消工作流
   */
  cancelWorkflow(workflowId) {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      return;
    }

    workflow.status = 'cancelled';
    workflow.cancelledAt = new Date();
    workflow.updatedAt = new Date();
    this.runningWorkflows.delete(workflowId);

    this.onWorkflowEvent('cancelled', workflow);
    this.logger.info(`工作流取消: ${workflowId}`);
  }

  /**
   * 执行工作流任务
   */
  async executeWorkflowTasks(workflowId) {
    const workflow = this.workflows.get(workflowId);
    if (!workflow || workflow.status !== 'running') {
      return;
    }

    const nextTask = this.findNextTask(workflow);
    if (!nextTask) {
      // 所有任务完成
      await this.completeWorkflow(workflowId);
      return;
    }

    await this.executeTask(workflowId, nextTask);
  }

  /**
   * 查找下一个待执行的任务
   */
  findNextTask(workflow) {
    return workflow.tasks.find(task =>
      task.status === 'pending' && this.checkTaskDependencies(task, workflow)
    );
  }

  /**
   * 检查任务依赖是否满足
   */
  checkTaskDependencies(task, workflow) {
    if (!task.dependencies || task.dependencies.length === 0) {
      return true;
    }

    return task.dependencies.every(depId => {
      const depTask = workflow.tasks.find(t => t.id === depId);
      return depTask && depTask.status === 'completed';
    });
  }

  /**
   * 执行单个任务
   */
  async executeTask(workflowId, task) {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return;

    task.status = 'running';
    task.startedAt = new Date();
    workflow.updatedAt = new Date();

    this.onTaskEvent('started', { workflowId, task });
    this.logger.info(`任务开始执行: ${task.name} (${task.id})`);

    try {
      const result = await this.runTask(task, workflow);

      task.status = 'completed';
      task.completedAt = new Date();
      task.result = result;

      this.onTaskEvent('completed', { workflowId, task, result });
      this.logger.info(`任务执行成功: ${task.id}`);

    } catch (error) {
      task.status = 'failed';
      task.failedAt = new Date();
      task.error = error.message;

      this.onTaskEvent('failed', { workflowId, task, error });
      this.logger.error(`任务执行失败: ${task.id}`, error);

      if (this.shouldRetryTask(task)) {
        await this.retryTask(workflowId, task);
      } else {
        await this.failWorkflow(workflowId, error);
      }
      return;
    }

    // 继续执行下一个任务
    setTimeout(() => {
      this.executeWorkflowTasks(workflowId);
    }, 10);
  }

  /**
   * 执行任务逻辑
   */
  async runTask(task, workflow) {
    switch (task.type) {
      case 'http':
        return await this.runHttpTask(task);

      case 'script':
        return await this.runScriptTask(task, workflow);

      case 'delay':
        return await this.runDelayTask(task);

      case 'condition':
        return this.runConditionTask(task, workflow);

      default:
        throw new Error(`未知任务类型: ${task.type}`);
    }
  }

  /**
   * HTTP任务
   */
  async runHttpTask(task) {
    const { url, method = 'GET', headers = {}, body } = task.config;

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`HTTP请求失败: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * 脚本任务
   */
  async runScriptTask(task, workflow) {
    const { script, context = {} } = task.config;

    // 创建安全的执行环境
    const func = new Function('context', 'workflow', `
      "use strict";
      ${script}
    `);

    return await func({ ...context, workflow }, workflow);
  }

  /**
   * 延迟任务
   */
  runDelayTask(task) {
    const { duration = 1000 } = task.config;
    return new Promise(resolve => setTimeout(resolve, duration));
  }

  /**
   * 条件任务
   */
  runConditionTask(task, workflow) {
    const { condition } = task.config;
    const func = new Function('workflow', `"use strict"; return (${condition});`);
    return func(workflow);
  }

  /**
   * 检查是否应该重试任务
   */
  shouldRetryTask(task) {
    return task.retryCount < task.maxRetries;
  }

  /**
   * 重试任务
   */
  async retryTask(workflowId, task) {
    task.retryCount++;
    task.status = 'pending';
    task.nextRetryAt = new Date(Date.now() + task.retryDelay);

    const workflow = this.workflows.get(workflowId);
    workflow.updatedAt = new Date();

    this.logger.info(`任务重试计划: ${task.id} (第${task.retryCount}次)`);

    setTimeout(() => {
      this.executeTask(workflowId, task);
    }, task.retryDelay);
  }

  /**
   * 完成工作流
   */
  async completeWorkflow(workflowId) {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return;

    workflow.status = 'completed';
    workflow.completedAt = new Date();
    workflow.updatedAt = new Date();

    this.runningWorkflows.delete(workflowId);
    this.onWorkflowEvent('completed', workflow);

    this.logger.info(`工作流完成: ${workflow.name} (${workflowId})`);
  }

  /**
   * 失败工作流
   */
  async failWorkflow(workflowId, error) {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return;

    workflow.status = 'failed';
    workflow.failedAt = new Date();
    workflow.error = error.message;
    workflow.updatedAt = new Date();

    this.runningWorkflows.delete(workflowId);
    this.onWorkflowEvent('failed', { workflow, error });

    this.logger.error(`工作流失败: ${workflow.name} (${workflowId})`, error);
  }

  /**
   * 获取工作流
   */
  getWorkflow(workflowId) {
    return this.workflows.get(workflowId);
  }

  /**
   * 获取所有工作流
   */
  getAllWorkflows() {
    return Array.from(this.workflows.values());
  }

  /**
   * 获取运行中的工作流
   */
  getRunningWorkflows() {
    return Array.from(this.runningWorkflows)
      .map(id => this.workflows.get(id))
      .filter(Boolean);
  }

  /**
   * 生成唯一ID
   */
  generateId(prefix = '') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
