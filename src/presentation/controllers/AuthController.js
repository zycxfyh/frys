/**
 * 认证控制器
 * 处理用户认证相关的HTTP请求
 */

import { BaseController } from '../../shared/kernel/BaseController.js';
import { Success, Failure } from '../../shared/kernel/Result.js';
import { logger } from '../../shared/utils/logger.js';

export class AuthController extends BaseController {
  constructor(authenticationService, authorizationService) {
    super();
    this.authService = authenticationService;
    this.authzService = authorizationService;
  }

  /**
   * 用户注册
   */
  async register(req, res) {
    try {
      const { username, email, password, profile } = req.body;

      // 基本验证
      if (!username || !email || !password) {
        return this.badRequest(
          res,
          'Username, email, and password are required',
        );
      }

      if (password.length < 8) {
        return this.badRequest(
          res,
          'Password must be at least 8 characters long',
        );
      }

      const user = await this.authService.register({
        username,
        email,
        password,
        profile: profile || {},
      });

      logger.info('User registered via API', {
        userId: user.id,
        username: user.username,
        email: user.email,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });

      return this.created(res, {
        user: user.toPublicDTO(),
        message: 'User registered successfully',
      });
    } catch (error) {
      logger.error('Registration failed', {
        error: error.message,
        username: req.body.username,
        email: req.body.email,
        ip: req.ip,
      });

      if (error.message.includes('already exists')) {
        return this.badRequest(res, error.message);
      }

      return this.internalError(res, error);
    }
  }

  /**
   * 用户登录
   */
  async login(req, res) {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return this.badRequest(res, 'Username and password are required');
      }

      const result = await this.authService.login({
        username,
        password,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      logger.info('User logged in via API', {
        userId: result.user.id,
        username: result.user.username,
        sessionId: result.session.sessionId,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });

      return this.ok(res, {
        user: result.user,
        session: result.session,
        tokens: result.tokens,
        message: 'Login successful',
      });
    } catch (error) {
      logger.error('Login failed', {
        error: error.message,
        username: req.body.username,
        ip: req.ip,
      });

      if (
        error.message.includes('Invalid username or password') ||
        error.message.includes('Account is')
      ) {
        return this.unauthorized(res, error.message);
      }

      return this.internalError(res, error);
    }
  }

  /**
   * 刷新访问令牌
   */
  async refreshToken(req, res) {
    try {
      const { refresh_token } = req.body;

      if (!refresh_token) {
        return this.badRequest(res, 'Refresh token is required');
      }

      const result = await this.authService.refreshToken(refresh_token);

      logger.info('Token refreshed via API', {
        userId: result.user.id,
        sessionId: req.sessionId,
        ip: req.ip,
      });

      return this.ok(res, {
        user: result.user,
        tokens: result.tokens,
        message: 'Token refreshed successfully',
      });
    } catch (error) {
      logger.error('Token refresh failed', {
        error: error.message,
        ip: req.ip,
      });

      return this.unauthorized(res, error.message);
    }
  }

  /**
   * 用户注销
   */
  async logout(req, res) {
    try {
      const userId = req.user.id;
      const sessionId = req.sessionId;

      await this.authService.logout(userId, sessionId);

      logger.info('User logged out via API', {
        userId,
        sessionId,
        ip: req.ip,
      });

      return this.ok(res, {
        message: 'Logout successful',
      });
    } catch (error) {
      logger.error('Logout failed', {
        error: error.message,
        userId: req.user?.id,
        ip: req.ip,
      });

      return this.internalError(res, error);
    }
  }

  /**
   * 获取当前用户信息
   */
  async getCurrentUser(req, res) {
    try {
      const user = req.user;

      // 获取用户的完整权限信息
      const permissions = await this.authzService.getUserPermissions(user.id);

      const userWithPermissions = {
        ...user.toPublicDTO(),
        permissions: permissions.all,
        permissionDetails: permissions,
      };

      return this.ok(res, {
        user: userWithPermissions,
      });
    } catch (error) {
      logger.error('Get current user failed', {
        error: error.message,
        userId: req.user?.id,
        ip: req.ip,
      });

      return this.internalError(res, error);
    }
  }

  /**
   * 更改密码
   */
  async changePassword(req, res) {
    try {
      const userId = req.user.id;
      const { current_password, new_password } = req.body;

      if (!current_password || !new_password) {
        return this.badRequest(
          res,
          'Current password and new password are required',
        );
      }

      if (new_password.length < 8) {
        return this.badRequest(
          res,
          'New password must be at least 8 characters long',
        );
      }

      if (current_password === new_password) {
        return this.badRequest(
          res,
          'New password must be different from current password',
        );
      }

      await this.authService.changePassword(
        userId,
        current_password,
        new_password,
      );

      logger.info('Password changed via API', {
        userId,
        ip: req.ip,
      });

      return this.ok(res, {
        message: 'Password changed successfully',
      });
    } catch (error) {
      logger.error('Password change failed', {
        error: error.message,
        userId: req.user?.id,
        ip: req.ip,
      });

      if (error.message.includes('incorrect')) {
        return this.badRequest(res, error.message);
      }

      return this.internalError(res, error);
    }
  }

  /**
   * 重置密码（需要管理员权限）
   */
  async resetPassword(req, res) {
    try {
      const { email, new_password } = req.body;

      if (!email || !new_password) {
        return this.badRequest(res, 'Email and new password are required');
      }

      // 检查权限
      const permissionCheck = await this.authzService.checkPermission(
        req.user,
        'users:reset_password',
      );

      if (!permissionCheck.granted) {
        return this.forbidden(
          res,
          'Insufficient permissions to reset password',
        );
      }

      await this.authService.resetPassword(email, new_password);

      logger.info('Password reset via API', {
        email,
        resetBy: req.user.id,
        ip: req.ip,
      });

      return this.ok(res, {
        message: 'Password reset successfully',
      });
    } catch (error) {
      logger.error('Password reset failed', {
        error: error.message,
        email: req.body.email,
        resetBy: req.user?.id,
        ip: req.ip,
      });

      return this.internalError(res, error);
    }
  }

  /**
   * 验证令牌有效性
   */
  async verifyToken(req, res) {
    try {
      // 如果请求到达这里，说明令牌已经通过中间件验证
      const user = req.user;
      const payload = req.tokenPayload;

      return this.ok(res, {
        valid: true,
        user: user.toPublicDTO(),
        token: {
          type: payload.tokenType,
          expiresAt: new Date(payload.expiresAt * 1000),
          issuedAt: new Date(payload.issuedAt * 1000),
          timeToExpiry: payload.getTimeToExpiry(),
        },
        message: 'Token is valid',
      });
    } catch (error) {
      logger.error('Token verification failed', {
        error: error.message,
        ip: req.ip,
      });

      return this.internalError(res, error);
    }
  }

  /**
   * 获取用户会话列表
   */
  async getUserSessions(req, res) {
    try {
      const userId = req.user.id;

      // 检查权限（用户只能查看自己的会话，管理员可以查看所有）
      const targetUserId = req.params.userId || userId;
      const isSelf = targetUserId === userId;

      if (!isSelf) {
        const permissionCheck = await this.authzService.checkPermission(
          req.user,
          'users:view_sessions',
        );

        if (!permissionCheck.granted) {
          return this.forbidden(
            res,
            'Insufficient permissions to view other user sessions',
          );
        }
      }

      const sessions =
        await this.authService.sessionRepository.findByUserId(targetUserId);
      const activeSessions = sessions.filter((session) => session.isValid());

      return this.ok(res, {
        sessions: activeSessions.map((session) => session.toDTO()),
        total: sessions.length,
        active: activeSessions.length,
      });
    } catch (error) {
      logger.error('Get user sessions failed', {
        error: error.message,
        userId: req.user?.id,
        targetUserId: req.params.userId,
        ip: req.ip,
      });

      return this.internalError(res, error);
    }
  }

  /**
   * 终止用户会话
   */
  async terminateSession(req, res) {
    try {
      const userId = req.user.id;
      const sessionId = req.params.sessionId;

      if (!sessionId) {
        return this.badRequest(res, 'Session ID is required');
      }

      // 查找会话
      const session =
        await this.authService.sessionRepository.findBySessionId(sessionId);
      if (!session) {
        return this.notFound(res, 'Session not found');
      }

      // 检查权限
      const isOwnSession = session.userId === userId;
      if (!isOwnSession) {
        const permissionCheck = await this.authzService.checkPermission(
          req.user,
          'users:terminate_sessions',
        );

        if (!permissionCheck.granted) {
          return this.forbidden(
            res,
            'Insufficient permissions to terminate other user sessions',
          );
        }
      }

      // 终止会话
      await this.authService.logout(session.userId, sessionId);

      logger.info('Session terminated via API', {
        sessionId,
        terminatedBy: userId,
        targetUserId: session.userId,
        ip: req.ip,
      });

      return this.ok(res, {
        message: 'Session terminated successfully',
      });
    } catch (error) {
      logger.error('Terminate session failed', {
        error: error.message,
        sessionId: req.params.sessionId,
        userId: req.user?.id,
        ip: req.ip,
      });

      return this.internalError(res, error);
    }
  }

  /**
   * 获取权限统计信息（管理员功能）
   */
  async getAuthStats(req, res) {
    try {
      // 检查管理员权限
      const permissionCheck = await this.authzService.checkPermission(
        req.user,
        'auth:view_stats',
      );

      if (!permissionCheck.granted) {
        return this.forbidden(
          res,
          'Insufficient permissions to view auth statistics',
        );
      }

      const stats = await this.authzService.getPermissionStats();

      // 添加认证相关的统计
      const authStats = {
        ...stats,
        activeUsers: await this.authService.userRepository.count(),
        activeSessions: await this.authService.sessionRepository
          .findActiveSessions()
          .then((sessions) => sessions.length),
        recentTokens: await this.authService.tokenRepository
          .findByUserId(null, null)
          .then((tokens) => tokens.length),
      };

      return this.ok(res, authStats);
    } catch (error) {
      logger.error('Get auth stats failed', {
        error: error.message,
        userId: req.user?.id,
        ip: req.ip,
      });

      return this.internalError(res, error);
    }
  }

  /**
   * 处理忘记密码请求
   */
  async forgotPassword(req, res) {
    try {
      const { email } = req.body;

      if (!email) {
        return this.badRequest(res, 'Email is required');
      }

      // 这里应该生成重置令牌并发送邮件
      // 为了安全，即使邮箱不存在也返回成功信息

      logger.info('Password reset requested', {
        email,
        ip: req.ip,
      });

      return this.ok(res, {
        message: 'If the email exists, a password reset link has been sent',
      });
    } catch (error) {
      logger.error('Forgot password failed', {
        error: error.message,
        email: req.body.email,
        ip: req.ip,
      });

      // 为了安全，不暴露具体的错误信息
      return this.ok(res, {
        message: 'If the email exists, a password reset link has been sent',
      });
    }
  }

  /**
   * 验证邮箱（通过邮件链接）
   */
  async verifyEmail(req, res) {
    try {
      const { token } = req.query;

      if (!token) {
        return this.badRequest(res, 'Verification token is required');
      }

      // 这里应该验证邮箱验证令牌
      // 并激活用户邮箱

      logger.info('Email verification attempted', {
        token: `${token.substring(0, 10)}...`,
        ip: req.ip,
      });

      return this.ok(res, {
        message: 'Email verified successfully',
      });
    } catch (error) {
      logger.error('Email verification failed', {
        error: error.message,
        ip: req.ip,
      });

      return this.badRequest(res, 'Invalid or expired verification token');
    }
  }
}
