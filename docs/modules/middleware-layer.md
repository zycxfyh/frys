# frys 中间件层

## 📖 模块概述

frys 的中间件层提供了请求处理管道中的关键功能，包括输入验证、性能监控、缓存处理等。通过中间件模式，实现横切关注点的解耦和可复用性。该层确保了请求的安全性、性能和可靠性。

### 🎯 核心特性

- **输入验证** - 全面的请求数据验证和安全防护
- **性能监控** - 请求性能追踪和瓶颈分析
- **缓存处理** - HTTP响应的智能缓存策略
- **错误处理** - 统一的错误捕获和响应格式化
- **请求日志** - 结构化请求日志记录

### 🏗️ 中间件架构

```
中间件层
├── 🔍 输入验证中间件 (Input Validation)
│   ├── 请求体验证
│   ├── 查询参数验证
│   ├── 路径参数验证
│   └── 文件上传验证
├── 📊 性能监控中间件 (Performance Monitoring)
│   ├── 响应时间追踪
│   ├── 内存使用监控
│   ├── 请求量统计
│   └── 性能瓶颈检测
└── 💾 缓存中间件 (Cache Middleware)
    ├── HTTP缓存头处理
    ├── 条件缓存支持
    ├── 缓存失效策略
    └── 缓存性能监控
```

## 🔍 输入验证中间件 (Input Validation)

### 功能特性

- **多层验证** - 请求体、查询参数、路径参数、文件上传的全面验证
- **安全防护** - SQL注入、XSS、路径遍历等安全威胁防护
- **数据清理** - 自动输入数据清理和规范化
- **自定义验证** - 支持业务特定的验证规则
- **错误处理** - 结构化的验证错误响应

### 快速开始

```javascript
import { InputValidationMiddleware } from 'frys-middleware';

const validationMiddleware = new InputValidationMiddleware({
  failOnSecurityViolation: true, // 安全违规时失败
  sanitizeInput: true, // 清理输入数据
  logViolations: true, // 记录违规行为
});

// Express应用使用
app.use(validationMiddleware.middleware());

// 或者直接使用验证方法
const result = await validationMiddleware.validateRequestBody(
  req.body,
  req.path,
);
if (!result.valid) {
  return res.status(400).json({ errors: result.errors });
}
```

### 验证模式配置

```javascript
// 预定义验证模式
const validationSchemas = {
  // 用户输入验证
  user_input: {
    type: 'object',
    properties: {
      username: {
        type: 'string',
        required: true,
        minLength: 3,
        maxLength: 50,
        pattern: /^[a-zA-Z0-9_-]+$/,
      },
      email: {
        type: 'string',
        required: true,
        maxLength: 254,
        custom: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
      },
      password: {
        type: 'string',
        required: true,
        minLength: 8,
        maxLength: 128,
      },
    },
  },

  // API请求验证
  api_request: {
    type: 'object',
    properties: {
      endpoint: {
        type: 'string',
        maxLength: 2048,
        custom: (value) => {
          try {
            new URL(value);
            return true;
          } catch {
            return false;
          }
        },
      },
      method: {
        type: 'string',
        enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'],
      },
      headers: {
        type: 'object',
        maxProperties: 50,
      },
      body: {
        type: 'object',
        maxProperties: 100,
      },
    },
  },

  // 文件上传验证
  file_upload: {
    type: 'object',
    properties: {
      filename: {
        type: 'string',
        required: true,
        maxLength: 255,
        pattern: /^[^\/\\<>:*?"|]+\.[a-zA-Z0-9]+$/,
      },
      mimetype: {
        type: 'string',
        required: true,
        enum: [
          'image/jpeg',
          'image/png',
          'image/gif',
          'image/webp',
          'application/pdf',
          'text/plain',
          'application/json',
        ],
      },
      size: {
        type: 'number',
        required: true,
        max: 10 * 1024 * 1024, // 10MB
      },
    },
  },
};
```

### 安全验证规则

```javascript
// SQL注入防护
const sqlInjectionRules = {
  // 检查危险模式
  dangerousPatterns: [
    /(\bunion\b.*\bselect\b)/i, // UNION SELECT
    /(\bexec\b.*\bsp_)/i, // EXEC sp_
    /(\bexec\b.*\bxp_)/i, // EXEC xp_
    /(--|#|\/\*|\*\/)/, // SQL注释
    /;\s*(drop|alter|create|truncate|delete|update|insert)/i,
  ],

  // 检查特殊字符
  containsSqlInjection: (value) => {
    if (typeof value !== 'string') return false;

    // 检查十六进制编码
    if (/0x[0-9a-f]+/i.test(value)) return true;

    // 检查多个单引号
    if ((value.match(/'/g) || []).length > 2) return true;

    // 检查NULL字节
    if (value.includes('\x00')) return true;

    // 检查危险模式
    return dangerousPatterns.some((pattern) => pattern.test(value));
  },
};

// XSS防护
const xssProtectionRules = {
  // 危险HTML标签
  dangerousTags: ['script', 'iframe', 'object', 'embed'],

  // 检查XSS内容
  containsXss: (value) => {
    if (typeof value !== 'string') return false;

    const lowerValue = value.toLowerCase();

    // 检查危险标签
    if (dangerousTags.some((tag) => lowerValue.includes(`<${tag}`))) {
      return true;
    }

    // 检查javascript伪协议
    if (lowerValue.includes('javascript:')) {
      return true;
    }

    // 检查事件处理器
    if (/\son\w+\s*=/.test(lowerValue)) {
      return true;
    }

    return false;
  },
};

// 路径遍历防护
const pathTraversalRules = {
  // 检查路径遍历
  containsPathTraversal: (value) => {
    if (typeof value !== 'string') return false;

    // 规范化路径
    const normalizedPath = value.replace(/\\/g, '/').replace(/\/+/g, '/');

    // 检查..序列
    if (normalizedPath.includes('../') || normalizedPath.includes('..\\')) {
      return true;
    }

    // 检查绝对路径
    if (normalizedPath.startsWith('/') || /^[a-zA-Z]:/.test(normalizedPath)) {
      return true;
    }

    // 检查编码的遍历
    if (/%2e%2e/i.test(value) || /%2e%5c/i.test(value)) {
      return true;
    }

    return false;
  },
};
```

### 中间件集成

```javascript
// Express应用集成
const express = require('express');
const app = express();

const validationMiddleware = new InputValidationMiddleware();

// JSON解析中间件
app.use(express.json({ limit: '10mb' }));

// 输入验证中间件
app.use(validationMiddleware.middleware());

// 路由定义
app.post('/api/users', (req, res) => {
  // 请求数据已验证并清理
  const { username, email, password } = req.body;

  // 业务逻辑...
});

// 文件上传路由
const multer = require('multer');
const upload = multer();

app.post('/api/upload', upload.single('file'), (req, res) => {
  // 文件已通过验证中间件验证
  const file = req.file;

  // 业务逻辑...
});
```

## 📊 性能监控中间件 (Performance Monitoring)

### 功能特性

- **响应时间追踪** - 精确的请求处理时间测量
- **内存使用监控** - 堆内存和外部内存监控
- **CPU使用统计** - 请求处理时的CPU消耗
- **并发请求监控** - 活跃请求数量追踪
- **性能阈值告警** - 自动性能异常检测

### 快速开始

```javascript
import { PerformanceMonitoringMiddleware } from 'frys-middleware';

const performanceMiddleware = new PerformanceMonitoringMiddleware({
  enabled: true,
  slowRequestThreshold: 1000, // 慢请求阈值(ms)
  memoryThreshold: 100 * 1024 * 1024, // 内存阈值(100MB)
  logSlowRequests: true,
  alertOnThreshold: true,
});

// Express应用使用
app.use(performanceMiddleware.middleware());

// 获取性能统计
const stats = performanceMiddleware.getStats();
console.log('平均响应时间:', stats.averageResponseTime);
console.log('慢请求数量:', stats.slowRequests);
console.log('内存峰值:', stats.peakMemoryUsage);
```

### 性能指标收集

```javascript
// 性能指标定义
const performanceMetrics = {
  // 响应时间指标
  responseTime: {
    histogram: true, // 直方图统计
    percentiles: [50, 95, 99], // 百分位数
    buckets: [100, 500, 1000, 2000, 5000], // 时间桶
  },

  // 内存使用指标
  memoryUsage: {
    gauge: true, // 计量器
    trackPeak: true, // 追踪峰值
    trackAverage: true, // 追踪平均值
  },

  // CPU使用指标
  cpuUsage: {
    gauge: true,
    perRequest: true, // 按请求统计
  },

  // 请求量指标
  requestCount: {
    counter: true, // 计数器
    byMethod: true, // 按HTTP方法统计
    byStatus: true, // 按状态码统计
    byEndpoint: true, // 按端点统计
  },

  // 并发指标
  concurrentRequests: {
    gauge: true,
    trackMax: true, // 追踪最大并发数
  },
};
```

### 性能监控实现

```javascript
class PerformanceMonitoringMiddleware {
  constructor(options = {}) {
    this.options = {
      enabled: true,
      slowRequestThreshold: 1000,
      memoryThreshold: 100 * 1024 * 1024,
      logSlowRequests: true,
      alertOnThreshold: true,
      ...options,
    };

    this.stats = {
      totalRequests: 0,
      totalResponseTime: 0,
      slowRequests: 0,
      peakMemoryUsage: 0,
      maxConcurrentRequests: 0,
      requestCountByMethod: new Map(),
      requestCountByStatus: new Map(),
      responseTimeHistogram: new Map(),
    };

    this.activeRequests = 0;
  }

  middleware() {
    return (req, res, next) => {
      if (!this.options.enabled) {
        return next();
      }

      const startTime = process.hrtime.bigint();
      const startMemory = process.memoryUsage();
      this.activeRequests++;

      // 记录最大并发数
      if (this.activeRequests > this.stats.maxConcurrentRequests) {
        this.stats.maxConcurrentRequests = this.activeRequests;
      }

      // 响应完成处理
      const originalEnd = res.end;
      res.end = (...args) => {
        const endTime = process.hrtime.bigint();
        const endMemory = process.memoryUsage();

        // 计算响应时间（纳秒转毫秒）
        const responseTimeMs = Number(endTime - startTime) / 1_000_000;

        // 计算内存使用变化
        const memoryDelta = endMemory.heapUsed - startMemory.heapUsed;

        // 更新统计
        this.updateStats(req, res, responseTimeMs, memoryDelta);

        // 慢请求检测
        if (responseTimeMs > this.options.slowRequestThreshold) {
          this.handleSlowRequest(req, res, responseTimeMs);
        }

        // 内存使用告警
        if (endMemory.heapUsed > this.options.memoryThreshold) {
          this.handleMemoryAlert(endMemory.heapUsed);
        }

        this.activeRequests--;
        originalEnd.apply(res, args);
      };

      next();
    };
  }

  updateStats(req, res, responseTime, memoryDelta) {
    this.stats.totalRequests++;
    this.stats.totalResponseTime += responseTime;

    // 按方法统计
    const method = req.method;
    this.stats.requestCountByMethod.set(
      method,
      (this.stats.requestCountByMethod.get(method) || 0) + 1,
    );

    // 按状态码统计
    const status = res.statusCode;
    this.stats.requestCountByStatus.set(
      status,
      (this.stats.requestCountByStatus.get(status) || 0) + 1,
    );

    // 响应时间直方图
    const bucket = this.getHistogramBucket(responseTime);
    this.stats.responseTimeHistogram.set(
      bucket,
      (this.stats.responseTimeHistogram.get(bucket) || 0) + 1,
    );

    // 内存峰值
    const currentMemory = process.memoryUsage().heapUsed;
    if (currentMemory > this.stats.peakMemoryUsage) {
      this.stats.peakMemoryUsage = currentMemory;
    }
  }

  getHistogramBucket(value) {
    const buckets = [100, 500, 1000, 2000, 5000, 10000];
    for (const bucket of buckets) {
      if (value <= bucket) return bucket;
    }
    return '10000+';
  }

  handleSlowRequest(req, res, responseTime) {
    this.stats.slowRequests++;

    if (this.options.logSlowRequests) {
      console.warn(
        `🐌 慢请求检测: ${req.method} ${req.path} - ${responseTime.toFixed(2)}ms`,
      );
    }

    if (this.options.alertOnThreshold) {
      // 发送告警通知
      this.sendAlert('slow_request', {
        method: req.method,
        path: req.path,
        responseTime,
        timestamp: new Date(),
      });
    }
  }

  handleMemoryAlert(memoryUsage) {
    if (this.options.alertOnThreshold) {
      console.error(
        `🚨 内存使用告警: ${(memoryUsage / 1024 / 1024).toFixed(2)}MB`,
      );

      this.sendAlert('memory_alert', {
        memoryUsage,
        timestamp: new Date(),
      });
    }
  }

  sendAlert(type, data) {
    // 这里可以集成告警系统，如Slack、邮件等
    console.log(`告警: ${type}`, data);
  }

  getStats() {
    return {
      ...this.stats,
      averageResponseTime:
        this.stats.totalRequests > 0
          ? this.stats.totalResponseTime / this.stats.totalRequests
          : 0,
      activeRequests: this.activeRequests,
    };
  }

  resetStats() {
    // 重置统计数据
    Object.keys(this.stats).forEach((key) => {
      if (typeof this.stats[key] === 'number') {
        this.stats[key] = 0;
      } else if (this.stats[key] instanceof Map) {
        this.stats[key].clear();
      }
    });
  }
}
```

## 💾 缓存中间件 (Cache Middleware)

### 功能特性

- **HTTP缓存支持** - ETag、Last-Modified、Cache-Control头处理
- **条件请求** - If-None-Match、If-Modified-Since支持
- **智能缓存键** - 基于请求特征的缓存键生成
- **缓存失效策略** - 手动和自动缓存清理
- **缓存性能监控** - 缓存命中率和性能统计

### 快速开始

```javascript
import { CacheMiddleware } from 'frys-middleware';

const cacheMiddleware = new CacheMiddleware({
  cache: redisCache, // 缓存后端
  defaultTTL: 300, // 默认缓存时间(秒)
  cacheableMethods: ['GET', 'HEAD'],
  cacheableStatusCodes: [200, 203, 204, 206, 300, 301, 404, 405, 410, 414],

  // 缓存键生成
  keyGenerator: (req) => {
    return `${req.method}:${req.originalUrl}:${JSON.stringify(req.query)}`;
  },

  // 条件缓存
  conditionalCache: {
    enabled: true,
    etag: true,
    lastModified: true,
  },

  // 缓存控制
  cacheControl: {
    public: true,
    'max-age': 300,
    's-maxage': 600,
  },
});

// Express应用使用
app.use(cacheMiddleware.middleware());

// 路由级缓存配置
app.get(
  '/api/users/:id',
  cacheMiddleware.cache({
    ttl: 600, // 10分钟
    key: (req) => `user:${req.params.id}`,
    condition: (req) => !req.query.force, // 除非强制刷新
  }),
  (req, res) => {
    // 业务逻辑...
  },
);

// 缓存失效
app.post('/api/users', (req, res) => {
  // 创建用户...

  // 清除相关缓存
  cacheMiddleware.invalidate('users:list');
  cacheMiddleware.invalidate(`user:${user.id}`);
});
```

### 缓存策略配置

```javascript
// 缓存策略配置
const cacheStrategies = {
  // 静态资源缓存
  static: {
    ttl: 86400, // 24小时
    cacheControl: {
      public: true,
      'max-age': 86400,
      immutable: true,
    },
    vary: ['Accept-Encoding'],
  },

  // API响应缓存
  api: {
    ttl: 300, // 5分钟
    cacheControl: {
      private: true,
      'max-age': 300,
      's-maxage': 600,
    },
    vary: ['Authorization'],
  },

  // 用户数据缓存
  user: {
    ttl: 1800, // 30分钟
    cacheControl: {
      private: true,
      'max-age': 1800,
      'no-cache': true,
    },
    keyGenerator: (req) => `user:${req.user?.id}:${req.originalUrl}`,
  },

  // 公共数据缓存
  public: {
    ttl: 3600, // 1小时
    cacheControl: {
      public: true,
      'max-age': 3600,
      's-maxage': 7200,
    },
  },
};
```

### 缓存键生成策略

```javascript
// 缓存键生成策略
const cacheKeyStrategies = {
  // 标准REST API键
  restApi: (req) => {
    const parts = [
      req.method,
      req.originalUrl,
      JSON.stringify(req.query),
      req.user?.id || 'anonymous',
    ];
    return parts.join(':');
  },

  // GraphQL查询键
  graphql: (req) => {
    const query = req.body.query;
    const variables = JSON.stringify(req.body.variables || {});
    const operation = req.body.operationName || 'anonymous';

    return `graphql:${operation}:${hash(query)}:${hash(variables)}`;
  },

  // 文件缓存键
  file: (req) => {
    const path = req.path;
    const etag = req.headers['if-none-match'];
    const modified = req.headers['if-modified-since'];

    return `file:${path}:${etag || ''}:${modified || ''}`;
  },

  // 数据库查询键
  database: (req) => {
    const table = req.params.table;
    const filters = JSON.stringify(req.query);
    const userId = req.user?.id;

    return `db:${table}:${userId}:${hash(filters)}`;
  },
};

// 哈希函数用于生成稳定的缓存键
function hash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // 转换为32位整数
  }
  return hash.toString(36);
}
```

## 🔧 依赖注入配置

### 中间件服务注册

```javascript
import { container } from 'frys';

// 注册输入验证中间件
container.register(
  'inputValidationMiddleware',
  (c) =>
    new InputValidationMiddleware({
      validator: c.resolve('zodValidator'),
      failOnSecurityViolation: true,
      sanitizeInput: true,
      logViolations: true,
    }),
);

// 注册性能监控中间件
container.register(
  'performanceMonitoringMiddleware',
  (c) =>
    new PerformanceMonitoringMiddleware({
      enabled: true,
      slowRequestThreshold: 1000,
      memoryThreshold: 100 * 1024 * 1024,
      logSlowRequests: true,
      alertOnThreshold: true,
    }),
);

// 注册缓存中间件
container.register(
  'cacheMiddleware',
  (c) =>
    new CacheMiddleware({
      cache: c.resolve('cacheManager'),
      defaultTTL: 300,
      conditionalCache: {
        enabled: true,
        etag: true,
        lastModified: true,
      },
    }),
);
```

## 📊 监控和指标

### 中间件性能指标

```javascript
// 输入验证指标
const validationMetrics = {
  totalValidations: await validationMiddleware.getStats().totalValidations,
  failedValidations: await validationMiddleware.getStats().failedValidations,
  securityViolations: await validationMiddleware.getStats().securityViolations,
  averageValidationTime:
    await validationMiddleware.getStats().averageValidationTime,
};

// 性能监控指标
const performanceMetrics = {
  totalRequests: performanceMiddleware.getStats().totalRequests,
  averageResponseTime: performanceMiddleware.getStats().averageResponseTime,
  slowRequests: performanceMiddleware.getStats().slowRequests,
  peakMemoryUsage: performanceMiddleware.getStats().peakMemoryUsage,
  maxConcurrentRequests: performanceMiddleware.getStats().maxConcurrentRequests,
};

// 缓存指标
const cacheMetrics = {
  cacheHits: await cacheMiddleware.getStats().hits,
  cacheMisses: await cacheMiddleware.getStats().misses,
  cacheHitRate: await cacheMiddleware.getStats().hitRate,
  cacheInvalidations: await cacheMiddleware.getStats().invalidations,
};
```

## 🧪 测试策略

### 中间件单元测试

```javascript
import { describe, it, expect, vi } from 'vitest';
import { InputValidationMiddleware } from '../middleware/input-validation.middleware.js';

describe('InputValidationMiddleware', () => {
  let middleware;
  let mockValidator;

  beforeEach(() => {
    mockValidator = {
      schema: vi.fn(),
      validate: vi.fn(),
      getStats: vi.fn(() => ({
        totalValidations: 10,
        failedValidations: 2,
        securityViolations: 1,
      })),
    };

    middleware = new InputValidationMiddleware();
    middleware.validator = mockValidator;
  });

  it('should validate request body successfully', async () => {
    const mockReq = {
      body: { username: 'john_doe', email: 'john@example.com' },
      path: '/api/users',
    };

    mockValidator.validate.mockResolvedValue({
      success: true,
      data: mockReq.body,
      errors: [],
    });

    const result = await middleware.validateRequestBody(
      mockReq.body,
      mockReq.path,
    );

    expect(result.valid).toBe(true);
    expect(result.data).toEqual(mockReq.body);
    expect(result.errors).toHaveLength(0);
  });

  it('should detect SQL injection attempts', () => {
    const maliciousInput = "'; DROP TABLE users; --";

    expect(middleware.containsSqlInjection(maliciousInput)).toBe(true);
  });

  it('should detect path traversal attempts', () => {
    const maliciousPath = '../../../etc/passwd';

    expect(middleware.containsPathTraversal(maliciousPath)).toBe(true);
  });
});
```

### 集成测试

```javascript
describe('Middleware Integration', () => {
  let app;
  let validationMiddleware;
  let performanceMiddleware;

  beforeEach(() => {
    app = express();
    validationMiddleware = new InputValidationMiddleware();
    performanceMiddleware = new PerformanceMonitoringMiddleware();

    app.use(express.json());
    app.use(validationMiddleware.middleware());
    app.use(performanceMiddleware.middleware());

    app.post('/api/test', (req, res) => {
      res.json({ success: true, data: req.body });
    });
  });

  it('should validate and monitor requests end-to-end', async () => {
    const testData = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'TestPass123',
    };

    const response = await request(app)
      .post('/api/test')
      .send(testData)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual(testData);

    // 检查性能统计
    const stats = performanceMiddleware.getStats();
    expect(stats.totalRequests).toBeGreaterThan(0);
    expect(stats.averageResponseTime).toBeGreaterThan(0);
  });

  it('should reject invalid input', async () => {
    const invalidData = {
      username: 'ab', // 太短
      email: 'invalid-email', // 无效邮箱
    };

    await request(app).post('/api/test').send(invalidData).expect(400);
  });
});
```

## ❓ 常见问题

### Q: 如何自定义验证规则？

**A:** 通过扩展验证器或添加自定义验证函数：

```javascript
// 扩展验证器
class CustomValidationMiddleware extends InputValidationMiddleware {
  initializeSchemas() {
    super.initializeSchemas();

    // 添加自定义模式
    this.validator.schema('custom_user', {
      type: 'object',
      properties: {
        companyId: {
          type: 'string',
          required: true,
          custom: this.validateCompanyId.bind(this),
        },
        department: {
          type: 'string',
          enum: ['engineering', 'sales', 'marketing', 'hr'],
        },
      },
    });
  }

  async validateCompanyId(companyId) {
    // 自定义验证逻辑
    const company = await this.companyRepository.findById(companyId);
    return !!company && company.isActive;
  }
}
```

### Q: 性能监控会影响应用性能吗？

**A:** 性能监控对应用性能的影响很小，但可以进一步优化：

```javascript
// 条件监控 - 只在需要时启用
const conditionalMonitoring = (req, res, next) => {
  // 只对API请求启用监控
  if (req.path.startsWith('/api/')) {
    return performanceMiddleware.middleware()(req, res, next);
  }
  next();
};

// 采样监控 - 降低监控频率
const sampledMonitoring = (req, res, next) => {
  // 10%采样率
  if (Math.random() < 0.1) {
    return performanceMiddleware.middleware()(req, res, next);
  }
  next();
};

// 异步监控 - 不阻塞请求处理
const asyncMonitoring = (req, res, next) => {
  const originalEnd = res.end;
  res.end = (...args) => {
    originalEnd.apply(res, args);

    // 异步收集性能指标
    setImmediate(() => {
      performanceMiddleware.collectMetrics(req, res);
    });
  };

  next();
};
```

### Q: 如何处理缓存一致性？

**A:** 实现缓存一致性策略：

```javascript
// 缓存一致性策略
class CacheConsistencyManager {
  constructor(cacheMiddleware) {
    this.cacheMiddleware = cacheMiddleware;
  }

  // 写后失效策略
  async invalidateOnWrite(resource, id) {
    const patterns = [
      `${resource}:list`,
      `${resource}:${id}`,
      `${resource}:${id}:*`, // 相关资源
    ];

    for (const pattern of patterns) {
      await this.cacheMiddleware.invalidate(pattern);
    }
  }

  // 写前更新策略
  async updateOnWrite(resource, id, data) {
    await this.cacheMiddleware.set(`${resource}:${id}`, data, {
      ttl: 3600,
    });

    // 更新列表缓存
    const list = await this.getListFromCache(resource);
    if (list) {
      const updatedList = this.updateListItem(list, id, data);
      await this.cacheMiddleware.set(`${resource}:list`, updatedList, {
        ttl: 1800,
      });
    }
  }

  // 版本控制策略
  async versionedCache(resource, id, data) {
    const version = Date.now(); // 或使用更复杂的版本控制
    const cacheKey = `${resource}:${id}:v${version}`;

    await this.cacheMiddleware.set(cacheKey, data);
    await this.cacheMiddleware.set(`${resource}:${id}:latest`, {
      version,
      data: cacheKey,
    });
  }
}
```

## 📚 相关链接

- [应用服务层文档](application-layer.md) - 应用服务层的实现
- [基础设施层文档](infrastructure-layer.md) - 基础设施实现
- [API 文档](../api/api-documentation.md) - 完整的API参考
- [测试策略](../testing/testing-architecture.md) - 测试最佳实践
