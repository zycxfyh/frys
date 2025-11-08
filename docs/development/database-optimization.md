# 数据库优化架构

## 概述

frys 数据库优化架构提供了一套完整的数据库性能优化解决方案，包括连接池管理、查询优化、索引管理、迁移控制和实时监控。

## 核心组件

### 1. 数据库连接池 (DatabaseConnectionPool)

**位置**: `src/infrastructure/database/DatabaseConnectionPool.js`

**功能特性**:

- PostgreSQL 连接池管理
- 自动重试和超时处理
- 连接健康检查
- 查询性能监控
- 慢查询检测
- 事务支持

**配置参数**:

```javascript
{
  host: 'localhost',
  port: 5432,
  database: 'frys',
  user: 'frys',
  password: 'password',
  min: 2,              // 最小连接数
  max: 20,             // 最大连接数
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  slowQueryThreshold: 1000  // 慢查询阈值(ms)
}
```

### 2. 数据库优化器 (DatabaseOptimizer)

**位置**: `src/infrastructure/database/DatabaseOptimizer.js`

**功能特性**:

- 查询性能分析 (EXPLAIN ANALYZE)
- 自动索引创建和优化
- 表统计信息更新
- 未使用索引检测
- 优化建议生成
- 性能基准测试

**主要方法**:

```javascript
// 分析查询性能
await optimizer.analyzeQuery('SELECT * FROM users WHERE status = $1', [
  'active',
]);

// 创建索引
await optimizer.createIndex('users', ['email'], { unique: true });

// 获取优化建议
const recommendations = await optimizer.getOptimizationRecommendations();
```

### 3. 数据库迁移管理器 (MigrationManager)

**位置**: `src/infrastructure/database/MigrationManager.js`

**功能特性**:

- 版本控制的数据库迁移
- 支持 JavaScript 和 SQL 迁移文件
- 迁移完整性验证
- 回滚支持
- 迁移状态跟踪

**使用方法**:

```javascript
// 创建新迁移
await migrationManager.createMigration('add_user_profiles', 'js');

// 执行迁移
await migrationManager.migrate();

// 回滚迁移
await migrationManager.rollback(1);
```

### 4. 数据库监控器 (DatabaseMonitor)

**位置**: `src/infrastructure/database/DatabaseMonitor.js`

**功能特性**:

- 实时性能监控
- 告警系统
- 指标历史记录
- 健康状态评估
- 自动优化触发

**监控指标**:

- 连接池状态
- 查询性能统计
- 数据库大小和缓存命中率
- 慢查询数量
- 锁等待情况

### 5. 数据库服务 (DatabaseService)

**位置**: `src/infrastructure/database/DatabaseService.js`

**功能特性**:

- 统一数据库接口
- 组件生命周期管理
- 健康检查聚合
- 维护任务调度
- 完整报告生成

### 6. 数据库管理应用服务 (DatabaseManagementService)

**位置**: `src/application/services/DatabaseManagementService.js`

**功能特性**:

- 高层业务接口
- 结果对象模式 (Success/Failure)
- 备份管理
- 维护任务编排
- 用户友好的错误处理

## 使用指南

### 初始化数据库服务

```javascript
import DatabaseService from './infrastructure/database/DatabaseService.js';

const dbService = new DatabaseService({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  enableOptimizer: true,
  enableMigrations: true,
  enableMonitoring: true,
});

await dbService.initialize();
await dbService.start();
```

### 执行数据库操作

```javascript
// 基本查询
const result = await dbService.query('SELECT * FROM users WHERE id = $1', [
  userId,
]);

// 事务操作
await dbService.transaction(async (client) => {
  await client.query('UPDATE users SET balance = balance - $1 WHERE id = $2', [
    amount,
    userId,
  ]);
  await client.query(
    'INSERT INTO transactions (user_id, amount) VALUES ($1, $2)',
    [userId, amount],
  );
});
```

### 数据库优化

```javascript
import DatabaseManagementService from './application/services/DatabaseManagementService.js';

const managementService = new DatabaseManagementService(dbService);

// 执行健康检查
const healthResult = await managementService.performHealthCheck();
if (healthResult.isSuccess) {
  console.log('数据库健康状态:', healthResult.data.health.status);
}

// 自动优化
const optimizationResult = await managementService.optimizeDatabase({
  autoOptimize: true,
  analyzeTables: true,
});
```

### 迁移管理

```javascript
// 创建迁移
await managementService.manageMigrations({
  action: 'create',
  name: 'add_user_indexes',
  type: 'js',
});

// 执行迁移
await managementService.manageMigrations({
  action: 'migrate',
});
```

### 监控和报告

```javascript
// 获取监控状态
const monitoringResult = await managementService.monitorDatabase({
  hours: 24,
  generateReport: true,
});

// 生成完整报告
const fullReport = await dbService.generateFullReport();
```

## 性能优化策略

### 1. 索引优化

```javascript
// 创建复合索引
await dbService.createIndex('orders', ['user_id', 'created_at'], {
  name: 'idx_orders_user_created',
});

// 创建部分索引
await dbService.createIndex('logs', ['level'], {
  where: "created_at > CURRENT_DATE - INTERVAL '30 days'",
  name: 'idx_recent_logs_level',
});
```

### 2. 查询优化

```javascript
// 使用查询分析
const analysis = await dbService.analyzeQuery(
  `
  SELECT u.name, COUNT(o.id) as order_count
  FROM users u
  LEFT JOIN orders o ON u.id = o.user_id
  WHERE u.created_at > $1
  GROUP BY u.id, u.name
  HAVING COUNT(o.id) > $2
`,
  ['2024-01-01', 5],
);

console.log('执行时间:', analysis.executionTime, 'ms');
console.log('执行计划:', analysis.plan);
```

### 3. 连接池调优

```javascript
// 根据负载调整连接池
const poolStats = dbService.getPoolStats();
if (poolStats.waitingCount > 10) {
  // 增加最大连接数
  dbService.updateMonitoringConfig({
    maxConnections: poolStats.max + 5,
  });
}
```

## 监控和告警

### 自动告警条件

- 连接池使用率 > 80%
- 慢查询数量 > 10 个/分钟
- 缓存命中率 < 90%
- 锁等待时间 > 5 秒
- 数据库大小增长异常

### 健康检查端点

```javascript
// 健康检查
app.get('/health/database', async (req, res) => {
  const health = await dbService.healthCheck();
  res.status(health.status === 'healthy' ? 200 : 503).json(health);
});

// 指标端点
app.get('/metrics/database', async (req, res) => {
  const metrics = dbService.getPerformanceMetrics();
  res.json(metrics);
});
```

## 备份和恢复

```javascript
// 创建备份
const backupResult = await managementService.manageBackups({
  action: 'create',
});

// 恢复备份
const restoreResult = await managementService.manageBackups({
  action: 'restore',
  backupId: 'backup_20241107_143000',
});
```

## 最佳实践

### 1. 连接池配置

- 根据应用负载设置合适的 min/max 连接数
- 设置合理的超时时间
- 监控连接池使用率

### 2. 索引策略

- 为频繁查询的列创建索引
- 使用复合索引优化多列查询
- 定期清理未使用的索引

### 3. 查询优化

- 使用 EXPLAIN ANALYZE 分析查询性能
- 避免 SELECT \*，只选择需要的列
- 使用适当的 JOIN 类型

### 4. 监控设置

- 设置合理的告警阈值
- 定期查看性能报告
- 根据监控数据调整配置

### 5. 维护计划

- 定期更新表统计信息
- 清理过期数据
- 监控数据库增长趋势

## 故障排除

### 常见问题

1. **连接池耗尽**
   - 检查连接泄漏
   - 增加最大连接数
   - 优化查询性能减少持有时间

2. **慢查询问题**
   - 添加缺失的索引
   - 重写查询逻辑
   - 考虑查询结果缓存

3. **内存不足**
   - 调整连接池大小
   - 优化查询减少内存使用
   - 考虑升级数据库实例

4. **锁竞争**
   - 优化事务范围
   - 使用适当的隔离级别
   - 考虑应用层锁

## 扩展和定制

数据库优化架构设计为可扩展的，支持：

- 自定义监控指标
- 额外的数据库后端 (MySQL, MongoDB等)
- 特定的优化策略
- 集成第三方监控工具

通过实现相应的接口，可以轻松添加新的数据库优化功能和监控指标。
