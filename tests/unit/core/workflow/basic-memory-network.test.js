import {
  setupStrictTestEnvironment,
  createStrictTestCleanup,
  strictAssert,
  withTimeout,
  createDetailedErrorReporter
} from '../../../test-helpers.js';

/**
 * BasicMemoryNetwork 单元测试
 */

import { BasicMemoryNetwork } from '../../../../src/core/workflow/BasicMemoryNetwork.js';

describe('BasicMemoryNetwork', () => {
  let memory;

  beforeEach(() => {
    memory = new BasicMemoryNetwork({
      maxMemoryMB: 10,     // 小内存限制便于测试
      defaultTTL: 5000,    // 5秒默认TTL
      enableLogging: false // 测试时关闭日志
    });
  });

  afterEach(async () => {
    await memory.shutdown();
  });

  test('should store and retrieve values', async () => {
    const key = 'test-key';
    const value = { message: 'hello world', count: 42 };

    await memory.set(key, value);
    const retrieved = await memory.get(key);

    expect(retrieved).toEqual(value);
  });

  test('should handle different data types', async () => {
    const testData = [
      { key: 'string', value: 'hello' },
      { key: 'number', value: 12345 },
      { key: 'boolean', value: true },
      { key: 'array', value: [1, 2, 3, 'test'] },
      { key: 'object', value: { nested: { value: 'deep' } } },
      { key: 'null', value: null },
      { key: 'undefined', value: undefined }
    ];

    for (const { key, value } of testData) {
      await memory.set(key, value);
      const retrieved = await memory.get(key);
      expect(retrieved).toEqual(value);
    }
  });

  test('should handle namespaces', async () => {
    const key = 'shared-key';
    const value1 = 'value in namespace1';
    const value2 = 'value in namespace2';

    await memory.set(key, value1, { namespace: 'ns1' });
    await memory.set(key, value2, { namespace: 'ns2' });

    const retrieved1 = await memory.get(key, { namespace: 'ns1' });
    const retrieved2 = await memory.get(key, { namespace: 'ns2' });

    expect(retrieved1).toBe(value1);
    expect(retrieved2).toBe(value2);

    // 默认命名空间应该没有这个键
    const defaultValue = await memory.get(key);
    expect(defaultValue).toBeNull();
  });

  test('should handle TTL expiration', async () => {
    const key = 'expiring-key';
    const value = 'this will expire';

    await memory.set(key, value, { ttl: 100 }); // 100ms TTL

    // 立即获取应该成功
    let retrieved = await memory.get(key);
    expect(retrieved).toBe(value);

    // 等待过期
    await new Promise(resolve => setTimeout(resolve, 150));

    // 再次获取应该返回null
    retrieved = await memory.get(key);
    expect(retrieved).toBeNull();
  });

  test('should handle key deletion', async () => {
    const key = 'delete-test';
    const value = 'to be deleted';

    await memory.set(key, value);
    expect(await memory.exists(key)).toBe(true);

    const deleted = await memory.delete(key);
    expect(deleted).toBe(true);
    expect(await memory.exists(key)).toBe(false);

    // 再次删除应该返回false
    const deletedAgain = await memory.delete(key);
    expect(deletedAgain).toBe(false);
  });

  test('should handle key listing', async () => {
    const keys = ['key1', 'key2', 'key3', 'other-key'];
    const namespace = 'test-ns';

    // 存储一些键
    for (const key of keys) {
      await memory.set(key, `value-${key}`, { namespace });
    }

    // 获取所有键
    const allKeys = await memory.keys({ namespace });
    expect(allKeys).toHaveLength(keys.length);
    expect(allKeys.sort()).toEqual(keys.sort());

    // 使用模式匹配
    const filteredKeys = await memory.keys({
      namespace,
      pattern: 'key*'
    });
    expect(filteredKeys).toHaveLength(3);
    expect(filteredKeys).toContain('key1');
    expect(filteredKeys).toContain('key2');
    expect(filteredKeys).toContain('key3');
  });

  test('should handle getset operation', async () => {
    const key = 'getset-test';

    // 初始设置
    const oldValue = await memory.getset(key, 'new-value');
    expect(oldValue).toBeNull();

    // 修改值
    const oldValue2 = await memory.getset(key, 'even-newer-value');
    expect(oldValue2).toBe('new-value');

    // 验证最终值
    const finalValue = await memory.get(key);
    expect(finalValue).toBe('even-newer-value');
  });

  test('should handle expiration setting', async () => {
    const key = 'expire-test';
    const value = 'will expire';

    await memory.set(key, value); // 使用默认TTL

    // 设置新的过期时间
    const success = await memory.expire(key, 200); // 200ms
    expect(success).toBe(true);

    // 检查TTL
    const ttl = await memory.ttl(key);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(200);

    // 等待过期
    await new Promise(resolve => setTimeout(resolve, 250));

    // 检查是否过期
    const ttlAfter = await memory.ttl(key);
    expect(ttlAfter).toBe(-2); // 已过期
  });

  test('should handle memory limits', async () => {
    memory = new BasicMemoryNetwork({
      maxMemoryMB: 0.001, // 非常小的内存限制 ~1KB
      enableLogging: false
    });

    // 存储大对象
    const largeObject = {
      data: 'x'.repeat(1000), // ~1KB数据
      metadata: { large: 'x'.repeat(500) }
    };

    await memory.set('large-key', largeObject);

    // 再次存储，应该触发清理
    await memory.set('another-key', { data: 'small' });

    // 统计应该反映清理
    const stats = memory.getStats();
    expect(stats.totalKeys).toBeGreaterThanOrEqual(1);
  });

  test('should provide namespace statistics', async () => {
    const namespace = 'stats-test';

    await memory.set('key1', 'value1', { namespace });
    await memory.set('key2', 'value2', { namespace });
    await memory.set('key3', 'value3', { namespace, ttl: 100 }); // 会过期

    const stats = await memory.getNamespaceStats(namespace);

    expect(stats).not.toBeNull();
    expect(stats.name).toBe(namespace);
    expect(stats.keys).toBe(3);
    expect(stats.memoryUsage).toBeGreaterThan(0);
    expect(stats.oldestItem).toBeInstanceOf(Date);
    expect(stats.newestItem).toBeInstanceOf(Date);
  });

  test('should handle data export and import', async () => {
    const namespace = 'export-test';

    // 存储一些数据
    await memory.set('key1', 'value1', { namespace });
    await memory.set('key2', { complex: 'object' }, { namespace });
    await memory.set('key3', 'value3', { namespace, ttl: 100 });

    // 导出数据
    const exportedData = await memory.exportData({ namespace });

    expect(exportedData).toHaveProperty(namespace);
    expect(Object.keys(exportedData[namespace])).toHaveLength(3);

    // 创建新的记忆网络
    const newMemory = new BasicMemoryNetwork({ enableLogging: false });

    // 导入数据
    const importedCount = await newMemory.importData(exportedData);
    expect(importedCount).toBe(3);

    // 验证数据
    expect(await newMemory.get('key1', { namespace })).toBe('value1');
    expect(await newMemory.get('key2', { namespace })).toEqual({ complex: 'object' });

    await newMemory.shutdown();
  });

  test('should handle clear operations', async () => {
    const ns1 = 'namespace1';
    const ns2 = 'namespace2';

    // 存储数据到两个命名空间
    await memory.set('key1', 'value1', { namespace: ns1 });
    await memory.set('key2', 'value2', { namespace: ns1 });
    await memory.set('key3', 'value3', { namespace: ns2 });

    // 清空特定命名空间
    await memory.clear({ namespace: ns1 });

    expect(await memory.get('key1', { namespace: ns1 })).toBeNull();
    expect(await memory.get('key2', { namespace: ns1 })).toBeNull();
    expect(await memory.get('key3', { namespace: ns2 })).toBe('value3');

    // 清空所有
    await memory.clear();

    expect(await memory.get('key3', { namespace: ns2 })).toBeNull();

    const stats = memory.getStats();
    expect(stats.totalKeys).toBe(0);
    expect(stats.totalNamespaces).toBe(0);
  });

  test('should provide global statistics', () => {
    const stats = memory.getStats();

    expect(stats).toHaveProperty('totalKeys');
    expect(stats).toHaveProperty('totalNamespaces');
    expect(stats).toHaveProperty('memoryUsageMB');
    expect(stats).toHaveProperty('memoryLimitMB');
    expect(stats).toHaveProperty('hitRate');
    expect(stats).toHaveProperty('namespaces');
    expect(typeof stats.hitRate).toBe('number');
  });

  test('should handle pattern matching', async () => {
    const keys = ['user:123', 'user:456', 'post:789', 'comment:101'];
    const namespace = 'pattern-test';

    for (const key of keys) {
      await memory.set(key, `value-${key}`, { namespace });
    }

    // 测试不同模式
    const userKeys = await memory.keys({
      namespace,
      pattern: 'user:*'
    });
    expect(userKeys).toHaveLength(2);
    expect(userKeys).toContain('user:123');
    expect(userKeys).toContain('user:456');

    const allKeys = await memory.keys({
      namespace,
      pattern: '*'
    });
    expect(allKeys).toHaveLength(4);
  });

  test('should handle concurrent operations', async () => {
    const operations = [];
    const namespace = 'concurrent-test';

    // 创建多个并发操作
    for (let i = 0; i < 10; i++) {
      operations.push(memory.set(`key${i}`, `value${i}`, { namespace }));
    }

    // 等待所有操作完成
    await Promise.all(operations);

    // 验证所有键都存在
    for (let i = 0; i < 10; i++) {
      const value = await memory.get(`key${i}`, { namespace });
      expect(value).toBe(`value${i}`);
    }

    const keys = await memory.keys({ namespace });
    expect(keys).toHaveLength(10);
  });

  test('should handle edge cases', async () => {
    // 测试空值
    await memory.set('empty-string', '');
    await memory.set('empty-object', {});
    await memory.set('empty-array', []);

    expect(await memory.get('empty-string')).toBe('');
    expect(await memory.get('empty-object')).toEqual({});
    expect(await memory.get('empty-array')).toEqual([]);

    // 测试特殊字符键
    const specialKey = 'key:with:colons.and.dots';
    await memory.set(specialKey, 'special-value');
    expect(await memory.get(specialKey)).toBe('special-value');

    // 测试大整数
    await memory.set('big-number', Number.MAX_SAFE_INTEGER);
    expect(await memory.get('big-number')).toBe(Number.MAX_SAFE_INTEGER);
  });
});
