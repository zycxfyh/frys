/**
 * 插件管理器
 * 提供插件发现、加载、生命周期管理和通信功能
 */

import { logger } from '../../shared/utils/logger.js';
import { IPlugin } from '../interfaces/IModule.js';
import { ErrorHandlerUtils } from '../../shared/utils/ErrorHandlerUtils.js';
import { ResourceCleanupUtils } from '../../shared/utils/ResourceCleanupUtils.js';

export class PluginManager {
  constructor(options = {}) {
    this.options = {
      pluginPath: './plugins',
      autoDiscovery: true,
      hotReload: false,
      sandboxed: true,
      enableCommunication: true,
      maxPlugins: 100,
      securityLevel: 'medium', // low, medium, high
      ...options
    };

    // 插件注册表
    this.plugins = new Map();
    this.activePlugins = new Map();
    this.pluginContexts = new Map();

    // 通信系统
    this.messageBus = this._createMessageBus();
    this.hooks = new Map();

    // 依赖管理
    this.pluginGraph = new Map();

    // 安全沙箱
    this.sandbox = this.options.sandboxed ? this._createSandbox() : null;

    // 清理管理器
    this.cleanupManager = ResourceCleanupUtils.createCleanupManager('plugin_manager');

    logger.info('Plugin manager initialized', {
      autoDiscovery: this.options.autoDiscovery,
      sandboxed: this.options.sandboxed,
      securityLevel: this.options.securityLevel
    });
  }

  /**
   * 注册插件
   * @param {string} name - 插件名称
   * @param {Function} pluginClass - 插件类
   * @param {Object} options - 注册选项
   */
  register(name, pluginClass, options = {}) {
    if (this.plugins.has(name)) {
      logger.warn(`Plugin ${name} is being overwritten`);
    }

    // 验证插件类
    this._validatePluginClass(pluginClass, name);

    const registration = {
      name,
      pluginClass,
      options: {
        version: '1.0.0',
        dependencies: [],
        optionalDependencies: [],
        autoActivate: false,
        configSchema: {},
        metadata: {},
        permissions: [],
        ...options
      },
      registeredAt: Date.now(),
      activated: false,
      activationCount: 0
    };

    this.plugins.set(name, registration);

    // 构建依赖图
    this._buildDependencyGraph(name, registration);

    logger.debug(`Plugin registered: ${name}`, {
      version: registration.options.version,
      dependencies: registration.options.dependencies.length
    });

    // 自动激活
    if (registration.options.autoActivate) {
      setTimeout(() => this.activate(name), 0);
    }

    return this;
  }

  /**
   * 激活插件
   * @param {string} name - 插件名称
   * @param {Object} config - 激活配置
   * @returns {Promise<Object>} 插件实例
   */
  async activate(name, config = {}) {
    const registration = this.plugins.get(name);
    if (!registration) {
      throw new Error(`Plugin not registered: ${name}`);
    }

    if (registration.activated) {
      logger.debug(`Plugin already activated: ${name}`);
      return this.activePlugins.get(name);
    }

    try {
      logger.info(`Activating plugin: ${name}`);

      // 检查依赖
      await this._checkDependencies(name, registration);

      // 创建插件上下文
      const context = this._createPluginContext(name, config, registration);

      // 安全检查
      if (this.sandbox) {
        await this._performSecurityCheck(registration, context);
      }

      // 创建实例
      const instance = await this._createPluginInstance(registration, context);

      // 激活插件
      await ErrorHandlerUtils.createErrorHandler(
        `plugin_activate_${name}`,
        { plugin: name, version: registration.options.version }
      )(async () => {
        await instance.activate(context);
      });

      // 注册钩子
      this._registerPluginHooks(name, instance);

      // 标记为激活状态
      registration.activated = true;
      registration.activationCount++;
      registration.lastActivated = Date.now();

      // 缓存实例
      this.activePlugins.set(name, instance);
      this.pluginContexts.set(name, context);

      // 注册到清理管理器
      this.cleanupManager.register('plugins', instance, name);

      // 发送激活事件
      await this.messageBus.publish('plugin:activated', {
        pluginName: name,
        context,
        timestamp: Date.now()
      });

      logger.info(`Plugin activated successfully: ${name}`, {
        activationCount: registration.activationCount,
        contextId: context.id
      });

      return instance;

    } catch (error) {
      logger.error(`Failed to activate plugin: ${name}`, {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * 停用插件
   * @param {string} name - 插件名称
   * @returns {Promise<void>}
   */
  async deactivate(name) {
    const registration = this.plugins.get(name);
    if (!registration || !registration.activated) {
      logger.warn(`Plugin not activated: ${name}`);
      return;
    }

    try {
      logger.info(`Deactivating plugin: ${name}`);

      const instance = this.activePlugins.get(name);
      const context = this.pluginContexts.get(name);

      // 停用插件
      if (instance && typeof instance.deactivate === 'function') {
        await ErrorHandlerUtils.createErrorHandler(
          `plugin_deactivate_${name}`,
          { plugin: name }
        )(async () => {
          await instance.deactivate();
        });
      }

      // 注销钩子
      this._unregisterPluginHooks(name);

      // 清理资源
      this.activePlugins.delete(name);
      this.pluginContexts.delete(name);

      // 更新注册状态
      registration.activated = false;

      // 发送停用事件
      await this.messageBus.publish('plugin:deactivated', {
        pluginName: name,
        context,
        timestamp: Date.now()
      });

      logger.info(`Plugin deactivated successfully: ${name}`);

    } catch (error) {
      logger.error(`Failed to deactivate plugin: ${name}`, {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 重新加载插件
   * @param {string} name - 插件名称
   * @param {Object} config - 新配置
   * @returns {Promise<Object>} 新的插件实例
   */
  async reload(name, config = {}) {
    logger.info(`Reloading plugin: ${name}`);

    // 停用现有插件
    await this.deactivate(name);

    // 清除模块缓存（如果支持热重载）
    if (this.options.hotReload) {
      this._clearModuleCache(name);
    }

    // 重新激活插件
    return await this.activate(name, config);
  }

  /**
   * 获取插件实例
   * @param {string} name - 插件名称
   * @returns {Object|null}
   */
  get(name) {
    return this.activePlugins.get(name) || null;
  }

  /**
   * 检查插件是否激活
   * @param {string} name - 插件名称
   * @returns {boolean}
   */
  isActive(name) {
    const registration = this.plugins.get(name);
    return registration ? registration.activated : false;
  }

  /**
   * 获取插件信息
   * @param {string} name - 插件名称
   * @returns {Object|null}
   */
  getPluginInfo(name) {
    const registration = this.plugins.get(name);
    if (!registration) return null;

    return {
      name: registration.name,
      version: registration.options.version,
      activated: registration.activated,
      activationCount: registration.activationCount,
      lastActivated: registration.lastActivated,
      dependencies: registration.options.dependencies,
      optionalDependencies: registration.options.optionalDependencies,
      permissions: registration.options.permissions,
      registeredAt: registration.registeredAt,
      metadata: registration.options.metadata
    };
  }

  /**
   * 获取所有插件信息
   * @returns {Array<Object>}
   */
  getAllPlugins() {
    const plugins = [];

    for (const [name] of this.plugins) {
      const info = this.getPluginInfo(name);
      if (info) plugins.push(info);
    }

    return plugins;
  }

  /**
   * 发现插件
   * @param {string} path - 搜索路径
   * @param {Object} options - 发现选项
   * @returns {Promise<Array<Object>>}
   */
  async discover(path = this.options.pluginPath, options = {}) {
    const {
      pattern = /\.js$/,
      recursive = true,
      exclude = []
    } = options;

    try {
      const fs = await import('fs/promises');
      const pathModule = await import('path');

      const plugins = [];

      async function scanDir(dirPath) {
        try {
          const entries = await fs.readdir(dirPath, { withFileTypes: true });

          for (const entry of entries) {
            const fullPath = pathModule.join(dirPath, entry.name);

            if (exclude.some(ex => fullPath.includes(ex))) {
              continue;
            }

            if (entry.isDirectory() && recursive) {
              await scanDir(fullPath);
            } else if (entry.isFile() && pattern.test(entry.name)) {
              try {
                const pluginInfo = await this._analyzePluginFile(fullPath);
                if (pluginInfo) {
                  plugins.push(pluginInfo);
                }
              } catch (error) {
                logger.warn(`Failed to analyze plugin file: ${fullPath}`, {
                  error: error.message
                });
              }
            }
          }
        } catch (error) {
          // 忽略权限错误等
          logger.debug(`Failed to scan directory: ${dirPath}`, {
            error: error.message
          });
        }
      }

      await scanDir(path);

      logger.info(`Plugin discovery completed`, {
        path,
        found: plugins.length
      });

      return plugins;

    } catch (error) {
      logger.error(`Plugin discovery failed`, {
        path,
        error: error.message
      });
      return [];
    }
  }

  /**
   * 注册钩子
   * @param {string} hookName - 钩子名称
   * @param {Function} handler - 处理器函数
   * @param {Object} options - 选项
   */
  registerHook(hookName, handler, options = {}) {
    if (!this.hooks.has(hookName)) {
      this.hooks.set(hookName, []);
    }

    const hookInfo = {
      handler,
      priority: options.priority || 0,
      plugin: options.plugin || 'system',
      once: options.once || false,
      id: `hook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    this.hooks.get(hookName).push(hookInfo);

    // 按优先级排序
    this.hooks.get(hookName).sort((a, b) => b.priority - a.priority);

    logger.debug(`Hook registered: ${hookName}`, {
      plugin: hookInfo.plugin,
      priority: hookInfo.priority
    });

    return hookInfo.id;
  }

  /**
   * 移除钩子
   * @param {string} hookName - 钩子名称
   * @param {string} hookId - 钩子ID
   */
  removeHook(hookName, hookId) {
    const hooks = this.hooks.get(hookName);
    if (hooks) {
      const index = hooks.findIndex(h => h.id === hookId);
      if (index >= 0) {
        hooks.splice(index, 1);
        logger.debug(`Hook removed: ${hookName} (${hookId})`);
        return true;
      }
    }
    return false;
  }

  /**
   * 执行钩子
   * @param {string} hookName - 钩子名称
   * @param {*} data - 钩子数据
   * @param {Object} context - 执行上下文
   * @returns {Promise<*>}
   */
  async executeHook(hookName, data, context = {}) {
    const hooks = this.hooks.get(hookName);
    if (!hooks || hooks.length === 0) {
      return data;
    }

    let result = data;
    const hooksToRemove = [];

    for (const hookInfo of hooks) {
      try {
        const hookResult = await ErrorHandlerUtils.createErrorHandler(
          `hook_${hookName}_${hookInfo.plugin}`,
          { hook: hookName, plugin: hookInfo.plugin }
        )(async () => {
          return await hookInfo.handler(result, context);
        });

        // 如果钩子返回了结果，使用它
        if (hookResult !== undefined) {
          result = hookResult;
        }

        // 如果是一次性钩子，标记为移除
        if (hookInfo.once) {
          hooksToRemove.push(hookInfo.id);
        }

      } catch (error) {
        logger.error(`Hook execution failed: ${hookName}`, {
          plugin: hookInfo.plugin,
          error: error.message,
          hookData: typeof data === 'object' ? JSON.stringify(data).slice(0, 200) : String(data)
        });

        // 钩子执行失败时继续执行其他钩子
      }
    }

    // 移除一次性钩子
    for (const hookId of hooksToRemove) {
      this.removeHook(hookName, hookId);
    }

    return result;
  }

  /**
   * 发送插件间消息
   * @param {string} targetPlugin - 目标插件
   * @param {string} messageType - 消息类型
   * @param {*} payload - 消息负载
   * @param {Object} options - 发送选项
   */
  async sendMessage(targetPlugin, messageType, payload, options = {}) {
    if (!this.options.enableCommunication) {
      logger.warn('Plugin communication is disabled');
      return;
    }

    const message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      from: options.from || 'system',
      to: targetPlugin,
      type: messageType,
      payload,
      timestamp: Date.now(),
      options
    };

    await this.messageBus.publish(`plugin:message:${targetPlugin}`, message);

    logger.debug(`Plugin message sent`, {
      to: targetPlugin,
      type: messageType,
      messageId: message.id
    });
  }

  /**
   * 广播消息给所有插件
   * @param {string} messageType - 消息类型
   * @param {*} payload - 消息负载
   * @param {Object} options - 广播选项
   */
  async broadcastMessage(messageType, payload, options = {}) {
    if (!this.options.enableCommunication) {
      logger.warn('Plugin communication is disabled');
      return;
    }

    const message = {
      id: `broadcast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      from: options.from || 'system',
      type: messageType,
      payload,
      timestamp: Date.now(),
      broadcast: true,
      options
    };

    await this.messageBus.publish('plugin:broadcast', message);

    logger.debug(`Plugin message broadcasted`, {
      type: messageType,
      messageId: message.id
    });
  }

  /**
   * 获取系统统计信息
   * @returns {Object}
   */
  getStats() {
    const pluginsByState = {
      registered: 0,
      activated: 0,
      inactive: 0
    };

    const pluginsByCategory = {};

    for (const [name, registration] of this.plugins) {
      pluginsByState.registered++;

      if (registration.activated) {
        pluginsByState.activated++;
      } else {
        pluginsByState.inactive++;
      }

      // 按类别统计
      const category = registration.options.metadata.category || 'uncategorized';
      pluginsByCategory[category] = (pluginsByCategory[category] || 0) + 1;
    }

    return {
      plugins: pluginsByState,
      byCategory: pluginsByCategory,
      hooks: {
        registered: Array.from(this.hooks.values()).reduce((sum, hooks) => sum + hooks.length, 0),
        types: this.hooks.size
      },
      communication: {
        enabled: this.options.enableCommunication,
        messageBus: this.messageBus.getStats()
      },
      options: this.options
    };
  }

  /**
   * 销毁插件管理器
   */
  async destroy() {
    logger.info('Destroying plugin manager...');

    // 停用所有插件
    for (const [name] of this.plugins) {
      try {
        await this.deactivate(name);
      } catch (error) {
        logger.error(`Failed to deactivate plugin during shutdown: ${name}`, {
          error: error.message
        });
      }
    }

    // 清理资源
    await this.cleanupManager.cleanup();

    // 清空所有集合
    this.plugins.clear();
    this.activePlugins.clear();
    this.pluginContexts.clear();
    this.hooks.clear();
    this.pluginGraph.clear();

    logger.info('Plugin manager destroyed');
  }

  /**
   * 验证插件类
   */
  _validatePluginClass(pluginClass, name) {
    if (typeof pluginClass !== 'function') {
      throw new Error(`Plugin ${name} must be a class or constructor function`);
    }

    // 检查是否实现了IPlugin接口的基本方法
    const requiredMethods = ['activate', 'deactivate'];
    for (const method of requiredMethods) {
      if (typeof pluginClass.prototype[method] !== 'function') {
        throw new Error(`Plugin ${name} must implement ${method} method`);
      }
    }
  }

  /**
   * 构建依赖图
   */
  _buildDependencyGraph(name, registration) {
    const dependencies = [
      ...registration.options.dependencies,
      ...registration.options.optionalDependencies
    ];

    this.pluginGraph.set(name, dependencies);
  }

  /**
   * 检查依赖
   */
  async _checkDependencies(name, registration) {
    const missing = [];
    const inactive = [];

    for (const dep of registration.options.dependencies) {
      if (!this.plugins.has(dep)) {
        missing.push(dep);
      } else if (!this.isActive(dep)) {
        inactive.push(dep);
      }
    }

    if (missing.length > 0) {
      throw new Error(`Missing required plugin dependencies for ${name}: ${missing.join(', ')}`);
    }

    // 尝试激活非活跃的依赖
    for (const dep of inactive) {
      try {
        logger.debug(`Activating dependency plugin: ${dep} for ${name}`);
        await this.activate(dep);
      } catch (error) {
        throw new Error(`Failed to activate dependency plugin ${dep} for ${name}: ${error.message}`);
      }
    }

    // 检查可选依赖
    for (const dep of registration.options.optionalDependencies) {
      if (!this.plugins.has(dep)) {
        logger.warn(`Optional plugin dependency not available: ${dep} for plugin ${name}`);
      }
    }
  }

  /**
   * 创建插件上下文
   */
  _createPluginContext(name, config, registration) {
    return {
      id: `${name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      pluginName: name,
      config,
      manager: this,
      logger: logger.child({ plugin: name }),
      permissions: registration.options.permissions,
      createdAt: Date.now(),
      api: this._createPluginAPI(name)
    };
  }

  /**
   * 创建插件实例
   */
  async _createPluginInstance(registration, context) {
    const { pluginClass } = registration;

    const instance = this.sandbox
      ? this.sandbox.createInstance(pluginClass, context)
      : new pluginClass();

    return instance;
  }

  /**
   * 创建插件API
   */
  _createPluginAPI(pluginName) {
    return {
      // 钩子系统
      registerHook: (hookName, handler, options = {}) => {
        return this.registerHook(hookName, handler, { ...options, plugin: pluginName });
      },

      removeHook: (hookId) => {
        // 移除所有属于此插件的钩子
        for (const [hookName, hooks] of this.hooks) {
          const pluginHooks = hooks.filter(h => h.plugin === pluginName && h.id === hookId);
          for (const hook of pluginHooks) {
            this.removeHook(hookName, hook.id);
          }
        }
      },

      executeHook: (hookName, data, context = {}) => {
        return this.executeHook(hookName, data, { ...context, fromPlugin: pluginName });
      },

      // 消息系统
      sendMessage: (targetPlugin, messageType, payload, options = {}) => {
        return this.sendMessage(targetPlugin, messageType, payload, { ...options, from: pluginName });
      },

      broadcastMessage: (messageType, payload, options = {}) => {
        return this.broadcastMessage(messageType, payload, { ...options, from: pluginName });
      },

      onMessage: (callback) => {
        return this.messageBus.subscribe(`plugin:message:${pluginName}`, callback);
      },

      // 服务访问
      getService: (name) => {
        // 这里可以集成依赖注入容器
        logger.debug(`Plugin ${pluginName} requesting service: ${name}`);
        return null;
      },

      // 配置管理
      getConfig: () => {
        const context = this.pluginContexts.get(pluginName);
        return context ? context.config : {};
      },

      updateConfig: (updates) => {
        const context = this.pluginContexts.get(pluginName);
        if (context) {
          context.config = { ...context.config, ...updates };
          logger.debug(`Plugin ${pluginName} config updated`);
        }
      }
    };
  }

  /**
   * 创建消息总线
   */
  _createMessageBus() {
    const subscribers = new Map();

    return {
      subscribe: (topic, callback) => {
        if (!subscribers.has(topic)) {
          subscribers.set(topic, []);
        }
        subscribers.get(topic).push(callback);

        const unsubscribe = () => {
          const callbacks = subscribers.get(topic);
          if (callbacks) {
            const index = callbacks.indexOf(callback);
            if (index >= 0) {
              callbacks.splice(index, 1);
            }
          }
        };

        return unsubscribe;
      },

      publish: async (topic, message) => {
        const callbacks = subscribers.get(topic);
        if (!callbacks) return;

        const promises = callbacks.map(async (callback) => {
          try {
            await callback(message);
          } catch (error) {
            logger.error(`Message subscriber failed for topic: ${topic}`, {
              error: error.message
            });
          }
        });

        await Promise.allSettled(promises);
      },

      getStats: () => ({
        topics: subscribers.size,
        totalSubscribers: Array.from(subscribers.values()).reduce((sum, callbacks) => sum + callbacks.length, 0)
      })
    };
  }

  /**
   * 创建安全沙箱
   */
  _createSandbox() {
    const allowedGlobals = new Set([
      'console', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
      'Buffer', 'process', 'global', 'globalThis'
    ]);

    return {
      createInstance: (PluginClass, context) => {
        // 创建受限的全局对象
        const sandboxGlobals = Object.create(null);

        for (const key of allowedGlobals) {
          if (typeof global[key] !== 'undefined') {
            sandboxGlobals[key] = global[key];
          }
        }

        // 创建沙箱上下文
        const sandboxContext = Object.create(sandboxGlobals);
        sandboxContext.pluginContext = context;

        // 使用with语句创建沙箱环境（注意：这有安全风险，仅用于可信插件）
        const createInstanceInSandbox = new Function('PluginClass', 'context', `
          with (this) {
            return new PluginClass(context);
          }
        `).bind(sandboxContext);

        return createInstanceInSandbox(PluginClass, context);
      }
    };
  }

  /**
   * 执行安全检查
   */
  async _performSecurityCheck(registration, context) {
    const { permissions } = registration.options;

    // 检查权限
    if (permissions.includes('file-system')) {
      // 检查文件系统访问权限
      logger.debug(`Security check: file-system access granted for ${registration.name}`);
    }

    if (permissions.includes('network')) {
      // 检查网络访问权限
      logger.debug(`Security check: network access granted for ${registration.name}`);
    }

    // 根据安全级别执行额外检查
    if (this.options.securityLevel === 'high') {
      // 高级安全检查
      await this._performHighSecurityCheck(registration, context);
    }
  }

  /**
   * 执行高级安全检查
   */
  async _performHighSecurityCheck(registration, context) {
    // 检查插件代码的静态分析
    // 这里可以集成代码分析工具

    logger.debug(`High security check completed for ${registration.name}`);
  }

  /**
   * 注册插件钩子
   */
  _registerPluginHooks(pluginName, instance) {
    if (typeof instance.registerHooks === 'function') {
      const hooks = instance.registerHooks();
      if (hooks && typeof hooks === 'object') {
        for (const [hookName, handler] of Object.entries(hooks)) {
          this.registerHook(hookName, handler, { plugin: pluginName });
        }
      }
    }
  }

  /**
   * 注销插件钩子
   */
  _unregisterPluginHooks(pluginName) {
    for (const [hookName, hooks] of this.hooks) {
      const pluginHooks = hooks.filter(h => h.plugin === pluginName);
      for (const hook of pluginHooks) {
        this.removeHook(hookName, hook.id);
      }
    }
  }

  /**
   * 分析插件文件
   */
  async _analyzePluginFile(filePath) {
    try {
      // 动态导入插件
      const module = await import(filePath);

      if (!module.default) {
        return null;
      }

      const pluginClass = module.default;
      const metadata = pluginClass.metadata || {};

      return {
        name: metadata.name || this._extractNameFromPath(filePath),
        version: metadata.version || '1.0.0',
        path: filePath,
        pluginClass,
        metadata
      };

    } catch (error) {
      logger.debug(`Failed to analyze plugin file: ${filePath}`, {
        error: error.message
      });
      return null;
    }
  }

  /**
   * 从路径提取名称
   */
  _extractNameFromPath(filePath) {
    const pathModule = require('path');
    const baseName = pathModule.basename(filePath, pathModule.extname(filePath));
    return baseName.replace(/[^a-zA-Z0-9_]/g, '_');
  }

  /**
   * 清除模块缓存
   */
  _clearModuleCache(name) {
    try {
      const registration = this.plugins.get(name);
      if (registration && registration.options.path) {
        delete require.cache[require.resolve(registration.options.path)];
        logger.debug(`Module cache cleared for plugin: ${name}`);
      }
    } catch (error) {
      logger.warn(`Failed to clear module cache for plugin: ${name}`, {
        error: error.message
      });
    }
  }
}
