# 🚀 frys - 现代化工作流管理系统

<div align="center">

<img src="https://img.shields.io/badge/frys-v1.0.0-blue?style=for-the-badge&logo=npm" alt="frys version" />
<img src="https://img.shields.io/badge/Node.js-16+-339933?style=for-the-badge&logo=nodedotjs" alt="Node.js version" />
<img src="https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge" alt="MIT License" />
<img src="https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker" alt="Docker Ready" />

[![CI/CD Pipeline](https://img.shields.io/github/actions/workflow/status/zycxfyh/frys/ci.yml?branch=main&style=flat-square&logo=github)](https://github.com/zycxfyh/frys/actions)
[![Code Coverage](https://img.shields.io/codecov/c/github/zycxfyh/frys?style=flat-square&logo=codecov)](https://codecov.io/gh/zycxfyh/frys)
[![npm downloads](https://img.shields.io/npm/dm/frys?style=flat-square&logo=npm)](https://www.npmjs.com/package/frys)
[![GitHub stars](https://img.shields.io/github/stars/zycxfyh/frys?style=flat-square&logo=github)](https://github.com/zycxfyh/frys/stargazers)

*🌟 基于优秀开源项目的轻量化企业级工作流平台*

[📖 文档](docs/) • [🐛 问题反馈](https://github.com/zycxfyh/frys/issues) • [💬 讨论交流](https://github.com/zycxfyh/frys/discussions) • [📦 NPM](https://www.npmjs.com/package/frys)

---

## ✨ 项目亮点

<div align="center">

| 🎯 **核心价值** | 🏗️ **架构设计** | 🚀 **性能表现** |
|:---------------:|:---------------:|:---------------:|
| 轻量化企业级解决方案 | 模块化插件架构 | 高并发处理能力 |
| 开箱即用的工作流引擎 | 基于优秀开源项目 | 低资源消耗 |
| 完整的企业级功能 | 可扩展的组件生态 | 卓越的稳定性 |

</div>

---

## 🏗️ 系统架构

### 📊 技术栈概览

<div align="center">

```mermaid
graph TB
    A[frys] --> B[应用层]
    A --> C[核心层]
    A --> D[基础设施层]

    B --> B1[工作流引擎]
    B --> B2[业务服务]
    B --> B3[API控制器]

    C --> C1[依赖注入容器]
    C --> C2[插件管理系统]
    C --> C3[错误监控系统]

    D --> D1[数据库]
    D --> D2[缓存]
    D --> D3[消息队列]
```

</div>

### 🎨 核心特性

<div align="center">

| ✨ 特性 | 📋 描述 | 🎯 优势 |
|--------|---------|---------|
| 🚀 **高性能架构** | 基于 Fastify 的现代化 Web 框架 | 卓越的吞吐量和响应速度 |
| 📦 **模块化设计** | 基于 Awilix 的依赖注入容器 | 高度解耦，可维护性强 |
| 📨 **消息队列** | 基于 Bull.js 的可靠作业队列系统 | 异步处理，保证数据一致性 |
| 🔍 **可观测性** | 集成 Sentry 错误监控和性能追踪 | 实时监控，快速定位问题 |
| 🧪 **完整测试** | 覆盖单元、集成、性能、安全测试 | 代码质量保障，可靠交付 |
| 🐳 **容器化** | Docker 一键部署 | 环境一致性，快速扩容 |
| 📊 **监控告警** | Prometheus + Grafana 监控栈 | 实时监控，智能告警 |

</div>

---

## 📚 核心模块详解

### 🏭 [项目概述](docs/modules/project-overview.md)

<div align="center">

**🎯 项目核心价值与架构设计**

</div>

轻量级企业级工作流管理系统，采用"站在巨人肩膀上"的理念，集成业界领先的开源解决方案。

- **设计理念**: 模块化、轻量化、安全优先
- **核心价值**: 快速部署、易于维护、高可扩展
- **应用场景**: 企业工作流、任务调度、业务流程管理

> 📖 [详细了解项目概述 →](docs/modules/project-overview.md)

---

### 🔧 [核心架构](docs/modules/core-architecture.md)

<div align="center">

**🏗️ 系统核心架构组件**

</div>

构建高性能、可扩展的企业级应用框架的核心组件。

#### 🎨 依赖注入容器 (Awilix)
- 轻量级服务定位器和依赖注入容器
- 支持构造函数注入和属性注入
- 自动依赖解析和生命周期管理

#### 🔌 插件管理系统 (fastify-plugin)
- 基于 Fastify 的插件架构
- 热插拔式的模块扩展机制
- 钩子系统和中间件支持

#### 📊 错误监控系统 (Sentry)
- 实时错误追踪和性能监控
- 分布式追踪和上下文信息
- 智能告警和问题分析

> 📖 [深入了解核心架构 →](docs/modules/core-architecture.md)

---

### 🛠️ [核心功能模块](docs/modules/core-modules.md)

<div align="center">

**⚡ 集成业界领先的开源解决方案**

</div>

#### 🌐 HTTP 客户端 (Axios)
- 基于 Axios 的企业级 HTTP 客户端
- 自动重试、超时处理、拦截器支持
- 请求/响应缓存和性能监控

#### 🎨 状态管理 (Zustand)
- 轻量级响应式状态管理库
- 基于 Flux 架构的设计理念
- 类型安全的状态更新机制

#### 📨 消息队列 (Bull.js)
- Redis 驱动的高性能作业队列
- 延迟任务、优先级队列、重复任务
- 监控面板和错误重试机制

#### 📡 事件系统 (EventEmitter3)
- 高性能的事件发射器
- 支持通配符和命名空间
- 内存优化的事件订阅机制

#### 🔐 认证授权 (JWT)
- 基于 JSON Web Token 的认证方案
- 无状态的身份验证机制
- 角色-based 访问控制 (RBAC)

#### 📅 日期时间处理 (Day.js)
- 轻量级的日期时间操作库
- 时区支持和国际化
- 链式操作和插件扩展

#### 🛠️ 工具函数库 (Lodash)
- 函数式编程工具集合
- 数组、对象、字符串操作
- 性能优化的实用函数

> 📖 [探索所有核心模块 →](docs/modules/core-modules.md)

---

### 🏢 [业务服务层](docs/modules/business-services.md)

<div align="center">

**💼 企业级业务逻辑实现**

</div>

#### 👤 用户服务 (UserService)
- 用户注册、登录、信息管理
- 角色权限控制和用户状态管理
- 安全的密码加密和验证机制

#### ⚙️ 工作流引擎 (WorkflowEngine)
- 可视化工作流设计和执行
- 动态任务调度和状态跟踪
- 条件分支和并行处理支持

> 📖 [了解业务服务实现 →](docs/modules/business-services.md)

---

### 🧪 [测试架构](docs/modules/testing-architecture.md)

<div align="center">

**🧪 完整的质量保障体系**

</div>

#### 🧪 单元测试 (Vitest)
- 快速的单元测试框架
- ESModule 原生支持
- 丰富的断言和 mocking 工具

#### 🔗 集成测试 (Testcontainers)
- 基于容器的集成测试
- 真实的数据库和外部服务
- 隔离的测试环境

#### 🌐 端到端测试 (Playwright)
- 跨浏览器的自动化测试
- 真实的 UI 交互测试
- 截图对比和视觉回归测试

#### 📈 性能测试 (k6)
- 高负载性能测试工具
- 自定义指标和阈值监控
- 云原生性能测试平台

#### 🔒 安全测试
- 漏洞扫描和渗透测试
- 依赖安全检查
- 代码安全分析

> 📖 [掌握测试最佳实践 →](docs/modules/testing-architecture.md)

---

### 🛠️ [工具函数库](docs/modules/utilities.md)

<div align="center">

**🔧 开发效率提升工具集**

</div>

#### ⚙️ 配置管理
- 多源配置支持 (环境变量、文件、远程)
- 配置验证和类型转换
- 热重载配置更新

#### 📝 日志系统
- 结构化日志记录
- 多级别日志输出
- 异步写入和日志轮转

#### 💾 缓存管理
- 多层缓存策略 (内存、Redis)
- LRU/FIFO 淘汰算法
- 缓存预热和性能监控

#### ✅ 数据验证
- 基于 Schema 的数据验证
- 自定义验证规则和错误消息
- 验证管道和缓存优化

> 📖 [探索工具函数库 →](docs/modules/utilities.md)

---

### 🚀 [DevOps 指南](docs/modules/devops.md)

<div align="center">

**⚙️ 完整的 DevOps 解决方案**

</div>

#### 🐳 容器化部署
- 多阶段 Dockerfile 构建优化
- Docker Compose 开发环境编排
- 安全加固和镜像优化

#### ☸️ Kubernetes 部署
- Helm Chart 包管理
- 滚动更新和蓝绿部署
- HPA 自动扩缩容

#### 🔄 CI/CD 流水线
- GitHub Actions 自动化流程
- 多环境部署策略
- 质量门禁和回滚机制

#### 📊 监控告警
- Prometheus 指标收集
- Grafana 可视化监控面板
- Alertmanager 智能告警

#### 🔒 安全运维
- 容器安全扫描
- 密钥管理和访问控制
- 日志审计和合规检查

> 📖 [部署运维全指南 →](docs/modules/devops.md)

---

## 🚀 快速开始

<div align="center">

### ⚡ 三分钟上手指南

</div>

### 📋 环境要求

<div align="center">

| 组件 | 版本要求 | 用途 | 可选/必需 |
|------|----------|------|----------|
| 🟢 **Node.js** | >= 16.0.0 | 运行环境 | 必需 |
| 🔴 **Redis** | >= 6.0 | 消息队列和缓存 | 必需 |
| 🐳 **Docker** | >= 20.0 | 容器化部署 | 可选 |
| 🐘 **PostgreSQL** | >= 12.0 | 数据存储 | 可选 |

</div>

### 🛠️ 安装部署

#### 📦 方式一：NPM 安装 (推荐)

```bash
# 全局安装 CLI 工具
npm install -g frys

# 创建新项目
frys create my-workflow-app
cd my-workflow-app

# 启动开发服务器
frys dev
```

#### 📥 方式二：源码安装

```bash
# 克隆项目
git clone https://github.com/zycxfyh/frys.git
cd frys

# 安装依赖
npm install

# 复制环境配置
cp .env.example .env

# 编辑配置 (可选)
nano .env
```

### ⚙️ 配置说明

```bash
# 核心配置
NODE_ENV=development
PORT=3000

# 数据库配置 (可选)
DATABASE_URL=postgresql://user:password@localhost:5432/frys

# Redis 配置 (必需)
REDIS_URL=redis://localhost:6379

# JWT 配置
JWT_SECRET=your-super-secret-key
JWT_EXPIRES_IN=7d

# 监控配置 (可选)
SENTRY_DSN=https://your-dsn@sentry.io/project-id
```

### ▶️ 启动运行

#### 🏠 开发模式

```bash
# 带热重载的开发服务器
npm run dev

# 或使用 CLI
frys dev
```

#### 🏭 生产模式

```bash
# 构建生产版本
npm run build

# 启动生产服务器
npm start

# 或使用 PM2
npm install -g pm2
pm2 start dist/index.js --name frys-app
```

#### 🐳 Docker 部署

```bash
# 构建镜像
docker build -t frys:latest .

# 运行容器
docker run -p 3000:3000 \
  -e REDIS_URL=redis://host.docker.internal:6379 \
  frys:latest
```

### ✅ 验证安装

```bash
# 健康检查
curl http://localhost:3000/health

# 获取 API 信息
curl http://localhost:3000/api/info

# 查看日志
tail -f logs/frys.log
```

---

## 📖 使用指南

### 🎨 创建工作流

<div align="center">

**🚀 从零开始构建您的第一个工作流**

</div>

#### 📝 基础工作流

```javascript
import { WorkflowEngine, UserService } from 'frys';

// 初始化服务
const workflowEngine = new WorkflowEngine();
const userService = new UserService();

// 定义工作流
const userRegistrationWorkflow = {
  name: '用户注册流程',
  steps: [
    {
      id: 'validate-input',
      type: 'validation',
      config: {
        rules: {
          email: 'required|email',
          password: 'required|min:8'
        }
      }
    },
    {
      id: 'create-user',
      type: 'service-call',
      config: {
        service: 'userService',
        method: 'createUser',
        params: ['email', 'password']
      }
    },
    {
      id: 'send-welcome-email',
      type: 'notification',
      config: {
        type: 'email',
        template: 'welcome',
        recipient: 'user.email'
      }
    }
  ]
};

// 注册并执行工作流
await workflowEngine.registerWorkflow(userRegistrationWorkflow);

// 执行工作流
const result = await workflowEngine.executeWorkflow('user-registration', {
  email: 'user@example.com',
  password: 'securepassword123'
});

console.log('工作流执行结果:', result);
```

#### 🔄 高级工作流 (条件分支)

```javascript
const advancedWorkflow = {
  name: '高级审批流程',
  steps: [
    {
      id: 'initial-review',
      type: 'manual-approval',
      config: {
        approver: 'manager',
        timeout: '24h'
      }
    },
    {
      id: 'conditional-path',
      type: 'condition',
      config: {
        expression: 'approval.status === "approved"',
        trueStep: 'process-approved',
        falseStep: 'process-rejected'
      }
    },
    {
      id: 'process-approved',
      type: 'parallel',
      config: {
        steps: ['notify-team', 'create-task', 'update-status']
      }
    },
    {
      id: 'process-rejected',
      type: 'notification',
      config: {
        type: 'email',
        template: 'rejection',
        recipient: 'requestor'
      }
    }
  ]
};
```

### 🌐 HTTP API 使用

```javascript
import axios from 'axios';

// 配置基础设置
const client = axios.create({
  baseURL: 'http://localhost:3000/api',
  timeout: 10000,
});

// 用户管理
const users = await client.get('/users');
const newUser = await client.post('/users', {
  email: 'john@example.com',
  name: 'John Doe'
});

// 工作流管理
const workflows = await client.get('/workflows');
const execution = await client.post('/workflows/execute', {
  workflowId: 'user-onboarding',
  data: { userId: newUser.id }
});
```

### 🎨 状态管理

```javascript
import { create } from 'zustand';

// 创建全局状态
const useWorkflowStore = create((set, get) => ({
  workflows: [],
  currentWorkflow: null,
  isLoading: false,

  // 异步操作
  fetchWorkflows: async () => {
    set({ isLoading: true });
    try {
      const response = await fetch('/api/workflows');
      const workflows = await response.json();
      set({ workflows, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  // 同步操作
  setCurrentWorkflow: (workflow) => set({ currentWorkflow: workflow }),

  // 计算属性
  get activeWorkflows: () => get().workflows.filter(w => w.status === 'active'),
}));

// 在组件中使用
function WorkflowList() {
  const {
    workflows,
    currentWorkflow,
    isLoading,
    fetchWorkflows,
    setCurrentWorkflow,
    activeWorkflows
  } = useWorkflowStore();

  // 使用状态和方法
  // ...
}
```

---

## 🤝 贡献指南

<div align="center">

**🌟 欢迎加入 frys 社区！**

</div>

### 🐛 问题反馈

- [🐛 报告 Bug](https://github.com/zycxfyh/frys/issues/new?template=bug_report.md)
- [💡 功能建议](https://github.com/zycxfyh/frys/issues/new?template=feature_request.md)
- [❓ 寻求帮助](https://github.com/zycxfyh/frys/discussions)

### 🔄 开发流程

#### 1️⃣ Fork & Clone
```bash
git clone https://github.com/your-username/frys.git
cd frys
git checkout -b feature/your-feature-name
```

#### 2️⃣ 环境设置
```bash
npm install
cp .env.example .env
# 配置你的开发环境
```

#### 3️⃣ 开发 & 测试
```bash
# 运行测试
npm test

# 运行特定测试
npm test -- --run tests/unit/specific-test.test.js

# 代码检查
npm run lint

# 代码格式化
npm run format
```

#### 4️⃣ 提交代码
```bash
git add .
git commit -m "feat: 添加新功能

- 功能描述
- 相关问题 #123"
git push origin feature/your-feature-name
```

#### 5️⃣ 创建 Pull Request
- 前往 [Pull Requests](https://github.com/zycxfyh/frys/pulls)
- 点击 "New Pull Request"
- 选择你的分支并创建 PR

### 📋 代码规范

#### 🎯 提交信息格式
```
type(scope): description

[optional body]

[optional footer]
```

**Type 类型:**
- `feat`: 新功能
- `fix`: 修复bug
- `docs`: 文档更新
- `style`: 代码格式调整
- `refactor`: 代码重构
- `test`: 测试相关
- `chore`: 构建过程或工具配置

#### 🔍 代码质量要求

- ✅ 通过所有测试 (`npm test`)
- ✅ 通过 ESLint 检查 (`npm run lint`)
- ✅ 代码覆盖率 >= 80%
- ✅ 更新相关文档
- ✅ 添加必要的测试用例

---

## 📈 项目状态

<div align="center">

### 📊 开发进度

| 阶段 | 状态 | 完成度 |
|------|------|--------|
| 🏗️ **核心架构** | ✅ 完成 | 100% |
| 🔧 **核心模块** | ✅ 完成 | 100% |
| 🏢 **业务服务** | ✅ 完成 | 95% |
| 🧪 **测试体系** | ✅ 完成 | 90% |
| 🚀 **DevOps** | ✅ 完成 | 85% |
| 📚 **文档系统** | ✅ 完成 | 95% |

</div>

### 🎯 即将推出

- [ ] 🔮 AI 辅助工作流设计
- [ ] 📊 高级监控面板
- [ ] ☸️ Kubernetes 原生支持
- [ ] 🌐 多租户架构
- [ ] 📱 移动端应用

---

## 🏆 最佳实践

### ⚡ 性能优化

```javascript
// 1. 使用连接池
const pool = new Pool({
  max: 20,
  idleTimeoutMillis: 30000,
});

// 2. 实现缓存策略
const cache = new CacheManager({
  layers: [
    new MemoryCache({ maxSize: 1000 }),
    new RedisCache({ host: 'localhost' })
  ]
});

// 3. 异步处理重任务
const queue = new Bull('heavy-tasks', {
  redis: process.env.REDIS_URL
});

queue.process(async (job) => {
  // 处理重任务
});
```

### 🔒 安全加固

```javascript
// 输入验证
const validateInput = (data) => {
  const schema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
  });

  return schema.validate(data);
};

// 速率限制
const rateLimit = new RateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

// 安全头
app.register(require('fastify-helmet'), {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"]
    }
  }
});
```

### 📊 监控告警

```javascript
// 应用指标
const collectMetrics = () => {
  return {
    activeConnections: server.metrics.activeConnections,
    responseTime: server.metrics.responseTime,
    errorRate: server.metrics.errorRate,
    memoryUsage: process.memoryUsage(),
    uptime: process.uptime()
  };
};

// 健康检查
app.get('/health', async (request, reply) => {
  const health = await healthChecker.check();
  reply.send(health);
});

// 告警规则
const alertRules = [
  {
    name: 'High Error Rate',
    condition: 'error_rate > 0.05',
    severity: 'critical'
  },
  {
    name: 'High Memory Usage',
    condition: 'memory_usage > 0.8',
    severity: 'warning'
  }
];
```

---

## 📞 联系方式

<div align="center">

**💬 让我们一起交流！**

</div>

- **📧 邮箱**: 1666384464@qq.com
- **📞 电话**: 17855398215
- **🏠 项目主页**: [https://github.com/zycxfyh/frys](https://github.com/zycxfyh/frys)
- **🐛 问题反馈**: [Issues](https://github.com/zycxfyh/frys/issues)
- **💬 讨论交流**: [Discussions](https://github.com/zycxfyh/frys/discussions)
- **📖 技术文档**: [docs/](docs/)

---

## 📄 许可证

本项目采用 **MIT 许可证** - 查看 [LICENSE](LICENSE) 文件了解详情。

## ⚠️ 免责声明

**重要提醒**: 本项目为学习和研究目的开发的开源项目，不应用于生产环境。

- 本软件仅供学习、研究和开发测试使用
- 任何商业使用产生的风险由使用者自行承担
- 作者不对使用本软件产生的任何直接或间接损失承担责任
- 建议在充分测试和评估后再考虑用于生产环境

## 🙏 致谢

感谢所有为 **frys** 做出贡献的开发者！

特别感谢以下开源项目的贡献者：

- [Fastify](https://github.com/fastify/fastify) - 高性能 Web 框架
- [Awilix](https://github.com/jeffijoe/awilix) - 依赖注入容器
- [Bull.js](https://github.com/OptimalBits/bull) - 消息队列
- [Sentry](https://github.com/getsentry/sentry) - 错误监控平台
- [Zustand](https://github.com/pmndrs/zustand) - 状态管理
- 以及其他优秀的开源项目

---

## 🎉 加入社区

<div align="center">

**🌟 与全球开发者一起构建更好的工作流平台**

| 📈 **Star 趋势** | 👥 **贡献者** | 📦 **下载量** | 🐛 **Issues** |
|:---------------:|:-------------:|:-------------:|:-------------:|
| [![GitHub stars](https://img.shields.io/github/stars/zycxfyh/frys?style=social)](https://github.com/zycxfyh/frys/stargazers) | [![GitHub contributors](https://img.shields.io/github/contributors/zycxfyh/frys)](https://github.com/zycxfyh/frys/graphs/contributors) | [![npm downloads](https://img.shields.io/npm/dm/frys)](https://www.npmjs.com/package/frys) | [![GitHub issues](https://img.shields.io/github/issues/zycxfyh/frys)](https://github.com/zycxfyh/frys/issues) |

---

<div align="center">

**用 ❤️ 构建，由开源社区驱动**

[⭐ Star](https://github.com/zycxfyh/frys) • [🍴 Fork](https://github.com/zycxfyh/frys/fork) • [📖 文档](docs/) • [🐛 报告问题](https://github.com/zycxfyh/frys/issues) • [💬 加入讨论](https://github.com/zycxfyh/frys/discussions)

---

*最后更新: 2024年11月*
