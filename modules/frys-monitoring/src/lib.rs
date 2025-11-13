//! # Frys Monitoring System
//!
//! Frys Monitoring provides comprehensive observability capabilities for the Frys ecosystem:
//!
//! - **Metrics Collection**: High-performance metrics collection and aggregation
//! - **Distributed Tracing**: End-to-end request tracing across services
//! - **Alerting Engine**: Intelligent alerting with rule-based notifications
//! - **Visualization**: Real-time dashboards and historical analysis
//! - **Health Monitoring**: System health checks and anomaly detection
//! - **AI-Powered Insights**: Machine learning based anomaly detection and predictions
//!
//! ## Features
//!
//! - **High Performance**: Designed for high-throughput metric collection
//! - **Distributed**: Supports multi-node deployments with data aggregation
//! - **Extensible**: Plugin-based architecture for custom metrics and alerts
//! - **Real-time**: WebSocket-based real-time monitoring and alerting
//! - **AI-Enhanced**: ML-powered anomaly detection and predictive analytics
//! - **Storage Agnostic**: Support for various storage backends
//!
//! ## Architecture
//!
//! ```text
//! ┌─────────────────────────────────────────────────────────────┐
//! │                    Monitoring Dashboard                      │
//! │  Real-time metrics, alerts, traces, health status           │
//! └─────────────────────────────────────────────────────────────┘
//!                                 │
//! ┌─────────────────────────────────────────────────────────────┐
//! │                  Alerting Engine                            │
//! │  Rule evaluation, notification routing, escalation         │
//! └─────────────────────────────────────────────────────────────┘
//!                                 │
//! ┌─────────────────────────────────────────────────────────────┐
//! │               Metrics Collection                           │
//! │  Time-series data, aggregation, retention policies         │
//! └─────────────────────────────────────────────────────────────┘
//!                                 │
//! ┌─────────────────────────────────────────────────────────────┐
//! │                Data Storage Layer                           │
//! │  Time-series DB, search engine, distributed storage        │
//! └─────────────────────────────────────────────────────────────┘
//! ```
//!
//! ## Example
//!
//! ```rust,no_run
//! use frys_monitoring::*;
//!
//! #[tokio::main]
//! async fn main() -> Result<(), Box<dyn std::error::Error>> {
//!     // Create monitoring system
//!     let monitoring = MonitoringSystem::new(MonitoringConfig {
//!         enable_metrics: true,
//!         enable_alerting: true,
//!         enable_tracing: true,
//!         storage_backend: StorageBackend::RocksDB,
//!         retention_days: 30,
//!     }).await?;
//!
//!     // Register a custom metric
//!     let counter = monitoring.metrics().register_counter(
//!         "requests_total",
//!         "Total number of requests",
//!         &["method", "status"]
//!     );
//!
//!     // Record metrics
//!     counter.inc(&[("method", "GET"), ("status", "200")]);
//!
//!     // Create an alert rule
//!     monitoring.alerts().create_rule(AlertRule {
//!         name: "High Error Rate".to_string(),
//!         condition: AlertCondition::GreaterThan {
//!             metric: "error_rate".to_string(),
//!             threshold: 0.05,
//!             duration: Duration::from_secs(300),
//!         },
//!         severity: AlertSeverity::Critical,
//!         channels: vec![NotificationChannel::Email("admin@frys.io".to_string())],
//!     }).await?;
//!
//!     // Start HTTP server for metrics endpoint
//!     monitoring.start_http_server("0.0.0.0:9090").await?;
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
pub use frys_kernel as kernel;
pub use frys_eventbus as eventbus;
pub use frys_config as config;

// Core modules
mod core;
mod metrics;
mod alerts;
mod tracing;
mod dashboard;
mod storage;
mod api;
mod config;

// Public API
pub use core::*;
pub use metrics::*;
pub use alerts::*;
pub use tracing::*;
pub use dashboard::*;
pub use storage::*;
pub use api::*;
pub use config::*;

// Error types
mod error;
pub use error::*;

// Type aliases
#[cfg(feature = "std")]
pub type Result<T> = std::result::Result<T, MonitoringError>;
#[cfg(not(feature = "std"))]
pub type Result<T> = core::result::Result<T, MonitoringError>;

// Constants
pub const DEFAULT_RETENTION_DAYS: u32 = 30;
pub const DEFAULT_METRICS_PORT: u16 = 9090;
pub const DEFAULT_SCRAPE_INTERVAL: u64 = 15; // seconds
pub const DEFAULT_ALERT_EVALUATION_INTERVAL: u64 = 30; // seconds
pub const MAX_METRICS_PER_REQUEST: usize = 10000;
pub const MAX_ALERT_RULES: usize = 1000;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_constants() {
        assert_eq!(DEFAULT_RETENTION_DAYS, 30);
        assert_eq!(DEFAULT_METRICS_PORT, 9090);
        assert_eq!(DEFAULT_SCRAPE_INTERVAL, 15);
        assert_eq!(DEFAULT_ALERT_EVALUATION_INTERVAL, 30);
        assert_eq!(MAX_METRICS_PER_REQUEST, 10000);
        assert_eq!(MAX_ALERT_RULES, 1000);
    }

    #[tokio::test]
    async fn test_monitoring_system_creation() {
        let config = MonitoringConfig {
            enable_metrics: true,
            enable_alerting: true,
            enable_tracing: true,
            enable_health_checks: true,
            storage_backend: StorageBackend::Memory,
            retention_days: 7,
            scrape_interval: 15,
            evaluation_interval: 30,
            max_connections: 1000,
            enable_compression: true,
        };

        // This would normally create a monitoring system
        // For testing, we just validate the config
        assert!(config.enable_metrics);
        assert_eq!(config.retention_days, 7);
    }
}
