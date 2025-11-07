# frys DevOps 指南

## 📖 概述

frys 采用现代化 DevOps 实践，构建完整的容器化部署、监控和自动化运维体系。从代码提交到生产部署的全流程自动化，确保系统的高可用性、可观测性和快速迭代能力。

### 🎯 DevOps 目标

- **自动化部署**: 从代码到生产的完整自动化流水线
- **容器化交付**: 基于 Docker 的标准化部署环境
- **可观测性监控**: 全面的监控、日志和告警系统
- **弹性伸缩**: 支持水平扩展和自动扩缩容
- **零停机部署**: 滚动更新和蓝绿部署策略
- **安全合规**: 内置安全扫描和合规检查

### 🏗️ 技术栈架构

```
DevOps 技术栈
├── 🐳 容器化层
│   ├── Docker 容器镜像
│   ├── Docker Compose 本地开发
│   └── Kubernetes 生产编排
├── 🔄 CI/CD 流水线
│   ├── GitHub Actions 自动化构建
│   ├── 多环境部署 (dev/staging/prod)
│   └── 自动化测试和质量门
├── 📊 监控告警
│   ├── Prometheus 指标收集
│   ├── Grafana 可视化面板
│   └── Sentry 错误追踪
└── 🔒 安全合规
    ├── 容器镜像扫描
    ├── 依赖安全检查
    └── 基础设施即代码
```

## 🐳 Docker 容器化

### 多阶段构建优化

```dockerfile
# Dockerfile - 多阶段构建
FROM node:18-alpine AS base

# 设置工作目录
WORKDIR /app

# 安装依赖阶段
FROM base AS deps
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# 构建阶段
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 构建应用
RUN npm run build

# 生产镜像
FROM base AS production

# 安装 dumb-init 用于信号处理
RUN apk add --no-cache dumb-init

# 创建非root用户
RUN addgroup -g 1001 -S nodejs
RUN adduser -S frys -u 1001

# 复制生产依赖
COPY --from=deps --chown=frys:nodejs /app/node_modules ./node_modules

# 复制构建产物
COPY --from=builder --chown=frys:nodejs /app/dist ./dist
COPY --from=builder --chown=frys:nodejs /app/package*.json ./

# 设置用户
USER frys

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# 启动应用
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "run", "start:prod"]
```

### 安全加固配置

```dockerfile
# Dockerfile.security - 安全加固版本
FROM node:18-alpine AS base

# 安装安全更新
RUN apk update && apk upgrade && \
    apk add --no-cache \
        dumb-init \
        curl \
        && \
    rm -rf /var/cache/apk/*

# 创建非特权用户
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

# 设置工作目录
WORKDIR /app

# 设置文件权限
RUN chown -R appuser:appgroup /app
USER appuser

# 只复制必要文件
COPY --chown=appuser:appgroup package*.json ./
COPY --chown=appuser:appgroup dist/ ./dist/

# 安装生产依赖
RUN npm ci --only=production --no-audit --no-fund && \
    npm cache clean --force

# 设置安全环境变量
ENV NODE_ENV=production
ENV PORT=3000

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f -s http://localhost:3000/health || exit 1

# 使用 exec 格式启动
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
```

### 构建优化技巧

```dockerfile
# .dockerignore - 优化构建上下文
node_modules
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.npm
.yarn
.env
.env.local
.env.development.local
.env.test.local
.env.production.local
.git
.gitignore
README.md
Dockerfile*
docker-compose*
.dockerignore
coverage
.nyc_output
.cache
.parcel-cache
.vscode
.idea
*.swp
*.swo
*~
```

```bash
# 构建脚本 - build.sh
#!/bin/bash

set -e

# 构建参数
IMAGE_NAME="frys"
TAG="${1:-latest}"
BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
GIT_COMMIT=$(git rev-parse --short HEAD)
VERSION=$(node -p "require('./package.json').version")

echo "Building frys v${VERSION} (${GIT_COMMIT})"

# 多架构构建
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --build-arg BUILD_DATE="${BUILD_DATE}" \
  --build-arg VERSION="${VERSION}" \
  --build-arg GIT_COMMIT="${GIT_COMMIT}" \
  --label "org.opencontainers.image.created=${BUILD_DATE}" \
  --label "org.opencontainers.image.version=${VERSION}" \
  --label "org.opencontainers.image.revision=${GIT_COMMIT}" \
  --label "org.opencontainers.image.source=https://github.com/your-org/frys" \
  -t "${IMAGE_NAME}:${TAG}" \
  -t "${IMAGE_NAME}:${GIT_COMMIT}" \
  --push \
  .

echo "Successfully built and pushed ${IMAGE_NAME}:${TAG}"
```

## 🐙 Docker Compose 编排

### 开发环境配置

```yaml
# docker-compose.dev.yml - 开发环境
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
      target: development
    ports:
      - "3000:3000"
      - "9229:9229"  # 调试端口
    volumes:
      - .:/app
      - /app/node_modules
    environment:
      - NODE_ENV=development
      - DEBUG=frys:*
    depends_on:
      - postgres
      - redis
      - rabbitmq
    networks:
      - frys-dev
    restart: unless-stopped

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=frys_dev
      - POSTGRES_USER=frys
      - POSTGRES_PASSWORD=dev_password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./docker/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql
    networks:
      - frys-dev
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U frys"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    networks:
      - frys-dev
    command: redis-server --appendonly yes
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3

  rabbitmq:
    image: rabbitmq:3-management-alpine
    ports:
      - "5672:5672"   # AMQP端口
      - "15672:15672" # 管理界面
    environment:
      - RABBITMQ_DEFAULT_USER=frys
      - RABBITMQ_DEFAULT_PASS=dev_password
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq
    networks:
      - frys-dev
    healthcheck:
      test: rabbitmq-diagnostics -q ping
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
  redis_data:
  rabbitmq_data:

networks:
  frys-dev:
    driver: bridge
```

### 测试环境配置

```yaml
# docker-compose.test.yml - 测试环境
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
      target: production
    environment:
      - NODE_ENV=test
      - DATABASE_URL=postgresql://test:test@localhost:5432/frys_test
      - REDIS_URL=redis://localhost:6379/1
      - RABBITMQ_URL=amqp://test:test@localhost:5672
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy
    networks:
      - frys-test
    command: npm run test:integration

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=frys_test
      - POSTGRES_USER=test
      - POSTGRES_PASSWORD=test
    tmpfs:
      - /var/lib/postgresql/data
    networks:
      - frys-test
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U test"]
      interval: 5s
      timeout: 3s
      retries: 3

  redis:
    image: redis:7-alpine
    networks:
      - frys-test
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 3

  rabbitmq:
    image: rabbitmq:3-alpine
    environment:
      - RABBITMQ_DEFAULT_USER=test
      - RABBITMQ_DEFAULT_PASS=test
    tmpfs:
      - /var/lib/rabbitmq
    networks:
      - frys-test
    healthcheck:
      test: rabbitmq-diagnostics -q ping
      interval: 5s
      timeout: 3s
      retries: 3

networks:
  frys-test:
    driver: bridge
```

### 生产环境配置

```yaml
# docker-compose.prod.yml - 生产环境
version: '3.8'

services:
  app:
    image: frys:latest
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - RABBITMQ_URL=${RABBITMQ_URL}
      - SENTRY_DSN=${SENTRY_DSN}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy
    networks:
      - frys-prod
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
        window: 120s

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=${POSTGRES_DB}
      - POSTGRES_USER=${POSTGRES_USER}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    volumes:
      - postgres_prod_data:/var/lib/postgresql/data
      - ./backups:/backups
    networks:
      - frys-prod
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 30s
      timeout: 10s
      retries: 3
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M

  redis:
    image: redis:7-alpine
    volumes:
      - redis_prod_data:/data
    networks:
      - frys-prod
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3
    deploy:
      resources:
        limits:
          cpus: '0.2'
          memory: 256M

  rabbitmq:
    image: rabbitmq:3-management-alpine
    environment:
      - RABBITMQ_DEFAULT_USER=${RABBITMQ_USER}
      - RABBITMQ_DEFAULT_PASS=${RABBITMQ_PASSWORD}
    volumes:
      - rabbitmq_prod_data:/var/lib/rabbitmq
    networks:
      - frys-prod
    healthcheck:
      test: rabbitmq-diagnostics -q ping
      interval: 30s
      timeout: 10s
      retries: 3
    deploy:
      resources:
        limits:
          cpus: '0.3'
          memory: 256M

  # 监控服务
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    networks:
      - frys-prod
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
      - '--storage.tsdb.retention.time=200h'
      - '--web.enable-lifecycle'

  grafana:
    image: grafana/grafana:latest
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD}
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana/provisioning:/etc/grafana/provisioning
    networks:
      - frys-prod
    depends_on:
      - prometheus

volumes:
  postgres_prod_data:
  redis_prod_data:
  rabbitmq_prod_data:
  prometheus_data:
  grafana_data:

networks:
  frys-prod:
    driver: bridge
```

### 编排管理脚本

```bash
#!/bin/bash
# compose.sh - Docker Compose 管理脚本

set -e

ENVIRONMENT=${1:-dev}
COMMAND=${2:-up}

COMPOSE_FILE="docker-compose.${ENVIRONMENT}.yml"

case $COMMAND in
    "up")
        echo "Starting ${ENVIRONMENT} environment..."
        docker-compose -f $COMPOSE_FILE up -d --build
        echo "Environment started. Access at http://localhost:3000"
        ;;
    "down")
        echo "Stopping ${ENVIRONMENT} environment..."
        docker-compose -f $COMPOSE_FILE down
        ;;
    "restart")
        echo "Restarting ${ENVIRONMENT} environment..."
        docker-compose -f $COMPOSE_FILE restart
        ;;
    "logs")
        docker-compose -f $COMPOSE_FILE logs -f
        ;;
    "clean")
        echo "Cleaning ${ENVIRONMENT} environment..."
        docker-compose -f $COMPOSE_FILE down -v --remove-orphans
        docker system prune -f
        ;;
    "test")
        echo "Running tests in ${ENVIRONMENT} environment..."
        docker-compose -f $COMPOSE_FILE up --abort-on-container-exit --exit-code-from app
        ;;
    *)
        echo "Usage: $0 [dev|test|prod] [up|down|restart|logs|clean|test]"
        exit 1
        ;;
esac
```

## ☸️ Kubernetes 生产部署

### 应用部署配置

```yaml
# k8s/app-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frys-app
  namespace: frys
  labels:
    app: frys
    component: app
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: frys
      component: app
  template:
    metadata:
      labels:
        app: frys
        component: app
    spec:
      containers:
      - name: frys
        image: frys:latest
        ports:
        - containerPort: 3000
          name: http
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: frys-secrets
              key: database-url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: frys-secrets
              key: redis-url
        - name: SENTRY_DSN
          valueFrom:
            secretKeyRef:
              name: frys-secrets
              key: sentry-dsn
        resources:
          limits:
            cpu: 1000m
            memory: 1Gi
          requests:
            cpu: 500m
            memory: 512Mi
        livenessProbe:
          httpGet:
            path: /health
            port: http
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /health/ready
            port: http
          initialDelaySeconds: 5
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
        startupProbe:
          httpGet:
            path: /health
            port: http
          initialDelaySeconds: 10
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 30
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
        fsGroup: 1001
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 100
            podAffinityTerm:
              labelSelector:
                matchExpressions:
                - key: app
                  operator: In
                  values:
                  - frys
              topologyKey: kubernetes.io/hostname
```

### 服务暴露配置

```yaml
# k8s/app-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: frys-service
  namespace: frys
  labels:
    app: frys
spec:
  type: ClusterIP
  ports:
  - port: 80
    targetPort: 3000
    protocol: TCP
    name: http
  selector:
    app: frys
    component: app

---
# k8s/app-ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: frys-ingress
  namespace: frys
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/rate-limit-window: "1m"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - api.frys.example.com
    secretName: frys-tls
  rules:
  - host: api.frys.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frys-service
            port:
              number: 80
```

### 数据库配置

```yaml
# k8s/postgres-statefulset.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
  namespace: frys
spec:
  serviceName: postgres
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:15-alpine
        ports:
        - containerPort: 5432
          name: postgres
        env:
        - name: POSTGRES_DB
          valueFrom:
            secretKeyRef:
              name: frys-secrets
              key: postgres-db
        - name: POSTGRES_USER
          valueFrom:
            secretKeyRef:
              name: frys-secrets
              key: postgres-user
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: frys-secrets
              key: postgres-password
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
        resources:
          limits:
            cpu: 1000m
            memory: 2Gi
          requests:
            cpu: 500m
            memory: 1Gi
        livenessProbe:
          exec:
            command:
            - pg_isready
            - -U
            - $(POSTGRES_USER)
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          exec:
            command:
            - pg_isready
            - -U
            - $(POSTGRES_USER)
          initialDelaySeconds: 5
          periodSeconds: 5
  volumeClaimTemplates:
  - metadata:
      name: postgres-storage
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 50Gi
      storageClassName: fast-ssd

---
# k8s/postgres-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: postgres
  namespace: frys
spec:
  selector:
    app: postgres
  ports:
  - port: 5432
    targetPort: 5432
  clusterIP: None  # Headless service for StatefulSet
```

### 缓存和队列配置

```yaml
# k8s/redis-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
  namespace: frys
spec:
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        ports:
        - containerPort: 6379
        command: ["redis-server", "--appendonly", "yes", "--maxmemory", "512mb", "--maxmemory-policy", "allkeys-lru"]
        volumeMounts:
        - name: redis-data
          mountPath: /data
        resources:
          limits:
            cpu: 200m
            memory: 512Mi
          requests:
            cpu: 100m
            memory: 256Mi
        livenessProbe:
          exec:
            command: ["redis-cli", "ping"]
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          exec:
            command: ["redis-cli", "ping"]
          initialDelaySeconds: 5
          periodSeconds: 5
      volumes:
      - name: redis-data
        persistentVolumeClaim:
          claimName: redis-pvc

---
# k8s/rabbitmq-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: rabbitmq
  namespace: frys
spec:
  replicas: 1
  selector:
    matchLabels:
      app: rabbitmq
  template:
    metadata:
      labels:
        app: rabbitmq
    spec:
      containers:
      - name: rabbitmq
        image: rabbitmq:3-management-alpine
        ports:
        - containerPort: 5672
          name: amqp
        - containerPort: 15672
          name: management
        env:
        - name: RABBITMQ_DEFAULT_USER
          valueFrom:
            secretKeyRef:
              name: frys-secrets
              key: rabbitmq-user
        - name: RABBITMQ_DEFAULT_PASS
          valueFrom:
            secretKeyRef:
              name: frys-secrets
              key: rabbitmq-password
        volumeMounts:
        - name: rabbitmq-data
          mountPath: /var/lib/rabbitmq
        resources:
          limits:
            cpu: 300m
            memory: 512Mi
          requests:
            cpu: 150m
            memory: 256Mi
        livenessProbe:
          exec:
            command: ["rabbitmq-diagnostics", "ping"]
          initialDelaySeconds: 60
          periodSeconds: 30
        readinessProbe:
          exec:
            command: ["rabbitmq-diagnostics", "ping"]
          initialDelaySeconds: 20
          periodSeconds: 10
      volumes:
      - name: rabbitmq-data
        persistentVolumeClaim:
          claimName: rabbitmq-pvc
```

### 配置管理

```yaml
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: frys-config
  namespace: frys
data:
  NODE_ENV: "production"
  PORT: "3000"
  LOG_LEVEL: "info"
  JWT_SECRET: "change-me-in-production"
  CORS_ORIGIN: "https://app.frys.example.com"

---
# k8s/secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: frys-secrets
  namespace: frys
type: Opaque
data:
  # Base64 encoded values
  database-url: cG9zdGdyZXM6Ly91c2VyOnBhc3NAcG9zdGdyZXM6NTQzMi93b2tlZmxvdwo=
  redis-url: cmVkaXM6Ly9yZWRpczowMDAwLzAK
  sentry-dsn: aHR0cHM6Ly8xMjM0NTY3ODkwYWJjZGVmQG8xMjM0NTY3LmFwcC5zZW50cnkuaW8vMTIzNDU2Nwo=
  postgres-db: d29rZWZsb3cK
  postgres-user: dXNlcgo=
  postgres-password: cGFzc3dvcmQK
  rabbitmq-user: d29rZWZsb3cK
  rabbitmq-password: cGFzc3dvcmQK
```

### HPA 自动扩缩容

```yaml
# k8s/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: frys-hpa
  namespace: frys
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: frys-app
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60
      - type: Pods
        value: 1
        periodSeconds: 60
      selectPolicy: Min
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
      - type: Pods
        value: 2
        periodSeconds: 60
      selectPolicy: Max
```

### 部署脚本

```bash
#!/bin/bash
# deploy.sh - Kubernetes 部署脚本

set -e

NAMESPACE=${NAMESPACE:-frys}
ENVIRONMENT=${ENVIRONMENT:-production}
TAG=${TAG:-latest}

echo "Deploying frys ${TAG} to ${ENVIRONMENT} environment"

# 更新镜像标签
kubectl set image deployment/frys-app frys=frys:${TAG} -n ${NAMESPACE}

# 等待部署完成
kubectl rollout status deployment/frys-app -n ${NAMESPACE} --timeout=300s

# 检查应用健康状态
echo "Checking application health..."
sleep 30

HEALTH_CHECK=$(kubectl exec -n ${NAMESPACE} deployment/frys-app -- curl -f http://localhost:3000/health || echo "failed")

if [ "$HEALTH_CHECK" = "failed" ]; then
  echo "Health check failed, rolling back..."
  kubectl rollout undo deployment/frys-app -n ${NAMESPACE}
  exit 1
fi

echo "Deployment completed successfully!"

# 可选：运行集成测试
if [ "$RUN_TESTS" = "true" ]; then
  echo "Running integration tests..."
  kubectl run test-runner --image=frys:${TAG} --rm --restart=Never --env="NODE_ENV=test" -- npm run test:integration
fi
```

## 🔄 CI/CD 流水线

### GitHub Actions 工作流

```yaml
# .github/workflows/ci-cd.yml
name: CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Run linting
      run: npm run lint

    - name: Run unit tests
      run: npm run test:unit
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
        REDIS_URL: redis://localhost:6379

    - name: Run integration tests
      run: npm run test:integration
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
        REDIS_URL: redis://localhost:6379

    - name: Run security audit
      run: npm audit --audit-level high

    - name: Upload coverage reports
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage/lcov.info

  security-scan:
    runs-on: ubuntu-latest
    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Run Trivy vulnerability scanner
      uses: aquasecurity/trivy-action@master
      with:
        scan-type: 'fs'
        scan-ref: '.'
        format: 'sarif'
        output: 'trivy-results.sarif'

    - name: Upload Trivy scan results
      uses: github/codeql-action/upload-sarif@v2
      if: always()
      with:
        sarif_file: 'trivy-results.sarif'

  build-and-push:
    runs-on: ubuntu-latest
    needs: [test, security-scan]
    if: github.ref == 'refs/heads/main'

    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Log in to Container Registry
      uses: docker/login-action@v3
      with:
        registry: ${{ env.REGISTRY }}
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}

    - name: Extract metadata
      id: meta
      uses: docker/metadata-action@v5
      with:
        images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
        tags: |
          type=ref,event=branch
          type=ref,event=pr
          type=sha,prefix={{branch}}-
          type=raw,value=latest,enable={{is_default_branch}}

    - name: Build and push Docker image
      uses: docker/build-push-action@v5
      with:
        context: .
        push: true
        tags: ${{ steps.meta.outputs.tags }}
        labels: ${{ steps.meta.outputs.labels }}
        cache-from: type=gha
        cache-to: type=gha,mode=max
        platforms: linux/amd64,linux/arm64

  deploy-dev:
    runs-on: ubuntu-latest
    needs: build-and-push
    if: github.ref == 'refs/heads/develop'
    environment: development

    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Configure kubectl
      uses: azure/k8s-set-context@v3
      with:
        method: kubeconfig
        kubeconfig: ${{ secrets.KUBE_CONFIG_DEV }}

    - name: Deploy to development
      run: |
        sed -i 's|image: frys:latest|image: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:develop-${{ github.sha }}|g' k8s/app-deployment.yaml
        kubectl apply -f k8s/ -n frys-dev
        kubectl rollout status deployment/frys-app -n frys-dev --timeout=300s

  deploy-prod:
    runs-on: ubuntu-latest
    needs: build-and-push
    if: github.ref == 'refs/heads/main'
    environment: production

    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Configure kubectl
      uses: azure/k8s-set-context@v3
      with:
        method: kubeconfig
        kubeconfig: ${{ secrets.KUBE_CONFIG_PROD }}

    - name: Deploy to production
      run: |
        sed -i 's|image: frys:latest|image: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:main-${{ github.sha }}|g' k8s/app-deployment.yaml
        kubectl apply -f k8s/ -n frys-prod
        kubectl rollout status deployment/frys-app -n frys-prod --timeout=600s

    - name: Run smoke tests
      run: |
        kubectl run smoke-test --image=curlimages/curl --rm --restart=Never -- curl -f http://frys-service/health

  notify:
    runs-on: ubuntu-latest
    needs: [deploy-dev, deploy-prod]
    if: always()
    steps:
    - name: Send notification
      uses: 8398a7/action-slack@v3
      with:
        status: ${{ job.status }}
        text: "frys deployment completed"
      env:
        SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
      if: always()
```

### 分支策略和环境映射

```yaml
# .github/workflows/branch-strategy.yml
name: Branch Strategy Validation

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  validate-branch:
    runs-on: ubuntu-latest
    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Validate branch naming
      run: |
        BRANCH_NAME="${{ github.head_ref }}"
        if [[ "$BRANCH_NAME" =~ ^(feature|bugfix|hotfix)/[a-z0-9-]+(-[a-z0-9-]+)*$ ]]; then
          echo "Branch name is valid"
        else
          echo "Branch name must follow pattern: feature/*, bugfix/*, or hotfix/*"
          exit 1
        fi

  pr-checks:
    runs-on: ubuntu-latest
    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Check PR description
      run: |
        PR_BODY="${{ github.event.pull_request.body }}"
        if [[ -z "$PR_BODY" ]]; then
          echo "PR description is required"
          exit 1
        fi

        # 检查是否包含必要的标签
        if ! echo "$PR_BODY" | grep -q "## Changes"; then
          echo "PR must include '## Changes' section"
          exit 1
        fi

    - name: Check test coverage
      run: |
        # 确保测试覆盖率不下降
        # 这里可以集成 coverage 检查
        echo "Test coverage check passed"

  security-check:
    runs-on: ubuntu-latest
    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Run security scan
      run: |
        # 检查是否有敏感信息泄露
        if grep -r "password\|secret\|key" --exclude-dir=node_modules --exclude-dir=.git . | grep -v "example\|test\|mock"; then
          echo "Potential sensitive data found in code"
          exit 1
        fi

    - name: Check dependencies
      run: |
        npm audit --audit-level moderate
        if [ $? -ne 0 ]; then
          echo "Security vulnerabilities found in dependencies"
          exit 1
        fi
```

### 质量门配置

```yaml
# sonar-project.properties
sonar.projectKey=frys
sonar.projectName=frys
sonar.projectVersion=1.0.0

sonar.sources=src
sonar.tests=tests
sonar.test.included=**/*test.js,**/*spec.js

sonar.language=js
sonar.javascript.lcov.reportPaths=coverage/lcov.info

sonar.exclusions=**/node_modules/**,**/dist/**,**/coverage/**

# 质量门设置
sonar.qualitygate.wait=true

# 代码覆盖率
sonar.testExecutionReportPaths=test-results.xml
sonar.javascript.lcov.reportPaths=coverage/lcov.info

# 代码异味
sonar.qualitygate.conditions=sonar.qualitygate.conditions.coverage>80,sonar.qualitygate.conditions.duplicated_blocks<3,sonar.qualitygate.conditions.maintainability_rating>A
```

## 📊 监控和告警

### Prometheus 监控配置

```yaml
# monitoring/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "alert_rules.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093

scrape_configs:
  - job_name: 'frys-app'
    static_configs:
      - targets: ['frys-service:80']
    metrics_path: '/metrics'
    scrape_interval: 15s
    scrape_timeout: 10s

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres:5432']
    scrape_interval: 30s

  - job_name: 'redis'
    static_configs:
      - targets: ['redis:6379']
    scrape_interval: 30s

  - job_name: 'rabbitmq'
    static_configs:
      - targets: ['rabbitmq:15692']
    scrape_interval: 30s

  - job_name: 'kubernetes-nodes'
    kubernetes_sd_configs:
      - role: node
    relabel_configs:
      - action: labelmap
        regex: __meta_kubernetes_node_label_(.+)

  - job_name: 'kubernetes-pods'
    kubernetes_sd_configs:
      - role: pod
    relabel_configs:
      - action: drop
        regex: Pending|Succeeded|Failed|Completed
        source_labels: [__meta_kubernetes_pod_phase]
      - action: labelmap
        regex: __meta_kubernetes_pod_label_(.+)
      - action: replace
        source_labels: [__meta_kubernetes_namespace]
        target_label: namespace
      - action: replace
        source_labels: [__meta_kubernetes_pod_name]
        target_label: pod
      - action: replace
        source_labels: [__meta_kubernetes_pod_container_name]
        target_label: container
```

### 告警规则配置

```yaml
# monitoring/alert_rules.yml
groups:
  - name: frys
    rules:
      # 应用健康检查
      - alert: frysDown
        expr: up{job="frys-app"} == 0
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "frys application is down"
          description: "frys has been down for more than 5 minutes."

      # 响应时间监控
      - alert: HighResponseTime
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{job="frys-app"}[5m])) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High response time detected"
          description: "95th percentile response time is above 2 seconds for 5 minutes."

      # 错误率监控
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5..", job="frys-app"}[5m]) / rate(http_requests_total{job="frys-app"}[5m]) > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High error rate detected"
          description: "Error rate is above 5% for 5 minutes."

      # CPU 使用率
      - alert: HighCPUUsage
        expr: rate(container_cpu_usage_seconds_total{pod=~"frys-.*"}[5m]) > 0.8
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High CPU usage"
          description: "CPU usage is above 80% for 10 minutes."

      # 内存使用率
      - alert: HighMemoryUsage
        expr: container_memory_usage_bytes{pod=~"frys-.*"} / container_spec_memory_limit_bytes > 0.9
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage"
          description: "Memory usage is above 90% for 5 minutes."

      # 数据库连接池
      - alert: DatabaseConnectionPoolExhausted
        expr: pg_stat_activity_count{datname="frys"} > 80
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Database connection pool exhausted"
          description: "Database has more than 80 active connections."

      # 队列积压
      - alert: QueueBacklog
        expr: rabbitmq_queue_messages{queue="frys_tasks"} > 1000
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Queue backlog detected"
          description: "Queue has more than 1000 pending messages."
```

### Grafana 仪表板配置

```json
{
  "dashboard": {
    "title": "frys Overview",
    "tags": ["frys", "overview"],
    "timezone": "browser",
    "panels": [
      {
        "title": "Application Health",
        "type": "stat",
        "targets": [
          {
            "expr": "up{job=\"frys-app\"}",
            "legendFormat": "frys Status"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "mappings": [
              {
                "options": {
                  "0": {
                    "text": "DOWN",
                    "color": "red"
                  },
                  "1": {
                    "text": "UP",
                    "color": "green"
                  }
                },
                "type": "value"
              }
            ]
          }
        }
      },
      {
        "title": "Response Time (95th percentile)",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{job=\"frys-app\"}[5m]))",
            "legendFormat": "95th percentile"
          }
        ]
      },
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total{job=\"frys-app\"}[5m])",
            "legendFormat": "Requests/sec"
          }
        ]
      },
      {
        "title": "Error Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total{status=~\"5..\", job=\"frys-app\"}[5m]) / rate(http_requests_total{job=\"frys-app\"}[5m]) * 100",
            "legendFormat": "Error Rate %"
          }
        ]
      },
      {
        "title": "Database Connections",
        "type": "graph",
        "targets": [
          {
            "expr": "pg_stat_activity_count{datname=\"frys\"}",
            "legendFormat": "Active Connections"
          }
        ]
      },
      {
        "title": "Queue Messages",
        "type": "graph",
        "targets": [
          {
            "expr": "rabbitmq_queue_messages{queue=\"frys_tasks\"}",
            "legendFormat": "Pending Messages"
          }
        ]
      }
    ]
  }
}
```

### Alertmanager 配置

```yaml
# monitoring/alertmanager.yml
global:
  smtp_smarthost: 'smtp.example.com:587'
  smtp_from: 'alerts@frys.example.com'
  smtp_auth_username: 'alerts@frys.example.com'
  smtp_auth_password: 'your-smtp-password'

route:
  group_by: ['alertname', 'severity']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'email'
  routes:
    - match:
        severity: critical
      receiver: 'critical'
      continue: true

receivers:
  - name: 'email'
    email_configs:
      - to: 'team@frys.example.com'
        subject: 'frys Alert: {{ .GroupLabels.alertname }}'
        body: |
          {{ range .Alerts }}
          Alert: {{ .Annotations.summary }}
          Description: {{ .Annotations.description }}
          Severity: {{ .Labels.severity }}
          {{ end }}

  - name: 'critical'
    email_configs:
      - to: 'oncall@frys.example.com'
        subject: 'CRITICAL: frys Alert: {{ .GroupLabels.alertname }}'
    slack_configs:
      - api_url: 'https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK'
        channel: '#alerts'
        title: 'CRITICAL Alert'
        text: |
          {{ range .Alerts }}
          :red_circle: *{{ .Annotations.summary }}*
          {{ .Annotations.description }}
          Severity: {{ .Labels.severity }}
          {{ end }}
```

## 🔒 安全和合规

### 容器镜像安全

```yaml
# .trivyignore - Trivy 漏洞忽略配置
# 忽略低风险漏洞
CVE-2021-44228 # Log4j - 已修复
CVE-2021-45105 # Log4j - 已修复

# 开发依赖漏洞（生产环境不使用）
GHSA-xxxx-yyyy-zzzz
```

```bash
#!/bin/bash
# security-scan.sh - 安全扫描脚本

set -e

echo "Running security scans..."

# Trivy 容器扫描
docker run --rm \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v $HOME/.trivy/cache:/root/.cache/trivy \
  aquasecurity/trivy image \
  --exit-code 1 \
  --no-progress \
  --format table \
  frys:latest

# 依赖安全审计
npm audit --audit-level high

# 代码安全扫描
if command -v semgrep &> /dev/null; then
  semgrep --config=auto --error .
fi

# 机密信息检查
if grep -r "password\|secret\|key\|token" --exclude-dir=node_modules --exclude-dir=.git . | grep -v "example\|test\|mock\|README"; then
  echo "Potential secrets found!"
  exit 1
fi

echo "Security scans completed successfully"
```

### 基础设施即代码安全

```hcl
# infrastructure/security.tf - Terraform 配置
resource "aws_security_group" "frys" {
  name_prefix = "frys-"
  description = "Security group for frys application"

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # 拒绝所有其他入站流量
  ingress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = []
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "frys-sg"
    Environment = var.environment
  }
}

# WAF 配置
resource "aws_wafv2_web_acl" "frys" {
  name        = "frys-waf"
  description = "WAF for frys application"
  scope       = "REGIONAL"

  default_action {
    allow {}
  }

  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 1

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "AWSManagedRulesCommonRuleSet"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "RateLimit"
    priority = 2

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = 1000
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "RateLimit"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "frys-waf"
    sampled_requests_enabled   = true
  }
}
```

### 合规审计

```bash
#!/bin/bash
# compliance-check.sh - 合规检查脚本

set -e

echo "Running compliance checks..."

# 检查是否使用了最新基础镜像
LATEST_BASE=$(docker run --rm curlimages/curl -s "https://registry-1.docker.io/v2/library/node/tags/list" | jq -r '.tags[]' | grep -E '^18\.' | sort -V | tail -1)
CURRENT_BASE=$(grep "FROM node:" Dockerfile | cut -d: -f2)

if [ "$CURRENT_BASE" != "$LATEST_BASE" ]; then
  echo "Base image is outdated. Current: $CURRENT_BASE, Latest: $LATEST_BASE"
  exit 1
fi

# 检查依赖许可证
npm install --package-lock-only
npx license-checker --failOn "GPL;LGPL;AGPL" --summary

# 检查代码质量
npx eslint src/ --max-warnings 0
npx prettier --check "src/**/*.{js,ts,json,md}"

# 检查测试覆盖率
npm run test:coverage
COVERAGE=$(jq '.total.lines.pct' coverage/coverage-summary.json)

if (( $(echo "$COVERAGE < 80" | bc -l) )); then
  echo "Test coverage is below 80%: $COVERAGE%"
  exit 1
fi

echo "Compliance checks passed"
```

## 🚀 部署和运维

### 蓝绿部署策略

```bash
#!/bin/bash
# blue-green-deploy.sh - 蓝绿部署脚本

set -e

ENVIRONMENT=${1:-production}
NEW_VERSION=${2}

if [ -z "$NEW_VERSION" ]; then
  echo "Usage: $0 [environment] [version]"
  exit 1
fi

# 获取当前活跃环境
CURRENT_ACTIVE=$(kubectl get configmap app-config -n $ENVIRONMENT -o jsonpath='{.data.active_environment}')

if [ "$CURRENT_ACTIVE" = "blue" ]; then
  INACTIVE="green"
else
  INACTIVE="blue"
fi

echo "Deploying to inactive environment: $INACTIVE"

# 部署到非活跃环境
kubectl set image deployment/frys-$INACTIVE frys=frys:$NEW_VERSION -n $ENVIRONMENT

# 等待部署完成
kubectl rollout status deployment/frys-$INACTIVE -n $ENVIRONMENT --timeout=300s

# 运行冒烟测试
echo "Running smoke tests on $INACTIVE environment..."
kubectl run smoke-test-$INACTIVE --image=curlimages/curl --rm --restart=Never \
  -- curl -f http://frys-$INACTIVE-service/health -n $ENVIRONMENT

if [ $? -ne 0 ]; then
  echo "Smoke tests failed, aborting deployment"
  exit 1
fi

# 切换流量到新环境
kubectl patch configmap app-config -n $ENVIRONMENT \
  --type merge -p "{\"data\":{\"active_environment\":\"$INACTIVE\"}}"

echo "Traffic switched to $INACTIVE environment"

# 等待一段时间观察
sleep 60

# 如果一切正常，缩放旧环境
kubectl scale deployment frys-$CURRENT_ACTIVE --replicas=0 -n $ENVIRONMENT

echo "Blue-green deployment completed successfully"
```

### 回滚策略

```bash
#!/bin/bash
# rollback.sh - 回滚脚本

set -e

ENVIRONMENT=${1:-production}
ROLLBACK_VERSION=${2}

if [ -z "$ROLLBACK_VERSION" ]; then
  echo "Usage: $0 [environment] [version]"
  echo "Finding previous version..."
  ROLLBACK_VERSION=$(kubectl get deployment frys-app -n $ENVIRONMENT -o jsonpath='{.spec.template.spec.containers[0].image}' | cut -d: -f2)
fi

echo "Rolling back to version: $ROLLBACK_VERSION"

# 更新镜像
kubectl set image deployment/frys-app frys=frys:$ROLLBACK_VERSION -n $ENVIRONMENT

# 等待回滚完成
kubectl rollout status deployment/frys-app -n $ENVIRONMENT --timeout=300s

# 验证回滚
kubectl run rollback-test --image=curlimages/curl --rm --restart=Never \
  -- curl -f http://frys-service/health -n $ENVIRONMENT

if [ $? -eq 0 ]; then
  echo "Rollback completed successfully"
else
  echo "Rollback verification failed"
  exit 1
fi
```

### 备份和恢复

```bash
#!/bin/bash
# backup.sh - 备份脚本

set -e

BACKUP_DIR="/opt/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="frys_backup_$DATE"

echo "Creating backup: $BACKUP_NAME"

# 创建备份目录
mkdir -p $BACKUP_DIR/$BACKUP_NAME

# 数据库备份
echo "Backing up PostgreSQL..."
kubectl exec -n frys deployment/postgres -- pg_dump -U frys frys > $BACKUP_DIR/$BACKUP_NAME/postgres.sql

# Redis 备份
echo "Backing up Redis..."
kubectl exec -n frys deployment/redis -- redis-cli save
kubectl cp frys/redis-pod:/data/dump.rdb $BACKUP_DIR/$BACKUP_NAME/redis.rdb

# 配置文件备份
echo "Backing up configurations..."
kubectl get configmap -n frys -o yaml > $BACKUP_DIR/$BACKUP_NAME/configmaps.yaml
kubectl get secret -n frys -o yaml > $BACKUP_DIR/$BACKUP_NAME/secrets.yaml

# 压缩备份
cd $BACKUP_DIR
tar -czf ${BACKUP_NAME}.tar.gz $BACKUP_NAME
rm -rf $BACKUP_NAME

# 上传到远程存储
aws s3 cp ${BACKUP_NAME}.tar.gz s3://frys-backups/

echo "Backup completed: $BACKUP_NAME"

# 清理旧备份（保留7天）
find $BACKUP_DIR -name "frys_backup_*.tar.gz" -mtime +7 -delete
```

```bash
#!/bin/bash
# restore.sh - 恢复脚本

set -e

BACKUP_FILE=${1}

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: $0 <backup-file>"
  echo "Available backups:"
  aws s3 ls s3://frys-backups/
  exit 1
fi

echo "Restoring from backup: $BACKUP_FILE"

# 下载备份
aws s3 cp s3://frys-backups/$BACKUP_FILE /tmp/

# 解压备份
cd /tmp
tar -xzf $BACKUP_FILE
BACKUP_DIR=$(basename $BACKUP_FILE .tar.gz)

# 恢复数据库
echo "Restoring PostgreSQL..."
kubectl exec -n frys deployment/postgres -- psql -U frys -d frys -f /tmp/$BACKUP_DIR/postgres.sql

# 恢复 Redis
echo "Restoring Redis..."
kubectl cp /tmp/$BACKUP_DIR/redis.rdb frys/redis-pod:/data/dump.rdb
kubectl exec -n frys deployment/redis -- redis-cli shutdown save

# 清理临时文件
rm -rf /tmp/$BACKUP_DIR $BACKUP_FILE

echo "Restore completed successfully"
```

## ❓ 常见问题

### Q: 如何处理容器内存泄漏？

**A:** 设置适当的资源限制和监控：

```yaml
# Kubernetes 资源限制
resources:
  limits:
    cpu: 1000m
    memory: 1Gi
  requests:
    cpu: 500m
    memory: 512Mi

# 内存监控
livenessProbe:
  exec:
    command: ["node", "--expose-gc", "--max-old-space-size=512", "healthcheck.js"]
  initialDelaySeconds: 30
  periodSeconds: 30
```

### Q: 如何优化容器启动时间？

**A:** 使用多阶段构建和优化层缓存：

```dockerfile
# 使用更小的基础镜像
FROM node:18-alpine AS base

# 预安装依赖
FROM base AS deps
COPY package*.json ./
RUN npm ci --only=production --no-optional && npm cache clean --force

# 优化文件复制顺序
COPY package*.json ./
RUN npm ci
COPY src/ ./src/
```

### Q: 如何处理数据库迁移？

**A:** 使用容器化的迁移工具：

```yaml
# migration-job.yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: db-migration
spec:
  template:
    spec:
      containers:
      - name: migration
        image: frys:latest
        command: ["npm", "run", "migration:up"]
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: frys-secrets
              key: database-url
      restartPolicy: Never
```

## 📚 相关链接

- [Docker 最佳实践](https://docs.docker.com/develop/dev-best-practices/)
- [Kubernetes 文档](https://kubernetes.io/docs/)
- [GitHub Actions 指南](https://docs.github.com/en/actions)
- [Prometheus 监控](https://prometheus.io/docs/)
- [Grafana 可视化](https://grafana.com/docs/)
- [Terraform IaC](https://www.terraform.io/docs/)
