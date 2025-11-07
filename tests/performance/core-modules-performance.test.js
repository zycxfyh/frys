/**
 * 核心模块性能测试
 * 测试各个模块在高负载下的性能表现
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import NATSInspiredMessaging from '../../src/core/NATSInspiredMessaging.js';
import AxiosInspiredHTTP from '../../src/core/AxiosInspiredHTTP.js';
import DayJSInspiredDate from '../../src/core/DayJSInspiredDate.js';
import ZustandInspiredState from '../../src/core/ZustandInspiredState.js';
import LodashInspiredUtils from '../../src/core/LodashInspiredUtils.js';
import JWTInspiredAuth from '../../src/core/JWTInspiredAuth.js';

describe('核心模块性能测试', () => {
  let messaging, http, date, state, utils, jwt;

  beforeEach(() => {
    messaging = new NATSInspiredMessaging();
    http = new AxiosInspiredHTTP();
    date = new DayJSInspiredDate();
    state = new ZustandInspiredState();
    utils = new LodashInspiredUtils();
    jwt = new JWTInspiredAuth();

    // 设置JWT密钥用于性能测试
    jwt.setSecret('perf-key', 'performance-test-secret');
  });

  afterEach(() => {
    messaging = null;
    http = null;
    date = null;
    state = null;
    utils = null;
    jwt = null;
  });

  describe('消息队列性能测试', () => {
    it('应该处理高频消息发布', async () => {
      const connection = await messaging.connect('perf-cluster');

      const topic = 'perf.messages';
      const messageCount = 1000;
      const messages = [];

      // 创建订阅者
      const subscription = messaging.subscribe(topic, (message) => {
        messages.push(JSON.parse(message));
      });

      const startTime = global.performanceMonitor.start();

      // 批量发布消息
      const publishPromises = [];
      for (let i = 0; i < messageCount; i++) {
        publishPromises.push(
          messaging.publish(topic, JSON.stringify({
            id: `msg_${i}`,
            data: `Message ${i}`,
            timestamp: Date.now()
          }), connection.id)
        );
      }

      await Promise.all(publishPromises);

      // 等待所有消息处理
      await new Promise(resolve => setTimeout(resolve, 1000));

      const perfResult = global.performanceMonitor.end(startTime);

      console.log(`消息队列性能: ${messageCount}消息, 耗时${perfResult.formatted}`);

      // 验证性能指标
      expect(messages.length).toBe(messageCount);
      expect(perfResult.duration).toBeLessThan(1500); // 1.5秒内完成（考虑到异步处理）
      expect(messages.every(msg => msg.id)).toBe(true);

      // 清理
      messaging.unsubscribe(connection.id, subscription.id);
    });

    it('应该处理大量并发订阅者', async () => {
      const connection = await messaging.connect('perf-cluster');

      const topic = 'broadcast.test';
      const subscriberCount = 50;
      const messageCount = 10;
      const receivedMessages = new Map();

      // 创建多个订阅者
      const subscriptions = [];
      for (let i = 0; i < subscriberCount; i++) {
        const messages = [];
        receivedMessages.set(`sub_${i}`, messages);

        const subscription = messaging.subscribe(topic, (message) => {
          messages.push(JSON.parse(message));
        });
        subscriptions.push(subscription);
      }

      const startTime = global.performanceMonitor.start();

      // 广播消息给所有订阅者
      const publishPromises = [];
      for (let i = 0; i < messageCount; i++) {
        publishPromises.push(
          messaging.publish(topic, JSON.stringify({
            broadcastId: `broadcast_${i}`,
            content: `Broadcast message ${i}`,
            timestamp: Date.now()
          }), connection.id)
        );
      }

      await Promise.all(publishPromises);

      // 等待消息传播
      await new Promise(resolve => setTimeout(resolve, 1000));

      const perfResult = global.performanceMonitor.end(startTime);

      console.log(`广播性能: ${subscriberCount}订阅者 x ${messageCount}消息, 耗时${perfResult.formatted}`);

      // 验证所有订阅者都收到了消息
      expect(receivedMessages.size).toBe(subscriberCount);
      for (const [subId, messages] of receivedMessages) {
        expect(messages.length).toBe(messageCount);
        expect(messages.every(msg => msg.broadcastId)).toBe(true);
      }

      expect(perfResult.duration).toBeLessThan(1500); // 1.5秒内完成（考虑到异步处理）

      // 清理
      subscriptions.forEach(sub => {
        messaging.unsubscribe(connection.id, sub.id);
      });
    });
  });

  describe('HTTP客户端性能测试', () => {
    it('应该处理并发HTTP请求', async () => {
      const instance = http.create({
        baseURL: 'https://api.workflow.local'
      });

      const requestCount = 100;
      const responses = [];

      const startTime = global.performanceMonitor.start();

      // 并发发送请求
      const promises = [];
      for (let i = 0; i < requestCount; i++) {
        promises.push(
          http.request(instance.id, {
            method: 'GET',
            url: `/api/data/${i}`,
            headers: {
              'X-Request-ID': `req_${i}`,
              'X-Timestamp': Date.now().toString()
            }
          }).then(response => {
            responses.push(response);
            return response;
          })
        );
      }

      await Promise.all(promises);
      const perfResult = global.performanceMonitor.end(startTime);

      console.log(`HTTP并发性能: ${requestCount}请求, 耗时${perfResult.formatted}`);

      // 验证响应
      expect(responses.length).toBe(requestCount);
      expect(responses.every(r => r.success)).toBe(true);
      expect(perfResult.duration).toBeLessThan(2000); // 2秒内完成

      // 验证内存使用
      const memoryUsage = process.memoryUsage();
      console.log(`内存使用: RSS=${(memoryUsage.rss / 1024 / 1024).toFixed(2)}MB, Heap=${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`);
    });

    it('应该处理大数据传输', async () => {
      const instance = http.create({
        baseURL: 'https://api.workflow.local'
      });

      // 创建大数据payload
      const largeData = {
        dataset: Array.from({ length: 10000 }, (_, i) => ({
          id: i,
          data: `Item ${i}`.repeat(10), // 创建较大字符串
          timestamp: Date.now(),
          metadata: { size: Math.random() * 1000, category: i % 10 }
        })),
        summary: {
          totalItems: 10000,
          categories: 10,
          generatedAt: Date.now()
        }
      };

      const startTime = global.performanceMonitor.start();

      const response = await http.request(instance.id, {
        method: 'POST',
        url: '/api/bulk-upload',
        headers: {
          'Content-Type': 'application/json',
          'X-Data-Size': JSON.stringify(largeData).length.toString()
        },
        data: largeData
      });

      const perfResult = global.performanceMonitor.end(startTime);

      console.log(`大数据传输性能: ${JSON.stringify(largeData).length}字节, 耗时${perfResult.formatted}`);

      expect(response.success).toBe(true);
      expect(perfResult.duration).toBeLessThan(500); // 500ms内完成
    });
  });

  describe('日期处理性能测试', () => {
    it('应该高效处理大量日期操作', () => {
      const operationCount = 10000;
      const dates = [];

      const startTime = global.performanceMonitor.start();

      // 执行大量日期操作
      for (let i = 0; i < operationCount; i++) {
        const dateObj = date.day(new Date(2024, i % 12, (i % 28) + 1));
        dates.push({
          formatted: dateObj.format('YYYY-MM-DD'),
          timestamp: dateObj.valueOf(),
          isValid: dateObj.isValid()
        });
      }

      const perfResult = global.performanceMonitor.end(startTime);

      console.log(`日期处理性能: ${operationCount}操作, 耗时${perfResult.formatted}`);

      expect(dates.length).toBe(operationCount);
      expect(dates.every(d => d.formatted && d.timestamp && d.isValid !== undefined)).toBe(true);
      expect(perfResult.duration).toBeLessThan(600); // 600ms内完成

      // 验证日期统计
      const stats = date.getStats();
      expect(stats.formats).toBeGreaterThan(0);
    });

    it('应该处理复杂的日期计算', () => {
      const testCases = 1000;
      const results = [];

      const startTime = global.performanceMonitor.start();

      for (let i = 0; i < testCases; i++) {
        const baseDate = date.day(new Date(2024, 0, 1));
        const futureDate = baseDate.add(i, 'days');
        const pastDate = baseDate.subtract(i % 365, 'days');

        results.push({
          base: baseDate.format('YYYY-MM-DD'),
          future: futureDate.format('YYYY-MM-DD'),
          past: pastDate.format('YYYY-MM-DD'),
          diff: date.diffDate(futureDate._date, pastDate._date, 'days')
        });
      }

      const perfResult = global.performanceMonitor.end(startTime);

      console.log(`复杂日期计算性能: ${testCases}计算, 耗时${perfResult.formatted}`);

      expect(results.length).toBe(testCases);
      expect(results.every(r => r.diff >= 0)).toBe(true);
      expect(perfResult.duration).toBeLessThan(200); // 200ms内完成
    });
  });

  describe('状态管理性能测试', () => {
    it('应该处理高频状态更新', () => {
      const store = state.create((set) => ({
        counter: 0,
        updates: 0,
        increment: () => set(state => ({
          counter: state.counter + 1,
          updates: state.updates + 1
        }))
      }));

      const updateCount = 10000;

      const startTime = global.performanceMonitor.start();

      for (let i = 0; i < updateCount; i++) {
        store.increment();
      }

      const perfResult = global.performanceMonitor.end(startTime);

      console.log(`状态更新性能: ${updateCount}更新, 耗时${perfResult.formatted}`);

      expect(store.state.counter).toBe(updateCount);
      expect(store.state.updates).toBe(updateCount);
      expect(perfResult.duration).toBeLessThan(300); // 300ms内完成
    });

    it('应该处理复杂状态对象', () => {
      const store = state.create((set) => ({
        data: {},
        setComplexData: (key, value) => set(state => ({
          data: { ...state.data, [key]: value }
        }))
      }));

      const dataPoints = 1000;
      const complexData = {};

      // 生成复杂数据
      for (let i = 0; i < dataPoints; i++) {
        complexData[`key_${i}`] = {
          id: i,
          value: Math.random(),
          metadata: {
            created: Date.now(),
            tags: [`tag${i % 10}`, `category${i % 5}`],
            nested: {
              level1: {
                level2: {
                  data: `Nested data ${i}`
                }
              }
            }
          }
        };
      }

      const startTime = global.performanceMonitor.start();

      // 批量设置复杂数据
      Object.entries(complexData).forEach(([key, value]) => {
        store.setComplexData(key, value);
      });

      const perfResult = global.performanceMonitor.end(startTime);

      console.log(`复杂状态性能: ${dataPoints}数据点, 耗时${perfResult.formatted}`);

      expect(Object.keys(store.state.data)).toHaveLength(dataPoints);
      expect(perfResult.duration).toBeLessThan(1000); // 1000ms内完成

      // 验证内存使用
      const memoryUsage = process.memoryUsage();
      console.log(`状态对象内存: ${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`);
    });
  });

  describe('工具函数性能测试', () => {
    it('应该高效处理大数据集操作', () => {
      // 创建大数据集
      const largeArray = Array.from({ length: 10000 }, (_, i) => ({
        id: i,
        category: `cat${i % 10}`,
        value: Math.random(),
        active: i % 2 === 0
      }));

      const startTime = global.performanceMonitor.start();

      // 执行多种操作
      const unique = utils.uniq(largeArray);
      const grouped = utils.groupBy(unique, 'category');
      const activeItems = unique.filter(item => item.active);
      const cloned = utils.cloneDeep(grouped);

      const perfResult = global.performanceMonitor.end(startTime);

      console.log(`工具函数大数据性能: ${largeArray.length}项, 耗时${perfResult.formatted}`);

      expect(unique.length).toBe(largeArray.length); // 所有项都是唯一的
      expect(Object.keys(grouped)).toHaveLength(10); // 10个类别
      expect(activeItems.length).toBe(largeArray.length / 2); // 约一半激活
      expect(perfResult.duration).toBeLessThan(400); // 400ms内完成

      // 验证工具函数统计
      const stats = utils.getStats();
      expect(stats.operations).toBe(3); // uniq, groupBy, cloneDeep
    });

    it('应该处理内存密集型操作', () => {
      const iterations = 100;
      const results = [];

      const initialMemory = process.memoryUsage().heapUsed;

      const startTime = global.performanceMonitor.start();

      for (let i = 0; i < iterations; i++) {
        // 创建大型对象
        const largeObject = {
          data: Array.from({ length: 1000 }, (_, j) => ({
            id: `${i}_${j}`,
            content: 'x'.repeat(100), // 100字符字符串
            nested: {
              level1: {
                level2: {
                  value: Math.random()
                }
              }
            }
          })),
          metadata: {
            iteration: i,
            timestamp: Date.now(),
            size: 1000
          }
        };

        // 执行深度克隆
        const cloned = utils.cloneDeep(largeObject);
        results.push(cloned);

        // 每10次清理一次
        if (i % 10 === 0) {
          // 强制垃圾回收（如果可用）
          if (global.gc) {
            global.gc();
          }
        }
      }

      const perfResult = global.performanceMonitor.end(startTime);
      const finalMemory = process.memoryUsage().heapUsed;

      console.log(`内存密集操作性能: ${iterations}迭代, 耗时${perfResult.formatted}`);
      console.log(`内存变化: ${(initialMemory / 1024 / 1024).toFixed(2)}MB → ${(finalMemory / 1024 / 1024).toFixed(2)}MB`);

      expect(results.length).toBe(iterations);
      expect(perfResult.duration).toBeLessThan(4500); // 4.5秒内完成
    });
  });

  describe('JWT认证性能测试', () => {
    it('应该高效处理令牌生成和验证', () => {
      const tokenCount = 1000;
      const tokens = [];
      const userData = { userId: 123, role: 'user', permissions: ['read', 'write'] };

      const startTime = global.performanceMonitor.start();

      // 批量生成令牌
      for (let i = 0; i < tokenCount; i++) {
        const token = jwt.generateToken({
          ...userData,
          sessionId: `session_${i}`
        }, 'perf-key', { expiresIn: 3600 });
        tokens.push(token);
      }

      const generateTime = global.performanceMonitor.end(startTime);

      console.log(`JWT生成性能: ${tokenCount}令牌, 耗时${generateTime.formatted}`);

      // 验证令牌
      const verifyStartTime = global.performanceMonitor.start();

      const verifiedTokens = tokens.map(token => {
        try {
          return jwt.verifyToken(token, 'perf-key');
        } catch (error) {
          return null;
        }
      });

      const verifyTime = global.performanceMonitor.end(verifyStartTime);

      console.log(`JWT验证性能: ${tokenCount}令牌, 耗时${verifyTime.formatted}`);

      // 验证结果
      expect(tokens.length).toBe(tokenCount);
      expect(verifiedTokens.filter(v => v !== null)).toHaveLength(tokenCount);
      expect(generateTime.duration).toBeLessThan(250); // 250ms内完成
      expect(verifyTime.duration).toBeLessThan(600); // 600ms内完成

      // 验证统计信息
      const stats = jwt.getStats();
      expect(stats.tokens).toBe(tokenCount);
    });

    it('应该处理高并发认证场景', async () => {
      const concurrentUsers = 100;
      const authPromises = [];

      const startTime = global.performanceMonitor.start();

      // 并发执行认证流程
      for (let i = 0; i < concurrentUsers; i++) {
        authPromises.push(
          new Promise(resolve => {
            setTimeout(() => {
              // 生成令牌
              const token = jwt.generateToken({
                userId: i + 1,
                username: `user${i + 1}`,
                role: 'user'
              }, 'perf-key', { expiresIn: 3600 });

              // 验证令牌
              const verified = jwt.verifyToken(token, 'perf-key');
              resolve({ token, verified });
            }, Math.random() * 50); // 随机延迟模拟真实场景
          })
        );
      }

      const results = await Promise.all(authPromises);
      const perfResult = global.performanceMonitor.end(startTime);

      console.log(`并发认证性能: ${concurrentUsers}用户, 耗时${perfResult.formatted}`);

      // 验证结果
      expect(results.length).toBe(concurrentUsers);
      expect(results.every(r => r.verified && r.token)).toBe(true);
      expect(perfResult.duration).toBeLessThan(500); // 500ms内完成

      // 验证统计信息
      const stats = jwt.getStats();
      expect(stats.tokens).toBe(concurrentUsers);
    });
  });

  describe('综合性能测试', () => {
    it('应该处理完整的系统工作负载', async () => {
      const workload = {
        messages: 500,
        httpRequests: 200,
        stateUpdates: 1000,
        jwtTokens: 100,
        dataProcessing: 10000
      };

      const startTime = global.performanceMonitor.start();

      // 1. 消息队列负载
      const connection = await messaging.connect('perf-cluster');
      const msgPromises = [];
      for (let i = 0; i < workload.messages; i++) {
        msgPromises.push(
          messaging.publish('perf.load', JSON.stringify({ id: i, data: `msg${i}` }), connection.id)
        );
      }

      // 2. HTTP请求负载
      const httpInstance = http.create({ baseURL: 'https://api.workflow.local' });
      const httpPromises = [];
      for (let i = 0; i < workload.httpRequests; i++) {
        httpPromises.push(
          http.request(httpInstance.id, {
            method: 'GET',
            url: `/api/load/${i}`
          })
        );
      }

      // 3. 状态更新负载
      const store = state.create((set) => ({
        counter: 0,
        increment: () => set(state => ({ counter: state.counter + 1 }))
      }));

      // 4. JWT令牌负载
      const jwtPromises = [];
      for (let i = 0; i < workload.jwtTokens; i++) {
        jwtPromises.push(
          Promise.resolve(jwt.generateToken({ id: i }, 'perf-key'))
        );
      }

      // 5. 数据处理负载
      const data = Array.from({ length: workload.dataProcessing }, (_, i) => ({
        id: i,
        value: Math.random(),
        category: `cat${i % 10}`
      }));

      // 执行所有负载
      await Promise.all([
        ...msgPromises,
        ...httpPromises,
        ...jwtPromises
      ]);

      // 执行状态更新和数据处理
      for (let i = 0; i < workload.stateUpdates; i++) {
        store.increment();
      }

      const processed = utils.groupBy(data, 'category');

      const perfResult = global.performanceMonitor.end(startTime);

      console.log(`综合负载性能: 消息${workload.messages}, HTTP${workload.httpRequests}, 状态${workload.stateUpdates}, JWT${workload.jwtTokens}, 数据${workload.dataProcessing}`);
      console.log(`总耗时: ${perfResult.formatted}`);

      // 验证结果
      expect(store.state.counter).toBe(workload.stateUpdates);
      expect(Object.keys(processed)).toHaveLength(10);
      expect(perfResult.duration).toBeLessThan(3000); // 3秒内完成

      // 验证各模块统计
      expect(messaging.getStats().messages).toBe(workload.messages);
      expect(jwt.getStats().tokens).toBe(workload.jwtTokens);
      expect(utils.getStats().operations).toBe(1); // groupBy操作

      // 验证内存使用
      const memoryUsage = process.memoryUsage();
      console.log(`综合负载内存使用: RSS=${(memoryUsage.rss / 1024 / 1024).toFixed(2)}MB, Heap=${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`);

      expect(memoryUsage.heapUsed / 1024 / 1024).toBeLessThan(100); // 内存使用不超过100MB
    });
  });
});
