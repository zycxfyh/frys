//! Configuration types for the Frys Kernel

use crate::*;

/// Kernel configuration
#[derive(Debug, Clone)]
pub struct KernelConfig {
    /// Memory limit in bytes
    pub memory_limit: usize,

    /// Number of threads
    pub thread_count: usize,

    /// Network buffer size
    pub network_buffer_size: usize,

    /// Enable SIMD optimizations
    pub enable_simd: bool,

    /// Enable io_uring (Linux only)
    pub enable_uring: bool,

    /// Storage path (optional)
    pub storage_path: Option<String>,

    /// Storage configuration
    pub storage_config: StorageConfig,
}

impl Default for KernelConfig {
    fn default() -> Self {
        Self {
            memory_limit: DEFAULT_MEMORY_LIMIT,
            thread_count: DEFAULT_THREAD_COUNT,
            network_buffer_size: DEFAULT_NETWORK_BUFFER_SIZE,
            enable_simd: true,
            enable_uring: false,
            storage_path: None,
            storage_config: StorageConfig::default(),
        }
    }
}

/// Memory strategy
#[derive(Debug, Clone)]
pub enum MemoryStrategy {
    /// Arena-based allocation
    ArenaBased {
        arena_size: usize,
        max_arenas: usize,
    },

    /// Slab-based allocation
    SlabBased {
        slab_sizes: Vec<usize>,
    },

    /// Hybrid allocation
    Hybrid {
        arena_size: usize,
        slab_sizes: Vec<usize>,
    },
}

impl Default for MemoryStrategy {
    fn default() -> Self {
        MemoryStrategy::ArenaBased {
            arena_size: 64 * 1024 * 1024, // 64MB
            max_arenas: 16,
        }
    }
}

/// CPU affinity configuration
#[derive(Debug, Clone)]
pub struct CpuAffinityConfig {
    /// Enable CPU affinity
    pub enabled: bool,

    /// CPU cores to use
    pub cores: Vec<usize>,

    /// Pin threads to specific cores
    pub pin_threads: bool,
}

impl Default for CpuAffinityConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            cores: Vec::new(),
            pin_threads: false,
        }
    }
}

/// Storage configuration
#[derive(Debug, Clone)]
pub struct StorageConfig {
    /// Enable WAL
    pub enable_wal: bool,

    /// WAL buffer size
    pub wal_buffer_size: usize,

    /// LSM config
    pub lsm_config: LsmConfig,
}

impl Default for StorageConfig {
    fn default() -> Self {
        Self {
            enable_wal: true,
            wal_buffer_size: 64 * 1024,
            lsm_config: LsmConfig::default(),
        }
    }
}

/// LSM tree configuration
#[derive(Debug, Clone)]
pub struct LsmConfig {
    /// Max levels
    pub max_levels: usize,

    /// Level size ratio
    pub level_size_ratio: usize,
}

impl Default for LsmConfig {
    fn default() -> Self {
        Self {
            max_levels: 7,
            level_size_ratio: 10,
        }
    }
}