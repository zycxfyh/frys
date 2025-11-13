//! Error types for the Frys Kernel

/// Kernel error types
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum KernelError {
    /// Memory allocation failed
    MemoryAllocationFailed {
        requested: usize,
        available: usize,
    },

    /// Resource limit exceeded
    ResourceLimitExceeded {
        resource: String,
        limit: usize,
        requested: usize,
    },

    /// Initialization failed
    InitializationFailed {
        component: String,
        reason: String,
    },

    /// Shutdown failed
    ShutdownFailed {
        component: String,
        reason: String,
    },

    /// Invalid configuration
    InvalidConfiguration {
        field: String,
        reason: String,
    },

    /// I/O error
    IoError(String),

    /// Network error
    NetworkError(String),

    /// Storage error
    StorageError(String),

    /// Threading error
    ThreadError(String),
}

impl core::fmt::Display for KernelError {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        match self {
            KernelError::MemoryAllocationFailed { requested, available } => {
                write!(f, "Memory allocation failed: requested {} bytes, available {} bytes", requested, available)
            }
            KernelError::ResourceLimitExceeded { resource, limit, requested } => {
                write!(f, "Resource limit exceeded for {}: limit {}, requested {}", resource, limit, requested)
            }
            KernelError::InitializationFailed { component, reason } => {
                write!(f, "Initialization failed for {}: {}", component, reason)
            }
            KernelError::ShutdownFailed { component, reason } => {
                write!(f, "Shutdown failed for {}: {}", component, reason)
            }
            KernelError::InvalidConfiguration { field, reason } => {
                write!(f, "Invalid configuration for {}: {}", field, reason)
            }
            KernelError::IoError(msg) => write!(f, "I/O error: {}", msg),
            KernelError::NetworkError(msg) => write!(f, "Network error: {}", msg),
            KernelError::StorageError(msg) => write!(f, "Storage error: {}", msg),
            KernelError::ThreadError(msg) => write!(f, "Thread error: {}", msg),
        }
    }
}

#[cfg(feature = "std")]
impl std::error::Error for KernelError {}