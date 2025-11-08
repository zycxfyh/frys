# frys 应用服务层 (src/application/)

## 📖 模块概述

frys 的应用服务层 (src/application/)提供了企业级应用的业务逻辑实现，通过依赖注入的方式整合各个核心模块，提供用户管理、工作流执行、AI服务集成等关键业务功能。该层采用了清洁架构原则，确保业务逻辑与基础设施解耦。

### 🎯 核心特性

- **业务逻辑封装** - 完整的业务规则和流程实现
- **服务编排** - 多服务间的协调和数据流转
- **AI集成** - 多AI提供商的无缝集成
- **缓存管理** - 智能缓存策略和预热机制
- **会话管理** - 用户会话生命周期管理
- **数据管理** - 数据库操作的业务封装

### 🏗️ 服务架构

```
应用服务层 (src/application/)
├── 🤖 AI服务集成 (AI Services)
│   ├── OpenAI 服务集成
│   ├── Claude 服务集成
│   ├── Gemini 服务集成
│   ├── DeepSeek 服务集成
│   ├── LangChain 工作流集成
│   └── Cognee 记忆服务
├── 💾 缓存服务 (CacheService)
│   ├── 缓存策略管理
│   ├── 预热机制
│   └── 性能监控
├── 💬 会话管理器 (ConversationManager)
│   ├── 会话生命周期
│   ├── 上下文维护
│   └── 状态同步
├── 🗄️ 数据库管理服务 (DatabaseManagementService)
│   ├── 数据库操作封装
│   ├── 事务管理
│   └── 数据迁移
└── 🎯 用例层 (Use Cases)
    ├── 缓存管理用例
    └── 业务流程用例
```

## 🤖 AI服务集成

### 功能特性

- **多提供商支持** - 支持主流AI服务提供商
- **统一接口** - 统一的AI服务调用接口
- **智能路由** - 基于性能和成本的智能路由
- **错误处理** - 完善的错误重试和降级机制
- **令牌管理** - 自动令牌轮换和配额管理

### 快速开始

```javascript
import { container } from 'frys';

const openAIService = container.resolve('openAIService');

// OpenAI 文本生成
const response = await aiService.generateText({
  provider: 'openai',
  model: 'gpt-4',
  prompt: '解释机器学习的基本概念',
  maxTokens: 500,
});

// Claude 对话
const conversation = await aiService.createConversation({
  provider: 'claude',
  model: 'claude-3-opus-20240229',
  messages: [{ role: 'user', content: '你好，请介绍一下自己' }],
});

// 多模型比较
const results = await aiService.compareModels(
  [
    { provider: 'openai', model: 'gpt-4' },
    { provider: 'claude', model: 'claude-3-opus-20240229' },
    { provider: 'gemini', model: 'gemini-pro' },
  ],
  {
    prompt: '写一首关于AI的诗',
    criteria: ['creativity', 'coherence', 'relevance'],
  },
);
```

### AI服务配置

```javascript
// AI服务配置
const aiConfig = {
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
      models: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229'],
      maxTokens: 4096,
    },
    gemini: {
      apiKey: process.env.GOOGLE_API_KEY,
      baseURL: 'https://generativelanguage.googleapis.com',
      models: ['gemini-pro', 'gemini-pro-vision'],
    },
    deepseek: {
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: 'https://api.deepseek.com',
      models: ['deepseek-chat', 'deepseek-coder'],
    },
  },
  routing: {
    strategy: 'cost-performance', // cost, performance, latency
    fallback: true,
    retryAttempts: 3,
  },
  monitoring: {
    enableMetrics: true,
    logRequests: true,
    trackUsage: true,
  },
};
```

### 智能路由

```javascript
// 智能路由配置
const routingConfig = {
  // 基于任务类型的路由
  taskRouting: {
    'text-generation': [
      'openai:gpt-4',
      'claude:claude-3-opus',
      'gemini:gemini-pro',
    ],
    'code-generation': ['openai:gpt-4', 'deepseek:deepseek-coder'],
    analysis: ['claude:claude-3-opus', 'openai:gpt-4'],
    creative: ['gemini:gemini-pro', 'claude:claude-3-opus'],
  },

  // 基于成本的路由
  costBasedRouting: {
    budget: 0.01, // 每千tokens最大成本
    priorities: ['deepseek', 'openai', 'claude', 'gemini'],
  },

  // 基于性能的路由
  performanceRouting: {
    latency: '< 2000ms',
    throughput: '> 10 req/s',
    priorities: ['openai', 'claude', 'gemini'],
  },
};

// 动态路由选择
const optimalProvider = await aiService.selectProvider({
  task: 'code-review',
  requirements: {
    maxLatency: 3000,
    maxCost: 0.02,
    minQuality: 0.8,
  },
});
```

## 💾 缓存服务 (CacheService)

### 功能特性

- **多层缓存架构** - 内存 + Redis + 数据库的多层缓存
- **智能缓存策略** - 基于访问模式的智能缓存策略
- **自动预热** - 系统启动时的缓存预热机制
- **性能监控** - 实时缓存性能监控和分析
- **自动优化** - 基于监控数据的自动优化

### 快速开始

```javascript
import { container } from 'frys';

const cacheService = container.resolve('cacheService');

// 基础缓存操作
await cacheService.set('user:123', { id: 123, name: 'John' }, { ttl: 3600 });
const user = await cacheService.get('user:123');

// 缓存穿透保护
const userData = await cacheService.getOrSet(
  'user:profile:123',
  async () => await fetchUserFromDatabase(123),
  { ttl: 1800, strategy: 'database' },
);

// 批量操作
const users = await cacheService.mget(['user:1', 'user:2', 'user:3']);
await cacheService.mset([
  ['user:4', user4Data],
  ['user:5', user5Data],
]);
```

### 缓存策略配置

```javascript
// 缓存策略配置
const cacheConfig = {
  layers: {
    memory: {
      max: 1000, // 最大条目数
      ttl: 300, // 默认TTL（秒）
      strategy: 'lru', // LRU策略
    },
    redis: {
      host: 'localhost',
      port: 6379,
      ttl: 3600,
      strategy: 'distributed',
    },
    database: {
      ttl: 7200,
      strategy: 'persistent',
    },
  },

  strategies: {
    // 会话缓存策略
    session: {
      layers: ['memory', 'redis'],
      ttl: 1800,
      serialization: 'json',
    },

    // 配置缓存策略
    config: {
      layers: ['memory', 'redis', 'database'],
      ttl: 3600,
      compression: true,
    },

    // 数据库查询缓存策略
    database: {
      layers: ['memory', 'redis'],
      ttl: 600,
      invalidation: 'time-based',
    },
  },
};
```

### 智能缓存策略

```javascript
// 创建智能缓存策略
const smartStrategy = cacheService.createSmartStrategy({
  accessPattern: 'read-heavy', // read-heavy, write-heavy, balanced
  dataType: 'user-data', // user-data, config, query-results
  freshness: 'medium', // high, medium, low
});

// 访问模式策略
const readHeavyStrategy = cacheService.createAccessPatternStrategy({
  readRatio: 0.9, // 90%读操作
  writeRatio: 0.1, // 10%写操作
  burstTolerance: 0.2, // 突发写入容忍度
});

// 新鲜度策略
const freshStrategy = cacheService.createFreshnessStrategy({
  maxAge: 300, // 最大年龄5分钟
  stalenessTolerance: 0.1, // 10%陈旧容忍度
  refreshThreshold: 0.8, // 80%时刷新
});

// 复合策略
const compositeStrategy = cacheService.createCompositeStrategy(
  [readHeavyStrategy, freshStrategy],
  'weighted',
); // 加权组合
```

### 缓存预热和监控

```javascript
// 缓存预热
await cacheService.warmup({
  keys: ['hot:key:1', 'hot:key:2'],
  strategy: 'memory',
  priority: 'high',
});

// 获取缓存统计
const stats = cacheService.getCacheStats();
console.log('缓存命中率:', stats.hitRate);
console.log('总操作数:', stats.totalOperations);

// 性能分析
const analysis = cacheService.analyzeCachePerformance();
console.log('性能分析结果:', analysis);

// 自动优化
await cacheService.optimizeCacheConfiguration();
```

## 💬 会话管理器 (ConversationManager)

### 功能特性

- **会话生命周期管理** - 完整的会话创建到销毁流程
- **上下文维护** - 智能的对话上下文管理
- **状态同步** - 多设备间的会话状态同步
- **过期处理** - 自动会话过期和清理
- **并发控制** - 多并发会话的安全处理

### 快速开始

```javascript
import { container } from 'frys';

const conversationManager = container.resolve('conversationManager');

// 创建新会话
const session = await conversationManager.createSession({
  userId: 'user123',
  type: 'ai-chat',
  metadata: {
    provider: 'openai',
    model: 'gpt-4',
  },
});

// 添加消息到会话
await conversationManager.addMessage(session.id, {
  role: 'user',
  content: '你好，我想了解机器学习',
  timestamp: new Date(),
});

// 获取会话历史
const history = await conversationManager.getSessionHistory(session.id, {
  limit: 50,
  offset: 0,
});

// 更新会话上下文
await conversationManager.updateContext(session.id, {
  currentTopic: 'machine-learning',
  userPreferences: ['detailed', 'examples'],
});
```

### 会话配置

```javascript
// 会话配置
const sessionConfig = {
  // 会话类型配置
  types: {
    'ai-chat': {
      maxMessages: 1000,
      maxAge: 24 * 60 * 60 * 1000, // 24小时
      autoCleanup: true,
      persistence: true,
    },
    'support-chat': {
      maxMessages: 500,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7天
      autoCleanup: true,
      persistence: true,
    },
    'temp-chat': {
      maxMessages: 50,
      maxAge: 60 * 60 * 1000, // 1小时
      autoCleanup: true,
      persistence: false,
    },
  },

  // 存储配置
  storage: {
    primary: 'redis', // 主存储
    backup: 'database', // 备份存储
    sync: true, // 启用同步
  },

  // 清理配置
  cleanup: {
    interval: 60 * 60 * 1000, // 每小时清理一次
    batchSize: 100, // 每次清理100个会话
    retentionPeriod: 30 * 24 * 60 * 60 * 1000, // 保留30天
  },
};
```

### 上下文管理

```javascript
// 上下文配置
const contextConfig = {
  // 上下文窗口大小
  windowSize: 20, // 保留最近20条消息

  // 上下文压缩
  compression: {
    enabled: true,
    threshold: 10, // 超过10条消息时压缩
    strategy: 'summary', // summary, filter, truncate
  },

  // 重要性评分
  importanceScoring: {
    enabled: true,
    factors: {
      recency: 0.3, // 最近程度权重
      relevance: 0.4, // 相关性权重
      userIntent: 0.3, // 用户意图权重
    },
  },

  // 记忆管理
  memory: {
    shortTerm: {
      capacity: 50, // 短期记忆容量
      decay: 0.1, // 衰减率
    },
    longTerm: {
      capacity: 200, // 长期记忆容量
      consolidation: 0.8, // 巩固阈值
    },
  },
};

// 高级上下文操作
const context = await conversationManager.getContext(sessionId);

// 添加上下文变量
await conversationManager.setContextVariable(sessionId, 'user_role', 'premium');

// 获取相关上下文
const relevantContext = await conversationManager.getRelevantContext(
  sessionId,
  {
    query: '机器学习项目',
    limit: 10,
    threshold: 0.7,
  },
);
```

## 🗄️ 数据库管理服务 (DatabaseManagementService)

### 功能特性

- **数据库操作封装** - 统一的数据库操作接口
- **事务管理** - 复杂事务的自动管理
- **数据迁移** - 安全的数据库模式迁移
- **连接池管理** - 高效的数据库连接管理
- **查询优化** - 自动查询性能优化

### 快速开始

```javascript
import { container } from 'frys';

const dbService = container.resolve('databaseManagementService');

// 基础CRUD操作
const user = await dbService.create('users', {
  name: 'John Doe',
  email: 'john@example.com',
  createdAt: new Date(),
});

const users = await dbService.find('users', {
  where: { status: 'active' },
  limit: 10,
  orderBy: { createdAt: 'desc' },
});

// 事务操作
const result = await dbService.transaction(async (tx) => {
  // 创建用户
  const user = await tx.create('users', userData);

  // 创建用户资料
  await tx.create('user_profiles', {
    userId: user.id,
    ...profileData,
  });

  // 创建默认设置
  await tx.create('user_settings', {
    userId: user.id,
    theme: 'default',
  });

  return user;
});
```

### 数据库配置

```javascript
// 数据库配置
const dbConfig = {
  // 主数据库配置
  primary: {
    type: 'postgresql',
    host: 'localhost',
    port: 5432,
    database: 'frys_prod',
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: true,
    pool: {
      min: 2,
      max: 20,
      idle: 10000,
    },
  },

  // 只读副本配置
  readReplicas: [
    {
      host: 'replica1.example.com',
      port: 5432,
      weight: 1, // 负载均衡权重
    },
    {
      host: 'replica2.example.com',
      port: 5432,
      weight: 2,
    },
  ],

  // 迁移配置
  migrations: {
    directory: './migrations',
    tableName: 'migrations',
    safe: true, // 安全迁移模式
  },

  // 监控配置
  monitoring: {
    slowQueryThreshold: 1000, // 慢查询阈值(ms)
    enableMetrics: true,
    logQueries: process.env.NODE_ENV === 'development',
  },
};
```

### 数据迁移

```javascript
// 创建迁移
await dbService.createMigration('add_user_preferences', {
  up: async (db) => {
    // 添加新表
    await db.schema.createTable('user_preferences', (table) => {
      table.uuid('id').primary();
      table.uuid('user_id').references('users.id');
      table.jsonb('preferences').defaultTo('{}');
      table.timestamps();
    });

    // 添加索引
    await db.schema.table('user_preferences', (table) => {
      table.index('user_id');
    });
  },

  down: async (db) => {
    // 回滚迁移
    await db.schema.dropTable('user_preferences');
  },
});

// 执行迁移
await dbService.migrate('up'); // 升级到最新版本
await dbService.migrate('down', 2); // 回滚2个版本

// 检查迁移状态
const status = await dbService.getMigrationStatus();
console.log('待执行迁移:', status.pending);
console.log('已执行迁移:', status.executed);
```

## 🎯 用例层 (Use Cases)

### 功能特性

- **业务用例封装** - 完整的业务流程实现
- **输入验证** - 严格的输入数据验证
- **错误处理** - 统一的业务错误处理
- **事务保证** - 业务操作的ACID保证
- **审计日志** - 完整的操作审计记录

### 缓存管理用例

```javascript
import { container } from 'frys';

const cacheManagementUseCase = container.resolve('cacheManagementUseCase');

// 缓存预热用例
await cacheManagementUseCase.warmupCache({
  strategy: 'intelligent',
  priority: 'high',
  includePatterns: ['user:*', 'config:*'],
});

// 缓存清理用例
await cacheManagementUseCase.cleanupCache({
  patterns: ['temp:*', 'expired:*'],
  strategy: 'gradual', // gradual, immediate, scheduled
  backupBeforeCleanup: true,
});

// 缓存优化用例
const optimizationResult = await cacheManagementUseCase.optimizeCache({
  analysis: true, // 执行性能分析
  recommendations: true, // 生成优化建议
  autoApply: false, // 不自动应用
});

console.log('优化建议:', optimizationResult.recommendations);
```

### 用例配置

```javascript
// 用例配置
const useCaseConfig = {
  // 缓存管理用例配置
  cacheManagement: {
    warmup: {
      concurrency: 5, // 预热并发数
      batchSize: 100, // 批处理大小
      timeout: 30000, // 超时时间
    },
    cleanup: {
      retentionPeriod: 7 * 24 * 60 * 60 * 1000, // 保留7天
      safeMode: true, // 安全清理模式
      backupEnabled: true, // 启用备份
    },
    optimization: {
      analysisInterval: 60 * 60 * 1000, // 分析间隔
      autoOptimization: false, // 不自动优化
      threshold: {
        hitRate: 0.7, // 命中率阈值
        memoryUsage: 0.8, // 内存使用阈值
      },
    },
  },

  // 业务验证配置
  validation: {
    strict: true, // 严格验证
    sanitize: true, // 数据清理
    customValidators: {
      email: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
      phone: (value) => /^\+?[\d\s\-\(\)]+$/.test(value),
    },
  },

  // 审计配置
  audit: {
    enabled: true,
    level: 'detailed', // none, basic, detailed
    storage: 'database', // database, file, both
    retention: 365, // 保留天数
  },
};
```

## 🔧 依赖注入配置

### 服务注册

```javascript
import { container } from 'frys';

// 注册应用服务
container.register('aiService', AIService);
container.register('cacheService', CacheService);
container.register('conversationManager', ConversationManager);
container.register('databaseManagementService', DatabaseManagementService);

// 注册用例
container.register('cacheManagementUseCase', CacheManagementUseCase);

// 配置服务依赖
container.register(
  'aiService',
  (c) =>
    new AIService({
      http: c.resolve('http'),
      config: c.resolve('config'),
      logger: c.resolve('logger'),
    }),
);

container.register(
  'cacheService',
  (c) =>
    new CacheService({
      cacheManager: c.resolve('cacheManager'),
      strategies: c.resolve('cacheStrategies'),
      logger: c.resolve('logger'),
    }),
);
```

### 服务依赖图

```javascript
// 服务依赖关系图
const serviceDependencies = {
  aiService: ['http', 'config', 'logger', 'cache'],
  cacheService: ['cacheManager', 'cacheStrategies', 'logger'],
  conversationManager: ['cache', 'database', 'logger', 'events'],
  databaseManagementService: ['database', 'logger', 'migrations'],
  cacheManagementUseCase: ['cacheService', 'logger', 'metrics'],
};

// 循环依赖检测
function detectCircularDependencies(deps) {
  const visited = new Set();
  const recursionStack = new Set();

  function hasCycle(service) {
    if (recursionStack.has(service)) return true;
    if (visited.has(service)) return false;

    visited.add(service);
    recursionStack.add(service);

    for (const dep of deps[service] || []) {
      if (hasCycle(dep)) return true;
    }

    recursionStack.delete(service);
    return false;
  }

  for (const service of Object.keys(deps)) {
    if (hasCycle(service)) {
      throw new Error(`循环依赖检测到: ${service}`);
    }
  }
}
```

## 📊 监控和指标

### 应用服务指标

```javascript
// AI服务指标
const aiMetrics = {
  totalRequests: await aiService.getTotalRequests(),
  successRate: await aiService.getSuccessRate(),
  averageLatency: await aiService.getAverageLatency(),
  costPerRequest: await aiService.getCostPerRequest(),
  providerUsage: await aiService.getProviderUsage(),
};

// 缓存服务指标
const cacheMetrics = {
  hitRate: await cacheService.getHitRate(),
  totalOperations: await cacheService.getTotalOperations(),
  memoryUsage: await cacheService.getMemoryUsage(),
  evictionRate: await cacheService.getEvictionRate(),
};

// 会话管理指标
const sessionMetrics = {
  activeSessions: await conversationManager.getActiveSessionCount(),
  totalSessions: await conversationManager.getTotalSessionCount(),
  averageSessionDuration: await conversationManager.getAverageSessionDuration(),
  sessionCreationRate: await conversationManager.getSessionCreationRate(),
};
```

### 性能监控

```javascript
// 应用服务性能监控
class ApplicationPerformanceMonitor {
  constructor(services) {
    this.services = services;
    this.metrics = new Map();
  }

  async startMonitoring() {
    setInterval(async () => {
      await this.collectMetrics();
      await this.analyzePerformance();
      await this.generateReports();
    }, 60000); // 每分钟监控
  }

  async collectMetrics() {
    // 收集各服务指标
    const metrics = {
      ai: await this.services.ai.getMetrics(),
      cache: await this.services.cache.getMetrics(),
      database: await this.services.database.getMetrics(),
      sessions: await this.services.sessions.getMetrics(),
    };

    this.metrics.set(new Date().toISOString(), metrics);
  }

  async analyzePerformance() {
    const current = this.getLatestMetrics();

    // 性能分析逻辑
    const analysis = {
      bottlenecks: this.identifyBottlenecks(current),
      optimizations: this.suggestOptimizations(current),
      alerts: this.generateAlerts(current),
    };

    return analysis;
  }
}
```

## 🧪 测试策略

### 单元测试

```javascript
import { describe, it, expect, vi } from 'vitest';

describe('CacheService', () => {
  let cacheService;
  let mockCacheManager;
  let mockStrategies;

  beforeEach(() => {
    mockCacheManager = {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
    };

    mockStrategies = {
      strategies: new Map(),
      getStrategyNames: vi.fn(),
    };

    cacheService = new CacheService();
    cacheService.cacheManager = mockCacheManager;
    cacheService.strategies = mockStrategies;
  });

  it('should get cache value successfully', async () => {
    const testKey = 'test:key';
    const testValue = { data: 'test' };

    mockCacheManager.get.mockResolvedValue(testValue);

    const result = await cacheService.get(testKey);

    expect(mockCacheManager.get).toHaveBeenCalledWith(testKey, {});
    expect(result).toEqual(testValue);
  });

  it('should handle cache miss gracefully', async () => {
    mockCacheManager.get.mockResolvedValue(null);

    const result = await cacheService.get('nonexistent:key');

    expect(result).toBeNull();
  });
});
```

### 集成测试

```javascript
describe('AI Service Integration', () => {
  let container;
  let aiService;
  let mockHttp;
  let mockConfig;

  beforeEach(async () => {
    container = createTestContainer();

    mockHttp = { post: vi.fn() };
    mockConfig = { get: vi.fn() };

    container.register('http', mockHttp);
    container.register('config', mockConfig);

    aiService = container.resolve('aiService');
  });

  it('should generate text with OpenAI', async () => {
    const request = {
      provider: 'openai',
      model: 'gpt-4',
      prompt: 'Hello, world!',
      maxTokens: 100,
    };

    const mockResponse = {
      choices: [{ text: 'Hello, world! How can I help you?' }],
    };

    mockHttp.post.mockResolvedValue({ data: mockResponse });
    mockConfig.get.mockReturnValue('sk-test-key');

    const result = await aiService.generateText(request);

    expect(mockHttp.post).toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it('should handle provider fallback', async () => {
    // 配置主提供商失败，备用提供商成功
    mockHttp.post
      .mockRejectedValueOnce(new Error('OpenAI failed'))
      .mockResolvedValueOnce({
        data: { choices: [{ text: 'Response from Claude' }] },
      });

    const result = await aiService.generateText({
      provider: 'openai',
      fallbackProviders: ['claude'],
      prompt: 'Test prompt',
    });

    expect(result).toBeDefined();
  });
});
```

## ❓ 常见问题

### Q: 如何选择合适的AI提供商？

**A:** 根据使用场景和需求选择：

- **代码生成**: DeepSeek Coder 或 GPT-4
- **创意写作**: Claude 或 Gemini
- **分析推理**: GPT-4 或 Claude
- **成本敏感**: DeepSeek 或 Gemini

```javascript
// 智能选择算法
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

### Q: 缓存策略如何优化？

**A:** 基于访问模式和数据特征优化：

```javascript
// 缓存策略优化
const optimizeCacheStrategy = async (usagePatterns) => {
  const analysis = analyzeUsagePatterns(usagePatterns);

  if (analysis.readHeavy > 0.8) {
    return 'read-optimized-lru';
  } else if (analysis.writeHeavy > 0.8) {
    return 'write-through';
  } else if (analysis.temporalLocality > 0.7) {
    return 'time-based-ttl';
  } else {
    return 'adaptive-lru';
  }
};
```

### Q: 会话管理的最佳实践？

**A:** 实现高效的会话管理：

```javascript
// 会话管理最佳实践
class SessionManager {
  // 定期清理过期会话
  async cleanupExpiredSessions() {
    const expired = await this.findExpiredSessions();
    await this.bulkDeleteSessions(expired);
  }

  // 压缩大会话
  async compressLargeSessions() {
    const largeSessions = await this.findLargeSessions();
    for (const session of largeSessions) {
      await this.compressSession(session.id);
    }
  }

  // 预热活跃会话
  async warmupActiveSessions() {
    const active = await this.getActiveSessionIds();
    await this.cache.warmup(active, (id) => this.loadSession(id));
  }
}
```

## 📚 相关链接

- [核心模块文档](core-modules.md) - 了解底层核心模块
- [领域驱动设计文档](domain-layer.md) - 领域层设计模式
- [基础设施层文档](infrastructure-layer.md) - 基础设施实现
- [API 文档](../api/api-documentation.md) - 完整的API参考
- [测试策略](../testing/testing-architecture.md) - 测试最佳实践
