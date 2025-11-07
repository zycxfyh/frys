# frys 部署指南

## 概述

本文档提供了frys系统的完整部署指南，包括本地开发环境、容器化部署、云部署和生产环境配置。

## 系统要求

### 最低系统要求

- **操作系统**: Linux, macOS, Windows 10+
- **内存**: 2GB RAM
- **磁盘**: 5GB 可用空间
- **Node.js**: v16.0.0 或更高版本
- **数据库**: PostgreSQL 12+ 或兼容版本

### 推荐系统配置

- **CPU**: 2核心以上
- **内存**: 4GB RAM 以上
- **磁盘**: SSD, 20GB 以上可用空间
- **网络**: 稳定的互联网连接

## 快速开始

### 使用 Docker Compose（推荐）

1. **克隆项目**
```bash
git clone https://github.com/wokeflow/wokeflow.git
cd wokeflow
```

2. **启动服务**
```bash
docker-compose up -d
```

3. **验证部署**
```bash
curl http://localhost:3000/health
```

### 本地开发环境

1. **安装依赖**
```bash
npm install
```

2. **环境配置**
```bash
cp .env.example .env
# 编辑 .env 文件配置数据库等信息
```

3. **启动数据库**
```bash
# 使用 Docker 启动 PostgreSQL
docker run -d \
  --name wokeflow-postgres \
  -e POSTGRES_DB=wokeflow \
  -e POSTGRES_USER=wokeflow \
  -e POSTGRES_PASSWORD=password \
  -p 5432:5432 \
  postgres:13
```

4. **运行数据库迁移**
```bash
npm run db:migrate
```

5. **启动应用**
```bash
npm run dev
```

6. **验证**
```bash
curl http://localhost:3000/health
```

## 详细部署配置

### 环境变量配置

创建 `.env` 文件并配置以下变量：

```bash
# 应用配置
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# 数据库配置
DATABASE_URL=postgresql://user:password@localhost:5432/wokeflow
DB_POOL_MIN=2
DB_POOL_MAX=10
DB_POOL_IDLE_TIMEOUT=30000

# Redis 配置
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=
REDIS_DB=0

# RabbitMQ 配置
RABBITMQ_URL=amqp://guest:guest@localhost:5672
RABBITMQ_HEARTBEAT=60

# JWT 配置
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# 会话配置
SESSION_SECRET=your-session-secret-here
SESSION_MAX_AGE=86400000

# 文件上传配置
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif,application/pdf

# 邮件配置
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
FROM_EMAIL=noreply@wokeflow.com

# 监控配置
PROMETHEUS_ENABLED=true
GRAFANA_ENABLED=true
LOG_LEVEL=info

# 安全配置
CORS_ORIGINS=https://yourdomain.com
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX=100

# 外部服务配置
CDN_URL=https://cdn.yourdomain.com
STORAGE_BUCKET=your-bucket-name
STORAGE_REGION=us-east-1
```

### 数据库初始化

1. **创建数据库**
```sql
CREATE DATABASE wokeflow;
CREATE USER wokeflow WITH ENCRYPTED PASSWORD 'password';
GRANT ALL PRIVILEGES ON DATABASE wokeflow TO wokeflow;
```

2. **运行迁移**
```bash
npm run db:migrate
```

3. **初始化数据**
```bash
npm run db:seed
```

## Docker 部署

### 单容器部署

```dockerfile
FROM node:18-alpine

WORKDIR /app

# 安装系统依赖
RUN apk add --no-cache postgresql-client redis

# 复制依赖文件
COPY package*.json ./
RUN npm ci --only=production

# 复制应用代码
COPY . .

# 创建非root用户
RUN addgroup -g 1001 -S nodejs
RUN adduser -S wokeflow -u 1001

# 设置权限
RUN chown -R wokeflow:nodejs /app
USER wokeflow

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["npm", "start"]
```

### 多容器部署

**docker-compose.yml**
```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://wokeflow:password@db:5432/wokeflow
      - REDIS_URL=redis://cache:6379
      - RABBITMQ_URL=amqp://guest:guest@mq:5672
    depends_on:
      - db
      - cache
      - mq
    volumes:
      - uploads:/app/uploads
    restart: unless-stopped

  db:
    image: postgres:13-alpine
    environment:
      - POSTGRES_DB=wokeflow
      - POSTGRES_USER=wokeflow
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    restart: unless-stopped

  cache:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped

  mq:
    image: rabbitmq:3-management-alpine
    ports:
      - "5672:5672"
      - "15672:15672"
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq
    restart: unless-stopped

  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    restart: unless-stopped

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana_data:/var/lib/grafana
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
  rabbitmq_data:
  prometheus_data:
  grafana_data:
  uploads:
```

## Kubernetes 部署

### 命名空间创建

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: wokeflow
  labels:
    name: wokeflow
```

### 配置管理

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: wokeflow-config
  namespace: wokeflow
data:
  NODE_ENV: "production"
  LOG_LEVEL: "info"
  CORS_ORIGINS: "https://yourdomain.com"
```

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: wokeflow-secrets
  namespace: wokeflow
type: Opaque
data:
  JWT_SECRET: <base64-encoded-secret>
  DATABASE_URL: <base64-encoded-url>
  REDIS_URL: <base64-encoded-url>
```

### 部署应用

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: wokeflow-app
  namespace: wokeflow
spec:
  replicas: 3
  selector:
    matchLabels:
      app: wokeflow
  template:
    metadata:
      labels:
        app: wokeflow
    spec:
      containers:
      - name: wokeflow
        image: your-registry/wokeflow:latest
        ports:
        - containerPort: 3000
        envFrom:
        - configMapRef:
            name: wokeflow-config
        - secretRef:
            name: wokeflow-secrets
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
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

### 服务暴露

```yaml
apiVersion: v1
kind: Service
metadata:
  name: wokeflow-service
  namespace: wokeflow
spec:
  selector:
    app: wokeflow
  ports:
  - port: 80
    targetPort: 3000
  type: ClusterIP
```

### Ingress 配置

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: wokeflow-ingress
  namespace: wokeflow
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  tls:
  - hosts:
    - api.yourdomain.com
    secretName: wokeflow-tls
  rules:
  - host: api.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: wokeflow-service
            port:
              number: 80
```

### 持久卷配置

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: wokeflow-storage
  namespace: wokeflow
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
```

## 云平台部署

### AWS ECS 部署

**ecs-task-definition.json**
```json
{
  "family": "wokeflow",
  "taskRoleArn": "arn:aws:iam::123456789012:role/ecsTaskExecutionRole",
  "executionRoleArn": "arn:aws:iam::123456789012:role/ecsTaskExecutionRole",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "containerDefinitions": [
    {
      "name": "wokeflow",
      "image": "123456789012.dkr.ecr.us-east-1.amazonaws.com/wokeflow:latest",
      "essential": true,
      "portMappings": [
        {
          "containerPort": 3000,
          "hostPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {"name": "NODE_ENV", "value": "production"},
        {"name": "PORT", "value": "3000"}
      ],
      "secrets": [
        {"name": "DATABASE_URL", "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789012:secret:wokeflow/db"},
        {"name": "JWT_SECRET", "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789012:secret:wokeflow/jwt"}
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/wokeflow",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

### Google Cloud Run

```yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: wokeflow
spec:
  template:
    spec:
      containers:
      - image: gcr.io/your-project/wokeflow:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: production
        - name: PORT
          value: "3000"
        resources:
          limits:
            cpu: 1000m
            memory: 512Mi
      timeoutSeconds: 300
```

### Azure Container Instances

```json
{
  "location": "East US",
  "properties": {
    "containers": [
      {
        "name": "wokeflow",
        "properties": {
          "image": "yourregistry.azurecr.io/wokeflow:latest",
          "ports": [
            {
              "port": 3000
            }
          ],
          "environmentVariables": [
            {
              "name": "NODE_ENV",
              "value": "production"
            }
          ],
          "resources": {
            "requests": {
              "cpu": 1,
              "memoryInGb": 1.5
            }
          }
        }
      }
    ],
    "osType": "Linux",
    "ipAddress": {
      "type": "Public",
      "ports": [
        {
          "protocol": "tcp",
          "port": 3000
        }
      ]
    }
  }
}
```

## 生产环境配置

### SSL/TLS 配置

**Nginx 配置**
```nginx
server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 安全头
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";
}
```

### 负载均衡配置

**HAProxy 配置**
```haproxy
frontend http_front
    bind *:80
    bind *:443 ssl crt /etc/ssl/certs/wokeflow.pem
    redirect scheme https if !{ ssl_fc }

    # 速率限制
    stick-table type ip size 100k expire 30s store http_req_rate(10s)
    http-request track-sc0 src
    http-request deny deny_status 429 if { sc_http_req_rate(0) gt 100 }

    default_backend wokeflow_backend

backend wokeflow_backend
    balance roundrobin
    option httpchk GET /health
    http-check expect status 200

    server app1 127.0.0.1:3001 check
    server app2 127.0.0.1:3002 check
    server app3 127.0.0.1:3003 check
```

### 监控和告警

**Prometheus 配置**
```yaml
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
  - job_name: 'wokeflow'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
    scrape_interval: 5s

  - job_name: 'node'
    static_configs:
      - targets: ['localhost:9100']
```

**告警规则**
```yaml
groups:
  - name: wokeflow
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }}%"

      - alert: HighMemoryUsage
        expr: process_resident_memory_bytes / process_virtual_memory_max_bytes > 0.8
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage"
          description: "Memory usage is {{ $value }}%"
```

## 备份和恢复

### 数据库备份

```bash
# 每日备份脚本
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump -h localhost -U wokeflow wokeflow > backup_$DATE.sql

# 压缩并上传到云存储
gzip backup_$DATE.sql
aws s3 cp backup_$DATE.sql.gz s3://wokeflow-backups/

# 删除7天前的备份
find /backups -name "backup_*.sql.gz" -mtime +7 -delete
```

### 应用配置备份

```bash
# 配置备份
tar -czf config_backup_$(date +%Y%m%d).tar.gz \
  .env \
  docker-compose.yml \
  nginx.conf \
  monitoring/

# 上传到备份存储
scp config_backup_$(date +%Y%m%d).tar.gz backup-server:/backups/
```

### 恢复过程

1. **停止应用**
```bash
docker-compose down
```

2. **恢复数据库**
```bash
gunzip backup_20231107.sql.gz
psql -h localhost -U wokeflow wokeflow < backup_20231107.sql
```

3. **恢复配置**
```bash
tar -xzf config_backup_20231107.tar.gz
```

4. **重启应用**
```bash
docker-compose up -d
```

## 性能优化

### 应用层优化

1. **启用集群模式**
```bash
# 使用 PM2 集群模式
pm2 start app.js -i max
```

2. **配置缓存**
```javascript
// 启用多级缓存
const cacheService = new CacheService({
  defaultTtl: 300000,
  enableRedis: true,
  maxMemorySize: 512 * 1024 * 1024 // 512MB
});
```

3. **数据库连接池**
```javascript
const pool = new Pool({
  min: 2,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

### 系统层优化

1. **内核参数调优**
```bash
# /etc/sysctl.conf
net.core.somaxconn = 65536
net.ipv4.tcp_tw_reuse = 1
net.ipv4.ip_local_port_range = 1024 65535
vm.swappiness = 10
```

2. **文件描述符限制**
```bash
# /etc/security/limits.conf
* soft nofile 65536
* hard nofile 65536
```

3. **TCP调优**
```bash
# 增加TCP缓冲区
net.core.rmem_max = 16777216
net.core.wmem_max = 16777216
net.ipv4.tcp_rmem = 4096 87380 16777216
net.ipv4.tcp_wmem = 4096 87380 16777216
```

## 安全加固

### 网络安全

1. **防火墙配置**
```bash
# UFW 配置
ufw allow ssh
ufw allow 80
ufw allow 443
ufw --force enable
```

2. **Fail2Ban 配置**
```ini
[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 3600
```

### 应用安全

1. **安全头配置**
```javascript
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});
```

2. **CORS 配置**
```javascript
const corsOptions = {
  origin: process.env.CORS_ORIGINS.split(','),
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
```

### 数据安全

1. **敏感数据加密**
```javascript
// 使用 bcrypt 加密密码
const hashedPassword = await bcrypt.hash(password, 12);

// 使用 crypto 加密敏感数据
const encrypted = crypto.publicEncrypt(publicKey, Buffer.from(data));
```

2. **SQL注入防护**
```javascript
// 使用参数化查询
const result = await pool.query(
  'SELECT * FROM users WHERE email = $1',
  [email]
);
```

## 监控和维护

### 日志管理

```bash
# 日志轮转配置 /etc/logrotate.d/wokeflow
/var/log/wokeflow/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 wokeflow wokeflow
    postrotate
        pm2 reloadLogs
    endscript
}
```

### 定期维护

1. **依赖更新**
```bash
# 每月更新依赖
npm audit
npm update
npm audit fix
```

2. **数据库维护**
```sql
-- 每周重建索引
REINDEX DATABASE wokeflow;

-- 清理过期数据
DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '90 days';
VACUUM ANALYZE;
```

3. **安全扫描**
```bash
# 每周安全扫描
npm audit --audit-level=moderate
snyk test
```

## 故障排除

### 常见问题

1. **应用无法启动**
```bash
# 检查端口占用
lsof -i :3000

# 检查环境变量
env | grep NODE_ENV

# 检查日志
tail -f logs/wokeflow.log
```

2. **数据库连接失败**
```bash
# 测试数据库连接
psql -h localhost -U wokeflow wokeflow -c "SELECT 1"

# 检查连接池配置
grep DB_ .env
```

3. **内存泄漏**
```bash
# 使用 heapdump 生成堆快照
kill -USR2 <pid>

# 分析内存使用
node --inspect <app.js>
```

4. **性能问题**
```bash
# CPU 使用分析
perf record -F 99 -p <pid> -g -- sleep 60
perf report

# 内存分析
valgrind --tool=massif node app.js
```

## 更新和升级

### 滚动更新

```bash
# 蓝绿部署
docker-compose up -d --scale app=2
docker-compose up -d --scale app=1
```

### 零停机部署

```bash
# 使用 PM2 零停机重载
pm2 reload app

# 或使用 Kubernetes 滚动更新
kubectl set image deployment/wokeflow wokeflow=new-image:tag
```

## 总结

通过遵循本部署指南，您可以：

1. **快速启动**: 使用Docker Compose快速搭建开发环境
2. **弹性伸缩**: 支持水平和垂直扩展
3. **高可用**: 通过负载均衡和故障转移确保服务连续性
4. **安全可靠**: 实施全面的安全措施和监控
5. **易于维护**: 自动化备份、更新和监控

根据您的具体需求和环境，选择合适的部署策略。生产环境建议使用Kubernetes或云托管服务，以获得更好的可扩展性和可靠性。
