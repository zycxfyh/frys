/**
 * 通用对象池
 * 适用于任何类型的对象的池化管理
 */

import { AbstractResourcePool } from './AbstractResourcePool.js';
import { logger } from '../../utils/logger.js';

export class GenericObjectPool extends AbstractResourcePool {
  constructor(factory, options = {}) {
    super(options);

    if (!factory || typeof factory.create !== 'function') {
      throw new Error('Factory must have a create method');
    }

    this.factory = {
      create: factory.create,
      destroy: factory.destroy || (() => Promise.resolve()),
      validate: factory.validate || (() => Promise.resolve(true)),
      reset: factory.reset || (() => Promise.resolve()),
      ...factory,
    };

    this.objectType = factory.objectType || 'generic_object';
  }

  getResourceType() {
    return this.objectType;
  }

  async _createResource() {
    try {
      const object = await this.factory.create();

      // 为对象添加池化元数据
      object._poolMetadata = {
        createdAt: Date.now(),
        lastUsed: Date.now(),
        useCount: 0,
        poolId: Math.random().toString(36).substr(2, 9),
      };

      logger.debug('创建对象', {
        type: this.objectType,
        poolId: object._poolMetadata.poolId,
      });

      return object;
    } catch (error) {
      logger.error('创建对象失败', {
        type: this.objectType,
        error: error.message,
      });
      throw error;
    }
  }

  async _destroyResource(object) {
    try {
      if (this.factory.destroy) {
        await this.factory.destroy(object);
      }

      const metadata = object._poolMetadata;
      logger.debug('销毁对象', {
        type: this.objectType,
        poolId: metadata?.poolId,
        useCount: metadata?.useCount,
        lifetime: metadata ? Date.now() - metadata.createdAt : 0,
      });
    } catch (error) {
      logger.error('销毁对象失败', {
        type: this.objectType,
        error: error.message,
      });
    }
  }

  async _validateResource(object) {
    try {
      if (this.factory.validate) {
        return await this.factory.validate(object);
      }

      // 默认验证：检查对象是否仍然有效
      return object && typeof object === 'object';
    } catch (error) {
      logger.error('验证对象失败', {
        type: this.objectType,
        error: error.message,
      });
      return false;
    }
  }

  /**
   * 重置对象状态（在归还池之前调用）
   */
  async resetResource(object) {
    try {
      if (this.factory.reset) {
        await this.factory.reset(object);
      }

      // 更新元数据
      if (object._poolMetadata) {
        object._poolMetadata.lastUsed = Date.now();
      }

      return object;
    } catch (error) {
      logger.error('重置对象失败', {
        type: this.objectType,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * 使用对象（自动借用、重置和归还）
   */
  async use(callback, options = {}) {
    const resource = await this.borrow();

    try {
      // 重置对象状态
      await this.resetResource(resource);

      // 更新使用计数
      if (resource._poolMetadata) {
        resource._poolMetadata.useCount++;
      }

      // 执行回调
      const result = await callback(resource);

      // 如果指定了重置选项，在使用后重置
      if (options.resetAfterUse) {
        await this.resetResource(resource);
      }

      return result;
    } finally {
      await this.return(resource);
    }
  }

  /**
   * 获取池中对象的统计信息
   */
  getObjectStats() {
    const stats = this.getStats();
    const objectStats = {
      totalCreated: 0,
      totalUseCount: 0,
      avgLifetime: 0,
      avgUseCount: 0,
    };

    // 统计所有对象的元数据
    const allObjects = [...this.resources, ...Array.from(this.borrowed.keys())];
    let totalLifetime = 0;
    let validObjects = 0;

    for (const obj of allObjects) {
      if (obj._poolMetadata) {
        objectStats.totalCreated++;
        objectStats.totalUseCount += obj._poolMetadata.useCount || 0;
        totalLifetime += Date.now() - obj._poolMetadata.createdAt;
        validObjects++;
      }
    }

    if (validObjects > 0) {
      objectStats.avgLifetime = totalLifetime / validObjects;
      objectStats.avgUseCount = objectStats.totalUseCount / validObjects;
    }

    return {
      ...stats,
      objects: objectStats,
    };
  }
}

/**
 * 预定义的工厂函数
 */
export const ObjectPoolFactories = {
  /**
   * Buffer池工厂
   */
  buffer: (size = 1024) => ({
    objectType: 'buffer',
    create: () => Promise.resolve(Buffer.alloc(size)),
    destroy: (buffer) => Promise.resolve(),
    validate: (buffer) =>
      Promise.resolve(Buffer.isBuffer(buffer) && buffer.length === size),
    reset: (buffer) => {
      buffer.fill(0);
      return Promise.resolve();
    },
  }),

  /**
   * 数组池工厂
   */
  array: (initialSize = 10) => ({
    objectType: 'array',
    create: () => Promise.resolve(new Array(initialSize)),
    destroy: (array) => Promise.resolve(),
    validate: (array) => Promise.resolve(Array.isArray(array)),
    reset: (array) => {
      array.length = 0;
      return Promise.resolve();
    },
  }),

  /**
   * Map池工厂
   */
  map: () => ({
    objectType: 'map',
    create: () => Promise.resolve(new Map()),
    destroy: (map) => Promise.resolve(),
    validate: (map) => Promise.resolve(map instanceof Map),
    reset: (map) => {
      map.clear();
      return Promise.resolve();
    },
  }),

  /**
   * Set池工厂
   */
  set: () => ({
    objectType: 'set',
    create: () => Promise.resolve(new Set()),
    destroy: (set) => Promise.resolve(),
    validate: (set) => Promise.resolve(set instanceof Set),
    reset: (set) => {
      set.clear();
      return Promise.resolve();
    },
  }),

  /**
   * 自定义对象池工厂
   */
  custom: (createFn, destroyFn = null, validateFn = null, resetFn = null) => ({
    objectType: 'custom',
    create: createFn,
    destroy: destroyFn,
    validate: validateFn,
    reset: resetFn,
  }),
};
