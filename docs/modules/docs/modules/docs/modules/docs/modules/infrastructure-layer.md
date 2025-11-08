# frys 基础设施层 (src/infrastructure/)

## 📖 模块概述

frys 的基础设施层 (src/infrastructure/)提供了企业级应用的底层技术支持，通过抽象化基础设施组件实现与业务逻辑的解耦。该层包含数据库、缓存、消息队列、监控、可观测性等核心基础设施服务，确保应用的稳定运行和高性能。

### 🎯 核心特性

- **数据库抽象** - 统一的多数据库支持和连接管理
- **缓存体系** - 多层缓存架构和智能策略
- **消息队列** - 异步通信和事件驱动架构
- **监控告警** - 全面的可观测性和健康检查
- **自动伸缩** - 基于负载的动态资源调整
- **容错恢复** - 异常处理和优雅降级

### 🏗️ 基础设施架构

```
基础设施层 (src/infrastructure/)
├── 💾 数据库基础设施 (Database)
│   ├── 连接池管理 (Connection Pool)
│   ├── 查询优化器 (Query Optimizer)
│   ├── 迁移管理器 (Migration Manager)
│   └── 监控告警 (Monitor & Alert)
├── 🗄️ 持久化层 (Persistence)
│   ├── 缓存管理器 (Cache Manager)
│   ├── 缓存策略 (Cache Strategies)
│   └── 存储抽象 (Storage Abstraction)
├── 📨 消息队列基础设施 (Messaging)
│   ├── 消息代理 (Message Broker)
│   ├── 发布订阅 (Pub/Sub)
│   ├── 事件总线 (Event Bus)
│   └── 消息持久化 (Message Persistence)
├── 🔐 认证基础设施 (Authentication)
│   ├── 中间件 (Middleware)
│   ├── 会话管理 (Session Management)
│   └── 安全策略 (Security Policies)
├── 🏥 健康检查 (Health Checks)
│   ├── 应用健康检查 (Application Health)
│   ├── 依赖健康检查 (Dependency Health)
│   ├── 容器健康检查 (Container Health)
│   └── Kubernetes健康检查 (K8s Health)
├── ⚡ 性能基准测试 (Benchmarking)
│   ├── 负载测试器 (Load Tester)
│   ├── 压力测试器 (Stress Tester)
│   ├── 性能基准 (Performance Benchmark)
│   └── 基准管理器 (Benchmark Manager)
├── 📊 监控和追踪 (Monitoring & Tracing)
│   ├── 分布式追踪 (Distributed Tracing)
│   ├── 指标收集 (Metrics Collection)
│   ├── 日志聚合 (Log Aggregation)
│   └── 可观测性 (Observability)
├── 🔄 自动伸缩 (Auto Scaling)
│   ├── 容器编排器 (Container Orchestrator)
│   ├── 负载均衡器 (Load Balancer)
│   ├── 伸缩策略 (Scaling Policy)
│   └── 伸缩指标 (Scaling Metrics)
├── 🛡️ 异常处理 (Exception Handling)
│   ├── 全局异常处理器 (Global Exception Handler)
│   ├── 异常恢复策略 (Exception Recovery)
│   ├── 优雅关闭管理器 (Graceful Shutdown)
│   └── 核心服务保护器 (Core Service Protector)
├── 🏊 资源池化 (Pooling)
│   ├── HTTP客户端池 (HTTP Client Pool)
│   ├── 工作池 (Worker Pool)
│   ├── 通用对象池 (Generic Object Pool)
│   └── 资源池管理器 (Resource Pool Manager)
└── 🌐 中间件层 (Middleware)
    ├── 缓存中间件 (Cache Middleware)
    └── 追踪中间件 (Tracing Middleware)
```

## 💾 数据库基础设施 (Database)

### 连接池管理 (DatabaseConnectionPool)

数据库连接池提供了高效的数据库连接管理，支持连接复用、监控和自动扩展。

```javascript
import { DatabaseConnectionPool } from 'frys-infrastructure';

const poolConfig = {
  host: 'localhost',
  port: 5432,
  database: 'frys_prod',
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: true,

  // 连接池配置
  min: 2,          // 最小连接数
  max: 20,         // 最大连接数
  idle: 10000,     // 空闲连接超时(ms)
  acquire: 60000,  // 获取连接超时(ms)

  // 健康检查
  healthCheck: {
    enabled: true,
    interval: 30000,    // 健康检查间隔
    timeout: 5000,      // 健康检查超时
    retryCount: 3,      // 重试次数
  },

  // 监控配置
  monitoring: {
    enabled: true,
    metrics: {
      connectionsCreated: true,
      connectionsDestroyed: true,
      connectionsAcquired: true,
      connectionsReleased: true,
      waitingClients: true,
    },
  },
};

const pool = new DatabaseConnectionPool(poolConfig);

// 使用连接池
const client = await pool.acquire();

try {
  const result = await client.query('SELECT * FROM users WHERE id = $1', [userId]);
  return result.rows[0];
} finally {
  pool.release(client);
}
```

### 查询优化器 (DatabaseOptimizer)

数据库查询优化器提供智能的查询分析、索引建议和性能优化。

```javascript
import { DatabaseOptimizer } from 'frys-infrastructure';

const optimizer = new DatabaseOptimizer({
  database: pool,
  enableAutoOptimization: true,
  analysisInterval: 3600000, // 每小时分析一次
});

// 分析慢查询
const slowQueries = await optimizer.analyzeSlowQueries({
  threshold: 1000, // 慢查询阈值(ms)
  limit: 100,      // 返回前100个慢查询
});

for (const query of slowQueries) {
  console.log('慢查询:', query.sql);
  console.log('执行时间:', query.executionTime);
  console.log('调用次数:', query.callCount);

  // 生成优化建议
  const suggestions = await optimizer.generateOptimizationSuggestions(query);
  console.log('优化建议:', suggestions);
}

// 自动索引优化
await optimizer.optimizeIndexes({
  tables: ['users', 'orders', 'products'],
  createMissingIndexes: true,
  removeUnusedIndexes: false, // 生产环境建议false
});

// 查询重写优化
const optimizedQuery = await optimizer.rewriteQuery(`
  SELECT u.name, COUNT(o.id) as order_count
  FROM users u
  LEFT JOIN orders o ON u.id = o.user_id
  WHERE u.created_at > '2024-01-01'
  GROUP BY u.id, u.name
  HAVING COUNT(o.id) > 5
`);

console.log('优化后的查询:', optimizedQuery);
```

### 迁移管理器 (MigrationManager)

数据库迁移管理器支持版本化的数据库模式变更和回滚。

```javascript
import { MigrationManager } from 'frys-infrastructure';

const migrationManager = new MigrationManager({
  database: pool,
  migrationDir: './migrations',
  tableName: 'migrations',

  // 迁移配置
  validateChecksums: true,  // 验证迁移文件校验和
  allowOutOfOrder: false,   // 不允许乱序执行
  baselineVersion: '1.0.0', // 基线版本
});

// 创建迁移文件
await migrationManager.createMigration('add_user_preferences', {
  up: `
    CREATE TABLE user_preferences (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id),
      preferences JSONB DEFAULT '{}',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE INDEX idx_user_preferences_user_id ON user_preferences(user_id);
  `,

  down: `
    DROP TABLE user_preferences;
  `,
});

// 执行迁移
await migrationManager.up(); // 升级到最新版本

// 回滚迁移
await migrationManager.down(2); // 回滚2个版本

// 检查迁移状态
const status = await migrationManager.status();
console.log('待执行迁移:', status.pending);
console.log('已执行迁移:', status.executed);
console.log('当前版本:', status.currentVersion);

// 迁移到指定版本
await migrationManager.goto('1.2.0');
```

### 数据库监控 (DatabaseMonitor)

数据库监控器提供实时的数据库性能监控和告警。

```javascript
import { DatabaseMonitor } from 'frys-infrastructure';

const monitor = new DatabaseMonitor({
  database: pool,
  monitoringInterval: 30000, // 30秒监控间隔

  // 监控指标
  metrics: {
    connectionPool: true,
    queryPerformance: true,
    tableSizes: true,
    indexUsage: true,
    lockContention: true,
  },

  // 告警阈值
  thresholds: {
    maxConnections: 90,      // 连接池使用率90%
    slowQueryTime: 1000,     // 慢查询1秒
    lockWaitTime: 5000,      // 锁等待5秒
    tableSizeGB: 10,         // 表大小10GB
  },

  // 告警配置
  alerts: {
    enabled: true,
    channels: ['email', 'slack', 'webhook'],
    cooldown: 300000, // 5分钟冷却期
  },
});

// 启动监控
await monitor.start();

// 获取监控报告
const report = await monitor.generateReport();
console.log('数据库健康状态:', report.health);
console.log('连接池状态:', report.connectionPool);
console.log('性能指标:', report.performance);
console.log('活跃告警:', report.activeAlerts);

// 自定义指标收集
monitor.on('metric', (metric) => {
  console.log('指标:', metric.name, metric.value);
});

monitor.on('alert', (alert) => {
  console.log('告警:', alert.level, alert.message);
});
```

## 🗄️ 持久化层 (Persistence)

### 缓存管理器 (CacheManager)

多层缓存管理器提供内存、Redis、数据库的多层缓存架构。

```javascript
import { CacheManager } from 'frys-infrastructure';

const cacheManager = new CacheManager({
  layers: [
    // L1: 内存缓存
    {
      type: 'memory',
      max: 1000,
      ttl: 300000, // 5分钟
    },

    // L2: Redis缓存
    {
      type: 'redis',
      host: 'localhost',
      port: 6379,
      ttl: 3600000, // 1小时
      keyPrefix: 'frys:',
    },

    // L3: 数据库缓存
    {
      type: 'database',
      table: 'cache_entries',
      ttl: 86400000, // 24小时
    },
  ],

  // 缓存策略
  strategy: 'read-through', // read-through, write-through, write-behind

  // 序列化配置
  serialization: {
    compress: true,
    compressor: 'gzip',
    serializer: 'json',
  },
});

// 基本缓存操作
await cacheManager.set('user:123', { id: 123, name: 'John' }, { ttl: 1800 });
const user = await cacheManager.get('user:123');
await cacheManager.delete('user:123');

// 缓存穿透保护
const userData = await cacheManager.getOrSet(
  'user:profile:123',
  async () => await fetchUserFromDatabase(123),
  { ttl: 1800 }
);

// 批量操作
const users = await cacheManager.mget(['user:1', 'user:2', 'user:3']);
await cacheManager.mset([
  ['user:4', user4Data],
  ['user:5', user5Data],
]);
```

### 缓存策略 (CacheStrategies)

智能缓存策略提供基于访问模式的缓存优化。

```javascript
import { CacheStrategies } from 'frys-infrastructure';

const strategies = new CacheStrategies();

// 创建访问模式策略
const readHeavyStrategy = strategies.createAccessPatternStrategy({
  readRatio: 0.9,    // 90%读操作
  writeRatio: 0.1,   // 10%写操作
  burstTolerance: 0.2, // 突发写入容忍度
});

// 创建新鲜度策略
const freshStrategy = strategies.createFreshnessStrategy({
  maxAge: 300,       // 最大年龄5分钟
  stalenessTolerance: 0.1, // 10%陈旧容忍度
  refreshThreshold: 0.8,   // 80%时刷新
});

// 创建复合策略
const compositeStrategy = strategies.createCompositeStrategy([
  readHeavyStrategy,
  freshStrategy,
], 'weighted'); // 加权组合

// 注册自定义策略
strategies.registerStrategy('user-data', readHeavyStrategy);
strategies.registerStrategy('config-data', freshStrategy);

// 使用策略
await cacheManager.set('user:123', userData, {
  strategy: 'user-data',
  ttl: 1800,
});
```

## 📨 消息队列基础设施 (Messaging)

### 消息代理 (Message Broker)

支持多种消息代理的统一接口，当前主要支持Redis和RabbitMQ。

```javascript
import { MessageBroker } from 'frys-infrastructure';

const broker = new MessageBroker({
  type: 'redis', // 或 'rabbitmq'
  host: 'localhost',
  port: 6379,

  // 连接配置
  retryAttempts: 3,
  retryDelay: 1000,

  // 监控配置
  monitoring: {
    enabled: true,
    metrics: true,
    healthChecks: true,
  },
});

// 发布消息
await broker.publish('user.created', {
  userId: 'user-123',
  username: 'john_doe',
  email: 'john@example.com',
  timestamp: new Date(),
});

// 订阅消息
await broker.subscribe('user.created', async (message) => {
  console.log('新用户创建:', message.userId);

  // 发送欢迎邮件
  await emailService.sendWelcomeEmail(message.email);
});

// 发布订阅模式
const publisher = broker.createPublisher('notifications');
const subscriber = broker.createSubscriber('notifications');

await subscriber.subscribe(async (message) => {
  await processNotification(message);
});
```

### 事件总线 (Event Bus)

轻量级的事件总线实现，支持同步和异步事件处理。

```javascript
import { EventBus } from 'frys-infrastructure';

const eventBus = new EventBus({
  async: true,        // 异步处理事件
  errorHandling: true, // 启用错误处理
  monitoring: true,    // 启用监控
});

// 注册事件处理器
eventBus.on('user.registered', async (event) => {
  // 发送欢迎邮件
  await emailService.sendWelcomeEmail(event.email);
});

eventBus.on('order.placed', async (event) => {
  // 处理订单
  await orderService.processOrder(event.orderId);
});

// 发布事件
await eventBus.emit('user.registered', {
  userId: 'user-123',
  email: 'john@example.com',
});

// 一次性事件处理器
eventBus.once('app.ready', () => {
  console.log('应用已就绪');
});

// 移除事件处理器
eventBus.off('user.registered', handler);

// 获取事件统计
const stats = eventBus.getStats();
console.log('已处理事件:', stats.processed);
console.log('活跃处理器:', stats.activeHandlers);
```

## 🔐 认证基础设施 (Authentication)

### 认证中间件 (AuthenticationMiddleware)

基于JWT的认证中间件，提供请求级别的身份验证和授权。

```javascript
import { AuthenticationMiddleware } from 'frys-infrastructure';

const authMiddleware = new AuthenticationMiddleware({
  jwt: {
    secret: process.env.JWT_SECRET,
    issuer: 'frys-app',
    audience: 'frys-users',
    algorithms: ['HS256'],
  },

  // 令牌配置
  accessToken: {
    expiresIn: '1h',
  },
  refreshToken: {
    expiresIn: '7d',
  },

  // 排除路径
  excludePaths: ['/health', '/login', '/register'],

  // 自定义验证
  customValidators: {
    hasPermission: (user, permission) => user.permissions.includes(permission),
  },
});

// 生成令牌
const tokens = await authMiddleware.generateTokens({
  userId: 'user-123',
  username: 'john_doe',
  roles: ['user'],
  permissions: ['read:profile', 'write:profile'],
});

// 验证令牌
const payload = await authMiddleware.verifyToken(accessToken);

// 中间件使用
app.use(authMiddleware.authenticate());

// 权限检查中间件
app.get('/admin/users', authMiddleware.authorize(['admin:users']), (req, res) => {
  // 只有管理员可以访问
});

// 自定义权限检查
app.get('/api/profile', authMiddleware.checkPermission('read:profile'), (req, res) => {
  // 检查用户是否有读取资料的权限
});
```

## 🏥 健康检查 (Health Checks)

### 应用健康检查器 (HealthChecker)

全面的应用健康状态监控和检查。

```javascript
import { HealthChecker } from 'frys-infrastructure';

const healthChecker = new HealthChecker({
  // 检查间隔
  interval: 30000, // 30秒

  // 检查配置
  checks: {
    database: {
      enabled: true,
      timeout: 5000,
      query: 'SELECT 1',
    },

    redis: {
      enabled: true,
      timeout: 3000,
      command: 'PING',
    },

    external: {
      'api.example.com': {
        enabled: true,
        timeout: 5000,
        method: 'GET',
        expectedStatus: 200,
      },
    },
  },

  // 健康标准
  thresholds: {
    responseTime: 1000,    // 响应时间 < 1秒
    errorRate: 0.05,       // 错误率 < 5%
    memoryUsage: 0.8,      // 内存使用 < 80%
    cpuUsage: 0.7,         // CPU使用 < 70%
  },
});

// 执行健康检查
const health = await healthChecker.check();
console.log('整体健康状态:', health.status);
console.log('检查详情:', health.checks);

// 检查特定组件
const dbHealth = await healthChecker.checkDatabase();
console.log('数据库健康:', dbHealth.status);

// 注册自定义健康检查
healthChecker.registerCheck('custom-service', async () => {
  try {
    await customService.ping();
    return { status: 'healthy' };
  } catch (error) {
    return { status: 'unhealthy', error: error.message };
  }
});
```

### 容器健康检查器 (DockerHealthChecker)

专门为容器化环境设计的健康检查器。

```javascript
import { DockerHealthChecker } from 'frys-infrastructure';

const dockerChecker = new DockerHealthChecker({
  // Docker配置
  socketPath: '/var/run/docker.sock',

  // 容器检查
  containers: {
    'frys-app': {
      healthCheck: {
        test: ['CMD', 'curl', '-f', 'http://localhost/health'],
        interval: 30000000000, // 30秒
        timeout: 10000000000,  // 10秒
        retries: 3,
      },
    },

    'frys-db': {
      healthCheck: {
        test: ['CMD', 'pg_isready', '-U', 'postgres'],
        interval: 10000000000, // 10秒
        timeout: 5000000000,   // 5秒
        retries: 5,
      },
    },
  },
});

// 检查容器健康状态
const containerHealth = await dockerChecker.checkContainer('frys-app');
console.log('容器状态:', containerHealth.status);

// 获取所有容器健康状态
const allHealth = await dockerChecker.checkAllContainers();
console.log('所有容器状态:', allHealth);
```

## ⚡ 性能基准测试 (Benchmarking)

### 负载测试器 (LoadTester)

HTTP接口的负载测试和性能分析工具。

```javascript
import { LoadTester } from 'frys-infrastructure';

const loadTester = new LoadTester({
  target: 'http://localhost:3000',

  // 负载配置
  phases: [
    { duration: 60, arrivalRate: 10 },  // 1分钟，10个请求/秒
    { duration: 120, arrivalRate: 50 }, // 2分钟，50个请求/秒
    { duration: 60, arrivalRate: 100 }, // 1分钟，100个请求/秒
  ],

  // 请求配置
  requests: [
    {
      method: 'GET',
      url: '/api/users',
      weight: 30, // 30%请求
    },
    {
      method: 'POST',
      url: '/api/users',
      payload: {
        name: '{{randomString(10)}}',
        email: '{{randomEmail()}}',
      },
      weight: 20, // 20%请求
    },
    {
      method: 'GET',
      url: '/api/users/{{randomInt(1, 1000)}}',
      weight: 50, // 50%请求
    },
  ],

  // 性能指标
  metrics: {
    responseTime: true,
    throughput: true,
    errorRate: true,
    percentile: [50, 95, 99],
  },
});

// 执行负载测试
const results = await loadTester.run();
console.log('测试结果:', results);

// 生成报告
await loadTester.generateReport('./reports/load-test-report.html');
```

### 压力测试器 (StressTester)

系统极限压力测试，寻找性能瓶颈和崩溃点。

```javascript
import { StressTester } from 'frys-infrastructure';

const stressTester = new StressTester({
  target: 'http://localhost:3000',

  // 压力配置
  strategy: 'incremental', // incremental, spike, sustained

  // 增量策略配置
  incremental: {
    startRate: 10,      // 起始请求率
    increment: 10,      // 每次增量
    incrementInterval: 60, // 增量间隔(秒)
    maxRate: 500,       // 最大请求率
  },

  // 尖峰策略配置
  spike: {
    normalRate: 50,     // 正常请求率
    spikeRate: 500,     // 尖峰请求率
    spikeDuration: 30,  // 尖峰持续时间
    cooldown: 60,       // 冷却时间
  },

  // 持续策略配置
  sustained: {
    rate: 200,          // 持续请求率
    duration: 300,      // 测试持续时间
  },

  // 停止条件
  stopConditions: {
    maxResponseTime: 5000,   // 最大响应时间
    maxErrorRate: 0.5,       // 最大错误率
    maxDuration: 600,        // 最大测试时间
  },
});

// 执行压力测试
const results = await stressTester.run();
console.log('压力测试结果:', results);

// 分析瓶颈
const bottlenecks = await stressTester.identifyBottlenecks(results);
console.log('性能瓶颈:', bottlenecks);
```

## 📊 监控和追踪 (Monitoring & Tracing)

### 分布式追踪 (Distributed Tracing)

基于OpenTelemetry的分布式追踪系统。

```javascript
import { Tracer } from 'frys-infrastructure';

const tracer = new Tracer({
  serviceName: 'frys-api',
  serviceVersion: '1.0.0',

  // 导出器配置
  exporter: {
    type: 'jaeger', // jaeger, zipkin, otlp
    endpoint: 'http://localhost:14268/api/traces',
  },

  // 采样策略
  sampling: {
    rate: 0.1, // 10%采样率
    rules: [
      { service: 'auth', rate: 1.0 }, // 认证服务100%采样
      { path: '/health', rate: 0.01 }, // 健康检查1%采样
    ],
  },
});

// 创建跨度
const span = tracer.startSpan('user.registration');

// 添加标签
span.setTag('user.id', userId);
span.setTag('user.email', email);

// 创建子跨度
const validationSpan = tracer.startSpan('validate.user.data', {
  childOf: span,
});

try {
  await validateUserData(userData);
  validationSpan.setTag('validation.result', 'success');
} catch (error) {
  validationSpan.setTag('validation.result', 'failed');
  validationSpan.setTag('error', error.message);
  throw error;
} finally {
  validationSpan.finish();
}

// 设置跨度状态
span.setTag('registration.result', 'success');
span.finish();
```

### 追踪中间件 (TracingMiddleware)

自动为HTTP请求添加分布式追踪。

```javascript
import { TracingMiddleware } from 'frys-infrastructure';

const tracingMiddleware = new TracingMiddleware({
  tracer: tracer,

  // 追踪配置
  traceHeaders: true,    // 追踪请求头
  traceBody: false,      // 不追踪请求体（隐私考虑）
  traceQuery: true,      // 追踪查询参数
  traceUser: true,       // 追踪用户信息

  // 自定义标签
  customTags: {
    'http.method': (req) => req.method,
    'http.url': (req) => req.url,
    'user.id': (req) => req.user?.id,
    'request.size': (req) => req.headers['content-length'],
  },

  // 忽略路径
  ignorePaths: ['/health', '/metrics', '/favicon.ico'],
});

// Express中间件
app.use(tracingMiddleware);

// 手动创建跨度
app.get('/api/users/:id', async (req, res) => {
  const span = tracer.startSpan('get.user', {
    tags: {
      'user.id': req.params.id,
    },
  });

  try {
    const user = await userService.getUser(req.params.id);
    span.setTag('user.found', !!user);
    res.json(user);
  } catch (error) {
    span.setTag('error', error.message);
    throw error;
  } finally {
    span.finish();
  }
});
```

## 🔄 自动伸缩 (Auto Scaling)

### 容器编排器 (ContainerOrchestrator)

支持Docker和Kubernetes的容器编排和自动伸缩。

```javascript
import { DockerContainerOrchestrator } from 'frys-infrastructure';

const orchestrator = new DockerContainerOrchestrator({
  docker: {
    socketPath: '/var/run/docker.sock',
  },

  // 伸缩配置
  scaling: {
    minReplicas: 2,      // 最小副本数
    maxReplicas: 10,     // 最大副本数
    scaleUpThreshold: 70,  // CPU使用率70%时扩容
    scaleDownThreshold: 30, // CPU使用率30%时缩容
    cooldownPeriod: 300,   // 冷却期5分钟
  },

  // 健康检查
  healthCheck: {
    interval: 30,        // 30秒检查一次
    timeout: 10,         // 10秒超时
    retries: 3,          // 重试3次
  },

  // 负载均衡
  loadBalancer: {
    algorithm: 'round-robin', // 轮询算法
    stickySessions: false,
  },
});

// 启动编排器
await orchestrator.start();

// 获取集群状态
const status = await orchestrator.getClusterStatus();
console.log('活跃副本:', status.activeReplicas);
console.log('总副本:', status.totalReplicas);

// 手动伸缩
await orchestrator.scaleTo(5); // 缩放到5个副本

// 自动伸缩（基于指标）
await orchestrator.enableAutoScaling({
  metrics: ['cpu', 'memory', 'requests_per_second'],
  targetUtilization: 0.7, // 目标利用率70%
});
```

### 伸缩策略 (ScalingPolicy)

智能的伸缩策略引擎，支持多种伸缩算法。

```javascript
import { ScalingPolicy } from 'frys-infrastructure';

const scalingPolicy = new ScalingPolicy({
  // 基于CPU的伸缩策略
  cpuBased: {
    enabled: true,
    targetUtilization: 0.7,  // 目标CPU利用率70%
    scaleUpThreshold: 0.8,   // 80%时扩容
    scaleDownThreshold: 0.4, // 40%时缩容
    stabilizationWindow: 300, // 稳定窗口5分钟
  },

  // 基于内存的伸缩策略
  memoryBased: {
    enabled: true,
    targetUtilization: 0.8,  // 目标内存利用率80%
    scaleUpThreshold: 0.9,   // 90%时扩容
    scaleDownThreshold: 0.5, // 50%时缩容
  },

  // 基于请求率的伸缩策略
  requestBased: {
    enabled: true,
    targetRPS: 1000,         // 目标每秒请求数
    scaleUpThreshold: 1.2,   // 120%时扩容
    scaleDownThreshold: 0.7, // 70%时缩容
  },

  // 预测性伸缩
  predictive: {
    enabled: true,
    historyWindow: 168,      // 7天历史数据
    forecastHorizon: 24,     // 预测24小时
    confidenceThreshold: 0.8, // 置信度阈值
  },
});

// 计算伸缩建议
const metrics = {
  cpuUtilization: 0.85,
  memoryUtilization: 0.75,
  currentRPS: 1200,
  activeReplicas: 3,
};

const recommendation = await scalingPolicy.calculateRecommendation(metrics);
console.log('伸缩建议:', recommendation.action); // 'scale_up' 或 'scale_down'
console.log('目标副本数:', recommendation.targetReplicas);
console.log('置信度:', recommendation.confidence);
```

## 🛡️ 异常处理 (Exception Handling)

### 全局异常处理器 (GlobalExceptionHandler)

统一的异常捕获、处理和恢复机制。

```javascript
import { GlobalExceptionHandler } from 'frys-infrastructure';

const exceptionHandler = new GlobalExceptionHandler({
  // 日志配置
  logging: {
    level: 'error',
    includeStackTrace: true,
    sensitiveDataFilter: true,
  },

  // 异常分类
  categories: {
    ValidationError: {
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      retryable: false,
    },
    AuthenticationError: {
      code: 'AUTHENTICATION_ERROR',
      statusCode: 401,
      retryable: false,
    },
    DatabaseError: {
      code: 'DATABASE_ERROR',
      statusCode: 500,
      retryable: true,
      retryDelay: 1000,
    },
    ExternalServiceError: {
      code: 'EXTERNAL_SERVICE_ERROR',
      statusCode: 502,
      retryable: true,
      retryDelay: 2000,
    },
  },

  // 恢复策略
  recoveryStrategies: {
    database: ['retry', 'circuit-breaker', 'fallback'],
    external: ['retry', 'timeout', 'fallback'],
    validation: ['sanitize', 'default-value'],
  },

  // 告警配置
  alerting: {
    enabled: true,
    thresholds: {
      errorRate: 0.1,    // 错误率10%时告警
      errorCount: 100,   // 每分钟100个错误时告警
    },
    channels: ['slack', 'email'],
  },
});

// 注册异常处理器
process.on('uncaughtException', (error) => {
  exceptionHandler.handle(error, 'uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  exceptionHandler.handle(reason, 'unhandledRejection');
});

// 中间件使用
app.use(exceptionHandler.middleware());

// 手动处理异常
try {
  await riskyOperation();
} catch (error) {
  const result = await exceptionHandler.handle(error, 'business-logic');
  if (result.shouldRetry) {
    // 重试逻辑
  }
}
```

### 异常恢复策略 (ExceptionRecoveryStrategies)

多种异常恢复策略的实现。

```javascript
import { ExceptionRecoveryStrategies } from 'frys-infrastructure';

const recoveryStrategies = new ExceptionRecoveryStrategies();

// 重试策略
const retryStrategy = recoveryStrategies.createRetryStrategy({
  maxAttempts: 3,
  backoff: 'exponential',
  baseDelay: 1000,
  maxDelay: 10000,
  jitter: true,
});

// 断路器策略
const circuitBreakerStrategy = recoveryStrategies.createCircuitBreakerStrategy({
  failureThreshold: 5,      // 5次失败后断开
  recoveryTimeout: 60000,   // 1分钟后尝试恢复
  monitoringWindow: 10000,  // 10秒监控窗口
});

// 降级策略
const fallbackStrategy = recoveryStrategies.createFallbackStrategy({
  fallbackFunction: async (error, context) => {
    // 返回默认值或简化响应
    return { status: 'degraded', message: 'Service temporarily unavailable' };
  },
});

// 超时策略
const timeoutStrategy = recoveryStrategies.createTimeoutStrategy({
  timeout: 5000, // 5秒超时
  fallback: true,
});

// 组合策略
const compositeStrategy = recoveryStrategies.createCompositeStrategy([
  retryStrategy,
  circuitBreakerStrategy,
  fallbackStrategy,
], 'failover'); // 故障转移模式

// 执行带恢复的操作
const result = await recoveryStrategies.executeWithRecovery(
  async () => await unreliableService.call(),
  compositeStrategy
);
```

## 🏊 资源池化 (Pooling)

### HTTP客户端池 (HttpClientPool)

连接复用的HTTP客户端池，提高网络请求性能。

```javascript
import { HttpClientPool } from 'frys-infrastructure';

const httpPool = new HttpClientPool({
  // 池配置
  min: 5,          // 最小连接数
  max: 50,         // 最大连接数
  idle: 30000,     // 空闲超时30秒
  acquire: 10000,  // 获取超时10秒

  // HTTP配置
  baseURL: 'https://api.example.com',
  timeout: 5000,
  headers: {
    'User-Agent': 'frys-http-pool/1.0',
  },

  // 连接保持
  keepAlive: true,
  keepAliveMsecs: 1000,

  // 重试配置
  retry: {
    attempts: 3,
    delay: 1000,
  },
});

// 使用连接池
const response = await httpPool.request({
  method: 'GET',
  url: '/api/users',
  params: { page: 1, limit: 10 },
});

// 批量请求
const responses = await httpPool.batchRequests([
  { method: 'GET', url: '/api/users/1' },
  { method: 'GET', url: '/api/users/2' },
  { method: 'GET', url: '/api/users/3' },
]);

// 获取池状态
const stats = httpPool.getStats();
console.log('活跃连接:', stats.active);
console.log('空闲连接:', stats.idle);
console.log('等待请求:', stats.waiting);
```

### 工作池 (WorkerPool)

基于线程/进程的工作池，用于CPU密集型任务。

```javascript
import { WorkerPool } from 'frys-infrastructure';

const workerPool = new WorkerPool({
  // 工作进程配置
  minWorkers: 2,     // 最小工作进程数
  maxWorkers: 8,     // 最大工作进程数
  workerScript: './workers/image-processor.js',

  // 任务队列配置
  queueSize: 1000,   // 队列大小
  timeout: 30000,    // 任务超时30秒

  // 监控配置
  monitoring: {
    enabled: true,
    metrics: true,
  },
});

// 提交任务
const result = await workerPool.submit({
  type: 'resize-image',
  data: {
    imagePath: '/path/to/image.jpg',
    width: 800,
    height: 600,
  },
});

// 批量提交任务
const results = await workerPool.submitBatch([
  { type: 'resize-image', data: image1Data },
  { type: 'resize-image', data: image2Data },
  { type: 'compress-image', data: image3Data },
]);

// 获取工作池状态
const stats = workerPool.getStats();
console.log('活跃工作进程:', stats.activeWorkers);
console.log('队列中的任务:', stats.queuedTasks);
console.log('已完成任务:', stats.completedTasks);
```

## 🌐 中间件层 (Middleware)

### 缓存中间件 (CacheMiddleware)

HTTP响应的缓存中间件。

```javascript
import { CacheMiddleware } from 'frys-infrastructure';

const cacheMiddleware = new CacheMiddleware({
  cache: cacheManager,

  // 缓存配置
  defaultTTL: 300,   // 默认5分钟
  cacheableMethods: ['GET', 'HEAD'],
  cacheableStatusCodes: [200, 203, 204, 206, 300, 301, 404, 405, 410, 414, 501],

  // 缓存键生成
  keyGenerator: (req) => {
    return `${req.method}:${req.originalUrl}:${JSON.stringify(req.query)}`;
  },

  // 条件缓存
  conditionalCache: {
    enabled: true,
    etag: true,
    lastModified: true,
  },

  // 缓存控制
  cacheControl: {
    'public': true,
    'max-age': 300,
    's-maxage': 600,
  },
});

// Express中间件
app.use(cacheMiddleware);

// 自定义缓存规则
app.get('/api/users/:id', cacheMiddleware.cache({
  ttl: 600,    // 10分钟
  key: (req) => `user:${req.params.id}`,
  condition: (req) => !req.query.force, // 除非强制刷新
}), async (req, res) => {
  const user = await userService.getUser(req.params.id);
  res.json(user);
});

// 清除缓存
app.post('/api/users', async (req, res) => {
  const user = await userService.createUser(req.body);

  // 清除相关缓存
  await cacheMiddleware.invalidate('users:list');
  await cacheMiddleware.invalidate(`user:${user.id}`);

  res.json(user);
});
```

## 🔧 依赖注入配置

### 基础设施服务注册

```javascript
import { container } from 'frys';

// 注册数据库基础设施
container.register('databasePool', (c) => new DatabaseConnectionPool(dbConfig));
container.register('databaseOptimizer', (c) => new DatabaseOptimizer({
  database: c.resolve('databasePool'),
}));
container.register('migrationManager', (c) => new MigrationManager({
  database: c.resolve('databasePool'),
}));
container.register('databaseMonitor', (c) => new DatabaseMonitor({
  database: c.resolve('databasePool'),
}));

// 注册持久化层
container.register('cacheManager', (c) => new CacheManager(cacheConfig));
container.register('cacheStrategies', (c) => new CacheStrategies());

// 注册消息队列
container.register('messageBroker', (c) => new MessageBroker(messagingConfig));
container.register('eventBus', (c) => new EventBus(eventBusConfig));

// 注册认证基础设施
container.register('authMiddleware', (c) => new AuthenticationMiddleware(authConfig));

// 注册健康检查
container.register('healthChecker', (c) => new HealthChecker(healthConfig));
container.register('dockerChecker', (c) => new DockerHealthChecker(dockerConfig));

// 注册监控和追踪
container.register('tracer', (c) => new Tracer(tracingConfig));
container.register('tracingMiddleware', (c) => new TracingMiddleware({
  tracer: c.resolve('tracer'),
}));

// 注册自动伸缩
container.register('containerOrchestrator', (c) => new DockerContainerOrchestrator(orchestratorConfig));
container.register('scalingPolicy', (c) => new ScalingPolicy(scalingConfig));

// 注册异常处理
container.register('exceptionHandler', (c) => new GlobalExceptionHandler(exceptionConfig));
container.register('recoveryStrategies', (c) => new ExceptionRecoveryStrategies());

// 注册资源池
container.register('httpClientPool', (c) => new HttpClientPool(httpPoolConfig));
container.register('workerPool', (c) => new WorkerPool(workerPoolConfig));

// 注册中间件
container.register('cacheMiddleware', (c) => new CacheMiddleware({
  cache: c.resolve('cacheManager'),
}));
```

## 📊 监控和指标

### 基础设施指标

```javascript
// 数据库指标
const dbMetrics = {
  connectionsActive: await databasePool.getActiveConnections(),
  connectionsIdle: await databasePool.getIdleConnections(),
  queryLatency: await databaseMonitor.getAverageQueryTime(),
  slowQueries: await databaseMonitor.getSlowQueryCount(),
  cacheHitRate: await databaseMonitor.getCacheHitRate(),
};

// 缓存指标
const cacheMetrics = {
  hitRate: await cacheManager.getHitRate(),
  totalOperations: await cacheManager.getTotalOperations(),
  memoryUsage: await cacheManager.getMemoryUsage(),
  evictionRate: await cacheManager.getEvictionRate(),
};

// 消息队列指标
const messagingMetrics = {
  messagesPublished: await messageBroker.getPublishedCount(),
  messagesConsumed: await messageBroker.getConsumedCount(),
  queueDepth: await messageBroker.getQueueDepth(),
  processingLatency: await messageBroker.getAverageProcessingTime(),
};

// 健康检查指标
const healthMetrics = {
  overallHealth: await healthChecker.getOverallHealth(),
  componentHealth: await healthChecker.getComponentHealth(),
  lastCheckTime: await healthChecker.getLastCheckTime(),
  failureCount: await healthChecker.getFailureCount(),
};
```

## 🧪 测试策略

### 基础设施单元测试

```javascript
import { describe, it, expect, vi } from 'vitest';
import { CacheManager } from '../infrastructure/persistence/CacheManager.js';

describe('CacheManager', () => {
  let cacheManager;
  let mockLayer1;
  let mockLayer2;

  beforeEach(() => {
    mockLayer1 = {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
    };

    mockLayer2 = {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
    };

    cacheManager = new CacheManager({
      layers: [mockLayer1, mockLayer2],
    });
  });

  it('should get value from first layer if available', async () => {
    const testKey = 'test:key';
    const testValue = { data: 'test' };

    mockLayer1.get.mockResolvedValue(testValue);
    mockLayer2.get.mockResolvedValue(null);

    const result = await cacheManager.get(testKey);

    expect(mockLayer1.get).toHaveBeenCalledWith(testKey);
    expect(mockLayer2.get).not.toHaveBeenCalled();
    expect(result).toEqual(testValue);
  });

  it('should fallback to second layer if first layer misses', async () => {
    const testKey = 'test:key';
    const testValue = { data: 'test' };

    mockLayer1.get.mockResolvedValue(null);
    mockLayer2.get.mockResolvedValue(testValue);
    mockLayer1.set.mockResolvedValue(true);

    const result = await cacheManager.get(testKey);

    expect(mockLayer1.get).toHaveBeenCalledWith(testKey);
    expect(mockLayer2.get).toHaveBeenCalledWith(testKey);
    expect(mockLayer1.set).toHaveBeenCalledWith(testKey, testValue, expect.any(Object));
    expect(result).toEqual(testValue);
  });
});
```

### 基础设施集成测试

```javascript
describe('Database Infrastructure Integration', () => {
  let databasePool;
  let databaseOptimizer;
  let databaseMonitor;

  beforeAll(async () => {
    databasePool = new DatabaseConnectionPool(testDbConfig);
    databaseOptimizer = new DatabaseOptimizer({ database: databasePool });
    databaseMonitor = new DatabaseMonitor({ database: databasePool });

    await databasePool.initialize();
  });

  afterAll(async () => {
    await databasePool.close();
  });

  it('should execute queries through connection pool', async () => {
    const client = await databasePool.acquire();

    try {
      const result = await client.query('SELECT 1 as test');
      expect(result.rows[0].test).toBe(1);
    } finally {
      databasePool.release(client);
    }
  });

  it('should analyze and optimize queries', async () => {
    // 创建测试表
    await databasePool.query(`
      CREATE TEMP TABLE test_users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100),
        email VARCHAR(100)
      )
    `);

    // 插入测试数据
    for (let i = 0; i < 1000; i++) {
      await databasePool.query(
        'INSERT INTO test_users (name, email) VALUES ($1, $2)',
        [`User ${i}`, `user${i}@example.com`]
      );
    }

    // 执行查询并分析
    const slowQueries = await databaseOptimizer.analyzeSlowQueries();
    const suggestions = await databaseOptimizer.generateOptimizationSuggestions(slowQueries[0]);

    expect(suggestions).toBeDefined();
    expect(suggestions.length).toBeGreaterThan(0);
  });

  it('should monitor database health', async () => {
    const health = await databaseMonitor.checkHealth();
    expect(health.status).toBe('healthy');

    const stats = databaseMonitor.getStats();
    expect(stats).toHaveProperty('connections');
    expect(stats).toHaveProperty('queries');
  });
});
```

## ❓ 常见问题

### Q: 如何选择合适的缓存策略？

**A:** 根据数据特征和访问模式选择缓存策略：

```javascript
const selectCacheStrategy = (dataCharacteristics) => {
  const { accessPattern, updateFrequency, size, criticality } = dataCharacteristics;

  if (accessPattern === 'read-heavy' && updateFrequency === 'low') {
    return 'read-through-lru';
  } else if (updateFrequency === 'high') {
    return 'write-through';
  } else if (criticality === 'high') {
    return 'multi-layer-with-fallback';
  } else if (size === 'large') {
    return 'external-only';
  } else {
    return 'memory-first';
  }
};
```

### Q: 数据库连接池配置的最佳实践？

**A:** 连接池配置的最佳实践：

```javascript
const getOptimalPoolConfig = (workloadType) => {
  const baseConfig = {
    ssl: true,
    connectionTimeoutMillis: 10000,
    query_timeout: 30000,
  };

  switch (workloadType) {
    case 'read-heavy':
      return {
        ...baseConfig,
        min: 5,
        max: 20,
        idleTimeoutMillis: 30000,
      };

    case 'write-heavy':
      return {
        ...baseConfig,
        min: 3,
        max: 10,
        idleTimeoutMillis: 60000,
      };

    case 'mixed':
      return {
        ...baseConfig,
        min: 2,
        max: 15,
        idleTimeoutMillis: 45000,
      };

    default:
      return {
        ...baseConfig,
        min: 1,
        max: 5,
        idleTimeoutMillis: 30000,
      };
  }
};
```

### Q: 如何处理分布式追踪的性能影响？

**A:** 最小化追踪性能影响的策略：

```javascript
const optimizeTracing = (tracingConfig) => {
  return {
    ...tracingConfig,

    // 自适应采样
    sampling: {
      adaptive: true,
      targetRate: 0.1,      // 目标采样率10%
      minRate: 0.01,        // 最小采样率1%
      maxRate: 1.0,         // 最大采样率100%
      adjustmentInterval: 60, // 每分钟调整一次
    },

    // 异步导出
    export: {
      async: true,
      batchSize: 100,       // 批量大小
      flushInterval: 5000,  // 刷新间隔5秒
      maxQueueSize: 10000,  // 最大队列大小
    },

    // 轻量级跨度
    span: {
      lightweight: true,
      excludeTags: ['request.body', 'response.body'], // 排除大数据
      maxTags: 20,         // 最大标签数
      maxLogs: 10,         // 最大日志数
    },

    // 性能监控
    performance: {
      enabled: true,
      overheadThreshold: 0.05, // 5%性能开销阈值
      alertOnHighOverhead: true,
    },
  };
};
```

## 📚 相关链接

- [应用服务层文档](application-layer.md) - 应用服务层的实现
- [领域驱动设计文档](domain-layer.md) - 领域层设计模式
- [部署指南](deployment-guide.md) - 基础设施部署配置
- [监控和告警](monitoring-setup.md) - 监控系统配置
- [性能优化](performance-monitoring.md) - 性能优化策略
