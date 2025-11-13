//! Example usage of Frys Cache

use frys_cache::*;
use core::time::Duration;

/// Example cache usage
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("Frys Cache Example");
    println!("==================");

    // Create a cache with memory backend
    let cache = CacheBuilder::new()
        .max_entries(100)
        .default_ttl(Some(Duration::from_secs(300)))
        .with_compression(false)
        .build()
        .await?;

    println!("\nCache created successfully!");
    println!("Max entries: 100");
    println!("Default TTL: 300 seconds");

    // Store some data
    println!("\nStoring data...");
    cache.put(b"user:alice", b"Alice Johnson").await?;
    cache.put(b"user:bob", b"Bob Smith").await?;
    cache.put(b"product:123", b"Laptop Computer").await?;

    println!("✓ Stored 3 items");

    // Retrieve data
    println!("\nRetrieving data...");
    if let Some(data) = cache.get(b"user:alice").await? {
        println!("user:alice = {}", String::from_utf8_lossy(&data));
    }

    if let Some(data) = cache.get(b"product:123").await? {
        println!("product:123 = {}", String::from_utf8_lossy(&data));
    }

    // Test cache miss
    if cache.get(b"user:charlie").await?.is_none() {
        println!("user:charlie = (not found)");
    }

    // Check cache statistics
    let stats = cache.stats();
    println!("\nCache Statistics:");
    println!("Total entries: {}", stats.entries);
    println!("Total size: {} bytes", stats.total_size);
    println!("Hits: {}", stats.hits);
    println!("Misses: {}", stats.misses);
    println!("Hit ratio: {:.1}%", stats.hit_ratio * 100.0);

    // Test key existence
    println!("\nKey existence checks:");
    println!("Contains 'user:alice': {}", cache.contains(b"user:alice").await?);
    println!("Contains 'user:charlie': {}", cache.contains(b"user:charlie").await?);

    // Delete an entry
    println!("\nDeleting user:bob...");
    let deleted = cache.delete(b"user:bob").await?;
    println!("Deleted: {}", deleted);
    println!("Contains 'user:bob': {}", cache.contains(b"user:bob").await?);

    // Clear cache
    println!("\nClearing cache...");
    cache.clear().await?;
    println!("Cache cleared");

    // Final statistics
    let final_stats = cache.stats();
    println!("Final entries: {}", final_stats.entries);

    println!("\nExample completed successfully!");

    Ok(())
}
