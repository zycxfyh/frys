#!/usr/bin/env node

/**
 * frys Staging 环境设置脚本
 * 自动配置staging环境
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const __dirname = path.dirname(new URL(import.meta.url).pathname.replace(/^\/[A-Za-z]:/, ''));

class StagingSetup {
  constructor() {
    this.rootDir = path.resolve(__dirname, '..');
    this.dataDir = path.join(this.rootDir, 'data');
    this.logsDir = path.join(this.rootDir, 'logs');
    this.monitoringDir = path.join(this.rootDir, 'monitoring');
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = {
      info: 'ℹ️ ',
      success: '✅ ',
      warning: '⚠️ ',
      error: '❌ '
    }[type] || 'ℹ️ ';

    console.log(`[${timestamp}] ${prefix}${message}`);
  }

  createDirectory(dirPath) {
    try {
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        this.log(`创建目录: ${dirPath}`, 'success');
      } else {
        this.log(`目录已存在: ${dirPath}`, 'info');
      }
    } catch (error) {
      this.log(`创建目录失败: ${error.message}`, 'error');
      throw error;
    }
  }

  createEnvFile() {
    const envPath = path.join(this.rootDir, '.env.staging');

    if (fs.existsSync(envPath)) {
      this.log('Staging环境文件已存在，跳过创建', 'warning');
      return;
    }

    const envContent = `# frys Staging 环境配置
# 此文件包含staging环境的敏感配置，请妥善保管

# 应用配置
NODE_ENV=staging
PORT=3000
HOST=0.0.0.0

# 数据库配置
DATABASE_URL=sqlite://./data/staging.db
REDIS_URL=redis://redis:6379

# 安全配置
JWT_SECRET=${this.generateSecret()}
JWT_EXPIRES_IN=1h
API_KEY=${this.generateSecret()}

# 外部服务配置
POSTGRES_PASSWORD=${this.generateSecret()}
GRAFANA_PASSWORD=admin123

# 日志配置
LOG_LEVEL=info
LOG_FILE=./logs/staging.log

# 性能监控
PERFORMANCE_MONITORING=true
METRICS_ENABLED=true

# 缓存配置
CACHE_TTL=300
CACHE_MAX_SIZE=1000

# 安全配置
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100
CORS_ORIGIN=${CORS_ORIGIN:-https://staging.wokeflow.com}

# 备份配置
BACKUP_ENABLED=true
BACKUP_SCHEDULE=0 2 * * *
BACKUP_RETENTION_DAYS=30
`;

    try {
      fs.writeFileSync(envPath, envContent, 'utf8');
      this.log('创建Staging环境配置文件', 'success');
    } catch (error) {
      this.log(`创建环境文件失败: ${error.message}`, 'error');
      throw error;
    }
  }

  generateSecret(length = 32) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  createNginxConfig() {
    const nginxDir = path.join(this.rootDir, 'nginx');
    this.createDirectory(nginxDir);

    const nginxConfig = `events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

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
        application/xml+rss
        application/json;

    # 速率限制
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/s;

    upstream wokeflow_backend {
        server wokeflow:3000;
    }

    server {
        listen 80;
        server_name staging.wokeflow.com;

        # 安全头
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";

        # API 路由
        location /api/ {
            limit_req zone=api burst=20 nodelay;

            proxy_pass http://wokeflow_backend;
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

        # 认证接口特殊限制
        location /api/auth/ {
            limit_req zone=auth burst=10 nodelay;

            proxy_pass http://wokeflow_backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # 健康检查
        location /health {
            proxy_pass http://wokeflow_backend/health;
            access_log off;
        }

        # 静态文件缓存
        location /static/ {
            proxy_pass http://wokeflow_backend;
            expires 1y;
            add_header Cache-Control "public, immutable";
        }

        # 默认路由
        location / {
            proxy_pass http://wokeflow_backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
`;

    const configPath = path.join(nginxDir, 'nginx.conf');
    try {
      fs.writeFileSync(configPath, nginxConfig, 'utf8');
      this.log('创建Nginx配置文件', 'success');
    } catch (error) {
      this.log(`创建Nginx配置失败: ${error.message}`, 'error');
      throw error;
    }
  }

  createMonitoringConfig() {
    this.createDirectory(path.join(this.monitoringDir, 'prometheus'));
    this.createDirectory(path.join(this.monitoringDir, 'grafana', 'provisioning'));
    this.createDirectory(path.join(this.monitoringDir, 'grafana', 'dashboards'));

    // Prometheus 配置
    const prometheusConfig = `global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  # - "first_rules.yml"
  # - "second_rules.yml"

scrape_configs:
  - job_name: 'wokeflow'
    static_configs:
      - targets: ['wokeflow:3000']
    scrape_interval: 5s
    metrics_path: '/metrics'

  - job_name: 'redis'
    static_configs:
      - targets: ['redis:6379']
    scrape_interval: 30s

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres:5432']
    scrape_interval: 30s
    profiles:
      - full

  - job_name: 'nginx'
    static_configs:
      - targets: ['nginx:80']
    scrape_interval: 30s
    profiles:
      - web
`;

    const prometheusPath = path.join(this.monitoringDir, 'prometheus', 'prometheus.yml');
    fs.writeFileSync(prometheusPath, prometheusConfig, 'utf8');
    this.log('创建Prometheus配置', 'success');

    // Grafana 数据源配置
    const grafanaDatasource = `apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: true
`;

    const datasourcePath = path.join(this.monitoringDir, 'grafana', 'provisioning', 'datasources', 'prometheus.yml');
    this.createDirectory(path.dirname(datasourcePath));
    fs.writeFileSync(datasourcePath, grafanaDatasource, 'utf8');
    this.log('创建Grafana数据源配置', 'success');
  }

  createDockerIgnore() {
    const dockerignore = `node_modules
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.npm
.yarn
.env*
*.log
coverage
test-results
data
logs
.git
.github
docs
scripts
monitoring
nginx
Dockerfile*
docker-compose*.yml
README.md
`;

    const dockerignorePath = path.join(this.rootDir, '.dockerignore');
    try {
      fs.writeFileSync(dockerignorePath, dockerignore, 'utf8');
      this.log('创建.dockerignore文件', 'success');
    } catch (error) {
      this.log(`创建.dockerignore失败: ${error.message}`, 'error');
      throw error;
    }
  }

  async run() {
    try {
      this.log('🚀 开始设置frys Staging环境', 'info');

      // 创建必要目录
      this.createDirectory(this.dataDir);
      this.createDirectory(this.logsDir);

      // 创建配置文件
      this.createEnvFile();
      this.createNginxConfig();
      this.createMonitoringConfig();
      this.createDockerIgnore();

      this.log('✅ Staging环境设置完成！', 'success');
      this.log('\n📋 下一步操作:', 'info');
      this.log('1. 复制 .env.staging.example 为 .env.staging 并配置敏感信息', 'info');
      this.log('2. 运行: docker-compose -f docker-compose.staging.yml up -d', 'info');
      this.log('3. 访问: http://localhost:3000 查看应用状态', 'info');

    } catch (error) {
      this.log(`❌ Staging环境设置失败: ${error.message}`, 'error');
      process.exit(1);
    }
  }
}

// 执行设置
const setup = new StagingSetup();
setup.run().catch(error => {
  console.error('设置过程中发生错误:', error);
  process.exit(1);
});
