#!/bin/bash

# WokeFlow 回滚脚本
# 自动回滚到上一版本

set -euo pipefail

# 配置变量
DEPLOY_ENV=${DEPLOY_ENV:-production}
DOCKER_COMPOSE_FILE="docker-compose.${DEPLOY_ENV}.yml"
ROLLBACK_TIMEOUT=${ROLLBACK_TIMEOUT:-300}  # 5分钟超时
LOG_FILE="./logs/rollback_$(date +%Y%m%d_%H%M%S).log"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# 获取当前活跃环境
get_active_environment() {
    if docker-compose -f "$DOCKER_COMPOSE_FILE" ps wokeflow-blue 2>/dev/null | grep -q "Up"; then
        echo "blue"
    elif docker-compose -f "$DOCKER_COMPOSE_FILE" ps wokeflow-green 2>/dev/null | grep -q "Up"; then
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

# 检查环境是否健康
check_environment_health() {
    local env=$1
    local service="wokeflow-$env"

    info "检查 $env 环境健康状态..."

    # 检查容器状态
    if ! docker-compose -f "$DOCKER_COMPOSE_FILE" ps "$service" | grep -q "Up"; then
        error "$env 环境未运行"
        return 1
    fi

    # 检查健康端点
    if ! docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T "$service" curl -f --max-time 10 http://localhost:3000/health >/dev/null 2>&1; then
        error "$env 环境健康检查失败"
        return 1
    fi

    success "$env 环境健康"
    return 0
}

# 启动备用环境
start_backup_environment() {
    local backup_env=$1
    local service="wokeflow-$backup_env"

    info "启动备用环境: $backup_env"

    # 启动备用环境
    docker-compose -f "$DOCKER_COMPOSE_FILE" up -d "$service"

    # 等待启动
    local attempts=0
    local max_attempts=30

    while [ $attempts -lt $max_attempts ]; do
        if check_environment_health "$backup_env"; then
            success "备用环境 $backup_env 启动成功"
            return 0
        fi

        info "等待备用环境启动... ($((attempts + 1))/$max_attempts)"
        sleep 10
        ((attempts++))
    done

    error "备用环境 $backup_env 启动超时"
    return 1
}

# 切换流量到备用环境
switch_to_backup() {
    local backup_env=$1

    info "切换流量到备用环境: $backup_env"

    # 更新 Nginx 配置
    local nginx_config="./nginx/prod/nginx-${backup_env}.conf"
    if [ -f "$nginx_config" ]; then
        cp "$nginx_config" "./nginx/prod/nginx.conf"
        if docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T nginx nginx -s reload 2>/dev/null; then
            success "流量切换成功"
        else
            warning "Nginx 重载失败，请手动检查"
        fi
    else
        warning "Nginx 配置不存在，使用默认配置"
    fi
}

# 停止故障环境
stop_failed_environment() {
    local failed_env=$1
    local service="wokeflow-$failed_env"

    info "停止故障环境: $failed_env"

    if docker-compose -f "$DOCKER_COMPOSE_FILE" stop "$service" 2>/dev/null; then
        success "故障环境已停止"
    else
        warning "停止故障环境时出现警告，继续执行"
    fi
}

# 验证回滚成功
verify_rollback() {
    local backup_env=$1

    info "验证回滚结果..."

    # 检查备用环境
    if ! check_environment_health "$backup_env"; then
        error "回滚验证失败：备用环境不健康"
        return 1
    fi

    # 检查流量切换
    if ! curl -f --max-time 10 http://localhost/health >/dev/null 2>&1; then
        error "回滚验证失败：应用不可访问"
        return 1
    fi

    success "回滚验证通过"
    return 0
}

# 从备份恢复数据库
restore_from_backup() {
    local backup_file=${1:-""}

    if [ -z "$backup_file" ]; then
        # 查找最新的备份文件
        backup_file=$(find ./backups -name "*.sql" -type f -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -1 | cut -d' ' -f2-)
    fi

    if [ -z "$backup_file" ] || [ ! -f "$backup_file" ]; then
        warning "未找到有效的备份文件，跳过数据库恢复"
        return 0
    fi

    info "从备份恢复数据库: $backup_file"

    if docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T postgres psql -U wokeflow -d wokeflow_prod < "$backup_file" 2>/dev/null; then
        success "数据库恢复成功"
    else
        error "数据库恢复失败"
        return 1
    fi
}

# 发送告警
send_alert() {
    local message=$1
    local severity=${2:-"warning"}

    info "发送告警: $message"

    # 这里可以集成监控系统，如 PagerDuty、OpsGenie 等
    # 示例:
    # curl -X POST $ALERT_WEBHOOK \
    #   -H "Content-Type: application/json" \
    #   -d "{\"message\":\"$message\",\"severity\":\"$severity\"}"

    case $severity in
        "critical")
            error "🚨 严重告警: $message"
            ;;
        "warning")
            warning "⚠️ 警告: $message"
            ;;
        "info")
            info "ℹ️ 信息: $message"
            ;;
    esac
}

# 主回滚函数
main() {
    local start_time=$(date +%s)

    info "🔄 开始 WokeFlow 自动回滚"
    info "环境: $DEPLOY_ENV"
    info "超时时间: ${ROLLBACK_TIMEOUT}秒"

    # 检查当前状态
    local active_env=$(get_active_environment)

    if [ "$active_env" = "none" ]; then
        error "没有活跃的环境可以回滚"
        exit 1
    fi

    info "当前活跃环境: $active_env"

    # 检查活跃环境是否健康
    if check_environment_health "$active_env"; then
        info "活跃环境仍然健康，可能不需要回滚"
        info "如果需要强制回滚，请检查具体问题"
        exit 0
    fi

    # 确定备用环境
    local backup_env=$(get_inactive_environment "$active_env")
    info "将回滚到备用环境: $backup_env"

    # 检查备用环境是否有可用的镜像
    if ! docker images | grep -q "wokeflow.*${backup_env}"; then
        warning "备用环境没有可用的镜像，尝试启动现有容器"

        # 检查备用环境容器是否存在
        if ! docker-compose -f "$DOCKER_COMPOSE_FILE" ps "$backup_env" | grep -q "Up"; then
            error "备用环境不可用，无法执行回滚"
            send_alert "回滚失败：备用环境不可用" "critical"
            exit 1
        fi
    fi

    # 发送回滚开始告警
    send_alert "开始自动回滚到 $backup_env 环境" "warning"

    # 执行回滚步骤
    local rollback_success=true

    # 1. 启动备用环境
    if ! start_backup_environment "$backup_env"; then
        rollback_success=false
    fi

    # 2. 验证备用环境
    if [ "$rollback_success" = true ] && ! check_environment_health "$backup_env"; then
        rollback_success=false
    fi

    # 3. 切换流量
    if [ "$rollback_success" = true ]; then
        switch_to_backup "$backup_env"
    fi

    # 4. 验证回滚
    if [ "$rollback_success" = true ] && ! verify_rollback "$backup_env"; then
        rollback_success=false
    fi

    # 5. 停止故障环境
    if [ "$rollback_success" = true ]; then
        stop_failed_environment "$active_env"
    fi

    # 6. 可选：恢复数据库备份
    if [ "$rollback_success" = true ] && [ "${RESTORE_BACKUP:-false}" = "true" ]; then
        restore_from_backup
    fi

    # 计算回滚耗时
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))

    if [ "$rollback_success" = true ]; then
        success "🎉 回滚成功完成！"
        success "新活跃环境: $backup_env"
        success "回滚耗时: ${duration}秒"
        send_alert "回滚成功完成 - 环境: $backup_env, 耗时: ${duration}秒" "info"
    else
        error "❌ 回滚失败"
        error "耗时: ${duration}秒"
        send_alert "回滚失败 - 请手动干预" "critical"

        # 提供故障排除建议
        echo ""
        info "故障排除建议:"
        echo "1. 检查 Docker 容器状态: docker-compose -f $DOCKER_COMPOSE_FILE ps"
        echo "2. 查看容器日志: docker-compose -f $DOCKER_COMPOSE_FILE logs wokeflow-$backup_env"
        echo "3. 检查系统资源: docker system df"
        echo "4. 验证配置文件: cat $DOCKER_COMPOSE_FILE"
        echo "5. 手动启动备用环境: docker-compose -f $DOCKER_COMPOSE_FILE up -d wokeflow-$backup_env"

        exit 1
    fi
}

# 参数解析
while [[ $# -gt 0 ]]; do
    case $1 in
        --env=*)
            DEPLOY_ENV="${1#*=}"
            shift
            ;;
        --timeout=*)
            ROLLBACK_TIMEOUT="${1#*=}"
            shift
            ;;
        --restore-backup)
            RESTORE_BACKUP=true
            shift
            ;;
        --help)
            echo "WokeFlow 自动回滚脚本"
            echo ""
            echo "用法: $0 [选项]"
            echo ""
            echo "选项:"
            echo "  --env=ENV          部署环境 (默认: production)"
            echo "  --timeout=SECONDS  回滚超时时间 (默认: 300秒)"
            echo "  --restore-backup   回滚时恢复数据库备份"
            echo "  --help             显示此帮助信息"
            echo ""
            echo "示例:"
            echo "  $0                        # 回滚到备用环境"
            echo "  $0 --env=staging         # 回滚staging环境"
            echo "  $0 --restore-backup      # 回滚并恢复数据库"
            exit 0
            ;;
        *)
            error "未知选项: $1"
            echo "使用 --help 查看帮助信息"
            exit 1
            ;;
    esac
done

# 执行主函数
main "$@"
