/**
 * frys - 核心服务保护器
 * 保护关键服务的可用性，防止级联故障
 */

import { logger } from '../../utils/logger.js';
import { EventBus } from '../../shared/kernel/EventBus.js';

export class CoreServiceProtector {
  constructor(config = {}) {
    this.eventBus = config.eventBus || new EventBus();
    this.criticalServices = new Map();
    this.serviceHealth = new Map();
    this.failureThreshold = config.failureThreshold || 5; // 失败阈值
    this.recoveryTime = config.recoveryTime || 30000; // 恢复时间
    this.healthCheckInterval = config.healthCheckInterval || 10000; // 健康检查间隔
    this.circuitBreakerState = new Map(); // 服务断路器状态
    this.healthCheckTimer = null;
    this.isRunning = false;

    // 断路器状态
    this.CIRCUIT_STATES = {
      CLOSED: 'closed', // 正常状态
      OPEN: 'open', // 断开状态
      HALF_OPEN: 'half_open', // 半开状态（测试恢复）
    };
  }

  /**
   * 注册核心服务
   * @param {string} serviceId - 服务ID
   * @param {object} config - 服务配置
   */
  registerService(serviceId, config) {
    this.criticalServices.set(serviceId, {
      serviceId,
      name: config.name || serviceId,
      healthCheck: config.healthCheck,
      fallback: config.fallback,
      timeout: config.timeout || 5000,
      retries: config.retries || 3,
      priority: config.priority || 100,
      dependencies: config.dependencies || [],
      isCritical: config.isCritical !== false,
    });

    // 初始化服务健康状态
    this.serviceHealth.set(serviceId, {
      status: 'unknown',
      lastCheck: 0,
      consecutiveFailures: 0,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      lastError: null,
    });

    // 初始化断路器状态
    this.circuitBreakerState.set(serviceId, {
      state: this.CIRCUIT_STATES.CLOSED,
      failureCount: 0,
      lastFailureTime: 0,
      nextRetryTime: 0,
    });

    logger.info('核心服务已注册', {
      serviceId,
      name: config.name,
      priority: config.priority,
    });
  }

  /**
   * 注销核心服务
   * @param {string} serviceId - 服务ID
   */
  unregisterService(serviceId) {
    this.criticalServices.delete(serviceId);
    this.serviceHealth.delete(serviceId);
    this.circuitBreakerState.delete(serviceId);
    logger.info('核心服务已注销', { serviceId });
  }

  /**
   * 启动服务保护
   */
  async start() {
    if (this.isRunning) {
      logger.warn('核心服务保护器已在运行');
      return;
    }

    this.isRunning = true;
    logger.info('启动核心服务保护');

    // 执行初始健康检查
    await this.performHealthChecks();

    // 启动定期健康检查
    this.healthCheckTimer = setInterval(() => {
      this.performHealthChecks();
    }, this.healthCheckInterval);
  }

  /**
   * 停止服务保护
   */
  stop() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
    this.isRunning = false;
    logger.info('核心服务保护已停止');
  }

  /**
   * 执行服务调用（带保护）
   * @param {string} serviceId - 服务ID
   * @param {Function} operation - 要执行的操作
   * @param {object} options - 调用选项
   */
  async executeProtected(serviceId, operation, options = {}) {
    const service = this.criticalServices.get(serviceId);
    if (!service) {
      throw new Error(`未注册的服务: ${serviceId}`);
    }

    const circuitState = this.circuitBreakerState.get(serviceId);

    // 检查断路器状态
    if (circuitState.state === this.CIRCUIT_STATES.OPEN) {
      if (Date.now() < circuitState.nextRetryTime) {
        // 断路器打开，使用降级方案
        return this.executeFallback(serviceId, options.fallbackData);
      } else {
        // 尝试半开状态
        circuitState.state = this.CIRCUIT_STATES.HALF_OPEN;
        logger.info('断路器进入半开状态', { serviceId });
      }
    }

    const health = this.serviceHealth.get(serviceId);
    const startTime = Date.now();

    try {
      // 执行带超时的操作
      const result = await this.executeWithTimeout(operation, service.timeout);

      // 更新健康统计
      health.totalRequests++;
      health.successfulRequests++;
      health.lastCheck = Date.now();
      health.averageResponseTime = this.updateAverageResponseTime(
        health.averageResponseTime,
        Date.now() - startTime,
        health.successfulRequests,
      );

      // 重置断路器
      if (circuitState.state === this.CIRCUIT_STATES.HALF_OPEN) {
        circuitState.state = this.CIRCUIT_STATES.CLOSED;
        circuitState.failureCount = 0;
        logger.info('断路器关闭，服务恢复正常', { serviceId });
      }

      return result;
    } catch (error) {
      // 更新失败统计
      health.totalRequests++;
      health.failedRequests++;
      health.consecutiveFailures++;
      health.lastError = error.message;
      health.lastCheck = Date.now();

      // 更新断路器
      circuitState.failureCount++;
      circuitState.lastFailureTime = Date.now();

      // 检查是否需要打开断路器
      if (
        circuitState.state === this.CIRCUIT_STATES.HALF_OPEN ||
        circuitState.failureCount >= this.failureThreshold
      ) {
        circuitState.state = this.CIRCUIT_STATES.OPEN;
        circuitState.nextRetryTime = Date.now() + this.recoveryTime;
        logger.warn('断路器打开', {
          serviceId,
          failures: circuitState.failureCount,
        });
      }

      // 发布服务故障事件
      this.eventBus.publish('serviceFailure', {
        serviceId,
        error: error.message,
        consecutiveFailures: health.consecutiveFailures,
        circuitState: circuitState.state,
        timestamp: Date.now(),
      });

      // 使用降级方案
      return this.executeFallback(serviceId, options.fallbackData);
    }
  }

  /**
   * 执行带超时的操作
   */
  async executeWithTimeout(operation, timeout) {
    return new Promise(async (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('操作超时'));
      }, timeout);

      try {
        const result = await operation();
        clearTimeout(timeoutId);
        resolve(result);
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  /**
   * 执行降级方案
   */
  async executeFallback(serviceId, fallbackData) {
    const service = this.criticalServices.get(serviceId);

    if (service.fallback) {
      try {
        logger.warn('执行服务降级方案', { serviceId });
        return await service.fallback(fallbackData);
      } catch (fallbackError) {
        logger.error('降级方案执行失败', {
          serviceId,
          error: fallbackError.message,
        });
      }
    }

    // 默认降级响应
    throw new Error(`服务不可用: ${serviceId}`);
  }

  /**
   * 执行健康检查
   */
  async performHealthChecks() {
    const services = Array.from(this.criticalServices.values());

    for (const service of services) {
      await this.checkServiceHealth(service.serviceId);
    }
  }

  /**
   * 检查单个服务健康状态
   */
  async checkServiceHealth(serviceId) {
    const service = this.criticalServices.get(serviceId);
    const health = this.serviceHealth.get(serviceId);

    if (!service.healthCheck) {
      health.status = 'unknown';
      return;
    }

    try {
      const isHealthy = await service.healthCheck();
      health.status = isHealthy ? 'healthy' : 'unhealthy';
      health.lastCheck = Date.now();

      if (!isHealthy) {
        health.consecutiveFailures++;
      } else {
        health.consecutiveFailures = 0;
      }
    } catch (error) {
      health.status = 'unhealthy';
      health.lastCheck = Date.now();
      health.consecutiveFailures++;
      health.lastError = error.message;

      logger.warn('服务健康检查失败', { serviceId, error: error.message });
    }

    // 发布健康状态变更事件
    this.eventBus.publish('serviceHealthChanged', {
      serviceId,
      status: health.status,
      consecutiveFailures: health.consecutiveFailures,
      timestamp: Date.now(),
    });
  }

  /**
   * 获取服务状态
   * @param {string} serviceId - 服务ID
   */
  getServiceStatus(serviceId) {
    const service = this.criticalServices.get(serviceId);
    const health = this.serviceHealth.get(serviceId);
    const circuit = this.circuitBreakerState.get(serviceId);

    if (!service || !health || !circuit) {
      return null;
    }

    return {
      serviceId,
      name: service.name,
      priority: service.priority,
      isCritical: service.isCritical,
      health: {
        status: health.status,
        lastCheck: health.lastCheck,
        consecutiveFailures: health.consecutiveFailures,
        totalRequests: health.totalRequests,
        successRate:
          health.totalRequests > 0
            ? health.successfulRequests / health.totalRequests
            : 0,
        averageResponseTime: health.averageResponseTime,
        lastError: health.lastError,
      },
      circuitBreaker: {
        state: circuit.state,
        failureCount: circuit.failureCount,
        lastFailureTime: circuit.lastFailureTime,
        nextRetryTime: circuit.nextRetryTime,
      },
    };
  }

  /**
   * 获取所有服务状态
   */
  getAllServicesStatus() {
    const statuses = {};

    for (const serviceId of this.criticalServices.keys()) {
      statuses[serviceId] = this.getServiceStatus(serviceId);
    }

    return statuses;
  }

  /**
   * 获取关键服务健康概览
   */
  getHealthOverview() {
    const services = Array.from(this.criticalServices.values());
    const overview = {
      total: services.length,
      healthy: 0,
      unhealthy: 0,
      unknown: 0,
      criticalFailures: 0,
      circuitBreakersOpen: 0,
    };

    for (const service of services) {
      const status = this.getServiceStatus(service.serviceId);

      if (status.health.status === 'healthy') {
        overview.healthy++;
      } else if (status.health.status === 'unhealthy') {
        overview.unhealthy++;
      } else {
        overview.unknown++;
      }

      if (status.health.consecutiveFailures > this.failureThreshold) {
        overview.criticalFailures++;
      }

      if (status.circuitBreaker.state === this.CIRCUIT_STATES.OPEN) {
        overview.circuitBreakersOpen++;
      }
    }

    overview.overallStatus = this.determineOverallStatus(overview);

    return overview;
  }

  /**
   * 确定整体健康状态
   */
  determineOverallStatus(overview) {
    if (overview.criticalFailures > 0 || overview.circuitBreakersOpen > 0) {
      return 'critical';
    }
    if (overview.unhealthy > 0) {
      return 'degraded';
    }
    if (overview.unknown > 0) {
      return 'unknown';
    }
    return 'healthy';
  }

  /**
   * 更新平均响应时间
   */
  updateAverageResponseTime(currentAverage, newValue, count) {
    // 使用移动平均
    return (currentAverage * (count - 1) + newValue) / count;
  }

  /**
   * 重置服务状态（用于测试）
   */
  resetService(serviceId) {
    const health = this.serviceHealth.get(serviceId);
    const circuit = this.circuitBreakerState.get(serviceId);

    if (health) {
      health.consecutiveFailures = 0;
      health.lastError = null;
    }

    if (circuit) {
      circuit.state = this.CIRCUIT_STATES.CLOSED;
      circuit.failureCount = 0;
      circuit.lastFailureTime = 0;
      circuit.nextRetryTime = 0;
    }

    logger.info('服务状态已重置', { serviceId });
  }

  /**
   * 强制打开断路器（用于测试）
   */
  forceOpenCircuit(serviceId) {
    const circuit = this.circuitBreakerState.get(serviceId);
    if (circuit) {
      circuit.state = this.CIRCUIT_STATES.OPEN;
      circuit.nextRetryTime = Date.now() + this.recoveryTime;
      logger.info('断路器已强制打开', { serviceId });
    }
  }
}
