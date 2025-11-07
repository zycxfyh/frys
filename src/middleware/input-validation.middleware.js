/**
 * frys 输入验证中间件
 * 提供全面的输入验证和安全防护
 */

import ZodInspiredValidation from '../core/ZodInspiredValidation.js';
import {
  sanitizeInput,
  validateObject,
  createTypeGuard,
  isValidEmail,
  isValidUrl,
  isValidUUID,
} from '../utils/type-guards.js';
import { frysError } from '../core/frysError.js';

class InputValidationMiddleware {
  constructor(options = {}) {
    this.validator = new ZodInspiredValidation();
    this.options = {
      failOnSecurityViolation: options.failOnSecurityViolation !== false,
      sanitizeInput: options.sanitizeInput !== false,
      logViolations: options.logViolations !== false,
      ...options,
    };

    this.initializeSchemas();
  }

  /**
   * 初始化预定义的验证模式
   */
  initializeSchemas() {
    // 用户输入验证模式
    this.validator.schema('user_input', {
      type: 'object',
      properties: {
        username: {
          type: 'string',
          required: true,
          minLength: 3,
          maxLength: 50,
          pattern: /^[a-zA-Z0-9_-]+$/,
        },
        email: {
          type: 'string',
          required: true,
          maxLength: 254,
          custom: isValidEmail,
        },
        password: {
          type: 'string',
          required: true,
          minLength: 8,
          maxLength: 128,
        },
        firstName: {
          type: 'string',
          maxLength: 50,
        },
        lastName: {
          type: 'string',
          maxLength: 50,
        },
      },
    });

    // API请求验证模式
    this.validator.schema('api_request', {
      type: 'object',
      properties: {
        endpoint: {
          type: 'string',
          maxLength: 2048,
          custom: isValidUrl,
        },
        method: {
          type: 'string',
          enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'],
        },
        headers: {
          type: 'object',
          maxProperties: 50,
        },
        body: {
          type: 'object',
          maxProperties: 100,
        },
        query: {
          type: 'object',
          maxProperties: 20,
        },
        params: {
          type: 'object',
          maxProperties: 10,
        },
      },
    });

    // 文件上传验证模式
    this.validator.schema('file_upload', {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          required: true,
          maxLength: 255,
          pattern: /^[^\/\\<>:*?"|]+\.[a-zA-Z0-9]+$/,
        },
        mimetype: {
          type: 'string',
          required: true,
          enum: [
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp',
            'application/pdf',
            'text/plain',
            'application/json',
            'application/zip',
            'application/x-zip-compressed',
          ],
        },
        size: {
          type: 'number',
          required: true,
          max: 10 * 1024 * 1024, // 10MB
        },
        encoding: {
          type: 'string',
          enum: ['7bit', '8bit', 'binary', 'quoted-printable', 'base64'],
        },
      },
    });

    // SQL查询参数验证模式
    this.validator.schema('sql_params', {
      type: 'object',
      properties: {
        table: {
          type: 'string',
          required: true,
          maxLength: 64,
          pattern: /^[a-zA-Z_][a-zA-Z0-9_]*$/,
        },
        columns: {
          type: 'array',
          maxItems: 50,
          items: {
            type: 'string',
            pattern: /^[a-zA-Z_][a-zA-Z0-9_]*$/,
          },
        },
        where: {
          type: 'object',
          maxProperties: 10,
        },
        orderBy: {
          type: 'string',
          maxLength: 100,
          pattern: /^[a-zA-Z_][a-zA-Z0-9_]*(\s+(ASC|DESC))?$/,
        },
        limit: {
          type: 'number',
          min: 1,
          max: 1000,
        },
        offset: {
          type: 'number',
          min: 0,
          max: 1000000,
        },
      },
    });

    // 命令执行参数验证模式
    this.validator.schema('command_params', {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          required: true,
          maxLength: 1000,
          // 只允许安全的命令
          pattern: /^[a-zA-Z0-9_\-\/\.\s]+$/,
        },
        args: {
          type: 'array',
          maxItems: 20,
          items: {
            type: 'string',
            maxLength: 255,
            // 不允许特殊字符
            pattern: /^[^;&|`$()<>]*$/,
          },
        },
        cwd: {
          type: 'string',
          maxLength: 4096,
          // 防止路径遍历
          pattern: /^[^.]*$/,
        },
        timeout: {
          type: 'number',
          min: 1000,
          max: 300000, // 5分钟
        },
      },
    });

    console.log('🛡️ 输入验证中间件已初始化');
  }

  /**
   * Express中间件函数
   */
  middleware() {
    return async (req, res, next) => {
      try {
        // 验证和清理请求体
        if (req.body && Object.keys(req.body).length > 0) {
          const bodyResult = await this.validateRequestBody(req.body, req.path);
          if (!bodyResult.valid) {
            return this.sendValidationError(res, bodyResult.errors, 400);
          }
          req.body = bodyResult.data;
        }

        // 验证查询参数
        if (req.query && Object.keys(req.query).length > 0) {
          const queryResult = await this.validateQueryParams(req.query);
          if (!queryResult.valid) {
            return this.sendValidationError(res, queryResult.errors, 400);
          }
          req.query = queryResult.data;
        }

        // 验证路径参数
        if (req.params && Object.keys(req.params).length > 0) {
          const paramsResult = await this.validatePathParams(req.params);
          if (!paramsResult.valid) {
            return this.sendValidationError(res, paramsResult.errors, 400);
          }
          req.params = paramsResult.data;
        }

        // 验证文件上传
        if (req.files || req.file) {
          const filesResult = await this.validateFileUploads(
            req.files || [req.file],
          );
          if (!filesResult.valid) {
            return this.sendValidationError(res, filesResult.errors, 400);
          }
        }

        next();
      } catch (error) {
        console.error('输入验证中间件错误:', error);
        return this.sendValidationError(
          res,
          ['Internal validation error'],
          500,
        );
      }
    };
  }

  /**
   * 验证请求体
   */
  async validateRequestBody(body, path) {
    const result = {
      valid: true,
      data: body,
      errors: [],
    };

    try {
      // 根据路径选择验证模式
      let schemaName = 'api_request';

      if (
        path.includes('/users') &&
        (path.includes('/register') || path.includes('/profile'))
      ) {
        schemaName = 'user_input';
      } else if (path.includes('/upload') || path.includes('/files')) {
        // 文件上传的body验证会由文件验证处理
        return result;
      }

      const validationResult = this.validator.validate(schemaName, body, {
        securityCheck: true,
        sanitize: this.options.sanitizeInput,
      });

      result.valid = validationResult.success;
      result.data = validationResult.data;

      if (validationResult.errors && validationResult.errors.length > 0) {
        result.errors.push(...validationResult.errors);
      }

      // 记录安全警告
      if (
        validationResult.warnings &&
        validationResult.warnings.length > 0 &&
        this.options.logViolations
      ) {
        console.warn('🔐 安全警告:', validationResult.warnings);
      }
    } catch (error) {
      result.valid = false;
      result.errors.push(`Validation error: ${error.message}`);
    }

    return result;
  }

  /**
   * 验证查询参数
   */
  async validateQueryParams(query) {
    const result = {
      valid: true,
      data: {},
      errors: [],
    };

    try {
      // 清理和验证每个查询参数
      for (const [key, value] of Object.entries(query)) {
        // 检查参数名安全性
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
          result.errors.push(`Invalid query parameter name: ${key}`);
          result.valid = false;
          continue;
        }

        // 清理参数值
        let cleanedValue = value;
        if (typeof value === 'string') {
          cleanedValue = sanitizeInput(value);

          // 检查SQL注入
          if (this.containsSqlInjection(cleanedValue)) {
            result.errors.push(
              `Potential SQL injection in query parameter: ${key}`,
            );
            result.valid = false;
            continue;
          }
        }

        result.data[key] = cleanedValue;
      }
    } catch (error) {
      result.valid = false;
      result.errors.push(`Query validation error: ${error.message}`);
    }

    return result;
  }

  /**
   * 验证路径参数
   */
  async validatePathParams(params) {
    const result = {
      valid: true,
      data: {},
      errors: [],
    };

    try {
      for (const [key, value] of Object.entries(params)) {
        // 检查参数名安全性
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
          result.errors.push(`Invalid path parameter name: ${key}`);
          result.valid = false;
          continue;
        }

        // 验证UUID参数
        if (key.includes('id') || key.includes('uuid')) {
          if (!isValidUUID(value)) {
            result.errors.push(`Invalid UUID format for parameter: ${key}`);
            result.valid = false;
            continue;
          }
        }

        // 检查路径遍历攻击
        if (typeof value === 'string' && this.containsPathTraversal(value)) {
          result.errors.push(`Potential path traversal in parameter: ${key}`);
          result.valid = false;
          continue;
        }

        result.data[key] = value;
      }
    } catch (error) {
      result.valid = false;
      result.errors.push(`Path validation error: ${error.message}`);
    }

    return result;
  }

  /**
   * 验证文件上传
   */
  async validateFileUploads(files) {
    const result = {
      valid: true,
      errors: [],
    };

    try {
      const fileArray = Array.isArray(files) ? files : [files];

      for (const file of fileArray) {
        if (!file) continue;

        const fileData = {
          filename: file.originalname || file.name,
          mimetype: file.mimetype,
          size: file.size,
          encoding: file.encoding,
        };

        const validationResult = this.validator.validate(
          'file_upload',
          fileData,
          {
            securityCheck: true,
          },
        );

        if (!validationResult.success) {
          result.valid = false;
          result.errors.push(
            ...validationResult.errors.map(
              (err) => `File validation error: ${err}`,
            ),
          );
        }

        // 检查文件内容（如果需要）
        if (this.options.scanFileContent && file.buffer) {
          const contentCheck = this.checkFileContent(
            file.buffer,
            file.mimetype,
          );
          if (!contentCheck.safe) {
            result.valid = false;
            result.errors.push(...contentCheck.errors);
          }
        }
      }
    } catch (error) {
      result.valid = false;
      result.errors.push(`File validation error: ${error.message}`);
    }

    return result;
  }

  /**
   * 检查文件内容安全性
   */
  checkFileContent(buffer, mimetype) {
    const result = {
      safe: true,
      errors: [],
    };

    try {
      const content = buffer.toString('utf8', 0, Math.min(buffer.length, 1024));

      // 检查文本文件中的危险内容
      if (mimetype.startsWith('text/') || mimetype === 'application/json') {
        if (content.includes('<script') || content.includes('javascript:')) {
          result.safe = false;
          result.errors.push('File contains potential XSS content');
        }

        // 检查SQL注入模式
        if (this.containsSqlInjection(content)) {
          result.safe = false;
          result.errors.push('File contains potential SQL injection patterns');
        }
      }
    } catch (error) {
      // 如果无法读取内容，认为不安全
      result.safe = false;
      result.errors.push('Unable to scan file content');
    }

    return result;
  }

  /**
   * 检查SQL注入
   */
  containsSqlInjection(value) {
    if (typeof value !== 'string') return false;

    const sqlPatterns = [
      /(\bUNION\b|\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bDROP\b)/i,
      /('|(\\x27)|(\\x2D\\x2D)|(\\#)|(\%27)|(\%23))/,
      /(\;|\-\-|\#|\/\*|\*\/)/,
    ];

    return sqlPatterns.some((pattern) => pattern.test(value));
  }

  /**
   * 检查路径遍历
   */
  containsPathTraversal(value) {
    if (typeof value !== 'string') return false;

    const traversalPatterns = [
      /\.\.[\/\\]/,
      /\/etc\//,
      /\/bin\//,
      /\/usr\//,
      /\/var\//,
      /\/home\//,
      /\/root\//,
      /windows\//i,
      /system32\//i,
    ];

    return traversalPatterns.some((pattern) => pattern.test(value));
  }

  /**
   * 发送验证错误响应
   */
  sendValidationError(res, errors, statusCode = 400) {
    const error = new frysError(
      'VALIDATION_ERROR',
      'Input validation failed',
      { errors, statusCode },
    );

    if (this.options.logViolations) {
      console.warn('🚫 输入验证失败:', errors);
    }

    return res.status(statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    });
  }

  /**
   * 获取验证统计
   */
  getStats() {
    return this.validator.getStats();
  }
}

export default InputValidationMiddleware;
