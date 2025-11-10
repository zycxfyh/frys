/**
 * 模块系统
 * 提供模块发现、加载、依赖管理和生命周期管理
 */

import { logger } from '../../shared/utils/logger.js';
import { IModule } from '../interfaces/IModule.js';
import { ErrorHandlerUtils } from '../../shared/utils/ErrorHandlerUtils.js';
import { ResourceCleanupUtils } from '../../shared/utils/ResourceCleanupUtils.js';

export class ModuleSystem {
  constructor(options = {}) {
    this.options = {
      autoDiscovery: true,
      hotReload: false,
      sandboxed: true,
      modulePath: './modules',
      cacheModules: true,
      enablePlugins: true,
      ...options
    };

    // 模块注册表
    this.modules = new Map();
    this.loadedModules = new Map();
    this.moduleContexts = new Map();

    // 依赖图
    this.dependencyGraph = new Map();

    // 模块加载器
    this.loaders = new Map();
    this.defaultLoader = this._createDefaultLoader();

    // 生命周期管理
    this.lifecycleManager = this._createLifecycleManager();

    // 清理管理器
    this.cleanupManager = ResourceCleanupUtils.createCleanupManager('module_system');

    logger.info('Module system initialized', {
      autoDiscovery: this.options.autoDiscovery,
      hotReload: this.options.hotReload,
      sandboxed: this.options.sandboxed
    });
  }

  /**
   * 注册模块
   * @param {string} name - 模块名称
   * @param {Function} moduleClass - 模块类
   * @param {Object} options - 注册选项
   */
  register(name, moduleClass, options = {}) {
    if (this.modules.has(name)) {
      logger.warn(`Module ${name} is being overwritten`);
    }

    // 验证模块类
    this._validateModuleClass(moduleClass, name);

    const registration = {
      name,
      moduleClass,
      options: {
        version: '1.0.0',
        dependencies: [],
        optionalDependencies: [],
        singleton: true,
        autoStart: true,
        configSchema: {},
        metadata: {},
        ...options
      },
      registeredAt: Date.now(),
      instances: new Map()
    };

    this.modules.set(name, registration);

    // 构建依赖图
    this._buildDependencyGraph(name, registration);

    logger.debug(`Module registered: ${name}`, {
      version: registration.options.version,
      dependencies: registration.options.dependencies.length
    });

    return this;
  }

  /**
   * 注册模块加载器
   * @param {string} type - 加载器类型
   * @param {Function} loader - 加载器函数
   */
  registerLoader(type, loader) {
    this.loaders.set(type, loader);
    logger.debug(`Module loader registered: ${type}`);
    return this;
  }

  /**
   * 加载模块
   * @param {string} name - 模块名称
   * @param {Object} config - 模块配置
   * @param {Object} context - 加载上下文
   * @returns {Promise<Object>} 模块实例
   */
  async load(name, config = {}, context = {}) {
    const registration = this.modules.get(name);
    if (!registration) {
      throw new Error(`Module not registered: ${name}`);
    }

    // 检查是否已加载
    if (this.loadedModules.has(name) && registration.options.singleton) {
      logger.debug(`Returning cached module instance: ${name}`);
      return this.loadedModules.get(name);
    }

    try {
      logger.info(`Loading module: ${name}`);

      // 检查依赖
      await this._checkDependencies(name, registration);

      // 创建模块上下文
      const moduleContext = this._createModuleContext(name, config, context);

      // 使用加载器加载模块
      const instance = await this._loadWithLoader(registration, moduleContext);

      // 初始化模块
      await this.lifecycleManager.initialize(instance, moduleContext);

      // 缓存实例
      if (registration.options.singleton) {
        this.loadedModules.set(name, instance);
      }
      registration.instances.set(moduleContext.id, instance);
      this.moduleContexts.set(moduleContext.id, moduleContext);

      // 注册到清理管理器
      this.cleanupManager.register('modules', instance, name);

      logger.info(`Module loaded successfully: ${name}`, {
        contextId: moduleContext.id,
        singleton: registration.options.singleton
      });

      return instance;

    } catch (error) {
      logger.error(`Failed to load module: ${name}`, {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * 批量加载模块
   * @param {Array<string>} names - 模块名称数组
   * @param {Object} configs - 模块配置映射
   * @param {Object} context - 加载上下文
   * @returns {Promise<Object>} 模块实例映射
   */
  async loadMany(names, configs = {}, context = {}) {
    const results = {};
    const errors = [];

    // 按依赖顺序排序
    const sortedNames = this._topologicalSort(names);

    for (const name of sortedNames) {
      try {
        const config = configs[name] || {};
        results[name] = await this.load(name, config, context);
      } catch (error) {
        errors.push({ name, error: error.message });

        if (this.options.strictMode) {
          throw error;
        }

        logger.warn(`Failed to load module ${name}, continuing`, {
          error: error.message
        });
      }
    }

    if (errors.length > 0) {
      logger.warn('Some modules failed to load', { errors });
    }

    return results;
  }

  /**
   * 卸载模块
   * @param {string} name - 模块名称
   * @param {string} contextId - 上下文ID（用于非单例模块）
   */
  async unload(name, contextId = null) {
    const registration = this.modules.get(name);
    if (!registration) {
      logger.warn(`Module not registered: ${name}`);
      return;
    }

    try {
      const instances = contextId
        ? [registration.instances.get(contextId)]
        : Array.from(registration.instances.values());

      for (const instance of instances) {
        if (instance) {
          await this.lifecycleManager.destroy(instance, name);
          logger.debug(`Module instance destroyed: ${name}`);
        }
      }

      // 清理缓存
      if (contextId) {
        registration.instances.delete(contextId);
        this.moduleContexts.delete(contextId);
      } else {
        registration.instances.clear();
        this.loadedModules.delete(name);

        // 清理所有相关上下文
        for (const [ctxId, ctx] of this.moduleContexts) {
          if (ctx.moduleName === name) {
            this.moduleContexts.delete(ctxId);
          }
        }
      }

      logger.info(`Module unloaded: ${name}`, { contextId });

    } catch (error) {
      logger.error(`Failed to unload module: ${name}`, {
        error: error.message,
        contextId
      });
      throw error;
    }
  }

  /**
   * 获取模块实例
   * @param {string} name - 模块名称
   * @param {string} contextId - 上下文ID
   * @returns {Object|null}
   */
  get(name, contextId = null) {
    const registration = this.modules.get(name);
    if (!registration) return null;

    if (registration.options.singleton) {
      return this.loadedModules.get(name) || null;
    }

    return contextId ? registration.instances.get(contextId) || null : null;
  }

  /**
   * 检查模块是否已加载
   * @param {string} name - 模块名称
   * @param {string} contextId - 上下文ID
   * @returns {boolean}
   */
  isLoaded(name, contextId = null) {
    const registration = this.modules.get(name);
    if (!registration) return false;

    if (registration.options.singleton) {
      return this.loadedModules.has(name);
    }

    return contextId ? registration.instances.has(contextId) : registration.instances.size > 0;
  }

  /**
   * 获取模块信息
   * @param {string} name - 模块名称
   * @returns {Object|null}
   */
  getModuleInfo(name) {
    const registration = this.modules.get(name);
    if (!registration) return null;

    return {
      name: registration.name,
      version: registration.options.version,
      dependencies: registration.options.dependencies,
      optionalDependencies: registration.options.optionalDependencies,
      singleton: registration.options.singleton,
      autoStart: registration.options.autoStart,
      instanceCount: registration.instances.size,
      loaded: this.isLoaded(name),
      registeredAt: registration.registeredAt,
      metadata: registration.options.metadata
    };
  }

  /**
   * 获取所有模块信息
   * @returns {Array<Object>}
   */
  getAllModules() {
    const modules = [];

    for (const [name] of this.modules) {
      const info = this.getModuleInfo(name);
      if (info) modules.push(info);
    }

    return modules;
  }

  /**
   * 发现模块
   * @param {string} path - 搜索路径
   * @param {Object} options - 发现选项
   * @returns {Promise<Array<Object>>}
   */
  async discover(path = this.options.modulePath, options = {}) {
    const {
      pattern = /\.js$/,
      recursive = true,
      exclude = []
    } = options;

    try {
      const fs = await import('fs/promises');
      const pathModule = await import('path');

      const modules = [];

      async function scanDir(dirPath) {
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
              const moduleInfo = await this._analyzeModuleFile(fullPath);
              if (moduleInfo) {
                modules.push(moduleInfo);
              }
            } catch (error) {
              logger.warn(`Failed to analyze module file: ${fullPath}`, {
                error: error.message
              });
            }
          }
        }
      }

      await scanDir(path);

      logger.info(`Module discovery completed`, {
        path,
        found: modules.length
      });

      return modules;

    } catch (error) {
      logger.error(`Module discovery failed`, {
        path,
        error: error.message
      });
      return [];
    }
  }

  /**
   * 获取系统统计信息
   * @returns {Object}
   */
  getStats() {
    const modulesByState = {
      registered: 0,
      loaded: 0,
      failed: 0
    };

    const instancesByType = {
      singleton: 0,
      multiInstance: 0
    };

    for (const [name, registration] of this.modules) {
      modulesByState.registered++;

      if (this.isLoaded(name)) {
        modulesByState.loaded++;
      }

      if (registration.options.singleton) {
        instancesByType.singleton++;
      } else {
        instancesByType.multiInstance += registration.instances.size;
      }
    }

    return {
      modules: modulesByState,
      instances: instancesByType,
      contexts: this.moduleContexts.size,
      loaders: this.loaders.size,
      options: this.options
    };
  }

  /**
   * 销毁模块系统
   */
  async destroy() {
    logger.info('Destroying module system...');

    // 停止所有模块
    for (const [name] of this.modules) {
      try {
        await this.unload(name);
      } catch (error) {
        logger.error(`Failed to unload module during shutdown: ${name}`, {
          error: error.message
        });
      }
    }

    // 清理资源
    await this.cleanupManager.cleanup();

    // 清空所有集合
    this.modules.clear();
    this.loadedModules.clear();
    this.moduleContexts.clear();
    this.dependencyGraph.clear();
    this.loaders.clear();

    logger.info('Module system destroyed');
  }

  /**
   * 验证模块类
   */
  _validateModuleClass(moduleClass, name) {
    if (typeof moduleClass !== 'function') {
      throw new Error(`Module ${name} must be a class or constructor function`);
    }

    // 检查是否实现了IModule接口的基本方法
    const requiredMethods = ['initialize', 'start', 'stop', 'destroy'];
    for (const method of requiredMethods) {
      if (typeof moduleClass.prototype[method] !== 'function') {
        throw new Error(`Module ${name} must implement ${method} method`);
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

    this.dependencyGraph.set(name, dependencies);

    // 检查循环依赖
    this._checkCircularDependencies(name, [name]);
  }

  /**
   * 检查循环依赖
   */
  _checkCircularDependencies(name, path) {
    const dependencies = this.dependencyGraph.get(name) || [];

    for (const dep of dependencies) {
      if (path.includes(dep)) {
        throw new Error(`Circular dependency detected: ${[...path, dep].join(' -> ')}`);
      }

      this._checkCircularDependencies(dep, [...path, dep]);
    }
  }

  /**
   * 检查依赖
   */
  async _checkDependencies(name, registration) {
    const missing = [];
    const failed = [];

    for (const dep of registration.options.dependencies) {
      if (!this.modules.has(dep)) {
        missing.push(dep);
      } else if (!this.isLoaded(dep)) {
        try {
          await this.load(dep);
        } catch (error) {
          failed.push({ name: dep, error: error.message });
        }
      }
    }

    // 检查可选依赖
    for (const dep of registration.options.optionalDependencies) {
      if (!this.modules.has(dep)) {
        logger.warn(`Optional dependency not available: ${dep} for module ${name}`);
      }
    }

    if (missing.length > 0) {
      throw new Error(`Missing required dependencies for ${name}: ${missing.join(', ')}`);
    }

    if (failed.length > 0) {
      throw new Error(`Failed to load dependencies for ${name}: ${failed.map(f => `${f.name} (${f.error})`).join(', ')}`);
    }
  }

  /**
   * 创建模块上下文
   */
  _createModuleContext(name, config, context) {
    return {
      id: `${name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      moduleName: name,
      config,
      parentContext: context,
      createdAt: Date.now(),
      system: this,
      logger: logger.child({ module: name }),
      dependencies: new Map()
    };
  }

  /**
   * 使用加载器加载模块
   */
  async _loadWithLoader(registration, context) {
    const loaderType = registration.options.loader || 'default';
    const loader = this.loaders.get(loaderType) || this.defaultLoader;

    try {
      const instance = await loader.load(registration, context);

      // 如果启用了沙箱，包装实例
      if (this.options.sandboxed) {
        return this._createSandboxProxy(instance, context);
      }

      return instance;

    } catch (error) {
      logger.error(`Module loader failed: ${loaderType} for ${registration.name}`, {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 创建默认加载器
   */
  _createDefaultLoader() {
    return {
      load: async (registration, context) => {
        const { moduleClass, options } = registration;

        // 合并配置
        const finalConfig = {
          ...options.configSchema,
          ...context.config
        };

        // 创建实例
        const instance = new moduleClass();

        // 设置上下文
        if (typeof instance.setContext === 'function') {
          instance.setContext(context);
        }

        return instance;
      }
    };
  }

  /**
   * 创建生命周期管理器
   */
  _createLifecycleManager() {
    return {
      initialize: async (instance, context) => {
        if (typeof instance.initialize === 'function') {
          await ErrorHandlerUtils.createErrorHandler(
            `module_init_${context.moduleName}`,
            { module: context.moduleName, contextId: context.id }
          )(async () => {
            await instance.initialize(context.config, context);
          });
        }

        if (typeof instance.start === 'function' && context.config.autoStart !== false) {
          await ErrorHandlerUtils.createErrorHandler(
            `module_start_${context.moduleName}`,
            { module: context.moduleName, contextId: context.id }
          )(async () => {
            await instance.start();
          });
        }
      },

      destroy: async (instance, name) => {
        if (typeof instance.stop === 'function') {
          await ErrorHandlerUtils.createErrorHandler(
            `module_stop_${name}`,
            { module: name }
          )(async () => {
            await instance.stop();
          });
        }

        if (typeof instance.destroy === 'function') {
          await ErrorHandlerUtils.createErrorHandler(
            `module_destroy_${name}`,
            { module: name }
          )(async () => {
            await instance.destroy();
          });
        }
      }
    };
  }

  /**
   * 创建沙箱代理
   */
  _createSandboxProxy(instance, context) {
    return new Proxy(instance, {
      get: (target, property) => {
        // 允许访问特定属性
        const allowedProperties = ['name', 'version', 'getHealthStatus', 'getStats'];

        if (allowedProperties.includes(property) || typeof target[property] === 'function') {
          return target[property];
        }

        // 记录访问
        logger.debug(`Sandbox access: ${context.moduleName}.${property}`);
        return target[property];
      },

      set: (target, property, value) => {
        // 限制属性设置
        logger.warn(`Sandbox property set blocked: ${context.moduleName}.${property}`);
        return false;
      }
    });
  }

  /**
   * 分析模块文件
   */
  async _analyzeModuleFile(filePath) {
    try {
      // 动态导入模块
      const module = await import(filePath);

      if (!module.default) {
        return null;
      }

      const moduleClass = module.default;
      const metadata = moduleClass.metadata || {};

      return {
        name: metadata.name || this._extractNameFromPath(filePath),
        version: metadata.version || '1.0.0',
        path: filePath,
        moduleClass,
        metadata
      };

    } catch (error) {
      logger.debug(`Failed to analyze module file: ${filePath}`, {
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
   * 拓扑排序
   */
  _topologicalSort(names) {
    const visited = new Set();
    const visiting = new Set();
    const result = [];

    const visit = (name) => {
      if (visited.has(name)) return;
      if (visiting.has(name)) {
        throw new Error(`Circular dependency detected involving ${name}`);
      }

      visiting.add(name);

      const dependencies = this.dependencyGraph.get(name) || [];
      for (const dep of dependencies) {
        if (names.includes(dep)) {
          visit(dep);
        }
      }

      visiting.delete(name);
      visited.add(name);
      result.push(name);
    };

    for (const name of names) {
      if (!visited.has(name)) {
        visit(name);
      }
    }

    return result;
  }
}
