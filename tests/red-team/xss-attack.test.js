import {
  setupStrictTestEnvironment,
  createStrictTestCleanup,
  strictAssert,
  withTimeout,
  createDetailedErrorReporter
} from '../test-helpers.js';

/**
 * XSS跨站脚本攻击测试
 * 模拟各种XSS攻击向量
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import RedTeamFramework, { AttackVectors } from './red-team-framework.js';

describe('XSS跨站脚本攻击测试', () => {
  let redTeam;

  beforeEach(() => {
    redTeam = new RedTeamFramework();

    // 注册XSS攻击向量
    redTeam.registerAttack(AttackVectors.XSS_ATTACK, async (payload) => {
      try {
        // 模拟XSS攻击检测
        const sanitizedInput = sanitizeInput(payload.input);
        const isXSS = detectXSS(payload.input);

        return {
          success: isXSS && !isInputSanitized(sanitizedInput),
          blocked: isInputSanitized(sanitizedInput) || !isXSS,
          details: {
            original: payload.input,
            sanitized: sanitizedInput,
            detected: isXSS,
            safe: isInputSanitized(sanitizedInput)
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

  // 简化的XSS检测函数（实际应用中应该使用专业的XSS过滤库）
  function detectXSS(input) {
    const xssPatterns = [
      /<script[^>]*>[\s\S]*?<\/script>/gi,
      /<iframe[^>]*>[\s\S]*?<\/iframe>/gi,
      /<object[^>]*>[\s\S]*?<\/object>/gi,
      /<embed[^>]*>[\s\S]*?<\/embed>/gi,
      /javascript:/gi,
      /vbscript:/gi,
      /data:text\/html/gi,
      /on\w+\s*=/gi,
      /<img[^>]+onerror[^>]*>/gi,
      /<link[^>]+href[^>]*javascript[^>]*>/gi,
      /<meta[^>]+http-equiv[^>]*>/gi,
      /expression\s*\(/gi,
      /vbscript\s*:/gi,
      /data\s*:\s*text\/html/gi
    ];

    return xssPatterns.some(pattern => pattern.test(input));
  }

  // 简化的输入清理函数
  function sanitizeInput(input) {
    return input
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;')
      .replace(/\\/g, '&#x5C;')
      .replace(/`/g, '&#x60;')
      .replace(/=/g, '&#x3D;');
  }

  // 检查输入是否已被清理
  function isInputSanitized(input) {
    return !/<[^>]*>/.test(input) &&
           !/javascript:/i.test(input) &&
           !/on\w+\s*=/i.test(input) &&
           !/expression\s*\(/i.test(input);
  }

  describe('反射型XSS攻击', () => {
    it('应该阻止基本的script标签注入', async () => {
      const payload = {
        input: '<script>alert("XSS")</script>'
      };

      const result = await redTeam.executeAttack(AttackVectors.XSS_ATTACK, payload);

      expect(result.blocked).toBe(true);
      expect(result.success).toBe(false);
    });

    it('应该阻止img标签onerror事件注入', async () => {
      const payload = {
        input: '<img src="x" onerror="alert(\'XSS\')">'
      };

      const result = await redTeam.executeAttack(AttackVectors.XSS_ATTACK, payload);

      expect(result.blocked).toBe(true);
      expect(result.success).toBe(false);
    });

    it('应该阻止javascript:协议注入', async () => {
      const payload = {
        input: '<a href="javascript:alert(\'XSS\')">Click me</a>'
      };

      const result = await redTeam.executeAttack(AttackVectors.XSS_ATTACK, payload);

      expect(result.blocked).toBe(true);
      expect(result.success).toBe(false);
    });

    it('应该阻止事件处理器注入', async () => {
      const payload = {
        input: '<div onclick="alert(\'XSS\')">Click me</div>'
      };

      const result = await redTeam.executeAttack(AttackVectors.XSS_ATTACK, payload);

      expect(result.blocked).toBe(true);
      expect(result.success).toBe(false);
    });
  });

  describe('存储型XSS攻击', () => {
    it('应该阻止存储在数据库中的XSS', async () => {
      const payload = {
        input: '<script>document.cookie="session=evil"</script>'
      };

      const result = await redTeam.executeAttack(AttackVectors.XSS_ATTACK, payload);

      expect(result.blocked).toBe(true);
      expect(result.success).toBe(false);
    });

    it('应该阻止iframe注入', async () => {
      const payload = {
        input: '<iframe src="javascript:alert(\'XSS\')"></iframe>'
      };

      const result = await redTeam.executeAttack(AttackVectors.XSS_ATTACK, payload);

      expect(result.blocked).toBe(true);
      expect(result.success).toBe(false);
    });
  });

  describe('DOM-based XSS攻击', () => {
    it('应该阻止document.write注入', async () => {
      const payload = {
        input: 'document.write("<script>alert(\'XSS\')</script>")'
      };

      const result = await redTeam.executeAttack(AttackVectors.XSS_ATTACK, payload);

      expect(result.blocked).toBe(true);
      expect(result.success).toBe(false);
    });

    it('应该阻止innerHTML注入', async () => {
      const payload = {
        input: 'element.innerHTML = "<script>alert(\'XSS\')</script>"'
      };

      const result = await redTeam.executeAttack(AttackVectors.XSS_ATTACK, payload);

      expect(result.blocked).toBe(true);
      expect(result.success).toBe(false);
    });
  });

  describe('高级XSS攻击', () => {
    it('应该阻止编码绕过', async () => {
      const payload = {
        input: '&#60;script&#62;alert(&#39;XSS&#39;)&#60;/script&#62;'
      };

      const result = await redTeam.executeAttack(AttackVectors.XSS_ATTACK, payload);

      expect(result.blocked).toBe(true);
      expect(result.success).toBe(false);
    });

    it('应该阻止大小写混淆', async () => {
      const payload = {
        input: '<ScRiPt>alert("XSS")</ScRiPt>'
      };

      const result = await redTeam.executeAttack(AttackVectors.XSS_ATTACK, payload);

      expect(result.blocked).toBe(true);
      expect(result.success).toBe(false);
    });

    it('应该阻止标签内属性注入', async () => {
      const payload = {
        input: '<img src="valid.jpg" onerror=alert("XSS")>'
      };

      const result = await redTeam.executeAttack(AttackVectors.XSS_ATTACK, payload);

      expect(result.blocked).toBe(true);
      expect(result.success).toBe(false);
    });

    it('应该阻止CSS expression注入', async () => {
      const payload = {
        input: '<div style="width: expression(alert(\'XSS\'))">'
      };

      const result = await redTeam.executeAttack(AttackVectors.XSS_ATTACK, payload);

      expect(result.blocked).toBe(true);
      expect(result.success).toBe(false);
    });

    it('应该阻止data URL注入', async () => {
      const payload = {
        input: '<iframe src="data:text/html,<script>alert(\'XSS\')</script>"></iframe>'
      };

      const result = await redTeam.executeAttack(AttackVectors.XSS_ATTACK, payload);

      expect(result.blocked).toBe(true);
      expect(result.success).toBe(false);
    });
  });

  describe('XSS绕过技术测试', () => {
    it('应该阻止使用反斜杠转义绕过', async () => {
      const payload = {
        input: `<img src="x" onerror="alert(\\'XSS\\')">`
      };

      const result = await redTeam.executeAttack(AttackVectors.XSS_ATTACK, payload);

      expect(result.blocked).toBe(true);
      expect(result.success).toBe(false);
    });

    it('应该阻止使用unicode编码绕过', async () => {
      const payload = {
        input: '<script>\u0061\u006c\u0065\u0072\u0074("XSS")</script>'
      };

      const result = await redTeam.executeAttack(AttackVectors.XSS_ATTACK, payload);

      expect(result.blocked).toBe(true);
      expect(result.success).toBe(false);
    });

    it('应该阻止base64编码注入', async () => {
      const payload = {
        input: '<img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" onerror="eval(atob(\'YWxlcnQoIlhTUyIp\'))">'
      };

      const result = await redTeam.executeAttack(AttackVectors.XSS_ATTACK, payload);

      expect(result.blocked).toBe(true);
      expect(result.success).toBe(false);
    });
  });

  describe('批量XSS测试', () => {
    const xssPayloads = [
      '<script>alert("XSS")</script>',
      '<img src=x onerror=alert("XSS")>',
      '<iframe src="javascript:alert(\'XSS\')"></iframe>',
      '<object data="javascript:alert(\'XSS\')"></object>',
      '<embed src="javascript:alert(\'XSS\')"></embed>',
      '<link rel="stylesheet" href="javascript:alert(\'XSS\')">',
      '<meta http-equiv="refresh" content="0;url=javascript:alert(\'XSS\')">',
      '<div style="background-image: url(javascript:alert(\'XSS\'))">',
      '<table background="javascript:alert(\'XSS\')">',
      '<body onload="alert(\'XSS\')">',
      '<input onfocus="alert(\'XSS\')" autofocus>',
      '<select onchange="alert(\'XSS\')"><option value="x">X</option></select>',
      '<textarea oninput="alert(\'XSS\')">',
      '<button onclick="alert(\'XSS\')">Click me</button>',
      '<a href="javascript:alert(\'XSS\')">Link</a>',
      '<form action="javascript:alert(\'XSS\')"><input type="submit"></form>',
      '<math><maction actiontype="statusline" xlink:href="javascript:alert(\'XSS\')">',
      '<svg onload="alert(\'XSS\')"></svg>',
      '<marquee onstart="alert(\'XSS\')">XSS</marquee>',
      '<details ontoggle="alert(\'XSS\')"><summary>Click me</summary></details>',
      '<video><source onerror="alert(\'XSS\')"></video>',
      '<audio onloadstart="alert(\'XSS\')"><source src="x"></audio>'
    ];

    it.each(xssPayloads)('应该阻止XSS攻击: %s', async (xssInput) => {
      const payload = { input: xssInput };
      const result = await redTeam.executeAttack(AttackVectors.XSS_ATTACK, payload);

      expect(result.blocked).toBe(true);
      expect(result.success).toBe(false);
    });
  });

  describe('性能测试', () => {
    it('应该快速检测和阻止XSS攻击', async () => {
      const payload = {
        input: '<script>alert("XSS")</script>'
      };

      const startTime = performance.now();
      const result = await redTeam.executeAttack(AttackVectors.XSS_ATTACK, payload);
      const endTime = performance.now();

      expect(result.blocked).toBe(true);
      expect(result.success).toBe(false);
      expect(endTime - startTime).toBeLessThan(10); // 应该在10ms内响应
    });
  });
});
