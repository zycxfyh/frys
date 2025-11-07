/**
 * 回归测试矩阵
 * 验证轻量化重构后的系统稳定性
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { LightweightContainer } from '../../src/core/LightweightContainer.js';
import AxiosInspiredHTTP from '../../src/core/AxiosInspiredHTTP.js';
import JWTInspiredAuth from '../../src/core/JWTInspiredAuth.js';
import ZustandInspiredState from '../../src/core/ZustandInspiredState.js';
import LodashInspiredUtils from '../../src/core/LodashInspiredUtils.js';

describe('回归测试矩阵', () => {
  let container;
  let httpClient;
  let auth;
  let state;
  let utils;

  beforeAll(async () => {
    container = new LightweightContainer();
    container.register('http', AxiosInspiredHTTP);
    container.register('auth', JWTInspiredAuth);
    container.register('state', ZustandInspiredState);
    container.register('utils', LodashInspiredUtils);

    httpClient = container.resolve('http');
    auth = container.resolve('auth');
    state = container.resolve('state');
    utils = container.resolve('utils');

    await httpClient.initialize();
    await auth.initialize();
    await state.initialize();
    await utils.initialize();

    auth.setSecret('default', 'regression-test-secret');
  });

  afterAll(async () => {
    if (utils) await utils.destroy();
    if (state) await state.destroy();
    if (auth) await auth.destroy();
    if (httpClient) await httpClient.destroy();
  });

  describe('功能回归测试', () => {
    it('应该保持工具函数的基本功能', () => {
      const array = [1, 2, 2, 3, 3, 3, 4];
      const result = utils.uniq(array);
      expect(result).toEqual([1, 2, 3, 4]);

      const grouped = utils.groupBy([1, 2, 3, 4, 5], x => x % 2 === 0 ? 'even' : 'odd');
      expect(grouped.even).toEqual([2, 4]);
      expect(grouped.odd).toEqual([1, 3, 5]);
    });

    it('应该保持状态管理的功能', () => {
      const store = state.create((set) => ({
        count: 0,
        increment: () => set(state => ({ count: state.count + 1 })),
        decrement: () => set(state => ({ count: state.count - 1 })),
      }));

      expect(store.getState().count).toBe(0);
      store.increment();
      expect(store.getState().count).toBe(1);
      store.decrement();
      expect(store.getState().count).toBe(0);
    });

    it('应该保持认证系统的功能', () => {
      const token = auth.generateToken({ userId: 'test-user', role: 'admin' });
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      const decoded = auth.verifyToken(token);
      expect(decoded.userId).toBe('test-user');
      expect(decoded.role).toBe('admin');
    });

    it('应该保持HTTP客户端的基本功能', async () => {
      // 测试实例创建
      const instance = httpClient.createInstance({ baseURL: 'https://api.test.com' });
      expect(instance).toBeDefined();
      expect(instance.baseURL).toBe('https://api.test.com');
    });
  });

  describe('性能回归测试', () => {
    it('应该保持工具函数的性能', () => {
      const largeArray = Array.from({ length: 1000 }, (_, i) => Math.floor(Math.random() * 100));

      const startTime = Date.now();
      const result = utils.uniq(largeArray);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100); // 应该在100ms内完成
      expect(result.length).toBeLessThanOrEqual(largeArray.length);
    });

    it('应该保持状态管理的性能', () => {
      const store = state.create((set) => ({
        items: [],
        addItem: (item) => set(state => ({ items: [...state.items, item] })),
      }));

      const startTime = Date.now();
      for (let i = 0; i < 100; i++) {
        store.addItem(`item-${i}`);
      }
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(200); // 应该在200ms内完成
      expect(store.getState().items).toHaveLength(100);
    });
  });

  describe('稳定性回归测试', () => {
    it('应该处理错误情况', () => {
      expect(() => utils.uniq(null)).toThrow();
      expect(() => utils.uniq(undefined)).toThrow();
      expect(() => utils.uniq('not an array')).toThrow();
    });

    it('应该处理边界情况', () => {
      expect(utils.uniq([])).toEqual([]);
      expect(utils.uniq([1])).toEqual([1]);
      expect(utils.uniq([1, 1, 1])).toEqual([1]);
    });

    it('应该保持向后兼容性', () => {
      // 测试旧API仍然可用
      const stats = utils.getStats();
      expect(stats).toBeDefined();
      expect(typeof stats.operations).toBe('number');
    });
  });

  describe('集成回归测试', () => {
    it('应该支持模块间的集成', () => {
      // 创建一个完整的用户管理场景
      const userStore = state.create((set, get) => ({
        users: [],
        addUser: (user) => set(state => ({ users: [...state.users, user] })),
        findUser: (id) => get().users.find(u => u.id === id),
      }));

      const user = { id: 'user-1', name: 'Test User', email: 'test@example.com' };
      userStore.addUser(user);

      const foundUser = userStore.findUser('user-1');
      expect(foundUser).toEqual(user);

      // 生成用户令牌
      const token = auth.generateToken({ userId: user.id, email: user.email });
      expect(token).toBeDefined();
    });

    it('应该保持事件系统的稳定性', () => {
      let eventFired = false;
      const store = state.create((set) => ({
        value: 0,
        update: (val) => set(() => ({ value: val })),
      }));

      const unsubscribe = store.subscribe(() => {
        eventFired = true;
      });

      store.update(42);
      expect(eventFired).toBe(true);

      unsubscribe();
    });
  });

  describe('内存回归测试', () => {
    it('应该正确释放资源', async () => {
      const store = state.create((set) => ({
        data: 'test',
      }));

      // 验证store存在
      expect(store.getState().data).toBe('test');

      // 这里无法直接测试内存释放，但可以验证对象结构完整
      expect(store.getState).toBeDefined();
      expect(store.setState).toBeDefined();
      expect(store.subscribe).toBeDefined();
    });

    it('应该处理大量数据', () => {
      const largeData = Array.from({ length: 10000 }, (_, i) => ({ id: i, value: Math.random() }));

      const startTime = Date.now();
      const grouped = utils.groupBy(largeData, item => item.id % 10);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(500); // 应该在500ms内完成
      expect(Object.keys(grouped)).toHaveLength(10);
      expect(grouped[0]).toHaveLength(1000);
    });
  });
});
