//! # Frys Vector Search
//!
//! Frys Vector Search is a high-performance vector similarity search system designed for
//! large-scale embeddings search with advanced algorithms and distributed processing.
//!
//! ## Features
//!
//! - **Multiple Algorithms**: HNSW, IVF, PQ, LSH with automatic algorithm selection
//! - **High Performance**: Billion-scale vector search with sub-millisecond latency
//! - **Distributed Search**: Multi-node vector search with consensus algorithms
//! - **GPU Acceleration**: CUDA/ROCm support for massive parallel processing
//! - **Advanced Indexing**: Hierarchical indexing with quantization and compression
//! - **Real-time Updates**: Incremental indexing and online learning
//! - **Multi-modal**: Support for text, image, audio, and custom embeddings
//! - **Intelligent Caching**: ML-based cache management and prefetching
//! - **ML Integration**: Machine learning enhanced search with query expansion and optimization
//! - **Real-time Analytics**: Comprehensive statistics and performance monitoring
//! - **Auto-tuning**: ML-driven parameter optimization and algorithm selection
//!
//! ## Example
//!
//! ```rust,no_run
//! use frys_vector_search::*;
//!
//! #[tokio::main]
//! async fn main() -> Result<(), Box<dyn std::error::Error>> {
//!     // Create vector search engine with advanced configuration
//!     let engine = VectorSearchEngine::builder()
//!         .with_algorithm(Algorithm::HNSW)
//!         .with_dimensions(768)  // BERT embedding size
//!         .with_max_elements(1_000_000)
//!         .with_metric(Metric::Cosine)
//!         .with_gpu_acceleration(true)
//!         .with_distributed(vec!["redis://localhost:6379".into()])
//!         .build()
//!         .await?;
//!
//!     // Index vectors with metadata
//!     let vectors = generate_embeddings(text_documents);
//!     let metadata = create_metadata(documents);
//!
//!     engine.index_batch(vectors, metadata).await?;
//!
//!     // Search for similar vectors
//!     let query_vector = embed_query("machine learning");
//!     let results = engine.search(query_vector, SearchConfig {
//!         k: 10,
//!         ef: 64,
//!         include_metadata: true,
//!         filter: Some(Box::new(|metadata| {
//!             metadata.get("category") == Some(&"AI".into())
//!         })),
//!     }).await?;
//!
//!     for result in results {
//!         println!("ID: {}, Score: {:.4}, Distance: {:.4}",
//!                  result.id, result.score, result.distance);
//!     }
//!
//!     Ok(())
//! }
//! ```
//!
//! ## Advanced Algorithms
//!
//! ### Hierarchical Navigable Small World (HNSW)
//! - **Graph-based indexing**: Multi-layer graph with navigable small world properties
//! - **Optimal search quality**: Best recall-precision trade-off
//! - **Incremental construction**: Online index building without full rebuild
//!
//! ### Inverted File with Product Quantization (IVF-PQ)
//! - **Clustering-based**: Voronoi cells for coarse quantization
//! - **Product quantization**: Fine-grained vector compression
//! - **Memory efficient**: Sub-linear space complexity
//!
//! ### Locality Sensitive Hashing (LSH)
//! - **Probabilistic search**: Approximate nearest neighbors with guarantees
//! - **Scalable hashing**: Multiple hash tables for high recall
//! - **Custom metrics**: Support for non-metric distance functions
//!
//! ## Architecture
//!
//! The Vector Search system consists of several advanced components:
//!
//! 1. **Algorithm Selector**: ML-based algorithm selection for optimal performance
//! 2. **Index Manager**: Multi-index management with automatic optimization
//! 3. **Query Processor**: Distributed query processing with load balancing
//! 4. **Vector Processor**: SIMD-optimized vector operations
//! 5. **Cache Manager**: Intelligent caching with prefetching
//! 6. **Storage Engine**: Optimized storage for high-dimensional vectors
//! 7. **ML Integration Layer**: Machine learning enhanced search and optimization
//! 8. **Real-time Statistics**: Comprehensive analytics and monitoring
//! 9. **Auto-tuning System**: ML-driven parameter optimization
//!
//! ## Performance Goals
//!
//! - **Indexing**: 1M vectors/second with HNSW, 10M vectors/second with IVF
//! - **Search**: < 1ms for 10-NN on 1M vectors, < 10ms on 1B vectors
//! - **Recall**: > 95% recall@10 for typical similarity search
//! - **Memory**: < 1GB for 1M 768D vectors with PQ compression
//! - **Scalability**: Linear scaling to 1000+ nodes with distributed search

#![cfg_attr(not(feature = "std"), no_std)]
#![warn(missing_docs)]
#![warn(rust_2018_idioms)]
#![warn(clippy::all)]
#![warn(clippy::pedantic)]

// Public API exports
pub mod core;
pub mod algorithms;
pub mod indexing;
pub mod query;
pub mod storage;
pub mod distributed;
pub mod ml_integration;
pub mod realtime_stats;

// Re-exports for convenience
pub use core::*;
pub use algorithms::*;
pub use indexing::*;
pub use query::*;
pub use storage::*;
pub use distributed::*;
pub use ml_integration::*;
pub use realtime_stats::*;

// Error types
mod error;
pub use error::*;

// Type aliases
#[cfg(feature = "std")]
pub type Result<T> = std::result::Result<T, VectorSearchError>;
#[cfg(not(feature = "std"))]
pub type Result<T> = core::result::Result<T, VectorSearchError>;

// Constants
pub const DEFAULT_VECTOR_DIMENSIONS: usize = 768;
pub const DEFAULT_MAX_ELEMENTS: usize = 1_000_000;
pub const DEFAULT_EF_CONSTRUCTION: usize = 200;
pub const DEFAULT_M: usize = 16;
pub const DEFAULT_EF: usize = 64;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_constants() {
        assert_eq!(DEFAULT_VECTOR_DIMENSIONS, 768);
        assert_eq!(DEFAULT_MAX_ELEMENTS, 1_000_000);
        assert_eq!(DEFAULT_EF_CONSTRUCTION, 200);
        assert_eq!(DEFAULT_M, 16);
        assert_eq!(DEFAULT_EF, 64);
    }
}
