/**
 * Dependency Injector - 依赖注入容器
 * 提供类型安全的依赖注入机制
 *
 * 特性：
 * - 构造函数注入
 * - 属性注入
 * - 方法注入
 * - 作用域管理
 * - 循环依赖检测
 */

export class DependencyInjector {
  constructor() {
    this.bindings = new Map();
    this.instances = new Map();
    this.scopes = new Map();
    this.resolving = new Set();
  }

  /**
   * 绑定接口到实现
   */
  bind(interfaceType, implementationType, lifecycle = 'singleton') {
    if (this.bindings.has(interfaceType)) {
      throw new Error(`Interface '${interfaceType}' is already bound`);
    }

    this.bindings.set(interfaceType, {
      implementationType,
      lifecycle,
      dependencies: this._analyzeDependencies(implementationType)
    });

    return this;
  }

  /**
   * 绑定到实例
   */
  bindInstance(interfaceType, instance) {
    if (this.bindings.has(interfaceType)) {
      throw new Error(`Interface '${interfaceType}' is already bound`);
    }

    this.bindings.set(interfaceType, {
      instance,
      lifecycle: 'singleton'
    });

    this.instances.set(interfaceType, instance);

    return this;
  }

  /**
   * 绑定到工厂函数
   */
  bindFactory(interfaceType, factory, lifecycle = 'transient') {
    if (this.bindings.has(interfaceType)) {
      throw new Error(`Interface '${interfaceType}' is already bound`);
    }

    this.bindings.set(interfaceType, {
      factory,
      lifecycle
    });

    return this;
  }

  /**
   * 解析依赖
   */
  resolve(interfaceType) {
    // 检测循环依赖
    if (this.resolving.has(interfaceType)) {
      throw new Error(`Circular dependency detected: ${interfaceType}`);
    }

    const binding = this.bindings.get(interfaceType);
    if (!binding) {
      throw new Error(`No binding found for interface: ${interfaceType}`);
    }

    // 单例模式
    if (binding.lifecycle === 'singleton' && this.instances.has(interfaceType)) {
      return this.instances.get(interfaceType);
    }

    this.resolving.add(interfaceType);

    try {
      let instance;

      if (binding.instance) {
        instance = binding.instance;
      } else if (binding.factory) {
        instance = binding.factory();
      } else if (binding.implementationType) {
        instance = this._createInstance(binding.implementationType, binding.dependencies);
      } else {
        throw new Error(`Invalid binding for interface: ${interfaceType}`);
      }

      // 缓存单例实例
      if (binding.lifecycle === 'singleton') {
        this.instances.set(interfaceType, instance);
      }

      return instance;

    } finally {
      this.resolving.delete(interfaceType);
    }
  }

  /**
   * 创建实例并注入依赖
   */
  _createInstance(constructor, dependencies) {
    const args = dependencies.map(dep => this.resolve(dep));
    const instance = new constructor(...args);

    // 属性注入
    this._injectProperties(instance);

    return instance;
  }

  /**
   * 分析构造函数依赖
   */
  _analyzeDependencies(constructor) {
    const paramRegex = /\(\s*([^)]*)\)/;
    const match = constructor.toString().match(paramRegex);

    if (!match) return [];

    const params = match[1]
      .split(',')
      .map(param => param.trim())
      .filter(param => param.length > 0);

    return params;
  }

  /**
   * 属性注入
   */
  _injectProperties(instance) {
    const injectRegex = /@inject\(([^)]+)\)/g;
    const proto = Object.getPrototypeOf(instance);

    // 检查原型链上的属性
    let currentProto = proto;
    while (currentProto && currentProto !== Object.prototype) {
      const propertyNames = Object.getOwnPropertyNames(currentProto);

      for (const propName of propertyNames) {
        const descriptor = Object.getOwnPropertyDescriptor(currentProto, propName);
        if (descriptor && typeof descriptor.value === 'function') {
          const match = descriptor.value.toString().match(injectRegex);
          if (match) {
            const interfaceType = match[1].trim();
            instance[propName] = this.resolve(interfaceType);
          }
        }
      }

      currentProto = Object.getPrototypeOf(currentProto);
    }
  }

  /**
   * 创建作用域
   */
  createScope(scopeId) {
    const scope = new InjectionScope(this, scopeId);
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
   * 移除绑定
   */
  unbind(interfaceType) {
    this.bindings.delete(interfaceType);
    this.instances.delete(interfaceType);
    return this;
  }

  /**
   * 清空所有绑定
   */
  clear() {
    this.bindings.clear();
    this.instances.clear();
    this.scopes.clear();
    this.resolving.clear();
  }

  /**
   * 获取容器状态
   */
  getStats() {
    return {
      bindings: this.bindings.size,
      instances: this.instances.size,
      scopes: this.scopes.size,
      resolving: this.resolving.size,
      bindings: Array.from(this.bindings.entries()).map(([interfaceType, binding]) => ({
        interface: interfaceType,
        lifecycle: binding.lifecycle,
        hasInstance: !!binding.instance,
        hasFactory: !!binding.factory,
        implementation: binding.implementationType?.name || 'N/A'
      }))
    };
  }
}

/**
 * 注入作用域
 */
export class InjectionScope {
  constructor(container, scopeId) {
    this.container = container;
    this.scopeId = scopeId;
    this.scopedInstances = new Map();
    this.scopedBindings = new Map();
  }

  /**
   * 在作用域内绑定
   */
  bind(interfaceType, implementationType, lifecycle = 'scoped') {
    this.scopedBindings.set(interfaceType, {
      implementationType,
      lifecycle,
      dependencies: this.container._analyzeDependencies(implementationType)
    });

    return this;
  }

  /**
   * 解析作用域内的依赖
   */
  resolve(interfaceType) {
    // 先检查作用域绑定
    if (this.scopedBindings.has(interfaceType)) {
      const binding = this.scopedBindings.get(interfaceType);

      if (this.scopedInstances.has(interfaceType)) {
        return this.scopedInstances.get(interfaceType);
      }

      const instance = this.container._createInstance(
        binding.implementationType,
        binding.dependencies
      );

      if (binding.lifecycle === 'scoped') {
        this.scopedInstances.set(interfaceType, instance);
      }

      return instance;
    }

    // 回退到容器解析
    return this.container.resolve(interfaceType);
  }

  /**
   * 销毁作用域
   */
  dispose() {
    // 清理作用域实例
    for (const instance of this.scopedInstances.values()) {
      if (typeof instance.dispose === 'function') {
        instance.dispose();
      }
    }

    this.scopedInstances.clear();
    this.scopedBindings.clear();
  }
}

// 装饰器
export function inject(interfaceType) {
  return function(target, propertyKey, descriptor) {
    // 标记需要注入的属性
    if (!target.__injectedProperties) {
      target.__injectedProperties = new Map();
    }
    target.__injectedProperties.set(propertyKey, interfaceType);
  };
}

// 全局依赖注入容器
export const globalContainer = new DependencyInjector();

// 便捷函数
export const bind = (interfaceType, implementationType, lifecycle = 'singleton') =>
  globalContainer.bind(interfaceType, implementationType, lifecycle);

export const resolve = (interfaceType) => globalContainer.resolve(interfaceType);

export default DependencyInjector;
