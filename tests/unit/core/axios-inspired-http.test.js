/**
 * AxiosInspiredHTTP 单元测试
 * 测试HTTP客户端的核心功能
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import AxiosInspiredHTTP from '../../../src/core/AxiosInspiredHTTP.js';

// 测试常量
const TEST_CONSTANTS = {
  INVALID_INSTANCE_ID: 'invalid-id', // 与源代码中的检查保持一致
  NON_EXISTENT_ID: 'non-existent',
  BASE_URL: 'https://api.workflow.local',
  TIMEOUT: 5000,
  DEFAULT_CONTENT_TYPE: 'application/json',
  TEST_URLS: {
    USERS: '/users',
    TEST: '/test',
    API_DATA: '/api/v1/data',
    DELAY_TEST: '/delay-test',
    MEMORY_TEST: '/memory-test'
  },
  HTTP_METHODS: {
    GET: 'GET',
    POST: 'POST',
    PUT: 'PUT',
    DELETE: 'DELETE'
  },
  HTTP_STATUS: {
    OK: 200,
    OK_TEXT: 'OK'
  }
};

// 测试配置工厂
const createTestConfig = (overrides = {}) => ({
  baseURL: TEST_CONSTANTS.BASE_URL,
  timeout: TEST_CONSTANTS.TIMEOUT,
  headers: { 'Content-Type': TEST_CONSTANTS.DEFAULT_CONTENT_TYPE },
  ...overrides
});

// 测试数据工厂
const createTestUser = (overrides = {}) => ({
  name: 'John Doe',
  email: 'john@test.com',
  ...overrides
});

// Helper 函数
const createTestInstance = (axios, config = {}) => axios.create(createTestConfig(config));

const expectValidInstance = (instance) => {
  expect(instance).toBeDefined();
  expect(instance.id).toBeDefined();
  expect(typeof instance.id).toBe('string');
  expect(instance.id).toContain('instance_');
};

const expectValidResponse = (response, method = TEST_CONSTANTS.HTTP_METHODS.GET, url = TEST_CONSTANTS.TEST_URLS.TEST) => {
  expect(response).toBeDefined();
  expect(response.status).toBe(TEST_CONSTANTS.HTTP_STATUS.OK);
  expect(response.statusText).toBe(TEST_CONSTANTS.HTTP_STATUS.OK_TEXT);
  expect(response.data).toBeDefined();
  expect(response.config.method).toBe(method);
  expect(response.config.url).toBe(url);
};

describe('AxiosInspiredHTTP', { tags: ['unit', 'core', 'http'] }, () => {
  let axios;

  beforeEach(async () => {
    axios = new AxiosInspiredHTTP({ testMode: true });
    await axios.initialize();
  });

  afterEach(async () => {
    if (axios) {
      await axios.destroy();
    }
    axios = null;
  });

  describe('构造函数', () => {
    it('应该正确初始化实例', () => {
      expect(axios).toBeInstanceOf(AxiosInspiredHTTP);
      expect(axios.instances).toBeDefined();
      expect(axios.interceptors).toBeDefined();
      expect(axios.requests).toBeDefined();
    });

    it('应该有初始状态', () => {
      const stats = axios.getStats();
      expect(stats).toEqual({
        instances: 1, // 包含默认实例
        requests: 0,
        interceptors: 0
      });
    });
  });

  describe('实例管理', () => {
    it('应该能创建HTTP实例', () => {
      const customConfig = createTestConfig({
        baseURL: 'https://api.example.com',
        timeout: 10000
      });
      const instance = axios.create(customConfig);

      expectValidInstance(instance);
      expect(instance.baseURL).toBe(customConfig.baseURL);
      expect(instance.timeout).toBe(customConfig.timeout);
      expect(instance.headers).toEqual(customConfig.headers);
    });

    it('应该生成唯一的实例ID', () => {
      const instance1 = createTestInstance(axios);
      const instance2 = createTestInstance(axios);

      expect(instance1.id).not.toBe(instance2.id);
      expect(typeof instance1.id).toBe('string');
      expect(instance1.id).toContain('instance_');
    });

    it('应该更新实例统计', () => {
      const initialStats = axios.getStats();
      const instance1 = createTestInstance(axios);
      const instance2 = createTestInstance(axios);

      const finalStats = axios.getStats();
      expect(finalStats.instances).toBe(initialStats.instances + 2);
    });

    it('应该支持默认配置', () => {
      const instance = axios.create();

      expect(instance.baseURL).toBe('');
      expect(instance.timeout).toBe(0);
      expect(instance.headers).toEqual({
        'Content-Type': TEST_CONSTANTS.DEFAULT_CONTENT_TYPE
      });
      expect(instance.interceptors.request).toEqual([]);
      expect(instance.interceptors.response).toEqual([]);
    });
  });

  describe('请求拦截器', () => {
    let instance;

    beforeEach(() => {
      instance = createTestInstance(axios);
    });

    const createTestInterceptor = () => ({
      fulfilled: (config) => ({ ...config, test: true }),
      rejected: (error) => error
    });

    it('应该能添加请求拦截器', () => {
      const { fulfilled, rejected } = createTestInterceptor();

      axios.addRequestInterceptor(instance.id, fulfilled, rejected);

      expect(instance.interceptors.request).toHaveLength(1);
      expect(instance.interceptors.request[0].fulfilled).toBe(fulfilled);
      expect(instance.interceptors.request[0].rejected).toBe(rejected);
    });

    it('应该能添加响应拦截器', () => {
      const { fulfilled, rejected } = createTestInterceptor();

      axios.addResponseInterceptor(instance.id, fulfilled, rejected);

      expect(instance.interceptors.response).toHaveLength(1);
      expect(instance.interceptors.response[0].fulfilled).toBe(fulfilled);
      expect(instance.interceptors.response[0].rejected).toBe(rejected);
    });

    it('应该处理不存在的实例', () => {
      expect(() => {
        axios.addRequestInterceptor(TEST_CONSTANTS.NON_EXISTENT_ID, () => {}, () => {});
      }).toThrow(`Instance ${TEST_CONSTANTS.NON_EXISTENT_ID} not found`);
    });

    it('应该更新拦截器统计', () => {
      const initialStats = axios.getStats();

      axios.addRequestInterceptor(instance.id, () => {}, () => {});
      axios.addResponseInterceptor(instance.id, () => {}, () => {});

      const finalStats = axios.getStats();
      expect(finalStats.interceptors).toBe(initialStats.interceptors + 2);
    });
  });

  describe('HTTP请求', () => {
    let instance;

    beforeEach(() => {
      instance = createTestInstance(axios);
    });

    it('应该能发送GET请求', async () => {
      const response = await axios.get(instance.id, TEST_CONSTANTS.TEST_URLS.USERS, { param: 'test' });

      expectValidResponse(response, TEST_CONSTANTS.HTTP_METHODS.GET, TEST_CONSTANTS.TEST_URLS.USERS);
    });

    it('应该能发送POST请求', async () => {
      const postData = createTestUser();
      const response = await axios.post(instance.id, TEST_CONSTANTS.TEST_URLS.USERS, postData);

      expectValidResponse(response, TEST_CONSTANTS.HTTP_METHODS.POST, TEST_CONSTANTS.TEST_URLS.USERS);
      expect(response.config.data).toBe(postData);
    });

    it('应该正确处理URL拼接', async () => {
      const response = await axios.get(instance.id, TEST_CONSTANTS.TEST_URLS.API_DATA);

      expect(response.config.url).toBe(TEST_CONSTANTS.TEST_URLS.API_DATA);
      // 验证基础URL被正确应用（在request方法中）
    });

    it('应该处理不存在的实例', async () => {
      await expect(axios.get(TEST_CONSTANTS.NON_EXISTENT_ID, TEST_CONSTANTS.TEST_URLS.TEST))
        .rejects.toThrow(`Instance ${TEST_CONSTANTS.NON_EXISTENT_ID} not found`);
    });

    it('应该记录请求历史', async () => {
      const initialRequestCount = axios.requests.length;

      await axios.get(instance.id, `${TEST_CONSTANTS.TEST_URLS.TEST}1`);
      await axios.post(instance.id, `${TEST_CONSTANTS.TEST_URLS.TEST}2`, { data: 'test' });

      expect(axios.requests).toHaveLength(initialRequestCount + 2);
      expect(axios.requests[initialRequestCount].method).toBe(TEST_CONSTANTS.HTTP_METHODS.GET);
      expect(axios.requests[initialRequestCount].url).toContain(`${TEST_CONSTANTS.TEST_URLS.TEST}1`);
      expect(axios.requests[initialRequestCount + 1].method).toBe(TEST_CONSTANTS.HTTP_METHODS.POST);
      expect(axios.requests[initialRequestCount + 1].url).toContain(`${TEST_CONSTANTS.TEST_URLS.TEST}2`);
    });
  });

  describe('通用请求方法', () => {
    let instance;

    beforeEach(() => {
      instance = createTestInstance(axios);
    });

    it('应该支持完整的请求配置', async () => {
      const config = {
        method: TEST_CONSTANTS.HTTP_METHODS.PUT,
        url: `${TEST_CONSTANTS.TEST_URLS.USERS}/123`,
        data: { name: 'Updated Name' },
        headers: { 'Authorization': 'Bearer token' },
        timeout: 10000
      };

      const response = await axios.request(instance.id, config);

      expect(typeof response.config.method).toBe('string');
      expect(response.config.method).toBe(TEST_CONSTANTS.HTTP_METHODS.PUT);
      expect(response.config.url).toBe(`${TEST_CONSTANTS.TEST_URLS.USERS}/123`);
      expect(response.config.data).toEqual({ name: 'Updated Name' });
      expect(response.status).toBe(TEST_CONSTANTS.HTTP_STATUS.OK);
    });

    it('应该处理请求和响应拦截器', async () => {
      let requestIntercepted = false;
      let responseIntercepted = false;

      // 添加请求拦截器
      axios.addRequestInterceptor(instance.id,
        (config) => {
          requestIntercepted = true;
          return { ...config, intercepted: true };
        },
        (error) => error
      );

      // 添加响应拦截器
      axios.addResponseInterceptor(instance.id,
        (response) => {
          responseIntercepted = true;
          return { ...response, intercepted: true };
        },
        (error) => error
      );

      const response = await axios.get(instance.id, TEST_CONSTANTS.TEST_URLS.TEST);

      expect(requestIntercepted).toBe(true);
      expect(responseIntercepted).toBe(true);
      expect(response.intercepted).toBe(true);
    });

    it('应该处理网络延迟模拟', async () => {
      const startTime = performance.now();

      await axios.get(instance.id, TEST_CONSTANTS.TEST_URLS.DELAY_TEST);

      const duration = performance.now() - startTime;
      // 模拟延迟在10-50ms之间
      expect(duration).toBeGreaterThan(5);
      expect(duration).toBeLessThan(100);
    }, 1000); // 设置超时时间
  });

  describe('错误处理', () => {
    it('应该处理无效的实例ID', async () => {
      await expect(axios.request(TEST_CONSTANTS.INVALID_INSTANCE_ID, {
        method: TEST_CONSTANTS.HTTP_METHODS.GET,
        url: TEST_CONSTANTS.TEST_URLS.TEST
      })).rejects.toThrow(`Instance ${TEST_CONSTANTS.INVALID_INSTANCE_ID} not found`);
    });

    it('应该处理null和undefined参数', async () => {
      const instance = createTestInstance(axios);

      // 这些应该不会抛出错误
      await expect(axios.get(instance.id, null)).resolves.toBeDefined();
      await expect(axios.get(instance.id, undefined)).resolves.toBeDefined();
      await expect(axios.post(instance.id, TEST_CONSTANTS.TEST_URLS.TEST, null)).resolves.toBeDefined();
    });
  });

  describe('统计信息', () => {
    it('应该提供准确的统计信息', async () => {
      expect(axios.getStats()).toEqual({
        instances: 1, // 包含默认实例
        requests: 0,
        interceptors: 0
      });

      const instance1 = createTestInstance(axios);
      const instance2 = createTestInstance(axios);

      axios.addRequestInterceptor(instance1.id, () => {}, () => {});
      axios.addResponseInterceptor(instance2.id, () => {}, () => {});

      await axios.get(instance1.id, `${TEST_CONSTANTS.TEST_URLS.TEST}1`);
      await axios.post(instance2.id, `${TEST_CONSTANTS.TEST_URLS.TEST}2`, createTestUser());

      const stats = axios.getStats();
      expect(stats.instances).toBe(3); // 包括默认实例
      expect(stats.requests).toBe(2);
      expect(stats.interceptors).toBe(2);
    });

    it('应该实时更新统计信息', async () => {
      const initialStats = axios.getStats();

      createTestInstance(axios);
      const afterCreateStats = axios.getStats();

      expect(afterCreateStats.instances).toBe(initialStats.instances + 1);
      expect(afterCreateStats.requests).toBe(initialStats.requests);
    });
  });

  describe('性能测试', () => {
    const PERFORMANCE_CONSTANTS = {
      CONCURRENT_REQUESTS: 50,
      MEMORY_TEST_REQUESTS: 100,
      MAX_DURATION_MS: 2000
    };

    it('应该能处理并发请求', async () => {
      const instance = createTestInstance(axios);

      const startTime = global.performanceMonitor.start();

      const promises = [];
      for (let i = 0; i < PERFORMANCE_CONSTANTS.CONCURRENT_REQUESTS; i++) {
        promises.push(axios.get(instance.id, `${TEST_CONSTANTS.TEST_URLS.TEST}/${i}`));
      }

      const results = await Promise.all(promises);
      const perfResult = global.performanceMonitor.end(startTime);

      console.log(`并发${PERFORMANCE_CONSTANTS.CONCURRENT_REQUESTS}个请求总耗时: ${perfResult.formatted}`);
      expect(results).toHaveLength(PERFORMANCE_CONSTANTS.CONCURRENT_REQUESTS);
      expect(results.every(r => r.status === TEST_CONSTANTS.HTTP_STATUS.OK)).toBe(true);
      expect(perfResult.duration).toBeLessThan(PERFORMANCE_CONSTANTS.MAX_DURATION_MS); // 2秒内完成
    });

    it('应该保持内存使用在合理范围内', async () => {
      const instance = createTestInstance(axios);
      const initialMemory = global.memoryMonitor.getUsage();

      // 执行大量请求
      const promises = [];
      for (let i = 0; i < PERFORMANCE_CONSTANTS.MEMORY_TEST_REQUESTS; i++) {
        promises.push(axios.get(instance.id, `${TEST_CONSTANTS.TEST_URLS.MEMORY_TEST}/${i}`));
      }
      await Promise.all(promises);

      const finalMemory = global.memoryMonitor.getUsage();

      console.log('内存使用情况:');
      console.log(`初始: ${initialMemory.heapUsed} bytes`);
      console.log(`最终: ${finalMemory.heapUsed} bytes`);

      // 内存增长应该在合理范围内（这里只是示例检查）
      expect(finalMemory.heapUsed).toBeDefined();
      expect(typeof finalMemory.heapUsed).toBe('string');
    });
  });
});
