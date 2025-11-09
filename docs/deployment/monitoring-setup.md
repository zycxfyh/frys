# 📊 监控系统配置指南

<div align="center">

## 🔍 frys 监控和可观测性配置

**完整的监控栈部署和配置指南**

[🏠 返回项目主页](../../README.md) • [📖 文档导航](../README.md) • [🚀 快速开始](../../GETTING_STARTED.md)

---

</div>

## 📋 概述

frys 集成了完整的监控和可观测性解决方案，包括 Prometheus、Grafana 和 Alertmanager。本文档介绍如何部署和配置整个监控栈。

## 🏗️ 架构设计

### 监控组件

```mermaid
graph TB
    subgraph "frys 应用"
        A[应用服务器]
        B[工作流引擎]
        C[AI 服务]
    end

    subgraph "监控栈"
        P[Prometheus<br/>指标收集]
        G[Grafana<br/>可视化面板]
        AM[Alertmanager<br/>告警管理]
    end

    A --> P
    B --> P
    C --> P

    P --> G
    P --> AM

    subgraph "存储"
        T[时序数据库<br/>Prometheus TSDB]
        L[日志存储<br/>Loki/ELK]
    end

    P --> T
    A --> L
```

### 监控指标类型

| 指标类型       | 说明               | 示例                        |
| -------------- | ------------------ | --------------------------- |
| **业务指标**   | 应用级业务逻辑指标 | 工作流执行次数、AI API 调用 |
| **系统指标**   | 操作系统级指标     | CPU、内存、磁盘、网络       |
| **应用指标**   | 应用运行时指标     | 响应时间、错误率、并发数    |
| **自定义指标** | 业务特定指标       | 用户活跃度、功能使用统计    |

## 🚀 快速开始

### 使用 Docker Compose

```bash
# 1. 进入监控目录
cd monitoring

# 2. 启动监控栈
docker-compose -f ../config/docker/docker-compose.monitoring.yml up -d

# 3. 验证服务状态
docker-compose -f ../config/docker/docker-compose.monitoring.yml ps

# 4. 访问监控界面
# Grafana: http://localhost:3001 (admin/admin)
# Prometheus: http://localhost:9090
# Alertmanager: http://localhost:9093
```

### 手动部署

```bash
# 1. 安装 Prometheus
wget https://github.com/prometheus/prometheus/releases/download/v2.45.0/prometheus-2.45.0.linux-amd64.tar.gz
tar xvf prometheus-2.45.0.linux-amd64.tar.gz
cd prometheus-2.45.0.linux-amd64/

# 2. 配置 Prometheus
cp prometheus.yml prometheus.yml.backup
cp /path/to/frys/monitoring/prometheus/prometheus.yml prometheus.yml

# 3. 启动 Prometheus
./prometheus --config.file=prometheus.yml --web.listen-address=":9090"

# 4. 安装 Grafana (新终端)
wget https://dl.grafana.com/oss/release/grafana-10.1.0.linux-amd64.tar.gz
tar xvf grafana-10.1.0.linux-amd64.tar.gz
cd grafana-10.1.0.linux-amd64/

# 5. 配置 Grafana
cp /path/to/frys/monitoring/grafana/provisioning/datasources/prometheus.yml conf/provisioning/datasources/

# 6. 启动 Grafana
./bin/grafana-server --config=conf/defaults.ini web
```

## ⚙️ Prometheus 配置

### 基础配置

```yaml
# monitoring/prometheus/prometheus.yml
global:
  scrape_interval: 15s # 抓取间隔
  evaluation_interval: 15s # 评估间隔
  scrape_timeout: 10s # 抓取超时

rule_files:
  - 'alert_rules.yml' # 告警规则文件
  - 'slo_rules.yml' # SLO 规则文件

alerting:
  alertmanagers:
    - static_configs:
        - targets:
            - alertmanager:9093

scrape_configs:
  # frys 应用指标
  - job_name: 'frys'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
    scrape_interval: 5s

  # Node.js 应用指标
  - job_name: 'frys-node'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics/node'
    scrape_interval: 10s

  # 系统指标
  - job_name: 'node'
    static_configs:
      - targets: ['localhost:9100']
    scrape_interval: 15s

  # Redis 指标
  - job_name: 'redis'
    static_configs:
      - targets: ['localhost:9121']
    scrape_interval: 30s
```

### 高级配置

```yaml
# 动态服务发现
scrape_configs:
  # Docker 容器发现
  - job_name: 'docker'
    docker_sd_configs:
      - host: unix:///var/run/docker.sock
        refresh_interval: 15s
    relabel_configs:
      - source_labels: [__meta_docker_container_name]
        regex: '/frys.*'
        target_label: job
        replacement: 'frys'

  # Kubernetes 服务发现
  - job_name: 'kubernetes-services'
    kubernetes_sd_configs:
      - role: service
        namespaces:
          names:
            - default
    relabel_configs:
      - source_labels: [__meta_kubernetes_service_name]
        regex: 'frys.*'
        action: keep
      - source_labels: [__meta_kubernetes_service_name]
        target_label: job
        replacement: '${1}'

# 远程写入 (可选)
remote_write:
  - url: 'https://prometheus-prod-10-prod-us-central-0.grafana.net/api/prom/push'
    headers:
      Authorization: 'Bearer YOUR_GRAFANA_CLOUD_TOKEN'
```

## 🎨 Grafana 配置

### 数据源配置

```yaml
# monitoring/grafana/provisioning/datasources/prometheus.yml
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: true

  - name: Loki
    type: loki
    access: proxy
    url: http://loki:3100
    editable: true
```

### 仪表板配置

```yaml
# monitoring/grafana/provisioning/dashboards/dashboard.yml
apiVersion: 1

providers:
  - name: 'frys'
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    allowUiUpdates: true
    options:
      path: /var/lib/grafana/dashboards
```

### 仪表板导入

```json
{
  "dashboard": {
    "title": "frys 系统监控",
    "tags": ["frys", "monitoring"],
    "timezone": "browser",
    "panels": [
      {
        "title": "系统状态",
        "type": "stat",
        "targets": [
          {
            "expr": "up{job=\"frys\"}",
            "legendFormat": "frys"
          }
        ]
      }
    ],
    "time": {
      "from": "now-1h",
      "to": "now"
    }
  }
}
```

## 🚨 Alertmanager 配置

### 基础告警配置

```yaml
# monitoring/alertmanager/config.yml
global:
  smtp_smarthost: 'smtp.gmail.com:587'
  smtp_from: 'alerts@frys.com'
  smtp_auth_username: 'alerts@frys.com'
  smtp_auth_password: 'your-app-password'

route:
  group_by: ['alertname']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'email'
  routes:
    - match:
        severity: critical
      receiver: 'email'
    - match:
        severity: warning
      receiver: 'slack'

receivers:
  - name: 'email'
    email_configs:
      - to: 'ops@frys.com'
        subject: '{{ template "email.subject" . }}'
        body: '{{ template "email.body" . }}'

  - name: 'slack'
    slack_configs:
      - api_url: 'https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK'
        channel: '#alerts'
        title: '{{ template "slack.title" . }}'
        text: '{{ template "slack.text" . }}'
```

### 告警规则

```yaml
# monitoring/prometheus/alert_rules.yml
groups:
  - name: frys.rules
    rules:
      # 系统不可用告警
      - alert: FrysDown
        expr: up{job="frys"} == 0
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: 'frys 服务不可用'
          description: 'frys 服务已停止运行超过 5 分钟'

      # 高 CPU 使用率告警
      - alert: HighCPUUsage
        expr: rate(cpu_usage_percent[5m]) > 80
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: 'CPU 使用率过高'
          description: 'CPU 使用率超过 80% 已持续 10 分钟'

      # 内存不足告警
      - alert: HighMemoryUsage
        expr: (1 - system_memory_available / system_memory_total) * 100 > 85
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: '内存使用率过高'
          description: '系统内存使用率超过 85%'

      # API 响应时间过长
      - alert: SlowAPIResponse
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[10m])) > 5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: 'API 响应时间过长'
          description: '95% 的 API 请求响应时间超过 5 秒'
```

## 📊 SLO 配置

### SLO 定义

```yaml
# monitoring/prometheus/slo_rules.yml
groups:
  - name: slo.rules
    rules:
      # API 可用性 SLO
      - record: slo:api:availability:ratio
        expr: |
          sum(rate(http_requests_total{status=~"2..|3.."}[30d]))
          /
          sum(rate(http_requests_total[30d]))

      # API 延迟 SLO
      - record: slo:api:latency:ratio
        expr: |
          sum(rate(http_request_duration_seconds_bucket{le="1"}[30d]))
          /
          sum(rate(http_request_duration_seconds_count[30d]))

      # 工作流成功率 SLO
      - record: slo:workflow:success:ratio
        expr: |
          sum(rate(workflow_executions_total{status="completed"}[30d]))
          /
          sum(rate(workflow_executions_total[30d]))
```

### SLO 目标

```yaml
# SLO 目标定义
slo_targets:
  api_availability: 99.9 # API 可用性目标 99.9%
  api_latency: 99 # API 延迟目标 99% 在 1 秒内
  workflow_success: 99.5 # 工作流成功率目标 99.5%
```

## 📈 应用指标配置

### Node.js 应用指标

```javascript
// 在应用中集成 Prometheus 客户端
const promClient = require('prom-client');

// 创建注册器
const register = new promClient.Registry();

// 添加默认指标收集器
promClient.collectDefaultMetrics({ register });

// 自定义业务指标
const workflowExecutionsTotal = new promClient.Counter({
  name: 'workflow_executions_total',
  help: 'Total number of workflow executions',
  labelNames: ['status', 'workflow_type'],
  registers: [register],
});

const apiRequestDuration = new promClient.Histogram({
  name: 'api_request_duration_seconds',
  help: 'API request duration in seconds',
  labelNames: ['method', 'endpoint', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

// 在 Express 中间件中使用
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    apiRequestDuration
      .labels(
        req.method,
        req.route?.path || req.path,
        res.statusCode.toString(),
      )
      .observe(duration);
  });
  next();
});

// 工作流执行指标
function trackWorkflowExecution(workflowType, status) {
  workflowExecutionsTotal.labels(status, workflowType).inc();
}

// 暴露指标端点
app.get('/metrics', async (req, res) => {
  try {
    const metrics = await register.metrics();
    res.set('Content-Type', register.contentType);
    res.send(metrics);
  } catch (error) {
    res.status(500).send('Error generating metrics');
  }
});
```

### 系统指标收集

```bash
# 安装 Node Exporter (系统指标)
wget https://github.com/prometheus/node_exporter/releases/download/v1.6.1/node_exporter-1.6.1.linux-amd64.tar.gz
tar xvf node_exporter-1.6.1.linux-amd64.tar.gz
cd node_exporter-1.6.1.linux-amd64/

# 启动 Node Exporter
./node_exporter --web.listen-address=":9100"
```

### Redis 指标收集

```bash
# 安装 Redis Exporter
wget https://github.com/oliver006/redis_exporter/releases/download/v1.54.0/redis_exporter-v1.54.0.linux-amd64.tar.gz
tar xvf redis_exporter-v1.54.0.linux-amd64.tar.gz
cd redis_exporter-v1.54.0.linux-amd64/

# 启动 Redis Exporter
./redis_exporter -redis.addr localhost:6379 -web.listen-address=":9121"
```

## 🔧 故障排除

### Prometheus 问题

**问题**: 指标收集失败

```bash
# 检查 Prometheus 状态
curl http://localhost:9090/-/healthy

# 查看 Prometheus 日志
docker logs prometheus

# 检查目标状态
curl http://localhost:9090/api/v1/targets
```

**问题**: 查询失败

```bash
# 检查查询语法
curl "http://localhost:9090/api/v1/query?query=up"

# 查看错误信息
curl "http://localhost:9090/api/v1/query?query=invalid_query"
```

### Grafana 问题

**问题**: 无法连接数据源

```bash
# 检查数据源配置
curl -u admin:admin http://localhost:3001/api/datasources

# 测试数据源连接
curl -u admin:admin http://localhost:3001/api/datasources/1/health
```

**问题**: 仪表板不显示数据

```bash
# 检查查询语法
# 在 Grafana UI 中查看 Query Inspector

# 验证 Prometheus 查询
curl "http://localhost:9090/api/v1/query?query=up{job=\"frys\"}"
```

### Alertmanager 问题

**问题**: 告警不发送

```bash
# 检查告警状态
curl http://localhost:9093/api/v2/alerts

# 查看 Alertmanager 日志
docker logs alertmanager

# 测试邮件配置
# 使用 swaks 或 telnet 测试 SMTP
```

## 📊 监控最佳实践

### 指标命名规范

```javascript
// 好的指标命名
const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'endpoint', 'status'],
});

// 避免的命名
const reqCount = new Counter({
  name: 'requests', // 太模糊
  help: 'Number of requests', // 描述不够详细
});
```

### 标签使用指南

```javascript
// 正确的标签使用
httpRequestsTotal.labels('GET', '/api/users', '200').inc();

// 避免的标签使用
// 不要使用高基数标签（如用户ID、邮箱等）
httpRequestsTotal.labels(userId, email, '200').inc(); // ❌

// 建议使用有限基数的标签
httpRequestsTotal.labels(userType, region, '200').inc(); // ✅
```

### 性能考虑

- **指标数量**: 控制指标总数，避免过多的 time series
- **标签基数**: 避免高基数标签导致的性能问题
- **抓取间隔**: 根据指标重要性设置合适的抓取间隔
- **数据保留**: 配置适当的数据保留策略

## 🚀 生产环境部署

### 高可用配置

```yaml
# 多 Prometheus 实例
prometheus:
  replicas: 2
  ruleSelector:
    matchLabels:
      team: backend
      prometheus: k8s

# 多 Grafana 实例
grafana:
  replicas: 2
  ingress:
    enabled: true
    hosts:
      - grafana.example.com

# Alertmanager 集群
alertmanager:
  replicas: 3
  cluster:
    enabled: true
```

### 安全配置

```yaml
# Prometheus 安全配置
prometheus:
  securityContext:
    runAsUser: 65534
    runAsGroup: 65534
  web:
    tls:
      enabled: true
      certFile: /etc/ssl/certs/prometheus.crt
      keyFile: /etc/ssl/private/prometheus.key

# Grafana 安全配置
grafana:
  adminPassword: ${GRAFANA_ADMIN_PASSWORD}
  auth:
    oauth:
      enabled: true
  security:
    allow_embedding: false
```

## 📚 相关资源

- **[Prometheus 文档](https://prometheus.io/docs/)** - 官方文档
- **[Grafana 文档](https://grafana.com/docs/)** - 可视化指南
- **[Alertmanager 文档](https://prometheus.io/docs/alerting/latest/alertmanager/)** - 告警管理
- **[部署指南](production-setup.md)** - 生产环境部署
- **[性能监控](../development/performance-monitoring.md)** - 应用性能监控

---

<div align="center">

## 🎯 监控让系统更可靠

**通过完整的监控栈，确保 frys 系统的稳定运行**

[🏠 返回项目主页](../../README.md) • [📖 查看文档导航](../README.md) • [🚀 开始监控部署](#快速开始)

---

_最后更新: 2025年11月7日_

</div>
