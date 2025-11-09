import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: [
      './tests/setup.js',
      './tests/setup-testcontainers.js',
      './tests/setup-test-isolation.js',
    ],
    globals: true,
    // 🚀 修复worker超时问题
    bail: 0, // 允许所有测试运行
    failOnOnly: false, // 允许.only标记用于调试
    testTimeout: 30000, // 增加超时时间到30秒
    hookTimeout: 10000, // hook超时10秒

    // 🔒 禁用隔离避免worker问题
    isolate: false,

    // 📊 详细错误报告
    reporter: process.env.CI
      ? ['verbose', 'json', 'junit', 'github-actions']
      : ['verbose', 'json', 'junit'],

    // 🏃‍♂️ 性能优化 - 简化配置避免worker超时
    maxThreads: 1, // 单线程执行避免资源竞争
    minThreads: 1,
    retry: 0, // 禁用重试，快速失败

    // 简化并行化配置
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true, // 单线程模式
        isolate: false,
        useAtomics: false,
      },
    },
    coverage: {
      provider: 'istanbul',
      enabled: !process.env.CI || process.env.COVERAGE_ENABLED !== 'false',
      reporter: process.env.CI
        ? ['json', 'lcov', 'cobertura', 'text-summary']
        : ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'tests/',
        'scripts/',
        'docs/',
        'dist/',
        'demo-*.js',
        '*.config.js',
        '*.config.mjs',
        'coverage/',
        'test-results/',
        '.github/',
        'monitoring/',
        'examples/',
      ],
      include: ['src/**/*.{js,mjs}'],
      thresholds: {
        // CI环境更严格的阈值
        global: {
          branches: process.env.CI ? 85 : 75,
          functions: process.env.CI ? 85 : 75,
          lines: process.env.CI ? 85 : 75,
          statements: process.env.CI ? 85 : 75,
        },
        './src/core/': {
          branches: process.env.CI ? 90 : 80,
          functions: process.env.CI ? 90 : 80,
          lines: process.env.CI ? 90 : 80,
          statements: process.env.CI ? 90 : 80,
        },
        './src/infrastructure/': {
          branches: process.env.CI ? 80 : 70,
          functions: process.env.CI ? 80 : 70,
          lines: process.env.CI ? 80 : 70,
          statements: process.env.CI ? 80 : 70,
        },
        './src/application/': {
          branches: process.env.CI ? 85 : 75,
          functions: process.env.CI ? 85 : 75,
          lines: process.env.CI ? 85 : 75,
          statements: process.env.CI ? 85 : 75,
        },
        './src/domain/': {
          branches: process.env.CI ? 85 : 75,
          functions: process.env.CI ? 85 : 75,
          lines: process.env.CI ? 85 : 75,
          statements: process.env.CI ? 85 : 75,
        },
        './src/presentation/': {
          branches: process.env.CI ? 80 : 70,
          functions: process.env.CI ? 80 : 70,
          lines: process.env.CI ? 80 : 70,
          statements: process.env.CI ? 80 : 70,
        },
      },
      reportsDirectory: './coverage',
      // 添加覆盖率水印
      watermarks: {
        lines: [80, 95],
        functions: [80, 95],
        branches: [80, 95],
        statements: [80, 95],
      },
    },
    // 改进报告器配置
    reporters: process.env.CI
      ? ['json', 'junit', 'verbose']
      : ['verbose', 'json', 'junit'],
    outputFile: {
      json: './test-results/test-results.json',
      junit: './test-results/junit.xml',
    },
    include: ['tests/**/*.{test,spec}.{js,mjs}'],
    exclude: ['node_modules', 'dist', 'coverage', 'test-results'],
    // 添加测试标签支持
    tags: {
      unit: ['unit'],
      integration: ['integration'],
      e2e: ['e2e'],
      performance: ['performance'],
      security: ['security'],
      redteam: ['red-team'],
      smoke: ['smoke'],
      regression: ['regression'],
    },

    // CI环境优化
    ...(process.env.CI && {
      logHeapUsage: true,
      silent: false,
      // 启用更严格的检查
      dangerouslyIgnoreUnhandledErrors: false,
    }),
  },
});
