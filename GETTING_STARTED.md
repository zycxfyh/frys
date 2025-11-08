# 🚀 快速开始 - frys 工作流管理系统

<div align="center">

## ⚡ 五分钟上手指南

**从零开始，快速搭建和使用 frys 工作流平台**

[🏠 返回项目主页](README.md) • [📖 完整文档](docs/) • [🐛 问题反馈](https://github.com/zycxfyh/frys/issues)

---

</div>

## 📋 前置要求

### 系统要求

<div align="center">

|    🖥️ **组件**    | 📋 **版本要求** |   💡 **用途说明**   | ✅ **必需性** |
| :---------------: | :-------------: | :-----------------: | :-----------: |
|  🟢 **Node.js**   |   `>= 16.0.0`   | JavaScript 运行环境 |   **必须**    |
|   🔴 **Redis**    |    `>= 6.0`     |   缓存和消息队列    |   **必须**    |
|   🐳 **Docker**   |    `>= 20.0`    |     容器化部署      |     可选      |
| 🐘 **PostgreSQL** |    `>= 12.0`    |    关系型数据库     |     可选      |

</div>

### 🔍 环境检查

```bash
# 检查 Node.js 版本
node --version

# 检查 npm 版本
npm --version

# 检查 Docker 版本（可选）
docker --version

# 检查 Git 版本
git --version
```

---

## 📦 安装方式

### 方法一：NPM 一键安装 (推荐)

```bash
# 全局安装 frys CLI 工具
npm install -g frys-cli

# 创建新的 frys 项目
frys create my-workflow-app

# 进入项目目录
cd my-workflow-app

# 启动开发服务器
frys dev
```

### 方法二：源码手动安装

```bash
# 克隆项目源码
git clone https://github.com/zycxfyh/frys.git
cd frys

# 安装项目依赖
npm install

# 复制环境配置模板
cp .env.example .env

# 编辑环境配置（可选）
# nano .env
```

### 方法三：Docker 容器化部署

```bash
# 使用 Docker Compose
docker-compose -f config/docker/docker-compose.dev.yml up -d

# 或者直接运行容器
docker run -d \
  --name frys-app \
  -p 3000:3000 \
  -e NODE_ENV=development \
  -e REDIS_URL=redis://host.docker.internal:6379 \
  frys:latest
```

---

## ⚙️ 环境配置

### 基础配置

创建 `.env` 文件并配置以下环境变量：

```bash
# ===================
# 核心配置
# ===================
NODE_ENV=development
PORT=3000
HOST=localhost

# ===================
# 数据库配置 (可选)
# ===================
DATABASE_URL=postgresql://username:password@localhost:5432/frys_db
DB_SSL=false
DB_MAX_CONNECTIONS=20

# ===================
# Redis 配置 (必需)
# ===================
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=
REDIS_DB=0

# ===================
# JWT 认证配置
# ===================
JWT_SECRET=your-super-secure-jwt-secret-key-here
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d

# ===================
# 监控配置 (可选)
# ===================
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
SENTRY_ENVIRONMENT=development
SENTRY_TRACES_SAMPLE_RATE=0.1
```

### Redis 启动

```bash
# 使用 Docker 启动 Redis
docker run -d \
  --name redis-frys \
  -p 6379:6379 \
  redis:7-alpine

# 或者本地安装 Redis
# macOS
brew install redis
brew services start redis

# Ubuntu/Debian
sudo apt update
sudo apt install redis-server
sudo systemctl start redis-server
```

---

## ▶️ 运行应用

### 开发环境

```bash
# 使用热重载启动开发服务器
npm run dev

# 或者使用 frys CLI
frys dev --port 3000 --host localhost
```

### 生产环境

```bash
# 构建生产版本
npm run build

# 启动生产服务器
npm start

# 或者使用 PM2 进程管理
npm install -g pm2
pm2 start dist/index.js --name frys-production
pm2 save
pm2 startup
```

### Docker 容器

```bash
# 构建 Docker 镜像
docker build -t frys:latest .

# 运行容器实例
docker run -d \
  --name frys-app \
  -p 3000:3000 \
  -e REDIS_URL=redis://host.docker.internal:6379 \
  -e NODE_ENV=production \
  frys:latest
```

---

## ✅ 部署验证

```bash
# 健康检查
curl -X GET http://localhost:3000/health

# API 信息查询
curl -X GET http://localhost:3000/api/v1/info

# 工作流状态检查
curl -X GET http://localhost:3000/api/v1/workflows/status

# 查看应用日志
tail -f logs/frys.log
```

---

## 🎮 基本使用

### 1. 创建第一个工作流

```javascript
import { WorkflowEngine } from 'frys';

// 初始化工作流引擎
const workflowEngine = new WorkflowEngine();

// 定义用户注册工作流
const userRegistrationWorkflow = {
  id: 'user-registration-flow',
  name: '用户注册和激活流程',
  version: '1.0.0',
  description: '完整的用户注册到激活的工作流',

  steps: [
    {
      id: 'validate-input',
      name: '验证用户输入',
      type: 'validation',
      config: {
        rules: {
          email: 'required|email',
          password: 'required|min:8',
          confirmPassword: 'required|same:password',
        },
      },
    },
    {
      id: 'create-user',
      name: '创建用户账户',
      type: 'service',
      config: {
        service: 'userService',
        method: 'createUser',
        parameters: {
          email: '${input.email}',
          password: '${input.password}',
        },
      },
    },
    {
      id: 'send-welcome-email',
      name: '发送欢迎邮件',
      type: 'notification',
      config: {
        type: 'email',
        template: 'welcome',
        to: '${input.email}',
        subject: '欢迎加入 frys！',
      },
    },
  ],
};

// 注册工作流
await workflowEngine.registerWorkflow(userRegistrationWorkflow);

console.log('✅ 工作流创建成功！');
```

### 2. 执行工作流

```javascript
// 执行工作流
const executionResult = await workflowEngine.executeWorkflow(
  'user-registration-flow',
  {
    email: 'john.doe@example.com',
    password: 'SecurePass123!',
    confirmPassword: 'SecurePass123!',
  },
);

console.log('🎉 工作流执行完成！');
console.log('执行结果:', executionResult);
```

### 3. 监听执行状态

```javascript
// 监听工作流执行事件
workflowEngine.on('workflow.completed', (event) => {
  console.log('✅ 工作流执行完成:', event.workflowId);
  console.log('执行结果:', event.result);
});

workflowEngine.on('workflow.failed', (event) => {
  console.error('❌ 工作流执行失败:', event.workflowId);
  console.error('错误信息:', event.error);
});

workflowEngine.on('step.completed', (event) => {
  console.log(`✅ 步骤完成: ${event.stepId} (${event.executionTime}ms)`);
});
```

---

## 🚀 高级功能

### 条件分支工作流

```javascript
const approvalWorkflow = {
  id: 'purchase-approval',
  name: '采购审批流程',
  steps: [
    {
      id: 'submit-request',
      name: '提交申请',
      type: 'manual-input',
      config: {
        fields: [
          { name: 'amount', type: 'number', required: true },
          { name: 'description', type: 'text', required: true },
        ],
      },
    },
    {
      id: 'auto-check',
      name: '自动审批检查',
      type: 'condition',
      config: {
        expression: 'input.amount <= 1000',
        trueStep: 'auto-approve',
        falseStep: 'manager-approval',
      },
    },
    {
      id: 'auto-approve',
      name: '自动批准',
      type: 'service',
      config: {
        service: 'approvalService',
        method: 'autoApprove',
      },
    },
    {
      id: 'manager-approval',
      name: '经理审批',
      type: 'manual-approval',
      config: {
        approverRole: 'manager',
        timeout: '72h',
      },
    },
  ],
};
```

### 并行执行工作流

```javascript
const dataProcessingWorkflow = {
  id: 'data-processing',
  name: '数据并行处理',
  steps: [
    {
      id: 'data-ingestion',
      name: '数据导入',
      type: 'data-import',
      config: {
        source: 's3://data-bucket/input/',
        format: 'json',
      },
    },
    {
      id: 'parallel-processing',
      name: '并行处理',
      type: 'parallel',
      config: {
        steps: [
          {
            id: 'validate-data',
            name: '数据验证',
            type: 'data-validation',
            config: { schema: 'data-schema.json' },
          },
          {
            id: 'enrich-data',
            name: '数据增强',
            type: 'data-enrichment',
            config: { apis: ['geocoding', 'weather'] },
          },
          {
            id: 'generate-report',
            name: '生成报告',
            type: 'report-generation',
            config: { template: 'summary-report' },
          },
        ],
        maxConcurrency: 5,
      },
    },
    {
      id: 'send-notification',
      name: '发送通知',
      type: 'notification',
      config: {
        type: 'email',
        to: 'team@example.com',
        subject: '数据处理完成',
        template: 'processing-complete',
      },
    },
  ],
};
```

---

## 🌐 REST API 使用

### 认证和授权

```bash
# 用户注册
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!",
    "name": "John Doe"
  }'

# 用户登录
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!"
  }'

# 使用 Bearer Token 调用 API
curl -X GET http://localhost:3000/api/v1/workflows \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### 工作流管理

```bash
# 创建工作流
curl -X POST http://localhost:3000/api/v1/workflows \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "订单处理流程",
    "description": "电商订单处理",
    "steps": [
      {
        "id": "validate-order",
        "name": "验证订单",
        "type": "validation"
      },
      {
        "id": "process-payment",
        "name": "处理支付",
        "type": "payment"
      }
    ]
  }'

# 执行工作流
curl -X POST http://localhost:3000/api/v1/workflows/{workflowId}/execute \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "orderId": "12345",
      "amount": 299.99
    }
  }'

# 获取执行状态
curl -X GET http://localhost:3000/api/v1/workflows/executions/{executionId} \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 🔧 前端集成

### React 应用集成

```jsx
import React, { useState, useEffect } from 'react';
import { WorkflowDesigner, WorkflowExecutor } from 'frys-react';

function WorkflowApp() {
  const [workflows, setWorkflows] = useState([]);
  const [currentWorkflow, setCurrentWorkflow] = useState(null);
  const [executionResult, setExecutionResult] = useState(null);

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const fetchWorkflows = async () => {
    try {
      const response = await fetch('/api/v1/workflows');
      const data = await response.json();
      setWorkflows(data.workflows);
    } catch (error) {
      console.error('加载工作流失败:', error);
    }
  };

  const executeWorkflow = async (workflowId, inputData) => {
    try {
      const response = await fetch(`/api/v1/workflows/${workflowId}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ input: inputData }),
      });

      const result = await response.json();
      setExecutionResult(result);

      // 实时监听执行状态
      const eventSource = new EventSource(
        `/api/v1/workflows/executions/${result.executionId}/events`,
      );
      eventSource.onmessage = (event) => {
        const update = JSON.parse(event.data);
        setExecutionResult((prev) => ({ ...prev, ...update }));
      };
    } catch (error) {
      console.error('执行工作流失败:', error);
    }
  };

  return (
    <div className="workflow-app">
      <h1>frys 工作流平台</h1>

      <div className="workflow-list">
        <h2>我的工作流</h2>
        {workflows.map((workflow) => (
          <div key={workflow.id} className="workflow-card">
            <h3>{workflow.name}</h3>
            <p>{workflow.description}</p>
            <button onClick={() => executeWorkflow(workflow.id, {})}>
              执行工作流
            </button>
          </div>
        ))}
      </div>

      <WorkflowDesigner
        onSave={(workflow) => {
          fetch('/api/v1/workflows', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(workflow),
          });
        }}
      />

      {executionResult && (
        <div className="execution-result">
          <h3>执行结果</h3>
          <pre>{JSON.stringify(executionResult, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

export default WorkflowApp;
```

### Vue.js 应用集成

```vue
<template>
  <div class="workflow-app">
    <header>
      <h1>frys 工作流管理系统</h1>
      <nav>
        <router-link to="/workflows">工作流列表</router-link>
        <router-link to="/designer">工作流设计器</router-link>
        <router-link to="/executions">执行历史</router-link>
      </nav>
    </header>

    <main>
      <router-view
        :workflows="workflows"
        :executions="executions"
        @execute-workflow="handleExecuteWorkflow"
        @save-workflow="handleSaveWorkflow"
      />
    </main>
  </div>
</template>

<script>
import { WorkflowService } from 'frys-vue';

export default {
  name: 'App',
  data() {
    return {
      workflows: [],
      executions: [],
    };
  },
  async created() {
    this.workflowService = new WorkflowService({
      baseURL: process.env.VUE_APP_API_URL,
      token: localStorage.getItem('authToken'),
    });

    await this.loadWorkflows();
    await this.loadExecutions();
  },
  methods: {
    async loadWorkflows() {
      try {
        this.workflows = await this.workflowService.getWorkflows();
      } catch (error) {
        this.$toast.error('加载工作流失败');
      }
    },

    async loadExecutions() {
      try {
        this.executions = await this.workflowService.getExecutions();
      } catch (error) {
        this.$toast.error('加载执行历史失败');
      }
    },

    async handleExecuteWorkflow(workflowId, inputData) {
      try {
        const result = await this.workflowService.executeWorkflow(
          workflowId,
          inputData,
        );
        this.$toast.success('工作流执行成功');
        await this.loadExecutions();
      } catch (error) {
        this.$toast.error('工作流执行失败');
      }
    },

    async handleSaveWorkflow(workflowData) {
      try {
        await this.workflowService.saveWorkflow(workflowData);
        this.$toast.success('工作流保存成功');
        await this.loadWorkflows();
      } catch (error) {
        this.$toast.error('工作流保存失败');
      }
    },
  },
};
</script>
```

---

## 🔧 故障排除

### 常见问题

#### 1. Redis 连接失败

```bash
# 检查 Redis 是否运行
redis-cli ping

# 如果使用 Docker，确保容器正在运行
docker ps | grep redis

# 检查 Redis 配置
docker exec -it redis-frys redis-cli
CONFIG GET bind
CONFIG GET protected-mode
```

#### 2. 端口被占用

```bash
# 检查端口占用
lsof -i :3000

# 杀死占用进程
kill -9 <PID>

# 或者使用不同端口
PORT=3001 npm run dev
```

#### 3. 依赖安装失败

```bash
# 清理缓存重新安装
rm -rf node_modules package-lock.json
npm cache clean --force
npm install

# 使用国内镜像
npm config set registry https://registry.npmmirror.com
npm install
```

#### 4. 数据库连接问题

```bash
# 检查 PostgreSQL 是否运行
pg_isready -h localhost -p 5432

# 如果使用 Docker
docker ps | grep postgres

# 检查连接字符串
psql "postgresql://username:password@localhost:5432/frys_db" -c "SELECT 1;"
```

### 调试模式

```bash
# 启用调试日志
DEBUG=frys:* npm run dev

# 查看详细错误信息
NODE_ENV=development DEBUG=* npm run dev

# 检查应用健康状态
curl -v http://localhost:3000/health
```

---

## 📚 下一步

### 🎯 深入学习

1. **[完整文档](docs/)** - 详细的技术文档和 API 参考
2. **[架构设计](docs/architecture/)** - 深入理解系统设计理念
3. **[部署指南](docs/deployment/)** - 生产环境部署和运维
4. **[测试策略](docs/testing/)** - 质量保障和测试实践

### 🚀 高级功能

- **[AI 集成](docs/modules/ai-provider-management.md)** - 多供应商 AI 智能路由
- **[监控告警](docs/deployment/devops.md)** - 可观测性和运维监控
- **[扩展开发](docs/modules/core-modules.md)** - 插件开发和功能扩展

### 🤝 社区支持

- **[问题反馈](https://github.com/zycxfyh/frys/issues)** - 报告 bug 和提出建议
- **[社区讨论](https://github.com/zycxfyh/frys/discussions)** - 交流经验和最佳实践
- **[贡献指南](CONTRIBUTING.md)** - 参与项目开发

---

<div align="center">

## 🎉 恭喜！您已经成功启动 frys

**现在您可以开始创建和执行您的工作流了！**

[🏠 返回项目主页](README.md) • [📖 查看完整文档](docs/) • [🚀 探索示例代码](examples/)

---

_最后更新: 2025年11月_

</div>
