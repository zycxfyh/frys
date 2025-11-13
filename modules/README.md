# Frys 模块系统

Frys 采用模块化架构设计，每个模块都是独立的可部署单元，具有清晰的职责边界和标准化的接口。

## 🏗️ 模块架构总览

```
modules/
├── frys-kernel/              # 🔧 核心运行时
├── frys-plugin-system/       # 🔌 插件管理系统
├── frys-workflow-engine/     # 🎬 工作流引擎
├── frys-ai-system/          # 🤖 AI推理系统
├── frys-agent-system/       # 🧠 AI代理系统
├── frys-vector-search/      # 🔍 向量搜索引擎
├── frys-eventbus/           # 📡 分布式事件总线
├── frys-config/             # ⚙️ 配置管理
├── frys-cache/              # 💾 缓存系统
├── frys-monitoring/         # 📊 可观测性系统
├── frys-gateway/            # 🚪 API网关
├── frys-websocket/          # 🔗 WebSocket服务
├── frys-database/           # 🗄️ 分布式数据库
├── frys-storage/            # 💽 对象存储服务
├── frys-security/           # 🔒 安全服务
├── frys-logging/            # 📝 分布式日志
├── frys-messaging/          # 💬 消息队列系统
├── frys-plugin-* /          # 🔧 插件生态
└── frys-* /                 # 🎯 扩展模块
```

## 🎯 模块分类

### 核心层 (Core Layer)
- **`frys-kernel`** - 微内核运行时，提供基础的系统服务
- **`frys-plugin-system`** - 插件管理系统，支持动态加载和沙箱执行

### 业务层 (Business Layer)
- **`frys-workflow-engine`** - 工作流执行引擎，核心业务逻辑
- **`frys-ai-system`** - AI推理服务，多模态AI能力
- **`frys-agent-system`** - AI代理系统，自主决策和执行

### 数据层 (Data Layer)
- **`frys-vector-search`** - 向量搜索引擎，相似性搜索
- **`frys-database`** - 分布式数据库服务
- **`frys-storage`** - 对象存储服务
- **`frys-cache`** - 多级缓存系统

### 基础设施层 (Infrastructure Layer)
- **`frys-eventbus`** - 分布式事件总线，模块间通信
- **`frys-config`** - 配置管理系统，支持热重载
- **`frys-monitoring`** - 可观测性系统，监控和告警
- **`frys-gateway`** - API网关，请求路由和认证
- **`frys-security`** - 安全服务，身份认证和授权

### 通信层 (Communication Layer)
- **`frys-websocket`** - WebSocket服务，实时通信
- **`frys-messaging`** - 消息队列系统，异步通信
- **`frys-logging`** - 分布式日志系统

## 🔧 模块开发规范

### 目录结构
```
frys-module-name/
├── Cargo.toml              # 模块配置和依赖
├── src/
│   ├── lib.rs             # 模块入口
│   ├── core.rs            # 核心实现
│   ├── config.rs          # 配置管理
│   ├── error.rs           # 错误定义
│   └── *.rs               # 其他模块
├── tests/                 # 单元测试
├── benches/               # 性能基准测试
├── examples/              # 使用示例
├── docs/                  # 模块文档
└── README.md              # 模块说明
```

### 接口标准

每个模块必须实现以下标准接口：

```rust
#[async_trait]
pub trait FrysModule: Send + Sync {
    /// 模块名称
    fn name(&self) -> &str;

    /// 模块版本
    fn version(&self) -> &str;

    /// 初始化模块
    async fn initialize(&self, context: &ModuleContext) -> Result<()>;

    /// 启动模块
    async fn start(&self) -> Result<()>;

    /// 停止模块
    async fn stop(&self) -> Result<()>;

    /// 健康检查
    async fn health_check(&self) -> HealthStatus;

    /// 获取模块配置
    fn config(&self) -> &ModuleConfig;

    /// 获取模块指标
    fn metrics(&self) -> HashMap<String, f64>;
}
```

### 配置管理

模块配置采用统一的配置模式：

```rust
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ModuleConfig {
    /// 启用状态
    pub enabled: bool,

    /// 模块特定配置
    #[serde(flatten)]
    pub specific: ModuleSpecificConfig,
}
```

### 错误处理

模块错误采用统一的错误类型：

```rust
#[derive(Debug, thiserror::Error)]
pub enum ModuleError {
    #[error("Configuration error: {0}")]
    Config(String),

    #[error("Initialization failed: {0}")]
    Initialization(String),

    #[error("Runtime error: {0}")]
    Runtime(String),

    #[error("Dependency error: {0}")]
    Dependency(String),
}
```

## 🚀 模块生命周期

### 1. 开发阶段
- 创建模块目录结构
- 实现核心功能
- 编写单元测试
- 性能基准测试

### 2. 集成阶段
- 集成到主系统
- 端到端测试
- 文档编写
- CI/CD配置

### 3. 发布阶段
- 版本标记
- Docker镜像构建
- Helm Chart更新
- 发布到插件市场

### 4. 运维阶段
- 监控和告警
- 性能调优
- 安全更新
- 用户支持

## 📊 模块状态

| 模块 | 状态 | 优先级 | 完成度 |
|------|------|--------|--------|
| frys-kernel | ✅ 完成 | 高 | 100% |
| frys-plugin-system | ✅ 完成 | 高 | 100% |
| frys-workflow-engine | ✅ 完成 | 高 | 100% |
| frys-ai-system | ✅ 完成 | 高 | 90% |
| frys-agent-system | ✅ 完成 | 中 | 85% |
| frys-vector-search | ✅ 完成 | 中 | 95% |
| frys-eventbus | ✅ 完成 | 高 | 100% |
| frys-config | ✅ 完成 | 高 | 100% |
| frys-cache | ✅ 完成 | 中 | 100% |
| frys-monitoring | 🔄 开发中 | 高 | 60% |
| frys-gateway | ✅ 完成 | 高 | 80% |
| frys-websocket | ✅ 完成 | 中 | 75% |
| frys-database | ❌ 待开发 | 中 | 0% |
| frys-storage | ❌ 待开发 | 中 | 0% |
| frys-security | ❌ 待开发 | 高 | 0% |
| frys-logging | ❌ 待开发 | 中 | 0% |
| frys-messaging | ❌ 待开发 | 中 | 0% |

## 🎯 开发指南

### 新模块创建

```bash
# 使用模板创建新模块
./scripts/create-module.sh my-feature

# 或者手动创建
mkdir -p modules/frys-my-feature/src
cd modules/frys-my-feature

# 初始化Cargo.toml
cargo init --lib
```

### 测试运行

```bash
# 运行单个模块测试
cargo test -p frys-my-feature

# 运行所有模块测试
cargo test --workspace

# 运行性能基准测试
cargo bench --workspace
```

### 模块间通信

模块间通过事件总线进行通信：

```rust
// 发送事件
eventbus.publish("module.event", event_data).await?;

// 订阅事件
eventbus.subscribe("other.module.event", |event| {
    // 处理事件
}).await?;
```

## 🔌 插件系统集成

每个模块都可以作为插件加载：

```rust
// 动态加载模块
let module = plugin_system.load_plugin("frys-my-feature").await?;
module.initialize(&context).await?;
module.start().await?;
```

## 📈 性能监控

模块性能通过标准指标接口监控：

```rust
// 实现指标接口
impl MetricsProvider for MyModule {
    fn metrics(&self) -> HashMap<String, f64> {
        let mut metrics = HashMap::new();
        metrics.insert("requests_total".to_string(), self.request_count as f64);
        metrics.insert("response_time_avg".to_string(), self.avg_response_time);
        metrics.insert("error_rate".to_string(), self.error_rate);
        metrics
    }
}
```

## 🤝 贡献

欢迎为Frys模块系统贡献代码！

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/new-module`)
3. 提交更改 (`git commit -am 'Add new module'`)
4. 推送分支 (`git push origin feature/new-module`)
5. 创建 Pull Request

## 📚 相关文档

- [模块开发指南](docs/module-development.md)
- [API 接口文档](docs/api-reference.md)
- [插件系统文档](frys-plugin-system/README.md)
- [架构设计文档](../docs/architecture.md)
