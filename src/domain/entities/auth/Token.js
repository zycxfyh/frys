/**
 * JWT令牌相关实体和值对象
 */

import { BaseEntity } from '../../../shared/kernel/BaseEntity.js';
import { BaseValueObject } from '../../../shared/kernel/BaseValueObject.js';

/**
 * JWT令牌实体
 */
export class Token extends BaseEntity {
  constructor(props) {
    super(
      props.id,
      props.createdAt || new Date(),
      props.updatedAt || new Date(),
    );

    this.validateProps(props);

    this.userId = props.userId;
    this.tokenType = props.tokenType; // access, refresh, reset_password, email_verification
    this.tokenValue = props.tokenValue;
    this.expiresAt = props.expiresAt;
    this.isRevoked = props.isRevoked || false;
    this.revokedAt = props.revokedAt;
    this.revokedReason = props.revokedReason;
    this.metadata = props.metadata || {};
  }

  validateProps(props) {
    if (!props.userId) {
      throw new Error('User ID is required');
    }
    if (
      !props.tokenType ||
      !['access', 'refresh', 'reset_password', 'email_verification'].includes(
        props.tokenType,
      )
    ) {
      throw new Error('Valid token type is required');
    }
    if (!props.tokenValue || typeof props.tokenValue !== 'string') {
      throw new Error('Token value is required and must be a string');
    }
    if (!props.expiresAt || !(props.expiresAt instanceof Date)) {
      throw new Error('Expiration date is required and must be a Date');
    }
  }

  /**
   * 检查令牌是否过期
   */
  isExpired() {
    return new Date() > this.expiresAt;
  }

  /**
   * 检查令牌是否有效
   */
  isValid() {
    return !this.isRevoked && !this.isExpired();
  }

  /**
   * 撤销令牌
   */
  revoke(reason = 'manual_revoke') {
    this.isRevoked = true;
    this.revokedAt = new Date();
    this.revokedReason = reason;
    this.updatedAt = new Date();
  }

  /**
   * 延长过期时间
   */
  extendExpiration(newExpirationDate) {
    if (!(newExpirationDate instanceof Date)) {
      throw new Error('New expiration date must be a Date');
    }
    if (newExpirationDate <= new Date()) {
      throw new Error('New expiration date must be in the future');
    }
    this.expiresAt = newExpirationDate;
    this.updatedAt = new Date();
  }

  /**
   * 更新元数据
   */
  updateMetadata(metadata) {
    this.metadata = { ...this.metadata, ...metadata };
    this.updatedAt = new Date();
  }

  /**
   * 转换为DTO
   */
  toDTO() {
    return {
      id: this.id,
      userId: this.userId,
      tokenType: this.tokenType,
      expiresAt: this.expiresAt,
      isRevoked: this.isRevoked,
      revokedAt: this.revokedAt,
      revokedReason: this.revokedReason,
      metadata: this.metadata,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

/**
 * JWT载荷值对象
 */
export class JWTPayload extends BaseValueObject {
  constructor(props) {
    super({
      userId: props.userId,
      username: props.username,
      email: props.email,
      roles: props.roles || [],
      permissions: props.permissions || [],
      tokenType: props.tokenType,
      issuedAt: props.issuedAt || Math.floor(Date.now() / 1000),
      expiresAt: props.expiresAt,
      issuer: props.issuer,
      audience: props.audience,
      sessionId: props.sessionId,
      metadata: props.metadata || {},
    });

    this.validate();
  }

  validate() {
    if (!this.props.userId) {
      throw new Error('User ID is required');
    }
    if (
      !this.props.tokenType ||
      !['access', 'refresh'].includes(this.props.tokenType)
    ) {
      throw new Error('Valid token type is required');
    }
    if (!this.props.expiresAt || typeof this.props.expiresAt !== 'number') {
      throw new Error('Expiration timestamp is required and must be a number');
    }
    if (this.props.expiresAt <= this.props.issuedAt) {
      throw new Error('Expiration time must be after issued time');
    }
  }

  get userId() {
    return this.props.userId;
  }
  get username() {
    return this.props.username;
  }
  get email() {
    return this.props.email;
  }
  get roles() {
    return this.props.roles;
  }
  get permissions() {
    return this.props.permissions;
  }
  get tokenType() {
    return this.props.tokenType;
  }
  get issuedAt() {
    return this.props.issuedAt;
  }
  get expiresAt() {
    return this.props.expiresAt;
  }
  get issuer() {
    return this.props.issuer;
  }
  get audience() {
    return this.props.audience;
  }
  get sessionId() {
    return this.props.sessionId;
  }
  get metadata() {
    return this.props.metadata;
  }

  /**
   * 检查是否过期
   */
  isExpired() {
    return Date.now() / 1000 > this.expiresAt;
  }

  /**
   * 获取剩余时间（秒）
   */
  getTimeToExpiry() {
    return Math.max(0, this.expiresAt - Math.floor(Date.now() / 1000));
  }

  /**
   * 转换为JWT标准载荷
   */
  toJWTFormat() {
    return {
      sub: this.userId,
      username: this.username,
      email: this.email,
      roles: this.roles,
      permissions: this.permissions,
      type: this.tokenType,
      iat: this.issuedAt,
      exp: this.expiresAt,
      iss: this.issuer,
      aud: this.audience,
      sessionId: this.sessionId,
      ...this.metadata,
    };
  }

  /**
   * 从JWT格式创建实例
   */
  static fromJWTFormat(payload) {
    return new JWTPayload({
      userId: payload.sub,
      username: payload.username,
      email: payload.email,
      roles: payload.roles || [],
      permissions: payload.permissions || [],
      tokenType: payload.type,
      issuedAt: payload.iat,
      expiresAt: payload.exp,
      issuer: payload.iss,
      audience: payload.aud,
      sessionId: payload.sessionId,
      metadata: payload.metadata || {},
    });
  }
}

/**
 * 刷新令牌对值对象
 */
export class TokenPair extends BaseValueObject {
  constructor(props) {
    super({
      accessToken: props.accessToken,
      refreshToken: props.refreshToken,
      expiresIn: props.expiresIn,
      refreshExpiresIn: props.refreshExpiresIn,
      tokenType: props.tokenType || 'Bearer',
    });

    this.validate();
  }

  validate() {
    if (!this.props.accessToken || typeof this.props.accessToken !== 'string') {
      throw new Error('Access token is required and must be a string');
    }
    if (
      !this.props.refreshToken ||
      typeof this.props.refreshToken !== 'string'
    ) {
      throw new Error('Refresh token is required and must be a string');
    }
    if (!this.props.expiresIn || typeof this.props.expiresIn !== 'number') {
      throw new Error('Access token expiry is required and must be a number');
    }
    if (
      !this.props.refreshExpiresIn ||
      typeof this.props.refreshExpiresIn !== 'number'
    ) {
      throw new Error('Refresh token expiry is required and must be a number');
    }
  }

  get accessToken() {
    return this.props.accessToken;
  }
  get refreshToken() {
    return this.props.refreshToken;
  }
  get expiresIn() {
    return this.props.expiresIn;
  }
  get refreshExpiresIn() {
    return this.props.refreshExpiresIn;
  }
  get tokenType() {
    return this.props.tokenType;
  }

  /**
   * 转换为响应格式
   */
  toResponse() {
    return {
      access_token: this.accessToken,
      refresh_token: this.refreshToken,
      expires_in: this.expiresIn,
      refresh_expires_in: this.refreshExpiresIn,
      token_type: this.tokenType,
    };
  }
}

/**
 * 会话实体
 */
export class Session extends BaseEntity {
  constructor(props) {
    super(
      props.id,
      props.createdAt || new Date(),
      props.updatedAt || new Date(),
    );

    this.validateProps(props);

    this.userId = props.userId;
    this.sessionId = props.sessionId;
    this.ipAddress = props.ipAddress;
    this.userAgent = props.userAgent;
    this.isActive = props.isActive !== undefined ? props.isActive : true;
    this.expiresAt = props.expiresAt;
    this.lastActivityAt = props.lastActivityAt || new Date();
    this.metadata = props.metadata || {};
  }

  validateProps(props) {
    if (!props.userId) {
      throw new Error('User ID is required');
    }
    if (!props.sessionId || typeof props.sessionId !== 'string') {
      throw new Error('Session ID is required and must be a string');
    }
    if (props.expiresAt && !(props.expiresAt instanceof Date)) {
      throw new Error('Expiration date must be a Date');
    }
  }

  /**
   * 检查会话是否过期
   */
  isExpired() {
    return this.expiresAt && new Date() > this.expiresAt;
  }

  /**
   * 检查会话是否有效
   */
  isValid() {
    return this.isActive && !this.isExpired();
  }

  /**
   * 更新最后活动时间
   */
  updateActivity() {
    this.lastActivityAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * 终止会话
   */
  terminate() {
    this.isActive = false;
    this.updatedAt = new Date();
  }

  /**
   * 延长会话
   */
  extend(newExpiryDate) {
    if (!(newExpiryDate instanceof Date)) {
      throw new Error('New expiry date must be a Date');
    }
    this.expiresAt = newExpiryDate;
    this.updatedAt = new Date();
  }

  /**
   * 更新元数据
   */
  updateMetadata(metadata) {
    this.metadata = { ...this.metadata, ...metadata };
    this.updatedAt = new Date();
  }

  /**
   * 转换为DTO
   */
  toDTO() {
    return {
      id: this.id,
      userId: this.userId,
      sessionId: this.sessionId,
      ipAddress: this.ipAddress,
      userAgent: this.userAgent,
      isActive: this.isActive,
      expiresAt: this.expiresAt,
      lastActivityAt: this.lastActivityAt,
      metadata: this.metadata,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
