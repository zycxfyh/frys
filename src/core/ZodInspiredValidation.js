/**
 * ZodInspiredValidation 风格的验证系统
 * 借鉴 Zod 的核心理念，增强输入验证和安全防护
 */
import {
  sanitizeInput,
  validateObject,
  createTypeGuard,
} from '../utils/type-guards.js';

class ZodInspiredValidation {
  /**
   * 构造函数
   * 初始化验证管理器
   */
  constructor() {
    this.schemas = new Map(); // Schema定义
    this.validations = []; // 验证历史
    this.securityRules = new Map(); // 安全规则
    this.initializeSecurityRules();
  }

  /**
   * 初始化安全规则
   */
  initializeSecurityRules() {
    // SQL注入防护规则
    this.securityRules.set('sql_injection', {
      pattern:
        /(\bUNION\b|\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bDROP\b|\bCREATE\b|\bALTER\b|\bEXEC\b|\bEXECUTE\b|\bSCRIPT\b)/gi,
      severity: 'high',
      message: '检测到潜在的SQL注入模式',
    });

    // XSS攻击防护规则
    this.securityRules.set('xss_attack', {
      pattern:
        /(<script[^>]*>[\s\S]*?<\/script>|<iframe[^>]*>|<object[^>]*>|<embed[^>]*>|<form[^>]*>|<input[^>]*>|<meta[^>]*>|<link[^>]*>|<style[^>]*>)/gi,
      severity: 'high',
      message: '检测到潜在的XSS攻击向量',
    });

    // 命令注入防护规则
    this.securityRules.set('command_injection', {
      pattern: /(\||&|;|\$\(|`|\$\{|\$\(.*\$\))/g,
      severity: 'critical',
      message: '检测到潜在的命令注入',
    });

    // 路径遍历防护规则
    this.securityRules.set('path_traversal', {
      pattern:
        /(\.\.[\/\\]|\.\.[\/\\]|\/etc\/|\/bin\/|\/usr\/|\/var\/|\/home\/|\/root\/|\/boot\/|windows\/|system32\/)/gi,
      severity: 'high',
      message: '检测到潜在的路径遍历攻击',
    });
  }

  /**
   * 创建Schema
   * @param {string} name - Schema名称
   * @param {Object} definition - Schema定义
   */
  schema(name, definition) {
    this.schemas.set(name, definition);
    console.log(`📋 Schema已创建: ${name}`);
  }

  /**
   * 验证数据
   * @param {string} schemaName - Schema名称
   * @param {any} data - 要验证的数据
   * @param {Object} options - 验证选项
   * @returns {Object} 验证结果
   */
  validate(schemaName, data, options = {}) {
    const schema = this.schemas.get(schemaName);
    if (!schema) {
      throw new Error(`Schema ${schemaName} not found`);
    }

    const result = {
      success: true,
      data: data,
      errors: [],
      warnings: [],
      sanitized: false,
    };

    // 基本类型验证
    if (
      schema.required &&
      (data === null || data === undefined || data === '')
    ) {
      result.success = false;
      result.errors.push('Required field is missing');
    }

    if (
      schema.type &&
      typeof data !== schema.type &&
      data !== null &&
      data !== undefined
    ) {
      result.success = false;
      result.errors.push(`Expected type ${schema.type}, got ${typeof data}`);
    }

    // 字符串特定验证
    if (schema.type === 'string' && typeof data === 'string') {
      if (schema.minLength && data.length < schema.minLength) {
        result.success = false;
        result.errors.push(
          `String too short, minimum length is ${schema.minLength}`,
        );
      }
      if (schema.maxLength && data.length > schema.maxLength) {
        result.success = false;
        result.errors.push(
          `String too long, maximum length is ${schema.maxLength}`,
        );
      }
      if (schema.pattern && !schema.pattern.test(data)) {
        result.success = false;
        result.errors.push('String does not match required pattern');
      }
    }

    // 数字特定验证
    if (schema.type === 'number' && typeof data === 'number') {
      if (schema.min !== undefined && data < schema.min) {
        result.success = false;
        result.errors.push(`Number too small, minimum value is ${schema.min}`);
      }
      if (schema.max !== undefined && data > schema.max) {
        result.success = false;
        result.errors.push(`Number too large, maximum value is ${schema.max}`);
      }
    }

    // 数组验证
    if (schema.type === 'array' && Array.isArray(data)) {
      if (schema.minItems && data.length < schema.minItems) {
        result.success = false;
        result.errors.push(
          `Array too small, minimum items is ${schema.minItems}`,
        );
      }
      if (schema.maxItems && data.length > schema.maxItems) {
        result.success = false;
        result.errors.push(
          `Array too large, maximum items is ${schema.maxItems}`,
        );
      }
    }

    // 安全检查（如果启用了安全验证）
    if (options.securityCheck !== false) {
      const securityResult = this.performSecurityChecks(data, options);
      if (!securityResult.safe) {
        result.success = false;
        result.errors.push(...securityResult.errors);
      }
      if (securityResult.warnings.length > 0) {
        result.warnings.push(...securityResult.warnings);
      }
    }

    // 数据清理（如果启用了清理）
    if (options.sanitize && typeof data === 'string') {
      result.data = sanitizeInput(data);
      result.sanitized = true;
    }

    this.validations.push({
      schema: schemaName,
      data,
      result: result.success,
      timestamp: new Date(),
      errors: result.errors.length,
      warnings: result.warnings.length,
    });

    return result;
  }

  /**
   * 执行安全检查
   * @param {any} data - 要检查的数据
   * @param {Object} options - 检查选项
   * @returns {Object} 安全检查结果
   */
  performSecurityChecks(data, options = {}) {
    const result = {
      safe: true,
      errors: [],
      warnings: [],
    };

    if (!data) return result;

    // 递归检查对象和数组
    const checkValue = (value, path = '') => {
      if (typeof value === 'string') {
        for (const [ruleName, rule] of this.securityRules) {
          if (rule.pattern.test(value)) {
            const message = `${rule.message}${path ? ` (路径: ${path})` : ''}`;
            if (rule.severity === 'critical') {
              result.safe = false;
              result.errors.push(message);
            } else {
              result.warnings.push(message);
            }
          }
        }
      } else if (Array.isArray(value)) {
        value.forEach((item, index) => {
          checkValue(item, `${path}[${index}]`);
        });
      } else if (typeof value === 'object' && value !== null) {
        Object.entries(value).forEach(([key, val]) => {
          checkValue(val, path ? `${path}.${key}` : key);
        });
      }
    };

    checkValue(data);
    return result;
  }

  /**
   * 获取验证统计
   * @returns {Object} 统计信息
   */
  getStats() {
    return {
      schemas: this.schemas.size,
      validations: this.validations.length,
      successRate:
        this.validations.length > 0
          ? (
              (this.validations.filter((v) => v.result).length /
                this.validations.length) *
              100
            ).toFixed(2) + '%'
          : '0%',
    };
  }
}

export default ZodInspiredValidation;
