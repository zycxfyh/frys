//! Storage engine implementation

use crate::*;

/// Storage engine for persistence
#[derive(Debug)]
pub struct StorageEngine;

impl StorageEngine {
    pub fn new(_path: Option<&str>, _config: StorageConfig) -> Result<Self> {
        Ok(Self)
    }

    pub fn stats(&self) -> StorageStats {
        StorageStats {
            total_entries: 0,
            total_size: 0,
            wal_entries: 0,
            lsm_levels: 0,
        }
    }

    pub async fn shutdown(&self) -> Result<()> {
        Ok(())
    }

    pub async fn health_check(&self) -> Result<()> {
        Ok(())
    }

    pub async fn start_compaction_task(&self) -> Result<()> {
        Ok(())
    }
}

/// Storage statistics
#[derive(Debug, Clone, Default)]
pub struct StorageStats {
    pub total_entries: u64,
    pub total_size: usize,
    pub wal_entries: u64,
    pub lsm_levels: usize,
}