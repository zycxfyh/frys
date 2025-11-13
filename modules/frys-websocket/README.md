# Frys WebSocket - WebSocket服务发展指南

## 🎯 模块概述

**Frys WebSocket** 借鉴VCP的实时通信架构，实现自主的高性能WebSocket服务：
- 实时双向通信
- 连接池管理
- 消息广播和路由
- 心跳检测和重连

**设计理念**: 实时高效，可扩展性强，连接稳定，消息可靠。

**关键指标**:
- 连接数: 100K+ 并发连接
- 消息延迟: < 5ms
- 消息吞吐量: 1M+ msg/s
- 连接稳定性: > 99.9%

---

## 🏗️ 架构设计

### WebSocket服务架构

```
┌─────────────────────────────────────────────────┐
│          Frys WebSocket Service                 │
├─────────────────────────────────────────────────┤
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │
│  │ Connection  │ │   Message   │ │   Router    │ │
│  │  Manager    │ │   Broker    │ │             │ │
│  │             │ │             │ │ • 主题订阅  │ │
│  │ • 连接池    │ │ • 发布订阅  │ │ • 消息路由  │ │
│  │ • 心跳检测  │ │ • 消息队列  │ │ • 权限控制  │ │
│  │ • 自动重连  │ │ • 持久化    │ │ • 过滤器    │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ │
├─────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────┐ │
│  │      Real-time Features                     │
│  │                                             │
│  │ • 实时消息推送                              │ │
│  │ • 在线状态同步                              │
│  │ • 协作会话管理                              │
│  │ • 事件流处理                                │ │
│  └─────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────┐ │
│  │      Scalability & Performance              │ │
│  │                                             │
│  │ • 水平扩展支持                              │ │
│  │ • 消息分片                                  │ │
│  │ • 连接迁移                                  │ │
│  │ • 负载均衡                                  │ │
│  └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### 连接管理器

#### 连接池实现
```rust
pub struct ConnectionManager {
    connections: Arc<RwLock<HashMap<ConnectionId, Connection>>>,
    pools: Arc<RwLock<HashMap<PoolId, ConnectionPool>>>,
    heartbeat_monitor: Arc<HeartbeatMonitor>,
    metrics: Arc<ConnectionMetrics>,
    config: ConnectionConfig,
}

#[derive(Clone)]
pub struct Connection {
    pub id: ConnectionId,
    pub pool_id: PoolId,
    pub client_info: ClientInfo,
    pub state: ConnectionState,
    pub created_at: DateTime<Utc>,
    pub last_activity: AtomicCell<DateTime<Utc>>,
    pub subscriptions: HashSet<Topic>,
    pub sender: mpsc::UnboundedSender<Message>,
}

#[derive(Clone)]
pub enum ConnectionState {
    Connecting,
    Connected,
    Authenticating,
    Authenticated,
    Disconnecting,
    Disconnected,
}

impl ConnectionManager {
    pub async fn add_connection(&self, connection: Connection) -> Result<(), ConnectionError> {
        let connection_id = connection.id.clone();

        // 添加到连接映射
        {
            let mut connections = self.connections.write().await;
            connections.insert(connection_id.clone(), connection.clone());
        }

        // 添加到连接池
        {
            let mut pools = self.pools.write().await;
            if let Some(pool) = pools.get_mut(&connection.pool_id) {
                pool.add_connection(connection_id.clone());
            } else {
                let mut pool = ConnectionPool::new(connection.pool_id.clone());
                pool.add_connection(connection_id.clone());
                pools.insert(connection.pool_id.clone(), pool);
            }
        }

        // 启动心跳监控
        self.heartbeat_monitor.add_connection(connection_id.clone()).await?;

        self.metrics.record_connection_added();

        Ok(())
    }

    pub async fn remove_connection(&self, connection_id: &ConnectionId) -> Result<(), ConnectionError> {
        // 从连接映射移除
        let connection = {
            let mut connections = self.connections.write().await;
            connections.remove(connection_id)
        };

        if let Some(connection) = connection {
            // 从连接池移除
            {
                let mut pools = self.pools.write().await;
                if let Some(pool) = pools.get_mut(&connection.pool_id) {
                    pool.remove_connection(connection_id);
                }
            }

            // 停止心跳监控
            self.heartbeat_monitor.remove_connection(connection_id).await?;

            // 清理订阅
            self.unsubscribe_all(connection_id).await?;
        }

        self.metrics.record_connection_removed();

        Ok(())
    }

    pub async fn get_connection(&self, connection_id: &ConnectionId) -> Result<Connection, ConnectionError> {
        let connections = self.connections.read().await;
        connections.get(connection_id)
            .cloned()
            .ok_or(ConnectionError::ConnectionNotFound)
    }

    pub async fn broadcast_to_pool(&self, pool_id: &PoolId, message: Message) -> Result<(), ConnectionError> {
        let pools = self.pools.read().await;
        let connections = self.connections.read().await;

        if let Some(pool) = pools.get(pool_id) {
            for connection_id in &pool.connections {
                if let Some(connection) = connections.get(connection_id) {
                    if matches!(connection.state, ConnectionState::Authenticated) {
                        let _ = connection.sender.send(message.clone());
                    }
                }
            }
        }

        Ok(())
    }

    pub async fn get_pool_stats(&self) -> HashMap<PoolId, PoolStats> {
        let pools = self.pools.read().await;
        let mut stats = HashMap::new();

        for (pool_id, pool) in pools.iter() {
            stats.insert(pool_id.clone(), PoolStats {
                connection_count: pool.connections.len(),
                active_connections: pool.connections.iter()
                    .filter_map(|id| self.connections.read().await.get(id))
                    .filter(|conn| matches!(conn.state, ConnectionState::Authenticated))
                    .count(),
            });
        }

        stats
    }
}
```

### 消息代理

#### 发布订阅模式
```rust
pub struct MessageBroker {
    subscribers: Arc<RwLock<HashMap<Topic, Vec<Subscription>>>>,
    message_queue: Arc<SegmentedQueue<QueuedMessage>>,
    persistence: Option<Arc<dyn MessagePersistence>>,
    metrics: Arc<BrokerMetrics>,
}

#[derive(Clone)]
pub struct Subscription {
    pub subscriber_id: SubscriberId,
    pub connection_id: ConnectionId,
    pub filter: Option<MessageFilter>,
    pub qos: QoS,
    pub created_at: DateTime<Utc>,
}

#[derive(Clone)]
pub struct QueuedMessage {
    pub id: MessageId,
    pub topic: Topic,
    pub payload: MessagePayload,
    pub qos: QoS,
    pub retained: bool,
    pub timestamp: DateTime<Utc>,
    pub publisher: Option<ConnectionId>,
}

impl MessageBroker {
    pub async fn publish(&self, message: QueuedMessage) -> Result<(), BrokerError> {
        // 保留消息处理
        if message.retained {
            self.handle_retained_message(&message).await?;
        }

        // 查找订阅者
        let subscribers = self.find_subscribers(&message.topic).await?;

        // 投递消息
        for subscription in subscribers {
            self.deliver_message(&subscription, &message).await?;
        }

        // 持久化
        if let Some(persistence) = &self.persistence {
            if matches!(message.qos, QoS::AtLeastOnce | QoS::ExactlyOnce) {
                persistence.save_message(&message).await?;
            }
        }

        self.metrics.record_message_published();

        Ok(())
    }

    pub async fn subscribe(&self, subscription: Subscription) -> Result<(), BrokerError> {
        let mut subscribers = self.subscribers.write().await;

        subscribers.entry(subscription.connection_id.clone())
            .or_insert_with(Vec::new)
            .push(subscription.clone());

        // 发送保留消息
        self.send_retained_messages(&subscription).await?;

        self.metrics.record_subscription_added();

        Ok(())
    }

    pub async fn unsubscribe(&self, connection_id: &ConnectionId, topic: &Topic) -> Result<(), BrokerError> {
        let mut subscribers = self.subscribers.write().await;

        if let Some(connection_subscriptions) = subscribers.get_mut(connection_id) {
            connection_subscriptions.retain(|sub| &sub.topic != topic);
        }

        self.metrics.record_subscription_removed();

        Ok(())
    }

    async fn find_subscribers(&self, topic: &Topic) -> Result<Vec<Subscription>, BrokerError> {
        let subscribers = self.subscribers.read().await;
        let mut matching_subscriptions = Vec::new();

        for connection_subscriptions in subscribers.values() {
            for subscription in connection_subscriptions {
                if self.topic_matches(&subscription.topic, topic) {
                    if let Some(filter) = &subscription.filter {
                        if filter.matches(&topic) {
                            matching_subscriptions.push(subscription.clone());
                        }
                    } else {
                        matching_subscriptions.push(subscription.clone());
                    }
                }
            }
        }

        Ok(matching_subscriptions)
    }

    async fn deliver_message(&self, subscription: &Subscription, message: &QueuedMessage) -> Result<(), BrokerError> {
        let connections = self.connection_manager.get_connection(&subscription.connection_id).await?;

        // 构造WebSocket消息
        let ws_message = WebSocketMessage {
            message_type: MessageType::Publish,
            topic: message.topic.clone(),
            payload: message.payload.clone(),
            qos: message.qos,
            message_id: Some(message.id),
        };

        // 发送消息
        let _ = connections.sender.send(Message::WebSocket(ws_message));

        self.metrics.record_message_delivered();

        Ok(())
    }

    fn topic_matches(&self, subscription_topic: &Topic, message_topic: &Topic) -> bool {
        // 简单的通配符匹配
        if subscription_topic == message_topic {
            return true;
        }

        // 支持+和#通配符
        let sub_parts: Vec<&str> = subscription_topic.split('/').collect();
        let msg_parts: Vec<&str> = message_topic.split('/').collect();

        if sub_parts.len() != msg_parts.len() && !subscription_topic.contains('#') {
            return false;
        }

        for (sub_part, msg_part) in sub_parts.iter().zip(msg_parts.iter()) {
            match *sub_part {
                "+" => continue,
                "#" => return true,
                _ if sub_part == msg_part => continue,
                _ => return false,
            }
        }

        true
    }
}
```

### 心跳检测和重连

#### 心跳监控器
```rust
pub struct HeartbeatMonitor {
    connections: Arc<RwLock<HashMap<ConnectionId, HeartbeatState>>>,
    config: HeartbeatConfig,
    metrics: Arc<HeartbeatMetrics>,
}

#[derive(Clone)]
pub struct HeartbeatState {
    pub last_heartbeat: DateTime<Utc>,
    pub missed_heartbeats: u32,
    pub reconnect_attempts: u32,
    pub state: HeartbeatStatus,
}

#[derive(Clone)]
pub enum HeartbeatStatus {
    Active,
    Warning,
    Critical,
    Disconnected,
}

impl HeartbeatMonitor {
    pub async fn start_monitoring(&self) {
        let config = self.config.clone();
        let connections = self.connections.clone();
        let metrics = self.metrics.clone();

        tokio::spawn(async move {
            let mut interval = tokio::time::interval(config.check_interval);

            loop {
                interval.tick().await;

                let mut to_disconnect = Vec::new();
                let mut to_warn = Vec::new();

                {
                    let mut connections_lock = connections.write().await;
                    let now = Utc::now();

                    for (connection_id, state) in connections_lock.iter_mut() {
                        let time_since_last = now.signed_duration_since(state.last_heartbeat);

                        if time_since_last > config.disconnect_timeout {
                            state.state = HeartbeatStatus::Disconnected;
                            to_disconnect.push(connection_id.clone());
                        } else if time_since_last > config.warning_timeout {
                            if matches!(state.state, HeartbeatStatus::Active) {
                                state.state = HeartbeatStatus::Warning;
                                to_warn.push(connection_id.clone());
                            }
                        } else {
                            state.state = HeartbeatStatus::Active;
                        }
                    }
                }

                // 处理警告连接
                for connection_id in to_warn {
                    metrics.record_heartbeat_warning();
                    // 发送警告消息
                    self.send_heartbeat_warning(&connection_id).await;
                }

                // 处理断开连接
                for connection_id in to_disconnect {
                    metrics.record_connection_lost();
                    // 触发断开处理
                    self.handle_connection_lost(&connection_id).await;
                }
            }
        });
    }

    pub async fn record_heartbeat(&self, connection_id: &ConnectionId) {
        let mut connections = self.connections.write().await;

        if let Some(state) = connections.get_mut(connection_id) {
            state.last_heartbeat = Utc::now();
            state.missed_heartbeats = 0;
            state.state = HeartbeatStatus::Active;

            self.metrics.record_heartbeat_received();
        }
    }

    pub async fn handle_reconnect(&self, connection_id: &ConnectionId) -> Result<(), HeartbeatError> {
        let mut connections = self.connections.write().await;

        if let Some(state) = connections.get_mut(connection_id) {
            state.reconnect_attempts += 1;
            state.last_heartbeat = Utc::now();
            state.missed_heartbeats = 0;
            state.state = HeartbeatStatus::Active;

            if state.reconnect_attempts > self.config.max_reconnect_attempts {
                return Err(HeartbeatError::MaxReconnectAttemptsExceeded);
            }

            self.metrics.record_reconnect_success();
        }

        Ok(())
    }
}
```

---

## 🛠️ 技术栈选择

### 核心依赖
```toml
[package]
name = "frys-websocket"
version = "0.1.0"
edition = "2021"

[dependencies]
tokio = { version = "1.28", features = ["full"] }
tokio-tungstenite = "0.18"        # WebSocket库
futures = "0.3"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
uuid = { version = "1.0", features = ["v4"] }
dashmap = "5.5"                   # 并发HashMap
```

### 特性开关
```toml
[features]
default = ["heartbeat", "persistence"]
heartbeat = []                    # 心跳检测
persistence = ["sled"]            # 消息持久化
compression = ["flate2"]          # 消息压缩
metrics = ["prometheus"]          # 性能监控
authentication = ["jsonwebtoken"] # 连接认证
```

---

## 📋 接口规范

### WebSocket服务接口
```rust
#[async_trait]
pub trait WebSocketService: Send + Sync {
    /// 启动WebSocket服务
    async fn start(&self, config: WebSocketConfig) -> Result<(), WebSocketError>;

    /// 停止WebSocket服务
    async fn stop(&self) -> Result<(), WebSocketError>;

    /// 广播消息到指定主题
    async fn broadcast(&self, topic: &Topic, message: MessagePayload) -> Result<(), WebSocketError>;

    /// 发送消息到特定连接
    async fn send_to_connection(&self, connection_id: &ConnectionId, message: MessagePayload) -> Result<(), WebSocketError>;

    /// 获取服务统计
    async fn stats(&self) -> Result<WebSocketStats, WebSocketError>;
}
```

### 连接管理接口
```rust
#[async_trait]
pub trait ConnectionManager: Send + Sync {
    /// 添加连接
    async fn add_connection(&self, connection: Connection) -> Result<(), ConnectionError>;

    /// 移除连接
    async fn remove_connection(&self, connection_id: &ConnectionId) -> Result<(), ConnectionError>;

    /// 获取连接
    async fn get_connection(&self, connection_id: &ConnectionId) -> Result<Connection, ConnectionError>;

    /// 按池广播消息
    async fn broadcast_to_pool(&self, pool_id: &PoolId, message: MessagePayload) -> Result<(), ConnectionError>;

    /// 获取池统计
    async fn get_pool_stats(&self) -> Result<HashMap<PoolId, PoolStats>, ConnectionError>;
}
```

### 消息代理接口
```rust
#[async_trait]
pub trait MessageBroker: Send + Sync {
    /// 发布消息
    async fn publish(&self, message: QueuedMessage) -> Result<(), BrokerError>;

    /// 订阅主题
    async fn subscribe(&self, subscription: Subscription) -> Result<(), BrokerError>;

    /// 取消订阅
    async fn unsubscribe(&self, connection_id: &ConnectionId, topic: &Topic) -> Result<(), BrokerError>;

    /// 获取订阅统计
    async fn subscription_stats(&self) -> Result<HashMap<Topic, usize>, BrokerError>;
}
```

---

## 📅 开发计划

### Phase 1: 核心连接管理 (3周)

#### Week 1: WebSocket基础
```
目标: 实现WebSocket连接基础
任务:
- [ ] tokio-tungstenite集成
- [ ] 基础连接处理
- [ ] 消息编解码
- [ ] 错误处理
验证标准:
- [ ] 连接建立成功率 > 99%
- [ ] 消息传输延迟 < 10ms
- [ ] 内存泄漏为0
```

#### Week 2: 连接池管理
```
目标: 实现连接池和状态管理
任务:
- [ ] ConnectionManager实现
- [ ] 连接状态跟踪
- [ ] 连接池分组
- [ ] 并发安全性
验证标准:
- [ ] 连接管理延迟 < 1ms
- [ ] 支持10K并发连接
- [ ] 状态同步准确
```

#### Week 3: 心跳和重连
```
目标: 实现连接保活机制
任务:
- [ ] HeartbeatMonitor实现
- [ ] 自动重连逻辑
- [ ] 连接健康检测
- [ ] 故障转移
验证标准:
- [ ] 心跳检测准确率 > 99%
- [ ] 重连成功率 > 95%
- [ ] 故障检测延迟 < 5s
```

### Phase 2: 消息处理和路由 (3周)

#### Week 4: 消息代理
```
目标: 实现发布订阅消息代理
任务:
- [ ] MessageBroker实现
- [ ] 主题订阅管理
- [ ] 消息路由逻辑
- [ ] QoS支持
验证标准:
- [ ] 消息投递延迟 < 5ms
- [ ] 订阅管理延迟 < 1ms
- [ ] 消息丢失率 < 0.01%
```

#### Week 5: 高级路由特性
```
目标: 实现消息过滤和权限
任务:
- [ ] 消息过滤器
- [ ] 权限控制
- [ ] 消息持久化
- [ ] 离线消息
验证标准:
- [ ] 过滤效率 > 95%
- [ ] 权限检查延迟 < 0.1ms
- [ ] 持久化性能 > 10K msg/s
```

#### Week 6: 实时特性和扩展
```
目标: 实现实时特性和扩展性
任务:
- [ ] 实时事件流
- [ ] 连接迁移
- [ ] 水平扩展支持
- [ ] 性能监控
验证标准:
- [ ] 实时性延迟 < 1ms
- [ ] 扩展性 > 100K连接
- [ ] 监控覆盖率 > 95%
```

---

## 🧪 测试策略

### 1. 连接测试
```rust
#[tokio::test]
async fn test_websocket_connection() {
    let service = WebSocketService::new(Default::default()).await.unwrap();

    // 启动服务
    service.start(WebSocketConfig {
        host: "127.0.0.1".to_string(),
        port: 8080,
        max_connections: 1000,
    }).await.unwrap();

    // 创建客户端连接
    let (client, _) = tokio_tungstenite::connect_async("ws://127.0.0.1:8080").await.unwrap();

    // 发送测试消息
    let message = tungstenite::Message::Text(r#"{"type": "ping"}"#.to_string());
    client.send(message).await.unwrap();

    // 验证连接状态
    assert!(service.get_connection_count().await.unwrap() > 0);

    service.stop().await.unwrap();
}
```

### 2. 消息分发测试
```rust
#[tokio::test]
async fn test_message_broadcast() {
    let broker = MessageBroker::new().await.unwrap();

    // 创建订阅者
    let subscriber1 = TestSubscriber::new();
    let subscriber2 = TestSubscriber::new();

    broker.subscribe(Subscription {
        subscriber_id: SubscriberId::new(),
        connection_id: ConnectionId::new(),
        topic: Topic::from("test.topic"),
        filter: None,
        qos: QoS::AtMostOnce,
        created_at: Utc::now(),
    }).await.unwrap();

    broker.subscribe(Subscription {
        subscriber_id: SubscriberId::new(),
        connection_id: ConnectionId::new(),
        topic: Topic::from("test.topic"),
        filter: None,
        qos: QoS::AtMostOnce,
        created_at: Utc::now(),
    }).await.unwrap();

    // 发布消息
    let message = QueuedMessage {
        id: MessageId::new(),
        topic: Topic::from("test.topic"),
        payload: MessagePayload::Text("test message".to_string()),
        qos: QoS::AtMostOnce,
        retained: false,
        timestamp: Utc::now(),
        publisher: None,
    };

    broker.publish(message).await.unwrap();

    // 验证消息接收
    tokio::time::sleep(Duration::from_millis(100)).await;
    assert_eq!(subscriber1.message_count(), 1);
    assert_eq!(subscriber2.message_count(), 1);
}
```

### 3. 压力测试
```rust
#[tokio::test]
async fn test_concurrent_connections() {
    let service = WebSocketService::new(WebSocketConfig {
        max_connections: 10000,
        ..Default::default()
    }).await.unwrap();

    service.start(WebSocketConfig {
        host: "127.0.0.1".to_string(),
        port: 8081,
        max_connections: 10000,
    }).await.unwrap();

    // 并发创建1000个连接
    let mut handles = Vec::new();
    for i in 0..1000 {
        let handle = tokio::spawn(async move {
            let url = format!("ws://127.0.0.1:8081/client/{}", i);
            let (client, _) = tokio_tungstenite::connect_async(&url).await.unwrap();
            let _ = client.send(tungstenite::Message::Text("hello".to_string())).await;
        });
        handles.push(handle);
    }

    // 等待所有连接建立
    for handle in handles {
        handle.await.unwrap();
    }

    // 验证连接数量
    let stats = service.stats().await.unwrap();
    assert!(stats.active_connections >= 1000);

    service.stop().await.unwrap();
}
```

---

## 🚀 部署方案

### 1. 单机部署
```toml
[websocket]
# 服务配置
host = "0.0.0.0"
port = 8080
max_connections = 10000
workers = 4

# 心跳配置
heartbeat_interval = "30s"
heartbeat_timeout = "90s"
max_reconnect_attempts = 5

# 消息配置
max_message_size = "1MB"
message_queue_size = 10000
persistence_enabled = true

# 安全配置
authentication_required = true
allowed_origins = ["https://frys.io"]
```

### 2. 分布式部署
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frys-websocket
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: websocket
        image: frys-websocket:latest
        ports:
        - containerPort: 8080
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        env:
        - name: REDIS_URL
          value: "redis://redis-cluster:6379"
        volumeMounts:
        - name: message-storage
          mountPath: /var/lib/frys/messages
      volumes:
      - name: message-storage
        persistentVolumeClaim:
          claimName: websocket-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: frys-websocket
spec:
  type: ClusterIP
  ports:
  - port: 8080
    targetPort: 8080
  selector:
    app: frys-websocket
```

### 3. 负载均衡配置
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: frys-websocket-ingress
  annotations:
    nginx.ingress.kubernetes.io/proxy-read-timeout: "86400"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "86400"
spec:
  rules:
  - host: ws.frys.io
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frys-websocket
            port:
              number: 8080
```

---

## 📊 性能优化

### 1. 连接优化
- **连接池**: 复用连接资源
- **零拷贝**: 消息数据零拷贝传递
- **批处理**: 批量消息处理

### 2. 消息优化
- **二进制协议**: 高效的二进制消息格式
- **压缩传输**: 消息payload压缩
- **内存映射**: 大消息内存映射

### 3. 扩展优化
- **分片**: 连接和消息的分片处理
- **异步处理**: 完全异步的消息处理
- **缓存优化**: 热点数据的缓存优化

---

## 🔒 安全设计

### 1. 连接安全
- **WSS加密**: WebSocket Secure强制加密
- **证书验证**: 客户端证书验证
- **SNI支持**: Server Name Indication

### 2. 消息安全
- **消息签名**: 防止消息篡改
- **权限验证**: 消息发布和订阅权限
- **内容过滤**: 恶意内容过滤

### 3. 资源保护
- **连接限制**: 防止连接耗尽攻击
- **消息大小限制**: 防止大消息攻击
- **速率限制**: 防止消息洪水攻击

---

## 📚 文档和维护

### 1. 客户端集成指南
```javascript
// JavaScript客户端示例
class FrysWebSocketClient {
    constructor(url, options = {}) {
        this.url = url;
        this.options = {
            reconnectInterval: 5000,
            maxReconnectAttempts: 5,
            heartbeatInterval: 30000,
            ...options
        };
        this.ws = null;
        this.subscriptions = new Map();
        this.connect();
    }

    connect() {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
            console.log('Connected to Frys WebSocket');
            this.startHeartbeat();
            this.resubscribe();
        };

        this.ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
        };

        this.ws.onclose = () => {
            console.log('Disconnected from Frys WebSocket');
            this.scheduleReconnect();
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    }

    subscribe(topic, callback) {
        this.subscriptions.set(topic, callback);

        if (this.ws.readyState === WebSocket.OPEN) {
            this.send({
                type: 'subscribe',
                topic: topic
            });
        }
    }

    publish(topic, payload) {
        this.send({
            type: 'publish',
            topic: topic,
            payload: payload
        });
    }

    send(message) {
        if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }

    startHeartbeat() {
        this.heartbeatTimer = setInterval(() => {
            this.send({ type: 'ping' });
        }, this.options.heartbeatInterval);
    }

    scheduleReconnect() {
        if (this.reconnectAttempts < this.options.maxReconnectAttempts) {
            setTimeout(() => {
                this.reconnectAttempts++;
                console.log(`Reconnecting... (${this.reconnectAttempts}/${this.options.maxReconnectAttempts})`);
                this.connect();
            }, this.options.reconnectInterval);
        }
    }
}
```

### 2. 协议规范
- **连接握手**: WebSocket连接建立协议
- **消息格式**: 标准化的消息格式
- **错误处理**: 错误码和处理方式

### 3. 运维指南
- **连接监控**: 实时连接状态监控
- **性能调优**: 连接池和消息队列调优
- **故障排查**: 常见连接和消息问题诊断

---

## 🎯 验收标准

### 功能验收
- [ ] WebSocket连接延迟 < 5ms
- [ ] 消息广播延迟 < 1ms
- [ ] 心跳检测准确率 > 99%
- [ ] 自动重连成功率 > 95%

### 性能验收
- [ ] 并发连接数 > 100K
- [ ] 消息吞吐量 > 1M msg/s
- [ ] 内存使用 < 2GB
- [ ] CPU使用率 < 60%

### 质量验收
- [ ] 单元测试覆盖率 > 95%
- [ ] 连接稳定性 > 99.9%
- [ ] 消息可靠性 > 99.99%
- [ ] 安全漏洞为0

---

这份指南为Frys WebSocket的开发提供了系统化的实施路径，建立了高性能、可靠、可扩展的实时通信系统。
