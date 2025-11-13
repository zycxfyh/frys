//! # Frys AI Plugin
//!
//! Frys AI Plugin provides advanced AI capabilities as a pluggable component
//! for the Frys ecosystem. It offers:
//!
//! - **Machine Learning**: Neural network inference and training
//! - **Natural Language Processing**: Text analysis, generation, and understanding
//! - **Computer Vision**: Image recognition, object detection, and analysis
//! - **Embeddings**: High-dimensional vector representations
//! - **Model Management**: Dynamic model loading and switching
//! - **Performance Optimization**: GPU acceleration and quantization
//!
//! ## Features
//!
//! - **Plugin Architecture**: Fully compatible with Frys Plugin System
//! - **Multiple Backends**: Support for PyTorch, TensorFlow, and custom models
//! - **Auto-scaling**: Dynamic resource allocation based on workload
//! - **Model Marketplace**: Integration with model registries and marketplaces
//! - **Security**: Sandboxed execution with resource limits
//! - **Monitoring**: Comprehensive metrics and performance tracking
//!
//! ## Example
//!
//! ```rust,no_run
//! use frys_plugin_ai::*;
//!
//! #[tokio::main]
//! async fn main() -> Result<(), Box<dyn std::error::Error>> {
//!     // Create AI plugin
//!     let ai_plugin = AIPlugin::new(AIPluginConfig {
//!         backend: BackendType::PyTorch,
//!         device: DeviceType::GPU,
//!         model_cache_size: 100,
//!         max_concurrent_requests: 10,
//!     }).await?;
//!
//!     // Load a model
//!     ai_plugin.load_model("bert-base-uncased", ModelType::NLP).await?;
//!
//!     // Perform inference
//!     let input = r#"{"text": "Hello, world!"}"#;
//!     let result = ai_plugin.infer("bert-base-uncased", input).await?;
//!
//!     println!("AI Result: {:?}", result);
//!
//!     Ok(())
//! }
//! ```

#![cfg_attr(not(feature = "std"), no_std)]
#![warn(missing_docs)]
#![warn(rust_2018_idioms)]
#![warn(clippy::all)]
#![warn(clippy::pedantic)]

// Re-exports
pub use frys_plugin_system as plugin_system;

// Core modules
mod core;
mod models;
mod inference;
mod training;
mod embeddings;
mod nlp;
mod vision;
mod metrics;
mod config;

// Public API
pub use core::*;
pub use models::*;
pub use inference::*;
pub use training::*;
pub use embeddings::*;
pub use nlp::*;
pub use vision::*;
pub use metrics::*;
pub use config::*;

// Error types
mod error;
pub use error::*;

// Type aliases
#[cfg(feature = "std")]
pub type Result<T> = std::result::Result<T, AIPluginError>;
#[cfg(not(feature = "std"))]
pub type Result<T> = core::result::Result<T, AIPluginError>;

// Constants
pub const DEFAULT_MODEL_CACHE_SIZE: usize = 50;
pub const DEFAULT_MAX_CONCURRENT_REQUESTS: usize = 8;
pub const DEFAULT_EMBEDDING_DIMENSION: usize = 768;
pub const DEFAULT_BATCH_SIZE: usize = 32;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_constants() {
        assert_eq!(DEFAULT_MODEL_CACHE_SIZE, 50);
        assert_eq!(DEFAULT_MAX_CONCURRENT_REQUESTS, 8);
        assert_eq!(DEFAULT_EMBEDDING_DIMENSION, 768);
        assert_eq!(DEFAULT_BATCH_SIZE, 32);
    }

    #[tokio::test]
    async fn test_plugin_creation() {
        let config = AIPluginConfig {
            backend: BackendType::CPU,
            device: DeviceType::CPU,
            model_cache_size: 10,
            max_concurrent_requests: 4,
            enable_monitoring: false,
        };

        let plugin = AIPlugin::new(config).await;
        assert!(plugin.is_ok());
    }
}
