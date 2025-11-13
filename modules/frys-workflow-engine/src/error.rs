//! Workflow engine errors and handling

use core::fmt;

/// Workflow execution errors
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum WorkflowError {
    /// Workflow not found
    WorkflowNotFound {
        id: alloc::string::String,
    },

    /// Execution not found
    ExecutionNotFound {
        execution_id: alloc::string::String,
    },

    /// Node not found in workflow
    NodeNotFound {
        node_id: alloc::string::String,
        workflow_id: alloc::string::String,
    },

    /// Invalid workflow definition
    InvalidWorkflow {
        reason: alloc::string::String,
    },

    /// Cyclic dependency detected
    CyclicDependency {
        nodes: alloc::vec::Vec<alloc::string::String>,
    },

    /// Execution timeout
    ExecutionTimeout {
        execution_id: alloc::string::String,
        timeout_seconds: u64,
    },

    /// Node execution failed
    NodeExecutionFailed {
        node_id: alloc::string::String,
        execution_id: alloc::string::String,
        reason: alloc::string::String,
    },

    /// Resource exhaustion
    ResourceExhausted {
        resource: alloc::string::String,
        requested: u64,
        available: u64,
    },

    /// Serialization error
    SerializationError {
        operation: alloc::string::String,
        reason: alloc::string::String,
    },

    /// Persistence error
    PersistenceError {
        operation: alloc::string::String,
        reason: alloc::string::String,
    },

    /// Worker pool exhausted
    WorkerPoolExhausted {
        requested: usize,
        available: usize,
    },

    /// Invalid node configuration
    InvalidNodeConfig {
        node_id: alloc::string::String,
        parameter: alloc::string::String,
        reason: alloc::string::String,
    },

    /// DSL parsing error
    DslParseError {
        line: usize,
        column: usize,
        reason: alloc::string::String,
    },

    /// Workflow already running
    WorkflowAlreadyRunning {
        id: alloc::string::String,
    },

    /// Maximum workflows exceeded
    MaxWorkflowsExceeded {
        current: usize,
        max: usize,
    },

    /// Dependency resolution failed
    DependencyResolutionFailed {
        node_id: alloc::string::String,
        dependency: alloc::string::String,
        reason: alloc::string::String,
    },

    /// Context access error
    ContextAccessError {
        key: alloc::string::String,
        reason: alloc::string::String,
    },

    /// Monitoring error
    MonitoringError {
        operation: alloc::string::String,
        reason: alloc::string::String,
    },

    /// Network communication error
    NetworkError {
        operation: alloc::string::String,
        reason: alloc::string::String,
    },
}

impl fmt::Display for WorkflowError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            WorkflowError::WorkflowNotFound { id } => {
                write!(f, "Workflow not found: {}", id)
            }
            WorkflowError::ExecutionNotFound { execution_id } => {
                write!(f, "Execution not found: {}", execution_id)
            }
            WorkflowError::NodeNotFound { node_id, workflow_id } => {
                write!(f, "Node '{}' not found in workflow '{}'", node_id, workflow_id)
            }
            WorkflowError::InvalidWorkflow { reason } => {
                write!(f, "Invalid workflow: {}", reason)
            }
            WorkflowError::CyclicDependency { nodes } => {
                write!(f, "Cyclic dependency detected: {:?}", nodes)
            }
            WorkflowError::ExecutionTimeout { execution_id, timeout_seconds } => {
                write!(f, "Execution '{}' timed out after {} seconds", execution_id, timeout_seconds)
            }
            WorkflowError::NodeExecutionFailed { node_id, execution_id, reason } => {
                write!(f, "Node '{}' execution failed in '{}': {}", node_id, execution_id, reason)
            }
            WorkflowError::ResourceExhausted { resource, requested, available } => {
                write!(f, "Resource '{}' exhausted: requested {}, available {}", resource, requested, available)
            }
            WorkflowError::SerializationError { operation, reason } => {
                write!(f, "Serialization error in '{}': {}", operation, reason)
            }
            WorkflowError::PersistenceError { operation, reason } => {
                write!(f, "Persistence error in '{}': {}", operation, reason)
            }
            WorkflowError::WorkerPoolExhausted { requested, available } => {
                write!(f, "Worker pool exhausted: requested {}, available {}", requested, available)
            }
            WorkflowError::InvalidNodeConfig { node_id, parameter, reason } => {
                write!(f, "Invalid config for node '{}', parameter '{}': {}", node_id, parameter, reason)
            }
            WorkflowError::DslParseError { line, column, reason } => {
                write!(f, "DSL parse error at {}:{} - {}", line, column, reason)
            }
            WorkflowError::WorkflowAlreadyRunning { id } => {
                write!(f, "Workflow already running: {}", id)
            }
            WorkflowError::MaxWorkflowsExceeded { current, max } => {
                write!(f, "Maximum workflows exceeded: {} / {}", current, max)
            }
            WorkflowError::DependencyResolutionFailed { node_id, dependency, reason } => {
                write!(f, "Dependency resolution failed for node '{}', dependency '{}': {}", node_id, dependency, reason)
            }
            WorkflowError::ContextAccessError { key, reason } => {
                write!(f, "Context access error for key '{}': {}", key, reason)
            }
            WorkflowError::MonitoringError { operation, reason } => {
                write!(f, "Monitoring error in '{}': {}", operation, reason)
            }
            WorkflowError::NetworkError { operation, reason } => {
                write!(f, "Network error in '{}': {}", operation, reason)
            }
        }
    }
}

#[cfg(feature = "std")]
impl std::error::Error for WorkflowError {}

/// Result type alias for Workflow operations
pub type Result<T> = core::result::Result<T, WorkflowError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_display() {
        let error = WorkflowError::WorkflowNotFound {
            id: "test-workflow".into(),
        };
        let display = format!("{}", error);
        assert!(display.contains("Workflow not found"));
        assert!(display.contains("test-workflow"));
    }

    #[test]
    fn test_error_clone() {
        let error = WorkflowError::InvalidWorkflow {
            reason: "missing nodes".into(),
        };
        let cloned = error.clone();
        assert_eq!(error, cloned);
    }
}
