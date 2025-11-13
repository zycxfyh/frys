//! Error types for AI plugin

use alloc::string::String;

/// AI plugin error types
#[derive(Debug)]
pub enum AIPluginError {
    /// Model not found
    ModelNotFound(String),
    /// Invalid model format or structure
    InvalidModel(String),
    /// Input validation error
    InvalidInput(String),
    /// Feature not enabled in build
    FeatureNotEnabled(String),
    /// Resource limit exceeded
    ResourceLimitExceeded,
    /// Inference timeout
    InferenceTimeout,
    /// Training error
    TrainingError(String),
    /// Serialization/deserialization error
    SerializationError(String),
    /// Backend-specific error
    BackendError(String),
    /// Configuration error
    InvalidConfiguration(String),
}

impl core::fmt::Display for AIPluginError {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        match self {
            AIPluginError::ModelNotFound(name) => write!(f, "Model not found: {}", name),
            AIPluginError::InvalidModel(msg) => write!(f, "Invalid model: {}", msg),
            AIPluginError::InvalidInput(msg) => write!(f, "Invalid input: {}", msg),
            AIPluginError::FeatureNotEnabled(feature) => write!(f, "Feature not enabled: {}", feature),
            AIPluginError::ResourceLimitExceeded => write!(f, "Resource limit exceeded"),
            AIPluginError::InferenceTimeout => write!(f, "Inference timeout"),
            AIPluginError::TrainingError(msg) => write!(f, "Training error: {}", msg),
            AIPluginError::SerializationError(msg) => write!(f, "Serialization error: {}", msg),
            AIPluginError::BackendError(msg) => write!(f, "Backend error: {}", msg),
            AIPluginError::InvalidConfiguration(msg) => write!(f, "Invalid configuration: {}", msg),
        }
    }
}

#[cfg(feature = "std")]
impl std::error::Error for AIPluginError {}

/// Result type alias for AI plugin operations
#[cfg(feature = "std")]
pub type Result<T> = std::result::Result<T, AIPluginError>;

/// Result type alias for no_std environments
#[cfg(not(feature = "std"))]
pub type Result<T> = core::result::Result<T, AIPluginError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_display() {
        let error = AIPluginError::ModelNotFound("test_model".to_string());
        assert!(format!("{}", error).contains("Model not found"));

        let error2 = AIPluginError::ResourceLimitExceeded;
        assert_eq!(format!("{}", error2), "Resource limit exceeded");
    }
}
