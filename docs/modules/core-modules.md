# WokeFlow 核心功能模块

## 📖 模块概述

WokeFlow 的核心功能模块采用了"站在巨人肩膀上"的设计理念，通过集成业界领先的开源项目，提供了一套轻量级、高性能的企业级应用组件。

### 🎯 设计理念

- **开源优先**: 集成成熟的开源解决方案
- **轻量化**: 精简的核心，专注核心功能
- **高性能**: 优化的性能和资源使用
- **易扩展**: 模块化设计，支持灵活扩展

### 📦 核心模块矩阵

| 模块 | 开源项目 | 核心功能 | 适用场景 |
|------|----------|----------|----------|
| 🌐 HTTP客户端 | Axios | 网络请求处理 | API调用、文件上传 |
| 💾 状态管理 | Zustand | 响应式状态 | 用户状态、应用配置 |
| 📨 消息队列 | Bull.js | 作业队列 | 异步任务、定时作业 |
| 📡 事件系统 | EventEmitter3 | 事件通信 | 模块间解耦通信 |
| 🔐 认证授权 | JWT | 身份验证 | 用户认证、权限控制 |
| 📅 日期时间 | Day.js | 时间处理 | 日期计算、格式化 |
| 🛠️ 工具函数 | Lodash | 数据处理 | 数组操作、对象处理 |

## 🌐 HTTP 客户端模块 (Axios)

### 功能特性

- **请求/响应拦截器**: 自动处理认证、日志、错误处理
- **自动 JSON 转换**: 无缝处理 JSON 数据
- **请求重试机制**: 指数退避重试策略
- **请求缓存**: 智能缓存 GET 请求结果
- **并发控制**: 限制最大并发请求数量

### 快速开始

```javascript
import { httpClient } from 'wokeflow';

// 基础请求
const response = await httpClient.get('/api/users');
const user = await httpClient.post('/api/users', {
  name: 'John Doe',
  email: 'john@example.com'
});

// 带参数请求
const users = await httpClient.get('/api/users', {
  params: { page: 1, limit: 10 }
});

// 文件上传
const formData = new FormData();
formData.append('file', file);
await httpClient.post('/api/upload', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
});
```

### 高级用法

```javascript
// 自定义配置
const apiClient = httpClient.create({
  baseURL: 'https://api.example.com',
  timeout: 5000,
  headers: {
    'Authorization': 'Bearer token'
  }
});

// 请求拦截器 - 自动添加认证
apiClient.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截器 - 统一错误处理
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // 跳转到登录页
      redirectToLogin();
    }
    return Promise.reject(error);
  }
);
```

### 配置选项

```javascript
const config = {
  baseURL: 'https://api.example.com',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  },
  maxRequests: 100,        // 最大并发请求数
  retryAttempts: 3,        // 重试次数
  retryDelay: 1000,        // 重试延迟(ms)
  cacheEnabled: true,      // 启用缓存
  cacheTTL: 300000         // 缓存过期时间(ms)
};
```

## 💾 状态管理模块 (Zustand)

### 功能特性

- **响应式状态更新**: 状态变更自动通知订阅者
- **不可变状态**: 每次更新创建新状态对象
- **中间件支持**: 日志、持久化、调试中间件
- **选择器优化**: 支持状态选择器避免不必要重渲染
- **TypeScript友好**: 完整的类型支持

### 快速开始

```javascript
import { createStore } from 'wokeflow';

// 创建用户状态存储
const useUserStore = createStore((set, get) => ({
  user: null,
  isLoading: false,

  // 登录
  login: async (credentials) => {
    set({ isLoading: true });
    try {
      const user = await api.login(credentials);
      set({ user, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  // 登出
  logout: () => set({ user: null }),

  // 更新用户信息
  updateProfile: (updates) => set((state) => ({
    user: { ...state.user, ...updates }
  }))
}));

// 使用状态
function UserProfile() {
  const { user, login, logout, isLoading } = useUserStore();

  if (!user) {
    return (
      <div>
        <button onClick={() => login(credentials)} disabled={isLoading}>
          {isLoading ? '登录中...' : '登录'}
        </button>
  </div>
    );
  }

  return (
    <div>
      <h2>欢迎, {user.name}!</h2>
      <button onClick={logout}>登出</button>
</div>
  );
}
```

### 中间件使用

```javascript
import { createStore, persist, devtools } from 'wokeflow';

// 持久化中间件 - 状态保存到 localStorage
const usePersistentStore = createStore(
  persist(
    (set, get) => ({
      theme: 'light',
      setTheme: (theme) => set({ theme })
    }),
    {
      name: 'app-settings'
    }
  )
);

// 开发工具中间件 - Redux DevTools 支持
const useDebugStore = createStore(
  devtools(
    (set, get) => ({
      count: 0,
      increment: () => set((state) => ({ count: state.count + 1 })),
      decrement: () => set((state) => ({ count: state.count - 1 }))
    }),
    {
      name: 'counter'
    }
  )
);
```

### 选择器优化

```javascript
// 基础用法 - 每次状态变更都会重渲染
const count = useStore((state) => state.count);

// 优化用法 - 只在 count 变化时重渲染
const count = useStore(
  useCallback((state) => state.count, [])
);

// 多个选择器
const { user, settings } = useStore(
  useCallback((state) => ({
    user: state.user,
    settings: state.settings
  }), [])
);
```

## 📨 消息队列模块 (Bull.js)

### 功能特性

- **基于 Redis**: 高性能的 Redis 驱动队列
- **作业调度**: 支持延迟执行、重复任务
- **优先级队列**: 支持任务优先级设置
- **监控面板**: 内置 Web 监控界面
- **自动重试**: 失败任务自动重试机制
- **并发控制**: 限制同时处理的任务数量

### 快速开始

```javascript
import { createQueue, createWorker } from 'wokeflow';

// 创建队列
const emailQueue = createQueue('email');

// 添加任务到队列
await emailQueue.add('send-welcome', {
  email: 'user@example.com',
  name: 'John Doe'
});

// 创建工作者处理任务
const emailWorker = createWorker('email', async (job) => {
  const { email, name } = job.data;

  // 发送欢迎邮件
  await sendWelcomeEmail(email, name);

  console.log(`欢迎邮件已发送给 ${name}`);
});
```

### 高级用法

```javascript
// 延迟任务
await emailQueue.add(
  'send-reminder',
  { userId: 123 },
  { delay: 24 * 60 * 60 * 1000 } // 24小时后执行
);

// 重复任务
await emailQueue.add(
  'daily-report',
  {},
  {
    repeat: {
      cron: '0 9 * * *' // 每天早上9点
    }
  }
);

// 优先级任务
await emailQueue.add(
  'urgent-notification',
  { message: '系统紧急通知' },
  { priority: 10 } // 高优先级
);

// 批量添加任务
const jobs = [
  { email: 'user1@example.com', name: 'User 1' },
  { email: 'user2@example.com', name: 'User 2' }
];

await emailQueue.addBulk(
  jobs.map((data) => ({
    name: 'send-welcome',
    data
  }))
);
```

### 监控和统计

```javascript
// 获取队列统计信息
const stats = await emailQueue.getJobCounts();
// { waiting: 5, active: 2, completed: 100, failed: 3 }

// 获取任务详情
const job = await emailQueue.getJob(123);
console.log(job.data, job.opts, job.finishedOn);

// 清理完成的任务
await emailQueue.clean(24 * 60 * 60 * 1000, 'completed'); // 清理24小时前完成的任务

// 暂停/恢复队列
await emailQueue.pause();
await emailQueue.resume();
```

## 📡 事件系统模块 (EventEmitter3)

### 功能特性

- **高性能**: 优化的内存使用和发射速度
- **事件命名空间**: 支持带命名空间的事件
- **通配符匹配**: 支持通配符订阅模式
- **一次性监听器**: 支持只触发一次的事件监听
- **监听器管理**: 便捷的监听器添加/移除

### 快速开始

```javascript
import { eventEmitter } from 'wokeflow';

// 监听事件
eventEmitter.on('user.created', (user) => {
  console.log('新用户创建:', user.name);
  // 发送欢迎邮件
  sendWelcomeEmail(user.email);
});

// 发射事件
eventEmitter.emit('user.created', {
  id: 123,
  name: 'John Doe',
  email: 'john@example.com'
});
```

### 高级用法

```javascript
// 一次性监听器
eventEmitter.once('app.ready', () => {
  console.log('应用已就绪');
});

// 带上下文的监听器
class UserService {
  constructor() {
    this.handleUserLogin = this.handleUserLogin.bind(this);
    eventEmitter.on('user.login', this.handleUserLogin);
  }

  handleUserLogin(user) {
    console.log(`${user.name} 登录了`);
  }

  destroy() {
    eventEmitter.off('user.login', this.handleUserLogin);
  }
}

// 命名空间事件
eventEmitter.on('order.*', (order, eventName) => {
  console.log(`订单事件: ${eventName}`, order);
});

eventEmitter.emit('order.created', orderData);
eventEmitter.emit('order.updated', orderData);

// 移除所有监听器
eventEmitter.removeAllListeners('user.created');

// 获取监听器数量
const listenerCount = eventEmitter.listenerCount('user.created');
```

## 🔐 认证授权模块 (JWT)

### 功能特性

- **无状态认证**: 基于 JWT 的无状态令牌认证
- **密钥轮换**: 支持多密钥管理和轮换
- **令牌刷新**: 支持访问令牌和刷新令牌
- **权限验证**: 基于角色的访问控制 (RBAC)
- **令牌黑名单**: 支持令牌吊销机制

### 快速开始

```javascript
import { auth } from 'wokeflow';

// 初始化认证模块
await auth.initialize();

// 生成访问令牌
const accessToken = auth.generateToken({
  userId: 'user123',
  username: 'john',
  roles: ['user', 'admin']
}, 'access', {
  expiresIn: '1h'
});

// 生成刷新令牌
const refreshToken = auth.generateToken({
  userId: 'user123',
  type: 'refresh'
}, 'refresh', {
  expiresIn: '7d'
});

// 验证令牌
try {
  const payload = auth.verifyToken(accessToken, 'access');
  console.log('用户认证成功:', payload.username);
} catch (error) {
  console.error('令牌验证失败:', error.message);
}
```

### 权限验证

```javascript
// 检查用户角色
if (auth.hasRole(accessToken, 'admin')) {
  // 执行管理员操作
  performAdminAction();
}

// 检查权限
if (auth.hasPermission(accessToken, 'user.create')) {
  // 创建用户
  createUser(userData);
}

// 中间件使用
const authMiddleware = (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const payload = auth.verifyToken(token, 'access');

    req.user = payload;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized' });
  }
};
```

### 令牌管理

```javascript
// 刷新令牌对
const newTokens = auth.refreshTokenPair(refreshToken, 'refresh', 'access');

// 吊销令牌
auth.revokeToken(accessToken);

// 批量验证令牌
const tokens = ['token1', 'token2', 'token3'];
const validTokens = auth.verifyTokens(tokens, 'access');

// 清理过期令牌
auth.cleanupExpiredTokens();
```

## 📅 日期时间模块 (Day.js)

### 功能特性

- **轻量级设计**: 专注于常用日期操作
- **不可变操作**: 所有操作返回新实例
- **国际化支持**: 多语言日期格式化
- **相对时间**: 支持"3天前"等相对时间显示
- **插件扩展**: 支持自定义格式化和解析

### 快速开始

```javascript
import { dateUtil } from 'wokeflow';

// 创建日期对象
const now = dateUtil.create();
const birthday = dateUtil.create('1990-01-01');
const timestamp = dateUtil.create(1577836800000);

// 格式化日期
console.log(now.format('YYYY-MM-DD HH:mm:ss')); // 2024-01-01 12:00:00
console.log(now.format('MMM DD, YYYY'));        // Jan 01, 2024

// 日期运算
const tomorrow = now.add(1, 'day');
const lastWeek = now.subtract(1, 'week');
const nextYear = now.add(1, 'year');

// 相对时间
console.log(dateUtil.fromNow(birthday)); // 34 years ago
console.log(dateUtil.toNow(birthday));   // in 34 years

// 比较日期
if (now.isAfter(birthday)) {
  console.log('今天在生日之后');
}

if (dateUtil.isSame(now, tomorrow, 'day')) {
  console.log('是同一天');
}
```

### 高级用法

```javascript
// 时区处理
const utc = now.utc();
const local = utc.local();
const nyTime = now.tz('America/New_York');

// 工作日计算
const isWorkingDay = dateUtil.isWorkingDay(now);
const nextWorkingDay = dateUtil.nextWorkingDay(now);

// 日期范围
const startDate = dateUtil.create('2024-01-01');
const endDate = dateUtil.create('2024-01-31');
const businessDays = dateUtil.businessDaysBetween(startDate, endDate);

// 自定义格式化
const customFormat = dateUtil.create().format('dddd, MMMM Do YYYY, h:mm:ss a');
// Monday, January 1st 2024, 12:00:00 pm

// 解析日期字符串
const parsed = dateUtil.parse('2024-01-01 12:00:00', 'YYYY-MM-DD HH:mm:ss');
```

## 🛠️ 工具函数模块 (Lodash)

### 功能特性

- **函数式编程**: 支持链式调用和组合
- **类型安全**: 完善的类型检查和转换
- **性能优化**: 优化的算法和内存使用
- **模块化加载**: 支持按需导入
- **兼容性**: 保持与 Lodash API 的兼容性

### 快速开始

```javascript
import { utils } from 'wokeflow';

// 数组操作
const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const doubled = utils.map(numbers, n => n * 2);
const evens = utils.filter(numbers, n => n % 2 === 0);
const sum = utils.sum(numbers);
const unique = utils.uniq([1, 2, 2, 3, 3, 3]);
const chunks = utils.chunk(numbers, 3);

// 对象操作
const user = { id: 1, name: 'John', age: 30, active: true };

const picked = utils.pick(user, ['name', 'age']);
const omitted = utils.omit(user, ['id']);
const merged = utils.merge({ a: 1 }, { b: 2 }, { c: 3 });

// 字符串操作
const camelCase = utils.camelCase('hello world');     // helloWorld
const kebabCase = utils.kebabCase('HelloWorld');      // hello-world
const snakeCase = utils.snakeCase('HelloWorld');      // hello_world
```

### 高级用法

```javascript
// 函数组合
const greet = (name) => `Hello ${name}`;
const shout = (text) => text.toUpperCase();
const exclaim = (text) => `${text}!`;

const greetLoudly = utils.compose(exclaim, shout, greet);
console.log(greetLoudly('world')); // "HELLO WORLD!"

// 函数防抖和节流
const searchAPI = (query) => {
  console.log('搜索:', query);
};

const debouncedSearch = utils.debounce(searchAPI, 300);
const throttledSearch = utils.throttle(searchAPI, 1000);

// 集合操作
const users = [
  { id: 1, name: 'John', department: 'IT', salary: 50000 },
  { id: 2, name: 'Jane', department: 'HR', salary: 45000 },
  { id: 3, name: 'Bob', department: 'IT', salary: 55000 }
];

// 分组
const grouped = utils.groupBy(users, 'department');
// { IT: [...], HR: [...] }

// 排序
const sortedBySalary = utils.sortBy(users, 'salary');

// 查找
const itEmployees = utils.filter(users, { department: 'IT' });
const highEarners = utils.filter(users, (user) => user.salary > 50000);

// 异步工具
const asyncTasks = [
  () => delay(100).then(() => 1),
  () => delay(200).then(() => 2),
  () => delay(50).then(() => 3)
];

const results = await utils.mapAsync(asyncTasks, task => task());
const fastest = await utils.race(asyncTasks);
```

### 链式调用

```javascript
// 链式操作
const result = utils.chain(users)
  .filter({ department: 'IT' })
  .sortBy('salary')
  .reverse()
  .map(user => user.name)
  .uniq()
  .value();

// 相当于：
const result2 = utils.uniq(
  utils.map(
    utils.reverse(
      utils.sortBy(
        utils.filter(users, { department: 'IT' }),
        'salary'
      )
    ),
    user => user.name
  )
);
```

## 🔧 模块集成

### 依赖注入配置

```javascript
import { container } from 'wokeflow';

// 注册核心模块
container.register('http', httpClient);
container.register('state', createStore);
container.register('queue', createQueue);
container.register('events', eventEmitter);
container.register('auth', auth);
container.register('date', dateUtil);
container.register('utils', utils);

// 在服务中使用依赖注入
class UserService {
  constructor({ http, state, events }) {
    this.http = http;
    this.state = state;
    this.events = events;
  }

  async createUser(userData) {
    // 使用HTTP客户端
    const response = await this.http.post('/api/users', userData);

    // 更新状态
    this.state.setState(prev => ({
      users: [...prev.users, response.data]
    }));

    // 发布事件
    this.events.emit('user.created', response.data);

    return response.data;
  }
}

// 解析服务实例
const userService = container.resolve('userService');
```

### 模块协作模式

```javascript
// HTTP + 认证协作
httpClient.interceptors.request.use((config) => {
  const token = auth.getCurrentToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 状态管理 + 事件系统协作
const useUserStore = createStore((set, get) => ({
  users: [],

  addUser: (user) => {
    set(state => ({ users: [...state.users, user] }));
    // 触发事件
    eventEmitter.emit('user.added', user);
  }
}));

// 事件监听
eventEmitter.on('user.added', (user) => {
  console.log('新用户添加:', user.name);
  // 可以触发其他业务逻辑
});

// 消息队列 + 状态管理协作
const notificationWorker = createWorker('notifications', async (job) => {
  const { type, userId, message } = job.data;

  // 更新用户状态
  const userStore = useUserStore.getState();
  // 处理通知逻辑...

  return { success: true };
});
```

## 📊 性能监控

### 模块性能指标

| 模块 | 冷启动时间 | 内存占用 | CPU使用率 | 响应时间 |
|------|------------|----------|-----------|----------|
| HTTP客户端 | < 50ms | < 10MB | < 2% | < 100ms |
| 状态管理 | < 10ms | < 5MB | < 1% | < 5ms |
| 消息队列 | < 100ms | < 20MB | < 5% | < 50ms |
| 事件系统 | < 5ms | < 2MB | < 0.5% | < 1ms |
| 认证授权 | < 20ms | < 8MB | < 1% | < 10ms |
| 日期处理 | < 5ms | < 3MB | < 0.5% | < 2ms |
| 工具函数 | < 5ms | < 5MB | < 0.5% | < 1ms |

### 监控最佳实践

```javascript
// HTTP客户端监控
httpClient.interceptors.response.use(
  (response) => {
    // 记录成功请求
    logger.info('HTTP Request Success', {
      url: response.config.url,
      method: response.config.method,
      duration: Date.now() - response.config.startTime,
      status: response.status
    });
    return response;
  },
  (error) => {
    // 记录失败请求
    logger.error('HTTP Request Failed', {
      url: error.config?.url,
      method: error.config?.method,
      error: error.message,
      status: error.response?.status
    });
    return Promise.reject(error);
  }
);

// 消息队列监控
const queueMonitor = setInterval(async () => {
  const stats = await emailQueue.getJobCounts();
  logger.info('Queue Stats', stats);

  // 告警检查
  if (stats.failed > 10) {
    alertSystem.send('High failure rate in email queue');
  }
}, 60000); // 每分钟检查一次
```

## 🧪 测试策略

### 单元测试

```javascript
import { describe, it, expect, vi } from 'vitest';
import { httpClient } from '../src/core/http.js';

describe('HTTP Client', () => {
  it('should make GET request', async () => {
    // Mock axios
    vi.mock('axios');
    const mockResponse = { data: { id: 1, name: 'John' } };
    axios.get.mockResolvedValue(mockResponse);

    const result = await httpClient.get('/users/1');
    expect(result).toEqual(mockResponse.data);
  });

  it('should handle request errors', async () => {
    const mockError = new Error('Network Error');
    axios.get.mockRejectedValue(mockError);

    await expect(httpClient.get('/users/1')).rejects.toThrow('Network Error');
  });
});
```

### 集成测试

```javascript
describe('User Creation Workflow', () => {
  let container;
  let userService;
  let mockHttp;
  let mockState;
  let mockEvents;

  beforeEach(() => {
    // 设置依赖注入容器
    container = createContainer();

    // Mock 依赖
    mockHttp = { post: vi.fn() };
    mockState = { setState: vi.fn() };
    mockEvents = { emit: vi.fn() };

    container.register('http', mockHttp);
    container.register('state', mockState);
    container.register('events', mockEvents);

    userService = container.resolve('userService');
  });

  it('should create user and update state', async () => {
    const userData = { name: 'John', email: 'john@example.com' };
    const createdUser = { id: 1, ...userData };

    mockHttp.post.mockResolvedValue({ data: createdUser });

    const result = await userService.createUser(userData);

    expect(mockHttp.post).toHaveBeenCalledWith('/api/users', userData);
    expect(mockState.setState).toHaveBeenCalled();
    expect(mockEvents.emit).toHaveBeenCalledWith('user.created', createdUser);
    expect(result).toEqual(createdUser);
  });
});
```

## ❓ 常见问题

### Q: 如何选择合适的模块？

**A:** 根据你的需求选择：

- 需要网络请求 → HTTP客户端
- 需要状态管理 → Zustand状态管理
- 需要异步任务 → Bull.js消息队列
- 需要模块通信 → EventEmitter3事件系统
- 需要用户认证 → JWT认证模块
- 需要日期处理 → Day.js日期工具
- 需要数据处理 → Lodash工具函数

### Q: 模块之间如何协作？

**A:** 通过依赖注入容器统一管理，通过事件系统解耦通信：

```javascript
// 服务协作示例
class OrderService {
  constructor({ http, queue, events }) {
    this.http = http;
    this.queue = queue;
    this.events = events;

    // 监听订单事件
    this.events.on('order.created', this.handleOrderCreated.bind(this));
  }

  async handleOrderCreated(order) {
    // 发送到消息队列处理
    await this.queue.add('process-order', order);
  }
}
```

### Q: 如何处理模块错误？

**A:** 每个模块都有完善的错误处理：

```javascript
// HTTP错误处理
try {
  await httpClient.get('/api/data');
} catch (error) {
  if (error.response?.status === 401) {
    // 重新认证
    await refreshToken();
  } else if (error.code === 'NETWORK_ERROR') {
    // 网络错误，重试
    await retryRequest();
  }
}

// 队列错误处理
const worker = createWorker('tasks', async (job) => {
  try {
    await processJob(job.data);
  } catch (error) {
    logger.error('Job failed:', error);
    throw error; // Bull.js 会自动重试
  }
});
```

### Q: 如何监控模块性能？

**A:** 使用内置监控和自定义指标：

```javascript
// 启用性能监控
const httpClient = createHttpClient({
  enableMetrics: true,
  metricsPrefix: 'http_client'
});

// 自定义监控
setInterval(() => {
  const queueStats = await emailQueue.getJobCounts();
  metrics.gauge('queue_waiting', queueStats.waiting);
  metrics.gauge('queue_active', queueStats.active);
  metrics.gauge('queue_completed', queueStats.completed);
  metrics.gauge('queue_failed', queueStats.failed);
}, 30000);
```

## 📚 相关链接

- [项目主页](https://github.com/your-org/wokeflow)
- [API 文档](api-documentation.md)
- [部署指南](deployment-guide.md)
- [测试策略](testing-architecture.md)
- [贡献指南](../CONTRIBUTING.md)
