/**
 * WokeFlow 轻量级核心 - 插件管理系统
 * 提供动态插件加载、生命周期管理和扩展机制
 */

import { logger } from '../utils/logger.js';
import { WokeFlowError, ErrorType } from './error-handler.js';

/**
 * 插件接口
 */
export class PluginInterface {
  constructor() {
    this.name = '';
    this.version = '1.0.0';
    this.description = '';
    this.dependencies = [];
  }

  /**
   * 插件安装
   */
  async install(context) {
    // 子类实现
  }

  /**
   * 插件启动
   */
  async start(context) {
    // 子类实现
  }

  /**
   * 插件停止
   */
  async stop(context) {
    // 子类实现
  }

  /**
   * 插件卸载
   */
  async uninstall(context) {
    // 子类实现
  }

  /**
   * 插件配置
   */
  getConfig() {
    return {};
  }

  /**
   * 插件元数据
   */
  getMetadata() {
    return {
      name: this.name,
      version: this.version,
      description: this.description,
      dependencies: this.dependencies,
    };
  }
}

/**
 * 插件管理器
 */
export class PluginManager {
  constructor() {
    this._plugins = new Map();
    this._hooks = new Map();
    this._middlewares = new Map();
    this._extensions = new Map();
    this._context = {};
  }

  /**
   * 注册插件
   */
  async register(plugin, options = {}) {
    try {
      if (!(plugin instanceof PluginInterface)) {
        throw WokeFlowError.system('插件必须继承 PluginInterface', 'plugin');
      }

      const name = plugin.name;
      if (this._plugins.has(name)) {
        throw WokeFlowError.system(`插件已存在: ${name}`, 'plugin');
      }

      // 检查依赖
      await this._checkDependencies(plugin);

      // 创建插件上下文
      const context = this._createPluginContext(plugin, options);

      // 安装插件
      await plugin.install(context);

      // 注册到管理器
      this._plugins.set(name, {
        instance: plugin,
        options,
        context,
        status: 'installed',
      });

      logger.info(`🔌 插件已注册: ${name} v${plugin.version}`);

      // 触发钩子
      await this._triggerHook('plugin:registered', { plugin, options });

      return plugin;
    } catch (error) {
      logger.error(`插件注册失败: ${plugin.name}`, error);
      throw error;
    }
  }

  /**
   * 启动插件
   */
  async start(name) {
    const plugin = this._plugins.get(name);
    if (!plugin) {
      throw WokeFlowError.system(`插件不存在: ${name}`, 'plugin');
    }

    if (plugin.status === 'started') {
      return;
    }

    try {
      await plugin.instance.start(plugin.context);
      plugin.status = 'started';

      logger.info(`🚀 插件已启动: ${name}`);

      // 触发钩子
      await this._triggerHook('plugin:started', { plugin: plugin.instance });
    } catch (error) {
      logger.error(`插件启动失败: ${name}`, error);
      plugin.status = 'error';
      throw error;
    }
  }

  /**
   * 停止插件
   */
  async stop(name) {
    const plugin = this._plugins.get(name);
    if (!plugin) {
      return;
    }

    if (plugin.status !== 'started') {
      return;
    }

    try {
      await plugin.instance.stop(plugin.context);
      plugin.status = 'stopped';

      logger.info(`🛑 插件已停止: ${name}`);

      // 触发钩子
      await this._triggerHook('plugin:stopped', { plugin: plugin.instance });
    } catch (error) {
      logger.error(`插件停止失败: ${name}`, error);
      throw error;
    }
  }

  /**
   * 卸载插件
   */
  async unregister(name) {
    const plugin = this._plugins.get(name);
    if (!plugin) {
      return;
    }

    try {
      // 先停止插件
      if (plugin.status === 'started') {
        await this.stop(name);
      }

      // 卸载插件
      await plugin.instance.uninstall(plugin.context);

      // 从管理器移除
      this._plugins.delete(name);

      // 清理扩展
      this._cleanupExtensions(name);

      logger.info(`💥 插件已卸载: ${name}`);

      // 触发钩子
      await this._triggerHook('plugin:unregistered', {
        plugin: plugin.instance,
      });
    } catch (error) {
      logger.error(`插件卸载失败: ${name}`, error);
      throw error;
    }
  }

  /**
   * 批量启动所有插件
   */
  async startAll() {
    const plugins = Array.from(this._plugins.keys());
    for (const name of plugins) {
      await this.start(name);
    }
  }

  /**
   * 批量停止所有插件
   */
  async stopAll() {
    const plugins = Array.from(this._plugins.keys()).reverse();
    for (const name of plugins) {
      await this.stop(name);
    }
  }

  /**
   * 获取插件
   */
  get(name) {
    const plugin = this._plugins.get(name);
    return plugin ? plugin.instance : null;
  }

  /**
   * 获取所有插件
   */
  getAll() {
    const plugins = {};
    for (const [name, plugin] of this._plugins) {
      plugins[name] = plugin.instance;
    }
    return plugins;
  }

  /**
   * 检查插件状态
   */
  getStatus(name) {
    const plugin = this._plugins.get(name);
    if (!plugin) return null;

    return {
      name,
      status: plugin.status,
      version: plugin.version,
      description: plugin.description,
    };
  }

  /**
   * 获取所有插件状态
   */
  getAllStatuses() {
    const statuses = {};
    for (const [name, plugin] of this._plugins) {
      statuses[name] = this.getStatus(name);
    }
    return statuses;
  }

  // === 钩子系统 ===

  /**
   * 注册钩子
   */
  hook(event, handler, pluginName = null) {
    if (!this._hooks.has(event)) {
      this._hooks.set(event, []);
    }

    this._hooks.get(event).push({
      handler,
      pluginName,
      priority: 0,
    });

    return this;
  }

  /**
   * 触发钩子
   */
  async _triggerHook(event, data = {}) {
    const hooks = this._hooks.get(event) || [];

    for (const hook of hooks) {
      try {
        await hook.handler(data);
      } catch (error) {
        logger.error(`钩子执行失败: ${event}`, {
          plugin: hook.pluginName,
          error: error.message,
        });
      }
    }
  }

  // === 中间件系统 ===

  /**
   * 注册中间件
   */
  middleware(name, middleware) {
    if (!this._middlewares.has(name)) {
      this._middlewares.set(name, []);
    }

    this._middlewares.get(name).push(middleware);
    return this;
  }

  /**
   * 执行中间件链
   */
  async runMiddleware(name, context, finalHandler) {
    const middlewares = this._middlewares.get(name) || [];
    let index = 0;

    const next = async () => {
      if (index < middlewares.length) {
        const middleware = middlewares[index++];
        return await middleware(context, next);
      } else {
        return await finalHandler(context);
      }
    };

    return await next();
  }

  // === 扩展系统 ===

  /**
   * 注册扩展
   */
  extend(extensionPoint, extension, pluginName) {
    if (!this._extensions.has(extensionPoint)) {
      this._extensions.set(extensionPoint, new Map());
    }

    this._extensions.get(extensionPoint).set(pluginName, extension);

    logger.debug(`🔧 注册扩展: ${extensionPoint} <- ${pluginName}`);
    return this;
  }

  /**
   * 获取扩展
   */
  getExtensions(extensionPoint) {
    const extensions = this._extensions.get(extensionPoint);
    return extensions ? Array.from(extensions.values()) : [];
  }

  /**
   * 调用扩展
   */
  async callExtensions(extensionPoint, method, ...args) {
    const extensions = this.getExtensions(extensionPoint);
    const results = [];

    for (const extension of extensions) {
      if (typeof extension[method] === 'function') {
        try {
          const result = await extension[method](...args);
          results.push(result);
        } catch (error) {
          logger.error(`扩展调用失败: ${extensionPoint}.${method}`, error);
        }
      }
    }

    return results;
  }

  // === 私有方法 ===

  /**
   * 检查依赖
   */
  async _checkDependencies(plugin) {
    for (const dep of plugin.dependencies) {
      if (!this._plugins.has(dep)) {
        throw WokeFlowError.system(`缺少依赖插件: ${dep}`, 'plugin');
      }

      const depPlugin = this._plugins.get(dep);
      if (depPlugin.status !== 'installed' && depPlugin.status !== 'started') {
        throw WokeFlowError.system(`依赖插件未就绪: ${dep}`, 'plugin');
      }
    }
  }

  /**
   * 创建插件上下文
   */
  _createPluginContext(plugin, options) {
    return {
      ...this._context,
      plugin: {
        name: plugin.name,
        version: plugin.version,
        options,
      },
      manager: this,
      logger: logger.child({ plugin: plugin.name }),
    };
  }

  /**
   * 清理扩展
   */
  _cleanupExtensions(pluginName) {
    for (const [point, extensions] of this._extensions) {
      extensions.delete(pluginName);
    }
  }

  /**
   * 设置全局上下文
   */
  setContext(context) {
    this._context = { ...this._context, ...context };
    return this;
  }
}

/**
 * 插件装饰器
 */
export function Plugin(metadata = {}) {
  return function (constructor) {
    // 扩展构造函数
    const originalConstructor = constructor;

    constructor = function (...args) {
      const instance = new originalConstructor(...args);

      // 应用元数据
      Object.assign(instance, {
        name: metadata.name || constructor.name,
        version: metadata.version || '1.0.0',
        description: metadata.description || '',
        dependencies: metadata.dependencies || [],
      });

      return instance;
    };

    constructor.prototype = originalConstructor.prototype;
    return constructor;
  };
}

/**
 * 钩子装饰器
 */
export function Hook(event, options = {}) {
  return function (target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;

    // 在插件管理器中注册钩子
    if (global.wokeflowPluginManager) {
      global.wokeflowPluginManager.hook(
        event,
        originalMethod.bind(target),
        target.name,
      );
    }

    return descriptor;
  };
}

/**
 * 中间件装饰器
 */
export function Middleware(name) {
  return function (target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;

    // 在插件管理器中注册中间件
    if (global.wokeflowPluginManager) {
      global.wokeflowPluginManager.middleware(
        name,
        originalMethod.bind(target),
      );
    }

    return descriptor;
  };
}

/**
 * 扩展装饰器
 */
export function Extension(extensionPoint) {
  return function (constructor) {
    // 标记为扩展
    constructor._extensionPoint = extensionPoint;
    return constructor;
  };
}

/**
 * 全局插件管理器实例
 */
export const pluginManager = new PluginManager();

// 注册到全局
if (typeof global !== 'undefined') {
  global.wokeflowPluginManager = pluginManager;
}

if (typeof window !== 'undefined') {
  window.wokeflowPluginManager = pluginManager;
}
