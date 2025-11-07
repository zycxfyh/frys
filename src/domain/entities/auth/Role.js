/**
 * 角色实体
 * 表示系统中的角色定义
 */

import { BaseEntity } from '../../../shared/kernel/BaseEntity.js';

export class Role extends BaseEntity {
  constructor(props) {
    super(
      props.id,
      props.createdAt || new Date(),
      props.updatedAt || new Date(),
    );

    this.validateProps(props);

    this.name = props.name;
    this.description = props.description;
    this.permissions = props.permissions || [];
    this.isSystem = props.isSystem || false;
    this.isActive = props.isActive !== undefined ? props.isActive : true;
  }

  validateProps(props) {
    if (!props.name || typeof props.name !== 'string') {
      throw new Error('Role name is required and must be a string');
    }
    if (props.name.length < 2 || props.name.length > 50) {
      throw new Error('Role name must be between 2 and 50 characters');
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(props.name)) {
      throw new Error(
        'Role name can only contain letters, numbers, underscores, and hyphens',
      );
    }
  }

  /**
   * 分配权限
   */
  assignPermission(permission) {
    if (!this.permissions.includes(permission)) {
      this.permissions.push(permission);
      this.updatedAt = new Date();
    }
  }

  /**
   * 移除权限
   */
  removePermission(permission) {
    this.permissions = this.permissions.filter((p) => p !== permission);
    this.updatedAt = new Date();
  }

  /**
   * 检查是否有指定权限
   */
  hasPermission(permission) {
    return this.permissions.includes(permission);
  }

  /**
   * 检查是否有指定权限（支持通配符）
   */
  hasPermissionWildcard(requiredPermission) {
    // 直接权限检查
    if (this.permissions.includes(requiredPermission)) {
      return true;
    }

    // 通配符检查
    for (const permission of this.permissions) {
      if (this.matchesPermission(requiredPermission, permission)) {
        return true;
      }
    }

    return false;
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
   * 激活角色
   */
  activate() {
    this.isActive = true;
    this.updatedAt = new Date();
  }

  /**
   * 停用角色
   */
  deactivate() {
    this.isActive = false;
    this.updatedAt = new Date();
  }

  /**
   * 转换为DTO
   */
  toDTO() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      permissions: this.permissions,
      isSystem: this.isSystem,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

/**
 * 权限实体
 * 表示系统中的权限定义
 */

export class Permission extends BaseEntity {
  constructor(props) {
    super(props.id);

    this.validateProps(props);

    this.name = props.name;
    this.description = props.description;
    this.resource = props.resource;
    this.action = props.action;
    this.scope = props.scope || 'global'; // global, organization, project, personal
    this.isSystem = props.isSystem || false;
    this.createdAt = props.createdAt || new Date();
    this.updatedAt = props.updatedAt || new Date();
  }

  validateProps(props) {
    if (!props.name || typeof props.name !== 'string') {
      throw new Error('Permission name is required and must be a string');
    }
    if (!props.resource || typeof props.resource !== 'string') {
      throw new Error('Permission resource is required and must be a string');
    }
    if (!props.action || typeof props.action !== 'string') {
      throw new Error('Permission action is required and must be a string');
    }

    // 验证权限格式：resource:action 或 resource:action:scope
    const parts = props.name.split(':');
    if (parts.length < 2 || parts.length > 3) {
      throw new Error(
        'Permission name must be in format: resource:action or resource:action:scope',
      );
    }
  }

  /**
   * 获取完整权限字符串
   */
  get fullName() {
    return this.scope && this.scope !== 'global'
      ? `${this.resource}:${this.action}:${this.scope}`
      : `${this.resource}:${this.action}`;
  }

  /**
   * 检查是否匹配指定权限
   */
  matches(permissionName) {
    if (this.name === permissionName) {
      return true;
    }

    // 检查通配符匹配
    return this.matchesPermission(permissionName, this.name);
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
   * 转换为DTO
   */
  toDTO() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      resource: this.resource,
      action: this.action,
      scope: this.scope,
      fullName: this.fullName,
      isSystem: this.isSystem,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

/**
 * 权限组实体
 * 用于组织和管理权限
 */

export class PermissionGroup extends BaseEntity {
  constructor(props) {
    super(
      props.id,
      props.createdAt || new Date(),
      props.updatedAt || new Date(),
    );

    this.validateProps(props);

    this.name = props.name;
    this.description = props.description;
    this.permissions = props.permissions || [];
    this.isSystem = props.isSystem || false;
  }

  validateProps(props) {
    if (!props.name || typeof props.name !== 'string') {
      throw new Error('Permission group name is required and must be a string');
    }
  }

  /**
   * 添加权限
   */
  addPermission(permissionId) {
    if (!this.permissions.includes(permissionId)) {
      this.permissions.push(permissionId);
      this.updatedAt = new Date();
    }
  }

  /**
   * 移除权限
   */
  removePermission(permissionId) {
    this.permissions = this.permissions.filter((p) => p !== permissionId);
    this.updatedAt = new Date();
  }

  /**
   * 获取所有权限
   */
  getAllPermissions() {
    return [...this.permissions];
  }

  /**
   * 转换为DTO
   */
  toDTO() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      permissions: this.permissions,
      isSystem: this.isSystem,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
