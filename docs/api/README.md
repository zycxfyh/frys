# 🔌 frys API 文档

<div align="center">

## API 接口文档导航

**完整的 REST API 参考和使用指南**

[🏠 返回文档主页](../README.md) • [🚀 快速开始](../../GETTING_STARTED.md) • [🔄 OpenAPI 规范](openapi.yaml)

---

</div>

## 📋 文档概览

| 文档                                          | 说明              | 适用场景   |
| --------------------------------------------- | ----------------- | ---------- |
| **[API 文档](api-documentation.md)**          | 完整的API接口参考 | 开发者集成 |
| **[一致性规范](api-consistency-standard.md)** | API设计和编码规范 | 项目维护者 |
| **[OpenAPI 规范](openapi.yaml)**              | 机器可读的API定义 | 自动化工具 |

---

## 🚀 快速开始

### 基础信息

- **基础URL**: `http://localhost:3000` (开发环境)
- **认证方式**: JWT Bearer Token
- **数据格式**: JSON
- **字符编码**: UTF-8
- **API版本**: v1

### 认证流程

```bash
# 1. 用户登录获取令牌
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password"}'

# 2. 使用访问令牌调用API
curl -X GET http://localhost:3000/api/v1/workflows \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## 📚 API 资源

### 🔐 认证相关

| 接口                    | 方法 | 说明     |
| ----------------------- | ---- | -------- |
| `/api/v1/auth/register` | POST | 用户注册 |
| `/api/v1/auth/login`    | POST | 用户登录 |
| `/api/v1/auth/refresh`  | POST | 刷新令牌 |

### 👤 用户管理

| 接口                 | 方法   | 说明         |
| -------------------- | ------ | ------------ |
| `/api/v1/users`      | GET    | 获取用户列表 |
| `/api/v1/users`      | POST   | 创建用户     |
| `/api/v1/users/{id}` | GET    | 获取用户信息 |
| `/api/v1/users/{id}` | PUT    | 更新用户信息 |
| `/api/v1/users/{id}` | DELETE | 删除用户     |

### ⚙️ 工作流管理

| 接口                                       | 方法   | 说明           |
| ------------------------------------------ | ------ | -------------- |
| `/api/v1/workflows`                        | GET    | 获取工作流列表 |
| `/api/v1/workflows`                        | POST   | 创建工作流     |
| `/api/v1/workflows/{id}`                   | GET    | 获取工作流详情 |
| `/api/v1/workflows/{id}`                   | PUT    | 更新工作流     |
| `/api/v1/workflows/{id}`                   | DELETE | 删除工作流     |
| `/api/v1/workflows/{id}/execute`           | POST   | 执行工作流     |
| `/api/v1/workflows/executions/{id}`        | GET    | 获取执行状态   |
| `/api/v1/workflows/executions/{id}/events` | GET    | 监听执行事件   |

### 📊 系统监控

| 接口           | 方法 | 说明            |
| -------------- | ---- | --------------- |
| `/health`      | GET  | 健康检查        |
| `/api/v1/info` | GET  | 系统信息        |
| `/metrics`     | GET  | Prometheus 指标 |

---

## 🛠️ 开发工具

### API 测试工具

#### 使用 cURL 测试

```bash
# 健康检查
curl -X GET http://localhost:3000/health

# 获取API信息
curl -X GET http://localhost:3000/api/v1/info

# 用户注册
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User"
  }'
```

#### 使用 Postman/Insomnia

1. 导入 OpenAPI 规范：`docs/api/openapi.yaml`
2. 配置环境变量：
   - `base_url`: `http://localhost:3000`
   - `access_token`: 从登录接口获取
3. 使用认证头：`Authorization: Bearer {{access_token}}`

### 代码示例

#### JavaScript (Node.js)

```javascript
const axios = require('axios');

// 配置基础客户端
const apiClient = axios.create({
  baseURL: 'http://localhost:3000/api/v1',
  timeout: 10000,
});

// 设置认证令牌
const setAuthToken = (token) => {
  apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
};

// 登录获取令牌
async function login(email, password) {
  try {
    const response = await apiClient.post('/auth/login', {
      email,
      password,
    });
    const { accessToken } = response.data.data;
    setAuthToken(accessToken);
    return accessToken;
  } catch (error) {
    console.error('登录失败:', error.response?.data || error.message);
    throw error;
  }
}

// 获取工作流列表
async function getWorkflows() {
  try {
    const response = await apiClient.get('/workflows');
    return response.data.data;
  } catch (error) {
    console.error('获取工作流失败:', error.response?.data || error.message);
    throw error;
  }
}

// 创建工作流
async function createWorkflow(workflowData) {
  try {
    const response = await apiClient.post('/workflows', workflowData);
    return response.data.data;
  } catch (error) {
    console.error('创建工作流失败:', error.response?.data || error.message);
    throw error;
  }
}

// 执行工作流
async function executeWorkflow(workflowId, inputData) {
  try {
    const response = await apiClient.post(`/workflows/${workflowId}/execute`, {
      input: inputData,
    });
    return response.data.data;
  } catch (error) {
    console.error('执行工作流失败:', error.response?.data || error.message);
    throw error;
  }
}

module.exports = {
  login,
  getWorkflows,
  createWorkflow,
  executeWorkflow,
};
```

#### Python

```python
import requests
import json

class FrysAPI:
    def __init__(self, base_url='http://localhost:3000/api/v1'):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.timeout = 10

    def login(self, email: str, password: str) -> str:
        """用户登录获取访问令牌"""
        url = f"{self.base_url}/auth/login"
        data = {
            "email": email,
            "password": password
        }

        response = self.session.post(url, json=data)
        response.raise_for_status()

        result = response.json()
        access_token = result['data']['accessToken']

        # 设置后续请求的认证头
        self.session.headers.update({
            'Authorization': f'Bearer {access_token}'
        })

        return access_token

    def get_workflows(self, page=1, limit=10, search=None):
        """获取工作流列表"""
        url = f"{self.base_url}/workflows"
        params = {
            'page': page,
            'limit': limit
        }
        if search:
            params['search'] = search

        response = self.session.get(url, params=params)
        response.raise_for_status()

        return response.json()['data']

    def create_workflow(self, name: str, definition: dict, description=None):
        """创建工作流"""
        url = f"{self.base_url}/workflows"
        data = {
            "name": name,
            "definition": definition
        }
        if description:
            data["description"] = description

        response = self.session.post(url, json=data)
        response.raise_for_status()

        return response.json()['data']

    def execute_workflow(self, workflow_id: str, input_data: dict):
        """执行工作流"""
        url = f"{self.base_url}/workflows/{workflow_id}/execute"
        data = {
            "input": input_data
        }

        response = self.session.post(url, json=data)
        response.raise_for_status()

        return response.json()['data']

    def get_execution_status(self, execution_id: str):
        """获取工作流执行状态"""
        url = f"{self.base_url}/workflows/executions/{execution_id}"

        response = self.session.get(url)
        response.raise_for_status()

        return response.json()['data']

# 使用示例
if __name__ == "__main__":
    api = FrysAPI()

    try:
        # 登录
        token = api.login("user@example.com", "password")
        print(f"登录成功，令牌: {token[:20]}...")

        # 获取工作流列表
        workflows = api.get_workflows()
        print(f"找到 {len(workflows['items'])} 个工作流")

        # 创建工作流
        workflow_def = {
            "name": "示例工作流",
            "steps": [
                {
                    "id": "step1",
                    "name": "验证输入",
                    "type": "validation",
                    "config": {"required": ["name"]}
                }
            ]
        }

        workflow = api.create_workflow("示例工作流", workflow_def)
        print(f"创建工作流成功: {workflow['id']}")

        # 执行工作流
        result = api.execute_workflow(workflow['id'], {"name": "测试"})
        print(f"执行结果: {result}")

    except requests.exceptions.RequestException as e:
        print(f"API请求失败: {e}")
    except KeyError as e:
        print(f"响应数据格式错误: {e}")
```

---

## 📋 响应格式

### 成功响应

```json
{
  "success": true,
  "data": {
    // 响应数据
  },
  "message": "操作成功",
  "timestamp": "2025-11-07T06:00:00.000Z"
}
```

### 分页响应

```json
{
  "success": true,
  "data": {
    "items": [
      // 数据项列表
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "totalPages": 3
    }
  },
  "timestamp": "2025-11-07T06:00:00.000Z"
}
```

### 错误响应

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "输入数据验证失败",
    "details": {
      "field": "email",
      "reason": "邮箱格式不正确"
    }
  },
  "timestamp": "2025-11-07T06:00:00.000Z"
}
```

---

## ⚠️ 错误码参考

| 错误码                  | HTTP状态码 | 说明             |
| ----------------------- | ---------- | ---------------- |
| `VALIDATION_ERROR`      | 400        | 输入数据验证失败 |
| `AUTHENTICATION_FAILED` | 401        | 认证失败         |
| `AUTHORIZATION_FAILED`  | 403        | 权限不足         |
| `RESOURCE_NOT_FOUND`    | 404        | 资源不存在       |
| `RESOURCE_CONFLICT`     | 409        | 资源冲突         |
| `RATE_LIMIT_EXCEEDED`   | 429        | 请求频率超限     |
| `INTERNAL_ERROR`        | 500        | 服务器内部错误   |

---

## 🔄 API 版本控制

### 版本策略

- **主版本**: 通过URL路径区分，如 `/api/v1/`
- **向后兼容**: 新版本API会保持对旧版本的兼容
- **废弃通知**: API废弃前会提前通知用户

### 版本历史

| 版本 | 发布日期   | 主要变更     | 状态        |
| ---- | ---------- | ------------ | ----------- |
| v1.0 | 2025-11-07 | 初始版本发布 | ✅ 当前版本 |

---

## 📊 速率限制

### 默认限制

- **认证接口**: 10 次/分钟/IP
- **一般接口**: 100 次/分钟/用户
- **管理接口**: 50 次/分钟/用户

### 响应头信息

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1636285200
X-RateLimit-Retry-After: 60
```

### 超出限制

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "请求频率超限，请稍后再试",
    "retryAfter": 60
  }
}
```

---

## 🔧 故障排除

### 常见问题

#### 401 Unauthorized

**问题**: `{"error": "Authentication required"}`

**解决方案**:

1. 检查是否已登录并获取访问令牌
2. 确认令牌是否过期
3. 验证Authorization头格式是否正确

#### 403 Forbidden

**问题**: `{"error": "Insufficient permissions"}`

**解决方案**:

1. 确认用户角色是否具有相应权限
2. 检查用户状态是否为活跃状态

#### 429 Too Many Requests

**问题**: `{"error": "Rate limit exceeded"}`

**解决方案**:

1. 查看响应头中的 `X-RateLimit-Reset` 时间
2. 等待限制重置或降低请求频率

#### 500 Internal Server Error

**问题**: 服务器内部错误

**解决方案**:

1. 检查服务器日志
2. 确认所有依赖服务（Redis、数据库）正常运行
3. 查看错误详情和堆栈信息

### 调试技巧

```bash
# 启用详细日志
DEBUG=frys:* npm run dev

# 测试API连接
curl -v http://localhost:3000/health

# 检查服务依赖
redis-cli ping
psql -h localhost -U postgres -c "SELECT 1;"

# 查看应用日志
tail -f logs/frys.log
```

---

## 📚 相关资源

- **[快速开始](../../GETTING_STARTED.md)** - 完整的使用指南
- **[系统架构](../architecture/system-architecture.md)** - 技术架构详解
- **[部署指南](../deployment/production-setup.md)** - 生产环境部署
- **[测试文档](../testing/testing-architecture.md)** - API测试策略

---

<div align="center">

## 🤝 需要帮助？

- 📧 **邮箱**: 1666384464@qq.com
- 💬 **社区**: [GitHub Discussions](https://github.com/zycxfyh/frys/discussions)
- 🐛 **问题**: [GitHub Issues](https://github.com/zycxfyh/frys/issues)

---

_最后更新: 2025年11月_

</div>
