//! Core agent system types and structures

use crate::*;
use core::time::Duration;

/// Agent unique identifier
pub type AgentId = alloc::string::String;

/// Task unique identifier
pub type TaskId = alloc::string::String;

/// Tool unique identifier
pub type ToolId = alloc::string::String;

/// Agent capabilities
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum Capability {
    /// Web search and browsing
    WebSearch,
    /// Document analysis and processing
    DocumentAnalysis,
    /// Code generation and analysis
    CodeGeneration,
    /// Mathematical calculations
    MathematicalComputation,
    /// Data analysis and visualization
    DataAnalysis,
    /// Report generation
    ReportGeneration,
    /// Email communication
    EmailCommunication,
    /// API integration
    ApiIntegration,
    /// File system operations
    FileSystemAccess,
    /// Database operations
    DatabaseOperations,
    /// Image processing
    ImageProcessing,
    /// Audio processing
    AudioProcessing,
    /// Natural language understanding
    NaturalLanguageUnderstanding,
    /// Knowledge graph construction
    KnowledgeGraphConstruction,
    /// Planning and scheduling
    PlanningAndScheduling,
    /// Quality assurance and testing
    QualityAssurance,
    /// Translation services
    Translation,
    /// Custom capability
    Custom(alloc::string::String),
}

/// Agent configuration
#[derive(Debug, Clone)]
pub struct AgentConfig {
    /// Agent name
    pub name: alloc::string::String,
    /// Agent description
    pub description: alloc::string::String,
    /// Agent capabilities
    pub capabilities: alloc::vec::Vec<Capability>,
    /// Maximum execution time per task (seconds)
    pub max_execution_time: u64,
    /// Maximum memory usage (MB)
    pub max_memory_mb: usize,
    /// Enable learning
    pub learning_enabled: bool,
    /// Safety level
    pub safety_level: SafetyLevel,
    /// Communication preferences
    pub communication_config: CommunicationConfig,
    /// Memory configuration
    pub memory_config: MemoryConfig,
    /// Tool configurations
    pub tool_configs: alloc::collections::BTreeMap<ToolId, ToolConfig>,
}

impl Default for AgentConfig {
    fn default() -> Self {
        Self {
            name: "Default Agent".into(),
            description: "A general-purpose AI agent".into(),
            capabilities: alloc::vec::Vec::new(),
            max_execution_time: DEFAULT_AGENT_TIMEOUT,
            max_memory_mb: 1024, // 1GB
            learning_enabled: true,
            safety_level: SafetyLevel::Medium,
            communication_config: CommunicationConfig::default(),
            memory_config: MemoryConfig::default(),
            tool_configs: alloc::collections::BTreeMap::new(),
        }
    }
}

/// Safety levels for agent operations
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum SafetyLevel {
    /// Minimal safety checks
    Low,
    /// Standard safety measures
    Medium,
    /// High safety with human oversight
    High,
    /// Maximum safety with extensive validation
    Critical,
}

impl SafetyLevel {
    /// Check if human approval is required for operations
    pub fn requires_human_approval(&self, operation_risk: OperationRisk) -> bool {
        match (self, operation_risk) {
            (SafetyLevel::Critical, _) => true,
            (SafetyLevel::High, OperationRisk::High | OperationRisk::Critical) => true,
            _ => false,
        }
    }
}

/// Operation risk levels
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum OperationRisk {
    /// Low risk operations
    Low,
    /// Medium risk operations
    Medium,
    /// High risk operations
    High,
    /// Critical operations requiring special approval
    Critical,
}

/// Communication configuration
#[derive(Debug, Clone)]
pub struct CommunicationConfig {
    /// Preferred communication style
    pub style: CommunicationStyle,
    /// Response verbosity
    pub verbosity: VerbosityLevel,
    /// Enable multi-modal communication
    pub multi_modal_enabled: bool,
    /// Maximum response length
    pub max_response_length: usize,
}

impl Default for CommunicationConfig {
    fn default() -> Self {
        Self {
            style: CommunicationStyle::Professional,
            verbosity: VerbosityLevel::Balanced,
            multi_modal_enabled: true,
            max_response_length: 4096,
        }
    }
}

/// Communication styles
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CommunicationStyle {
    /// Professional and formal
    Professional,
    /// Friendly and approachable
    Friendly,
    /// Technical and detailed
    Technical,
    /// Concise and direct
    Concise,
    /// Adaptive based on context
    Adaptive,
}

/// Verbosity levels
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum VerbosityLevel {
    /// Minimal responses
    Minimal,
    /// Balanced information
    Balanced,
    /// Detailed explanations
    Detailed,
    /// Comprehensive with all details
    Comprehensive,
}

/// Memory configuration
#[derive(Debug, Clone)]
pub struct MemoryConfig {
    /// Episodic memory configuration
    pub episodic: EpisodicMemoryConfig,
    /// Semantic memory configuration
    pub semantic: SemanticMemoryConfig,
    /// Procedural memory configuration
    pub procedural: ProceduralMemoryConfig,
    /// Memory persistence strategy
    pub persistence: MemoryPersistence,
}

impl Default for MemoryConfig {
    fn default() -> Self {
        Self {
            episodic: EpisodicMemoryConfig::default(),
            semantic: SemanticMemoryConfig::default(),
            procedural: ProceduralMemoryConfig::default(),
            persistence: MemoryPersistence::InMemory,
        }
    }
}

/// Episodic memory configuration
#[derive(Debug, Clone)]
pub struct EpisodicMemoryConfig {
    /// Maximum number of episodes to store
    pub capacity: usize,
    /// Consolidation threshold
    pub consolidation_threshold: f64,
    /// Memory forgetting rate
    pub forgetting_rate: f64,
}

impl Default for EpisodicMemoryConfig {
    fn default() -> Self {
        Self {
            capacity: 10_000,
            consolidation_threshold: MEMORY_CONSOLIDATION_THRESHOLD,
            forgetting_rate: 0.01,
        }
    }
}

/// Semantic memory configuration
#[derive(Debug, Clone)]
pub struct SemanticMemoryConfig {
    /// Maximum number of concepts
    pub max_concepts: usize,
    /// Supported relationship types
    pub relationship_types: alloc::vec::Vec<alloc::string::String>,
}

impl Default for SemanticMemoryConfig {
    fn default() -> Self {
        Self {
            max_concepts: 50_000,
            relationship_types: vec![
                "is-a".into(),
                "part-of".into(),
                "causes".into(),
                "related-to".into(),
                "has-property".into(),
            ],
        }
    }
}

/// Procedural memory configuration
#[derive(Debug, Clone)]
pub struct ProceduralMemoryConfig {
    /// Skill retention period
    pub skill_retention_period: Duration,
    /// Enable performance tracking
    pub performance_tracking: bool,
}

impl Default for ProceduralMemoryConfig {
    fn default() -> Self {
        Self {
            skill_retention_period: Duration::from_secs(365 * 24 * 60 * 60), // 1 year
            performance_tracking: true,
        }
    }
}

/// Memory persistence strategies
#[derive(Debug, Clone)]
pub enum MemoryPersistence {
    /// In-memory only (lost on restart)
    InMemory,
    /// File-based persistence
    File {
        /// File path
        path: alloc::string::String,
    },
    /// Database persistence
    Database {
        /// Database URL/connection string
        url: alloc::string::String,
    },
    /// Distributed persistence
    Distributed {
        /// Cluster endpoints
        endpoints: alloc::vec::Vec<alloc::string::String>,
    },
}

/// Tool configuration
#[derive(Debug, Clone)]
pub struct ToolConfig {
    /// Tool enabled
    pub enabled: bool,
    /// Maximum execution time (seconds)
    pub max_execution_time: u64,
    /// Rate limiting (requests per minute)
    pub rate_limit_rpm: usize,
    /// Authentication configuration
    pub auth_config: Option<AuthConfig>,
    /// Custom parameters
    pub parameters: alloc::collections::BTreeMap<alloc::string::String, alloc::string::String>,
}

impl Default for ToolConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            max_execution_time: MAX_TOOL_EXECUTION_TIME,
            rate_limit_rpm: 60,
            auth_config: None,
            parameters: alloc::collections::BTreeMap::new(),
        }
    }
}

/// Authentication configuration
#[derive(Debug, Clone)]
pub struct AuthConfig {
    /// Authentication method
    pub method: AuthMethod,
    /// Credentials
    pub credentials: alloc::collections::BTreeMap<alloc::string::String, alloc::string::String>,
}

/// Authentication methods
#[derive(Debug, Clone)]
pub enum AuthMethod {
    /// No authentication
    None,
    /// API key authentication
    ApiKey,
    /// OAuth2 authentication
    OAuth2,
    /// Basic authentication
    Basic,
    /// JWT token authentication
    Jwt,
    /// Custom authentication
    Custom(alloc::string::String),
}

/// Task priorities
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum TaskPriority {
    /// Low priority task
    Low,
    /// Normal priority task
    Normal,
    /// High priority task
    High,
    /// Critical priority task
    Critical,
    /// Emergency priority task
    Emergency,
}

/// Task status
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TaskStatus {
    /// Task is pending execution
    Pending,
    /// Task is currently executing
    Running,
    /// Task completed successfully
    Completed,
    /// Task failed
    Failed,
    /// Task was cancelled
    Cancelled,
    /// Task is paused
    Paused,
    /// Task timed out
    Timeout,
}

/// Agent status
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AgentStatus {
    /// Agent is idle
    Idle,
    /// Agent is executing a task
    Busy,
    /// Agent is learning/adapting
    Learning,
    /// Agent is in maintenance mode
    Maintenance,
    /// Agent is offline/unavailable
    Offline,
    /// Agent encountered an error
    Error,
}

/// Agent statistics
#[derive(Debug, Clone, Default)]
pub struct AgentStats {
    /// Total tasks executed
    pub tasks_executed: u64,
    /// Successful tasks
    pub tasks_successful: u64,
    /// Failed tasks
    pub tasks_failed: u64,
    /// Average execution time (seconds)
    pub avg_execution_time: f64,
    /// Total uptime (seconds)
    pub uptime_seconds: u64,
    /// Memory usage (MB)
    pub memory_usage_mb: f64,
    /// CPU usage percentage
    pub cpu_usage_percent: f64,
    /// Learning iterations completed
    pub learning_iterations: u64,
    /// Tools used
    pub tools_used: alloc::collections::BTreeMap<ToolId, u64>,
}

/// System resources
#[derive(Debug, Clone)]
pub struct SystemResources {
    /// Available CPU cores
    pub cpu_cores: usize,
    /// Available memory (MB)
    pub memory_mb: usize,
    /// Available disk space (GB)
    pub disk_gb: usize,
    /// Network bandwidth (Mbps)
    pub network_mbps: usize,
    /// GPU available
    pub gpu_available: bool,
    /// GPU memory (MB)
    pub gpu_memory_mb: Option<usize>,
}

impl Default for SystemResources {
    fn default() -> Self {
        Self {
            cpu_cores: num_cpus::get(),
            memory_mb: 8192, // 8GB default assumption
            disk_gb: 100,    // 100GB default assumption
            network_mbps: 100, // 100Mbps default assumption
            gpu_available: false,
            gpu_memory_mb: None,
        }
    }
}

/// Agent metadata
#[derive(Debug, Clone)]
pub struct AgentMetadata {
    /// Agent ID
    pub id: AgentId,
    /// Agent version
    pub version: alloc::string::String,
    /// Creation timestamp
    pub created_at: u64,
    /// Last active timestamp
    pub last_active: u64,
    /// Total runtime (seconds)
    pub total_runtime: u64,
    /// Performance score (0.0 to 1.0)
    pub performance_score: f64,
    /// Trust score (0.0 to 1.0)
    pub trust_score: f64,
    /// Tags for categorization
    pub tags: alloc::vec::Vec<alloc::string::String>,
}

impl Default for AgentMetadata {
    fn default() -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            version: "0.1.0".into(),
            created_at: current_timestamp(),
            last_active: current_timestamp(),
            total_runtime: 0,
            performance_score: 0.5,
            trust_score: 0.5,
            tags: alloc::vec::Vec::new(),
        }
    }
}

/// Get current timestamp (simplified)
fn current_timestamp() -> u64 {
    // In a real implementation, this would use system time
    0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_agent_config() {
        let config = AgentConfig::default();
        assert_eq!(config.name, "Default Agent");
        assert_eq!(config.max_execution_time, DEFAULT_AGENT_TIMEOUT);
        assert_eq!(config.safety_level, SafetyLevel::Medium);
    }

    #[test]
    fn test_safety_levels() {
        assert!(SafetyLevel::High > SafetyLevel::Medium);
        assert!(SafetyLevel::Critical.requires_human_approval(OperationRisk::Low));
        assert!(!SafetyLevel::Low.requires_human_approval(OperationRisk::High));
    }

    #[test]
    fn test_task_priorities() {
        assert!(TaskPriority::High > TaskPriority::Normal);
        assert!(TaskPriority::Emergency > TaskPriority::Critical);
    }

    #[test]
    fn test_memory_config() {
        let config = MemoryConfig::default();
        assert_eq!(config.episodic.capacity, 10_000);
        assert_eq!(config.semantic.max_concepts, 50_000);
        assert!(matches!(config.persistence, MemoryPersistence::InMemory));
    }

    #[test]
    fn test_agent_metadata() {
        let metadata = AgentMetadata::default();
        assert!(!metadata.id.is_empty());
        assert_eq!(metadata.version, "0.1.0");
        assert!(metadata.performance_score >= 0.0 && metadata.performance_score <= 1.0);
    }

    #[test]
    fn test_communication_config() {
        let config = CommunicationConfig::default();
        assert_eq!(config.style, CommunicationStyle::Professional);
        assert_eq!(config.verbosity, VerbosityLevel::Balanced);
        assert_eq!(config.max_response_length, 4096);
    }

    #[test]
    fn test_capabilities() {
        let caps = vec![
            Capability::WebSearch,
            Capability::CodeGeneration,
            Capability::Custom("custom-capability".into()),
        ];

        assert!(caps.contains(&Capability::WebSearch));
        assert!(caps.iter().any(|c| matches!(c, Capability::Custom(_))));
    }
}
