/**
 * 数据库优化器
 * 提供索引优化、查询分析和性能调优功能
 */

import { logger } from '../../shared/utils/logger.js';

export class DatabaseOptimizer {
  constructor(connectionPool) {
    this.pool = connectionPool;
    this.indexes = new Map();
    this.queryAnalysis = new Map();
    this.optimizationHistory = [];
  }

  /**
   * 分析查询性能
   */
  async analyzeQuery(query, params = []) {
    const startTime = Date.now();

    try {
      // 执行EXPLAIN ANALYZE
      const explainQuery = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`;
      const result = await this.pool.query(explainQuery, params);

      const analysisTime = Date.now() - startTime;

      const analysis = {
        query: this.pool.sanitizeQuery(query),
        params: params.length,
        executionTime: analysisTime,
        plan: result.rows[0]['QUERY PLAN']
          ? JSON.parse(result.rows[0]['QUERY PLAN'])
          : result.rows[0],
        timestamp: new Date().toISOString(),
      };

      // 存储分析结果
      const key = this.generateQueryKey(query);
      this.queryAnalysis.set(key, analysis);

      logger.debug('查询分析完成', {
        query: analysis.query,
        executionTime: analysis.executionTime,
        planTime: analysis.plan[0]?.['Execution Time'] || 'N/A',
      });

      return analysis;
    } catch (error) {
      logger.error('查询分析失败', error);
      throw error;
    }
  }

  /**
   * 分析慢查询
   */
  async analyzeSlowQueries(threshold = 1000) {
    try {
      // 获取当前活动的慢查询
      const query = `
        SELECT
          pid,
          now() - pg_stat_activity.query_start AS duration,
          query,
          state,
          wait_event_type,
          wait_event
        FROM pg_stat_activity
        WHERE state = 'active'
          AND now() - pg_stat_activity.query_start > interval '${threshold} milliseconds'
          AND query NOT LIKE '%pg_stat_activity%'
        ORDER BY duration DESC
        LIMIT 10;
      `;

      const result = await this.pool.query(query);

      const slowQueries = result.rows.map((row) => ({
        pid: row.pid,
        duration: row.duration,
        query: this.pool.sanitizeQuery(row.query),
        state: row.state,
        waitEventType: row.wait_event_type,
        waitEvent: row.wait_event,
      }));

      logger.info('慢查询分析完成', {
        count: slowQueries.length,
        threshold: `${threshold}ms`,
      });

      return slowQueries;
    } catch (error) {
      logger.error('慢查询分析失败', error);
      return [];
    }
  }

  /**
   * 创建索引
   */
  async createIndex(table, columns, options = {}) {
    try {
      const indexName = options.name || this.generateIndexName(table, columns);
      const unique = options.unique ? 'UNIQUE' : '';
      const method = options.method || 'btree';

      let indexQuery;

      if (Array.isArray(columns)) {
        const columnList = columns.join(', ');
        indexQuery = `
          CREATE ${unique} INDEX CONCURRENTLY ${indexName}
          ON ${table} USING ${method} (${columnList})
        `;
      } else {
        // 表达式索引
        indexQuery = `
          CREATE ${unique} INDEX CONCURRENTLY ${indexName}
          ON ${table} USING ${method} (${columns})
        `;
      }

      if (options.where) {
        indexQuery += ` WHERE ${options.where}`;
      }

      await this.pool.query(indexQuery);

      // 记录索引信息
      const indexInfo = {
        name: indexName,
        table,
        columns: Array.isArray(columns) ? columns : [columns],
        method,
        unique: !!options.unique,
        partial: !!options.where,
        createdAt: new Date().toISOString(),
      };

      this.indexes.set(indexName, indexInfo);

      logger.info('索引创建成功', indexInfo);

      return indexInfo;
    } catch (error) {
      logger.error('索引创建失败', error);
      throw error;
    }
  }

  /**
   * 删除索引
   */
  async dropIndex(indexName) {
    try {
      await this.pool.query(`DROP INDEX CONCURRENTLY IF EXISTS ${indexName}`);

      this.indexes.delete(indexName);

      logger.info('索引删除成功', { indexName });
      return true;
    } catch (error) {
      logger.error('索引删除失败', error);
      throw error;
    }
  }

  /**
   * 分析表统计信息
   */
  async analyzeTable(tableName) {
    try {
      await this.pool.query(`ANALYZE ${tableName}`);

      logger.info('表统计信息更新完成', { table: tableName });
      return true;
    } catch (error) {
      logger.error('表统计信息更新失败', error);
      throw error;
    }
  }

  /**
   * 重新索引表
   */
  async reindexTable(tableName, concurrently = true) {
    try {
      const concurrentlyClause = concurrently ? 'CONCURRENTLY' : '';
      await this.pool.query(`REINDEX TABLE ${concurrentlyClause} ${tableName}`);

      logger.info('表重新索引完成', { table: tableName, concurrently });
      return true;
    } catch (error) {
      logger.error('表重新索引失败', error);
      throw error;
    }
  }

  /**
   * 获取表大小信息
   */
  async getTableSizes() {
    try {
      const query = `
        SELECT
          schemaname,
          tablename,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
          pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
        FROM pg_tables
        WHERE schemaname = 'public'
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
      `;

      const result = await this.pool.query(query);

      return result.rows.map((row) => ({
        schema: row.schemaname,
        table: row.tablename,
        size: row.size,
        sizeBytes: parseInt(row.size_bytes),
      }));
    } catch (error) {
      logger.error('获取表大小信息失败', error);
      return [];
    }
  }

  /**
   * 获取索引使用统计
   */
  async getIndexUsage() {
    try {
      const query = `
        SELECT
          schemaname,
          tablename,
          indexname,
          idx_scan,
          idx_tup_read,
          idx_tup_fetch
        FROM pg_stat_user_indexes
        WHERE schemaname = 'public'
        ORDER BY idx_scan DESC;
      `;

      const result = await this.pool.query(query);

      return result.rows.map((row) => ({
        schema: row.schemaname,
        table: row.tablename,
        index: row.indexname,
        scans: parseInt(row.idx_scan),
        tuplesRead: parseInt(row.idx_tup_read),
        tuplesFetched: parseInt(row.idx_tup_fetch),
      }));
    } catch (error) {
      logger.error('获取索引使用统计失败', error);
      return [];
    }
  }

  /**
   * 识别未使用的索引
   */
  async findUnusedIndexes() {
    const indexUsage = await this.getIndexUsage();

    return indexUsage.filter(
      (index) =>
        index.scans === 0 &&
        !index.index.includes('_pkey') && // 排除主键索引
        !index.index.includes('_uniq'), // 排除唯一约束索引
    );
  }

  /**
   * 优化建议
   */
  async getOptimizationRecommendations() {
    const recommendations = [];

    try {
      // 分析慢查询
      const slowQueries = await this.analyzeSlowQueries();
      if (slowQueries.length > 0) {
        recommendations.push({
          type: 'slow_queries',
          priority: 'high',
          message: `发现 ${slowQueries.length} 个慢查询`,
          details: slowQueries.slice(0, 5),
        });
      }

      // 分析未使用的索引
      const unusedIndexes = await this.findUnusedIndexes();
      if (unusedIndexes.length > 0) {
        recommendations.push({
          type: 'unused_indexes',
          priority: 'medium',
          message: `发现 ${unusedIndexes.length} 个未使用的索引`,
          details: unusedIndexes,
        });
      }

      // 分析表大小
      const tableSizes = await this.getTableSizes();
      const largeTables = tableSizes.filter(
        (table) => table.sizeBytes > 100 * 1024 * 1024,
      ); // 100MB
      if (largeTables.length > 0) {
        recommendations.push({
          type: 'large_tables',
          priority: 'medium',
          message: `发现 ${largeTables.length} 个大表`,
          details: largeTables,
        });
      }

      // 连接池状态
      const poolStats = this.pool.getPoolStats();
      if (poolStats.waitingCount > poolStats.max * 0.1) {
        recommendations.push({
          type: 'connection_pool',
          priority: 'high',
          message: '连接池等待队列过长，建议增加最大连接数',
          details: poolStats,
        });
      }
    } catch (error) {
      logger.error('生成优化建议失败', error);
    }

    return recommendations;
  }

  /**
   * 执行自动优化
   */
  async performAutoOptimization(options = {}) {
    const results = {
      optimizations: [],
      errors: [],
      timestamp: new Date().toISOString(),
    };

    try {
      // 更新表统计信息
      if (options.analyzeTables !== false) {
        const tables = await this.getTableSizes();
        for (const table of tables.slice(0, 10)) {
          // 只处理前10个表
          try {
            await this.analyzeTable(table.table);
            results.optimizations.push(`表 ${table.table} 统计信息已更新`);
          } catch (error) {
            results.errors.push(
              `表 ${table.table} 统计信息更新失败: ${error.message}`,
            );
          }
        }
      }

      // 删除未使用的索引
      if (options.dropUnusedIndexes) {
        const unusedIndexes = await this.findUnusedIndexes();
        for (const index of unusedIndexes) {
          try {
            await this.dropIndex(index.index);
            results.optimizations.push(`未使用的索引 ${index.index} 已删除`);
          } catch (error) {
            results.errors.push(
              `索引 ${index.index} 删除失败: ${error.message}`,
            );
          }
        }
      }

      logger.info('自动优化完成', results);
      return results;
    } catch (error) {
      logger.error('自动优化失败', error);
      results.errors.push(error.message);
      return results;
    }
  }

  /**
   * 监控数据库性能
   */
  async monitorPerformance() {
    try {
      const metrics = {
        timestamp: new Date().toISOString(),
        pool: this.pool.getPoolStats(),
        slowQueries: await this.analyzeSlowQueries(),
        tableSizes: await this.getTableSizes(),
        indexUsage: await this.getIndexUsage(),
        recommendations: await this.getOptimizationRecommendations(),
      };

      // 存储历史记录（保留最近24小时的数据）
      this.optimizationHistory.push(metrics);
      if (this.optimizationHistory.length > 24 * 60) {
        // 每分钟一个记录
        this.optimizationHistory.shift();
      }

      return metrics;
    } catch (error) {
      logger.error('性能监控失败', error);
      return { error: error.message };
    }
  }

  /**
   * 生成查询键
   */
  generateQueryKey(query) {
    // 简单的哈希函数
    let hash = 0;
    for (let i = 0; i < query.length; i++) {
      const char = query.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // 转换为32位整数
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * 生成索引名称
   */
  generateIndexName(table, columns) {
    const columnStr = Array.isArray(columns)
      ? columns.join('_')
      : columns.replace(/[^a-zA-Z0-9]/g, '_');
    return `idx_${table}_${columnStr}`;
  }

  /**
   * 获取优化历史
   */
  getOptimizationHistory(hours = 24) {
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    return this.optimizationHistory.filter(
      (record) => new Date(record.timestamp).getTime() > cutoff,
    );
  }

  /**
   * 导出优化报告
   */
  async generateOptimizationReport() {
    const report = {
      timestamp: new Date().toISOString(),
      database: {
        pool: this.pool.getPoolStats(),
        metrics: this.pool.getMetrics(),
      },
      analysis: {
        slowQueries: await this.analyzeSlowQueries(),
        tableSizes: await this.getTableSizes(),
        indexUsage: await this.getIndexUsage(),
        unusedIndexes: await this.findUnusedIndexes(),
      },
      recommendations: await this.getOptimizationRecommendations(),
      recentOptimizations: this.optimizationHistory.slice(-10),
    };

    return report;
  }
}

export default DatabaseOptimizer;
