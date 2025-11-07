/**
 * 认证中间件
 * 处理JWT令牌验证和用户身份认证
 */

import { logger } from '../../utils/logger.js';

export class AuthenticationMiddleware {
  constructor(authenticationService, options = {}) {
    this.authService = authenticationService;
    this.options = {
      headerName: options.headerName || 'authorization',
      tokenPrefix: options.tokenPrefix || 'Bearer',
      excludePaths: options.excludePaths || [
        '/auth/login',
        '/auth/register',
        '/auth/refresh',
        '/health',
      ],
      publicPaths: options.publicPaths || [],
      ...options,
    };
  }

  /**
   * 主要的认证中间件
   */
  authenticate() {
    return async (req, res, next) => {
      try {
        // 检查是否是公开路径
        if (this.isPublicPath(req.path, req.method)) {
          return next();
        }

        // 提取访问令牌
        const token = this.extractToken(req);
        if (!token) {
          return this.unauthorized(res, 'No token provided');
        }

        // 验证访问令牌
        const authResult = await this.authService.verifyAccessToken(token);
        if (!authResult) {
          return this.unauthorized(res, 'Invalid token');
        }

        // 将用户信息添加到请求对象
        req.user = authResult.user;
        req.tokenPayload = authResult.payload;
        req.sessionId = authResult.sessionId;

        // 记录认证成功
        logger.debug('User authenticated', {
          userId: req.user.id,
          username: req.user.username,
          sessionId: req.sessionId,
          path: req.path,
          method: req.method,
        });

        next();
      } catch (error) {
        logger.error('Authentication middleware error', {
          error: error.message,
          path: req.path,
          method: req.method,
          ip: req.ip,
        });

        if (error.name === 'JsonWebTokenError') {
          return this.unauthorized(res, 'Invalid token format');
        } else if (error.name === 'TokenExpiredError') {
          return this.unauthorized(res, 'Token expired');
        } else {
          return this.serverError(res, 'Authentication failed');
        }
      }
    };
  }

  /**
   * 可选认证中间件（不强制要求认证）
   */
  optionalAuthenticate() {
    return async (req, res, next) => {
      try {
        const token = this.extractToken(req);
        if (!token) {
          // 没有令牌，继续处理
          return next();
        }

        const authResult = await this.authService.verifyAccessToken(token);
        if (authResult) {
          req.user = authResult.user;
          req.tokenPayload = authResult.payload;
          req.sessionId = authResult.sessionId;
        }

        next();
      } catch (error) {
        // 可选认证失败不阻断请求
        logger.debug('Optional authentication failed', {
          error: error.message,
          path: req.path,
        });
        next();
      }
    };
  }

  /**
   * 提取令牌
   */
  extractToken(req) {
    // 从Authorization头提取
    const authHeader = req.headers[this.options.headerName.toLowerCase()];
    if (authHeader && authHeader.startsWith(this.options.tokenPrefix + ' ')) {
      return authHeader.substring(this.options.tokenPrefix.length + 1);
    }

    // 从查询参数提取
    if (req.query.token) {
      return req.query.token;
    }

    // 从Cookie提取
    if (req.cookies && req.cookies.token) {
      return req.cookies.token;
    }

    return null;
  }

  /**
   * 检查是否是公开路径
   */
  isPublicPath(path, method) {
    // 检查排除路径
    for (const excludePath of this.options.excludePaths) {
      if (this.matchesPath(path, excludePath)) {
        return true;
      }
    }

    // 检查公开路径
    for (const publicPath of this.options.publicPaths) {
      if (this.matchesPath(path, publicPath)) {
        return true;
      }
    }

    return false;
  }

  /**
   * 路径匹配（支持通配符）
   */
  matchesPath(requestPath, pattern) {
    if (pattern === requestPath) {
      return true;
    }

    // 转换为正则表达式
    const regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.')
      .replace(/\//g, '\\/');

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(requestPath);
  }

  /**
   * 未授权响应
   */
  unauthorized(res, message = 'Unauthorized') {
    res.status(401).json({
      error: 'Unauthorized',
      message,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 服务器错误响应
   */
  serverError(res, message = 'Internal Server Error') {
    res.status(500).json({
      error: 'Server Error',
      message,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 创建刷新令牌中间件
   */
  refreshToken() {
    return async (req, res, next) => {
      try {
        const refreshToken = req.body.refresh_token || req.query.refresh_token;
        if (!refreshToken) {
          return res.status(400).json({
            error: 'Bad Request',
            message: 'Refresh token is required',
          });
        }

        const result = await this.authService.refreshToken(refreshToken);

        res.json({
          success: true,
          data: result,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error('Token refresh failed', error);
        res.status(401).json({
          error: 'Unauthorized',
          message: error.message || 'Token refresh failed',
        });
      }
    };
  }

  /**
   * 创建会话验证中间件
   */
  requireValidSession() {
    return async (req, res, next) => {
      try {
        if (!req.sessionId) {
          return this.unauthorized(res, 'Valid session required');
        }

        // 这里可以添加额外的会话验证逻辑
        // 例如检查会话是否在特定IP或设备上

        next();
      } catch (error) {
        logger.error('Session validation failed', error);
        this.serverError(res, 'Session validation failed');
      }
    };
  }

  /**
   * 创建多因素认证检查中间件
   */
  requireMFA() {
    return async (req, res, next) => {
      try {
        const user = req.user;
        if (!user) {
          return this.unauthorized(res);
        }

        // 检查用户是否启用了MFA
        if (!user.mfaEnabled) {
          return res.status(403).json({
            error: 'Forbidden',
            message: 'Multi-factor authentication is required',
          });
        }

        // 检查MFA令牌
        const mfaToken = req.headers['x-mfa-token'] || req.body.mfa_token;
        if (!mfaToken) {
          return res.status(403).json({
            error: 'Forbidden',
            message: 'MFA token is required',
          });
        }

        // 这里应该验证MFA令牌
        // const isValidMFA = await this.authService.verifyMFAToken(user.id, mfaToken);
        // if (!isValidMFA) {
        //   return res.status(403).json({
        //     error: 'Forbidden',
        //     message: 'Invalid MFA token'
        //   });
        // }

        next();
      } catch (error) {
        logger.error('MFA validation failed', error);
        this.serverError(res, 'MFA validation failed');
      }
    };
  }

  /**
   * 创建速率限制中间件（基础实现）
   */
  rateLimit(options = {}) {
    const config = {
      windowMs: options.windowMs || 15 * 60 * 1000, // 15分钟
      maxRequests: options.maxRequests || 100,
      skipSuccessfulRequests: options.skipSuccessfulRequests || false,
      skipFailedRequests: options.skipFailedRequests || false,
      ...options,
    };

    const requests = new Map();

    return (req, res, next) => {
      const key = req.ip + ':' + (req.user ? req.user.id : 'anonymous');
      const now = Date.now();
      const windowStart = now - config.windowMs;

      // 获取或初始化请求记录
      let userRequests = requests.get(key) || [];
      userRequests = userRequests.filter((time) => time > windowStart);

      // 检查是否超过限制
      if (userRequests.length >= config.maxRequests) {
        logger.warn('Rate limit exceeded', {
          ip: req.ip,
          userId: req.user?.id,
          path: req.path,
          requestCount: userRequests.length,
        });

        return res.status(429).json({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded',
          retryAfter: Math.ceil(config.windowMs / 1000),
        });
      }

      // 记录请求
      userRequests.push(now);
      requests.set(key, userRequests);

      // 设置响应头
      res.set('X-RateLimit-Limit', config.maxRequests);
      res.set(
        'X-RateLimit-Remaining',
        Math.max(0, config.maxRequests - userRequests.length),
      );
      res.set(
        'X-RateLimit-Reset',
        new Date(windowStart + config.windowMs).toISOString(),
      );

      next();
    };
  }

  /**
   * 清理过期请求记录（可选的定期清理）
   */
  cleanupRateLimitData() {
    // 这个方法可以定期调用来清理内存
    if (this.rateLimitData) {
      const now = Date.now();
      for (const [key, timestamps] of this.rateLimitData.entries()) {
        const validTimestamps = timestamps.filter(
          (time) => now - time < 15 * 60 * 1000,
        );
        if (validTimestamps.length === 0) {
          this.rateLimitData.delete(key);
        } else {
          this.rateLimitData.set(key, validTimestamps);
        }
      }
    }
  }
}
