//! Service discovery for distributed EventBus nodes

use crate::*;
use alloc::collections::BTreeMap;
use alloc::string::String;
use alloc::vec::Vec;

/// Node identifier
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct NodeId(pub alloc::string::String);

impl NodeId {
    /// Create new node ID
    pub fn new(id: alloc::string::String) -> Self {
        Self(id)
    }

    /// Get string representation
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

/// Node information
#[derive(Debug, Clone)]
pub struct NodeInfo {
    /// Node ID
    pub id: NodeId,
    /// Node address
    pub address: alloc::string::String,
    /// Node port
    pub port: u16,
    /// Node status
    pub status: NodeStatus,
    /// Node capabilities
    pub capabilities: NodeCapabilities,
    /// Last heartbeat timestamp
    pub last_heartbeat: u64,
    /// Node metadata
    pub metadata: BTreeMap<alloc::string::String, alloc::string::String>,
}

/// Node status
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NodeStatus {
    /// Node is alive and healthy
    Alive,
    /// Node is suspected to be down
    Suspected,
    /// Node is confirmed down
    Dead,
    /// Node is leaving the cluster
    Leaving,
}

/// Node capabilities
#[derive(Debug, Clone)]
pub struct NodeCapabilities {
    /// Supported event types
    pub supported_events: Vec<alloc::string::String>,
    /// Maximum throughput (events/second)
    pub max_throughput: u64,
    /// Memory capacity (MB)
    pub memory_mb: usize,
    /// CPU cores
    pub cpu_cores: usize,
}

impl Default for NodeCapabilities {
    fn default() -> Self {
        Self {
            supported_events: Vec::new(),
            max_throughput: 10000,
            memory_mb: 1024,
            cpu_cores: 4,
        }
    }
}

/// Discovery strategy
#[derive(Debug, Clone)]
pub enum DiscoveryStrategy {
    /// Static configuration
    Static { nodes: Vec<NodeInfo> },
    /// DNS-based discovery
    Dns { domain: alloc::string::String },
    /// Consul-based discovery
    Consul { endpoint: alloc::string::String },
    /// Etcd-based discovery
    Etcd { endpoints: Vec<alloc::string::String> },
}

/// Service discovery manager
pub struct ServiceDiscovery {
    /// Current node ID
    local_node_id: NodeId,
    /// Known nodes
    nodes: BTreeMap<NodeId, NodeInfo>,
    /// Discovery strategy
    strategy: DiscoveryStrategy,
    /// Discovery interval (milliseconds)
    discovery_interval: u64,
    /// Heartbeat interval (milliseconds)
    heartbeat_interval: u64,
}

impl ServiceDiscovery {
    /// Create new service discovery
    pub fn new(local_node_id: NodeId, strategy: DiscoveryStrategy) -> Self {
        Self {
            local_node_id,
            nodes: BTreeMap::new(),
            strategy,
            discovery_interval: 30000, // 30 seconds
            heartbeat_interval: 5000,  // 5 seconds
        }
    }

    /// Add a node to the known nodes
    pub fn add_node(&mut self, node_info: NodeInfo) {
        self.nodes.insert(node_info.id.clone(), node_info);
    }

    /// Remove a node
    pub fn remove_node(&mut self, node_id: &NodeId) {
        self.nodes.remove(node_id);
    }

    /// Get node information
    pub fn get_node(&self, node_id: &NodeId) -> Option<&NodeInfo> {
        self.nodes.get(node_id)
    }

    /// Get all known nodes
    pub fn get_all_nodes(&self) -> Vec<&NodeInfo> {
        self.nodes.values().collect()
    }

    /// Get alive nodes only
    pub fn get_alive_nodes(&self) -> Vec<&NodeInfo> {
        self.nodes.values()
            .filter(|node| node.status == NodeStatus::Alive)
            .collect()
    }

    /// Update node heartbeat
    pub fn update_heartbeat(&mut self, node_id: &NodeId, timestamp: u64) {
        if let Some(node) = self.nodes.get_mut(node_id) {
            node.last_heartbeat = timestamp;
            node.status = NodeStatus::Alive;
        }
    }

    /// Mark node as suspected
    pub fn mark_suspected(&mut self, node_id: &NodeId) {
        if let Some(node) = self.nodes.get_mut(node_id) {
            node.status = NodeStatus::Suspected;
        }
    }

    /// Mark node as dead
    pub fn mark_dead(&mut self, node_id: &NodeId) {
        if let Some(node) = self.nodes.get_mut(node_id) {
            node.status = NodeStatus::Dead;
        }
    }

    /// Discover nodes based on strategy
    pub async fn discover_nodes(&mut self) -> Result<()> {
        match &self.strategy {
            DiscoveryStrategy::Static { nodes } => {
                // Add static nodes
                for node in nodes {
                    self.add_node(node.clone());
                }
                Ok(())
            }
            DiscoveryStrategy::Dns { domain } => {
                // DNS-based discovery (placeholder)
                // In real implementation, would query DNS SRV records
                Ok(())
            }
            DiscoveryStrategy::Consul { endpoint } => {
                // Consul-based discovery (placeholder)
                // In real implementation, would query Consul API
                Ok(())
            }
            DiscoveryStrategy::Etcd { endpoints } => {
                // Etcd-based discovery (placeholder)
                // In real implementation, would query etcd
                Ok(())
            }
        }
    }

    /// Send heartbeat to other nodes
    pub async fn send_heartbeat(&self) -> Result<()> {
        // Send heartbeat to all alive nodes
        for node in self.get_alive_nodes() {
            if node.id != self.local_node_id {
                // In real implementation, would send heartbeat via network
                // For now, just log
                println!("Sending heartbeat to node {}", node.id.as_str());
            }
        }
        Ok(())
    }

    /// Check for failed nodes
    pub fn check_node_health(&mut self, current_time: u64, timeout: u64) {
        let mut dead_nodes = Vec::new();

        for (node_id, node) in &self.nodes {
            if node.id != self.local_node_id {
                if current_time.saturating_sub(node.last_heartbeat) > timeout {
                    if node.status == NodeStatus::Alive {
                        // Mark as suspected first
                        println!("Node {} suspected", node_id.as_str());
                    } else if node.status == NodeStatus::Suspected {
                        // Mark as dead
                        dead_nodes.push(node_id.clone());
                        println!("Node {} marked as dead", node_id.as_str());
                    }
                }
            }
        }

        // Remove dead nodes
        for node_id in dead_nodes {
            self.mark_dead(&node_id);
        }
    }

    /// Get local node ID
    pub fn local_node_id(&self) -> &NodeId {
        &self.local_node_id
    }

    /// Set discovery interval
    pub fn set_discovery_interval(&mut self, interval: u64) {
        self.discovery_interval = interval;
    }

    /// Set heartbeat interval
    pub fn set_heartbeat_interval(&mut self, interval: u64) {
        self.heartbeat_interval = interval;
    }

    /// Get discovery interval
    pub fn discovery_interval(&self) -> u64 {
        self.discovery_interval
    }

    /// Get heartbeat interval
    pub fn heartbeat_interval(&self) -> u64 {
        self.heartbeat_interval
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_node_id() {
        let node_id = NodeId::new("node-1".to_string());
        assert_eq!(node_id.as_str(), "node-1");
    }

    #[test]
    fn test_service_discovery() {
        let local_id = NodeId::new("local".to_string());
        let mut discovery = ServiceDiscovery::new(local_id, DiscoveryStrategy::Static { nodes: Vec::new() });

        // Add a node
        let node_info = NodeInfo {
            id: NodeId::new("node-1".to_string()),
            address: "127.0.0.1".to_string(),
            port: 8080,
            status: NodeStatus::Alive,
            capabilities: NodeCapabilities::default(),
            last_heartbeat: 1000,
            metadata: BTreeMap::new(),
        };

        discovery.add_node(node_info);

        // Check node was added
        assert!(discovery.get_node(&NodeId::new("node-1".to_string())).is_some());
        assert_eq!(discovery.get_all_nodes().len(), 1);
        assert_eq!(discovery.get_alive_nodes().len(), 1);
    }
}
