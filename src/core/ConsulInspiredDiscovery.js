/**
 * ConsulInspiredServiceDiscovery 风格的Consul系统
 * 借鉴 Consul 的核心理念
 */
class ConsulInspiredServiceDiscovery {
  /**
   * 构造函数
   * 初始化服务发现管理器
   */
  constructor() {
    this.services = new Map(); // 服务注册表
    this.healthChecks = new Map(); // 健康检查
    this.configs = new Map(); // 配置存储
    this.nodes = new Map(); // 节点信息
  }

  /**
   * 注册服务
   * @param {string} serviceId - 服务ID
   * @param {Object} service - 服务信息
   */
  registerService(serviceId, service) {
    const svc = {
      id: serviceId,
      name: service.name || serviceId,
      address: service.address || 'localhost',
      port: service.port || 3000,
      tags: service.tags || [],
      registeredAt: Date.now(),
    };

    this.services.set(serviceId, svc);
    console.log(`📝 服务已注册: ${serviceId} (${svc.address}:${svc.port})`);
    return svc;
  }

  /**
   * 发现服务
   * @param {string} serviceName - 服务名称
   * @returns {Array} 服务实例列表
   */
  discoverService(serviceName) {
    const services = Array.from(this.services.values()).filter(
      (svc) => svc.name === serviceName,
    );

    console.log(
      `🔍 服务发现: ${serviceName} -> 找到 ${services.length} 个实例`,
    );
    return services;
  }

  /**
   * 设置配置
   * @param {string} key - 配置键
   * @param {any} value - 配置值
   */
  setConfig(key, value) {
    this.configs.set(key, { value, updatedAt: Date.now() });
    console.log(`⚙️ 配置已设置: ${key}`);
  }

  /**
   * 获取配置
   * @param {string} key - 配置键
   * @returns {any} 配置值
   */
  getConfig(key) {
    return this.configs.get(key)?.value;
  }

  /**
   * 添加健康检查
   * @param {string} serviceId - 服务ID
   * @param {Function} checkFn - 检查函数
   */
  addHealthCheck(serviceId, checkFn) {
    this.healthChecks.set(serviceId, {
      checkFn,
      lastCheck: null,
      status: 'unknown',
    });
    console.log(`❤️ 健康检查已添加: ${serviceId}`);
  }

  /**
   * 获取统计信息
   * @returns {Object} 统计数据
   */
  getStats() {
    return {
      services: this.services.size,
      healthChecks: this.healthChecks.size,
      configs: this.configs.size,
      nodes: this.nodes.size,
    };
  }
}

export default ConsulInspiredServiceDiscovery;
