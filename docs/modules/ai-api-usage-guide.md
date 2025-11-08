# 🚀 frys 多AI服务API使用指南

## 📖 概述

frys提供了统一的多AI服务API接口，支持10+主流AI供应商的智能路由和统一调用。无论您使用OpenAI、Claude、Gemini还是其他AI服务，都可以通过统一的API接口进行调用。

### 🎯 核心特性

- **🔄 统一接口**: 所有AI供应商使用相同的API格式
- **🎚️ 智能路由**: 自动选择最优的AI供应商
- **📊 实时监控**: 详细的使用统计和性能监控
- **🛡️ 容错处理**: 自动降级和错误恢复
- **💰 成本优化**: 多策略成本控制和预算管理

---

## 🌐 支持的AI供应商

| 供应商          | 状态        | 特色功能               | API端点前缀          |
| --------------- | ----------- | ---------------------- | -------------------- |
| **🤖 OpenAI**   | ✅ 完整支持 | GPT-4, DALL-E, Whisper | `/api/ai/openai/*`   |
| **🧠 Claude**   | ✅ 完整支持 | 长上下文, 安全优先     | `/api/ai/claude/*`   |
| **💎 Gemini**   | ✅ 完整支持 | 多模态, Google生态     | `/api/ai/gemini/*`   |
| **🔍 DeepSeek** | ✅ 完整支持 | 高性价比, 中文优化     | `/api/ai/deepseek/*` |
| **🐉 通义千问** | ✅ 完整支持 | 阿里云生态, 中文擅长   | `/api/ai/alibaba/*`  |

---

## 🚀 快速开始

### 1. 启动服务

```bash
# 启动frys服务器
npm start

# 或开发模式
npm run dev
```

### 2. 查看API文档

访问内置API文档：

```
http://localhost:3000/api/docs
```

### 3. 基本使用示例

```javascript
// 获取所有可用供应商
const providers = await fetch('/api/ai/providers');
const data = await providers.json();

// 使用OpenAI聊天
const response = await fetch('/api/ai/openai/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: 'Hello!' }],
    temperature: 0.7,
  }),
});
```

---

## 📋 API参考

### 通用响应格式

所有API响应都遵循统一的格式：

```json
{
  "success": true,
  "data": {
    // 具体响应数据
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

错误响应：

```json
{
  "success": false,
  "error": "错误描述",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

## 🤖 OpenAI API

### 聊天完成

**端点**: `POST /api/ai/openai/chat`

**请求体**:

```json
{
  "model": "gpt-3.5-turbo",
  "messages": [
    { "role": "system", "content": "你是一个有帮助的AI助手。" },
    { "role": "user", "content": "请解释什么是机器学习。" }
  ],
  "temperature": 0.7,
  "maxTokens": 1000,
  "stream": false
}
```

**响应**:

```json
{
  "success": true,
  "data": {
    "id": "chatcmpl-123456",
    "model": "gpt-3.5-turbo",
    "choices": [
      {
        "message": {
          "role": "assistant",
          "content": "机器学习是人工智能的一个分支..."
        },
        "finish_reason": "stop"
      }
    ],
    "usage": {
      "prompt_tokens": 50,
      "completion_tokens": 150,
      "total_tokens": 200
    },
    "cost": 0.0001,
    "responseTime": 1200,
    "provider": "openai"
  }
}
```

### 文本嵌入

**端点**: `POST /api/ai/openai/embeddings`

**请求体**:

```json
{
  "input": "要嵌入的文本内容",
  "model": "text-embedding-ada-002"
}
```

### 图像生成

**端点**: `POST /api/ai/openai/images`

**请求体**:

```json
{
  "prompt": "一只可爱的小猫在花园里玩耍",
  "n": 1,
  "size": "1024x1024"
}
```

### 音频转录

**端点**: `POST /api/ai/openai/audio`

**请求体**:

```json
{
  "file": "音频文件数据",
  "model": "whisper-1",
  "language": "zh"
}
```

---

## 🧠 Claude API

### 聊天完成

**端点**: `POST /api/ai/claude/chat`

**请求体**:

```json
{
  "model": "claude-3-haiku-20240307",
  "messages": [{ "role": "user", "content": "请写一首关于技术的诗。" }],
  "system": "你是一个富有创意的诗人。",
  "temperature": 0.8,
  "maxTokens": 500
}
```

**Claude特殊参数**:

- `system`: 系统提示词（与messages中的system role不同）
- 支持更长的上下文窗口
- 更安全的响应内容

---

## 💎 Gemini API

### 聊天完成

**端点**: `POST /api/ai/gemini/chat`

**请求体**:

```json
{
  "model": "gemini-1.5-flash",
  "messages": [{ "role": "user", "content": "解释量子物理的基本概念。" }],
  "temperature": 0.7,
  "maxTokens": 2048
}
```

**Gemini特色功能**:

- 多模态支持（文本、图像、音频）
- 超长上下文（100万个token）
- Google生态集成

---

## 🔍 DeepSeek API

### 聊天完成

**端点**: `POST /api/ai/deepseek/chat`

**请求体**:

```json
{
  "model": "deepseek-chat",
  "messages": [{ "role": "user", "content": "推荐学习编程的资源。" }],
  "temperature": 0.6,
  "maxTokens": 1000
}
```

**优势**:

- **极低成本**: 每千token仅$0.00014
- **中文优化**: 对中文内容理解更佳
- **高性价比**: 适合大量使用的场景

---

## 🐉 通义千问 API

### 聊天完成

**端点**: `POST /api/ai/alibaba/chat`

**请求体**:

```json
{
  "model": "qwen-plus",
  "messages": [{ "role": "user", "content": "介绍中国的传统节日。" }],
  "temperature": 0.7,
  "maxTokens": 1200
}
```

**特色功能**:

- **中文擅长**: 对中文内容的理解和生成能力优秀
- **多语言支持**: 支持包括中文在内的多种语言
- **企业级服务**: 阿里云提供的稳定服务

---

## 📊 统计和监控API

### 获取供应商信息

**端点**: `GET /api/ai/providers`

**响应**:

```json
{
  "success": true,
  "data": [
    {
      "id": "openai",
      "name": "OpenAI",
      "status": "active",
      "models": 4,
      "endpoints": [
        "/api/ai/openai/chat",
        "/api/ai/openai/embeddings",
        "/api/ai/openai/images",
        "/api/ai/openai/audio"
      ]
    }
  ]
}
```

### 获取使用统计

**端点**: `GET /api/ai/stats`

**响应**:

```json
{
  "success": true,
  "data": {
    "providers": {
      "openai": {
        "provider": "openai",
        "name": "OpenAI",
        "requests": 150,
        "errors": 2,
        "errorRate": 0.013,
        "tokens": 45000,
        "cost": 0.045,
        "avgResponseTime": 1200
      }
    },
    "summary": {
      "totalRequests": 450,
      "totalErrors": 8,
      "totalTokens": 125000,
      "totalCost": 0.125,
      "avgResponseTime": 1100
    }
  }
}
```

### 获取单个供应商统计

**端点**: `GET /api/ai/{provider}/stats`

例如：

- `GET /api/ai/openai/stats`
- `GET /api/ai/claude/stats`
- `GET /api/ai/gemini/stats`

---

## 🎚️ 智能路由策略

frys支持多种智能路由策略，自动选择最合适的AI供应商：

### 可用策略

1. **cost-effective** (成本优化)
   - 自动选择性价比最高的供应商
   - 适合预算敏感的场景

2. **fastest** (速度优先)
   - 选择响应速度最快的供应商
   - 适合对实时性要求高的场景

3. **most-reliable** (可靠性优先)
   - 选择错误率最低的供应商
   - 适合对稳定性要求高的场景

4. **smart** (智能选择)
   - 综合考虑成本、速度、可靠性
   - 默认策略，平衡各项指标

### 使用示例

```javascript
// 成本优化路由
const costEffective = await fetch('/api/ai/route', {
  method: 'POST',
  body: JSON.stringify({
    messages: [{ role: 'user', content: '分析这份报告' }],
    strategy: 'cost-effective', // 自动选择最便宜的供应商
  }),
});

// 速度优先路由
const fastResponse = await fetch('/api/ai/route', {
  method: 'POST',
  body: JSON.stringify({
    messages: [{ role: 'user', content: '快速总结内容' }],
    strategy: 'fastest', // 自动选择最快的供应商
  }),
});
```

---

## 🔧 配置和环境变量

### 必需的环境变量

```bash
# OpenAI配置
OPENAI_API_KEY=sk-your-openai-api-key

# Claude配置
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key

# Gemini配置
GOOGLE_AI_API_KEY=your-google-ai-api-key

# DeepSeek配置
DEEPSEEK_API_KEY=sk-your-deepseek-key

# 阿里云通义千问配置
ALIBABA_API_KEY=sk-your-alibaba-key
```

### 可选配置

```bash
# 超时设置
AI_REQUEST_TIMEOUT=30000

# 重试次数
AI_MAX_RETRIES=3

# 缓存设置
AI_CACHE_TTL=3600000

# 健康检查间隔
AI_HEALTH_CHECK_INTERVAL=300000
```

---

## 🛡️ 错误处理

### 常见错误类型

1. **认证错误** (`AUTH_FAILED`)
   - API密钥无效或过期
   - 解决：检查并更新API密钥

2. **配额超限** (`RATE_LIMIT`)
   - 请求频率过高
   - 解决：降低请求频率或升级套餐

3. **服务不可用** (`SERVICE_UNAVAILABLE`)
   - AI服务暂时不可用
   - 解决：等待服务恢复或切换供应商

4. **参数错误** (`INVALID_REQUEST`)
   - 请求参数格式错误
   - 解决：检查API文档并修正参数

### 错误响应示例

```json
{
  "success": false,
  "error": "API密钥无效或过期",
  "code": "AUTH_FAILED",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

## 📈 性能优化建议

### 1. 使用合适的模型

| 场景     | 推荐模型                              | 理由             |
| -------- | ------------------------------------- | ---------------- |
| 简单对话 | `gpt-3.5-turbo` 或 `claude-3-haiku`   | 速度快，成本低   |
| 复杂推理 | `gpt-4` 或 `claude-3-sonnet`          | 推理能力强       |
| 中文内容 | `qwen-plus` 或 `deepseek-chat`        | 中文优化，成本低 |
| 大量调用 | `deepseek-chat` 或 `gemini-1.5-flash` | 高性价比         |

### 2. 优化请求参数

```javascript
// 推荐的性能参数
{
  "temperature": 0.7,      // 平衡创造性和一致性
  "maxTokens": 1000,       // 根据需求设置合适的长度
  "stream": false          // 非必要不开启流式输出
}
```

### 3. 实现缓存策略

```javascript
// 缓存相似请求的结果
const cache = new Map();

function getCachedResponse(key, request) {
  if (cache.has(key)) {
    return cache.get(key);
  }

  // 执行实际请求
  const result = await makeAIRequest(request);

  // 缓存结果（5分钟过期）
  cache.set(key, result);
  setTimeout(() => cache.delete(key), 5 * 60 * 1000);

  return result;
}
```

---

## 🔒 安全和隐私

### 数据保护

1. **传输加密**: 所有API调用使用HTTPS
2. **API密钥隔离**: 密钥安全存储，不在日志中暴露
3. **请求审计**: 记录API调用日志用于安全审计
4. **访问控制**: 支持基于角色的访问控制

### 最佳实践

```javascript
// 安全使用建议
const securityTips = {
  // 1. 不要在客户端直接使用API密钥
  apiKey: process.env.AI_API_KEY, // 服务端环境变量

  // 2. 实现请求频率限制
  rateLimit: {
    maxRequests: 100,
    windowMs: 60000, // 1分钟
  },

  // 3. 验证用户输入
  validateInput: (input) => {
    // 防止提示注入攻击
    return input.replace(/[<>\"'&]/g, '');
  },

  // 4. 监控异常行为
  monitorRequests: (request) => {
    if (request.prompt.length > 10000) {
      // 记录可疑请求
      logSecurityEvent('LONG_PROMPT', request);
    }
  },
};
```

---

## 📚 完整示例代码

查看完整的API使用示例：

- **[examples/ai-api-usage-examples.js](examples/ai-api-usage-examples.js)** - 详细的代码示例
- **[examples/ai-provider-integration.js](examples/ai-provider-integration.js)** - 集成使用指南

运行示例：

```bash
# 运行所有示例
node examples/ai-api-usage-examples.js

# 或运行特定示例
node -e "
import { example2_openAIChat } from './examples/ai-api-usage-examples.js';
example2_openAIChat();
"
```

---

## 🎯 常见问题解答

### Q: 如何选择合适的AI供应商？

**A**: 根据您的使用场景选择：

- **预算有限**: DeepSeek 或 Gemini
- **中文内容**: 通义千问或DeepSeek
- **高可靠性**: OpenAI 或 Claude
- **快速响应**: GPT-3.5-turbo 或 Gemini Flash

### Q: 支持哪些编程语言？

**A**: frys提供RESTful API，可以用任何编程语言调用：

- JavaScript/Node.js
- Python
- Java
- Go
- PHP
- 等

### Q: 如何处理API限流？

**A**: frys内置了智能限流处理：

1. 自动重试机制
2. 请求排队处理
3. 多供应商降级
4. 客户端可以实现自己的限流逻辑

### Q: 数据会如何处理？

**A**: 严格保护用户隐私：

- 请求数据仅用于处理，不会被存储
- 响应数据可选择是否缓存
- 支持GDPR等隐私保护标准
- 提供数据导出和删除功能

---

## 🔗 相关链接

- **[项目主页](https://github.com/zycxfyh/frys)** - GitHub仓库
- **[API文档](http://localhost:3000/api/docs)** - 在线API文档
- **[使用示例](examples/)** - 完整代码示例
- **[配置指南](ai-provider-management.md)** - 详细配置说明

---

## 💬 支持与反馈

遇到问题或需要帮助？

- 🐛 **问题反馈**: [GitHub Issues](https://github.com/zycxfyh/frys/issues)
- 💬 **讨论交流**: [GitHub Discussions](https://github.com/zycxfyh/frys/discussions)
- 📧 **邮箱联系**: 1666384464@qq.com
- 📖 **文档更新**: 持续更新和完善

---

_最后更新: 2025年11月7日_
