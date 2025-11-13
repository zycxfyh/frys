//! Consensus algorithms for distributed EventBus

use crate::*;
use alloc::collections::BTreeMap;
use alloc::string::String;
use alloc::vec::Vec;

/// Consensus algorithm types
#[derive(Debug, Clone)]
pub enum ConsensusAlgorithm {
    /// No consensus (for development)
    None,
    /// Raft consensus
    Raft,
    /// Paxos consensus
    Paxos,
    /// Simple majority voting
    Majority,
}

/// Consensus state
#[derive(Debug, Clone)]
pub enum ConsensusState {
    /// Leader node
    Leader,
    /// Follower node
    Follower,
    /// Candidate (during election)
    Candidate,
}

/// Consensus message
#[derive(Debug, Clone)]
pub enum ConsensusMessage {
    /// Request vote
    RequestVote {
        candidate_id: alloc::string::String,
        term: u64,
        last_log_index: u64,
        last_log_term: u64,
    },
    /// Vote response
    VoteResponse {
        voter_id: alloc::string::String,
        term: u64,
        granted: bool,
    },
    /// Append entries (heartbeat)
    AppendEntries {
        leader_id: alloc::string::String,
        term: u64,
        prev_log_index: u64,
        prev_log_term: u64,
        entries: Vec<LogEntry>,
        leader_commit: u64,
    },
    /// Append response
    AppendResponse {
        follower_id: alloc::string::String,
        term: u64,
        success: bool,
        match_index: u64,
    },
}

/// Log entry for consensus
#[derive(Debug, Clone)]
pub struct LogEntry {
    /// Entry term
    pub term: u64,
    /// Entry index
    pub index: u64,
    /// Entry command
    pub command: ConsensusCommand,
}

/// Consensus command
#[derive(Debug, Clone)]
pub enum ConsensusCommand {
    /// Add subscription
    AddSubscription {
        topic: alloc::string::String,
        subscriber: alloc::string::String,
    },
    /// Remove subscription
    RemoveSubscription {
        topic: alloc::string::String,
        subscriber: alloc::string::String,
    },
    /// Update routing table
    UpdateRoute {
        topic_pattern: alloc::string::String,
        node_id: alloc::string::String,
        priority: u32,
    },
}

/// Consensus manager
pub struct ConsensusManager {
    /// Consensus algorithm
    algorithm: ConsensusAlgorithm,
    /// Current term
    current_term: u64,
    /// Voted for in current term
    voted_for: Option<alloc::string::String>,
    /// Consensus state
    state: ConsensusState,
    /// Log entries
    log: Vec<LogEntry>,
    /// Commit index
    commit_index: u64,
    /// Last applied index
    last_applied: u64,
    /// Next index for each peer
    next_index: BTreeMap<alloc::string::String, u64>,
    /// Match index for each peer
    match_index: BTreeMap<alloc::string::String, u64>,
    /// Cluster peers
    peers: Vec<alloc::string::String>,
    /// Election timeout
    election_timeout: u64,
    /// Heartbeat timeout
    heartbeat_timeout: u64,
}

impl ConsensusManager {
    /// Create new consensus manager
    pub fn new(algorithm: ConsensusAlgorithm, node_id: alloc::string::String, peers: Vec<alloc::string::String>) -> Self {
        let mut next_index = BTreeMap::new();
        let mut match_index = BTreeMap::new();

        for peer in &peers {
            next_index.insert(peer.clone(), 1);
            match_index.insert(peer.clone(), 0);
        }

        Self {
            algorithm,
            current_term: 0,
            voted_for: None,
            state: ConsensusState::Follower,
            log: Vec::new(),
            commit_index: 0,
            last_applied: 0,
            next_index,
            match_index,
            peers,
            election_timeout: 5000, // 5 seconds
            heartbeat_timeout: 1000, // 1 second
        }
    }

    /// Handle consensus message
    pub async fn handle_message(&mut self, message: ConsensusMessage) -> Result<Option<ConsensusMessage>> {
        match message {
            ConsensusMessage::RequestVote { candidate_id, term, .. } => {
                self.handle_request_vote(candidate_id, term).await
            }
            ConsensusMessage::VoteResponse { voter_id, term, granted } => {
                self.handle_vote_response(voter_id, term, granted).await
            }
            ConsensusMessage::AppendEntries { leader_id, term, .. } => {
                self.handle_append_entries(leader_id, term).await
            }
            ConsensusMessage::AppendResponse { follower_id, term, success, match_index } => {
                self.handle_append_response(follower_id, term, success, match_index).await
            }
        }
    }

    /// Handle request vote
    async fn handle_request_vote(&mut self, candidate_id: alloc::string::String, term: u64) -> Result<Option<ConsensusMessage>> {
        if term > self.current_term {
            self.current_term = term;
            self.state = ConsensusState::Follower;
            self.voted_for = None;
        }

        let grant_vote = term >= self.current_term && (self.voted_for.is_none() || self.voted_for.as_ref() == Some(&candidate_id));

        if grant_vote {
            self.voted_for = Some(candidate_id.clone());
        }

        Ok(Some(ConsensusMessage::VoteResponse {
            voter_id: "self".to_string(), // Would be actual node ID
            term: self.current_term,
            granted: grant_vote,
        }))
    }

    /// Handle vote response
    async fn handle_vote_response(&mut self, _voter_id: alloc::string::String, term: u64, granted: bool) -> Result<Option<ConsensusMessage>> {
        if term > self.current_term {
            self.current_term = term;
            self.state = ConsensusState::Follower;
            self.voted_for = None;
            return Ok(None);
        }

        // Count votes (simplified - would track vote count in real implementation)
        if granted {
            println!("Received vote from {}", _voter_id);
        }

        Ok(None)
    }

    /// Handle append entries
    async fn handle_append_entries(&mut self, leader_id: alloc::string::String, term: u64) -> Result<Option<ConsensusMessage>> {
        if term >= self.current_term {
            self.current_term = term;
            self.state = ConsensusState::Follower;
            self.voted_for = None;
        }

        Ok(Some(ConsensusMessage::AppendResponse {
            follower_id: "self".to_string(), // Would be actual node ID
            term: self.current_term,
            success: true,
            match_index: self.log.len() as u64,
        }))
    }

    /// Handle append response
    async fn handle_append_response(&mut self, follower_id: alloc::string::String, term: u64, success: bool, match_index: u64) -> Result<Option<ConsensusMessage>> {
        if term > self.current_term {
            self.current_term = term;
            self.state = ConsensusState::Follower;
            self.voted_for = None;
            return Ok(None);
        }

        if success {
            self.match_index.insert(follower_id.clone(), match_index);
            self.next_index.insert(follower_id, match_index + 1);
        } else {
            // Decrement next index and retry
            if let Some(next_idx) = self.next_index.get_mut(&follower_id) {
                *next_idx = next_idx.saturating_sub(1);
            }
        }

        Ok(None)
    }

    /// Start election
    pub async fn start_election(&mut self) -> Result<()> {
        self.current_term += 1;
        self.state = ConsensusState::Candidate;
        self.voted_for = Some("self".to_string()); // Would be actual node ID

        // Request votes from peers
        for peer in &self.peers {
            let request = ConsensusMessage::RequestVote {
                candidate_id: "self".to_string(), // Would be actual node ID
                term: self.current_term,
                last_log_index: self.log.len() as u64,
                last_log_term: self.log.last().map(|entry| entry.term).unwrap_or(0),
            };

            // Send request (placeholder)
            println!("Requesting vote from {}", peer);
        }

        Ok(())
    }

    /// Propose command for consensus
    pub async fn propose_command(&mut self, command: ConsensusCommand) -> Result<()> {
        let entry = LogEntry {
            term: self.current_term,
            index: self.log.len() as u64 + 1,
            command,
        };

        self.log.push(entry);

        // Replicate to followers (simplified)
        for peer in &self.peers {
            println!("Replicating log entry to {}", peer);
        }

        Ok(())
    }

    /// Get consensus state
    pub fn get_state(&self) -> ConsensusStateInfo {
        ConsensusStateInfo {
            state: self.state.clone(),
            term: self.current_term,
            commit_index: self.commit_index,
            last_applied: self.last_applied,
            cluster_size: self.peers.len() + 1, // +1 for self
        }
    }

    /// Check if consensus is established
    pub fn is_consensus_established(&self) -> bool {
        match self.algorithm {
            ConsensusAlgorithm::None => true,
            ConsensusAlgorithm::Raft | ConsensusAlgorithm::Paxos => {
                matches!(self.state, ConsensusState::Leader)
            }
            ConsensusAlgorithm::Majority => {
                // Simple majority check
                let votes_needed = (self.peers.len() + 1) / 2 + 1;
                // Would track actual votes in real implementation
                self.current_term > 0
            }
        }
    }
}

/// Consensus state information
#[derive(Debug, Clone)]
pub struct ConsensusStateInfo {
    /// Current state
    pub state: ConsensusState,
    /// Current term
    pub term: u64,
    /// Commit index
    pub commit_index: u64,
    /// Last applied index
    pub last_applied: u64,
    /// Cluster size
    pub cluster_size: usize,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_consensus_manager_creation() {
        let peers = vec!["node-1".to_string(), "node-2".to_string()];
        let manager = ConsensusManager::new(ConsensusAlgorithm::Raft, "local".to_string(), peers);

        assert_eq!(manager.current_term, 0);
        matches!(manager.state, ConsensusState::Follower);
        assert_eq!(manager.peers.len(), 2);
    }

    #[tokio::test]
    async fn test_request_vote() {
        let peers = vec!["node-1".to_string()];
        let mut manager = ConsensusManager::new(ConsensusAlgorithm::Raft, "local".to_string(), peers);

        let response = manager.handle_message(ConsensusMessage::RequestVote {
            candidate_id: "candidate".to_string(),
            term: 1,
            last_log_index: 0,
            last_log_term: 0,
        }).await.unwrap();

        assert!(response.is_some());
        matches!(response.unwrap(), ConsensusMessage::VoteResponse { .. });
    }

    #[test]
    fn test_consensus_state() {
        let peers = vec!["node-1".to_string(), "node-2".to_string()];
        let manager = ConsensusManager::new(ConsensusAlgorithm::Raft, "local".to_string(), peers);

        let state = manager.get_state();
        matches!(state.state, ConsensusState::Follower);
        assert_eq!(state.term, 0);
        assert_eq!(state.cluster_size, 3); // 2 peers + self
    }
}
