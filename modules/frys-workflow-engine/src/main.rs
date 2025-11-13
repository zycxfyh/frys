//! Example usage of Frys Workflow Engine with advanced algorithms

use frys_workflow_engine::*;
use core::time::Duration;

/// Example data processing task
async fn data_ingestion_task(ctx: ExecutionContext) -> Result<WorkflowData> {
    println!("🔄 Ingesting data...");
    tokio::time::sleep(Duration::from_millis(500)).await;

    // Simulate data processing
    let data = WorkflowData::Array(vec![
        WorkflowData::Object([
            ("id".into(), WorkflowData::Int(1)),
            ("name".into(), WorkflowData::String("Alice".into())),
            ("score".into(), WorkflowData::Float(95.5)),
        ].into()),
        WorkflowData::Object([
            ("id".into(), WorkflowData::Int(2)),
            ("name".into(), WorkflowData::String("Bob".into())),
            ("score".into(), WorkflowData::Float(87.2)),
        ].into()),
    ]);

    println!("✅ Data ingestion completed");
    Ok(data)
}

/// Example feature engineering task
async fn feature_engineering_task(ctx: ExecutionContext) -> Result<WorkflowData> {
    println!("🔧 Engineering features...");

    // Get input data from previous node
    let input_data = ctx.get("data_ingestion")?;

    // Simulate feature engineering with parallel processing
    tokio::time::sleep(Duration::from_millis(300)).await;

    let features = WorkflowData::Array(vec![
        WorkflowData::Object([
            ("user_id".into(), WorkflowData::Int(1)),
            ("features".into(), WorkflowData::Array(vec![
                WorkflowData::Float(0.8),
                WorkflowData::Float(0.6),
                WorkflowData::Float(0.9),
            ])),
        ].into()),
    ]);

    println!("✅ Feature engineering completed");
    Ok(features)
}

/// Example model training task
async fn model_training_task(ctx: ExecutionContext) -> Result<WorkflowData> {
    println!("🤖 Training model...");

    // Simulate GPU-accelerated training
    tokio::time::sleep(Duration::from_secs(2)).await;

    let model = WorkflowData::Object([
        ("model_type".into(), WorkflowData::String("RandomForest".into())),
        ("accuracy".into(), WorkflowData::Float(0.96)),
        ("auc".into(), WorkflowData::Float(0.94)),
        ("training_time".into(), WorkflowData::Int(120)),
    ].into());

    println!("✅ Model training completed");
    Ok(model)
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("🚀 Frys Workflow Engine - Advanced Example");
    println!("===========================================");

    // Create workflow engine with advanced configuration
    let engine = WorkflowEngine::builder()
        .with_workers(4)
        .with_timeout(Duration::from_secs(600)) // 10 minutes
        .build()
        .await?;

    println!("\n⚙️  Workflow Engine initialized:");
    println!("   Workers: {}", engine.config.worker_count);
    println!("   Timeout: {}s", engine.config.default_timeout.as_secs());
    println!("   Active executions: {}", engine.active_executions());

    // Define an advanced ML pipeline workflow
    let workflow = Workflow::builder("ml-pipeline")
        .description("Advanced Machine Learning Pipeline with Quality Gates")
        .version("2.0.0")

        // Data ingestion node with retry policy
        .add_node(WorkflowNode::new("data_ingestion")
            .name("Data Ingestion")
            .node_type(NodeType::Task)
            .timeout(Duration::from_secs(300))
            .retry_policy(RetryPolicy {
                max_attempts: 3,
                delay: Duration::from_millis(1000),
                backoff_multiplier: 2.0,
                max_delay: Duration::from_millis(10000),
            }))

        // Feature engineering with parallel execution hint
        .add_node(WorkflowNode::new("feature_engineering")
            .name("Feature Engineering")
            .node_type(NodeType::Parallel)
            .depends_on("data_ingestion")
            .timeout(Duration::from_secs(600)))

        // Model training with high priority
        .add_node(WorkflowNode::new("model_training")
            .name("Model Training")
            .node_type(NodeType::Task)
            .depends_on("feature_engineering")
            .timeout(Duration::from_secs(1800)))

        // Model evaluation with conditional logic
        .add_node(WorkflowNode::new("model_evaluation")
            .name("Model Evaluation")
            .node_type(NodeType::Decision)
            .depends_on("model_training")
            .timeout(Duration::from_secs(300)))

        // Connect nodes with conditional flows
        .connect("data_ingestion", "feature_engineering")
        .connect("feature_engineering", "model_training")
        .connect_with_condition("model_training", "model_evaluation",
            WorkflowCondition::OnSuccess)

        .build();

    println!("\n📋 Workflow Definition:");
    println!("   Name: {}", workflow.name);
    println!("   Description: {}", workflow.description);
    println!("   Version: {}", workflow.version);
    println!("   Nodes: {}", workflow.nodes.len());
    println!("   Edges: {}", workflow.edges.len());

    // Validate workflow
    match workflow.validate() {
        Ok(_) => println!("   ✅ Validation: PASSED"),
        Err(e) => {
            println!("   ❌ Validation: FAILED - {}", e);
            return Err(e.into());
        }
    }

    // Determine execution order
    match workflow.execution_order() {
        Ok(order) => {
            println!("   🔀 Execution Order: {:?}", order);
        }
        Err(e) => {
            println!("   ❌ Execution Order: FAILED - {}", e);
            return Err(e.into());
        }
    }

    println!("\n▶️  Executing workflow...");

    // Execute workflow
    let execution_id = engine.execute_workflow(workflow).await?;
    println!("   Execution ID: {}", execution_id);

    // Monitor execution progress
    let start_time = std::time::Instant::now();
    let mut last_status = ExecutionStatus::Pending;

    loop {
        let status = engine.get_execution_status(&execution_id).await?;

        if status != last_status {
            let elapsed = start_time.elapsed();
            println!("   📊 Status: {:?} ({}ms)", status, elapsed.as_millis());
            last_status = status;
        }

        match status {
            ExecutionStatus::Completed => {
                println!("\n🎉 Workflow completed successfully!");
                break;
            }
            ExecutionStatus::Failed => {
                println!("\n💥 Workflow failed!");
                break;
            }
            ExecutionStatus::Timeout => {
                println!("\n⏰ Workflow timed out!");
                break;
            }
            ExecutionStatus::Cancelled => {
                println!("\n🛑 Workflow was cancelled!");
                break;
            }
            _ => {
                tokio::time::sleep(Duration::from_millis(100)).await;
            }
        }
    }

    // Get final execution result
    match engine.get_execution_result(&execution_id).await {
        Ok(result) => {
            println!("\n📈 Execution Summary:");
            println!("   Duration: {}ms", result.duration.unwrap_or(0));
            println!("   Final Status: {:?}", result.status);
            println!("   Nodes Executed: {}", result.node_results.len());

            let successful_nodes = result.node_results.values()
                .filter(|r| r.status == ExecutionStatus::Completed)
                .count();
            let failed_nodes = result.node_results.values()
                .filter(|r| r.status == ExecutionStatus::Failed)
                .count();

            println!("   ✅ Successful: {}", successful_nodes);
            println!("   ❌ Failed: {}", failed_nodes);
        }
        Err(e) => {
            println!("   ❌ Could not get execution result: {}", e);
        }
    }

    // Display final engine statistics
    let stats = engine.stats();
    println!("\n📊 Engine Statistics:");
    println!("   Total Workflows: {}", stats.total_workflows);
    println!("   Active Executions: {}", stats.active_executions);
    println!("   Completed: {}", stats.completed_executions);
    println!("   Failed: {}", stats.failed_executions);
    println!("   Success Rate: {:.1}%", stats.success_rate() * 100.0);
    println!("   Average Execution Time: {:.0}ms", stats.avg_execution_time);

    println!("\n🏁 Example completed successfully!");
    println!("\n💡 This example demonstrates:");
    println!("   • Advanced workflow definition with dependencies");
    println!("   • Retry policies and timeouts");
    println!("   • Real-time execution monitoring");
    println!("   • Comprehensive result analysis");
    println!("   • Engine statistics and performance metrics");

    Ok(())
}
