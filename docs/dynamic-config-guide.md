# 🔧 frys 动态配置指南：VCP工具占位符系统

## 📖 概述

frys现已集成VCPToolBox的工具占位符系统，提供强大的动态配置能力。通过`{{variable}}`语法，您可以创建智能、可适配的工作流配置。

## ✨ 核心特性

### 🚀 动态变量注入

```yaml
# 传统静态配置
workflow:
  steps:
    - name: api-call
      config:
        url: "https://api.example.com"
        timeout: 5000

# VCP动态配置
workflow:
  variables:
    apiBaseUrl: "https://api.example.com"
    loadFactor: "{{system.currentLoad}}"
  steps:
    - name: api-call
      config:
        url: "{{apiBaseUrl}}/endpoint"
        timeout: "{{loadFactor > 0.8 ? 1000 : 5000}}"  # 智能超时
```

### 🎯 内置函数支持

#### 数学函数

```yaml
config:
  batchSize: '{{max(1, min(100, userCount / 10))}}'
  timeout: '{{ceil(responseTime * 1.2)}}'
```

#### 字符串处理

```yaml
config:
  fileName: "{{uppercase(projectName)}}_{{formatdate(now(), 'YYYY-MM-DD')}}.log"
  apiKey: '{{substring(apiKeyFull, 0, 8)}}'
```

#### 逻辑判断

```yaml
config:
  enableCache: '{{and(isProduction, cacheEnabled)}}'
  retryCount: '{{gt(errorRate, 0.1) ? 5 : 3}}'
```

#### 日期时间

```yaml
config:
  backupName: 'backup_{{timestamp()}}'
  reportDate: "{{formatdate(now(), 'YYYY-MM-DD HH:mm:ss')}}"
```

## 📋 语法规则

### 基本语法

```
{{expression}}
```

### 支持的表达式类型

1. **变量引用**: `{{variableName}}`
2. **对象属性**: `{{user.name}}`
3. **数组索引**: `{{items.0}}`
4. **函数调用**: `{{length(text)}}`
5. **条件表达式**: `{{condition ? trueValue : falseValue}}`
6. **比较操作**: `{{age >= 18}}`
7. **算术运算**: `{{count + 1}}`

### 字面量

- **字符串**: `"hello"` 或 `'hello'`
- **数字**: `123`, `45.67`
- **布尔值**: `true`, `false`
- **null/undefined**: `null`, `undefined`

## 🔧 配置示例

### 1. 数据库连接配置

```yaml
database:
  host: '{{env.DB_HOST}}'
  port: '{{toNumber(env.DB_PORT)}}'
  poolSize: '{{max(1, min(20, system.cpuCount * 2))}}'
  retryDelay: '{{isProduction ? 5000 : 1000}}'
```

### 2. API调用配置

```yaml
api:
  baseUrl: '{{env.API_BASE_URL}}'
  timeout: "{{networkQuality === 'slow' ? 30000 : 10000}}"
  retries: '{{gt(errorRate, 0.05) ? 3 : 1}}'
  headers:
    Authorization: 'Bearer {{jwtToken}}'
    User-Agent: 'frys/{{version}} ({{platform}})'
```

### 3. 工作流分支逻辑

```yaml
workflow:
  steps:
    - name: validate-input
      condition: "{{isEmpty(input.data) ? 'skip' : 'continue'}}"

    - name: process-large-data
      condition: '{{length(input.data) > 1000}}'
      config:
        chunkSize: '{{min(100, length(input.data) / 10)}}'

    - name: process-small-data
      condition: '{{length(input.data) <= 1000}}'
      config:
        batchSize: '{{length(input.data)}}'
```

### 4. 环境自适应配置

```yaml
scaling:
  minInstances: "{{env.NODE_ENV === 'production' ? 3 : 1}}"
  maxInstances: "{{env.NODE_ENV === 'production' ? 20 : 5}}"
  scaleUpThreshold: '{{system.cpuUsage > 0.8 ? 0.6 : 0.8}}'
  scaleDownThreshold: '{{system.memoryUsage < 0.3 ? 0.2 : 0.1}}'
```

## 🛠️ 高级用法

### 自定义函数

```javascript
// 注册自定义函数
placeholderSystem.registerFunction('calculateRisk', (amount, history) => {
  if (amount > 10000 && history.length < 3) return 'high';
  if (amount > 5000 || history.length < 1) return 'medium';
  return 'low';
});

// 在配置中使用
config: riskLevel: '{{calculateRisk(transaction.amount, user.history)}}';
```

### 复杂表达式

```yaml
config:
  priority: "{{gt(severity, 7) ? 'critical' : gt(severity, 4) ? 'high' : 'normal'}}"
  cacheKey: "{{join([user.id, product.id, formatdate(now(), 'YYYYMMDD')], '_')}}"
  timeout: '{{max(1000, min(30000, networkLatency * 3))}}'
```

### 数组和对象操作

```yaml
config:
  selectedItems: '{{filter(items, (item) => gt(item.score, 0.8))}}'
  totalValue: '{{reduce(prices, (sum, price) => sum + price, 0)}}'
  userSummary: '{{merge(user, { lastLogin: now(), sessionCount: user.sessionCount + 1 })}}'
```

## 🔒 安全考虑

### 循环引用检测

系统自动检测并防止循环引用：

```yaml
# ❌ 会抛出错误
config:
  a: "{{b}}"
  b: "{{a}}"

# ❌ 也会检测到
config:
  x: "{{y}}"
  y: "{{z}}"
  z: "{{x}}"
```

### 严格模式 vs 非严格模式

#### 严格模式 (默认)

```javascript
const system = new PlaceholderSystem({ strictMode: true });
// 未定义变量会抛出错误
// 未解析的占位符会抛出错误
```

#### 非严格模式

```javascript
const system = new PlaceholderSystem({ strictMode: false });
// 未定义变量返回 undefined
// 未解析的占位符保留原样
```

## 📊 性能优化

### 缓存机制

```javascript
const system = new PlaceholderSystem({
  enableCaching: true, // 启用表达式缓存
  maxDepth: 5, // 最大递归深度
});
```

### 大规模配置处理

```javascript
// 对于大量配置，建议预编译
const compiledConfig = system.processObject(largeConfig, context);
// 重复使用时会从缓存中获取结果
```

## 🧪 测试示例

### 基本变量替换

```javascript
const system = new PlaceholderSystem();

const template = 'Hello {{name}}!';
const context = { name: 'World' };
const result = system.processString(template, context);
// 输出: "Hello World!"
```

### 条件表达式

```javascript
const template = "{{age >= 18 ? 'adult' : 'minor'}}";
const context = { age: 20 };
const result = system.processString(template, context);
// 输出: "adult"
```

### 函数调用

```javascript
const template = 'Length: {{length(text)}}';
const context = { text: 'hello world' };
const result = system.processString(template, context);
// 输出: "Length: 11"
```

### 复杂对象处理

```javascript
const config = {
  api: {
    url: '{{baseUrl}}/{{endpoint}}',
    timeout: '{{timeout}}',
  },
  features: "{{enabled ? ['feature1', 'feature2'] : []}}",
};

const context = {
  baseUrl: 'https://api.example.com',
  endpoint: 'users',
  timeout: 5000,
  enabled: true,
};

const result = system.processObject(config, context);
// 输出:
// {
//   api: {
//     url: "https://api.example.com/users",
//     timeout: "5000"
//   },
//   features: ["feature1", "feature2"]
// }
```

## 🚀 最佳实践

### 1. 变量命名

```yaml
# ✅ 好的命名
config:
  databaseUrl: "{{env.DATABASE_URL}}"
  apiTimeout: "{{system.load > 0.8 ? 30000 : 5000}}"

# ❌ 不好的命名
config:
  x: "{{env.a}}"  # 含义不清
  y: "{{z ? 1 : 2}}"  # 难以理解
```

### 2. 错误处理

```yaml
# 使用默认值
config:
  timeout: "{{timeout || 5000}}"
  retries: "{{retries || 3}}"

# 条件检查
config:
  apiKey: "{{apiKey ? apiKey : 'default-key'}}"
```

### 3. 性能考虑

```yaml
# 避免在热点路径上使用复杂表达式
config:
  simpleValue: "{{simpleVar}}"  # ✅ 快速

# 复杂计算移到预处理阶段
config:
  complexValue: "{{precalculatedValue}}"  # ✅ 预处理
```

## 🔄 迁移指南

### 从静态配置迁移

```javascript
// 旧的静态配置
const config = {
  apiUrl: 'https://api.example.com',
  timeout: 5000,
  retries: 3,
};

// 新的动态配置
const dynamicConfig = {
  apiUrl: "{{env.API_URL || 'https://api.example.com'}}",
  timeout: '{{env.TIMEOUT || 5000}}',
  retries: '{{env.RETRIES || 3}}',
};
```

### 向后兼容

```javascript
// 系统会自动处理纯静态配置
const staticConfig = { timeout: 5000 };
const result = system.processObject(staticConfig, {});
// 输出: { timeout: 5000 }  // 不变
```

---

## 🎯 下一步

现在您已经掌握了frys的动态配置系统！这个功能让您的工作流配置更加智能和适应性强。

接下来，我们将继续集成VCP的其他核心模块，包括：

- 插件通信总线
- 基础记忆网络

敬请期待更多强大的功能！ 🚀
