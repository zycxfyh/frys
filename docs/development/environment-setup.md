# 🛠️ 环境设置指南

<div align="center">

## ⚙️ frys 开发环境配置和设置

**从零开始搭建完整的开发环境**

[🏠 返回开发者指南](README.md) • [📖 文档导航](../README.md) • [🚀 快速开始](../../GETTING_STARTED.md)

---

</div>

## 📋 前置要求

### 系统要求

| 组件 | 版本要求 | 下载地址 |
|------|----------|----------|
| **Node.js** | ≥ 16.0.0 | [nodejs.org](https://nodejs.org/) |
| **npm** | ≥ 8.0.0 | 随 Node.js 安装 |
| **Git** | ≥ 2.30.0 | [git-scm.com](https://git-scm.com/) |
| **Redis** | ≥ 6.0 | [redis.io](https://redis.io/) |

### 推荐配置

- **操作系统**: macOS 12+, Ubuntu 20.04+, Windows 10+
- **内存**: ≥ 8GB RAM
- **磁盘**: ≥ 10GB 可用空间
- **网络**: 稳定的互联网连接

---

## 🚀 快速开始

### 方式一：一键安装 (推荐)

```bash
# 1. 克隆项目
git clone https://github.com/zycxfyh/frys.git
cd frys

# 2. 安装依赖
npm install

# 3. 启动 Redis (新终端)
redis-server

# 4. 配置环境变量
cp .env.example .env

# 5. 启动开发服务器
npm run dev
```

### 方式二：Docker 环境

```bash
# 使用 Docker Compose 启动完整环境
docker-compose -f config/docker/docker-compose.dev.yml up -d

# 查看服务状态
docker-compose -f config/docker/docker-compose.dev.yml ps

# 查看日志
docker-compose -f config/docker/docker-compose.dev.yml logs -f
```

### 方式三：手动安装

```bash
# 1. 安装 Node.js
# macOS (使用 Homebrew)
brew install node

# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Windows: 从官网下载安装包

# 2. 安装 Redis
# macOS
brew install redis
brew services start redis

# Ubuntu/Debian
sudo apt update
sudo apt install redis-server
sudo systemctl start redis-server

# Windows: 从 GitHub 下载

# 3. 克隆和设置项目
git clone https://github.com/zycxfyh/frys.git
cd frys
npm install
cp .env.example .env
npm run dev
```

---

## ⚙️ 环境配置

### 基础配置文件

创建 `.env` 文件并配置以下变量：

```bash
# ===================
# 核心配置
# ===================
NODE_ENV=development
PORT=3000
HOST=localhost

# ===================
# 数据库配置 (可选)
# ===================
DATABASE_URL=postgresql://username:password@localhost:5432/frys_db
DB_SSL=false
DB_MAX_CONNECTIONS=20

# ===================
# Redis 配置 (必需)
# ===================
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=
REDIS_DB=0

# ===================
# JWT 认证配置
# ===================
JWT_SECRET=your-super-secure-jwt-secret-key-here
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d

# ===================
# 监控配置 (可选)
# ===================
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
SENTRY_ENVIRONMENT=development
SENTRY_TRACES_SAMPLE_RATE=0.1
```

### 环境变量详解

#### 核心配置

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `NODE_ENV` | `development` | 运行环境：development/staging/production |
| `PORT` | `3000` | 服务器监听端口 |
| `HOST` | `localhost` | 服务器绑定主机 |

#### 数据库配置

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `DATABASE_URL` | - | PostgreSQL连接字符串 |
| `DB_SSL` | `false` | 是否启用SSL连接 |
| `DB_MAX_CONNECTIONS` | `20` | 最大连接数 |

#### Redis 配置

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `REDIS_URL` | `redis://localhost:6379` | Redis连接URL |
| `REDIS_PASSWORD` | - | Redis密码（可选） |
| `REDIS_DB` | `0` | Redis数据库编号 |

#### JWT 配置

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `JWT_SECRET` | - | JWT签名密钥（必需） |
| `JWT_EXPIRES_IN` | `7d` | Access Token过期时间 |
| `JWT_REFRESH_EXPIRES_IN` | `30d` | Refresh Token过期时间 |

---

## ✅ 环境验证

### 验证安装

```bash
# 1. 检查 Node.js 和 npm
node --version
npm --version

# 2. 检查 Git
git --version

# 3. 检查 Redis
redis-cli ping

# 4. 检查项目依赖
cd frys
npm list --depth=0
```

### 启动应用

```bash
# 启动开发服务器
npm run dev

# 在另一个终端检查服务状态
curl http://localhost:3000/health
```

### 验证数据库连接

```bash
# PostgreSQL (如果使用)
psql "$DATABASE_URL" -c "SELECT 1;"

# 或者使用应用API
curl http://localhost:3000/api/v1/system/database/status
```

### 验证 Redis 连接

```bash
# Redis CLI
redis-cli -u "$REDIS_URL" ping

# 或者使用应用API
curl http://localhost:3000/api/v1/system/cache/status
---

## 🔧 故障排除

### 常见问题

#### 1. Node.js 版本问题

```bash
# 检查当前版本
node --version

# 如果版本过低，升级 Node.js
# macOS (使用 nvm)
nvm install 18
nvm use 18

# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

#### 2. Redis 连接失败

**问题**: `Error: Redis connection failed`

**解决方案**:
```bash
# 1. 检查 Redis 是否运行
redis-cli ping

# 2. 如果没有运行，启动 Redis
# macOS
brew services start redis

# Ubuntu/Debian
sudo systemctl start redis-server

# 3. 检查配置文件
cat .env | grep REDIS

# 4. 测试连接
redis-cli -u "$REDIS_URL" ping
```

#### 3. 数据库连接失败

**问题**: `Error: Database connection failed`

**解决方案**:
```bash
# 1. 检查 PostgreSQL 是否运行
sudo systemctl status postgresql

# 2. 如果没有运行，启动服务
sudo systemctl start postgresql

# 3. 检查连接字符串
echo $DATABASE_URL

# 4. 测试连接
psql "$DATABASE_URL" -c "SELECT 1;"
```

#### 4. 端口被占用

**问题**: `Error: Port 3000 is already in use`

**解决方案**:
```bash
# 1. 查找占用端口的进程
lsof -i :3000

# 2. 杀死进程
kill -9 <PID>

# 3. 或者使用不同端口
PORT=3001 npm run dev
```

#### 5. 依赖安装失败

**问题**: `npm install` 失败

**解决方案**:
```bash
# 1. 清理缓存
npm cache clean --force

# 2. 删除 node_modules
rm -rf node_modules package-lock.json

# 3. 使用国内镜像
npm config set registry https://registry.npmmirror.com

# 4. 重新安装
npm install
```

#### 6. 权限问题

**问题**: `Error: EACCES permission denied`

**解决方案**:
```bash
# 修复 npm 权限
sudo chown -R $(whoami) ~/.npm
sudo chown -R $(whoami) /usr/local/lib/node_modules

# 或者使用 nvm 管理 Node.js
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18
```

### 环境特定问题

#### macOS 环境

```bash
# 安装 Xcode 命令行工具
xcode-select --install

# 安装 Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 安装依赖
brew install node redis postgresql
```

#### Ubuntu/Debian 环境

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装基础工具
sudo apt install -y curl wget git

# 安装 Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 安装 Redis
sudo apt install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server

# 安装 PostgreSQL (可选)
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

#### Windows 环境

```powershell
# 使用 Chocolatey 包管理器
choco install nodejs redis-64 postgresql

# 或者从官网下载安装包
# Node.js: https://nodejs.org/
# Redis: https://redis.io/download
# PostgreSQL: https://www.postgresql.org/download/
```

---

## 🔄 环境迁移

### 从开发环境到生产环境

```bash
# 1. 复制环境配置
cp .env.development .env.production

# 2. 修改生产环境变量
vim .env.production

# 3. 构建生产版本
npm run build

# 4. 启动生产服务
NODE_ENV=production npm start
```

### Docker 环境迁移

```bash
# 1. 构建生产镜像
docker build -t frys:production .

# 2. 运行生产容器
docker run -d \
  --name frys-production \
  -p 80:3000 \
  --env-file .env.production \
  frys:production
```

---

## 📊 性能优化

### 开发环境优化

```bash
# 启用热重载
npm run dev

# 启用调试模式
DEBUG=frys:* npm run dev

# 启用性能监控
NODE_ENV=development PERFORMANCE_MONITOR=true npm run dev
```

### 生产环境优化

```bash
# 使用 PM2 进程管理
npm install -g pm2
pm2 start dist/index.js --name frys-production
pm2 save
pm2 startup

# 配置日志轮转
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

---

## 🔒 安全配置

### 环境变量安全

```bash
# 生成强密码
openssl rand -base64 32

# 设置文件权限
chmod 600 .env

# 不要提交敏感文件
echo ".env*" >> .gitignore
```

### JWT 安全配置

```bash
# 使用强密钥
JWT_SECRET="$(openssl rand -base64 32)"

# 设置合理的过期时间
JWT_EXPIRES_IN=1h          # Access Token: 1小时
JWT_REFRESH_EXPIRES_IN=7d  # Refresh Token: 7天
```

### HTTPS 配置 (生产环境)

```bash
# 获取 SSL 证书 (Let's Encrypt)
sudo apt install certbot
sudo certbot certonly --standalone -d yourdomain.com

# 配置 HTTPS
ENABLE_HTTPS=true
SSL_CERT_PATH=/etc/letsencrypt/live/yourdomain.com/fullchain.pem
SSL_KEY_PATH=/etc/letsencrypt/live/yourdomain.com/privkey.pem
```

---

## 📚 相关资源

- **[快速开始](../../GETTING_STARTED.md)** - 完整使用指南
- **[环境变量](../../docs/development/environment-variables.md)** - 详细配置说明
- **[部署指南](../../docs/deployment/production-setup.md)** - 生产环境部署
- **[故障排除](../../docs/development/exception-handling-flow.md)** - 错误处理指南

---

<div align="center">

## 🎉 环境配置完成！

**现在您已经成功搭建了 frys 的开发环境**

[🏠 返回开发者指南](README.md) • [🚀 开始开发](../../GETTING_STARTED.md) • [🐛 遇到问题？](../../README.md#联系我们)

---

*最后更新: 2025年11月7日*

</div>
