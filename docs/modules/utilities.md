# WokeFlow 工具层文档

## 📚 初学者指南 - 零基础也能看懂

<div style="background-color: #fff9c4; padding: 20px; border-left: 5px solid #fbc02d; margin: 20px 0;">
  <h3 style="margin-top: 0; color: #f57f17;">🎓 什么是"工具层"？</h3>
  <p>想象一下，你要管理一家公司。工具层就像是公司的<strong>基础设施部门</strong>：</p>
  <ul>
    <li>⚙️ <strong>配置管理</strong> - 就像"公司规章制度手册"，记录所有重要的设置和规则</li>
    <li>📝 <strong>日志系统</strong> - 就像"公司工作日志"，记录每天发生的重要事情</li>
  </ul>
  <p>在 WokeFlow 中，工具层提供了程序运行所需的基础服务，比如<strong>读取配置</strong>、<strong>记录日志</strong>等基础功能。</p>
</div>

### 🏠 用生活比喻理解工具层

#### 1. ⚙️ 配置管理 - 就像"智能设置中心"

<div style="background-color: #e1f5fe; padding: 20px; border-radius: 8px; margin: 15px 0;">
  <h4 style="margin-top: 0; color: #0277bd;">🏠 生活场景：智能家居控制中心</h4>
  
  <p><strong>想象一下：</strong></p>
  <ul>
    <li>🏠 智能家居：家里有各种设备（空调、灯光、音响等），每个设备都有设置</li>
    <li>📱 控制中心：一个统一的控制面板，可以查看和修改所有设备的设置</li>
    <li>🌍 场景模式：可以设置"回家模式"、"睡眠模式"等不同场景，一键切换所有设置</li>
    <li>🔄 自动适应：系统会根据时间、天气等自动调整设置</li>
    <li>💾 保存设置：所有设置都会保存，下次开机时自动恢复</li>
  </ul>

  <p><strong>在代码中：</strong></p>
  <ul>
    <li>💻 配置管理：就像"智能设置中心"，统一管理程序的所有配置</li>
    <li>📋 配置存储：存储数据库地址、API密钥、功能开关等所有设置</li>
    <li>🌍 环境配置：可以为开发、测试、生产环境设置不同的配置</li>
    <li>🔄 自动加载：程序启动时自动读取配置，运行时可以动态更新</li>
    <li>✅ 配置验证：确保所有必需的配置都存在且正确</li>
  </ul>

  <div style="background-color: #ffffff; padding: 15px; border-radius: 5px; margin-top: 15px;">
    <strong>💡 简单理解：</strong>配置管理就像一个"智能设置中心"，帮你统一管理程序的所有设置，不同环境可以有不同的配置，程序会自动读取和使用这些配置。
  </div>
</div>

#### 2. 📝 日志系统 - 就像"智能记录本"

<div style="background-color: #f3e5f5; padding: 20px; border-radius: 8px; margin: 15px 0;">
  <h4 style="margin-top: 0; color: #7b1fa2;">📖 生活场景：日记本和监控录像</h4>
  
  <p><strong>想象一下：</strong></p>
  <ul>
    <li>📖 日记本：记录每天发生的重要事情（今天做了什么、遇到了什么问题）</li>
    <li>📹 监控录像：记录所有活动，可以回放查看发生了什么</li>
    <li>📊 分类记录：不同类型的事情用不同颜色标记（重要、警告、错误）</li>
    <li>🔍 快速查找：可以按时间、类型快速查找记录</li>
    <li>🗂️ 自动整理：旧的记录自动归档，新的记录自动添加</li>
  </ul>

  <p><strong>在代码中：</strong></p>
  <ul>
    <li>💻 日志系统：就像"智能记录本"，记录程序运行时的所有重要信息</li>
    <li>📝 记录信息：记录程序做了什么、遇到了什么问题、性能如何等</li>
    <li>📊 分级记录：不同重要程度的信息用不同级别（信息、警告、错误）</li>
    <li>🔍 快速查找：可以按时间、级别、关键词查找日志</li>
    <li>🗂️ 自动管理：旧的日志自动归档，防止日志文件过大</li>
  </ul>

  <div style="background-color: #ffffff; padding: 15px; border-radius: 5px; margin-top: 15px;">
    <strong>💡 简单理解：</strong>日志系统就像一个"智能记录本"，自动记录程序运行时的所有重要信息，当出现问题时，可以通过查看日志快速找到原因。
  </div>
</div>

### 🔗 工具层如何工作？

<div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0;">
  <h3 style="margin-top: 0; color: #2e7d32;">⚙️ 工具层工作流程</h3>
  
  <p><strong>场景：程序启动时需要读取配置和记录日志</strong></p>
  
  <div style="background-color: #ffffff; padding: 15px; border-radius: 5px; margin: 15px 0;">
    <p><strong>步骤1：</strong>配置管理读取配置</p>
    <p style="margin-left: 20px;">📋 程序启动 → 配置管理读取配置文件 → 验证配置是否正确 → 加载到内存</p>
    
    <p style="margin-top: 15px;"><strong>步骤2：</strong>日志系统开始记录</p>
    <p style="margin-left: 20px;">📝 程序运行 → 日志系统记录重要事件 → 保存到文件或显示在控制台</p>
    
    <p style="margin-top: 15px;"><strong>步骤3：</strong>其他模块使用工具层</p>
    <p style="margin-left: 20px;">🔧 其他模块需要配置 → 从配置管理获取 → 需要记录日志 → 使用日志系统</p>
  </div>

  <p><strong>💡 关键点：</strong>工具层为整个程序提供基础服务，所有模块都可以使用这些工具，就像公司所有部门都可以使用打印机和会议室一样。</p>
</div>

### ❓ 常见问题解答

<div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0;">
  <h3 style="margin-top: 0; color: #2e7d32;">🤔 你可能想问的问题</h3>

  <h4 style="color: #388e3c;">Q1: 什么是"配置"？</h4>
  <p style="margin-left: 20px;"><strong>A:</strong> 配置就是程序的"设置"。比如数据库地址、API密钥、功能开关等。就像手机的设置（亮度、音量、网络）一样，配置决定了程序如何运行。</p>

  <h4 style="color: #388e3c; margin-top: 20px;">Q2: 为什么需要"日志"？</h4>
  <p style="margin-left: 20px;"><strong>A:</strong> 日志就像程序的"黑匣子"，记录程序运行时的所有重要信息。当程序出问题时，可以通过查看日志找到原因，就像飞机失事后查看黑匣子一样。</p>

  <h4 style="color: #388e3c; margin-top: 20px;">Q3: 配置和日志有什么区别？</h4>
  <p style="margin-left: 20px;"><strong>A:</strong> 配置是"程序应该怎么运行"（设置），日志是"程序实际怎么运行的"（记录）。就像计划书和实际执行报告的区别。</p>

  <h4 style="color: #388e3c; margin-top: 20px;">Q4: 为什么叫"工具层"？</h4>
  <p style="margin-left: 20px;"><strong>A:</strong> 因为这些模块就像工具箱里的工具，所有其他模块都可以使用它们。就像公司有公共的打印机、会议室一样，工具层提供所有模块都需要的基础服务。</p>
</div>

## 📖 概述

<div style="background-color: #f0f8ff; padding: 20px; border-left: 5px solid #2196F3; margin: 20px 0;">
  <h3 style="margin-top: 0; color: #1976D2;">🛠️ 工具层的作用</h3>
  <p>WokeFlow 的工具层提供了系统运行所需的基础设施组件，包括配置管理和日志系统。这些工具模块采用轻量化设计理念，为整个应用提供统一且高效的基础服务支持。</p>
  <p><strong>简单说：</strong>工具层就是程序的"基础设施部门"，提供配置管理和日志记录等基础服务，让其他模块可以专注于自己的核心功能。</p>
</div>

## 设计原则

### 1. 轻量化设计
- **最小依赖**: 只依赖 Node.js 内置模块
- **按需加载**: 支持运行时动态配置
- **性能优先**: 高效的配置读取和日志写入

### 2. 环境适应性
- **多环境支持**: 支持开发、测试、生产环境
- **配置覆盖**: 环境变量优先级高于默认配置
- **热重载**: 支持配置的运行时更新

### 3. 可观测性
- **结构化日志**: JSON 格式便于分析
- **多输出目标**: 同时支持控制台和文件输出
- **日志轮转**: 自动管理日志文件大小和数量

## 核心工具模块详解

### 1. 配置管理 (Configuration)

#### 功能特性
- **多源配置**: 支持环境变量、配置文件、默认值多级覆盖
- **类型转换**: 自动将字符串转换为适当的数据类型
- **配置验证**: 确保必要配置项的存在
- **环境适配**: 根据运行环境自动调整配置
- **安全处理**: 对敏感信息进行特殊处理

#### 配置层次结构

```
默认配置 ← 环境变量 ← .env 文件 ← 运行时覆盖
   ↑            ↑           ↑           ↑
  基础值     环境特定   文件配置    动态调整
```

#### 配置加载流程

```javascript
// 1. 加载默认配置
const defaultConfig = {
  app: { name: 'WokeFlow', version: '2.0.0-lightweight' },
  api: { timeout: 30000 },
  // ... 其他默认配置
};

// 2. 加载环境变量
const envConfig = {
  PORT: '3001',
  NODE_ENV: 'production',
  JWT_SECRET: 'custom-secret'
};

// 3. 合并配置（环境变量优先）
const finalConfig = mergeConfigs(defaultConfig, envConfig);
```

#### 核心API

##### 配置访问

```javascript
import { config, validateConfig } from './utils/config.js';

// 访问配置项
console.log(config.app.name);        // 'WokeFlow Production'
console.log(config.app.port);        // 3000 (从环境变量或默认值)
console.log(config.api.baseURL);     // API基础URL
console.log(config.auth.secret);     // JWT密钥

// 验证配置完整性
try {
  validateConfig();
  console.log('配置验证通过');
} catch (error) {
  console.error('配置验证失败:', error.message);
  process.exit(1);
}
```

##### 环境变量处理

```javascript
// 环境变量访问函数
const getEnvVar = (key, defaultValue) => {
  return process.env[key] || defaultValue;
};

// 使用示例
const config = {
  port: parseInt(getEnvVar('PORT', '3000')),
  timeout: parseInt(getEnvVar('TIMEOUT', '30000')),
  enabled: getEnvVar('ENABLED', 'true') === 'true',
};
```

#### 配置分类

##### 应用配置
```javascript
app: {
  name: 'WokeFlow Production',
  version: '2.0.0-lightweight',
  port: 3000,
  env: 'development',     // development | staging | production
  logLevel: 'info'
}
```

##### API 配置
```javascript
api: {
  baseURL: 'http://localhost:3000/api',
  timeout: 30000,
  retries: 3,
  retryDelay: 1000
}
```

##### 认证配置
```javascript
auth: {
  secret: 'your-jwt-secret',
  expiresIn: '24h',
  refreshTokenExpiresIn: '7d',
  issuer: 'wokeflow-production',
  audience: 'wokeflow-users'
}
```

##### 数据库配置
```javascript
database: {
  type: 'mongodb',
  host: 'localhost',
  port: 27017,
  name: 'wokeflow_prod',
  username: undefined,
  password: undefined,
  connectionTimeout: 30000
}
```

##### 缓存配置
```javascript
cache: {
  type: 'redis',
  host: 'localhost',
  port: 6379,
  password: undefined,
  ttl: 3600,
  maxConnections: 10
}
```

##### 监控配置
```javascript
monitoring: {
  enabled: true,
  prometheus: {
    port: 9090,
    path: '/metrics'
  },
  alertmanager: {
    enabled: true,
    webhookUrl: undefined
  }
}
```

##### 安全配置
```javascript
security: {
  cors: {
    origin: 'http://localhost:3000',
    credentials: true
  },
  rateLimit: {
    windowMs: 900000,  // 15分钟
    max: 100          // 15分钟内最多100次请求
  },
  helmet: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:']
      }
    }
  }
}
```

##### 工作流配置
```javascript
workflow: {
  maxConcurrentWorkflows: 50,
  maxTasksPerWorkflow: 100,
  defaultTimeout: 3600000,    // 1小时
  retryAttempts: 3,
  retryDelay: 5000
}
```

##### 通知配置
```javascript
notifications: {
  email: {
    enabled: false,
    host: undefined,
    port: 587,
    secure: false,
    auth: {
      user: undefined,
      pass: undefined
    }
  },
  slack: {
    enabled: false,
    webhookUrl: undefined,
    channel: '#wokeflow-notifications'
  }
}
```

##### 日志配置
```javascript
logging: {
  level: 'info',        // error | warn | info | debug
  format: 'json',       // json | console
  transports: {
    console: {
      enabled: true
    },
    file: {
      enabled: true,
      path: './logs/wokeflow.log',
      maxSize: '10m',
      maxFiles: '5'
    }
  }
}
```

#### 环境特定配置

```javascript
// 生产环境特殊配置
if (config.app.env === 'production') {
  config.api.timeout = 60000;        // 生产环境允许更长的超时
  config.monitoring.enabled = true;  // 强制启用监控
  config.security.rateLimit.max = 1000; // 允许更多请求
}

// 测试环境配置
else if (config.app.env === 'staging') {
  config.monitoring.enabled = true;  // 启用监控用于测试
  config.logging.level = 'debug';    // 更详细的日志
}
```

#### 配置验证

```javascript
export const validateConfig = () => {
  const requiredConfigs = [
    'auth.secret',      // JWT 密钥必须配置
    'api.baseURL'       // API 基础URL必须配置
  ];

  const missingConfigs = requiredConfigs.filter(path => {
    const keys = path.split('.');
    let value = config;
    for (const key of keys) {
      value = value[key];
      if (value === undefined) return true;
    }
    return false;
  });

  if (missingConfigs.length > 0) {
    throw new Error(`缺少必要的配置项: ${missingConfigs.join(', ')}`);
  }
};
```

### 2. 日志系统 (Logging)

#### 功能特性
- **多级别日志**: 支持 error、warn、info、debug 四种级别
- **多格式输出**: 支持 JSON 和彩色控制台格式
- **多目标输出**: 同时输出到控制台和文件
- **自动日志轮转**: 文件大小和数量限制
- **结构化数据**: 支持元数据附加
- **性能优化**: 异步写入不阻塞主线程

#### 日志级别定义

```javascript
const LOG_LEVELS = {
  error: 0,    // 错误：系统错误、异常情况
  warn: 1,     // 警告：潜在问题、不推荐用法
  info: 2,     // 信息：重要事件、状态变更
  debug: 3     // 调试：详细的调试信息
};
```

#### 核心API

##### 基础日志记录

```javascript
import { logger } from './utils/logger.js';

// 不同级别的日志记录
logger.error('数据库连接失败', error, { userId: '123' });
logger.warn('配置项缺失，使用默认值', { key: 'timeout' });
logger.info('用户登录成功', { userId: '123', ip: '192.168.1.1' });
logger.debug('处理请求参数', { params: requestParams });
```

##### 便捷函数

```javascript
import { logError, logWarn, logInfo, logDebug } from './utils/logger.js';

// 使用便捷函数
logError('操作失败', error);
logWarn('性能警告', { duration: 1500 });
logInfo('服务启动', { port: 3000 });
logDebug('缓存命中', { key: 'user:123', hit: true });
```

##### 子日志器

```javascript
// 创建带有上下文的子日志器
const userLogger = logger.child({ module: 'user-service' });
const httpLogger = logger.child({ module: 'http-client', version: '2.0.0-lightweight' });

userLogger.info('用户创建', { userId: '123' });
httpLogger.debug('发送请求', { url: '/api/users', method: 'GET' });
```

#### 日志格式

##### JSON 格式（生产环境）
```json
{
  "timestamp": "2023-12-25T10:30:00.000Z",
  "level": "info",
  "message": "用户登录成功",
  "userId": "123",
  "ip": "192.168.1.1",
  "module": "auth"
}
```

##### 控制台格式（开发环境）
```
[2023-12-25T10:30:00.000Z] INFO 用户登录成功 {"userId":"123","ip":"192.168.1.1"}
[2023-12-25T10:30:05.000Z] ERROR 数据库连接失败 {"error":{"name":"MongoError","message":"连接超时"}}
```

#### 输出目标

##### 控制台输出
- **彩色显示**: 不同级别使用不同颜色
- **即时输出**: 直接写入控制台
- **开发友好**: 适合开发和调试阶段

##### 文件输出
- **持久化存储**: 日志持久化到文件系统
- **自动轮转**: 文件大小超过限制时自动轮转
- **多文件管理**: 保留指定数量的历史文件

#### 文件轮转机制

```javascript
class FileLogger {
  constructor(filePath) {
    this.maxSize = 10 * 1024 * 1024;  // 10MB
    this.maxFiles = 5;                // 保留5个文件
  }

  write(message) {
    // 检查文件大小
    if (this.currentSize + messageSize > this.maxSize) {
      this.rotate();  // 执行轮转
    }

    // 写入日志
    this.stream.write(message + '\n');
  }

  rotate() {
    // wokeflow.log → wokeflow.log.1
    // wokeflow.log.1 → wokeflow.log.2
    // ...
    // wokeflow.log.5 被删除
  }
}
```

#### 配置选项

##### 基本配置
```javascript
logging: {
  level: 'info',      // 全局日志级别
  format: 'json'      // json | console
}
```

##### 传输器配置
```javascript
transports: {
  console: {
    enabled: true     // 是否启用控制台输出
  },
  file: {
    enabled: true,    // 是否启用文件输出
    path: './logs/wokeflow.log',  // 日志文件路径
    maxSize: '10m',   // 最大文件大小 (10m, 1g 等)
    maxFiles: '5'     // 最大文件数量
  }
}
```

#### 日志过滤和采样

```javascript
// 基于条件的日志过滤
class ConditionalLogger {
  shouldLog(level, message, meta) {
    // 高频日志采样
    if (meta.operation === 'cache_hit' && Math.random() > 0.1) {
      return false;  // 10% 采样率
    }

    // 敏感信息过滤
    if (meta.password) {
      meta.password = '[FILTERED]';
    }

    return true;
  }
}
```

#### 性能监控日志

```javascript
// 请求性能日志
logger.info('API请求完成', {
  method: 'GET',
  url: '/api/users',
  statusCode: 200,
  duration: 150,      // 响应时间(ms)
  userAgent: req.headers['user-agent']
});

// 数据库操作日志
logger.debug('数据库查询', {
  operation: 'find',
  collection: 'users',
  query: { status: 'active' },
  duration: 45,
  resultCount: 150
});
```

#### 错误日志

```javascript
// 错误日志自动包含堆栈信息
try {
  await riskyOperation();
} catch (error) {
  logger.error('操作失败', error, {
    userId: '123',
    operation: 'update_profile',
    context: 'user-service'
  });
}

// 输出示例:
// {
//   "timestamp": "2023-12-25T10:30:00.000Z",
//   "level": "error",
//   "message": "操作失败",
//   "error": {
//     "name": "ValidationError",
//     "message": "邮箱格式不正确",
//     "stack": "..."
//   },
//   "userId": "123",
//   "operation": "update_profile",
//   "context": "user-service"
// }
```

#### 日志分析和监控

##### 日志聚合
```bash
# 使用 jq 分析 JSON 日志
cat wokeflow.log | jq 'select(.level == "error") | .message' | sort | uniq -c | sort -nr

# 统计错误类型
grep '"level":"error"' wokeflow.log | jq -r '.error.name' | sort | uniq -c
```

##### 监控告警
```javascript
// 基于日志的监控
class LogMonitor {
  watch(pattern, callback) {
    // 监控特定模式的日志
    // 当匹配时触发回调
  }
}

// 使用示例
monitor.watch('数据库连接失败', (log) => {
  alertManager.sendAlert('Database connection failed', log);
});
```

## 集成和使用

### 配置与日志的协作

```javascript
// 配置影响日志行为
const logger = new Logger();  // 使用 config.logging 进行初始化

// 日志记录配置变更
logger.info('配置加载完成', {
  env: config.app.env,
  logLevel: config.logging.level,
  monitoring: config.monitoring.enabled
});
```

### 错误处理集成

```javascript
import { errorHandler } from './core/UnifiedErrorHandler.js';

// 错误处理器自动使用日志系统
errorHandler.registerHandler('database', (error, context) => {
  logger.error('数据库错误', error, context);
  // 可能的恢复逻辑
});
```

### 性能监控集成

```javascript
// HTTP 客户端性能日志
http.interceptors.response.use((response) => {
  const duration = Date.now() - response.config.startTime;
  logger.info('HTTP请求完成', {
    method: response.config.method,
    url: response.config.url,
    statusCode: response.status,
    duration
  });
  return response;
});
```

## 最佳实践

### 1. 配置管理
- **环境变量优先**: 敏感信息使用环境变量
- **文档化配置**: 为所有配置项添加注释
- **验证配置**: 启动时验证必要配置
- **分层配置**: 按功能模块组织配置

### 2. 日志记录
- **合适级别**: 使用正确的日志级别
- **结构化数据**: 使用元数据而非字符串拼接
- **性能考虑**: 避免在热路径记录过多debug日志
- **敏感信息**: 过滤掉密码、令牌等敏感信息

### 3. 监控和告警
- **关键指标**: 监控错误率、响应时间等关键指标
- **日志聚合**: 使用工具进行日志聚合分析
- **告警规则**: 基于日志模式设置告警规则

## 总结

WokeFlow 的工具层通过配置管理和日志系统，为整个应用提供了稳定可靠的基础设施支持。配置系统支持多环境、多源配置，确保应用在不同环境下都能正确运行；日志系统提供多级别、多目标的日志记录能力，支持生产环境的监控和调试需求。
