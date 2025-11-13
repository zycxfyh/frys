//! Core plugin system types and structures

use crate::*;
use core::time::Duration;

/// Plugin identifier
pub type PluginId = alloc::string::String;

/// Plugin version
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub struct PluginVersion {
    /// Major version
    pub major: u32,
    /// Minor version
    pub minor: u32,
    /// Patch version
    pub patch: u32,
}

impl PluginVersion {
    /// Create a new version
    pub fn new(major: u32, minor: u32, patch: u32) -> Self {
        Self { major, minor, patch }
    }

    /// Parse version from string
    pub fn parse(s: &str) -> Option<Self> {
        let parts: alloc::vec::Vec<&str> = s.split('.').collect();
        if parts.len() == 3 {
            let major = parts[0].parse().ok()?;
            let minor = parts[1].parse().ok()?;
            let patch = parts[2].parse().ok()?;
            Some(Self { major, minor, patch })
        } else {
            None
        }
    }
}

impl core::fmt::Display for PluginVersion {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        write!(f, "{}.{}.{}", self.major, self.minor, self.patch)
    }
}

/// Plugin metadata
#[derive(Debug, Clone)]
pub struct PluginMetadata {
    /// Plugin unique identifier
    pub id: PluginId,
    /// Plugin name
    pub name: alloc::string::String,
    /// Plugin version
    pub version: PluginVersion,
    /// Plugin description
    pub description: alloc::string::String,
    /// Plugin author
    pub author: alloc::string::String,
    /// Plugin license
    pub license: alloc::string::String,
    /// Plugin dependencies
    pub dependencies: alloc::vec::Vec<PluginDependency>,
    /// Plugin capabilities
    pub capabilities: alloc::vec::Vec<PluginCapability>,
    /// Required permissions
    pub permissions: alloc::vec::Vec<PluginPermission>,
    /// Resource limits
    pub resource_limits: ResourceLimits,
}

/// Plugin dependency
#[derive(Debug, Clone)]
pub struct PluginDependency {
    /// Dependency plugin ID
    pub plugin_id: PluginId,
    /// Required version range
    pub version_range: alloc::string::String,
    /// Whether dependency is optional
    pub optional: bool,
}

/// Plugin capability
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PluginCapability {
    /// Data processing
    DataProcessing,
    /// Network communication
    NetworkCommunication,
    /// File system access
    FileSystemAccess,
    /// Database access
    DatabaseAccess,
    /// AI/ML processing
    AIProcessing,
    /// Custom capability
    Custom(alloc::string::String),
}

/// Plugin permission
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PluginPermission {
    /// Read access
    Read,
    /// Write access
    Write,
    /// Network access
    Network,
    /// Execute access
    Execute,
    /// Admin access
    Admin,
}

/// Resource limits for plugins
#[derive(Debug, Clone)]
pub struct ResourceLimits {
    /// Maximum memory usage in bytes
    pub max_memory: u64,
    /// Maximum CPU time per execution in milliseconds
    pub max_cpu_time: u64,
    /// Maximum execution time in milliseconds
    pub max_execution_time: u64,
    /// Maximum network bandwidth per second
    pub max_network_bandwidth: u64,
    /// Maximum file system operations per second
    pub max_fs_operations: u32,
}

impl Default for ResourceLimits {
    fn default() -> Self {
        Self {
            max_memory: MAX_PLUGIN_MEMORY as u64,
            max_cpu_time: 1000, // 1 second
            max_execution_time: DEFAULT_PLUGIN_TIMEOUT * 1000,
            max_network_bandwidth: 1024 * 1024, // 1MB/s
            max_fs_operations: 100,
        }
    }
}

/// Plugin instance state
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PluginState {
    /// Plugin is loaded but not initialized
    Loaded,
    /// Plugin is initialized and ready
    Initialized,
    /// Plugin is running
    Running,
    /// Plugin is suspended
    Suspended,
    /// Plugin encountered an error
    Error,
    /// Plugin is unloaded
    Unloaded,
}

/// Plugin execution context
#[derive(Debug)]
pub struct PluginContext {
    /// Plugin metadata
    pub metadata: PluginMetadata,
    /// Plugin state
    pub state: PluginState,
    /// Resource usage statistics
    pub resource_usage: ResourceUsage,
    /// Last execution time
    pub last_execution: Option<u64>,
    /// Execution count
    pub execution_count: u64,
    /// Error count
    pub error_count: u64,
}

/// Resource usage statistics
#[derive(Debug, Clone, Default)]
pub struct ResourceUsage {
    /// Current memory usage
    pub memory_usage: u64,
    /// Total CPU time used
    pub cpu_time_used: u64,
    /// Total execution time
    pub execution_time: u64,
    /// Network bytes sent
    pub network_sent: u64,
    /// Network bytes received
    pub network_received: u64,
    /// File system operations performed
    pub fs_operations: u32,
}

/// Plugin execution result
#[derive(Debug)]
pub struct PluginResult {
    /// Execution status
    pub success: bool,
    /// Result data
    pub data: alloc::vec::Vec<u8>,
    /// Execution time in milliseconds
    pub execution_time: u64,
    /// Resource usage during execution
    pub resource_usage: ResourceUsage,
    /// Error message if execution failed
    pub error: Option<alloc::string::String>,
}

/// Plugin manager builder
#[derive(Debug)]
pub struct PluginManagerBuilder {
    enable_sandbox: bool,
    enable_hot_reload: bool,
    registry_endpoint: Option<alloc::string::String>,
    max_plugins: usize,
    default_resource_limits: ResourceLimits,
    enable_metrics: bool,
    plugin_paths: alloc::vec::Vec<alloc::string::String>,
}

impl PluginManagerBuilder {
    /// Create a new builder
    pub fn new() -> Self {
        Self {
            enable_sandbox: true,
            enable_hot_reload: false,
            registry_endpoint: None,
            max_plugins: MAX_PLUGIN_INSTANCES,
            default_resource_limits: ResourceLimits::default(),
            enable_metrics: true,
            plugin_paths: alloc::vec::Vec::new(),
        }
    }

    /// Enable/disable sandboxing
    pub fn with_sandbox(mut self, enable: bool) -> Self {
        self.enable_sandbox = enable;
        self
    }

    /// Enable/disable hot reload
    pub fn with_hot_reload(mut self, enable: bool) -> Self {
        self.enable_hot_reload = enable;
        self
    }

    /// Set registry endpoint
    pub fn with_registry(mut self, endpoint: alloc::string::String) -> Self {
        self.registry_endpoint = Some(endpoint);
        self
    }

    /// Set maximum number of plugins
    pub fn max_plugins(mut self, max: usize) -> Self {
        self.max_plugins = max;
        self
    }

    /// Set default resource limits
    pub fn resource_limits(mut self, limits: ResourceLimits) -> Self {
        self.default_resource_limits = limits;
        self
    }

    /// Enable/disable metrics
    pub fn metrics(mut self, enable: bool) -> Self {
        self.enable_metrics = enable;
        self
    }

    /// Add plugin search path
    pub fn add_plugin_path(mut self, path: alloc::string::String) -> Self {
        self.plugin_paths.push(path);
        self
    }

    /// Build the plugin manager
    pub async fn build(self) -> Result<PluginManager> {
        let manager = PluginManager::new(self).await?;
        Ok(manager)
    }
}

impl Default for PluginManagerBuilder {
    fn default() -> Self {
        Self::new()
    }
}

/// Main plugin manager
#[derive(Debug)]
pub struct PluginManager {
    /// Plugin contexts
    plugins: alloc::collections::BTreeMap<PluginId, PluginContext>,
    /// Plugin loader
    loader: PluginLoader,
    /// Plugin registry
    registry: Option<PluginRegistry>,
    /// Security manager
    security_manager: SecurityManager,
    /// Configuration
    config: PluginManagerConfig,
    /// Statistics
    stats: PluginStats,
}

#[derive(Debug)]
struct PluginManagerConfig {
    enable_sandbox: bool,
    enable_hot_reload: bool,
    max_plugins: usize,
    default_resource_limits: ResourceLimits,
    enable_metrics: bool,
    plugin_paths: alloc::vec::Vec<alloc::string::String>,
}

impl PluginManager {
    /// Create a new plugin manager
    async fn new(builder: PluginManagerBuilder) -> Result<Self> {
        let loader = PluginLoader::new(builder.enable_sandbox);
        let registry = if let Some(endpoint) = builder.registry_endpoint {
            Some(PluginRegistry::new(endpoint))
        } else {
            None
        };
        let security_manager = SecurityManager::new();

        let config = PluginManagerConfig {
            enable_sandbox: builder.enable_sandbox,
            enable_hot_reload: builder.enable_hot_reload,
            max_plugins: builder.max_plugins,
            default_resource_limits: builder.default_resource_limits,
            enable_metrics: builder.enable_metrics,
            plugin_paths: builder.plugin_paths,
        };

        Ok(Self {
            plugins: alloc::collections::BTreeMap::new(),
            loader,
            registry,
            security_manager,
            config,
            stats: PluginStats::default(),
        })
    }

    /// Load a plugin from path
    pub async fn load_plugin(&mut self, path: &str) -> Result<PluginId> {
        // Check plugin limit
        if self.plugins.len() >= self.config.max_plugins {
            return Err(PluginError::MaxPluginsExceeded {
                current: self.plugins.len(),
                max: self.config.max_plugins,
            });
        }

        // Load plugin
        let context = self.loader.load_plugin(path, &self.config.default_resource_limits).await?;

        let plugin_id = context.metadata.id.clone();

        // Check if already loaded
        if self.plugins.contains_key(&plugin_id) {
            return Err(PluginError::AlreadyLoaded { id: plugin_id });
        }

        self.plugins.insert(plugin_id.clone(), context);
        self.stats.plugins_loaded += 1;

        Ok(plugin_id)
    }

    /// Unload a plugin
    pub async fn unload_plugin(&mut self, plugin_id: &PluginId) -> Result<bool> {
        if let Some(context) = self.plugins.remove(plugin_id) {
            self.loader.unload_plugin(&context).await?;
            self.stats.plugins_unloaded += 1;
            Ok(true)
        } else {
            Ok(false)
        }
    }

    /// Execute a plugin function
    pub async fn execute_plugin(
        &self,
        plugin_id: &PluginId,
        function: &str,
        input: &[u8],
    ) -> Result<PluginResult> {
        let context = self.plugins.get(plugin_id)
            .ok_or_else(|| PluginError::PluginNotFound { id: plugin_id.clone() })?;

        // Check security permissions
        self.security_manager.check_execution(context, function)?;

        // Execute plugin
        let result = self.loader.execute_plugin(context, function, input).await?;

        // Update statistics
        if self.config.enable_metrics {
            self.stats.total_executions += 1;
            if result.success {
                self.stats.successful_executions += 1;
            } else {
                self.stats.failed_executions += 1;
            }
        }

        Ok(result)
    }

    /// Get plugin metadata
    pub fn get_plugin_metadata(&self, plugin_id: &PluginId) -> Option<&PluginMetadata> {
        self.plugins.get(plugin_id).map(|ctx| &ctx.metadata)
    }

    /// List all loaded plugins
    pub fn list_plugins(&self) -> alloc::vec::Vec<&PluginId> {
        self.plugins.keys().collect()
    }

    /// Get plugin statistics
    pub fn stats(&self) -> &PluginStats {
        &self.stats
    }
}

/// Plugin statistics
#[derive(Debug, Clone, Default)]
pub struct PluginStats {
    /// Total plugins loaded
    pub plugins_loaded: u64,
    /// Total plugins unloaded
    pub plugins_unloaded: u64,
    /// Total executions
    pub total_executions: u64,
    /// Successful executions
    pub successful_executions: u64,
    /// Failed executions
    pub failed_executions: u64,
    /// Total execution time
    pub total_execution_time: u64,
    /// Average execution time
    pub avg_execution_time: f64,
}

impl PluginStats {
    /// Update average execution time
    pub fn update_average(&mut self) {
        if self.total_executions > 0 {
            self.avg_execution_time = self.total_execution_time as f64 / self.total_executions as f64;
        }
    }

    /// Calculate success rate
    pub fn success_rate(&self) -> f64 {
        if self.total_executions == 0 {
            0.0
        } else {
            self.successful_executions as f64 / self.total_executions as f64
        }
    }
}

// Placeholder implementations (would be implemented in separate modules)
#[derive(Debug)]
struct PluginLoader;
impl PluginLoader {
    fn new(_sandbox: bool) -> Self { Self }
    async fn load_plugin(&self, _path: &str, _limits: &ResourceLimits) -> Result<PluginContext> {
        // Implementation would load actual plugin
        Err(PluginError::LoadFailed {
            path: _path.into(),
            reason: "not implemented".into(),
        })
    }
    async fn unload_plugin(&self, _context: &PluginContext) -> Result<()> {
        Ok(())
    }
    async fn execute_plugin(&self, _context: &PluginContext, _function: &str, _input: &[u8]) -> Result<PluginResult> {
        Err(PluginError::ExecutionFailed {
            plugin_id: "test".into(),
            function: _function.into(),
            reason: "not implemented".into(),
        })
    }
}

#[derive(Debug)]
struct PluginRegistry {
    endpoint: alloc::string::String,
}
impl PluginRegistry {
    fn new(endpoint: alloc::string::String) -> Self { Self { endpoint } }
}

#[derive(Debug)]
struct SecurityManager;
impl SecurityManager {
    fn new() -> Self { Self }
    fn check_execution(&self, _context: &PluginContext, _function: &str) -> Result<()> {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_plugin_version() {
        let version = PluginVersion::new(1, 2, 3);
        assert_eq!(version.major, 1);
        assert_eq!(version.minor, 2);
        assert_eq!(version.patch, 3);
        assert_eq!(version.to_string(), "1.2.3");

        let parsed = PluginVersion::parse("1.2.3").unwrap();
        assert_eq!(parsed, version);
    }

    #[test]
    fn test_resource_limits() {
        let limits = ResourceLimits::default();
        assert!(limits.max_memory > 0);
        assert!(limits.max_execution_time > 0);
    }

    #[test]
    fn test_plugin_stats() {
        let mut stats = PluginStats::default();
        stats.total_executions = 10;
        stats.successful_executions = 8;
        stats.total_execution_time = 1000;

        stats.update_average();
        assert_eq!(stats.avg_execution_time, 100.0);
        assert_eq!(stats.success_rate(), 0.8);
    }

    #[test]
    fn test_plugin_manager_builder() {
        let builder = PluginManagerBuilder::new()
            .with_sandbox(true)
            .max_plugins(50)
            .metrics(false);

        assert!(builder.enable_sandbox);
        assert_eq!(builder.max_plugins, 50);
        assert!(!builder.enable_metrics);
    }
}
