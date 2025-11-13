//! # Frys Storage Plugin
//!
//! Frys Storage Plugin provides advanced storage capabilities as a pluggable component
//! for the Frys ecosystem. It offers:
//!
//! - **File System Operations**: Advanced file and directory management
//! - **Database Integration**: SQL and NoSQL database support
//! - **Cloud Storage**: Integration with major cloud providers
//! - **Distributed Storage**: Multi-node storage with replication
//! - **Data Compression**: Automatic compression and decompression
//! - **Encryption**: End-to-end data encryption
//! - **Caching**: Intelligent storage caching and prefetching
//! - **Backup & Recovery**: Automated backup and disaster recovery
//!
//! ## Features
//!
//! - **Plugin Architecture**: Fully compatible with Frys Plugin System
//! - **Multiple Storage Backends**: File system, databases, cloud storage
//! - **Auto-scaling**: Dynamic storage allocation based on usage patterns
//! - **Data Integrity**: Checksum verification and corruption detection
//! - **Access Control**: Fine-grained permission management
//! - **Monitoring**: Comprehensive storage metrics and alerting
//! - **Migration Tools**: Seamless data migration between storage systems
//!
//! ## Example
//!
//! ```rust,no_run
//! use frys_plugin_storage::*;
//!
//! #[tokio::main]
//! async fn main() -> Result<(), Box<dyn std::error::Error>> {
//!     // Create storage plugin
//!     let storage_plugin = StoragePlugin::new(StoragePluginConfig {
//!         backend: StorageBackend::FileSystem,
//!         max_storage_size_gb: 100,
//!         enable_compression: true,
//!         enable_encryption: true,
//!         enable_caching: true,
//!     }).await?;
//!
//!     // Store data
//!     let data = b"Hello, Frys Storage!";
//!     let key = storage_plugin.store("greeting", data).await?;
//!
//!     // Retrieve data
//!     let retrieved_data = storage_plugin.retrieve(&key).await?;
//!
//!     println!("Stored and retrieved: {:?}", String::from_utf8(retrieved_data)?);
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
mod file_system;
mod database;
mod cloud;
mod distributed;
mod compression;
mod encryption;
mod caching;
mod backup;
mod metrics;
mod config;

// Public API
pub use core::*;
pub use file_system::*;
pub use database::*;
pub use cloud::*;
pub use distributed::*;
pub use compression::*;
pub use encryption::*;
pub use caching::*;
pub use backup::*;
pub use metrics::*;
pub use config::*;

// Error types
mod error;
pub use error::*;

// Type aliases
#[cfg(feature = "std")]
pub type Result<T> = std::result::Result<T, StoragePluginError>;
#[cfg(not(feature = "std"))]
pub type Result<T> = core::result::Result<T, StoragePluginError>;

// Constants
pub const DEFAULT_MAX_STORAGE_SIZE_GB: u64 = 10;
pub const DEFAULT_CHUNK_SIZE: usize = 64 * 1024; // 64KB
pub const DEFAULT_CACHE_SIZE_MB: usize = 100;
pub const DEFAULT_BACKUP_RETENTION_DAYS: u32 = 30;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_constants() {
        assert_eq!(DEFAULT_MAX_STORAGE_SIZE_GB, 10);
        assert_eq!(DEFAULT_CHUNK_SIZE, 64 * 1024);
        assert_eq!(DEFAULT_CACHE_SIZE_MB, 100);
        assert_eq!(DEFAULT_BACKUP_RETENTION_DAYS, 30);
    }
}
