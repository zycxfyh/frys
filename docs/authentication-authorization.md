# 认证和授权系统架构

## 概述

frys 认证和授权系统提供了一套完整的用户身份验证和权限控制解决方案，支持JWT令牌、角色-based访问控制(RBAC)、多级权限检查和会话管理。

## 核心组件

### 1. 领域实体 (Domain Entities)

#### User (用户实体)
**位置**: `src/domain/entities/auth/User.js`

用户实体表示系统中的用户账号，包含以下特性：
- 用户名和邮箱验证
- 密码哈希存储
- 角色和权限分配
- 账户状态管理
- 登录历史跟踪

```javascript
const user = new User({
  id: 'user-123',
  username: 'johndoe',
  email: 'john@example.com',
  passwordHash: 'hashed-password',
  roles: ['user'],
  permissions: ['read:own_profile'],
  isActive: true
});
```

#### Role (角色实体)
**位置**: `src/domain/entities/auth/Role.js`

角色实体定义权限组，支持：
- 角色名称和描述
- 权限集合管理
- 系统角色标记
- 角色状态控制

#### Token & Session (令牌和会话实体)
**位置**: `src/domain/entities/auth/Token.js`

管理JWT令牌和用户会话：
- 访问令牌和刷新令牌
- 令牌撤销和过期管理
- 会话跟踪和活动监控
- 多设备登录支持

### 2. 领域服务 (Domain Services)

#### AuthenticationService (认证服务)
**位置**: `src/domain/services/auth/AuthenticationService.js`

处理用户认证相关操作：
- 用户注册和登录
- JWT令牌生成和管理
- 密码加密和验证
- 账户安全（登录尝试限制）
- 会话管理

**核心功能**:
```javascript
// 用户注册
const user = await authService.register({
  username: 'johndoe',
  email: 'john@example.com',
  password: 'securepassword'
});

// 用户登录
const loginResult = await authService.login({
  username: 'johndoe',
  password: 'securepassword',
  ipAddress: req.ip,
  userAgent: req.get('User-Agent')
});

// 令牌刷新
const tokens = await authService.refreshToken(refreshToken);

// 密码更改
await authService.changePassword(userId, 'oldpass', 'newpass');
```

#### AuthorizationService (授权服务)
**位置**: `src/domain/services/auth/AuthorizationService.js`

实现基于角色的访问控制：
- 权限检查（支持通配符）
- 角色权限聚合
- 上下文相关权限
- 权限缓存优化
- 中间件集成

**权限检查**:
```javascript
// 基本权限检查
const result = await authzService.checkPermission(user, 'documents:read');

// 多权限检查（OR逻辑）
const result = await authzService.checkAnyPermission(user, [
  'documents:read',
  'documents:write'
]);

// 全部权限检查（AND逻辑）
const result = await authzService.checkAllPermissions(user, [
  'documents:read',
  'documents:write'
]);
```

### 3. 仓库接口 (Repository Interfaces)

#### UserRepository
**位置**: `src/domain/repositories/auth/UserRepository.js`

用户数据访问接口：
- 按用户名/邮箱查找
- 用户搜索和分页
- 账户状态管理

#### RoleRepository
**位置**: `src/domain/repositories/auth/RoleRepository.js`

角色数据访问接口：
- 角色CRUD操作
- 用户角色关联
- 系统角色管理

#### TokenRepository & SessionRepository
令牌和会话数据管理接口。

### 4. 基础设施层 (Infrastructure)

#### AuthenticationMiddleware (认证中间件)
**位置**: `src/infrastructure/auth/AuthenticationMiddleware.js`

HTTP请求认证处理：
- JWT令牌验证
- 可选认证支持
- 会话管理
- 速率限制
- MFA支持

**使用方法**:
```javascript
// 必需认证
app.use('/api', authMiddleware.authenticate());

// 可选认证
app.use('/api/public', authMiddleware.optionalAuthenticate());

// 权限中间件
app.get('/api/admin', authzService.createPermissionMiddleware('admin:access'), handler);

// 角色中间件
app.get('/api/users', authzService.createRoleMiddleware('manager'), handler);
```

## 权限系统设计

### 权限格式

权限使用 `resource:action` 或 `resource:action:scope` 格式：

```
users:read              # 读取用户
users:write             # 写入用户
documents:read:own      # 只读自己的文档
documents:write:team    # 写入团队文档
admin:*                 # 管理员所有权限
```

### 角色层次结构

- **super_admin**: 超级管理员，拥有所有权限
- **admin**: 系统管理员，管理用户和配置
- **manager**: 部门经理，管理团队和项目
- **user**: 普通用户，基础功能权限

### 上下文权限

支持基于资源所有权的权限检查：

```javascript
// 检查用户是否能编辑特定项目
const canEdit = await authzService.checkContextPermission(
  user,
  'projects:edit',
  { type: 'project', id: 'project-123' },
  { organizationId: 'org-456' }
);
```

## 安全特性

### 1. 密码安全
- Argon2/Scrypt 密码哈希
- 密码复杂度要求
- 密码历史检查（防止重复使用）

### 2. 令牌安全
- JWT RS256签名
- 令牌过期和刷新机制
- 令牌黑名单管理
- 会话绑定

### 3. 账户保护
- 登录尝试限制
- 账户锁定机制
- 可疑活动检测
- 多因素认证支持

### 4. 会话管理
- 会话超时控制
- 并发会话限制
- 设备跟踪
- 远程注销

## API 接口

### 认证端点

```javascript
// 用户注册
POST /auth/register
{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "securepassword"
}

// 用户登录
POST /auth/login
{
  "username": "johndoe",
  "password": "securepassword"
}

// 令牌刷新
POST /auth/refresh
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}

// 用户注销
POST /auth/logout

// 获取当前用户信息
GET /auth/me

// 更改密码
PUT /auth/password
{
  "current_password": "oldpassword",
  "new_password": "newpassword"
}
```

### 响应格式

```javascript
// 登录响应
{
  "user": {
    "id": "user-123",
    "username": "johndoe",
    "email": "john@example.com",
    "roles": ["user"],
    "permissions": ["read:own_profile"]
  },
  "session": {
    "id": "session-123",
    "sessionId": "abc123...",
    "ipAddress": "192.168.1.1",
    "userAgent": "Mozilla/5.0...",
    "createdAt": "2024-01-01T00:00:00Z"
  },
  "tokens": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_in": 900,
    "refresh_expires_in": 604800,
    "token_type": "Bearer"
  }
}
```

## 配置选项

### 认证服务配置

```javascript
const authService = new AuthenticationService({
  jwtSecret: process.env.JWT_SECRET,
  jwtIssuer: 'frys',
  jwtAudience: 'frys-client',
  accessTokenExpiry: '15m',
  refreshTokenExpiry: '7d',
  maxLoginAttempts: 5,
  lockoutDuration: 15 * 60 * 1000,
  sessionTimeout: 24 * 60 * 60 * 1000
});
```

### 授权服务配置

```javascript
const authzService = new AuthorizationService({
  enablePermissionCaching: true,
  cacheTtl: 300000,
  superAdminRole: 'super_admin'
});
```

### 中间件配置

```javascript
const authMiddleware = new AuthenticationMiddleware(authService, {
  headerName: 'authorization',
  tokenPrefix: 'Bearer',
  excludePaths: ['/auth/login', '/auth/register', '/health'],
  publicPaths: ['/api/public/*']
});
```

## 数据库模式

### 用户表
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  is_email_verified BOOLEAN DEFAULT false,
  roles JSONB DEFAULT '[]',
  permissions JSONB DEFAULT '[]',
  profile JSONB DEFAULT '{}',
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 角色表
```sql
CREATE TABLE roles (
  id UUID PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  permissions JSONB DEFAULT '[]',
  is_system BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 令牌表
```sql
CREATE TABLE tokens (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  token_type VARCHAR(20) NOT NULL,
  token_value TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  is_revoked BOOLEAN DEFAULT false,
  revoked_at TIMESTAMP,
  revoked_reason VARCHAR(100),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 会话表
```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  session_id VARCHAR(255) UNIQUE NOT NULL,
  ip_address INET,
  user_agent TEXT,
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMP,
  last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 集成示例

### Express.js 集成

```javascript
import express from 'express';
import { createAuthRoutes } from './presentation/routes/auth.routes.js';

const app = express();

// 中间件设置
app.use(express.json());
app.use(authMiddleware.authenticate());

// 路由注册
app.use('/auth', createAuthRoutes(authService, authzService));

// 保护路由
app.get('/api/users', authzService.createPermissionMiddleware('users:read'), (req, res) => {
  res.json({ users: [] });
});

app.listen(3000);
```

### 权限装饰器 (用于其他框架)

```javascript
// 权限检查装饰器
export function RequirePermission(permission) {
  return function (target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args) {
      const user = this.getCurrentUser();
      const result = await this.authzService.checkPermission(user, permission);

      if (!result.granted) {
        throw new ForbiddenError('Insufficient permissions');
      }

      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}

// 使用装饰器
class UserService {
  @RequirePermission('users:read')
  async getUsers() {
    // 业务逻辑
  }

  @RequirePermission('users:write')
  async createUser(userData) {
    // 业务逻辑
  }
}
```

## 监控和日志

### 认证事件日志

系统记录所有重要认证事件：
- 用户注册/登录/注销
- 密码更改
- 令牌生成/撤销
- 权限检查失败
- 账户锁定/解锁

### 安全监控

- 登录失败尝试监控
- 可疑IP地址检测
- 异常会话活动告警
- 权限升级尝试检测

## 扩展和定制

### 自定义认证提供商

```javascript
class CustomAuthProvider {
  async authenticate(credentials) {
    // 自定义认证逻辑
  }

  async getUserProfile(userId) {
    // 获取用户资料
  }
}
```

### 第三方集成

支持OAuth 2.0、LDAP、SAML等第三方认证：
- Google OAuth
- GitHub OAuth
- LDAP/Active Directory
- SAML SSO

### 自定义权限提供商

```javascript
class CustomPermissionProvider {
  async checkPermission(user, permission, context) {
    // 自定义权限逻辑
  }

  async getUserPermissions(userId) {
    // 获取用户权限
  }
}
```

## 最佳实践

### 1. 密码策略
- 最少8个字符
- 包含大小写字母、数字、特殊字符
- 定期强制更改
- 防止常见密码

### 2. 令牌管理
- 短过期时间的访问令牌
- 安全的刷新令牌轮换
- 定期清理过期令牌
- 妥善存储客户端令牌

### 3. 会话安全
- HTTPS强制使用
- HttpOnly和Secure Cookie
- CSRF保护
- 会话固定攻击防护

### 4. 权限设计
- 最小权限原则
- 权限命名规范化
- 定期权限审计
- 权限变更审批流程

### 5. 监控告警
- 登录失败阈值告警
- 异常访问模式检测
- 权限滥用监控
- 安全事件响应流程

## 故障排除

### 常见问题

1. **令牌过期错误**
   - 检查客户端时钟同步
   - 验证JWT配置
   - 确认令牌存储完整性

2. **权限检查失败**
   - 验证用户角色分配
   - 检查权限缓存状态
   - 确认权限格式正确性

3. **会话丢失**
   - 检查中间件顺序
   - 验证会话存储
   - 确认Cookie设置

4. **性能问题**
   - 启用权限缓存
   - 优化数据库查询
   - 监控内存使用

通过这套完整的认证和授权系统，frys 提供了企业级的身份验证和权限控制解决方案，支持复杂的业务需求和高并发场景。
