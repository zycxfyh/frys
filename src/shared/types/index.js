/**
 * Shared Types Module
 * 共享类型定义模块
 */

// 类型定义和接口
export const USER_TYPES = {
  ADMIN: 'admin',
  USER: 'user',
  GUEST: 'guest',
  SERVICE: 'service'
};

export const WORKFLOW_TYPES = {
  LINEAR: 'linear',
  PARALLEL: 'parallel',
  CONDITIONAL: 'conditional',
  LOOP: 'loop',
  EVENT_DRIVEN: 'event_driven'
};

export const JOB_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  TIMEOUT: 'timeout',
  SKIPPED: 'skipped'
};

export const EXECUTION_MODES = {
  SYNC: 'sync',
  ASYNC: 'async',
  BATCH: 'batch',
  STREAM: 'stream'
};

export const PRIORITY_LEVELS = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  URGENT: 4,
  CRITICAL: 5
};

export const LOG_LEVELS = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug',
  TRACE: 'trace'
};

export const CACHE_TYPES = {
  MEMORY: 'memory',
  REDIS: 'redis',
  FILESYSTEM: 'filesystem'
};

export const DATABASE_TYPES = {
  SQLITE: 'sqlite',
  POSTGRES: 'postgres',
  MYSQL: 'mysql',
  MONGODB: 'mongodb'
};

export const NOTIFICATION_TYPES = {
  EMAIL: 'email',
  SMS: 'sms',
  WEBHOOK: 'webhook',
  SLACK: 'slack',
  TEAMS: 'teams',
  PUSH: 'push'
};

export const AUTH_PROVIDERS = {
  LOCAL: 'local',
  GOOGLE: 'google',
  GITHUB: 'github',
  FACEBOOK: 'facebook',
  TWITTER: 'twitter',
  AZURE_AD: 'azure_ad',
  SAML: 'saml',
  OAUTH2: 'oauth2'
};

export const HTTP_METHODS = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  DELETE: 'DELETE',
  PATCH: 'PATCH',
  HEAD: 'HEAD',
  OPTIONS: 'OPTIONS'
};

export const CONTENT_TYPES = {
  JSON: 'application/json',
  XML: 'application/xml',
  FORM_URLENCODED: 'application/x-www-form-urlencoded',
  MULTIPART: 'multipart/form-data',
  TEXT: 'text/plain',
  HTML: 'text/html',
  CSV: 'text/csv',
  PDF: 'application/pdf'
};

export const ERROR_TYPES = {
  VALIDATION: 'validation',
  AUTHENTICATION: 'authentication',
  AUTHORIZATION: 'authorization',
  NOT_FOUND: 'not_found',
  CONFLICT: 'conflict',
  TIMEOUT: 'timeout',
  NETWORK: 'network',
  DATABASE: 'database',
  EXTERNAL_API: 'external_api',
  BUSINESS_LOGIC: 'business_logic',
  SYSTEM: 'system',
  UNKNOWN: 'unknown'
};

export const METRIC_TYPES = {
  COUNTER: 'counter',
  GAUGE: 'gauge',
  HISTOGRAM: 'histogram',
  SUMMARY: 'summary'
};

export const EVENT_TYPES = {
  WORKFLOW_STARTED: 'workflow.started',
  WORKFLOW_COMPLETED: 'workflow.completed',
  WORKFLOW_FAILED: 'workflow.failed',
  JOB_STARTED: 'job.started',
  JOB_COMPLETED: 'job.completed',
  JOB_FAILED: 'job.failed',
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_DELETED: 'user.deleted',
  ERROR_OCCURRED: 'error.occurred',
  SYSTEM_HEALTH_CHECK: 'system.health_check',
  CACHE_INVALIDATED: 'cache.invalidated'
};

// 类型守卫函数
export const TYPE_GUARDS = {
  /**
   * 检查值是否为字符串
   * @param {*} value - 要检查的值
   * @returns {boolean} 是否为字符串
   */
  isString: (value) => typeof value === 'string',

  /**
   * 检查值是否为数字
   * @param {*} value - 要检查的值
   * @returns {boolean} 是否为数字
   */
  isNumber: (value) => typeof value === 'number' && !isNaN(value),

  /**
   * 检查值是否为整数
   * @param {*} value - 要检查的值
   * @returns {boolean} 是否为整数
   */
  isInteger: (value) => Number.isInteger(value),

  /**
   * 检查值是否为布尔值
   * @param {*} value - 要检查的值
   * @returns {boolean} 是否为布尔值
   */
  isBoolean: (value) => typeof value === 'boolean',

  /**
   * 检查值是否为对象
   * @param {*} value - 要检查的值
   * @returns {boolean} 是否为对象
   */
  isObject: (value) => value !== null && typeof value === 'object' && !Array.isArray(value),

  /**
   * 检查值是否为数组
   * @param {*} value - 要检查的值
   * @returns {boolean} 是否为数组
   */
  isArray: (value) => Array.isArray(value),

  /**
   * 检查值是否为函数
   * @param {*} value - 要检查的值
   * @returns {boolean} 是否为函数
   */
  isFunction: (value) => typeof value === 'function',

  /**
   * 检查值是否为日期
   * @param {*} value - 要检查的值
   * @returns {boolean} 是否为日期
   */
  isDate: (value) => value instanceof Date && !isNaN(value.getTime()),

  /**
   * 检查值是否为空
   * @param {*} value - 要检查的值
   * @returns {boolean} 是否为空
   */
  isEmpty: (value) => {
    if (value == null) return true;
    if (typeof value === 'string' || Array.isArray(value)) return value.length === 0;
    if (typeof value === 'object') return Object.keys(value).length === 0;
    return false;
  },

  /**
   * 检查值是否为有效的邮箱
   * @param {string} value - 要检查的值
   * @returns {boolean} 是否为有效邮箱
   */
  isEmail: (value) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return typeof value === 'string' && emailRegex.test(value);
  },

  /**
   * 检查值是否为有效的UUID
   * @param {string} value - 要检查的值
   * @returns {boolean} 是否为有效UUID
   */
  isUUID: (value) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return typeof value === 'string' && uuidRegex.test(value);
  },

  /**
   * 检查值是否为有效的URL
   * @param {string} value - 要检查的值
   * @returns {boolean} 是否为有效URL
   */
  isURL: (value) => {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * 检查值是否为有效的端口号
   * @param {number} value - 要检查的值
   * @returns {boolean} 是否为有效端口号
   */
  isPort: (value) => {
    return Number.isInteger(value) && value > 0 && value <= 65535;
  },

  /**
   * 检查值是否为有效的HTTP状态码
   * @param {number} value - 要检查的值
   * @returns {boolean} 是否为有效HTTP状态码
   */
  isHttpStatusCode: (value) => {
    return Number.isInteger(value) && value >= 100 && value <= 599;
  },

  /**
   * 检查值是否为有效的日志级别
   * @param {string} value - 要检查的值
   * @returns {boolean} 是否为有效日志级别
   */
  isLogLevel: (value) => {
    return Object.values(LOG_LEVELS).includes(value);
  },

  /**
   * 检查值是否为有效的用户类型
   * @param {string} value - 要检查的值
   * @returns {boolean} 是否为有效用户类型
   */
  isUserType: (value) => {
    return Object.values(USER_TYPES).includes(value);
  },

  /**
   * 检查值是否为有效的作业状态
   * @param {string} value - 要检查的值
   * @returns {boolean} 是否为有效作业状态
   */
  isJobStatus: (value) => {
    return Object.values(JOB_STATUS).includes(value);
  },

  /**
   * 检查值是否为有效的优先级级别
   * @param {number} value - 要检查的值
   * @returns {boolean} 是否为有效优先级级别
   */
  isPriorityLevel: (value) => {
    return Object.values(PRIORITY_LEVELS).includes(value);
  }
};

// 类型转换函数
export const TYPE_CONVERTERS = {
  /**
   * 转换为字符串
   * @param {*} value - 要转换的值
   * @param {string} defaultValue - 默认值
   * @returns {string} 转换后的字符串
   */
  toString: (value, defaultValue = '') => {
    if (value == null) return defaultValue;
    return String(value);
  },

  /**
   * 转换为数字
   * @param {*} value - 要转换的值
   * @param {number} defaultValue - 默认值
   * @returns {number} 转换后的数字
   */
  toNumber: (value, defaultValue = 0) => {
    const num = Number(value);
    return isNaN(num) ? defaultValue : num;
  },

  /**
   * 转换为整数
   * @param {*} value - 要转换的值
   * @param {number} defaultValue - 默认值
   * @returns {number} 转换后的整数
   */
  toInteger: (value, defaultValue = 0) => {
    const num = parseInt(value, 10);
    return isNaN(num) ? defaultValue : num;
  },

  /**
   * 转换为布尔值
   * @param {*} value - 要转换的值
   * @param {boolean} defaultValue - 默认值
   * @returns {boolean} 转换后的布尔值
   */
  toBoolean: (value, defaultValue = false) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      if (lower === 'true' || lower === '1' || lower === 'yes' || lower === 'on') return true;
      if (lower === 'false' || lower === '0' || lower === 'no' || lower === 'off') return false;
    }
    if (typeof value === 'number') {
      return value !== 0;
    }
    return defaultValue;
  },

  /**
   * 转换为数组
   * @param {*} value - 要转换的值
   * @param {Array} defaultValue - 默认值
   * @returns {Array} 转换后的数组
   */
  toArray: (value, defaultValue = []) => {
    if (Array.isArray(value)) return value;
    if (value == null) return defaultValue;
    return [value];
  },

  /**
   * 转换为日期
   * @param {*} value - 要转换的值
   * @param {Date} defaultValue - 默认值
   * @returns {Date} 转换后的日期
   */
  toDate: (value, defaultValue = new Date()) => {
    if (value instanceof Date) return value;
    const date = new Date(value);
    return isNaN(date.getTime()) ? defaultValue : date;
  }
};

// 验证函数
export const VALIDATORS = {
  /**
   * 验证必填字段
   * @param {*} value - 要验证的值
   * @param {string} fieldName - 字段名
   * @returns {Object} 验证结果
   */
  required: (value, fieldName) => {
    const isValid = value != null && value !== '';
    return {
      valid: isValid,
      message: isValid ? null : `${fieldName} is required`
    };
  },

  /**
   * 验证最小长度
   * @param {string|Array} value - 要验证的值
   * @param {number} minLength - 最小长度
   * @param {string} fieldName - 字段名
   * @returns {Object} 验证结果
   */
  minLength: (value, minLength, fieldName) => {
    const length = value ? value.length : 0;
    const isValid = length >= minLength;
    return {
      valid: isValid,
      message: isValid ? null : `${fieldName} must be at least ${minLength} characters long`
    };
  },

  /**
   * 验证最大长度
   * @param {string|Array} value - 要验证的值
   * @param {number} maxLength - 最大长度
   * @param {string} fieldName - 字段名
   * @returns {Object} 验证结果
   */
  maxLength: (value, maxLength, fieldName) => {
    const length = value ? value.length : 0;
    const isValid = length <= maxLength;
    return {
      valid: isValid,
      message: isValid ? null : `${fieldName} must be no more than ${maxLength} characters long`
    };
  },

  /**
   * 验证邮箱格式
   * @param {string} value - 要验证的值
   * @param {string} fieldName - 字段名
   * @returns {Object} 验证结果
   */
  email: (value, fieldName) => {
    const isValid = TYPE_GUARDS.isEmail(value);
    return {
      valid: isValid,
      message: isValid ? null : `${fieldName} must be a valid email address`
    };
  },

  /**
   * 验证URL格式
   * @param {string} value - 要验证的值
   * @param {string} fieldName - 字段名
   * @returns {Object} 验证结果
   */
  url: (value, fieldName) => {
    const isValid = TYPE_GUARDS.isURL(value);
    return {
      valid: isValid,
      message: isValid ? null : `${fieldName} must be a valid URL`
    };
  },

  /**
   * 验证数字范围
   * @param {number} value - 要验证的值
   * @param {number} min - 最小值
   * @param {number} max - 最大值
   * @param {string} fieldName - 字段名
   * @returns {Object} 验证结果
   */
  range: (value, min, max, fieldName) => {
    const num = Number(value);
    const isValid = !isNaN(num) && num >= min && num <= max;
    return {
      valid: isValid,
      message: isValid ? null : `${fieldName} must be between ${min} and ${max}`
    };
  },

  /**
   * 验证枚举值
   * @param {*} value - 要验证的值
   * @param {Array} allowedValues - 允许的值
   * @param {string} fieldName - 字段名
   * @returns {Object} 验证结果
   */
  oneOf: (value, allowedValues, fieldName) => {
    const isValid = allowedValues.includes(value);
    return {
      valid: isValid,
      message: isValid ? null : `${fieldName} must be one of: ${allowedValues.join(', ')}`
    };
  }
};

// 默认导出
export default {
  USER_TYPES,
  WORKFLOW_TYPES,
  JOB_STATUS,
  EXECUTION_MODES,
  PRIORITY_LEVELS,
  LOG_LEVELS,
  CACHE_TYPES,
  DATABASE_TYPES,
  NOTIFICATION_TYPES,
  AUTH_PROVIDERS,
  HTTP_METHODS,
  CONTENT_TYPES,
  ERROR_TYPES,
  METRIC_TYPES,
  EVENT_TYPES,
  TYPE_GUARDS,
  TYPE_CONVERTERS,
  VALIDATORS
};
