# 🔌 frys 插件通信总线指南

## 📖 概述

frys插件通信总线是借鉴VCPToolBox的核心协作理念实现的高性能插件间通信系统。它提供了完整的发布订阅模式、请求响应机制、消息过滤和监控功能，让插件能够安全高效地协作。

## ✨ 核心特性

### 🚀 高性能异步通信
- **异步消息处理**：基于Promise和EventEmitter的异步架构
- **智能调度**：自动负载均衡和资源管理
- **并发控制**：防止消息风暴和系统过载

### 🎯 灵活的消息路由
- **发布订阅模式**：支持一对多广播通信
- **主题通配符**：`events.*`、`system.**`等模式匹配
- **直接消息传递**：点对点通信

### 🔒 安全和监控
- **消息过滤器**：可配置的安全过滤规则
- **TTL机制**：消息过期自动清理
- **通信日志**：完整的消息追踪和审计

### 🔄 请求响应模式
- **同步通信**：支持请求-响应的同步交互
- **超时控制**：可配置的响应超时时间
- **错误处理**：完善的异常处理和重试机制

## 📋 基本概念

### 插件注册表
每个插件都需要向通信总线注册，并实现标准接口：
```javascript
interface PluginInterface {
  initializeCommunication(api): Promise<void>;  // 初始化通信
  handleMessage(message): Promise<void>;        // 处理消息
  shutdown(): Promise<void>;                   // 关闭清理
}
```

### 消息格式
```javascript
{
  id: "msg_1234567890_abc123",      // 消息唯一ID
  topic: "user.login",              // 消息主题
  payload: { /* 实际数据 */ },      // 消息内容
  publisherId: "auth-plugin",       // 发布者ID
  timestamp: new Date(),            // 发布时间戳
  ttl: 30000,                       // 生存时间(ms)
  priority: "normal",               // 优先级
  headers: { /* 元数据 */ }         // 扩展头部
}
```

### 主题命名约定
- 使用点号分隔：`module.action.subaction`
- 支持通配符：`*`匹配单段，`**`匹配多段
- 建议前缀：`pluginName.feature.action`

## 🛠️ 基本用法

### 初始化通信总线
```javascript
import { PluginCommunicationBus } from './src/core/plugin/PluginCommunicationBus.js';

const bus = new PluginCommunicationBus({
  enableLogging: true,      // 启用通信日志
  maxRetries: 3,           // 最大重试次数
  messageTimeout: 30000,   // 消息超时时间
  maxMessageQueue: 1000    // 最大队列长度
});
```

### 插件注册
```javascript
class MyPlugin {
  async initializeCommunication(api) {
    this.api = api;

    // 订阅感兴趣的消息
    this.api.subscribe('user.events', this.handleUserEvent.bind(this));
    this.api.subscribe('system.*', this.handleSystemEvent.bind(this));
  }

  async handleMessage(message) {
    // 处理直接发送的消息
    console.log('收到消息:', message);
  }

  async shutdown() {
    // 清理资源
  }
}

// 注册插件
await bus.registerPlugin('my-plugin', new MyPlugin());
```

### 发布消息
```javascript
// 发布主题消息
await bus.publish('my-plugin', 'user.login', {
  userId: 123,
  timestamp: new Date()
});

// 广播消息给所有插件
await bus.broadcast('my-plugin', {
  type: 'system-update',
  version: '2.0.0'
});
```

### 订阅消息
```javascript
// 订阅特定主题
bus.subscribe('subscriber-plugin', 'user.login', (message) => {
  console.log('用户登录:', message.payload);
});

// 订阅通配符主题
bus.subscribe('subscriber-plugin', 'system.*', (message) => {
  console.log('系统事件:', message.topic, message.payload);
});

// 一次性订阅
bus.subscribe('subscriber-plugin', 'one-time-event', handler, {
  once: true  // 只处理一次
});
```

### 请求响应模式
```javascript
// 发送请求并等待响应
try {
  const response = await bus.request('requester', 'database-plugin', {
    action: 'query',
    table: 'users',
    filter: { active: true }
  }, {
    timeout: 5000  // 5秒超时
  });

  console.log('查询结果:', response.data);
} catch (error) {
  console.error('请求失败:', error.message);
}
```

## 🎨 高级用法

### 消息过滤器
```javascript
// 添加安全过滤器
bus.addMessageFilter('security-filter', (message) => {
  // 过滤掉包含敏感信息或无效的消息
  if (message.payload?.password) {
    return false; // 拒绝包含密码的消息
  }
  if (message.ttl < 1000) {
    return false; // 拒绝生存时间太短的消息
  }
  return true;
});

// 移除过滤器
bus.removeMessageFilter('security-filter');
```

### 复杂主题模式
```javascript
// 订阅所有用户相关事件
bus.subscribe('audit-plugin', 'user.*', handler);

// 订阅所有系统事件（包括子主题）
bus.subscribe('monitor-plugin', 'system.**', handler);

// 订阅特定插件的消息
bus.subscribe('coordinator', 'plugin.auth.*', handler);
```

### 插件间协作示例
```javascript
class AuthPlugin {
  async initializeCommunication(api) {
    this.api = api;

    // 监听认证请求
    this.api.subscribe('auth.login', this.handleLogin.bind(this));

    // 请求用户数据
    this.api.subscribe('auth.userdata', async (message) => {
      const userData = await this.api.request(
        'auth-plugin',
        'database-plugin',
        { action: 'getUser', userId: message.payload.userId }
      );
      // 处理用户数据...
    });
  }

  async handleLogin(message) {
    // 验证用户
    const isValid = await this.validateCredentials(message.payload);

    // 发布登录结果
    await this.api.publish('auth.result', {
      userId: message.payload.userId,
      success: isValid,
      token: isValid ? this.generateToken() : null
    });
  }
}

class DatabasePlugin {
  async initializeCommunication(api) {
    this.api = api;

    // 监听数据库查询请求
    this.api.subscribe('db.query', this.handleQuery.bind(this));
  }

  async handleQuery(message) {
    const { responseTopic } = message.payload;

    try {
      const results = await this.query(message.payload);
      await this.api.publish(responseTopic, {
        success: true,
        data: results
      });
    } catch (error) {
      await this.api.publish(responseTopic, {
        success: false,
        error: error.message
      });
    }
  }
}
```

### 监控和统计
```javascript
// 获取通信统计
const stats = bus.getStats();
console.log('通信统计:', {
  messagesSent: stats.messagesSent,
  messagesReceived: stats.messagesReceived,
  activePlugins: stats.activePlugins,
  activeSubscriptions: stats.activeSubscriptions
});

// 获取通信日志
const logs = bus.getCommunicationLog(50); // 最近50条日志
logs.forEach(log => {
  console.log(`${log.timestamp}: ${log.type} - ${log.topic}`);
});
```

## 🔧 配置选项

### 通信总线配置
```javascript
const bus = new PluginCommunicationBus({
  // 基础配置
  enableLogging: true,        // 启用通信日志
  maxRetries: 3,             // 消息处理失败最大重试次数
  retryDelay: 1000,          // 重试间隔(ms)

  // 消息处理
  messageTimeout: 30000,     // 消息处理超时时间
  maxMessageQueue: 1000,     // 最大消息队列长度

  // 监控配置
  monitoring: true,          // 启用性能监控
  logInterval: 300000        // 日志记录间隔(ms)
});
```

### 消息选项
```javascript
// 发布消息时的选项
await bus.publish('publisher', 'topic', payload, {
  ttl: 60000,              // 消息生存时间1分钟
  priority: 'high',        // 消息优先级
  headers: {               // 自定义头部
    correlationId: 'req-123',
    userId: 'user-456'
  }
});

// 订阅消息时的选项
bus.subscribe('subscriber', 'topic', handler, {
  once: false,             // 是否只处理一次
  priority: 'normal',      // 处理优先级
  filter: (message) => true // 额外的过滤条件
});
```

## 🛡️ 最佳实践

### 插件设计
1. **清晰的职责分离**：每个插件专注于特定功能
2. **标准接口实现**：确保插件实现所有必需的方法
3. **错误处理**：妥善处理通信异常和超时
4. **资源清理**：在shutdown中清理所有订阅和资源

### 主题命名
```javascript
// ✅ 好的主题命名
'user.auth.login'
'database.query.success'
'system.health.check'

// ❌ 不好的主题命名
'login'           // 太泛化
'doSomething'     // 不够描述性
'userLoginEvent'  // 不一致的分隔符
```

### 性能优化
```javascript
// 使用TTL避免消息堆积
await bus.publish('publisher', 'topic', data, { ttl: 30000 });

// 合理设置超时时间
const response = await bus.request('requester', 'target', data, {
  timeout: 5000  // 根据实际需求设置
});

// 监控通信性能
setInterval(() => {
  const stats = bus.getStats();
  if (stats.queuedMessages > 100) {
    console.warn('消息队列过长，可能存在性能问题');
  }
}, 60000);
```

### 安全考虑
```javascript
// 验证消息来源
bus.subscribe('secure-plugin', 'important.topic', (message) => {
  if (!this.isTrustedSource(message.publisherId)) {
    console.warn('收到来自不受信任源的消息');
    return;
  }
  // 处理消息...
});

// 使用消息过滤器增强安全性
bus.addMessageFilter('auth-filter', (message) => {
  // 检查消息权限
  return this.hasPermission(message.publisherId, message.topic);
});
```

## 🔍 故障排除

### 常见问题

#### 消息没有被接收
```javascript
// 检查主题是否正确
console.log('已注册主题:', bus.getTopics());

// 检查插件是否已注册
console.log('已注册插件:', bus.getPlugins());

// 检查订阅是否成功
bus.subscribe('debugger', 'test.topic', () => {
  console.log('订阅工作正常');
});
```

#### 消息处理超时
```javascript
// 增加超时时间
const response = await bus.request('requester', 'target', data, {
  timeout: 60000  // 增加到60秒
});

// 检查目标插件是否正常运行
const plugins = bus.getPlugins();
const targetPlugin = plugins.find(p => p.id === 'target-plugin');
if (!targetPlugin) {
  console.error('目标插件未注册');
}
```

#### 内存泄漏
```javascript
// 确保正确清理订阅
class MyPlugin {
  async shutdown() {
    // 通信总线会自动清理，但手动清理更安全
    await super.shutdown();
  }
}

// 定期检查统计
setInterval(() => {
  const stats = bus.getStats();
  if (stats.queuedMessages > bus.options.maxMessageQueue * 0.8) {
    console.warn('消息队列接近满载');
  }
}, 30000);
```

## 📊 监控和调试

### 启用调试模式
```javascript
const bus = new PluginCommunicationBus({
  enableLogging: true,
  debug: true
});

// 监听通信事件
bus.on('plugin:registered', (data) => {
  console.log('插件已注册:', data.pluginId);
});

bus.on('topic:subscribed', (data) => {
  console.log('主题已订阅:', data.topic);
});

bus.on('message:processed', (data) => {
  console.log('消息已处理:', data.messageId);
});
```

### 性能监控
```javascript
// 监控通信性能
setInterval(() => {
  const stats = bus.getStats();

  console.log('通信性能指标:', {
    消息发送量: stats.messagesSent,
    消息接收量: stats.messagesReceived,
    处理成功率: `${((stats.messagesProcessed / stats.messagesReceived) * 100).toFixed(1)}%`,
    活跃插件数: stats.activePlugins,
    活跃订阅数: stats.activeSubscriptions,
    队列长度: stats.queuedMessages
  });
}, 60000);
```

---

## 🎯 总结

插件通信总线是frys生态系统的核心基础设施，它提供了：

- **🔗 无缝协作**：插件间的高效通信
- **⚡ 高性能**：异步处理和智能调度
- **🛡️ 可靠性**：错误处理和监控机制
- **🔧 灵活性**：支持多种通信模式和配置

通过这套通信系统，frys的插件生态能够实现复杂的协作场景，为用户提供更强大的工作流定制能力。

开始使用插件通信总线，构建您自己的插件生态吧！ 🚀
