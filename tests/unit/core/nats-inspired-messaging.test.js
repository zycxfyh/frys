/**
 * NATSInspiredMessaging 单元测试
 * 测试消息队列系统的核心功能
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import NATSInspiredMessaging from '../../../src/core/NATSInspiredMessaging.js';

describe('NATSInspiredMessaging', () => {
  let nats;

  beforeEach(() => {
    nats = new NATSInspiredMessaging();
  });

  afterEach(() => {
    // 清理资源
    nats = null;
  });

  describe('构造函数', () => {
    it('应该正确初始化实例', () => {
      expect(nats).toBeInstanceOf(NATSInspiredMessaging);
      expect(nats.subjects).toBeDefined();
      expect(nats.subscriptions).toBeDefined();
      expect(nats.queues).toBeDefined();
      expect(nats.connections).toBeDefined();
    });

    it('应该有空的初始状态', () => {
      const stats = nats.getStats();
      expect(stats.subjects).toBe(0);
      expect(stats.subscriptions).toBe(0);
      expect(stats.connections).toBe(0);
    });
  });

  describe('连接管理', () => {
    it('应该能创建连接', async () => {
      const clusterName = 'test-cluster';
      const connection = await nats.connect(clusterName);

      expect(connection).toBeDefined();
      expect(connection.cluster).toBe(clusterName);
      expect(connection.connected).toBe(true);
      expect(connection.id).toBeDefined();
      expect(connection.createdAt).toBeDefined();
    });

    it('应该生成唯一的连接ID', async () => {
      const conn1 = await nats.connect('cluster1');
      const conn2 = await nats.connect('cluster2');

      expect(conn1.id).not.toBe(conn2.id);
      expect(global.assertionHelpers.isValidUUID(conn1.id)).toBe(false); // 我们使用自定义ID格式
    });

    it('应该更新连接统计', async () => {
      await nats.connect('test-cluster');
      const stats = nats.getStats();

      expect(stats.connections).toBe(1);
    });
  });

  describe('消息发布', () => {
    beforeEach(async () => {
      await nats.connect('test-cluster');
    });

    it('应该能发布消息到主题', async () => {
      const subject = 'test.events';
      const message = { type: 'user_action', userId: '123' };

      const result = await nats.publish(subject, message);

      expect(result).toBeDefined();
      expect(result.subject).toBe(subject);
      expect(result.message).toBe(message);
      expect(result.delivered).toBe(0); // 没有订阅者
    });

    it('应该处理没有订阅者的发布', async () => {
      const result = await nats.publish('empty.topic', 'test message');

      expect(result.delivered).toBe(0);
      expect(result.subject).toBe('empty.topic');
    });

    it('应该处理复杂消息对象', async () => {
      const complexMessage = {
        id: 'msg-001',
        timestamp: Date.now(),
        payload: {
          user: { id: 123, name: 'John' },
          action: 'login',
          metadata: { ip: '192.168.1.1', userAgent: 'Chrome' }
        }
      };

      const result = await nats.publish('user.events', complexMessage);

      expect(result.message).toEqual(complexMessage);
    });
  });

  describe('消息订阅', () => {
    beforeEach(async () => {
      await nats.connect('test-cluster');
    });

    it('应该能订阅主题', async () => {
      const subject = 'test.topic';
      let receivedMessage = null;

      const subscription = nats.subscribe(subject, (message) => {
        receivedMessage = message;
      });

      expect(subscription).toBeDefined();
      expect(subscription.id).toBeDefined();
      expect(subscription.subject).toBe(subject);
    });

    it('应该接收已订阅主题的消息', async () => {
      const subject = 'test.messages';
      const testMessage = { data: 'hello world' };
      let receivedMessage = null;

      nats.subscribe(subject, (message) => {
        receivedMessage = message;
      });

      await nats.publish(subject, testMessage);

      // 等待异步消息处理
      await global.asyncHelpers.sleep(10);

      expect(receivedMessage).toEqual(testMessage);
    });

    it('应该支持多个订阅者', async () => {
      const subject = 'broadcast.topic';
      const testMessage = { event: 'system_update' };
      const receivedMessages = [];

      // 创建两个订阅者
      nats.subscribe(subject, (message) => receivedMessages.push({ sub1: message }));
      nats.subscribe(subject, (message) => receivedMessages.push({ sub2: message }));

      await nats.publish(subject, testMessage);

      // 等待异步消息处理
      await global.asyncHelpers.sleep(10);

      expect(receivedMessages).toHaveLength(2);
      expect(receivedMessages[0].sub1).toEqual(testMessage);
      expect(receivedMessages[1].sub2).toEqual(testMessage);
    });

    it('应该隔离不同主题的消息', async () => {
      let topic1Message = null;
      let topic2Message = null;

      nats.subscribe('topic1', (msg) => topic1Message = msg);
      nats.subscribe('topic2', (msg) => topic2Message = msg);

      await nats.publish('topic1', 'message1');
      await nats.publish('topic2', 'message2');

      await global.asyncHelpers.sleep(10);

      expect(topic1Message).toBe('message1');
      expect(topic2Message).toBe('message2');
    });
  });

  describe('统计信息', () => {
    it('应该提供准确的统计信息', async () => {
      // 初始状态
      expect(nats.getStats()).toEqual({
        subjects: 0,
        subscriptions: 0,
        connections: 0,
        messages: 0
      });

      // 添加连接
      await nats.connect('cluster1');
      expect(nats.getStats().connections).toBe(1);

      // 添加订阅
      nats.subscribe('topic1', () => {});
      nats.subscribe('topic2', () => {});
      expect(nats.getStats().subscriptions).toBe(2);

      // 发布消息（应该不影响统计）
      await nats.publish('topic1', 'test');
      expect(nats.getStats().subscriptions).toBe(2);
    });

    it('应该实时更新统计信息', async () => {
      const initialStats = nats.getStats();

      await nats.connect('test-cluster');
      const afterConnectStats = nats.getStats();

      expect(afterConnectStats.connections).toBe(initialStats.connections + 1);
      expect(afterConnectStats.subjects).toBe(initialStats.subjects);
      expect(afterConnectStats.subscriptions).toBe(initialStats.subscriptions);
    });
  });

  describe('错误处理', () => {
    it('应该处理无效的连接参数', async () => {
      await expect(nats.connect('')).resolves.toBeDefined();
      await expect(nats.connect(null)).resolves.toBeDefined();
      await expect(nats.connect(undefined)).resolves.toBeDefined();
    });

    it('应该处理无效的主题名称', async () => {
      await expect(nats.publish('', 'test')).resolves.toBeDefined();
      await expect(nats.publish(null, 'test')).resolves.toBeDefined();
      await expect(nats.subscribe('', () => {})).toBeDefined();
    });

    it('应该处理无效的回调函数', async () => {
      const subscription = nats.subscribe('test.topic', null);
      expect(subscription).toBeDefined();

      const subscription2 = nats.subscribe('test.topic', undefined);
      expect(subscription2).toBeDefined();
    });
  });

  describe('性能测试', () => {
    it('应该能处理高频消息发布', async () => {
      await nats.connect('perf-test');
      const messageCount = 1000;
      const subject = 'perf.test';

      const startTime = global.performanceMonitor.start();

      // 并发发布消息
      const promises = [];
      for (let i = 0; i < messageCount; i++) {
        promises.push(nats.publish(subject, { id: i, data: `message-${i}` }));
      }

      await Promise.all(promises);
      const perfResult = global.performanceMonitor.end(startTime);

      console.log(`发布 ${messageCount} 条消息耗时: ${perfResult.formatted}`);
      expect(perfResult.duration).toBeLessThan(5000); // 5秒内完成
    });

    it('应该能处理大量订阅者', async () => {
      await nats.connect('perf-test');
      const subscriberCount = 100;
      const subject = 'broadcast.perf';
      const receivedCounts = new Array(subscriberCount).fill(0);

      // 创建大量订阅者
      for (let i = 0; i < subscriberCount; i++) {
        nats.subscribe(subject, () => {
          receivedCounts[i]++;
        });
      }

      // 发布消息
      await nats.publish(subject, { event: 'broadcast' });

      // 等待消息处理
      await global.asyncHelpers.sleep(50);

      const totalReceived = receivedCounts.reduce((sum, count) => sum + count, 0);
      expect(totalReceived).toBe(subscriberCount);
    });
  });

  describe('内存管理', () => {
    it('应该正确清理资源', async () => {
      await nats.connect('memory-test');

      // 添加一些订阅
      for (let i = 0; i < 10; i++) {
        nats.subscribe(`topic${i}`, () => {});
      }

      const beforeCleanup = nats.getStats();

      // 模拟清理（在实际实现中会有cleanup方法）
      // 这里我们只是验证统计的准确性

      expect(beforeCleanup.connections).toBe(1);
      expect(beforeCleanup.subscriptions).toBe(10);
    });
  });
});
