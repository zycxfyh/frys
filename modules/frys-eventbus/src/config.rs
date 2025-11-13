//! EventBus configuration types

/// EventBus configuration
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EventBusConfig {
    /// Maximum queue size for each subscriber
    pub queue_size: usize,

    /// Maximum number of subscribers
    pub max_subscribers: usize,

    /// Enable event filtering
    pub enable_filtering: bool,

    /// Enable priority queues
    pub enable_priority: bool,

    /// Enable monitoring and metrics
    pub enable_monitoring: bool,

    /// Enable backpressure handling
    pub enable_backpressure: bool,

    /// Backpressure threshold (percentage of queue size)
    pub backpressure_threshold: usize,

    /// Maximum topic length
    pub max_topic_length: usize,

    /// Maximum payload size
    pub max_payload_size: usize,

    /// Number of worker threads for async processing
    pub worker_threads: usize,

    /// Enable topic wildcards
    pub enable_wildcards: bool,

    /// Enable persistent subscriptions
    pub enable_persistence: bool,

    /// Enable distributed mode
    pub enable_distributed: bool,

    /// Local node ID for distributed mode
    pub node_id: alloc::string::String,

    /// Cluster peers (for distributed mode)
    pub cluster_peers: alloc::vec::Vec<alloc::string::String>,

    /// Discovery strategy
    pub discovery_strategy: alloc::string::String,
}

impl Default for EventBusConfig {
    fn default() -> Self {
        Self {
            queue_size: crate::DEFAULT_QUEUE_SIZE,
            max_subscribers: crate::DEFAULT_MAX_SUBSCRIBERS,
            enable_filtering: true,
            enable_priority: true,
            enable_monitoring: true,
            enable_backpressure: true,
            backpressure_threshold: 80, // 80% of queue size
            max_topic_length: crate::MAX_TOPIC_LENGTH,
            max_payload_size: crate::MAX_PAYLOAD_SIZE,
            worker_threads: 4,
            enable_wildcards: true,
            enable_persistence: false,
            enable_distributed: false,
            node_id: "local-node".into(),
            cluster_peers: alloc::vec::Vec::new(),
            discovery_strategy: "static".into(),
        }
    }
}

/// Subscriber configuration
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SubscriberConfig {
    /// Subscriber name (for monitoring)
    pub name: alloc::string::String,

    /// Queue size for this subscriber
    pub queue_size: usize,

    /// Enable backpressure for this subscriber
    pub enable_backpressure: bool,

    /// Backpressure threshold for this subscriber
    pub backpressure_threshold: usize,

    /// Maximum pending events before dropping
    pub max_pending: usize,
}

impl Default for SubscriberConfig {
    fn default() -> Self {
        Self {
            name: "default".into(),
            queue_size: crate::DEFAULT_QUEUE_SIZE,
            enable_backpressure: true,
            backpressure_threshold: 80,
            max_pending: 10000,
        }
    }
}

/// Publisher configuration
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PublisherConfig {
    /// Publisher name (for monitoring)
    pub name: alloc::string::String,

    /// Enable batch publishing
    pub enable_batch: bool,

    /// Batch size
    pub batch_size: usize,

    /// Enable compression for large payloads
    pub enable_compression: bool,

    /// Compression threshold
    pub compression_threshold: usize,
}

impl Default for PublisherConfig {
    fn default() -> Self {
        Self {
            name: "default".into(),
            enable_batch: false,
            batch_size: 10,
            enable_compression: false,
            compression_threshold: 1024, // 1KB
        }
    }
}

/// Monitoring configuration
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MonitoringConfig {
    /// Enable detailed metrics collection
    pub enable_detailed_metrics: bool,

    /// Metrics collection interval (milliseconds)
    pub metrics_interval: u64,

    /// Enable health checks
    pub enable_health_checks: bool,

    /// Health check interval (milliseconds)
    pub health_check_interval: u64,

    /// Enable event tracing
    pub enable_tracing: bool,

    /// Maximum trace events to keep
    pub max_trace_events: usize,
}

impl Default for MonitoringConfig {
    fn default() -> Self {
        Self {
            enable_detailed_metrics: true,
            metrics_interval: 1000, // 1 second
            enable_health_checks: true,
            health_check_interval: 5000, // 5 seconds
            enable_tracing: false,
            max_trace_events: 1000,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = EventBusConfig::default();
        assert!(config.queue_size > 0);
        assert!(config.max_subscribers > 0);
        assert!(config.enable_filtering);
        assert!(config.enable_priority);
        assert!(config.enable_monitoring);
        assert!(config.enable_backpressure);
        assert!(config.backpressure_threshold > 0 && config.backpressure_threshold <= 100);
    }

    #[test]
    fn test_subscriber_config() {
        let config = SubscriberConfig::default();
        assert!(!config.name.is_empty());
        assert!(config.queue_size > 0);
        assert!(config.enable_backpressure);
        assert!(config.max_pending > 0);
    }

    #[test]
    fn test_publisher_config() {
        let config = PublisherConfig::default();
        assert!(!config.name.is_empty());
        assert!(config.batch_size > 0);
        assert!(config.compression_threshold > 0);
    }

    #[test]
    fn test_monitoring_config() {
        let config = MonitoringConfig::default();
        assert!(config.metrics_interval > 0);
        assert!(config.health_check_interval > 0);
        assert!(config.max_trace_events > 0);
    }
}
