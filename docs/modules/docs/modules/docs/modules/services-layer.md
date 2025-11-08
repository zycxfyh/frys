# frys 服务层

## 📖 模块概述

frys 的服务层提供了核心业务服务实现，通过组合基础设施层和应用服务层的能力，为表示层提供完整的业务功能。该层采用了服务导向架构 (SOA)，每个服务都专注于特定的业务领域，确保了代码的可维护性和可扩展性。

### 🎯 核心特性

- **业务服务封装** - 完整的业务逻辑实现
- **服务编排** - 多服务间的协调调用
- **事务管理** - 分布式事务的协调
- **事件驱动** - 异步事件处理机制
- **服务发现** - 动态服务注册和发现

### 🏗️ 服务架构

```
服务层
├── 🤖 AI提供商管理器 (AIProviderManager)
│   ├── 多AI提供商集成
│   ├── 智能路由选择
│   └── 配额管理
├── 🎨 AI提供商UI (AIProviderUI)
│   ├── 用户界面管理
│   ├── 配置界面
│   └── 监控面板
├── 👥 用户服务 (UserService)
│   ├── 用户生命周期管理
│   ├── 认证授权集成
│   └── 用户资料管理
└── 🔄 工作流引擎 (WorkflowEngine)
    ├── 工作流定义和执行
    ├── 任务编排调度
    ├── 状态管理和监控
    └── 错误处理和重试
```

## 🤖 AI提供商管理器 (AIProviderManager)

### 功能特性

- **多提供商支持** - 支持主流AI服务提供商的统一接口
- **智能负载均衡** - 基于性能和成本的智能路由
- **配额管理** - API调用配额的自动管理和限制
- **错误处理** - 提供商故障时的自动切换和重试
- **性能监控** - 实时性能指标收集和分析

### 快速开始

```javascript
import { AIProviderManager } from 'frys-services';

const aiManager = new AIProviderManager({
  providers: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: 'https://api.openai.com/v1',
      models: ['gpt-4', 'gpt-3.5-turbo'],
      rateLimit: { requests: 100, period: 60000 },
    },
    claude: {
      apiKey: process.env.ANTHROPIC_API_KEY,
      baseURL: 'https://api.anthropic.com',
      models: ['claude-3-opus-20240229'],
      maxTokens: 4096,
    },
    gemini: {
      apiKey: process.env.GOOGLE_API_KEY,
      baseURL: 'https://generativelanguage.googleapis.com',
      models: ['gemini-pro'],
    },
  },
  routing: {
    strategy: 'cost-performance', // cost, performance, latency
    fallback: true,
    retryAttempts: 3,
  },
});

// 初始化管理器
await aiManager.initialize();

// 执行AI推理
const result = await aiManager.generateText({
  prompt: '解释机器学习的基本概念',
  maxTokens: 500,
  provider: 'auto', // 自动选择最佳提供商
});

console.log('AI响应:', result.text);
console.log('使用的提供商:', result.provider);
console.log('消耗的令牌数:', result.usage.tokens);
```

### 提供商配置

```javascript
// 提供商配置结构
const providerConfig = {
  // OpenAI配置
  openai: {
    name: 'OpenAI',
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: 'https://api.openai.com/v1',
    models: {
      'gpt-4': {
        maxTokens: 8192,
        costPerToken: 0.03, // 每千tokens的价格
        performance: 0.9,   // 性能评分
        latency: 2000,      // 平均延迟(ms)
      },
      'gpt-3.5-turbo': {
        maxTokens: 4096,
        costPerToken: 0.002,
        performance: 0.7,
        latency: 1000,
      },
    },
    rateLimit: {
      requests: 100,
      period: 60000, // 1分钟
    },
    retryPolicy: {
      attempts: 3,
      backoff: 'exponential',
      baseDelay: 1000,
    },
  },

  // Claude配置
  claude: {
    name: 'Anthropic Claude',
    apiKey: process.env.ANTHROPIC_API_KEY,
    baseURL: 'https://api.anthropic.com',
    models: {
      'claude-3-opus-20240229': {
        maxTokens: 4096,
        costPerToken: 0.015,
        performance: 0.95,
        latency: 2500,
      },
      'claude-3-sonnet-20240229': {
        maxTokens: 4096,
        costPerToken: 0.008,
        performance: 0.85,
        latency: 1800,
      },
    },
    headers: {
      'anthropic-version': '2023-06-01',
    },
  },

  // 通用配置
  common: {
    timeout: 30000,       // 请求超时
    retries: 3,           // 重试次数
    circuitBreaker: {     // 断路器
      failureThreshold: 5,
      recoveryTimeout: 60000,
    },
  },
};
```

### 智能路由

```javascript
// 路由策略配置
const routingStrategies = {
  // 成本优先策略
  'cost': {
    algorithm: 'lowest-cost',
    factors: {
      cost: 0.8,        // 成本权重80%
      performance: 0.1, // 性能权重10%
      latency: 0.1,     // 延迟权重10%
    },
    constraints: {
      maxCost: 0.01,    // 最大成本限制
    },
  },

  // 性能优先策略
  'performance': {
    algorithm: 'highest-performance',
    factors: {
      performance: 0.7,
      latency: 0.2,
      cost: 0.1,
    },
    constraints: {
      minPerformance: 0.8, // 最小性能要求
      maxLatency: 2000,     // 最大延迟
    },
  },

  // 平衡策略
  'balanced': {
    algorithm: 'weighted-score',
    factors: {
      cost: 0.4,
      performance: 0.4,
      latency: 0.2,
    },
  },

  // 自适应策略（基于历史数据）
  'adaptive': {
    algorithm: 'machine-learning',
    learningRate: 0.1,
    adaptationInterval: 3600000, // 每小时调整一次
    historicalData: {
      window: 24 * 60 * 60 * 1000, // 24小时历史数据
      minSamples: 100,             // 最少样本数
    },
  },
};

// 路由选择算法
class Router {
  constructor(strategies, providers) {
    this.strategies = strategies;
    this.providers = providers;
    this.performanceHistory = new Map();
  }

  async selectProvider(requirements, strategy = 'balanced') {
    const candidates = this.filterCandidates(requirements);
    const strategyConfig = this.strategies[strategy];

    switch (strategyConfig.algorithm) {
      case 'lowest-cost':
        return this.selectLowestCost(candidates, requirements);

      case 'highest-performance':
        return this.selectHighestPerformance(candidates, requirements);

      case 'weighted-score':
        return this.selectByWeightedScore(candidates, strategyConfig.factors);

      case 'machine-learning':
        return this.selectByML(candidates, requirements);

      default:
        return candidates[0]; // 默认选择第一个
    }
  }

  filterCandidates(requirements) {
    return Object.entries(this.providers).filter(([name, config]) => {
      // 检查模型可用性
      if (requirements.model && !config.models[requirements.model]) {
        return false;
      }

      // 检查配额
      if (this.isQuotaExceeded(name)) {
        return false;
      }

      // 检查健康状态
      if (!this.isProviderHealthy(name)) {
        return false;
      }

      return true;
    }).map(([name, config]) => ({ name, config }));
  }

  selectLowestCost(candidates, requirements) {
    return candidates.reduce((best, current) => {
      const currentCost = this.calculateCost(current, requirements);
      const bestCost = this.calculateCost(best, requirements);
      return currentCost < bestCost ? current : best;
    });
  }

  calculateCost(provider, requirements) {
    const model = provider.config.models[requirements.model || 'default'];
    const estimatedTokens = requirements.maxTokens || 1000;
    return model.costPerToken * (estimatedTokens / 1000);
  }
}
```

### 配额管理

```javascript
// 配额管理器
class QuotaManager {
  constructor(redis, config) {
    this.redis = redis;
    this.config = config;
    this.quotaKeys = new Map();
  }

  // 检查配额
  async checkQuota(provider, userId = 'global') {
    const key = `quota:${provider}:${userId}`;
    const quota = this.config.providers[provider].rateLimit;

    const current = await this.redis.get(key) || 0;
    const remaining = quota.requests - current;

    return {
      allowed: remaining > 0,
      remaining,
      resetTime: this.getResetTime(key),
    };
  }

  // 消耗配额
  async consumeQuota(provider, userId = 'global') {
    const key = `quota:${provider}:${userId}`;
    const quota = this.config.providers[provider].rateLimit;

    const current = await this.redis.incr(key);

    // 设置过期时间（如果还没有设置）
    if (current === 1) {
      await this.redis.expire(key, quota.period / 1000);
    }

    const exceeded = current > quota.requests;

    if (exceeded) {
      // 记录配额超限事件
      await this.logQuotaExceeded(provider, userId);
    }

    return {
      consumed: current,
      exceeded,
      remaining: Math.max(0, quota.requests - current),
    };
  }

  // 获取配额重置时间
  getResetTime(key) {
    return new Date(Date.now() + this.config.providers[key.split(':')[1]].rateLimit.period);
  }

  async logQuotaExceeded(provider, userId) {
    console.warn(`配额超限: 提供商=${provider}, 用户=${userId}`);
    // 可以发送告警通知
  }
}
```

## 🎨 AI提供商UI (AIProviderUI)

### 功能特性

- **可视化配置** - 图形化界面配置AI提供商
- **实时监控** - 提供商状态和性能的实时监控
- **使用统计** - 详细的使用统计和成本分析
- **调试工具** - AI请求的调试和测试工具
- **管理面板** - 完整的管理控制台

### 主要组件

```javascript
// 提供商管理面板
class ProviderManagementPanel {
  constructor(container, aiManager) {
    this.container = container;
    this.aiManager = aiManager;
    this.providers = new Map();
    this.init();
  }

  init() {
    this.renderProviderList();
    this.renderConfigurationPanel();
    this.renderMonitoringDashboard();
    this.bindEvents();
  }

  renderProviderList() {
    const listElement = this.container.querySelector('.provider-list');
    listElement.innerHTML = '';

    for (const [name, provider] of this.aiManager.providers) {
      const item = this.createProviderItem(name, provider);
      listElement.appendChild(item);
    }
  }

  createProviderItem(name, provider) {
    const item = document.createElement('div');
    item.className = 'provider-item';
    item.innerHTML = `
      <div class="provider-header">
        <h3>${provider.name}</h3>
        <span class="status ${provider.status}">${provider.status}</span>
      </div>
      <div class="provider-metrics">
        <span>请求: ${provider.metrics.requests}</span>
        <span>成功率: ${(provider.metrics.successRate * 100).toFixed(1)}%</span>
        <span>平均延迟: ${provider.metrics.avgLatency}ms</span>
      </div>
      <div class="provider-actions">
        <button class="configure-btn" data-provider="${name}">配置</button>
        <button class="test-btn" data-provider="${name}">测试</button>
        <button class="disable-btn" data-provider="${name}">
          ${provider.enabled ? '禁用' : '启用'}
        </button>
      </div>
    `;

    return item;
  }

  renderConfigurationPanel() {
    // 实现配置面板渲染
  }

  renderMonitoringDashboard() {
    // 实现监控面板渲染
  }

  bindEvents() {
    this.container.addEventListener('click', (e) => {
      const target = e.target;

      if (target.classList.contains('configure-btn')) {
        this.showConfiguration(target.dataset.provider);
      } else if (target.classList.contains('test-btn')) {
        this.testProvider(target.dataset.provider);
      } else if (target.classList.contains('disable-btn')) {
        this.toggleProvider(target.dataset.provider);
      }
    });
  }

  async showConfiguration(providerName) {
    const provider = this.aiManager.providers.get(providerName);
    // 显示配置对话框
  }

  async testProvider(providerName) {
    try {
      const result = await this.aiManager.testProvider(providerName);
      this.showTestResult(result);
    } catch (error) {
      this.showError('测试失败', error.message);
    }
  }

  async toggleProvider(providerName) {
    const provider = this.aiManager.providers.get(providerName);
    provider.enabled = !provider.enabled;

    if (provider.enabled) {
      await this.aiManager.enableProvider(providerName);
    } else {
      await this.aiManager.disableProvider(providerName);
    }

    this.renderProviderList();
  }
}
```

## 👥 用户服务 (UserService)

### 功能特性

- **用户生命周期管理** - 从注册到账户删除的完整管理
- **认证集成** - 与认证服务的无缝集成
- **权限管理** - 用户角色和权限的分配管理
- **资料管理** - 用户信息的维护和更新
- **安全控制** - 密码安全和账户保护

### 用户管理

```javascript
import { UserService } from 'frys-services';

class UserService {
  constructor(userRepository, authService, messaging) {
    this.userRepository = userRepository;
    this.authService = authService;
    this.messaging = messaging;
  }

  // 用户注册
  async createUser(userData) {
    // 验证邮箱唯一性
    const existingUser = await this.userRepository.findByEmail(userData.email);
    if (existingUser) {
      throw new Error('邮箱已被注册');
    }

    // 验证用户名唯一性
    const existingUsername = await this.userRepository.findByUsername(userData.username);
    if (existingUsername) {
      throw new Error('用户名已被使用');
    }

    // 创建用户
    const user = await this.userRepository.create({
      ...userData,
      passwordHash: await this.authService.hashPassword(userData.password),
      isActive: true,
      isEmailVerified: false,
      roles: ['user'],
      permissions: [],
      profile: userData.profile || {},
    });

    // 发送验证邮件
    await this.messaging.publish('user.created', {
      userId: user.id,
      email: user.email,
    });

    return user;
  }

  // 用户登录
  async authenticateUser(username, password) {
    const user = await this.userRepository.findByUsername(username);
    if (!user) {
      throw new Error('用户不存在');
    }

    if (!user.isActive) {
      throw new Error('账户已被停用');
    }

    const isValidPassword = await this.authService.verifyPassword(password, user.passwordHash);
    if (!isValidPassword) {
      // 记录失败尝试
      await this.recordFailedLogin(user.id);
      throw new Error('密码错误');
    }

    // 更新最后登录时间
    await this.updateLastLogin(user.id);

    // 清理失败尝试记录
    await this.clearFailedAttempts(user.id);

    return user;
  }

  // 获取用户信息
  async getUserProfile(userId) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('用户不存在');
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      isActive: user.isActive,
      isEmailVerified: user.isEmailVerified,
      roles: user.roles,
      permissions: user.permissions,
      profile: user.profile,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    };
  }

  // 更新用户信息
  async updateUserProfile(userId, updates) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('用户不存在');
    }

    // 只允许更新特定字段
    const allowedUpdates = ['firstName', 'lastName', 'avatar', 'bio'];
    const filteredUpdates = {};

    for (const [key, value] of Object.entries(updates)) {
      if (allowedUpdates.includes(key)) {
        filteredUpdates[key] = value;
      }
    }

    if (Object.keys(filteredUpdates).length === 0) {
      throw new Error('没有有效的更新字段');
    }

    // 更新用户资料
    const updatedUser = await this.userRepository.update(userId, {
      profile: { ...user.profile, ...filteredUpdates },
      updatedAt: new Date(),
    });

    // 发送更新事件
    await this.messaging.publish('user.updated', {
      userId,
      updates: filteredUpdates,
    });

    return updatedUser;
  }

  // 更改密码
  async changePassword(userId, currentPassword, newPassword) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('用户不存在');
    }

    // 验证当前密码
    const isCurrentPasswordValid = await this.authService.verifyPassword(
      currentPassword,
      user.passwordHash
    );

    if (!isCurrentPasswordValid) {
      throw new Error('当前密码错误');
    }

    // 验证新密码强度
    if (!this.isPasswordStrong(newPassword)) {
      throw new Error('新密码强度不足');
    }

    // 更新密码
    const newPasswordHash = await this.authService.hashPassword(newPassword);
    await this.userRepository.update(userId, {
      passwordHash: newPasswordHash,
      updatedAt: new Date(),
    });

    // 发送密码变更事件
    await this.messaging.publish('user.password.changed', {
      userId,
    });

    // 可选：使其他会话失效
    await this.invalidateOtherSessions(userId);
  }

  // 辅助方法
  isPasswordStrong(password) {
    return password.length >= 8 &&
           /[A-Z]/.test(password) &&
           /[a-z]/.test(password) &&
           /[0-9]/.test(password);
  }

  async recordFailedLogin(userId) {
    // 实现失败登录记录逻辑
  }

  async clearFailedAttempts(userId) {
    // 实现清理失败尝试逻辑
  }

  async updateLastLogin(userId) {
    await this.userRepository.update(userId, {
      lastLoginAt: new Date(),
    });
  }

  async invalidateOtherSessions(userId) {
    // 实现使其他会话失效的逻辑
  }
}
```

## 🔄 工作流引擎 (WorkflowEngine)

### 功能特性

- **可视化工作流定义** - JSON格式的工作流配置
- **任务编排执行** - 支持顺序、并行、条件分支
- **状态管理和监控** - 完整的工作流生命周期追踪
- **错误处理重试** - 自动失败重试和人工干预
- **事件集成** - 与消息队列的深度集成

### 工作流定义

```javascript
// 工作流定义结构
const workflowDefinition = {
  id: 'user-onboarding',
  name: '用户入职流程',
  version: '1.0.0',
  description: '新用户注册后的自动化入职流程',

  // 全局配置
  config: {
    timeout: 3600000,      // 1小时超时
    retryPolicy: {
      maxAttempts: 3,
      backoffMs: 5000,     // 5秒退避
    },
    notifications: {
      onStart: true,
      onComplete: true,
      onError: true,
    },
  },

  // 工作流变量
  variables: {
    userId: '{{input.userId}}',
    email: '{{input.email}}',
    department: '{{input.department}}',
  },

  // 任务定义
  tasks: [
    {
      id: 'validate_user',
      name: '验证用户信息',
      type: 'script',
      script: `
        const user = await context.services.user.getUser(context.variables.userId);
        if (!user.isEmailVerified) {
          throw new Error('邮箱未验证');
        }
        context.variables.user = user;
        return { valid: true };
      `,
      timeout: 30000,
    },
    {
      id: 'send_welcome_email',
      name: '发送欢迎邮件',
      type: 'http',
      method: 'POST',
      url: '/api/emails/welcome',
      data: {
        to: '{{variables.email}}',
        template: 'welcome',
        variables: {
          name: '{{variables.user.profile.firstName}}',
          department: '{{variables.department}}',
        },
      },
      dependsOn: ['validate_user'],
    },
    {
      id: 'create_workspace',
      name: '创建工作空间',
      type: 'parallel',
      tasks: [
        {
          id: 'setup_gitlab',
          name: '设置GitLab访问',
          type: 'service',
          service: 'gitlab.createUser',
          params: {
            email: '{{variables.email}}',
            name: '{{variables.user.profile.firstName}} {{variables.user.profile.lastName}}',
          },
        },
        {
          id: 'setup_slack',
          name: '设置Slack访问',
          type: 'service',
          service: 'slack.inviteUser',
          params: {
            email: '{{variables.email}}',
            channels: ['general', 'random', '{{variables.department}}'],
          },
        },
      ],
      dependsOn: ['send_welcome_email'],
    },
    {
      id: 'assign_training',
      name: '分配培训任务',
      type: 'condition',
      condition: '{{variables.department === "engineering"}}',
      trueTask: 'assign_tech_training',
      falseTask: 'assign_general_training',
      dependsOn: ['create_workspace'],
    },
  ],
};
```

### 工作流执行引擎

```javascript
class WorkflowEngine {
  constructor(services) {
    this.services = services;
    this.workflows = new Map();
    this.runningWorkflows = new Map();
    this.taskExecutors = new Map();
    this.registerTaskExecutors();
  }

  // 注册任务执行器
  registerTaskExecutors() {
    this.taskExecutors.set('script', new ScriptTaskExecutor());
    this.taskExecutors.set('http', new HttpTaskExecutor(this.services.http));
    this.taskExecutors.set('service', new ServiceTaskExecutor(this.services));
    this.taskExecutors.set('parallel', new ParallelTaskExecutor(this));
    this.taskExecutors.set('condition', new ConditionTaskExecutor(this));
    this.taskExecutors.set('delay', new DelayTaskExecutor());
    this.taskExecutors.set('manual', new ManualTaskExecutor());
  }

  // 创建工作流
  async createWorkflow(definition) {
    const workflow = new Workflow(definition);
    await this.validateWorkflow(workflow);
    this.workflows.set(workflow.id, workflow);
    return workflow;
  }

  // 启动工作流
  async startWorkflow(workflowId, input = {}) {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`工作流 ${workflowId} 不存在`);
    }

    const execution = new WorkflowExecution(workflow, input);
    this.runningWorkflows.set(execution.id, execution);

    try {
      // 发送启动事件
      await this.services.messaging.publish('workflow.started', {
        workflowId: execution.id,
        definitionId: workflow.id,
        input,
      });

      // 执行工作流
      await this.executeWorkflow(execution);

      // 发送完成事件
      await this.services.messaging.publish('workflow.completed', {
        workflowId: execution.id,
        output: execution.output,
        duration: execution.duration,
      });

    } catch (error) {
      // 发送失败事件
      await this.services.messaging.publish('workflow.failed', {
        workflowId: execution.id,
        error: error.message,
        duration: execution.duration,
      });

      throw error;
    } finally {
      this.runningWorkflows.delete(execution.id);
    }

    return execution;
  }

  // 执行工作流
  async executeWorkflow(execution) {
    const startTime = Date.now();

    try {
      // 初始化上下文
      execution.context = this.createExecutionContext(execution);

      // 执行任务
      for (const task of execution.workflow.tasks) {
        if (execution.status === 'cancelled') break;

        await this.executeTask(task, execution);
      }

      execution.status = 'completed';
      execution.output = execution.context.variables;

    } catch (error) {
      execution.status = 'failed';
      execution.error = error.message;
      throw error;
    } finally {
      execution.duration = Date.now() - startTime;
    }
  }

  // 执行单个任务
  async executeTask(task, execution) {
    const executor = this.taskExecutors.get(task.type);
    if (!executor) {
      throw new Error(`不支持的任务类型: ${task.type}`);
    }

    const taskExecution = new TaskExecution(task, execution);
    execution.tasks.set(task.id, taskExecution);

    try {
      // 检查依赖
      await this.checkDependencies(task, execution);

      // 执行任务
      taskExecution.status = 'running';
      const result = await executor.execute(task, execution.context);

      taskExecution.status = 'completed';
      taskExecution.output = result;

      // 更新上下文
      if (result && typeof result === 'object') {
        Object.assign(execution.context.variables, result);
      }

    } catch (error) {
      taskExecution.status = 'failed';
      taskExecution.error = error.message;

      // 应用重试策略
      if (await this.shouldRetry(task, taskExecution)) {
        return this.retryTask(task, execution);
      }

      throw error;
    }
  }

  // 检查任务依赖
  async checkDependencies(task, execution) {
    if (!task.dependsOn || task.dependsOn.length === 0) {
      return;
    }

    for (const depId of task.dependsOn) {
      const depTask = execution.tasks.get(depId);
      if (!depTask) {
        throw new Error(`依赖任务 ${depId} 未找到`);
      }

      if (depTask.status !== 'completed') {
        throw new Error(`依赖任务 ${depId} 未完成`);
      }
    }
  }

  // 创建执行上下文
  createExecutionContext(execution) {
    return {
      variables: { ...execution.workflow.variables, ...execution.input },
      services: this.services,
      utils: this.services.utils,
      date: this.services.date,
    };
  }

  // 重试逻辑
  async shouldRetry(task, taskExecution) {
    const retryPolicy = task.retryPolicy || execution.workflow.config.retryPolicy;
    if (!retryPolicy || taskExecution.retryCount >= retryPolicy.maxAttempts) {
      return false;
    }

    // 指数退避
    const delay = retryPolicy.backoffMs * Math.pow(2, taskExecution.retryCount);
    await new Promise(resolve => setTimeout(resolve, delay));

    return true;
  }

  async retryTask(task, execution) {
    const taskExecution = execution.tasks.get(task.id);
    taskExecution.retryCount++;

    return this.executeTask(task, execution);
  }

  // 工作流控制
  async pauseWorkflow(executionId) {
    const execution = this.runningWorkflows.get(executionId);
    if (execution) {
      execution.status = 'paused';
    }
  }

  async resumeWorkflow(executionId) {
    const execution = this.runningWorkflows.get(executionId);
    if (execution && execution.status === 'paused') {
      execution.status = 'running';
      return this.executeWorkflow(execution);
    }
  }

  async cancelWorkflow(executionId) {
    const execution = this.runningWorkflows.get(executionId);
    if (execution) {
      execution.status = 'cancelled';
    }
  }
}
```

## 🔧 依赖注入配置

### 服务注册

```javascript
import { container } from 'frys';

// 注册AI服务
container.register('aiProviderManager', (c) => new AIProviderManager({
  http: c.resolve('http'),
  cache: c.resolve('cache'),
  config: c.resolve('config'),
  logger: c.resolve('logger'),
}));

container.register('aiProviderUI', (c) => new AIProviderUI({
  aiManager: c.resolve('aiProviderManager'),
  container: document.getElementById('ai-ui'),
}));

// 注册用户服务
container.register('userService', (c) => new UserService({
  userRepository: c.resolve('userRepository'),
  authService: c.resolve('authService'),
  messaging: c.resolve('messaging'),
  logger: c.resolve('logger'),
}));

// 注册工作流引擎
container.register('workflowEngine', (c) => new WorkflowEngine({
  http: c.resolve('http'),
  messaging: c.resolve('messaging'),
  state: c.resolve('state'),
  date: c.resolve('date'),
  utils: c.resolve('utils'),
  logger: c.resolve('logger'),
}));
```

## 📊 监控和指标

### 服务指标

```javascript
// AI服务指标
const aiMetrics = {
  totalRequests: await aiManager.getTotalRequests(),
  successRate: await aiManager.getSuccessRate(),
  averageLatency: await aiManager.getAverageLatency(),
  costPerRequest: await aiManager.getCostPerRequest(),
  providerUsage: await aiManager.getProviderUsage(),
};

// 用户服务指标
const userMetrics = {
  totalUsers: await userService.getTotalUserCount(),
  activeUsers: await userService.getActiveUserCount(),
  newUsersToday: await userService.getNewUsersCount('day'),
  loginAttempts: await userService.getLoginAttempts(),
  passwordChanges: await userService.getPasswordChanges(),
};

// 工作流引擎指标
const workflowMetrics = {
  totalWorkflows: await workflowEngine.getTotalWorkflowCount(),
  runningWorkflows: await workflowEngine.getRunningWorkflowCount(),
  completedWorkflows: await workflowEngine.getCompletedWorkflowCount(),
  failedWorkflows: await workflowEngine.getFailedWorkflowCount(),
  averageExecutionTime: await workflowEngine.getAverageExecutionTime(),
};
```

## 🧪 测试策略

### 服务单元测试

```javascript
import { describe, it, expect, vi } from 'vitest';
import { UserService } from '../services/UserService.js';

describe('UserService', () => {
  let userService;
  let mockUserRepository;
  let mockAuthService;
  let mockMessaging;

  beforeEach(() => {
    mockUserRepository = {
      findByEmail: vi.fn(),
      findByUsername: vi.fn(),
      create: vi.fn(),
      findById: vi.fn(),
      update: vi.fn(),
    };

    mockAuthService = {
      hashPassword: vi.fn(),
      verifyPassword: vi.fn(),
    };

    mockMessaging = {
      publish: vi.fn(),
    };

    userService = new UserService({
      userRepository: mockUserRepository,
      authService: mockAuthService,
      messaging: mockMessaging,
    });
  });

  it('should create user successfully', async () => {
    const userData = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'TestPass123',
    };

    const mockUser = {
      id: 'user-123',
      ...userData,
      passwordHash: 'hashed_password',
    };

    mockUserRepository.findByEmail.mockResolvedValue(null);
    mockUserRepository.findByUsername.mockResolvedValue(null);
    mockAuthService.hashPassword.mockResolvedValue('hashed_password');
    mockUserRepository.create.mockResolvedValue(mockUser);

    const result = await userService.createUser(userData);

    expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(userData.email);
    expect(mockUserRepository.findByUsername).toHaveBeenCalledWith(userData.username);
    expect(mockAuthService.hashPassword).toHaveBeenCalledWith(userData.password);
    expect(mockUserRepository.create).toHaveBeenCalled();
    expect(mockMessaging.publish).toHaveBeenCalledWith('user.created', {
      userId: mockUser.id,
      email: mockUser.email,
    });
    expect(result).toEqual(mockUser);
  });

  it('should reject duplicate email', async () => {
    const userData = {
      username: 'testuser',
      email: 'existing@example.com',
      password: 'TestPass123',
    };

    mockUserRepository.findByEmail.mockResolvedValue({
      id: 'existing-user',
      email: userData.email,
    });

    await expect(userService.createUser(userData)).rejects.toThrow('邮箱已被注册');
  });
});
```

## ❓ 常见问题

### Q: 如何选择合适的AI提供商？

**A:** 基于任务类型和需求选择：

- **代码生成**: DeepSeek Coder 或 GPT-4
- **创意写作**: Claude 或 Gemini
- **分析推理**: GPT-4 或 Claude
- **成本敏感**: DeepSeek 或 Gemini

```javascript
const selectProvider = (task, constraints) => {
  const providers = {
    openai: { cost: 0.02, performance: 0.9, latency: 0.7 },
    claude: { cost: 0.015, performance: 0.95, latency: 0.8 },
    gemini: { cost: 0.01, performance: 0.8, latency: 0.6 },
    deepseek: { cost: 0.005, performance: 0.85, latency: 0.9 },
  };

  return Object.entries(providers)
    .filter(([name, stats]) => meetsConstraints(stats, constraints))
    .sort((a, b) => scoreProvider(a[1], task) - scoreProvider(b[1], task))[0];
};
```

### Q: 工作流执行失败如何处理？

**A:** 实现重试和补偿机制：

```javascript
// 工作流错误处理
class WorkflowErrorHandler {
  async handleTaskFailure(task, execution, error) {
    const retryPolicy = task.retryPolicy || execution.workflow.config.retryPolicy;

    if (retryPolicy && execution.retryCount < retryPolicy.maxAttempts) {
      // 指数退避重试
      const delay = retryPolicy.backoffMs * Math.pow(2, execution.retryCount);
      await new Promise(resolve => setTimeout(resolve, delay));

      execution.retryCount++;
      return this.retryTask(task, execution);
    }

    // 应用补偿操作
    await this.applyCompensation(task, execution);

    // 发送告警
    await this.sendFailureAlert(execution, error);

    throw error;
  }

  async applyCompensation(task, execution) {
    // 根据任务类型执行补偿操作
    switch (task.type) {
      case 'http':
        // HTTP请求补偿（通常是撤销操作）
        if (task.compensation) {
          await this.executeCompensation(task.compensation, execution.context);
        }
        break;

      case 'database':
        // 数据库事务回滚（通常由事务管理器处理）
        break;

      case 'service':
        // 服务调用补偿
        await this.rollbackServiceCall(task, execution);
        break;
    }
  }
}
```

## 📚 相关链接

- [应用服务层文档](application-layer.md) - 应用服务层的实现
- [基础设施层文档](infrastructure-layer.md) - 基础设施实现
- [表示层文档](presentation-layer.md) - API接口实现
- [测试策略](testing-architecture.md) - 测试最佳实践
