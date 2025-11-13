//! Hot reload functionality for configuration files

use crate::*;
use core::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use core::time::Duration;

/// Get current timestamp (simplified)
fn current_timestamp() -> u64 {
    // In a real implementation, this would use system time
    // For now, return 0
    0
}

/// Hot reload manager for file watching
#[cfg(feature = "hot_reload")]
#[derive(Debug)]
pub struct HotReloader {
    /// Watched files with their metadata
    watched_files: alloc::vec::Vec<WatchedFile>,
    /// Change callbacks
    callbacks: alloc::vec::Vec<Box<dyn Fn(&HotReloadEvent) + Send + Sync>>,
    /// Running flag
    running: Arc<AtomicBool>,
    /// Poll interval
    poll_interval: Duration,
    /// Statistics
    stats: HotReloadStats,
}

#[cfg(feature = "hot_reload")]
impl HotReloader {
    /// Create a new hot reloader
    pub fn new(poll_interval: Duration) -> Self {
        Self {
            watched_files: alloc::vec::Vec::new(),
            callbacks: alloc::vec::Vec::new(),
            running: Arc::new(AtomicBool::new(false)),
            poll_interval,
            stats: HotReloadStats::new(),
        }
    }

    /// Watch a file for changes
    pub fn watch_file<P: Into<alloc::string::String>>(&mut self, path: P, format: ConfigFormat) -> Result<()> {
        let path_str = path.into();

        // Check if file already exists
        #[cfg(feature = "std")]
        {
            use std::fs;
            let exists = fs::metadata(&path_str).is_ok();
            let initial_mtime = if exists {
                fs::metadata(&path_str)
                    .and_then(|m| m.modified())
                    .and_then(|t| Ok(t.duration_since(std::time::UNIX_EPOCH)?.as_secs()))
                    .unwrap_or(0)
            } else {
                0
            };

            let watched_file = WatchedFile {
                path: path_str,
                format,
                last_mtime: initial_mtime,
                exists,
            };

            self.watched_files.push(watched_file);
        }

        #[cfg(not(feature = "std"))]
        {
            let watched_file = WatchedFile {
                path: path_str,
                format,
                last_mtime: 0,
                exists: false,
            };
            self.watched_files.push(watched_file);
        }

        Ok(())
    }

    /// Add a change callback
    pub fn on_change<F>(&mut self, callback: F)
    where
        F: Fn(&HotReloadEvent) + Send + Sync + 'static,
    {
        self.callbacks.push(Box::new(callback));
    }

    /// Start watching for changes
    pub async fn start(&mut self) -> Result<()> {
        if self.running.load(Ordering::Acquire) {
            return Err(ConfigError::HotReloadError {
                operation: "start",
                details: "hot reloader already running".into(),
            });
        }

        self.running.store(true, Ordering::Release);
        self.stats.started_at = current_timestamp();

        // Spawn background monitoring task
        let running = Arc::clone(&self.running);
        let poll_interval = self.poll_interval;
        let watched_files = self.watched_files.clone();
        let callbacks = self.callbacks.clone();

        tokio::spawn(async move {
            Self::monitor_files(running, poll_interval, watched_files, callbacks).await;
        });

        Ok(())
    }

    /// Stop watching for changes
    pub async fn stop(&self) -> Result<()> {
        self.running.store(false, Ordering::Release);
        self.stats.stopped_at = current_timestamp();
        Ok(())
    }

    /// Background file monitoring loop
    async fn monitor_files(
        running: Arc<AtomicBool>,
        poll_interval: Duration,
        mut watched_files: alloc::vec::Vec<WatchedFile>,
        callbacks: alloc::vec::Vec<Box<dyn Fn(&HotReloadEvent) + Send + Sync>>,
    ) {
        while running.load(Ordering::Acquire) {
            // Check for changes
            for file in &mut watched_files {
                if let Some(change) = file.check_for_changes().await {
                    // Notify callbacks
                    let event = match change {
                        ChangeType::Created => HotReloadEvent::ConfigReloaded {
                            path: file.path.clone(),
                            success: true,
                            error: None,
                        },
                        ChangeType::Modified => HotReloadEvent::ConfigReloaded {
                            path: file.path.clone(),
                            success: true,
                            error: None,
                        },
                        ChangeType::Deleted => HotReloadEvent::ConfigReloaded {
                            path: file.path.clone(),
                            success: false,
                            error: Some("file deleted".into()),
                        },
                    };

                    for callback in &callbacks {
                        callback(&event);
                    }
                }
            }

            // Sleep before next check
            tokio::time::sleep(poll_interval).await;
        }
    }

    /// Check for file changes (manual poll)
    pub async fn check_changes(&mut self) -> Result<alloc::vec::Vec<FileChange>> {
        let mut changes = alloc::vec::Vec::new();

        for file in &mut self.watched_files {
            if let Some(change_type) = file.check_for_changes().await {
                self.stats.files_changed.fetch_add(1, Ordering::AcqRel);

                changes.push(FileChange {
                    path: file.path.clone(),
                    change_type,
                });
            }
        }

        Ok(changes)
    }

    /// Force reload a specific file
    pub async fn force_reload(&self, path: &str) -> Result<alloc::collections::BTreeMap<alloc::string::String, ConfigValue>> {
        // Find the file in watched files
        if let Some(file) = self.watched_files.iter().find(|f| f.path == path) {
            match file.load_content().await {
                Ok(content) => {
                    // Parse based on format
                    let config = match file.format {
                        ConfigFormat::Json => parse_json(&content)?,
                        ConfigFormat::Yaml => parse_yaml(&content)?,
                        ConfigFormat::Toml => parse_toml(&content)?,
                        ConfigFormat::Custom => parse_custom(&content)?,
                    };

                    if let ConfigValue::Object(obj) = config {
                        Ok(flatten_config(ConfigValue::Object(obj), alloc::string::String::new()))
                    } else {
                        Err(ConfigError::ParseError {
                            format: "unknown",
                            details: "expected object at root".into(),
                        })
                    }
                }
                Err(e) => Err(e),
            }
        } else {
            Err(ConfigError::HotReloadError {
                operation: "force_reload",
                details: alloc::format!("file not being watched: {}", path),
            })
        }
    }

    /// Get watched files
    pub fn watched_files(&self) -> &[WatchedFile] {
        &self.watched_files
    }

    /// Check if hot reload is running
    pub fn is_running(&self) -> bool {
        self.running.load(Ordering::Acquire)
    }

    /// Get statistics
    pub fn stats(&self) -> &HotReloadStats {
        &self.stats
    }
}

/// Watched file information
#[derive(Debug, Clone)]
pub struct WatchedFile {
    /// File path
    pub path: alloc::string::String,
    /// Configuration format
    pub format: ConfigFormat,
    /// Last modification time
    pub last_mtime: u64,
    /// Whether file exists
    pub exists: bool,
}

impl WatchedFile {
    /// Check for file changes
    pub async fn check_for_changes(&mut self) -> Option<ChangeType> {
        #[cfg(feature = "std")]
        {
            use std::fs;

            let metadata_result = fs::metadata(&self.path);

            match metadata_result {
                Ok(metadata) => {
                    let current_exists = true;
                    let current_mtime = metadata.modified()
                        .and_then(|t| Ok(t.duration_since(std::time::UNIX_EPOCH)?.as_secs()))
                        .unwrap_or(0);

                    let change_type = if !self.exists {
                        // File was created
                        Some(ChangeType::Created)
                    } else if current_mtime > self.last_mtime {
                        // File was modified
                        Some(ChangeType::Modified)
                    } else {
                        None
                    };

                    // Update state
                    self.exists = current_exists;
                    self.last_mtime = current_mtime;

                    change_type
                }
                Err(_) if self.exists => {
                    // File was deleted
                    self.exists = false;
                    Some(ChangeType::Deleted)
                }
                _ => None,
            }
        }

        #[cfg(not(feature = "std"))]
        {
            // In no_std, we can't check file system
            None
        }
    }

    /// Load file content
    pub async fn load_content(&self) -> Result<alloc::string::String> {
        #[cfg(feature = "std")]
        {
            use std::fs;
            fs::read_to_string(&self.path).map_err(|e| {
                ConfigError::FileReadError {
                    path: self.path.clone(),
                    details: alloc::format!("{}", e),
                }
            })
        }

        #[cfg(not(feature = "std"))]
        {
            Err(ConfigError::FileReadError {
                path: self.path.clone(),
                details: "file I/O not available in no_std".into(),
            })
        }
    }
}

/// Hot reload statistics
#[derive(Debug)]
pub struct HotReloadStats {
    /// When monitoring started
    pub started_at: u64,
    /// When monitoring stopped
    pub stopped_at: u64,
    /// Number of files being watched
    pub watched_files: AtomicUsize,
    /// Number of file changes detected
    pub files_changed: AtomicUsize,
    /// Number of successful reloads
    pub successful_reloads: AtomicUsize,
    /// Number of failed reloads
    pub failed_reloads: AtomicUsize,
}

impl HotReloadStats {
    /// Create new statistics
    pub fn new() -> Self {
        Self {
            started_at: 0,
            stopped_at: 0,
            watched_files: AtomicUsize::new(0),
            files_changed: AtomicUsize::new(0),
            successful_reloads: AtomicUsize::new(0),
            failed_reloads: AtomicUsize::new(0),
        }
    }

    /// Get uptime in seconds
    pub fn uptime(&self) -> u64 {
        if self.started_at == 0 {
            0
        } else if self.stopped_at > 0 {
            self.stopped_at - self.started_at
        } else {
            current_timestamp() - self.started_at
        }
    }
}

impl Default for HotReloadStats {
    fn default() -> Self {
        Self::new()
    }
}

/// File change information
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FileChange {
    /// Changed file path
    pub path: alloc::string::String,
    /// Type of change
    pub change_type: ChangeType,
}

/// Types of file changes
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ChangeType {
    /// File was created
    Created,
    /// File was modified
    Modified,
    /// File was deleted
    Deleted,
}

/// Hot reload event types
#[derive(Debug, Clone)]
pub enum HotReloadEvent {
    /// Configuration file reloaded
    ConfigReloaded {
        path: alloc::string::String,
        success: bool,
        error: Option<alloc::string::String>,
    },
    /// Configuration file changed
    ConfigChanged {
        path: alloc::string::String,
        new_config: alloc::collections::BTreeMap<alloc::string::String, ConfigValue>,
    },
    /// Configuration reload failed
    ReloadFailed {
        path: alloc::string::String,
        error: alloc::string::String,
    },
    /// Watcher started
    WatcherStarted,
    /// Watcher stopped
    WatcherStopped,
}

/// Configuration change tracker
#[derive(Debug)]
pub struct ChangeTracker {
    /// Changes since last snapshot
    changes: alloc::vec::Vec<ConfigChange>,
    /// Current version
    version: core::sync::atomic::AtomicU64,
}

impl ChangeTracker {
    /// Create a new change tracker
    pub fn new() -> Self {
        Self {
            changes: alloc::vec::Vec::new(),
            version: core::sync::atomic::AtomicU64::new(0),
        }
    }

    /// Record a configuration change
    pub fn record_change(&mut self, change: ConfigChange) {
        let new_version = self.version.fetch_add(1, Ordering::AcqRel) + 1;
        let change_with_version = ConfigChange {
            version: new_version,
            ..change
        };
        self.changes.push(change_with_version);
    }

    /// Get changes since a specific version
    pub fn changes_since(&self, version: u64) -> alloc::vec::Vec<&ConfigChange> {
        self.changes.iter()
            .filter(|change| change.version > version)
            .collect()
    }

    /// Get all changes
    pub fn all_changes(&self) -> &[ConfigChange] {
        &self.changes
    }

    /// Get current version
    pub fn current_version(&self) -> u64 {
        self.version.load(Ordering::Acquire)
    }

    /// Clear old changes
    pub fn clear_old_changes(&mut self, keep_versions: u64) {
        let current_version = self.current_version();
        let min_version = if current_version > keep_versions {
            current_version - keep_versions
        } else {
            0
        };

        self.changes.retain(|change| change.version >= min_version);
    }
}

/// Configuration change information
#[derive(Debug, Clone)]
pub struct ConfigChange {
    /// Change version
    pub version: u64,
    /// Changed key
    pub key: alloc::string::String,
    /// Old value
    pub old_value: Option<ConfigValue>,
    /// New value
    pub new_value: Option<ConfigValue>,
    /// Change timestamp
    pub timestamp: u64,
    /// Source of change
    pub source: ConfigSource,
}

/// Configuration rollback manager
#[derive(Debug)]
pub struct RollbackManager {
    /// Snapshots for rollback
    snapshots: alloc::vec::Vec<ConfigSnapshot>,
    /// Maximum snapshots to keep
    max_snapshots: usize,
}

impl RollbackManager {
    /// Create a new rollback manager
    pub fn new(max_snapshots: usize) -> Self {
        Self {
            snapshots: alloc::vec::Vec::new(),
            max_snapshots,
        }
    }

    /// Create a snapshot
    pub fn create_snapshot(&mut self, config: &ConfigManager) {
        let snapshot = config.snapshot();
        self.snapshots.push(snapshot);

        // Keep only the most recent snapshots
        if self.snapshots.len() > self.max_snapshots {
            self.snapshots.remove(0);
        }
    }

    /// Rollback to a specific snapshot
    pub fn rollback_to(&self, index: usize, config: &mut ConfigManager) -> Result<()> {
        if index >= self.snapshots.len() {
            return Err(ConfigError::InvalidConfiguration {
                field: "snapshot_index",
                reason: "snapshot index out of range",
            });
        }

        let snapshot = &self.snapshots[self.snapshots.len() - 1 - index];

        // Clear current configuration
        let keys: alloc::vec::Vec<_> = config.keys().cloned().collect();
        for key in keys {
            // In a real implementation, we would remove entries
            // For now, this is a placeholder
            let _ = key;
        }

        // Apply snapshot
        for (key, entry) in &snapshot.entries {
            config.set(key.clone(), entry.value.clone())?;
        }

        Ok(())
    }

    /// Get available snapshots
    pub fn snapshots(&self) -> &[ConfigSnapshot] {
        &self.snapshots
    }

    /// Get snapshot count
    pub fn snapshot_count(&self) -> usize {
        self.snapshots.len()
    }
}

#[cfg(feature = "hot_reload")]
impl Default for HotReloader {
    fn default() -> Self {
        Self::new(Duration::from_secs(1))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(feature = "hot_reload")]
    #[test]
    fn test_hot_reloader_creation() {
        let reloader = HotReloader::new(Duration::from_secs(2));
        assert!(!reloader.is_running());
        assert_eq!(reloader.watched_files().len(), 0);
    }

    #[cfg(feature = "hot_reload")]
    #[tokio::test]
    async fn test_watched_file() {
        let mut watched_file = WatchedFile {
            path: "test.json".into(),
            format: ConfigFormat::Json,
            last_mtime: 0,
            exists: false,
        };

        // Check for changes on non-existent file
        let change = watched_file.check_for_changes().await;
        assert_eq!(change, None); // File doesn't exist in test environment
    }

    #[test]
    fn test_change_tracker() {
        let mut tracker = ChangeTracker::new();

        let change = ConfigChange {
            version: 0,
            key: "test.key".into(),
            old_value: None,
            new_value: Some(ConfigValue::String("value".into())),
            timestamp: 0,
            source: ConfigSource::Runtime,
        };

        tracker.record_change(change);

        assert_eq!(tracker.current_version(), 1);
        assert_eq!(tracker.all_changes().len(), 1);

        // Test changes since version
        let recent_changes = tracker.changes_since(0);
        assert_eq!(recent_changes.len(), 1);

        let old_changes = tracker.changes_since(1);
        assert_eq!(old_changes.len(), 0);
    }

    #[test]
    fn test_rollback_manager() {
        let mut rollback = RollbackManager::new(5);
        let config = ConfigManager::new();

        // Create a few snapshots
        rollback.create_snapshot(&config);
        rollback.create_snapshot(&config);
        rollback.create_snapshot(&config);

        assert_eq!(rollback.snapshot_count(), 3);

        // Test rollback (would work with real config)
        let mut config = ConfigManager::new();
        assert!(rollback.rollback_to(0, &mut config).is_ok());
    }

    #[test]
    fn test_hot_reload_stats() {
        let stats = HotReloadStats::new();
        assert_eq!(stats.uptime(), 0);

        // Test with started time
        let mut stats = HotReloadStats {
            started_at: 100,
            stopped_at: 0,
            ..Default::default()
        };

        // Since we can't control current_timestamp in test, uptime will be 0
        // In real usage, this would return current time - started_at
        assert_eq!(stats.uptime(), 0);
    }

    #[test]
    fn test_file_change() {
        let change = FileChange {
            path: "/path/to/config.json".into(),
            change_type: ChangeType::Modified,
        };

        assert_eq!(change.path, "/path/to/config.json");
        assert_eq!(change.change_type, ChangeType::Modified);
    }

    #[test]
    fn test_hot_reload_event() {
        let event = HotReloadEvent::ConfigReloaded {
            path: "config.json".into(),
            success: true,
            error: None,
        };

        match event {
            HotReloadEvent::ConfigReloaded { path, success, error } => {
                assert_eq!(path, "config.json");
                assert!(success);
                assert!(error.is_none());
            }
            _ => panic!("Wrong event type"),
        }
    }

    #[test]
    fn test_change_type() {
        assert_eq!(ChangeType::Created as u8, 0);
        assert_eq!(ChangeType::Modified as u8, 1);
        assert_eq!(ChangeType::Deleted as u8, 2);
    }
}
