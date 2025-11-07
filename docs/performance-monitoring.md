# frys 性能监控和告警系统

## 概述

frys 集成了全面的性能监控和告警系统，基于 Prometheus 风格的指标收集，支持实时监控、自动告警和健康检查。该系统提供了完整的可观测性解决方案，帮助及时发现和响应性能问题。

## 核心组件

### 1. PrometheusInspiredMetrics 类

位于 `src/core/PrometheusInspiredMetrics.js`，提供了：

- **指标类型支持**：
  - Counter（计数器）：单调递增的数值，如请求数、错误数
  - Gauge（仪表盘）：可增可减的数值，如内存使用、活跃连接数
  - Histogram（直方图）：分布统计，如响应时间、查询延迟

- **自动指标收集**：
  - 系统资源指标（CPU、内存、磁盘）
  - 应用性能指标（运行时间、错误统计）
  - HTTP 请求指标（响应时间、状态码统计）

- **告警系统**：
  - 内置告警规则（内存使用、错误率、响应时间、系统负载）
  - 自定义告警规则支持
  - 告警冷却机制防止告警风暴

- **健康检查**：
  - 数据库连接检查
  - 缓存服务检查
  - 文件系统检查
  - 外部服务检查
  - 自定义健康检查扩展

### 2. PerformanceMonitoringMiddleware 中间件

位于 `src/middleware/performance-monitoring.middleware.js`，提供：

- **HTTP 请求监控**：自动记录请求指标和性能数据
- **应用集成**：Express 应用一键集成
- **便捷 API**：包装异步函数进行性能监控
- **健康检查端点**：`/health` 提供系统健康状态
- **指标导出端点**：`/metrics` 提供 Prometheus 格式指标
- **告警管理端点**：`/alerts` 查看活跃告警

## 指标体系

### HTTP 指标

```prometheus
# 请求总数
http_requests_total{method="GET",route="/api/users",status="2xx"} 150

# 响应时间直方图
http_request_duration_seconds_bucket{method="POST",route="/api/login",le="1"} 95
http_request_duration_seconds_bucket{method="POST",route="/api/login",le="2.5"} 98
http_request_duration_seconds_bucket{method="POST",route="/api/login",le="5"} 99

# 活跃连接数
http_active_connections 12
```

### 系统资源指标

```prometheus
# 内存使用
process_memory_usage_bytes{type="heapUsed"} 104857600
process_memory_usage_bytes{type="rss"} 209715200

# CPU 使用率
process_cpu_usage_percent 15.5

# 系统信息
system_memory_total_bytes 8589934592
system_memory_free_bytes 2147483648
system_cpu_cores 8
```

### 应用性能指标

```prometheus
# 错误统计
application_errors_total{type="database",severity="error"} 5
application_errors_total{type="api",severity="warning"} 12

# 数据库查询性能
database_query_duration_seconds_bucket{operation="SELECT",table="users",le="0.1"} 85

# 缓存操作
cache_operations_total{operation="get",result="hit"} 1200
cache_operations_total{operation="set",result="success"} 800

# 业务操作
business_operations_total{operation="user_registration",result="success"} 45
```

## 告警规则

### 内置告警规则

1. **高内存使用**（内存使用 > 80%）
   - 严重程度：警告
   - 冷却时间：5分钟

2. **高错误率**（5xx错误 > 5%）
   - 严重程度：严重
   - 冷却时间：1分钟

3. **响应时间慢**（平均响应时间 > 5秒）
   - 严重程度：警告
   - 冷却时间：2分钟

4. **系统负载高**（CPU使用率 > 90%）
   - 严重程度：警告
   - 冷却时间：3分钟

### 自定义告警规则

```javascript
monitoringMiddleware.addCustomAlertRule('custom_rule', (metrics) => {
  const value = monitoringMiddleware.metrics.getMetricValue('custom_metric');
  return value > threshold;
}, {
  severity: 'critical',
  message: '自定义告警消息',
  threshold: 100,
  cooldown: 300000 // 5分钟冷却
});
```

## 健康检查

### 内置健康检查

- **数据库连接**：检查数据库连接状态和延迟
- **缓存服务**：检查缓存服务可用性和命中率
- **文件系统**：检查文件系统读写权限
- **外部服务**：检查外部API服务的可达性

### 自定义健康检查

```javascript
monitoringMiddleware.addCustomHealthCheck('payment_service', async () => {
  const response = await fetch('https://payment-api.example.com/health');
  if (response.ok) {
    return { status: 'healthy', version: '1.2.3' };
  } else {
    throw new Error('Payment service unavailable');
  }
}, {
  interval: 30000, // 30秒检查间隔
  timeout: 5000    // 5秒超时
});
```

## 使用方法

### 1. 初始化监控系统

```javascript
import PerformanceMonitoringMiddleware from './middleware/performance-monitoring.middleware.js';

const monitoring = new PerformanceMonitoringMiddleware({
  collectInterval: 30000,    // 30秒收集指标
  alertInterval: 60000,      // 60秒检查告警
  enableHealthEndpoint: true,
  enableMetricsEndpoint: true
});
```

### 2. 集成到 Express 应用

```javascript
const app = express();

// 添加性能监控中间件
monitoring.setupAppMonitoring(app);

// 现在可以访问:
// GET /health - 健康检查
// GET /metrics - Prometheus指标
// GET /alerts - 活跃告警
// GET /performance/stats - 性能统计
```

### 3. 监控异步操作

```javascript
// 数据库操作监控
const monitoredDbQuery = monitoring.monitorAsyncFunction(
  'user_lookup',
  async (userId) => {
    return await database.findUser(userId);
  },
  { category: 'database', metadata: { table: 'users' } }
);

// 业务逻辑监控
const monitoredBusinessLogic = monitoring.monitorAsyncFunction(
  'user_registration',
  registerUser,
  { category: 'business' }
);
```

### 4. 手动记录指标

```javascript
// 记录应用错误
monitoring.recordApplicationError(error, 'validation_error', 'warning');

// 记录数据库操作
monitoring.recordDatabaseOperation('INSERT', 'orders', 45);

// 记录缓存操作
monitoring.recordCacheOperation('get', 'hit');

// 记录业务操作
monitoring.recordBusinessOperation('payment_processing', 'success');
```

## 配置选项

```javascript
const monitoring = new PerformanceMonitoringMiddleware({
  // 指标收集间隔（毫秒）
  collectInterval: 30000,

  // 告警检查间隔（毫秒）
  alertInterval: 60000,

  // 健康检查端点路径
  healthCheckPath: '/health',

  // 指标导出端点路径
  metricsPath: '/metrics',

  // 是否启用健康检查端点
  enableHealthEndpoint: true,

  // 是否启用指标导出端点
  enableMetricsEndpoint: true
});
```

## 与现有系统的集成

### 结构化日志集成

性能监控系统与结构化日志系统深度集成：

- 所有告警自动记录到结构化日志
- 性能指标通过专用日志流输出
- 分布式追踪ID自动关联

### Docker Compose 配置

在 `docker-compose.prod.yml` 中已配置 Prometheus 和 Grafana：

```yaml
prometheus:
  image: prom/prometheus:latest
  ports:
    - "9090:9090"
  volumes:
    - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml

grafana:
  image: grafana/grafana:latest
  ports:
    - "3000:3000"
```

### Nginx 配置

在 `nginx/nginx.conf` 中已添加监控端点代理：

```nginx
location /health {
  proxy_pass http://app:3000;
}

location /metrics {
  proxy_pass http://app:3000;
}
```

## 监控面板

通过 Grafana 可以创建丰富的监控面板：

1. **系统资源面板**：CPU、内存、磁盘使用率趋势
2. **应用性能面板**：响应时间、错误率、吞吐量
3. **业务指标面板**：用户注册数、订单处理数等
4. **告警面板**：活跃告警列表和历史趋势

## 最佳实践

### 1. 指标命名规范

- 使用下划线分隔单词
- 包含必要的标签维度
- 遵循 Prometheus 命名约定

### 2. 告警规则设计

- 设置合理的阈值避免误报
- 配置适当的冷却时间
- 分层告警（警告→严重→紧急）

### 3. 性能影响

- 指标收集对应用性能影响 < 1%
- 合理设置收集间隔平衡监控精度和性能
- 在高负载环境下可适当降低收集频率

### 4. 安全考虑

- 监控端点应在内部网络访问
- 敏感指标数据需要适当保护
- 告警通知应加密传输

## 故障排除

### 常见问题

1. **指标数据丢失**
   - 检查收集间隔设置
   - 确认应用正常运行
   - 查看日志中的错误信息

2. **告警频繁触发**
   - 调整告警阈值
   - 增加冷却时间
   - 检查是否存在性能问题

3. **健康检查失败**
   - 确认依赖服务正常
   - 检查网络连接
   - 查看健康检查日志

## 扩展开发

### 添加新的指标类型

```javascript
// 在 PrometheusInspiredMetrics 中添加
createCustomMetric(name, type, config) {
  // 实现自定义指标类型
}
```

### 集成外部监控系统

```javascript
// 添加到 PerformanceMonitoringMiddleware
integrateWithExternalSystem(externalSystem) {
  // 实现与其他监控系统的集成
}
```

该性能监控和告警系统为 frys 提供了企业级的可观测性能力，确保系统稳定运行和快速问题响应。
