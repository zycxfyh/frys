//! Configuration error types and handling

use core::fmt;

/// Configuration operation errors
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ConfigError {
    /// Configuration file not found
    FileNotFound {
        path: alloc::string::String,
    },

    /// Configuration file read error
    FileReadError {
        path: alloc::string::String,
        details: alloc::string::String,
    },

    /// Configuration parsing error
    ParseError {
        format: &'static str,
        details: alloc::string::String,
    },

    /// Configuration validation error
    ValidationError {
        field: alloc::string::String,
        expected: alloc::string::String,
        actual: alloc::string::String,
    },

    /// Configuration key not found
    KeyNotFound {
        key: alloc::string::String,
    },

    /// Type conversion error
    TypeError {
        key: alloc::string::String,
        expected_type: &'static str,
        actual_type: &'static str,
    },

    /// Configuration merge conflict
    MergeConflict {
        key: alloc::string::String,
        source1: alloc::string::String,
        source2: alloc::string::String,
    },

    /// Hot reload error
    HotReloadError {
        operation: &'static str,
        details: alloc::string::String,
    },

    /// Migration error
    MigrationError {
        from_version: alloc::string::String,
        to_version: alloc::string::String,
        details: alloc::string::String,
    },

    /// Provider error
    ProviderError {
        provider: &'static str,
        details: alloc::string::String,
    },

    /// Configuration too large
    ConfigTooLarge {
        size: usize,
        max_size: usize,
    },

    /// Nesting depth exceeded
    NestingTooDeep {
        depth: usize,
        max_depth: usize,
    },

    /// Invalid configuration format
    InvalidFormat {
        format: alloc::string::String,
        reason: alloc::string::String,
    },

    /// Environment variable error
    EnvError {
        variable: alloc::string::String,
        details: alloc::string::String,
    },

    /// Remote configuration error
    RemoteConfigError {
        endpoint: alloc::string::String,
        details: alloc::string::String,
    },

    /// Configuration version mismatch
    VersionMismatch {
        expected: alloc::string::String,
        actual: alloc::string::String,
    },

    /// Configuration initialization failed
    InitializationFailed {
        component: &'static str,
        reason: &'static str,
    },
}

impl fmt::Display for ConfigError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ConfigError::FileNotFound { path } => {
                write!(f, "Configuration file not found: {}", path)
            }
            ConfigError::FileReadError { path, details } => {
                write!(f, "Failed to read config file '{}': {}", path, details)
            }
            ConfigError::ParseError { format, details } => {
                write!(f, "Failed to parse {} config: {}", format, details)
            }
            ConfigError::ValidationError { field, expected, actual } => {
                write!(f, "Validation error for '{}': expected {}, got {}", field, expected, actual)
            }
            ConfigError::KeyNotFound { key } => {
                write!(f, "Configuration key not found: {}", key)
            }
            ConfigError::TypeError { key, expected_type, actual_type } => {
                write!(f, "Type error for '{}': expected {}, got {}", key, expected_type, actual_type)
            }
            ConfigError::MergeConflict { key, source1, source2 } => {
                write!(f, "Merge conflict for key '{}': {} vs {}", key, source1, source2)
            }
            ConfigError::HotReloadError { operation, details } => {
                write!(f, "Hot reload error in '{}': {}", operation, details)
            }
            ConfigError::MigrationError { from_version, to_version, details } => {
                write!(f, "Migration error {} -> {}: {}", from_version, to_version, details)
            }
            ConfigError::ProviderError { provider, details } => {
                write!(f, "Provider '{}' error: {}", provider, details)
            }
            ConfigError::ConfigTooLarge { size, max_size } => {
                write!(f, "Configuration too large: {} bytes (max {})", size, max_size)
            }
            ConfigError::NestingTooDeep { depth, max_depth } => {
                write!(f, "Configuration nesting too deep: {} levels (max {})", depth, max_depth)
            }
            ConfigError::InvalidFormat { format, reason } => {
                write!(f, "Invalid {} format: {}", format, reason)
            }
            ConfigError::EnvError { variable, details } => {
                write!(f, "Environment variable '{}' error: {}", variable, details)
            }
            ConfigError::RemoteConfigError { endpoint, details } => {
                write!(f, "Remote config error for '{}': {}", endpoint, details)
            }
            ConfigError::VersionMismatch { expected, actual } => {
                write!(f, "Version mismatch: expected {}, got {}", expected, actual)
            }
            ConfigError::InitializationFailed { component, reason } => {
                write!(f, "Initialization failed for '{}': {}", component, reason)
            }
        }
    }
}

#[cfg(feature = "std")]
impl std::error::Error for ConfigError {}

/// Result type alias for Config operations
pub type Result<T> = core::result::Result<T, ConfigError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_display() {
        let error = ConfigError::FileNotFound {
            path: "/path/to/config.json".into(),
        };
        let display = format!("{}", error);
        assert!(display.contains("Configuration file not found"));
        assert!(display.contains("/path/to/config.json"));
    }

    #[test]
    fn test_error_clone() {
        let error = ConfigError::ValidationError {
            field: "port".into(),
            expected: "number".into(),
            actual: "string".into(),
        };
        let cloned = error.clone();
        assert_eq!(error, cloned);
    }
}
