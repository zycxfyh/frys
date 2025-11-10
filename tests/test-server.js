/**
 * 测试用的Mock HTTP服务器
 * 用于集成测试，提供模拟的API端点
 */

const express = require('express');
const http = require('http');

class TestServer {
  constructor(port = 0) { // port = 0 让系统自动分配端口
    this.app = express();
    this.server = null;
    this.port = port;
    this.address = null;

    this.setupRoutes();
  }

  setupRoutes() {
    // 中间件
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // 认证相关路由
    this.app.get('/api/auth/profile', (req, res) => {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // 简单验证token格式
      const token = authHeader.substring(7);
      if (token.length < 10) {
        return res.status(401).json({ error: 'Invalid token' });
      }

      res.json({
        user: {
          id: 123,
          username: 'testuser',
          email: 'test@example.com',
          role: 'admin'
        },
        success: true
      });
    });

    this.app.post('/api/auth/login', (req, res) => {
      const { username, password } = req.body;
      if (username === 'testuser' && password === 'password') {
        res.json({
          token: 'mock.jwt.token',
          user: { id: 123, username: 'testuser' },
          success: true
        });
      } else {
        res.status(401).json({ error: 'Invalid credentials' });
      }
    });

    this.app.post('/api/auth/register', (req, res) => {
      const { username, email } = req.body;
      if (username && email) {
        res.json({
          user: { id: 124, username, email },
          success: true
        });
      } else {
        res.status(400).json({ error: 'Missing required fields' });
      }
    });

    // AI 相关路由
    this.app.post('/api/ai/conversations', (req, res) => {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      res.json({
        conversationId: 'conv-' + Date.now(),
        model: req.body.model || 'gpt-4',
        hasMemory: false,
        createdAt: new Date().toISOString(),
        success: true
      });
    });

    this.app.post('/api/ai/conversations/:id/messages', (req, res) => {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      res.json({
        message: {
          content: 'Mock AI response to: ' + req.body.message,
          role: 'assistant',
          responseTime: 100
        },
        conversation: { id: req.params.id },
        success: true
      });
    });

    // 用户相关路由
    this.app.get('/users/profile', (req, res) => {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      res.json({
        user: { id: 123, username: 'testuser', email: 'test@example.com' },
        success: true
      });
    });

    this.app.get('/users/:id/profile', (req, res) => {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      res.json({
        user: { id: parseInt(req.params.id), username: 'user' + req.params.id },
        success: true
      });
    });

    // 受保护资源路由
    this.app.get('/protected/resource', (req, res) => {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      res.json({ data: 'protected resource', access: 'granted' });
    });

    // API数据路由
    this.app.get('/api/data/:id', (req, res) => {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      res.json({
        id: req.params.id,
        data: `Data for id ${req.params.id}`,
        timestamp: new Date().toISOString()
      });
    });

    // 安全路由
    this.app.get('/secure/profile', (req, res) => {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      res.json({
        user: { id: 'secureuser', username: 'secureuser' },
        secure: true
      });
    });

    // 会话路由
    this.app.post('/auth/session', (req, res) => {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      res.json({
        sessionId: 'test-session-' + Date.now(),
        valid: true,
        user: req.headers['x-session-user'] || 'testuser'
      });
    });

    // 登录路由
    this.app.post('/auth/login', (req, res) => {
      const { username, password } = req.body;
      if (username && password) {
        res.json({
          token: 'mock.jwt.token',
          user: { id: 123, username },
          success: true
        });
      } else {
        res.status(401).json({ error: 'Invalid credentials' });
      }
    });

    // 用户数据路由
    this.app.get('/api/user/data', (req, res) => {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      res.json({
        userData: { id: 'secureuser', permissions: ['read', 'write'] },
        sensitive: false // 确保不泄露敏感数据
      });
    });

    // 健康检查
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0-test'
      });
    });

    // 404 处理
    this.app.use((req, res) => {
      res.status(404).json({
        error: 'Not Found',
        path: req.path,
        method: req.method
      });
    });

    // 错误处理
    this.app.use((err, req, res, next) => {
      console.error('Test server error:', err);
      res.status(500).json({
        error: 'Internal Server Error',
        message: err.message
      });
    });
  }

  // 包装的路由方法
  get(path, handler) {
    this.app.get(path, handler);
  }

  post(path, handler) {
    this.app.post(path, handler);
  }

  put(path, handler) {
    this.app.put(path, handler);
  }

  delete(path, handler) {
    this.app.delete(path, handler);
  }

  async start() {
    return new Promise((resolve, reject) => {
      try {
        this.server = http.createServer(this.app);

        this.server.listen(this.port, '127.0.0.1', () => {
          this.address = this.server.address();
          this.port = this.address.port;
          console.log(`🧪 Test server started on http://127.0.0.1:${this.port}`);
          resolve(this);
        });

        this.server.on('error', (err) => {
          console.error('Test server failed to start:', err);
          reject(err);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  async stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('🧪 Test server stopped');
          this.server = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  getUrl(path = '') {
    return `http://127.0.0.1:${this.port}${path}`;
  }
}

module.exports = TestServer;
