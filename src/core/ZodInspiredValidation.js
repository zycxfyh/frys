/**
 * ZodInspiredValidation 风格的验证系统
 * 借鉴 Zod 的核心理念，增强输入验证和安全防护
 * 重构版本：应用SOLID原则，单一职责和开闭原则
 */
import {
  sanitizeInput,
} from '../utils/type-guards.js';

// 验证器接口 - 依赖倒置原则
class BaseValidator {
  validate(_data, _schema, _context) {
    throw new Error('validate method must be implemented by subclass');
  }
}

// 基础类型验证器
class TypeValidator extends BaseValidator {
  validate(data, schema, context) {
    if (schema.required && (data === null || data === undefined || data === '')) {
      context.errors.push('Required field is missing');
      return false;
    }

    if (schema.type && typeof data !== schema.type && data !== null && data !== undefined) {
      context.errors.push(`Expected type ${schema.type}, got ${typeof data}`);
      return false;
    }

    return true;
  }
}

// 字符串验证器
class StringValidator extends BaseValidator {
  validate(data, schema, context) {
    if (schema.type !== 'string' || typeof data !== 'string') {
      return true; // 不是字符串类型，跳过
    }

    if (schema.minLength && data.length < schema.minLength) {
      context.errors.push(`String too short, minimum length is ${schema.minLength}`);
      return false;
    }

    if (schema.maxLength && data.length > schema.maxLength) {
      context.errors.push(`String too long, maximum length is ${schema.maxLength}`);
      return false;
    }

    if (schema.pattern && !schema.pattern.test(data)) {
      context.errors.push('String does not match required pattern');
      return false;
    }

    return true;
  }
}

// 数字验证器
class NumberValidator extends BaseValidator {
  validate(data, schema, context) {
    if (schema.type !== 'number' || typeof data !== 'number') {
      return true;
    }

    if (schema.minimum !== undefined && data < schema.minimum) {
      context.errors.push(`Number too small, minimum is ${schema.minimum}`);
      return false;
    }

    if (schema.maximum !== undefined && data > schema.maximum) {
      context.errors.push(`Number too large, maximum is ${schema.maximum}`);
      return false;
    }

    return true;
  }
}

// 数组验证器
class ArrayValidator extends BaseValidator {
  validate(data, schema, context) {
    if (schema.type !== 'array' || !Array.isArray(data)) {
      return true;
    }

    if (schema.minItems !== undefined && data.length < schema.minItems) {
      context.errors.push(`Array too short, minimum items is ${schema.minItems}`);
      return false;
    }

    if (schema.maxItems !== undefined && data.length > schema.maxItems) {
      context.errors.push(`Array too long, maximum items is ${schema.maxItems}`);
      return false;
    }

    return true;
  }
}

// 对象验证器
class ObjectValidator extends BaseValidator {
  validate(data, schema, context) {
    if (schema.type !== 'object' || typeof data !== 'object' || data === null) {
      return true;
    }

    if (schema.properties) {
      for (const [prop, propSchema] of Object.entries(schema.properties)) {
        if (data.hasOwnProperty(prop)) {
          // 递归验证嵌套属性
          const nestedContext = { errors: [], warnings: [] };
          const validators = [new TypeValidator(), new StringValidator(), new NumberValidator()];
          for (const validator of validators) {
            if (!validator.validate(data[prop], propSchema, nestedContext)) {
              break;
            }
          }
          context.errors.push(...nestedContext.errors.map(err => `${prop}: ${err}`));
        } else if (propSchema.required) {
          context.errors.push(`Missing required property: ${prop}`);
        }
      }
    }

    return context.errors.length === 0;
  }
}

// 自定义验证器
class CustomValidator extends BaseValidator {
  validate(data, schema, context) {
    if (schema.customValidators) {
      for (const validator of schema.customValidators) {
        try {
          const result = validator(data);
          if (result !== true) {
            context.errors.push(result || 'Custom validation failed');
            return false;
          }
        } catch (error) {
          context.errors.push(`Custom validation error: ${error.message}`);
          return false;
        }
      }
    }
    return true;
  }
}

class ZodInspiredValidation {
  /**
   * 构造函数
   * 初始化验证管理器
   */
  constructor() {
    this.schemas = new Map(); // Schema定义
    this.validations = []; // 验证历史
    this.securityRules = new Map(); // 安全规则

    // 初始化验证器链 - 开闭原则，支持扩展
    this.validators = [
      new TypeValidator(),
      new StringValidator(),
      new NumberValidator(),
      new ArrayValidator(),
      new ObjectValidator(),
      new CustomValidator()
    ];

    this.initializeSecurityRules();
  }

  /**
   * 添加自定义验证器 - 开闭原则
   * @param {BaseValidator} validator - 验证器实例
   */
  addValidator(validator) {
    if (!(validator instanceof BaseValidator)) {
      throw new Error('Validator must extend BaseValidator');
    }
    this.validators.push(validator);
  }

  /**
   * 移除验证器
   * @param {Function} validatorClass - 验证器类
   */
  removeValidator(validatorClass) {
    this.validators = this.validators.filter(v => !(v instanceof validatorClass));
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
      pattern: /(\.\.[/\\]|\.\.[/\\]|\/etc\/|\/bin\/|\/usr\/|\/var\/|\/home\/|\/root\/|\/boot\/|windows\/|system32\/)/gi,
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

    const context = {
      success: true,
      data,
      errors: [],
      warnings: [],
      sanitized: false,
    };

    // 使用验证器链进行验证 - 开闭原则
    for (const validator of this.validators) {
      if (!validator.validate(data, schema, context)) {
        context.success = false;
      }
    }

    // 安全检查（如果启用了安全验证）
    if (options.securityCheck !== false) {
      const securityResult = this.performSecurityChecks(data, options);
      if (!securityResult.safe) {
        context.success = false;
        context.errors.push(...securityResult.errors);
      }
      if (securityResult.warnings.length > 0) {
        context.warnings.push(...securityResult.warnings);
      }
    }

    // 数据清理（如果启用了清理）
    if (options.sanitize && typeof data === 'string') {
      context.data = sanitizeInput(data);
      context.sanitized = true;
    }

    this.validations.push({
      schema: schemaName,
      data,
      result: context.success,
      timestamp: new Date(),
      errors: context.errors.length,
      warnings: context.warnings.length,
    });

    return context;
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
          ? `${(
              (this.validations.filter((v) => v.result).length /
                this.validations.length) *
              100
            ).toFixed(2)  }%`
          : '0%',
    };
  }
}

export default ZodInspiredValidation;
