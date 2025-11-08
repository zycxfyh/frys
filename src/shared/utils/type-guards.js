/**
 * frys - 类型守卫和验证工具
 * 提供类型安全的辅助函数和输入验证
 */

/**
 * 检查值是否为字符串
 */
export function isString(value) {
  return typeof value === 'string';
}

/**
 * 检查值是否为数字
 */
export function isNumber(value) {
  return typeof value === 'number' && !isNaN(value);
}

/**
 * 检查值是否为整数
 */
export function isInteger(value) {
  return isNumber(value) && Number.isInteger(value);
}

/**
 * 检查值是否为布尔值
 */
export function isBoolean(value) {
  return typeof value === 'boolean';
}

/**
 * 检查值是否为对象（非null）
 */
export function isObject(value) {
  return value !== null && typeof value === 'object';
}

/**
 * 检查值是否为数组
 */
export function isArray(value) {
  return Array.isArray(value);
}

/**
 * 检查值是否为函数
 */
export function isFunction(value) {
  return typeof value === 'function';
}

/**
 * 检查值是否为有效的URL
 */
export function isValidUrl(value) {
  if (!isString(value)) return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * 检查值是否为有效的电子邮件
 */
export function isValidEmail(value) {
  if (!isString(value)) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value);
}

/**
 * 检查值是否为有效的UUID
 */
export function isValidUUID(value) {
  if (!isString(value)) return false;
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{4}$/i;
  return uuidRegex.test(value);
}

/**
 * 安全的parseInt包装
 */
export function safeParseInt(value, defaultValue = 0) {
  if (isNumber(value)) return Math.floor(value);
  if (!isString(value)) return defaultValue;

  const parsed = parseInt(value.trim(), 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * 安全的parseFloat包装
 */
export function safeParseFloat(value, defaultValue = 0.0) {
  if (isNumber(value)) return value;
  if (!isString(value)) return defaultValue;

  const parsed = parseFloat(value.trim());
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * 安全的字符串转换
 */
export function safeString(value, defaultValue = '') {
  if (value === null || value === undefined) return defaultValue;
  return String(value);
}

/**
 * 安全的布尔值转换
 */
export function safeBoolean(value, defaultValue = false) {
  if (isBoolean(value)) return value;
  if (isString(value)) {
    const lower = value.toLowerCase().trim();
    if (lower === 'true' || lower === '1' || lower === 'yes' || lower === 'on')
      return true;
    if (lower === 'false' || lower === '0' || lower === 'no' || lower === 'off')
      return false;
  }
  if (isNumber(value)) return value !== 0;
  return defaultValue;
}

/**
 * 深度克隆对象
 */
export function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime());
  if (obj instanceof Array) return obj.map((item) => deepClone(item));

  const cloned = {};
  Object.keys(obj).forEach((key) => {
    cloned[key] = deepClone(obj[key]);
  });
  return cloned;
}

/**
 * 合并对象（深度合并）
 */
export function deepMerge(target, source) {
  if (!isObject(target) || !isObject(source)) return source;

  const result = deepClone(target);

  Object.keys(source).forEach((key) => {
    if (isObject(source[key]) && isObject(result[key])) {
      result[key] = deepMerge(result[key], source[key]);
    } else {
      result[key] = deepClone(source[key]);
    }
  });

  return result;
}

/**
 * 验证对象结构
 */
export function validateObject(obj, schema) {
  if (!isObject(obj) || !isObject(schema)) return false;

  return Object.entries(schema).every(([key, validator]) => {
    if (typeof validator === 'function') {
      return validator(obj[key]);
    }
    if (isObject(validator)) {
      return validateObject(obj[key], validator);
    }
    return false;
  });
}

/**
 * 创建类型守卫函数
 */
export function createTypeGuard(expectedType) {
  return function (value) {
    return typeof value === expectedType;
  };
}

/**
 * 创建范围守卫
 */
export function createRangeGuard(min, max) {
  return function (value) {
    return isNumber(value) && value >= min && value <= max;
  };
}

/**
 * 创建枚举守卫
 */
export function createEnumGuard(validValues) {
  const validSet = new Set(validValues);
  return function (value) {
    return validSet.has(value);
  };
}

/**
 * 清理用户输入（基础XSS防护）
 */
export function sanitizeInput(input) {
  if (!isString(input)) return input;

  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .replace(/on\w+\s*=/gi, '') // 移除事件处理器
    .replace(/javascript:/gi, '') // 移除javascript:协议
    .replace(/vbscript:/gi, '') // 移除vbscript:协议
    .replace(/data:/gi, ''); // 移除data:协议（可能有风险）
}

/**
 * 验证并清理SQL参数（基础防护）
 */
export function sanitizeSqlParam(param) {
  if (!isString(param)) return param;

  // 移除危险字符
  return param.replace(/['";\\]/g, '');
}
