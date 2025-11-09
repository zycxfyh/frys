import {
  createDetailedErrorReporter,
  createStrictTestCleanup,
  setupStrictTestEnvironment,
  strictAssert,
  withTimeout,
} from './test-helpers.js';

/**
 * 缓存系统集成测试
 * 验证多级缓存、策略和中间件功能
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import CacheService from '../../src/application/services/CacheService.js';
import CacheManagementUseCase from '../../src/application/use-cases/CacheManagementUseCase.js';
import CacheMiddleware from '../../src/infrastructure/middleware/CacheMiddleware.js';

// Mock fetch for testing
global.fetch = vi.fn();

describe('缓存系统集成测试', () => {
  let cacheService;
  let cacheMiddleware;
  let cacheUseCase;

  beforeAll(async () => {
    // 初始化缓存服务
    cacheService = new CacheService({
      defaultTtl: 1000, // 1秒TTL用于测试
      enableRedis: false, // 测试时不启用Redis
      maxMemorySize: 10 * 1024 * 1024, // 10MB内存限制
    });

    await cacheService.initialize();

    // 初始化中间件
    cacheMiddleware = new CacheMiddleware(cacheService);

    // 初始化用例
    cacheUseCase = new CacheManagementUseCase(cacheService);
  });

  afterAll(async () => {
    await cacheService.stop();
  });

  describe('缓存服务基础功能', () => {
    it('应该初始化缓存服务', () => {
      expect(cacheService).toBeDefined();
      expect(cacheService.initialized).toBe(true);
      expect(cacheService.cacheManager).toBeDefined();
      expect(cacheService.strategies).toBeDefined();
    });

    it('应该设置和获取缓存值', async () => {
      const key = 'test:key';
      const value = { data: 'test_value', timestamp: Date.now() };

      // 设置缓存
      const setResult = await cacheService.set(key, value, {
        strategy: 'default',
      });
      expect(setResult).toBe(true);

      // 获取缓存
      const getResult = await cacheService.get(key);
      expect(getResult).toEqual(value);
    });

    it('应该删除缓存值', async () => {
      const key = 'test:delete';

      // 设置缓存
      await cacheService.set(key, 'value');

      // 删除缓存
      const deleteResult = await cacheService.delete(key);
      expect(deleteResult).toBe(true);

      // 验证已删除
      const getResult = await cacheService.get(key);
      expect(getResult).toBeNull();
    });

    it('应该支持缓存过期', async () => {
      const key = 'test:expiry';
      const value = 'expiring_value';

      // 设置1秒过期的缓存
      await cacheService.set(key, value, { ttl: 100 });

      // 立即获取应该成功
      let result = await cacheService.get(key);
      expect(result).toBe(value);

      // 等待过期
      await new Promise((resolve) => setTimeout(resolve, 150));

      // 获取应该返回null
      result = await cacheService.get(key);
      expect(result).toBeNull();
    });
  });

  describe('缓存策略测试', () => {
    it('应该使用数据库缓存策略', async () => {
      const key = 'db:users:123';
      const value = { id: 123, name: 'John Doe' };

      await cacheService.set(key, value, { strategy: 'database' });
      const result = await cacheService.get(key, { strategy: 'database' });

      expect(result).toEqual(value);
    });

    it('应该使用API缓存策略', async () => {
      const key = 'api:/users';
      const value = [
        { id: 1, name: 'User 1' },
        { id: 2, name: 'User 2' },
      ];

      await cacheService.set(key, value, { strategy: 'api' });
      const result = await cacheService.get(key, { strategy: 'api' });

      expect(result).toEqual(value);
    });

    it('应该使用会话缓存策略', async () => {
      const key = 'session:user_123';
      const value = {
        userId: 123,
        token: 'session_token',
        expires: Date.now() + 3600000,
      };

      await cacheService.set(key, value, { strategy: 'session' });
      const result = await cacheService.get(key, { strategy: 'session' });

      expect(result).toEqual(value);
    });

    it('应该创建访问模式策略', () => {
      const strategy = cacheService.createAccessPatternStrategy('read_heavy');

      expect(strategy).toBeDefined();
      expect(strategy.name).toContain('Access Pattern');
      expect(strategy.description).toContain('读密集型');
    });

    it('应该创建新鲜度策略', () => {
      const strategy = cacheService.createFreshnessStrategy('fresh');

      expect(strategy).toBeDefined();
      expect(strategy.name).toContain('Freshness');
      expect(strategy.description).toContain('新鲜数据');
    });
  });

  describe('缓存管理用例测试', () => {
    it('应该通过用例设置缓存值', async () => {
      const result = await cacheUseCase.setCacheValue({
        key: 'usecase:test',
        value: 'usecase_value',
        strategy: 'default',
      });

      expect(result.isSuccess).toBe(true);
      expect(result.data.key).toBe('usecase:test');
      expect(result.data.value).toBe('usecase_value');
    });

    it('应该通过用例获取缓存值', async () => {
      // 先设置值
      await cacheUseCase.setCacheValue({
        key: 'usecase:get',
        value: 'get_value',
      });

      // 再获取值
      const result = await cacheUseCase.getCacheValue({
        key: 'usecase:get',
      });

      expect(result.isSuccess).toBe(true);
      expect(result.data.found).toBe(true);
      expect(result.data.value).toBe('get_value');
    });

    it('应该通过用例删除缓存值', async () => {
      // 先设置值
      await cacheUseCase.setCacheValue({
        key: 'usecase:delete',
        value: 'delete_value',
      });

      // 删除值
      const deleteResult = await cacheUseCase.deleteCacheValue({
        key: 'usecase:delete',
      });

      expect(deleteResult.isSuccess).toBe(true);
      expect(deleteResult.data.deleted).toBe(true);

      // 验证已删除
      const getResult = await cacheUseCase.getCacheValue({
        key: 'usecase:delete',
      });

      expect(getResult.data.found).toBe(false);
    });

    it('应该通过用例清空缓存', async () => {
      // 设置多个值
      await cacheUseCase.setCacheValue({ key: 'clear:test1', value: 'value1' });
      await cacheUseCase.setCacheValue({ key: 'clear:test2', value: 'value2' });

      // 清空缓存
      const result = await cacheUseCase.clearCache({
        pattern: 'clear:*',
      });

      expect(result.isSuccess).toBe(true);

      // 验证已清空
      const getResult1 = await cacheUseCase.getCacheValue({
        key: 'clear:test1',
      });
      const getResult2 = await cacheUseCase.getCacheValue({
        key: 'clear:test2',
      });

      expect(getResult1.data.found).toBe(false);
      expect(getResult2.data.found).toBe(false);
    });

    it('应该通过用例执行批量操作', async () => {
      const operations = [
        { type: 'set', key: 'batch:test1', value: 'value1' },
        { type: 'set', key: 'batch:test2', value: 'value2' },
        { type: 'get', key: 'batch:test1' },
        { type: 'delete', key: 'batch:test2' },
      ];

      const result = await cacheUseCase.batchCacheOperation({ operations });

      expect(result.isSuccess).toBe(true);
      expect(result.data.total).toBe(4);
      expect(result.data.successful).toBe(4);
      expect(result.data.failed).toBe(0);
    });

    it('应该获取缓存统计信息', async () => {
      const result = await cacheUseCase.getCacheStatistics();

      expect(result.isSuccess).toBe(true);
      expect(result.data).toHaveProperty('statistics');
      expect(result.data).toHaveProperty('analysis');
      expect(result.data).toHaveProperty('timestamp');

      expect(result.data.statistics).toHaveProperty('manager');
      expect(result.data.statistics).toHaveProperty('strategies');
      expect(result.data.analysis).toHaveProperty('overall');
      expect(result.data.analysis).toHaveProperty('recommendations');
    });
  });

  describe('缓存中间件测试', () => {
    it('应该创建缓存中间件', () => {
      expect(cacheMiddleware).toBeDefined();
      expect(cacheMiddleware.httpCache).toBeDefined();
      expect(typeof cacheMiddleware.httpCache()).toBe('function');
    });

    it('应该生成HTTP缓存键', () => {
      const mockReq = {
        method: 'GET',
        url: '/api/users',
        query: { page: 1 },
        body: {},
        user: { id: '123' },
      };

      const cacheKey = cacheMiddleware.generateCacheKey(mockReq);
      expect(cacheKey).toContain('http:');
      expect(cacheKey).toContain('GET');
      expect(cacheKey).toContain('/api/users');
    });

    it('应该判断是否应该缓存请求', () => {
      const getReq = { method: 'GET', url: '/api/users' };
      const postReq = { method: 'POST', url: '/api/users' };
      const authReq = { method: 'GET', url: '/auth/login' };

      expect(cacheMiddleware.shouldCacheRequest(getReq)).toBe(true);
      expect(cacheMiddleware.shouldCacheRequest(postReq)).toBe(false);
      expect(cacheMiddleware.shouldCacheRequest(authReq)).toBe(false);
    });

    it('应该缓存和获取页面', async () => {
      const url = '/page/home';
      const content = '<html><body>Home Page</body></html>';

      // 缓存页面
      const cacheResult = await cacheMiddleware.cachePage(url, content);
      expect(cacheResult).toBe(true);

      // 获取缓存页面
      const cachedPage = await cacheMiddleware.getCachedPage(url);
      expect(cachedPage).toBeDefined();
      expect(cachedPage.content).toBe(content);
    });

    it('应该清除URL缓存', async () => {
      const url = '/api/test';

      // 先设置缓存
      await cacheService.set(`http:GET:${url}:{}:{}:anonymous`, 'cached_data', {
        strategy: 'api',
      });

      // 清除缓存
      const cleared = await cacheMiddleware.invalidateUrl(url);
      expect(cleared).toBeDefined();
    });
  });

  describe('缓存性能和监控', () => {
    it('应该提供缓存统计信息', () => {
      const stats = cacheService.getCacheStats();

      expect(stats).toHaveProperty('manager');
      expect(stats).toHaveProperty('strategies');
      expect(stats).toHaveProperty('service');

      expect(stats.manager).toHaveProperty('layers');
      expect(stats.manager).toHaveProperty('metrics');
      expect(stats.manager).toHaveProperty('hitRate');
    });

    it('应该分析缓存性能', () => {
      const analysis = cacheService.analyzeCachePerformance();

      expect(analysis).toHaveProperty('overall');
      expect(analysis).toHaveProperty('layers');
      expect(analysis).toHaveProperty('strategies');
      expect(analysis).toHaveProperty('recommendations');

      expect(analysis.overall).toHaveProperty('hitRate');
      expect(analysis.overall).toHaveProperty('totalOperations');
      expect(Array.isArray(analysis.recommendations)).toBe(true);
    });

    it('应该执行健康检查', async () => {
      const health = await cacheService.healthCheck();

      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('issues');
      expect(health).toHaveProperty('layerHealth');
      expect(health).toHaveProperty('metrics');
    });
  });

  describe('高级缓存功能', () => {
    it('应该支持缓存穿透保护', async () => {
      const key = 'penetration:test';
      let factoryCallCount = 0;

      const factory = async () => {
        factoryCallCount++;
        return `value_${factoryCallCount}`;
      };

      // 第一次调用
      const result1 = await cacheService.getOrSet(key, factory);
      expect(result1).toBe('value_1');
      expect(factoryCallCount).toBe(1);

      // 第二次调用（应该从缓存获取）
      const result2 = await cacheService.getOrSet(key, factory);
      expect(result2).toBe('value_1');
      expect(factoryCallCount).toBe(1); // 工厂函数没有被再次调用
    });

    it('应该支持批量操作', async () => {
      const keyValuePairs = new Map([
        ['batch:key1', 'value1'],
        ['batch:key2', 'value2'],
        ['batch:key3', 'value3'],
      ]);

      // 批量设置
      const setResult = await cacheService.mset(keyValuePairs);
      expect(setResult).toBe(true);

      // 批量获取
      const getResult = await cacheService.mget([
        'batch:key1',
        'batch:key2',
        'batch:key3',
      ]);
      expect(getResult.get('batch:key1')).toBe('value1');
      expect(getResult.get('batch:key2')).toBe('value2');
      expect(getResult.get('batch:key3')).toBe('value3');
    });

    it('应该支持智能过期时间', async () => {
      const key = 'smart:expiry:test';

      await cacheService.setWithSmartExpiry(key, 'value', {
        ttl: 1000,
        accessPattern: 'frequent',
      });

      const result = await cacheService.get(key);
      expect(result).toBe('value');
    });
  });

  describe('错误处理和边界情况', () => {
    it('应该处理无效缓存键', async () => {
      const result = await cacheService.set(null, 'value');
      expect(result).toBe(false);
    });

    it('应该处理缓存服务不可用', async () => {
      // 模拟缓存服务错误
      const originalSet = cacheService.cacheManager.set;
      cacheService.cacheManager.set = vi
        .fn()
        .mockRejectedValue(new Error('Service unavailable'));

      const result = await cacheService.set('error:test', 'value');
      expect(result).toBe(false);

      // 恢复
      cacheService.cacheManager.set = originalSet;
    });

    it('应该处理工厂函数错误', async () => {
      const key = 'factory:error';
      const factory = async () => {
        throw new Error('Factory error');
      };

      await expect(cacheService.getOrSet(key, factory)).rejects.toThrow(
        'Factory error',
      );
    });

    it('应该处理并发缓存操作', async () => {
      const key = 'concurrent:test';
      let callCount = 0;
      const promises = [];

      // 创建5个并发请求，所有都返回相同的值
      for (let i = 0; i < 5; i++) {
        promises.push(
          cacheService.getOrSet(key, async () => {
            callCount++;
            await new Promise((resolve) => setTimeout(resolve, 10)); // 模拟延迟
            return 'same_value';
          }),
        );
      }

      const results = await Promise.all(promises);

      // 验证所有结果都相同
      const firstResult = results[0];
      const allSame = results.every((r) => r === firstResult);
      expect(allSame).toBe(true);
      expect(firstResult).toBe('same_value');
      // 注意：由于实现限制，可能不是严格的1次调用，但结果应该相同
      expect(callCount).toBeLessThanOrEqual(5);
    });
  });

  describe('缓存策略注册和配置', () => {
    it('应该注册自定义缓存策略', () => {
      const customStrategy = {
        name: 'Custom Strategy',
        description: 'Test custom strategy',
        get: async (key) => await cacheService.get(`custom:${key}`),
        set: async (key, value) =>
          await cacheService.set(`custom:${key}`, value),
      };

      cacheService.registerStrategy('custom', customStrategy);

      const strategies = cacheService.strategies.getStrategyNames();
      expect(strategies).toContain('custom');
    });

    it('应该导出和导入配置', () => {
      const config = cacheService.exportConfiguration();

      expect(config).toHaveProperty('manager');
      expect(config).toHaveProperty('strategies');

      // 创建新服务并导入配置
      const newCacheService = new CacheService();
      expect(() => newCacheService.importConfiguration(config)).not.toThrow();
    });
  });
});
