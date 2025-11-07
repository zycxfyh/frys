# 🚀 frys 生产环境部署指南

<div align="center">

## 🏭 企业级生产环境配置与部署

**完整的生产环境设置、配置和部署指南**

[📖 返回项目文档首页](../README.md) • [🚀 CI/CD流水线指南](cicd-pipeline.md) • [🐳 Docker部署](deployment-guide.md)

---

</div>

## 📋 前置要求

### 系统要求
- **操作系统**: Linux (Ubuntu 20.04+ / CentOS 8+)
- **内存**: 最低 4GB，推荐 8GB+
- **存储**: 最低 50GB SSD
- **网络**: 稳定的互联网连接

### 依赖软件
```bash
# Docker 和 Docker Compose
sudo apt update
sudo apt install docker.io docker-compose
sudo systemctl enable docker
sudo systemctl start docker

# 添加用户到 docker 组
sudo usermod -aG docker $USER

# Node.js (用于本地部署脚本)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

---

## 🔧 环境配置

### 1. 创建生产环境配置文件

```bash
# 复制环境配置模板
cp .env.prod.example .env.prod

# 编辑生产环境变量
nano .env.prod
```

### 2. 生产环境变量配置

```bash
# 应用配置
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# 数据库配置 (请使用强密码)
POSTGRES_USER=frys_prod
POSTGRES_PASSWORD=your_super_strong_password_here
POSTGRES_DB=frys_prod
DATABASE_URL=postgresql://frys_prod:your_super_strong_password_here@postgres:5432/frys_prod

# Redis 配置
REDIS_URL=redis://redis:6379

# JWT 配置 (请使用32字符以上的强密钥)
JWT_SECRET=your_very_strong_jwt_secret_key_at_least_32_chars
JWT_EXPIRE=24h
JWT_REFRESH_EXPIRE=7d

# API 密钥
API_KEY=your_strong_api_key_here

# 监控配置
GRAFANA_PASSWORD=your_strong_grafana_password

# 日志配置
LOG_LEVEL=info
LOG_FORMAT=json
```

### 3. SSL证书配置

```bash
# 创建SSL证书目录
mkdir -p nginx/ssl

# 使用Let's Encrypt获取免费SSL证书
sudo apt install certbot
sudo certbot certonly --standalone -d your-domain.com

# 复制证书到nginx目录
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem nginx/ssl/
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem nginx/ssl/

# 设置正确的权限
sudo chown -R 101:101 nginx/ssl
```

---

## 🚀 部署流程

### 1. 代码部署

```bash
# 克隆代码到生产服务器
git clone https://github.com/your-org/frys.git
cd frys

# 切换到稳定版本
git checkout v1.0.0  # 或最新的稳定标签

# 复制环境配置
cp .env.prod.example .env.prod
# 编辑 .env.prod 文件，填入实际值
```

### 2. 初始化数据目录

```bash
# 创建必要的目录
mkdir -p data logs backups

# 设置正确的权限
sudo chown -R 1001:1001 data logs backups
```

### 3. 启动生产环境

```bash
# 启动所有服务 (蓝组)
docker-compose -f docker-compose.prod.yml --profile blue up -d

# 验证服务状态
docker-compose -f docker-compose.prod.yml ps

# 检查服务健康状态
docker-compose -f docker-compose.prod.yml exec frys-blue curl -f http://localhost:3000/health
```

### 4. 配置反向代理

```bash
# Nginx 配置示例
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL 配置
    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384;

    # 安全头
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=63072000; includeSubdomains; preload";

    # 代理配置
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket 支持
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # 静态文件缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

---

## 📊 监控配置

### 1. 访问监控面板

```bash
# Prometheus
# 访问: http://your-server:9090

# Grafana
# 访问: http://your-server:3002
# 默认账号: admin
# 密码: 在 .env.prod 中配置的 GRAFANA_PASSWORD

# AlertManager
# 访问: http://your-server:9093
```

### 2. 配置告警通知

```yaml
# monitoring/alertmanager/config.yml
global:
  smtp_smarthost: 'smtp.gmail.com:587'
  smtp_from: 'alerts@your-domain.com'
  smtp_auth_username: 'your-email@gmail.com'
  smtp_auth_password: 'your-app-password'

route:
  group_by: ['alertname']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'email'

receivers:
  - name: 'email'
    email_configs:
      - to: 'admin@your-domain.com'
```

---

## 🔄 蓝绿部署

### 部署新版本

```bash
# 1. 构建新版本镜像
docker-compose -f docker-compose.prod.yml build frys-green

# 2. 启动绿组服务
docker-compose -f docker-compose.prod.yml --profile green up -d frys-green

# 3. 等待绿组服务就绪
docker-compose -f docker-compose.prod.yml exec frys-green curl -f http://localhost:3000/health

# 4. 切换流量到绿组 (更新nginx配置)
# 将 proxy_pass 从 127.0.0.1:3000 改为 127.0.0.1:3001

# 5. 停止蓝组服务
docker-compose -f docker-compose.prod.yml --profile blue down frys-blue

# 6. 如需回滚
# docker-compose -f docker-compose.prod.yml --profile blue up -d frys-blue
# 更新nginx配置回到 127.0.0.1:3000
```

### 自动化部署脚本

```bash
# 使用提供的部署脚本
./scripts/deploy.sh production

# 查看部署状态
docker-compose -f docker-compose.prod.yml ps

# 查看日志
docker-compose -f docker-compose.prod.yml logs -f frys-green
```

---

## 🔧 故障排除

### 常见问题

#### 1. 容器启动失败
```bash
# 检查容器日志
docker-compose -f docker-compose.prod.yml logs frys-blue

# 检查环境变量
docker-compose -f docker-compose.prod.yml exec frys-blue env

# 验证配置文件
docker-compose -f docker-compose.prod.yml config
```

#### 2. 数据库连接失败
```bash
# 检查数据库状态
docker-compose -f docker-compose.prod.yml exec postgres pg_isready

# 查看数据库日志
docker-compose -f docker-compose.prod.yml logs postgres

# 重置数据库 (注意: 会丢失数据)
docker-compose -f docker-compose.prod.yml down -v
docker-compose -f docker-compose.prod.yml up -d postgres
```

#### 3. Redis连接失败
```bash
# 检查Redis状态
docker-compose -f docker-compose.prod.yml exec redis redis-cli ping

# 查看Redis日志
docker-compose -f docker-compose.prod.yml logs redis
```

#### 4. 健康检查失败
```bash
# 手动测试健康检查
docker-compose -f docker-compose.prod.yml exec frys-blue curl -f http://localhost:3000/health

# 检查应用日志
docker-compose -f docker-compose.prod.yml logs frys-blue | tail -50
```

### 紧急回滚

```bash
# 快速回滚到上一版本
./scripts/rollback.sh production

# 查看回滚历史
cat rollback-history.json

# 验证回滚状态
docker-compose -f docker-compose.prod.yml ps
```

---

## 📈 性能优化

### 数据库优化
```sql
-- 创建索引
CREATE INDEX CONCURRENTLY idx_users_email ON users(email);
CREATE INDEX CONCURRENTLY idx_sessions_user_id ON sessions(user_id);

-- 配置PostgreSQL
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
```

### Redis优化
```redis
# redis.conf 配置
maxmemory 256mb
maxmemory-policy allkeys-lru
tcp-keepalive 300
timeout 300
```

### 应用优化
```javascript
// 启用集群模式
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;

if (cluster.isMaster) {
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
} else {
  // 启动应用
  require('./src/index.js');
}
```

---

## 🔐 安全加固

### 防火墙配置
```bash
# UFW 配置
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw --force reload
```

### SELinux/AppArmor
```bash
# 检查状态
sudo apparmor_status

# 配置Docker AppArmor
sudo apparmor_parser -r -W /etc/apparmor.d/docker
```

### 日志审计
```bash
# 配置日志轮转
cat > /etc/logrotate.d/frys << EOF
/app/logs/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 frys frys
    postrotate
        docker-compose -f /path/to/docker-compose.prod.yml restart frys-blue
    endscript
}
EOF
```

---

## 📊 监控指标

### 应用指标
- **响应时间**: P95 < 500ms
- **错误率**: < 0.1%
- **吞吐量**: > 1000 RPS
- **可用性**: > 99.9%

### 系统指标
- **CPU使用率**: < 70%
- **内存使用率**: < 80%
- **磁盘使用率**: < 85%
- **网络带宽**: 根据负载调整

### 业务指标
- **用户注册数**
- **活跃会话数**
- **API调用次数**
- **缓存命中率**

---

## 🎯 维护任务

### 每日检查
```bash
# 健康检查
curl -f https://your-domain.com/health

# 日志检查
tail -f logs/application.log

# 资源使用检查
docker stats
```

### 每周维护
```bash
# 数据库备份
./scripts/backup.sh

# 日志轮转
logrotate /etc/logrotate.d/frys

# 依赖更新检查
npm audit
```

### 每月维护
```bash
# 安全更新
apt update && apt upgrade

# SSL证书续期
certbot renew

# 性能基准测试
npm run benchmark
```

---

<div align="center">

## 🎉 部署完成！

**恭喜！frys 已成功部署到生产环境**

### 📞 后续支持
- **文档**: [完整部署指南](deployment-guide.md)
- **监控**: [Grafana面板](http://your-server:3002)
- **日志**: `docker-compose logs -f`
- **备份**: `./scripts/backup.sh`

### 🚨 重要提醒
1. **定期备份数据**
2. **监控系统指标**
3. **及时处理告警**
4. **保持依赖更新**

---

*最后更新: 2024年11月7日*

</div>
