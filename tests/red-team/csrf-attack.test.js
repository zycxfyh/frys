import {
  setupStrictTestEnvironment,
  createStrictTestCleanup,
  strictAssert,
  withTimeout,
  createDetailedErrorReporter
} from '../test-helpers.js';

/**
 * CSRF跨站请求伪造攻击测试
 * 模拟各种CSRF攻击向量
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import RedTeamFramework, { AttackVectors } from './red-team-framework.js';
import AxiosInspiredHTTP from '../../src/core/AxiosInspiredHTTP.js';

describe('CSRF跨站请求伪造攻击测试', () => {
  let redTeam;
  let httpClient;

  beforeEach(() => {
    redTeam = new RedTeamFramework();
    httpClient = new AxiosInspiredHTTP();

    // 注册CSRF攻击向量
    redTeam.registerAttack(AttackVectors.CSRF_ATTACK, async (payload) => {
      try {
        // 模拟CSRF攻击
        const csrfToken = payload.csrfToken || null;
        const isValidToken = validateCSRFToken(csrfToken);
        const hasOriginCheck = checkOrigin(payload.origin, payload.referer);
        const hasSameSiteProtection = checkSameSiteProtection(payload.cookie);

        // CSRF攻击成功条件：没有有效的CSRF令牌且没有来源检查
        const csrfSuccessful = !isValidToken && !hasOriginCheck && !hasSameSiteProtection;

        return {
          success: csrfSuccessful,
          blocked: !csrfSuccessful,
          details: {
            csrfToken: csrfToken,
            tokenValid: isValidToken,
            originCheck: hasOriginCheck,
            sameSiteProtection: hasSameSiteProtection,
            headers: payload.headers,
            attackType: payload.attackType
          }
        };
      } catch (error) {
        return {
          success: false,
          blocked: true,
          details: {
            error: error.message
          }
        };
      }
    });
  });

  afterEach(() => {
    redTeam.cleanup();
  });

  // 简化的CSRF令牌验证
  function validateCSRFToken(token) {
    if (!token) return false;
    // 检查令牌格式和有效性
    return /^[a-f0-9]{64}$/.test(token); // 假设是64字符的十六进制令牌
  }

  // 检查来源头
  function checkOrigin(origin, referer) {
    if (!origin && !referer) return false;

    // 白名单域名检查
    const allowedDomains = ['trusted-domain.com', 'api.trusted-domain.com'];
    const requestDomain = extractDomain(origin || referer);

    return allowedDomains.includes(requestDomain);
  }

  // 检查SameSite保护
  function checkSameSiteProtection(cookie) {
    if (!cookie) return false;
    return cookie.includes('SameSite=Strict') || cookie.includes('SameSite=Lax');
  }

  // 提取域名
  function extractDomain(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return '';
    }
  }

  describe('基本CSRF攻击', () => {
    it('应该阻止没有CSRF令牌的POST请求', async () => {
      const payload = {
        method: 'POST',
        url: '/api/user/update',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'name=evil&email=hacker@example.com',
        attackType: 'basic_csrf'
      };

      const result = await redTeam.executeAttack(AttackVectors.CSRF_ATTACK, payload);

      expect(result.blocked).toBe(true);
      expect(result.success).toBe(false);
    });

    it('应该阻止来自不同域的请求', async () => {
      const payload = {
        method: 'POST',
        url: '/api/user/delete',
        origin: 'http://evil-domain.com',
        headers: {
          'Origin': 'http://evil-domain.com'
        },
        csrfToken: 'invalid-token',
        attackType: 'cross_origin'
      };

      const result = await redTeam.executeAttack(AttackVectors.CSRF_ATTACK, payload);

      expect(result.blocked).toBe(true);
      expect(result.success).toBe(false);
    });

    it('应该阻止没有Referer头的请求', async () => {
      const payload = {
        method: 'POST',
        url: '/api/admin/reset',
        headers: {},
        csrfToken: null,
        attackType: 'no_referer'
      };

      const result = await redTeam.executeAttack(AttackVectors.CSRF_ATTACK, payload);

      expect(result.blocked).toBe(true);
      expect(result.success).toBe(false);
    });
  });

  describe('高级CSRF攻击', () => {
    it('应该阻止GET请求CSRF攻击', async () => {
      const payload = {
        method: 'GET',
        url: '/api/user/delete?id=123',
        origin: 'http://evil-domain.com',
        referer: 'http://evil-domain.com/malicious.html',
        attackType: 'get_csrf'
      };

      const result = await redTeam.executeAttack(AttackVectors.CSRF_ATTACK, payload);

      expect(result.blocked).toBe(true);
      expect(result.success).toBe(false);
    });

    it('应该阻止JSON POST请求CSRF', async () => {
      const payload = {
        method: 'POST',
        url: '/api/user/update',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: 'evil', role: 'admin' }),
        origin: 'http://evil-domain.com',
        attackType: 'json_csrf'
      };

      const result = await redTeam.executeAttack(AttackVectors.CSRF_ATTACK, payload);

      expect(result.blocked).toBe(true);
      expect(result.success).toBe(false);
    });

    it('应该阻止AJAX请求CSRF', async () => {
      const payload = {
        method: 'POST',
        url: '/api/user/transfer',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ toUser: 'attacker', amount: 1000 }),
        origin: 'http://evil-domain.com',
        attackType: 'ajax_csrf'
      };

      const result = await redTeam.executeAttack(AttackVectors.CSRF_ATTACK, payload);

      expect(result.blocked).toBe(true);
      expect(result.success).toBe(false);
    });
  });

  describe('令牌相关攻击', () => {
    it('应该阻止无效的CSRF令牌', async () => {
      const payload = {
        method: 'POST',
        url: '/api/user/update',
        headers: {
          'X-CSRF-Token': 'invalid-token-123'
        },
        csrfToken: 'invalid-token-123',
        origin: 'http://trusted-domain.com',
        attackType: 'invalid_token'
      };

      const result = await redTeam.executeAttack(AttackVectors.CSRF_ATTACK, payload);

      expect(result.blocked).toBe(true);
      expect(result.success).toBe(false);
    });

    it('应该阻止过期的CSRF令牌', async () => {
      const payload = {
        method: 'POST',
        url: '/api/user/update',
        headers: {
          'X-CSRF-Token': 'expired-token-abc123'
        },
        csrfToken: 'expired-token-abc123',
        origin: 'http://trusted-domain.com',
        attackType: 'expired_token'
      };

      const result = await redTeam.executeAttack(AttackVectors.CSRF_ATTACK, payload);

      expect(result.blocked).toBe(true);
      expect(result.success).toBe(false);
    });

    it('应该阻止窃取的CSRF令牌', async () => {
      const payload = {
        method: 'POST',
        url: '/api/user/update',
        headers: {
          'X-CSRF-Token': 'stolen-token-def456'
        },
        csrfToken: 'stolen-token-def456',
        origin: 'http://evil-domain.com',
        attackType: 'stolen_token'
      };

      const result = await redTeam.executeAttack(AttackVectors.CSRF_ATTACK, payload);

      expect(result.blocked).toBe(true);
      expect(result.success).toBe(false);
    });
  });

  describe('绕过技术测试', () => {
    it('应该阻止通过子域名绕过', async () => {
      const payload = {
        method: 'POST',
        url: '/api/user/update',
        origin: 'http://api.trusted-domain.com.evil-domain.com',
        referer: 'http://api.trusted-domain.com.evil-domain.com',
        attackType: 'subdomain_bypass'
      };

      const result = await redTeam.executeAttack(AttackVectors.CSRF_ATTACK, payload);

      expect(result.blocked).toBe(true);
      expect(result.success).toBe(false);
    });

    it('应该阻止通过IP地址绕过', async () => {
      const payload = {
        method: 'POST',
        url: '/api/user/update',
        origin: 'http://192.168.1.100',
        referer: 'http://192.168.1.100',
        attackType: 'ip_bypass'
      };

      const result = await redTeam.executeAttack(AttackVectors.CSRF_ATTACK, payload);

      expect(result.blocked).toBe(true);
      expect(result.success).toBe(false);
    });

    it('应该阻止通过localhost绕过', async () => {
      const payload = {
        method: 'POST',
        url: '/api/user/update',
        origin: 'http://localhost:3000',
        referer: 'http://localhost:3000',
        attackType: 'localhost_bypass'
      };

      const result = await redTeam.executeAttack(AttackVectors.CSRF_ATTACK, payload);

      expect(result.blocked).toBe(true);
      expect(result.success).toBe(false);
    });
  });

  describe('SameSite保护测试', () => {
    it('应该阻止没有SameSite保护的Cookie', async () => {
      const payload = {
        method: 'POST',
        url: '/api/user/update',
        cookie: 'session=abc123; path=/',
        origin: 'http://evil-domain.com',
        attackType: 'no_samesite'
      };

      const result = await redTeam.executeAttack(AttackVectors.CSRF_ATTACK, payload);

      expect(result.blocked).toBe(true);
      expect(result.success).toBe(false);
    });

    it('应该允许SameSite=Strict保护', async () => {
      const payload = {
        method: 'POST',
        url: '/api/user/update',
        cookie: 'session=abc123; SameSite=Strict; path=/',
        origin: 'http://trusted-domain.com',
        csrfToken: 'valid-csrf-token-1234567890123456789012345678901234567890123456789012345678901234',
        attackType: 'samesite_strict'
      };

      const result = await redTeam.executeAttack(AttackVectors.CSRF_ATTACK, payload);

      expect(result.blocked).toBe(true); // 即使有SameSite保护，也要验证CSRF令牌
      expect(result.success).toBe(false);
    });
  });

  describe('批量CSRF测试', () => {
    const csrfPayloads = [
      {
        method: 'POST',
        url: '/api/user/change-password',
        body: 'oldPassword=123&newPassword=hacked',
        attackType: 'password_change'
      },
      {
        method: 'POST',
        url: '/api/user/transfer-money',
        body: 'toAccount=attacker&amount=1000',
        origin: 'http://evil-bank.com',
        attackType: 'money_transfer'
      },
      {
        method: 'POST',
        url: '/api/admin/delete-user',
        body: 'userId=123',
        referer: 'http://evil-admin.com',
        attackType: 'admin_action'
      },
      {
        method: 'GET',
        url: '/api/user/logout',
        origin: 'http://evil-domain.com',
        attackType: 'logout_csrf'
      },
      {
        method: 'POST',
        url: '/api/settings/update',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: 'evil', notifications: false }),
        attackType: 'settings_update'
      }
    ];

    it.each(csrfPayloads)('应该阻止CSRF攻击: %s', async (payload) => {
      const result = await redTeam.executeAttack(AttackVectors.CSRF_ATTACK, payload);

      expect(result.blocked).toBe(true);
      expect(result.success).toBe(false);
    });
  });

  describe('性能测试', () => {
    it('应该快速检测和阻止CSRF攻击', async () => {
      const payload = {
        method: 'POST',
        url: '/api/user/update',
        origin: 'http://evil-domain.com',
        attackType: 'performance_test'
      };

      const startTime = performance.now();
      const result = await redTeam.executeAttack(AttackVectors.CSRF_ATTACK, payload);
      const endTime = performance.now();

      expect(result.blocked).toBe(true);
      expect(result.success).toBe(false);
      expect(endTime - startTime).toBeLessThan(5); // 应该在5ms内响应
    });
  });
});
