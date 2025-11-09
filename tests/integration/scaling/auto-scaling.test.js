import {
  createDetailedErrorReporter,
  createStrictTestCleanup,
  setupStrictTestEnvironment,
  strictAssert,
  withTimeout,
} from './test-helpers.js';

/**
 * 自动扩容集成测试
 * 测试自动扩容管理器、负载均衡器和容器编排器的集成功能
 */

import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { AutoScalingManager } from '../../../src/infrastructure/scaling/AutoScalingManager.js';
import { LoadBalancer } from '../../../src/infrastructure/scaling/LoadBalancer.js';
import { ScalingMetrics } from '../../../src/infrastructure/scaling/ScalingMetrics.js';
import {
  CompositeScalingPolicy,
  CpuScalingPolicy,
  MemoryScalingPolicy,
} from '../../../src/infrastructure/scaling/ScalingPolicy.js';
import { logger } from '../../../src/shared/utils/logger.js';

// Mock容器编排器
const mockOrchestrator = {
  startInstance: vi.fn(),
  stopInstance: vi.fn(),
  getRunningInstances: vi.fn(),
  getInstanceDetails: vi.fn(),
  healthCheck: vi.fn(),
};

// Mock run_terminal_cmd
vi.mock('../../../src/utils/terminal.js', () => ({
  run_terminal_cmd: vi.fn(),
}));

describe('自动扩容集成测试', () => {
  let autoScalingManager;
  let mockTerminalCmd;

  beforeAll(() => {
    // Mock logger
    vi.spyOn(logger, 'info').mockImplementation(() => {});
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    vi.spyOn(logger, 'error').mockImplementation(() => {});
    vi.spyOn(logger, 'debug').mockImplementation(() => {});

    mockTerminalCmd = vi.mocked(
      require('../../../src/utils/terminal.js').run_terminal_cmd,
    );
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    // 重置所有mock
    vi.clearAllMocks();

    // 设置默认mock行为
    mockOrchestrator.getRunningInstances.mockResolvedValue([]);
    mockOrchestrator.startInstance.mockResolvedValue({
      id: 'test-instance-1',
      url: 'http://localhost:3001',
      port: 3001,
      index: 1,
      status: 'running',
      healthy: true,
      weight: 1,
      metadata: { image: 'test:latest' },
    });
    mockOrchestrator.stopInstance.mockResolvedValue(true);
    mockOrchestrator.healthCheck.mockResolvedValue({ status: 'healthy' });
    mockTerminalCmd.mockResolvedValue({ code: 0, stdout: '', stderr: '' });

    // 创建自动扩容管理器实例
    autoScalingManager = new AutoScalingManager({
      serviceName: 'test-service',
      minInstances: 1,
      maxInstances: 5,
      initialInstances: 1,
      policies: [new CpuScalingPolicy()],
      orchestrator: mockOrchestrator,
      metricsInterval: 1000, // 1秒，用于测试
      healthCheckInterval: 1000,
    });
  });

  afterEach(async () => {
    if (autoScalingManager && autoScalingManager.isRunning) {
      await autoScalingManager.stop();
    }
  });

  describe('初始化和启动', () => {
    it('应该成功初始化自动扩容管理器', () => {
      expect(autoScalingManager.serviceName).toBe('test-service');
      expect(autoScalingManager.minInstances).toBe(1);
      expect(autoScalingManager.maxInstances).toBe(5);
      expect(autoScalingManager.currentInstances).toBe(1);
    });

    it('应该成功启动自动扩容管理器', async () => {
      await autoScalingManager.start();

      expect(autoScalingManager.isRunning).toBe(true);
      expect(mockOrchestrator.getRunningInstances).toHaveBeenCalledWith(
        'test-service',
      );
    });

    it('应该在没有运行实例时启动初始实例', async () => {
      mockOrchestrator.getRunningInstances.mockResolvedValue([]);

      await autoScalingManager.start();

      expect(mockOrchestrator.startInstance).toHaveBeenCalledWith(
        'test-service',
        { index: 0 },
      );
    });

    it('应该同步现有运行实例', async () => {
      const existingInstances = [
        {
          id: 'existing-1',
          url: 'http://localhost:3000',
          weight: 1,
          metadata: {},
        },
        {
          id: 'existing-2',
          url: 'http://localhost:3001',
          weight: 1,
          metadata: {},
        },
      ];
      mockOrchestrator.getRunningInstances.mockResolvedValue(existingInstances);

      await autoScalingManager.start();

      expect(autoScalingManager.currentInstances).toBe(2);
      expect(mockOrchestrator.startInstance).not.toHaveBeenCalled();
    });
  });

  describe('扩容决策', () => {
    beforeEach(async () => {
      await autoScalingManager.start();
    });

    it('应该在CPU使用率高时触发扩容', async () => {
      // 模拟高CPU使用率
      autoScalingManager.metrics.recordCustomMetric('cpuUsage', 0.85);
      autoScalingManager.metrics.recordCustomMetric('cpuUsage', 0.9);
      autoScalingManager.metrics.recordCustomMetric('cpuUsage', 0.88);

      // 等待扩容检查
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // 验证扩容决策
      const stats = autoScalingManager.getStats();
      expect(stats.currentInstances).toBeGreaterThan(1);
      expect(mockOrchestrator.startInstance).toHaveBeenCalled();
    });

    it('应该在内存使用率高时触发扩容', async () => {
      // 使用内存策略
      autoScalingManager.policies = [new MemoryScalingPolicy()];

      // 模拟高内存使用率
      autoScalingManager.metrics.recordCustomMetric('memoryUsage', 0.85);
      autoScalingManager.metrics.recordCustomMetric('memoryUsage', 0.92);
      autoScalingManager.metrics.recordCustomMetric('memoryUsage', 0.89);

      // 等待扩容检查
      await new Promise((resolve) => setTimeout(resolve, 2000));

      expect(mockOrchestrator.startInstance).toHaveBeenCalled();
    });

    it('应该在复合策略下触发扩容', async () => {
      // 使用复合策略
      const compositePolicy = new CompositeScalingPolicy([
        new CpuScalingPolicy({ scaleUpThreshold: 0.8 }),
        new MemoryScalingPolicy({ scaleUpThreshold: 0.8 }),
      ]);
      autoScalingManager.policies = [compositePolicy];

      // 同时模拟高CPU和高内存
      autoScalingManager.metrics.recordCustomMetric('cpuUsage', 0.85);
      autoScalingManager.metrics.recordCustomMetric('memoryUsage', 0.87);

      // 等待扩容检查
      await new Promise((resolve) => setTimeout(resolve, 2000));

      expect(mockOrchestrator.startInstance).toHaveBeenCalled();
    });

    it('不应该超过最大实例数', async () => {
      autoScalingManager.currentInstances = 5; // 已经是最大值

      // 模拟高负载
      autoScalingManager.metrics.recordCustomMetric('cpuUsage', 0.95);

      // 等待扩容检查
      await new Promise((resolve) => setTimeout(resolve, 2000));

      expect(mockOrchestrator.startInstance).not.toHaveBeenCalled();
    });
  });

  describe('缩容决策', () => {
    beforeEach(async () => {
      // 先扩容到3个实例
      autoScalingManager.currentInstances = 3;
      await autoScalingManager.start();
    });

    it('应该在低负载时触发缩容', async () => {
      // 模拟低CPU使用率
      autoScalingManager.metrics.recordCustomMetric('cpuUsage', 0.15);
      autoScalingManager.metrics.recordCustomMetric('cpuUsage', 0.12);
      autoScalingManager.metrics.recordCustomMetric('cpuUsage', 0.18);

      // 等待缩容检查
      await new Promise((resolve) => setTimeout(resolve, 2000));

      expect(mockOrchestrator.stopInstance).toHaveBeenCalled();
    });

    it('不应该低于最小实例数', async () => {
      autoScalingManager.currentInstances = 1; // 已经是最小值

      // 模拟低负载
      autoScalingManager.metrics.recordCustomMetric('cpuUsage', 0.1);

      // 等待缩容检查
      await new Promise((resolve) => setTimeout(resolve, 2000));

      expect(mockOrchestrator.stopInstance).not.toHaveBeenCalled();
    });
  });

  describe('手动扩容', () => {
    beforeEach(async () => {
      await autoScalingManager.start();
    });

    it('应该支持手动扩容', async () => {
      await autoScalingManager.manualScale(3, '手动扩容测试');

      expect(autoScalingManager.currentInstances).toBe(3);
      expect(mockOrchestrator.startInstance).toHaveBeenCalledTimes(2); // 启动2个新实例
    });

    it('应该支持手动缩容', async () => {
      // 先手动扩容
      await autoScalingManager.manualScale(3);

      // 再缩容
      await autoScalingManager.manualScale(1, '手动缩容测试');

      expect(autoScalingManager.currentInstances).toBe(1);
      expect(mockOrchestrator.stopInstance).toHaveBeenCalledTimes(2); // 停止2个实例
    });

    it('应该限制手动扩容在允许范围内', async () => {
      await autoScalingManager.manualScale(10, '超出最大值测试');

      expect(autoScalingManager.currentInstances).toBe(5); // 限制为最大值
      expect(mockOrchestrator.startInstance).toHaveBeenCalledTimes(4); // 启动4个实例到达最大值
    });
  });

  describe('负载均衡集成', () => {
    beforeEach(async () => {
      await autoScalingManager.start();
    });

    it('应该将新实例添加到负载均衡器', async () => {
      await autoScalingManager.manualScale(2);

      const stats = autoScalingManager.getStats();
      expect(stats.loadBalancer.totalInstances).toBe(2);
      expect(stats.loadBalancer.healthyInstances).toBe(2);
    });

    it('应该从负载均衡器移除停止的实例', async () => {
      await autoScalingManager.manualScale(3);
      await autoScalingManager.manualScale(1);

      const stats = autoScalingManager.getStats();
      expect(stats.loadBalancer.totalInstances).toBe(1);
    });
  });

  describe('异常处理', () => {
    beforeEach(async () => {
      await autoScalingManager.start();
    });

    it('应该处理容器启动失败', async () => {
      mockOrchestrator.startInstance.mockRejectedValue(
        new Error('容器启动失败'),
      );

      await expect(autoScalingManager.manualScale(2)).rejects.toThrow(
        '容器启动失败',
      );

      // 验证告警生成
      const alerts = autoScalingManager.getActiveAlerts();
      expect(alerts.some((alert) => alert.type === 'scale_up_failed')).toBe(
        true,
      );
    });

    it('应该处理容器停止失败', async () => {
      mockOrchestrator.stopInstance.mockRejectedValue(
        new Error('容器停止失败'),
      );

      await autoScalingManager.manualScale(3); // 先扩容
      await expect(autoScalingManager.manualScale(1)).rejects.toThrow(
        '容器停止失败',
      );

      // 验证告警生成
      const alerts = autoScalingManager.getActiveAlerts();
      expect(alerts.some((alert) => alert.type === 'scale_down_failed')).toBe(
        true,
      );
    });

    it('应该检测到系统异常并生成告警', async () => {
      // 模拟严重CPU异常
      autoScalingManager.metrics.recordCustomMetric('cpuUsage', 0.98);

      // 等待异常检测
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const alerts = autoScalingManager.getActiveAlerts();
      expect(alerts.some((alert) => alert.type === 'system_anomaly')).toBe(
        true,
      );
    });
  });

  describe('统计和监控', () => {
    beforeEach(async () => {
      await autoScalingManager.start();
    });

    it('应该提供完整的统计信息', () => {
      const stats = autoScalingManager.getStats();

      expect(stats).toHaveProperty('serviceName', 'test-service');
      expect(stats).toHaveProperty('currentInstances');
      expect(stats).toHaveProperty('minInstances', 1);
      expect(stats).toHaveProperty('maxInstances', 5);
      expect(stats).toHaveProperty('isRunning', true);
      expect(stats).toHaveProperty('policies');
      expect(stats).toHaveProperty('metrics');
      expect(stats).toHaveProperty('loadBalancer');
      expect(stats).toHaveProperty('scaleHistory');
      expect(stats).toHaveProperty('recentAlerts');
    });

    it('应该记录扩容历史', async () => {
      await autoScalingManager.manualScale(2, '测试扩容');

      const history = autoScalingManager.getScaleHistory();
      expect(history.length).toBeGreaterThan(0);
      expect(history[0]).toHaveProperty('type', 'manual_scale_up');
      expect(history[0]).toHaveProperty('reason', '测试扩容');
    });

    it('应该限制历史记录数量', () => {
      // 模拟大量扩容事件
      for (let i = 0; i < 1100; i++) {
        autoScalingManager._recordScaleEvent({
          type: 'test',
          fromInstances: 1,
          toInstances: 2,
          reason: `test event ${i}`,
          timestamp: Date.now(),
        });
      }

      const history = autoScalingManager.getScaleHistory(2000); // 请求更多记录
      expect(history.length).toBeLessThanOrEqual(1000); // 应该被限制
    });
  });

  describe('配置管理', () => {
    it('应该允许更新配置', () => {
      autoScalingManager.updateConfig({
        maxInstances: 10,
        minInstances: 2,
      });

      expect(autoScalingManager.maxInstances).toBe(10);
      expect(autoScalingManager.minInstances).toBe(2);
    });

    it('应该提供配置快照', () => {
      const config = autoScalingManager.getConfig();

      expect(config).toHaveProperty('serviceName', 'test-service');
      expect(config).toHaveProperty('minInstances', 1);
      expect(config).toHaveProperty('maxInstances', 5);
      expect(config).toHaveProperty('policies');
      expect(config).toHaveProperty('metrics');
      expect(config).toHaveProperty('loadBalancer');
    });
  });
});
