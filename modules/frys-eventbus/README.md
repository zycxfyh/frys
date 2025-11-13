# Frys EventBus - 高性能事件系统

## 🎯 模块概述

**Frys EventBus** 是Frys分布式系统的核心事件通信基础设施，提供高性能、锁-free的事件发布订阅系统，支持复杂的事件路由、过滤和异步处理。

**设计理念**: 锁-free架构，极致性能，可扩展性，事件驱动。

**关键指标**:
- **吞吐量**: 100K+ events/sec
- **延迟**: < 10μs P99
- **内存效率**: < 100MB for 1M queued events
- **并发**: 10K+ 并发订阅者
- **可靠性**: 99.99% 消息交付率

---

## 🏗️ 架构设计

### 核心组件架构

```
┌─────────────────────────────────────────────────┐
│                Frys EventBus                    │
├─────────────────────────────────────────────────┤
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │
│  │  Pub/Sub    │ │  Routing    │ │   Async     │ │
│  │   System    │ │   Engine    │ │ Processing  │ │
│  │             │ │             │ │             │ │
│  │ • Publisher │ │ • Topic     │ │ • Event     │ │
│  │   Registry  │ │   Matching  │ │   Processor │ │
│  │ • Subscriber│ │ • Filtering │ │ • Backpressure│ │
│  │   Registry  │ │ • Routing   │ │ • Circuit    │ │
│  │             │ │   Table     │ │   Breaker   │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ │
├─────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────┐ │
│  │          Lock-Free Queue System             │ │
│  │                                             │ │
│  │ • SegmentedQueue (Lock-free segments)       │ │
│  │ • PriorityQueue (QoS support)               │ │
│  │ • BackpressureQueue (Flow control)          │ │
│  │ • BatchProcessor (Efficient bulk ops)      │ │
│  └─────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────┤
│           Metrics & Monitoring System           │
│  (Built-in observability and health checks)     │
└─────────────────────────────────────────────────┘
```

### 核心特性

#### 🔒 锁-Free队列系统
- **SegmentedQueue**: 分段式无锁队列，减少竞争
- **PriorityQueue**: 优先级队列，支持QoS
- **BackpressureQueue**: 背压感知队列，防止系统过载
- **BatchProcessor**: 批处理优化，减少系统调用

#### 📡 发布订阅系统
- **Publisher Registry**: 发布者管理
- **Subscriber Registry**: 订阅者管理
- **Topic Filtering**: 通配符和精确匹配
- **Event Validation**: 事件格式验证

#### 🛣️ 路由和过滤引擎
- **Topic Pattern Matching**: 支持通配符(+、#)
- **Advanced Filtering**: 基于内容和头部的过滤
- **Routing Table**: 高效的路由查找
- **Filter Expressions**: 复杂的过滤表达式

#### ⚡ 异步处理系统
- **AsyncEventProcessor**: 异步事件处理
- **BackpressureController**: 背压控制
- **CircuitBreaker**: 熔断器模式
- **EventStream**: 响应式事件流

#### 📊 监控和指标
- **EventBusMetrics**: 实时指标收集
- **Health Checks**: 系统健康检查
- **Tracing**: 事件追踪
- **Performance Monitoring**: 性能监控

---

## 🚀 快速开始

### 1. 构建项目

```bash
cd modules/frys-eventbus
cargo build --release
```

### 2. 基本使用示例

```rust
use frys_eventbus::*;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 创建EventBus配置
    let config = EventBusConfig {
        queue_size: 1024,
        max_subscribers: 100,
        enable_filtering: true,
        enable_priority: true,
        enable_monitoring: true,
        enable_backpressure: true,
        backpressure_threshold: 80,
        ..Default::default()
    };

    // 初始化EventBus
    let mut eventbus = EventBus::new(config).await?;

    // 订阅事件
    let subscriber = eventbus.subscribe("user.*", Filter::default()).await?;

    // 创建发布者
    let publisher = eventbus.create_publisher(Some("my_publisher")).await?;

    // 发布事件
    let event = Event::new("user.created".into(), b"{\"user_id\": 123}".to_vec())
        .with_priority(Priority::High)
        .with_header("content-type".into(), "application/json".into());

    publisher.publish(event).await?;

    // 接收事件
    if let Some(received_event) = subscriber.receive().await {
        println!("Received: {}", String::from_utf8_lossy(&received_event.payload));
    }

    // 优雅关闭
    eventbus.shutdown().await?;
    Ok(())
}
```

### 3. 高级用法示例

#### 优先级队列和QoS

```rust
// 创建优先级队列
let queue = PriorityQueue::<Event>::new(3, 100, 16); // 3个优先级等级

// 添加不同优先级的事件
queue.push(Event::new("high".into(), b"high priority".to_vec()), 2)?;
queue.push(Event::new("normal".into(), b"normal priority".to_vec()), 1)?;
queue.push(Event::new("low".into(), b"low priority".to_vec()), 0)?;

// 总是先处理高优先级事件
assert_eq!(queue.pop().unwrap().topic, "high");
assert_eq!(queue.pop().unwrap().topic, "normal");
assert_eq!(queue.pop().unwrap().topic, "low");
```

#### 高级过滤

```rust
// 创建高级过滤器
let filter = AdvancedFilter::new()
    .with_header_filter("content-type".into(),
        FilterExpression::Equal("application/json".into()))
    .with_payload_filter("event_type".into(),
        FilterExpression::In(vec!["user_created".into(), "user_updated".into()]))
    .with_priority(Priority::High)
    .with_time_range(TimeRange::new(1000, 2000));

// 过滤器会自动匹配符合条件的事件
```

#### 异步处理和背压

```rust
// 创建异步事件处理器
let processor = AsyncEventProcessor::new(4, 1000); // 4个worker，1000队列容量
processor.start();

// 提交事件进行异步处理
processor.submit_event(event).await?;

// 检查背压状态
if processor.backpressure_active() {
    println!("System under backpressure, slowing down...");
}

// 停止处理器
processor.stop().await;
```

---

## 📊 性能基准

### 吞吐量测试

```bash
# 运行基准测试
cargo bench

# 预期结果：
# - 单线程: 50K+ events/sec
# - 多线程(4核心): 200K+ events/sec
# - 内存使用: < 50MB for 1M events
```

### 延迟分布

- **P50**: < 5μs
- **P95**: < 20μs
- **P99**: < 100μs

### 内存效率

- **基础占用**: < 10MB
- **每事件**: < 1KB
- **队列效率**: > 90%

---

## 🔧 配置选项

### EventBusConfig

```rust
EventBusConfig {
    // 队列大小
    queue_size: 1024,

    // 最大订阅者数
    max_subscribers: 1000,

    // 启用过滤
    enable_filtering: true,

    // 启用优先级
    enable_priority: true,

    // 启用监控
    enable_monitoring: true,

    // 启用背压
    enable_backpressure: true,

    // 背压阈值(%)
    backpressure_threshold: 80,

    // 最大主题长度
    max_topic_length: 256,

    // 最大负载大小
    max_payload_size: 64 * 1024 * 1024,

    // worker线程数
    worker_threads: 4,

    // 启用通配符
    enable_wildcards: true,

    // 启用持久化订阅
    enable_persistence: false,
}
```

### 环境变量

```bash
# 设置日志级别
export RUST_LOG=eventbus=info

# 启用性能监控
export EVENTBUS_METRICS_ENABLED=true

# 设置队列大小
export EVENTBUS_QUEUE_SIZE=2048
```

---

## 📈 监控和调试

### 指标收集

EventBus自动收集以下指标：

- **events_published**: 已发布事件总数
- **events_delivered**: 已交付事件总数
- **events_dropped**: 已丢弃事件总数
- **active_subscribers**: 活跃订阅者数
- **queue_size**: 当前队列大小
- **processing_latency**: 处理延迟
- **backpressure_events**: 背压事件数

### 健康检查

```rust
// 获取系统健康状态
let snapshot = eventbus.metrics().snapshot();

if snapshot.is_healthy() {
    println!("System is healthy");
} else {
    println!("System health issues detected");
    println!("Delivery rate: {:.2}%", snapshot.delivery_rate * 100.0);
    println!("Error rate: {:.2}%", snapshot.error_rate * 100.0);
}
```

### 调试模式

```bash
# 启用调试模式
export EVENTBUS_DEBUG=true

# 查看详细日志
export RUST_LOG=eventbus=debug
```

---

## 🧪 测试

### 运行单元测试

```bash
cargo test
```

### 运行基准测试

```bash
cargo bench
```

### 集成测试

```bash
# 运行所有测试
cargo test --all-features

# 运行发布模式测试
cargo test --release
```

---

## 📚 API 参考

### 核心类型

- **`Event`**: 事件数据结构
- **`EventBus`**: 主要事件总线接口
- **`Subscriber`**: 订阅者句柄
- **`Publisher`**: 发布者句柄
- **`Filter`**: 过滤器接口

### 队列类型

- **`SegmentedQueue<T>`**: 分段无锁队列
- **`PriorityQueue<T>`**: 优先级队列
- **`BackpressureQueue<T>`**: 背压感知队列

### 异步组件

- **`AsyncEventProcessor`**: 异步事件处理器
- **`BackpressureController`**: 背压控制器
- **`CircuitBreaker`**: 熔断器

---

## 🤝 贡献

欢迎贡献代码！请确保：

1. 所有代码通过 `cargo clippy` 检查
2. 单元测试覆盖率 > 80%
3. 性能基准测试通过
4. 遵循现有的代码风格

### 开发环境设置

```bash
# 克隆项目
git clone https://github.com/frys/frys-eventbus.git
cd frys-eventbus

# 安装依赖
cargo build

# 运行测试
cargo test

# 运行基准测试
cargo bench
```

---

## 📄 许可证

本项目采用 MIT 许可证。详见 [LICENSE](LICENSE) 文件。

---

## 📞 支持

如有问题或建议，请：

1. 查看 [文档](docs/)
2. 提交 [Issue](https://github.com/frys/frys-eventbus/issues)
3. 加入我们的 [讨论组](https://github.com/frys/frys-eventbus/discussions)

---

**Frys EventBus** - 为现代分布式系统构建的高性能事件基础设施。