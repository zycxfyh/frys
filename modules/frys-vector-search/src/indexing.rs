//! Vector indexing and storage management

use crate::*;

/// Vector indexer for managing index operations
#[derive(Debug)]
pub struct VectorIndexer {
    /// Index algorithm
    algorithm: Box<dyn VectorIndex>,
    /// Configuration
    config: EngineConfig,
    /// Statistics
    stats: IndexingStats,
    /// Background optimization task
    #[cfg(feature = "async")]
    optimization_task: Option<tokio::task::JoinHandle<()>>,
}

impl VectorIndexer {
    /// Create a new vector indexer
    pub fn new(config: EngineConfig) -> Result<Self> {
        let algorithm = AlgorithmFactory::create_index(config.algorithm, &config)?;

        Ok(Self {
            algorithm,
            config,
            stats: IndexingStats::default(),
            #[cfg(feature = "async")]
            optimization_task: None,
        })
    }

    /// Index a single vector
    pub async fn index_vector(&mut self, id: VectorId, vector: Vector, metadata: VectorMetadata) -> Result<()> {
        // Validate vector dimensions
        if vector.dims() != self.config.dimensions {
            return Err(VectorSearchError::InvalidDimensions {
                expected: self.config.dimensions,
                actual: vector.dims(),
            });
        }

        // Validate vector size
        if vector.as_slice().len() > MAX_VALUE_SIZE / 4 {
            return Err(VectorSearchError::ValueTooLarge {
                size: vector.as_slice().len() * 4,
                max_size: MAX_VALUE_SIZE,
            });
        }

        // Preprocessing
        let processed_vector = self.preprocess_vector(vector)?;

        // Insert into index
        self.algorithm.insert(id, processed_vector, metadata).await?;

        // Update statistics
        self.stats.record_index_operation();

        Ok(())
    }

    /// Index a batch of vectors
    pub async fn index_batch(&mut self, batch: IndexBatch) -> Result<()> {
        let start_time = current_timestamp();

        // Validate batch
        self.validate_batch(&batch)?;

        // Process each vector in the batch
        let ids = batch.ids.unwrap_or_else(|| {
            (0..batch.vectors.len())
                .map(|i| alloc::format!("batch-{}-{}", start_time, i))
                .collect()
        });

        for ((vector, metadata), id) in batch.vectors.into_iter()
            .zip(batch.metadata.into_iter())
            .zip(ids.into_iter()) {

            // Index each vector
            self.index_vector(id, vector, metadata).await?;
        }

        // Update batch statistics
        self.stats.record_batch_operation(batch.len());

        // Trigger optimization if needed
        if self.should_optimize() {
            self.optimize().await?;
        }

        Ok(())
    }

    /// Search for similar vectors
    pub async fn search(&self, query: Vector, config: SearchConfig) -> Result<alloc::vec::Vec<SearchResult>> {
        let start_time = current_timestamp();

        // Validate query vector
        if query.dims() != self.config.dimensions {
            return Err(VectorSearchError::InvalidDimensions {
                expected: self.config.dimensions,
                actual: query.dims(),
            });
        }

        // Preprocess query
        let processed_query = self.preprocess_vector(query)?;

        // Perform search
        let results = self.algorithm.search(&processed_query, &config).await?;

        // Post-process results
        let filtered_results = self.postprocess_results(results, &config);

        // Update statistics
        let search_time = current_timestamp() - start_time;
        self.stats.record_search_operation(search_time, filtered_results.len());

        Ok(filtered_results)
    }

    /// Delete a vector from the index
    pub async fn delete_vector(&mut self, id: &VectorId) -> Result<bool> {
        let deleted = self.algorithm.delete(id).await?;
        if deleted {
            self.stats.record_delete_operation();
        }
        Ok(deleted)
    }

    /// Update a vector in the index
    pub async fn update_vector(&mut self, id: VectorId, vector: Vector, metadata: VectorMetadata) -> Result<()> {
        // Validate dimensions
        if vector.dims() != self.config.dimensions {
            return Err(VectorSearchError::InvalidDimensions {
                expected: self.config.dimensions,
                actual: vector.dims(),
            });
        }

        // Preprocess vector
        let processed_vector = self.preprocess_vector(vector)?;

        // Update in index
        self.algorithm.update(id, processed_vector, metadata).await?;
        self.stats.record_update_operation();

        Ok(())
    }

    /// Flush pending changes
    pub async fn flush(&self) -> Result<()> {
        self.algorithm.flush().await?;
        self.stats.record_flush_operation();
        Ok(())
    }

    /// Optimize the index
    pub async fn optimize(&mut self) -> Result<()> {
        let start_time = current_timestamp();
        self.algorithm.optimize().await?;
        let optimize_time = current_timestamp() - start_time;
        self.stats.record_optimization(optimize_time);
        Ok(())
    }

    /// Get indexing statistics
    pub fn stats(&self) -> &IndexingStats {
        &self.stats
    }

    /// Get index statistics
    pub fn index_stats(&self) -> IndexStats {
        self.algorithm.stats()
    }

    /// Preprocess vector before indexing/searching
    fn preprocess_vector(&self, mut vector: Vector) -> Result<Vector> {
        // Apply normalization based on metric
        match self.config.metric {
            Metric::Cosine => {
                vector.normalize();
            }
            Metric::Euclidean => {
                // No normalization needed
            }
            Metric::DotProduct => {
                // No normalization needed
            }
            Metric::Manhattan => {
                // No normalization needed
            }
            Metric::Hamming => {
                // No normalization needed
            }
        }

        // Apply quantization if enabled
        if self.config.quantization.use_pq {
            // Quantization would be applied here
            // For now, return original vector
        }

        Ok(vector)
    }

    /// Post-process search results
    fn postprocess_results(&self, mut results: alloc::vec::Vec<SearchResult>, config: &SearchConfig) -> alloc::vec::Vec<SearchResult> {
        // Apply filtering if specified
        if let Some(filter) = &config.filter {
            results.retain(|result| {
                if let Some(metadata) = &result.metadata {
                    filter(metadata)
                } else {
                    true
                }
            });
        }

        // Limit results
        if results.len() > config.k {
            results.truncate(config.k);
        }

        // Sort by score (descending for similarity, ascending for distance)
        if self.config.metric.lower_is_better() {
            results.sort_by(|a, b| a.distance.partial_cmp(&b.distance).unwrap());
        } else {
            results.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap());
        }

        results
    }

    /// Validate batch before indexing
    fn validate_batch(&self, batch: &IndexBatch) -> Result<()> {
        if batch.vectors.len() != batch.metadata.len() {
            return Err(VectorSearchError::InvalidWorkflow {
                reason: "batch vectors and metadata length mismatch".into(),
            });
        }

        for vector in &batch.vectors {
            if vector.dims() != self.config.dimensions {
                return Err(VectorSearchError::InvalidDimensions {
                    expected: self.config.dimensions,
                    actual: vector.dims(),
                });
            }
        }

        if let Some(ids) = &batch.ids {
            if ids.len() != batch.vectors.len() {
                return Err(VectorSearchError::InvalidWorkflow {
                    reason: "batch ids and vectors length mismatch".into(),
                });
            }
        }

        Ok(())
    }

    /// Check if optimization should be triggered
    fn should_optimize(&self) -> bool {
        // Simple heuristic: optimize after every 1000 operations
        self.stats.total_operations % 1000 == 0
    }
}

/// Indexing statistics
#[derive(Debug, Clone, Default)]
pub struct IndexingStats {
    /// Total indexing operations
    pub total_operations: u64,
    /// Index operations (inserts)
    pub index_operations: u64,
    /// Update operations
    pub update_operations: u64,
    /// Delete operations
    pub delete_operations: u64,
    /// Batch operations
    pub batch_operations: u64,
    /// Total vectors in batches
    pub batch_vectors: u64,
    /// Search operations
    pub search_operations: u64,
    /// Total search time in microseconds
    pub total_search_time_us: u64,
    /// Flush operations
    pub flush_operations: u64,
    /// Optimization operations
    pub optimization_operations: u64,
    /// Total optimization time
    pub total_optimization_time: u64,
    /// Last operation timestamp
    pub last_operation: u64,
}

impl IndexingStats {
    /// Record an index operation
    pub fn record_index_operation(&mut self) {
        self.index_operations += 1;
        self.total_operations += 1;
        self.last_operation = current_timestamp();
    }

    /// Record a batch operation
    pub fn record_batch_operation(&mut self, vector_count: usize) {
        self.batch_operations += 1;
        self.batch_vectors += vector_count as u64;
        self.total_operations += 1;
        self.last_operation = current_timestamp();
    }

    /// Record an update operation
    pub fn record_update_operation(&mut self) {
        self.update_operations += 1;
        self.total_operations += 1;
        self.last_operation = current_timestamp();
    }

    /// Record a delete operation
    pub fn record_delete_operation(&mut self) {
        self.delete_operations += 1;
        self.total_operations += 1;
        self.last_operation = current_timestamp();
    }

    /// Record a search operation
    pub fn record_search_operation(&mut self, search_time_us: u64, result_count: usize) {
        self.search_operations += 1;
        self.total_search_time_us += search_time_us;
    }

    /// Record a flush operation
    pub fn record_flush_operation(&mut self) {
        self.flush_operations += 1;
        self.last_operation = current_timestamp();
    }

    /// Record an optimization
    pub fn record_optimization(&mut self, optimization_time: u64) {
        self.optimization_operations += 1;
        self.total_optimization_time += optimization_time;
        self.last_operation = current_timestamp();
    }

    /// Get average search time
    pub fn avg_search_time_us(&self) -> f64 {
        if self.search_operations == 0 {
            0.0
        } else {
            self.total_search_time_us as f64 / self.search_operations as f64
        }
    }

    /// Get operations per second
    pub fn operations_per_second(&self) -> f64 {
        let uptime = current_timestamp() - self.last_operation + 1; // Avoid division by zero
        self.total_operations as f64 / uptime as f64
    }
}

/// Index builder for incremental construction
#[derive(Debug)]
pub struct IndexBuilder {
    /// Temporary vector storage
    vectors: alloc::vec::Vec<IndexEntry>,
    /// Configuration
    config: EngineConfig,
    /// Build statistics
    stats: BuildStats,
}

impl IndexBuilder {
    /// Create a new index builder
    pub fn new(config: EngineConfig) -> Self {
        Self {
            vectors: alloc::vec::Vec::new(),
            config,
            stats: BuildStats::default(),
        }
    }

    /// Add a vector to the build
    pub fn add_vector(&mut self, id: VectorId, vector: Vector, metadata: VectorMetadata) -> Result<()> {
        // Validate dimensions
        if vector.dims() != self.config.dimensions {
            return Err(VectorSearchError::InvalidDimensions {
                expected: self.config.dimensions,
                actual: vector.dims(),
            });
        }

        let entry = IndexEntry { id, vector, metadata };
        self.vectors.push(entry);
        self.stats.total_vectors += 1;

        Ok(())
    }

    /// Build the final index
    pub async fn build(mut self) -> Result<VectorIndexer> {
        let start_time = current_timestamp();

        // Create indexer
        let mut indexer = VectorIndexer::new(self.config.clone())?;

        // Sort vectors for better index construction (optional)
        if matches!(self.config.algorithm, Algorithm::HNSW) {
            // For HNSW, random order is often better
            // Keep current order
        }

        // Index all vectors
        for entry in self.vectors.drain(..) {
            indexer.index_vector(entry.id, entry.vector, entry.metadata).await?;
        }

        // Final optimization
        indexer.optimize().await?;

        let build_time = current_timestamp() - start_time;
        self.stats.build_time_ms = build_time;
        self.stats.final_memory_usage = indexer.index_stats().memory_usage;

        Ok(indexer)
    }

    /// Get build statistics
    pub fn stats(&self) -> &BuildStats {
        &self.stats
    }
}

/// Build statistics
#[derive(Debug, Clone, Default)]
pub struct BuildStats {
    /// Total vectors processed
    pub total_vectors: u64,
    /// Build time in milliseconds
    pub build_time_ms: u64,
    /// Peak memory usage during build
    pub peak_memory_usage: u64,
    /// Final index memory usage
    pub final_memory_usage: u64,
    /// Build start timestamp
    pub start_time: u64,
    /// Build end timestamp
    pub end_time: u64,
}

impl BuildStats {
    /// Calculate vectors per second build rate
    pub fn vectors_per_second(&self) -> f64 {
        if self.build_time_ms == 0 {
            0.0
        } else {
            self.total_vectors as f64 / (self.build_time_ms as f64 / 1000.0)
        }
    }

    /// Calculate memory efficiency (bytes per vector)
    pub fn memory_per_vector(&self) -> f64 {
        if self.total_vectors == 0 {
            0.0
        } else {
            self.final_memory_usage as f64 / self.total_vectors as f64
        }
    }
}

/// Index maintenance utilities
#[derive(Debug)]
pub struct IndexMaintenance {
    /// Maintenance configuration
    config: MaintenanceConfig,
}

impl IndexMaintenance {
    /// Create a new index maintenance utility
    pub fn new(config: MaintenanceConfig) -> Self {
        Self { config }
    }

    /// Check if index needs maintenance
    pub fn needs_maintenance(&self, stats: &IndexStats) -> bool {
        // Check various conditions
        let age_days = (current_timestamp() - stats.last_updated) / (24 * 60 * 60);

        age_days > self.config.max_index_age_days ||
        stats.disk_usage > self.config.max_disk_usage_bytes
    }

    /// Perform maintenance operations
    pub async fn perform_maintenance(&self, indexer: &mut VectorIndexer) -> Result<()> {
        // Flush pending changes
        indexer.flush().await?;

        // Optimize index
        indexer.optimize().await?;

        // Clean up old data if configured
        // Implementation would depend on specific requirements

        Ok(())
    }

    /// Get maintenance recommendations
    pub fn get_recommendations(&self, stats: &IndexStats) -> alloc::vec::Vec<MaintenanceRecommendation> {
        let mut recommendations = alloc::vec::Vec::new();

        if stats.memory_usage > self.config.memory_threshold_bytes {
            recommendations.push(MaintenanceRecommendation::OptimizeMemory);
        }

        if stats.disk_usage > self.config.disk_threshold_bytes {
            recommendations.push(MaintenanceRecommendation::CompressData);
        }

        let search_efficiency = stats.avg_dimensions as f64 / stats.total_vectors as f64;
        if search_efficiency < self.config.min_search_efficiency {
            recommendations.push(MaintenanceRecommendation::RebuildIndex);
        }

        recommendations
    }
}

/// Maintenance configuration
#[derive(Debug, Clone)]
pub struct MaintenanceConfig {
    /// Maximum index age in days before maintenance
    pub max_index_age_days: u64,
    /// Maximum disk usage before cleanup
    pub max_disk_usage_bytes: u64,
    /// Memory usage threshold for optimization
    pub memory_threshold_bytes: u64,
    /// Disk usage threshold for compression
    pub disk_threshold_bytes: u64,
    /// Minimum search efficiency
    pub min_search_efficiency: f64,
    /// Maintenance interval in seconds
    pub maintenance_interval_secs: u64,
}

impl Default for MaintenanceConfig {
    fn default() -> Self {
        Self {
            max_index_age_days: 30,
            max_disk_usage_bytes: 100 * 1024 * 1024 * 1024, // 100GB
            memory_threshold_bytes: 8 * 1024 * 1024 * 1024, // 8GB
            disk_threshold_bytes: 50 * 1024 * 1024 * 1024, // 50GB
            min_search_efficiency: 0.1,
            maintenance_interval_secs: 3600, // 1 hour
        }
    }
}

/// Maintenance recommendations
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum MaintenanceRecommendation {
    /// Optimize memory usage
    OptimizeMemory,
    /// Compress stored data
    CompressData,
    /// Rebuild index from scratch
    RebuildIndex,
    /// Update index statistics
    UpdateStatistics,
    /// Clean up temporary files
    CleanupTempFiles,
}

/// Get current timestamp (simplified)
fn current_timestamp() -> u64 {
    // In a real implementation, this would use system time
    0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_indexing_stats() {
        let mut stats = IndexingStats::default();

        stats.record_index_operation();
        stats.record_search_operation(1000, 10);
        stats.record_batch_operation(5);

        assert_eq!(stats.total_operations, 2); // batch operation counts as one
        assert_eq!(stats.index_operations, 1);
        assert_eq!(stats.batch_operations, 1);
        assert_eq!(stats.batch_vectors, 5);
        assert_eq!(stats.search_operations, 1);
    }

    #[test]
    fn test_build_stats() {
        let mut stats = BuildStats::default();
        stats.total_vectors = 1000;
        stats.build_time_ms = 5000; // 5 seconds
        stats.final_memory_usage = 4_000_000; // 4MB

        assert_eq!(stats.vectors_per_second(), 200.0);
        assert_eq!(stats.memory_per_vector(), 4000.0);
    }

    #[test]
    fn test_maintenance_config() {
        let config = MaintenanceConfig::default();
        assert_eq!(config.max_index_age_days, 30);
        assert_eq!(config.maintenance_interval_secs, 3600);
    }

    #[test]
    fn test_index_builder() {
        let config = EngineConfig::default();
        let mut builder = IndexBuilder::new(config);

        let vector = Vector::new(vec![1.0, 2.0, 3.0]);
        let metadata = VectorMetadata::new();

        builder.add_vector("test".into(), vector, metadata).unwrap();
        assert_eq!(builder.stats().total_vectors, 1);
    }

    #[test]
    fn test_maintenance_recommendations() {
        let config = MaintenanceConfig {
            memory_threshold_bytes: 1000,
            ..Default::default()
        };

        let maintenance = IndexMaintenance::new(config);

        let stats = IndexStats {
            memory_usage: 2000, // Above threshold
            disk_usage: 0,
            total_vectors: 10,
            avg_dimensions: 5,
            ..Default::default()
        };

        let recommendations = maintenance.get_recommendations(&stats);
        assert!(recommendations.contains(&MaintenanceRecommendation::OptimizeMemory));
    }
}
