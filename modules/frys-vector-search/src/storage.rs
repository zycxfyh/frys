//! Vector storage and persistence

use crate::*;

/// Vector storage interface
#[async_trait::async_trait(?Send)]
pub trait VectorStorage {
    /// Store a vector
    async fn store_vector(&mut self, id: &VectorId, vector: &Vector, metadata: &VectorMetadata) -> Result<()>;

    /// Load a vector
    async fn load_vector(&self, id: &VectorId) -> Result<Option<(Vector, VectorMetadata)>>;

    /// Delete a vector
    async fn delete_vector(&mut self, id: &VectorId) -> Result<bool>;

    /// Load all vectors (for bulk operations)
    async fn load_all_vectors(&self) -> Result<alloc::vec::Vec<IndexEntry>>;

    /// Get storage statistics
    fn stats(&self) -> StorageStats;

    /// Flush pending changes
    async fn flush(&self) -> Result<()>;

    /// Compact storage
    async fn compact(&mut self) -> Result<()>;
}

/// In-memory vector storage
#[derive(Debug)]
pub struct MemoryStorage {
    /// Vector storage
    vectors: std::collections::HashMap<VectorId, (Vector, VectorMetadata)>,
    /// Storage statistics
    stats: StorageStats,
}

impl MemoryStorage {
    /// Create new memory storage
    pub fn new() -> Self {
        Self {
            vectors: std::collections::HashMap::new(),
            stats: StorageStats::default(),
        }
    }

    /// Create with capacity
    pub fn with_capacity(capacity: usize) -> Self {
        Self {
            vectors: std::collections::HashMap::with_capacity(capacity),
            stats: StorageStats::default(),
        }
    }
}

#[async_trait::async_trait(?Send)]
impl VectorStorage for MemoryStorage {
    async fn store_vector(&mut self, id: &VectorId, vector: &Vector, metadata: &VectorMetadata) -> Result<()> {
        let size = vector.as_slice().len() * 4 + metadata.fields.len() * 100; // Rough estimate

        self.vectors.insert(id.clone(), (vector.clone(), metadata.clone()));
        self.stats.record_store(size as u64);
        self.stats.update_usage(self.vectors.len() as u64, self.calculate_memory_usage());

        Ok(())
    }

    async fn load_vector(&self, id: &VectorId) -> Result<Option<(Vector, VectorMetadata)>> {
        if let Some((vector, metadata)) = self.vectors.get(id) {
            self.stats.record_load();
            Ok(Some((vector.clone(), metadata.clone())))
        } else {
            Ok(None)
        }
    }

    async fn delete_vector(&mut self, id: &VectorId) -> Result<bool> {
        if let Some(_) = self.vectors.remove(id) {
            self.stats.record_delete();
            self.stats.update_usage(self.vectors.len() as u64, self.calculate_memory_usage());
            Ok(true)
        } else {
            Ok(false)
        }
    }

    async fn load_all_vectors(&self) -> Result<alloc::vec::Vec<IndexEntry>> {
        let entries = self.vectors.iter()
            .map(|(id, (vector, metadata))| IndexEntry {
                id: id.clone(),
                vector: vector.clone(),
                metadata: metadata.clone(),
            })
            .collect();

        Ok(entries)
    }

    fn stats(&self) -> StorageStats {
        self.stats.clone()
    }

    async fn flush(&self) -> Result<()> {
        // Memory storage doesn't need flushing
        Ok(())
    }

    async fn compact(&mut self) -> Result<()> {
        // Memory storage doesn't need compaction
        Ok(())
    }
}

impl MemoryStorage {
    /// Calculate current memory usage
    fn calculate_memory_usage(&self) -> u64 {
        // Rough calculation
        let mut total = 0u64;
        for (_, (vector, metadata)) in &self.vectors {
            total += (vector.as_slice().len() * 4) as u64;
            total += (metadata.fields.len() * 100) as u64; // Rough metadata size
        }
        total
    }
}

/// Persistent vector storage using sled
#[cfg(feature = "persistence")]
#[derive(Debug)]
pub struct PersistentStorage {
    /// Sled database
    db: sled::Db,
    /// Storage statistics
    stats: StorageStats,
}

#[cfg(feature = "persistence")]
impl PersistentStorage {
    /// Create new persistent storage
    pub fn new(path: &str) -> Result<Self> {
        let db = sled::open(path).map_err(|e| VectorSearchError::StorageError {
            operation: "open_database".into(),
            reason: e.to_string(),
        })?;

        Ok(Self {
            db,
            stats: StorageStats::default(),
        })
    }

    /// Serialize vector and metadata
    fn serialize_entry(vector: &Vector, metadata: &VectorMetadata) -> Result<alloc::vec::Vec<u8>> {
        #[cfg(feature = "serde")]
        {
            let entry = StorageEntry {
                vector_data: vector.as_slice().to_vec(),
                metadata: metadata.clone(),
            };

            serde_json::to_vec(&entry).map_err(|e| VectorSearchError::SerializationError {
                reason: e.to_string(),
            })
        }

        #[cfg(not(feature = "serde"))]
        {
            // Simple binary serialization
            let mut data = alloc::vec::Vec::new();

            // Vector dimensions
            data.extend_from_slice(&(vector.dims() as u32).to_le_bytes());

            // Vector data
            for &val in vector.as_slice() {
                data.extend_from_slice(&val.to_le_bytes());
            }

            // Metadata fields count
            data.extend_from_slice(&(metadata.fields.len() as u32).to_le_bytes());

            // Metadata fields
            for (key, value) in &metadata.fields {
                let key_bytes = key.as_bytes();
                let value_bytes = value.as_bytes();

                data.extend_from_slice(&(key_bytes.len() as u32).to_le_bytes());
                data.extend_from_slice(key_bytes);
                data.extend_from_slice(&(value_bytes.len() as u32).to_le_bytes());
                data.extend_from_slice(value_bytes);
            }

            Ok(data)
        }
    }

    /// Deserialize vector and metadata
    fn deserialize_entry(data: &[u8]) -> Result<(Vector, VectorMetadata)> {
        #[cfg(feature = "serde")]
        {
            let entry: StorageEntry = serde_json::from_slice(data).map_err(|e| {
                VectorSearchError::SerializationError {
                    reason: e.to_string(),
                }
            })?;

            let vector = Vector::new(entry.vector_data);
            Ok((vector, entry.metadata))
        }

        #[cfg(not(feature = "serde"))]
        {
            let mut offset = 0;

            // Read dimensions
            let dims = u32::from_le_bytes(data[offset..offset+4].try_into().unwrap()) as usize;
            offset += 4;

            // Read vector data
            let mut vector_data = alloc::vec::Vec::with_capacity(dims);
            for _ in 0..dims {
                let val = f32::from_le_bytes(data[offset..offset+4].try_into().unwrap());
                vector_data.push(val);
                offset += 4;
            }

            let vector = Vector::new(vector_data);

            // Read metadata
            let mut metadata = VectorMetadata::new();
            let fields_count = u32::from_le_bytes(data[offset..offset+4].try_into().unwrap()) as usize;
            offset += 4;

            for _ in 0..fields_count {
                // Read key
                let key_len = u32::from_le_bytes(data[offset..offset+4].try_into().unwrap()) as usize;
                offset += 4;
                let key = core::str::from_utf8(&data[offset..offset+key_len]).unwrap().to_string();
                offset += key_len;

                // Read value
                let value_len = u32::from_le_bytes(data[offset..offset+4].try_into().unwrap()) as usize;
                offset += 4;
                let value = core::str::from_utf8(&data[offset..offset+value_len]).unwrap().to_string();
                offset += value_len;

                metadata.set(&key, &value);
            }

            Ok((vector, metadata))
        }
    }
}

#[cfg(feature = "persistence")]
#[async_trait::async_trait(?Send)]
impl VectorStorage for PersistentStorage {
    async fn store_vector(&mut self, id: &VectorId, vector: &Vector, metadata: &VectorMetadata) -> Result<()> {
        let key = id.as_bytes();
        let value = Self::serialize_entry(vector, metadata)?;

        self.db.insert(key, value).map_err(|e| VectorSearchError::StorageError {
            operation: "store_vector".into(),
            reason: e.to_string(),
        })?;

        let size = value.len() as u64;
        self.stats.record_store(size);
        self.stats.update_usage(self.db.len() as u64, self.calculate_disk_usage());

        Ok(())
    }

    async fn load_vector(&self, id: &VectorId) -> Result<Option<(Vector, VectorMetadata)>> {
        let key = id.as_bytes();

        match self.db.get(key) {
            Ok(Some(data)) => {
                let (vector, metadata) = Self::deserialize_entry(&data)?;
                self.stats.record_load();
                Ok(Some((vector, metadata)))
            }
            Ok(None) => Ok(None),
            Err(e) => Err(VectorSearchError::StorageError {
                operation: "load_vector".into(),
                reason: e.to_string(),
            }),
        }
    }

    async fn delete_vector(&mut self, id: &VectorId) -> Result<bool> {
        let key = id.as_bytes();

        match self.db.remove(key) {
            Ok(Some(_)) => {
                self.stats.record_delete();
                self.stats.update_usage(self.db.len() as u64, self.calculate_disk_usage());
                Ok(true)
            }
            Ok(None) => Ok(false),
            Err(e) => Err(VectorSearchError::StorageError {
                operation: "delete_vector".into(),
                reason: e.to_string(),
            }),
        }
    }

    async fn load_all_vectors(&self) -> Result<alloc::vec::Vec<IndexEntry>> {
        let mut entries = alloc::vec::Vec::new();

        for result in self.db.iter() {
            let (key, value) = result.map_err(|e| VectorSearchError::StorageError {
                operation: "load_all_vectors".into(),
                reason: e.to_string(),
            })?;

            let id = alloc::string::String::from_utf8(key.to_vec()).map_err(|_| {
                VectorSearchError::StorageError {
                    operation: "load_all_vectors".into(),
                    reason: "invalid key encoding".into(),
                }
            })?;

            let (vector, metadata) = Self::deserialize_entry(&value)?;
            entries.push(IndexEntry { id, vector, metadata });
        }

        Ok(entries)
    }

    fn stats(&self) -> StorageStats {
        self.stats.clone()
    }

    async fn flush(&self) -> Result<()> {
        self.db.flush().map_err(|e| VectorSearchError::StorageError {
            operation: "flush".into(),
            reason: e.to_string(),
        })?;

        self.stats.record_flush();
        Ok(())
    }

    async fn compact(&mut self) -> Result<()> {
        // Sled handles compaction automatically
        Ok(())
    }
}

#[cfg(feature = "persistence")]
impl PersistentStorage {
    /// Calculate current disk usage
    fn calculate_disk_usage(&self) -> u64 {
        // Rough estimate based on database size
        self.db.size_on_disk().unwrap_or(0)
    }
}

/// Storage entry for serialization
#[cfg(feature = "serde")]
#[derive(serde::Serialize, serde::Deserialize)]
struct StorageEntry {
    vector_data: alloc::vec::Vec<f32>,
    metadata: VectorMetadata,
}

/// Storage statistics
#[derive(Debug, Clone, Default)]
pub struct StorageStats {
    /// Total store operations
    pub store_operations: u64,
    /// Total load operations
    pub load_operations: u64,
    /// Total delete operations
    pub delete_operations: u64,
    /// Total flush operations
    pub flush_operations: u64,
    /// Total stored items
    pub total_items: u64,
    /// Total storage size in bytes
    pub total_size_bytes: u64,
    /// Last operation timestamp
    pub last_operation: u64,
}

impl StorageStats {
    /// Record store operation
    pub fn record_store(&mut self, size: u64) {
        self.store_operations += 1;
        self.total_items += 1;
        self.total_size_bytes += size;
        self.last_operation = current_timestamp();
    }

    /// Record load operation
    pub fn record_load(&mut self) {
        self.load_operations += 1;
        self.last_operation = current_timestamp();
    }

    /// Record delete operation
    pub fn record_delete(&mut self) {
        self.delete_operations += 1;
        self.total_items -= 1;
        self.last_operation = current_timestamp();
    }

    /// Record flush operation
    pub fn record_flush(&mut self) {
        self.flush_operations += 1;
        self.last_operation = current_timestamp();
    }

    /// Update usage statistics
    pub fn update_usage(&mut self, items: u64, size: u64) {
        self.total_items = items;
        self.total_size_bytes = size;
    }

    /// Get average item size
    pub fn avg_item_size(&self) -> f64 {
        if self.total_items == 0 {
            0.0
        } else {
            self.total_size_bytes as f64 / self.total_items as f64
        }
    }

    /// Get operations per second
    pub fn operations_per_second(&self) -> f64 {
        let total_ops = self.store_operations + self.load_operations + self.delete_operations;
        let uptime = current_timestamp() - self.last_operation + 1;
        total_ops as f64 / uptime as f64
    }
}

/// Storage factory
#[derive(Debug)]
pub struct StorageFactory;

impl StorageFactory {
    /// Create storage based on configuration
    pub fn create_storage(config: &EngineConfig) -> Result<Box<dyn VectorStorage>> {
        if config.persistence_enabled {
            #[cfg(feature = "persistence")]
            {
                let path = config.persistence_path.as_ref()
                    .ok_or_else(|| VectorSearchError::ConfigError {
                        parameter: "persistence_path".into(),
                        reason: "persistence enabled but no path specified".into(),
                    })?;

                let storage = PersistentStorage::new(path)?;
                Ok(Box::new(storage))
            }

            #[cfg(not(feature = "persistence"))]
            Err(VectorSearchError::ConfigError {
                parameter: "persistence".into(),
                reason: "persistence feature not enabled".into(),
            })
        } else {
            let storage = MemoryStorage::new();
            Ok(Box::new(storage))
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
    fn test_memory_storage() {
        let mut storage = MemoryStorage::new();

        let vector = Vector::new(vec![1.0, 2.0, 3.0]);
        let metadata = VectorMetadata::new();
        let id = "test-vector".into();

        // Store
        tokio::runtime::Runtime::new().unwrap()
            .block_on(storage.store_vector(&id, &vector, &metadata))
            .unwrap();

        // Load
        let (loaded_vector, loaded_metadata) = tokio::runtime::Runtime::new().unwrap()
            .block_on(storage.load_vector(&id))
            .unwrap()
            .unwrap();

        assert_eq!(loaded_vector.as_slice(), vector.as_slice());

        // Delete
        let deleted = tokio::runtime::Runtime::new().unwrap()
            .block_on(storage.delete_vector(&id))
            .unwrap();

        assert!(deleted);

        // Verify deleted
        let result = tokio::runtime::Runtime::new().unwrap()
            .block_on(storage.load_vector(&id))
            .unwrap();

        assert!(result.is_none());
    }

    #[cfg(feature = "persistence")]
    #[test]
    fn test_persistent_storage() {
        let temp_dir = tempfile::tempdir().unwrap();
        let path = temp_dir.path().to_str().unwrap();

        let mut storage = PersistentStorage::new(path).unwrap();

        let vector = Vector::new(vec![1.0, 2.0, 3.0]);
        let mut metadata = VectorMetadata::new();
        metadata.set("test", "value");
        let id = "test-vector".into();

        // Store
        tokio::runtime::Runtime::new().unwrap()
            .block_on(storage.store_vector(&id, &vector, &metadata))
            .unwrap();

        // Load
        let (loaded_vector, loaded_metadata) = tokio::runtime::Runtime::new().unwrap()
            .block_on(storage.load_vector(&id))
            .unwrap()
            .unwrap();

        assert_eq!(loaded_vector.as_slice(), vector.as_slice());
        assert_eq!(loaded_metadata.get("test"), Some(&"value".into()));
    }

    #[test]
    fn test_storage_stats() {
        let mut stats = StorageStats::default();

        stats.record_store(100);
        stats.record_load();
        stats.record_delete();

        assert_eq!(stats.store_operations, 1);
        assert_eq!(stats.load_operations, 1);
        assert_eq!(stats.delete_operations, 1);
        assert_eq!(stats.total_items, 1); // One store, one delete = 0, but record_store increments
        assert_eq!(stats.total_size_bytes, 100);
        assert_eq!(stats.avg_item_size(), 100.0);
    }
}
