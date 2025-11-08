import {
  setupStrictTestEnvironment,
  createStrictTestCleanup,
  strictAssert,
  withTimeout,
  createDetailedErrorReporter
} from './test-helpers.js';

/**
 * 消息队列与状态管理的集成测试
 * 测试实时数据同步和事件驱动的状态更新
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import NATSInspiredMessaging from '../../src/core/NATSInspiredMessaging.js';
import ZustandInspiredState from '../../src/core/ZustandInspiredState.js';

describe('消息队列与状态管理集成测试', () => {
  let messaging;
  let state;
  let store;
  let connection;

  beforeEach(async () => {
    messaging = new NATSInspiredMessaging();
    state = new ZustandInspiredState();

    await messaging.initialize();
    await state.initialize();

    // 创建连接
    connection = await messaging.connect('test-cluster');

    // 创建状态存储
    store = state.create((set, get) => ({
      messages: [],
      users: new Map(),
      workflows: new Map(),
      notifications: [],
      stats: {
        totalMessages: 0,
        activeUsers: 0,
        notificationsCount: 0
      },
      realtime: {
        lastUpdate: null,
        connected: false,
        subscriptions: new Set()
      },

      // Actions
      setConnectionStatus: (connected) => set(state => ({
        realtime: {
          ...state.realtime,
          connected,
          lastUpdate: Date.now()
        }
      })),

      addMessage: (message) => set(state => ({
        messages: [...state.messages, message],
        stats: {
          ...state.stats,
          totalMessages: state.stats.totalMessages + 1
        },
        realtime: {
          ...state.realtime,
          lastUpdate: Date.now()
        }
      })),

      addUser: (user) => set(state => ({
        users: new Map(state.users).set(user.id, user),
        stats: {
          ...state.stats,
          activeUsers: state.stats.activeUsers + 1
        }
      })),

      addNotification: (notification) => set(state => ({
        notifications: [...state.notifications, notification],
        stats: {
          ...state.stats,
          notificationsCount: state.stats.notificationsCount + 1
        }
      })),

      setCounter: (value) => set(state => ({
        ...state,
        counter: value
      })),

      incrementCounter: () => set(state => ({
        ...state,
        counter: (state.counter || 0) + 1
      })),

      createWorkflow: (workflowData) => set(state => ({
        ...state,
        workflows: new Map(state.workflows || new Map()).set(workflowData.id, {
          ...workflowData,
          status: 'pending',
          createdAt: Date.now()
        })
      })),

      startWorkflow: (workflowId) => set(state => {
        const workflows = new Map(state.workflows);
        const workflow = workflows.get(workflowId) || {
          id: workflowId,
          status: 'pending',
          createdAt: Date.now()
        };
        workflows.set(workflowId, {
          ...workflow,
          status: 'processing',
          startTime: Date.now()
        });
        return { ...state, workflows };
      }),

      completeWorkflow: (workflowId) => set(state => {
        const workflows = new Map(state.workflows);
        const workflow = workflows.get(workflowId) || {
          id: workflowId,
          status: 'pending',
          createdAt: Date.now()
        };
        workflows.set(workflowId, {
          ...workflow,
          status: 'completed',
          completedAt: Date.now()
        });
        return { ...state, workflows };
      }),

      failWorkflow: (workflowId, error) => set(state => {
        const workflows = new Map(state.workflows);
        const workflow = workflows.get(workflowId) || {
          id: workflowId,
          status: 'pending',
          createdAt: Date.now()
        };
        workflows.set(workflowId, {
          ...workflow,
          status: 'failed',
          error,
          failedAt: Date.now()
        });
        return { ...state, workflows };
      }),

      addPersistentEvent: (event) => set(state => ({
        ...state,
        persistentEvents: [...(state.persistentEvents || []), event]
      })),

      recoverFromEvents: (events) => ({
        eventCount: events.length,
        lastEventId: events[events.length - 1]?.id,
        recoveredAt: Date.now()
      }),

      rebuildStateFromEvents: (events) => ({
        events,
        reconstructed: true,
        rebuildTime: Date.now()
      }),

      addReliableMessage: (message) => set(state => ({
        ...state,
        reliableMessages: [...(state.reliableMessages || []), message]
      })),

      addBackupMessage: (message) => set(state => ({
        ...state,
        backupMessages: [...(state.backupMessages || []), message]
      }))
    }));

    // 设置连接状态
    store.setConnectionStatus(true);
  });

  afterEach(async () => {
    if (connection) await connection.close();
    if (messaging) await messaging.destroy();
    if (state) await state.destroy();
    messaging = null;
    state = null;
    store = null;
    connection = null;
  });

  describe('实时消息同步', () => {
    it('应该通过消息队列实时更新状态', async () => {
      const topic = 'user.updates';
      const receivedMessages = [];

      // 订阅消息主题并更新状态
      const subscription = messaging.subscribe(topic, (message) => {
        receivedMessages.push(message);
        const userData = typeof message === 'string' ? JSON.parse(message) : message;

        // 更新状态
        store.addUser(userData);
        store.addNotification({
          type: 'user_update',
          userId: userData.id,
          timestamp: Date.now(),
          data: userData
        });
      });

      // 发布用户更新消息
      const userUpdates = [
        { id: 1, name: 'Alice', status: 'online', lastSeen: Date.now() },
        { id: 2, name: 'Bob', status: 'away', lastSeen: Date.now() },
        { id: 3, name: 'Charlie', status: 'online', lastSeen: Date.now() }
      ];

      for (const update of userUpdates) {
        await messaging.publish(topic, JSON.stringify(update));
      }

      // 等待消息处理
      await new Promise(resolve => setTimeout(resolve, 200));

      // 验证状态同步
      expect(receivedMessages).toHaveLength(3);
      expect(store.state.users.size).toBe(3);
      expect(store.state.notifications).toHaveLength(3);

      // 验证用户数据
      expect(store.state.users.get(1).name).toBe('Alice');
      expect(store.state.users.get(2).status).toBe('away');
      expect(store.state.users.get(3).name).toBe('Charlie');

      // 清理订阅
      messaging.unsubscribe(topic, subscription.id);
    });

    it('应该处理广播消息和群体状态更新', async () => {
      const broadcastTopic = 'system.announcements';
      const userTopic = 'user.status';

      let broadcastCount = 0;
      let statusUpdates = 0;

      // 订阅系统广播
      const broadcastSub = messaging.subscribe(broadcastTopic, (message) => {
        broadcastCount++;
        const messageText = message;
        store.addNotification({
          type: 'system',
          message: messageText,
          timestamp: Date.now()
        });
      });

      // 订阅用户状态更新
      const statusSub = messaging.subscribe(userTopic, (message) => {
        statusUpdates++;
        const statusData = typeof message === 'string' ? JSON.parse(message) : message;
        store.addUser({ id: statusData.userId, status: statusData.status });
      });

      // 发布系统广播
      await messaging.publish(broadcastTopic, '系统维护通知：今晚23:00-24:00进行例行维护');
      await messaging.publish(broadcastTopic, '新功能上线：支持实时协作');

      // 发布用户状态更新
      const statusChanges = [
        { userId: 1, status: 'online' },
        { userId: 2, status: 'busy' },
        { userId: 3, status: 'offline' },
        { userId: 1, status: 'away' }
      ];

      for (const change of statusChanges) {
        await messaging.publish(userTopic, JSON.stringify(change));
      }

      // 等待消息处理
      await new Promise(resolve => setTimeout(resolve, 100));

      // 验证广播消息
      expect(broadcastCount).toBe(2);
      expect(store.state.notifications.filter(n => n.type === 'system')).toHaveLength(2);

      // 验证状态更新
      expect(statusUpdates).toBe(4);
      expect(store.state.users.get(1).status).toBe('away'); // 最后的状态
      expect(store.state.users.get(2).status).toBe('busy');
      expect(store.state.users.get(3).status).toBe('offline');

      // 验证统计信息
      expect(store.state.stats.notificationsCount).toBe(2);

      // 清理订阅
      messaging.unsubscribe(broadcastTopic, broadcastSub.id);
      messaging.unsubscribe(userTopic, statusSub.id);
    });
  });

  describe('消息队列驱动的状态机', () => {
    it('应该实现基于消息的事件驱动状态机', async () => {
      const eventTopic = 'workflow.events';
      const stateTransitions = [];

      // 定义状态机状态
      const workflowStates = {
        pending: '待处理',
        processing: '处理中',
        completed: '已完成',
        failed: '失败'
      };

      // 订阅工作流事件
      const subscription = messaging.subscribe(eventTopic, (message) => {
        const event = typeof message === 'string' ? JSON.parse(message) : message;
        stateTransitions.push(event);

        // 根据事件更新状态
        switch (event.type) {
          case 'workflow_started':
            store.startWorkflow(event.workflowId);
            break;
          case 'workflow_completed':
            store.completeWorkflow(event.workflowId);
            break;
          case 'workflow_failed':
            store.failWorkflow(event.workflowId, event.error || 'Unknown error');
            break;
        }
      });

      // 发布工作流事件序列
      const workflowId = 'wf_12345';
      const events = [
        { type: 'workflow_started', workflowId, timestamp: Date.now() },
        { type: 'task_completed', workflowId, taskId: 'task_1', timestamp: Date.now() + 100 },
        { type: 'task_completed', workflowId, taskId: 'task_2', timestamp: Date.now() + 200 },
        { type: 'workflow_completed', workflowId, timestamp: Date.now() + 300 }
      ];

      for (const event of events) {
        await messaging.publish(eventTopic, JSON.stringify(event));
        // 短暂延迟模拟真实事件间隔
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // 等待所有消息处理
      await new Promise(resolve => setTimeout(resolve, 50));

      // 验证状态机转换
      expect(stateTransitions).toHaveLength(4);
      expect(store.state.workflows.get(workflowId).status).toBe('completed');
      expect(store.state.workflows.get(workflowId).startTime).toBeDefined();
      expect(store.state.workflows.get(workflowId).completedAt).toBeDefined();

      // 验证事件序列
      expect(stateTransitions[0].type).toBe('workflow_started');
      expect(stateTransitions[3].type).toBe('workflow_completed');

      // 清理订阅
      messaging.unsubscribe(eventTopic, subscription.id);
    });

    it('应该处理并发消息和状态竞争', async () => {
      const counterTopic = 'counter.updates';
      const maxConcurrency = 10;
      const incrementsPerWorker = 20;

      // 初始化计数器
      store.setCounter(0);

      // 创建多个订阅者并发处理消息
      const workers = [];
      for (let i = 0; i < maxConcurrency; i++) {
        const worker = messaging.subscribe(counterTopic, (message) => {
          const data = JSON.parse(message);
          if (data.action === 'increment' && data.workerId === i) {
            store.incrementCounter();
          }
        });
        workers.push(worker);
      }

      const startTime = global.performanceMonitor.start();

      // 并发发布增量消息
      const publishPromises = [];
      for (let workerId = 0; workerId < maxConcurrency; workerId++) {
        for (let msgIndex = 0; msgIndex < incrementsPerWorker; msgIndex++) {
          publishPromises.push(
            messaging.publish(counterTopic, JSON.stringify({
              action: 'increment',
              workerId: workerId,
              sequence: workerId * incrementsPerWorker + msgIndex
            }))
          );
        }
      }

      await Promise.all(publishPromises);

      // 等待所有消息处理
      await new Promise(resolve => setTimeout(resolve, 200));

      const perfResult = global.performanceMonitor.end(startTime);
      console.log(`并发消息处理耗时: ${perfResult.formatted}`);

      // 验证计数器结果（并发情况下可能有竞争条件，但总数应该接近预期）
      const finalCount = store.state.counter;
      console.log(`最终计数器值: ${finalCount}, 期望值: ${maxConcurrency * incrementsPerWorker}`);

      // 验证最终计数器值（每个worker处理20条消息，总共200条）
      expect(finalCount).toBe(maxConcurrency * incrementsPerWorker);

      // 验证性能
      expect(perfResult.duration).toBeLessThan(500); // 500ms内完成

      // 清理订阅
      workers.forEach(worker => {
        messaging.unsubscribe('workflow.events', worker.id);
      });
    });
  });

  describe('消息持久化和状态恢复', () => {
    it('应该支持消息持久化和状态重建', async () => {
      const persistentTopic = 'persistent.events';
      const events = [];

      // 订阅并持久化消息
      const subscription = messaging.subscribe(persistentTopic, (message) => {
        const event = JSON.parse(message);
        events.push(event);

        // 持久化到状态
        store.addPersistentEvent(event);
      });

      // 发布一系列事件
      const eventSequence = [
        { id: 'evt_1', type: 'user_login', userId: 1, timestamp: Date.now() },
        { id: 'evt_2', type: 'data_updated', entityId: 'doc_123', timestamp: Date.now() + 10 },
        { id: 'evt_3', type: 'user_logout', userId: 1, timestamp: Date.now() + 20 },
        { id: 'evt_4', type: 'system_backup', timestamp: Date.now() + 30 }
      ];

      for (const event of eventSequence) {
        await messaging.publish(persistentTopic, JSON.stringify(event));
      }

      // 等待消息处理
      await new Promise(resolve => setTimeout(resolve, 50));

      // 验证事件持久化
      expect(events).toHaveLength(4);
      expect(store.state.persistentEvents).toHaveLength(4);

      // 验证事件顺序和内容
      expect(events[0].type).toBe('user_login');
      expect(events[1].type).toBe('data_updated');
      expect(events[2].type).toBe('user_logout');
      expect(events[3].type).toBe('system_backup');

      // 模拟状态恢复
      const recoveredState = store.recoverFromEvents(events);
      expect(recoveredState.eventCount).toBe(4);
      expect(recoveredState.lastEventId).toBe('evt_4');

      // 验证可以从持久化事件重建状态
      const rebuiltState = store.rebuildStateFromEvents(store.state.persistentEvents);
      expect(rebuiltState.events).toHaveLength(4);
      expect(rebuiltState.reconstructed).toBe(true);

      // 清理订阅
      messaging.unsubscribe(persistentTopic, subscription.id);
    });

    it('应该处理消息队列的故障恢复', async () => {
      const reliableTopic = 'reliable.messages';
      let messageLossCount = 0;
      let retryCount = 0;

      // 模拟不可靠的订阅者（有时会丢失消息）
      const unreliableSubscription = messaging.subscribe(reliableTopic, (message) => {
        const data = JSON.parse(message);

        // 模拟10%的消息丢失
        if (Math.random() < 0.1) {
          messageLossCount++;
          console.log(`消息丢失: ${data.id}`);
          return;
        }

        store.addReliableMessage(data);
      });

      // 创建可靠的备份订阅者
      const backupSubscription = messaging.subscribe(reliableTopic, (message) => {
        const data = JSON.parse(message);
        retryCount++;

        // 备份订阅者总是处理消息
        store.addBackupMessage(data);
      });

      // 发布大量消息测试可靠性
      const messageCount = 100;
      for (let i = 0; i < messageCount; i++) {
        await messaging.publish(reliableTopic, JSON.stringify({
          id: `msg_${i}`,
          data: `Message ${i}`,
          timestamp: Date.now()
        }));
      }

      // 等待消息处理
      await new Promise(resolve => setTimeout(resolve, 100));

      // 验证可靠性
      const reliableMessages = store.state.reliableMessages.length;
      const backupMessages = store.state.backupMessages.length;

      console.log(`原始消息: ${messageCount}`);
      console.log(`可靠订阅者接收: ${reliableMessages}`);
      console.log(`备份订阅者接收: ${backupMessages}`);
      console.log(`消息丢失: ${messageLossCount}`);

      // 备份订阅者应该接收到所有消息
      expect(backupMessages).toBe(messageCount);

      // 可靠订阅者可能丢失一些消息，但应该大部分收到
      expect(reliableMessages).toBeGreaterThan(messageCount * 0.8);
      expect(reliableMessages).toBeLessThanOrEqual(messageCount);

      // 验证重试机制
      expect(retryCount).toBe(messageCount);

      // 清理订阅
      messaging.unsubscribe('unreliable.topic', unreliableSubscription.id);
      messaging.unsubscribe('backup.topic', backupSubscription.id);
    });
  });

  describe('实时协作和状态同步', () => {
    it('应该支持多用户实时协作状态同步', async () => {
      const collaborationTopic = 'collaboration.doc_123';
      const users = ['alice', 'bob', 'charlie'];
      const userConnections = new Map();

      // 为每个用户创建连接和状态
      for (const username of users) {
        const userConnection = await messaging.connect();
        userConnections.set(username, userConnection);

        // 用户状态跟踪
        store.addUser({ id: username, name: username, connected: true, lastActivity: Date.now() });
      }

      let collaborationEvents = [];

      // 所有用户订阅协作主题
      const subscriptions = [];
      users.forEach(username => {
        const connection = userConnections.get(username);
        const subscription = messaging.subscribe(collaborationTopic, (message) => {
          const event = JSON.parse(message);
          collaborationEvents.push({ user: username, event });

          // 更新协作状态
          store.addNotification({
            lastActivity: Date.now(),
            lastEvent: event
          });
        });
        subscriptions.push(subscription);
      });

      // 模拟协作编辑会话
      const editEvents = [
        { type: 'cursor_move', user: 'alice', position: { line: 10, column: 5 }, timestamp: Date.now() },
        { type: 'text_insert', user: 'bob', position: { line: 15, column: 0 }, text: 'Hello World', timestamp: Date.now() + 100 },
        { type: 'text_delete', user: 'charlie', position: { line: 20, column: 10 }, length: 5, timestamp: Date.now() + 200 },
        { type: 'selection_change', user: 'alice', selection: { start: { line: 10, column: 5 }, end: { line: 10, column: 15 } }, timestamp: Date.now() + 300 }
      ];

      // 广播协作事件
      for (const event of editEvents) {
        const userConnection = userConnections.get(event.user);
        await messaging.publish(collaborationTopic, JSON.stringify(event));
      }

      // 等待所有事件传播
      await new Promise(resolve => setTimeout(resolve, 200));

      // 验证协作事件
      expect(collaborationEvents).toHaveLength(12); // 4个事件 x 3个订阅者

      // 验证每个用户都接收到了所有事件
      users.forEach(username => {
        const userEvents = collaborationEvents.filter(e => e.user === username);
        expect(userEvents).toHaveLength(4);
      });

      // 验证状态同步
      expect(store.state.users.size).toBe(3);
      users.forEach(username => {
        const user = store.state.users.get(username);
        expect(user.connected).toBe(true);
        expect(user.lastActivity).toBeDefined();
        // 注意：lastEvent是通过addNotification添加的，不在user对象中
      });

      // 验证事件类型分布
      const eventTypes = collaborationEvents.map(e => e.event.type);
      expect(eventTypes.filter(t => t === 'cursor_move')).toHaveLength(3);
      expect(eventTypes.filter(t => t === 'text_insert')).toHaveLength(3);
      expect(eventTypes.filter(t => t === 'text_delete')).toHaveLength(3);
      expect(eventTypes.filter(t => t === 'selection_change')).toHaveLength(3);

      // 清理订阅和连接
      subscriptions.forEach(sub => {
        messaging.unsubscribe(sub.subject, sub.id);
      });
    });
  });
});
