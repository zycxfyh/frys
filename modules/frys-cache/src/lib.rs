//! # Frys Cache
//!
//! Frys Cache is a multi-level caching system designed for high-performance applications.
//! It provides:
//!
//! - **Multi-level caching**: Memory LRU, persistent storage, distributed cache
//! - **Flexible policies**: TTL, size limits, eviction strategies
//! - **Consistency**: Write-through, write-back, and cache-aside patterns
//! - **Persistence**: Durable storage with compression
//! - **Distribution**: Redis cluster support for distributed caching
//! - **Preloading**: Intelligent cache warming and prefetching
//!
//! ## Features
//!
//! - **Memory LRU Cache**: High-performance in-memory caching with O(1) operations
//! - **Persistent Storage**: Sled-based durable storage with ZSTD compression
//! - **Distributed Cache**: Redis cluster support for multi-node deployments
//! - **Cache Policies**: TTL, size limits, custom eviction strategies
//! - **Consistency Models**: Write-through, write-back, cache-aside
//! - **Cache Warming**: Preloading and prefetching mechanisms
//! - **Metrics**: Comprehensive cache statistics and monitoring
//! - **Async Support**: Full async/await support throughout
//!
//! ## Example
//!
//! ```rust,no_run
//! use frys_cache::*;
//!
//! #[tokio::main]
//! async fn main() -> Result<(), Box<dyn std::error::Error>> {
//!     // Create a multi-level cache
//!     let cache = CacheBuilder::new()
//!         .with_memory_lru(1000)  // 1000 items in memory
//!         .with_persistent("./cache.db")  // Persistent storage
//!         .with_ttl(Duration::from_secs(3600))  // 1 hour TTL
//!         .with_compression(true)
//!         .build()
//!         .await?;
//!
//!     // Store data
//!     cache.put("user:123", b"{'name': 'Alice'}").await?;
//!
//!     // Retrieve data
//!     if let Some(data) = cache.get("user:123").await? {
//!         println!("Found user: {}", String::from_utf8_lossy(&data));
//!     }
//!
//!     Ok(())
//! }
//! ```
//!
//! ## Architecture
//!
//! The Cache system consists of several key components:
//!
//! 1. **CacheManager**: Main cache interface coordinating all levels
//! 2. **MemoryCache**: High-performance LRU in-memory cache
//! 3. **PersistentCache**: Durable storage using Sled with compression
//! 4. **DistributedCache**: Redis cluster for distributed caching
//! 5. **CachePolicy**: Eviction and expiration policies
//! 6. **ConsistencyManager**: Ensures data consistency across levels
//! 7. **Preloader**: Intelligent cache warming
//!
//! ## Performance Goals
//!
//! - **Memory cache**: < 10ns read/write for hot data
//! - **Persistent cache**: < 100μs for compressed data
//! - **Hit ratio**: > 95% for well-designed workloads
//! - **Memory usage**: < 2x data size with overhead
//! - **Scalability**: Linear scaling with cache levels

#![cfg_attr(not(feature = "std"), no_std)]
#![warn(missing_docs)]
#![warn(rust_2018_idioms)]
#![warn(clippy::all)]
#![warn(clippy::pedantic)]

#[cfg(not(feature = "std"))]
extern crate alloc;

// Public API exports
pub mod core;
pub mod policies;
pub mod backends;
pub mod consistency;
pub mod preloader;

// Re-exports for convenience
pub use core::*;
pub use policies::*;
pub use backends::*;
pub use consistency::*;
pub use preloader::*;

// Error types
mod error;
pub use error::*;

// Type aliases
#[cfg(feature = "std")]
pub type Result<T> = std::result::Result<T, CacheError>;
#[cfg(not(feature = "std"))]
pub type Result<T> = core::result::Result<T, CacheError>;

// Constants
pub const DEFAULT_CACHE_SIZE: usize = 1000;
pub const DEFAULT_TTL_SECS: u64 = 3600; // 1 hour
pub const MAX_KEY_SIZE: usize = 1024;
pub const MAX_VALUE_SIZE: usize = 10 * 1024 * 1024; // 10MB
pub const DEFAULT_COMPRESSION_LEVEL: i32 = 3;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_constants() {
        assert_eq!(DEFAULT_CACHE_SIZE, 1000);
        assert_eq!(DEFAULT_TTL_SECS, 3600);
        assert!(MAX_KEY_SIZE > 0);
        assert!(MAX_VALUE_SIZE > 0);
        assert!(DEFAULT_COMPRESSION_LEVEL >= 0);
    }

    #[cfg(feature = "std")]
    #[tokio::test]
    async fn test_cache_creation() {
        let cache = CacheBuilder::new().build().await.unwrap();
        // Basic test - just ensure creation works
        drop(cache);
    }
}
