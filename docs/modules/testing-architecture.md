# frys 测试架构

## 📖 概述

frys 提供了一套完整的测试体系，确保代码质量和系统稳定性。测试架构采用分层设计，覆盖从单元测试到端到端测试的完整测试金字塔。

### 🎯 测试策略

- **质量优先**: 测试驱动开发，确保代码质量
- **自动化为主**: 最大化自动化测试覆盖率
- **分层测试**: 遵循测试金字塔模型
- **持续集成**: 测试集成到CI/CD流程
- **监控反馈**: 实时监控测试结果和质量指标

### 🧪 测试层次

```
测试金字塔
    ▲
    │     端到端测试 (10%)
    │     少量、关键用户流程
    │
    │     集成测试 (20%)
    │     模块间协作、服务集成
    │
    │     单元测试 (70%)
    │     核心功能、业务逻辑
    ▼
```

### 📊 测试覆盖目标

| 测试类型 | 覆盖率目标 | 执行频率 | 主要职责 |
|----------|------------|----------|----------|
| 单元测试 | 80%+ | 每次提交 | 核心逻辑正确性 |
| 集成测试 | 60%+ | 每日构建 | 模块间协作 |
| 端到端测试 | 30%+ | 发布前 | 用户流程完整性 |
| 性能测试 | 关键路径 | 定期执行 | 系统性能表现 |
| 安全测试 | 100% | 定期执行 | 安全漏洞检查 |

## 🧪 单元测试

### 功能特性

- **快速执行**: 毫秒级响应时间
- **独立运行**: 无外部依赖，纯逻辑测试
- **全面覆盖**: 语句、分支、条件覆盖
- **持续反馈**: 开发时实时运行
- **调试友好**: 详细的错误信息和堆栈跟踪

### 测试框架

frys 使用 Vitest 作为单元测试框架，提供以下特性：

- **ESM原生支持**: 完整的ES模块支持
- **TypeScript友好**: 内置TypeScript支持
- **Jest兼容**: 熟悉的API和断言
- **并行执行**: 多核CPU充分利用
- **智能重试**: 失败测试自动重试

### 快速开始

```javascript
import { describe, it, expect, vi } from 'vitest';
import { UserService } from '../src/services/UserService.js';

describe('UserService', () => {
  let userService;
  let mockRepository;

  beforeEach(() => {
    // 设置测试依赖
    mockRepository = {
      create: vi.fn(),
      findById: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    };

    userService = new UserService({
      userRepository: mockRepository,
      auth: mockAuth,
      logger: mockLogger
    });
  });

  describe('createUser', () => {
    it('should create user successfully', async () => {
      // 准备测试数据
      const userData = {
        username: 'john_doe',
        email: 'john@example.com',
        password: 'password123'
      };

      const expectedUser = {
        id: 'user_123',
        ...userData,
        createdAt: new Date(),
        status: 'active'
      };

      // 设置模拟行为
      mockRepository.create.mockResolvedValue(expectedUser);

      // 执行测试
      const result = await userService.createUser(userData);

      // 验证结果
      expect(result).toEqual(expectedUser);
      expect(mockRepository.create).toHaveBeenCalledWith(userData);
    });

    it('should throw error for duplicate email', async () => {
      const userData = {
        username: 'jane_doe',
        email: 'john@example.com', // 重复邮箱
        password: 'password123'
      };

      // 模拟邮箱已存在
      mockRepository.create.mockRejectedValue(
        new Error('Email already exists')
      );

      // 验证抛出错误
      await expect(userService.createUser(userData))
        .rejects.toThrow('Email already exists');
    });

    it('should validate required fields', async () => {
      const invalidData = {
        username: '', // 空用户名
        email: 'invalid-email', // 无效邮箱
        password: '123' // 密码太短
      };

      await expect(userService.createUser(invalidData))
        .rejects.toThrow('Validation failed');
    });
  });

  describe('getUserById', () => {
    it('should return user when found', async () => {
      const userId = 'user_123';
      const expectedUser = {
        id: userId,
        username: 'john_doe',
        email: 'john@example.com'
      };

      mockRepository.findById.mockResolvedValue(expectedUser);

      const result = await userService.getUserById(userId);

      expect(result).toEqual(expectedUser);
      expect(mockRepository.findById).toHaveBeenCalledWith(userId);
    });

    it('should return null when user not found', async () => {
      const userId = 'nonexistent';

      mockRepository.findById.mockResolvedValue(null);

      const result = await userService.getUserById(userId);

      expect(result).toBeNull();
    });
  });
});
```

### Mock 和 Stub

```javascript
// 使用 Vitest 的内置 Mock
import { vi } from 'vitest';

// Mock 整个模块
vi.mock('../src/utils/email.js', () => ({
  sendWelcomeEmail: vi.fn().mockResolvedValue(true)
}));

// Mock 部分方法
const mockHttpClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn()
};

// Mock 返回值
mockHttpClient.get.mockResolvedValue({
  data: { id: 1, name: 'John' },
  status: 200
});

// Mock 异常
mockHttpClient.post.mockRejectedValue(
  new Error('Network error')
);

// 验证调用
expect(mockHttpClient.get).toHaveBeenCalledWith('/api/users/1');
expect(mockHttpClient.get).toHaveBeenCalledTimes(1);
```

### 测试覆盖率

```javascript
// vitest.config.js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'istanbul',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'test/',
        'docs/',
        '**/*.config.js'
      ],
      thresholds: {
        global: {
          statements: 80,
          branches: 75,
          functions: 85,
          lines: 80
        }
      }
    }
  }
});
```

## 🔗 集成测试

### 功能特性

- **模块协作**: 测试模块间的交互
- **外部依赖**: 数据库、缓存、消息队列
- **API接口**: RESTful API 和 GraphQL
- **异步处理**: 队列任务和后台作业
- **容器化**: 使用 Testcontainers 提供隔离环境

### 测试环境

#### Testcontainers 配置

```javascript
import { PostgreSqlContainer, RedisContainer } from '@testcontainers/postgresql';
import { RedisContainer as Redis } from '@testcontainers/redis';

describe('User Integration Tests', () => {
  let postgresContainer;
  let redisContainer;
  let database;
  let cache;

  beforeAll(async () => {
    // 启动 PostgreSQL 容器
    postgresContainer = await new PostgreSqlContainer()
      .withDatabase('testdb')
      .withUsername('testuser')
      .withPassword('testpass')
      .start();

    // 启动 Redis 容器
    redisContainer = await new RedisContainer()
      .withPassword('testpass')
      .start();

    // 连接数据库
    database = createDatabaseConnection({
      host: postgresContainer.getHost(),
      port: postgresContainer.getPort(),
      database: postgresContainer.getDatabase(),
      username: postgresContainer.getUsername(),
      password: postgresContainer.getPassword()
    });

    // 连接缓存
    cache = createRedisConnection({
      host: redisContainer.getHost(),
      port: redisContainer.getPort(),
      password: redisContainer.getPassword()
    });

    // 初始化测试数据
    await setupTestData(database);
  }, 60000); // 60秒超时

  afterAll(async () => {
    // 清理资源
    await database.close();
    await cache.disconnect();
    await postgresContainer.stop();
    await redisContainer.stop();
  });
});
```

### API 集成测试

```javascript
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('User API Integration', () => {
  let app;
  let server;
  let testDatabase;

  beforeAll(async () => {
    // 创建测试应用
    app = createApp({
      database: testDatabase,
      cache: testCache,
      queue: testQueue
    });

    // 启动服务器
    server = app.listen(0); // 随机端口
  });

  afterAll(async () => {
    await server.close();
    await testDatabase.cleanup();
  });

  describe('POST /api/users', () => {
    it('should create user successfully', async () => {
      const userData = {
        username: 'john_doe',
        email: 'john@example.com',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/users')
        .send(userData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.username).toBe(userData.username);
      expect(response.body.email).toBe(userData.email);
      expect(response.body).not.toHaveProperty('password'); // 密码不应返回
    });

    it('should validate input data', async () => {
      const invalidData = {
        username: '',
        email: 'invalid-email',
        password: '123'
      };

      const response = await request(app)
        .post('/api/users')
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
      expect(response.body.errors).toContain('Username is required');
      expect(response.body.errors).toContain('Invalid email format');
      expect(response.body.errors).toContain('Password too short');
    });

    it('should handle duplicate email', async () => {
      // 先创建用户
      await request(app)
        .post('/api/users')
        .send({
          username: 'user1',
          email: 'duplicate@example.com',
          password: 'password123'
        })
        .expect(201);

      // 尝试创建重复邮箱用户
      const response = await request(app)
        .post('/api/users')
        .send({
          username: 'user2',
          email: 'duplicate@example.com',
          password: 'password123'
        })
        .expect(409);

      expect(response.body.message).toContain('Email already exists');
    });
  });

  describe('GET /api/users/:id', () => {
    let createdUser;

    beforeEach(async () => {
      // 创建测试用户
      const response = await request(app)
        .post('/api/users')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: 'password123'
        });

      createdUser = response.body;
    });

    it('should return user by id', async () => {
      const response = await request(app)
        .get(`/api/users/${createdUser.id}`)
        .expect(200);

      expect(response.body.id).toBe(createdUser.id);
      expect(response.body.username).toBe(createdUser.username);
    });

    it('should return 404 for non-existent user', async () => {
      const response = await request(app)
        .get('/api/users/nonexistent-id')
        .expect(404);

      expect(response.body.message).toBe('User not found');
    });
  });

  describe('PUT /api/users/:id', () => {
    it('should update user successfully', async () => {
      // 先创建用户
      const createResponse = await request(app)
        .post('/api/users')
        .send({
          username: 'updateuser',
          email: 'update@example.com',
          password: 'password123'
        });

      const userId = createResponse.body.id;
      const updateData = {
        fullName: 'Updated Name',
        phone: '+1234567890'
      };

      // 更新用户
      const updateResponse = await request(app)
        .put(`/api/users/${userId}`)
        .send(updateData)
        .expect(200);

      expect(updateResponse.body.fullName).toBe(updateData.fullName);
      expect(updateResponse.body.phone).toBe(updateData.phone);
    });
  });

  describe('DELETE /api/users/:id', () => {
    it('should delete user successfully', async () => {
      // 先创建用户
      const createResponse = await request(app)
        .post('/api/users')
        .send({
          username: 'deleteuser',
          email: 'delete@example.com',
          password: 'password123'
        });

      const userId = createResponse.body.id;

      // 删除用户
      await request(app)
        .delete(`/api/users/${userId}`)
        .expect(204);

      // 验证用户已被删除
      await request(app)
        .get(`/api/users/${userId}`)
        .expect(404);
    });
  });
});
```

### 消息队列集成测试

```javascript
describe('Workflow Engine Integration', () => {
  let workflowEngine;
  let messageQueue;
  let database;

  beforeEach(async () => {
    // 设置测试环境
    workflowEngine = container.resolve('workflowEngine');
    messageQueue = container.resolve('messageQueue');
    database = container.resolve('database');
  });

  it('should execute user registration workflow', async () => {
    // 定义工作流
    const workflowDefinition = {
      name: 'User Registration Workflow',
      tasks: [
        {
          id: 'validate_email',
          type: 'http',
          method: 'POST',
          url: '/api/email/verify',
          dependencies: []
        },
        {
          id: 'create_user_profile',
          type: 'script',
          script: 'await createUserProfile(context.userData)',
          dependencies: ['validate_email']
        },
        {
          id: 'send_welcome_email',
          type: 'http',
          method: 'POST',
          url: '/api/email/welcome',
          dependencies: ['create_user_profile']
        }
      ]
    };

    // 创建工作流
    const workflowId = await workflowEngine.createWorkflow(workflowDefinition);

    // 监听工作流完成事件
    const workflowCompleted = new Promise((resolve) => {
      messageQueue.subscribe('workflow.completed', (event) => {
        if (event.workflowId === workflowId) {
          resolve(event);
        }
      });
    });

    // 启动工作流
    const executionId = await workflowEngine.startWorkflow(workflowId, {
      userData: {
        email: 'john@example.com',
        name: 'John Doe'
      }
    });

    // 等待工作流完成
    const completionEvent = await workflowCompleted;

    // 验证结果
    expect(completionEvent.workflowId).toBe(workflowId);
    expect(completionEvent.status).toBe('completed');
    expect(completionEvent.tasksCompleted).toBe(3);

    // 验证数据库状态
    const workflow = await database.workflows.findById(workflowId);
    expect(workflow.status).toBe('completed');
    expect(workflow.tasks.length).toBe(3);
    expect(workflow.tasks.every(task => task.status === 'completed')).toBe(true);
  });

  it('should handle workflow failures gracefully', async () => {
    // 创建会失败的工作流
    const failingWorkflow = {
      name: 'Failing Workflow',
      tasks: [
        {
          id: 'failing_task',
          type: 'http',
          method: 'POST',
          url: '/api/nonexistent', // 这个请求会失败
          dependencies: []
        }
      ]
    };

    const workflowId = await workflowEngine.createWorkflow(failingWorkflow);

    // 监听失败事件
    const workflowFailed = new Promise((resolve) => {
      messageQueue.subscribe('workflow.failed', (event) => {
        if (event.workflowId === workflowId) {
          resolve(event);
        }
      });
    });

    // 启动工作流
    await workflowEngine.startWorkflow(workflowId, {});

    // 等待失败
    const failureEvent = await workflowFailed;

    // 验证失败处理
    expect(failureEvent.workflowId).toBe(workflowId);
    expect(failureEvent.status).toBe('failed');
    expect(failureEvent.error).toBeDefined();

    // 验证数据库状态
    const workflow = await database.workflows.findById(workflowId);
    expect(workflow.status).toBe('failed');
    expect(workflow.error).toBeDefined();
  });
});
```

## 🌐 端到端测试

### 功能特性

- **完整用户流程**: 从用户界面到后端的全链路测试
- **浏览器自动化**: 使用 Playwright 进行浏览器操作
- **API测试**: RESTful API 和 GraphQL 接口测试
- **跨平台兼容**: 多浏览器和设备支持
- **视觉回归**: 界面截图对比和视觉测试

### Playwright 配置

```javascript
// playwright.config.js
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      use: { devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: devices['iPhone 12'],
    },
  ],

  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
});
```

### 用户注册流程测试

```javascript
import { test, expect } from '@playwright/test';

test.describe('User Registration Flow', () => {
  test.beforeEach(async ({ page }) => {
    // 清理测试数据
    await page.goto('/admin/cleanup');
    await page.click('text=清理测试数据');
  });

  test('should complete full user registration flow', async ({ page }) => {
    // 访问注册页面
    await page.goto('/register');

    // 填写注册表单
    await page.fill('[data-testid="username"]', 'johndoe');
    await page.fill('[data-testid="email"]', 'john@example.com');
    await page.fill('[data-testid="password"]', 'password123');
    await page.fill('[data-testid="confirm-password"]', 'password123');

    // 勾选同意条款
    await page.check('[data-testid="terms-agreement"]');

    // 提交表单
    await page.click('[data-testid="register-button"]');

    // 等待页面跳转到邮箱验证页面
    await page.waitForURL('/verify-email');

    // 验证显示正确的提示信息
    await expect(page.locator('[data-testid="verification-message"]'))
      .toContainText('验证邮件已发送到 john@example.com');

    // 模拟点击邮件中的验证链接
    // 注意：实际测试中需要通过API或邮件服务获取验证链接
    const verificationLink = await getVerificationLinkFromEmail('john@example.com');
    await page.goto(verificationLink);

    // 验证跳转到登录页面
    await page.waitForURL('/login');

    // 验证成功消息
    await expect(page.locator('[data-testid="success-message"]'))
      .toContainText('邮箱验证成功，请登录');

    // 尝试登录
    await page.fill('[data-testid="login-email"]', 'john@example.com');
    await page.fill('[data-testid="login-password"]', 'password123');
    await page.click('[data-testid="login-button"]');

    // 验证登录成功并跳转到用户仪表板
    await page.waitForURL('/dashboard');

    // 验证用户信息显示正确
    await expect(page.locator('[data-testid="user-greeting"]'))
      .toContainText('欢迎, johndoe');

    // 验证用户菜单可用
    await page.click('[data-testid="user-menu"]');
    await expect(page.locator('[data-testid="logout-button"]')).toBeVisible();
  });

  test('should handle registration validation errors', async ({ page }) => {
    await page.goto('/register');

    // 尝试提交空表单
    await page.click('[data-testid="register-button"]');

    // 验证错误消息
    await expect(page.locator('[data-testid="username-error"]'))
      .toContainText('用户名不能为空');
    await expect(page.locator('[data-testid="email-error"]'))
      .toContainText('邮箱不能为空');
    await expect(page.locator('[data-testid="password-error"]'))
      .toContainText('密码不能为空');

    // 填写无效数据
    await page.fill('[data-testid="email"]', 'invalid-email');
    await page.fill('[data-testid="password"]', '123');
    await page.click('[data-testid="register-button"]');

    // 验证格式错误
    await expect(page.locator('[data-testid="email-error"]'))
      .toContainText('邮箱格式不正确');
    await expect(page.locator('[data-testid="password-error"]'))
      .toContainText('密码长度不能少于8位');
  });

  test('should prevent duplicate email registration', async ({ page }) => {
    // 先注册一个用户
    await page.goto('/register');
    await page.fill('[data-testid="username"]', 'user1');
    await page.fill('[data-testid="email"]', 'duplicate@example.com');
    await page.fill('[data-testid="password"]', 'password123');
    await page.fill('[data-testid="confirm-password"]', 'password123');
    await page.check('[data-testid="terms-agreement"]');
    await page.click('[data-testid="register-button"]');

    // 等待注册完成
    await page.waitForURL('/verify-email');

    // 尝试注册相同邮箱的用户
    await page.goto('/register');
    await page.fill('[data-testid="username"]', 'user2');
    await page.fill('[data-testid="email"]', 'duplicate@example.com');
    await page.fill('[data-testid="password"]', 'password123');
    await page.fill('[data-testid="confirm-password"]', 'password123');
    await page.check('[data-testid="terms-agreement"]');
    await page.click('[data-testid="register-button"]');

    // 验证错误提示
    await expect(page.locator('[data-testid="error-message"]'))
      .toContainText('该邮箱已被注册');
  });

  test('should handle email verification timeout', async ({ page }) => {
    // 注册用户
    await page.goto('/register');
    await page.fill('[data-testid="username"]', 'timeoutuser');
    await page.fill('[data-testid="email"]', 'timeout@example.com');
    await page.fill('[data-testid="password"]', 'password123');
    await page.fill('[data-testid="confirm-password"]', 'password123');
    await page.check('[data-testid="terms-agreement"]');
    await page.click('[data-testid="register-button"]');

    await page.waitForURL('/verify-email');

    // 等待验证链接过期（假设24小时）
    // 在测试环境中，我们可以通过修改系统时间或mock来模拟

    // 尝试访问过期的验证链接
    const expiredLink = 'http://localhost:3000/verify?token=expired-token';
    await page.goto(expiredLink);

    // 验证显示过期提示
    await expect(page.locator('[data-testid="error-message"]'))
      .toContainText('验证链接已过期');

    // 验证可以重新发送验证邮件
    await page.click('[data-testid="resend-verification"]');
    await expect(page.locator('[data-testid="success-message"]'))
      .toContainText('验证邮件已重新发送');
  });
});
```

### 工作流管理界面测试

```javascript
test.describe('Workflow Management', () => {
  test.beforeEach(async ({ page }) => {
    // 登录管理员账户
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'admin@example.com');
    await page.fill('[data-testid="password"]', 'adminpass');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('/admin');
  });

  test('should create and execute workflow', async ({ page }) => {
    // 进入工作流管理页面
    await page.goto('/admin/workflows');

    // 点击创建工作流按钮
    await page.click('[data-testid="create-workflow-button"]');

    // 填写工作流基本信息
    await page.fill('[data-testid="workflow-name"]', '测试工作流');
    await page.fill('[data-testid="workflow-description"]', '用于端到端测试的工作流');

    // 添加任务
    await page.click('[data-testid="add-task-button"]');

    // 配置第一个任务
    await page.fill('[data-testid="task-0-name"]', '发送通知');
    await page.selectOption('[data-testid="task-0-type"]', 'http');
    await page.selectOption('[data-testid="task-0-method"]', 'POST');
    await page.fill('[data-testid="task-0-url"]', 'http://api.example.com/notify');

    // 添加第二个任务
    await page.click('[data-testid="add-task-button"]');
    await page.fill('[data-testid="task-1-name"]', '更新数据库');
    await page.selectOption('[data-testid="task-1-type"]', 'script');
    await page.fill('[data-testid="task-1-script"]',
      'await database.update({ status: "completed" })');

    // 设置任务依赖
    await page.click('[data-testid="task-1-depends-0"]'); // 任务1依赖任务0

    // 保存工作流
    await page.click('[data-testid="save-workflow-button"]');

    // 验证工作流创建成功
    await expect(page.locator('[data-testid="workflow-list"]'))
      .toContainText('测试工作流');

    // 执行工作流
    await page.click('[data-testid="execute-workflow-button"]');

    // 等待执行完成
    await page.waitForSelector('[data-testid="execution-completed"]');

    // 验证执行结果
    await expect(page.locator('[data-testid="task-0-status"]'))
      .toContainText('完成');
    await expect(page.locator('[data-testid="task-1-status"]'))
      .toContainText('完成');

    // 检查执行日志
    await page.click('[data-testid="view-logs-button"]');
    await expect(page.locator('[data-testid="execution-log"]'))
      .toContainText('工作流执行成功');
  });

  test('should handle workflow execution failures', async ({ page }) => {
    // 创建会失败的工作流
    await page.goto('/admin/workflows');
    await page.click('[data-testid="create-workflow-button"]');

    await page.fill('[data-testid="workflow-name"]', '失败测试工作流');
    await page.fill('[data-testid="workflow-description"]', '测试工作流失败处理');

    // 添加会失败的任务
    await page.click('[data-testid="add-task-button"]');
    await page.fill('[data-testid="task-0-name"]', '调用失败API');
    await page.selectOption('[data-testid="task-0-type"]', 'http');
    await page.selectOption('[data-testid="task-0-method"]', 'GET');
    await page.fill('[data-testid="task-0-url"]', 'http://nonexistent-api.com/fail');

    await page.click('[data-testid="save-workflow-button"]');

    // 执行工作流
    await page.click('[data-testid="execute-workflow-button"]');

    // 等待执行失败
    await page.waitForSelector('[data-testid="execution-failed"]');

    // 验证失败状态
    await expect(page.locator('[data-testid="workflow-status"]'))
      .toContainText('失败');
    await expect(page.locator('[data-testid="task-0-status"]'))
      .toContainText('失败');

    // 检查错误详情
    await page.click('[data-testid="view-error-details"]');
    await expect(page.locator('[data-testid="error-message"]'))
      .toContainText('连接失败');

    // 验证重试功能
    await page.click('[data-testid="retry-workflow-button"]');
    await page.waitForSelector('[data-testid="execution-completed"]');

    // 验证重试成功（如果API恢复）
    // 注意：实际测试中可能需要mock API响应
  });

  test('should monitor workflow performance', async ({ page }) => {
    await page.goto('/admin/workflows');

    // 执行多个工作流
    for (let i = 0; i < 5; i++) {
      await page.click('[data-testid="execute-workflow-button"]');
      await page.waitForSelector('[data-testid="execution-completed"]');
    }

    // 检查性能指标
    await page.click('[data-testid="performance-tab"]');

    // 验证平均执行时间
    const avgTime = await page.locator('[data-testid="avg-execution-time"]').textContent();
    expect(parseFloat(avgTime)).toBeLessThan(5000); // 平均执行时间应小于5秒

    // 验证成功率
    const successRate = await page.locator('[data-testid="success-rate"]').textContent();
    expect(parseFloat(successRate)).toBeGreaterThan(95); // 成功率应大于95%

    // 检查资源使用情况
    await expect(page.locator('[data-testid="memory-usage"]'))
      .toContainText('MB'); // 应显示内存使用量
    await expect(page.locator('[data-testid="cpu-usage"]'))
      .toContainText('%'); // 应显示CPU使用率
  });
});
```

## ⚡ 性能测试

### 功能特性

- **负载测试**: 模拟高并发用户访问
- **压力测试**: 持续高负载下的系统表现
- **容量测试**: 确定系统最大承载能力
- **基准测试**: 与竞争产品进行性能对比
- **内存泄漏检测**: 长时间运行下的内存使用监控

### 负载测试配置

```javascript
// loadtest.config.js
export default {
  // 测试目标
  url: 'http://localhost:3000',

  // 并发用户数
  maxConcurrentUsers: 100,

  // 总请求数
  totalRequests: 10000,

  // 请求间隔 (毫秒)
  requestDelay: 100,

  // 测试持续时间 (分钟)
  duration: 5,

  // 渐进式负载
  rampUp: {
    enabled: true,
    duration: 60, // 1分钟内逐步增加到最大并发
  },

  // 断言条件
  assertions: {
    responseTime: {
      max: 2000, // 最大响应时间2秒
    },
    errorRate: {
      max: 0.05, // 最大错误率5%
    },
    throughput: {
      min: 50, // 最小每秒请求数
    }
  }
};
```

### API 性能测试

```javascript
import { check } from 'k6';
import http from 'k6/http';

export let options = {
  stages: [
    { duration: '1m', target: 10 },   // 1分钟内增加到10用户
    { duration: '3m', target: 50 },   // 3分钟内增加到50用户
    { duration: '1m', target: 100 },  // 1分钟内增加到100用户
    { duration: '2m', target: 100 },  // 保持100用户2分钟
    { duration: '1m', target: 0 },    // 1分钟内降到0用户
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95%的请求响应时间小于2秒
    http_req_failed: ['rate<0.05'],    // 错误率小于5%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  // 用户注册API测试
  const registerPayload = JSON.stringify({
    username: `user_${__VU}_${Date.now()}`, // 使用VU ID和时间戳保证唯一性
    email: `user_${__VU}_${Date.now()}@example.com`,
    password: 'password123'
  });

  const registerResponse = http.post(`${BASE_URL}/api/users`, registerPayload, {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  check(registerResponse, {
    'register status is 201': (r) => r.status === 201,
    'register response time < 1000ms': (r) => r.timings.duration < 1000,
    'register response has user id': (r) => r.json().hasOwnProperty('id'),
  });

  // 用户登录API测试
  const loginPayload = JSON.stringify({
    email: `user_${__VU}_${Date.now()}@example.com`,
    password: 'password123'
  });

  const loginResponse = http.post(`${BASE_URL}/api/auth/login`, loginPayload, {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  check(loginResponse, {
    'login status is 200': (r) => r.status === 200,
    'login response time < 500ms': (r) => r.timings.duration < 500,
    'login response has token': (r) => r.json().hasOwnProperty('token'),
  });

  const token = loginResponse.json().token;

  // 获取用户信息API测试
  const userResponse = http.get(`${BASE_URL}/api/users/profile`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  check(userResponse, {
    'get profile status is 200': (r) => r.status === 200,
    'get profile response time < 300ms': (r) => r.timings.duration < 300,
  });

  // 模拟用户思考时间
  const thinkingTime = Math.random() * 1000 + 500; // 500ms 到 1500ms 之间
  sleep(thinkingTime / 1000);
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'performance-report.json': JSON.stringify(data, null, 2),
    'performance-report.html': htmlReport(data),
  };
}
```

### 数据库性能测试

```javascript
describe('Database Performance Tests', () => {
  let database;
  let testData;

  beforeAll(async () => {
    database = createDatabaseConnection();
    testData = await generateTestData(10000); // 生成10000条测试数据
  });

  afterAll(async () => {
    await database.close();
  });

  test('should handle high concurrency user queries', async () => {
    const startTime = Date.now();
    const promises = [];

    // 并发执行100个查询
    for (let i = 0; i < 100; i++) {
      promises.push(database.users.findById(testData[i].id));
    }

    const results = await Promise.all(promises);
    const duration = Date.now() - startTime;

    // 验证所有查询成功
    expect(results.length).toBe(100);
    results.forEach(result => {
      expect(result).toBeDefined();
    });

    // 验证性能
    expect(duration).toBeLessThan(5000); // 5秒内完成
    console.log(`100 concurrent queries took ${duration}ms`);
  });

  test('should handle bulk insert operations', async () => {
    const bulkData = generateBulkInsertData(1000);

    const startTime = Date.now();
    const result = await database.users.insertMany(bulkData);
    const duration = Date.now() - startTime;

    expect(result.insertedCount).toBe(1000);
    expect(duration).toBeLessThan(10000); // 10秒内完成

    console.log(`Bulk insert of 1000 records took ${duration}ms`);
  });

  test('should maintain performance under sustained load', async () => {
    const durations = [];

    // 持续运行5分钟
    const endTime = Date.now() + 5 * 60 * 1000;

    while (Date.now() < endTime) {
      const startTime = Date.now();

      // 执行一个典型的查询
      await database.users.find({ status: 'active' }).limit(100);

      const duration = Date.now() - startTime;
      durations.push(duration);

      // 短暂休息，避免过度负载
      await sleep(100);
    }

    // 分析性能数据
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const maxDuration = Math.max(...durations);
    const p95Duration = calculatePercentile(durations, 95);

    console.log(`Performance over 5 minutes:
      Average: ${avgDuration}ms
      Max: ${maxDuration}ms
      95th percentile: ${p95Duration}ms`);

    // 验证性能稳定
    expect(avgDuration).toBeLessThan(200);
    expect(p95Duration).toBeLessThan(500);
    expect(maxDuration).toBeLessThan(2000);
  });

  test('should handle complex queries efficiently', async () => {
    // 创建复合索引（如果需要）
    await database.users.createIndex({
      status: 1,
      createdAt: -1,
      department: 1
    });

    const queries = [
      { status: 'active' },
      { department: 'IT', status: 'active' },
      { createdAt: { $gte: new Date('2024-01-01') } },
      {
        $and: [
          { department: 'IT' },
          { status: 'active' },
          { createdAt: { $gte: new Date('2024-01-01') } }
        ]
      }
    ];

    for (const query of queries) {
      const startTime = Date.now();
      const result = await database.users.find(query).explain('executionStats');
      const duration = Date.now() - startTime;

      console.log(`Query: ${JSON.stringify(query)}
        Execution time: ${duration}ms
        Documents examined: ${result.executionStats.totalDocsExamined}
        Documents returned: ${result.executionStats.totalDocsReturned}`);

      // 验证查询性能
      expect(duration).toBeLessThan(1000);
      expect(result.executionStats.totalDocsExamined).toBeLessThan(10000);
    }
  });

  function calculatePercentile(values, percentile) {
    const sorted = values.sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index];
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
});
```

## 🔒 安全测试

### 功能特性

- **身份验证测试**: 登录、注册、密码重置
- **授权测试**: 角色权限、访问控制
- **输入验证测试**: SQL注入、XSS、CSRF
- **加密测试**: 密码哈希、数据加密
- **会话管理测试**: 会话固定、并发登录

### 身份验证安全测试

```javascript
describe('Authentication Security Tests', () => {
  let app;
  let agent;

  beforeAll(async () => {
    app = createTestApp();
    agent = request.agent(app);
  });

  test('should prevent brute force attacks', async () => {
    const email = 'victim@example.com';
    const wrongPassword = 'wrongpassword';

    // 尝试多次错误登录
    for (let i = 0; i < 10; i++) {
      const response = await agent
        .post('/api/auth/login')
        .send({ email, password: wrongPassword })
        .expect(401);

      // 前几次应该返回正常错误
      if (i < 5) {
        expect(response.body.message).toBe('Invalid credentials');
      } else {
        // 之后应该被限流
        expect(response.status).toBe(429); // Too Many Requests
        expect(response.body.message).toContain('Too many failed attempts');
      }
    }
  });

  test('should handle password reset securely', async () => {
    const email = 'user@example.com';

    // 请求密码重置
    const resetResponse = await agent
      .post('/api/auth/forgot-password')
      .send({ email })
      .expect(200);

    expect(resetResponse.body.message).toContain('Reset email sent');

    // 验证重置令牌
    const resetToken = await getResetTokenFromEmail(email); // 从邮件中提取令牌
    expect(resetToken).toBeDefined();

    // 使用令牌重置密码
    const newPassword = 'newSecurePassword123!';
    await agent
      .post('/api/auth/reset-password')
      .send({
        token: resetToken,
        password: newPassword,
        confirmPassword: newPassword
      })
      .expect(200);

    // 验证新密码可以登录
    const loginResponse = await agent
      .post('/api/auth/login')
      .send({ email, password: newPassword })
      .expect(200);

    expect(loginResponse.body.token).toBeDefined();

    // 验证旧令牌失效
    await agent
      .post('/api/auth/reset-password')
      .send({
        token: resetToken, // 使用已使用的令牌
        password: 'anotherPassword123!',
        confirmPassword: 'anotherPassword123!'
      })
      .expect(400);
  });

  test('should prevent session fixation attacks', async () => {
    // 用户1登录
    const login1 = await agent
      .post('/api/auth/login')
      .send({ email: 'user1@example.com', password: 'password1' });

    const sessionId1 = login1.body.sessionId;

    // 模拟会话固定攻击：攻击者设置sessionId
    const fixedSessionId = 'fixed-session-id-12345';

    // 攻击者诱导用户使用固定sessionId登录
    const login2 = await request(app)
      .post('/api/auth/login')
      .set('Cookie', `sessionId=${fixedSessionId}`)
      .send({ email: 'user2@example.com', password: 'password2' });

    // 系统应该生成新的sessionId，而不是使用攻击者提供的
    expect(login2.body.sessionId).not.toBe(fixedSessionId);
    expect(login2.body.sessionId).toBeDefined();
  });

  test('should handle concurrent login sessions', async () => {
    const email = 'user@example.com';
    const password = 'password123';
    const maxSessions = 3; // 假设最大允许3个并发会话

    // 创建多个并发会话
    const loginPromises = [];
    for (let i = 0; i < maxSessions + 2; i++) {
      loginPromises.push(
        request(app)
          .post('/api/auth/login')
          .send({ email, password })
      );
    }

    const responses = await Promise.all(loginPromises);

    // 前maxSessions个应该成功
    for (let i = 0; i < maxSessions; i++) {
      expect(responses[i].status).toBe(200);
      expect(responses[i].body.token).toBeDefined();
    }

    // 超出限制的应该失败
    for (let i = maxSessions; i < responses.length; i++) {
      expect(responses[i].status).toBe(403);
      expect(responses[i].body.message).toContain('Maximum sessions exceeded');
    }
  });

  test('should validate JWT token integrity', async () => {
    // 登录获取有效令牌
    const loginResponse = await agent
      .post('/api/auth/login')
      .send({ email: 'user@example.com', password: 'password123' })
      .expect(200);

    const validToken = loginResponse.body.token;

    // 篡改令牌
    const tamperedToken = tamperWithJWT(validToken);

    // 使用篡改的令牌访问受保护资源
    await agent
      .get('/api/users/profile')
      .set('Authorization', `Bearer ${tamperedToken}`)
      .expect(401);

    // 验证错误消息
    const errorResponse = await agent
      .get('/api/users/profile')
      .set('Authorization', `Bearer ${tamperedToken}`);

    expect(errorResponse.body.message).toContain('Invalid token');
  });

  test('should implement secure logout', async () => {
    // 登录
    const loginResponse = await agent
      .post('/api/auth/login')
      .send({ email: 'user@example.com', password: 'password123' })
      .expect(200);

    const token = loginResponse.body.token;
    const sessionId = loginResponse.body.sessionId;

    // 验证令牌有效
    await agent
      .get('/api/users/profile')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    // 登出
    await agent
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    // 验证令牌已失效
    await agent
      .get('/api/users/profile')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);

    // 验证会话已清理
    const sessionCheck = await app.locals.sessionStore.get(sessionId);
    expect(sessionCheck).toBeNull();
  });
});

// 辅助函数
function tamperWithJWT(token) {
  // 简单的令牌篡改：修改payload部分
  const parts = token.split('.');
  if (parts.length !== 3) return token;

  const header = parts[0];
  const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());

  // 修改用户角色
  payload.role = 'admin';

  const tamperedPayload = Buffer.from(JSON.stringify(payload)).toString('base64');
  const tamperedToken = `${header}.${tamperedPayload}.${parts[2]}`;

  return tamperedToken;
}

async function getResetTokenFromEmail(email) {
  // 在测试环境中，从内存队列或数据库中获取重置令牌
  // 实际实现取决于邮件服务和测试环境设置
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve('test-reset-token-12345');
    }, 100);
  });
}
```

### 输入验证安全测试

```javascript
describe('Input Validation Security Tests', () => {
  let app;

  beforeAll(async () => {
    app = createTestApp();
  });

  describe('SQL Injection Prevention', () => {
    test('should prevent SQL injection in login', async () => {
      const maliciousInputs = [
        "' OR '1'='1",
        "'; DROP TABLE users; --",
        "' UNION SELECT * FROM users --",
        "admin' --",
        "' OR 1=1 --"
      ];

      for (const maliciousInput of maliciousInputs) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: maliciousInput,
            password: 'password123'
          })
          .expect(401);

        // 应该只是认证失败，而不是SQL错误
        expect(response.body.message).toBe('Invalid credentials');
        expect(response.body.message).not.toContain('SQL');
        expect(response.body.message).not.toContain('syntax');
      }
    });

    test('should prevent SQL injection in user search', async () => {
      const maliciousQueries = [
        "'; DROP TABLE users; --",
        "' UNION SELECT password FROM users --",
        "1' OR '1'='1",
        "admin'; UPDATE users SET role='admin"
      ];

      for (const maliciousQuery of maliciousQueries) {
        const response = await request(app)
          .get('/api/users/search')
          .query({ q: maliciousQuery })
          .expect(200);

        // 验证没有发生SQL注入
        expect(response.body).toBeDefined();
        // 检查响应不包含敏感信息
        expect(response.body).not.toHaveProperty('password');
      }
    });
  });

  describe('XSS Prevention', () => {
    test('should sanitize HTML input', async () => {
      const xssPayloads = [
        '<script>alert("XSS")</script>',
        '<img src=x onerror=alert("XSS")>',
        'javascript:alert("XSS")',
        '<iframe src="javascript:alert(\'XSS\')"></iframe>',
        '<svg onload=alert("XSS")>'
      ];

      for (const payload of xssPayloads) {
        // 创建用户时尝试注入XSS
        const response = await request(app)
          .post('/api/users')
          .send({
            username: 'testuser',
            email: 'test@example.com',
            password: 'password123',
            bio: payload // 尝试在bio字段注入XSS
          })
          .expect(201);

        // 获取用户信息
        const profileResponse = await request(app)
          .get(`/api/users/${response.body.id}`)
          .expect(200);

        // 验证XSS代码已被转义或过滤
        const bio = profileResponse.body.bio;
        expect(bio).not.toContain('<script>');
        expect(bio).not.toContain('javascript:');
        expect(bio).not.toContain('onerror');
        expect(bio).not.toContain('onload');
      }
    });

    test('should prevent XSS in query parameters', async () => {
      const xssParams = [
        '<script>alert("XSS")</script>',
        '"><script>alert("XSS")</script>',
        'javascript:alert("XSS")'
      ];

      for (const param of xssParams) {
        const response = await request(app)
          .get('/api/search')
          .query({ q: param })
          .expect(200);

        // 验证响应不包含可执行的XSS代码
        expect(response.text).not.toContain('<script>');
        expect(response.text).not.toContain('javascript:');
      }
    });
  });

  describe('CSRF Protection', () => {
    test('should require CSRF token for state-changing operations', async () => {
      // 登录获取会话
      const agent = request.agent(app);
      await agent
        .post('/api/auth/login')
        .send({ email: 'user@example.com', password: 'password123' })
        .expect(200);

      // 尝试没有CSRF令牌的POST请求
      await agent
        .post('/api/users/profile')
        .send({ bio: 'Updated bio' })
        .expect(403);

      // 获取CSRF令牌
      const csrfResponse = await agent
        .get('/api/csrf-token')
        .expect(200);

      const csrfToken = csrfResponse.body.token;

      // 使用CSRF令牌的请求应该成功
      await agent
        .post('/api/users/profile')
        .set('X-CSRF-Token', csrfToken)
        .send({ bio: 'Updated bio' })
        .expect(200);
    });

    test('should validate CSRF token integrity', async () => {
      const agent = request.agent(app);
      await agent
        .post('/api/auth/login')
        .send({ email: 'user@example.com', password: 'password123' })
        .expect(200);

      // 使用无效的CSRF令牌
      await agent
        .post('/api/users/profile')
        .set('X-CSRF-Token', 'invalid-csrf-token')
        .send({ bio: 'Updated bio' })
        .expect(403);

      // 使用过期的CSRF令牌
      const expiredToken = generateExpiredCSRFToken();
      await agent
        .post('/api/users/profile')
        .set('X-CSRF-Token', expiredToken)
        .send({ bio: 'Updated bio' })
        .expect(403);
    });
  });

  describe('File Upload Security', () => {
    test('should validate file types', async () => {
      const maliciousFiles = [
        { name: 'malicious.exe', type: 'application/x-msdownload' },
        { name: 'script.php', type: 'application/x-php' },
        { name: 'webshell.jsp', type: 'application/jsp' },
        { name: 'malicious.html', type: 'text/html' }
      ];

      for (const file of maliciousFiles) {
        const response = await request(app)
          .post('/api/upload')
          .attach('file', Buffer.from('malicious content'), file)
          .expect(400);

        expect(response.body.message).toContain('File type not allowed');
      }
    });

    test('should prevent directory traversal', async () => {
      const traversalAttempts = [
        '../../../../etc/passwd',
        '..\\..\\..\\..\\windows\\system32\\config\\sam',
        '....//....//....//etc/passwd',
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd'
      ];

      for (const path of traversalAttempts) {
        const response = await request(app)
          .post('/api/upload')
          .attach('file', Buffer.from('test content'), {
            filename: path,
            contentType: 'text/plain'
          })
          .expect(400);

        expect(response.body.message).toContain('Invalid filename');
      }
    });

    test('should limit file size', async () => {
      // 创建超过限制的文件 (假设限制是5MB)
      const largeFile = Buffer.alloc(6 * 1024 * 1024); // 6MB

      const response = await request(app)
        .post('/api/upload')
        .attach('file', largeFile, 'large-file.txt')
        .expect(413); // Payload Too Large

      expect(response.body.message).toContain('File too large');
    });

    test('should scan for malware', async () => {
      // 创建包含恶意签名的文件
      const maliciousContent = Buffer.from('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*');

      const response = await request(app)
        .post('/api/upload')
        .attach('file', maliciousContent, 'eicar.txt')
        .expect(400);

      expect(response.body.message).toContain('Malware detected');
    });
  });

  describe('Rate Limiting', () => {
    test('should enforce API rate limits', async () => {
      const endpoint = '/api/users/search';
      const requests = [];

      // 发送大量请求
      for (let i = 0; i < 150; i++) { // 假设限制是每分钟100次
        requests.push(
          request(app)
            .get(endpoint)
            .query({ q: 'test' })
        );
      }

      const responses = await Promise.all(requests);

      // 计算成功和失败的请求数
      const successCount = responses.filter(r => r.status === 200).length;
      const rateLimitedCount = responses.filter(r => r.status === 429).length;

      expect(successCount).toBeGreaterThan(0);
      expect(rateLimitedCount).toBeGreaterThan(0);
      expect(successCount + rateLimitedCount).toBe(150);
    });

    test('should differentiate rate limits by endpoint', async () => {
      // 对不同的端点应该有不同的限制
      const endpoints = [
        { path: '/api/auth/login', limit: 5 },     // 登录限制严格
        { path: '/api/users/search', limit: 100 }, // 搜索限制宽松
        { path: '/api/data/export', limit: 10 }    // 导出限制中等
      ];

      for (const { path, limit } of endpoints) {
        const requests = [];

        // 发送超出限制的请求
        for (let i = 0; i < limit + 5; i++) {
          if (path === '/api/auth/login') {
            requests.push(
              request(app)
                .post(path)
                .send({ email: 'test@example.com', password: 'wrong' })
            );
          } else {
            requests.push(request(app).get(path));
          }
        }

        const responses = await Promise.all(requests);

        // 前limit个请求应该成功，最后几个应该被限流
        const successCount = responses.filter(r => r.status !== 429).length;
        const rateLimitedCount = responses.filter(r => r.status === 429).length;

        expect(successCount).toBe(limit);
        expect(rateLimitedCount).toBe(5);
      }
    });
  });
});
```

## 📊 测试报告和分析

### 测试报告生成

```javascript
// vitest.config.js - 测试报告配置
import { defineConfig } from 'vitest/config';
import { coverageConfigDefaults } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'istanbul',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        'test/',
        '**/*.config.js',
        '**/*.d.ts'
      ],
      thresholds: {
        global: {
          statements: 80,
          branches: 75,
          functions: 85,
          lines: 80
        },
        './src/core/': {
          statements: 90,
          branches: 85,
          functions: 95,
          lines: 90
        }
      },
      reportsDirectory: './coverage'
    },
    reporters: [
      'default',
      'json',
      'junit', // CI/CD 工具支持
      'html'
    ],
    outputFile: {
      json: './test-results/test-results.json',
      junit: './test-results/junit.xml'
    }
  }
});
```

### 质量门禁配置

```javascript
// quality-gate.config.js
export default {
  // 覆盖率门禁
  coverage: {
    global: {
      statements: 80,
      branches: 75,
      functions: 85,
      lines: 80
    },
    // 核心模块要求更高
    './src/core/': {
      statements: 90,
      branches: 85,
      functions: 95,
      lines: 90
    }
  },

  // 性能门禁
  performance: {
    maxResponseTime: 2000,    // 最大响应时间 (ms)
    maxMemoryUsage: 512,      // 最大内存使用 (MB)
    maxCpuUsage: 80,          // 最大CPU使用率 (%)
    minThroughput: 100        // 最小吞吐量 (req/sec)
  },

  // 安全门禁
  security: {
    maxVulnerabilities: 0,    // 允许的最大漏洞数
    maxSeverity: 'medium',    // 允许的最大漏洞严重程度
    requiredHeaders: [        // 必需的安全头
      'X-Content-Type-Options',
      'X-Frame-Options',
      'X-XSS-Protection',
      'Strict-Transport-Security'
    ]
  },

  // 代码质量门禁
  codeQuality: {
    maxComplexity: 10,        // 最大圈复杂度
    maxLinesPerFunction: 50,  // 函数最大行数
    maxParameters: 4,         // 函数最大参数数
    requireJSDoc: true        // 要求JSDoc注释
  }
};
```

### 持续集成集成

```yaml
# .github/workflows/ci.yml
name: CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [16.x, 18.x, 20.x]

    steps:
    - uses: actions/checkout@v3

    - name: Use Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v3
      with:
        node-version: ${{ matrix.node-version }}
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Run linting
      run: npm run lint

    - name: Run unit tests
      run: npm run test:unit

    - name: Run integration tests
      run: npm run test:integration

    - name: Run security tests
      run: npm run test:security

    - name: Generate coverage report
      run: npm run test:coverage

    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage/lcov.info

    - name: Run performance tests
      run: npm run test:performance

    - name: Quality gate check
      run: npm run quality:check

  e2e:
    runs-on: ubuntu-latest
    needs: test

    steps:
    - uses: actions/checkout@v3

    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: 18.x
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Start test environment
      run: |
        docker-compose -f docker-compose.test.yml up -d
        npm run wait-for-services

    - name: Run E2E tests
      run: npm run test:e2e

    - name: Upload test artifacts
      uses: actions/upload-artifact@v3
      if: failure()
      with:
        name: e2e-screenshots
        path: test-results/screenshots/

  security:
    runs-on: ubuntu-latest
    needs: test

    steps:
    - uses: actions/checkout@v3

    - name: Run security audit
      run: npm run security:audit

    - name: Run dependency vulnerability scan
      run: npm run security:scan

    - name: Upload security report
      uses: actions/upload-artifact@v3
      with:
        name: security-report
        path: security-report.json

  deploy:
    runs-on: ubuntu-latest
    needs: [test, e2e, security]
    if: github.ref == 'refs/heads/main'

    steps:
    - name: Deploy to staging
      run: npm run deploy:staging

    - name: Run smoke tests
      run: npm run test:smoke

    - name: Deploy to production
      run: npm run deploy:production

    - name: Run production verification
      run: npm run verify:deployment
```

## 🎯 测试最佳实践

### 测试组织结构

```
tests/
├── unit/                          # 单元测试
│   ├── core/                     # 核心模块测试
│   │   ├── http.test.js
│   │   ├── auth.test.js
│   │   ├── state.test.js
│   │   └── queue.test.js
│   ├── services/                 # 服务层测试
│   │   ├── userService.test.js
│   │   └── workflowEngine.test.js
│   └── utils/                    # 工具函数测试
│       ├── date.test.js
│       └── validation.test.js
├── integration/                  # 集成测试
│   ├── api/                      # API集成测试
│   │   ├── users.test.js
│   │   └── workflows.test.js
│   ├── database/                 # 数据库集成测试
│   └── messaging/                # 消息队列集成测试
├── e2e/                         # 端到端测试
│   ├── user-registration.spec.js
│   ├── workflow-management.spec.js
│   └── admin-dashboard.spec.js
├── performance/                  # 性能测试
│   ├── load/                     # 负载测试
│   ├── stress/                   # 压力测试
│   └── benchmark/                # 基准测试
├── security/                     # 安全测试
│   ├── authentication.test.js
│   ├── authorization.test.js
│   ├── input-validation.test.js
│   └── rate-limiting.test.js
├── fixtures/                     # 测试数据
│   ├── users.json
│   ├── workflows.json
│   └── sample-data.sql
├── utils/                        # 测试工具
│   ├── test-helpers.js
│   ├── mock-data.js
│   └── database-helpers.js
└── config/                       # 测试配置
    ├── vitest.config.js
    ├── playwright.config.js
    └── testcontainers.config.js
```

### 测试命名约定

```javascript
// 单元测试文件命名
// [模块名].test.js 或 [模块名].spec.js
// 例如：userService.test.js, httpClient.test.js

// 测试用例命名
describe('UserService', () => {
  describe('createUser', () => {
    it('should create user successfully', () => {
      // 测试实现
    });

    it('should throw error for duplicate email', () => {
      // 测试实现
    });

    it('should validate required fields', () => {
      // 测试实现
    });
  });
});
```

### Mock 和测试数据管理

```javascript
// tests/utils/mock-data.js
export const mockUsers = {
  activeUser: {
    id: 'user_123',
    username: 'johndoe',
    email: 'john@example.com',
    role: 'user',
    status: 'active',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  },

  adminUser: {
    id: 'user_456',
    username: 'admin',
    email: 'admin@example.com',
    role: 'admin',
    status: 'active',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  }
};

export const mockWorkflows = {
  simpleWorkflow: {
    id: 'workflow_123',
    name: 'Simple Workflow',
    tasks: [
      {
        id: 'task_1',
        name: 'Send Email',
        type: 'http',
        status: 'pending'
      }
    ],
    status: 'created',
    createdAt: new Date('2024-01-01')
  }
};

// tests/utils/test-helpers.js
export function createMockDatabase() {
  return {
    users: {
      findById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      find: vi.fn()
    },
    workflows: {
      findById: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    }
  };
}

export function createMockHttpClient() {
  return {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() }
    }
  };
}

export async function setupTestDatabase() {
  const database = createMockDatabase();

  // 设置默认行为
  database.users.findById.mockResolvedValue(null);
  database.workflows.findById.mockResolvedValue(null);

  return database;
}
```

### 测试执行优化

```javascript
// vitest.config.js - 优化配置
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // 并行执行
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        useAtomics: true
      }
    },

    // 按文件大小排序，先执行快的测试
    sequence: {
      sequencer: (tests) => {
        return tests.sort((a, b) => {
          // 简单的启发式：更小的文件可能更快
          return a.filepath.length - b.filepath.length;
        });
      }
    },

    // 全局测试超时
    testTimeout: 10000,

    // Hook 超时
    hookTimeout: 20000,

    // 重试失败的测试
    retry: 2,

    // 检测内存泄漏
    detectOpenHandles: true,

    // 检测内存泄漏（实验性）
    // detectMemoryLeaks: true,

    // 隔离测试环境
    isolate: true,

    // 全局设置
    globals: true,

    // 环境变量
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/testdb'
    }
  }
});
```

## 📚 总结

frys 的测试架构采用全面的分层测试策略，确保代码质量和系统稳定性：

### 测试层次覆盖
- **单元测试**: 验证核心逻辑的正确性
- **集成测试**: 确保模块间协作正常
- **端到端测试**: 验证完整用户流程
- **性能测试**: 保证系统性能表现
- **安全测试**: 防范安全漏洞风险

### 质量保障措施
- 自动化测试执行和报告生成
- 代码覆盖率监控和门禁设置
- 持续集成中的质量检查
- 性能基准和安全扫描

### 最佳实践
- 测试驱动开发 (TDD)
- 行为驱动测试 (BDD)
- Mock 和 Stub 的合理使用
- 测试数据管理和清理
- 并行测试执行优化

通过完善的测试体系，frys 确保了系统的可靠性、可维护性和安全性，为生产环境的使用提供了坚实的质量保障。
