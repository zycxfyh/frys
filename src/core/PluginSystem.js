/**
 * frys 插件系统配置
 * 使用 fastify-plugin 替代自建的 PluginManager
 */

import fp from 'fastify-plugin';
import { logger } from '../../shared/utils/logger.js';

// 插件注册表
const pluginRegistry = new Map();
const loadedPlugins = new Map();
const pluginConfigs = new Map();

/**
 * 插件管理器类
 */
class PluginManager {
  constructor() {
    this.plugins = new Map();
    this.initialized = false;
  }

  /**
   * 初始化插件系统
   */
  async initialize() {
    logger.info('🔌 初始化插件系统...');

    // 加载核心插件
    await this.loadCorePlugins();

    this.initialized = true;
    logger.info('✅ 插件系统初始化完成');
  }

  /**
   * 加载核心插件
   */
  async loadCorePlugins() {
    const corePlugins = [
      // 这里可以定义核心插件
      // 例如：认证插件、日志插件、监控插件等
    ];

    for (const plugin of corePlugins) {
      try {
        await this.loadPlugin(plugin);
      } catch (error) {
        logger.error(`核心插件加载失败: ${plugin.name}`, error);
        // 核心插件失败不应该阻止系统启动
      }
    }
  }

  /**
   * 注册插件
   */
  register(name, plugin, options = {}) {
    if (pluginRegistry.has(name)) {
      throw new Error(`插件已注册: ${name}`);
    }

    const pluginDefinition = {
      name,
      plugin,
      options: {
        enabled: true,
        priority: 0,
        dependencies: [],
        ...options,
      },
      registeredAt: Date.now(),
    };

    pluginRegistry.set(name, pluginDefinition);

    logger.debug(`🔌 插件已注册: ${name}`, {
      priority: pluginDefinition.options.priority,
      dependencies: pluginDefinition.options.dependencies,
    });

    return this;
  }

  /**
   * 注销插件
   */
  unregister(name) {
    if (!pluginRegistry.has(name)) {
      logger.warn(`尝试注销未注册的插件: ${name}`);
      return false;
    }

    // 如果插件正在运行，先停止它
    if (loadedPlugins.has(name)) {
      this.unloadPlugin(name);
    }

    pluginRegistry.delete(name);
    pluginConfigs.delete(name);

    logger.debug(`🔌 插件已注销: ${name}`);
    return true;
  }

  /**
   * 加载插件
   */
  async loadPlugin(pluginDefinition) {
    const { name, plugin, options } = pluginDefinition;

    try {
      this._checkPluginDependencies(name, options);
      const wrappedPlugin = this._wrapPlugin(plugin, options);
      await this._initializePluginIfNeeded(wrappedPlugin, options);

      loadedPlugins.set(name, {
        plugin: wrappedPlugin,
        definition: pluginDefinition,
        loadedAt: Date.now(),
      });

      logger.info(`🔌 插件已加载: ${name}`);
      return wrappedPlugin;
    } catch (error) {
      logger.error(`🔌 插件加载失败: ${name}`, error);
      throw error;
    }
  }

  _checkPluginDependencies(name, options) {
    if (!options.dependencies || options.dependencies.length === 0) {
      return;
    }

    for (const dep of options.dependencies) {
      if (!loadedPlugins.has(dep)) {
        throw new Error(`插件依赖未满足: ${dep}`);
      }
    }
  }

  _wrapPlugin(plugin, options) {
    if (typeof plugin === 'function' && plugin.length >= 2) {
      // 可能是 fastify 插件函数 (fastify, options, done)
      return fp(plugin, options.fastifyOptions || {});
    }

    if (typeof plugin === 'object' && plugin.default) {
      // ES模块
      return plugin.default;
    }

    return plugin;
  }

  async _initializePluginIfNeeded(plugin, options) {
    if (typeof plugin.initialize === 'function') {
      await plugin.initialize(options);
    }
  }

  /**
   * 卸载插件
   */
  unloadPlugin(name) {
    const loadedPlugin = loadedPlugins.get(name);
    if (!loadedPlugin) {
      return false;
    }

    try {
      const { plugin } = loadedPlugin;

      // 如果有清理方法，调用它
      if (typeof plugin.destroy === 'function') {
        plugin.destroy();
      }

      loadedPlugins.delete(name);
      logger.info(`🔌 插件已卸载: ${name}`);

      return true;
    } catch (error) {
      logger.error(`🔌 插件卸载失败: ${name}`, error);
      return false;
    }
  }

  /**
   * 启动所有插件
   */
  async startAll() {
    logger.info('🚀 启动所有插件...');

    // 按优先级排序
    const sortedPlugins = Array.from(pluginRegistry.values())
      .filter((p) => p.options.enabled)
      .sort((a, b) => (a.options.priority || 0) - (b.options.priority || 0));

    for (const pluginDef of sortedPlugins) {
      try {
        if (!loadedPlugins.has(pluginDef.name)) {
          await this.loadPlugin(pluginDef);
        }

        const loadedPlugin = loadedPlugins.get(pluginDef.name);
        if (loadedPlugin && typeof loadedPlugin.plugin.start === 'function') {
          await loadedPlugin.plugin.start();
        }

        logger.debug(`🔌 插件已启动: ${pluginDef.name}`);
      } catch (error) {
        logger.error(`🔌 插件启动失败: ${pluginDef.name}`, error);
        // 单个插件失败不阻止其他插件启动
      }
    }

    logger.info('✅ 所有插件启动完成');
  }

  /**
   * 停止所有插件
   */
  async stopAll() {
    logger.info('🛑 停止所有插件...');

    // 按优先级倒序停止
    const sortedPlugins = Array.from(loadedPlugins.keys())
      .map((name) => ({ name, def: pluginRegistry.get(name) }))
      .filter((item) => item.def)
      .sort(
        (a, b) => (b.def.options.priority || 0) - (a.def.options.priority || 0),
      );

    for (const { name } of sortedPlugins) {
      try {
        const loadedPlugin = loadedPlugins.get(name);
        if (loadedPlugin && typeof loadedPlugin.plugin.stop === 'function') {
          await loadedPlugin.plugin.stop();
        }

        this.unloadPlugin(name);
      } catch (error) {
        logger.error(`🔌 插件停止失败: ${name}`, error);
      }
    }

    logger.info('✅ 所有插件停止完成');
  }

  /**
   * 获取插件
   */
  get(name) {
    const loaded = loadedPlugins.get(name);
    return loaded ? loaded.plugin : null;
  }

  /**
   * 检查插件是否已加载
   */
  isLoaded(name) {
    return loadedPlugins.has(name);
  }

  /**
   * 获取所有插件状态
   */
  getAllStatuses() {
    const statuses = {};

    for (const [name, pluginDef] of pluginRegistry) {
      statuses[name] = {
        registered: true,
        loaded: loadedPlugins.has(name),
        enabled: pluginDef.options.enabled,
        priority: pluginDef.options.priority,
        dependencies: pluginDef.options.dependencies,
      };
    }

    return statuses;
  }

  /**
   * 配置插件
   */
  configure(name, config) {
    if (!pluginRegistry.has(name)) {
      throw new Error(`插件未注册: ${name}`);
    }

    pluginConfigs.set(name, {
      ...pluginConfigs.get(name),
      ...config,
    });

    logger.debug(`🔌 插件配置已更新: ${name}`, config);
  }

  /**
   * 获取插件配置
   */
  getConfig(name) {
    return pluginConfigs.get(name) || {};
  }

  /**
   * 为 Fastify 注册路由
   */
  async registerRoutes(fastify) {
    logger.debug('🔌 注册插件路由到 Fastify...');

    for (const [name, loadedPlugin] of loadedPlugins) {
      try {
        await this._registerPluginRoutes(fastify, name, loadedPlugin.plugin);
      } catch (error) {
        logger.error(`🔌 插件路由注册失败: ${name}`, error);
      }
    }
  }

  async _registerPluginRoutes(fastify, name, plugin) {
    try {
      if (!plugin.routes) {
        return;
      }

      if (Array.isArray(plugin.routes)) {
        for (const route of plugin.routes) {
          fastify.route(route);
        }
      } else if (typeof plugin.routes === 'function') {
        await plugin.routes(fastify);
      }

      // 如果插件本身就是 fastify 插件
      if (typeof plugin === 'function' && plugin.length >= 2) {
        await fastify.register(plugin, this.getConfig(name));
      }
    } catch (error) {
      logger.error(`🔌 插件路由注册失败: ${name}`, error);
    }
  }

  /**
   * 完成插件路由注册
   */
  _finishRouteRegistration() {
    logger.debug('✅ 插件路由注册完成');
  }

  /**
   * 钩子系统
   */
  hook(hookName, ...args) {
    const results = [];

    for (const [name, loadedPlugin] of loadedPlugins) {
      try {
        const plugin = loadedPlugin.plugin;

        if (typeof plugin[hookName] === 'function') {
          const result = plugin[hookName](...args);
          results.push({ name, result });
        }
      } catch (error) {
        logger.error(`🔌 插件钩子执行失败: ${name}:${hookName}`, error);
      }
    }

    return results;
  }

  /**
   * 健康检查
   */
  healthCheck() {
    const statuses = this.getAllStatuses();
    const loadedCount = Object.values(statuses).filter((s) => s.loaded).length;
    const totalCount = Object.keys(statuses).length;

    return {
      healthy: loadedCount === totalCount,
      plugins: {
        total: totalCount,
        loaded: loadedCount,
        statuses,
      },
      timestamp: Date.now(),
    };
  }

  /**
   * 清理资源
   */
  async destroy() {
    await this.stopAll();
    pluginRegistry.clear();
    loadedPlugins.clear();
    pluginConfigs.clear();
    this.initialized = false;
    logger.info('🧹 插件系统已清理');
  }
}

// 创建全局插件管理器实例
const pluginManager = new PluginManager();

// 导出
export { pluginManager, PluginManager };
export default pluginManager;
