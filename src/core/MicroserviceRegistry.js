/**
 * 微服务架构 - 服务注册表和发现机制
 * 应用微服务架构原则：服务拆分、注册发现、配置管理
 */
import { logger } from '../../shared/utils/logger.js';
import { frysError } from './error-handler.js';

class ServiceDefinition {
  constructor(name, version, type, endpoints, dependencies = []) {
    this.name = name;
    this.version = version;
    this.type = type; // 'core', 'business', 'infrastructure', 'presentation'
    this.endpoints = endpoints; // API endpoints
    this.dependencies = dependencies; // 依赖的其他服务
    this.status = 'unregistered';
    this.metadata = {};
    this.registeredAt = null;
    this.lastHeartbeat = null;
  }

  register() {
    this.status = 'registered';
    this.registeredAt = new Date();
    this.lastHeartbeat = new Date();
  }

  unregister() {
    this.status = 'unregistered';
    this.registeredAt = null;
  }

  heartbeat() {
    this.lastHeartbeat = new Date();
  }

  isHealthy() {
    if (!this.lastHeartbeat) return false;
    const now = Date.now();
    const lastHeartbeat = this.lastHeartbeat.getTime();
    // 30秒内有心跳就算健康
    return now - lastHeartbeat < 30000;
  }
}

class MicroserviceRegistry {
  constructor(options = {}) {
    this.services = new Map(); // serviceName -> ServiceDefinition
    this.serviceTypes = new Map(); // type -> Set<serviceName>
    this.dependencyGraph = new Map(); // serviceName -> Set<dependentServices>
    this.healthCheckInterval = null;

    // 高级服务发现算法参数
    this.loadBalancingStrategy = options.loadBalancingStrategy || 'weighted_round_robin';
    this.consistentHashRing = new Map(); // 一致性哈希环
    this.serviceMetrics = new Map(); // serviceName -> {responseTime, errorRate, loadFactor}
    this.serviceWeights = new Map(); // serviceName -> weight
    this.roundRobinIndex = 0;

    // 服务发现缓存和优化
    this.discoveryCache = new Map();
    this.cacheTimeout = options.cacheTimeout || 30000; // 30秒缓存

    // 故障检测和恢复
    this.failureThreshold = options.failureThreshold || 0.5; // 50%错误率触发降级
    this.recoveryTimeout = options.recoveryTimeout || 60000; // 1分钟恢复时间
    this.circuitBreakers = new Map(); // serviceName -> {state, failures, lastFailure}

    this.startHealthMonitoring();
  }

  /**
   * 注册微服务
   * @param {string} name - 服务名称
   * @param {string} version - 版本
   * @param {string} type - 服务类型
   * @param {Array} endpoints - API端点
   * @param {Array} dependencies - 依赖服务
   */
  registerService(name, version, type, endpoints = [], dependencies = []) {
    const service = new ServiceDefinition(
      name,
      version,
      type,
      endpoints,
      dependencies,
    );

    // 检查循环依赖
    if (this.hasCircularDependency(name, dependencies)) {
      throw frysError.system(
        `Circular dependency detected for service ${name}`,
      );
    }

    service.register();
    this.services.set(name, service);

    // 按类型分组
    if (!this.serviceTypes.has(type)) {
      this.serviceTypes.set(type, new Set());
    }
    this.serviceTypes.get(type).add(name);

    // 构建依赖图
    for (const dep of dependencies) {
      if (!this.dependencyGraph.has(dep)) {
        this.dependencyGraph.set(dep, new Set());
      }
      this.dependencyGraph.get(dep).add(name);
    }

    logger.info(`微服务已注册: ${name} v${version} (${type})`);
    return service;
  }

  /**
   * 注销服务
   * @param {string} name - 服务名称
   */
  unregisterService(name) {
    const service = this.services.get(name);
    if (!service) {
      return;
    }

    service.unregister();
    this.services.delete(name);

    // 从类型分组中移除
    const typeSet = this.serviceTypes.get(service.type);
    if (typeSet) {
      typeSet.delete(name);
    }

    logger.info(`微服务已注销: ${name}`);
  }

  /**
   * 高级服务发现 - 支持负载均衡和智能路由
   * @param {string} name - 服务名称
   * @param {object} options - 发现选项
   * @returns {ServiceDefinition|null}
   */
  discoverService(name, options = {}) {
    // 检查缓存
    const cacheKey = `service:${name}`;
    const cached = this.discoveryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.service;
    }

    const service = this.services.get(name);
    if (!service || service.status !== 'registered') {
      return null;
    }

    // 检查熔断器状态
    if (this._isCircuitBreakerOpen(name)) {
      logger.warn(`Service ${name} is in circuit breaker open state`);
      return null;
    }

    // 缓存结果
    this.discoveryCache.set(cacheKey, {
      service,
      timestamp: Date.now()
    });

    return service;
  }

  /**
   * 智能服务选择 - 基于负载均衡策略
   * @param {string} name - 服务名称
   * @param {object} request - 请求上下文
   * @returns {ServiceDefinition|null}
   */
  selectServiceInstance(name, request = {}) {
    const service = this.discoverService(name);
    if (!service) return null;

    // 如果服务有多个实例，使用负载均衡算法
    const healthyInstances = this._getHealthyInstances(name);
    if (healthyInstances.length === 0) return null;
    if (healthyInstances.length === 1) return healthyInstances[0];

    switch (this.loadBalancingStrategy) {
      case 'weighted_round_robin':
        return this._weightedRoundRobinSelect(healthyInstances);
      case 'least_response_time':
        return this._leastResponseTimeSelect(healthyInstances);
      case 'consistent_hashing':
        return this._consistentHashSelect(healthyInstances, request);
      case 'adaptive':
        return this._adaptiveSelect(healthyInstances, request);
      case 'power_of_two':
        return this._powerOfTwoSelect(healthyInstances);
      default:
        return this._roundRobinSelect(healthyInstances);
    }
  }

  /**
   * 按类型发现服务 - 支持智能过滤和排序
   * @param {string} type - 服务类型
   * @param {object} options - 过滤和排序选项
   * @returns {Array<ServiceDefinition>}
   */
  discoverServicesByType(type, options = {}) {
    const serviceNames = this.serviceTypes.get(type) || new Set();
    let services = Array.from(serviceNames)
      .map((name) => this.services.get(name))
      .filter((service) => service && service.status === 'registered');

    // 应用健康过滤
    if (options.onlyHealthy !== false) {
      services = services.filter(service => service.isHealthy());
    }

    // 按性能排序
    if (options.sortBy === 'performance') {
      services.sort((a, b) => {
        const aMetrics = this.serviceMetrics.get(a.name) || {};
        const bMetrics = this.serviceMetrics.get(b.name) || {};
        return (aMetrics.responseTime || 0) - (bMetrics.responseTime || 0);
      });
    }

    // 按负载排序
    if (options.sortBy === 'load') {
      services.sort((a, b) => {
        const aMetrics = this.serviceMetrics.get(a.name) || {};
        const bMetrics = this.serviceMetrics.get(b.name) || {};
        return (aMetrics.loadFactor || 0) - (bMetrics.loadFactor || 0);
      });
    }

    return services;
  }

  /**
   * 获取服务依赖
   * @param {string} name - 服务名称
   * @returns {Array<string>} 依赖的服务名称列表
   */
  getServiceDependencies(name) {
    const service = this.services.get(name);
    return service ? service.dependencies : [];
  }

  /**
   * 获取依赖于指定服务的服务
   * @param {string} name - 服务名称
   * @returns {Array<string>} 依赖服务列表
   */
  getDependentServices(name) {
    return Array.from(this.dependencyGraph.get(name) || new Set());
  }

  /**
   * 检查循环依赖
   * @param {string} serviceName - 服务名称
   * @param {Array<string>} dependencies - 依赖列表
   * @param {Set<string>} visited - 已访问的服务
   * @returns {boolean}
   */
  hasCircularDependency(serviceName, dependencies, visited = new Set()) {
    if (visited.has(serviceName)) {
      return true;
    }

    visited.add(serviceName);

    for (const dep of dependencies) {
      const depService = this.services.get(dep);
      if (
        depService &&
        this.hasCircularDependency(
          dep,
          depService.dependencies,
          new Set(visited),
        )
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * 获取服务拓扑排序 (启动顺序)
   * @returns {Array<string>} 服务启动顺序
   */
  getStartupOrder() {
    const result = [];
    const visited = new Set();
    const visiting = new Set();

    const visit = (serviceName) => {
      if (visited.has(serviceName)) return;
      if (visiting.has(serviceName)) {
        throw frysError.system(`Circular dependency detected: ${serviceName}`);
      }

      visiting.add(serviceName);

      const service = this.services.get(serviceName);
      if (service) {
        for (const dep of service.dependencies) {
          visit(dep);
        }
      }

      visiting.delete(serviceName);
      visited.add(serviceName);
      result.push(serviceName);
    };

    for (const serviceName of this.services.keys()) {
      if (!visited.has(serviceName)) {
        visit(serviceName);
      }
    }

    return result;
  }

  /**
   * 获取服务关闭顺序
   * @returns {Array<string>} 服务关闭顺序 (启动顺序的逆序)
   */
  getShutdownOrder() {
    return this.getStartupOrder().reverse();
  }

  /**
   * 启动健康监控
   */
  startHealthMonitoring() {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks();
    }, 10000); // 每10秒检查一次
  }

  /**
   * 执行健康检查
   */
  performHealthChecks() {
    for (const [name, service] of this.services) {
      if (!service.isHealthy()) {
        logger.warn(`服务健康检查失败: ${name}`);
        // 可以在这里触发告警或自动重启
      }
    }
  }

  /**
   * 获取注册表统计信息
   */
  getStats() {
    const stats = {
      totalServices: this.services.size,
      servicesByType: {},
      healthyServices: 0,
      unhealthyServices: 0,
      dependencyGraph: {},
    };

    // 按类型统计
    for (const [type, services] of this.serviceTypes) {
      stats.servicesByType[type] = services.size;
    }

    // 健康状态统计
    for (const service of this.services.values()) {
      if (service.isHealthy()) {
        stats.healthyServices++;
      } else {
        stats.unhealthyServices++;
      }
    }

    // 依赖图
    for (const [service, dependents] of this.dependencyGraph) {
      stats.dependencyGraph[service] = Array.from(dependents);
    }

    return stats;
  }

  /**
   * 清理资源
   */
  shutdown() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    // 注销所有服务
    for (const serviceName of this.services.keys()) {
      this.unregisterService(serviceName);
    }

    // 清理缓存和状态
    this.discoveryCache.clear();
    this.serviceMetrics.clear();
    this.circuitBreakers.clear();

    logger.info('微服务注册表已关闭');
  }

  // =============== 高级负载均衡算法实现 ===============

  /**
   * 获取健康的服务实例
   */
  _getHealthyInstances(serviceName) {
    // 简化实现，假设每个服务只有一个实例
    // 在实际分布式系统中，这里应该返回该服务的所有健康实例
    const service = this.services.get(serviceName);
    return service && service.isHealthy() ? [service] : [];
  }

  /**
   * 轮询选择算法
   */
  _roundRobinSelect(instances) {
    const instance = instances[this.roundRobinIndex % instances.length];
    this.roundRobinIndex = (this.roundRobinIndex + 1) % instances.length;
    return instance;
  }

  /**
   * 加权轮询选择算法
   */
  _weightedRoundRobinSelect(instances) {
    let totalWeight = 0;
    for (const instance of instances) {
      const weight = this.serviceWeights.get(instance.name) || 1;
      totalWeight += weight;
    }

    let randomWeight = Math.random() * totalWeight;

    for (const instance of instances) {
      const weight = this.serviceWeights.get(instance.name) || 1;
      randomWeight -= weight;
      if (randomWeight <= 0) {
        return instance;
      }
    }

    return instances[0];
  }

  /**
   * 最小响应时间选择算法
   */
  _leastResponseTimeSelect(instances) {
    return instances.reduce((best, current) => {
      const bestMetrics = this.serviceMetrics.get(best.name) || {};
      const currentMetrics = this.serviceMetrics.get(current.name) || {};
      return (currentMetrics.responseTime || 0) < (bestMetrics.responseTime || 0) ? current : best;
    });
  }

  /**
   * 一致性哈希选择算法
   */
  _consistentHashSelect(instances, request) {
    const key = request.userId || request.sessionId || request.ip || Math.random().toString();
    const hash = this._simpleHash(key);

    // 简化实现：基于实例名称哈希
    const instanceIndex = Math.abs(hash) % instances.length;
    return instances[instanceIndex];
  }

  /**
   * 自适应选择算法
   */
  _adaptiveSelect(instances, request) {
    // 基于性能指标动态选择
    const scoredInstances = instances.map(instance => {
      const metrics = this.serviceMetrics.get(instance.name) || {};
      const weight = this.serviceWeights.get(instance.name) || 1;

      // 综合评分：权重 / (1 + 响应时间 + 错误率 + 负载因子)
      const score = weight / (1 + (metrics.responseTime || 0) + (metrics.errorRate || 0) + (metrics.loadFactor || 0));

      return { instance, score };
    });

    scoredInstances.sort((a, b) => b.score - a.score);
    return scoredInstances[0].instance;
  }

  /**
   * 两选择最佳算法
   */
  _powerOfTwoSelect(instances) {
    if (instances.length === 1) return instances[0];

    // 随机选择两个实例
    const choice1 = instances[Math.floor(Math.random() * instances.length)];
    let choice2;
    do {
      choice2 = instances[Math.floor(Math.random() * instances.length)];
    } while (choice2.name === choice1.name);

    // 选择负载更轻的实例
    const load1 = (this.serviceMetrics.get(choice1.name) || {}).loadFactor || 0;
    const load2 = (this.serviceMetrics.get(choice2.name) || {}).loadFactor || 0;

    return load1 <= load2 ? choice1 : choice2;
  }

  // =============== 熔断器和故障检测 ===============

  /**
   * 检查熔断器状态
   */
  _isCircuitBreakerOpen(serviceName) {
    const breaker = this.circuitBreakers.get(serviceName);
    if (!breaker) return false;

    if (breaker.state === 'open') {
      // 检查是否可以尝试半开状态
      if (Date.now() - breaker.lastFailure > this.recoveryTimeout) {
        breaker.state = 'half_open';
        breaker.failures = 0;
        logger.info(`Circuit breaker for ${serviceName} moved to half-open state`);
        return false;
      }
      return true;
    }

    return false;
  }

  /**
   * 记录服务调用结果
   */
  recordServiceCall(serviceName, success, responseTime, error = null) {
    const metrics = this.serviceMetrics.get(serviceName) || {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      responseTime: 0,
      errorRate: 0,
      loadFactor: 0
    };

    metrics.totalCalls++;

    if (success) {
      metrics.successfulCalls++;
      // 更新响应时间 (指数移动平均)
      metrics.responseTime = metrics.responseTime * 0.7 + responseTime * 0.3;
    } else {
      metrics.failedCalls++;
    }

    metrics.errorRate = metrics.failedCalls / metrics.totalCalls;
    metrics.loadFactor = metrics.totalCalls / 100; // 简化的负载因子

    this.serviceMetrics.set(serviceName, metrics);

    // 更新熔断器状态
    this._updateCircuitBreaker(serviceName, success);

    // 动态调整权重
    this._updateServiceWeight(serviceName, metrics);
  }

  /**
   * 更新熔断器状态
   */
  _updateCircuitBreaker(serviceName, success) {
    const breaker = this.circuitBreakers.get(serviceName) || {
      state: 'closed',
      failures: 0,
      lastFailure: 0
    };

    if (!success) {
      breaker.failures++;
      breaker.lastFailure = Date.now();

      if (breaker.failures / (breaker.failures + (this.serviceMetrics.get(serviceName)?.successfulCalls || 0)) > this.failureThreshold) {
        breaker.state = 'open';
        logger.warn(`Circuit breaker for ${serviceName} opened due to high error rate`);
      }
    } else if (breaker.state === 'half_open') {
      // 半开状态下的成功调用
      breaker.state = 'closed';
      breaker.failures = 0;
      logger.info(`Circuit breaker for ${serviceName} closed after successful call`);
    }

    this.circuitBreakers.set(serviceName, breaker);
  }

  /**
   * 更新服务权重
   */
  _updateServiceWeight(serviceName, metrics) {
    // 基于性能指标调整权重
    const baseWeight = 1.0;
    const performanceFactor = 1 / (1 + metrics.errorRate + metrics.responseTime / 1000);
    const loadFactor = Math.max(0.1, 1 - metrics.loadFactor);

    const newWeight = baseWeight * performanceFactor * loadFactor;
    this.serviceWeights.set(serviceName, Math.max(0.1, Math.min(5.0, newWeight)));
  }

  /**
   * 简单哈希函数
   */
  _simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return Math.abs(hash);
  }

  /**
   * 获取服务统计信息
   */
  getServiceStats() {
    const stats = {};

    for (const [serviceName, service] of this.services.entries()) {
      stats[serviceName] = {
        healthy: service.isHealthy(),
        registered: service.status === 'registered',
        metrics: this.serviceMetrics.get(serviceName) || {},
        weight: this.serviceWeights.get(serviceName) || 1,
        circuitBreaker: this.circuitBreakers.get(serviceName) || { state: 'closed' }
      };
    }

    return stats;
  }
}

// 单例模式
let registryInstance = null;

export function getMicroserviceRegistry() {
  if (!registryInstance) {
    registryInstance = new MicroserviceRegistry();
  }
  return registryInstance;
}

export { MicroserviceRegistry, ServiceDefinition };
export default MicroserviceRegistry;
