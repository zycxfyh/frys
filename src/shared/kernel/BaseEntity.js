/**
 * 基础实体类
 * 所有领域实体的基类，提供通用功能
 */

export class BaseEntity {
  constructor(id, createdAt = new Date(), updatedAt = new Date()) {
    if (!id) {
      throw new Error('Entity must have an ID');
    }

    this._id = id;
    this._createdAt = createdAt;
    this._updatedAt = updatedAt;
    this._domainEvents = [];
  }

  /**
   * 获取实体ID
   */
  get id() {
    return this._id;
  }

  /**
   * 获取创建时间
   */
  get createdAt() {
    return this._createdAt;
  }

  /**
   * 获取更新时间
   */
  get updatedAt() {
    return this._updatedAt;
  }

  /**
   * 更新实体
   */
  markAsModified() {
    this._updatedAt = new Date();
  }

  /**
   * 添加领域事件
   */
  addDomainEvent(event) {
    this._domainEvents.push(event);
  }

  /**
   * 获取领域事件
   */
  get domainEvents() {
    return [...this._domainEvents];
  }

  /**
   * 清空调域事件
   */
  clearDomainEvents() {
    this._domainEvents = [];
  }

  /**
   * 检查是否等于另一个实体
   */
  equals(other) {
    if (!other || !(other instanceof BaseEntity)) {
      return false;
    }

    return this._id === other._id;
  }

  /**
   * 获取实体哈希值（用于比较）
   */
  hashCode() {
    return this._id.toString();
  }

  /**
   * 转换为普通对象（用于序列化）
   */
  toObject() {
    return {
      id: this._id,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }

  /**
   * 从对象创建实体（用于反序列化）
   */
  static fromObject(obj) {
    return new BaseEntity(
      obj.id,
      new Date(obj.createdAt),
      new Date(obj.updatedAt),
    );
  }
}
