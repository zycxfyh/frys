/**
 * 轻量级日志系统
 */

export class Logger {
  constructor(options = {}) {
    this.level = options.level || 'info';
    this.enableConsole = options.enableConsole !== false;
    this.enableFile = options.enableFile || false;
    this.logFile = options.logFile;
    this.format = options.format || 'text'; // text 或 json

    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
    };
  }

  /**
   * 记录错误日志
   */
  error(message, error = null, meta = {}) {
    this.log('error', message, { error, ...meta });
  }

  /**
   * 记录警告日志
   */
  warn(message, meta = {}) {
    this.log('warn', message, meta);
  }

  /**
   * 记录信息日志
   */
  info(message, meta = {}) {
    this.log('info', message, meta);
  }

  /**
   * 记录调试日志
   */
  debug(message, meta = {}) {
    this.log('debug', message, meta);
  }

  /**
   * 记录日志
   */
  log(level, message, meta = {}) {
    if (this.levels[level] > this.levels[this.level]) {
      return;
    }

    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...meta,
    };

    // 控制台输出
    if (this.enableConsole) {
      this.outputToConsole(logEntry);
    }

    // 文件输出
    if (this.enableFile && this.logFile) {
      this.outputToFile(logEntry);
    }
  }

  /**
   * 输出到控制台
   */
  outputToConsole(logEntry) {
    const { level, message, timestamp, ...meta } = logEntry;

    if (this.format === 'json') {
      console.log(JSON.stringify(logEntry));
    } else {
      const levelUpper = level.toUpperCase().padEnd(5);
      const metaStr = Object.keys(meta).length > 0
        ? ` ${JSON.stringify(meta)}`
        : '';

      const output = `[${timestamp}] ${levelUpper} ${message}${metaStr}`;

      switch (level) {
        case 'error':
          console.error(output);
          break;
        case 'warn':
          console.warn(output);
          break;
        default:
          console.log(output);
      }
    }
  }

  /**
   * 输出到文件
   */
  async outputToFile(logEntry) {
    try {
      const fs = await import('fs/promises');
      const logLine = this.format === 'json'
        ? JSON.stringify(logEntry) + '\n'
        : `[${logEntry.timestamp}] ${logEntry.level.toUpperCase().padEnd(5)} ${logEntry.message}\n`;

      await fs.appendFile(this.logFile, logLine);
    } catch (error) {
      // 如果文件日志失败，回退到控制台
      console.error('文件日志失败:', error.message);
      this.outputToConsole({ ...logEntry, message: `[FILE_LOG_FAILED] ${logEntry.message}` });
    }
  }

  /**
   * 创建子日志器
   */
  child(meta = {}) {
    const childLogger = Object.create(this);
    childLogger.meta = { ...this.meta, ...meta };

    // 重写日志方法以包含子元数据
    ['error', 'warn', 'info', 'debug'].forEach(level => {
      childLogger[level] = (message, extraMeta = {}) => {
        this[level](message, { ...this.meta, ...meta, ...extraMeta });
      };
    });

    return childLogger;
  }

  /**
   * 设置日志级别
   */
  setLevel(level) {
    if (level in this.levels) {
      this.level = level;
    }
  }

  /**
   * 启用/禁用控制台输出
   */
  setConsole(enabled) {
    this.enableConsole = enabled;
  }

  /**
   * 启用/禁用文件输出
   */
  setFile(enabled, filePath = null) {
    this.enableFile = enabled;
    if (filePath) {
      this.logFile = filePath;
    }
  }
}

// 导出单例实例
export const logger = new Logger();
