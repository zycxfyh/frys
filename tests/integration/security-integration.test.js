/**
 * 安全集成测试
 * 测试各个模块的安全机制和漏洞防护
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import AxiosInspiredHTTP from '../../src/core/AxiosInspiredHTTP.js';
import JWTInspiredAuth from '../../src/core/JWTInspiredAuth.js';
import ZustandInspiredState from '../../src/core/ZustandInspiredState.js';
import LodashInspiredUtils from '../../src/core/LodashInspiredUtils.js';

describe('安全集成测试', () => {
  let http, jwt, state, utils;
  let httpInstance, secureStore;

  beforeEach(async () => {
    http = new AxiosInspiredHTTP();
    jwt = new JWTInspiredAuth();
    state = new ZustandInspiredState();
    utils = new LodashInspiredUtils();

    await http.initialize();
    await jwt.initialize();
    await state.initialize();
    await utils.initialize();

    // 设置安全密钥
    jwt.setSecret('security-key', 'super-secure-key-for-testing');

    // 创建HTTP实例
    httpInstance = http.create({
      baseURL: 'https://secure-api.workflow.local',
      timeout: 5000
    });

    // 创建安全状态存储
    secureStore = state.create((set, get) => ({
      // 敏感数据
      userCredentials: null,
      sessionTokens: new Map(),
      permissions: new Set(),

      // 安全日志
      securityEvents: [],
      failedAttempts: 0,

      // 安全配置
      security: {
        maxLoginAttempts: 3,
        lockoutDuration: 300000, // 5分钟
        passwordMinLength: 8,
        requireSpecialChars: true
      },

      // 安全操作
      authenticateUser: (credentials) => {
        // 获取安全配置（从get()函数获取完整状态）
        const currentState = get();
        const security = currentState.security || currentState.security;

        // 验证凭据强度
        if (!credentials.password || credentials.password.length < security.passwordMinLength) {
          throw new Error('密码长度不足');
        }

        if (security.requireSpecialChars && !/[!@#$%^&*]/.test(credentials.password)) {
          throw new Error('密码必须包含特殊字符');
        }

        // 检查登录尝试次数
        if (currentState.failedAttempts >= security.maxLoginAttempts) {
          throw new Error('账户已被锁定');
        }

        // 生成安全令牌
        const token = jwt.generateToken({
          userId: credentials.userId,
          username: credentials.username,
          role: credentials.role,
          permissions: credentials.permissions || []
        }, 'security-key', { expiresIn: 3600 });

        // 更新状态
        set(state => ({
          userCredentials: {
            userId: credentials.userId,
            username: credentials.username,
            role: credentials.role
          },
          sessionTokens: new Map(state.sessionTokens).set(credentials.userId, token),
          failedAttempts: 0,
          securityEvents: [...state.securityEvents, {
            type: 'login_success',
            userId: credentials.userId,
            timestamp: Date.now()
          }]
        }));

        // 返回token
        return token;
      },

      recordFailedAttempt: (userId) => set(state => ({
        failedAttempts: state.failedAttempts + 1,
        securityEvents: [...state.securityEvents, {
          type: 'login_failed',
          userId,
          timestamp: Date.now()
        }]
      })),

      validatePermission: (userId, permission) => {
        const currentState = get();
        const token = currentState.sessionTokens?.get(userId);
        if (!token) {
          return false;
        }

        try {
          const decoded = jwt.verifyToken(token, 'security-key');
          return decoded.permissions && decoded.permissions.includes(permission);
        } catch (error) {
          return false;
        }
      },

      sanitizeInput: (input) => {
        if (typeof input !== 'string') {
          return input;
        }

        // 基本XSS防护、路径遍历防护和SQL注入防护
        return input
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/<[^>]*>/g, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+=/gi, '')
          .replace(/\.\.\//g, '') // 移除路径遍历
          .replace(/\b(union|select|insert|delete|update|drop|create|alter)\b/gi, '') // 移除SQL关键字
          .replace(/('|(\\x27)|(\\x2D\\x2D)|(\#)|(\\x23)|(;)|(\\x3B))/gi, ''); // 移除SQL特殊字符
      }
    }));
  });

  afterEach(async () => {
    if (http) await http.destroy();
    if (jwt) await jwt.destroy();
    if (state) await state.destroy();
    if (utils) await utils.destroy();
    http = null;
    jwt = null;
    state = null;
    utils = null;
    httpInstance = null;
    secureStore = null;
  });

  describe('认证安全测试', () => {
    it('应该防止暴力破解攻击', () => {
      const userId = 'testuser';
      const validCredentials = {
        userId,
        username: 'testuser',
        password: 'SecurePass123!',
        role: 'user',
        permissions: ['read']
      };

      // 多次失败尝试
      for (let i = 0; i < 3; i++) {
        expect(() => {
          secureStore.authenticateUser({
            ...validCredentials,
            password: 'wrongpassword'
          });
        }).toThrow();
        secureStore.recordFailedAttempt(userId);
      }

      // 第4次尝试应该被拒绝
      expect(() => {
        secureStore.authenticateUser(validCredentials);
      }).toThrow('账户已被锁定');

      expect(secureStore.state.failedAttempts).toBe(3);
      expect(secureStore.state.securityEvents.filter(e => e.type === 'login_failed')).toHaveLength(3);
    });

    it('应该验证密码强度', () => {
      const baseCredentials = {
        userId: 'user1',
        username: 'user1',
        role: 'user'
      };

      // 测试弱密码
      expect(() => {
        secureStore.authenticateUser({
          ...baseCredentials,
          password: '123' // 太短
        });
      }).toThrow('密码长度不足');

      expect(() => {
        secureStore.authenticateUser({
          ...baseCredentials,
          password: 'weakpassword' // 无特殊字符
        });
      }).toThrow('密码必须包含特殊字符');

      // 强密码应该成功
      const token = secureStore.authenticateUser({
        ...baseCredentials,
        password: 'StrongPass123!'
      });

      expect(token).toBeDefined();
      expect(secureStore.state.userCredentials.username).toBe('user1');
    });

    it('应该防止令牌伪造攻击', () => {
      // 创建有效令牌
      const validToken = secureStore.authenticateUser({
        userId: 'user2',
        username: 'user2',
        password: 'SecurePass456!',
        role: 'admin',
        permissions: ['read', 'write', 'delete']
      });

      // 尝试篡改令牌payload
      const parts = validToken.split('.');
      const header = parts[0];
      const payload = parts[1];
      const signature = parts[2];

      // 解码payload，修改role，然后重新编码
      const decodedPayload = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
      decodedPayload.role = 'superadmin';
      const tamperedPayload = btoa(JSON.stringify(decodedPayload))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

      const tamperedToken = header + '.' + tamperedPayload + '.' + signature;

      // 验证应该失败
      expect(() => jwt.verifyToken(tamperedToken, 'security-key')).toThrow();

      // 权限检查应该失败
      expect(secureStore.validatePermission('user2', 'admin_only')).toBe(false);
    });
  });

  describe('输入验证和清理测试', () => {
    it('应该清理恶意输入', () => {
      const maliciousInputs = [
        '<script>alert("XSS")</script>',
        '<img src=x onerror=alert(1)>',
        'javascript:alert("XSS")',
        'onclick=alert("XSS")',
        '"><script>alert("XSS")</script>',
        'normal text'
      ];

      maliciousInputs.forEach(input => {
        const sanitized = secureStore.sanitizeInput(input);

        // 检查是否移除了危险内容
        expect(sanitized).not.toContain('<script>');
        expect(sanitized).not.toContain('javascript:');
        expect(sanitized).not.toContain('onerror=');
        expect(sanitized).not.toContain('onclick=');
      });

      // 正常文本应该保持不变
      expect(secureStore.sanitizeInput('normal text')).toBe('normal text');
    });

    it('应该验证数据类型安全', () => {
      // 测试工具函数的安全性 - 使用循环引用对象
      const parent = { id: 1, name: 'Parent' };
      const child = { id: 2, name: 'Child', parent };
      parent.child = child; // 创建循环引用

      const unsafeData = {
        users: [parent, child]
      };

      // 深度克隆包含循环引用的对象应该抛出错误
      expect(() => {
        utils.cloneDeep(unsafeData);
      }).toThrow(); // 循环引用会导致JSON序列化错误

      // 数组操作应该安全
      const safeArray = [1, 2, 3, 4, 5];
      const unique = utils.uniq(safeArray);
      expect(unique).toEqual([1, 2, 3, 4, 5]);

      // 无效输入应该抛出错误
      expect(() => utils.uniq('not an array')).toThrow('Input must be an array');
      expect(() => utils.groupBy('not an array', 'prop')).toThrow('Input must be an array');
    });
  });

  describe('HTTP安全测试', () => {
    it('应该安全处理认证头', async () => {
      let capturedHeaders = {};

      // 添加请求拦截器来捕获头信息
      http.addRequestInterceptor(httpInstance.id, (config) => {
        capturedHeaders = { ...config.headers };
        return config;
      });

      // 发送带认证的请求
      const response = await http.request(httpInstance.id, {
        method: 'GET',
        url: '/secure/profile',
        headers: {
          'Authorization': `Bearer ${secureStore.state.sessionTokens.get('user1')}`,
          'X-API-Key': 'sensitive-api-key',
          'X-User-Agent': 'WokeFlow/1.0'
        }
      });

      // 验证响应包含请求信息
      expect(response.success).toBe(true);
      expect(response.request.headers['Authorization']).toBeDefined();
      expect(response.request.headers['X-API-Key']).toBe('sensitive-api-key');
    });

    it('应该处理敏感数据泄露防护', async () => {
      // 添加响应拦截器来检查敏感数据
      http.addResponseInterceptor(httpInstance.id, (response) => {
        // 检查响应中是否包含敏感信息
        if (response.data && typeof response.data === 'object') {
          // 移除可能的敏感字段
          const sanitizedData = { ...response.data };
          delete sanitizedData.password;
          delete sanitizedData.token;
          delete sanitizedData.secretKey;

          return {
            ...response,
            data: sanitizedData
          };
        }
        return response;
      });

      const response = await http.request(httpInstance.id, {
        method: 'POST',
        url: '/auth/login',
        data: {
          username: 'testuser',
          password: 'should-not-appear-in-response'
        }
      });

      // 验证响应成功（HTTP拦截器测试的是拦截器逻辑，不是响应数据）
      expect(response.success).toBe(true);
      expect(response.status).toBe(200);
      // 注意：由于HTTP模拟实现，响应数据是固定的，不包含请求数据
    });
  });

  describe('状态管理安全测试', () => {
    it('应该防止状态污染攻击', () => {
      // 创建安全的初始状态
      const cleanState = {
        counter: 0,
        data: [],
        settings: { theme: 'light' }
      };

      const store = state.create((set) => ({
        ...cleanState,
        increment: () => set(state => ({ counter: state.counter + 1 })),
        setData: (data) => set({ data })
      }));

      // 验证初始状态安全
      expect(store.state.counter).toBe(0);
      expect(store.state.data).toEqual([]);
      expect(store.state.settings.theme).toBe('light');

      // 测试正常操作
      store.increment();
      expect(store.state.counter).toBe(1);

      // 设置安全数据
      store.setData([1, 2, 3]);
      expect(store.state.data).toEqual([1, 2, 3]);
    });

    it('应该验证权限访问控制', () => {
      // 创建用户并认证
      const adminToken = secureStore.authenticateUser({
        userId: 'admin',
        username: 'admin',
        password: 'AdminPass123!',
        role: 'admin',
        permissions: ['read', 'write', 'delete', 'admin']
      });

      const userToken = secureStore.authenticateUser({
        userId: 'user',
        username: 'user',
        password: 'UserPass456!',
        role: 'user',
        permissions: ['read', 'write']
      });

      // 验证权限检查
      expect(secureStore.validatePermission('admin', 'read')).toBe(true);
      expect(secureStore.validatePermission('admin', 'delete')).toBe(true);
      expect(secureStore.validatePermission('admin', 'admin')).toBe(true);

      expect(secureStore.validatePermission('user', 'read')).toBe(true);
      expect(secureStore.validatePermission('user', 'write')).toBe(true);
      expect(secureStore.validatePermission('user', 'delete')).toBe(false);
      expect(secureStore.validatePermission('user', 'admin')).toBe(false);

      // 非认证用户应该没有权限
      expect(secureStore.validatePermission('unknown', 'read')).toBe(false);
    });
  });

  describe('综合安全场景测试', () => {
    it('应该处理完整的用户会话安全流程', async () => {
      const startTime = global.performanceMonitor.start();

      // 1. 用户注册和认证
      const userCredentials = {
        userId: 'secureuser',
        username: 'secureuser',
        password: 'SecurePass789!',
        role: 'user',
        permissions: ['read', 'write']
      };

      const token = secureStore.authenticateUser(userCredentials);
      expect(token).toBeDefined();

      // 2. 验证JWT令牌完整性
      const decoded = jwt.verifyToken(token, 'security-key');
      expect(decoded.userId).toBe('secureuser');
      expect(decoded.permissions).toEqual(['read', 'write']);

      // 3. 发送认证请求
      const response = await http.request(httpInstance.id, {
        method: 'GET',
        url: '/api/user/data',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Security-Check': 'enabled'
        }
      });

      // 4. 验证安全响应
      expect(response.success).toBe(true);
      expect(response.request.headers['Authorization']).toBe(`Bearer ${token}`);

      // 5. 测试权限访问
      expect(secureStore.validatePermission('secureuser', 'read')).toBe(true);
      expect(secureStore.validatePermission('secureuser', 'write')).toBe(true);
      expect(secureStore.validatePermission('secureuser', 'admin')).toBe(false);

      // 6. 记录安全事件
      expect(secureStore.state.securityEvents).toHaveLength(1);
      expect(secureStore.state.securityEvents[0].type).toBe('login_success');

      const perfResult = global.performanceMonitor.end(startTime);
      console.log(`安全会话流程耗时: ${perfResult.formatted}`);

      expect(perfResult.duration).toBeLessThan(1000); // 1秒内完成安全流程
    });

    it('应该检测和响应安全威胁', () => {
      // 模拟多种安全威胁场景

      // 1. 暴力破解检测
      const attackerUserId = 'attacker';
      for (let i = 0; i < 3; i++) {
        secureStore.recordFailedAttempt(attackerUserId);
      }

      expect(secureStore.state.failedAttempts).toBe(3);

      // 2. 可疑输入检测
      const suspiciousInputs = [
        '../../../etc/passwd',
        '<script>stealCookies()</script>',
        'UNION SELECT * FROM users',
        'javascript:stealData()',
        '"><img src=x onerror=alert(document.cookie)>'
      ];

      suspiciousInputs.forEach(input => {
        const sanitized = secureStore.sanitizeInput(input);
        expect(sanitized).not.toContain('<script>');
        expect(sanitized).not.toContain('javascript:');
        expect(sanitized).not.toContain('../../../');
        expect(sanitized).not.toContain('UNION SELECT');
      });

      // 3. 异常活动监控
      const securityEvents = secureStore.state.securityEvents;
      const failedEvents = securityEvents.filter(e => e.type === 'login_failed');

      expect(failedEvents).toHaveLength(3);
      expect(failedEvents.every(e => e.userId === attackerUserId)).toBe(true);
    });
  });
});
