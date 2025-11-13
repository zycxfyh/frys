//! # Frys Network Plugin
//!
//! Frys Network Plugin provides advanced network capabilities as a pluggable component
//! for the Frys ecosystem. It offers:
//!
//! - **HTTP Client/Server**: Full-featured HTTP client and server implementation
//! - **WebSocket Support**: Real-time bidirectional communication
//! - **Message Queue**: High-performance messaging with pub/sub patterns
//! - **Load Balancing**: Intelligent request distribution and failover
//! - **Service Discovery**: Automatic service registration and discovery
//! - **API Gateway**: Request routing, authentication, and rate limiting
//! - **Monitoring**: Network traffic analysis and performance metrics
//! - **Security**: TLS encryption, authentication, and access control
//!
//! ## Features
//!
//! - **Plugin Architecture**: Fully compatible with Frys Plugin System
//! - **Multiple Protocols**: HTTP/1.1, HTTP/2, WebSocket, MQTT, AMQP
//! - **Auto-scaling**: Dynamic connection pooling and resource management
//! - **Fault Tolerance**: Circuit breakers, retries, and graceful degradation
//! - **Observability**: Comprehensive logging, metrics, and tracing
//! - **Integration Ready**: Easy integration with cloud services and APIs
//!
//! ## Example
//!
//! ```rust,no_run
//! use frys_plugin_network::*;
//!
//! #[tokio::main]
//! async fn main() -> Result<(), Box<dyn std::error::Error>> {
//!     // Create network plugin
//!     let network_plugin = NetworkPlugin::new(NetworkPluginConfig {
//!         enable_http_client: true,
//!         enable_http_server: true,
//!         enable_websocket: true,
//!         enable_messaging: false,
//!         max_connections: 1000,
//!         connection_timeout_secs: 30,
//!     }).await?;
//!
//!     // Make HTTP request
//!     let response = network_plugin.http_get("https://api.example.com/data").await?;
//!     println!("Response: {}", response);
//!
//!     // Start WebSocket server
//!     network_plugin.start_websocket_server("127.0.0.1:8080", |msg| {
//!         println!("Received: {}", msg);
//!         Some(format!("Echo: {}", msg))
//!     }).await?;
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
mod http;
mod websocket;
mod messaging;
mod load_balancer;
mod service_discovery;
mod api_gateway;
mod security;
mod monitoring;
mod config;

// Public API
pub use core::*;
pub use http::*;
pub use websocket::*;
pub use messaging::*;
pub use load_balancer::*;
pub use service_discovery::*;
pub use api_gateway::*;
pub use security::*;
pub use monitoring::*;
pub use config::*;

// Error types
mod error;
pub use error::*;

// Type aliases
#[cfg(feature = "std")]
pub type Result<T> = std::result::Result<T, NetworkPluginError>;
#[cfg(not(feature = "std"))]
pub type Result<T> = core::result::Result<T, NetworkPluginError>;

// Constants
pub const DEFAULT_MAX_CONNECTIONS: usize = 1000;
pub const DEFAULT_CONNECTION_TIMEOUT_SECS: u64 = 30;
pub const DEFAULT_REQUEST_TIMEOUT_SECS: u64 = 60;
pub const DEFAULT_RATE_LIMIT_REQUESTS: u32 = 100;
pub const DEFAULT_CIRCUIT_BREAKER_THRESHOLD: u32 = 5;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_constants() {
        assert_eq!(DEFAULT_MAX_CONNECTIONS, 1000);
        assert_eq!(DEFAULT_CONNECTION_TIMEOUT_SECS, 30);
        assert_eq!(DEFAULT_REQUEST_TIMEOUT_SECS, 60);
        assert_eq!(DEFAULT_RATE_LIMIT_REQUESTS, 100);
        assert_eq!(DEFAULT_CIRCUIT_BREAKER_THRESHOLD, 5);
    }
}
