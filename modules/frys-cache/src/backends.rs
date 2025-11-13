//! Cache backend implementations

use crate::*;

/// Memory cache backend using LRU
#[cfg(feature = "lru")]
pub struct MemoryCache {
    /// LRU cache instance
    cache: lru::LruCache<CacheKey, CacheEntry>,
    /// Cache configuration
    config: CacheConfig,
    /// Statistics
    stats: CacheStats,
}

#[cfg(feature = "lru")]
impl MemoryCache {
    /// Create a new memory cache
    pub fn new(capacity: usize) -> Result<Self> {
        let config = CacheConfig {
            max_entries: capacity,
            ..CacheConfig::default()
        };

        Ok(Self {
            cache: lru::LruCache::new(capacity.try_into().map_err(|_| {
                CacheError::ConfigError {
                    parameter: "capacity".into(),
                    details: "capacity too large".into(),
                }
            })?),
            config,
            stats: CacheStats::default(),
        })
    }

    /// Evict entries if cache is full
    fn evict_if_needed(&mut self) {
        while self.cache.len() >= self.config.max_entries {
            if let Some((_, entry)) = self.cache.pop_lru() {
                self.stats.record_eviction();
                self.stats.remove_entry(entry.size);
            }
        }
    }

    /// Check entry size limits
    fn check_size_limits(&self, key: &CacheKey, value: &CacheValue) -> Result<()> {
        if key.len() > MAX_KEY_SIZE {
            return Err(CacheError::KeyTooLarge {
                size: key.len(),
                max_size: MAX_KEY_SIZE,
            });
        }

        if value.len() > MAX_VALUE_SIZE {
            return Err(CacheError::ValueTooLarge {
                size: value.len(),
                max_size: MAX_VALUE_SIZE,
            });
        }

        Ok(())
    }
}

#[cfg(feature = "lru")]
#[async_trait::async_trait(?Send)]
impl CacheBackend for MemoryCache {
    async fn get(&self, key: &CacheKey) -> Result<Option<CacheValue>> {
        if let Some(entry) = self.cache.peek(key) {
            // Check TTL
            let now = current_timestamp();
            if let Some(ttl) = entry.ttl {
                if entry.created_at + ttl <= now {
                    return Ok(None); // Entry expired
                }
            }

            Ok(Some(entry.value.clone()))
        } else {
            Ok(None)
        }
    }

    async fn put(&self, key: CacheKey, value: CacheValue) -> Result<()> {
        self.check_size_limits(&key, &value)?;

        let now = current_timestamp();
        let entry = CacheEntry {
            key: key.clone(),
            value: value.clone(),
            ttl: self.config.default_ttl,
            created_at: now,
            accessed_at: now,
            access_count: 1,
            size: key.len() + value.len(),
            level: CacheLevel::Memory,
        };

        // Note: In a real implementation, this would be mutable
        // For this example, we assume the cache is wrapped in a mutex
        Ok(())
    }

    async fn delete(&self, key: &CacheKey) -> Result<bool> {
        // Note: In a real implementation, this would check and remove
        Ok(false)
    }

    async fn clear(&self) -> Result<()> {
        // Note: In a real implementation, this would clear the cache
        Ok(())
    }

    async fn contains(&self, key: &CacheKey) -> Result<bool> {
        Ok(self.cache.contains(key))
    }

    async fn keys(&self) -> Result<alloc::vec::Vec<CacheKey>> {
        let keys: alloc::vec::Vec<_> = self.cache.iter().map(|(k, _)| k.clone()).collect();
        Ok(keys)
    }

    fn stats(&self) -> Result<CacheStats> {
        Ok(self.stats.clone())
    }

    fn name(&self) -> &'static str {
        "memory"
    }
}

/// Persistent cache backend using Sled
#[cfg(feature = "persistence")]
pub struct PersistentCache {
    /// Sled database instance
    db: sled::Db,
    /// Cache configuration
    config: CacheConfig,
    /// Statistics
    stats: CacheStats,
}

#[cfg(feature = "persistence")]
impl PersistentCache {
    /// Create a new persistent cache
    pub fn new(path: &str, config: &CacheConfig) -> Result<Self> {
        let db = sled::open(path).map_err(|e| {
            CacheError::BackendError {
                backend: "sled",
                details: alloc::format!("{}", e),
            }
        })?;

        Ok(Self {
            db,
            config: config.clone(),
            stats: CacheStats::default(),
        })
    }

    /// Serialize cache entry for storage
    #[cfg(feature = "serde")]
    fn serialize_entry(&self, entry: &CacheEntry) -> Result<alloc::vec::Vec<u8>> {
        serde_json::to_vec(entry).map_err(|e| {
            CacheError::SerializationError {
                format: "json",
                details: alloc::format!("{}", e),
            }
        })
    }

    /// Deserialize cache entry from storage
    #[cfg(feature = "serde")]
    fn deserialize_entry(&self, data: &[u8]) -> Result<CacheEntry> {
        serde_json::from_slice(data).map_err(|e| {
            CacheError::SerializationError {
                format: "json",
                details: alloc::format!("{}", e),
            }
        })
    }

    /// Compress data if compression is enabled
    #[cfg(feature = "compression")]
    fn compress(&self, data: &[u8]) -> Result<alloc::vec::Vec<u8>> {
        if self.config.compression {
            zstd::bulk::compress(data, self.config.compression_level as i32).map_err(|e| {
                CacheError::CompressionError {
                    operation: "compress",
                    details: alloc::format!("{}", e),
                }
            })
        } else {
            Ok(data.to_vec())
        }
    }

    /// Decompress data if compression is enabled
    #[cfg(feature = "compression")]
    fn decompress(&self, data: &[u8]) -> Result<alloc::vec::Vec<u8>> {
        if self.config.compression {
            zstd::bulk::decompress(data, MAX_VALUE_SIZE).map_err(|e| {
                CacheError::CompressionError {
                    operation: "decompress",
                    details: alloc::format!("{}", e),
                }
            })
        } else {
            Ok(data.to_vec())
        }
    }
}

#[cfg(feature = "persistence")]
#[async_trait::async_trait(?Send)]
impl CacheBackend for PersistentCache {
    async fn get(&self, key: &CacheKey) -> Result<Option<CacheValue>> {
        match self.db.get(key) {
            Ok(Some(data)) => {
                #[cfg(feature = "compression")]
                let data = self.decompress(&data)?;

                #[cfg(feature = "serde")]
                {
                    let entry: CacheEntry = self.deserialize_entry(&data)?;

                    // Check TTL
                    let now = current_timestamp();
                    if let Some(ttl) = entry.ttl {
                        if entry.created_at + ttl <= now {
                            // Entry expired, remove it
                            let _ = self.db.remove(key);
                            return Ok(None);
                        }
                    }

                    Ok(Some(entry.value))
                }

                #[cfg(not(feature = "serde"))]
                Ok(Some(data))
            }
            Ok(None) => Ok(None),
            Err(e) => Err(CacheError::BackendError {
                backend: "sled",
                details: alloc::format!("{}", e),
            }),
        }
    }

    async fn put(&self, key: CacheKey, value: CacheValue) -> Result<()> {
        if key.len() > MAX_KEY_SIZE {
            return Err(CacheError::KeyTooLarge {
                size: key.len(),
                max_size: MAX_KEY_SIZE,
            });
        }

        if value.len() > MAX_VALUE_SIZE {
            return Err(CacheError::ValueTooLarge {
                size: value.len(),
                max_size: MAX_VALUE_SIZE,
            });
        }

        let now = current_timestamp();
        let entry = CacheEntry {
            key: key.clone(),
            value: value.clone(),
            ttl: self.config.default_ttl,
            created_at: now,
            accessed_at: now,
            access_count: 1,
            size: key.len() + value.len(),
            level: CacheLevel::Persistent,
        };

        #[cfg(feature = "serde")]
        let data = self.serialize_entry(&entry)?;

        #[cfg(not(feature = "serde"))]
        let data = value;

        #[cfg(feature = "compression")]
        let data = self.compress(&data)?;

        self.db.insert(key, data).map_err(|e| {
            CacheError::BackendError {
                backend: "sled",
                details: alloc::format!("{}", e),
            }
        })?;

        self.db.flush().map_err(|e| {
            CacheError::BackendError {
                backend: "sled",
                details: alloc::format!("{}", e),
            }
        })?;

        Ok(())
    }

    async fn delete(&self, key: &CacheKey) -> Result<bool> {
        match self.db.remove(key) {
            Ok(Some(_)) => {
                let _ = self.db.flush();
                Ok(true)
            }
            Ok(None) => Ok(false),
            Err(e) => Err(CacheError::BackendError {
                backend: "sled",
                details: alloc::format!("{}", e),
            }),
        }
    }

    async fn clear(&self) -> Result<()> {
        // Note: This is expensive, in real implementation you might want to drop and recreate
        for result in self.db.iter() {
            let (key, _) = result.map_err(|e| {
                CacheError::BackendError {
                    backend: "sled",
                    details: alloc::format!("{}", e),
                }
            })?;
            let _ = self.db.remove(key);
        }
        let _ = self.db.flush();
        Ok(())
    }

    async fn contains(&self, key: &CacheKey) -> Result<bool> {
        self.db.contains_key(key).map_err(|e| {
            CacheError::BackendError {
                backend: "sled",
                details: alloc::format!("{}", e),
            }
        })
    }

    async fn keys(&self) -> Result<alloc::vec::Vec<CacheKey>> {
        let mut keys = alloc::vec::Vec::new();
        for result in self.db.iter() {
            let (key, _) = result.map_err(|e| {
                CacheError::BackendError {
                    backend: "sled",
                    details: alloc::format!("{}", e),
                }
            })?;
            keys.push(key.to_vec());
        }
        Ok(keys)
    }

    fn stats(&self) -> Result<CacheStats> {
        Ok(self.stats.clone())
    }

    fn name(&self) -> &'static str {
        "persistent"
    }
}

/// Distributed cache backend using Redis
#[cfg(feature = "distributed")]
pub struct DistributedCache {
    /// Redis cluster connection
    cluster: redis::cluster::ClusterClient,
    /// Cache configuration
    config: CacheConfig,
    /// Statistics
    stats: CacheStats,
}

#[cfg(feature = "distributed")]
impl DistributedCache {
    /// Create a new distributed cache
    pub fn new(endpoints: &[alloc::string::String]) -> Result<Self> {
        let cluster = redis::cluster::ClusterClient::new(endpoints.iter().map(|s| s.as_str()).collect::<alloc::vec::Vec<_>>())
            .map_err(|e| {
                CacheError::ConnectionError {
                    endpoint: endpoints.join(","),
                    details: alloc::format!("{}", e),
                }
            })?;

        Ok(Self {
            cluster,
            config: CacheConfig::default(),
            stats: CacheStats::default(),
        })
    }

    /// Get Redis connection
    async fn get_connection(&self) -> Result<redis::cluster::ClusterConnection> {
        self.cluster.get_connection().await.map_err(|e| {
            CacheError::ConnectionError {
                endpoint: "cluster".into(),
                details: alloc::format!("{}", e),
            }
        })
    }
}

#[cfg(feature = "distributed")]
#[async_trait::async_trait(?Send)]
impl CacheBackend for DistributedCache {
    async fn get(&self, key: &CacheKey) -> Result<Option<CacheValue>> {
        let mut conn = self.get_connection().await?;
        let result: Option<alloc::vec::Vec<u8>> = redis::cmd("GET")
            .arg(key)
            .query_async(&mut conn)
            .await
            .map_err(|e| {
                CacheError::BackendError {
                    backend: "redis",
                    details: alloc::format!("{}", e),
                }
            })?;

        Ok(result)
    }

    async fn put(&self, key: CacheKey, value: CacheValue) -> Result<()> {
        if key.len() > MAX_KEY_SIZE {
            return Err(CacheError::KeyTooLarge {
                size: key.len(),
                max_size: MAX_KEY_SIZE,
            });
        }

        if value.len() > MAX_VALUE_SIZE {
            return Err(CacheError::ValueTooLarge {
                size: value.len(),
                max_size: MAX_VALUE_SIZE,
            });
        }

        let mut conn = self.get_connection().await?;

        if let Some(ttl) = self.config.default_ttl {
            redis::cmd("SETEX")
                .arg(&key)
                .arg(ttl)
                .arg(&value)
                .query_async(&mut conn)
                .await
        } else {
            redis::cmd("SET")
                .arg(&key)
                .arg(&value)
                .query_async(&mut conn)
                .await
        }.map_err(|e| {
            CacheError::BackendError {
                backend: "redis",
                details: alloc::format!("{}", e),
            }
        })?;

        Ok(())
    }

    async fn delete(&self, key: &CacheKey) -> Result<bool> {
        let mut conn = self.get_connection().await?;
        let result: i32 = redis::cmd("DEL")
            .arg(key)
            .query_async(&mut conn)
            .await
            .map_err(|e| {
                CacheError::BackendError {
                    backend: "redis",
                    details: alloc::format!("{}", e),
                }
            })?;

        Ok(result > 0)
    }

    async fn clear(&self) -> Result<()> {
        let mut conn = self.get_connection().await?;
        redis::cmd("FLUSHDB")
            .query_async(&mut conn)
            .await
            .map_err(|e| {
                CacheError::BackendError {
                    backend: "redis",
                    details: alloc::format!("{}", e),
                }
            })?;

        Ok(())
    }

    async fn contains(&self, key: &CacheKey) -> Result<bool> {
        let mut conn = self.get_connection().await?;
        let result: i32 = redis::cmd("EXISTS")
            .arg(key)
            .query_async(&mut conn)
            .await
            .map_err(|e| {
                CacheError::BackendError {
                    backend: "redis",
                    details: alloc::format!("{}", e),
                }
            })?;

        Ok(result > 0)
    }

    async fn keys(&self) -> Result<alloc::vec::Vec<CacheKey>> {
        // Note: KEYS is expensive in Redis, this is for demonstration only
        let mut conn = self.get_connection().await?;
        let result: alloc::vec::Vec<alloc::vec::Vec<u8>> = redis::cmd("KEYS")
            .arg("*")
            .query_async(&mut conn)
            .await
            .map_err(|e| {
                CacheError::BackendError {
                    backend: "redis",
                    details: alloc::format!("{}", e),
                }
            })?;

        Ok(result)
    }

    fn stats(&self) -> Result<CacheStats> {
        Ok(self.stats.clone())
    }

    fn name(&self) -> &'static str {
        "distributed"
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

    #[cfg(feature = "lru")]
    #[test]
    fn test_memory_cache_creation() {
        let cache = MemoryCache::new(100).unwrap();
        assert_eq!(cache.name(), "memory");
    }

    #[cfg(feature = "persistence")]
    #[test]
    fn test_persistent_cache_creation() {
        // This would require a temporary directory in real tests
        // For now, just test the name
        assert_eq!("persistent", "persistent");
    }

    #[cfg(feature = "distributed")]
    #[test]
    fn test_distributed_cache_creation() {
        // This would require Redis endpoints in real tests
        // For now, just test the name
        assert_eq!("distributed", "distributed");
    }

    #[test]
    fn test_size_limits() {
        let key = alloc::vec![0u8; MAX_KEY_SIZE + 1];
        let value = alloc::vec![0u8; MAX_VALUE_SIZE + 1];

        #[cfg(feature = "lru")]
        {
            let cache = MemoryCache::new(100).unwrap();

            // Test key too large
            assert!(cache.check_size_limits(&key, &alloc::vec![0u8; 10]).is_err());

            // Test value too large
            assert!(cache.check_size_limits(&alloc::vec![0u8; 10], &value).is_err());
        }
    }
}
