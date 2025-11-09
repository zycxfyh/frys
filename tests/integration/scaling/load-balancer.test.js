import {
  createDetailedErrorReporter,
  createStrictTestCleanup,
  setupStrictTestEnvironment,
  strictAssert,
  withTimeout,
} from './test-helpers.js';

/**
 * 负载均衡器集成测试
 * 测试负载均衡器的各种算法和健康检查功能
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
import { LoadBalancer } from '../../../src/infrastructure/scaling/LoadBalancer.js';
import { logger } from '../../../src/shared/utils/logger.js';

// Mock fetch for health checks
global.fetch = vi.fn();

describe('负载均衡器集成测试', () => {
  let loadBalancer;

  beforeAll(() => {
    vi.spyOn(logger, 'info').mockImplementation(() => {});
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    vi.spyOn(logger, 'error').mockImplementation(() => {});
    vi.spyOn(logger, 'debug').mockImplementation(() => {});
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    loadBalancer = new LoadBalancer({
      algorithm: 'round_robin',
      healthCheckInterval: 1000, // 1秒，用于测试
      healthCheckTimeout: 500,
      maxRetries: 2,
    });

    // 重置fetch mock
    global.fetch.mockClear();
  });

  describe('实例管理', () => {
    it('应该成功添加实例', () => {
      loadBalancer.addInstance('instance-1', 'http://localhost:3001');

      const stats = loadBalancer.getStats();
      expect(stats.totalInstances).toBe(1);
      expect(stats.instances[0].instanceId).toBe('instance-1');
      expect(stats.instances[0].url).toBe('http://localhost:3001');
    });

    it('应该成功移除实例', () => {
      loadBalancer.addInstance('instance-1', 'http://localhost:3001');
      loadBalancer.removeInstance('instance-1');

      const stats = loadBalancer.getStats();
      expect(stats.totalInstances).toBe(0);
    });

    it('应该支持实例权重', () => {
      loadBalancer.addInstance('instance-1', 'http://localhost:3001', {
        weight: 2,
      });
      loadBalancer.addInstance('instance-2', 'http://localhost:3001', {
        weight: 1,
      });

      const stats = loadBalancer.getStats();
      expect(stats.instances[0].weight).toBe(2);
      expect(stats.instances[1].weight).toBe(1);
    });
  });

  describe('负载均衡算法', () => {
    beforeEach(() => {
      // 添加测试实例
      loadBalancer.addInstance('instance-1', 'http://localhost:3001');
      loadBalancer.addInstance('instance-2', 'http://localhost:3002');
      loadBalancer.addInstance('instance-3', 'http://localhost:3003');
    });

    it('应该使用轮询算法分配请求', () => {
      const requests = [];
      for (let i = 0; (i = 6); i++) {
        const instance = loadBalancer.getNextInstance();
        requests.push(instance.instanceId);
      }

      // 验证轮询模式：instance-1, instance-2, instance-3, instance-1, instance-2, instance-3
      expect(requests).toEqual([
        'instance-1',
        'instance-2',
        'instance-3',
        'instance-1',
        'instance-2',
        'instance-3',
      ]);
    });

    it('应该使用最少连接算法', () => {
      loadBalancer.updateConfig({ algorithm: 'least_connections' });

      // 模拟连接数
      loadBalancer.getNextInstance(); // instance-1: connections = 1
      loadBalancer.getNextInstance(); // instance-2: connections = 1
      loadBalancer.getNextInstance(); // instance-3: connections = 1

      loadBalancer.releaseConnection('instance-2'); // instance-2: connections = 0
      loadBalancer.releaseConnection('instance-3'); // instance-3: connections = 0

      // 下次应该选择连接数最少的实例
      const nextInstance = loadBalancer.getNextInstance();
      expect(['instance-2', 'instance-3']).toContain(nextInstance.instanceId);
    });

    it('应该使用IP哈希算法', () => {
      loadBalancer.updateConfig({ algorithm: 'ip_hash' });

      const request1 = { ip: '192.168.1.100' };
      const request2 = { ip: '192.168.1.101' };
      const request3 = { ip: '192.168.1.100' }; // 相同IP

      const instance1 = loadBalancer.getNextInstance(request1);
      const instance2 = loadBalancer.getNextInstance(request2);
      const instance3 = loadBalancer.getNextInstance(request3); // 应该和instance1相同

      expect(instance1.instanceId).toBe(instance3.instanceId);
      expect(instance2.instanceId).not.toBe(instance1.instanceId);
    });

    it('应该使用加权轮询算法', () => {
      loadBalancer.updateConfig({ algorithm: 'weighted_round_robin' });

      // 清除现有实例并添加带权重的实例
      loadBalancer.removeInstance('instance-1');
      loadBalancer.removeInstance('instance-2');
      loadBalancer.removeInstance('instance-3');

      loadBalancer.addInstance('high-weight', 'http://localhost:3001', {
        weight: 3,
      });
      loadBalancer.addInstance('low-weight', 'http://localhost:3002', {
        weight: 1,
      });

      const requests = [];
      for (let i = 0; i < 10; i++) {
        const instance = loadBalancer.getNextInstance();
        requests.push(instance.instanceId);
      }

      // 高权重实例应该获得更多请求
      const highWeightCount = requests.filter(
        (id) => id === 'high-weight',
      ).length;
      const lowWeightCount = requests.filter(
        (id) => id === 'low-weight',
      ).length;

      expect(highWeightCount).toBeGreaterThan(lowWeightCount);
    });
  });

  describe('健康检查', () => {
    beforeEach(() => {
      loadBalancer.addInstance('healthy-instance', 'http://localhost:3001');
      loadBalancer.addInstance('unhealthy-instance', 'http://localhost:3002');
    });

    it('应该标记健康的实例', async () => {
      // Mock healthy response
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'healthy' }),
      });

      await loadBalancer.startHealthChecks();

      // 等待健康检查完成
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const stats = loadBalancer.getStats();
      const healthyInstance = stats.instances.find(
        (i) => i.instanceId === 'healthy-instance',
      );
      expect(healthyInstance.healthy).toBe(true);
    });

    it('应该标记不健康的实例', async () => {
      // Mock unhealthy response
      global.fetch.mockRejectedValueOnce(new Error('Connection failed'));

      await loadBalancer.startHealthChecks();

      // 等待健康检查完成
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const stats = loadBalancer.getStats();
      const unhealthyInstance = stats.instances.find(
        (i) => i.instanceId === 'unhealthy-instance',
      );
      expect(unhealthyInstance.healthy).toBe(false);
    });

    it('应该只选择健康的实例', () => {
      // 模拟一个健康实例，一个不健康实例
      loadBalancer.addInstance('healthy-instance-2', 'http://localhost:3003');

      // 手动设置实例健康状态
      const instances = loadBalancer.getStats().instances;
      instances[0].healthy = false; // 第一个实例不健康
      instances[1].healthy = false; // 第二个实例不健康
      instances[2].healthy = true; // 第三个实例健康

      // 所有请求都应该路由到健康的实例
      for (let i = 0; i < 5; i++) {
        const instance = loadBalancer.getNextInstance();
        expect(instance.instanceId).toBe('healthy-instance-2');
        expect(instance.healthy).toBe(true);
      }
    });

    it('应该在没有健康实例时抛出错误', () => {
      // 所有实例都不健康
      const instances = loadBalancer.getStats().instances;
      instances.forEach((instance) => (instance.healthy = false));

      expect(() => {
        loadBalancer.getNextInstance();
      }).toThrow('没有健康的实例可用');
    });
  });

  describe('请求转发', () => {
    beforeEach(() => {
      loadBalancer.addInstance('test-instance', 'http://localhost:3001');
    });

    it('应该成功转发请求', async () => {
      // Mock successful response
      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ message: 'success' }),
      });

      const mockReq = {
        method: 'GET',
        url: '/api/test',
        headers: { 'content-type': 'application/json' },
        body: null,
        ip: '127.0.0.1',
      };

      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };

      await loadBalancer.proxyRequest(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'success' });
    });

    it('应该处理转发失败并重试', async () => {
      // Mock failed responses followed by success
      global.fetch
        .mockRejectedValueOnce(new Error('Connection failed'))
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ message: 'success after retry' }),
        });

      const mockReq = {
        method: 'GET',
        url: '/api/test',
        headers: {},
        ip: '127.0.0.1',
      };

      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };

      await loadBalancer.proxyRequest(mockReq, mockRes);

      expect(global.fetch).toHaveBeenCalledTimes(3); // 2次失败 + 1次成功
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('应该在所有重试失败后返回503', async () => {
      // Mock all requests fail
      global.fetch.mockRejectedValue(new Error('Connection failed'));

      const mockReq = {
        method: 'GET',
        url: '/api/test',
        headers: {},
        ip: '127.0.0.1',
      };

      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };

      await loadBalancer.proxyRequest(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Service Unavailable',
        message: '所有服务实例都不可用',
      });
    });
  });

  describe('连接管理', () => {
    beforeEach(() => {
      loadBalancer.addInstance('instance-1', 'http://localhost:3001');
      loadBalancer.addInstance('instance-2', 'http://localhost:3002');
    });

    it('应该跟踪连接数', () => {
      loadBalancer.getNextInstance(); // connections: instance-1 = 1
      loadBalancer.getNextInstance(); // connections: instance-2 = 1

      const stats = loadBalancer.getStats();
      expect(
        stats.instances.find((i) => i.instanceId === 'instance-1').connections,
      ).toBe(1);
      expect(
        stats.instances.find((i) => i.instanceId === 'instance-2').connections,
      ).toBe(1);
      expect(stats.totalConnections).toBe(2);
    });

    it('应该正确释放连接', () => {
      const instance1 = loadBalancer.getNextInstance();
      const instance2 = loadBalancer.getNextInstance();

      loadBalancer.releaseConnection(instance1.instanceId);

      const stats = loadBalancer.getStats();
      expect(
        stats.instances.find((i) => i.instanceId === instance1.instanceId)
          .connections,
      ).toBe(0);
      expect(
        stats.instances.find((i) => i.instanceId === instance2.instanceId)
          .connections,
      ).toBe(1);
      expect(stats.totalConnections).toBe(1);
    });
  });

  describe('统计信息', () => {
    beforeEach(() => {
      loadBalancer.addInstance('instance-1', 'http://localhost:3001', {
        weight: 2,
      });
      loadBalancer.addInstance('instance-2', 'http://localhost:3002', {
        weight: 1,
      });
    });

    it('应该提供完整的统计信息', () => {
      const stats = loadBalancer.getStats();

      expect(stats).toHaveProperty('algorithm', 'round_robin');
      expect(stats).toHaveProperty('totalInstances', 2);
      expect(stats).toHaveProperty('healthyInstances', 2);
      expect(stats).toHaveProperty('unhealthyInstances', 0);
      expect(stats).toHaveProperty('totalConnections', 0);
      expect(stats).toHaveProperty('instances');

      expect(stats.instances).toHaveLength(2);
      expect(stats.instances[0]).toHaveProperty('instanceId', 'instance-1');
      expect(stats.instances[0]).toHaveProperty('url', 'http://localhost:3001');
      expect(stats.instances[0]).toHaveProperty('weight', 2);
      expect(stats.instances[0]).toHaveProperty('healthy', true);
      expect(stats.instances[0]).toHaveProperty('connections', 0);
    });
  });

  describe('配置管理', () => {
    it('应该允许更新配置', () => {
      loadBalancer.updateConfig({
        algorithm: 'least_connections',
        maxRetries: 5,
        healthCheckTimeout: 1000,
      });

      const config = loadBalancer.getConfig();
      expect(config.algorithm).toBe('least_connections');
      expect(config.maxRetries).toBe(5);
      expect(config.healthCheckTimeout).toBe(1000);
    });
  });
});
