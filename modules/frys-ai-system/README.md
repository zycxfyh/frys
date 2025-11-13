# Frys AI System (frys-ai-system)

Frys AI System 是系统的AI推理引擎，提供了多模态AI能力、模型管理和智能缓存。它集成了Sira AI Gateway，支持多种AI模型和推理任务。

## 🎯 设计理念

**多模态AI推理平台，为业务系统提供强大的AI能力**

### 核心特性
- **🧠 多模态推理**: 支持文本、图像、音频等多种模态
- **🔄 动态模型加载**: 按需加载和卸载AI模型
- **💾 智能缓存**: 推理结果缓存和模型预热
- **⚖️ 负载均衡**: 多模型实例间的智能负载均衡
- **📊 性能监控**: 详细的推理性能指标和分析
- **🔒 安全隔离**: 模型推理的安全沙箱环境

### 架构优势
- **高性能**: GPU加速和模型优化
- **可扩展**: 支持大规模并发推理
- **灵活性**: 插件化模型和推理引擎
- **可靠性**: 自动故障转移和恢复
- **经济性**: 按需资源分配和成本优化

## 🏗️ 架构设计

```
frys-ai-system/
├── Core Engine           # 🧠 核心推理引擎
│   ├── Model Manager        # 模型管理器
│   ├── Inference Runtime    # 推理运行时
│   ├── Resource Scheduler   # 资源调度器
│   └── Cache Manager        # 缓存管理器
├── Multi-Modal Support  # 🎭 多模态支持
│   ├── Text Processing     # 文本处理
│   ├── Vision Processing   # 视觉处理
│   ├── Audio Processing    # 音频处理
│   └── Cross-Modal Fusion  # 跨模态融合
├── Sira Integration    # 🔗 Sira AI网关集成
│   ├── Gateway Client      # 网关客户端
│   ├── Load Balancer       # 负载均衡器
│   ├── Failover Manager    # 故障转移管理
│   └── Performance Monitor # 性能监控器
├── Intelligent Caching # 💡 智能缓存
│   ├── Result Cache        # 结果缓存
│   ├── Model Cache         # 模型缓存
│   ├── Embedding Cache     # 嵌入缓存
│   └── Cache Strategy      # 缓存策略
└── Plugin Ecosystem    # 🔌 插件生态
    ├── Model Plugins       # 模型插件
    ├── Processor Plugins   # 处理插件
    ├── Optimizer Plugins   # 优化插件
    └── Integration Plugins # 集成插件
```

## 🚀 快速开始

### 基本使用

```rust
use frys_ai_system::*;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 创建AI系统配置
    let config = AISystemConfig {
        max_concurrent_requests: 100,
        model_cache_size: 10,
        result_cache_ttl: Duration::from_secs(3600),
        enable_sira_integration: true,
        sira_gateway_url: "http://sira-gateway:8080".to_string(),
        gpu_acceleration: true,
        monitoring_enabled: true,
    };

    // 初始化AI系统
    let ai_system = AISystem::new(config).await?;
    println!("Frys AI System initialized successfully!");

    // 文本生成任务
    let text_request = AIRequest {
        model: "gpt-4".to_string(),
        task: AITask::TextGeneration,
        input: serde_json::json!({
            "prompt": "Write a short story about AI",
            "max_tokens": 500,
            "temperature": 0.7
        }),
        options: AIRequestOptions {
            priority: Priority::Normal,
            timeout: Some(Duration::from_secs(60)),
            caching_enabled: true,
        },
    };

    let text_response = ai_system.infer(text_request).await?;
    println!("Generated text: {}", text_response.output);

    // 图像分类任务
    let image_request = AIRequest {
        model: "resnet50".to_string(),
        task: AITask::ImageClassification,
        input: serde_json::json!({
            "image_url": "https://example.com/image.jpg",
            "top_k": 5
        }),
        options: AIRequestOptions {
            priority: Priority::High,
            timeout: Some(Duration::from_secs(30)),
            caching_enabled: true,
        },
    };

    let image_response = ai_system.infer(image_request).await?;
    println!("Classification results: {:?}", image_response.output);

    Ok(())
}
```

### 流式推理

```rust
// 流式文本生成
let stream_request = AIRequest {
    model: "gpt-4".to_string(),
    task: AITask::TextGeneration,
    input: serde_json::json!({
        "prompt": "Write a poem about technology",
        "max_tokens": 200,
        "stream": true
    }),
    options: Default::default(),
};

let mut stream = ai_system.infer_stream(stream_request).await?;

while let Some(chunk) = stream.next().await {
    match chunk {
        StreamChunk::Text { text, .. } => {
            print!("{}", text);
            io::stdout().flush().await?;
        }
        StreamChunk::Done => break,
        StreamChunk::Error { message } => {
            eprintln!("Stream error: {}", message);
            break;
        }
    }
}
```

### 批量推理

```rust
// 批量处理多个推理请求
let batch_requests = vec![
    AIRequest {
        model: "bert-base".to_string(),
        task: AITask::TextEmbedding,
        input: serde_json::json!({"text": "First document"}),
        options: Default::default(),
    },
    AIRequest {
        model: "bert-base".to_string(),
        task: AITask::TextEmbedding,
        input: serde_json::json!({"text": "Second document"}),
        options: Default::default(),
    },
    // ... 更多请求
];

let batch_results = ai_system.infer_batch(batch_requests).await?;
for (i, result) in batch_results.into_iter().enumerate() {
    println!("Batch result {}: {:?}", i, result.output);
}
```

## 🤖 多模态AI能力

### 文本处理

```rust
// 文本分类
let classification_request = AIRequest {
    model: "bert-classifier".to_string(),
    task: AITask::TextClassification,
    input: serde_json::json!({
        "text": "I love this product! It's amazing.",
        "labels": ["positive", "negative", "neutral"]
    }),
    options: Default::default(),
};

let result = ai_system.infer(classification_request).await?;
println!("Classification: {:?}", result.output);

// 命名实体识别
let ner_request = AIRequest {
    model: "spacy-ner".to_string(),
    task: AITask::NamedEntityRecognition,
    input: serde_json::json!({
        "text": "Apple Inc. was founded by Steve Jobs in Cupertino."
    }),
    options: Default::default(),
};

let entities = ai_system.infer(ner_request).await?;
println!("Entities: {:?}", entities.output);
```

### 视觉处理

```rust
// 图像分类
let image_classification = AIRequest {
    model: "efficientnet-b0".to_string(),
    task: AITask::ImageClassification,
    input: serde_json::json!({
        "image": base64_image_data,
        "top_k": 3
    }),
    options: Default::default(),
};

let predictions = ai_system.infer(image_classification).await?;
println!("Top predictions: {:?}", predictions.output);

// 目标检测
let object_detection = AIRequest {
    model: "yolov5".to_string(),
    task: AITask::ObjectDetection,
    input: serde_json::json!({
        "image": image_url,
        "confidence_threshold": 0.5
    }),
    options: Default::default(),
};

let detections = ai_system.infer(object_detection).await?;
println!("Detected objects: {:?}", detections.output);
```

### 音频处理

```rust
// 语音识别
let speech_recognition = AIRequest {
    model: "whisper-base".to_string(),
    task: AITask::SpeechRecognition,
    input: serde_json::json!({
        "audio": audio_base64_data,
        "language": "en"
    }),
    options: Default::default(),
};

let transcription = ai_system.infer(speech_recognition).await?;
println!("Transcription: {:?}", transcription.output);

// 情感分析
let emotion_detection = AIRequest {
    model: "emotion-classifier".to_string(),
    task: AITask::EmotionRecognition,
    input: serde_json::json!({
        "audio": audio_data,
        "sample_rate": 16000
    }),
    options: Default::default(),
};

let emotions = ai_system.infer(emotion_detection).await?;
println!("Emotions: {:?}", emotions.output);
```

### 跨模态融合

```rust
// 视觉问答
let vqa_request = AIRequest {
    model: "blip-vqa".to_string(),
    task: AITask::VisualQuestionAnswering,
    input: serde_json::json!({
        "image": image_data,
        "question": "What color is the car in the image?"
    }),
    options: Default::default(),
};

let answer = ai_system.infer(vqa_request).await?;
println!("Answer: {:?}", answer.output);

// 图像描述生成
let caption_request = AIRequest {
    model: "blip-caption".to_string(),
    task: AITask::ImageCaptioning,
    input: serde_json::json!({
        "image": image_data,
        "max_length": 50
    }),
    options: Default::default(),
};

let caption = ai_system.infer(caption_request).await?;
println!("Caption: {:?}", caption.output);
```

## 🔗 Sira AI Gateway集成

### 网关配置

```rust
let sira_config = SiraConfig {
    gateway_url: "http://sira-gateway:8080".to_string(),
    api_key: "your-sira-api-key".to_string(),
    region: "us-west-2".to_string(),
    enable_load_balancing: true,
    enable_failover: true,
    connection_pool_size: 20,
    request_timeout: Duration::from_secs(30),
};

let sira_client = SiraClient::new(sira_config).await?;
```

### 智能路由

```rust
// 自动选择最优AI提供商
let intelligent_request = AIRequest {
    model: "auto".to_string(), // 自动选择
    task: AITask::TextGeneration,
    input: serde_json::json!({
        "prompt": "Explain quantum computing",
        "max_tokens": 1000
    }),
    options: AIRequestOptions {
        use_sira_routing: true,
        routing_criteria: vec![
            RoutingCriterion::Cost,
            RoutingCriterion::Performance,
            RoutingCriterion::Availability,
        ],
        ..Default::default()
    },
};

let result = ai_system.infer_with_sira(intelligent_request).await?;
println!("Best provider result: {:?}", result.output);
```

### 负载均衡和故障转移

```rust
// 多提供商负载均衡
let load_balanced_request = AIRequest {
    model: "gpt-4".to_string(),
    task: AITask::TextGeneration,
    input: serde_json::json!({"prompt": "Hello world"}),
    options: AIRequestOptions {
        enable_load_balancing: true,
        providers: vec![
            "openai".to_string(),
            "anthropic".to_string(),
            "google".to_string(),
        ],
        failover_enabled: true,
        max_retries: 3,
        ..Default::default()
    },
};

let result = ai_system.infer_load_balanced(load_balanced_request).await?;
println!("Load balanced result: {:?}", result.output);
```

## 💾 智能缓存系统

### 结果缓存

```rust
// 自动缓存推理结果
let cache_config = CacheConfig {
    enabled: true,
    ttl: Duration::from_secs(3600), // 1小时
    max_size: 1000, // 最多缓存1000个结果
    eviction_policy: EvictionPolicy::LRU,
};

let cached_request = AIRequest {
    model: "text-embedding-ada-002".to_string(),
    task: AITask::TextEmbedding,
    input: serde_json::json!({"text": "Hello world"}),
    options: AIRequestOptions {
        caching_enabled: true,
        cache_key: Some("hello_world_embedding".to_string()),
        ..Default::default()
    },
};

// 首次推理 - 计算结果并缓存
let first_result = ai_system.infer(cached_request.clone()).await?;
println!("First inference took: {:?}", first_result.duration);

// 第二次推理 - 从缓存返回
let cached_result = ai_system.infer(cached_request).await?;
println!("Cached result took: {:?}", cached_result.duration);
```

### 模型预热

```rust
// 预加载常用模型
ai_system.preload_model("gpt-4").await?;
ai_system.preload_model("resnet50").await?;
ai_system.preload_model("whisper-base").await?;

// 批量预热
let models_to_warm = vec![
    "bert-base-uncased",
    "efficientnet-b0",
    "yolov5s",
];

ai_system.warm_up_models(models_to_warm).await?;
println!("Models warmed up successfully");
```

## 📊 性能监控和分析

### 实时指标

```rust
// 获取系统指标
let metrics = ai_system.get_metrics().await?;
println!("Active requests: {}", metrics.active_requests);
println!("Completed requests: {}", metrics.completed_requests);
println!("Average latency: {}ms", metrics.avg_latency_ms);
println!("Cache hit rate: {:.2}%", metrics.cache_hit_rate * 100.0);
println!("Error rate: {:.2}%", metrics.error_rate * 100.0);

// 模型特定指标
for (model_name, model_metrics) in &metrics.model_metrics {
    println!("Model {}: {} requests, {}ms avg latency",
             model_name,
             model_metrics.request_count,
             model_metrics.avg_latency_ms);
}
```

### 性能分析

```rust
// 详细性能分析
let analysis = ai_system.analyze_performance(
    chrono::Duration::hours(1) // 过去1小时
).await?;

println!("Performance bottlenecks:");
for bottleneck in &analysis.bottlenecks {
    println!("  {}: {}ms average latency", bottleneck.model, bottleneck.avg_latency);
}

println!("Optimization recommendations:");
for recommendation in &analysis.recommendations {
    println!("  - {}", recommendation);
}
```

### 自动优化

```rust
// 启用自动性能优化
ai_system.enable_auto_optimization(AutoOptimizationConfig {
    enabled: true,
    optimization_interval: Duration::from_secs(300), // 每5分钟优化一次
    max_cache_size_adjustment: 0.2, // 最大缓存大小调整20%
    enable_model_unloading: true, // 启用未使用模型卸载
    performance_target: PerformanceTarget {
        max_latency_ms: 500,
        min_cache_hit_rate: 0.8,
        max_error_rate: 0.01,
    },
}).await?;

println!("Auto-optimization enabled");
```

## 🔧 插件系统

### 模型插件开发

```rust
#[async_trait]
pub trait AIModelPlugin: Send + Sync {
    fn name(&self) -> &str;
    fn supported_tasks(&self) -> Vec<AITask>;
    fn model_info(&self) -> ModelInfo;

    async fn load_model(&self, model_path: &str) -> Result<ModelHandle>;
    async fn infer(&self, model: &ModelHandle, input: serde_json::Value) -> Result<serde_json::Value>;
    async fn unload_model(&self, model: &ModelHandle) -> Result<()>;
}

// 自定义模型插件实现
pub struct CustomModelPlugin {
    client: reqwest::Client,
}

#[async_trait]
impl AIModelPlugin for CustomModelPlugin {
    fn name(&self) -> &str { "custom-model" }

    fn supported_tasks(&self) -> Vec<AITask> {
        vec![AITask::TextGeneration, AITask::TextClassification]
    }

    fn model_info(&self) -> ModelInfo {
        ModelInfo {
            name: "custom-model".to_string(),
            version: "1.0.0".to_string(),
            framework: "custom".to_string(),
            input_format: "json".to_string(),
            output_format: "json".to_string(),
            capabilities: vec!["generation".to_string(), "classification".to_string()],
        }
    }

    async fn load_model(&self, model_path: &str) -> Result<ModelHandle> {
        // 实现模型加载逻辑
        Ok(ModelHandle::new(model_path.to_string()))
    }

    async fn infer(&self, model: &ModelHandle, input: serde_json::Value) -> Result<serde_json::Value> {
        // 调用自定义模型推理API
        let response = self.client
            .post("http://custom-model-api:8080/infer")
            .json(&input)
            .send()
            .await?
            .json()
            .await?;

        Ok(response)
    }

    async fn unload_model(&self, model: &ModelHandle) -> Result<()> {
        // 实现模型卸载逻辑
        Ok(())
    }
}
```

### 处理器插件

```rust
#[async_trait]
pub trait AIProcessorPlugin: Send + Sync {
    fn name(&self) -> &str;
    fn supported_modalities(&self) -> Vec<Modality>;

    async fn preprocess(&self, input: serde_json::Value) -> Result<serde_json::Value>;
    async fn postprocess(&self, output: serde_json::Value) -> Result<serde_json::Value>;
}

// 图像预处理插件
pub struct ImagePreprocessor;

#[async_trait]
impl AIProcessorPlugin for ImagePreprocessor {
    fn name(&self) -> &str { "image-preprocessor" }

    fn supported_modalities(&self) -> Vec<Modality> {
        vec![Modality::Vision]
    }

    async fn preprocess(&self, input: serde_json::Value) -> Result<serde_json::Value> {
        let image_data = input["image"].as_str()
            .ok_or_else(|| AIError::InvalidInput("Missing image data".to_string()))?;

        // 图像预处理逻辑
        let processed_image = process_image(image_data).await?;

        Ok(serde_json::json!({
            "processed_image": processed_image,
            "original_size": input["size"],
            "processing_time_ms": 150
        }))
    }

    async fn postprocess(&self, output: serde_json::Value) -> Result<serde_json::Value> {
        // 后处理逻辑
        let predictions = output["predictions"].as_array()
            .ok_or_else(|| AIError::InvalidOutput("Missing predictions".to_string()))?;

        let filtered_predictions: Vec<_> = predictions.iter()
            .filter(|p| p["confidence"].as_f64().unwrap_or(0.0) > 0.5)
            .cloned()
            .collect();

        Ok(serde_json::json!({
            "filtered_predictions": filtered_predictions,
            "total_predictions": predictions.len(),
            "filtered_count": filtered_predictions.len()
        }))
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
    async fn test_text_generation() {
        let ai_system = AISystem::new(Default::default()).await.unwrap();

        let request = AIRequest {
            model: "mock-model".to_string(),
            task: AITask::TextGeneration,
            input: serde_json::json!({"prompt": "Hello"}),
            options: Default::default(),
        };

        let response = ai_system.infer(request).await.unwrap();
        assert!(response.output.is_object());
        assert!(response.duration > Duration::from_millis(0));
    }

    #[tokio::test]
    async fn test_caching() {
        let config = AISystemConfig {
            result_cache_ttl: Duration::from_secs(300),
            ..Default::default()
        };
        let ai_system = AISystem::new(config).await.unwrap();

        let request = AIRequest {
            model: "cached-model".to_string(),
            task: AITask::TextEmbedding,
            input: serde_json::json!({"text": "test"}),
            options: AIRequestOptions {
                caching_enabled: true,
                ..Default::default()
            },
        };

        // 首次推理
        let first_result = ai_system.infer(request.clone()).await.unwrap();
        let first_duration = first_result.duration;

        // 第二次推理 (应该从缓存返回)
        let second_result = ai_system.infer(request).await.unwrap();
        let second_duration = second_result.duration;

        // 缓存命中应该更快
        assert!(second_duration < first_duration);
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
    async fn test_full_ai_pipeline() {
        // 启动完整系统
        let kernel = FrysKernel::new(Default::default()).await.unwrap();
        kernel.load_plugin("ai-system").await.unwrap();

        let ai_system = AISystem::from_kernel(&kernel).await.unwrap();

        // 测试多模态管道
        let text_input = serde_json::json!({"text": "A beautiful sunset over mountains"});
        let image_input = serde_json::json!({"image_url": "https://example.com/sunset.jpg"});

        // 并发生成文本描述和图像分析
        let (text_result, image_result) = tokio::join!(
            ai_system.infer(AIRequest {
                model: "text-generator".to_string(),
                task: AITask::TextGeneration,
                input: text_input,
                options: Default::default(),
            }),
            ai_system.infer(AIRequest {
                model: "image-analyzer".to_string(),
                task: AITask::ImageAnalysis,
                input: image_input,
                options: Default::default(),
            })
        );

        assert!(text_result.is_ok());
        assert!(image_result.is_ok());

        kernel.shutdown().await.unwrap();
    }
}
```

## 🚀 部署和扩展

### Docker部署

```dockerfile
FROM rust:1.70-slim AS builder

WORKDIR /app
COPY . .
RUN cargo build --release --bin frys-ai-system

FROM nvidia/cuda:11.8-runtime-ubuntu20.04

RUN apt-get update && apt-get install -y \
    libssl-dev \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/frys-ai-system /usr/local/bin/

EXPOSE 8080 9090
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:9090/health || exit 1

CMD ["frys-ai-system"]
```

### GPU支持

```rust
// GPU配置
let gpu_config = GpuConfig {
    enabled: true,
    device_id: 0, // 使用第一个GPU
    memory_limit: 8 * 1024 * 1024 * 1024, // 8GB
    allow_growth: true,
    visible_devices: vec!["0".to_string()], // 只使用GPU 0
};

let ai_system = AISystem::with_gpu_config(config, gpu_config).await?;
```

### Kubernetes部署

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frys-ai-system
spec:
  replicas: 2
  template:
    spec:
      containers:
      - name: ai-system
        image: frys-ai-system:latest
        resources:
          requests:
            nvidia.com/gpu: "1"  # 请求1个GPU
            memory: "4Gi"
            cpu: "2"
          limits:
            nvidia.com/gpu: "1"
            memory: "8Gi"
            cpu: "4"
        env:
        - name: CUDA_VISIBLE_DEVICES
          value: "0"
        - name: FRYS_AI_GPU_ENABLED
          value: "true"
        ports:
        - containerPort: 8080
        - containerPort: 9090
```

## 📊 性能基准测试

### 基准测试结果

| 任务类型 | 模型 | 并发数 | 平均延迟 | P95延迟 | 吞吐量 |
|----------|------|--------|----------|---------|--------|
| 文本生成 | GPT-3.5 | 10 | 850ms | 1200ms | 45 req/s |
| 文本生成 | GPT-4 | 5 | 1800ms | 2500ms | 18 req/s |
| 图像分类 | ResNet50 | 20 | 45ms | 80ms | 380 req/s |
| 目标检测 | YOLOv5 | 10 | 120ms | 200ms | 75 req/s |
| 语音识别 | Whisper | 5 | 3200ms | 4500ms | 12 req/s |

### 性能优化建议

```rust
let optimization_config = OptimizationConfig {
    // 模型优化
    enable_model_quantization: true,
    enable_onnx_runtime: true,
    enable_tensorrt: true,

    // 缓存优化
    result_cache_enabled: true,
    model_cache_enabled: true,
    embedding_cache_enabled: true,

    // 并发优化
    max_concurrent_requests: 50,
    request_queue_size: 1000,
    enable_request_batching: true,

    // 资源优化
    enable_gpu_memory_pool: true,
    enable_cpu_thread_pool: true,
    memory_defragmentation_enabled: true,
};
```

## 🔧 配置和调优

### 环境变量配置

```bash
# 基础配置
export FRYS_AI_MAX_CONCURRENT_REQUESTS=100
export FRYS_AI_MODEL_CACHE_SIZE=10
export FRYS_AI_RESULT_CACHE_TTL=3600

# GPU配置
export FRYS_AI_GPU_ENABLED=true
export FRYS_AI_GPU_DEVICE_ID=0
export FRYS_AI_GPU_MEMORY_LIMIT=8GB

# Sira集成配置
export FRYS_AI_SIRA_ENABLED=true
export FRYS_AI_SIRA_GATEWAY_URL=http://sira-gateway:8080
export FRYS_AI_SIRA_API_KEY=your-api-key

# 监控配置
export FRYS_AI_MONITORING_ENABLED=true
export FRYS_AI_METRICS_INTERVAL=5
export FRYS_AI_TRACING_ENABLED=true
```

## 🐛 故障排除

### 常见问题

#### GPU内存不足
```
Error: CUDA out of memory

Solution:
1. 减少并发请求数: --max-concurrent-requests 20
2. 启用模型量化: --enable-quantization true
3. 增加GPU内存: 使用更大显存的GPU
4. 启用内存池: --enable-gpu-memory-pool true
```

#### 模型加载失败
```
Error: Model loading failed

Solution:
1. 检查模型路径: --model-path /path/to/models
2. 验证模型格式: --model-format onnx
3. 检查依赖库: --check-dependencies true
4. 启用模型验证: --validate-models true
```

#### Sira连接失败
```
Error: Sira gateway connection failed

Solution:
1. 检查网关URL: --sira-gateway-url http://gateway:8080
2. 验证API密钥: --sira-api-key valid-key
3. 检查网络连接: --test-connection true
4. 启用重试机制: --enable-retry true
```

## 📚 API参考

### REST API

```http
# 推理请求
POST /api/v1/infer
Content-Type: application/json

{
  "model": "gpt-4",
  "task": "text-generation",
  "input": {
    "prompt": "Hello, world!",
    "max_tokens": 100
  },
  "options": {
    "priority": "normal",
    "caching": true
  }
}

# 流式推理
POST /api/v1/infer/stream
Content-Type: application/json

{
  "model": "gpt-4",
  "task": "text-generation",
  "input": {
    "prompt": "Tell me a story",
    "stream": true
  }
}

# 批量推理
POST /api/v1/infer/batch
Content-Type: application/json

[
  {
    "model": "bert-base",
    "task": "text-embedding",
    "input": {"text": "First text"}
  },
  {
    "model": "bert-base",
    "task": "text-embedding",
    "input": {"text": "Second text"}
  }
]

# 获取指标
GET /api/v1/metrics

# 健康检查
GET /api/v1/health
```

### WebSocket API

```javascript
// 连接到AI系统
const ws = new WebSocket('ws://localhost:8080/ws/ai');

// 订阅推理事件
ws.send(JSON.stringify({
  type: 'subscribe',
  pattern: 'inference.*'
}));

// 发送推理请求
ws.send(JSON.stringify({
  type: 'infer',
  request_id: 'req-123',
  model: 'gpt-4',
  task: 'text-generation',
  input: { prompt: 'Hello!' }
}));

// 接收结果
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'inference_result') {
    console.log('Result:', data.result);
  }
};
```

## 🤝 贡献

### 开发指南
1. Fork 本仓库
2. 创建功能分支: `git checkout -b feature/new-ai-model`
3. 编写代码和测试
4. 运行测试: `cargo test`
5. 提交PR

### 插件开发
1. 实现 `AIModelPlugin` trait
2. 添加插件配置
3. 编写插件文档
4. 提交到插件仓库

## 📄 许可证

MIT License - 详见 [LICENSE](../../LICENSE) 文件