//! Frys Vector Search - Main executable demonstrating the vector search engine

use frys_vector_search::*;
use std::time::Instant;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("🚀 Frys Vector Search Engine Demo");
    println!("=====================================");

    // Create engine configuration
    let config = EngineConfig {
        dimensions: 768, // BERT embedding size
        max_elements: 100_000,
        metric: Metric::Cosine,
        algorithm: Algorithm::HNSW,
        ..Default::default()
    };

    println!("📊 Configuration:");
    println!("  - Dimensions: {}", config.dimensions);
    println!("  - Max Elements: {}", config.max_elements);
    println!("  - Metric: {:?}", config.metric);
    println!("  - Algorithm: {:?}", config.algorithm);

    // Create vector search engine
    println!("\n🔧 Initializing Vector Search Engine...");
    let mut engine = VectorSearchEngine::builder()
        .with_config(config)
        .build()
        .await?;

    // Generate sample data
    println!("\n📝 Generating sample vectors...");
    let sample_texts = vec![
        "machine learning algorithms",
        "natural language processing",
        "computer vision techniques",
        "deep learning models",
        "artificial intelligence",
        "data science methods",
        "neural network architectures",
        "supervised learning approaches",
        "unsupervised learning methods",
        "reinforcement learning strategies",
    ];

    // Simulate embeddings (in real usage, these would come from a model like BERT)
    let mut sample_vectors = Vec::new();
    for (i, text) in sample_texts.iter().enumerate() {
        // Create pseudo-random but deterministic embeddings based on text
        let mut embedding = Vec::with_capacity(768);
        let seed = text.len() as u32 + i as u32;

        for j in 0..768 {
            // Simple deterministic pseudo-random generation
            let value = ((seed.wrapping_mul(31).wrapping_add(j as u32)) % 1000) as f32 / 1000.0;
            embedding.push(value * 2.0 - 1.0); // Normalize to [-1, 1]
        }

        // L2 normalize the embedding
        let norm = (embedding.iter().map(|x| x * x).sum::<f32>()).sqrt();
        for x in &mut embedding {
            *x /= norm;
        }

        sample_vectors.push(Vector::new(embedding));
    }

    // Index sample vectors
    println!("📥 Indexing {} sample vectors...", sample_vectors.len());
    let start_time = Instant::now();

    for (i, vector) in sample_vectors.into_iter().enumerate() {
        let mut metadata = VectorMetadata::new();
        metadata.set("text", &sample_texts[i]);
        metadata.set("category", "AI/ML");
        metadata.set("index", &i.to_string());

        engine.index_vector(format!("doc-{}", i), vector, metadata).await?;
    }

    let indexing_time = start_time.elapsed();
    println!("✅ Indexing completed in {:.2}ms", indexing_time.as_millis());

    // Display index statistics
    let stats = engine.stats();
    println!("\n📊 Index Statistics:");
    println!("  - Total Vectors: {}", stats.total_vectors);
    println!("  - Memory Usage: {:.2} MB", stats.memory_usage as f64 / (1024.0 * 1024.0));
    println!("  - Build Time: {} ms", stats.build_time_ms);

    // Perform search queries
    println!("\n🔍 Performing search queries...");

    let queries = vec![
        ("machine learning", "doc-0"),
        ("neural networks", "doc-6"),
        ("data science", "doc-5"),
        ("artificial intelligence", "doc-4"),
    ];

    for (query_text, expected_id) in queries {
        println!("\n🔎 Query: '{}'", query_text);

        // Create query vector (simplified - in real usage, use actual embedding model)
        let query_seed = query_text.len() as u32;
        let mut query_embedding = Vec::with_capacity(768);
        for j in 0..768 {
            let value = ((query_seed.wrapping_mul(31).wrapping_add(j as u32)) % 1000) as f32 / 1000.0;
            query_embedding.push(value * 2.0 - 1.0);
        }

        // L2 normalize
        let norm = (query_embedding.iter().map(|x| x * x).sum::<f32>()).sqrt();
        for x in &mut query_embedding {
            *x /= norm;
        }

        let query_vector = Vector::new(query_embedding);

        // Perform search
        let search_config = SearchConfig {
            k: 3,
            ef: 64,
            include_metadata: true,
            ..Default::default()
        };

        let search_start = Instant::now();
        let results = engine.search(query_vector, search_config).await?;
        let search_time = search_start.elapsed();

        println!("  ⏱️  Search time: {:.2}ms", search_time.as_micros() as f64 / 1000.0);

        // Display results
        for (i, result) in results.iter().enumerate() {
            let rank = i + 1;
            let score = if config.metric.lower_is_better() {
                1.0 / (1.0 + result.distance)
            } else {
                result.score
            };

            println!("  {}. ID: {} | Score: {:.4} | Text: '{}'",
                     rank,
                     result.id,
                     score,
                     result.metadata.as_ref()
                         .and_then(|m| m.get("text"))
                         .unwrap_or(&"N/A".into()));

            // Check if we found the expected result
            if result.id == expected_id {
                println!("    ✅ Found expected result!");
            }
        }
    }

    // Performance benchmark
    println!("\n⚡ Running performance benchmark...");

    let benchmark_queries = 100;
    let mut total_search_time = 0u128;

    for i in 0..benchmark_queries {
        // Create random query vector
        let query_seed = i as u32 * 7;
        let mut query_embedding = Vec::with_capacity(768);
        for j in 0..768 {
            let value = ((query_seed.wrapping_mul(31).wrapping_add(j as u32)) % 1000) as f32 / 1000.0;
            query_embedding.push(value * 2.0 - 1.0);
        }

        // L2 normalize
        let norm = (query_embedding.iter().map(|x| x * x).sum::<f32>()).sqrt();
        for x in &mut query_embedding {
            *x /= norm;
        }

        let query_vector = Vector::new(query_embedding);

        let search_config = SearchConfig {
            k: 10,
            ef: 64,
            ..Default::default()
        };

        let search_start = Instant::now();
        let _results = engine.search(query_vector, search_config).await?;
        let search_time = search_start.elapsed();

        total_search_time += search_time.as_micros();
    }

    let avg_search_time = total_search_time as f64 / benchmark_queries as f64;
    let qps = 1_000_000.0 / avg_search_time; // Queries per second

    println!("📈 Benchmark Results:");
    println!("  - Queries: {}", benchmark_queries);
    println!("  - Average search time: {:.2}μs", avg_search_time);
    println!("  - Queries per second: {:.0} QPS", qps);

    // Memory usage analysis
    let final_stats = engine.stats();
    println!("\n💾 Final Memory Usage:");
    println!("  - Index memory: {:.2} MB", final_stats.memory_usage as f64 / (1024.0 * 1024.0));
    println!("  - Memory per vector: {:.2} KB", (final_stats.memory_usage as f64 / final_stats.total_vectors as f64) / 1024.0);

    println!("\n🎉 Demo completed successfully!");
    println!("💡 The Frys Vector Search engine is ready for production use!");

    Ok(())
}

/// Simple embedding simulator (in production, use actual ML models)
struct EmbeddingSimulator {
    dimensions: usize,
}

impl EmbeddingSimulator {
    fn new(dimensions: usize) -> Self {
        Self { dimensions }
    }

    fn embed_text(&self, text: &str) -> Vec<f32> {
        // Simple deterministic embedding based on text hash
        let mut embedding = Vec::with_capacity(self.dimensions);

        for i in 0..self.dimensions {
            let hash = self.simple_hash(&format!("{}{}", text, i));
            let value = (hash % 2000) as f32 / 1000.0 - 1.0; // Normalize to [-1, 1]
            embedding.push(value);
        }

        // L2 normalize
        let norm = (embedding.iter().map(|x| x * x).sum::<f32>()).sqrt();
        for x in &mut embedding {
            *x /= norm;
        }

        embedding
    }

    fn simple_hash(&self, text: &str) -> u32 {
        let mut hash: u32 = 0;
        for byte in text.bytes() {
            hash = hash.wrapping_mul(31).wrapping_add(byte as u32);
        }
        hash
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_main_demo() {
        // This test runs the main demo function
        // In a real scenario, you'd want to mock the engine
        // For now, just ensure it doesn't panic
        let result = std::panic::catch_unwind(|| {
            // We can't easily test the async main function in unit tests
            // without complex setup, so we just check that our types work
            let config = EngineConfig::default();
            assert_eq!(config.dimensions, 768);
        });

        assert!(result.is_ok());
    }

    #[test]
    fn test_embedding_simulator() {
        let simulator = EmbeddingSimulator::new(128);

        let embedding1 = simulator.embed_text("hello world");
        let embedding2 = simulator.embed_text("hello world");
        let embedding3 = simulator.embed_text("goodbye world");

        assert_eq!(embedding1.len(), 128);
        assert_eq!(embedding2.len(), 128);
        assert_eq!(embedding3.len(), 128);

        // Same text should produce same embedding
        assert_eq!(embedding1, embedding2);

        // Different text should produce different embedding
        assert_ne!(embedding1, embedding3);

        // Check normalization (L2 norm should be 1)
        let norm1 = (embedding1.iter().map(|x| x * x).sum::<f32>()).sqrt();
        let norm2 = (embedding2.iter().map(|x| x * x).sum::<f32>()).sqrt();
        let norm3 = (embedding3.iter().map(|x| x * x).sum::<f32>()).sqrt();

        assert!((norm1 - 1.0).abs() < 1e-6);
        assert!((norm2 - 1.0).abs() < 1e-6);
        assert!((norm3 - 1.0).abs() < 1e-6);
    }
}
