# WokeFlow 业务服务层

## 📖 服务概述

WokeFlow 的业务服务层提供了企业级应用的核心业务逻辑实现。通过依赖注入的方式整合各个核心模块，提供用户管理、工作流执行等关键业务功能。

### 🎯 核心特性

- **用户生命周期管理** - 从注册到注销的完整用户管理
- **工作流自动化** - 可视化的流程定义和执行引擎
- **事件驱动架构** - 解耦的服务间通信
- **数据一致性保证** - 事务性和状态管理的结合
- **高并发支持** - 异步处理和队列机制

### 🏗️ 服务架构

```
业务服务层
├── 👥 用户服务 (UserService)
│   ├── 用户注册登录
│   ├── 身份认证授权
│   ├── 会话管理
│   └── 用户资料管理
├── 🔄 工作流引擎 (WorkflowEngine)
│   ├── 工作流定义
│   ├── 任务编排执行
│   ├── 状态追踪
│   └── 错误处理重试
└── 📡 事件驱动通信
    ├── 发布订阅模式
    ├── 状态同步
    └── 异步协作
```

## 👥 用户服务 (UserService)

### 功能特性

- **用户注册登录** - 完整的用户生命周期管理
- **JWT认证授权** - 安全的无状态身份验证
- **会话管理** - 用户登录状态追踪
- **密码安全** - 加密存储和验证
- **用户资料管理** - CRUD操作支持

### 快速开始

```javascript
import { container } from 'wokeflow';

const userService = container.resolve('userService');

// 用户注册
const user = await userService.createUser({
  username: 'john_doe',
  email: 'john@example.com',
  password: 'securePassword123',
  fullName: 'John Doe'
});

// 用户登录
const authResult = await userService.authenticateUser('john_doe', 'securePassword123');
console.log('登录成功:', authResult.token);

// 验证令牌
const isValid = await userService.validateToken(authResult.token);
if (isValid) {
  console.log('令牌有效');
}
```

### 用户管理

```javascript
// 获取用户信息
const user = await userService.getUserProfile(userId);

// 更新用户信息
const updatedUser = await userService.updateUser(userId, {
  fullName: 'John Smith',
  email: 'johnsmith@example.com'
});

// 删除用户
await userService.deleteUser(userId);

// 用户列表查询
const users = await userService.listUsers({
  status: 'active',
  role: 'admin',
  limit: 20,
  offset: 0
});
```

### 权限管理

```javascript
// 检查用户角色
if (await userService.hasRole(token, 'admin')) {
  // 执行管理员操作
}

// 检查用户权限
if (await userService.hasPermission(token, 'user.create')) {
  // 创建用户
}

// 获取用户角色列表
const roles = await userService.getUserRoles(userId);
```

## 🔄 工作流引擎 (WorkflowEngine)

### 功能特性

- **可视化定义** - JSON格式的工作流配置
- **任务编排** - 支持顺序、并行、条件分支
- **状态追踪** - 完整的工作流生命周期管理
- **错误重试** - 自动失败重试机制
- **事件集成** - 与消息队列深度集成

### 快速开始

```javascript
import { container } from 'wokeflow';

const workflowEngine = container.resolve('workflowEngine');

// 定义工作流
const workflowDefinition = {
  name: '用户注册流程',
  tasks: [
    {
      id: 'validate_email',
      name: '验证邮箱',
      type: 'http',
      method: 'POST',
      url: '/api/email/verify',
      dependencies: []
    },
    {
      id: 'create_profile',
      name: '创建用户资料',
      type: 'script',
      script: 'await createUserProfile(context.userData)',
      dependencies: ['validate_email']
    },
    {
      id: 'send_welcome',
      name: '发送欢迎邮件',
      type: 'http',
      method: 'POST',
      url: '/api/email/welcome',
      dependencies: ['create_profile']
    }
  ]
};

// 创建并启动工作流
const workflowId = await workflowEngine.createWorkflow(workflowDefinition);
await workflowEngine.startWorkflow(workflowId, {
  userData: { email: 'user@example.com', name: 'John' }
});
```

### 工作流控制

```javascript
// 暂停工作流
await workflowEngine.pauseWorkflow(workflowId);

// 恢复工作流
await workflowEngine.resumeWorkflow(workflowId);

// 取消工作流
await workflowEngine.cancelWorkflow(workflowId);

// 查询工作流状态
const workflow = await workflowEngine.getWorkflow(workflowId);
console.log('状态:', workflow.status); // 'running', 'completed', 'failed', etc.

// 获取运行中的工作流
const runningWorkflows = await workflowEngine.getRunningWorkflows();
```

### 任务类型

#### HTTP任务
```javascript
{
  id: 'api_call',
  type: 'http',
  method: 'POST',
  url: '/api/endpoint',
  headers: { 'Content-Type': 'application/json' },
  data: { key: 'value' },
  timeout: 5000
}
```

#### 脚本任务
```javascript
{
  id: 'process_data',
  type: 'script',
  script: `
    const result = await context.http.get('/api/data');
    return context.utils.map(result.data, item => item.value * 2);
  `
}
```

#### 延迟任务
```javascript
{
  id: 'wait',
  type: 'delay',
  duration: 5000 // 毫秒
}
```

#### 条件任务
```javascript
{
  id: 'check_condition',
  type: 'condition',
  condition: 'context.data.status === "success"',
  trueTask: 'success_task',
  falseTask: 'failure_task'
}
```

## 📡 事件驱动架构

### 服务间通信

WokeFlow 的业务服务采用事件驱动架构，实现服务间的解耦通信。

```javascript
// 用户服务发布事件
class UserService {
  async createUser(userData) {
    // 创建用户...
    const user = await this.userRepository.create(userData);

    // 发布事件
    await this.messaging.publish('user.created', {
      userId: user.id,
      user: user,
      timestamp: new Date()
    });

    return user;
  }
}

// 工作流引擎订阅事件
class WorkflowEngine {
  async initialize() {
    // 订阅用户创建事件
    this.messaging.subscribe('user.created', async (event) => {
      // 自动启动欢迎工作流
      await this.startWelcomeWorkflow(event.userId, event.user);
    });
  }
}
```

### 自动事件

业务服务会自动发布以下事件：

#### 用户服务事件
- `user.created` - 用户创建
- `user.authenticated` - 用户登录
- `user.updated` - 用户信息更新
- `user.deleted` - 用户删除
- `user.logout` - 用户登出

#### 工作流引擎事件
- `workflow.created` - 工作流创建
- `workflow.started` - 工作流启动
- `workflow.completed` - 工作流完成
- `workflow.failed` - 工作流失败
- `workflow.paused` - 工作流暂停
- `workflow.resumed` - 工作流恢复
- `workflow.cancelled` - 工作流取消
- `task.completed` - 任务完成
- `task.failed` - 任务失败

## 🔧 依赖注入配置

### 服务注册

```javascript
import { container } from 'wokeflow';

// 注册业务服务
container.register('userService', UserService);
container.register('workflowEngine', WorkflowEngine);

// 配置服务依赖
container.register('userRepository', UserRepository);
container.register('workflowRepository', WorkflowRepository);
```

### 服务依赖

```javascript
class UserService {
  constructor({ http, auth, state, messaging }) {
    this.http = http;
    this.auth = auth;
    this.state = state;
    this.messaging = messaging;
  }
}

class WorkflowEngine {
  constructor({ http, messaging, state, date, utils }) {
    this.http = http;
    this.messaging = messaging;
    this.state = state;
    this.date = date;
    this.utils = utils;
  }
}
```

## 📊 监控和指标

### 业务指标

```javascript
// 用户相关指标
const userMetrics = {
  totalUsers: await userService.getTotalUserCount(),
  activeUsers: await userService.getActiveUserCount(),
  newUsersToday: await userService.getNewUsersCount('day'),
  loginAttempts: await userService.getLoginAttemptsCount()
};

// 工作流指标
const workflowMetrics = {
  totalWorkflows: await workflowEngine.getTotalWorkflowCount(),
  runningWorkflows: await workflowEngine.getRunningWorkflowCount(),
  completedWorkflows: await workflowEngine.getCompletedWorkflowCount(),
  failedWorkflows: await workflowEngine.getFailedWorkflowCount()
};
```

### 性能监控

```javascript
// 响应时间监控
const startTime = Date.now();
const result = await userService.authenticateUser(username, password);
const duration = Date.now() - startTime;

logger.info('用户认证耗时', {
  username,
  duration,
  success: !!result.token
});

// 工作流执行监控
workflowEngine.on('workflow.completed', (event) => {
  logger.info('工作流完成', {
    workflowId: event.workflowId,
    duration: event.duration,
    tasksCount: event.tasksCount,
    success: true
  });
});
```

## 🧪 测试示例

### 单元测试

```javascript
import { describe, it, expect, vi } from 'vitest';

describe('UserService', () => {
  let userService;
  let mockHttp;
  let mockAuth;

  beforeEach(() => {
    mockHttp = { post: vi.fn(), get: vi.fn() };
    mockAuth = { generateToken: vi.fn() };

    userService = new UserService({ http: mockHttp, auth: mockAuth });
  });

  it('should create user successfully', async () => {
    const userData = { email: 'test@example.com', password: 'password' };
    const createdUser = { id: 1, ...userData };

    mockHttp.post.mockResolvedValue({ data: createdUser });
    mockAuth.generateToken.mockReturnValue('token123');

    const result = await userService.createUser(userData);

    expect(mockHttp.post).toHaveBeenCalledWith('/api/users', userData);
    expect(result).toEqual(createdUser);
  });
});
```

### 集成测试

```javascript
describe('用户注册工作流', () => {
  let container;
  let userService;
  let workflowEngine;

  beforeEach(async () => {
    container = createTestContainer();
    userService = container.resolve('userService');
    workflowEngine = container.resolve('workflowEngine');
  });

  it('should trigger welcome workflow after user registration', async () => {
    const userData = {
      email: 'john@example.com',
      password: 'password123',
      name: 'John Doe'
    };

    // 监听工作流创建事件
    const workflowCreated = new Promise((resolve) => {
      workflowEngine.on('workflow.created', (event) => {
        resolve(event);
      });
    });

    // 创建用户
    await userService.createUser(userData);

    // 验证工作流被创建
    const event = await workflowCreated;
    expect(event.name).toBe('用户欢迎流程');
    expect(event.params.userData.email).toBe(userData.email);
  });
});
```

## ❓ 常见问题

### Q: 如何处理并发用户注册？

**A:** 使用队列和锁机制：

```javascript
// 在UserService中
async createUser(userData) {
  // 检查邮箱是否已存在
  const existingUser = await this.checkEmailExists(userData.email);
  if (existingUser) {
    throw new Error('邮箱已被注册');
  }

  // 使用数据库事务保证原子性
  return await this.database.transaction(async (tx) => {
    const user = await tx.users.create(userData);

    // 发布事件（异步）
    setImmediate(() => {
      this.messaging.publish('user.created', { userId: user.id });
    });

    return user;
  });
}
```

### Q: 工作流执行失败如何处理？

**A:** 自动重试和人工干预：

```javascript
// 配置重试策略
const workflow = await workflowEngine.createWorkflow({
  name: '重要业务流程',
  retryPolicy: {
    maxAttempts: 3,
    backoffMs: 1000,
    exponential: true
  },
  tasks: [...]
});

// 监听失败事件
workflowEngine.on('workflow.failed', async (event) => {
  // 发送告警通知
  await notificationService.sendAlert({
    title: '工作流执行失败',
    workflowId: event.workflowId,
    error: event.error
  });

  // 可以选择自动重试或人工处理
  if (event.retryCount < 3) {
    await workflowEngine.retryWorkflow(event.workflowId);
  }
});
```

### Q: 如何扩展自定义业务服务？

**A:** 创建新的服务类并注册：

```javascript
class OrderService {
  constructor({ http, messaging, workflowEngine }) {
    this.http = http;
    this.messaging = messaging;
    this.workflowEngine = workflowEngine;
  }

  async createOrder(orderData) {
    // 创建订单
    const order = await this.http.post('/api/orders', orderData);

    // 启动订单处理工作流
    await this.workflowEngine.startWorkflow('order-processing', {
      orderId: order.id
    });

    // 发布事件
    await this.messaging.publish('order.created', order);

    return order;
  }
}

// 注册服务
container.register('orderService', OrderService);
```

## 📚 相关链接

- [核心模块文档](core-modules.md) - 了解底层核心模块
- [API 文档](api-documentation.md) - 完整的API参考
- [部署指南](deployment-guide.md) - 服务部署和配置
- [测试策略](testing-architecture.md) - 测试最佳实践

