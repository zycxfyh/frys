//! Metrics and monitoring for EventBus

use core::sync::atomic::{AtomicU64, Ordering};

/// EventBus metrics collector
#[derive(Debug)]
pub struct EventBusMetrics {
    /// Total events published
    pub events_published: AtomicU64,

    /// Total events delivered
    pub events_delivered: AtomicU64,

    /// Total events dropped
    pub events_dropped: AtomicU64,

    /// Total subscribers
    pub total_subscribers: AtomicU64,

    /// Active subscribers
    pub active_subscribers: AtomicU64,

    /// Total topics
    pub total_topics: AtomicU64,

    /// Queue operations
    pub queue_operations: AtomicU64,

    /// Filter operations
    pub filter_operations: AtomicU64,

    /// Routing operations
    pub routing_operations: AtomicU64,

    /// Backpressure events
    pub backpressure_events: AtomicU64,

    /// Error count
    pub error_count: AtomicU64,

    /// Average processing latency (nanoseconds)
    pub avg_processing_latency: AtomicU64,

    /// Maximum processing latency (nanoseconds)
    pub max_processing_latency: AtomicU64,

    /// Total processing time (nanoseconds)
    pub total_processing_time: AtomicU64,
}

impl EventBusMetrics {
    pub fn new() -> Self {
        Self {
            events_published: AtomicU64::new(0),
            events_delivered: AtomicU64::new(0),
            events_dropped: AtomicU64::new(0),
            total_subscribers: AtomicU64::new(0),
            active_subscribers: AtomicU64::new(0),
            total_topics: AtomicU64::new(0),
            queue_operations: AtomicU64::new(0),
            filter_operations: AtomicU64::new(0),
            routing_operations: AtomicU64::new(0),
            backpressure_events: AtomicU64::new(0),
            error_count: AtomicU64::new(0),
            avg_processing_latency: AtomicU64::new(0),
            max_processing_latency: AtomicU64::new(0),
            total_processing_time: AtomicU64::new(0),
        }
    }

    /// Record event published
    pub fn record_event_published(&self) {
        self.events_published.fetch_add(1, Ordering::AcqRel);
    }

    /// Record event delivered
    pub fn record_event_delivered(&self) {
        self.events_delivered.fetch_add(1, Ordering::AcqRel);
    }

    /// Record event dropped
    pub fn record_event_dropped(&self) {
        self.events_dropped.fetch_add(1, Ordering::AcqRel);
    }

    /// Record subscriber added
    pub fn record_subscriber_added(&self) {
        self.total_subscribers.fetch_add(1, Ordering::AcqRel);
        self.active_subscribers.fetch_add(1, Ordering::AcqRel);
    }

    /// Record subscriber removed
    pub fn record_subscriber_removed(&self) {
        self.active_subscribers.fetch_sub(1, Ordering::AcqRel);
    }

    /// Record topic created
    pub fn record_topic_created(&self) {
        self.total_topics.fetch_add(1, Ordering::AcqRel);
    }

    /// Record queue operation
    pub fn record_queue_operation(&self) {
        self.queue_operations.fetch_add(1, Ordering::AcqRel);
    }

    /// Record filter operation
    pub fn record_filter_operation(&self) {
        self.filter_operations.fetch_add(1, Ordering::AcqRel);
    }

    /// Record routing operation
    pub fn record_routing_operation(&self) {
        self.routing_operations.fetch_add(1, Ordering::AcqRel);
    }

    /// Record backpressure event
    pub fn record_backpressure_event(&self) {
        self.backpressure_events.fetch_add(1, Ordering::AcqRel);
    }

    /// Record error
    pub fn record_error(&self) {
        self.error_count.fetch_add(1, Ordering::AcqRel);
    }

    /// Record processing latency
    pub fn record_processing_latency(&self, latency_ns: u64) {
        // Update max latency
        let mut current_max = self.max_processing_latency.load(Ordering::Acquire);
        while current_max < latency_ns {
            match self.max_processing_latency.compare_exchange(
                current_max,
                latency_ns,
                Ordering::AcqRel,
                Ordering::Acquire,
            ) {
                Ok(_) => break,
                Err(actual) => current_max = actual,
            }
        }

        // Update total processing time
        self.total_processing_time.fetch_add(latency_ns, Ordering::AcqRel);

        // Update average (simple moving average)
        let total_events = self.events_delivered.load(Ordering::Acquire);
        if total_events > 0 {
            let total_time = self.total_processing_time.load(Ordering::Acquire);
            let avg = total_time / total_events;
            self.avg_processing_latency.store(avg, Ordering::Release);
        }
    }

    /// Get current metrics snapshot
    pub fn snapshot(&self) -> MetricsSnapshot {
        MetricsSnapshot {
            events_published: self.events_published.load(Ordering::Acquire),
            events_delivered: self.events_delivered.load(Ordering::Acquire),
            events_dropped: self.events_dropped.load(Ordering::Acquire),
            total_subscribers: self.total_subscribers.load(Ordering::Acquire),
            active_subscribers: self.active_subscribers.load(Ordering::Acquire),
            total_topics: self.total_topics.load(Ordering::Acquire),
            queue_operations: self.queue_operations.load(Ordering::Acquire),
            filter_operations: self.filter_operations.load(Ordering::Acquire),
            routing_operations: self.routing_operations.load(Ordering::Acquire),
            backpressure_events: self.backpressure_events.load(Ordering::Acquire),
            error_count: self.error_count.load(Ordering::Acquire),
            avg_processing_latency: self.avg_processing_latency.load(Ordering::Acquire),
            max_processing_latency: self.max_processing_latency.load(Ordering::Acquire),
            delivery_rate: self.calculate_delivery_rate(),
            error_rate: self.calculate_error_rate(),
        }
    }

    fn calculate_delivery_rate(&self) -> f64 {
        let published = self.events_published.load(Ordering::Acquire);
        let delivered = self.events_delivered.load(Ordering::Acquire);

        if published == 0 {
            0.0
        } else {
            (delivered as f64) / (published as f64)
        }
    }

    fn calculate_error_rate(&self) -> f64 {
        let total_operations = self.events_published.load(Ordering::Acquire);
        let errors = self.error_count.load(Ordering::Acquire);

        if total_operations == 0 {
            0.0
        } else {
            (errors as f64) / (total_operations as f64)
        }
    }
}

/// Metrics snapshot for monitoring
#[derive(Debug, Clone)]
pub struct MetricsSnapshot {
    pub events_published: u64,
    pub events_delivered: u64,
    pub events_dropped: u64,
    pub total_subscribers: u64,
    pub active_subscribers: u64,
    pub total_topics: u64,
    pub queue_operations: u64,
    pub filter_operations: u64,
    pub routing_operations: u64,
    pub backpressure_events: u64,
    pub error_count: u64,
    pub avg_processing_latency: u64,
    pub max_processing_latency: u64,
    pub delivery_rate: f64,
    pub error_rate: f64,
}

impl MetricsSnapshot {
    /// Check if system is healthy based on metrics
    pub fn is_healthy(&self) -> bool {
        // Define health criteria
        let delivery_rate_ok = self.delivery_rate >= 0.95; // 95% delivery rate
        let error_rate_ok = self.error_rate <= 0.05; // 5% error rate
        let backpressure_ok = self.backpressure_events < 100; // Less than 100 backpressure events
        let latency_ok = self.avg_processing_latency < 10_000_000; // Less than 10ms average

        delivery_rate_ok && error_rate_ok && backpressure_ok && latency_ok
    }

    /// Get health status description
    pub fn health_status(&self) -> &'static str {
        if self.is_healthy() {
            "healthy"
        } else if self.error_rate > 0.1 {
            "critical"
        } else {
            "warning"
        }
    }
}

impl Default for EventBusMetrics {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_metrics_creation() {
        let metrics = EventBusMetrics::new();
        assert_eq!(metrics.events_published.load(Ordering::Acquire), 0);
        assert_eq!(metrics.events_delivered.load(Ordering::Acquire), 0);
    }

    #[test]
    fn test_metrics_recording() {
        let metrics = EventBusMetrics::new();

        metrics.record_event_published();
        metrics.record_event_delivered();
        metrics.record_subscriber_added();

        assert_eq!(metrics.events_published.load(Ordering::Acquire), 1);
        assert_eq!(metrics.events_delivered.load(Ordering::Acquire), 1);
        assert_eq!(metrics.total_subscribers.load(Ordering::Acquire), 1);
        assert_eq!(metrics.active_subscribers.load(Ordering::Acquire), 1);
    }

    #[test]
    fn test_metrics_snapshot() {
        let metrics = EventBusMetrics::new();

        metrics.record_event_published();
        metrics.record_event_delivered();

        let snapshot = metrics.snapshot();
        assert_eq!(snapshot.events_published, 1);
        assert_eq!(snapshot.events_delivered, 1);
        assert_eq!(snapshot.delivery_rate, 1.0);
        assert!(snapshot.is_healthy());
    }

    #[test]
    fn test_latency_recording() {
        let metrics = EventBusMetrics::new();

        metrics.record_event_delivered();
        metrics.record_processing_latency(1000); // 1μs
        metrics.record_event_delivered();
        metrics.record_processing_latency(2000); // 2μs

        let snapshot = metrics.snapshot();
        assert_eq!(snapshot.avg_processing_latency, 1500); // (1000 + 2000) / 2
        assert_eq!(snapshot.max_processing_latency, 2000);
    }

    #[test]
    fn test_health_status() {
        let healthy = MetricsSnapshot {
            events_published: 100,
            events_delivered: 98,
            events_dropped: 2,
            total_subscribers: 10,
            active_subscribers: 10,
            total_topics: 5,
            queue_operations: 100,
            filter_operations: 50,
            routing_operations: 100,
            backpressure_events: 0,
            error_count: 1,
            avg_processing_latency: 1000000, // 1ms
            max_processing_latency: 5000000, // 5ms
            delivery_rate: 0.98,
            error_rate: 0.01,
        };

        assert!(healthy.is_healthy());
        assert_eq!(healthy.health_status(), "healthy");
    }
}
