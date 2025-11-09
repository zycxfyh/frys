import {
  createDetailedErrorReporter,
  createStrictTestCleanup,
  setupStrictTestEnvironment,
  strictAssert,
  withTimeout,
} from './test-helpers.js';

/**
 * 输入验证集成测试
 * 验证输入验证中间件的功能和安全性
 */

import { beforeEach, describe, expect, it } from 'vitest';
import ZodInspiredValidation from '../../src/core/ZodInspiredValidation.js';

describe('输入验证集成测试', () => {
  let validator;

  beforeEach(() => {
    validator = new ZodInspiredValidation();

    // 初始化测试所需的schema
    validator.schema('user_input', {
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
          custom: (value) => typeof value === 'string' && value.includes('@'),
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

    validator.schema('api_request', {
      type: 'object',
      properties: {
        endpoint: {
          type: 'string',
          maxLength: 2048,
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

    validator.schema('file_upload', {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          required: true,
          maxLength: 255,
          pattern: /^[^/\\<>:*?"|]+\.[a-zA-Z0-9]+$/,
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

    validator.schema('sql_params', {
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

    validator.schema('command_params', {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          required: true,
          maxLength: 1000,
          pattern: /^[a-zA-Z0-9_\-/.\s]+$/,
        },
        args: {
          type: 'array',
          maxItems: 20,
          items: {
            type: 'string',
            maxLength: 255,
            pattern: /^[^;&|`$()<>]*$/,
          },
        },
        cwd: {
          type: 'string',
          maxLength: 4096,
          pattern: /^[^.]*$/,
        },
        timeout: {
          type: 'number',
          min: 1000,
          max: 300000, // 5分钟
        },
      },
    });
  });

  describe('基础验证功能', () => {
    it('应该验证用户注册数据', async () => {
      const validUserData = {
        username: 'john_doe123',
        email: 'john@example.com',
        password: 'SecurePass123!',
        firstName: 'John',
        lastName: 'Doe',
      };

      const result = validator.validate('user_input', validUserData, {
        securityCheck: true,
        sanitize: true,
      });

      expect(result.success).toBe(true);
      expect(result.data.username).toBe('john_doe123');
      expect(result.errors).toHaveLength(0);
    });

    it('应该拒绝无效的用户数据', async () => {
      const invalidUserData = {
        username: 'a', // 太短
        email: 'invalid-email', // 无效邮箱
        password: '123', // 太短
      };

      const result = validator.validate('user_input', invalidUserData);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(
        result.errors.some(
          (error) =>
            error.includes('too short') || error.includes('minimum length'),
        ),
      ).toBe(true);
    });

    it('应该验证API请求数据', async () => {
      const validApiRequest = {
        endpoint: 'https://api.example.com/users',
        method: 'GET',
        headers: { Authorization: 'Bearer token123' },
        query: { page: 1, limit: 10 },
      };

      const result = validator.validate('api_request', validApiRequest);

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('安全防护功能', () => {
    it('应该阻止SQL注入攻击', async () => {
      const maliciousData = {
        username: "admin'; DROP TABLE users; --",
        email: 'test@example.com',
        password: 'password123',
      };

      const result = validator.validate('user_input', maliciousData, {
        securityCheck: true,
      });

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(
        result.errors.some(
          (error) =>
            error.includes('SQL') ||
            error.includes('sql') ||
            error.includes('dangerous') ||
            error.includes('命令注入') ||
            error.includes('注入'),
        ),
      ).toBe(true);
    });

    it('应该阻止XSS攻击', async () => {
      const xssData = {
        username: 'testuser',
        email: 'test@example.com',
        firstName: '<script>alert("xss")</script>',
      };

      const result = validator.validate('user_input', xssData, {
        securityCheck: true,
      });

      expect(result.success).toBe(false); // XSS攻击应该被阻止
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((error) => error.includes('XSS'))).toBe(true);
    });

    it('应该阻止命令注入', async () => {
      const commandData = {
        command: 'ls',
        args: ['-la', '; rm -rf /', '&& cat /etc/passwd'],
      };

      const result = validator.validate('command_params', commandData, {
        securityCheck: true,
      });

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((error) => error.includes('命令注入'))).toBe(
        true,
      );
    });

    it('应该阻止路径遍历攻击', async () => {
      const pathData = {
        filename: '../../../etc/passwd',
      };

      const result = validator.validate('file_upload', pathData, {
        securityCheck: true,
      });

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((error) => error.includes('路径遍历'))).toBe(
        true,
      );
    });
  });

  describe('数据清理功能', () => {
    it('应该清理XSS向量', async () => {
      const maliciousData = {
        comment: '<script>alert("xss")</script><img src=x onerror=alert(1)>',
      };

      const result = validator.validate('api_request', maliciousData, {
        securityCheck: true,
        sanitize: true,
      });

      expect(result.success).toBe(true);
      expect(result.data.comment).not.toContain('<script>');
      expect(result.data.comment).not.toContain('onerror');
      expect(result.sanitized).toBe(true);
    });

    it('应该清理SQL注入向量', async () => {
      const sqlData = {
        search: "test'; SELECT * FROM users; --",
      };

      const result = validator.validate('api_request', sqlData, {
        securityCheck: true,
        sanitize: true,
      });

      expect(result.success).toBe(true);
      expect(result.data.search).not.toContain('SELECT');
      expect(result.data.search).not.toContain('FROM');
    });
  });

  describe('文件上传验证', () => {
    it('应该验证有效的文件上传', async () => {
      const validFile = {
        filename: 'document.pdf',
        mimetype: 'application/pdf',
        size: 1024000, // 1MB
        encoding: 'base64',
      };

      const result = validator.validate('file_upload', validFile);

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该拒绝无效的文件类型', async () => {
      const invalidFile = {
        filename: 'malicious.exe',
        mimetype: 'application/x-msdownload',
        size: 1024000,
        encoding: 'binary',
      };

      const result = validator.validate('file_upload', invalidFile);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('应该拒绝过大的文件', async () => {
      const largeFile = {
        filename: 'large.pdf',
        mimetype: 'application/pdf',
        size: 100 * 1024 * 1024, // 100MB
        encoding: 'base64',
      };

      const result = validator.validate('file_upload', largeFile);

      expect(result.success).toBe(false);
      expect(result.errors.some((error) => error.includes('too large'))).toBe(
        true,
      );
    });

    it('应该拒绝危险的文件名', async () => {
      const dangerousFile = {
        filename: '../../etc/passwd',
        mimetype: 'text/plain',
        size: 1024,
        encoding: 'utf8',
      };

      const result = validator.validate('file_upload', dangerousFile);

      expect(result.success).toBe(false);
      expect(result.errors.some((error) => error.includes('pattern'))).toBe(
        true,
      );
    });
  });

  describe('SQL参数验证', () => {
    it('应该验证有效的SQL参数', async () => {
      const validSqlParams = {
        table: 'users',
        columns: ['id', 'name', 'email'],
        where: { status: 'active' },
        orderBy: 'created_at DESC',
        limit: 10,
        offset: 0,
      };

      const result = validator.validate('sql_params', validSqlParams, {
        securityCheck: true,
      });

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该拒绝危险的表名', async () => {
      const dangerousSqlParams = {
        table: 'users; DROP TABLE users; --',
        columns: ['id'],
      };

      const result = validator.validate('sql_params', dangerousSqlParams, {
        securityCheck: true,
      });

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('应该验证数组大小限制', async () => {
      const tooManyColumns = {
        table: 'users',
        columns: Array.from({ length: 60 }, (_, i) => `column${i}`), // 60列
      };

      const result = validator.validate('sql_params', tooManyColumns);

      expect(result.success).toBe(false);
      expect(result.errors.some((error) => error.includes('too large'))).toBe(
        true,
      );
    });
  });

  describe('命令参数验证', () => {
    it('应该验证安全的命令参数', async () => {
      const safeCommand = {
        command: 'ls',
        args: ['-la', '/tmp'],
        cwd: '/home/user',
        timeout: 30000,
      };

      const result = validator.validate('command_params', safeCommand, {
        securityCheck: true,
      });

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该拒绝危险的命令', async () => {
      const dangerousCommand = {
        command: 'rm',
        args: ['-rf', '/', '&&', 'cat', '/etc/passwd'],
        cwd: '../../../etc',
      };

      const result = validator.validate('command_params', dangerousCommand, {
        securityCheck: true,
      });

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((error) => error.includes('pattern'))).toBe(
        true,
      );
    });

    it('应该验证超时限制', async () => {
      const longTimeoutCommand = {
        command: 'sleep',
        args: ['10'],
        timeout: 600000, // 10分钟
      };

      const result = validator.validate('command_params', longTimeoutCommand);

      expect(result.success).toBe(false);
      expect(result.errors.some((error) => error.includes('too large'))).toBe(
        true,
      );
    });
  });

  describe('递归安全检查', () => {
    it('应该检查嵌套对象中的安全威胁', async () => {
      const nestedData = {
        user: {
          profile: {
            bio: '<script>alert("xss")</script>',
            settings: {
              notifications: true,
              query: "SELECT * FROM users WHERE id = '1' OR '1'='1'",
            },
          },
        },
        comments: [
          '正常评论',
          '<iframe src="malicious.com"></iframe>',
          {
            text: 'UNION SELECT password FROM users',
            author: 'hacker',
          },
        ],
      };

      const result = validator.validate('api_request', nestedData, {
        securityCheck: true,
      });

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      // 应该检测到多个安全威胁
      const errorText = result.errors.join(' ');
      expect(errorText.includes('XSS') || errorText.includes('SQL')).toBe(true);
    });

    it('应该处理复杂的数据结构', async () => {
      const complexData = {
        metadata: {
          version: '1.0',
          tags: ['web', 'api', 'secure'],
        },
        data: [
          { id: 1, value: 'safe' },
          { id: 2, value: '<script>unsafe</script>' },
          { id: 3, value: 'SELECT * FROM table' },
        ],
        config: {
          database: {
            host: 'localhost',
            query: 'SELECT * FROM users WHERE id = ?',
          },
        },
      };

      const result = validator.validate('api_request', complexData, {
        securityCheck: true,
      });

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('性能和边界测试', () => {
    it('应该处理大对象而不崩溃', async () => {
      const largeObject = {};
      for (let i = 0; i < 1000; i++) {
        largeObject[`key${i}`] = `value${i}`;
      }

      const result = validator.validate('api_request', largeObject);

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });

    it('应该正确处理null和undefined值', async () => {
      const nullData = {
        optional: null,
        undefined: undefined,
        required: 'present',
      };

      const result = validator.validate('api_request', nullData);

      expect(result.success).toBe(true);
    });

    it('应该验证数字边界', async () => {
      const numberData = {
        count: 1000,
        percentage: 150, // 超出范围
        negative: -50, // 超出范围
      };

      const result = validator.validate('api_request', numberData);

      expect(result.success).toBe(true); // api_request模式对数字没有严格限制
    });
  });
});
