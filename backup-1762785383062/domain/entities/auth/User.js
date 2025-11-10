/**
 * 用户实体
 * 表示系统中的用户账号
 */

import { BaseEntity } from '../../../shared/kernel/BaseEntity.js';
import { BaseValueObject } from '../../../shared/kernel/BaseValueObject.js';

export class User extends BaseEntity {
  constructor(props) {
    super(
      props.id,
      props.createdAt || new Date(),
      props.updatedAt || new Date(),
    );

    this.validateProps(props);

    this.username = props.username;
    this.email = props.email;
    this.passwordHash = props.passwordHash;
    this.isActive = props.isActive !== undefined ? props.isActive : true;
    this.isEmailVerified = props.isEmailVerified || false;
    this.roles = props.roles || [];
    this.permissions = props.permissions || [];
    this.profile = props.profile || {};
    this.lastLoginAt = props.lastLoginAt;
  }

  validateProps(props) {
    if (!props.username || typeof props.username !== 'string') {
      throw new Error('Username is required and must be a string');
    }
    if (!props.email || typeof props.email !== 'string') {
      throw new Error('Email is required and must be a string');
    }
    if (!this.isValidEmail(props.email)) {
      throw new Error('Invalid email format');
    }
    if (props.passwordHash && typeof props.passwordHash !== 'string') {
      throw new Error('Password hash must be a string');
    }
  }

  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * 更新最后登录时间
   */
  updateLastLogin() {
    this.lastLoginAt = new Date();
    this.markAsModified();
  }

  /**
   * 激活用户
   */
  activate() {
    this.isActive = true;
    this.updatedAt = new Date();
  }

  /**
   * 停用用户
   */
  deactivate() {
    this.isActive = false;
    this.updatedAt = new Date();
  }

  /**
   * 验证邮箱
   */
  verifyEmail() {
    this.isEmailVerified = true;
    this.updatedAt = new Date();
  }

  /**
   * 分配角色
   */
  assignRole(roleId) {
    if (!this.roles.includes(roleId)) {
      this.roles.push(roleId);
      this.updatedAt = new Date();
    }
  }

  /**
   * 移除角色
   */
  removeRole(roleId) {
    this.roles = this.roles.filter((role) => role !== roleId);
    this.updatedAt = new Date();
  }

  /**
   * 检查是否有指定角色
   */
  hasRole(roleId) {
    return this.roles.includes(roleId);
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
   * 更新用户信息
   */
  updateProfile(profile) {
    this.profile = { ...this.profile, ...profile };
    this.updatedAt = new Date();
  }

  /**
   * 转换为DTO
   */
  toDTO() {
    return {
      id: this.id,
      username: this.username,
      email: this.email,
      isActive: this.isActive,
      isEmailVerified: this.isEmailVerified,
      roles: this.roles,
      permissions: this.permissions,
      profile: this.profile,
      lastLoginAt: this.lastLoginAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  /**
   * 转换为公开DTO（不包含敏感信息）
   */
  toPublicDTO() {
    return {
      id: this.id,
      username: this.username,
      email: this.email,
      isActive: this.isActive,
      isEmailVerified: this.isEmailVerified,
      roles: this.roles,
      profile: this.profile,
      lastLoginAt: this.lastLoginAt,
      createdAt: this.createdAt,
    };
  }
}

/**
 * 用户名值对象
 */
export class Username extends BaseValueObject {
  constructor(value) {
    super({ value });
    this.validate();
  }

  validate() {
    if (!this.props.value || typeof this.props.value !== 'string') {
      throw new Error('Username is required and must be a string');
    }
    if (this.props.value.length < 3 || this.props.value.length > 50) {
      throw new Error('Username must be between 3 and 50 characters');
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(this.props.value)) {
      throw new Error(
        'Username can only contain letters, numbers, underscores, and hyphens',
      );
    }
  }

  get value() {
    return this.props.value;
  }
}

/**
 * 邮箱值对象
 */
export class Email extends BaseValueObject {
  constructor(value) {
    super({ value });
    this.validate();
  }

  validate() {
    if (!this.props.value || typeof this.props.value !== 'string') {
      throw new Error('Email is required and must be a string');
    }
    if (!this.isValidEmail(this.props.value)) {
      throw new Error('Invalid email format');
    }
  }

  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  get value() {
    return this.props.value;
  }

  get domain() {
    return this.props.value.split('@')[1];
  }
}
