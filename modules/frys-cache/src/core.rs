//! Core cache types and structures

use crate::*;
use core::time::Duration;

/// Cache key type
pub type CacheKey = alloc::vec::Vec<u8>;

/// Cache value type
pub type CacheValue = alloc::vec::Vec<u8>;

/// Cache entry metadata
#[derive(Debug, Clone)]
pub struct CacheEntry {
    /// Entry key
    pub key: CacheKey,
    /// Entry value
    pub value: CacheValue,
    /// Time-to-live in seconds
    pub ttl: Option<u64>,
    /// Creation timestamp
    pub created_at: u64,
    /// Last access timestamp
    pub accessed_at: u64,
    /// Access count
    pub access_count: u64,
    /// Entry size in bytes
    pub size: usize,
    /// Cache level where this entry is stored
    pub level: CacheLevel,
}

/// Cache levels
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum CacheLevel {
    /// Memory cache (fastest)
    Memory = 0,
    /// Persistent cache
    Persistent = 1,
    /// Distributed cache
    Distributed = 2,
}

/// Cache statistics
#[derive(Debug, Clone, Default)]
pub struct CacheStats {
    /// Total number of entries
    pub entries: u64,
    /// Total size in bytes
    pub total_size: u64,
    /// Number of cache hits
    pub hits: u64,
    /// Number of cache misses
    pub misses: u64,
    /// Number of evictions
    pub evictions: u64,
    /// Cache hit ratio (0.0 to 1.0)
    pub hit_ratio: f64,
    /// Average access time in nanoseconds
    pub avg_access_time_ns: u64,
}

impl CacheStats {
    /// Calculate hit ratio
    pub fn update_hit_ratio(&mut self) {
        let total_requests = self.hits + self.misses;
        if total_requests > 0 {
            self.hit_ratio = self.hits as f64 / total_requests as f64;
        }
    }

    /// Record a cache hit
    pub fn record_hit(&mut self) {
        self.hits += 1;
        self.update_hit_ratio();
    }

    /// Record a cache miss
    pub fn record_miss(&mut self) {
        self.misses += 1;
        self.update_hit_ratio();
    }

    /// Record an eviction
    pub fn record_eviction(&mut self) {
        self.evictions += 1;
    }

    /// Add an entry
    pub fn add_entry(&mut self, size: usize) {
        self.entries += 1;
        self.total_size += size as u64;
    }

    /// Remove an entry
    pub fn remove_entry(&mut self, size: usize) {
        if self.entries > 0 {
            self.entries -= 1;
        }
        if self.total_size >= size as u64 {
            self.total_size -= size as u64;
        }
    }
}

/// Cache configuration
#[derive(Debug, Clone)]
pub struct CacheConfig {
    /// Maximum number of entries
    pub max_entries: usize,
    /// Maximum total size in bytes
    pub max_size_bytes: u64,
    /// Default TTL in seconds
    pub default_ttl: Option<u64>,
    /// Cache levels to use
    pub levels: alloc::vec::Vec<CacheLevel>,
    /// Compression enabled
    pub compression: bool,
    /// Compression level (1-22)
    pub compression_level: i32,
    /// Enable metrics collection
    pub enable_metrics: bool,
    /// Eviction policy
    pub eviction_policy: EvictionPolicy,
}

impl Default for CacheConfig {
    fn default() -> Self {
        Self {
            max_entries: DEFAULT_CACHE_SIZE,
            max_size_bytes: 100 * 1024 * 1024, // 100MB
            default_ttl: Some(DEFAULT_TTL_SECS),
            levels: alloc::vec![CacheLevel::Memory],
            compression: false,
            compression_level: DEFAULT_COMPRESSION_LEVEL,
            enable_metrics: true,
            eviction_policy: EvictionPolicy::Lru,
        }
    }
}

/// Eviction policies
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EvictionPolicy {
    /// Least Recently Used
    Lru,
    /// Least Frequently Used
    Lfu,
    /// First In First Out
    Fifo,
    /// Random eviction
    Random,
    /// Size-based eviction (remove largest items)
    SizeBased,
}

/// Cache builder for configuring cache instances
#[derive(Debug)]
pub struct CacheBuilder {
    config: CacheConfig,
    memory_backend: Option<Box<dyn CacheBackend>>,
    persistent_path: Option<alloc::string::String>,
    distributed_endpoints: alloc::vec::Vec<alloc::string::String>,
}

impl CacheBuilder {
    /// Create a new cache builder
    pub fn new() -> Self {
        Self {
            config: CacheConfig::default(),
            memory_backend: None,
            persistent_path: None,
            distributed_endpoints: alloc::vec::Vec::new(),
        }
    }

    /// Set maximum number of entries
    pub fn max_entries(mut self, max: usize) -> Self {
        self.config.max_entries = max;
        self
    }

    /// Set maximum size in bytes
    pub fn max_size_bytes(mut self, max: u64) -> Self {
        self.config.max_size_bytes = max;
        self
    }

    /// Set default TTL
    pub fn default_ttl(mut self, ttl: Duration) -> Self {
        self.config.default_ttl = Some(ttl.as_secs());
        self
    }

    /// Add memory LRU cache
    #[cfg(feature = "lru")]
    pub fn with_memory_lru(mut self, capacity: usize) -> Self {
        self.config.levels.push(CacheLevel::Memory);
        // Memory backend will be created during build
        self
    }

    /// Add persistent storage
    #[cfg(feature = "persistence")]
    pub fn with_persistent<P: Into<alloc::string::String>>(mut self, path: P) -> Self {
        self.config.levels.push(CacheLevel::Persistent);
        self.persistent_path = Some(path.into());
        self
    }

    /// Add distributed cache
    #[cfg(feature = "distributed")]
    pub fn with_distributed<E: Into<alloc::string::String>>(mut self, endpoints: alloc::vec::Vec<E>) -> Self {
        self.config.levels.push(CacheLevel::Distributed);
        self.distributed_endpoints = endpoints.into_iter().map(|e| e.into()).collect();
        self
    }

    /// Enable compression
    pub fn with_compression(mut self, enabled: bool) -> Self {
        self.config.compression = enabled;
        self
    }

    /// Set compression level
    pub fn compression_level(mut self, level: i32) -> Self {
        self.config.compression_level = level;
        self
    }

    /// Set eviction policy
    pub fn eviction_policy(mut self, policy: EvictionPolicy) -> Self {
        self.config.eviction_policy = policy;
        self
    }

    /// Enable/disable metrics
    pub fn metrics(mut self, enabled: bool) -> Self {
        self.config.enable_metrics = enabled;
        self
    }

    /// Build the cache instance
    pub async fn build(self) -> Result<CacheManager> {
        let mut manager = CacheManager::new(self.config);

        // Sort levels by priority (Memory first, then Persistent, then Distributed)
        let mut levels = manager.config.levels.clone();
        levels.sort_by_key(|level| *level as u8);

        // Initialize backends based on levels
        for level in levels {
            match level {
                CacheLevel::Memory => {
                    #[cfg(feature = "lru")]
                    {
                        let memory_cache = MemoryCache::new(manager.config.max_entries)?;
                        manager.backends.push(Box::new(memory_cache));
                    }
                }
                CacheLevel::Persistent => {
                    #[cfg(feature = "persistence")]
                    if let Some(path) = &self.persistent_path {
                        let persistent_cache = PersistentCache::new(path, &manager.config)?;
                        manager.backends.push(Box::new(persistent_cache));
                    }
                }
                CacheLevel::Distributed => {
                    #[cfg(feature = "distributed")]
                    if !self.distributed_endpoints.is_empty() {
                        let distributed_cache = DistributedCache::new(&self.distributed_endpoints)?;
                        manager.backends.push(Box::new(distributed_cache));
                    }
                }
            }
        }

        // Initialize consistency manager
        manager.consistency_manager = Some(ConsistencyManager::new(ConsistencyStrategy::WriteThrough));

        Ok(manager)
    }
}

impl Default for CacheBuilder {
    fn default() -> Self {
        Self::new()
    }
}

/// Main cache manager coordinating all cache levels
#[derive(Debug)]
pub struct CacheManager {
    /// Cache configuration
    config: CacheConfig,
    /// Cache backends (ordered by level priority)
    backends: alloc::vec::Vec<Box<dyn CacheBackend>>,
    /// Consistency manager
    consistency_manager: Option<ConsistencyManager>,
    /// Cache statistics
    stats: CacheStats,
    /// Current timestamp source
    #[cfg(feature = "std")]
    timestamp_fn: fn() -> u64,
}

impl CacheManager {
    /// Create a new cache manager
    pub fn new(config: CacheConfig) -> Self {
        Self {
            config,
            backends: alloc::vec::Vec::new(),
            consistency_manager: None,
            stats: CacheStats::default(),
            #[cfg(feature = "std")]
            timestamp_fn: || std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs(),
        }
    }

    /// Get a value from cache
    pub async fn get(&self, key: &CacheKey) -> Result<Option<CacheValue>> {
        // Try backends in order (Memory -> Persistent -> Distributed)
        for backend in &self.backends {
            match backend.get(key).await {
                Ok(Some(value)) => {
                    if self.config.enable_metrics {
                        // Record hit
                    }
                    return Ok(Some(value));
                }
                Ok(None) => continue,
                Err(e) => {
                    // Log error but continue to next backend
                    // In real implementation, this would be logged
                    let _ = e;
                }
            }
        }

        if self.config.enable_metrics {
            // Record miss
        }

        Ok(None)
    }

    /// Put a value in cache
    pub async fn put(&self, key: CacheKey, value: CacheValue) -> Result<()> {
        // Apply consistency strategy
        if let Some(ref consistency) = self.consistency_manager {
            consistency.before_write(&key, &value).await?;
        }

        // Write to all backends
        for backend in &self.backends {
            backend.put(key.clone(), value.clone()).await?;
        }

        if let Some(ref consistency) = self.consistency_manager {
            consistency.after_write(&key, &value).await?;
        }

        Ok(())
    }

    /// Delete a value from cache
    pub async fn delete(&self, key: &CacheKey) -> Result<bool> {
        let mut deleted = false;

        // Apply consistency strategy
        if let Some(ref consistency) = self.consistency_manager {
            consistency.before_delete(key).await?;
        }

        // Delete from all backends
        for backend in &self.backends {
            if backend.delete(key).await? {
                deleted = true;
            }
        }

        if let Some(ref consistency) = self.consistency_manager {
            consistency.after_delete(key).await?;
        }

        Ok(deleted)
    }

    /// Clear all cache entries
    pub async fn clear(&self) -> Result<()> {
        for backend in &self.backends {
            backend.clear().await?;
        }
        Ok(())
    }

    /// Get cache statistics
    pub fn stats(&self) -> &CacheStats {
        &self.stats
    }

    /// Check if cache contains key
    pub async fn contains(&self, key: &CacheKey) -> Result<bool> {
        for backend in &self.backends {
            if backend.contains(key).await? {
                return Ok(true);
            }
        }
        Ok(false)
    }

    /// Get all keys (expensive operation)
    pub async fn keys(&self) -> Result<alloc::vec::Vec<CacheKey>> {
        let mut all_keys = alloc::collections::BTreeSet::new();

        for backend in &self.backends {
            let keys = backend.keys().await?;
            all_keys.extend(keys);
        }

        Ok(all_keys.into_iter().collect())
    }
}

/// Cache backend trait
#[async_trait::async_trait(?Send)]
pub trait CacheBackend {
    /// Get a value from this backend
    async fn get(&self, key: &CacheKey) -> Result<Option<CacheValue>>;

    /// Put a value in this backend
    async fn put(&self, key: CacheKey, value: CacheValue) -> Result<()>;

    /// Delete a value from this backend
    async fn delete(&self, key: &CacheKey) -> Result<bool>;

    /// Clear all entries in this backend
    async fn clear(&self) -> Result<()>;

    /// Check if backend contains key
    async fn contains(&self, key: &CacheKey) -> Result<bool>;

    /// Get all keys in this backend
    async fn keys(&self) -> Result<alloc::vec::Vec<CacheKey>>;

    /// Get backend statistics
    fn stats(&self) -> Result<CacheStats>;

    /// Get backend name
    fn name(&self) -> &'static str;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cache_config() {
        let config = CacheConfig::default();
        assert_eq!(config.max_entries, DEFAULT_CACHE_SIZE);
        assert!(config.default_ttl.is_some());
        assert!(config.levels.contains(&CacheLevel::Memory));
    }

    #[test]
    fn test_cache_stats() {
        let mut stats = CacheStats::default();
        stats.record_hit();
        stats.record_miss();
        stats.record_hit();

        assert_eq!(stats.hits, 2);
        assert_eq!(stats.misses, 1);
        assert_eq!(stats.hit_ratio, 2.0 / 3.0);
    }

    #[test]
    fn test_cache_builder() {
        let builder = CacheBuilder::new()
            .max_entries(2000)
            .max_size_bytes(200 * 1024 * 1024)
            .metrics(false);

        assert_eq!(builder.config.max_entries, 2000);
        assert_eq!(builder.config.max_size_bytes, 200 * 1024 * 1024);
        assert!(!builder.config.enable_metrics);
    }

    #[test]
    fn test_cache_levels() {
        assert!(CacheLevel::Memory < CacheLevel::Persistent);
        assert!(CacheLevel::Persistent < CacheLevel::Distributed);
    }
}
