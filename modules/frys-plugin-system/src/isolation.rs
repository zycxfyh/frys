//! Plugin isolation and resource management

use crate::*;

/// Plugin isolation manager
#[derive(Debug)]
pub struct IsolationManager {
    /// Active isolations
    isolations: alloc::collections::BTreeMap<PluginId, PluginIsolation>,
    /// Isolation policies
    policies: alloc::vec::Vec<IsolationPolicy>,
}

impl IsolationManager {
    /// Create a new isolation manager
    pub fn new() -> Self {
        Self {
            isolations: alloc::collections::BTreeMap::new(),
            policies: alloc::vec::Vec::new(),
        }
    }

    /// Add an isolation policy
    pub fn add_policy(&mut self, policy: IsolationPolicy) {
        self.policies.push(policy);
    }

    /// Isolate a plugin
    pub async fn isolate_plugin(&mut self, plugin_id: PluginId, metadata: &PluginMetadata) -> Result<()> {
        let isolation = PluginIsolation::new(plugin_id.clone(), metadata)?;
        self.isolations.insert(plugin_id, isolation);
        Ok(())
    }

    /// Remove plugin isolation
    pub async fn remove_isolation(&mut self, plugin_id: &PluginId) -> Result<()> {
        if self.isolations.remove(plugin_id).is_some() {
            Ok(())
        } else {
            Err(PluginError::PluginNotFound {
                id: plugin_id.clone(),
            })
        }
    }

    /// Check if operation is allowed
    pub fn check_operation(&self, plugin_id: &PluginId, operation: &PluginOperation) -> Result<()> {
        if let Some(isolation) = self.isolations.get(plugin_id) {
            isolation.check_operation(operation)
        } else {
            Ok(()) // No isolation means allow all
        }
    }

    /// Get isolation statistics
    pub fn stats(&self) -> IsolationStats {
        let total_isolations = self.isolations.len() as u32;
        let active_policies = self.policies.len() as u32;

        IsolationStats {
            total_isolations,
            active_policies,
        }
    }
}

/// Plugin isolation container
#[derive(Debug)]
pub struct PluginIsolation {
    /// Plugin ID
    plugin_id: PluginId,
    /// Isolation level
    level: IsolationLevel,
    /// Resource limits
    resource_limits: ResourceLimits,
    /// Allowed operations
    allowed_operations: alloc::collections::BTreeSet<PluginOperation>,
    /// Blocked operations
    blocked_operations: alloc::collections::BTreeSet<PluginOperation>,
}

impl PluginIsolation {
    /// Create a new plugin isolation
    pub fn new(plugin_id: PluginId, metadata: &PluginMetadata) -> Result<Self> {
        let level = Self::determine_isolation_level(metadata);
        let resource_limits = metadata.resource_limits.clone();

        let (allowed_operations, blocked_operations) = Self::determine_operations(metadata);

        Ok(Self {
            plugin_id,
            level,
            resource_limits,
            allowed_operations,
            blocked_operations,
        })
    }

    /// Determine isolation level based on plugin metadata
    fn determine_isolation_level(metadata: &PluginMetadata) -> IsolationLevel {
        // High-risk plugins get maximum isolation
        if metadata.permissions.contains(&PluginPermission::Admin) ||
           metadata.capabilities.contains(&PluginCapability::NetworkCommunication) {
            IsolationLevel::Maximum
        } else if metadata.permissions.contains(&PluginPermission::Write) {
            IsolationLevel::High
        } else {
            IsolationLevel::Standard
        }
    }

    /// Determine allowed/blocked operations
    fn determine_operations(metadata: &PluginMetadata) -> (alloc::collections::BTreeSet<PluginOperation>, alloc::collections::BTreeSet<PluginOperation>) {
        let mut allowed = alloc::collections::BTreeSet::new();
        let mut blocked = alloc::collections::BTreeSet::new();

        // Basic operations always allowed
        allowed.insert(PluginOperation::Execute);
        allowed.insert(PluginOperation::Read);

        // Add permissions-based operations
        for permission in &metadata.permissions {
            match permission {
                PluginPermission::Write => {
                    allowed.insert(PluginOperation::Write);
                }
                PluginPermission::Network => {
                    allowed.insert(PluginOperation::NetworkAccess);
                }
                PluginPermission::Execute => {
                    allowed.insert(PluginOperation::SystemCall);
                }
                PluginPermission::Admin => {
                    allowed.insert(PluginOperation::AdminAccess);
                }
                _ => {}
            }
        }

        // Block dangerous operations by default
        blocked.insert(PluginOperation::SystemCall);
        blocked.insert(PluginOperation::AdminAccess);

        (allowed, blocked)
    }

    /// Check if operation is allowed
    pub fn check_operation(&self, operation: &PluginOperation) -> Result<()> {
        if self.blocked_operations.contains(operation) {
            return Err(PluginError::SecurityViolation {
                plugin_id: self.plugin_id.clone(),
                violation: alloc::format!("Operation {:?} is blocked", operation),
            });
        }

        if !self.allowed_operations.contains(operation) && self.level == IsolationLevel::Maximum {
            return Err(PluginError::SecurityViolation {
                plugin_id: self.plugin_id.clone(),
                violation: alloc::format!("Operation {:?} not allowed at maximum isolation", operation),
            });
        }

        Ok(())
    }

    /// Get resource limits
    pub fn resource_limits(&self) -> &ResourceLimits {
        &self.resource_limits
    }

    /// Get isolation level
    pub fn level(&self) -> IsolationLevel {
        self.level
    }
}

/// Isolation levels
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum IsolationLevel {
    /// Standard isolation
    Standard = 1,
    /// High isolation
    High = 2,
    /// Maximum isolation
    Maximum = 3,
}

/// Plugin operations that can be isolated
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum PluginOperation {
    /// Execute code
    Execute,
    /// Read data
    Read,
    /// Write data
    Write,
    /// Network access
    NetworkAccess,
    /// File system access
    FileSystemAccess,
    /// System calls
    SystemCall,
    /// Administrative access
    AdminAccess,
}

/// Isolation policy
#[derive(Debug, Clone)]
pub struct IsolationPolicy {
    /// Policy name
    name: alloc::string::String,
    /// Isolation rules
    rules: alloc::vec::Vec<IsolationRule>,
}

impl IsolationPolicy {
    /// Create a new isolation policy
    pub fn new(name: alloc::string::String) -> Self {
        Self {
            name,
            rules: alloc::vec::Vec::new(),
        }
    }

    /// Add an isolation rule
    pub fn add_rule(mut self, rule: IsolationRule) -> Self {
        self.rules.push(rule);
        self
    }

    /// Apply policy to isolation
    pub fn apply(&self, isolation: &mut PluginIsolation) {
        for rule in &self.rules {
            rule.apply(isolation);
        }
    }

    /// Get policy name
    pub fn name(&self) -> &str {
        &self.name
    }
}

/// Isolation rule
#[derive(Debug, Clone)]
pub struct IsolationRule {
    /// Rule condition
    condition: IsolationCondition,
    /// Rule action
    action: IsolationAction,
}

impl IsolationRule {
    /// Create a new isolation rule
    pub fn new(condition: IsolationCondition, action: IsolationAction) -> Self {
        Self { condition, action }
    }

    /// Apply rule to isolation
    pub fn apply(&self, isolation: &mut PluginIsolation) {
        if self.condition.matches(isolation) {
            self.action.apply(isolation);
        }
    }
}

/// Isolation condition
#[derive(Debug, Clone)]
pub enum IsolationCondition {
    /// Match by plugin ID
    PluginId(alloc::string::String),
    /// Match by capability
    HasCapability(PluginCapability),
    /// Match by permission
    HasPermission(PluginPermission),
    /// Match by isolation level
    IsolationLevel(IsolationLevel),
}

impl IsolationCondition {
    /// Check if condition matches isolation
    pub fn matches(&self, isolation: &PluginIsolation) -> bool {
        match self {
            IsolationCondition::PluginId(id) => isolation.plugin_id == *id,
            IsolationCondition::HasCapability(_) => false, // Would check metadata
            IsolationCondition::HasPermission(_) => false, // Would check metadata
            IsolationCondition::IsolationLevel(level) => isolation.level == *level,
        }
    }
}

/// Isolation action
#[derive(Debug, Clone)]
pub enum IsolationAction {
    /// Allow operation
    AllowOperation(PluginOperation),
    /// Block operation
    BlockOperation(PluginOperation),
    /// Set resource limit
    SetResourceLimit(alloc::string::String, u64),
    /// Change isolation level
    ChangeLevel(IsolationLevel),
}

impl IsolationAction {
    /// Apply action to isolation
    pub fn apply(&self, isolation: &mut PluginIsolation) {
        match self {
            IsolationAction::AllowOperation(op) => {
                isolation.allowed_operations.insert(op.clone());
            }
            IsolationAction::BlockOperation(op) => {
                isolation.blocked_operations.insert(op.clone());
            }
            IsolationAction::SetResourceLimit(limit_name, value) => {
                match limit_name.as_str() {
                    "memory" => isolation.resource_limits.max_memory = *value,
                    "cpu" => isolation.resource_limits.max_cpu_time = *value,
                    "execution" => isolation.resource_limits.max_execution_time = *value,
                    "network" => isolation.resource_limits.max_network_bandwidth = *value,
                    _ => {}
                }
            }
            IsolationAction::ChangeLevel(level) => {
                isolation.level = *level;
            }
        }
    }
}

/// Isolation statistics
#[derive(Debug, Clone, Default)]
pub struct IsolationStats {
    /// Total active isolations
    pub total_isolations: u32,
    /// Active isolation policies
    pub active_policies: u32,
    /// Security violations blocked
    pub violations_blocked: u64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_isolation_level_ordering() {
        assert!(IsolationLevel::Standard < IsolationLevel::High);
        assert!(IsolationLevel::High < IsolationLevel::Maximum);
    }

    #[test]
    fn test_plugin_operation_hash() {
        use core::hash::{Hash, Hasher};
        use std::collections::hash_map::DefaultHasher;

        let mut hasher1 = DefaultHasher::new();
        PluginOperation::Execute.hash(&mut hasher1);

        let mut hasher2 = DefaultHasher::new();
        PluginOperation::Execute.hash(&mut hasher2);

        assert_eq!(hasher1.finish(), hasher2.finish());
    }

    #[test]
    fn test_isolation_manager() {
        let mut manager = IsolationManager::new();
        assert_eq!(manager.stats().total_isolations, 0);
        assert_eq!(manager.stats().active_policies, 0);
    }

    #[test]
    fn test_isolation_policy() {
        let policy = IsolationPolicy::new("test-policy".into());
        assert_eq!(policy.name(), "test-policy");
    }

    #[test]
    fn test_isolation_rule() {
        let condition = IsolationCondition::IsolationLevel(IsolationLevel::Maximum);
        let action = IsolationAction::AllowOperation(PluginOperation::NetworkAccess);
        let rule = IsolationRule::new(condition, action);

        let mut isolation = PluginIsolation {
            plugin_id: "test".into(),
            level: IsolationLevel::Maximum,
            resource_limits: ResourceLimits::default(),
            allowed_operations: alloc::collections::BTreeSet::new(),
            blocked_operations: alloc::collections::BTreeSet::new(),
        };

        rule.apply(&mut isolation);
        assert!(isolation.allowed_operations.contains(&PluginOperation::NetworkAccess));
    }

    #[test]
    fn test_isolation_condition() {
        let condition = IsolationCondition::PluginId("test-plugin".into());

        let isolation = PluginIsolation {
            plugin_id: "test-plugin".into(),
            level: IsolationLevel::Standard,
            resource_limits: ResourceLimits::default(),
            allowed_operations: alloc::collections::BTreeSet::new(),
            blocked_operations: alloc::collections::BTreeSet::new(),
        };

        assert!(condition.matches(&isolation));

        let wrong_condition = IsolationCondition::PluginId("other-plugin".into());
        assert!(!wrong_condition.matches(&isolation));
    }
}
