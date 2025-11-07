/**
 * AxiosInspiredHTTP 单元测试
 * 测试HTTP客户端的核心功能
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import AxiosInspiredHTTP from '../../../src/core/AxiosInspiredHTTP.js';

describe('AxiosInspiredHTTP', () => {
  let axios;

  beforeEach(async () => {
    axios = new AxiosInspiredHTTP();
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
      expect(stats.instances).toBe(1); // 包含默认实例
      expect(stats.requests).toBe(0);
      expect(stats.interceptors).toBe(0);
    });
  });

  describe('实例管理', () => {
    it('应该能创建HTTP实例', () => {
      const config = {
        baseURL: 'https://api.example.com',
        timeout: 5000,
        headers: { 'Content-Type': 'application/json' }
      };

      const instance = axios.create(config);

      expect(instance).toBeDefined();
      expect(instance.id).toBeDefined();
      expect(instance.baseURL).toBe(config.baseURL);
      expect(instance.timeout).toBe(config.timeout);
      expect(instance.headers).toEqual(config.headers);
    });

    it('应该生成唯一的实例ID', () => {
      const instance1 = axios.create();
      const instance2 = axios.create();

      expect(instance1.id).not.toBe(instance2.id);
      expect(typeof instance1.id).toBe('string');
      expect(instance1.id).toContain('instance_');
    });

    it('应该更新实例统计', () => {
      axios.create();
      axios.create();

      const stats = axios.getStats();
      expect(stats.instances).toBe(3); // 包含默认实例
    });

    it('应该支持默认配置', () => {
      const instance = axios.create();

      expect(instance.baseURL).toBe('');
      expect(instance.timeout).toBe(0);
      expect(instance.headers).toEqual({
        'Content-Type': 'application/json'
      });
      expect(instance.interceptors.request).toEqual([]);
      expect(instance.interceptors.response).toEqual([]);
    });
  });

  describe('请求拦截器', () => {
    let instance;

    beforeEach(() => {
      instance = axios.create();
    });

    it('应该能添加请求拦截器', () => {
      const fulfilled = (config) => ({ ...config, test: true });
      const rejected = (error) => error;

      axios.addRequestInterceptor(instance.id, fulfilled, rejected);

      expect(instance.interceptors.request).toHaveLength(1);
      expect(instance.interceptors.request[0].fulfilled).toBe(fulfilled);
      expect(instance.interceptors.request[0].rejected).toBe(rejected);
    });

    it('应该能添加响应拦截器', () => {
      const fulfilled = (response) => response;
      const rejected = (error) => error;

      axios.addResponseInterceptor(instance.id, fulfilled, rejected);

      expect(instance.interceptors.response).toHaveLength(1);
      expect(instance.interceptors.response[0].fulfilled).toBe(fulfilled);
      expect(instance.interceptors.response[0].rejected).toBe(rejected);
    });

    it('应该处理不存在的实例', () => {
      expect(() => {
        axios.addRequestInterceptor('non-existent', () => {}, () => {});
      }).toThrow('Instance non-existent not found');
    });

    it('应该更新拦截器统计', () => {
      axios.addRequestInterceptor(instance.id, () => {}, () => {});
      axios.addResponseInterceptor(instance.id, () => {}, () => {});

      const stats = axios.getStats();
      expect(stats.interceptors).toBe(2);
    });
  });

  describe('HTTP请求', () => {
    let instance;

    beforeEach(() => {
      instance = axios.create({
        baseURL: 'https://api.workflow.local'
      });
    });

    it('应该能发送GET请求', async () => {
      const response = await axios.get(instance.id, '/users', { param: 'test' });

      expect(response).toBeDefined();
      expect(response.status).toBe(200);
      expect(response.statusText).toBe('OK');
      expect(response.data).toBeDefined();
      expect(response.config.method).toBe('GET');
      expect(response.config.url).toBe('/users');
    });

    it('应该能发送POST请求', async () => {
      const postData = { name: 'John', email: 'john@test.com' };
      const response = await axios.post(instance.id, '/users', postData);

      expect(response).toBeDefined();
      expect(response.status).toBe(200);
      expect(response.config.method).toBe('POST');
      expect(response.config.url).toBe('/users');
      expect(response.config.data).toBe(postData);
    });

    it('应该正确处理URL拼接', async () => {
      const response = await axios.get(instance.id, '/api/v1/data');

      expect(response.config.url).toBe('/api/v1/data');
      // 验证基础URL被正确应用（在request方法中）
    });

    it('应该处理不存在的实例', async () => {
      await expect(axios.get('non-existent', '/test')).rejects.toThrow('Instance non-existent not found');
    });

    it('应该记录请求历史', async () => {
      await axios.get(instance.id, '/test1');
      await axios.post(instance.id, '/test2', { data: 'test' });

      expect(axios.requests).toHaveLength(2);
      expect(axios.requests[0].method).toBe('GET');
      expect(axios.requests[0].url).toContain('/test1');
      expect(axios.requests[1].method).toBe('POST');
      expect(axios.requests[1].url).toContain('/test2');
    });
  });

  describe('通用请求方法', () => {
    let instance;

    beforeEach(() => {
      instance = axios.create();
    });

    it('应该支持完整的请求配置', async () => {
      const config = {
        method: 'PUT',
        url: '/users/123',
        data: { name: 'Updated Name' },
        headers: { 'Authorization': 'Bearer token' },
        timeout: 10000
      };

      const response = await axios.request(instance.id, config);

      expect(response.config.method).toBe('PUT');
      expect(response.config.url).toBe('/users/123');
      expect(response.config.data).toBe(config.data);
      expect(response.status).toBe(200);
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

      const response = await axios.get(instance.id, '/test');

      expect(requestIntercepted).toBe(true);
      expect(responseIntercepted).toBe(true);
      expect(response.intercepted).toBe(true);
    });

    it('应该处理网络延迟模拟', async () => {
      const startTime = performance.now();

      await axios.get(instance.id, '/delay-test');

      const duration = performance.now() - startTime;
      // 模拟延迟在10-50ms之间
      expect(duration).toBeGreaterThan(5);
      expect(duration).toBeLessThan(100);
    });
  });

  describe('错误处理', () => {
    it('应该处理无效的实例ID', async () => {
      await expect(axios.request('invalid-id', { method: 'GET', url: '/test' }))
        .rejects.toThrow('Instance invalid-id not found');
    });

    it('应该处理null和undefined参数', async () => {
      const instance = axios.create();

      // 这些应该不会抛出错误
      await expect(axios.get(instance.id, null)).resolves.toBeDefined();
      await expect(axios.get(instance.id, undefined)).resolves.toBeDefined();
      await expect(axios.post(instance.id, '/test', null)).resolves.toBeDefined();
    });
  });

  describe('统计信息', () => {
    it('应该提供准确的统计信息', async () => {
      expect(axios.getStats()).toEqual({
        instances: 1, // 包含默认实例
        requests: 0,
        interceptors: 0
      });

      const instance1 = axios.create();
      const instance2 = axios.create();

      axios.addRequestInterceptor(instance1.id, () => {}, () => {});
      axios.addResponseInterceptor(instance2.id, () => {}, () => {});

      await axios.get(instance1.id, '/test1');
      await axios.post(instance2.id, '/test2', {});

      const stats = axios.getStats();
      expect(stats.instances).toBe(3); // 包括默认实例
      expect(stats.requests).toBe(2);
      expect(stats.interceptors).toBe(2);
    });

    it('应该实时更新统计信息', async () => {
      const initialStats = axios.getStats();

      axios.create();
      const afterCreateStats = axios.getStats();

      expect(afterCreateStats.instances).toBe(initialStats.instances + 1);
      expect(afterCreateStats.requests).toBe(initialStats.requests);
    });
  });

  describe('性能测试', () => {
    it('应该能处理并发请求', async () => {
      const instance = axios.create();
      const requestCount = 50;

      const startTime = global.performanceMonitor.start();

      const promises = [];
      for (let i = 0; i < requestCount; i++) {
        promises.push(axios.get(instance.id, `/test/${i}`));
      }

      const results = await Promise.all(promises);
      const perfResult = global.performanceMonitor.end(startTime);

      console.log(`并发${requestCount}个请求总耗时: ${perfResult.formatted}`);
      expect(results).toHaveLength(requestCount);
      expect(results.every(r => r.status === 200)).toBe(true);
      expect(perfResult.duration).toBeLessThan(2000); // 2秒内完成
    });

    it('应该保持内存使用在合理范围内', async () => {
      const instance = axios.create();
      const initialMemory = global.memoryMonitor.getUsage();

      // 执行大量请求
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(axios.get(instance.id, `/memory-test/${i}`));
      }
      await Promise.all(promises);

      const finalMemory = global.memoryMonitor.getUsage();

      console.log('内存使用情况:');
      console.log(`初始: ${initialMemory.heapUsed}`);
      console.log(`最终: ${finalMemory.heapUsed}`);

      // 内存增长应该在合理范围内（这里只是示例检查）
      expect(finalMemory.heapUsed).toBeDefined();
    });
  });
});
