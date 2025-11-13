//! # Frys Config
//!
//! Frys Config is a hierarchical configuration management system designed for distributed systems.
//! It provides:
//!
//! - **Hierarchical configuration**: Multi-layer configuration merging
//! - **Hot reload**: Automatic configuration updates without restart
//! - **Type safety**: Compile-time and runtime configuration validation
//! - **Multiple sources**: File, environment variables, remote configs
//! - **Version management**: Smooth upgrades and backward compatibility
//!
//! ## Features
//!
//! - **Zero-copy configuration**: Minimal memory allocations
//! - **Type-safe access**: Strongly typed configuration values
//! - **Hot reloading**: File system watching for config changes
//! - **Validation**: Schema-based validation with detailed errors
//! - **Migration support**: Automatic config migration between versions
//! - **Multi-format support**: JSON, YAML, TOML, custom formats
//!
//! ## Example
//!
//! ```rust,no_run
//! use frys_config::*;
//!
//! #[tokio::main]
//! async fn main() -> Result<(), Box<dyn std::error::Error>> {
//!     // Create configuration manager
//!     let config = ConfigManager::builder()
//!         .with_default_path("./config/default.json")
//!         .with_env_prefix("MYAPP")
//!         .with_hot_reload(true)
//!         .build()
//!         .await?;
//!
//!     // Get typed configuration
//!     let server_config: ServerConfig = config.get("server")?;
//!
//!     println!("Server port: {}", server_config.port);
//!     println!("Server host: {}", server_config.host);
//!
//!     Ok(())
//! }
//! ```
//!
//! ## Architecture
//!
//! The Config system consists of several key components:
//!
//! 1. **ConfigManager**: Main configuration interface
//! 2. **ConfigProviders**: Different configuration sources
//! 3. **ConfigValidator**: Validation and type checking
//! 4. **HotReloader**: File watching and hot reload
//! 5. **ConfigMigration**: Version management and migration
//!
//! ## Performance Goals
//!
//! - **Load time**: < 10ms for typical configurations
//! - **Memory usage**: < 1MB for complex configurations
//! - **Reload latency**: < 100ms for hot reload
//! - **Validation speed**: > 10K validations/second

#![cfg_attr(not(feature = "std"), no_std)]
#![warn(missing_docs)]
#![warn(rust_2018_idioms)]
#![warn(clippy::all)]
#![warn(clippy::pedantic)]

#[cfg(not(feature = "std"))]
extern crate alloc;

// Public API exports
pub mod core;
pub mod providers;
pub mod validation;
pub mod hot_reload;
pub mod distributed;

// Re-exports for convenience
pub use core::*;
pub use providers::*;
pub use validation::*;
pub use distributed::*;
pub use hot_reload::*;

// Error types
mod error;
pub use error::*;

// Type aliases
#[cfg(not(feature = "std"))]
pub type Result<T> = core::result::Result<T, ConfigError>;
#[cfg(feature = "std")]
pub type Result<T> = std::result::Result<T, ConfigError>;

// Constants
pub const DEFAULT_CONFIG_PATH: &str = "./config";
pub const DEFAULT_FILE_NAME: &str = "config.json";
pub const MAX_CONFIG_SIZE: usize = 10 * 1024 * 1024; // 10MB
pub const MAX_NESTING_DEPTH: usize = 10;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_constants() {
        assert_eq!(DEFAULT_CONFIG_PATH, "./config");
        assert_eq!(DEFAULT_FILE_NAME, "config.json");
        assert!(MAX_CONFIG_SIZE > 0);
        assert!(MAX_NESTING_DEPTH > 0);
    }

    #[tokio::test]
    async fn test_config_manager_creation() {
        let manager = ConfigManager::builder().build().await.unwrap();
        // Basic test - just ensure creation works
        drop(manager);
    }
}
