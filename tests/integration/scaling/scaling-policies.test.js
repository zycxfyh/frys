import {
  createDetailedErrorReporter,
  createStrictTestCleanup,
  setupStrictTestEnvironment,
  strictAssert,
  withTimeout,
} from './test-helpers.js';

/**
 * 扩容策略集成测试
 * 测试各种扩容策略的决策逻辑
 */

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  CompositeScalingPolicy,
  CpuScalingPolicy,
  MemoryScalingPolicy,
  RequestScalingPolicy,
  ScalingPolicy,
} from '../../../src/infrastructure/scaling/ScalingPolicy.js';
import { logger } from '../../../src/shared/utils/logger.js';

describe('扩容策略集成测试', () => {
  beforeAll(() => {
    vi.spyOn(logger, 'info').mockImplementation(() => {});
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    vi.spyOn(logger, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe('基础扩容策略', () => {
    let policy;

    beforeEach(() => {
      policy = new ScalingPolicy({
        name: 'test-policy',
        type: 'cpu',
        scaleUpThreshold: 0.8,
        scaleDownThreshold: 0.3,
        minInstances: 1,
        maxInstances: 10,
        scaleFactor: 1.5,
      });
    });

    it('应该在指标超过阈值时触发扩容', () => {
      const metrics = { cpuUsage: 0.85 };
      const decision = policy.shouldScaleUp(metrics, 2);

      expect(decision.shouldScale).toBe(true);
      expect(decision.targetInstances).toBe(3); // 2 * 1.5 = 3
      expect(decision.reason).toContain('cpu usage 85% exceeds threshold 80%');
    });

    it('应该在指标低于阈值时触发缩容', () => {
      const metrics = { cpuUsage: 0.25 };
      const decision = policy.shouldScaleDown(metrics, 4);

      expect(decision.shouldScale).toBe(true);
      expect(decision.targetInstances).toBe(2); // Math.floor(4 / 1.5) = 2
      expect(decision.reason).toContain('cpu usage 25% below threshold 30%');
    });

    it('不应该在冷却期内扩容', () => {
      policy.updateLastScaleTime(); // 设置最后扩容时间为现在

      const metrics = { cpuUsage: 0.9 };
      const decision = policy.shouldScaleUp(metrics, 2);

      expect(decision.shouldScale).toBe(false);
      expect(decision.reason).toBe('Cooldown period active');
    });

    it('不应该超过最大实例数', () => {
      const metrics = { cpuUsage: 0.9 };
      const decision = policy.shouldScaleUp(metrics, 10); // 已在最大值

      expect(decision.shouldScale).toBe(false);
      expect(decision.reason).toBe('Policy disabled or at max capacity');
    });

    it('不应该低于最小实例数', () => {
      const metrics = { cpuUsage: 0.1 };
      const decision = policy.shouldScaleDown(metrics, 1); // 已在最小值

      expect(decision.shouldScale).toBe(false);
      expect(decision.reason).toBe('Policy disabled or at min capacity');
    });
  });

  describe('CPU扩容策略', () => {
    let policy;

    beforeEach(() => {
      policy = new CpuScalingPolicy({
        scaleUpThreshold: 0.75,
        scaleDownThreshold: 0.25,
      });
    });

    it('应该正确识别CPU指标', () => {
      expect(policy.type).toBe('cpu');
      expect(policy.scaleUpThreshold).toBe(0.75);
      expect(policy.scaleDownThreshold).toBe(0.25);
    });

    it('应该基于CPU使用率做决策', () => {
      const highCpuMetrics = { cpuUsage: 0.8 };
      const lowCpuMetrics = { cpuUsage: 0.2 };

      const scaleUpDecision = policy.shouldScaleUp(highCpuMetrics, 2);
      const scaleDownDecision = policy.shouldScaleDown(lowCpuMetrics, 4);

      expect(scaleUpDecision.shouldScale).toBe(true);
      expect(scaleDownDecision.shouldScale).toBe(true);
    });
  });

  describe('内存扩容策略', () => {
    let policy;

    beforeEach(() => {
      policy = new MemoryScalingPolicy({
        scaleUpThreshold: 0.85,
        scaleDownThreshold: 0.35,
      });
    });

    it('应该正确识别内存指标', () => {
      expect(policy.type).toBe('memory');
      expect(policy.scaleUpThreshold).toBe(0.85);
      expect(policy.scaleDownThreshold).toBe(0.35);
    });

    it('应该基于内存使用率做决策', () => {
      const highMemoryMetrics = { memoryUsage: 0.9 };
      const lowMemoryMetrics = { memoryUsage: 0.3 };

      const scaleUpDecision = policy.shouldScaleUp(highMemoryMetrics, 2);
      const scaleDownDecision = policy.shouldScaleDown(lowMemoryMetrics, 4);

      expect(scaleUpDecision.shouldScale).toBe(true);
      expect(scaleDownDecision.shouldScale).toBe(true);
    });
  });

  describe('请求扩容策略', () => {
    let policy;

    beforeEach(() => {
      policy = new RequestScalingPolicy({
        scaleUpThreshold: 0.9,
        scaleDownThreshold: 0.4,
      });
    });

    it('应该正确识别请求指标', () => {
      expect(policy.type).toBe('requests');
      expect(policy.scaleUpThreshold).toBe(0.9);
      expect(policy.scaleDownThreshold).toBe(0.4);
    });

    it('应该基于请求率做决策', () => {
      const highRequestMetrics = { requestRate: 950, maxRequestRate: 1000 }; // 95%
      const lowRequestMetrics = { requestRate: 300, maxRequestRate: 1000 }; // 30%

      const scaleUpDecision = policy.shouldScaleUp(highRequestMetrics, 2);
      const scaleDownDecision = policy.shouldScaleDown(lowRequestMetrics, 4);

      expect(scaleUpDecision.shouldScale).toBe(true);
      expect(scaleDownDecision.shouldScale).toBe(true);
    });
  });

  describe('复合扩容策略', () => {
    let compositePolicy;
    let cpuPolicy;
    let memoryPolicy;

    beforeEach(() => {
      cpuPolicy = new CpuScalingPolicy({ scaleUpThreshold: 0.7 });
      memoryPolicy = new MemoryScalingPolicy({ scaleUpThreshold: 0.7 });
      compositePolicy = new CompositeScalingPolicy([cpuPolicy, memoryPolicy]);
    });

    it('应该在任意策略要求扩容时扩容', () => {
      const highCpuMetrics = { cpuUsage: 0.8, memoryUsage: 0.5 }; // CPU高，内存正常
      const decision = compositePolicy.shouldScaleUp(highCpuMetrics, 2);

      expect(decision.shouldScale).toBe(true);
      expect(decision.reason).toContain('Composite policy triggered by');
    });

    it('应该在所有策略都同意时缩容', () => {
      const lowMetrics = { cpuUsage: 0.2, memoryUsage: 0.2 }; // CPU和内存都低
      const decision = compositePolicy.shouldScaleDown(lowMetrics, 4);

      expect(decision.shouldScale).toBe(true);
      expect(decision.reason).toContain(
        'All composite policies agree to scale down',
      );
    });

    it('不应该在策略不一致时缩容', () => {
      const mixedMetrics = { cpuUsage: 0.2, memoryUsage: 0.5 }; // CPU低，内存正常
      const decision = compositePolicy.shouldScaleDown(mixedMetrics, 4);

      expect(decision.shouldScale).toBe(false);
      expect(decision.reason).toContain(
        'Composite policies do not all agree to scale down',
      );
    });
  });

  describe('自定义策略', () => {
    let customPolicy;

    beforeEach(() => {
      customPolicy = new ScalingPolicy({
        name: 'custom-policy',
        type: 'custom',
        scaleUpThreshold: 0.7,
        scaleDownThreshold: 0.3,
      });
    });

    it('应该使用自定义阈值计算', () => {
      const metrics = { cpuUsage: 0.5, memoryUsage: 0.6 };
      const threshold = customPolicy._calculateThreshold(metrics);

      // 自定义计算：(0.5 * 0.4) + (0.6 * 0.3) + (0 * 0.3) = 0.2 + 0.18 + 0 = 0.38
      expect(threshold).toBe(0.38);
    });

    it('应该基于自定义阈值做决策', () => {
      const highMetrics = { cpuUsage: 0.8, memoryUsage: 0.8 }; // 综合阈值 > 0.7
      const lowMetrics = { cpuUsage: 0.1, memoryUsage: 0.1 }; // 综合阈值 < 0.3

      const scaleUpDecision = customPolicy.shouldScaleUp(highMetrics, 2);
      const scaleDownDecision = customPolicy.shouldScaleDown(lowMetrics, 4);

      expect(scaleUpDecision.shouldScale).toBe(true);
      expect(scaleDownDecision.shouldScale).toBe(true);
    });
  });

  describe('配置管理', () => {
    let policy;

    beforeEach(() => {
      policy = new ScalingPolicy();
    });

    it('应该提供配置快照', () => {
      const config = policy.getConfig();

      expect(config).toHaveProperty('name');
      expect(config).toHaveProperty('type');
      expect(config).toHaveProperty('scaleUpThreshold');
      expect(config).toHaveProperty('scaleDownThreshold');
      expect(config).toHaveProperty('cooldownPeriod');
      expect(config).toHaveProperty('minInstances');
      expect(config).toHaveProperty('maxInstances');
      expect(config).toHaveProperty('scaleFactor');
      expect(config).toHaveProperty('enabled');
    });

    it('应该允许更新配置', () => {
      policy.updateConfig({
        scaleUpThreshold: 0.9,
        scaleDownThreshold: 0.2,
        enabled: false,
      });

      expect(policy.scaleUpThreshold).toBe(0.9);
      expect(policy.scaleDownThreshold).toBe(0.2);
      expect(policy.enabled).toBe(false);
    });
  });

  describe('边界情况', () => {
    it('应该处理空指标', () => {
      const policy = new ScalingPolicy();
      const decision = policy.shouldScaleUp({}, 2);

      expect(decision.shouldScale).toBe(false);
      expect(decision.reason).toBe('Threshold not exceeded');
    });

    it('应该处理无效指标', () => {
      const policy = new ScalingPolicy();
      const decision = policy.shouldScaleUp({ cpuUsage: NaN }, 2);

      expect(decision.shouldScale).toBe(false);
    });

    it('应该处理极端阈值', () => {
      const policy = new ScalingPolicy({
        scaleUpThreshold: 0.95,
        scaleDownThreshold: 0.05,
      });

      const scaleUpDecision = policy.shouldScaleUp({ cpuUsage: 0.96 }, 2);
      const scaleDownDecision = policy.shouldScaleDown({ cpuUsage: 0.04 }, 4);

      expect(scaleUpDecision.shouldScale).toBe(true);
      expect(scaleDownDecision.shouldScale).toBe(true);
    });
  });
});
