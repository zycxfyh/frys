# frys 智能回退管理系统

## 概述

frys 的智能回退管理系统提供了企业级的自动化故障恢复能力。通过实时健康监控、智能决策和渐进式回退策略，确保系统在出现问题时能够快速、安全地恢复正常运行。

## 核心架构

### 1. SmartRollbackManager 类

位于 `src/core/SmartRollbackManager.js`，是整个回退系统的核心。

#### 主要特性

- **实时健康监控**：基于 Prometheus 风格的指标收集
- **智能决策引擎**：根据问题严重程度选择合适的回退策略
- **渐进式回退**：从轻量级降级到完全回退的五级策略
- **自动恢复验证**：回退后的完整性验证和健康检查

#### 监控指标

```javascript
{
  responseTime: 450,      // 响应时间(ms)
  errorRate: 0.02,        // 错误率(0-1)
  memoryUsage: 0.75,      // 内存使用率(0-1)
  cpuUsage: 0.60,         // CPU使用率(0-1)
  databaseConnections: {   // 数据库连接状态
    status: 'healthy',
    connections: 5,
    latency: 10
  },
  cacheHealth: {          // 缓存服务状态
    status: 'healthy',
    hitRate: 0.95
  }
}
```

### 2. SmartRollbackCoordinator 类

位于 `scripts/smart-rollback.js`，提供命令行接口和高级协调功能。

#### 功能特性

- **监控模式**：持续监控系统健康状态
- **手动回退**：按需执行特定回退策略
- **紧急回退**：立即停止服务防止进一步损害
- **状态报告**：实时回退统计和健康状态

### 3. RollbackVerifier 类

位于 `scripts/rollback-verifier.js`，提供全面的回退验证。

#### 验证范围

- 应用可用性检查
- 健康端点验证
- 性能指标监控
- 依赖服务状态
- 数据一致性验证
- 流量分布确认

## 回退策略体系

### 五级渐进式回退策略

#### 1. 熔断器模式 (Circuit Breaker)

```javascript
// 触发条件：严重性能问题
// 策略：暂时停止接受新请求，保护后端服务
{
  name: 'circuit_breaker',
  description: '暂时停止新请求接受',
  recoveryTime: '30秒-5分钟'
}
```

#### 2. 流量切换模式 (Traffic Shifting)

```javascript
// 触发条件：服务响应异常
// 策略：将流量切换到备用环境或实例
{
  name: 'traffic_shifting',
  description: '切换到备用环境',
  recoveryTime: '1-5分钟'
}
```

#### 3. 环境切换模式 (Environment Switch)

```javascript
// 触发条件：环境级故障
// 策略：蓝绿部署环境切换
{
  name: 'environment_switch',
  description: 'Docker环境切换',
  recoveryTime: '2-10分钟'
}
```

#### 4. 版本回滚模式 (Version Rollback)

```javascript
// 触发条件：代码级问题
// 策略：回滚到上一稳定版本
{
  name: 'version_rollback',
  description: '回滚到稳定版本',
  recoveryTime: '5-15分钟'
}
```

#### 5. 紧急停止模式 (Emergency Shutdown)

```javascript
// 触发条件：系统完全不可用
// 策略：停止服务防止数据损坏
{
  name: 'emergency_shutdown',
  description: '紧急停止服务',
  recoveryTime: '手动恢复'
}
```

### 智能决策逻辑

#### 健康状态评估

```javascript
const assessment = {
  status: 'healthy|warning|critical|unhealthy',
  score: 0 - 100, // 综合健康评分
  issues: [
    /* 具体问题列表 */
  ],
  metrics: {
    /* 原始指标数据 */
  },
};
```

#### 回退触发条件

```javascript
const thresholds = {
  responseTime: 5000, // 响应时间 > 5秒
  errorRate: 0.05, // 错误率 > 5%
  memoryUsage: 0.9, // 内存使用 > 90%
  cpuUsage: 0.9, // CPU使用 > 90%
  consecutiveFailures: 3, // 连续失败次数
};
```

## 使用方法

### 1. 启动智能监控

```bash
# 启动持续监控模式
npm run rollback:monitor

# 或使用协调器脚本
node scripts/smart-rollback.js monitor --env production
```

### 2. 手动执行回退

```bash
# 执行环境切换回退
npm run rollback:manual environment_switch

# 执行版本回滚
node scripts/smart-rollback.js rollback version_rollback --reason "性能问题"

# 执行紧急回退
npm run rollback:emergency "数据库故障"
```

### 3. 验证回退结果

```bash
# 执行完整回退验证
npm run rollback:verify

# 指定环境验证
node scripts/rollback-verifier.js --env staging
```

### 4. 查看回退状态

```bash
# 获取当前状态
node scripts/smart-rollback.js status

# 生成详细报告
node scripts/smart-rollback.js report
```

## 配置选项

### SmartRollbackManager 配置

```javascript
const rollbackManager = new SmartRollbackManager({
  environment: 'production',
  enableAutoRollback: true,
  rollbackTimeout: 300000, // 5分钟回退超时
  healthCheckInterval: 30000, // 30秒健康检查间隔
  maxRollbackAttempts: 3, // 最大回退尝试次数

  alertThresholds: {
    responseTime: 5000, // 响应时间阈值(ms)
    errorRate: 0.05, // 错误率阈值(0-1)
    memoryUsage: 0.9, // 内存使用阈值(0-1)
    cpuUsage: 0.9, // CPU使用阈值(0-1)
    consecutiveFailures: 3, // 连续失败阈值
  },
});
```

### 环境变量配置

```bash
# 回退系统配置
ROLLBACK_ENV=production
ROLLBACK_AUTO_ENABLED=true
ROLLBACK_TIMEOUT=300000
HEALTH_CHECK_INTERVAL=30000

# 健康检查配置
HEALTH_CHECK_URL=http://localhost:3000/health
METRICS_URL=http://localhost:3000/metrics

# 告警阈值配置
THRESHOLD_RESPONSE_TIME=5000
THRESHOLD_ERROR_RATE=0.05
THRESHOLD_MEMORY_USAGE=0.9
THRESHOLD_CPU_USAGE=0.9
```

## 监控和告警

### 健康状态监控

系统持续监控以下关键指标：

1. **应用层指标**
   - HTTP响应时间
   - 错误率统计
   - 活跃连接数

2. **系统层指标**
   - CPU使用率
   - 内存使用率
   - 磁盘空间

3. **依赖服务指标**
   - 数据库连接状态
   - 缓存服务健康
   - 外部API可用性

### 告警机制

#### 告警等级

- **INFO**: 一般信息通知
- **WARNING**: 警告，需要关注
- **CRITICAL**: 严重问题，自动回退
- **EMERGENCY**: 紧急情况，立即停止

#### 告警通知渠道

- **控制台日志**: 实时输出到控制台
- **结构化日志**: 写入日志文件用于分析
- **外部集成**: 可集成 Slack、PagerDuty 等

### 回退历史记录

```json
{
  "timestamp": "2025-01-07T10:30:00.000Z",
  "type": "automatic",
  "strategy": "environment_switch",
  "reason": "high_error_rate",
  "duration": 45000,
  "success": true,
  "verificationStatus": "passed"
}
```

## 回退验证流程

### 验证检查清单

1. **基础可用性**
   - ✅ 应用端口监听状态
   - ✅ HTTP响应状态
   - ✅ 基础连通性

2. **应用健康**
   - ✅ 健康检查端点响应
   - ✅ 应用状态报告
   - ✅ 组件健康状态

3. **性能指标**
   - ✅ 响应时间在合理范围
   - ✅ 错误率控制在阈值内
   - ✅ 资源使用正常

4. **依赖服务**
   - ✅ 数据库连接正常
   - ✅ 缓存服务可用
   - ✅ 外部服务可达

5. **数据一致性**
   - ✅ 数据库完整性检查
   - ✅ 配置一致性验证
   - ✅ 缓存数据同步

6. **流量分布**
   - ✅ 负载均衡器配置正确
   - ✅ 流量正确路由
   - ✅ 无流量丢失

### 验证报告示例

```json
{
  "timestamp": "2025-01-07T10:35:00.000Z",
  "environment": "production",
  "overallStatus": "passed",
  "duration": 30000,
  "checks": [
    {
      "name": "应用健康检查",
      "status": "passed",
      "duration": 1200,
      "details": {
        "status": "healthy",
        "responseTime": "45ms"
      }
    },
    {
      "name": "依赖服务检查",
      "status": "passed",
      "duration": 800,
      "details": {
        "database": "connected",
        "cache": "healthy"
      }
    }
  ],
  "recommendations": []
}
```

## 最佳实践

### 1. 回退策略配置

```javascript
// 根据环境配置不同的回退策略
const strategies = {
  development: ['circuit_breaker', 'environment_switch'],
  staging: ['circuit_breaker', 'traffic_shifting', 'environment_switch'],
  production: [
    'circuit_breaker',
    'traffic_shifting',
    'environment_switch',
    'version_rollback',
  ],
};
```

### 2. 监控阈值调优

```javascript
// 根据历史数据调整阈值
const tunedThresholds = {
  // 从历史监控数据中学习最佳阈值
  responseTime: calculatePercentile(responseTimes, 95), // P95响应时间
  errorRate: calculateAverageErrorRate(lastWeek), // 过去一周平均错误率
  memoryUsage: 0.85, // 略低于系统限制
  cpuUsage: 0.8, // 留出buffer空间
};
```

### 3. 回退测试计划

```javascript
// 定期执行回退演练
const rollbackDrill = {
  schedule: '每月第一周三 02:00',
  environments: ['staging'], // 只在staging环境执行
  strategies: ['circuit_breaker', 'environment_switch'],
  verification: true,
  report: true,
};
```

### 4. 应急响应流程

1. **检测阶段**: 监控系统自动检测问题
2. **评估阶段**: 智能决策引擎评估问题严重程度
3. **执行阶段**: 选择并执行合适的回退策略
4. **验证阶段**: 全面验证回退结果
5. **通知阶段**: 通知相关人员和系统
6. **恢复阶段**: 准备手动恢复或进一步调查

## 故障排除

### 常见问题

#### 1. 回退执行失败

```bash
# 检查回退日志
tail -f logs/rollback-*.log

# 验证系统状态
npm run rollback:verify

# 手动执行回退
npm run rollback:manual environment_switch
```

#### 2. 健康检查误报

```bash
# 调整监控阈值
export THRESHOLD_RESPONSE_TIME=8000
export THRESHOLD_ERROR_RATE=0.08

# 禁用自动回退进行调试
export ROLLBACK_AUTO_ENABLED=false
```

#### 3. 验证失败

```bash
# 检查验证详细日志
cat rollback-verification-report.json

# 手动验证各组件
curl http://localhost:3000/health
docker-compose ps
```

#### 4. 性能问题

```bash
# 调整监控间隔
export HEALTH_CHECK_INTERVAL=60000  # 1分钟检查一次

# 减少并发验证
export VERIFICATION_CONCURRENCY=2
```

## 扩展开发

### 添加新的回退策略

```javascript
class CustomRollbackManager extends SmartRollbackManager {
  async executeCustomStrategy(issues) {
    // 实现自定义回退逻辑
    return await this.runCommand('custom-rollback-script.sh', []);
  }

  // 注册新策略
  get rollbackStrategies() {
    return [...super.rollbackStrategies, 'custom_strategy'];
  }
}
```

### 集成外部监控系统

```javascript
class ExternalMonitoringRollbackManager extends SmartRollbackManager {
  async collectHealthMetrics() {
    const baseMetrics = await super.collectHealthMetrics();

    // 从外部监控系统获取额外指标
    const externalMetrics = await this.fetchExternalMetrics();

    return { ...baseMetrics, ...externalMetrics };
  }

  async fetchExternalMetrics() {
    // 实现外部监控系统集成
    return {
      externalResponseTime: await this.queryExternalSystem('response_time'),
      externalErrorRate: await this.queryExternalSystem('error_rate'),
    };
  }
}
```

### 自定义健康检查

```javascript
class CustomHealthRollbackManager extends SmartRollbackManager {
  async collectCustomMetrics() {
    return {
      businessMetrics: await this.checkBusinessHealth(),
      integrationHealth: await this.checkIntegrationHealth(),
    };
  }

  async checkBusinessHealth() {
    // 检查业务特定的健康指标
    return {
      orderProcessingRate: await this.getOrderRate(),
      userSessionHealth: await this.checkUserSessions(),
    };
  }
}
```

这个智能回退管理系统为 frys 提供了企业级的故障恢复能力，确保系统的高可用性和快速响应能力。
