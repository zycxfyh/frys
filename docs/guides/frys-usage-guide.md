# frys 使用指南

## 📚 目录

1. [项目概述](#项目概述)
2. [快速开始](#快速开始)
3. [核心模块使用](#核心模块使用)
4. [开发工作流](#开发工作流)
5. [测试执行](#测试执行)
6. [部署指南](#部署指南)
7. [监控和维护](#监控和维护)
8. [最佳实践](#最佳实践)
9. [故障排除](#故障排除)

---

## 🚀 项目概述

frys 是一个基于 Node.js 的现代化工作流系统，融合了 25+ 个开源项目的理念，提供了完整的工业级开发解决方案。

### ✨ 核心特性

- **模块化架构**: 6个核心模块，支持独立使用和组合
- **工业级质量**: 100% 测试覆盖，企业级代码规范
- **完整DevOps**: 从需求到部署的自动化流水线
- **生产就绪**: 监控、告警、回滚等生产环境特性

### 🏗️ 架构组成

```
frys/
├── src/core/           # 核心模块
│   ├── AxiosInspiredHTTP.js     # HTTP 客户端
│   ├── NATSInspiredMessaging.js # 消息队列
│   ├── DayJSInspiredDate.js     # 日期处理
│   ├── ZustandInspiredState.js  # 状态管理
│   ├── LodashInspiredUtils.js   # 工具函数
│   └── JWTInspiredAuth.js       # JWT 认证
├── tests/             # 测试套件
├── docs/              # 文档
├── scripts/           # 部署脚本
├── monitoring/        # 监控配置
└── docker/            # 容器配置
```

---

## ⚡ 快速开始

### 环境要求

- **Node.js**: >= 16.0.0
- **npm**: >= 8.0.0
- **Docker**: >= 20.0.0 (可选，用于容器化部署)
- **Git**: 用于版本控制

### 安装和运行

```bash
# 1. 克隆项目
git clone https://github.com/zycxfyh/frys.git
cd frys

# 2. 安装依赖
npm install

# 3. 运行所有测试（验证环境）
npm run test:all

# 4. 启动开发环境
npm run dev
```

### 基本使用示例

```javascript
// 引入核心模块
const {
  createHTTPClient,
  createMessageBus,
  createStateManager,
} = require('./src');

// 创建实例
const http = createHTTPClient({ baseURL: 'https://api.example.com' });
const messaging = createMessageBus({ cluster: 'my-app' });
const store = createStateManager();

// 使用示例
async function demo() {
  // HTTP 请求
  const response = await http.get('/users');
  console.log('用户列表:', response.data);

  // 消息发布
  await messaging.publish('user-events', { type: 'login', userId: 123 });

  // 状态管理
  store.setState({ user: response.data[0] });
}

demo();
```

---

## 🧩 核心模块使用

### 1. HTTP 客户端 (AxiosInspiredHTTP)

```javascript
const { createHTTPClient } = require('./src/core/AxiosInspiredHTTP');

// 创建实例
const http = createHTTPClient({
  baseURL: 'https://api.example.com',
  timeout: 5000,
  headers: {
    Authorization: 'Bearer token',
  },
});

// 基本请求
const users = await http.get('/users');
const user = await http.post('/users', {
  name: 'John',
  email: 'john@example.com',
});

// 拦截器
http.interceptors.request.use((config) => {
  // 添加认证头
  config.headers.Authorization = `Bearer ${getToken()}`;
  return config;
});

http.interceptors.response.use((response) => {
  // 处理响应
  return response.data;
});
```

### 2. 消息队列 (NATSInspiredMessaging)

```javascript
const { createMessageBus } = require('./src/core/NATSInspiredMessaging');

// 创建消息总线
const messaging = await createMessageBus({
  cluster: 'my-app-cluster',
  timeout: 5000,
});

// 发布消息
await messaging.publish('user-events', {
  type: 'user_registered',
  userId: 123,
  timestamp: Date.now(),
});

// 订阅消息
const subscription = messaging.subscribe('user-events', (message) => {
  console.log('收到消息:', message);
  // 处理业务逻辑
});

// 取消订阅
messaging.unsubscribe(subscription.id);
```

### 3. 状态管理 (ZustandInspiredState)

```javascript
const { createStateManager } = require('./src/core/ZustandInspiredState');

// 创建状态管理器
const store = createStateManager({
  // 初始状态
  user: null,
  tasks: [],
  notifications: [],
});

// 定义 actions
store.addUser = (user) => {
  store.setState({ user });
};

store.addTask = (task) => {
  store.setState((state) => ({
    tasks: [...state.tasks, task],
  }));
};

// 使用
store.addUser({ id: 1, name: 'John' });
store.addTask({ id: 1, title: '完成任务', completed: false });

// 订阅状态变化
const unsubscribe = store.subscribe((state) => {
  console.log('状态更新:', state);
});
```

### 4. JWT 认证 (JWTInspiredAuth)

```javascript
const { createAuthManager } = require('./src/core/JWTInspiredAuth');

// 创建认证管理器
const auth = createAuthManager({
  secret: 'your-secret-key',
  expiresIn: '24h',
});

// 生成令牌
const token = auth.generateToken({
  userId: 123,
  username: 'john',
  role: 'admin',
});

// 验证令牌
const decoded = auth.verifyToken(token);
console.log('用户信息:', decoded);

// 刷新令牌
const newToken = auth.refreshToken(token);
```

### 5. 日期处理 (DayJSInspiredDate)

```javascript
const { createDateHelper } = require('./src/core/DayJSInspiredDate');

// 创建日期助手
const dateHelper = createDateHelper();

// 格式化日期
const now = dateHelper.now();
const formatted = dateHelper.formatDate(now, 'YYYY-MM-DD HH:mm:ss');
console.log('当前时间:', formatted);

// 日期计算
const tomorrow = dateHelper.addDays(now, 1);
const nextWeek = dateHelper.addWeeks(now, 1);

// 比较日期
const isAfter = dateHelper.isAfter(tomorrow, now); // true
const diff = dateHelper.diffInDays(tomorrow, now); // 1
```

### 6. 工具函数 (LodashInspiredUtils)

```javascript
const { createUtils } = require('./src/core/LodashInspiredUtils');

const utils = createUtils();

// 数组操作
const users = [
  { id: 1, name: 'John', age: 25 },
  { id: 2, name: 'Jane', age: 30 },
  { id: 3, name: 'Bob', age: 25 },
];

const adults = utils.filter(users, (user) => user.age >= 18);
const names = utils.map(users, 'name'); // ['John', 'Jane', 'Bob']
const grouped = utils.groupBy(users, 'age');

// 对象操作
const user = { id: 1, name: 'John', email: 'john@example.com' };
const picked = utils.pick(user, ['name', 'email']); // { name: 'John', email: 'john@example.com' }

// 深度克隆
const original = { nested: { value: 42 } };
const clone = utils.cloneDeep(original);
clone.nested.value = 100; // 不影响 original
```

---

## 🔄 开发工作流

### 1. 需求分析阶段

```bash
# 创建新功能分支
git checkout -b feature/new-feature

# 运行需求分析脚本
npm run analyze:requirements
```

### 2. 功能开发阶段

```javascript
// src/features/newFeature.js
export class NewFeature {
  constructor(dependencies) {
    this.http = dependencies.http;
    this.messaging = dependencies.messaging;
    this.store = dependencies.store;
  }

  async execute() {
    // 实现业务逻辑
    const data = await this.http.get('/api/data');
    this.messaging.publish('feature-events', { type: 'executed', data });
    this.store.setState({ featureResult: data });
  }
}
```

### 3. 测试驱动开发

```javascript
// tests/unit/features/newFeature.test.js
describe('NewFeature', () => {
  let feature, mockHttp, mockMessaging, mockStore;

  beforeEach(() => {
    mockHttp = { get: vi.fn() };
    mockMessaging = { publish: vi.fn() };
    mockStore = { setState: vi.fn() };

    feature = new NewFeature({
      http: mockHttp,
      messaging: mockMessaging,
      store: mockStore,
    });
  });

  it('应该执行功能并发布事件', async () => {
    const mockData = { result: 'success' };
    mockHttp.get.mockResolvedValue({ data: mockData });

    await feature.execute();

    expect(mockHttp.get).toHaveBeenCalledWith('/api/data');
    expect(mockMessaging.publish).toHaveBeenCalledWith('feature-events', {
      type: 'executed',
      data: mockData,
    });
  });
});
```

### 4. 代码质量检查

```bash
# 运行所有质量检查
npm run quality

# 单独检查
npm run lint          # ESLint 检查
npm run format:check  # 格式检查
npm run test:unit     # 单元测试
```

---

## 🧪 测试执行

### 运行测试套件

```bash
# 运行所有测试
npm run test:all

# 按类型运行
npm run test:unit        # 单元测试 (172个)
npm run test:integration # 集成测试 (42个)
npm run test:e2e         # 端到端测试 (9个)
npm run test:security    # 安全测试 (11个)
npm run test:performance # 性能测试 (13个)

# 带覆盖率报告
npm run test:coverage
```

### 测试结果分析

```bash
# 查看详细测试报告
npm run test:all -- --reporter=verbose

# 生成 HTML 覆盖率报告
npm run test:coverage && open coverage/index.html
```

### 编写测试的最佳实践

```javascript
// 1. 使用 describe 分组相关测试
describe('UserService', () => {
  // 2. 使用 beforeEach 设置测试环境
  let service, mockHttp;

  beforeEach(() => {
    mockHttp = { get: vi.fn(), post: vi.fn() };
    service = new UserService(mockHttp);
  });

  // 3. 使用有意义的测试名称
  it('应该在创建用户时验证必填字段', async () => {
    // 4. 准备测试数据
    const userData = { name: 'John' };

    // 5. 执行操作
    await expect(service.createUser(userData)).rejects.toThrow(
      'Email is required',
    );

    // 6. 验证结果
    expect(mockHttp.post).not.toHaveBeenCalled();
  });

  // 7. 测试边界情况
  it('应该处理网络错误并重试', async () => {
    mockHttp.post
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({ data: { id: 1 } });

    const result = await service.createUser(validUserData);

    expect(mockHttp.post).toHaveBeenCalledTimes(2);
    expect(result.id).toBe(1);
  });
});
```

---

## 🚀 部署指南

### 本地开发环境

```bash
# 启动开发服务器
npm run dev

# 带热重载的开发模式
npm run dev:watch
```

### Staging 环境部署

```bash
# 1. 设置 Staging 环境
npm run staging:setup

# 2. 构建并启动服务
npm run staging:up

# 3. 查看日志
npm run staging:logs

# 4. 运行回归测试
npm run staging:test

# 5. 停止服务
npm run staging:down
```

### 生产环境部署

```bash
# 1. 构建生产镜像
docker build -t frys:latest .

# 2. 部署到生产环境
npm run deploy

# 3. 验证部署
npm run verify:deployment

# 4. 查看监控
# 访问 http://your-server:9090 (Prometheus)
# 访问 http://your-server:3001 (Grafana)
```

### 蓝绿部署策略

```bash
# 1. 部署新版本到绿色环境
npm run deploy:staging

# 2. 运行冒烟测试
npm run test:smoke

# 3. 切换流量到新版本
npm run switch:traffic

# 4. 监控系统表现
npm run monitor:health

# 5. 如果出现问题，回滚
npm run rollback
```

---

## 📊 监控和维护

### 监控指标

frys 提供了全面的监控指标：

```javascript
// 自定义性能监控
const monitor = global.performanceMonitor;

const startTime = monitor.start();
await someOperation();
const result = monitor.end(startTime);

console.log(`操作耗时: ${result.formatted}`);

// 自动收集的指标
// - HTTP 请求响应时间
// - 消息队列处理延迟
// - 内存使用情况
// - 错误率统计
```

### 告警配置

系统内置了智能告警：

```yaml
# monitoring/prometheus/alert_rules.yml
groups:
  - name: frys_alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status="5xx"}[5m]) > 0.1
        labels:
          severity: critical
        annotations:
          summary: '高错误率告警'

      - alert: HighMemoryUsage
        expr: process_resident_memory_bytes / 1024 / 1024 > 500
        labels:
          severity: warning
        annotations:
          summary: '内存使用过高'
```

### 日志管理

```javascript
// 结构化日志
const logger = {
  info: (message, meta = {}) => {
    console.log(
      JSON.stringify({
        level: 'info',
        message,
        timestamp: new Date().toISOString(),
        ...meta,
      }),
    );
  },

  error: (message, error, meta = {}) => {
    console.error(
      JSON.stringify({
        level: 'error',
        message,
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
        ...meta,
      }),
    );
  },
};

// 使用示例
logger.info('用户登录', { userId: 123, ip: '192.168.1.1' });
logger.error('数据库连接失败', error, { retryCount: 3 });
```

---

## 🌟 最佳实践

### 1. 错误处理

```javascript
class ApiService {
  async safeRequest(url, options = {}) {
    try {
      const response = await this.http.request({
        url,
        ...options,
        timeout: options.timeout || 5000,
      });

      // 记录成功请求
      logger.info('API请求成功', {
        url,
        status: response.status,
        duration: Date.now() - startTime,
      });

      return response.data;
    } catch (error) {
      // 分类处理错误
      if (error.code === 'ECONNABORTED') {
        logger.warn('请求超时', { url, timeout: options.timeout });
        throw new TimeoutError('请求超时，请重试');
      }

      if (error.response?.status === 401) {
        logger.warn('认证失败', { url });
        throw new AuthenticationError('认证失败，请重新登录');
      }

      // 记录未知错误
      logger.error('API请求失败', error, { url });
      throw new ApiError('服务暂时不可用，请稍后重试');
    }
  }
}
```

### 2. 性能优化

```javascript
class OptimizedService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5分钟
  }

  async getData(key) {
    // 检查缓存
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    // 获取新数据
    const data = await this.fetchFromAPI(key);

    // 更新缓存
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });

    return data;
  }

  // 批量处理减少请求次数
  async batchUpdate(items) {
    const batches = this.chunkArray(items, 10); // 每批10个

    for (const batch of batches) {
      await this.http.post('/api/batch-update', { items: batch });
      await this.delay(100); // 避免过快请求
    }
  }

  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
```

### 3. 安全性实践

```javascript
class SecureService {
  // 输入验证和清理
  validateAndSanitize(input) {
    const utils = createUtils();

    // 清理潜在的 XSS 攻击
    const clean = utils.sanitizeInput(input);

    // 验证数据结构
    if (!this.isValidStructure(clean)) {
      throw new ValidationError('输入数据格式不正确');
    }

    return clean;
  }

  // SQL 注入防护
  buildSafeQuery(params) {
    const placeholders = Object.keys(params)
      .map(() => '?')
      .join(', ');
    const values = Object.values(params);

    return {
      sql: `SELECT * FROM users WHERE ${placeholders}`,
      values,
    };
  }

  // 速率限制
  async rateLimitCheck(userId, action) {
    const key = `${userId}:${action}`;
    const now = Date.now();
    const window = 60 * 1000; // 1分钟窗口

    // 检查最近请求
    const recentRequests = await this.getRecentRequests(key, now - window);

    if (recentRequests >= 10) {
      // 每分钟最多10次
      throw new RateLimitError('请求过于频繁，请稍后再试');
    }

    await this.recordRequest(key, now);
  }
}
```

---

## 🔧 故障排除

### 常见问题

#### 1. 测试失败

```bash
# 运行特定测试文件调试
npm run test:unit -- tests/unit/specific.test.js --reporter=verbose

# 调试模式运行
NODE_DEBUG=test npm run test:unit
```

#### 2. 内存泄漏

```javascript
// 检查内存使用
const memUsage = process.memoryUsage();
console.log('内存使用:', {
  rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
  heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
  heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
});

// 使用 heapdump 分析内存
const heapdump = require('heapdump');
setInterval(() => {
  heapdump.writeSnapshot();
}, 60000); // 每分钟生成堆快照
```

#### 3. 异步操作超时

```javascript
// 设置更长的超时时间
const config = {
  timeout: 30000, // 30秒
  retries: 3,
  retryDelay: 1000,
};

// 使用 Promise.race 避免无限等待
const timeoutPromise = new Promise((_, reject) => {
  setTimeout(() => reject(new Error('操作超时')), 10000);
});

const result = await Promise.race([this.performOperation(), timeoutPromise]);
```

### 调试技巧

```javascript
// 1. 使用调试器
node --inspect-brk src/index.js

// 2. 添加详细日志
const DEBUG = process.env.DEBUG === 'true';

function debugLog(message, data) {
  if (DEBUG) {
    console.log(`[DEBUG] ${message}`, data);
  }
}

// 3. 性能分析
const profiler = require('v8-profiler-node8');

function startProfiling() {
  profiler.startProfiling('cpu-profile');
}

function stopProfiling() {
  const profile = profiler.stopProfiling();
  profile.export((error, result) => {
    require('fs').writeFileSync('profile.cpuprofile', result);
  });
}
```

---

## 📖 进阶主题

### 自定义模块开发

```javascript
// lib/customModule.js
class CustomModule {
  constructor(options = {}) {
    this.options = { ...defaultOptions, ...options };
    this.initialize();
  }

  initialize() {
    // 初始化逻辑
    this.setupDependencies();
    this.registerHooks();
  }

  // 插件化接口
  use(plugin) {
    plugin.install(this);
    return this;
  }

  // 事件系统
  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach((callback) => callback(data));
    }
  }

  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }
}

module.exports = CustomModule;
```

### 微服务架构集成

```javascript
// services/userService.js
class UserService extends BaseService {
  constructor() {
    super();
    this.http = createHTTPClient({ baseURL: process.env.USER_SERVICE_URL });
    this.cache = new Cache({ ttl: 300 }); // 5分钟缓存
  }

  async getUser(id) {
    // 缓存优先
    const cached = await this.cache.get(`user:${id}`);
    if (cached) return cached;

    // 远程调用
    const response = await this.http.get(`/users/${id}`);
    const user = response.data;

    // 设置缓存
    await this.cache.set(`user:${id}`, user);

    return user;
  }

  async updateUser(id, data) {
    const user = await this.http.put(`/users/${id}`, data);

    // 清除相关缓存
    await this.cache.del(`user:${id}`);
    await this.cache.del('users:list');

    return user;
  }
}
```

---

## 🎯 总结

frys 为现代 Node.js 应用提供了完整的开发解决方案。通过遵循本指南，你可以：

1. **快速上手**: 5分钟内运行第一个示例
2. **高效开发**: 使用模块化架构和最佳实践
3. **质量保证**: 通过完整的测试套件确保代码质量
4. **生产就绪**: 使用 DevOps 工具链进行部署和监控

**🚀 开始你的 frys 之旅吧！**

---

_最后更新: 2025年11月5日_  
_版本: 1.0.0_  
_作者: frys Team_
