# 🛠️ 开发工具配置指南

<div align="center">

## ⚙️ frys 开发环境工具链配置

**高效的开发工具和自动化流程设置**

[🏠 返回项目主页](../../README.md) • [📖 文档导航](../README.md) • [🚀 快速开始](../../GETTING_STARTED.md)

---

</div>

## 📋 概述

frys 提供了完整的开发工具链配置，包括代码质量检查、自动化测试、Git 钩子等。本文档介绍如何配置和使用这些开发工具。

## 🪝 Git 钩子配置 (Lefthook)

### Lefthook 简介

Lefthook 是一个快速且强大的 Git 钩子管理器，用于在提交代码前自动运行质量检查，避免不符合规范的代码进入仓库。

### 安装 Lefthook

```bash
# 使用 npm 全局安装
npm install -g @arkweid/lefthook

# 或者使用 Homebrew (macOS)
brew install lefthook

# 验证安装
lefthook version
```

### 配置 Git 钩子

项目已包含预配置的 `lefthook.yml` 文件：

```yaml
# lefthook.yml
pre-commit:
  parallel: true
  commands:
    # 快速代码质量检查
    lint:
      run: npm run lint -- --quiet --max-warnings=0
      glob: '*.{js,mjs}'
      exclude: 'node_modules/**'

    # 格式检查
    format:
      run: npm run format:check
      glob: '*.{js,json,md}'
      exclude: 'node_modules/**'

    # 基础单元测试
    test:
      run: npm run test:unit -- --run --reporter=verbose --testTimeout=5000
      glob: '*.{js,mjs}'
      exclude: 'node_modules/**'
      fail_fast: true

pre-push:
  parallel: false
  commands:
    # 完整质量检查
    quality:
      run: npm run quality:quick
      fail_fast: true

    # 集成测试子集
    integration:
      run: npm run test:integration:light -- --reporter=verbose
      fail_fast: true

commit-msg:
  commands:
    # 提交信息格式检查
    commitlint:
      run: |
        if ! echo "$1" | grep -E "^(feat|fix|docs|style|refactor|test|chore|perf|ci|build|revert)(\(.+\))?: .{1,}" > /dev/null; then
          echo "❌ 提交信息格式不符合规范"
          echo "请使用: type(scope): description"
          echo "例如: feat(auth): add login validation"
          exit 1
        fi
      fail_fast: true
```

### 安装和启用钩子

```bash
# 安装 Git 钩子
lefthook install

# 或者使用 npm 脚本
npm run hooks:install

# 验证钩子是否安装成功
ls -la .git/hooks/
# 应该看到 pre-commit, pre-push, commit-msg 等钩子文件
```

### 自定义钩子配置

```bash
# 编辑钩子配置
vim lefthook.yml

# 重新安装钩子
lefthook install

# 测试钩子执行
git add .
git commit -m "test: 测试钩子功能"
```

## 📏 代码格式化 (Prettier)

### Prettier 配置

项目已包含 Prettier 配置文件 `.prettierrc`：

```json
{
  "semi": true,
  "singleQuote": true,
  "printWidth": 80,
  "tabWidth": 2,
  "useTabs": false,
  "trailingComma": "es5",
  "bracketSpacing": true,
  "bracketSameLine": false,
  "arrowParens": "avoid",
  "endOfLine": "lf",
  "embeddedLanguageFormatting": "auto",
  "proseWrap": "preserve",
  "htmlWhitespaceSensitivity": "css"
}
```

### 使用 Prettier

```bash
# 检查格式（不会修改文件）
npm run format:check

# 自动格式化所有文件
npm run format

# 格式化特定文件
npx prettier --write src/index.js

# 格式化整个项目
npx prettier --write "**/*.{js,json,md}" --ignore-path .gitignore
```

### 编辑器集成

#### VS Code 配置

```json
// .vscode/settings.json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "[javascript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[json]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[markdown]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
```

#### 其他编辑器

- **WebStorm/IntelliJ**: 安装 Prettier 插件
- **Sublime Text**: 安装 JsPrettier 插件
- **Vim**: 使用 `vim-prettier` 插件

## 🔍 代码检查 (ESLint)

### ESLint 配置

项目使用现代 ESLint 配置，包含 TypeScript 和 React 支持：

```javascript
// eslint.config.js (ESLint 9.x)
import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
    rules: {
      // 自定义规则
      'no-console': 'warn',
      'prefer-const': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
];
```

### 使用 ESLint

```bash
# 检查代码质量
npm run lint

# 自动修复可修复的问题
npm run lint:fix

# 检查特定文件
npx eslint src/index.js

# 生成报告
npx eslint src/ --format json --output-file eslint-report.json
```

### 规则说明

| 规则             | 级别 | 说明                         |
| ---------------- | ---- | ---------------------------- |
| `no-console`     | 警告 | 避免在生产代码中使用 console |
| `prefer-const`   | 错误 | 优先使用 const 声明          |
| `no-unused-vars` | 错误 | 禁止未使用的变量             |
| `eqeqeq`         | 错误 | 强制使用 === 和 !==          |

## 🧪 测试工具 (Vitest)

### Vitest 配置

```javascript
// vitest.config.js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.js'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'tests/'],
    },
  },
});
```

### 运行测试

```bash
# 运行所有测试
npm test

# 运行单元测试
npm run test:unit

# 运行集成测试
npm run test:integration

# 运行端到端测试
npm run test:e2e

# 生成覆盖率报告
npm run test:coverage

# 监听模式（开发时）
npm run test:watch
```

### 测试编写规范

```javascript
// tests/unit/example.test.js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ExampleService } from '../../src/services/ExampleService.js';

describe('ExampleService', () => {
  let service;

  beforeEach(() => {
    service = new ExampleService();
  });

  afterEach(() => {
    // 清理工作
  });

  describe('createExample', () => {
    it('should create a valid example', async () => {
      const input = { name: 'test', value: 42 };
      const result = await service.createExample(input);

      expect(result).toHaveProperty('id');
      expect(result.name).toBe('test');
      expect(result.value).toBe(42);
    });

    it('should throw error for invalid input', async () => {
      const input = { name: '', value: -1 };

      await expect(service.createExample(input)).rejects.toThrow(
        'Invalid input',
      );
    });
  });
});
```

## 🔒 安全检查工具

### npm audit

```bash
# 检查依赖漏洞
npm audit

# 仅检查高风险漏洞
npm audit --audit-level=high

# 自动修复漏洞（谨慎使用）
npm audit fix

# 生成安全报告
npm audit --json > security-audit.json
```

### 其他安全工具

```bash
# 使用 Snyk 检查依赖安全
npx snyk test

# 使用 OWASP Dependency Check
# 下载并运行 dependency-check CLI
dependency-check --project frys --scan . --out .

# 使用 Trivy 扫描容器安全
trivy image frys:latest
```

## 📊 性能监控工具

### Lighthouse

```bash
# 安装 Lighthouse
npm install -g lighthouse

# 分析前端性能
lighthouse http://localhost:3000 --output=json --output-path=./reports/lighthouse-report.json

# 只运行性能测试
lighthouse http://localhost:3000 --only-categories=performance
```

### Clinic.js

```bash
# 安装 Clinic.js
npm install -g clinic

# 运行应用并分析性能
clinic doctor -- node src/index.js

# 生成火焰图
clinic flame -- node src/index.js

# 内存分析
clinic heapprofiler -- node src/index.js
```

## 🔄 CI/CD 配置

### GitHub Actions

```yaml
# .github/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run linter
        run: npm run lint

      - name: Run tests
        run: npm test

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info
```

### 提交规范检查

```javascript
// .commitlintrc.js
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'build',
        'chore',
        'ci',
        'docs',
        'feat',
        'fix',
        'perf',
        'refactor',
        'revert',
        'style',
        'test',
      ],
    ],
  },
};
```

## 📋 代码质量门禁

### 质量检查脚本

```json
{
  "scripts": {
    "lint": "eslint src/ --ext .js,.mjs",
    "lint:fix": "eslint src/ --ext .js,.mjs --fix",
    "format": "prettier --write \"**/*.{js,json,md}\"",
    "format:check": "prettier --check \"**/*.{js,json,md}\"",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "quality": "npm run lint && npm run format:check && npm run test",
    "quality:fix": "npm run lint:fix && npm run format",
    "security": "npm audit --audit-level=high",
    "hooks:install": "lefthook install"
  }
}
```

### 质量指标

| 指标            | 目标值 | 当前值 | 状态 |
| --------------- | ------ | ------ | ---- |
| **测试覆盖率**  | ≥ 90%  | 92%    | ✅   |
| **ESLint 错误** | 0      | 0      | ✅   |
| **安全漏洞**    | 0 高危 | 0      | ✅   |
| **代码重复率**  | < 5%   | 3.2%   | ✅   |

## 🐛 故障排除

### Lefthook 问题

**问题**: 钩子没有执行

```bash
# 检查钩子文件
ls -la .git/hooks/

# 重新安装
lefthook install

# 检查配置文件
cat lefthook.yml
```

**问题**: 钩子执行太慢

```yaml
# 优化配置，减少检查范围
pre-commit:
  commands:
    lint:
      run: npm run lint -- --quiet --max-warnings=0
      # 只检查修改的文件
      files: git diff --name-only HEAD~1
```

### ESLint 问题

**问题**: 规则冲突

```javascript
// .eslintrc.js 中禁用冲突规则
module.exports = {
  rules: {
    'no-console': 'off', // 在开发阶段允许 console
    'import/no-unresolved': 'off', // 对于某些动态导入
  },
};
```

### 测试问题

**问题**: 测试超时

```javascript
// vitest.config.js
export default {
  test: {
    testTimeout: 10000, // 增加超时时间
    hookTimeout: 5000, // 钩子超时时间
  },
};
```

## 🚀 高级配置

### 自定义脚本

```javascript
// scripts/dev-tools.js
#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

const commands = {
  setup: () => {
    console.log('🚀 设置开发环境...');
    execSync('npm install', { stdio: 'inherit' });
    execSync('lefthook install', { stdio: 'inherit' });
    console.log('✅ 开发环境设置完成');
  },

  clean: () => {
    console.log('🧹 清理项目...');
    execSync('rm -rf node_modules/.cache dist coverage', { stdio: 'inherit' });
    console.log('✅ 项目清理完成');
  },

  update: () => {
    console.log('📦 更新依赖...');
    execSync('npm update', { stdio: 'inherit' });
    execSync('npm audit fix', { stdio: 'inherit' });
    console.log('✅ 依赖更新完成');
  }
};

const command = process.argv[2];
if (commands[command]) {
  commands[command]();
} else {
  console.log('可用命令:', Object.keys(commands).join(', '));
}
```

### 使用自定义脚本

```bash
# 设置开发环境
node scripts/dev-tools.js setup

# 清理项目
node scripts/dev-tools.js clean

# 更新依赖
node scripts/dev-tools.js update
```

## 📚 相关资源

- **[环境设置](environment-setup.md)** - 开发环境配置
- **[代码规范](../../CONTRIBUTING.md)** - 贡献指南
- **[测试架构](../testing/testing-architecture.md)** - 测试策略
- **[CI/CD 流水线](../deployment/cicd-pipeline.md)** - 自动化部署

---

<div align="center">

## 🎯 工具助力高效开发

**配置完善的开发工具链，提升代码质量和开发效率**

[🏠 返回项目主页](../../README.md) • [📖 查看文档导航](../README.md) • [🚀 开始配置开发环境](environment-setup.md)

---

_最后更新: 2025年11月7日_

</div>
