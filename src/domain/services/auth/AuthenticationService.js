/**
 * 认证服务
 * 处理用户认证、JWT令牌管理、密码加密等
 */

import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { User, Email, Username } from '../../entities/auth/User.js';
import { JWTPayload, TokenPair, Session } from '../../entities/auth/Token.js';
import { logger } from '../../../shared/utils/logger.js';
import UUIDInspiredId from '../../../core/UUIDInspiredId.js';

export class AuthenticationService {
  constructor(options = {}) {
    this.options = {
      jwtSecret:
        options.jwtSecret || process.env.JWT_SECRET || 'your-secret-key',
      jwtIssuer: options.jwtIssuer || process.env.JWT_ISSUER || 'frys',
      jwtAudience:
        options.jwtAudience || process.env.JWT_AUDIENCE || 'frys-client',
      accessTokenExpiry: options.accessTokenExpiry || '15m', // 15分钟
      refreshTokenExpiry: options.refreshTokenExpiry || '7d', // 7天
      passwordSaltRounds: options.passwordSaltRounds || 12,
      maxLoginAttempts: options.maxLoginAttempts || 5,
      lockoutDuration: options.lockoutDuration || 15 * 60 * 1000, // 15分钟
      sessionTimeout: options.sessionTimeout || 24 * 60 * 60 * 1000, // 24小时
      ...options,
    };

    this.loginAttempts = new Map(); // 用户登录尝试计数
    this.idGenerator = new UUIDInspiredId(); // ID生成器
  }

  /**
   * 用户注册
   */
  async register(userData) {
    try {
      // 验证输入数据
      const username = new Username(userData.username);
      const email = new Email(userData.email);

      // 检查用户名和邮箱是否已存在
      if (await this.userRepository.findByUsername(username.value)) {
        throw new Error('Username already exists');
      }
      if (await this.userRepository.findByEmail(email.value)) {
        throw new Error('Email already exists');
      }

      // 加密密码
      const passwordHash = await this.hashPassword(userData.password);

      // 创建用户实体
      const user = new User({
        id: this.idGenerator.v4(),
        username: username.value,
        email: email.value,
        passwordHash,
        profile: userData.profile || {},
      });

      // 保存用户
      const savedUser = await this.userRepository.save(user);

      logger.info('User registered successfully', {
        userId: savedUser.id,
        username: savedUser.username,
        email: savedUser.email,
      });

      return savedUser;
    } catch (error) {
      logger.error('User registration failed', error);
      throw error;
    }
  }

  /**
   * 用户登录
   */
  async login(credentials) {
    try {
      const { username, password, ipAddress, userAgent } = credentials;

      // 检查登录尝试次数
      if (this.isAccountLocked(username)) {
        throw new Error(
          'Account is temporarily locked due to too many failed login attempts',
        );
      }

      // 查找用户
      const user = await this.userRepository.findByUsername(username);
      if (!user) {
        await this.recordFailedLogin(username);
        throw new Error('Invalid username or password');
      }

      // 验证密码
      const isValidPassword = await this.verifyPassword(
        password,
        user.passwordHash,
      );
      if (!isValidPassword) {
        await this.recordFailedLogin(username);
        throw new Error('Invalid username or password');
      }

      // 检查用户状态
      if (!user.isActive) {
        throw new Error('Account is deactivated');
      }

      // 重置登录尝试计数
      this.resetLoginAttempts(username);

      // 更新最后登录时间
      user.updateLastLogin();
      await this.userRepository.save(user);

      // 创建会话
      const session = new Session({
        id: this.idGenerator.v4(),
        userId: user.id,
        sessionId: this.generateSessionId(),
        ipAddress,
        userAgent,
        expiresAt: new Date(Date.now() + this.options.sessionTimeout),
      });
      await this.sessionRepository.save(session);

      // 生成令牌对
      const tokenPair = await this.generateTokenPair(user, session);

      logger.info('User logged in successfully', {
        userId: user.id,
        username: user.username,
        sessionId: session.sessionId,
        ipAddress,
      });

      return {
        user: user.toPublicDTO(),
        session: session.toDTO(),
        tokens: tokenPair.toResponse(),
      };
    } catch (error) {
      logger.error('User login failed', {
        username: credentials.username,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * 刷新访问令牌
   */
  async refreshToken(refreshTokenValue) {
    try {
      // 验证刷新令牌
      const payload = jwt.verify(refreshTokenValue, this.options.jwtSecret, {
        issuer: this.options.jwtIssuer,
        audience: this.options.jwtAudience,
      });

      if (!payload) {
        throw new Error('Invalid token');
      }

      if (payload.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      // 检查令牌是否在黑名单中
      const tokenEntity =
        await this.tokenRepository.findByValue(refreshTokenValue);
      if (!tokenEntity || !tokenEntity.isValid()) {
        throw new Error('Token is invalid or revoked');
      }

      // 查找用户
      const user = await this.userRepository.findById(payload.sub);
      if (!user || !user.isActive) {
        throw new Error('User not found or inactive');
      }

      // 查找会话
      const session = await this.sessionRepository.findBySessionId(
        payload.sessionId,
      );
      if (!session || !session.isValid()) {
        throw new Error('Session not found or invalid');
      }

      // 撤销旧的刷新令牌
      tokenEntity.revoke('token_refresh');
      await this.tokenRepository.save(tokenEntity);

      // 生成新的令牌对
      const tokenPair = await this.generateTokenPair(user, session);

      logger.info('Token refreshed successfully', {
        userId: user.id,
        sessionId: session.sessionId,
      });

      return {
        user: user.toPublicDTO(),
        tokens: tokenPair.toResponse(),
      };
    } catch (error) {
      logger.error('Token refresh failed', error);
      throw error;
    }
  }

  /**
   * 验证访问令牌
   */
  async verifyAccessToken(accessTokenValue) {
    try {
      const payload = jwt.verify(accessTokenValue, this.options.jwtSecret, {
        issuer: this.options.jwtIssuer,
        audience: this.options.jwtAudience,
      });

      if (!payload) {
        throw new Error('Invalid token');
      }

      if (payload.type !== 'access') {
        throw new Error('Invalid token type');
      }

      // 检查令牌是否在黑名单中
      const tokenEntity =
        await this.tokenRepository.findByValue(accessTokenValue);
      if (tokenEntity && !tokenEntity.isValid()) {
        throw new Error('Token is revoked');
      }

      // 查找用户
      const user = await this.userRepository.findById(payload.sub);
      if (!user || !user.isActive) {
        throw new Error('User not found or inactive');
      }

      // 更新会话活动时间
      if (payload.sessionId) {
        const session = await this.sessionRepository.findBySessionId(
          payload.sessionId,
        );
        if (session && session.isValid()) {
          session.updateActivity();
          await this.sessionRepository.save(session);
        }
      }

      return {
        user,
        payload: JWTPayload.fromJWTFormat(payload),
        sessionId: payload.sessionId,
      };
    } catch (error) {
      logger.error('Access token verification failed', error);
      throw error;
    }
  }

  /**
   * 注销用户
   */
  async logout(userId, sessionId = null) {
    try {
      if (sessionId) {
        // 终止特定会话
        const session = await this.sessionRepository.findBySessionId(sessionId);
        if (session && session.userId === userId) {
          session.terminate();
          await this.sessionRepository.save(session);

          // 撤销该会话的所有令牌
          await this.revokeUserTokens(userId, sessionId);
        }
      } else {
        // 终止用户所有会话
        const sessions = await this.sessionRepository.findByUserId(userId);
        for (const session of sessions) {
          if (session.isActive) {
            session.terminate();
            await this.sessionRepository.save(session);
          }
        }

        // 撤销用户所有令牌
        await this.revokeUserTokens(userId);
      }

      logger.info('User logged out successfully', {
        userId,
        sessionId,
      });
    } catch (error) {
      logger.error('User logout failed', error);
      throw error;
    }
  }

  /**
   * 重置密码
   */
  async resetPassword(email, newPassword) {
    try {
      const user = await this.userRepository.findByEmail(email);
      if (!user) {
        throw new Error('User not found');
      }

      // 生成新的密码哈希
      const passwordHash = await this.hashPassword(newPassword);

      // 更新用户密码
      user.passwordHash = passwordHash;
      user.updatedAt = new Date();
      await this.userRepository.save(user);

      // 撤销用户所有令牌（强制重新登录）
      await this.revokeUserTokens(user.id);

      logger.info('Password reset successfully', {
        userId: user.id,
        email: user.email,
      });

      return { success: true };
    } catch (error) {
      logger.error('Password reset failed', error);
      throw error;
    }
  }

  /**
   * 更改密码
   */
  async changePassword(userId, currentPassword, newPassword) {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // 验证当前密码
      const isValidPassword = await this.verifyPassword(
        currentPassword,
        user.passwordHash,
      );
      if (!isValidPassword) {
        throw new Error('Current password is incorrect');
      }

      // 生成新的密码哈希
      const passwordHash = await this.hashPassword(newPassword);

      // 更新用户密码
      user.passwordHash = passwordHash;
      user.markAsModified();
      await this.userRepository.save(user);

      // 撤销用户所有令牌（除了当前会话）
      await this.revokeUserTokens(user.id, null, true);

      logger.info('Password changed successfully', {
        userId: user.id,
      });

      return { success: true };
    } catch (error) {
      logger.error('Password change failed', error);
      throw error;
    }
  }

  /**
   * 生成令牌对
   */
  async generateTokenPair(user, session) {
    const now = Math.floor(Date.now() / 1000);

    // 创建访问令牌载荷
    const accessPayload = new JWTPayload({
      userId: user.id,
      username: user.username,
      email: user.email,
      roles: user.roles,
      permissions: user.permissions,
      tokenType: 'access',
      issuedAt: now,
      expiresAt: now + this.parseTimeString(this.options.accessTokenExpiry),
      issuer: this.options.jwtIssuer,
      audience: this.options.jwtAudience,
      sessionId: session.sessionId,
    });

    // 创建刷新令牌载荷
    const refreshPayload = new JWTPayload({
      userId: user.id,
      username: user.username,
      email: user.email,
      tokenType: 'refresh',
      issuedAt: now,
      expiresAt: now + this.parseTimeString(this.options.refreshTokenExpiry),
      issuer: this.options.jwtIssuer,
      audience: this.options.jwtAudience,
      sessionId: session.sessionId,
    });

    // 生成JWT令牌
    const accessToken = jwt.sign(
      accessPayload.toJWTFormat(),
      this.options.jwtSecret,
    );
    const refreshToken = jwt.sign(
      refreshPayload.toJWTFormat(),
      this.options.jwtSecret,
    );

    // 保存令牌到数据库
    const accessTokenEntity = await this.tokenRepository.save(
      new (await import('../../entities/auth/Token.js')).Token({
        id: this.idGenerator.v4(),
        userId: user.id,
        tokenType: 'access',
        tokenValue: accessToken,
        expiresAt: new Date(accessPayload.expiresAt * 1000),
        metadata: { sessionId: session.sessionId },
      }),
    );

    const refreshTokenEntity = await this.tokenRepository.save(
      new (await import('../../entities/auth/Token.js')).Token({
        id: this.idGenerator.v4(),
        userId: user.id,
        tokenType: 'refresh',
        tokenValue: refreshToken,
        expiresAt: new Date(refreshPayload.expiresAt * 1000),
        metadata: { sessionId: session.sessionId },
      }),
    );

    return new TokenPair({
      accessToken,
      refreshToken,
      expiresIn: accessPayload.expiresAt - now,
      refreshExpiresIn: refreshPayload.expiresAt - now,
    });
  }

  /**
   * 密码加密
   */
  async hashPassword(password) {
    return new Promise((resolve, reject) => {
      const salt = crypto.randomBytes(16).toString('hex');
      crypto.scrypt(password, salt, 64, (err, derivedKey) => {
        if (err) reject(err);
        resolve(`${salt}:${derivedKey.toString('hex')}`);
      });
    });
  }

  /**
   * 密码验证
   */
  async verifyPassword(password, hash) {
    return new Promise((resolve, reject) => {
      const [salt, key] = hash.split(':');
      crypto.scrypt(password, salt, 64, (err, derivedKey) => {
        if (err) reject(err);
        resolve(key === derivedKey.toString('hex'));
      });
    });
  }

  /**
   * 撤销用户令牌
   */
  async revokeUserTokens(
    userId,
    sessionId = null,
    excludeCurrentSession = false,
  ) {
    const tokens = await this.tokenRepository.findByUserId(userId);

    for (const token of tokens) {
      if (token.isValid()) {
        // 如果指定了会话ID，只撤销该会话的令牌
        if (sessionId && token.metadata.sessionId !== sessionId) {
          continue;
        }

        // 如果排除当前会话，跳过当前会话的令牌
        if (excludeCurrentSession && token.metadata.sessionId === sessionId) {
          continue;
        }

        token.revoke('user_logout');
        await this.tokenRepository.save(token);
      }
    }
  }

  /**
   * 记录失败的登录尝试
   */
  async recordFailedLogin(username) {
    const attempts = this.loginAttempts.get(username) || {
      count: 0,
      lastAttempt: 0,
    };
    attempts.count += 1;
    attempts.lastAttempt = Date.now();
    this.loginAttempts.set(username, attempts);
  }

  /**
   * 重置登录尝试计数
   */
  resetLoginAttempts(username) {
    this.loginAttempts.delete(username);
  }

  /**
   * 检查账户是否被锁定
   */
  isAccountLocked(username) {
    const attempts = this.loginAttempts.get(username);
    if (!attempts) return false;

    // 检查是否超过最大尝试次数且在锁定时间内
    if (attempts.count >= this.options.maxLoginAttempts) {
      const timeSinceLastAttempt = Date.now() - attempts.lastAttempt;
      return timeSinceLastAttempt < this.options.lockoutDuration;
    }

    return false;
  }

  /**
   * 生成会话ID
   */
  generateSessionId() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * 解析时间字符串
   */
  parseTimeString(timeStr) {
    const regex = /^(\d+)([smhd])$/;
    const match = timeStr.match(regex);

    if (!match) {
      throw new Error(`Invalid time string: ${timeStr}`);
    }

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 60 * 60;
      case 'd':
        return value * 60 * 60 * 24;
      default:
        throw new Error(`Invalid time unit: ${unit}`);
    }
  }

  /**
   * 设置依赖注入
   */
  setDependencies(userRepository, tokenRepository, sessionRepository) {
    this.userRepository = userRepository;
    this.tokenRepository = tokenRepository;
    this.sessionRepository = sessionRepository;
  }
}
