# 🚀 GitHub 配置指南

本文档描述如何配置 GitHub 仓库以支持完整的 CI/CD 工作流。

## 📋 环境配置

### Staging 环境

1. 访问: `https://github.com/{owner}/{repo}/settings/environments`
2. 点击 "New environment"
3. 环境名称: `staging`
4. 配置选项:
   - ✅ Required reviewers: 添加至少 1 位审查者
   - ✅ Wait timer: 0 minutes (可选)
   - ✅ Deployment branches: `develop` 和 `main`

### Production 环境

1. 点击 "New environment"
2. 环境名称: `production`
3. 配置选项:
   - ✅ Required reviewers: 添加至少 2 位审查者
   - ✅ Wait timer: 10 minutes (生产部署缓冲时间)
   - ✅ Deployment branches: 仅 `main`

## 🔐 密钥配置

### Repository Secrets

在仓库设置中配置以下密钥：

#### 数据库相关

```
TEST_DATABASE_URL=postgresql://user:password@localhost:5432/test_db
STAGING_DATABASE_URL=postgresql://user:password@staging-db:5432/staging_db
PRODUCTION_DATABASE_URL=postgresql://user:password@prod-db:5432/prod_db
```

#### Redis 相关

```
TEST_REDIS_URL=redis://localhost:6379
STAGING_REDIS_URL=redis://staging-redis:6379
```

#### 部署相关

```
STAGING_URL=https://staging.yourdomain.com
PRODUCTION_URL=https://yourdomain.com
DOCKER_USERNAME=your-dockerhub-username
DOCKER_PASSWORD=your-dockerhub-password
```

#### 监控相关

```
PROMETHEUS_URL=https://prometheus.yourdomain.com
MONITORING_ENDPOINT=https://monitoring.yourdomain.com
SLO_TARGETS=latency<200ms,error_rate<1%
ERROR_THRESHOLD=5
RESPONSE_TIME_THRESHOLD=1000
```

#### 第三方服务

```
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

## 🏷️ 标签管理

仓库已配置标准标签，位于 `.github/labels.yml`。

### 自动标签规则

- `dependencies`: 依赖更新 PR
- `github-actions`: GitHub Actions 更新
- `automated`: 自动化系统创建的 PR

## 🔀 分支保护规则

### Main 分支保护

**必需状态检查:**

- `local-validation`
- `automated-testing`
- `security-checks`
- `integration-testing`
- `production-deployment`
- `monitoring-rollback`

**分支保护:**

- ✅ 需要 PR
- ✅ 需要 2 个审查者
- ✅ 要求代码所有者审查
- ✅ 需要最新状态检查
- ✅ 包含管理员
- ✅ 限制推送
- ✅ 需要线性历史

### Develop 分支保护

**必需状态检查:**

- `local-validation`
- `automated-testing`
- `security-checks`
- `integration-testing`
- `staging-deployment`
- `regression-testing`

**分支保护:**

- ✅ 需要 PR
- ✅ 需要 1 个审查者
- ✅ 需要最新状态检查
- ✅ 包含管理员

## 👥 团队和权限

### 团队配置建议

创建以下团队并分配相应权限：

- `@frys-team/core`: 核心贡献者 (Admin)
- `@frys-team/architects`: 架构师 (Write)
- `@frys-team/devops`: DevOps 团队 (Write)
- `@frys-team/backend`: 后端开发 (Write)
- `@frys-team/frontend`: 前端开发 (Write)
- `@frys-team/qa`: 测试团队 (Write)
- `@frys-team/security`: 安全团队 (Write)
- `@frys-team/tech-writers`: 技术文档 (Write)

### 代码所有者

配置在 `.github/CODEOWNERS` 中定义，自动为相关文件分配审查者。

## 📊 通知配置

### Slack 通知

配置 Slack 集成接收部署通知：

1. 创建 Slack App
2. 配置 Incoming Webhook
3. 设置 `SLACK_WEBHOOK_URL` 密钥

### 通知事件

- ✅ 部署成功
- ❌ 部署失败
- ⚠️ 回滚触发
- 🔄 回归测试失败

## 🔍 监控和分析

### 工作流指标

监控以下指标：

- **执行时间**: < 30分钟 (完整流水线)
- **成功率**: > 95%
- **缓存命中率**: > 70%
- **故障恢复时间**: < 15分钟

### 性能基准

- **单元测试**: < 5分钟
- **集成测试**: < 15分钟
- **安全检查**: < 10分钟
- **部署时间**: < 30分钟 (生产)

## 🚨 告警配置

### 失败通知

配置失败时的即时通知：

- **CI 失败**: Slack + Email
- **部署失败**: Slack + 电话 (严重)
- **安全漏洞**: 安全团队即时通知
- **SLO 违规**: DevOps 团队告警

### 自动响应

- **测试失败**: 自动重试 (最多 2 次)
- **部署失败**: 自动回滚
- **性能下降**: 自动降级通知

## 🔧 故障排除

### 常见问题

#### 工作流不触发

1. 检查分支名称是否正确
2. 验证 YAML 语法
3. 检查仓库权限

#### 部署失败

1. 验证环境密钥
2. 检查网络连接
3. 查看详细日志

#### 缓存问题

1. 清除 GitHub Actions 缓存
2. 检查缓存键格式
3. 验证文件路径

## 📚 相关文档

- [GitHub Actions 文档](https://docs.github.com/en/actions)
- [分支保护规则](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/defining-the-mergeability-of-pull-requests/managing-a-branch-protection-rule)
- [代码所有者](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners)
- [Dependabot](https://docs.github.com/en/code-security/dependabot)

---

## ✅ 配置检查清单

- [ ] GitHub CLI 已安装和认证
- [ ] Environments 已创建 (staging, production)
- [ ] Repository secrets 已配置
- [ ] 分支保护规则已设置
- [ ] 团队和权限已配置
- [ ] 代码所有者文件已创建
- [ ] PR 和 Issue 模板已配置
- [ ] Dependabot 已启用
- [ ] 通知渠道已设置

运行以下命令验证配置：

```bash
# 验证仓库设置
npm run github:setup

# 测试工作流
gh workflow run ci-cd-pipeline.yml --ref main
```
