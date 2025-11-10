/**
 * 自适应框架
 * 提供运行时配置、动态调整和环境适配功能
 */

import { logger } from '../../shared/utils/logger.js';
import { ConfigurationManager } from '../config/ConfigurationManager.js';
import { EventSystem } from '../events/EventSystem.js';
import { MetricsCollectorUtils } from '../../shared/utils/MetricsCollectorUtils.js';
import { ResourceCleanupUtils } from '../../shared/utils/ResourceCleanupUtils.js';
import { TimerManager } from '../../shared/utils/TimerManager.js';

export class AdaptiveFramework {
  constructor(options = {}) {
    this.options = {
      enableAutoTuning: true,
      enableEnvironmentDetection: true,
      enablePerformanceMonitoring: true,
      adaptationInterval: 30000, // 30秒检查一次
      stabilityThreshold: 0.8, // 稳定性阈值
      performanceThreshold: 0.7, // 性能阈值
      resourceThreshold: 0.9, // 资源阈值
      maxAdaptationAttempts: 5,
      adaptationCooldown: 60000, // 1分钟冷却时间
      ...options
    };

    // 核心组件
    this.config = null;
    this.eventSystem = null;

    // 适配策略
    this.strategies = new Map();
    this.activeStrategies = new Map();

    // 环境信息
    this.environment = this._detectEnvironment();
    this.capabilities = new Map();

    // 性能监控
    this.metrics = MetricsCollectorUtils.createMetricsCollector('adaptive');
    this.performanceHistory = [];
    this.resourceHistory = [];

    // 适配历史
    this.adaptationHistory = [];
    this.lastAdaptation = 0;

    // 策略评估器
    this.strategyEvaluator = this._createStrategyEvaluator();

    // 定时器管理器
    this.timerManager = new TimerManager();

    // 清理管理器
    this.cleanupManager = ResourceCleanupUtils.createCleanupManager('adaptive');

    // 初始化
    this._initialize();

    logger.info('Adaptive framework initialized', {
      environment: this.environment.type,
      autoTuning: this.options.enableAutoTuning,
      performanceMonitoring: this.options.enablePerformanceMonitoring
    });
  }

  /**
   * 设置配置管理器
   * @param {ConfigurationManager} config - 配置管理器
   */
  setConfigManager(config) {
    this.config = config;

    // 监听配置变更
    if (this.config) {
      this.config.addChangeCallback((key, value, metadata) => {
        this._handleConfigChange(key, value, metadata);
      });
    }
  }

  /**
   * 设置事件系统
   * @param {EventSystem} eventSystem - 事件系统
   */
  setEventSystem(eventSystem) {
    this.eventSystem = eventSystem;
  }

  /**
   * 注册适配策略
   * @param {string} name - 策略名称
   * @param {Object} strategy - 策略实现
   */
  registerStrategy(name, strategy) {
    const strategyDefinition = {
      name,
      strategy: {
        evaluate: strategy.evaluate || (() => ({ score: 0, reason: 'No evaluation function' })),
        apply: strategy.apply || (() => {}),
        rollback: strategy.rollback || (() => {}),
        metadata: {
          description: strategy.description || '',
          target: strategy.target || 'general',
          priority: strategy.priority || 0,
          conditions: strategy.conditions || {},
          ...strategy.metadata
        }
      },
      registeredAt: Date.now(),
      usageCount: 0,
      successCount: 0,
      failureCount: 0
    };

    this.strategies.set(name, strategyDefinition);

    logger.debug(`Adaptive strategy registered: ${name}`, {
      target: strategyDefinition.strategy.metadata.target,
      priority: strategyDefinition.strategy.metadata.priority
    });

    return this;
  }

  /**
   * 激活策略
   * @param {string} name - 策略名称
   * @param {Object} context - 激活上下文
   * @returns {Promise<boolean>} 是否成功激活
   */
  async activateStrategy(name, context = {}) {
    const strategyDef = this.strategies.get(name);
    if (!strategyDef) {
      logger.warn(`Strategy not found: ${name}`);
      return false;
    }

    try {
      // 检查条件
      if (!this._checkStrategyConditions(strategyDef, context)) {
        logger.debug(`Strategy conditions not met: ${name}`);
        return false;
      }

      // 评估策略
      const evaluation = await this._evaluateStrategy(strategyDef, context);
      if (evaluation.score < this.options.stabilityThreshold) {
        logger.debug(`Strategy evaluation failed: ${name} (score: ${evaluation.score})`);
        return false;
      }

      // 应用策略
      await strategyDef.strategy.apply(context);

      // 记录激活
      this.activeStrategies.set(name, {
        definition: strategyDef,
        activatedAt: Date.now(),
        context,
        evaluation
      });

      strategyDef.usageCount++;

      // 发送事件
      await this._emitEvent('strategy:activated', {
        strategy: name,
        evaluation,
        context
      });

      logger.info(`Strategy activated: ${name}`, {
        score: evaluation.score,
        reason: evaluation.reason
      });

      return true;

    } catch (error) {
      strategyDef.failureCount++;
      logger.error(`Strategy activation failed: ${name}`, {
        error: error.message
      });
      return false;
    }
  }

  /**
   * 停用策略
   * @param {string} name - 策略名称
   * @returns {Promise<void>}
   */
  async deactivateStrategy(name) {
    const activeStrategy = this.activeStrategies.get(name);
    if (!activeStrategy) {
      return;
    }

    try {
      // 执行回滚
      if (activeStrategy.definition.strategy.rollback) {
        await activeStrategy.definition.strategy.rollback(activeStrategy.context);
      }

      // 移除激活状态
      this.activeStrategies.delete(name);
      activeStrategy.definition.successCount++;

      // 发送事件
      await this._emitEvent('strategy:deactivated', {
        strategy: name,
        duration: Date.now() - activeStrategy.activatedAt
      });

      logger.info(`Strategy deactivated: ${name}`);

    } catch (error) {
      activeStrategy.definition.failureCount++;
      logger.error(`Strategy deactivation failed: ${name}`, {
        error: error.message
      });
    }
  }

  /**
   * 执行自动适配
   * @param {Object} context - 适配上下文
   * @returns {Promise<Array>} 应用的策略列表
   */
  async adapt(context = {}) {
    if (!this.options.enableAutoTuning) {
      return [];
    }

    // 检查冷却时间
    const now = Date.now();
    if (now - this.lastAdaptation < this.options.adaptationCooldown) {
      logger.debug('Adaptation cooldown active, skipping');
      return [];
    }

    try {
      logger.info('Starting adaptive process...');

      // 收集环境信息
      const environment = await this._collectEnvironmentInfo();

      // 评估所有策略
      const strategyEvaluations = await this._evaluateAllStrategies({
        ...context,
        environment
      });

      // 选择最佳策略组合
      const selectedStrategies = this._selectOptimalStrategies(strategyEvaluations);

      if (selectedStrategies.length === 0) {
        logger.debug('No suitable strategies found for adaptation');
        return [];
      }

      // 应用策略
      const appliedStrategies = [];
      for (const strategyName of selectedStrategies) {
        const success = await this.activateStrategy(strategyName, {
          ...context,
          environment
        });

        if (success) {
          appliedStrategies.push(strategyName);
        }
      }

      // 记录适配历史
      this.adaptationHistory.push({
        timestamp: now,
        context,
        environment,
        appliedStrategies: appliedStrategies.slice(),
        strategyEvaluations
      });

      this.lastAdaptation = now;

      // 发送事件
      await this._emitEvent('adaptation:completed', {
        appliedStrategies,
        evaluations: strategyEvaluations.length
      });

      logger.info('Adaptive process completed', {
        applied: appliedStrategies.length,
        total: selectedStrategies.length
      });

      return appliedStrategies;

    } catch (error) {
      logger.error('Adaptive process failed', {
        error: error.message
      });
      return [];
    }
  }

  /**
   * 获取环境信息
   * @returns {Promise<Object>} 环境信息
   */
  async getEnvironmentInfo() {
    return await this._collectEnvironmentInfo();
  }

  /**
   * 获取能力信息
   * @param {string} capability - 能力名称
   * @returns {*} 能力值
   */
  getCapability(capability) {
    return this.capabilities.get(capability);
  }

  /**
   * 设置能力信息
   * @param {string} capability - 能力名称
   * @param {*} value - 能力值
   */
  setCapability(capability, value) {
    this.capabilities.set(capability, value);
    logger.debug(`Capability set: ${capability}`, { value });
  }

  /**
   * 获取适配统计信息
   * @returns {Object}
   */
  getStats() {
    const strategyStats = {};

    for (const [name, strategy] of this.strategies) {
      const active = this.activeStrategies.has(name);
      strategyStats[name] = {
        active,
        usageCount: strategy.usageCount,
        successCount: strategy.successCount,
        failureCount: strategy.failureCount,
        successRate: strategy.usageCount > 0 ? strategy.successCount / strategy.usageCount : 0,
        lastUsed: active ? this.activeStrategies.get(name).activatedAt : null
      };
    }

    return {
      strategies: strategyStats,
      activeStrategies: this.activeStrategies.size,
      environment: this.environment,
      capabilities: Object.fromEntries(this.capabilities),
      adaptations: {
        total: this.adaptationHistory.length,
        lastAdaptation: this.lastAdaptation,
        averageInterval: this._calculateAverageAdaptationInterval()
      },
      performance: {
        historySize: this.performanceHistory.length,
        resourceHistorySize: this.resourceHistory.length
      },
      metrics: this.metrics.getStats()
    };
  }

  /**
   * 销毁自适应框架
   */
  async destroy() {
    logger.info('Destroying adaptive framework...');

    // 停用所有活动策略
    const activeStrategyNames = Array.from(this.activeStrategies.keys());
    for (const name of activeStrategyNames) {
      try {
        await this.deactivateStrategy(name);
      } catch (error) {
        logger.warn(`Failed to deactivate strategy during shutdown: ${name}`, {
          error: error.message
        });
      }
    }

    // 停止定时器
    this.timerManager.destroy();

    // 清理资源
    await this.cleanupManager.cleanup();

    // 清空所有集合
    this.strategies.clear();
    this.activeStrategies.clear();
    this.capabilities.clear();
    this.performanceHistory = [];
    this.resourceHistory = [];
    this.adaptationHistory = [];

    logger.info('Adaptive framework destroyed');
  }

  /**
   * 初始化框架
   */
  _initialize() {
    // 注册默认策略
    this._registerDefaultStrategies();

    // 启动性能监控
    if (this.options.enablePerformanceMonitoring) {
      this.timerManager.setInterval(() => {
        this._monitorPerformance();
      }, this.options.adaptationInterval);

      this.timerManager.setInterval(() => {
        this._monitorResources();
      }, this.options.adaptationInterval);
    }

    // 启动自动适配
    if (this.options.enableAutoTuning) {
      this.timerManager.setInterval(() => {
        this.adapt({ source: 'scheduled' });
      }, this.options.adaptationInterval * 2);
    }
  }

  /**
   * 检测环境
   */
  _detectEnvironment() {
    const env = {
      type: 'unknown',
      platform: process.platform || 'unknown',
      arch: process.arch || 'unknown',
      nodeVersion: process.version || 'unknown',
      isProduction: false,
      isDevelopment: false,
      isTest: false,
      capabilities: []
    };

    // 检测运行环境
    if (typeof process !== 'undefined' && process.env) {
      env.isProduction = process.env.NODE_ENV === 'production';
      env.isDevelopment = process.env.NODE_ENV === 'development';
      env.isTest = process.env.NODE_ENV === 'test';
    }

    // 检测平台类型
    if (typeof window !== 'undefined') {
      env.type = 'browser';
      env.capabilities = ['dom', 'localStorage', 'webWorkers'];
    } else if (typeof process !== 'undefined') {
      env.type = 'node';
      env.capabilities = ['fs', 'net', 'child_process'];
    } else if (typeof Deno !== 'undefined') {
      env.type = 'deno';
      env.capabilities = ['fs', 'net', 'webApi'];
    }

    return env;
  }

  /**
   * 注册默认策略
   */
  _registerDefaultStrategies() {
    // 内存优化策略
    this.registerStrategy('memory_optimization', {
      description: 'Optimizes memory usage when heap usage is high',
      target: 'memory',
      priority: 10,
      conditions: { heapUsage: '>80%' },
      evaluate: async (context) => {
        const memUsage = process.memoryUsage();
        const ratio = memUsage.heapUsed / memUsage.heapTotal;

        if (ratio > 0.8) {
          return { score: Math.min(1, ratio), reason: `High memory usage: ${(ratio * 100).toFixed(1)}%` };
        }

        return { score: 0, reason: 'Memory usage normal' };
      },
      apply: async (context) => {
        if (global.gc) {
          global.gc();
          logger.info('Manual garbage collection triggered by adaptive strategy');
        }
      }
    });

    // CPU优化策略
    this.registerStrategy('cpu_optimization', {
      description: 'Optimizes CPU usage when load is high',
      target: 'cpu',
      priority: 8,
      conditions: { cpuLoad: '>70%' },
      evaluate: async (context) => {
        // 简化的CPU负载检测
        const load = await this._getCpuLoad();
        if (load > 0.7) {
          return { score: Math.min(1, load), reason: `High CPU load: ${(load * 100).toFixed(1)}%` };
        }
        return { score: 0, reason: 'CPU load normal' };
      },
      apply: async (context) => {
        // 减少并发数或延迟任务
        logger.info('CPU optimization strategy applied');
      }
    });

    // 缓存优化策略
    this.registerStrategy('cache_optimization', {
      description: 'Optimizes cache when hit rate is low',
      target: 'cache',
      priority: 6,
      conditions: { cacheHitRate: '<50%' },
      evaluate: async (context) => {
        // 这里应该从实际的缓存管理器获取命中率
        return { score: 0.5, reason: 'Cache optimization opportunity' };
      },
      apply: async (context) => {
        // 调整缓存大小或清理策略
        logger.info('Cache optimization strategy applied');
      }
    });

    // 连接池优化策略
    this.registerStrategy('connection_pool_optimization', {
      description: 'Optimizes connection pools when utilization is high',
      target: 'connections',
      priority: 7,
      conditions: { poolUtilization: '>90%' },
      evaluate: async (context) => {
        // 检查连接池利用率
        return { score: 0.3, reason: 'Connection pool optimization opportunity' };
      },
      apply: async (context) => {
        // 调整连接池大小
        logger.info('Connection pool optimization strategy applied');
      }
    });
  }

  /**
   * 创建策略评估器
   */
  _createStrategyEvaluator() {
    return {
      evaluate: async (strategy, context) => {
        try {
          return await strategy.strategy.evaluate(context);
        } catch (error) {
          logger.warn(`Strategy evaluation failed: ${strategy.name}`, {
            error: error.message
          });
          return { score: 0, reason: `Evaluation error: ${error.message}` };
        }
      }
    };
  }

  /**
   * 检查策略条件
   */
  _checkStrategyConditions(strategyDef, context) {
    const conditions = strategyDef.strategy.metadata.conditions;
    if (!conditions || Object.keys(conditions).length === 0) {
      return true;
    }

    // 这里应该实现条件检查逻辑
    // 暂时返回true
    return true;
  }

  /**
   * 评估策略
   */
  async _evaluateStrategy(strategyDef, context) {
    return await this.strategyEvaluator.evaluate(strategyDef, context);
  }

  /**
   * 评估所有策略
   */
  async _evaluateAllStrategies(context) {
    const evaluations = [];

    for (const [name, strategyDef] of this.strategies) {
      if (this._checkStrategyConditions(strategyDef, context)) {
        const evaluation = await this._evaluateStrategy(strategyDef, context);
        evaluations.push({
          name,
          evaluation,
          strategy: strategyDef
        });
      }
    }

    // 按评分排序
    evaluations.sort((a, b) => b.evaluation.score - a.evaluation.score);

    return evaluations;
  }

  /**
   * 选择最优策略组合
   */
  _selectOptimalStrategies(evaluations) {
    const selected = [];
    const usedTargets = new Set();

    for (const { name, evaluation, strategy } of evaluations) {
      const target = strategy.strategy.metadata.target;

      // 避免同一个目标的多个策略冲突
      if (evaluation.score >= this.options.stabilityThreshold &&
          !usedTargets.has(target)) {
        selected.push(name);
        usedTargets.add(target);

        // 限制最大策略数
        if (selected.length >= this.options.maxAdaptationAttempts) {
          break;
        }
      }
    }

    return selected;
  }

  /**
   * 收集环境信息
   */
  async _collectEnvironmentInfo() {
    const info = {
      timestamp: Date.now(),
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      loadAverage: process.platform !== 'win32' ? process.loadavg() : null,
      capabilities: Object.fromEntries(this.capabilities)
    };

    // 添加性能指标
    if (this.performanceHistory.length > 0) {
      const recent = this.performanceHistory.slice(-10);
      info.performanceTrend = this._calculateTrend(recent.map(p => p.value));
    }

    return info;
  }

  /**
   * 监控性能
   */
  _monitorPerformance() {
    // 收集性能指标
    const metrics = {
      timestamp: Date.now(),
      memoryUsage: process.memoryUsage().heapUsed,
      uptime: process.uptime(),
      activeHandles: 0, // 需要实际实现
      activeRequests: 0  // 需要实际实现
    };

    this.performanceHistory.push(metrics);

    // 限制历史记录大小
    if (this.performanceHistory.length > 100) {
      this.performanceHistory = this.performanceHistory.slice(-100);
    }

    // 记录到指标收集器
    this.metrics.record('memory_usage', metrics.memoryUsage);
    this.metrics.record('uptime', metrics.uptime);
  }

  /**
   * 监控资源
   */
  _monitorResources() {
    const resources = {
      timestamp: Date.now(),
      heapUsed: process.memoryUsage().heapUsed,
      heapTotal: process.memoryUsage().heapTotal,
      external: process.memoryUsage().external,
      rss: process.memoryUsage().rss
    };

    this.resourceHistory.push(resources);

    // 限制历史记录大小
    if (this.resourceHistory.length > 50) {
      this.resourceHistory = this.resourceHistory.slice(-50);
    }
  }

  /**
   * 获取CPU负载
   */
  async _getCpuLoad() {
    // 简化的CPU负载获取
    if (process.platform === 'win32') {
      return 0.5; // 默认值
    }

    try {
      const loadavg = process.loadavg();
      return Math.min(1, loadavg[0] / require('os').cpus().length);
    } catch {
      return 0.5;
    }
  }

  /**
   * 计算趋势
   */
  _calculateTrend(values) {
    if (values.length < 2) return 0;

    const recent = values.slice(-5);
    const older = values.slice(-10, -5);

    if (older.length === 0) return 0;

    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;

    return (recentAvg - olderAvg) / olderAvg;
  }

  /**
   * 计算平均适配间隔
   */
  _calculateAverageAdaptationInterval() {
    if (this.adaptationHistory.length < 2) return 0;

    const intervals = [];
    for (let i = 1; i < this.adaptationHistory.length; i++) {
      intervals.push(this.adaptationHistory[i].timestamp - this.adaptationHistory[i - 1].timestamp);
    }

    return intervals.reduce((a, b) => a + b, 0) / intervals.length;
  }

  /**
   * 处理配置变更
   */
  async _handleConfigChange(key, value, metadata) {
    // 根据配置变更触发适配
    if (key.startsWith('adaptive.') || key.startsWith('performance.')) {
      setTimeout(() => {
        this.adapt({ source: 'config_change', key, value });
      }, 1000); // 延迟1秒执行
    }
  }

  /**
   * 发送事件
   */
  async _emitEvent(event, data) {
    if (this.eventSystem) {
      await this.eventSystem.emit(event, data);
    }
  }
}

/**
 * 创建自适应框架的工厂函数
 * @param {Object} options - 选项
 * @returns {AdaptiveFramework}
 */
export function createAdaptiveFramework(options = {}) {
  return new AdaptiveFramework(options);
}
