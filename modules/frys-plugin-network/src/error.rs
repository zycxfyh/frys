//! Error types for network plugin

use alloc::string::String;

/// Network plugin error types
#[derive(Debug)]
pub enum NetworkPluginError {
    /// Connection failed
    ConnectionFailed(String),
    /// Timeout error
    Timeout(String),
    /// Authentication failed
    AuthenticationFailed(String),
    /// Authorization failed
    AuthorizationFailed(String),
    /// Invalid request
    InvalidRequest(String),
    /// Invalid response
    InvalidResponse(String),
    /// Network unreachable
    NetworkUnreachable(String),
    /// TLS error
    TlsError(String),
    /// Rate limit exceeded
    RateLimitExceeded,
    /// Circuit breaker open
    CircuitBreakerOpen(String),
    /// Service unavailable
    ServiceUnavailable(String),
    /// Configuration error
    InvalidConfiguration(String),
    /// Feature not enabled
    FeatureNotEnabled(String),
    /// Protocol error
    ProtocolError(String),
    /// Encoding/decoding error
    CodecError(String),
}

impl core::fmt::Display for NetworkPluginError {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        match self {
            NetworkPluginError::ConnectionFailed(msg) => write!(f, "Connection failed: {}", msg),
            NetworkPluginError::Timeout(msg) => write!(f, "Timeout: {}", msg),
            NetworkPluginError::AuthenticationFailed(msg) => write!(f, "Authentication failed: {}", msg),
            NetworkPluginError::AuthorizationFailed(msg) => write!(f, "Authorization failed: {}", msg),
            NetworkPluginError::InvalidRequest(msg) => write!(f, "Invalid request: {}", msg),
            NetworkPluginError::InvalidResponse(msg) => write!(f, "Invalid response: {}", msg),
            NetworkPluginError::NetworkUnreachable(msg) => write!(f, "Network unreachable: {}", msg),
            NetworkPluginError::TlsError(msg) => write!(f, "TLS error: {}", msg),
            NetworkPluginError::RateLimitExceeded => write!(f, "Rate limit exceeded"),
            NetworkPluginError::CircuitBreakerOpen(msg) => write!(f, "Circuit breaker open: {}", msg),
            NetworkPluginError::ServiceUnavailable(msg) => write!(f, "Service unavailable: {}", msg),
            NetworkPluginError::InvalidConfiguration(msg) => write!(f, "Invalid configuration: {}", msg),
            NetworkPluginError::FeatureNotEnabled(feature) => write!(f, "Feature not enabled: {}", feature),
            NetworkPluginError::ProtocolError(msg) => write!(f, "Protocol error: {}", msg),
            NetworkPluginError::CodecError(msg) => write!(f, "Codec error: {}", msg),
        }
    }
}

#[cfg(feature = "std")]
impl std::error::Error for NetworkPluginError {}

/// Result type alias for network plugin operations
#[cfg(feature = "std")]
pub type Result<T> = std::result::Result<T, NetworkPluginError>;
#[cfg(not(feature = "std"))]
pub type Result<T> = core::result::Result<T, NetworkPluginError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_display() {
        let error = NetworkPluginError::ConnectionFailed("connection refused".to_string());
        assert!(format!("{}", error).contains("Connection failed"));

        let error2 = NetworkPluginError::RateLimitExceeded;
        assert_eq!(format!("{}", error2), "Rate limit exceeded");
    }
}
