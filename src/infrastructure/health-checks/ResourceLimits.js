/**
 * frys - 资源限制管理器
 * 管理系统资源限制和配额
 */

import { EventBus } from '../../shared/kernel/EventBus.js';
import { logger } from '../../shared/utils/logger.js';

export class ResourceLimits {
  constructor(config = {}) {
    this.eventBus = config.eventBus || new EventBus();
    this.limits = new Map();
    this.currentUsage = new Map();
    this.enforcementEnabled = config.enforcementEnabled !== false;
    this.gracefulDegradation = config.gracefulDegradation !== false;

    // 默认资源限制
    this.defaultLimits = {
      memory: {
        heapUsed: config.maxHeapUsed || 512 * 1024 * 1024, // 512MB
        heapTotal: config.maxHeapTotal || 1024 * 1024 * 1024, // 1GB
        external: config.maxExternal || 256 * 1024 * 1024, // 256MB
      },
      cpu: {
        usagePercent: config.maxCpuUsage || 80, // 80%
        maxTimePerSecond: config.maxCpuTime || 800, // 800ms per second
      },
      disk: {
        maxUsagePercent: config.maxDiskUsage || 90, // 90%
        maxWriteRate: config.maxWriteRate || 10 * 1024 * 1024, // 10MB/s
      },
      network: {
        maxConnections: config.maxConnections || 1000,
        maxBandwidth: config.maxBandwidth || 100 * 1024 * 1024, // 100MB/s
      },
      file_handles: {
        maxOpenFiles: config.maxOpenFiles || 1024,
      },
    };

    this._initializeLimits();
    this._startMonitoring();
  }

  /**
   * 初始化资源限制
   */
  _initializeLimits() {
    // 设置默认限制
    Object.entries(this.defaultLimits).forEach(([resourceType, limits]) => {
      this.setLimits(resourceType, limits);
    });

    logger.info('资源限制已初始化', {
      limits: Object.fromEntries(this.limits),
    });
  }

  /**
   * 设置资源限制
   * @param {string} resourceType - 资源类型
   * @param {object} limits - 限制配置
   */
  setLimits(resourceType, limits) {
    this.limits.set(resourceType, {
      ...limits,
      enabled: limits.enabled !== false,
      actions: limits.actions || ['log', 'alert'], // 默认动作：记录日志和告警
    });

    logger.info('资源限制已设置', { resourceType, limits });
  }

  /**
   * 获取资源限制
   * @param {string} resourceType - 资源类型
   */
  getLimits(resourceType) {
    return this.limits.get(resourceType);
  }

  /**
   * 检查资源使用是否超过限制
   * @param {string} resourceType - 资源类型
   * @param {any} currentValue - 当前值
   * @param {object} context - 上下文信息
   */
  checkLimit(resourceType, currentValue, context = {}) {
    const limits = this.limits.get(resourceType);
    if (!limits || !limits.enabled) {
      return { exceeded: false };
    }

    const violations = this._checkLimitViolations(
      resourceType,
      limits,
      currentValue,
    );

    if (violations.length > 0) {
      const violation = {
        resourceType,
        currentValue,
        violations,
        context,
        timestamp: Date.now(),
      };

      // 执行限制动作
      this._executeLimitActions(violation);

      // 发布事件
      this.eventBus.publish('resourceLimitExceeded', violation);

      return {
        exceeded: true,
        violations,
        actions: limits.actions,
      };
    }

    return { exceeded: false };
  }

  /**
   * 检查具体的限制违规
   */
  _checkLimitViolations(resourceType, limits, currentValue) {
    const violations = [];

    switch (resourceType) {
      case 'memory':
        violations.push(...this._checkMemoryLimits(limits, currentValue));
        break;
      case 'cpu':
        violations.push(...this._checkCpuLimits(limits, currentValue));
        break;
      case 'disk':
        violations.push(...this._checkDiskLimits(limits, currentValue));
        break;
      case 'network':
        violations.push(...this._checkNetworkLimits(limits, currentValue));
        break;
      case 'file_handles':
        violations.push(...this._checkFileHandleLimits(limits, currentValue));
        break;
      default:
        // 通用限制检查
        if (
          typeof limits.maxValue !== 'undefined' &&
          currentValue > limits.maxValue
        ) {
          violations.push({
            type: 'max_value',
            limit: limits.maxValue,
            current: currentValue,
            severity: 'high',
          });
        }
    }

    return violations;
  }

  /**
   * 检查内存限制
   */
  _checkMemoryLimits(limits, memUsage) {
    const violations = [];

    if (limits.heapUsed && memUsage.heapUsed > limits.heapUsed) {
      violations.push({
        type: 'heap_used',
        limit: limits.heapUsed,
        current: memUsage.heapUsed,
        percent: (memUsage.heapUsed / limits.heapUsed) * 100,
        severity: 'high',
      });
    }

    if (limits.heapTotal && memUsage.heapTotal > limits.heapTotal) {
      violations.push({
        type: 'heap_total',
        limit: limits.heapTotal,
        current: memUsage.heapTotal,
        percent: (memUsage.heapTotal / limits.heapTotal) * 100,
        severity: 'critical',
      });
    }

    if (limits.external && memUsage.external > limits.external) {
      violations.push({
        type: 'external_memory',
        limit: limits.external,
        current: memUsage.external,
        percent: (memUsage.external / limits.external) * 100,
        severity: 'medium',
      });
    }

    return violations;
  }

  /**
   * 检查CPU限制
   */
  _checkCpuLimits(limits, cpuUsage) {
    const violations = [];

    if (
      limits.usagePercent &&
      cpuUsage.usagePercent > limits.usagePercent / 100
    ) {
      violations.push({
        type: 'cpu_usage_percent',
        limit: limits.usagePercent,
        current: cpuUsage.usagePercent * 100,
        severity: 'high',
      });
    }

    if (
      limits.maxTimePerSecond &&
      cpuUsage.user + cpuUsage.system > limits.maxTimePerSecond
    ) {
      violations.push({
        type: 'cpu_time',
        limit: limits.maxTimePerSecond,
        current: cpuUsage.user + cpuUsage.system,
        severity: 'medium',
      });
    }

    return violations;
  }

  /**
   * 检查磁盘限制
   */
  _checkDiskLimits(limits, diskUsage) {
    const violations = [];

    if (
      limits.maxUsagePercent &&
      diskUsage.usagePercent > limits.maxUsagePercent / 100
    ) {
      violations.push({
        type: 'disk_usage_percent',
        limit: limits.maxUsagePercent,
        current: diskUsage.usagePercent * 100,
        severity: 'high',
      });
    }

    if (limits.maxWriteRate && diskUsage.writeRate > limits.maxWriteRate) {
      violations.push({
        type: 'disk_write_rate',
        limit: limits.maxWriteRate,
        current: diskUsage.writeRate,
        severity: 'medium',
      });
    }

    return violations;
  }

  /**
   * 检查网络限制
   */
  _checkNetworkLimits(limits, networkUsage) {
    const violations = [];

    if (
      limits.maxConnections &&
      networkUsage.connections > limits.maxConnections
    ) {
      violations.push({
        type: 'connections',
        limit: limits.maxConnections,
        current: networkUsage.connections,
        severity: 'high',
      });
    }

    if (limits.maxBandwidth && networkUsage.bandwidth > limits.maxBandwidth) {
      violations.push({
        type: 'bandwidth',
        limit: limits.maxBandwidth,
        current: networkUsage.bandwidth,
        severity: 'medium',
      });
    }

    return violations;
  }

  /**
   * 检查文件句柄限制
   */
  _checkFileHandleLimits(limits, fileHandleUsage) {
    const violations = [];

    if (
      limits.maxOpenFiles &&
      fileHandleUsage.openFiles > limits.maxOpenFiles
    ) {
      violations.push({
        type: 'open_files',
        limit: limits.maxOpenFiles,
        current: fileHandleUsage.openFiles,
        severity: 'medium',
      });
    }

    return violations;
  }

  /**
   * 执行限制动作
   */
  _executeLimitActions(violation) {
    const limits = this.limits.get(violation.resourceType);
    const actions = limits.actions || [];

    for (const action of actions) {
      try {
        switch (action) {
          case 'log':
            this._logViolation(violation);
            break;
          case 'alert':
            this._alertViolation(violation);
            break;
          case 'throttle':
            this._throttleResource(violation);
            break;
          case 'gc':
            this._triggerGarbageCollection(violation);
            break;
          case 'shutdown':
            this._initiateGracefulShutdown(violation);
            break;
          default:
            logger.warn('未知的限制动作', { action, violation });
        }
      } catch (error) {
        logger.error('执行限制动作失败', { action, error: error.message });
      }
    }
  }

  /**
   * 记录违规
   */
  _logViolation(violation) {
    const severity = violation.violations[0]?.severity || 'medium';
    const logMethod =
      severity === 'critical' ? 'error' : severity === 'high' ? 'warn' : 'info';

    logger[logMethod]('资源限制违规', {
      resourceType: violation.resourceType,
      currentValue: violation.currentValue,
      violations: violation.violations,
      context: violation.context,
    });
  }

  /**
   * 告警违规
   */
  _alertViolation(violation) {
    // 这里可以集成外部告警系统
    logger.error('资源限制告警', {
      resourceType: violation.resourceType,
      violations: violation.violations,
      currentValue: violation.currentValue,
    });

    // 发布告警事件
    this.eventBus.publish('resourceLimitAlert', violation);
  }

  /**
   * 限制资源使用
   */
  _throttleResource(violation) {
    logger.warn('开始限制资源使用', { resourceType: violation.resourceType });

    // 根据资源类型实施限制措施
    switch (violation.resourceType) {
      case 'memory':
        // 强制垃圾回收
        if (global.gc) {
          global.gc();
          logger.info('已执行强制垃圾回收');
        }
        break;
      case 'cpu':
        // 降低处理优先级（如果可能）
        break;
      case 'network':
        // 限制连接数
        break;
    }
  }

  /**
   * 触发垃圾回收
   */
  _triggerGarbageCollection(violation) {
    if (global.gc) {
      const before = process.memoryUsage();
      global.gc();
      const after = process.memoryUsage();

      const freed = before.heapUsed - after.heapUsed;
      logger.info('垃圾回收完成', {
        freed: `${(freed / 1024 / 1024).toFixed(2)}MB`,
        heapUsed: `${(after.heapUsed / 1024 / 1024).toFixed(2)}MB`,
      });
    } else {
      logger.warn('垃圾回收不可用，请使用 --expose-gc 启动');
    }
  }

  /**
   * 启动优雅关闭
   */
  _initiateGracefulShutdown(violation) {
    logger.error('资源限制严重违规，启动优雅关闭', violation);

    // 延迟一点时间确保日志被记录
    setTimeout(() => {
      this.eventBus.publish('emergencyShutdown', {
        reason: 'resource_limit_exceeded',
        violation,
        timestamp: Date.now(),
      });
    }, 1000);
  }

  /**
   * 启动资源监控
   */
  _startMonitoring() {
    // 内存监控
    this._monitorMemory();

    // CPU监控
    this._monitorCpu();

    // 文件句柄监控
    this._monitorFileHandles();

    logger.info('资源监控已启动');
  }

  /**
   * 监控内存使用
   */
  _monitorMemory() {
    const checkMemory = () => {
      const memUsage = process.memoryUsage();
      const result = this.checkLimit('memory', memUsage, { source: 'monitor' });

      if (result.exceeded) {
        logger.warn('内存使用超限', { violations: result.violations });
      }
    };

    // 每10秒检查一次
    setInterval(checkMemory, 10000);
  }

  /**
   * 监控CPU使用
   */
  _monitorCpu() {
    let lastCpuUsage = process.cpuUsage();

    const checkCpu = () => {
      const currentCpuUsage = process.cpuUsage();
      const diff = {
        user: currentCpuUsage.user - lastCpuUsage.user,
        system: currentCpuUsage.system - lastCpuUsage.system,
      };

      const total = diff.user + diff.system;
      const usagePercent = total / 1000000; // 转换为秒

      const result = this.checkLimit(
        'cpu',
        { ...diff, usagePercent },
        { source: 'monitor' },
      );

      if (result.exceeded) {
        logger.warn('CPU使用超限', { violations: result.violations });
      }

      lastCpuUsage = currentCpuUsage;
    };

    // 每30秒检查一次
    setInterval(checkCpu, 30000);
  }

  /**
   * 监控文件句柄
   */
  _monitorFileHandles() {
    // Node.js没有直接获取打开文件数量的API
    // 这里使用一个近似方法
    const checkFileHandles = () => {
      // 在类Unix系统上，可以使用lsof来检查
      // 这里简化为一个占位符
      logger.debug('文件句柄监控占位符');
    };

    // 每分钟检查一次
    setInterval(checkFileHandles, 60000);
  }

  /**
   * 强制执行垃圾回收
   */
  forceGarbageCollection() {
    if (global.gc) {
      const before = process.memoryUsage();
      global.gc();
      const after = process.memoryUsage();

      return {
        before: before.heapUsed,
        after: after.heapUsed,
        freed: before.heapUsed - after.heapUsed,
      };
    }

    return null;
  }

  /**
   * 获取资源使用统计
   */
  getResourceStats() {
    return {
      limits: Object.fromEntries(this.limits),
      currentUsage: Object.fromEntries(this.currentUsage),
      violations: this._getRecentViolations(),
      monitoring: {
        memory: true,
        cpu: true,
        fileHandles: true,
      },
    };
  }

  /**
   * 获取最近的违规记录
   */
  _getRecentViolations() {
    // 这里应该维护一个违规历史记录
    // 简化实现，返回空数组
    return [];
  }

  /**
   * 动态调整限制
   * @param {string} resourceType - 资源类型
   * @param {object} newLimits - 新限制
   */
  adjustLimits(resourceType, newLimits) {
    const currentLimits = this.limits.get(resourceType);
    if (currentLimits) {
      const adjusted = { ...currentLimits, ...newLimits };
      this.setLimits(resourceType, adjusted);

      logger.info('资源限制已动态调整', { resourceType, newLimits });
    }
  }

  /**
   * 启用/禁用强制执行
   * @param {boolean} enabled - 是否启用
   */
  setEnforcementEnabled(enabled) {
    this.enforcementEnabled = enabled;
    logger.info('资源限制强制执行已更新', { enabled });
  }

  /**
   * 清理资源
   */
  cleanup() {
    // 清理定时器等资源
    logger.info('资源限制管理器已清理');
  }
}

/**
 * 容器资源限制配置
 */
export class ContainerResourceLimits extends ResourceLimits {
  constructor(containerConfig = {}) {
    super(containerConfig);

    this.containerType = containerConfig.type || 'docker'; // docker, kubernetes
    this.containerLimits = {
      cpu: containerConfig.cpu || {
        cpus: 1, // CPU核心数
        quota: 100000, // CPU时间配额
        period: 100000, // CPU周期
      },
      memory: containerConfig.memory || {
        limit: 512 * 1024 * 1024, // 512MB
        reservation: 256 * 1024 * 1024, // 256MB
        swap: 0, // 不使用交换
      },
      disk: containerConfig.disk || {
        size: 10 * 1024 * 1024 * 1024, // 10GB
        iops: 100, // IOPS限制
      },
      network: containerConfig.network || {
        bandwidth: 100 * 1024 * 1024, // 100MB/s
        connections: 1000, // 最大连接数
      },
    };

    this._applyContainerLimits();
  }

  /**
   * 应用容器限制
   */
  _applyContainerLimits() {
    // 将容器限制转换为内部限制格式
    this.setLimits('cpu', {
      ...this.containerLimits.cpu,
      usagePercent: 80, // 80% CPU使用率限制
      actions: ['log', 'alert', 'throttle'],
    });

    this.setLimits('memory', {
      heapTotal: this.containerLimits.memory.limit * 0.8, // 80%内存限制
      actions: ['log', 'alert', 'gc'],
    });

    this.setLimits('disk', {
      maxUsagePercent: 90,
      actions: ['log', 'alert'],
    });

    this.setLimits('network', {
      maxConnections: this.containerLimits.network.connections,
      maxBandwidth: this.containerLimits.network.bandwidth,
      actions: ['log', 'alert', 'throttle'],
    });

    logger.info('容器资源限制已应用', {
      type: this.containerType,
      limits: this.containerLimits,
    });
  }

  /**
   * 获取容器配置
   */
  getContainerConfig() {
    return {
      type: this.containerType,
      limits: this.containerLimits,
      internalLimits: Object.fromEntries(this.limits),
    };
  }

  /**
   * 生成容器编排配置
   */
  generateContainerConfig() {
    if (this.containerType === 'docker') {
      return this._generateDockerConfig();
    } else if (this.containerType === 'kubernetes') {
      return this._generateKubernetesConfig();
    }

    return {};
  }

  /**
   * 生成Docker配置
   */
  _generateDockerConfig() {
    return {
      cpu_quota: this.containerLimits.cpu.quota,
      cpu_period: this.containerLimits.cpu.period,
      cpuset_cpus: `0-${this.containerLimits.cpu.cpus - 1}`,
      memory: this.containerLimits.memory.limit,
      memory_reservation: this.containerLimits.memory.reservation,
      memory_swap: this.containerLimits.memory.limit, // 禁用交换
      blkio_weight: 500, // IO权重
      ulimits: [
        { name: 'nofile', soft: 1024, hard: 2048 }, // 文件句柄限制
      ],
    };
  }

  /**
   * 生成Kubernetes配置
   */
  _generateKubernetesConfig() {
    return {
      resources: {
        limits: {
          cpu: `${this.containerLimits.cpu.cpus}`,
          memory: `${this.containerLimits.memory.limit / 1024 / 1024}Mi`,
        },
        requests: {
          cpu: `${this.containerLimits.cpu.cpus * 0.5}`,
          memory: `${this.containerLimits.memory.reservation / 1024 / 1024}Mi`,
        },
      },
      securityContext: {
        allowPrivilegeEscalation: false,
        runAsNonRoot: true,
        capabilities: {
          drop: ['ALL'],
        },
      },
    };
  }
}
