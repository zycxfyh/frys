//! Configuration for storage plugin

use alloc::string::String;

/// Storage backend types
#[derive(Debug, Clone)]
pub enum StorageBackendType {
    /// File system storage
    FileSystem,
    /// Database storage
    Database,
    /// Cloud storage
    Cloud,
    /// Distributed storage
    Distributed,
}

/// Main configuration for storage plugin
#[derive(Debug, Clone)]
pub struct StoragePluginConfig {
    /// Storage backend type
    pub backend: StorageBackendType,
    /// Maximum storage size in GB
    pub max_storage_size_gb: u64,
    /// Enable data compression
    pub enable_compression: bool,
    /// Enable data encryption
    pub enable_encryption: bool,
    /// Enable caching
    pub enable_caching: bool,
    /// Cache size in MB
    pub cache_size_mb: usize,
    /// Chunk size for large file operations
    pub chunk_size: usize,
    /// Database URL (for database backend)
    pub database_url: Option<String>,
    /// Cloud storage configuration
    pub cloud_config: Option<CloudConfig>,
    /// Distributed storage nodes
    pub distributed_nodes: Option<Vec<String>>,
}

impl Default for StoragePluginConfig {
    fn default() -> Self {
        Self {
            backend: StorageBackendType::FileSystem,
            max_storage_size_gb: 10,
            enable_compression: true,
            enable_encryption: false,
            enable_caching: true,
            cache_size_mb: 100,
            chunk_size: 64 * 1024,
            database_url: None,
            cloud_config: None,
            distributed_nodes: None,
        }
    }
}

/// Cloud storage configuration
#[derive(Debug, Clone)]
pub struct CloudConfig {
    /// Cloud provider
    pub provider: CloudProvider,
    /// Bucket/container name
    pub bucket: String,
    /// Region
    pub region: String,
    /// Access key
    pub access_key: String,
    /// Secret key
    pub secret_key: String,
    /// Endpoint URL (for custom endpoints)
    pub endpoint: Option<String>,
}

/// Cloud providers
#[derive(Debug, Clone)]
pub enum CloudProvider {
    /// Amazon S3
    AWS,
    /// Google Cloud Storage
    GCS,
    /// Azure Blob Storage
    Azure,
    /// MinIO (S3-compatible)
    MinIO,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = StoragePluginConfig::default();
        assert_eq!(config.max_storage_size_gb, 10);
        assert!(config.enable_compression);
        assert!(config.enable_caching);
    }
}
