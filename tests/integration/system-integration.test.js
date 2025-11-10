import {
  createDetailedErrorReporter,
  createStrictTestCleanup,
  setupStrictTestEnvironment,
  strictAssert,
  withTimeout,
} from './test-helpers.js';

/**
 * 系统集成测试
 * 验证整个frys系统的集成功能
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// 动态导入以避免模块解析问题
const LightweightContainer = (
  await import('../../../src/core/LightweightContainer.js')
).LightweightContainer;
const HttpClient = (
  await import('../../../src/core/HttpClient.js')
).default;
const JWTAuth = (await import('../../../src/core/JWTAuth.js'))
  .default;
const ZustandInspiredState = (
  await import('../../../src/core/ZustandInspiredState.js')
).default;
const LodashInspiredUtils = (
  await import('../../../src/core/LodashInspiredUtils.js')
).default;
const { errorHandler } = await import(
  '../../../src/core/ErrorHandlerConfig.js'
);

describe('系统集成测试', () => {
  let container;
  let httpClient;
  let auth;
  let state;
  let utils;

  beforeAll(async () => {
    // 初始化依赖注入容器
    container = new LightweightContainer();

    // 注册核心服务
    container.register('http', HttpClient);
    container.register('auth', JWTAuth);
    container.register('state', ZustandInspiredState);
    container.register('utils', LodashInspiredUtils);

    // 初始化核心模块
    httpClient = container.resolve('http');
    auth = container.resolve('auth');
    state = container.resolve('state');
    utils = container.resolve('utils');

    await httpClient.initialize();
    await auth.initialize();
    await state.initialize();
    await utils.initialize();

    // 设置认证密钥
    auth.setSecret('default', 'test-secret-key-for-integration');
  });

  afterAll(async () => {
    // 清理资源
    if (utils) await utils.destroy();
    if (state) await state.destroy();
    if (auth) await auth.destroy();
    if (httpClient) await httpClient.destroy();
  });

  describe('核心模块集成', () => {
    it('应该能正确初始化所有核心模块', () => {
      expect(httpClient).toBeDefined();
      expect(auth).toBeDefined();
      expect(state).toBeDefined();
      expect(utils).toBeDefined();
      expect(container).toBeDefined();
    });

    it('应该能通过容器解析服务', () => {
      const resolvedHttp = container.resolve('http');
      const resolvedAuth = container.resolve('auth');

      expect(resolvedHttp).toBe(httpClient);
      expect(resolvedAuth).toBe(auth);
    });

    it('应该能处理模块间的依赖关系', async () => {
      // 测试HTTP客户端和认证模块的集成
      const token = auth.generateToken({
        userId: 'test-user',
        role: 'admin',
      });

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      // 验证令牌
      const payload = auth.verifyToken(token);
      expect(payload.userId).toBe('test-user');
      expect(payload.role).toBe('admin');
    });
  });

  describe('状态管理集成', () => {
    it('应该能创建和管理状态存储', () => {
      const store = state.create((set) => ({
        counter: 0,
        increment: () => set((state) => ({ counter: state.counter + 1 })),
        decrement: () => set((state) => ({ counter: state.counter - 1 })),
      }));

      expect(store).toBeDefined();
      expect(store.getState().counter).toBe(0);

      // 测试状态更新
      store.increment();
      expect(store.getState().counter).toBe(1);

      store.decrement();
      expect(store.getState().counter).toBe(0);
    });

    it('应该支持状态订阅机制', () => {
      const store = state.create((set) => ({
        value: 0,
        update: (newValue) => set(() => ({ value: newValue })),
      }));

      let notifiedValue;
      const unsubscribe = store.subscribe((newState) => {
        notifiedValue = newState.value;
      });

      store.update(42);
      expect(notifiedValue).toBe(42);

      unsubscribe();
    });
  });

  describe('工具函数集成', () => {
    it('应该能使用函数式编程工具', () => {
      const data = [
        { id: 1, name: 'Alice', active: true },
        { id: 2, name: 'Bob', active: false },
        { id: 3, name: 'Charlie', active: true },
      ];

      // 使用链式调用
      const result = utils
        .chain(data)
        .filter((item) => item.active)
        .map((item) => item.name)
        .uniq()
        .value();

      expect(result).toEqual(['Alice', 'Charlie']);
    });

    it('应该支持函数组合', () => {
      const add = (x) => x + 1;
      const multiply = (x) => x * 2;
      const square = (x) => x * x;

      const combined = utils.combine(square, multiply, add);
      const result = combined(3); // ((3²) * 2) + 1 = 19

      expect(result).toBe(19);
    });
  });

  describe('业务服务集成', () => {
    it('应该能创建和管理用户', async () => {
      // 创建用户状态存储
      const userStore = state.create((set) => ({
        users: [],
        addUser: (user) =>
          set((state) => ({
            users: [...state.users, user],
          })),
      }));

      // 添加用户
      userStore.addUser({
        id: 'user-1',
        name: 'John Doe',
        email: 'john@example.com',
      });

      expect(userStore.getState().users).toHaveLength(1);
      expect(userStore.getState().users[0].name).toBe('John Doe');
    });

    it('应该能创建和管理工作流', async () => {
      // 创建工作流状态存储
      const workflowStore = state.create((set) => ({
        workflows: [],
        addWorkflow: (workflow) =>
          set((state) => ({
            workflows: [...state.workflows, workflow],
          })),
      }));

      // 添加工作流
      workflowStore.addWorkflow({
        id: 'workflow-1',
        name: '用户注册流程',
        steps: ['validate', 'create', 'notify'],
        status: 'active',
      });

      expect(workflowStore.getState().workflows).toHaveLength(1);
      expect(workflowStore.getState().workflows[0].name).toBe('用户注册流程');
    });
  });

  describe('错误处理集成', () => {
    it('应该能统一处理错误', async () => {
      let errorHandled = false;
      let errorContext;

      // 模拟错误处理
      const originalHandle = errorHandler.handle;
      errorHandler.handle = async (error, context) => {
        errorHandled = true;
        errorContext = context;
        return originalHandle.call(errorHandler, error, context);
      };

      try {
        // 触发一个错误
        auth.verifyToken('invalid-token');
      } catch (error) {
        // 错误应该被处理
        expect(errorHandled).toBe(true);
        expect(errorContext).toBeDefined();
      }

      // 恢复原始错误处理器
      errorHandler.handle = originalHandle;
    });

    it('应该能处理异步错误', async () => {
      let errorCaught = false;

      try {
        // 模拟异步错误
        await httpClient.request('invalid-instance', {
          method: 'GET',
          url: '/invalid-endpoint',
        });
      } catch (error) {
        errorCaught = true;
        expect(error).toBeDefined();
      }

      expect(errorCaught).toBe(true);
    });
  });

  describe('性能监控集成', () => {
    it('应该能监控系统性能', async () => {
      // 执行一些操作来生成统计数据
      for (let i = 0; i < 5; i++) {
        utils.uniq([1, 2, 2, 3, 3, 3]);
        utils.groupBy([1, 2, 3], (x) => x % 2);
      }

      const utilsStats = utils.getStats();
      expect(utilsStats.operations).toBeGreaterThan(0);
      expect(utilsStats.operationTypes).toContain('uniq');
      expect(utilsStats.operationTypes).toContain('groupBy');

      const stateStats = state.getStats();
      expect(stateStats.stores).toBeGreaterThanOrEqual(0);

      const httpStats = httpClient.getStats();
      expect(httpStats.instances).toBeGreaterThan(0);
    });

    it('应该能监控健康状态', async () => {
      const utilsHealth = await utils.onHealthCheck();
      expect(utilsHealth).toBeDefined();
      expect(utilsHealth.status).toBe('healthy');

      const stateHealth = await state.onHealthCheck();
      expect(stateHealth).toBeDefined();
      expect(stateHealth.status).toBe('healthy');

      const httpHealth = await httpClient.onHealthCheck();
      expect(httpHealth).toBeDefined();
      expect(httpHealth.status).toBe('healthy');
    });
  });
});
