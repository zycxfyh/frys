# 环境配置指南

本文档介绍如何配置frys项目的环境变量。

## 快速开始

1. 复制环境配置模板：
```bash
cp .env.example .env
```

2. 根据你的环境修改`.env`文件中的配置项

3. 启动应用：
```bash
npm start
```

## 配置说明

### 应用基本配置

```bash
# 运行环境
NODE_ENV=development  # development | staging | production

# 服务器配置
PORT=3000            # 服务器端口
HOST=localhost       # 服务器主机
```

### 数据库配置

#### PostgreSQL (推荐用于生产环境)
```bash
DATABASE_URL=postgresql://username:password@localhost:5432/wokeflow
```

#### SQLite (适合开发和测试环境)
```bash
SQLITE_DATABASE_PATH=./data/wokeflow.db
```

### Redis配置 (Bull.js消息队列必需)

```bash
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=         # 如果有密码
REDIS_DB=0             # 数据库编号
```

### JWT认证配置

```bash
JWT_SECRET=your-super-secret-jwt-key-here  # 必须修改为强密码
JWT_EXPIRES_IN=7d                          # Access Token过期时间
JWT_REFRESH_EXPIRES_IN=30d                 # Refresh Token过期时间
```

### Sentry错误监控配置

```bash
# 从 https://sentry.io 获取DSN
SENTRY_DSN=https://your-sentry-dsn-here@sentry.io/project-id
SENTRY_ENVIRONMENT=development
SENTRY_TRACES_SAMPLE_RATE=0.1    # 10%的请求会被性能追踪
SENTRY_PROFILES_SAMPLE_RATE=0.1  # 10%的请求会被性能分析
```

### 日志配置

```bash
LOG_LEVEL=info        # error | warn | info | debug
LOG_FILE=./logs/wokeflow.log
```

### 外部服务配置

```bash
API_KEY=your-api-key-here
EXTERNAL_API_BASE_URL=https://api.example.com
```

## 环境特定配置

### 开发环境

```bash
NODE_ENV=development
LOG_LEVEL=debug
DEBUG=wokeflow:*
SENTRY_ENVIRONMENT=development
```

### 测试环境

```bash
NODE_ENV=test
TEST_DATABASE_URL=postgresql://test:test@localhost:5433/wokeflow_test
SKIP_TEST_CONTAINERS=false
```

### 生产环境

```bash
NODE_ENV=production
ENABLE_HTTPS=true
SSL_CERT_PATH=/path/to/ssl/cert.pem
SSL_KEY_PATH=/path/to/ssl/private.key

# 性能监控
ENABLE_PERFORMANCE_MONITORING=true
SLOW_QUERY_THRESHOLD=1000

# 安全配置
ENABLE_RATE_LIMITING=true
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX_REQUESTS=100

# 备份配置
ENABLE_AUTO_BACKUP=true
BACKUP_INTERVAL=24h
BACKUP_RETENTION_DAYS=30
```

## 安全注意事项

1. **JWT密钥**: 使用强密码作为JWT_SECRET，长度至少32个字符
2. **环境变量**: 不要将`.env`文件提交到版本控制系统
3. **生产密钥**: 生产环境使用不同的密钥，不要复用开发环境的密钥
4. **文件权限**: 确保`.env`文件的权限设置为600 (仅所有者可读写)

## 故障排除

### Redis连接失败
- 检查Redis服务是否运行：`redis-cli ping`
- 验证Redis配置是否正确
- 检查防火墙设置

### 数据库连接失败
- 验证数据库服务是否运行
- 检查连接字符串格式
- 确认用户权限

### JWT认证失败
- 确保JWT_SECRET已正确设置
- 检查Token格式和过期时间
- 验证签名算法

### Sentry配置无效
- 确认DSN格式正确
- 检查网络连接
- 验证项目权限

## 高级配置

### 多环境部署

为不同环境创建专门的配置文件：

```bash
.env.development
.env.staging
.env.production
```

使用时指定环境：

```bash
NODE_ENV=staging npm start
```

### Docker环境

在Docker容器中运行时：

```bash
# 使用环境变量而不是文件
-e DATABASE_URL=postgresql://db:5432/wokeflow
-e REDIS_URL=redis://redis:6379
-e JWT_SECRET=your-secret
```

### 云服务集成

#### AWS
```bash
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
```

#### Docker Compose
```yaml
version: '3.8'
services:
  wokeflow:
    environment:
      - DATABASE_URL=postgresql://db:5432/wokeflow
      - REDIS_URL=redis://redis:6379
```

## 配置验证

启动应用后，可以通过健康检查端点验证配置：

```bash
curl http://localhost:3000/health
```

成功的响应应该包含所有服务的健康状态。
