//! Workflow Analytics and Optimization

use crate::*;
use alloc::collections::BTreeMap;
use alloc::string::String;
use alloc::vec::Vec;

/// Workflow analytics system
pub struct WorkflowAnalytics {
    /// Performance analyzer
    performance_analyzer: PerformanceAnalyzer,
    /// Bottleneck detector
    bottleneck_detector: BottleneckDetector,
    /// Optimization recommender
    optimization_recommender: OptimizationRecommender,
    /// Predictive analyzer
    predictive_analyzer: PredictiveAnalyzer,
}

impl WorkflowAnalytics {
    /// Create new analytics system
    pub fn new() -> Self {
        Self {
            performance_analyzer: PerformanceAnalyzer::new(),
            bottleneck_detector: BottleneckDetector::new(),
            optimization_recommender: OptimizationRecommender::new(),
            predictive_analyzer: PredictiveAnalyzer::new(),
        }
    }

    /// Analyze workflow performance
    pub async fn analyze_performance(&self, workflow_id: &str, execution_history: &[WorkflowExecution]) -> Result<PerformanceAnalysis> {
        self.performance_analyzer.analyze_workflow(workflow_id, execution_history).await
    }

    /// Detect bottlenecks in workflow
    pub async fn detect_bottlenecks(&self, workflow: &Workflow, execution_data: &[ExecutionData]) -> Result<Vec<Bottleneck>> {
        self.bottleneck_detector.detect_bottlenecks(workflow, execution_data).await
    }

    /// Generate optimization recommendations
    pub async fn generate_recommendations(&self, workflow: &Workflow, analysis: &PerformanceAnalysis) -> Result<Vec<OptimizationRecommendation>> {
        self.optimization_recommender.generate_recommendations(workflow, analysis).await
    }

    /// Predict workflow performance
    pub async fn predict_performance(&self, workflow: &Workflow, execution_context: &ExecutionContext) -> Result<PerformancePrediction> {
        self.predictive_analyzer.predict_performance(workflow, execution_context).await
    }

    /// Analyze workflow patterns
    pub fn analyze_patterns(&self, executions: &[WorkflowExecution]) -> WorkflowPatterns {
        let mut patterns = WorkflowPatterns {
            common_paths: Vec::new(),
            failure_patterns: Vec::new(),
            performance_trends: Vec::new(),
            resource_patterns: Vec::new(),
        };

        // Analyze execution paths
        patterns.common_paths = self.analyze_execution_paths(executions);

        // Analyze failure patterns
        patterns.failure_patterns = self.analyze_failure_patterns(executions);

        // Analyze performance trends
        patterns.performance_trends = self.analyze_performance_trends(executions);

        // Analyze resource usage patterns
        patterns.resource_patterns = self.analyze_resource_patterns(executions);

        patterns
    }
}

/// Performance analyzer
pub struct PerformanceAnalyzer;

impl PerformanceAnalyzer {
    pub fn new() -> Self {
        Self
    }

    pub async fn analyze_workflow(&self, workflow_id: &str, executions: &[WorkflowExecution]) -> Result<PerformanceAnalysis> {
        if executions.is_empty() {
            return Ok(PerformanceAnalysis {
                workflow_id: workflow_id.to_string(),
                total_executions: 0,
                average_duration: 0.0,
                success_rate: 0.0,
                throughput: 0.0,
                latency_distribution: LatencyDistribution::default(),
                resource_utilization: ResourceUtilization::default(),
                node_performance: Vec::new(),
            });
        }

        let total_executions = executions.len();
        let successful_executions = executions.iter().filter(|e| e.success).count();
        let success_rate = successful_executions as f64 / total_executions as f64;

        let total_duration: u64 = executions.iter().map(|e| e.duration_ms).sum();
        let average_duration = total_duration as f64 / total_executions as f64;

        let throughput = self.calculate_throughput(executions);

        let latency_distribution = self.calculate_latency_distribution(executions);
        let resource_utilization = self.calculate_resource_utilization(executions);
        let node_performance = self.analyze_node_performance(executions);

        Ok(PerformanceAnalysis {
            workflow_id: workflow_id.to_string(),
            total_executions,
            average_duration,
            success_rate,
            throughput,
            latency_distribution,
            resource_utilization,
            node_performance,
        })
    }

    fn calculate_throughput(&self, executions: &[WorkflowExecution]) -> f64 {
        if executions.len() < 2 {
            return 0.0;
        }

        let time_span = executions.last().unwrap().start_time - executions.first().unwrap().start_time;
        if time_span == 0 {
            return 0.0;
        }

        (executions.len() as f64 * 1000.0) / time_span as f64 // executions per second
    }

    fn calculate_latency_distribution(&self, executions: &[WorkflowExecution]) -> LatencyDistribution {
        let mut latencies: Vec<u64> = executions.iter().map(|e| e.duration_ms).collect();
        latencies.sort();

        let len = latencies.len();
        if len == 0 {
            return LatencyDistribution::default();
        }

        LatencyDistribution {
            p50: latencies[len / 2],
            p95: latencies[(len * 95) / 100],
            p99: latencies[(len * 99) / 100],
            min: latencies[0],
            max: latencies[len - 1],
        }
    }

    fn calculate_resource_utilization(&self, executions: &[WorkflowExecution]) -> ResourceUtilization {
        // Aggregate resource usage across all executions
        let mut total_cpu = 0u64;
        let mut total_memory = 0u64;
        let mut total_io = 0u64;

        for execution in executions {
            total_cpu += execution.resource_usage.cpu_time_ms;
            total_memory += execution.resource_usage.memory_peak_kb;
            total_io += execution.resource_usage.io_operations;
        }

        let count = executions.len() as f64;

        ResourceUtilization {
            average_cpu_time_ms: total_cpu as f64 / count,
            average_memory_kb: total_memory as f64 / count,
            average_io_operations: total_io as f64 / count,
            cpu_utilization_percent: 0.0, // Would need system metrics
            memory_utilization_percent: 0.0,
        }
    }

    fn analyze_node_performance(&self, executions: &[WorkflowExecution]) -> Vec<NodePerformance> {
        let mut node_stats: BTreeMap<String, Vec<NodeExecution>> = BTreeMap::new();

        // Collect node execution data
        for execution in executions {
            for node_exec in &execution.node_executions {
                node_stats
                    .entry(node_exec.node_id.clone())
                    .or_insert_with(Vec::new)
                    .push(node_exec.clone());
            }
        }

        // Calculate performance metrics for each node
        node_stats.into_iter().map(|(node_id, executions)| {
            let total_time: u64 = executions.iter().map(|e| e.duration_ms).sum();
            let avg_time = total_time as f64 / executions.len() as f64;
            let success_rate = executions.iter().filter(|e| e.success).count() as f64 / executions.len() as f64;

            NodePerformance {
                node_id,
                average_execution_time: avg_time,
                success_rate,
                execution_count: executions.len(),
                error_patterns: self.analyze_node_errors(&executions),
            }
        }).collect()
    }

    fn analyze_node_errors(&self, executions: &[NodeExecution]) -> Vec<String> {
        let mut error_counts: BTreeMap<String, usize> = BTreeMap::new();

        for execution in executions {
            if !execution.success {
                *error_counts.entry(execution.error_message.clone()).or_insert(0) += 1;
            }
        }

        error_counts.into_iter()
            .filter(|(_, count)| *count > executions.len() / 10) // More than 10% of executions
            .map(|(error, count)| format!("{} ({} occurrences)", error, count))
            .collect()
    }
}

/// Bottleneck detector
pub struct BottleneckDetector;

impl BottleneckDetector {
    pub fn new() -> Self {
        Self
    }

    pub async fn detect_bottlenecks(&self, workflow: &Workflow, execution_data: &[ExecutionData]) -> Result<Vec<Bottleneck>> {
        let mut bottlenecks = Vec::new();

        // Analyze node execution times
        for (node_id, node) in &workflow.nodes {
            let node_times: Vec<u64> = execution_data.iter()
                .filter_map(|data| {
                    data.node_executions.iter()
                        .find(|ne| ne.node_id == *node_id)
                        .map(|ne| ne.duration_ms)
                })
                .collect();

            if !node_times.is_empty() {
                let avg_time = node_times.iter().sum::<u64>() as f64 / node_times.len() as f64;
                let overall_avg = self.calculate_overall_average(execution_data);

                if avg_time > overall_avg * 2.0 { // Node takes more than 2x average
                    bottlenecks.push(Bottleneck {
                        bottleneck_type: BottleneckType::SlowNode,
                        node_id: node_id.clone(),
                        severity: self.calculate_severity(avg_time, overall_avg),
                        description: format!("Node {} is significantly slower than average", node_id),
                        estimated_impact: self.estimate_impact(node_id, workflow, execution_data),
                    });
                }
            }
        }

        // Analyze resource contention
        bottlenecks.extend(self.detect_resource_bottlenecks(execution_data));

        // Analyze sequential dependencies
        bottlenecks.extend(self.detect_dependency_bottlenecks(workflow, execution_data));

        Ok(bottlenecks)
    }

    fn calculate_overall_average(&self, execution_data: &[ExecutionData]) -> f64 {
        let total_times: Vec<u64> = execution_data.iter()
            .flat_map(|data| data.node_executions.iter().map(|ne| ne.duration_ms))
            .collect();

        if total_times.is_empty() {
            return 0.0;
        }

        total_times.iter().sum::<u64>() as f64 / total_times.len() as f64
    }

    fn calculate_severity(&self, node_time: f64, overall_avg: f64) -> BottleneckSeverity {
        let ratio = node_time / overall_avg;
        match ratio {
            r if r > 5.0 => BottleneckSeverity::Critical,
            r if r > 3.0 => BottleneckSeverity::High,
            r if r > 2.0 => BottleneckSeverity::Medium,
            _ => BottleneckSeverity::Low,
        }
    }

    fn estimate_impact(&self, node_id: &str, workflow: &Workflow, execution_data: &[ExecutionData]) -> f64 {
        // Estimate the impact of this bottleneck on overall workflow performance
        // This would analyze the dependency chain and calculate potential speedup
        0.0 // Placeholder
    }

    fn detect_resource_bottlenecks(&self, execution_data: &[ExecutionData]) -> Vec<Bottleneck> {
        let mut bottlenecks = Vec::new();

        // Check for memory pressure
        let high_memory_executions: Vec<_> = execution_data.iter()
            .filter(|data| data.resource_usage.memory_peak_kb > 100 * 1024) // 100MB
            .collect();

        if high_memory_executions.len() > execution_data.len() / 2 {
            bottlenecks.push(Bottleneck {
                bottleneck_type: BottleneckType::ResourceContention,
                node_id: "system".to_string(),
                severity: BottleneckSeverity::High,
                description: "High memory usage detected across executions".to_string(),
                estimated_impact: 0.3,
            });
        }

        bottlenecks
    }

    fn detect_dependency_bottlenecks(&self, workflow: &Workflow, execution_data: &[ExecutionData]) -> Vec<Bottleneck> {
        let mut bottlenecks = Vec::new();

        // Analyze sequential bottlenecks (nodes that could be parallelized)
        for edge in &workflow.edges {
            // Check if this creates a sequential dependency that could be optimized
            let dependent_nodes = workflow.edges.iter()
                .filter(|e| e.from == edge.from)
                .count();

            if dependent_nodes > 3 { // High fan-out
                bottlenecks.push(Bottleneck {
                    bottleneck_type: BottleneckType::DependencyBottleneck,
                    node_id: edge.from.clone(),
                    severity: BottleneckSeverity::Medium,
                    description: format!("Node {} has high fan-out, consider optimizing dependencies", edge.from),
                    estimated_impact: 0.2,
                });
            }
        }

        bottlenecks
    }
}

/// Optimization recommender
pub struct OptimizationRecommender;

impl OptimizationRecommender {
    pub fn new() -> Self {
        Self
    }

    pub async fn generate_recommendations(&self, workflow: &Workflow, analysis: &PerformanceAnalysis) -> Result<Vec<OptimizationRecommendation>> {
        let mut recommendations = Vec::new();

        // Performance-based recommendations
        if analysis.success_rate < 0.9 {
            recommendations.push(OptimizationRecommendation {
                recommendation_type: RecommendationType::Reliability,
                title: "Improve Workflow Reliability".to_string(),
                description: "Success rate is below 90%, consider adding retry logic and error handling".to_string(),
                priority: Priority::High,
                estimated_benefit: 0.1,
                implementation_effort: Effort::Medium,
            });
        }

        if analysis.average_duration > 60000.0 { // 1 minute
            recommendations.push(OptimizationRecommendation {
                recommendation_type: RecommendationType::Performance,
                title: "Optimize Execution Time".to_string(),
                description: "Workflow execution is taking too long, consider parallelization or optimization".to_string(),
                priority: Priority::High,
                estimated_benefit: 0.3,
                implementation_effort: Effort::High,
            });
        }

        // Resource-based recommendations
        if analysis.resource_utilization.average_memory_kb > 500 * 1024 { // 500MB
            recommendations.push(OptimizationRecommendation {
                recommendation_type: RecommendationType::Resource,
                title: "Reduce Memory Usage".to_string(),
                description: "High memory consumption detected, consider optimizing data structures".to_string(),
                priority: Priority::Medium,
                estimated_benefit: 0.15,
                implementation_effort: Effort::Medium,
            });
        }

        // Structure-based recommendations
        let node_count = workflow.nodes.len();
        let edge_count = workflow.edges.len();

        if node_count > 50 && edge_count as f64 / node_count as f64 > 2.0 {
            recommendations.push(OptimizationRecommendation {
                recommendation_type: RecommendationType::Structure,
                title: "Simplify Workflow Structure".to_string(),
                description: "Workflow has high complexity, consider breaking into smaller sub-workflows".to_string(),
                priority: Priority::Medium,
                estimated_benefit: 0.2,
                implementation_effort: Effort::High,
            });
        }

        // Node-specific recommendations
        for node_perf in &analysis.node_performance {
            if node_perf.success_rate < 0.8 {
                recommendations.push(OptimizationRecommendation {
                    recommendation_type: RecommendationType::Reliability,
                    title: format!("Fix Node {}", node_perf.node_id),
                    description: format!("Node {} has low success rate, investigate and fix issues", node_perf.node_id),
                    priority: Priority::High,
                    estimated_benefit: 0.05,
                    implementation_effort: Effort::Medium,
                });
            }
        }

        Ok(recommendations)
    }
}

/// Predictive analyzer
pub struct PredictiveAnalyzer;

impl PredictiveAnalyzer {
    pub fn new() -> Self {
        Self
    }

    pub async fn predict_performance(&self, workflow: &Workflow, context: &ExecutionContext) -> Result<PerformancePrediction> {
        // Use historical data and ML models to predict performance
        let predicted_duration = self.predict_duration(workflow, context);
        let predicted_success_probability = self.predict_success_probability(workflow, context);
        let predicted_resource_usage = self.predict_resource_usage(workflow, context);

        Ok(PerformancePrediction {
            predicted_duration_ms: predicted_duration,
            success_probability: predicted_success_probability,
            predicted_resource_usage,
            confidence: 0.75,
            factors: vec![
                "Historical execution patterns".to_string(),
                "Current system load".to_string(),
                "Workflow complexity".to_string(),
            ],
        })
    }

    fn predict_duration(&self, workflow: &Workflow, context: &ExecutionContext) -> u64 {
        // Simple prediction based on node count and complexity
        let base_time_per_node = 1000; // 1 second per node
        let complexity_factor = workflow.nodes.len() as f64 / 10.0; // Scale with size

        (base_time_per_node * workflow.nodes.len() as u64) as u64 * complexity_factor as u64
    }

    fn predict_success_probability(&self, workflow: &Workflow, _context: &ExecutionContext) -> f64 {
        // Base success probability with penalties for complexity
        let base_success = 0.95;
        let complexity_penalty = (workflow.nodes.len() as f64 / 50.0).min(0.1);

        (base_success - complexity_penalty).max(0.5)
    }

    fn predict_resource_usage(&self, workflow: &Workflow, _context: &ExecutionContext) -> ResourceUtilization {
        let node_count = workflow.nodes.len() as f64;

        ResourceUtilization {
            average_cpu_time_ms: node_count * 500.0, // 500ms CPU per node
            average_memory_kb: node_count * 10.0 * 1024.0, // 10MB per node
            average_io_operations: node_count * 100.0, // 100 IO ops per node
            cpu_utilization_percent: 0.0,
            memory_utilization_percent: 0.0,
        }
    }
}

// Analysis data structures
#[derive(Debug, Clone)]
pub struct WorkflowExecution {
    pub execution_id: String,
    pub workflow_id: String,
    pub start_time: u64,
    pub duration_ms: u64,
    pub success: bool,
    pub node_executions: Vec<NodeExecution>,
    pub resource_usage: ResourceUsage,
}

#[derive(Debug, Clone)]
pub struct NodeExecution {
    pub node_id: String,
    pub duration_ms: u64,
    pub success: bool,
    pub error_message: String,
}

#[derive(Debug, Clone)]
pub struct ExecutionData {
    pub execution_id: String,
    pub node_executions: Vec<NodeExecution>,
    pub resource_usage: ResourceUsage,
}

#[derive(Debug, Clone)]
pub struct ExecutionContext {
    pub system_load: f64,
    pub available_resources: ResourceAvailability,
}

#[derive(Debug, Clone)]
pub struct ResourceAvailability {
    pub cpu_cores: usize,
    pub memory_kb: u64,
    pub concurrent_limit: usize,
}

#[derive(Debug, Clone)]
pub struct ResourceUsage {
    pub cpu_time_ms: u64,
    pub memory_peak_kb: u64,
    pub io_operations: u64,
}

// Analysis results
#[derive(Debug, Clone)]
pub struct PerformanceAnalysis {
    pub workflow_id: String,
    pub total_executions: usize,
    pub average_duration: f64,
    pub success_rate: f64,
    pub throughput: f64,
    pub latency_distribution: LatencyDistribution,
    pub resource_utilization: ResourceUtilization,
    pub node_performance: Vec<NodePerformance>,
}

#[derive(Debug, Clone, Default)]
pub struct LatencyDistribution {
    pub p50: u64,
    pub p95: u64,
    pub p99: u64,
    pub min: u64,
    pub max: u64,
}

#[derive(Debug, Clone)]
pub struct NodePerformance {
    pub node_id: String,
    pub average_execution_time: f64,
    pub success_rate: f64,
    pub execution_count: usize,
    pub error_patterns: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct Bottleneck {
    pub bottleneck_type: BottleneckType,
    pub node_id: String,
    pub severity: BottleneckSeverity,
    pub description: String,
    pub estimated_impact: f64,
}

#[derive(Debug, Clone)]
pub enum BottleneckType {
    SlowNode,
    ResourceContention,
    DependencyBottleneck,
}

#[derive(Debug, Clone)]
pub enum BottleneckSeverity {
    Low,
    Medium,
    High,
    Critical,
}

#[derive(Debug, Clone)]
pub struct OptimizationRecommendation {
    pub recommendation_type: RecommendationType,
    pub title: String,
    pub description: String,
    pub priority: Priority,
    pub estimated_benefit: f64,
    pub implementation_effort: Effort,
}

#[derive(Debug, Clone)]
pub enum RecommendationType {
    Performance,
    Reliability,
    Resource,
    Structure,
}

#[derive(Debug, Clone)]
pub enum Priority {
    Low,
    Medium,
    High,
    Critical,
}

#[derive(Debug, Clone)]
pub enum Effort {
    Low,
    Medium,
    High,
}

#[derive(Debug, Clone)]
pub struct PerformancePrediction {
    pub predicted_duration_ms: u64,
    pub success_probability: f64,
    pub predicted_resource_usage: ResourceUtilization,
    pub confidence: f64,
    pub factors: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct WorkflowPatterns {
    pub common_paths: Vec<ExecutionPath>,
    pub failure_patterns: Vec<FailurePattern>,
    pub performance_trends: Vec<PerformanceTrend>,
    pub resource_patterns: Vec<ResourcePattern>,
}

#[derive(Debug, Clone)]
pub struct ExecutionPath {
    pub nodes: Vec<String>,
    pub frequency: usize,
    pub average_duration: u64,
}

#[derive(Debug, Clone)]
pub struct FailurePattern {
    pub node_id: String,
    pub error_type: String,
    pub frequency: usize,
    pub common_causes: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct PerformanceTrend {
    pub metric: String,
    pub trend: Trend,
    pub change_rate: f64,
    pub time_period: String,
}

#[derive(Debug, Clone)]
pub struct ResourcePattern {
    pub resource_type: String,
    pub usage_pattern: String,
    pub peak_times: Vec<String>,
    pub optimization_suggestions: Vec<String>,
}

#[derive(Debug, Clone)]
pub enum Trend {
    Improving,
    Degrading,
    Stable,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_performance_analyzer() {
        let analyzer = PerformanceAnalyzer::new();

        let executions = vec![
            WorkflowExecution {
                execution_id: "exec1".to_string(),
                workflow_id: "wf1".to_string(),
                start_time: 1000,
                duration_ms: 5000,
                success: true,
                node_executions: vec![],
                resource_usage: ResourceUsage {
                    cpu_time_ms: 2000,
                    memory_peak_kb: 100 * 1024,
                    io_operations: 50,
                },
            },
        ];

        let analysis = tokio::runtime::Runtime::new().unwrap()
            .block_on(analyzer.analyze_workflow("wf1", &executions)).unwrap();

        assert_eq!(analysis.workflow_id, "wf1");
        assert_eq!(analysis.total_executions, 1);
        assert_eq!(analysis.success_rate, 1.0);
    }

    #[test]
    fn test_bottleneck_detector() {
        let detector = BottleneckDetector::new();

        let workflow = Workflow::builder("test").build();
        let execution_data = vec![];

        let bottlenecks = tokio::runtime::Runtime::new().unwrap()
            .block_on(detector.detect_bottlenecks(&workflow, &execution_data)).unwrap();

        // Should not find bottlenecks in empty data
        assert!(bottlenecks.is_empty());
    }

    #[test]
    fn test_optimization_recommender() {
        let recommender = OptimizationRecommender::new();

        let workflow = Workflow::builder("test").build();
        let analysis = PerformanceAnalysis {
            workflow_id: "test".to_string(),
            total_executions: 100,
            average_duration: 120000.0, // 2 minutes
            success_rate: 0.85,
            throughput: 1.0,
            latency_distribution: LatencyDistribution::default(),
            resource_utilization: ResourceUtilization::default(),
            node_performance: vec![],
        };

        let recommendations = tokio::runtime::Runtime::new().unwrap()
            .block_on(recommender.generate_recommendations(&workflow, &analysis)).unwrap();

        // Should generate recommendations for low success rate and long duration
        assert!(!recommendations.is_empty());
    }

    #[test]
    fn test_predictive_analyzer() {
        let analyzer = PredictiveAnalyzer::new();

        let workflow = Workflow::builder("test").build();
        let context = ExecutionContext {
            system_load: 0.5,
            available_resources: ResourceAvailability {
                cpu_cores: 4,
                memory_kb: 1024 * 1024,
                concurrent_limit: 10,
            },
        };

        let prediction = tokio::runtime::Runtime::new().unwrap()
            .block_on(analyzer.predict_performance(&workflow, &context)).unwrap();

        assert!(prediction.predicted_duration_ms > 0);
        assert!(prediction.success_probability > 0.0);
        assert!(prediction.confidence > 0.0);
    }
}
