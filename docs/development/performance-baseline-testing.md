# 性能基准测试架构

## 概述

frys 性能基准测试系统提供了一套完整的性能测试、监控和分析解决方案，支持从简单的基准测试到复杂的压力测试和负载测试。

## 核心组件

### 1. 性能基准测试器 (PerformanceBenchmark)

**位置**: `src/infrastructure/benchmarking/PerformanceBenchmark.js`

**功能特性**:

- 多并发级别测试
- 自动预热和测量
- 延迟统计分析 (P50, P90, P95, P99, P99.9)
- 内存使用监控
- 结果趋势分析
- 性能拐点检测

**核心方法**:

```javascript
const benchmark = new PerformanceBenchmark();

// 运行基准测试套件
const results = await benchmark.runBenchmarkSuite('api-tests', [
  {
    name: 'user-creation',
    description: '测试用户创建性能',
    setup: async () => {
      /* 初始化 */
    },
    execute: async () => {
      /* 测试代码 */
    },
    teardown: async () => {
      /* 清理 */
    },
  },
]);
```

### 2. 负载测试器 (LoadTester)

**位置**: `src/infrastructure/benchmarking/LoadTester.js`

**功能特性**:

- 多种负载模式 (恒定、渐进、阶梯、峰值、随机、正弦)
- 实时监控和告警
- 自动扩容测试
- 错误分布分析
- 资源使用监控

**负载模式**:

```javascript
// 渐进负载测试
const loadTester = new LoadTester();
const results = await loadTester.runLoadTest({
  name: 'api-load-test',
  pattern: 'ramp', // constant, ramp, step, spike, random, sinusoidal
  duration: 300000, // 5分钟
  targetConcurrency: 100,
  monitoring: { enabled: true, interval: 5000 },
  execute: async () => {
    // 测试代码
    await apiCall();
  },
});
```

### 3. 压力测试器 (StressTester)

**位置**: `src/infrastructure/benchmarking/StressTester.js`

**功能特性**:

- 多种压力类型 (过载、内存压力、磁盘I/O、网络饱和、混合负载、级联故障)
- 系统极限探测
- 故障注入和恢复测试
- 级联故障分析
- 自动故障检测

**压力测试**:

```javascript
const stressTester = new StressTester();
const results = await stressTester.runStressTest({
  name: 'overload-test',
  stressType: 'overload', // overload, memory_pressure, disk_io, network_saturation, mixed_workload, cascading_failure
  intensity: 'high', // low, medium, high, extreme
  recoveryTest: true,
  failureThresholds: {
    maxErrorRate: 20,
    maxLatency: 5000,
    maxMemoryUsage: 0.85,
  },
  execute: async () => {
    /* 测试代码 */
  },
});
```

### 4. 基准测试管理器 (BenchmarkManager)

**位置**: `src/infrastructure/benchmarking/BenchmarkManager.js`

**功能特性**:

- 统一测试管理
- 历史结果比较
- 多格式报告导出
- 自动测试调度
- 性能趋势分析

## 使用指南

### 基本基准测试

```javascript
import { PerformanceBenchmark } from './infrastructure/benchmarking/PerformanceBenchmark.js';

// 创建基准测试实例
const benchmark = new PerformanceBenchmark({
  warmupIterations: 100,
  measurementIterations: 1000,
  concurrencyLevels: [1, 5, 10, 25, 50],
  percentiles: [50, 90, 95, 99, 99.9],
});

// 定义测试用例
const testSuite = [
  {
    name: 'database-query',
    description: '测试数据库查询性能',
    setup: async () => {
      // 初始化数据库连接
      await db.connect();
    },
    execute: async () => {
      // 执行测试操作
      await db.query('SELECT * FROM users WHERE id = $1', [
        Math.floor(Math.random() * 1000),
      ]);
    },
    teardown: async () => {
      // 清理资源
      await db.disconnect();
    },
  },
];

// 运行测试
const results = await benchmark.runBenchmarkSuite(
  'database-performance',
  testSuite,
);

// 查看结果
console.log('最佳并发数:', results.analysis.optimalConcurrency);
console.log('最佳吞吐量:', results.analysis.bestThroughput);
console.log('扩展效率:', results.analysis.scalingEfficiency);
```

### 负载测试

```javascript
import { LoadTester } from './infrastructure/benchmarking/LoadTester.js';

const loadTester = new LoadTester();

// 定义负载测试场景
const scenario = LoadTester.createScenario('api-load-test', {
  description: 'API负载测试',
  pattern: 'ramp',
  duration: 300000, // 5分钟
  targetConcurrency: 100,
  monitoring: {
    enabled: true,
    interval: 5000,
    cpu: true,
    memory: true,
  },
  setup: async () => {
    // 初始化测试环境
  },
  execute: async () => {
    // 执行API调用
    const response = await fetch('/api/users');
    return response.json();
  },
  teardown: async () => {
    // 清理测试环境
  },
});

// 运行负载测试
const results = await loadTester.runLoadTest(scenario);

// 分析结果
console.log('平均吞吐量:', results.metrics.avgThroughput);
console.log('错误率:', results.metrics.errorRate);
console.log('95%分位延迟:', results.metrics.latencyStats.p95);
```

### 压力测试

```javascript
import { StressTester } from './infrastructure/benchmarking/StressTester.js';

const stressTester = new StressTester();

// 定义压力测试配置
const stressConfig = StressTester.createStressScenario('overload-test', {
  description: '系统过载测试',
  stressType: 'overload',
  intensity: 'high',
  recoveryTest: true,
  failureThresholds: {
    maxErrorRate: 20,
    maxLatency: 5000,
    maxMemoryUsage: 0.85,
    minThroughput: 10,
  },
  setup: async () => {
    // 初始化测试环境
  },
  execute: async () => {
    // 执行压力测试操作
    await performHeavyOperation();
  },
  teardown: async () => {
    // 清理测试环境
  },
});

// 运行压力测试
const results = await stressTester.runStressTest(stressConfig);

// 查看故障点
console.log('故障点:', results.failurePoints);
console.log('系统极限:', results.analysis.systemLimits);
console.log('恢复能力:', results.recoveryMetrics?.successful);
```

### 综合测试管理

```javascript
import BenchmarkManager from './infrastructure/benchmarking/BenchmarkManager.js';

// 初始化管理器
const manager = new BenchmarkManager({
  resultsDir: './benchmark-results',
  enableHistoricalComparison: true,
  reportFormats: ['json', 'html', 'csv'],
});

await manager.initialize();

// 注册基准测试
manager.registerBenchmark('api-response-time', {
  type: 'performance',
  setup: async () => {
    /* setup */
  },
  execute: async () => {
    /* test */
  },
  teardown: async () => {
    /* cleanup */
  },
});

// 运行全面评估
const assessment = await manager.runComprehensiveAssessment({
  includeBenchmarks: true,
  includeLoadTests: true,
  includeStressTests: true,
  benchmarkSuite: 'full-assessment',
  loadScenarios: [loadScenario],
  stressTests: [stressConfig],
});

// 生成报告
console.log('整体评分:', assessment.analysis.overall.score);
console.log('建议:', assessment.recommendations);
```

## 测试模式详解

### 基准测试模式

1. **预热阶段**: 执行少量操作以预热系统
2. **测量阶段**: 在不同并发级别下执行大量操作
3. **分析阶段**: 计算性能指标和扩展效率

### 负载测试模式

#### 恒定负载 (constant)

- 维持固定并发数持续运行
- 适用于稳定性测试

#### 渐进负载 (ramp)

- 逐渐增加并发数到目标值
- 适用于容量规划

#### 阶梯负载 (step)

- 分阶段逐步增加负载
- 适用于性能特征分析

#### 峰值负载 (spike)

- 正常负载间歇性峰值
- 适用于突发负载处理

#### 随机负载 (random)

- 随机变化的并发数
- 适用于真实场景模拟

#### 正弦负载 (sinusoidal)

- 周期性波形负载
- 适用于潮汐流量模拟

### 压力测试类型

#### 过载测试 (overload)

- 逐渐增加负载直到系统失败
- 确定系统最大承受能力

#### 内存压力测试 (memory_pressure)

- 监控内存使用和泄漏
- 检测内存管理问题

#### 磁盘I/O测试 (disk_io)

- 测试磁盘读写性能
- 检测I/O瓶颈

#### 网络饱和测试 (network_saturation)

- 测试网络带宽限制
- 检测网络相关问题

#### 混合负载测试 (mixed_workload)

- 同时运行多种操作类型
- 检测资源竞争问题

#### 级联故障测试 (cascading_failure)

- 模拟故障传播场景
- 测试系统容错能力

## 结果分析

### 性能指标

```javascript
{
  "throughput": 1250.5,        // 操作/秒
  "avgLatency": 45.2,          // 平均延迟(ms)
  "p95Latency": 120.5,         // 95%分位延迟(ms)
  "p99Latency": 250.8,         // 99%分位延迟(ms)
  "errorRate": 0.5,            // 错误率(%)
  "concurrency": 50,            // 并发数
  "efficiency": 0.85            // 扩展效率
}
```

### 瓶颈识别

系统自动识别以下类型的瓶颈：

1. **扩展效率低下**: 增加并发数时性能提升不明显
2. **高错误率**: 错误率超过阈值
3. **内存泄漏**: 内存使用持续增长
4. **I/O阻塞**: 磁盘或网络I/O成为瓶颈
5. **资源竞争**: CPU、内存、锁竞争

### 建议生成

基于测试结果自动生成优化建议：

```javascript
[
  {
    type: 'performance_optimization',
    priority: 'high',
    message: '数据库查询响应时间过长',
    actions: ['添加数据库索引', '优化查询语句', '实现查询缓存'],
  },
  {
    type: 'capacity_planning',
    priority: 'medium',
    message: '系统在50并发时达到性能拐点',
    actions: ['考虑水平扩展', '优化资源分配', '增加缓存层'],
  },
];
```

## 配置选项

### 基准测试配置

```javascript
const benchmark = new PerformanceBenchmark({
  warmupIterations: 100, // 预热迭代次数
  measurementIterations: 1000, // 测量迭代次数
  concurrencyLevels: [1, 5, 10, 25, 50, 100], // 并发级别
  duration: 30000, // 测试持续时间(ms)
  percentiles: [50, 90, 95, 99, 99.9], // 计算的百分位数
  enableGc: true, // 启用GC监控
  collectMemoryStats: true, // 收集内存统计
});
```

### 负载测试配置

```javascript
const loadTester = new LoadTester({
  duration: 300000, // 测试持续时间
  targetConcurrency: 100, // 目标并发数
  monitoring: {
    enabled: true, // 启用监控
    interval: 5000, // 监控间隔
    cpu: true, // CPU监控
    memory: true, // 内存监控
    custom: {}, // 自定义监控
  },
});
```

### 压力测试配置

```javascript
const stressTester = new StressTester({
  duration: 300000, // 压力测试持续时间
  targetConcurrency: 100, // 基础并发数
  monitoring: {
    enabled: true,
    interval: 2000,
    cpu: true,
    memory: true,
  },
  failureThresholds: {
    maxErrorRate: 20, // 最大错误率(%)
    maxLatency: 5000, // 最大延迟(ms)
    maxMemoryUsage: 0.85, // 最大内存使用率
    minThroughput: 10, // 最小吞吐量
  },
});
```

## 监控和告警

### 实时监控

系统在测试过程中实时监控：

- **系统指标**: CPU使用率、内存使用率、磁盘I/O、网络I/O
- **应用指标**: 响应时间、吞吐量、错误率、并发连接数
- **业务指标**: 自定义业务指标

### 自动告警

当检测到以下情况时自动触发告警：

1. **性能下降**: 响应时间超出阈值
2. **错误率上升**: 错误率超过设定值
3. **资源耗尽**: CPU/内存使用率过高
4. **容量不足**: 无法处理目标负载

### 趋势分析

系统提供历史对比和趋势分析：

- **性能趋势**: 吞吐量、延迟的变化趋势
- **稳定性分析**: 性能波动和异常检测
- **容量规划**: 基于历史数据预测容量需求

## 集成和扩展

### CI/CD集成

```yaml
# .github/workflows/performance.yml
name: Performance Tests
on: [push, pull_request]

jobs:
  performance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run Performance Tests
        run: npm run benchmark:ci
      - name: Upload Results
        uses: actions/upload-artifact@v2
        with:
          name: benchmark-results
          path: ./benchmark-results/
```

### 自定义测试扩展

```javascript
// 自定义测试类型
class CustomPerformanceTest extends PerformanceBenchmark {
  async runCustomTest(config) {
    // 实现自定义测试逻辑
    return super.runBenchmarkSuite('custom', [config]);
  }
}

// 自定义监控指标
class CustomMonitor extends EventEmitter {
  startMonitoring() {
    // 实现自定义监控逻辑
    this.interval = setInterval(() => {
      const metrics = this.collectCustomMetrics();
      this.emit('metrics', metrics);
    }, 1000);
  }
}
```

### 第三方工具集成

系统支持与以下工具集成：

- **APM工具**: New Relic, DataDog, AppDynamics
- **监控工具**: Prometheus, Grafana
- **日志工具**: ELK Stack, Splunk
- **负载生成器**: JMeter, Artillery, k6

## 最佳实践

### 1. 测试环境准备

- 使用生产类似的环境配置
- 确保充足的系统资源
- 预热系统和数据
- 清理测试数据

### 2. 测试策略

- 从小规模测试开始
- 渐进式增加负载
- 多次运行以确保一致性
- 监控系统资源使用情况

### 3. 结果解读

- 关注95%和99%分位延迟
- 分析错误率和故障模式
- 识别性能拐点
- 考虑业务影响

### 4. 持续监控

- 定期运行性能测试
- 监控生产环境性能
- 设置性能预算
- 自动化性能回归测试

### 5. 容量规划

- 基于测试结果规划容量
- 预留性能缓冲区
- 制定扩容策略
- 监控容量使用情况

通过这套完整的性能基准测试系统，frys能够全面评估系统性能，识别瓶颈，制定优化策略，确保在各种负载条件下的稳定运行。
