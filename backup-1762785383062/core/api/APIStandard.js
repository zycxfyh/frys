/**
 * API标准化框架
 * 提供RESTful设计、版本化、文档化和统一响应格式
 */

import { logger } from '../../shared/utils/logger.js';
import { ErrorHandlerUtils } from '../../shared/utils/ErrorHandlerUtils.js';
import { ResourceCleanupUtils } from '../../shared/utils/ResourceCleanupUtils.js';

export class APIStandard {
  constructor(options = {}) {
    this.options = {
      version: 'v1',
      enableDocumentation: true,
      enableValidation: true,
      enableRateLimiting: false,
      enableCaching: false,
      defaultTimeout: 30000,
      maxRequestSize: '10mb',
      corsEnabled: true,
      ...options
    };

    // API版本管理
    this.versions = new Map();
    this.currentVersion = this.options.version;

    // 路由管理
    this.routes = new Map();
    this.middlewares = new Map();

    // 响应格式化器
    this.responseFormatters = new Map();

    // 错误处理器
    this.errorHandlers = new Map();

    // API文档
    this.documentation = {
      info: {
        title: 'API Documentation',
        version: this.options.version,
        description: 'Auto-generated API documentation'
      },
      paths: {},
      components: {},
      tags: []
    };

    // 统计信息
    this.stats = {
      requests: 0,
      errors: 0,
      averageResponseTime: 0,
      endpoints: 0
    };

    // 清理管理器
    this.cleanupManager = ResourceCleanupUtils.createCleanupManager('api_standard');

    // 初始化
    this._initialize();

    logger.info('API Standard initialized', {
      version: this.options.version,
      documentation: this.options.enableDocumentation,
      validation: this.options.enableValidation
    });
  }

  /**
   * 定义API版本
   * @param {string} version - 版本号
   * @param {Object} config - 版本配置
   */
  defineVersion(version, config = {}) {
    const versionDefinition = {
      version,
      config: {
        basePath: `/api/${version}`,
        deprecated: false,
        sunsetDate: null,
        migrationGuide: null,
        ...config
      },
      routes: new Map(),
      middlewares: [],
      createdAt: Date.now()
    };

    this.versions.set(version, versionDefinition);

    if (this.options.enableDocumentation) {
      this._updateDocumentationVersion(version, versionDefinition);
    }

    logger.debug(`API version defined: ${version}`, {
      basePath: versionDefinition.config.basePath,
      deprecated: versionDefinition.config.deprecated
    });

    return this;
  }

  /**
   * 注册路由
   * @param {string} method - HTTP方法
   * @param {string} path - 路由路径
   * @param {Function} handler - 处理函数
   * @param {Object} options - 路由选项
   */
  registerRoute(method, path, handler, options = {}) {
    const routeDefinition = {
      method: method.toUpperCase(),
      path,
      handler,
      options: {
        version: this.currentVersion,
        middlewares: [],
        validation: null,
        documentation: {},
        rateLimit: null,
        cache: null,
        timeout: this.options.defaultTimeout,
        ...options
      },
      registeredAt: Date.now(),
      callCount: 0,
      errorCount: 0,
      averageResponseTime: 0
    };

    // 获取版本路由表
    const versionRoutes = this._getVersionRoutes(routeDefinition.options.version);
    const routeKey = `${routeDefinition.method}:${routeDefinition.path}`;

    versionRoutes.set(routeKey, routeDefinition);
    this.stats.endpoints++;

    // 注册到全局路由表
    if (!this.routes.has(routeDefinition.options.version)) {
      this.routes.set(routeDefinition.options.version, new Map());
    }
    this.routes.get(routeDefinition.options.version).set(routeKey, routeDefinition);

    // 更新文档
    if (this.options.enableDocumentation) {
      this._updateDocumentationRoute(routeDefinition);
    }

    logger.debug(`Route registered: ${routeDefinition.method} ${routeDefinition.path}`, {
      version: routeDefinition.options.version,
      hasValidation: !!routeDefinition.options.validation,
      middlewares: routeDefinition.options.middlewares.length
    });

    return this;
  }

  /**
   * 注册中间件
   * @param {string} name - 中间件名称
   * @param {Function} middleware - 中间件函数
   * @param {Object} options - 中间件选项
   */
  registerMiddleware(name, middleware, options = {}) {
    const middlewareDefinition = {
      name,
      middleware,
      options: {
        priority: 0,
        global: false,
        versions: ['*'], // * 表示所有版本
        paths: ['*'], // * 表示所有路径
        ...options
      },
      registeredAt: Date.now(),
      usageCount: 0
    };

    this.middlewares.set(name, middlewareDefinition);

    logger.debug(`Middleware registered: ${name}`, {
      priority: middlewareDefinition.options.priority,
      global: middlewareDefinition.options.global,
      versions: middlewareDefinition.options.versions
    });

    return this;
  }

  /**
   * 注册响应格式化器
   * @param {string} type - 格式化器类型
   * @param {Function} formatter - 格式化函数
   */
  registerResponseFormatter(type, formatter) {
    this.responseFormatters.set(type, {
      type,
      formatter,
      registeredAt: Date.now()
    });

    logger.debug(`Response formatter registered: ${type}`);
    return this;
  }

  /**
   * 注册错误处理器
   * @param {string} errorType - 错误类型
   * @param {Function} handler - 错误处理函数
   */
  registerErrorHandler(errorType, handler) {
    this.errorHandlers.set(errorType, {
      errorType,
      handler,
      registeredAt: Date.now()
    });

    logger.debug(`Error handler registered: ${errorType}`);
    return this;
  }

  /**
   * 处理API请求
   * @param {Object} request - 请求对象
   * @param {Object} response - 响应对象
   * @param {Object} context - 请求上下文
   * @returns {Promise<Object>} 处理结果
   */
  async handleRequest(request, response, context = {}) {
    const startTime = Date.now();
    this.stats.requests++;

    try {
      // 解析请求
      const parsedRequest = this._parseRequest(request, context);

      // 查找路由
      const route = this._findRoute(parsedRequest);
      if (!route) {
        return this._createErrorResponse('NOT_FOUND', 'Route not found', 404);
      }

      // 执行中间件
      const middlewareResult = await this._executeMiddlewares(route, parsedRequest, context);
      if (middlewareResult.error) {
        return middlewareResult;
      }

      // 验证请求
      if (this.options.enableValidation && route.options.validation) {
        const validationResult = await this._validateRequest(parsedRequest, route.options.validation);
        if (!validationResult.valid) {
          return this._createErrorResponse('VALIDATION_ERROR', validationResult.errors, 400);
        }
      }

      // 执行处理器
      const result = await this._executeHandler(route, parsedRequest, context);

      // 格式化响应
      const formattedResponse = this._formatResponse(result, route, parsedRequest);

      // 更新统计信息
      const responseTime = Date.now() - startTime;
      this._updateRouteStats(route, responseTime, false);

      // 更新全局统计
      this._updateGlobalStats(responseTime);

      return formattedResponse;

    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.stats.errors++;

      logger.error('API request failed', {
        method: request.method,
        path: request.path,
        error: error.message,
        responseTime
      });

      // 处理错误
      const errorResponse = await this._handleError(error, request, context);

      // 更新统计信息
      this._updateGlobalStats(responseTime);

      return errorResponse;
    }
  }

  /**
   * 生成API文档
   * @param {string} format - 文档格式 (json, yaml, html)
   * @returns {string|Object} API文档
   */
  generateDocumentation(format = 'json') {
    if (!this.options.enableDocumentation) {
      throw new Error('Documentation is disabled');
    }

    const docs = {
      openapi: '3.0.0',
      ...this.documentation
    };

    // 添加服务器信息
    docs.servers = [{
      url: `/${this.options.version}`,
      description: `API ${this.options.version}`
    }];

    // 添加安全定义
    docs.components.securitySchemes = {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      },
      apiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key'
      }
    };

    switch (format.toLowerCase()) {
      case 'json':
        return JSON.stringify(docs, null, 2);
      case 'yaml':
        // 这里可以集成yaml库
        return JSON.stringify(docs, null, 2);
      case 'html':
        return this._generateHtmlDocumentation(docs);
      default:
        throw new Error(`Unsupported documentation format: ${format}`);
    }
  }

  /**
   * 获取API统计信息
   * @returns {Object}
   */
  getStats() {
    const routeStats = {};

    // 收集路由统计
    for (const [version, routes] of this.routes) {
      routeStats[version] = {};
      for (const [routeKey, route] of routes) {
        routeStats[version][routeKey] = {
          callCount: route.callCount,
          errorCount: route.errorCount,
          averageResponseTime: route.averageResponseTime,
          errorRate: route.callCount > 0 ? route.errorCount / route.callCount : 0
        };
      }
    }

    return {
      global: { ...this.stats },
      routes: routeStats,
      versions: Array.from(this.versions.keys()),
      middlewares: this.middlewares.size,
      formatters: this.responseFormatters.size,
      errorHandlers: this.errorHandlers.size
    };
  }

  /**
   * 创建标准响应
   * @param {*} data - 响应数据
   * @param {Object} meta - 元数据
   * @returns {Object} 标准响应
   */
  createResponse(data, meta = {}) {
    return {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        version: this.currentVersion,
        ...meta
      }
    };
  }

  /**
   * 创建错误响应
   * @param {string} code - 错误代码
   * @param {string} message - 错误消息
   * @param {number} statusCode - HTTP状态码
   * @param {Object} details - 错误详情
   * @returns {Object} 错误响应
   */
  createErrorResponse(code, message, statusCode = 500, details = {}) {
    return {
      success: false,
      error: {
        code,
        message,
        statusCode,
        details,
        timestamp: new Date().toISOString(),
        version: this.currentVersion
      }
    };
  }

  /**
   * 销毁API标准框架
   */
  async destroy() {
    logger.info('Destroying API Standard...');

    // 清理资源
    await this.cleanupManager.cleanup();

    // 清空所有集合
    this.versions.clear();
    this.routes.clear();
    this.middlewares.clear();
    this.responseFormatters.clear();
    this.errorHandlers.clear();

    logger.info('API Standard destroyed');
  }

  /**
   * 初始化
   */
  _initialize() {
    // 定义默认版本
    this.defineVersion(this.options.version, {
      deprecated: false
    });

    // 注册默认中间件
    this._registerDefaultMiddlewares();

    // 注册默认响应格式化器
    this._registerDefaultFormatters();

    // 注册默认错误处理器
    this._registerDefaultErrorHandlers();
  }

  /**
   * 注册默认中间件
   */
  _registerDefaultMiddlewares() {
    // 请求日志中间件
    this.registerMiddleware('requestLogger', async (req, res, next) => {
      const startTime = Date.now();
      logger.debug('API Request', {
        method: req.method,
        path: req.path,
        version: req.apiVersion
      });

      const result = await next();

      logger.debug('API Response', {
        method: req.method,
        path: req.path,
        statusCode: result.statusCode || 200,
        responseTime: Date.now() - startTime
      });

      return result;
    }, {
      global: true,
      priority: -100
    });

    // CORS中间件
    if (this.options.corsEnabled) {
      this.registerMiddleware('cors', async (req, res, next) => {
        const result = await next();

        if (result.headers) {
          result.headers['Access-Control-Allow-Origin'] = '*';
          result.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
          result.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-API-Key';
        }

        return result;
      }, {
        global: true,
        priority: -90
      });
    }

    // 超时中间件
    this.registerMiddleware('timeout', async (req, res, next) => {
      const timeout = req.route?.options?.timeout || this.options.defaultTimeout;

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), timeout);
      });

      try {
        return await Promise.race([next(), timeoutPromise]);
      } catch (error) {
        if (error.message === 'Request timeout') {
          return this.createErrorResponse('TIMEOUT', 'Request timeout', 408);
        }
        throw error;
      }
    }, {
      global: true,
      priority: -80
    });
  }

  /**
   * 注册默认响应格式化器
   */
  _registerDefaultFormatters() {
    // JSON格式化器
    this.registerResponseFormatter('json', (data, request) => {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-API-Version': this.currentVersion
        },
        body: JSON.stringify(data)
      };
    });

    // 错误格式化器
    this.registerResponseFormatter('error', (error, request) => {
      return {
        statusCode: error.statusCode || 500,
        headers: {
          'Content-Type': 'application/json',
          'X-API-Version': this.currentVersion
        },
        body: JSON.stringify(error)
      };
    });
  }

  /**
   * 注册默认错误处理器
   */
  _registerDefaultErrorHandlers() {
    // 通用错误处理器
    this.registerErrorHandler('default', (error, request) => {
      logger.error('API Error', {
        error: error.message,
        stack: error.stack,
        request: {
          method: request.method,
          path: request.path
        }
      });

      return this.createErrorResponse(
        'INTERNAL_ERROR',
        'Internal server error',
        500,
        { originalError: error.message }
      );
    });

    // 验证错误处理器
    this.registerErrorHandler('validation', (error, request) => {
      return this.createErrorResponse(
        'VALIDATION_ERROR',
        'Request validation failed',
        400,
        { errors: error.details }
      );
    });

    // 权限错误处理器
    this.registerErrorHandler('authorization', (error, request) => {
      return this.createErrorResponse(
        'UNAUTHORIZED',
        'Unauthorized access',
        401
      );
    });
  }

  /**
   * 解析请求
   */
  _parseRequest(request, context) {
    const parsed = {
      ...request,
      apiVersion: this._extractVersion(request.path),
      params: {},
      query: {},
      body: request.body || {},
      headers: request.headers || {},
      context
    };

    // 解析路径参数
    parsed.params = this._parsePathParams(request.path, request.route?.path);

    // 解析查询参数
    parsed.query = this._parseQueryParams(request.url);

    return parsed;
  }

  /**
   * 查找路由
   */
  _findRoute(parsedRequest) {
    const versionRoutes = this.routes.get(parsedRequest.apiVersion);
    if (!versionRoutes) return null;

    const routeKey = `${parsedRequest.method}:${parsedRequest.path}`;
    return versionRoutes.get(routeKey) || null;
  }

  /**
   * 执行中间件
   */
  async _executeMiddlewares(route, request, context) {
    const middlewares = [
      ...this._getGlobalMiddlewares(request.apiVersion),
      ...route.options.middlewares
    ];

    // 按优先级排序
    middlewares.sort((a, b) => b.options.priority - a.options.priority);

    let currentRequest = request;

    for (const middlewareDef of middlewares) {
      try {
        middlewareDef.usageCount++;

        const next = async (modifiedRequest = currentRequest) => {
          currentRequest = modifiedRequest;
          return currentRequest;
        };

        const result = await middlewareDef.middleware(currentRequest, context, next);

        // 如果中间件返回了结果，直接返回
        if (result && typeof result === 'object' && result.success === false) {
          return result;
        }

      } catch (error) {
        logger.error(`Middleware execution failed: ${middlewareDef.name}`, {
          error: error.message
        });
        return this.createErrorResponse('MIDDLEWARE_ERROR', `Middleware error: ${middlewareDef.name}`, 500);
      }
    }

    return currentRequest;
  }

  /**
   * 验证请求
   */
  async _validateRequest(request, validationSchema) {
    if (!this.options.enableValidation) {
      return { valid: true };
    }

    // 这里可以集成验证库如joi或yup
    // 暂时返回成功
    return { valid: true };
  }

  /**
   * 执行处理器
   */
  async _executeHandler(route, request, context) {
    const handler = route.handler;

    if (typeof handler !== 'function') {
      throw new Error('Route handler is not a function');
    }

    return await handler(request, context);
  }

  /**
   * 格式化响应
   */
  _formatResponse(result, route, request) {
    const formatterType = route.options.responseFormat || 'json';
    const formatter = this.responseFormatters.get(formatterType);

    if (formatter) {
      return formatter.formatter(result, request);
    }

    // 默认JSON格式化
    const defaultFormatter = this.responseFormatters.get('json');
    return defaultFormatter.formatter(result, request);
  }

  /**
   * 处理错误
   */
  async _handleError(error, request, context) {
    const errorType = this._classifyError(error);
    const errorHandler = this.errorHandlers.get(errorType) || this.errorHandlers.get('default');

    try {
      return await errorHandler.handler(error, request, context);
    } catch (handlerError) {
      logger.error('Error handler failed', {
        originalError: error.message,
        handlerError: handlerError.message
      });

      return this.createErrorResponse(
        'HANDLER_ERROR',
        'Error handler failed',
        500
      );
    }
  }

  /**
   * 获取版本路由
   */
  _getVersionRoutes(version) {
    if (!this.versions.has(version)) {
      throw new Error(`API version not defined: ${version}`);
    }

    return this.versions.get(version).routes;
  }

  /**
   * 获取全局中间件
   */
  _getGlobalMiddlewares(version) {
    const globalMiddlewares = [];

    for (const [name, middlewareDef] of this.middlewares) {
      const options = middlewareDef.options;
      if (options.global && (options.versions.includes('*') || options.versions.includes(version))) {
        globalMiddlewares.push(middlewareDef);
      }
    }

    return globalMiddlewares;
  }

  /**
   * 提取版本
   */
  _extractVersion(path) {
    const versionMatch = path.match(/^\/api\/(v\d+)/);
    return versionMatch ? versionMatch[1] : this.currentVersion;
  }

  /**
   * 解析路径参数
   */
  _parsePathParams(path, routePath) {
    const params = {};

    if (!routePath) return params;

    // 简化的参数解析
    const pathParts = path.split('/');
    const routeParts = routePath.split('/');

    for (let i = 0; i < routeParts.length; i++) {
      const routePart = routeParts[i];
      if (routePart.startsWith(':')) {
        const paramName = routePart.slice(1);
        params[paramName] = pathParts[i];
      }
    }

    return params;
  }

  /**
   * 解析查询参数
   */
  _parseQueryParams(url) {
    const query = {};
    if (!url) return query;

    const queryString = url.split('?')[1];
    if (!queryString) return query;

    const pairs = queryString.split('&');
    for (const pair of pairs) {
      const [key, value] = pair.split('=');
      if (key) {
        query[decodeURIComponent(key)] = decodeURIComponent(value || '');
      }
    }

    return query;
  }

  /**
   * 分类错误
   */
  _classifyError(error) {
    if (error.code === 'VALIDATION_ERROR') return 'validation';
    if (error.statusCode === 401 || error.statusCode === 403) return 'authorization';
    return 'default';
  }

  /**
   * 更新路由统计
   */
  _updateRouteStats(route, responseTime, isError) {
    route.callCount++;
    if (isError) route.errorCount++;

    // 更新平均响应时间
    const currentAverage = route.averageResponseTime;
    const newAverage = (currentAverage * (route.callCount - 1) + responseTime) / route.callCount;
    route.averageResponseTime = newAverage;
  }

  /**
   * 更新全局统计
   */
  _updateGlobalStats(responseTime) {
    const currentAverage = this.stats.averageResponseTime;
    const newAverage = (currentAverage * (this.stats.requests - 1) + responseTime) / this.stats.requests;
    this.stats.averageResponseTime = newAverage;
  }

  /**
   * 更新文档版本
   */
  _updateDocumentationVersion(version, versionDefinition) {
    if (!this.documentation.info.versions) {
      this.documentation.info.versions = {};
    }

    this.documentation.info.versions[version] = {
      basePath: versionDefinition.config.basePath,
      deprecated: versionDefinition.config.deprecated,
      sunsetDate: versionDefinition.config.sunsetDate
    };
  }

  /**
   * 更新文档路由
   */
  _updateDocumentationRoute(routeDefinition) {
    const path = routeDefinition.path;
    const method = routeDefinition.method.toLowerCase();

    if (!this.documentation.paths[path]) {
      this.documentation.paths[path] = {};
    }

    this.documentation.paths[path][method] = {
      summary: routeDefinition.options.documentation.summary || `${method.toUpperCase()} ${path}`,
      description: routeDefinition.options.documentation.description || '',
      operationId: `${method}_${path.replace(/\//g, '_').replace(/:/g, '')}`,
      tags: routeDefinition.options.documentation.tags || [],
      parameters: routeDefinition.options.documentation.parameters || [],
      requestBody: routeDefinition.options.documentation.requestBody,
      responses: routeDefinition.options.documentation.responses || {
        '200': {
          description: 'Success',
          content: {
            'application/json': {
              schema: { type: 'object' }
            }
          }
        }
      }
    };
  }

  /**
   * 生成HTML文档
   */
  _generateHtmlDocumentation(docs) {
    // 简化的HTML文档生成
    return `
<!DOCTYPE html>
<html>
<head>
    <title>${docs.info.title}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .endpoint { margin: 10px 0; padding: 10px; border: 1px solid #ddd; }
        .method { font-weight: bold; color: #0066cc; }
    </style>
</head>
<body>
    <h1>${docs.info.title} v${docs.info.version}</h1>
    <p>${docs.info.description}</p>

    <h2>Endpoints</h2>
    ${Object.entries(docs.paths).map(([path, methods]) =>
      Object.entries(methods).map(([method, info]) => `
        <div class="endpoint">
            <span class="method">${method.toUpperCase()}</span> ${path}
            <p>${info.summary}</p>
        </div>
      `).join('')
    ).join('')}
</body>
</html>`;
  }
}

/**
 * 创建API标准的工厂函数
 * @param {Object} options - 选项
 * @returns {APIStandard}
 */
export function createAPIStandard(options = {}) {
  return new APIStandard(options);
}

/**
 * 便捷的路由装饰器
 */
export function route(method, path, options = {}) {
  return function(target, propertyKey, descriptor) {
    const apiStandard = target.constructor.apiStandard;
    if (apiStandard) {
      apiStandard.registerRoute(method, path, descriptor.value.bind(target), options);
    }
    return descriptor;
  };
}

/**
 * 便捷的中间件装饰器
 */
export function middleware(name, options = {}) {
  return function(target, propertyKey, descriptor) {
    const apiStandard = target.constructor.apiStandard;
    if (apiStandard) {
      apiStandard.registerMiddleware(name, descriptor.value.bind(target), options);
    }
    return descriptor;
  };
}
