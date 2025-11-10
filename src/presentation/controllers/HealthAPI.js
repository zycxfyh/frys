/**
 * 健康检查API
 */

export class HealthAPI {
  constructor(options = {}) {
    this.basePath = options.basePath || '/api/health';
    this.startTime = new Date();
    this.logger = options.logger || console;
  }

  /**
   * 获取路由配置
   */
  getRoutes() {
    return [
      {
        method: 'GET',
        path: this.basePath,
        handler: this.healthCheck.bind(this),
        description: '健康检查',
      },
      {
        method: 'GET',
        path: `${this.basePath}/detailed`,
        handler: this.detailedHealthCheck.bind(this),
        description: '详细健康检查',
      },
      {
        method: 'GET',
        path: `${this.basePath}/ping`,
        handler: this.ping.bind(this),
        description: '简单连通性检查',
      },
    ];
  }

  /**
   * 基础健康检查
   */
  async healthCheck(req, res) {
    try {
      const health = await this.performHealthCheck();

      const statusCode = health.healthy ? 200 : 503;
      res.status(statusCode).json({
        status: health.healthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: this.getUptime(),
        version: '1.0.0',
        checks: health.checks,
      });
    } catch (error) {
      this.logger.error('健康检查失败', error);
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message,
      });
    }
  }

  /**
   * 详细健康检查
   */
  async detailedHealthCheck(req, res) {
    try {
      const health = await this.performDetailedHealthCheck();

      const statusCode = health.healthy ? 200 : 503;
      res.status(statusCode).json(health);
    } catch (error) {
      this.logger.error('详细健康检查失败', error);
      res.status(503).json({
        healthy: false,
        timestamp: new Date().toISOString(),
        error: error.message,
      });
    }
  }

  /**
   * 简单连通性检查
   */
  ping(req, res) {
    res.json({
      status: 'pong',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 执行健康检查
   */
  async performHealthCheck() {
    const checks = {
      uptime: 'healthy',
      memory: 'healthy',
      timestamp: new Date().toISOString(),
    };

    // 检查内存使用
    const memUsage = process.memoryUsage();
    if (memUsage.heapUsed > memUsage.heapTotal * 0.9) {
      checks.memory = 'warning';
    }

    // 检查运行时间
    const uptime = this.getUptime();
    if (uptime < 10) { // 少于10秒可能表示刚刚重启
      checks.uptime = 'warning';
    }

    const healthy = Object.values(checks).every(status => status === 'healthy');

    return {
      healthy,
      checks,
    };
  }

  /**
   * 执行详细健康检查
   */
  async performDetailedHealthCheck() {
    const health = await this.performHealthCheck();

    // 添加详细指标
    health.details = {
      process: {
        pid: process.pid,
        uptime: this.getUptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
      },
      system: {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        totalMemory: this.getTotalMemory(),
        freeMemory: this.getFreeMemory(),
      },
      timestamp: new Date().toISOString(),
    };

    return health;
  }

  /**
   * 获取运行时间（秒）
   */
  getUptime() {
    return Math.floor((Date.now() - this.startTime.getTime()) / 1000);
  }

  /**
   * 获取系统总内存
   */
  getTotalMemory() {
    try {
      const os = require('os');
      return os.totalmem();
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * 获取系统可用内存
   */
  getFreeMemory() {
    try {
      const os = require('os');
      return os.freemem();
    } catch (error) {
      return 'unknown';
    }
  }
}
