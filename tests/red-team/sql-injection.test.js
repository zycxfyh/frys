import {
  setupStrictTestEnvironment,
  createStrictTestCleanup,
  strictAssert,
  withTimeout,
  createDetailedErrorReporter
} from '../test-helpers.js';

/**
 * SQL注入攻击测试
 * 模拟各种SQL注入攻击向量
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import RedTeamFramework, { AttackVectors } from './red-team-framework.js';
import SQLiteInspiredDatabase from '../../src/core/SQLiteInspiredDatabase.js';

describe('SQL注入攻击测试', () => {
  let redTeam;
  let db;

  beforeEach(() => {
    redTeam = new RedTeamFramework();
    db = new SQLiteInspiredDatabase();

    // 注册SQL注入攻击向量
    redTeam.registerAttack(AttackVectors.SQL_INJECTION, async (payload) => {
      try {
        // 模拟危险的SQL查询
        const maliciousQuery = `SELECT * FROM users WHERE username = '${payload.username}' AND password = '${payload.password}'`;

        // 尝试执行注入查询
        const result = await db.query(maliciousQuery);

        return {
          success: result.success,
          blocked: !result.success,
          details: {
            query: maliciousQuery,
            result: result,
            injected: true
          }
        };
      } catch (error) {
        return {
          success: false,
          blocked: true,
          details: {
            error: error.message,
            injected: false
          }
        };
      }
    });
  });

  afterEach(() => {
    redTeam.cleanup();
  });

  describe('经典SQL注入攻击', () => {
    it('应该阻止单引号注入', async () => {
      const payload = {
        username: "admin' --",
        password: ""
      };

      const result = await redTeam.executeAttack(AttackVectors.SQL_INJECTION, payload);

      expect(result.blocked).toBe(true);
      expect(result.success).toBe(false);
    });

    it('应该阻止UNION注入', async () => {
      const payload = {
        username: "admin' UNION SELECT * FROM sensitive_data --",
        password: ""
      };

      const result = await redTeam.executeAttack(AttackVectors.SQL_INJECTION, payload);

      expect(result.blocked).toBe(true);
      expect(result.success).toBe(false);
    });

    it('应该阻止DROP TABLE注入', async () => {
      const payload = {
        username: "admin'; DROP TABLE users; --",
        password: ""
      };

      const result = await redTeam.executeAttack(AttackVectors.SQL_INJECTION, payload);

      expect(result.blocked).toBe(true);
      expect(result.success).toBe(false);
    });

    it('应该阻止盲注攻击', async () => {
      const payload = {
        username: "admin' AND 1=1 --",
        password: ""
      };

      const result = await redTeam.executeAttack(AttackVectors.SQL_INJECTION, payload);

      expect(result.blocked).toBe(true);
      expect(result.success).toBe(false);
    });

    it('应该阻止时间延迟注入', async () => {
      const payload = {
        username: "admin' AND SLEEP(5) --",
        password: ""
      };

      const startTime = Date.now();
      const result = await redTeam.executeAttack(AttackVectors.SQL_INJECTION, payload);
      const endTime = Date.now();

      expect(result.blocked).toBe(true);
      expect(result.success).toBe(false);
      expect(endTime - startTime).toBeLessThan(1000); // 不应该有延迟
    });
  });

  describe('高级SQL注入攻击', () => {
    it('应该阻止注释绕过', async () => {
      const payload = {
        username: "admin'/**/UNION/**/SELECT/**/*/**/FROM/**/users--",
        password: ""
      };

      const result = await redTeam.executeAttack(AttackVectors.SQL_INJECTION, payload);

      expect(result.blocked).toBe(true);
      expect(result.success).toBe(false);
    });

    it('应该阻止十六进制编码注入', async () => {
      const payload = {
        username: "admin' UNION SELECT 0x73656c656374202a2066726f6d207573657273 --",
        password: ""
      };

      const result = await redTeam.executeAttack(AttackVectors.SQL_INJECTION, payload);

      expect(result.blocked).toBe(true);
      expect(result.success).toBe(false);
    });

    it('应该阻止Base64编码注入', async () => {
      const payload = {
        username: "admin'; EXEC('c2VsZWN0ICogZnJvbSB1c2Vycw==') --",
        password: ""
      };

      const result = await redTeam.executeAttack(AttackVectors.SQL_INJECTION, payload);

      expect(result.blocked).toBe(true);
      expect(result.success).toBe(false);
    });
  });

  describe('特殊字符注入攻击', () => {
    it('应该阻止反引号注入', async () => {
      const payload = {
        username: "`admin`",
        password: "`password`"
      };

      const result = await redTeam.executeAttack(AttackVectors.SQL_INJECTION, payload);

      expect(result.blocked).toBe(true);
      expect(result.success).toBe(false);
    });

    it('应该阻止括号注入', async () => {
      const payload = {
        username: "admin' AND (1=1) --",
        password: ""
      };

      const result = await redTeam.executeAttack(AttackVectors.SQL_INJECTION, payload);

      expect(result.blocked).toBe(true);
      expect(result.success).toBe(false);
    });

    it('应该阻止分号注入', async () => {
      const payload = {
        username: "admin'; SELECT * FROM users;",
        password: ""
      };

      const result = await redTeam.executeAttack(AttackVectors.SQL_INJECTION, payload);

      expect(result.blocked).toBe(true);
      expect(result.success).toBe(false);
    });
  });

  describe('宽字节注入攻击', () => {
    it('应该阻止宽字节编码注入', async () => {
      const payload = {
        username: "admin%df%27", // %df%27 是宽字节编码的 '
        password: ""
      };

      const result = await redTeam.executeAttack(AttackVectors.SQL_INJECTION, payload);

      expect(result.blocked).toBe(true);
      expect(result.success).toBe(false);
    });
  });

  describe('批量注入测试', () => {
    const injectionPayloads = [
      { username: "' OR '1'='1", password: "" },
      { username: "admin' OR 1=1 --", password: "" },
      { username: "'; EXEC xp_cmdshell('dir') --", password: "" },
      { username: "admin' ; --", password: "" },
      { username: "admin' UNION SELECT password FROM users --", password: "" },
      { username: "1' ORDER BY 1 --", password: "" },
      { username: "1' GROUP BY 1 --", password: "" },
      { username: "1' HAVING 1=1 --", password: "" },
      { username: "admin' AND SUBSTRING((SELECT @@VERSION),1,1)='M' --", password: "" },
      { username: "admin' AND ASCII(SUBSTRING((SELECT password FROM users LIMIT 1),1,1))>64 --", password: "" }
    ];

    it.each(injectionPayloads)('应该阻止SQL注入攻击: %j', async (payload) => {
      const result = await redTeam.executeAttack(AttackVectors.SQL_INJECTION, payload);

      expect(result.blocked).toBe(true);
      expect(result.success).toBe(false);
    });
  });

  describe('性能测试', () => {
    it('应该快速检测和阻止注入攻击', async () => {
      const payload = {
        username: "admin' UNION SELECT * FROM users --",
        password: ""
      };

      const startTime = performance.now();
      const result = await redTeam.executeAttack(AttackVectors.SQL_INJECTION, payload);
      const endTime = performance.now();

      expect(result.blocked).toBe(true);
      expect(result.success).toBe(false);
      expect(endTime - startTime).toBeLessThan(100); // 应该在100ms内响应
    });
  });
});
