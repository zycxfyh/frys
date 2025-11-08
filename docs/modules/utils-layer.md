# frys 工具层

## 📖 模块概述

frys 的工具层提供了应用的核心工具函数和基础设施服务，包括配置管理、日志记录、类型检查、密钥管理等。该层作为整个应用的基础设施，为各层提供通用的工具和服务，确保代码的可重用性和一致性。

### 🎯 核心特性

- **配置管理** - 统一的配置加载和环境变量处理
- **日志系统** - 结构化日志记录和分层输出
- **类型检查** - 运行时类型验证和数据清理
- **密钥管理** - 安全敏感信息的存储和管理

### 🏗️ 工具架构

```
工具层
├── ⚙️ 配置管理 (Config)
│   ├── 环境变量加载
│   ├── 配置验证
│   └── 运行时配置
├── 📝 日志系统 (Logger)
│   ├── 结构化日志
│   ├── 分层输出
│   ├── 性能监控
│   └── 错误追踪
├── 🔒 密钥管理 (Secret Manager)
│   ├── 密钥存储
│   ├── 加密解密
│   └── 访问控制
└── 🛡️ 类型检查 (Type Guards)
    ├── 运行时验证
    ├── 数据清理
    └── 安全防护
```

## ⚙️ 配置管理 (Config)

### 环境变量加载

```javascript
/**
 * 配置管理器 - 处理环境变量和应用配置
 */
import { config } from './config.js';

class ConfigManager {
  constructor() {
    this.config = {};
    this.validators = new Map();
    this.loaders = [];
  }

  /**
   * 加载配置
   */
  async load() {
    // 加载环境变量
    this.loadEnvironmentVariables();

    // 加载配置文件
    await this.loadConfigFiles();

    // 应用默认值
    this.applyDefaults();

    // 验证配置
    this.validateConfig();

    // 后处理配置
    this.postProcessConfig();

    return this.config;
  }

  /**
   * 加载环境变量
   */
  loadEnvironmentVariables() {
    // 基础配置
    this.config.app = {
      name: process.env.APP_NAME || 'frys',
      version: process.env.APP_VERSION || '1.0.0',
      env: process.env.NODE_ENV || 'development',
      port: parseInt(process.env.PORT) || 3000,
      host: process.env.HOST || 'localhost',
    };

    // 数据库配置
    this.config.database = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || 'frys',
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: process.env.DB_SSL === 'true',
      maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS) || 20,
      idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000,
    };

    // Redis配置
    this.config.redis = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB) || 0,
      keyPrefix: process.env.REDIS_KEY_PREFIX || 'frys:',
    };

    // JWT配置
    this.config.jwt = {
      secret: process.env.JWT_SECRET,
      issuer: process.env.JWT_ISSUER || 'frys-app',
      audience: process.env.JWT_AUDIENCE || 'frys-users',
      accessTokenExpiry: process.env.JWT_ACCESS_EXPIRY || '1h',
      refreshTokenExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
    };

    // AI提供商配置
    this.config.ai = {
      providers: {
        openai: {
          apiKey: process.env.OPENAI_API_KEY,
          baseURL: process.env.OPENAI_BASE_URL,
          timeout: parseInt(process.env.OPENAI_TIMEOUT) || 30000,
        },
        claude: {
          apiKey: process.env.ANTHROPIC_API_KEY,
          baseURL: process.env.ANTHROPIC_BASE_URL,
          timeout: parseInt(process.env.CLAUDE_TIMEOUT) || 30000,
        },
        gemini: {
          apiKey: process.env.GOOGLE_API_KEY,
          baseURL: process.env.GEMINI_BASE_URL,
          timeout: parseInt(process.env.GEMINI_TIMEOUT) || 30000,
        },
      },
      defaultProvider: process.env.AI_DEFAULT_PROVIDER || 'openai',
      fallbackProviders: (process.env.AI_FALLBACK_PROVIDERS || '')
        .split(',')
        .filter(Boolean),
    };

    // 监控配置
    this.config.monitoring = {
      enabled: process.env.MONITORING_ENABLED !== 'false',
      metrics: {
        enabled: process.env.METRICS_ENABLED !== 'false',
        interval: parseInt(process.env.METRICS_INTERVAL) || 30000,
      },
      logging: {
        level: process.env.LOG_LEVEL || 'info',
        format: process.env.LOG_FORMAT || 'json',
      },
    };

    // 安全配置
    this.config.security = {
      cors: {
        origin: process.env.CORS_ORIGIN
          ? process.env.CORS_ORIGIN.split(',')
          : ['http://localhost:3000'],
        credentials: process.env.CORS_CREDENTIALS === 'true',
      },
      rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 900000, // 15分钟
        max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
      },
      helmet: {
        contentSecurityPolicy: process.env.CSP_ENABLED === 'true',
        hsts: {
          maxAge: parseInt(process.env.HSTS_MAX_AGE) || 31536000,
        },
      },
    };
  }

  /**
   * 加载配置文件
   */
  async loadConfigFiles() {
    const configFiles = [
      './config/default.json',
      `./config/${this.config.app.env}.json`,
      './config/local.json',
    ];

    for (const file of configFiles) {
      try {
        const fileConfig = await this.loadConfigFile(file);
        this.mergeConfig(this.config, fileConfig);
      } catch (error) {
        // 配置文件不存在是正常的
        if (error.code !== 'ENOENT') {
          console.warn(`Failed to load config file ${file}:`, error.message);
        }
      }
    }
  }

  /**
   * 应用默认值
   */
  applyDefaults() {
    // 递归应用默认值
    this.applyDefaultsRecursive(this.config, this.getDefaultConfig());
  }

  /**
   * 验证配置
   */
  validateConfig() {
    const errors = [];

    // 必需配置检查
    if (!this.config.jwt.secret) {
      errors.push('JWT_SECRET is required');
    }

    if (!this.config.database.username || !this.config.database.password) {
      errors.push('Database credentials are required');
    }

    // AI提供商检查
    const hasValidProvider = Object.values(this.config.ai.providers).some(
      (provider) => provider.apiKey,
    );

    if (!hasValidProvider) {
      errors.push('At least one AI provider API key is required');
    }

    // 自定义验证器
    for (const [key, validator] of this.validators) {
      try {
        const value = this.getNestedValue(this.config, key);
        if (!validator(value)) {
          errors.push(`Invalid configuration for ${key}`);
        }
      } catch (error) {
        errors.push(
          `Configuration validation error for ${key}: ${error.message}`,
        );
      }
    }

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
    }
  }

  /**
   * 后处理配置
   */
  postProcessConfig() {
    // 处理特殊格式
    if (
      this.config.database.password &&
      this.config.database.password.startsWith('encrypted:')
    ) {
      // 解密密码
      this.config.database.password = this.decryptPassword(
        this.config.database.password.substring(10),
      );
    }

    // 转换时间格式
    if (this.config.security.rateLimit.windowMs) {
      // 确保是数字
      this.config.security.rateLimit.windowMs = parseInt(
        this.config.security.rateLimit.windowMs,
      );
    }
  }

  /**
   * 获取配置值
   */
  get(key, defaultValue = undefined) {
    return this.getNestedValue(this.config, key) ?? defaultValue;
  }

  /**
   * 设置配置值
   */
  set(key, value) {
    this.setNestedValue(this.config, key, value);
  }

  /**
   * 添加配置验证器
   */
  addValidator(key, validator) {
    this.validators.set(key, validator);
  }

  /**
   * 获取默认配置
   */
  getDefaultConfig() {
    return {
      app: {
        name: 'frys',
        version: '1.0.0',
        env: 'development',
        port: 3000,
        host: 'localhost',
      },
      monitoring: {
        enabled: true,
        metrics: { enabled: true, interval: 30000 },
        logging: { level: 'info', format: 'json' },
      },
      security: {
        cors: { origin: ['http://localhost:3000'], credentials: false },
        rateLimit: { windowMs: 900000, max: 100 },
        helmet: { contentSecurityPolicy: true },
      },
    };
  }

  // 辅助方法
  async loadConfigFile(filePath) {
    const fs = await import('fs/promises');
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  }

  mergeConfig(target, source) {
    for (const [key, value] of Object.entries(source)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        target[key] = target[key] || {};
        this.mergeConfig(target[key], value);
      } else {
        target[key] = value;
      }
    }
  }

  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  setNestedValue(obj, path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((current, key) => {
      current[key] = current[key] || {};
      return current[key];
    }, obj);
    target[lastKey] = value;
  }

  decryptPassword(encrypted) {
    // 实现密码解密逻辑
    return encrypted; // 简化实现
  }
}

// 全局配置实例
export const configManager = new ConfigManager();

// 便捷的配置访问函数
export const config = {
  get: (key, defaultValue) => configManager.get(key, defaultValue),
  set: (key, value) => configManager.set(key, value),
  load: () => configManager.load(),
  addValidator: (key, validator) => configManager.addValidator(key, validator),
};

// 导出常用配置
export const appConfig = () => configManager.config.app;
export const dbConfig = () => configManager.config.database;
export const aiConfig = () => configManager.config.ai;
```

## 📝 日志系统 (Logger)

### 结构化日志记录

```javascript
/**
 * 日志管理器 - 提供结构化日志记录功能
 */
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

class Logger {
  constructor(options = {}) {
    this.options = {
      level: process.env.LOG_LEVEL || 'info',
      format: process.env.LOG_FORMAT || 'json',
      enableConsole: process.env.LOG_CONSOLE !== 'false',
      enableFile: process.env.LOG_FILE !== 'false',
      logDir: process.env.LOG_DIR || './logs',
      maxSize: process.env.LOG_MAX_SIZE || '20m',
      maxFiles: process.env.LOG_MAX_FILES || '14d',
      ...options,
    };

    this.logger = this.createLogger();
    this.context = new Map();
  }

  /**
   * 创建Winston日志器
   */
  createLogger() {
    const transports = [];

    // 控制台输出
    if (this.options.enableConsole) {
      transports.push(
        new winston.transports.Console({
          level: this.options.level,
          format:
            this.options.format === 'json'
              ? winston.format.combine(
                  winston.format.timestamp(),
                  winston.format.errors({ stack: true }),
                  winston.format.json(),
                )
              : winston.format.combine(
                  winston.format.timestamp(),
                  winston.format.errors({ stack: true }),
                  winston.format.colorize(),
                  winston.format.simple(),
                ),
        }),
      );
    }

    // 文件输出
    if (this.options.enableFile) {
      // 错误日志
      transports.push(
        new DailyRotateFile({
          level: 'error',
          filename: `${this.options.logDir}/error-%DATE%.log`,
          datePattern: 'YYYY-MM-DD',
          maxSize: this.options.maxSize,
          maxFiles: this.options.maxFiles,
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.errors({ stack: true }),
            winston.format.json(),
          ),
        }),
      );

      // 组合日志
      transports.push(
        new DailyRotateFile({
          filename: `${this.options.logDir}/combined-%DATE%.log`,
          datePattern: 'YYYY-MM-DD',
          maxSize: this.options.maxSize,
          maxFiles: this.options.maxFiles,
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.errors({ stack: true }),
            winston.format.json(),
          ),
        }),
      );
    }

    return winston.createLogger({
      level: this.options.level,
      transports,
      exitOnError: false,
    });
  }

  /**
   * 设置上下文
   */
  setContext(key, value) {
    this.context.set(key, value);
  }

  /**
   * 清除上下文
   */
  clearContext(key = null) {
    if (key) {
      this.context.delete(key);
    } else {
      this.context.clear();
    }
  }

  /**
   * 创建子日志器
   */
  child(context = {}) {
    const childLogger = new Logger(this.options);
    childLogger.context = new Map([
      ...this.context,
      ...Object.entries(context),
    ]);
    childLogger.logger = this.logger.child(context);
    return childLogger;
  }

  /**
   * 记录日志
   */
  log(level, message, meta = {}) {
    const logEntry = {
      ...meta,
      ...Object.fromEntries(this.context),
      timestamp: new Date().toISOString(),
    };

    this.logger.log(level, message, logEntry);
  }

  /**
   * 调试日志
   */
  debug(message, meta = {}) {
    this.log('debug', message, meta);
  }

  /**
   * 信息日志
   */
  info(message, meta = {}) {
    this.log('info', message, meta);
  }

  /**
   * 警告日志
   */
  warn(message, meta = {}) {
    this.log('warn', message, meta);
  }

  /**
   * 错误日志
   */
  error(message, error = null, meta = {}) {
    const logMeta = { ...meta };

    if (error) {
      if (error instanceof Error) {
        logMeta.error = {
          name: error.name,
          message: error.message,
          stack: error.stack,
        };
      } else {
        logMeta.error = error;
      }
    }

    this.log('error', message, logMeta);
  }

  /**
   * 业务日志
   */
  business(operation, data = {}, meta = {}) {
    this.info(`Business operation: ${operation}`, {
      ...meta,
      operation,
      ...data,
      category: 'business',
    });
  }

  /**
   * 审计日志
   */
  audit(action, userId, resource, details = {}, meta = {}) {
    this.info(`Audit: ${action}`, {
      ...meta,
      action,
      userId,
      resource,
      ...details,
      category: 'audit',
      level: 'info',
    });
  }

  /**
   * 性能日志
   */
  performance(operation, duration, meta = {}) {
    this.info(`Performance: ${operation}`, {
      ...meta,
      operation,
      duration,
      durationUnit: 'ms',
      category: 'performance',
    });
  }

  /**
   * 安全日志
   */
  security(event, details = {}, meta = {}) {
    this.warn(`Security event: ${event}`, {
      ...meta,
      event,
      ...details,
      category: 'security',
    });
  }

  /**
   * 请求日志中间件
   */
  requestLogger() {
    return (req, res, next) => {
      const startTime = Date.now();
      const requestId = this.generateRequestId();

      // 设置请求ID到响应头
      res.setHeader('X-Request-ID', requestId);

      // 创建请求上下文
      const requestContext = {
        requestId,
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        userId: req.user?.id,
      };

      // 设置上下文
      this.setContext('requestId', requestId);
      this.setContext('userId', req.user?.id);

      // 记录请求开始
      this.info('Request started', {
        ...requestContext,
        category: 'request',
      });

      // 监听响应完成
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        const responseContext = {
          ...requestContext,
          statusCode: res.statusCode,
          duration,
          contentLength: res.getHeader('Content-Length'),
        };

        // 根据状态码选择日志级别
        if (res.statusCode >= 500) {
          this.error('Request failed', null, {
            ...responseContext,
            category: 'request',
          });
        } else if (res.statusCode >= 400) {
          this.warn('Request client error', {
            ...responseContext,
            category: 'request',
          });
        } else {
          this.info('Request completed', {
            ...responseContext,
            category: 'request',
          });
        }
      });

      // 监听响应错误
      res.on('error', (error) => {
        const duration = Date.now() - startTime;
        this.error('Request error', error, {
          ...requestContext,
          duration,
          category: 'request',
        });
      });

      next();
    };
  }

  /**
   * 生成请求ID
   */
  generateRequestId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 获取日志统计
   */
  getStats() {
    // Winston没有内置统计，这里返回基本信息
    return {
      level: this.options.level,
      transports: this.logger.transports.length,
      contextKeys: this.context.size,
    };
  }

  /**
   * 刷新日志缓冲
   */
  flush() {
    return new Promise((resolve) => {
      this.logger.on('finish', resolve);
      this.logger.end();
    });
  }
}

// 创建全局日志器实例
export const logger = new Logger();

// 便捷的日志函数
export const createLogger = (context = {}) => logger.child(context);
```

## 🔒 密钥管理 (Secret Manager)

### 密钥存储和管理

```javascript
/**
 * 密钥管理器 - 处理敏感信息的加密存储和管理
 */
import crypto from 'crypto';
import fs from 'fs/promises';

class SecretManager {
  constructor(options = {}) {
    this.options = {
      keyFile: options.keyFile || './.secret-key',
      secretsFile: options.secretsFile || './secrets.json',
      algorithm: options.algorithm || 'aes-256-gcm',
      keyLength: options.keyLength || 32,
      ...options,
    };

    this.masterKey = null;
    this.secrets = new Map();
    this.initialized = false;
  }

  /**
   * 初始化密钥管理器
   */
  async initialize() {
    if (this.initialized) return this;

    try {
      // 加载或生成主密钥
      this.masterKey = await this.loadOrGenerateMasterKey();

      // 加载已存储的密钥
      await this.loadSecrets();

      this.initialized = true;
      console.log('密钥管理器初始化完成');

      return this;
    } catch (error) {
      console.error('密钥管理器初始化失败:', error);
      throw error;
    }
  }

  /**
   * 加载或生成主密钥
   */
  async loadOrGenerateMasterKey() {
    try {
      // 尝试从文件加载
      const keyData = await fs.readFile(this.options.keyFile, 'utf8');
      return Buffer.from(keyData.trim(), 'hex');
    } catch (error) {
      if (error.code === 'ENOENT') {
        // 文件不存在，生成新密钥
        console.log('生成新的主密钥...');
        const key = crypto.randomBytes(this.options.keyLength);

        // 保存到文件
        await fs.writeFile(this.options.keyFile, key.toString('hex'), {
          mode: 0o600, // 只有所有者可读写
        });

        console.warn('⚠️  已生成新的主密钥，请妥善保管密钥文件！');
        return key;
      }

      throw error;
    }
  }

  /**
   * 加载存储的密钥
   */
  async loadSecrets() {
    try {
      const encryptedData = await fs.readFile(this.options.secretsFile, 'utf8');
      const decryptedData = this.decrypt(encryptedData);
      const secrets = JSON.parse(decryptedData);

      for (const [key, value] of Object.entries(secrets)) {
        this.secrets.set(key, value);
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        // 文件不存在，创建空文件
        await this.saveSecrets();
      } else {
        throw new Error(`Failed to load secrets: ${error.message}`);
      }
    }
  }

  /**
   * 保存密钥到文件
   */
  async saveSecrets() {
    const secretsObj = Object.fromEntries(this.secrets);
    const encryptedData = this.encrypt(JSON.stringify(secretsObj));

    await fs.writeFile(this.options.secretsFile, encryptedData, {
      mode: 0o600,
    });
  }

  /**
   * 存储密钥
   */
  async setSecret(key, value) {
    if (!this.initialized) {
      throw new Error('SecretManager not initialized');
    }

    this.secrets.set(key, value);
    await this.saveSecrets();

    console.log(`密钥 '${key}' 已存储`);
  }

  /**
   * 获取密钥
   */
  getSecret(key, defaultValue = null) {
    if (!this.initialized) {
      throw new Error('SecretManager not initialized');
    }

    return this.secrets.get(key) ?? defaultValue;
  }

  /**
   * 删除密钥
   */
  async deleteSecret(key) {
    if (!this.initialized) {
      throw new Error('SecretManager not initialized');
    }

    const deleted = this.secrets.delete(key);
    if (deleted) {
      await this.saveSecrets();
      console.log(`密钥 '${key}' 已删除`);
    }

    return deleted;
  }

  /**
   * 检查密钥是否存在
   */
  hasSecret(key) {
    return this.secrets.has(key);
  }

  /**
   * 获取所有密钥名称
   */
  listSecrets() {
    return Array.from(this.secrets.keys());
  }

  /**
   * 加密数据
   */
  encrypt(plainText) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(this.options.algorithm, this.masterKey);

    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * 解密数据
   */
  decrypt(encryptedText) {
    const [ivHex, encrypted] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipher(
      this.options.algorithm,
      this.masterKey,
    );

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * 生成随机密钥
   */
  generateSecret(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * 生成JWT密钥
   */
  generateJWTKey() {
    return this.generateSecret(32); // 256位密钥
  }

  /**
   * 生成数据库密码
   */
  generatePassword(length = 16) {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';

    for (let i = 0; i < length; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return password;
  }

  /**
   * 验证密码强度
   */
  validatePasswordStrength(password) {
    const checks = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      numbers: /\d/.test(password),
      special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
    };

    const score = Object.values(checks).filter(Boolean).length;

    return {
      isValid: score >= 4, // 至少满足4个条件
      score,
      checks,
      strength: score >= 5 ? 'strong' : score >= 3 ? 'medium' : 'weak',
    };
  }

  /**
   * 轮换主密钥
   */
  async rotateMasterKey() {
    console.log('开始轮换主密钥...');

    // 生成新密钥
    const newKey = crypto.randomBytes(this.options.keyLength);

    // 重新加密所有密钥
    const secretsObj = Object.fromEntries(this.secrets);
    const plainText = JSON.stringify(secretsObj);

    // 使用新密钥加密
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(this.options.algorithm, newKey);
    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const newEncryptedData = iv.toString('hex') + ':' + encrypted;

    // 保存新加密数据
    await fs.writeFile(this.options.secretsFile, newEncryptedData, {
      mode: 0o600,
    });

    // 保存新密钥
    await fs.writeFile(this.options.keyFile, newKey.toString('hex'), {
      mode: 0o600,
    });

    // 更新内存中的密钥
    this.masterKey = newKey;

    console.log('主密钥轮换完成');
  }

  /**
   * 导出密钥（用于备份）
   */
  async exportSecrets() {
    if (!this.initialized) {
      throw new Error('SecretManager not initialized');
    }

    const exportData = {
      timestamp: new Date().toISOString(),
      secrets: Object.fromEntries(this.secrets),
      checksum: this.calculateChecksum(Object.fromEntries(this.secrets)),
    };

    return exportData;
  }

  /**
   * 导入密钥（用于恢复）
   */
  async importSecrets(exportData) {
    if (!this.initialized) {
      throw new Error('SecretManager not initialized');
    }

    // 验证校验和
    const currentChecksum = this.calculateChecksum(exportData.secrets);
    if (currentChecksum !== exportData.checksum) {
      throw new Error('Invalid checksum - data may be corrupted');
    }

    // 导入密钥
    this.secrets.clear();
    for (const [key, value] of Object.entries(exportData.secrets)) {
      this.secrets.set(key, value);
    }

    await this.saveSecrets();
    console.log('密钥导入完成');
  }

  /**
   * 计算校验和
   */
  calculateChecksum(data) {
    const str = JSON.stringify(data, Object.keys(data).sort());
    return crypto.createHash('sha256').update(str).digest('hex');
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      initialized: this.initialized,
      secretsCount: this.secrets.size,
      masterKeyLoaded: !!this.masterKey,
      algorithm: this.options.algorithm,
    };
  }
}

// 创建全局密钥管理器实例
export const secretManager = new SecretManager();

// 便捷的密钥访问函数
export const secrets = {
  get: (key, defaultValue) => secretManager.getSecret(key, defaultValue),
  set: (key, value) => secretManager.setSecret(key, value),
  has: (key) => secretManager.hasSecret(key),
  delete: (key) => secretManager.deleteSecret(key),
  list: () => secretManager.listSecrets(),
  generate: (length) => secretManager.generateSecret(length),
};
```

## 🛡️ 类型检查 (Type Guards)

### 运行时类型验证

```javascript
/**
 * 类型检查和数据验证工具
 */

/**
 * 电子邮件验证
 */
export function isValidEmail(email) {
  if (typeof email !== 'string') return false;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return false;

  // 检查长度限制
  if (email.length > 254) return false;

  // 检查本地部分和域名部分
  const [localPart, domain] = email.split('@');
  if (localPart.length > 64) return false;
  if (domain.length > 253) return false;

  return true;
}

/**
 * URL验证
 */
export function isValidUrl(url) {
  if (typeof url !== 'string') return false;

  try {
    const parsedUrl = new URL(url);

    // 检查协议
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return false;
    }

    // 检查主机名
    if (!parsedUrl.hostname) {
      return false;
    }

    return true;
  } catch (error) {
    return false;
  }
}

/**
 * UUID验证
 */
export function isValidUUID(uuid) {
  if (typeof uuid !== 'string') return false;

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * 密码强度验证
 */
export function isValidPassword(password) {
  if (typeof password !== 'string') return false;

  // 基础检查
  if (password.length < 8 || password.length > 128) return false;

  // 复杂度检查
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  // 至少满足3个复杂度条件
  const complexityCount = [
    hasUpperCase,
    hasLowerCase,
    hasNumbers,
    hasSpecialChar,
  ].filter(Boolean).length;
  return complexityCount >= 3;
}

/**
 * 整数验证
 */
export function isValidInteger(value, min = null, max = null) {
  if (typeof value === 'string') {
    const num = parseInt(value, 10);
    if (isNaN(num) || num.toString() !== value) return false;
    value = num;
  }

  if (!Number.isInteger(value)) return false;

  if (min !== null && value < min) return false;
  if (max !== null && value > max) return false;

  return true;
}

/**
 * 浮点数验证
 */
export function isValidFloat(value, min = null, max = null) {
  if (typeof value === 'string') {
    const num = parseFloat(value);
    if (isNaN(num)) return false;
    value = num;
  }

  if (typeof value !== 'number' || !isFinite(value)) return false;

  if (min !== null && value < min) return false;
  if (max !== null && value > max) return false;

  return true;
}

/**
 * 字符串长度验证
 */
export function isValidStringLength(str, min = 0, max = null) {
  if (typeof str !== 'string') return false;

  if (str.length < min) return false;
  if (max !== null && str.length > max) return false;

  return true;
}

/**
 * 数组验证
 */
export function isValidArray(
  arr,
  minLength = 0,
  maxLength = null,
  itemValidator = null,
) {
  if (!Array.isArray(arr)) return false;

  if (arr.length < minLength) return false;
  if (maxLength !== null && arr.length > maxLength) return false;

  if (itemValidator) {
    return arr.every(itemValidator);
  }

  return true;
}

/**
 * 对象验证
 */
export function isValidObject(obj, requiredKeys = [], schema = null) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;

  // 检查必需的键
  for (const key of requiredKeys) {
    if (!(key in obj)) return false;
  }

  // 如果提供了模式，验证每个属性
  if (schema) {
    for (const [key, validator] of Object.entries(schema)) {
      if (key in obj && !validator(obj[key])) {
        return false;
      }
    }
  }

  return true;
}

/**
 * 枚举值验证
 */
export function isValidEnum(value, allowedValues) {
  return allowedValues.includes(value);
}

/**
 * 日期验证
 */
export function isValidDate(date) {
  if (date instanceof Date) {
    return !isNaN(date.getTime());
  }

  if (typeof date === 'string') {
    const parsed = new Date(date);
    return !isNaN(parsed.getTime());
  }

  return false;
}

/**
 * 数据清理函数
 */
export function sanitizeInput(input) {
  if (typeof input !== 'string') return input;

  return (
    input
      // 移除控制字符
      .replace(/[\x00-\x1F\x7F-\x9F]/g, '')
      // 转义HTML实体
      .replace(/[<>'"&]/g, (char) => {
        const entityMap = {
          '<': '&lt;',
          '>': '&gt;',
          "'": '&#39;',
          '"': '&quot;',
          '&': '&amp;',
        };
        return entityMap[char];
      })
      // 限制连续空格
      .replace(/\s{2,}/g, ' ')
      // 移除前后空格
      .trim()
  );
}

/**
 * 深度清理对象
 */
export function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item));
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeInput(value);
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * 创建类型守卫
 */
export function createTypeGuard(validator) {
  return function (value, errorMessage = 'Type validation failed') {
    if (!validator(value)) {
      throw new Error(errorMessage);
    }
    return true;
  };
}

/**
 * 验证对象结构
 */
export function validateObject(obj, schema) {
  const errors = [];

  for (const [field, rules] of Object.entries(schema)) {
    const value = obj[field];

    // 检查必需字段
    if (rules.required && (value === undefined || value === null)) {
      errors.push(`${field} is required`);
      continue;
    }

    // 如果字段是可选的且为空，跳过验证
    if (!rules.required && (value === undefined || value === null)) {
      continue;
    }

    // 类型检查
    if (rules.type) {
      const typeMap = {
        string: 'string',
        number: 'number',
        boolean: 'boolean',
        array: Array.isArray,
        object: (v) => typeof v === 'object' && !Array.isArray(v),
        email: isValidEmail,
        url: isValidUrl,
        uuid: isValidUUID,
        date: isValidDate,
      };

      const typeChecker = typeMap[rules.type];
      if (typeChecker) {
        if (typeof typeChecker === 'string') {
          if (typeof value !== typeChecker) {
            errors.push(`${field} must be of type ${rules.type}`);
          }
        } else if (!typeChecker(value)) {
          errors.push(`${field} is not a valid ${rules.type}`);
        }
      }
    }

    // 长度检查（字符串和数组）
    if (rules.minLength !== undefined && value.length < rules.minLength) {
      errors.push(
        `${field} must be at least ${rules.minLength} characters long`,
      );
    }

    if (rules.maxLength !== undefined && value.length > rules.maxLength) {
      errors.push(
        `${field} must be at most ${rules.maxLength} characters long`,
      );
    }

    // 数值范围检查
    if (rules.min !== undefined && value < rules.min) {
      errors.push(`${field} must be at least ${rules.min}`);
    }

    if (rules.max !== undefined && value > rules.max) {
      errors.push(`${field} must be at most ${rules.max}`);
    }

    // 枚举检查
    if (rules.enum && !rules.enum.includes(value)) {
      errors.push(`${field} must be one of: ${rules.enum.join(', ')}`);
    }

    // 正则表达式检查
    if (rules.pattern && !rules.pattern.test(value)) {
      errors.push(`${field} does not match required pattern`);
    }

    // 自定义验证
    if (rules.custom && !rules.custom(value)) {
      errors.push(`${field} failed custom validation`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * 类型安全的属性访问
 */
export function safeGet(obj, path, defaultValue = undefined) {
  try {
    return path.split('.').reduce((current, key) => current[key], obj);
  } catch (error) {
    return defaultValue;
  }
}

/**
 * 类型安全的属性设置
 */
export function safeSet(obj, path, value) {
  const keys = path.split('.');
  const lastKey = keys.pop();
  const target = keys.reduce((current, key) => {
    if (
      !(key in current) ||
      typeof current[key] !== 'object' ||
      current[key] === null
    ) {
      current[key] = {};
    }
    return current[key];
  }, obj);

  target[lastKey] = value;
  return obj;
}
```

## 🔧 依赖注入配置

### 工具服务注册

```javascript
import { container } from 'frys-shared';

// 注册配置管理器
container.register('configManager', () => configManager);
container.register('config', () => config);

// 注册日志器
container.register('logger', () => logger);
container.register('createLogger', () => createLogger);

// 注册密钥管理器
container.register('secretManager', () => secretManager);
container.register('secrets', () => secrets);

// 注册类型检查工具
container.register('typeGuards', () => ({
  isValidEmail,
  isValidUrl,
  isValidUUID,
  isValidPassword,
  sanitizeInput,
  validateObject,
  createTypeGuard,
}));
```

## 📊 监控和指标

### 工具层指标

```javascript
// 配置管理指标
const configMetrics = {
  loadTime: configManager.loadTime,
  validationErrors: configManager.validationErrors,
  environmentVariables: Object.keys(process.env).length,
  configKeys: Object.keys(configManager.config).length,
};

// 日志系统指标
const loggerMetrics = {
  totalLogs: logger.getStats().totalLogs,
  errorLogs: logger.getStats().errorLogs,
  transports: logger.getStats().transports,
  contextKeys: logger.getStats().contextKeys,
};

// 密钥管理指标
const secretMetrics = {
  secretsCount: secretManager.getStats().secretsCount,
  initialized: secretManager.getStats().initialized,
  algorithm: secretManager.getStats().algorithm,
  lastRotation: secretManager.getStats().lastRotation,
};
```

## 🧪 测试策略

### 工具层单元测试

```javascript
import { describe, it, expect, vi } from 'vitest';
import {
  isValidEmail,
  validateObject,
  sanitizeInput,
} from '../utils/type-guards.js';

describe('Type Guards', () => {
  describe('isValidEmail', () => {
    it('should validate correct email addresses', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name+tag@example.co.uk')).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      expect(isValidEmail('invalid-email')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
    });

    it('should reject non-string inputs', () => {
      expect(isValidEmail(null)).toBe(false);
      expect(isValidEmail(123)).toBe(false);
      expect(isValidEmail({})).toBe(false);
    });
  });

  describe('validateObject', () => {
    const schema = {
      name: { type: 'string', required: true, minLength: 2 },
      email: { type: 'email', required: true },
      age: { type: 'number', min: 0, max: 150 },
    };

    it('should validate correct objects', () => {
      const obj = {
        name: 'John',
        email: 'john@example.com',
        age: 25,
      };

      const result = validateObject(obj, schema);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject objects with validation errors', () => {
      const obj = {
        name: 'A', // 太短
        email: 'invalid-email', // 无效邮箱
        age: 200, // 超出范围
      };

      const result = validateObject(obj, schema);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('sanitizeInput', () => {
    it('should sanitize HTML characters', () => {
      expect(sanitizeInput('<script>alert("xss")</script>')).toBe(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;',
      );
    });

    it('should remove control characters', () => {
      expect(sanitizeInput('Hello\x00World\x1F')).toBe('HelloWorld');
    });

    it('should trim whitespace', () => {
      expect(sanitizeInput('  hello world  ')).toBe('hello world');
    });
  });
});
```

## ❓ 常见问题

### Q: 如何管理敏感配置？

**A:** 使用环境变量和密钥管理：

```javascript
// 1. 环境变量用于非敏感配置
const config = {
  app: {
    port: parseInt(process.env.PORT) || 3000,
    env: process.env.NODE_ENV || 'development',
  },
  database: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 5432,
  },
};

// 2. 密钥管理器处理敏感数据
await secretManager.initialize();

// 存储敏感配置
await secretManager.setSecret('db.password', process.env.DB_PASSWORD);
await secretManager.setSecret('jwt.secret', process.env.JWT_SECRET);

// 使用时从密钥管理器获取
const dbConfig = {
  ...config.database,
  password: secretManager.getSecret('db.password'),
};
```

### Q: 日志级别如何选择？

**A:** 根据环境选择合适的日志级别：

```javascript
// 开发环境 - 记录详细信息
const devLogger = new Logger({
  level: 'debug',
  format: 'dev', // 彩色控制台输出
  enableConsole: true,
  enableFile: false,
});

// 生产环境 - 只记录重要信息
const prodLogger = new Logger({
  level: 'info',
  format: 'json', // 结构化JSON输出
  enableConsole: false,
  enableFile: true,
  logDir: '/var/log/frys',
});

// 根据严重程度记录不同级别
logger.error('Database connection failed', error); // 错误
logger.warn('High memory usage detected', { usage: '85%' }); // 警告
logger.info('User login successful', { userId, ip }); // 信息
logger.debug('Cache hit ratio', { ratio: 0.95 }); // 调试
```

### Q: 如何确保类型安全？

**A:** 结合运行时检查和静态类型：

```typescript
// 1. TypeScript接口定义
interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
}

// 2. 运行时验证schema
const userSchema = {
  id: { type: 'uuid', required: true },
  email: { type: 'email', required: true },
  name: { type: 'string', required: true, minLength: 2, maxLength: 50 },
  role: { type: 'enum', enum: ['admin', 'user'], required: true },
};

// 3. 验证函数
function validateUser(data: any): User {
  const result = validateObject(data, userSchema);

  if (!result.isValid) {
    throw new ValidationError('Invalid user data', result.errors);
  }

  // 类型断言
  return data as User;
}

// 4. 使用验证
app.post('/users', (req, res) => {
  try {
    const user = validateUser(req.body);
    // user现在是类型安全的User对象
    const savedUser = await userService.createUser(user);
    res.json(savedUser);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
```

## 📚 相关链接

- [应用服务层文档](application-layer.md) - 应用服务层的实现
- [基础设施层文档](infrastructure-layer.md) - 基础设施实现
- [表示层文档](presentation-layer.md) - API接口实现
- [测试策略](../testing/testing-architecture.md) - 测试最佳实践
