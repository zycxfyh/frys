/**
 * LodashInspiredUtils 单元测试
 * 测试工具函数库的核心功能
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import LodashInspiredUtils from '../../../src/core/LodashInspiredUtils.js';

describe('LodashInspiredUtils', () => {
  let lodash;

  beforeEach(async () => {
    lodash = new LodashInspiredUtils();
    await lodash.initialize();
  });

  afterEach(async () => {
    if (lodash) {
      await lodash.destroy();
    }
    lodash = null;
  });

  describe('构造函数', () => {
    it('应该正确初始化实例', () => {
      expect(lodash).toBeInstanceOf(LodashInspiredUtils);
      expect(lodash.operations).toBeDefined();
      expect(Array.isArray(lodash.operations)).toBe(true);
    });

    it('应该有空的初始状态', () => {
      const stats = lodash.getStats();
      expect(stats.operations).toBe(0);
      expect(stats.types).toEqual([]);
    });
  });

  describe('uniq 方法', () => {
    it('应该能去重基本类型数组', () => {
      const input = [1, 2, 2, 3, 3, 3, 4];
      const result = lodash.uniq(input);

      expect(result).toEqual([1, 2, 3, 4]);
      expect(result.length).toBe(4);
    });

    it('应该能去重字符串数组', () => {
      const input = ['a', 'b', 'b', 'c', 'a', 'c'];
      const result = lodash.uniq(input);

      expect(result).toEqual(['a', 'b', 'c']);
      expect(result.length).toBe(3);
    });

    it('应该能去重对象数组（引用类型）', () => {
      const obj1 = { id: 1 };
      const obj2 = { id: 2 };
      const input = [obj1, obj2, obj1, obj2];
      const result = lodash.uniq(input);

      expect(result).toHaveLength(2);
      expect(result).toContain(obj1);
      expect(result).toContain(obj2);
    });

    it('应该能去重混合类型数组', () => {
      const input = [1, '1', 1, '1', true, false, true];
      const result = lodash.uniq(input);

      expect(result).toEqual([1, '1', true, false]);
      expect(result.length).toBe(4);
    });

    it('应该处理空数组', () => {
      const result = lodash.uniq([]);
      expect(result).toEqual([]);
    });

    it('应该处理单元素数组', () => {
      const result = lodash.uniq([42]);
      expect(result).toEqual([42]);
    });

    it('应该处理所有元素相同的数组', () => {
      const result = lodash.uniq([1, 1, 1, 1]);
      expect(result).toEqual([1]);
    });

    it('应该记录操作统计', () => {
      const input = [1, 2, 2, 3];
      lodash.uniq(input);

      const stats = lodash.getStats();
      expect(stats.operations).toBe(1);
      expect(stats.types).toContain('uniq');
    });
  });

  describe('groupBy 方法', () => {
    it('应该能按函数分组', () => {
      const input = [1, 2, 3, 4, 5, 6];
      const result = lodash.groupBy(input, (n) => n % 2 === 0 ? 'even' : 'odd');

      expect(result).toEqual({
        even: [2, 4, 6],
        odd: [1, 3, 5]
      });
    });

    it('应该能按属性分组', () => {
      const input = [
        { name: 'Alice', age: 25 },
        { name: 'Bob', age: 30 },
        { name: 'Charlie', age: 25 }
      ];
      const result = lodash.groupBy(input, 'age');

      expect(result).toEqual({
        25: [
          { name: 'Alice', age: 25 },
          { name: 'Charlie', age: 25 }
        ],
        30: [{ name: 'Bob', age: 30 }]
      });
    });

    it('应该能按字符串属性分组', () => {
      const input = [
        { category: 'fruit', name: 'apple' },
        { category: 'vegetable', name: 'carrot' },
        { category: 'fruit', name: 'banana' }
      ];
      const result = lodash.groupBy(input, 'category');

      expect(result).toEqual({
        fruit: [
          { category: 'fruit', name: 'apple' },
          { category: 'fruit', name: 'banana' }
        ],
        vegetable: [{ category: 'vegetable', name: 'carrot' }]
      });
    });

    it('应该处理空数组', () => {
      const result = lodash.groupBy([], 'property');
      expect(result).toEqual({});
    });

    it('应该处理所有元素相同的情况', () => {
      const input = [1, 1, 1];
      const result = lodash.groupBy(input, (n) => n.toString());

      expect(result).toEqual({
        '1': [1, 1, 1]
      });
    });

    it('应该处理复杂对象的分组', () => {
      const input = [
        { user: { id: 1, name: 'Alice' }, status: 'active' },
        { user: { id: 2, name: 'Bob' }, status: 'inactive' },
        { user: { id: 3, name: 'Charlie' }, status: 'active' }
      ];
      const result = lodash.groupBy(input, 'status');

      expect(result.active).toHaveLength(2);
      expect(result.inactive).toHaveLength(1);
      expect(result.active[0].user.name).toBe('Alice');
    });

    it('应该记录操作统计', () => {
      const input = [1, 2, 3, 4];
      lodash.groupBy(input, (n) => n % 2);

      const stats = lodash.getStats();
      expect(stats.operations).toBe(1);
      expect(stats.types).toContain('groupBy');
    });
  });

  describe('cloneDeep 方法', () => {
    it('应该能深拷贝简单对象', () => {
      const original = { a: 1, b: 2, c: { d: 3 } };
      const cloned = lodash.cloneDeep(original);

      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
      expect(cloned.c).not.toBe(original.c);
    });

    it('应该能深拷贝嵌套对象', () => {
      const original = {
        users: [
          { name: 'Alice', scores: [85, 92] },
          { name: 'Bob', scores: [78, 88] }
        ],
        settings: {
          theme: 'dark',
          notifications: {
            email: true,
            push: false
          }
        }
      };

      const cloned = lodash.cloneDeep(original);

      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
      expect(cloned.users).not.toBe(original.users);
      expect(cloned.users[0]).not.toBe(original.users[0]);
      expect(cloned.settings).not.toBe(original.settings);
      expect(cloned.settings.notifications).not.toBe(original.settings.notifications);
    });

    it('应该能深拷贝数组', () => {
      const original = [1, [2, 3], { a: 4 }];
      const cloned = lodash.cloneDeep(original);

      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
      expect(cloned[1]).not.toBe(original[1]);
      expect(cloned[2]).not.toBe(original[2]);
    });

    it('应该能深拷贝基本类型', () => {
      expect(lodash.cloneDeep(42)).toBe(42);
      expect(lodash.cloneDeep('hello')).toBe('hello');
      expect(lodash.cloneDeep(true)).toBe(true);
      expect(lodash.cloneDeep(null)).toBe(null);
      expect(lodash.cloneDeep(undefined)).toBe(undefined);
    });

    it('应该处理循环引用（通过JSON序列化会抛出错误）', () => {
      const circular = { a: 1 };
      circular.self = circular;

      expect(() => lodash.cloneDeep(circular)).toThrow();
    });

    it('应该处理特殊值', () => {
      const original = {
        date: new Date('2024-01-01'),
        regex: /test/g,
        func: () => {}
      };

      // JSON序列化会丢失这些特殊值
      const cloned = lodash.cloneDeep(original);

      // Date会被转换为字符串
      expect(typeof cloned.date).toBe('string');
      // 函数会丢失
      expect(cloned.func).toBeUndefined();
    });

    it('应该记录操作统计', () => {
      const obj = { a: 1, b: { c: 2 } };
      lodash.cloneDeep(obj);

      const stats = lodash.getStats();
      expect(stats.operations).toBe(1);
      expect(stats.types).toContain('cloneDeep');
    });
  });

  describe('统计信息', () => {
    it('应该提供准确的操作统计', () => {
      expect(lodash.getStats().operations).toBe(0);

      lodash.uniq([1, 2, 2]);
      expect(lodash.getStats().operations).toBe(1);

      lodash.groupBy([1, 2, 3], (n) => n % 2);
      expect(lodash.getStats().operations).toBe(2);

      lodash.cloneDeep({ a: 1 });
      expect(lodash.getStats().operations).toBe(3);
    });

    it('应该跟踪所有操作类型', () => {
      lodash.uniq([1, 2, 2]);
      lodash.groupBy([1, 2, 3], (n) => n % 2);
      lodash.cloneDeep({ a: 1 });

      const stats = lodash.getStats();
      expect(stats.operations).toBe(3);
      expect(stats.types).toEqual(['uniq', 'groupBy', 'cloneDeep']);
    });

    it('应该处理重复的操作类型', () => {
      lodash.uniq([1, 2, 2]);
      lodash.uniq([3, 4, 4]);
      lodash.groupBy([1, 2, 3], (n) => n % 2);

      const stats = lodash.getStats();
      expect(stats.operations).toBe(3);
      expect(stats.types).toEqual(['uniq', 'groupBy']);
    });
  });

  describe('综合使用场景', () => {
    it('应该支持链式调用风格', () => {
      const duplicateItem = { id: 1, category: 'A', value: 10 };
      const data = [
        duplicateItem,
        { id: 2, category: 'B', value: 20 },
        { id: 3, category: 'A', value: 30 },
        { id: 4, category: 'B', value: 40 },
        duplicateItem, // 真正的重复引用
        { id: 5, category: 'C', value: 50 }
      ];

      // 去重
      const unique = lodash.uniq(data);

      // 按类别分组
      const grouped = lodash.groupBy(unique, 'category');

      // 深拷贝结果
      const cloned = lodash.cloneDeep(grouped);

      expect(unique).toHaveLength(5); // 去重后的长度 (id 1重复)
      expect(grouped.A).toHaveLength(2);
      expect(grouped.B).toHaveLength(2);
      expect(cloned).toEqual(grouped);
      expect(cloned).not.toBe(grouped);

      const stats = lodash.getStats();
      expect(stats.operations).toBe(3);
      expect(stats.types).toEqual(['uniq', 'groupBy', 'cloneDeep']);
    });

    it('应该处理大数据集', () => {
      // 创建大数据集 - 重复的对象引用
      const templateObjects = [
        { id: 0, category: 'A', value: 1 },
        { id: 1, category: 'B', value: 2 },
        { id: 2, category: 'C', value: 3 },
        { id: 3, category: 'A', value: 4 },
        { id: 4, category: 'B', value: 5 },
        { id: 5, category: 'C', value: 6 },
        { id: 6, category: 'A', value: 7 },
        { id: 7, category: 'B', value: 8 },
        { id: 8, category: 'C', value: 9 },
        { id: 9, category: 'A', value: 10 }
      ];

      const largeArray = [];
      for (let i = 0; i < 100; i++) {
        largeArray.push(...templateObjects); // 添加重复的对象引用
      }

      const startTime = global.performanceMonitor.start();

      const unique = lodash.uniq(largeArray);
      const grouped = lodash.groupBy(unique, 'category');
      const cloned = lodash.cloneDeep(grouped);

      const perfResult = global.performanceMonitor.end(startTime);
      console.log(`大数据集处理耗时: ${perfResult.formatted}`);

      expect(unique.length).toBe(10); // 10个唯一ID (0-9)
      expect(largeArray.length).toBe(1000); // 原始数组长度
      expect(Object.keys(grouped)).toHaveLength(3); // 3个类别
      expect(cloned).toEqual(grouped);

      expect(perfResult.duration).toBeLessThan(50); // 50ms内完成
    });
  });

  describe('边界情况和错误处理', () => {
    it('应该处理null和undefined输入', () => {
      expect(() => lodash.uniq(null)).toThrow('Input must be an array');
      expect(() => lodash.uniq(undefined)).toThrow('Input must be an array');

      expect(() => lodash.groupBy(null, 'prop')).toThrow('Input must be an array');
      expect(() => lodash.groupBy(undefined, 'prop')).toThrow('Input must be an array');

      expect(lodash.cloneDeep(null)).toBe(null);
      expect(lodash.cloneDeep(undefined)).toBe(undefined);
    });

    it('应该处理无效的iteratee', () => {
      const data = [1, 2, 3];

      // 无效的iteratee应该使用默认行为
      expect(() => lodash.groupBy(data, null)).not.toThrow();
      expect(() => lodash.groupBy(data, undefined)).not.toThrow();
    });

    it('应该处理非可序列化的对象', () => {
      const objWithSymbol = { a: 1, [Symbol('test')]: 'symbol' };

      // Symbol会被忽略
      const cloned = lodash.cloneDeep(objWithSymbol);
      expect(cloned.a).toBe(1);
      expect(cloned[Symbol('test')]).toBeUndefined();
    });
  });

  describe('性能测试', () => {
    it('应该高效处理uniq操作', () => {
      const largeArray = Array.from({ length: 10000 }, () => Math.floor(Math.random() * 1000));

      const startTime = global.performanceMonitor.start();
      const result = lodash.uniq(largeArray);
      const perfResult = global.performanceMonitor.end(startTime);

      console.log(`uniq 10000元素耗时: ${perfResult.formatted}`);
      expect(result.length).toBeLessThanOrEqual(1000);
      expect(perfResult.duration).toBeLessThan(20); // 20ms内完成
    });

    it('应该高效处理groupBy操作', () => {
      const largeArray = Array.from({ length: 5000 }, (_, i) => ({
        id: i,
        category: `cat_${i % 10}`
      }));

      const startTime = global.performanceMonitor.start();
      const result = lodash.groupBy(largeArray, 'category');
      const perfResult = global.performanceMonitor.end(startTime);

      console.log(`groupBy 5000元素耗时: ${perfResult.formatted}`);
      expect(Object.keys(result)).toHaveLength(10);
      expect(perfResult.duration).toBeLessThan(30); // 30ms内完成
    });

    it('应该高效处理cloneDeep操作', () => {
      const largeObject = {
        data: Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          nested: {
            value: Math.random(),
            array: [1, 2, 3, 4, 5]
          }
        }))
      };

      const startTime = global.performanceMonitor.start();
      const result = lodash.cloneDeep(largeObject);
      const perfResult = global.performanceMonitor.end(startTime);

      console.log(`cloneDeep 复杂对象耗时: ${perfResult.formatted}`);
      expect(result).toEqual(largeObject);
      expect(result).not.toBe(largeObject);
      expect(perfResult.duration).toBeLessThan(50); // 50ms内完成
    });
  });
});
