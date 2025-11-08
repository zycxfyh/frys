/**
 * HTTP客户端连接池
 * 管理HTTP客户端连接的复用，减少连接开销
 */

import axios from 'axios';
import http from 'http';
import https from 'https';
import { AbstractResourcePool } from './AbstractResourcePool.js';
import { logger } from '../../shared/utils/logger.js';

export class HttpClientPool extends AbstractResourcePool {
  constructor(options = {}) {
    super({
      min: options.min || 2,
      max: options.max || 20,
      idleTimeoutMillis: options.idleTimeoutMillis || 60000, // 1分钟
      acquireTimeoutMillis: options.acquireTimeoutMillis || 10000, // 10秒
      ...options,
    });

    this.baseConfig = {
      timeout: options.timeout || 30000,
      maxRedirects: options.maxRedirects || 5,
      validateStatus: options.validateStatus || null,
      httpAgent: options.httpAgent,
      httpsAgent: options.httpsAgent,
      ...options.baseConfig,
    };

    // 创建HTTP代理（如果没有提供）
    if (!this.baseConfig.httpAgent) {
      this.baseConfig.httpAgent = new http.Agent({
        keepAlive: true,
        maxSockets: 50,
        maxFreeSockets: 10,
        timeout: 60000,
        keepAliveMsecs: 30000,
      });
    }

    if (!this.baseConfig.httpsAgent) {
      this.baseConfig.httpsAgent = new https.Agent({
        keepAlive: true,
        maxSockets: 50,
        maxFreeSockets: 10,
        timeout: 60000,
        keepAliveMsecs: 30000,
        rejectUnauthorized: options.rejectUnauthorized !== false,
      });
    }

    this.requestStats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      timeouts: 0,
      retries: 0,
      avgResponseTime: 0,
      totalResponseTime: 0,
    };
  }

  getResourceType() {
    return 'http_client';
  }

  async _createResource() {
    try {
      const client = axios.create({
        ...this.baseConfig,
        // 为每个客户端实例设置唯一的标识符
        _poolId: Math.random().toString(36).substr(2, 9),
        _createdAt: Date.now(),
        _requestCount: 0,
        _errorCount: 0,
      });

      // 添加请求拦截器
      client.interceptors.request.use(
        (config) => {
          config._startTime = Date.now();
          return config;
        },
        (error) => {
          return Promise.reject(error);
        },
      );

      // 添加响应拦截器
      client.interceptors.response.use(
        (response) => {
          this._recordRequestMetrics(
            response.config,
            response.status,
            Date.now() - response.config._startTime,
          );
          return response;
        },
        (error) => {
          const duration = error.config?._startTime
            ? Date.now() - error.config._startTime
            : 0;
          this._recordRequestMetrics(
            error.config,
            error.response?.status || 0,
            duration,
            error,
          );
          return Promise.reject(error);
        },
      );

      logger.debug('创建HTTP客户端', { poolId: client._poolId });
      return client;
    } catch (error) {
      logger.error('创建HTTP客户端失败', error);
      throw error;
    }
  }

  async _destroyResource(client) {
    try {
      // 清理拦截器
      client.interceptors.request.clear();
      client.interceptors.response.clear();

      // 销毁代理连接
      if (client.defaults.httpAgent) {
        client.defaults.httpAgent.destroy();
      }
      if (client.defaults.httpsAgent) {
        client.defaults.httpsAgent.destroy();
      }

      logger.debug('销毁HTTP客户端', {
        poolId: client._poolId,
        requestCount: client._requestCount,
        errorCount: client._errorCount,
      });
    } catch (error) {
      logger.error('销毁HTTP客户端失败', error);
    }
  }

  async _validateResource(client) {
    try {
      // 检查客户端是否仍然可用
      if (!client || typeof client.request !== 'function') {
        return false;
      }

      // 检查错误率是否过高
      const errorRate =
        client._requestCount > 0
          ? client._errorCount / client._requestCount
          : 0;
      if (errorRate > 0.5) {
        // 50%的错误率
        logger.warn('HTTP客户端错误率过高', {
          poolId: client._poolId,
          errorRate,
          requestCount: client._requestCount,
          errorCount: client._errorCount,
        });
        return false;
      }

      // 检查是否超时（例如，客户端创建太久）
      const age = Date.now() - client._createdAt;
      const maxAge = 30 * 60 * 1000; // 30分钟
      if (age > maxAge) {
        logger.debug('HTTP客户端过期', {
          poolId: client._poolId,
          age: `${Math.round(age / 1000 / 60)}分钟`,
        });
        return false;
      }

      return true;
    } catch (error) {
      logger.error('验证HTTP客户端失败', error);
      return false;
    }
  }

  _recordRequestMetrics(config, statusCode, duration, error = null) {
    this.requestStats.totalRequests++;

    if (error) {
      this.requestStats.failedRequests++;
      if (error.code === 'ECONNABORTED') {
        this.requestStats.timeouts++;
      }
    } else if (statusCode >= 200 && statusCode < 300) {
      this.requestStats.successfulRequests++;
    } else {
      this.requestStats.failedRequests++;
    }

    // 更新平均响应时间
    this.requestStats.totalResponseTime += duration;
    this.requestStats.avgResponseTime =
      this.requestStats.totalResponseTime / this.requestStats.totalRequests;
  }

  /**
   * 执行HTTP请求（使用池化的客户端）
   */
  async request(config) {
    return this.use(async (client) => {
      // 更新客户端统计
      client._requestCount++;

      try {
        const response = await client.request(config);
        return response;
      } catch (error) {
        client._errorCount++;
        throw error;
      }
    });
  }

  /**
   * GET请求
   */
  async get(url, config = {}) {
    return this.request({ ...config, method: 'get', url });
  }

  /**
   * POST请求
   */
  async post(url, data, config = {}) {
    return this.request({ ...config, method: 'post', url, data });
  }

  /**
   * PUT请求
   */
  async put(url, data, config = {}) {
    return this.request({ ...config, method: 'put', url, data });
  }

  /**
   * DELETE请求
   */
  async delete(url, config = {}) {
    return this.request({ ...config, method: 'delete', url });
  }

  /**
   * PATCH请求
   */
  async patch(url, data, config = {}) {
    return this.request({ ...config, method: 'patch', url, data });
  }

  /**
   * HEAD请求
   */
  async head(url, config = {}) {
    return this.request({ ...config, method: 'head', url });
  }

  /**
   * OPTIONS请求
   */
  async options(url, config = {}) {
    return this.request({ ...config, method: 'options', url });
  }

  /**
   * 获取HTTP客户端池的统计信息
   */
  getHttpStats() {
    const poolStats = this.getStats();

    return {
      ...poolStats,
      http: {
        ...this.requestStats,
        successRate:
          this.requestStats.totalRequests > 0
            ? (this.requestStats.successfulRequests /
                this.requestStats.totalRequests) *
              100
            : 0,
        errorRate:
          this.requestStats.totalRequests > 0
            ? (this.requestStats.failedRequests /
                this.requestStats.totalRequests) *
              100
            : 0,
        timeoutRate:
          this.requestStats.totalRequests > 0
            ? (this.requestStats.timeouts / this.requestStats.totalRequests) *
              100
            : 0,
      },
      agent: {
        http: {
          sockets: this.baseConfig.httpAgent?.sockets
            ? Object.keys(this.baseConfig.httpAgent.sockets).length
            : 0,
          freeSockets: this.baseConfig.httpAgent?.freeSockets
            ? Object.keys(this.baseConfig.httpAgent.freeSockets).length
            : 0,
          requests: this.baseConfig.httpAgent?.requests?.size || 0,
        },
        https: {
          sockets: this.baseConfig.httpsAgent?.sockets
            ? Object.keys(this.baseConfig.httpsAgent.sockets).length
            : 0,
          freeSockets: this.baseConfig.httpsAgent?.freeSockets
            ? Object.keys(this.baseConfig.httpsAgent.freeSockets).length
            : 0,
          requests: this.baseConfig.httpsAgent?.requests?.size || 0,
        },
      },
    };
  }

  /**
   * 配置基础设置
   */
  configureBaseConfig(config) {
    this.baseConfig = { ...this.baseConfig, ...config };

    // 如果提供了新的代理，更新现有资源
    if (config.httpAgent || config.httpsAgent) {
      logger.info('更新HTTP客户端池代理配置');
      // 注意：现有客户端不会立即更新，需要等待它们被重新创建
    }
  }

  /**
   * 清理统计数据
   */
  resetStats() {
    this.requestStats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      timeouts: 0,
      retries: 0,
      avgResponseTime: 0,
      totalResponseTime: 0,
    };

    logger.info('HTTP客户端池统计数据已重置');
  }

  /**
   * 设置重试策略
   */
  setRetryStrategy(strategy) {
    this.retryStrategy = strategy;
    logger.info('HTTP客户端池重试策略已更新', strategy);
  }

  /**
   * 创建具有特定配置的客户端
   */
  async createConfiguredClient(config = {}) {
    const clientConfig = { ...this.baseConfig, ...config };
    const client = axios.create(clientConfig);

    // 添加相同的拦截器
    client.interceptors.request.use(
      (config) => {
        config._startTime = Date.now();
        return config;
      },
      (error) => Promise.reject(error),
    );

    client.interceptors.response.use(
      (response) => {
        this._recordRequestMetrics(
          response.config,
          response.status,
          Date.now() - response.config._startTime,
        );
        return response;
      },
      (error) => {
        const duration = error.config?._startTime
          ? Date.now() - error.config._startTime
          : 0;
        this._recordRequestMetrics(
          error.config,
          error.response?.status || 0,
          duration,
          error,
        );
        return Promise.reject(error);
      },
    );

    return client;
  }
}
