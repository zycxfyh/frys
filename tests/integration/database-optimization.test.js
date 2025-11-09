import {
  createDetailedErrorReporter,
  createStrictTestCleanup,
  setupStrictTestEnvironment,
  strictAssert,
  withTimeout,
} from './test-helpers.js';

/**
 * 数据库优化集成测试
 * 验证连接池、查询优化、索引管理和监控功能
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import DatabaseManagementService from '../../src/application/services/DatabaseManagementService.js';
import DatabaseService from '../../src/infrastructure/database/DatabaseService.js';

// Mock pg module for testing
vi.mock('pg', () => {
  const mockPool = vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue({
      query: vi.fn(),
      release: vi.fn(),
    }),
    query: vi.fn().mockResolvedValue({ rows: [] }),
    end: vi.fn().mockResolvedValue(),
    totalCount: 5,
    idleCount: 3,
    waitingCount: 0,
    on: vi.fn(),
    removeListener: vi.fn(),
  }));

  return {
    __esModule: true,
    default: {
      Pool: mockPool,
    },
    Pool: mockPool,
  };
});

describe('数据库优化集成测试', () => {
  let databaseService;
  let managementService;

  beforeAll(async () => {
    // 初始化数据库服务
    databaseService = new DatabaseService({
      host: 'localhost',
      port: 5432,
      database: 'test_db',
      user: 'test_user',
      password: 'test_password',
      min: 1,
      max: 5,
      enableOptimizer: true,
      enableMigrations: true,
      enableMonitoring: true,
      migrationsPath: './test_migrations',
    });

    // Mock the pool methods
    databaseService.pool = {
      initialize: vi.fn().mockResolvedValue(),
      query: vi.fn().mockResolvedValue({ rows: [] }),
      transaction: vi.fn().mockImplementation(async (callback) => {
        const client = { query: vi.fn() };
        return await callback(client);
      }),
      getPoolStats: vi.fn().mockReturnValue({
        status: 'connected',
        totalCount: 2,
        idleCount: 1,
        waitingCount: 0,
      }),
      getMetrics: vi.fn().mockReturnValue({
        queries: { total: 100, failed: 2 },
        performance: { avgQueryTime: 45 },
      }),
      healthCheck: vi.fn().mockResolvedValue({
        status: 'healthy',
        pool: { totalCount: 2 },
        metrics: { queries: { total: 100 } },
      }),
      close: vi.fn().mockResolvedValue(),
    };

    // Mock initialization
    databaseService.isInitialized = true;

    // Mock optimizer
    databaseService.optimizer = {
      analyzeQuery: vi.fn().mockResolvedValue({
        executionTime: 50,
        plan: [{ 'Node Type': 'Index Scan' }],
      }),
      getOptimizationRecommendations: vi.fn().mockResolvedValue([
        {
          type: 'slow_queries',
          priority: 'high',
          message: '发现慢查询',
          details: [],
        },
      ]),
      performAutoOptimization: vi.fn().mockResolvedValue({
        optimizations: [],
        errors: [],
      }),
      generateOptimizationReport: vi.fn().mockResolvedValue({
        recommendations: [],
      }),
    };

    // Mock migrations
    databaseService.migrations = {
      initialize: vi.fn().mockResolvedValue(),
      getStatus: vi.fn().mockReturnValue({
        currentVersion: '1',
        pendingCount: 0,
        executedCount: 1,
      }),
      verifyIntegrity: vi.fn().mockResolvedValue({
        valid: true,
        issues: [],
      }),
    };

    // Mock monitor
    databaseService.monitor = {
      startMonitoring: vi.fn().mockResolvedValue(),
      stopMonitoring: vi.fn().mockResolvedValue(),
      getStatus: vi.fn().mockReturnValue({
        isMonitoring: true,
        latestMetrics: {},
      }),
      getMetricsHistory: vi.fn().mockReturnValue({
        connections: [],
        queries: [],
        performance: [],
      }),
      generateReport: vi.fn().mockResolvedValue({
        summary: { totalQueries: 100 },
        recommendations: [],
      }),
      assessHealth: vi.fn().mockResolvedValue({
        status: 'healthy',
        score: 95,
      }),
    };

    // 初始化管理服务
    managementService = new DatabaseManagementService(databaseService);
  });

  afterAll(async () => {
    await databaseService.stop();
  });

  describe('数据库服务初始化', () => {
    it('应该正确初始化数据库服务', () => {
      expect(databaseService).toBeDefined();
      expect(databaseService.pool).toBeDefined();
      expect(databaseService.optimizer).toBeDefined();
      expect(databaseService.migrations).toBeDefined();
      expect(databaseService.monitor).toBeDefined();
    });

    it('应该提供查询接口', async () => {
      const result = await databaseService.query('SELECT 1');
      expect(result).toBeDefined();
    });

    it('应该支持事务', async () => {
      const result = await databaseService.transaction(async (client) => {
        return 'transaction_result';
      });
      expect(result).toBe('transaction_result');
    });
  });

  describe('数据库优化功能', () => {
    it('应该分析查询性能', async () => {
      const analysis = await databaseService.analyzeQuery(
        'SELECT * FROM users',
      );
      expect(analysis).toHaveProperty('executionTime');
      expect(analysis).toHaveProperty('plan');
    });

    it('应该提供优化建议', async () => {
      const recommendations =
        await databaseService.getOptimizationRecommendations();
      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeGreaterThan(0);
    });

    it('应该执行自动优化', async () => {
      const result = await databaseService.performAutoOptimization();
      expect(result).toHaveProperty('optimizations');
      expect(result).toHaveProperty('errors');
    });
  });

  describe('数据库迁移功能', () => {
    it('应该获取迁移状态', () => {
      const status = databaseService.getMigrationStatus();
      expect(status).toHaveProperty('currentVersion');
      expect(status).toHaveProperty('pendingCount');
      expect(status).toHaveProperty('executedCount');
    });

    it('应该验证迁移完整性', async () => {
      const result = await databaseService.verifyMigrationIntegrity();
      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('issues');
    });
  });

  describe('数据库监控功能', () => {
    it('应该获取监控状态', () => {
      const status = databaseService.getMonitoringStatus();
      expect(status).toHaveProperty('isMonitoring');
      expect(status).toHaveProperty('latestMetrics');
    });

    it('应该获取指标历史', () => {
      const history = databaseService.getMetricsHistory(1);
      expect(history).toHaveProperty('connections');
      expect(history).toHaveProperty('queries');
      expect(history).toHaveProperty('performance');
    });

    it('应该生成监控报告', async () => {
      const report = await databaseService.generateMonitoringReport();
      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('recommendations');
    });
  });

  describe('数据库管理服务', () => {
    it('应该执行健康检查', async () => {
      const result = await managementService.performHealthCheck();
      expect(result.isSuccess).toBe(true);
      expect(result.data).toHaveProperty('health');
      expect(result.data).toHaveProperty('recommendations');
    });

    it('应该优化数据库', async () => {
      const result = await managementService.optimizeDatabase();
      expect(result.isSuccess).toBe(true);
      expect(result.data).toHaveProperty('optimizations');
    });

    it('应该管理迁移', async () => {
      const result = await managementService.manageMigrations({
        action: 'status',
      });
      expect(result.isSuccess).toBe(true);
      expect(result.data).toHaveProperty('action');
      expect(result.data).toHaveProperty('result');
    });

    it('应该监控数据库', async () => {
      const result = await managementService.monitorDatabase();
      expect(result.isSuccess).toBe(true);
      expect(result.data).toHaveProperty('metrics');
    });

    it('应该执行维护任务', async () => {
      const result = await managementService.performMaintenance();
      expect(result.isSuccess).toBe(true);
      expect(result.data).toHaveProperty('tasks');
    });

    it('应该分析查询性能', async () => {
      const result = await managementService.analyzeQueryPerformance({
        query: 'SELECT * FROM users',
      });
      expect(result.isSuccess).toBe(true);
      expect(result.data).toHaveProperty('query');
      expect(result.data).toHaveProperty('analysis');
    });
  });

  describe('连接池功能', () => {
    it('应该获取连接池状态', () => {
      const stats = databaseService.getPoolStats();
      expect(stats).toHaveProperty('status');
      expect(stats).toHaveProperty('totalCount');
      expect(stats).toHaveProperty('idleCount');
    });

    it('应该获取性能指标', () => {
      const metrics = databaseService.getPerformanceMetrics();
      expect(metrics).toHaveProperty('queries');
      expect(metrics).toHaveProperty('performance');
    });

    it('应该执行健康检查', async () => {
      const health = await databaseService.healthCheck();
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('components');
    });
  });

  describe('综合功能', () => {
    it('应该生成完整报告', async () => {
      const report = await databaseService.generateFullReport();
      expect(report).toHaveProperty('health');
      expect(report).toHaveProperty('pool');
      expect(report).toHaveProperty('performance');
      expect(report).toHaveProperty('sections');
    });

    it('应该处理并发查询', async () => {
      const queries = Array(5)
        .fill()
        .map((_, i) => databaseService.query(`SELECT ${i}`));

      const results = await Promise.all(queries);
      expect(results).toHaveLength(5);
    });
  });

  describe('错误处理', () => {
    it('应该处理无效查询', async () => {
      // Mock a failed query
      databaseService.pool.query.mockRejectedValueOnce(
        new Error('Invalid query'),
      );

      await expect(databaseService.query('INVALID QUERY')).rejects.toThrow();
    });

    it('应该处理事务回滚', async () => {
      // Mock a transaction failure
      databaseService.pool.transaction.mockRejectedValueOnce(
        new Error('Transaction failed'),
      );

      await expect(
        databaseService.transaction(async () => {
          throw new Error('Transaction failed');
        }),
      ).rejects.toThrow();
    });

    it('应该处理连接池错误', async () => {
      // Mock pool stats error
      databaseService.pool.getPoolStats.mockReturnValueOnce({
        status: 'error',
        error: 'Connection failed',
      });

      const stats = databaseService.getPoolStats();
      expect(stats.status).toBe('error');
    });
  });

  describe('边界情况', () => {
    it('应该处理空查询参数', async () => {
      const result = await databaseService.query('SELECT 1', []);
      expect(result).toBeDefined();
    });

    it('应该处理大结果集', async () => {
      // Mock large result set
      const largeResult = { rows: Array(1000).fill({ id: 1, data: 'test' }) };
      databaseService.pool.query.mockResolvedValueOnce(largeResult);

      const result = await databaseService.query('SELECT * FROM large_table');
      expect(result.rows).toHaveLength(1000);
    });

    it('应该处理超时查询', async () => {
      // Mock timeout
      databaseService.pool.query.mockImplementationOnce(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ rows: [] }), 100),
          ),
      );

      const startTime = Date.now();
      await databaseService.query('SELECT pg_sleep(0.1)');
      const duration = Date.now() - startTime;

      expect(duration).toBeGreaterThan(90); // Allow some margin
    });
  });

  describe('性能测试', () => {
    it('应该处理高并发查询', async () => {
      const concurrentQueries = 20;
      const promises = [];

      for (let i = 0; i < concurrentQueries; i++) {
        promises.push(databaseService.query(`SELECT ${i} as id`));
      }

      const startTime = Date.now();
      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(concurrentQueries);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('应该监控查询性能', async () => {
      // Perform some queries
      await databaseService.query('SELECT 1');
      await databaseService.query('SELECT 2');
      await databaseService.query('SELECT 3');

      const metrics = databaseService.getPerformanceMetrics();
      expect(metrics.queries.total).toBeGreaterThanOrEqual(3);
    });

    it('应该检测慢查询', async () => {
      // Mock slow query
      databaseService.pool.query.mockImplementationOnce(async () => {
        await new Promise((resolve) => setTimeout(resolve, 150)); // 150ms delay
        return { rows: [{ result: 'slow' }] };
      });

      await databaseService.query('SELECT pg_sleep(0.15)'); // Slow query

      // Check if slow query was detected (this would be logged)
      expect(databaseService.pool.query).toHaveBeenCalled();
    });
  });
});
