/**
 * 授权服务
 * 处理基于角色的访问控制(RBAC)
 */

import { logger } from '../../../shared/utils/logger.js';

export class AuthorizationService {
  constructor(options = {}) {
    this.options = {
      enablePermissionCaching: options.enablePermissionCaching !== false,
      cacheTtl: options.cacheTtl || 300000, // 5分钟
      superAdminRole: options.superAdminRole || 'super_admin',
      ...options,
    };

    // 依赖注入的仓库
    this.userRepository = options.userRepository;

    this.permissionCache = new Map();
    this.roleCache = new Map();
  }

  /**
   * 检查用户是否有通配符权限
   * @param {Object} user - 用户对象
   * @param {string} requiredPermission - 需要的权限
   * @returns {boolean} 是否有权限
   */
  hasPermissionWildcard(user, requiredPermission) {
    // 检查用户直接权限
    if (user.hasPermissionWildcard && user.hasPermissionWildcard(requiredPermission)) {
      return true;
    }

    // 检查用户角色权限
    if (user.roles && Array.isArray(user.roles)) {
      for (const role of user.roles) {
        if (role.hasPermissionWildcard && role.hasPermissionWildcard(requiredPermission)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * 检查用户是否有指定权限
   */
  async checkPermission(
    user,
    requiredPermission,
    resource = null,
    context = {},
  ) {
    try {
      // 检查超级管理员权限
      if (this.isSuperAdmin(user)) {
        return { granted: true, reason: 'super_admin' };
      }

      // 检查用户直接权限
      if (user.hasPermissionWildcard(requiredPermission)) {
        return { granted: true, reason: 'user_direct' };
      }

      // 检查角色权限
      const rolePermissions = await this.getUserRolePermissions(user.id);
      for (const permission of rolePermissions) {
        if (this.matchesPermission(requiredPermission, permission)) {
          return { granted: true, reason: 'role_based' };
        }
      }

      // 检查上下文特定的权限
      if (resource && context) {
        const contextPermission = await this.checkContextPermission(
          user,
          requiredPermission,
          resource,
          context,
        );
        if (contextPermission.granted) {
          return contextPermission;
        }
      }

      return { granted: false, reason: 'insufficient_permissions' };
    } catch (error) {
      logger.error('Permission check failed', {
        userId: user.id,
        permission: requiredPermission,
        error: error.message,
      });
      return { granted: false, reason: 'error', error: error.message };
    }
  }

  /**
   * 检查多个权限（任一满足）
   */
  async checkAnyPermission(user, permissions, resource = null, context = {}) {
    for (const permission of permissions) {
      const result = await this.checkPermission(
        user,
        permission,
        resource,
        context,
      );
      if (result.granted) {
        return result;
      }
    }
    return { granted: false, reason: 'insufficient_permissions' };
  }

  /**
   * 检查多个权限（全部满足）
   */
  async checkAllPermissions(user, permissions, resource = null, context = {}) {
    const results = [];

    for (const permission of permissions) {
      const result = await this.checkPermission(
        user,
        permission,
        resource,
        context,
      );
      results.push(result);
      if (!result.granted) {
        return {
          granted: false,
          reason: 'insufficient_permissions',
          details: results,
        };
      }
    }

    return {
      granted: true,
      reason: 'all_permissions_granted',
      details: results,
    };
  }

  /**
   * 检查用户是否为超级管理员
   */
  isSuperAdmin(user) {
    return user.roles && user.roles.includes(this.options.superAdminRole);
  }

  /**
   * 获取用户角色权限
   */
  async getUserRolePermissions(userId) {
    // 检查缓存
    if (this.options.enablePermissionCaching) {
      const cached = this.permissionCache.get(userId);
      if (cached && Date.now() - cached.timestamp < this.options.cacheTtl) {
        return cached.permissions;
      }
    }

    // 从数据库获取
    const permissions = new Set();

    // 获取用户角色
    const userRoles = await this.roleRepository.findByUserId(userId);
    for (const role of userRoles) {
      if (role.isActive) {
        role.permissions.forEach((permission) => permissions.add(permission));
      }
    }

    const permissionList = Array.from(permissions);

    // 缓存结果
    if (this.options.enablePermissionCaching) {
      this.permissionCache.set(userId, {
        permissions: permissionList,
        timestamp: Date.now(),
      });
    }

    return permissionList;
  }

  /**
   * 检查上下文特定权限
   */
  async checkContextPermission(user, permission, resource, context) {
    // 这里可以实现更复杂的上下文检查逻辑
    // 例如：检查用户是否是资源的拥有者、团队成员等

    const resourceType = resource.type;
    const resourceId = resource.id;

    switch (resourceType) {
      case 'project':
        return await this.checkProjectPermission(
          user,
          permission,
          resourceId,
          context,
        );
      case 'organization':
        return await this.checkOrganizationPermission(
          user,
          permission,
          resourceId,
          context,
        );
      case 'team':
        return await this.checkTeamPermission(
          user,
          permission,
          resourceId,
          context,
        );
      default:
        return { granted: false, reason: 'unsupported_resource_type' };
    }
  }

  /**
   * 检查项目权限
   */
  async checkProjectPermission(user, permission, projectId, context) {
    // 检查用户是否是项目成员
    const membership =
      await this.projectMembershipRepository.findByUserAndProject(
        user.id,
        projectId,
      );
    if (!membership) {
      return { granted: false, reason: 'not_project_member' };
    }

    // 检查项目角色权限
    if (membership.role && membership.role.permissions) {
      for (const rolePermission of membership.role.permissions) {
        if (this.matchesPermission(permission, rolePermission)) {
          return { granted: true, reason: 'project_role' };
        }
      }
    }

    return { granted: false, reason: 'insufficient_project_permissions' };
  }

  /**
   * 检查组织权限
   */
  async checkOrganizationPermission(user, permission, organizationId, context) {
    // 检查用户是否是组织成员
    const membership =
      await this.organizationMembershipRepository.findByUserAndOrganization(
        user.id,
        organizationId,
      );
    if (!membership) {
      return { granted: false, reason: 'not_organization_member' };
    }

    // 检查组织角色权限
    if (membership.role && membership.role.permissions) {
      for (const rolePermission of membership.role.permissions) {
        if (this.matchesPermission(permission, rolePermission)) {
          return { granted: true, reason: 'organization_role' };
        }
      }
    }

    return { granted: false, reason: 'insufficient_organization_permissions' };
  }

  /**
   * 检查团队权限
   */
  async checkTeamPermission(user, permission, teamId, context) {
    // 检查用户是否是团队成员
    const membership = await this.teamMembershipRepository.findByUserAndTeam(
      user.id,
      teamId,
    );
    if (!membership) {
      return { granted: false, reason: 'not_team_member' };
    }

    // 检查团队角色权限
    if (membership.role && membership.role.permissions) {
      for (const rolePermission of membership.role.permissions) {
        if (this.matchesPermission(permission, rolePermission)) {
          return { granted: true, reason: 'team_role' };
        }
      }
    }

    return { granted: false, reason: 'insufficient_team_permissions' };
  }

  /**
   * 权限匹配（支持通配符）
   */
  matchesPermission(required, granted) {
    if (granted === '*' || required === granted) {
      return true;
    }

    // 将权限转换为模式匹配
    const grantedParts = granted.split(':');
    const requiredParts = required.split(':');

    if (grantedParts.length !== requiredParts.length) {
      return false;
    }

    for (let i = 0; i < grantedParts.length; i++) {
      if (grantedParts[i] !== '*' && grantedParts[i] !== requiredParts[i]) {
        return false;
      }
    }

    return true;
  }

  /**
   * 创建权限检查中间件
   */
  createPermissionMiddleware(requiredPermission, options = {}) {
    return async (req, res, next) => {
      try {
        const user = req.user;
        if (!user) {
          return res.status(401).json({ error: 'Authentication required' });
        }

        const resource =
          options.resource || req.params.resource || req.body.resource;
        const context = {
          method: req.method,
          path: req.path,
          params: req.params,
          body: req.body,
          ...options.context,
        };

        const result = await this.checkPermission(
          user,
          requiredPermission,
          resource,
          context,
        );

        if (!result.granted) {
          logger.warn('Permission denied', {
            userId: user.id,
            permission: requiredPermission,
            resource,
            reason: result.reason,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
          });

          return res.status(403).json({
            error: 'Insufficient permissions',
            required: requiredPermission,
            reason: result.reason,
          });
        }

        // 将权限检查结果添加到请求对象
        req.permissionCheck = result;
        next();
      } catch (error) {
        logger.error('Permission middleware error', error);
        res.status(500).json({ error: 'Permission check failed' });
      }
    };
  }

  /**
   * 创建角色检查中间件
   */
  createRoleMiddleware(requiredRoles, options = {}) {
    const roles = Array.isArray(requiredRoles)
      ? requiredRoles
      : [requiredRoles];

    return async (req, res, next) => {
      try {
        const user = req.user;
        if (!user) {
          return res.status(401).json({ error: 'Authentication required' });
        }

        const hasRole = roles.some(
          (role) => user.roles && user.roles.includes(role),
        );

        if (!hasRole) {
          logger.warn('Role access denied', {
            userId: user.id,
            requiredRoles: roles,
            userRoles: user.roles,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
          });

          return res.status(403).json({
            error: 'Insufficient role permissions',
            required: roles,
            userRoles: user.roles,
          });
        }

        next();
      } catch (error) {
        logger.error('Role middleware error', error);
        res.status(500).json({ error: 'Role check failed' });
      }
    };
  }

  /**
   * 批量权限检查
   */
  async batchCheckPermissions(user, permissionChecks) {
    const results = [];

    for (const check of permissionChecks) {
      const result = await this.checkPermission(
        user,
        check.permission,
        check.resource,
        check.context,
      );
      results.push({
        ...check,
        result,
      });
    }

    return results;
  }

  /**
   * 获取用户所有权限
   */
  async getUserPermissions(userId) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const permissions = new Set();

    // 用户直接权限
    user.permissions.forEach((permission) => permissions.add(permission));

    // 角色权限
    const rolePermissions = await this.getUserRolePermissions(userId);
    rolePermissions.forEach((permission) => permissions.add(permission));

    return {
      direct: user.permissions,
      fromRoles: rolePermissions,
      all: Array.from(permissions),
    };
  }

  /**
   * 刷新用户权限缓存
   */
  refreshUserPermissionCache(userId) {
    if (this.options.enablePermissionCaching) {
      this.permissionCache.delete(userId);
      logger.debug('User permission cache refreshed', { userId });
    }
  }

  /**
   * 清理过期缓存
   */
  cleanupExpiredCache() {
    if (!this.options.enablePermissionCaching) return;

    const now = Date.now();
    const expiredKeys = [];

    for (const [key, value] of this.permissionCache) {
      if (now - value.timestamp > this.options.cacheTtl) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach((key) => this.permissionCache.delete(key));

    if (expiredKeys.length > 0) {
      logger.debug('Expired permission cache entries cleaned up', {
        count: expiredKeys.length,
      });
    }
  }

  /**
   * 获取权限统计信息
   */
  async getPermissionStats() {
    try {
      const stats = {
        cache: {
          enabled: this.options.enablePermissionCaching,
          size: this.permissionCache.size,
          ttl: this.options.cacheTtl,
        },
        roles: await this.roleRepository.count(),
        permissions: await this.permissionRepository.count(),
        users: await this.userRepository.count(),
        timestamp: new Date().toISOString(),
      };

      return stats;
    } catch (error) {
      logger.error('Failed to get permission stats', error);
      return { error: error.message };
    }
  }

  /**
   * 设置依赖注入
   */
  setDependencies(
    userRepository,
    roleRepository,
    permissionRepository,
    projectMembershipRepository,
    organizationMembershipRepository,
    teamMembershipRepository,
  ) {
    this.userRepository = userRepository;
    this.roleRepository = roleRepository;
    this.permissionRepository = permissionRepository;
    this.projectMembershipRepository = projectMembershipRepository;
    this.organizationMembershipRepository = organizationMembershipRepository;
    this.teamMembershipRepository = teamMembershipRepository;
  }
}
