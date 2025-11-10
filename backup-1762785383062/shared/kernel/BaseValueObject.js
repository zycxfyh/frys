/**
 * 基础值对象类
 * 值对象是不可变的，用于表示概念上的整体
 */

export class BaseValueObject {
  constructor(props) {
    if (new.target === BaseValueObject) {
      throw new Error('BaseValueObject cannot be instantiated directly');
    }

    this._props = Object.freeze({ ...props });
  }

  /**
   * 获取属性
   */
  get props() {
    return this._props;
  }

  /**
   * 检查是否等于另一个值对象
   */
  equals(other) {
    if (!other || !(other instanceof BaseValueObject)) {
      return false;
    }

    if (this.constructor !== other.constructor) {
      return false;
    }

    return this._deepEquals(this._props, other._props);
  }

  /**
   * 深比较两个对象
   */
  _deepEquals(a, b) {
    if (a === b) return true;

    if (a == null || b == null) return false;

    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (!this._deepEquals(a[i], b[i])) return false;
      }
      return true;
    }

    if (typeof a === 'object' && typeof b === 'object') {
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);

      if (keysA.length !== keysB.length) return false;

      for (const key of keysA) {
        if (!keysB.includes(key)) return false;
        if (!this._deepEquals(a[key], b[key])) return false;
      }

      return true;
    }

    return false;
  }

  /**
   * 获取哈希值
   */
  hashCode() {
    return JSON.stringify(this._props);
  }

  /**
   * 转换为字符串
   */
  toString() {
    return `${this.constructor.name}(${JSON.stringify(this._props)})`;
  }

  /**
   * 转换为普通对象
   */
  toObject() {
    return { ...this._props };
  }
}
