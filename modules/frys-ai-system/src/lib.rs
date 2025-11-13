//! # Frys AI System
//!
//! Frys AI System is a comprehensive AI integration platform that provides:
//!
//! - **Multi-modal AI processing**: Support for text, image, audio, and video
//! - **Sira AI Gateway integration**: Intelligent routing and load balancing
//! - **Model management**: Dynamic model loading and versioning
//! - **AI workflow orchestration**: Complex AI pipeline management
//! - **Real-time inference**: High-performance AI model execution
//! - **Intelligent caching**: Smart result caching and reuse
//!
//! ## Features
//!
//! - **Zero-copy inference**: Minimize memory allocations during AI processing
//! - **Distributed execution**: Scale AI workloads across cluster nodes
//! - **Intelligent routing**: Route requests to optimal AI models/providers
//! - **Multi-provider support**: OpenAI, Claude, Gemini, local models, etc.
//! - **Streaming responses**: Real-time streaming for long-form content
//! - **Cost optimization**: Automatic provider selection based on cost/performance
//!
//! ## Example
//!
//! ```rust,no_run
//! use frys_ai_system::*;
//!
//! #[tokio::main]
//! async fn main() -> Result<(), Box<dyn std::error::Error>> {
//!     // Initialize AI system with Sira integration
//!     let ai_system = AISystem::new(AISystemConfig {
//!         sira_gateway_url: "http://localhost:8080".to_string(),
//!         enable_caching: true,
//!         max_concurrent_requests: 100,
//!         ..Default::default()
//!     }).await?;
//!
//!     // Process multi-modal input
//!     let request = AIRequest {
//!         text: Some("Analyze this image".to_string()),
//!         image: Some(image_data),
//!         task: AITask::VisionAnalysis,
//!         priority: Priority::High,
//!     };
//!
//!     let response = ai_system.process_request(request).await?;
//!     println!("AI Response: {:?}", response);
//!
//!     Ok(())
//! }
//! ```
//!
//! ## Architecture
//!
//! The AI System consists of several key components:
//!
//! 1. **AI Gateway**: Sira AI Gateway integration and intelligent routing
//! 2. **Model Manager**: Dynamic model loading, versioning, and lifecycle
//! 3. **Inference Engine**: High-performance model execution and optimization
//! 4. **Multi-modal Processor**: Unified processing for different data types
//! 5. **Cache System**: Intelligent result caching and reuse
//! 6. **Orchestrator**: AI workflow orchestration and pipeline management
//! 7. **Metrics & Monitoring**: Performance tracking and optimization
//!
//! ## Performance Goals
//!
//! - **Inference latency**: < 100ms for typical requests
//! - **Throughput**: 1000+ requests/second per node
//! - **Cache hit rate**: > 80% for similar requests
//! - **Cost efficiency**: 30%+ cost reduction through intelligent routing
//! - **Scalability**: Linear scaling with cluster size
//!
//! ## Integration with Sira
//!
//! Frys AI System deeply integrates with the Sira AI Gateway to provide:
//!
//! - **Intelligent provider selection**: Based on cost, performance, and availability
//! - **Load balancing**: Distribute requests across multiple providers
//! - **Fallback handling**: Automatic failover to backup providers
//! - **Cost optimization**: Route to cheapest providers meeting requirements
//! - **Performance monitoring**: Track provider performance and reliability
//! - **Multi-modal support**: Unified interface for all AI modalities

#![cfg_attr(not(feature = "std"), no_std)]
#![warn(missing_docs)]
#![warn(rust_2018_idioms)]
#![warn(clippy::all)]
#![warn(clippy::pedantic)]

#![cfg_attr(not(feature = "std"), no_std)]

#[cfg(not(feature = "std"))]
extern crate alloc;

// Public API exports
pub mod core;
pub mod integration;
pub mod intelligence;
pub mod learning;
pub mod nlp;
pub mod reasoning;
pub mod vision;

// Re-exports for convenience
pub use core::*;
pub use integration::*;
pub use intelligence::*;
pub use learning::*;
pub use nlp::*;
pub use reasoning::*;
pub use vision::*;

// Error types
mod error;
pub use error::*;

// Configuration types
mod config;
pub use config::*;

// Type aliases
pub type Result<T> = core::result::Result<T, AIError>;

// Constants
pub const DEFAULT_AI_TIMEOUT: u64 = 30000; // 30 seconds
pub const MAX_AI_PAYLOAD_SIZE: usize = 50 * 1024 * 1024; // 50MB
pub const DEFAULT_CACHE_TTL: u64 = 3600; // 1 hour
pub const MAX_CONCURRENT_REQUESTS: usize = 1000;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_constants() {
        assert_eq!(DEFAULT_AI_TIMEOUT, 30000);
        assert!(MAX_AI_PAYLOAD_SIZE > 0);
        assert!(DEFAULT_CACHE_TTL > 0);
        assert!(MAX_CONCURRENT_REQUESTS > 0);
    }

    #[tokio::test]
    async fn test_ai_system_creation() {
        let config = AISystemConfig::default();
        // Basic creation test - will be expanded
        assert!(config.max_concurrent_requests > 0);
    }
}
