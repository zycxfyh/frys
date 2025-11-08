# 📁 配置文件详解

<div align="center">

## ⚙️ frys 项目配置管理

**Docker、Nginx、测试等配置文件的详细说明和最佳实践**

[🏠 返回项目主页](../../README.md) • [📖 文档导航](../README.md) • [🚀 快速开始](../../GETTING_STARTED.md)

---

</div>

## 📋 概述

frys 项目包含多个配置文件，用于不同环境和场景的部署和管理。本文档详细介绍各配置文件的用途、配置方法和最佳实践。

## 🐳 Docker 配置

### Dockerfile

```dockerfile
# config/docker/Dockerfile
# 多阶段构建，优化镜像大小

# 构建阶段
FROM node:18-alpine AS builder

WORKDIR /app

# 复制依赖文件
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# 生产阶段
FROM node:18-alpine AS production

# 安装 dumb-init 用于信号处理
RUN apk add --no-cache dumb-init

# 创建非root用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S appuser -u 1001

WORKDIR /app

# 从构建阶段复制依赖
COPY --from=builder /app/node_modules ./node_modules

# 复制应用代码
COPY --chown=appuser:nodejs . .

# 切换到非root用户
USER appuser

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

EXPOSE 3000

# 使用 dumb-init 启动应用
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/index.js"]
```

#### Dockerfile 优化技巧

```dockerfile
# 1. 使用多阶段构建
FROM node:18-alpine AS deps
# 安装依赖阶段

FROM node:18-alpine AS builder
# 构建应用阶段

FROM node:18-alpine AS production
# 生产镜像

# 2. 层缓存优化
COPY package*.json ./
RUN npm ci --only=production
# 依赖变化时才重新安装

COPY . .
# 复制源码

# 3. 非root用户运行
RUN adduser -D appuser
USER appuser

# 4. 健康检查
HEALTHCHECK CMD curl -f http://localhost:3000/health || exit 1

# 5. 信号处理
RUN apk add --no-cache dumb-init
ENTRYPOINT ["dumb-init", "--"]
```

### Docker Compose 配置

#### 开发环境配置

```yaml
# config/docker/docker-compose.dev.yml
version: '3.8'

services:
  frys:
    build:
      context: ../..
      dockerfile: config/docker/Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - DEBUG=frys:*
    volumes:
      - ../..:/app
      - /app/node_modules
    depends_on:
      - redis
      - postgres
    networks:
      - frys-dev

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    networks:
      - frys-dev

  postgres:
    image: postgres:15-alpine
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_DB=frys_dev
      - POSTGRES_USER=frys
      - POSTGRES_PASSWORD=dev_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - frys-dev

volumes:
  redis_data:
  postgres_data:

networks:
  frys-dev:
    driver: bridge
```

#### 生产环境配置

```yaml
# config/docker/docker-compose.prod.yml
version: '3.8'

services:
  frys:
    image: frys:latest
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    env_file:
      - ../../.env.production
    depends_on:
      - redis
      - postgres
    restart: unless-stopped
    networks:
      - frys-prod

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    networks:
      - frys-prod

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=frys_prod
      - POSTGRES_USER=${DB_USER}
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - frys-prod

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ../../config/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ../../ssl:/etc/ssl:ro
    depends_on:
      - frys
    networks:
      - frys-prod

volumes:
  redis_data:
    driver: local
  postgres_data:
    driver: local

networks:
  frys-prod:
    driver: bridge
```

#### 测试环境配置

```yaml
# config/docker/docker-compose.test.yml
version: '3.8'

services:
  frys-test:
    build:
      context: ../..
      dockerfile: config/docker/Dockerfile
    environment:
      - NODE_ENV=test
      - DB_HOST=test-db
    depends_on:
      - test-db
      - test-redis
    networks:
      - frys-test

  test-db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=frys_test
      - POSTGRES_USER=test
      - POSTGRES_PASSWORD=test
    tmpfs:
      - /var/lib/postgresql/data
    networks:
      - frys-test

  test-redis:
    image: redis:7-alpine
    tmpfs:
      - /data
    networks:
      - frys-test

networks:
  frys-test:
    driver: bridge
```

## 🌐 Nginx 配置

### 基础反向代理配置

```nginx
# config/nginx/nginx.conf
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # 日志格式
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;
    error_log /var/log/nginx/error.log;

    # 基本设置
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    # Gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/javascript
        application/json
        application/xml+rss;

    # 速率限制
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=auth:10m rate=3r/s;

    upstream frys_backend {
        server frys:3000;
    }

    server {
        listen 80;
        server_name localhost;

        # 静态文件缓存
        location /static/ {
            alias /app/web/;
            expires 1y;
            add_header Cache-Control "public, immutable";
        }

        # API 代理
        location /api/ {
            limit_req zone=api burst=20 nodelay;

            proxy_pass http://frys_backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;

            # 超时设置
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }

        # WebSocket 支持
        location /ws/ {
            proxy_pass http://frys_backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # 健康检查
        location /health {
            proxy_pass http://frys_backend;
            access_log off;
        }

        # 前端路由回退
        location / {
            try_files $uri $uri/ /index.html;
            root /app/web;
            index index.html;
        }

        # 错误页面
        error_page 502 503 504 /50x.html;
        location = /50x.html {
            root /usr/share/nginx/html;
        }
    }
}
```

### HTTPS 配置

```nginx
# HTTPS 配置
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    # SSL 证书
    ssl_certificate /etc/ssl/certs/yourdomain.com.crt;
    ssl_certificate_key /etc/ssl/private/yourdomain.com.key;

    # SSL 安全配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # HSTS
    add_header Strict-Transport-Security "max-age=63072000" always;

    # 其余配置与 HTTP 相同
    location /api/ {
        # API 配置
    }

    location / {
        # 前端配置
    }
}

# HTTP 重定向到 HTTPS
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

### 负载均衡配置

```nginx
# 负载均衡配置
upstream frys_cluster {
    least_conn;  # 最少连接策略

    server frys-01:3000 weight=3;
    server frys-02:3000 weight=3;
    server frys-03:3000 weight=1;  # 备份服务器

    # 健康检查
    check interval=3000 rise=2 fall=5 timeout=1000 type=http;
    check_http_send "GET /health HTTP/1.0\r\n\r\n";
    check_http_expect_alive http_2xx http_3xx;
}

server {
    location /api/ {
        proxy_pass http://frys_cluster;

        # 会话粘性 (如果需要)
        # ip_hash;

        # 故障转移
        proxy_next_upstream error timeout invalid_header http_500 http_502 http_503 http_504;
        proxy_next_upstream_tries 3;
        proxy_next_upstream_timeout 30s;
    }
}
```

## 🧪 测试配置

### Vitest 配置

```javascript
// config/test/vitest.config.js
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  // 测试环境
  test: {
    environment: 'node',
    globals: true,  // 启用全局测试函数

    // 测试文件匹配
    include: [
      'tests/unit/**/*.{test,spec}.{js,mjs}',
      'tests/integration/**/*.{test,spec}.{js,mjs}'
    ],
    exclude: [
      'node_modules/**',
      'dist/**',
      'coverage/**'
    ],

    // 覆盖率配置
    coverage: {
      provider: 'istanbul',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'tests/',
        'config/',
        'scripts/',
        '**/*.config.js',
        '**/*.test.js',
        '**/*.spec.js'
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    },

    // 测试超时
    testTimeout: 10000,
    hookTimeout: 5000,

    // 并发执行
    maxConcurrency: 5,
    maxThreads: 2,

    // 快照
    snapshotSerializers: [],

    // 全局设置
    setupFiles: ['./tests/setup.js'],

    // 别名配置
    alias: {
      '@': path.resolve(__dirname, '../../src'),
      '~': path.resolve(__dirname, '../../')
    }
  },

  // 路径解析
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../../src'),
      '~': path.resolve(__dirname, '../../')
    }
  }
});
```

### Playwright 配置

```javascript
// config/test/playwright.config.js
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // 测试发现
  testDir: './tests/e2e-ui',
  testMatch: '**/*.spec.js',

  // 并行执行
  fullyParallel: true,
  workers: process.env.CI ? 1 : undefined,

  // 重试配置
  retries: process.env.CI ? 2 : 0,

  // 报告配置
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results.json' }],
    ['junit', { outputFile: 'test-results.xml' }]
  ],

  // 共享设置
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },

  // 项目配置
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      use: devices['Pixel 5'],
    },
    {
      name: 'Mobile Safari',
      use: devices['iPhone 12'],
    },
  ],

  // WebServer 配置 (自动启动开发服务器)
  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },

  // 全局设置
  globalSetup: require.resolve('./tests/global-setup.js'),
  globalTeardown: require.resolve('./tests/global-teardown.js'),
});
```

### 测试环境变量

```bash
# config/env/test.env
# 测试环境配置

# 应用配置
NODE_ENV=test
PORT=3001
HOST=localhost

# 数据库配置 (测试专用)
DATABASE_URL=postgresql://test:test@localhost:5433/frys_test
DB_SSL=false
DB_MAX_CONNECTIONS=10

# Redis 配置 (测试专用)
REDIS_URL=redis://localhost:6380
REDIS_DB=1

# JWT 配置 (测试密钥)
JWT_SECRET=test-jwt-secret-key-for-testing-only
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=24h

# 日志配置
LOG_LEVEL=error
LOG_FILE=./logs/frys-test.log

# 测试配置
TEST_TIMEOUT=30000
TEST_PARALLEL_WORKERS=4
COVERAGE_THRESHOLD=80

# 外部服务 (Mock 或测试实例)
AI_PROVIDER_BASE_URL=http://localhost:4000
EMAIL_SERVICE_URL=http://localhost:5000
```

## 🔧 构建配置

### 构建脚本

```javascript
// scripts/build/build.js
#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * 构建配置
 */
const config = {
  // 构建目标
  targets: {
    node: {
      entry: 'src/index.js',
      output: 'dist/index.js',
      platform: 'node',
      format: 'esm'
    },
    web: {
      entry: 'web/app.js',
      output: 'dist/web/app.js',
      platform: 'browser',
      format: 'iife'
    }
  },

  // 构建环境
  environments: ['development', 'staging', 'production'],

  // 优化配置
  optimization: {
    minify: true,
    sourcemap: true,
    splitting: true
  }
};

/**
 * 执行构建
 */
function build(target, env = 'production') {
  console.log(`🏗️  构建目标: ${target}, 环境: ${env}`);

  const targetConfig = config.targets[target];
  if (!targetConfig) {
    throw new Error(`未知构建目标: ${target}`);
  }

  // 设置环境变量
  process.env.NODE_ENV = env;

  // 构建命令
  const buildCommand = [
    'node',
    'node_modules/.bin/rollup',
    '-c', 'config/build/rollup.config.js',
    '--input', targetConfig.entry,
    '--output', targetConfig.output,
    '--format', targetConfig.format,
    '--platform', targetConfig.platform,
    config.optimization.minify ? '--minify' : '',
    config.optimization.sourcemap ? '--sourcemap' : ''
  ].filter(Boolean).join(' ');

  try {
    execSync(buildCommand, {
      stdio: 'inherit',
      env: { ...process.env, BUILD_TARGET: target, BUILD_ENV: env }
    });

    console.log(`✅ ${target} 构建完成`);
  } catch (error) {
    console.error(`❌ ${target} 构建失败:`, error.message);
    process.exit(1);
  }
}

/**
 * 清理构建产物
 */
function clean() {
  console.log('🧹 清理构建产物...');

  const dirs = ['dist', 'build', '.cache'];
  dirs.forEach(dir => {
    const fullPath = path.join(process.cwd(), dir);
    if (fs.existsSync(fullPath)) {
      fs.rmSync(fullPath, { recursive: true, force: true });
      console.log(`  删除: ${dir}/`);
    }
  });

  console.log('✅ 清理完成');
}

/**
 * 验证构建结果
 */
function verify(target) {
  console.log('🔍 验证构建结果...');

  const targetConfig = config.targets[target];
  const outputPath = targetConfig.output;

  if (!fs.existsSync(outputPath)) {
    throw new Error(`构建输出文件不存在: ${outputPath}`);
  }

  const stats = fs.statSync(outputPath);
  console.log(`  输出文件: ${outputPath}`);
  console.log(`  文件大小: ${(stats.size / 1024).toFixed(2)} KB`);

  // 基础语法检查
  if (target === 'node') {
    try {
      execSync(`node -c ${outputPath}`, { stdio: 'pipe' });
      console.log('  ✅ 语法检查通过');
    } catch (error) {
      throw new Error(`语法检查失败: ${error.message}`);
    }
  }

  console.log('✅ 验证完成');
}

// 命令行接口
const command = process.argv[2];
const target = process.argv[3] || 'node';
const env = process.argv[4] || 'production';

switch (command) {
  case 'build':
    build(target, env);
    break;
  case 'clean':
    clean();
    break;
  case 'verify':
    verify(target);
    break;
  case 'all':
    clean();
    Object.keys(config.targets).forEach(t => build(t, env));
    Object.keys(config.targets).forEach(t => verify(t));
    console.log('🎉 完整构建流程完成');
    break;
  default:
    console.log('用法:');
    console.log('  node build.js build [target] [env]    # 构建指定目标');
    console.log('  node build.js clean                  # 清理构建产物');
    console.log('  node build.js verify [target]        # 验证构建结果');
    console.log('  node build.js all [env]              # 执行完整构建流程');
    console.log('');
    console.log('目标:', Object.keys(config.targets).join(', '));
    console.log('环境:', config.environments.join(', '));
    break;
}
```

## 📊 部署配置

### Kubernetes 配置

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frys
  labels:
    app: frys
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
        image: frys:latest
        ports:
        - containerPort: 3000
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
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
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
```

### Helm Chart

```yaml
# charts/frys/Chart.yaml
apiVersion: v2
name: frys
description: frys 工作流管理系统
type: application
version: 1.0.0
appVersion: "1.0.0"

# charts/frys/values.yaml
replicaCount: 3

image:
  repository: frys
  tag: latest
  pullPolicy: IfNotPresent

env:
  - name: NODE_ENV
    value: production
  - name: DATABASE_URL
    valueFrom:
      secretKeyRef:
        name: frys-secrets
        key: database-url

ingress:
  enabled: true
  className: nginx
  hosts:
    - host: frys.example.com
      paths:
        - path: /
          pathType: Prefix

resources:
  limits:
    cpu: 500m
    memory: 512Mi
  requests:
    cpu: 250m
    memory: 256Mi
```

## 🔒 安全配置

### 密钥管理

```bash
# 使用 Sealed Secrets 或外部密钥管理
apiVersion: v1
kind: Secret
metadata:
  name: frys-secrets
type: Opaque
data:
  database-url: <base64-encoded-database-url>
  redis-url: <base64-encoded-redis-url>
  jwt-secret: <base64-encoded-jwt-secret>
```

### 网络策略

```yaml
# Kubernetes NetworkPolicy
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: frys-network-policy
spec:
  podSelector:
    matchLabels:
      app: frys
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: nginx
    ports:
    - protocol: TCP
      port: 3000
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: postgres
    ports:
    - protocol: TCP
      port: 5432
  - to:
    - podSelector:
        matchLabels:
          app: redis
    ports:
    - protocol: TCP
      port: 6379
```

## 📋 配置验证

### 配置检查脚本

```bash
#!/bin/bash
# scripts/validate-config.sh

set -e

echo "🔍 验证配置文件..."

# 检查必需的环境变量
required_vars=("NODE_ENV" "DATABASE_URL" "REDIS_URL" "JWT_SECRET")

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ 缺少必需的环境变量: $var"
        exit 1
    fi
done

echo "✅ 环境变量检查通过"

# 检查数据库连接
echo "🔌 检查数据库连接..."
if ! psql "$DATABASE_URL" -c "SELECT 1;" &>/dev/null; then
    echo "❌ 数据库连接失败"
    exit 1
fi

echo "✅ 数据库连接正常"

# 检查 Redis 连接
echo "🔌 检查 Redis 连接..."
if ! redis-cli -u "$REDIS_URL" ping &>/dev/null; then
    echo "❌ Redis 连接失败"
    exit 1
fi

echo "✅ Redis 连接正常"

# 检查配置文件语法
echo "📝 检查配置文件语法..."
if [ -f "config/docker/docker-compose.yml" ]; then
    if ! docker-compose -f config/docker/docker-compose.yml config -q; then
        echo "❌ Docker Compose 配置语法错误"
        exit 1
    fi
    echo "✅ Docker Compose 配置语法正确"
fi

if [ -f "config/nginx/nginx.conf" ]; then
    if ! nginx -t -c "$(pwd)/config/nginx/nginx.conf"; then
        echo "❌ Nginx 配置语法错误"
        exit 1
    fi
    echo "✅ Nginx 配置语法正确"
fi

echo "🎉 所有配置验证通过！"
```

## 🚀 部署脚本

### 一键部署脚本

```bash
#!/bin/bash
# scripts/deploy.sh

set -e

ENVIRONMENT=${1:-production}
TAG=${2:-latest}

echo "🚀 部署到 $ENVIRONMENT 环境..."

# 构建镜像
echo "🏗️  构建 Docker 镜像..."
docker build -t "frys:$TAG" -f config/docker/Dockerfile .

# 推送镜像 (如果需要)
if [ "$ENVIRONMENT" = "production" ]; then
    echo "📤 推送镜像到注册表..."
    docker tag "frys:$TAG" "registry.example.com/frys:$TAG"
    docker push "registry.example.com/frys:$TAG"
fi

# 部署服务
echo "🚀 部署服务..."
case $ENVIRONMENT in
    development)
        docker-compose -f config/docker/docker-compose.dev.yml up -d
        ;;
    staging)
        docker-compose -f config/docker/docker-compose.staging.yml up -d
        ;;
    production)
        docker-compose -f config/docker/docker-compose.prod.yml up -d
        ;;
    *)
        echo "❌ 未知环境: $ENVIRONMENT"
        exit 1
        ;;
esac

# 健康检查
echo "❤️  执行健康检查..."
sleep 10

if curl -f http://localhost:3000/health; then
    echo "✅ 部署成功！"
else
    echo "❌ 部署失败，服务未能正常启动"
    exit 1
fi
```

## 📚 相关资源

- **[Docker 文档](https://docs.docker.com/)** - 容器化技术
- **[Kubernetes 文档](https://kubernetes.io/docs/)** - 容器编排
- **[Nginx 文档](https://nginx.org/en/docs/)** - Web 服务器
- **[Playwright 文档](https://playwright.dev/docs/)** - 端到端测试
- **[Vitest 文档](https://vitest.dev/config/)** - 单元测试配置

---

<div align="center">

## 🎯 配置决定架构

**合理的配置管理是系统稳定运行的基础**

[🏠 返回项目主页](../../README.md) • [📖 查看文档导航](../README.md) • [🚀 开始配置环境](../development/environment-setup.md)

---

*最后更新: 2025年11月7日*

</div>
