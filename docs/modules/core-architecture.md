# WokeFlow 核心架构

## 📖 概述

WokeFlow 的核心架构基于"站在巨人肩膀上"的理念，集成业界领先的开源解决方案，构建高性能、可扩展的企业级应用框架。

### 🎯 架构设计原则

- **开源优先**: 集成成熟的开源组件而非重新发明
- **模块化设计**: 高内聚、低耦合的架构模式
- **依赖注入**: 解耦组件间的依赖关系
- **插件化扩展**: 支持运行时动态功能扩展
- **可观测性**: 内置监控、日志和错误追踪

### 🏗️ 核心组件架构

```
核心架构层
├── 💉 依赖注入容器 (Awilix)
│   ├── 服务注册和解析
│   ├── 生命周期管理
│   ├── 自动依赖注入
│   ├── 作用域管理
│   └── 类型安全支持
├── 🔌 插件管理系统 (fastify-plugin)
│   ├── 插件封装和隔离
│   ├── 装饰器模式支持
│   ├── 钩子机制集成
│   ├── 插件依赖管理
│   └── 运行时扩展
└── 🐛 错误监控系统 (Sentry)
    ├── 实时错误捕获
    ├── 性能监控和追踪
    ├── 分布式追踪支持
    ├── 用户反馈收集
    └── 版本管理和部署追踪
```

## 💉 依赖注入容器 (Awilix)

### 功能特性

- **服务注册**: 支持多种注册方式（类、函数、值）
- **自动解析**: 基于构造函数参数的自动依赖解析
- **生命周期管理**: 单例、作用域、瞬时等生命周期
- **模块化支持**: 支持按模块加载和卸载服务
- **TypeScript友好**: 完整的类型推断和检查
- **运行时替换**: 支持测试时的服务替换

### 快速开始

```javascript
import { createContainer, asClass, asFunction, asValue } from 'awilix';

// 创建容器
const container = createContainer();

// 注册服务 - 类方式
container.register({
  userService: asClass(UserService).scoped(),
  emailService: asClass(EmailService).singleton(),
  config: asValue({
    smtp: { host: 'smtp.example.com' },
    jwt: { secret: 'your-secret' }
  }),
  logger: asFunction(() => createLogger()).singleton()
});

// 解析服务
const userService = container.resolve('userService');
```

### 服务注册方式

#### 类注册 (asClass)

```javascript
class DatabaseService {
  constructor({ config, logger }) {
    this.config = config;
    this.logger = logger;
  }

  async connect() {
    this.logger.info('Connecting to database...');
    // 数据库连接逻辑
  }
}

// 注册为单例
container.register({
  databaseService: asClass(DatabaseService).singleton()
});

// 注册为作用域实例
container.register({
  requestContext: asClass(RequestContext).scoped()
});
```

#### 函数注册 (asFunction)

```javascript
// 工厂函数
function createRedisClient({ config }) {
  return new Redis({
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password
  });
}

// 注册函数
container.register({
  redisClient: asFunction(createRedisClient).singleton()
});
```

#### 值注册 (asValue)

```javascript
// 配置对象
const config = {
  app: {
    port: 3000,
    name: 'WokeFlow'
  },
  database: {
    url: 'postgresql://localhost:5432/wokeflow'
  }
};

// 注册值
container.register({
  config: asValue(config)
});
```

### 生命周期管理

#### 单例模式 (singleton)

```javascript
class CacheService {
  constructor() {
    this.cache = new Map();
  }

  set(key, value) {
    this.cache.set(key, value);
  }

  get(key) {
    return this.cache.get(key);
  }
}

// 单例注册 - 整个应用共享同一个实例
container.register({
  cacheService: asClass(CacheService).singleton()
});
```

#### 作用域模式 (scoped)

```javascript
class RequestContext {
  constructor({ userId, requestId }) {
    this.userId = userId;
    this.requestId = requestId;
    this.startTime = Date.now();
  }
}

// 作用域注册 - 每个请求一个实例
container.register({
  requestContext: asClass(RequestContext).scoped()
});
```

#### 瞬时模式 (transient)

```javascript
class ValidationService {
  validate(data, rules) {
    // 验证逻辑
    return { isValid: true, errors: [] };
  }
}

// 瞬时注册 - 每次解析都创建新实例
container.register({
  validationService: asClass(ValidationService).transient()
});
```

### 自动依赖注入

```javascript
class UserController {
  constructor({ userService, authService, logger }) {
    this.userService = userService;
    this.authService = authService;
    this.logger = logger;
  }

  async createUser(req, res) {
    try {
      const userData = req.body;
      const user = await this.userService.createUser(userData);

      this.logger.info('User created', { userId: user.id });

      res.status(201).json(user);
    } catch (error) {
      this.logger.error('Failed to create user', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  }
}

// 注册控制器 - 依赖会自动注入
container.register({
  userController: asClass(UserController).scoped()
});
```

### 高级用法

#### 模块化注册

```javascript
// userModule.js
export function registerUserModule(container) {
  container.register({
    userRepository: asClass(UserRepository).singleton(),
    userService: asClass(UserService).scoped(),
    userController: asClass(UserController).scoped()
  });
}

// workflowModule.js
export function registerWorkflowModule(container) {
  container.register({
    workflowRepository: asClass(WorkflowRepository).singleton(),
    workflowEngine: asClass(WorkflowEngine).scoped(),
    workflowController: asClass(WorkflowController).scoped()
  });
}

// 主应用
import { registerUserModule } from './modules/user';
import { registerWorkflowModule } from './modules/workflow';

const container = createContainer();

registerUserModule(container);
registerWorkflowModule(container);
```

#### 测试时的服务替换

```javascript
describe('UserService', () => {
  let container;
  let userService;
  let mockRepository;

  beforeEach(() => {
    container = createContainer();

    // 注册模拟服务
    mockRepository = {
      create: vi.fn(),
      findById: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    };

    container.register({
      userRepository: asValue(mockRepository),
      logger: asValue({ info: vi.fn(), error: vi.fn() }),
      userService: asClass(UserService).scoped()
    });

    userService = container.resolve('userService');
  });

  it('should create user successfully', async () => {
    const userData = { name: 'John', email: 'john@example.com' };
    const expectedUser = { id: 1, ...userData };

    mockRepository.create.mockResolvedValue(expectedUser);

    const result = await userService.createUser(userData);

    expect(result).toEqual(expectedUser);
    expect(mockRepository.create).toHaveBeenCalledWith(userData);
  });
});
```

### 性能优化

#### 懒加载

```javascript
// 使用代理进行懒加载
container.register({
  heavyService: asFunction(() => {
    // 只有在第一次访问时才创建实例
    return new HeavyService();
  }).singleton().proxy()
});
```

#### 服务缓存

```javascript
class ServiceCache {
  constructor(container) {
    this.container = container;
    this.cache = new Map();
  }

  get(serviceName) {
    if (!this.cache.has(serviceName)) {
      this.cache.set(serviceName, this.container.resolve(serviceName));
    }
    return this.cache.get(serviceName);
  }

  clear() {
    this.cache.clear();
  }
}
```

## 🔌 插件管理系统 (fastify-plugin)

### 功能特性

- **插件封装**: 支持插件的封装和复用
- **依赖管理**: 自动处理插件间的依赖关系
- **装饰器支持**: 扩展Fastify实例的功能
- **钩子机制**: 支持请求生命周期的钩子
- **错误隔离**: 插件错误不会影响其他插件

### 快速开始

```javascript
import fastify from 'fastify';
import fastifyPlugin from 'fastify-plugin';

// 创建插件
const authPlugin = fastifyPlugin(async (fastify, options) => {
  // 添加认证装饰器
  fastify.decorate('authenticate', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      throw new Error('No token provided');
    }

    try {
      const payload = fastify.jwt.verify(token);
      request.user = payload;
    } catch (error) {
      throw new Error('Invalid token');
    }
  });

  // 添加钩子
  fastify.addHook('preHandler', async (request, reply) => {
    if (request.routeOptions.config?.auth) {
      await fastify.authenticate(request, reply);
    }
  });
});

// 使用插件
const app = fastify();

await app.register(authPlugin, {
  secret: 'your-secret-key'
});

// 注册需要认证的路由
app.get('/protected', {
  config: { auth: true }
}, async (request, reply) => {
  return { user: request.user };
});
```

### 插件开发模式

#### 基础插件结构

```javascript
// myPlugin.js
import fp from 'fastify-plugin';

async function myPlugin(fastify, options) {
  // 插件初始化逻辑

  // 添加装饰器
  fastify.decorate('myUtility', function(param) {
    return `Processed: ${param}`;
  });

  // 添加钩子
  fastify.addHook('onRequest', async (request, reply) => {
    fastify.log.info(`Request: ${request.method} ${request.url}`);
  });

  // 添加路由
  fastify.get('/health', async (request, reply) => {
    return { status: 'ok', timestamp: new Date() };
  });

  // 清理逻辑
  fastify.addHook('onClose', async (instance) => {
    fastify.log.info('Plugin is shutting down');
    // 清理资源
  });
}

// 导出插件
export default fp(myPlugin, {
  name: 'my-plugin',
  version: '1.0.0',
  dependencies: ['fastify-jwt'], // 插件依赖
  decorators: ['jwt'], // 需要的前置装饰器
  hooks: ['onRequest', 'preHandler'] // 使用的钩子
});
```

#### 插件配置选项

```javascript
// 插件配置接口
interface PluginOptions {
  enabled?: boolean;
  priority?: number;
  config?: Record<string, any>;
}

// 带配置的插件
async function configurablePlugin(fastify, options) {
  const config = {
    enabled: true,
    priority: 0,
    ...options
  };

  if (!config.enabled) {
    fastify.log.info('Plugin is disabled');
    return;
  }

  // 根据配置初始化
  fastify.decorate('pluginConfig', config);

  // 使用配置
  if (config.priority > 0) {
    fastify.addHook('onRequest', { priority: config.priority }, async (request) => {
      // 高优先级处理
    });
  }
}

export default fp(configurablePlugin, {
  schema: {
    type: 'object',
    properties: {
      enabled: { type: 'boolean', default: true },
      priority: { type: 'number', default: 0 },
      config: { type: 'object' }
    }
  }
});
```

### 插件依赖管理

#### 显式依赖声明

```javascript
// authPlugin.js - 需要JWT支持
import fp from 'fastify-plugin';

async function authPlugin(fastify, options) {
  // 使用JWT装饰器
  fastify.decorate('verifyToken', (token) => {
    return fastify.jwt.verify(token);
  });
}

export default fp(authPlugin, {
  name: 'auth-plugin',
  dependencies: ['fastify-jwt'], // 显式声明依赖
  decorators: ['jwt'] // 需要的前置装饰器
});

// userPlugin.js - 使用认证插件
import fp from 'fastify-plugin';

async function userPlugin(fastify, options) {
  fastify.get('/users', {
    preHandler: fastify.auth([fastify.verifyToken])
  }, async (request, reply) => {
    // 处理用户请求
    return { users: [] };
  });
}

export default fp(userPlugin, {
  name: 'user-plugin',
  dependencies: ['auth-plugin'] // 依赖认证插件
});
```

#### 条件依赖

```javascript
// conditionalPlugin.js
import fp from 'fastify-plugin';

async function conditionalPlugin(fastify, options) {
  // 检查是否已安装可选依赖
  if (fastify.hasDecorator('cache')) {
    // 使用缓存功能
    fastify.decorate('cachedResponse', async (key, fn) => {
      let result = await fastify.cache.get(key);
      if (!result) {
        result = await fn();
        await fastify.cache.set(key, result);
      }
      return result;
    });
  } else {
    // 不使用缓存
    fastify.decorate('cachedResponse', async (key, fn) => {
      return await fn();
    });
  }
}

export default fp(conditionalPlugin, {
  name: 'conditional-plugin',
  dependencies: [], // 无强制依赖
  decorators: { // 可选装饰器
    cache: { optional: true }
  }
});
```

### 钩子机制

#### 请求生命周期钩子

```javascript
import fp from 'fastify-plugin';

async function lifecyclePlugin(fastify, options) {
  // onRequest - 请求开始
  fastify.addHook('onRequest', async (request, reply) => {
    request.startTime = process.hrtime.bigint();
    fastify.log.info(`Request started: ${request.method} ${request.url}`);
  });

  // preParsing - 解析前
  fastify.addHook('preParsing', async (request, reply, payload) => {
    // 可以修改请求体
    return payload;
  });

  // preValidation - 验证前
  fastify.addHook('preValidation', async (request, reply) => {
    // 预处理验证逻辑
  });

  // preHandler - 处理前
  fastify.addHook('preHandler', async (request, reply) => {
    // 权限检查、日志记录等
    await fastify.authenticate(request, reply);
  });

  // preSerialization - 序列化前
  fastify.addHook('preSerialization', async (request, reply, payload) => {
    // 修改响应数据
    return { ...payload, timestamp: new Date() };
  });

  // onResponse - 响应后
  fastify.addHook('onResponse', async (request, reply) => {
    const duration = Number(process.hrtime.bigint() - request.startTime) / 1e6;
    fastify.log.info(`Request completed in ${duration}ms`);
  });

  // onError - 错误处理
  fastify.addHook('onError', async (request, reply, error) => {
    fastify.log.error('Request error:', error);
    // 可以发送错误报告
  });

  // onClose - 应用关闭
  fastify.addHook('onClose', async (instance) => {
    fastify.log.info('Application is shutting down');
    // 清理资源
  });
}

export default fp(lifecyclePlugin);
```

#### 自定义钩子

```javascript
import fp from 'fastify-plugin';

async function customHooksPlugin(fastify, options) {
  // 添加自定义钩子
  fastify.addHook('userCreated', async (user) => {
    // 发送欢迎邮件
    await fastify.email.sendWelcome(user.email, user.name);

    // 记录用户创建事件
    await fastify.analytics.track('user.created', {
      userId: user.id,
      timestamp: new Date()
    });
  });

  // 在业务逻辑中触发钩子
  fastify.decorate('createUser', async (userData) => {
    const user = await fastify.userService.createUser(userData);

    // 触发自定义钩子
    await fastify.hooks.callHook('userCreated', user);

    return user;
  });
}

export default fp(customHooksPlugin);
```

### 插件测试

```javascript
import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import myPlugin from '../plugins/myPlugin.js';

describe('My Plugin', () => {
  let app;

  beforeEach(async () => {
    app = Fastify();
    await app.register(myPlugin, {
      option1: 'value1',
      option2: 'value2'
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it('should register routes', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health'
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toHaveProperty('status', 'ok');
  });

  it('should add decorators', async () => {
    expect(typeof app.myUtility).toBe('function');

    const result = app.myUtility('test');
    expect(result).toBe('Processed: test');
  });

  it('should handle plugin options', async () => {
    // 测试插件配置
    const response = await app.inject({
      method: 'GET',
      url: '/plugin-config'
    });

    const config = JSON.parse(response.payload);
    expect(config.option1).toBe('value1');
    expect(config.option2).toBe('value2');
  });
});
```

## 🐛 错误监控系统 (Sentry)

### 功能特性

- **自动错误捕获**: 捕获未处理的异常和Promise拒绝
- **性能监控**: 跟踪应用性能和用户体验
- **分布式追踪**: 支持微服务间的请求追踪
- **版本管理**: 关联错误与代码版本
- **用户反馈**: 收集用户错误报告

### 快速开始

```javascript
import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

// 初始化 Sentry
Sentry.init({
  dsn: 'your-dsn-here',
  environment: process.env.NODE_ENV || 'development',
  release: process.env.RELEASE_VERSION,
  integrations: [
    // HTTP调用集成
    Sentry.httpIntegration(),
    // 原生集成
    Sentry.nativeNodeFetchIntegration(),
    // 性能分析集成
    nodeProfilingIntegration()
  ],
  // 性能监控
  tracesSampleRate: 0.1, // 10% 的请求会被追踪
  profilesSampleRate: 0.1, // 10% 的性能分析
  // 错误采样
  sampleRate: 1.0, // 100% 的错误会被上报
  // 调试模式
  debug: process.env.NODE_ENV === 'development'
});

// 在应用入口处捕获未处理的错误
process.on('unhandledRejection', (reason, promise) => {
  Sentry.captureException(reason, {
    tags: { type: 'unhandledRejection' },
    extra: { promise }
  });
});

process.on('uncaughtException', (error) => {
  Sentry.captureException(error, {
    tags: { type: 'uncaughtException' }
  });
  process.exit(1);
});
```

### 错误捕获

#### 手动错误报告

```javascript
import * as Sentry from '@sentry/node';

class UserService {
  async createUser(userData) {
    try {
      // 业务逻辑
      const user = await this.userRepository.create(userData);

      // 记录成功操作
      Sentry.addBreadcrumb({
        category: 'user',
        message: 'User created successfully',
        level: 'info',
        data: { userId: user.id }
      });

      return user;
    } catch (error) {
      // 捕获业务错误
      Sentry.captureException(error, {
        tags: {
          service: 'userService',
          operation: 'createUser'
        },
        extra: {
          userData: JSON.stringify(userData),
          errorCode: error.code
        },
        user: {
          id: userData.email,
          email: userData.email
        }
      });

      throw error;
    }
  }
}
```

#### 上下文信息

```javascript
import * as Sentry from '@sentry/node';

// 设置全局上下文
Sentry.setContext('app', {
  version: process.env.APP_VERSION,
  environment: process.env.NODE_ENV,
  region: process.env.AWS_REGION
});

// 请求上下文
app.addHook('onRequest', async (request, reply) => {
  // 设置用户上下文
  if (request.user) {
    Sentry.setUser({
      id: request.user.id,
      email: request.user.email,
      username: request.user.username
    });
  }

  // 设置请求上下文
  Sentry.setContext('request', {
    url: request.url,
    method: request.method,
    headers: request.headers,
    ip: request.ip
  });

  // 设置标签
  Sentry.setTag('request_id', request.id);
  Sentry.setTag('user_agent', request.headers['user-agent']);
});
```

### 性能监控

#### 事务追踪

```javascript
import * as Sentry from '@sentry/node';

// 手动创建事务
const transaction = Sentry.startTransaction({
  name: 'user-registration',
  op: 'registration'
});

try {
  // 用户注册步骤
  Sentry.startSpan({ name: 'validate-email' }, async () => {
    await validateEmail(request.body.email);
  });

  Sentry.startSpan({ name: 'create-user' }, async () => {
    const user = await createUser(request.body);
    return user;
  });

  Sentry.startSpan({ name: 'send-welcome-email' }, async () => {
    await sendWelcomeEmail(user.email);
  });

  transaction.setStatus('ok');
} catch (error) {
  transaction.setStatus('error');
  Sentry.captureException(error);
} finally {
  transaction.finish();
}
```

#### 自动性能追踪

```javascript
import * as Sentry from '@sentry/node';

// HTTP 请求追踪
app.addHook('onRequest', async (request, reply) => {
  const transaction = Sentry.startTransaction({
    name: `${request.method} ${request.url}`,
    op: 'http.request'
  });

  // 将事务存储在请求上下文中
  request.sentryTransaction = transaction;
});

app.addHook('onResponse', async (request, reply) => {
  if (request.sentryTransaction) {
    request.sentryTransaction.setHttpStatus(reply.statusCode);
    request.sentryTransaction.finish();
  }
});

// 数据库查询追踪
class DatabaseService {
  async query(sql, params) {
    return Sentry.startSpan({
      name: 'database.query',
      op: 'db.query',
      description: sql
    }, async (span) => {
      span.setData('sql', sql);
      span.setData('params', params);

      try {
        const result = await this.pool.query(sql, params);
        span.setData('rowCount', result.rowCount);
        return result;
      } catch (error) {
        span.setStatus('error');
        throw error;
      }
    });
  }
}
```

### 分布式追踪

```javascript
import * as Sentry from '@sentry/node';

// 服务间追踪头传递
app.addHook('onRequest', async (request, reply) => {
  // 从请求头提取追踪信息
  const sentryTrace = request.headers['sentry-trace'];
  const baggage = request.headers['baggage'];

  if (sentryTrace) {
    // 继续现有事务
    const transaction = Sentry.continueTrace({
      sentryTrace,
      baggage
    }, {
      name: `${request.method} ${request.url}`,
      op: 'http.request'
    });

    request.sentryTransaction = transaction;
  }
});

// 向外请求时传递追踪头
class HttpClient {
  async request(options) {
    return Sentry.startSpan({
      name: 'external.http.request',
      op: 'http.client'
    }, async (span) => {
      span.setData('url', options.url);
      span.setData('method', options.method);

      // 获取当前追踪头
      const headers = {
        ...options.headers,
        ...Sentry.getTraceHeaders()
      };

      try {
        const response = await fetch(options.url, {
          ...options,
          headers
        });

        span.setHttpStatus(response.status);
        return response;
      } catch (error) {
        span.setStatus('error');
        throw error;
      }
    });
  }
}
```

### 自定义集成

#### 业务指标监控

```javascript
import * as Sentry from '@sentry/node';

// 自定义指标收集
class MetricsCollector {
  constructor() {
    this.metrics = new Map();
  }

  increment(name, value = 1, tags = {}) {
    const key = `${name}:${JSON.stringify(tags)}`;

    if (!this.metrics.has(key)) {
      this.metrics.set(key, 0);
    }

    this.metrics.set(key, this.metrics.get(key) + value);

    // 发送到 Sentry
    Sentry.metrics.increment(name, value, {
      tags
    });
  }

  gauge(name, value, tags = {}) {
    Sentry.metrics.gauge(name, value, {
      tags
    });
  }

  timing(name, value, tags = {}) {
    Sentry.metrics.timing(name, value, {
      tags
    });
  }
}

// 在业务中使用
const metrics = new MetricsCollector();

class UserService {
  async createUser(userData) {
    const startTime = Date.now();

    try {
      const user = await this.userRepository.create(userData);

      // 记录成功指标
      metrics.increment('user.created', 1, {
        source: 'api',
        plan: userData.plan || 'free'
      });

      metrics.timing('user.creation_time', Date.now() - startTime);

      return user;
    } catch (error) {
      // 记录失败指标
      metrics.increment('user.creation_failed', 1, {
        error_type: error.name
      });

      throw error;
    }
  }
}
```

#### 用户反馈收集

```javascript
import * as Sentry from '@sentry/node';

// 用户反馈路由
app.post('/api/feedback', async (request, reply) => {
  const { eventId, comments, email, name } = request.body;

  try {
    // 创建用户反馈
    await Sentry.captureUserFeedback({
      event_id: eventId,
      email,
      name,
      comments
    });

    reply.send({ success: true });
  } catch (error) {
    request.log.error('Failed to capture user feedback:', error);
    reply.status(500).send({ error: 'Failed to submit feedback' });
  }
});

// 错误页面中的反馈收集
app.get('/error-feedback', async (request, reply) => {
  const { eventId } = request.query;

  // 显示反馈表单
  reply.view('error-feedback', {
    eventId,
    dsn: process.env.SENTRY_DSN
  });
});
```

### 监控和告警

#### 错误率监控

```javascript
import * as Sentry from '@sentry/node';

// 错误率阈值监控
const errorMonitor = {
  window: 5 * 60 * 1000, // 5分钟窗口
  threshold: 0.05, // 5% 错误率
  errors: [],
  totalRequests: 0,

  recordRequest(success) {
    this.totalRequests++;

    if (!success) {
      this.errors.push(Date.now());
    }

    // 清理过期错误
    const cutoff = Date.now() - this.window;
    this.errors = this.errors.filter(time => time > cutoff);

    // 检查错误率
    const errorRate = this.errors.length / this.totalRequests;

    if (errorRate > this.threshold) {
      Sentry.captureMessage('High error rate detected', {
        level: 'warning',
        tags: {
          type: 'error_rate_alert'
        },
        extra: {
          errorRate: errorRate.toFixed(4),
          errors: this.errors.length,
          totalRequests: this.totalRequests,
          windowMinutes: this.window / (60 * 1000)
        }
      });
    }
  }
};

// 在请求钩子中使用
app.addHook('onResponse', async (request, reply) => {
  const success = reply.statusCode < 400;
  errorMonitor.recordRequest(success);
});
```

#### 性能监控

```javascript
import * as Sentry from '@sentry/node';

// 性能监控中间件
const performanceMonitor = {
  slowQueryThreshold: 1000, // 1秒
  slowRequestThreshold: 5000, // 5秒

  monitorDatabaseQuery(query, duration) {
    if (duration > this.slowQueryThreshold) {
      Sentry.captureMessage('Slow database query detected', {
        level: 'warning',
        tags: {
          type: 'slow_query'
        },
        extra: {
          query: query.substring(0, 200), // 截断长查询
          duration,
          threshold: this.slowQueryThreshold
        }
      });
    }
  },

  monitorRequest(method, url, duration, statusCode) {
    if (duration > this.slowRequestThreshold) {
      Sentry.captureMessage('Slow request detected', {
        level: 'warning',
        tags: {
          type: 'slow_request',
          method,
          status_code: statusCode.toString()
        },
        extra: {
          url,
          duration,
          threshold: this.slowRequestThreshold
        }
      });
    }
  }
};

// 集成到应用中
class DatabaseService {
  async query(sql, params = []) {
    const startTime = Date.now();

    try {
      const result = await this.pool.query(sql, params);
      const duration = Date.now() - startTime;

      performanceMonitor.monitorDatabaseQuery(sql, duration);

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      Sentry.captureException(error, {
        tags: {
          type: 'database_error',
          operation: 'query'
        },
        extra: {
          sql,
          params,
          duration
        }
      });

      throw error;
    }
  }
}

// 请求性能监控
app.addHook('onResponse', async (request, reply) => {
  const duration = reply.elapsedTime || 0;

  performanceMonitor.monitorRequest(
    request.method,
    request.url,
    duration,
    reply.statusCode
  );
});
```

## 🔧 架构集成

### 依赖注入 + 插件系统

```javascript
// 插件注册到容器
container.register({
  authPlugin: asFunction(() => authPlugin).singleton(),
  errorHandler: asFunction(() => errorHandler).singleton(),
  metricsCollector: asFunction(() => metricsCollector).singleton()
});

// 插件中使用容器服务
async function monitoringPlugin(fastify, options) {
  const metricsCollector = fastify.container.resolve('metricsCollector');

  // 添加监控钩子
  fastify.addHook('onRequest', async (request) => {
    request.startTime = process.hrtime.bigint();
  });

  fastify.addHook('onResponse', async (request, reply) => {
    const duration = Number(process.hrtime.bigint() - request.startTime) / 1e6;

    metricsCollector.recordRequest({
      method: request.method,
      url: request.url,
      duration,
      statusCode: reply.statusCode
    });
  });
}
```

### 错误监控 + 插件集成

```javascript
// 插件错误监控
async function errorTrackingPlugin(fastify, options) {
  // 全局错误处理
  fastify.setErrorHandler(async (error, request, reply) => {
    // 记录到 Sentry
    Sentry.captureException(error, {
      tags: {
        plugin: 'error-handler',
        route: request.url,
        method: request.method
      },
      extra: {
        headers: request.headers,
        params: request.params,
        query: request.query,
        body: request.body
      },
      user: request.user ? {
        id: request.user.id,
        email: request.user.email
      } : undefined
    });

    // 返回用户友好的错误
    const statusCode = error.statusCode || 500;
    const message = statusCode >= 500 ? 'Internal server error' : error.message;

    reply.status(statusCode).send({
      error: message,
      code: error.code || 'INTERNAL_ERROR'
    });
  });

  // 未捕获异常处理
  process.on('uncaughtException', (error) => {
    Sentry.captureException(error, {
      tags: { type: 'uncaught_exception' }
    });
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    Sentry.captureException(reason, {
      tags: { type: 'unhandled_rejection' },
      extra: { promise: promise.toString() }
    });
  });
}
```

## 📊 监控和调试

### 容器监控

```javascript
// 容器健康检查
container.register({
  healthChecker: asClass(HealthChecker).singleton()
});

class HealthChecker {
  constructor({ database, redis, externalServices }) {
    this.database = database;
    this.redis = redis;
    this.externalServices = externalServices;
  }

  async check() {
    const checks = await Promise.allSettled([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkExternalServices()
    ]);

    const results = {
      status: 'healthy',
      timestamp: new Date(),
      checks: {}
    };

    for (const [index, check] of checks.entries()) {
      const checkName = ['database', 'redis', 'external_services'][index];

      if (check.status === 'rejected') {
        results.status = 'unhealthy';
        results.checks[checkName] = {
          status: 'error',
          error: check.reason.message
        };
      } else {
        results.checks[checkName] = {
          status: 'healthy',
          ...check.value
        };
      }
    }

    return results;
  }
}
```

### 性能基准

```javascript
// 架构性能测试
describe('Architecture Performance', () => {
  let container;

  beforeAll(async () => {
    container = createContainer();
    // 注册所有服务
    await setupContainer(container);
  });

  test('service resolution performance', async () => {
    const iterations = 10000;
    const startTime = process.hrtime.bigint();

    for (let i = 0; i < iterations; i++) {
      const service = container.resolve('userService');
      expect(service).toBeDefined();
    }

    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1e9; // 转换为秒

    console.log(`${iterations} service resolutions took ${duration}s`);
    console.log(`Average time per resolution: ${(duration / iterations * 1000).toFixed(3)}ms`);

    // 性能断言
    expect(duration / iterations).toBeLessThan(0.001); // 小于1ms
  });

  test('plugin registration performance', async () => {
    const app = Fastify();
    const plugins = [
      authPlugin,
      monitoringPlugin,
      errorTrackingPlugin
    ];

    const startTime = process.hrtime.bigint();

    for (const plugin of plugins) {
      await app.register(plugin);
    }

    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1e9;

    console.log(`Plugin registration took ${duration}s`);
    expect(duration).toBeLessThan(1.0); // 小于1秒
  });
});
```

## ❓ 常见问题

### Q: 如何选择依赖注入的生命周期？

**A:** 根据服务的使用模式：

- **单例 (singleton)**: 全局共享的服务，如数据库连接、配置、日志
- **作用域 (scoped)**: 每个请求一个实例，如请求上下文、用户会话
- **瞬时 (transient)**: 每次都创建新实例，如验证器、数据转换器

```javascript
// 单例服务
container.register({
  database: asClass(Database).singleton(), // 应用共享
  config: asValue(config).singleton()       // 配置对象
});

// 作用域服务
container.register({
  requestContext: asClass(RequestContext).scoped(), // 每个请求一个
  userService: asClass(UserService).scoped()         // 请求作用域
});

// 瞬时服务
container.register({
  validator: asClass(Validator).transient(),     // 每次验证都新实例
  uuid: asFunction(() => uuidv4()).transient()   // 每次生成新UUID
});
```

### Q: 插件间的依赖如何管理？

**A:** 使用显式依赖声明和条件依赖：

```javascript
// 插件依赖声明
export default fp(authPlugin, {
  name: 'auth-plugin',
  dependencies: ['fastify-jwt'],     // 强制依赖
  decorators: ['jwt'],               // 需要的前置装饰器
  hooks: ['preHandler']              // 使用的钩子
});

// 条件依赖
export default fp(cachePlugin, {
  name: 'cache-plugin',
  dependencies: [],                  // 无强制依赖
  decorators: {                      // 可选装饰器
    redis: { optional: true }
  }
});
```

### Q: 如何调试依赖注入问题？

**A:** 使用容器的调试功能：

```javascript
// 启用调试模式
const container = createContainer({
  injectionMode: 'PROXY' // 更好的错误信息
});

// 检查服务注册
console.log('Registered services:', container.registrations);

// 检查服务解析
try {
  const service = container.resolve('userService');
} catch (error) {
  console.error('Service resolution failed:', error.message);
  console.log('Available services:', Object.keys(container.registrations));
}

// 添加解析钩子
container.register({
  debugResolver: asFunction(() => ({
    resolve: (name) => {
      console.log(`Resolving service: ${name}`);
      return container.resolve(name);
    }
  })).singleton()
});
```

## 📚 相关链接

- [Awilix 文档](https://github.com/jeffijoe/awilix) - 依赖注入容器
- [Fastify 插件指南](https://fastify.dev/docs/latest/Plugins/) - 插件开发
- [Sentry Node.js SDK](https://docs.sentry.io/platforms/node/) - 错误监控
- [核心模块文档](core-modules.md) - 核心功能模块
- [API 文档](api-documentation.md) - 完整的API参考
