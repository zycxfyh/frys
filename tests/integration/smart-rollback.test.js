/**
 * 智能回退系统集成测试
 * 验证自动化回退策略和验证机制
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import SmartRollbackManager from '../../src/core/SmartRollbackManager.js';

// Mock fetch for testing
global.fetch = vi.fn();

describe('智能回退系统集成测试', () => {
  let rollbackManager;

  beforeAll(async () => {
    // Mock successful health check
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        status: 'healthy',
        timestamp: new Date().toISOString()
      })
    });

    rollbackManager = new SmartRollbackManager({
      environment: 'test',
      enableAutoRollback: false, // Disable auto rollback for testing
      healthCheckInterval: 1000 // Faster for testing
    });
  });

  afterAll(async () => {
    rollbackManager.stopMonitoring();
    vi.restoreAllMocks();
  });

  describe('基础功能测试', () => {
    it('应该初始化回退管理器', () => {
      expect(rollbackManager).toBeDefined();
      expect(rollbackManager.options.environment).toBe('test');
      expect(rollbackManager.options.enableAutoRollback).toBe(false);
    });

    it('应该收集健康指标', async () => {
      const metrics = await rollbackManager.collectHealthMetrics();

      expect(metrics).toHaveProperty('timestamp');
      expect(metrics).toHaveProperty('responseTime');
      expect(metrics).toHaveProperty('errorRate');
      expect(metrics).toHaveProperty('memoryUsage');
      expect(metrics).toHaveProperty('cpuUsage');
    });

    it('应该评估健康状态', async () => {
      const metrics = await rollbackManager.collectHealthMetrics();
      const assessment = rollbackManager.assessHealthStatus(metrics);

      expect(assessment).toHaveProperty('status');
      expect(assessment).toHaveProperty('score');
      expect(assessment).toHaveProperty('issues');
      expect(assessment.score).toBeGreaterThanOrEqual(0);
      expect(assessment.score).toBeLessThanOrEqual(100);
    });
  });

  describe('健康监控测试', () => {
    it('应该执行健康评估', async () => {
      // Mock healthy response
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          status: 'healthy',
          timestamp: new Date().toISOString()
        })
      });

      await rollbackManager.performHealthAssessment();

      const healthStatus = rollbackManager.getHealthStatus();
      expect(healthStatus).toHaveProperty('status');
      expect(healthStatus.consecutiveFailures).toBeGreaterThanOrEqual(0);
    });

    it('应该处理健康问题', async () => {
      // Mock unhealthy response
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      // Temporarily enable auto rollback for testing
      rollbackManager.options.enableAutoRollback = true;

      await rollbackManager.performHealthAssessment();

      const healthStatus = rollbackManager.getHealthStatus();
      expect(healthStatus.consecutiveFailures).toBeGreaterThan(0);

      // Reset for other tests
      rollbackManager.options.enableAutoRollback = false;
    });

    it('应该处理自动回退', async () => {
      // Set up conditions for rollback
      rollbackManager.consecutiveFailures = 5; // Trigger threshold

      // Mock the rollback execution
      const executeRollbackSpy = vi.spyOn(rollbackManager, 'executeRollbackStrategy')
        .mockResolvedValue(true);

      await rollbackManager.handleCriticalIssues([{
        type: 'test_failure',
        severity: 'critical',
        message: 'Test failure'
      }], { issues: [] });

      expect(executeRollbackSpy).toHaveBeenCalled();

      executeRollbackSpy.mockRestore();
    });
  });

  describe('回退策略测试', () => {
    it('应该执行环境切换策略', async () => {
      const runCommandSpy = vi.spyOn(rollbackManager, 'runCommand')
        .mockResolvedValue({ success: true });

      const result = await rollbackManager.executeRollbackStrategy('traffic_shifting', [], {});

      expect(result).toBe(true);
      expect(runCommandSpy).toHaveBeenCalledWith(
        './scripts/rollback.sh',
        ['--env=test'],
        expect.any(Object)
      );

      runCommandSpy.mockRestore();
    });

    it('应该执行版本回滚策略', async () => {
      const findVersionSpy = vi.spyOn(rollbackManager, 'findPreviousStableVersion')
        .mockResolvedValue('v0.9.5');
      const runCommandSpy = vi.spyOn(rollbackManager, 'runCommand')
        .mockResolvedValue({ success: true });

      const result = await rollbackManager.executeRollbackStrategy('version_rollback', [], {});

      expect(result).toBe(true);
      expect(findVersionSpy).toHaveBeenCalled();
      expect(runCommandSpy).toHaveBeenCalled();

      findVersionSpy.mockRestore();
      runCommandSpy.mockRestore();
    });

    it('应该处理降级策略', async () => {
      const degradationSpies = [
        vi.spyOn(rollbackManager, 'degradeResponseTimeHandling'),
        vi.spyOn(rollbackManager, 'degradeMemoryHandling'),
        vi.spyOn(rollbackManager, 'degradeCacheHandling')
      ];

      // Mock all degradation methods
      degradationSpies.forEach(spy => spy.mockResolvedValue());

      await rollbackManager.executeDegradationStrategy([
        { type: 'response_time', severity: 'warning' },
        { type: 'memory_usage', severity: 'warning' },
        { type: 'cache', severity: 'warning' }
      ], {});

      degradationSpies.forEach(spy => {
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
      });
    });
  });

  describe('回退历史和统计', () => {
    it('应该记录回退历史', () => {
      const initialHistoryLength = rollbackManager.getRollbackHistory().length;

      rollbackManager.rollbackHistory.push({
        timestamp: new Date().toISOString(),
        type: 'test',
        reason: 'unit test'
      });

      const history = rollbackManager.getRollbackHistory();
      expect(history.length).toBe(initialHistoryLength + 1);
      expect(history[history.length - 1]).toHaveProperty('type', 'test');
    });

    it('应该更新回退统计', () => {
      const initialStats = { ...rollbackManager.rollbackStats };

      rollbackManager.updateRollbackStats(true, 5000);
      rollbackManager.updateRollbackStats(false, 3000);

      expect(rollbackManager.rollbackStats.totalRollbacks).toBe(initialStats.totalRollbacks + 2);
      expect(rollbackManager.rollbackStats.successfulRollbacks).toBe(initialStats.successfulRollbacks + 1);
      expect(rollbackManager.rollbackStats.failedRollbacks).toBe(initialStats.failedRollbacks + 1);
    });

    it('应该生成回退报告', () => {
      const report = rollbackManager.generateRollbackReport();

      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('rollbackStats');
      expect(report).toHaveProperty('rollbackHistory');
      expect(report.summary).toHaveProperty('status');
      expect(report.summary).toHaveProperty('totalStages', 0); // No stages in basic test
    });
  });

  describe('手动回退测试', () => {
    it('应该执行手动回退', async () => {
      const executeStrategySpy = vi.spyOn(rollbackManager, 'executeRollbackStrategy')
        .mockResolvedValue(true);

      const result = await rollbackManager.manualRollback('environment_switch', 'manual test');

      expect(result).toBe(true);
      expect(executeStrategySpy).toHaveBeenCalledWith('environment_switch', [{
        type: 'manual',
        severity: 'warning',
        message: '手动触发回退: manual test'
      }], expect.any(Object));

      executeStrategySpy.mockRestore();
    });

    it('应该触发紧急回退', async () => {
      const emergencyRollbackSpy = vi.spyOn(rollbackManager, 'executeEmergencyShutdown')
        .mockResolvedValue();

      await rollbackManager.triggerEmergencyRollback('test emergency', {
        triggeredBy: 'test'
      });

      expect(emergencyRollbackSpy).toHaveBeenCalled();

      emergencyRollbackSpy.mockRestore();
    });
  });

  describe('监控集成测试', () => {
    it('应该启动和停止监控', () => {
      // Should not throw errors
      expect(() => {
        rollbackManager.startMonitoring();
        rollbackManager.stopMonitoring();
      }).not.toThrow();
    });

    it('应该处理监控间隔', async () => {
      // Create a manager with very short interval for testing
      const testManager = new SmartRollbackManager({
        environment: 'test',
        healthCheckInterval: 100, // Very short for testing
        enableAutoRollback: false
      });

      const healthAssessmentSpy = vi.spyOn(testManager, 'performHealthAssessment')
        .mockResolvedValue();

      testManager.startMonitoring();

      // Wait for at least one assessment
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(healthAssessmentSpy).toHaveBeenCalled();

      testManager.stopMonitoring();
      healthAssessmentSpy.mockRestore();
    });
  });

  describe('错误处理测试', () => {
    it('应该优雅处理健康检查失败', async () => {
      // Mock fetch to throw error
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      const metrics = await rollbackManager.collectHealthMetrics();

      // Should still return metrics object with error values
      expect(metrics).toHaveProperty('responseTime');
      expect(metrics.responseTime).toBe(9999); // Error value
    });

    it('应该处理无效的回退策略', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await rollbackManager.executeRollbackStrategy('invalid_strategy', [], {});

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('未知回退策略'),
        'invalid_strategy'
      );

      consoleSpy.mockRestore();
    });

    it('应该处理运行命令失败', async () => {
      const result = await rollbackManager.runCommand('false', []); // Command that always fails

      expect(result.success).toBe(false);
      expect(result).toHaveProperty('error');
    });
  });

  describe('配置和阈值测试', () => {
    it('应该使用自定义阈值', () => {
      const customManager = new SmartRollbackManager({
        alertThresholds: {
          responseTime: 1000, // Custom threshold
          errorRate: 0.01,    // Custom threshold
          memoryUsage: 0.8    // Custom threshold
        }
      });

      expect(customManager.options.alertThresholds.responseTime).toBe(1000);
      expect(customManager.options.alertThresholds.errorRate).toBe(0.01);
      expect(customManager.options.alertThresholds.memoryUsage).toBe(0.8);
    });

    it('应该禁用自动回退', () => {
      const noAutoManager = new SmartRollbackManager({
        enableAutoRollback: false
      });

      expect(noAutoManager.options.enableAutoRollback).toBe(false);
    });

    it('应该验证健康状态阈值', () => {
      const metrics = {
        responseTime: 6000, // Above threshold
        errorRate: 0.1,     // Above threshold
        memoryUsage: 0.95,  // Above threshold
        cpuUsage: 0.95,     // Above threshold
        databaseConnections: { status: 'healthy' },
        cacheHealth: { status: 'healthy' }
      };

      const assessment = rollbackManager.assessHealthStatus(metrics);

      expect(assessment.status).toBe('critical');
      expect(assessment.score).toBeLessThan(30); // Should be very low
      expect(assessment.issues.length).toBeGreaterThan(2);
    });
  });
});
