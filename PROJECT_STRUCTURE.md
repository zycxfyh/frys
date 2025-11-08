# 项目结构说明

## 目录结构

```
/
├── src/                          # 源代码目录
│   ├── core/                     # 核心模块
│   ├── domain/                   # 领域层
│   │   ├── entities/            # 领域实体
│   │   ├── repositories/         # 仓储接口和实现
│   │   └── services/            # 领域服务
│   ├── application/              # 应用服务层
│   │   ├── services/            # 应用服务
│   │   └── use-cases/           # 用例
│   ├── infrastructure/           # 基础设施层
│   │   ├── database/            # 数据库相关
│   │   ├── messaging/           # 消息队列
│   │   ├── external/            # 外部服务集成
│   │   └── persistence/         # 持久化层
│   ├── presentation/             # 表现层
│   │   ├── controllers/         # 控制器
│   │   ├── routes/              # 路由
│   │   └── middleware/          # 中间件
│   └── shared/                   # 共享工具和类型
│       ├── utils/               # 工具函数
│       ├── types/               # 类型定义
│       ├── constants/           # 常量
│       └── kernel/             # 核心抽象类
├── config/                       # 配置文件
├── scripts/                      # 构建和部署脚本
├── docs/                         # 详细文档
├── examples/                     # 使用示例
├── demos/                        # 演示文件
├── plugins/                      # 插件
├── monitoring/                   # 监控配置
├── dist/                        # 构建输出
├── test-results/                # 测试结果
├── logs/                        # 日志文件
├── node_modules/                # 依赖包
└── 根目录配置文件               # package.json, vitest.config.js 等
```

## 架构说明

本项目采用**分层架构**设计模式：

1. **表现层 (Presentation)**: 处理HTTP请求、响应和用户界面
2. **应用层 (Application)**: 协调领域对象完成业务用例
3. **领域层 (Domain)**: 核心业务逻辑和领域模型
4. **基础设施层 (Infrastructure)**: 技术实现细节，如数据库、消息队列等

## 依赖关系

- 上层可以依赖下层
- 下层不能依赖上层
- 同层之间通过接口依赖

```
Presentation → Application → Domain → Infrastructure
     ↓            ↓           ↓           ↓
   Shared        Shared      Shared      Shared
```

## 文件命名约定

- **目录**: 蛇形命名法 (snake_case)
- **文件**: 帕斯卡命名法 (PascalCase) 用于类文件
- **文件**: 驼峰命名法 (camelCase) 用于工具和配置
- **测试文件**: 与被测文件同名，添加 `.test.js` 后缀

## 重要文件

- `src/index.js`: 应用入口
- `package.json`: 项目配置和依赖
- `vitest.config.js`: 测试配置
- `project/config/`: 各种环境配置
