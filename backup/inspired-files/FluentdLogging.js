import { logger } from '../shared/utils/logger.js';

/**
 * FluentdInspiredLogging 风格的系统
 * 借鉴 Fluentd 的核心理念
 */
class FluentdInspiredLogging {
  /**
   * 构造函数
   * 初始化FluentdInspiredLogging管理器
   */
  constructor() {
    this.inputs = new Map(); // 输入插件
    this.outputs = new Map(); // 输出插件
    this.filters = new Map(); // 过滤插件
    this.buffer = []; // 日志缓冲区
    this.formatters = new Map(); // 格式化器
  }

  /**
   * 添加输入插件
   * @param {string} name - 插件名称
   * @param {Function} plugin - 插件函数
   */
  addInput(name, plugin) {
    this.inputs.set(name, plugin);
    logger.info(`📥 输入插件已添加: ${name}`);
  }

  /**
   * 添加输出插件
   * @param {string} name - 插件名称
   * @param {Function} plugin - 插件函数
   */
  addOutput(name, plugin) {
    this.outputs.set(name, plugin);
    logger.info(`📤 输出插件已添加: ${name}`);
  }

  /**
   * 添加过滤插件
   * @param {string} name - 插件名称
   * @param {Function} plugin - 插件函数
   */
  addFilter(name, plugin) {
    this.filters.set(name, plugin);
    logger.info(`🔍 过滤插件已添加: ${name}`);
  }

  /**
   * 记录日志
   * @param {string} level - 日志级别
   * @param {string} message - 日志消息
   * @param {Object} meta - 元数据
   */
  log(level, message, meta = {}) {
    const logEntry = {
      level,
      message,
      meta,
      timestamp: new Date(),
      source: 'frys',
    };

    this.buffer.push(logEntry);

    // 处理过滤器
    for (const [name, filter] of this.filters) {
      try {
        const filtered = filter(logEntry);
        if (filtered === false) return; // 过滤掉
        if (filtered) logEntry.meta = { ...logEntry.meta, ...filtered };
      } catch (error) {
        logger.error(`过滤器 ${name} 错误:`, error);
      }
    }

    // 发送到输出插件
    for (const [name, output] of this.outputs) {
      try {
        output(logEntry);
      } catch (error) {
        logger.error(`输出插件 ${name} 错误:`, error);
      }
    }

    logger.info(`📝 日志已记录: [${level}] ${message}`);
  }

  /**
   * 获取统计信息
   * @returns {Object} 统计数据
   */
  getStats() {
    return {
      inputs: this.inputs.size,
      outputs: this.outputs.size,
      filters: this.filters.size,
      bufferedLogs: this.buffer.length,
    };
  }
}

export default FluentdInspiredLogging;
