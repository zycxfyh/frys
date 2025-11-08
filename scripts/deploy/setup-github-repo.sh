#!/bin/bash

# frys GitHub 仓库设置脚本
# 用于快速配置 GitHub 仓库的最佳实践设置

set -euo pipefail

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# 检查依赖
check_dependencies() {
    log "检查依赖..."

    if ! command -v gh &> /dev/null; then
        error "需要安装 GitHub CLI (gh)"
        error "安装方法: https://cli.github.com/"
        exit 1
    fi

    if ! command -v git &> /dev/null; then
        error "需要安装 Git"
        exit 1
    fi

    success "依赖检查通过"
}

# 检查是否在 Git 仓库中
check_git_repo() {
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        error "当前目录不是 Git 仓库"
        exit 1
    fi

    success "Git 仓库检查通过"
}

# 检查 GitHub CLI 认证
check_github_auth() {
    log "检查 GitHub CLI 认证..."

    if ! gh auth status > /dev/null 2>&1; then
        error "GitHub CLI 未认证"
        info "请运行: gh auth login"
        exit 1
    fi

    success "GitHub CLI 认证检查通过"
}

# 获取仓库信息
get_repo_info() {
    log "获取仓库信息..."

    REPO_NAME=$(gh repo view --json name -q .name 2>/dev/null || echo "")
    REPO_OWNER=$(gh repo view --json owner.login -q .login 2>/dev/null || echo "")

    if [ -z "$REPO_NAME" ] || [ -z "$REPO_OWNER" ]; then
        error "无法获取仓库信息，请确保在正确的 GitHub 仓库中"
        exit 1
    fi

    FULL_REPO_NAME="${REPO_OWNER}/${REPO_NAME}"
    info "仓库: $FULL_REPO_NAME"
}

# 设置分支保护规则
setup_branch_protection() {
    log "设置分支保护规则..."

    # main 分支保护
    if gh api repos/${FULL_REPO_NAME}/branches/main/protection \
        --method PUT \
        --field required_status_checks='{"strict":true,"contexts":["local-validation","automated-testing","security-checks","integration-testing","production-deployment","monitoring-rollback"]}' \
        --field required_pull_request_reviews='{"required_approving_review_count":2,"dismiss_stale_reviews":true,"require_code_owner_reviews":true}' \
        --field enforce_admins=false \
        --field allow_force_pushes=false \
        --field allow_deletions=false \
        --field block_creations=false \
        --field required_linear_history=true > /dev/null; then
        success "main 分支保护规则设置成功"
    else
        warning "main 分支保护规则设置失败，可能已经存在"
    fi

    # develop 分支保护
    if gh api repos/${FULL_REPO_NAME}/branches/develop/protection \
        --method PUT \
        --field required_status_checks='{"strict":true,"contexts":["local-validation","automated-testing","security-checks","integration-testing","staging-deployment","regression-testing"]}' \
        --field required_pull_request_reviews='{"required_approving_review_count":1,"dismiss_stale_reviews":true}' \
        --field enforce_admins=false \
        --field allow_force_pushes=false \
        --field allow_deletions=false \
        --field block_creations=false \
        --field required_linear_history=true > /dev/null; then
        success "develop 分支保护规则设置成功"
    else
        warning "develop 分支保护规则设置失败，可能已经存在"
    fi
}

# 设置仓库设置
setup_repository_settings() {
    log "设置仓库配置..."

    # 启用自动删除合并分支
    gh repo edit --delete-branch-on-merge

    # 设置默认分支为 main
    gh repo edit --default-branch main

    success "仓库配置设置完成"
}

# 创建必要的标签
setup_labels() {
    log "创建标准标签..."

    local labels=(
        "bug:d73a49:Something isn't working"
        "enhancement:a2eeef:New feature or request"
        "documentation:0075ca:Improvements or additions to documentation"
        "good first issue:7057ff:Good for newcomers"
        "help wanted:008672:Extra attention is needed"
        "invalid:e4e669:This doesn't seem right"
        "question:d876e3:Further information is requested"
        "wontfix:ffffff:This will not be worked on"
        "duplicate:cfd3d7:This issue or pull request already exists"
        "security:b60205:Security vulnerability"
        "triage:fbca04:Needs triage"
        "dependencies:0366d6:Pull requests that update a dependency file"
        "automated:4051b5:Pull request from automated system"
        "github-actions:000000:Pull requests that update GitHub Actions code"
    )

    for label in "${labels[@]}"; do
        IFS=':' read -r name color description <<< "$label"
        if gh label create "$name" --color "$color" --description "$description" --force > /dev/null 2>&1; then
            info "创建标签: $name"
        else
            info "标签已存在: $name"
        fi
    done

    success "标签设置完成"
}

# 验证配置
verify_setup() {
    log "验证配置..."

    # 检查分支保护
    if gh api repos/${FULL_REPO_NAME}/branches/main/protection > /dev/null 2>&1; then
        success "main 分支保护规则验证通过"
    else
        warning "main 分支保护规则验证失败"
    fi

    # 检查工作流文件
    if [ -f ".github/workflows/ci-cd-pipeline.yml" ]; then
        success "CI/CD 工作流文件存在"
    else
        error "CI/CD 工作流文件不存在"
    fi

    # 检查其他配置文件
    local config_files=(
        ".github/CODEOWNERS"
        ".github/dependabot.yml"
        ".github/PULL_REQUEST_TEMPLATE/default.md"
        ".github/ISSUE_TEMPLATE/bug-report.yml"
    )

    for file in "${config_files[@]}"; do
        if [ -f "$file" ]; then
            success "$file 存在"
        else
            warning "$file 不存在"
        fi
    done
}

# 显示完成信息
show_completion_info() {
    echo
    echo "=================================================="
    success "GitHub 仓库设置完成！"
    echo
    info "接下来请完成以下步骤："
    echo
    info "1. 推送配置到 GitHub:"
    echo "   git add ."
    echo "   git commit -m 'feat: 配置 GitHub 工作流最佳实践'"
    echo "   git push origin main"
    echo
    info "2. 验证工作流:"
    echo "   访问: https://github.com/${FULL_REPO_NAME}/actions"
    echo
    info "3. 配置仓库设置 (可选):"
    echo "   访问: https://github.com/${FULL_REPO_NAME}/settings"
    echo "   - 启用 Issues"
    echo "   - 启用 Projects"
    echo "   - 配置 Environments (staging, production)"
    echo
    info "4. 设置 Secrets (如果需要):"
    echo "   GITHUB_TOKEN - 自动提供"
    echo "   STAGING_URL - 测试环境URL"
    echo "   DOCKER_USERNAME - Docker Hub 用户名"
    echo "   DOCKER_PASSWORD - Docker Hub 密码"
    echo
    warning "注意: 某些设置可能需要仓库管理员权限"
    echo "=================================================="
}

# 主函数
main() {
    echo "🚀 frys GitHub 仓库设置脚本"
    echo "================================"

    check_dependencies
    check_git_repo
    check_github_auth
    get_repo_info

    setup_branch_protection
    setup_repository_settings
    setup_labels

    verify_setup
    show_completion_info
}

# 运行主函数
main "$@"
