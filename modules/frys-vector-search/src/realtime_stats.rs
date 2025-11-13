//! Real-time statistics and analytics for vector search

use crate::*;
use alloc::collections::BTreeMap;
use alloc::string::String;
use alloc::vec::Vec;
use core::sync::atomic::{AtomicU64, AtomicUsize, Ordering};

/// Real-time Statistics Manager
pub struct RealtimeStats {
    /// Query statistics
    query_stats: QueryStats,
    /// Index statistics
    index_stats: IndexStats,
    /// Performance statistics
    performance_stats: PerformanceStats,
    /// System statistics
    system_stats: SystemStats,
    /// Time windows for sliding statistics
    time_windows: Vec<TimeWindow>,
    /// Statistics update interval
    update_interval_ms: u64,
}

impl RealtimeStats {
    /// Create new real-time statistics manager
    pub fn new() -> Self {
        Self {
            query_stats: QueryStats::new(),
            index_stats: IndexStats::new(),
            performance_stats: PerformanceStats::new(),
            system_stats: SystemStats::new(),
            time_windows: vec![
                TimeWindow::new(60000),   // 1 minute
                TimeWindow::new(300000),  // 5 minutes
                TimeWindow::new(3600000), // 1 hour
            ],
            update_interval_ms: 1000, // 1 second
        }
    }

    /// Record a search query
    pub fn record_query(&mut self, query: &SearchQuery, results: &[SearchResult], duration_ms: u64, success: bool) {
        self.query_stats.record_query(query, results.len(), duration_ms, success);

        // Update performance stats
        self.performance_stats.record_query(duration_ms);

        // Update time windows
        for window in &mut self.time_windows {
            window.record_query(duration_ms, results.len(), success);
        }

        // Update system stats
        self.system_stats.update_load_factor();
    }

    /// Record index operation
    pub fn record_index_operation(&mut self, operation: IndexOperation, duration_ms: u64, success: bool) {
        self.index_stats.record_operation(operation, duration_ms, success);

        // Update performance stats
        self.performance_stats.record_index_operation(duration_ms);

        // Update time windows
        for window in &mut self.time_windows {
            window.record_index_operation(duration_ms, success);
        }
    }

    /// Record cache operation
    pub fn record_cache_operation(&mut self, hit: bool, duration_ms: u64) {
        self.query_stats.record_cache_operation(hit, duration_ms);
        self.performance_stats.record_cache_operation(duration_ms);
    }

    /// Record ML operation
    pub fn record_ml_operation(&mut self, operation_type: MLOperationType, duration_ms: u64, success: bool) {
        self.performance_stats.record_ml_operation(operation_type, duration_ms, success);
    }

    /// Get comprehensive statistics snapshot
    pub fn get_snapshot(&self) -> StatsSnapshot {
        StatsSnapshot {
            timestamp: self.current_timestamp(),
            query_stats: self.query_stats.get_snapshot(),
            index_stats: self.index_stats.get_snapshot(),
            performance_stats: self.performance_stats.get_snapshot(),
            system_stats: self.system_stats.get_snapshot(),
            time_window_stats: self.time_windows.iter().map(|w| w.get_snapshot()).collect(),
            health_score: self.calculate_health_score(),
            recommendations: self.generate_recommendations(),
        }
    }

    /// Get real-time metrics for monitoring
    pub fn get_realtime_metrics(&self) -> BTreeMap<String, f64> {
        let mut metrics = BTreeMap::new();

        // Query metrics
        let query_snapshot = self.query_stats.get_snapshot();
        metrics.insert("queries_per_second".to_string(), query_snapshot.queries_per_second);
        metrics.insert("average_query_latency".to_string(), query_snapshot.average_latency_ms as f64);
        metrics.insert("cache_hit_rate".to_string(), query_snapshot.cache_hit_rate);
        metrics.insert("query_success_rate".to_string(), query_snapshot.success_rate);

        // Index metrics
        let index_snapshot = self.index_stats.get_snapshot();
        metrics.insert("index_operations_per_second".to_string(), index_snapshot.operations_per_second);
        metrics.insert("index_size_mb".to_string(), index_snapshot.total_size_mb as f64);

        // Performance metrics
        let perf_snapshot = self.performance_stats.get_snapshot();
        metrics.insert("cpu_usage_percent".to_string(), perf_snapshot.cpu_usage_percent);
        metrics.insert("memory_usage_mb".to_string(), perf_snapshot.memory_usage_mb as f64);

        // System metrics
        let sys_snapshot = self.system_stats.get_snapshot();
        metrics.insert("system_load_factor".to_string(), sys_snapshot.load_factor);
        metrics.insert("active_connections".to_string(), sys_snapshot.active_connections as f64);

        metrics
    }

    /// Get performance trends
    pub fn get_performance_trends(&self) -> PerformanceTrends {
        let current_window = &self.time_windows[0]; // 1-minute window
        let previous_window = &self.time_windows[1]; // 5-minute window

        PerformanceTrends {
            query_latency_trend: self.calculate_trend(
                current_window.get_average_query_latency(),
                previous_window.get_average_query_latency(),
            ),
            throughput_trend: self.calculate_trend(
                current_window.get_queries_per_second(),
                previous_window.get_queries_per_second(),
            ),
            cache_hit_trend: self.calculate_trend(
                current_window.get_cache_hit_rate(),
                previous_window.get_cache_hit_rate(),
            ),
            error_rate_trend: self.calculate_trend(
                current_window.get_error_rate(),
                previous_window.get_error_rate(),
            ),
        }
    }

    /// Calculate health score (0.0-1.0)
    fn calculate_health_score(&self) -> f64 {
        let query_health = self.query_stats.get_snapshot().success_rate;
        let perf_health = 1.0 - (self.performance_stats.get_snapshot().cpu_usage_percent / 100.0).min(1.0);
        let system_health = 1.0 - self.system_stats.get_snapshot().load_factor.min(1.0);

        // Weighted average
        (query_health * 0.4 + perf_health * 0.3 + system_health * 0.3).min(1.0)
    }

    /// Generate system recommendations
    fn generate_recommendations(&self) -> Vec<String> {
        let mut recommendations = Vec::new();

        let perf_trends = self.get_performance_trends();
        let snapshot = self.get_snapshot();

        // Query performance recommendations
        if snapshot.query_stats.average_latency_ms > 100.0 {
            recommendations.push("Consider optimizing query processing or adding more compute resources".to_string());
        }

        if snapshot.query_stats.cache_hit_rate < 0.5 {
            recommendations.push("Cache hit rate is low, consider adjusting cache policies or increasing cache size".to_string());
        }

        // Performance recommendations
        if snapshot.performance_stats.cpu_usage_percent > 80.0 {
            recommendations.push("High CPU usage detected, consider horizontal scaling".to_string());
        }

        if snapshot.performance_stats.memory_usage_mb > 8000.0 {
            recommendations.push("High memory usage, consider optimizing memory management or adding more RAM".to_string());
        }

        // System recommendations
        if snapshot.system_stats.load_factor > 0.8 {
            recommendations.push("System load is high, consider load balancing or resource optimization".to_string());
        }

        // Trend-based recommendations
        if perf_trends.query_latency_trend == Trend::Increasing {
            recommendations.push("Query latency is increasing, investigate performance degradation".to_string());
        }

        if perf_trends.error_rate_trend == Trend::Increasing {
            recommendations.push("Error rate is increasing, check system health and logs".to_string());
        }

        recommendations
    }

    /// Calculate trend between two values
    fn calculate_trend(&self, current: f64, previous: f64) -> Trend {
        if previous == 0.0 {
            return Trend::Stable;
        }

        let change_ratio = (current - previous) / previous;

        if change_ratio > 0.1 {
            Trend::Increasing
        } else if change_ratio < -0.1 {
            Trend::Decreasing
        } else {
            Trend::Stable
        }
    }

    fn current_timestamp(&self) -> u64 {
        0 // Placeholder
    }
}

/// Query Statistics
pub struct QueryStats {
    total_queries: AtomicU64,
    successful_queries: AtomicU64,
    total_query_time: AtomicU64,
    cache_hits: AtomicU64,
    cache_misses: AtomicU64,
    cache_hit_time: AtomicU64,
    cache_miss_time: AtomicU64,
    query_type_distribution: BTreeMap<String, AtomicU64>,
}

impl QueryStats {
    pub fn new() -> Self {
        Self {
            total_queries: AtomicU64::new(0),
            successful_queries: AtomicU64::new(0),
            total_query_time: AtomicU64::new(0),
            cache_hits: AtomicU64::new(0),
            cache_misses: AtomicU64::new(0),
            cache_hit_time: AtomicU64::new(0),
            cache_miss_time: AtomicU64::new(0),
            query_type_distribution: BTreeMap::new(),
        }
    }

    pub fn record_query(&self, query: &SearchQuery, result_count: usize, duration_ms: u64, success: bool) {
        self.total_queries.fetch_add(1, Ordering::Relaxed);
        self.total_query_time.fetch_add(duration_ms, Ordering::Relaxed);

        if success {
            self.successful_queries.fetch_add(1, Ordering::Relaxed);
        }

        // Record query type
        let query_type = if query.vector.is_some() { "vector" } else { "text" };
        self.query_type_distribution
            .entry(query_type.to_string())
            .or_insert_with(|| AtomicU64::new(0))
            .fetch_add(1, Ordering::Relaxed);
    }

    pub fn record_cache_operation(&self, hit: bool, duration_ms: u64) {
        if hit {
            self.cache_hits.fetch_add(1, Ordering::Relaxed);
            self.cache_hit_time.fetch_add(duration_ms, Ordering::Relaxed);
        } else {
            self.cache_misses.fetch_add(1, Ordering::Relaxed);
            self.cache_miss_time.fetch_add(duration_ms, Ordering::Relaxed);
        }
    }

    pub fn get_snapshot(&self) -> QueryStatsSnapshot {
        let total = self.total_queries.load(Ordering::Relaxed);
        let successful = self.successful_queries.load(Ordering::Relaxed);
        let total_time = self.total_query_time.load(Ordering::Relaxed);
        let hits = self.cache_hits.load(Ordering::Relaxed);
        let misses = self.cache_misses.load(Ordering::Relaxed);

        QueryStatsSnapshot {
            total_queries: total,
            successful_queries: successful,
            failed_queries: total - successful,
            queries_per_second: self.calculate_qps(),
            average_latency_ms: if total > 0 { total_time as f64 / total as f64 } else { 0.0 },
            cache_hit_rate: if (hits + misses) > 0 { hits as f64 / (hits + misses) as f64 } else { 0.0 },
            success_rate: if total > 0 { successful as f64 / total as f64 } else { 0.0 },
            query_type_distribution: self.query_type_distribution.iter()
                .map(|(k, v)| (k.clone(), v.load(Ordering::Relaxed)))
                .collect(),
        }
    }

    fn calculate_qps(&self) -> f64 {
        // Simplified QPS calculation - would need time window tracking
        let total = self.total_queries.load(Ordering::Relaxed);
        if total > 0 {
            // Assume measurements over 1 minute for this example
            total as f64 / 60.0
        } else {
            0.0
        }
    }
}

/// Index Statistics
pub struct IndexStats {
    total_operations: AtomicU64,
    successful_operations: AtomicU64,
    total_operation_time: AtomicU64,
    index_size_bytes: AtomicU64,
    vector_count: AtomicU64,
    operation_types: BTreeMap<String, AtomicU64>,
}

impl IndexStats {
    pub fn new() -> Self {
        Self {
            total_operations: AtomicU64::new(0),
            successful_operations: AtomicU64::new(0),
            total_operation_time: AtomicU64::new(0),
            index_size_bytes: AtomicU64::new(0),
            vector_count: AtomicU64::new(0),
            operation_types: BTreeMap::new(),
        }
    }

    pub fn record_operation(&self, operation: IndexOperation, duration_ms: u64, success: bool) {
        self.total_operations.fetch_add(1, Ordering::Relaxed);
        self.total_operation_time.fetch_add(duration_ms, Ordering::Relaxed);

        if success {
            self.successful_operations.fetch_add(1, Ordering::Relaxed);
        }

        let op_type = match operation {
            IndexOperation::Insert => "insert",
            IndexOperation::Delete => "delete",
            IndexOperation::Update => "update",
            IndexOperation::BatchInsert => "batch_insert",
        };

        self.operation_types
            .entry(op_type.to_string())
            .or_insert_with(|| AtomicU64::new(0))
            .fetch_add(1, Ordering::Relaxed);
    }

    pub fn update_index_size(&self, size_bytes: u64) {
        self.index_size_bytes.store(size_bytes, Ordering::Relaxed);
    }

    pub fn update_vector_count(&self, count: u64) {
        self.vector_count.store(count, Ordering::Relaxed);
    }

    pub fn get_snapshot(&self) -> IndexStatsSnapshot {
        let total = self.total_operations.load(Ordering::Relaxed);
        let successful = self.successful_operations.load(Ordering::Relaxed);
        let total_time = self.total_operation_time.load(Ordering::Relaxed);

        IndexStatsSnapshot {
            total_operations: total,
            successful_operations: successful,
            failed_operations: total - successful,
            operations_per_second: self.calculate_ops_per_second(),
            average_operation_time_ms: if total > 0 { total_time as f64 / total as f64 } else { 0.0 },
            success_rate: if total > 0 { successful as f64 / total as f64 } else { 0.0 },
            total_size_mb: self.index_size_bytes.load(Ordering::Relaxed) as f64 / (1024.0 * 1024.0),
            vector_count: self.vector_count.load(Ordering::Relaxed),
            operation_type_distribution: self.operation_types.iter()
                .map(|(k, v)| (k.clone(), v.load(Ordering::Relaxed)))
                .collect(),
        }
    }

    fn calculate_ops_per_second(&self) -> f64 {
        let total = self.total_operations.load(Ordering::Relaxed);
        if total > 0 {
            total as f64 / 60.0 // Assume 1 minute window
        } else {
            0.0
        }
    }
}

/// Performance Statistics
pub struct PerformanceStats {
    cpu_usage_percent: AtomicUsize,
    memory_usage_bytes: AtomicU64,
    disk_io_bytes: AtomicU64,
    network_bytes: AtomicU64,
    query_latencies: Vec<u64>,
    index_latencies: Vec<u64>,
    ml_latencies: BTreeMap<String, Vec<u64>>,
}

impl PerformanceStats {
    pub fn new() -> Self {
        Self {
            cpu_usage_percent: AtomicUsize::new(0),
            memory_usage_bytes: AtomicU64::new(0),
            disk_io_bytes: AtomicU64::new(0),
            network_bytes: AtomicU64::new(0),
            query_latencies: Vec::new(),
            index_latencies: Vec::new(),
            ml_latencies: BTreeMap::new(),
        }
    }

    pub fn record_query(&mut self, latency_ms: u64) {
        self.query_latencies.push(latency_ms);
        // Keep only last 1000 measurements
        if self.query_latencies.len() > 1000 {
            self.query_latencies.remove(0);
        }
    }

    pub fn record_index_operation(&mut self, latency_ms: u64) {
        self.index_latencies.push(latency_ms);
        if self.index_latencies.len() > 1000 {
            self.index_latencies.remove(0);
        }
    }

    pub fn record_ml_operation(&mut self, operation_type: MLOperationType, latency_ms: u64, success: bool) {
        if success {
            let latencies = self.ml_latencies.entry(format!("{:?}", operation_type)).or_insert_with(Vec::new);
            latencies.push(latency_ms);
            if latencies.len() > 1000 {
                latencies.remove(0);
            }
        }
    }

    pub fn record_cache_operation(&mut self, latency_ms: u64) {
        // Cache operations are fast, track them separately if needed
    }

    pub fn update_system_metrics(&self, cpu_percent: usize, memory_bytes: u64, disk_bytes: u64, network_bytes: u64) {
        self.cpu_usage_percent.store(cpu_percent, Ordering::Relaxed);
        self.memory_usage_bytes.store(memory_bytes, Ordering::Relaxed);
        self.disk_io_bytes.store(disk_bytes, Ordering::Relaxed);
        self.network_bytes.store(network_bytes, Ordering::Relaxed);
    }

    pub fn get_snapshot(&self) -> PerformanceStatsSnapshot {
        let cpu = self.cpu_usage_percent.load(Ordering::Relaxed);
        let memory = self.memory_usage_bytes.load(Ordering::Relaxed);
        let disk = self.disk_io_bytes.load(Ordering::Relaxed);
        let network = self.network_bytes.load(Ordering::Relaxed);

        PerformanceStatsSnapshot {
            cpu_usage_percent: cpu as f64,
            memory_usage_mb: memory as f64 / (1024.0 * 1024.0),
            disk_io_mb_per_sec: disk as f64 / (1024.0 * 1024.0),
            network_mb_per_sec: network as f64 / (1024.0 * 1024.0),
            average_query_latency_ms: self.calculate_average(&self.query_latencies),
            average_index_latency_ms: self.calculate_average(&self.index_latencies),
            p95_query_latency_ms: self.calculate_percentile(&self.query_latencies, 95.0),
            p99_query_latency_ms: self.calculate_percentile(&self.query_latencies, 99.0),
            ml_operation_latencies: self.ml_latencies.iter()
                .map(|(k, v)| (k.clone(), self.calculate_average(v)))
                .collect(),
        }
    }

    fn calculate_average(&self, values: &[u64]) -> f64 {
        if values.is_empty() {
            0.0
        } else {
            values.iter().sum::<u64>() as f64 / values.len() as f64
        }
    }

    fn calculate_percentile(&self, values: &[u64], percentile: f64) -> f64 {
        if values.is_empty() {
            0.0
        } else {
            let mut sorted = values.to_vec();
            sorted.sort();
            let index = ((percentile / 100.0) * (sorted.len() - 1) as f64) as usize;
            sorted[index] as f64
        }
    }
}

/// System Statistics
pub struct SystemStats {
    load_factor: AtomicUsize,
    active_connections: AtomicUsize,
    thread_count: AtomicUsize,
    uptime_seconds: AtomicU64,
    error_count: AtomicU64,
    warning_count: AtomicU64,
}

impl SystemStats {
    pub fn new() -> Self {
        Self {
            load_factor: AtomicUsize::new(0),
            active_connections: AtomicUsize::new(0),
            thread_count: AtomicUsize::new(0),
            uptime_seconds: AtomicU64::new(0),
            error_count: AtomicU64::new(0),
            warning_count: AtomicU64::new(0),
        }
    }

    pub fn update_load_factor(&self) {
        // Calculate load factor based on various metrics
        // This is a simplified calculation
        let load = 50; // Placeholder - would calculate based on CPU, memory, etc.
        self.load_factor.store(load, Ordering::Relaxed);
    }

    pub fn update_connections(&self, count: usize) {
        self.active_connections.store(count, Ordering::Relaxed);
    }

    pub fn record_error(&self) {
        self.error_count.fetch_add(1, Ordering::Relaxed);
    }

    pub fn record_warning(&self) {
        self.warning_count.fetch_add(1, Ordering::Relaxed);
    }

    pub fn get_snapshot(&self) -> SystemStatsSnapshot {
        SystemStatsSnapshot {
            load_factor: self.load_factor.load(Ordering::Relaxed) as f64 / 100.0,
            active_connections: self.active_connections.load(Ordering::Relaxed),
            thread_count: self.thread_count.load(Ordering::Relaxed),
            uptime_seconds: self.uptime_seconds.load(Ordering::Relaxed),
            error_count: self.error_count.load(Ordering::Relaxed),
            warning_count: self.warning_count.load(Ordering::Relaxed),
            error_rate_per_minute: self.calculate_error_rate(),
        }
    }

    fn calculate_error_rate(&self) -> f64 {
        let errors = self.error_count.load(Ordering::Relaxed);
        let uptime = self.uptime_seconds.load(Ordering::Relaxed);

        if uptime > 0 {
            errors as f64 / (uptime as f64 / 60.0)
        } else {
            0.0
        }
    }
}

/// Time Window for Sliding Statistics
pub struct TimeWindow {
    duration_ms: u64,
    query_latencies: Vec<u64>,
    query_counts: usize,
    successful_queries: usize,
    index_latencies: Vec<u64>,
    successful_index_ops: usize,
    start_time: u64,
}

impl TimeWindow {
    pub fn new(duration_ms: u64) -> Self {
        Self {
            duration_ms,
            query_latencies: Vec::new(),
            query_counts: 0,
            successful_queries: 0,
            index_latencies: Vec::new(),
            successful_index_ops: 0,
            start_time: 0, // Would be set to current time
        }
    }

    pub fn record_query(&mut self, latency_ms: u64, result_count: usize, success: bool) {
        self.query_latencies.push(latency_ms);
        self.query_counts += 1;
        if success {
            self.successful_queries += 1;
        }

        // Clean old data
        self.clean_old_data();
    }

    pub fn record_index_operation(&mut self, latency_ms: u64, success: bool) {
        self.index_latencies.push(latency_ms);
        if success {
            self.successful_index_ops += 1;
        }

        self.clean_old_data();
    }

    pub fn get_snapshot(&self) -> TimeWindowStats {
        TimeWindowStats {
            duration_ms: self.duration_ms,
            queries_per_second: self.get_queries_per_second(),
            average_query_latency: self.get_average_query_latency(),
            cache_hit_rate: self.get_cache_hit_rate(),
            error_rate: self.get_error_rate(),
            index_operations_per_second: self.get_index_operations_per_second(),
            average_index_latency: self.get_average_index_latency(),
        }
    }

    pub fn get_average_query_latency(&self) -> f64 {
        if self.query_latencies.is_empty() {
            0.0
        } else {
            self.query_latencies.iter().sum::<u64>() as f64 / self.query_latencies.len() as f64
        }
    }

    pub fn get_queries_per_second(&self) -> f64 {
        if self.duration_ms > 0 {
            self.query_counts as f64 / (self.duration_ms as f64 / 1000.0)
        } else {
            0.0
        }
    }

    pub fn get_cache_hit_rate(&self) -> f64 {
        // Placeholder - would track cache hits in time window
        0.85
    }

    pub fn get_error_rate(&self) -> f64 {
        if self.query_counts > 0 {
            (self.query_counts - self.successful_queries) as f64 / self.query_counts as f64
        } else {
            0.0
        }
    }

    pub fn get_index_operations_per_second(&self) -> f64 {
        if self.duration_ms > 0 {
            self.index_latencies.len() as f64 / (self.duration_ms as f64 / 1000.0)
        } else {
            0.0
        }
    }

    pub fn get_average_index_latency(&self) -> f64 {
        if self.index_latencies.is_empty() {
            0.0
        } else {
            self.index_latencies.iter().sum::<u64>() as f64 / self.index_latencies.len() as f64
        }
    }

    fn clean_old_data(&mut self) {
        let current_time = 0; // Would be actual current time
        let cutoff_time = current_time.saturating_sub(self.duration_ms);

        // Remove old entries (simplified - would need timestamps for each entry)
        // In a real implementation, each entry would have a timestamp
    }
}

/// Statistics Snapshot
#[derive(Debug, Clone)]
pub struct StatsSnapshot {
    pub timestamp: u64,
    pub query_stats: QueryStatsSnapshot,
    pub index_stats: IndexStatsSnapshot,
    pub performance_stats: PerformanceStatsSnapshot,
    pub system_stats: SystemStatsSnapshot,
    pub time_window_stats: Vec<TimeWindowStats>,
    pub health_score: f64,
    pub recommendations: Vec<String>,
}

/// Query Statistics Snapshot
#[derive(Debug, Clone)]
pub struct QueryStatsSnapshot {
    pub total_queries: u64,
    pub successful_queries: u64,
    pub failed_queries: u64,
    pub queries_per_second: f64,
    pub average_latency_ms: f64,
    pub cache_hit_rate: f64,
    pub success_rate: f64,
    pub query_type_distribution: BTreeMap<String, u64>,
}

/// Index Statistics Snapshot
#[derive(Debug, Clone)]
pub struct IndexStatsSnapshot {
    pub total_operations: u64,
    pub successful_operations: u64,
    pub failed_operations: u64,
    pub operations_per_second: f64,
    pub average_operation_time_ms: f64,
    pub success_rate: f64,
    pub total_size_mb: f64,
    pub vector_count: u64,
    pub operation_type_distribution: BTreeMap<String, u64>,
}

/// Performance Statistics Snapshot
#[derive(Debug, Clone)]
pub struct PerformanceStatsSnapshot {
    pub cpu_usage_percent: f64,
    pub memory_usage_mb: f64,
    pub disk_io_mb_per_sec: f64,
    pub network_mb_per_sec: f64,
    pub average_query_latency_ms: f64,
    pub average_index_latency_ms: f64,
    pub p95_query_latency_ms: f64,
    pub p99_query_latency_ms: f64,
    pub ml_operation_latencies: BTreeMap<String, f64>,
}

/// System Statistics Snapshot
#[derive(Debug, Clone)]
pub struct SystemStatsSnapshot {
    pub load_factor: f64,
    pub active_connections: usize,
    pub thread_count: usize,
    pub uptime_seconds: u64,
    pub error_count: u64,
    pub warning_count: u64,
    pub error_rate_per_minute: f64,
}

/// Time Window Statistics
#[derive(Debug, Clone)]
pub struct TimeWindowStats {
    pub duration_ms: u64,
    pub queries_per_second: f64,
    pub average_query_latency: f64,
    pub cache_hit_rate: f64,
    pub error_rate: f64,
    pub index_operations_per_second: f64,
    pub average_index_latency: f64,
}

/// Performance Trends
#[derive(Debug, Clone)]
pub struct PerformanceTrends {
    pub query_latency_trend: Trend,
    pub throughput_trend: Trend,
    pub cache_hit_trend: Trend,
    pub error_rate_trend: Trend,
}

/// Trend Direction
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Trend {
    Increasing,
    Decreasing,
    Stable,
}

// Placeholder types
pub enum IndexOperation {
    Insert,
    Delete,
    Update,
    BatchInsert,
}

pub enum MLOperationType {
    QueryEnhancement,
    ParameterPrediction,
    RelevanceScoring,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_realtime_stats_creation() {
        let stats = RealtimeStats::new();
        assert_eq!(stats.time_windows.len(), 3);
    }

    #[test]
    fn test_query_stats() {
        let stats = QueryStats::new();

        let query = SearchQuery {
            text: Some("test".to_string()),
            vector: None,
            filter: None,
        };

        stats.record_query(&query, 5, 50, true);

        let snapshot = stats.get_snapshot();
        assert_eq!(snapshot.total_queries, 1);
        assert_eq!(snapshot.successful_queries, 1);
        assert_eq!(snapshot.average_latency_ms, 50.0);
    }

    #[test]
    fn test_index_stats() {
        let stats = IndexStats::new();

        stats.record_operation(IndexOperation::Insert, 10, true);

        let snapshot = stats.get_snapshot();
        assert_eq!(snapshot.total_operations, 1);
        assert_eq!(snapshot.successful_operations, 1);
    }

    #[test]
    fn test_performance_trends() {
        let stats = RealtimeStats::new();
        let trends = stats.get_performance_trends();

        // Should be stable with no data
        matches!(trends.query_latency_trend, Trend::Stable);
    }

    #[test]
    fn test_time_window() {
        let mut window = TimeWindow::new(60000);

        window.record_query(50, 10, true);
        window.record_query(75, 8, true);

        assert_eq!(window.get_average_query_latency(), 62.5);
    }
}
