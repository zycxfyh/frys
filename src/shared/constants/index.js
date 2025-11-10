/**
 * Shared Constants Module
 * 共享常量模块
 */

// 应用常量
export const APP_CONSTANTS = {
  NAME: 'frys',
  VERSION: '1.0.0',
  DESCRIPTION: '企业级工作流管理系统',
  AUTHOR: 'frys Team',
  LICENSE: 'MIT'
};

// 时间常量（毫秒）
export const TIME_CONSTANTS = {
  SECOND: 1000,
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
  MONTH: 30 * 24 * 60 * 60 * 1000,
  YEAR: 365 * 24 * 60 * 60 * 1000
};

// 状态常量
export const STATUS_CONSTANTS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  PAUSED: 'paused',
  RUNNING: 'running',
  STOPPED: 'stopped'
};

// 优先级常量
export const PRIORITY_CONSTANTS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent',
  CRITICAL: 'critical'
};

// 环境常量
export const ENVIRONMENT_CONSTANTS = {
  DEVELOPMENT: 'development',
  STAGING: 'staging',
  PRODUCTION: 'production',
  TEST: 'test'
};

// HTTP状态码常量
export const HTTP_STATUS_CONSTANTS = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504
};

// 数据库常量
export const DATABASE_CONSTANTS = {
  DEFAULT_PORT: {
    POSTGRES: 5432,
    MYSQL: 3306,
    MONGODB: 27017,
    REDIS: 6379
  },
  MAX_CONNECTIONS: 10,
  CONNECTION_TIMEOUT: 30000,
  QUERY_TIMEOUT: 30000
};

// 缓存常量
export const CACHE_CONSTANTS = {
  DEFAULT_TTL: 300000, // 5分钟
  MAX_SIZE: 1000,
  CLEANUP_INTERVAL: 60000 // 1分钟
};

// 工作流常量
export const WORKFLOW_CONSTANTS = {
  MAX_EXECUTION_TIME: 3600000, // 1小时
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000,
  MAX_CONCURRENT_JOBS: 10,
  TIMEOUT_BUFFER: 5000 // 5秒
};

// 监控常量
export const MONITORING_CONSTANTS = {
  METRICS_INTERVAL: 60000, // 1分钟
  HEALTH_CHECK_INTERVAL: 30000, // 30秒
  ALERT_COOLDOWN: 300000, // 5分钟
  MAX_LOG_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_LOG_FILES: 5
};

// 安全常量
export const SECURITY_CONSTANTS = {
  JWT_EXPIRES_IN: '24h',
  REFRESH_TOKEN_EXPIRES_IN: '7d',
  BCRYPT_ROUNDS: 12,
  SESSION_TIMEOUT: 3600000, // 1小时
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION: 900000 // 15分钟
};

// 文件常量
export const FILE_CONSTANTS = {
  MAX_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain'],
  UPLOAD_PATH: './uploads',
  TEMP_PATH: './temp'
};

// API常量
export const API_CONSTANTS = {
  VERSION: 'v1',
  PREFIX: '/api',
  RATE_LIMIT: {
    WINDOW_MS: 15 * 60 * 1000, // 15分钟
    MAX_REQUESTS: 100
  },
  PAGINATION: {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 10,
    MAX_LIMIT: 100
  }
};

// 事件常量
export const EVENT_CONSTANTS = {
  WORKFLOW_STARTED: 'workflow.started',
  WORKFLOW_COMPLETED: 'workflow.completed',
  WORKFLOW_FAILED: 'workflow.failed',
  JOB_STARTED: 'job.started',
  JOB_COMPLETED: 'job.completed',
  JOB_FAILED: 'job.failed',
  ERROR_OCCURRED: 'error.occurred',
  HEALTH_CHECK_FAILED: 'health.check.failed'
};

// 通知常量
export const NOTIFICATION_CONSTANTS = {
  EMAIL: 'email',
  SMS: 'sms',
  WEBHOOK: 'webhook',
  SLACK: 'slack',
  TEAMS: 'teams'
};

// 默认导出
export default {
  APP_CONSTANTS,
  TIME_CONSTANTS,
  STATUS_CONSTANTS,
  PRIORITY_CONSTANTS,
  ENVIRONMENT_CONSTANTS,
  HTTP_STATUS_CONSTANTS,
  DATABASE_CONSTANTS,
  CACHE_CONSTANTS,
  WORKFLOW_CONSTANTS,
  MONITORING_CONSTANTS,
  SECURITY_CONSTANTS,
  FILE_CONSTANTS,
  API_CONSTANTS,
  EVENT_CONSTANTS,
  NOTIFICATION_CONSTANTS
};
