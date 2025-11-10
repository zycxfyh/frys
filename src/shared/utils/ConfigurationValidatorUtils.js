/**
 * 配置验证工具类
 * 统一配置验证和默认值设置
 */

import { logger } from '../utils/logger.js';

export class ConfigurationValidatorUtils {
  /**
   * 创建配置验证器
   */
  static createValidator(schema, options = {}) {
    const {
      strict = false,
      logWarnings = true,
      throwOnError = true
    } = options;

    return {
      validate: (config) => this.validateConfig(config, schema, { strict, logWarnings, throwOnError }),
      applyDefaults: (config) => this.applyDefaults(config, schema),
      sanitize: (config) => this.sanitizeConfig(config, schema),
      getSchema: () => schema
    };
  }

  /**
   * 验证配置
   */
  static validateConfig(config, schema, options = {}) {
    const { strict = false, logWarnings = true, throwOnError = true } = options;
    const errors = [];
    const warnings = [];

    const validateField = (value, fieldSchema, path = '') => {
      const fullPath = path ? `${path}.${fieldSchema.key}` : fieldSchema.key;

      // 检查必需字段
      if (fieldSchema.required && (value === undefined || value === null)) {
        errors.push(`Missing required field: ${fullPath}`);
        return;
      }

      // 如果字段是可选的且未定义，跳过验证
      if (!fieldSchema.required && (value === undefined || value === null)) {
        return;
      }

      // 类型验证
      if (fieldSchema.type) {
        const actualType = Array.isArray(value) ? 'array' : typeof value;

        if (fieldSchema.type === 'array' && !Array.isArray(value)) {
          errors.push(`Field '${fullPath}' must be of type array, got ${actualType}`);
        } else if (fieldSchema.type !== 'array' && actualType !== fieldSchema.type) {
          errors.push(`Field '${fullPath}' must be of type ${fieldSchema.type}, got ${actualType}`);
        }
      }

      // 范围验证
      if (typeof value === 'number') {
        if (fieldSchema.min !== undefined && value < fieldSchema.min) {
          errors.push(`Field '${fullPath}' must be >= ${fieldSchema.min}, got ${value}`);
        }
        if (fieldSchema.max !== undefined && value > fieldSchema.max) {
          errors.push(`Field '${fullPath}' must be <= ${fieldSchema.max}, got ${value}`);
        }
      }

      // 字符串验证
      if (typeof value === 'string') {
        if (fieldSchema.minLength !== undefined && value.length < fieldSchema.minLength) {
          errors.push(`Field '${fullPath}' must have length >= ${fieldSchema.minLength}, got ${value.length}`);
        }
        if (fieldSchema.maxLength !== undefined && value.length > fieldSchema.maxLength) {
          errors.push(`Field '${fullPath}' must have length <= ${fieldSchema.maxLength}, got ${value.length}`);
        }
        if (fieldSchema.pattern && !fieldSchema.pattern.test(value)) {
          errors.push(`Field '${fullPath}' does not match required pattern`);
        }
        if (fieldSchema.enum && !fieldSchema.enum.includes(value)) {
          errors.push(`Field '${fullPath}' must be one of: ${fieldSchema.enum.join(', ')}`);
        }
      }

      // 数组验证
      if (Array.isArray(value)) {
        if (fieldSchema.minItems !== undefined && value.length < fieldSchema.minItems) {
          errors.push(`Field '${fullPath}' must have at least ${fieldSchema.minItems} items, got ${value.length}`);
        }
        if (fieldSchema.maxItems !== undefined && value.length > fieldSchema.maxItems) {
          errors.push(`Field '${fullPath}' must have at most ${fieldSchema.maxItems} items, got ${value.length}`);
        }

        // 验证数组元素
        if (fieldSchema.items) {
          value.forEach((item, index) => {
            validateField(item, { ...fieldSchema.items, key: index.toString() }, fullPath);
          });
        }
      }

      // 对象验证
      if (fieldSchema.properties && typeof value === 'object' && !Array.isArray(value)) {
        for (const [propKey, propSchema] of Object.entries(fieldSchema.properties)) {
          validateField(value[propKey], { ...propSchema, key: propKey }, fullPath);
        }

        // 检查额外属性
        if (strict && fieldSchema.additionalProperties === false) {
          const allowedKeys = Object.keys(fieldSchema.properties);
          const extraKeys = Object.keys(value).filter(key => !allowedKeys.includes(key));

          if (extraKeys.length > 0) {
            warnings.push(`Extra properties not allowed in strict mode: ${extraKeys.join(', ')} at ${fullPath}`);
          }
        }
      }

      // 自定义验证器
      if (fieldSchema.validator && typeof fieldSchema.validator === 'function') {
        try {
          const result = fieldSchema.validator(value, fullPath);
          if (result !== true) {
            errors.push(result || `Custom validation failed for field '${fullPath}'`);
          }
        } catch (error) {
          errors.push(`Custom validator error for field '${fullPath}': ${error.message}`);
        }
      }
    };

    // 验证顶级字段
    for (const fieldSchema of schema) {
      const value = config[fieldSchema.key];
      validateField(value, fieldSchema);
    }

    // 检查额外字段
    if (strict) {
      const allowedKeys = schema.map(s => s.key);
      const extraKeys = Object.keys(config).filter(key => !allowedKeys.includes(key));

      if (extraKeys.length > 0) {
        warnings.push(`Extra properties not allowed in strict mode: ${extraKeys.join(', ')}`);
      }
    }

    // 日志记录
    if (logWarnings && warnings.length > 0) {
      logger.warn('Configuration validation warnings', { warnings });
    }

    if (errors.length > 0) {
      const errorMsg = `Configuration validation failed: ${errors.join('; ')}`;
      logger.error('Configuration validation errors', { errors });

      if (throwOnError) {
        throw new Error(errorMsg);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * 应用默认值
   */
  static applyDefaults(config, schema) {
    const result = { ...config };

    for (const fieldSchema of schema) {
      const key = fieldSchema.key;

      // 如果字段未定义且有默认值
      if (result[key] === undefined && fieldSchema.default !== undefined) {
        result[key] = typeof fieldSchema.default === 'function'
          ? fieldSchema.default()
          : fieldSchema.default;
      }

      // 递归处理嵌套对象
      if (fieldSchema.properties && typeof result[key] === 'object' && result[key] !== null) {
        result[key] = this.applyDefaults(result[key], Object.entries(fieldSchema.properties).map(([k, v]) => ({
          ...v,
          key: k
        })));
      }

      // 处理数组元素的默认值
      if (fieldSchema.items && Array.isArray(result[key])) {
        result[key] = result[key].map(item => {
          if (fieldSchema.items.properties && typeof item === 'object') {
            return this.applyDefaults(item, Object.entries(fieldSchema.items.properties).map(([k, v]) => ({
              ...v,
              key: k
            })));
          }
          return item;
        });
      }
    }

    return result;
  }

  /**
   * 清理配置（移除敏感信息等）
   */
  static sanitizeConfig(config, schema) {
    const result = { ...config };

    for (const fieldSchema of schema) {
      const key = fieldSchema.key;

      // 敏感字段处理
      if (fieldSchema.sensitive && result[key] !== undefined) {
        result[key] = '***';
      }

      // 递归处理嵌套对象
      if (fieldSchema.properties && typeof result[key] === 'object' && result[key] !== null) {
        result[key] = this.sanitizeConfig(result[key], Object.entries(fieldSchema.properties).map(([k, v]) => ({
          ...v,
          key: k
        })));
      }

      // 处理数组元素
      if (fieldSchema.items && Array.isArray(result[key])) {
        result[key] = result[key].map(item => {
          if (fieldSchema.items.properties && typeof item === 'object') {
            return this.sanitizeConfig(item, Object.entries(fieldSchema.items.properties).map(([k, v]) => ({
              ...v,
              key: k
            })));
          }
          return item;
        });
      }
    }

    return result;
  }

  /**
   * 合并配置
   */
  static mergeConfigs(baseConfig, overrideConfig, schema) {
    let result = this.applyDefaults(baseConfig, schema);
    result = this.deepMerge(result, overrideConfig);

    // 验证合并后的配置
    const validation = this.validateConfig(result, schema, { throwOnError: false });
    if (!validation.valid) {
      throw new Error(`Merged configuration is invalid: ${validation.errors.join('; ')}`);
    }

    return result;
  }

  /**
   * 深度合并对象
   */
  static deepMerge(target, source) {
    const result = { ...target };

    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }

    return result;
  }

  /**
   * 从环境变量加载配置
   */
  static loadFromEnv(prefix = '', schema) {
    const config = {};

    for (const fieldSchema of schema) {
      const envKey = `${prefix}${fieldSchema.key.toUpperCase()}`;
      const envValue = process.env[envKey];

      if (envValue !== undefined) {
        // 类型转换
        switch (fieldSchema.type) {
          case 'number':
            config[fieldSchema.key] = Number(envValue);
            break;
          case 'boolean':
            config[fieldSchema.key] = envValue.toLowerCase() === 'true' || envValue === '1';
            break;
          case 'array':
            config[fieldSchema.key] = envValue.split(',').map(s => s.trim());
            break;
          default:
            config[fieldSchema.key] = envValue;
        }
      }
    }

    return config;
  }

  /**
   * 从文件加载配置
   */
  static async loadFromFile(filePath, schema) {
    try {
      const fs = await import('fs/promises');
      const content = await fs.readFile(filePath, 'utf8');

      let config;
      if (filePath.endsWith('.json')) {
        config = JSON.parse(content);
      } else if (filePath.endsWith('.js') || filePath.endsWith('.mjs')) {
        // 注意：动态导入可能有安全风险
        config = (await import(filePath)).default;
      } else {
        throw new Error(`Unsupported file format: ${filePath}`);
      }

      // 验证加载的配置
      const validation = this.validateConfig(config, schema, { throwOnError: false });
      if (!validation.valid) {
        throw new Error(`Configuration file is invalid: ${validation.errors.join('; ')}`);
      }

      return config;

    } catch (error) {
      throw new Error(`Failed to load configuration from ${filePath}: ${error.message}`);
    }
  }

  /**
   * 创建配置快照
   */
  static createSnapshot(config, schema) {
    return {
      config: this.sanitizeConfig(config, schema),
      schema: schema.map(s => ({ ...s, validator: undefined })), // 移除函数
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || 'unknown'
    };
  }

  /**
   * 比较配置差异
   */
  static compareConfigs(oldConfig, newConfig, schema) {
    const changes = {
      added: [],
      removed: [],
      modified: []
    };

    const oldSanitized = this.sanitizeConfig(oldConfig, schema);
    const newSanitized = this.sanitizeConfig(newConfig, schema);

    // 检查新增字段
    for (const key in newSanitized) {
      if (!(key in oldSanitized)) {
        changes.added.push({ key, newValue: newSanitized[key] });
      }
    }

    // 检查删除和修改字段
    for (const key in oldSanitized) {
      if (!(key in newSanitized)) {
        changes.removed.push({ key, oldValue: oldSanitized[key] });
      } else if (JSON.stringify(oldSanitized[key]) !== JSON.stringify(newSanitized[key])) {
        changes.modified.push({
          key,
          oldValue: oldSanitized[key],
          newValue: newSanitized[key]
        });
      }
    }

    return changes;
  }
}

/**
 * 预定义配置模式
 */
export const ConfigSchemas = {
  // 数据库配置模式
  database: [
    { key: 'host', type: 'string', required: true, default: 'localhost' },
    { key: 'port', type: 'number', required: true, default: 5432, min: 1, max: 65535 },
    { key: 'database', type: 'string', required: true },
    { key: 'username', type: 'string', required: true },
    { key: 'password', type: 'string', required: true, sensitive: true },
    { key: 'maxConnections', type: 'number', default: 10, min: 1, max: 100 },
    { key: 'idleTimeoutMillis', type: 'number', default: 30000, min: 0 },
    { key: 'connectionTimeoutMillis', type: 'number', default: 60000, min: 0 }
  ],

  // 缓存配置模式
  cache: [
    { key: 'enabled', type: 'boolean', default: true },
    { key: 'ttl', type: 'number', default: 3600000, min: 0 }, // 1小时
    { key: 'maxSize', type: 'number', default: 1000, min: 1 },
    { key: 'strategy', type: 'string', enum: ['lru', 'lfu', 'fifo'], default: 'lru' },
    { key: 'compression', type: 'boolean', default: false }
  ],

  // 日志配置模式
  logging: [
    { key: 'level', type: 'string', enum: ['debug', 'info', 'warn', 'error'], default: 'info' },
    { key: 'format', type: 'string', enum: ['json', 'simple'], default: 'json' },
    { key: 'file', type: 'string' },
    { key: 'maxSize', type: 'string', default: '10m' },
    { key: 'maxFiles', type: 'number', default: 5, min: 1 }
  ],

  // HTTP服务器配置模式
  http: [
    { key: 'port', type: 'number', required: true, default: 3000, min: 1, max: 65535 },
    { key: 'host', type: 'string', default: '0.0.0.0' },
    { key: 'timeout', type: 'number', default: 30000, min: 1000 },
    { key: 'maxPayloadSize', type: 'string', default: '10mb' },
    { key: 'cors', type: 'object', default: {} }
  ]
};
