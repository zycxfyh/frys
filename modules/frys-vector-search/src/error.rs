//! Vector search errors and handling

use core::fmt;

/// Vector search operation errors
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum VectorSearchError {
    /// Vector not found
    VectorNotFound {
        id: alloc::string::String,
    },

    /// Invalid vector dimensions
    InvalidDimensions {
        expected: usize,
        actual: usize,
    },

    /// Index operation failed
    IndexError {
        operation: alloc::string::String,
        reason: alloc::string::String,
    },

    /// Search operation failed
    SearchError {
        operation: alloc::string::String,
        reason: alloc::string::String,
    },

    /// Algorithm not supported
    AlgorithmNotSupported {
        algorithm: alloc::string::String,
    },

    /// Metric not supported
    MetricNotSupported {
        metric: alloc::string::String,
    },

    /// Storage operation failed
    StorageError {
        operation: alloc::string::String,
        reason: alloc::string::String,
    },

    /// Configuration error
    ConfigError {
        parameter: alloc::string::String,
        reason: alloc::string::String,
    },

    /// Resource limit exceeded
    ResourceLimitExceeded {
        resource: alloc::string::String,
        limit: alloc::string::String,
        actual: alloc::string::String,
    },

    /// Network communication error
    NetworkError {
        operation: alloc::string::String,
        reason: alloc::string::String,
    },

    /// GPU acceleration error
    GpuError {
        operation: alloc::string::String,
        reason: alloc::string::String,
    },

    /// Quantization error
    QuantizationError {
        operation: alloc::string::String,
        reason: alloc::string::String,
    },

    /// Persistence error
    PersistenceError {
        operation: alloc::string::String,
        reason: alloc::string::String,
    },

    /// Monitoring error
    MonitoringError {
        operation: alloc::string::String,
        reason: alloc::string::String,
    },

    /// Initialization failed
    InitializationFailed {
        component: alloc::string::String,
        reason: alloc::string::String,
    },

    /// Batch operation failed
    BatchError {
        operation: alloc::string::String,
        failed_count: usize,
        total_count: usize,
        reason: alloc::string::String,
    },

    /// Concurrency error
    ConcurrencyError {
        operation: alloc::string::String,
        reason: alloc::string::String,
    },

    /// Memory allocation failed
    MemoryError {
        requested: usize,
        available: usize,
    },
}

impl fmt::Display for VectorSearchError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            VectorSearchError::VectorNotFound { id } => {
                write!(f, "Vector not found: {}", id)
            }
            VectorSearchError::InvalidDimensions { expected, actual } => {
                write!(f, "Invalid vector dimensions: expected {}, got {}", expected, actual)
            }
            VectorSearchError::IndexError { operation, reason } => {
                write!(f, "Index error in '{}': {}", operation, reason)
            }
            VectorSearchError::SearchError { operation, reason } => {
                write!(f, "Search error in '{}': {}", operation, reason)
            }
            VectorSearchError::AlgorithmNotSupported { algorithm } => {
                write!(f, "Algorithm not supported: {}", algorithm)
            }
            VectorSearchError::MetricNotSupported { metric } => {
                write!(f, "Metric not supported: {}", metric)
            }
            VectorSearchError::StorageError { operation, reason } => {
                write!(f, "Storage error in '{}': {}", operation, reason)
            }
            VectorSearchError::ConfigError { parameter, reason } => {
                write!(f, "Configuration error for '{}': {}", parameter, reason)
            }
            VectorSearchError::ResourceLimitExceeded { resource, limit, actual } => {
                write!(f, "Resource '{}' limit exceeded: {} > {}", resource, actual, limit)
            }
            VectorSearchError::NetworkError { operation, reason } => {
                write!(f, "Network error in '{}': {}", operation, reason)
            }
            VectorSearchError::GpuError { operation, reason } => {
                write!(f, "GPU error in '{}': {}", operation, reason)
            }
            VectorSearchError::QuantizationError { operation, reason } => {
                write!(f, "Quantization error in '{}': {}", operation, reason)
            }
            VectorSearchError::PersistenceError { operation, reason } => {
                write!(f, "Persistence error in '{}': {}", operation, reason)
            }
            VectorSearchError::MonitoringError { operation, reason } => {
                write!(f, "Monitoring error in '{}': {}", operation, reason)
            }
            VectorSearchError::InitializationFailed { component, reason } => {
                write!(f, "Initialization failed for '{}': {}", component, reason)
            }
            VectorSearchError::BatchError { operation, failed_count, total_count, reason } => {
                write!(f, "Batch error in '{}': {}/{} failed - {}", operation, failed_count, total_count, reason)
            }
            VectorSearchError::ConcurrencyError { operation, reason } => {
                write!(f, "Concurrency error in '{}': {}", operation, reason)
            }
            VectorSearchError::MemoryError { requested, available } => {
                write!(f, "Memory allocation failed: requested {} bytes, available {} bytes", requested, available)
            }
        }
    }
}

#[cfg(feature = "std")]
impl std::error::Error for VectorSearchError {}

/// Result type alias for Vector Search operations
pub type Result<T> = core::result::Result<T, VectorSearchError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_display() {
        let error = VectorSearchError::VectorNotFound {
            id: "vec-123".into(),
        };
        let display = format!("{}", error);
        assert!(display.contains("Vector not found"));
        assert!(display.contains("vec-123"));
    }

    #[test]
    fn test_error_clone() {
        let error = VectorSearchError::InvalidDimensions {
            expected: 768,
            actual: 512,
        };
        let cloned = error.clone();
        assert_eq!(error, cloned);
    }
}
