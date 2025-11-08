/**
 * 微服务架构 - 服务注册表和发现机制
 * 应用微服务架构原则：服务拆分、注册发现、配置管理
 */
import { logger } from '../utils/logger.js';
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
    return (now - lastHeartbeat) < 30000;
  }
}

class MicroserviceRegistry {
  constructor() {
    this.services = new Map(); // serviceName -> ServiceDefinition
    this.serviceTypes = new Map(); // type -> Set<serviceName>
    this.dependencyGraph = new Map(); // serviceName -> Set<dependentServices>
    this.healthCheckInterval = null;

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
    const service = new ServiceDefinition(name, version, type, endpoints, dependencies);

    // 检查循环依赖
    if (this.hasCircularDependency(name, dependencies)) {
      throw frysError.system(`Circular dependency detected for service ${name}`);
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
   * 发现服务
   * @param {string} name - 服务名称
   * @returns {ServiceDefinition|null}
   */
  discoverService(name) {
    return this.services.get(name) || null;
  }

  /**
   * 按类型发现服务
   * @param {string} type - 服务类型
   * @returns {Array<ServiceDefinition>}
   */
  discoverServicesByType(type) {
    const serviceNames = this.serviceTypes.get(type) || new Set();
    return Array.from(serviceNames)
      .map(name => this.services.get(name))
      .filter(service => service && service.status === 'registered');
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
      if (depService && this.hasCircularDependency(dep, depService.dependencies, new Set(visited))) {
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
      dependencyGraph: {}
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

    logger.info('微服务注册表已关闭');
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
