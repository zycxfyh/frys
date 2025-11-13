//! Distributed event routing across cluster nodes

use crate::*;
use alloc::collections::BTreeMap;
use alloc::string::String;
use alloc::vec::Vec;

/// Routing table entry
#[derive(Debug, Clone)]
pub struct RouteEntry {
    /// Target node ID
    pub node_id: alloc::string::String,
    /// Route priority (higher = preferred)
    pub priority: u32,
    /// Route cost (lower = better)
    pub cost: u32,
    /// Last used timestamp
    pub last_used: u64,
    /// Success rate (0.0-1.0)
    pub success_rate: f64,
}

/// Distributed routing table
pub struct DistributedRoutingTable {
    /// Routes by topic pattern
    routes: BTreeMap<alloc::string::String, Vec<RouteEntry>>,
    /// Node capabilities cache
    node_capabilities: BTreeMap<alloc::string::String, NodeCapabilities>,
    /// Local node ID
    local_node_id: alloc::string::String,
}

impl DistributedRoutingTable {
    /// Create new distributed routing table
    pub fn new(local_node_id: alloc::string::String) -> Self {
        Self {
            routes: BTreeMap::new(),
            node_capabilities: BTreeMap::new(),
            local_node_id,
        }
    }

    /// Add route for topic pattern
    pub fn add_route(&mut self, topic_pattern: alloc::string::String, node_id: alloc::string::String, priority: u32) {
        let entry = RouteEntry {
            node_id,
            priority,
            cost: 1, // Default cost
            last_used: 0,
            success_rate: 1.0, // Assume perfect initially
        };

        self.routes.entry(topic_pattern).or_insert_with(Vec::new).push(entry);
    }

    /// Remove route
    pub fn remove_route(&mut self, topic_pattern: &str, node_id: &str) {
        if let Some(routes) = self.routes.get_mut(topic_pattern) {
            routes.retain(|route| route.node_id != node_id);
        }
    }

    /// Update node capabilities
    pub fn update_node_capabilities(&mut self, node_id: alloc::string::String, capabilities: NodeCapabilities) {
        self.node_capabilities.insert(node_id, capabilities);
    }

    /// Route event to appropriate nodes
    pub fn route_event(&mut self, event: &Event) -> Vec<RoutingDecision> {
        let mut decisions = Vec::new();

        // Find matching routes
        for (pattern, routes) in &self.routes {
            if self.matches_pattern(&event.topic, pattern) {
                // Sort routes by priority and cost
                let mut sorted_routes = routes.clone();
                sorted_routes.sort_by(|a, b| {
                    // Higher priority first, then lower cost, then higher success rate
                    b.priority.cmp(&a.priority)
                        .then_with(|| a.cost.cmp(&b.cost))
                        .then_with(|| b.success_rate.partial_cmp(&a.success_rate).unwrap_or(core::cmp::Ordering::Equal))
                });

                // Take top routes (could be multiple for load balancing)
                for route in sorted_routes.into_iter().take(3) {
                    decisions.push(RoutingDecision {
                        node_id: route.node_id.clone(),
                        priority: route.priority,
                        cost: route.cost,
                        estimated_latency: self.estimate_latency(&route),
                        confidence: route.success_rate,
                    });
                }
            }
        }

        // If no routes found, try local routing
        if decisions.is_empty() {
            decisions.push(RoutingDecision {
                node_id: self.local_node_id.clone(),
                priority: 0,
                cost: 0,
                estimated_latency: 0.0,
                confidence: 1.0,
            });
        }

        decisions
    }

    /// Check if topic matches pattern (simple wildcard matching)
    fn matches_pattern(&self, topic: &str, pattern: &str) -> bool {
        if pattern == "*" {
            return true;
        }

        // Simple wildcard matching (* matches any characters)
        let pattern_parts: Vec<&str> = pattern.split('*').collect();
        let mut topic_pos = 0;

        for (i, part) in pattern_parts.iter().enumerate() {
            if let Some(pos) = topic[topic_pos..].find(part) {
                topic_pos += pos + part.len();
            } else if i == 0 && !pattern.starts_with('*') {
                // First part must match from start
                return false;
            } else if i == pattern_parts.len() - 1 && !pattern.ends_with('*') {
                // Last part must match to end
                return topic[topic_pos..].ends_with(part);
            }
        }

        true
    }

    /// Estimate latency for route
    fn estimate_latency(&self, route: &RouteEntry) -> f64 {
        // Simple estimation based on success rate and priority
        // In real implementation, would use historical data
        let base_latency = 10.0; // 10ms base
        let success_penalty = (1.0 - route.success_rate) * 50.0; // Up to 50ms penalty
        let priority_bonus = route.priority as f64 * 2.0; // 2ms bonus per priority level

        base_latency + success_penalty - priority_bonus
    }

    /// Update route metrics after successful delivery
    pub fn update_route_success(&mut self, topic_pattern: &str, node_id: &str, latency: f64) {
        if let Some(routes) = self.routes.get_mut(topic_pattern) {
            for route in routes {
                if route.node_id == node_id {
                    route.last_used = self.current_timestamp();
                    // Update success rate (exponential moving average)
                    route.success_rate = 0.9 * route.success_rate + 0.1; // 10% weight for success
                    break;
                }
            }
        }
    }

    /// Update route metrics after failed delivery
    pub fn update_route_failure(&mut self, topic_pattern: &str, node_id: &str) {
        if let Some(routes) = self.routes.get_mut(topic_pattern) {
            for route in routes {
                if route.node_id == node_id {
                    // Update success rate (exponential moving average)
                    route.success_rate = 0.9 * route.success_rate; // 10% weight for failure
                    break;
                }
            }
        }
    }

    /// Get routing statistics
    pub fn get_routing_stats(&self) -> RoutingStats {
        let mut total_routes = 0;
        let mut active_nodes = alloc::collections::BTreeSet::new();

        for routes in self.routes.values() {
            total_routes += routes.len();
            for route in routes {
                active_nodes.insert(route.node_id.clone());
            }
        }

        RoutingStats {
            total_routes,
            active_nodes: active_nodes.len(),
            cached_capabilities: self.node_capabilities.len(),
        }
    }

    /// Get current timestamp (placeholder)
    fn current_timestamp(&self) -> u64 {
        // In real implementation, would get current Unix timestamp
        0
    }
}

/// Routing decision
#[derive(Debug, Clone)]
pub struct RoutingDecision {
    /// Target node ID
    pub node_id: alloc::string::String,
    /// Route priority
    pub priority: u32,
    /// Route cost
    pub cost: u32,
    /// Estimated latency (milliseconds)
    pub estimated_latency: f64,
    /// Confidence score (0.0-1.0)
    pub confidence: f64,
}

/// Routing statistics
#[derive(Debug, Clone)]
pub struct RoutingStats {
    /// Total number of routes
    pub total_routes: usize,
    /// Number of active nodes
    pub active_nodes: usize,
    /// Number of cached node capabilities
    pub cached_capabilities: usize,
}

/// Load balancing strategy
#[derive(Debug, Clone)]
pub enum LoadBalancingStrategy {
    /// Round-robin
    RoundRobin,
    /// Least connections
    LeastConnections,
    /// Weighted random
    Weighted,
    /// Consistent hashing
    ConsistentHash,
}

/// Distributed load balancer
pub struct DistributedLoadBalancer {
    /// Load balancing strategy
    strategy: LoadBalancingStrategy,
    /// Node loads (connections or requests)
    node_loads: BTreeMap<alloc::string::String, u32>,
    /// Round-robin index
    rr_index: usize,
}

impl DistributedLoadBalancer {
    /// Create new load balancer
    pub fn new(strategy: LoadBalancingStrategy) -> Self {
        Self {
            strategy,
            node_loads: BTreeMap::new(),
            rr_index: 0,
        }
    }

    /// Select node for load balancing
    pub fn select_node(&mut self, available_nodes: &[alloc::string::String]) -> Option<alloc::string::String> {
        if available_nodes.is_empty() {
            return None;
        }

        match self.strategy {
            LoadBalancingStrategy::RoundRobin => {
                let selected = available_nodes[self.rr_index % available_nodes.len()].clone();
                self.rr_index += 1;
                Some(selected)
            }
            LoadBalancingStrategy::LeastConnections => {
                let mut best_node = None;
                let mut min_load = u32::MAX;

                for node in available_nodes {
                    let load = self.node_loads.get(node).copied().unwrap_or(0);
                    if load < min_load {
                        min_load = load;
                        best_node = Some(node.clone());
                    }
                }

                best_node
            }
            LoadBalancingStrategy::Weighted => {
                // Simple weighted selection based on inverse load
                let mut best_node = None;
                let mut best_score = 0.0;

                for node in available_nodes {
                    let load = self.node_loads.get(node).copied().unwrap_or(0);
                    let score = if load == 0 { 1000.0 } else { 1.0 / load as f64 };
                    if score > best_score {
                        best_score = score;
                        best_node = Some(node.clone());
                    }
                }

                best_node
            }
            LoadBalancingStrategy::ConsistentHash => {
                // Simple consistent hashing (placeholder)
                let hash = available_nodes.len() as u32; // Would use real hash
                let index = (hash as usize) % available_nodes.len();
                Some(available_nodes[index].clone())
            }
        }
    }

    /// Update node load
    pub fn update_node_load(&mut self, node_id: alloc::string::String, load: u32) {
        self.node_loads.insert(node_id, load);
    }

    /// Remove node
    pub fn remove_node(&mut self, node_id: &str) {
        self.node_loads.remove(node_id);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_distributed_routing_table() {
        let mut table = DistributedRoutingTable::new("local-node".to_string());

        // Add routes
        table.add_route("topic.*".to_string(), "node-1".to_string(), 1);
        table.add_route("topic.*".to_string(), "node-2".to_string(), 2);

        // Create test event
        let event = Event::new("topic.test".to_string(), b"test data".to_vec());

        // Route event
        let decisions = table.route_event(&event);
        assert!(!decisions.is_empty());

        // Node-2 should have higher priority
        assert_eq!(decisions[0].node_id, "node-2");
        assert_eq!(decisions[0].priority, 2);
    }

    #[test]
    fn test_load_balancer() {
        let mut balancer = DistributedLoadBalancer::new(LoadBalancingStrategy::RoundRobin);
        let nodes = vec!["node-1".to_string(), "node-2".to_string(), "node-3".to_string()];

        // Test round-robin selection
        assert_eq!(balancer.select_node(&nodes), Some("node-1".to_string()));
        assert_eq!(balancer.select_node(&nodes), Some("node-2".to_string()));
        assert_eq!(balancer.select_node(&nodes), Some("node-3".to_string()));
        assert_eq!(balancer.select_node(&nodes), Some("node-1".to_string()));
    }

    #[test]
    fn test_pattern_matching() {
        let table = DistributedRoutingTable::new("local".to_string());

        // Test exact match
        assert!(table.matches_pattern("topic.user", "topic.user"));

        // Test wildcard match
        assert!(table.matches_pattern("topic.user.created", "topic.user.*"));

        // Test universal match
        assert!(table.matches_pattern("any.topic", "*"));

        // Test no match
        assert!(!table.matches_pattern("topic.user", "topic.order"));
    }
}
