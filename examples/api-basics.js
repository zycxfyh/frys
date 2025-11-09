/**
 * frys REST API 基础使用示例
 *
 * 这个示例展示了如何使用 frys 的 REST API 进行基本的 CRUD 操作，
 * 包括用户管理、工作流管理和执行。
 */

import axios from 'axios';

/**
 * 创建 API 客户端
 */
function createApiClient(baseURL = 'http://localhost:3000/api/v1') {
  const client = axios.create({
    baseURL,
    timeout: 10000,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'frys-examples/1.0.0',
    },
  });

  // 请求拦截器 - 添加认证头
  client.interceptors.request.use(
    (config) => {
      const token = getStoredToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => Promise.reject(error),
  );

  // 响应拦截器 - 处理通用错误
  client.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        // 令牌过期，清除存储
        clearStoredToken();
        console.warn('认证令牌已过期，请重新登录');
      }
      return Promise.reject(error);
    },
  );

  return client;
}

// 简单的令牌存储（生产环境应该使用更安全的方式）
let storedToken = null;

function getStoredToken() {
  return storedToken;
}

function setStoredToken(token) {
  storedToken = token;
}

function clearStoredToken() {
  storedToken = null;
}

/**
 * 用户认证相关 API
 */
class AuthAPI {
  constructor(apiClient) {
    this.client = apiClient;
  }

  /**
   * 用户注册
   */
  async register(userData) {
    try {
      const response = await this.client.post('/auth/register', {
        email: userData.email,
        password: userData.password,
        name: userData.name,
        role: userData.role || 'user',
      });

      console.log('✅ 用户注册成功:', response.data.data.email);
      return response.data.data;
    } catch (error) {
      console.error(
        '❌ 用户注册失败:',
        error.response?.data?.message || error.message,
      );
      throw error;
    }
  }

  /**
   * 用户登录
   */
  async login(credentials) {
    try {
      const response = await this.client.post('/auth/login', {
        email: credentials.email,
        password: credentials.password,
      });

      const { accessToken, refreshToken, expiresIn } = response.data.data;

      // 存储访问令牌
      setStoredToken(accessToken);

      console.log('✅ 用户登录成功');
      return {
        accessToken,
        refreshToken,
        expiresIn,
      };
    } catch (error) {
      console.error(
        '❌ 用户登录失败:',
        error.response?.data?.message || error.message,
      );
      throw error;
    }
  }

  /**
   * 刷新访问令牌
   */
  async refreshToken(refreshToken) {
    try {
      const response = await this.client.post('/auth/refresh', {
        refreshToken,
      });

      const { accessToken, expiresIn } = response.data.data;

      // 更新存储的令牌
      setStoredToken(accessToken);

      console.log('✅ 令牌刷新成功');
      return {
        accessToken,
        expiresIn,
      };
    } catch (error) {
      console.error(
        '❌ 令牌刷新失败:',
        error.response?.data?.message || error.message,
      );
      throw error;
    }
  }

  /**
   * 获取当前用户信息
   */
  async getCurrentUser() {
    try {
      const response = await this.client.get('/auth/me');
      return response.data.data;
    } catch (error) {
      console.error(
        '❌ 获取用户信息失败:',
        error.response?.data?.message || error.message,
      );
      throw error;
    }
  }
}

/**
 * 用户管理 API
 */
class UserAPI {
  constructor(apiClient) {
    this.client = apiClient;
  }

  /**
   * 获取用户列表
   */
  async getUsers(params = {}) {
    try {
      const response = await this.client.get('/users', { params });
      return response.data.data;
    } catch (error) {
      console.error(
        '❌ 获取用户列表失败:',
        error.response?.data?.message || error.message,
      );
      throw error;
    }
  }

  /**
   * 获取单个用户信息
   */
  async getUser(userId) {
    try {
      const response = await this.client.get(`/users/${userId}`);
      return response.data.data;
    } catch (error) {
      console.error(
        '❌ 获取用户信息失败:',
        error.response?.data?.message || error.message,
      );
      throw error;
    }
  }

  /**
   * 创建新用户
   */
  async createUser(userData) {
    try {
      const response = await this.client.post('/users', userData);
      console.log('✅ 用户创建成功:', response.data.data.email);
      return response.data.data;
    } catch (error) {
      console.error(
        '❌ 创建用户失败:',
        error.response?.data?.message || error.message,
      );
      throw error;
    }
  }

  /**
   * 更新用户信息
   */
  async updateUser(userId, updateData) {
    try {
      const response = await this.client.put(`/users/${userId}`, updateData);
      console.log('✅ 用户更新成功:', response.data.data.email);
      return response.data.data;
    } catch (error) {
      console.error(
        '❌ 更新用户失败:',
        error.response?.data?.message || error.message,
      );
      throw error;
    }
  }

  /**
   * 删除用户
   */
  async deleteUser(userId) {
    try {
      await this.client.delete(`/users/${userId}`);
      console.log('✅ 用户删除成功');
    } catch (error) {
      console.error(
        '❌ 删除用户失败:',
        error.response?.data?.message || error.message,
      );
      throw error;
    }
  }
}

/**
 * 工作流管理 API
 */
class WorkflowAPI {
  constructor(apiClient) {
    this.client = apiClient;
  }

  /**
   * 获取工作流列表
   */
  async getWorkflows(params = {}) {
    try {
      const response = await this.client.get('/workflows', { params });
      return response.data.data;
    } catch (error) {
      console.error(
        '❌ 获取工作流列表失败:',
        error.response?.data?.message || error.message,
      );
      throw error;
    }
  }

  /**
   * 获取单个工作流详情
   */
  async getWorkflow(workflowId) {
    try {
      const response = await this.client.get(`/workflows/${workflowId}`);
      return response.data.data;
    } catch (error) {
      console.error(
        '❌ 获取工作流详情失败:',
        error.response?.data?.message || error.message,
      );
      throw error;
    }
  }

  /**
   * 创建新工作流
   */
  async createWorkflow(workflowData) {
    try {
      const response = await this.client.post('/workflows', workflowData);
      console.log('✅ 工作流创建成功:', response.data.data.name);
      return response.data.data;
    } catch (error) {
      console.error(
        '❌ 创建工作流失败:',
        error.response?.data?.message || error.message,
      );
      throw error;
    }
  }

  /**
   * 更新工作流
   */
  async updateWorkflow(workflowId, updateData) {
    try {
      const response = await this.client.put(
        `/workflows/${workflowId}`,
        updateData,
      );
      console.log('✅ 工作流更新成功:', response.data.data.name);
      return response.data.data;
    } catch (error) {
      console.error(
        '❌ 更新工作流失败:',
        error.response?.data?.message || error.message,
      );
      throw error;
    }
  }

  /**
   * 删除工作流
   */
  async deleteWorkflow(workflowId) {
    try {
      await this.client.delete(`/workflows/${workflowId}`);
      console.log('✅ 工作流删除成功');
    } catch (error) {
      console.error(
        '❌ 删除工作流失败:',
        error.response?.data?.message || error.message,
      );
      throw error;
    }
  }

  /**
   * 执行工作流
   */
  async executeWorkflow(workflowId, inputData, options = {}) {
    try {
      const response = await this.client.post(
        `/workflows/${workflowId}/execute`,
        {
          input: inputData,
          options: {
            async: options.async !== false, // 默认异步执行
            timeout: options.timeout || 30000,
            ...options,
          },
        },
      );

      const result = response.data.data;

      if (result.executionId) {
        console.log('✅ 工作流执行已启动，执行ID:', result.executionId);

        // 如果是异步执行，返回执行ID
        if (options.async !== false) {
          return result;
        }
      }

      console.log('✅ 工作流执行完成');
      return result;
    } catch (error) {
      console.error(
        '❌ 执行工作流失败:',
        error.response?.data?.message || error.message,
      );
      throw error;
    }
  }

  /**
   * 获取工作流执行状态
   */
  async getExecutionStatus(executionId) {
    try {
      const response = await this.client.get(
        `/workflows/executions/${executionId}`,
      );
      return response.data.data;
    } catch (error) {
      console.error(
        '❌ 获取执行状态失败:',
        error.response?.data?.message || error.message,
      );
      throw error;
    }
  }

  /**
   * 监听工作流执行事件 (Server-Sent Events)
   */
  listenToExecution(executionId, callbacks = {}) {
    const eventSource = new EventSource(
      `${this.client.defaults.baseURL}/workflows/executions/${executionId}/events`,
    );

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📡 执行事件:', data.type, data);

        if (callbacks.onMessage) {
          callbacks.onMessage(data);
        }

        // 处理特定事件
        switch (data.type) {
          case 'workflow.started':
            if (callbacks.onStarted) callbacks.onStarted(data);
            break;
          case 'workflow.completed':
            if (callbacks.onCompleted) callbacks.onCompleted(data);
            eventSource.close();
            break;
          case 'workflow.failed':
            if (callbacks.onFailed) callbacks.onFailed(data);
            eventSource.close();
            break;
          case 'step.started':
            if (callbacks.onStepStarted) callbacks.onStepStarted(data);
            break;
          case 'step.completed':
            if (callbacks.onStepCompleted) callbacks.onStepCompleted(data);
            break;
          case 'step.failed':
            if (callbacks.onStepFailed) callbacks.onStepFailed(data);
            break;
        }
      } catch (error) {
        console.error('❌ 解析事件数据失败:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('❌ 事件监听连接错误:', error);
      if (callbacks.onError) {
        callbacks.onError(error);
      }
      eventSource.close();
    };

    // 返回关闭函数
    return () => eventSource.close();
  }
}

/**
 * 系统监控 API
 */
class SystemAPI {
  constructor(apiClient) {
    this.client = apiClient;
  }

  /**
   * 健康检查
   */
  async healthCheck() {
    try {
      const response = await this.client.get('/health');
      return response.data;
    } catch (error) {
      console.error('❌ 健康检查失败:', error.message);
      throw error;
    }
  }

  /**
   * 获取系统信息
   */
  async getSystemInfo() {
    try {
      const response = await this.client.get('/info');
      return response.data.data;
    } catch (error) {
      console.error(
        '❌ 获取系统信息失败:',
        error.response?.data?.message || error.message,
      );
      throw error;
    }
  }

  /**
   * 获取系统指标 (Prometheus 格式)
   */
  async getMetrics() {
    try {
      const response = await this.client.get('/metrics', {
        headers: {
          Accept: 'text/plain',
        },
      });
      return response.data;
    } catch (error) {
      console.error('❌ 获取系统指标失败:', error.message);
      throw error;
    }
  }
}

/**
 * 综合 API 客户端
 */
class FrysAPI {
  constructor(baseURL) {
    this.client = createApiClient(baseURL);

    // 初始化各个 API 模块
    this.auth = new AuthAPI(this.client);
    this.users = new UserAPI(this.client);
    this.workflows = new WorkflowAPI(this.client);
    this.system = new SystemAPI(this.client);
  }

  /**
   * 设置认证令牌
   */
  setToken(token) {
    setStoredToken(token);
  }

  /**
   * 清除认证令牌
   */
  clearToken() {
    clearStoredToken();
  }

  /**
   * 检查是否已认证
   */
  isAuthenticated() {
    return !!getStoredToken();
  }
}

/**
 * 演示用户认证流程
 */
async function demonstrateAuthentication(api) {
  console.log('🔐 演示用户认证流程...\n');

  try {
    // 1. 用户注册
    console.log('📝 注册新用户...');
    const newUser = await api.auth.register({
      email: 'demo@example.com',
      password: 'DemoPass123!',
      name: 'Demo User',
    });
    console.log('用户ID:', newUser.id);
    console.log();

    // 2. 用户登录
    console.log('🔑 用户登录...');
    const tokens = await api.auth.login({
      email: 'demo@example.com',
      password: 'DemoPass123!',
    });
    console.log('访问令牌长度:', tokens.accessToken.length);
    console.log();

    // 3. 获取当前用户信息
    console.log('👤 获取用户信息...');
    const currentUser = await api.auth.getCurrentUser();
    console.log('当前用户:', currentUser.name, `(${currentUser.email})`);
    console.log();

    return tokens;
  } catch (error) {
    console.error('❌ 认证流程演示失败:', error.message);
    throw error;
  }
}

/**
 * 演示用户管理操作
 */
async function demonstrateUserManagement(api) {
  console.log('👥 演示用户管理操作...\n');

  try {
    // 1. 获取用户列表
    console.log('📋 获取用户列表...');
    const users = await api.users.getUsers({ limit: 10 });
    console.log(`找到 ${users.items.length} 个用户`);
    console.log();

    // 2. 创建新用户
    console.log('➕ 创建新用户...');
    const newUser = await api.users.createUser({
      email: 'test@example.com',
      password: 'TestPass123!',
      name: 'Test User',
      role: 'user',
    });
    console.log('新用户ID:', newUser.id);
    console.log();

    // 3. 获取单个用户信息
    console.log('🔍 获取用户信息...');
    const user = await api.users.getUser(newUser.id);
    console.log('用户详情:', user.name, user.email, user.role);
    console.log();

    // 4. 更新用户信息
    console.log('✏️  更新用户信息...');
    const updatedUser = await api.users.updateUser(newUser.id, {
      name: 'Updated Test User',
    });
    console.log('更新后的姓名:', updatedUser.name);
    console.log();

    // 5. 删除用户
    console.log('🗑️  删除用户...');
    await api.users.deleteUser(newUser.id);
    console.log('用户删除成功');
    console.log();
  } catch (error) {
    console.error('❌ 用户管理演示失败:', error.message);
    throw error;
  }
}

/**
 * 演示工作流操作
 */
async function demonstrateWorkflowOperations(api) {
  console.log('⚙️  演示工作流操作...\n');

  try {
    // 1. 创建工作流
    console.log('➕ 创建工作流...');
    const workflow = await api.workflows.createWorkflow({
      name: 'API 演示工作流',
      description: '通过 REST API 创建的工作流示例',
      definition: {
        steps: [
          {
            id: 'validate-input',
            name: '验证输入',
            type: 'validation',
            config: {
              schema: {
                message: 'required|string',
              },
            },
          },
          {
            id: 'process-message',
            name: '处理消息',
            type: 'service',
            config: {
              service: 'messageService',
              method: 'process',
              parameters: {
                content: '${input.message}',
              },
            },
          },
        ],
      },
    });
    console.log('工作流ID:', workflow.id);
    console.log();

    // 2. 获取工作流列表
    console.log('📋 获取工作流列表...');
    const workflows = await api.workflows.getWorkflows({ limit: 5 });
    console.log(`找到 ${workflows.items.length} 个工作流`);
    console.log();

    // 3. 执行工作流
    console.log('▶️  执行工作流...');
    const execution = await api.workflows.executeWorkflow(workflow.id, {
      message: 'Hello from API demo!',
    });
    console.log('执行ID:', execution.executionId);
    console.log();

    // 4. 监听执行状态
    console.log('📡 监听执行状态...');
    const stopListening = api.workflows.listenToExecution(
      execution.executionId,
      {
        onMessage: (data) => console.log('📨 事件:', data.type),
        onCompleted: (data) => {
          console.log('✅ 工作流执行完成');
          console.log('执行时间:', data.executionTime, 'ms');
        },
        onFailed: (data) => {
          console.error('❌ 工作流执行失败:', data.error);
        },
      },
    );

    // 等待执行完成
    await new Promise((resolve) => setTimeout(resolve, 3000));
    stopListening();
    console.log();

    // 5. 获取执行状态
    console.log('📊 获取执行状态...');
    const status = await api.workflows.getExecutionStatus(
      execution.executionId,
    );
    console.log('执行状态:', status.status);
    console.log();

    // 6. 删除工作流
    console.log('🗑️  删除工作流...');
    await api.workflows.deleteWorkflow(workflow.id);
    console.log('工作流删除成功');
    console.log();
  } catch (error) {
    console.error('❌ 工作流操作演示失败:', error.message);
    throw error;
  }
}

/**
 * 演示系统监控
 */
async function demonstrateSystemMonitoring(api) {
  console.log('📊 演示系统监控...\n');

  try {
    // 1. 健康检查
    console.log('❤️  健康检查...');
    const health = await api.system.healthCheck();
    console.log('系统健康状态:', health.status || 'ok');
    console.log();

    // 2. 获取系统信息
    console.log('ℹ️  获取系统信息...');
    const info = await api.system.getSystemInfo();
    console.log('系统版本:', info.version);
    console.log('启动时间:', new Date(info.startTime).toLocaleString());
    console.log();

    // 3. 获取系统指标
    console.log('📈 获取系统指标...');
    const metrics = await api.system.getMetrics();
    console.log('指标数据长度:', metrics.length, '字符');
    console.log('前200个字符预览:');
    console.log(metrics.substring(0, 200) + '...');
    console.log();
  } catch (error) {
    console.error('❌ 系统监控演示失败:', error.message);
    throw error;
  }
}

/**
 * 主演示函数
 */
async function demonstrateAPIBasics() {
  console.log('🚀 frys REST API 基础使用示例\n');
  console.log('='.repeat(60));

  const api = new FrysAPI('http://localhost:3000/api/v1');

  try {
    // 演示认证流程
    await demonstrateAuthentication(api);

    console.log('='.repeat(60));

    // 演示用户管理
    await demonstrateUserManagement(api);

    console.log('='.repeat(60));

    // 演示工作流操作
    await demonstrateWorkflowOperations(api);

    console.log('='.repeat(60));

    // 演示系统监控
    await demonstrateSystemMonitoring(api);

    console.log('='.repeat(60));
    console.log('🎉 所有 API 演示完成！');
  } catch (error) {
    console.error('❌ API 演示过程中发生错误:', error.message);
    console.log('\n💡 可能的原因:');
    console.log('1. 确保 frys 服务正在运行 (npm run dev)');
    console.log('2. 检查环境配置是否正确');
    console.log('3. 确认数据库和 Redis 服务可用');
    console.log('4. 查看服务日志了解详细错误信息');

    process.exit(1);
  }
}

/**
 * 实用工具函数
 */

// 等待函数
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 重试函数
async function retry(fn, maxAttempts = 3, delayMs = 1000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error;
      }
      console.log(`第 ${attempt} 次尝试失败，${delayMs}ms 后重试...`);
      await delay(delayMs);
      delayMs *= 2; // 指数退避
    }
  }
}

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateAPIBasics().catch(console.error);
}

export {
  FrysAPI,
  createApiClient,
  demonstrateAPIBasics,
  demonstrateAuthentication,
  demonstrateUserManagement,
  demonstrateWorkflowOperations,
  demonstrateSystemMonitoring,
};
