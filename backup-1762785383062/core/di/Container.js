/**
 * 依赖注入容器
 * 提供服务注册、解析和生命周期管理
 */

import { logger } from '../../shared/utils/logger.js';
import { ResourceCleanupUtils } from '../../shared/utils/ResourceCleanupUtils.js';
import { ErrorHandlerUtils } from '../../shared/utils/ErrorHandlerUtils.js';

export class Container {
  constructor(options = {}) {
    this.options = {
      autoResolve: true,
      strictMode: false,
      enableCaching: true,
      enablePlugins: true,
      ...options
    };

    // 服务注册表
    this.services = new Map();
    this.serviceInstances = new Map();

    // 生命周期管理
    this.lifecycleHooks = new Map();
    this.scopes = new Map();

    // 插件系统
    this.plugins = new Map();

    // 依赖图
    this.dependencyGraph = new Map();

    // 清理管理器
    this.cleanupManager = ResourceCleanupUtils.createCleanupManager('container');

    // 当前作用域
    this.currentScope = 'singleton';

    logger.info('Dependency injection container initialized', {
      autoResolve: this.options.autoResolve,
      strictMode: this.options.strictMode
    });
  }

  /**
   * 注册服务
   * @param {string} name - 服务名称
   * @param {Function|Object} service - 服务类或实例
   * @param {Object} options - 注册选项
   */
  register(name, service, options = {}) {
    const registration = {
      name,
      service,
      options: {
        scope: 'singleton', // singleton, transient, scoped
        dependencies: [],
        factory: null,
        instance: null,
        tags: [],
        metadata: {},
        ...options
      },
      registeredAt: Date.now()
    };

    // 验证注册
    this._validateRegistration(registration);

    this.services.set(name, registration);

    // 构建依赖图
    this._buildDependencyGraph(name, registration);

    logger.debug(`Service registered: ${name}`, {
      scope: registration.options.scope,
      dependencies: registration.options.dependencies.length
    });

    return this;
  }

  /**
   * 注册工厂函数
   * @param {string} name - 服务名称
   * @param {Function} factory - 工厂函数
   * @param {Object} options - 选项
   */
  registerFactory(name, factory, options = {}) {
    return this.register(name, null, {
      ...options,
      factory,
      scope: options.scope || 'transient'
    });
  }

  /**
   * 注册实例
   * @param {string} name - 服务名称
   * @param {Object} instance - 服务实例
   * @param {Object} options - 选项
   */
  registerInstance(name, instance, options = {}) {
    return this.register(name, instance, {
      ...options,
      instance,
      scope: 'singleton'
    });
  }

  /**
   * 注册插件
   * @param {string} name - 插件名称
   * @param {Object} plugin - 插件实例
   */
  registerPlugin(name, plugin) {
    if (!this.options.enablePlugins) {
      logger.warn('Plugin system is disabled');
      return this;
    }

    this.plugins.set(name, {
      name,
      plugin,
      activated: false,
      activatedAt: null
    });

    logger.debug(`Plugin registered: ${name}`);
    return this;
  }

  /**
   * 解析服务
   * @param {string} name - 服务名称
   * @param {Object} context - 解析上下文
   * @returns {*} 服务实例
   */
  resolve(name, context = {}) {
    // 检查缓存
    if (this.options.enableCaching) {
      const cached = this._getCachedInstance(name, context.scope);
      if (cached) {
        return cached;
      }
    }

    const registration = this.services.get(name);
    if (!registration) {
      if (this.options.strictMode) {
        throw new Error(`Service not registered: ${name}`);
      }

      if (this.options.autoResolve) {
        logger.debug(`Auto-resolving service: ${name}`);
        return this._autoResolve(name, context);
      }

      throw new Error(`Service not registered: ${name}`);
    }

    try {
      // 检查循环依赖
      this._checkCircularDependency(name, context.resolutionPath || []);

      // 创建实例
      const instance = this._createInstance(registration, {
        ...context,
        resolutionPath: [...(context.resolutionPath || []), name]
      });

      // 应用生命周期钩子
      this._applyLifecycleHooks('postCreate', instance, name);

      // 缓存实例
      if (this.options.enableCaching && registration.options.scope === 'singleton') {
        this._cacheInstance(name, instance, context.scope);
      }

      return instance;

    } catch (error) {
      logger.error(`Failed to resolve service: ${name}`, {
        error: error.message,
        resolutionPath: context.resolutionPath
      });
      throw error;
    }
  }

  /**
   * 批量解析服务
   * @param {Array<string>} names - 服务名称数组
   * @param {Object} context - 解析上下文
   * @returns {Object} 服务实例映射
   */
  resolveMany(names, context = {}) {
    const result = {};

    for (const name of names) {
      try {
        result[name] = this.resolve(name, context);
      } catch (error) {
        if (this.options.strictMode) {
          throw error;
        }
        logger.warn(`Failed to resolve service ${name}, skipping`, {
          error: error.message
        });
      }
    }

    return result;
  }

  /**
   * 创建作用域
   * @param {string} scopeName - 作用域名称
   * @returns {Object} 作用域上下文
   */
  createScope(scopeName = `scope_${Date.now()}`) {
    const scope = {
      name: scopeName,
      instances: new Map(),
      createdAt: Date.now()
    };

    this.scopes.set(scopeName, scope);

    return {
      name: scopeName,
      resolve: (name) => this.resolve(name, { scope: scopeName }),
      dispose: () => this.disposeScope(scopeName)
    };
  }

  /**
   * 销毁作用域
   * @param {string} scopeName - 作用域名称
   */
  disposeScope(scopeName) {
    const scope = this.scopes.get(scopeName);
    if (!scope) return;

    // 清理作用域内的实例
    for (const [serviceName, instance] of scope.instances) {
      this._disposeInstance(instance, serviceName);
    }

    this.scopes.delete(scopeName);
    logger.debug(`Scope disposed: ${scopeName}`);
  }

  /**
   * 检查服务是否已注册
   * @param {string} name - 服务名称
   * @returns {boolean}
   */
  isRegistered(name) {
    return this.services.has(name);
  }

  /**
   * 获取服务信息
   * @param {string} name - 服务名称
   * @returns {Object|null}
   */
  getServiceInfo(name) {
    const registration = this.services.get(name);
    if (!registration) return null;

    const instances = [];
    for (const [scopeName, scope] of this.scopes) {
      if (scope.instances.has(name)) {
        instances.push(scopeName);
      }
    }

    return {
      name: registration.name,
      scope: registration.options.scope,
      dependencies: registration.options.dependencies,
      tags: registration.options.tags,
      registeredAt: registration.registeredAt,
      hasFactory: !!registration.options.factory,
      hasInstance: !!registration.options.instance,
      activeScopes: instances,
      metadata: registration.options.metadata
    };
  }

  /**
   * 获取所有服务信息
   * @returns {Array<Object>}
   */
  getAllServices() {
    const services = [];

    for (const [name] of this.services) {
      const info = this.getServiceInfo(name);
      if (info) services.push(info);
    }

    return services;
  }

  /**
   * 添加生命周期钩子
   * @param {string} hook - 钩子名称
   * @param {Function} handler - 钩子处理器
   * @param {Object} options - 选项
   */
  addLifecycleHook(hook, handler, options = {}) {
    if (!this.lifecycleHooks.has(hook)) {
      this.lifecycleHooks.set(hook, []);
    }

    this.lifecycleHooks.get(hook).push({
      handler,
      priority: options.priority || 0,
      name: options.name || `hook_${Date.now()}`
    });

    // 按优先级排序
    this.lifecycleHooks.get(hook).sort((a, b) => b.priority - a.priority);
  }

  /**
   * 移除生命周期钩子
   * @param {string} hook - 钩子名称
   * @param {string} hookName - 钩子处理器名称
   */
  removeLifecycleHook(hook, hookName) {
    const hooks = this.lifecycleHooks.get(hook);
    if (hooks) {
      const index = hooks.findIndex(h => h.name === hookName);
      if (index >= 0) {
        hooks.splice(index, 1);
      }
    }
  }

  /**
   * 获取容器统计信息
   * @returns {Object}
   */
  getStats() {
    const servicesByScope = {};
    const servicesByTag = {};

    for (const [name, registration] of this.services) {
      const scope = registration.options.scope;
      servicesByScope[scope] = (servicesByScope[scope] || 0) + 1;

      for (const tag of registration.options.tags) {
        servicesByTag[tag] = (servicesByTag[tag] || 0) + 1;
      }
    }

    let totalInstances = 0;
    for (const scope of this.scopes.values()) {
      totalInstances += scope.instances.size;
    }

    return {
      services: {
        total: this.services.size,
        byScope: servicesByScope,
        byTag: servicesByTag
      },
      instances: {
        total: totalInstances,
        cached: this.serviceInstances.size,
        scoped: totalInstances - this.serviceInstances.size
      },
      scopes: {
        active: this.scopes.size
      },
      plugins: {
        registered: this.plugins.size,
        activated: Array.from(this.plugins.values()).filter(p => p.activated).length
      },
      options: this.options
    };
  }

  /**
   * 销毁容器
   */
  async destroy() {
    logger.info('Destroying dependency injection container...');

    // 停用所有插件
    for (const [name, pluginInfo] of this.plugins) {
      if (pluginInfo.activated) {
        try {
          await pluginInfo.plugin.deactivate();
          logger.debug(`Plugin deactivated: ${name}`);
        } catch (error) {
          logger.error(`Failed to deactivate plugin: ${name}`, {
            error: error.message
          });
        }
      }
    }

    // 销毁所有作用域
    for (const scopeName of this.scopes.keys()) {
      this.disposeScope(scopeName);
    }

    // 清理所有服务实例
    for (const [serviceName, instance] of this.serviceInstances) {
      this._disposeInstance(instance, serviceName);
    }

    // 清理资源
    await this.cleanupManager.cleanup();

    // 清空所有集合
    this.services.clear();
    this.serviceInstances.clear();
    this.scopes.clear();
    this.plugins.clear();
    this.lifecycleHooks.clear();
    this.dependencyGraph.clear();

    logger.info('Dependency injection container destroyed');
  }

  /**
   * 验证注册
   */
  _validateRegistration(registration) {
    if (!registration.name || typeof registration.name !== 'string') {
      throw new Error('Service name must be a non-empty string');
    }

    if (this.services.has(registration.name)) {
      logger.warn(`Service ${registration.name} is being overwritten`);
    }

    const validScopes = ['singleton', 'transient', 'scoped'];
    if (!validScopes.includes(registration.options.scope)) {
      throw new Error(`Invalid scope: ${registration.options.scope}. Must be one of: ${validScopes.join(', ')}`);
    }
  }

  /**
   * 构建依赖图
   */
  _buildDependencyGraph(name, registration) {
    const dependencies = registration.options.dependencies || [];
    this.dependencyGraph.set(name, dependencies);

    // 检查依赖关系
    for (const dep of dependencies) {
      if (!this.services.has(dep) && !this.options.autoResolve) {
        logger.warn(`Service ${name} depends on unregistered service: ${dep}`);
      }
    }
  }

  /**
   * 检查循环依赖
   */
  _checkCircularDependency(name, resolutionPath) {
    if (resolutionPath.includes(name)) {
      const cycle = [...resolutionPath, name];
      const cycleStart = cycle.indexOf(name);
      throw new Error(`Circular dependency detected: ${cycle.slice(cycleStart).join(' -> ')}`);
    }
  }

  /**
   * 创建实例
   */
  _createInstance(registration, context) {
    const { service, options } = registration;

    // 如果有预注册实例，直接返回
    if (options.instance) {
      return options.instance;
    }

    // 如果有工厂函数，使用工厂
    if (options.factory) {
      return options.factory(this, context);
    }

    // 如果是类，实例化
    if (typeof service === 'function') {
      // 解析依赖
      const dependencies = this._resolveDependencies(options.dependencies, context);

      // 创建实例
      return new service(...dependencies);
    }

    // 如果是对象，直接返回
    if (typeof service === 'object' && service !== null) {
      return service;
    }

    throw new Error(`Cannot create instance for service: ${registration.name}`);
  }

  /**
   * 解析依赖
   */
  _resolveDependencies(dependencies, context) {
    return dependencies.map(dep => this.resolve(dep, context));
  }

  /**
   * 自动解析服务
   */
  _autoResolve(name, context) {
    // 尝试根据命名约定自动解析
    // 这里可以实现更复杂的自动解析逻辑

    logger.debug(`Auto-resolving service: ${name}`);

    // 创建一个基本的空对象作为占位符
    return {};
  }

  /**
   * 获取缓存实例
   */
  _getCachedInstance(name, scope) {
    if (scope && scope !== 'singleton') {
      const scopeObj = this.scopes.get(scope);
      if (scopeObj && scopeObj.instances.has(name)) {
        return scopeObj.instances.get(name);
      }
    } else if (this.serviceInstances.has(name)) {
      return this.serviceInstances.get(name);
    }

    return null;
  }

  /**
   * 缓存实例
   */
  _cacheInstance(name, instance, scope) {
    if (scope && scope !== 'singleton') {
      const scopeObj = this.scopes.get(scope);
      if (scopeObj) {
        scopeObj.instances.set(name, instance);
      }
    } else {
      this.serviceInstances.set(name, instance);
    }
  }

  /**
   * 应用生命周期钩子
   */
  async _applyLifecycleHooks(hook, instance, serviceName) {
    const hooks = this.lifecycleHooks.get(hook);
    if (!hooks) return;

    for (const hookInfo of hooks) {
      try {
        await hookInfo.handler(instance, serviceName, this);
      } catch (error) {
        logger.error(`Lifecycle hook failed: ${hook} for ${serviceName}`, {
          hook: hookInfo.name,
          error: error.message
        });
      }
    }
  }

  /**
   * 销毁实例
   */
  async _disposeInstance(instance, serviceName) {
    if (instance && typeof instance.destroy === 'function') {
      try {
        await instance.destroy();
        logger.debug(`Instance disposed: ${serviceName}`);
      } catch (error) {
        logger.error(`Failed to dispose instance: ${serviceName}`, {
          error: error.message
        });
      }
    }
  }
}
