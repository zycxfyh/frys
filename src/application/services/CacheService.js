/**
 * 缓存服务
 * 应用层的缓存管理服务
 */

import CacheManager from '../../infrastructure/persistence/CacheManager.js';
import CacheStrategies from '../../infrastructure/persistence/CacheStrategies.js';
import { BaseApplicationService } from '../../shared/kernel/BaseApplicationService.js';
import { logger } from '../../shared/utils/logger.js';

export class CacheService extends BaseApplicationService {
  constructor(options = {}) {
    super();

    this.cacheManager = new CacheManager(options);
    this.strategies = new CacheStrategies(this.cacheManager);
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return this;

    try {
      logger.info('初始化缓存服务...');

      // 注册常用缓存策略
      this.registerCommonStrategies();

      // 设置缓存预热
      await this.setupCacheWarmup();

      // 设置缓存监控
      this.setupCacheMonitoring();

      this.initialized = true;
      logger.info('缓存服务初始化完成');

      return this;
    } catch (error) {
      logger.error('缓存服务初始化失败', error);
      throw error;
    }
  }

  async start() {
    await this.initialize();

    // 启动缓存清理和监控
    this.startCacheMaintenance();

    logger.info('缓存服务已启动');
    return this;
  }

  async stop() {
    if (this.cacheManager) {
      await this.cacheManager.close();
    }

    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
    }

    logger.info('缓存服务已停止');
    return this;
  }

  /**
   * 注册常用缓存策略
   */
  registerCommonStrategies() {
    // 注册所有预定义策略到缓存管理器
    for (const [name, strategy] of this.strategies.strategies) {
      this.cacheManager.registerStrategy(name, strategy);
    }

    logger.info('常用缓存策略已注册', {
      strategies: this.strategies.getStrategyNames(),
    });
  }

  /**
   * 设置缓存预热
   */
  async setupCacheWarmup() {
    // 预热常用数据
    const warmupTasks = [
      this.warmupUserSessions(),
      this.warmupSystemConfig(),
      this.warmupCommonQueries(),
    ];

    try {
      await Promise.allSettled(warmupTasks);
      logger.info('缓存预热完成');
    } catch (error) {
      logger.warn('缓存预热部分失败', error);
    }
  }

  /**
   * 预热用户会话
   */
  async warmupUserSessions() {
    // 这里应该从数据库获取活跃用户会话
    // 暂时使用模拟数据
    const activeSessions = ['user_1', 'user_2', 'user_3'];

    await this.cacheManager.warmup(
      activeSessions,
      async (sessionId) => ({ sessionId, data: `session_data_${sessionId}` }),
      { strategy: 'session' },
    );
  }

  /**
   * 预热系统配置
   */
  async warmupSystemConfig() {
    const configKeys = ['app.settings', 'feature.flags', 'system.limits'];

    await this.cacheManager.warmup(
      configKeys,
      async (key) => ({ key, value: `config_value_${key}` }),
      { strategy: 'config' },
    );
  }

  /**
   * 预热常用查询
   */
  async warmupCommonQueries() {
    const queryKeys = ['users:recent', 'posts:popular', 'stats:daily'];

    await this.cacheManager.warmup(
      queryKeys,
      async (key) => ({ key, results: [`result_1_${key}`, `result_2_${key}`] }),
      { strategy: 'database' },
    );
  }

  /**
   * 设置缓存监控
   */
  setupCacheMonitoring() {
    this.monitoringTimer = setInterval(async () => {
      try {
        const stats = this.cacheManager.getStats();
        const health = await this.cacheManager.healthCheck();

        // 记录缓存指标
        logger.debug('缓存状态监控', {
          hitRate: `${(stats.hitRate * 100).toFixed(2)}%`,
          totalOperations: stats.metrics.hits + stats.metrics.misses,
          layerHealth: health.status,
        });

        // 检查缓存健康状况
        if (health.status !== 'healthy') {
          logger.warn('缓存健康检查失败', {
            issues: health.issues,
            layerHealth: health.layerHealth,
          });
        }

        // 检查命中率
        if (
          stats.hitRate < 0.5 &&
          stats.metrics.hits + stats.metrics.misses > 100
        ) {
          logger.warn('缓存命中率过低', {
            hitRate: `${(stats.hitRate * 100).toFixed(2)}%`,
            totalOperations: stats.metrics.hits + stats.metrics.misses,
          });
        }
      } catch (error) {
        logger.error('缓存监控失败', error);
      }
    }, 60000); // 每分钟监控一次
  }

  /**
   * 启动缓存维护
   */
  startCacheMaintenance() {
    // 缓存管理器已经启动了清理定时器
    // 这里可以添加额外的维护任务
    logger.info('缓存维护任务已启动');
  }

  // === 缓存操作接口 ===

  /**
   * 获取缓存值
   */
  async get(key, options = {}) {
    try {
      const value = await this.cacheManager.get(key, options);

      if (options.enableMetrics) {
        logger.debug('缓存获取', {
          key,
          hit: value !== null,
          strategy: options.strategy || 'default',
        });
      }

      return value;
    } catch (error) {
      logger.error('缓存获取失败', error);
      return null;
    }
  }

  /**
   * 设置缓存值
   */
  async set(key, value, options = {}) {
    // 验证输入参数
    if (key === null || key === undefined || key === '') {
      logger.warn('缓存键不能为空');
      return false;
    }

    if (value === undefined) {
      logger.warn('缓存值不能为undefined');
      return false;
    }

    try {
      const success = await this.cacheManager.set(key, value, options);

      if (options.enableMetrics) {
        logger.debug('缓存设置', {
          key,
          success,
          strategy: options.strategy || 'default',
          ttl: options.ttl || 'default',
        });
      }

      return success;
    } catch (error) {
      logger.error('缓存设置失败', error);
      return false;
    }
  }

  /**
   * 删除缓存值
   */
  async delete(key, options = {}) {
    try {
      const deleted = await this.cacheManager.delete(key, options);

      if (options.enableMetrics) {
        logger.debug('缓存删除', {
          key,
          deleted,
          strategy: options.strategy || 'default',
        });
      }

      return deleted;
    } catch (error) {
      logger.error('缓存删除失败', error);
      return false;
    }
  }

  /**
   * 清空缓存
   */
  async clear(pattern = null, options = {}) {
    try {
      const cleared = await this.cacheManager.clear(pattern, options);

      logger.info('缓存清空', {
        pattern: pattern || 'all',
        strategy: options.strategy || 'default',
      });

      return cleared;
    } catch (error) {
      logger.error('缓存清空失败', error);
      return false;
    }
  }

  /**
   * 获取或设置缓存值（缓存穿透保护）
   */
  async getOrSet(key, factory, options = {}) {
    try {
      return await this.cacheManager.getOrSet(key, factory, options);
    } catch (error) {
      logger.error('缓存穿透保护失败', error);

      // 如果缓存失败，直接调用工厂函数
      return await factory();
    }
  }

  /**
   * 批量操作
   */
  async mget(keys, options = {}) {
    try {
      return await this.cacheManager.mget(keys, options);
    } catch (error) {
      logger.error('批量缓存获取失败', error);
      return new Map(keys.map((key) => [key, null]));
    }
  }

  async mset(keyValuePairs, options = {}) {
    try {
      return await this.cacheManager.mset(keyValuePairs, options);
    } catch (error) {
      logger.error('批量缓存设置失败', error);
      return false;
    }
  }

  /**
   * 智能过期策略
   */
  async setWithSmartExpiry(key, value, options = {}) {
    try {
      return await this.cacheManager.setWithSmartExpiry(key, value, options);
    } catch (error) {
      logger.error('智能过期设置失败', error);
      return false;
    }
  }

  // === 高级缓存功能 ===

  /**
   * 创建智能缓存策略
   */
  createSmartStrategy(options = {}) {
    return this.strategies.createSmartStrategy(options);
  }

  /**
   * 创建访问模式策略
   */
  createAccessPatternStrategy(pattern) {
    return this.strategies.createAccessPatternStrategy(pattern);
  }

  /**
   * 创建新鲜度策略
   */
  createFreshnessStrategy(freshness) {
    return this.strategies.createFreshnessStrategy(freshness);
  }

  /**
   * 创建复合策略
   */
  createCompositeStrategy(strategies, combiner = 'first') {
    return this.strategies.createCompositeStrategy(strategies, combiner);
  }

  /**
   * 注册自定义策略
   */
  registerStrategy(name, strategy) {
    this.strategies.registerStrategy(name, strategy);
    this.cacheManager.registerStrategy(name, strategy);

    logger.info('自定义缓存策略已注册', { strategyName: name });
  }

  // === 缓存分析和优化 ===

  /**
   * 获取缓存统计信息
   */
  getCacheStats() {
    return {
      manager: this.cacheManager.getStats(),
      strategies: this.strategies.getStrategyStats(),
      service: {
        initialized: this.initialized,
        monitoringActive: !!this.monitoringTimer,
      },
    };
  }

  /**
   * 分析缓存性能
   */
  analyzeCachePerformance() {
    const stats = this.getCacheStats();
    const analysis = {
      timestamp: new Date().toISOString(),
      overall: {
        hitRate: stats.manager.hitRate,
        totalOperations:
          stats.manager.metrics.hits + stats.manager.metrics.misses,
        healthStatus: 'unknown',
      },
      layers: {},
      strategies: {},
      recommendations: [],
    };

    // 分析各层性能
    for (const [name, layerStats] of Object.entries(stats.manager.layers)) {
      analysis.layers[name] = {
        status: layerStats.status || 'unknown',
        utilization: layerStats.utilization || 0,
        entries: layerStats.entries || 0,
      };
    }

    // 生成建议
    if (analysis.overall.hitRate < 0.6) {
      analysis.recommendations.push({
        type: 'optimization',
        message: '缓存命中率较低，建议调整TTL或预热策略',
        priority: 'medium',
      });
    }

    if (analysis.overall.hitRate > 0.95) {
      analysis.recommendations.push({
        type: 'optimization',
        message: '缓存命中率很高，可以考虑延长TTL减少内存压力',
        priority: 'low',
      });
    }

    // 检查层利用率
    const memoryLayer = analysis.layers.memory;
    if (memoryLayer && memoryLayer.utilization > 0.9) {
      analysis.recommendations.push({
        type: 'warning',
        message: '内存缓存利用率过高，考虑增加内存或优化清理策略',
        priority: 'high',
      });
    }

    return analysis;
  }

  /**
   * 优化缓存配置
   */
  async optimizeCacheConfiguration() {
    const analysis = this.analyzeCachePerformance();

    logger.info('开始缓存配置优化', {
      currentHitRate: `${(analysis.overall.hitRate * 100).toFixed(2)}%`,
      recommendations: analysis.recommendations.length,
    });

    // 应用优化建议
    for (const recommendation of analysis.recommendations) {
      try {
        await this.applyRecommendation(recommendation);
      } catch (error) {
        logger.error('应用优化建议失败', error);
      }
    }

    logger.info('缓存配置优化完成');
    return analysis;
  }

  /**
   * 应用优化建议
   */
  async applyRecommendation(recommendation) {
    switch (recommendation.type) {
      case 'optimization':
        if (recommendation.message.includes('TTL')) {
          // 调整TTL的逻辑可以在这里实现
          logger.info('TTL优化建议已记录，等待手动调整');
        }
        break;

      case 'warning':
        if (recommendation.message.includes('内存')) {
          // 内存优化逻辑
          logger.warn('内存利用率高，建议监控');
        }
        break;
    }
  }

  /**
   * 导出缓存配置
   */
  exportConfiguration() {
    return {
      manager: this.cacheManager.options,
      strategies: this.strategies.exportStrategies(),
      stats: this.getCacheStats(),
    };
  }

  /**
   * 导入缓存配置
   */
  importConfiguration(config) {
    if (config.strategies) {
      this.strategies.importStrategies(config.strategies);
    }

    logger.info('缓存配置已导入');
  }

  /**
   * 健康检查
   */
  async healthCheck() {
    try {
      const cacheHealth = await this.cacheManager.healthCheck();

      return {
        status:
          this.initialized && cacheHealth.status === 'healthy'
            ? 'healthy'
            : 'unhealthy',
        issues: cacheHealth.issues || [],
        layerHealth: cacheHealth.layerHealth || {},
        metrics: cacheHealth.metrics || {},
        details: {
          initialized: this.initialized,
          strategies: this.strategies.getStrategyNames().length,
          monitoring: !!this.monitoringTimer,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        issues: [error.message],
        error: error.message,
      };
    }
  }
}

export default CacheService;
