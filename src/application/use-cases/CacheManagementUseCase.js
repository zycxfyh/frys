/**
 * 缓存管理用例
 * 处理缓存相关的业务逻辑
 */

import { BaseUseCase } from '../../shared/kernel/BaseUseCase.js';
import { Failure, Success } from '../../shared/kernel/Result.js';
import { logger } from '../../shared/utils/logger.js';

export class CacheManagementUseCase extends BaseUseCase {
  constructor(cacheService) {
    super();
    this.cacheService = cacheService;
  }

  /**
   * 获取缓存值用例
   */
  async getCacheValue(input) {
    const { key, strategy = 'default', options = {} } = input;

    try {
      const value = await this.cacheService.get(key, {
        strategy,
        enableMetrics: true,
        ...options,
      });

      return Success({
        key,
        value,
        found: value !== null,
        strategy,
      });
    } catch (error) {
      logger.error('获取缓存值失败', error);
      return Failure('缓存获取失败', error);
    }
  }

  /**
   * 设置缓存值用例
   */
  async setCacheValue(input) {
    const { key, value, strategy = 'default', ttl, options = {} } = input;

    // 验证输入
    if (!key || value === undefined) {
      return Failure('缓存键和值不能为空');
    }

    try {
      const success = await this.cacheService.set(key, value, {
        strategy,
        ttl,
        enableMetrics: true,
        ...options,
      });

      if (success) {
        return Success({
          key,
          value,
          strategy,
          ttl: ttl || 'default',
        });
      } else {
        return Failure('缓存设置失败');
      }
    } catch (error) {
      logger.error('设置缓存值失败', error);
      return Failure('缓存设置失败', error);
    }
  }

  /**
   * 删除缓存值用例
   */
  async deleteCacheValue(input) {
    const { key, strategy = 'default', options = {} } = input;

    if (!key) {
      return Failure('缓存键不能为空');
    }

    try {
      const deleted = await this.cacheService.delete(key, {
        strategy,
        enableMetrics: true,
        ...options,
      });

      return Success({
        key,
        deleted,
        strategy,
      });
    } catch (error) {
      logger.error('删除缓存值失败', error);
      return Failure('缓存删除失败', error);
    }
  }

  /**
   * 清空缓存用例
   */
  async clearCache(input) {
    const { pattern, strategy = 'default', options = {} } = input;

    try {
      const cleared = await this.cacheService.clear(pattern, {
        strategy,
        ...options,
      });

      logger.info('缓存已清空', { pattern: pattern || 'all', strategy });

      return Success({
        pattern: pattern || 'all',
        cleared,
        strategy,
      });
    } catch (error) {
      logger.error('清空缓存失败', error);
      return Failure('缓存清空失败', error);
    }
  }

  /**
   * 批量缓存操作用例
   */
  async batchCacheOperation(input) {
    const { operations } = input;

    if (!Array.isArray(operations) || operations.length === 0) {
      return Failure('批量操作不能为空');
    }

    const results = [];
    const errors = [];

    for (const operation of operations) {
      try {
        let result;

        switch (operation.type) {
          case 'get':
            result = await this.getCacheValue(operation);
            break;
          case 'set':
            result = await this.setCacheValue(operation);
            break;
          case 'delete':
            result = await this.deleteCacheValue(operation);
            break;
          default:
            result = Failure(`未知操作类型: ${operation.type}`);
        }

        results.push({
          operation: operation.type,
          key: operation.key,
          success: result.isSuccess,
          result: result.isSuccess ? result.data : result.error,
        });
      } catch (error) {
        errors.push({
          operation: operation.type,
          key: operation.key,
          error: error.message,
        });

        results.push({
          operation: operation.type,
          key: operation.key,
          success: false,
          error: error.message,
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;

    return Success({
      total: operations.length,
      successful: successCount,
      failed: operations.length - successCount,
      results,
      errors: errors.length > 0 ? errors : undefined,
    });
  }

  /**
   * 缓存预热用例
   */
  async warmupCache(input) {
    const { keys, strategy = 'default', factory, options = {} } = input;

    if (!Array.isArray(keys) || keys.length === 0) {
      return Failure('预热键列表不能为空');
    }

    if (typeof factory !== 'function') {
      return Failure('工厂函数必须是函数');
    }

    try {
      logger.info('开始缓存预热', { keysCount: keys.length, strategy });

      const success = await this.cacheService.cacheManager.warmup(
        keys,
        factory,
        { strategy, ...options },
      );

      return Success({
        keysCount: keys.length,
        successful: success,
        failed: keys.length - success,
        strategy,
      });
    } catch (error) {
      logger.error('缓存预热失败', error);
      return Failure('缓存预热失败', error);
    }
  }

  /**
   * 获取缓存统计用例
   */
  async getCacheStatistics(input = {}) {
    try {
      const stats = this.cacheService.getCacheStats();
      const analysis = this.cacheService.analyzeCachePerformance();

      return Success({
        statistics: stats,
        analysis,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('获取缓存统计失败', error);
      return Failure('获取缓存统计失败', error);
    }
  }

  /**
   * 缓存性能优化用例
   */
  async optimizeCachePerformance(input = {}) {
    try {
      logger.info('开始缓存性能优化');

      const analysis = await this.cacheService.optimizeCacheConfiguration();

      return Success({
        analysis,
        optimizations: analysis.recommendations.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('缓存性能优化失败', error);
      return Failure('缓存性能优化失败', error);
    }
  }

  /**
   * 创建缓存策略用例
   */
  async createCacheStrategy(input) {
    const { name, type, config } = input;

    if (!name || !type) {
      return Failure('策略名称和类型不能为空');
    }

    try {
      let strategy;

      switch (type) {
        case 'access_pattern':
          strategy = this.cacheService.createAccessPatternStrategy(
            config.pattern,
          );
          break;
        case 'freshness':
          strategy = this.cacheService.createFreshnessStrategy(
            config.freshness,
          );
          break;
        case 'composite':
          strategy = this.cacheService.createCompositeStrategy(
            config.strategies,
            config.combiner,
          );
          break;
        case 'smart':
          strategy = this.cacheService.createSmartStrategy(config);
          break;
        default:
          return Failure(`未知策略类型: ${type}`);
      }

      this.cacheService.registerStrategy(name, strategy);

      return Success({
        name,
        type,
        strategy: strategy.name,
        description: strategy.description,
      });
    } catch (error) {
      logger.error('创建缓存策略失败', error);
      return Failure('创建缓存策略失败', error);
    }
  }

  /**
   * 缓存健康检查用例
   */
  async checkCacheHealth(input = {}) {
    try {
      const health = await this.cacheService.healthCheck();

      return Success({
        status: health.status,
        issues: health.issues || [],
        layerHealth: health.layerHealth || {},
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('缓存健康检查失败', error);
      return Failure('缓存健康检查失败', error);
    }
  }

  /**
   * 导出缓存配置用例
   */
  async exportCacheConfiguration(input = {}) {
    try {
      const configuration = this.cacheService.exportConfiguration();

      return Success({
        configuration,
        exportedAt: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('导出缓存配置失败', error);
      return Failure('导出缓存配置失败', error);
    }
  }

  /**
   * 导入缓存配置用例
   */
  async importCacheConfiguration(input) {
    const { configuration } = input;

    if (!configuration) {
      return Failure('缓存配置不能为空');
    }

    try {
      this.cacheService.importConfiguration(configuration);

      return Success({
        importedAt: new Date().toISOString(),
        strategiesImported: configuration.strategies
          ? Object.keys(configuration.strategies).length
          : 0,
      });
    } catch (error) {
      logger.error('导入缓存配置失败', error);
      return Failure('导入缓存配置失败', error);
    }
  }

  /**
   * 缓存维护用例
   */
  async performCacheMaintenance(input = {}) {
    const { operation } = input;

    try {
      switch (operation) {
        case 'cleanup':
          // 手动触发清理
          await this.cacheService.cacheManager.cleanup();
          return Success({ operation: 'cleanup', message: '缓存清理完成' });

        case 'optimize': {
          // 执行优化
          const analysis = await this.optimizeCachePerformance({});
          return Success({
            operation: 'optimize',
            analysis,
            message: '缓存优化完成',
          });
        }

        case 'warmup': {
          // 执行预热
          const warmupResult = await this.warmupCache(input.warmupConfig || {});
          return Success({
            operation: 'warmup',
            result: warmupResult.data,
            message: '缓存预热完成',
          });
        }

        default:
          return Failure(`未知维护操作: ${operation}`);
      }
    } catch (error) {
      logger.error('缓存维护失败', error);
      return Failure(`缓存维护失败: ${operation}`, error);
    }
  }
}

export default CacheManagementUseCase;
