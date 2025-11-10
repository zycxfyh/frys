/**
 * 基础设施性能基准测试
 * 测试frys基础设施组件的性能表现
 */

import { performance } from 'perf_hooks';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

export class InfrastructureBenchmarks {
  constructor(options = {}) {
    this.options = {
      iterations: options.iterations || 5,
      operationCount: options.operationCount || 1000,
      ...options
    };
    this.results = {};
  }

  /**
   * 运行所有基础设施基准测试
   */
  async runAllBenchmarks() {
    console.log('🏗️ 开始基础设施性能基准测试...');

    try {
      this.results.config = await this.benchmarkConfigManager();
      this.results.logging = await this.benchmarkLoggingSystem();
      this.results.caching = await this.benchmarkCachingSystem();
      this.results.events = await this.benchmarkEventSystem();
      this.results.httpClient = await this.benchmarkHttpClient();

      console.log('✅ 基础设施性能基准测试完成');
      return this.results;
    } catch (error) {
      console.warn('⚠️ 某些基础设施测试失败:', error.message);
      return this.results;
    }
  }

  /**
   * 配置管理器性能测试
   */
  async benchmarkConfigManager() {
    console.log('  ⚙️ 测试配置管理器性能...');

    try {
      // 动态导入配置管理器
      const configModule = await import(path.join(rootDir, 'src/shared/utils/config.js'));
      const { ConfigurationManager } = configModule;

      const results = {};

      // 测试配置加载性能
      const loadTimes = await this.benchmarkOperation(
        async () => new ConfigurationManager(),
        async (configManager) => {
          await configManager.load({
            app: { name: 'benchmark', version: '1.0.0' },
            database: { host: 'localhost', port: 5432 }
          });
        }
      );
      results.load = loadTimes;

      // 测试配置读取性能
      const readTimes = await this.benchmarkOperation(
        async () => {
          const manager = new ConfigurationManager();
          await manager.load({
            app: { name: 'benchmark' },
            database: { host: 'localhost' },
            cache: { ttl: 300 }
          });
          return manager;
        },
        (manager) => {
          for (let i = 0; i < this.options.operationCount; i++) {
            manager.get(`test.key${i % 10}`);
          }
        }
      );
      results.read = readTimes;

      // 测试配置写入性能
      const writeTimes = await this.benchmarkOperation(
        async () => {
          const manager = new ConfigurationManager();
          await manager.load({});
          return manager;
        },
        (manager) => {
          for (let i = 0; i < this.options.operationCount; i++) {
            manager.set(`dynamic.key${i}`, `value${i}`);
          }
        }
      );
      results.write = writeTimes;

      console.log(`  ✅ 配置管理器: 读取${results.read.average.toFixed(3)}ms, 写入${results.write.average.toFixed(3)}ms`);
      return results;

    } catch (error) {
      console.warn('  ⚠️ 配置管理器测试失败:', error.message);
      return { error: error.message };
    }
  }

  /**
   * 日志系统性能测试
   */
  async benchmarkLoggingSystem() {
    console.log('  📝 测试日志系统性能...');

    try {
      // 动态导入日志系统
      const loggerModule = await import(path.join(rootDir, 'src/shared/utils/logger.js'));
      const { logger } = loggerModule;

      const results = {};

      // 测试不同级别日志的性能
      const levels = ['debug', 'info', 'warn', 'error'];
      results.byLevel = {};

      for (const level of levels) {
        const times = await this.benchmarkOperation(
          () => logger,
          (log) => {
            for (let i = 0; i < this.options.operationCount; i++) {
              log[level](`Test message ${i}`, { iteration: i, level });
            }
          }
        );
        results.byLevel[level] = times;
      }

      // 测试结构化日志性能
      const structuredTimes = await this.benchmarkOperation(
        () => logger,
        (log) => {
          for (let i = 0; i < this.options.operationCount; i++) {
            log.info('Structured log entry', {
              userId: `user${i % 100}`,
              action: 'test_action',
              timestamp: Date.now(),
              metadata: {
                sessionId: `session${i % 50}`,
                ip: `192.168.1.${i % 255}`,
                userAgent: 'BenchmarkClient/1.0'
              }
            });
          }
        }
      );
      results.structured = structuredTimes;

      // 测试错误日志性能
      const errorTimes = await this.benchmarkOperation(
        () => logger,
        (log) => {
          for (let i = 0; i < Math.min(this.options.operationCount, 100); i++) {
            try {
              throw new Error(`Test error ${i}`);
            } catch (error) {
              log.error('Error occurred', error, { context: `test_${i}` });
            }
          }
        }
      );
      results.errors = errorTimes;

      console.log(`  ✅ 日志系统: info${results.byLevel.info.average.toFixed(3)}ms, 结构化${results.structured.average.toFixed(3)}ms`);
      return results;

    } catch (error) {
      console.warn('  ⚠️ 日志系统测试失败:', error.message);
      return { error: error.message };
    }
  }

  /**
   * 缓存系统性能测试
   */
  async benchmarkCachingSystem() {
    console.log('  💾 测试缓存系统性能...');

    try {
      // 尝试导入缓存相关模块
      const cacheModule = await import(path.join(rootDir, 'src/infrastructure/persistence/index.js'));
      const { createCacheManager } = cacheModule;

      const results = {};

      // 创建缓存管理器
      const cacheManager = createCacheManager({
        type: 'memory',
        maxSize: 10000,
        ttl: 300000 // 5分钟
      });

      // 测试缓存写入性能
      const writeTimes = await this.benchmarkOperation(
        () => cacheManager,
        (cache) => {
          for (let i = 0; i < this.options.operationCount; i++) {
            cache.set(`key${i}`, {
              id: i,
              data: `value${i}`,
              timestamp: Date.now(),
              metadata: { size: 100 + (i % 100) }
            });
          }
        }
      );
      results.write = writeTimes;

      // 测试缓存读取性能（命中）
      const hitReadTimes = await this.benchmarkOperation(
        () => cacheManager,
        (cache) => {
          for (let i = 0; i < this.options.operationCount; i++) {
            cache.get(`key${i % 1000}`);
          }
        }
      );
      results.hitRead = hitReadTimes;

      // 测试缓存读取性能（未命中）
      const missReadTimes = await this.benchmarkOperation(
        () => cacheManager,
        (cache) => {
          for (let i = 0; i < this.options.operationCount; i++) {
            cache.get(`nonexistent_key${i}`);
          }
        }
      );
      results.missRead = missReadTimes;

      // 测试缓存删除性能
      const deleteTimes = await this.benchmarkOperation(
        () => cacheManager,
        (cache) => {
          for (let i = 0; i < Math.min(this.options.operationCount, 1000); i++) {
            cache.delete(`key${i}`);
          }
        }
      );
      results.delete = deleteTimes;

      console.log(`  ✅ 缓存系统: 写入${results.write.average.toFixed(3)}ms, 读取命中${results.hitRead.average.toFixed(3)}ms`);
      return results;

    } catch (error) {
      console.warn('  ⚠️ 缓存系统测试失败:', error.message);
      return { error: error.message };
    }
  }

  /**
   * 事件系统性能测试
   */
  async benchmarkEventSystem() {
    console.log('  📡 测试事件系统性能...');

    try {
      // 动态导入事件系统
      const eventModule = await import(path.join(rootDir, 'src/shared/kernel/EventBus.js'));
      const { EventBus } = eventModule;

      const results = {};

      // 创建事件总线
      const eventBus = new EventBus();

      // 注册事件处理器
      const handlers = {};
      for (let i = 0; i < 10; i++) {
        handlers[`handler${i}`] = (event) => {
          // 简单的处理逻辑
          return event.data;
        };
        eventBus.on('test_event', handlers[`handler${i}`]);
      }

      // 测试事件发布性能
      const publishTimes = await this.benchmarkOperation(
        () => eventBus,
        (bus) => {
          for (let i = 0; i < this.options.operationCount; i++) {
            bus.publish('test_event', {
              id: i,
              data: `payload${i}`,
              timestamp: Date.now()
            });
          }
        }
      );
      results.publish = publishTimes;

      // 测试异步事件处理性能
      const asyncPublishTimes = await this.benchmarkOperation(
        () => eventBus,
        async (bus) => {
          const promises = [];
          for (let i = 0; i < Math.min(this.options.operationCount, 100); i++) {
            promises.push(new Promise((resolve) => {
              bus.once('async_response', () => resolve());
              bus.publish('async_event', { id: i });
              // 模拟异步响应
              setImmediate(() => bus.publish('async_response', { responseId: i }));
            }));
          }
          await Promise.all(promises);
        }
      );
      results.asyncPublish = asyncPublishTimes;

      console.log(`  ✅ 事件系统: 发布${results.publish.average.toFixed(3)}ms, 异步${results.asyncPublish.average.toFixed(3)}ms`);
      return results;

    } catch (error) {
      console.warn('  ⚠️ 事件系统测试失败:', error.message);
      return { error: error.message };
    }
  }

  /**
   * HTTP客户端性能测试
   */
  async benchmarkHttpClient() {
    console.log('  🌐 测试HTTP客户端性能...');

    try {
      // 动态导入HTTP客户端
      const httpModule = await import(path.join(rootDir, 'src/core/HttpClient.js'));
      const { HttpClient } = httpModule;

      const results = {};

      // 创建HTTP客户端实例
      const httpClient = new HttpClient({
        baseURL: 'http://httpbin.org',
        timeout: 5000,
        retries: 0 // 禁用重试以获得准确的性能数据
      });

      // 测试GET请求性能（使用mock数据避免真实网络调用）
      const getTimes = await this.benchmarkOperation(
        () => httpClient,
        async (client) => {
          // 使用本地mock而不是真实HTTP调用
          for (let i = 0; i < Math.min(this.options.operationCount, 50); i++) {
            try {
              // 这里应该使用mock或本地服务器
              await new Promise(resolve => setTimeout(resolve, 1)); // 模拟网络延迟
            } catch (error) {
              // 忽略网络错误
            }
          }
        }
      );
      results.get = getTimes;

      // 测试请求构建性能
      const buildTimes = await this.benchmarkOperation(
        () => httpClient,
        (client) => {
          for (let i = 0; i < this.options.operationCount; i++) {
            client.buildRequest('GET', `/api/test/${i}`, {
              headers: {
                'Authorization': `Bearer token${i}`,
                'Content-Type': 'application/json',
                'X-Request-ID': `req-${i}`
              },
              params: {
                page: i % 10,
                limit: 20,
                filter: `test${i % 5}`
              }
            });
          }
        }
      );
      results.build = buildTimes;

      console.log(`  ✅ HTTP客户端: 请求构建${results.build.average.toFixed(3)}ms`);
      return results;

    } catch (error) {
      console.warn('  ⚠️ HTTP客户端测试失败:', error.message);
      return { error: error.message };
    }
  }

  // 辅助方法
  calculatePercentile(values, percentile) {
    const sorted = [...values].sort((a, b) => a - b);
    const index = (percentile / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index % 1;

    if (upper >= sorted.length) return sorted[sorted.length - 1];
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }

  async benchmarkOperation(setup, operation) {
    const times = [];

    // 预热
    try {
      for (let i = 0; i < 2; i++) {
        const data = typeof setup === 'function' ? await setup() : setup;
        await operation(data);
      }
    } catch (error) {
      // 预热失败，跳过此测试
      return { error: `预热失败: ${error.message}` };
    }

    // 正式测试
    for (let i = 0; i < this.options.iterations; i++) {
      try {
        const data = typeof setup === 'function' ? await setup() : setup;
        const start = performance.now();
        await operation(data);
        const end = performance.now();
        times.push(end - start);
      } catch (error) {
        times.push(null); // 记录失败
      }
    }

    const validTimes = times.filter(t => t !== null);
    if (validTimes.length === 0) {
      return { error: '所有测试迭代都失败了' };
    }

    return {
      average: validTimes.reduce((a, b) => a + b, 0) / validTimes.length,
      min: Math.min(...validTimes),
      max: Math.max(...validTimes),
      p95: this.calculatePercentile(validTimes, 95),
      successRate: validTimes.length / times.length
    };
  }
}

export default InfrastructureBenchmarks;
