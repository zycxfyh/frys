//! Error types for storage plugin

use alloc::string::String;

/// Storage plugin error types
#[derive(Debug)]
pub enum StoragePluginError {
    /// Backend not supported
    BackendNotSupported,
    /// Backend not available
    BackendNotAvailable,
    /// Key not found
    KeyNotFound(String),
    /// Storage full
    StorageFull,
    /// I/O error
    IoError(String),
    /// Serialization error
    SerializationError(String),
    /// Encryption error
    EncryptionError(String),
    /// Compression error
    CompressionError(String),
    /// Network error
    NetworkError(String),
    /// Authentication error
    AuthenticationError(String),
    /// Configuration error
    InvalidConfiguration(String),
    /// Feature not enabled
    FeatureNotEnabled(String),
}

impl core::fmt::Display for StoragePluginError {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        match self {
            StoragePluginError::BackendNotSupported => write!(f, "Backend not supported"),
            StoragePluginError::BackendNotAvailable => write!(f, "Backend not available"),
            StoragePluginError::KeyNotFound(key) => write!(f, "Key not found: {}", key),
            StoragePluginError::StorageFull => write!(f, "Storage full"),
            StoragePluginError::IoError(msg) => write!(f, "I/O error: {}", msg),
            StoragePluginError::SerializationError(msg) => write!(f, "Serialization error: {}", msg),
            StoragePluginError::EncryptionError(msg) => write!(f, "Encryption error: {}", msg),
            StoragePluginError::CompressionError(msg) => write!(f, "Compression error: {}", msg),
            StoragePluginError::NetworkError(msg) => write!(f, "Network error: {}", msg),
            StoragePluginError::AuthenticationError(msg) => write!(f, "Authentication error: {}", msg),
            StoragePluginError::InvalidConfiguration(msg) => write!(f, "Invalid configuration: {}", msg),
            StoragePluginError::FeatureNotEnabled(feature) => write!(f, "Feature not enabled: {}", feature),
        }
    }
}

#[cfg(feature = "std")]
impl std::error::Error for StoragePluginError {}

/// Result type alias for storage plugin operations
#[cfg(feature = "std")]
pub type Result<T> = std::result::Result<T, StoragePluginError>;
#[cfg(not(feature = "std"))]
pub type Result<T> = core::result::Result<T, StoragePluginError>;
