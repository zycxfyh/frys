/**
 * 配置管理器
 * 提供分层配置、热更新、验证和安全存储功能
 */

import { createCipher, createDecipher } from 'crypto';
import { logger } from '../../shared/utils/logger.js';
import { ConfigurationValidatorUtils } from '../../shared/utils/ConfigurationValidatorUtils.js';
import { ResourceCleanupUtils } from '../../shared/utils/ResourceCleanupUtils.js';
import { TimerManager } from '../../shared/utils/TimerManager.js';

export class ConfigurationManager {
  constructor(options = {}) {
    this.options = {
      configPath: './config',
      enableHotReload: false,
      enableEncryption: false,
      enableValidation: true,
      enableCaching: true,
      watchInterval: 30000, // 30秒检查一次配置变更
      ...options
    };

    // 配置层级
    this.layers = new Map();
    this.mergedConfig = {};

    // 配置模式和验证器
    this.schemas = new Map();
    this.validators = new Map();

    // 监听器和回调
    this.listeners = new Map();
    this.changeCallbacks = new Set();

    // 加密和安全
    this.encryptionKey = null;
    this.secureConfigs = new Set();

    // 缓存
    this.configCache = new Map();
    this.cacheTimestamps = new Map();

    // 文件监控
    this.fileWatchers = new Map();
    this.timerManager = new TimerManager();

    // 清理管理器
    this.cleanupManager = ResourceCleanupUtils.createCleanupManager('config_manager');

    // 初始化默认层级
    this._initializeDefaultLayers();

    logger.info('Configuration manager initialized', {
      configPath: this.options.configPath,
      enableHotReload: this.options.enableHotReload,
      enableValidation: this.options.enableValidation
    });
  }

  /**
   * 添加配置层级
   * @param {string} name - 层级名称
   * @param {Object} config - 配置对象
   * @param {Object} options - 层级选项
   */
  addLayer(name, config, options = {}) {
    const layer = {
      name,
      config: { ...config },
      options: {
        priority: 0, // 优先级，数字越大优先级越高
        source: 'memory', // memory, file, env, remote
        encrypted: false,
        readonly: false,
        ...options
      },
      loadedAt: Date.now(),
      version: 1
    };

    this.layers.set(name, layer);
    this._invalidateCache();

    logger.debug(`Configuration layer added: ${name}`, {
      priority: layer.options.priority,
      source: layer.options.source,
      keysCount: Object.keys(config).length
    });

    return this;
  }

  /**
   * 从文件加载配置层级
   * @param {string} name - 层级名称
   * @param {string} filePath - 文件路径
   * @param {Object} options - 加载选项
   */
  async loadFromFile(name, filePath, options = {}) {
    try {
      const config = await ConfigurationValidatorUtils.loadFromFile(filePath, []);

      this.addLayer(name, config, {
        ...options,
        source: 'file',
        filePath
      });

      // 设置文件监控
      if (this.options.enableHotReload && options.watch !== false) {
        this._watchFile(name, filePath);
      }

      logger.info(`Configuration loaded from file: ${filePath}`, {
        layer: name,
        keysCount: Object.keys(config).length
      });

    } catch (error) {
      logger.error(`Failed to load configuration from file: ${filePath}`, {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 从环境变量加载配置
   * @param {string} name - 层级名称
   * @param {string} prefix - 环境变量前缀
   * @param {Array} schema - 配置模式
   * @param {Object} options - 选项
   */
  loadFromEnv(name, prefix = '', schema = [], options = {}) {
    try {
      const config = ConfigurationValidatorUtils.loadFromEnv(prefix, schema);

      this.addLayer(name, config, {
        ...options,
        source: 'env',
        prefix
      });

      logger.info(`Configuration loaded from environment`, {
        layer: name,
        prefix: prefix || '(none)',
        keysCount: Object.keys(config).length
      });

    } catch (error) {
      logger.error(`Failed to load configuration from environment`, {
        prefix,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 设置配置模式
   * @param {string} key - 配置键
   * @param {Array} schema - 配置模式
   * @param {Object} options - 验证选项
   */
  setSchema(key, schema, options = {}) {
    this.schemas.set(key, {
      schema,
      options: {
        strict: false,
        throwOnError: true,
        ...options
      }
    });

    // 创建验证器
    this.validators.set(key, ConfigurationValidatorUtils.createValidator(schema, options));

    logger.debug(`Configuration schema set for: ${key}`, {
      fieldsCount: schema.length,
      strict: options.strict
    });
  }

  /**
   * 获取配置值
   * @param {string} key - 配置键
   * @param {*} defaultValue - 默认值
   * @param {Object} options - 获取选项
   * @returns {*} 配置值
   */
  get(key, defaultValue = undefined, options = {}) {
    const { useCache = this.options.enableCaching, decrypt = true } = options;

    // 检查缓存
    if (useCache && this.configCache.has(key)) {
      const cached = this.configCache.get(key);
      if (this._isCacheValid(key)) {
        return decrypt && this.secureConfigs.has(key) ? this._decrypt(cached.value) : cached.value;
      }
    }

    // 获取合并后的配置
    const mergedConfig = this._getMergedConfig();

    // 路径式访问
    const value = this._getValueByPath(mergedConfig, key);

    // 解密安全配置
    const finalValue = (value !== undefined && decrypt && this.secureConfigs.has(key))
      ? this._decrypt(value)
      : value;

    const result = finalValue !== undefined ? finalValue : defaultValue;

    // 缓存结果
    if (useCache) {
      this.configCache.set(key, {
        value: result,
        timestamp: Date.now()
      });
      this.cacheTimestamps.set(key, Date.now());
    }

    return result;
  }

  /**
   * 设置配置值
   * @param {string} key - 配置键
   * @param {*} value - 配置值
   * @param {Object} options - 设置选项
   */
  set(key, value, options = {}) {
    const {
      layer = 'runtime',
      encrypt = false,
      validate = this.options.enableValidation,
      notify = true
    } = options;

    // 验证配置
    if (validate) {
      const validator = this.validators.get(key);
      if (validator) {
        const validation = validator.validate({ [key]: value });
        if (!validation.valid) {
          throw new Error(`Configuration validation failed for ${key}: ${validation.errors.join(', ')}`);
        }
      }
    }

    // 获取或创建层级
    let targetLayer = this.layers.get(layer);
    if (!targetLayer) {
      this.addLayer(layer, {}, { priority: 0 });
      targetLayer = this.layers.get(layer);
    }

    // 检查只读
    if (targetLayer.options.readonly) {
      throw new Error(`Configuration layer '${layer}' is readonly`);
    }

    // 加密敏感数据
    const finalValue = encrypt || this.secureConfigs.has(key) ? this._encrypt(value) : value;

    // 深度设置值
    this._setValueByPath(targetLayer.config, key, finalValue);

    // 增加版本号
    targetLayer.version++;

    // 清理缓存
    this._invalidateCache();

    // 通知变更
    if (notify) {
      this._notifyChange(key, value, { layer, source: 'set' });
    }

    logger.debug(`Configuration set: ${key}`, {
      layer,
      hasValue: value !== undefined,
      encrypted: encrypt || this.secureConfigs.has(key)
    });
  }

  /**
   * 批量设置配置
   * @param {Object} configs - 配置对象
   * @param {Object} options - 选项
   */
  setMany(configs, options = {}) {
    const changes = [];

    for (const [key, value] of Object.entries(configs)) {
      try {
        this.set(key, value, { ...options, notify: false });
        changes.push({ key, success: true });
      } catch (error) {
        changes.push({ key, success: false, error: error.message });
        logger.warn(`Failed to set configuration: ${key}`, {
          error: error.message
        });
      }
    }

    // 批量通知变更
    if (options.notify !== false && changes.some(c => c.success)) {
      this._notifyBulkChange(changes.filter(c => c.success));
    }

    logger.info(`Bulk configuration update completed`, {
      total: changes.length,
      successful: changes.filter(c => c.success).length,
      failed: changes.filter(c => !c.success).length
    });

    return changes;
  }

  /**
   * 监听配置变更
   * @param {string} key - 配置键
   * @param {Function} callback - 回调函数
   * @param {Object} options - 监听选项
   * @returns {string} 监听器ID
   */
  onChange(key, callback, options = {}) {
    const listenerId = `listener_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Map());
    }

    this.listeners.get(key).set(listenerId, {
      callback,
      options: {
        once: false,
        immediate: false,
        ...options
      },
      registeredAt: Date.now()
    });

    // 立即调用
    if (options.immediate) {
      try {
        const value = this.get(key);
        callback(value, { key, type: 'immediate', oldValue: undefined, newValue: value });
      } catch (error) {
        logger.warn(`Immediate callback failed for ${key}`, {
          error: error.message
        });
      }
    }

    logger.debug(`Configuration listener added: ${key}`, {
      listenerId,
      once: options.once,
      immediate: options.immediate
    });

    return listenerId;
  }

  /**
   * 移除配置监听器
   * @param {string} key - 配置键
   * @param {string} listenerId - 监听器ID
   */
  offChange(key, listenerId) {
    const keyListeners = this.listeners.get(key);
    if (keyListeners && keyListeners.delete(listenerId)) {
      logger.debug(`Configuration listener removed: ${key}`, { listenerId });
      return true;
    }
    return false;
  }

  /**
   * 添加变更回调
   * @param {Function} callback - 回调函数
   * @returns {string} 回调ID
   */
  addChangeCallback(callback) {
    const callbackId = `callback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.changeCallbacks.add(callbackId);

    // 存储回调函数的引用
    this.changeCallbacks[callbackId] = callback;

    logger.debug('Configuration change callback added', { callbackId });
    return callbackId;
  }

  /**
   * 移除变更回调
   * @param {string} callbackId - 回调ID
   */
  removeChangeCallback(callbackId) {
    if (this.changeCallbacks.has(callbackId)) {
      delete this.changeCallbacks[callbackId];
      this.changeCallbacks.delete(callbackId);
      logger.debug('Configuration change callback removed', { callbackId });
      return true;
    }
    return false;
  }

  /**
   * 标记配置为安全配置
   * @param {string} key - 配置键
   */
  markAsSecure(key) {
    this.secureConfigs.add(key);
    logger.debug(`Configuration marked as secure: ${key}`);
  }

  /**
   * 设置加密密钥
   * @param {string} key - 加密密钥
   */
  setEncryptionKey(key) {
    this.encryptionKey = key;
    logger.info('Configuration encryption key set');
  }

  /**
   * 导出配置
   * @param {Object} options - 导出选项
   * @returns {Object} 导出的配置
   */
  export(options = {}) {
    const {
      includeSecure = false,
      includeMetadata = true,
      layers = null
    } = options;

    const exportData = {
      exportedAt: new Date().toISOString(),
      version: '1.0'
    };

    if (includeMetadata) {
      exportData.metadata = {
        layersCount: this.layers.size,
        schemasCount: this.schemas.size,
        listenersCount: Array.from(this.listeners.values()).reduce((sum, listeners) => sum + listeners.size, 0),
        secureConfigsCount: this.secureConfigs.size
      };
    }

    // 导出层级
    const layersToExport = layers || Array.from(this.layers.keys());
    exportData.layers = {};

    for (const layerName of layersToExport) {
      const layer = this.layers.get(layerName);
      if (layer) {
        exportData.layers[layerName] = {
          config: includeSecure ? layer.config : this._sanitizeConfig(layer.config),
          options: { ...layer.options },
          version: layer.version,
          loadedAt: layer.loadedAt
        };
      }
    }

    // 导出模式
    if (includeMetadata) {
      exportData.schemas = {};
      for (const [key, schemaData] of this.schemas) {
        exportData.schemas[key] = schemaData.schema;
      }
    }

    return exportData;
  }

  /**
   * 导入配置
   * @param {Object} importData - 导入的数据
   * @param {Object} options - 导入选项
   */
  import(importData, options = {}) {
    const { overwrite = false, validate = true } = options;

    if (!importData.layers) {
      throw new Error('Invalid import data: missing layers');
    }

    let importedLayers = 0;

    // 导入层级
    for (const [layerName, layerData] of Object.entries(importData.layers)) {
      try {
        if (this.layers.has(layerName) && !overwrite) {
          logger.warn(`Layer ${layerName} already exists, skipping`);
          continue;
        }

        this.addLayer(layerName, layerData.config, layerData.options);
        importedLayers++;

      } catch (error) {
        logger.error(`Failed to import layer ${layerName}`, {
          error: error.message
        });
      }
    }

    // 导入模式
    if (importData.schemas) {
      for (const [key, schema] of Object.entries(importData.schemas)) {
        try {
          this.setSchema(key, schema);
        } catch (error) {
          logger.error(`Failed to import schema for ${key}`, {
            error: error.message
          });
        }
      }
    }

    this._invalidateCache();

    logger.info('Configuration import completed', {
      layersImported: importedLayers,
      schemasImported: importData.schemas ? Object.keys(importData.schemas).length : 0
    });
  }

  /**
   * 获取配置统计信息
   * @returns {Object}
   */
  getStats() {
    const layersBySource = {};
    const layersByPriority = {};

    for (const layer of this.layers.values()) {
      const source = layer.options.source;
      const priority = layer.options.priority;

      layersBySource[source] = (layersBySource[source] || 0) + 1;
      layersByPriority[priority] = (layersByPriority[priority] || 0) + 1;
    }

    return {
      layers: {
        total: this.layers.size,
        bySource: layersBySource,
        byPriority: layersByPriority
      },
      schemas: {
        total: this.schemas.size
      },
      listeners: {
        total: Array.from(this.listeners.values()).reduce((sum, listeners) => sum + listeners.size, 0),
        keys: this.listeners.size
      },
      cache: {
        size: this.configCache.size,
        enabled: this.options.enableCaching
      },
      security: {
        encrypted: this.encryptionKey !== null,
        secureConfigs: this.secureConfigs.size
      },
      options: this.options
    };
  }

  /**
   * 销毁配置管理器
   */
  async destroy() {
    logger.info('Destroying configuration manager...');

    // 停止文件监控
    for (const [layerName, watcher] of this.fileWatchers) {
      try {
        watcher.close();
        logger.debug(`File watcher stopped for layer: ${layerName}`);
      } catch (error) {
        logger.warn(`Failed to stop file watcher for layer: ${layerName}`, {
          error: error.message
        });
      }
    }

    // 停止定时器
    this.timerManager.destroy();

    // 清理资源
    await this.cleanupManager.cleanup();

    // 清空所有集合
    this.layers.clear();
    this.schemas.clear();
    this.validators.clear();
    this.listeners.clear();
    this.changeCallbacks.clear();
    this.configCache.clear();
    this.cacheTimestamps.clear();
    this.secureConfigs.clear();
    this.fileWatchers.clear();

    logger.info('Configuration manager destroyed');
  }

  /**
   * 初始化默认层级
   */
  _initializeDefaultLayers() {
    // 系统默认配置
    this.addLayer('system', {
      app: {
        name: 'frys',
        version: '1.0.0',
        environment: 'development'
      },
      logging: {
        level: 'info',
        format: 'json'
      }
    }, {
      priority: -100,
      readonly: true,
      source: 'system'
    });

    // 环境配置
    this.addLayer('environment', {}, {
      priority: -50,
      source: 'env'
    });
  }

  /**
   * 获取合并后的配置
   */
  _getMergedConfig() {
    if (this.mergedConfig && Object.keys(this.mergedConfig).length > 0) {
      return this.mergedConfig;
    }

    // 按优先级排序层级
    const sortedLayers = Array.from(this.layers.values())
      .sort((a, b) => a.options.priority - b.options.priority);

    // 深度合并配置
    this.mergedConfig = {};
    for (const layer of sortedLayers) {
      ConfigurationValidatorUtils.deepMerge(this.mergedConfig, layer.config);
    }

    return this.mergedConfig;
  }

  /**
   * 通过路径获取值
   */
  _getValueByPath(obj, path) {
    const keys = path.split('.');
    let current = obj;

    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * 通过路径设置值
   */
  _setValueByPath(obj, path, value) {
    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object' || current[key] === null) {
        current[key] = {};
      }
      current = current[key];
    }

    current[keys[keys.length - 1]] = value;
  }

  /**
   * 清理配置中的敏感信息
   */
  _sanitizeConfig(config) {
    const sanitized = { ...config };

    for (const key of this.secureConfigs) {
      if (this._getValueByPath(sanitized, key) !== undefined) {
        this._setValueByPath(sanitized, key, '***');
      }
    }

    return sanitized;
  }

  /**
   * 加密值
   */
  _encrypt(value) {
    if (!this.encryptionKey || !this.options.enableEncryption) {
      return value;
    }

    try {
      // 简化的加密实现，实际项目中应该使用更安全的加密算法
      const cipher = createCipher('aes-256-cbc', this.encryptionKey);
      let encrypted = cipher.update(JSON.stringify(value), 'utf8', 'hex');
      encrypted += cipher.final('hex');
      return `__ENCRYPTED__${encrypted}`;
    } catch (error) {
      logger.error('Configuration encryption failed', {
        error: error.message
      });
      return value;
    }
  }

  /**
   * 解密值
   */
  _decrypt(encryptedValue) {
    if (!this.encryptionKey || !this.options.enableEncryption || typeof encryptedValue !== 'string') {
      return encryptedValue;
    }

    if (!encryptedValue.startsWith('__ENCRYPTED__')) {
      return encryptedValue;
    }

    try {
      const decipher = createDecipher('aes-256-cbc', this.encryptionKey);
      const encrypted = encryptedValue.slice(13); // 移除前缀
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return JSON.parse(decrypted);
    } catch (error) {
      logger.error('Configuration decryption failed', {
        error: error.message
      });
      return encryptedValue;
    }
  }

  /**
   * 通知配置变更
   */
  _notifyChange(key, newValue, metadata) {
    // 通知特定键的监听器
    const keyListeners = this.listeners.get(key);
    if (keyListeners) {
      const oldValue = this._getValueByPath(this._getMergedConfig(), key);

      for (const [listenerId, listener] of keyListeners) {
        try {
          listener.callback(newValue, {
            key,
            type: 'change',
            oldValue,
            newValue,
            ...metadata
          });

          // 如果是一次性监听器，移除
          if (listener.options.once) {
            keyListeners.delete(listenerId);
          }
        } catch (error) {
          logger.error(`Configuration change listener failed for ${key}`, {
            listenerId,
            error: error.message
          });
        }
      }
    }

    // 通知全局回调
    for (const callbackId in this.changeCallbacks) {
      if (this.changeCallbacks[callbackId]) {
        try {
          this.changeCallbacks[callbackId](key, newValue, metadata);
        } catch (error) {
          logger.error(`Configuration change callback failed`, {
            callbackId,
            key,
            error: error.message
          });
        }
      }
    }
  }

  /**
   * 批量通知配置变更
   */
  _notifyBulkChange(changes) {
    for (const change of changes) {
      this._notifyChange(change.key, this.get(change.key), { source: 'bulk' });
    }
  }

  /**
   * 监控文件变更
   */
  _watchFile(layerName, filePath) {
    if (this.fileWatchers.has(layerName)) {
      return;
    }

    const fs = require('fs');

    try {
      const watcher = fs.watch(filePath, { persistent: false }, async (eventType) => {
        if (eventType === 'change') {
          logger.info(`Configuration file changed: ${filePath}`);

          try {
            // 重新加载配置
            const config = await ConfigurationValidatorUtils.loadFromFile(filePath, []);
            const layer = this.layers.get(layerName);

            if (layer) {
              layer.config = config;
              layer.version++;
              this._invalidateCache();

              // 通知变更
              this._notifyBulkChange(Object.keys(config).map(key => ({ key })));

              logger.info(`Configuration reloaded from file: ${filePath}`, {
                layer: layerName,
                keysCount: Object.keys(config).length
              });
            }
          } catch (error) {
            logger.error(`Failed to reload configuration from file: ${filePath}`, {
              error: error.message
            });
          }
        }
      });

      this.fileWatchers.set(layerName, watcher);
      this.cleanupManager.register('watchers', watcher, layerName);

      logger.debug(`File watcher started for ${layerName}: ${filePath}`);

    } catch (error) {
      logger.error(`Failed to start file watcher for ${filePath}`, {
        error: error.message
      });
    }
  }

  /**
   * 使缓存失效
   */
  _invalidateCache() {
    this.mergedConfig = {};
    this.configCache.clear();
    this.cacheTimestamps.clear();
  }

  /**
   * 检查缓存是否有效
   */
  _isCacheValid(key) {
    const timestamp = this.cacheTimestamps.get(key);
    if (!timestamp) return false;

    // 缓存5分钟
    return Date.now() - timestamp < 5 * 60 * 1000;
  }
}
