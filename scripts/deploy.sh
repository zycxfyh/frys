#!/bin/bash

# frys 蓝绿部署脚本
# 实现安全、高可用的部署策略

set -euo pipefail

# 配置变量
DEPLOY_ENV=${DEPLOY_ENV:-production}
DOCKER_COMPOSE_FILE="docker-compose.${DEPLOY_ENV}.yml"
BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"
LOG_FILE="./logs/deploy_$(date +%Y%m%d_%H%M%S).log"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${timestamp} [${level}] ${message}" | tee -a "$LOG_FILE"
}

error() {
    log "ERROR" "${RED}$1${NC}"
}

success() {
    log "SUCCESS" "${GREEN}$1${NC}"
}

warning() {
    log "WARNING" "${YELLOW}$1${NC}"
}

info() {
    log "INFO" "${BLUE}$1${NC}"
}

# 健康检查函数
check_health() {
    local service=$1
    local max_attempts=30
    local attempt=1

    info "检查 $service 健康状态..."

    while [ $attempt -le $max_attempts ]; do
        if docker-compose -f "$DOCKER_COMPOSE_FILE" ps "$service" | grep -q "Up"; then
            if docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T "$service" curl -f http://localhost:3000/health >/dev/null 2>&1; then
                success "$service 健康检查通过"
                return 0
            fi
        fi

        info "等待 $service 启动... (尝试 $attempt/$max_attempts)"
        sleep 10
        ((attempt++))
    done

    error "$service 健康检查失败"
    return 1
}

# 备份函数
create_backup() {
    info "创建数据库备份..."

    mkdir -p "$BACKUP_DIR"

    # PostgreSQL 备份
    if docker-compose -f "$DOCKER_COMPOSE_FILE" ps postgres | grep -q "Up"; then
        docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T postgres pg_dumpall -U wokeflow > "$BACKUP_DIR/postgres_backup.sql"
        success "PostgreSQL 备份完成"
    fi

    # Redis 备份 (如果需要)
    if docker-compose -f "$DOCKER_COMPOSE_FILE" ps redis | grep -q "Up"; then
        docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T redis redis-cli save
        success "Redis 备份完成"
    fi
}

# 获取当前活跃环境
get_active_environment() {
    if docker-compose -f "$DOCKER_COMPOSE_FILE" ps wokeflow-blue | grep -q "Up"; then
        echo "blue"
    elif docker-compose -f "$DOCKER_COMPOSE_FILE" ps wokeflow-green | grep -q "Up"; then
        echo "green"
    else
        echo "none"
    fi
}

# 获取非活跃环境
get_inactive_environment() {
    local active=$1
    if [ "$active" = "blue" ]; then
        echo "green"
    else
        echo "blue"
    fi
}

# 部署到指定环境
deploy_to_environment() {
    local env=$1
    local service="wokeflow-$env"

    info "开始部署到 $env 环境..."

    # 停止非活跃环境
    local inactive_env=$(get_inactive_environment "$env")
    info "停止非活跃环境: $inactive_env"
    docker-compose -f "$DOCKER_COMPOSE_FILE" stop "wokeflow-$inactive_env" || true

    # 启动目标环境
    info "启动 $env 环境..."
    docker-compose -f "$DOCKER_COMPOSE_FILE" up -d "$service"

    # 等待健康检查
    if check_health "$service"; then
        success "$env 环境部署成功"

        # 执行部署后验证
        if run_post_deploy_tests "$service"; then
            success "部署后验证通过"
            return 0
        else
            error "部署后验证失败"
            return 1
        fi
    else
        error "$env 环境部署失败"
        return 1
    fi
}

# 部署后测试
run_post_deploy_tests() {
    local service=$1

    info "执行部署后测试..."

    # 基本健康检查
    if ! docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T "$service" curl -f http://localhost:3000/health; then
        error "健康检查失败"
        return 1
    fi

    # API 响应检查
    if ! docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T "$service" curl -f http://localhost:3000/api/health; then
        warning "API 健康检查失败 (可选)"
    fi

    # 数据库连接检查
    if ! docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T "$service" node -e "
        const { Client } = require('pg');
        const client = new Client();
        client.connect().then(() => {
            console.log('数据库连接成功');
            client.end();
        }).catch(err => {
            console.error('数据库连接失败:', err);
            process.exit(1);
        });
    "; then
        error "数据库连接检查失败"
        return 1
    fi

    success "部署后测试通过"
    return 0
}

# 切换流量
switch_traffic() {
    local new_env=$1
    local old_env=$(get_inactive_environment "$new_env")

    info "切换流量到 $new_env 环境..."

    # 更新 Nginx 配置
    local nginx_config="./nginx/prod/nginx-${new_env}.conf"
    if [ -f "$nginx_config" ]; then
        cp "$nginx_config" "./nginx/prod/nginx.conf"
        docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T nginx nginx -s reload
        success "流量切换完成"
    else
        warning "Nginx 配置不存在，使用默认配置"
    fi

    # 停止旧环境
    info "停止旧环境: $old_env"
    docker-compose -f "$DOCKER_COMPOSE_FILE" stop "wokeflow-$old_env" || true
}

# 回滚函数
rollback() {
    local failed_env=$1
    local rollback_env=$(get_inactive_environment "$failed_env")

    error "部署失败，开始回滚到 $rollback_env 环境..."

    # 切换回旧环境
    switch_traffic "$rollback_env"

    # 停止失败的环境
    docker-compose -f "$DOCKER_COMPOSE_FILE" stop "wokeflow-$failed_env" || true

    warning "回滚完成，请检查日志了解失败原因"
}

# 主部署函数
main() {
    info "🚀 开始 frys 蓝绿部署"
    info "环境: $DEPLOY_ENV"
    info "Docker Compose 文件: $DOCKER_COMPOSE_FILE"

    # 验证环境
    if [ ! -f "$DOCKER_COMPOSE_FILE" ]; then
        error "Docker Compose 文件不存在: $DOCKER_COMPOSE_FILE"
        exit 1
    fi

    # 创建备份
    create_backup

    # 获取当前活跃环境
    local active_env=$(get_active_environment)
    info "当前活跃环境: $active_env"

    # 确定部署环境
    local deploy_env
    if [ "$active_env" = "none" ]; then
        # 首次部署
        deploy_env="blue"
        info "首次部署，使用 blue 环境"
    else
        # 蓝绿部署
        deploy_env=$(get_inactive_environment "$active_env")
        info "蓝绿部署，使用 $deploy_env 环境"
    fi

    # 执行部署
    if deploy_to_environment "$deploy_env"; then
        # 部署成功，切换流量
        switch_traffic "$deploy_env"
        success "🎉 部署成功完成！"
        success "活跃环境: $deploy_env"

        # 发送通知
        send_notification "success" "$deploy_env"
    else
        # 部署失败，回滚
        rollback "$deploy_env"
        send_notification "failure" "$deploy_env"
        exit 1
    fi
}

# 发送通知
send_notification() {
    local status=$1
    local env=$2

    if [ "$status" = "success" ]; then
        info "📢 部署成功通知已发送"
    else
        error "🚨 部署失败通知已发送"
    fi

    # 这里可以集成 Slack、Teams 或其他通知服务
    # 示例:
    # curl -X POST -H 'Content-type: application/json' \
    #   --data '{"text":"frys 部署'"$status"' - 环境: '"$env"'"}' \
    #   $WEBHOOK_URL
}

# 参数解析
while [[ $# -gt 0 ]]; do
    case $1 in
        --env=*)
            DEPLOY_ENV="${1#*=}"
            shift
            ;;
        --help)
            echo "frys 蓝绿部署脚本"
            echo ""
            echo "用法: $0 [选项]"
            echo ""
            echo "选项:"
            echo "  --env=ENV        部署环境 (默认: production)"
            echo "  --help           显示此帮助信息"
            exit 0
            ;;
        *)
            error "未知选项: $1"
            exit 1
            ;;
    esac
done

# 执行主函数
main "$@"
