# 贡献指南

感谢您对 frys 项目的兴趣！我们欢迎各种形式的贡献，包括报告问题、提交功能请求、改进文档、编写代码等。

## 📋 目录

- [行为准则](#行为准则)
- [开始之前](#开始之前)
- [报告问题](#报告问题)
- [功能请求](#功能请求)
- [代码贡献](#代码贡献)
- [文档贡献](#文档贡献)
- [测试](#测试)
- [提交信息规范](#提交信息规范)

## 🤝 行为准则

本项目采用 [贡献者公约](CODE_OF_CONDUCT.md) 作为行为准则。请确保您的贡献符合这些准则。

## 🚀 开始之前

1. **阅读文档**: 熟悉项目的[架构文档](docs/architecture/)和[开发指南](docs/development/)
2. **检查现有问题**: 确保您的贡献不会与现有问题重复
3. **Fork 项目**: 在 GitHub 上 fork 本项目
4. **创建分支**: 为您的贡献创建一个描述性的分支

## 🐛 报告问题

报告问题时，请提供以下信息：

### 问题报告模板

```markdown
**描述**
简要描述问题

**重现步骤**

1. 执行 '...'
2. 点击 '...'
3. 出现错误

**期望行为**
描述您期望发生什么

**实际行为**
描述实际发生了什么

**环境信息**

- OS: [例如 Windows 10]
- Node.js 版本: [例如 16.0.0]
- 浏览器: [例如 Chrome 91.0]
- 项目版本: [例如 v1.0.0]

**截图**
如果适用，请添加截图

**其他信息**
任何其他相关信息
```

## 💡 功能请求

功能请求应该：

- 描述新功能的用例
- 解释为什么这个功能对项目有益
- 提供实现建议（如果可能）

## 💻 代码贡献

### 开发环境设置

```bash
# 克隆项目
git clone https://github.com/your-username/frys.git
cd frys

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 运行测试
npm test
```

### 代码规范

- 使用 ESLint 和 Prettier 进行代码格式化
- 遵循现有的代码风格
- 为新功能编写测试
- 更新相关文档

### 提交 Pull Request

1. **确保测试通过**: 运行完整的测试套件
2. **更新文档**: 如果需要，更新相关文档
3. **编写清晰的提交信息**: 遵循[提交信息规范](#提交信息规范)
4. **描述您的更改**: 在 PR 描述中详细说明您的更改

## 📚 文档贡献

文档改进包括：

- 修复拼写错误
- 改进解释
- 添加示例
- 更新过时信息

文档文件位于 `docs/` 目录下，按类别组织。

## 🧪 测试

- 为新功能编写单元测试
- 为集成点编写集成测试
- 确保所有测试通过
- 保持测试覆盖率

```bash
# 运行所有测试
npm test

# 运行测试覆盖率
npm run test:coverage

# 运行特定测试
npm test -- tests/unit/core/specific-test.test.js
```

## 📝 提交信息规范

我们使用 [Conventional Commits](https://conventionalcommits.org/) 规范：

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### 类型

- `feat`: 新功能
- `fix`: 修复bug
- `docs`: 文档更新
- `style`: 代码风格调整（不影响功能）
- `refactor`: 代码重构
- `test`: 测试相关
- `chore`: 构建工具、依赖更新等

### 示例

```
feat: add user authentication system

fix: resolve memory leak in HTTP client

docs: update API documentation

refactor: simplify error handling logic
```

## 🎯 标签和里程碑

我们使用标签来组织问题和 PR：

- `bug`: 错误修复
- `enhancement`: 功能增强
- `documentation`: 文档相关
- `good first issue`: 适合新贡献者的任务
- `help wanted`: 需要帮助的任务

## 📞 获取帮助

如果您需要帮助：

1. 查看[常见问题解答](docs/guides/faq.md)
2. 在 [Discussions](https://github.com/zycxfyh/frys/discussions) 中提问
3. 联系维护者：1666384464@qq.com

感谢您的贡献！🎉
