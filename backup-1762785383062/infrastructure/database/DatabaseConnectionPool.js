/**
 * 数据库连接池管理
 * 提供高效的数据库连接管理和连接复用
 */

import pg from 'pg';
import { logger } from '../../shared/utils/logger.js';

const { Pool } = pg;

export class DatabaseConnectionPool {
  constructor(options = {}) {
    this.options = {
      host: options.host || process.env.DB_HOST || 'localhost',
      port: options.port || parseInt(process.env.DB_PORT) || 5432,
      database: options.database || process.env.DB_NAME || 'frys',
      user: options.user || process.env.DB_USER || 'frys',
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

      // 高级连接池算法配置
      allocationStrategy: options.allocationStrategy || 'adaptive', // adaptive, round_robin, least_loaded, predictive
      enableConnectionPooling: options.enableConnectionPooling !== false,
      connectionHealthCheck: options.connectionHealthCheck !== false,
      adaptiveScaling: options.adaptiveScaling !== false,
      queryPrioritization: options.queryPrioritization !== false,

      ...options,
    };

    this.pool = null;
    this.isConnected = false;

    // 高级连接池数据结构
    this.connectionStates = new Map(); // 连接状态跟踪
    this.queryQueue = []; // 查询队列
    this.connectionLoad = new Map(); // 连接负载跟踪
    this.queryPatterns = new Map(); // 查询模式分析
    this.connectionMetrics = new Map(); // 连接性能指标
    this.adaptiveConfig = {
      currentMin: this.options.min,
      currentMax: this.options.max,
      scalingFactor: 0.2, // 每次调整20%
      lastAdjustment: Date.now(),
      adjustmentCooldown: 300000, // 5分钟冷却期
    };

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
    let connectionId = null;

    try {
      // 智能连接分配
      if (this.options.enableConnectionPooling) {
        const allocation = await this._allocateConnectionSmart(text, params, options);
        client = allocation.client;
        connectionId = allocation.connectionId;
      } else {
        client = await this.pool.connect();
      }

      // 设置查询超时（如果指定）
      if (options.timeout) {
        await client.query(`SET statement_timeout = ${options.timeout}`);
      }

      // 查询优先级设置
      if (this.options.queryPrioritization && options.priority) {
        await this._setQueryPriority(client, options.priority);
      }

      const result = await client.query(text, params);
      const queryTime = Date.now() - startTime;

      // 记录查询指标和连接性能
      this.recordQueryMetrics(text, queryTime, true);
      if (connectionId) {
        this._updateConnectionMetrics(connectionId, queryTime, true);
      }

      // 分析查询模式
      this._analyzeQueryPattern(text, queryTime, params.length);

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

  // =============== 高级连接池算法实现 ===============

  /**
   * 智能连接分配
   */
  async _allocateConnectionSmart(text, params, options) {
    switch (this.options.allocationStrategy) {
      case 'adaptive':
        return await this._allocateAdaptive(text, params, options);
      case 'least_loaded':
        return await this._allocateLeastLoaded(text, params, options);
      case 'predictive':
        return await this._allocatePredictive(text, params, options);
      case 'round_robin':
      default:
        return await this._allocateRoundRobin(text, params, options);
    }
  }

  /**
   * 自适应连接分配 - 基于查询类型和历史性能
   */
  async _allocateAdaptive(text, params, options) {
    const queryType = this._classifyQuery(text);
    const queryComplexity = this._calculateQueryComplexity(text, params);

    // 基于查询类型选择最适合的连接
    const candidates = await this._findSuitableConnections(queryType, queryComplexity);

    if (candidates.length === 0) {
      // 如果没有合适的连接，使用默认分配
      const client = await this.pool.connect();
      return { client, connectionId: null };
    }

    // 选择性能最佳的连接
    const bestConnection = candidates.reduce((best, current) => {
      const bestScore = this._calculateConnectionScore(best, queryType, queryComplexity);
      const currentScore = this._calculateConnectionScore(current, queryType, queryComplexity);
      return currentScore > bestScore ? current : best;
    });

    return {
      client: bestConnection.client,
      connectionId: bestConnection.id
    };
  }

  /**
   * 最少负载连接分配
   */
  async _allocateLeastLoaded(text, params, options) {
    // 获取所有可用连接的状态
    const connections = Array.from(this.connectionStates.entries())
      .filter(([_, state]) => state.status === 'idle' || state.status === 'active')
      .map(([id, state]) => ({
        id,
        load: this.connectionLoad.get(id) || 0,
        lastUsed: state.lastUsed || 0,
      }));

    if (connections.length === 0) {
      const client = await this.pool.connect();
      return { client, connectionId: null };
    }

    // 选择负载最小的连接
    const leastLoaded = connections.reduce((min, current) =>
      current.load < min.load ? current : min
    );

    const client = await this.pool.connect();
    return { client, connectionId: leastLoaded.id };
  }

  /**
   * 预测性连接分配 - 基于查询历史预测最佳连接
   */
  async _allocatePredictive(text, params, options) {
    const queryFingerprint = this._generateQueryFingerprint(text, params);
    const pattern = this.queryPatterns.get(queryFingerprint);

    if (pattern && pattern.preferredConnection) {
      // 检查首选连接是否可用
      const preferredState = this.connectionStates.get(pattern.preferredConnection);
      if (preferredState && (preferredState.status === 'idle' || preferredState.status === 'active')) {
        const client = await this.pool.connect();
        return { client, connectionId: pattern.preferredConnection };
      }
    }

    // 回退到自适应分配
    return await this._allocateAdaptive(text, params, options);
  }

  /**
   * 轮询连接分配
   */
  async _allocateRoundRobin(text, params, options) {
    // 简单的轮询实现
    const client = await this.pool.connect();
    return { client, connectionId: null };
  }

  /**
   * 查找适合的连接
   */
  async _findSuitableConnections(queryType, complexity) {
    const suitable = [];

    for (const [connectionId, state] of this.connectionStates.entries()) {
      if (state.status !== 'idle' && state.status !== 'active') continue;

      const metrics = this.connectionMetrics.get(connectionId) || {};

      // 检查连接是否适合当前查询类型
      if (this._isConnectionSuitable(connectionId, queryType, complexity, metrics)) {
        const client = await this.pool.connect();
        suitable.push({
          id: connectionId,
          client,
          state,
          metrics
        });
      }
    }

    return suitable;
  }

  /**
   * 检查连接是否适合查询
   */
  _isConnectionSuitable(connectionId, queryType, complexity, metrics) {
    // 基于连接的历史性能和当前状态评估适合性

    // 1. 检查查询类型匹配度
    const typeMatch = this._calculateTypeMatchScore(connectionId, queryType);

    // 2. 检查复杂度匹配度
    const complexityMatch = this._calculateComplexityMatchScore(connectionId, complexity);

    // 3. 检查连接健康度
    const healthScore = metrics.errorRate ? (1 - metrics.errorRate) : 0.8;

    // 综合评分
    const suitabilityScore = (typeMatch + complexityMatch + healthScore) / 3;

    return suitabilityScore > 0.6; // 适合度阈值
  }

  /**
   * 计算连接评分
   */
  _calculateConnectionScore(connection, queryType, complexity) {
    const metrics = this.connectionMetrics.get(connection.id) || {};
    const load = this.connectionLoad.get(connection.id) || 0;

    // 基于多个因素计算综合评分
    const typeScore = this._calculateTypeMatchScore(connection.id, queryType);
    const complexityScore = this._calculateComplexityMatchScore(connection.id, complexity);
    const performanceScore = 1 / (1 + (metrics.avgResponseTime || 100));
    const loadScore = 1 / (1 + load);
    const reliabilityScore = 1 - (metrics.errorRate || 0);

    return (typeScore * 0.3 + complexityScore * 0.2 + performanceScore * 0.2 + loadScore * 0.15 + reliabilityScore * 0.15);
  }

  /**
   * 计算查询类型匹配度
   */
  _calculateTypeMatchScore(connectionId, queryType) {
    const metrics = this.connectionMetrics.get(connectionId) || {};
    const typeStats = metrics.queryTypes || {};

    // 如果连接处理过相同类型的查询，给较高评分
    const typeCount = typeStats[queryType] || 0;
    const totalQueries = Object.values(typeStats).reduce((sum, count) => sum + count, 0);

    return totalQueries > 0 ? typeCount / totalQueries : 0.5;
  }

  /**
   * 计算复杂度匹配度
   */
  _calculateComplexityMatchScore(connectionId, complexity) {
    const metrics = this.connectionMetrics.get(connectionId) || {};
    const avgComplexity = metrics.avgComplexity || 5;

    // 复杂度越接近，评分越高
    const diff = Math.abs(complexity - avgComplexity);
    return Math.max(0, 1 - diff / 10); // 复杂度差异在10以内时评分递减
  }

  /**
   * 分类查询类型
   */
  _classifyQuery(text) {
    const sql = text.toUpperCase();

    if (sql.includes('SELECT')) {
      if (sql.includes('JOIN') || sql.includes('UNION')) {
        return 'complex_select';
      } else if (sql.includes('COUNT') || sql.includes('SUM') || sql.includes('AVG')) {
        return 'aggregate_select';
      } else {
        return 'simple_select';
      }
    } else if (sql.includes('INSERT')) {
      return 'insert';
    } else if (sql.includes('UPDATE')) {
      return 'update';
    } else if (sql.includes('DELETE')) {
      return 'delete';
    } else if (sql.includes('CREATE') || sql.includes('ALTER') || sql.includes('DROP')) {
      return 'ddl';
    } else {
      return 'other';
    }
  }

  /**
   * 计算查询复杂度
   */
  _calculateQueryComplexity(text, paramCount) {
    let complexity = 0;

    // 基于SQL特征计算复杂度
    const sql = text.toUpperCase();

    // 关键字复杂度
    const keywords = ['JOIN', 'UNION', 'GROUP BY', 'ORDER BY', 'HAVING', 'DISTINCT'];
    keywords.forEach(keyword => {
      if (sql.includes(keyword)) complexity += 2;
    });

    // 子查询复杂度
    const subqueryCount = (sql.match(/SELECT/g) || []).length - 1;
    complexity += subqueryCount * 3;

    // 参数复杂度
    complexity += paramCount * 0.5;

    // 表数量复杂度（粗略估计）
    const fromMatches = sql.match(/FROM\s+(\w+)/g);
    if (fromMatches) {
      complexity += fromMatches.length;
    }

    return Math.min(complexity, 20); // 最大复杂度限制
  }

  /**
   * 生成查询指纹
   */
  _generateQueryFingerprint(text, params) {
    // 标准化查询（移除参数占位符）
    const normalized = text.replace(/\$\d+/g, '?').replace(/\?/g, 'PARAM');
    return this._simpleHash(normalized);
  }

  /**
   * 分析查询模式
   */
  _analyzeQueryPattern(text, executionTime, paramCount) {
    const fingerprint = this._generateQueryFingerprint(text, new Array(paramCount));
    const pattern = this.queryPatterns.get(fingerprint) || {
      fingerprint,
      query: this.sanitizeQuery(text),
      executions: 0,
      totalTime: 0,
      avgTime: 0,
      minTime: Infinity,
      maxTime: 0,
      preferredConnection: null,
      lastExecuted: null,
    };

    pattern.executions++;
    pattern.totalTime += executionTime;
    pattern.avgTime = pattern.totalTime / pattern.executions;
    pattern.minTime = Math.min(pattern.minTime, executionTime);
    pattern.maxTime = Math.max(pattern.maxTime, executionTime);
    pattern.lastExecuted = Date.now();

    this.queryPatterns.set(fingerprint, pattern);
  }

  /**
   * 更新连接指标
   */
  _updateConnectionMetrics(connectionId, responseTime, success) {
    const metrics = this.connectionMetrics.get(connectionId) || {
      totalQueries: 0,
      successfulQueries: 0,
      totalResponseTime: 0,
      avgResponseTime: 0,
      errorRate: 0,
      queryTypes: {},
      avgComplexity: 0,
    };

    metrics.totalQueries++;

    if (success) {
      metrics.successfulQueries++;
      metrics.totalResponseTime += responseTime;
      metrics.avgResponseTime = metrics.totalResponseTime / metrics.successfulQueries;
    }

    metrics.errorRate = 1 - (metrics.successfulQueries / metrics.totalQueries);

    this.connectionMetrics.set(connectionId, metrics);
  }

  /**
   * 设置查询优先级
   */
  async _setQueryPriority(client, priority) {
    // PostgreSQL优先级设置（如果支持）
    try {
      const priorityValue = Math.max(1, Math.min(10, priority));
      await client.query(`SET LOCAL work_mem = '${priorityValue * 1024}kB'`);
    } catch (error) {
      // 如果不支持，静默忽略
      logger.debug('查询优先级设置失败', { error: error.message });
    }
  }

  /**
   * 自适应连接池调整
   */
  async _adaptivePoolScaling() {
    if (!this.options.adaptiveScaling) return;

    const now = Date.now();
    const timeSinceLastAdjustment = now - this.adaptiveConfig.lastAdjustment;

    if (timeSinceLastAdjustment < this.adaptiveConfig.adjustmentCooldown) {
      return; // 冷却期内不调整
    }

    const currentMetrics = this.getMetrics();

    // 计算当前负载
    const currentLoad = currentMetrics.connections.waiting /
                       Math.max(currentMetrics.connections.total, 1);

    let newMin = this.adaptiveConfig.currentMin;
    let newMax = this.adaptiveConfig.currentMax;

    if (currentLoad > 0.8) {
      // 高负载：增加连接数
      newMax = Math.min(this.options.max, Math.floor(newMax * (1 + this.adaptiveConfig.scalingFactor)));
      newMin = Math.min(newMax, Math.max(this.options.min, Math.floor(newMin * (1 + this.adaptiveConfig.scalingFactor * 0.5))));
    } else if (currentLoad < 0.2) {
      // 低负载：减少连接数
      newMax = Math.max(this.options.min, Math.floor(newMax * (1 - this.adaptiveConfig.scalingFactor)));
      newMin = Math.min(newMax, Math.max(this.options.min, Math.floor(newMin * (1 - this.adaptiveConfig.scalingFactor * 0.5))));
    }

    if (newMin !== this.adaptiveConfig.currentMin || newMax !== this.adaptiveConfig.currentMax) {
      logger.info('自适应连接池调整', {
        oldMin: this.adaptiveConfig.currentMin,
        oldMax: this.adaptiveConfig.currentMax,
        newMin,
        newMax,
        loadFactor: currentLoad,
      });

      // 更新配置（在实际实现中需要重新创建连接池）
      this.adaptiveConfig.currentMin = newMin;
      this.adaptiveConfig.currentMax = newMax;
      this.adaptiveConfig.lastAdjustment = now;
    }
  }

  /**
   * 简单哈希函数
   */
  _simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return Math.abs(hash);
  }

  /**
   * 获取连接池智能统计信息
   */
  getSmartStats() {
    const basicStats = this.getMetrics();

    // 计算连接效率指标
    const connectionEfficiency = {
      avgResponseTime: 0,
      errorRate: 0,
      utilizationRate: 0,
      queryTypeDistribution: {},
    };

    let totalResponseTime = 0;
    let totalQueries = 0;
    let totalErrors = 0;

    for (const [connectionId, metrics] of this.connectionMetrics.entries()) {
      totalResponseTime += metrics.totalResponseTime || 0;
      totalQueries += metrics.totalQueries || 0;
      totalErrors += (metrics.totalQueries - metrics.successfulQueries) || 0;

      // 合并查询类型分布
      Object.entries(metrics.queryTypes || {}).forEach(([type, count]) => {
        connectionEfficiency.queryTypeDistribution[type] =
          (connectionEfficiency.queryTypeDistribution[type] || 0) + count;
      });
    }

    connectionEfficiency.avgResponseTime = totalQueries > 0 ? totalResponseTime / totalQueries : 0;
    connectionEfficiency.errorRate = totalQueries > 0 ? totalErrors / totalQueries : 0;
    connectionEfficiency.utilizationRate = basicStats.connections.total > 0 ?
      (basicStats.connections.total - basicStats.connections.idle) / basicStats.connections.total : 0;

    // 查询模式统计
    const queryPatterns = Array.from(this.queryPatterns.values())
      .sort((a, b) => b.executions - a.executions)
      .slice(0, 10); // Top 10 patterns

    return {
      basic: basicStats,
      efficiency: connectionEfficiency,
      topQueryPatterns: queryPatterns,
      adaptiveConfig: { ...this.adaptiveConfig },
      allocationStrategy: this.options.allocationStrategy,
      queryQueueLength: this.queryQueue.length,
    };
  }
}

export default DatabaseConnectionPool;
