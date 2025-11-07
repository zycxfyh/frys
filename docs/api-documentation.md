# frys API 文档

## 概述

frys 是一个企业级轻量化工作流管理系统。本文档描述了系统的所有API接口，包括用户管理、工作流管理、监控和健康检查等功能。

## 基础信息

- **基础URL**: `http://localhost:3000` (开发环境)
- **认证方式**: JWT Bearer Token
- **数据格式**: JSON
- **字符编码**: UTF-8

## 认证

### 获取访问令牌

```http
POST /auth/login
Content-Type: application/json

{
  "username": "string",
  "password": "string"
}
```

**响应示例:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 3600,
    "tokenType": "Bearer"
  },
  "timestamp": "2025-11-07T06:00:00.000Z"
}
```

### 刷新访问令牌

```http
POST /auth/refresh
Content-Type: application/json
Authorization: Bearer <refresh_token>

{
  "refreshToken": "string"
}
```

## 用户管理 API

### 创建用户

```http
POST /api/users
Content-Type: application/json
Authorization: Bearer <access_token>

{
  "username": "string",
  "email": "string",
  "password": "string",
  "role": "user|admin",
  "profile": {
    "firstName": "string",
    "lastName": "string",
    "department": "string"
  }
}
```

**参数说明:**
- `username`: 用户名，必需，3-50个字符
- `email`: 邮箱地址，必需，格式：user@domain.com
- `password`: 密码，必需，至少8个字符
- `role`: 用户角色，可选，默认"user"
- `profile`: 用户资料，可选

**响应示例:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "username": "johndoe",
    "email": "john.doe@example.com",
    "role": "user",
    "profile": {
      "firstName": "John",
      "lastName": "Doe",
      "department": "Engineering"
    },
    "createdAt": "2025-11-07T06:00:00.000Z",
    "updatedAt": "2025-11-07T06:00:00.000Z"
  },
  "timestamp": "2025-11-07T06:00:00.000Z"
}
```

### 获取用户列表

```http
GET /api/users
Authorization: Bearer <access_token>
```

**查询参数:**
- `page`: 页码，默认1
- `limit`: 每页数量，默认10，最大100
- `search`: 搜索关键词
- `role`: 过滤角色
- `department`: 过滤部门
- `sort`: 排序字段，默认"createdAt"
- `order`: 排序方向，"asc"或"desc"，默认"desc"

**响应示例:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "username": "johndoe",
      "email": "john.doe@example.com",
      "role": "user",
      "profile": {
        "firstName": "John",
        "lastName": "Doe",
        "department": "Engineering"
      },
      "lastLoginAt": "2025-11-07T05:30:00.000Z",
      "createdAt": "2025-11-07T04:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": false
  },
  "timestamp": "2025-11-07T06:00:00.000Z"
}
```

### 获取单个用户

```http
GET /api/users/{userId}
Authorization: Bearer <access_token>
```

**路径参数:**
- `userId`: 用户ID，必需

**响应示例:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "username": "johndoe",
    "email": "john.doe@example.com",
    "role": "user",
    "profile": {
      "firstName": "John",
      "lastName": "Doe",
      "department": "Engineering"
    },
    "lastLoginAt": "2025-11-07T05:30:00.000Z",
    "createdAt": "2025-11-07T04:00:00.000Z",
    "updatedAt": "2025-11-07T05:00:00.000Z"
  },
  "timestamp": "2025-11-07T06:00:00.000Z"
}
```

### 更新用户

```http
PUT /api/users/{userId}
Content-Type: application/json
Authorization: Bearer <access_token>

{
  "email": "new.email@example.com",
  "profile": {
    "firstName": "Jane",
    "lastName": "Smith",
    "department": "Product"
  }
}
```

### 删除用户

```http
DELETE /api/users/{userId}
Authorization: Bearer <access_token>
```

**响应示例:**
```json
{
  "success": true,
  "data": {
    "deleted": true,
    "userId": "uuid"
  },
  "timestamp": "2025-11-07T06:00:00.000Z"
}
```

### 获取当前用户信息

```http
GET /api/users/me
Authorization: Bearer <access_token>
```

### 更新当前用户信息

```http
PUT /api/users/me
Content-Type: application/json
Authorization: Bearer <access_token>

{
  "profile": {
    "firstName": "Updated",
    "lastName": "Name"
  }
}
```

## 工作流管理 API

### 创建工作流

```http
POST /api/workflows
Content-Type: application/json
Authorization: Bearer <access_token>

{
  "name": "string",
  "description": "string",
  "templateId": "uuid",
  "parameters": {
    "key": "value"
  },
  "triggers": [
    {
      "type": "schedule|event|manual",
      "config": {}
    }
  ],
  "steps": [
    {
      "name": "step1",
      "type": "task|decision|parallel",
      "config": {},
      "next": "step2"
    }
  ]
}
```

**参数说明:**
- `name`: 工作流名称，必需，1-100个字符
- `description`: 工作流描述，可选
- `templateId`: 模板ID，可选
- `parameters`: 工作流参数，可选
- `triggers`: 触发器配置，可选
- `steps`: 工作流步骤，必需

**响应示例:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "数据处理工作流",
    "description": "处理用户上传的数据",
    "status": "draft",
    "version": 1,
    "createdBy": "uuid",
    "createdAt": "2025-11-07T06:00:00.000Z",
    "updatedAt": "2025-11-07T06:00:00.000Z"
  },
  "timestamp": "2025-11-07T06:00:00.000Z"
}
```

### 获取工作流列表

```http
GET /api/workflows
Authorization: Bearer <access_token>
```

**查询参数:**
- `page`: 页码，默认1
- `limit`: 每页数量，默认10
- `status`: 状态过滤 (draft|active|paused|completed|failed)
- `createdBy`: 创建者ID
- `search`: 搜索关键词
- `sort`: 排序字段，默认"createdAt"
- `order`: 排序方向，默认"desc"

### 获取单个工作流

```http
GET /api/workflows/{workflowId}
Authorization: Bearer <access_token>
```

### 更新工作流

```http
PUT /api/workflows/{workflowId}
Content-Type: application/json
Authorization: Bearer <access_token>

{
  "name": "更新后的工作流名称",
  "description": "更新后的描述",
  "parameters": {
    "updated": "parameters"
  }
}
```

### 删除工作流

```http
DELETE /api/workflows/{workflowId}
Authorization: Bearer <access_token>
```

### 启动工作流实例

```http
POST /api/workflows/{workflowId}/start
Content-Type: application/json
Authorization: Bearer <access_token>

{
  "parameters": {
    "input": "data"
  },
  "priority": "low|normal|high"
}
```

**响应示例:**
```json
{
  "success": true,
  "data": {
    "instanceId": "uuid",
    "workflowId": "uuid",
    "status": "running",
    "startedAt": "2025-11-07T06:00:00.000Z",
    "parameters": {
      "input": "data"
    }
  },
  "timestamp": "2025-11-07T06:00:00.000Z"
}
```

### 暂停工作流实例

```http
POST /api/workflows/{workflowId}/pause
Authorization: Bearer <access_token>
```

### 恢复工作流实例

```http
POST /api/workflows/{workflowId}/resume
Authorization: Bearer <access_token>
```

### 停止工作流实例

```http
POST /api/workflows/{workflowId}/stop
Content-Type: application/json
Authorization: Bearer <access_token>

{
  "reason": "用户手动停止"
}
```

## 工作流实例管理 API

### 获取工作流实例列表

```http
GET /api/workflow-instances
Authorization: Bearer <access_token>
```

**查询参数:**
- `page`: 页码，默认1
- `limit`: 每页数量，默认10
- `workflowId`: 工作流ID过滤
- `status`: 状态过滤 (running|paused|completed|failed|cancelled)
- `startedBy`: 启动者ID
- `startDate`: 开始日期范围
- `endDate`: 结束日期范围

### 获取单个工作流实例

```http
GET /api/workflow-instances/{instanceId}
Authorization: Bearer <access_token>
```

**响应示例:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "workflowId": "uuid",
    "workflowName": "数据处理工作流",
    "status": "running",
    "startedBy": "uuid",
    "startedAt": "2025-11-07T06:00:00.000Z",
    "completedAt": null,
    "duration": null,
    "parameters": {
      "input": "data"
    },
    "currentStep": "process_data",
    "progress": 0.3,
    "steps": [
      {
        "id": "step1",
        "name": "validate_input",
        "status": "completed",
        "startedAt": "2025-11-07T06:00:00.000Z",
        "completedAt": "2025-11-07T06:00:05.000Z",
        "duration": 5000,
        "output": {
          "isValid": true
        }
      },
      {
        "id": "step2",
        "name": "process_data",
        "status": "running",
        "startedAt": "2025-11-07T06:00:05.000Z",
        "completedAt": null,
        "duration": null
      }
    ]
  },
  "timestamp": "2025-11-07T06:00:30.000Z"
}
```

### 获取工作流实例日志

```http
GET /api/workflow-instances/{instanceId}/logs
Authorization: Bearer <access_token>
```

**查询参数:**
- `level`: 日志级别过滤 (debug|info|warn|error)
- `step`: 步骤名称过滤
- `startTime`: 开始时间
- `endTime`: 结束时间
- `limit`: 返回数量，默认100

## 监控和管理 API

### 系统健康检查

```http
GET /health
```

**响应示例:**
```json
{
  "status": "healthy",
  "timestamp": "2025-11-07T06:00:00.000Z",
  "version": "2.0.0",
  "uptime": 3600,
  "services": {
    "database": {
      "status": "healthy",
      "latency": 5
    },
    "cache": {
      "status": "healthy",
      "hitRate": 0.95,
      "size": 1024000
    },
    "messaging": {
      "status": "healthy",
      "connections": 10
    }
  }
}
```

### 性能指标

```http
GET /metrics
Authorization: Bearer <access_token>
```

**响应示例:**
```json
{
  "timestamp": "2025-11-07T06:00:00.000Z",
  "system": {
    "uptime": 3600,
    "memory": {
      "used": 104857600,
      "total": 1073741824,
      "percentage": 9.8
    },
    "cpu": {
      "usage": 15.2
    }
  },
  "application": {
    "requests": {
      "total": 1250,
      "perSecond": 0.35,
      "averageResponseTime": 45
    },
    "workflows": {
      "active": 5,
      "completed": 120,
      "failed": 2
    },
    "cache": {
      "hitRate": 0.89,
      "hits": 890,
      "misses": 110
    }
  }
}
```

### 告警信息

```http
GET /alerts
Authorization: Bearer <access_token>
```

**查询参数:**
- `status`: 状态过滤 (active|acknowledged|resolved)
- `severity`: 严重程度过滤 (low|medium|high|critical)
- `startTime`: 开始时间
- `endTime`: 结束时间

### 系统状态

```http
GET /api/system/status
Authorization: Bearer <access_token>
```

### 系统配置

```http
GET /api/system/config
Authorization: Bearer <access_token>
```

**注意**: 此接口仅管理员可用

### 日志查询

```http
GET /api/system/logs
Authorization: Bearer <access_token>
```

**查询参数:**
- `level`: 日志级别 (debug|info|warn|error)
- `service`: 服务名称
- `startTime`: 开始时间
- `endTime`: 结束时间
- `search`: 搜索关键词
- `limit`: 返回数量，默认100

## 错误响应

所有API在出错时都会返回统一的错误响应格式：

```json
{
  "success": false,
  "error": {
    "message": "错误描述",
    "type": "错误类型",
    "code": "ERROR_CODE",
    "details": {
      "field": "错误的字段名",
      "value": "错误的值"
    }
  },
  "timestamp": "2025-11-07T06:00:00.000Z"
}
```

### 常见错误码

- `VALIDATION_ERROR`: 请求参数验证失败
- `UNAUTHORIZED`: 未认证或认证失效
- `FORBIDDEN`: 权限不足
- `NOT_FOUND`: 资源不存在
- `CONFLICT`: 资源冲突
- `RATE_LIMITED`: 请求频率超限
- `INTERNAL_ERROR`: 服务器内部错误

## 速率限制

API有以下速率限制：

- 普通用户：每分钟100个请求
- 管理员：每分钟500个请求
- 登录接口：每分钟10个请求

超出限制时会返回HTTP 429状态码。

## 数据格式和验证

### 请求数据验证

所有POST和PUT请求都会对输入数据进行严格验证：

- 字符串长度限制
- 邮箱格式验证
- 密码强度要求
- JSON Schema验证
- XSS和SQL注入防护

### 响应数据格式

所有响应都遵循统一的格式：

```json
{
  "success": boolean,
  "data": object|array|null,
  "pagination": object,  // 分页信息（列表接口）
  "error": object,       // 错误信息（出错时）
  "timestamp": string    // ISO 8601时间戳
}
```

## WebSocket 实时通信

系统支持WebSocket连接，用于实时接收工作流状态更新：

```javascript
const ws = new WebSocket('ws://localhost:3000/ws');

// 监听工作流状态变化
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'workflow.status_changed') {
    console.log('工作流状态更新:', data.payload);
  }
};

// 订阅特定工作流
ws.send(JSON.stringify({
  type: 'subscribe',
  workflowId: 'uuid'
}));
```

## SDK 和客户端库

### JavaScript/TypeScript SDK

```bash
npm install @frys/sdk
```

```javascript
import { frysClient } from '@frys/sdk';

const client = new frysClient({
  baseURL: 'http://localhost:3000',
  token: 'your-jwt-token'
});

// 使用API
const workflows = await client.workflows.list();
const user = await client.users.get('user-id');
```

### 命令行工具

```bash
npm install -g @frys/cli

# 登录
frys login

# 查看工作流
frys workflows list

# 启动工作流
frys workflows start template-id --param key=value
```

## 版本控制和兼容性

### API版本控制

API使用URL路径版本控制：

- 当前版本: `v1`
- 版本格式: `/api/v1/resource`

### 兼容性保证

- PATCH版本：完全向后兼容
- MINOR版本：新增功能，向后兼容
- MAJOR版本：可能包含破坏性变更

### 弃用策略

API弃用时会：

1. 在响应头中添加弃用警告
2. 在文档中标记为弃用
3. 保持至少2个版本的兼容性
4. 提前6个月通知用户迁移

## 支持和反馈

### 获取帮助

- 📖 [完整文档](https://docs.frys.com)
- 💬 [社区论坛](https://community.frys.com)
- 🐛 [问题跟踪](https://github.com/zycxfyh/frys/issues)
- 📧 [技术支持](mailto:support@frys.com)

### 反馈建议

欢迎通过以下方式提供反馈：

- GitHub Issues
- 社区论坛
- 邮件反馈
- 用户调研

---

*最后更新时间: 2025-11-07*
