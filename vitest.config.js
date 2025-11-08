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
    // 🚀 严格快速失败机制 (GitHub社区最佳实践)
    bail: process.env.CI ? 1 : 3, // CI环境遇到第一个失败就停止，本地允许3个失败
    failOnOnly: true, // 防止意外的.only标记
    testTimeout: process.env.CI ? 5000 : 10000, // CI环境更严格的超时(5秒)
    hookTimeout: process.env.CI ? 2000 : 5000, // hook超时时间

    // 🔒 严格测试隔离
    isolate: true,

    // 📊 详细错误报告
    reporter: process.env.CI
      ? ['verbose', 'json', 'junit', 'github-actions']
      : ['verbose', 'json', 'junit'],

    // 🏃‍♂️ 性能优化
    maxThreads: process.env.CI ? 2 : 4, // 限制并发避免资源竞争
    minThreads: 1,
    retry: process.env.CI ? 3 : 1, // CI环境重试更多次

    // 改进并行化
    pool: process.env.CI ? 'threads' : 'forks',
    poolOptions: {
      threads: {
        singleThread: false,
        isolate: true,
        useAtomics: true, // 提高性能
      },
      forks: {
        singleFork: false,
        isolate: true,
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
