/**
 * 测试隔离设置
 * 确保测试间的完全隔离，防止状态污染
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// 测试隔离配置
const ISOLATION_CONFIG = {
  // 清理临时文件
  cleanupTempFiles: true,
  // 重置环境变量
  resetEnvironment: true,
  // 清理数据库状态
  cleanupDatabase: process.env.NODE_ENV === 'test',
  // 清理缓存
  cleanupCache: true,
  // 重置单例实例
  resetSingletons: true,
  // 清理定时器
  cleanupTimers: true,
  // 清理事件监听器
  cleanupEventListeners: true,
};

// 全局测试状态
const globalTestState = {
  tempFiles: new Set(),
  timers: new Set(),
  eventListeners: new Map(),
  environmentBackup: {},
  singletons: new Map(),
};

// 测试隔离管理器
class TestIsolationManager {
  static backupEnvironment() {
    // 备份原始环境变量
    globalTestState.environmentBackup = { ...process.env };
  }

  static resetEnvironment() {
    if (!ISOLATION_CONFIG.resetEnvironment) return;

    // 重置环境变量
    Object.keys(process.env).forEach((key) => {
      if (!(key in globalTestState.environmentBackup)) {
        delete process.env[key];
      } else {
        process.env[key] = globalTestState.environmentBackup[key];
      }
    });
  }

  static cleanupTempFiles() {
    if (!ISOLATION_CONFIG.cleanupTempFiles) return;

    // 清理测试期间创建的临时文件
    globalTestState.tempFiles.forEach((filePath) => {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (error) {
        console.warn(`无法清理临时文件: ${filePath}`, error.message);
      }
    });
    globalTestState.tempFiles.clear();
  }

  static cleanupTimers() {
    if (!ISOLATION_CONFIG.cleanupTimers) return;

    // 清理未清理的定时器
    globalTestState.timers.forEach((timerId) => {
      try {
        clearTimeout(timerId);
        clearInterval(timerId);
      } catch (error) {
        // 定时器可能已经被清理
      }
    });
    globalTestState.timers.clear();
  }

  static resetSingletons() {
    if (!ISOLATION_CONFIG.resetSingletons) return;

    // 重置单例实例
    globalTestState.singletons.forEach((resetFn, name) => {
      try {
        resetFn();
      } catch (error) {
        console.warn(`无法重置单例实例: ${name}`, error.message);
      }
    });
  }

  static cleanupCache() {
    if (!ISOLATION_CONFIG.cleanupCache) return;

    // 清理Node.js模块缓存
    Object.keys(require.cache).forEach((key) => {
      if (key.includes('test') || key.includes('spec')) {
        delete require.cache[key];
      }
    });

    // 清理测试相关的缓存目录
    const cacheDirs = [
      path.join(rootDir, 'test-results', 'cache'),
      path.join(rootDir, 'coverage', 'cache'),
    ];

    cacheDirs.forEach((dir) => {
      try {
        if (fs.existsSync(dir)) {
          fs.rmSync(dir, { recursive: true, force: true });
        }
      } catch (error) {
        console.warn(`无法清理缓存目录: ${dir}`, error.message);
      }
    });
  }

  static async cleanupDatabase() {
    if (!ISOLATION_CONFIG.cleanupDatabase) return;

    // 这里可以添加数据库清理逻辑
    // 例如重置Redis、清理测试数据库等

    try {
      // 如果有Redis连接，进行清理
      if (global.redisClient) {
        await global.redisClient.flushdb();
      }

      // 如果有数据库连接，进行清理
      if (global.dbConnection) {
        // 执行清理SQL或重置操作
        await global.dbConnection.query('TRUNCATE TABLE test_data');
      }
    } catch (error) {
      console.warn('数据库清理失败:', error.message);
    }
  }

  static trackTempFile(filePath) {
    globalTestState.tempFiles.add(filePath);
  }

  static trackTimer(timerId) {
    globalTestState.timers.add(timerId);
  }

  static registerSingleton(name, resetFn) {
    globalTestState.singletons.set(name, resetFn);
  }

  static async isolate() {
    // 执行完整的隔离清理
    await TestIsolationManager.cleanupDatabase();
    TestIsolationManager.cleanupTempFiles();
    TestIsolationManager.cleanupTimers();
    TestIsolationManager.resetEnvironment();
    TestIsolationManager.resetSingletons();
    TestIsolationManager.cleanupCache();

    // 强制垃圾回收（如果可用）
    if (global.gc) {
      global.gc();
    }
  }
}

// 全局测试钩子
beforeAll(async () => {
  console.log('🔒 设置测试隔离环境...');

  // 备份环境状态
  TestIsolationManager.backupEnvironment();

  // 设置测试专用的环境变量
  process.env.NODE_ENV = 'test';
  process.env.TEST_MODE = 'true';

  console.log('✅ 测试隔离环境设置完成');
});

afterAll(async () => {
  console.log('🧹 清理测试隔离环境...');

  // 执行完整的隔离清理
  await TestIsolationManager.isolate();

  console.log('✅ 测试隔离环境清理完成');
});

beforeEach(async (context) => {
  // 为每个测试创建独立的上下文
  context.testIsolation = {
    tempFiles: new Set(),
    mocks: new Map(),
    spies: new Set(),
  };

  // 设置测试超时
  context.testTimeout = 10000;

  // 重置随机种子（如果需要）
  Math.random = context.testIsolation.originalRandom || Math.random;
});

afterEach(async (context) => {
  // 清理每个测试的状态
  const isolation = context.testIsolation;

  if (isolation) {
    // 清理临时文件
    isolation.tempFiles.forEach((filePath) => {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (error) {
        console.warn(`测试清理失败: ${filePath}`, error.message);
      }
    });

    // 恢复mocks
    isolation.mocks.forEach((original, target) => {
      if (typeof target.restore === 'function') {
        target.restore();
      }
    });

    // 清理spies
    isolation.spies.forEach((spy) => {
      if (typeof spy.restore === 'function') {
        spy.restore();
      }
    });
  }

  // 执行轻量级隔离
  TestIsolationManager.cleanupTimers();
});

// 导出工具函数供测试使用
export const testUtils = {
  // 创建临时文件（会自动清理）
  createTempFile: (content = '', extension = 'tmp') => {
    const tempDir = path.join(rootDir, 'test-results', 'temp');
    fs.mkdirSync(tempDir, { recursive: true });

    const fileName = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${extension}`;
    const filePath = path.join(tempDir, fileName);

    fs.writeFileSync(filePath, content);
    TestIsolationManager.trackTempFile(filePath);

    return filePath;
  },

  // 跟踪定时器（会自动清理）
  trackTimer: (timerId) => {
    TestIsolationManager.trackTimer(timerId);
    return timerId;
  },

  // 注册单例重置函数
  registerSingleton: (name, resetFn) => {
    TestIsolationManager.registerSingleton(name, resetFn);
  },

  // 执行隔离操作
  isolate: () => TestIsolationManager.isolate(),

  // 获取测试状态
  getTestState: () => ({ ...globalTestState }),
};

// 导出隔离管理器
export { TestIsolationManager };
