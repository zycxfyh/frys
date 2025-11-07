import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.js', './tests/setup-testcontainers.js'],
    globals: true,
    coverage: {
      provider: 'istanbul',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'tests/',
        'scripts/',
        'docs/',
        'dist/',
        'demo-*.js',
        '*.config.js',
        '*.config.mjs',
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
        './src/core/': {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90,
        },
      },
      reportsDirectory: './coverage',
    },
    testTimeout: 10000,
    maxConcurrency: 5,
    reporters: ['verbose'],
    include: ['tests/**/*.{test,spec}.{js,mjs}'],
    exclude: ['node_modules', 'dist', 'coverage'],
  },
});
