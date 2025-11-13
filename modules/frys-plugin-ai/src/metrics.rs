//! Metrics and monitoring for AI plugin

use alloc::collections::BTreeMap;
use alloc::string::String;

/// AI metrics collector
#[derive(Debug, Clone)]
pub struct AIMetrics {
    /// Total inference requests
    total_inferences: u64,
    /// Successful inferences
    successful_inferences: u64,
    /// Failed inferences
    failed_inferences: u64,
    /// Total inference time (ms)
    total_inference_time: u64,
    /// Model load count
    model_loads: u64,
    /// Model unload count
    model_unloads: u64,
    /// Training sessions
    training_sessions: u64,
    /// Cache hit rate
    cache_hits: u64,
    /// Cache misses
    cache_misses: u64,
    /// Model-specific metrics
    model_metrics: BTreeMap<String, ModelMetrics>,
}

impl AIMetrics {
    /// Create new metrics collector
    pub fn new() -> Self {
        Self {
            total_inferences: 0,
            successful_inferences: 0,
            failed_inferences: 0,
            total_inference_time: 0,
            model_loads: 0,
            model_unloads: 0,
            training_sessions: 0,
            cache_hits: 0,
            cache_misses: 0,
            model_metrics: BTreeMap::new(),
        }
    }

    /// Record inference operation
    pub fn record_inference(&mut self, model_name: &str, duration_ms: u64, success: bool) {
        self.total_inferences += 1;
        self.total_inference_time += duration_ms;

        if success {
            self.successful_inferences += 1;
        } else {
            self.failed_inferences += 1;
        }

        // Update model-specific metrics
        let model_metric = self.model_metrics.entry(model_name.to_string()).or_insert_with(ModelMetrics::new);
        model_metric.record_inference(duration_ms, success);
    }

    /// Record model loading
    pub fn record_model_loaded(&mut self, model_name: &str, model_type: ModelType) {
        self.model_loads += 1;
        let model_metric = self.model_metrics.entry(model_name.to_string()).or_insert_with(ModelMetrics::new);
        model_metric.load_count += 1;
    }

    /// Record model unloading
    pub fn record_model_unloaded(&mut self, model_name: &str) {
        self.model_unloads += 1;
        let model_metric = self.model_metrics.entry(model_name.to_string()).or_insert_with(ModelMetrics::new);
        model_metric.unload_count += 1;
    }

    /// Record training session
    pub fn record_training(&mut self, model_name: &str, examples_count: usize) {
        self.training_sessions += 1;
        let model_metric = self.model_metrics.entry(model_name.to_string()).or_insert_with(ModelMetrics::new);
        model_metric.training_sessions += 1;
        model_metric.total_training_examples += examples_count;
    }

    /// Record cache operation
    pub fn record_cache_operation(&mut self, hit: bool) {
        if hit {
            self.cache_hits += 1;
        } else {
            self.cache_misses += 1;
        }
    }

    /// Get overall metrics
    pub fn get_overall_metrics(&self) -> OverallMetrics {
        let cache_hit_rate = if self.cache_hits + self.cache_misses > 0 {
            self.cache_hits as f64 / (self.cache_hits + self.cache_misses) as f64
        } else {
            0.0
        };

        let avg_inference_time = if self.total_inferences > 0 {
            self.total_inference_time as f64 / self.total_inferences as f64
        } else {
            0.0
        };

        let success_rate = if self.total_inferences > 0 {
            self.successful_inferences as f64 / self.total_inferences as f64
        } else {
            0.0
        };

        OverallMetrics {
            total_inferences: self.total_inferences,
            successful_inferences: self.successful_inferences,
            failed_inferences: self.failed_inferences,
            average_inference_time_ms: avg_inference_time,
            success_rate,
            cache_hit_rate,
            total_model_loads: self.model_loads,
            total_model_unloads: self.model_unloads,
            total_training_sessions: self.training_sessions,
        }
    }

    /// Get model-specific metrics
    pub fn get_model_metrics(&self, model_name: &str) -> Option<&ModelMetrics> {
        self.model_metrics.get(model_name)
    }

    /// Get all model metrics
    pub fn get_all_model_metrics(&self) -> Vec<(String, ModelMetrics)> {
        self.model_metrics.iter()
            .map(|(name, metrics)| (name.clone(), metrics.clone()))
            .collect()
    }

    /// Reset all metrics
    pub fn reset(&mut self) {
        self.total_inferences = 0;
        self.successful_inferences = 0;
        self.failed_inferences = 0;
        self.total_inference_time = 0;
        self.model_loads = 0;
        self.model_unloads = 0;
        self.training_sessions = 0;
        self.cache_hits = 0;
        self.cache_misses = 0;
        self.model_metrics.clear();
    }
}

/// Overall metrics
#[derive(Debug, Clone)]
pub struct OverallMetrics {
    pub total_inferences: u64,
    pub successful_inferences: u64,
    pub failed_inferences: u64,
    pub average_inference_time_ms: f64,
    pub success_rate: f64,
    pub cache_hit_rate: f64,
    pub total_model_loads: u64,
    pub total_model_unloads: u64,
    pub total_training_sessions: u64,
}

impl OverallMetrics {
    /// Convert to JSON for external monitoring systems
    pub fn to_json(&self) -> Result<String> {
        serde_json::to_string(self)
            .map_err(|e| AIPluginError::SerializationError(e.to_string()))
    }
}

/// Model-specific metrics
#[derive(Debug, Clone)]
pub struct ModelMetrics {
    pub inference_count: u64,
    pub successful_inferences: u64,
    pub failed_inferences: u64,
    pub total_inference_time: u64,
    pub load_count: u64,
    pub unload_count: u64,
    pub training_sessions: u64,
    pub total_training_examples: usize,
    pub average_inference_time: f64,
    pub success_rate: f64,
}

impl ModelMetrics {
    pub fn new() -> Self {
        Self {
            inference_count: 0,
            successful_inferences: 0,
            failed_inferences: 0,
            total_inference_time: 0,
            load_count: 0,
            unload_count: 0,
            training_sessions: 0,
            total_training_examples: 0,
            average_inference_time: 0.0,
            success_rate: 0.0,
        }
    }

    pub fn record_inference(&mut self, duration_ms: u64, success: bool) {
        self.inference_count += 1;
        self.total_inference_time += duration_ms;

        if success {
            self.successful_inferences += 1;
        } else {
            self.failed_inferences += 1;
        }

        // Update calculated metrics
        self.average_inference_time = self.total_inference_time as f64 / self.inference_count as f64;
        self.success_rate = self.successful_inferences as f64 / self.inference_count as f64;
    }
}

/// Performance tracker for real-time monitoring
pub struct PerformanceTracker {
    /// Recent inference times (circular buffer)
    inference_times: Vec<u64>,
    /// Current buffer position
    buffer_pos: usize,
    /// Buffer size
    buffer_size: usize,
}

impl PerformanceTracker {
    pub fn new(buffer_size: usize) -> Self {
        Self {
            inference_times: vec![0; buffer_size],
            buffer_pos: 0,
            buffer_size,
        }
    }

    /// Record inference time
    pub fn record_inference_time(&mut self, duration_ms: u64) {
        self.inference_times[self.buffer_pos] = duration_ms;
        self.buffer_pos = (self.buffer_pos + 1) % self.buffer_size;
    }

    /// Get average inference time over recent samples
    pub fn get_average_inference_time(&self) -> f64 {
        let sum: u64 = self.inference_times.iter().sum();
        sum as f64 / self.buffer_size as f64
    }

    /// Get percentile inference time
    pub fn get_percentile_inference_time(&self, percentile: f64) -> u64 {
        let mut sorted_times = self.inference_times.clone();
        sorted_times.sort();

        let index = ((percentile / 100.0) * (self.buffer_size - 1) as f64) as usize;
        sorted_times[index]
    }

    /// Get throughput (inferences per second)
    pub fn get_throughput(&self, time_window_ms: u64) -> f64 {
        let total_inferences = self.buffer_size as f64;
        let time_window_seconds = time_window_ms as f64 / 1000.0;
        total_inferences / time_window_seconds
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ai_metrics_creation() {
        let metrics = AIMetrics::new();
        assert_eq!(metrics.total_inferences, 0);
        assert_eq!(metrics.successful_inferences, 0);
    }

    #[test]
    fn test_record_inference() {
        let mut metrics = AIMetrics::new();

        metrics.record_inference("test_model", 100, true);
        metrics.record_inference("test_model", 200, false);

        let overall = metrics.get_overall_metrics();
        assert_eq!(overall.total_inferences, 2);
        assert_eq!(overall.successful_inferences, 1);
        assert_eq!(overall.failed_inferences, 1);
        assert_eq!(overall.average_inference_time_ms, 150.0);
    }

    #[test]
    fn test_model_metrics() {
        let mut metrics = AIMetrics::new();

        metrics.record_model_loaded("test_model", ModelType::NLP);
        metrics.record_inference("test_model", 100, true);

        let model_metrics = metrics.get_model_metrics("test_model").unwrap();
        assert_eq!(model_metrics.load_count, 1);
        assert_eq!(model_metrics.inference_count, 1);
        assert_eq!(model_metrics.success_rate, 1.0);
    }

    #[test]
    fn test_performance_tracker() {
        let mut tracker = PerformanceTracker::new(5);

        tracker.record_inference_time(100);
        tracker.record_inference_time(150);
        tracker.record_inference_time(200);

        let avg = tracker.get_average_inference_time();
        assert_eq!(avg, 90.0); // (100+150+200+0+0)/5 = 90

        let p95 = tracker.get_percentile_inference_time(95.0);
        assert_eq!(p95, 200); // 95th percentile in sorted array [0,0,100,150,200]
    }

    #[test]
    fn test_overall_metrics_json() {
        let metrics = OverallMetrics {
            total_inferences: 100,
            successful_inferences: 95,
            failed_inferences: 5,
            average_inference_time_ms: 50.0,
            success_rate: 0.95,
            cache_hit_rate: 0.8,
            total_model_loads: 5,
            total_model_unloads: 2,
            total_training_sessions: 3,
        };

        let json = metrics.to_json().unwrap();
        assert!(json.contains("total_inferences"));
        assert!(json.contains("95"));
    }
}
