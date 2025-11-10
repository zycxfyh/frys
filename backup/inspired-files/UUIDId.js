import { logger } from '../shared/utils/logger.js';

/**
 * UUID 风格的唯一标识符
 * 借鉴 UUID 的标准格式生成和验证理念
 */

class UUIDInspiredId {
  /**
   * 构造函数
   * 初始化UUID生成器
   */
  constructor() {
    this.namespaces = new Map(); // 命名空间
    this.generated = []; // 生成历史
  }

  /**
   * 生成UUID v4
   * @returns {string} UUID v4字符串
   */
  v4() {
    const id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });

    this.generated.push({ version: 4, id, timestamp: Date.now() });
    return id;
  }

  /**
   * 生成UUID v1（时间戳版本）
   * @returns {string} UUID v1字符串
   */
  v1() {
    const timestamp = Date.now();
    const timeHigh = (timestamp & 0xfffffff) * 10000 + 0x01b21dd213814000;
    const timeMid = (timeHigh >>> 32) & 0xffff;
    const timeLow = timeHigh & 0xffffffff;

    const id = 'xxxxxxxx-xxxx-1xxx-yxxx-xxxxxxxxxxxx'.replace(
      /[xy]/g,
      (c, i) => {
        let value;
        switch (i) {
          case 0:
          case 1:
          case 2:
          case 3:
            value = (timeLow >>> (i * 8)) & 0xff;
            break;
          case 4:
          case 5:
            value = (timeMid >>> ((i - 4) * 8)) & 0xff;
            break;
          case 6:
          case 7:
            value = (timeHigh >>> ((i - 6) * 8 + 16)) & 0xff;
            break;
          default:
            value = (Math.random() * 256) | 0;
        }
        return value.toString(16).padStart(2, '0');
      },
    );

    this.generated.push({ version: 1, id, timestamp });
    return id;
  }

  /**
   * 生成UUID v5（命名空间版本）
   * @param {string} name - 名称
   * @param {string} namespace - 命名空间UUID
   * @returns {string} UUID v5字符串
   */
  v5(
    name,
    namespace = this.namespaces.get('default') ||
      '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
  ) {
    // 简化的v5实现（实际项目中应使用crypto库）
    const combined = namespace + name;
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // 转换为32位整数
    }

    const id = 'xxxxxxxx-xxxx-5xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const value = Math.abs(hash) % 16;
      hash = Math.floor(hash / 16);
      return (c === 'x' ? value : (value & 0x3) | 0x8).toString(16);
    });

    this.generated.push({
      version: 5,
      id,
      name,
      namespace,
      timestamp: Date.now(),
    });
    return id;
  }

  /**
   * 注册命名空间
   * @param {string} name - 命名空间名称
   * @param {string} uuid - 命名空间UUID
   */
  registerNamespace(name, uuid) {
    this.namespaces.set(name, uuid);
    logger.info(`📦 命名空间已注册: ${name} [${uuid}]`);
  }

  /**
   * 验证UUID格式
   * @param {string} uuid - UUID字符串
   * @returns {boolean} 是否有效
   */
  isValid(uuid) {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  /**
   * 获取UUID版本
   * @param {string} uuid - UUID字符串
   * @returns {number|null} 版本号
   */
  version(uuid) {
    if (!this.isValid(uuid)) return null;
    return parseInt(uuid.charAt(14));
  }

  /**
   * 获取统计信息
   * @returns {Object} 统计数据
   */
  getStats() {
    const byVersion = {};
    for (const item of this.generated) {
      byVersion[item.version] = (byVersion[item.version] || 0) + 1;
    }

    return {
      total: this.generated.length,
      byVersion,
      namespaces: this.namespaces.size,
    };
  }
}

export default UUIDInspiredId;
