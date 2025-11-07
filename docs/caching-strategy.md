# WokeFlow 缓存策略实现

## 概述

WokeFlow 实现了全面的多级缓存策略，结合内存缓存和可选的Redis缓存，提供高性能的数据访问和智能的缓存管理。

## 架构

### 分层缓存架构

```
┌─────────────────┐
│   Application   │  ← 应用层缓存策略
├─────────────────┤
│  Cache Service  │  ← 缓存服务层
├─────────────────┤
│ Cache Manager   │  ← 缓存管理器
├─────────────────┤
│   L1 Memory     │  ← 内存缓存（最快）
│   L2 Redis      │  ← Redis缓存（可选）
└─────────────────┘
```

### 核心组件

#### 1. CacheManager
- **职责**: 管理多级缓存层，提供统一的缓存接口
- **特性**:
  - 支持内存和Redis缓存层
  - 智能过期策略
  - 缓存穿透保护
  - 批量操作支持

#### 2. CacheStrategies
- **职责**: 提供不同场景的缓存策略
- **内置策略**:
  - `database`: 数据库查询缓存
  - `api`: API响应缓存
  - `session`: 用户会话缓存
  - `config`: 配置缓存
  - `page`: 页面缓存
  - `file`: 文件缓存
  - `computation`: 计算结果缓存

#### 3. CacheService
- **职责**: 应用层的缓存服务，提供业务逻辑接口
- **特性**:
  - 缓存预热
  - 性能监控
  - 健康检查
  - 配置管理

#### 4. CacheMiddleware
- **职责**: HTTP请求级别的缓存中间件
- **功能**:
  - HTTP响应缓存
  - 缓存键生成
  - 缓存失效管理

## 使用方法

### 基本缓存操作

```javascript
import CacheService from './src/application/services/CacheService.js';

const cacheService = new CacheService();
await cacheService.initialize();

// 设置缓存
await cacheService.set('user:123', { id: 123, name: 'John' }, {
  strategy: 'database',
  ttl: 300000  // 5分钟
});

// 获取缓存
const user = await cacheService.get('user:123', {
  strategy: 'database'
});

// 删除缓存
await cacheService.delete('user:123', {
  strategy: 'database'
});
```

### 缓存穿透保护

```javascript
// 使用 getOrSet 防止缓存穿透
const data = await cacheService.getOrSet(
  'expensive:query',
  async () => {
    // 执行 expensive 查询
    return await database.query('SELECT * FROM large_table');
  },
  {
    strategy: 'database',
    ttl: 600000,  // 10分钟
    negativeTtl: 30000  // 失败时缓存30秒
  }
);
```

### 缓存策略使用

```javascript
// 使用数据库缓存策略
await cacheService.set('users:list', users, {
  strategy: 'database'
});

// 使用API缓存策略
await cacheService.set('api:/users', response, {
  strategy: 'api'
});

// 使用会话缓存策略
await cacheService.set('session:user_123', sessionData, {
  strategy: 'session'
});
```

### 缓存装饰器

```javascript
import { Cached, CacheInvalidate } from './src/shared/utils/CacheDecorators.js';

class UserService {
  constructor(cacheService) {
    this.cacheService = cacheService;
  }

  @Cached({
    keyPrefix: 'user',
    ttl: 300000,
    strategy: 'database'
  })
  async getUser(id) {
    // 这个方法的结果会被缓存
    return await this.database.findUser(id);
  }

  @CacheInvalidate('user:*')
  async updateUser(id, data) {
    // 更新用户时清除相关缓存
    return await this.database.updateUser(id, data);
  }
}
```

### 中间件集成

```javascript
import PerformanceMonitoringMiddleware from './src/middleware/performance-monitoring.middleware.js';

const monitoring = new PerformanceMonitoringMiddleware({
  enableCacheMiddleware: true,
  cacheTtl: 300000
});

// 获取中间件栈（包含缓存和监控）
const middlewares = monitoring.getMiddlewareStack();

// 在Express应用中使用
app.use(...middlewares);
```

## 缓存策略详解

### 1. 数据库缓存策略
- **适用场景**: 数据库查询结果
- **TTL**: 5-10分钟
- **失效策略**: 基于表名和查询参数的模式匹配

### 2. API缓存策略
- **适用场景**: 外部API响应
- **TTL**: 1-5分钟
- **失效策略**: 基于URL路径和查询参数

### 3. 会话缓存策略
- **适用场景**: 用户会话数据
- **TTL**: 30分钟-2小时
- **失效策略**: 基于用户ID

### 4. 配置缓存策略
- **适用场景**: 系统配置
- **TTL**: 1-24小时
- **失效策略**: 基于配置命名空间

### 5. 页面缓存策略
- **适用场景**: 渲染后的页面内容
- **TTL**: 5-15分钟
- **失效策略**: 基于URL路径

### 6. 计算缓存策略
- **适用场景**: 计算密集型操作
- **TTL**: 基于计算复杂度（5分钟-2小时）
- **失效策略**: 基于函数名和参数

## 高级功能

### 智能过期策略

```javascript
// 使用智能过期
await cacheService.setWithSmartExpiry('data:key', value, {
  ttl: 300000,
  accessPattern: 'frequent'  // 频繁访问，延长TTL
});
```

### 访问模式策略

```javascript
// 创建读密集型策略
const readHeavyStrategy = cacheService.createAccessPatternStrategy('read_heavy');

// 创建写密集型策略
const writeHeavyStrategy = cacheService.createAccessPatternStrategy('write_heavy');
```

### 新鲜度策略

```javascript
// 实时数据策略
const realtimeStrategy = cacheService.createFreshnessStrategy('realtime');

// 新鲜数据策略
const freshStrategy = cacheService.createFreshnessStrategy('fresh');
```

### 复合策略

```javascript
// 创建多策略组合
const compositeStrategy = cacheService.createCompositeStrategy(
  ['database', 'api'],
  'first'  // 第一个成功的结果
);
```

### 缓存预热

```javascript
// 预热常用数据
await cacheService.cacheManager.warmup(
  ['user:1', 'user:2', 'user:3'],
  async (userId) => {
    return await database.findUser(userId);
  },
  { strategy: 'database' }
);
```

### 批量操作

```javascript
// 批量设置
const keyValuePairs = new Map([
  ['key1', 'value1'],
  ['key2', 'value2'],
  ['key3', 'value3']
]);
await cacheService.mset(keyValuePairs);

// 批量获取
const keys = ['key1', 'key2', 'key3'];
const results = await cacheService.mget(keys);
```

## 监控和性能

### 缓存统计

```javascript
const stats = cacheService.getCacheStats();
console.log('缓存统计:', {
  hitRate: (stats.manager.hitRate * 100).toFixed(2) + '%',
  totalOperations: stats.manager.metrics.hits + stats.manager.metrics.misses,
  layers: stats.manager.layers
});
```

### 性能分析

```javascript
const analysis = cacheService.analyzeCachePerformance();
console.log('性能分析:', {
  hitRate: analysis.overall.hitRate,
  recommendations: analysis.recommendations
});
```

### 健康检查

```javascript
const health = await cacheService.healthCheck();
console.log('缓存健康状态:', health.status);
```

## 配置选项

### CacheService 配置

```javascript
const cacheService = new CacheService({
  defaultTtl: 300000,        // 默认TTL: 5分钟
  maxMemorySize: 100*1024*1024, // 内存限制: 100MB
  enableRedis: false,         // 是否启用Redis
  redisUrl: 'redis://localhost:6379', // Redis连接URL
  enableMetrics: true         // 是否启用指标收集
});
```

### CacheMiddleware 配置

```javascript
const cacheMiddleware = new CacheMiddleware(cacheService, {
  defaultTtl: 300000,        // 默认TTL
  cacheableMethods: ['GET'], // 可缓存的HTTP方法
  cacheableStatusCodes: [200, 201, 202], // 可缓存的状态码
  shouldCache: (req) => {     // 自定义缓存判断逻辑
    // 返回true表示应该缓存
    return !req.url.includes('/admin');
  }
});
```

## 最佳实践

### 1. 缓存键设计
- 使用有意义的命名空间
- 包含所有影响结果的参数
- 避免过长的键名

```javascript
// 好的缓存键
'user:profile:123'
'posts:list:page=1&limit=10&category=tech'

// 不好的缓存键
'cache123'
'data'
```

### 2. TTL设置
- 频繁更新的数据: 1-5分钟
- 中等频率数据: 5-30分钟
- 静态数据: 1-24小时
- 会话数据: 30分钟-2小时

### 3. 缓存失效策略
- 主动失效: 更新数据时清除相关缓存
- 被动失效: 依赖TTL自然过期
- 事件驱动: 监听数据变更事件

### 4. 监控和告警
- 监控命中率（目标 > 80%）
- 监控内存使用率
- 设置缓存异常告警
- 定期分析性能

### 5. 错误处理
- 缓存服务不可用时不影响主业务
- 设置合理的超时时间
- 实现降级策略

## 故障排除

### 常见问题

1. **缓存命中率低**
   - 检查TTL设置是否合理
   - 分析访问模式，调整缓存策略
   - 考虑预热常用数据

2. **内存使用过高**
   - 降低TTL设置
   - 减少缓存的数据量
   - 启用LRU淘汰策略

3. **缓存雪崩**
   - 使用智能过期（添加随机因子）
   - 实现缓存预热
   - 设置合理的TTL范围

4. **缓存穿透**
   - 使用 `getOrSet` 方法
   - 设置负缓存
   - 验证输入参数

5. **缓存一致性**
   - 更新数据时及时失效缓存
   - 使用事件驱动的缓存失效
   - 实现缓存版本控制

## 扩展开发

### 自定义缓存层

```javascript
class CustomCacheLayer {
  constructor(options) {
    this.options = options;
  }

  async get(key) {
    // 实现获取逻辑
  }

  async set(key, value, ttl) {
    // 实现设置逻辑
  }

  async delete(key) {
    // 实现删除逻辑
  }

  async clear() {
    // 实现清空逻辑
  }

  async healthCheck() {
    // 实现健康检查
  }
}
```

### 自定义缓存策略

```javascript
const customStrategy = {
  name: 'Custom Strategy',
  description: 'My custom caching strategy',

  get: async (key, options) => {
    // 自定义获取逻辑
  },

  set: async (key, value, options) => {
    // 自定义设置逻辑
  },

  delete: async (key, options) => {
    // 自定义删除逻辑
  },

  clear: async (pattern, options) => {
    // 自定义清空逻辑
  }
};
```

## 总结

WokeFlow 的缓存策略提供了：

- **多级缓存**: 内存 + Redis 的分层架构
- **智能策略**: 基于场景的缓存策略
- **高性能**: 缓存穿透保护和批量操作
- **可监控**: 完整的指标收集和健康检查
- **易扩展**: 插件化的策略和中间件架构

通过合理的缓存策略，可以显著提升应用性能，降低数据库压力，提高用户体验。
