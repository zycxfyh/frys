/**
 * Authentication Service Integration Tests
 * Tests for user authentication, registration, and token management
 */

import jwt from 'jsonwebtoken';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { User } from '../../../src/domain/entities/auth/User.js';
import { AuthenticationService } from '../../../src/domain/services/auth/AuthenticationService.js';

/**
 * Test fixtures and helpers
 */
const createTestUser = (overrides = {}) => {
  return new User({
    id: 'user-123',
    username: 'testuser',
    email: 'test@example.com',
    roles: ['user'],
    profile: { firstName: 'Test', lastName: 'User' },
    ...overrides,
  });
};

const createTestCredentials = (overrides = {}) => ({
  username: 'testuser',
  password: 'password123',
  ipAddress: '127.0.0.1',
  userAgent: 'Test Browser',
  ...overrides,
});

// Mock repositories
const mockUserRepository = {
  findByUsername: vi.fn(),
  findByEmail: vi.fn(),
  findById: vi.fn(),
  save: vi.fn(),
};

const mockTokenRepository = {
  findByToken: vi.fn(),
  findByUserId: vi.fn(),
  findByValue: vi.fn(),
  save: vi.fn(),
  revoke: vi.fn(),
};

const mockSessionRepository = {
  findById: vi.fn(),
  findBySessionId: vi.fn(),
  findByUserId: vi.fn(),
  save: vi.fn(),
};

describe('Authentication Service Integration', () => {
  let authService;
  let jwtVerifySpy;

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Create fresh service instance
    authService = new AuthenticationService({
      jwtSecret: 'test-secret-key',
      jwtIssuer: 'test-issuer',
      jwtAudience: 'test-audience',
      accessTokenExpiry: '15m',
      refreshTokenExpiry: '7d',
    });

    // Setup dependencies
    authService.setDependencies(
      mockUserRepository,
      mockTokenRepository,
      mockSessionRepository,
    );

    // Setup JWT spy for verification tests
    jwtVerifySpy = vi.spyOn(jwt, 'verify');
  });

  afterEach(() => {
    authService = null;
  });

  describe('User Registration', () => {
    it('should successfully register a new user', async () => {
      // Given
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        profile: { firstName: 'Test', lastName: 'User' },
      };

      mockUserRepository.findByUsername.mockResolvedValue(null);
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.save.mockResolvedValue(createTestUser());

      // When
      const user = await authService.register(userData);

      // Then
      expect(user).toBeDefined();
      expect(user.username).toBe('testuser');
      expect(user.email).toBe('test@example.com');
      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'testuser',
          email: 'test@example.com',
        }),
      );
    });

    it('should reject registration when username already exists', async () => {
      // Given
      const userData = {
        ...createTestCredentials(),
        email: 'test@example.com',
      };
      mockUserRepository.findByUsername.mockResolvedValue(createTestUser());

      // When & Then
      await expect(authService.register(userData)).rejects.toThrow(
        'Username already exists',
      );
    });

    it('should reject registration with invalid email format', async () => {
      // Given
      const userData = {
        ...createTestCredentials(),
        email: 'invalid-email',
      };

      // When & Then
      await expect(authService.register(userData)).rejects.toThrow(
        'Invalid email format',
      );
    });
  });

  describe('User Login', () => {
    it('should successfully login a user with valid credentials', async () => {
      // Given
      const credentials = createTestCredentials();
      const user = createTestUser();
      const session = { id: 'session-123', sessionId: 'session-123' };

      mockUserRepository.findByUsername.mockResolvedValue(user);
      mockSessionRepository.save.mockResolvedValue(session);

      // Mock password verification (in real implementation, this would be bcrypt.compare)
      authService.verifyPassword = vi.fn().mockResolvedValue(true);

      // When
      const result = await authService.login(credentials);

      // Then
      expect(result).toBeDefined();
      expect(result.user).toBeDefined();
      expect(result.session).toBeDefined();
      expect(result.user.username).toBe('testuser');
    });

    it('should reject login with invalid credentials', async () => {
      // Given
      const credentials = createTestCredentials();
      mockUserRepository.findByUsername.mockResolvedValue(null);

      // When & Then
      await expect(authService.login(credentials)).rejects.toThrow(
        'Invalid username or password',
      );
    });
  });

  describe('Token Management', () => {
    it('should generate a valid token pair', async () => {
      // Given
      const user = createTestUser();
      const session = {
        id: 'session-123',
        sessionId: 'session-123',
      };

      // When
      const tokenPair = await authService.generateTokenPair(user, session);

      // Then
      expect(tokenPair).toBeDefined();
      expect(tokenPair.accessToken).toBeDefined();
      expect(tokenPair.refreshToken).toBeDefined();
      expect(tokenPair.expiresIn).toBeGreaterThan(0);

      // Verify JWT token structure (not mock values)
      expect(typeof tokenPair.accessToken).toBe('string');
      expect(tokenPair.accessToken.split('.')).toHaveLength(3); // JWT has 3 parts
      expect(typeof tokenPair.refreshToken).toBe('string');
      expect(tokenPair.refreshToken.split('.')).toHaveLength(3);
    });

    it('should verify access tokens correctly', async () => {
      // Given
      const testUser = createTestUser();
      const validToken = jwt.sign(
        {
          sub: 'user-123',
          username: 'testuser',
          email: 'test@example.com',
          roles: ['user'],
          type: 'access',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 900, // 15 minutes
          iss: 'test-issuer',
          aud: 'test-audience',
          sessionId: 'session-123',
        },
        'test-secret-key',
      );

      jwtVerifySpy.mockReturnValue({
        sub: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        roles: ['user'],
        type: 'access',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 900,
        iss: 'test-issuer',
        aud: 'test-audience',
        sessionId: 'session-123',
      });

      // Mock user repository to return the test user
      mockUserRepository.findById.mockResolvedValue(testUser);

      // When
      const result = await authService.verifyAccessToken(validToken);

      // Then
      expect(result).toBeDefined();
      expect(result.payload).toBeDefined();
      expect(result.payload.userId).toBe('user-123');
      expect(result.payload.username).toBe('testuser');
      expect(result.user).toBeDefined();
      expect(jwtVerifySpy).toHaveBeenCalledWith(validToken, 'test-secret-key', {
        issuer: 'test-issuer',
        audience: 'test-audience',
      });
    });
  });
});
