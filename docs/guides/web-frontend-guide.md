# 🌐 Web 前端开发指南

<div align="center">

## 🎨 frys Web 前端界面开发

**现代化的工作流管理系统前端实现**

[🏠 返回文档主页](../README.md) • [📖 文档导航](../README.md) • [🚀 快速开始](../../GETTING_STARTED.md)

---

</div>

## 📋 概述

frys 提供了一个现代化的 Web 前端界面，用于管理工作流、监控系统状态和配置 AI 服务。本文档介绍前端的架构设计、使用方式和开发指南。

## 🏗️ 架构设计

### 技术栈

```javascript
// 前端技术栈
const techStack = {
  framework: 'Vanilla JavaScript + HTML5',
  styling: 'CSS3 + Flexbox/Grid',
  api: 'Fetch API + RESTful',
  realtime: 'Server-Sent Events (SSE)',
  build: 'ES6 Modules',
  deployment: 'Static hosting',
};
```

### 文件结构

```
web/
├── index.html          # 主页面
├── app.js             # 应用主逻辑
├── styles.css         # 样式文件
└── components/        # 组件目录（计划中）
    ├── workflow-designer.js
    ├── dashboard.js
    └── ai-chat.js
```

## 🚀 快速开始

### 本地开发

```bash
# 1. 启动后端服务
npm run dev

# 2. 打开浏览器访问前端界面
# http://localhost:3000 (如果配置了静态文件服务)

# 或者直接打开HTML文件
open web/index.html
```

### 功能特性

#### 🖥️ 仪表板

- **系统状态监控**: 显示服务健康状态、资源使用情况
- **实时指标**: CPU、内存、请求数等关键指标
- **告警通知**: 系统异常的实时提醒

#### ⚙️ 工作流管理

- **工作流列表**: 查看所有已创建的工作流
- **工作流执行**: 手动触发工作流执行
- **执行监控**: 实时查看执行状态和日志

#### 🤖 AI 服务配置

- **供应商管理**: 添加、配置 AI 服务供应商
- **模型选择**: 为不同任务选择合适的 AI 模型
- **使用统计**: 查看 API 调用次数和费用

## 💻 开发指南

### HTML 结构

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>frys - 工作流管理系统</title>
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <div id="app">
      <header>
        <h1>frys</h1>
        <nav>
          <button onclick="showDashboard()">仪表板</button>
          <button onclick="showWorkflows()">工作流</button>
          <button onclick="showAISettings()">AI 设置</button>
        </nav>
      </header>

      <main id="main-content">
        <!-- 动态内容区域 -->
      </main>
    </div>

    <script type="module" src="app.js"></script>
  </body>
</html>
```

### JavaScript 架构

#### 应用初始化

```javascript
// app.js
class FrysApp {
  constructor() {
    this.currentView = 'dashboard';
    this.init();
  }

  async init() {
    // 初始化事件监听器
    this.setupEventListeners();

    // 加载初始数据
    await this.loadSystemStatus();

    // 渲染初始视图
    this.renderView();
  }

  setupEventListeners() {
    // 导航事件
    document.querySelectorAll('nav button').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const view = e.target.dataset.view;
        this.switchView(view);
      });
    });

    // 定期更新状态
    setInterval(() => this.updateStatus(), 5000);
  }
}

// 应用启动
document.addEventListener('DOMContentLoaded', () => {
  window.frysApp = new FrysApp();
});
```

#### API 通信

```javascript
// API 客户端
class ApiClient {
  constructor(baseURL = '/api/v1') {
    this.baseURL = baseURL;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `HTTP ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('API 请求失败:', error);
      throw error;
    }
  }

  // 系统状态
  async getSystemStatus() {
    return this.request('/health');
  }

  // 工作流列表
  async getWorkflows() {
    return this.request('/workflows');
  }

  // 执行工作流
  async executeWorkflow(workflowId, input) {
    return this.request(`/workflows/${workflowId}/execute`, {
      method: 'POST',
      body: JSON.stringify({ input }),
    });
  }

  // AI 配置
  async getAIProviders() {
    return this.request('/ai/providers');
  }

  async updateAIProvider(providerId, config) {
    return this.request(`/ai/providers/${providerId}`, {
      method: 'PUT',
      body: JSON.stringify(config),
    });
  }
}

// 全局 API 实例
window.api = new ApiClient();
```

#### 实时数据更新

```javascript
// 实时状态更新
class RealtimeManager {
  constructor() {
    this.eventSource = null;
    this.listeners = new Map();
  }

  connect(workflowId = null) {
    const url = workflowId
      ? `/api/v1/workflows/executions/${workflowId}/events`
      : '/api/v1/system/events';

    this.eventSource = new EventSource(url);

    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.notifyListeners(data.type, data);
      } catch (error) {
        console.error('解析实时事件失败:', error);
      }
    };

    this.eventSource.onerror = (error) => {
      console.error('实时连接错误:', error);
      // 自动重连逻辑
      setTimeout(() => this.connect(workflowId), 5000);
    };
  }

  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  on(eventType, callback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType).push(callback);
  }

  notifyListeners(eventType, data) {
    const callbacks = this.listeners.get(eventType) || [];
    callbacks.forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        console.error('事件监听器执行失败:', error);
      }
    });
  }
}

// 使用示例
const realtime = new RealtimeManager();

// 监听工作流执行状态
realtime.on('workflow.completed', (data) => {
  console.log('工作流执行完成:', data.workflowId);
  updateWorkflowStatus(data.workflowId, 'completed');
});

realtime.on('system.metrics', (data) => {
  updateSystemMetrics(data.metrics);
});

// 连接到系统事件流
realtime.connect();
```

## 🎨 样式设计

### CSS 架构

```css
/* styles.css */

/* CSS 变量定义 */
:root {
  --primary-color: #667eea;
  --secondary-color: #764ba2;
  --success-color: #28a745;
  --warning-color: #ffc107;
  --danger-color: #dc3545;
  --text-color: #333;
  --bg-color: #fff;
  --border-radius: 8px;
  --shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

/* 基础样式 */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.6;
  color: var(--text-color);
  background: var(--bg-color);
}

/* 布局组件 */
.app-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

header {
  background: linear-gradient(
    135deg,
    var(--primary-color),
    var(--secondary-color)
  );
  color: white;
  padding: 1rem;
  box-shadow: var(--shadow);
}

nav {
  display: flex;
  gap: 1rem;
  margin-top: 1rem;
}

nav button {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  padding: 0.5rem 1rem;
  border-radius: var(--border-radius);
  cursor: pointer;
  transition: background 0.3s;
}

nav button:hover,
nav button.active {
  background: rgba(255, 255, 255, 0.3);
}

/* 主内容区域 */
main {
  flex: 1;
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

/* 卡片组件 */
.card {
  background: white;
  border-radius: var(--border-radius);
  box-shadow: var(--shadow);
  padding: 1.5rem;
  margin-bottom: 1rem;
}

.card-header {
  border-bottom: 1px solid #eee;
  padding-bottom: 1rem;
  margin-bottom: 1rem;
}

.card-title {
  font-size: 1.25rem;
  font-weight: 600;
}

/* 状态指示器 */
.status-indicator {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  margin-right: 0.5rem;
}

.status-healthy {
  background: var(--success-color);
}
.status-warning {
  background: var(--warning-color);
}
.status-error {
  background: var(--danger-color);
}

/* 响应式设计 */
@media (max-width: 768px) {
  nav {
    flex-direction: column;
    gap: 0.5rem;
  }

  main {
    padding: 1rem;
  }

  .card {
    padding: 1rem;
  }
}
```

### 主题定制

```css
/* 深色主题支持 */
@media (prefers-color-scheme: dark) {
  :root {
    --text-color: #e9ecef;
    --bg-color: #212529;
    --shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  }

  .card {
    background: #343a40;
    border: 1px solid #495057;
  }
}
```

## 🔧 核心功能实现

### 仪表板组件

```javascript
// 仪表板功能
class Dashboard {
  constructor(container) {
    this.container = container;
    this.metrics = {};
    this.init();
  }

  async init() {
    await this.loadSystemStatus();
    this.render();
    this.startAutoRefresh();
  }

  async loadSystemStatus() {
    try {
      const status = await window.api.getSystemStatus();
      this.metrics = status.data;
    } catch (error) {
      console.error('加载系统状态失败:', error);
      this.metrics = { status: 'error', message: error.message };
    }
  }

  render() {
    this.container.innerHTML = `
            <div class="dashboard-grid">
                <div class="metric-card">
                    <h3>系统状态</h3>
                    <div class="status-indicator ${this.getStatusClass()}"></div>
                    <span>${this.metrics.status || '未知'}</span>
                </div>

                <div class="metric-card">
                    <h3>活跃工作流</h3>
                    <span class="metric-value">${this.metrics.activeWorkflows || 0}</span>
                </div>

                <div class="metric-card">
                    <h3>CPU 使用率</h3>
                    <span class="metric-value">${this.metrics.cpuUsage || 0}%</span>
                </div>

                <div class="metric-card">
                    <h3>内存使用</h3>
                    <span class="metric-value">${this.formatBytes(this.metrics.memoryUsage || 0)}</span>
                </div>
            </div>
        `;
  }

  getStatusClass() {
    const status = this.metrics.status;
    if (status === 'healthy') return 'status-healthy';
    if (status === 'warning') return 'status-warning';
    return 'status-error';
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  startAutoRefresh() {
    setInterval(() => {
      this.loadSystemStatus().then(() => this.render());
    }, 10000); // 每10秒刷新
  }
}
```

### 工作流管理组件

```javascript
// 工作流管理功能
class WorkflowManager {
  constructor(container) {
    this.container = container;
    this.workflows = [];
    this.init();
  }

  async init() {
    await this.loadWorkflows();
    this.render();
  }

  async loadWorkflows() {
    try {
      const response = await window.api.getWorkflows();
      this.workflows = response.data.items || [];
    } catch (error) {
      console.error('加载工作流失败:', error);
      this.workflows = [];
    }
  }

  render() {
    const html = `
            <div class="workflow-manager">
                <div class="card">
                    <div class="card-header">
                        <h2 class="card-title">工作流管理</h2>
                        <button onclick="createNewWorkflow()" class="btn-primary">
                            创建工作流
                        </button>
                    </div>

                    <div class="workflow-list">
                        ${
                          this.workflows.length === 0
                            ? '<p class="empty-state">暂无工作流</p>'
                            : this.renderWorkflowList()
                        }
                    </div>
                </div>
            </div>
        `;

    this.container.innerHTML = html;
  }

  renderWorkflowList() {
    return this.workflows
      .map(
        (workflow) => `
            <div class="workflow-item" data-id="${workflow.id}">
                <div class="workflow-info">
                    <h4>${workflow.name}</h4>
                    <p>${workflow.description || '暂无描述'}</p>
                    <span class="workflow-status status-${workflow.status}">
                        ${this.getStatusText(workflow.status)}
                    </span>
                </div>

                <div class="workflow-actions">
                    <button onclick="editWorkflow('${workflow.id}')" class="btn-secondary">
                        编辑
                    </button>
                    <button onclick="executeWorkflow('${workflow.id}')" class="btn-primary">
                        执行
                    </button>
                    <button onclick="deleteWorkflow('${workflow.id}')" class="btn-danger">
                        删除
                    </button>
                </div>
            </div>
        `,
      )
      .join('');
  }

  getStatusText(status) {
    const statusMap = {
      draft: '草稿',
      published: '已发布',
      archived: '已归档',
    };
    return statusMap[status] || status;
  }
}

// 全局函数
window.createNewWorkflow = () => {
  // 实现创建工作流逻辑
  console.log('创建新工作流');
};

window.editWorkflow = (id) => {
  // 实现编辑工作流逻辑
  console.log('编辑工作流:', id);
};

window.executeWorkflow = async (id) => {
  try {
    const result = await window.api.executeWorkflow(id, {});
    console.log('工作流执行结果:', result);

    // 显示执行状态
    showExecutionStatus(result.executionId);
  } catch (error) {
    alert('执行工作流失败: ' + error.message);
  }
};

window.deleteWorkflow = async (id) => {
  if (confirm('确定要删除这个工作流吗？')) {
    try {
      await window.api.deleteWorkflow(id);
      // 重新加载工作流列表
      window.workflowManager.loadWorkflows().then(() => {
        window.workflowManager.render();
      });
    } catch (error) {
      alert('删除工作流失败: ' + error.message);
    }
  }
};
```

## 📊 监控和调试

### 浏览器开发者工具

```javascript
// 调试工具
window.debugFrys = {
  // 查看当前应用状态
  getAppState() {
    return {
      currentView: window.frysApp?.currentView,
      systemMetrics: window.frysApp?.metrics,
      workflows: window.workflowManager?.workflows,
    };
  },

  // 手动刷新数据
  refreshData() {
    if (window.frysApp) {
      window.frysApp.loadSystemStatus().then(() => {
        window.frysApp.render();
      });
    }
  },

  // 测试 API 连接
  async testAPI() {
    try {
      const result = await window.api.getSystemStatus();
      console.log('API 测试成功:', result);
      return result;
    } catch (error) {
      console.error('API 测试失败:', error);
      throw error;
    }
  },

  // 启用详细日志
  enableVerboseLogging() {
    localStorage.setItem('frys_debug', 'true');
    console.log('详细日志已启用');
  },

  // 禁用详细日志
  disableVerboseLogging() {
    localStorage.removeItem('frys_debug');
    console.log('详细日志已禁用');
  },
};

// 在控制台中使用
// debugFrys.getAppState()
// debugFrys.testAPI()
// debugFrys.enableVerboseLogging()
```

### 性能监控

```javascript
// 前端性能监控
class PerformanceMonitor {
  constructor() {
    this.metrics = {};
    this.init();
  }

  init() {
    // 监听页面性能指标
    if ('performance' in window) {
      window.addEventListener('load', () => {
        setTimeout(() => {
          this.collectPerformanceMetrics();
        }, 0);
      });
    }

    // 监听用户交互
    document.addEventListener('click', (e) => {
      this.trackInteraction('click', e.target);
    });

    // 监听 API 调用
    this.interceptFetch();
  }

  collectPerformanceMetrics() {
    const perfData = performance.getEntriesByType('navigation')[0];

    this.metrics = {
      dnsLookup: perfData.domainLookupEnd - perfData.domainLookupStart,
      tcpConnect: perfData.connectEnd - perfData.connectStart,
      serverResponse: perfData.responseStart - perfData.requestStart,
      pageLoad: perfData.loadEventEnd - perfData.loadEventStart,
      domReady:
        perfData.domContentLoadedEventEnd - perfData.domContentLoadedEventStart,
    };

    console.log('性能指标:', this.metrics);
  }

  trackInteraction(type, target) {
    const interaction = {
      type,
      target: target.tagName + (target.className ? '.' + target.className : ''),
      timestamp: Date.now(),
    };

    // 发送到后端或存储在本地
    this.sendTrackingData('interaction', interaction);
  }

  interceptFetch() {
    const originalFetch = window.fetch;

    window.fetch = async (...args) => {
      const startTime = Date.now();
      const url = args[0];

      try {
        const response = await originalFetch(...args);
        const duration = Date.now() - startTime;

        this.trackAPICall(url, duration, response.status);
        return response;
      } catch (error) {
        const duration = Date.now() - startTime;
        this.trackAPICall(url, duration, 0, error);
        throw error;
      }
    };
  }

  trackAPICall(url, duration, status, error = null) {
    const apiCall = {
      url,
      duration,
      status,
      error: error?.message,
      timestamp: Date.now(),
    };

    this.sendTrackingData('api_call', apiCall);
  }

  sendTrackingData(type, data) {
    // 在开发环境下输出到控制台
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Tracking] ${type}:`, data);
    }

    // 在生产环境下发送到监控服务
    // this.sendToMonitoringService(type, data);
  }

  getMetrics() {
    return this.metrics;
  }
}

// 启动性能监控
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.performanceMonitor = new PerformanceMonitor();
  });
} else {
  window.performanceMonitor = new PerformanceMonitor();
}
```

## 🚀 部署和分发

### 静态文件服务

```javascript
// 简单的静态文件服务器配置 (Express.js)
const express = require('express');
const path = require('path');

const app = express();

// 服务静态文件
app.use(express.static(path.join(__dirname, 'web')));

// API 代理 (开发环境)
app.use('/api', (req, res) => {
  const apiUrl = 'http://localhost:3000' + req.url;
  // 代理请求到后端API
});

// SPA 路由回退
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'web/index.html'));
});

app.listen(8080, () => {
  console.log('前端服务器运行在 http://localhost:8080');
});
```

### CDN 部署

```html
<!-- 使用 CDN 加速静态资源 -->
<head>
  <link
    rel="stylesheet"
    href="https://cdn.jsdelivr.net/npm/frys-web@1.0.0/styles.css"
  />
  <script src="https://cdn.jsdelivr.net/npm/frys-web@1.0.0/app.js"></script>
</head>
```

### PWA 支持 (未来)

```javascript
// service-worker.js
self.addEventListener('install', (event) => {
  // 缓存关键资源
});

self.addEventListener('fetch', (event) => {
  // 实现离线支持
});
```

## 🔧 开发工具

### 推荐工具

- **VS Code**: 优秀的代码编辑器
- **Live Server**: 本地开发服务器
- **Prettier**: 代码格式化
- **ESLint**: JavaScript 代码检查

### VS Code 配置

```json
// .vscode/settings.json
{
  "emmet.includeLanguages": {
    "javascript": "html"
  },
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "css.validate": false,
  "less.validate": false,
  "scss.validate": false
}
```

### 调试技巧

```javascript
// 1. 浏览器开发者工具
// - 查看网络请求
// - 检查控制台错误
// - 使用断点调试

// 2. 性能分析
// - 使用 Performance 标签分析页面性能
// - 查看内存使用情况
// - 分析网络请求时间

// 3. 移动端调试
// - 使用 Chrome DevTools 的设备模式
// - 真机调试 (USB 连接)

// 4. 常见调试命令
console.table(window.frysApp.getAppState()); // 表格形式查看应用状态
console.time('operation'); // 开始计时
// 执行某些操作
console.timeEnd('operation'); // 结束计时
```

## 📚 相关资源

- **[快速开始](../../GETTING_STARTED.md)** - 完整使用指南
- **[API 文档](../api/README.md)** - 后端接口文档
- **[部署指南](../deployment/production-setup.md)** - 生产环境部署
- **[样式指南](../STYLE_GUIDE.md)** - 文档编写规范

---

<div align="center">

## 🌟 贡献前端开发

**欢迎参与 frys 前端界面改进！**

[🏠 返回项目主页](../../README.md) • [📖 查看完整文档](../README.md) • [🚀 开始开发](../../GETTING_STARTED.md)

---

_最后更新: 2025年11月7日_

</div>
