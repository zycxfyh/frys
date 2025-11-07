/**
 * frys - Docker容器编排器
 * 基于Docker API管理容器实例
 */

import { ContainerOrchestrator } from './ContainerOrchestrator.js';
import { logger } from '../../utils/logger.js';
import { run_terminal_cmd } from '../../utils/terminal.js';

export class DockerContainerOrchestrator extends ContainerOrchestrator {
  constructor(config = {}) {
    super();
    this.dockerHost = config.dockerHost || 'unix:///var/run/docker.sock';
    this.network = config.network || 'wokeflow-network';
    this.imageName = config.imageName || 'wokeflow-app:latest';
    this.basePort = config.basePort || 3000;
    this.containerPrefix = config.containerPrefix || 'wokeflow-app-';
    this.labels = config.labels || {
      'wokeflow.service': 'app',
      'wokeflow.managed': 'true',
    };
    this.environment = config.environment || {};
    this.volumes = config.volumes || [];
    this.restartPolicy = config.restartPolicy || 'unless-stopped';
  }

  /**
   * 启动服务实例
   * @param {string} serviceName - 服务名称
   * @param {object} options - 启动选项
   * @returns {Promise<object>} 实例信息
   */
  async startInstance(serviceName, options = {}) {
    const instanceIndex = options.index || 0;
    const instanceId = `${this.containerPrefix}${instanceIndex}`;
    const port = this.basePort + instanceIndex;

    try {
      // 检查容器是否已存在
      const existingContainer = await this._getContainerByName(instanceId);
      if (existingContainer) {
        // 如果容器存在但未运行，启动它
        if (existingContainer.State !== 'running') {
          await this._startContainer(existingContainer.Id);
          const containerInfo = await this._inspectContainer(
            existingContainer.Id,
          );
          return this._formatInstanceInfo(containerInfo, instanceIndex);
        } else {
          // 容器已经在运行
          const containerInfo = await this._inspectContainer(
            existingContainer.Id,
          );
          return this._formatInstanceInfo(containerInfo, instanceIndex);
        }
      }

      // 创建新容器
      const containerId = await this._createContainer(
        instanceId,
        port,
        options,
      );

      // 启动容器
      await this._startContainer(containerId);

      // 等待容器健康检查
      await this._waitForContainerHealthy(containerId, 30000); // 30秒超时

      const containerInfo = await this._inspectContainer(containerId);

      logger.info('Docker容器启动成功', {
        instanceId,
        containerId,
        port,
        image: this.imageName,
      });

      return this._formatInstanceInfo(containerInfo, instanceIndex);
    } catch (error) {
      logger.error('启动Docker容器失败', {
        instanceId,
        port,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * 停止服务实例
   * @param {string} instanceId - 实例ID
   * @returns {Promise<boolean>} 是否成功
   */
  async stopInstance(instanceId) {
    try {
      const containerInfo = await this._getContainerByName(instanceId);
      if (!containerInfo) {
        logger.warn('容器不存在', { instanceId });
        return true;
      }

      if (containerInfo.State === 'running') {
        // 优雅停止
        await this._stopContainer(containerInfo.Id, 30); // 30秒超时
      }

      // 删除容器
      await this._removeContainer(containerInfo.Id);

      logger.info('Docker容器停止成功', {
        instanceId,
        containerId: containerInfo.Id,
      });
      return true;
    } catch (error) {
      logger.error('停止Docker容器失败', {
        instanceId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * 获取运行中的实例列表
   * @param {string} serviceName - 服务名称
   * @returns {Promise<Array>} 实例列表
   */
  async getRunningInstances(serviceName) {
    try {
      const containers = await this._listContainers({
        filters: {
          label: [`wokeflow.service=${serviceName}`],
          status: ['running'],
        },
      });

      const instances = [];
      for (const container of containers) {
        const instanceInfo = await this._inspectContainer(container.Id);
        const instanceIndex = this._extractInstanceIndex(container.Names[0]);
        instances.push(this._formatInstanceInfo(instanceInfo, instanceIndex));
      }

      return instances;
    } catch (error) {
      logger.error('获取运行实例列表失败', {
        serviceName,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * 获取实例详情
   * @param {string} instanceId - 实例ID
   * @returns {Promise<object>} 实例详情
   */
  async getInstanceDetails(instanceId) {
    try {
      const containerInfo = await this._getContainerByName(instanceId);
      if (!containerInfo) {
        throw new Error(`实例不存在: ${instanceId}`);
      }

      const details = await this._inspectContainer(containerInfo.Id);
      const instanceIndex = this._extractInstanceIndex(containerInfo.Name);

      return {
        ...this._formatInstanceInfo(details, instanceIndex),
        state: details.State,
        health: details.State.Health,
        restartCount: details.RestartCount,
        created: details.Created,
        startedAt: details.State.StartedAt,
        finishedAt: details.State.FinishedAt,
        resources: {
          memory: details.HostConfig.Memory,
          cpuShares: details.HostConfig.CpuShares,
          cpuQuota: details.HostConfig.CpuQuota,
        },
        network: details.NetworkSettings,
      };
    } catch (error) {
      logger.error('获取实例详情失败', { instanceId, error: error.message });
      throw error;
    }
  }

  /**
   * 检查编排器健康状态
   * @returns {Promise<object>} 健康状态
   */
  async healthCheck() {
    try {
      // 检查Docker daemon是否可访问
      const version = await this._getDockerVersion();

      // 检查网络是否存在
      const networks = await this._listNetworks();
      const networkExists = networks.some((net) => net.Name === this.network);

      // 检查镜像是否存在
      const images = await this._listImages();
      const imageExists = images.some(
        (img) => img.RepoTags && img.RepoTags.includes(this.imageName),
      );

      return {
        status: 'healthy',
        details: {
          dockerVersion: version.Version,
          apiVersion: version.ApiVersion,
          networkExists,
          imageExists,
          containers: await this._countContainers(),
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
      };
    }
  }

  /**
   * 创建Docker容器
   */
  async _createContainer(instanceId, port, options = {}) {
    const envVars = Object.entries({
      ...this.environment,
      WOKFLOW_INSTANCE_ID: instanceId,
      WOKFLOW_INSTANCE_INDEX: options.index || 0,
      PORT: port.toString(),
      ...options.environment,
    }).map(([key, value]) => `${key}=${value}`);

    const labels = {
      ...this.labels,
      'wokeflow.instance.id': instanceId,
      'wokeflow.instance.index': (options.index || 0).toString(),
      ...options.labels,
    };

    const createOptions = {
      Image: this.imageName,
      name: instanceId,
      Env: envVars,
      Labels: labels,
      ExposedPorts: {
        [`${port}/tcp`]: {},
      },
      HostConfig: {
        PortBindings: {
          [`${port}/tcp`]: [{ HostPort: port.toString() }],
        },
        RestartPolicy: {
          Name: this.restartPolicy,
        },
        NetworkMode: this.network,
        // 资源限制
        Memory: options.memory || 512 * 1024 * 1024, // 512MB
        CpuShares: options.cpuShares || 1024,
        // 数据卷
        Binds: [...this.volumes, ...(options.volumes || [])],
      },
      // 健康检查
      Healthcheck: {
        Test: ['CMD', 'curl', '-f', `http://localhost:${port}/health`],
        Interval: 30000000000, // 30秒
        Timeout: 10000000000, // 10秒
        Retries: 3,
        StartPeriod: 40000000000, // 40秒
      },
    };

    const result = await run_terminal_cmd({
      command: `docker create ${this._buildCreateArgs(createOptions)}`,
      is_background: false,
      explanation: '创建Docker容器',
    });

    if (result.code !== 0) {
      throw new Error(`创建容器失败: ${result.stderr}`);
    }

    return result.stdout.trim();
  }

  /**
   * 构建docker create命令参数
   */
  _buildCreateArgs(options) {
    const args = [];

    // 基本选项
    args.push(`--name ${options.name}`);

    // 环境变量
    options.Env.forEach((env) => {
      args.push(`-e ${env}`);
    });

    // 标签
    Object.entries(options.Labels).forEach(([key, value]) => {
      args.push(`--label ${key}=${value}`);
    });

    // 端口映射
    Object.entries(options.HostConfig.PortBindings).forEach(
      ([containerPort, hostBindings]) => {
        hostBindings.forEach((binding) => {
          args.push(`-p ${binding.HostPort}:${containerPort}`);
        });
      },
    );

    // 网络
    if (options.HostConfig.NetworkMode) {
      args.push(`--network ${options.HostConfig.NetworkMode}`);
    }

    // 重启策略
    if (options.HostConfig.RestartPolicy) {
      args.push(`--restart ${options.HostConfig.RestartPolicy.Name}`);
    }

    // 内存限制
    if (options.HostConfig.Memory) {
      args.push(`--memory ${options.HostConfig.Memory}`);
    }

    // CPU份额
    if (options.HostConfig.CpuShares) {
      args.push(`--cpu-shares ${options.HostConfig.CpuShares}`);
    }

    // 数据卷
    if (options.HostConfig.Binds) {
      options.HostConfig.Binds.forEach((bind) => {
        args.push(`-v ${bind}`);
      });
    }

    // 健康检查
    if (options.Healthcheck) {
      const hc = options.Healthcheck;
      args.push(`--health-cmd "${hc.Test.join(' ')}"`);
      args.push(`--health-interval ${hc.Interval}`);
      args.push(`--health-timeout ${hc.Timeout}`);
      args.push(`--health-retries ${hc.Retries}`);
      args.push(`--health-start-period ${hc.StartPeriod}`);
    }

    // 镜像名称
    args.push(options.Image);

    return args.join(' ');
  }

  /**
   * 启动容器
   */
  async _startContainer(containerId) {
    const result = await run_terminal_cmd({
      command: `docker start ${containerId}`,
      is_background: false,
      explanation: '启动Docker容器',
    });

    if (result.code !== 0) {
      throw new Error(`启动容器失败: ${result.stderr}`);
    }
  }

  /**
   * 停止容器
   */
  async _stopContainer(containerId, timeout = 30) {
    const result = await run_terminal_cmd({
      command: `docker stop -t ${timeout} ${containerId}`,
      is_background: false,
      explanation: '停止Docker容器',
    });

    if (result.code !== 0) {
      throw new Error(`停止容器失败: ${result.stderr}`);
    }
  }

  /**
   * 删除容器
   */
  async _removeContainer(containerId) {
    const result = await run_terminal_cmd({
      command: `docker rm ${containerId}`,
      is_background: false,
      explanation: '删除Docker容器',
    });

    if (result.code !== 0) {
      throw new Error(`删除容器失败: ${result.stderr}`);
    }
  }

  /**
   * 等待容器健康检查通过
   */
  async _waitForContainerHealthy(containerId, timeout = 30000) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        const containerInfo = await this._inspectContainer(containerId);

        if (
          containerInfo.State.Health &&
          containerInfo.State.Health.Status === 'healthy'
        ) {
          return;
        }

        if (containerInfo.State.Status !== 'running') {
          throw new Error(`容器状态异常: ${containerInfo.State.Status}`);
        }

        // 等待1秒后重试
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        throw new Error(`等待容器健康检查失败: ${error.message}`);
      }
    }

    throw new Error('容器健康检查超时');
  }

  /**
   * 检查容器是否存在
   */
  async _getContainerByName(name) {
    try {
      const result = await run_terminal_cmd({
        command: `docker ps -a --filter "name=^${name}$" --format "{{.ID}}|{{.Names}}|{{.State}}|{{.Ports}}"`,
        is_background: false,
        explanation: '检查容器是否存在',
      });

      if (result.code !== 0 || !result.stdout.trim()) {
        return null;
      }

      const lines = result.stdout.trim().split('\n');
      for (const line of lines) {
        const [id, containerName, state, ports] = line.split('|');
        if (containerName === name) {
          return {
            Id: id,
            Name: containerName,
            State: state,
            Ports: ports,
          };
        }
      }

      return null;
    } catch (error) {
      logger.warn('检查容器存在失败', { name, error: error.message });
      return null;
    }
  }

  /**
   * 获取容器详细信息
   */
  async _inspectContainer(containerId) {
    const result = await run_terminal_cmd({
      command: `docker inspect ${containerId}`,
      is_background: false,
      explanation: '获取容器详细信息',
    });

    if (result.code !== 0) {
      throw new Error(`获取容器信息失败: ${result.stderr}`);
    }

    try {
      const containers = JSON.parse(result.stdout);
      return containers[0];
    } catch (error) {
      throw new Error(`解析容器信息失败: ${error.message}`);
    }
  }

  /**
   * 列出容器
   */
  async _listContainers(options = {}) {
    let command =
      'docker ps -a --format "{{.ID}}|{{.Names}}|{{.Image}}|{{.State}}|{{.Ports}}"';

    if (options.filters) {
      if (options.filters.label) {
        options.filters.label.forEach((label) => {
          command += ` --filter "label=${label}"`;
        });
      }
      if (options.filters.status) {
        options.filters.status.forEach((status) => {
          command += ` --filter "status=${status}"`;
        });
      }
    }

    const result = await run_terminal_cmd({
      command,
      is_background: false,
      explanation: '列出Docker容器',
    });

    if (result.code !== 0) {
      throw new Error(`列出容器失败: ${result.stderr}`);
    }

    const containers = [];
    const lines = result.stdout
      .trim()
      .split('\n')
      .filter((line) => line.trim());

    for (const line of lines) {
      const [id, names, image, state, ports] = line.split('|');
      containers.push({
        Id: id,
        Names: [names],
        Image: image,
        State: state,
        Ports: ports,
      });
    }

    return containers;
  }

  /**
   * 获取Docker版本信息
   */
  async _getDockerVersion() {
    const result = await run_terminal_cmd({
      command: 'docker version --format "{{json .}}"',
      is_background: false,
      explanation: '获取Docker版本信息',
    });

    if (result.code !== 0) {
      throw new Error(`获取Docker版本失败: ${result.stderr}`);
    }

    try {
      return JSON.parse(result.stdout);
    } catch (error) {
      throw new Error(`解析Docker版本信息失败: ${error.message}`);
    }
  }

  /**
   * 列出网络
   */
  async _listNetworks() {
    const result = await run_terminal_cmd({
      command: 'docker network ls --format "{{.ID}}|{{.Name}}|{{.Driver}}"',
      is_background: false,
      explanation: '列出Docker网络',
    });

    if (result.code !== 0) {
      return [];
    }

    const networks = [];
    const lines = result.stdout
      .trim()
      .split('\n')
      .filter((line) => line.trim());

    for (const line of lines) {
      const [id, name, driver] = line.split('|');
      networks.push({ ID: id, Name: name, Driver: driver });
    }

    return networks;
  }

  /**
   * 列出镜像
   */
  async _listImages() {
    const result = await run_terminal_cmd({
      command:
        'docker images --format "{{.ID}}|{{.Repository}}|{{.Tag}}|{{.Size}}"',
      is_background: false,
      explanation: '列出Docker镜像',
    });

    if (result.code !== 0) {
      return [];
    }

    const images = [];
    const lines = result.stdout
      .trim()
      .split('\n')
      .filter((line) => line.trim());

    for (const line of lines) {
      const [id, repository, tag, size] = line.split('|');
      images.push({
        Id: id,
        RepoTags: tag ? [`${repository}:${tag}`] : [],
        Size: size,
      });
    }

    return images;
  }

  /**
   * 统计容器数量
   */
  async _countContainers() {
    const result = await run_terminal_cmd({
      command: 'docker ps -a --format "{{.State}}" | sort | uniq -c',
      is_background: false,
      explanation: '统计容器状态',
    });

    if (result.code !== 0) {
      return { total: 0, running: 0, stopped: 0 };
    }

    const stats = { total: 0, running: 0, stopped: 0 };
    const lines = result.stdout
      .trim()
      .split('\n')
      .filter((line) => line.trim());

    for (const line of lines) {
      const [count, state] = line.trim().split(/\s+/);
      const numCount = parseInt(count, 10);
      stats.total += numCount;

      if (state === 'running') {
        stats.running += numCount;
      } else if (state === 'exited' || state === 'stopped') {
        stats.stopped += numCount;
      }
    }

    return stats;
  }

  /**
   * 提取实例索引
   */
  _extractInstanceIndex(containerName) {
    const match = containerName.match(
      new RegExp(`${this.containerPrefix}(\\d+)`),
    );
    return match ? parseInt(match[1], 10) : 0;
  }

  /**
   * 格式化实例信息
   */
  _formatInstanceInfo(containerInfo, instanceIndex) {
    const portBindings = containerInfo.NetworkSettings?.Ports || {};
    const hostPort = Object.keys(portBindings).find((port) =>
      port.startsWith('3000/tcp'),
    );

    let url = `http://localhost:3000`; // 默认URL
    if (
      hostPort &&
      portBindings[hostPort] &&
      portBindings[hostPort].length > 0
    ) {
      const binding = portBindings[hostPort][0];
      url = `http://${binding.HostIp || 'localhost'}:${binding.HostPort}`;
    }

    return {
      id: containerInfo.Name.replace('/', ''),
      url,
      port: parseInt(url.split(':').pop(), 10),
      index: instanceIndex,
      containerId: containerInfo.Id,
      status: containerInfo.State.Status,
      healthy: containerInfo.State.Health?.Status === 'healthy',
      weight: 1, // 默认权重
      metadata: {
        image: containerInfo.Config.Image,
        created: containerInfo.Created,
        labels: containerInfo.Config.Labels,
      },
    };
  }

  /**
   * 获取配置
   */
  getConfig() {
    return {
      dockerHost: this.dockerHost,
      network: this.network,
      imageName: this.imageName,
      basePort: this.basePort,
      containerPrefix: this.containerPrefix,
      labels: this.labels,
      environment: this.environment,
      volumes: this.volumes,
      restartPolicy: this.restartPolicy,
    };
  }

  /**
   * 更新配置
   */
  updateConfig(config) {
    Object.assign(this, config);
    logger.info('Docker容器编排器配置已更新', config);
  }
}
