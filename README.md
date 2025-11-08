# 🚀 frys - 现代化工作流管理系统

<div align="center">

<br>

<img src="https://img.shields.io/badge/frys-v1.0.0-blue?style=for-the-badge&logo=npm" alt="frys version" />
<img src="https://img.shields.io/badge/Node.js-16+-339933?style=for-the-badge&logo=nodedotjs" alt="Node.js version" />
<img src="https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge" alt="MIT License" />
<img src="https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker" alt="Docker Ready" />

[![CI/CD Pipeline](https://img.shields.io/github/actions/workflow/status/zycxfyh/frys/ci.yml?branch=main&style=flat-square&logo=github)](https://github.com/zycxfyh/frys/actions)
[![Code Coverage](https://img.shields.io/codecov/c/github/zycxfyh/frys?style=flat-square&logo=codecov)](https://codecov.io/gh/zycxfyh/frys)
[![npm downloads](https://img.shields.io/npm/dm/frys?style=flat-square&logo=npm)](https://www.npmjs.com/package/frys)
[![GitHub stars](https://img.shields.io/github/stars/zycxfyh/frys?style=flat-square&logo=github)](https://github.com/zycxfyh/frys/stargazers)

<br>

<h1 style="border: none; background: linear-gradient(45deg, #667eea 25%, transparent 25%), linear-gradient(-45deg, #667eea 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #667eea 75%), linear-gradient(-45deg, transparent 75%, #667eea 75%); background-size: 20px 20px; background-position: 0 0, 0 10px, 10px -10px, -10px 0px; -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">🌟 基于优秀开源项目的轻量化企业级工作流平台 🌟</h1>

<p><em>站在巨人肩膀上，集成业界领先开源解决方案，构建高性能、可扩展的企业级工作流管理系统</em></p>

<br>

[🚀 快速开始](GETTING_STARTED.md) • [📖 完整文档](docs/) • [🐛 问题反馈](https://github.com/zycxfyh/frys/issues) • [💬 社区讨论](https://github.com/zycxfyh/frys/discussions)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://github.com/prettier/prettier)

---

</div>

## ✨ 项目特色

<div align="center">

<table>
  <tr>
    <td align="center" width="33%">
      <h3>🎯 轻量化设计</h3>
      <p>精简内核 + 插件扩展，5分钟快速部署</p>
    </td>
    <td align="center" width="33%">
      <h3>🏗️ 企业级架构</h3>
      <p>基于Fastify + Awilix，支持高并发处理</p>
    </td>
    <td align="center" width="33%">
      <h3>🚀 现代化工具链</h3>
      <p>完整的DevOps流程，99.9%可用性保障</p>
    </td>
  </tr>
</table>

</div>

### 🏆 核心优势

- **🔧 集成优秀开源项目**: Axios、Bull.js、Sentry等业界领先解决方案
- **📦 开箱即用**: 内置工作流引擎、用户管理、权限控制等企业级功能
- **🧪 完整测试体系**: 单元测试、集成测试、E2E测试覆盖率90%+
- **🐳 云原生支持**: Docker容器化，Kubernetes部署就绪
- **📊 可观测性**: Prometheus监控，Grafana可视化面板

---

## 🚀 快速开始

### 📦 安装

```bash
# 克隆项目
git clone https://github.com/zycxfyh/frys.git
cd frys

# 安装依赖
npm install

# 启动开发环境
npm run dev
```

### 🎮 基本使用

```javascript
import { WorkflowEngine, UserService } from 'frys';

// 创建工作流引擎
const engine = new WorkflowEngine();

// 定义简单工作流
const workflow = {
  name: '用户注册流程',
  steps: [
    {
      id: 'validate-input',
      name: '验证输入',
      type: 'validation',
      config: { required: ['email', 'password'] },
    },
    {
      id: 'create-user',
      name: '创建用户',
      type: 'service',
      config: { service: 'userService.createUser' },
    },
  ],
};

// 执行工作流
const result = await engine.execute(workflow, {
  email: 'user@example.com',
  password: 'secure123',
});
```

> 💡 **更多示例**: 查看 [完整快速开始指南](GETTING_STARTED.md)

---

## 📊 系统架构

<div align="center">

```mermaid
graph TB
    subgraph "🎯 frys 工作流平台"
        A[应用层<br/>Application Layer]
        B[核心层<br/>Core Layer]
        C[基础设施层<br/>Infrastructure Layer]
    end

    A --> A1[工作流引擎<br/>Workflow Engine]
    A --> A2[业务服务<br/>Business Services]
    A --> A3[API控制器<br/>API Controllers]

    B --> B1[依赖注入容器<br/>Awilix DI]
    B --> B2[插件管理系统<br/>Plugin System]
    B --> B3[错误监控系统<br/>Sentry Monitoring]

    C --> C1[(数据库<br/>PostgreSQL)]
    C --> C2[缓存层<br/>Redis Cache]
    C --> C3[消息队列<br/>Bull.js Queue]

    style A fill:#e1f5fe
    style B fill:#f3e5f5
    style C fill:#e8f5e8
```

</div>

### 🏗️ 核心技术栈

| 组件           | 技术选型   | 说明                  |
| -------------- | ---------- | --------------------- |
| **Web框架**    | Fastify    | 高性能Node.js Web框架 |
| **依赖注入**   | Awilix     | 轻量级DI容器          |
| **HTTP客户端** | Axios      | 企业级HTTP请求库      |
| **消息队列**   | Bull.js    | Redis驱动的任务队列   |
| **数据库**     | PostgreSQL | 关系型数据库          |
| **缓存**       | Redis      | 高性能缓存存储        |
| **监控**       | Sentry     | 错误追踪和性能监控    |

> 📖 **详细架构文档**: [系统架构设计](docs/architecture/system-architecture.md)

---

## 📖 文档与资源

- **[完整文档](docs/)** - 详细的使用指南和 API 文档
- **[架构设计](docs/architecture/)** - 系统架构和技术决策
- **[部署指南](docs/deployment/)** - 生产环境部署说明
- **[开发指南](docs/development/)** - 开发环境设置和贡献指南

---

## 📈 项目状态

<div align="center">

### 🎯 当前版本: v1.0.0

| 状态            | 说明                           | 进度   |
| --------------- | ------------------------------ | ------ |
| ✅ **核心架构** | 依赖注入、工作流引擎、插件系统 | 100%   |
| ✅ **基础功能** | 用户管理、工作流执行、API服务  | 95%    |
| 🚧 **AI集成**   | 多供应商AI API管理             | 80%    |
| 🚧 **高级功能** | 记忆系统、实时通信             | 60%    |
| 📋 **企业功能** | SSO、审计、多租户              | 规划中 |

> 📊 **详细状态**: 查看 [项目状态面板](STATUS.md)

</div>

---

## 🤝 社区与贡献

我们欢迎各种形式的贡献！请查看我们的 [贡献指南](CONTRIBUTING.md) 了解详细信息。

### 💡 贡献方式

- 🐛 [报告 Bug](https://github.com/zycxfyh/frys/issues/new?template=bug-report.md)
- 💡 [提出功能请求](https://github.com/zycxfyh/frys/issues/new?template=feature-request.md)
- 📚 [改进文档](https://github.com/zycxfyh/frys/issues/new?template=documentation.md)
- 🚀 [提交 Pull Request](https://github.com/zycxfyh/frys/compare)

### 📜 行为准则

本项目采用 [贡献者公约](CODE_OF_CONDUCT.md) 作为行为准则。

---

## 📄 许可证

本项目采用 [MIT 许可证](LICENSE)。

---

_最后更新: 2025年11月_
