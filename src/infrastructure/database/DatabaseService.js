/**
 * 数据库服务
 * 统一管理数据库连接、优化、迁移和监控
 */

import { logger } from '../../utils/logger.js';
import DatabaseConnectionPool from './DatabaseConnectionPool.js';
import DatabaseOptimizer from './DatabaseOptimizer.js';
import MigrationManager from './MigrationManager.js';
import DatabaseMonitor from './DatabaseMonitor.js';

export class DatabaseService {
  constructor(options = {}) {
    this.options = {
      enableOptimizer: options.enableOptimizer !== false,
      enableMigrations: options.enableMigrations !== false,
      enableMonitoring: options.enableMonitoring !== false,
      migrationsPath: options.migrationsPath || './migrations',
      ...options,
    };

    this.pool = null;
    this.optimizer = null;
    this.migrations = null;
    this.monitor = null;
    this.isInitialized = false;
  }

  /**
   * 初始化数据库服务
   */
  async initialize() {
    if (this.isInitialized) {
      return this;
    }

    try {
      logger.info('初始化数据库服务...');

      // 初始化连接池
      this.pool = new DatabaseConnectionPool(this.options);
      await this.pool.initialize();

      // 初始化优化器
      if (this.options.enableOptimizer) {
        this.optimizer = new DatabaseOptimizer(this.pool);
      }

      // 初始化迁移管理器
      if (this.options.enableMigrations) {
        this.migrations = new MigrationManager(this.pool, {
          migrationsPath: this.options.migrationsPath,
        });
        await this.migrations.initialize();
      }

      // 初始化监控器
      if (this.options.enableMonitoring && this.optimizer) {
        this.monitor = new DatabaseMonitor(this.pool, this.optimizer);
      }

      this.isInitialized = true;
      logger.info('数据库服务初始化完成');

      return this;
    } catch (error) {
      logger.error('数据库服务初始化失败', error);
      throw error;
    }
  }

  /**
   * 启动数据库服务
   */
  async start() {
    await this.initialize();

    // 启动监控
    if (this.monitor) {
      await this.monitor.startMonitoring();
    }

    logger.info('数据库服务已启动');
    return this;
  }

  /**
   * 停止数据库服务
   */
  async stop() {
    // 停止监控
    if (this.monitor) {
      this.monitor.stopMonitoring();
    }

    // 关闭连接池
    if (this.pool) {
      await this.pool.close();
    }

    logger.info('数据库服务已停止');
    return this;
  }

  // === 查询接口 ===

  /**
   * 执行查询
   */
  async query(text, params = [], options = {}) {
    this.ensureInitialized();
    return await this.pool.query(text, params, options);
  }

  /**
   * 执行事务
   */
  async transaction(callback, options = {}) {
    this.ensureInitialized();
    return await this.pool.transaction(callback, options);
  }

  /**
   * 获取客户端连接
   */
  async getClient() {
    this.ensureInitialized();
    return await this.pool.getClient();
  }

  /**
   * 释放客户端连接
   */
  releaseClient(client) {
    if (this.pool) {
      this.pool.releaseClient(client);
    }
  }

  // === 优化接口 ===

  /**
   * 分析查询性能
   */
  async analyzeQuery(query, params = []) {
    this.ensureOptimizer();
    return await this.optimizer.analyzeQuery(query, params);
  }

  /**
   * 创建索引
   */
  async createIndex(table, columns, options = {}) {
    this.ensureOptimizer();
    return await this.optimizer.createIndex(table, columns, options);
  }

  /**
   * 删除索引
   */
  async dropIndex(indexName) {
    this.ensureOptimizer();
    return await this.optimizer.dropIndex(indexName);
  }

  /**
   * 分析表统计信息
   */
  async analyzeTable(tableName) {
    this.ensureOptimizer();
    return await this.optimizer.analyzeTable(tableName);
  }

  /**
   * 重新索引表
   */
  async reindexTable(tableName, concurrently = true) {
    this.ensureOptimizer();
    return await this.optimizer.reindexTable(tableName, concurrently);
  }

  /**
   * 获取优化建议
   */
  async getOptimizationRecommendations() {
    this.ensureOptimizer();
    return await this.optimizer.getOptimizationRecommendations();
  }

  /**
   * 执行自动优化
   */
  async performAutoOptimization(options = {}) {
    this.ensureOptimizer();
    return await this.optimizer.performAutoOptimization(options);
  }

  // === 迁移接口 ===

  /**
   * 创建新迁移
   */
  async createMigration(name, type = 'js') {
    this.ensureMigrations();
    return await this.migrations.createMigration(name, type);
  }

  /**
   * 执行迁移
   */
  async migrate(targetVersion = null) {
    this.ensureMigrations();
    return await this.migrations.migrate(targetVersion);
  }

  /**
   * 回滚迁移
   */
  async rollback(steps = 1) {
    this.ensureMigrations();
    return await this.migrations.rollback(steps);
  }

  /**
   * 获取迁移状态
   */
  getMigrationStatus() {
    this.ensureMigrations();
    return this.migrations.getStatus();
  }

  /**
   * 验证迁移完整性
   */
  async verifyMigrationIntegrity() {
    this.ensureMigrations();
    return await this.migrations.verifyIntegrity();
  }

  // === 监控接口 ===

  /**
   * 获取监控状态
   */
  getMonitoringStatus() {
    this.ensureMonitor();
    return this.monitor.getStatus();
  }

  /**
   * 获取监控指标历史
   */
  getMetricsHistory(hours = 1) {
    this.ensureMonitor();
    return this.monitor.getMetricsHistory(hours);
  }

  /**
   * 生成监控报告
   */
  async generateMonitoringReport(options = {}) {
    this.ensureMonitor();
    return await this.monitor.generateReport(options);
  }

  /**
   * 更新监控配置
   */
  updateMonitoringConfig(newConfig) {
    this.ensureMonitor();
    this.monitor.updateConfig(newConfig);
  }

  // === 综合接口 ===

  /**
   * 获取连接池状态
   */
  getPoolStats() {
    this.ensureInitialized();
    return this.pool.getPoolStats();
  }

  /**
   * 获取性能指标
   */
  getPerformanceMetrics() {
    this.ensureInitialized();
    return this.pool.getMetrics();
  }

  /**
   * 执行健康检查
   */
  async healthCheck() {
    try {
      const results = {
        service: 'database',
        status: 'healthy',
        components: {},
        issues: [],
        timestamp: new Date().toISOString(),
      };

      // 检查连接池
      if (this.pool) {
        const poolHealth = await this.pool.healthCheck();
        results.components.pool = poolHealth;
        if (poolHealth.status !== 'healthy') {
          results.status = 'degraded';
          results.issues.push(`连接池: ${poolHealth.error || '状态异常'}`);
        }
      }

      // 检查迁移完整性
      if (this.migrations) {
        const migrationHealth = await this.verifyMigrationIntegrity();
        results.components.migrations = migrationHealth;
        if (!migrationHealth.valid) {
          results.status = 'degraded';
          results.issues.push(
            `迁移: ${migrationHealth.issues.length} 个完整性问题`,
          );
        }
      }

      // 检查监控状态
      if (this.monitor) {
        const monitorHealth = await this.monitor.assessHealth();
        results.components.monitoring = monitorHealth;
        if (monitorHealth.status === 'critical') {
          results.status = 'critical';
          results.issues.push('监控: 数据库健康状况严重');
        } else if (monitorHealth.status === 'warning') {
          results.status = 'warning';
          results.issues.push('监控: 数据库健康状况警告');
        }
      }

      return results;
    } catch (error) {
      return {
        service: 'database',
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 生成完整报告
   */
  async generateFullReport() {
    const report = {
      timestamp: new Date().toISOString(),
      service: 'database',
      health: await this.healthCheck(),
      pool: this.getPoolStats(),
      performance: this.getPerformanceMetrics(),
      sections: {},
    };

    // 优化报告
    if (this.optimizer) {
      report.sections.optimization =
        await this.optimizer.generateOptimizationReport();
    }

    // 迁移报告
    if (this.migrations) {
      report.sections.migrations = this.getMigrationStatus();
    }

    // 监控报告
    if (this.monitor) {
      report.sections.monitoring = await this.generateMonitoringReport({
        hours: 24,
      });
    }

    return report;
  }

  /**
   * 执行维护任务
   */
  async performMaintenance(options = {}) {
    const results = {
      timestamp: new Date().toISOString(),
      tasks: [],
      errors: [],
    };

    try {
      // 自动优化
      if (options.optimize !== false && this.optimizer) {
        try {
          const optimizationResult = await this.performAutoOptimization(
            options.optimization || {},
          );
          results.tasks.push({
            name: 'auto_optimization',
            status: 'completed',
            result: optimizationResult,
          });
        } catch (error) {
          results.errors.push({
            task: 'auto_optimization',
            error: error.message,
          });
        }
      }

      // 迁移验证
      if (options.verifyMigrations !== false && this.migrations) {
        try {
          const verificationResult = await this.verifyMigrationIntegrity();
          results.tasks.push({
            name: 'migration_verification',
            status: verificationResult.valid ? 'passed' : 'failed',
            result: verificationResult,
          });
        } catch (error) {
          results.errors.push({
            task: 'migration_verification',
            error: error.message,
          });
        }
      }

      // 监控数据清理
      if (options.cleanupMonitoring !== false && this.monitor) {
        try {
          this.monitor.resetMetrics();
          results.tasks.push({
            name: 'monitoring_cleanup',
            status: 'completed',
          });
        } catch (error) {
          results.errors.push({
            task: 'monitoring_cleanup',
            error: error.message,
          });
        }
      }

      logger.info('数据库维护任务完成', {
        completed: results.tasks.length,
        errors: results.errors.length,
      });

      return results;
    } catch (error) {
      logger.error('数据库维护任务失败', error);
      results.errors.push({
        task: 'maintenance',
        error: error.message,
      });
      return results;
    }
  }

  // === 私有方法 ===

  /**
   * 确保服务已初始化
   */
  ensureInitialized() {
    if (!this.isInitialized) {
      throw new Error(
        'Database service not initialized. Call initialize() first.',
      );
    }
  }

  /**
   * 确保优化器可用
   */
  ensureOptimizer() {
    if (!this.optimizer) {
      throw new Error(
        'Database optimizer not enabled. Set enableOptimizer=true in options.',
      );
    }
  }

  /**
   * 确保迁移管理器可用
   */
  ensureMigrations() {
    if (!this.migrations) {
      throw new Error(
        'Migration manager not enabled. Set enableMigrations=true in options.',
      );
    }
  }

  /**
   * 确保监控器可用
   */
  ensureMonitor() {
    if (!this.monitor) {
      throw new Error(
        'Database monitor not enabled. Set enableMonitoring=true in options.',
      );
    }
  }
}

export default DatabaseService;
