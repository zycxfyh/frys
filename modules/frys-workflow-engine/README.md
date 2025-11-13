# Frys Workflow Engine (frys-workflow-engine)

Frys Workflow Engine 是系统的核心业务引擎，提供了高性能、可扩展的工作流执行能力。它支持AI增强的决策、并发执行、实时监控和可视化设计。

## 🎯 设计理念

**AI增强的工作流引擎，重新定义自动化流程的执行方式**

### 核心特性
- **🤖 AI原生**: 内置AI推理和决策能力
- **⚡ 高并发**: 支持数万个并发工作流实例
- **🎨 可视化**: 拖拽式工作流设计器
- **📊 实时监控**: 完整的执行状态追踪
- **🔄 动态调整**: 运行时工作流修改
- **🛡️ 容错性**: 自动故障恢复和补偿机制

### 架构优势
- **性能极致**: Rust实现的原生性能
- **扩展无限**: 插件化节点和连接器
- **智能决策**: AI驱动的路径选择和优化
- **监控全面**: 端到端的可观测性
- **开发友好**: 声明式API和可视化工具

## 🏗️ 架构设计

```
frys-workflow-engine/
├── Core Engine           # 🏭 核心执行引擎
│   ├── Workflow Parser      # 工作流解析器
│   ├── Execution Runtime    # 执行运行时
│   ├── State Manager        # 状态管理器
│   └── Error Handler        # 错误处理器
├── AI Enhancement       # 🤖 AI增强模块
│   ├── Decision Engine     # 决策引擎
│   ├── Prediction Model    # 预测模型
│   ├── Optimization Agent  # 优化代理
│   └── Learning System     # 学习系统
├── Visual Designer      # 🎨 可视化设计器
│   ├── Canvas Renderer    # 画布渲染器
│   ├── Node Library       # 节点库
│   ├── Connection Manager  # 连接管理器
│   └── Property Editor    # 属性编辑器
├── Monitoring System    # 📊 监控系统
│   ├── Execution Tracker   # 执行追踪器
│   ├── Performance Metrics # 性能指标
│   ├── Alert Manager      # 告警管理器
│   └── Analytics Engine   # 分析引擎
└── Plugin Ecosystem    # 🔌 插件生态
    ├── Node Plugins       # 节点插件
    ├── Connector Plugins  # 连接器插件
    ├── Action Plugins     # 动作插件
    └── Integration Plugins# 集成插件
```

## 🚀 快速开始

### 基本使用

```rust
use frys_workflow_engine::*;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 创建工作流引擎
    let engine = WorkflowEngine::new(WorkflowEngineConfig {
        max_concurrent_workflows: 1000,
        max_concurrent_tasks: 100,
        execution_timeout: Duration::from_secs(3600),
        enable_ai_enhancement: true,
        enable_monitoring: true,
    }).await?;

    // 定义工作流
    let workflow = Workflow::builder("data_processing_pipeline")
        .description("AI增强的数据处理流水线")

        // 输入节点
        .add_node(WorkflowNode {
            id: "input".to_string(),
            node_type: WorkflowNodeType::Start,
            position: Position { x: 100.0, y: 100.0 },
            data: NodeData {
                label: "数据输入".to_string(),
                config: serde_json::json!({
                    "source": "database",
                    "table": "user_data"
                }),
            },
        })

        // AI分析节点
        .add_node(WorkflowNode {
            id: "ai_analysis".to_string(),
            node_type: WorkflowNodeType::Task,
            position: Position { x: 300.0, y: 100.0 },
            data: NodeData {
                label: "AI情感分析".to_string(),
                config: serde_json::json!({
                    "model": "bert-sentiment",
                    "threshold": 0.8
                }),
            },
        })

        // 决策节点
        .add_node(WorkflowNode {
            id: "decision".to_string(),
            node_type: WorkflowNodeType::Decision,
            position: Position { x: 500.0, y: 100.0 },
            data: NodeData {
                label: "情感决策".to_string(),
                config: serde_json::json!({
                    "condition": "sentiment_score > 0.8"
                }),
            },
        })

        // 动作节点
        .add_node(WorkflowNode {
            id: "positive_action".to_string(),
            node_type: WorkflowNodeType::Task,
            position: Position { x: 700.0, y: 50.0 },
            data: NodeData {
                label: "积极反馈".to_string(),
                config: serde_json::json!({
                    "action": "send_positive_email"
                }),
            },
        })

        .add_node(WorkflowNode {
            id: "negative_action".to_string(),
            node_type: WorkflowNodeType::Task,
            position: Position { x: 700.0, y: 150.0 },
            data: NodeData {
                label: "改进建议".to_string(),
                config: serde_json::json!({
                    "action": "send_improvement_email"
                }),
            },
        })

        // 结束节点
        .add_node(WorkflowNode {
            id: "end".to_string(),
            node_type: WorkflowNodeType::End,
            position: Position { x: 900.0, y: 100.0 },
            data: NodeData {
                label: "流程结束".to_string(),
                config: serde_json::json!({}),
            },
        })

        // 定义连接
        .add_edge(WorkflowEdge {
            id: "input-analysis".to_string(),
            source: "input".to_string(),
            target: "ai_analysis".to_string(),
        })

        .add_edge(WorkflowEdge {
            id: "analysis-decision".to_string(),
            source: "ai_analysis".to_string(),
            target: "decision".to_string(),
        })

        .add_edge(WorkflowEdge {
            id: "decision-positive".to_string(),
            source: "decision".to_string(),
            target: "positive_action".to_string(),
            data: Some(EdgeData {
                condition: Some("sentiment_score > 0.8".to_string()),
            }),
        })

        .add_edge(WorkflowEdge {
            id: "decision-negative".to_string(),
            source: "decision".to_string(),
            target: "negative_action".to_string(),
            data: Some(EdgeData {
                condition: Some("sentiment_score <= 0.8".to_string()),
            }),
        })

        .add_edge(WorkflowEdge {
            id: "positive-end".to_string(),
            source: "positive_action".to_string(),
            target: "end".to_string(),
        })

        .add_edge(WorkflowEdge {
            id: "negative-end".to_string(),
            source: "negative_action".to_string(),
            target: "end".to_string(),
        })

        .build();

    // 注册工作流
    engine.register_workflow(workflow).await?;

    // 启动工作流实例
    let instance = engine.start_workflow_instance(
        "data_processing_pipeline",
        serde_json::json!({
            "user_id": "user123",
            "data": "I love this product! It's amazing."
        })
    ).await?;

    println!("Workflow instance started: {}", instance.id);

    // 监控执行状态
    let status = engine.get_instance_status(&instance.id).await?;
    println!("Current status: {:?}", status);

    Ok(())
}
```

### AI增强的工作流

```rust
// AI驱动的动态决策
let ai_decision_node = WorkflowNode {
    id: "ai_decision".to_string(),
    node_type: WorkflowNodeType::AIDecision,
    data: NodeData {
        label: "AI智能决策".to_string(),
        config: serde_json::json!({
            "model": "decision-tree-classifier",
            "features": ["sentiment_score", "urgency_level", "customer_value"],
            "threshold": 0.85
        }),
    },
};

// 预测性执行
let predictive_node = WorkflowNode {
    id: "predictive_action".to_string(),
    node_type: WorkflowNodeType::PredictiveTask,
    data: NodeData {
        label: "预测性执行".to_string(),
        config: serde_json::json!({
            "model": "time-series-forecast",
            "prediction_window": "7d",
            "confidence_threshold": 0.9
        }),
    },
};
```

### 实时监控

```rust
// 订阅工作流事件
engine.subscribe_events("workflow.*", |event| {
    match event.event_type.as_str() {
        "workflow.started" => {
            println!("Workflow {} started", event.instance_id);
        }
        "workflow.completed" => {
            println!("Workflow {} completed successfully", event.instance_id);
        }
        "workflow.failed" => {
            println!("Workflow {} failed: {:?}", event.instance_id, event.data);
        }
        "node.executed" => {
            let node_id = event.data["node_id"].as_str().unwrap_or("unknown");
            let duration = event.data["duration_ms"].as_u64().unwrap_or(0);
            println!("Node {} executed in {}ms", node_id, duration);
        }
        _ => {}
    }
}).await?;
```

## 🎨 可视化设计器

### 前端集成

```typescript
// React组件集成
import { WorkflowDesigner } from 'frys-workflow-designer';

function App() {
  const [workflow, setWorkflow] = useState(null);

  return (
    <div style={{ height: '100vh' }}>
      <WorkflowDesigner
        workflow={workflow}
        onWorkflowChange={setWorkflow}
        nodeTypes={{
          aiInference: AIInferenceNode,
          decision: DecisionNode,
          apiCall: ApiCallNode,
          dataTransform: DataTransformNode,
        }}
        plugins={[
          'ai-enhancement',
          'performance-monitoring',
          'error-recovery',
        ]}
      />
    </div>
  );
}
```

### 自定义节点开发

```typescript
// 自定义AI节点
const AINode = {
  type: 'ai-inference',
  label: 'AI推理',
  icon: '🤖',
  category: 'AI',
  inputs: [
    { id: 'input', label: '输入数据', type: 'any' }
  ],
  outputs: [
    { id: 'output', label: '推理结果', type: 'any' },
    { id: 'confidence', label: '置信度', type: 'number' }
  ],
  configSchema: {
    model: { type: 'string', required: true },
    parameters: { type: 'object' },
    threshold: { type: 'number', default: 0.8 }
  },
  execute: async (inputs, config) => {
    // 调用AI推理服务
    const result = await aiService.infer(config.model, inputs.input, config.parameters);

    return {
      output: result.data,
      confidence: result.confidence
    };
  }
};
```

## 📊 监控和分析

### 执行指标收集

```rust
// 自动收集的指标
let metrics = engine.get_metrics().await?;

println!("Active workflows: {}", metrics.active_workflows);
println!("Completed workflows: {}", metrics.completed_workflows);
println!("Failed workflows: {}", metrics.failed_workflows);
println!("Average execution time: {}ms", metrics.avg_execution_time);
println!("Success rate: {:.2}%", metrics.success_rate * 100.0);
println!("Throughput: {:.2} workflows/min", metrics.throughput_per_minute);
```

### 性能分析

```rust
// 工作流性能分析
let analysis = engine.analyze_performance("my-workflow").await?;

println!("Bottlenecks:");
for bottleneck in analysis.bottlenecks {
    println!("  - {}: {}ms (avg)", bottleneck.node_id, bottleneck.avg_duration);
}

println!("Optimization suggestions:");
for suggestion in analysis.suggestions {
    println!("  - {}", suggestion);
}
```

### 实时仪表板

```rust
// 创建监控仪表板
let dashboard = MonitoringDashboard::new()
    .add_chart("workflow_throughput", ChartType::Line, "Workflows per Minute")
    .add_chart("execution_time", ChartType::Histogram, "Execution Time Distribution")
    .add_chart("error_rate", ChartType::Gauge, "Error Rate")
    .add_alert("high_error_rate", "error_rate > 0.05", AlertSeverity::Warning)
    .build();

engine.register_dashboard(dashboard).await?;
```

## 🔧 插件系统

### 节点插件开发

```rust
#[async_trait]
pub trait WorkflowNodePlugin: Send + Sync {
    fn node_type(&self) -> &str;
    fn name(&self) -> &str;
    fn description(&self) -> &str;

    async fn validate_config(&self, config: &serde_json::Value) -> Result<()>;
    async fn execute(&self, context: ExecutionContext) -> Result<serde_json::Value>;
    fn input_schema(&self) -> serde_json::Value;
    fn output_schema(&self) -> serde_json::Value;
}

// HTTP请求节点插件
pub struct HttpRequestNode {
    client: reqwest::Client,
}

#[async_trait]
impl WorkflowNodePlugin for HttpRequestNode {
    fn node_type(&self) -> &str { "http-request" }
    fn name(&self) -> &str { "HTTP Request" }
    fn description(&self) -> &str { "Make HTTP requests to external APIs" }

    async fn execute(&self, context: ExecutionContext) -> Result<serde_json::Value> {
        let config = context.config.as_object().unwrap();

        let method = config["method"].as_str().unwrap_or("GET");
        let url = config["url"].as_str().unwrap();
        let headers = config["headers"].as_object().unwrap_or(&serde_json::Map::new());
        let body = config["body"].as_str();

        let mut request = self.client.request(
            reqwest::Method::from_bytes(method.as_bytes())?,
            url
        );

        for (key, value) in headers {
            if let Some(value_str) = value.as_str() {
                request = request.header(key, value_str);
            }
        }

        if let Some(body) = body {
            request = request.body(body.to_string());
        }

        let response = request.send().await?;
        let status = response.status();
        let body = response.text().await?;

        Ok(serde_json::json!({
            "status": status.as_u16(),
            "headers": {}, // Simplified
            "body": body
        }))
    }
}
```

### 连接器插件

```rust
#[async_trait]
pub trait WorkflowConnectorPlugin: Send + Sync {
    fn connector_type(&self) -> &str;
    async fn connect(&self, source: &WorkflowNode, target: &WorkflowNode) -> Result<Connection>;
    async fn transfer(&self, connection: &Connection, data: serde_json::Value) -> Result<serde_json::Value>;
}

// 条件连接器
pub struct ConditionalConnector;

#[async_trait]
impl WorkflowConnectorPlugin for ConditionalConnector {
    fn connector_type(&self) -> &str { "conditional" }

    async fn transfer(&self, connection: &Connection, data: serde_json::Value) -> Result<serde_json::Value> {
        let condition = connection.config["condition"].as_str()
            .ok_or_else(|| WorkflowError::InvalidConfiguration("Missing condition".to_string()))?;

        // 简单的条件评估 (生产环境中应该使用更强大的表达式引擎)
        let result = evaluate_condition(condition, &data)?;

        if result {
            Ok(data)
        } else {
            Err(WorkflowError::ConditionNotMet)
        }
    }
}
```

## 🧪 测试和验证

### 单元测试

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_simple_workflow_execution() {
        let engine = WorkflowEngine::new(Default::default()).await.unwrap();

        let workflow = create_test_workflow();
        engine.register_workflow(workflow).await.unwrap();

        let instance = engine.start_workflow_instance(
            "test-workflow",
            serde_json::json!({"input": "test"})
        ).await.unwrap();

        // 等待执行完成
        tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;

        let status = engine.get_instance_status(&instance.id).await.unwrap();
        assert_eq!(status, WorkflowStatus::Completed);
    }

    #[tokio::test]
    async fn test_ai_enhanced_decision() {
        let engine = WorkflowEngine::new(WorkflowEngineConfig {
            enable_ai_enhancement: true,
            ..Default::default()
        }).await.unwrap();

        let workflow = create_ai_workflow();
        engine.register_workflow(workflow).await.unwrap();

        let instance = engine.start_workflow_instance(
            "ai-workflow",
            serde_json::json!({"text": "This product is amazing!"})
        ).await.unwrap();

        tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;

        let result = engine.get_instance_result(&instance.id).await.unwrap();
        let sentiment = result["sentiment"].as_str().unwrap();
        assert_eq!(sentiment, "positive");
    }
}
```

### 集成测试

```rust
#[cfg(test)]
mod integration_tests {
    use super::*;
    use frys_kernel::FrysKernel;

    #[tokio::test]
    async fn test_full_workflow_lifecycle() {
        // 启动完整系统
        let kernel = FrysKernel::new(Default::default()).await.unwrap();
        kernel.load_plugin("workflow-engine").await.unwrap();

        let engine = WorkflowEngine::from_kernel(&kernel).await.unwrap();

        // 创建复杂的工作流
        let workflow = create_complex_workflow();
        engine.register_workflow(workflow).await.unwrap();

        // 并发执行多个实例
        let mut handles = vec![];
        for i in 0..10 {
            let engine_clone = engine.clone();
            let handle = tokio::spawn(async move {
                let instance = engine_clone.start_workflow_instance(
                    "complex-workflow",
                    serde_json::json!({ "iteration": i })
                ).await.unwrap();

                // 监控执行进度
                loop {
                    let status = engine_clone.get_instance_status(&instance.id).await.unwrap();
                    if status == WorkflowStatus::Completed || status == WorkflowStatus::Failed {
                        break;
                    }
                    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
                }

                instance.id
            });
            handles.push(handle);
        }

        // 等待所有实例完成
        for handle in handles {
            let instance_id = handle.await.unwrap();
            let status = engine.get_instance_status(&instance_id).await.unwrap();
            assert_eq!(status, WorkflowStatus::Completed);
        }

        kernel.shutdown().await.unwrap();
    }
}
```

## 📊 性能基准测试

### 基准测试结果

| 场景 | 并发数 | 吞吐量 | 平均延迟 | P95延迟 | P99延迟 |
|------|--------|--------|----------|---------|---------|
| 简单工作流 | 100 | 1250 ops/s | 45ms | 120ms | 200ms |
| AI增强工作流 | 50 | 380 ops/s | 180ms | 450ms | 800ms |
| 复杂业务流程 | 25 | 180 ops/s | 320ms | 750ms | 1200ms |

### 性能优化建议

```rust
// 性能配置调优
let config = WorkflowEngineConfig {
    // 内存优化
    max_concurrent_workflows: 1000,
    max_concurrent_tasks: 100,
    workflow_cache_size: 100,

    // 执行优化
    enable_parallel_execution: true,
    enable_ai_caching: true,
    enable_result_caching: true,

    // 监控优化
    enable_metrics: true,
    metrics_interval: Duration::from_secs(5),
    enable_tracing: true,
};
```

## 🚀 部署和扩展

### 单机部署

```yaml
# Docker Compose
version: '3.8'
services:
  frys-workflow-engine:
    image: frys-workflow-engine:latest
    ports:
      - "8080:8080"
    environment:
      - FRYS_WORKFLOW_MAX_CONCURRENT=1000
      - FRYS_AI_ENABLED=true
    volumes:
      - ./config:/app/config:ro
```

### 集群部署

```yaml
# Kubernetes Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frys-workflow-engine
spec:
  replicas: 3
  selector:
    matchLabels:
      app: workflow-engine
  template:
    spec:
      containers:
      - name: workflow-engine
        image: frys-workflow-engine:latest
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "2000m"
        env:
        - name: FRYS_WORKFLOW_MAX_CONCURRENT
          value: "2000"
        - name: FRYS_AI_ENABLED
          value: "true"
        ports:
        - containerPort: 8080
```

### 水平扩展

```rust
// 自动扩缩容配置
let scaler = AutoScaler::new(AutoScalerConfig {
    min_instances: 3,
    max_instances: 20,
    scale_up_threshold: 0.8,    // CPU > 80%
    scale_down_threshold: 0.3,  // CPU < 30%
    cooldown_period: Duration::from_secs(300),
    metrics_provider: prometheus_metrics,
}).await?;
```

## 🔧 配置和调优

### 环境变量配置

```bash
# 基础配置
export FRYS_WORKFLOW_MAX_CONCURRENT=1000
export FRYS_WORKFLOW_EXECUTION_TIMEOUT=3600
export FRYS_WORKFLOW_CACHE_SIZE=100

# AI增强配置
export FRYS_AI_ENABLED=true
export FRYS_AI_MODEL_CACHE_SIZE=50
export FRYS_AI_INFERENCE_TIMEOUT=300

# 监控配置
export FRYS_MONITORING_ENABLED=true
export FRYS_METRICS_INTERVAL=5
export FRYS_TRACING_ENABLED=true

# 插件配置
export FRYS_PLUGIN_PATHS="/app/plugins"
export FRYS_PLUGIN_AUTO_LOAD=true
```

### 动态配置

```rust
// 运行时配置更新
engine.update_config(WorkflowConfigUpdate {
    max_concurrent_workflows: Some(1500),
    enable_ai_enhancement: Some(false),
    monitoring_level: Some(MonitoringLevel::Detailed),
}).await?;
```

## 🐛 故障排除

### 常见问题

#### 工作流执行卡住
```
原因: 节点依赖未满足或死锁
解决:
1. 检查工作流定义的依赖关系
2. 启用死锁检测: --enable-deadlock-detection true
3. 增加执行超时: --execution-timeout 7200
```

#### AI推理失败
```
原因: 模型加载失败或推理超时
解决:
1. 检查AI服务连接: --ai-service-url http://ai-service:8080
2. 增加推理超时: --ai-inference-timeout 600
3. 启用重试机制: --ai-retry-enabled true
```

#### 内存不足
```
原因: 并发工作流过多或内存泄漏
解决:
1. 减少并发数: --max-concurrent-workflows 500
2. 启用内存监控: --enable-memory-monitoring true
3. 增加实例内存: resources.limits.memory=4Gi
```

## 📚 API参考

### REST API

```http
# 创建工作流
POST /api/v1/workflows
Content-Type: application/json

{
  "name": "my-workflow",
  "nodes": [...],
  "edges": [...]
}

# 启动工作流实例
POST /api/v1/workflows/{workflow-id}/instances
Content-Type: application/json

{
  "context": {...}
}

# 获取实例状态
GET /api/v1/instances/{instance-id}

# 获取执行结果
GET /api/v1/instances/{instance-id}/results
```

### WebSocket API

```javascript
// 连接到工作流引擎
const ws = new WebSocket('ws://localhost:8080/ws/workflows');

// 订阅工作流事件
ws.send(JSON.stringify({
  type: 'subscribe',
  pattern: 'workflow.*'
}));

// 接收事件
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Workflow event:', data);
};
```

## 🤝 贡献

### 开发指南
1. Fork 本仓库
2. 创建功能分支: `git checkout -b feature/new-workflow-node`
3. 编写代码和测试
4. 运行测试: `cargo test`
5. 提交PR

### 插件开发
1. 实现 `WorkflowNodePlugin` trait
2. 添加插件配置文件
3. 编写插件文档
4. 提交到插件仓库

## 📄 许可证

MIT License - 详见 [LICENSE](../../LICENSE) 文件