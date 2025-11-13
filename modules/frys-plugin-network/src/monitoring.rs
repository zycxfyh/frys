//! Monitoring and metrics for network plugin

use alloc::collections::BTreeMap;
use alloc::string::String;

/// Network monitoring system
#[derive(Debug, Clone)]
pub struct NetworkMonitoring {
    /// HTTP request metrics
    http_metrics: HttpMetrics,
    /// WebSocket metrics
    websocket_metrics: WebSocketMetrics,
    /// Message queue metrics
    messaging_metrics: MessagingMetrics,
    /// Connection metrics
    connection_metrics: ConnectionMetrics,
    /// Error metrics
    error_metrics: ErrorMetrics,
    /// Performance metrics
    performance_metrics: PerformanceMetrics,
}

impl NetworkMonitoring {
    /// Create new monitoring system
    pub fn new() -> Self {
        Self {
            http_metrics: HttpMetrics::new(),
            websocket_metrics: WebSocketMetrics::new(),
            messaging_metrics: MessagingMetrics::new(),
            connection_metrics: ConnectionMetrics::new(),
            error_metrics: ErrorMetrics::new(),
            performance_metrics: PerformanceMetrics::new(),
        }
    }

    /// Record HTTP request
    pub fn record_http_request(&mut self, method: &str, url: &str, duration_ms: u64, success: bool) {
        self.http_metrics.record_request(method, url, duration_ms, success);
        self.performance_metrics.record_operation(duration_ms, success);
    }

    /// Record WebSocket message
    pub fn record_websocket_message(&mut self, message_size: usize, success: bool) {
        self.websocket_metrics.record_message(message_size, success);
    }

    /// Record message published
    pub fn record_message_published(&mut self, topic: &str) {
        self.messaging_metrics.record_published(topic);
    }

    /// Record message received
    pub fn record_message_received(&mut self, topic: &str, message_size: usize) {
        self.messaging_metrics.record_received(topic, message_size);
    }

    /// Record subscription
    pub fn record_subscription(&mut self, topic: &str) {
        self.messaging_metrics.record_subscription(topic);
    }

    /// Record connection established
    pub fn record_connection_established(&mut self, protocol: &str) {
        self.connection_metrics.record_established(protocol);
    }

    /// Record connection closed
    pub fn record_connection_closed(&mut self, protocol: &str, duration_secs: u64) {
        self.connection_metrics.record_closed(protocol, duration_secs);
    }

    /// Record API request
    pub fn record_api_request(&mut self, path: &str, duration_ms: u64, success: bool) {
        self.http_metrics.record_api_request(path, duration_ms, success);
        self.performance_metrics.record_operation(duration_ms, success);
    }

    /// Record service registered
    pub fn record_service_registered(&mut self, service_name: &str) {
        // Could add service discovery metrics
    }

    /// Record error
    pub fn record_error(&mut self, error_type: &str) {
        self.error_metrics.record_error(error_type);
    }

    /// Get total requests
    pub fn get_total_requests(&self) -> u64 {
        self.http_metrics.total_requests + self.websocket_metrics.total_messages
    }

    /// Get total messages
    pub fn get_total_messages(&self) -> u64 {
        self.messaging_metrics.total_published + self.messaging_metrics.total_received
    }

    /// Get error rate
    pub fn get_error_rate(&self) -> f64 {
        let total_operations = self.performance_metrics.total_operations;
        if total_operations == 0 {
            0.0
        } else {
            self.performance_metrics.failed_operations as f64 / total_operations as f64
        }
    }

    /// Get average response time
    pub fn get_average_response_time(&self) -> f64 {
        self.performance_metrics.get_average_response_time()
    }

    /// Get throughput (operations per second)
    pub fn get_throughput(&self) -> f64 {
        // Simplified - would need time window tracking
        0.0
    }

    /// Get comprehensive metrics snapshot
    pub fn get_metrics_snapshot(&self) -> MetricsSnapshot {
        MetricsSnapshot {
            http_metrics: self.http_metrics.clone(),
            websocket_metrics: self.websocket_metrics.clone(),
            messaging_metrics: self.messaging_metrics.clone(),
            connection_metrics: self.connection_metrics.clone(),
            error_metrics: self.error_metrics.clone(),
            performance_metrics: self.performance_metrics.clone(),
            timestamp: self.current_timestamp(),
        }
    }

    fn current_timestamp(&self) -> u64 {
        0 // Placeholder
    }
}

/// HTTP metrics
#[derive(Debug, Clone)]
pub struct HttpMetrics {
    pub total_requests: u64,
    pub successful_requests: u64,
    pub failed_requests: u64,
    pub total_response_time: u64,
    pub request_count_by_method: BTreeMap<String, u64>,
    pub api_request_count: BTreeMap<String, u64>,
}

impl HttpMetrics {
    pub fn new() -> Self {
        Self {
            total_requests: 0,
            successful_requests: 0,
            failed_requests: 0,
            total_response_time: 0,
            request_count_by_method: BTreeMap::new(),
            api_request_count: BTreeMap::new(),
        }
    }

    pub fn record_request(&mut self, method: &str, _url: &str, duration_ms: u64, success: bool) {
        self.total_requests += 1;
        self.total_response_time += duration_ms;

        if success {
            self.successful_requests += 1;
        } else {
            self.failed_requests += 1;
        }

        *self.request_count_by_method.entry(method.to_string()).or_insert(0) += 1;
    }

    pub fn record_api_request(&mut self, path: &str, duration_ms: u64, success: bool) {
        self.record_request("API", path, duration_ms, success);
        *self.api_request_count.entry(path.to_string()).or_insert(0) += 1;
    }
}

/// WebSocket metrics
#[derive(Debug, Clone)]
pub struct WebSocketMetrics {
    pub total_messages: u64,
    pub successful_messages: u64,
    pub failed_messages: u64,
    pub total_message_size: u64,
    pub active_connections: usize,
}

impl WebSocketMetrics {
    pub fn new() -> Self {
        Self {
            total_messages: 0,
            successful_messages: 0,
            failed_messages: 0,
            total_message_size: 0,
            active_connections: 0,
        }
    }

    pub fn record_message(&mut self, message_size: usize, success: bool) {
        self.total_messages += 1;
        self.total_message_size += message_size as u64;

        if success {
            self.successful_messages += 1;
        } else {
            self.failed_messages += 1;
        }
    }
}

/// Messaging metrics
#[derive(Debug, Clone)]
pub struct MessagingMetrics {
    pub total_published: u64,
    pub total_received: u64,
    pub total_subscriptions: u64,
    pub total_message_size: u64,
    pub topics_published: BTreeMap<String, u64>,
    pub topics_received: BTreeMap<String, u64>,
}

impl MessagingMetrics {
    pub fn new() -> Self {
        Self {
            total_published: 0,
            total_received: 0,
            total_subscriptions: 0,
            total_message_size: 0,
            topics_published: BTreeMap::new(),
            topics_received: BTreeMap::new(),
        }
    }

    pub fn record_published(&mut self, topic: &str) {
        self.total_published += 1;
        *self.topics_published.entry(topic.to_string()).or_insert(0) += 1;
    }

    pub fn record_received(&mut self, topic: &str, message_size: usize) {
        self.total_received += 1;
        self.total_message_size += message_size as u64;
        *self.topics_received.entry(topic.to_string()).or_insert(0) += 1;
    }

    pub fn record_subscription(&mut self, topic: &str) {
        self.total_subscriptions += 1;
    }
}

/// Connection metrics
#[derive(Debug, Clone)]
pub struct ConnectionMetrics {
    pub total_established: u64,
    pub total_closed: u64,
    pub current_active: usize,
    pub total_connection_time: u64,
    pub connections_by_protocol: BTreeMap<String, u64>,
}

impl ConnectionMetrics {
    pub fn new() -> Self {
        Self {
            total_established: 0,
            total_closed: 0,
            current_active: 0,
            total_connection_time: 0,
            connections_by_protocol: BTreeMap::new(),
        }
    }

    pub fn record_established(&mut self, protocol: &str) {
        self.total_established += 1;
        self.current_active += 1;
        *self.connections_by_protocol.entry(protocol.to_string()).or_insert(0) += 1;
    }

    pub fn record_closed(&mut self, protocol: &str, duration_secs: u64) {
        self.total_closed += 1;
        self.current_active = self.current_active.saturating_sub(1);
        self.total_connection_time += duration_secs;
    }
}

/// Error metrics
#[derive(Debug, Clone)]
pub struct ErrorMetrics {
    pub total_errors: u64,
    pub errors_by_type: BTreeMap<String, u64>,
    pub recent_errors: Vec<ErrorRecord>,
}

impl ErrorMetrics {
    pub fn new() -> Self {
        Self {
            total_errors: 0,
            errors_by_type: BTreeMap::new(),
            recent_errors: Vec::new(),
        }
    }

    pub fn record_error(&mut self, error_type: &str) {
        self.total_errors += 1;
        *self.errors_by_type.entry(error_type.to_string()).or_insert(0) += 1;

        // Keep only last 100 errors
        self.recent_errors.push(ErrorRecord {
            error_type: error_type.to_string(),
            timestamp: self.current_timestamp(),
        });

        if self.recent_errors.len() > 100 {
            self.recent_errors.remove(0);
        }
    }

    fn current_timestamp(&self) -> u64 {
        0 // Placeholder
    }
}

/// Error record
#[derive(Debug, Clone)]
pub struct ErrorRecord {
    pub error_type: String,
    pub timestamp: u64,
}

/// Performance metrics
#[derive(Debug, Clone)]
pub struct PerformanceMetrics {
    pub total_operations: u64,
    pub successful_operations: u64,
    pub failed_operations: u64,
    pub total_response_time: u64,
    pub response_times: Vec<u64>,
}

impl PerformanceMetrics {
    pub fn new() -> Self {
        Self {
            total_operations: 0,
            successful_operations: 0,
            failed_operations: 0,
            total_response_time: 0,
            response_times: Vec::new(),
        }
    }

    pub fn record_operation(&mut self, duration_ms: u64, success: bool) {
        self.total_operations += 1;
        self.total_response_time += duration_ms;

        if success {
            self.successful_operations += 1;
        } else {
            self.failed_operations += 1;
        }

        // Keep only last 1000 response times for percentile calculations
        self.response_times.push(duration_ms);
        if self.response_times.len() > 1000 {
            self.response_times.remove(0);
        }
    }

    pub fn get_average_response_time(&self) -> f64 {
        if self.total_operations == 0 {
            0.0
        } else {
            self.total_response_time as f64 / self.total_operations as f64
        }
    }

    pub fn get_percentile_response_time(&self, percentile: f64) -> u64 {
        if self.response_times.is_empty() {
            0
        } else {
            let mut sorted_times = self.response_times.clone();
            sorted_times.sort();
            let index = ((percentile / 100.0) * (sorted_times.len() - 1) as f64) as usize;
            sorted_times[index]
        }
    }
}

/// Comprehensive metrics snapshot
#[derive(Debug, Clone)]
pub struct MetricsSnapshot {
    pub http_metrics: HttpMetrics,
    pub websocket_metrics: WebSocketMetrics,
    pub messaging_metrics: MessagingMetrics,
    pub connection_metrics: ConnectionMetrics,
    pub error_metrics: ErrorMetrics,
    pub performance_metrics: PerformanceMetrics,
    pub timestamp: u64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_monitoring_creation() {
        let monitoring = NetworkMonitoring::new();
        // Test passes if creation succeeds
    }

    #[test]
    fn test_http_metrics() {
        let mut metrics = HttpMetrics::new();

        metrics.record_request("GET", "/api/test", 100, true);
        metrics.record_request("POST", "/api/test", 200, false);

        assert_eq!(metrics.total_requests, 2);
        assert_eq!(metrics.successful_requests, 1);
        assert_eq!(metrics.failed_requests, 1);
        assert_eq!(*metrics.request_count_by_method.get("GET").unwrap(), 1);
    }

    #[test]
    fn test_performance_metrics() {
        let mut metrics = PerformanceMetrics::new();

        metrics.record_operation(100, true);
        metrics.record_operation(200, false);
        metrics.record_operation(150, true);

        assert_eq!(metrics.total_operations, 3);
        assert_eq!(metrics.successful_operations, 2);
        assert_eq!(metrics.failed_operations, 1);
        assert_eq!(metrics.get_average_response_time(), 150.0);
    }

    #[test]
    fn test_error_metrics() {
        let mut metrics = ErrorMetrics::new();

        metrics.record_error("connection_failed");
        metrics.record_error("timeout");
        metrics.record_error("connection_failed");

        assert_eq!(metrics.total_errors, 3);
        assert_eq!(*metrics.errors_by_type.get("connection_failed").unwrap(), 2);
        assert_eq!(*metrics.errors_by_type.get("timeout").unwrap(), 1);
    }

    #[test]
    fn test_network_monitoring() {
        let mut monitoring = NetworkMonitoring::new();

        monitoring.record_http_request("GET", "/api/test", 100, true);
        monitoring.record_message_published("test_topic");

        let snapshot = monitoring.get_metrics_snapshot();

        assert_eq!(snapshot.http_metrics.total_requests, 1);
        assert_eq!(snapshot.messaging_metrics.total_published, 1);
        assert_eq!(monitoring.get_total_requests(), 1);
        assert_eq!(monitoring.get_total_messages(), 1);
    }
}
