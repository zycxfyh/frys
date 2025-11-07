# frys 系统架构图

## 概述

本文档提供了frys系统的完整架构视图，包括系统组件、数据流、部署架构和扩展策略。

## 系统总体架构

```mermaid
graph TB
    subgraph "客户端层 (Presentation Layer)"
        WEB[Web 应用]
        MOBILE[移动应用]
        API[第三方系统]
        CLI[命令行工具]
    end

    subgraph "API网关层 (API Gateway)"
        GATEWAY[frys API Gateway]
        AUTH[认证服务]
        RATE[速率限制]
        CACHE[缓存层]
    end

    subgraph "应用层 (Application Layer)"
        CONTROLLERS[控制器层]
        SERVICES[业务服务层]
        USECASES[用例层]
    end

    subgraph "领域层 (Domain Layer)"
        ENTITIES[领域实体]
        VALUEOBJ[值对象]
        DOMAINSVC[领域服务]
        REPO[仓库接口]
    end

    subgraph "基础设施层 (Infrastructure Layer)"
        DB[(数据库)]
        CACHE[(缓存存储)]
        MQ[(消息队列)]
        EXTERNAL[外部服务]
    end

    WEB --> GATEWAY
    MOBILE --> GATEWAY
    API --> GATEWAY
    CLI --> GATEWAY

    GATEWAY --> AUTH
    GATEWAY --> RATE
    GATEWAY --> CACHE

    GATEWAY --> CONTROLLERS
    CONTROLLERS --> SERVICES
    SERVICES --> USECASES

    USECASES --> DOMAINSVC
    USECASES --> REPO

    DOMAINSVC --> ENTITIES
    DOMAINSVC --> VALUEOBJ

    REPO --> DB
    REPO --> CACHE
    REPO --> MQ

    SERVICES --> EXTERNAL
```

## 六边形架构 (Hexagonal Architecture)

```mermaid
graph TB
    subgraph "核心业务逻辑 (Core Business Logic)"
        DOMAIN[领域层<br/>Entities & Value Objects<br/>Domain Services<br/>Business Rules]
    end

    subgraph "应用服务 (Application Services)"
        APP[应用层<br/>Use Cases<br/>Application Services<br/>DTOs]
    end

    subgraph "适配器 (Adapters)"
        subgraph "驱动适配器 (Driving Adapters)"
            CONTROLLER[控制器<br/>REST API<br/>GraphQL API]
            CLI_ADAPTER[CLI适配器<br/>命令行接口]
            WS_ADAPTER[WebSocket适配器<br/>实时通信]
        end

        subgraph "被驱动适配器 (Driven Adapters)"
            REPO_IMPL[仓库实现<br/>Database Repositories<br/>Cache Repositories]
            MSG_IMPL[消息实现<br/>RabbitMQ<br/>Redis Pub/Sub]
            EXT_IMPL[外部服务<br/>第三方API<br/>文件存储]
        end
    end

    CONTROLLER --> APP
    CLI_ADAPTER --> APP
    WS_ADAPTER --> APP

    APP --> DOMAIN

    DOMAIN --> REPO_IMPL
    DOMAIN --> MSG_IMPL
    DOMAIN --> EXT_IMPL
```

## 微服务架构视图

```mermaid
graph TB
    subgraph "frys 微服务集群"
        API_GATEWAY[API Gateway<br/>路由 & 认证]

        USER_SVC[用户服务<br/>User Service<br/>Port: 3001]
        WORKFLOW_SVC[工作流服务<br/>Workflow Service<br/>Port: 3002]
        NOTIFICATION_SVC[通知服务<br/>Notification Service<br/>Port: 3003]

        AUTH_SVC[认证服务<br/>Auth Service<br/>Port: 3004]
        CACHE_SVC[缓存服务<br/>Cache Service<br/>Port: 3005]
        MONITORING_SVC[监控服务<br/>Monitoring Service<br/>Port: 3006]
    end

    subgraph "基础设施服务"
        POSTGRES[(PostgreSQL<br/>主数据库)]
        REDIS[(Redis<br/>缓存 & 会话)]
        RABBITMQ[(RabbitMQ<br/>消息队列)]
        ELASTIC[(Elasticsearch<br/>日志搜索)]
        PROMETHEUS[(Prometheus<br/>监控指标)]
        GRAFANA[(Grafana<br/>可视化监控)]
    end

    subgraph "外部服务"
        EMAIL[邮件服务<br/>SendGrid/Mailgun]
        SMS[SMS服务<br/>Twilio]
        STORAGE[文件存储<br/>AWS S3/GCS]
        CDN[CDN<br/>CloudFlare]
    end

    CLIENT[客户端] --> API_GATEWAY

    API_GATEWAY --> USER_SVC
    API_GATEWAY --> WORKFLOW_SVC
    API_GATEWAY --> NOTIFICATION_SVC

    USER_SVC --> AUTH_SVC
    WORKFLOW_SVC --> AUTH_SVC
    NOTIFICATION_SVC --> AUTH_SVC

    USER_SVC --> CACHE_SVC
    WORKFLOW_SVC --> CACHE_SVC
    NOTIFICATION_SVC --> CACHE_SVC

    USER_SVC --> POSTGRES
    WORKFLOW_SVC --> POSTGRES
    NOTIFICATION_SVC --> POSTGRES

    USER_SVC --> REDIS
    WORKFLOW_SVC --> REDIS
    NOTIFICATION_SVC --> REDIS

    USER_SVC --> RABBITMQ
    WORKFLOW_SVC --> RABBITMQ
    NOTIFICATION_SVC --> RABBITMQ

    MONITORING_SVC --> PROMETHEUS
    MONITORING_SVC --> GRAFANA

    USER_SVC --> EMAIL
    NOTIFICATION_SVC --> EMAIL

    NOTIFICATION_SVC --> SMS

    USER_SVC --> STORAGE
    WORKFLOW_SVC --> STORAGE

    STORAGE --> CDN
```

## 数据流架构

```mermaid
sequenceDiagram
    participant Client
    participant Gateway
    participant Controller
    participant UseCase
    participant Service
    participant Repository
    participant Database
    participant Cache
    participant MessageQueue

    Client->>Gateway: HTTP Request
    Gateway->>Gateway: 认证 & 授权
    Gateway->>Controller: 路由请求

    Controller->>UseCase: 执行用例
    UseCase->>Service: 调用业务服务

    Service->>Repository: 数据查询
    Repository->>Cache: 检查缓存
    Cache-->>Repository: 缓存命中
    Repository-->>Service: 返回数据

    Service-->>UseCase: 执行业务逻辑
    UseCase-->>Controller: 返回结果
    Controller-->>Gateway: HTTP Response
    Gateway-->>Client: JSON Response

    Note over Service,Repository: 缓存未命中时
    Repository->>Database: 查询数据库
    Database-->>Repository: 返回数据
    Repository->>Cache: 更新缓存
    Repository-->>Service: 返回数据

    Note over Service,MessageQueue: 异步操作
    Service->>MessageQueue: 发送消息
    MessageQueue-->>Service: 确认接收
```

## 部署架构

### 单机部署架构

```mermaid
graph TB
    subgraph "单机部署"
        APP[frys 应用<br/>Node.js + Express]
        DB[(PostgreSQL)]
        CACHE[(Redis)]
        MQ[(RabbitMQ)]
        MONITORING[监控栈<br/>Prometheus + Grafana]
    end

    subgraph "外部服务"
        EMAIL[邮件服务]
        STORAGE[对象存储]
        CDN[CDN]
    end

    APP --> DB
    APP --> CACHE
    APP --> MQ
    APP --> MONITORING

    APP --> EMAIL
    APP --> STORAGE
    STORAGE --> CDN
```

### 容器化部署架构

```mermaid
graph TB
    subgraph "Docker Compose 部署"
        WEB[Web 容器<br/>Nginx + Static]
        API[API 容器<br/>Node.js]
        DB[DB 容器<br/>PostgreSQL]
        CACHE[Cache 容器<br/>Redis]
        MQ[MQ 容器<br/>RabbitMQ]
        MONITORING[监控容器<br/>Prometheus + Grafana]
    end

    subgraph "外部服务"
        REGISTRY[Docker Registry]
        LOGGING[日志聚合]
        BACKUP[备份存储]
    end

    WEB --> API
    API --> DB
    API --> CACHE
    API --> MQ

    API --> MONITORING
    DB --> MONITORING
    CACHE --> MONITORING

    WEB --> REGISTRY
    API --> REGISTRY
    DB --> REGISTRY

    API --> LOGGING
    DB --> BACKUP
```

### Kubernetes 部署架构

```mermaid
graph TB
    subgraph "Kubernetes 集群"
        INGRESS[Ingress Controller<br/>Traefik/Nginx]

        subgraph "应用层"
            WEB_DEPLOY[Web Deployment<br/>3副本]
            API_DEPLOY[API Deployment<br/>5副本]
        end

        subgraph "数据层"
            DB_STATEFUL[PostgreSQL StatefulSet<br/>1副本 + PVC]
            CACHE_STATEFUL[Redis StatefulSet<br/>3副本]
            MQ_STATEFUL[RabbitMQ StatefulSet<br/>3副本]
        end

        subgraph "监控层"
            PROMETHEUS[Prometheus Deployment]
            GRAFANA[Grafana Deployment]
            ALERTMANAGER[AlertManager Deployment]
        end

        subgraph "日志层"
            ELASTICSEARCH[Elasticsearch StatefulSet]
            KIBANA[Kibana Deployment]
            FLUENTD[Fluentd DaemonSet]
        end
    end

    subgraph "外部服务"
        OBJECT_STORAGE[对象存储<br/>S3/MinIO]
        EMAIL_SERVICE[邮件服务]
        EXTERNAL_DB[外部数据库]
    end

    CLIENT[客户端] --> INGRESS

    INGRESS --> WEB_DEPLOY
    INGRESS --> API_DEPLOY

    API_DEPLOY --> DB_STATEFUL
    API_DEPLOY --> CACHE_STATEFUL
    API_DEPLOY --> MQ_STATEFUL

    WEB_DEPLOY --> OBJECT_STORAGE
    API_DEPLOY --> OBJECT_STORAGE

    API_DEPLOY --> EMAIL_SERVICE

    PROMETHEUS --> API_DEPLOY
    PROMETHEUS --> DB_STATEFUL
    PROMETHEUS --> CACHE_STATEFUL

    FLUENTD --> API_DEPLOY
    FLUENTD --> DB_STATEFUL
    FLUENTD --> ELASTICSEARCH
```

## 组件详细架构

### 缓存系统架构

```mermaid
graph TB
    subgraph "缓存管理器 (CacheManager)"
        L1[内存缓存层 L1<br/>最快访问]
        L2[Redis缓存层 L2<br/>分布式缓存]
    end

    subgraph "缓存策略"
        DB_STRATEGY[数据库策略<br/>TTL: 10分钟]
        API_STRATEGY[API策略<br/>TTL: 5分钟]
        SESSION_STRATEGY[会话策略<br/>TTL: 30分钟]
        PAGE_STRATEGY[页面策略<br/>TTL: 15分钟]
        COMPUTATION_STRATEGY[计算策略<br/>TTL: 动态]
    end

    subgraph "缓存服务"
        CACHE_SERVICE[CacheService<br/>统一接口]
        CACHE_MIDDLEWARE[CacheMiddleware<br/>HTTP缓存]
        CACHE_DECORATORS[缓存装饰器<br/>方法级缓存]
    end

    APP[应用层] --> CACHE_SERVICE
    CACHE_SERVICE --> L1
    CACHE_SERVICE --> L2

    CACHE_SERVICE --> DB_STRATEGY
    CACHE_SERVICE --> API_STRATEGY
    CACHE_SERVICE --> SESSION_STRATEGY
    CACHE_SERVICE --> PAGE_STRATEGY
    CACHE_SERVICE --> COMPUTATION_STRATEGY

    CACHE_MIDDLEWARE --> CACHE_SERVICE
    CACHE_DECORATORS --> CACHE_SERVICE
```

### 监控系统架构

```mermaid
graph TB
    subgraph "指标收集"
        APP_METRICS[应用指标<br/>请求数、响应时间<br/>错误率]
        SYSTEM_METRICS[系统指标<br/>CPU、内存、磁盘<br/>网络]
        BUSINESS_METRICS[业务指标<br/>工作流完成率<br/>用户活跃度]
    end

    subgraph "监控中间件"
        PROMETHEUS_MW[PrometheusInspiredMetrics<br/>指标收集]
        CACHE_MW[CacheMiddleware<br/>缓存监控]
        PERF_MW[PerformanceMonitoringMiddleware<br/>性能监控]
    end

    subgraph "存储和查询"
        PROMETHEUS[(Prometheus<br/>时序数据库)]
        INFLUXDB[(InfluxDB<br/>可选)]
    end

    subgraph "可视化和告警"
        GRAFANA[(Grafana<br/>仪表板)]
        ALERTMANAGER[(AlertManager<br/>告警管理)]
        WEBHOOKS[Webhook集成<br/>Slack、邮件]
    end

    APP_METRICS --> PROMETHEUS_MW
    SYSTEM_METRICS --> PROMETHEUS_MW
    BUSINESS_METRICS --> PROMETHEUS_MW

    PROMETHEUS_MW --> PROMETHEUS
    CACHE_MW --> PROMETHEUS
    PERF_MW --> PROMETHEUS

    PROMETHEUS --> GRAFANA
    PROMETHEUS --> ALERTMANAGER

    ALERTMANAGER --> WEBHOOKS
```

## 安全性架构

```mermaid
graph TB
    subgraph "网络安全"
        FIREWALL[防火墙<br/>WAF]
        SSL[SSL/TLS<br/>证书管理]
        VPN[VPN<br/>内部网络]
    end

    subgraph "应用安全"
        AUTH[认证<br/>JWT + 多因子]
        AUTHZ[授权<br/>RBAC + ABAC]
        ENCRYPTION[加密<br/>数据传输 + 存储]
        AUDIT[审计日志<br/>操作追踪]
    end

    subgraph "数据安全"
        VALIDATION[输入验证<br/>XSS/SQL防护]
        SANITIZATION[数据清理<br/>敏感信息过滤]
        ENCRYPTION_DB[数据库加密<br/>字段级加密]
        BACKUP[备份加密<br/>安全存储]
    end

    subgraph "监控和响应"
        LOGGING[安全日志<br/>异常检测]
        ALERTS[安全告警<br/>实时响应]
        FORENSICS[取证分析<br/>事件调查]
    end

    CLIENT[客户端] --> FIREWALL
    FIREWALL --> SSL
    SSL --> AUTH

    AUTH --> AUTHZ
    AUTHZ --> VALIDATION

    VALIDATION --> ENCRYPTION
    ENCRYPTION --> AUDIT

    AUDIT --> LOGGING
    LOGGING --> ALERTS
    ALERTS --> FORENSICS
```

## 扩展策略

### 水平扩展

```mermaid
graph LR
    subgraph "负载均衡器"
        LB[Load Balancer<br/>Nginx/HAProxy]
    end

    subgraph "应用服务器集群"
        APP1[frys App 1]
        APP2[frys App 2]
        APP3[frys App 3]
    end

    subgraph "共享存储"
        SHARED_DB[(PostgreSQL<br/>主从复制)]
        SHARED_CACHE[(Redis Cluster)]
        SHARED_MQ[(RabbitMQ Cluster)]
    end

    LB --> APP1
    LB --> APP2
    LB --> APP3

    APP1 --> SHARED_DB
    APP2 --> SHARED_DB
    APP3 --> SHARED_DB

    APP1 --> SHARED_CACHE
    APP2 --> SHARED_CACHE
    APP3 --> SHARED_CACHE

    APP1 --> SHARED_MQ
    APP2 --> SHARED_MQ
    APP3 --> SHARED_MQ
```

### 垂直扩展

```mermaid
graph TB
    subgraph "微服务拆分"
        USER_MICROSVC[用户微服务<br/>独立部署]
        WORKFLOW_MICROSVC[工作流微服务<br/>独立部署]
        NOTIFICATION_MICROSVC[通知微服务<br/>独立部署]
        AUTH_MICROSVC[认证微服务<br/>独立部署]
    end

    subgraph "共享基础设施"
        SERVICE_MESH[服务网格<br/>Istio/Linkerd]
        CONFIG_CENTER[配置中心<br/>Consul/Etcd]
        SERVICE_DISCOVERY[服务发现<br/>Consul/Eureka]
    end

    subgraph "API网关"
        GATEWAY[API Gateway<br/>Kong/Traefik]
    end

    GATEWAY --> SERVICE_MESH
    SERVICE_MESH --> USER_MICROSVC
    SERVICE_MESH --> WORKFLOW_MICROSVC
    SERVICE_MESH --> NOTIFICATION_MICROSVC
    SERVICE_MESH --> AUTH_MICROSVC

    USER_MICROSVC --> CONFIG_CENTER
    WORKFLOW_MICROSVC --> CONFIG_CENTER
    NOTIFICATION_MICROSVC --> CONFIG_CENTER
    AUTH_MICROSVC --> CONFIG_CENTER

    USER_MICROSVC --> SERVICE_DISCOVERY
    WORKFLOW_MICROSVC --> SERVICE_DISCOVERY
    NOTIFICATION_MICROSVC --> SERVICE_DISCOVERY
    AUTH_MICROSVC --> SERVICE_DISCOVERY
```

## 性能优化架构

```mermaid
graph TB
    subgraph "缓存策略"
        MULTI_LEVEL[多级缓存<br/>L1内存 + L2 Redis]
        SMART_TTL[智能TTL<br/>基于访问模式]
        PREWARMING[缓存预热<br/>启动时预热]
        INVALIDATION[智能失效<br/>事件驱动]
    end

    subgraph "数据库优化"
        CONNECTION_POOL[连接池<br/>连接复用]
        QUERY_OPTIMIZATION[查询优化<br/>索引 + 分页]
        READ_REPLICA[读写分离<br/>读副本]
        SHARDING[分片策略<br/>水平扩展]
    end

    subgraph "应用优化"
        ASYNC_PROCESSING[异步处理<br/>消息队列]
        BATCH_OPERATIONS[批量操作<br/>减少IO]
        COMPRESSION[响应压缩<br/>Gzip/Brotli]
        CDN[CDN加速<br/>静态资源]
    end

    subgraph "监控优化"
        METRICS_COLLECTION[指标收集<br/>性能监控]
        PROFILING[性能剖析<br/>热点分析]
        AUTO_SCALING[自动扩缩容<br/>智能调度]
    end

    MULTI_LEVEL --> APP[应用性能]
    SMART_TTL --> APP
    PREWARMING --> APP
    INVALIDATION --> APP

    CONNECTION_POOL --> DB[数据库性能]
    QUERY_OPTIMIZATION --> DB
    READ_REPLICA --> DB
    SHARDING --> DB

    ASYNC_PROCESSING --> ASYNC[异步性能]
    BATCH_OPERATIONS --> ASYNC
    COMPRESSION --> NETWORK[网络性能]
    CDN --> NETWORK

    METRICS_COLLECTION --> MONITOR[监控性能]
    PROFILING --> MONITOR
    AUTO_SCALING --> MONITOR
```

## 故障恢复架构

```mermaid
graph TB
    subgraph "故障检测"
        HEALTH_CHECKS[健康检查<br/>定期检测]
        CIRCUIT_BREAKER[断路器<br/>故障隔离]
        TIMEOUTS[超时控制<br/>防止雪崩]
    end

    subgraph "故障恢复"
        RETRY_MECHANISM[重试机制<br/>指数退避]
        FALLBACK_STRATEGY[降级策略<br/>备用服务]
        DEAD_LETTER_QUEUE[死信队列<br/>失败重试]
    end

    subgraph "故障转移"
        LOAD_BALANCER[负载均衡<br/>自动切换]
        REPLICATION[数据复制<br/>主从切换]
        BACKUP_SYSTEMS[备用系统<br/>灾备切换]
    end

    subgraph "监控告警"
        ALERT_SYSTEM[告警系统<br/>实时通知]
        LOG_AGGREGATION[日志聚合<br/>问题定位]
        DASHBOARDS[监控面板<br/>状态展示]
    end

    HEALTH_CHECKS --> RETRY_MECHANISM
    CIRCUIT_BREAKER --> FALLBACK_STRATEGY
    TIMEOUTS --> DEAD_LETTER_QUEUE

    RETRY_MECHANISM --> LOAD_BALANCER
    FALLBACK_STRATEGY --> REPLICATION
    DEAD_LETTER_QUEUE --> BACKUP_SYSTEMS

    LOAD_BALANCER --> ALERT_SYSTEM
    REPLICATION --> LOG_AGGREGATION
    BACKUP_SYSTEMS --> DASHBOARDS
```

## 总结

frys采用了分层的六边形架构设计，具有以下特点：

### 架构优势
- **清晰分层**: 严格的关注点分离
- **依赖倒置**: 核心业务不依赖外部实现
- **易于测试**: 每个层都可以独立测试
- **灵活扩展**: 新功能可以通过适配器添加
- **技术栈无关**: 核心业务逻辑不绑定特定技术

### 扩展性
- **水平扩展**: 通过负载均衡和集群
- **垂直扩展**: 通过微服务拆分
- **技术升级**: 通过适配器模式平滑迁移

### 可靠性
- **故障隔离**: 断路器和超时控制
- **自动恢复**: 重试和降级策略
- **数据一致性**: 事务管理和补偿机制

### 可观测性
- **全面监控**: 应用、系统、业务指标
- **分布式追踪**: 请求链路追踪
- **智能告警**: 基于阈值的自动告警

这种架构设计确保了系统的高性能、高可用性和易维护性，为企业级应用提供了坚实的技术基础。
