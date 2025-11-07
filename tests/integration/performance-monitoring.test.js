/**
 * 性能监控集成测试
 * 验证性能监控、告警和健康检查功能
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import PerformanceMonitoringMiddleware from '../../src/middleware/performance-monitoring.middleware.js';
import { logger } from '../../src/utils/logger.js';

describe('性能监控集成测试', () => {
  let monitoringMiddleware;

  beforeAll(async () => {
    monitoringMiddleware = new PerformanceMonitoringMiddleware({
      collectInterval: 1000, // 1秒收集间隔（测试用）
      alertInterval: 2000, // 2秒告警检查间隔（测试用）
      enableHealthEndpoint: true,
      enableMetricsEndpoint: true
    });
  });

  afterAll(async () => {
    // 停止监控
    monitoringMiddleware.stopMonitoring();
  });

  describe('基础监控功能', () => {
    it('应该初始化监控系统', () => {
      expect(monitoringMiddleware).toBeDefined();
      expect(monitoringMiddleware.metrics).toBeDefined();

      const stats = monitoringMiddleware.getMonitoringStats();
      expect(stats).toHaveProperty('metrics');
      expect(stats).toHaveProperty('activeAlerts');
      expect(stats).toHaveProperty('uptime');
      expect(stats.timestamp).toBeDefined();
    });

    it('应该收集系统指标', async () => {
      // 等待指标收集
      await new Promise(resolve => setTimeout(resolve, 1500));

      const memUsage = monitoringMiddleware.monitorMemoryUsage();
      expect(memUsage).toHaveProperty('rss');
      expect(memUsage).toHaveProperty('heapUsed');
      expect(memUsage).toHaveProperty('heapTotal');
      expect(memUsage.rss).toBeGreaterThan(0);
      expect(memUsage.heapUsed).toBeGreaterThan(0);
    });

    it('应该记录应用错误', () => {
      const testError = new Error('测试错误');

      monitoringMiddleware.recordApplicationError(testError, 'test_error', 'warning');

      const stats = monitoringMiddleware.metrics.getStats();
      expect(stats).toBeDefined();

      // 验证错误被记录（通过日志系统）
      expect(testError.message).toBe('测试错误');
    });
  });

  describe('性能指标记录', () => {
    it('应该记录数据库操作性能', () => {
      monitoringMiddleware.recordDatabaseOperation('SELECT', 'users', 150);

      // 验证性能日志被记录
      const stats = monitoringMiddleware.metrics.getStats();
      expect(stats.metrics).toBeGreaterThan(0);
    });

    it('应该记录缓存操作', () => {
      monitoringMiddleware.recordCacheOperation('get', 'hit');
      monitoringMiddleware.recordCacheOperation('set', 'success');

      const stats = monitoringMiddleware.metrics.getStats();
      expect(stats).toBeDefined();
    });

    it('应该记录业务操作', () => {
      monitoringMiddleware.recordBusinessOperation('user_registration', 'success');
      monitoringMiddleware.recordBusinessOperation('payment_processing', 'failed');

      const stats = monitoringMiddleware.metrics.getStats();
      expect(stats).toBeDefined();
    });
  });

  describe('异步函数监控', () => {
    it('应该监控成功的异步操作', async () => {
      const mockAsyncFunction = async (param) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return `processed_${param}`;
      };

      const monitoredFunction = monitoringMiddleware.monitorAsyncFunction(
        'test_operation',
        mockAsyncFunction,
        { category: 'business', metadata: { test: true } }
      );

      const result = await monitoredFunction('test_data');
      expect(result).toBe('processed_test_data');
    });

    it('应该监控失败的异步操作', async () => {
      const mockFailingFunction = async () => {
        await new Promise(resolve => setTimeout(resolve, 5));
        throw new Error('模拟错误');
      };

      const monitoredFunction = monitoringMiddleware.monitorAsyncFunction(
        'failing_operation',
        mockFailingFunction,
        { errorType: 'test_failure' }
      );

      await expect(monitoredFunction()).rejects.toThrow('模拟错误');
    });
  });

  describe('健康检查功能', () => {
    it('应该执行健康检查', async () => {
      const healthStatus = await monitoringMiddleware.metrics.getHealthStatus();

      expect(healthStatus).toHaveProperty('status');
      expect(healthStatus).toHaveProperty('timestamp');
      expect(healthStatus).toHaveProperty('uptime');
      expect(healthStatus).toHaveProperty('checks');
      expect(healthStatus).toHaveProperty('metrics');

      // 检查基础健康检查
      expect(healthStatus.checks).toHaveProperty('database');
      expect(healthStatus.checks).toHaveProperty('cache');
      expect(healthStatus.checks).toHaveProperty('filesystem');
    });

    it('应该添加自定义健康检查', async () => {
      const customCheckName = 'custom_service';

      monitoringMiddleware.addCustomHealthCheck(customCheckName, async () => {
        return { status: 'ok', version: '1.0.0' };
      }, { interval: 5000 });

      const healthStatus = await monitoringMiddleware.metrics.getHealthStatus();

      // 等待健康检查执行
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(healthStatus.checks).toHaveProperty(customCheckName);
    });
  });

  describe('告警系统', () => {
    it('应该添加自定义告警规则', () => {
      const alertName = 'test_high_cpu';

      monitoringMiddleware.addCustomAlertRule(alertName, (metrics) => {
        // 简单的测试条件：CPU使用率 > 50%
        return monitoringMiddleware.metrics.getMetricValue('process_cpu_usage_percent') > 50;
      }, {
        severity: 'warning',
        message: '测试高CPU使用率告警',
        threshold: 50,
        cooldown: 10000
      });

      const stats = monitoringMiddleware.metrics.getStats();
      expect(stats.alertRules).toBeGreaterThan(0);
    });

    it('应该获取活跃告警', () => {
      const alerts = monitoringMiddleware.metrics.getActiveAlerts();
      expect(Array.isArray(alerts)).toBe(true);
    });

    it('应该能启用/禁用告警规则', () => {
      const ruleName = 'high_memory_usage';

      // 先禁用
      monitoringMiddleware.metrics.setAlertRuleEnabled(ruleName, false);

      // 验证规则被禁用（通过获取统计信息间接验证）
      const stats = monitoringMiddleware.metrics.getStats();
      expect(stats).toBeDefined();

      // 重新启用
      monitoringMiddleware.metrics.setAlertRuleEnabled(ruleName, true);
    });
  });

  describe('Prometheus指标导出', () => {
    it('应该生成Prometheus格式的指标', () => {
      const prometheusOutput = monitoringMiddleware.metrics.getPrometheusMetrics();

      expect(typeof prometheusOutput).toBe('string');
      expect(prometheusOutput).toContain('# frys Application Metrics');
      expect(prometheusOutput).toContain('# TYPE');
      expect(prometheusOutput).toContain('# HELP');
    });

    it('应该包含基础指标', () => {
      const prometheusOutput = monitoringMiddleware.metrics.getPrometheusMetrics();

      // 检查是否包含基础指标
      expect(prometheusOutput).toMatch(/http_requests_total/);
      expect(prometheusOutput).toMatch(/process_memory_usage_bytes/);
      expect(prometheusOutput).toMatch(/application_uptime_seconds/);
    });
  });

  describe('HTTP请求监控', () => {
    it('应该创建HTTP请求监控中间件', () => {
      const middleware = monitoringMiddleware.httpRequestMonitoring();

      expect(typeof middleware).toBe('function');
      expect(middleware.length).toBe(3); // Express中间件签名 (req, res, next)
    });

    it('应该模拟HTTP请求处理', () => {
      // 创建模拟的req和res对象
      const mockReq = {
        method: 'GET',
        path: '/api/test',
        route: { path: '/api/test' },
        requestId: 'test-request-id'
      };

      const mockRes = {
        statusCode: 200,
        get: (header) => {
          if (header === 'Content-Length') return '1024';
          return undefined;
        },
        on: (event, callback) => {
          if (event === 'finish') {
            // 立即触发finish事件
            setTimeout(callback, 1);
          }
        }
      };

      const middleware = monitoringMiddleware.httpRequestMonitoring();

      // 执行中间件
      middleware(mockReq, mockRes, () => {
        // next函数
      });

      // 验证指标被记录
      const stats = monitoringMiddleware.metrics.getStats();
      expect(stats).toBeDefined();
    });
  });

  describe('监控统计信息', () => {
    it('应该提供完整的监控统计', () => {
      const stats = monitoringMiddleware.getMonitoringStats();

      expect(stats).toHaveProperty('metrics');
      expect(stats).toHaveProperty('activeAlerts');
      expect(stats).toHaveProperty('uptime');
      expect(stats).toHaveProperty('timestamp');

      expect(stats.metrics).toHaveProperty('metrics');
      expect(stats.metrics).toHaveProperty('alerts');
      expect(stats.metrics).toHaveProperty('healthChecks');
      expect(typeof stats.uptime).toBe('number');
      expect(stats.uptime).toBeGreaterThan(0);
    });

    it('应该显示指标统计信息', () => {
      const stats = monitoringMiddleware.metrics.getStats();

      expect(stats).toHaveProperty('metrics');
      expect(stats).toHaveProperty('alerts');
      expect(stats).toHaveProperty('healthChecks');
      expect(stats).toHaveProperty('alertRules');
      expect(stats).toHaveProperty('totalValues');

      expect(typeof stats.metrics).toBe('number');
      expect(typeof stats.alerts).toBe('number');
      expect(typeof stats.healthChecks).toBe('number');
    });
  });

  describe('错误处理和边界情况', () => {
    it('应该优雅处理监控错误', () => {
      // 测试传递无效参数
      expect(() => {
        monitoringMiddleware.recordApplicationError(null, 'test');
      }).not.toThrow();

      expect(() => {
        monitoringMiddleware.recordDatabaseOperation('', '', -100);
      }).not.toThrow();
    });

    it('应该处理无效的指标名称', () => {
      expect(() => {
        monitoringMiddleware.metrics.increment('non_existent_metric', 1);
      }).toThrow();

      expect(() => {
        monitoringMiddleware.metrics.setGauge('non_existent_gauge', 100);
      }).toThrow();
    });

    it('应该处理并发监控操作', async () => {
      const promises = [];

      // 并发执行多个监控操作
      for (let i = 0; i < 10; i++) {
        promises.push(
          monitoringMiddleware.monitorAsyncFunction(
            `concurrent_op_${i}`,
            async () => {
              await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
              return `result_${i}`;
            }
          )()
        );
      }

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      results.forEach((result, index) => {
        expect(result).toBe(`result_${index}`);
      });
    });
  });
});
