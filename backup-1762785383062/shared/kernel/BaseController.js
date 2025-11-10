/**
 * 基础控制器类
 * 处理HTTP请求和响应
 */

export class BaseController {
  constructor() {
    if (new.target === BaseController) {
      throw new Error('BaseController cannot be instantiated directly');
    }

    this._middlewares = [];
  }

  /**
   * 添加中间件
   */
  use(middleware) {
    this._middlewares.push(middleware);
    return this;
  }

  /**
   * 执行中间件链
   */
  async executeMiddlewares(req, res, next) {
    let index = 0;

    const executeNext = async () => {
      if (index < this._middlewares.length) {
        const middleware = this._middlewares[index++];
        await middleware(req, res, executeNext);
      } else {
        await next();
      }
    };

    await executeNext();
  }

  /**
   * 发送成功响应
   */
  sendSuccess(res, data, statusCode = 200, metadata = {}) {
    const response = {
      success: true,
      data,
      timestamp: new Date().toISOString(),
      ...metadata,
    };

    res.status(statusCode).json(response);
  }

  /**
   * 发送错误响应
   */
  sendError(res, error, statusCode = 500, metadata = {}) {
    const response = {
      success: false,
      error: {
        message: error.message || 'Internal server error',
        type: error.constructor.name,
        ...(error.code && { code: error.code }),
        ...(error.details && { details: error.details }),
      },
      timestamp: new Date().toISOString(),
      ...metadata,
    };

    res.status(statusCode).json(response);
  }

  /**
   * 发送分页响应
   */
  sendPaginated(res, data, pagination, statusCode = 200) {
    const response = {
      success: true,
      data,
      pagination,
      timestamp: new Date().toISOString(),
    };

    res.status(statusCode).json(response);
  }

  /**
   * 发送创建响应
   */
  sendCreated(res, data, location = null) {
    const response = {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };

    if (location) {
      res.set('Location', location);
    }

    res.status(201).json(response);
  }

  /**
   * 发送无内容响应
   */
  sendNoContent(res) {
    res.status(204).send();
  }

  /**
   * 包装异步处理器
   */
  asyncHandler(fn) {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  /**
   * 验证请求体
   */
  validateBody(schema) {
    return (req, res, next) => {
      try {
        const validated = schema.parse(req.body);
        req.validatedBody = validated;
        next();
      } catch (error) {
        this.sendError(
          res,
          {
            message: 'Request validation failed',
            details: error.errors,
          },
          400,
        );
      }
    };
  }

  /**
   * 验证查询参数
   */
  validateQuery(schema) {
    return (req, res, next) => {
      try {
        const validated = schema.parse(req.query);
        req.validatedQuery = validated;
        next();
      } catch (error) {
        this.sendError(
          res,
          {
            message: 'Query validation failed',
            details: error.errors,
          },
          400,
        );
      }
    };
  }

  /**
   * 验证路径参数
   */
  validateParams(schema) {
    return (req, res, next) => {
      try {
        const validated = schema.parse(req.params);
        req.validatedParams = validated;
        next();
      } catch (error) {
        this.sendError(
          res,
          {
            message: 'Parameter validation failed',
            details: error.errors,
          },
          400,
        );
      }
    };
  }

  /**
   * 提取分页参数
   */
  extractPagination(req) {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 10, 100); // 最大100条

    return { page, limit };
  }

  /**
   * 提取排序参数
   */
  extractSorting(req, defaultSort = 'createdAt', defaultOrder = 'desc') {
    const sort = req.query.sort || defaultSort;
    const order = req.query.order || defaultOrder;

    // 验证排序方向
    if (!['asc', 'desc'].includes(order.toLowerCase())) {
      throw new Error('Invalid sort order. Must be "asc" or "desc"');
    }

    return { sort, order: order.toLowerCase() };
  }

  /**
   * 提取过滤参数
   */
  extractFilters(req, allowedFilters = []) {
    const filters = {};

    for (const [key, value] of Object.entries(req.query)) {
      if (allowedFilters.includes(key) && value !== undefined && value !== '') {
        filters[key] = value;
      }
    }

    return filters;
  }
}
