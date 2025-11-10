# 🔨 多架构部署指南

frys 支持多架构容器化部署，可以在不同的 CPU 架构上运行，包括 x86_64、ARM64 和 ARMv7。

## 🏗️ 支持的架构

- **linux/amd64** - 英特尔/AMD 64位处理器
- **linux/arm64** - ARM 64位处理器 (Apple M1/M2, AWS Graviton, 等)
- **linux/arm/v7** - ARM 32位处理器 (树莓派、旧版ARM设备)

## 🚀 快速开始

### 使用 Docker Compose

```bash
# 1. 构建多架构镜像
pnpm run build:multiarch

# 2. 启动服务
docker-compose -f config/docker/docker-compose.multiarch.yml up -d

# 3. 查看服务状态
docker-compose -f config/docker/docker-compose.multiarch.yml ps
```

### 使用 Docker 直接构建

```bash
# 构建多架构镜像
docker buildx build \
  --platform linux/amd64,linux/arm64,linux/arm/v7 \
  --file config/docker/Dockerfile.multiarch \
  --tag frys:latest \
  --push \
  .
```

## 📋 环境变量

### 构建时变量

| 变量         | 描述           | 默认值                                 |
| ------------ | -------------- | -------------------------------------- |
| `VERSION`    | 镜像版本标签   | `latest`                               |
| `PLATFORMS`  | 目标平台       | `linux/amd64,linux/arm64,linux/arm/v7` |
| `PUSH_IMAGE` | 是否推送镜像   | `true`                                 |
| `LOAD_IMAGE` | 是否加载到本地 | `false`                                |

### 运行时变量

| 变量           | 描述          | 默认值               |
| -------------- | ------------- | -------------------- |
| `NODE_ENV`     | Node.js 环境  | `production`         |
| `PORT`         | 服务端口      | `3000`               |
| `DATABASE_URL` | 数据库连接URL | -                    |
| `REDIS_URL`    | Redis 连接URL | `redis://redis:6380` |
| `JWT_SECRET`   | JWT 密钥      | -                    |

## 🏭 生产部署

### 1. 构建多架构镜像

```bash
# 使用 GitHub Actions (推荐)
# 推送代码到 main 分支，自动触发多架构构建

# 或手动构建
export REGISTRY=ghcr.io
export REPOSITORY=your-org/frys
export VERSION=v1.0.0

pnpm run build:multiarch
```

### 2. 部署到 Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frys
spec:
  replicas: 3
  selector:
    matchLabels:
      app: frys
  template:
    metadata:
      labels:
        app: frys
    spec:
      containers:
        - name: frys
          image: ghcr.io/your-org/frys:latest
          ports:
            - containerPort: 3000
          env:
            - name: NODE_ENV
              value: 'production'
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: frys-secrets
                  key: database-url
          resources:
            limits:
              cpu: '2'
              memory: '2Gi'
            requests:
              cpu: '0.5'
              memory: '512Mi'
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: frys-service
spec:
  selector:
    app: frys
  ports:
    - port: 80
      targetPort: 3000
  type: LoadBalancer
```

### 3. 使用 Docker Swarm

```bash
# 部署到 Swarm 集群
docker stack deploy -c config/docker/docker-compose.multiarch.yml frys
```

## 🔧 开发环境

### 本地多架构测试

```bash
# 使用 QEMU 模拟其他架构
docker run --rm --privileged multiarch/qemu-user-static --reset -p yes

# 构建并运行 ARM64 版本
docker buildx build \
  --platform linux/arm64 \
  --file config/docker/Dockerfile.multiarch \
  --tag frys:arm64 \
  --load \
  .

docker run --rm -p 3000:3000 frys:arm64
```

### 开发构建

```bash
# 快速本地构建
pnpm run docker:build

# 运行开发环境
docker-compose -f config/docker/docker-compose.multiarch.yml -f config/docker/docker-compose.dev.yml up
```

## 📊 监控和日志

### 健康检查

```bash
# 检查服务健康状态
curl http://localhost:3000/health

# 查看容器日志
docker-compose -f config/docker/docker-compose.multiarch.yml logs -f frys
```

### 性能监控

多架构部署包含内置的性能监控：

- **Prometheus** - 指标收集
- **Grafana** - 可视化面板
- **Node Exporter** - 系统监控
- **AlertManager** - 告警管理

访问地址：

- Grafana: http://localhost:3002 (admin/admin)
- Prometheus: http://localhost:9090

## 🔒 安全考虑

### 镜像安全

```bash
# 运行安全扫描
trivy image ghcr.io/your-org/frys:latest

# 检查漏洞
docker scan ghcr.io/your-org/frys:latest
```

### 密钥管理

```bash
# 使用 Docker Secrets
echo "your-secret-key" | docker secret create jwt_secret -

# 或环境变量文件
# .env.prod
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret
REDIS_PASSWORD=redis-pass
```

## 🚀 CI/CD 集成

### GitHub Actions

项目包含自动化的多架构构建工作流：

```yaml
# .github/workflows/multiarch-build.yml
name: 🔨 多架构构建
on:
  push:
    branches: [main]
    tags: ['v*']

jobs:
  build-multiarch:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: 🏗️ 构建并推送多架构镜像
        uses: docker/build-push-action@v5
        with:
          platforms: linux/amd64,linux/arm64,linux/arm/v7
          push: true
          tags: ghcr.io/${{ github.repository }}:latest
```

### Jenkins 流水线

```groovy
pipeline {
    agent any
    stages {
        stage('Build Multiarch') {
            steps {
                script {
                    docker.buildx.build(
                        file: 'config/docker/Dockerfile.multiarch',
                        platforms: ['linux/amd64', 'linux/arm64', 'linux/arm/v7'],
                        push: true,
                        tags: ['ghcr.io/your-org/frys:latest']
                    )
                }
            }
        }
    }
}
```

## 🐛 故障排除

### 常见问题

#### 1. Buildx 不可用

```bash
# 启用 Docker Buildx
export DOCKER_BUILDKIT=1
docker buildx create --use
```

#### 2. 平台不支持

```bash
# 检查支持的平台
docker buildx inspect --bootstrap

# 安装 QEMU 模拟器
docker run --rm --privileged multiarch/qemu-user-static --reset -p yes
```

#### 3. 内存不足

```bash
# 增加 Docker 内存限制
# Docker Desktop: 设置 > 资源 > 高级 > 内存
```

#### 4. 网络问题

```bash
# 检查网络配置
docker network ls
docker network inspect frys-network
```

## 📈 性能优化

### 镜像优化

- **多阶段构建** - 减小最终镜像大小
- **层缓存** - 利用 BuildKit 缓存
- **压缩传输** - 使用 gzip 压缩层数据

### 运行时优化

```yaml
# Kubernetes 资源配置
resources:
  limits:
    cpu: '2'
    memory: '2Gi'
  requests:
    cpu: '0.5'
    memory: '512Mi'
```

### 架构选择

| 架构   | 优势                 | 适用场景            |
| ------ | -------------------- | ------------------- |
| amd64  | 最高性能，最好兼容性 | 云服务器，桌面环境  |
| arm64  | 能效比高，成本低     | 边缘计算，移动设备  |
| arm/v7 | 低功耗，广泛支持     | IoT设备，嵌入式系统 |

## 📚 参考资料

- [Docker Buildx](https://docs.docker.com/engine/reference/commandline/buildx/)
- [BuildKit](https://github.com/moby/buildkit)
- [Multi-arch Images](https://docs.docker.com/desktop/multi-arch/)
- [Kubernetes Multi-arch](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/#pod-template)
