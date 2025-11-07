# WokeFlow DevOps 文档

## 📖 概述

<div style="background-color: #e8f4fd; padding: 20px; border-left: 5px solid #03a9f4; margin: 20px 0;">
  <h3 style="margin-top: 0; color: #01579b;">🚀 现代化 DevOps 实践</h3>
  <p>WokeFlow 采用<strong>现代化 DevOps 实践</strong>，实现从<strong>代码提交到生产部署</strong>的完整自动化流水线。通过<strong>容器化</strong>、<strong>监控告警</strong>、<strong>自动化部署</strong>等手段，确保系统的高可用性、可观测性和快速迭代能力。</p>
  <p><strong>核心目标</strong>：让开发者专注于业务创新，基础设施自动化处理。</p>
</div>

## 🎯 DevOps 架构设计原则

### 1. 🏗️ 基础设施即代码 (IaC)

<div style="background-color: #f3e5f5; padding: 15px; border-radius: 8px; margin: 15px 0;">
  <h4 style="margin-top: 0; color: #7b1fa2;">IaC 核心理念</h4>
  <ul>
    <li><strong>📝 声明式配置</strong>：使用 Docker Compose、Kubernetes 等声明式配置管理基础设施</li>
    <li><strong>🔄 版本控制</strong>：所有基础设施配置纳入 Git 版本管理，支持回滚和审计</li>
    <li><strong>🤖 自动化部署</strong>：通过脚本和工具实现自动化部署，减少人工干预</li>
    <li><strong>🔄 不可变基础设施</strong>：环境不可变，每次部署创建新实例</li>
  </ul>

  <h4 style="margin-top: 20px; color: #7b1fa2;">IaC 优势</h4>
  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 10px;">
    <div style="background-color: #e1bee7; padding: 10px; border-radius: 5px;">
      <strong>🔒 一致性</strong><br/>
      开发、测试、生产环境完全一致
    </div>
    <div style="background-color: #e1bee7; padding: 10px; border-radius: 5px;">
      <strong>⚡ 可重现性</strong><br/>
      任何环境可快速重建
    </div>
    <div style="background-color: #e1bee7; padding: 10px; border-radius: 5px;">
      <strong>📊 可审计性</strong><br/>
      所有变更都有历史记录
    </div>
    <div style="background-color: #e1bee7; padding: 10px; border-radius: 5px;">
      <strong>🚀 敏捷性</strong><br/>
      快速创建和销毁环境
    </div>
  </div>
</div>

### 2. 👁️ 可观测性优先 (Observability First)

<div style="background-color: #e8f5e8; padding: 15px; border-radius: 8px; margin: 15px 0;">
  <h4 style="margin-top: 0; color: #2e7d32;">三大可观测性支柱</h4>

  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 15px 0;">
    <div style="background-color: #c8e6c9; padding: 15px; border-radius: 8px; text-align: center;">
      <div style="font-size: 2em; margin-bottom: 10px;">📊</div>
      <strong>指标 (Metrics)</strong><br/>
      <small>量化系统性能和健康状态</small>
    </div>
    <div style="background-color: #c8e6c9; padding: 15px; border-radius: 8px; text-align: center;">
      <div style="font-size: 2em; margin-bottom: 10px;">📝</div>
      <strong>日志 (Logs)</strong><br/>
      <small>记录系统运行时的事件和状态</small>
    </div>
    <div style="background-color: #c8e6c9; padding: 15px; border-radius: 8px; text-align: center;">
      <div style="font-size: 2em; margin-bottom: 10px;">🔍</div>
      <strong>追踪 (Traces)</strong><br/>
      <small>跟踪请求在系统中的完整路径</small>
    </div>
  </div>

  <h4 style="margin-top: 20px; color: #2e7d32;">可观测性实现</h4>
  <ul>
    <li><strong>📈 全面监控</strong>：应用、服务、基础设施多层次监控覆盖</li>
    <li><strong>🏗️ 结构化日志</strong>：JSON 格式便于分析和告警</li>
    <li><strong>⚡ 性能指标</strong>：实时收集和分析性能数据</li>
    <li><strong>🎯 业务指标</strong>：监控业务关键指标和 SLA</li>
  </ul>
</div>

### 3. 🤖 自动化运维

<div style="background-color: #fff3e0; padding: 15px; border-radius: 8px; margin: 15px 0;">
  <h4 style="margin-top: 0; color: #f57c00;">自动化流程</h4>

  <div style="background-color: #f5f5f5; padding: 15px; border-radius: 8px; margin: 10px 0;">
    <div style="display: flex; align-items: center; margin-bottom: 10px;">
      <span style="background-color: #4caf50; color: white; padding: 5px 10px; border-radius: 15px; font-weight: bold; margin-right: 10px;">1</span>
      <strong>代码提交</strong> → Git Push
    </div>
    <div style="display: flex; align-items: center; margin-bottom: 10px;">
      <span style="background-color: #2196f3; color: white; padding: 5px 10px; border-radius: 15px; font-weight: bold; margin-right: 10px;">2</span>
      <strong>CI 流水线</strong> → 自动化测试、构建
    </div>
    <div style="display: flex; align-items: center; margin-bottom: 10px;">
      <span style="background-color: #ff9800; color: white; padding: 5px 10px; border-radius: 15px; font-weight: bold; margin-right: 10px;">3</span>
      <strong>CD 部署</strong> → 蓝绿部署到生产
    </div>
    <div style="display: flex; align-items: center;">
      <span style="background-color: #9c27b0; color: white; padding: 5px 10px; border-radius: 15px; font-weight: bold; margin-right: 10px;">4</span>
      <strong>监控告警</strong> → 实时监控和自动响应
    </div>
  </div>

  <h4 style="margin-top: 20px; color: #f57c00;">自动化特性</h4>
  <ul>
    <li><strong>🔄 CI/CD 流水线</strong>：自动化测试、构建、部署流程</li>
    <li><strong>🔵 蓝绿部署</strong>：零停机部署策略，保障业务连续性</li>
    <li><strong>↩️ 自动回滚</strong>：部署失败时自动回滚到稳定版本</li>
    <li><strong>⚡ 弹性伸缩</strong>：基于负载自动调整资源</li>
  </ul>
</div>

### 4. 🛡️ 安全第一原则

<div style="background-color: #ffebee; padding: 15px; border-radius: 8px; margin: 15px 0;">
  <h4 style="margin-top: 0; color: #c62828;">安全实践</h4>
  <ul>
    <li><strong>👤 最小权限原则</strong>：容器使用非 root 用户，服务采用最小权限运行</li>
    <li><strong>🔍 安全扫描</strong>：代码和镜像定期进行安全漏洞扫描</li>
    <li><strong>🚪 访问控制</strong>：严格的网络和访问控制，实施零信任架构</li>
    <li><strong>🔐 密钥管理</strong>：安全的密钥存储和轮换机制</li>
    <li><strong>📋 审计日志</strong>：完整的安全事件审计和监控</li>
  </ul>

  <h4 style="margin-top: 20px; color: #c62828;">安全生命周期</h4>
  <div style="background-color: #ffcdd2; padding: 10px; border-radius: 5px; margin-top: 10px;">
    <strong>🔒 安全融入每个环节</strong>：从代码编写到生产部署，全流程安全保障
  </div>
</div>

## 容器化部署

### Docker 镜像构建

#### Dockerfile 设计

```dockerfile
# WokeFlow 生产级Docker镜像
FROM node:20-alpine

# 设置工作目录
WORKDIR /app

# 安装系统依赖
RUN apk add --no-cache \
    git \
    curl \
    && rm -rf /var/cache/apk/*

# 复制package文件
COPY package*.json ./

# 安装生产依赖
RUN npm ci --only=production && npm cache clean --force

# 复制应用代码
COPY . .

# 创建非root用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S wokeflow -u 1001

# 更改文件所有权
RUN chown -R wokeflow:nodejs /app
USER wokeflow

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# 启动应用
CMD ["node", "src/index.js"]
```

#### 镜像优化策略

##### 多阶段构建
```dockerfile
# 构建阶段
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# 生产镜像
FROM node:20-alpine AS production
COPY --from=builder /app/node_modules ./node_modules
COPY . .
# ... 其余配置
```

##### 层缓存优化
- 依赖安装独立层
- 代码复制在最后
- 使用 .dockerignore 排除不必要文件

##### 安全加固
- 使用非 root 用户运行
- 最小化基础镜像 (alpine)
- 删除不必要的包和缓存

### Docker Compose 配置

#### 生产环境配置

```yaml
version: '3.8'

services:
  # WokeFlow 应用 - 蓝环境
  wokeflow-blue:
    image: wokeflow/production:latest
    container_name: wokeflow-blue
    environment:
      - NODE_ENV=production
      - DEPLOY_ENV=blue
    env_file:
      - .env.production
    ports:
      - "3001:3000"
    volumes:
      - ./logs:/app/logs
      - ./uploads:/app/uploads
    depends_on:
      - postgres
      - redis
    networks:
      - wokeflow-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # WokeFlow 应用 - 绿环境
  wokeflow-green:
    image: wokeflow/production:latest
    container_name: wokeflow-green
    environment:
      - NODE_ENV=production
      - DEPLOY_ENV=green
    env_file:
      - .env.production
    ports:
      - "3002:3000"
    volumes:
      - ./logs:/app/logs
      - ./uploads:/app/uploads
    depends_on:
      - postgres
      - redis
    networks:
      - wokeflow-network
    restart: unless-stopped
    profiles:
      - green  # 默认不启动

  # PostgreSQL 数据库
  postgres:
    image: postgres:15-alpine
    container_name: wokeflow-postgres
    environment:
      - POSTGRES_DB=wokeflow_prod
      - POSTGRES_USER=wokeflow
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    networks:
      - wokeflow-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U wokeflow"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Redis 缓存
  redis:
    image: redis:7-alpine
    container_name: wokeflow-redis
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    networks:
      - wokeflow-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Nginx 反向代理
  nginx:
    image: nginx:1.25-alpine
    container_name: wokeflow-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/conf.d:/etc/nginx/conf.d
      - ./nginx/ssl:/etc/nginx/ssl
      - ./logs/nginx:/var/log/nginx
    depends_on:
      - wokeflow-blue
    networks:
      - wokeflow-network
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:

networks:
  wokeflow-network:
    driver: bridge
```

#### 测试环境配置

```yaml
version: '3.8'

services:
  # WokeFlow 测试环境
  wokeflow-staging:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: wokeflow-staging
    environment:
      - NODE_ENV=staging
    env_file:
      - .env.staging
    ports:
      - "3000:3000"
    volumes:
      - ./logs:/app/logs
    depends_on:
      - postgres-staging
      - redis-staging
    networks:
      - staging-network
    restart: unless-stopped

  # PostgreSQL 测试数据库
  postgres-staging:
    image: postgres:15-alpine
    container_name: wokeflow-postgres-staging
    environment:
      - POSTGRES_DB=wokeflow_staging
      - POSTGRES_USER=wokeflow
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres_staging_data:/var/lib/postgresql/data
    networks:
      - staging-network
    restart: unless-stopped

  # Redis 测试缓存
  redis-staging:
    image: redis:7-alpine
    container_name: wokeflow-redis-staging
    volumes:
      - redis_staging_data:/data
    networks:
      - staging-network
    restart: unless-stopped

volumes:
  postgres_staging_data:
  redis_staging_data:

networks:
  staging-network:
    driver: bridge
```

## 蓝绿部署策略

### 部署流程

#### 1. 部署准备
```bash
# 构建新版本镜像
docker build -t wokeflow/production:v1.2.3 .

# 推送镜像到注册表
docker push wokeflow/production:v1.2.3

# 标记为最新版本
docker tag wokeflow/production:v1.2.3 wokeflow/production:latest
```

#### 2. 蓝绿部署脚本

```bash
#!/bin/bash

# 蓝绿部署脚本
set -euo pipefail

# 确定目标环境
ACTIVE_ENV=$(get_active_environment)
if [ "$ACTIVE_ENV" = "blue" ]; then
    DEPLOY_ENV="green"
    INACTIVE_ENV="blue"
else
    DEPLOY_ENV="blue"
    INACTIVE_ENV="green"
fi

echo "部署到 $DEPLOY_ENV 环境，停止 $INACTIVE_ENV 环境"

# 启动新环境
docker-compose up -d "wokeflow-$DEPLOY_ENV"

# 等待健康检查
if check_health "wokeflow-$DEPLOY_ENV"; then
    echo "✅ $DEPLOY_ENV 环境部署成功"
    
    # 切换流量
    switch_traffic "$DEPLOY_ENV"
    
    # 停止旧环境
    docker-compose stop "wokeflow-$INACTIVE_ENV"
    
    echo "🎉 部署完成！"
else
    echo "❌ $DEPLOY_ENV 环境部署失败"
    
    # 停止失败的环境
    docker-compose stop "wokeflow-$DEPLOY_ENV"
    
    exit 1
fi
```

#### 3. 流量切换

```nginx
# Nginx 配置 - 蓝环境
upstream wokeflow_backend {
    server wokeflow-blue:3000;
}

# Nginx 配置 - 绿环境
upstream wokeflow_backend {
    server wokeflow-green:3000;
}
```

### 部署验证

#### 健康检查
```bash
# 应用健康检查
curl -f http://localhost:3000/health

# 数据库连接检查
docker-compose exec wokeflow-blue node -e "
const { Client } = require('pg');
const client = new Client();
client.connect().then(() => {
    console.log('数据库连接成功');
    client.end();
}).catch(console.error);
"
```

#### 功能测试
```bash
# API 功能测试
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test"}'

# 工作流测试
curl -X POST http://localhost:3000/api/workflows \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"部署验证工作流","tasks":[]}'
```

### 回滚策略

#### 自动回滚
```bash
#!/bin/bash

# 回滚脚本
FAILED_ENV=$1

echo "部署失败，开始回滚..."

# 切换回旧环境
switch_traffic_to_previous

# 停止失败的环境
docker-compose stop "wokeflow-$FAILED_ENV"

# 发送告警
send_alert "部署失败，已回滚到稳定版本"

echo "回滚完成"
```

## 监控和告警系统

### Prometheus 监控

#### 应用指标收集

```javascript
// src/core/PrometheusInspiredMetrics.js
import { register, collectDefaultMetrics, Gauge, Counter, Histogram } from 'prom-client';

// 收集默认指标
collectDefaultMetrics();

// 自定义指标
const httpRequestTotal = new Counter({
  name: 'wokeflow_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

const httpRequestDuration = new Histogram({
  name: 'wokeflow_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route']
});

const activeConnections = new Gauge({
  name: 'wokeflow_active_connections',
  help: 'Number of active connections'
});

const workflowActive = new Gauge({
  name: 'wokeflow_workflows_active',
  help: 'Number of currently active workflows'
});

// 指标收集中间件
export const metricsMiddleware = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    
    httpRequestTotal
      .labels(req.method, req.route?.path || req.path, res.statusCode.toString())
      .inc();
    
    httpRequestDuration
      .labels(req.method, req.route?.path || req.path)
      .observe(duration);
  });
  
  next();
};
```

#### Prometheus 配置

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  # WokeFlow 应用监控
  - job_name: 'wokeflow-blue'
    static_configs:
      - targets: ['wokeflow-blue:3000']
        labels:
          environment: 'production'
          deployment: 'blue'
    scrape_interval: 10s
    metrics_path: '/metrics'

  - job_name: 'wokeflow-green'
    static_configs:
      - targets: ['wokeflow-green:3000']
        labels:
          environment: 'production'
          deployment: 'green'
    scrape_interval: 10s
    metrics_path: '/metrics'

  # 基础设施监控
  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres:5432']
    scrape_interval: 30s

  - job_name: 'redis'
    static_configs:
      - targets: ['redis:6379']
    scrape_interval: 30s
```

### AlertManager 告警

#### 告警规则

```yaml
groups:
  - name: wokeflow.rules
    rules:
      # 应用实例宕机告警
      - alert: WokeFlowInstanceDown
        expr: up{job="wokeflow-blue"} == 0
        for: 1m
        labels:
          severity: critical
          service: wokeflow
        annotations:
          summary: "WokeFlow 实例宕机"
          description: "WokeFlow 实例 {{ $labels.instance }} 已宕机超过1分钟"

      # 高错误率告警
      - alert: WokeFlowHighErrorRate
        expr: rate(wokeflow_http_requests_total{status_code=~"5.."}[5m]) / rate(wokeflow_http_requests_total[5m]) > 0.1
        for: 2m
        labels:
          severity: warning
          service: wokeflow
        annotations:
          summary: "WokeFlow 高错误率"
          description: "HTTP 错误率超过 10% 持续 2 分钟"

      # 响应时间过长告警
      - alert: WokeFlowHighResponseTime
        expr: histogram_quantile(0.95, rate(wokeflow_http_request_duration_seconds_bucket[5m])) > 5
        for: 2m
        labels:
          severity: warning
          service: wokeflow
        annotations:
          summary: "WokeFlow 响应时间过长"
          description: "95% 请求响应时间超过 5 秒持续 2 分钟"

      # 内存使用过高告警
      - alert: WokeFlowHighMemoryUsage
        expr: (1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) > 0.9
        for: 5m
        labels:
          severity: warning
          service: infrastructure
        annotations:
          summary: "内存使用过高"
          description: "系统内存使用率超过 90% 持续 5 分钟"
```

#### 告警接收器配置

```yaml
route:
  group_by: ['alertname', 'service', 'severity']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'wokeflow-alerts'
  routes:
    # 严重告警 - 立即通知
    - match:
        severity: critical
      receiver: 'wokeflow-critical'
      continue: true

receivers:
  # 严重告警 - 立即响应
  - name: 'wokeflow-critical'
    email_configs:
      - to: 'oncall@wokeflow.com'
        subject: '🚨 严重告警: {{ .GroupLabels.alertname }}'
    slack_configs:
      - api_url: '${SLACK_WEBHOOK_URL}'
        channel: '#critical-alerts'
        title: '🚨 严重告警'
        color: 'danger'
    pagerduty_configs:
      - service_key: '${PAGERDUTY_SERVICE_KEY}'
```

### 日志聚合

#### ELK Stack 配置

```yaml
# Filebeat 配置
filebeat.inputs:
  - type: log
    enabled: true
    paths:
      - /app/logs/wokeflow.log
    json.keys_under_root: true
    json.add_error_key: true

output.elasticsearch:
  hosts: ["elasticsearch:9200"]
  index: "wokeflow-%{+yyyy.MM.dd}"
```

#### Kibana 可视化
- 创建仪表盘显示错误率趋势
- 设置告警规则基于日志模式
- 建立用户行为分析视图

## CI/CD 流水线

### GitHub Actions 配置

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  # 测试阶段
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Lint code
        run: npm run lint

      - name: Run unit tests
        run: npm run test:unit

      - name: Run integration tests
        run: npm run test:integration

      - name: Security scan
        run: npm run test:security

      - name: Generate coverage report
        run: npm run test:coverage

  # 构建和推送镜像
  build:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      
      - name: Build Docker image
        run: docker build -t wokeflow/production:${{ github.sha }} .

      - name: Push to registry
        run: |
          echo ${{ secrets.DOCKER_PASSWORD }} | docker login -u ${{ secrets.DOCKER_USERNAME }} --password-stdin
          docker push wokeflow/production:${{ github.sha }}
          docker tag wokeflow/production:${{ github.sha }} wokeflow/production:latest
          docker push wokeflow/production:latest

  # 部署到测试环境
  deploy-staging:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    environment: staging
    steps:
      - name: Deploy to staging
        run: |
          ssh user@staging-server << EOF
            cd /opt/wokeflow
            docker-compose pull
            ./scripts/deploy.sh --env=staging
          EOF

  # 部署到生产环境
  deploy-production:
    needs: deploy-staging
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    environment: production
    steps:
      - name: Deploy to production
        run: |
          ssh user@prod-server << EOF
            cd /opt/wokeflow
            docker-compose pull
            ./scripts/deploy.sh --env=production
          EOF
```

### 质量门禁

#### 代码质量检查
```yaml
# SonarQube 配置
- name: SonarQube Scan
  uses: sonarsource/sonarsource.github.action.scan@v1
  env:
    SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
    SONAR_HOST_URL: ${{ secrets.SONAR_HOST_URL }}

# 安全扫描
- name: Security Scan
  uses: securecodewarrior/github-action-gosec@master
  with:
    args: './...'
```

#### 覆盖率要求
```yaml
# 覆盖率门禁
- name: Coverage Gate
  run: |
    COVERAGE=$(jq '.total.lines.pct' coverage/coverage-summary.json)
    if (( $(echo "$COVERAGE < 80" | bc -l) )); then
      echo "Coverage is below 80%: $COVERAGE%"
      exit 1
    fi
```

## 备份和恢复

### 数据库备份

```bash
#!/bin/bash

# PostgreSQL 备份脚本
BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# 全量备份
docker-compose exec postgres pg_dumpall -U wokeflow > "$BACKUP_DIR/full_backup.sql"

# 压缩备份
gzip "$BACKUP_DIR/full_backup.sql"

# 清理旧备份（保留7天）
find ./backups -name "*.gz" -mtime +7 -delete

echo "备份完成: $BACKUP_DIR"
```

### 应用配置备份

```bash
#!/bin/bash

# 配置备份脚本
BACKUP_DIR="./config_backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# 备份环境变量文件
cp .env.production "$BACKUP_DIR/"
cp .env.staging "$BACKUP_DIR/"

# 备份 Docker Compose 配置
cp docker-compose.yml "$BACKUP_DIR/"
cp docker-compose.production.yml "$BACKUP_DIR/"

# 备份 Nginx 配置
cp -r nginx/ "$BACKUP_DIR/"

echo "配置备份完成: $BACKUP_DIR"
```

### 灾难恢复

#### 数据恢复流程
1. 停止应用服务
2. 从备份恢复数据库
3. 恢复配置文件
4. 重启应用服务
5. 执行完整性检查

#### 恢复脚本
```bash
#!/bin/bash

# 灾难恢复脚本
BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
    echo "请指定备份文件"
    exit 1
fi

echo "开始灾难恢复..."

# 停止服务
docker-compose down

# 恢复数据库
gunzip -c "$BACKUP_FILE" | docker-compose exec -T postgres psql -U wokeflow

# 重启服务
docker-compose up -d

# 健康检查
sleep 30
if curl -f http://localhost/health; then
    echo "✅ 恢复成功"
else
    echo "❌ 恢复失败"
    exit 1
fi
```

## 总结

WokeFlow 的 DevOps 架构通过容器化部署、蓝绿发布策略、全面监控告警系统和自动化 CI/CD 流水线，实现了高可用、可观测、快速迭代的现代化运维体系。这种设计既保证了系统的稳定性，又支持了快速的业务创新和部署。
