//! # Frys Agent System
//!
//! Frys Agent System is an advanced framework for building intelligent autonomous agents
//! with sophisticated reasoning, planning, and execution capabilities. It provides a
//! comprehensive toolkit for creating AI agents that can understand, reason, and act
//! in complex environments.
//!
//! ## Features
//!
//! - **Advanced Reasoning**: Multi-modal reasoning with symbolic and neural approaches
//! - **Goal-Oriented Planning**: Hierarchical task planning with dependency management
//! - **Memory Systems**: Episodic, semantic, and procedural memory with persistence
//! - **Tool Integration**: Seamless integration with external tools and APIs
//! - **Multi-Agent Coordination**: Communication and coordination between agents
//! - **Learning and Adaptation**: Continuous learning from interactions and feedback
//! - **Safety and Alignment**: Built-in safety mechanisms and value alignment
//! - **Monitoring and Debugging**: Comprehensive observability and debugging tools
//!
//! ## Example
//!
//! ```rust,no_run
//! use frys_agent_system::*;
//!
//! #[tokio::main]
//! async fn main() -> Result<(), Box<dyn std::error::Error>> {
//!     // Create an intelligent agent
//!     let agent = Agent::builder()
//!         .with_name("Research Assistant")
//!         .with_capabilities(vec![
//!             Capability::WebSearch,
//!             Capability::DocumentAnalysis,
//!             Capability::ReportGeneration,
//!         ])
//!         .with_memory_system(MemorySystem::Episodic)
//!         .with_planning_engine(PlanningEngine::Hierarchical)
//!         .with_llm_model("gpt-4")
//!         .build()
//!         .await?;
//!
//!     // Define a complex task
//!     let task = Task::new(
//!         "Research quantum computing advancements",
//!         TaskPriority::High,
//!         vec![
//!             Goal::GatherInformation {
//!                 topic: "quantum computing".into(),
//!                 depth: ResearchDepth::Comprehensive,
//!             },
//!             Goal::AnalyzeTrends,
//!             Goal::GenerateReport {
//!                 format: ReportFormat::Markdown,
//!                 sections: vec!["Introduction".into(), "Current State".into(), "Future Outlook".into()],
//!             },
//!         ],
//!     );
//!
//!     // Execute the task
//!     let result = agent.execute_task(task).await?;
//!
//!     match result {
//!         TaskResult::Completed { output, artifacts } => {
//!             println!("Task completed successfully!");
//!             println!("Output: {}", output);
//!             println!("Generated {} artifacts", artifacts.len());
//!         }
//!         TaskResult::Failed { error, partial_output } => {
//!             println!("Task failed: {}", error);
//!             if let Some(output) = partial_output {
//!                 println!("Partial output: {}", output);
//!             }
//!         }
//!         TaskResult::Cancelled => {
//!             println!("Task was cancelled");
//!         }
//!     }
//!
//!     Ok(())
//! }
//! ```
//!
//! ## Advanced Capabilities
//!
//! ### Multi-Agent Systems
//!
//! ```rust,no_run
//! // Create a multi-agent system
//! let system = MultiAgentSystem::new()
//!     .with_agents(vec![
//!         Agent::researcher("quantum_physics"),
//!         Agent::writer("technical_reports"),
//!         Agent::reviewer("scientific_accuracy"),
//!     ])
//!     .with_coordination_strategy(CoordinationStrategy::Hierarchical)
//!     .build()
//!     .await?;
//!
//! // Execute collaborative tasks
//! let collaborative_task = CollaborativeTask::new(
//!     "Write comprehensive quantum computing review",
//!     vec![
//!         Role::Researcher { focus: "technical_details".into() },
//!         Role::Writer { style: "academic".into() },
//!         Role::Reviewer { expertise: "physics".into() },
//!     ],
//! );
//!
//! let result = system.execute_collaborative_task(collaborative_task).await?;
//! ```
//!
//! ### Tool Integration
//!
//! ```rust,no_run
//! // Define custom tools
//! let tools = vec![
//!     Tool::WebSearch {
//!         name: "web_search".into(),
//!         description: "Search the web for information".into(),
//!         parameters: vec![
//!             ToolParameter::String {
//!                 name: "query".into(),
//!                 description: "Search query".into(),
//!                 required: true,
//!             },
//!         ],
//!         handler: Box::new(|params| async move {
//!             // Implement web search logic
//!             Ok(ToolResult::Text("Search results...".into()))
//!         }),
//!     },
//!     Tool::Calculator {
//!         name: "calculator".into(),
//!         description: "Perform mathematical calculations".into(),
//!         precision: 6,
//!     },
//! ];
//!
//! let agent = Agent::builder()
//!     .with_tools(tools)
//!     .build()
//!     .await?;
//! ```
//!
//! ### Memory and Learning
//!
//! ```rust,no_run
//! // Configure advanced memory systems
//! let memory_config = MemoryConfig {
//!     episodic_memory: EpisodicMemoryConfig {
//!         capacity: 10_000,
//!         consolidation_threshold: 0.8,
//!         forgetting_rate: 0.01,
//!     },
//!     semantic_memory: SemanticMemoryConfig {
//!         max_concepts: 50_000,
//!         relationship_types: vec!["is-a".into(), "part-of".into(), "causes".into()],
//!     },
//!     procedural_memory: ProceduralMemoryConfig {
//!         skill_retention_period: Duration::days(365),
//!         performance_tracking: true,
//!     },
//!     persistence: MemoryPersistence::Database {
//!         path: "./agent_memory.db".into(),
//!     },
//! };
//!
//! let agent = Agent::builder()
//!     .with_memory_config(memory_config)
//!     .with_learning_enabled(true)
//!     .build()
//!     .await?;
//! ```
//!
//! ## Architecture
//!
//! The Agent System consists of several sophisticated components:
//!
//! 1. **Core Agent Engine**: Central orchestration and decision making
//! 2. **Reasoning Module**: Multi-paradigm reasoning capabilities
//! 3. **Planning System**: Goal decomposition and task planning
//! 4. **Memory Systems**: Multi-modal memory with persistence
//! 5. **Tool Integration Layer**: External tool and API integration
//! 6. **Communication System**: Inter-agent and human-agent communication
//! 7. **Learning Engine**: Continuous learning and adaptation
//! 8. **Safety Framework**: Alignment and safety mechanisms
//! 9. **Monitoring System**: Performance tracking and debugging
//!
//! ## Safety and Alignment
//!
//! The Agent System includes comprehensive safety mechanisms:
//!
//! - **Value Alignment**: Configurable value systems and ethical guidelines
//! - **Action Validation**: Pre-execution safety checks and constraints
//! - **Error Recovery**: Graceful handling of failures and edge cases
//! - **Resource Limits**: Computational and memory resource management
//! - **Audit Logging**: Complete action traceability and accountability
//! - **Human Oversight**: Human-in-the-loop capabilities for critical decisions
//!
//! ## Performance Goals
//!
//! - **Task Completion**: 95% success rate on well-defined tasks
//! - **Response Time**: < 2 seconds for simple queries, < 30 seconds for complex tasks
//! - **Scalability**: Support for 1000+ concurrent agents in distributed deployment
//! - **Memory Efficiency**: Intelligent memory management with compression
//! - **Learning Rate**: Continuous improvement with each interaction
//!
//! ## Integration
//!
//! The Agent System integrates seamlessly with other Frys components:
//!
//! - **Vector Search**: Semantic memory and retrieval-augmented generation
//! - **Workflow Engine**: Complex task orchestration and automation
//! - **Plugin System**: Extensible capabilities through plugins
//! - **Event Bus**: Real-time communication and coordination
//! - **Configuration System**: Dynamic agent configuration management

#![cfg_attr(not(feature = "std"), no_std)]
#![warn(missing_docs)]
#![warn(rust_2018_idioms)]
#![warn(clippy::all)]
#![warn(clippy::pedantic)]

// Public API exports
pub mod core;
pub mod intelligence;
pub mod communication;
pub mod memory;
pub mod execution;
pub mod monitoring;
pub mod multimodal;

// Re-exports for convenience
pub use core::*;
pub use intelligence::*;
pub use communication::*;
pub use memory::*;
pub use execution::*;
pub use multimodal::*;

// Error types
mod error;
pub use error::*;

// Type aliases
#[cfg(feature = "std")]
pub type Result<T> = std::result::Result<T, AgentError>;
#[cfg(not(feature = "std"))]
pub type Result<T> = core::result::Result<T, AgentError>;

// Constants
pub const DEFAULT_AGENT_TIMEOUT: u64 = 300; // 5 minutes
pub const MAX_TOOL_EXECUTION_TIME: u64 = 60; // 1 minute
pub const MEMORY_CONSOLIDATION_THRESHOLD: f64 = 0.7;
pub const MAX_PLANNING_DEPTH: usize = 10;
pub const DEFAULT_LEARNING_RATE: f64 = 0.01;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_constants() {
        assert_eq!(DEFAULT_AGENT_TIMEOUT, 300);
        assert_eq!(MAX_TOOL_EXECUTION_TIME, 60);
        assert_eq!(MEMORY_CONSOLIDATION_THRESHOLD, 0.7);
        assert_eq!(MAX_PLANNING_DEPTH, 10);
        assert_eq!(DEFAULT_LEARNING_RATE, 0.01);
    }
}
