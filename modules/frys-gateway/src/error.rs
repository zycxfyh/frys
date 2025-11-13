//! Gateway error types and handling

use core::fmt;

/// Gateway operation errors
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum GatewayError {
    /// Configuration error
    ConfigError {
        /// Configuration parameter
        parameter: alloc::string::String,
        /// Error reason
        reason: alloc::string::String,
    },

    /// Route not found
    RouteNotFound {
        /// Request path
        path: alloc::string::String,
        /// Request method
        method: alloc::string::String,
    },

    /// Upstream service error
    UpstreamError {
        /// Upstream URL
        upstream_url: alloc::string::String,
        /// Error type
        error_type: UpstreamErrorType,
        /// Error message
        message: alloc::string::String,
    },

    /// Load balancer error
    LoadBalancerError {
        /// Load balancer type
        lb_type: alloc::string::String,
        /// Error reason
        reason: alloc::string::String,
    },

    /// Middleware error
    MiddlewareError {
        /// Middleware name
        middleware_name: alloc::string::String,
        /// Error message
        message: alloc::string::String,
    },

    /// Rate limiting error
    RateLimitExceeded {
        /// Client identifier
        client_id: alloc::string::String,
        /// Limit type
        limit_type: alloc::string::String,
        /// Retry after seconds
        retry_after_seconds: u64,
    },

    /// Circuit breaker error
    CircuitBreakerOpen {
        /// Upstream URL
        upstream_url: alloc::string::String,
        /// Failure count
        failure_count: u32,
        /// Next retry timestamp
        next_retry_timestamp: u64,
    },

    /// Authentication error
    AuthenticationError {
        /// Authentication scheme
        scheme: alloc::string::String,
        /// Error reason
        reason: alloc::string::String,
    },

    /// Authorization error
    AuthorizationError {
        /// Required permission
        required_permission: alloc::string::String,
        /// User permissions
        user_permissions: alloc::vec::Vec<alloc::string::String>,
    },

    /// TLS/SSL error
    TlsError {
        /// TLS operation
        operation: alloc::string::String,
        /// Error message
        message: alloc::string::String,
    },

    /// Connection error
    ConnectionError {
        /// Target address
        address: alloc::string::String,
        /// Connection phase
        phase: ConnectionPhase,
        /// Error message
        message: alloc::string::String,
    },

    /// Timeout error
    TimeoutError {
        /// Operation that timed out
        operation: alloc::string::String,
        /// Timeout duration in seconds
        timeout_seconds: u64,
    },

    /// Service discovery error
    ServiceDiscoveryError {
        /// Discovery backend
        backend: alloc::string::String,
        /// Operation
        operation: alloc::string::String,
        /// Error message
        message: alloc::string::String,
    },

    /// Health check error
    HealthCheckError {
        /// Upstream URL
        upstream_url: alloc::string::String,
        /// Health check type
        check_type: alloc::string::String,
        /// Error message
        message: alloc::string::String,
    },

    /// Metrics collection error
    MetricsError {
        /// Metrics operation
        operation: alloc::string::String,
        /// Error message
        message: alloc::string::String,
    },

    /// Tracing error
    TracingError {
        /// Tracing operation
        operation: alloc::string::String,
        /// Error message
        message: alloc::string::String,
    },

    /// Request parsing error
    RequestParseError {
        /// Parse operation
        operation: alloc::string::String,
        /// Error message
        message: alloc::string::String,
    },

    /// Response generation error
    ResponseGenerationError {
        /// Response operation
        operation: alloc::string::String,
        /// Error message
        message: alloc::string::String,
    },

    /// Compression error
    CompressionError {
        /// Compression operation
        operation: alloc::string::String,
        /// Error message
        message: alloc::string::String,
    },

    /// Decompression error
    DecompressionError {
        /// Decompression operation
        operation: alloc::string::String,
        /// Error message
        message: alloc::string::String,
    },

    /// Cache error
    CacheError {
        /// Cache operation
        operation: alloc::string::String,
        /// Error message
        message: alloc::string::String,
    },

    /// WebSocket error
    WebSocketError {
        /// WebSocket operation
        operation: alloc::string::String,
        /// Error message
        message: alloc::string::String,
    },

    /// Protocol error
    ProtocolError {
        /// Protocol type
        protocol: alloc::string::String,
        /// Error message
        message: alloc::string::String,
    },

    /// Resource limit exceeded
    ResourceLimitExceeded {
        /// Resource type
        resource: alloc::string::String,
        /// Current usage
        current: alloc::string::String,
        /// Limit
        limit: alloc::string::String,
    },

    /// Initialization error
    InitializationError {
        /// Component being initialized
        component: alloc::string::String,
        /// Error message
        message: alloc::string::String,
    },

    /// Shutdown error
    ShutdownError {
        /// Component being shut down
        component: alloc::string::String,
        /// Error message
        message: alloc::string::String,
    },

    /// Concurrency error
    ConcurrencyError {
        /// Operation
        operation: alloc::string::String,
        /// Error message
        message: alloc::string::String,
    },

    /// Validation error
    ValidationError {
        /// Field being validated
        field: alloc::string::String,
        /// Validation rule
        rule: alloc::string::String,
        /// Provided value
        value: alloc::string::String,
    },

    /// Serialization error
    SerializationError {
        /// Serialization format
        format: alloc::string::String,
        /// Error message
        message: alloc::string::String,
    },

    /// Deserialization error
    DeserializationError {
        /// Deserialization format
        format: alloc::string::String,
        /// Error message
        message: alloc::string::String,
    },

    /// Network error
    NetworkError {
        /// Network operation
        operation: alloc::string::String,
        /// Error message
        message: alloc::string::String,
    },

    /// I/O error
    IoError {
        /// I/O operation
        operation: alloc::string::String,
        /// Error message
        message: alloc::string::String,
    },

    /// System error
    SystemError {
        /// System operation
        operation: alloc::string::String,
        /// Error message
        message: alloc::string::String,
    },

    /// Unknown error
    UnknownError {
        /// Error context
        context: alloc::string::String,
        /// Error message
        message: alloc::string::String,
    },
}

/// Upstream error types
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum UpstreamErrorType {
    /// Connection failed
    ConnectionFailed,
    /// Timeout occurred
    Timeout,
    /// HTTP status error
    HttpStatus { status_code: u16 },
    /// Protocol error
    ProtocolError,
    /// TLS error
    TlsError,
    /// DNS resolution failed
    DnsResolutionFailed,
    /// Service unavailable
    ServiceUnavailable,
    /// Rate limited by upstream
    RateLimited,
    /// Internal server error
    InternalServerError,
    /// Bad gateway
    BadGateway,
    /// Service unavailable
    GatewayTimeout,
    /// Unknown error
    Unknown,
}

/// Connection phases
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ConnectionPhase {
    /// DNS resolution
    DnsResolution,
    /// TCP connection
    TcpConnection,
    /// TLS handshake
    TlsHandshake,
    /// HTTP handshake
    HttpHandshake,
    /// WebSocket upgrade
    WebSocketUpgrade,
    /// Protocol negotiation
    ProtocolNegotiation,
    /// Keep-alive check
    KeepAlive,
}

impl fmt::Display for GatewayError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            GatewayError::ConfigError { parameter, reason } => {
                write!(f, "Configuration error for '{}': {}", parameter, reason)
            }
            GatewayError::RouteNotFound { path, method } => {
                write!(f, "Route not found: {} {}", method, path)
            }
            GatewayError::UpstreamError { upstream_url, error_type, message } => {
                write!(f, "Upstream error [{}]: {} - {}", upstream_url, error_type, message)
            }
            GatewayError::LoadBalancerError { lb_type, reason } => {
                write!(f, "Load balancer '{}' error: {}", lb_type, reason)
            }
            GatewayError::MiddlewareError { middleware_name, message } => {
                write!(f, "Middleware '{}' error: {}", middleware_name, message)
            }
            GatewayError::RateLimitExceeded { client_id, limit_type, retry_after_seconds } => {
                write!(f, "Rate limit exceeded for client '{}' ({}), retry after {} seconds",
                       client_id, limit_type, retry_after_seconds)
            }
            GatewayError::CircuitBreakerOpen { upstream_url, failure_count, next_retry_timestamp } => {
                write!(f, "Circuit breaker open for '{}' ({} failures), next retry at {}",
                       upstream_url, failure_count, next_retry_timestamp)
            }
            GatewayError::AuthenticationError { scheme, reason } => {
                write!(f, "Authentication error ({}): {}", scheme, reason)
            }
            GatewayError::AuthorizationError { required_permission, user_permissions } => {
                write!(f, "Authorization error: required '{}', user has {:?}",
                       required_permission, user_permissions)
            }
            GatewayError::TlsError { operation, message } => {
                write!(f, "TLS error in '{}': {}", operation, message)
            }
            GatewayError::ConnectionError { address, phase, message } => {
                write!(f, "Connection error to '{}' during {:?}: {}", address, phase, message)
            }
            GatewayError::TimeoutError { operation, timeout_seconds } => {
                write!(f, "Timeout error in '{}' after {} seconds", operation, timeout_seconds)
            }
            GatewayError::ServiceDiscoveryError { backend, operation, message } => {
                write!(f, "Service discovery error ({}): {} - {}", backend, operation, message)
            }
            GatewayError::HealthCheckError { upstream_url, check_type, message } => {
                write!(f, "Health check error for '{}' ({}): {}", upstream_url, check_type, message)
            }
            GatewayError::MetricsError { operation, message } => {
                write!(f, "Metrics error in '{}': {}", operation, message)
            }
            GatewayError::TracingError { operation, message } => {
                write!(f, "Tracing error in '{}': {}", operation, message)
            }
            GatewayError::RequestParseError { operation, message } => {
                write!(f, "Request parse error in '{}': {}", operation, message)
            }
            GatewayError::ResponseGenerationError { operation, message } => {
                write!(f, "Response generation error in '{}': {}", operation, message)
            }
            GatewayError::CompressionError { operation, message } => {
                write!(f, "Compression error in '{}': {}", operation, message)
            }
            GatewayError::DecompressionError { operation, message } => {
                write!(f, "Decompression error in '{}': {}", operation, message)
            }
            GatewayError::CacheError { operation, message } => {
                write!(f, "Cache error in '{}': {}", operation, message)
            }
            GatewayError::WebSocketError { operation, message } => {
                write!(f, "WebSocket error in '{}': {}", operation, message)
            }
            GatewayError::ProtocolError { protocol, message } => {
                write!(f, "Protocol '{}' error: {}", protocol, message)
            }
            GatewayError::ResourceLimitExceeded { resource, current, limit } => {
                write!(f, "Resource limit exceeded for '{}': {} > {}", resource, current, limit)
            }
            GatewayError::InitializationError { component, message } => {
                write!(f, "Initialization error for '{}': {}", component, message)
            }
            GatewayError::ShutdownError { component, message } => {
                write!(f, "Shutdown error for '{}': {}", component, message)
            }
            GatewayError::ConcurrencyError { operation, message } => {
                write!(f, "Concurrency error in '{}': {}", operation, message)
            }
            GatewayError::ValidationError { field, rule, value } => {
                write!(f, "Validation error for field '{}': rule '{}', value '{}'", field, rule, value)
            }
            GatewayError::SerializationError { format, message } => {
                write!(f, "Serialization error ({}): {}", format, message)
            }
            GatewayError::DeserializationError { format, message } => {
                write!(f, "Deserialization error ({}): {}", format, message)
            }
            GatewayError::NetworkError { operation, message } => {
                write!(f, "Network error in '{}': {}", operation, message)
            }
            GatewayError::IoError { operation, message } => {
                write!(f, "I/O error in '{}': {}", operation, message)
            }
            GatewayError::SystemError { operation, message } => {
                write!(f, "System error in '{}': {}", operation, message)
            }
            GatewayError::UnknownError { context, message } => {
                write!(f, "Unknown error in '{}': {}", context, message)
            }
        }
    }
}

impl fmt::Display for UpstreamErrorType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            UpstreamErrorType::ConnectionFailed => write!(f, "ConnectionFailed"),
            UpstreamErrorType::Timeout => write!(f, "Timeout"),
            UpstreamErrorType::HttpStatus { status_code } => write!(f, "HttpStatus({})", status_code),
            UpstreamErrorType::ProtocolError => write!(f, "ProtocolError"),
            UpstreamErrorType::TlsError => write!(f, "TlsError"),
            UpstreamErrorType::DnsResolutionFailed => write!(f, "DnsResolutionFailed"),
            UpstreamErrorType::ServiceUnavailable => write!(f, "ServiceUnavailable"),
            UpstreamErrorType::RateLimited => write!(f, "RateLimited"),
            UpstreamErrorType::InternalServerError => write!(f, "InternalServerError"),
            UpstreamErrorType::BadGateway => write!(f, "BadGateway"),
            UpstreamErrorType::GatewayTimeout => write!(f, "GatewayTimeout"),
            UpstreamErrorType::Unknown => write!(f, "Unknown"),
        }
    }
}

#[cfg(feature = "std")]
impl std::error::Error for GatewayError {}

/// Result type alias for Gateway operations
pub type Result<T> = core::result::Result<T, GatewayError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_display_config() {
        let error = GatewayError::ConfigError {
            parameter: "listen_addr".into(),
            reason: "invalid address format".into(),
        };
        let display = format!("{}", error);
        assert!(display.contains("Configuration error"));
        assert!(display.contains("listen_addr"));
        assert!(display.contains("invalid address format"));
    }

    #[test]
    fn test_error_display_route_not_found() {
        let error = GatewayError::RouteNotFound {
            path: "/api/users".into(),
            method: "GET".into(),
        };
        let display = format!("{}", error);
        assert!(display.contains("Route not found"));
        assert!(display.contains("GET"));
        assert!(display.contains("/api/users"));
    }

    #[test]
    fn test_error_display_upstream() {
        let error = GatewayError::UpstreamError {
            upstream_url: "http://service:8080".into(),
            error_type: UpstreamErrorType::Timeout,
            message: "request timed out".into(),
        };
        let display = format!("{}", error);
        assert!(display.contains("Upstream error"));
        assert!(display.contains("http://service:8080"));
        assert!(display.contains("Timeout"));
        assert!(display.contains("request timed out"));
    }

    #[test]
    fn test_error_display_rate_limit() {
        let error = GatewayError::RateLimitExceeded {
            client_id: "192.168.1.100".into(),
            limit_type: "requests_per_second".into(),
            retry_after_seconds: 60,
        };
        let display = format!("{}", error);
        assert!(display.contains("Rate limit exceeded"));
        assert!(display.contains("192.168.1.100"));
        assert!(display.contains("60 seconds"));
    }

    #[test]
    fn test_error_display_circuit_breaker() {
        let error = GatewayError::CircuitBreakerOpen {
            upstream_url: "http://api:8080".into(),
            failure_count: 5,
            next_retry_timestamp: 1234567890,
        };
        let display = format!("{}", error);
        assert!(display.contains("Circuit breaker open"));
        assert!(display.contains("http://api:8080"));
        assert!(display.contains("5 failures"));
    }

    #[test]
    fn test_upstream_error_type_display() {
        assert_eq!(format!("{}", UpstreamErrorType::ConnectionFailed), "ConnectionFailed");
        assert_eq!(format!("{}", UpstreamErrorType::Timeout), "Timeout");
        assert_eq!(format!("{}", UpstreamErrorType::HttpStatus { status_code: 500 }), "HttpStatus(500)");
        assert_eq!(format!("{}", UpstreamErrorType::Unknown), "Unknown");
    }

    #[test]
    fn test_error_clone() {
        let error = GatewayError::ConfigError {
            parameter: "test".into(),
            reason: "test reason".into(),
        };
        let cloned = error.clone();
        assert_eq!(error, cloned);
    }

    #[test]
    fn test_validation_error() {
        let error = GatewayError::ValidationError {
            field: "email".into(),
            rule: "email_format".into(),
            value: "invalid-email".into(),
        };
        let display = format!("{}", error);
        assert!(display.contains("Validation error"));
        assert!(display.contains("email"));
        assert!(display.contains("email_format"));
        assert!(display.contains("invalid-email"));
    }

    #[test]
    fn test_resource_limit_error() {
        let error = GatewayError::ResourceLimitExceeded {
            resource: "connections".into(),
            current: "150".into(),
            limit: "100".into(),
        };
        let display = format!("{}", error);
        assert!(display.contains("Resource limit exceeded"));
        assert!(display.contains("connections"));
        assert!(display.contains("150 > 100"));
    }

    #[test]
    fn test_connection_phase_variants() {
        assert_eq!(ConnectionPhase::DnsResolution, ConnectionPhase::DnsResolution);
        assert_ne!(ConnectionPhase::TcpConnection, ConnectionPhase::TlsHandshake);
    }

    #[test]
    fn test_error_context() {
        let error = GatewayError::UnknownError {
            context: "request_processing".into(),
            message: "unexpected error occurred".into(),
        };
        let display = format!("{}", error);
        assert!(display.contains("Unknown error"));
        assert!(display.contains("request_processing"));
        assert!(display.contains("unexpected error occurred"));
    }
}
