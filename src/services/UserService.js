/**
 * frys Production - 用户服务
 */

import { logger } from '../utils/logger.js';
import { config } from '../utils/config.js';
import messagingAdapter from '../core/messaging-adapter.js';

export class UserService {
  constructor(dependencies) {
    this.http = dependencies.http;
    this.auth = dependencies.auth;
    this.state = dependencies.state;
    this.messaging = messagingAdapter; // 使用消息适配器

    this.users = new Map();
    this.sessions = new Map();
  }

  async start() {
    logger.info('启动用户服务');

    // 订阅用户相关事件
    await this.setupEventListeners();

    logger.info('用户服务启动完成');
  }

  async stop() {
    logger.info('停止用户服务');

    // 清理所有用户会话
    for (const [sessionId, _session] of this.sessions) {
      await this.endSession(sessionId);
    }

    logger.info('用户服务已停止');
  }

  async setupEventListeners() {
    // 监听用户认证事件
    this.messaging.subscribe('user.login', async (event) => {
      await this.handleLogin(event);
    });

    this.messaging.subscribe('user.logout', async (event) => {
      await this.handleLogout(event);
    });

    // 监听用户管理事件
    this.messaging.subscribe('user.create', async (event) => {
      await this.createUser(event.userData);
    });

    this.messaging.subscribe('user.update', async (event) => {
      await this.updateUser(event.userId, event.userData);
    });

    this.messaging.subscribe('user.delete', async (event) => {
      await this.deleteUser(event.userId);
    });
  }

  async createUser(userData) {
    try {
      // 验证用户数据
      this.validateUserData(userData);

      // 检查用户名是否已存在
      const existingUser = this.findUserByUsername(userData.username);
      if (existingUser) {
        throw new Error(`用户名已存在: ${userData.username}`);
      }

      // 创建用户对象
      const userId = this.generateUserId();
      const user = {
        id: userId,
        username: userData.username,
        email: userData.email,
        fullName: userData.fullName,
        role: userData.role || 'user',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: null,
        loginCount: 0,
      };

      // 哈希密码
      user.passwordHash = await this.hashPassword(userData.password);

      // 保存到状态管理
      this.state.setState((state) => ({
        users: new Map(state.users).set(userId, user),
      }));

      this.users.set(userId, user);

      logger.info('用户创建成功', {
        userId,
        username: user.username,
        email: user.email,
      });

      // 发布用户创建事件
      await this.messaging.publish('user.created', {
        userId,
        user: { ...user, passwordHash: undefined }, // 不包含密码哈希
      });

      return { userId, user: { ...user, passwordHash: undefined } };
    } catch (error) {
      logger.error('用户创建失败', error, { userData });
      throw error;
    }
  }

  async authenticateUser(username, password) {
    try {
      const user = this.findUserByUsername(username);
      if (!user) {
        throw new Error('用户不存在');
      }

      if (user.status !== 'active') {
        throw new Error('用户账户已被禁用');
      }

      // 验证密码
      const isValidPassword = await this.verifyPassword(
        password,
        user.passwordHash,
      );
      if (!isValidPassword) {
        throw new Error('密码错误');
      }

      // 生成JWT令牌
      const token = this.auth.generateToken({
        userId: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      });

      // 创建会话
      const sessionId = this.generateSessionId();
      const session = {
        id: sessionId,
        userId: user.id,
        token,
        createdAt: new Date(),
        lastActivity: new Date(),
        ipAddress: null, // 可以从请求中获取
        userAgent: null,
      };

      this.sessions.set(sessionId, session);

      // 更新用户最后登录信息
      user.lastLoginAt = new Date();
      user.loginCount += 1;
      user.updatedAt = new Date();

      this.updateUserState(user.id, user);

      logger.info('用户认证成功', {
        userId: user.id,
        username: user.username,
        sessionId,
      });

      // 发布登录事件
      await this.messaging.publish('user.authenticated', {
        userId: user.id,
        sessionId,
        token,
      });

      return {
        user: { ...user, passwordHash: undefined },
        token,
        sessionId,
      };
    } catch (error) {
      logger.error('用户认证失败', error, { username });
      throw error;
    }
  }

  async validateToken(token) {
    try {
      const decoded = this.auth.verifyToken(token);

      // 检查用户是否仍然有效
      const user = this.users.get(decoded.userId);
      if (!user || user.status !== 'active') {
        throw new Error('用户不存在或已被禁用');
      }

      return { valid: true, user, decoded };
    } catch (error) {
      logger.warn('令牌验证失败', { error: error.message });
      return { valid: false, error: error.message };
    }
  }

  async logout(sessionId) {
    try {
      const session = this.sessions.get(sessionId);
      if (!session) {
        return; // 会话不存在，静默处理
      }

      // 结束会话
      await this.endSession(sessionId);

      logger.info('用户登出成功', {
        userId: session.userId,
        sessionId,
      });

      // 发布登出事件
      await this.messaging.publish('user.logged_out', {
        userId: session.userId,
        sessionId,
      });
    } catch (error) {
      logger.error('用户登出失败', error, { sessionId });
      throw error;
    }
  }

  async updateUser(userId, userData) {
    try {
      const user = this.users.get(userId);
      if (!user) {
        throw new Error(`用户不存在: ${userId}`);
      }

      // 更新用户数据
      const updatedUser = {
        ...user,
        ...userData,
        updatedAt: new Date(),
      };

      // 如果更新密码，需要重新哈希
      if (userData.password) {
        updatedUser.passwordHash = await this.hashPassword(userData.password);
      }

      this.users.set(userId, updatedUser);
      this.updateUserState(userId, updatedUser);

      logger.info('用户信息更新成功', {
        userId,
        username: updatedUser.username,
      });

      // 发布更新事件
      await this.messaging.publish('user.updated', {
        userId,
        user: { ...updatedUser, passwordHash: undefined },
      });

      return { ...updatedUser, passwordHash: undefined };
    } catch (error) {
      logger.error('用户信息更新失败', error, { userId });
      throw error;
    }
  }

  async deleteUser(userId) {
    try {
      const user = this.users.get(userId);
      if (!user) {
        throw new Error(`用户不存在: ${userId}`);
      }

      // 结束所有相关会话
      for (const [sessionId, session] of this.sessions) {
        if (session.userId === userId) {
          await this.endSession(sessionId);
        }
      }

      // 删除用户
      this.users.delete(userId);
      this.state.setState((state) => {
        const newUsers = new Map(state.users);
        newUsers.delete(userId);
        return { users: newUsers };
      });

      logger.info('用户删除成功', {
        userId,
        username: user.username,
      });

      // 发布删除事件
      await this.messaging.publish('user.deleted', {
        userId,
        username: user.username,
      });
    } catch (error) {
      logger.error('用户删除失败', error, { userId });
      throw error;
    }
  }

  async getUserProfile(userId) {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error(`用户不存在: ${userId}`);
    }

    return { ...user, passwordHash: undefined };
  }

  async listUsers(filters = {}) {
    let users = Array.from(this.users.values());

    // 应用过滤器
    if (filters.status) {
      users = users.filter((user) => user.status === filters.status);
    }

    if (filters.role) {
      users = users.filter((user) => user.role === filters.role);
    }

    // 移除密码哈希
    return users.map((user) => ({ ...user, passwordHash: undefined }));
  }

  // 会话管理
  async endSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      // 可以在这里添加会话清理逻辑
      this.sessions.delete(sessionId);
    }
  }

  async cleanupExpiredSessions() {
    const now = new Date();
    const maxSessionAge = 24 * 60 * 60 * 1000; // 24小时

    for (const [sessionId, session] of this.sessions) {
      const age = now - session.createdAt;
      if (age > maxSessionAge) {
        await this.endSession(sessionId);
        logger.info('清理过期会话', { sessionId, userId: session.userId });
      }
    }
  }

  // 辅助方法
  validateUserData(userData) {
    const required = ['username', 'email', 'password'];
    for (const field of required) {
      if (!userData[field]) {
        throw new Error(`缺少必要字段: ${field}`);
      }
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userData.email)) {
      throw new Error('邮箱格式不正确');
    }

    // 验证密码强度
    if (userData.password.length < 8) {
      throw new Error('密码长度至少8位');
    }
  }

  findUserByUsername(username) {
    for (const user of this.users.values()) {
      if (user.username === username) {
        return user;
      }
    }
    return null;
  }

  generateUserId() {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async hashPassword(password) {
    // 在生产环境中，应该使用bcrypt或其他安全的哈希算法
    // 这里为了简化，使用一个基本的实现
    const crypto = await import('crypto');
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto
      .createHash('sha256')
      .update(password + salt)
      .digest('hex');
    return `${salt}:${hash}`;
  }

  async verifyPassword(password, passwordHash) {
    const crypto = await import('crypto');
    const [salt, hash] = passwordHash.split(':');
    const expectedHash = crypto
      .createHash('sha256')
      .update(password + salt)
      .digest('hex');
    return hash === expectedHash;
  }

  updateUserState(userId, user) {
    this.state.setState((state) => ({
      users: new Map(state.users).set(userId, user),
    }));
  }

  // 定期清理任务
  startCleanupTask() {
    setInterval(
      async () => {
        try {
          await this.cleanupExpiredSessions();
        } catch (error) {
          logger.error('会话清理任务失败', error);
        }
      },
      60 * 60 * 1000,
    ); // 每小时清理一次
  }
}
