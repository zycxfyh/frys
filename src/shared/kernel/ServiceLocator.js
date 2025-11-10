/**
 * Service Locator - 服务定位器
 * 提供松耦合的服务注册和发现机制
 *
 * 模式优势：
 * - 减少直接依赖
 * - 运行时配置
 * - 便于测试和替换
 */

export class ServiceLocator {
  constructor() {
    this.services = new Map();
    this.factories = new Map();
    this.instances = new Map();
    this.scopes = new Map();
  }

  /**
   * 注册服务实例
   */
  register(name, instance, scope = 'singleton') {
    if (this.services.has(name)) {
      throw new Error(`Service '${name}' is already registered`);
    }

    this.services.set(name, {
      type: 'instance',
      instance,
      scope
    });

    if (scope === 'singleton') {
      this.instances.set(name, instance);
    }

    return this;
  }

  /**
   * 注册服务工厂
   */
  registerFactory(name, factory, scope = 'singleton') {
    if (this.services.has(name)) {
      throw new Error(`Service '${name}' is already registered`);
    }

    this.services.set(name, {
      type: 'factory',
      factory,
      scope
    });

    this.factories.set(name, factory);

    return this;
  }

  /**
   * 注册构造函数
   */
  registerConstructor(name, constructor, scope = 'singleton', ...args) {
    if (this.services.has(name)) {
      throw new Error(`Service '${name}' is already registered`);
    }

    this.services.set(name, {
      type: 'constructor',
      constructor,
      args,
      scope
    });

    return this;
  }

  /**
   * 获取服务实例
   */
  get(name) {
    const registration = this.services.get(name);
    if (!registration) {
      throw new Error(`Service '${name}' is not registered`);
    }

    const { type, scope } = registration;

    // 单例模式
    if (scope === 'singleton') {
      if (this.instances.has(name)) {
        return this.instances.get(name);
      }
    }

    let instance;

    switch (type) {
      case 'instance':
        instance = registration.instance;
        break;

      case 'factory':
        instance = registration.factory();
        break;

      case 'constructor':
        instance = new registration.constructor(...registration.args);
        break;

      default:
        throw new Error(`Unknown service type: ${type}`);
    }

    // 缓存单例实例
    if (scope === 'singleton') {
      this.instances.set(name, instance);
    }

    return instance;
  }

  /**
   * 检查服务是否已注册
   */
  has(name) {
    return this.services.has(name);
  }

  /**
   * 注销服务
   */
  unregister(name) {
    if (!this.services.has(name)) {
      return false;
    }

    this.services.delete(name);
    this.factories.delete(name);
    this.instances.delete(name);
    this.scopes.delete(name);

    return true;
  }

  /**
   * 获取所有注册的服务名称
   */
  getRegisteredServices() {
    return Array.from(this.services.keys());
  }

  /**
   * 创建作用域
   */
  createScope(scopeId) {
    const scope = new ServiceScope(this, scopeId);
    this.scopes.set(scopeId, scope);
    return scope;
  }

  /**
   * 获取作用域
   */
  getScope(scopeId) {
    return this.scopes.get(scopeId);
  }

  /**
   * 销毁作用域
   */
  destroyScope(scopeId) {
    const scope = this.scopes.get(scopeId);
    if (scope) {
      scope.dispose();
      this.scopes.delete(scopeId);
    }
  }

  /**
   * 清空所有服务
   */
  clear() {
    this.services.clear();
    this.factories.clear();
    this.instances.clear();
    this.scopes.clear();
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      totalServices: this.services.size,
      instances: this.instances.size,
      factories: this.factories.size,
      scopes: this.scopes.size,
      services: Array.from(this.services.entries()).map(([name, reg]) => ({
        name,
        type: reg.type,
        scope: reg.scope
      }))
    };
  }
}

/**
 * 服务作用域
 */
export class ServiceScope {
  constructor(locator, scopeId) {
    this.locator = locator;
    this.scopeId = scopeId;
    this.scopedInstances = new Map();
  }

  /**
   * 获取作用域内的服务实例
   */
  get(name) {
    if (this.scopedInstances.has(name)) {
      return this.scopedInstances.get(name);
    }

    const instance = this.locator.get(name);
    this.scopedInstances.set(name, instance);
    return instance;
  }

  /**
   * 注册作用域特定的服务
   */
  register(name, instance) {
    this.scopedInstances.set(name, instance);
    return this;
  }

  /**
   * 销毁作用域
   */
  dispose() {
    this.scopedInstances.clear();
  }
}

// 全局服务定位器实例
export const globalServiceLocator = new ServiceLocator();

// 便捷函数
export const registerService = (name, service, scope = 'singleton') =>
  globalServiceLocator.register(name, service, scope);

export const getService = (name) => globalServiceLocator.get(name);

export const hasService = (name) => globalServiceLocator.has(name);

export default ServiceLocator;
