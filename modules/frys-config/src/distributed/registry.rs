//! Configuration registry for distributed nodes

use crate::*;

/// Configuration registry entry
#[derive(Debug, Clone)]
pub struct RegistryEntry {
    /// Node ID
    pub node_id: alloc::string::String,
    /// Configuration keys owned by this node
    pub owned_keys: alloc::vec::Vec<alloc::string::String>,
    /// Last update timestamp
    pub last_update: u64,
    /// Node status
    pub status: NodeStatus,
}

/// Node status
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum NodeStatus {
    /// Node is active
    Active,
    /// Node is inactive
    Inactive,
    /// Node is unreachable
    Unreachable,
}

/// Configuration registry
pub struct ConfigRegistry {
    /// Registry entries by node ID
    entries: alloc::collections::BTreeMap<alloc::string::String, RegistryEntry>,
    /// Key to node mapping
    key_ownership: alloc::collections::BTreeMap<alloc::string::String, alloc::string::String>,
    /// Registry statistics
    stats: RegistryStats,
}

impl ConfigRegistry {
    /// Create new registry
    pub fn new() -> Self {
        Self {
            entries: alloc::collections::BTreeMap::new(),
            key_ownership: alloc::collections::BTreeMap::new(),
            stats: RegistryStats::default(),
        }
    }

    /// Register a node
    pub fn register_node(&mut self, node_id: alloc::string::String) {
        let entry = RegistryEntry {
            node_id: node_id.clone(),
            owned_keys: alloc::vec::Vec::new(),
            last_update: self.current_timestamp(),
            status: NodeStatus::Active,
        };

        self.entries.insert(node_id, entry);
        self.stats.nodes_registered += 1;
    }

    /// Unregister a node
    pub fn unregister_node(&mut self, node_id: &str) {
        if let Some(entry) = self.entries.remove(node_id) {
            // Remove ownership of all keys owned by this node
            for key in entry.owned_keys {
                self.key_ownership.remove(&key);
            }
            self.stats.nodes_unregistered += 1;
        }
    }

    /// Claim ownership of a configuration key
    pub fn claim_key(&mut self, node_id: alloc::string::String, key: alloc::string::String) -> Result<()> {
        // Check if key is already owned
        if let Some(current_owner) = self.key_ownership.get(&key) {
            if *current_owner != node_id {
                return Err(ConfigError::KeyAlreadyOwned {
                    key: key.clone(),
                    owner: current_owner.clone(),
                });
            }
        }

        // Update ownership
        self.key_ownership.insert(key.clone(), node_id.clone());

        // Update node's owned keys
        if let Some(entry) = self.entries.get_mut(&node_id) {
            if !entry.owned_keys.contains(&key) {
                entry.owned_keys.push(key);
                entry.last_update = self.current_timestamp();
            }
        }

        self.stats.keys_claimed += 1;
        Ok(())
    }

    /// Release ownership of a key
    pub fn release_key(&mut self, node_id: &str, key: &str) {
        if self.key_ownership.get(key) == Some(&node_id.to_string()) {
            self.key_ownership.remove(key);

            if let Some(entry) = self.entries.get_mut(node_id) {
                entry.owned_keys.retain(|k| k != key);
                entry.last_update = self.current_timestamp();
            }

            self.stats.keys_released += 1;
        }
    }

    /// Get owner of a key
    pub fn get_key_owner(&self, key: &str) -> Option<&alloc::string::String> {
        self.key_ownership.get(key)
    }

    /// Get all keys owned by a node
    pub fn get_node_keys(&self, node_id: &str) -> alloc::vec::Vec<&alloc::string::String> {
        if let Some(entry) = self.entries.get(node_id) {
            entry.owned_keys.iter().collect()
        } else {
            alloc::vec::Vec::new()
        }
    }

    /// Update node status
    pub fn update_node_status(&mut self, node_id: &str, status: NodeStatus) {
        if let Some(entry) = self.entries.get_mut(node_id) {
            entry.status = status;
            entry.last_update = self.current_timestamp();
        }
    }

    /// Get registry statistics
    pub fn stats(&self) -> &RegistryStats {
        &self.stats
    }

    /// Get current timestamp (placeholder)
    fn current_timestamp(&self) -> u64 {
        0
    }
}

/// Registry statistics
#[derive(Debug, Clone, Default)]
pub struct RegistryStats {
    /// Nodes registered
    pub nodes_registered: u64,
    /// Nodes unregistered
    pub nodes_unregistered: u64,
    /// Keys claimed
    pub keys_claimed: u64,
    /// Keys released
    pub keys_released: u64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_registry() {
        let mut registry = ConfigRegistry::new();

        // Register a node
        registry.register_node("node-1".to_string());
        assert!(registry.entries.contains_key("node-1"));

        // Claim a key
        registry.claim_key("node-1".to_string(), "config.key1".to_string()).unwrap();
        assert_eq!(registry.get_key_owner("config.key1"), Some(&"node-1".to_string()));

        // Get node keys
        let keys = registry.get_node_keys("node-1");
        assert_eq!(keys.len(), 1);
        assert_eq!(keys[0], &"config.key1".to_string());

        // Release key
        registry.release_key("node-1", "config.key1");
        assert_eq!(registry.get_key_owner("config.key1"), None);

        // Unregister node
        registry.unregister_node("node-1");
        assert!(!registry.entries.contains_key("node-1"));
    }
}
