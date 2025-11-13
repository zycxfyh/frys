//! Query processing and optimization for vector search

use crate::*;

/// Query processor for handling search requests
#[derive(Debug)]
pub struct QueryProcessor {
    /// Query cache
    cache: QueryCache,
    /// Query optimizer
    optimizer: QueryOptimizer,
    /// Statistics
    stats: QueryStats,
}

impl QueryProcessor {
    /// Create a new query processor
    pub fn new() -> Self {
        Self {
            cache: QueryCache::new(1000), // Cache 1000 queries
            optimizer: QueryOptimizer::new(),
            stats: QueryStats::default(),
        }
    }

    /// Process a search query
    pub async fn process_query(&mut self, query: Vector, config: SearchConfig) -> Result<ProcessedQuery> {
        let start_time = current_timestamp();

        // Check cache first
        let cache_key = self.generate_cache_key(&query, &config);
        if let Some(cached_result) = self.cache.get(&cache_key) {
            self.stats.record_cache_hit();
            return Ok(cached_result);
        }

        // Optimize query
        let optimized_config = self.optimizer.optimize_config(config, &query);

        // Process query
        let processed = ProcessedQuery {
            original_query: query,
            optimized_config,
            cache_key,
            processing_time: current_timestamp() - start_time,
            estimated_cost: self.estimate_query_cost(&optimized_config),
        };

        // Cache result if beneficial
        if self.should_cache(&processed) {
            self.cache.put(cache_key, processed.clone());
        }

        self.stats.record_query_processed(processed.processing_time);

        Ok(processed)
    }

    /// Estimate query cost
    fn estimate_query_cost(&self, config: &SearchConfig) -> f64 {
        // Simple cost estimation based on k and ef parameters
        let base_cost = 10.0;
        let k_cost = config.k as f64 * 2.0;
        let ef_cost = config.ef as f64 * 0.1;

        base_cost + k_cost + ef_cost
    }

    /// Check if query should be cached
    fn should_cache(&self, query: &ProcessedQuery) -> bool {
        // Cache expensive queries
        query.estimated_cost > 50.0
    }

    /// Generate cache key for query
    fn generate_cache_key(&self, query: &Vector, config: &SearchConfig) -> u64 {
        use core::hash::{Hash, Hasher};
        use std::collections::hash_map::DefaultHasher;

        let mut hasher = DefaultHasher::new();
        query.as_slice().hash(&mut hasher);
        config.k.hash(&mut hasher);
        config.ef.hash(&mut hasher);

        hasher.finish()
    }

    /// Get query statistics
    pub fn stats(&self) -> &QueryStats {
        &self.stats
    }
}

/// Processed query result
#[derive(Debug, Clone)]
pub struct ProcessedQuery {
    /// Original query vector
    pub original_query: Vector,
    /// Optimized search configuration
    pub optimized_config: SearchConfig,
    /// Cache key
    pub cache_key: u64,
    /// Processing time in milliseconds
    pub processing_time: u64,
    /// Estimated query cost
    pub estimated_cost: f64,
}

/// Query cache for result caching
#[derive(Debug)]
pub struct QueryCache {
    /// Cache storage (simple implementation)
    cache: std::collections::HashMap<u64, ProcessedQuery>,
    /// Maximum cache size
    max_size: usize,
}

impl QueryCache {
    /// Create a new query cache
    pub fn new(max_size: usize) -> Self {
        Self {
            cache: std::collections::HashMap::new(),
            max_size,
        }
    }

    /// Get cached query result
    pub fn get(&self, key: &u64) -> Option<ProcessedQuery> {
        self.cache.get(key).cloned()
    }

    /// Put query result in cache
    pub fn put(&mut self, key: u64, query: ProcessedQuery) {
        if self.cache.len() >= self.max_size {
            // Simple eviction: remove oldest
            if let Some(key_to_remove) = self.cache.keys().next().cloned() {
                self.cache.remove(&key_to_remove);
            }
        }

        self.cache.insert(key, query);
    }

    /// Clear cache
    pub fn clear(&mut self) {
        self.cache.clear();
    }

    /// Get cache statistics
    pub fn stats(&self) -> CacheStats {
        CacheStats {
            size: self.cache.len(),
            max_size: self.max_size,
            hit_ratio: 0.0, // Would need hit/miss tracking
        }
    }
}

/// Cache statistics
#[derive(Debug, Clone)]
pub struct CacheStats {
    pub size: usize,
    pub max_size: usize,
    pub hit_ratio: f64,
}

/// Query optimizer
#[derive(Debug)]
pub struct QueryOptimizer {
    /// Optimization rules
    rules: Vec<OptimizationRule>,
}

impl QueryOptimizer {
    /// Create a new query optimizer
    pub fn new() -> Self {
        Self {
            rules: vec![
                OptimizationRule::AdaptiveEF,
                OptimizationRule::KClamping,
                OptimizationRule::EarlyTermination,
            ],
        }
    }

    /// Optimize search configuration
    pub fn optimize_config(&self, config: SearchConfig, query: &Vector) -> SearchConfig {
        let mut optimized = config;

        for rule in &self.rules {
            optimized = rule.apply(optimized, query);
        }

        optimized
    }
}

/// Optimization rules
#[derive(Debug, Clone)]
pub enum OptimizationRule {
    /// Adaptively adjust ef parameter
    AdaptiveEF,
    /// Clamp k to reasonable bounds
    KClamping,
    /// Enable early termination for high-confidence results
    EarlyTermination,
}

impl OptimizationRule {
    /// Apply optimization rule
    pub fn apply(&self, config: SearchConfig, _query: &Vector) -> SearchConfig {
        let mut new_config = config;

        match self {
            OptimizationRule::AdaptiveEF => {
                // Increase ef for higher accuracy
                if new_config.k > 50 {
                    new_config.ef = (new_config.ef * 2).min(500);
                }
            }
            OptimizationRule::KClamping => {
                // Clamp k to reasonable bounds
                new_config.k = new_config.k.min(1000).max(1);
            }
            OptimizationRule::EarlyTermination => {
                // Enable early termination for large k
                if new_config.k > 100 {
                    // Would set early termination parameters
                }
            }
        }

        new_config
    }
}

/// Query statistics
#[derive(Debug, Clone, Default)]
pub struct QueryStats {
    /// Total queries processed
    pub total_queries: u64,
    /// Cache hits
    pub cache_hits: u64,
    /// Cache misses
    pub cache_misses: u64,
    /// Total processing time
    pub total_processing_time: u64,
    /// Average query time
    pub avg_query_time: f64,
}

impl QueryStats {
    /// Record cache hit
    pub fn record_cache_hit(&mut self) {
        self.cache_hits += 1;
    }

    /// Record processed query
    pub fn record_query_processed(&mut self, processing_time: u64) {
        self.total_queries += 1;
        self.cache_misses += 1;
        self.total_processing_time += processing_time;
        self.update_average();
    }

    /// Update average query time
    pub fn update_average(&mut self) {
        if self.total_queries > 0 {
            self.avg_query_time = self.total_processing_time as f64 / self.total_queries as f64;
        }
    }

    /// Get cache hit ratio
    pub fn cache_hit_ratio(&self) -> f64 {
        let total = self.cache_hits + self.cache_misses;
        if total == 0 {
            0.0
        } else {
            self.cache_hits as f64 / total as f64
        }
    }
}

/// Get current timestamp (simplified)
fn current_timestamp() -> u64 {
    0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_query_processor() {
        let mut processor = QueryProcessor::new();
        let query = Vector::new(vec![1.0, 2.0, 3.0]);
        let config = SearchConfig::default();

        let result = tokio::runtime::Runtime::new().unwrap()
            .block_on(processor.process_query(query, config))
            .unwrap();

        assert!(result.processing_time >= 0);
        assert!(result.estimated_cost > 0.0);
    }

    #[test]
    fn test_query_cache() {
        let mut cache = QueryCache::new(10);

        let query = ProcessedQuery {
            original_query: Vector::new(vec![1.0]),
            optimized_config: SearchConfig::default(),
            cache_key: 123,
            processing_time: 100,
            estimated_cost: 10.0,
        };

        cache.put(123, query.clone());
        let retrieved = cache.get(&123).unwrap();

        assert_eq!(retrieved.cache_key, 123);
    }

    #[test]
    fn test_query_optimizer() {
        let optimizer = QueryOptimizer::new();

        let mut config = SearchConfig {
            k: 2000, // Too high
            ef: 32,
            ..Default::default()
        };

        let query = Vector::new(vec![1.0]);
        let optimized = optimizer.optimize_config(config, &query);

        assert_eq!(optimized.k, 1000); // Should be clamped
    }

    #[test]
    fn test_query_stats() {
        let mut stats = QueryStats::default();

        stats.record_cache_hit();
        stats.record_query_processed(100);

        assert_eq!(stats.total_queries, 1);
        assert_eq!(stats.cache_hits, 1);
        assert_eq!(stats.cache_hit_ratio(), 0.5);
        assert_eq!(stats.avg_query_time, 100.0);
    }
}
