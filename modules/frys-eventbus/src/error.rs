//! EventBus error types and handling

use core::fmt;

/// EventBus operation errors
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum EventBusError {
    /// Queue is full, cannot accept more events
    QueueFull {
        current_size: usize,
        max_size: usize,
    },

    /// Subscriber limit exceeded
    SubscriberLimitExceeded {
        current_count: usize,
        max_count: usize,
    },

    /// Invalid topic name
    InvalidTopic {
        topic: alloc::string::String,
        reason: &'static str,
    },

    /// Subscriber not found
    SubscriberNotFound {
        subscriber_id: u64,
    },

    /// Event routing failed
    RoutingFailed {
        topic: alloc::string::String,
        reason: &'static str,
    },

    /// Filter compilation failed
    FilterCompilationFailed {
        filter: alloc::string::String,
        reason: &'static str,
    },

    /// Serialization/deserialization error
    SerializationError {
        operation: &'static str,
        details: alloc::string::String,
    },

    /// Backpressure triggered
    BackpressureTriggered {
        queue_size: usize,
        threshold: usize,
    },

    /// Operation timeout
    OperationTimeout {
        operation: &'static str,
        timeout_ms: u64,
    },

    /// Concurrency violation
    ConcurrencyViolation {
        operation: &'static str,
        details: &'static str,
    },

    /// Resource limit exceeded
    ResourceLimitExceeded {
        resource: &'static str,
        limit: usize,
        requested: usize,
    },

    /// Initialization failed
    InitializationFailed {
        component: &'static str,
        reason: &'static str,
    },

    /// Shutdown failed
    ShutdownFailed {
        component: &'static str,
        reason: &'static str,
    },

    /// Invalid configuration
    InvalidConfiguration {
        field: &'static str,
        reason: &'static str,
    },

    /// I/O operation failed
    IoError {
        operation: &'static str,
        details: alloc::string::String,
    },
}

impl fmt::Display for EventBusError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            EventBusError::QueueFull { current_size, max_size } => {
                write!(f, "Queue full: {}/{} events", current_size, max_size)
            }
            EventBusError::SubscriberLimitExceeded { current_count, max_count } => {
                write!(f, "Subscriber limit exceeded: {}/{}", current_count, max_count)
            }
            EventBusError::InvalidTopic { topic, reason } => {
                write!(f, "Invalid topic '{}': {}", topic, reason)
            }
            EventBusError::SubscriberNotFound { subscriber_id } => {
                write!(f, "Subscriber not found: {}", subscriber_id)
            }
            EventBusError::RoutingFailed { topic, reason } => {
                write!(f, "Routing failed for topic '{}': {}", topic, reason)
            }
            EventBusError::FilterCompilationFailed { filter, reason } => {
                write!(f, "Filter compilation failed '{}': {}", filter, reason)
            }
            EventBusError::SerializationError { operation, details } => {
                write!(f, "Serialization error in {}: {}", operation, details)
            }
            EventBusError::BackpressureTriggered { queue_size, threshold } => {
                write!(f, "Backpressure triggered: queue size {} >= threshold {}", queue_size, threshold)
            }
            EventBusError::OperationTimeout { operation, timeout_ms } => {
                write!(f, "Operation '{}' timed out after {}ms", operation, timeout_ms)
            }
            EventBusError::ConcurrencyViolation { operation, details } => {
                write!(f, "Concurrency violation in '{}': {}", operation, details)
            }
            EventBusError::ResourceLimitExceeded { resource, limit, requested } => {
                write!(f, "Resource limit exceeded for '{}': limit {}, requested {}", resource, limit, requested)
            }
            EventBusError::InitializationFailed { component, reason } => {
                write!(f, "Initialization failed for '{}': {}", component, reason)
            }
            EventBusError::ShutdownFailed { component, reason } => {
                write!(f, "Shutdown failed for '{}': {}", component, reason)
            }
            EventBusError::InvalidConfiguration { field, reason } => {
                write!(f, "Invalid configuration for '{}': {}", field, reason)
            }
            EventBusError::IoError { operation, details } => {
                write!(f, "I/O error in '{}': {}", operation, details)
            }
        }
    }
}

#[cfg(feature = "std")]
impl std::error::Error for EventBusError {}

/// Result type alias for EventBus operations
pub type Result<T> = core::result::Result<T, EventBusError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_display() {
        let error = EventBusError::QueueFull {
            current_size: 1024,
            max_size: 1000,
        };
        let display = format!("{}", error);
        assert!(display.contains("Queue full"));
        assert!(display.contains("1024"));
        assert!(display.contains("1000"));
    }

    #[test]
    fn test_error_clone() {
        let error = EventBusError::InvalidTopic {
            topic: "invalid.topic".into(),
            reason: "contains invalid characters",
        };
        let cloned = error.clone();
        assert_eq!(error, cloned);
    }
}
