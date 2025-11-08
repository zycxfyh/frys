/**
 * 缓存中间件
 * 为HTTP请求提供缓存功能
 */

import { logger } from '../../utils/logger.js';

export class CacheMiddleware {
  constructor(cacheService, options = {}) {
    this.cacheService = cacheService;
    this.options = {
      defaultTtl: options.defaultTtl || 300000, // 5分钟
      cacheableMethods: options.cacheableMethods || ['GET'],
      cacheableStatusCodes: options.cacheableStatusCodes || [200, 201, 202],
      cacheKeyGenerator:
        options.cacheKeyGenerator || this.defaultCacheKeyGenerator,
      shouldCache: options.shouldCache || this.defaultShouldCache,
      ...options,
    };

    this.cache = new Map(); // 简化的响应缓存
  }

  /**
   * HTTP缓存中间件
   */
  httpCache() {
    return async (req, res, next) => {
      try {
        // 检查是否应该缓存
        if (!this.shouldCacheRequest(req)) {
          return next();
        }

        // 生成缓存键
        const cacheKey = this.generateCacheKey(req);

        // 尝试从缓存获取
        const cachedResponse = await this.getCachedResponse(cacheKey);
        if (cachedResponse) {
          logger.debug('HTTP缓存命中', {
            method: req.method,
            url: req.url,
            cacheKey,
          });

          // 返回缓存的响应
          res.set(cachedResponse.headers);
          res.status(cachedResponse.statusCode).send(cachedResponse.body);
          return;
        }

        // 拦截响应进行缓存
        this.interceptResponse(req, res, cacheKey, next);
      } catch (error) {
        logger.error('HTTP缓存中间件错误', error);
        next();
      }
    };
  }

  /**
   * 检查是否应该缓存请求
   */
  shouldCacheRequest(req) {
    return (
      this.options.cacheableMethods.includes(req.method) &&
      this.options.shouldCache(req)
    );
  }

  /**
   * 生成缓存键
   */
  generateCacheKey(req) {
    return this.options.cacheKeyGenerator(req);
  }

  /**
   * 默认缓存键生成器
   */
  defaultCacheKeyGenerator(req) {
    const keyParts = [
      req.method,
      req.url,
      JSON.stringify(req.query || {}),
      JSON.stringify(req.body || {}),
      req.user?.id || 'anonymous',
    ];

    return `http:${keyParts.join(':')}`;
  }

  /**
   * 默认缓存判断函数
   */
  defaultShouldCache(req) {
    // 不缓存以下情况：
    // - 认证相关的请求
    // - 文件上传
    // - 管理员操作
    const noCachePatterns = [
      /\/auth\//,
      /\/admin\//,
      /\/upload\//,
      /\/api\/.*\/(create|update|delete)/,
    ];

    return !noCachePatterns.some((pattern) => pattern.test(req.url));
  }

  /**
   * 获取缓存的响应
   */
  async getCachedResponse(cacheKey) {
    try {
      const cached = await this.cacheService.get(cacheKey, {
        strategy: 'api',
      });

      if (cached && cached.expiry > Date.now()) {
        return cached;
      }

      return null;
    } catch (error) {
      logger.warn('获取缓存响应失败', error);
      return null;
    }
  }

  /**
   * 拦截响应进行缓存
   */
  interceptResponse(req, res, cacheKey, next) {
    const originalSend = res.send;
    const originalJson = res.json;
    const originalEnd = res.end;

    let responseBody = '';
    let responseSent = false;

    // 拦截send方法
    res.send = (body) => {
      if (!responseSent) {
        responseBody = body;
        this.cacheResponseIfAppropriate(req, res, cacheKey, body);
        responseSent = true;
      }
      return originalSend.call(res, body);
    };

    // 拦截json方法
    res.json = (body) => {
      if (!responseSent) {
        responseBody = JSON.stringify(body);
        this.cacheResponseIfAppropriate(req, res, cacheKey, responseBody);
        responseSent = true;
      }
      return originalJson.call(res, body);
    };

    // 拦截end方法
    res.end = (data) => {
      if (data && !responseSent) {
        responseBody = data;
        this.cacheResponseIfAppropriate(req, res, cacheKey, responseBody);
      }
      return originalEnd.call(res, data);
    };

    next();
  }

  /**
   * 根据条件缓存响应
   */
  async cacheResponseIfAppropriate(req, res, cacheKey, body) {
    try {
      // 检查响应状态码是否应该缓存
      if (!this.options.cacheableStatusCodes.includes(res.statusCode)) {
        return;
      }

      // 检查响应头
      const headers = res.getHeaders ? res.getHeaders() : {};
      if (
        headers['cache-control'] === 'no-cache' ||
        headers['pragma'] === 'no-cache'
      ) {
        return;
      }

      // 构建缓存对象
      const cachedResponse = {
        statusCode: res.statusCode,
        headers: {
          'content-type': headers['content-type'] || 'application/json',
          'x-cached-at': new Date().toISOString(),
          'x-cache-ttl': `${this.options.defaultTtl / 1000  }s`,
        },
        body,
        expiry: Date.now() + this.options.defaultTtl,
      };

      // 缓存响应
      await this.cacheService.set(cacheKey, cachedResponse, {
        strategy: 'api',
        ttl: this.options.defaultTtl,
      });

      logger.debug('HTTP响应已缓存', {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        cacheKey,
      });
    } catch (error) {
      logger.error('缓存HTTP响应失败', error);
    }
  }

  /**
   * 清除URL缓存
   */
  async invalidateUrl(url, method = 'GET') {
    try {
      const cacheKey = `http:${method}:${url}:*:*:*`; // 简单的模式匹配
      const deleted = await this.cacheService.clear(`http:${method}:${url}*`, {
        strategy: 'api',
      });

      logger.info('URL缓存已清除', { url, method, deleted });
      return deleted;
    } catch (error) {
      logger.error('清除URL缓存失败', error);
      return false;
    }
  }

  /**
   * 清除用户缓存
   */
  async invalidateUserCache(userId) {
    try {
      const deleted = await this.cacheService.clear(`http:*:*:*:${userId}`, {
        strategy: 'api',
      });

      logger.info('用户缓存已清除', { userId, deleted });
      return deleted;
    } catch (error) {
      logger.error('清除用户缓存失败', error);
      return false;
    }
  }

  /**
   * 设置页面缓存
   */
  async cachePage(url, content, options = {}) {
    const cacheKey = `page:${url}`;
    const ttl = options.ttl || this.options.defaultTtl;

    try {
      await this.cacheService.set(
        cacheKey,
        {
          content,
          headers: options.headers || {},
          expiry: Date.now() + ttl,
        },
        {
          strategy: 'page',
          ttl,
        },
      );

      logger.debug('页面已缓存', { url, ttl });
      return true;
    } catch (error) {
      logger.error('页面缓存失败', error);
      return false;
    }
  }

  /**
   * 获取页面缓存
   */
  async getCachedPage(url) {
    const cacheKey = `page:${url}`;

    try {
      const cached = await this.cacheService.get(cacheKey, {
        strategy: 'page',
      });

      if (cached && cached.expiry > Date.now()) {
        logger.debug('页面缓存命中', { url });
        return cached;
      }

      return null;
    } catch (error) {
      logger.error('获取页面缓存失败', error);
      return null;
    }
  }

  /**
   * 清除页面缓存
   */
  async invalidatePageCache(urlPattern) {
    try {
      const deleted = await this.cacheService.clear(`page:${urlPattern}`, {
        strategy: 'page',
      });

      logger.info('页面缓存已清除', { urlPattern, deleted });
      return deleted;
    } catch (error) {
      logger.error('清除页面缓存失败', error);
      return false;
    }
  }

  /**
   * API缓存装饰器
   */
  apiCache(options = {}) {
    return (req, res, next) => {
      // 实现API级别的缓存逻辑
      this.httpCache()(req, res, next);
    };
  }

  /**
   * 数据库查询缓存装饰器
   */
  queryCache(options = {}) {
    return async (query, params = []) => {
      const cacheKey = `db:${query}:${JSON.stringify(params)}`;
      const ttl = options.ttl || this.options.defaultTtl;

      return await this.cacheService.getOrSet(
        cacheKey,
        async () => {
          // 这里应该执行实际的数据库查询
          // 暂时返回模拟结果
          return { query, params, result: 'mock_result' };
        },
        {
          strategy: 'database',
          ttl,
        },
      );
    };
  }

  /**
   * 获取缓存统计
   */
  getCacheStats() {
    return {
      middleware: {
        enabled: true,
        cacheableMethods: this.options.cacheableMethods,
        cacheableStatusCodes: this.options.cacheableStatusCodes,
      },
      service: this.cacheService.getCacheStats(),
    };
  }

  /**
   * 健康检查
   */
  async healthCheck() {
    try {
      const serviceHealth = await this.cacheService.healthCheck();

      return {
        middleware: 'cache',
        status: serviceHealth.status === 'healthy' ? 'healthy' : 'unhealthy',
        details: {
          serviceHealth,
          cacheableMethods: this.options.cacheableMethods.length,
          cacheableStatusCodes: this.options.cacheableStatusCodes.length,
        },
      };
    } catch (error) {
      return {
        middleware: 'cache',
        status: 'unhealthy',
        error: error.message,
      };
    }
  }
}

export default CacheMiddleware;
