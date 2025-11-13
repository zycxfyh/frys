//! AI System error types

/// AI System error types
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AIError {
    /// Configuration error
    ConfigurationError {
        field: alloc::string::String,
        reason: alloc::string::String,
    },

    /// Provider error
    ProviderError {
        provider: alloc::string::String,
        reason: alloc::string::String,
    },

    /// Model error
    ModelError {
        model: alloc::string::String,
        reason: alloc::string::String,
    },

    /// Inference error
    InferenceError {
        reason: alloc::string::String,
    },

    /// Network error
    NetworkError {
        reason: alloc::string::String,
    },

    /// Timeout error
    TimeoutError {
        operation: alloc::string::String,
        timeout_ms: u64,
    },

    /// Rate limit exceeded
    RateLimitExceeded {
        provider: alloc::string::String,
        retry_after_seconds: u64,
    },

    /// Authentication error
    AuthenticationError {
        provider: alloc::string::String,
    },

    /// Quota exceeded
    QuotaExceeded {
        provider: alloc::string::String,
        retry_after_seconds: u64,
    },

    /// Invalid input
    InvalidInput {
        field: alloc::string::String,
        reason: alloc::string::String,
    },

    /// Unsupported operation
    UnsupportedOperation {
        operation: alloc::string::String,
        reason: alloc::string::String,
    },

    /// Cache error
    CacheError {
        reason: alloc::string::String,
    },

    /// Serialization error
    SerializationError {
        reason: alloc::string::String,
    },

    /// Internal error
    InternalError {
        component: alloc::string::String,
        reason: alloc::string::String,
    },
}

impl core::fmt::Display for AIError {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        match self {
            AIError::ConfigurationError { field, reason } => {
                write!(f, "Configuration error in {}: {}", field, reason)
            }
            AIError::ProviderError { provider, reason } => {
                write!(f, "Provider {} error: {}", provider, reason)
            }
            AIError::ModelError { model, reason } => {
                write!(f, "Model {} error: {}", model, reason)
            }
            AIError::InferenceError { reason } => {
                write!(f, "Inference error: {}", reason)
            }
            AIError::NetworkError { reason } => {
                write!(f, "Network error: {}", reason)
            }
            AIError::TimeoutError { operation, timeout_ms } => {
                write!(f, "Timeout error in {} after {}ms", operation, timeout_ms)
            }
            AIError::RateLimitExceeded { provider, retry_after_seconds } => {
                write!(f, "Rate limit exceeded for provider {}, retry after {} seconds", provider, retry_after_seconds)
            }
            AIError::AuthenticationError { provider } => {
                write!(f, "Authentication error for provider {}", provider)
            }
            AIError::QuotaExceeded { provider, retry_after_seconds } => {
                write!(f, "Quota exceeded for provider {}, retry after {} seconds", provider, retry_after_seconds)
            }
            AIError::InvalidInput { field, reason } => {
                write!(f, "Invalid input in {}: {}", field, reason)
            }
            AIError::UnsupportedOperation { operation, reason } => {
                write!(f, "Unsupported operation {}: {}", operation, reason)
            }
            AIError::CacheError { reason } => {
                write!(f, "Cache error: {}", reason)
            }
            AIError::SerializationError { reason } => {
                write!(f, "Serialization error: {}", reason)
            }
            AIError::InternalError { component, reason } => {
                write!(f, "Internal error in {}: {}", component, reason)
            }
        }
    }
}

#[cfg(feature = "std")]
impl std::error::Error for AIError {}
