#!/bin/bash

# frys staging环境数据库切换脚本
# 允许在SQLite和PostgreSQL之间快速切换以确保环境对等性

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
STAGING_COMPOSE="$PROJECT_ROOT/config/docker/docker-compose.staging.yml"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✓${NC} $1"
}

error() {
    echo -e "${RED}✗${NC} $1" >&2
}

warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# 检查docker-compose是否存在
check_dependencies() {
    if ! command -v docker-compose &> /dev/null; then
        error "docker-compose 未安装"
        exit 1
    fi
}

# 停止当前staging环境
stop_staging() {
    log "停止当前staging环境..."
    cd "$PROJECT_ROOT"
    docker-compose -f "$STAGING_COMPOSE" down || true
}

# 启动SQLite环境
start_sqlite() {
    log "启动SQLite staging环境..."
    cd "$PROJECT_ROOT"
    export DATABASE_URL="sqlite://./data/staging.db"
    docker-compose -f "$STAGING_COMPOSE" up -d
    success "SQLite环境已启动"
    echo "数据库URL: sqlite://./data/staging.db"
}

# 启动PostgreSQL环境
start_postgres() {
    log "启动PostgreSQL staging环境..."
    cd "$PROJECT_ROOT"

    # 检查PostgreSQL密码
    if [ -z "${POSTGRES_PASSWORD:-}" ]; then
        error "POSTGRES_PASSWORD环境变量未设置"
        error "请设置安全的PostgreSQL密码: export POSTGRES_PASSWORD='your-secure-password'"
        exit 1
    fi

    export DATABASE_URL="postgresql://frys:$POSTGRES_PASSWORD@localhost:5432/frys_staging"
    docker-compose --profile postgres -f "$STAGING_COMPOSE" up -d

    # 等待PostgreSQL启动 - 改进的健康检查
    log "等待PostgreSQL启动..."
    local attempts=0
    local max_attempts=30

    while [ $attempts -lt $max_attempts ]; do
        if docker-compose --profile postgres -f "$STAGING_COMPOSE" exec -T postgres pg_isready -U frys -d frys_staging >/dev/null 2>&1; then
            success "PostgreSQL健康检查通过"
            break
        fi

        info "等待PostgreSQL启动... ($((attempts + 1))/$max_attempts)"
        sleep 2
        ((attempts++))
    done

    if [ $attempts -eq $max_attempts ]; then
        error "PostgreSQL启动超时"
        exit 1
    fi

    success "PostgreSQL环境已启动"
    echo "数据库URL: $DATABASE_URL"
}

# 显示当前状态
show_status() {
    log "当前staging环境状态:"
    cd "$PROJECT_ROOT"
    docker-compose -f "$STAGING_COMPOSE" ps

    if [ -n "${DATABASE_URL:-}" ]; then
        echo "数据库URL: $DATABASE_URL"
    else
        echo "数据库URL: 未设置 (使用默认SQLite)"
    fi
}

# 显示帮助
show_help() {
    cat << EOF
frys staging环境数据库切换工具

USAGE:
    $0 [COMMAND]

COMMANDS:
    sqlite      切换到SQLite环境 (快速开发)
    postgres    切换到PostgreSQL环境 (生产级测试)
    status      显示当前环境状态
    stop        停止staging环境
    help        显示此帮助信息

EXAMPLES:
    $0 sqlite       # 使用SQLite快速启动
    $0 postgres     # 使用PostgreSQL进行完整测试
    $0 status       # 查看当前状态

ENVIRONMENT VARIABLES:
    POSTGRES_PASSWORD    PostgreSQL密码 (默认: frys_staging_password)
    DATABASE_URL         覆盖默认数据库URL

EOF
}

# 主函数
main() {
    check_dependencies

    case "${1:-help}" in
        sqlite)
            stop_staging
            start_sqlite
            ;;
        postgres)
            stop_staging
            start_postgres
            ;;
        status)
            show_status
            ;;
        stop)
            stop_staging
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            error "未知命令: $1"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

main "$@"
