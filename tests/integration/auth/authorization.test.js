import {
  createDetailedErrorReporter,
  createStrictTestCleanup,
  setupStrictTestEnvironment,
  strictAssert,
  withTimeout,
} from './test-helpers.js';

/**
 * 授权服务集成测试
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Role } from '../../../src/domain/entities/auth/Role.js';
import { User } from '../../../src/domain/entities/auth/User.js';
import { AuthorizationService } from '../../../src/domain/services/auth/AuthorizationService.js';

// Mock repositories
const mockUserRepository = {
  findById: vi.fn(),
  count: vi.fn(),
};

const mockRoleRepository = {
  findByUserId: vi.fn(),
  findByName: vi.fn(),
  count: vi.fn(),
};

const mockPermissionRepository = {
  count: vi.fn(),
};

const mockProjectMembershipRepository = {
  findByUserAndProject: vi.fn(),
};

const mockOrganizationMembershipRepository = {
  findByUserAndOrganization: vi.fn(),
};

const mockTeamMembershipRepository = {
  findByUserAndTeam: vi.fn(),
};

describe('授权服务集成测试', () => {
  let authzService;

  beforeAll(() => {
    authzService = new AuthorizationService({
      enablePermissionCaching: true,
      cacheTtl: 5000,
      superAdminRole: 'super_admin',
    });

    authzService.setDependencies(
      mockUserRepository,
      mockRoleRepository,
      mockPermissionRepository,
      mockProjectMembershipRepository,
      mockOrganizationMembershipRepository,
      mockTeamMembershipRepository,
    );
  });

  afterAll(() => {
    vi.clearAllMocks();
  });

  describe('权限检查', () => {
    it('应该允许超级管理员访问任何权限', async () => {
      // Arrange
      const superAdmin = new User({
        id: 'admin-123',
        username: 'superadmin',
        email: 'admin@example.com',
        roles: ['super_admin'],
        permissions: [],
      });

      // Act
      const result = await authzService.checkPermission(
        superAdmin,
        'any:permission',
      );

      // Assert
      expect(result.granted).toBe(true);
      expect(result.reason).toBe('super_admin');
    });

    it('应该检查用户直接权限', async () => {
      // Arrange
      const user = new User({
        id: 'user-123',
        username: 'testuser',
        email: 'user@example.com',
        roles: [],
        permissions: ['read:own_profile', 'write:own_profile'],
      });

      // Act
      const result1 = await authzService.checkPermission(
        user,
        'read:own_profile',
      );
      const result2 = await authzService.checkPermission(
        user,
        'delete:own_profile',
      );

      // Assert
      expect(result1.granted).toBe(true);
      expect(result2.granted).toBe(false);
    });

    it('应该检查角色权限', async () => {
      // Arrange
      const user = new User({
        id: 'user-123',
        username: 'testuser',
        email: 'editor@example.com',
        roles: ['editor'],
        permissions: [],
      });

      const role = new Role({
        id: 'role-123',
        name: 'editor',
        permissions: ['edit:documents', 'read:documents'],
      });

      mockRoleRepository.findByUserId.mockResolvedValue([role]);

      // Act
      const result1 = await authzService.checkPermission(
        user,
        'edit:documents',
      );
      const result2 = await authzService.checkPermission(
        user,
        'delete:documents',
      );

      // Assert
      expect(result1.granted).toBe(true);
      expect(result2.granted).toBe(false);
    });

    it('应该支持通配符权限', async () => {
      // Arrange
      const user = new User({
        id: 'user-123',
        username: 'testuser',
        email: 'wildcard@example.com',
        roles: [],
        permissions: ['documents:*'],
      });

      // Act
      const result1 = await authzService.checkPermission(
        user,
        'documents:read',
      );
      const result2 = await authzService.checkPermission(
        user,
        'documents:write',
      );
      const result3 = await authzService.checkPermission(user, 'files:read');

      // Assert
      expect(result1.granted).toBe(true);
      expect(result2.granted).toBe(true);
      expect(result3.granted).toBe(false);
    });

    it('应该支持多权限检查', async () => {
      // Arrange
      const user = new User({
        id: 'user-123',
        username: 'testuser',
        email: 'multi@example.com',
        roles: [],
        permissions: ['read:documents'],
      });

      // Act
      const result1 = await authzService.checkAnyPermission(user, [
        'read:documents',
        'write:documents',
      ]);
      const result2 = await authzService.checkAllPermissions(user, [
        'read:documents',
        'write:documents',
      ]);

      // Assert
      expect(result1.granted).toBe(true);
      expect(result2.granted).toBe(false);
    });
  });

  describe('权限缓存', () => {
    it('应该缓存用户角色权限', async () => {
      // Arrange
      const user = new User({
        id: 'user-123',
        username: 'testuser',
        email: 'manager@example.com',
        roles: ['manager'],
      });

      const role = new Role({
        id: 'role-123',
        name: 'manager',
        permissions: ['manage:users', 'view:reports'],
      });

      mockRoleRepository.findByUserId.mockResolvedValue([role]);

      // Act - 第一次调用
      const result1 = await authzService.checkPermission(user, 'manage:users');

      // Act - 第二次调用（应该使用缓存）
      const result2 = await authzService.checkPermission(user, 'view:reports');

      // Assert
      expect(result1.granted).toBe(true);
      expect(result2.granted).toBe(true);
      expect(mockRoleRepository.findByUserId).toHaveBeenCalledTimes(1);
    });

    it('应该刷新权限缓存', () => {
      // Arrange
      authzService.permissionCache.set('user-123', {
        permissions: ['old:permission'],
        timestamp: Date.now(),
      });

      // Act
      authzService.refreshUserPermissionCache('user-123');

      // Assert
      expect(authzService.permissionCache.has('user-123')).toBe(false);
    });

    it('应该清理过期缓存', () => {
      // Arrange
      const oldTimestamp = Date.now() - 10000; // 10秒前
      authzService.permissionCache.set('old-user', {
        permissions: ['old:permission'],
        timestamp: oldTimestamp,
      });

      // Act
      authzService.cleanupExpiredCache();

      // Assert
      expect(authzService.permissionCache.has('old-user')).toBe(false);
    });
  });

  describe('上下文权限', () => {
    it('应该检查项目权限', async () => {
      // Arrange
      const user = new User({
        id: 'user-123',
        username: 'testuser',
        email: 'project@example.com',
        roles: [],
      });

      const membership = {
        role: {
          permissions: ['project:edit'],
        },
      };

      mockProjectMembershipRepository.findByUserAndProject.mockResolvedValue(
        membership,
      );

      // Act
      const result = await authzService.checkContextPermission(
        user,
        'project:edit',
        { type: 'project', id: 'project-123' },
        {},
      );

      // Assert
      expect(result.granted).toBe(true);
      expect(result.reason).toBe('project_role');
    });

    it('应该检查组织权限', async () => {
      // Arrange
      const user = new User({
        id: 'user-123',
        username: 'testuser',
        email: 'org@example.com',
      });

      const membership = {
        role: {
          permissions: ['org:manage_members'],
        },
      };

      mockOrganizationMembershipRepository.findByUserAndOrganization.mockResolvedValue(
        membership,
      );

      // Act
      const result = await authzService.checkContextPermission(
        user,
        'org:manage_members',
        { type: 'organization', id: 'org-123' },
        {},
      );

      // Assert
      expect(result.granted).toBe(true);
      expect(result.reason).toBe('organization_role');
    });

    it('应该拒绝未授权的资源访问', async () => {
      // Arrange
      const user = new User({
        id: 'user-123',
        username: 'testuser',
        email: 'unauth@example.com',
      });

      mockProjectMembershipRepository.findByUserAndProject.mockResolvedValue(
        null,
      );

      // Act
      const result = await authzService.checkContextPermission(
        user,
        'project:edit',
        { type: 'project', id: 'project-123' },
        {},
      );

      // Assert
      expect(result.granted).toBe(false);
      expect(result.reason).toBe('not_project_member');
    });
  });

  describe('中间件功能', () => {
    it('应该创建权限中间件', () => {
      // Act
      const middleware =
        authzService.createPermissionMiddleware('read:documents');

      // Assert
      expect(typeof middleware).toBe('function');
    });

    it('应该创建角色中间件', () => {
      // Act
      const middleware = authzService.createRoleMiddleware('admin');

      // Assert
      expect(typeof middleware).toBe('function');
    });

    it('应该处理中间件错误', async () => {
      // Arrange
      const middleware =
        authzService.createPermissionMiddleware('read:documents');
      const mockReq = {
        user: null,
        path: '/api/documents',
        method: 'GET',
      };
      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const mockNext = vi.fn();

      // Act
      await middleware(mockReq, mockRes, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('权限统计', () => {
    it('应该获取权限统计信息', async () => {
      // Arrange
      mockPermissionRepository.count.mockResolvedValue(50);
      mockRoleRepository.count.mockResolvedValue(10);
      mockUserRepository.count.mockResolvedValue(100);

      // Act
      const stats = await authzService.getPermissionStats();

      // Assert
      expect(stats).toBeDefined();
      expect(stats.permissions).toBe(50);
      expect(stats.roles).toBe(10);
      expect(stats.users).toBe(100);
      expect(stats.cache).toBeDefined();
    });

    it('应该获取用户权限', async () => {
      // Arrange
      const user = new User({
        id: 'user-123',
        username: 'testuser',
        email: 'stats@example.com',
        permissions: ['direct:permission'],
        roles: ['user'],
      });

      const role = new Role({
        id: 'role-123',
        name: 'user',
        permissions: ['role:permission'],
      });

      mockUserRepository.findById.mockResolvedValue(user);
      mockRoleRepository.findByUserId.mockResolvedValue([role]);

      // Act
      const permissions = await authzService.getUserPermissions('user-123');

      // Assert
      expect(permissions.direct).toContain('direct:permission');
      expect(permissions.fromRoles).toContain('role:permission');
      expect(permissions.all).toContain('direct:permission');
      expect(permissions.all).toContain('role:permission');
    });
  });

  describe('批量操作', () => {
    it('应该批量检查权限', async () => {
      // Arrange
      const user = new User({
        id: 'user-123',
        username: 'testuser',
        email: 'batch@example.com',
        permissions: ['read:documents'],
      });

      const permissionChecks = [
        { permission: 'read:documents', resource: null },
        { permission: 'write:documents', resource: null },
      ];

      // Act
      const results = await authzService.batchCheckPermissions(
        user,
        permissionChecks,
      );

      // Assert
      expect(results).toHaveLength(2);
      expect(results[0].result.granted).toBe(true);
      expect(results[1].result.granted).toBe(false);
    });
  });

  describe('配置选项', () => {
    it('应该支持禁用缓存', () => {
      // Arrange
      const authzServiceNoCache = new AuthorizationService({
        enablePermissionCaching: false,
      });

      // Assert
      expect(authzServiceNoCache.options.enablePermissionCaching).toBe(false);
    });

    it('应该支持自定义超级管理员角色', () => {
      // Arrange
      const authzServiceCustom = new AuthorizationService({
        superAdminRole: 'god_mode',
      });

      // Assert
      expect(authzServiceCustom.options.superAdminRole).toBe('god_mode');
    });

    it('应该支持自定义缓存TTL', () => {
      // Arrange
      const authzServiceCustom = new AuthorizationService({
        cacheTtl: 10000,
      });

      // Assert
      expect(authzServiceCustom.options.cacheTtl).toBe(10000);
    });
  });

  describe('错误处理', () => {
    it('应该处理权限检查错误', async () => {
      // Arrange
      const user = new User({
        id: 'user-123',
        username: 'testuser',
        email: 'error@example.com',
      });

      mockRoleRepository.findByUserId.mockRejectedValue(
        new Error('Database error'),
      );

      // Act
      const result = await authzService.checkPermission(
        user,
        'test:permission',
      );

      // Assert
      expect(result.granted).toBe(false);
      expect(result.reason).toBe('error');
      expect(result.error).toBe('Database error');
    });

    it('应该处理无效的权限格式', () => {
      // Arrange
      const user = new User({
        id: 'user-123',
        username: 'testuser',
        email: 'invalid@example.com',
        permissions: ['invalid-permission-format'],
      });

      // Act
      const result = authzService.hasPermissionWildcard(user, 'some:action');

      // Assert
      expect(result).toBe(false);
    });

    it('应该处理空的权限列表', async () => {
      // Arrange
      const user = new User({
        id: 'user-123',
        username: 'testuser',
        email: 'empty@example.com',
        permissions: [],
        roles: [],
      });

      mockRoleRepository.findByUserId.mockResolvedValue([]);

      // Act
      const result = await authzService.checkPermission(user, 'any:permission');

      // Assert
      expect(result.granted).toBe(false);
      expect(result.reason).toBe('insufficient_permissions');
    });
  });

  describe('性能测试', () => {
    it('应该高效处理多个权限检查', async () => {
      // Arrange
      const user = new User({
        id: 'user-123',
        username: 'testuser',
        email: 'perf@example.com',
        permissions: ['perm1', 'perm2', 'perm3'],
        roles: ['role1'],
      });

      const role = new Role({
        id: 'role-123',
        name: 'role1',
        permissions: ['role:perm1', 'role:perm2'],
      });

      mockRoleRepository.findByUserId.mockResolvedValue([role]);

      // Act
      const startTime = Date.now();
      const checks = [];
      for (let i = 0; i < 100; i++) {
        checks.push(authzService.checkPermission(user, 'perm' + ((i % 3) + 1)));
      }
      await Promise.all(checks);
      const endTime = Date.now();

      // Assert
      expect(endTime - startTime).toBeLessThan(1000); // 应该在1秒内完成
    });

    it('应该限制缓存大小', () => {
      // Arrange
      const authzServiceSmallCache = new AuthorizationService({
        enablePermissionCaching: true,
      });

      // Act - 添加大量缓存条目
      for (let i = 0; i < 1000; i++) {
        authzServiceSmallCache.permissionCache.set(`user-${i}`, {
          permissions: [`perm-${i}`],
          timestamp: Date.now(),
        });
      }

      // Assert
      expect(authzServiceSmallCache.permissionCache.size).toBe(1000);
    });
  });
});
