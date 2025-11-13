//! Metrics for storage plugin

use alloc::collections::BTreeMap;

/// Storage metrics collector
#[derive(Debug, Clone)]
pub struct StorageMetrics {
    /// Total store operations
    store_operations: u64,
    /// Total retrieve operations
    retrieve_operations: u64,
    /// Total delete operations
    delete_operations: u64,
    /// Total operation time
    total_operation_time: u64,
    /// Cache hits
    cache_hits: u64,
    /// Cache misses
    cache_misses: u64,
    /// Total data stored
    total_data_stored: u64,
    /// Total data retrieved
    total_data_retrieved: u64,
}

impl StorageMetrics {
    pub fn new() -> Self {
        Self {
            store_operations: 0,
            retrieve_operations: 0,
            delete_operations: 0,
            total_operation_time: 0,
            cache_hits: 0,
            cache_misses: 0,
            total_data_stored: 0,
            total_data_retrieved: 0,
        }
    }

    pub fn record_store_operation(&mut self, duration_ms: u64, data_size: usize) {
        self.store_operations += 1;
        self.total_operation_time += duration_ms;
        self.total_data_stored += data_size as u64;
    }

    pub fn record_retrieve_operation(&mut self, duration_ms: u64, data_size: usize) {
        self.retrieve_operations += 1;
        self.total_operation_time += duration_ms;
        self.total_data_retrieved += data_size as u64;
    }

    pub fn record_delete_operation(&mut self, duration_ms: u64) {
        self.delete_operations += 1;
        self.total_operation_time += duration_ms;
    }

    pub fn record_cache_hit(&mut self) {
        self.cache_hits += 1;
    }

    pub fn record_cache_miss(&mut self) {
        self.cache_misses += 1;
    }

    pub fn get_summary(&self) -> OperationMetrics {
        let total_operations = self.store_operations + self.retrieve_operations + self.delete_operations;
        let cache_hit_rate = if self.cache_hits + self.cache_misses > 0 {
            self.cache_hits as f64 / (self.cache_hits + self.cache_misses) as f64
        } else {
            0.0
        };

        OperationMetrics {
            total_operations,
            store_operations: self.store_operations,
            retrieve_operations: self.retrieve_operations,
            delete_operations: self.delete_operations,
            average_operation_time: if total_operations > 0 {
                self.total_operation_time as f64 / total_operations as f64
            } else {
                0.0
            },
            cache_hit_rate,
            total_data_stored: self.total_data_stored,
            total_data_retrieved: self.total_data_retrieved,
        }
    }
}

/// Operation metrics
#[derive(Debug, Clone)]
pub struct OperationMetrics {
    pub total_operations: u64,
    pub store_operations: u64,
    pub retrieve_operations: u64,
    pub delete_operations: u64,
    pub average_operation_time: f64,
    pub cache_hit_rate: f64,
    pub total_data_stored: u64,
    pub total_data_retrieved: u64,
}

/// Cache statistics
#[derive(Debug, Clone)]
pub struct CacheStats {
    pub total_entries: usize,
    pub hit_rate: f64,
    pub memory_usage: usize,
}

/// Compression statistics
#[derive(Debug, Clone)]
pub struct CompressionStats {
    pub total_compressed: u64,
    pub total_uncompressed: u64,
    pub average_ratio: f64,
}

/// Encryption statistics
#[derive(Debug, Clone)]
pub struct EncryptionStats {
    pub total_encrypted: u64,
    pub total_decrypted: u64,
    pub encryption_time: u64,
}
