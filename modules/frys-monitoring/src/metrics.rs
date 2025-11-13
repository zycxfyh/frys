//! Metrics collection and management

use crate::*;
use alloc::collections::BTreeMap;
use alloc::string::String;
use alloc::vec::Vec;
use chrono::{DateTime, Utc};
use dashmap::DashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

/// Metrics registry for managing all metrics
pub struct MetricsRegistry {
    /// Registered metrics
    metrics: DashMap<String, Box<dyn Metric>>,
    /// Metric metadata
    metadata: DashMap<String, MetricMetadata>,
    /// Retention period in days
    retention_days: u32,
    /// Global labels
    global_labels: BTreeMap<String, String>,
}

impl MetricsRegistry {
    /// Create a new metrics registry
    pub fn new(retention_days: u32) -> Self {
        Self {
            metrics: DashMap::new(),
            metadata: DashMap::new(),
            retention_days,
            global_labels: BTreeMap::new(),
        }
    }

    /// Register a counter metric
    pub fn register_counter(&self, name: &str, help: &str, labels: &[&str]) -> Counter {
        let counter = Counter::new(name, labels);
        self.register_metric(name, help, MetricType::Counter, labels, Box::new(counter.clone()));
        counter
    }

    /// Register a gauge metric
    pub fn register_gauge(&self, name: &str, help: &str, labels: &[&str]) -> Gauge {
        let gauge = Gauge::new(name, labels);
        self.register_metric(name, help, MetricType::Gauge, labels, Box::new(gauge.clone()));
        gauge
    }

    /// Register a histogram metric
    pub fn register_histogram(
        &self,
        name: &str,
        help: &str,
        labels: &[&str],
        buckets: &[f64],
    ) -> Histogram {
        let histogram = Histogram::new(name, labels, buckets);
        self.register_metric(name, help, MetricType::Histogram, labels, Box::new(histogram.clone()));
        histogram
    }

    /// Register a summary metric
    pub fn register_summary(
        &self,
        name: &str,
        help: &str,
        labels: &[&str],
        quantiles: &[f64],
    ) -> Summary {
        let summary = Summary::new(name, labels, quantiles);
        self.register_metric(name, help, MetricType::Summary, labels, Box::new(summary.clone()));
        summary
    }

    /// Get a metric by name
    pub fn get_metric(&self, name: &str) -> Option<Box<dyn Metric>> {
        self.metrics.get(name).map(|m| dyn_clone::clone_box(&**m))
    }

    /// Get all metrics
    pub fn all_metrics(&self) -> Vec<(String, Box<dyn Metric>)> {
        self.metrics
            .iter()
            .map(|entry| (entry.key().clone(), dyn_clone::clone_box(&**entry.value())))
            .collect()
    }

    /// Get total number of metrics
    pub fn total_metrics(&self) -> u64 {
        self.metrics.len() as u64
    }

    /// Set global labels
    pub fn set_global_labels(&mut self, labels: BTreeMap<String, String>) {
        self.global_labels = labels;
    }

    /// Get metrics in Prometheus format
    pub fn prometheus_format(&self) -> String {
        let mut output = String::new();

        for entry in self.metrics.iter() {
            let name = entry.key();
            let metric = entry.value();

            if let Some(metadata) = self.metadata.get(name) {
                // Add HELP comment
                output.push_str(&format!("# HELP {} {}\n", name, metadata.help));

                // Add TYPE comment
                output.push_str(&format!("# TYPE {} {}\n", name, metadata.metric_type.to_string().to_lowercase()));
            }

            // Add metric values
            output.push_str(&metric.prometheus_format());
        }

        output
    }

    /// Clean up old metrics data (placeholder)
    pub async fn cleanup_old_data(&self) -> Result<()> {
        // In a real implementation, this would remove data older than retention_days
        // For now, just return success
        Ok(())
    }

    fn register_metric(
        &self,
        name: &str,
        help: &str,
        metric_type: MetricType,
        labels: &[&str],
        metric: Box<dyn Metric>,
    ) {
        let metadata = MetricMetadata {
            name: name.to_string(),
            help: help.to_string(),
            metric_type,
            labels: labels.iter().map(|s| s.to_string()).collect(),
        };

        self.metadata.insert(name.to_string(), metadata);
        self.metrics.insert(name.to_string(), metric);
    }
}

/// Metric metadata
#[derive(Debug, Clone)]
pub struct MetricMetadata {
    pub name: String,
    pub help: String,
    pub metric_type: MetricType,
    pub labels: Vec<String>,
}

/// Metric types
#[derive(Debug, Clone)]
pub enum MetricType {
    Counter,
    Gauge,
    Histogram,
    Summary,
}

impl ToString for MetricType {
    fn to_string(&self) -> String {
        match self {
            MetricType::Counter => "counter",
            MetricType::Gauge => "gauge",
            MetricType::Histogram => "histogram",
            MetricType::Summary => "summary",
        }.to_string()
    }
}

/// Metric trait
pub trait Metric: Send + Sync + dyn_clone::DynClone {
    fn prometheus_format(&self) -> String;
    fn metric_type(&self) -> MetricType;
    fn name(&self) -> &str;
}

/// Counter metric
#[derive(Debug, Clone)]
pub struct Counter {
    name: String,
    labels: Vec<String>,
    value: Arc<AtomicU64>,
    label_values: DashMap<Vec<String>, Arc<AtomicU64>>,
}

impl Counter {
    pub fn new(name: &str, labels: &[&str]) -> Self {
        Self {
            name: name.to_string(),
            labels: labels.iter().map(|s| s.to_string()).collect(),
            value: Arc::new(AtomicU64::new(0)),
            label_values: DashMap::new(),
        }
    }

    pub fn inc(&self, label_values: &[(&str, &str)]) {
        if self.labels.is_empty() {
            self.value.fetch_add(1, Ordering::Relaxed);
        } else {
            let key = self.labels.iter()
                .map(|label| {
                    label_values.iter()
                        .find(|(k, _)| k == label)
                        .map(|(_, v)| v.to_string())
                        .unwrap_or_default()
                })
                .collect::<Vec<_>>();

            let counter = self.label_values.entry(key)
                .or_insert_with(|| Arc::new(AtomicU64::new(0)));
            counter.fetch_add(1, Ordering::Relaxed);
        }
    }

    pub fn add(&self, value: u64, label_values: &[(&str, &str)]) {
        if self.labels.is_empty() {
            self.value.fetch_add(value, Ordering::Relaxed);
        } else {
            let key = self.labels.iter()
                .map(|label| {
                    label_values.iter()
                        .find(|(k, _)| k == label)
                        .map(|(_, v)| v.to_string())
                        .unwrap_or_default()
                })
                .collect::<Vec<_>>();

            let counter = self.label_values.entry(key)
                .or_insert_with(|| Arc::new(AtomicU64::new(0)));
            counter.fetch_add(value, Ordering::Relaxed);
        }
    }

    pub fn get(&self, label_values: &[(&str, &str)]) -> u64 {
        if self.labels.is_empty() {
            self.value.load(Ordering::Relaxed)
        } else {
            let key = self.labels.iter()
                .map(|label| {
                    label_values.iter()
                        .find(|(k, _)| k == label)
                        .map(|(_, v)| v.to_string())
                        .unwrap_or_default()
                })
                .collect::<Vec<_>>();

            self.label_values.get(&key)
                .map(|c| c.load(Ordering::Relaxed))
                .unwrap_or(0)
        }
    }
}

impl Metric for Counter {
    fn prometheus_format(&self) -> String {
        let mut output = String::new();

        if self.labels.is_empty() {
            output.push_str(&format!("{} {}\n", self.name, self.value.load(Ordering::Relaxed)));
        } else {
            for entry in self.label_values.iter() {
                let labels_str = entry.key().iter()
                    .zip(self.labels.iter())
                    .map(|(value, label)| format!("{}=\"{}\"", label, value))
                    .collect::<Vec<_>>()
                    .join(",");

                output.push_str(&format!(
                    "{}{{{}}} {}\n",
                    self.name,
                    labels_str,
                    entry.value().load(Ordering::Relaxed)
                ));
            }
        }

        output
    }

    fn metric_type(&self) -> MetricType {
        MetricType::Counter
    }

    fn name(&self) -> &str {
        &self.name
    }
}

/// Gauge metric
#[derive(Debug, Clone)]
pub struct Gauge {
    name: String,
    labels: Vec<String>,
    value: Arc<AtomicU64>,
    label_values: DashMap<Vec<String>, Arc<AtomicU64>>,
}

impl Gauge {
    pub fn new(name: &str, labels: &[&str]) -> Self {
        Self {
            name: name.to_string(),
            labels: labels.iter().map(|s| s.to_string()).collect(),
            value: Arc::new(AtomicU64::new(0)),
            label_values: DashMap::new(),
        }
    }

    pub fn set(&self, value: f64, label_values: &[(&str, &str)]) {
        let int_value = (value * 1000.0) as u64; // Store as milliunits for precision

        if self.labels.is_empty() {
            self.value.store(int_value, Ordering::Relaxed);
        } else {
            let key = self.labels.iter()
                .map(|label| {
                    label_values.iter()
                        .find(|(k, _)| k == label)
                        .map(|(_, v)| v.to_string())
                        .unwrap_or_default()
                })
                .collect::<Vec<_>>();

            let gauge = self.label_values.entry(key)
                .or_insert_with(|| Arc::new(AtomicU64::new(0)));
            gauge.store(int_value, Ordering::Relaxed);
        }
    }

    pub fn inc(&self, label_values: &[(&str, &str)]) {
        if self.labels.is_empty() {
            self.value.fetch_add(1000, Ordering::Relaxed);
        } else {
            let key = self.labels.iter()
                .map(|label| {
                    label_values.iter()
                        .find(|(k, _)| k == label)
                        .map(|(_, v)| v.to_string())
                        .unwrap_or_default()
                })
                .collect::<Vec<_>>();

            let gauge = self.label_values.entry(key)
                .or_insert_with(|| Arc::new(AtomicU64::new(0)));
            gauge.fetch_add(1000, Ordering::Relaxed);
        }
    }

    pub fn dec(&self, label_values: &[(&str, &str)]) {
        if self.labels.is_empty() {
            self.value.fetch_sub(1000, Ordering::Relaxed);
        } else {
            let key = self.labels.iter()
                .map(|label| {
                    label_values.iter()
                        .find(|(k, _)| k == label)
                        .map(|(_, v)| v.to_string())
                        .unwrap_or_default()
                })
                .collect::<Vec<_>>();

            let gauge = self.label_values.entry(key)
                .or_insert_with(|| Arc::new(AtomicU64::new(0)));
            gauge.fetch_sub(1000, Ordering::Relaxed);
        }
    }

    pub fn get(&self, label_values: &[(&str, &str)]) -> f64 {
        let int_value = if self.labels.is_empty() {
            self.value.load(Ordering::Relaxed)
        } else {
            let key = self.labels.iter()
                .map(|label| {
                    label_values.iter()
                        .find(|(k, _)| k == label)
                        .map(|(_, v)| v.to_string())
                        .unwrap_or_default()
                })
                .collect::<Vec<_>>();

            self.label_values.get(&key)
                .map(|g| g.load(Ordering::Relaxed))
                .unwrap_or(0)
        };

        int_value as f64 / 1000.0
    }
}

impl Metric for Gauge {
    fn prometheus_format(&self) -> String {
        let mut output = String::new();

        if self.labels.is_empty() {
            let value = self.value.load(Ordering::Relaxed) as f64 / 1000.0;
            output.push_str(&format!("{} {}\n", self.name, value));
        } else {
            for entry in self.label_values.iter() {
                let labels_str = entry.key().iter()
                    .zip(self.labels.iter())
                    .map(|(value, label)| format!("{}=\"{}\"", label, value))
                    .collect::<Vec<_>>()
                    .join(",");

                let value = entry.value().load(Ordering::Relaxed) as f64 / 1000.0;
                output.push_str(&format!(
                    "{}{{{}}} {}\n",
                    self.name,
                    labels_str,
                    value
                ));
            }
        }

        output
    }

    fn metric_type(&self) -> MetricType {
        MetricType::Gauge
    }

    fn name(&self) -> &str {
        &self.name
    }
}

/// Histogram metric (simplified implementation)
#[derive(Debug, Clone)]
pub struct Histogram {
    name: String,
    labels: Vec<String>,
    buckets: Vec<f64>,
    count: Arc<AtomicU64>,
    sum: Arc<AtomicU64>,
}

impl Histogram {
    pub fn new(name: &str, labels: &[&str], buckets: &[f64]) -> Self {
        Self {
            name: name.to_string(),
            labels: labels.iter().map(|s| s.to_string()).collect(),
            buckets: buckets.to_vec(),
            count: Arc::new(AtomicU64::new(0)),
            sum: Arc::new(AtomicU64::new(0)),
        }
    }

    pub fn observe(&self, value: f64, _label_values: &[(&str, &str)]) {
        // Simplified implementation - in a real histogram,
        // this would update bucket counts
        self.count.fetch_add(1, Ordering::Relaxed);
        let int_value = (value * 1000.0) as u64;
        self.sum.fetch_add(int_value, Ordering::Relaxed);
    }
}

impl Metric for Histogram {
    fn prometheus_format(&self) -> String {
        let mut output = String::new();
        let count = self.count.load(Ordering::Relaxed);
        let sum = self.sum.load(Ordering::Relaxed) as f64 / 1000.0;

        output.push_str(&format!("{}_count {}\n", self.name, count));
        output.push_str(&format!("{}_sum {}\n", self.name, sum));

        // Simplified bucket output
        for bucket in &self.buckets {
            output.push_str(&format!("{}_bucket{{le=\"{}\"}} {}\n", self.name, bucket, count));
        }

        output
    }

    fn metric_type(&self) -> MetricType {
        MetricType::Histogram
    }

    fn name(&self) -> &str {
        &self.name
    }
}

/// Summary metric (simplified implementation)
#[derive(Debug, Clone)]
pub struct Summary {
    name: String,
    labels: Vec<String>,
    quantiles: Vec<f64>,
    count: Arc<AtomicU64>,
    sum: Arc<AtomicU64>,
}

impl Summary {
    pub fn new(name: &str, labels: &[&str], quantiles: &[f64]) -> Self {
        Self {
            name: name.to_string(),
            labels: labels.iter().map(|s| s.to_string()).collect(),
            quantiles: quantiles.to_vec(),
            count: Arc::new(AtomicU64::new(0)),
            sum: Arc::new(AtomicU64::new(0)),
        }
    }

    pub fn observe(&self, value: f64, _label_values: &[(&str, &str)]) {
        self.count.fetch_add(1, Ordering::Relaxed);
        let int_value = (value * 1000.0) as u64;
        self.sum.fetch_add(int_value, Ordering::Relaxed);
    }
}

impl Metric for Summary {
    fn prometheus_format(&self) -> String {
        let mut output = String::new();
        let count = self.count.load(Ordering::Relaxed);
        let sum = self.sum.load(Ordering::Relaxed) as f64 / 1000.0;

        output.push_str(&format!("{}_count {}\n", self.name, count));
        output.push_str(&format!("{}_sum {}\n", self.name, sum));

        // Simplified quantile output
        for quantile in &self.quantiles {
            let quantile_name = format!("{:.2}", quantile).replace(".", "_");
            output.push_str(&format!("{{{}}} {}\n", quantile_name, sum / count as f64));
        }

        output
    }

    fn metric_type(&self) -> MetricType {
        MetricType::Summary
    }

    fn name(&self) -> &str {
        &self.name
    }
}

dyn_clone::clone_trait_object!(Metric);

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_counter() {
        let counter = Counter::new("test_counter", &["method"]);

        counter.inc(&[("method", "GET")]);
        counter.inc(&[("method", "POST")]);
        counter.add(5, &[("method", "GET")]);

        assert_eq!(counter.get(&[("method", "GET")]), 6);
        assert_eq!(counter.get(&[("method", "POST")]), 1);
    }

    #[test]
    fn test_gauge() {
        let gauge = Gauge::new("test_gauge", &["service"]);

        gauge.set(10.5, &[("service", "api")]);
        gauge.inc(&[("service", "api")]);
        gauge.dec(&[("service", "api")]);

        assert_eq!(gauge.get(&[("service", "api")]), 10.5);
    }

    #[test]
    fn test_metrics_registry() {
        let registry = MetricsRegistry::new(30);

        let counter = registry.register_counter("requests_total", "Total requests", &["method"]);
        let gauge = registry.register_gauge("memory_usage", "Memory usage", &["service"]);

        counter.inc(&[("method", "GET")]);
        gauge.set(128.5, &[("service", "api")]);

        assert_eq!(registry.total_metrics(), 2);
        assert!(registry.get_metric("requests_total").is_some());
    }

    #[test]
    fn test_prometheus_format() {
        let registry = MetricsRegistry::new(30);
        let counter = registry.register_counter("test_counter", "A test counter", &["label"]);

        counter.inc(&[("label", "value1")]);
        counter.inc(&[("label", "value2")]);

        let prometheus_output = registry.prometheus_format();

        assert!(prometheus_output.contains("# HELP test_counter A test counter"));
        assert!(prometheus_output.contains("# TYPE test_counter counter"));
        assert!(prometheus_output.contains("test_counter{label=\"value1\"} 1"));
        assert!(prometheus_output.contains("test_counter{label=\"value2\"} 1"));
    }
}
