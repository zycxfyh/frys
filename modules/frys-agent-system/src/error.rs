//! Agent system errors and handling

use core::fmt;

/// Agent system operation errors
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AgentError {
    /// Agent not found
    AgentNotFound {
        agent_id: alloc::string::String,
    },

    /// Task execution failed
    TaskExecutionFailed {
        task_id: alloc::string::String,
        reason: alloc::string::String,
    },

    /// Tool execution error
    ToolExecutionError {
        tool_name: alloc::string::String,
        error_message: alloc::string::String,
    },

    /// Planning error
    PlanningError {
        operation: alloc::string::String,
        reason: alloc::string::String,
    },

    /// Memory operation failed
    MemoryError {
        operation: alloc::string::String,
        reason: alloc::string::String,
    },

    /// Communication error
    CommunicationError {
        operation: alloc::string::String,
        reason: alloc::string::String,
    },

    /// Reasoning error
    ReasoningError {
        operation: alloc::string::String,
        reason: alloc::string::String,
    },

    /// Safety violation
    SafetyViolation {
        violation_type: alloc::string::String,
        details: alloc::string::String,
    },

    /// Resource limit exceeded
    ResourceLimitExceeded {
        resource: alloc::string::String,
        limit: alloc::string::String,
        actual: alloc::string::String,
    },

    /// Configuration error
    ConfigurationError {
        parameter: alloc::string::String,
        reason: alloc::string::String,
    },

    /// Learning error
    LearningError {
        operation: alloc::string::String,
        reason: alloc::string::String,
    },

    /// Serialization error
    SerializationError {
        reason: alloc::string::String,
    },

    /// Timeout error
    TimeoutError {
        operation: alloc::string::String,
        timeout_seconds: u64,
    },

    /// Concurrency error
    ConcurrencyError {
        operation: alloc::string::String,
        reason: alloc::string::String,
    },

    /// Authentication error
    AuthenticationError {
        reason: alloc::string::String,
    },

    /// Authorization error
    AuthorizationError {
        permission: alloc::string::String,
        reason: alloc::string::String,
    },

    /// Network error
    NetworkError {
        operation: alloc::string::String,
        reason: alloc::string::String,
    },

    /// Database error
    DatabaseError {
        operation: alloc::string::String,
        reason: alloc::string::String,
    },

    /// Invalid input
    InvalidInput {
        field: alloc::string::String,
        reason: alloc::string::String,
    },

    /// System overload
    SystemOverload {
        current_load: f64,
        max_load: f64,
    },

    /// Initialization failed
    InitializationFailed {
        component: alloc::string::String,
        reason: alloc::string::String,
    },

    /// Dependency error
    DependencyError {
        dependency: alloc::string::String,
        reason: alloc::string::String,
    },

    /// Version incompatibility
    VersionIncompatibility {
        component: alloc::string::String,
        required_version: alloc::string::String,
        current_version: alloc::string::String,
    },
}

impl fmt::Display for AgentError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AgentError::AgentNotFound { agent_id } => {
                write!(f, "Agent not found: {}", agent_id)
            }
            AgentError::TaskExecutionFailed { task_id, reason } => {
                write!(f, "Task '{}' execution failed: {}", task_id, reason)
            }
            AgentError::ToolExecutionError { tool_name, error_message } => {
                write!(f, "Tool '{}' execution error: {}", tool_name, error_message)
            }
            AgentError::PlanningError { operation, reason } => {
                write!(f, "Planning error in '{}': {}", operation, reason)
            }
            AgentError::MemoryError { operation, reason } => {
                write!(f, "Memory error in '{}': {}", operation, reason)
            }
            AgentError::CommunicationError { operation, reason } => {
                write!(f, "Communication error in '{}': {}", operation, reason)
            }
            AgentError::ReasoningError { operation, reason } => {
                write!(f, "Reasoning error in '{}': {}", operation, reason)
            }
            AgentError::SafetyViolation { violation_type, details } => {
                write!(f, "Safety violation '{}' : {}", violation_type, details)
            }
            AgentError::ResourceLimitExceeded { resource, limit, actual } => {
                write!(f, "Resource '{}' limit exceeded: {} > {}", resource, actual, limit)
            }
            AgentError::ConfigurationError { parameter, reason } => {
                write!(f, "Configuration error for '{}': {}", parameter, reason)
            }
            AgentError::LearningError { operation, reason } => {
                write!(f, "Learning error in '{}': {}", operation, reason)
            }
            AgentError::SerializationError { reason } => {
                write!(f, "Serialization error: {}", reason)
            }
            AgentError::TimeoutError { operation, timeout_seconds } => {
                write!(f, "Timeout error in '{}' after {} seconds", operation, timeout_seconds)
            }
            AgentError::ConcurrencyError { operation, reason } => {
                write!(f, "Concurrency error in '{}': {}", operation, reason)
            }
            AgentError::AuthenticationError { reason } => {
                write!(f, "Authentication error: {}", reason)
            }
            AgentError::AuthorizationError { permission, reason } => {
                write!(f, "Authorization error for '{}': {}", permission, reason)
            }
            AgentError::NetworkError { operation, reason } => {
                write!(f, "Network error in '{}': {}", operation, reason)
            }
            AgentError::DatabaseError { operation, reason } => {
                write!(f, "Database error in '{}': {}", operation, reason)
            }
            AgentError::InvalidInput { field, reason } => {
                write!(f, "Invalid input for '{}': {}", field, reason)
            }
            AgentError::SystemOverload { current_load, max_load } => {
                write!(f, "System overload: current load {:.2}, max load {:.2}", current_load, max_load)
            }
            AgentError::InitializationFailed { component, reason } => {
                write!(f, "Initialization failed for '{}': {}", component, reason)
            }
            AgentError::DependencyError { dependency, reason } => {
                write!(f, "Dependency error for '{}': {}", dependency, reason)
            }
            AgentError::VersionIncompatibility { component, required_version, current_version } => {
                write!(f, "Version incompatibility in '{}': requires {}, current {}", component, required_version, current_version)
            }
        }
    }
}

#[cfg(feature = "std")]
impl std::error::Error for AgentError {}

/// Result type alias for Agent operations
pub type Result<T> = core::result::Result<T, AgentError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_display() {
        let error = AgentError::AgentNotFound {
            agent_id: "agent-123".into(),
        };
        let display = format!("{}", error);
        assert!(display.contains("Agent not found"));
        assert!(display.contains("agent-123"));
    }

    #[test]
    fn test_error_clone() {
        let error = AgentError::TaskExecutionFailed {
            task_id: "task-456".into(),
            reason: "timeout".into(),
        };
        let cloned = error.clone();
        assert_eq!(error, cloned);
    }

    #[test]
    fn test_safety_violation() {
        let error = AgentError::SafetyViolation {
            violation_type: "unauthorized_access".into(),
            details: "attempted to access restricted resource".into(),
        };
        let display = format!("{}", error);
        assert!(display.contains("Safety violation"));
        assert!(display.contains("unauthorized_access"));
    }

    #[test]
    fn test_resource_limit() {
        let error = AgentError::ResourceLimitExceeded {
            resource: "memory".into(),
            limit: "8GB".into(),
            actual: "10GB".into(),
        };
        let display = format!("{}", error);
        assert!(display.contains("Resource 'memory' limit exceeded"));
        assert!(display.contains("10GB > 8GB"));
    }
}
