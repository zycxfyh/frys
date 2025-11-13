//! WebSocket error types and handling

use core::fmt;

/// WebSocket operation errors
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum WebSocketError {
    /// Connection error
    ConnectionError {
        /// Target address
        address: alloc::string::String,
        /// Connection phase
        phase: ConnectionPhase,
        /// Error message
        message: alloc::string::String,
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
        /// Error reason
        reason: alloc::string::String,
    },

    /// Message error
    MessageError {
        /// Message type
        message_type: alloc::string::String,
        /// Error reason
        reason: alloc::string::String,
    },

    /// Protocol error
    ProtocolError {
        /// Protocol violation
        violation: alloc::string::String,
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

    /// Rate limit exceeded
    RateLimitExceeded {
        /// Client identifier
        client_id: alloc::string::String,
        /// Limit type
        limit_type: alloc::string::String,
        /// Retry after seconds
        retry_after_seconds: u64,
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

    /// Pub/Sub error
    PubSubError {
        /// Pub/Sub operation
        operation: alloc::string::String,
        /// Channel name
        channel: alloc::string::String,
        /// Error message
        message: alloc::string::String,
    },

    /// Cluster error
    ClusterError {
        /// Cluster operation
        operation: alloc::string::String,
        /// Node ID
        node_id: alloc::string::String,
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

    /// TLS/SSL error
    TlsError {
        /// TLS operation
        operation: alloc::string::String,
        /// Error message
        message: alloc::string::String,
    },

    /// Configuration error
    ConfigurationError {
        /// Configuration parameter
        parameter: alloc::string::String,
        /// Error reason
        reason: alloc::string::String,
    },

    /// Serialization error
    SerializationError {
        /// Format
        format: alloc::string::String,
        /// Error message
        message: alloc::string::String,
    },

    /// Deserialization error
    DeserializationError {
        /// Format
        format: alloc::string::String,
        /// Error message
        message: alloc::string::String,
    },

    /// Handler error
    HandlerError {
        /// Handler name
        handler_name: alloc::string::String,
        /// Error message
        message: alloc::string::String,
    },

    /// Broadcast error
    BroadcastError {
        /// Broadcast operation
        operation: alloc::string::String,
        /// Target count
        target_count: usize,
        /// Error message
        message: alloc::string::String,
    },

    /// Monitoring error
    MonitoringError {
        /// Monitoring operation
        operation: alloc::string::String,
        /// Error message
        message: alloc::string::String,
    },

    /// Heartbeat error
    HeartbeatError {
        /// Connection ID
        connection_id: alloc::string::String,
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

/// Connection phases
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ConnectionPhase {
    /// Initial connection establishment
    Connecting,
    /// TLS handshake
    TlsHandshake,
    /// WebSocket handshake
    WebSocketHandshake,
    /// Authentication
    Authentication,
    /// Protocol negotiation
    ProtocolNegotiation,
    /// Heartbeat
    Heartbeat,
    /// Message processing
    MessageProcessing,
    /// Connection closing
    Closing,
}

impl fmt::Display for WebSocketError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            WebSocketError::ConnectionError { address, phase, message } => {
                write!(f, "Connection error to '{}' during {:?}: {}", address, phase, message)
            }
            WebSocketError::AuthenticationError { scheme, reason } => {
                write!(f, "Authentication error ({}): {}", scheme, reason)
            }
            WebSocketError::AuthorizationError { required_permission, reason } => {
                write!(f, "Authorization error for '{}': {}", required_permission, reason)
            }
            WebSocketError::MessageError { message_type, reason } => {
                write!(f, "Message error ({}): {}", message_type, reason)
            }
            WebSocketError::ProtocolError { violation, message } => {
                write!(f, "Protocol error '{}': {}", violation, message)
            }
            WebSocketError::TimeoutError { operation, timeout_seconds } => {
                write!(f, "Timeout error in '{}' after {} seconds", operation, timeout_seconds)
            }
            WebSocketError::RateLimitExceeded { client_id, limit_type, retry_after_seconds } => {
                write!(f, "Rate limit exceeded for client '{}' ({}), retry after {} seconds",
                       client_id, limit_type, retry_after_seconds)
            }
            WebSocketError::ResourceLimitExceeded { resource, current, limit } => {
                write!(f, "Resource limit exceeded for '{}': {} > {}", resource, current, limit)
            }
            WebSocketError::PubSubError { operation, channel, message } => {
                write!(f, "Pub/Sub error in '{}' on channel '{}': {}", operation, channel, message)
            }
            WebSocketError::ClusterError { operation, node_id, message } => {
                write!(f, "Cluster error in '{}' on node '{}': {}", operation, node_id, message)
            }
            WebSocketError::CompressionError { operation, message } => {
                write!(f, "Compression error in '{}': {}", operation, message)
            }
            WebSocketError::TlsError { operation, message } => {
                write!(f, "TLS error in '{}': {}", operation, message)
            }
            WebSocketError::ConfigurationError { parameter, reason } => {
                write!(f, "Configuration error for '{}': {}", parameter, reason)
            }
            WebSocketError::SerializationError { format, message } => {
                write!(f, "Serialization error ({}): {}", format, message)
            }
            WebSocketError::DeserializationError { format, message } => {
                write!(f, "Deserialization error ({}): {}", format, message)
            }
            WebSocketError::HandlerError { handler_name, message } => {
                write!(f, "Handler error in '{}': {}", handler_name, message)
            }
            WebSocketError::BroadcastError { operation, target_count, message } => {
                write!(f, "Broadcast error in '{}' to {} targets: {}", operation, target_count, message)
            }
            WebSocketError::MonitoringError { operation, message } => {
                write!(f, "Monitoring error in '{}': {}", operation, message)
            }
            WebSocketError::HeartbeatError { connection_id, message } => {
                write!(f, "Heartbeat error for connection '{}': {}", connection_id, message)
            }
            WebSocketError::ValidationError { field, rule, value } => {
                write!(f, "Validation error for field '{}': rule '{}', value '{}'", field, rule, value)
            }
            WebSocketError::NetworkError { operation, message } => {
                write!(f, "Network error in '{}': {}", operation, message)
            }
            WebSocketError::IoError { operation, message } => {
                write!(f, "I/O error in '{}': {}", operation, message)
            }
            WebSocketError::SystemError { operation, message } => {
                write!(f, "System error in '{}': {}", operation, message)
            }
            WebSocketError::UnknownError { context, message } => {
                write!(f, "Unknown error in '{}': {}", context, message)
            }
        }
    }
}

#[cfg(feature = "std")]
impl std::error::Error for WebSocketError {}

/// Result type alias for WebSocket operations
pub type Result<T> = core::result::Result<T, WebSocketError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_display_connection() {
        let error = WebSocketError::ConnectionError {
            address: "ws://localhost:8080".into(),
            phase: ConnectionPhase::WebSocketHandshake,
            message: "handshake failed".into(),
        };
        let display = format!("{}", error);
        assert!(display.contains("Connection error"));
        assert!(display.contains("ws://localhost:8080"));
        assert!(display.contains("WebSocketHandshake"));
        assert!(display.contains("handshake failed"));
    }

    #[test]
    fn test_error_display_auth() {
        let error = WebSocketError::AuthenticationError {
            scheme: "JWT".into(),
            reason: "token expired".into(),
        };
        let display = format!("{}", error);
        assert!(display.contains("Authentication error"));
        assert!(display.contains("JWT"));
        assert!(display.contains("token expired"));
    }

    #[test]
    fn test_error_display_rate_limit() {
        let error = WebSocketError::RateLimitExceeded {
            client_id: "user123".into(),
            limit_type: "messages_per_second".into(),
            retry_after_seconds: 30,
        };
        let display = format!("{}", error);
        assert!(display.contains("Rate limit exceeded"));
        assert!(display.contains("user123"));
        assert!(display.contains("30 seconds"));
    }

    #[test]
    fn test_error_display_pubsub() {
        let error = WebSocketError::PubSubError {
            operation: "publish".into(),
            channel: "chat.room.123".into(),
            message: "redis connection failed".into(),
        };
        let display = format!("{}", error);
        assert!(display.contains("Pub/Sub error"));
        assert!(display.contains("publish"));
        assert!(display.contains("chat.room.123"));
        assert!(display.contains("redis connection failed"));
    }

    #[test]
    fn test_error_display_cluster() {
        let error = WebSocketError::ClusterError {
            operation: "message_routing".into(),
            node_id: "node-2".into(),
            message: "node unreachable".into(),
        };
        let display = format!("{}", error);
        assert!(display.contains("Cluster error"));
        assert!(display.contains("message_routing"));
        assert!(display.contains("node-2"));
        assert!(display.contains("node unreachable"));
    }

    #[test]
    fn test_error_display_validation() {
        let error = WebSocketError::ValidationError {
            field: "message_size".into(),
            rule: "max_size".into(),
            value: "2048000".into(),
        };
        let display = format!("{}", error);
        assert!(display.contains("Validation error"));
        assert!(display.contains("message_size"));
        assert!(display.contains("max_size"));
        assert!(display.contains("2048000"));
    }

    #[test]
    fn test_connection_phase_variants() {
        assert_eq!(ConnectionPhase::Connecting, ConnectionPhase::Connecting);
        assert_ne!(ConnectionPhase::TlsHandshake, ConnectionPhase::WebSocketHandshake);
    }

    #[test]
    fn test_error_clone() {
        let error = WebSocketError::ConfigurationError {
            parameter: "bind_addr".into(),
            reason: "invalid address".into(),
        };
        let cloned = error.clone();
        assert_eq!(error, cloned);
    }

    #[test]
    fn test_broadcast_error() {
        let error = WebSocketError::BroadcastError {
            operation: "room_broadcast".into(),
            target_count: 150,
            message: "connection pool exhausted".into(),
        };
        let display = format!("{}", error);
        assert!(display.contains("Broadcast error"));
        assert!(display.contains("150 targets"));
        assert!(display.contains("connection pool exhausted"));
    }

    #[test]
    fn test_heartbeat_error() {
        let error = WebSocketError::HeartbeatError {
            connection_id: "conn-abc123".into(),
            message: "pong timeout".into(),
        };
        let display = format!("{}", error);
        assert!(display.contains("Heartbeat error"));
        assert!(display.contains("conn-abc123"));
        assert!(display.contains("pong timeout"));
    }

    #[test]
    fn test_resource_limit_error() {
        let error = WebSocketError::ResourceLimitExceeded {
            resource: "connections".into(),
            current: "12000".into(),
            limit: "10000".into(),
        };
        let display = format!("{}", error);
        assert!(display.contains("Resource limit exceeded"));
        assert!(display.contains("connections"));
        assert!(display.contains("12000 > 10000"));
    }
}
