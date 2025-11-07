/**
 * WokeFlow - 负载均衡器
 * 管理和分发请求到多个服务实例
 */

import { logger } from '../../utils/logger.js';

export class LoadBalancer {
  constructor(config = {}) {
    this.algorithm = config.algorithm || 'round_robin'; // round_robin, least_connections, weighted_round_robin, ip_hash
    this.healthCheckInterval = config.healthCheckInterval || 30000; // 30秒
    this.healthCheckTimeout = config.healthCheckTimeout || 5000; // 5秒
    this.maxRetries = config.maxRetries || 3;
    this.instances = new Map(); // instanceId -> { url, weight, healthy, connections, lastHealthCheck }
    this.currentIndex = 0;
    this.ipHashMap = new Map(); // ip -> instanceId
    this.healthCheckTimer = null;
    this.isRunning = false;
  }

  /**
   * 添加服务实例
   * @param {string} instanceId - 实例ID
   * @param {string} url - 实例URL
   * @param {object} options - 配置选项
   */
  addInstance(instanceId, url, options = {}) {
    this.instances.set(instanceId, {
      url,
      weight: options.weight || 1,
      healthy: true,
      connections: 0,
      lastHealthCheck: Date.now(),
      metadata: options.metadata || {},
    });

    logger.info('添加负载均衡实例', {
      instanceId,
      url,
      weight: options.weight || 1,
    });
  }

  /**
   * 移除服务实例
   * @param {string} instanceId - 实例ID
   */
  removeInstance(instanceId) {
    this.instances.delete(instanceId);
    // 清理IP哈希映射
    for (const [ip, mappedInstanceId] of this.ipHashMap) {
      if (mappedInstanceId === instanceId) {
        this.ipHashMap.delete(ip);
      }
    }
    logger.info('移除负载均衡实例', { instanceId });
  }

  /**
   * 获取下一个服务实例
   * @param {object} request - 请求对象
   * @returns {object} 选中的实例
   */
  getNextInstance(request = {}) {
    const healthyInstances = Array.from(this.instances.entries()).filter(
      ([_, instance]) => instance.healthy,
    );

    if (healthyInstances.length === 0) {
      throw new Error('没有健康的实例可用');
    }

    let selectedInstance = null;

    switch (this.algorithm) {
      case 'round_robin':
        selectedInstance = this._roundRobinSelect(healthyInstances);
        break;
      case 'least_connections':
        selectedInstance = this._leastConnectionsSelect(healthyInstances);
        break;
      case 'weighted_round_robin':
        selectedInstance = this._weightedRoundRobinSelect(healthyInstances);
        break;
      case 'ip_hash':
        selectedInstance = this._ipHashSelect(healthyInstances, request);
        break;
      default:
        selectedInstance = this._roundRobinSelect(healthyInstances);
    }

    if (selectedInstance) {
      selectedInstance.connections++;
      logger.debug('选择实例处理请求', {
        instanceId: selectedInstance.instanceId,
        algorithm: this.algorithm,
        connections: selectedInstance.connections,
      });
    }

    return selectedInstance;
  }

  /**
   * 轮询选择算法
   */
  _roundRobinSelect(healthyInstances) {
    if (this.currentIndex >= healthyInstances.length) {
      this.currentIndex = 0;
    }

    const [instanceId, instance] = healthyInstances[this.currentIndex];
    this.currentIndex++;

    return { instanceId, ...instance };
  }

  /**
   * 最少连接选择算法
   */
  _leastConnectionsSelect(healthyInstances) {
    let minConnections = Infinity;
    let selectedInstance = null;

    for (const [instanceId, instance] of healthyInstances) {
      if (instance.connections < minConnections) {
        minConnections = instance.connections;
        selectedInstance = { instanceId, ...instance };
      }
    }

    return selectedInstance;
  }

  /**
   * 加权轮询选择算法
   */
  _weightedRoundRobinSelect(healthyInstances) {
    // 简化实现：基于权重随机选择
    const totalWeight = healthyInstances.reduce(
      (sum, [_, instance]) => sum + instance.weight,
      0,
    );
    let random = Math.random() * totalWeight;

    for (const [instanceId, instance] of healthyInstances) {
      random -= instance.weight;
      if (random <= 0) {
        return { instanceId, ...instance };
      }
    }

    // 兜底选择第一个
    const [instanceId, instance] = healthyInstances[0];
    return { instanceId, ...instance };
  }

  /**
   * IP哈希选择算法
   */
  _ipHashSelect(healthyInstances, request) {
    const clientIP = request.ip || request.clientIP || '127.0.0.1';

    // 检查是否已有映射
    if (this.ipHashMap.has(clientIP)) {
      const instanceId = this.ipHashMap.get(clientIP);
      const instance = this.instances.get(instanceId);
      if (instance && instance.healthy) {
        return { instanceId, ...instance };
      }
      // 如果映射的实例不健康，删除映射
      this.ipHashMap.delete(clientIP);
    }

    // 创建新的哈希映射
    const hash = this._simpleHash(clientIP);
    const index = hash % healthyInstances.length;
    const [instanceId, instance] = healthyInstances[index];

    this.ipHashMap.set(clientIP, instanceId);
    return { instanceId, ...instance };
  }

  /**
   * 简单的哈希函数
   */
  _simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // 转换为32位整数
    }
    return Math.abs(hash);
  }

  /**
   * 释放实例连接
   * @param {string} instanceId - 实例ID
   */
  releaseConnection(instanceId) {
    const instance = this.instances.get(instanceId);
    if (instance && instance.connections > 0) {
      instance.connections--;
    }
  }

  /**
   * 开始健康检查
   */
  async startHealthChecks() {
    if (this.isRunning) {
      logger.warn('健康检查已在运行中');
      return;
    }

    this.isRunning = true;
    logger.info('开始健康检查');

    this.healthCheckTimer = setInterval(() => {
      this._performHealthChecks();
    }, this.healthCheckInterval);

    // 立即执行一次健康检查
    await this._performHealthChecks();
  }

  /**
   * 停止健康检查
   */
  stopHealthChecks() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
    this.isRunning = false;
    logger.info('停止健康检查');
  }

  /**
   * 执行健康检查
   */
  async _performHealthChecks() {
    const checkPromises = Array.from(this.instances.entries()).map(
      async ([instanceId, instance]) => {
        try {
          const isHealthy = await this._checkInstanceHealth(instance);
          const wasHealthy = instance.healthy;

          instance.healthy = isHealthy;
          instance.lastHealthCheck = Date.now();

          if (wasHealthy !== isHealthy) {
            logger.info('实例健康状态变更', {
              instanceId,
              url: instance.url,
              healthy: isHealthy,
              previousHealthy: wasHealthy,
            });
          }

          return { instanceId, healthy: isHealthy };
        } catch (error) {
          logger.error('健康检查失败', {
            instanceId,
            url: instance.url,
            error: error.message,
          });
          instance.healthy = false;
          instance.lastHealthCheck = Date.now();
          return { instanceId, healthy: false };
        }
      },
    );

    await Promise.allSettled(checkPromises);
  }

  /**
   * 检查实例健康状态
   * @param {object} instance - 实例信息
   * @returns {boolean} 是否健康
   */
  async _checkInstanceHealth(instance) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        this.healthCheckTimeout,
      );

      const response = await fetch(`${instance.url}/health`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent': 'WokeFlow-LoadBalancer/1.0',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return false;
      }

      const healthData = await response.json();
      return healthData.status === 'healthy' || healthData.status === 'ok';
    } catch (error) {
      if (error.name === 'AbortError') {
        logger.warn('健康检查超时', {
          url: instance.url,
          timeout: this.healthCheckTimeout,
        });
      }
      return false;
    }
  }

  /**
   * 获取负载均衡统计信息
   */
  getStats() {
    const instances = Array.from(this.instances.entries()).map(
      ([instanceId, instance]) => ({
        instanceId,
        url: instance.url,
        weight: instance.weight,
        healthy: instance.healthy,
        connections: instance.connections,
        lastHealthCheck: instance.lastHealthCheck,
        metadata: instance.metadata,
      }),
    );

    const healthyCount = instances.filter((i) => i.healthy).length;
    const totalConnections = instances.reduce(
      (sum, i) => sum + i.connections,
      0,
    );

    return {
      algorithm: this.algorithm,
      totalInstances: instances.length,
      healthyInstances: healthyCount,
      unhealthyInstances: instances.length - healthyCount,
      totalConnections,
      instances,
    };
  }

  /**
   * 转发请求到选中的实例
   * @param {object} request - 请求对象
   * @param {object} response - 响应对象
   * @param {function} next - 下一个中间件
   */
  async proxyRequest(request, response, next) {
    let retries = 0;
    let lastError = null;

    while (retries <= this.maxRetries) {
      try {
        const instance = this.getNextInstance(request);

        if (!instance) {
          throw new Error('没有可用的实例');
        }

        // 转发请求
        const result = await this._forwardRequest(instance, request);

        // 发送响应
        response.status(result.status).json(result.data);

        // 释放连接
        this.releaseConnection(instance.instanceId);

        return;
      } catch (error) {
        lastError = error;
        retries++;

        logger.warn('请求转发失败，重试中', {
          retries,
          maxRetries: this.maxRetries,
          error: error.message,
        });

        // 如果还有重试机会，继续
        if (retries <= this.maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 100 * retries)); // 指数退避
        }
      }
    }

    // 所有重试都失败了
    logger.error('请求转发最终失败', {
      retries: this.maxRetries,
      error: lastError.message,
    });
    response.status(503).json({
      error: 'Service Unavailable',
      message: '所有服务实例都不可用',
    });
  }

  /**
   * 转发请求到指定实例
   */
  async _forwardRequest(instance, originalRequest) {
    const targetUrl = `${instance.url}${originalRequest.url}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时

      const response = await fetch(targetUrl, {
        method: originalRequest.method,
        headers: {
          ...originalRequest.headers,
          'X-Forwarded-For':
            originalRequest.ip || originalRequest.connection.remoteAddress,
          'X-Forwarded-Proto': originalRequest.protocol,
          'X-Forwarded-Host': originalRequest.get('host'),
        },
        body:
          originalRequest.method !== 'GET' && originalRequest.method !== 'HEAD'
            ? originalRequest.body
            : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      return {
        status: response.status,
        data,
      };
    } catch (error) {
      // 标记实例为不健康
      const instanceData = this.instances.get(instance.instanceId);
      if (instanceData) {
        instanceData.healthy = false;
      }

      throw error;
    }
  }

  /**
   * 获取配置
   */
  getConfig() {
    return {
      algorithm: this.algorithm,
      healthCheckInterval: this.healthCheckInterval,
      healthCheckTimeout: this.healthCheckTimeout,
      maxRetries: this.maxRetries,
      isRunning: this.isRunning,
    };
  }

  /**
   * 更新配置
   */
  updateConfig(config) {
    Object.assign(this, config);
    logger.info('负载均衡器配置已更新', config);
  }
}
