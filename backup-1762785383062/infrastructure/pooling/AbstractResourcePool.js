/**
 * 抽象资源池
 * 提供通用的资源池化功能和生命周期管理
 */

import { logger } from '../../shared/utils/logger.js';

export class AbstractResourcePool {
  constructor(options = {}) {
    this.options = {
      min: options.min || 1, // 最小资源数
      max: options.max || 10, // 最大资源数
      idleTimeoutMillis: options.idleTimeoutMillis || 30000, // 空闲超时
      acquireTimeoutMillis: options.acquireTimeoutMillis || 60000, // 获取超时
      evictionRunIntervalMillis: options.evictionRunIntervalMillis || 10000, // 驱逐检查间隔
      softIdleTimeoutMillis: options.softIdleTimeoutMillis || 20000, // 软空闲超时
      numTestsPerEvictionRun: options.numTestsPerEvictionRun || 3, // 每次驱逐检查的测试数
      testOnBorrow: options.testOnBorrow !== false, // 获取时测试
      testOnReturn: options.testOnReturn !== false, // 返回时测试
      testOnIdle: options.testOnIdle !== false, // 空闲时测试
      lifo: options.lifo !== false, // 后进先出
      fairness: options.fairness !== false, // 公平性
      ...options,
    };

    this.resources = []; // 可用资源队列
    this.borrowed = new Map(); // 已借出资源映射 (resource -> {borrowTime, lastAccessTime})
    this.waitingQueue = []; // 等待队列

    this.stats = {
      created: 0, // 已创建资源总数
      borrowed: 0, // 已借出资源数
      returned: 0, // 已归还资源数
      destroyed: 0, // 已销毁资源数
      failedBorrows: 0, // 失败的借用次数
      failedReturns: 0, // 失败的归还次数
      timedOutBorrows: 0, // 超时的借用次数
      idleEvictions: 0, // 空闲驱逐次数
      invalidResources: 0, // 无效资源次数
    };

    this.isDestroyed = false;
    this.evictionTimer = null;
    this.drainPromise = null;
  }

  /**
   * 初始化资源池
   */
  async initialize() {
    if (this.isDestroyed) {
      throw new Error('Resource pool has been destroyed');
    }

    logger.info(`初始化资源池`, {
      min: this.options.min,
      max: this.options.max,
      resourceType: this.getResourceType(),
    });

    // 预创建最小数量的资源
    await this._ensureMinIdle();

    // 启动驱逐定时器
    this._startEvictionTimer();

    return this;
  }

  /**
   * 借用资源
   */
  async borrow() {
    if (this.isDestroyed) {
      throw new Error('Resource pool has been destroyed');
    }

    return new Promise(async (resolve, reject) => {
      const borrowRequest = { resolve, reject, timeoutId: null };

      // 设置获取超时
      if (this.options.acquireTimeoutMillis > 0) {
        borrowRequest.timeoutId = setTimeout(() => {
          this._removeFromWaitingQueue(borrowRequest);
          this.stats.timedOutBorrows++;
          reject(
            new Error(
              `Resource acquisition timed out after ${this.options.acquireTimeoutMillis}ms`,
            ),
          );
        }, this.options.acquireTimeoutMillis);
      }

      // 尝试立即获取资源
      const resource = await this._tryAcquireResource();
      if (resource) {
        clearTimeout(borrowRequest.timeoutId);
        this._recordBorrow(resource);
        resolve(resource);
        return;
      }

      // 如果没有可用资源，加入等待队列
      this.waitingQueue.push(borrowRequest);

      // 如果可以创建新资源，尝试创建
      if (this._canCreateResource()) {
        this._createResourceForWaitingBorrower();
      }
    });
  }

  /**
   * 归还资源
   */
  async return(resource) {
    if (this.isDestroyed) {
      await this._destroyResource(resource);
      return;
    }

    try {
      // 验证资源
      if (
        this.options.testOnReturn &&
        !(await this._validateResource(resource))
      ) {
        this.stats.invalidResources++;
        await this._destroyResource(resource);
        this.stats.destroyed++;
        return;
      }

      // 检查等待队列
      if (this.waitingQueue.length > 0) {
        const waitingBorrower = this.waitingQueue.shift();
        clearTimeout(waitingBorrower.timeoutId);
        this._recordBorrow(resource);
        waitingBorrower.resolve(resource);
        return;
      }

      // 放回资源池
      this.resources.push(resource);
      this.stats.returned++;

      // 记录归还
      this.borrowed.delete(resource);
    } catch (error) {
      this.stats.failedReturns++;
      logger.error('资源归还失败', {
        error: error.message,
        resourceType: this.getResourceType(),
      });
      await this._destroyResource(resource);
    }
  }

  /**
   * 销毁资源池
   */
  async destroy() {
    if (this.isDestroyed) {
      return;
    }

    logger.info('销毁资源池', {
      resourceType: this.getResourceType(),
      activeResources: this.borrowed.size,
      idleResources: this.resources.length,
      waitingRequests: this.waitingQueue.length,
    });

    this.isDestroyed = true;

    // 停止驱逐定时器
    if (this.evictionTimer) {
      clearInterval(this.evictionTimer);
      this.evictionTimer = null;
    }

    // 取消所有等待的借用请求
    this.waitingQueue.forEach((request) => {
      clearTimeout(request.timeoutId);
      request.reject(new Error('Resource pool is being destroyed'));
    });
    this.waitingQueue = [];

    // 销毁所有资源
    const destroyPromises = [
      ...Array.from(this.borrowed.keys()),
      ...this.resources,
    ].map((resource) => this._destroyResource(resource));

    await Promise.allSettled(destroyPromises);
    this.resources = [];
    this.borrowed.clear();

    this.stats.destroyed += destroyPromises.length;
  }

  /**
   * 获取池状态
   */
  getStats() {
    return {
      config: {
        min: this.options.min,
        max: this.options.max,
        idleTimeoutMillis: this.options.idleTimeoutMillis,
        acquireTimeoutMillis: this.options.acquireTimeoutMillis,
      },
      runtime: {
        active: this.borrowed.size,
        idle: this.resources.length,
        waiting: this.waitingQueue.length,
        total: this.borrowed.size + this.resources.length,
      },
      stats: { ...this.stats },
      health: this._calculateHealth(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 使用资源（自动借用和归还）
   */
  async use(callback) {
    const resource = await this.borrow();
    try {
      return await callback(resource);
    } finally {
      await this.return(resource);
    }
  }

  /**
   * 清空池中所有资源
   */
  async clear() {
    logger.info('清空资源池', { resourceType: this.getResourceType() });

    const resourcesToDestroy = [...this.resources];
    this.resources = [];

    const destroyPromises = resourcesToDestroy.map((resource) =>
      this._destroyResource(resource),
    );
    await Promise.allSettled(destroyPromises);

    this.stats.destroyed += resourcesToDestroy.length;

    // 重新填充到最小空闲数
    await this._ensureMinIdle();
  }

  /**
   * 调整池大小
   */
  async resize(newMax) {
    if (newMax < this.options.min) {
      throw new Error(
        `New max size ${newMax} cannot be less than min size ${this.options.min}`,
      );
    }

    const oldMax = this.options.max;
    this.options.max = newMax;

    logger.info('调整资源池大小', {
      resourceType: this.getResourceType(),
      oldMax,
      newMax,
    });

    // 如果减小了池大小，可能需要清理多余的空闲资源
    if (newMax < oldMax) {
      const excess = this.resources.length - (newMax - this.borrowed.size);
      if (excess > 0) {
        const resourcesToDestroy = this.resources.splice(0, excess);
        const destroyPromises = resourcesToDestroy.map((resource) =>
          this._destroyResource(resource),
        );
        await Promise.allSettled(destroyPromises);
        this.stats.destroyed += resourcesToDestroy.length;
      }
    }
  }

  // === 私有方法 ===

  /**
   * 尝试获取可用资源
   */
  async _tryAcquireResource() {
    // 从资源池中获取资源
    while (this.resources.length > 0) {
      const resource = this.options.lifo
        ? this.resources.pop()
        : this.resources.shift();

      // 验证资源
      if (
        this.options.testOnBorrow &&
        !(await this._validateResource(resource))
      ) {
        this.stats.invalidResources++;
        await this._destroyResource(resource);
        continue;
      }

      return resource;
    }

    // 如果可以创建新资源，创建并返回
    if (this._canCreateResource()) {
      return await this._createResource();
    }

    return null;
  }

  /**
   * 为等待的借用者创建资源
   */
  async _createResourceForWaitingBorrower() {
    try {
      const resource = await this._createResource();
      const waitingBorrower = this.waitingQueue.shift();

      if (waitingBorrower) {
        clearTimeout(waitingBorrower.timeoutId);
        this._recordBorrow(resource);
        waitingBorrower.resolve(resource);
      } else {
        // 没有等待者，放回池中
        this.resources.push(resource);
      }
    } catch (error) {
      // 创建失败，从等待队列中移除并拒绝
      const waitingBorrower = this.waitingQueue.shift();
      if (waitingBorrower) {
        clearTimeout(waitingBorrower.timeoutId);
        waitingBorrower.reject(error);
      }
    }
  }

  /**
   * 记录借用
   */
  _recordBorrow(resource) {
    this.borrowed.set(resource, {
      borrowTime: Date.now(),
      lastAccessTime: Date.now(),
    });
    this.stats.borrowed++;
  }

  /**
   * 从等待队列中移除
   */
  _removeFromWaitingQueue(request) {
    const index = this.waitingQueue.indexOf(request);
    if (index > -1) {
      this.waitingQueue.splice(index, 1);
    }
  }

  /**
   * 确保最小空闲资源数
   */
  async _ensureMinIdle() {
    const currentIdle = this.resources.length;
    const needed = Math.max(0, this.options.min - currentIdle);

    if (needed > 0) {
      logger.debug('创建最小空闲资源', {
        resourceType: this.getResourceType(),
        needed,
        currentIdle,
      });

      const createPromises = Array(needed)
        .fill()
        .map(() => this._createResource());
      const newResources = await Promise.allSettled(createPromises);

      for (const result of newResources) {
        if (result.status === 'fulfilled') {
          this.resources.push(result.value);
        } else {
          logger.error('创建最小空闲资源失败', {
            error: result.reason.message,
            resourceType: this.getResourceType(),
          });
        }
      }
    }
  }

  /**
   * 检查是否可以创建新资源
   */
  _canCreateResource() {
    const totalResources = this.borrowed.size + this.resources.length;
    return totalResources < this.options.max;
  }

  /**
   * 启动驱逐定时器
   */
  _startEvictionTimer() {
    this.evictionTimer = setInterval(async () => {
      try {
        await this._evictIdleResources();
      } catch (error) {
        logger.error('资源驱逐失败', {
          error: error.message,
          resourceType: this.getResourceType(),
        });
      }
    }, this.options.evictionRunIntervalMillis);
  }

  /**
   * 驱逐空闲资源
   */
  async _evictIdleResources() {
    const now = Date.now();
    const idleTimeout = this.options.softIdleTimeoutMillis;
    const resourcesToEvict = [];

    // 检查空闲资源
    for (let i = this.resources.length - 1; i >= 0; i--) {
      const resource = this.resources[i];
      const borrowInfo = this.borrowed.get(resource);

      if (borrowInfo) {
        // 检查软空闲超时
        if (now - borrowInfo.lastAccessTime > idleTimeout) {
          resourcesToEvict.push({ resource, index: i });
        }
      }
    }

    // 限制每次驱逐的数量
    const toEvict = resourcesToEvict.slice(
      0,
      this.options.numTestsPerEvictionRun,
    );

    for (const { resource, index } of toEvict) {
      // 验证资源是否仍然有效
      if (
        this.options.testOnIdle &&
        !(await this._validateResource(resource))
      ) {
        this.resources.splice(index, 1);
        await this._destroyResource(resource);
        this.stats.invalidResources++;
        this.stats.idleEvictions++;
      }
    }

    if (toEvict.length > 0) {
      logger.debug('驱逐空闲资源', {
        resourceType: this.getResourceType(),
        evicted: toEvict.length,
      });
    }
  }

  /**
   * 计算池健康状态
   */
  _calculateHealth() {
    const total = this.borrowed.size + this.resources.length;
    const utilization = total > 0 ? (this.borrowed.size / total) * 100 : 0;

    let status = 'healthy';
    if (this.waitingQueue.length > 0) {
      status = 'busy';
    }
    if (utilization > 90 || this.stats.failedBorrows > 10) {
      status = 'critical';
    } else if (utilization > 70 || this.stats.failedBorrows > 5) {
      status = 'warning';
    }

    return {
      status,
      utilization: Math.round(utilization * 100) / 100,
      failureRate:
        this.stats.borrowed > 0
          ? (this.stats.failedBorrows / this.stats.borrowed) * 100
          : 0,
    };
  }

  // === 抽象方法（子类必须实现） ===

  /**
   * 获取资源类型名称
   */
  getResourceType() {
    throw new Error('Subclasses must implement getResourceType()');
  }

  /**
   * 创建新资源
   */
  async _createResource() {
    throw new Error('Subclasses must implement _createResource()');
  }

  /**
   * 销毁资源
   */
  async _destroyResource(resource) {
    throw new Error('Subclasses must implement _destroyResource()');
  }

  /**
   * 验证资源有效性
   */
  async _validateResource(resource) {
    throw new Error('Subclasses must implement _validateResource()');
  }
}
