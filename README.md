# WokeFlow - 基于优秀开源项目的现代化工作流系统

## 🚀 项目概述

WokeFlow 是一个基于优秀开源项目的现代化工作流管理系统，通过集成业界领先的开源解决方案，构建高性能、可扩展、易维护的企业级工作流平台。

**核心特性:**
- ✅ **开源驱动**: 采用GitHub上最优秀的开源项目
- ✅ **高性能**: 基于Fastify和Bull.js的现代化架构
- ✅ **可观测性**: 集成Sentry错误监控和性能追踪
- ✅ **模块化**: 基于Awilix的依赖注入架构

## 🏗️ 架构概览

### 核心开源项目

```
🔧 依赖注入容器
└── Awilix - 专为Node.js设计的轻量级DI容器

🌐 Web框架与HTTP客户端
├── Fastify - 高性能Node.js Web框架
├── Axios - 功能强大的HTTP客户端
└── fastify-plugin - Fastify插件系统

📨 消息队列系统
├── Bull.js - 基于Redis的强大作业队列
└── IORedis - 高性能Redis客户端

📡 事件系统
└── EventEmitter3 - 优化的Node.js事件发射器

🛡️ 错误处理与监控
├── Sentry - 企业级错误监控和性能追踪
├── @sentry/node - Node.js SDK
└── @sentry/profiling-node - 性能分析

🎨 状态管理与工具库
├── Zustand - 轻量级React状态管理
├── Lodash - 实用的JavaScript工具库
├── UUID - 唯一标识符生成
└── Day.js - 轻量级日期处理库

🔐 认证与安全
└── JSON Web Token - 业界标准的认证方案

🧪 测试工具链
├── Vitest - 快速的单元测试框架
├── Testcontainers - 集成测试容器管理
└── @testcontainers/postgresql & redis - 数据库测试容器
```

## 📊 架构优势

| 特性 | 之前 (自建) | 现在 (开源) | 改善 |
|------|-------------|-------------|------|
| 依赖注入 | 自建容器 | Awilix | ✅ 更成熟、更稳定 |
| Web框架 | 自建HTTP | Fastify | ✅ 高性能、生态丰富 |
| 消息队列 | 自建模拟 | Bull.js | ✅ 生产就绪、功能完整 |
| 事件系统 | 自建实现 | EventEmitter3 | ✅ 优化性能、内存安全 |
| 错误监控 | 自建处理 | Sentry | ✅ 企业级监控、性能分析 |
| 插件系统 | 自建管理 | fastify-plugin | ✅ 标准化、易扩展 |

## 🚀 快速开始

### 环境要求
- Node.js >= 16.0.0
- Redis (用于消息队列)
- PostgreSQL (可选，用于数据存储)

### 安装依赖
```bash
npm install
```

### 配置环境变量
```bash
# 复制环境配置模板
cp .env.example .env

# 编辑配置文件
nano .env
```

### 启动系统
```bash
# 开发模式
npm run dev

# 生产模式
npm start
```

### 健康检查
```bash
curl http://localhost:3000/health
```

## 📋 项目结构

```
WokeFlow/
├── src/
│   ├── core/                 # 核心组件
│   │   ├── container.js      # Awilix依赖注入容器
│   │   ├── server.js         # Fastify Web服务器
│   │   ├── queue.js          # Bull.js消息队列
│   │   ├── events.js         # EventEmitter3事件系统
│   │   ├── error-handler.js  # Sentry错误处理
│   │   └── plugin-system.js  # fastify-plugin插件系统
│   ├── services/             # 业务服务层
│   ├── infrastructure/       # 基础设施层
│   ├── domain/              # 领域层
│   └── index.js             # 应用入口
├── tests/                   # 测试目录
├── docs/                    # 项目文档
├── package.json             # 项目配置
├── vitest.config.js         # 测试配置
└── README.md               # 项目说明
```

## 🔧 核心组件说明

### 依赖注入容器 (Awilix)
```javascript
import { getContainer } from './core/container.js';

// 解析服务
const workflowEngine = getContainer().resolve('workflowEngine');
```

### Web服务器 (Fastify)
```javascript
import { startServer } from './core/server.js';

// 启动服务器
const server = await startServer(3000);
```

### 消息队列 (Bull.js)
```javascript
import { getQueue, createWorker } from './core/queue.js';

// 创建队列和工作者
const queue = getQueue('user-events');
const worker = createWorker('user-events', processor);
```

### 事件系统 (EventEmitter3)
```javascript
import { eventSystem } from './core/events.js';

// 监听事件
eventSystem.on('user.created', handler);

// 发射事件
eventSystem.emit('user.created', userData);
```

### 错误处理 (Sentry)
```javascript
import { errorHandler } from './core/error-handler.js';

// 处理错误
await errorHandler.handle(error, { context: 'operation' });
```

## 🧪 测试

```bash
# 运行所有测试
npm test

# 运行单元测试
npm run test:unit

# 运行集成测试
npm run test:integration

# 生成覆盖率报告
npm run test:coverage
```

## 📊 监控与可观测性

### Sentry错误监控
- 自动错误捕获和上报
- 性能监控和追踪
- 用户反馈收集
- 版本管理和部署追踪

### 健康检查端点
```bash
GET /health - 系统健康状态
GET /metrics - Prometheus指标 (可选)
```

## 🎯 开发理念

**不重复造轮子，站在巨人的肩膀上**

- ✅ **开源优先**: 优先选择成熟的开源解决方案
- ✅ **最佳实践**: 遵循业界的标准和最佳实践
- ✅ **可维护性**: 使用广泛采用的技术栈
- ✅ **性能优化**: 选择高性能的解决方案

## 🤝 贡献

欢迎提交Issue和Pull Request！

### 开发流程
1. Fork项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建Pull Request

## 📞 联系方式

- **电话**: 17855398215
- **邮箱**: 1666384464@qq.com

## 📝 许可证

MIT License

## 🙏 致谢

感谢所有开源项目的贡献者，是你们的努力让这个项目成为可能！

特别感谢：
- [Awilix](https://github.com/jeffijoe/awilix) - 优秀的依赖注入容器
- [Fastify](https://github.com/fastify/fastify) - 高性能Web框架
- [Bull.js](https://github.com/OptimalBits/bull) - 强大的作业队列
- [Sentry](https://github.com/getsentry/sentry) - 专业的错误监控平台