// 🪶 轻量化配置文件 - 支持环境适配、功能开关、模块配置

import { readFileSync } from 'fs';
import { resolve } from 'path';

// 环境检测
const detectEnvironment = () => {
  const env = process.env.NODE_ENV || 'development';
  const platform = process.platform;
  const arch = process.arch;

  return {
    env,
    platform,
    arch,
    isDev: env === 'development',
    isProd: env === 'production',
    isTest: env === 'test',
    isCI: process.env.CI === 'true',
  };
};

// 功能开关配置
const featureFlags = {
  // 核心功能
  core: {
    ai: process.env.ENABLE_AI !== 'false',
    workflow: process.env.ENABLE_WORKFLOW !== 'false',
    realtime: process.env.ENABLE_REALTIME !== 'false',
  },

  // 监控功能
  monitoring: {
    metrics: process.env.ENABLE_METRICS !== 'false',
    logging: process.env.ENABLE_LOGGING !== 'false',
    tracing: process.env.ENABLE_TRACING !== 'false',
  },

  // 存储功能
  storage: {
    cache: process.env.ENABLE_CACHE !== 'false',
    database: process.env.ENABLE_DATABASE !== 'false',
    filesystem: process.env.ENABLE_FILESYSTEM !== 'false',
  },

  // 安全功能
  security: {
    auth: process.env.ENABLE_AUTH !== 'false',
    encryption: process.env.ENABLE_ENCRYPTION !== 'false',
    audit: process.env.ENABLE_AUDIT !== 'false',
  },

  // 开发功能
  development: {
    hotReload: process.env.ENABLE_HOT_RELOAD !== 'false',
    debug: process.env.ENABLE_DEBUG !== 'false',
    profiling: process.env.ENABLE_PROFILING !== 'false',
  },
};

// 模块配置
const modules = {
  // 核心模块
  core: [
    './src/core/LightweightContainer.js',
    './src/core/BaseModule.js',
    './src/core/WokeFlowError.js',
  ],

  // 可选模块 - 根据功能开关动态加载
  optional: {
    ai: () =>
      featureFlags.core.ai
        ? [
            './src/application/services/ai/OpenAIService.js',
            './src/application/services/ai/ClaudeService.js',
          ]
        : [],

    monitoring: () =>
      featureFlags.monitoring.metrics
        ? [
            './src/infrastructure/tracing/Tracer.js',
            './src/infrastructure/tracing/TracingMiddleware.js',
          ]
        : [],

    security: () =>
      featureFlags.security.auth
        ? ['./src/infrastructure/auth/AuthenticationMiddleware.js']
        : [],
  },

  // 插件模块
  plugins: [
    './src/core/PluginManager.js',
    './src/core/PluginProtocolSystem.js',
  ],
};

// 适配器配置 - 支持多环境适配
const adapters = {
  database: {
    development: 'sqlite',
    test: 'sqlite',
    staging: 'postgresql',
    production: 'postgresql',
  },

  cache: {
    development: 'memory',
    test: 'memory',
    staging: 'redis',
    production: 'redis',
  },

  messaging: {
    development: 'memory',
    test: 'memory',
    staging: 'redis',
    production: 'redis',
  },
};

// 轻量化配置生成器
export function generateLightweightConfig() {
  const env = detectEnvironment();

  return {
    // 环境信息
    environment: env,

    // 功能开关
    features: featureFlags,

    // 模块配置
    modules: {
      ...modules,
      // 展开可选模块
      optional: Object.fromEntries(
        Object.entries(modules.optional).map(([key, loader]) => [
          key,
          loader(),
        ]),
      ),
    },

    // 适配器配置
    adapters: Object.fromEntries(
      Object.entries(adapters).map(([key, config]) => [
        key,
        config[env.env] || config.development,
      ]),
    ),

    // 性能配置
    performance: {
      maxConcurrency: env.isProd ? 10 : 5,
      cacheEnabled: featureFlags.storage.cache,
      compressionEnabled: env.isProd,
      profilingEnabled: featureFlags.development.profiling,
    },

    // 安全配置
    security: {
      corsEnabled: true,
      helmetEnabled: env.isProd,
      rateLimitEnabled: env.isProd,
      auditEnabled: featureFlags.security.audit,
    },

    // 日志配置
    logging: {
      level: env.isDev ? 'debug' : 'info',
      format: env.isCI ? 'json' : 'pretty',
      fileEnabled: env.isProd,
      consoleEnabled: !env.isCI,
    },
  };
}

// 导出默认配置
export const config = generateLightweightConfig();

// 配置文件验证
export function validateConfig(config) {
  const errors = [];

  // 检查必需的配置项
  if (!config.environment) {
    errors.push('缺少环境配置');
  }

  if (!config.modules?.core?.length) {
    errors.push('缺少核心模块配置');
  }

  // 检查功能开关一致性
  if (
    config.features.security.auth &&
    !config.modules.optional.security?.length
  ) {
    errors.push('启用认证功能但缺少安全模块');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// 配置热重载支持
export function reloadConfig() {
  // 清除模块缓存
  Object.keys(require.cache).forEach((key) => {
    if (key.includes('lightweight.config')) {
      delete require.cache[key];
    }
  });

  // 重新生成配置
  return generateLightweightConfig();
}

// 默认导出
export default config;
