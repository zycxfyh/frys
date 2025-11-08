/**
 * 基础服务类
 * 为所有服务提供通用的导入和基础功能
 */

import { logger } from '../shared/utils/logger.js';
import { eventSystem } from './event/EventBus.js';
import { errorHandler } from './ErrorHandlerConfig.js';
import { config } from '../shared/utils/config.js';

class BaseService {
  constructor(serviceName = 'BaseService') {
    this.serviceName = serviceName;
    this.logger = logger;
    this.eventSystem = eventSystem;
    this.errorHandler = errorHandler;
    this.config = config;
  }

  /**
   * 记录信息日志
   */
  logInfo(message, meta = {}) {
    this.logger.info(`[${this.serviceName}] ${message}`, {
      service: this.serviceName,
      ...meta,
    });
  }

  /**
   * 记录错误日志
   */
  logError(message, error, meta = {}) {
    this.logger.error(`[${this.serviceName}] ${message}`, {
      service: this.serviceName,
      error: error.message,
      stack: error.stack,
      ...meta,
    });
  }

  /**
   * 记录警告日志
   */
  logWarn(message, meta = {}) {
    this.logger.warn(`[${this.serviceName}] ${message}`, {
      service: this.serviceName,
      ...meta,
    });
  }

  /**
   * 发送事件
   */
  emitEvent(eventName, data) {
    this.eventSystem.emit(eventName, {
      service: this.serviceName,
      timestamp: new Date().toISOString(),
      ...data,
    });
  }

  /**
   * 监听事件
   */
  onEvent(eventName, handler) {
    this.eventSystem.on(eventName, handler);
  }

  /**
   * 处理错误
   */
  handleError(error, context = {}) {
    return this.errorHandler.handle(error, {
      service: this.serviceName,
      ...context,
    });
  }

  /**
   * 获取配置值
   */
  getConfig(key, defaultValue = null) {
    return this.config.get(key, defaultValue);
  }

  /**
   * 设置配置值
   */
  setConfig(key, value) {
    this.config.set(key, value);
  }

  /**
   * 验证必需的配置
   */
  validateRequiredConfig(requiredKeys) {
    const missingKeys = requiredKeys.filter((key) => !this.getConfig(key));
    if (missingKeys.length > 0) {
      throw new Error(
        `[${this.serviceName}] 缺少必需的配置: ${missingKeys.join(', ')}`,
      );
    }
  }

  /**
   * 执行异步操作并处理错误
   */
  async executeAsync(operation, context = {}) {
    try {
      this.logInfo(`开始执行操作: ${operation.name || 'anonymous'}`, context);
      const startTime = Date.now();

      const result = await operation();

      const duration = Date.now() - startTime;
      this.logInfo(`操作完成: ${operation.name || 'anonymous'}`, {
        duration,
        ...context,
      });

      return result;
    } catch (error) {
      this.logError(
        `操作失败: ${operation.name || 'anonymous'}`,
        error,
        context,
      );
      throw this.handleError(error, context);
    }
  }
}

export default BaseService;
