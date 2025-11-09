/**
 * 🧠 frys 基础记忆网络
 *
 * 借鉴VCPToolBox的记忆理念，实现：
 * - 工作流实例间状态共享和上下文记忆
 * - 键值存储和过期管理
 * - 作用域隔离和命名空间
 * - 内存优化和自动清理
 * - 序列化支持和类型安全
 */

import { logger } from '../../shared/utils/logger.js';

export class BasicMemoryNetwork {
  constructor(options = {}) {
    this.options = {
      maxMemoryMB: options.maxMemoryMB || 100, // 最大内存使用(MB)
      defaultTTL: options.defaultTTL || 3600000, // 默认TTL 1小时
      cleanupInterval: options.cleanupInterval || 300000, // 清理间隔 5分钟
      enableCompression: options.enableCompression || false,
      enableLogging: options.enableLogging || true,
      ...options,
    };

    // 记忆存储 - 按命名空间组织
    this.namespaces = new Map();

    // 全局统计
    this.stats = {
      totalKeys: 0,
      totalNamespaces: 0,
      memoryUsage: 0,
      hits: 0,
      misses: 0,
      evictions: 0,
      expirations: 0,
    };

    // 过期管理
    this.expirationQueue = []; // 按过期时间排序的数组

    // 内存监控
    this.memoryMonitor = null;

    this.initialize();
  }

  initialize() {
    // 启动定期清理任务
    this.cleanupTimer = setInterval(() => {
      this.performCleanup();
    }, this.options.cleanupInterval);

    // 启动内存监控
    if (this.options.enableLogging) {
      this.memoryMonitor = setInterval(() => {
        this.updateMemoryStats();
      }, 60000); // 每分钟更新内存统计
    }

    logger.info('BasicMemoryNetwork initialized', {
      maxMemoryMB: this.options.maxMemoryMB,
      defaultTTL: this.options.defaultTTL,
    });
  }

  /**
   * 存储记忆项
   */
  async set(key, value, options = {}) {
    const namespace = options.namespace || 'default';
    const ttl = options.ttl || this.options.defaultTTL;
    const compress = this.getCompressOption(options);

    try {
      const ns = this.ensureNamespace(namespace);
      const serializedValue = this.serialize(value, compress);
      const memoryUsage = this.calculateMemoryUsage(serializedValue);

      await this.checkMemoryLimit(memoryUsage);
      const memoryItem = this.createMemoryItem(
        key,
        value,
        serializedValue,
        compress,
        ttl,
        namespace,
        memoryUsage,
        options,
      );

      this.updateExistingItem(ns, key, memoryItem);
      this.storeMemoryItem(ns, key, memoryItem);

      if (this.options.enableLogging) {
        this.logStorage(memoryItem);
      }

      return true;
    } catch (error) {
      logger.error('Failed to store memory item', {
        namespace,
        key,
        error: error.message,
      });
      throw error;
    }
  }

  getCompressOption(options) {
    return options.compress !== undefined
      ? options.compress
      : this.options.enableCompression;
  }

  ensureNamespace(namespace) {
    if (!this.namespaces.has(namespace)) {
      this.namespaces.set(namespace, new Map());
      this.stats.totalNamespaces++;
    }
    return this.namespaces.get(namespace);
  }

  async checkMemoryLimit(memoryUsage) {
    if (
      this.stats.memoryUsage + memoryUsage >
      this.options.maxMemoryMB * 1024 * 1024
    ) {
      await this.evictOldEntries(memoryUsage);
    }
  }

  createMemoryItem(
    key,
    value,
    serializedValue,
    compress,
    ttl,
    namespace,
    memoryUsage,
    options,
  ) {
    return {
      key,
      value: serializedValue,
      originalValue: value,
      compressed: compress,
      createdAt: new Date(),
      accessedAt: new Date(),
      expiresAt: ttl > 0 ? new Date(Date.now() + ttl) : null,
      accessCount: 0,
      namespace,
      size: memoryUsage,
      metadata: options.metadata || {},
    };
  }

  updateExistingItem(ns, key) {
    const existing = ns.get(key);
    if (existing) {
      this.stats.memoryUsage -= existing.size;
      this.removeFromExpirationQueue(existing);
    } else {
      this.stats.totalKeys++;
    }
  }

  storeMemoryItem(ns, key, memoryItem) {
    ns.set(key, memoryItem);
    this.stats.memoryUsage += memoryItem.size;

    if (memoryItem.expiresAt) {
      this.addToExpirationQueue(memoryItem);
    }
  }

  logStorage(memoryItem) {
    logger.debug('Memory item stored', {
      namespace: memoryItem.namespace,
      key: memoryItem.key,
      size: memoryItem.size,
      ttl: memoryItem.expiresAt,
      compressed: memoryItem.compressed,
    });
  }

  /**
   * 获取记忆项
   */
  async get(key, options = {}) {
    const namespace = options.namespace || 'default';

    try {
      const ns = this.namespaces.get(namespace);
      if (!ns) {
        this.stats.misses++;
        return null;
      }

      const item = ns.get(key);
      if (!item) {
        this.stats.misses++;
        return null;
      }

      // 检查是否过期
      if (item.expiresAt && item.expiresAt < new Date()) {
        await this.delete(key, { namespace });
        this.stats.misses++;
        this.stats.expirations++;
        return null;
      }

      // 更新访问统计
      item.accessedAt = new Date();
      item.accessCount++;

      this.stats.hits++;

      if (this.options.enableLogging && item.accessCount % 100 === 0) {
        logger.debug('Memory item accessed frequently', {
          namespace,
          key,
          accessCount: item.accessCount,
        });
      }

      return item.originalValue;
    } catch (error) {
      logger.error('Failed to get memory item', {
        namespace,
        key,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * 删除记忆项
   */
  async delete(key, options = {}) {
    const namespace = options.namespace || 'default';

    try {
      const ns = this.namespaces.get(namespace);
      if (!ns) {
        return false;
      }

      const item = ns.get(key);
      if (!item) {
        return false;
      }

      // 从过期队列移除
      this.removeFromExpirationQueue(item);

      // 更新统计
      this.stats.memoryUsage -= item.size;
      this.stats.totalKeys--;

      // 删除项
      ns.delete(key);

      // 如果命名空间为空，清理命名空间
      if (ns.size === 0) {
        this.namespaces.delete(namespace);
        this.stats.totalNamespaces--;
      }

      if (this.options.enableLogging) {
        logger.debug('Memory item deleted', { namespace, key });
      }

      return true;
    } catch (error) {
      logger.error('Failed to delete memory item', {
        namespace,
        key,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * 检查键是否存在
   */
  async exists(key, options = {}) {
    const namespace = options.namespace || 'default';

    try {
      const ns = this.namespaces.get(namespace);
      if (!ns) {
        return false;
      }

      const item = ns.get(key);
      if (!item) {
        return false;
      }

      // 检查是否过期
      if (item.expiresAt && item.expiresAt < new Date()) {
        await this.delete(key, { namespace });
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Failed to check memory item existence', {
        namespace,
        key,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * 获取命名空间中的所有键
   */
  async keys(options = {}) {
    const namespace = options.namespace || 'default';
    const pattern = options.pattern;

    try {
      const ns = this.namespaces.get(namespace);
      if (!ns) {
        return [];
      }

      let keys = Array.from(ns.keys());

      // 应用模式匹配
      if (pattern) {
        keys = keys.filter((key) => this.matchesPattern(key, pattern));
      }

      return keys;
    } catch (error) {
      logger.error('Failed to get keys', {
        namespace,
        pattern,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * 清空命名空间
   */
  async clear(options = {}) {
    const namespace = options.namespace;

    try {
      if (namespace) {
        // 清空特定命名空间
        const ns = this.namespaces.get(namespace);
        if (ns) {
          // 清理过期队列
          for (const item of ns.values()) {
            this.removeFromExpirationQueue(item);
          }

          // 更新统计
          let namespaceSize = 0;
          for (const item of ns.values()) {
            namespaceSize += item.size;
          }
          this.stats.memoryUsage -= namespaceSize;
          this.stats.totalKeys -= ns.size;

          // 删除命名空间
          this.namespaces.delete(namespace);
          this.stats.totalNamespaces--;
        }
      } else {
        // 清空所有命名空间
        for (const ns of this.namespaces.values()) {
          for (const item of ns.values()) {
            this.removeFromExpirationQueue(item);
          }
        }

        this.namespaces.clear();
        this.stats.totalKeys = 0;
        this.stats.totalNamespaces = 0;
        this.stats.memoryUsage = 0;
        this.expirationQueue = [];
      }

      if (this.options.enableLogging) {
        logger.info('Memory network cleared', {
          namespace: namespace || 'all',
        });
      }

      return true;
    } catch (error) {
      logger.error('Failed to clear memory', {
        namespace,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * 获取或设置值（原子操作）
   */
  async getset(key, value, options = {}) {
    const namespace = options.namespace || 'default';

    try {
      const oldValue = await this.get(key, { namespace });
      await this.set(key, value, options);
      return oldValue;
    } catch (error) {
      logger.error('Failed to getset memory item', {
        namespace,
        key,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * 设置过期时间
   */
  async expire(key, ttl, options = {}) {
    const namespace = options.namespace || 'default';

    try {
      const ns = this.namespaces.get(namespace);
      if (!ns) {
        return false;
      }

      const item = ns.get(key);
      if (!item) {
        return false;
      }

      // 移除旧的过期时间
      this.removeFromExpirationQueue(item);

      // 设置新的过期时间
      item.expiresAt = new Date(Date.now() + ttl);

      // 添加到过期队列
      this.addToExpirationQueue(item);

      if (this.options.enableLogging) {
        logger.debug('Memory item expiration set', { namespace, key, ttl });
      }

      return true;
    } catch (error) {
      logger.error('Failed to set expiration', {
        namespace,
        key,
        ttl,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * 获取剩余过期时间
   */
  async ttl(key, options = {}) {
    const namespace = options.namespace || 'default';

    try {
      const ns = this.namespaces.get(namespace);
      if (!ns) {
        return -2; // 键不存在
      }

      const item = ns.get(key);
      if (!item) {
        return -2; // 键不存在
      }

      if (!item.expiresAt) {
        return -1; // 永不过期
      }

      const remaining = item.expiresAt.getTime() - Date.now();
      return remaining > 0 ? remaining : -2; // 已过期
    } catch (error) {
      logger.error('Failed to get TTL', {
        namespace,
        key,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * 获取命名空间统计
   */
  async getNamespaceStats(namespace) {
    try {
      const ns = this.namespaces.get(namespace);
      if (!ns) {
        return null;
      }

      const stats = {
        name: namespace,
        keys: ns.size,
        memoryUsage: 0,
        oldestItem: null,
        newestItem: null,
        expiredCount: 0,
      };

      const now = new Date();
      for (const item of ns.values()) {
        stats.memoryUsage += item.size;

        if (!stats.oldestItem || item.createdAt < stats.oldestItem) {
          stats.oldestItem = item.createdAt;
        }

        if (!stats.newestItem || item.createdAt > stats.newestItem) {
          stats.newestItem = item.createdAt;
        }

        if (item.expiresAt && item.expiresAt < now) {
          stats.expiredCount++;
        }
      }

      return stats;
    } catch (error) {
      logger.error('Failed to get namespace stats', {
        namespace,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * 序列化值
   */
  serialize(value, compress = false) {
    try {
      if (compress && typeof value === 'object') {
        // 简单压缩：移除undefined值，简化对象
        const cleaned = JSON.parse(
          JSON.stringify(value, (key, val) => (val === undefined ? null : val)),
        );
        return JSON.stringify(cleaned);
      } else {
        return JSON.stringify(value);
      }
    } catch (error) {
      // 如果序列化失败，返回字符串表示
      return String(value);
    }
  }

  /**
   * 反序列化值
   */
  deserialize(serializedValue) {
    try {
      return JSON.parse(serializedValue);
    } catch (error) {
      // 如果反序列化失败，直接返回
      return serializedValue;
    }
  }

  /**
   * 计算内存使用
   */
  calculateMemoryUsage(value) {
    if (typeof value === 'string') {
      return value.length * 2; // 估算UTF-16编码
    } else if (typeof value === 'object') {
      return JSON.stringify(value).length * 2;
    } else {
      return 8; // 基本类型估算
    }
  }

  /**
   * 模式匹配
   */
  matchesPattern(key, pattern) {
    // 将通配符模式转换为正则表达式
    // * 匹配任意字符序列（包括空字符串）
    // ? 匹配单个字符
    const regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&') // 转义特殊字符
      .replace(/\*/g, '.*') // * 匹配任意字符序列
      .replace(/\?/g, '.') // ? 匹配单个字符
      .replace(/\.\*\./g, '.*'); // 处理连续的.*

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(key);
  }

  /**
   * 添加到过期队列
   */
  addToExpirationQueue(item) {
    if (!item.expiresAt) return;

    // 使用二分查找找到插入位置
    let left = 0;
    let right = this.expirationQueue.length;

    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      if (this.expirationQueue[mid].expiresAt <= item.expiresAt) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }

    this.expirationQueue.splice(left, 0, item);
  }

  /**
   * 从过期队列移除
   */
  removeFromExpirationQueue(item) {
    const index = this.expirationQueue.findIndex(
      (queueItem) =>
        queueItem.key === item.key && queueItem.namespace === item.namespace,
    );

    if (index >= 0) {
      this.expirationQueue.splice(index, 1);
    }
  }

  /**
   * 执行清理
   */
  async performCleanup() {
    const now = new Date();
    let cleaned = 0;

    try {
      // 处理过期项目
      while (
        this.expirationQueue.length > 0 &&
        this.expirationQueue[0].expiresAt <= now
      ) {
        const item = this.expirationQueue.shift();

        // 只有在项目仍然存在时才删除
        const ns = this.namespaces.get(item.namespace);
        if (ns && ns.has(item.key)) {
          await this.delete(item.key, { namespace: item.namespace });
          cleaned++;
        }
      }

      // 检查内存使用情况
      const memoryLimit = this.options.maxMemoryMB * 1024 * 1024;
      if (this.stats.memoryUsage > memoryLimit * 0.9) {
        // 内存使用超过90%，执行激进清理
        const additionalCleaned = await this.evictOldEntries();
        cleaned += additionalCleaned;
      }

      if (cleaned > 0 && this.options.enableLogging) {
        logger.info('Memory cleanup performed', { cleanedItems: cleaned });
      }
    } catch (error) {
      logger.error('Memory cleanup failed', { error: error.message });
    }
  }

  /**
   * 驱逐旧条目以释放内存
   */
  async evictOldEntries(requiredSpace = 0) {
    let evicted = 0;
    const targetMemory = Math.max(
      requiredSpace,
      this.options.maxMemoryMB * 1024 * 1024 * 0.8, // 目标80%内存使用
    );

    try {
      // 按访问时间排序，优先删除最少访问的项目
      const allItems = [];
      for (const ns of this.namespaces.values()) {
        for (const item of ns.values()) {
          allItems.push(item);
        }
      }

      allItems.sort((a, b) => {
        // 优先删除：过期项目 > 最少访问 > 最旧访问
        if (a.expiresAt && (!b.expiresAt || a.expiresAt < b.expiresAt))
          return -1;
        if (b.expiresAt && (!a.expiresAt || b.expiresAt < a.expiresAt))
          return 1;
        if (a.accessCount !== b.accessCount)
          return a.accessCount - b.accessCount;
        return a.accessedAt - b.accessedAt;
      });

      for (const item of allItems) {
        if (this.stats.memoryUsage <= targetMemory) {
          break;
        }

        await this.delete(item.key, { namespace: item.namespace });
        evicted++;
        this.stats.evictions++;
      }

      if (evicted > 0 && this.options.enableLogging) {
        logger.warn('Memory eviction performed', { evictedItems: evicted });
      }
    } catch (error) {
      logger.error('Memory eviction failed', { error: error.message });
    }

    return evicted;
  }

  /**
   * 更新内存统计
   */
  updateMemoryStats() {
    try {
      const memUsage = process.memoryUsage();
      const networkUsage = this.stats.memoryUsage / (1024 * 1024); // MB

      logger.info('Memory network stats', {
        memoryNetworkUsage: `${networkUsage.toFixed(2)}MB`,
        processMemoryUsage: `${(memUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`,
        totalKeys: this.stats.totalKeys,
        totalNamespaces: this.stats.totalNamespaces,
        hitRate:
          this.stats.hits + this.stats.misses > 0
            ? `${((this.stats.hits / (this.stats.hits + this.stats.misses)) * 100).toFixed(1)}%`
            : '0%',
      });
    } catch (error) {
      logger.error('Failed to update memory stats', { error: error.message });
    }
  }

  /**
   * 获取全局统计
   */
  getStats() {
    const memoryUsageMB = this.stats.memoryUsage / (1024 * 1024);

    return {
      ...this.stats,
      memoryUsageMB: parseFloat(memoryUsageMB.toFixed(2)),
      memoryLimitMB: this.options.maxMemoryMB,
      memoryUsagePercent: parseFloat(
        ((memoryUsageMB / this.options.maxMemoryMB) * 100).toFixed(1),
      ),
      hitRate:
        this.stats.hits + this.stats.misses > 0
          ? parseFloat(
              (
                (this.stats.hits / (this.stats.hits + this.stats.misses)) *
                100
              ).toFixed(1),
            )
          : 0,
      namespaces: Array.from(this.namespaces.keys()),
    };
  }

  /**
   * 导出数据（用于备份）
   */
  async exportData(options = {}) {
    const namespace = options.namespace;
    const includeExpired = options.includeExpired || false;

    try {
      const exportData = {};
      const now = new Date();

      for (const [nsName, ns] of this.namespaces) {
        if (namespace && nsName !== namespace) continue;

        exportData[nsName] = {};

        for (const [key, item] of ns) {
          // 跳过过期项目（除非明确要求包含）
          if (!includeExpired && item.expiresAt && item.expiresAt < now) {
            continue;
          }

          exportData[nsName][key] = {
            value: item.originalValue,
            metadata: item.metadata,
            expiresAt: item.expiresAt,
            createdAt: item.createdAt,
          };
        }
      }

      return exportData;
    } catch (error) {
      logger.error('Failed to export data', {
        namespace,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * 导入数据（用于恢复）
   */
  async importData(data, options = {}) {
    const namespace = options.namespace;
    const skipExisting = options.skipExisting || false;

    try {
      let imported = 0;

      for (const [nsName, nsData] of Object.entries(data)) {
        const targetNamespace = namespace || nsName;

        for (const [key, itemData] of Object.entries(nsData)) {
          if (
            skipExisting &&
            (await this.exists(key, { namespace: targetNamespace }))
          ) {
            continue;
          }

          const ttl = itemData.expiresAt
            ? Math.max(0, itemData.expiresAt.getTime() - Date.now())
            : 0;

          await this.set(key, itemData.value, {
            namespace: targetNamespace,
            ttl,
            metadata: itemData.metadata,
          });

          imported++;
        }
      }

      if (this.options.enableLogging) {
        logger.info('Data import completed', { importedItems: imported });
      }

      return imported;
    } catch (error) {
      logger.error('Failed to import data', { error: error.message });
      throw error;
    }
  }

  /**
   * 关闭记忆网络
   */
  async shutdown() {
    logger.info('Shutting down BasicMemoryNetwork');

    // 停止定时器
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    if (this.memoryMonitor) {
      clearInterval(this.memoryMonitor);
    }

    // 清空所有数据
    await this.clear();

    logger.info('BasicMemoryNetwork shutdown completed');
  }
}

export default BasicMemoryNetwork;
