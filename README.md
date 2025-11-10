# 🍳 frys - 轻量级工作流编排引擎

> 从75,020行代码到2,000行代码的架构重构之旅

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🌟 项目简介

frys是一个专为中小企业设计的轻量级工作流编排引擎，帮助开发者简单、高效地自动化复杂的业务流程。

### 🎯 核心价值

- **简单易用**: 直观的YAML/JSON配置，无需复杂设置
- **轻量高效**: 单文件部署，资源占用少，启动快速
- **功能强大**: 支持任务依赖、并行执行、错误重试、状态监控
- **高度扩展**: 插件化架构，支持自定义任务类型

### 🚀 快速开始

#### 安装

```bash
npm install -g frys
# 或者
pnpm add frys
```

#### 创建工作流

```javascript
import { WorkflowEngine, WorkflowDefinition } from 'frys';

// 创建工作流引擎
const engine = new WorkflowEngine();

// 定义工作流
const workflowDef = {
  name: '部署流程',
  tasks: [
    {
      id: 'build',
      name: '构建应用',
      type: 'script',
      config: {
        script: 'npm run build'
      }
    },
    {
      id: 'test',
      name: '运行测试',
      type: 'script',
      config: {
        script: 'npm test'
      },
      dependencies: ['build']
    },
    {
      id: 'deploy',
      name: '部署应用',
      type: 'script',
      config: {
        script: 'npm run deploy'
      },
      dependencies: ['test']
    }
  ]
};

// 创建并启动工作流
const workflowId = engine.createWorkflow(workflowDef);
await engine.startWorkflow(workflowId);
```

#### 命令行使用

```bash
# 启动服务器
frys --server

# 运行示例工作流
frys --example

# 显示帮助
frys --help
```

## 🏗️ 架构设计

### 分层架构

```
src/
├── workflow/           # 核心工作流引擎
│   ├── WorkflowEngine.js    # 工作流执行引擎
│   ├── TaskScheduler.js     # 任务调度器
│   ├── WorkflowState.js     # 状态管理器
│   └── WorkflowDefinition.js # 定义验证器
├── core/               # 基础服务层
│   ├── Config.js            # 配置管理
│   ├── Logger.js            # 日志系统
│   ├── EventBus.js          # 事件总线
│   └── Container.js         # 依赖注入
├── api/                # REST API接口
│   ├── WorkflowAPI.js       # 工作流API
│   └── HealthAPI.js         # 健康检查API
└── types/              # 类型定义
    └── workflow.js          # 工作流类型
```

### 核心特性

#### 1. 任务类型支持

- **HTTP任务**: 调用REST API
- **脚本任务**: 执行JavaScript代码
- **延迟任务**: 暂停执行
- **条件任务**: 条件分支

#### 2. 依赖管理

```javascript
{
  tasks: [
    { id: 'task1', name: '第一步' },
    { id: 'task2', name: '第二步', dependencies: ['task1'] },
    { id: 'task3', name: '第三步', dependencies: ['task1'] },
    { id: 'task4', name: '第四步', dependencies: ['task2', 'task3'] }
  ]
}
```

#### 3. 错误处理和重试

```javascript
{
  maxRetries: 3,      // 最大重试次数
  retryDelay: 1000,   // 重试间隔(ms)
}
```

#### 4. 实时监控

- 工作流状态跟踪
- 任务执行监控
- 性能指标收集
- 事件驱动通知

## 📊 API接口

### REST API

#### 工作流管理

```http
GET    /api/workflows           # 获取所有工作流
GET    /api/workflows/:id       # 获取指定工作流
POST   /api/workflows           # 创建工作流
POST   /api/workflows/:id/start # 启动工作流
POST   /api/workflows/:id/pause # 暂停工作流
DELETE /api/workflows/:id       # 删除工作流
```

#### 健康检查

```http
GET    /api/health              # 基础健康检查
GET    /api/health/detailed     # 详细健康检查
GET    /api/health/ping         # 连通性检查
```

## 🔧 开发指南

### 环境要求

- Node.js >= 18.0.0
- npm 或 pnpm

### 本地开发

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm run dev

# 运行测试
pnpm run test

# 构建项目
pnpm run build
```

### 架构原则

1. **单一职责**: 每个模块只负责一个明确的功能
2. **依赖倒置**: 高层模块不依赖低层模块的具体实现
3. **开闭原则**: 对扩展开放，对修改关闭
4. **接口隔离**: 提供小而专注的接口

## 📈 重构历程

### Before (问题项目)

- ❌ **75,020行代码**: 过度复杂，难以维护
- ❌ **100+个文件**: 文件组织混乱
- ❌ **6层目录嵌套**: 深度过深
- ❌ **28个Inspired文件**: 复制粘贴代码
- ❌ **389个导入/导出**: 耦合度极高

### After (重构项目)

- ✅ **~2,000行核心代码**: 精简高效
- ✅ **清晰的模块化架构**: 职责分离
- ✅ **4层简洁目录结构**: 易于理解
- ✅ **移除所有Inspired文件**: 使用标准库
- ✅ **简化依赖关系**: 松耦合设计

### 重构收益

1. **可维护性提升**: 代码结构清晰，易于修改
2. **性能优化**: 移除不必要的抽象层
3. **学习价值**: 从失败项目到成功项目的转型
4. **扩展性增强**: 插件化架构支持未来扩展

## 🤝 贡献指南

欢迎提交Issue和Pull Request！

1. Fork 本仓库
2. 创建特性分支: `git checkout -b feature/amazing-feature`
3. 提交更改: `git commit -m 'Add amazing feature'`
4. 推送分支: `git push origin feature/amazing-feature`
5. 提交 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

- 感谢所有为frys项目贡献代码的开发者
- 感谢开源社区提供的优秀工具和库
- 特别感谢架构重构过程中获得的宝贵经验

---

**frys** - 让工作流编排变得简单而强大！ 🚀