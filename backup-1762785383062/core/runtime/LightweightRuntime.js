/**
 * 轻量级运行时
 * 提供按需加载、内存优化和快速启动功能
 */

import { logger } from '../../shared/utils/logger.js';
import { TimerManager } from '../../shared/utils/TimerManager.js';
import { MetricsCollectorUtils } from '../../shared/utils/MetricsCollectorUtils.js';
import { ResourceCleanupUtils } from '../../shared/utils/ResourceCleanupUtils.js';

export class LightweightRuntime {
  constructor(options = {}) {
    this.options = {
      enableLazyLoading: true,
      enableMemoryOptimization: true,
      enableStartupOptimization: true,
      gcInterval: 30000, // 30秒GC一次
      memoryThreshold: 100 * 1024 * 1024, // 100MB内存阈值
      maxConcurrentLoads: 5,
      preloadCritical: true,
      ...options
    };

    // 模块缓存
    this.moduleCache = new Map();
    this.loadingModules = new Set();

    // 资源管理
    this.resources = new Map();
    this.resourceUsage = new Map();

    // 按需加载队列
    this.loadQueue = [];
    this.loading = false;

    // 预加载列表
    this.preloadList = new Set();
    this.criticalModules = new Set();

    // 性能监控
    this.metrics = MetricsCollectorUtils.createMetricsCollector('runtime');
    this.timerManager = new TimerManager();

    // 内存优化
    this.memoryManager = this._createMemoryManager();

    // 清理管理器
    this.cleanupManager = ResourceCleanupUtils.createCleanupManager('runtime');

    // 初始化
    this._initialize();

    logger.info('Lightweight runtime initialized', {
      lazyLoading: this.options.enableLazyLoading,
      memoryOptimization: this.options.enableMemoryOptimization,
      startupOptimization: this.options.enableStartupOptimization
    });
  }

  /**
   * 异步导入模块（按需加载）
   * @param {string} modulePath - 模块路径
   * @param {Object} options - 加载选项
   * @returns {Promise<*>}
   */
  async importModule(modulePath, options = {}) {
    const {
      priority = 'normal',
      timeout = 10000,
      fallback = null,
      cache = this.options.enableLazyLoading
    } = options;

    // 检查缓存
    if (cache && this.moduleCache.has(modulePath)) {
      const cached = this.moduleCache.get(modulePath);
      if (this._isCacheValid(cached)) {
        this._recordModuleAccess(modulePath, 'cache_hit');
        return cached.module;
      } else {
        // 缓存过期，清理
        this.moduleCache.delete(modulePath);
      }
    }

    // 检查是否正在加载
    if (this.loadingModules.has(modulePath)) {
      return this._waitForLoading(modulePath);
    }

    // 添加到加载队列
    return this._enqueueLoad(modulePath, { priority, timeout, fallback, cache });
  }

  /**
   * 预加载模块
   * @param {string|string[]} modulePaths - 模块路径
   * @param {Object} options - 预加载选项
   */
  preloadModules(modulePaths, options = {}) {
    const paths = Array.isArray(modulePaths) ? modulePaths : [modulePaths];

    for (const path of paths) {
      this.preloadList.add({
        path,
        options: {
          priority: 'low',
          timeout: 5000,
          ...options
        },
        queuedAt: Date.now()
      });
    }

    // 如果启用了启动优化，开始预加载
    if (this.options.enableStartupOptimization && !this.loading) {
      this._startPreloading();
    }

    logger.debug(`Modules added to preload list: ${paths.length}`);
  }

  /**
   * 标记关键模块
   * @param {string|string[]} modulePaths - 关键模块路径
   */
  markCritical(modulePaths) {
    const paths = Array.isArray(modulePaths) ? modulePaths : [modulePaths];

    for (const path of paths) {
      this.criticalModules.add(path);
    }

    logger.debug(`Critical modules marked: ${paths.length}`);
  }

  /**
   * 获取模块信息
   * @param {string} modulePath - 模块路径
   * @returns {Object|null}
   */
  getModuleInfo(modulePath) {
    const cached = this.moduleCache.get(modulePath);
    if (!cached) return null;

    return {
      path: modulePath,
      loaded: true,
      cacheTime: cached.loadedAt,
      accessCount: cached.accessCount,
      lastAccess: cached.lastAccess,
      size: this._estimateModuleSize(cached.module)
    };
  }

  /**
   * 释放模块缓存
   * @param {string|string[]} modulePaths - 模块路径
   */
  releaseModules(modulePaths) {
    const paths = Array.isArray(modulePaths) ? modulePaths : [modulePaths];
    let released = 0;

    for (const path of paths) {
      if (this.moduleCache.has(path)) {
        this.moduleCache.delete(path);
        this._cleanupModuleResources(path);
        released++;
      }
    }

    if (released > 0) {
      logger.debug(`Released ${released} modules from cache`);
      this._triggerGC();
    }
  }

  /**
   * 优化内存使用
   * @param {Object} options - 优化选项
   */
  optimizeMemory(options = {}) {
    if (!this.options.enableMemoryOptimization) return;

    const { aggressive = false, targetUsage = 0.8 } = options;

    const stats = this.getMemoryStats();

    if (stats.usageRatio > targetUsage) {
      logger.info('Starting memory optimization', {
        currentUsage: stats.usageRatio,
        targetUsage,
        aggressive
      });

      // 清理过期缓存
      this._cleanupExpiredCache();

      // 如果激进模式，清理不常用的模块
      if (aggressive) {
        this._cleanupUnusedModules();
      }

      // 触发垃圾回收
      this._triggerGC();

      const newStats = this.getMemoryStats();
      logger.info('Memory optimization completed', {
        before: stats.usageRatio,
        after: newStats.usageRatio,
        freed: stats.heapUsed - newStats.heapUsed
      });
    }
  }

  /**
   * 获取内存统计信息
   * @returns {Object}
   */
  getMemoryStats() {
    const memUsage = process.memoryUsage();

    return {
      heapTotal: memUsage.heapTotal,
      heapUsed: memUsage.heapUsed,
      external: memUsage.external,
      rss: memUsage.rss,
      usageRatio: memUsage.heapUsed / memUsage.heapTotal,
      cacheSize: this.moduleCache.size,
      activeResources: this.resources.size,
      loadQueueLength: this.loadQueue.length
    };
  }

  /**
   * 获取运行时统计信息
   * @returns {Object}
   */
  getStats() {
    const memoryStats = this.getMemoryStats();
    const cacheStats = this._getCacheStats();

    return {
      memory: memoryStats,
      cache: cacheStats,
      performance: this.metrics.getStats(),
      modules: {
        cached: this.moduleCache.size,
        loading: this.loadingModules.size,
        preloadQueued: this.preloadList.size,
        critical: this.criticalModules.size
      },
      options: this.options
    };
  }

  /**
   * 销毁运行时
   */
  async destroy() {
    logger.info('Destroying lightweight runtime...');

    // 停止所有定时器
    this.timerManager.destroy();

    // 取消所有正在进行的加载
    this.loadQueue = [];
    this.loadingModules.clear();

    // 清理所有缓存
    for (const [path] of this.moduleCache) {
      this._cleanupModuleResources(path);
    }
    this.moduleCache.clear();

    // 清理所有资源
    await this._cleanupAllResources();

    // 清理管理器
    await this.cleanupManager.cleanup();

    logger.info('Lightweight runtime destroyed');
  }

  /**
   * 初始化运行时
   */
  _initialize() {
    // 启动内存监控
    if (this.options.enableMemoryOptimization) {
      this.timerManager.setInterval(() => {
        this.optimizeMemory({ targetUsage: 0.9 });
      }, this.options.gcInterval);

      this.timerManager.setInterval(() => {
        this._monitorMemoryUsage();
      }, 60000); // 每分钟检查一次
    }

    // 预加载关键模块
    if (this.options.preloadCritical) {
      setTimeout(() => this._preloadCriticalModules(), 100);
    }
  }

  /**
   * 创建内存管理器
   */
  _createMemoryManager() {
    return {
      // 内存压力检测
      getPressure: () => {
        const mem = process.memoryUsage();
        const ratio = mem.heapUsed / mem.heapTotal;

        if (ratio > 0.9) return 'critical';
        if (ratio > 0.8) return 'high';
        if (ratio > 0.7) return 'medium';
        return 'low';
      },

      // 建议的清理策略
      getCleanupStrategy: (pressure) => {
        switch (pressure) {
          case 'critical':
            return { cleanupExpired: true, cleanupUnused: true, gc: true };
          case 'high':
            return { cleanupExpired: true, cleanupUnused: false, gc: true };
          case 'medium':
            return { cleanupExpired: true, cleanupUnused: false, gc: false };
          default:
            return { cleanupExpired: false, cleanupUnused: false, gc: false };
        }
      }
    };
  }

  /**
   * 入队加载任务
   */
  async _enqueueLoad(modulePath, options) {
    return new Promise((resolve, reject) => {
      this.loadQueue.push({
        modulePath,
        options,
        resolve,
        reject,
        queuedAt: Date.now()
      });

      // 按优先级排序
      this._sortLoadQueue();

      // 开始处理队列
      if (!this.loading) {
        this._processLoadQueue();
      }
    });
  }

  /**
   * 处理加载队列
   */
  async _processLoadQueue() {
    if (this.loading || this.loadQueue.length === 0) return;

    this.loading = true;

    try {
      const concurrentLimit = this.options.maxConcurrentLoads;
      const promises = [];

      for (let i = 0; i < Math.min(concurrentLimit, this.loadQueue.length); i++) {
        const task = this.loadQueue.shift();
        if (task) {
          promises.push(this._loadModule(task));
        }
      }

      await Promise.allSettled(promises);

      // 继续处理剩余任务
      if (this.loadQueue.length > 0) {
        setTimeout(() => this._processLoadQueue(), 0);
      }

    } finally {
      this.loading = false;
    }
  }

  /**
   * 加载单个模块
   */
  async _loadModule(task) {
    const { modulePath, options, resolve, reject } = task;
    const startTime = Date.now();

    try {
      this.loadingModules.add(modulePath);
      this._recordModuleAccess(modulePath, 'load_start');

      // 创建超时控制器
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, options.timeout);

      // 执行加载
      const module = await this._performModuleLoad(modulePath, controller.signal);

      clearTimeout(timeoutId);

      // 缓存模块
      if (options.cache) {
        this.moduleCache.set(modulePath, {
          module,
          loadedAt: Date.now(),
          accessCount: 0,
          lastAccess: Date.now(),
          size: this._estimateModuleSize(module)
        });
      }

      // 记录成功
      this._recordModuleAccess(modulePath, 'load_success', Date.now() - startTime);

      resolve(module);

    } catch (error) {
      this._recordModuleAccess(modulePath, 'load_failed', Date.now() - startTime);

      // 尝试使用fallback
      if (options.fallback && error.name !== 'AbortError') {
        try {
          logger.warn(`Module load failed, using fallback for: ${modulePath}`, {
            error: error.message
          });
          resolve(options.fallback);
          return;
        } catch (fallbackError) {
          logger.error(`Fallback also failed for: ${modulePath}`, {
            fallbackError: fallbackError.message
          });
        }
      }

      reject(error);

    } finally {
      this.loadingModules.delete(modulePath);
    }
  }

  /**
   * 执行模块加载
   */
  async _performModuleLoad(modulePath, signal) {
    // 检查是否为Node.js内置模块
    if (this._isBuiltInModule(modulePath)) {
      return require(modulePath);
    }

    // 检查是否为ES模块
    if (modulePath.endsWith('.mjs') || modulePath.startsWith('file://')) {
      return await import(modulePath);
    }

    // 尝试ES模块导入
    try {
      return await import(modulePath);
    } catch (esError) {
      // 如果ES模块失败，尝试CommonJS
      try {
        return require(modulePath);
      } catch (cjsError) {
        // 如果都失败，尝试动态导入
        return await this._dynamicImport(modulePath, signal);
      }
    }
  }

  /**
   * 动态导入模块
   */
  async _dynamicImport(modulePath, signal) {
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        signal.removeEventListener('abort', abortHandler);
      };

      const abortHandler = () => {
        cleanup();
        reject(new Error('Module load aborted'));
      };

      signal.addEventListener('abort', abortHandler);

      try {
        const module = require(modulePath);
        cleanup();
        resolve(module);
      } catch (error) {
        cleanup();
        reject(error);
      }
    });
  }

  /**
   * 等待模块加载完成
   */
  async _waitForLoading(modulePath) {
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        if (!this.loadingModules.has(modulePath)) {
          clearInterval(checkInterval);

          const cached = this.moduleCache.get(modulePath);
          if (cached) {
            resolve(cached.module);
          } else {
            reject(new Error(`Module failed to load: ${modulePath}`));
          }
        }
      }, 10);

      // 超时保护
      setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error(`Timeout waiting for module: ${modulePath}`));
      }, 30000);
    });
  }

  /**
   * 排序加载队列
   */
  _sortLoadQueue() {
    const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };

    this.loadQueue.sort((a, b) => {
      const aPriority = priorityOrder[a.options.priority] || 2;
      const bPriority = priorityOrder[b.options.priority] || 2;

      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }

      // 相同优先级时，FIFO
      return a.queuedAt - b.queuedAt;
    });
  }

  /**
   * 预加载关键模块
   */
  async _preloadCriticalModules() {
    const criticalPaths = Array.from(this.criticalModules);

    if (criticalPaths.length === 0) return;

    logger.info(`Preloading ${criticalPaths.length} critical modules`);

    const promises = criticalPaths.map(path =>
      this.importModule(path, { priority: 'critical', timeout: 10000 })
        .catch(error => {
          logger.warn(`Failed to preload critical module: ${path}`, {
            error: error.message
          });
        })
    );

    await Promise.allSettled(promises);
    logger.info('Critical modules preloaded');
  }

  /**
   * 开始预加载
   */
  async _startPreloading() {
    if (this.preloadList.size === 0) return;

    const preloadTasks = Array.from(this.preloadList);
    this.preloadList.clear();

    logger.debug(`Starting preload of ${preloadTasks.length} modules`);

    const promises = preloadTasks.map(({ path, options }) =>
      this.importModule(path, options).catch(error => {
        logger.debug(`Preload failed for: ${path}`, {
          error: error.message
        });
      })
    );

    await Promise.allSettled(promises);
    logger.debug('Preload completed');
  }

  /**
   * 监控内存使用
   */
  _monitorMemoryUsage() {
    const stats = this.getMemoryStats();
    const pressure = this.memoryManager.getPressure();

    if (pressure !== 'low') {
      logger.info('Memory pressure detected', {
        pressure,
        usageRatio: stats.usageRatio,
        heapUsed: stats.heapUsed
      });

      this.metrics.record('memory_pressure', pressure);
    }

    // 记录内存指标
    this.metrics.record('heap_used', stats.heapUsed);
    this.metrics.record('heap_total', stats.heapTotal);
  }

  /**
   * 清理过期缓存
   */
  _cleanupExpiredCache() {
    const now = Date.now();
    const expiredPaths = [];

    for (const [path, cached] of this.moduleCache) {
      // 超过5分钟未访问的模块
      if (now - cached.lastAccess > 5 * 60 * 1000) {
        expiredPaths.push(path);
      }
    }

    for (const path of expiredPaths) {
      this.releaseModules(path);
    }

    if (expiredPaths.length > 0) {
      logger.debug(`Cleaned up ${expiredPaths.length} expired cache entries`);
    }
  }

  /**
   * 清理不常用模块
   */
  _cleanupUnusedModules() {
    const entries = Array.from(this.moduleCache.entries());

    // 按访问频率排序
    entries.sort(([, a], [, b]) => a.accessCount - b.accessCount);

    // 清理访问次数最少的20%
    const toCleanup = Math.floor(entries.length * 0.2);

    for (let i = 0; i < toCleanup; i++) {
      const [path] = entries[i];
      this.releaseModules(path);
    }

    if (toCleanup > 0) {
      logger.debug(`Cleaned up ${toCleanup} least-used modules`);
    }
  }

  /**
   * 触发垃圾回收
   */
  _triggerGC() {
    if (global.gc) {
      global.gc();
      logger.debug('Manual garbage collection triggered');
    }
  }

  /**
   * 记录模块访问
   */
  _recordModuleAccess(modulePath, action, duration = null) {
    this.metrics.record(`module_${action}`, 1);

    if (duration !== null) {
      this.metrics.record('module_load_duration', duration);
    }

    // 更新缓存访问信息
    const cached = this.moduleCache.get(modulePath);
    if (cached) {
      cached.accessCount++;
      cached.lastAccess = Date.now();
    }
  }

  /**
   * 检查缓存是否有效
   */
  _isCacheValid(cached) {
    // 缓存有效期：10分钟
    return Date.now() - cached.loadedAt < 10 * 60 * 1000;
  }

  /**
   * 估算模块大小
   */
  _estimateModuleSize(module) {
    try {
      const serialized = JSON.stringify(module);
      return Buffer.byteLength(serialized, 'utf8');
    } catch {
      return 0;
    }
  }

  /**
   * 清理模块资源
   */
  _cleanupModuleResources(modulePath) {
    // 清理相关资源
    const resourceKey = `module_${modulePath}`;
    if (this.resources.has(resourceKey)) {
      const resource = this.resources.get(resourceKey);
      if (typeof resource.cleanup === 'function') {
        resource.cleanup();
      }
      this.resources.delete(resourceKey);
    }
  }

  /**
   * 清理所有资源
   */
  async _cleanupAllResources() {
    for (const [key, resource] of this.resources) {
      try {
        if (typeof resource.cleanup === 'function') {
          await resource.cleanup();
        }
      } catch (error) {
        logger.warn(`Failed to cleanup resource: ${key}`, {
          error: error.message
        });
      }
    }
    this.resources.clear();
  }

  /**
   * 获取缓存统计信息
   */
  _getCacheStats() {
    let totalSize = 0;
    let totalAccessCount = 0;
    let oldestCache = Date.now();
    let newestCache = 0;

    for (const cached of this.moduleCache.values()) {
      totalSize += cached.size;
      totalAccessCount += cached.accessCount;
      oldestCache = Math.min(oldestCache, cached.loadedAt);
      newestCache = Math.max(newestCache, cached.loadedAt);
    }

    return {
      totalModules: this.moduleCache.size,
      totalSize,
      averageSize: this.moduleCache.size > 0 ? totalSize / this.moduleCache.size : 0,
      totalAccessCount,
      averageAccessCount: this.moduleCache.size > 0 ? totalAccessCount / this.moduleCache.size : 0,
      cacheAge: newestCache - oldestCache
    };
  }

  /**
   * 检查是否为内置模块
   */
  _isBuiltInModule(modulePath) {
    return modulePath.startsWith('node:') ||
           ['fs', 'path', 'os', 'crypto', 'http', 'https', 'url', 'util', 'events'].includes(modulePath);
  }
}
