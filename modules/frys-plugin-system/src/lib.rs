//! # Frys Plugin System
//!
//! Frys Plugin System is a secure, sandboxed plugin architecture designed for distributed systems.
//! It provides:
//!
//! - **Secure Sandboxing**: WASM-based plugin isolation
//! - **Hot Loading**: Dynamic plugin loading without restart
//! - **Plugin Registry**: Centralized plugin management and discovery
//! - **Communication**: Safe inter-plugin and host communication
//! - **Version Management**: Plugin versioning and compatibility
//! - **Resource Limits**: Memory, CPU, and network restrictions
//!
//! ## Features
//!
//! - **WASM Sandboxing**: Complete isolation using WebAssembly
//! - **Native Plugins**: Support for native dynamic libraries
//! - **Hot Reloading**: Runtime plugin updates
//! - **Plugin Dependencies**: Dependency management and resolution
//! - **Security Policies**: Configurable security restrictions
//! - **Metrics & Monitoring**: Comprehensive plugin monitoring
//! - **Plugin Marketplace**: Plugin discovery and distribution
//!
//! ## Example
//!
//! ```rust,no_run
//! use frys_plugin_system::*;
//!
//! #[tokio::main]
//! async fn main() -> Result<(), Box<dyn std::error::Error>> {
//!     // Create plugin manager
//!     let manager = PluginManager::builder()
//!         .with_sandbox(true)
//!         .with_hot_reload(true)
//!         .with_registry("http://plugin-registry.example.com")
//!         .build()
//!         .await?;
//!
//!     // Load a plugin
//!     let plugin_id = manager.load_plugin("./plugins/my-plugin.wasm").await?;
//!
//!     // Execute plugin
//!     let result = manager.execute_plugin(plugin_id, "process_data", b"input data").await?;
//!
//!     println!("Plugin result: {:?}", result);
//!
//!     Ok(())
//! }
//! ```
//!
//! ## Architecture
//!
//! The Plugin System consists of several key components:
//!
//! 1. **PluginManager**: Main plugin interface and orchestration
//! 2. **PluginLoader**: Loads plugins from various sources
//! 3. **PluginSandbox**: WASM-based isolation environment
//! 4. **PluginRegistry**: Plugin discovery and metadata management
//! 5. **PluginCommunicator**: Safe inter-plugin communication
//! 6. **SecurityManager**: Plugin security policies and enforcement
//! 7. **ResourceLimiter**: Resource usage limits and monitoring

#![cfg_attr(not(feature = "std"), no_std)]
#![warn(missing_docs)]
#![warn(rust_2018_idioms)]
#![warn(clippy::all)]
#![warn(clippy::pedantic)]

// Public API exports
pub mod core;
pub mod loader;
pub mod sandbox;
pub mod isolation;
pub mod registry;
pub mod communication;

// Re-exports for convenience
pub use core::*;
pub use loader::*;
pub use sandbox::*;
pub use isolation::*;
pub use registry::*;
pub use communication::*;

// Error types
mod error;
pub use error::*;

// Type aliases
#[cfg(feature = "std")]
pub type Result<T> = std::result::Result<T, PluginError>;
#[cfg(not(feature = "std"))]
pub type Result<T> = core::result::Result<T, PluginError>;

// Constants
pub const DEFAULT_PLUGIN_TIMEOUT: u64 = 30; // 30 seconds
pub const MAX_PLUGIN_MEMORY: usize = 128 * 1024 * 1024; // 128MB
pub const MAX_PLUGIN_INSTANCES: usize = 100;
pub const PLUGIN_REGISTRY_DEFAULT: &str = "https://registry.frys.io";

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_constants() {
        assert_eq!(DEFAULT_PLUGIN_TIMEOUT, 30);
        assert!(MAX_PLUGIN_MEMORY > 0);
        assert!(MAX_PLUGIN_INSTANCES > 0);
    }

    #[cfg(feature = "std")]
    #[tokio::test]
    async fn test_plugin_manager_creation() {
        let manager = PluginManager::builder().build().await.unwrap();
        // Basic test - just ensure creation works
        drop(manager);
    }
}
