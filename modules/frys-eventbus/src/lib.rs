//! # Frys EventBus
//!
//! Frys EventBus is a high-performance, lock-free event system designed for distributed systems.
//! It provides publish-subscribe messaging with advanced features like:
//!
//! - **Lock-free queues**: Segmented queues for maximum throughput
//! - **Priority routing**: QoS-based message routing and filtering
//! - **Async processing**: Backpressure-aware asynchronous event processing
//! - **Event filtering**: Content-based and header-based filtering
//! - **Monitoring**: Built-in metrics and health monitoring
//!
//! ## Features
//!
//! - **Zero-copy messaging**: Minimize memory allocations and copies
//! - **Lock-free operations**: Maximum concurrency without locks
//! - **Priority queues**: Support for different message priorities
//! - **Event filtering**: Advanced filtering capabilities
//! - **Backpressure handling**: Prevent system overload
//! - **Monitoring**: Built-in metrics and observability
//!
//! ## Example
//!
//! ```rust,no_run
//! use frys_eventbus::*;
//!
//! #[tokio::main]
//! async fn main() -> Result<(), Box<dyn std::error::Error>> {
//!     // Create event bus configuration
//!     let config = EventBusConfig {
//!         queue_size: 1024,
//!         max_subscribers: 100,
//!         enable_filtering: true,
//!         enable_priority: true,
//!         enable_monitoring: true,
//!     };
//!
//!     // Initialize event bus
//!     let mut eventbus = EventBus::new(config).await?;
//!
//!     // Create a subscriber
//!     let subscriber = eventbus.subscribe("topic.user.*", Filter::default()).await?;
//!
//!     // Publish an event
//!     let event = Event {
//!         topic: "topic.user.created".to_string(),
//!         payload: b"{\"user_id\": 123}".to_vec(),
//!         headers: Default::default(),
//!         priority: Priority::Normal,
//!         timestamp: std::time::SystemTime::now(),
//!     };
//!
//!     eventbus.publish(event).await?;
//!
//!     // Receive the event
//!     if let Some(received_event) = subscriber.receive().await {
//!         println!("Received event: {}", String::from_utf8_lossy(&received_event.payload));
//!     }
//!
//!     Ok(())
//! }
//! ```
//!
//! ## Architecture
//!
//! The EventBus consists of several key components:
//!
//! 1. **Event Publisher**: Publishes events to topics
//! 2. **Topic Router**: Routes events to appropriate subscribers
//! 3. **Subscriber Registry**: Manages subscriber registrations
//! 4. **Queue Manager**: Handles message queuing and backpressure
//! 5. **Filter Engine**: Applies filtering rules to events
//! 6. **Monitor**: Collects metrics and health information
//!
//! ## Performance Goals
//!
//! - **Throughput**: 1M+ events/second
//! - **Latency**: < 10μs P99 for local delivery
//! - **Memory usage**: < 100MB for 1M queued events
//! - **Scalability**: Linear scaling with CPU cores

#![cfg_attr(not(feature = "std"), no_std)]
#![warn(missing_docs)]
#![warn(rust_2018_idioms)]
#![warn(clippy::all)]
#![warn(clippy::pedantic)]

#[cfg(not(feature = "std"))]
extern crate alloc;

// Public API exports
pub mod core;
pub mod pubsub;
pub mod routing;
pub mod queues;
pub mod async;
pub mod distributed;

// Re-exports for convenience
pub use core::*;
pub use pubsub::*;
pub use routing::*;
pub use queues::*;
pub use async::*;
pub use distributed::*;

// Error types
mod error;
pub use error::*;

// Configuration types
mod config;
pub use config::*;

// Metrics and monitoring
mod metrics;
pub use metrics::*;

// Type aliases
pub type Result<T> = core::result::Result<T, EventBusError>;

// Constants
pub const DEFAULT_QUEUE_SIZE: usize = 1024;
pub const DEFAULT_MAX_SUBSCRIBERS: usize = 1000;
pub const MAX_TOPIC_LENGTH: usize = 256;
pub const MAX_PAYLOAD_SIZE: usize = 64 * 1024 * 1024; // 64MB

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_constants() {
        assert_eq!(DEFAULT_QUEUE_SIZE, 1024);
        assert_eq!(DEFAULT_MAX_SUBSCRIBERS, 1000);
        assert!(MAX_TOPIC_LENGTH > 0);
        assert!(MAX_PAYLOAD_SIZE > 0);
    }

    #[tokio::test]
    async fn test_basic_eventbus_creation() {
        let config = EventBusConfig::default();
        let eventbus = EventBus::new(config).await.unwrap();
        // Basic test - just ensure creation works
        drop(eventbus);
    }
}
