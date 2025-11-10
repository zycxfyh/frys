/**
 * 应用框架
 * 整合所有核心组件，提供统一的模块化应用入口
 */

import { logger } from '../../shared/utils/logger.js';
import { ConfigurationManager } from './config/ConfigurationManager.js';
import { Container } from './di/Container.js';
import { ModuleSystem } from './modules/ModuleSystem.js';
import { PluginManager } from './plugins/PluginManager.js';
import { ErrorHandlerUtils } from '../../shared/utils/ErrorHandlerUtils.js';
import { ResourceCleanupUtils } from '../../shared/utils/ResourceCleanupUtils.js';
import { HealthCheckUtils } from '../../shared/utils/HealthCheckUtils.js';

export class Application {
  constructor(options = {}) {
    this.options = {
      name: 'frys-app',
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      autoStart: true,
      enablePlugins: true,
      enableModules: true,
      enableDI: true,
      gracefulShutdown: true,
      shutdownTimeout: 30000,
      ...options
    };

    // 核心组件
    this.config = null;
    this.container = null;
    this.moduleSystem = null;
    this.pluginManager = null;

    // 应用状态
    this.state = 'created'; // created, initializing, ready, starting, running, stopping, stopped, error
    this.startTime = null;
    this.readyTime = null;

    // 生命周期钩子
    this.lifecycleHooks = new Map();

    // 健康检查
    this.healthChecker = HealthCheckUtils.createHealthChecker('application');

    // 清理管理器
    this.cleanupManager = ResourceCleanupUtils.createCleanupManager('application');

    // 信号处理
    this.setupSignalHandlers();

    logger.info('Application framework initialized', {
      name: this.options.name,
      version: this.options.version,
      environment: this.options.environment
    });
  }

  /**
   * 启动应用
   * @param {Object} config - 启动配置
   * @returns {Promise<Application>}
   */
  async start(config = {}) {
    if (this.state !== 'created') {
      throw new Error(`Application is already ${this.state}`);
    }

    this.startTime = Date.now();

    try {
      logger.info('Starting application...', { name: this.options.name });

      // 执行启动前钩子
      await this._executeLifecycleHooks('beforeStart', config);

      // 设置状态
      this.state = 'initializing';

      // 初始化核心组件
      await this._initializeCoreComponents(config);

      // 执行初始化后钩子
      await this._executeLifecycleHooks('afterInit', config);

      // 设置状态为就绪
      this.state = 'ready';
      this.readyTime = Date.now();

      logger.info('Application initialized successfully', {
        initTime: this.readyTime - this.startTime,
        components: this._getActiveComponents()
      });

      // 如果启用自动启动，开始运行
      if (this.options.autoStart) {
        await this.run();
      }

      return this;

    } catch (error) {
      this.state = 'error';
      logger.error('Application startup failed', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * 运行应用
   * @returns {Promise<void>}
   */
  async run() {
    if (this.state !== 'ready') {
      throw new Error(`Application is not ready to run (current state: ${this.state})`);
    }

    try {
      logger.info('Running application...');

      // 设置状态
      this.state = 'starting';

      // 执行运行前钩子
      await this._executeLifecycleHooks('beforeRun');

      // 启动模块系统
      if (this.moduleSystem && this.options.enableModules) {
        await this._startModules();
      }

      // 启动插件系统
      if (this.pluginManager && this.options.enablePlugins) {
        await this._startPlugins();
      }

      // 执行运行后钩子
      await this._executeLifecycleHooks('afterRun');

      // 设置状态为运行中
      this.state = 'running';

      const runTime = Date.now() - this.readyTime;
      logger.info('Application is now running', {
        runTime,
        totalTime: Date.now() - this.startTime
      });

    } catch (error) {
      this.state = 'error';
      logger.error('Application run failed', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * 停止应用
   * @param {Object} options - 停止选项
   * @returns {Promise<void>}
   */
  async stop(options = {}) {
    if (this.state === 'stopped') {
      return;
    }

    const { force = false, timeout = this.options.shutdownTimeout } = options;

    try {
      logger.info('Stopping application...', { force, timeout });

      // 设置状态
      this.state = 'stopping';

      // 执行停止前钩子
      await this._executeLifecycleHooks('beforeStop');

      // 创建停止超时
      const stopPromise = this._performShutdown();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Shutdown timeout')), timeout);
      });

      await Promise.race(force ? [stopPromise] : [stopPromise, timeoutPromise]);

      // 执行停止后钩子
      await this._executeLifecycleHooks('afterStop');

      // 设置状态
      this.state = 'stopped';

      const uptime = Date.now() - this.startTime;
      logger.info('Application stopped successfully', {
        uptime,
        force
      });

    } catch (error) {
      this.state = 'error';
      logger.error('Application shutdown failed', {
        error: error.message,
        force
      });

      // 强制退出
      if (force) {
        process.exit(1);
      }

      throw error;
    }
  }

  /**
   * 重启应用
   * @param {Object} options - 重启选项
   * @returns {Promise<Application>}
   */
  async restart(options = {}) {
    logger.info('Restarting application...');

    await this.stop({ force: false });
    return await this.start(options);
  }

  /**
   * 获取应用配置
   * @param {string} key - 配置键
   * @param {*} defaultValue - 默认值
   * @returns {*}
   */
  getConfig(key, defaultValue) {
    return this.config ? this.config.get(key, defaultValue) : defaultValue;
  }

  /**
   * 设置应用配置
   * @param {string} key - 配置键
   * @param {*} value - 配置值
   */
  setConfig(key, value) {
    if (this.config) {
      this.config.set(key, value);
    }
  }

  /**
   * 从依赖注入容器获取服务
   * @param {string} name - 服务名称
   * @returns {*}
   */
  getService(name) {
    return this.container ? this.container.resolve(name) : null;
  }

  /**
   * 注册服务到依赖注入容器
   * @param {string} name - 服务名称
   * @param {*} service - 服务实例或类
   * @param {Object} options - 注册选项
   */
  registerService(name, service, options = {}) {
    if (this.container) {
      this.container.register(name, service, options);
    }
  }

  /**
   * 加载模块
   * @param {string} name - 模块名称
   * @param {Object} config - 模块配置
   * @returns {Promise<Object>}
   */
  async loadModule(name, config = {}) {
    if (!this.moduleSystem) {
      throw new Error('Module system is not enabled');
    }
    return await this.moduleSystem.load(name, config);
  }

  /**
   * 激活插件
   * @param {string} name - 插件名称
   * @param {Object} config - 插件配置
   * @returns {Promise<Object>}
   */
  async activatePlugin(name, config = {}) {
    if (!this.pluginManager) {
      throw new Error('Plugin system is not enabled');
    }
    return await this.pluginManager.activate(name, config);
  }

  /**
   * 添加生命周期钩子
   * @param {string} hook - 钩子名称
   * @param {Function} handler - 处理器函数
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
   * 获取应用状态
   * @returns {Object}
   */
  getStatus() {
    return {
      name: this.options.name,
      version: this.options.version,
      environment: this.options.environment,
      state: this.state,
      uptime: this.startTime ? Date.now() - this.startTime : 0,
      readyTime: this.readyTime ? Date.now() - this.readyTime : 0,
      components: this._getActiveComponents(),
      health: this.healthChecker.getHealth(),
      stats: this._getApplicationStats()
    };
  }

  /**
   * 获取应用统计信息
   * @returns {Object}
   */
  getStats() {
    return {
      application: this._getApplicationStats(),
      config: this.config ? this.config.getStats() : null,
      container: this.container ? this.container.getStats() : null,
      modules: this.moduleSystem ? this.moduleSystem.getStats() : null,
      plugins: this.pluginManager ? this.pluginManager.getStats() : null
    };
  }

  /**
   * 执行健康检查
   * @returns {Promise<Object>}
   */
  async healthCheck() {
    const results = await this.healthChecker.check();

    // 检查核心组件健康状态
    if (this.config) {
      results.config = { healthy: true, status: 'ok' };
    }

    if (this.container) {
      results.container = { healthy: true, status: 'ok' };
    }

    if (this.moduleSystem) {
      const moduleStats = this.moduleSystem.getStats();
      results.modules = {
        healthy: moduleStats.modules.failed === 0,
        status: moduleStats.modules.failed === 0 ? 'ok' : 'warning',
        details: moduleStats
      };
    }

    if (this.pluginManager) {
      const pluginStats = this.pluginManager.getStats();
      results.plugins = {
        healthy: true,
        status: 'ok',
        details: pluginStats
      };
    }

    return results;
  }

  /**
   * 销毁应用
   * @returns {Promise<void>}
   */
  async destroy() {
    logger.info('Destroying application...');

    if (this.state !== 'stopped') {
      await this.stop({ force: true });
    }

    // 销毁核心组件
    const destroyPromises = [];

    if (this.pluginManager) {
      destroyPromises.push(this.pluginManager.destroy());
    }

    if (this.moduleSystem) {
      destroyPromises.push(this.moduleSystem.destroy());
    }

    if (this.container) {
      destroyPromises.push(this.container.destroy());
    }

    if (this.config) {
      destroyPromises.push(this.config.destroy());
    }

    await Promise.allSettled(destroyPromises);

    // 清理资源
    await this.cleanupManager.cleanup();

    // 清空引用
    this.config = null;
    this.container = null;
    this.moduleSystem = null;
    this.pluginManager = null;
    this.lifecycleHooks.clear();

    logger.info('Application destroyed');
  }

  /**
   * 初始化核心组件
   */
  async _initializeCoreComponents(config) {
    // 1. 初始化配置管理器
    this.config = new ConfigurationManager({
      enableHotReload: this.options.environment === 'development',
      enableValidation: true,
      enableCaching: true
    });

    // 加载基础配置
    await this._loadBaseConfiguration(config);

    // 2. 初始化依赖注入容器
    if (this.options.enableDI) {
      this.container = new Container({
        autoResolve: true,
        strictMode: this.options.environment === 'production'
      });

      // 注册核心服务
      this._registerCoreServices();
    }

    // 3. 初始化模块系统
    if (this.options.enableModules) {
      this.moduleSystem = new ModuleSystem({
        autoDiscovery: this.options.environment === 'development',
        sandboxed: this.options.environment !== 'development'
      });
    }

    // 4. 初始化插件系统
    if (this.options.enablePlugins) {
      this.pluginManager = new PluginManager({
        autoDiscovery: true,
        sandboxed: this.options.environment !== 'development',
        securityLevel: this.options.environment === 'production' ? 'high' : 'medium'
      });
    }

    logger.debug('Core components initialized');
  }

  /**
   * 加载基础配置
   */
  async _loadBaseConfiguration(config) {
    // 添加应用配置层
    this.config.addLayer('application', {
      app: {
        name: this.options.name,
        version: this.options.version,
        environment: this.options.environment,
        startTime: new Date().toISOString()
      },
      features: {
        di: this.options.enableDI,
        modules: this.options.enableModules,
        plugins: this.options.enablePlugins
      }
    });

    // 加载外部配置
    if (config.configFile) {
      await this.config.loadFromFile('external', config.configFile);
    }

    // 加载环境变量配置
    this.config.loadFromEnv('env', 'APP_');
  }

  /**
   * 注册核心服务
   */
  _registerCoreServices() {
    // 注册配置服务
    this.container.registerInstance('config', this.config);

    // 注册应用实例
    this.container.registerInstance('app', this);

    // 注册日志服务
    this.container.registerInstance('logger', logger);

    // 注册其他核心服务
    if (this.moduleSystem) {
      this.container.registerInstance('moduleSystem', this.moduleSystem);
    }

    if (this.pluginManager) {
      this.container.registerInstance('pluginManager', this.pluginManager);
    }
  }

  /**
   * 启动模块系统
   */
  async _startModules() {
    const moduleConfig = this.getConfig('modules', {});

    // 自动发现模块
    if (moduleConfig.autoDiscover !== false) {
      const discoveredModules = await this.moduleSystem.discover();
      logger.info(`Discovered ${discoveredModules.length} modules`);
    }

    // 加载核心模块
    const coreModules = moduleConfig.core || [];
    for (const moduleName of coreModules) {
      try {
        await this.loadModule(moduleName);
        logger.debug(`Core module loaded: ${moduleName}`);
      } catch (error) {
        logger.error(`Failed to load core module: ${moduleName}`, {
          error: error.message
        });
        throw error;
      }
    }
  }

  /**
   * 启动插件系统
   */
  async _startPlugins() {
    const pluginConfig = this.getConfig('plugins', {});

    // 自动发现插件
    if (pluginConfig.autoDiscover !== false) {
      const discoveredPlugins = await this.pluginManager.discover();
      logger.info(`Discovered ${discoveredPlugins.length} plugins`);
    }

    // 激活核心插件
    const corePlugins = pluginConfig.core || [];
    for (const pluginName of corePlugins) {
      try {
        await this.activatePlugin(pluginName);
        logger.debug(`Core plugin activated: ${pluginName}`);
      } catch (error) {
        logger.error(`Failed to activate core plugin: ${pluginName}`, {
          error: error.message
        });
        // 插件失败不阻止应用启动
      }
    }
  }

  /**
   * 执行生命周期钩子
   */
  async _executeLifecycleHooks(hook, data = {}) {
    const hooks = this.lifecycleHooks.get(hook);
    if (!hooks) return;

    for (const hookInfo of hooks) {
      try {
        await hookInfo.handler(this, data);
      } catch (error) {
        logger.error(`Lifecycle hook failed: ${hook}`, {
          hook: hookInfo.name,
          error: error.message
        });
      }
    }
  }

  /**
   * 执行关闭过程
   */
  async _performShutdown() {
    const shutdownPromises = [];

    // 停止插件系统
    if (this.pluginManager) {
      shutdownPromises.push(this._shutdownPlugins());
    }

    // 停止模块系统
    if (this.moduleSystem) {
      shutdownPromises.push(this._shutdownModules());
    }

    await Promise.allSettled(shutdownPromises);
  }

  /**
   * 关闭插件系统
   */
  async _shutdownPlugins() {
    const activePlugins = this.pluginManager.getAllPlugins()
      .filter(p => p.activated)
      .map(p => p.name);

    for (const pluginName of activePlugins) {
      try {
        await this.pluginManager.deactivate(pluginName);
      } catch (error) {
        logger.warn(`Failed to deactivate plugin during shutdown: ${pluginName}`, {
          error: error.message
        });
      }
    }
  }

  /**
   * 关闭模块系统
   */
  async _shutdownModules() {
    const loadedModules = this.moduleSystem.getAllModules()
      .filter(m => m.loaded)
      .map(m => m.name);

    for (const moduleName of loadedModules) {
      try {
        await this.moduleSystem.unload(moduleName);
      } catch (error) {
        logger.warn(`Failed to unload module during shutdown: ${moduleName}`, {
          error: error.message
        });
      }
    }
  }

  /**
   * 设置信号处理器
   */
  setupSignalHandlers() {
    if (!this.options.gracefulShutdown) return;

    const signals = ['SIGINT', 'SIGTERM', 'SIGUSR2'];

    for (const signal of signals) {
      process.on(signal, async () => {
        logger.info(`Received ${signal}, initiating graceful shutdown...`);

        try {
          await this.stop({ timeout: 10000 });
          process.exit(0);
        } catch (error) {
          logger.error(`Graceful shutdown failed, forcing exit`, {
            signal,
            error: error.message
          });
          process.exit(1);
        }
      });
    }

    // 处理未捕获的异常
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', {
        error: error.message,
        stack: error.stack
      });
      this.stop({ force: true }).finally(() => process.exit(1));
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection', {
        reason: reason?.message || reason,
        promise: promise?.toString()
      });
      this.stop({ force: true }).finally(() => process.exit(1));
    });
  }

  /**
   * 获取活跃组件列表
   */
  _getActiveComponents() {
    return {
      config: !!this.config,
      container: !!this.container,
      moduleSystem: !!this.moduleSystem,
      pluginManager: !!this.pluginManager
    };
  }

  /**
   * 获取应用统计信息
   */
  _getApplicationStats() {
    return {
      state: this.state,
      uptime: this.startTime ? Date.now() - this.startTime : 0,
      lifecycleHooks: this.lifecycleHooks.size,
      memory: process.memoryUsage(),
      pid: process.pid,
      platform: process.platform,
      nodeVersion: process.version
    };
  }
}

/**
 * 创建应用实例的工厂函数
 * @param {Object} options - 应用选项
 * @returns {Application}
 */
export function createApplication(options = {}) {
  return new Application(options);
}

/**
 * 快速启动应用的辅助函数
 * @param {Object} options - 启动选项
 * @returns {Promise<Application>}
 */
export async function quickStart(options = {}) {
  const app = createApplication(options);
  return await app.start(options);
}
