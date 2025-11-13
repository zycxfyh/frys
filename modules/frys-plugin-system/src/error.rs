//! Plugin system errors and handling

use core::fmt;

/// Plugin operation errors
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PluginError {
    /// Plugin not found
    PluginNotFound {
        id: alloc::string::String,
    },

    /// Plugin load failed
    LoadFailed {
        path: alloc::string::String,
        reason: alloc::string::String,
    },

    /// Plugin execution failed
    ExecutionFailed {
        plugin_id: alloc::string::String,
        function: alloc::string::String,
        reason: alloc::string::String,
    },

    /// Plugin timeout
    Timeout {
        plugin_id: alloc::string::String,
        timeout_ms: u64,
    },

    /// Security violation
    SecurityViolation {
        plugin_id: alloc::string::String,
        violation: alloc::string::String,
    },

    /// Resource limit exceeded
    ResourceLimitExceeded {
        plugin_id: alloc::string::String,
        resource: alloc::string::String,
        limit: alloc::string::String,
        actual: alloc::string::String,
    },

    /// Plugin incompatible
    Incompatible {
        plugin_id: alloc::string::String,
        required_version: alloc::string::String,
        current_version: alloc::string::String,
    },

    /// Sandbox error
    SandboxError {
        plugin_id: alloc::string::String,
        reason: alloc::string::String,
    },

    /// Registry error
    RegistryError {
        endpoint: alloc::string::String,
        reason: alloc::string::String,
    },

    /// Dependency error
    DependencyError {
        plugin_id: alloc::string::String,
        dependency: alloc::string::String,
        reason: alloc::string::String,
    },

    /// Communication error
    CommunicationError {
        from_plugin: alloc::string::String,
        to_plugin: alloc::string::String,
        reason: alloc::string::String,
    },

    /// Configuration error
    ConfigError {
        parameter: alloc::string::String,
        reason: alloc::string::String,
    },

    /// Plugin already loaded
    AlreadyLoaded {
        id: alloc::string::String,
    },

    /// Maximum plugins exceeded
    MaxPluginsExceeded {
        current: usize,
        max: usize,
    },

    /// Invalid plugin format
    InvalidFormat {
        path: alloc::string::String,
        expected: alloc::string::String,
        found: alloc::string::String,
    },

    /// Plugin initialization failed
    InitializationFailed {
        plugin_id: alloc::string::String,
        reason: alloc::string::String,
    },
}

impl fmt::Display for PluginError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            PluginError::PluginNotFound { id } => {
                write!(f, "Plugin not found: {}", id)
            }
            PluginError::LoadFailed { path, reason } => {
                write!(f, "Failed to load plugin '{}': {}", path, reason)
            }
            PluginError::ExecutionFailed { plugin_id, function, reason } => {
                write!(f, "Plugin '{}' execution failed in '{}': {}", plugin_id, function, reason)
            }
            PluginError::Timeout { plugin_id, timeout_ms } => {
                write!(f, "Plugin '{}' timed out after {}ms", plugin_id, timeout_ms)
            }
            PluginError::SecurityViolation { plugin_id, violation } => {
                write!(f, "Security violation in plugin '{}': {}", plugin_id, violation)
            }
            PluginError::ResourceLimitExceeded { plugin_id, resource, limit, actual } => {
                write!(f, "Plugin '{}' exceeded {} limit: {} > {}", plugin_id, resource, actual, limit)
            }
            PluginError::Incompatible { plugin_id, required_version, current_version } => {
                write!(f, "Plugin '{}' incompatible: requires {}, found {}", plugin_id, required_version, current_version)
            }
            PluginError::SandboxError { plugin_id, reason } => {
                write!(f, "Sandbox error in plugin '{}': {}", plugin_id, reason)
            }
            PluginError::RegistryError { endpoint, reason } => {
                write!(f, "Registry error for '{}': {}", endpoint, reason)
            }
            PluginError::DependencyError { plugin_id, dependency, reason } => {
                write!(f, "Dependency error in plugin '{}' for '{}': {}", plugin_id, dependency, reason)
            }
            PluginError::CommunicationError { from_plugin, to_plugin, reason } => {
                write!(f, "Communication error {} -> {}: {}", from_plugin, to_plugin, reason)
            }
            PluginError::ConfigError { parameter, reason } => {
                write!(f, "Configuration error for '{}': {}", parameter, reason)
            }
            PluginError::AlreadyLoaded { id } => {
                write!(f, "Plugin already loaded: {}", id)
            }
            PluginError::MaxPluginsExceeded { current, max } => {
                write!(f, "Maximum plugins exceeded: {} / {}", current, max)
            }
            PluginError::InvalidFormat { path, expected, found } => {
                write!(f, "Invalid plugin format for '{}': expected {}, found {}", path, expected, found)
            }
            PluginError::InitializationFailed { plugin_id, reason } => {
                write!(f, "Plugin '{}' initialization failed: {}", plugin_id, reason)
            }
        }
    }
}

#[cfg(feature = "std")]
impl std::error::Error for PluginError {}

/// Result type alias for Plugin operations
pub type Result<T> = core::result::Result<T, PluginError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_display() {
        let error = PluginError::PluginNotFound {
            id: "test-plugin".into(),
        };
        let display = format!("{}", error);
        assert!(display.contains("Plugin not found"));
        assert!(display.contains("test-plugin"));
    }

    #[test]
    fn test_error_clone() {
        let error = PluginError::LoadFailed {
            path: "/path/to/plugin.wasm".into(),
            reason: "file not found".into(),
        };
        let cloned = error.clone();
        assert_eq!(error, cloned);
    }
}
