/**
 * Core Interfaces - 核心接口定义
 * 定义核心组件的抽象接口，减少模块间的直接依赖
 */

export { IModule } from './IModule.js';

// 工作流相关接口 - JavaScript兼容版本
export class IWorkflowExecutor {
  execute(workflow, context) { throw new Error('Not implemented'); }
  submitTask(task) { throw new Error('Not implemented'); }
  getStatus() { throw new Error('Not implemented'); }
  cancel(workflowId) { throw new Error('Not implemented'); }
}

export class ITaskScheduler {
  schedule(task, delay) { throw new Error('Not implemented'); }
  cancel(taskId) { throw new Error('Not implemented'); }
  getPendingTasks() { throw new Error('Not implemented'); }
}

export class IWorkflowRepository {
  save(workflow) { throw new Error('Not implemented'); }
  findById(id) { throw new Error('Not implemented'); }
  findByStatus(status) { throw new Error('Not implemented'); }
  updateStatus(id, status) { throw new Error('Not implemented'); }
}

// 事件系统接口
export class IEventBus {
  publish(event) { throw new Error('Not implemented'); }
  subscribe(eventType, handler) { throw new Error('Not implemented'); }
  unsubscribe(eventType, handler) { throw new Error('Not implemented'); }
}

export class IEventStore {
  save(event) { throw new Error('Not implemented'); }
  getEvents(aggregateId) { throw new Error('Not implemented'); }
  getEventsByType(eventType) { throw new Error('Not implemented'); }
}

// 缓存接口
export class ICache {
  get(key) { throw new Error('Not implemented'); }
  set(key, value, ttl) { throw new Error('Not implemented'); }
  delete(key) { throw new Error('Not implemented'); }
  clear() { throw new Error('Not implemented'); }
  has(key) { throw new Error('Not implemented'); }
}

export class IDistributedCache extends ICache {
  getFromNode(nodeId, key) { throw new Error('Not implemented'); }
  setToNode(nodeId, key, value, ttl) { throw new Error('Not implemented'); }
  invalidateAcrossNodes(key) { throw new Error('Not implemented'); }
}

// 消息队列接口
export class IMessageQueue {
  publish(queue, message) { throw new Error('Not implemented'); }
  subscribe(queue, handler) { throw new Error('Not implemented'); }
  unsubscribe(queue, handler) { throw new Error('Not implemented'); }
  getQueueInfo(queue) { throw new Error('Not implemented'); }
}

export class IMessageBroker {
  createQueue(name, options) { throw new Error('Not implemented'); }
  deleteQueue(name) { throw new Error('Not implemented'); }
  getQueueStats() { throw new Error('Not implemented'); }
}
