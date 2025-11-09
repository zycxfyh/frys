# 🚀 快速修复指南

> 基于 [错误报告](./ERROR_REPORT_AND_SOLUTIONS.md) 的快速实施指南

## 📋 前置检查

```bash
# 1. 确认当前分支
git branch

# 2. 确认未提交的更改
git status

# 3. 备份当前工作（可选但推荐）
git stash push -m "backup before fixes"
```

## ⚡ 快速修复步骤

### 步骤 1: 配置 Git 行尾符 (5 分钟)

```bash
# 配置 Git 全局设置
git config --global core.autocrlf false
git config --global core.eol lf

# 配置提交消息模板
git config --global commit.template .gitmessage.txt

# 重新标准化所有文件
git add --renormalize .

# 查看效果
git status
```

### 步骤 2: 安装 Lefthook (2 分钟)

```bash
# 安装 lefthook
npx lefthook install

# 验证安装
npx lefthook run pre-commit
```

### 步骤 3: 修复 PlaceholderSystem 复杂度 (已准备好重构代码)

运行以下命令应用重构：

```bash
# 应用 PlaceholderSystem 重构（已手动完成）
# PlaceholderSystem.js 已经重构完成
```

### 步骤 4: 标准化日志调用 (自动化)

```bash
# 运行日志标准化脚本
pnpm run fix:console-logs
```

### 步骤 5: 格式化代码

```bash
# 格式化所有代码
pnpm run format

# 运行 linter 修复
pnpm run lint:fix
```

### 步骤 6: 运行测试验证

```bash
# 运行单元测试
pnpm run test:unit

# 运行完整测试
pnpm run test

# 检查代码质量
pnpm run quality:quick
```

### 步骤 7: 分组提交

```bash
# 提交配置文件
git add .gitattributes .eslintrc.json lefthook.yml .gitmessage.txt
git commit -m "chore: add git and linting configuration files

- Add .gitattributes for line ending normalization
- Add .eslintrc.json for enhanced linting rules
- Add lefthook.yml for pre-commit hooks
- Add .gitmessage.txt for commit message template"

# 提交重构的 PlaceholderSystem
git add src/core/utils/PlaceholderSystem.js
git commit -m "refactor: reduce complexity in PlaceholderSystem

- Split constructor into smaller initialization methods
- Refactor processString to reduce complexity
- Split evaluateSimpleExpression into specialized evaluators
- Reduce evaluateComparison complexity

Fixes ESLint errors:
- Complexity violations in 3 methods
- Function length violations in 2 methods"

# 提交日志标准化
git add src/core/*.js src/shared/utils/logger.js
git commit -m "refactor: standardize logging across core modules

- Replace console.* with logger.* calls
- Add structured logging with context
- Improve error logging with stack traces"

# 提交其他改进
git add .
git commit -m "chore: apply code formatting and minor fixes

- Run prettier on all files
- Fix remaining linting issues
- Update documentation"
```

## 🔍 验证清单

- [ ] 无 Git CRLF/LF 警告
- [ ] `pnpm run lint` 无错误
- [ ] `pnpm run test` 全部通过
- [ ] `pnpm run quality:quick` 通过
- [ ] 提交信息符合规范
- [ ] 所有更改已提交

## 🆘 常见问题

### Q1: Git 仍然显示 CRLF 警告？

```bash
# 清除 Git 缓存
git rm --cached -r .
git reset --hard
git add --renormalize .
```

### Q2: Lefthook 不工作？

```bash
# 重新安装
pnpm dlx lefthook uninstall
pnpm dlx lefthook install

# 手动运行测试
pnpm dlx lefthook run pre-commit
```

### Q3: 测试失败？

```bash
# 清除缓存重新测试
rm -rf node_modules coverage .vitest
pnpm install
pnpm run test
```

## 📞 需要帮助？

查看完整的 [错误报告和解决方案](./ERROR_REPORT_AND_SOLUTIONS.md)
