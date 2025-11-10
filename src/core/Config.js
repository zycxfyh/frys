/**
 * 轻量级配置管理器
 */

export class Config {
  constructor() {
    this.config = {};
    this.loadDefaults();
  }

  /**
   * 加载默认配置
   */
  loadDefaults() {
    this.config = {
      // 服务器配置
      server: {
        port: process.env.PORT || 3000,
        host: process.env.HOST || 'localhost',
      },

      // 工作流配置
      workflow: {
        maxRetries: 3,
        retryDelay: 1000,
        timeout: 30000,
        maxConcurrency: 10,
      },

      // 日志配置
      logging: {
        level: process.env.LOG_LEVEL || 'info',
        format: 'json',
        enableConsole: true,
        enableFile: false,
        logFile: 'logs/frys.log',
      },

      // 数据库配置（可选）
      database: {
        type: process.env.DB_TYPE || 'memory', // memory, sqlite, postgres
        url: process.env.DATABASE_URL,
      },

      // 缓存配置（可选）
      cache: {
        type: process.env.CACHE_TYPE || 'memory', // memory, redis
        ttl: 300000, // 5分钟
        maxSize: 100,
      },
    };
  }

  /**
   * 加载环境变量配置
   */
  loadFromEnv() {
    // 从环境变量覆盖配置
    if (process.env.FRYS_CONFIG) {
      try {
        const envConfig = JSON.parse(process.env.FRYS_CONFIG);
        this.merge(envConfig);
      } catch (error) {
        console.warn('解析环境变量配置失败:', error.message);
      }
    }
  }

  /**
   * 从文件加载配置
   */
  async loadFromFile(filePath) {
    try {
      const fs = await import('fs/promises');
      const content = await fs.readFile(filePath, 'utf8');
      const fileConfig = JSON.parse(content);
      this.merge(fileConfig);
    } catch (error) {
      console.warn(`加载配置文件失败 ${filePath}:`, error.message);
    }
  }

  /**
   * 获取配置值
   */
  get(key, defaultValue = undefined) {
    const keys = key.split('.');
    let value = this.config;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return defaultValue;
      }
    }

    return value;
  }

  /**
   * 设置配置值
   */
  set(key, value) {
    const keys = key.split('.');
    let current = this.config;

    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!(k in current) || typeof current[k] !== 'object') {
        current[k] = {};
      }
      current = current[k];
    }

    current[keys[keys.length - 1]] = value;
  }

  /**
   * 合并配置
   */
  merge(newConfig) {
    this.config = this.deepMerge(this.config, newConfig);
  }

  /**
   * 深度合并对象
   */
  deepMerge(target, source) {
    const result = { ...target };

    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }

    return result;
  }

  /**
   * 获取完整配置
   */
  getAll() {
    return { ...this.config };
  }

  /**
   * 验证配置
   */
  validate() {
    const errors = [];

    // 验证服务器配置
    if (typeof this.config.server.port !== 'number' || this.config.server.port < 1) {
      errors.push('server.port 必须是大于0的数字');
    }

    // 验证工作流配置
    if (this.config.workflow.maxRetries < 0) {
      errors.push('workflow.maxRetries 不能为负数');
    }

    if (this.config.workflow.timeout < 1000) {
      errors.push('workflow.timeout 不能小于1000ms');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * 重置为默认配置
   */
  reset() {
    this.loadDefaults();
  }
}

// 导出单例实例
export const config = new Config();
