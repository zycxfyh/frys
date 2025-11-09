/**
 * frys Production - 工作流引擎服务
 */

import messagingAdapter from '../../core/MessagingAdapter.js';
import { config } from '../../shared/utils/config.js';
import { logger } from '../../shared/utils/logger.js';

export class WorkflowEngine {
  constructor({ http, messaging, state, date, utils }) {
    this.http = http;
    this.messaging = messaging;
    this.state = state;
    this.date = date;
    this.utils = utils;

    this.workflows = new Map();
    this.runningWorkflows = new Set();
  }

  async start() {
    logger.info('启动工作流引擎');

    // 订阅工作流相关事件
    await this.setupEventListeners();

    // 恢复未完成的工作流
    await this.recoverWorkflows();

    logger.info('工作流引擎启动完成');
  }

  async stop() {
    logger.info('停止工作流引擎');

    // 暂停所有运行中的工作流
    for (const workflowId of this.runningWorkflows) {
      await this.pauseWorkflow(workflowId);
    }

    // 保存工作流状态
    await this.persistWorkflows();

    logger.info('工作流引擎已停止');
  }

  async setupEventListeners() {
    // 监听工作流控制事件
    this.messaging.subscribe('workflow.start', async (event) => {
      await this.startWorkflow(event.workflowId, event.params);
    });

    this.messaging.subscribe('workflow.pause', async (event) => {
      await this.pauseWorkflow(event.workflowId);
    });

    this.messaging.subscribe('workflow.resume', async (event) => {
      await this.resumeWorkflow(event.workflowId);
    });

    this.messaging.subscribe('workflow.cancel', async (event) => {
      await this.cancelWorkflow(event.workflowId);
    });

    // 监听任务事件
    this.messaging.subscribe('task.completed', async (event) => {
      await this.onTaskCompleted(event.taskId, event.result);
    });

    this.messaging.subscribe('task.failed', async (event) => {
      await this.onTaskFailed(event.taskId, event.error);
    });
  }

  async createWorkflow(definition) {
    const workflowId = this.utils.generateId('wf');
    const workflow = {
      id: workflowId,
      name: definition.name,
      description: definition.description,
      status: 'created',
      tasks: definition.tasks || [],
      createdAt: this.date.now(),
      updatedAt: this.date.now(),
      metadata: definition.metadata || {},
    };

    // 保存到状态管理
    this.state.setState((state) => ({
      workflows: new Map(state.workflows).set(workflowId, workflow),
    }));

    this.workflows.set(workflowId, workflow);

    logger.info('工作流创建成功', { workflowId, name: workflow.name });

    // 发布事件
    await this.messaging.publish('workflow.created', {
      workflowId,
      workflow,
    });

    return workflowId;
  }

  async startWorkflow(workflowId, params = {}) {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`工作流不存在: ${workflowId}`);
    }

    if (workflow.status !== 'created' && workflow.status !== 'paused') {
      throw new Error(`工作流状态不允许启动: ${workflow.status}`);
    }

    // 更新状态
    workflow.status = 'running';
    workflow.startedAt = this.date.now();
    workflow.params = params;
    workflow.updatedAt = this.date.now();

    this.runningWorkflows.add(workflowId);
    this.updateWorkflowState(workflowId, workflow);

    logger.info('工作流启动', { workflowId, name: workflow.name });

    // 发布事件
    await this.messaging.publish('workflow.started', {
      workflowId,
      workflow,
    });

    // 开始执行任务
    await this.executeWorkflowTasks(workflowId);
  }

  async pauseWorkflow(workflowId) {
    const workflow = this.workflows.get(workflowId);
    if (!workflow || workflow.status !== 'running') {
      return;
    }

    workflow.status = 'paused';
    workflow.updatedAt = this.date.now();

    this.runningWorkflows.delete(workflowId);
    this.updateWorkflowState(workflowId, workflow);

    logger.info('工作流暂停', { workflowId });

    await this.messaging.publish('workflow.paused', { workflowId });
  }

  async resumeWorkflow(workflowId) {
    const workflow = this.workflows.get(workflowId);
    if (!workflow || workflow.status !== 'paused') {
      return;
    }

    workflow.status = 'running';
    workflow.updatedAt = this.date.now();

    this.runningWorkflows.add(workflowId);
    this.updateWorkflowState(workflowId, workflow);

    logger.info('工作流恢复', { workflowId });

    await this.messaging.publish('workflow.resumed', { workflowId });

    // 继续执行任务
    await this.executeWorkflowTasks(workflowId);
  }

  async cancelWorkflow(workflowId) {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      return;
    }

    workflow.status = 'cancelled';
    workflow.cancelledAt = this.date.now();
    workflow.updatedAt = this.date.now();

    this.runningWorkflows.delete(workflowId);
    this.updateWorkflowState(workflowId, workflow);

    logger.info('工作流取消', { workflowId });

    await this.messaging.publish('workflow.cancelled', { workflowId });
  }

  async executeWorkflowTasks(workflowId) {
    const workflow = this.workflows.get(workflowId);
    if (!workflow || workflow.status !== 'running') {
      return;
    }

    // 找到下一个待执行的任务
    const nextTask = this.findNextTask(workflow);
    if (!nextTask) {
      // 所有任务完成
      await this.completeWorkflow(workflowId);
      return;
    }

    // 执行任务
    await this.executeTask(workflowId, nextTask);
  }

  findNextTask(workflow) {
    return workflow.tasks.find(
      (task) =>
        task.status === 'pending' && this.checkTaskDependencies(task, workflow),
    );
  }

  checkTaskDependencies(task, workflow) {
    if (!task.dependencies || task.dependencies.length === 0) {
      return true;
    }

    return task.dependencies.every((depId) => {
      const depTask = workflow.tasks.find((t) => t.id === depId);
      return depTask && depTask.status === 'completed';
    });
  }

  async executeTask(workflowId, task) {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return;

    // 更新任务状态
    task.status = 'running';
    task.startedAt = this.date.now();
    workflow.updatedAt = this.date.now();

    this.updateWorkflowState(workflowId, workflow);

    logger.info('任务开始执行', {
      workflowId,
      taskId: task.id,
      name: task.name,
    });

    try {
      // 执行任务逻辑
      const result = await this.runTask(task, workflow);

      // 任务成功
      task.status = 'completed';
      task.completedAt = this.date.now();
      task.result = result;

      logger.info('任务执行成功', { workflowId, taskId: task.id });

      await this.messaging.publish('task.completed', {
        workflowId,
        taskId: task.id,
        result,
      });
    } catch (error) {
      // 任务失败
      task.status = 'failed';
      task.failedAt = this.date.now();
      task.error = error.message;

      logger.error('任务执行失败', error, { workflowId, taskId: task.id });

      await this.messaging.publish('task.failed', {
        workflowId,
        taskId: task.id,
        error: error.message,
      });

      // 检查是否需要重试
      if (this.shouldRetryTask(task)) {
        await this.retryTask(workflowId, task);
      } else {
        // 工作流失败
        await this.failWorkflow(workflowId, error);
      }
      return;
    }

    // 继续执行下一个任务
    setTimeout(() => {
      this.executeWorkflowTasks(workflowId);
    }, 100); // 短暂延迟，避免递归过深
  }

  async runTask(task, workflow) {
    // 这里实现具体的任务执行逻辑
    switch (task.type) {
      case 'http':
        return await this.http[task.method](task.url, task.data);

      case 'script':
        return await this.executeScript(task.script, workflow);

      case 'delay':
        return await this.delay(task.duration);

      case 'condition':
        return this.evaluateCondition(task.condition, workflow);

      default:
        throw new Error(`未知任务类型: ${task.type}`);
    }
  }

  async executeScript(script, context) {
    // 在受控环境中执行脚本
    const func = new Function('context', 'utils', 'date', `return (${script})`);
    return await func(context, this.utils, this.date);
  }

  delay(duration) {
    return new Promise((resolve) => setTimeout(resolve, duration));
  }

  evaluateCondition(condition, workflow) {
    // 简单的条件评估
    const func = new Function('workflow', 'utils', `return ${condition}`);
    return func(workflow, this.utils);
  }

  shouldRetryTask(task) {
    return task.retryCount < (task.maxRetries || config.workflow.retryAttempts);
  }

  async retryTask(workflowId, task) {
    task.retryCount = (task.retryCount || 0) + 1;
    task.status = 'pending';
    task.nextRetryAt =
      this.date.now() + (task.retryDelay || config.workflow.retryDelay);

    const workflow = this.workflows.get(workflowId);
    workflow.updatedAt = this.date.now();

    this.updateWorkflowState(workflowId, workflow);

    logger.info('任务重试计划', {
      workflowId,
      taskId: task.id,
      retryCount: task.retryCount,
      nextRetryAt: task.nextRetryAt,
    });

    // 延迟后重试
    setTimeout(() => {
      this.executeTask(workflowId, task);
    }, task.retryDelay || config.workflow.retryDelay);
  }

  async completeWorkflow(workflowId) {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return;

    workflow.status = 'completed';
    workflow.completedAt = this.date.now();
    workflow.updatedAt = this.date.now();

    this.runningWorkflows.delete(workflowId);
    this.updateWorkflowState(workflowId, workflow);

    logger.info('工作流完成', { workflowId, name: workflow.name });

    await this.messaging.publish('workflow.completed', {
      workflowId,
      workflow,
    });
  }

  async failWorkflow(workflowId, error) {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return;

    workflow.status = 'failed';
    workflow.failedAt = this.date.now();
    workflow.error = error.message;
    workflow.updatedAt = this.date.now();

    this.runningWorkflows.delete(workflowId);
    this.updateWorkflowState(workflowId, workflow);

    logger.error('工作流失败', error, { workflowId, name: workflow.name });

    await this.messaging.publish('workflow.failed', {
      workflowId,
      workflow,
      error: error.message,
    });
  }

  async onTaskCompleted(taskId, result) {
    // 处理任务完成事件
    logger.debug('收到任务完成事件', { taskId, result });
  }

  async onTaskFailed(taskId, error) {
    // 处理任务失败事件
    logger.debug('收到任务失败事件', { taskId, error });
  }

  updateWorkflowState(workflowId, workflow) {
    this.state.setState((state) => ({
      workflows: new Map(state.workflows).set(workflowId, { ...workflow }),
    }));
  }

  async recoverWorkflows() {
    // 从持久化存储恢复工作流状态
    logger.info('恢复工作流状态');

    // 这里可以从数据库或文件恢复工作流状态
    // 暂时跳过
  }

  async persistWorkflows() {
    // 保存工作流状态到持久化存储
    logger.info('持久化工作流状态');

    // 这里可以保存到数据库或文件
    // 暂时跳过
  }

  getWorkflow(workflowId) {
    return this.workflows.get(workflowId);
  }

  getAllWorkflows() {
    return Array.from(this.workflows.values());
  }

  getRunningWorkflows() {
    return Array.from(this.runningWorkflows).map((id) =>
      this.workflows.get(id),
    );
  }
}
