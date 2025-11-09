import {
  createDetailedErrorReporter,
  createStrictTestCleanup,
  setupStrictTestEnvironment,
  strictAssert,
  withTimeout,
} from './test-helpers.js';

/**
 * 容器健康检查集成测试
 * 测试健康检查器、资源限制和中间件的集成功能
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
import { DockerHealthChecker } from '../../../src/infrastructure/health-checks/DockerHealthChecker.js';
import {
  cpuHealthCheck,
  databaseHealthCheck,
  HealthChecker,
  memoryHealthCheck,
} from '../../../src/infrastructure/health-checks/HealthChecker.js';
import { HealthCheckMiddleware } from '../../../src/infrastructure/health-checks/HealthCheckMiddleware.js';
import { KubernetesHealthChecker } from '../../../src/infrastructure/health-checks/KubernetesHealthChecker.js';
import {
  ContainerResourceLimits,
  ResourceLimits,
} from '../../../src/infrastructure/health-checks/ResourceLimits.js';
import { EventBus } from '../../../src/shared/kernel/EventBus.js';
import { logger } from '../../../src/shared/utils/logger.js';

// Mock logger
vi.spyOn(logger, 'info').mockImplementation(() => {});
vi.spyOn(logger, 'warn').mockImplementation(() => {});
vi.spyOn(logger, 'error').mockImplementation(() => {});
vi.spyOn(logger, 'debug').mockImplementation(() => {});

// Mock fetch for HTTP checks
global.fetch = vi.fn();

// Mock terminal commands for Docker/Kubernetes
vi.mock('../../../src/utils/terminal.js', () => ({
  run_terminal_cmd: vi.fn(),
}));

describe('容器健康检查集成测试', () => {
  let eventBus;
  let mockTerminalCmd;

  beforeAll(() => {
    eventBus = new EventBus();
    mockTerminalCmd = vi.mocked(
      require('../../../src/utils/terminal.js').run_terminal_cmd,
    );
  });

  describe('基础健康检查器', () => {
    let healthChecker;

    beforeEach(() => {
      healthChecker = new HealthChecker({
        eventBus,
        checkInterval: 1000, // 1秒用于测试
        timeout: 1000,
      });
    });

    afterEach(async () => {
      await healthChecker.stop();
    });

    it('应该注册和执行健康检查', async () => {
      let checkExecuted = false;

      healthChecker.registerCheck('test_check', {
        check: async () => {
          checkExecuted = true;
          return { status: 'ok' };
        },
        critical: true,
      });

      await healthChecker.start();

      // 等待检查执行
      await new Promise((resolve) => setTimeout(resolve, 1500));

      expect(checkExecuted).toBe(true);

      const health = healthChecker.getHealthSummary();
      expect(health.summary.healthy).toBe(1);
    });

    it('应该处理检查失败', async () => {
      healthChecker.registerCheck('failing_check', {
        check: async () => {
          throw new Error('Check failed');
        },
      });

      await healthChecker.start();

      // 等待检查执行
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const health = healthChecker.getHealthSummary();
      expect(health.summary.unhealthy).toBe(1);
      expect(health.summary.warnings[0].error).toBe('Check failed');
    });

    it('应该支持预定义检查函数', async () => {
      // Mock memory usage
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = vi.fn().mockReturnValue({
        heapUsed: 100 * 1024 * 1024, // 100MB
        heapTotal: 200 * 1024 * 1024, // 200MB
        external: 50 * 1024 * 1024, // 50MB
      });

      healthChecker.registerCheck('memory', {
        check: memoryHealthCheck({
          heapUsed: 150 * 1024 * 1024, // 150MB limit
          heapTotal: 300 * 1024 * 1024, // 300MB limit
        }),
      });

      await healthChecker.start();

      // 等待检查执行
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const health = healthChecker.getHealthSummary();
      expect(health.summary.healthy).toBe(1); // Should pass since usage is below limits

      // Restore original function
      process.memoryUsage = originalMemoryUsage;
    });
  });

  describe('Docker健康检查器', () => {
    let dockerChecker;

    beforeEach(() => {
      dockerChecker = new DockerHealthChecker({
        eventBus,
        containerName: 'test-container',
        serviceName: 'test-service',
        checkInterval: 1000,
      });

      // Mock terminal commands
      mockTerminalCmd.mockResolvedValue({
        code: 0,
        stdout: 'container_id\ncontainer_name\nrunning\ntcp_port\n',
      });
    });

    afterEach(async () => {
      await dockerChecker.stop();
    });

    it('应该检查Docker daemon连接', async () => {
      mockTerminalCmd.mockResolvedValueOnce({
        code: 0,
        stdout: '{"Version":"20.10.0","ApiVersion":"1.41"}',
      });

      await dockerChecker.start();

      // 等待检查执行
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const health = dockerChecker.getHealthSummary();
      expect(health.summary.healthy).toBeGreaterThan(0);
    });

    it('应该检查容器自身健康状态', async () => {
      // Mock container inspect
      mockTerminalCmd.mockResolvedValueOnce({
        code: 0,
        stdout: JSON.stringify({
          State: {
            Status: 'running',
            Health: { Status: 'healthy' },
          },
          Config: { Image: 'test:latest' },
          RestartCount: 0,
        }),
      });

      // Mock health endpoint check
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'healthy' }),
      });

      await dockerChecker.start();

      // 等待检查执行
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const health = dockerChecker.getHealthSummary();
      expect(health.summary.healthy).toBeGreaterThan(0);
    });

    it('应该检查容器资源使用', async () => {
      // Mock docker stats
      mockTerminalCmd.mockResolvedValueOnce({
        code: 0,
        stdout: JSON.stringify({
          memory_stats: {
            usage: 100 * 1024 * 1024,
            limit: 512 * 1024 * 1024,
          },
          cpu_stats: {
            cpu_usage: { total_usage: 1000000000 },
            system_cpu_usage: 2000000000,
            online_cpus: 2,
          },
        }),
      });

      await dockerChecker.start();

      // 等待检查执行
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const health = dockerChecker.getHealthSummary();
      expect(health.summary.healthy).toBeGreaterThan(0);
    });
  });

  describe('Kubernetes健康检查器', () => {
    let k8sChecker;

    beforeEach(() => {
      k8sChecker = new KubernetesHealthChecker({
        eventBus,
        namespace: 'test-ns',
        podName: 'test-pod',
        serviceName: 'test-service',
        checkInterval: 1000,
      });

      // Mock kubectl commands
      mockTerminalCmd.mockImplementation((cmd) => {
        if (cmd.command.includes('cluster-info')) {
          return Promise.resolve({
            code: 0,
            stdout: 'Kubernetes control plane is running',
          });
        }
        if (cmd.command.includes('get pod')) {
          return Promise.resolve({
            code: 0,
            stdout: JSON.stringify({
              status: { phase: 'Running' },
              spec: { containers: [{ name: 'app' }] },
            }),
          });
        }
        if (cmd.command.includes('get nodes')) {
          return Promise.resolve({
            code: 0,
            stdout: 'node1 Ready\nnode2 Ready\n',
          });
        }
        return Promise.resolve({ code: 0, stdout: '' });
      });
    });

    afterEach(async () => {
      await k8sChecker.stop();
    });

    it('应该检查Kubernetes API连接', async () => {
      mockTerminalCmd.mockResolvedValueOnce({
        code: 0,
        stdout: 'Client Version: v1.24.0\nServer Version: v1.24.0',
      });

      await k8sChecker.start();

      // 等待检查执行
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const health = k8sChecker.getHealthSummary();
      expect(health.summary.healthy).toBeGreaterThan(0);
    });

    it('应该检查Pod健康状态', async () => {
      await k8sChecker.start();

      // 等待检查执行
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const health = k8sChecker.getHealthSummary();
      expect(health.summary.healthy).toBeGreaterThan(0);
    });

    it('应该检查集群组件', async () => {
      await k8sChecker.start();

      // 等待检查执行
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const health = k8sChecker.getHealthSummary();
      expect(health.summary.healthy).toBeGreaterThan(0);
    });
  });

  describe('资源限制管理', () => {
    let resourceLimits;

    beforeEach(() => {
      resourceLimits = new ResourceLimits({
        eventBus,
        enforcementEnabled: true,
      });
    });

    it('应该检查内存使用限制', () => {
      const mockMemoryUsage = {
        heapUsed: 400 * 1024 * 1024, // 400MB
        heapTotal: 600 * 1024 * 1024, // 600MB
        external: 100 * 1024 * 1024, // 100MB
      };

      const result = resourceLimits.checkLimit('memory', mockMemoryUsage);

      expect(result.exceeded).toBe(true);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].type).toBe('heap_used');
    });

    it('应该检查CPU使用限制', () => {
      const mockCpuUsage = {
        user: 800000, // 800ms
        system: 200000, // 200ms
        usagePercent: 0.85, // 85%
      };

      const result = resourceLimits.checkLimit('cpu', mockCpuUsage);

      expect(result.exceeded).toBe(true);
      expect(result.violations[0].type).toBe('cpu_usage_percent');
    });

    it('应该执行限制动作', () => {
      const mockMemoryUsage = {
        heapUsed: 600 * 1024 * 1024, // 600MB (超过512MB限制)
        heapTotal: 700 * 1024 * 1024,
        external: 50 * 1024 * 1024,
      };

      // Mock global.gc
      global.gc = vi.fn();

      const result = resourceLimits.checkLimit('memory', mockMemoryUsage);

      expect(result.exceeded).toBe(true);
      expect(global.gc).toHaveBeenCalled();
    });

    it('应该支持容器资源限制', () => {
      const containerLimits = new ContainerResourceLimits({
        type: 'docker',
        memory: {
          limit: 256 * 1024 * 1024, // 256MB
          reservation: 128 * 1024 * 1024,
        },
      });

      const dockerConfig = containerLimits.generateContainerConfig();

      expect(dockerConfig.memory).toBe(256 * 1024 * 1024);
      expect(dockerConfig.memory_reservation).toBe(128 * 1024 * 1024);
    });
  });

  describe('健康检查中间件', () => {
    let healthChecker;
    let middleware;

    beforeEach(() => {
      healthChecker = new HealthChecker({ eventBus });
      middleware = new HealthCheckMiddleware(healthChecker);

      // Mock response
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'healthy' }),
      });
    });

    afterEach(async () => {
      await healthChecker.stop();
    });

    it('应该处理基本健康检查请求', async () => {
      const mockReq = { url: '/health' };
      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      let nextCalled = false;
      const next = () => {
        nextCalled = true;
      };

      await middleware._handleHealthRequest(mockReq, mockRes, next);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalled();
      expect(nextCalled).toBe(false); // Should not call next for health endpoints
    });

    it('应该处理详细健康检查请求', async () => {
      const mockReq = { url: '/health/detailed' };
      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      await middleware._handleHealthRequest(mockReq, mockRes, next);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalled();
    });

    it('应该处理存活探针请求', async () => {
      const mockReq = { url: '/health/liveness' };
      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      await middleware._handleHealthRequest(mockReq, mockRes, next);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      const response = mockRes.json.mock.calls[0][0];
      expect(response.status).toBe('alive');
      expect(response).toHaveProperty('uptime');
      expect(response).toHaveProperty('pid');
    });

    it('应该处理就绪探针请求', async () => {
      const mockReq = { url: '/health/readiness' };
      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      await middleware._handleHealthRequest(mockReq, mockRes, next);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      const response = mockRes.json.mock.calls[0][0];
      expect(response).toHaveProperty('status');
      expect(response).toHaveProperty('overall_health');
    });

    it('应该为非健康检查请求调用next', async () => {
      const mockReq = { url: '/api/users' };
      const mockRes = {};
      const next = vi.fn();

      await middleware._handleHealthRequest(mockReq, mockRes, next);

      expect(next).toHaveBeenCalled();
    });

    it('应该生成Kubernetes探针配置', () => {
      const probes = HealthCheckMiddleware.createKubernetesProbes({
        port: 8080,
        endpoint: '/health/ready',
      });

      expect(probes.livenessProbe.httpGet.path).toBe('/health/liveness');
      expect(probes.readinessProbe.httpGet.port).toBe(8080);
      expect(probes.startupProbe.httpGet.path).toBe('/health');
    });

    it('应该生成Docker健康检查配置', () => {
      const healthCheck = HealthCheckMiddleware.createDockerHealthCheck({
        port: 8080,
        endpoint: '/health',
      });

      expect(healthCheck.test).toEqual([
        'CMD',
        'curl',
        '-f',
        'http://localhost:8080/health',
      ]);
      expect(healthCheck.interval).toBe(30000000000);
      expect(healthCheck.timeout).toBe(10000000000);
    });
  });

  describe('端到端集成场景', () => {
    it('应该支持完整的Docker容器健康检查流程', async () => {
      // 创建Docker健康检查器
      const dockerChecker = new DockerHealthChecker({
        eventBus,
        containerName: 'frys-app',
        checkInterval: 500, // 快速检查用于测试
      });

      // Mock Docker commands
      mockTerminalCmd.mockImplementation((cmd) => {
        if (cmd.command.includes('version')) {
          return Promise.resolve({
            code: 0,
            stdout: '{"Version":"20.10.0","ApiVersion":"1.41"}',
          });
        }
        if (cmd.command.includes('inspect')) {
          return Promise.resolve({
            code: 0,
            stdout: JSON.stringify({
              State: {
                Status: 'running',
                Health: { Status: 'healthy' },
              },
              Config: { Image: 'frys:latest' },
              RestartCount: 0,
            }),
          });
        }
        return Promise.resolve({ code: 0, stdout: '' });
      });

      // Mock health endpoint
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'healthy', uptime: 3600 }),
      });

      // 启动健康检查
      await dockerChecker.start();

      // 等待所有检查完成
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // 验证健康状态
      const health = dockerChecker.getHealthSummary();
      expect(health.overall.status).toBe('healthy');
      expect(health.summary.healthy).toBeGreaterThan(0);
      expect(health.summary.unhealthy).toBe(0);

      // 验证环境信息
      const envInfo = await dockerChecker.getDockerEnvironmentInfo();
      expect(envInfo).toBeTruthy();
      expect(envInfo.container).toBeTruthy();
      expect(envInfo.daemon.connected).toBe(true);

      await dockerChecker.stop();
    });

    it('应该支持完整的资源限制管理流程', async () => {
      const resourceLimits = new ContainerResourceLimits({
        type: 'kubernetes',
        memory: { limit: 512 * 1024 * 1024 },
        cpu: { cpus: 2 },
      });

      // 模拟正常使用
      const normalUsage = {
        heapUsed: 200 * 1024 * 1024, // 200MB
        heapTotal: 300 * 1024 * 1024,
        external: 50 * 1024 * 1024,
      };

      let result = resourceLimits.checkLimit('memory', normalUsage);
      expect(result.exceeded).toBe(false);

      // 模拟超限使用
      const highUsage = {
        heapUsed: 600 * 1024 * 1024, // 600MB (超过512MB限制)
        heapTotal: 700 * 1024 * 1024,
        external: 100 * 1024 * 1024,
      };

      // Mock garbage collection
      global.gc = vi.fn();

      result = resourceLimits.checkLimit('memory', highUsage);
      expect(result.exceeded).toBe(true);
      expect(global.gc).toHaveBeenCalled();

      // 生成容器配置
      const config = resourceLimits.generateContainerConfig();
      expect(config.resources.limits.memory).toBe('512Mi');
      expect(config.resources.limits.cpu).toBe('2');
    });

    it('应该处理健康检查失败和恢复', async () => {
      const healthChecker = new HealthChecker({
        eventBus,
        checkInterval: 500,
      });

      let shouldFail = true;

      healthChecker.registerCheck('flaky_check', {
        check: async () => {
          if (shouldFail) {
            throw new Error('Temporary failure');
          }
          return { status: 'recovered' };
        },
      });

      await healthChecker.start();

      // 等待第一次失败
      await new Promise((resolve) => setTimeout(resolve, 600));
      let health = healthChecker.getHealthSummary();
      expect(health.summary.unhealthy).toBe(1);

      // 模拟恢复
      shouldFail = false;

      // 等待恢复
      await new Promise((resolve) => setTimeout(resolve, 600));
      health = healthChecker.getHealthSummary();
      expect(health.summary.healthy).toBe(1);

      await healthChecker.stop();
    });

    it('应该支持事件驱动的健康监控', async () => {
      const healthChecker = new HealthChecker({ eventBus });

      const events = [];
      eventBus.subscribe('healthCheckCompleted', (event) => {
        events.push(event);
      });

      healthChecker.registerCheck('event_test', {
        check: async () => ({ status: 'ok' }),
      });

      await healthChecker.start();

      // 等待健康检查完成
      await new Promise((resolve) => setTimeout(resolve, 1500));

      expect(events.length).toBeGreaterThan(0);
      expect(events[0]).toHaveProperty('overallHealth');
      expect(events[0]).toHaveProperty('checks');
      expect(events[0]).toHaveProperty('summary');

      await healthChecker.stop();
    });
  });
});
