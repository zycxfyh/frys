/**
 * frys Production - 配置文件
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import {
  safeParseInt,
  safeBoolean,
  safeString,
  isValidUrl,
  isValidEmail,
} from './type-guards.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 环境变量处理 - 类型安全的获取
const getEnvVar = (key, defaultValue, validator = null) => {
  const value = process.env[key];

  if (value === undefined || value === null) {
    return defaultValue;
  }

  // 如果提供了验证器，进行验证
  if (validator && !validator(value)) {
    console.warn(`⚠️ 环境变量 ${key} 值无效，使用默认值: ${defaultValue}`);
    return defaultValue;
  }

  return value;
};

// 加载环境配置
const loadEnvConfig = () => {
  // 优先使用测试环境配置文件
  const envFiles = ['test.env', '.env'];

  for (const envFile of envFiles) {
  try {
      const envPath = join(__dirname, '../../', envFile);
    const envContent = readFileSync(envPath, 'utf8');
    const envVars = {};

    envContent.split('\n').forEach((line) => {
        // 跳过注释和空行
        const trimmedLine = line.trim();
        if (trimmedLine && !trimmedLine.startsWith('#')) {
          const [key, ...valueParts] = trimmedLine.split('=');
      if (key && valueParts.length > 0) {
        envVars[key.trim()] = valueParts.join('=').trim();
          }
      }
    });

      if (Object.keys(envVars).length > 0) {
        console.log(`📄 从 ${envFile} 加载了环境配置`);
    return envVars;
      }
  } catch (error) {
      // 文件不存在或读取失败，继续尝试下一个文件
      continue;
    }
  }

  // 如果没有配置文件，使用默认配置
  console.log('⚠️ 未找到环境配置文件，使用默认配置');
  return {};
};

const _envVars = loadEnvConfig();

// 主配置文件
export const config = {
  // 应用配置
  app: {
    name: 'frys Production',
    version: '1.0.0',
    port: safeParseInt(getEnvVar('PORT', '3000'), 3000),
    env: safeString(getEnvVar('NODE_ENV', 'development'), 'development'),
    logLevel: safeString(getEnvVar('LOG_LEVEL', 'info'), 'info'),
  },

  // API 配置
  api: {
    baseURL: getEnvVar('API_BASE_URL', 'http://localhost:3000/api', isValidUrl),
    timeout: safeParseInt(getEnvVar('API_TIMEOUT', '30000'), 30000),
    retries: safeParseInt(getEnvVar('API_RETRIES', '3'), 3),
    retryDelay: safeParseInt(getEnvVar('API_RETRY_DELAY', '1000'), 1000),
  },

  // 消息队列配置
  messaging: {
    cluster: safeString(
      getEnvVar('NATS_CLUSTER', 'frys-prod'),
      'frys-prod',
    ),
    timeout: safeParseInt(getEnvVar('MESSAGING_TIMEOUT', '5000'), 5000),
    maxConnections: safeParseInt(
      getEnvVar('MESSAGING_MAX_CONNECTIONS', '10'),
      10,
    ),
  },

  // 认证配置
  auth: {
    secret: getEnvVar(
      'JWT_SECRET',
      'your-super-secret-jwt-key-change-in-production',
    ),
    expiresIn: getEnvVar('JWT_EXPIRES_IN', '24h'),
    refreshTokenExpiresIn: getEnvVar('JWT_REFRESH_EXPIRES_IN', '7d'),
    issuer: getEnvVar('JWT_ISSUER', 'frys-production'),
    audience: getEnvVar('JWT_AUDIENCE', 'frys-users'),
  },

  // 数据库配置
  database: {
    type: safeString(getEnvVar('DB_TYPE', 'mongodb'), 'mongodb'),
    host: safeString(getEnvVar('DB_HOST', 'localhost'), 'localhost'),
    port: safeParseInt(getEnvVar('DB_PORT', '27017'), 27017),
    name: safeString(getEnvVar('DB_NAME', 'frys_prod'), 'frys_prod'),
    username: getEnvVar('DB_USERNAME'),
    password: getEnvVar('DB_PASSWORD'),
    connectionTimeout: safeParseInt(
      getEnvVar('DB_CONNECTION_TIMEOUT', '30000'),
      30000,
    ),
  },

  // 缓存配置
  cache: {
    type: safeString(getEnvVar('CACHE_TYPE', 'redis'), 'redis'),
    host: safeString(getEnvVar('CACHE_HOST', 'localhost'), 'localhost'),
    port: safeParseInt(getEnvVar('CACHE_PORT', '6379'), 6379),
    password: getEnvVar('CACHE_PASSWORD'),
    ttl: safeParseInt(getEnvVar('CACHE_TTL', '3600'), 3600), // 1小时
    maxConnections: safeParseInt(getEnvVar('CACHE_MAX_CONNECTIONS', '10'), 10),
  },

  // 监控配置
  monitoring: {
    enabled: safeBoolean(getEnvVar('MONITORING_ENABLED', 'true'), true),
    prometheus: {
      port: safeParseInt(getEnvVar('PROMETHEUS_PORT', '9090'), 9090),
      path: safeString(getEnvVar('PROMETHEUS_PATH', '/metrics'), '/metrics'),
    },
    alertmanager: {
      enabled: safeBoolean(getEnvVar('ALERTMANAGER_ENABLED', 'true'), true),
      webhookUrl: getEnvVar('ALERTMANAGER_WEBHOOK_URL', '', isValidUrl),
    },
  },

  // AI服务配置
  ai: {
    providers: {
      openai: {
        apiKey: getEnvVar('OPENAI_API_KEY'),
        baseURL: getEnvVar('OPENAI_BASE_URL', 'https://api.openai.com/v1'),
        models: getEnvVar('OPENAI_MODELS', 'gpt-4,gpt-4-turbo,gpt-3.5-turbo').split(','),
        timeout: safeParseInt(getEnvVar('OPENAI_TIMEOUT', '30000'), 30000),
      },
      claude: {
        apiKey: getEnvVar('CLAUDE_API_KEY'),
        baseURL: getEnvVar('CLAUDE_BASE_URL', 'https://api.anthropic.com'),
        models: getEnvVar('CLAUDE_MODELS', 'claude-3-sonnet-20240229,claude-3-haiku-20240307').split(','),
        timeout: safeParseInt(getEnvVar('CLAUDE_TIMEOUT', '30000'), 30000),
      },
      gemini: {
        apiKey: getEnvVar('GEMINI_API_KEY'),
        baseURL: getEnvVar('GEMINI_BASE_URL', 'https://generativelanguage.googleapis.com'),
        models: getEnvVar('GEMINI_MODELS', 'gemini-pro,gemini-pro-vision').split(','),
        timeout: safeParseInt(getEnvVar('GEMINI_TIMEOUT', '30000'), 30000),
      },
      deepseek: {
        apiKey: getEnvVar('DEEPSEEK_API_KEY'),
        baseURL: getEnvVar('DEEPSEEK_BASE_URL', 'https://api.deepseek.com'),
        models: getEnvVar('DEEPSEEK_MODELS', 'deepseek-chat,deepseek-coder').split(','),
        timeout: safeParseInt(getEnvVar('DEEPSEEK_TIMEOUT', '30000'), 30000),
      },
      alibaba: {
        apiKey: getEnvVar('ALIBABA_API_KEY'),
        baseURL: getEnvVar('ALIBABA_BASE_URL', 'https://dashscope.aliyuncs.com/api/v1'),
        models: getEnvVar('ALIBABA_MODELS', 'qwen-turbo,qwen-plus,qwen-max').split(','),
        timeout: safeParseInt(getEnvVar('ALIBABA_TIMEOUT', '30000'), 30000),
      },
      cognee: {
        apiKey: getEnvVar('COGNEE_API_KEY'),
        baseURL: getEnvVar('COGNEE_BASE_URL', 'https://api.cognee.ai'),
        projectId: getEnvVar('COGNEE_PROJECT_ID'),
        timeout: safeParseInt(getEnvVar('COGNEE_TIMEOUT', '30000'), 30000),
      },
    },
    conversation: {
      maxHistory: safeParseInt(getEnvVar('CONVERSATION_MAX_HISTORY', '50'), 50),
      defaultModel: safeString(getEnvVar('CONVERSATION_DEFAULT_MODEL', 'openai'), 'openai'),
      persistMemory: safeBoolean(getEnvVar('CONVERSATION_PERSIST_MEMORY', 'true'), true),
      timeout: safeParseInt(getEnvVar('CONVERSATION_TIMEOUT', '30000'), 30000),
    },
    memory: {
      enabled: safeBoolean(getEnvVar('MEMORY_ENABLED', 'true'), true),
      type: safeString(getEnvVar('MEMORY_TYPE', 'cognee'), 'cognee'),
      maxContextLength: safeParseInt(getEnvVar('MEMORY_MAX_CONTEXT_LENGTH', '4000'), 4000),
    },
  },

  // 安全配置
  security: {
    cors: {
      origin: getEnvVar('CORS_ORIGIN', 'http://localhost:3000', isValidUrl),
      credentials: true,
    },
    rateLimit: {
      windowMs: safeParseInt(
        getEnvVar('RATE_LIMIT_WINDOW_MS', '900000'),
        900000,
      ), // 15分钟
      max: safeParseInt(getEnvVar('RATE_LIMIT_MAX', '100'), 100), // 15分钟内最多100次请求
    },
    helmet: {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
    },
  },

  // 工作流配置
  workflow: {
    maxConcurrentWorkflows: parseInt(
      getEnvVar('MAX_CONCURRENT_WORKFLOWS', '50'),
    ),
    maxTasksPerWorkflow: parseInt(getEnvVar('MAX_TASKS_PER_WORKFLOW', '100')),
    defaultTimeout: parseInt(getEnvVar('WORKFLOW_DEFAULT_TIMEOUT', '3600000')), // 1小时
    retryAttempts: parseInt(getEnvVar('WORKFLOW_RETRY_ATTEMPTS', '3')),
    retryDelay: parseInt(getEnvVar('WORKFLOW_RETRY_DELAY', '5000')),
  },

  // 通知配置
  notifications: {
    email: {
      enabled: getEnvVar('EMAIL_ENABLED', 'false') === 'true',
      host: getEnvVar('EMAIL_HOST'),
      port: parseInt(getEnvVar('EMAIL_PORT', '587')),
      secure: getEnvVar('EMAIL_SECURE', 'false') === 'true',
      auth: {
        user: getEnvVar('EMAIL_USER'),
        pass: getEnvVar('EMAIL_PASS'),
      },
    },
    slack: {
      enabled: getEnvVar('SLACK_ENABLED', 'false') === 'true',
      webhookUrl: getEnvVar('SLACK_WEBHOOK_URL'),
      channel: getEnvVar('SLACK_CHANNEL', '#frys-notifications'),
    },
  },

  // 日志配置
  logging: {
    level: getEnvVar('LOG_LEVEL', 'info'),
    format: getEnvVar('LOG_FORMAT', 'json'),
    transports: {
      console: {
        enabled: getEnvVar('LOG_CONSOLE_ENABLED', 'true') === 'true',
      },
      file: {
        enabled: getEnvVar('LOG_FILE_ENABLED', 'true') === 'true',
        path: getEnvVar('LOG_FILE_PATH', './logs/frys.log'),
        maxSize: getEnvVar('LOG_FILE_MAX_SIZE', '10m'),
        maxFiles: getEnvVar('LOG_FILE_MAX_FILES', '5'),
      },
    },
  },
};

// 环境特定配置覆盖
if (config.app.env === 'production') {
  // 生产环境特殊配置
  config.api.timeout = 60000; // 生产环境允许更长的超时
  config.monitoring.enabled = true;
  config.security.rateLimit.max = 1000; // 生产环境允许更多请求
} else if (config.app.env === 'staging') {
  // 测试环境配置
  config.monitoring.enabled = true;
  config.logging.level = 'debug';
}

// 验证配置
export const validateConfig = () => {
  const requiredConfigs = ['auth.secret', 'api.baseURL'];

  const missingConfigs = requiredConfigs.filter((path) => {
    const keys = path.split('.');
    let value = config;
    for (const key of keys) {
      value = value[key];
      if (value === undefined) return true;
    }
    return false;
  });

  if (missingConfigs.length > 0) {
    throw new Error(`缺少必要的配置项: ${missingConfigs.join(', ')}`);
  }
};

// 开发模式下打印配置摘要
if (config.app.env === 'development') {
  console.log('🔧 配置加载完成:', {
    env: config.app.env,
    api: config.api.baseURL,
    messaging: config.messaging.cluster,
    monitoring: config.monitoring.enabled,
  });
}
