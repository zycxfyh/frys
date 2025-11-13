//! Core vector search types and structures

use crate::*;
use core::time::Duration;

/// Vector ID type
pub type VectorId = alloc::string::String;

/// Vector data type (32-bit float for precision and performance)
pub type VectorElement = f32;

/// Vector representation
#[derive(Debug, Clone, PartialEq)]
pub struct Vector {
    /// Vector data
    pub data: alloc::vec::Vec<VectorElement>,
    /// Vector dimensionality
    pub dims: usize,
}

impl Vector {
    /// Create a new vector
    pub fn new(data: alloc::vec::Vec<VectorElement>) -> Self {
        let dims = data.len();
        Self { data, dims }
    }

    /// Create a zero vector
    pub fn zeros(dims: usize) -> Self {
        Self {
            data: alloc::vec::Vec::new(),
            dims,
        }
    }

    /// Get vector dimension
    pub fn dims(&self) -> usize {
        self.dims
    }

    /// Get vector data slice
    pub fn as_slice(&self) -> &[VectorElement] {
        &self.data
    }

    /// Normalize vector (L2 normalization)
    pub fn normalize(&mut self) {
        let norm = self.l2_norm();
        if norm > 0.0 {
            for x in &mut self.data {
                *x /= norm;
            }
        }
    }

    /// Calculate L2 norm
    pub fn l2_norm(&self) -> VectorElement {
        self.data.iter().map(|x| x * x).sum::<VectorElement>().sqrt()
    }

    /// Calculate dot product with another vector
    pub fn dot(&self, other: &Vector) -> Result<VectorElement> {
        if self.dims != other.dims {
            return Err(VectorSearchError::InvalidDimensions {
                expected: self.dims,
                actual: other.dims,
            });
        }

        let dot_product = self.data.iter()
            .zip(other.data.iter())
            .map(|(a, b)| a * b)
            .sum();

        Ok(dot_product)
    }

    /// Calculate cosine similarity
    pub fn cosine_similarity(&self, other: &Vector) -> Result<VectorElement> {
        let dot_product = self.dot(other)?;
        let norm_product = self.l2_norm() * other.l2_norm();

        if norm_product == 0.0 {
            Ok(0.0)
        } else {
            Ok(dot_product / norm_product)
        }
    }

    /// Calculate Euclidean distance
    pub fn euclidean_distance(&self, other: &Vector) -> Result<VectorElement> {
        if self.dims != other.dims {
            return Err(VectorSearchError::InvalidDimensions {
                expected: self.dims,
                actual: other.dims,
            });
        }

        let distance_squared = self.data.iter()
            .zip(other.data.iter())
            .map(|(a, b)| (a - b).powi(2))
            .sum::<VectorElement>();

        Ok(distance_squared.sqrt())
    }
}

/// Distance metrics for vector similarity
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Metric {
    /// Cosine similarity (-1 to 1, higher is more similar)
    Cosine,
    /// Euclidean distance (0 to ∞, lower is more similar)
    Euclidean,
    /// Dot product (-∞ to ∞, higher is more similar)
    DotProduct,
    /// Manhattan distance (0 to ∞, lower is more similar)
    Manhattan,
    /// Hamming distance (0 to ∞, lower is more similar)
    Hamming,
}

impl Metric {
    /// Calculate distance between two vectors
    pub fn distance(&self, a: &Vector, b: &Vector) -> Result<VectorElement> {
        match self {
            Metric::Cosine => {
                let similarity = a.cosine_similarity(b)?;
                // Convert similarity to distance (1 - similarity)
                Ok(1.0 - similarity)
            }
            Metric::Euclidean => a.euclidean_distance(b),
            Metric::DotProduct => {
                let dot = a.dot(b)?;
                // Convert to distance (negative dot product)
                Ok(-dot)
            }
            Metric::Manhattan => {
                if a.dims != b.dims {
                    return Err(VectorSearchError::InvalidDimensions {
                        expected: a.dims,
                        actual: b.dims,
                    });
                }

                let distance = a.data.iter()
                    .zip(b.data.iter())
                    .map(|(x, y)| (x - y).abs())
                    .sum();

                Ok(distance)
            }
            Metric::Hamming => {
                if a.dims != b.dims {
                    return Err(VectorSearchError::InvalidDimensions {
                        expected: a.dims,
                        actual: b.dims,
                    });
                }

                // For floating point, use a threshold for "equality"
                let threshold = 1e-6;
                let distance = a.data.iter()
                    .zip(b.data.iter())
                    .filter(|(x, y)| (x - y).abs() > threshold)
                    .count() as VectorElement;

                Ok(distance)
            }
        }
    }

    /// Check if lower values indicate higher similarity
    pub fn lower_is_better(&self) -> bool {
        matches!(self, Metric::Euclidean | Metric::Manhattan | Metric::Hamming)
    }
}

/// Vector indexing algorithms
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Algorithm {
    /// Hierarchical Navigable Small World
    HNSW,
    /// Inverted File with Product Quantization
    IVF,
    /// Inverted File with PQ
    IVFPQ,
    /// Locality Sensitive Hashing
    LSH,
    /// Random Projection
    RandomProjection,
    /// Product Quantization
    PQ,
    /// Flat (brute force) search
    Flat,
}

/// Search algorithms
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SearchAlgorithm {
    /// Exact search (brute force)
    Exact,
    /// Approximate search with guarantees
    Approximate,
    /// Hybrid search (exact + approximate)
    Hybrid,
}

/// Search configuration
#[derive(Debug, Clone)]
pub struct SearchConfig {
    /// Number of nearest neighbors to return
    pub k: usize,
    /// Search parameter for HNSW (ef)
    pub ef: usize,
    /// Search parameter for IVF (nprobe)
    pub nprobe: usize,
    /// Maximum search time
    pub max_search_time: Option<Duration>,
    /// Include vector data in results
    pub include_vectors: bool,
    /// Include metadata in results
    pub include_metadata: bool,
    /// Optional filter function
    pub filter: Option<alloc::boxed::Box<dyn Fn(&VectorMetadata) -> bool + Send + Sync>>,
    /// Search radius for range search
    pub radius: Option<VectorElement>,
}

impl Default for SearchConfig {
    fn default() -> Self {
        Self {
            k: 10,
            ef: DEFAULT_EF,
            nprobe: 10,
            max_search_time: None,
            include_vectors: false,
            include_metadata: true,
            filter: None,
            radius: None,
        }
    }
}

/// Search result
#[derive(Debug, Clone)]
pub struct SearchResult {
    /// Vector ID
    pub id: VectorId,
    /// Similarity score (higher is better for cosine/dot, lower is better for distance)
    pub score: VectorElement,
    /// Distance value
    pub distance: VectorElement,
    /// Vector data (if requested)
    pub vector: Option<Vector>,
    /// Metadata (if requested)
    pub metadata: Option<VectorMetadata>,
}

/// Vector metadata
#[derive(Debug, Clone, Default)]
pub struct VectorMetadata {
    /// Custom metadata fields
    pub fields: alloc::collections::BTreeMap<alloc::string::String, alloc::string::String>,
    /// Timestamp when vector was added
    pub created_at: u64,
    /// Timestamp of last access
    pub accessed_at: u64,
    /// Access count
    pub access_count: u64,
    /// Vector version
    pub version: u32,
}

impl VectorMetadata {
    /// Create new metadata
    pub fn new() -> Self {
        Self::default()
    }

    /// Set a metadata field
    pub fn set(&mut self, key: &str, value: &str) {
        self.fields.insert(key.into(), value.into());
    }

    /// Get a metadata field
    pub fn get(&self, key: &str) -> Option<&alloc::string::String> {
        self.fields.get(key)
    }

    /// Check if metadata has a field
    pub fn has(&self, key: &str) -> bool {
        self.fields.contains_key(key)
    }

    /// Update access information
    pub fn record_access(&mut self) {
        self.accessed_at = current_timestamp();
        self.access_count += 1;
    }
}

/// Vector index entry
#[derive(Debug, Clone)]
pub struct IndexEntry {
    /// Vector ID
    pub id: VectorId,
    /// Vector data
    pub vector: Vector,
    /// Vector metadata
    pub metadata: VectorMetadata,
}

/// Batch index operation
#[derive(Debug)]
pub struct IndexBatch {
    /// Vectors to index
    pub vectors: alloc::vec::Vec<Vector>,
    /// Vector IDs (optional, will be generated if not provided)
    pub ids: Option<alloc::vec::Vec<VectorId>>,
    /// Metadata for each vector
    pub metadata: alloc::vec::Vec<VectorMetadata>,
}

impl IndexBatch {
    /// Create a new batch
    pub fn new() -> Self {
        Self {
            vectors: alloc::vec::Vec::new(),
            ids: None,
            metadata: alloc::vec::Vec::new(),
        }
    }

    /// Add a vector to the batch
    pub fn add_vector(&mut self, vector: Vector, metadata: VectorMetadata) {
        self.vectors.push(vector);
        self.metadata.push(metadata);
    }

    /// Set custom IDs for the batch
    pub fn with_ids(mut self, ids: alloc::vec::Vec<VectorId>) -> Self {
        self.ids = Some(ids);
        self
    }

    /// Get batch size
    pub fn len(&self) -> usize {
        self.vectors.len()
    }

    /// Check if batch is empty
    pub fn is_empty(&self) -> bool {
        self.vectors.is_empty()
    }
}

/// Index statistics
#[derive(Debug, Clone, Default)]
pub struct IndexStats {
    /// Total number of vectors indexed
    pub total_vectors: u64,
    /// Index memory usage in bytes
    pub memory_usage: u64,
    /// Index build time in milliseconds
    pub build_time_ms: u64,
    /// Average vector dimensionality
    pub avg_dimensions: usize,
    /// Index size on disk in bytes
    pub disk_usage: u64,
    /// Last update timestamp
    pub last_updated: u64,
}

/// Search statistics
#[derive(Debug, Clone, Default)]
pub struct SearchStats {
    /// Total search operations
    pub total_searches: u64,
    /// Average search time in microseconds
    pub avg_search_time_us: u64,
    /// Average results returned per search
    pub avg_results_per_search: f64,
    /// Cache hit ratio
    pub cache_hit_ratio: f64,
    /// Last search timestamp
    pub last_search: u64,
}

/// Vector quantization configuration
#[derive(Debug, Clone)]
pub struct QuantizationConfig {
    /// Number of sub-quantizers
    pub num_subquantizers: usize,
    /// Number of bits per sub-quantizer
    pub bits_per_code: usize,
    /// Whether to use product quantization
    pub use_pq: bool,
}

impl Default for QuantizationConfig {
    fn default() -> Self {
        Self {
            num_subquantizers: 8,
            bits_per_code: 8,
            use_pq: false,
        }
    }
}

/// Vector search engine configuration
#[derive(Debug, Clone)]
pub struct EngineConfig {
    /// Vector dimensionality
    pub dimensions: usize,
    /// Maximum number of elements
    pub max_elements: usize,
    /// Distance metric
    pub metric: Metric,
    /// Index algorithm
    pub algorithm: Algorithm,
    /// Quantization configuration
    pub quantization: QuantizationConfig,
    /// Enable persistence
    pub persistence_enabled: bool,
    /// Persistence path
    pub persistence_path: Option<alloc::string::String>,
    /// Enable monitoring
    pub monitoring_enabled: bool,
    /// Enable GPU acceleration
    pub gpu_enabled: bool,
}

impl Default for EngineConfig {
    fn default() -> Self {
        Self {
            dimensions: DEFAULT_VECTOR_DIMENSIONS,
            max_elements: DEFAULT_MAX_ELEMENTS,
            metric: Metric::Cosine,
            algorithm: Algorithm::HNSW,
            quantization: QuantizationConfig::default(),
            persistence_enabled: false,
            persistence_path: None,
            monitoring_enabled: true,
            gpu_enabled: false,
        }
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
    fn test_vector_creation() {
        let data = vec![1.0, 2.0, 3.0];
        let vector = Vector::new(data.clone());
        assert_eq!(vector.dims(), 3);
        assert_eq!(vector.as_slice(), &data[..]);
    }

    #[test]
    fn test_vector_operations() {
        let v1 = Vector::new(vec![1.0, 2.0, 3.0]);
        let v2 = Vector::new(vec![4.0, 5.0, 6.0]);

        let dot = v1.dot(&v2).unwrap();
        assert_eq!(dot, 32.0); // 1*4 + 2*5 + 3*6 = 32

        let distance = v1.euclidean_distance(&v2).unwrap();
        assert!((distance - 5.196152).abs() < 1e-6); // sqrt((4-1)^2 + (5-2)^2 + (6-3)^2)
    }

    #[test]
    fn test_metrics() {
        let v1 = Vector::new(vec![1.0, 0.0]);
        let v2 = Vector::new(vec![0.0, 1.0]);

        // Cosine distance between orthogonal vectors
        let cos_dist = Metric::Cosine.distance(&v1, &v2).unwrap();
        assert!((cos_dist - 1.0).abs() < 1e-6); // cos(90°) = 0, distance = 1-0 = 1

        // Euclidean distance
        let euc_dist = Metric::Euclidean.distance(&v1, &v2).unwrap();
        assert!((euc_dist - 1.414214).abs() < 1e-6); // sqrt(1^2 + 1^2)

        // Manhattan distance
        let man_dist = Metric::Manhattan.distance(&v1, &v2).unwrap();
        assert_eq!(man_dist, 2.0); // |1-0| + |0-1| = 2
    }

    #[test]
    fn test_search_config() {
        let config = SearchConfig::default();
        assert_eq!(config.k, 10);
        assert_eq!(config.ef, DEFAULT_EF);
        assert!(config.include_metadata);
    }

    #[test]
    fn test_vector_metadata() {
        let mut metadata = VectorMetadata::new();
        metadata.set("category", "test");
        metadata.set("version", "1.0");

        assert_eq!(metadata.get("category"), Some(&"test".into()));
        assert!(metadata.has("version"));
        assert!(!metadata.has("nonexistent"));
    }

    #[test]
    fn test_engine_config() {
        let config = EngineConfig::default();
        assert_eq!(config.dimensions, DEFAULT_VECTOR_DIMENSIONS);
        assert_eq!(config.algorithm, Algorithm::HNSW);
        assert_eq!(config.metric, Metric::Cosine);
    }

    #[test]
    fn test_index_batch() {
        let mut batch = IndexBatch::new();

        let vector = Vector::new(vec![1.0, 2.0, 3.0]);
        let metadata = VectorMetadata::new();

        batch.add_vector(vector, metadata);

        assert_eq!(batch.len(), 1);
        assert!(!batch.is_empty());
    }
}
