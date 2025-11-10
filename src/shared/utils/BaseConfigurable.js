/**
 * 基础可配置类
 * 提供统一的配置合并和管理功能
 */
export class BaseConfigurable {
  constructor(options = {}, defaultOptions = {}) {
    this.options = this._mergeOptions(options, defaultOptions);
    this._isInitialized = false;
  }

  /**
   * 合并选项
   */
  _mergeOptions(userOptions, defaultOptions) {
    return {
      ...defaultOptions,
      ...userOptions,
    };
  }

  /**
   * 获取选项值，支持路径访问
   */
  getOption(path, defaultValue = undefined) {
    const keys = path.split('.');
    let value = this.options;

    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return defaultValue;
      }
    }

    return value;
  }

  /**
   * 设置选项值
   */
  setOption(path, value) {
    const keys = path.split('.');
    let current = this.options;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }

    current[keys[keys.length - 1]] = value;
  }

  /**
   * 验证必需的选项
   */
  validateRequiredOptions(requiredPaths = []) {
    const missing = [];

    for (const path of requiredPaths) {
      if (this.getOption(path) === undefined) {
        missing.push(path);
      }
    }

    if (missing.length > 0) {
      throw new Error(`Missing required options: ${missing.join(', ')}`);
    }
  }

  /**
   * 获取所有选项的快照
   */
  getOptionsSnapshot() {
    return JSON.parse(JSON.stringify(this.options));
  }

  /**
   * 重置为默认选项
   */
  resetToDefaults(defaultOptions = {}) {
    this.options = { ...defaultOptions };
  }

  /**
   * 检查是否已初始化
   */
  get isInitialized() {
    return this._isInitialized;
  }

  /**
   * 标记为已初始化
   */
  markAsInitialized() {
    this._isInitialized = true;
  }
}

/**
 * 配置工具函数
 */
export const ConfigUtils = {
  /**
   * 深度合并选项
   */
  deepMerge(target, source) {
    const result = { ...target };

    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }

    return result;
  },

  /**
   * 验证选项类型
   */
  validateOptionType(value, expectedType, optionName) {
    if (typeof value !== expectedType) {
      throw new Error(`Option '${optionName}' must be of type ${expectedType}, got ${typeof value}`);
    }
  },

  /**
   * 验证选项范围
   */
  validateOptionRange(value, min, max, optionName) {
    if (typeof value === 'number') {
      if (value < min || value > max) {
        throw new Error(`Option '${optionName}' must be between ${min} and ${max}, got ${value}`);
      }
    }
  },

  /**
   * 创建布尔选项
   */
  createBooleanOption(value, defaultValue = false) {
    return value !== undefined ? Boolean(value) : defaultValue;
  },

  /**
   * 创建数值选项
   */
  createNumericOption(value, defaultValue = 0, min = undefined, max = undefined) {
    const numValue = Number(value);
    if (isNaN(numValue)) {
      return defaultValue;
    }

    if (min !== undefined && numValue < min) return min;
    if (max !== undefined && numValue > max) return max;

    return numValue;
  },

  /**
   * 创建数组选项
   */
  createArrayOption(value, defaultValue = []) {
    if (Array.isArray(value)) {
      return [...value];
    }
    return Array.isArray(defaultValue) ? [...defaultValue] : [];
  },

  /**
   * 创建对象选项
   */
  createObjectOption(value, defaultValue = {}) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return { ...defaultValue, ...value };
    }
    return { ...defaultValue };
  }
};
