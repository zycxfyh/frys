# WokeFlow 工具函数库

## 📖 概述

WokeFlow 的工具层提供了丰富的实用函数和基础服务，支持应用开发、配置管理、日志记录、缓存处理、数据验证等核心功能。这些工具经过精心设计，具有高性能、易用性和可扩展性。

### 🎯 工具层架构

```
工具层架构
├── ⚙️ 配置管理 (Configuration)
│   ├── 环境变量加载
│   ├── 配置验证
│   ├── 热重载支持
│   └── 多格式支持
├── 📝 日志系统 (Logging)
│   ├── 结构化日志
│   ├── 多级别支持
│   ├── 异步写入
│   └── 外部集成
├── 💾 缓存管理 (Caching)
│   ├── 多层缓存
│   ├── 缓存策略
│   ├── 序列化支持
│   └── 监控统计
├── ✅ 数据验证 (Validation)
│   ├── Schema验证
│   ├── 自定义规则
│   ├── 错误消息
│   └── 类型推断
└── 🛠️ 实用工具 (Utilities)
    ├── 日期时间处理
    ├── 字符串操作
    ├── 集合操作
    └── 异步工具
```

### 📊 功能特性

- **高性能**: 优化的算法和数据结构
- **类型安全**: 完整的 TypeScript 支持
- **可扩展**: 插件化架构，支持自定义扩展
- **容错性**: 完善的错误处理和降级策略
- **监控友好**: 内置性能指标和健康检查

## ⚙️ 配置管理 (Configuration)

### 功能特性

- **多源支持**: 环境变量、文件、远程配置中心
- **格式多样**: JSON、YAML、TOML、环境变量
- **类型安全**: 自动类型转换和验证
- **热重载**: 支持运行时配置更新
- **环境隔离**: 不同环境的配置隔离
- **加密支持**: 敏感配置的加密存储

### 快速开始

```javascript
import { ConfigManager } from 'wokeflow/utils';

// 创建配置管理器
const configManager = new ConfigManager({
  // 配置源
  sources: [
    { type: 'env', prefix: 'APP_' },
    { type: 'file', path: './config/default.json' },
    { type: 'file', path: `./config/${process.env.NODE_ENV}.json` },
    { type: 'remote', url: 'http://config-server/config' }
  ],
  // 验证规则
  schema: {
    type: 'object',
    properties: {
      port: { type: 'number', default: 3000 },
      database: {
        type: 'object',
        properties: {
          host: { type: 'string' },
          port: { type: 'number', default: 5432 },
          name: { type: 'string' }
        },
        required: ['host', 'name']
      }
    }
  }
});

// 加载配置
await configManager.load();

// 获取配置值
const port = configManager.get('port');
const dbHost = configManager.get('database.host');
const dbConfig = configManager.get('database');
```

### 配置源类型

#### 环境变量源

```javascript
const envSource = {
  type: 'env',
  prefix: 'APP_',           // 环境变量前缀
  separator: '__',          // 嵌套分隔符
  transform: 'camelCase'    // 键名转换
};

// 支持的环境变量：
// APP_PORT=3000
// APP_DATABASE__HOST=localhost
// APP_DATABASE__PORT=5432
// APP_FEATURE__ENABLED=true
```

#### 文件源

```javascript
// JSON 文件源
const jsonSource = {
  type: 'file',
  path: './config/app.json',
  format: 'json',
  watch: true,              // 启用文件监听
  reloadDebounce: 1000      // 重载防抖时间
};

// YAML 文件源
const yamlSource = {
  type: 'file',
  path: './config/app.yaml',
  format: 'yaml',
  encoding: 'utf8'
};
```

#### 远程配置源

```javascript
const remoteSource = {
  type: 'remote',
  url: 'http://config-server/v1/config',
  method: 'GET',
  headers: {
    'Authorization': 'Bearer ' + process.env.CONFIG_TOKEN,
    'X-Service-Name': 'wokeflow'
  },
  timeout: 5000,
  retry: {
    attempts: 3,
    delay: 1000,
    backoff: 2
  },
  cache: {
    ttl: 30000,             // 30秒缓存
    refreshInterval: 10000  // 10秒刷新
  }
};
```

### 配置验证

#### Schema 验证

```javascript
import Joi from 'joi';

const configSchema = Joi.object({
  app: Joi.object({
    name: Joi.string().required(),
    version: Joi.string().pattern(/^\d+\.\d+\.\d+$/),
    port: Joi.number().integer().min(1000).max(9999).default(3000),
    env: Joi.string().valid('development', 'staging', 'production').default('development')
  }).required(),

  database: Joi.object({
    host: Joi.string().hostname().required(),
    port: Joi.number().integer().min(1).max(65535).default(5432),
    name: Joi.string().min(1).max(63).required(),
    username: Joi.string().min(1).max(63).required(),
    password: Joi.string().min(8).required(),
    ssl: Joi.boolean().default(false),
    poolSize: Joi.number().integer().min(1).max(100).default(10)
  }).required(),

  redis: Joi.object({
    host: Joi.string().hostname().default('localhost'),
    port: Joi.number().integer().min(1).max(65535).default(6379),
    password: Joi.string().allow(''),
    db: Joi.number().integer().min(0).max(15).default(0)
  }).default(),

  features: Joi.object().pattern(
    Joi.string(),
    Joi.boolean()
  ).default()
});

// 使用验证
const configManager = new ConfigManager({
  sources: [...],
  validation: {
    schema: configSchema,
    allowUnknown: false,
    stripUnknown: true
  }
});
```

#### 自定义验证器

```javascript
class CustomValidator {
  validate(value: any, schema: any, path: string[]): ValidationResult {
    const errors: ValidationError[] = [];

    // 自定义验证逻辑
    if (schema.type === 'email') {
      if (!this.isValidEmail(value)) {
        errors.push({
          path: path.join('.'),
          message: 'Invalid email format',
          value
        });
      }
    }

    if (schema.type === 'url') {
      if (!this.isValidUrl(value)) {
        errors.push({
          path: path.join('.'),
          message: 'Invalid URL format',
          value
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}

// 使用自定义验证器
const configManager = new ConfigManager({
  sources: [...],
  validation: {
    validator: new CustomValidator()
  }
});
```

### 热重载配置

```javascript
class HotReloadConfigManager extends ConfigManager {
  private watchers: Map<string, FSWatcher> = new Map();

  async load(): Promise<void> {
    await super.load();
    this.setupFileWatchers();
  }

  private setupFileWatchers(): void {
    for (const source of this.sources) {
      if (source.type === 'file' && source.watch) {
        const watcher = fs.watch(source.path, {
          persistent: false,
          interval: 1000
        });

        watcher.on('change', async (eventType, filename) => {
          if (eventType === 'change') {
            this.logger.info(`Config file changed: ${filename}`);
            try {
              await this.reload();
              this.emit('reloaded', { source: source.path });
            } catch (error) {
              this.logger.error('Failed to reload config:', error);
              this.emit('reloadError', { source: source.path, error });
            }
          }
        });

        this.watchers.set(source.path, watcher);
      }
    }
  }

  async reload(): Promise<void> {
    // 重新加载所有配置源
    await this.loadSources();

    // 验证新配置
    await this.validate();

    // 通知监听器
    this.emit('configUpdated', this.getAll());
  }

  destroy(): void {
    for (const watcher of this.watchers.values()) {
      watcher.close();
    }
    this.watchers.clear();
  }
}

// 使用热重载
const configManager = new HotReloadConfigManager({...});

configManager.on('reloaded', ({ source }) => {
  console.log(`Configuration reloaded from ${source}`);
});

configManager.on('reloadError', ({ source, error }) => {
  console.error(`Failed to reload config from ${source}:`, error);
});
```

## 📝 日志系统 (Logging)

### 功能特性

- **结构化日志**: JSON格式，支持字段查询
- **多级别支持**: TRACE、DEBUG、INFO、WARN、ERROR、FATAL
- **异步写入**: 非阻塞日志写入，提高性能
- **多传输器**: 控制台、文件、远程服务
- **上下文支持**: 请求ID、用户ID等上下文信息
- **性能监控**: 日志写入性能统计

### 快速开始

```javascript
import { Logger, ConsoleTransport, FileTransport } from 'wokeflow/utils';

// 创建日志器
const logger = new Logger({
  level: 'info',
  format: 'json',
  transports: [
    new ConsoleTransport({
      colorize: true,
      timestamp: true
    }),
    new FileTransport({
      filename: 'logs/app.log',
      maxSize: '10m',
      maxFiles: 5,
      compress: true
    })
  ]
});

// 基本日志记录
logger.info('Application started', { port: 3000 });
logger.error('Database connection failed', { error: error.message });
logger.warn('Deprecated API usage', { endpoint: '/old-api' });

// 结构化日志
logger.info('User login successful', {
  userId: '12345',
  username: 'john_doe',
  ip: '192.168.1.100',
  userAgent: 'Mozilla/5.0...'
});
```

### 日志级别

```javascript
enum LogLevel {
  TRACE = 0,    // 最详细的跟踪信息
  DEBUG = 1,    // 调试信息
  INFO = 2,     // 一般信息
  WARN = 3,     // 警告信息
  ERROR = 4,    // 错误信息
  FATAL = 5     // 致命错误
}

// 使用不同的日志级别
logger.trace('Entering function', { function: 'processData', args });
logger.debug('Cache miss', { key: 'user:123', reason: 'expired' });
logger.info('User created', { userId: '123', email: 'user@example.com' });
logger.warn('Rate limit exceeded', { ip: '192.168.1.100', limit: 100 });
logger.error('Payment failed', { orderId: 'ORD-123', error: error.message });
logger.fatal('Database unavailable', { error: error.message });
```

### 传输器 (Transports)

#### 控制台传输器

```javascript
const consoleTransport = new ConsoleTransport({
  level: 'debug',
  colorize: process.env.NODE_ENV !== 'production',
  timestamp: true,
  timestampFormat: 'YYYY-MM-DD HH:mm:ss.SSS',
  include: ['level', 'message', 'timestamp'], // 包含的字段
  exclude: ['pid', 'hostname']                // 排除的字段
});
```

#### 文件传输器

```javascript
const fileTransport = new FileTransport({
  filename: 'logs/app.log',
  level: 'info',
  maxSize: '10m',           // 文件最大大小
  maxFiles: 5,              // 最大文件数量
  compress: true,           // 压缩旧文件
  format: 'json',
  sync: false,              // 异步写入
  bufferSize: 64 * 1024     // 缓冲区大小
});
```

#### 远程传输器

```javascript
const remoteTransport = new RemoteTransport({
  url: 'https://logs.example.com/api/logs',
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + process.env.LOG_TOKEN,
    'Content-Type': 'application/json'
  },
  batchSize: 10,            // 批量发送大小
  flushInterval: 5000,      // 刷新间隔
  retry: {
    attempts: 3,
    delay: 1000,
    backoff: 2
  },
  queueSize: 1000           // 队列大小限制
});
```

### 上下文和子日志器

```javascript
// 请求上下文日志器
class RequestLogger {
  constructor(private baseLogger: Logger) {}

  createRequestLogger(requestId: string, userId?: string) {
    return this.baseLogger.child({
      requestId,
      userId,
      correlationId: requestId
    });
  }
}

// 使用上下文日志器
app.addHook('onRequest', async (request, reply) => {
  const requestLogger = requestLogger.createRequestLogger(
    request.id,
    request.user?.id
  );

  request.log = requestLogger;
});

app.get('/users/:id', async (request, reply) => {
  request.log.info('Fetching user', { userId: request.params.id });

  try {
    const user = await userService.findById(request.params.id);
    request.log.info('User found', { userFound: !!user });
    return user;
  } catch (error) {
    request.log.error('Failed to fetch user', {
      userId: request.params.id,
      error: error.message
    });
    throw error;
  }
});
```

### 性能监控

```javascript
class MonitoredLogger extends Logger {
  private metrics = {
    logsWritten: 0,
    errorsLogged: 0,
    writeTime: [],
    queueSize: 0
  };

  async writeLog(level: LogLevel, message: string, meta: any): Promise<void> {
    const startTime = process.hrtime.bigint();

    try {
      await super.writeLog(level, message, meta);

      this.metrics.logsWritten++;
      if (level >= LogLevel.ERROR) {
        this.metrics.errorsLogged++;
      }

      const writeTime = Number(process.hrtime.bigint() - startTime) / 1e6; // 毫秒
      this.metrics.writeTime.push(writeTime);

      // 保持最近1000个写操作的时间
      if (this.metrics.writeTime.length > 1000) {
        this.metrics.writeTime.shift();
      }

    } catch (error) {
      this.metrics.errorsLogged++;
      throw error;
    }
  }

  getMetrics() {
    const writeTimes = this.metrics.writeTime;
    const avgWriteTime = writeTimes.length > 0
      ? writeTimes.reduce((a, b) => a + b, 0) / writeTimes.length
      : 0;

    return {
      logsWritten: this.metrics.logsWritten,
      errorsLogged: this.metrics.errorsLogged,
      averageWriteTime: avgWriteTime,
      maxWriteTime: Math.max(...writeTimes, 0),
      minWriteTime: Math.min(...writeTimes, Infinity),
      queueSize: this.metrics.queueSize
    };
  }
}
```

## 💾 缓存管理 (Caching)

### 功能特性

- **多层缓存**: L1内存缓存 + L2分布式缓存
- **多种策略**: LRU、LFU、TTL、Write-through
- **序列化支持**: JSON、MessagePack、二进制
- **缓存预热**: 启动时预加载热点数据
- **监控统计**: 命中率、响应时间等指标
- **集群支持**: 分布式缓存同步

### 快速开始

```javascript
import { CacheManager, MemoryCache, RedisCache } from 'wokeflow/utils';

// 创建多层缓存管理器
const cacheManager = new CacheManager({
  layers: [
    // L1: 内存缓存
    new MemoryCache({
      maxSize: 1000,
      ttl: 300,          // 5分钟
      strategy: 'lru'
    }),
    // L2: Redis缓存
    new RedisCache({
      host: 'localhost',
      port: 6379,
      ttl: 3600,         // 1小时
      prefix: 'wokeflow:'
    })
  ],
  serialization: 'json'
});

// 基本缓存操作
await cacheManager.set('user:123', { id: 123, name: 'John' }, 300);
const user = await cacheManager.get('user:123');
await cacheManager.del('user:123');
await cacheManager.clear();
```

### 缓存策略

#### LRU 策略

```javascript
class LRUCache {
  private cache = new Map<string, CacheEntry>();
  private maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  get(key: string): any {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (this.isExpired(entry)) {
      this.cache.delete(key);
      return null;
    }

    // 移到最后（最近使用）
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value;
  }

  set(key: string, value: any, ttl?: number): void {
    const entry: CacheEntry = {
      value,
      expires: ttl ? Date.now() + ttl * 1000 : null
    };

    // 如果已存在，先删除
    this.cache.delete(key);

    // 如果达到最大容量，删除最少使用的
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, entry);
  }

  private isExpired(entry: CacheEntry): boolean {
    return entry.expires && Date.now() > entry.expires;
  }
}
```

#### Write-through 策略

```javascript
class WriteThroughCache {
  constructor(
    private cache: Cache,
    private database: Database
  ) {}

  async get(key: string): Promise<any> {
    // 先从缓存获取
    let value = await this.cache.get(key);

    if (value === null) {
      // 缓存未命中，从数据库获取
      value = await this.database.get(key);

      if (value !== null) {
        // 回填缓存
        await this.cache.set(key, value);
      }
    }

    return value;
  }

  async set(key: string, value: any): Promise<void> {
    // 先写入数据库
    await this.database.set(key, value);

    // 再写入缓存
    await this.cache.set(key, value);
  }

  async del(key: string): Promise<void> {
    // 先删除数据库
    await this.database.del(key);

    // 再删除缓存
    await this.cache.del(key);
  }
}
```

### 缓存序列化

#### JSON 序列化

```javascript
class JSONSerializer {
  serialize(value: any): string {
    return JSON.stringify(value, this.replacer);
  }

  deserialize(data: string): any {
    return JSON.parse(data, this.reviver);
  }

  private replacer(key: string, value: any): any {
    // 处理特殊类型
    if (value instanceof Date) {
      return { __type: 'Date', value: value.toISOString() };
    }
    if (value instanceof Map) {
      return { __type: 'Map', value: Array.from(value.entries()) };
    }
    if (value instanceof Set) {
      return { __type: 'Set', value: Array.from(value) };
    }
    return value;
  }

  private reviver(key: string, value: any): any {
    if (typeof value === 'object' && value !== null && value.__type) {
      switch (value.__type) {
        case 'Date':
          return new Date(value.value);
        case 'Map':
          return new Map(value.value);
        case 'Set':
          return new Set(value.value);
      }
    }
    return value;
  }
}
```

#### MessagePack 序列化

```javascript
import { encode, decode } from '@msgpack/msgpack';

class MessagePackSerializer {
  serialize(value: any): Buffer {
    return encode(value);
  }

  deserialize(data: Buffer): any {
    return decode(data);
  }
}

// 使用 MessagePack 可以减少网络传输和存储空间
const serializer = new MessagePackSerializer();
const compressed = serializer.serialize(largeObject); // 通常比 JSON 小 20-50%
```

### 缓存预热和预取

```javascript
class CacheWarmer {
  constructor(
    private cache: Cache,
    private database: Database,
    private metrics: MetricsCollector
  ) {}

  async warmUp(): Promise<void> {
    const startTime = Date.now();
    let warmedKeys = 0;

    try {
      // 获取热点键
      const hotKeys = await this.getHotKeys();

      // 批量预热
      const batchSize = 100;
      for (let i = 0; i < hotKeys.length; i += batchSize) {
        const batch = hotKeys.slice(i, i + batchSize);
        const values = await this.database.getMany(batch);

        const cacheOperations = batch.map((key, index) => {
          const value = values[index];
          if (value !== null) {
            warmedKeys++;
            return this.cache.set(key, value, 3600); // 1小时TTL
          }
        }).filter(Boolean);

        await Promise.all(cacheOperations);
      }

      this.metrics.record('cache.warmup.duration', Date.now() - startTime);
      this.metrics.record('cache.warmup.keys', warmedKeys);

    } catch (error) {
      this.metrics.record('cache.warmup.error', 1);
      throw error;
    }
  }

  private async getHotKeys(): Promise<string[]> {
    // 从访问日志或监控数据中获取热点键
    return await this.database.query(`
      SELECT key, COUNT(*) as access_count
      FROM access_logs
      WHERE timestamp > NOW() - INTERVAL '1 hour'
      GROUP BY key
      ORDER BY access_count DESC
      LIMIT 1000
    `);
  }
}

// 智能预取
class SmartPreloader {
  constructor(private cache: Cache) {}

  async preloadRelatedData(primaryKey: string): Promise<void> {
    // 预取相关数据
    const relatedKeys = await this.getRelatedKeys(primaryKey);

    const prefetchPromises = relatedKeys.map(key =>
      this.cache.get(key).catch(() => null) // 忽略错误
    );

    await Promise.allSettled(prefetchPromises);
  }

  private async getRelatedKeys(primaryKey: string): Promise<string[]> {
    // 基于数据关系计算相关键
    const [type, id] = primaryKey.split(':');

    switch (type) {
      case 'user':
        return [
          `user:${id}:profile`,
          `user:${id}:preferences`,
          `user:${id}:permissions`
        ];
      case 'product':
        return [
          `product:${id}:details`,
          `product:${id}:reviews`,
          `product:${id}:inventory`
        ];
      default:
        return [];
    }
  }
}
```

## ✅ 数据验证 (Validation)

### 功能特性

- **Schema验证**: JSON Schema、Joi、Yup 支持
- **类型推断**: 自动类型检查和转换
- **自定义规则**: 支持业务规则验证
- **错误消息**: 多语言错误消息支持
- **性能优化**: 编译和缓存验证函数
- **嵌套验证**: 支持复杂对象验证

### 快速开始

```javascript
import { Validator, createSchema } from 'wokeflow/utils';

// 创建验证器
const validator = new Validator();

// 定义 Schema
const userSchema = createSchema({
  type: 'object',
  properties: {
    name: {
      type: 'string',
      minLength: 2,
      maxLength: 50,
      pattern: '^[a-zA-Z\\s]+$'
    },
    email: {
      type: 'string',
      format: 'email'
    },
    age: {
      type: 'number',
      minimum: 18,
      maximum: 120
    },
    role: {
      type: 'string',
      enum: ['user', 'admin', 'moderator']
    }
  },
  required: ['name', 'email']
});

// 验证数据
const userData = {
  name: 'John Doe',
  email: 'john@example.com',
  age: 25,
  role: 'user'
};

const result = validator.validate(userData, userSchema);

if (result.isValid) {
  console.log('数据验证通过');
} else {
  console.log('验证错误:', result.errors);
}
```

### Schema 定义

#### 基础类型验证

```javascript
const basicSchema = createSchema({
  type: 'object',
  properties: {
    // 字符串验证
    username: {
      type: 'string',
      minLength: 3,
      maxLength: 20,
      pattern: '^[a-zA-Z0-9_]+$',
      transform: 'trim'  // 自动转换
    },

    // 数字验证
    age: {
      type: 'number',
      minimum: 0,
      maximum: 150,
      multipleOf: 1  // 整数
    },

    // 布尔值验证
    isActive: {
      type: 'boolean',
      default: true
    },

    // 数组验证
    tags: {
      type: 'array',
      items: {
        type: 'string',
        minLength: 1,
        maxLength: 10
      },
      minItems: 0,
      maxItems: 5,
      uniqueItems: true
    },

    // 对象验证
    address: {
      type: 'object',
      properties: {
        street: { type: 'string' },
        city: { type: 'string' },
        zipCode: { type: 'string', pattern: '^\d{5}$' }
      },
      required: ['street', 'city']
    }
  },
  required: ['username', 'email']
});
```

#### 条件验证

```javascript
const conditionalSchema = createSchema({
  type: 'object',
  properties: {
    userType: {
      type: 'string',
      enum: ['individual', 'company']
    },
    // 条件字段
    ssn: {
      type: 'string',
      pattern: '^\\d{3}-\\d{2}-\\d{4}$'
    },
    ein: {
      type: 'string',
      pattern: '^\\d{2}-\\d{7}$'
    }
  },
  // 条件验证规则
  if: {
    properties: { userType: { const: 'individual' } }
  },
  then: {
    required: ['ssn']
  },
  else: {
    required: ['ein']
  }
});
```

### 自定义验证规则

```javascript
class CustomValidator extends BaseValidator {
  // 自定义验证函数
  isStrongPassword(value: string): ValidationResult {
    const errors: string[] = [];

    if (value.length < 8) {
      errors.push('密码长度至少8位');
    }

    if (!/[A-Z]/.test(value)) {
      errors.push('密码必须包含大写字母');
    }

    if (!/[a-z]/.test(value)) {
      errors.push('密码必须包含小写字母');
    }

    if (!/\d/.test(value)) {
      errors.push('密码必须包含数字');
    }

    if (!/[!@#$%^&*]/.test(value)) {
      errors.push('密码必须包含特殊字符');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  isValidPhoneNumber(value: string): ValidationResult {
    // 支持多种格式的电话号码验证
    const phoneRegex = /^(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})$/;
    const isValid = phoneRegex.test(value);

    return {
      isValid,
      errors: isValid ? [] : ['无效的电话号码格式']
    };
  }

  async isUniqueEmail(value: string): Promise<ValidationResult> {
    // 异步验证邮箱唯一性
    const existingUser = await this.userRepository.findByEmail(value);

    return {
      isValid: !existingUser,
      errors: existingUser ? ['邮箱已被使用'] : []
    };
  }
}

// 扩展 Schema 支持自定义规则
const extendedSchema = createSchema({
  type: 'object',
  properties: {
    email: {
      type: 'string',
      format: 'email',
      custom: 'isUniqueEmail'  // 使用自定义验证规则
    },
    password: {
      type: 'string',
      custom: 'isStrongPassword'
    },
    phone: {
      type: 'string',
      custom: 'isValidPhoneNumber'
    }
  }
}, {
  customValidators: new CustomValidator()
});
```

### 验证管道

```javascript
class ValidationPipeline {
  private validators: Validator[] = [];

  addValidator(validator: Validator): this {
    this.validators.push(validator);
    return this;
  }

  async validate(data: any, context?: any): Promise<ValidationResult> {
    const allErrors: ValidationError[] = [];

    for (const validator of this.validators) {
      try {
        const result = await validator.validate(data, context);

        if (!result.isValid) {
          allErrors.push(...result.errors);
        }
      } catch (error) {
        allErrors.push({
          field: 'unknown',
          message: `验证器错误: ${error.message}`
        });
      }
    }

    return {
      isValid: allErrors.length === 0,
      errors: allErrors
    };
  }
}

// 使用验证管道
const userValidationPipeline = new ValidationPipeline()
  .addValidator(new SchemaValidator(userSchema))
  .addValidator(new BusinessRuleValidator())
  .addValidator(new SecurityValidator());

// 在路由中使用
app.post('/users', async (request, reply) => {
  const result = await userValidationPipeline.validate(request.body);

  if (!result.isValid) {
    return reply.status(422).send({
      error: 'Validation failed',
      details: result.errors
    });
  }

  // 继续业务逻辑
  const user = await userService.createUser(request.body);
  reply.status(201).send(user);
});
```

### 验证缓存

```javascript
class CachedValidator extends Validator {
  private cache = new Map<string, CompiledSchema>();

  async validate(data: any, schema: any): Promise<ValidationResult> {
    const cacheKey = this.getCacheKey(schema);

    let compiledSchema = this.cache.get(cacheKey);

    if (!compiledSchema) {
      compiledSchema = this.compileSchema(schema);
      this.cache.set(cacheKey, compiledSchema);

      // 限制缓存大小
      if (this.cache.size > 1000) {
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
      }
    }

    return compiledSchema.validate(data);
  }

  private getCacheKey(schema: any): string {
    return crypto.createHash('md5')
      .update(JSON.stringify(schema))
      .digest('hex');
  }

  private compileSchema(schema: any): CompiledSchema {
    // 预编译验证函数，提高性能
    return new CompiledSchema(schema);
  }
}
```

## 🛠️ 实用工具 (Utilities)

### 日期时间处理

```javascript
import { DateTime, Duration, Interval } from 'wokeflow/utils';

// 创建日期时间
const now = DateTime.now();
const specific = DateTime.fromISO('2023-12-25T10:30:00Z');
const fromJS = DateTime.fromJSDate(new Date());

// 日期运算
const tomorrow = now.plus({ days: 1 });
const lastWeek = now.minus({ weeks: 1 });
const nextMonth = now.plus({ months: 1 });

// 格式化
console.log(now.toISO());           // 2023-12-25T10:30:00.000Z
console.log(now.toLocaleString());  // 2023年12月25日
console.log(now.toFormat('yyyy-MM-dd HH:mm:ss')); // 2023-12-25 10:30:00

// 时区转换
const tokyoTime = now.setZone('Asia/Tokyo');
const nyTime = now.setZone('America/New_York');

// 持续时间
const duration = Duration.fromObject({ hours: 2, minutes: 30 });
console.log(duration.toFormat('h小时m分钟')); // 2小时30分钟

// 时间间隔
const interval = Interval.fromDateTimes(start, end);
console.log(interval.length('days')); // 间隔天数

// 工作日计算
const workdays = DateTime.getWorkdays(start, end);
const nextWorkday = DateTime.getNextWorkday(now);

// 相对时间
console.log(DateTime.fromNow(now.minus({ days: 1 }))); // 1天前
console.log(DateTime.toNow(now.plus({ hours: 2 })));   // 2小时后
```

### 字符串操作

```javascript
import { StringUtils } from 'wokeflow/utils';

// 字符串转换
StringUtils.camelCase('hello_world');        // helloWorld
StringUtils.pascalCase('hello_world');       // HelloWorld
StringUtils.snakeCase('helloWorld');         // hello_world
StringUtils.kebabCase('helloWorld');         // hello-world
StringUtils.titleCase('hello world');        // Hello World

// 字符串验证
StringUtils.isEmail('user@example.com');     // true
StringUtils.isPhoneNumber('+1-555-123-4567'); // true
StringUtils.isUUID('550e8400-e29b-41d4-a716-446655440000'); // true
StringUtils.isURL('https://example.com');    // true

// 字符串处理
StringUtils.truncate('Very long string', 10);          // Very long...
StringUtils.slugify('Hello World!');                    // hello-world
StringUtils.removeAccents('café résumé naïve');         // cafe resume naive
StringUtils.escapeHtml('<script>alert("xss")</script>'); // &lt;script&gt;...

// 字符串比较
StringUtils.levenshtein('kitten', 'sitting');           // 3
StringUtils.similarity('hello', 'hello world');         // 0.5
StringUtils.soundex('Robert');                          // R163
StringUtils.soundex('Rupert');                          // R163

// 随机字符串
StringUtils.random(10);                                 // aB3kL9mP2
StringUtils.random(8, 'numeric');                       // 48273916
StringUtils.random(12, 'alphanumeric');                 // A9b2K8mL3pQ7
```

### 集合操作

```javascript
import { CollectionUtils } from 'wokeflow/utils';

// 数组操作
const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// 分块
CollectionUtils.chunk(numbers, 3); // [[1,2,3], [4,5,6], [7,8,9], [10]]

// 去重
CollectionUtils.unique([1, 2, 2, 3, 3, 3]); // [1, 2, 3]

// 差集
CollectionUtils.difference([1, 2, 3], [2, 3, 4]); // [1]

// 交集
CollectionUtils.intersection([1, 2, 3], [2, 3, 4]); // [2, 3]

// 并集
CollectionUtils.union([1, 2, 3], [2, 3, 4]); // [1, 2, 3, 4]

// 洗牌
CollectionUtils.shuffle([1, 2, 3, 4, 5]); // [3, 1, 5, 2, 4]

// 采样
CollectionUtils.sample([1, 2, 3, 4, 5], 3); // [2, 4, 1]

// 对象操作
const users = [
  { id: 1, name: 'John', age: 25 },
  { id: 2, name: 'Jane', age: 30 },
  { id: 3, name: 'Bob', age: 25 }
];

// 分组
CollectionUtils.groupBy(users, 'age');
// { 25: [{id:1, name:'John'}, {id:3, name:'Bob'}], 30: [{id:2, name:'Jane'}] }

// 排序
CollectionUtils.sortBy(users, 'name'); // 按名字排序
CollectionUtils.sortBy(users, user => user.age); // 按年龄排序

// 查找
CollectionUtils.find(users, { age: 25 }); // 找到第一个25岁的用户
CollectionUtils.findLast(users, { age: 25 }); // 找到最后一个25岁的用户

// 计数
CollectionUtils.countBy(users, 'age'); // { 25: 2, 30: 1 }

// 深拷贝
const original = { a: 1, b: { c: 2 } };
const copy = CollectionUtils.deepClone(original);
copy.b.c = 3; // 不影响 original
```

### 异步工具

```javascript
import { AsyncUtils } from 'wokeflow/utils';

// 延迟执行
await AsyncUtils.delay(1000); // 延迟1秒

// 超时控制
const result = await AsyncUtils.timeout(
  fetchData(),
  5000, // 5秒超时
  'Request timeout'
);

// 重试机制
const result = await AsyncUtils.retry(
  async () => {
    return await unstableApiCall();
  },
  {
    attempts: 3,
    delay: 1000,
    backoff: 2,
    retryCondition: (error) => error.code === 'ECONNRESET'
  }
);

// 并发控制
const semaphore = new AsyncUtils.Semaphore(3); // 最多3个并发

const tasks = Array(10).fill().map(async (_, i) => {
  await semaphore.acquire();
  try {
    return await processItem(i);
  } finally {
    semaphore.release();
  }
});

const results = await Promise.all(tasks);

// 批量处理
const batchProcessor = new AsyncUtils.BatchProcessor({
  batchSize: 10,
  concurrency: 3,
  delay: 100
});

await batchProcessor.process(items, async (batch) => {
  return await api.bulkInsert(batch);
});

// 竞态条件处理
const mutex = new AsyncUtils.Mutex();

async function updateCounter() {
  const release = await mutex.acquire();
  try {
    const current = await getCounter();
    await setCounter(current + 1);
  } finally {
    release();
  }
}

// 事件驱动
const eventEmitter = new AsyncUtils.AsyncEventEmitter();

eventEmitter.on('data', async (data) => {
  await processData(data);
});

eventEmitter.on('error', async (error) => {
  await handleError(error);
});

// 异步队列
const queue = new AsyncUtils.AsyncQueue({
  concurrency: 5,
  timeout: 30000
});

queue.add(async () => {
  const data = await fetchData();
  return processData(data);
});

queue.add(async () => {
  await sendNotification();
});

// 等待队列完成
await queue.drain();
```

## 📊 监控和调试

### 工具层监控

```javascript
class UtilitiesMonitor {
  constructor(private metrics: MetricsCollector) {}

  // 配置监控
  monitorConfig(configManager: ConfigManager) {
    configManager.on('loaded', ({ duration }) => {
      this.metrics.record('config.load.duration', duration);
    });

    configManager.on('reloaded', ({ source }) => {
      this.metrics.record('config.reload.count', 1, { source });
    });

    configManager.on('error', ({ operation, error }) => {
      this.metrics.record('config.error.count', 1, { operation });
    });
  }

  // 缓存监控
  monitorCache(cacheManager: CacheManager) {
    // 拦截缓存操作进行监控
    const originalGet = cacheManager.get.bind(cacheManager);
    cacheManager.get = async (key: string) => {
      const startTime = Date.now();
      try {
        const result = await originalGet(key);
        const duration = Date.now() - startTime;

        this.metrics.record('cache.get.duration', duration);
        this.metrics.record('cache.get.hit', result !== null ? 1 : 0);

        return result;
      } catch (error) {
        this.metrics.record('cache.get.error', 1);
        throw error;
      }
    };
  }

  // 验证监控
  monitorValidation(validator: Validator) {
    const originalValidate = validator.validate.bind(validator);
    validator.validate = async (data: any, schema: any) => {
      const startTime = Date.now();
      const result = await originalValidate(data, schema);
      const duration = Date.now() - startTime;

      this.metrics.record('validation.duration', duration);
      this.metrics.record('validation.errors', result.errors.length);

      return result;
    };
  }

  // 获取综合指标
  getMetrics() {
    return {
      config: {
        loadCount: this.metrics.get('config.load.count'),
        reloadCount: this.metrics.get('config.reload.count'),
        errorCount: this.metrics.get('config.error.count')
      },
      cache: {
        hitRate: this.calculateHitRate(),
        avgGetTime: this.metrics.get('cache.get.duration.avg'),
        errorCount: this.metrics.get('cache.error.count')
      },
      validation: {
        avgDuration: this.metrics.get('validation.duration.avg'),
        totalErrors: this.metrics.get('validation.errors.total')
      }
    };
  }

  private calculateHitRate(): number {
    const hits = this.metrics.get('cache.get.hit');
    const total = this.metrics.get('cache.get.total');
    return total > 0 ? hits / total : 0;
  }
}
```

### 性能基准测试

```javascript
import { Benchmark } from 'wokeflow/utils';

const benchmark = new Benchmark();

// 配置加载性能测试
benchmark.add('config.load', async () => {
  const configManager = new ConfigManager({
    sources: [/* large config sources */]
  });
  await configManager.load();
});

// 缓存性能测试
benchmark.add('cache.get', async () => {
  const cache = new MemoryCache({ maxSize: 10000 });
  await cache.get('test-key');
});

benchmark.add('cache.set', async () => {
  const cache = new MemoryCache({ maxSize: 10000 });
  await cache.set('test-key', largeObject);
});

// 验证性能测试
benchmark.add('validation.simple', async () => {
  const validator = new Validator();
  await validator.validate(userData, userSchema);
});

benchmark.add('validation.complex', async () => {
  const validator = new Validator();
  await validator.validate(complexData, complexSchema);
});

// 运行基准测试
const results = await benchmark.run({
  iterations: 1000,
  warmup: 100
});

console.log('Performance Results:');
results.forEach(result => {
  console.log(`${result.name}: ${result.avgTime.toFixed(3)}ms avg, ${result.opsPerSec.toFixed(0)} ops/sec`);
});
```

## ❓ 常见问题

### Q: 如何选择合适的缓存策略？

**A:** 根据数据特点选择：

- **LRU**: 通用场景，最近最少使用
- **LFU**: 频率高的数据更重要
- **TTL**: 有过期时间的数据
- **Write-through**: 数据一致性要求高
- **Write-back**: 性能优先，一致性可适当牺牲

```javascript
// 根据场景选择策略
const cacheConfigs = {
  // 用户会话 - TTL策略
  session: { strategy: 'ttl', ttl: 3600 },

  // 配置数据 - Write-through策略
  config: { strategy: 'write-through' },

  // 热点数据 - LRU策略
  hotData: { strategy: 'lru', maxSize: 10000 },

  // 统计数据 - LFU策略
  stats: { strategy: 'lfu', maxSize: 5000 }
};
```

### Q: 如何优化验证性能？

**A:** 多层优化策略：

```javascript
class OptimizedValidator extends Validator {
  private schemaCache = new Map();

  async validate(data: any, schema: any): Promise<ValidationResult> {
    // 1. Schema缓存
    const schemaKey = this.getSchemaKey(schema);
    let compiledSchema = this.schemaCache.get(schemaKey);

    if (!compiledSchema) {
      compiledSchema = this.precompileSchema(schema);
      this.schemaCache.set(schemaKey, compiledSchema);
    }

    // 2. 快速预检
    const precheckResult = this.fastPrecheck(data, compiledSchema);
    if (!precheckResult.isValid) {
      return precheckResult;
    }

    // 3. 并行验证
    return await this.parallelValidate(data, compiledSchema);
  }

  private async parallelValidate(data: any, schema: any): Promise<ValidationResult> {
    const validations = [
      this.validateTypes(data, schema),
      this.validateConstraints(data, schema),
      this.validateCustomRules(data, schema)
    ];

    const results = await Promise.all(validations);
    return this.mergeResults(results);
  }
}
```

### Q: 日志级别如何配置？

**A:** 按环境和组件配置：

```javascript
const logLevels = {
  development: {
    default: 'debug',
    components: {
      database: 'info',
      cache: 'warn',
      api: 'debug'
    }
  },
  staging: {
    default: 'info',
    components: {
      database: 'warn',
      cache: 'info',
      api: 'info'
    }
  },
  production: {
    default: 'warn',
    components: {
      database: 'error',
      cache: 'warn',
      api: 'info'
    }
  }
};

// 动态调整日志级别
logger.setLevel('database', 'debug'); // 临时启用数据库调试日志
```

## 📚 相关链接

- [配置管理最佳实践](https://12factor.net/config)
- [结构化日志记录](https://www.structuredlogging.net/)
- [缓存策略详解](https://redis.io/topics/lru-cache)
- [数据验证指南](https://json-schema.org/)
- [日期时间处理库](https://moment.github.io/luxon/)

