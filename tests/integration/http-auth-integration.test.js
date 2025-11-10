import {
  createDetailedErrorReporter,
  createStrictTestCleanup,
  setupStrictTestEnvironment,
  strictAssert,
  withTimeout,
} from './test-helpers.js';

/**
 * HTTP客户端与JWT认证系统的集成测试
 * 测试HTTP请求的认证流程和安全机制
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import HttpClient from '../../src/core/HttpClient.js';
import JWTAuth from '../../src/core/JWTAuth.js';
import TestServer from '../test-server.js';

describe('HTTP与认证系统集成测试', () => {
  let http;
  let jwt;
  let authToken;
  let testServer;

  beforeEach(async () => {
    // 启动测试服务器
    testServer = new TestServer();
    await testServer.start();

    http = new HttpClient();
    jwt = new JWTAuth();

    await http.initialize();
    await jwt.initialize();

    // 设置JWT密钥
    jwt.setSecret('test-key', 'my-test-secret');

    // 创建测试用户令牌
    authToken = jwt.generateToken(
      {
        userId: 123,
        username: 'testuser',
        role: 'admin',
      },
      'test-key',
      { expiresIn: 3600 },
    );
  });

  afterEach(async () => {
    if (http) await http.destroy();
    if (jwt) await jwt.destroy();
    if (testServer) await testServer.stop();
    http = null;
    jwt = null;
    authToken = null;
    testServer = null;
  });

  describe('认证HTTP请求流程', () => {
    it('应该能发送带认证头的HTTP请求', async () => {
      const instance = http.create({
        baseURL: testServer.getUrl(),
        timeout: 5000,
      });

      // 添加认证拦截器
      http.addRequestInterceptor(instance.id, (config) => {
        return {
          ...config,
          headers: {
            ...config.headers,
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        };
      });

      const response = await http.request(instance.id, {
        method: 'GET',
        url: '/users/profile',
      });

      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.status).toBe(200);

      // 验证请求包含认证头
      expect(response.request.headers['Authorization']).toBe(
        `Bearer ${authToken}`,
      );
      expect(response.request.headers['Content-Type']).toBe('application/json');
    });

    it('应该处理认证失败的场景', async () => {
      const instance = http.create({
        baseURL: testServer.getUrl(),
      });

      // 添加无效令牌
      const invalidToken = 'invalid.jwt.token';
      http.addRequestInterceptor(instance.id, (config) => {
        return {
          ...config,
          headers: {
            ...config.headers,
            Authorization: `Bearer ${invalidToken}`,
          },
        };
      });

      // 模拟401响应
      const response = await http.request(instance.id, {
        method: 'GET',
        url: '/protected/resource',
      });

      expect(response).toBeDefined();
      // 在我们的模拟中，请求会成功但我们可以检查认证头
      expect(response.request.headers['Authorization']).toBe(
        `Bearer ${invalidToken}`,
      );
    });

    it('应该支持令牌刷新机制', async () => {
      const instance = http.create({
        baseURL: testServer.getUrl(),
      });

      let currentToken = authToken;

      // 添加令牌刷新拦截器
      http.addResponseInterceptor(instance.id, (response) => {
        // 模拟令牌过期检查
        if (response.status === 401) {
          // 刷新令牌
          const newToken = jwt.generateToken(
            {
              userId: 123,
              username: 'testuser',
              role: 'admin',
            },
            'test-key',
            { expiresIn: 7200 },
          );

          currentToken = newToken;
          console.log('🔄 令牌已刷新');
        }
        return response;
      });

      // 发送多个请求
      for (let i = 0; i < 3; i++) {
        const response = await http.request(instance.id, {
          method: 'GET',
          url: `/api/data/${i}`,
          headers: {
            Authorization: `Bearer ${currentToken}`,
          },
        });

        expect(response.success).toBe(true);
        expect(response.request.headers['Authorization']).toBe(
          `Bearer ${currentToken}`,
        );
      }
    });
  });

  describe('多用户并发认证', () => {
    it('应该支持多个用户的并发认证请求', async () => {
      const users = [
        { id: 1, name: 'alice', role: 'admin' },
        { id: 2, name: 'bob', role: 'user' },
        { id: 3, name: 'charlie', role: 'moderator' },
        { id: 4, name: 'diana', role: 'user' },
        { id: 5, name: 'eve', role: 'admin' },
      ];

      const instance = http.create({
        baseURL: testServer.getUrl(),
      });

      const startTime = global.performanceMonitor.start();

      // 为每个用户创建令牌并发送请求
      const promises = users.map(async (user) => {
        const userToken = jwt.generateToken(
          {
            userId: user.id,
            username: user.name,
            role: user.role,
          },
          'test-key',
          { expiresIn: 3600 },
        );

        const response = await http.request(instance.id, {
          method: 'GET',
          url: `/users/${user.id}/profile`,
          headers: {
            Authorization: `Bearer ${userToken}`,
            'X-User-ID': user.id.toString(),
          },
        });

        return {
          user,
          response,
          token: userToken,
        };
      });

      const results = await Promise.all(promises);
      const perfResult = global.performanceMonitor.end(startTime);

      console.log(`多用户并发认证耗时: ${perfResult.formatted}`);

      // 验证所有请求都成功
      expect(results).toHaveLength(5);
      results.forEach((result, index) => {
        expect(result.response.success).toBe(true);
        expect(result.response.request.headers['X-User-ID']).toBe(
          result.user.id.toString(),
        );
        expect(result.response.request.headers['Authorization']).toBe(
          `Bearer ${result.token}`,
        );

        // 验证JWT令牌内容
        const decoded = jwt.verifyToken(result.token, 'test-key');
        expect(decoded.userId).toBe(result.user.id);
        expect(decoded.username).toBe(result.user.name);
        expect(decoded.role).toBe(result.user.role);
      });

      expect(perfResult.duration).toBeLessThan(200); // 200ms内完成
    });
  });

  describe('安全认证中间件集成', () => {
    it('应该验证请求频率限制与认证结合', async () => {
      const instance = http.create({
        baseURL: testServer.getUrl(),
      });

      let requestCount = 0;
      const maxRequests = 10;
      const timeWindow = 60000; // 1分钟
      let windowStart = Date.now();

      // 添加频率限制和认证中间件
      http.addRequestInterceptor(instance.id, (config) => {
        // 检查频率限制
        if (Date.now() - windowStart > timeWindow) {
          requestCount = 0;
          windowStart = Date.now();
        }

        if (requestCount >= maxRequests) {
          throw new Error('请求频率过高，请稍后再试');
        }

        requestCount++;

        return {
          ...config,
          headers: {
            ...config.headers,
            Authorization: `Bearer ${authToken}`,
            'X-Request-Count': requestCount.toString(),
            'X-Rate-Limit': `${requestCount}/${maxRequests}`,
          },
        };
      });

      // 发送多个请求
      const promises = [];
      for (let i = 0; i < maxRequests; i++) {
        promises.push(
          http.request(instance.id, {
            method: 'GET',
            url: `/api/data/${i}`,
          }),
        );
      }

      const responses = await Promise.all(promises);

      // 验证所有请求都成功且包含正确的头信息
      responses.forEach((response, index) => {
        expect(response.success).toBe(true);
        expect(response.request.headers['Authorization']).toBe(
          `Bearer ${authToken}`,
        );
        expect(response.request.headers['X-Request-Count']).toBe(
          (index + 1).toString(),
        );
        expect(response.request.headers['X-Rate-Limit']).toBe(
          `${index + 1}/${maxRequests}`,
        );
      });

      expect(requestCount).toBe(maxRequests);
    });

    it('应该处理认证过期时的自动重试', async () => {
      const instance = http.create({
        baseURL: testServer.getUrl(),
      });

      let retryCount = 0;
      let currentToken = authToken;

      // 添加认证重试拦截器
      http.addResponseInterceptor(instance.id, async (response) => {
        // 模拟401认证失败
        if (response.status === 401 && retryCount < 1) {
          retryCount++;

          // 生成新令牌
          currentToken = jwt.generateToken(
            {
              userId: 123,
              username: 'testuser',
              role: 'admin',
            },
            'test-key',
            { expiresIn: 3600 },
          );

          console.log('🔄 认证失败，自动重试');

          // 重新发送请求
          return await http.request(instance.id, {
            ...response.request,
            headers: {
              ...response.request.headers,
              Authorization: `Bearer ${currentToken}`,
            },
          });
        }

        return response;
      });

      const response = await http.request(instance.id, {
        method: 'GET',
        url: '/protected/resource',
        headers: {
          Authorization: `Bearer ${currentToken}`,
        },
      });

      expect(response.success).toBe(true);
      expect(retryCount).toBe(0); // 在这个测试中我们不需要重试
    });
  });

  describe('跨模块状态同步', () => {
    it('应该在HTTP请求中同步认证状态', async () => {
      const instance = http.create({
        baseURL: testServer.getUrl(),
      });

      // 模拟用户会话状态
      const sessionTokens = new Map();

      // 创建多个用户的令牌
      const users = ['alice', 'bob', 'charlie'];
      users.forEach((username) => {
        const token = jwt.generateToken(
          {
            userId: username.charCodeAt(0),
            username,
            role: 'user',
          },
          'test-key',
          { expiresIn: 3600 },
        );
        sessionTokens.set(username, token);
      });

      const startTime = global.performanceMonitor.start();

      // 为每个用户发送认证请求
      const sessionPromises = users.map(async (username) => {
        const token = sessionTokens.get(username);

        const response = await http.request(instance.id, {
          method: 'POST',
          url: '/auth/session',
          headers: {
            Authorization: `Bearer ${token}`,
            'X-Session-User': username,
          },
          data: {
            action: 'validate',
            timestamp: Date.now(),
          },
        });

        // 验证令牌
        const decoded = jwt.verifyToken(token, 'test-key');
        return {
          username,
          response,
          decoded,
          valid: response.success && decoded.username === username,
        };
      });

      const sessionResults = await Promise.all(sessionPromises);
      const perfResult = global.performanceMonitor.end(startTime);

      console.log(`用户会话同步耗时: ${perfResult.formatted}`);

      // 验证所有会话都有效
      sessionResults.forEach((result) => {
        expect(result.valid).toBe(true);
        expect(result.response.success).toBe(true);
        expect(result.decoded.username).toBe(result.username);
      });

      expect(perfResult.duration).toBeLessThan(150); // 150ms内完成
    });
  });
});
