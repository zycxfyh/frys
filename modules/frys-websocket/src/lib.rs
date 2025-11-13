//! # Frys WebSocket
//!
//! Frys WebSocket is a high-performance WebSocket server and client implementation
//! designed for real-time communication, pub/sub messaging, clustering, and scalable
//! bidirectional communication in distributed systems.
//!
//! ## Features
//!
//! - **High Performance**: Asynchronous I/O with zero-copy message processing
//! - **Pub/Sub Messaging**: Redis-backed publish-subscribe with pattern matching
//! - **Clustering**: Multi-node clustering with automatic message routing
//! - **Broadcast**: Efficient broadcasting to multiple clients with filtering
//! - **Connection Management**: Smart connection pooling and lifecycle management
//! - **Security**: TLS encryption, authentication, and authorization
//! - **Monitoring**: Comprehensive metrics and health monitoring
//! - **Protocol Extensions**: Custom subprotocols and message compression
//! - **Fault Tolerance**: Automatic reconnection and message redelivery
//!
//! ## Example
//!
//! ### WebSocket Server
//!
//! ```rust,no_run
//! use frys_websocket::*;
//!
//! #[tokio::main]
//! async fn main() -> Result<(), Box<dyn std::error::Error>> {
//!     // Create WebSocket server configuration
//!     let config = WebSocketConfig {
//!         bind_addr: "0.0.0.0:8080".parse()?,
//!         max_connections: 10_000,
//!         message_timeout: Duration::from_secs(30),
//!         heartbeat_interval: Duration::from_secs(30),
//!         enable_compression: true,
//!         tls_config: Some(TlsConfig {
//!             cert_path: "./certs/server.crt".into(),
//!             key_path: "./certs/server.key".into(),
//!         }),
//!         auth_config: Some(AuthConfig {
//!             jwt_secret: "your-secret-key".into(),
//!             required_claims: vec!["websocket".into()],
//!         }),
//!         pubsub_config: Some(PubSubConfig {
//!             redis_url: "redis://localhost:6379".into(),
//!             cluster_mode: false,
//!         }),
//!     };
//!
//!     // Create WebSocket server
//!     let server = WebSocketServer::new(config).await?;
//!
//!     // Register message handlers
//!     server.register_handler("chat", |ctx, msg| async move {
//!         println!("Received chat message: {:?}", msg);
//!
//!         // Broadcast to all clients in the same room
//!         if let Some(room) = msg.headers.get("room") {
//!             ctx.broadcast_to_room(room, msg.payload).await?;
//!         }
//!
//!         Ok(MessageResponse::Ack)
//!     });
//!
//!     // Register pub/sub handlers
//!     server.register_pubsub_handler("notifications", |ctx, channel, message| async move {
//!         // Forward pub/sub messages to WebSocket clients
//!         ctx.broadcast_to_channel(&channel, message).await?;
//!         Ok(())
//!     });
//!
//!     // Start server
//!     server.start().await?;
//!
//!     Ok(())
//! }
//! ```
//!
//! ### WebSocket Client
//!
//! ```rust,no_run
//! use frys_websocket::*;
//!
//! #[tokio::main]
//! async fn main() -> Result<(), Box<dyn std::error::Error>> {
//!     // Create WebSocket client
//!     let client = WebSocketClient::connect("ws://localhost:8080/chat").await?;
//!
//!     // Set up message handler
//!     client.set_message_handler(|msg| async move {
//!         match msg.message_type {
//!             MessageType::Text => {
//!                 println!("Received: {}", String::from_utf8_lossy(&msg.payload));
//!             }
//!             MessageType::Binary => {
//!                 println!("Received binary data: {} bytes", msg.payload.len());
//!             }
//!             MessageType::Ping => {
//!                 // Handle ping
//!             }
//!             MessageType::Pong => {
//!                 // Handle pong
//!             }
//!             MessageType::Close => {
//!                 println!("Connection closed");
//!             }
//!         }
//!         Ok(())
//!     });
//!
//!     // Send messages
//!     client.send_text("Hello, WebSocket!").await?;
//!
//!     // Subscribe to topics
//!     client.subscribe("chat.room.123").await?;
//!
//!     // Keep connection alive
//!     client.run().await?;
//!
//!     Ok(())
//! }
//! ```
//!
//! ### Pub/Sub Messaging
//!
//! ```rust,no_run
//! use frys_websocket::*;
//!
//! #[tokio::main]
//! async fn main() -> Result<(), Box<dyn std::error::Error>> {
//!     // Create pub/sub client
//!     let pubsub = PubSubClient::new("redis://localhost:6379").await?;
//!
//!     // Subscribe to channels
//!     pubsub.subscribe(vec!["chat.*", "notifications"], |channel, message| async move {
//!         println!("Received on {}: {}", channel, message);
//!         Ok(())
//!     }).await?;
//!
//!     // Publish messages
//!     pubsub.publish("chat.room.123", "Hello everyone!").await?;
//!
//!     // Pattern matching
//!     pubsub.psubscribe(vec!["user.*.messages"], |pattern, channel, message| async move {
//!         println!("Pattern {} matched {}: {}", pattern, channel, message);
//!         Ok(())
//!     }).await?;
//!
//!     // Keep running
//!     pubsub.run().await?;
//!
//!     Ok(())
//! }
//! ```
//!
//! ## Advanced Features
//!
//! ### Clustering and Load Balancing
//!
//! ```rust,no_run
//! // Create clustered WebSocket server
//! let cluster_config = ClusterConfig {
//!     node_id: "node-1".into(),
//!     peers: vec![
//!         "ws://node-2:8080".into(),
//!         "ws://node-3:8080".into(),
//!     ],
//!     redis_url: "redis://cluster:6379".into(),
//!     load_balancing_strategy: LoadBalancingStrategy::ConsistentHash,
//! };
//!
//! let server = WebSocketServer::with_cluster(config, cluster_config).await?;
//!
//! // Messages are automatically routed across cluster nodes
//! server.send_to_user("user123", "Hello from cluster!").await?;
//! ```
//!
//! ### Message Broadcasting with Filtering
//!
//! ```rust,no_run
//! // Broadcast to users with specific criteria
//! let filter = BroadcastFilter {
//!     user_ids: Some(vec!["user1".into(), "user2".into()]),
//!     rooms: Some(vec!["general".into()]),
//!     user_metadata: Some(json!({"plan": "premium"})),
//!     custom_filter: Some(Box::new(|user| user.is_online && user.plan == "premium")),
//! };
//!
//! server.broadcast_with_filter(filter, "Premium announcement!").await?;
//! ```
//!
//! ### Connection Management
//!
//! ```rust,no_run
//! // Connection lifecycle management
//! let connection_manager = ConnectionManager::new(ConnectionConfig {
//!     max_connections: 10000,
//!     connection_timeout: Duration::from_secs(30),
//!     heartbeat_interval: Duration::from_secs(30),
//!     max_message_size: 1024 * 1024, // 1MB
//!     rate_limit: Some(RateLimit {
//!         messages_per_second: 100,
//!                 burst_size: 20,
//!             }),
//!     });
//!
//! // Automatic connection cleanup and monitoring
//! connection_manager.start_cleanup_task().await?;
//! ```
//!
//! ## Architecture
//!
//! The WebSocket system consists of several high-performance components:
//!
//! 1. **Connection Manager**: Smart connection lifecycle and resource management
//! 2. **Message Router**: Efficient message routing with pattern matching
//! 3. **Pub/Sub Engine**: Redis-backed publish-subscribe with clustering support
//! 4. **Broadcast System**: Efficient broadcasting with filtering and batching
//! 5. **Security Layer**: Authentication, authorization, and encryption
//! 6. **Monitoring System**: Real-time metrics and health monitoring
//! 7. **Cluster Coordinator**: Multi-node coordination and load balancing
//!
//! ## Performance Goals
//!
//! - **Concurrent Connections**: 100,000+ simultaneous WebSocket connections
//! - **Message Throughput**: 1,000,000+ messages per second per node
//! - **Latency**: Sub-millisecond message delivery within cluster
//! - **Memory Usage**: < 50MB per 10,000 connections
//! - **Scalability**: Linear scaling to 100+ nodes with consistent hashing
//! - **Reliability**: 99.99% uptime with automatic failover
//!
//! ## Security Features
//!
//! ### Authentication
//!
//! - JWT token authentication
//! - OAuth2 integration
//! - API key authentication
//! - Custom authentication providers
//!
//! ### Authorization
//!
//! - Role-based access control (RBAC)
//! - Channel-based permissions
//! - Message filtering and validation
//! - Rate limiting per connection/user
//!
//! ### Transport Security
//!
//! - TLS 1.3 encryption
//! - Certificate-based authentication
//! - Perfect forward secrecy
//! - Connection pinning
//!
//! ## Integration
//!
//! The WebSocket system integrates seamlessly with other Frys components:
//!
//! - **Event Bus**: Real-time event streaming and distribution
//! - **Agent System**: AI-powered chat and real-time interactions
//! - **Vector Search**: Real-time similarity search results
//! - **Workflow Engine**: Real-time workflow status updates
//! - **Gateway**: WebSocket proxying and load balancing
//! - **Monitoring**: Comprehensive connection and message metrics

#![cfg_attr(not(feature = "std"), no_std)]
#![warn(missing_docs)]
#![warn(rust_2018_idioms)]
#![warn(clippy::all)]
#![warn(clippy::pedantic)]

// Public API exports
pub mod core;
pub mod server;
pub mod client;
pub mod pubsub;
pub mod broadcast;
pub mod security;
pub mod monitoring;

// Re-exports for convenience
pub use core::*;
pub use server::*;
pub use client::*;
pub use pubsub::*;
pub use broadcast::*;

// Error types
mod error;
pub use error::*;

// Type aliases
#[cfg(feature = "std")]
pub type Result<T> = std::result::Result<T, WebSocketError>;
#[cfg(not(feature = "std"))]
pub type Result<T> = core::result::Result<T, WebSocketError>;

// Constants
pub const DEFAULT_WEBSOCKET_PORT: u16 = 8080;
pub const DEFAULT_MAX_CONNECTIONS: usize = 10_000;
pub const DEFAULT_MESSAGE_TIMEOUT: u64 = 30; // seconds
pub const DEFAULT_HEARTBEAT_INTERVAL: u64 = 30; // seconds
pub const DEFAULT_MAX_MESSAGE_SIZE: usize = 1024 * 1024; // 1MB
pub const DEFAULT_RATE_LIMIT_MESSAGES: u32 = 100;
pub const DEFAULT_CLUSTER_RECONNECT_DELAY: u64 = 5; // seconds

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_constants() {
        assert_eq!(DEFAULT_WEBSOCKET_PORT, 8080);
        assert_eq!(DEFAULT_MAX_CONNECTIONS, 10_000);
        assert_eq!(DEFAULT_MESSAGE_TIMEOUT, 30);
        assert_eq!(DEFAULT_HEARTBEAT_INTERVAL, 30);
        assert_eq!(DEFAULT_MAX_MESSAGE_SIZE, 1024 * 1024);
        assert_eq!(DEFAULT_RATE_LIMIT_MESSAGES, 100);
        assert_eq!(DEFAULT_CLUSTER_RECONNECT_DELAY, 5);
    }
}
