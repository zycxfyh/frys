#!/bin/bash

# WokeFlow 监控环境设置脚本
# 自动配置 Prometheus、Grafana 和 AlertManager

set -euo pipefail

# 配置变量
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
MONITORING_DIR="$SCRIPT_DIR"
ENVIRONMENT=${ENVIRONMENT:-production}

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
    echo -e "${timestamp} [${level}] ${message}"
}

success() {
    log "SUCCESS" "${GREEN}$1${NC}"
}

error() {
    log "ERROR" "${RED}$1${NC}"
}

warning() {
    log "WARNING" "${YELLOW}$1${NC}"
}

info() {
    log "INFO" "${BLUE}$1${NC}"
}

# 检查依赖
check_dependencies() {
    info "检查依赖项..."

    if ! command -v docker &> /dev/null; then
        error "Docker 未安装，请先安装 Docker"
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose 未安装，请先安装 Docker Compose"
        exit 1
    fi

    success "依赖检查通过"
}

# 验证配置文件
validate_configs() {
    info "验证配置文件..."

    local config_files=(
        "prometheus/prometheus.yml"
        "prometheus/alert_rules.yml"
        "prometheus/slo_rules.yml"
        "alertmanager/config.yml"
    )

    for config_file in "${config_files[@]}"; do
        local full_path="$MONITORING_DIR/$config_file"
        if [ ! -f "$full_path" ]; then
            error "配置文件不存在: $full_path"
            exit 1
        fi

        # 验证 YAML 语法
        if command -v yamllint &> /dev/null; then
            if ! yamllint "$full_path" &> /dev/null; then
                warning "YAML 语法检查失败: $config_file"
            fi
        fi
    done

    success "配置文件验证通过"
}

# 创建必要的目录
create_directories() {
    info "创建监控目录结构..."

    local dirs=(
        "$MONITORING_DIR/grafana/provisioning/datasources"
        "$MONITORING_DIR/grafana/provisioning/dashboards"
        "$MONITORING_DIR/grafana/dashboards"
        "$MONITORING_DIR/prometheus/rules"
        "$MONITORING_DIR/data/prometheus"
        "$MONITORING_DIR/data/grafana"
        "$MONITORING_DIR/data/alertmanager"
    )

    for dir in "${dirs[@]}"; do
        mkdir -p "$dir"
        success "创建目录: $dir"
    done
}

# 生成环境变量文件
generate_env_file() {
    info "生成环境变量文件..."

    local env_file="$PROJECT_ROOT/.env.monitoring"

    cat > "$env_file" << EOF
# WokeFlow 监控环境变量
# 请根据实际情况修改这些值

# SMTP 配置 (用于告警邮件)
SMTP_USERNAME=alerts@wokeflow.com
SMTP_PASSWORD=your-smtp-password

# Slack 配置 (用于告警通知)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK

# PagerDuty 配置 (用于严重告警)
PAGERDUTY_SERVICE_KEY=your-pagerduty-service-key

# Grafana 管理员密码
GRAFANA_ADMIN_PASSWORD=admin123

# 监控服务端口
PROMETHEUS_PORT=9090
GRAFANA_PORT=3001
ALERTMANAGER_PORT=9093
NODE_EXPORTER_PORT=9100

# 环境标识
ENVIRONMENT=$ENVIRONMENT
EOF

    success "生成环境变量文件: $env_file"
    warning "请编辑 $env_file 并设置正确的凭据"
}

# 创建 Grafana 仪表板配置
create_grafana_dashboards() {
    info "创建 Grafana 仪表板配置..."

    # 数据源配置
    cat > "$MONITORING_DIR/grafana/provisioning/datasources/prometheus.yml" << 'EOF'
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: true
    jsonData:
      timeInterval: 15s
      queryTimeout: 60s
      httpMethod: POST
EOF

    # 仪表板配置
    cat > "$MONITORING_DIR/grafana/provisioning/dashboards/dashboards.yml" << 'EOF'
apiVersion: 1

providers:
  - name: 'WokeFlow Dashboards'
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    allowUiUpdates: true
    options:
      path: /var/lib/grafana/dashboards
EOF

    success "创建 Grafana 配置"
}

# 创建基础仪表板
create_basic_dashboards() {
    info "创建基础仪表板..."

    # SLO 状态仪表板
    cat > "$MONITORING_DIR/grafana/dashboards/slo-status.json" << 'EOF'
{
  "dashboard": {
    "title": "WokeFlow SLO 状态",
    "tags": ["wokeflow", "slo"],
    "timezone": "browser",
    "panels": [
      {
        "title": "API 可用性",
        "type": "stat",
        "targets": [
          {
            "expr": "slo:api_availability:ratio",
            "legendFormat": "可用性"
          }
        ]
      },
      {
        "title": "API 响应时间 P95",
        "type": "stat",
        "targets": [
          {
            "expr": "slo:api_latency:p95",
            "legendFormat": "P95 响应时间"
          }
        ]
      },
      {
        "title": "错误率",
        "type": "stat",
        "targets": [
          {
            "expr": "slo:error_rate:ratio",
            "legendFormat": "错误率"
          }
        ]
      },
      {
        "title": "错误预算剩余",
        "type": "stat",
        "targets": [
          {
            "expr": "slo:error_budget:remaining",
            "legendFormat": "错误预算剩余"
          }
        ]
      }
    ]
  }
}
EOF

    success "创建基础仪表板"
}

# 生成 docker-compose.monitoring.yml
create_monitoring_compose() {
    info "生成监控环境的 docker-compose 文件..."

    cat > "$PROJECT_ROOT/docker-compose.monitoring.yml" << 'EOF'
version: '3.8'

services:
  # Prometheus 监控
  prometheus:
    image: prom/prometheus:v2.45.0
    container_name: wokeflow-prometheus
    ports:
      - "${PROMETHEUS_PORT:-9090}:9090"
    volumes:
      - ./monitoring/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - ./monitoring/prometheus/alert_rules.yml:/etc/prometheus/alert_rules.yml:ro
      - ./monitoring/prometheus/slo_rules.yml:/etc/prometheus/slo_rules.yml:ro
      - ./monitoring/data/prometheus:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
      - '--storage.tsdb.retention.time=30d'
      - '--web.enable-lifecycle'
    networks:
      - wokeflow-monitoring
    restart: unless-stopped

  # Grafana 可视化
  grafana:
    image: grafana/grafana:10.1.0
    container_name: wokeflow-grafana
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_ADMIN_PASSWORD}
      - GF_USERS_ALLOW_SIGN_UP=false
      - GF_INSTALL_PLUGINS=grafana-piechart-panel,grafana-worldmap-panel
    ports:
      - "${GRAFANA_PORT:-3001}:3000"
    volumes:
      - ./monitoring/grafana/provisioning:/etc/grafana/provisioning:ro
      - ./monitoring/grafana/dashboards:/var/lib/grafana/dashboards:ro
      - ./monitoring/data/grafana:/var/lib/grafana
    depends_on:
      - prometheus
    networks:
      - wokeflow-monitoring
    restart: unless-stopped

  # AlertManager 告警
  alertmanager:
    image: prom/alertmanager:v0.25.0
    container_name: wokeflow-alertmanager
    ports:
      - "${ALERTMANAGER_PORT:-9093}:9093"
    volumes:
      - ./monitoring/alertmanager/config.yml:/etc/alertmanager/config.yml:ro
      - ./monitoring/data/alertmanager:/alertmanager
    command:
      - '--config.file=/etc/alertmanager/config.yml'
      - '--storage.path=/alertmanager'
    networks:
      - wokeflow-monitoring
    restart: unless-stopped

  # Node Exporter (系统监控)
  node-exporter:
    image: prom/node-exporter:v1.6.1
    container_name: wokeflow-node-exporter
    ports:
      - "${NODE_EXPORTER_PORT:-9100}:9100"
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro
    command:
      - '--path.procfs=/host/proc'
      - '--path.rootfs=/rootfs'
      - '--path.sysfs=/host/sys'
      - '--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/)'
    networks:
      - wokeflow-monitoring
    restart: unless-stopped
    deploy:
      mode: global

networks:
  wokeflow-monitoring:
    driver: bridge

volumes:
  prometheus_data:
  grafana_data:
  alertmanager_data:
EOF

    success "生成监控环境的 docker-compose 文件"
}

# 显示使用说明
show_usage() {
    echo ""
    echo "🎯 WokeFlow 监控环境设置完成！"
    echo ""
    echo "📋 下一步操作:"
    echo ""
    echo "1. 编辑环境变量文件:"
    echo "   nano $PROJECT_ROOT/.env.monitoring"
    echo ""
    echo "2. 启动监控环境:"
    echo "   docker-compose -f docker-compose.monitoring.yml --env-file .env.monitoring up -d"
    echo ""
    echo "3. 访问监控界面:"
    echo "   - Prometheus: http://localhost:9090"
    echo "   - Grafana: http://localhost:3001 (admin/${GRAFANA_ADMIN_PASSWORD})"
    echo "   - AlertManager: http://localhost:9093"
    echo ""
    echo "4. 配置告警通知:"
    echo "   - 编辑 monitoring/alertmanager/config.yml"
    echo "   - 设置 SMTP、Slack 或 PagerDuty 集成"
    echo ""
    echo "5. 导入仪表板:"
    echo "   - 在 Grafana 中导入 monitoring/grafana/dashboards/*.json"
    echo ""
    echo "📚 相关文档:"
    echo "   - docs/slo-definition.md - SLO 定义"
    echo "   - monitoring/prometheus/ - Prometheus 配置"
    echo "   - monitoring/alertmanager/ - 告警配置"
    echo ""
}

# 主函数
main() {
    info "🚀 开始设置 WokeFlow 监控环境"

    check_dependencies
    validate_configs
    create_directories
    generate_env_file
    create_grafana_dashboards
    create_basic_dashboards
    create_monitoring_compose

    success "✅ WokeFlow 监控环境设置完成！"
    show_usage
}

# 参数解析
while [[ $# -gt 0 ]]; do
    case $1 in
        --environment=*)
            ENVIRONMENT="${1#*=}"
            shift
            ;;
        --help)
            echo "WokeFlow 监控环境设置脚本"
            echo ""
            echo "用法: $0 [选项]"
            echo ""
            echo "选项:"
            echo "  --environment=ENV  环境名称 (默认: production)"
            echo "  --help             显示此帮助信息"
            echo ""
            echo "示例:"
            echo "  $0                         # 设置生产环境监控"
            echo "  $0 --environment=staging  # 设置staging环境监控"
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
