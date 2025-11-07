/**
 * WokeFlow 测试环境设置
 * 全局测试配置和辅助函数
 */

import { beforeAll, afterAll, beforeEach } from 'vitest';

// 设置全局测试超时
beforeAll(() => {
  console.log('🚀 WokeFlow 测试环境初始化...\n');
});

// 清理测试环境
afterAll(() => {
  console.log('\n✨ WokeFlow 测试环境清理完成');
});

// 每个测试前的设置
beforeEach(() => {
  // 重置全局状态 - vitest没有clearAllMocks方法，移除此调用
  // vi.clearAllMocks();
});

// 性能监控辅助函数
global.performanceMonitor = {
  start: () => performance.now(),
  end: (startTime) => {
    const duration = performance.now() - startTime;
    return {
      duration,
      formatted: `${duration.toFixed(2)}ms`
    };
  }
};

// 内存使用监控
global.memoryMonitor = {
  getUsage: () => {
    const usage = process.memoryUsage();
    return {
      rss: `${(usage.rss / 1024 / 1024).toFixed(2)}MB`,
      heapUsed: `${(usage.heapUsed / 1024 / 1024).toFixed(2)}MB`,
      heapTotal: `${(usage.heapTotal / 1024 / 1024).toFixed(2)}MB`,
      external: `${(usage.external / 1024 / 1024).toFixed(2)}MB`
    };
  }
};

// 测试数据生成器
global.testDataGenerator = {
  uuid: () => `test-uuid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,

  workflow: () => ({
    id: global.testDataGenerator.uuid(),
    name: `Test Workflow ${Date.now()}`,
    description: 'Generated test workflow',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date()
  }),

  user: () => ({
    id: global.testDataGenerator.uuid(),
    username: `user_${Date.now()}`,
    email: `user_${Date.now()}@test.com`,
    role: 'developer',
    createdAt: new Date()
  }),

  config: () => ({
    database: {
      host: 'localhost',
      port: 5432,
      database: 'test_db'
    },
    cache: {
      host: 'localhost',
      port: 6379
    },
    logging: {
      level: 'info',
      format: 'json'
    }
  })
};

// 异步操作辅助函数
global.asyncHelpers = {
  sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  waitFor: async (condition, timeout = 5000, interval = 100) => {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      if (condition()) {
        return true;
      }
      await global.asyncHelpers.sleep(interval);
    }

    throw new Error(`Condition not met within ${timeout}ms`);
  },

  retry: async (fn, maxAttempts = 3, delay = 1000) => {
    let lastError;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (attempt < maxAttempts) {
          console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
          await global.asyncHelpers.sleep(delay);
        }
      }
    }

    throw lastError;
  }
};

// 断言辅助函数
global.assertionHelpers = {
  isValidUUID: (str) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  },

  isValidEmail: (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  isValidDate: (date) => {
    return date instanceof Date && !isNaN(date.getTime());
  },

  deepEqual: (obj1, obj2) => {
    return JSON.stringify(obj1) === JSON.stringify(obj2);
  }
};

// 模拟服务器辅助函数
global.mockServer = {
  create: (port = 3001) => {
    // 简化的模拟服务器实现
    return {
      port,
      running: false,
      routes: new Map(),

      addRoute: (method, path, handler) => {
        const key = `${method}:${path}`;
        global.mockServer.routes.set(key, handler);
      },

      start: async () => {
        global.mockServer.running = true;
        console.log(`🔧 模拟服务器启动在端口 ${port}`);
        return global.mockServer;
      },

      stop: async () => {
        global.mockServer.running = false;
        console.log(`🛑 模拟服务器停止`);
      }
    };
  }
};

// 数据库测试辅助函数
global.databaseHelpers = {
  setupTestDB: async () => {
    // 创建内存数据库用于测试
    const db = {
      tables: new Map(),
      transactions: [],

      createTable: async (name, schema) => {
        db.tables.set(name, {
          name,
          schema,
          records: [],
          indexes: new Map()
        });
      },

      insert: async (tableName, record) => {
        const table = db.tables.get(tableName);
        if (!table) throw new Error(`Table ${tableName} not found`);

        const recordWithId = {
          id: Date.now() + Math.random(),
          ...record,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        table.records.push(recordWithId);
        return recordWithId;
      },

      find: async (tableName, query = {}) => {
        const table = db.tables.get(tableName);
        if (!table) throw new Error(`Table ${tableName} not found`);

        return table.records.filter(record => {
          for (const [key, value] of Object.entries(query)) {
            if (record[key] !== value) return false;
          }
          return true;
        });
      },

      cleanup: async () => {
        db.tables.clear();
        db.transactions = [];
      }
    };

    return db;
  }
};

// 导出全局变量供测试使用
global.testUtils = {
  performanceMonitor: global.performanceMonitor,
  memoryMonitor: global.memoryMonitor,
  testDataGenerator: global.testDataGenerator,
  asyncHelpers: global.asyncHelpers,
  assertionHelpers: global.assertionHelpers,
  mockServer: global.mockServer,
  databaseHelpers: global.databaseHelpers
};
