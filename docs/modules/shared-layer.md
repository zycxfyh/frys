# frys 共享层

## 📖 模块概述

frys 的共享层提供了整个应用的基础设施和通用组件，包括基类、工具函数、类型定义、错误处理等。该层采用了清洁架构的原则，为各层提供共享的服务和抽象，确保代码的一致性和可重用性。

### 🎯 核心特性

- **基类抽象** - 统一的实体、控制器、服务基类
- **错误处理** - 结构化的错误类型和处理机制
- **结果封装** - 函数式编程的结果类型
- **事件总线** - 轻量级的事件通信机制
- **依赖注入** - IoC容器实现

### 🏗️ 共享架构

```
共享层
├── 🏗️ 内核 (Kernel)
│   ├── 📋 基类 (Base Classes)
│   │   ├── BaseEntity - 实体基类
│   │   ├── BaseValueObject - 值对象基类
│   │   ├── BaseController - 控制器基类
│   │   ├── BaseApplicationService - 应用服务基类
│   │   ├── BaseUseCase - 用例基类
│   │   └── BaseRepository - 仓储基类
│   ├── 🔧 依赖注入 (Dependency Injection)
│   │   ├── DependencyContainer - IoC容器
│   │   └── ServiceLocator - 服务定位器
│   ├── 📢 事件系统 (Event System)
│   │   ├── EventBus - 事件总线
│   │   └── EventPublisher - 事件发布器
│   ├── 🎯 结果类型 (Result Types)
│   │   ├── Result<T> - 结果封装
│   │   ├── Success<T> - 成功结果
│   │   └── Failure - 失败结果
│   └── ❌ 错误处理 (Error Handling)
│       ├── 错误类型定义
│       └── 错误处理工具
├── 🏷️ 类型定义 (Types)
│   ├── 领域类型
│   ├── API类型
│   └── 基础设施类型
└── 🛠️ 工具函数 (Utils)
    ├── 缓存装饰器
    ├── 验证助手
    └── 通用工具
```

## 🏗️ 内核 (Kernel)

### 基类抽象

#### BaseEntity - 实体基类

```javascript
/**
 * 实体基类 - 实现领域实体的通用行为
 */
export class BaseEntity {
  constructor(id, createdAt = new Date(), updatedAt = new Date()) {
    this._id = id;
    this._createdAt = createdAt;
    this._updatedAt = updatedAt;
    this._domainEvents = [];
  }

  get id() {
    return this._id;
  }

  get createdAt() {
    return this._createdAt;
  }

  get updatedAt() {
    return this._updatedAt;
  }

  /**
   * 标记实体为已修改
   */
  markAsModified() {
    this._updatedAt = new Date();
  }

  /**
   * 添加领域事件
   */
  addDomainEvent(event) {
    this._domainEvents.push(event);
  }

  /**
   * 获取未发布的领域事件
   */
  getUnpublishedEvents() {
    return [...this._domainEvents];
  }

  /**
   * 清除未发布的领域事件
   */
  clearUnpublishedEvents() {
    this._domainEvents = [];
  }

  /**
   * 检查实体相等性（基于ID）
   */
  equals(other) {
    if (!other || !(other instanceof BaseEntity)) {
      return false;
    }
    return this._id === other._id;
  }

  /**
   * 获取实体哈希值
   */
  hashCode() {
    return this._id.toString();
  }

  /**
   * 转换为普通对象
   */
  toObject() {
    return {
      id: this._id,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }

  /**
   * 从普通对象创建实体
   */
  static fromObject(obj) {
    return new this(obj.id, obj.createdAt, obj.updatedAt);
  }
}
```

#### BaseValueObject - 值对象基类

```javascript
/**
 * 值对象基类 - 实现值对象的通用行为
 */
export class BaseValueObject {
  constructor(props) {
    this._props = Object.freeze({ ...props });
    this.validate();
  }

  get props() {
    return this._props;
  }

  /**
   * 值对象验证（子类实现）
   */
  validate() {
    // 子类实现具体的验证逻辑
  }

  /**
   * 检查值对象相等性（基于属性值）
   */
  equals(other) {
    if (!other || !(other instanceof BaseValueObject)) {
      return false;
    }

    // 深度比较属性
    return this.deepEquals(this._props, other._props);
  }

  /**
   * 深度相等比较
   */
  deepEquals(a, b) {
    if (a === b) return true;

    if (a == null || b == null) return false;

    if (typeof a !== typeof b) return false;

    if (typeof a !== 'object') return a === b;

    if (Array.isArray(a) !== Array.isArray(b)) return false;

    if (Array.isArray(a)) {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (!this.deepEquals(a[i], b[i])) return false;
      }
      return true;
    }

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
      if (!keysB.includes(key)) return false;
      if (!this.deepEquals(a[key], b[key])) return false;
    }

    return true;
  }

  /**
   * 获取哈希值（用于值对象比较优化）
   */
  hashCode() {
    return this.computeHash(this._props);
  }

  /**
   * 计算对象哈希值
   */
  computeHash(obj) {
    const str = JSON.stringify(obj);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // 转换为32位整数
    }
    return hash.toString();
  }

  /**
   * 转换为字符串表示
   */
  toString() {
    return `${this.constructor.name}(${JSON.stringify(this._props)})`;
  }

  /**
   * 克隆值对象（创建新实例）
   */
  clone() {
    return new this.constructor(this._props);
  }
}
```

#### BaseController - 控制器基类

```javascript
/**
 * 控制器基类 - 提供统一的HTTP响应处理
 */
export class BaseController {
  constructor(logger) {
    this.logger = logger;
  }

  /**
   * 成功响应 (200)
   */
  ok(res, data, message = null) {
    const response = {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };

    if (message) {
      response.message = message;
    }

    return res.status(200).json(response);
  }

  /**
   * 创建成功响应 (201)
   */
  created(res, data, message = null) {
    const response = {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };

    if (message) {
      response.message = message;
    }

    return res.status(201).json(response);
  }

  /**
   * 无内容响应 (204)
   */
  noContent(res) {
    return res.status(204).send();
  }

  /**
   * 重定向响应 (302)
   */
  redirect(res, url, permanent = false) {
    return res.status(permanent ? 301 : 302).redirect(url);
  }

  /**
   * 错误响应
   */
  badRequest(res, message, details = null) {
    return this.error(res, 400, 'BAD_REQUEST', message, details);
  }

  unauthorized(res, message = 'Unauthorized') {
    return this.error(res, 401, 'UNAUTHORIZED', message);
  }

  forbidden(res, message = 'Forbidden') {
    return this.error(res, 403, 'FORBIDDEN', message);
  }

  notFound(res, message = 'Not found') {
    return this.error(res, 404, 'NOT_FOUND', message);
  }

  conflict(res, message = 'Conflict') {
    return this.error(res, 409, 'CONFLICT', message);
  }

  unprocessableEntity(res, message, details = null) {
    return this.error(res, 422, 'VALIDATION_ERROR', message, details);
  }

  internalError(res, error, message = 'Internal server error') {
    const errorMessage =
      process.env.NODE_ENV === 'production' ? message : error.message;
    this.logger.error('Controller error:', error);
    return this.error(res, 500, 'INTERNAL_ERROR', errorMessage);
  }

  /**
   * 通用错误响应
   */
  error(res, statusCode, code, message, details = null) {
    const response = {
      success: false,
      error: {
        code,
        message,
      },
      timestamp: new Date().toISOString(),
    };

    if (details) {
      response.error.details = details;
    }

    return res.status(statusCode).json(response);
  }

  /**
   * 处理业务错误
   */
  handleBusinessError(res, error) {
    if (error.name === 'ValidationError') {
      return this.unprocessableEntity(res, error.message, error.details);
    }

    if (error.name === 'AuthenticationError') {
      return this.unauthorized(res, error.message);
    }

    if (error.name === 'AuthorizationError') {
      return this.forbidden(res, error.message);
    }

    if (error.name === 'NotFoundError') {
      return this.notFound(res, error.message);
    }

    if (error.name === 'ConflictError') {
      return this.conflict(res, error.message);
    }

    return this.internalError(res, error);
  }

  /**
   * 分页响应
   */
  paginated(res, data, pagination, message = null) {
    const response = {
      success: true,
      data,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: pagination.total,
        totalPages: Math.ceil(pagination.total / pagination.limit),
        hasNext: pagination.page * pagination.limit < pagination.total,
        hasPrev: pagination.page > 1,
      },
      timestamp: new Date().toISOString(),
    };

    if (message) {
      response.message = message;
    }

    return res.status(200).json(response);
  }

  /**
   * 文件下载响应
   */
  download(res, filePath, filename = null) {
    const actualFilename = filename || path.basename(filePath);
    return res.download(filePath, actualFilename);
  }

  /**
   * 流式响应
   */
  stream(res, stream, contentType = 'application/octet-stream') {
    res.setHeader('Content-Type', contentType);
    return stream.pipe(res);
  }
}
```

#### BaseApplicationService - 应用服务基类

```javascript
/**
 * 应用服务基类 - 提供应用服务的通用功能
 */
export class BaseApplicationService {
  constructor(logger, eventPublisher = null) {
    this.logger = logger;
    this.eventPublisher = eventPublisher;
    this.initialized = false;
  }

  /**
   * 服务初始化
   */
  async initialize() {
    if (this.initialized) return this;

    try {
      this.logger.info(`Initializing ${this.constructor.name}`);
      await this.onInitialize();
      this.initialized = true;
      this.logger.info(`${this.constructor.name} initialized successfully`);
      return this;
    } catch (error) {
      this.logger.error(
        `${this.constructor.name} initialization failed:`,
        error,
      );
      throw error;
    }
  }

  /**
   * 服务启动
   */
  async start() {
    await this.initialize();
    this.logger.info(`Starting ${this.constructor.name}`);

    try {
      await this.onStart();
      this.logger.info(`${this.constructor.name} started successfully`);
      return this;
    } catch (error) {
      this.logger.error(`${this.constructor.name} start failed:`, error);
      throw error;
    }
  }

  /**
   * 服务停止
   */
  async stop() {
    this.logger.info(`Stopping ${this.constructor.name}`);

    try {
      await this.onStop();
      this.logger.info(`${this.constructor.name} stopped successfully`);
      return this;
    } catch (error) {
      this.logger.error(`${this.constructor.name} stop failed:`, error);
      throw error;
    }
  }

  /**
   * 初始化钩子（子类实现）
   */
  async onInitialize() {
    // 子类实现具体的初始化逻辑
  }

  /**
   * 启动钩子（子类实现）
   */
  async onStart() {
    // 子类实现具体的启动逻辑
  }

  /**
   * 停止钩子（子类实现）
   */
  async onStop() {
    // 子类实现具体的停止逻辑
  }

  /**
   * 发布领域事件
   */
  async publishEvent(event) {
    if (this.eventPublisher) {
      await this.eventPublisher.publish(event);
    }
  }

  /**
   * 执行事务
   */
  async executeInTransaction(fn) {
    // 子类可以重写此方法以提供事务支持
    return fn();
  }

  /**
   * 获取服务健康状态
   */
  getHealthStatus() {
    return {
      service: this.constructor.name,
      initialized: this.initialized,
      status: 'healthy',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 获取服务指标
   */
  getMetrics() {
    return {
      service: this.constructor.name,
      initialized: this.initialized,
      uptime: process.uptime(),
    };
  }
}
```

### 依赖注入 (Dependency Injection)

#### DependencyContainer - IoC容器

```javascript
/**
 * 依赖注入容器 - 实现控制反转和依赖注入
 */
export class DependencyContainer {
  constructor() {
    this.services = new Map();
    this.factories = new Map();
    this.instances = new Map();
    this.scopes = new Map();
  }

  /**
   * 注册服务
   */
  register(name, factory, lifetime = 'singleton') {
    if (typeof factory === 'function') {
      this.factories.set(name, { factory, lifetime });
    } else {
      // 直接注册实例
      this.instances.set(name, factory);
    }

    return this;
  }

  /**
   * 解析服务
   */
  resolve(name) {
    // 检查是否已有实例
    if (this.instances.has(name)) {
      return this.instances.get(name);
    }

    // 检查是否有工厂函数
    if (this.factories.has(name)) {
      const { factory, lifetime } = this.factories.get(name);

      if (lifetime === 'singleton') {
        const instance = factory(this);
        this.instances.set(name, instance);
        return instance;
      } else if (lifetime === 'scoped') {
        // 作用域内单例
        const scopeId = this.getCurrentScope();
        const scopedInstances = this.scopes.get(scopeId) || new Map();
        this.scopes.set(scopeId, scopedInstances);

        if (scopedInstances.has(name)) {
          return scopedInstances.get(name);
        }

        const instance = factory(this);
        scopedInstances.set(name, instance);
        return instance;
      } else {
        // 每次都创建新实例
        return factory(this);
      }
    }

    throw new Error(`Service '${name}' not registered`);
  }

  /**
   * 检查服务是否已注册
   */
  isRegistered(name) {
    return this.factories.has(name) || this.instances.has(name);
  }

  /**
   * 移除服务注册
   */
  unregister(name) {
    this.factories.delete(name);
    this.instances.delete(name);
    return this;
  }

  /**
   * 创建作用域
   */
  createScope(scopeId) {
    this.scopes.set(scopeId, new Map());
    this.currentScope = scopeId;
    return this;
  }

  /**
   * 销毁作用域
   */
  destroyScope(scopeId) {
    this.scopes.delete(scopeId);
    if (this.currentScope === scopeId) {
      this.currentScope = null;
    }
    return this;
  }

  /**
   * 获取当前作用域
   */
  getCurrentScope() {
    return this.currentScope || 'default';
  }

  /**
   * 获取所有注册的服务名
   */
  getRegisteredServices() {
    const factoryNames = Array.from(this.factories.keys());
    const instanceNames = Array.from(this.instances.keys());
    return [...new Set([...factoryNames, ...instanceNames])];
  }

  /**
   * 清空容器
   */
  clear() {
    this.services.clear();
    this.factories.clear();
    this.instances.clear();
    this.scopes.clear();
    this.currentScope = null;
    return this;
  }

  /**
   * 获取容器统计信息
   */
  getStats() {
    return {
      factories: this.factories.size,
      instances: this.instances.size,
      scopes: this.scopes.size,
      services: this.getRegisteredServices(),
    };
  }
}

// 全局容器实例
export const container = new DependencyContainer();
```

### 事件系统 (Event System)

#### EventBus - 事件总线

```javascript
/**
 * 事件总线 - 实现发布订阅模式的事件通信
 */
export class EventBus {
  constructor(logger = console) {
    this.logger = logger;
    this.handlers = new Map();
    this.middlewares = [];
    this.metrics = {
      published: 0,
      handled: 0,
      failed: 0,
    };
  }

  /**
   * 订阅事件
   */
  on(event, handler, options = {}) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }

    const handlerWrapper = {
      handler,
      options: {
        once: false,
        priority: 0,
        ...options,
      },
      id: this.generateId(),
    };

    const handlers = this.handlers.get(event);
    handlers.push(handlerWrapper);

    // 按优先级排序（高优先级先执行）
    handlers.sort((a, b) => b.options.priority - a.options.priority);

    this.logger.debug(`Event handler registered for '${event}'`);
    return handlerWrapper.id;
  }

  /**
   * 一次性订阅事件
   */
  once(event, handler, options = {}) {
    return this.on(event, handler, { ...options, once: true });
  }

  /**
   * 取消订阅事件
   */
  off(event, handlerOrId) {
    if (!this.handlers.has(event)) {
      return false;
    }

    const handlers = this.handlers.get(event);
    let removed = false;

    if (typeof handlerOrId === 'function') {
      // 按函数引用移除
      const initialLength = handlers.length;
      const filtered = handlers.filter((h) => h.handler !== handlerOrId);
      this.handlers.set(event, filtered);
      removed = filtered.length < initialLength;
    } else {
      // 按ID移除
      const initialLength = handlers.length;
      const filtered = handlers.filter((h) => h.id !== handlerOrId);
      this.handlers.set(event, filtered);
      removed = filtered.length < initialLength;
    }

    if (removed) {
      this.logger.debug(`Event handler removed for '${event}'`);
    }

    return removed;
  }

  /**
   * 发布事件
   */
  async emit(event, data = null, options = {}) {
    if (!this.handlers.has(event)) {
      return [];
    }

    const handlers = this.handlers.get(event);
    const results = [];
    const errors = [];

    this.metrics.published++;

    // 应用中间件
    let processedData = data;
    for (const middleware of this.middlewares) {
      try {
        processedData = await middleware(event, processedData, options);
      } catch (error) {
        this.logger.error('Event middleware error:', error);
        errors.push(error);
      }
    }

    // 执行处理器
    for (const handlerWrapper of handlers.slice()) {
      // 复制数组以防修改
      try {
        const result = await handlerWrapper.handler(
          processedData,
          event,
          options,
        );
        results.push(result);
        this.metrics.handled++;

        // 如果是一次性处理器，移除它
        if (handlerWrapper.options.once) {
          this.off(event, handlerWrapper.id);
        }
      } catch (error) {
        this.logger.error(`Event handler error for '${event}':`, error);
        errors.push(error);
        this.metrics.failed++;
      }
    }

    // 如果有错误但没有处理器处理，记录警告
    if (errors.length > 0 && results.length === 0) {
      this.logger.warn(
        `Event '${event}' emitted but all handlers failed:`,
        errors,
      );
    }

    return { results, errors };
  }

  /**
   * 等待事件（Promise版本）
   */
  waitFor(event, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.off(event, handlerId);
        reject(new Error(`Timeout waiting for event '${event}'`));
      }, timeout);

      const handlerId = this.once(event, (data) => {
        clearTimeout(timeoutId);
        resolve(data);
      });
    });
  }

  /**
   * 添加中间件
   */
  use(middleware) {
    this.middlewares.push(middleware);
    return this;
  }

  /**
   * 移除所有处理器
   */
  removeAllListeners(event = null) {
    if (event) {
      this.handlers.delete(event);
      this.logger.debug(`All handlers removed for '${event}'`);
    } else {
      this.handlers.clear();
      this.logger.debug('All event handlers removed');
    }
    return this;
  }

  /**
   * 获取处理器数量
   */
  listenerCount(event) {
    return this.handlers.get(event)?.length || 0;
  }

  /**
   * 获取事件名称列表
   */
  eventNames() {
    return Array.from(this.handlers.keys());
  }

  /**
   * 获取指标
   */
  getMetrics() {
    return {
      ...this.metrics,
      events: this.eventNames(),
      totalListeners: Array.from(this.handlers.values()).reduce(
        (sum, handlers) => sum + handlers.length,
        0,
      ),
    };
  }

  /**
   * 生成唯一ID
   */
  generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

### 结果类型 (Result Types)

#### Result<T> - 函数式结果封装

```javascript
/**
 * 结果类型 - 函数式编程的结果封装
 */
export class Result {
  constructor(success, data = null, error = null) {
    this.success = success;
    this.data = data;
    this.error = error;
  }

  /**
   * 创建成功结果
   */
  static success(data) {
    return new Result(true, data);
  }

  /**
   * 创建失败结果
   */
  static failure(error) {
    return new Result(false, null, error);
  }

  /**
   * 检查是否成功
   */
  isSuccess() {
    return this.success;
  }

  /**
   * 检查是否失败
   */
  isFailure() {
    return !this.success;
  }

  /**
   * 获取数据（成功时）
   */
  getData() {
    if (!this.success) {
      throw new Error('Cannot get data from failure result');
    }
    return this.data;
  }

  /**
   * 获取错误（失败时）
   */
  getError() {
    if (this.success) {
      throw new Error('Cannot get error from success result');
    }
    return this.error;
  }

  /**
   * 映射成功值
   */
  map(fn) {
    return this.success ? Result.success(fn(this.data)) : this;
  }

  /**
   * 映射错误值
   */
  mapError(fn) {
    return this.success ? this : Result.failure(fn(this.error));
  }

  /**
   * 链式操作
   */
  flatMap(fn) {
    return this.success ? fn(this.data) : this;
  }

  /**
   * 折叠结果
   */
  fold(successFn, failureFn) {
    return this.success ? successFn(this.data) : failureFn(this.error);
  }

  /**
   * 获取值或默认值
   */
  getOrElse(defaultValue) {
    return this.success ? this.data : defaultValue;
  }

  /**
   * 获取值或抛出错误
   */
  getOrThrow(errorMessage = null) {
    if (!this.success) {
      throw new Error(
        errorMessage || this.error?.message || 'Result is failure',
      );
    }
    return this.data;
  }

  /**
   * 转换为Promise
   */
  toPromise() {
    return this.success
      ? Promise.resolve(this.data)
      : Promise.reject(this.error);
  }

  /**
   * 过滤结果
   */
  filter(predicate, errorMessage = 'Filter condition not met') {
    if (!this.success) return this;

    return predicate(this.data)
      ? this
      : Result.failure(new Error(errorMessage));
  }

  /**
   * 恢复失败结果
   */
  recover(fn) {
    return this.success ? this : fn(this.error);
  }

  /**
   * 转换为字符串
   */
  toString() {
    return this.success
      ? `Success(${JSON.stringify(this.data)})`
      : `Failure(${this.error?.message || 'Unknown error'})`;
  }
}

// 便捷的Success和Failure类
export class Success extends Result {
  constructor(data) {
    super(true, data);
  }
}

export class Failure extends Result {
  constructor(error) {
    super(false, null, error);
  }
}
```

## ❌ 错误处理 (Error Handling)

### 错误类型定义

```javascript
/**
 * 基础错误类
 */
export class AppError extends Error {
  constructor(
    message,
    code = 'INTERNAL_ERROR',
    statusCode = 500,
    details = null,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date().toISOString();

    // 保持正确的堆栈跟踪
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }
}

/**
 * 验证错误
 */
export class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 'VALIDATION_ERROR', 400, details);
  }
}

/**
 * 认证错误
 */
export class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 'AUTHENTICATION_ERROR', 401);
  }
}

/**
 * 授权错误
 */
export class AuthorizationError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, 'AUTHORIZATION_ERROR', 403);
  }
}

/**
 * 资源未找到错误
 */
export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 'NOT_FOUND', 404);
  }
}

/**
 * 冲突错误
 */
export class ConflictError extends AppError {
  constructor(message = 'Resource conflict') {
    super(message, 'CONFLICT', 409);
  }
}

/**
 * 业务逻辑错误
 */
export class BusinessError extends AppError {
  constructor(message, code = 'BUSINESS_ERROR', details = null) {
    super(message, code, 400, details);
  }
}

/**
 * 外部服务错误
 */
export class ExternalServiceError extends AppError {
  constructor(service, originalError) {
    super(`External service error: ${service}`, 'EXTERNAL_SERVICE_ERROR', 502, {
      service,
      originalError: originalError.message,
    });
  }
}

/**
 * 数据库错误
 */
export class DatabaseError extends AppError {
  constructor(operation, originalError) {
    super(`Database operation failed: ${operation}`, 'DATABASE_ERROR', 500, {
      operation,
      originalError: originalError.message,
    });
  }
}
```

### 错误处理工具

```javascript
/**
 * 错误处理工具
 */
export class ErrorHandler {
  static handle(error, context = {}) {
    // 记录错误
    console.error('Error handled:', {
      error: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString(),
    });

    // 根据错误类型返回适当的响应
    if (error instanceof ValidationError) {
      return {
        statusCode: 400,
        body: {
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
          },
        },
      };
    }

    if (error instanceof AuthenticationError) {
      return {
        statusCode: 401,
        body: {
          error: {
            code: error.code,
            message: error.message,
          },
        },
      };
    }

    if (error instanceof AuthorizationError) {
      return {
        statusCode: 403,
        body: {
          error: {
            code: error.code,
            message: error.message,
          },
        },
      };
    }

    if (error instanceof NotFoundError) {
      return {
        statusCode: 404,
        body: {
          error: {
            code: error.code,
            message: error.message,
          },
        },
      };
    }

    if (error instanceof ConflictError) {
      return {
        statusCode: 409,
        body: {
          error: {
            code: error.code,
            message: error.message,
          },
        },
      };
    }

    if (error instanceof ExternalServiceError) {
      return {
        statusCode: 502,
        body: {
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
          },
        },
      };
    }

    // 默认内部服务器错误
    return {
      statusCode: 500,
      body: {
        error: {
          code: 'INTERNAL_ERROR',
          message:
            process.env.NODE_ENV === 'production'
              ? 'Internal server error'
              : error.message,
        },
      },
    };
  }

  /**
   * 异步错误边界
   */
  static asyncErrorBoundary(fn, errorHandler = null) {
    return async (req, res, next) => {
      try {
        await fn(req, res, next);
      } catch (error) {
        const handler = errorHandler || this.handle;
        const result = handler(error, { req, res });

        if (!res.headersSent) {
          res.status(result.statusCode).json(result.body);
        }
      }
    };
  }

  /**
   * 创建错误边界中间件
   */
  static createErrorBoundary(options = {}) {
    return (error, req, res, next) => {
      if (res.headersSent) {
        return next(error);
      }

      const result = this.handle(error, { req, res });
      res.status(result.statusCode).json(result.body);
    };
  }
}
```

## 🏷️ 类型定义 (Types)

### 领域类型

```typescript
// 用户相关类型
export interface User {
  id: string;
  username: string;
  email: string;
  isActive: boolean;
  isEmailVerified: boolean;
  roles: string[];
  permissions: string[];
  profile: UserProfile;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfile {
  firstName?: string;
  lastName?: string;
  avatar?: string;
  bio?: string;
  preferences: Record<string, any>;
}

export interface CreateUserRequest {
  username: string;
  email: string;
  password: string;
  profile?: Partial<UserProfile>;
}

export interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  avatar?: string;
  bio?: string;
  preferences?: Record<string, any>;
}

// 认证相关类型
export interface AuthTokens {
  accessToken: {
    value: string;
    expiresAt: Date;
  };
  refreshToken: {
    value: string;
    expiresAt: Date;
  };
}

export interface LoginRequest {
  username: string;
  password: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuthResult {
  user: User;
  session: Session;
  tokens: AuthTokens;
}

// 会话类型
export interface Session {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  isValid: boolean;
  metadata: Record<string, any>;
}

// 工作流类型
export interface WorkflowDefinition {
  id: string;
  name: string;
  version: string;
  description?: string;
  config: WorkflowConfig;
  variables: Record<string, any>;
  tasks: WorkflowTask[];
}

export interface WorkflowConfig {
  timeout: number;
  retryPolicy: RetryPolicy;
  notifications: NotificationSettings;
}

export interface WorkflowTask {
  id: string;
  name: string;
  type:
    | 'http'
    | 'script'
    | 'service'
    | 'parallel'
    | 'condition'
    | 'delay'
    | 'manual';
  dependsOn?: string[];
  timeout?: number;
  retryPolicy?: RetryPolicy;
  [key: string]: any;
}
```

### API类型

```typescript
// HTTP响应类型
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// 请求类型
export interface PaginationQuery {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  search?: string;
  filters?: Record<string, any>;
}

export interface AuthenticatedRequest extends Request {
  user: User;
  sessionId?: string;
  tokenPayload?: any;
}

// 表单数据类型
export interface MultipartFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
  destination?: string;
  filename?: string;
  path?: string;
}
```

## 🛠️ 工具函数 (Utils)

### 缓存装饰器

```javascript
/**
 * 缓存装饰器 - 为方法添加缓存功能
 */
export function Cacheable(options = {}) {
  return function (target, propertyName, descriptor) {
    const method = descriptor.value;
    const cacheOptions = {
      ttl: 300, // 默认5分钟
      keyGenerator: null,
      condition: null,
      ...options,
    };

    descriptor.value = async function (...args) {
      // 检查条件
      if (cacheOptions.condition && !cacheOptions.condition.apply(this, args)) {
        return method.apply(this, args);
      }

      // 生成缓存键
      const cacheKey = cacheOptions.keyGenerator
        ? cacheOptions.keyGenerator.apply(this, args)
        : `${target.constructor.name}:${propertyName}:${JSON.stringify(args)}`;

      // 获取缓存服务
      const cacheService = this.cacheService || this.cache;

      if (!cacheService) {
        console.warn('Cache service not available, skipping cache');
        return method.apply(this, args);
      }

      try {
        // 尝试从缓存获取
        const cached = await cacheService.get(cacheKey);
        if (cached !== null && cached !== undefined) {
          return cached;
        }

        // 执行方法
        const result = await method.apply(this, args);

        // 缓存结果
        if (result !== undefined) {
          await cacheService.set(cacheKey, result, { ttl: cacheOptions.ttl });
        }

        return result;
      } catch (error) {
        console.error('Cache operation failed:', error);
        // 缓存失败时仍执行原方法
        return method.apply(this, args);
      }
    };

    return descriptor;
  };
}

/**
 * 缓存失效装饰器
 */
export function CacheInvalidate(patterns = []) {
  return function (target, propertyName, descriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args) {
      try {
        // 执行原方法
        const result = await method.apply(this, args);

        // 失效缓存
        const cacheService = this.cacheService || this.cache;
        if (cacheService && patterns.length > 0) {
          for (const pattern of patterns) {
            await cacheService.clear(pattern);
          }
        }

        return result;
      } catch (error) {
        // 方法执行失败时也尝试失效缓存
        const cacheService = this.cacheService || this.cache;
        if (cacheService && patterns.length > 0) {
          for (const pattern of patterns) {
            await cacheService.clear(pattern);
          }
        }
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * 条件缓存装饰器
 */
export function ConditionalCache(conditionFn, options = {}) {
  return function (target, propertyName, descriptor) {
    const cacheable = Cacheable({
      ...options,
      condition: conditionFn,
    });

    return cacheable(target, propertyName, descriptor);
  };
}

/**
 * 缓存键生成器
 */
export class CacheKeyGenerator {
  static methodCall(target, methodName, args) {
    return `${target.constructor.name}:${methodName}:${this.hashArgs(args)}`;
  }

  static entityId(entityName, id) {
    return `${entityName}:${id}`;
  }

  static query(entityName, query) {
    return `${entityName}:query:${this.hashObject(query)}`;
  }

  static userSpecific(userId, key) {
    return `user:${userId}:${key}`;
  }

  static hashArgs(args) {
    return this.hashObject(args);
  }

  static hashObject(obj) {
    const str = JSON.stringify(obj, Object.keys(obj).sort());
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }
}
```

## 🔧 依赖注入配置

### 共享服务注册

```javascript
import { container } from './DependencyContainer.js';
import { EventBus } from './EventBus.js';
import { BaseController } from './BaseController.js';

// 注册事件总线
container.register('eventBus', () => new EventBus(console));

// 注册基础服务
container.register('logger', () => console);

// 注册控制器工厂
container.register(
  'baseController',
  (c) => new BaseController(c.resolve('logger')),
);

// 注册错误处理器
container.register('errorHandler', () => ErrorHandler);

// 注册结果类型工厂
container.register('result', () => Result);
container.register('success', () => Success);
container.register('failure', () => Failure);
```

## 📊 监控和指标

### 共享层指标

```javascript
// 事件总线指标
const eventBusMetrics = {
  eventsPublished: eventBus.getMetrics().published,
  eventsHandled: eventBus.getMetrics().handled,
  eventsFailed: eventBus.getMetrics().failed,
  totalListeners: eventBus.getMetrics().totalListeners,
  registeredEvents: eventBus.eventNames(),
};

// 依赖注入容器指标
const containerMetrics = {
  registeredServices:
    container.getStats().factories + container.getStats().instances,
  resolvedServices: container.getStats().instances,
  activeScopes: container.getStats().scopes,
  registeredServiceNames: container.getStats().services,
};

// 错误处理指标
const errorMetrics = {
  totalErrors: errorHandler.getStats().totalErrors,
  errorsByType: errorHandler.getStats().errorsByType,
  recentErrors: errorHandler.getStats().recentErrors,
};
```

## 🧪 测试策略

### 共享层单元测试

```javascript
import { describe, it, expect, vi } from 'vitest';
import { Result, Success, Failure } from '../shared/kernel/Result.js';

describe('Result Types', () => {
  it('should create success result', () => {
    const result = Result.success('test data');

    expect(result.isSuccess()).toBe(true);
    expect(result.isFailure()).toBe(false);
    expect(result.getData()).toBe('test data');
  });

  it('should create failure result', () => {
    const error = new Error('test error');
    const result = Result.failure(error);

    expect(result.isSuccess()).toBe(false);
    expect(result.isFailure()).toBe(true);
    expect(result.getError()).toBe(error);
  });

  it('should map success result', () => {
    const result = Result.success(5).map((x) => x * 2);

    expect(result.getData()).toBe(10);
  });

  it('should not map failure result', () => {
    const error = new Error('test');
    const result = Result.failure(error).map((x) => x * 2);

    expect(result.isFailure()).toBe(true);
    expect(result.getError()).toBe(error);
  });

  it('should chain operations with flatMap', () => {
    const result = Result.success(5)
      .flatMap((x) => Result.success(x * 2))
      .flatMap((x) => Result.success(x + 1));

    expect(result.getData()).toBe(11);
  });

  it('should fold result', () => {
    const successResult = Result.success('success');
    const failureResult = Result.failure(new Error('error'));

    expect(
      successResult.fold(
        (data) => `Success: ${data}`,
        (error) => `Error: ${error.message}`,
      ),
    ).toBe('Success: success');

    expect(
      failureResult.fold(
        (data) => `Success: ${data}`,
        (error) => `Error: ${error.message}`,
      ),
    ).toBe('Error: error');
  });
});
```

## ❓ 常见问题

### Q: 如何选择合适的基类？

**A:** 根据职责选择基类：

- **实体操作**: 使用 `BaseEntity`，需要唯一标识和状态追踪
- **值对象**: 使用 `BaseValueObject`，不可变且按值比较
- **HTTP控制器**: 使用 `BaseController`，统一响应格式
- **应用服务**: 使用 `BaseApplicationService`，需要生命周期管理

### Q: Result类型和异常的区别？

**A:** Result类型适用于业务逻辑中的可预期的错误情况：

```javascript
// 使用Result处理业务逻辑
async function createUser(userData) {
  // 验证
  if (!userData.email) {
    return Result.failure(new ValidationError('Email is required'));
  }

  // 检查唯一性
  const existing = await userRepo.findByEmail(userData.email);
  if (existing) {
    return Result.failure(new ConflictError('Email already exists'));
  }

  // 创建用户
  const user = await userRepo.create(userData);
  return Result.success(user);
}

// 调用方处理Result
const result = await createUser(userData);
if (result.isFailure()) {
  return handleBusinessError(result.getError());
}
const user = result.getData();
```

异常适用于系统级错误和不可预期的错误：

```javascript
// 异常用于系统错误
async function sendEmail(email) {
  try {
    await emailService.send(email);
  } catch (error) {
    // 记录系统错误
    logger.error('Email service failed:', error);
    throw new ExternalServiceError('email', error);
  }
}
```

### Q: 依赖注入的最佳实践？

**A:** 依赖注入使用原则：

1. **构造函数注入**: 最常用，明确依赖关系
2. **接口编程**: 依赖抽象而非具体实现
3. **单一职责**: 每个服务只负责一个功能
4. **生命周期管理**: 正确管理服务的创建和销毁
5. **作用域控制**: 使用合适的作用域（单例、作用域、瞬时）

```javascript
// 好的依赖注入实践
class UserService {
  constructor(
    userRepository, // 接口而非具体实现
    authService, // 单一职责服务
    eventPublisher, // 事件发布器
  ) {
    this.userRepo = userRepository;
    this.auth = authService;
    this.events = eventPublisher;
  }
}

// 注册时使用工厂函数
container.register(
  'userService',
  (c) =>
    new UserService(
      c.resolve('userRepository'),
      c.resolve('authService'),
      c.resolve('eventPublisher'),
    ),
);
```

## 📚 相关链接

- [应用服务层文档](application-layer.md) - 应用服务层的实现
- [基础设施层文档](infrastructure-layer.md) - 基础设施实现
- [表示层文档](presentation-layer.md) - API接口实现
- [测试策略](../testing/testing-architecture.md) - 测试最佳实践
