/**
 * Shared Errors Module
 * 共享错误模块
 */

/**
 * 基础错误类
 */
export class BaseError extends Error {
  constructor(message, code = 'INTERNAL_ERROR', statusCode = 500, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date().toISOString();

    // 保持正确的堆栈跟踪
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }
}

/**
 * 验证错误
 */
export class ValidationError extends BaseError {
  constructor(message, details = {}) {
    super(message, 'VALIDATION_ERROR', 400, details);
  }
}

/**
 * 认证错误
 */
export class AuthenticationError extends BaseError {
  constructor(message = 'Authentication required', details = {}) {
    super(message, 'AUTHENTICATION_ERROR', 401, details);
  }
}

/**
 * 授权错误
 */
export class AuthorizationError extends BaseError {
  constructor(message = 'Access denied', details = {}) {
    super(message, 'AUTHORIZATION_ERROR', 403, details);
  }
}

/**
 * 资源未找到错误
 */
export class NotFoundError extends BaseError {
  constructor(resource = 'Resource', details = {}) {
    super(`${resource} not found`, 'NOT_FOUND_ERROR', 404, details);
  }
}

/**
 * 冲突错误
 */
export class ConflictError extends BaseError {
  constructor(message, details = {}) {
    super(message, 'CONFLICT_ERROR', 409, details);
  }
}

/**
 * 请求参数错误
 */
export class BadRequestError extends BaseError {
  constructor(message, details = {}) {
    super(message, 'BAD_REQUEST_ERROR', 400, details);
  }
}

/**
 * 数据库错误
 */
export class DatabaseError extends BaseError {
  constructor(message, details = {}) {
    super(message, 'DATABASE_ERROR', 500, details);
  }
}

/**
 * 网络错误
 */
export class NetworkError extends BaseError {
  constructor(message, details = {}) {
    super(message, 'NETWORK_ERROR', 502, details);
  }
}

/**
 * 超时错误
 */
export class TimeoutError extends BaseError {
  constructor(message = 'Operation timed out', details = {}) {
    super(message, 'TIMEOUT_ERROR', 408, details);
  }
}

/**
 * 配置错误
 */
export class ConfigurationError extends BaseError {
  constructor(message, details = {}) {
    super(message, 'CONFIGURATION_ERROR', 500, details);
  }
}

/**
 * 工作流错误
 */
export class WorkflowError extends BaseError {
  constructor(message, details = {}) {
    super(message, 'WORKFLOW_ERROR', 500, details);
  }
}

/**
 * 服务不可用错误
 */
export class ServiceUnavailableError extends BaseError {
  constructor(message = 'Service temporarily unavailable', details = {}) {
    super(message, 'SERVICE_UNAVAILABLE_ERROR', 503, details);
  }
}

/**
 * 限流错误
 */
export class RateLimitError extends BaseError {
  constructor(message = 'Too many requests', details = {}) {
    super(message, 'RATE_LIMIT_ERROR', 429, details);
  }
}

/**
 * 文件上传错误
 */
export class FileUploadError extends BaseError {
  constructor(message, details = {}) {
    super(message, 'FILE_UPLOAD_ERROR', 400, details);
  }
}

/**
 * 业务逻辑错误
 */
export class BusinessLogicError extends BaseError {
  constructor(message, details = {}) {
    super(message, 'BUSINESS_LOGIC_ERROR', 422, details);
  }
}

// 错误类型映射
export const ERROR_TYPES = {
  BASE_ERROR: BaseError,
  VALIDATION_ERROR: ValidationError,
  AUTHENTICATION_ERROR: AuthenticationError,
  AUTHORIZATION_ERROR: AuthorizationError,
  NOT_FOUND_ERROR: NotFoundError,
  CONFLICT_ERROR: ConflictError,
  BAD_REQUEST_ERROR: BadRequestError,
  DATABASE_ERROR: DatabaseError,
  NETWORK_ERROR: NetworkError,
  TIMEOUT_ERROR: TimeoutError,
  CONFIGURATION_ERROR: ConfigurationError,
  WORKFLOW_ERROR: WorkflowError,
  SERVICE_UNAVAILABLE_ERROR: ServiceUnavailableError,
  RATE_LIMIT_ERROR: RateLimitError,
  FILE_UPLOAD_ERROR: FileUploadError,
  BUSINESS_LOGIC_ERROR: BusinessLogicError
};

// 错误码映射
export const ERROR_CODES = {
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  NOT_FOUND_ERROR: 'NOT_FOUND_ERROR',
  CONFLICT_ERROR: 'CONFLICT_ERROR',
  BAD_REQUEST_ERROR: 'BAD_REQUEST_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
  WORKFLOW_ERROR: 'WORKFLOW_ERROR',
  SERVICE_UNAVAILABLE_ERROR: 'SERVICE_UNAVAILABLE_ERROR',
  RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',
  FILE_UPLOAD_ERROR: 'FILE_UPLOAD_ERROR',
  BUSINESS_LOGIC_ERROR: 'BUSINESS_LOGIC_ERROR'
};

// HTTP状态码映射
export const HTTP_STATUS_CODES = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  408: 'Request Timeout',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable'
};

/**
 * 创建错误实例的工厂函数
 * @param {string} type - 错误类型
 * @param {string} message - 错误消息
 * @param {Object} details - 错误详情
 * @returns {BaseError} 错误实例
 */
export function createError(type, message, details = {}) {
  const ErrorClass = ERROR_TYPES[type] || BaseError;
  return new ErrorClass(message, details);
}

/**
 * 从HTTP状态码创建错误
 * @param {number} statusCode - HTTP状态码
 * @param {string} message - 错误消息
 * @param {Object} details - 错误详情
 * @returns {BaseError} 错误实例
 */
export function createErrorFromStatusCode(statusCode, message, details = {}) {
  let ErrorClass = BaseError;

  switch (statusCode) {
    case 400:
      ErrorClass = BadRequestError;
      break;
    case 401:
      ErrorClass = AuthenticationError;
      break;
    case 403:
      ErrorClass = AuthorizationError;
      break;
    case 404:
      ErrorClass = NotFoundError;
      break;
    case 408:
      ErrorClass = TimeoutError;
      break;
    case 409:
      ErrorClass = ConflictError;
      break;
    case 422:
      ErrorClass = ValidationError;
      break;
    case 429:
      ErrorClass = RateLimitError;
      break;
    case 503:
      ErrorClass = ServiceUnavailableError;
      break;
    default:
      ErrorClass = BaseError;
  }

  return new ErrorClass(message, details);
}

/**
 * 错误处理工具类
 */
export class ErrorHandler {
  constructor(config = {}) {
    this.config = {
      includeStack: config.includeStack !== false,
      logErrors: config.logErrors !== false,
      ...config
    };
  }

  /**
   * 处理错误
   * @param {Error} error - 错误对象
   * @param {Object} context - 错误上下文
   * @returns {Object} 格式化的错误响应
   */
  handle(error, context = {}) {
    // 记录错误
    if (this.config.logErrors) {
      console.error('Error handled:', {
        error: error.message,
        stack: this.config.includeStack ? error.stack : undefined,
        context
      });
    }

    // 如果是自定义错误，直接返回
    if (error instanceof BaseError) {
      return {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
          timestamp: error.timestamp
        },
        statusCode: error.statusCode
      };
    }

    // 处理标准Error
    const statusCode = context.statusCode || 500;
    const errorResponse = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message,
        timestamp: new Date().toISOString()
      },
      statusCode
    };

    // 在开发环境下包含堆栈信息
    if (this.config.includeStack && process.env.NODE_ENV === 'development') {
      errorResponse.error.stack = error.stack;
    }

    return errorResponse;
  }

  /**
   * 创建错误中间件 (Express)
   * @returns {Function} Express中间件
   */
  createMiddleware() {
    return (error, req, res, next) => {
      const errorResponse = this.handle(error, { req, res });
      res.status(errorResponse.statusCode).json(errorResponse);
    };
  }
}

/**
 * 创建错误处理器
 * @param {Object} config - 配置选项
 * @returns {ErrorHandler} 错误处理器实例
 */
export function createErrorHandler(config = {}) {
  return new ErrorHandler(config);
}

// 默认导出
export default {
  BaseError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  BadRequestError,
  DatabaseError,
  NetworkError,
  TimeoutError,
  ConfigurationError,
  WorkflowError,
  ServiceUnavailableError,
  RateLimitError,
  FileUploadError,
  BusinessLogicError,
  ErrorHandler,
  createError,
  createErrorFromStatusCode,
  createErrorHandler,
  ERROR_TYPES,
  ERROR_CODES,
  HTTP_STATUS_CODES
};
