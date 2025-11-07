# 容器化应用健康检查和资源限制

## 概述

WokeFlow 的容器健康检查系统提供全面的容器化应用健康监控和资源管理功能，支持 Docker 和 Kubernetes 环境。该系统包含健康检查、资源限制监控、探针配置和自动化响应机制，确保应用的高可用性和资源高效利用。

## 核心组件

### 1. 健康检查器 (HealthChecker)

提供通用的健康检查框架，支持自定义检查逻辑和预定义检查函数。

#### 主要特性
- **可扩展检查框架**: 支持注册自定义健康检查
- **分层检查**: 关键检查和非关键检查分离
- **并发执行**: 异步执行多个健康检查
- **结果缓存**: 支持检查结果缓存以提高性能
- **事件通知**: 健康状态变更时发布事件

#### 使用示例
```javascript
import { HealthChecker, databaseHealthCheck, memoryHealthCheck } from './infrastructure/health-checks/HealthChecker.js';

const healthChecker = new HealthChecker({
  checkInterval: 30000, // 30秒检查间隔
  timeout: 5000,        // 5秒超时
  failureThreshold: 3   // 失败阈值
});

// 注册数据库健康检查
healthChecker.registerCheck('database', {
  check: databaseHealthCheck(connection),
  critical: true,
  interval: 15000
});

// 注册内存健康检查
healthChecker.registerCheck('memory', {
  check: memoryHealthCheck({
    heapUsed: 0.8,    // 80%堆使用率
    heapTotal: 0.9,   // 90%堆总量
    external: 0.7     // 70%外部内存
  }),
  critical: true
});

// 启动健康检查
await healthChecker.start();

// 获取健康状态
const health = healthChecker.getHealthSummary();
console.log(`Overall status: ${health.overall.status}`);
console.log(`Healthy checks: ${health.summary.healthy}`);
```

### 2. Docker健康检查器 (DockerHealthChecker)

专门为Docker容器环境优化的健康检查实现。

#### 检查内容
- **容器自身状态**: 运行状态、健康检查、容器信息
- **Docker daemon**: API连接、版本信息
- **容器资源**: CPU、内存、网络、磁盘使用率
- **网络连接**: 本地连接、外部连通性、DNS解析
- **依赖服务**: 外部服务的健康状态

#### 使用示例
```javascript
import { DockerHealthChecker } from './infrastructure/health-checks/DockerHealthChecker.js';

const dockerChecker = new DockerHealthChecker({
  containerName: 'my-app',
  serviceName: 'wokeflow-app',
  healthCheckEndpoint: '/health'
});

// 启动检查
await dockerChecker.start();

// 获取Docker环境信息
const envInfo = await dockerChecker.getDockerEnvironmentInfo();
console.log('Container:', envInfo.container);
console.log('Daemon:', envInfo.daemon);

// 手动重启容器（如果需要）
await dockerChecker.restartContainer('health_check_failed');
```

### 3. Kubernetes健康检查器 (KubernetesHealthChecker)

专门为Kubernetes环境优化的健康检查实现。

#### 检查内容
- **Pod状态**: 运行状态、容器就绪性、重启计数
- **Kubernetes API**: 集群连接、版本信息
- **集群组件**: etcd、API server、控制器管理器等
- **服务发现**: Endpoints、DNS解析
- **配置资源**: ConfigMaps、Secrets、持久卷

#### 使用示例
```javascript
import { KubernetesHealthChecker } from './infrastructure/health-checks/KubernetesHealthChecker.js';

const k8sChecker = new KubernetesHealthChecker({
  namespace: 'production',
  podName: process.env.POD_NAME,
  serviceName: 'wokeflow-api'
});

// 启动检查
await k8sChecker.start();

// 执行集群诊断
const diagnostics = await k8sChecker.runClusterDiagnostics();
console.log('Cluster diagnostics:', diagnostics);

// 获取Pod日志
const logs = await k8sChecker.getPodLogs('app', 100);
console.log('Pod logs:', logs);
```

### 4. 资源限制管理器 (ResourceLimits)

管理系统资源使用限制和自动响应机制。

#### 支持的资源类型
- **内存**: 堆使用率、堆总量、外部内存
- **CPU**: 使用百分比、时间限制
- **磁盘**: 使用率、写入速率
- **网络**: 连接数、带宽限制
- **文件句柄**: 打开文件数限制

#### 限制动作
- **log**: 记录警告日志
- **alert**: 发送告警通知
- **throttle**: 限制资源使用
- **gc**: 触发垃圾回收
- **shutdown**: 优雅关闭应用

#### 使用示例
```javascript
import { ContainerResourceLimits } from './infrastructure/health-checks/ResourceLimits.js';

const resourceLimits = new ContainerResourceLimits({
  type: 'kubernetes',
  memory: {
    limit: 512 * 1024 * 1024,      // 512MB
    reservation: 256 * 1024 * 1024  // 256MB
  },
  cpu: {
    cpus: 2,                        // 2个CPU核心
    quota: 150000,                  // CPU时间配额
    period: 100000                  // CPU周期
  },
  disk: {
    size: 10 * 1024 * 1024 * 1024,  // 10GB
    iops: 100                       // IOPS限制
  }
});

// 检查内存使用
const memoryUsage = process.memoryUsage();
const result = resourceLimits.checkLimit('memory', memoryUsage);

if (result.exceeded) {
  console.warn('Resource limit exceeded:', result.violations);
}

// 生成容器配置
const config = resourceLimits.generateContainerConfig();
console.log('Kubernetes resources config:', config.resources);
```

### 5. 健康检查中间件 (HealthCheckMiddleware)

为Express应用提供标准的健康检查HTTP端点。

#### 支持的端点
- **GET /health**: 基本健康状态
- **GET /health/detailed**: 详细健康信息
- **GET /health/metrics**: Prometheus格式指标
- **GET /health/liveness**: 存活探针
- **GET /health/readiness**: 就绪探针

#### 使用示例
```javascript
import express from 'express';
import { HealthCheckMiddleware } from './infrastructure/health-checks/HealthCheckMiddleware.js';

const app = express();
const healthChecker = new HealthChecker();

// 集成健康检查中间件
const middleware = HealthCheckMiddleware.integrate(app, healthChecker, {
  endpoint: '/health',
  includeDetails: true,
  exposeErrors: process.env.NODE_ENV === 'development'
});

// 生成Kubernetes探针配置
const probes = HealthCheckMiddleware.createKubernetesProbes({
  port: 3000,
  initialDelaySeconds: 30,
  periodSeconds: 10
});

console.log('Liveness probe:', probes.livenessProbe);
console.log('Readiness probe:', probes.readinessProbe);
```

## 配置示例

### Docker配置

#### Dockerfile健康检查
```dockerfile
FROM node:16-alpine

# 安装curl用于健康检查
RUN apk add --no-cache curl

# 设置健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

COPY . /app
WORKDIR /app
RUN npm ci --only=production

EXPOSE 3000
CMD ["npm", "start"]
```

#### Docker Compose配置
```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    depends_on:
      db:
        condition: service_healthy
```

### Kubernetes配置

#### Deployment配置
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: wokeflow-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: wokeflow
  template:
    metadata:
      labels:
        app: wokeflow
    spec:
      containers:
      - name: app
        image: wokeflow:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: production
        resources:
          limits:
            cpu: "2"
            memory: "512Mi"
          requests:
            cpu: "500m"
            memory: "256Mi"
        livenessProbe:
          httpGet:
            path: /health/liveness
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /health/readiness
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 2
        startupProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 5
          failureThreshold: 6
```

#### Service配置
```yaml
apiVersion: v1
kind: Service
metadata:
  name: wokeflow-service
spec:
  selector:
    app: wokeflow
  ports:
  - port: 80
    targetPort: 3000
  type: LoadBalancer
```

#### ConfigMap配置
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: wokeflow-config
data:
  HEALTH_CHECK_INTERVAL: "30"
  HEALTH_CHECK_TIMEOUT: "5"
  MEMORY_LIMIT_HEAP: "80"
  CPU_LIMIT_PERCENT: "80"
```

### 应用配置

```javascript
// config/health-checks.js
export const healthCheckConfig = {
  // 健康检查器配置
  checker: {
    checkInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL) || 30000,
    timeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT) || 5000,
    failureThreshold: 3,
    successThreshold: 1
  },

  // 资源限制配置
  resources: {
    memory: {
      heapUsed: parseFloat(process.env.MEMORY_LIMIT_HEAP) / 100 || 0.8,
      heapTotal: parseFloat(process.env.MEMORY_LIMIT_HEAP_TOTAL) / 100 || 0.9,
      external: parseFloat(process.env.MEMORY_LIMIT_EXTERNAL) / 100 || 0.7
    },
    cpu: {
      usagePercent: parseFloat(process.env.CPU_LIMIT_PERCENT) / 100 || 0.8,
      maxTimePerSecond: parseInt(process.env.CPU_LIMIT_TIME) || 800
    }
  },

  // 中间件配置
  middleware: {
    endpoint: process.env.HEALTH_ENDPOINT || '/health',
    detailedEndpoint: process.env.HEALTH_DETAILED_ENDPOINT || '/health/detailed',
    includeDetails: process.env.NODE_ENV === 'development',
    exposeErrors: process.env.NODE_ENV === 'development'
  }
};
```

## 监控和告警

### 健康状态监控

```javascript
// 订阅健康检查事件
eventBus.subscribe('healthCheckCompleted', (event) => {
  const { overallHealth, checks, summary } = event;

  // 发送指标到监控系统
  metrics.gauge('health_overall_status',
    overallHealth.status === 'healthy' ? 0 :
    overallHealth.status === 'degraded' ? 1 : 2
  );

  metrics.gauge('health_checks_total', summary.total);
  metrics.gauge('health_checks_healthy', summary.healthy);
  metrics.gauge('health_checks_unhealthy', summary.unhealthy);

  // 记录详细日志
  logger.info('Health check completed', {
    status: overallHealth.status,
    total: summary.total,
    healthy: summary.healthy,
    unhealthy: summary.unhealthy
  });
});

// 监控资源限制违规
eventBus.subscribe('resourceLimitExceeded', (violation) => {
  logger.warn('Resource limit exceeded', violation);

  // 发送告警
  alertSystem.send('RESOURCE_LIMIT_EXCEEDED', {
    resourceType: violation.resourceType,
    violations: violation.violations,
    currentValue: violation.currentValue
  });
});
```

### Prometheus指标

```javascript
// 健康检查指标
const healthMetrics = `
# HELP health_check_status Overall health status (0=healthy, 1=degraded, 2=unhealthy)
# TYPE health_check_status gauge
health_check_status ${healthStatus}

# HELP health_checks_total Total number of health checks
# TYPE health_checks_total gauge
health_checks_total ${totalChecks}

# HELP health_checks_healthy Number of healthy checks
# TYPE health_checks_healthy gauge
health_checks_healthy ${healthyChecks}

# HELP resource_usage_percent Resource usage percentage
# TYPE resource_usage_percent gauge
resource_usage_percent{resource="memory"} ${memoryUsage}
resource_usage_percent{resource="cpu"} ${cpuUsage}
`;

// 暴露/metrics端点
app.get('/metrics', (req, res) => {
  res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.status(200).send(healthMetrics);
});
```

### Grafana仪表盘

```json
{
  "dashboard": {
    "title": "Container Health Dashboard",
    "panels": [
      {
        "title": "Overall Health Status",
        "type": "stat",
        "targets": [
          {
            "expr": "health_check_status",
            "legendFormat": "Health Status"
          }
        ]
      },
      {
        "title": "Health Check Results",
        "type": "bargauge",
        "targets": [
          {
            "expr": "health_checks_healthy",
            "legendFormat": "Healthy"
          },
          {
            "expr": "health_checks_unhealthy",
            "legendFormat": "Unhealthy"
          }
        ]
      },
      {
        "title": "Resource Usage",
        "type": "graph",
        "targets": [
          {
            "expr": "resource_usage_percent",
            "legendFormat": "{{resource}} usage"
          }
        ]
      }
    ]
  }
}
```

## 故障排除

### 常见问题

1. **健康检查失败**
   ```bash
   # 检查应用日志
   docker logs <container_name>

   # 测试健康端点
   curl http://localhost:3000/health

   # 检查容器资源使用
   docker stats <container_name>
   ```

2. **Kubernetes探针失败**
   ```bash
   # 检查Pod状态
   kubectl describe pod <pod_name>

   # 查看探针事件
   kubectl get events --field-selector involvedObject.name=<pod_name>

   # 检查端点响应
   kubectl exec <pod_name> -- curl http://localhost:3000/health
   ```

3. **资源限制触发**
   ```javascript
   // 检查当前资源使用
   console.log(process.memoryUsage());
   console.log(process.cpuUsage());

   // 查看限制配置
   console.log(resourceLimits.getLimits('memory'));
   ```

4. **Docker健康检查失败**
   ```bash
   # 检查Docker健康状态
   docker ps
   docker inspect <container_name> | jq .State.Health

   # 手动测试健康检查
   docker exec <container_name> curl http://localhost:3000/health
   ```

### 调试技巧

```javascript
// 启用详细健康检查日志
process.env.LOG_LEVEL = 'debug';

// 手动执行健康检查
const result = await healthChecker.checkNow('database');
console.log('Manual check result:', result);

// 查看所有检查状态
const allHealth = healthChecker.getHealth();
console.log('All health checks:', allHealth);

// 重置失败计数器
healthChecker.resetCheck('failing_check');

// 获取资源使用统计
const stats = resourceLimits.getResourceStats();
console.log('Resource stats:', stats);
```

## 最佳实践

### 1. 健康检查设计
- **轻量级**: 健康检查应该快速且资源消耗低
- **确定性**: 检查结果应该一致且可预测
- **隔离性**: 检查不应相互依赖
- **信息丰富**: 提供有用的诊断信息

### 2. 资源限制配置
- **保守设置**: 设置略低于实际限制的值
- **渐进式**: 从宽松限制开始，根据监控数据调整
- **环境特定**: 不同环境使用不同的限制配置
- **自动化调整**: 根据负载情况动态调整限制

### 3. 容器配置
- **资源请求**: 设置合理的资源请求和限制
- **健康检查**: 配置适当的启动、存活和就绪探针
- **优雅关闭**: 实现SIGTERM处理和资源清理
- **日志记录**: 确保日志输出到stdout/stderr

### 4. 监控告警
- **关键指标**: 监控整体健康状态和关键检查
- **阈值告警**: 设置合理的告警阈值
- **趋势分析**: 分析健康检查趋势和资源使用模式
- **自动化响应**: 根据告警自动执行恢复操作

## 总结

容器化应用健康检查和资源限制系统为WokeFlow提供了企业级的容器管理能力。通过全面的健康监控、资源限制和自动化响应机制，确保了应用在容器环境中的稳定运行和高可用性。

系统采用了模块化设计，支持多种容器编排平台，并提供了丰富的配置选项和监控功能。在生产环境中合理配置和使用这些功能，可以显著提升应用的可靠性和运维效率。
