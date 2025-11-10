import {
  createDetailedErrorReporter,
  createStrictTestCleanup,
  setupStrictTestEnvironment,
  strictAssert,
  withTimeout,
} from './test-helpers.js';

/**
 * 端到端工作流测试
 * 测试完整的用户工作流程：认证 -> 数据处理 -> 状态管理 -> 消息传递
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import HttpClient from '../../src/core/HttpClient.js';
import DayJSInspiredDate from '../../src/core/DayJSInspiredDate.js';
import JWTAuth from '../../src/core/JWTAuth.js';
import LodashInspiredUtils from '../../src/core/LodashInspiredUtils.js';
import NATSInspiredMessaging from '../../src/core/NATSInspiredMessaging.js';
import ZustandInspiredState from '../../src/core/ZustandInspiredState.js';
import TestServer from '../test-server.js';

describe('端到端工作流测试', () => {
  let http, jwt, state, utils, messaging, date;
  let workflowStore, httpInstance, messagingConnection;
  let testServer;

  beforeEach(async () => {
    // 启动测试服务器
    testServer = new TestServer();
    await testServer.start();

    // 初始化所有核心模块
    http = new HttpClient();
    jwt = new JWTAuth();
    state = new ZustandInspiredState();
    utils = new LodashInspiredUtils();
    messaging = new NATSInspiredMessaging();
    date = new DayJSInspiredDate();

    await http.initialize();
    await jwt.initialize();
    await state.initialize();
    await utils.initialize();
    await messaging.initialize();
    await date.initialize();

    // 设置认证密钥
    jwt.setSecret('workflow-key', 'end-to-end-test-secret');

    // 创建HTTP实例
    httpInstance = http.create({
      baseURL: testServer.getUrl(),
      timeout: 10000,
    });

    // 创建消息队列连接
    messagingConnection = await messaging.connect('e2e-test-cluster');

    // 创建工作流状态存储
    workflowStore = state.create((set, get) => ({
      // 用户状态
      currentUser: null,
      isAuthenticated: false,
      sessionToken: null,

      // 工作流数据
      workflows: new Map(),
      tasks: [],
      projects: [],

      // 实时状态
      onlineUsers: new Set(),
      notifications: [],
      lastActivity: null,

      // 统计信息
      stats: {
        totalWorkflows: 0,
        completedTasks: 0,
        activeUsers: 0,
      },

      // Actions
      login: (credentials) => {
        const token = jwt.generateToken(
          {
            userId: credentials.userId,
            username: credentials.username,
            role: credentials.role || 'user',
          },
          'workflow-key',
          { expiresIn: 3600 },
        );

        set({
          currentUser: {
            id: credentials.userId,
            username: credentials.username,
            role: credentials.role || 'user',
          },
          isAuthenticated: true,
          sessionToken: token,
          lastActivity: Date.now(),
        });

        return token;
      },

      logout: () =>
        set({
          currentUser: null,
          isAuthenticated: false,
          sessionToken: null,
        }),

      createWorkflow: (workflowData) =>
        set((state) => {
          const workflowId = `wf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const workflow = {
            id: workflowId,
            ...workflowData,
            createdAt: Date.now(),
            status: 'draft',
            createdBy: state.currentUser?.id,
          };

          const newWorkflows = new Map(state.workflows);
          newWorkflows.set(workflowId, workflow);

          return {
            workflows: newWorkflows,
            stats: {
              ...state.stats,
              totalWorkflows: state.stats.totalWorkflows + 1,
            },
            lastActivity: Date.now(),
          };
        }),

      addTask: (taskData) =>
        set((state) => ({
          tasks: [
            ...(state.tasks || []),
            {
              id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              ...taskData,
              createdAt: Date.now(),
              status: 'pending',
              createdBy: state.currentUser?.id,
            },
          ],
          lastActivity: Date.now(),
        })),

      completeTask: (taskId) =>
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === taskId
              ? { ...task, status: 'completed', completedAt: Date.now() }
              : task,
          ),
          stats: {
            ...state.stats,
            completedTasks: state.stats.completedTasks + 1,
          },
          lastActivity: Date.now(),
        })),

      addNotification: (notification) =>
        set((state) => ({
          notifications: [
            ...state.notifications,
            {
              id: `notif_${Date.now()}`,
              ...notification,
              timestamp: Date.now(),
              read: false,
            },
          ],
          lastActivity: Date.now(),
        })),

      updateUserPresence: (userId, presence) =>
        set((state) => {
          const newOnlineUsers = new Set(state.onlineUsers);
          if (presence === 'online') {
            newOnlineUsers.add(userId);
          } else {
            newOnlineUsers.delete(userId);
          }

          return {
            onlineUsers: newOnlineUsers,
            stats: {
              ...state.stats,
              activeUsers: newOnlineUsers.size,
            },
          };
        }),
    }));
  });

  afterEach(async () => {
    if (messagingConnection) await messagingConnection.close();
    if (http) await http.destroy();
    if (jwt) await jwt.destroy();
    if (state) await state.destroy();
    if (utils) await utils.destroy();
    if (messaging) await messaging.destroy();
    if (date) await date.destroy();
    if (testServer) await testServer.stop();
    http = null;
    jwt = null;
    state = null;
    utils = null;
    messaging = null;
    date = null;
    workflowStore = null;
    testServer = null;
    httpInstance = null;
    messagingConnection = null;
  });

  describe('用户认证工作流', () => {
    it('应该完成完整的用户登录流程', async () => {
      const userCredentials = {
        userId: 1,
        username: 'testuser',
        role: 'developer',
      };

      // 1. 用户登录
      const token = workflowStore.login(userCredentials);

      // 2. 验证认证状态
      expect(workflowStore.state.isAuthenticated).toBe(true);
      expect(workflowStore.state.currentUser.username).toBe('testuser');
      expect(workflowStore.state.sessionToken).toBe(token);

      // 3. 验证JWT令牌
      const decodedToken = jwt.verifyToken(token, 'workflow-key');
      expect(decodedToken.userId).toBe(1);
      expect(decodedToken.username).toBe('testuser');
      expect(decodedToken.role).toBe('developer');

      // 4. 发送认证后的API请求
      const response = await http.request(httpInstance.id, {
        method: 'GET',
        url: '/api/user/profile',
        headers: {
          Authorization: `Bearer ${token}`,
          'X-User-ID': userCredentials.userId.toString(),
        },
      });

      expect(response.success).toBe(true);
      expect(response.request.headers['Authorization']).toBe(`Bearer ${token}`);
    });

    it('应该处理认证过期和刷新', async () => {
      // 登录用户（短期令牌）
      const token = workflowStore.login({
        userId: 2,
        username: 'shortsession',
        role: 'user',
      });

      // 验证初始状态
      expect(workflowStore.state.isAuthenticated).toBe(true);

      // 模拟令牌过期 - 创建已过期的令牌
      const expiredToken = jwt.generateToken(
        {
          userId: 2,
          username: 'shortsession',
          role: 'user',
        },
        'workflow-key',
        { expiresIn: -1 },
      );

      // 更新为过期令牌
      workflowStore.state.sessionToken = expiredToken;

      // 尝试验证过期令牌
      expect(() => jwt.verifyToken(expiredToken, 'workflow-key')).toThrow(
        'Token expired',
      );

      // 刷新令牌
      const newToken = jwt.generateToken(
        {
          userId: 2,
          username: 'shortsession',
          role: 'user',
        },
        'workflow-key',
        { expiresIn: 3600 },
      );

      workflowStore.state.sessionToken = newToken;

      // 验证新令牌有效
      const decoded = jwt.verifyToken(newToken, 'workflow-key');
      expect(decoded.userId).toBe(2);
      expect(decoded.username).toBe('shortsession');
    });
  });

  describe('工作流创建和管理', () => {
    beforeEach(() => {
      // 预先登录用户
      workflowStore.login({
        userId: 3,
        username: 'workflowuser',
        role: 'manager',
      });
    });

    it('应该创建和管理完整的工作流', () => {
      const workflowData = {
        name: '用户注册流程',
        description: '新用户注册和激活流程',
        priority: 'high',
        estimatedDuration: 3600000, // 1小时
      };

      // 1. 创建工作流
      workflowStore.createWorkflow(workflowData);

      // 2. 获取最新创建的工作流ID
      const workflowKeys = Array.from(workflowStore.state.workflows.keys());
      const workflowId = workflowKeys[workflowKeys.length - 1]; // 获取最后一个（最新创建的）
      console.log('创建的工作流ID:', workflowId);
      console.log('当前工作流数量:', workflowStore.state.workflows.size);
      console.log('工作流Map内容:', workflowKeys);

      // 3. 验证工作流创建
      expect(workflowStore.state.workflows.has(workflowId)).toBe(true);
      expect(workflowStore.state.stats.totalWorkflows).toBe(1);

      const workflow = workflowStore.state.workflows.get(workflowId);
      expect(workflow.name).toBe('用户注册流程');
      expect(workflow.status).toBe('draft');
      expect(workflow.createdBy).toBe(3);

      // 3. 为工作流添加任务
      const tasks = [
        { title: '验证邮箱格式', description: '检查用户邮箱格式是否正确' },
        { title: '发送激活邮件', description: '发送账户激活邮件' },
        { title: '创建用户档案', description: '在数据库中创建用户档案' },
        { title: '设置初始权限', description: '为新用户设置默认权限' },
      ];

      tasks.forEach((task) => workflowStore.addTask(task));

      // 4. 验证任务创建
      expect(workflowStore.state.tasks).toHaveLength(4);
      workflowStore.state.tasks.forEach((task) => {
        expect(task.status).toBe('pending');
        expect(task.createdBy).toBe(3);
        expect(task.createdAt).toBeDefined();
      });

      // 5. 完成任务
      const taskToComplete = workflowStore.state.tasks[0];
      workflowStore.completeTask(taskToComplete.id);

      // 6. 验证任务完成
      const completedTask = workflowStore.state.tasks.find(
        (t) => t.id === taskToComplete.id,
      );
      expect(completedTask.status).toBe('completed');
      expect(completedTask.completedAt).toBeDefined();
      expect(workflowStore.state.stats.completedTasks).toBe(1);
    });

    it('应该处理工作流数据分析', () => {
      // 创建多个工作流
      const workflows = [
        { name: '订单处理', priority: 'high', estimatedDuration: 1800000 },
        { name: '数据备份', priority: 'medium', estimatedDuration: 7200000 },
        { name: '报告生成', priority: 'low', estimatedDuration: 3600000 },
        { name: '用户审核', priority: 'high', estimatedDuration: 900000 },
      ];

      workflows.forEach((wf) => workflowStore.createWorkflow(wf));

      // 验证工作流统计
      expect(workflowStore.state.stats.totalWorkflows).toBe(4);

      // 使用工具函数分析数据
      const allWorkflows = Array.from(workflowStore.state.workflows.values());
      const groupedByPriority = utils.groupBy(allWorkflows, 'priority');

      // 验证分组结果
      expect(groupedByPriority.high).toHaveLength(2);
      expect(groupedByPriority.medium).toHaveLength(1);
      expect(groupedByPriority.low).toHaveLength(1);

      // 计算平均工期
      const totalDuration = allWorkflows.reduce(
        (sum, wf) => sum + wf.estimatedDuration,
        0,
      );
      const avgDuration = totalDuration / allWorkflows.length;

      expect(avgDuration).toBeGreaterThan(0);

      // 验证日期处理
      const now = date.day();
      const futureDate = now.add(1, 'day');
      expect(futureDate.isAfter(now)).toBe(true);
    });
  });

  describe('实时协作功能', () => {
    let collaborationSubscription;

    beforeEach(() => {
      // 登录用户
      workflowStore.login({
        userId: 4,
        username: 'collaborator',
        role: 'user',
      });

      // 订阅协作消息
      collaborationSubscription = messaging.subscribe(
        'collaboration.updates',
        (message) => {
          const update = JSON.parse(message);

          // 处理协作更新
          if (update.type === 'user_joined') {
            workflowStore.updateUserPresence(update.userId, 'online');
          } else if (update.type === 'user_left') {
            workflowStore.updateUserPresence(update.userId, 'offline');
          } else if (update.type === 'notification') {
            workflowStore.addNotification(update);
          }
        },
      );
    });

    afterEach(() => {
      if (collaborationSubscription) {
        messaging.unsubscribe(
          'collaboration.updates',
          collaborationSubscription.id,
        );
      }
    });

    it('应该处理实时用户协作', async () => {
      // 1. 用户加入协作
      await messaging.publish(
        'collaboration.updates',
        JSON.stringify({
          type: 'user_joined',
          userId: 5,
          username: 'collaborator2',
          timestamp: Date.now(),
        }),
      );

      // 2. 发送通知
      await messaging.publish(
        'collaboration.updates',
        JSON.stringify({
          type: 'notification',
          title: '新任务分配',
          message: '您被分配了一个新任务',
          userId: 4,
        }),
      );

      // 等待消息处理
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 3. 验证协作状态
      expect(workflowStore.state.onlineUsers.has(5)).toBe(true);
      expect(workflowStore.state.stats.activeUsers).toBe(1);
      expect(workflowStore.state.notifications).toHaveLength(1);

      // 4. 用户离开协作
      await messaging.publish(
        'collaboration.updates',
        JSON.stringify({
          type: 'user_left',
          userId: 5,
          timestamp: Date.now(),
        }),
      );

      // 等待消息处理
      await new Promise((resolve) => setTimeout(resolve, 50));

      // 5. 验证用户离线
      expect(workflowStore.state.onlineUsers.has(5)).toBe(false);
      expect(workflowStore.state.stats.activeUsers).toBe(0);
    });

    it('应该处理工作流状态同步', async () => {
      // 创建工作流
      workflowStore.createWorkflow({
        name: '同步测试工作流',
        description: '测试实时状态同步',
      });

      // 获取最新创建的工作流ID
      const workflowKeys = Array.from(workflowStore.state.workflows.keys());
      const workflowId = workflowKeys[workflowKeys.length - 1];

      // 订阅工作流更新
      const workflowSubscription = messaging.subscribe(
        `workflow.${workflowId}`,
        (message) => {
          const update = JSON.parse(message);

          if (update.type === 'task_completed') {
            workflowStore.completeTask(update.taskId);
          }
        },
      );

      // 添加任务
      workflowStore.addTask({
        title: '同步任务',
        workflowId: workflowId,
      });

      const task = workflowStore.state.tasks[0];

      // 发布任务完成消息
      await messaging.publish(
        `workflow.${workflowId}`,
        JSON.stringify({
          type: 'task_completed',
          taskId: task.id,
          workflowId: workflowId,
          completedBy: 4,
          timestamp: Date.now(),
        }),
      );

      // 等待同步
      await new Promise((resolve) => setTimeout(resolve, 50));

      // 验证任务完成
      const updatedTask = workflowStore.state.tasks.find(
        (t) => t.id === task.id,
      );
      expect(updatedTask.status).toBe('completed');
      expect(updatedTask.completedAt).toBeDefined();
      expect(workflowStore.state.stats.completedTasks).toBe(1);

      // 清理订阅
      messaging.unsubscribe(`workflow.${workflowId}`, workflowSubscription.id);
    });
  });

  describe('完整业务流程', () => {
    it('应该执行完整的业务工作流', async () => {
      const startTime = global.performanceMonitor.start();

      // === 阶段1: 用户认证 ===
      const userToken = workflowStore.login({
        userId: 100,
        username: 'businessuser',
        role: 'business_analyst',
      });

      expect(workflowStore.state.isAuthenticated).toBe(true);

      // === 阶段2: 创建业务项目 ===
      workflowStore.createWorkflow({
        name: '客户需求分析项目',
        description: '分析客户需求并制定解决方案',
        priority: 'high',
        businessValue: 50000,
        deadline: date.day().add(30, 'days').valueOf(),
      });

      // 获取最新创建的项目ID
      const projectKeys = Array.from(workflowStore.state.workflows.keys());
      const projectId = projectKeys[projectKeys.length - 1];

      expect(workflowStore.state.workflows.has(projectId)).toBe(true);

      // === 阶段3: 添加业务任务 ===
      const businessTasks = [
        {
          title: '需求收集',
          description: '与客户沟通收集详细需求',
          priority: 'high',
          estimatedHours: 8,
        },
        {
          title: '竞争分析',
          description: '分析竞争对手产品和服务',
          priority: 'medium',
          estimatedHours: 6,
        },
        {
          title: '解决方案设计',
          description: '设计满足需求的解决方案',
          priority: 'high',
          estimatedHours: 12,
        },
        {
          title: '原型开发',
          description: '开发解决方案原型',
          priority: 'medium',
          estimatedHours: 20,
        },
        {
          title: '客户演示',
          description: '向客户演示解决方案',
          priority: 'high',
          estimatedHours: 4,
        },
      ];

      businessTasks.forEach((task) =>
        workflowStore.addTask({ ...task, projectId }),
      );

      // === 阶段4: 任务执行和进度跟踪 ===
      let completedCount = 0;
      workflowStore.state.tasks.forEach((task) => {
        if (Math.random() > 0.3) {
          // 70%的任务被完成
          workflowStore.completeTask(task.id);
          completedCount++;
        }
      });

      // === 阶段5: 数据分析和报告 ===
      const allTasks = workflowStore.state.tasks;
      const completedTasks = allTasks.filter((t) => t.status === 'completed');
      const pendingTasks = allTasks.filter((t) => t.status === 'pending');

      // 使用工具函数进行数据分析
      const tasksByPriority = utils.groupBy(allTasks, 'priority');
      const completedByPriority = utils.groupBy(completedTasks, 'priority');

      // 计算完成率
      const completionRate = completedTasks.length / allTasks.length;

      // === 阶段6: 发送业务报告 ===
      const businessReport = {
        projectId,
        totalTasks: allTasks.length,
        completedTasks: completedTasks.length,
        pendingTasks: pendingTasks.length,
        completionRate: Math.round(completionRate * 100),
        tasksByPriority,
        completedByPriority,
        generatedAt: date.day().format('YYYY-MM-DD HH:mm:ss'),
        businessValue: 50000,
        estimatedCompletion: date.day().add(15, 'days').format('YYYY-MM-DD'),
      };

      // 发送报告到API
      const reportResponse = await http.request(httpInstance.id, {
        method: 'POST',
        url: '/api/reports/business',
        headers: {
          Authorization: `Bearer ${userToken}`,
          'Content-Type': 'application/json',
        },
        data: businessReport,
      });

      // === 阶段7: 通知利益相关者 ===
      const notificationMessage = `项目"${workflowStore.state.workflows.get(projectId).name}"完成率已达${businessReport.completionRate}%，预计${businessReport.estimatedCompletion}完成`;

      await messaging.publish(
        'notifications.business',
        JSON.stringify({
          type: 'project_update',
          projectId,
          message: notificationMessage,
          completionRate: businessReport.completionRate,
          recipients: ['manager@example.com', 'stakeholders@example.com'],
          timestamp: Date.now(),
        }),
      );

      const perfResult = global.performanceMonitor.end(startTime);

      // === 验证完整流程 ===
      expect(workflowStore.state.isAuthenticated).toBe(true);
      expect(workflowStore.state.workflows.has(projectId)).toBe(true);
      expect(workflowStore.state.tasks).toHaveLength(5);
      expect(workflowStore.state.stats.completedTasks).toBe(completedCount);
      expect(completionRate).toBeGreaterThan(0);
      expect(reportResponse.success).toBe(true);
      expect(businessReport.completionRate).toBeGreaterThanOrEqual(0);
      expect(businessReport.completionRate).toBeLessThanOrEqual(100);

      // 性能验证
      expect(perfResult.duration).toBeLessThan(2000); // 2秒内完成完整流程

      console.log(`完整业务流程耗时: ${perfResult.formatted}`);
      console.log(`项目完成率: ${businessReport.completionRate}%`);
      console.log(`完成任务数: ${completedCount}/${allTasks.length}`);

      // 验证各模块统计
      expect(jwt.getStats().tokens).toBe(1);
      expect(http.getStats().requests).toBe(1);
      expect(utils.getStats().operations).toBe(2); // 2次groupBy操作
    });
  });

  describe('错误处理和恢复', () => {
    it('应该处理网络错误和重试机制', async () => {
      // 模拟网络错误场景
      let retryCount = 0;
      const maxRetries = 3;

      // 添加重试拦截器
      http.addResponseInterceptor(httpInstance.id, async (response) => {
        if (response.status >= 500 && retryCount < maxRetries) {
          retryCount++;
          console.log(`网络错误，重试第${retryCount}次`);

          // 重新发送请求
          return await http.request(httpInstance.id, response.request);
        }
        return response;
      });

      // 发送可能失败的请求
      const response = await http.request(httpInstance.id, {
        method: 'GET',
        url: '/api/unstable',
        headers: {
          Authorization: `Bearer ${workflowStore.state.sessionToken}`,
        },
      });

      // 验证请求成功（即使重试）
      expect(response.success).toBe(true);
      expect(retryCount).toBeLessThanOrEqual(maxRetries);
    });

    it('应该处理认证失效和重新认证', async () => {
      // 登录用户
      const token = workflowStore.login({
        userId: 999,
        username: 'erroruser',
        role: 'user',
      });

      // 模拟令牌过期
      const expiredToken = jwt.generateToken(
        {
          userId: 999,
          username: 'erroruser',
          role: 'user',
        },
        'workflow-key',
        { expiresIn: -1 },
      );

      // 更新为过期令牌
      workflowStore.state.sessionToken = expiredToken;

      // 尝试发送需要认证的请求
      const response = await http.request(httpInstance.id, {
        method: 'GET',
        url: '/api/protected',
        headers: {
          Authorization: `Bearer ${expiredToken}`,
        },
      });

      // 即使令牌过期，请求仍会发送（由服务器处理认证错误）
      expect(response).toBeDefined();

      // 重新认证
      const newToken = jwt.generateToken(
        {
          userId: 999,
          username: 'erroruser',
          role: 'user',
        },
        'workflow-key',
        { expiresIn: 3600 },
      );

      workflowStore.state.sessionToken = newToken;

      // 验证新令牌有效
      const decoded = jwt.verifyToken(newToken, 'workflow-key');
      expect(decoded.userId).toBe(999);
      expect(decoded.username).toBe('erroruser');
    });
  });
});
