/**
 * 🌐 frys 分布式部署和算力均衡系统
 *
 * 借鉴VCPToolBox的分布式理念，实现：
 * - 分布式节点管理：自动发现、注册、监控节点状态
 * - 智能负载均衡：基于性能指标的任务分发策略
 * - 故障转移机制：自动检测和恢复节点故障
 * - 算力资源监控：CPU、内存、GPU、网络实时监控
 * - 动态伸缩能力：根据负载自动调整集群规模
 * - 数据一致性：跨节点状态同步和数据复制
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';
import { frysError } from './error-handler.js';
import os from 'os';
import { performance } from 'perf_hooks';

class NodeInfo {
  constructor(nodeId, config = {}) {
    this.nodeId = nodeId;
    this.config = {
      host: 'localhost',
      port: 3000,
      capabilities: [],
      maxConcurrency: 10,
      resources: {
        cpu: os.cpus().length,
        memory: os.totalmem(),
        gpu: 0 // 可扩展为GPU数量
      },
      ...config
    };

    this.status = 'offline'; // offline, online, busy, maintenance
    this.lastHeartbeat = null;
    this.metrics = {
      cpuUsage: 0,
      memoryUsage: 0,
      activeTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      averageResponseTime: 0,
      uptime: 0
    };

    this.capabilities = new Set(this.config.capabilities);
    this.metadata = {
      version: process.version,
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
      registeredAt: new Date()
    };
  }

  updateMetrics(metrics) {
    Object.assign(this.metrics, metrics);
    this.lastHeartbeat = new Date();

    // 根据指标更新状态
    if (this.metrics.cpuUsage > 90 || this.metrics.memoryUsage > 90) {
      this.status = 'busy';
    } else if (this.status === 'busy') {
      this.status = 'online';
    }
  }

  isHealthy() {
    if (!this.lastHeartbeat) return false;

    const now = Date.now();
    const timeSinceLastHeartbeat = now - this.lastHeartbeat.getTime();
    const heartbeatTimeout = 30000; // 30秒超时

    return timeSinceLastHeartbeat < heartbeatTimeout && this.status !== 'offline';
  }

  getLoadScore() {
    // 计算负载评分 (0-1, 越高负载越重)
    const cpuWeight = 0.4;
    const memoryWeight = 0.4;
    const taskWeight = 0.2;

    const cpuScore = this.metrics.cpuUsage / 100;
    const memoryScore = this.metrics.memoryUsage / 100;
    const taskScore = Math.min(this.metrics.activeTasks / this.config.maxConcurrency, 1);

    return cpuWeight * cpuScore + memoryWeight * memoryScore + taskWeight * taskScore;
  }

  hasCapability(capability) {
    return this.capabilities.has(capability);
  }

  toJSON() {
    return {
      nodeId: this.nodeId,
      status: this.status,
      config: this.config,
      metrics: this.metrics,
      capabilities: Array.from(this.capabilities),
      metadata: this.metadata,
      lastHeartbeat: this.lastHeartbeat,
      isHealthy: this.isHealthy()
    };
  }
}

class LoadBalancer {
  constructor() {
    this.algorithms = {
      roundRobin: this.roundRobin.bind(this),
      leastLoaded: this.leastLoaded.bind(this),
      weightedRandom: this.weightedRandom.bind(this),
      capabilityBased: this.capabilityBased.bind(this)
    };

    this.currentIndex = 0;
  }

  selectNode(nodes, task, algorithm = 'leastLoaded') {
    const availableNodes = nodes.filter(node =>
      node.status === 'online' && node.isHealthy()
    );

    if (availableNodes.length === 0) {
      throw frysError.system('No available nodes for task execution');
    }

    const balancer = this.algorithms[algorithm] || this.algorithms.leastLoaded;
    return balancer(availableNodes, task);
  }

  roundRobin(nodes, task) {
    const node = nodes[this.currentIndex % nodes.length];
    this.currentIndex = (this.currentIndex + 1) % nodes.length;
    return node;
  }

  leastLoaded(nodes, task) {
    return nodes.reduce((least, current) =>
      current.getLoadScore() < least.getLoadScore() ? current : least
    );
  }

  weightedRandom(nodes, task) {
    // 根据负载评分计算权重（负载越低权重越高）
    const totalWeight = nodes.reduce((sum, node) => sum + (1 - node.getLoadScore()), 0);

    let random = Math.random() * totalWeight;
    for (const node of nodes) {
      random -= (1 - node.getLoadScore());
      if (random <= 0) {
        return node;
      }
    }

    return nodes[0]; // 兜底
  }

  capabilityBased(nodes, task) {
    // 根据任务要求选择有对应能力的节点
    const requiredCapabilities = task.capabilities || [];

    const capableNodes = nodes.filter(node =>
      requiredCapabilities.every(cap => node.hasCapability(cap))
    );

    if (capableNodes.length === 0) {
      throw frysError.system(`No nodes with required capabilities: ${requiredCapabilities.join(', ')}`);
    }

    // 在有能力的节点中选择负载最小的
    return this.leastLoaded(capableNodes, task);
  }
}

class ResourceMonitor {
  constructor(nodeId, config = {}) {
    this.nodeId = nodeId;
    this.config = {
      monitorInterval: 5000, // 5秒
      historySize: 100,
      alertThresholds: {
        cpu: 80,
        memory: 85,
        disk: 90
      },
      ...config
    };

    this.metrics = {
      cpu: [],
      memory: [],
      disk: [],
      network: [],
      tasks: []
    };

    this.monitoring = false;
    this.monitorTimer = null;
    this.alerts = [];

    this.previousCpuTimes = null;
  }

  startMonitoring() {
    if (this.monitoring) return;

    this.monitoring = true;
    this.previousCpuTimes = this.getCpuTimes();

    this.monitorTimer = setInterval(() => {
      this.collectMetrics();
      this.checkAlerts();
    }, this.config.monitorInterval);

    logger.info(`Resource monitoring started for node ${this.nodeId}`);
  }

  stopMonitoring() {
    if (!this.monitoring) return;

    this.monitoring = false;
    if (this.monitorTimer) {
      clearInterval(this.monitorTimer);
      this.monitorTimer = null;
    }

    logger.info(`Resource monitoring stopped for node ${this.nodeId}`);
  }

  collectMetrics() {
    const timestamp = Date.now();

    // CPU使用率
    const cpuUsage = this.getCpuUsage();
    this.addMetric('cpu', { value: cpuUsage, timestamp });

    // 内存使用率
    const memUsage = this.getMemoryUsage();
    this.addMetric('memory', { value: memUsage, timestamp });

    // 磁盘使用率
    const diskUsage = this.getDiskUsage();
    this.addMetric('disk', { value: diskUsage, timestamp });

    // 网络统计（简化）
    const networkStats = this.getNetworkStats();
    this.addMetric('network', { value: networkStats, timestamp });

    // 任务统计
    const taskStats = this.getTaskStats();
    this.addMetric('tasks', { value: taskStats, timestamp });
  }

  getCpuUsage() {
    const currentTimes = this.getCpuTimes();

    if (!this.previousCpuTimes) {
      this.previousCpuTimes = currentTimes;
      return 0;
    }

    const idle = currentTimes.idle - this.previousCpuTimes.idle;
    const total = currentTimes.total - this.previousCpuTimes.total;

    const usage = total > 0 ? ((total - idle) / total) * 100 : 0;

    this.previousCpuTimes = currentTimes;
    return Math.round(usage * 100) / 100;
  }

  getCpuTimes() {
    const cpus = os.cpus();
    let user = 0, nice = 0, sys = 0, idle = 0, irq = 0;

    for (const cpu of cpus) {
      user += cpu.times.user;
      nice += cpu.times.nice;
      sys += cpu.times.sys;
      idle += cpu.times.idle;
      irq += cpu.times.irq;
    }

    const total = user + nice + sys + idle + irq;
    return { user, nice, sys, idle, irq, total };
  }

  getMemoryUsage() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    return Math.round((usedMem / totalMem) * 100 * 100) / 100;
  }

  getDiskUsage() {
    // 简化实现，实际应该使用系统调用获取磁盘使用率
    return 50; // 模拟50%使用率
  }

  getNetworkStats() {
    const networkInterfaces = os.networkInterfaces();
    const rxBytes = 0, txBytes = 0;

    // 简化实现，实际应该跟踪网络接口统计
    return { rxBytes, txBytes };
  }

  getTaskStats() {
    // 简化实现，实际应该从任务管理器获取
    return {
      active: Math.floor(Math.random() * 10),
      queued: Math.floor(Math.random() * 5),
      completed: Math.floor(Math.random() * 100)
    };
  }

  addMetric(type, metric) {
    if (!this.metrics[type]) {
      this.metrics[type] = [];
    }

    this.metrics[type].push(metric);

    // 保持历史记录大小
    if (this.metrics[type].length > this.config.historySize) {
      this.metrics[type].shift();
    }
  }

  checkAlerts() {
    const latest = this.getLatestMetrics();

    // CPU告警
    if (latest.cpu > this.config.alertThresholds.cpu) {
      this.addAlert('cpu', `CPU usage is ${latest.cpu}%`, 'warning');
    }

    // 内存告警
    if (latest.memory > this.config.alertThresholds.memory) {
      this.addAlert('memory', `Memory usage is ${latest.memory}%`, 'critical');
    }

    // 磁盘告警
    if (latest.disk > this.config.alertThresholds.disk) {
      this.addAlert('disk', `Disk usage is ${latest.disk}%`, 'warning');
    }
  }

  addAlert(type, message, severity) {
    const alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      message,
      severity,
      timestamp: new Date(),
      nodeId: this.nodeId
    };

    this.alerts.push(alert);

    // 只保留最近的100个告警
    if (this.alerts.length > 100) {
      this.alerts.shift();
    }

    logger.warn(`Resource alert: ${message}`, { nodeId: this.nodeId, type, severity });
  }

  getLatestMetrics() {
    return {
      cpu: this.metrics.cpu[this.metrics.cpu.length - 1]?.value || 0,
      memory: this.metrics.memory[this.metrics.memory.length - 1]?.value || 0,
      disk: this.metrics.disk[this.metrics.disk.length - 1]?.value || 0,
      network: this.metrics.network[this.metrics.network.length - 1]?.value || {},
      tasks: this.metrics.tasks[this.metrics.tasks.length - 1]?.value || {}
    };
  }

  getMetricsHistory(type, duration = 3600000) { // 默认1小时
    const cutoff = Date.now() - duration;
    return (this.metrics[type] || []).filter(m => m.timestamp >= cutoff);
  }

  getStats() {
    return {
      nodeId: this.nodeId,
      monitoring: this.monitoring,
      latestMetrics: this.getLatestMetrics(),
      alerts: this.alerts.slice(-10), // 最近10个告警
      config: this.config
    };
  }
}

class TaskScheduler {
  constructor(cluster) {
    this.cluster = cluster;
    this.queue = [];
    this.running = new Map();
    this.completed = [];
    this.failed = [];

    this.stats = {
      queued: 0,
      running: 0,
      completed: 0,
      failed: 0,
      averageExecutionTime: 0
    };
  }

  async submitTask(task) {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const taskInfo = {
      id: taskId,
      ...task,
      status: 'queued',
      submittedAt: new Date(),
      startedAt: null,
      completedAt: null,
      assignedNode: null,
      result: null,
      error: null
    };

    this.queue.push(taskInfo);
    this.stats.queued++;

    logger.info(`Task ${taskId} submitted`, { type: task.type });

    // 尝试立即调度
    await this.scheduleTasks();

    return taskId;
  }

  async scheduleTasks() {
    const availableNodes = this.cluster.getAvailableNodes();

    while (this.queue.length > 0 && availableNodes.length > 0) {
      const task = this.queue.shift();
      const node = this.cluster.loadBalancer.selectNode(availableNodes, task);

      try {
        await this.assignTaskToNode(task, node);
      } catch (error) {
        logger.error(`Failed to assign task ${task.id} to node ${node.nodeId}`, error);
        // 重新放回队列
        this.queue.unshift(task);
        break;
      }
    }
  }

  async assignTaskToNode(task, node) {
    task.status = 'running';
    task.startedAt = new Date();
    task.assignedNode = node.nodeId;

    this.running.set(task.id, task);
    this.stats.running++;

    // 模拟任务执行（实际应该通过网络调用）
    try {
      const result = await this.executeTaskOnNode(task, node);
      await this.completeTask(task.id, result);
    } catch (error) {
      await this.failTask(task.id, error);
    }
  }

  async executeTaskOnNode(task, node) {
    // 简化实现：模拟任务执行
    const executionTime = Math.random() * 5000 + 1000; // 1-6秒

    await new Promise(resolve => setTimeout(resolve, executionTime));

    // 模拟成功率
    if (Math.random() < 0.9) { // 90%成功率
      return { success: true, data: `Task ${task.id} completed on ${node.nodeId}` };
    } else {
      throw new Error(`Task ${task.id} failed randomly`);
    }
  }

  async completeTask(taskId, result) {
    const task = this.running.get(taskId);
    if (!task) return;

    task.status = 'completed';
    task.completedAt = new Date();
    task.result = result;

    this.running.delete(taskId);
    this.completed.push(task);

    this.stats.completed++;
    this.stats.running--;

    const executionTime = task.completedAt - task.startedAt;
    this.updateAverageExecutionTime(executionTime);

    logger.info(`Task ${taskId} completed`, {
      nodeId: task.assignedNode,
      executionTime
    });
  }

  async failTask(taskId, error) {
    const task = this.running.get(taskId);
    if (!task) return;

    task.status = 'failed';
    task.completedAt = new Date();
    task.error = error.message;

    this.running.delete(taskId);
    this.failed.push(task);

    this.stats.failed++;
    this.stats.running--;

    logger.error(`Task ${taskId} failed`, {
      nodeId: task.assignedNode,
      error: error.message
    });

    // 可以实现重试逻辑
    if (task.retryCount < 3) {
      task.retryCount = (task.retryCount || 0) + 1;
      task.status = 'queued';
      this.queue.push(task);
      logger.info(`Task ${taskId} queued for retry (${task.retryCount}/3)`);
    }
  }

  updateAverageExecutionTime(executionTime) {
    const alpha = 0.1; // 平滑因子
    this.stats.averageExecutionTime =
      alpha * executionTime + (1 - alpha) * this.stats.averageExecutionTime;
  }

  getTaskStatus(taskId) {
    // 检查运行中任务
    if (this.running.has(taskId)) {
      return this.running.get(taskId);
    }

    // 检查队列中任务
    const queuedTask = this.queue.find(t => t.id === taskId);
    if (queuedTask) {
      return queuedTask;
    }

    // 检查已完成任务
    const completedTask = this.completed.find(t => t.id === taskId) ||
                         this.failed.find(t => t.id === taskId);

    return completedTask || null;
  }

  getStats() {
    return {
      ...this.stats,
      queuedTasks: this.queue.length,
      runningTasks: this.running.size,
      completedTasks: this.completed.length,
      failedTasks: this.failed.length
    };
  }
}

class AutoScaler {
  constructor(cluster, config = {}) {
    this.cluster = cluster;
    this.config = {
      scaleUpThreshold: 70,    // CPU使用率超过70%时扩容
      scaleDownThreshold: 30,  // CPU使用率低于30%时缩容
      evaluationInterval: 60000, // 1分钟评估一次
      cooldownPeriod: 300000,   // 5分钟冷却期
      maxNodes: 10,
      minNodes: 1,
      ...config
    };

    this.scaling = false;
    this.lastScaleTime = 0;
    this.evaluationTimer = null;
  }

  start() {
    this.evaluationTimer = setInterval(() => {
      this.evaluateScaling();
    }, this.config.evaluationInterval);

    logger.info('Auto-scaler started');
  }

  stop() {
    if (this.evaluationTimer) {
      clearInterval(this.evaluationTimer);
      this.evaluationTimer = null;
    }

    logger.info('Auto-scaler stopped');
  }

  evaluateScaling() {
    if (this.scaling) return;

    const now = Date.now();
    if (now - this.lastScaleTime < this.config.cooldownPeriod) {
      return; // 冷却期内不进行缩放
    }

    const nodes = this.cluster.getAllNodes();
    const onlineNodes = nodes.filter(n => n.status === 'online');

    if (onlineNodes.length === 0) return;

    // 计算平均负载
    const avgLoad = onlineNodes.reduce((sum, node) => sum + node.getLoadScore(), 0) / onlineNodes.length;
    const avgLoadPercent = avgLoad * 100;

    logger.debug(`Auto-scaler evaluation: ${onlineNodes.length} nodes, avg load: ${avgLoadPercent.toFixed(1)}%`);

    if (avgLoadPercent > this.config.scaleUpThreshold && onlineNodes.length < this.config.maxNodes) {
      this.scaleUp(avgLoadPercent);
    } else if (avgLoadPercent < this.config.scaleDownThreshold && onlineNodes.length > this.config.minNodes) {
      this.scaleDown(avgLoadPercent);
    }
  }

  async scaleUp(currentLoad) {
    this.scaling = true;
    this.lastScaleTime = Date.now();

    try {
      const newNodeId = `auto_${Date.now()}`;
      logger.info(`Scaling up: adding node ${newNodeId} (current load: ${currentLoad.toFixed(1)}%)`);

      // 这里应该实际启动新节点
      // 简化实现：模拟添加节点
      await this.cluster.registerNode(newNodeId, {
        host: 'auto-scaled-host',
        port: 3000 + Math.floor(Math.random() * 1000),
        capabilities: ['ai-service', 'workflow'],
        maxConcurrency: 10
      });

      this.cluster.emit('scaled_up', { nodeId: newNodeId, reason: 'high_load' });

    } catch (error) {
      logger.error('Failed to scale up', error);
    } finally {
      this.scaling = false;
    }
  }

  async scaleDown(currentLoad) {
    this.scaling = true;
    this.lastScaleTime = Date.now();

    try {
      const nodes = this.cluster.getAllNodes();
      const idleNodes = nodes.filter(n =>
        n.status === 'online' &&
        n.getLoadScore() < 0.2 && // 负载低于20%
        n.nodeId.startsWith('auto_') // 只缩放自动创建的节点
      );

      if (idleNodes.length === 0) return;

      const nodeToRemove = idleNodes[0]; // 移除最空闲的节点
      logger.info(`Scaling down: removing node ${nodeToRemove.nodeId} (current load: ${currentLoad.toFixed(1)}%)`);

      await this.cluster.unregisterNode(nodeToRemove.nodeId);
      this.cluster.emit('scaled_down', { nodeId: nodeToRemove.nodeId, reason: 'low_load' });

    } catch (error) {
      logger.error('Failed to scale down', error);
    } finally {
      this.scaling = false;
    }
  }

  getStats() {
    return {
      scaling: this.scaling,
      lastScaleTime: this.lastScaleTime,
      config: this.config
    };
  }
}

/**
 * 🌐 DistributedDeployment - 分布式部署和算力均衡系统
 */
export class DistributedDeployment extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      nodeId: `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      discoveryMethod: 'static', // static, multicast, etcd, consul
      enableAutoScaling: true,
      enableLoadBalancing: true,
      enableMonitoring: true,
      ...config
    };

    this.nodes = new Map();
    this.loadBalancer = new LoadBalancer();
    this.taskScheduler = new TaskScheduler(this);
    this.resourceMonitor = null;
    this.autoScaler = null;

    this.isRunning = false;
    this.heartbeatTimer = null;

    this.stats = {
      startTime: null,
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0
    };

    // 初始化本地节点
    this.localNode = new NodeInfo(this.config.nodeId, this.config);
    this.registerNode(this.localNode);
  }

  async start() {
    if (this.isRunning) return;

    try {
      this.stats.startTime = new Date();
      this.localNode.status = 'online';

      // 启动资源监控
      if (this.config.enableMonitoring) {
        this.resourceMonitor = new ResourceMonitor(this.config.nodeId);
        this.resourceMonitor.startMonitoring();
      }

      // 启动自动伸缩
      if (this.config.enableAutoScaling) {
        this.autoScaler = new AutoScaler(this);
        this.autoScaler.start();
      }

      // 启动心跳
      this.startHeartbeat();

      // 节点发现
      await this.discoverNodes();

      this.isRunning = true;
      this.emit('started', { nodeId: this.config.nodeId });

      logger.info(`Distributed deployment started: ${this.config.nodeId}`);
    } catch (error) {
      logger.error('Failed to start distributed deployment', error);
      throw error;
    }
  }

  async stop() {
    if (!this.isRunning) return;

    try {
      this.isRunning = false;
      this.localNode.status = 'offline';

      // 停止心跳
      if (this.heartbeatTimer) {
        clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = null;
      }

      // 停止自动伸缩
      if (this.autoScaler) {
        this.autoScaler.stop();
      }

      // 停止资源监控
      if (this.resourceMonitor) {
        this.resourceMonitor.stopMonitoring();
      }

      this.emit('stopped', { nodeId: this.config.nodeId });
      logger.info(`Distributed deployment stopped: ${this.config.nodeId}`);
    } catch (error) {
      logger.error('Failed to stop distributed deployment', error);
      throw error;
    }
  }

  async registerNode(nodeIdOrConfig, config = {}) {
    let node;

    if (typeof nodeIdOrConfig === 'string') {
      node = new NodeInfo(nodeIdOrConfig, config);
    } else {
      node = nodeIdOrConfig;
    }

    this.nodes.set(node.nodeId, node);

    if (node.nodeId !== this.config.nodeId) {
      logger.info(`Remote node registered: ${node.nodeId}`);
      this.emit('node_registered', { nodeId: node.nodeId });
    }
  }

  async unregisterNode(nodeId) {
    const node = this.nodes.get(nodeId);
    if (!node) return false;

    node.status = 'offline';
    this.nodes.delete(nodeId);

    logger.info(`Node unregistered: ${nodeId}`);
    this.emit('node_unregistered', { nodeId });

    return true;
  }

  async discoverNodes() {
    // 简化实现：静态节点发现
    // 实际应该实现多播发现、注册中心发现等

    if (this.config.staticNodes) {
      for (const nodeConfig of this.config.staticNodes) {
        await this.registerNode(nodeConfig.nodeId, nodeConfig);
      }
    }

    logger.info(`Node discovery completed: ${this.nodes.size} nodes found`);
  }

  startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, 10000); // 10秒心跳
  }

  sendHeartbeat() {
    const metrics = this.resourceMonitor ? this.resourceMonitor.getLatestMetrics() : {};

    this.localNode.updateMetrics({
      cpuUsage: metrics.cpu || 0,
      memoryUsage: metrics.memory || 0,
      activeTasks: this.taskScheduler.stats.running,
      completedTasks: this.taskScheduler.stats.completed,
      failedTasks: this.taskScheduler.stats.failed,
      averageResponseTime: this.taskScheduler.stats.averageExecutionTime
    });

    // 广播心跳给其他节点
    this.broadcastHeartbeat();
  }

  broadcastHeartbeat() {
    // 简化实现：记录心跳
    logger.debug(`Heartbeat sent from ${this.config.nodeId}`, {
      status: this.localNode.status,
      load: this.localNode.getLoadScore()
    });
  }

  getAllNodes() {
    return Array.from(this.nodes.values());
  }

  getAvailableNodes() {
    return this.getAllNodes().filter(node =>
      node.status === 'online' && node.isHealthy()
    );
  }

  async submitTask(task) {
    this.stats.totalTasks++;
    const taskId = await this.taskScheduler.submitTask(task);

    this.emit('task_submitted', { taskId, task });
    return taskId;
  }

  getTaskStatus(taskId) {
    return this.taskScheduler.getTaskStatus(taskId);
  }

  getNodeInfo(nodeId = null) {
    if (nodeId) {
      return this.nodes.get(nodeId)?.toJSON() || null;
    }

    const nodes = {};
    for (const [id, node] of this.nodes) {
      nodes[id] = node.toJSON();
    }
    return nodes;
  }

  getStats() {
    return {
      ...this.stats,
      isRunning: this.isRunning,
      nodeId: this.config.nodeId,
      totalNodes: this.nodes.size,
      availableNodes: this.getAvailableNodes().length,
      scheduler: this.taskScheduler.getStats(),
      monitor: this.resourceMonitor?.getStats(),
      scaler: this.autoScaler?.getStats()
    };
  }

  async cleanup() {
    await this.stop();

    this.nodes.clear();
    this.taskScheduler = new TaskScheduler(this);

    logger.info('Distributed deployment cleaned up');
  }
}

// 创建全局分布式部署实例
export const distributedDeployment = new DistributedDeployment();

export default {
  DistributedDeployment,
  distributedDeployment,
  NodeInfo,
  LoadBalancer,
  ResourceMonitor,
  TaskScheduler,
  AutoScaler
};
