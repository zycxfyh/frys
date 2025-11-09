/**
 * frys Production - 结构化日志系统
 * 支持JSON格式、分布式追踪、性能监控
 */

import { randomUUID } from 'crypto';
import { createWriteStream, mkdirSync } from 'fs';
import os from 'os';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { config } from './config.js';

const __filename = fileURLToPath(import.meta.url);

// 日志级别定义
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
  trace: 4,
};

// ANSI 颜色代码
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

// 全局上下文管理
class LogContext {
  constructor() {
    this.context = new Map();
    this.requestContexts = new Map();
  }

  set(key, value) {
    this.context.set(key, value);
  }

  get(key) {
    return this.context.get(key);
  }

  setRequestContext(requestId, context) {
    this.requestContexts.set(requestId, {
      ...context,
      requestId,
      startTime: Date.now(),
    });
  }

  getRequestContext(requestId) {
    return this.requestContexts.get(requestId);
  }

  updateRequestContext(requestId, updates) {
    const existing = this.getRequestContext(requestId);
    if (existing) {
      this.requestContexts.set(requestId, { ...existing, ...updates });
    }
  }

  endRequestContext(requestId, response = {}) {
    const context = this.getRequestContext(requestId);
    if (context) {
      const duration = Date.now() - context.startTime;
      this.requestContexts.set(requestId, {
        ...context,
        duration,
        response,
        endTime: Date.now(),
      });
    }
  }

  clearRequestContext(requestId) {
    this.requestContexts.delete(requestId);
  }

  getGlobalContext() {
    return {
      hostname: os.hostname(),
      pid: process.pid,
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      ...Object.fromEntries(this.context),
    };
  }
}

const globalContext = new LogContext();

// 结构化日志格式化器
class StructuredLogFormatter {
  static format(level, message, meta = {}, requestId = null) {
    const timestamp = new Date().toISOString();
    const levelUpper = level.toUpperCase();

    // 构建基础日志对象
    const logEntry = {
      timestamp,
      level,
      levelNumeric: LOG_LEVELS[level] || 0,
      message,
      service: globalContext.get('service') || 'frys',
      version: globalContext.get('version') || '1.0.0',
      environment: globalContext.get('environment') || 'development',
      hostname: os.hostname(),
      pid: process.pid,
      ...globalContext.getGlobalContext(),
      ...meta,
    };

    // 添加请求上下文（如果有）
    if (requestId) {
      const requestContext = globalContext.getRequestContext(requestId);
      if (requestContext) {
        logEntry.requestId = requestId;
        logEntry.request = {
          method: requestContext.method,
          url: requestContext.url,
          userAgent: requestContext.userAgent,
          ip: requestContext.ip,
          duration: requestContext.duration,
          statusCode: requestContext.statusCode,
        };

        // 添加追踪信息
        if (requestContext.traceId) {
          logEntry.traceId = requestContext.traceId;
        }
        if (requestContext.spanId) {
          logEntry.spanId = requestContext.spanId;
        }
        if (requestContext.parentSpanId) {
          logEntry.parentSpanId = requestContext.parentSpanId;
        }
      }
    }

    // 添加性能指标（如果有）
    if (meta.duration !== undefined) {
      logEntry.performance = {
        duration: meta.duration,
        durationUnit: 'ms',
      };
    }

    // 添加错误信息（如果有）
    if (meta.error) {
      logEntry.error = StructuredLogFormatter.formatError(meta.error);
    }

    // 格式化输出
    if (config.logging?.format === 'json') {
      return JSON.stringify(logEntry);
    } else {
      // 美化控制台输出
      return StructuredLogFormatter.formatConsole(level, message, logEntry);
    }
  }

  static formatConsole(level, message, logEntry) {
    const color = StructuredLogFormatter.getColor(level);
    const timestamp = new Date(logEntry.timestamp).toLocaleString();

    let output = `${color}[${timestamp}] ${level.toUpperCase()}${colors.reset} ${message}`;

    // 添加关键上下文信息
    const contextParts = [];
    if (logEntry.requestId) {
      contextParts.push(
        `${colors.cyan}req:${logEntry.requestId}${colors.reset}`,
      );
    }
    if (logEntry.traceId) {
      contextParts.push(
        `${colors.magenta}trace:${logEntry.traceId}${colors.reset}`,
      );
    }
    if (logEntry.request?.method) {
      contextParts.push(
        `${colors.green}${logEntry.request.method}${colors.reset}`,
      );
    }
    if (logEntry.request?.statusCode) {
      const statusColor =
        logEntry.request.statusCode >= 400 ? colors.red : colors.green;
      contextParts.push(
        `${statusColor}${logEntry.request.statusCode}${colors.reset}`,
      );
    }
    if (logEntry.performance?.duration) {
      contextParts.push(
        `${colors.yellow}${logEntry.performance.duration}ms${colors.reset}`,
      );
    }

    if (contextParts.length > 0) {
      output += ` ${contextParts.join(' ')}`;
    }

    // 添加额外元数据（简化显示）
    const metaKeys = Object.keys(logEntry).filter(
      (key) =>
        ![
          'timestamp',
          'level',
          'levelNumeric',
          'message',
          'service',
          'version',
          'environment',
          'hostname',
          'pid',
          'request',
          'performance',
          'error',
        ].includes(key),
    );

    if (metaKeys.length > 0) {
      const metaObj = {};
      metaKeys.forEach((key) => {
        metaObj[key] = logEntry[key];
      });
      output += ` ${colors.gray}${JSON.stringify(metaObj)}${colors.reset}`;
    }

    return output;
  }

  static formatError(error) {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: error.code,
      };
    }
    return error;
  }

  static getColor(level) {
    switch (level) {
      case 'error':
        return colors.red;
      case 'warn':
        return colors.yellow;
      case 'info':
        return colors.green;
      case 'debug':
        return colors.blue;
      case 'trace':
        return colors.gray;
      default:
        return colors.reset;
    }
  }
}

// 文件日志写入器
class FileLogger {
  constructor(filePath) {
    this.filePath = filePath;
    this.maxSize = this.parseSize(config.logging.transports.file.maxSize);
    this.maxFiles = parseInt(config.logging.transports.file.maxFiles);
    this.currentSize = 0;
    this.fileIndex = 0;

    // 确保日志目录存在
    const logDir = dirname(filePath);
    try {
      mkdirSync(logDir, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        console.error('创建日志目录失败:', error);
      }
    }

    this.stream = createWriteStream(this.getCurrentFilePath(), { flags: 'a' });
  }

  write(message) {
    const line = `${message}\n`;
    const lineSize = Buffer.byteLength(line, 'utf8');

    // 检查是否需要轮转文件
    if (this.currentSize + lineSize > this.maxSize) {
      this.rotate();
    }

    this.stream.write(line);
    this.currentSize += lineSize;
  }

  rotate() {
    this.stream.end();

    // 重命名现有文件
    for (let i = this.maxFiles - 1; i > 0; i--) {
      const _oldPath = this.getFilePath(i - 1);
      const _newPath = this.getFilePath(i);
      try {
        // 这里可以添加文件重命名逻辑
      } catch (error) {
        // 忽略重命名错误
      }
    }

    // 创建新的日志文件
    this.currentSize = 0;
    this.stream = createWriteStream(this.getCurrentFilePath(), { flags: 'w' });
  }

  getCurrentFilePath() {
    return this.getFilePath(0);
  }

  getFilePath(index) {
    if (index === 0) {
      return this.filePath;
    }
    const ext = this.filePath.split('.').pop();
    const base = this.filePath.slice(0, -ext.length - 1);
    return `${base}.${index}.${ext}`;
  }

  parseSize(sizeStr) {
    const units = {
      k: 1024,
      m: 1024 * 1024,
      g: 1024 * 1024 * 1024,
    };

    const match = sizeStr.toLowerCase().match(/^(\d+)([kmg]?)$/);
    if (!match) return 10 * 1024 * 1024; // 默认10MB

    const [, num, unit] = match;
    return parseInt(num) * (units[unit] || 1);
  }

  close() {
    if (this.stream) {
      this.stream.end();
    }
  }
}

// 结构化日志器类
class StructuredLogger {
  constructor() {
    this.level = LOG_LEVELS[config.logging?.level] || LOG_LEVELS.info;
    this.transports = [];
    this.requestStore = new Map(); // 存储活跃请求

    // 初始化传输器
    this.initTransports();

    // 设置全局上下文
    this.setGlobalContext({
      service: 'frys',
      version: '1.0.0',
      environment: config.environment || 'development',
    });
  }

  initTransports() {
    // 控制台传输器
    if (config.logging?.transports?.console?.enabled !== false) {
      this.transports.push({
        name: 'console',
        write: (level, message, meta, requestId) => {
          const formatted = StructuredLogFormatter.format(
            level,
            message,
            meta,
            requestId,
          );
          if (level === 'error') {
            console.error(formatted);
          } else {
            console.log(formatted);
          }
        },
      });
    }

    // 文件传输器
    if (config.logging?.transports?.file?.enabled !== false) {
      const filePath =
        config.logging?.transports?.file?.path ||
        join(process.cwd(), 'logs', 'app.log');
      const fileLogger = new FileLogger(filePath);
      this.transports.push({
        name: 'file',
        write: (level, message, meta, requestId) => {
          const formatted = StructuredLogFormatter.format(
            level,
            message,
            meta,
            requestId,
          );
          fileLogger.write(formatted);
        },
      });
    }
  }

  // 设置全局上下文
  setGlobalContext(context) {
    Object.entries(context).forEach(([key, value]) => {
      globalContext.set(key, value);
    });
  }

  // 创建请求上下文
  createRequestContext(requestId = randomUUID(), context = {}) {
    globalContext.setRequestContext(requestId, context);
    this.requestStore.set(requestId, { created: Date.now() });
    return requestId;
  }

  // 更新请求上下文
  updateRequestContext(requestId, updates) {
    globalContext.updateRequestContext(requestId, updates);
  }

  // 结束请求上下文
  endRequestContext(requestId, response = {}) {
    globalContext.endRequestContext(requestId, response);

    // 清理过期请求上下文（超过1小时的）
    const now = Date.now();
    for (const [id, data] of this.requestStore) {
      if (now - data.created > 3600000) {
        // 1小时
        globalContext.clearRequestContext(id);
        this.requestStore.delete(id);
      }
    }
  }

  log(level, message, meta = {}, requestId = null) {
    if (LOG_LEVELS[level] > this.level) {
      return; // 低于当前日志级别，跳过
    }

    // 写入所有传输器
    this.transports.forEach((transport) => {
      try {
        transport.write(level, message, meta, requestId);
      } catch (error) {
        // 避免日志系统本身的错误影响应用
        console.error('结构化日志写入失败:', error);
      }
    });
  }

  // 请求开始日志
  requestStart(requestId, method, url, headers = {}, meta = {}) {
    this.createRequestContext(requestId, {
      method,
      url,
      userAgent: headers['user-agent'],
      ip: headers['x-forwarded-for'] || headers['x-real-ip'],
      traceId: headers['x-trace-id'],
      spanId: headers['x-span-id'],
      parentSpanId: headers['x-parent-span-id'],
    });

    this.log(
      'info',
      `请求开始: ${method} ${url}`,
      {
        ...meta,
        event: 'request_start',
      },
      requestId,
    );
  }

  // 请求完成日志
  requestEnd(requestId, statusCode, duration, meta = {}) {
    this.endRequestContext(requestId, { statusCode });

    const level = statusCode >= 400 ? 'warn' : 'info';
    this.log(
      level,
      `请求完成: ${statusCode}`,
      {
        ...meta,
        duration,
        event: 'request_end',
      },
      requestId,
    );
  }

  // 性能日志
  performance(operation, duration, meta = {}, requestId = null) {
    this.log(
      'info',
      `性能指标: ${operation}`,
      {
        ...meta,
        duration,
        operation,
        event: 'performance',
      },
      requestId,
    );
  }

  // 错误日志
  error(message, error = null, meta = {}, requestId = null) {
    const errorMeta = { ...meta, event: 'error' };
    if (error) {
      if (error instanceof Error) {
        errorMeta.error = {
          name: error.name,
          message: error.message,
          stack: error.stack,
          code: error.code,
        };
      } else {
        errorMeta.error = error;
      }
    }
    this.log('error', message, errorMeta, requestId);
  }

  // 警告日志
  warn(message, meta = {}, requestId = null) {
    this.log('warn', message, { ...meta, event: 'warning' }, requestId);
  }

  // 信息日志
  info(message, meta = {}, requestId = null) {
    this.log('info', message, { ...meta, event: 'info' }, requestId);
  }

  // 调试日志
  debug(message, meta = {}, requestId = null) {
    this.log('debug', message, { ...meta, event: 'debug' }, requestId);
  }

  // 追踪日志（最详细）
  trace(message, meta = {}, requestId = null) {
    this.log('trace', message, { ...meta, event: 'trace' }, requestId);
  }

  /**
   * 创建子日志器（兼容 BaseModule）
   */
  child(context = {}) {
    // 创建新的 StructuredLogger 实例
    const childLogger = new StructuredLogger();

    // 复制当前实例的配置
    childLogger.level = this.level;
    childLogger.transports = [...this.transports];
    childLogger.requestStore = this.requestStore;

    // 合并全局上下文
    const mergedContext = {
      ...globalContext.getGlobalContext(),
      ...context,
    };

    // 设置子日志器的全局上下文
    Object.entries(mergedContext).forEach(([key, value]) => {
      globalContext.set(key, value);
    });

    return childLogger;
  }

  // 便捷方法：记录HTTP请求
  httpRequest(req, res, next) {
    const requestId = req.headers['x-request-id'] || randomUUID();
    req.requestId = requestId;

    // 记录请求开始
    this.requestStart(requestId, req.method, req.originalUrl, req.headers, {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    // 记录响应完成
    const startTime = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      this.requestEnd(requestId, res.statusCode, duration, {
        contentLength: res.get('Content-Length'),
        contentType: res.get('Content-Type'),
      });
    });

    next();
  }
}

// 创建全局结构化日志器实例
export const logger = new StructuredLogger();

// 向后兼容的便捷函数
export const logError = (message, error, meta) =>
  logger.error(message, error, meta);
export const logWarn = (message, meta) => logger.warn(message, meta);
export const logInfo = (message, meta) => logger.info(message, meta);
export const logDebug = (message, meta) => logger.debug(message, meta);

// 新的结构化日志便捷函数
export const logTrace = (message, meta, requestId) =>
  logger.trace(message, meta, requestId);
export const logPerformance = (operation, duration, meta, requestId) =>
  logger.performance(operation, duration, meta, requestId);

// 请求日志中间件
export const requestLogger = logger.httpRequest.bind(logger);

// 全局上下文管理
export const setGlobalLogContext = (context) =>
  logger.setGlobalContext(context);
export const createRequestLogContext = (requestId, context) =>
  logger.createRequestContext(requestId, context);
export const updateRequestLogContext = (requestId, updates) =>
  logger.updateRequestContext(requestId, updates);
export const endRequestLogContext = (requestId, response) =>
  logger.endRequestContext(requestId, response);
