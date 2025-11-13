//! Cache operation errors and handling

use core::fmt;

/// Cache operation errors
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CacheError {
    /// Key not found in cache
    KeyNotFound {
        key: alloc::string::String,
    },

    /// Cache operation failed
    OperationFailed {
        operation: &'static str,
        details: alloc::string::String,
    },

    /// Serialization/deserialization error
    SerializationError {
        format: &'static str,
        details: alloc::string::String,
    },

    /// Cache backend error
    BackendError {
        backend: &'static str,
        details: alloc::string::String,
    },

    /// Cache is full
    CacheFull {
        max_size: usize,
        current_size: usize,
    },

    /// Key too large
    KeyTooLarge {
        size: usize,
        max_size: usize,
    },

    /// Value too large
    ValueTooLarge {
        size: usize,
        max_size: usize,
    },

    /// TTL error
    TtlError {
        details: alloc::string::String,
    },

    /// Consistency error
    ConsistencyError {
        operation: &'static str,
        details: alloc::string::String,
    },

    /// Compression error
    CompressionError {
        operation: &'static str,
        details: alloc::string::String,
    },

    /// Configuration error
    ConfigError {
        parameter: alloc::string::String,
        details: alloc::string::String,
    },

    /// Connection error (for distributed cache)
    ConnectionError {
        endpoint: alloc::string::String,
        details: alloc::string::String,
    },

    /// Timeout error
    TimeoutError {
        operation: &'static str,
        timeout_ms: u64,
    },

    /// Preloading error
    PreloadError {
        strategy: alloc::string::String,
        details: alloc::string::String,
    },

    /// Metrics error
    MetricsError {
        operation: &'static str,
        details: alloc::string::String,
    },

    /// Initialization failed
    InitializationFailed {
        component: &'static str,
        reason: &'static str,
    },
}

impl fmt::Display for CacheError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            CacheError::KeyNotFound { key } => {
                write!(f, "Cache key not found: {}", key)
            }
            CacheError::OperationFailed { operation, details } => {
                write!(f, "Cache operation '{}' failed: {}", operation, details)
            }
            CacheError::SerializationError { format, details } => {
                write!(f, "Serialization error for format '{}': {}", format, details)
            }
            CacheError::BackendError { backend, details } => {
                write!(f, "Cache backend '{}' error: {}", backend, details)
            }
            CacheError::CacheFull { max_size, current_size } => {
                write!(f, "Cache is full: {} / {} entries", current_size, max_size)
            }
            CacheError::KeyTooLarge { size, max_size } => {
                write!(f, "Key too large: {} bytes (max {})", size, max_size)
            }
            CacheError::ValueTooLarge { size, max_size } => {
                write!(f, "Value too large: {} bytes (max {})", size, max_size)
            }
            CacheError::TtlError { details } => {
                write!(f, "TTL error: {}", details)
            }
            CacheError::ConsistencyError { operation, details } => {
                write!(f, "Consistency error in '{}': {}", operation, details)
            }
            CacheError::CompressionError { operation, details } => {
                write!(f, "Compression error in '{}': {}", operation, details)
            }
            CacheError::ConfigError { parameter, details } => {
                write!(f, "Configuration error for '{}': {}", parameter, details)
            }
            CacheError::ConnectionError { endpoint, details } => {
                write!(f, "Connection error for '{}': {}", endpoint, details)
            }
            CacheError::TimeoutError { operation, timeout_ms } => {
                write!(f, "Operation '{}' timed out after {}ms", operation, timeout_ms)
            }
            CacheError::PreloadError { strategy, details } => {
                write!(f, "Preload error for strategy '{}': {}", strategy, details)
            }
            CacheError::MetricsError { operation, details } => {
                write!(f, "Metrics error in '{}': {}", operation, details)
            }
            CacheError::InitializationFailed { component, reason } => {
                write!(f, "Initialization failed for '{}': {}", component, reason)
            }
        }
    }
}

#[cfg(feature = "std")]
impl std::error::Error for CacheError {}

/// Result type alias for Cache operations
pub type Result<T> = core::result::Result<T, CacheError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_display() {
        let error = CacheError::KeyNotFound {
            key: "test_key".into(),
        };
        let display = format!("{}", error);
        assert!(display.contains("Cache key not found"));
        assert!(display.contains("test_key"));
    }

    #[test]
    fn test_error_clone() {
        let error = CacheError::OperationFailed {
            operation: "get",
            details: "connection lost".into(),
        };
        let cloned = error.clone();
        assert_eq!(error, cloned);
    }
}
