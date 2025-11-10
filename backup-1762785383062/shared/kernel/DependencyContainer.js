/**
 * 依赖注入容器
 * 管理组件的注册、解析和生命周期
 */

export class DependencyContainer {
  constructor() {
    this._services = new Map();
    this._singletons = new Map();
    this._factories = new Map();
    this._scopes = new Map();
  }

  /**
   * 注册服务
   */
  register(name, implementation, options = {}) {
    if (this._services.has(name)) {
      throw new Error(`Service ${name} is already registered`);
    }

    this._services.set(name, {
      implementation,
      options: {
        singleton: options.singleton || false,
        factory: options.factory || false,
        scope: options.scope || 'global',
        ...options,
      },
    });

    return this;
  }

  /**
   * 注册单例
   */
  singleton(name, implementation, options = {}) {
    return this.register(name, implementation, { ...options, singleton: true });
  }

  /**
   * 注册工厂函数
   */
  factory(name, factoryFn, options = {}) {
    return this.register(name, factoryFn, { ...options, factory: true });
  }

  /**
   * 注册作用域
   */
  scoped(name, implementation, scopeName = 'request') {
    return this.register(name, implementation, { scope: scopeName });
  }

  /**
   * 解析服务
   */
  resolve(name, scopeContext = null) {
    const service = this._services.get(name);
    if (!service) {
      throw new Error(`Service ${name} is not registered`);
    }

    const { implementation, options } = service;

    // 处理作用域服务
    if (options.scope !== 'global' && scopeContext) {
      const scopeKey = `${options.scope}:${name}`;
      if (!this._scopes.has(scopeKey)) {
        this._scopes.set(
          scopeKey,
          this._createInstance(implementation, options),
        );
      }
      return this._scopes.get(scopeKey);
    }

    // 处理单例
    if (options.singleton) {
      if (!this._singletons.has(name)) {
        this._singletons.set(
          name,
          this._createInstance(implementation, options),
        );
      }
      return this._singletons.get(name);
    }

    // 处理工厂
    if (options.factory) {
      return implementation(this);
    }

    // 创建新实例
    return this._createInstance(implementation, options);
  }

  /**
   * 创建实例
   */
  _createInstance(implementation, options) {
    // 如果是类，创建实例
    if (typeof implementation === 'function' && implementation.constructor) {
      return new implementation();
    }

    // 如果是对象，直接返回
    if (typeof implementation === 'object') {
      return implementation;
    }

    // 如果是工厂函数，调用它
    if (typeof implementation === 'function') {
      return implementation(this);
    }

    throw new Error('Invalid service implementation');
  }

  /**
   * 检查服务是否已注册
   */
  has(name) {
    return this._services.has(name);
  }

  /**
   * 获取所有已注册的服务名称
   */
  getRegisteredServices() {
    return Array.from(this._services.keys());
  }

  /**
   * 获取服务信息
   */
  getServiceInfo(name) {
    const service = this._services.get(name);
    if (!service) {
      return null;
    }

    return {
      name,
      type: typeof service.implementation,
      options: service.options,
      hasInstance: this._singletons.has(name),
    };
  }

  /**
   * 创建作用域上下文
   */
  createScope(scopeName) {
    return {
      scope: scopeName,
      container: this,
      resolve: (name) => this.resolve(name, scopeName),
    };
  }

  /**
   * 清空作用域
   */
  clearScope(scopeName) {
    const scopeKeys = Array.from(this._scopes.keys()).filter((key) =>
      key.startsWith(`${scopeName}:`),
    );

    scopeKeys.forEach((key) => this._scopes.delete(key));
  }

  /**
   * 清空容器
   */
  clear() {
    this._services.clear();
    this._singletons.clear();
    this._factories.clear();
    this._scopes.clear();
  }

  /**
   * 获取容器状态
   */
  getStatus() {
    return {
      services: this._services.size,
      singletons: this._singletons.size,
      factories: this._factories.size,
      scopes: this._scopes.size,
      registeredServices: this.getRegisteredServices(),
    };
  }

  /**
   * 健康检查
   */
  async healthCheck() {
    const issues = [];

    // 检查所有单例服务
    for (const [name, instance] of this._singletons) {
      try {
        if (typeof instance.healthCheck === 'function') {
          const health = await instance.healthCheck();
          if (health.status !== 'healthy') {
            issues.push(`Service ${name}: ${health.status}`);
          }
        }
      } catch (error) {
        issues.push(`Service ${name} health check failed: ${error.message}`);
      }
    }

    return {
      status: issues.length === 0 ? 'healthy' : 'unhealthy',
      issues,
      services: this._services.size,
      singletons: this._singletons.size,
    };
  }
}
