/**
 * frys - 追踪HTTP中间件
 * 自动为HTTP请求创建跨度和注入追踪上下文
 */

import { logger } from '../../shared/utils/logger.js';

export class TracingMiddleware {
  constructor(tracer, config = {}) {
    this.tracer = tracer;
    this.config = {
      includeHeaders: config.includeHeaders !== false,
      includeQuery: config.includeQuery !== false,
      includeBody: config.includeBody !== false,
      maxBodyLength: config.maxBodyLength || 1000,
      excludePaths: config.excludePaths || [],
      excludeMethods: config.excludeMethods || [],
      ...config,
    };
  }

  /**
   * Express中间件函数
   */
  middleware() {
    return async (req, res, next) => {
      try {
        await this._handleRequest(req, res, next);
      } catch (error) {
        logger.error('追踪中间件处理请求失败', error);
        // 即使追踪失败，也要继续处理请求
        next();
      }
    };
  }

  /**
   * 处理HTTP请求
   */
  async _handleRequest(req, res, next) {
    // 检查是否应该跳过追踪
    if (this._shouldSkipTracing(req)) {
      return next();
    }

    // 从请求头提取追踪上下文
    const extractedContext = this._extractContextFromHeaders(req);

    // 创建请求跨度
    const span = this.tracer.createSpanFromContext(
      extractedContext,
      `${req.method} ${req.route?.path || req.path}`,
      {
        kind: 'server',
        component: 'http',
        'http.method': req.method,
        'http.url': this._getRequestUrl(req),
        'http.scheme': req.protocol,
        'http.host': req.get('host'),
        'http.target': req.originalUrl,
        'http.user_agent': req.get('User-Agent'),
        'http.remote_addr': this._getClientIP(req),
        'net.transport': 'IP_TCP',
      },
    );

    if (!span) {
      // 不采样，继续处理请求
      return next();
    }

    // 设置请求标签
    this._setRequestTags(span, req);

    // 记录请求开始
    span.log('request_start', {
      method: req.method,
      url: req.originalUrl,
      headers: this.config.includeHeaders
        ? this._sanitizeHeaders(req.headers)
        : undefined,
      query: this.config.includeQuery ? req.query : undefined,
      body: this.config.includeBody ? this._sanitizeBody(req.body) : undefined,
    });

    // 将跨度存储在请求对象中
    req.tracingSpan = span;

    // 拦截响应
    this._interceptResponse(span, res);

    // 处理请求
    try {
      await new Promise((resolve, reject) => {
        const originalNext = next;
        next = (error) => {
          if (error) {
            span.setError(error);
            reject(error);
          } else {
            resolve();
          }
        };

        originalNext();
      });
    } catch (error) {
      // 错误已经在上面的next中处理了
      throw error;
    }
  }

  /**
   * 检查是否应该跳过追踪
   */
  _shouldSkipTracing(req) {
    // 检查排除路径
    for (const pattern of this.config.excludePaths) {
      if (typeof pattern === 'string' && req.path === pattern) {
        return true;
      }
      if (pattern instanceof RegExp && pattern.test(req.path)) {
        return true;
      }
    }

    // 检查排除方法
    if (this.config.excludeMethods.includes(req.method.toUpperCase())) {
      return true;
    }

    return false;
  }

  /**
   * 从请求头提取追踪上下文
   */
  _extractContextFromHeaders(req) {
    // 支持多种追踪头格式
    const traceId = req.get('x-trace-id') || req.get('x-b3-traceid');
    const spanId = req.get('x-span-id') || req.get('x-b3-spanid');
    const parentSpanId =
      req.get('x-parent-span-id') || req.get('x-b3-parentspanid');

    if (traceId && spanId) {
      return { traceId, spanId, parentSpanId, sampled: true };
    }

    return null;
  }

  /**
   * 设置请求标签
   */
  _setRequestTags(span, req) {
    // HTTP相关标签
    span.setTag('http.method', req.method);
    span.setTag('http.url', this._getRequestUrl(req));
    span.setTag('http.scheme', req.protocol);
    span.setTag('http.host', req.get('host') || 'unknown');
    span.setTag('http.target', req.originalUrl);
    span.setTag('http.flavor', `HTTP/${req.httpVersion}`);

    // 客户端信息
    span.setTag('http.user_agent', req.get('User-Agent'));
    span.setTag('net.peer.ip', this._getClientIP(req));
    span.setTag('net.peer.port', req.socket?.remotePort);

    // 路由信息（如果可用）
    if (req.route) {
      span.setTag('http.route', req.route.path);
    }

    // 请求大小
    if (req.headers['content-length']) {
      span.setTag(
        'http.request_content_length',
        parseInt(req.headers['content-length']),
      );
    }
  }

  /**
   * 拦截响应
   */
  _interceptResponse(span, res) {
    const originalWriteHead = res.writeHead;
    const originalEnd = res.end;
    let responseStarted = false;

    // 拦截响应头设置
    res.writeHead = function (statusCode, statusMessage, headers) {
      if (!responseStarted) {
        responseStarted = true;

        // 设置响应标签
        span.setTag('http.status_code', statusCode);
        span.setTag('http.status_message', statusMessage);

        // 记录响应开始
        span.log('response_start', {
          statusCode,
          statusMessage,
          headers: headers ? this._sanitizeHeaders(headers) : undefined,
        });

        // 注入追踪头到响应
        if (this.config.includeHeaders) {
          res.setHeader('x-trace-id', span.traceId);
          res.setHeader('x-span-id', span.spanId);
        }
      }

      return originalWriteHead.apply(this, arguments);
    }.bind(this);

    // 拦截响应结束
    res.end = function (chunk, encoding, callback) {
      if (!responseStarted) {
        responseStarted = true;
        span.setTag('http.status_code', res.statusCode || 200);
      }

      // 计算响应大小
      if (chunk && typeof chunk === 'string') {
        span.setTag(
          'http.response_content_length',
          Buffer.byteLength(chunk, encoding),
        );
      } else if (chunk && Buffer.isBuffer(chunk)) {
        span.setTag('http.response_content_length', chunk.length);
      }

      // 记录响应完成
      span.log('response_end', {
        statusCode: res.statusCode,
        contentLength: res.getHeader('content-length'),
      });

      // 完成跨度
      span.finish();

      return originalEnd.apply(this, arguments);
    };
  }

  /**
   * 获取请求URL
   */
  _getRequestUrl(req) {
    return `${req.protocol}://${req.get('host')}${req.originalUrl}`;
  }

  /**
   * 获取客户端IP
   */
  _getClientIP(req) {
    return (
      req.ip ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      req.connection?.socket?.remoteAddress ||
      'unknown'
    );
  }

  /**
   * 清理请求头（移除敏感信息）
   */
  _sanitizeHeaders(headers) {
    const sanitized = { ...headers };
    const sensitiveHeaders = [
      'authorization',
      'cookie',
      'x-api-key',
      'x-auth-token',
    ];

    for (const header of sensitiveHeaders) {
      if (sanitized[header]) {
        sanitized[header] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  /**
   * 清理请求体
   */
  _sanitizeBody(body) {
    if (!body) return undefined;

    if (typeof body === 'string') {
      return body.length > this.config.maxBodyLength
        ? `${body.substring(0, this.config.maxBodyLength)}...`
        : body;
    }

    if (typeof body === 'object') {
      const sanitized = this._sanitizeObject(body);
      return JSON.stringify(sanitized).length > this.config.maxBodyLength
        ? `${JSON.stringify(sanitized).substring(
            0,
            this.config.maxBodyLength,
          )}...`
        : sanitized;
    }

    return String(body);
  }

  /**
   * 清理对象（移除敏感字段）
   */
  _sanitizeObject(obj) {
    if (!obj || typeof obj !== 'object') return obj;

    const sanitized = { ...obj };
    const sensitiveFields = [
      'password',
      'token',
      'secret',
      'key',
      'credential',
    ];

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  /**
   * 创建客户端追踪中间件
   * 用于HTTP客户端请求
   */
  static createClientMiddleware(tracer, config = {}) {
    return async (requestConfig) => {
      // 获取当前跨度
      const currentSpan = tracer.getCurrentSpan();

      if (!currentSpan) {
        return requestConfig;
      }

      // 创建子跨度
      const span = tracer.createChildSpan(
        currentSpan,
        `${requestConfig.method || 'GET'} ${requestConfig.url}`,
        {
          kind: 'client',
          component: 'http_client',
          'http.method': requestConfig.method || 'GET',
          'http.url': requestConfig.url,
          'net.peer.name': new URL(requestConfig.url).hostname,
        },
      );

      if (span) {
        // 注入追踪头
        requestConfig.headers = requestConfig.headers || {};
        span.inject(requestConfig.headers, 'http_headers');

        // 记录请求
        span.log('client_request', {
          method: requestConfig.method,
          url: requestConfig.url,
          headers: config.includeHeaders ? requestConfig.headers : undefined,
        });

        // 包装响应处理
        const originalTransformResponse = requestConfig.transformResponse;
        requestConfig.transformResponse = (data, headers, status) => {
          // 记录响应
          span.setTag('http.status_code', status);
          span.log('client_response', {
            statusCode: status,
            contentLength: headers['content-length'],
          });

          span.finish();

          // 调用原始转换函数
          return originalTransformResponse
            ? originalTransformResponse(data, headers, status)
            : data;
        };
      }

      return requestConfig;
    };
  }

  /**
   * 数据库查询追踪中间件
   */
  static createDatabaseMiddleware(tracer, config = {}) {
    return async (query, options = {}) => {
      const currentSpan = tracer.getCurrentSpan();

      if (!currentSpan) {
        return query();
      }

      const span = tracer.createChildSpan(currentSpan, `db.query`, {
        component: 'database',
        'db.type': options.dialect || 'unknown',
        'db.instance': options.database,
        'db.statement': config.includeQuery ? options.sql : 'SELECT ...',
        'db.user': options.username,
      });

      if (span) {
        try {
          const startTime = Date.now();
          const result = await query();

          span.setTag('db.rows_affected', result?.rowCount || 0);
          span.setTag('db.duration', Date.now() - startTime);

          span.finish();
          return result;
        } catch (error) {
          span.setError(error);
          span.finish();
          throw error;
        }
      }

      return query();
    };
  }

  /**
   * Redis操作追踪中间件
   */
  static createRedisMiddleware(tracer, config = {}) {
    return (command, args) => {
      const currentSpan = tracer.getCurrentSpan();

      if (!currentSpan) {
        return;
      }

      const span = tracer.createChildSpan(
        currentSpan,
        `redis.${command.toLowerCase()}`,
        {
          component: 'redis',
          'redis.command': command,
          'redis.key': config.includeKeys ? args[0] : undefined,
          'redis.args_count': args.length,
        },
      );

      if (span) {
        // 这里需要在Redis客户端中集成实际的开始和结束记录
        span.log('redis_command', {
          command,
          args: config.includeArgs ? args : undefined,
        });

        // 实际使用时需要在Redis客户端的回调中调用span.finish()
        return span;
      }
    };
  }
}
