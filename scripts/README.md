# frys 测试工具套件

frys 提供了完整的工业级测试工具套件，用于确保系统在各种条件下的稳定性和性能。

## 🧪 测试工具概览

| 工具                         | 功能           | 使用场景           |
| ---------------------------- | -------------- | ------------------ |
| `run-industrial-tests.js`    | 工业级测试套件 | 全面的质量保证测试 |
| `performance-monitor.js`     | 性能监控工具   | 实时性能指标监控   |
| `load-generator.js`          | 负载生成器     | 压力测试和负载测试 |
| `e2e-test-framework.js`      | 端到端测试框架 | 用户完整旅程测试   |
| `run-comprehensive-tests.js` | 综合测试运行器 | 一键运行所有测试   |

## 🚀 快速开始

### 1. 环境准备

确保你已经安装了所有依赖：

```bash
npm install
```

设置必要的环境变量：

```bash
# AI服务配置（可选，用于完整功能测试）
export OPENAI_API_KEY="your-openai-key"
export COGNEE_API_KEY="your-cognee-key"

# 数据库和其他服务配置
export DB_HOST="localhost"
export REDIS_HOST="localhost"
```

### 2. 运行完整测试套件

```bash
# 运行所有测试（推荐）
node scripts/run-comprehensive-tests.js

# 或者分别运行各个测试
```

## 📋 详细使用指南

### 工业级测试套件

运行全面的质量保证测试：

```bash
# 基本运行
node scripts/run-industrial-tests.js

# 自定义配置
NODE_ENV=production node scripts/run-industrial-tests.js
```

**测试内容：**

- ✅ 基础功能测试
- ✅ AI服务集成测试
- ✅ API端点测试
- ✅ 性能测试
- ✅ 并发测试
- ✅ 可靠性测试
- ✅ 端到端测试
- ✅ 压力测试

**输出：**

- 控制台实时日志
- JSON详细报告：`reports/industrial-test-report.json`
- HTML可视化报告：`reports/industrial-test-report.html`

### 性能监控工具

实时监控系统性能指标：

```bash
# 监控本地服务器
node scripts/performance-monitor.js --server 3000

# 自定义监控参数
node scripts/performance-monitor.js \
  --interval 2000 \
  --duration 120000 \
  --output logs/custom-performance.jsonl

# 仅监控Node.js进程
node scripts/performance-monitor.js
```

**监控指标：**

- 📊 内存使用情况（RSS、堆使用、外部内存）
- ⚡ CPU使用率
- 🔄 事件循环延迟
- 🖥️ 系统信息
- 🔧 活跃句柄和请求

**输出：**

- 实时控制台显示
- JSON Lines格式数据文件
- HTML性能分析报告

### 负载生成器

模拟用户负载进行压力测试：

```bash
# 快速测试（10秒，5并发）
node scripts/load-generator.js http://localhost:3000 --quick

# 标准负载测试
node scripts/load-generator.js http://localhost:3000 \
  --duration 60000 \
  --concurrency 50 \
  --ramp-up 10000

# 压力测试（逐步增加并发数）
node scripts/load-generator.js http://localhost:3000 --stress
```

**测试模式：**

- 🌐 健康检查请求
- 🤖 AI对话创建
- 💬 消息发送
- 📚 历史查询
- 🧠 记忆操作
- 🔗 LangChain调用

**输出：**

- 实时统计信息
- JSON详细报告：`reports/load-test-report.json`
- 压力测试报告：`reports/stress-test-report.json`

### 端到端测试框架

测试完整用户旅程：

```bash
# 基本E2E测试
node scripts/e2e-test-framework.js

# 自定义目标服务器
node scripts/e2e-test-framework.js \
  --base-url https://staging.yourapp.com \
  --timeout 30000

# 不截图模式
node scripts/e2e-test-framework.js --no-screenshots
```

**测试场景：**

- 🔐 用户注册和登录流程
- 🤖 AI对话完整流程
- 🧠 LangChain集成测试
- 💾 Cognee记忆系统测试
- 🌐 API健康检查
- ⚡ 性能基准测试

**输出：**

- 详细测试步骤日志
- JSON测试报告：`reports/e2e-test-report.json`
- HTML可视化报告：`reports/e2e-test-report.html`
- 屏幕截图：`screenshots/`（如果启用）

### 综合测试运行器

一键运行所有测试工具：

```bash
# 完整测试流程
node scripts/run-comprehensive-tests.js

# 指定目标服务器
node scripts/run-comprehensive-tests.js \
  --target-url https://your-api.com
```

**执行阶段：**

1. 🔧 环境准备
2. 🧹 代码质量检查
3. 🏗️ 构建和部署
4. 🏭 工业级测试
5. 📊 性能测试
6. 🔄 端到端测试
7. 💪 压力测试
8. 🧽 清理和报告

## 📊 报告和日志

### 报告文件结构

```
reports/
├── comprehensive-test-report.json     # 综合测试报告
├── comprehensive-test-report.html     # 综合测试HTML报告
├── industrial-test-report.json        # 工业级测试报告
├── industrial-test-report.html        # 工业级测试HTML报告
├── performance-report.json            # 性能分析报告
├── load-test-report.json             # 负载测试报告
├── stress-test-report.json           # 压力测试报告
├── e2e-test-report.json              # E2E测试报告
└── e2e-test-report.html              # E2E测试HTML报告

logs/
├── comprehensive-test.log            # 综合测试日志
├── server.log                        # 服务器日志
├── performance-metrics.jsonl         # 性能指标数据
└── ...

screenshots/                          # E2E测试截图
└── ...
```

### 日志级别

- 🟢 `INFO`: 正常操作信息
- 🟡 `WARN`: 警告信息
- 🔴 `ERROR`: 错误信息

## ⚙️ 配置和环境变量

### 必需环境变量

```bash
# AI服务（用于完整功能测试）
OPENAI_API_KEY=sk-your-key
COGNEE_API_KEY=your-cognee-key
COGNEE_PROJECT_ID=your-project-id

# 数据库
DB_HOST=localhost
DB_PORT=27017
DB_NAME=frys_test

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# 服务器
PORT=3000
NODE_ENV=test
```

### 可选环境变量

```bash
# 测试配置
TEST_TIMEOUT=30000
TEST_CONCURRENCY=10
PERFORMANCE_INTERVAL=1000

# AI配置
CONVERSATION_MAX_HISTORY=50
MEMORY_ENABLED=true
```

## 🔧 故障排除

### 常见问题

**Q: 测试失败，提示"服务器启动超时"**
A: 确保服务器可以正常启动，检查端口是否被占用

**Q: AI测试跳过，提示"API密钥未配置"**
A: 设置相应的AI服务环境变量，或使用模拟模式

**Q: 性能测试内存不足**
A: 增加Node.js内存限制：`node --max-old-space-size=4096 script.js`

**Q: E2E测试截图失败**
A: 确保系统安装了必要的图形库，或使用`--no-screenshots`选项

### 调试模式

启用详细日志：

```bash
DEBUG=frys:* node scripts/your-test.js
```

## 📈 性能基准

### 推荐配置

| 环境 | CPU | 内存 | 并发用户 | 响应时间 |
| ---- | --- | ---- | -------- | -------- |
| 开发 | 2核 | 4GB  | 10       | <500ms   |
| 测试 | 4核 | 8GB  | 50       | <200ms   |
| 生产 | 8核 | 16GB | 200      | <100ms   |

### 监控阈值

- ⚠️ 响应时间 > 1000ms：需要优化
- ⚠️ 错误率 > 5%：需要检查
- ⚠️ CPU使用率 > 80%：需要扩展
- ⚠️ 内存使用 > 85%：需要优化

## 🤝 贡献指南

### 添加新的测试工具

1. 在 `scripts/` 目录下创建新工具
2. 更新此README文档
3. 添加到综合测试运行器中
4. 编写相应的单元测试

### 测试标准

- ✅ 所有测试必须有详细的错误处理
- ✅ 生成结构化的JSON报告
- ✅ 提供HTML可视化报告
- ✅ 支持命令行参数配置
- ✅ 包含详细的使用说明

## 📞 支持

如果遇到问题，请：

1. 查看详细的日志文件
2. 检查报告中的错误信息
3. 查看[故障排除](#故障排除)部分
4. 提交Issue到GitHub

---

🎯 **frys测试工具套件** - 确保你的应用在任何规模下都能稳定运行！
