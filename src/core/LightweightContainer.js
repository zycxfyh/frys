/**
 * frys 轻量级核心 - 依赖注入容器
 * 提供轻量级的服务定位和依赖管理
 */

import { logger } from '../shared/utils/logger.js';

/**
 * 轻量级依赖注入容器
 * 支持构造函数注入和工厂函数注入
 */
export class LightweightContainer {
  constructor() {
    this._services = new Map();
    this._singletons = new Map();
    this._factories = new Map();
    this._resolvers = new Map();
  }

  /**
   * 注册服务
   */
  register(name, service, options = {}) {
    const registration = {
      service,
      options: {
        singleton: true,
        ...options,
      },
    };

    this._services.set(name, registration);

    if (options.factory) {
      this._factories.set(name, options.factory);
    }

    logger.debug(`📦 注册服务: ${name}`, {
      singleton: registration.options.singleton,
      factory: !!options.factory,
    });

    return this;
  }

  /**
   * 注册工厂函数
   */
  factory(name, factoryFn) {
    return this.register(name, null, { factory: factoryFn, singleton: false });
  }

  /**
   * 注册单例
   */
  singleton(name, service) {
    return this.register(name, service, { singleton: true });
  }

  /**
   * 注册瞬时服务
   */
  transient(name, constructor) {
    return this.register(name, constructor, { singleton: false });
  }

  /**
   * 解析服务
   */
  resolve(name, ...args) {
    try {
      // 检查单例缓存
      if (this._singletons.has(name)) {
        return this._singletons.get(name);
      }

      const registration = this._services.get(name);
      if (!registration) {
        throw new Error(`服务未注册: ${name}`);
      }

      let instance;

      // 如果是工厂函数
      if (registration.options.factory) {
        instance = registration.options.factory(...args);
      }
      // 如果是构造函数
      else if (typeof registration.service === 'function') {
        instance = new registration.service(...args);
      }
      // 如果是直接对象
      else {
        instance = registration.service;
      }

      // 如果是单例，缓存起来
      if (registration.options.singleton) {
        this._singletons.set(name, instance);
      }

      // 自动注入依赖
      this._injectDependencies(instance);

      return instance;
    } catch (error) {
      logger.error(`服务解析失败: ${name}`, error);
      throw error;
    }
  }

  /**
   * 批量解析
   */
  resolveAll(names) {
    const services = {};
    for (const name of names) {
      services[name] = this.resolve(name);
    }
    return services;
  }

  /**
   * 检查服务是否存在
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
    const registration = this._services.get(name);
    if (!registration) return null;

    return {
      name,
      singleton: registration.options.singleton,
      factory: !!registration.options.factory,
      cached: this._singletons.has(name),
    };
  }

  /**
   * 自动注入依赖
   */
  _injectDependencies(instance) {
    if (!instance || typeof instance !== 'object') return;

    // 检查是否有注入标记
    if (instance._injections) {
      for (const [property, dependencyName] of instance._injections) {
        try {
          instance[property] = this.resolve(dependencyName);
        } catch (error) {
          logger.warn(
            `依赖注入失败: ${property} -> ${dependencyName}`,
            error.message,
          );
        }
      }
    }

    // 检查构造函数参数中的依赖
    if (instance.constructor && instance.constructor._dependencies) {
      const deps = instance.constructor._dependencies;
      for (let i = 0; i < deps.length; i++) {
        const depName = deps[i];
        if (!instance[depName] && this.has(depName)) {
          try {
            instance[depName] = this.resolve(depName);
          } catch (error) {
            logger.warn(`构造函数依赖注入失败: ${depName}`, error.message);
          }
        }
      }
    }
  }

  /**
   * 创建子容器
   */
  createChild() {
    const child = new LightweightContainer();

    // 复制所有注册
    for (const [name, registration] of this._services) {
      child._services.set(name, { ...registration });
    }

    // 复制工厂函数
    for (const [name, factory] of this._factories) {
      child._factories.set(name, factory);
    }

    return child;
  }

  /**
   * 清理容器
   */
  clear() {
    this._services.clear();
    this._singletons.clear();
    this._factories.clear();
    this._resolvers.clear();

    logger.info('🧹 容器已清理');
  }

  /**
   * 获取容器状态
   */
  getStatus() {
    return {
      services: this._services.size,
      singletons: this._singletons.size,
      factories: this._factories.size,
      registeredServices: this.getRegisteredServices(),
    };
  }
}

/**
 * 依赖装饰器
 */
export function Dependency(...dependencies) {
  return function (constructor) {
    constructor._dependencies = dependencies;
    return constructor;
  };
}

/**
 * 服务装饰器
 */
export function Service(name, options = {}) {
  return function (constructor) {
    // 在容器中注册
    if (global.frysContainer) {
      global.frysContainer.register(name, constructor, options);
    }

    // 添加服务元数据
    constructor._serviceName = name;
    constructor._serviceOptions = options;

    return constructor;
  };
}

/**
 * 自动装配函数
 */
export function autoWire(container, target) {
  if (!target || typeof target !== 'object') return target;

  // 如果是类，创建实例
  if (typeof target === 'function') {
    target = container.resolve(target.name.toLowerCase()) || new target();
  }

  // 注入依赖
  container._injectDependencies(target);

  return target;
}

/**
 * 创建全局容器实例
 */
export const globalContainer = new LightweightContainer();

// 注册到全局
if (typeof global !== 'undefined') {
  global.frysContainer = globalContainer;
}

if (typeof window !== 'undefined') {
  window.frysContainer = globalContainer;
}
