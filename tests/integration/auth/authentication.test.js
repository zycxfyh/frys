/**
 * 认证服务集成测试
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { AuthenticationService } from '../../../src/domain/services/auth/AuthenticationService.js';
import { User } from '../../../src/domain/entities/auth/User.js';

// Mock repositories
const mockUserRepository = {
  findByUsername: vi.fn(),
  findByEmail: vi.fn(),
  findById: vi.fn(),
  save: vi.fn()
};

const mockTokenRepository = {
  findByValue: vi.fn(),
  findByUserId: vi.fn().mockResolvedValue([]),
  save: vi.fn()
};

const mockSessionRepository = {
  findBySessionId: vi.fn(),
  findByUserId: vi.fn(),
  save: vi.fn()
};

// Mock JWT
vi.mock('jsonwebtoken', () => {
  return {
    default: {
      sign: vi.fn(() => 'mock.jwt.token'),
      verify: vi.fn(() => ({
        sub: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        roles: ['user'],
        permissions: ['read:own_profile'],
        type: 'access',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        iss: 'frys',
        aud: 'frys-client',
        sessionId: 'session-123'
      }))
    },
    sign: vi.fn(() => 'mock.jwt.token'),
    verify: vi.fn(() => ({
      sub: 'user-123',
      username: 'testuser',
      email: 'test@example.com',
      roles: ['user'],
      permissions: ['read:own_profile'],
      type: 'access',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      iss: 'frys',
      aud: 'frys-client',
      sessionId: 'session-123'
    }))
  };
});

describe('认证服务集成测试', () => {
  let authService;

  beforeAll(() => {
    authService = new AuthenticationService({
      jwtSecret: 'test-secret-key',
      jwtIssuer: 'test-issuer',
      jwtAudience: 'test-audience'
    });

    authService.setDependencies(
      mockUserRepository,
      mockTokenRepository,
      mockSessionRepository
    );
  });

  afterAll(() => {
    vi.clearAllMocks();
  });

  describe('用户注册', () => {
    it('应该成功注册新用户', async () => {
      // Arrange
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        profile: { firstName: 'Test', lastName: 'User' }
      };

      mockUserRepository.findByUsername.mockResolvedValue(null);
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.save.mockResolvedValue(new User({
        ...userData,
        passwordHash: 'hashed-password',
        id: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date()
      }));

      // Act
      const result = await authService.register(userData);

      // Assert
      expect(result).toBeDefined();
      expect(result.username).toBe('testuser');
      expect(result.email).toBe('test@example.com');
      expect(mockUserRepository.findByUsername).toHaveBeenCalledWith('testuser');
      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith('test@example.com');
      expect(mockUserRepository.save).toHaveBeenCalled();
    });

    it('应该拒绝已存在的用户名', async () => {
      // Arrange
      mockUserRepository.findByUsername.mockResolvedValue(new User({
        id: 'existing-user-123',
        username: 'existinguser',
        email: 'existing@example.com',
        createdAt: new Date(),
        updatedAt: new Date()
      }));

      // Act & Assert
      await expect(authService.register({
        username: 'existinguser',
        email: 'new@example.com',
        password: 'password123'
      })).rejects.toThrow('Username already exists');
    });

    it('应该拒绝无效的邮箱格式', async () => {
      // Act & Assert
      await expect(authService.register({
        username: 'testuser',
        email: 'invalid-email',
        password: 'password123'
      })).rejects.toThrow('Invalid email format');
    });
  });

  describe('用户登录', () => {
    it('应该成功登录用户', async () => {
      // Arrange
      const loginData = {
        username: 'testuser',
        password: 'password123',
        ipAddress: '127.0.0.1',
        userAgent: 'Test Browser'
      };

      const user = new User({
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: 'hashed-password',
        roles: ['user'],
        permissions: ['read:own_profile'],
        createdAt: new Date(),
        updatedAt: new Date()
      });

      mockUserRepository.findByUsername.mockResolvedValue(user);
      authService.verifyPassword = vi.fn().mockResolvedValue(true);
      mockSessionRepository.save.mockResolvedValue({
        id: 'session-123',
        sessionId: 'session-123'
      });

      // Act
      const result = await authService.login(loginData);

      // Assert
      expect(result).toBeDefined();
      expect(result.user.id).toBe('user-123');
      expect(result.tokens).toBeDefined();
      expect(result.session).toBeDefined();
      expect(mockSessionRepository.save).toHaveBeenCalled();
    });

    it('应该拒绝无效的凭据', async () => {
      // Arrange
      mockUserRepository.findByUsername.mockResolvedValue(null);

      // Act & Assert
      await expect(authService.login({
        username: 'nonexistent',
        password: 'password123'
      })).rejects.toThrow('Invalid username or password');
    });

    it('应该处理账户锁定', async () => {
      // Arrange
      const authServiceWithLockout = new AuthenticationService({
        maxLoginAttempts: 3,
        lockoutDuration: 1000
      });

      // 模拟多次失败登录
      authServiceWithLockout.recordFailedLogin('testuser');
      authServiceWithLockout.recordFailedLogin('testuser');
      authServiceWithLockout.recordFailedLogin('testuser');

      // Act & Assert
      expect(authServiceWithLockout.isAccountLocked('testuser')).toBe(true);
    });
  });

  describe('令牌管理', () => {
    it('应该生成令牌对', async () => {
      // Arrange
      const user = new User({
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        roles: ['user']
      });

      const session = {
        id: 'session-123',
        sessionId: 'session-123'
      };

      // Act
      const tokenPair = await authService.generateTokenPair(user, session);

      // Assert
      expect(tokenPair).toBeDefined();
      expect(tokenPair.accessToken).toBe('mock.jwt.token');
      expect(tokenPair.refreshToken).toBe('mock.jwt.token');
      expect(tokenPair.expiresIn).toBeGreaterThan(0);
    });

    it('应该验证访问令牌', async () => {
      // Arrange
      const user = new User({
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com'
      });

      mockUserRepository.findById.mockResolvedValue(user);
      mockTokenRepository.findByValue.mockResolvedValue(null);

      // Act
      const result = await authService.verifyAccessToken('valid-token');

      // Assert
      expect(result).toBeDefined();
      expect(result.user.id).toBe('user-123');
      expect(result.payload).toBeDefined();
    });

    it('应该刷新访问令牌', async () => {
      // Arrange
      const user = new User({
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com'
      });

      mockTokenRepository.findByValue.mockResolvedValue({
        userId: 'user-123',
        isValid: () => true,
        revoke: vi.fn()
      });
      mockUserRepository.findById.mockResolvedValue(user);

      // Act
      const result = await authService.refreshToken('refresh-token');

      // Assert
      expect(result).toBeDefined();
      expect(result.user.id).toBe('user-123');
      expect(result.tokens).toBeDefined();
    });
  });

  describe('密码管理', () => {
    it('应该验证密码', async () => {
      // Arrange
      const password = 'testpassword';
      const hash = await authService.hashPassword(password);

      // Act
      const isValid = await authService.verifyPassword(password, hash);

      // Assert
      expect(isValid).toBe(true);
    });

    it('应该拒绝错误的密码', async () => {
      // Arrange
      const correctPassword = 'correctpassword';
      const wrongPassword = 'wrongpassword';
      const hash = await authService.hashPassword(correctPassword);

      // Act
      const isValid = await authService.verifyPassword(wrongPassword, hash);

      // Assert
      expect(isValid).toBe(false);
    });

    it('应该更改密码', async () => {
      // Arrange
      const user = new User({
        id: 'user-123',
        username: 'testuser',
        passwordHash: 'old-hash'
      });

      mockUserRepository.findById.mockResolvedValue(user);
      authService.verifyPassword = vi.fn().mockResolvedValue(true);

      // Act
      await authService.changePassword('user-123', 'oldpassword', 'newpassword');

      // Assert
      expect(mockUserRepository.save).toHaveBeenCalled();
    });
  });

  describe('会话管理', () => {
    it('应该创建会话', async () => {
      // Arrange
      const sessionData = {
        userId: 'user-123',
        sessionId: 'session-123',
        ipAddress: '127.0.0.1',
        userAgent: 'Test Browser'
      };

      mockSessionRepository.save.mockResolvedValue({
        id: 'session-123',
        ...sessionData,
        toDTO: () => sessionData
      });

      // Act
      const session = await authService.sessionRepository.save(sessionData);

      // Assert
      expect(session).toBeDefined();
      expect(mockSessionRepository.save).toHaveBeenCalledWith(sessionData);
    });

    it('应该注销用户', async () => {
      // Arrange
      mockSessionRepository.findByUserId.mockResolvedValue([
        { id: 'session-1', terminate: vi.fn() },
        { id: 'session-2', terminate: vi.fn() }
      ]);

      // Act
      await authService.logout('user-123');

      // Assert
      expect(mockSessionRepository.findByUserId).toHaveBeenCalledWith('user-123');
    });
  });

  describe('安全特性', () => {
    it('应该检测暴力破解攻击', () => {
      // Arrange
      const authServiceWithSecurity = new AuthenticationService({
        maxLoginAttempts: 3
      });

      // Act
      authServiceWithSecurity.recordFailedLogin('attacker');
      authServiceWithSecurity.recordFailedLogin('attacker');
      authServiceWithSecurity.recordFailedLogin('attacker');

      // Assert
      expect(authServiceWithSecurity.isAccountLocked('attacker')).toBe(true);
    });

    it('应该生成安全的会话ID', () => {
      // Act
      const sessionId1 = authService.generateSessionId();
      const sessionId2 = authService.generateSessionId();

      // Assert
      expect(sessionId1).toBeDefined();
      expect(sessionId2).toBeDefined();
      expect(sessionId1).not.toBe(sessionId2);
      expect(sessionId1.length).toBeGreaterThan(20);
    });

    it('应该处理令牌撤销', async () => {
      // Arrange
      const tokens = [
        { userId: 'user-123', revoke: vi.fn(), isValid: () => true },
        { userId: 'user-123', revoke: vi.fn(), isValid: () => true }
      ];

      mockTokenRepository.findByUserId.mockResolvedValue(tokens);

      // Act
      await authService.revokeUserTokens('user-123');

      // Assert
      tokens.forEach(token => {
        expect(token.revoke).toHaveBeenCalled();
      });
    });
  });

  describe('错误处理', () => {
    it('应该处理数据库错误', async () => {
      // Arrange
      mockUserRepository.findByUsername.mockRejectedValue(new Error('Database connection failed'));

      // Act & Assert
      await expect(authService.login({
        username: 'testuser',
        password: 'password123'
      })).rejects.toThrow('Database connection failed');
    });

    it('应该处理JWT错误', async () => {
      // Arrange
      const jwt = await import('jsonwebtoken');
      jwt.verify.mockRejectedValue(new Error('Invalid token'));

      // Act & Assert
      await expect(authService.verifyAccessToken('invalid-token')).rejects.toThrow('Invalid token');
    });

    it('应该处理密码加密错误', async () => {
      // Arrange - Mock crypto to throw error
      const originalScrypt = crypto.scrypt;
      crypto.scrypt = vi.fn((password, salt, keylen, callback) => {
        callback(new Error('Encryption failed'), null);
      });

      // Act & Assert
      await expect(authService.hashPassword('password')).rejects.toThrow('Encryption failed');

      // Cleanup
      crypto.scrypt = originalScrypt;
    });
  });

  describe('配置选项', () => {
    it('应该支持自定义JWT配置', () => {
      // Arrange
      const customAuthService = new AuthenticationService({
        jwtSecret: 'custom-secret',
        jwtIssuer: 'custom-issuer',
        jwtAudience: 'custom-audience',
        accessTokenExpiry: '30m',
        refreshTokenExpiry: '24h'
      });

      // Assert
      expect(customAuthService.options.jwtSecret).toBe('custom-secret');
      expect(customAuthService.options.jwtIssuer).toBe('custom-issuer');
      expect(customAuthService.options.accessTokenExpiry).toBe('30m');
    });

    it('应该支持自定义安全配置', () => {
      // Arrange
      const secureAuthService = new AuthenticationService({
        maxLoginAttempts: 5,
        lockoutDuration: 30 * 60 * 1000, // 30分钟
        passwordSaltRounds: 16
      });

      // Assert
      expect(secureAuthService.options.maxLoginAttempts).toBe(5);
      expect(secureAuthService.options.lockoutDuration).toBe(30 * 60 * 1000);
    });
  });
});
