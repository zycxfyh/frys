# frys API一致性规范

## 🎯 API设计原则

### 1. 构造函数标准化

```javascript
// ✅ 推荐：接受可选配置对象
class ModuleName {
  constructor(options = {}) {
    this.options = { ...defaultOptions, ...options };
    this.resources = new Map();
    this.createdAt = Date.now();
  }
}

// ❌ 避免：构造函数参数过多或不一致
class ModuleName {
  constructor(param1, param2, param3) {
    // 不一致
  }
}
```

### 2. 主要方法命名规范

```javascript
// 创建/初始化类方法
createXxx(); // 创建资源
registerXxx(); // 注册组件
addXxx(); // 添加项目
connectXxx(); // 建立连接

// 操作类方法
getXxx(); // 获取数据
setXxx(); // 设置数据
updateXxx(); // 更新数据
deleteXxx(); // 删除数据
executeXxx(); // 执行操作

// 生命周期方法
start(); // 启动服务
stop(); // 停止服务
listen(); // 监听端口
connect(); // 建立连接
disconnect(); // 断开连接
```

### 3. 返回值标准化

```javascript
// ✅ 推荐：返回资源标识符或对象
createUser(data) {
  const user = { id: generateId(), ...data };
  this.users.set(user.id, user);
  return user.id; // 返回ID
}

// ✅ 或者返回完整对象
createUser(data) {
  const user = { id: generateId(), ...data };
  this.users.set(user.id, user);
  return user; // 返回对象
}

// ❌ 避免：返回格式不一致
createUser(data) {
  // 有时返回ID，有时返回对象
}
```

### 4. 错误处理标准化

```javascript
// ✅ 推荐：统一错误处理
class ModuleName {
  validateParams(params, required = []) {
    for (const param of required) {
      if (!params[param]) {
        throw new Error(`${param} is required`);
      }
    }
  }

  async operation(params) {
    try {
      this.validateParams(params, ['id']);
      // 操作逻辑
    } catch (error) {
      console.error(`Operation failed: ${error.message}`);
      throw new frysError(`Operation failed: ${error.message}`, error);
    }
  }
}

// 自定义错误类
class frysError extends Error {
  constructor(message, originalError = null) {
    super(message);
    this.name = 'frysError';
    this.originalError = originalError;
  }
}
```

### 5. 配置管理标准化

```javascript
// ✅ 推荐：统一配置管理
class ModuleName {
  constructor(options = {}) {
    this.config = {
      enabled: true,
      timeout: 5000,
      retries: 3,
      ...options,
    };
  }

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    this.validateConfig();
  }

  validateConfig() {
    // 配置验证逻辑
  }
}
```

### 6. 统计信息标准化

```javascript
// ✅ 推荐：统一统计格式
class ModuleName {
  getStats() {
    return {
      totalResources: this.resources.size,
      activeConnections: this.getActiveCount(),
      uptime: Date.now() - this.createdAt,
      errors: this.errorCount,
      version: '2.0.0-lightweight',
    };
  }

  getActiveCount() {
    // 计算活跃资源数量
  }
}
```

---

## 🔍 当前API一致性分析

### ✅ 符合规范的模块

#### 1. **构造函数标准化**

- ✅ AxiosInspiredHTTP
- ✅ DayJSInspiredDate
- ✅ ESLintInspiredLinting
- ✅ FastifyInspiredFramework
- ✅ FluentdInspiredLogging
- ✅ HuskyInspiredHooks
- ✅ JaegerInspiredTracing
- ✅ JWTInspiredAuth
- ✅ LernaInspiredMonorepo
- ✅ LodashInspiredUtils
- ✅ NATSInspiredMessaging
- ✅ OpenAPIInspiredDocs
- ✅ PrettierInspiredFormatting
- ✅ PrismaInspiredORM
- ✅ PrometheusInspiredMetrics
- ✅ ProtocolBuffersInspiredSerialization
- ✅ SQLiteInspiredDatabase
- ✅ UUIDInspiredId
- ✅ ViteInspiredBuild
- ✅ VitestInspiredTesting
- ✅ ZodInspiredValidation
- ✅ ZustandInspiredState

#### 2. **方法命名规范**

- ✅ 大部分模块使用create/register/add等标准前缀
- ✅ 操作方法使用get/set/update/delete等标准名称
- ✅ 生命周期方法使用start/stop/connect等标准名称

#### 3. **统计方法统一**

- ✅ 所有模块都有getStats()方法
- ✅ 返回对象格式基本一致

### ⚠️ 需要改进的地方

#### 1. **ConsulInspiredDiscovery**

- 方法命名不一致：`registerService` vs `createXxx`
- 参数结构复杂，需要简化

#### 2. **D3InspiredVisualization**

- API设计过于复杂
- 方法参数不统一

#### 3. **错误处理不统一**

- 各模块错误处理方式不同
- 没有统一的错误类型

#### 4. **配置管理不统一**

- 有些模块有配置管理，有些没有
- 配置格式不统一

---

## 🛠️ API重构计划

### Phase 1: 核心API标准化 (本周完成)

1. **统一构造函数参数**
   - 所有模块接受options对象
   - 设置默认配置

2. **标准化方法命名**
   - 统一CRUD操作命名
   - 统一生命周期方法名

3. **统一返回值格式**
   - 明确返回ID还是对象
   - 保持一致性

### Phase 2: 错误处理统一 (下周完成)

1. **创建统一错误类**
   - frysError基类
   - 模块特定错误类

2. **标准化错误处理**
   - 统一的try-catch模式
   - 一致的错误信息格式

### Phase 3: 配置管理统一 (下下周完成)

1. **标准化配置结构**
   - 统一的配置选项
   - 配置验证机制

2. **配置热更新支持**
   - 运行时配置更新
   - 配置持久化

### Phase 4: 测试和文档完善 (最终完成)

1. **API测试覆盖**
   - 单元测试标准化
   - 集成测试规范

2. **文档自动生成**
   - JSDoc标准化
   - API文档生成

---

## 📋 具体改进任务

### 1. ConsulInspiredDiscovery API优化

```javascript
// 当前API
registerService(serviceId, service);
performHealthCheck(service, healthCheck);

// 优化后API
createService(serviceId, config);
startHealthCheck(serviceId);
```

### 2. D3InspiredVisualization API简化

```javascript
// 当前API - 过于复杂
createChart(chartType, config);
addData(chartId, data);
render(chartId);

// 优化后API - 简化
createChart(type, data, options);
updateChart(chartId, newData);
```

### 3. 错误处理统一

```javascript
// 统一错误处理模式
class frysError extends Error {
  constructor(code, message, module, originalError = null) {
    super(message);
    this.code = code;
    this.module = module;
    this.originalError = originalError;
  }
}

// 使用示例
throw new frysError(
  'VALIDATION_ERROR',
  'Invalid input',
  'UserModule',
  error,
);
```

### 4. 配置管理标准化

```javascript
// 统一配置结构
const defaultConfig = {
  enabled: true,
  timeout: 5000,
  retries: 3,
  debug: false,
};

class Module {
  constructor(options = {}) {
    this.config = { ...defaultConfig, ...options };
    this.validateConfig();
  }
}
```

---

## 🎯 预期收益

### 技术收益

1. **开发效率提升30%**: API一致性减少学习成本
2. **维护成本降低40%**: 统一模式减少bug
3. **扩展性增强50%**: 标准接口易于扩展

### 业务收益

1. **团队协作改善**: 统一API减少沟通成本
2. **代码质量提升**: 标准化减少错误
3. **项目可维护性**: 一致性提高长期维护效率

---

_API一致性规范制定时间: 2025年1月_
_预计重构完成时间: 4周_
