# 🚀 frys 示例和演示

<div align="center">

## 📚 代码示例和演示应用

**从简单到复杂的完整使用示例**

[🏠 返回项目主页](../README.md) • [📖 文档导航](../docs/README.md) • [🚀 快速开始](../GETTING_STARTED.md)

---

</div>

## 📋 示例概览

### 按复杂度分类

| 复杂度 | 适用场景 | 示例数量 | 推荐顺序 |
|--------|----------|----------|----------|
| **🟢 入门级** | 新手学习 | 3个 | 1-3 |
| **🟡 中级** | 功能集成 | 4个 | 4-7 |
| **🔴 高级** | 生产应用 | 3个 | 8-10 |

### 按功能分类

| 功能领域 | 示例文件 | 说明 |
|----------|----------|------|
| **🤖 AI 集成** | `ai-*.js/html` | AI 供应商集成和使用 |
| **⚙️ 工作流** | `workflow-*.js` | 工作流创建和执行 |
| **🔧 系统集成** | `*-integration.js` | 第三方服务集成 |
| **🎨 前端演示** | `*.html` | Web 界面演示 |

---

## 🎯 快速开始示例

### 1. 基础工作流示例

```javascript
// examples/workflow-basics.js
import { WorkflowEngine } from 'frys';

// 创建工作流引擎
const engine = new WorkflowEngine();

// 定义简单的工作流
const simpleWorkflow = {
  id: 'hello-world',
  name: 'Hello World 工作流',
  steps: [
    {
      id: 'greet',
      name: '发送问候',
      type: 'log',
      config: {
        message: 'Hello, frys!'
      }
    }
  ]
};

// 注册并执行工作流
await engine.registerWorkflow(simpleWorkflow);
const result = await engine.executeWorkflow('hello-world');

console.log('执行结果:', result);
```

### 2. 用户认证示例

```javascript
// examples/auth-basics.js
import { UserService, AuthService } from 'frys';

// 初始化服务
const userService = new UserService();
const authService = new AuthService();

// 用户注册
const user = await userService.createUser({
  email: 'user@example.com',
  password: 'securePassword123!',
  name: '示例用户'
});

// 用户登录
const tokens = await authService.login({
  email: 'user@example.com',
  password: 'securePassword123!'
});

console.log('登录成功:', tokens);
```

### 3. REST API 调用示例

```javascript
// examples/api-basics.js
import axios from 'axios';

// 配置 API 客户端
const api = axios.create({
  baseURL: 'http://localhost:3000/api/v1',
  timeout: 10000
});

// 获取工作流列表
async function getWorkflows() {
  try {
    const response = await api.get('/workflows');
    return response.data.data;
  } catch (error) {
    console.error('获取工作流失败:', error.message);
  }
}

// 创建新工作流
async function createWorkflow(workflowData) {
  try {
    const response = await api.post('/workflows', workflowData);
    return response.data.data;
  } catch (error) {
    console.error('创建工作流失败:', error.message);
  }
}

// 执行工作流
async function executeWorkflow(workflowId, input) {
  try {
    const response = await api.post(`/workflows/${workflowId}/execute`, {
      input
    });
    return response.data.data;
  } catch (error) {
    console.error('执行工作流失败:', error.message);
  }
}

export { getWorkflows, createWorkflow, executeWorkflow };
```

---

## 📁 示例文件详解

### 🤖 AI 相关示例

#### 1. `ai-api-usage-examples.js`
**AI API 基础使用示例**

```javascript
// 展示如何使用不同的 AI 供应商
import { AIProviderManager } from 'frys';

const aiManager = new AIProviderManager();

// 注册多个 AI 供应商
await aiManager.registerProvider({
  id: 'openai',
  type: 'openai',
  apiKey: process.env.OPENAI_API_KEY
});

await aiManager.registerProvider({
  id: 'claude',
  type: 'anthropic',
  apiKey: process.env.ANTHROPIC_API_KEY
});

// 智能路由调用
const response = await aiManager.route({
  model: 'gpt-4',
  messages: [{ role: 'user', content: '解释什么是机器学习' }],
  strategy: 'cost-effective'  // 自动选择最便宜的供应商
});

console.log('AI 回复:', response.choices[0].message.content);
```

#### 2. `ai-provider-integration.js`
**AI 供应商集成示例**

```javascript
// 完整的供应商配置和切换逻辑
import { AIProviderManager } from 'frys';

class EnterpriseAIService {
  constructor() {
    this.aiManager = new AIProviderManager({
      cacheTTL: 3600000,      // 1小时缓存
      maxRetries: 3,          // 最大重试3次
      timeout: 30000,         // 30秒超时
      healthCheckInterval: 300000  // 5分钟健康检查
    });
  }

  async initialize() {
    // 配置多个供应商确保高可用
    const providers = [
      {
        id: 'openai-primary',
        type: 'openai',
        apiKey: process.env.OPENAI_API_KEY,
        priority: 1
      },
      {
        id: 'claude-backup',
        type: 'anthropic',
        apiKey: process.env.ANTHROPIC_API_KEY,
        priority: 2
      },
      {
        id: 'deepseek-fallback',
        type: 'deepseek',
        apiKey: process.env.DEEPSEEK_API_KEY,
        priority: 3
      }
    ];

    for (const provider of providers) {
      await this.aiManager.registerProvider(provider);
    }
  }

  async processRequest(userRequest, options = {}) {
    return await this.aiManager.route({
      model: options.model || 'gpt-4',
      messages: [{ role: 'user', content: userRequest }],
      strategy: options.urgent ? 'fastest' : 'cost-effective',
      fallback: true,
      temperature: 0.7
    });
  }
}

export default EnterpriseAIService;
```

#### 3. `ai-provider-demo.html`
**AI 供应商 Web 演示界面**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>frys AI 演示</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .chat-container { max-width: 800px; margin: 0 auto; }
        .message { margin: 10px 0; padding: 10px; border-radius: 5px; }
        .user { background: #007bff; color: white; margin-left: 100px; }
        .ai { background: #f8f9fa; margin-right: 100px; }
        #input { width: 100%; padding: 10px; margin-top: 10px; }
        button { padding: 10px 20px; margin-top: 10px; }
    </style>
</head>
<body>
    <div class="chat-container">
        <h1>frys AI 聊天演示</h1>
        <div id="chat"></div>
        <input type="text" id="input" placeholder="输入您的问题...">
        <button onclick="sendMessage()">发送</button>
        <select id="strategy">
            <option value="cost-effective">成本优化</option>
            <option value="fastest">速度优先</option>
            <option value="most-reliable">可靠性优先</option>
        </select>
    </div>

    <script>
        const chat = document.getElementById('chat');
        const input = document.getElementById('input');
        const strategy = document.getElementById('strategy');

        async function sendMessage() {
            const message = input.value.trim();
            if (!message) return;

            // 显示用户消息
            addMessage(message, 'user');
            input.value = '';

            try {
                const response = await fetch('/api/ai/chat', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        message: message,
                        strategy: strategy.value
                    })
                });

                const data = await response.json();
                addMessage(data.response, 'ai');
            } catch (error) {
                addMessage('抱歉，发生了错误，请稍后再试。', 'ai');
            }
        }

        function addMessage(text, type) {
            const div = document.createElement('div');
            div.className = `message ${type}`;
            div.textContent = text;
            chat.appendChild(div);
            chat.scrollTop = chat.scrollHeight;
        }

        // 回车发送消息
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    </script>
</body>
</html>
```

### ⚙️ 工作流示例

#### 4. `workflow-advanced.js`
**高级工作流示例**

```javascript
// 复杂的业务流程工作流
import { WorkflowEngine } from 'frys';

const engine = new WorkflowEngine();

// 电商订单处理工作流
const orderProcessingWorkflow = {
  id: 'order-processing',
  name: '订单处理流程',
  description: '完整的电商订单处理流程',

  steps: [
    // 1. 订单验证
    {
      id: 'validate-order',
      name: '验证订单信息',
      type: 'validation',
      config: {
        schema: {
          orderId: 'required|string',
          customerId: 'required|string',
          items: 'required|array|min:1',
          total: 'required|number|min:0'
        }
      }
    },

    // 2. 库存检查
    {
      id: 'check-inventory',
      name: '检查商品库存',
      type: 'parallel',
      config: {
        steps: [
          {
            id: 'check-item-1',
            name: '检查商品1库存',
            type: 'service',
            config: {
              service: 'inventoryService',
              method: 'checkStock',
              parameters: {
                itemId: '${input.items[0].id}',
                quantity: '${input.items[0].quantity}'
              }
            }
          }
          // 为每个商品项创建库存检查步骤...
        ]
      }
    },

    // 3. 支付处理
    {
      id: 'process-payment',
      name: '处理支付',
      type: 'service',
      config: {
        service: 'paymentService',
        method: 'charge',
        parameters: {
          amount: '${input.total}',
          currency: 'CNY',
          orderId: '${input.orderId}'
        }
      }
    },

    // 4. 物流安排
    {
      id: 'arrange-shipping',
      name: '安排发货',
      type: 'condition',
      config: {
        expression: '${input.shippingMethod} === "express"',
        trueStep: 'express-shipping',
        falseStep: 'standard-shipping'
      }
    },

    // 5. 发送通知
    {
      id: 'send-notifications',
      name: '发送通知',
      type: 'parallel',
      config: {
        steps: [
          {
            id: 'email-notification',
            name: '发送邮件通知',
            type: 'service',
            config: {
              service: 'emailService',
              method: 'sendOrderConfirmation',
              parameters: {
                to: '${customer.email}',
                orderId: '${input.orderId}',
                items: '${input.items}'
              }
            }
          },
          {
            id: 'sms-notification',
            name: '发送短信通知',
            type: 'service',
            config: {
              service: 'smsService',
              method: 'sendOrderNotification',
              parameters: {
                phone: '${customer.phone}',
                orderId: '${input.orderId}'
              }
            }
          }
        ]
      }
    }
  ],

  // 错误处理
  errorHandling: {
    onError: 'compensate-transactions',
    retryPolicy: {
      maxAttempts: 3,
      backoff: 'exponential',
      initialDelay: '1s'
    }
  },

  // 补偿逻辑
  compensation: {
    'process-payment': {
      action: 'refund',
      service: 'paymentService.refund'
    },
    'arrange-shipping': {
      action: 'cancel-shipment',
      service: 'shippingService.cancel'
    }
  }
};

// 注册工作流
await engine.registerWorkflow(orderProcessingWorkflow);

// 执行订单处理
const result = await engine.executeWorkflow('order-processing', {
  orderId: 'ORDER-2025-001',
  customerId: 'CUSTOMER-123',
  items: [
    { id: 'ITEM-001', name: 'iPhone 15', quantity: 1, price: 5999 },
    { id: 'ITEM-002', name: '保护壳', quantity: 1, price: 99 }
  ],
  total: 6098,
  shippingMethod: 'express'
});

console.log('订单处理完成:', result);
```

### 🔧 系统集成示例

#### 5. `auto-scaling-integration.js`
**自动扩缩容集成示例**

```javascript
// 与云服务提供商的自动扩缩容集成
import { AutoScalingManager } from 'frys';

class CloudAutoScalingIntegration {
  constructor() {
    this.scalingManager = new AutoScalingManager({
      provider: 'aws', // 支持 aws, azure, gcp
      region: 'us-east-1',
      minInstances: 2,
      maxInstances: 20,
      targetCPUUtilization: 70,
      targetMemoryUtilization: 80
    });

    this.monitoring = new MonitoringService();
  }

  async initialize() {
    // 设置监控指标
    await this.setupMonitoring();

    // 配置扩缩容策略
    await this.configureScalingPolicies();

    // 启动自动扩缩容
    await this.startAutoScaling();
  }

  async setupMonitoring() {
    // 配置 CloudWatch 指标
    await this.monitoring.createMetrics([
      {
        name: 'CPUUtilization',
        namespace: 'AWS/EC2',
        dimensions: [{ name: 'AutoScalingGroupName', value: 'frys-asg' }]
      },
      {
        name: 'MemoryUtilization',
        namespace: 'System/Linux',
        dimensions: [{ name: 'InstanceId', value: '*' }]
      },
      {
        name: 'RequestCount',
        namespace: 'frys/Application',
        dimensions: [{ name: 'Service', value: 'api' }]
      }
    ]);
  }

  async configureScalingPolicies() {
    const policies = [
      {
        name: 'cpu-scaling-policy',
        type: 'TargetTrackingScaling',
        targetValue: 70,
        predefinedMetricType: 'ASGAverageCPUUtilization'
      },
      {
        name: 'memory-scaling-policy',
        type: 'TargetTrackingScaling',
        targetValue: 80,
        customizedMetricSpecification: {
          metricName: 'MemoryUtilization',
          namespace: 'System/Linux',
          statistic: 'Average'
        }
      },
      {
        name: 'request-scaling-policy',
        type: 'TargetTrackingScaling',
        targetValue: 1000,
        customizedMetricSpecification: {
          metricName: 'RequestCountPerTarget',
          namespace: 'AWS/ApplicationELB',
          statistic: 'Sum'
        }
      }
    ];

    for (const policy of policies) {
      await this.scalingManager.createPolicy(policy);
    }
  }

  async startAutoScaling() {
    // 启动指标收集
    await this.monitoring.startCollection();

    // 启用扩缩容策略
    await this.scalingManager.enablePolicies();

    console.log('自动扩缩容系统已启动');
  }

  // 手动扩缩容
  async scaleTo(desiredCapacity) {
    await this.scalingManager.setDesiredCapacity(desiredCapacity);
  }

  // 获取当前状态
  async getStatus() {
    const metrics = await this.monitoring.getCurrentMetrics();
    const scalingStatus = await this.scalingManager.getStatus();

    return {
      metrics,
      scaling: scalingStatus,
      recommendations: await this.generateRecommendations(metrics)
    };
  }

  async generateRecommendations(metrics) {
    const recommendations = [];

    if (metrics.cpu > 85) {
      recommendations.push({
        type: 'scale-out',
        reason: 'CPU 使用率过高',
        suggestedCapacity: Math.ceil(metrics.currentCapacity * 1.5)
      });
    }

    if (metrics.memory > 90) {
      recommendations.push({
        type: 'scale-out',
        reason: '内存使用率过高',
        suggestedCapacity: Math.ceil(metrics.currentCapacity * 1.3)
      });
    }

    if (metrics.cpu < 30 && metrics.memory < 40) {
      recommendations.push({
        type: 'scale-in',
        reason: '资源利用率低',
        suggestedCapacity: Math.max(2, Math.floor(metrics.currentCapacity * 0.8))
      });
    }

    return recommendations;
  }
}

export default CloudAutoScalingIntegration;
```

---

## 🎮 在线演示

### Web 演示界面

访问以下演示页面体验 frys 的功能：

- **AI 聊天演示**: `ai-provider-demo.html`
- **工作流设计器**: `visual-designer-demo.html`
- **VCP 系统演示**: `vcp-system-demo.js`

### 本地运行演示

```bash
# 1. 启动后端服务
npm run dev

# 2. 在浏览器中打开演示页面
open examples/ai-provider-demo.html

# 或者使用本地服务器
npx http-server examples -p 8080
# 访问 http://localhost:8080/ai-provider-demo.html
```

---

## 🛠️ 运行和测试示例

### 环境准备

```bash
# 1. 安装依赖
npm install

# 2. 启动 Redis
redis-server

# 3. 配置环境变量
cp .env.example .env

# 4. 启动应用
npm run dev
```

### 运行单个示例

```bash
# 运行 JavaScript 示例
node examples/workflow-basics.js

# 运行 AI 示例（需要 API 密钥）
node examples/ai-api-usage-examples.js
```

### 测试示例

```bash
# 运行所有示例测试
npm run test:examples

# 运行特定示例测试
npm run test -- examples/workflow-basics.test.js
```

---

## 📚 示例学习路径

### 🟢 初学者路径

1. **基础概念** → `workflow-basics.js`
2. **API 调用** → `api-basics.js`
3. **用户管理** → 查看认证相关示例

### 🟡 中级开发者路径

1. **工作流设计** → `workflow-advanced.js`
2. **AI 集成** → `ai-provider-integration.js`
3. **系统集成** → `auto-scaling-integration.js`

### 🔴 高级开发者路径

1. **架构设计** → `vcp-system-demo.js`
2. **性能优化** → 监控和缓存示例
3. **生产部署** → 完整的生产环境配置

---

## 🤝 贡献示例

### 添加新示例

1. **选择合适的分类**（基础/高级/集成）
2. **遵循命名规范**（`feature-example.js`）
3. **添加详细注释**
4. **包含错误处理**
5. **提供使用说明**

### 示例模板

```javascript
/**
 * 示例名称
 * 简要描述这个示例的目的和功能
 */

import { ServiceName } from 'frys';

// 配置和初始化
const service = new ServiceName({
  // 配置选项
});

// 主要功能演示
async function demonstrateFeature() {
  try {
    // 示例代码
    const result = await service.doSomething();

    console.log('执行结果:', result);
    return result;
  } catch (error) {
    console.error('执行失败:', error);
    throw error;
  }
}

// 导出主要函数
export { demonstrateFeature };

// 如果是可执行文件
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateFeature().catch(console.error);
}
```

---

## 📊 示例统计

| 分类 | 文件数量 | 代码行数 | 覆盖功能 |
|------|----------|----------|----------|
| **AI 集成** | 4 | ~800 | OpenAI, Claude, 路由策略 |
| **工作流** | 2 | ~400 | 基础/高级工作流 |
| **系统集成** | 2 | ~600 | 扩缩容、监控 |
| **演示界面** | 2 | ~300 | Web 界面 |
| **工具脚本** | 1 | ~200 | 开发工具 |

---

## 🔗 相关资源

- **[快速开始](../GETTING_STARTED.md)** - 基础使用指南
- **[API 文档](../docs/api/README.md)** - 完整的接口文档
- **[开发者指南](../docs/development/README.md)** - 开发环境设置
- **[部署指南](../docs/deployment/production-setup.md)** - 生产环境部署

---

<div align="center">

## 🎉 开始探索示例！

**通过这些示例快速掌握 frys 的强大功能**

[🏠 返回项目主页](../README.md) • [📖 查看完整文档](../docs/README.md) • [🚀 快速开始](../GETTING_STARTED.md)

---

*最后更新: 2025年11月7日*

</div>
