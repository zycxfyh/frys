/**
 * frys - Docker健康检查器
 * 专门为Docker容器环境优化的健康检查实现
 */

import {
  HealthChecker,
  databaseHealthCheck,
  redisHealthCheck,
  memoryHealthCheck,
  cpuHealthCheck,
} from './HealthChecker.js';
import { logger } from '../../utils/logger.js';
import { run_terminal_cmd } from '../../utils/terminal.js';

export class DockerHealthChecker extends HealthChecker {
  constructor(config = {}) {
    super(config);

    this.dockerHost = config.dockerHost || 'unix:///var/run/docker.sock';
    this.containerName = config.containerName || process.env.CONTAINER_NAME;
    this.serviceName = config.serviceName || 'wokeflow-app';
    this.healthCheckEndpoint = config.healthCheckEndpoint || '/health';
    this.containerLabels = config.containerLabels || {};

    // 注册Docker特定的健康检查
    this._registerDockerChecks();
  }

  /**
   * 注册Docker特定的健康检查
   */
  _registerDockerChecks() {
    // 容器自身健康检查
    this.registerCheck('container_self', {
      check: this._checkContainerSelf.bind(this),
      critical: true,
      interval: 15000, // 15秒
    });

    // Docker daemon连接检查
    this.registerCheck('docker_daemon', {
      check: this._checkDockerDaemon.bind(this),
      critical: true,
      interval: 60000, // 1分钟
    });

    // 容器资源使用检查
    this.registerCheck('container_resources', {
      check: this._checkContainerResources.bind(this),
      critical: false,
      interval: 30000, // 30秒
    });

    // 网络连接检查
    this.registerCheck('network_connectivity', {
      check: this._checkNetworkConnectivity.bind(this),
      critical: true,
      interval: 45000, // 45秒
    });

    // 依赖服务检查
    this.registerCheck('dependent_services', {
      check: this._checkDependentServices.bind(this),
      critical: false,
      interval: 30000,
    });
  }

  /**
   * 检查容器自身健康状态
   */
  async _checkContainerSelf() {
    try {
      // 检查容器是否在运行
      const containerInfo = await this._getContainerInfo();
      if (containerInfo.State.Status !== 'running') {
        throw new Error(
          `Container is not running: ${containerInfo.State.Status}`,
        );
      }

      // 检查健康状态（如果配置了健康检查）
      if (containerInfo.State.Health) {
        const health = containerInfo.State.Health;
        if (health.Status !== 'healthy') {
          throw new Error(`Container health check failed: ${health.Status}`);
        }
      }

      // 检查应用健康端点
      await this._checkApplicationHealth();

      return {
        status: containerInfo.State.Status,
        health: containerInfo.State.Health?.Status || 'no_health_check',
        uptime: containerInfo.State.StartedAt,
        restarts: containerInfo.RestartCount,
        image: containerInfo.Config.Image,
      };
    } catch (error) {
      throw new Error(`Container self-check failed: ${error.message}`);
    }
  }

  /**
   * 检查应用健康端点
   */
  async _checkApplicationHealth() {
    const healthUrl = `http://localhost:${process.env.PORT || 3000}${this.healthCheckEndpoint}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(healthUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'DockerHealthChecker/1.0',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(
          `Health endpoint returned ${response.status}: ${response.statusText}`,
        );
      }

      const healthData = await response.json();

      // 验证健康响应格式
      if (healthData.status !== 'healthy' && healthData.status !== 'ok') {
        throw new Error(
          `Application reports unhealthy status: ${healthData.status}`,
        );
      }

      return healthData;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Health endpoint check timed out');
      }
      throw error;
    }
  }

  /**
   * 检查Docker daemon连接
   */
  async _checkDockerDaemon() {
    try {
      const result = await run_terminal_cmd({
        command: 'docker version --format "{{.Server.Version}}"',
        is_background: false,
        explanation: '检查Docker daemon连接',
      });

      if (result.code !== 0) {
        throw new Error(`Docker daemon check failed: ${result.stderr}`);
      }

      const version = result.stdout.trim();

      return {
        connected: true,
        version,
        api_version: await this._getDockerApiVersion(),
      };
    } catch (error) {
      throw new Error(`Docker daemon connection failed: ${error.message}`);
    }
  }

  /**
   * 获取Docker API版本
   */
  async _getDockerApiVersion() {
    try {
      const result = await run_terminal_cmd({
        command: 'docker version --format "{{.Server.APIVersion}}"',
        is_background: false,
        explanation: '获取Docker API版本',
      });

      return result.stdout.trim();
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * 检查容器资源使用情况
   */
  async _checkContainerResources() {
    try {
      const containerStats = await this._getContainerStats();

      // 检查CPU使用率
      const cpuUsage = this._calculateCpuUsage(containerStats);
      if (cpuUsage > 0.8) {
        // 80%阈值
        throw new Error(`CPU usage too high: ${(cpuUsage * 100).toFixed(1)}%`);
      }

      // 检查内存使用率
      const memoryUsage = this._calculateMemoryUsage(containerStats);
      if (memoryUsage > 0.9) {
        // 90%阈值
        throw new Error(
          `Memory usage too high: ${(memoryUsage * 100).toFixed(1)}%`,
        );
      }

      return {
        cpu: {
          usage: cpuUsage,
          percent: `${(cpuUsage * 100).toFixed(1)}%`,
        },
        memory: {
          usage: memoryUsage,
          used: containerStats.memory_stats?.usage || 0,
          limit: containerStats.memory_stats?.limit || 0,
          percent: `${(memoryUsage * 100).toFixed(1)}%`,
        },
        network: this._extractNetworkStats(containerStats),
        io: this._extractIoStats(containerStats),
      };
    } catch (error) {
      throw new Error(`Container resources check failed: ${error.message}`);
    }
  }

  /**
   * 获取容器统计信息
   */
  async _getContainerStats() {
    try {
      const result = await run_terminal_cmd({
        command: `docker stats ${this.containerName || this.serviceName} --no-stream --format "{{json .}}"`,
        is_background: false,
        explanation: '获取容器统计信息',
      });

      if (result.code !== 0) {
        throw new Error(`Failed to get container stats: ${result.stderr}`);
      }

      return JSON.parse(result.stdout);
    } catch (error) {
      // 如果docker stats失败，使用inspect作为备选
      logger.warn('docker stats failed, using inspect as fallback', {
        error: error.message,
      });
      const containerInfo = await this._getContainerInfo();
      return this._extractStatsFromInspect(containerInfo);
    }
  }

  /**
   * 从inspect数据提取统计信息
   */
  _extractStatsFromInspect(containerInfo) {
    return {
      memory_stats: {
        usage: containerInfo.HostConfig?.Memory || 0,
        limit: containerInfo.HostConfig?.MemoryReservation || 0,
      },
      cpu_stats: {
        online_cpus: require('os').cpus().length,
      },
    };
  }

  /**
   * 计算CPU使用率
   */
  _calculateCpuUsage(stats) {
    try {
      if (!stats.cpu_stats || !stats.precpu_stats) {
        return 0;
      }

      const cpuDelta =
        stats.cpu_stats.cpu_usage.total_usage -
        stats.precpu_stats.cpu_usage.total_usage;
      const systemDelta =
        stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;

      if (systemDelta > 0 && cpuDelta > 0) {
        const cpuPercent =
          (cpuDelta / systemDelta) * stats.cpu_stats.online_cpus * 100;
        return Math.min(cpuPercent / 100, 1); // 确保不超过100%
      }

      return 0;
    } catch (error) {
      logger.warn('CPU usage calculation failed', { error: error.message });
      return 0;
    }
  }

  /**
   * 计算内存使用率
   */
  _calculateMemoryUsage(stats) {
    try {
      if (!stats.memory_stats) {
        return 0;
      }

      const used = stats.memory_stats.usage || 0;
      const limit = stats.memory_stats.limit || 1;

      return Math.min(used / limit, 1);
    } catch (error) {
      logger.warn('Memory usage calculation failed', { error: error.message });
      return 0;
    }
  }

  /**
   * 提取网络统计
   */
  _extractNetworkStats(stats) {
    try {
      if (!stats.networks) {
        return { rx_bytes: 0, tx_bytes: 0 };
      }

      let totalRx = 0;
      let totalTx = 0;

      Object.values(stats.networks).forEach((network) => {
        totalRx += network.rx_bytes || 0;
        totalTx += network.tx_bytes || 0;
      });

      return {
        rx_bytes: totalRx,
        tx_bytes: totalTx,
      };
    } catch (error) {
      return { rx_bytes: 0, tx_bytes: 0 };
    }
  }

  /**
   * 提取IO统计
   */
  _extractIoStats(stats) {
    try {
      if (!stats.blkio_stats || !stats.blkio_stats.io_service_bytes_recursive) {
        return { read_bytes: 0, write_bytes: 0 };
      }

      let readBytes = 0;
      let writeBytes = 0;

      stats.blkio_stats.io_service_bytes_recursive.forEach((io) => {
        if (io.op === 'Read') {
          readBytes += io.value || 0;
        } else if (io.op === 'Write') {
          writeBytes += io.value || 0;
        }
      });

      return {
        read_bytes: readBytes,
        write_bytes: writeBytes,
      };
    } catch (error) {
      return { read_bytes: 0, write_bytes: 0 };
    }
  }

  /**
   * 检查网络连接性
   */
  async _checkNetworkConnectivity() {
    const checks = [];

    // 检查本地网络
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      await fetch('http://localhost:3000/health', {
        method: 'HEAD',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      checks.push({ target: 'localhost', status: 'reachable' });
    } catch (error) {
      checks.push({
        target: 'localhost',
        status: 'unreachable',
        error: error.message,
      });
    }

    // 检查外部连接（可选）
    if (process.env.EXTERNAL_HEALTH_CHECK_URL) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        await fetch(process.env.EXTERNAL_HEALTH_CHECK_URL, {
          method: 'HEAD',
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        checks.push({ target: 'external', status: 'reachable' });
      } catch (error) {
        checks.push({
          target: 'external',
          status: 'unreachable',
          error: error.message,
        });
      }
    }

    // 检查DNS解析
    try {
      const dns = await import('dns/promises');
      await dns.lookup('google.com');
      checks.push({ target: 'dns', status: 'working' });
    } catch (error) {
      checks.push({ target: 'dns', status: 'failed', error: error.message });
    }

    const failures = checks.filter(
      (check) => check.status !== 'reachable' && check.status !== 'working',
    );

    if (failures.length > 0) {
      throw new Error(
        `Network connectivity issues: ${failures.map((f) => `${f.target} ${f.status}`).join(', ')}`,
      );
    }

    return { checks };
  }

  /**
   * 检查依赖服务
   */
  async _checkDependentServices() {
    const dependencies = [];
    const issues = [];

    // 检查数据库连接
    if (process.env.DATABASE_URL) {
      try {
        // 这里应该注入实际的数据库连接实例
        // 为了演示，我们使用一个模拟检查
        dependencies.push({
          service: 'database',
          status: 'unknown',
          note: 'Database check requires connection instance',
        });
      } catch (error) {
        issues.push(`database: ${error.message}`);
        dependencies.push({
          service: 'database',
          status: 'failed',
          error: error.message,
        });
      }
    }

    // 检查Redis连接
    if (process.env.REDIS_URL) {
      try {
        dependencies.push({
          service: 'redis',
          status: 'unknown',
          note: 'Redis check requires connection instance',
        });
      } catch (error) {
        issues.push(`redis: ${error.message}`);
        dependencies.push({
          service: 'redis',
          status: 'failed',
          error: error.message,
        });
      }
    }

    // 检查其他容器化服务
    const linkedServices = process.env.LINKED_SERVICES
      ? process.env.LINKED_SERVICES.split(',')
      : [];
    for (const service of linkedServices) {
      try {
        const [name, url] = service.split('=');
        if (url) {
          const response = await fetch(`${url}/health`, { method: 'GET' });
          if (response.ok) {
            dependencies.push({ service: name, status: 'healthy' });
          } else {
            issues.push(`${name}: HTTP ${response.status}`);
            dependencies.push({
              service: name,
              status: 'unhealthy',
              code: response.status,
            });
          }
        }
      } catch (error) {
        issues.push(`${service}: ${error.message}`);
        dependencies.push({
          service: name || service,
          status: 'failed',
          error: error.message,
        });
      }
    }

    if (issues.length > 0) {
      throw new Error(`Dependent services issues: ${issues.join('; ')}`);
    }

    return { dependencies };
  }

  /**
   * 获取容器信息
   */
  async _getContainerInfo() {
    try {
      const containerId = this.containerName || this.serviceName;
      const result = await run_terminal_cmd({
        command: `docker inspect ${containerId}`,
        is_background: false,
        explanation: '获取容器详细信息',
      });

      if (result.code !== 0) {
        throw new Error(`Container inspection failed: ${result.stderr}`);
      }

      const containers = JSON.parse(result.stdout);
      return containers[0];
    } catch (error) {
      throw new Error(`Failed to get container info: ${error.message}`);
    }
  }

  /**
   * 注册应用特定的健康检查
   */
  registerApplicationChecks() {
    // 注册内存和CPU检查
    this.registerCheck('application_memory', {
      check: memoryHealthCheck({
        heapUsed: 0.85, // 85%
        heapTotal: 0.95, // 95%
      }),
      critical: true,
      interval: 15000,
    });

    this.registerCheck('application_cpu', {
      check: cpuHealthCheck(0.75), // 75%
      critical: true,
      interval: 15000,
    });

    logger.info('应用特定的健康检查已注册');
  }

  /**
   * 获取Docker环境信息
   */
  async getDockerEnvironmentInfo() {
    try {
      const containerInfo = await this._getContainerInfo();
      const daemonInfo = await this._checkDockerDaemon();

      return {
        container: {
          id: containerInfo.Id,
          name: containerInfo.Name,
          image: containerInfo.Config.Image,
          status: containerInfo.State.Status,
          startedAt: containerInfo.State.StartedAt,
          ports: containerInfo.NetworkSettings?.Ports || {},
          env: containerInfo.Config.Env || [],
          labels: containerInfo.Config.Labels || {},
        },
        daemon: daemonInfo,
        host: {
          platform: process.platform,
          arch: process.arch,
          nodeVersion: process.version,
          uptime: process.uptime(),
        },
      };
    } catch (error) {
      logger.error('获取Docker环境信息失败', error);
      return null;
    }
  }

  /**
   * 执行容器重启
   * @param {string} reason - 重启原因
   */
  async restartContainer(reason = 'health_check_failed') {
    try {
      logger.warn('执行容器重启', { reason, container: this.containerName });

      const result = await run_terminal_cmd({
        command: `docker restart ${this.containerName || this.serviceName}`,
        is_background: false,
        explanation: '重启容器',
      });

      if (result.code !== 0) {
        throw new Error(`Container restart failed: ${result.stderr}`);
      }

      // 等待容器重新启动
      await new Promise((resolve) => setTimeout(resolve, 5000));

      logger.info('容器重启完成', { container: this.containerName });
      return true;
    } catch (error) {
      logger.error('容器重启失败', {
        error: error.message,
        container: this.containerName,
      });
      throw error;
    }
  }

  /**
   * 获取容器日志
   * @param {number} lines - 日志行数
   */
  async getContainerLogs(lines = 50) {
    try {
      const result = await run_terminal_cmd({
        command: `docker logs --tail ${lines} ${this.containerName || this.serviceName}`,
        is_background: false,
        explanation: '获取容器日志',
      });

      if (result.code !== 0) {
        throw new Error(`Failed to get container logs: ${result.stderr}`);
      }

      return result.stdout;
    } catch (error) {
      logger.error('获取容器日志失败', { error: error.message });
      return null;
    }
  }
}
