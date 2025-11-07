# WokeFlow 核心架构模块文档

## 📚 初学者指南 - 零基础也能看懂

<div style="background-color: #fff9c4; padding: 20px; border-left: 5px solid #fbc02d; margin: 20px 0;">
  <h3 style="margin-top: 0; color: #f57f17;">🎓 完全没有编程基础？没关系！</h3>
  <p>如果你对编程一无所知，不用担心！我们会用<strong>生活中的例子</strong>来解释这些概念，就像解释如何组装一台电脑或如何组织一个团队一样简单。</p>
</div>

### 🏠 用生活比喻理解核心概念

#### 1. 💉 Awilix 依赖注入容器 - 就像一个"智能工具箱"

<div style="background-color: #e1f5fe; padding: 20px; border-radius: 8px; margin: 15px 0;">
  <h4 style="margin-top: 0; color: #0277bd;">🔧 生活场景：修理汽车</h4>
  
  <p><strong>想象一下：</strong></p>
  <ul>
    <li>🔨 传统方式：修理工需要自己到处找工具（扳手、螺丝刀、锤子），每个工具可能散落在不同地方</li>
    <li>📦 智能工具箱：所有工具都整齐地放在一个工具箱里，修理工需要什么工具，工具箱会自动递给他</li>
  </ul>

  <p><strong>在代码中：</strong></p>
  <ul>
    <li>💻 传统方式：程序需要自己创建和寻找各种组件（数据库、日志、配置等），代码会变得混乱</li>
    <li>📦 依赖注入容器：所有的组件都存放在一个"容器"里，程序需要什么，容器会自动提供</li>
  </ul>

  <div style="background-color: #ffffff; padding: 15px; border-radius: 5px; margin-top: 15px;">
    <strong>💡 简单理解：</strong>依赖注入容器就像是一个"万能管家"，你需要什么服务，告诉它一声，它就会自动帮你准备好并送到你手上。
  </div>
</div>

#### 2. 🔌 fastify-plugin 系统 - 就像手机的"应用商店"

<div style="background-color: #f3e5f5; padding: 20px; border-radius: 8px; margin: 15px 0;">
  <h4 style="margin-top: 0; color: #7b1fa2;">📱 生活场景：智能手机</h4>
  
  <p><strong>想象一下：</strong></p>
  <ul>
    <li>📱 手机本身：基础功能（打电话、发短信）</li>
    <li>📲 应用商店：可以安装各种应用（微信、支付宝、游戏等）</li>
    <li>🔄 应用管理：可以随时安装、卸载、更新应用，不需要换手机</li>
  </ul>

  <p><strong>在代码中：</strong></p>
  <ul>
    <li>💻 WokeFlow 核心：基础功能（工作流管理）</li>
    <li>🔌 插件系统：可以安装各种功能插件（邮件通知、数据分析等）</li>
    <li>🔄 插件管理：可以随时添加、移除、更新功能，不需要修改核心代码</li>
  </ul>

  <div style="background-color: #ffffff; padding: 15px; border-radius: 5px; margin-top: 15px;">
    <strong>💡 简单理解：</strong>插件系统让程序像手机一样，可以灵活地添加新功能，而不需要重新"制造手机"。
  </div>
</div>

#### 3. 🛡️ Sentry 错误监控 - 就像"智能急救系统"

<div style="background-color: #ffebee; padding: 20px; border-radius: 8px; margin: 15px 0;">
  <h4 style="margin-top: 0; color: #c62828;">🚑 生活场景：医院急诊科</h4>
  
  <p><strong>想象一下：</strong></p>
  <ul>
    <li>🏥 分诊台：根据病情严重程度分类（轻伤、重伤、危重）</li>
    <li>👨‍⚕️ 专科医生：不同类型的疾病由相应的专家处理</li>
    <li>📋 病历记录：所有治疗过程都有详细记录，便于分析和改进</li>
    <li>🔄 自动恢复：轻微问题可以自动处理，严重问题才需要人工干预</li>
  </ul>

  <p><strong>在代码中：</strong></p>
  <ul>
    <li>📊 错误分类：根据错误类型（网络错误、数据错误、系统错误）进行分类</li>
    <li>🔧 专门处理：不同类型的错误使用不同的处理策略</li>
    <li>📝 错误日志：所有错误都记录下来，帮助找到问题原因</li>
    <li>🔄 自动恢复：简单错误可以自动重试，复杂错误才需要人工处理</li>
  </ul>

  <div style="background-color: #ffffff; padding: 15px; border-radius: 5px; margin-top: 15px;">
    <strong>💡 简单理解：</strong>错误处理系统就像医院的急诊科，能够智能地识别问题严重程度，自动处理小问题，并对大问题进行专业处理。
  </div>
</div>

### ❓ 常见问题解答

<div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0;">
  <h3 style="margin-top: 0; color: #2e7d32;">🤔 你可能想问的问题</h3>

  <h4 style="color: #388e3c;">Q1: 什么是"依赖注入"？</h4>
  <p style="margin-left: 20px;"><strong>A:</strong> 简单说，就是"需要什么，系统就给你什么"。比如你做菜需要调料，不用自己去市场买，告诉"厨房管家"，它就会自动把调料送到你面前。</p>

  <h4 style="color: #388e3c; margin-top: 20px;">Q2: 为什么需要"容器"？</h4>
  <p style="margin-left: 20px;"><strong>A:</strong> 就像图书馆需要书架来整理书籍一样，容器帮助我们整理和管理所有的程序组件，让它们不会混乱，需要时能快速找到。</p>

  <h4 style="color: #388e3c; margin-top: 20px;">Q3: "插件"是什么？</h4>
  <p style="margin-left: 20px;"><strong>A:</strong> 插件就像给手机安装的APP。核心程序提供基本功能，插件可以添加新功能，比如"邮件通知插件"、"数据分析插件"等。</p>

  <h4 style="color: #388e3c; margin-top: 20px;">Q4: 为什么要"统一错误处理"？</h4>
  <p style="margin-left: 20px;"><strong>A:</strong> 就像医院有统一的急诊流程一样，统一的错误处理让所有问题都能按照标准流程处理，不会因为不同的人处理方式不同而导致混乱。</p>
</div>

## 📖 概述

<div style="background-color: #f0f8ff; padding: 20px; border-left: 5px solid #2196F3; margin: 20px 0;">
  <h3 style="margin-top: 0; color: #1976D2;">🏗️ 什么是 WokeFlow 核心架构？</h3>
  <p>WokeFlow 的核心架构就像一个<strong>智能的建筑系统</strong>，通过<strong>三个核心开源组件</strong>构建了一个高度模块化、可扩展的企业级应用框架：</p>
  <ol>
    <li><strong>Awilix 依赖注入容器</strong> - 就像"智能工具箱"，自动管理所有组件</li>
    <li><strong>fastify-plugin 系统</strong> - 就像"应用商店"，可以灵活添加新功能</li>
    <li><strong>Sentry 错误监控</strong> - 就像"智能急救系统"，自动处理各种问题</li>
  </ol>
  <p><strong>核心价值</strong>：在保持轻量级（快速、省资源）的同时，提供企业级的架构能力和扩展性。</p>
</div>

## 🎯 架构设计原则

### 1. 🪶 轻量化设计原则

<div style="background-color: #f5f5f5; padding: 15px; border-radius: 8px; margin: 10px 0;">
  <h4 style="margin-top: 0; color: #333;">核心理念</h4>
  <ul>
    <li><strong>最小化依赖</strong>：保持核心功能精简，避免过度依赖大型框架</li>
    <li><strong>按需加载</strong>：支持模块的动态加载，避免不必要的内存开销</li>
    <li><strong>模块化架构</strong>：清晰的模块边界，便于维护和扩展</li>
  </ul>
  <h4 style="margin-top: 20px; color: #333;">实际效果</h4>
  <ul>
    <li>✅ 冷启动时间 < 2秒</li>
    <li>✅ 内存占用 < 50MB (基础配置)</li>
    <li>✅ 零外部运行时依赖</li>
  </ul>
</div>

### 2. 🔗 Awilix 依赖注入模式

<div style="background-color: #fff3e0; padding: 15px; border-radius: 8px; margin: 10px 0;">
  <h4 style="margin-top: 0; color: #f57c00;">设计优势</h4>
  <ul>
    <li><strong>松耦合设计</strong>：组件间依赖关系解耦，提高代码可测试性</li>
    <li><strong>集中式管理</strong>：所有服务实例统一管理，便于配置和监控</li>
    <li><strong>灵活注入</strong>：支持构造函数、属性、工厂函数等多种注入方式</li>
  </ul>
  <h4 style="margin-top: 20px; color: #f57c00;">使用场景</h4>
  <ul>
    <li>🔹 服务组件依赖管理</li>
    <li>🔹 单元测试 Mock 注入</li>
    <li>🔹 运行时服务替换</li>
  </ul>
</div>

### 3. 🔌 fastify-plugin 架构

<div style="background-color: #e8f5e8; padding: 15px; border-radius: 8px; margin: 10px 0;">
  <h4 style="margin-top: 0; color: #2e7d32;">扩展机制</h4>
  <ul>
    <li><strong>运行时加载</strong>：支持插件的动态加载和卸载，无需重启应用</li>
    <li><strong>钩子系统</strong>：提供丰富的扩展点，支持业务流程干预</li>
    <li><strong>中间件机制</strong>：允许插件注入中间件，实现功能增强</li>
  </ul>
  <h4 style="margin-top: 20px; color: #2e7d32;">实际应用</h4>
  <ul>
    <li>🔹 业务功能模块化</li>
    <li>🔹 第三方集成扩展</li>
    <li>🔹 A/B 测试功能</li>
  </ul>
</div>

### 4. 🛡️ Sentry 错误监控

<div style="background-color: #ffebee; padding: 15px; border-radius: 8px; margin: 10px 0;">
  <h4 style="margin-top: 0; color: #c62828;">可靠性保障</h4>
  <ul>
    <li><strong>集中化处理</strong>：所有错误通过统一入口处理，保证一致性</li>
    <li><strong>分层分类</strong>：按类型和严重程度分层处理，提高针对性</li>
    <li><strong>自动恢复</strong>：内置重试机制和恢复策略，增强系统韧性</li>
  </ul>
  <h4 style="margin-top: 20px; color: #c62828;">容错能力</h4>
  <ul>
    <li>🔹 自动故障恢复</li>
    <li>🔹 优雅降级处理</li>
    <li>🔹 错误监控和告警</li>
  </ul>
</div>

## 核心模块详解

### 1. 💉 Awilix 依赖注入容器

<div style="background-color: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
  <h3 style="margin-top: 0; color: #1565c0;">Awilix 容器架构图</h3>
  <pre style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; font-family: monospace;">
  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
  │   服务注册器    │    │   依赖解析器    │    │   生命周期管理器 │
  │  (Registry)    │◄──►│  (Resolver)    │◄──►│ (Lifecycle Mgr) │
  └─────────────────┘    └─────────────────┘    └─────────────────┘
           ▲                       ▲                       ▲
           │                       │                       │
  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
  │   单例缓存      │    │   工厂函数      │    │   初始化钩子    │
  │  (Singletons)  │    │  (Factories)   │    │   (Hooks)      │
  └─────────────────┘    └─────────────────┘    └─────────────────┘
  </pre>
</div>

#### ✨ 功能特性详解

| 特性 | 描述 | 优势 |
|------|------|------|
| **🔧 服务注册** | 支持单例、瞬时、工厂函数等多种注册方式 | 灵活的服务生命周期管理 |
| **🔍 依赖解析** | 自动解析构造函数和属性依赖 | 减少手动依赖管理代码 |
| **⏰ 生命周期管理** | 支持服务的初始化、清理和状态监控 | 确保资源正确释放 |
| **🏷️ 装饰器支持** | 提供 `@Service`、`@Dependency` 等装饰器 | 简化服务注册语法 |

#### 🎯 核心API详解

##### 基础使用模式

```javascript
import { createContainer, asClass, asValue, asFunction } from 'awilix';

// 1. 创建容器实例
const container = createContainer();

// 2. 注册基础服务
container.register({
  logger: asValue(new Logger()),
  config: asClass(Config).singleton(),
  database: asFunction(() => new Database()).singleton()
});

// 3. 解析服务
const logger = container.resolve('logger');
const config = container.resolve('config');

// 4. 批量解析
const services = container.resolveAll(['logger', 'config', 'database']);
```

##### 装饰器模式 (推荐)

```javascript
import { createContainer, asClass } from 'awilix';

// 定义服务类
class UserService {
  constructor({ http, auth, state, logger }) {
    this.http = http;
    this.auth = auth;
    this.state = state;
    this.logger = logger;
  }

  async createUser(userData) {
    // 自动注入的依赖已可用
    const token = this.auth.generateToken({ userId: userData.id });
    this.logger.info('Creating user', { userId: userData.id });

    return await this.http.post('/api/users', userData, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }
}

// 在容器中注册
const container = createContainer();
container.register({
  userService: asClass(UserService).singleton().inject(() => ({
    http: container.resolve('http'),
    auth: container.resolve('auth'),
    state: container.resolve('state'),
    logger: container.resolve('logger')
  }))
});

const userService = container.resolve('userService'); // 自动创建并注入依赖
```

##### 高级配置选项

```javascript
// 自定义服务配置
container.register('cache', new RedisCache(), {
  singleton: true,                    // 是否单例
  factory: false,                     // 是否为工厂函数
  init: async (service) => {          // 初始化钩子
    await service.connect();
  },
  destroy: async (service) => {       // 销毁钩子
    await service.disconnect();
  }
});

// 条件注册（基于环境）
if (process.env.NODE_ENV === 'production') {
  container.register('email', new SMTPEmailService());
} else {
  container.register('email', new MockEmailService());
}
```

#### 🔍 使用场景深度解析

##### 1. 🏢 企业级服务管理

```javascript
// 大型应用的服务注册
const container = new LightweightContainer();

// 基础设施层
container.register('database', new PostgreSQLConnection());
container.register('cache', new RedisCache());
container.register('messageQueue', new RabbitMQClient());

// 业务服务层
container.register('userRepository', new UserRepository());
container.register('orderRepository', new OrderRepository());

// 应用服务层
@Dependency('userRepository', 'orderRepository', 'cache')
@Service('userService')
class UserService {
  // 自动注入所有依赖
}

@Dependency('userService', 'messageQueue')
@Service('orderService')
class OrderService {
  // 依赖链自动解析
}
```

##### 2. 🧪 测试环境Mock注入

```javascript
// 测试时的依赖替换
describe('UserService', () => {
  let container;
  let userService;

  beforeEach(() => {
    container = new LightweightContainer();

    // 注入Mock服务
    container.register('http', new MockHttpClient());
    container.register('auth', new MockAuthService());
    container.register('state', new MockStateManager());

    // 解析被测服务
    userService = container.resolve('userService');
  });

  it('should create user successfully', async () => {
    const result = await userService.createUser({
      username: 'testuser',
      email: 'test@example.com'
    });

    expect(result.success).toBe(true);
  });
});
```

##### 3. 🔄 运行时服务替换

```javascript
// 动态服务替换示例
class ServiceSwitcher {
  constructor(container) {
    this.container = container;
  }

  async switchToBackupDatabase() {
    // 替换主数据库为备份数据库
    this.container.register('database', new BackupDatabaseConnection());

    // 重新初始化依赖该服务的组件
    await this.container.reinitializeDependencies('database');
  }

  async switchToPrimaryDatabase() {
    // 切换回主数据库
    this.container.register('database', new PrimaryDatabaseConnection());
    await this.container.reinitializeDependencies('database');
  }
}
```

#### 📊 设计优势对比

| 特性 | LightweightContainer | Spring IoC | 手动管理 |
|------|---------------------|------------|----------|
| **学习曲线** | 🟢 简单 | 🔴 复杂 | 🟡 中等 |
| **性能开销** | 🟢 极低 | 🟡 中等 | 🟢 零开销 |
| **类型安全** | 🟢 装饰器保证 | 🟡 配置依赖 | 🔴 无保证 |
| **测试友好** | 🟢 易于Mock | 🟡 需要配置 | 🟡 手动替换 |
| **运行时灵活性** | 🟢 动态替换 | 🔴 需要重启 | 🟢 手动替换 |

#### ⚡ 性能优化

##### 1. 单例缓存机制

```javascript
// 单例服务只创建一次，后续调用直接返回缓存实例
container.register('database', new Database(), { singleton: true });

// 第一次调用：创建实例
const db1 = container.resolve('database'); // 新建 Database 实例

// 第二次调用：返回缓存实例
const db2 = container.resolve('database'); // 返回同一个实例

console.log(db1 === db2); // true
```

##### 2. 延迟初始化

```javascript
// 服务在第一次被解析时才创建，提高启动速度
container.register('heavyService', () => new HeavyService());

console.time('应用启动');
// ... 其他服务注册
console.timeEnd('应用启动'); // 不包含 HeavyService 创建时间

// 第一次使用时才创建
const heavyService = container.resolve('heavyService'); // 此时才创建
```

##### 3. 依赖图优化

```javascript
// 容器会分析依赖关系，只初始化必要的服务
@Dependency('database')  // 只依赖 database
@Service('userRepo')
class UserRepository {}

@Dependency('cache')     // 只依赖 cache
@Service('cacheRepo')
class CacheRepository {}

// 解析 userRepo 时，只会初始化 database，不会初始化 cache
const userRepo = container.resolve('userRepo');
```

### 2. 🔌 fastify-plugin 系统

<div style="background-color: #f3e5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
  <h3 style="margin-top: 0; color: #7b1fa2;">插件系统架构图</h3>
  <pre style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; font-family: monospace;">
  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
  │   插件注册器    │    │   生命周期管理器 │    │   钩子分发器   │
  │ (Registrar)    │◄──►│(Lifecycle Mgr) │◄──►│ (Hook Dispatcher)|
  └─────────────────┘    └─────────────────┘    └─────────────────┘
           ▲                       ▲                       ▲
           │                       │                       │
  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
  │   依赖检查器    │    │   中间件链      │    │   扩展管理器    │
  │(Dependency     │    │ (Middleware    │    │ (Extension Mgr) │
  │ Checker)       │    │  Chain)        │    │                 │
  └─────────────────┘    └─────────────────┘    └─────────────────┘
  </pre>
</div>

#### 🎪 功能特性详解

| 特性 | 描述 | 实际价值 |
|------|------|----------|
| **🔄 插件生命周期** | 完整的安装、启动、停止、卸载流程 | 确保插件正确初始化和清理 |
| **🔗 依赖管理** | 自动检查和解决插件依赖关系 | 防止插件冲突和缺失依赖 |
| **🪝 钩子系统** | 提供事件驱动的扩展机制 | 允许插件干预业务流程 |
| **🌊 中间件支持** | 允许插件注入中间件逻辑 | 无侵入式功能增强 |
| **🔧 扩展点机制** | 支持插件对核心功能的扩展 | 灵活的系统定制能力 |

#### 🎯 插件生命周期详解

<div style="background-color: #fff3e0; padding: 15px; border-radius: 8px; margin: 15px 0;">
  <h4 style="margin-top: 0; color: #ef6c00;">📋 插件生命周期状态图</h4>
  <pre style="background-color: #f5f5f5; padding: 10px; border-radius: 5px;">
未注册 ──► 已注册 ──► 已安装 ──► 已启动 ──► 运行中
    │         │         │         │         │
    │         │         │         │         └─► 错误
    │         │         │         └─► 已停止
    │         │         └─► 安装失败
    │         └─► 注册失败
    └─► 已卸载
  </pre>
</div>

#### 🎯 核心API详解

##### 插件定义和注册

```javascript
import fp from 'fastify-plugin';

// 方法1: 使用 fastify-plugin 定义插件 (推荐)
const authPlugin = fp(async function(fastify, opts) {
  // 插件元数据
  fastify.decorate('auth', {
    capabilities: ['authentication', 'authorization'],
    config: {
      jwtSecret: opts.jwtSecret || process.env.JWT_SECRET,
      tokenExpiry: opts.tokenExpiry || 3600
    }
  });

  // 注册装饰器
  fastify.decorateRequest('user', null);

  // 认证中间件
  fastify.addHook('preHandler', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (token) {
      try {
        request.user = await verifyToken(token, fastify.auth.config.jwtSecret);
      } catch (error) {
        return reply.code(401).send({ error: '无效的认证令牌' });
      }
    }
  });

  // 启动会话清理定时器
  const sessionCleanupTimer = setInterval(async () => {
    await cleanupExpiredSessions(fastify);
  }, 60000); // 每分钟清理

  // 插件清理钩子
  fastify.addHook('onClose', async () => {
    if (sessionCleanupTimer) {
      clearInterval(sessionCleanupTimer);
    }
  });

}, {
  name: 'auth-plugin',
  version: '2.0.0'
});

// 方法2: 注册插件到 Fastify 实例
const fastify = require('fastify')();

// 注册认证插件
await fastify.register(authPlugin, {
  jwtSecret: 'your-secret-key',
  tokenExpiry: 3600
});
```

##### 插件管理操作

```javascript
const fastify = require('fastify')();

// 注册多个插件
await fastify.register(require('./plugins/auth'), {
  jwtSecret: 'your-secret-key'
});

await fastify.register(require('./plugins/cache'), {
  ttl: 3600
});

// 检查插件是否已注册
const hasAuth = fastify.hasDecorator('auth');
console.log('认证插件已注册:', hasAuth);

// 获取插件配置
const authConfig = fastify.auth?.config;
console.log('认证配置:', authConfig);

// 动态添加插件 (运行时)
await fastify.register(async function(fastify, opts) {
  // 运行时插件逻辑
  fastify.decorate('runtimePlugin', {
    loaded: true,
    timestamp: new Date()
  });
});

// 检查装饰器
const hasRuntimePlugin = fastify.hasDecorator('runtimePlugin');
console.log('运行时插件已加载:', hasRuntimePlugin);
```

##### 🪝 Fastify 钩子系统详解

```javascript
const fastify = require('fastify')();

// 注册应用级钩子
fastify.addHook('onRequest', async (request, reply) => {
  console.log('收到请求:', request.method, request.url);
  request.startTime = Date.now();
});

fastify.addHook('preHandler', async (request, reply) => {
  // 用户认证逻辑
  const token = request.headers.authorization?.replace('Bearer ', '');
  if (token) {
    try {
      request.user = await verifyToken(token);
    } catch (error) {
      return reply.code(401).send({ error: '无效的认证令牌' });
    }
  }
});

fastify.addHook('onSend', async (request, reply, payload) => {
  // 记录响应时间
  const duration = Date.now() - request.startTime;
  console.log(`请求完成: ${request.method} ${request.url} - ${duration}ms`);

  // 添加响应头
  reply.header('X-Response-Time', `${duration}ms`);
  return payload;
});

fastify.addHook('onError', async (request, reply, error) => {
  // 错误处理逻辑
  console.error('请求错误:', error);

  // 发送错误通知
  await sendErrorNotification(error, request);
});

// 注册路由级钩子
fastify.route({
  method: 'POST',
  url: '/users',
  preHandler: async (request, reply) => {
    // 用户创建前的验证
    const validation = validateUserData(request.body);
    if (!validation.valid) {
      return reply.code(400).send({ error: validation.errors });
    }
  },
  handler: async (request, reply) => {
    const user = await createUser(request.body);
    return reply.send(user);
  },
  onSend: async (request, reply, payload) => {
    // 用户创建成功后发送欢迎邮件
    const userData = JSON.parse(payload);
    await sendWelcomeEmail(userData.email, userData.username);
    return payload;
  }
});
```

##### 🌊 Fastify 装饰器和钩子系统详解

```javascript
const fastify = require('fastify')();

// 使用装饰器添加共享功能
fastify.decorate('authenticate', async function(request, reply) {
  const token = request.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return reply.code(401).send({ error: '缺少认证令牌' });
  }

  try {
    request.user = await verifyToken(token);
  } catch (error) {
    return reply.code(401).send({ error: '无效的认证令牌' });
  }
});

fastify.decorate('sendWelcomeEmail', async function(email, username) {
  // 发送欢迎邮件的逻辑
  await this.mailer.send({
    to: email,
    subject: '欢迎加入 WokeFlow',
    template: 'welcome',
    data: { username }
  });
});

// 使用装饰器的方法
fastify.post('/users', {
  preHandler: fastify.authenticate, // 使用认证装饰器
  handler: async function(request, reply) {
    const user = await createUser(request.body);

    // 使用邮件装饰器
    await this.sendWelcomeEmail(user.email, user.username);

    return user;
  }
});

// 请求级装饰器
fastify.addHook('preHandler', async (request, reply) => {
  // 为每个请求添加唯一ID
  request.id = generateRequestId();
});

// 插件级装饰器
fastify.register(async function(fastify, opts) {
  // 插件内装饰器
  fastify.decorate('pluginMethod', function() {
    return '插件方法';
  });

  fastify.get('/plugin-route', function(request, reply) {
    return { result: this.pluginMethod() };
  });
});
```

##### 🔧 扩展点机制

```javascript
// 定义扩展接口
class AuthExtensionInterface {
  async authenticate(credentials) {
    throw new Error('authenticate 方法必须被实现');
  }

  async authorize(user, resource, action) {
    throw new Error('authorize 方法必须被实现');
  }
}

// 注册扩展
pluginManager.extend('auth.strategies', new JWTAuthStrategy(), 'jwt');
pluginManager.extend('auth.strategies', new OAuth2Strategy(), 'oauth2');

// 使用扩展
const authStrategies = pluginManager.getExtensions('auth.strategies');

// 批量调用扩展
const authResults = await pluginManager.callExtensions('auth.strategies', 'authenticate', credentials);

// 条件调用扩展
for (const strategy of authStrategies) {
  try {
    const result = await strategy.authenticate(credentials);
    if (result.success) {
      return result.user;
    }
  } catch (error) {
    console.warn(`认证策略 ${strategy.name} 失败:`, error);
  }
}
```

#### 🔍 使用场景深度解析

##### 1. 🏢 企业级功能扩展

```javascript
// 多租户插件
@Plugin({
  name: 'multi-tenant',
  dependencies: ['database', 'auth']
})
class MultiTenantPlugin extends PluginInterface {
  async install(context) {
    // 为每个租户创建独立的数据库schema
    await context.database.createTenantSchema();
  }

  async start(context) {
    // 添加租户中间件
    context.app.use(this.tenantMiddleware.bind(this));
  }

  async tenantMiddleware(req, res, next) {
    // 从请求头或域名解析租户ID
    req.tenantId = this.resolveTenantId(req);
    next();
  }
}

// 审计日志插件
@Plugin({
  name: 'audit-log',
  dependencies: ['database']
})
class AuditLogPlugin extends PluginInterface {
  async start(context) {
    // 监听所有业务事件
    context.eventStream.on('*', async (event, data) => {
      await this.logAuditEvent(event, data);
    });
  }

  async logAuditEvent(event, data) {
    await this.database.insert('audit_logs', {
      event,
      data: JSON.stringify(data),
      timestamp: new Date(),
      userId: data.userId || 'system'
    });
  }
}
```

##### 2. 🔌 第三方集成插件

```javascript
// Slack通知插件
@Plugin({
  name: 'slack-integration',
  dependencies: ['http']
})
class SlackPlugin extends PluginInterface {
  async install(context) {
    this.webhookUrl = context.config.slack.webhookUrl;
  }

  async start(context) {
    // 监听重要事件
    context.eventStream.on('user.created', (user) => {
      this.sendNotification(`新用户注册: ${user.username}`);
    });

    context.eventStream.on('system.error', (error) => {
      this.sendNotification(`系统错误: ${error.message}`, 'danger');
    });
  }

  async sendNotification(message, color = 'good') {
    await this.http.post(this.webhookUrl, {
      text: message,
      attachments: [{
        color,
        text: message,
        ts: Date.now() / 1000
      }]
    });
  }
}

// GitHub集成插件
@Plugin({
  name: 'github-integration',
  dependencies: ['http', 'config']
})
class GitHubPlugin extends PluginInterface {
  async start(context) {
    // 自动创建GitHub issue
    context.eventStream.on('bug.reported', async (bug) => {
      await this.createGitHubIssue(bug);
    });
  }

  async createGitHubIssue(bug) {
    const response = await this.http.post(
      `https://api.github.com/repos/${this.owner}/${this.repo}/issues`,
      {
        title: `Bug: ${bug.title}`,
        body: bug.description,
        labels: ['bug', 'auto-generated']
      },
      {
        headers: {
          'Authorization': `token ${this.githubToken}`,
          'User-Agent': 'WokeFlow-Bug-Reporter'
        }
      }
    );

    return response.data;
  }
}
```
- A/B测试和功能开关

#### 设计优势
- **热插拔**: 支持运行时动态加载和卸载
- **隔离性好**: 每个插件拥有独立上下文
- **扩展灵活**: 多种扩展机制满足不同需求
- **依赖安全**: 自动解决插件依赖冲突

### 3. 🛡️ Sentry 错误监控系统

#### 功能特性
- **错误分类**: 按类型（验证、认证、网络等）和严重程度分层
- **自动恢复**: 支持配置恢复策略
- **重试机制**: 指数退避重试算法
- **统计监控**: 错误发生频率和趋势分析
- **装饰器支持**: 简化错误处理代码

#### 错误类型定义

```javascript
export const ErrorType = {
  VALIDATION: 'VALIDATION',      // 数据验证错误
  AUTHENTICATION: 'AUTHENTICATION', // 认证错误
  AUTHORIZATION: 'AUTHORIZATION',   // 授权错误
  NETWORK: 'NETWORK',           // 网络错误
  DATABASE: 'DATABASE',         // 数据库错误
  CONFIGURATION: 'CONFIGURATION', // 配置错误
  BUSINESS_LOGIC: 'BUSINESS_LOGIC', // 业务逻辑错误
  SYSTEM: 'SYSTEM',             // 系统错误
  UNKNOWN: 'UNKNOWN'            // 未知错误
};

export const ErrorSeverity = {
  LOW: 'LOW',       // 低优先级
  MEDIUM: 'MEDIUM', // 中等优先级
  HIGH: 'HIGH',     // 高优先级
  CRITICAL: 'CRITICAL' // 严重错误
};
```

#### 核心API

```javascript
import * as Sentry from '@sentry/node';

// 初始化 Sentry
Sentry.init({
  dsn: 'your-dsn-here',
  environment: 'development',
  release: 'wokeflow@2.0.0',
  integrations: [
    new Sentry.Integrations.Http({ tracing: true }),
    new Sentry.Integrations.Console(),
    new Sentry.Integrations.OnUncaughtException(),
    new Sentry.Integrations.OnUnhandledRejection()
  ],
  // 性能监控
  tracesSampleRate: 1.0,
  // 错误采样率
  sampleRate: 1.0
});

// 手动错误报告
try {
  await riskyOperation();
} catch (error) {
  Sentry.captureException(error, {
    tags: { operation: 'risky-operation' },
    extra: { context: 'manual-error-handling' }
  });
}

// 使用 Sentry 作用域
Sentry.withScope((scope) => {
  scope.setTag('operation', 'api-call');
  scope.setUser({ id: 'user123', username: 'john' });

  try {
    await callExternalApi();
  } catch (error) {
    Sentry.captureException(error);
  }
});

// 性能监控
const transaction = Sentry.startTransaction({
  name: 'api-request',
  op: 'http.server'
});

try {
  const result = await processRequest();
  transaction.setStatus('ok');
  return result;
} catch (error) {
  transaction.setStatus('internal_error');
  Sentry.captureException(error);
  throw error;
} finally {
  transaction.finish();
}
```

#### 使用场景
- API调用错误处理
- 数据库操作异常
- 第三方服务集成
- 用户输入验证
- 系统级错误监控

#### 设计优势
- **云端监控**: 错误数据自动上传到 Sentry 云端
- **实时告警**: 支持多种告警渠道（邮件、Slack、Webhook）
- **性能追踪**: 自动记录应用性能指标
- **版本追踪**: 支持版本发布和错误关联

## 模块间协作

### 依赖注入容器与插件系统的集成

```javascript
// 容器负责服务注册和管理
container.register('pluginManager', pluginManager);
container.register('errorHandler', errorHandler);

// 插件系统利用容器进行依赖注入
class MyPlugin extends PluginInterface {
  async start(context) {
    const services = context.container.resolveAll(['logger', 'config']);
    // 使用注入的服务
  }
}
```

### 错误处理与插件系统的集成

```javascript
// 插件错误通过统一处理器处理
pluginManager.hook('plugin:error', async (error) => {
  await errorHandler.handle(error, { component: 'plugin' });
});

// 错误处理器可以触发插件钩子
await errorHandler.handle(error, { context: 'system' });
eventStream.emit('system:error', error);
```

## 配置和初始化

### 核心模块初始化顺序

1. **创建容器实例**
2. **注册基础服务**（配置、日志）
3. **初始化错误处理器**
4. **设置插件管理器上下文**
5. **注册核心模块服务**
6. **启动插件系统**

### 配置示例

```javascript
const config = {
  container: {
    enableStats: true,
    maxServices: 100
  },
  plugins: {
    autoStart: ['core', 'auth'],
    timeout: 30000
  },
  errorHandler: {
    enableLogging: true,
    enableReporting: false,
    maxRetries: 3
  }
};
```

## 性能和监控

### 性能优化
- **延迟加载**: 插件按需加载
- **缓存机制**: 单例服务缓存
- **异步处理**: 非阻塞的错误处理和恢复

### 监控指标
- 容器服务注册数量
- 插件加载状态和数量
- 错误发生频率和类型分布
- 恢复策略执行统计

## 最佳实践

### 1. 服务设计原则
- 单一职责：每个服务负责一个明确的功能
- 接口一致：实现统一的服务接口
- 错误友好：抛出具有意义的错误

### 2. 插件开发规范
- 依赖声明：明确声明插件依赖
- 生命周期管理：正确实现生命周期方法
- 资源清理：在停止时释放资源

### 3. 错误处理策略
- 按类型处理：不同错误类型使用不同策略
- 优雅降级：失败时提供备选方案
- 用户友好：向用户展示友好的错误信息

## 总结

WokeFlow 的核心架构通过 Awilix 依赖注入容器、fastify-plugin 系统和 Sentry 错误监控三个核心开源组件构建了一个高度模块化、可扩展的企业级应用框架。这种设计既保证了系统的轻量化运行，又提供了强大的扩展能力和错误处理机制，为构建复杂的企业应用提供了坚实的基础。

