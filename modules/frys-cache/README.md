# Frys Cache

Frys Cache is a multi-level caching system designed for high-performance applications. It provides memory LRU caching, persistent storage, and distributed cache support with advanced consistency and preloading features.

## Features

- **Multi-level Caching**: Memory LRU, persistent storage, distributed cache
- **Flexible Policies**: TTL, size limits, eviction strategies (LRU, LFU, Size-based)
- **Consistency Models**: Write-through, write-back, cache-aside patterns
- **Persistence**: Sled-based durable storage with ZSTD compression
- **Distribution**: Redis cluster support for multi-node deployments
- **Preloading**: Intelligent cache warming and prefetching
- **Metrics**: Comprehensive cache statistics and monitoring
- **Async Support**: Full async/await support throughout

## Quick Start

```rust,no_run
use frys_cache::*;

// Create a multi-level cache
let cache = CacheBuilder::new()
    .with_memory_lru(1000)  // 1000 items in memory
    .with_persistent("./cache.db")  // Persistent storage
    .with_ttl(Duration::from_secs(3600))  // 1 hour TTL
    .with_compression(true)
    .build()
    .await?;

// Store data
cache.put(b"user:123", b"{'name': 'Alice'}").await?;

// Retrieve data
if let Some(data) = cache.get(b"user:123").await? {
    println!("Found user: {}", String::from_utf8_lossy(&data));
}
```

## Architecture

The Cache system consists of several key components:

1. **CacheManager**: Main cache interface coordinating all levels
2. **MemoryCache**: High-performance LRU in-memory cache
3. **PersistentCache**: Durable storage using Sled with compression
4. **DistributedCache**: Redis cluster for distributed caching
5. **PolicyManager**: Eviction and expiration policies
6. **ConsistencyManager**: Ensures data consistency across levels
7. **Preloader**: Intelligent cache warming

## Configuration

### Memory Cache
```rust
let cache = CacheBuilder::new()
    .max_entries(5000)
    .max_size_bytes(100 * 1024 * 1024)  // 100MB
    .eviction_policy(EvictionPolicy::Lru)
    .build()
    .await?;
```

### Persistent Cache
```rust
let cache = CacheBuilder::new()
    .with_persistent("./cache.db")
    .with_compression(true)
    .compression_level(5)
    .build()
    .await?;
```

### Distributed Cache
```rust
let cache = CacheBuilder::new()
    .with_distributed(vec![
        "redis://127.0.0.1:6379".into(),
        "redis://127.0.0.1:6380".into(),
    ])
    .build()
    .await?;
```

## Cache Policies

### TTL Policy
```rust
let policy = TtlPolicy::new(Some(Duration::from_secs(3600)));
```

### LRU Policy
```rust
let policy = LruPolicy::new();
```

### Composite Policies
```rust
let policy = CompositePolicy::lru_with_ttl(Some(Duration::from_secs(1800)));
```

## Consistency Strategies

### Write-Through
```rust
let consistency = ConsistencyManager::new(ConsistencyStrategy::WriteThrough);
// Writes go to cache and backend simultaneously
```

### Write-Back
```rust
let consistency = ConsistencyManager::new(ConsistencyStrategy::WriteBack);
// Writes go to cache first, then asynchronously to backend
```

### Cache-Aside
```rust
let consistency = ConsistencyManager::new(ConsistencyStrategy::CacheAside);
// Application manages cache and backend separately
```

## Preloading and Warming

### Predictive Preloading
```rust
let mut preloader = PredictivePreloader::new(0.7);
preloader.record_access(b"user:123".to_vec(), timestamp);

// Use with cache preloader
let cache_preloader = CachePreloader::new(10)
    .add_strategy(preloader);

cache_preloader.preload(&cache).await?;
```

### Access Pattern Warming
```rust
let patterns = vec![
    AccessPattern::FrequentlyAccessed(vec![
        b"user:123".to_vec(),
        b"product:456".to_vec(),
    ]),
    AccessPattern::Sequential(KeyRange { start: 0, end: 100 }),
];

preloader.warm_up(&cache, &patterns).await?;
```

## Cache Invalidation

```rust
let mut invalidator = InvalidationManager::new();
invalidator.add_pattern(
    InvalidationPattern::new(PatternType::Prefix, "user:".into())
);

// Invalidate all user-related cache entries
let invalidated = invalidator.invalidate(b"user:123").await?;
println!("Invalidated {} keys", invalidated.len());
```

## Statistics and Monitoring

```rust
let stats = cache.stats();
println!("Hit ratio: {:.2}%", stats.hit_ratio * 100.0);
println!("Total entries: {}", stats.entries);
println!("Total size: {} bytes", stats.total_size);

let preload_stats = preloader.stats();
println!("Preload success rate: {:.2}%", preload_stats.success_rate() * 100.0);
```

## Performance Goals

- **Memory cache**: < 10ns read/write for hot data
- **Persistent cache**: < 100μs for compressed data
- **Hit ratio**: > 95% for well-designed workloads
- **Memory usage**: < 2x data size with overhead
- **Scalability**: Linear scaling with cache levels

## Error Handling

All operations return `Result<T>` with detailed error information:

```rust
match cache.get(b"missing_key").await {
    Ok(Some(data)) => println!("Found: {:?}", data),
    Ok(None) => println!("Key not found"),
    Err(CacheError::KeyTooLarge { size, max_size }) => {
        println!("Key too large: {} > {}", size, max_size);
    }
    Err(e) => println!("Cache error: {}", e),
}
```

## Testing

```bash
# Test with all features
cargo test --features "lru persistence distributed compression serde metrics async"

# Benchmark (requires criterion)
cargo bench --features benchmarks
```

## License

MIT License