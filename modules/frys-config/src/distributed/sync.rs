//! Configuration synchronization across distributed nodes

use crate::*;

/// Configuration sync message
#[derive(Debug, Clone)]
pub enum ConfigSyncMessage {
    /// Configuration update
    ConfigUpdate {
        key: alloc::string::String,
        value: ConfigValue,
        version: u64,
        source_node: alloc::string::String,
    },
    /// Configuration delete
    ConfigDelete {
        key: alloc::string::String,
        version: u64,
        source_node: alloc::string::String,
    },
    /// Sync request
    SyncRequest {
        node_id: alloc::string::String,
        last_version: u64,
    },
    /// Sync response
    SyncResponse {
        node_id: alloc::string::String,
        configs: alloc::collections::BTreeMap<alloc::string::String, (ConfigValue, u64)>,
    },
    /// Heartbeat with version
    Heartbeat {
        node_id: alloc::string::String,
        current_version: u64,
    },
}

/// Configuration synchronizer
pub struct ConfigSynchronizer {
    /// Local node ID
    local_node_id: alloc::string::String,
    /// Configuration manager reference
    config_manager: *const ConfigManager,
    /// Known configuration versions
    versions: alloc::collections::BTreeMap<alloc::string::String, u64>,
    /// Pending sync operations
    pending_ops: alloc::collections::VecDeque<ConfigSyncMessage>,
    /// Sync peers
    peers: alloc::vec::Vec<alloc::string::String>,
    /// Sync statistics
    stats: SyncStats,
}

impl ConfigSynchronizer {
    /// Create new synchronizer
    pub fn new(local_node_id: alloc::string::String, config_manager: *const ConfigManager) -> Self {
        Self {
            local_node_id,
            config_manager,
            versions: alloc::collections::BTreeMap::new(),
            pending_ops: alloc::collections::VecDeque::new(),
            peers: alloc::vec::Vec::new(),
            stats: SyncStats::default(),
        }
    }

    /// Add a sync peer
    pub fn add_peer(&mut self, peer_id: alloc::string::String) {
        if !self.peers.contains(&peer_id) {
            self.peers.push(peer_id);
        }
    }

    /// Remove a sync peer
    pub fn remove_peer(&mut self, peer_id: &str) {
        self.peers.retain(|p| p != peer_id);
    }

    /// Handle incoming sync message
    pub async fn handle_message(&mut self, message: ConfigSyncMessage) -> Result<()> {
        match message {
            ConfigSyncMessage::ConfigUpdate { key, value, version, source_node } => {
                self.handle_config_update(key, value, version, source_node).await?;
            }
            ConfigSyncMessage::ConfigDelete { key, version, source_node } => {
                self.handle_config_delete(key, version, source_node).await?;
            }
            ConfigSyncMessage::SyncRequest { node_id, last_version } => {
                self.handle_sync_request(node_id, last_version).await?;
            }
            ConfigSyncMessage::SyncResponse { node_id, configs } => {
                self.handle_sync_response(node_id, configs).await?;
            }
            ConfigSyncMessage::Heartbeat { node_id, current_version } => {
                self.handle_heartbeat(node_id, current_version).await?;
            }
        }
        Ok(())
    }

    /// Handle configuration update
    async fn handle_config_update(&mut self, key: alloc::string::String, value: ConfigValue, version: u64, source_node: alloc::string::String) -> Result<()> {
        // Check if we have a newer version
        if let Some(local_version) = self.versions.get(&key) {
            if *local_version >= version {
                // We have a newer or equal version, ignore
                return Ok(());
            }
        }

        // Apply the configuration update
        // This would call the config manager to update the value
        println!("Applying config update from {}: {} = {:?}", source_node, key, value);

        // Update our version
        self.versions.insert(key.clone(), version);

        // Propagate to other peers
        let update_message = ConfigSyncMessage::ConfigUpdate {
            key: key.clone(),
            value,
            version,
            source_node: self.local_node_id.clone(),
        };

        for peer in &self.peers {
            if *peer != source_node {
                self.pending_ops.push_back(update_message.clone());
            }
        }

        self.stats.updates_received += 1;
        Ok(())
    }

    /// Handle configuration delete
    async fn handle_config_delete(&mut self, key: alloc::string::String, version: u64, source_node: alloc::string::String) -> Result<()> {
        // Check version
        if let Some(local_version) = self.versions.get(&key) {
            if *local_version >= version {
                return Ok(());
            }
        }

        // Apply the configuration delete
        println!("Applying config delete from {}: {}", source_node, key);

        // Update our version
        self.versions.insert(key.clone(), version);

        // Propagate to other peers
        let delete_message = ConfigSyncMessage::ConfigDelete {
            key: key.clone(),
            version,
            source_node: self.local_node_id.clone(),
        };

        for peer in &self.peers {
            if *peer != source_node {
                self.pending_ops.push_back(delete_message.clone());
            }
        }

        self.stats.deletes_received += 1;
        Ok(())
    }

    /// Handle sync request
    async fn handle_sync_request(&mut self, node_id: alloc::string::String, last_version: u64) -> Result<()> {
        // Prepare sync response with configs newer than last_version
        let mut configs = alloc::collections::BTreeMap::new();

        // This would iterate through the config manager to find newer configs
        // For now, just send an empty response
        let response = ConfigSyncMessage::SyncResponse {
            node_id: node_id.clone(),
            configs,
        };

        self.pending_ops.push_back(response);
        self.stats.sync_requests_received += 1;
        Ok(())
    }

    /// Handle sync response
    async fn handle_sync_response(&mut self, node_id: alloc::string::String, configs: alloc::collections::BTreeMap<alloc::string::String, (ConfigValue, u64)>) -> Result<()> {
        // Apply the received configurations
        for (key, (value, version)) in configs {
            if let Some(local_version) = self.versions.get(&key) {
                if *local_version < version {
                    // Apply the update
                    println!("Syncing config from {}: {} = {:?}", node_id, key, value);
                    self.versions.insert(key, version);
                }
            } else {
                // New configuration
                println!("New config from {}: {} = {:?}", node_id, key, value);
                self.versions.insert(key, version);
            }
        }

        self.stats.sync_responses_received += 1;
        Ok(())
    }

    /// Handle heartbeat
    async fn handle_heartbeat(&mut self, node_id: alloc::string::String, current_version: u64) -> Result<()> {
        // Update peer's known version
        // This could trigger sync if we're behind
        println!("Heartbeat from {}: version {}", node_id, current_version);
        self.stats.heartbeats_received += 1;
        Ok(())
    }

    /// Broadcast configuration change
    pub async fn broadcast_change(&mut self, key: alloc::string::String, value: ConfigValue, version: u64) -> Result<()> {
        // Update local version
        self.versions.insert(key.clone(), version);

        // Create update message
        let message = ConfigSyncMessage::ConfigUpdate {
            key,
            value,
            version,
            source_node: self.local_node_id.clone(),
        };

        // Send to all peers
        for peer in &self.peers {
            self.pending_ops.push_back(message.clone());
        }

        self.stats.updates_sent += 1;
        Ok(())
    }

    /// Request sync from peers
    pub async fn request_sync(&mut self) -> Result<()> {
        for peer in &self.peers {
            let request = ConfigSyncMessage::SyncRequest {
                node_id: self.local_node_id.clone(),
                last_version: 0, // Would be the minimum version we have
            };
            self.pending_ops.push_back(request);
        }

        self.stats.sync_requests_sent += 1;
        Ok(())
    }

    /// Process pending operations
    pub async fn process_pending_ops(&mut self) -> Result<()> {
        while let Some(message) = self.pending_ops.pop_front() {
            // In real implementation, this would send the message over network
            println!("Processing pending sync operation: {:?}", message);
        }
        Ok(())
    }

    /// Get sync statistics
    pub fn stats(&self) -> &SyncStats {
        &self.stats
    }
}

/// Synchronization statistics
#[derive(Debug, Clone, Default)]
pub struct SyncStats {
    /// Updates sent
    pub updates_sent: u64,
    /// Updates received
    pub updates_received: u64,
    /// Deletes received
    pub deletes_received: u64,
    /// Sync requests sent
    pub sync_requests_sent: u64,
    /// Sync requests received
    pub sync_requests_received: u64,
    /// Sync responses received
    pub sync_responses_received: u64,
    /// Heartbeats received
    pub heartbeats_received: u64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_sync_message() {
        let message = ConfigSyncMessage::ConfigUpdate {
            key: "test.key".to_string(),
            value: ConfigValue::String("test value".to_string()),
            version: 1,
            source_node: "node-1".to_string(),
        };

        match message {
            ConfigSyncMessage::ConfigUpdate { key, value: ConfigValue::String(val), .. } => {
                assert_eq!(key, "test.key");
                assert_eq!(val, "test value");
            }
            _ => panic!("Unexpected message type"),
        }
    }

    #[tokio::test]
    async fn test_config_synchronizer() {
        let config_manager = ConfigManager::new(ConfigManagerBuilder::default().build().unwrap());
        let mut synchronizer = ConfigSynchronizer::new("local-node".to_string(), &config_manager);

        synchronizer.add_peer("peer-1".to_string());
        assert_eq!(synchronizer.peers.len(), 1);

        synchronizer.remove_peer("peer-1");
        assert_eq!(synchronizer.peers.len(), 0);
    }
}
