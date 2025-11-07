/**
 * WokeFlow - 资源清理器
 * 管理系统中各种资源的注册、跟踪和清理
 */

import { logger } from '../../utils/logger.js';

export class ResourceCleaner {
  constructor() {
    this.resources = new Map();
    this.resourceTypes = new Map();
    this.cleanupOrder = [
      'timers',
      'intervals',
      'streams',
      'file_handles',
      'connections',
      'pools',
      'servers',
      'listeners',
    ];
  }

  /**
   * 注册资源类型
   * @param {string} type - 资源类型
   * @param {object} config - 类型配置
   */
  registerResourceType(type, config) {
    this.resourceTypes.set(type, {
      type,
      cleaner: config.cleaner,
      validator: config.validator || (() => true),
      priority: config.priority || 100,
      description: config.description || type,
    });

    logger.debug('资源类型已注册', { type, priority: config.priority });
  }

  /**
   * 注册资源实例
   * @param {string} id - 资源ID
   * @param {string} type - 资源类型
   * @param {any} instance - 资源实例
   * @param {object} metadata - 元数据
   */
  register(id, type, instance, metadata = {}) {
    if (!this.resourceTypes.has(type)) {
      throw new Error(`未知的资源类型: ${type}`);
    }

    const typeConfig = this.resourceTypes.get(type);

    // 验证资源实例
    if (!typeConfig.validator(instance)) {
      throw new Error(`资源实例验证失败: ${id}`);
    }

    this.resources.set(id, {
      id,
      type,
      instance,
      metadata: {
        registeredAt: Date.now(),
        ...metadata,
      },
      typeConfig,
    });

    logger.debug('资源实例已注册', { id, type });
  }

  /**
   * 注销资源实例
   * @param {string} id - 资源ID
   */
  unregister(id) {
    if (this.resources.has(id)) {
      this.resources.delete(id);
      logger.debug('资源实例已注销', { id });
    }
  }

  /**
   * 获取资源实例
   * @param {string} id - 资源ID
   */
  get(id) {
    return this.resources.get(id);
  }

  /**
   * 列出所有资源
   * @param {string} type - 可选的资源类型过滤
   */
  list(type = null) {
    const resources = Array.from(this.resources.values());
    return type ? resources.filter((r) => r.type === type) : resources;
  }

  /**
   * 清理单个资源
   * @param {string} id - 资源ID
   */
  async cleanupResource(id) {
    const resource = this.resources.get(id);
    if (!resource) {
      logger.warn('尝试清理不存在的资源', { id });
      return false;
    }

    try {
      const { typeConfig, instance } = resource;
      await typeConfig.cleaner(instance);
      this.unregister(id);
      logger.debug('资源清理成功', { id, type: resource.type });
      return true;
    } catch (error) {
      logger.error('资源清理失败', {
        id,
        type: resource.type,
        error: error.message,
      });
      return false;
    }
  }

  /**
   * 清理指定类型的资源
   * @param {string} type - 资源类型
   */
  async cleanupByType(type) {
    const resources = this.list(type);
    const results = [];

    for (const resource of resources) {
      const success = await this.cleanupResource(resource.id);
      results.push({ id: resource.id, success });
    }

    logger.info('按类型清理完成', {
      type,
      total: results.length,
      successful: results.filter((r) => r.success).length,
    });
    return results;
  }

  /**
   * 清理所有资源
   */
  async cleanupAll() {
    logger.info('开始清理所有资源', { totalResources: this.resources.size });

    const results = {
      total: this.resources.size,
      successful: 0,
      failed: 0,
      byType: {},
      byPhase: {},
    };

    // 按清理顺序分组资源
    const resourcesByPhase = this._groupResourcesByCleanupOrder();

    // 分阶段清理
    for (const phase of this.cleanupOrder) {
      const phaseResources = resourcesByPhase[phase] || [];
      if (phaseResources.length === 0) continue;

      logger.debug(`清理阶段: ${phase}`, { count: phaseResources.length });

      const phaseResults = await this._cleanupPhase(phaseResources);
      results.byPhase[phase] = phaseResults;

      results.successful += phaseResults.successful;
      results.failed += phaseResults.failed;
    }

    // 清理剩余资源（未分类的）
    const remainingResources = Array.from(this.resources.values());
    if (remainingResources.length > 0) {
      logger.debug('清理剩余资源', { count: remainingResources.length });
      const remainingResults = await this._cleanupPhase(remainingResources);
      results.byPhase.remaining = remainingResults;

      results.successful += remainingResults.successful;
      results.failed += remainingResults.failed;
    }

    // 按类型统计
    for (const [type, typeResources] of this._groupResourcesByType()) {
      results.byType[type] = {
        total: typeResources.length,
        cleaned: typeResources.filter((r) => !this.resources.has(r.id)).length,
      };
    }

    logger.info('所有资源清理完成', {
      total: results.total,
      successful: results.successful,
      failed: results.failed,
    });

    return results;
  }

  /**
   * 按清理顺序分组资源
   */
  _groupResourcesByCleanupOrder() {
    const groups = {};
    const resources = Array.from(this.resources.values());

    for (const resource of resources) {
      const phase = this._getCleanupPhase(resource.type);
      if (!groups[phase]) {
        groups[phase] = [];
      }
      groups[phase].push(resource);
    }

    return groups;
  }

  /**
   * 按类型分组资源
   */
  _groupResourcesByType() {
    const groups = new Map();
    const resources = Array.from(this.resources.values());

    for (const resource of resources) {
      if (!groups.has(resource.type)) {
        groups.set(resource.type, []);
      }
      groups.get(resource.type).push(resource);
    }

    return groups;
  }

  /**
   * 获取资源类型的清理阶段
   */
  _getCleanupPhase(type) {
    // 基于资源类型确定清理顺序
    const phaseMapping = {
      timers: 'timers',
      intervals: 'timers',
      streams: 'streams',
      file_handles: 'file_handles',
      connections: 'connections',
      pools: 'pools',
      servers: 'servers',
      listeners: 'listeners',
    };

    return phaseMapping[type] || 'other';
  }

  /**
   * 清理单个阶段的资源
   */
  async _cleanupPhase(resources) {
    const results = {
      total: resources.length,
      successful: 0,
      failed: 0,
      details: [],
    };

    // 并行清理资源
    const cleanupPromises = resources.map(async (resource) => {
      try {
        await resource.typeConfig.cleaner(resource.instance);
        this.unregister(resource.id);
        results.successful++;
        results.details.push({ id: resource.id, success: true });
        return true;
      } catch (error) {
        results.failed++;
        results.details.push({
          id: resource.id,
          success: false,
          error: error.message,
        });
        logger.error('阶段资源清理失败', {
          id: resource.id,
          type: resource.type,
          error: error.message,
        });
        return false;
      }
    });

    await Promise.allSettled(cleanupPromises);

    return results;
  }

  /**
   * 初始化预定义资源类型
   */
  initializePresetTypes() {
    // 定时器资源
    this.registerResourceType('timers', {
      cleaner: async (timers) => {
        for (const timer of timers) {
          if (typeof timer === 'number') {
            clearTimeout(timer);
          } else if (timer.clearTimeout) {
            clearTimeout(timer);
          }
        }
      },
      validator: (timers) => Array.isArray(timers),
      priority: 10,
      description: '定时器资源',
    });

    // 间隔定时器资源
    this.registerResourceType('intervals', {
      cleaner: async (intervals) => {
        for (const interval of intervals) {
          if (typeof interval === 'number') {
            clearInterval(interval);
          } else if (interval.clearInterval) {
            clearInterval(interval);
          }
        }
      },
      validator: (intervals) => Array.isArray(intervals),
      priority: 10,
      description: '间隔定时器资源',
    });

    // 流资源
    this.registerResourceType('streams', {
      cleaner: async (stream) => {
        return new Promise((resolve) => {
          if (stream.destroy) {
            stream.destroy();
            resolve();
          } else if (stream.close) {
            stream.close(resolve);
          } else {
            resolve();
          }
        });
      },
      validator: (stream) =>
        stream && (stream.pipe || stream.readable || stream.writable),
      priority: 50,
      description: '流资源',
    });

    // 文件句柄资源
    this.registerResourceType('file_handles', {
      cleaner: async (handle) => {
        return new Promise((resolve) => {
          if (handle.close) {
            handle.close(resolve);
          } else {
            resolve();
          }
        });
      },
      validator: (handle) => handle && typeof handle.close === 'function',
      priority: 40,
      description: '文件句柄资源',
    });

    // 连接资源
    this.registerResourceType('connections', {
      cleaner: async (connection) => {
        if (connection.end) {
          await connection.end();
        } else if (connection.close) {
          await connection.close();
        } else if (connection.destroy) {
          connection.destroy();
        }
      },
      validator: (connection) =>
        connection &&
        (connection.end || connection.close || connection.destroy),
      priority: 30,
      description: '连接资源',
    });

    // 连接池资源
    this.registerResourceType('pools', {
      cleaner: async (pool) => {
        if (pool.end) {
          await pool.end();
        } else if (pool.close) {
          await pool.close();
        } else if (pool.destroy) {
          pool.destroy();
        }
      },
      validator: (pool) => pool && (pool.end || pool.close || pool.destroy),
      priority: 25,
      description: '连接池资源',
    });

    // 服务器资源
    this.registerResourceType('servers', {
      cleaner: async (server) => {
        return new Promise((resolve) => {
          server.close((err) => {
            if (err) {
              logger.error('服务器关闭失败', err);
            }
            resolve();
          });
        });
      },
      validator: (server) => server && typeof server.close === 'function',
      priority: 20,
      description: '服务器资源',
    });

    // 事件监听器资源
    this.registerResourceType('listeners', {
      cleaner: async (listener) => {
        if (listener.removeAllListeners) {
          listener.removeAllListeners();
        }
      },
      validator: (listener) =>
        listener && typeof listener.removeAllListeners === 'function',
      priority: 60,
      description: '事件监听器资源',
    });

    logger.info('预定义资源类型已初始化');
  }

  /**
   * 获取资源统计信息
   */
  getStats() {
    const resources = Array.from(this.resources.values());
    const stats = {
      total: resources.length,
      byType: {},
      oldestResource: null,
      newestResource: null,
    };

    for (const resource of resources) {
      // 按类型统计
      if (!stats.byType[resource.type]) {
        stats.byType[resource.type] = 0;
      }
      stats.byType[resource.type]++;

      // 查找最老和最新的资源
      const registeredAt = resource.metadata.registeredAt;
      if (
        !stats.oldestResource ||
        registeredAt < stats.oldestResource.metadata.registeredAt
      ) {
        stats.oldestResource = resource;
      }
      if (
        !stats.newestResource ||
        registeredAt > stats.newestResource.metadata.registeredAt
      ) {
        stats.newestResource = resource;
      }
    }

    return stats;
  }

  /**
   * 创建作用域资源管理器
   * @param {string} scopeId - 作用域ID
   */
  createScope(scopeId) {
    return new ResourceScope(this, scopeId);
  }
}

/**
 * 资源作用域管理器
 * 用于管理特定作用域内的资源
 */
export class ResourceScope {
  constructor(resourceCleaner, scopeId) {
    this.resourceCleaner = resourceCleaner;
    this.scopeId = scopeId;
    this.resources = new Set();
  }

  /**
   * 在作用域内注册资源
   */
  register(id, type, instance, metadata = {}) {
    const scopedId = `${this.scopeId}:${id}`;
    this.resourceCleaner.register(scopedId, type, instance, {
      ...metadata,
      scope: this.scopeId,
    });
    this.resources.add(scopedId);
  }

  /**
   * 清理作用域内的所有资源
   */
  async cleanup() {
    const results = [];

    for (const resourceId of this.resources) {
      const success = await this.resourceCleaner.cleanupResource(resourceId);
      results.push({ id: resourceId, success });
      this.resources.delete(resourceId);
    }

    logger.debug('作用域资源清理完成', {
      scopeId: this.scopeId,
      cleaned: results.length,
    });
    return results;
  }

  /**
   * 获取作用域内的资源列表
   */
  list() {
    return Array.from(this.resources)
      .map((id) => this.resourceCleaner.get(id))
      .filter(Boolean);
  }
}
