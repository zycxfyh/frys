module.exports = {
  // 环境配置
  env: {
    node: true,
    es2022: true,
    browser: true,
  },

  // 全局变量
  globals: {
    global: 'readonly',
    process: 'readonly',
    console: 'readonly',
    __dirname: 'readonly',
    __filename: 'readonly',
  },

  // 解析器配置
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },

  // 扩展配置 (参考主流开源项目)
  extends: ['eslint:recommended'],

  // 插件
  plugins: ['import'],

  // 自定义规则
  rules: {
    // 防御性编程规则
    'no-unused-vars': 'error',
    'no-undef': 'error',
    'no-console': process.env.NODE_ENV === 'production' ? 'error' : 'warn',

    // 错误处理规则
    'no-try-catch': 'off', // 允许try-catch
    'handle-callback-err': 'error',
    'no-throw-literal': 'error',

    // 异步处理规则
    'no-async-promise-executor': 'error',
    'require-await': 'warn',
    'no-return-await': 'error',

    // 代码质量规则
    complexity: ['error', 10],
    'max-depth': ['error', 4],
    'max-lines-per-function': ['warn', 50],
    'max-params': ['warn', 4],

    // 最佳实践
    eqeqeq: ['error', 'always'],
    'no-var': 'error',
    'prefer-const': 'error',
    'object-shorthand': 'error',
    'prefer-template': 'error',
  },

  // 覆盖规则 (针对特定文件或目录)
  overrides: [
    {
      // 测试文件
      files: ['tests/**/*.js', '**/*.test.js', '**/*.spec.js'],
      env: {
        node: true,
        es2022: true,
      },
      rules: {
        'no-console': 'off',
      },
    },
    {
      // 脚本文件
      files: ['scripts/**/*.js'],
      rules: {
        'no-console': 'off',
      },
    },
    {
      // 配置文件
      files: ['*.config.js', '.eslintrc.js', 'vitest.config.js'],
      env: {
        node: true,
      },
      rules: {
        'no-console': 'off',
      },
    },
  ],

  // 忽略文件
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'build/',
    'coverage/',
    'test-results/',
    '*.min.js',
    'backups/',
    'logs/',
    'reports/',
    'tmp/',
  ],

  // 设置
  settings: {
    'import/resolver': {
      node: {
        extensions: ['.js', '.json'],
      },
    },
  },
};
