# frys 表示层

## 📖 模块概述

frys 的表示层提供了HTTP API接口和数据传输对象，负责处理客户端请求、格式化响应数据、路由分发等功能。该层采用了控制器模式，将HTTP请求转换为业务逻辑调用，并确保数据的安全序列化和反序列化。

### 🎯 核心特性

- **RESTful API设计** - 标准的REST API接口规范
- **控制器模式** - 清晰的请求处理和响应格式化
- **数据传输对象** - 安全的数据序列化和DTO模式
- **路由管理** - 模块化的路由配置和中间件集成
- **错误处理** - 统一的HTTP错误响应处理

### 🏗️ 表示层架构

```
表示层
├── 🎮 控制器 (Controllers)
│   ├── 认证控制器 (AuthController)
│   ├── 用户控制器 (UserController)
│   └── 工作流控制器 (WorkflowController)
├── 🛣️ 路由配置 (Routes)
│   ├── 认证路由 (auth.routes.js)
│   ├── 用户路由 (user.routes.js)
│   ├── AI路由 (ai-routes.js)
│   └── API路由聚合 (api.routes.js)
├── 📨 中间件集成 (Middleware)
│   ├── 认证中间件 (authentication.middleware)
│   ├── 授权中间件 (authorization.middleware)
│   └── 验证中间件 (validation.middleware)
└── 📋 数据传输对象 (DTOs)
    ├── 请求DTO (Request DTOs)
    ├── 响应DTO (Response DTOs)
    └── 转换器 (Transformers)
```

## 🎮 控制器 (Controllers)

### 认证控制器 (AuthController)

认证控制器处理所有用户认证相关的HTTP请求，包括注册、登录、令牌管理等。

```javascript
import { AuthController } from 'frys-presentation';
import { BaseController } from 'frys-shared';

// 创建控制器实例
const authController = new AuthController(
  authenticationService,
  authorizationService
);

// 控制器方法
class AuthController extends BaseController {

  // 用户注册
  async register(req, res) {
    const { username, email, password, profile } = req.body;

    // 验证输入
    if (!username || !email || !password) {
      return this.badRequest(res, 'Required fields are missing');
    }

    try {
      const user = await this.authService.register({
        username, email, password, profile: profile || {}
      });

      return this.created(res, {
        user: user.toPublicDTO(),
        message: 'User registered successfully'
      });
    } catch (error) {
      return this.handleError(res, error);
    }
  }

  // 用户登录
  async login(req, res) {
    const { username, password } = req.body;

    if (!username || !password) {
      return this.badRequest(res, 'Username and password are required');
    }

    try {
      const result = await this.authService.login({
        username,
        password,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      return this.ok(res, {
        user: result.user,
        session: result.session,
        tokens: result.tokens,
        message: 'Login successful'
      });
    } catch (error) {
      return this.handleError(res, error);
    }
  }

  // 令牌刷新
  async refreshToken(req, res) {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return this.badRequest(res, 'Refresh token is required');
    }

    try {
      const result = await this.authService.refreshToken(refresh_token);
      return this.ok(res, result);
    } catch (error) {
      return this.unauthorized(res, 'Invalid refresh token');
    }
  }

  // 用户注销
  async logout(req, res) {
    try {
      await this.authService.logout(req.user.id, req.sessionId);
      return this.ok(res, { message: 'Logout successful' });
    } catch (error) {
      return this.handleError(res, error);
    }
  }

  // 获取当前用户信息
  async getCurrentUser(req, res) {
    try {
      const user = req.user;
      const permissions = await this.authzService.getUserPermissions(user.id);

      return this.ok(res, {
        user: {
          ...user.toPublicDTO(),
          permissions: permissions.all
        }
      });
    } catch (error) {
      return this.handleError(res, error);
    }
  }

  // 更改密码
  async changePassword(req, res) {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return this.badRequest(res, 'Both current and new passwords are required');
    }

    if (new_password.length < 8) {
      return this.badRequest(res, 'New password must be at least 8 characters');
    }

    try {
      await this.authService.changePassword(
        req.user.id, current_password, new_password
      );
      return this.ok(res, { message: 'Password changed successfully' });
    } catch (error) {
      return this.handleError(res, error);
    }
  }
}
```

### 控制器基类 (BaseController)

所有控制器的基类，提供统一的响应处理方法。

```javascript
class BaseController {
  // 成功响应
  ok(res, data, message = null) {
    return res.status(200).json({
      success: true,
      data,
      message,
      timestamp: new Date().toISOString()
    });
  }

  // 创建成功响应
  created(res, data, message = null) {
    return res.status(201).json({
      success: true,
      data,
      message,
      timestamp: new Date().toISOString()
    });
  }

  // 无内容响应
  noContent(res) {
    return res.status(204).send();
  }

  // 错误响应
  badRequest(res, message, details = null) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message,
        details
      },
      timestamp: new Date().toISOString()
    });
  }

  unauthorized(res, message = 'Unauthorized') {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message
      },
      timestamp: new Date().toISOString()
    });
  }

  forbidden(res, message = 'Forbidden') {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message
      },
      timestamp: new Date().toISOString()
    });
  }

  notFound(res, message = 'Not found') {
    return res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message
      },
      timestamp: new Date().toISOString()
    });
  }

  conflict(res, message = 'Conflict') {
    return res.status(409).json({
      success: false,
      error: {
        code: 'CONFLICT',
        message
      },
      timestamp: new Date().toISOString()
    });
  }

  internalError(res, error, message = 'Internal server error') {
    console.error('Controller error:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: process.env.NODE_ENV === 'production' ? message : error.message
      },
      timestamp: new Date().toISOString()
    });
  }

  // 统一错误处理
  handleError(res, error) {
    if (error.name === 'ValidationError') {
      return this.badRequest(res, error.message, error.details);
    }

    if (error.name === 'AuthenticationError') {
      return this.unauthorized(res, error.message);
    }

    if (error.name === 'AuthorizationError') {
      return this.forbidden(res, error.message);
    }

    if (error.name === 'NotFoundError') {
      return this.notFound(res, error.message);
    }

    return this.internalError(res, error);
  }
}
```

## 🛣️ 路由配置 (Routes)

### 认证路由配置

```javascript
import express from 'express';
import { AuthController } from '../controllers/AuthController.js';
import { authenticate, authorize } from '../middleware/index.js';

const router = express.Router();

// 控制器实例（通过依赖注入获取）
const authController = container.resolve('authController');

// 公开路由
router.post('/register', (req, res) => authController.register(req, res));
router.post('/login', (req, res) => authController.login(req, res));
router.post('/refresh-token', (req, res) => authController.refreshToken(req, res));
router.post('/forgot-password', (req, res) => authController.forgotPassword(req, res));
router.get('/verify-email', (req, res) => authController.verifyEmail(req, res));

// 需要认证的路由
router.use(authenticate); // JWT认证中间件

router.post('/logout', (req, res) => authController.logout(req, res));
router.get('/me', (req, res) => authController.getCurrentUser(req, res));
router.post('/change-password', (req, res) => authController.changePassword(req, res));

// 管理员路由
router.get('/sessions/:userId?', authorize(['users:view_sessions']),
  (req, res) => authController.getUserSessions(req, res)
);

router.delete('/sessions/:sessionId', authorize(['users:terminate_sessions']),
  (req, res) => authController.terminateSession(req, res)
);

router.post('/reset-password', authorize(['users:reset_password']),
  (req, res) => authController.resetPassword(req, res)
);

router.get('/stats', authorize(['auth:view_stats']),
  (req, res) => authController.getAuthStats(req, res)
);

export default router;
```

### API路由聚合

```javascript
import express from 'express';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import aiRoutes from './ai-routes.js';
import workflowRoutes from './workflow.routes.js';

const router = express.Router();

// API版本控制
const API_VERSION = 'v1';
const apiRouter = express.Router();

// 健康检查（无认证）
apiRouter.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    version: API_VERSION,
    timestamp: new Date().toISOString()
  });
});

// API路由
apiRouter.use('/auth', authRoutes);
apiRouter.use('/users', userRoutes);
apiRouter.use('/ai', aiRoutes);
apiRouter.use('/workflows', workflowRoutes);

// 版本化路由
router.use(`/api/${API_VERSION}`, apiRouter);

// 兼容性路由（重定向到v1）
router.use('/api', (req, res, next) => {
  if (!req.path.startsWith('/v')) {
    return res.redirect(301, `/api/${API_VERSION}${req.path}`);
  }
  next();
});

export default router;
```

### 路由中间件集成

```javascript
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { rateLimit } from 'express-rate-limit';

// 应用级中间件
const setupMiddleware = (app) => {
  // 安全中间件
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  }));

  // CORS配置
  app.use(cors({
    origin: process.env.NODE_ENV === 'production'
      ? process.env.ALLOWED_ORIGINS?.split(',') || ['https://yourdomain.com']
      : ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  }));

  // 压缩中间件
  app.use(compression({
    level: 6, // 压缩级别
    threshold: 1024, // 最小压缩大小
    filter: (req, res) => {
      // 不压缩图片和视频
      if (req.headers['accept-encoding']?.includes('gzip')) {
        return compression.filter(req, res);
      }
      return false;
    }
  }));

  // 请求体解析
  app.use(express.json({
    limit: '10mb',
    strict: true,
    verify: (req, res, buf) => {
      // 验证JSON格式
      try {
        JSON.parse(buf);
      } catch (e) {
        res.status(400).json({
          error: 'Invalid JSON format'
        });
        throw new Error('Invalid JSON');
      }
    }
  }));

  app.use(express.urlencoded({
    extended: false,
    limit: '10mb'
  }));

  // 请求速率限制
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 100, // 每个IP 15分钟内最多100个请求
    message: {
      error: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    // 白名单IP
    skip: (req) => {
      const whitelist = process.env.RATE_LIMIT_WHITELIST?.split(',') || [];
      return whitelist.includes(req.ip);
    },
    // 自定义键生成器
    keyGenerator: (req) => {
      // 基于用户ID或IP
      return req.user?.id || req.ip;
    }
  });

  app.use('/api/', limiter);

  // API特定速率限制
  const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1分钟
    max: 30, // 每分钟最多30个API请求
    message: 'API rate limit exceeded',
    skip: (req) => req.user?.role === 'admin'
  });

  app.use('/api/v1', apiLimiter);
};
```

## 📨 中间件集成 (Middleware)

### 认证中间件

```javascript
import jwt from 'jsonwebtoken';

export const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Access token is required'
      });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 将用户信息添加到请求对象
    req.user = decoded.user;
    req.tokenPayload = decoded;
    req.sessionId = decoded.sessionId;

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expired'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Invalid token'
      });
    }

    return res.status(500).json({
      error: 'Authentication error'
    });
  }
};

// 可选认证中间件（用于公开接口但需要用户信息）
export const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded.user;
      req.tokenPayload = decoded;
      req.sessionId = decoded.sessionId;
    }

    next();
  } catch (error) {
    // 忽略认证错误，继续处理请求
    next();
  }
};
```

### 授权中间件

```javascript
export const authorize = (requiredPermissions) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Authentication required'
        });
      }

      // 检查权限
      const hasPermission = await checkUserPermissions(
        req.user.id,
        requiredPermissions
      );

      if (!hasPermission) {
        return res.status(403).json({
          error: 'Insufficient permissions'
        });
      }

      next();
    } catch (error) {
      return res.status(500).json({
        error: 'Authorization error'
      });
    }
  };
};

// 角色-based授权
export const requireRole = (requiredRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required'
      });
    }

    const userRoles = req.user.roles || [];
    const hasRequiredRole = requiredRoles.some(role => userRoles.includes(role));

    if (!hasRequiredRole) {
      return res.status(403).json({
        error: 'Insufficient role permissions'
      });
    }

    next();
  };
};

// 所有者检查中间件
export const requireOwnership = (resourceIdParam = 'id') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required'
      });
    }

    const resourceId = req.params[resourceIdParam];
    const userId = req.user.id;

    // 这里应该检查资源所有权
    // 简化版本：假设资源ID包含用户ID或有所有权检查服务

    if (!resourceId.includes(userId) && !req.user.roles.includes('admin')) {
      return res.status(403).json({
        error: 'Access denied: not resource owner'
      });
    }

    next();
  };
};
```

### 验证中间件

```javascript
import { InputValidationMiddleware } from 'frys-middleware';

const validationMiddleware = new InputValidationMiddleware({
  failOnSecurityViolation: true,
  sanitizeInput: true,
  logViolations: true,
});

// 请求验证中间件
export const validateRequest = (schemaName) => {
  return async (req, res, next) => {
    try {
      const result = await validationMiddleware.validateRequestBody(
        req.body,
        req.path
      );

      if (!result.valid) {
        return res.status(400).json({
          error: 'Validation failed',
          details: result.errors
        });
      }

      // 使用验证后的数据
      req.body = result.data;
      next();
    } catch (error) {
      return res.status(500).json({
        error: 'Validation error'
      });
    }
  };
};

// 参数验证中间件
export const validateParams = (paramValidators) => {
  return (req, res, next) => {
    const errors = [];

    for (const [param, validator] of Object.entries(paramValidators)) {
      const value = req.params[param];

      if (!validator(value)) {
        errors.push(`Invalid parameter: ${param}`);
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        error: 'Parameter validation failed',
        details: errors
      });
    }

    next();
  };
};

// 文件上传验证中间件
export const validateFileUpload = (options = {}) => {
  const {
    maxSize = 10 * 1024 * 1024, // 10MB
    allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'],
    required = false,
  } = options;

  return (req, res, next) => {
    const files = req.files || (req.file ? [req.file] : []);

    if (required && files.length === 0) {
      return res.status(400).json({
        error: 'File upload is required'
      });
    }

    for (const file of files) {
      if (file.size > maxSize) {
        return res.status(400).json({
          error: `File size exceeds maximum allowed size (${maxSize} bytes)`
        });
      }

      if (!allowedTypes.includes(file.mimetype)) {
        return res.status(400).json({
          error: `File type ${file.mimetype} is not allowed`
        });
      }
    }

    next();
  };
};
```

## 📋 数据传输对象 (DTOs)

### 请求DTO

```javascript
// 用户注册请求DTO
export class CreateUserRequest {
  constructor(data) {
    this.username = data.username;
    this.email = data.email;
    this.password = data.password;
    this.firstName = data.firstName;
    this.lastName = data.lastName;
    this.profile = data.profile || {};
  }

  validate() {
    const errors = [];

    if (!this.username || this.username.length < 3) {
      errors.push('Username must be at least 3 characters');
    }

    if (!this.email || !this.isValidEmail(this.email)) {
      errors.push('Valid email is required');
    }

    if (!this.password || this.password.length < 8) {
      errors.push('Password must be at least 8 characters');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  toDomain() {
    return {
      username: this.username,
      email: this.email,
      passwordHash: this.hashPassword(this.password),
      profile: {
        firstName: this.firstName,
        lastName: this.lastName,
        ...this.profile,
      },
    };
  }
}

// 分页请求DTO
export class PaginationRequest {
  constructor(data) {
    this.page = Math.max(1, parseInt(data.page) || 1);
    this.limit = Math.min(100, Math.max(1, parseInt(data.limit) || 10));
    this.sort = data.sort || 'createdAt';
    this.order = ['asc', 'desc'].includes(data.order) ? data.order : 'desc';
    this.search = data.search;
    this.filters = data.filters || {};
  }

  get offset() {
    return (this.page - 1) * this.limit;
  }

  toQueryOptions() {
    return {
      offset: this.offset,
      limit: this.limit,
      order: [[this.sort, this.order.toUpperCase()]],
      where: this.buildWhereClause(),
    };
  }

  buildWhereClause() {
    const where = {};

    if (this.search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${this.search}%` } },
        { email: { [Op.iLike]: `%${this.search}%` } },
      ];
    }

    // 添加其他过滤器
    Object.assign(where, this.filters);

    return where;
  }
}
```

### 响应DTO

```javascript
// 用户响应DTO
export class UserResponse {
  constructor(user) {
    this.id = user.id;
    this.username = user.username;
    this.email = user.email;
    this.isActive = user.isActive;
    this.isEmailVerified = user.isEmailVerified;
    this.roles = user.roles;
    this.profile = user.profile;
    this.createdAt = user.createdAt;
    this.updatedAt = user.updatedAt;
  }

  // 公开信息（不包含敏感数据）
  static fromUser(user) {
    return new UserResponse(user);
  }

  // 管理员视图（包含所有信息）
  static fromUserAdmin(user) {
    const response = new UserResponse(user);
    response.lastLoginAt = user.lastLoginAt;
    response.permissions = user.permissions;
    return response;
  }

  // 列表视图（简化信息）
  static fromUserList(user) {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }
}

// 分页响应DTO
export class PaginatedResponse {
  constructor(data, pagination) {
    this.data = data;
    this.pagination = {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      totalPages: Math.ceil(pagination.total / pagination.limit),
      hasNext: pagination.page * pagination.limit < pagination.total,
      hasPrev: pagination.page > 1,
    };
  }

  static create(items, page, limit, total) {
    return new PaginatedResponse(items, { page, limit, total });
  }
}

// API响应包装器
export class ApiResponse {
  constructor(success = true, data = null, message = null, error = null) {
    this.success = success;
    this.data = data;
    this.message = message;
    this.error = error;
    this.timestamp = new Date().toISOString();
  }

  static success(data, message = null) {
    return new ApiResponse(true, data, message);
  }

  static error(error, message = 'An error occurred') {
    return new ApiResponse(false, null, message, error);
  }

  static paginated(data, pagination, message = null) {
    return new ApiResponse(true, new PaginatedResponse(data, pagination), message);
  }
}
```

### 数据转换器

```javascript
// 用户数据转换器
export class UserTransformer {
  // 领域模型 -> DTO
  static toDTO(user) {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      isActive: user.isActive,
      isEmailVerified: user.isEmailVerified,
      roles: user.roles,
      permissions: user.permissions,
      profile: user.profile,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  // DTO -> 领域模型
  static toDomain(dto) {
    return {
      id: dto.id,
      username: dto.username,
      email: dto.email,
      passwordHash: dto.passwordHash,
      isActive: dto.isActive !== undefined ? dto.isActive : true,
      isEmailVerified: dto.isEmailVerified || false,
      roles: dto.roles || [],
      permissions: dto.permissions || [],
      profile: dto.profile || {},
      lastLoginAt: dto.lastLoginAt,
      createdAt: dto.createdAt || new Date(),
      updatedAt: dto.updatedAt || new Date(),
    };
  }

  // 公开DTO（不包含敏感信息）
  static toPublicDTO(user) {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      isActive: user.isActive,
      isEmailVerified: user.isEmailVerified,
      roles: user.roles,
      profile: user.profile,
      createdAt: user.createdAt,
    };
  }

  // 数据库记录 -> 领域模型
  static fromDatabase(record) {
    return {
      id: record.id,
      username: record.username,
      email: record.email,
      passwordHash: record.password_hash,
      isActive: record.is_active,
      isEmailVerified: record.is_email_verified,
      roles: record.roles || [],
      permissions: record.permissions || [],
      profile: record.profile || {},
      lastLoginAt: record.last_login_at,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  }

  // 领域模型 -> 数据库记录
  static toDatabase(user) {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      password_hash: user.passwordHash,
      is_active: user.isActive,
      is_email_verified: user.isEmailVerified,
      roles: user.roles,
      permissions: user.permissions,
      profile: user.profile,
      last_login_at: user.lastLoginAt,
      created_at: user.createdAt,
      updated_at: user.updatedAt,
    };
  }
}

// 通用转换器工厂
export class TransformerFactory {
  static create(entityName) {
    const transformers = {
      user: UserTransformer,
      // 添加其他实体的转换器
    };

    return transformers[entityName] || null;
  }

  // 批量转换
  static transformMany(items, transformer, method = 'toDTO') {
    return items.map(item => transformer[method](item));
  }

  // 条件转换
  static transformConditional(item, condition, trueTransformer, falseTransformer) {
    const transformer = condition(item) ? trueTransformer : falseTransformer;
    return transformer.toDTO(item);
  }
}
```

## 🔧 依赖注入配置

### 表示层服务注册

```javascript
import { container } from 'frys';

// 注册控制器
container.register('authController', (c) => new AuthController(
  c.resolve('authenticationService'),
  c.resolve('authorizationService')
));

container.register('userController', (c) => new UserController(
  c.resolve('userService'),
  c.resolve('authorizationService')
));

// 注册中间件
container.register('inputValidationMiddleware', (c) => new InputValidationMiddleware({
  validator: c.resolve('zodValidator')
}));

container.register('performanceMonitoringMiddleware', (c) => new PerformanceMonitoringMiddleware({
  enabled: true,
  slowRequestThreshold: 1000
}));

// 注册路由
container.register('authRoutes', (c) => createAuthRoutes(c.resolve('authController')));
container.register('apiRoutes', (c) => createApiRoutes({
  auth: c.resolve('authRoutes'),
  users: c.resolve('userRoutes'),
  ai: c.resolve('aiRoutes'),
}));
```

## 📊 监控和指标

### 表示层指标

```javascript
// API请求指标
const apiMetrics = {
  totalRequests: await apiMonitor.getTotalRequests(),
  requestsByEndpoint: await apiMonitor.getRequestsByEndpoint(),
  requestsByMethod: await apiMonitor.getRequestsByMethod(),
  requestsByStatus: await apiMonitor.getRequestsByStatus(),
  averageResponseTime: await apiMonitor.getAverageResponseTime(),
  errorRate: await apiMonitor.getErrorRate(),
  topSlowEndpoints: await apiMonitor.getTopSlowEndpoints(10),
};

// 认证指标
const authMetrics = {
  loginAttempts: await authController.getLoginAttempts(),
  successfulLogins: await authController.getSuccessfulLogins(),
  failedLogins: await authController.getFailedLogins(),
  activeSessions: await authController.getActiveSessions(),
  tokenRefreshRate: await authController.getTokenRefreshRate(),
};

// 控制器性能指标
const controllerMetrics = {
  authController: {
    averageResponseTime: await performanceMonitor.getControllerMetrics('auth'),
    errorRate: await performanceMonitor.getControllerErrorRate('auth'),
    throughput: await performanceMonitor.getControllerThroughput('auth'),
  },
  userController: {
    averageResponseTime: await performanceMonitor.getControllerMetrics('user'),
    errorRate: await performanceMonitor.getControllerErrorRate('user'),
    throughput: await performanceMonitor.getControllerThroughput('user'),
  },
};
```

## 🧪 测试策略

### 控制器单元测试

```javascript
import { describe, it, expect, vi } from 'vitest';
import { AuthController } from '../controllers/AuthController.js';

describe('AuthController', () => {
  let controller;
  let mockAuthService;
  let mockAuthzService;
  let mockRequest;
  let mockResponse;

  beforeEach(() => {
    mockAuthService = {
      register: vi.fn(),
      login: vi.fn(),
      logout: vi.fn(),
    };

    mockAuthzService = {
      getUserPermissions: vi.fn(),
    };

    controller = new AuthController(mockAuthService, mockAuthzService);

    mockRequest = {
      body: {},
      ip: '127.0.0.1',
      get: vi.fn(() => 'TestAgent/1.0'),
    };

    mockResponse = {
      status: vi.fn(() => mockResponse),
      json: vi.fn(() => mockResponse),
      send: vi.fn(() => mockResponse),
    };
  });

  it('should register user successfully', async () => {
    const userData = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'TestPass123',
    };

    const mockUser = {
      id: 'user-123',
      ...userData,
      toPublicDTO: () => ({ id: 'user-123', username: userData.username }),
    };

    mockRequest.body = userData;
    mockAuthService.register.mockResolvedValue(mockUser);

    await controller.register(mockRequest, mockResponse);

    expect(mockAuthService.register).toHaveBeenCalledWith(userData);
    expect(mockResponse.status).toHaveBeenCalledWith(201);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          user: mockUser.toPublicDTO(),
          message: 'User registered successfully'
        })
      })
    );
  });

  it('should handle registration validation error', async () => {
    mockRequest.body = { username: 'ab' }; // Invalid data

    await controller.register(mockRequest, mockResponse);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'BAD_REQUEST'
        })
      })
    );
  });

  it('should handle login successfully', async () => {
    const loginData = {
      username: 'testuser',
      password: 'TestPass123',
    };

    const mockResult = {
      user: { id: 'user-123', username: 'testuser' },
      session: { sessionId: 'session-123' },
      tokens: {
        accessToken: { value: 'access-token', expiresAt: new Date() },
        refreshToken: { value: 'refresh-token', expiresAt: new Date() },
      },
    };

    mockRequest.body = loginData;
    mockAuthService.login.mockResolvedValue(mockResult);

    await controller.login(mockRequest, mockResponse);

    expect(mockAuthService.login).toHaveBeenCalledWith({
      username: loginData.username,
      password: loginData.password,
      ipAddress: mockRequest.ip,
      userAgent: 'TestAgent/1.0',
    });

    expect(mockResponse.status).toHaveBeenCalledWith(200);
  });
});
```

### 路由集成测试

```javascript
import request from 'supertest';
import express from 'express';
import authRoutes from '../routes/auth.routes.js';

describe('Auth Routes Integration', () => {
  let app;
  let mockAuthService;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    // Mock服务
    mockAuthService = {
      register: vi.fn(),
      login: vi.fn(),
    };

    // 创建控制器实例
    const authController = new AuthController(mockAuthService, {});

    // 注册路由
    app.use('/auth', authRoutes(authController));
  });

  it('should register user via API', async () => {
    const userData = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'TestPass123',
    };

    const mockUser = {
      id: 'user-123',
      toPublicDTO: () => ({ id: 'user-123', username: 'testuser' }),
    };

    mockAuthService.register.mockResolvedValue(mockUser);

    const response = await request(app)
      .post('/auth/register')
      .send(userData)
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.user.id).toBe('user-123');
  });

  it('should validate required fields', async () => {
    const response = await request(app)
      .post('/auth/register')
      .send({ username: 'test' }) // Missing email and password
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('BAD_REQUEST');
  });

  it('should handle service errors', async () => {
    mockAuthService.register.mockRejectedValue(new Error('Database error'));

    const response = await request(app)
      .post('/auth/register')
      .send({
        username: 'testuser',
        email: 'test@example.com',
        password: 'TestPass123',
      })
      .expect(500);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('INTERNAL_ERROR');
  });
});
```

## ❓ 常见问题

### Q: 如何设计RESTful API？

**A:** RESTful API设计原则：

```javascript
// 资源命名 - 使用复数名词
GET    /api/v1/users       // 获取用户列表
GET    /api/v1/users/:id   // 获取单个用户
POST   /api/v1/users       // 创建用户
PUT    /api/v1/users/:id   // 更新用户（全量）
PATCH  /api/v1/users/:id   // 更新用户（部分）
DELETE /api/v1/users/:id   // 删除用户

// 子资源
GET    /api/v1/users/:id/posts     // 获取用户的文章
POST   /api/v1/users/:id/posts     // 为用户创建文章

// 动作资源（如果不是CRUD）
POST   /api/v1/users/:id/reset-password  // 重置密码
POST   /api/v1/auth/login               // 用户登录
POST   /api/v1/auth/logout              // 用户登出

// 查询参数
GET    /api/v1/users?page=1&limit=10&sort=name&order=asc&search=john
GET    /api/v1/users?status=active&role=admin

// 响应格式
{
  "success": true,
  "data": { /* 实际数据 */ },
  "message": "可选的消息",
  "timestamp": "2024-01-01T00:00:00.000Z"
}

// 错误响应
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "输入验证失败",
    "details": ["邮箱格式无效", "密码强度不足"]
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Q: 如何处理API版本控制？

**A:** API版本控制策略：

```javascript
// URL路径版本控制（推荐）
app.use('/api/v1', v1Routes);
app.use('/api/v2', v2Routes);

// 自定义版本控制中间件
const apiVersioning = (req, res, next) => {
  const version = req.headers['api-version'] ||
                  req.query.version ||
                  req.path.split('/')[2]; // 从路径提取版本

  req.apiVersion = version;
  next();
};

// Accept header版本控制
const acceptVersioning = (req, res, next) => {
  const accept = req.headers.accept || '';
  const version = accept.match(/application\/vnd\.api\.v(\d+)\+json/)?.[1];

  if (version) {
    req.apiVersion = `v${version}`;
  }

  next();
};

// 版本兼容性处理
const handleVersionCompatibility = (req, res, next) => {
  const supportedVersions = ['v1', 'v2'];
  const requestedVersion = req.apiVersion || 'v1';

  if (!supportedVersions.includes(requestedVersion)) {
    return res.status(400).json({
      error: `API version ${requestedVersion} is not supported`
    });
  }

  // 根据版本调整响应格式
  res.apiVersion = requestedVersion;
  next();
};

// 版本化控制器
class VersionedUserController extends BaseController {
  async getUser(req, res) {
    const user = await this.userService.getUser(req.params.id);

    // 根据API版本调整响应格式
    if (req.apiVersion === 'v2') {
      return this.ok(res, this.toV2Format(user));
    }

    return this.ok(res, this.toV1Format(user));
  }

  toV1Format(user) {
    return {
      id: user.id,
      name: `${user.firstName} ${user.lastName}`,
      email: user.email,
    };
  }

  toV2Format(user) {
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      profile: user.profile,
    };
  }
}
```

### Q: 如何实现API限流？

**A:** 多层次API限流策略：

```javascript
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';

// 全局限流
const globalLimiter = rateLimit({
  store: new RedisStore({
    client: redisClient,
    prefix: 'rl:global:',
  }),
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 1000, // 每个IP最多1000个请求
  message: 'Too many requests from this IP',
  standardHeaders: true,
  legacyHeaders: false,
});

// API限流
const apiLimiter = rateLimit({
  store: new RedisStore({
    client: redisClient,
    prefix: 'rl:api:',
  }),
  windowMs: 60 * 1000, // 1分钟
  max: (req) => {
    // 基于用户角色的动态限流
    if (req.user?.role === 'premium') return 100;
    if (req.user?.role === 'admin') return 500;
    return 30; // 普通用户
  },
  keyGenerator: (req) => req.user?.id || req.ip,
});

// 端点特定限流
const authLimiter = rateLimit({
  store: new RedisStore({
    client: redisClient,
    prefix: 'rl:auth:',
  }),
  windowMs: 60 * 1000, // 1分钟
  max: 5, // 登录尝试最多5次
  message: 'Too many login attempts',
  skipSuccessfulRequests: true, // 成功请求不计入限流
});

// 滑动窗口限流
class SlidingWindowLimiter {
  constructor(redis, windowMs, maxRequests) {
    this.redis = redis;
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  async checkLimit(key) {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // 使用Redis有序集合实现滑动窗口
    const multi = this.redis.multi();

    // 移除过期请求
    multi.zremrangebyscore(key, 0, windowStart);

    // 添加当前请求
    multi.zadd(key, now, now.toString());

    // 统计窗口内的请求数
    multi.zcount(key, windowStart, now);

    // 设置过期时间
    multi.expire(key, Math.ceil(this.windowMs / 1000));

    const results = await multi.exec();
    const requestCount = results[2][1];

    return requestCount <= this.maxRequests;
  }
}

// 应用限流中间件
app.use(globalLimiter);
app.use('/api/v1', apiLimiter);
app.use('/auth/login', authLimiter);
```

## 📚 相关链接

- [应用服务层文档](application-layer.md) - 应用服务层的实现
- [领域驱动设计文档](domain-layer.md) - 领域层设计模式
- [基础设施层文档](infrastructure-layer.md) - 基础设施实现
- [API 文档](api-documentation.md) - 完整的API参考
- [测试策略](testing-architecture.md) - 测试最佳实践
