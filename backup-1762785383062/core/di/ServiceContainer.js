/**
 * 服务容器
 * 高级依赖注入容器，提供服务定义、生命周期管理和依赖解析
 */

import { logger } from '../../shared/utils/logger.js';
import { Container } from './Container.js';
import { ErrorHandlerUtils } from '../../shared/utils/ErrorHandlerUtils.js';
import { ResourceCleanupUtils } from '../../shared/utils/ResourceCleanupUtils.js';

export class ServiceContainer extends Container {
  constructor(options = {}) {
    super(options);

    this.options = {
      ...this.options,
      enableServiceDiscovery: true,
      enableHealthChecks: true,
      enableMetrics: true,
      defaultScope: 'singleton',
      serviceTimeout: 30000,
      ...options
    };

    // 服务定义
    this.serviceDefinitions = new Map();

    // 服务健康检查
    this.healthCheckers = new Map();

    // 服务指标
    this.serviceMetrics = new Map();

    // 服务发现
    this.serviceRegistry = new Map();

    // 初始化管理器
    this.initializationOrder = [];
    this.initializedServices = new Set();

    logger.info('Service container initialized', {
      serviceDiscovery: this.options.enableServiceDiscovery,
      healthChecks: this.options.enableHealthChecks,
      defaultScope: this.options.defaultScope
    });
  }

  /**
   * 定义服务
   * @param {string} name - 服务名称
   * @param {Function|Object} serviceClass - 服务类
   * @param {Object} definition - 服务定义
   */
  defineService(name, serviceClass, definition = {}) {
    const serviceDefinition = {
      name,
      serviceClass,
      definition: {
        scope: definition.scope || this.options.defaultScope,
        dependencies: definition.dependencies || [],
        tags: definition.tags || [],
        metadata: definition.metadata || {},
        interfaces: definition.interfaces || [],
        lifecycle: {
          init: definition.init || null,
          destroy: definition.destroy || null,
          healthCheck: definition.healthCheck || null,
          ...definition.lifecycle
        },
        configuration: {
          timeout: definition.timeout || this.options.serviceTimeout,
          retryAttempts: definition.retryAttempts || 0,
          circuitBreaker: definition.circuitBreaker || false,
          ...definition.configuration
        },
        ...definition
      },
      registeredAt: Date.now(),
      version: definition.version || '1.0.0'
    };

    // 验证服务定义
    this._validateServiceDefinition(serviceDefinition);

    this.serviceDefinitions.set(name, serviceDefinition);

    // 注册到基础容器
    this.register(name, serviceClass, {
      scope: serviceDefinition.definition.scope,
      dependencies: serviceDefinition.definition.dependencies,
      tags: serviceDefinition.definition.tags,
      metadata: serviceDefinition.definition.metadata
    });

    // 注册健康检查器
    if (serviceDefinition.definition.lifecycle.healthCheck && this.options.enableHealthChecks) {
      this.healthCheckers.set(name, serviceDefinition.definition.lifecycle.healthCheck);
    }

    // 注册服务指标
    if (this.options.enableMetrics) {
      this.serviceMetrics.set(name, {
        created: 0,
        destroyed: 0,
        errors: 0,
        lastUsed: null,
        averageLifetime: 0
      });
    }

    // 注册到服务发现
    if (this.options.enableServiceDiscovery) {
      this._registerServiceDiscovery(name, serviceDefinition);
    }

    logger.debug(`Service defined: ${name}`, {
      scope: serviceDefinition.definition.scope,
      dependencies: serviceDefinition.definition.dependencies.length,
      interfaces: serviceDefinition.definition.interfaces.length
    });

    return this;
  }

  /**
   * 定义服务接口
   * @param {string} interfaceName - 接口名称
   * @param {Array} requiredMethods - 必需的方法
   * @param {Object} options - 接口选项
   */
  defineInterface(interfaceName, requiredMethods = [], options = {}) {
    const interfaceDefinition = {
      name: interfaceName,
      requiredMethods: [...requiredMethods],
      options: {
        version: '1.0.0',
        description: '',
        ...options
      },
      definedAt: Date.now()
    };

    // 存储接口定义（可以使用Map或Set来存储）
    if (!this.interfaces) {
      this.interfaces = new Map();
    }
    this.interfaces.set(interfaceName, interfaceDefinition);

    logger.debug(`Interface defined: ${interfaceName}`, {
      methods: requiredMethods.length
    });

    return this;
  }

  /**
   * 实现服务接口
   * @param {string} serviceName - 服务名称
   * @param {string} interfaceName - 接口名称
   */
  implementInterface(serviceName, interfaceName) {
    const serviceDefinition = this.serviceDefinitions.get(serviceName);
    if (!serviceDefinition) {
      throw new Error(`Service not defined: ${serviceName}`);
    }

    if (!serviceDefinition.definition.interfaces.includes(interfaceName)) {
      serviceDefinition.definition.interfaces.push(interfaceName);
    }

    // 验证接口实现
    this._validateInterfaceImplementation(serviceName, interfaceName);

    logger.debug(`Service implements interface: ${serviceName} -> ${interfaceName}`);
    return this;
  }

  /**
   * 按接口获取服务
   * @param {string} interfaceName - 接口名称
   * @returns {Array} 实现该接口的服务列表
   */
  getServicesByInterface(interfaceName) {
    const services = [];

    for (const [name, definition] of this.serviceDefinitions) {
      if (definition.definition.interfaces.includes(interfaceName)) {
        services.push({
          name,
          service: this.get(name),
          definition: definition.definition
        });
      }
    }

    return services;
  }

  /**
   * 按标签获取服务
   * @param {string} tag - 标签
   * @returns {Array} 具有该标签的服务列表
   */
  getServicesByTag(tag) {
    const services = [];

    for (const [name, definition] of this.serviceDefinitions) {
      if (definition.definition.tags.includes(tag)) {
        services.push({
          name,
          service: this.get(name),
          definition: definition.definition
        });
      }
    }

    return services;
  }

  /**
   * 初始化服务
   * @param {string} name - 服务名称
   * @returns {Promise<Object>} 初始化后的服务实例
   */
  async initializeService(name) {
    if (this.initializedServices.has(name)) {
      return this.get(name);
    }

    const definition = this.serviceDefinitions.get(name);
    if (!definition) {
      throw new Error(`Service not defined: ${name}`);
    }

    try {
      logger.info(`Initializing service: ${name}`);

      // 解析并初始化依赖
      await this._initializeDependencies(name, definition);

      // 创建服务实例
      const instance = this.resolve(name);

      // 执行自定义初始化
      if (definition.definition.lifecycle.init) {
        await ErrorHandlerUtils.createErrorHandler(
          `service_init_${name}`,
          { service: name, version: definition.version }
        )(async () => {
          await definition.definition.lifecycle.init(instance, this);
        });
      }

      // 标记为已初始化
      this.initializedServices.add(name);
      this.initializationOrder.push(name);

      // 更新指标
      if (this.serviceMetrics.has(name)) {
        const metrics = this.serviceMetrics.get(name);
        metrics.created++;
        metrics.lastUsed = Date.now();
      }

      logger.info(`Service initialized successfully: ${name}`);
      return instance;

    } catch (error) {
      logger.error(`Service initialization failed: ${name}`, {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * 销毁服务
   * @param {string} name - 服务名称
   * @returns {Promise<void>}
   */
  async destroyService(name) {
    const definition = this.serviceDefinitions.get(name);
    if (!definition || !this.initializedServices.has(name)) {
      return;
    }

    try {
      logger.info(`Destroying service: ${name}`);

      const instance = this.get(name);

      // 执行自定义销毁
      if (definition.definition.lifecycle.destroy) {
        await ErrorHandlerUtils.createErrorHandler(
          `service_destroy_${name}`,
          { service: name }
        )(async () => {
          await definition.definition.lifecycle.destroy(instance, this);
        });
      }

      // 从基础容器中移除
      this.serviceInstances.delete(name);

      // 标记为未初始化
      this.initializedServices.delete(name);
      const orderIndex = this.initializationOrder.indexOf(name);
      if (orderIndex >= 0) {
        this.initializationOrder.splice(orderIndex, 1);
      }

      // 更新指标
      if (this.serviceMetrics.has(name)) {
        const metrics = this.serviceMetrics.get(name);
        metrics.destroyed++;
      }

      logger.info(`Service destroyed successfully: ${name}`);

    } catch (error) {
      logger.error(`Service destruction failed: ${name}`, {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 执行服务健康检查
   * @param {string} name - 服务名称
   * @returns {Promise<Object>} 健康检查结果
   */
  async checkServiceHealth(name) {
    const healthChecker = this.healthCheckers.get(name);
    if (!healthChecker) {
      return { healthy: true, status: 'unknown' };
    }

    try {
      const instance = this.get(name);
      const result = await healthChecker(instance, this);

      return {
        healthy: result.healthy !== false,
        status: result.status || 'ok',
        details: result.details || {},
        timestamp: Date.now()
      };

    } catch (error) {
      logger.error(`Service health check failed: ${name}`, {
        error: error.message
      });

      return {
        healthy: false,
        status: 'error',
        error: error.message,
        timestamp: Date.now()
      };
    }
  }

  /**
   * 获取服务定义
   * @param {string} name - 服务名称
   * @returns {Object|null}
   */
  getServiceDefinition(name) {
    return this.serviceDefinitions.get(name) || null;
  }

  /**
   * 获取所有服务定义
   * @returns {Array<Object>}
   */
  getAllServiceDefinitions() {
    const definitions = [];

    for (const [name, definition] of this.serviceDefinitions) {
      definitions.push({
        name,
        definition: definition.definition,
        registeredAt: definition.registeredAt,
        version: definition.version,
        initialized: this.initializedServices.has(name)
      });
    }

    return definitions;
  }

  /**
   * 获取服务统计信息
   * @returns {Object}
   */
  getServiceStats() {
    const baseStats = super.getStats();

    const serviceStats = {
      total: this.serviceDefinitions.size,
      initialized: this.initializedServices.size,
      byScope: {},
      byTag: {},
      byInterface: {},
      metrics: {}
    };

    for (const [name, definition] of this.serviceDefinitions) {
      const scope = definition.definition.scope;
      serviceStats.byScope[scope] = (serviceStats.byScope[scope] || 0) + 1;

      for (const tag of definition.definition.tags) {
        serviceStats.byTag[tag] = (serviceStats.byTag[tag] || 0) + 1;
      }

      for (const interfaceName of definition.definition.interfaces) {
        serviceStats.byInterface[interfaceName] = (serviceStats.byInterface[interfaceName] || 0) + 1;
      }

      if (this.serviceMetrics.has(name)) {
        serviceStats.metrics[name] = { ...this.serviceMetrics.get(name) };
      }
    }

    return {
      ...baseStats,
      services: serviceStats
    };
  }

  /**
   * 销毁服务容器
   */
  async destroy() {
    logger.info('Destroying service container...');

    // 按初始化顺序的反序销毁服务
    const servicesToDestroy = [...this.initializationOrder].reverse();

    for (const serviceName of servicesToDestroy) {
      try {
        await this.destroyService(serviceName);
      } catch (error) {
        logger.error(`Failed to destroy service during shutdown: ${serviceName}`, {
          error: error.message
        });
      }
    }

    // 清理服务定义
    this.serviceDefinitions.clear();
    this.healthCheckers.clear();
    this.serviceMetrics.clear();
    this.serviceRegistry.clear();
    this.initializationOrder = [];
    this.initializedServices.clear();

    // 调用父类销毁
    await super.destroy();

    logger.info('Service container destroyed');
  }

  /**
   * 验证服务定义
   */
  _validateServiceDefinition(definition) {
    if (!definition.name || typeof definition.name !== 'string') {
      throw new Error('Service name must be a non-empty string');
    }

    if (!definition.serviceClass) {
      throw new Error(`Service class is required for: ${definition.name}`);
    }

    const validScopes = ['singleton', 'transient', 'scoped'];
    if (!validScopes.includes(definition.definition.scope)) {
      throw new Error(`Invalid scope '${definition.definition.scope}' for service: ${definition.name}`);
    }

    // 验证依赖
    for (const dep of definition.definition.dependencies) {
      if (typeof dep !== 'string') {
        throw new Error(`Invalid dependency '${dep}' for service: ${definition.name}`);
      }
    }
  }

  /**
   * 验证接口实现
   */
  _validateInterfaceImplementation(serviceName, interfaceName) {
    const interfaceDef = this.interfaces?.get(interfaceName);
    if (!interfaceDef) {
      logger.warn(`Interface not defined: ${interfaceName}`);
      return;
    }

    const serviceDefinition = this.serviceDefinitions.get(serviceName);
    const serviceClass = serviceDefinition.serviceClass;

    // 检查必需的方法
    for (const method of interfaceDef.requiredMethods) {
      if (typeof serviceClass.prototype[method] !== 'function') {
        throw new Error(`Service ${serviceName} does not implement required method '${method}' of interface ${interfaceName}`);
      }
    }
  }

  /**
   * 初始化依赖
   */
  async _initializeDependencies(name, definition) {
    for (const depName of definition.definition.dependencies) {
      if (!this.initializedServices.has(depName)) {
        await this.initializeService(depName);
      }
    }
  }

  /**
   * 注册服务发现
   */
  _registerServiceDiscovery(name, definition) {
    const serviceInfo = {
      name,
      interfaces: definition.definition.interfaces,
      tags: definition.definition.tags,
      metadata: definition.definition.metadata,
      version: definition.version,
      registeredAt: Date.now()
    };

    this.serviceRegistry.set(name, serviceInfo);

    // 按接口注册
    for (const interfaceName of definition.definition.interfaces) {
      if (!this.serviceRegistry.has(`interface:${interfaceName}`)) {
        this.serviceRegistry.set(`interface:${interfaceName}`, []);
      }
      this.serviceRegistry.get(`interface:${interfaceName}`).push(name);
    }

    // 按标签注册
    for (const tag of definition.definition.tags) {
      if (!this.serviceRegistry.has(`tag:${tag}`)) {
        this.serviceRegistry.set(`tag:${tag}`, []);
      }
      this.serviceRegistry.get(`tag:${tag}`).push(name);
    }
  }
}

/**
 * 创建服务容器的工厂函数
 * @param {Object} options - 选项
 * @returns {ServiceContainer}
 */
export function createServiceContainer(options = {}) {
  return new ServiceContainer(options);
}
