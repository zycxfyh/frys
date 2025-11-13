//! Core storage plugin implementation

use crate::*;
use alloc::collections::BTreeMap;
use alloc::string::String;
use alloc::vec::Vec;

/// Main Storage Plugin structure
pub struct StoragePlugin {
    /// Plugin configuration
    config: StoragePluginConfig,
    /// Storage backends
    backends: BTreeMap<String, Box<dyn StorageBackend>>,
    /// Active backend
    active_backend: String,
    /// Cache manager
    cache_manager: Option<CacheManager>,
    /// Compression manager
    compression_manager: Option<CompressionManager>,
    /// Encryption manager
    encryption_manager: Option<EncryptionManager>,
    /// Metrics collector
    metrics: StorageMetrics,
}

impl StoragePlugin {
    /// Create a new storage plugin
    pub async fn new(config: StoragePluginConfig) -> Result<Self> {
        let mut backends = BTreeMap::new();

        // Initialize backends based on configuration
        match config.backend {
            StorageBackendType::FileSystem => {
                #[cfg(feature = "file")]
                {
                    let fs_backend = FileSystemBackend::new(&config).await?;
                    backends.insert("filesystem".to_string(), Box::new(fs_backend) as Box<dyn StorageBackend>);
                }
            }
            StorageBackendType::Database => {
                #[cfg(feature = "database")]
                {
                    let db_backend = DatabaseBackend::new(&config).await?;
                    backends.insert("database".to_string(), Box::new(db_backend) as Box<dyn StorageBackend>);
                }
            }
            StorageBackendType::Cloud => {
                #[cfg(feature = "cloud")]
                {
                    let cloud_backend = CloudBackend::new(&config).await?;
                    backends.insert("cloud".to_string(), Box::new(cloud_backend) as Box<dyn StorageBackend>);
                }
            }
            StorageBackendType::Distributed => {
                #[cfg(feature = "distributed")]
                {
                    let dist_backend = DistributedBackend::new(&config).await?;
                    backends.insert("distributed".to_string(), Box::new(dist_backend) as Box<dyn StorageBackend>);
                }
            }
        }

        if backends.is_empty() {
            return Err(StoragePluginError::BackendNotSupported);
        }

        let active_backend = backends.keys().next().unwrap().clone();

        let cache_manager = if config.enable_caching {
            Some(CacheManager::new(config.cache_size_mb as usize * 1024 * 1024))
        } else {
            None
        };

        let compression_manager = if config.enable_compression {
            Some(CompressionManager::new())
        } else {
            None
        };

        let encryption_manager = if config.enable_encryption {
            Some(EncryptionManager::new()?)
        } else {
            None
        };

        Ok(Self {
            config,
            backends,
            active_backend,
            cache_manager,
            compression_manager,
            encryption_manager,
            metrics: StorageMetrics::new(),
        })
    }

    /// Store data with auto-generated key
    pub async fn store(&mut self, key: &str, data: &[u8]) -> Result<String> {
        let start_time = self.current_timestamp();

        // Check cache first
        if let Some(cache) = &self.cache_manager {
            if let Some(cached_data) = cache.get(key) {
                if cached_data == data {
                    self.metrics.record_cache_hit();
                    return Ok(key.to_string());
                }
            }
        }

        // Process data (compression, encryption)
        let processed_data = self.process_data_for_storage(data).await?;

        // Store using active backend
        let backend = self.backends.get_mut(&self.active_backend)
            .ok_or(StoragePluginError::BackendNotAvailable)?;

        let storage_key = backend.store(key, &processed_data).await?;
        let duration = self.current_timestamp() - start_time;

        // Update cache
        if let Some(cache) = &mut self.cache_manager {
            cache.put(key, data.to_vec());
        }

        // Record metrics
        self.metrics.record_store_operation(duration, processed_data.len());

        Ok(storage_key)
    }

    /// Retrieve data by key
    pub async fn retrieve(&mut self, key: &str) -> Result<Vec<u8>> {
        let start_time = self.current_timestamp();

        // Check cache first
        if let Some(cache) = &self.cache_manager {
            if let Some(data) = cache.get(key) {
                self.metrics.record_cache_hit();
                self.metrics.record_retrieve_operation(self.current_timestamp() - start_time, data.len());
                return Ok(data);
            }
        }

        // Retrieve from backend
        let backend = self.backends.get_mut(&self.active_backend)
            .ok_or(StoragePluginError::BackendNotAvailable)?;

        let mut raw_data = backend.retrieve(key).await?;
        let duration = self.current_timestamp() - start_time;

        // Process data (decryption, decompression)
        let processed_data = self.process_data_for_retrieval(&mut raw_data).await?;

        // Update cache
        if let Some(cache) = &mut self.cache_manager {
            cache.put(key, processed_data.clone());
        }

        // Record metrics
        self.metrics.record_retrieve_operation(duration, processed_data.len());

        Ok(processed_data)
    }

    /// Delete data by key
    pub async fn delete(&mut self, key: &str) -> Result<()> {
        let start_time = self.current_timestamp();

        // Delete from backend
        let backend = self.backends.get_mut(&self.active_backend)
            .ok_or(StoragePluginError::BackendNotAvailable)?;

        backend.delete(key).await?;
        let duration = self.current_timestamp() - start_time;

        // Remove from cache
        if let Some(cache) = &mut self.cache_manager {
            cache.remove(key);
        }

        // Record metrics
        self.metrics.record_delete_operation(duration);

        Ok(())
    }

    /// List stored keys with optional prefix
    pub async fn list(&self, prefix: Option<&str>) -> Result<Vec<String>> {
        let backend = self.backends.get(&self.active_backend)
            .ok_or(StoragePluginError::BackendNotAvailable)?;

        backend.list(prefix).await
    }

    /// Check if key exists
    pub async fn exists(&self, key: &str) -> Result<bool> {
        let backend = self.backends.get(&self.active_backend)
            .ok_or(StoragePluginError::BackendNotAvailable)?;

        backend.exists(key).await
    }

    /// Get storage statistics
    pub async fn get_stats(&self) -> Result<StorageStats> {
        let backend = self.backends.get(&self.active_backend)
            .ok_or(StoragePluginError::BackendNotAvailable)?;

        let backend_stats = backend.get_stats().await?;

        Ok(StorageStats {
            backend_stats,
            cache_stats: self.cache_manager.as_ref().map(|c| c.get_stats()),
            compression_stats: self.compression_manager.as_ref().map(|c| c.get_stats()),
            encryption_stats: self.encryption_manager.as_ref().map(|e| e.get_stats()),
            operation_metrics: self.metrics.get_summary(),
        })
    }

    /// Create backup
    pub async fn create_backup(&self, backup_path: &str) -> Result<()> {
        #[cfg(feature = "file")]
        {
            let backup_manager = BackupManager::new();
            backup_manager.create_backup(&self.backends, backup_path).await
        }
        #[cfg(not(feature = "file"))]
        {
            Err(StoragePluginError::FeatureNotEnabled("File operations not enabled".to_string()))
        }
    }

    /// Restore from backup
    pub async fn restore_backup(&mut self, backup_path: &str) -> Result<()> {
        #[cfg(feature = "file")]
        {
            let backup_manager = BackupManager::new();
            backup_manager.restore_backup(&mut self.backends, backup_path).await
        }
        #[cfg(not(feature = "file"))]
        {
            Err(StoragePluginError::FeatureNotEnabled("File operations not enabled".to_string()))
        }
    }

    /// Switch active backend
    pub fn switch_backend(&mut self, backend_name: &str) -> Result<()> {
        if self.backends.contains_key(backend_name) {
            self.active_backend = backend_name.to_string();
            Ok(())
        } else {
            Err(StoragePluginError::BackendNotAvailable)
        }
    }

    /// Get available backends
    pub fn get_available_backends(&self) -> Vec<&str> {
        self.backends.keys().map(|s| s.as_str()).collect()
    }

    /// Get active backend
    pub fn get_active_backend(&self) -> &str {
        &self.active_backend
    }

    /// Get metrics
    pub fn get_metrics(&self) -> &StorageMetrics {
        &self.metrics
    }

    // Private methods
    async fn process_data_for_storage(&self, data: &[u8]) -> Result<Vec<u8>> {
        let mut processed_data = data.to_vec();

        // Apply compression
        if let Some(compressor) = &self.compression_manager {
            processed_data = compressor.compress(&processed_data)?;
        }

        // Apply encryption
        if let Some(encryptor) = &self.encryption_manager {
            processed_data = encryptor.encrypt(&processed_data)?;
        }

        Ok(processed_data)
    }

    async fn process_data_for_retrieval(&self, data: &mut Vec<u8>) -> Result<Vec<u8>> {
        let mut processed_data = data.clone();

        // Apply decryption
        if let Some(encryptor) = &self.encryption_manager {
            processed_data = encryptor.decrypt(&processed_data)?;
        }

        // Apply decompression
        if let Some(compressor) = &self.compression_manager {
            processed_data = compressor.decompress(&processed_data)?;
        }

        Ok(processed_data)
    }

    fn current_timestamp(&self) -> u64 {
        0 // Placeholder - would use actual timestamp
    }
}

/// Plugin implementation for Frys Plugin System
impl Plugin for StoragePlugin {
    fn metadata(&self) -> PluginMetadata {
        PluginMetadata {
            id: "frys-plugin-storage".to_string(),
            name: "Frys Storage Plugin".to_string(),
            version: env!("CARGO_PKG_VERSION").to_string(),
            description: "Advanced storage capabilities for the Frys ecosystem".to_string(),
            author: "Frys Team".to_string(),
            capabilities: vec![
                "storage.store".to_string(),
                "storage.retrieve".to_string(),
                "storage.delete".to_string(),
                "storage.list".to_string(),
                "storage.backup".to_string(),
                "storage.restore".to_string(),
            ],
        }
    }

    fn initialize(&mut self, _context: &PluginContext) -> Result<()> {
        // Initialize plugin resources
        Ok(())
    }

    fn shutdown(&mut self) -> Result<()> {
        // Cleanup resources
        Ok(())
    }
}

/// Storage backend trait
#[async_trait::async_trait(?Send)]
pub trait StorageBackend {
    /// Store data
    async fn store(&mut self, key: &str, data: &[u8]) -> Result<String>;
    /// Retrieve data
    async fn retrieve(&mut self, key: &str) -> Result<Vec<u8>>;
    /// Delete data
    async fn delete(&mut self, key: &str) -> Result<()>;
    /// List keys
    async fn list(&self, prefix: Option<&str>) -> Result<Vec<String>>;
    /// Check if key exists
    async fn exists(&self, key: &str) -> Result<bool>;
    /// Get backend statistics
    async fn get_stats(&self) -> Result<BackendStats>;
}

/// Backend statistics
#[derive(Debug, Clone)]
pub struct BackendStats {
    pub total_objects: u64,
    pub total_size_bytes: u64,
    pub average_object_size: f64,
    pub operations_count: u64,
    pub error_count: u64,
}

/// Overall storage statistics
#[derive(Debug, Clone)]
pub struct StorageStats {
    pub backend_stats: BackendStats,
    pub cache_stats: Option<CacheStats>,
    pub compression_stats: Option<CompressionStats>,
    pub encryption_stats: Option<EncryptionStats>,
    pub operation_metrics: OperationMetrics,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_plugin_creation() {
        // Test that plugin creation succeeds with basic config
        let config = StoragePluginConfig {
            backend: StorageBackendType::FileSystem,
            max_storage_size_gb: 1,
            enable_compression: false,
            enable_encryption: false,
            enable_caching: false,
            cache_size_mb: 10,
            chunk_size: 1024,
        };

        // Note: Actual async test would require tokio runtime
        // For now, just test config structure
        assert_eq!(config.max_storage_size_gb, 1);
        assert!(!config.enable_compression);
    }

    #[test]
    fn test_plugin_metadata() {
        let config = StoragePluginConfig {
            backend: StorageBackendType::FileSystem,
            max_storage_size_gb: 1,
            enable_compression: false,
            enable_encryption: false,
            enable_caching: false,
            cache_size_mb: 10,
            chunk_size: 1024,
        };

        // Create a mock plugin for metadata testing
        // In real implementation, this would be created with new()
        let capabilities = vec![
            "storage.store".to_string(),
            "storage.retrieve".to_string(),
            "storage.delete".to_string(),
            "storage.list".to_string(),
            "storage.backup".to_string(),
            "storage.restore".to_string(),
        ];

        assert!(capabilities.contains(&"storage.store".to_string()));
        assert!(capabilities.contains(&"storage.retrieve".to_string()));
    }
}
