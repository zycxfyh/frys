/**
 * 状态管理与工具函数库的集成测试
 * 测试状态更新中的数据处理和转换操作
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import ZustandInspiredState from '../../src/core/ZustandInspiredState.js';
import LodashInspiredUtils from '../../src/core/LodashInspiredUtils.js';

describe('状态管理与工具函数集成测试', () => {
  let state;
  let utils;
  let store;

  beforeEach(async () => {
    state = new ZustandInspiredState();
    utils = new LodashInspiredUtils();

    await state.initialize();
    await utils.initialize();

    // 创建测试状态存储
    store = state.create((set, get) => ({
      // 初始状态
      users: [],
      tasks: [],
      stats: {
        totalUsers: 0,
        totalTasks: 0,
        completedTasks: 0
      },
      settings: {
        theme: 'light',
        notifications: true,
        language: 'zh-CN'
      },
      // 定义actions
      addUsers: (newUsers) => set(state => ({
        users: [...(state.users || []), ...newUsers],
        stats: { ...state.stats, totalUsers: (state.users || []).length + newUsers.length }
      })),
      setTasks: (newTasks) => set({ tasks: newTasks }),
      addTasks: (newTasks) => set(state => ({ tasks: [...state.tasks, ...newTasks] })),
      updateStats: (newStats) => set(state => ({
        stats: { ...state.stats, ...newStats }
      })),
      addNotification: (notification) => set(state => ({
        notifications: [...(state.notifications || []), notification],
        stats: { ...state.stats, notificationsCount: (state.stats.notificationsCount || 0) + 1 }
      })),
      updateUser: (userData) => set(state => ({
        users: state.users.map(user =>
          user.id === userData.id ? { ...user, ...userData } : user
        )
      })),
      setConnectionStatus: (connected) => set(state => ({
        realtime: { ...state.realtime, connected }
      })),
      setWorkflowStatus: (workflowId, status) => set(state => ({
        workflows: {
          ...state.workflows,
          [workflowId]: { ...state.workflows?.[workflowId], status }
        }
      })),
      setWorkflow: (workflowId, workflow) => set(state => ({
        workflows: {
          ...state.workflows,
          [workflowId]: workflow
        }
      })),
      updateWorkflow: (workflowId, updates) => set(state => ({
        workflows: {
          ...state.workflows,
          [workflowId]: { ...state.workflows?.[workflowId], ...updates }
        }
      })),
      setLargeDataset: (dataset) => set({ largeDataset: dataset }),
      setProcessedData: (data) => set({ processedData: data }),
      setComplexObject: (obj) => set({ complexObject: obj }),
      clearDataset: () => set({
        largeDataset: [],
        processedData: {}
      }),
      setCounter: (value) => set({ counter: value }),
      incrementCounter: () => set(state => ({ counter: (state.counter || 0) + 1 })),
      addUser: (user) => set(state => ({
        users: [...state.users, user],
        stats: { ...state.stats, totalUsers: state.users.length + 1 }
      })),
      setComplexState: (complexState) => set({ complexState }),
      setItemsByTag: (itemsByTag) => set({ itemsByTag }),
      addCollaborator: (username, data) => set(state => ({
        collaborators: {
          ...state.collaborators,
          [username]: { username, ...data }
        }
      })),
      updateCollaborator: (username, updates) => set(state => ({
        collaborators: {
          ...state.collaborators,
          [username]: { ...state.collaborators?.[username], ...updates }
        }
      })),
      addWorkflowEvent: (event) => set(state => ({
        workflowEvents: [...(state.workflowEvents || []), event]
      })),
      addPersistentEvent: (event) => set(state => ({
        persistentEvents: [...(state.persistentEvents || []), event]
      })),
      addReliableMessage: (message) => set(state => ({
        reliableMessages: [...(state.reliableMessages || []), message]
      })),
      addBackupMessage: (message) => set(state => ({
        backupMessages: [...(state.backupMessages || []), message]
      })),
      recoverFromEvents: (events) => {
        const recovered = {
          eventCount: events.length,
          lastEventId: events.length > 0 ? events[events.length - 1].id : null
        };
        set({ recoveredState: recovered });
        return recovered;
      },
      rebuildStateFromEvents: (events) => {
        const reconstructed = { events, reconstructed: true };
        set({ rebuiltState: reconstructed });
        return reconstructed;
      }
    }));
  });

  afterEach(async () => {
    if (state) await state.destroy();
    if (utils) await utils.destroy();
    state = null;
    utils = null;
    store = null;
  });

  describe('数据处理管道集成', () => {
    it('应该在状态更新中使用工具函数进行数据处理', () => {
      // 初始状态
      expect(store.state.users).toEqual([]);
      expect(store.state.stats.totalUsers).toBe(0);

      // 添加用户数据（包含重复项）
      const rawUserData = [
        { id: 1, name: 'Alice', email: 'alice@example.com', role: 'admin' },
        { id: 2, name: 'Bob', email: 'bob@example.com', role: 'user' },
        { id: 1, name: 'Alice', email: 'alice@example.com', role: 'admin' }, // 重复
        { id: 3, name: 'Charlie', email: 'charlie@example.com', role: 'user' },
        { id: 4, name: 'Diana', email: 'diana@example.com', role: 'moderator' }
      ];

      // 使用工具函数处理数据：去重并按角色分组
      const uniqueUsers = utils.uniq(rawUserData);
      const groupedByRole = utils.groupBy(uniqueUsers, 'role');

      // 更新状态
      store.addUsers(uniqueUsers);
      store.updateStats({
        totalUsers: uniqueUsers.length,
        usersByRole: groupedByRole
      });

      // 验证状态更新
      expect(store.state.users).toHaveLength(4); // 去重后4个用户
      expect(store.state.stats.totalUsers).toBe(4);
      expect(store.state.stats.usersByRole.admin).toHaveLength(1);
      expect(store.state.stats.usersByRole.user).toHaveLength(2);
      expect(store.state.stats.usersByRole.moderator).toHaveLength(1);

      // 验证工具函数的统计信息
      const utilsStats = utils.getStats();
      expect(utilsStats.operations).toBe(2); // uniq 和 groupBy 操作
    });

    it('应该处理复杂的数据转换管道', () => {
      const rawTasks = [
        { id: 1, title: 'Task A', status: 'pending', priority: 'high', assignee: 'alice' },
        { id: 2, title: 'Task B', status: 'completed', priority: 'medium', assignee: 'bob' },
        { id: 3, title: 'Task C', status: 'pending', priority: 'low', assignee: 'alice' },
        { id: 4, title: 'Task D', status: 'completed', priority: 'high', assignee: 'charlie' },
        { id: 5, title: 'Task E', status: 'pending', priority: 'medium', assignee: 'bob' }
      ];

      // 数据处理管道：过滤 -> 分组 -> 统计
      const pendingTasks = rawTasks.filter(task => task.status === 'pending');
      const groupedByAssignee = utils.groupBy(pendingTasks, 'assignee');
      const groupedByPriority = utils.groupBy(pendingTasks, 'priority');

      // 深度克隆数据用于状态存储
      const processedTasks = utils.cloneDeep(rawTasks);
      const taskStats = {
        total: processedTasks.length,
        pending: pendingTasks.length,
        completed: processedTasks.length - pendingTasks.length,
        byAssignee: groupedByAssignee,
        byPriority: groupedByPriority
      };

      // 更新状态
      store.setTasks(processedTasks);

      // 验证复杂数据处理结果
      expect(store.state.tasks).toHaveLength(5);

      // 验证分组结果（通过utils.groupBy计算）
      expect(groupedByAssignee.alice).toHaveLength(2); // Task A and Task C
      expect(groupedByAssignee.bob).toHaveLength(1); // Task E
      expect(groupedByPriority.medium).toHaveLength(1); // Task E

      // 验证工具函数统计
      const utilsStats = utils.getStats();
      expect(utilsStats.operations).toBe(3); // groupBy x2 和 cloneDeep
    });
  });

  describe('状态订阅与数据同步', () => {
    it('应该在状态变化时自动触发数据处理', () => {
      let processedData = null;
      let processingCount = 0;

      // 订阅状态变化
      const unsubscribe = store.subscribe((newState, prevState) => {
        if (newState.tasks !== prevState.tasks) {
          processingCount++;
          // 自动处理新添加的任务
          processedData = utils.groupBy(newState.tasks, 'status');
        }
      });

      // 添加初始任务
      const initialTasks = [
        { id: 1, title: 'Task 1', status: 'pending' },
        { id: 2, title: 'Task 2', status: 'completed' }
      ];

      store.setTasks(initialTasks);

      // 验证订阅器被触发
      expect(processingCount).toBe(1);
      expect(processedData.pending).toHaveLength(1);
      expect(processedData.completed).toHaveLength(1);

      // 添加更多任务
      const moreTasks = [
        { id: 3, title: 'Task 3', status: 'pending' },
        { id: 4, title: 'Task 4', status: 'completed' },
        { id: 5, title: 'Task 5', status: 'pending' }
      ];

      store.addTasks(moreTasks);

      // 验证再次触发处理
      expect(processingCount).toBe(2);
      expect(processedData.pending).toHaveLength(3);
      expect(processedData.completed).toHaveLength(2);

      // 清理订阅
      unsubscribe();
    });

    it('应该处理批量状态更新与数据聚合', () => {
      const metrics = {
        processingTime: [],
        memoryUsage: [],
        operationCount: 0
      };

      // 订阅状态变化进行性能监控
      const unsubscribe = store.subscribe((newState) => {
        metrics.operationCount++;
        metrics.processingTime.push(Date.now());
        metrics.memoryUsage.push(process.memoryUsage().heapUsed);
      });

      const startTime = global.performanceMonitor.start();

      // 批量添加用户
      const userBatches = [
        Array.from({ length: 50 }, (_, i) => ({ id: i + 1, name: `User ${i + 1}`, active: true })),
        Array.from({ length: 50 }, (_, i) => ({ id: i + 51, name: `User ${i + 51}`, active: false })),
        Array.from({ length: 50 }, (_, i) => ({ id: i + 101, name: `User ${i + 101}`, active: true }))
      ];

      // 处理每个批次
      userBatches.forEach((batch, index) => {
        const uniqueBatch = utils.uniq(batch);
        const activeUsers = uniqueBatch.filter(user => user.active);

        store.addUsers(uniqueBatch);
        store.updateStats({
          totalUsers: store.state.users.length,
          activeUsers: activeUsers.length,
          batchIndex: index
        });
      });

      const perfResult = global.performanceMonitor.end(startTime);

      // 验证批量处理结果
      expect(store.state.users).toHaveLength(150);
      expect(store.state.stats.totalUsers).toBe(150);
      expect(metrics.operationCount).toBeGreaterThan(3); // 至少3次状态更新

      // 验证性能
      expect(perfResult.duration).toBeLessThan(100); // 100ms内完成
      console.log(`批量状态更新耗时: ${perfResult.formatted}`);

      // 验证工具函数统计
      const utilsStats = utils.getStats();
      expect(utilsStats.operations).toBe(3); // 3次uniq操作

      unsubscribe();
    });
  });

  describe('内存管理和数据清理', () => {
    it('应该正确清理大数据集的状态', () => {
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        id: i + 1,
        data: `Item ${i + 1}`,
        timestamp: Date.now(),
        metadata: { size: Math.random() * 1000, category: i % 10 }
      }));

      const initialMemory = process.memoryUsage().heapUsed;

      // 添加大数据集
      store.setLargeDataset(largeDataset);

      const afterAddMemory = process.memoryUsage().heapUsed;
      console.log(`添加数据集后内存使用: ${(afterAddMemory - initialMemory) / 1024 / 1024}MB`);

      // 使用工具函数处理数据
      const processed = utils.groupBy(largeDataset, (item) => item.metadata.category);
      store.setProcessedData(processed);

      // 验证数据处理
      expect(store.state.largeDataset).toHaveLength(1000);
      expect(Object.keys(store.state.processedData)).toHaveLength(10); // 10个类别

      // 清理数据
      store.clearDataset();

      const afterClearMemory = process.memoryUsage().heapUsed;
      console.log(`清理数据后内存使用: ${(afterClearMemory - afterAddMemory) / 1024 / 1024}MB`);

      // 验证清理结果
      expect(store.state.largeDataset).toEqual([]);
      expect(store.state.processedData).toEqual({});

      // 验证工具函数统计
      const utilsStats = utils.getStats();
      expect(utilsStats.operations).toBe(1); // 1次groupBy操作
    });

    it('应该处理循环引用和复杂对象', () => {
      // 创建包含循环引用的复杂对象
      const parent = { id: 1, name: 'Parent' };
      const child1 = { id: 2, name: 'Child 1', parent };
      const child2 = { id: 3, name: 'Child 2', parent };

      parent.children = [child1, child2];

      // 深度克隆复杂对象（包含循环引用，会抛出错误）
      expect(() => {
        utils.cloneDeep(parent);
      }).toThrow('Object is not serializable');

      // 添加到状态
      store.setComplexObject(parent);

      // 验证状态存储
      expect(store.state.complexObject.id).toBe(1);
      expect(store.state.complexObject.children).toHaveLength(2);

      // 验证工具函数统计
      const utilsStats = utils.getStats();
      expect(utilsStats.operations).toBe(1); // 1次cloneDeep操作
    });
  });

  describe('并发状态更新与数据一致性', () => {
    it('应该处理并发状态更新保持数据一致性', async () => {
      const updateCount = 50;
      const updates = [];

      // 创建多个并发更新
      for (let i = 0; i < updateCount; i++) {
        updates.push(
          new Promise(resolve => {
            setTimeout(() => {
              const newUser = { id: i + 1, name: `Concurrent User ${i + 1}`, timestamp: Date.now() };
              store.addUser(newUser);
              resolve(newUser);
            }, Math.random() * 10); // 随机延迟
          })
        );
      }

      const startTime = global.performanceMonitor.start();
      const results = await Promise.all(updates);
      const perfResult = global.performanceMonitor.end(startTime);

      console.log(`并发状态更新耗时: ${perfResult.formatted}`);

      // 验证所有用户都被正确添加
      expect(store.state.users).toHaveLength(updateCount);
      expect(results).toHaveLength(updateCount);

      // 验证数据一致性（所有用户都有唯一ID）
      const userIds = store.state.users.map(user => user.id);
      const uniqueIds = utils.uniq(userIds);
      expect(uniqueIds).toHaveLength(updateCount);

      // 验证性能
      expect(perfResult.duration).toBeLessThan(100); // 100ms内完成

      // 验证工具函数统计
      const utilsStats = utils.getStats();
      expect(utilsStats.operations).toBe(1); // 1次uniq操作用于验证
    });

    it('应该在状态更新中保持数据完整性', () => {
      // 创建复杂的嵌套状态
      const complexState = {
        app: {
          version: '1.0.0',
          settings: {
            theme: 'dark',
            features: ['auth', 'api', 'storage']
          }
        },
        user: {
          profile: {
            id: 123,
            preferences: {
              language: 'zh-CN',
              timezone: 'Asia/Shanghai'
            }
          },
          permissions: ['read', 'write', 'admin']
        },
        data: {
          items: Array.from({ length: 100 }, (_, i) => ({
            id: i + 1,
            value: Math.random(),
            tags: [`tag${i % 5}`, `category${i % 3}`]
          }))
        }
      };

      // 深度克隆以避免引用问题
      const stateCopy = utils.cloneDeep(complexState);
      store.setComplexState(stateCopy);

      // 验证完整性
      expect(store.state.complexState.app.version).toBe('1.0.0');
      expect(store.state.complexState.user.profile.id).toBe(123);
      expect(store.state.complexState.data.items).toHaveLength(100);

      // 使用工具函数处理嵌套数据
      const itemsByTag = utils.groupBy(
        store.state.complexState.data.items,
        (item) => item.tags[0]
      );

      store.setItemsByTag(itemsByTag);

      // 验证分组结果
      expect(Object.keys(store.state.itemsByTag)).toHaveLength(5); // 5个不同的tag
      Object.values(store.state.itemsByTag).forEach(tagGroup => {
        expect(tagGroup.length).toBeGreaterThan(15); // 每个tag大约20个项目
      });

      // 验证工具函数统计
      const utilsStats = utils.getStats();
      expect(utilsStats.operations).toBe(2); // cloneDeep 和 groupBy
    });
  });
});
