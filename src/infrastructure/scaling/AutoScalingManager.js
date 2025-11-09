/**
 * frys - 自动扩容管理器
 * 基于指标和策略自动管理服务实例的扩容和缩容
 */

import { logger } from '../../shared/utils/logger.js';
import { LoadBalancer } from './LoadBalancer.js';
import { ScalingMetrics } from './ScalingMetrics.js';
import { ScalingPolicy } from './ScalingPolicy.js';

export class AutoScalingManager {
  constructor(config = {}) {
    this.serviceName = config.serviceName || 'frys-app';
    this.minInstances = config.minInstances || 1;
    this.maxInstances = config.maxInstances || 10;
    this.currentInstances = config.initialInstances || this.minInstances;
    this.policies = config.policies || [new ScalingPolicy()];
    this.metrics = new ScalingMetrics({
      collectionInterval: config.metricsInterval || 30000,
      retentionPeriod: config.metricsRetention || 3600000,
      onMetricsCollected: (metrics) => this._onMetricsCollected(metrics),
      onAnomalyDetected: (anomalies) => this._onAnomalyDetected(anomalies),
    });

    this.loadBalancer = new LoadBalancer({
      algorithm: config.loadBalancingAlgorithm || 'round_robin',
      healthCheckInterval: config.healthCheckInterval || 30000,
    });

    this.orchestrator = config.orchestrator || null; // ContainerOrchestrator实例
    this.monitoringTimer = null;
    this.isRunning = false;
    this.scaleHistory = [];
    this.alerts = [];

    // 绑定方法
    this._onMetricsCollected = this._onMetricsCollected.bind(this);
    this._onAnomalyDetected = this._onAnomalyDetected.bind(this);
  }

  /**
   * 启动自动扩容管理器
   */
  async start() {
    if (this.isRunning) {
      logger.warn('自动扩容管理器已在运行中');
      return;
    }

    logger.info('启动自动扩容管理器', {
      serviceName: this.serviceName,
      minInstances: this.minInstances,
      maxInstances: this.maxInstances,
      currentInstances: this.currentInstances,
    });

    this.isRunning = true;

    // 启动指标收集
    await this.metrics.startCollection();

    // 启动负载均衡器健康检查
    await this.loadBalancer.startHealthChecks();

    // 启动扩容监控
    this.monitoringTimer = setInterval(() => {
      this._checkScalingConditions();
    }, 60000); // 每分钟检查一次

    // 初始化实例
    await this._initializeInstances();
  }

  /**
   * 停止自动扩容管理器
   */
  async stop() {
    if (!this.isRunning) {
      return;
    }

    logger.info('停止自动扩容管理器');
    this.isRunning = false;

    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }

    await this.metrics.stopCollection();
    this.loadBalancer.stopHealthChecks();
  }

  /**
   * 初始化服务实例
   */
  async _initializeInstances() {
    if (!this.orchestrator) {
      logger.warn('没有配置容器编排器，无法初始化实例');
      return;
    }

    try {
      // 获取当前运行的实例
      const runningInstances = await this.orchestrator.getRunningInstances(
        this.serviceName,
      );

      if (runningInstances.length === 0) {
        // 如果没有运行实例，启动初始实例
        logger.info('没有运行实例，开始启动初始实例', {
          count: this.currentInstances,
        });
        await this._scaleToInstances(this.currentInstances);
      } else {
        // 同步当前状态
        this.currentInstances = runningInstances.length;
        logger.info('发现现有实例', { count: this.currentInstances });

        // 将实例添加到负载均衡器
        for (const instance of runningInstances) {
          this.loadBalancer.addInstance(instance.id, instance.url, {
            weight: instance.weight || 1,
            metadata: instance.metadata,
          });
        }
      }
    } catch (error) {
      logger.error('初始化实例失败', error);
    }
  }

  /**
   * 检查扩容条件
   */
  async _checkScalingConditions() {
    if (!this.isRunning) return;

    try {
      const currentMetrics = this.metrics.getCurrentMetrics();
      logger.debug('检查扩容条件', {
        metrics: currentMetrics,
        currentInstances: this.currentInstances,
      });

      // 检查每个策略
      for (const policy of this.policies) {
        const scaleUpDecision = policy.shouldScaleUp(
          currentMetrics,
          this.currentInstances,
        );
        const scaleDownDecision = policy.shouldScaleDown(
          currentMetrics,
          this.currentInstances,
        );

        if (scaleUpDecision.shouldScale) {
          await this._executeScaleUp(scaleUpDecision, policy);
          break; // 一次只执行一个扩容操作
        } else if (scaleDownDecision.shouldScale) {
          await this._executeScaleDown(scaleDownDecision, policy);
          break; // 一次只执行一个缩容操作
        }
      }
    } catch (error) {
      logger.error('检查扩容条件失败', error);
    }
  }

  /**
   * 执行扩容
   */
  async _executeScaleUp(decision, policy) {
    const newInstanceCount = Math.min(
      decision.targetInstances,
      this.maxInstances,
    );
    const instancesToAdd = newInstanceCount - this.currentInstances;

    if (instancesToAdd <= 0) {
      return;
    }

    logger.info('开始扩容', {
      from: this.currentInstances,
      to: newInstanceCount,
      instancesToAdd,
      reason: decision.reason,
      policy: decision.policy,
    });

    try {
      await this._scaleToInstances(newInstanceCount);

      // 记录扩容历史
      this._recordScaleEvent({
        type: 'scale_up',
        fromInstances: this.currentInstances,
        toInstances: newInstanceCount,
        reason: decision.reason,
        policy: decision.policy,
        timestamp: Date.now(),
      });

      policy.updateLastScaleTime();
      this.currentInstances = newInstanceCount;
    } catch (error) {
      logger.error('扩容执行失败', error);

      // 发送告警
      this._sendAlert({
        type: 'scale_up_failed',
        severity: 'high',
        message: `扩容失败: ${error.message}`,
        details: {
          targetInstances: newInstanceCount,
          currentInstances: this.currentInstances,
          policy: decision.policy,
        },
      });
    }
  }

  /**
   * 执行缩容
   */
  async _executeScaleDown(decision, policy) {
    const newInstanceCount = Math.max(
      decision.targetInstances,
      this.minInstances,
    );
    const instancesToRemove = this.currentInstances - newInstanceCount;

    if (instancesToRemove <= 0) {
      return;
    }

    logger.info('开始缩容', {
      from: this.currentInstances,
      to: newInstanceCount,
      instancesToRemove,
      reason: decision.reason,
      policy: decision.policy,
    });

    try {
      await this._scaleToInstances(newInstanceCount);

      // 记录缩容历史
      this._recordScaleEvent({
        type: 'scale_down',
        fromInstances: this.currentInstances,
        toInstances: newInstanceCount,
        reason: decision.reason,
        policy: decision.policy,
        timestamp: Date.now(),
      });

      policy.updateLastScaleTime();
      this.currentInstances = newInstanceCount;
    } catch (error) {
      logger.error('缩容执行失败', error);

      // 发送告警
      this._sendAlert({
        type: 'scale_down_failed',
        severity: 'high',
        message: `缩容失败: ${error.message}`,
        details: {
          targetInstances: newInstanceCount,
          currentInstances: this.currentInstances,
          policy: decision.policy,
        },
      });
    }
  }

  /**
   * 缩放到指定实例数
   */
  async _scaleToInstances(targetCount) {
    if (!this.orchestrator) {
      throw new Error('没有配置容器编排器');
    }

    const currentRunning = await this.orchestrator.getRunningInstances(
      this.serviceName,
    );
    const currentCount = currentRunning.length;

    if (targetCount > currentCount) {
      // 扩容
      const instancesToAdd = targetCount - currentCount;
      logger.info('启动新实例', { count: instancesToAdd });

      for (let i = 0; i < instancesToAdd; i++) {
        try {
          const newInstance = await this.orchestrator.startInstance(
            this.serviceName,
            {
              index: currentCount + i,
            },
          );

          this.loadBalancer.addInstance(newInstance.id, newInstance.url, {
            weight: newInstance.weight || 1,
            metadata: newInstance.metadata,
          });

          logger.info('新实例启动成功', {
            instanceId: newInstance.id,
            url: newInstance.url,
          });
        } catch (error) {
          logger.error('启动实例失败', {
            index: currentCount + i,
            error: error.message,
          });
          throw error;
        }
      }
    } else if (targetCount < currentCount) {
      // 缩容
      const instancesToRemove = currentCount - targetCount;
      logger.info('停止实例', { count: instancesToRemove });

      // 选择要停止的实例（基于连接数最少的）
      const instancesByLoad = currentRunning
        .map((instance) => ({
          ...instance,
          connections:
            this.loadBalancer
              .getStats()
              .instances.find((i) => i.instanceId === instance.id)
              ?.connections || 0,
        }))
        .sort((a, b) => a.connections - b.connections);

      for (let i = 0; i < instancesToRemove; i++) {
        const instanceToStop = instancesByLoad[i];
        try {
          await this.orchestrator.stopInstance(instanceToStop.id);
          this.loadBalancer.removeInstance(instanceToStop.id);
          logger.info('实例停止成功', { instanceId: instanceToStop.id });
        } catch (error) {
          logger.error('停止实例失败', {
            instanceId: instanceToStop.id,
            error: error.message,
          });
          throw error;
        }
      }
    }
  }

  /**
   * 指标收集回调
   */
  _onMetricsCollected(metrics) {
    logger.debug('收到指标数据', metrics);
  }

  /**
   * 异常检测回调
   */
  _onAnomalyDetected(anomalies) {
    logger.warn('检测到系统异常', { anomalies });

    // 发送告警
    for (const anomaly of anomalies) {
      this._sendAlert({
        type: 'system_anomaly',
        severity: anomaly.severity,
        message: anomaly.message,
        details: {
          type: anomaly.type,
          value: anomaly.value,
          timestamp: Date.now(),
        },
      });
    }

    // 如果是严重异常，考虑紧急扩容
    const criticalAnomalies = anomalies.filter(
      (a) => a.severity === 'critical',
    );
    if (
      criticalAnomalies.length > 0 &&
      this.currentInstances < this.maxInstances
    ) {
      logger.warn('检测到严重异常，执行紧急扩容');
      // 这里可以实现紧急扩容逻辑
    }
  }

  /**
   * 手动触发扩容
   * @param {number} targetInstances - 目标实例数
   * @param {string} reason - 扩容原因
   */
  async manualScale(targetInstances, reason = '手动扩容') {
    const clampedTarget = Math.max(
      this.minInstances,
      Math.min(this.maxInstances, targetInstances),
    );

    if (clampedTarget === this.currentInstances) {
      logger.info('目标实例数与当前相同，无需扩容', {
        targetInstances,
        currentInstances: this.currentInstances,
      });
      return;
    }

    logger.info('执行手动扩容', {
      from: this.currentInstances,
      to: clampedTarget,
      reason,
    });

    try {
      await this._scaleToInstances(clampedTarget);

      this._recordScaleEvent({
        type:
          clampedTarget > this.currentInstances
            ? 'manual_scale_up'
            : 'manual_scale_down',
        fromInstances: this.currentInstances,
        toInstances: clampedTarget,
        reason,
        timestamp: Date.now(),
      });

      this.currentInstances = clampedTarget;
    } catch (error) {
      logger.error('手动扩容失败', error);
      throw error;
    }
  }

  /**
   * 记录扩容事件
   */
  _recordScaleEvent(event) {
    this.scaleHistory.push(event);

    // 只保留最近1000个事件
    if (this.scaleHistory.length > 1000) {
      this.scaleHistory = this.scaleHistory.slice(-1000);
    }

    logger.info('扩容事件已记录', event);
  }

  /**
   * 发送告警
   */
  _sendAlert(alert) {
    this.alerts.push({
      ...alert,
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    });

    // 只保留最近100个告警
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }

    logger.warn('扩容告警', alert);

    // 这里可以集成外部告警系统，如邮件、Slack等
  }

  /**
   * 获取扩容统计信息
   */
  getStats() {
    return {
      serviceName: this.serviceName,
      currentInstances: this.currentInstances,
      minInstances: this.minInstances,
      maxInstances: this.maxInstances,
      isRunning: this.isRunning,
      policies: this.policies.map((p) => p.getConfig()),
      metrics: this.metrics.getMetricsStats(),
      loadBalancer: this.loadBalancer.getStats(),
      scaleHistory: this.scaleHistory.slice(-10), // 最近10个事件
      recentAlerts: this.alerts.slice(-5), // 最近5个告警
    };
  }

  /**
   * 获取扩容历史
   * @param {number} limit - 返回的事件数量限制
   */
  getScaleHistory(limit = 50) {
    return this.scaleHistory.slice(-limit);
  }

  /**
   * 获取活跃告警
   */
  getActiveAlerts() {
    // 返回最近1小时内的告警
    const oneHourAgo = Date.now() - 3600000;
    return this.alerts.filter((alert) => alert.timestamp > oneHourAgo);
  }

  /**
   * 清除告警
   * @param {string} alertId - 告警ID
   */
  clearAlert(alertId) {
    const index = this.alerts.findIndex((alert) => alert.id === alertId);
    if (index !== -1) {
      this.alerts.splice(index, 1);
      logger.info('告警已清除', { alertId });
    }
  }

  /**
   * 获取配置
   */
  getConfig() {
    return {
      serviceName: this.serviceName,
      minInstances: this.minInstances,
      maxInstances: this.maxInstances,
      policies: this.policies.map((p) => p.getConfig()),
      metrics: this.metrics.getConfig(),
      loadBalancer: this.loadBalancer.getConfig(),
    };
  }

  /**
   * 更新配置
   */
  updateConfig(config) {
    if (config.minInstances !== undefined) {
      this.minInstances = config.minInstances;
    }
    if (config.maxInstances !== undefined) {
      this.maxInstances = config.maxInstances;
    }
    if (config.policies) {
      this.policies = config.policies;
    }

    logger.info('自动扩容管理器配置已更新', config);
  }
}
