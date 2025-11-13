//! # Frys Workflow Engine
//!
//! Frys Workflow Engine is a distributed workflow execution system with DAG support,
//! designed for complex business process orchestration and automation.
//!
//! ## Features
//!
//! - **DAG Execution**: Directed Acyclic Graph workflow execution
//! - **Distributed Processing**: Multi-node workflow execution
//! - **Fault Tolerance**: Automatic retry and recovery mechanisms
//! - **Dynamic Scaling**: Elastic worker pools and load balancing
//! - **Monitoring**: Comprehensive workflow monitoring and metrics
//! - **DSL Support**: Domain-specific language for workflow definition
//! - **Persistence**: Durable workflow state storage
//! - **Real-time Updates**: Live workflow execution tracking
//!
//! ## Example
//!
//! ```rust,no_run
//! use frys_workflow_engine::*;
//!
//! #[tokio::main]
//! async fn main() -> Result<(), Box<dyn std::error::Error>> {
//!     // Create workflow engine
//!     let engine = WorkflowEngine::builder()
//!         .with_workers(4)
//!         .with_persistence("./workflows.db")
//!         .build()
//!         .await?;
//!
//!     // Define a simple workflow
//!     let workflow = Workflow::builder("data-processing")
//!         .add_node(Node::new("extract")
//!             .with_task(|ctx| async move {
//!                 println!("Extracting data...");
//!                 Ok(WorkflowData::String("extracted_data".into()))
//!             }))
//!         .add_node(Node::new("transform")
//!             .with_task(|ctx| async move {
//!                 let input = ctx.get_input("extract")?;
//!                 println!("Transforming: {:?}", input);
//!                 Ok(WorkflowData::String("transformed_data".into()))
//!             }))
//!         .connect("extract", "transform")
//!         .build();
//!
//!     // Execute workflow
//!     let execution_id = engine.execute_workflow(workflow).await?;
//!
//!     // Monitor execution
//!     let status = engine.get_execution_status(execution_id).await?;
//!     println!("Workflow status: {:?}", status);
//!
//!     Ok(())
//! }
//! ```
//!
//! ## Architecture
//!
//! The Workflow Engine consists of several key components:
//!
//! 1. **WorkflowEngine**: Main orchestration engine
//! 2. **WorkflowExecutor**: Executes individual workflows
//! 3. **NodeExecutor**: Executes workflow nodes/tasks
//! 4. **WorkflowStore**: Persistent workflow storage
//! 5. **ExecutionTracker**: Tracks workflow execution state
//! 6. **WorkerPool**: Manages execution workers
//! 7. **WorkflowDSL**: Domain-specific language parser
//!
//! ## Performance Goals
//!
//! - **Throughput**: 1000+ workflows per second
//! - **Latency**: < 10ms workflow startup time
//! - **Scalability**: Linear scaling with worker nodes
//! - **Reliability**: > 99.9% successful execution rate
//! - **Persistence**: < 1ms state persistence latency

#![cfg_attr(not(feature = "std"), no_std)]
#![warn(missing_docs)]
#![warn(rust_2018_idioms)]
#![warn(clippy::all)]
#![warn(clippy::pedantic)]

// Public API exports
pub mod core;
pub mod engine;
pub mod executor;
pub mod nodes;
pub mod flows;
pub mod dsl;
pub mod concurrent;
pub mod designer;
pub mod events;
pub mod versioning;
pub mod analytics;

// Re-exports for convenience
pub use core::*;
pub use engine::*;
pub use executor::*;
pub use nodes::*;
pub use flows::*;
pub use concurrent::*;
pub use designer::*;
pub use events::*;
pub use versioning::*;
pub use analytics::*;

// Error types
mod error;
pub use error::*;

// Type aliases
#[cfg(feature = "std")]
pub type Result<T> = std::result::Result<T, WorkflowError>;
#[cfg(not(feature = "std"))]
pub type Result<T> = core::result::Result<T, WorkflowError>;

// Constants
pub const DEFAULT_WORKFLOW_TIMEOUT: u64 = 300; // 5 minutes
pub const MAX_WORKFLOW_NODES: usize = 1000;
pub const MAX_CONCURRENT_WORKFLOWS: usize = 10000;
pub const DEFAULT_WORKER_POOL_SIZE: usize = 4;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_constants() {
        assert_eq!(DEFAULT_WORKFLOW_TIMEOUT, 300);
        assert!(MAX_WORKFLOW_NODES > 0);
        assert!(MAX_CONCURRENT_WORKFLOWS > 0);
        assert!(DEFAULT_WORKER_POOL_SIZE > 0);
    }
}
