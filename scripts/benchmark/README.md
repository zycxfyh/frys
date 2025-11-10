# frys 性能基准测试工具

这是一套全面的性能基准测试工具，用于评估frys项目的性能表现和识别性能瓶颈。

## 功能特性

### 🚀 全面性能评估
- **启动时间测试**：测量应用启动性能
- **内存使用分析**：监控内存消耗模式
- **CPU性能测试**：评估计算密集型操作
- **算法性能测试**：比较各种算法实现
- **基础设施测试**：评估核心组件性能
- **并发负载测试**：测试高并发场景

### 📊 详细性能指标
- 平均响应时间、P95延迟
- 内存峰值使用、内存泄漏检测
- CPU使用率、吞吐量
- 算法复杂度分析
- 基础设施组件效率

### 🔄 基准线比较
- 自动保存性能基准线
- 性能退化检测和报警
- 历史性能趋势分析
- 跨版本性能对比

## 快速开始

### 运行完整性能测试

```bash
# 运行所有基准测试（默认5次迭代）
node scripts/benchmark/performance-benchmark-runner.js

# 自定义迭代次数
node scripts/benchmark/performance-benchmark-runner.js --iterations 10

# 指定输出目录
node scripts/benchmark/performance-benchmark-runner.js --output ./my-results

# 详细输出模式
node scripts/benchmark/performance-benchmark-runner.js --verbose
```

### 运行特定测试模块

```bash
# 仅运行算法性能测试
node -e "
import('./scripts/benchmark/algorithm-benchmarks.js').then(async ({default: AlgorithmBenchmarks}) => {
  const benchmarks = new AlgorithmBenchmarks();
  const results = await benchmarks.runAllBenchmarks();
  console.log('算法测试完成:', results);
})
"

# 仅运行基础设施测试
node -e "
import('./scripts/benchmark/infrastructure-benchmarks.js').then(async ({default: InfrastructureBenchmarks}) => {
  const benchmarks = new InfrastructureBenchmarks();
  const results = await benchmarks.runAllBenchmarks();
  console.log('基础设施测试完成:', results);
})
"
```

## 测试结果解读

### 性能指标说明

#### 启动时间测试
- **平均时间**：< 1000ms 为良好性能
- **P95延迟**：反映最坏情况下的启动时间
- **内存使用**：启动时的内存消耗

#### 内存使用分析
- **RSS峰值**：< 500MB 为良好，< 1000MB 为可接受
- **堆使用率**：关注内存泄漏模式
- **外部内存**：Buffer和C++对象使用情况

#### CPU性能测试
- **平均时间**：< 500ms 为良好性能
- **计算密度**：每秒执行的操作数

#### 算法性能测试
- **时间复杂度**：O(n), O(n log n), O(n²) 等
- **空间复杂度**：内存使用效率
- **实际性能**：不同数据规模下的表现

#### 基础设施测试
- **配置管理器**：读取/写入操作的延迟
- **日志系统**：不同级别日志的性能
- **缓存系统**：命中率和访问延迟
- **事件系统**：发布/订阅的吞吐量

#### 并发测试
- **最大并发数**：系统能处理的并发请求数
- **吞吐量**：每秒处理的请求数
- **响应时间**：并发场景下的延迟

## 输出文件结构

```
scripts/benchmark/results/
├── benchmark-[timestamp].json    # 详细测试结果
├── latest-summary.json           # 最新总结报告
└── baseline.json                 # 性能基准线
```

### 结果文件格式

```json
{
  "timestamp": "2025-01-10T15:30:00.000Z",
  "environment": {
    "nodeVersion": "v20.19.5",
    "platform": "win32",
    "cpuCount": 8,
    "totalMemory": 17179869184
  },
  "benchmarks": {
    "startup": {
      "average": 245.67,
      "p95": 312.45,
      "memoryUsage": [...]
    },
    "memory": {
      "peakRssMB": 487.23,
      "averageHeapUsedMB": 234.56
    },
    "algorithms": {
      "sorting": {
        "1000": {
          "Array.sort": { "average": 0.234, "p95": 0.312 },
          "Quick Sort": { "average": 0.456, "p95": 0.523 }
        }
      }
    }
  },
  "summary": {
    "overall": { "totalBenchmarks": 6 },
    "metrics": {
      "startupTime": { "average": 245.67, "status": "good" },
      "memoryUsage": { "peakRssMB": 487.23, "status": "good" },
      "cpuPerformance": { "averageTime": 123.45, "status": "good" }
    }
  }
}
```

## 性能优化建议

### 🚀 启动时间优化
- 使用代码分割和延迟加载
- 优化依赖加载顺序
- 缓存频繁使用的模块

### 💾 内存优化
- 检测和修复内存泄漏
- 使用流式处理大文件
- 优化对象创建模式

### ⚡ CPU优化
- 使用更高效的算法
- 避免不必要的计算
- 利用多核并行处理

### 🏗️ 基础设施优化
- 优化数据库查询
- 使用高效的缓存策略
- 优化日志输出格式

## CI/CD集成

### GitHub Actions配置

```yaml
# .github/workflows/performance.yml
name: Performance Benchmark
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  benchmark:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run performance benchmarks
        run: node scripts/benchmark/performance-benchmark-runner.js --iterations 3

      - name: Upload benchmark results
        uses: actions/upload-artifact@v4
        with:
          name: benchmark-results
          path: scripts/benchmark/results/
```

## 故障排除

### 常见问题

#### 测试运行缓慢
- 减少迭代次数：`--iterations 3`
- 跳过某些测试模块

#### 内存不足错误
- 增加Node.js内存限制：`node --max-old-space-size=4096`
- 减少测试数据规模

#### 网络测试失败
- 基础设施测试中的HTTP客户端测试需要网络连接
- 使用mock服务器进行本地测试

### 调试模式

```bash
# 启用详细日志
DEBUG=benchmark node scripts/benchmark/performance-benchmark-runner.js --verbose

# 只运行特定测试
node -e "
import('./scripts/benchmark/algorithm-benchmarks.js').then(async ({default: AlgorithmBenchmarks}) => {
  const benchmarks = new AlgorithmBenchmarks({ iterations: 1 });
  console.log('开始调试...');
  const results = await benchmarks.benchmarkSortingAlgorithms();
  console.log('调试结果:', results);
})
"
```

## 贡献指南

### 添加新的基准测试

1. 在相应模块中实现新的测试方法
2. 更新结果格式和文档
3. 添加适当的错误处理
4. 更新CI/CD配置

### 基准线管理

```bash
# 更新基准线
cp scripts/benchmark/results/latest-summary.json scripts/benchmark/baseline.json

# 比较性能变化
node scripts/benchmark/performance-benchmark-runner.js --compare
```

## 许可证

本项目采用MIT许可证。
