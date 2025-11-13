//! Configuration consensus for distributed updates

use crate::*;

/// Configuration consensus message
#[derive(Debug, Clone)]
pub enum ConfigConsensusMessage {
    /// Propose configuration change
    Propose {
        key: alloc::string::String,
        value: ConfigValue,
        proposal_id: u64,
        proposer: alloc::string::String,
    },
    /// Accept proposal
    Accept {
        proposal_id: u64,
        acceptor: alloc::string::String,
    },
    /// Reject proposal
    Reject {
        proposal_id: u64,
        reason: alloc::string::String,
        rejector: alloc::string::String,
    },
    /// Commit proposal
    Commit {
        proposal_id: u64,
        key: alloc::string::String,
        value: ConfigValue,
    },
}

/// Configuration consensus manager
pub struct ConfigConsensus {
    /// Current proposals
    proposals: alloc::collections::BTreeMap<u64, Proposal>,
    /// Next proposal ID
    next_proposal_id: u64,
    /// Consensus peers
    peers: alloc::vec::Vec<alloc::string::String>,
    /// Consensus statistics
    stats: ConsensusStats,
}

impl ConfigConsensus {
    /// Create new consensus manager
    pub fn new() -> Self {
        Self {
            proposals: alloc::collections::BTreeMap::new(),
            next_proposal_id: 1,
            peers: alloc::vec::Vec::new(),
            stats: ConsensusStats::default(),
        }
    }

    /// Propose a configuration change
    pub async fn propose(&mut self, key: alloc::string::String, value: ConfigValue) -> Result<u64> {
        let proposal_id = self.next_proposal_id;
        self.next_proposal_id += 1;

        let proposal = Proposal {
            id: proposal_id,
            key: key.clone(),
            value: value.clone(),
            proposer: "local".to_string(), // Would be actual node ID
            accepted_by: alloc::vec::Vec::new(),
            rejected_by: alloc::vec::Vec::new(),
            status: ProposalStatus::Proposed,
        };

        self.proposals.insert(proposal_id, proposal);
        self.stats.proposals_made += 1;

        Ok(proposal_id)
    }

    /// Accept a proposal
    pub async fn accept(&mut self, proposal_id: u64) -> Result<()> {
        if let Some(proposal) = self.proposals.get_mut(&proposal_id) {
            proposal.accepted_by.push("local".to_string()); // Would be actual node ID
            self.check_consensus(proposal_id)?;
            self.stats.accepts_sent += 1;
        }
        Ok(())
    }

    /// Reject a proposal
    pub async fn reject(&mut self, proposal_id: u64, reason: alloc::string::String) -> Result<()> {
        if let Some(proposal) = self.proposals.get_mut(&proposal_id) {
            proposal.rejected_by.push("local".to_string()); // Would be actual node ID
            proposal.status = ProposalStatus::Rejected;
            self.stats.rejects_sent += 1;
        }
        Ok(())
    }

    /// Check if proposal has reached consensus
    fn check_consensus(&mut self, proposal_id: u64) -> Result<()> {
        if let Some(proposal) = self.proposals.get_mut(&proposal_id) {
            let total_peers = self.peers.len() + 1; // +1 for self
            let required_accepts = (total_peers / 2) + 1; // Majority

            if proposal.accepted_by.len() >= required_accepts {
                proposal.status = ProposalStatus::Accepted;
                self.stats.proposals_accepted += 1;
                // Would trigger commit here
            }
        }
        Ok(())
    }

    /// Get consensus statistics
    pub fn stats(&self) -> &ConsensusStats {
        &self.stats
    }
}

/// Configuration proposal
#[derive(Debug, Clone)]
pub struct Proposal {
    /// Proposal ID
    pub id: u64,
    /// Configuration key
    pub key: alloc::string::String,
    /// Proposed value
    pub value: ConfigValue,
    /// Proposer node ID
    pub proposer: alloc::string::String,
    /// Nodes that accepted
    pub accepted_by: alloc::vec::Vec<alloc::string::String>,
    /// Nodes that rejected
    pub rejected_by: alloc::vec::Vec<alloc::string::String>,
    /// Proposal status
    pub status: ProposalStatus,
}

/// Proposal status
#[derive(Debug, Clone)]
pub enum ProposalStatus {
    /// Proposal made
    Proposed,
    /// Proposal accepted
    Accepted,
    /// Proposal rejected
    Rejected,
    /// Proposal committed
    Committed,
}

/// Consensus statistics
#[derive(Debug, Clone, Default)]
pub struct ConsensusStats {
    /// Proposals made
    pub proposals_made: u64,
    /// Proposals accepted
    pub proposals_accepted: u64,
    /// Accepts sent
    pub accepts_sent: u64,
    /// Rejects sent
    pub rejects_sent: u64,
}
