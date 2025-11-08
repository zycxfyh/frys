# 🚀 GitHub Actions 工作流指南

本文档介绍了 frys 项目的完整 CI/CD 工作流，严格遵循 GitHub 社区最佳实践。

## 📋 工作流概述

frys 实现了完整的 9 步 CI/CD 流程：

1. **本地验证** - 代码质量检查和格式化
2. **自动化测试** - 单元测试、集成测试和性能测试
3. **安全检查** - 依赖扫描和安全审计
4. **集成测试** - 端到端测试和环境验证
5. **PR 审查** - 代码审查和合规检查
6. **Staging 部署** - 测试环境自动部署
7. **回归测试** - 生产部署后验证
8. **生产部署** - 蓝绿部署策略
9. **监控回溯** - 实时监控和自动回滚

## 🔄 主要工作流

### 主 CI/CD 流水线 (`ci-cd-pipeline.yml`)

#### 触发条件

- **Push**: `main` 和 `develop` 分支
- **PR**: 所有 PR
- **手动触发**: 支持环境选择和跳过测试选项

#### 阶段说明

##### 1️⃣ 本地验证阶段

```yaml
- ESLint 代码检查
- Prettier 格式检查
- 提交信息格式验证
```

##### 2️⃣ 自动化测试阶段

```yaml
- 单元测试 (vitest)
- 集成测试 (数据库 + Redis)
- 性能测试
- 覆盖率报告 (Codecov)
```

##### 3️⃣ 安全检查阶段

```yaml
- npm 审计
- 工业级安全审计
- CodeQL 静态分析
```

##### 4️⃣ 集成测试阶段

```yaml
- Docker 环境测试
- 端到端测试 (Playwright)
- API 集成测试
- 视觉回归测试
```

##### 5️⃣ PR 审查阶段

```yaml
- 代码质量检查
- 分支命名规范
- 测试覆盖率验证
- 自动代码审查
```

##### 6️⃣ Staging 部署阶段

```yaml
- 构建生产镜像
- 部署到测试环境
- 部署后验证
- 性能基准测试
```

##### 7️⃣ 回归测试阶段

```yaml
- 生产环境验证
- 回归测试矩阵
- 性能回归检查
- 错误率监控
```

##### 8️⃣ 生产部署阶段

```yaml
- 蓝绿部署策略
- 零停机部署
- 部署后验证
- 自动回滚保护
```

##### 9️⃣ 监控回溯阶段

```yaml
- 实时健康监控
- 自动回滚触发
- 性能指标监控
- 智能故障恢复
```

## 🔒 安全扫描工作流 (`security-scan.yml`)

### 触发条件

- 代码变更 (src/, package.json)
- 每周定时扫描
- 手动触发

### 安全检查类型

- **依赖安全**: npm audit, Snyk, OWASP Dependency Check
- **代码安全**: CodeQL, Semgrep, ESLint 安全规则
- **容器安全**: Trivy, Dockle, Hadolint
- **基础设施安全**: Checkov, KICS

## 📊 性能监控工作流 (`performance-monitoring.yml`)

### 触发条件

- 代码变更
- 每日定时监控
- 手动触发

### 性能测试类型

- **基准测试**: 单元测试性能, 内存泄漏检查
- **负载测试**: Artillery, k6, 自定义负载生成器
- **SLO 监控**: 错误预算, 性能指标收集
- **生产监控**: 实时监控, 异常检测

## 🚀 部署工作流 (`deploy.yml`)

### 手动部署流程

1. 选择目标环境 (staging/production)
2. 可选指定版本标签
3. 强制部署选项 (跳过某些检查)

### 部署策略

- **Staging**: 直接部署 + 验证
- **Production**: 蓝绿部署 + 监控回滚

## ⚙️ 配置说明

### 分支保护规则

```yaml
main 分支:
  - 需要状态检查: local-validation, automated-testing, security-checks, production-deployment, monitoring-rollback
  - 需要 PR 审查: 2 名审批者
  - 需要代码所有者审查
  - 严格状态检查
  - 必需线性历史

develop 分支:
  - 需要状态检查: local-validation, automated-testing, security-checks, integration-testing, staging-deployment, regression-testing
  - 需要 PR 审查: 1 名审批者
  - 严格状态检查
```

### 环境配置

- **Development**: 开发环境，无特殊要求
- **Staging**: 测试环境，需要 URL 和健康检查
- **Production**: 生产环境，需要高级保护和监控

### 必需 Secrets

```bash
# Docker
DOCKER_USERNAME
DOCKER_PASSWORD

# 部署 URLs
STAGING_URL
PRODUCTION_URL
PRODUCTION_API_URL
PRODUCTION_HEALTH_URL

# 监控
PROMETHEUS_URL
GRAFANA_URL
MONITORING_API_KEY

# 安全扫描
SNYK_TOKEN
```

## 🔧 本地开发设置

### lefthook 配置

项目使用 lefthook 进行本地 Git hooks 配置：

```yaml
pre-commit: 快速代码质量检查
pre-push: 完整质量检查 + 集成测试
commit-msg: 提交信息格式验证
```

### 本地测试运行

```bash
# 完整本地验证
npm run quality:quick

# 运行所有测试
npm run test:all

# 本地 CI 模拟
npm run ci:development
```

## 📈 监控和报告

### 工作流指标

- 执行时间统计
- 缓存命中率
- 阶段成功率
- 性能基准对比

### 报告生成

- CI/CD 执行报告
- 安全审计报告
- 性能测试报告
- 部署验证报告

### 通知机制

- 部署成功/失败通知
- 安全漏洞警报
- 性能阈值警告
- SLO 违规通知

## 🛠️ 故障排除

### 常见问题

#### 工作流失败

1. 检查日志输出
2. 验证环境变量
3. 确认依赖安装
4. 检查网络连接

#### 部署失败

1. 验证 Docker 镜像
2. 检查环境配置
3. 确认权限设置
4. 查看部署日志

#### 安全扫描失败

1. 检查 secrets 配置
2. 验证工具版本
3. 确认网络访问
4. 查看扫描结果

### 调试技巧

```yaml
# 添加调试日志
- run: echo "Debug: ${{ secrets.DEBUG }}"
  if: env.DEBUG == 'true'

# 手动触发调试工作流
- 使用 workflow_dispatch
- 设置 DRY_RUN=true
```

## 📚 最佳实践

### 提交规范

```
type(scope): description

类型: feat, fix, docs, style, refactor, test, chore, perf, ci, build, revert
范围: 可选，模块或组件名称
描述: 简洁明了的变化描述
```

### 分支策略

- `main`: 生产就绪代码
- `develop`: 开发主分支
- `feature/*`: 功能分支
- `bugfix/*`: 缺陷修复
- `hotfix/*`: 紧急修复

### 代码审查

- 至少一名审查者
- 代码所有者审查关键变更
- 自动化检查必须全部通过
- 审查重点关注安全性、性能和可维护性

---

## 🎯 总结

这个 CI/CD 工作流提供了企业级的软件交付保障，通过自动化验证、智能部署和持续监控，确保代码质量和系统稳定性。所有配置都遵循 GitHub 社区最佳实践，支持快速迭代和高频部署。
