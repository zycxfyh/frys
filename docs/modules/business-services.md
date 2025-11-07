# WokeFlow 业务服务层文档

## 📚 初学者指南 - 零基础也能看懂

<div style="background-color: #fff9c4; padding: 20px; border-left: 5px solid #fbc02d; margin: 20px 0;">
  <h3 style="margin-top: 0; color: #f57f17;">🎓 什么是"业务服务层"？</h3>
  <p>想象一下，你要开一家餐厅。业务服务层就像是餐厅的<strong>核心业务部门</strong>：</p>
  <ul>
    <li>👥 <strong>用户服务</strong> - 就像"客户管理部"，负责管理所有顾客信息、会员卡、积分等</li>
    <li>🔄 <strong>工作流引擎</strong> - 就像"后厨流程管理"，负责管理从点餐到上菜的整个流程</li>
  </ul>
  <p>在 WokeFlow 中，业务服务层提供了程序的核心业务功能，比如<strong>用户注册登录</strong>、<strong>工作流执行</strong>等实际业务操作。</p>
</div>

### 🏠 用生活比喻理解业务服务

#### 1. 👥 用户服务 - 就像"客户服务中心"

<div style="background-color: #e1f5fe; padding: 20px; border-radius: 8px; margin: 15px 0;">
  <h4 style="margin-top: 0; color: #0277bd;">🏢 生活场景：银行客户服务</h4>
  
  <p><strong>想象一下：</strong></p>
  <ul>
    <li>📝 开户：新客户来银行开户，需要填写资料、设置密码、办理银行卡</li>
    <li>🔐 登录：客户每次来银行，需要验证身份（刷卡、输入密码）</li>
    <li>📋 信息管理：可以查询账户信息、修改联系方式、更新个人资料</li>
    <li>🔒 安全保护：银行会保护客户信息，防止泄露和盗用</li>
    <li>📊 记录管理：银行会记录所有交易和操作，便于查询和审计</li>
  </ul>

  <p><strong>在代码中：</strong></p>
  <ul>
    <li>💻 用户服务：就像"客户服务中心"，负责管理所有用户相关的事务</li>
    <li>📝 用户注册：新用户注册账号，系统创建用户档案</li>
    <li>🔐 用户登录：用户输入账号密码，系统验证身份并发放"通行证"</li>
    <li>📋 用户管理：可以查看、修改、删除用户信息</li>
    <li>🔒 安全保护：系统会加密存储密码，防止信息泄露</li>
  </ul>

  <div style="background-color: #ffffff; padding: 15px; border-radius: 5px; margin-top: 15px;">
    <strong>💡 简单理解：</strong>用户服务就像一个"智能客户服务中心"，帮你管理所有用户相关的事情，从注册到登录，从信息查询到权限管理，全部自动化处理。
  </div>
</div>

#### 2. 🔄 工作流引擎 - 就像"自动化生产线"

<div style="background-color: #f3e5f5; padding: 20px; border-radius: 8px; margin: 15px 0;">
  <h4 style="margin-top: 0; color: #7b1fa2;">🏭 生活场景：工厂生产线</h4>
  
  <p><strong>想象一下：</strong></p>
  <ul>
    <li>📋 生产计划：工厂制定生产计划，明确每个步骤（采购原料 → 加工 → 组装 → 质检 → 包装）</li>
    <li>🔄 自动执行：生产线按照计划自动执行，每个步骤完成后自动进入下一步</li>
    <li>⏸️ 流程控制：可以暂停、恢复、取消生产线</li>
    <li>📊 状态跟踪：可以随时查看当前进度，哪个步骤完成了，哪个步骤在进行中</li>
    <li>🔄 错误处理：如果某个步骤失败，可以重试或跳过</li>
  </ul>

  <p><strong>在代码中：</strong></p>
  <ul>
    <li>💻 工作流引擎：就像"自动化生产线"，负责执行复杂的业务流程</li>
    <li>📋 工作流定义：定义业务流程，包括有哪些步骤、步骤之间的顺序</li>
    <li>🔄 自动执行：引擎按照定义自动执行每个步骤</li>
    <li>⏸️ 流程控制：可以启动、暂停、恢复、取消工作流</li>
    <li>📊 状态跟踪：可以随时查看工作流执行进度和状态</li>
  </ul>

  <div style="background-color: #ffffff; padding: 15px; border-radius: 5px; margin-top: 15px;">
    <strong>💡 简单理解：</strong>工作流引擎就像一个"智能生产线"，帮你自动化执行复杂的业务流程，你只需要定义好流程，引擎就会自动完成所有步骤。
  </div>
</div>

### 🔗 服务如何协作？

<div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0;">
  <h3 style="margin-top: 0; color: #2e7d32;">🤝 服务协作示例</h3>
  
  <p><strong>场景：新用户注册后自动发送欢迎邮件</strong></p>
  
  <div style="background-color: #ffffff; padding: 15px; border-radius: 5px; margin: 15px 0;">
    <p><strong>步骤1：</strong>用户服务处理用户注册</p>
    <p style="margin-left: 20px;">👤 用户填写注册信息 → 用户服务创建账号 → 注册成功</p>
    
    <p style="margin-top: 15px;"><strong>步骤2：</strong>用户服务发布"用户已注册"消息</p>
    <p style="margin-left: 20px;">📢 用户服务说："有一个新用户注册了！"</p>
    
    <p style="margin-top: 15px;"><strong>步骤3：</strong>邮件服务收到消息，自动发送欢迎邮件</p>
    <p style="margin-left: 20px;">📧 邮件服务听到消息 → 自动发送欢迎邮件给新用户</p>
  </div>

  <p><strong>💡 关键点：</strong>服务之间通过"消息"通信，不需要直接联系，就像公司里不同部门通过邮件沟通一样。</p>
</div>

### ❓ 常见问题解答

<div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0;">
  <h3 style="margin-top: 0; color: #2e7d32;">🤔 你可能想问的问题</h3>

  <h4 style="color: #388e3c;">Q1: 什么是"业务服务"？</h4>
  <p style="margin-left: 20px;"><strong>A:</strong> 业务服务就是处理实际业务需求的程序模块。比如用户服务处理用户相关的事情，工作流引擎处理业务流程。就像餐厅有"点餐服务"和"上菜服务"一样。</p>

  <h4 style="color: #388e3c; margin-top: 20px;">Q2: 为什么需要"事件驱动"？</h4>
  <p style="margin-left: 20px;"><strong>A:</strong> 就像学校里，广播通知"放学了"，不同的人会做不同的事（学生收拾书包、老师整理教案、门卫准备开门）。事件驱动让服务之间可以灵活协作，而不需要硬性绑定。</p>

  <h4 style="color: #388e3c; margin-top: 20px;">Q3: "工作流"是什么？</h4>
  <p style="margin-left: 20px;"><strong>A:</strong> 工作流就是一系列有顺序的步骤。比如"申请请假"的工作流：提交申请 → 部门审批 → 人事审批 → 通知结果。工作流引擎会自动执行这些步骤。</p>

  <h4 style="color: #388e3c; margin-top: 20px;">Q4: 服务之间会互相影响吗？</h4>
  <p style="margin-left: 20px;"><strong>A:</strong> 不会直接影响！服务之间通过"消息"通信，就像发邮件一样。一个服务出问题，不会直接导致其他服务崩溃，提高了系统的稳定性。</p>
</div>

## 📖 概述

<div style="background-color: #f0f8ff; padding: 20px; border-left: 5px solid #2196F3; margin: 20px 0;">
  <h3 style="margin-top: 0; color: #1976D2;">🏢 业务服务层的作用</h3>
  <p>WokeFlow 的业务服务层提供了企业级应用的核心业务逻辑实现，通过依赖注入的方式整合各个核心模块，提供用户管理、工作流执行等关键业务功能。服务层采用了事件驱动架构，支持异步处理和高并发操作。</p>
  <p><strong>简单说：</strong>业务服务层就是程序的"大脑"，负责处理实际的业务需求，让程序能够完成用户真正需要的功能。</p>
</div>

## 架构设计原则

### 1. 服务职责分离
- **单一职责**: 每个服务专注于特定的业务领域
- **依赖注入**: 通过容器管理服务间的依赖关系
- **接口一致**: 统一的异步API设计模式

### 2. 事件驱动架构
- **发布订阅模式**: 服务间通过消息进行解耦通信
- **状态同步**: 利用状态管理保持数据一致性
- **异步处理**: 支持高并发和非阻塞操作

### 3. 数据一致性保证
- **事务性操作**: 重要的业务操作保持原子性
- **状态持久化**: 关键数据通过状态管理持久化
- **错误恢复**: 完善的错误处理和恢复机制

## 核心业务服务详解

### 1. 用户服务 (UserService)

#### 功能特性
- **用户生命周期管理**: 从注册到注销的完整用户管理流程
- **身份认证授权**: 基于JWT的安全认证和权限控制
- **会话管理**: 用户登录会话的创建、维护和清理
- **密码安全**: 安全的密码哈希和验证机制
- **用户资料管理**: 用户信息的增删改查操作

#### 核心功能

##### 用户注册和认证

```javascript
import { UserService } from './services/UserService.js';

// 创建用户服务实例（通过依赖注入）
const userService = container.resolve('userService');

// 用户注册
const userData = {
  username: 'john_doe',
  email: 'john@example.com',
  password: 'securePassword123',
  fullName: 'John Doe',
  role: 'user'
};

const result = await userService.createUser(userData);
console.log('用户创建成功:', result.userId);

// 用户登录认证
const authResult = await userService.authenticateUser('john_doe', 'securePassword123');
console.log('认证成功:', {
  token: authResult.token,
  user: authResult.user,
  sessionId: authResult.sessionId
});

// 令牌验证
const validation = await userService.validateToken(authResult.token);
if (validation.valid) {
  console.log('令牌有效，用户:', validation.user);
}
```

##### 用户管理操作

```javascript
// 获取用户资料
const profile = await userService.getUserProfile(userId);

// 更新用户信息
const updatedUser = await userService.updateUser(userId, {
  fullName: 'John Smith',
  email: 'johnsmith@example.com'
});

// 删除用户
await userService.deleteUser(userId);

// 用户列表查询（支持过滤）
const users = await userService.listUsers({
  status: 'active',
  role: 'admin'
});
```

##### 会话管理

```javascript
// 用户登出
await userService.logout(sessionId);

// 清理过期会话（自动执行）
await userService.cleanupExpiredSessions();
```

#### 安全特性

##### 密码安全
- **哈希算法**: 使用SHA-256加盐哈希（生产环境建议使用bcrypt）
- **密码强度验证**: 至少8位字符的密码要求
- **安全存储**: 密码哈希与用户数据分离存储

##### 认证安全
- **JWT令牌**: 无状态的JSON Web Token认证
- **会话超时**: 自动清理24小时以上的过期会话
- **并发控制**: 防止同一用户的并发登录问题

##### 数据验证
- **输入验证**: 邮箱格式、密码强度等前端验证
- **数据完整性**: 防止SQL注入和XSS攻击
- **业务规则**: 用户名唯一性等业务约束

#### 事件驱动集成

```javascript
// 服务内部自动发布的事件
await userService.createUser(userData);
// 自动发布: 'user.created'

await userService.authenticateUser(username, password);
// 自动发布: 'user.authenticated'

await userService.updateUser(userId, data);
// 自动发布: 'user.updated'

await userService.deleteUser(userId);
// 自动发布: 'user.deleted'

// 服务订阅的事件处理
// 在setupEventListeners中自动订阅并处理
private async handleLogin(event) {
  // 处理登录逻辑
}

private async handleLogout(event) {
  // 处理登出逻辑
}
```

#### 数据模型

##### 用户对象结构
```javascript
{
  id: "user_1640995200000_abc123def",
  username: "john_doe",
  email: "john@example.com",
  fullName: "John Doe",
  role: "user", // user, admin, manager
  status: "active", // active, inactive, suspended
  passwordHash: "salt:hashed_password",
  createdAt: "2023-12-25T10:00:00.000Z",
  updatedAt: "2023-12-25T10:00:00.000Z",
  lastLoginAt: "2023-12-25T10:00:00.000Z",
  loginCount: 5
}
```

##### 会话对象结构
```javascript
{
  id: "session_1640995200000_xyz789",
  userId: "user_1640995200000_abc123def",
  token: "jwt_token_string",
  createdAt: "2023-12-25T10:00:00.000Z",
  lastActivity: "2023-12-25T10:30:00.000Z",
  ipAddress: "192.168.1.100",
  userAgent: "Mozilla/5.0..."
}
```

### 2. 工作流引擎 (WorkflowEngine)

#### 功能特性
- **工作流定义**: 可视化的工作流设计和配置
- **任务编排**: 支持顺序、并行、条件分支等任务流
- **状态管理**: 完整的工作流生命周期状态跟踪
- **错误处理**: 任务失败重试和错误恢复机制
- **可扩展性**: 支持自定义任务类型和执行逻辑

#### 工作流模型

##### 工作流定义结构
```javascript
const workflowDefinition = {
  name: "用户注册流程",
  description: "新用户注册后的处理流程",
  tasks: [
    {
      id: "validate_email",
      name: "验证邮箱",
      type: "http",
      method: "post",
      url: "/api/email/verify",
      dependencies: []
    },
    {
      id: "create_profile",
      name: "创建用户资料",
      type: "script",
      script: "await createUserProfile(context.userData)",
      dependencies: ["validate_email"]
    },
    {
      id: "send_welcome",
      name: "发送欢迎邮件",
      type: "http",
      method: "post",
      url: "/api/email/welcome",
      dependencies: ["create_profile"]
    }
  ],
  metadata: {
    author: "admin",
    version: "2.0.0-lightweight",
    tags: ["user", "registration"]
  }
};
```

##### 任务类型
- **HTTP任务**: REST API调用
- **脚本任务**: JavaScript代码执行
- **延迟任务**: 定时等待
- **条件任务**: 条件判断和分支
- **自定义任务**: 扩展的任务类型

#### 核心功能

##### 工作流生命周期管理

```javascript
import { WorkflowEngine } from './services/WorkflowEngine.js';

const workflowEngine = container.resolve('workflowEngine');

// 创建工作流定义
const workflowId = await workflowEngine.createWorkflow(workflowDefinition);

// 启动工作流执行
await workflowEngine.startWorkflow(workflowId, {
  userData: {
    email: 'user@example.com',
    name: 'John Doe'
  }
});

// 工作流控制操作
await workflowEngine.pauseWorkflow(workflowId);    // 暂停
await workflowEngine.resumeWorkflow(workflowId);   // 恢复
await workflowEngine.cancelWorkflow(workflowId);   // 取消

// 查询工作流状态
const workflow = workflowEngine.getWorkflow(workflowId);
console.log('工作流状态:', workflow.status);

const runningWorkflows = workflowEngine.getRunningWorkflows();
console.log('运行中的工作流:', runningWorkflows.length);
```

##### 任务执行逻辑

```javascript
// HTTP任务执行
async runTask(task, workflow) {
  switch (task.type) {
    case 'http':
      return await this.http[task.method](task.url, task.data);

    case 'script':
      return await this.executeScript(task.script, workflow);

    case 'delay':
      return await this.delay(task.duration);

    case 'condition':
      return this.evaluateCondition(task.condition, workflow);
  }
}

// 脚本任务示例
const scriptTask = {
  id: "process_data",
  type: "script",
  script: `
    const result = await context.utils.mapAsync(context.data, async (item) => {
      return await context.http.post('/api/process', item);
    });
    return result;
  `
};
```

##### 错误处理和重试

```javascript
// 任务失败处理
async executeTask(workflowId, task) {
  try {
    const result = await this.runTask(task, workflow);

    // 任务成功
    task.status = 'completed';
    task.result = result;

    await this.messaging.publish('task.completed', {
      workflowId,
      taskId: task.id,
      result
    });

  } catch (error) {
    // 任务失败
    task.status = 'failed';
    task.error = error.message;

    await this.messaging.publish('task.failed', {
      workflowId,
      taskId: task.id,
      error: error.message
    });

    // 重试逻辑
    if (this.shouldRetryTask(task)) {
      await this.retryTask(workflowId, task);
    } else {
      await this.failWorkflow(workflowId, error);
    }
  }
}
```

#### 工作流状态机

```
created ──────▶ running ──────▶ completed
     │             │
     │             ├────────────▶ failed
     │             │
     └────────────▶ paused ─────▶ cancelled
                       │
                       └────────────▶ running (resume)
```

##### 状态说明
- **created**: 工作流已创建，等待启动
- **running**: 工作流正在执行中
- **paused**: 工作流已暂停
- **completed**: 工作流执行完成
- **failed**: 工作流执行失败
- **cancelled**: 工作流被取消

#### 依赖管理和执行顺序

##### 任务依赖配置
```javascript
const workflow = {
  tasks: [
    {
      id: "task_a",
      name: "任务A",
      dependencies: [] // 无依赖，可立即执行
    },
    {
      id: "task_b",
      name: "任务B",
      dependencies: ["task_a"] // 依赖任务A
    },
    {
      id: "task_c",
      name: "任务C",
      dependencies: ["task_a"] // 依赖任务A，可并行执行
    },
    {
      id: "task_d",
      name: "任务D",
      dependencies: ["task_b", "task_c"] // 依赖B和C
    }
  ]
};
```

##### 执行顺序
```
task_a 执行完成
├── task_b 开始执行
└── task_c 开始执行（并行）
    └── task_b 和 task_c 都完成后，task_d 开始执行
```

#### 事件驱动集成

```javascript
// 引擎自动发布的事件
'workflow.created'     // 工作流创建
'workflow.started'     // 工作流启动
'workflow.paused'      // 工作流暂停
'workflow.resumed'     // 工作流恢复
'workflow.completed'   // 工作流完成
'workflow.failed'      // 工作流失败
'workflow.cancelled'   // 工作流取消
'task.completed'       // 任务完成
'task.failed'          // 任务失败

// 引擎订阅的事件
'workflow.start'       // 启动工作流命令
'workflow.pause'       // 暂停工作流命令
'workflow.resume'      // 恢复工作流命令
'workflow.cancel'      // 取消工作流命令
```

#### 持久化和恢复

```javascript
// 工作流状态持久化
async persistWorkflows() {
  // 将工作流状态保存到持久化存储
  for (const [workflowId, workflow] of this.workflows) {
    await this.saveToStorage(workflowId, workflow);
  }
}

// 工作流状态恢复
async recoverWorkflows() {
  // 从持久化存储恢复工作流状态
  const persistedWorkflows = await this.loadFromStorage();

  for (const workflow of persistedWorkflows) {
    this.workflows.set(workflow.id, workflow);

    // 恢复运行中的工作流
    if (workflow.status === 'running') {
      this.runningWorkflows.add(workflow.id);
      // 继续执行未完成的任务
      setTimeout(() => {
        this.executeWorkflowTasks(workflow.id);
      }, 1000);
    }
  }
}
```

## 服务间协作

### 依赖注入配置

```javascript
// 在主应用中配置服务依赖
@Dependency('http', 'auth', 'state')
@Service('userService')
class UserService {}

@Dependency('http', 'messaging', 'state', 'date', 'utils')
@Service('workflowEngine')
class WorkflowEngine {}
```

### 事件驱动通信

```javascript
// 用户服务与工作流引擎的协作
// 用户注册成功后自动触发欢迎流程

// 在UserService中
await this.messaging.publish('user.created', {
  userId,
  user: newUser
});

// 在WorkflowEngine中自动订阅并处理
this.messaging.subscribe('user.created', async (event) => {
  // 启动用户欢迎工作流
  const workflowId = await this.createWorkflow(welcomeWorkflowDefinition);
  await this.startWorkflow(workflowId, {
    userId: event.userId,
    userData: event.user
  });
});
```

### 状态共享

```javascript
// 服务间通过状态管理共享数据
class UserService {
  async createUser(userData) {
    // 创建用户...
    this.state.setState((state) => ({
      users: new Map(state.users).set(userId, user)
    }));

    // 发布事件
    await this.messaging.publish('user.created', { userId, user });
  }
}

class WorkflowEngine {
  async startWorkflow(workflowId, params) {
    // 获取用户数据
    const state = this.state.getState();
    const user = state.users.get(params.userId);

    // 使用用户数据执行工作流...
  }
}
```

## 监控和运维

### 性能监控
- **响应时间**: API调用的平均响应时间
- **并发处理**: 同时运行的工作流数量
- **成功率**: 工作流和任务的成功执行率
- **资源使用**: 内存和CPU使用情况

### 业务指标
- **用户注册**: 每日/每月新用户注册数量
- **工作流执行**: 各类工作流的执行统计
- **任务完成**: 任务执行成功/失败统计
- **错误分布**: 各类错误的发生频率

### 日志记录
- **审计日志**: 重要操作的详细记录
- **错误日志**: 异常情况的完整信息
- **性能日志**: 执行时间和资源使用
- **业务日志**: 业务流程的关键节点

## 扩展和定制

### 自定义任务类型

```javascript
// 注册自定义任务执行器
workflowEngine.registerTaskType('custom_api', async (task, workflow) => {
  // 自定义API调用逻辑
  return await customApiCall(task.endpoint, task.params);
});

// 在工作流中使用
const workflow = {
  tasks: [
    {
      id: "call_custom_api",
      type: "custom_api",
      endpoint: "/custom/endpoint",
      params: { key: "value" }
    }
  ]
};
```

### 插件扩展

```javascript
// 通过插件扩展业务服务功能
class WorkflowAnalyticsPlugin extends PluginInterface {
  async start(context) {
    const workflowEngine = context.container.resolve('workflowEngine');

    // 监听工作流事件并收集统计信息
    context.eventStream.on('workflow.completed', (data) => {
      this.recordWorkflowMetrics(data.workflowId, data.workflow);
    });
  }
}
```

## 总结

WokeFlow 的业务服务层通过精心设计的用户服务和工作流引擎，为企业应用提供了完整的核心业务功能支持。采用事件驱动架构和依赖注入模式，服务层实现了高内聚、低耦合的系统设计，保证了系统的可扩展性、可维护性和可靠性。
