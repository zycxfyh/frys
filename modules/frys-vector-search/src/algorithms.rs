//! Vector search algorithms implementation

use crate::*;

/// Algorithm selector based on dataset characteristics
#[derive(Debug)]
pub struct AlgorithmSelector {
    /// Dataset size threshold for algorithm selection
    dataset_size_threshold: usize,
    /// Dimensionality threshold
    dimensionality_threshold: usize,
    /// Memory constraints
    memory_limit_gb: usize,
}

impl AlgorithmSelector {
    /// Create a new algorithm selector
    pub fn new() -> Self {
        Self {
            dataset_size_threshold: 100_000,
            dimensionality_threshold: 100,
            memory_limit_gb: 16,
        }
    }

    /// Select the best algorithm for given parameters
    pub fn select_algorithm(
        &self,
        dataset_size: usize,
        dimensions: usize,
        metric: Metric,
        memory_budget_gb: Option<usize>,
    ) -> Algorithm {
        let memory_budget = memory_budget_gb.unwrap_or(self.memory_limit_gb);

        // Estimate memory requirements for different algorithms
        let estimated_memory_hnsw = self.estimate_hnsw_memory(dataset_size, dimensions);
        let estimated_memory_ivf = self.estimate_ivf_memory(dataset_size, dimensions);

        // For small datasets, use exact search
        if dataset_size < 10_000 {
            return Algorithm::Flat;
        }

        // For high-dimensional data, prefer HNSW
        if dimensions > self.dimensionality_threshold {
            if estimated_memory_hnsw <= memory_budget {
                return Algorithm::HNSW;
            }
        }

        // For large datasets, use IVF variants
        if dataset_size > self.dataset_size_threshold {
            if estimated_memory_ivf <= memory_budget {
                return Algorithm::IVFPQ;
            }
            return Algorithm::IVF;
        }

        // For dot product and cosine, HNSW usually performs best
        if matches!(metric, Metric::Cosine | Metric::DotProduct) {
            if estimated_memory_hnsw <= memory_budget {
                return Algorithm::HNSW;
            }
        }

        // Default to HNSW if memory allows, otherwise IVF
        if estimated_memory_hnsw <= memory_budget {
            Algorithm::HNSW
        } else {
            Algorithm::IVF
        }
    }

    /// Estimate HNSW memory usage in GB
    fn estimate_hnsw_memory(&self, dataset_size: usize, dimensions: usize) -> usize {
        // HNSW memory estimation: vectors + graph structure + metadata
        let vector_memory = dataset_size * dimensions * 4; // 4 bytes per float
        let graph_memory = dataset_size * DEFAULT_M * 8; // 8 bytes per connection
        let metadata_memory = dataset_size * 64; // Rough estimate for metadata

        let total_bytes = vector_memory + graph_memory + metadata_memory;
        (total_bytes / (1024 * 1024 * 1024)) as usize + 1 // Convert to GB, add 1 for overhead
    }

    /// Estimate IVF memory usage in GB
    fn estimate_ivf_memory(&self, dataset_size: usize, dimensions: usize) -> usize {
        // IVF memory estimation: vectors + centroids + inverted lists
        let vector_memory = dataset_size * dimensions * 4;
        let centroids_memory = 1024 * dimensions * 4; // Assume 1024 centroids
        let inverted_lists_memory = dataset_size * 8; // Pointers to lists

        let total_bytes = vector_memory + centroids_memory + inverted_lists_memory;
        (total_bytes / (1024 * 1024 * 1024)) as usize + 1
    }
}

/// HNSW (Hierarchical Navigable Small World) algorithm
#[cfg(feature = "hnsw")]
pub mod hnsw {
    use super::*;
    use space::HNSW;

    /// HNSW index implementation
    #[derive(Debug)]
    pub struct HNSWIndex {
        /// Space HNSW index
        index: HNSW<VectorElement>,
        /// Vector store
        vectors: alloc::vec::Vec<Vector>,
        /// Metadata store
        metadata: alloc::vec::Vec<VectorMetadata>,
        /// ID mapping
        id_to_index: alloc::collections::BTreeMap<VectorId, usize>,
        /// Configuration
        config: HNSWConfig,
    }

    /// HNSW configuration
    #[derive(Debug, Clone)]
    pub struct HNSWConfig {
        /// Maximum number of connections per node
        pub max_connections: usize,
        /// Size of the dynamic candidate list
        pub ef_construction: usize,
        /// Normalization factor for level generation
        pub level_norm_factor: VectorElement,
    }

    impl Default for HNSWConfig {
        fn default() -> Self {
            Self {
                max_connections: DEFAULT_M,
                ef_construction: DEFAULT_EF_CONSTRUCTION,
                level_norm_factor: 1.0 / (DEFAULT_M as VectorElement).ln(),
            }
        }
    }

    impl HNSWIndex {
        /// Create a new HNSW index
        pub fn new(config: HNSWConfig) -> Self {
            let index = HNSW::new(config.max_connections, config.ef_construction, config.level_norm_factor);

            Self {
                index,
                vectors: alloc::vec::Vec::new(),
                metadata: alloc::vec::Vec::new(),
                id_to_index: alloc::collections::BTreeMap::new(),
                config,
            }
        }

        /// Insert a vector into the index
        pub fn insert(&mut self, id: VectorId, vector: Vector, metadata: VectorMetadata) -> Result<()> {
            let index = self.vectors.len();

            // Store vector and metadata
            self.vectors.push(vector.clone());
            self.metadata.push(metadata);
            self.id_to_index.insert(id, index);

            // Insert into HNSW index
            self.index.insert(vector.as_slice(), index);

            Ok(())
        }

        /// Search for nearest neighbors
        pub fn search(&self, query: &Vector, k: usize, ef: usize) -> Result<alloc::vec::Vec<SearchResult>> {
            let neighbors = self.index.search(query.as_slice(), k, ef);

            let results = neighbors.into_iter()
                .map(|(index, distance)| {
                    let id = self.id_to_index.iter()
                        .find(|(_, &idx)| idx == index)
                        .map(|(id, _)| id.clone())
                        .unwrap_or_else(|| format!("unknown-{}", index));

                    SearchResult {
                        id,
                        score: 1.0 - distance, // Convert distance to similarity score
                        distance,
                        vector: None,
                        metadata: Some(self.metadata[index].clone()),
                    }
                })
                .collect();

            Ok(results)
        }

        /// Get statistics
        pub fn stats(&self) -> IndexStats {
            IndexStats {
                total_vectors: self.vectors.len() as u64,
                memory_usage: (self.vectors.len() * self.vectors[0].dims() * 4) as u64, // Rough estimate
                build_time_ms: 0, // Would track actual build time
                avg_dimensions: self.vectors.first().map(|v| v.dims()).unwrap_or(0),
                disk_usage: 0, // Would calculate actual disk usage
                last_updated: current_timestamp(),
            }
        }
    }
}

/// IVF (Inverted File) algorithm
#[cfg(feature = "faiss")]
pub mod ivf {
    use super::*;

    /// IVF index implementation
    #[derive(Debug)]
    pub struct IVFIndex {
        /// FAISS IVF index
        index: faiss::IndexIVF,
        /// Vector store
        vectors: alloc::vec::Vec<Vector>,
        /// Metadata store
        metadata: alloc::vec::Vec<VectorMetadata>,
        /// ID mapping
        id_to_index: alloc::collections::BTreeMap<VectorId, usize>,
        /// Number of centroids
        num_centroids: usize,
    }

    impl IVFIndex {
        /// Create a new IVF index
        pub fn new(dimensions: usize, num_centroids: usize, metric: Metric) -> Result<Self> {
            let index = match metric {
                Metric::Euclidean => faiss::IndexIVF::new_flat_euclidean(dimensions, num_centroids),
                Metric::Cosine => faiss::IndexIVF::new_flat_cosine(dimensions, num_centroids),
                _ => return Err(VectorSearchError::MetricNotSupported {
                    metric: alloc::format!("{:?}", metric),
                }),
            };

            Ok(Self {
                index,
                vectors: alloc::vec::Vec::new(),
                metadata: alloc::vec::Vec::new(),
                id_to_index: alloc::collections::BTreeMap::new(),
                num_centroids,
            })
        }

        /// Insert a vector into the index
        pub fn insert(&mut self, id: VectorId, vector: Vector, metadata: VectorMetadata) -> Result<()> {
            let index = self.vectors.len();

            // Store vector and metadata
            self.vectors.push(vector.clone());
            self.metadata.push(metadata);
            self.id_to_index.insert(id, index);

            // Insert into FAISS index
            self.index.add(vector.as_slice())?;

            Ok(())
        }

        /// Search for nearest neighbors
        pub fn search(&self, query: &Vector, k: usize, nprobe: usize) -> Result<alloc::vec::Vec<SearchResult>> {
            // Set search parameters
            self.index.set_nprobe(nprobe);

            // Perform search
            let (distances, indices) = self.index.search(query.as_slice(), k)?;

            let results = indices.iter()
                .zip(distances.iter())
                .map(|(&index, &distance)| {
                    let actual_index = index as usize;
                    let id = self.id_to_index.iter()
                        .find(|(_, &idx)| idx == actual_index)
                        .map(|(id, _)| id.clone())
                        .unwrap_or_else(|| format!("unknown-{}", actual_index));

                    SearchResult {
                        id,
                        score: if distance > 0.0 { 1.0 / (1.0 + distance) } else { 1.0 },
                        distance,
                        vector: None,
                        metadata: Some(self.metadata[actual_index].clone()),
                    }
                })
                .collect();

            Ok(results)
        }

        /// Get statistics
        pub fn stats(&self) -> IndexStats {
            IndexStats {
                total_vectors: self.vectors.len() as u64,
                memory_usage: (self.vectors.len() * self.vectors[0].dims() * 4) as u64,
                build_time_ms: 0,
                avg_dimensions: self.vectors.first().map(|v| v.dims()).unwrap_or(0),
                disk_usage: 0,
                last_updated: current_timestamp(),
            }
        }
    }
}

/// Flat (brute force) search for small datasets or exact search
#[derive(Debug)]
pub struct FlatIndex {
    /// Vector store
    vectors: alloc::vec::Vec<Vector>,
    /// Metadata store
    metadata: alloc::vec::Vec<VectorMetadata>,
    /// ID mapping
    id_to_index: alloc::collections::BTreeMap<VectorId, usize>,
    /// Distance metric
    metric: Metric,
}

impl FlatIndex {
    /// Create a new flat index
    pub fn new(metric: Metric) -> Self {
        Self {
            vectors: alloc::vec::Vec::new(),
            metadata: alloc::vec::Vec::new(),
            id_to_index: alloc::collections::BTreeMap::new(),
            metric,
        }
    }

    /// Insert a vector into the index
    pub fn insert(&mut self, id: VectorId, vector: Vector, metadata: VectorMetadata) -> Result<()> {
        let index = self.vectors.len();

        // Validate dimensions
        if !self.vectors.is_empty() && self.vectors[0].dims() != vector.dims() {
            return Err(VectorSearchError::InvalidDimensions {
                expected: self.vectors[0].dims(),
                actual: vector.dims(),
            });
        }

        self.vectors.push(vector);
        self.metadata.push(metadata);
        self.id_to_index.insert(id, index);

        Ok(())
    }

    /// Search for nearest neighbors
    pub fn search(&self, query: &Vector, k: usize) -> Result<alloc::vec::Vec<SearchResult>> {
        // Calculate distances to all vectors
        let mut distances: alloc::vec::Vec<(usize, VectorElement)> = self.vectors.iter()
            .enumerate()
            .map(|(index, vector)| {
                let distance = self.metric.distance(query, vector).unwrap_or(VectorElement::INFINITY);
                (index, distance)
            })
            .collect();

        // Sort by distance (ascending for distance metrics, descending for similarity)
        if self.metric.lower_is_better() {
            distances.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap());
        } else {
            distances.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());
        }

        // Take top k results
        let results = distances.into_iter()
            .take(k)
            .map(|(index, distance)| {
                let id = self.id_to_index.iter()
                    .find(|(_, &idx)| idx == index)
                    .map(|(id, _)| id.clone())
                    .unwrap_or_else(|| format!("unknown-{}", index));

                let score = if self.metric.lower_is_better() {
                    // Convert distance to similarity score (higher is better)
                    1.0 / (1.0 + distance)
                } else {
                    // Similarity metric, use as-is
                    distance
                };

                SearchResult {
                    id,
                    score,
                    distance,
                    vector: None,
                    metadata: Some(self.metadata[index].clone()),
                }
            })
            .collect();

        Ok(results)
    }

    /// Get statistics
    pub fn stats(&self) -> IndexStats {
        IndexStats {
            total_vectors: self.vectors.len() as u64,
            memory_usage: (self.vectors.len() * self.vectors.first().map(|v| v.dims()).unwrap_or(0) * 4) as u64,
            build_time_ms: 0,
            avg_dimensions: self.vectors.first().map(|v| v.dims()).unwrap_or(0),
            disk_usage: 0,
            last_updated: current_timestamp(),
        }
    }
}

/// Algorithm factory for creating index instances
#[derive(Debug)]
pub struct AlgorithmFactory;

impl AlgorithmFactory {
    /// Create an index using the specified algorithm
    pub fn create_index(algorithm: Algorithm, config: &EngineConfig) -> Result<Box<dyn VectorIndex>> {
        match algorithm {
            Algorithm::Flat => {
                let index = FlatIndex::new(config.metric);
                Ok(Box::new(index))
            }
            Algorithm::HNSW => {
                #[cfg(feature = "hnsw")]
                {
                    let hnsw_config = hnsw::HNSWConfig::default();
                    let index = hnsw::HNSWIndex::new(hnsw_config);
                    Ok(Box::new(index))
                }
                #[cfg(not(feature = "hnsw"))]
                Err(VectorSearchError::AlgorithmNotSupported {
                    algorithm: "HNSW".into(),
                })
            }
            Algorithm::IVF | Algorithm::IVFPQ => {
                #[cfg(feature = "faiss")]
                {
                    let num_centroids = 1024; // Default number of centroids
                    let index = ivf::IVFIndex::new(config.dimensions, num_centroids, config.metric)?;
                    Ok(Box::new(index))
                }
                #[cfg(not(feature = "faiss"))]
                Err(VectorSearchError::AlgorithmNotSupported {
                    algorithm: "IVF".into(),
                })
            }
            _ => Err(VectorSearchError::AlgorithmNotSupported {
                algorithm: alloc::format!("{:?}", algorithm),
            }),
        }
    }
}

/// Vector index trait
#[async_trait::async_trait(?Send)]
pub trait VectorIndex {
    /// Insert a vector into the index
    async fn insert(&mut self, id: VectorId, vector: Vector, metadata: VectorMetadata) -> Result<()>;

    /// Search for nearest neighbors
    async fn search(&self, query: &Vector, config: &SearchConfig) -> Result<alloc::vec::Vec<SearchResult>>;

    /// Delete a vector from the index
    async fn delete(&mut self, id: &VectorId) -> Result<bool>;

    /// Update a vector in the index
    async fn update(&mut self, id: VectorId, vector: Vector, metadata: VectorMetadata) -> Result<()>;

    /// Get index statistics
    fn stats(&self) -> IndexStats;

    /// Flush any pending changes to storage
    async fn flush(&self) -> Result<()>;

    /// Optimize the index
    async fn optimize(&mut self) -> Result<()>;
}

#[async_trait::async_trait(?Send)]
impl VectorIndex for FlatIndex {
    async fn insert(&mut self, id: VectorId, vector: Vector, metadata: VectorMetadata) -> Result<()> {
        FlatIndex::insert(self, id, vector, metadata)
    }

    async fn search(&self, query: &Vector, config: &SearchConfig) -> Result<alloc::vec::Vec<SearchResult>> {
        FlatIndex::search(self, query, config.k)
    }

    async fn delete(&mut self, id: &VectorId) -> Result<bool> {
        // Flat index doesn't support efficient deletion
        Ok(false)
    }

    async fn update(&mut self, id: VectorId, vector: Vector, metadata: VectorMetadata) -> Result<()> {
        // Flat index doesn't support efficient updates
        Err(VectorSearchError::OperationFailed {
            operation: "update",
            details: "flat index does not support updates".into(),
        })
    }

    fn stats(&self) -> IndexStats {
        FlatIndex::stats(self)
    }

    async fn flush(&self) -> Result<()> {
        Ok(())
    }

    async fn optimize(&mut self) -> Result<()> {
        Ok(())
    }
}

#[cfg(feature = "hnsw")]
#[async_trait::async_trait(?Send)]
impl VectorIndex for hnsw::HNSWIndex {
    async fn insert(&mut self, id: VectorId, vector: Vector, metadata: VectorMetadata) -> Result<()> {
        hnsw::HNSWIndex::insert(self, id, vector, metadata)
    }

    async fn search(&self, query: &Vector, config: &SearchConfig) -> Result<alloc::vec::Vec<SearchResult>> {
        hnsw::HNSWIndex::search(self, query, config.k, config.ef)
    }

    async fn delete(&mut self, _id: &VectorId) -> Result<bool> {
        // HNSW doesn't support efficient deletion
        Ok(false)
    }

    async fn update(&mut self, _id: VectorId, _vector: Vector, _metadata: VectorMetadata) -> Result<()> {
        // HNSW doesn't support efficient updates
        Err(VectorSearchError::OperationFailed {
            operation: "update",
            details: "hnsw index does not support updates".into(),
        })
    }

    fn stats(&self) -> IndexStats {
        hnsw::HNSWIndex::stats(self)
    }

    async fn flush(&self) -> Result<()> {
        Ok(())
    }

    async fn optimize(&mut self) -> Result<()> {
        Ok(())
    }
}

#[cfg(feature = "faiss")]
#[async_trait::async_trait(?Send)]
impl VectorIndex for ivf::IVFIndex {
    async fn insert(&mut self, id: VectorId, vector: Vector, metadata: VectorMetadata) -> Result<()> {
        ivf::IVFIndex::insert(self, id, vector, metadata)
    }

    async fn search(&self, query: &Vector, config: &SearchConfig) -> Result<alloc::vec::Vec<SearchResult>> {
        ivf::IVFIndex::search(self, query, config.k, config.nprobe)
    }

    async fn delete(&mut self, _id: &VectorId) -> Result<bool> {
        // IVF supports deletion but implementation is complex
        Ok(false)
    }

    async fn update(&mut self, _id: VectorId, _vector: Vector, _metadata: VectorMetadata) -> Result<()> {
        // IVF supports updates but implementation is complex
        Err(VectorSearchError::OperationFailed {
            operation: "update",
            details: "ivf index updates not implemented".into(),
        })
    }

    fn stats(&self) -> IndexStats {
        ivf::IVFIndex::stats(self)
    }

    async fn flush(&self) -> Result<()> {
        Ok(())
    }

    async fn optimize(&mut self) -> Result<()> {
        Ok(())
    }
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
    fn test_algorithm_selector() {
        let selector = AlgorithmSelector::new();

        // Small dataset should use flat search
        let algorithm = selector.select_algorithm(5000, 768, Metric::Cosine, None);
        assert_eq!(algorithm, Algorithm::Flat);

        // Large dataset with high dimensions should use HNSW
        let algorithm = selector.select_algorithm(500_000, 768, Metric::Cosine, Some(32));
        #[cfg(feature = "hnsw")]
        assert_eq!(algorithm, Algorithm::HNSW);
        #[cfg(not(feature = "hnsw"))]
        assert_eq!(algorithm, Algorithm::IVF);
    }

    #[test]
    fn test_flat_index() {
        let mut index = FlatIndex::new(Metric::Cosine);

        let v1 = Vector::new(vec![1.0, 0.0]);
        let v2 = Vector::new(vec![0.0, 1.0]);
        let v3 = Vector::new(vec![1.0, 1.0]);

        index.insert("vec1".into(), v1, VectorMetadata::new()).unwrap();
        index.insert("vec2".into(), v2, VectorMetadata::new()).unwrap();
        index.insert("vec3".into(), v3, VectorMetadata::new()).unwrap();

        let query = Vector::new(vec![1.0, 0.0]);
        let results = index.search(&query, 2).unwrap();

        assert_eq!(results.len(), 2);
        assert_eq!(results[0].id, "vec1"); // Should be most similar to itself
    }

    #[test]
    fn test_algorithm_factory() {
        let config = EngineConfig::default();

        // Flat index should always be available
        let result = AlgorithmFactory::create_index(Algorithm::Flat, &config);
        assert!(result.is_ok());

        // HNSW may not be available depending on features
        let result = AlgorithmFactory::create_index(Algorithm::HNSW, &config);
        #[cfg(feature = "hnsw")]
        assert!(result.is_ok());
        #[cfg(not(feature = "hnsw"))]
        assert!(result.is_err());
    }

    #[test]
    fn test_metric_properties() {
        assert!(Metric::Euclidean.lower_is_better());
        assert!(Metric::Cosine.lower_is_better());
        assert!(!Metric::DotProduct.lower_is_better());
    }
}
