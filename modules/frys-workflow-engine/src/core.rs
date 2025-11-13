//! Core workflow types and structures

use crate::*;
use core::time::Duration;

/// Workflow unique identifier
pub type WorkflowId = alloc::string::String;

/// Execution unique identifier
pub type ExecutionId = alloc::string::String;

/// Node unique identifier within a workflow
pub type NodeId = alloc::string::String;

/// Workflow definition
#[derive(Debug, Clone)]
pub struct Workflow {
    /// Unique workflow identifier
    pub id: WorkflowId,
    /// Workflow name
    pub name: alloc::string::String,
    /// Workflow description
    pub description: alloc::string::String,
    /// Workflow version
    pub version: alloc::string::String,
    /// Workflow nodes
    pub nodes: alloc::collections::BTreeMap<NodeId, WorkflowNode>,
    /// Workflow edges (connections between nodes)
    pub edges: alloc::vec::Vec<WorkflowEdge>,
    /// Workflow metadata
    pub metadata: WorkflowMetadata,
}

impl Workflow {
    /// Create a new workflow builder
    pub fn builder(name: &str) -> WorkflowBuilder {
        WorkflowBuilder::new(name)
    }

    /// Validate workflow structure
    pub fn validate(&self) -> Result<()> {
        // Check for cycles
        self.detect_cycles()?;

        // Check node dependencies
        self.validate_dependencies()?;

        // Check for orphaned nodes
        self.check_orphaned_nodes()?;

        Ok(())
    }

    /// Detect cycles in workflow DAG
    fn detect_cycles(&self) -> Result<()> {
        let mut visited = alloc::collections::BTreeSet::new();
        let mut recursion_stack = alloc::collections::BTreeSet::new();

        for node_id in self.nodes.keys() {
            if self.has_cycle(node_id, &mut visited, &mut recursion_stack) {
                return Err(WorkflowError::CyclicDependency {
                    nodes: recursion_stack.into_iter().collect(),
                });
            }
        }

        Ok(())
    }

    /// Check for cycles using DFS
    fn has_cycle(
        &self,
        node_id: &NodeId,
        visited: &mut alloc::collections::BTreeSet<NodeId>,
        recursion_stack: &mut alloc::collections::BTreeSet<NodeId>,
    ) -> bool {
        if recursion_stack.contains(node_id) {
            return true;
        }

        if visited.contains(node_id) {
            return false;
        }

        visited.insert(node_id.clone());
        recursion_stack.insert(node_id.clone());

        // Check all outgoing edges
        for edge in &self.edges {
            if edge.from == *node_id {
                if self.has_cycle(&edge.to, visited, recursion_stack) {
                    return true;
                }
            }
        }

        recursion_stack.remove(node_id);
        false
    }

    /// Validate node dependencies
    fn validate_dependencies(&self) -> Result<()> {
        for (node_id, node) in &self.nodes {
            for dependency in &node.dependencies {
                if !self.nodes.contains_key(dependency) {
                    return Err(WorkflowError::DependencyResolutionFailed {
                        node_id: node_id.clone(),
                        dependency: dependency.clone(),
                        reason: "dependency node not found".into(),
                    });
                }
            }
        }
        Ok(())
    }

    /// Check for orphaned nodes (not connected to anything)
    fn check_orphaned_nodes(&self) -> Result<()> {
        let mut connected_nodes = alloc::collections::BTreeSet::new();

        // Add nodes that are sources of edges
        for edge in &self.edges {
            connected_nodes.insert(edge.from.clone());
            connected_nodes.insert(edge.to.clone());
        }

        // Check for orphaned nodes
        for node_id in self.nodes.keys() {
            if !connected_nodes.contains(node_id) && self.nodes.len() > 1 {
                // Allow single-node workflows to be orphaned
                return Err(WorkflowError::InvalidWorkflow {
                    reason: alloc::format!("orphaned node: {}", node_id),
                });
            }
        }

        Ok(())
    }

    /// Get workflow execution order (topological sort)
    pub fn execution_order(&self) -> Result<alloc::vec::Vec<NodeId>> {
        let mut result = alloc::vec::Vec::new();
        let mut visited = alloc::collections::BTreeSet::new();
        let mut temp_marked = alloc::collections::BTreeSet::new();

        for node_id in self.nodes.keys() {
            if !visited.contains(node_id) {
                self.topological_sort(node_id, &mut visited, &mut temp_marked, &mut result)?;
            }
        }

        result.reverse(); // Reverse to get correct execution order
        Ok(result)
    }

    /// Topological sort helper
    fn topological_sort(
        &self,
        node_id: &NodeId,
        visited: &mut alloc::collections::BTreeSet<NodeId>,
        temp_marked: &mut alloc::collections::BTreeSet<NodeId>,
        result: &mut alloc::vec::Vec<NodeId>,
    ) -> Result<()> {
        if temp_marked.contains(node_id) {
            return Err(WorkflowError::CyclicDependency {
                nodes: temp_marked.iter().cloned().collect(),
            });
        }

        if !visited.contains(node_id) {
            temp_marked.insert(node_id.clone());

            // Visit all dependencies first
            for edge in &self.edges {
                if edge.to == *node_id {
                    self.topological_sort(&edge.from, visited, temp_marked, result)?;
                }
            }

            temp_marked.remove(node_id);
            visited.insert(node_id.clone());
            result.push(node_id.clone());
        }

        Ok(())
    }
}

/// Workflow builder for fluent API
#[derive(Debug)]
pub struct WorkflowBuilder {
    id: Option<WorkflowId>,
    name: alloc::string::String,
    description: alloc::string::String,
    version: alloc::string::String,
    nodes: alloc::collections::BTreeMap<NodeId, WorkflowNode>,
    edges: alloc::vec::Vec<WorkflowEdge>,
    metadata: WorkflowMetadata,
}

impl WorkflowBuilder {
    /// Create a new workflow builder
    pub fn new(name: &str) -> Self {
        Self {
            id: None,
            name: name.into(),
            description: alloc::string::String::new(),
            version: "1.0.0".into(),
            nodes: alloc::collections::BTreeMap::new(),
            edges: alloc::vec::Vec::new(),
            metadata: WorkflowMetadata::default(),
        }
    }

    /// Set workflow ID
    pub fn id(mut self, id: WorkflowId) -> Self {
        self.id = Some(id);
        self
    }

    /// Set workflow description
    pub fn description(mut self, desc: &str) -> Self {
        self.description = desc.into();
        self
    }

    /// Set workflow version
    pub fn version(mut self, version: &str) -> Self {
        self.version = version.into();
        self
    }

    /// Add a node to the workflow
    pub fn add_node(mut self, node: WorkflowNode) -> Self {
        self.nodes.insert(node.id.clone(), node);
        self
    }

    /// Connect two nodes
    pub fn connect(mut self, from: &str, to: &str) -> Self {
        self.edges.push(WorkflowEdge {
            from: from.into(),
            to: to.into(),
            condition: None,
        });
        self
    }

    /// Connect nodes with condition
    pub fn connect_with_condition(mut self, from: &str, to: &str, condition: WorkflowCondition) -> Self {
        self.edges.push(WorkflowEdge {
            from: from.into(),
            to: to.into(),
            condition: Some(condition),
        });
        self
    }

    /// Set workflow metadata
    pub fn metadata(mut self, metadata: WorkflowMetadata) -> Self {
        self.metadata = metadata;
        self
    }

    /// Build the workflow
    pub fn build(self) -> Workflow {
        let id = self.id.unwrap_or_else(|| {
            // Generate UUID-like ID
            alloc::format!("workflow-{}-{}", self.name, self.version)
        });

        let workflow = Workflow {
            id,
            name: self.name,
            description: self.description,
            version: self.version,
            nodes: self.nodes,
            edges: self.edges,
            metadata: self.metadata,
        };

        // Note: Validation would be called here in production
        workflow
    }
}

/// Workflow node definition
#[derive(Debug, Clone)]
pub struct WorkflowNode {
    /// Node unique identifier
    pub id: NodeId,
    /// Node name
    pub name: alloc::string::String,
    /// Node type
    pub node_type: NodeType,
    /// Node configuration
    pub config: NodeConfig,
    /// Node dependencies (other nodes this node depends on)
    pub dependencies: alloc::vec::Vec<NodeId>,
    /// Node timeout
    pub timeout: Option<Duration>,
    /// Node retry policy
    pub retry_policy: RetryPolicy,
    /// Node metadata
    pub metadata: NodeMetadata,
}

impl WorkflowNode {
    /// Create a new workflow node
    pub fn new(id: &str) -> Self {
        Self {
            id: id.into(),
            name: id.into(),
            node_type: NodeType::Task,
            config: NodeConfig::default(),
            dependencies: alloc::vec::Vec::new(),
            timeout: None,
            retry_policy: RetryPolicy::default(),
            metadata: NodeMetadata::default(),
        }
    }

    /// Set node name
    pub fn name(mut self, name: &str) -> Self {
        self.name = name.into();
        self
    }

    /// Set node type
    pub fn node_type(mut self, node_type: NodeType) -> Self {
        self.node_type = node_type;
        self
    }

    /// Set node configuration
    pub fn config(mut self, config: NodeConfig) -> Self {
        self.config = config;
        self
    }

    /// Add dependency
    pub fn depends_on(mut self, node_id: &str) -> Self {
        self.dependencies.push(node_id.into());
        self
    }

    /// Set timeout
    pub fn timeout(mut self, timeout: Duration) -> Self {
        self.timeout = Some(timeout);
        self
    }

    /// Set retry policy
    pub fn retry_policy(mut self, policy: RetryPolicy) -> Self {
        self.retry_policy = policy;
        self
    }
}

/// Node types
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum NodeType {
    /// Regular task node
    Task,
    /// Decision/gateway node
    Decision,
    /// Parallel execution node
    Parallel,
    /// Sub-workflow node
    SubWorkflow,
    /// Event waiting node
    Event,
    /// Timer/delay node
    Timer,
}

/// Node configuration
#[derive(Debug, Clone, Default)]
pub struct NodeConfig {
    /// Node-specific parameters
    pub parameters: alloc::collections::BTreeMap<alloc::string::String, WorkflowData>,
    /// Execution priority
    pub priority: i32,
    /// Required resources
    pub required_resources: alloc::vec::Vec<ResourceRequirement>,
}

/// Resource requirements for node execution
#[derive(Debug, Clone)]
pub struct ResourceRequirement {
    /// Resource type
    pub resource_type: alloc::string::String,
    /// Required amount
    pub amount: u64,
}

/// Workflow edge (connection between nodes)
#[derive(Debug, Clone)]
pub struct WorkflowEdge {
    /// Source node ID
    pub from: NodeId,
    /// Target node ID
    pub to: NodeId,
    /// Execution condition (optional)
    pub condition: Option<WorkflowCondition>,
}

/// Workflow execution condition
#[derive(Debug, Clone)]
pub enum WorkflowCondition {
    /// Always execute
    Always,
    /// Execute if expression evaluates to true
    Expression(alloc::string::String),
    /// Execute if previous node succeeded
    OnSuccess,
    /// Execute if previous node failed
    OnFailure,
    /// Custom condition
    Custom(alloc::string::String),
}

/// Workflow data types
#[derive(Debug, Clone, PartialEq)]
pub enum WorkflowData {
    /// Null value
    Null,
    /// Boolean value
    Bool(bool),
    /// Integer value
    Int(i64),
    /// Float value
    Float(f64),
    /// String value
    String(alloc::string::String),
    /// Binary data
    Bytes(alloc::vec::Vec<u8>),
    /// Array of values
    Array(alloc::vec::Vec<WorkflowData>),
    /// Object/map of values
    Object(alloc::collections::BTreeMap<alloc::string::String, WorkflowData>),
}

/// Retry policy for failed nodes
#[derive(Debug, Clone)]
pub struct RetryPolicy {
    /// Maximum number of retries
    pub max_attempts: u32,
    /// Delay between retries
    pub delay: Duration,
    /// Backoff multiplier
    pub backoff_multiplier: f64,
    /// Maximum delay
    pub max_delay: Duration,
}

impl Default for RetryPolicy {
    fn default() -> Self {
        Self {
            max_attempts: 3,
            delay: Duration::from_millis(1000),
            backoff_multiplier: 2.0,
            max_delay: Duration::from_millis(30000),
        }
    }
}

/// Workflow metadata
#[derive(Debug, Clone, Default)]
pub struct WorkflowMetadata {
    /// Author
    pub author: alloc::string::String,
    /// Creation timestamp
    pub created_at: u64,
    /// Last modified timestamp
    pub modified_at: u64,
    /// Tags
    pub tags: alloc::vec::Vec<alloc::string::String>,
    /// Custom properties
    pub properties: alloc::collections::BTreeMap<alloc::string::String, alloc::string::String>,
}

/// Node metadata
#[derive(Debug, Clone, Default)]
pub struct NodeMetadata {
    /// Description
    pub description: alloc::string::String,
    /// Category
    pub category: alloc::string::String,
    /// Icon/path
    pub icon: alloc::string::String,
    /// Position in UI (x, y coordinates)
    pub position: Option<(f32, f32)>,
}

/// Workflow execution status
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ExecutionStatus {
    /// Execution is pending
    Pending,
    /// Execution is running
    Running,
    /// Execution completed successfully
    Completed,
    /// Execution failed
    Failed,
    /// Execution was cancelled
    Cancelled,
    /// Execution timed out
    Timeout,
    /// Execution is paused
    Paused,
}

/// Workflow execution result
#[derive(Debug, Clone)]
pub struct ExecutionResult {
    /// Execution ID
    pub execution_id: ExecutionId,
    /// Final status
    pub status: ExecutionStatus,
    /// Output data
    pub output: WorkflowData,
    /// Execution start time
    pub started_at: u64,
    /// Execution end time
    pub ended_at: Option<u64>,
    /// Execution duration
    pub duration: Option<u64>,
    /// Node execution results
    pub node_results: alloc::collections::BTreeMap<NodeId, NodeResult>,
}

/// Node execution result
#[derive(Debug, Clone)]
pub struct NodeResult {
    /// Node ID
    pub node_id: NodeId,
    /// Execution status
    pub status: ExecutionStatus,
    /// Output data
    pub output: WorkflowData,
    /// Error message if failed
    pub error: Option<alloc::string::String>,
    /// Execution attempts
    pub attempts: u32,
    /// Start time
    pub started_at: u64,
    /// End time
    pub ended_at: Option<u64>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_workflow_builder() {
        let workflow = Workflow::builder("test-workflow")
            .description("A test workflow")
            .version("1.0.0")
            .build();

        assert_eq!(workflow.name, "test-workflow");
        assert_eq!(workflow.version, "1.0.0");
        assert!(workflow.id.contains("test-workflow"));
    }

    #[test]
    fn test_workflow_node() {
        let node = WorkflowNode::new("test-node")
            .name("Test Node")
            .timeout(Duration::from_secs(30));

        assert_eq!(node.id, "test-node");
        assert_eq!(node.name, "Test Node");
        assert_eq!(node.timeout, Some(Duration::from_secs(30)));
    }

    #[test]
    fn test_workflow_data() {
        let data = WorkflowData::String("test".into());
        assert!(matches!(data, WorkflowData::String(_)));

        let array = WorkflowData::Array(vec![WorkflowData::Int(1), WorkflowData::Int(2)]);
        assert!(matches!(array, WorkflowData::Array(_)));
    }

    #[test]
    fn test_retry_policy() {
        let policy = RetryPolicy::default();
        assert_eq!(policy.max_attempts, 3);
        assert_eq!(policy.delay, Duration::from_millis(1000));
        assert_eq!(policy.backoff_multiplier, 2.0);
    }

    #[test]
    fn test_workflow_validation() {
        let workflow = Workflow::builder("test")
            .add_node(WorkflowNode::new("node1"))
            .add_node(WorkflowNode::new("node2"))
            .connect("node1", "node2")
            .build();

        // Should validate successfully
        assert!(workflow.validate().is_ok());
    }

    #[test]
    fn test_cyclic_dependency_detection() {
        let workflow = Workflow::builder("cyclic")
            .add_node(WorkflowNode::new("a"))
            .add_node(WorkflowNode::new("b"))
            .connect("a", "b")
            .connect("b", "a") // Creates cycle
            .build();

        // Should detect cycle
        assert!(workflow.validate().is_err());
    }
}
