# frys 环境变量配置指南

## 概述

frys 使用环境变量来管理所有配置，确保安全性、可移植性和环境隔离。本文档列出了所有可用的环境变量及其默认值。

## 环境变量列表

### 应用配置

| 变量名      | 默认值        | 描述                                      |
| ----------- | ------------- | ----------------------------------------- |
| `NODE_ENV`  | `development` | 运行环境 (development/staging/production) |
| `PORT`      | `3000`        | 应用监听端口                              |
| `LOG_LEVEL` | `info`        | 日志级别 (error/warn/info/debug)          |

### API 配置

| 变量名            | 默认值                      | 描述                    |
| ----------------- | --------------------------- | ----------------------- |
| `API_BASE_URL`    | `http://localhost:3000/api` | API 基础URL             |
| `API_TIMEOUT`     | `30000`                     | API 请求超时时间 (毫秒) |
| `API_RETRIES`     | `3`                         | API 请求重试次数        |
| `API_RETRY_DELAY` | `1000`                      | API 重试间隔 (毫秒)     |

### 消息队列配置

| 变量名                      | 默认值      | 描述                |
| --------------------------- | ----------- | ------------------- |
| `NATS_CLUSTER`              | `frys-prod` | NATS 集群名称       |
| `MESSAGING_TIMEOUT`         | `5000`      | 消息超时时间 (毫秒) |
| `MESSAGING_MAX_CONNECTIONS` | `10`        | 最大连接数          |

### 认证配置

| 变量名                   | 默认值                                           | 描述             |
| ------------------------ | ------------------------------------------------ | ---------------- |
| `JWT_SECRET`             | `your-super-secret-jwt-key-change-in-production` | JWT 密钥         |
| `JWT_EXPIRES_IN`         | `24h`                                            | JWT 过期时间     |
| `JWT_REFRESH_EXPIRES_IN` | `7d`                                             | 刷新令牌过期时间 |
| `JWT_ISSUER`             | `frys-production`                                | JWT 发行者       |
| `JWT_AUDIENCE`           | `frys-users`                                     | JWT 受众         |

### 数据库配置

| 变量名                  | 默认值      | 描述                |
| ----------------------- | ----------- | ------------------- |
| `DB_TYPE`               | `mongodb`   | 数据库类型          |
| `DB_HOST`               | `localhost` | 数据库主机          |
| `DB_PORT`               | `27017`     | 数据库端口          |
| `DB_NAME`               | `frys_prod` | 数据库名称          |
| `DB_USERNAME`           |             | 数据库用户名        |
| `DB_PASSWORD`           |             | 数据库密码          |
| `DB_CONNECTION_TIMEOUT` | `30000`     | 连接超时时间 (毫秒) |

### 缓存配置

| 变量名                  | 默认值      | 描述              |
| ----------------------- | ----------- | ----------------- |
| `CACHE_TYPE`            | `redis`     | 缓存类型          |
| `CACHE_HOST`            | `localhost` | 缓存主机          |
| `CACHE_PORT`            | `6379`      | 缓存端口          |
| `CACHE_PASSWORD`        |             | 缓存密码          |
| `CACHE_TTL`             | `3600`      | 缓存过期时间 (秒) |
| `CACHE_MAX_CONNECTIONS` | `10`        | 最大缓存连接数    |

### 监控配置

| 变量名                     | 默认值     | 描述                     |
| -------------------------- | ---------- | ------------------------ |
| `MONITORING_ENABLED`       | `true`     | 是否启用监控             |
| `PROMETHEUS_PORT`          | `9090`     | Prometheus 端口          |
| `PROMETHEUS_PATH`          | `/metrics` | Prometheus 指标路径      |
| `ALERTMANAGER_ENABLED`     | `true`     | 是否启用告警管理器       |
| `ALERTMANAGER_WEBHOOK_URL` |            | AlertManager Webhook URL |

### 安全配置

| 变量名                 | 默认值                  | 描述                |
| ---------------------- | ----------------------- | ------------------- |
| `CORS_ORIGIN`          | `http://localhost:3000` | CORS 允许的源       |
| `RATE_LIMIT_WINDOW_MS` | `900000`                | 限流窗口时间 (毫秒) |
| `RATE_LIMIT_MAX`       | `100`                   | 限流最大请求数      |

### 工作流配置

| 变量名                     | 默认值    | 描述                      |
| -------------------------- | --------- | ------------------------- |
| `MAX_CONCURRENT_WORKFLOWS` | `50`      | 最大并发工作流数          |
| `MAX_TASKS_PER_WORKFLOW`   | `100`     | 每个工作流最大任务数      |
| `WORKFLOW_DEFAULT_TIMEOUT` | `3600000` | 工作流默认超时时间 (毫秒) |
| `WORKFLOW_RETRY_ATTEMPTS`  | `3`       | 工作流重试次数            |
| `WORKFLOW_RETRY_DELAY`     | `5000`    | 工作流重试间隔 (毫秒)     |

### 通知配置

| 变量名              | 默认值                | 描述                |
| ------------------- | --------------------- | ------------------- |
| `EMAIL_ENABLED`     | `false`               | 是否启用邮件通知    |
| `EMAIL_HOST`        |                       | SMTP 服务器主机     |
| `EMAIL_PORT`        | `587`                 | SMTP 服务器端口     |
| `EMAIL_SECURE`      | `false`               | 是否使用安全连接    |
| `EMAIL_USER`        |                       | SMTP 用户名         |
| `EMAIL_PASS`        |                       | SMTP 密码           |
| `SLACK_ENABLED`     | `false`               | 是否启用 Slack 通知 |
| `SLACK_WEBHOOK_URL` |                       | Slack Webhook URL   |
| `SLACK_CHANNEL`     | `#frys-notifications` | Slack 频道          |

### 日志配置

| 变量名                | 默认值            | 描述                 |
| --------------------- | ----------------- | -------------------- |
| `LOG_FORMAT`          | `json`            | 日志格式 (json/text) |
| `LOG_CONSOLE_ENABLED` | `true`            | 是否启用控制台日志   |
| `LOG_FILE_ENABLED`    | `true`            | 是否启用文件日志     |
| `LOG_FILE_PATH`       | `./logs/frys.log` | 日志文件路径         |
| `LOG_FILE_MAX_SIZE`   | `10m`             | 单个日志文件最大大小 |
| `LOG_FILE_MAX_FILES`  | `5`               | 最大日志文件数量     |

### 部署 URL 配置 (脚本使用)

| 变量名           | 默认值                        | 描述        |
| ---------------- | ----------------------------- | ----------- |
| `PRODUCTION_URL` | `https://app.frys.com`        | 生产环境URL |
| `MONITORING_URL` | `https://monitoring.frys.com` | 监控面板URL |
| `LOGS_URL`       | `https://logs.frys.com`       | 日志系统URL |
| `ALERTS_URL`     | `https://alerts.frys.com`     | 告警中心URL |
| `STAGING_URL`    | `https://staging.frys.com`    | 测试环境URL |

## 使用示例

### 开发环境

```bash
# .env 文件内容
NODE_ENV=development
PORT=3000
API_BASE_URL=http://localhost:3000/api
JWT_SECRET=dev-secret-key
```

### 生产环境

```bash
# .env 文件内容
NODE_ENV=production
PORT=8080
API_BASE_URL=https://api.frys.com/api
JWT_SECRET=your-production-secret-key
DB_HOST=prod-database-host
DB_USERNAME=prod-user
DB_PASSWORD=prod-password
MONITORING_ENABLED=true
```

### Docker 环境

```bash
# docker-compose.yml 中的环境变量
environment:
  - NODE_ENV=production
  - PORT=3000
  - API_BASE_URL=https://api.frys.com/api
  - JWT_SECRET=${JWT_SECRET}
  - DB_HOST=db
  - DB_PASSWORD=${DB_PASSWORD}
```

## 安全注意事项

1. **敏感信息**: 永远不要将包含敏感信息的 `.env` 文件提交到版本控制系统
2. **密钥管理**: 在生产环境中使用强密码和随机生成的密钥
3. **权限控制**: 确保 `.env` 文件只有必要用户可读
4. **环境隔离**: 不同环境的配置应该完全隔离

## 验证配置

运行以下命令验证配置是否正确：

```bash
npm run config:validate
```

如果配置缺失或无效，应用将在启动时报错并提供详细的错误信息。
