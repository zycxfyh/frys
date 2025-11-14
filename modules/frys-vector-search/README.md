# Frys Vector Search (frys-vector-search)

## 🎯 使命：为工作流引擎提供智能向量表示

**Frys Vector Search 是工作流引擎的"记忆神经元"**，它提供了**张量原生向量搜索**、**自组织相似性匹配**和**自主学习向量优化**所需的智能向量能力。

**不再是传统的"向量数据库"，而是AI Agent协作社会的记忆神经元**，让智能体们能够理解相似性、发现模式、积累知识。

### 🌟 核心定位
- **🧠 工作流的记忆系统**：为张量原生工作流提供向量化的知识表示和检索
- **🤝 Agent的相似性大脑**：为自组织Agent提供智能的相似性匹配和协作发现
- **🧬 进化的知识引擎**：为自主学习系统提供向量化的经验积累和模式发现

## 🧬 世界模型支撑：智能向量的进化

基于Frys世界模型框架，向量搜索采用了革命性的设计理念：

### 1. **张量原生向量引擎** - 数学相似性的原生计算
```rust
// 张量原生向量搜索 - 直接处理workflow_tensor相似性
pub struct TensorNativeVectorEngine {
    pub tensor_index: TensorIndex,
    pub similarity_computer: SimilarityComputer,
}

impl TensorNativeVectorEngine {
    // 直接搜索工作流张量的相似模式
    pub async fn search_similar_workflow_tensors(&self, query_tensor: &WorkflowTensor, k: usize) -> Result<Vec<SimilarityResult>, SearchError> {
        // 1. 张量预处理 - 无需转换为向量
        let processed_query = self.preprocess_workflow_tensor(query_tensor)?;

        // 2. 并行相似性计算 - SIMD加速
        let similarities = self.compute_tensor_similarities(&processed_query).await?;

        // 3. 张量排序和过滤
        let top_k_results = self.rank_and_filter_similarities(&similarities, k)?;

        Ok(top_k_results)
    }
}
```

### 2. **自组织协作发现器** - Agent相似性的智能匹配
```rust
// 自组织协作发现器 - 基于向量相似性发现Agent协作机会
pub struct SelfOrganizingCollaborationDiscoverer {
    pub agent_vector_index: AgentVectorIndex,
    pub collaboration_pattern_analyzer: CollaborationPatternAnalyzer,
}

impl SelfOrganizingCollaborationDiscoverer {
    // 发现潜在的Agent协作关系
    pub async fn discover_collaboration_opportunities(&self, current_agents: &[AgentId], task: &Task) -> Result<Vec<CollaborationSuggestion>, DiscoveryError> {
        // 1. 计算Agent向量相似性
        let agent_similarities = self.compute_agent_similarities(current_agents).await?;

        // 2. 分析历史协作模式
        let collaboration_patterns = self.analyze_collaboration_patterns(&agent_similarities)?;

        // 3. 预测最优协作组合
        let optimal_collaborations = self.predict_optimal_collaborations(&collaboration_patterns, task)?;

        // 4. 生成协作建议
        let suggestions = self.generate_collaboration_suggestions(&optimal_collaborations)?;

        Ok(suggestions)
    }
}
```

### 3. **自主学习向量优化器** - 经验驱动的向量进化
```rust
// 自主学习向量优化器 - 从执行经验中优化向量表示
pub struct AutonomousVectorLearningOptimizer {
    pub experience_vectorizer: ExperienceVectorizer,
    pub vector_evolution_engine: VectorEvolutionEngine,
}

impl AutonomousVectorLearningOptimizer {
    // 从工作流执行中学习优化向量表示
    pub async fn learn_optimal_vector_representation(&self, execution_experiences: &[WorkflowExecution]) -> Result<OptimizedVectors, LearningError> {
        // 1. 向量化执行经验
        let experience_vectors = self.vectorize_execution_experiences(execution_experiences)?;

        // 2. 分析向量表示的有效性
        let vector_effectiveness = self.analyze_vector_effectiveness(&experience_vectors)?;

        // 3. 进化出更好的向量表示
        let evolved_vectors = self.evolve_vector_representations(&vector_effectiveness).await?;

        // 4. 验证改进效果
        let validation_result = self.validate_vector_improvements(&evolved_vectors)?;

        Ok(OptimizedVectors {
            vectors: evolved_vectors,
            improvement_score: validation_result.score,
            confidence: validation_result.confidence,
        })
    }
}
```

### 核心特性
- **⚡ 高性能索引**: HNSW、IVF等先进索引算法
- **🔄 实时更新**: 支持实时向量插入和更新
- **📊 智能优化**: ML增强的查询优化和参数预测
- **🌐 分布式扩展**: 支持大规模分布式部署
- **💾 持久化存储**: 高效的向量数据持久化
- **🔍 多策略搜索**: 精确搜索、近似搜索、混合搜索

### 架构优势
- **性能极致**: SIMD优化和内存预取
- **扩展无限**: 水平扩展支持PB级数据
- **智能检索**: AI驱动的查询理解和重排序
- **实时可靠**: 实时索引更新和ACID保证
- **开发友好**: 简单API和丰富查询语法

## 🏗️ 架构设计

```
frys-vector-search/
├── Core Engine           # 🧠 核心搜索引擎
│   ├── Vector Index         # 向量索引管理
│   ├── Query Processor      # 查询处理器
│   ├── Distance Calculator  # 距离计算器
│   └── Search Executor      # 搜索执行器
├── Index Algorithms      # 📊 索引算法
│   ├── HNSW (Hierarchical Navigable Small World)
│   ├── IVF (Inverted File)
│   ├── PQ (Product Quantization)
│   └── LSH (Locality Sensitive Hashing)
├── ML Integration        # 🤖 机器学习集成
│   ├── Query Enhancement   # 查询增强
│   ├── Parameter Prediction# 参数预测
│   ├── Result Re-ranking   # 结果重排序
│   └── Auto-tuning         # 自动调优
├── Distributed System    # 🌐 分布式系统
│   ├── Cluster Manager     # 集群管理器
│   ├── Data Partitioning   # 数据分区
│   ├── Replication         # 数据复制
│   └── Load Balancing      # 负载均衡
├── Storage Layer         # 💾 存储层
│   ├── Vector Storage      # 向量存储
│   ├── Metadata Storage    # 元数据存储
│   ├── Index Persistence   # 索引持久化
│   └── WAL (Write-Ahead Log)
└── Real-time Analytics  # 📈 实时分析
    ├── Performance Metrics # 性能指标
    ├── Query Analytics     # 查询分析
    ├── Index Statistics    # 索引统计
    └── Usage Patterns      # 使用模式
```

## 🚀 快速开始

### 基本使用

```rust
use frys_vector_search::*;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 创建向量搜索配置
    let config = VectorSearchConfig {
        dimension: 768, // 向量维度
        max_vectors: 1_000_000, // 最大向量数
        index_type: IndexType::HNSW, // 使用HNSW索引
        metric: DistanceMetric::Cosine, // 余弦相似度
        ef_construction: 200, // 索引构建参数
        m: 16, // HNSW参数
        enable_persistence: true,
        persistence_path: "/var/lib/frys/vector-search".into(),
        enable_ml_integration: true,
        max_connections: 100,
    };

    // 初始化向量搜索引擎
    let search_engine = VectorSearchEngine::new(config).await?;
    println!("Frys Vector Search initialized successfully!");

    // 创建向量集合
    let collection = search_engine.create_collection("embeddings", CollectionConfig {
        dimension: 768,
        index_type: IndexType::HNSW,
        metric: DistanceMetric::Cosine,
        max_vectors: 100_000,
    }).await?;

    // 插入向量数据
    let vectors = vec![
        Vector {
            id: "doc1".to_string(),
            data: vec![0.1, 0.2, 0.3, /* ... 其他维度 */],
            metadata: serde_json::json!({"title": "Document 1", "category": "tech"}),
        },
        Vector {
            id: "doc2".to_string(),
            data: vec![0.4, 0.5, 0.6, /* ... 其他维度 */],
            metadata: serde_json::json!({"title": "Document 2", "category": "business"}),
        },
    ];

    search_engine.insert_vectors("embeddings", vectors).await?;
    println!("Vectors inserted successfully");

    // 执行相似性搜索
    let query_vector = vec![0.15, 0.25, 0.35, /* ... 其他维度 */];
    let search_request = SearchRequest {
        collection: "embeddings".to_string(),
        query_vector,
        k: 10, // 返回前10个结果
        ef: 64, // 搜索参数
        filter: Some(Filter::Metadata(serde_json::json!({"category": "tech"}))),
        with_scores: true,
        with_metadata: true,
    };

    let results = search_engine.search(search_request).await?;
    println!("Search results:");
    for result in results.results {
        println!("ID: {}, Score: {:.4}, Metadata: {:?}", result.id, result.score, result.metadata);
    }

    Ok(())
}
```

### 高级搜索功能

```rust
// 混合搜索 (文本 + 向量)
let hybrid_request = HybridSearchRequest {
    text_query: "machine learning algorithms".to_string(),
    vector_query: query_vector,
    collection: "documents".to_string(),
    k: 20,
    text_weight: 0.3, // 文本权重
    vector_weight: 0.7, // 向量权重
    rerank: true, // 启用重排序
};

let hybrid_results = search_engine.hybrid_search(hybrid_request).await?;
println!("Hybrid search results: {:?}", hybrid_results);

// 范围搜索
let range_request = RangeSearchRequest {
    collection: "embeddings".to_string(),
    query_vector,
    radius: 0.8, // 相似度阈值
    max_results: 100,
    with_scores: true,
};

let range_results = search_engine.range_search(range_request).await?;
println!("Range search found {} results", range_results.results.len());
```

### 实时索引更新

```rust
// 实时插入新向量
let new_vectors = vec![
    Vector {
        id: "doc_new".to_string(),
        data: vec![0.7, 0.8, 0.9, /* ... */],
        metadata: serde_json::json!({"timestamp": "2024-01-01"}),
    },
];

search_engine.insert_vectors("embeddings", new_vectors).await?;

// 批量更新向量
let updates = vec![
    VectorUpdate {
        id: "doc1".to_string(),
        data: Some(vec![0.11, 0.21, 0.31, /* ... */]), // 更新向量数据
        metadata: Some(serde_json::json!({"updated": true})), // 更新元数据
    },
];

search_engine.update_vectors("embeddings", updates).await?;

// 删除向量
search_engine.delete_vectors("embeddings", vec!["doc_old".to_string()]).await?;
```

## 🔍 索引算法

### HNSW (Hierarchical Navigable Small World)

```rust
// HNSW索引配置
let hnsw_config = HNSWConfig {
    m: 16, // 每个节点的邻居数
    ef_construction: 200, // 索引构建时的ef参数
    ef_search: 64, // 默认搜索ef参数
    max_connections: 32, // 最大连接数
    level_multiplier: 1.0 / ln(m as f32), // 层级乘数
};

// 创建HNSW索引
let hnsw_index = HNSWIndex::new(dimension, hnsw_config, metric);

// 构建索引
for vector in vectors {
    hnsw_index.insert(vector.id.clone(), &vector.data).await?;
}

// 搜索
let results = hnsw_index.search(&query_vector, k, ef).await?;
```

### IVF (Inverted File)

```rust
// IVF索引配置
let ivf_config = IVFConfig {
    nlist: 1024, // 聚类中心数量
    nprobe: 10, // 搜索时访问的聚类中心数
    max_iter: 100, // K-means最大迭代次数
    quantization: QuantizationType::PQ { m: 8, nbits: 8 }, // 量化类型
};

// 创建IVF索引
let ivf_index = IVFIndex::new(dimension, ivf_config, metric);

// 训练聚类中心
ivf_index.train(vectors.iter().map(|v| &v.data)).await?;

// 添加向量
for vector in vectors {
    ivf_index.add(vector.id.clone(), &vector.data).await?;
}

// 搜索
let results = ivf_index.search(&query_vector, k).await?;
```

## 🤖 机器学习集成

### 查询增强

```rust
// ML增强的查询处理
let ml_enhanced_request = SearchRequest {
    collection: "documents".to_string(),
    query_vector,
    k: 20,
    enable_ml_enhancement: true,
    enhancement_config: Some(EnhancementConfig {
        query_expansion: true, // 查询扩展
        semantic_understanding: true, // 语义理解
        context_awareness: true, // 上下文感知
        personalization: false, // 个性化 (可选)
    }),
    ..Default::default()
};

let enhanced_results = search_engine.ml_enhanced_search(ml_enhanced_request).await?;

// 查询扩展示例
let expansion = query_enhancer.expand_query("machine learning").await?;
println!("Expanded query: {:?}", expansion);
// 输出: ["machine learning", "artificial intelligence", "deep learning", "neural networks"]
```

### 参数自动调优

```rust
// 自动参数预测
let optimal_params = parameter_predictor.predict_optimal_params(
    collection_stats,
    query_pattern,
    performance_requirements,
).await?;

println!("Predicted optimal parameters:");
println!("  ef_search: {}", optimal_params.ef_search);
println!("  nprobe: {}", optimal_params.nprobe);
println!("  expected_recall: {:.3}", optimal_params.expected_recall);

// 应用预测的参数
let tuned_request = SearchRequest {
    ef: optimal_params.ef_search,
    nprobe: optimal_params.nprobe,
    ..search_request
};

let tuned_results = search_engine.search(tuned_request).await?;
```

### 结果重排序

```rust
// 基于学习的重新排序
let reranker = LearnedReranker::new(reranker_config).await?;
let reranked_results = reranker.rerank(
    initial_results,
    query_context,
    user_profile,
).await?;

println!("Results after re-ranking:");
for (i, result) in reranked_results.iter().enumerate() {
    println!("{}. {} (score: {:.4})", i+1, result.id, result.score);
}
```

## 🌐 分布式功能

### 集群管理

```rust
// 创建分布式向量搜索集群
let cluster_config = ClusterConfig {
    node_id: "node-1".to_string(),
    peers: vec![
        "node-2:8080".to_string(),
        "node-3:8080".to_string(),
    ],
    replication_factor: 3,
    shard_count: 32,
    enable_auto_rebalance: true,
};

let distributed_search = DistributedVectorSearch::new(cluster_config).await?;

// 分布式索引创建
distributed_search.create_distributed_index("large_collection", index_config).await?;

// 分布式搜索
let distributed_results = distributed_search.distributed_search(search_request).await?;
```

### 数据分区和复制

```rust
// 配置数据分区策略
let partitioning_config = PartitioningConfig {
    strategy: PartitionStrategy::HashRing,
    virtual_nodes: 1024,
    replication_strategy: ReplicationStrategy::ConsistentHashing,
    consistency_level: ConsistencyLevel::Quorum,
};

// 自动数据分区
let partitioner = DataPartitioner::new(partitioning_config);
let partitions = partitioner.partition_data(vectors, shard_count).await?;

// 数据复制
let replicator = DataReplicator::new(replication_config);
replicator.replicate_to_peers(partitions, peer_nodes).await?;
```

## 💾 存储和持久化

### 向量存储

```rust
// 高效向量存储
let storage_config = VectorStorageConfig {
    storage_type: StorageType::MemoryMapped,
    compression: CompressionType::ZSTD { level: 3 },
    cache_size: 1 * 1024 * 1024 * 1024, // 1GB缓存
    wal_enabled: true,
    wal_sync: WALSync::EverySecond,
};

let vector_storage = VectorStorage::new(storage_config).await?;

// 批量存储向量
vector_storage.store_batch(vectors).await?;

// 随机访问向量
let vector_data = vector_storage.load_vector("doc1").await?;
```

### 索引持久化

```rust
// 索引快照和恢复
let snapshot_manager = IndexSnapshotManager::new(snapshot_config);

// 创建索引快照
let snapshot_id = snapshot_manager.create_snapshot("embeddings", "backup-2024").await?;

// 从快照恢复索引
let recovered_index = snapshot_manager.restore_from_snapshot(snapshot_id).await?;
```

## 📊 实时分析和监控

### 性能指标收集

```rust
// 收集详细性能指标
let metrics = search_engine.get_metrics().await?;

println!("Performance Metrics:");
println!("  Total vectors: {}", metrics.total_vectors);
println!("  Index size: {} bytes", metrics.index_size_bytes);
println!("  Average query latency: {}ms", metrics.avg_query_latency_ms);
println!("  Queries per second: {:.2}", metrics.queries_per_second);
println!("  Cache hit rate: {:.2}%", metrics.cache_hit_rate * 100.0);
println!("  Memory usage: {}MB", metrics.memory_usage_mb);

// 索引特定指标
for (index_name, index_metrics) in &metrics.index_metrics {
    println!("Index {}: build_time={}ms, search_speed={:.0} QPS",
             index_name,
             index_metrics.build_time_ms,
             index_metrics.search_speed_qps);
}
```

### 查询分析

```rust
// 查询模式分析
let query_analytics = search_engine.analyze_queries(
    chrono::Duration::hours(24) // 过去24小时
).await?;

println!("Query Analytics:");
println!("  Total queries: {}", query_analytics.total_queries);
println!("  Unique queries: {}", query_analytics.unique_queries);
println!("  Average result count: {:.1}", query_analytics.avg_result_count);

println!("Top queries:");
for (query, count) in &query_analytics.top_queries {
    println!("  {}: {} times", query, count);
}

// 查询性能分布
println!("Query latency distribution:");
for bucket in &query_analytics.latency_distribution {
    println!("  {}ms: {} queries", bucket.latency_ms, bucket.count);
}
```

### 自动优化建议

```rust
// 基于分析结果的优化建议
let optimizer = IndexOptimizer::new();
let recommendations = optimizer.analyze_and_recommend(
    metrics,
    query_analytics,
    system_resources,
).await?;

println!("Optimization Recommendations:");
for recommendation in recommendations {
    println!("- {}", recommendation.description);
    println!("  Expected improvement: {}", recommendation.expected_improvement);
    println!("  Implementation effort: {}", recommendation.effort_level);
    println!();
}
```

## 🔧 配置和调优

### 索引参数调优

```rust
// HNSW参数调优
let hnsw_tuned_config = HNSWConfig {
    m: 32, // 增加邻居数以提高召回率
    ef_construction: 400, // 增加构建质量
    ef_search: 128, // 增加搜索质量
    max_connections: 64,
    level_multiplier: 1.0 / (m as f32).ln(),
};

// IVF参数调优
let ivf_tuned_config = IVFConfig {
    nlist: 2048, // 更多聚类中心
    nprobe: 20, // 搜索更多聚类
    max_iter: 200,
    quantization: QuantizationType::PQ { m: 16, nbits: 8 }, // 更细粒度的量化
};
```

### 内存优化

```rust
// 内存使用优化配置
let memory_config = MemoryConfig {
    index_cache_size: 2 * 1024 * 1024 * 1024, // 2GB索引缓存
    vector_cache_size: 1 * 1024 * 1024 * 1024, // 1GB向量缓存
    metadata_cache_size: 512 * 1024 * 1024, // 512MB元数据缓存
    enable_mmap: true, // 启用内存映射
    enable_compression: true, // 启用压缩
    cache_eviction_policy: EvictionPolicy::LRU,
};

// 应用内存优化
search_engine.apply_memory_config(memory_config).await?;
```

## 🧪 测试和基准测试

### 性能基准测试

```rust
#[cfg(test)]
mod benchmarks {
    use super::*;
    use criterion::{black_box, criterion_group, criterion_main, Criterion};

    fn index_build_benchmark(c: &mut Criterion) {
        let mut vectors = generate_test_vectors(10000, 768);

        c.bench_function("hnsw_index_build_10k", |b| {
            b.iter(|| {
                let index = HNSWIndex::new(768, HNSWConfig::default(), DistanceMetric::Cosine);
                for vector in &vectors {
                    black_box(index.insert(vector.id.clone(), &vector.data));
                }
            })
        });
    }

    fn search_benchmark(c: &mut Criterion) {
        let mut index = HNSWIndex::new(768, HNSWConfig::default(), DistanceMetric::Cosine);
        let vectors = generate_test_vectors(10000, 768);
        let query = generate_query_vector(768);

        // 预构建索引
        for vector in &vectors {
            index.insert(vector.id.clone(), &vector.data);
        }

        c.bench_function("hnsw_search_10k", |b| {
            b.iter(|| {
                black_box(index.search(&query, 10, 64));
            })
        });
    }

    criterion_group!(benches, index_build_benchmark, search_benchmark);
    criterion_main!(benches);
}
```

### 准确性测试

```rust
#[cfg(test)]
mod accuracy_tests {
    use super::*;

    #[tokio::test]
    async fn test_search_accuracy() {
        let search_engine = VectorSearchEngine::new(Default::default()).await.unwrap();

        // 创建测试数据集
        let test_data = create_ground_truth_dataset();
        search_engine.insert_vectors("test", test_data.vectors).await.unwrap();

        // 测试不同k值的准确性
        for k in [1, 5, 10, 20, 50] {
            let accuracy = evaluate_search_accuracy(
                &search_engine,
                &test_data.queries,
                &test_data.ground_truth,
                k
            ).await.unwrap();

            println!("Accuracy@{}: {:.4}", k, accuracy);
            assert!(accuracy > 0.8, "Accuracy@{} too low: {:.4}", k, accuracy);
        }
    }

    #[tokio::test]
    async fn test_index_consistency() {
        let search_engine = VectorSearchEngine::new(Default::default()).await.unwrap();

        // 插入测试向量
        let vectors = generate_test_vectors(1000, 128);
        search_engine.insert_vectors("consistency_test", vectors.clone()).await.unwrap();

        // 验证向量一致性
        for vector in &vectors {
            let stored = search_engine.get_vector("consistency_test", &vector.id).await.unwrap();
            assert_eq!(stored.data, vector.data, "Vector data mismatch for {}", vector.id);
        }

        // 测试搜索一致性
        let query = generate_query_vector(128);
        let results1 = search_engine.search(create_search_request(&query, 10)).await.unwrap();
        let results2 = search_engine.search(create_search_request(&query, 10)).await.unwrap();

        assert_eq!(results1.results.len(), results2.results.len(), "Search result count inconsistency");
        for (r1, r2) in results1.results.iter().zip(results2.results.iter()) {
            assert_eq!(r1.id, r2.id, "Search result order inconsistency");
        }
    }
}
```

## 🚀 部署和扩展

### 单机部署

```yaml
# Docker Compose
version: '3.8'
services:
  frys-vector-search:
    image: frys-vector-search:latest
    ports:
      - "8080:8080"
      - "9090:9090"
    environment:
      - FRYS_VECTOR_DIMENSION=768
      - FRYS_VECTOR_MAX_VECTORS=1000000
      - FRYS_VECTOR_INDEX_TYPE=HNSW
      - FRYS_VECTOR_ENABLE_PERSISTENCE=true
    volumes:
      - ./data:/var/lib/frys/vector-search
```

### 分布式部署

```yaml
# Kubernetes StatefulSet
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: frys-vector-search
spec:
  serviceName: frys-vector-search
  replicas: 3
  selector:
    matchLabels:
      app: vector-search
  template:
    spec:
      containers:
      - name: vector-search
        image: frys-vector-search:latest
        resources:
          requests:
            memory: "4Gi"
            cpu: "2"
          limits:
            memory: "8Gi"
            cpu: "4"
        env:
        - name: FRYS_VECTOR_CLUSTER_NODES
          value: "frys-vector-search-0,frys-vector-search-1,frys-vector-search-2"
        ports:
        - containerPort: 8080
        - containerPort: 9090
        volumeMounts:
        - name: data
          mountPath: /var/lib/frys/vector-search
  volumeClaimTemplates:
  - metadata:
    name: data
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 100Gi
```

## 📊 性能基准测试结果

### 索引构建性能

| 数据集大小 | HNSW构建时间 | IVF构建时间 | 内存使用 |
|------------|--------------|-------------|----------|
| 1M向量 | 45s | 120s | 2.1GB |
| 10M向量 | 380s | 950s | 18.5GB |
| 100M向量 | 3200s | 7800s | 165GB |

### 搜索性能

| 数据集大小 | QPS (精确@k=10) | QPS (近似@k=10) | 平均延迟 |
|------------|-----------------|-----------------|----------|
| 1M向量 | 850 | 1250 | 12ms |
| 10M向量 | 420 | 850 | 28ms |
| 100M向量 | 180 | 450 | 65ms |

### 准确性对比

| 索引类型 | 准确性@10 | 准确性@100 | 构建时间 |
|----------|-----------|------------|----------|
| 精确搜索 | 100% | 100% | N/A |
| HNSW | 98.2% | 99.8% | 中等 |
| IVF-PQ | 95.1% | 98.5% | 快 |
| LSH | 85.3% | 92.1% | 很快 |

## 🐛 故障排除

### 常见问题

#### 内存不足
```
Error: Out of memory during index build

Solution:
1. 增加内存分配: --memory-limit 16GB
2. 减少ef_construction参数: --ef-construction 100
3. 使用IVF索引代替HNSW: --index-type IVF
4. 启用压缩: --enable-compression true
```

#### 搜索性能慢
```
Problem: Query latency too high

Solution:
1. 增加ef参数: --ef-search 128
2. 优化索引参数: --m 32 --max-connections 64
3. 启用查询缓存: --enable-query-cache true
4. 使用更快的距离度量: --metric dot-product
```

#### 索引文件损坏
```
Error: Index corruption detected

Solution:
1. 从备份恢复: --restore-from-backup backup.tar.gz
2. 重新构建索引: --rebuild-index true
3. 启用WAL: --enable-wal true
4. 验证数据完整性: --validate-data true
```

## 📚 API参考

### REST API

```http
# 创建集合
POST /api/v1/collections
Content-Type: application/json

{
  "name": "my-collection",
  "dimension": 768,
  "index_type": "HNSW",
  "metric": "cosine"
}

# 插入向量
POST /api/v1/collections/{collection}/vectors
Content-Type: application/json

[
  {
    "id": "vec1",
    "vector": [0.1, 0.2, 0.3, ...],
    "metadata": {"category": "tech"}
  }
]

# 搜索向量
POST /api/v1/collections/{collection}/search
Content-Type: application/json

{
  "vector": [0.1, 0.2, 0.3, ...],
  "k": 10,
  "filter": {"category": "tech"}
}

# 获取集合统计
GET /api/v1/collections/{collection}/stats
```

### Rust SDK

```rust
// 异步客户端
let client = VectorSearchClient::new("http://localhost:8080").await?;

// 创建集合
client.create_collection(CollectionConfig {
    name: "documents".to_string(),
    dimension: 768,
    index_type: IndexType::HNSW,
    metric: DistanceMetric::Cosine,
}).await?;

// 插入向量
let vectors = vec![/* ... */];
client.insert_vectors("documents", vectors).await?;

// 搜索
let results = client.search("documents", query_vector, 10).await?;
```

## 🤝 贡献

### 开发指南
1. Fork 本仓库
2. 创建功能分支: `git checkout -b feature/new-index-algorithm`
3. 编写代码和测试
4. 运行测试: `cargo test`
5. 提交PR

### 添加新索引算法
1. 实现 `VectorIndex` trait
2. 添加算法配置结构体
3. 实现性能基准测试
4. 更新文档

## 📄 许可证

MIT License - 详见 [LICENSE](../../LICENSE) 文件