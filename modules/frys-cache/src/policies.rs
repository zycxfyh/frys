//! Cache policies and eviction strategies

use crate::*;
use core::time::Duration;

/// Cache policy trait
pub trait CachePolicy: Send + Sync {
    /// Determine if an entry should be evicted
    fn should_evict(&self, entry: &CacheEntry, now: u64) -> bool;

    /// Select entries for eviction
    fn select_for_eviction(&self, entries: &[CacheEntry]) -> alloc::vec::Vec<usize>;

    /// Update entry access information
    fn on_access(&self, entry: &mut CacheEntry, now: u64);

    /// Get policy name
    fn name(&self) -> &'static str;
}

/// TTL (Time-To-Live) policy
#[derive(Debug)]
pub struct TtlPolicy {
    /// Default TTL duration
    default_ttl: Option<Duration>,
}

impl TtlPolicy {
    /// Create a new TTL policy
    pub fn new(default_ttl: Option<Duration>) -> Self {
        Self { default_ttl }
    }

    /// Check if entry has expired
    pub fn is_expired(&self, entry: &CacheEntry, now: u64) -> bool {
        if let Some(ttl) = entry.ttl {
            entry.created_at + ttl <= now
        } else if let Some(default_ttl) = self.default_ttl {
            entry.created_at + default_ttl.as_secs() <= now
        } else {
            false // No TTL, never expires
        }
    }
}

impl CachePolicy for TtlPolicy {
    fn should_evict(&self, entry: &CacheEntry, now: u64) -> bool {
        self.is_expired(entry, now)
    }

    fn select_for_eviction(&self, entries: &[CacheEntry]) -> alloc::vec::Vec<usize> {
        let mut to_evict = alloc::vec::Vec::new();
        let now = current_timestamp();

        for (index, entry) in entries.iter().enumerate() {
            if self.is_expired(entry, now) {
                to_evict.push(index);
            }
        }

        to_evict
    }

    fn on_access(&self, _entry: &mut CacheEntry, _now: u64) {
        // TTL policy doesn't update on access
    }

    fn name(&self) -> &'static str {
        "ttl"
    }
}

/// LRU (Least Recently Used) policy
#[derive(Debug)]
pub struct LruPolicy;

impl LruPolicy {
    /// Create a new LRU policy
    pub fn new() -> Self {
        Self
    }
}

impl CachePolicy for LruPolicy {
    fn should_evict(&self, _entry: &CacheEntry, _now: u64) -> bool {
        false // LRU doesn't evict based on individual entries
    }

    fn select_for_eviction(&self, entries: &[CacheEntry]) -> alloc::vec::Vec<usize> {
        // Find the least recently used entry
        let mut lru_index = 0;
        let mut lru_time = u64::MAX;

        for (index, entry) in entries.iter().enumerate() {
            if entry.accessed_at < lru_time {
                lru_time = entry.accessed_at;
                lru_index = index;
            }
        }

        alloc::vec![lru_index]
    }

    fn on_access(&self, entry: &mut CacheEntry, now: u64) {
        entry.accessed_at = now;
        entry.access_count += 1;
    }

    fn name(&self) -> &'static str {
        "lru"
    }
}

/// LFU (Least Frequently Used) policy
#[derive(Debug)]
pub struct LfuPolicy;

impl LfuPolicy {
    /// Create a new LFU policy
    pub fn new() -> Self {
        Self
    }
}

impl CachePolicy for LfuPolicy {
    fn should_evict(&self, _entry: &CacheEntry, _now: u64) -> bool {
        false // LFU doesn't evict based on individual entries
    }

    fn select_for_eviction(&self, entries: &[CacheEntry]) -> alloc::vec::Vec<usize> {
        // Find the least frequently used entry
        let mut lfu_index = 0;
        let mut lfu_count = u64::MAX;

        for (index, entry) in entries.iter().enumerate() {
            if entry.access_count < lfu_count {
                lfu_count = entry.access_count;
                lfu_index = index;
            }
        }

        alloc::vec![lfu_index]
    }

    fn on_access(&self, entry: &mut CacheEntry, now: u64) {
        entry.accessed_at = now;
        entry.access_count += 1;
    }

    fn name(&self) -> &'static str {
        "lfu"
    }
}

/// Size-based eviction policy
#[derive(Debug)]
pub struct SizeBasedPolicy {
    /// Maximum total size
    max_size: u64,
}

impl SizeBasedPolicy {
    /// Create a new size-based policy
    pub fn new(max_size: u64) -> Self {
        Self { max_size }
    }

    /// Calculate total size of entries
    pub fn calculate_total_size(&self, entries: &[CacheEntry]) -> u64 {
        entries.iter().map(|entry| entry.size as u64).sum()
    }
}

impl CachePolicy for SizeBasedPolicy {
    fn should_evict(&self, _entry: &CacheEntry, _now: u64) -> bool {
        false // Size-based eviction is checked at the cache level
    }

    fn select_for_eviction(&self, entries: &[CacheEntry]) -> alloc::vec::Vec<usize> {
        // Sort by size (largest first) and select enough to free space
        let mut indices: alloc::vec::Vec<usize> = (0..entries.len()).collect();
        indices.sort_by(|&a, &b| {
            entries[b].size.cmp(&entries[a].size) // Sort by size descending
        });

        // For now, just return the largest entry
        // In a real implementation, this would calculate how much space to free
        indices.into_iter().take(1).collect()
    }

    fn on_access(&self, entry: &mut CacheEntry, now: u64) {
        entry.accessed_at = now;
        entry.access_count += 1;
    }

    fn name(&self) -> &'static str {
        "size_based"
    }
}

/// Composite policy combining multiple strategies
#[derive(Debug)]
pub struct CompositePolicy {
    /// List of policies to apply
    policies: alloc::vec::Vec<Box<dyn CachePolicy>>,
}

impl CompositePolicy {
    /// Create a new composite policy
    pub fn new() -> Self {
        Self {
            policies: alloc::vec::Vec::new(),
        }
    }

    /// Add a policy to the composite
    pub fn add_policy<P: CachePolicy + 'static>(mut self, policy: P) -> Self {
        self.policies.push(Box::new(policy));
        self
    }

    /// Create a common LRU + TTL policy
    pub fn lru_with_ttl(default_ttl: Option<Duration>) -> Self {
        Self::new()
            .add_policy(LruPolicy::new())
            .add_policy(TtlPolicy::new(default_ttl))
    }
}

impl CachePolicy for CompositePolicy {
    fn should_evict(&self, entry: &CacheEntry, now: u64) -> bool {
        // Entry should be evicted if ANY policy says so
        self.policies
            .iter()
            .any(|policy| policy.should_evict(entry, now))
    }

    fn select_for_eviction(&self, entries: &[CacheEntry]) -> alloc::vec::Vec<usize> {
        // Use the first policy's selection strategy
        // In a more sophisticated implementation, this could combine strategies
        if let Some(first_policy) = self.policies.first() {
            first_policy.select_for_eviction(entries)
        } else {
            alloc::vec::Vec::new()
        }
    }

    fn on_access(&self, entry: &mut CacheEntry, now: u64) {
        // Update all policies
        for policy in &self.policies {
            policy.on_access(entry, now);
        }
    }

    fn name(&self) -> &'static str {
        "composite"
    }
}

/// Policy manager for coordinating multiple policies
#[derive(Debug)]
pub struct PolicyManager {
    /// Active policies
    policies: alloc::vec::Vec<Box<dyn CachePolicy>>,
    /// Policy statistics
    stats: PolicyStats,
}

impl PolicyManager {
    /// Create a new policy manager
    pub fn new() -> Self {
        Self {
            policies: alloc::vec::Vec::new(),
            stats: PolicyStats::default(),
        }
    }

    /// Add a policy
    pub fn add_policy<P: CachePolicy + 'static>(mut self, policy: P) -> Self {
        self.policies.push(Box::new(policy));
        self
    }

    /// Check if entry should be evicted
    pub fn should_evict(&self, entry: &CacheEntry) -> bool {
        let now = current_timestamp();
        let should_evict = self
            .policies
            .iter()
            .any(|policy| policy.should_evict(entry, now));

        if should_evict {
            self.stats.record_eviction();
        }

        should_evict
    }

    /// Select entries for eviction
    pub fn select_for_eviction(&self, entries: &[CacheEntry], count: usize) -> alloc::vec::Vec<usize> {
        if self.policies.is_empty() {
            return alloc::vec::Vec::new();
        }

        // Use the first policy's selection strategy
        let indices = self.policies[0].select_for_eviction(entries);

        // Limit to requested count
        indices.into_iter().take(count).collect()
    }

    /// Update entry on access
    pub fn on_access(&self, entry: &mut CacheEntry) {
        let now = current_timestamp();
        for policy in &self.policies {
            policy.on_access(entry, now);
        }
        self.stats.record_access();
    }

    /// Get policy statistics
    pub fn stats(&self) -> &PolicyStats {
        &self.stats
    }
}

/// Policy statistics
#[derive(Debug, Clone, Default)]
pub struct PolicyStats {
    /// Total access count
    pub total_accesses: u64,
    /// Total evictions
    pub total_evictions: u64,
    /// Policy effectiveness score (higher is better)
    pub effectiveness_score: f64,
}

impl PolicyStats {
    /// Record an access
    pub fn record_access(&self) {
        // In real implementation, this would be atomic
    }

    /// Record an eviction
    pub fn record_eviction(&self) {
        // In real implementation, this would be atomic
    }

    /// Calculate effectiveness score
    pub fn calculate_effectiveness(&mut self, hit_ratio: f64) {
        // Simple effectiveness calculation
        // Higher hit ratio and lower eviction rate = better effectiveness
        self.effectiveness_score = hit_ratio * 100.0;
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
    use core::time::Duration;

    #[test]
    fn test_ttl_policy() {
        let policy = TtlPolicy::new(Some(Duration::from_secs(60)));

        let mut entry = CacheEntry {
            key: b"test".to_vec(),
            value: b"value".to_vec(),
            ttl: Some(30),
            created_at: 100,
            accessed_at: 100,
            access_count: 1,
            size: 10,
            level: CacheLevel::Memory,
        };

        // Should not be expired (100 + 30 > 120)
        assert!(!policy.should_evict(&entry, 120));

        // Should be expired (100 + 30 <= 140)
        assert!(policy.should_evict(&entry, 140));
    }

    #[test]
    fn test_lru_policy() {
        let policy = LruPolicy::new();

        let entries = vec![
            CacheEntry {
                key: b"key1".to_vec(),
                value: b"value1".to_vec(),
                ttl: None,
                created_at: 100,
                accessed_at: 100,
                access_count: 1,
                size: 10,
                level: CacheLevel::Memory,
            },
            CacheEntry {
                key: b"key2".to_vec(),
                value: b"value2".to_vec(),
                ttl: None,
                created_at: 100,
                accessed_at: 200,
                access_count: 1,
                size: 10,
                level: CacheLevel::Memory,
            },
        ];

        // Should select first entry (least recently used)
        let to_evict = policy.select_for_eviction(&entries);
        assert_eq!(to_evict, vec![0]);
    }

    #[test]
    fn test_lfu_policy() {
        let policy = LfuPolicy::new();

        let entries = vec![
            CacheEntry {
                key: b"key1".to_vec(),
                value: b"value1".to_vec(),
                ttl: None,
                created_at: 100,
                accessed_at: 100,
                access_count: 1,
                size: 10,
                level: CacheLevel::Memory,
            },
            CacheEntry {
                key: b"key2".to_vec(),
                value: b"value2".to_vec(),
                ttl: None,
                created_at: 100,
                accessed_at: 200,
                access_count: 5,
                size: 10,
                level: CacheLevel::Memory,
            },
        ];

        // Should select first entry (least frequently used)
        let to_evict = policy.select_for_eviction(&entries);
        assert_eq!(to_evict, vec![0]);
    }

    #[test]
    fn test_composite_policy() {
        let policy = CompositePolicy::lru_with_ttl(Some(Duration::from_secs(60)));

        let mut entry = CacheEntry {
            key: b"test".to_vec(),
            value: b"value".to_vec(),
            ttl: Some(30),
            created_at: 100,
            accessed_at: 100,
            access_count: 1,
            size: 10,
            level: CacheLevel::Memory,
        };

        // Should not be evicted initially
        assert!(!policy.should_evict(&entry, 120));

        // Should be evicted due to TTL
        assert!(policy.should_evict(&entry, 140));
    }

    #[test]
    fn test_policy_manager() {
        let manager = PolicyManager::new().add_policy(LruPolicy::new());

        let mut entry = CacheEntry {
            key: b"test".to_vec(),
            value: b"value".to_vec(),
            ttl: None,
            created_at: 100,
            accessed_at: 100,
            access_count: 1,
            size: 10,
            level: CacheLevel::Memory,
        };

        manager.on_access(&mut entry);
        assert_eq!(entry.access_count, 2);
    }
}
