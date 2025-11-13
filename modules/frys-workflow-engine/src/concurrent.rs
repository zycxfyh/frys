//! Concurrent workflow execution engine

use crate::*;
use alloc::collections::{BTreeMap, VecDeque};
use alloc::sync::Arc;
use core::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use alloc::vec::Vec;

/// Concurrent execution engine
pub struct ConcurrentExecutor {
    /// Worker pool
    workers: Vec<Worker>,
    /// Task queue
    task_queue: Arc<TaskQueue>,
    /// Active executions
    active_executions: BTreeMap<String, ExecutionContext>,
    /// Execution statistics
    stats: ExecutionStats,
    /// Shutdown signal
    shutdown: Arc<AtomicBool>,
}

impl ConcurrentExecutor {
    /// Create new concurrent executor
    pub fn new(worker_count: usize) -> Self {
        let task_queue = Arc::new(TaskQueue::new());
        let shutdown = Arc::new(AtomicBool::new(false));

        let mut workers = Vec::new();
        for i in 0..worker_count {
            let worker = Worker::new(i, Arc::clone(&task_queue), Arc::clone(&shutdown));
            workers.push(worker);
        }

        Self {
            workers,
            task_queue,
            active_executions: BTreeMap::new(),
            stats: ExecutionStats::default(),
            shutdown,
        }
    }

    /// Execute workflow concurrently
    pub async fn execute_workflow(&mut self, workflow: Workflow) -> Result<String> {
        let execution_id = generate_execution_id();
        let context = ExecutionContext::new(execution_id.clone(), workflow);

        // Initialize execution
        self.active_executions.insert(execution_id.clone(), context);
        self.stats.total_executions.fetch_add(1, Ordering::Relaxed);

        // Start execution by queuing initial tasks
        self.start_execution(&execution_id).await?;

        Ok(execution_id)
    }

    /// Start execution of a workflow
    async fn start_execution(&mut self, execution_id: &str) -> Result<()> {
        if let Some(context) = self.active_executions.get_mut(execution_id) {
            // Find nodes with no dependencies (starting nodes)
            let starting_nodes = context.workflow.find_starting_nodes();

            for node_id in starting_nodes {
                let task = ExecutionTask {
                    execution_id: execution_id.to_string(),
                    node_id: node_id.clone(),
                    node: context.workflow.get_node(&node_id).unwrap().clone(),
                    dependencies: Vec::new(),
                };

                self.task_queue.push(task).await?;
            }

            context.status = ExecutionStatus::Running;
        }

        Ok(())
    }

    /// Get execution status
    pub fn get_execution_status(&self, execution_id: &str) -> Option<ExecutionStatus> {
        self.active_executions.get(execution_id).map(|ctx| ctx.status.clone())
    }

    /// Cancel execution
    pub async fn cancel_execution(&mut self, execution_id: &str) -> Result<()> {
        if let Some(context) = self.active_executions.get_mut(execution_id) {
            context.status = ExecutionStatus::Cancelled;

            // Remove pending tasks for this execution
            self.task_queue.remove_execution_tasks(execution_id).await?;
        }

        Ok(())
    }

    /// Get execution results
    pub fn get_execution_results(&self, execution_id: &str) -> Option<&BTreeMap<String, NodeResult>> {
        self.active_executions.get(execution_id)
            .map(|ctx| &ctx.node_results)
    }

    /// Get execution statistics
    pub fn get_stats(&self) -> ExecutionStatsSnapshot {
        ExecutionStatsSnapshot {
            total_executions: self.stats.total_executions.load(Ordering::Relaxed),
            active_executions: self.active_executions.len(),
            completed_executions: self.stats.completed_executions.load(Ordering::Relaxed),
            failed_executions: self.stats.failed_executions.load(Ordering::Relaxed),
            average_execution_time: self.stats.average_execution_time(),
        }
    }

    /// Shutdown executor
    pub async fn shutdown(&mut self) -> Result<()> {
        // Signal shutdown
        self.shutdown.store(true, Ordering::Relaxed);

        // Wait for workers to finish
        for worker in &mut self.workers {
            worker.join().await?;
        }

        Ok(())
    }
}

/// Worker thread for task execution
pub struct Worker {
    id: usize,
    task_queue: Arc<TaskQueue>,
    shutdown: Arc<AtomicBool>,
}

impl Worker {
    pub fn new(id: usize, task_queue: Arc<TaskQueue>, shutdown: Arc<AtomicBool>) -> Self {
        Self {
            id,
            task_queue,
            shutdown,
        }
    }

    /// Start worker loop
    pub async fn run(&mut self) -> Result<()> {
        loop {
            if self.shutdown.load(Ordering::Relaxed) {
                break;
            }

            // Try to get next task
            if let Some(task) = self.task_queue.pop().await {
                self.execute_task(task).await?;
            } else {
                // No tasks available, wait a bit
                tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
            }
        }

        Ok(())
    }

    /// Join worker (wait for completion)
    pub async fn join(&mut self) -> Result<()> {
        // Wait for worker to finish
        Ok(())
    }

    async fn execute_task(&mut self, task: ExecutionTask) -> Result<()> {
        // Execute the node task
        let result = match task.node.task {
            NodeTask::Function(func) => {
                let ctx = ExecutionContextData {
                    execution_id: task.execution_id.clone(),
                    node_id: task.node_id.clone(),
                    inputs: task.dependencies,
                };

                func.execute(&ctx).await
            }
            NodeTask::SubWorkflow(_) => {
                // Handle sub-workflow execution
                Ok(WorkflowData::String("subworkflow_result".to_string()))
            }
        };

        // Handle execution result
        match result {
            Ok(output) => {
                self.handle_task_success(task, output).await?;
            }
            Err(error) => {
                self.handle_task_failure(task, error).await?;
            }
        }

        Ok(())
    }

    async fn handle_task_success(&mut self, task: ExecutionTask, output: WorkflowData) -> Result<()> {
        // Store result in execution context
        // Queue dependent tasks

        // Find dependent nodes
        let dependents = self.get_dependent_nodes(&task).await?;

        for dependent_id in dependents {
            // Check if all dependencies are satisfied
            if self.are_dependencies_satisfied(&dependent_id, &task.execution_id).await? {
                // Queue dependent task
                let dependent_task = self.create_dependent_task(&dependent_id, &task.execution_id).await?;
                self.task_queue.push(dependent_task).await?;
            }
        }

        Ok(())
    }

    async fn handle_task_failure(&mut self, task: ExecutionTask, error: WorkflowError) -> Result<()> {
        // Handle task failure - could implement retry logic, failure handling, etc.
        println!("Task {} failed: {:?}", task.node_id, error);
        Ok(())
    }

    async fn get_dependent_nodes(&self, task: &ExecutionTask) -> Result<Vec<String>> {
        // Get nodes that depend on the completed task
        // This would query the workflow structure
        Ok(vec![]) // Placeholder
    }

    async fn are_dependencies_satisfied(&self, node_id: &str, execution_id: &str) -> Result<bool> {
        // Check if all dependencies of a node are satisfied
        // This would check the execution state
        Ok(true) // Placeholder
    }

    async fn create_dependent_task(&self, node_id: &str, execution_id: &str) -> Result<ExecutionTask> {
        // Create a new execution task for a dependent node
        // This would create the task with proper dependencies
        Err(WorkflowError::InvalidNode(node_id.to_string())) // Placeholder
    }
}

/// Task queue for concurrent execution
pub struct TaskQueue {
    queue: tokio::sync::Mutex<VecDeque<ExecutionTask>>,
    semaphore: tokio::sync::Semaphore,
}

impl TaskQueue {
    pub fn new() -> Self {
        Self {
            queue: tokio::sync::Mutex::new(VecDeque::new()),
            semaphore: tokio::sync::Semaphore::new(0),
        }
    }

    /// Push task to queue
    pub async fn push(&self, task: ExecutionTask) -> Result<()> {
        {
            let mut queue = self.queue.lock().await;
            queue.push_back(task);
        }
        self.semaphore.add_permits(1);
        Ok(())
    }

    /// Pop task from queue
    pub async fn pop(&self) -> Option<ExecutionTask> {
        let _permit = self.semaphore.acquire().await.ok()?;
        let mut queue = self.queue.lock().await;
        queue.pop_front()
    }

    /// Remove all tasks for a specific execution
    pub async fn remove_execution_tasks(&self, execution_id: &str) -> Result<()> {
        let mut queue = self.queue.lock().await;
        queue.retain(|task| task.execution_id != execution_id);
        Ok(())
    }
}

/// Execution task
#[derive(Debug, Clone)]
pub struct ExecutionTask {
    /// Execution ID
    pub execution_id: String,
    /// Node ID
    pub node_id: String,
    /// Node to execute
    pub node: Node,
    /// Dependency results
    pub dependencies: Vec<(String, WorkflowData)>,
}

/// Execution context
#[derive(Debug, Clone)]
pub struct ExecutionContext {
    /// Execution ID
    pub execution_id: String,
    /// Workflow being executed
    pub workflow: Workflow,
    /// Current status
    pub status: ExecutionStatus,
    /// Node execution results
    pub node_results: BTreeMap<String, NodeResult>,
    /// Start time
    pub start_time: u64,
}

impl ExecutionContext {
    pub fn new(execution_id: String, workflow: Workflow) -> Self {
        Self {
            execution_id,
            workflow,
            status: ExecutionStatus::Pending,
            node_results: BTreeMap::new(),
            start_time: current_timestamp(),
        }
    }
}

/// Execution status
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
}

/// Node execution result
#[derive(Debug, Clone)]
pub struct NodeResult {
    /// Node ID
    pub node_id: String,
    /// Execution result
    pub result: Result<WorkflowData, WorkflowError>,
    /// Execution time
    pub execution_time: u64,
    /// Start time
    pub start_time: u64,
}

/// Execution context data passed to tasks
#[derive(Debug, Clone)]
pub struct ExecutionContextData {
    /// Execution ID
    pub execution_id: String,
    /// Current node ID
    pub node_id: String,
    /// Input data from dependencies
    pub inputs: Vec<(String, WorkflowData)>,
}

/// Execution statistics
#[derive(Debug, Default)]
pub struct ExecutionStats {
    /// Total executions started
    pub total_executions: AtomicUsize,
    /// Completed executions
    pub completed_executions: AtomicUsize,
    /// Failed executions
    pub failed_executions: AtomicUsize,
    /// Total execution time
    pub total_execution_time: AtomicUsize,
}

impl ExecutionStats {
    pub fn average_execution_time(&self) -> f64 {
        let total_time = self.total_execution_time.load(Ordering::Relaxed);
        let completed = self.completed_executions.load(Ordering::Relaxed);

        if completed > 0 {
            total_time as f64 / completed as f64
        } else {
            0.0
        }
    }
}

/// Execution statistics snapshot
#[derive(Debug, Clone)]
pub struct ExecutionStatsSnapshot {
    /// Total executions started
    pub total_executions: usize,
    /// Currently active executions
    pub active_executions: usize,
    /// Completed executions
    pub completed_executions: usize,
    /// Failed executions
    pub failed_executions: usize,
    /// Average execution time (milliseconds)
    pub average_execution_time: f64,
}

/// Generate unique execution ID
fn generate_execution_id() -> String {
    use core::sync::atomic::{AtomicU64, Ordering};
    static COUNTER: AtomicU64 = AtomicU64::new(0);

    let id = COUNTER.fetch_add(1, Ordering::Relaxed);
    alloc::format!("exec_{}", id)
}

/// Get current timestamp
fn current_timestamp() -> u64 {
    0 // Placeholder
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_concurrent_executor_creation() {
        let executor = ConcurrentExecutor::new(4);
        assert_eq!(executor.workers.len(), 4);
    }

    #[tokio::test]
    async fn test_task_queue() {
        let queue = Arc::new(TaskQueue::new());

        let task = ExecutionTask {
            execution_id: "test".to_string(),
            node_id: "node1".to_string(),
            node: Node::new("test".to_string()),
            dependencies: vec![],
        };

        // Push task
        queue.push(task.clone()).await.unwrap();

        // Pop task
        let popped = queue.pop().await;
        assert!(popped.is_some());
        assert_eq!(popped.unwrap().execution_id, "test");
    }

    #[test]
    fn test_execution_stats() {
        let stats = ExecutionStats::default();
        assert_eq!(stats.average_execution_time(), 0.0);
    }

    #[test]
    fn test_execution_status() {
        let status = ExecutionStatus::Pending;
        assert_eq!(status, ExecutionStatus::Pending);
    }
}
