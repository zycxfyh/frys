/**
 * 数据库连接池管理
 * 提供高效的数据库连接管理和连接复用
 */

import { logger } from '../../utils/logger.js';
import pg from 'pg';
const { Pool } = pg;

export class DatabaseConnectionPool {
  constructor(options = {}) {
    this.options = {
      host: options.host || process.env.DB_HOST || 'localhost',
      port: options.port || parseInt(process.env.DB_PORT) || 5432,
      database: options.database || process.env.DB_NAME || 'wokeflow',
      user: options.user || process.env.DB_USER || 'wokeflow',
      password: options.password || process.env.DB_PASSWORD || 'password',
      ssl: options.ssl || process.env.DB_SSL === 'true' || false,

      // 连接池配置
      min: options.min || parseInt(process.env.DB_POOL_MIN) || 2,
      max: options.max || parseInt(process.env.DB_POOL_MAX) || 20,
      idleTimeoutMillis:
        options.idleTimeoutMillis ||
        parseInt(process.env.DB_IDLE_TIMEOUT) ||
        30000,
      connectionTimeoutMillis:
        options.connectionTimeoutMillis ||
        parseInt(process.env.DB_CONNECTION_TIMEOUT) ||
        2000,
      acquireTimeoutMillis:
        options.acquireTimeoutMillis ||
        parseInt(process.env.DB_ACQUIRE_TIMEOUT) ||
        60000,

      // 重试配置
      retryAttempts: options.retryAttempts || 3,
      retryDelay: options.retryDelay || 1000,

      // 监控配置
      enableMetrics: options.enableMetrics !== false,
      slowQueryThreshold: options.slowQueryThreshold || 1000, // 1秒

      ...options,
    };

    this.pool = null;
    this.isConnected = false;
    this.metrics = {
      connections: {
        total: 0,
        idle: 0,
        waiting: 0,
      },
      queries: {
        total: 0,
        slow: 0,
        failed: 0,
      },
      performance: {
        avgQueryTime: 0,
        maxQueryTime: 0,
        totalQueryTime: 0,
      },
    };

    this.queryHistory = [];
    this.healthCheckTimer = null;
  }

  /**
   * 初始化连接池
   */
  async initialize() {
    try {
      logger.info('初始化数据库连接池...', {
        host: this.options.host,
        database: this.options.database,
        min: this.options.min,
        max: this.options.max,
      });

      this.pool = new Pool(this.options);

      // 设置事件监听
      this.setupEventListeners();

      // 测试连接
      await this.testConnection();

      this.isConnected = true;

      // 启动健康检查
      this.startHealthChecks();

      logger.info('数据库连接池初始化完成');
      return this;
    } catch (error) {
      logger.error('数据库连接池初始化失败', error);
      throw error;
    }
  }

  /**
   * 设置事件监听
   */
  setupEventListeners() {
    if (!this.pool) return;

    this.pool.on('connect', (client) => {
      logger.debug('新数据库连接已建立');
      this.metrics.connections.total++;
    });

    this.pool.on('error', (err, client) => {
      logger.error('数据库连接池错误', err);
      this.metrics.queries.failed++;
    });

    this.pool.on('remove', (client) => {
      logger.debug('数据库连接已移除');
    });
  }

  /**
   * 测试数据库连接
   */
  async testConnection() {
    const client = await this.pool.connect();
    try {
      await client.query('SELECT 1');
      logger.debug('数据库连接测试成功');
    } finally {
      client.release();
    }
  }

  /**
   * 执行查询
   */
  async query(text, params = [], options = {}) {
    const startTime = Date.now();
    let client = null;

    try {
      client = await this.pool.connect();

      // 设置查询超时（如果指定）
      if (options.timeout) {
        await client.query(`SET statement_timeout = ${options.timeout}`);
      }

      const result = await client.query(text, params);
      const queryTime = Date.now() - startTime;

      // 记录查询指标
      this.recordQueryMetrics(text, queryTime, true);

      // 记录慢查询
      if (queryTime > this.options.slowQueryThreshold) {
        logger.warn('慢查询检测', {
          query: this.sanitizeQuery(text),
          duration: queryTime,
          threshold: this.options.slowQueryThreshold,
        });
      }

      return result;
    } catch (error) {
      const queryTime = Date.now() - startTime;
      this.recordQueryMetrics(text, queryTime, false);

      logger.error('数据库查询失败', {
        query: this.sanitizeQuery(text),
        error: error.message,
        duration: queryTime,
      });

      throw error;
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  /**
   * 执行事务
   */
  async transaction(callback, options = {}) {
    const client = await this.pool.connect();
    const startTime = Date.now();

    try {
      await client.query('BEGIN');

      // 设置事务隔离级别（如果指定）
      if (options.isolationLevel) {
        await client.query(
          `SET TRANSACTION ISOLATION LEVEL ${options.isolationLevel}`,
        );
      }

      // 设置事务超时
      if (options.timeout) {
        await client.query(`SET statement_timeout = ${options.timeout}`);
      }

      const result = await callback(client);
      await client.query('COMMIT');

      const transactionTime = Date.now() - startTime;
      logger.debug('事务执行成功', { duration: transactionTime });

      return result;
    } catch (error) {
      await client.query('ROLLBACK');

      const transactionTime = Date.now() - startTime;
      logger.error('事务执行失败', {
        error: error.message,
        duration: transactionTime,
      });

      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 获取连接池状态
   */
  getPoolStats() {
    if (!this.pool) {
      return { status: 'disconnected' };
    }

    return {
      status: this.isConnected ? 'connected' : 'disconnected',
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
      config: {
        min: this.options.min,
        max: this.options.max,
        idleTimeoutMillis: this.options.idleTimeoutMillis,
        connectionTimeoutMillis: this.options.connectionTimeoutMillis,
      },
    };
  }

  /**
   * 记录查询指标
   */
  recordQueryMetrics(query, duration, success) {
    this.metrics.queries.total++;

    if (!success) {
      this.metrics.queries.failed++;
    }

    if (duration > this.options.slowQueryThreshold) {
      this.metrics.queries.slow++;
    }

    // 更新性能统计
    this.metrics.performance.totalQueryTime += duration;
    this.metrics.performance.avgQueryTime =
      this.metrics.performance.totalQueryTime / this.metrics.queries.total;
    this.metrics.performance.maxQueryTime = Math.max(
      this.metrics.performance.maxQueryTime,
      duration,
    );

    // 记录查询历史（保留最近1000个查询）
    this.queryHistory.push({
      timestamp: Date.now(),
      query: this.sanitizeQuery(query),
      duration,
      success,
    });

    if (this.queryHistory.length > 1000) {
      this.queryHistory.shift();
    }
  }

  /**
   * 清理查询（移除敏感信息）
   */
  sanitizeQuery(query) {
    if (!query) return '';

    // 移除密码和敏感数据
    return query
      .replace(/password\s*=\s*['"][^'"]*['"]/gi, "password='***'")
      .replace(/token\s*=\s*['"][^'"]*['"]/gi, "token='***'")
      .replace(/secret\s*=\s*['"][^'"]*['"]/gi, "secret='***'")
      .substring(0, 200); // 限制长度
  }

  /**
   * 获取性能指标
   */
  getMetrics() {
    const poolStats = this.getPoolStats();

    return {
      pool: poolStats,
      queries: { ...this.metrics.queries },
      performance: { ...this.metrics.performance },
      recentQueries: this.queryHistory.slice(-10),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 健康检查
   */
  async healthCheck() {
    try {
      // 简单的连接测试
      const result = await this.query('SELECT 1 as health_check');
      const isHealthy = result.rows[0].health_check === 1;

      const poolStats = this.getPoolStats();

      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        pool: poolStats,
        metrics: this.getMetrics(),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 启动健康检查
   */
  startHealthChecks() {
    this.healthCheckTimer = setInterval(async () => {
      try {
        const health = await this.healthCheck();
        if (health.status !== 'healthy') {
          logger.warn('数据库连接池健康检查失败', health);
        }
      } catch (error) {
        logger.error('数据库健康检查异常', error);
      }
    }, 30000); // 每30秒检查一次
  }

  /**
   * 停止健康检查
   */
  stopHealthChecks() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  /**
   * 优雅关闭
   */
  async close() {
    this.stopHealthChecks();

    if (this.pool) {
      logger.info('关闭数据库连接池...');
      await this.pool.end();
      this.pool = null;
      this.isConnected = false;
      logger.info('数据库连接池已关闭');
    }
  }

  /**
   * 获取客户端连接（高级用法）
   */
  async getClient() {
    if (!this.pool) {
      throw new Error('连接池未初始化');
    }

    return await this.pool.connect();
  }

  /**
   * 释放客户端连接
   */
  releaseClient(client) {
    if (client) {
      client.release();
    }
  }

  /**
   * 执行批量查询
   */
  async batchQuery(queries) {
    const results = [];
    const client = await this.getClient();

    try {
      await client.query('BEGIN');

      for (const { text, params } of queries) {
        const result = await client.query(text, params);
        results.push(result);
      }

      await client.query('COMMIT');
      return results;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      this.releaseClient(client);
    }
  }

  /**
   * 准备语句（Prepared Statements）
   */
  async prepare(name, text, paramCount = 0) {
    const client = await this.getClient();

    try {
      await client.query({
        name,
        text,
        values: new Array(paramCount).fill(null),
      });

      logger.debug('准备语句已创建', { name });
      return name;
    } finally {
      this.releaseClient(client);
    }
  }

  /**
   * 执行准备语句
   */
  async executePrepared(name, params = []) {
    return await this.query({
      name,
      values: params,
    });
  }

  /**
   * 清理准备语句
   */
  async deallocate(name) {
    const client = await this.getClient();

    try {
      await client.query(`DEALLOCATE ${name}`);
      logger.debug('准备语句已清理', { name });
    } finally {
      this.releaseClient(client);
    }
  }
}

export default DatabaseConnectionPool;
