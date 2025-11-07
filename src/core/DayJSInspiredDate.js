/**
 * Day.js 风格的日期处理
 * 借鉴 Day.js 的轻量日期处理、Moment.js替代和格式化理念
 */

import { BaseModule } from './BaseModule.js';

class DayJSInspiredDate extends BaseModule {
  getDefaultConfig() {
    return {
      ...super.getDefaultConfig(),
      defaultTimezone: 'UTC',
      defaultLocale: 'en',
    };
  }

  constructor() {
    super('date');
  }

  async onInitialize() {
    this.formats = new Map(); // 格式
    this.locales = new Map(); // 语言环境
    this.plugins = new Map(); // 插件
    console.log('📅 Day.js风格日期处理模块已初始化');
  }

  async onDestroy() {
    this.formats.clear();
    this.locales.clear();
    this.plugins.clear();
    console.log('📅 Day.js风格日期处理模块已销毁');
  }

  /**
   * 创建日期对象
   * @param {Date|string|number} input - 输入
   * @returns {Object} 日期对象
   */
  day(input = new Date()) {
    const date = new Date(input);
    const dateId = `date_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const dateObj = {
      id: dateId,
      _date: date,

      valueOf: () => date.getTime(),
      toDate: () => date,
      format: (pattern) => this.formatDate(date, pattern),
      add: (amount, unit) => this.addDate(date, amount, unit),
      subtract: (amount, unit) => this.subtractDate(date, amount, unit),
      diff: (other, unit) => this.diffDate(date, other, unit),
      isBefore: (other) => this.isBeforeDate(date, other),
      isAfter: (other) => {
        const otherDate =
          other && typeof other === 'object' && other._date
            ? other._date
            : other;
        return this.isAfterDate(date, otherDate);
      },
      isValid: () => !isNaN(date.getTime()),
    };

    console.log(`📅 日期对象已创建: ${dateId}`);
    return dateObj;
  }

  /**
   * 格式化日期
   * @param {Date} date - 日期对象
   * @param {string} pattern - 格式模式
   * @returns {string} 格式化后的日期字符串
   */
  formatDate(date, pattern = 'YYYY-MM-DD HH:mm:ss') {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    const result = pattern
      .replace('YYYY', year)
      .replace('MM', month)
      .replace('DD', day)
      .replace('HH', hours)
      .replace('mm', minutes)
      .replace('ss', seconds);

    // 记录格式化操作
    this.formats.set(Date.now(), { pattern, result });

    return result;
  }

  /**
   * 添加日期
   * @param {Date} date - 日期对象
   * @param {number} amount - 数量
   * @param {string} unit - 单位
   * @returns {Object} 新日期对象
   */
  addDate(date, amount, unit) {
    const newDate = new Date(date);
    switch (unit) {
      case 'year':
      case 'years':
        newDate.setFullYear(newDate.getFullYear() + amount);
        break;
      case 'month':
      case 'months':
        newDate.setMonth(newDate.getMonth() + amount);
        break;
      case 'day':
      case 'days':
        newDate.setDate(newDate.getDate() + amount);
        break;
      case 'hour':
      case 'hours':
        newDate.setHours(newDate.getHours() + amount);
        break;
      case 'minute':
      case 'minutes':
        newDate.setMinutes(newDate.getMinutes() + amount);
        break;
      case 'second':
      case 'seconds':
        newDate.setSeconds(newDate.getSeconds() + amount);
        break;
    }
    return this.day(newDate);
  }

  /**
   * 减去日期
   * @param {Date} date - 日期对象
   * @param {number} amount - 数量
   * @param {string} unit - 单位
   * @returns {Object} 新日期对象
   */
  subtractDate(date, amount, unit) {
    return this.addDate(date, -amount, unit);
  }

  /**
   * 计算日期差
   * @param {Date} date1 - 第一个日期
   * @param {Date} date2 - 第二个日期
   * @param {string} unit - 单位
   * @returns {number} 日期差
   */
  diffDate(date1, date2, unit = 'day') {
    const diffMs = date1.getTime() - date2.getTime();

    switch (unit) {
      case 'year':
      case 'years':
        return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 365));
      case 'month':
      case 'months':
        return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30));
      case 'day':
      case 'days':
        return Math.floor(diffMs / (1000 * 60 * 60 * 24));
      case 'hour':
      case 'hours':
        return Math.floor(diffMs / (1000 * 60 * 60));
      case 'minute':
      case 'minutes':
        return Math.floor(diffMs / (1000 * 60));
      case 'second':
      case 'seconds':
        return Math.floor(diffMs / 1000);
      default:
        return diffMs;
    }
  }

  /**
   * 检查是否在之前
   * @param {Date} date1 - 第一个日期
   * @param {Date} date2 - 第二个日期
   * @returns {boolean} 是否在之前
   */
  isBeforeDate(date1, date2) {
    return date1.getTime() < date2.getTime();
  }

  /**
   * 检查是否在之后
   * @param {Date} date1 - 第一个日期
   * @param {Date} date2 - 第二个日期
   * @returns {boolean} 是否在之后
   */
  isAfterDate(date1, date2) {
    return date1.getTime() > date2.getTime();
  }

  /**
   * 扩展插件
   * @param {string} name - 插件名称
   * @param {Function} plugin - 插件函数
   */
  extend(name, plugin) {
    this.plugins.set(name, plugin);
    console.log(`🔌 插件已扩展: ${name}`);
  }

  /**
   * 获取统计信息
   * @returns {Object} 统计数据
   */
  getStats() {
    return {
      formats: this.formats.size,
      locales: this.locales.size,
      plugins: this.plugins.size,
    };
  }
}

export default DayJSInspiredDate;
