module.exports = {
  extends: ['eslint:recommended'],
  env: {
    node: true,
    es2022: true,
  },
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  rules: {
    // 禁用 require-await 规则
    // 原因: 项目中大量使用async函数是为了保持API一致性和未来扩展性
    // 即使当前实现是同步的，保持async可以避免未来重构时的破坏性变更
    'require-await': 'off',

    // 其他规则配置
    'no-unused-vars': ['warn', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
    }],
    'max-lines-per-function': ['warn', 50],
    'no-undef': 'error',
    'no-console': 'off', // 项目中大量使用console进行日志记录
  },
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'coverage/',
    'test-results/',
    'backup*/',
    '*.config.js',
    '*.config.mjs',
  ],
};
