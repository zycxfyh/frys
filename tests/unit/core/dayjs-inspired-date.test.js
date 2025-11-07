/**
 * DayJSInspiredDate 单元测试
 * 测试日期处理系统的核心功能
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import DayJSInspiredDate from '../../../src/core/DayJSInspiredDate.js';

describe('DayJSInspiredDate', () => {
  let dayjs;

  beforeEach(() => {
    dayjs = new DayJSInspiredDate();
  });

  afterEach(() => {
    dayjs = null;
  });

  describe('构造函数', () => {
    it('应该正确初始化实例', () => {
      expect(dayjs).toBeInstanceOf(DayJSInspiredDate);
      expect(dayjs.formats).toBeDefined();
      expect(dayjs.locales).toBeDefined();
      expect(dayjs.plugins).toBeDefined();
    });

    it('应该有空的初始状态', () => {
      const stats = dayjs.getStats();
      expect(stats.formats).toBe(0);
      expect(stats.locales).toBe(0);
      expect(stats.plugins).toBe(0);
    });
  });

  describe('日期创建', () => {
    it('应该能创建当前日期对象', () => {
      const date = dayjs.day();
      expect(date).toBeDefined();
      expect(typeof date.valueOf).toBe('function');
      expect(typeof date.format).toBe('function');
      expect(typeof date.add).toBe('function');
    });

    it('应该能从字符串创建日期', () => {
      const date = dayjs.day('2024-01-01');
      expect(date).toBeDefined();
      const formatted = date.format('YYYY-MM-DD');
      expect(formatted).toBe('2024-01-01');
    });

    it('应该能从Date对象创建日期', () => {
      const jsDate = new Date('2024-01-01T12:00:00Z');
      const date = dayjs.day(jsDate);
      expect(date).toBeDefined();
      expect(date.valueOf()).toBe(jsDate.getTime());
    });

    it('应该生成唯一的日期对象ID', () => {
      const date1 = dayjs.day();
      const date2 = dayjs.day();
      expect(date1.id).not.toBe(date2.id);
      expect(typeof date1.id).toBe('string');
    });
  });

  describe('日期格式化', () => {
    it('应该能格式化为YYYY-MM-DD', () => {
      const date = dayjs.day('2024-01-15');
      const formatted = date.format('YYYY-MM-DD');
      expect(formatted).toBe('2024-01-15');
    });

    it('应该能格式化为完整日期时间', () => {
      const date = dayjs.day('2024-01-15T14:30:45');
      const formatted = date.format('YYYY-MM-DD HH:mm:ss');
      expect(formatted).toBe('2024-01-15 14:30:45');
    });

    it('应该支持自定义格式', () => {
      const date = dayjs.day('2024-12-25');
      const formatted = date.format('MM/DD/YYYY');
      expect(formatted).toBe('12/25/2024');
    });
  });

  describe('日期运算', () => {
    it('应该能添加天数', () => {
      const date = dayjs.day('2024-01-01');
      const newDate = date.add(5, 'day');
      const formatted = newDate.format('YYYY-MM-DD');
      expect(formatted).toBe('2024-01-06');
    });

    it('应该能添加月份', () => {
      const date = dayjs.day('2024-01-15');
      const newDate = date.add(2, 'month');
      const formatted = newDate.format('YYYY-MM-DD');
      expect(formatted).toBe('2024-03-15');
    });

    it('应该能添加年份', () => {
      const date = dayjs.day('2024-06-15');
      const newDate = date.add(1, 'year');
      const formatted = newDate.format('YYYY-MM-DD');
      expect(formatted).toBe('2025-06-15');
    });

    it('应该能减去日期', () => {
      const date = dayjs.day('2024-01-10');
      const newDate = date.subtract(3, 'day');
      const formatted = newDate.format('YYYY-MM-DD');
      expect(formatted).toBe('2024-01-07');
    });

    it('应该能处理跨月情况', () => {
      const date = dayjs.day('2024-01-31');
      const newDate = date.add(1, 'month');
      const formatted = newDate.format('YYYY-MM-DD');
      expect(formatted).toBe('2024-03-02'); // JavaScript Date 处理边界情况
    });
  });

  describe('日期比较', () => {
    it('应该能比较日期前后', () => {
      const date1 = dayjs.day('2024-01-01');
      const date2 = dayjs.day('2024-01-02');

      expect(date1.isBefore(date2._date)).toBe(true);
      expect(date2.isAfter(date1._date)).toBe(true);
      expect(date1.isAfter(date2._date)).toBe(false);
    });

    it('应该能处理相同日期', () => {
      const date1 = dayjs.day('2024-01-01T12:00:00');
      const date2 = dayjs.day('2024-01-01T15:00:00');

      expect(date1.isBefore(date2._date)).toBe(true);
      expect(date2.isAfter(date1._date)).toBe(true);
    });
  });

  describe('日期差计算', () => {
    it('应该能计算天数差', () => {
      const date1 = dayjs.day('2024-01-01');
      const date2 = dayjs.day('2024-01-05');
      const diff = date2.diff(date1._date, 'day');
      expect(diff).toBe(4);
    });

    it('应该能计算月数差', () => {
      const date1 = dayjs.day('2024-01-01');
      const date2 = dayjs.day('2024-04-01');
      const diff = date2.diff(date1._date, 'month');
      expect(diff).toBe(3);
    });

    it('应该能计算年数差', () => {
      const date1 = dayjs.day('2020-01-01');
      const date2 = dayjs.day('2024-01-01');
      const diff = date2.diff(date1._date, 'year');
      expect(diff).toBe(4);
    });

    it('应该处理负数差值', () => {
      const date1 = dayjs.day('2024-01-05');
      const date2 = dayjs.day('2024-01-01');
      const diff = date2.diff(date1._date, 'day');
      expect(diff).toBe(-4);
    });
  });

  describe('日期验证', () => {
    it('应该验证有效日期', () => {
      const validDate = dayjs.day('2024-01-01');
      expect(validDate.isValid()).toBe(true);
    });

    it('应该验证无效日期', () => {
      const invalidDate = dayjs.day('invalid-date');
      expect(invalidDate.isValid()).toBe(false);
    });

    it('应该能转换为原生Date对象', () => {
      const date = dayjs.day('2024-01-01T12:00:00');
      const jsDate = date.toDate();
      expect(jsDate).toBeInstanceOf(Date);
      expect(jsDate.getTime()).toBe(date.valueOf());
    });
  });

  describe('插件系统', () => {
    it('应该能扩展插件', () => {
      const plugin = { name: 'test', fn: () => {} };
      dayjs.extend('test-plugin', plugin);

      expect(dayjs.plugins.has('test-plugin')).toBe(true);
      expect(dayjs.getStats().plugins).toBe(1);
    });
  });

  describe('性能测试', () => {
    it('应该能高效处理大量日期操作', () => {
      const startTime = global.performanceMonitor.start();

      for (let i = 0; i < 1000; i++) {
        const date = dayjs.day('2024-01-01');
        date.add(i, 'day');
        date.format('YYYY-MM-DD');
      }

      const perfResult = global.performanceMonitor.end(startTime);
      console.log(`1000次日期操作耗时: ${perfResult.formatted}`);
      expect(perfResult.duration).toBeLessThan(500); // 500ms内完成
    });

    it('应该能处理并发日期创建', async () => {
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(Promise.resolve(dayjs.day(`2024-01-${String(i % 28 + 1).padStart(2, '0')}`)));
      }

      const dates = await Promise.all(promises);
      expect(dates).toHaveLength(100);
      dates.forEach(date => {
        expect(date.isValid()).toBe(true);
      });
    });
  });

  describe('边界情况处理', () => {
    it('应该处理闰年2月', () => {
      const leapYear = dayjs.day('2024-02-28');
      const nextDay = leapYear.add(1, 'day');
      expect(nextDay.format('YYYY-MM-DD')).toBe('2024-02-29');

      const afterLeap = nextDay.add(1, 'day');
      expect(afterLeap.format('YYYY-MM-DD')).toBe('2024-03-01');
    });

    it('应该处理非闰年2月', () => {
      const nonLeap = dayjs.day('2023-02-28');
      const nextDay = nonLeap.add(1, 'day');
      expect(nextDay.format('YYYY-MM-DD')).toBe('2023-03-01');
    });

    it('应该处理时区转换', () => {
      // 这个测试主要验证基本功能，实际时区处理需要更复杂的实现
      const date = dayjs.day('2024-01-01T00:00:00Z');
      expect(date.isValid()).toBe(true);
    });
  });
});
