//! Workflow Version Control System

use crate::*;
use alloc::collections::BTreeMap;
use alloc::string::String;
use alloc::vec::Vec;

/// Workflow version control system
pub struct WorkflowVersionControl {
    /// Version store mapping workflow_id -> versions
    versions: BTreeMap<String, Vec<WorkflowVersion>>,
    /// Current version for each workflow
    current_versions: BTreeMap<String, String>,
    /// Version history
    history: VersionHistory,
}

impl WorkflowVersionControl {
    /// Create new version control system
    pub fn new() -> Self {
        Self {
            versions: BTreeMap::new(),
            current_versions: BTreeMap::new(),
            history: VersionHistory::new(),
        }
    }

    /// Create new workflow version
    pub fn create_version(&mut self, workflow: Workflow, author: &str, message: &str) -> Result<String> {
        let version_id = self.generate_version_id();
        let timestamp = self.current_timestamp();

        let version = WorkflowVersion {
            id: version_id.clone(),
            workflow: workflow.clone(),
            author: author.to_string(),
            message: message.to_string(),
            timestamp,
            parent_version: self.current_versions.get(&workflow.id).cloned(),
            metadata: BTreeMap::new(),
        };

        // Store version
        self.versions
            .entry(workflow.id.clone())
            .or_insert_with(Vec::new)
            .push(version.clone());

        // Update current version
        self.current_versions.insert(workflow.id.clone(), version_id.clone());

        // Record in history
        self.history.record_change(VersionChange {
            change_type: ChangeType::VersionCreated,
            workflow_id: workflow.id.clone(),
            version_id: version_id.clone(),
            author: author.to_string(),
            timestamp,
            description: format!("Created version: {}", message),
        });

        Ok(version_id)
    }

    /// Get workflow version
    pub fn get_version(&self, workflow_id: &str, version_id: &str) -> Option<&WorkflowVersion> {
        self.versions.get(workflow_id)?
            .iter()
            .find(|v| v.id == version_id)
    }

    /// Get current version of workflow
    pub fn get_current_version(&self, workflow_id: &str) -> Option<&WorkflowVersion> {
        let version_id = self.current_versions.get(workflow_id)?;
        self.get_version(workflow_id, version_id)
    }

    /// Get all versions of workflow
    pub fn get_workflow_versions(&self, workflow_id: &str) -> Vec<&WorkflowVersion> {
        self.versions.get(workflow_id)
            .map(|versions| versions.iter().collect())
            .unwrap_or_default()
    }

    /// Compare two versions
    pub fn compare_versions(&self, workflow_id: &str, version_a: &str, version_b: &str) -> Result<VersionDiff> {
        let version_a = self.get_version(workflow_id, version_a)
            .ok_or(WorkflowError::InvalidWorkflow(format!("Version {} not found", version_a)))?;

        let version_b = self.get_version(workflow_id, version_b)
            .ok_or(WorkflowError::InvalidWorkflow(format!("Version {} not found", version_b)))?;

        let diff = self.compute_diff(&version_a.workflow, &version_b.workflow);

        Ok(VersionDiff {
            version_a: version_a.id.clone(),
            version_b: version_b.id.clone(),
            changes: diff,
        })
    }

    /// Rollback to previous version
    pub fn rollback(&mut self, workflow_id: &str, target_version: &str, author: &str) -> Result<()> {
        // Verify version exists
        if !self.version_exists(workflow_id, target_version) {
            return Err(WorkflowError::InvalidWorkflow(format!("Version {} not found", target_version)));
        }

        // Update current version
        self.current_versions.insert(workflow_id.to_string(), target_version.to_string());

        // Record rollback in history
        self.history.record_change(VersionChange {
            change_type: ChangeType::Rollback,
            workflow_id: workflow_id.to_string(),
            version_id: target_version.to_string(),
            author: author.to_string(),
            timestamp: self.current_timestamp(),
            description: format!("Rolled back to version {}", target_version),
        });

        Ok(())
    }

    /// Create branch from version
    pub fn create_branch(&mut self, workflow_id: &str, from_version: &str, branch_name: &str, author: &str) -> Result<String> {
        // For simplicity, we'll just create a new version with branch metadata
        let base_version = self.get_version(workflow_id, from_version)
            .ok_or(WorkflowError::InvalidWorkflow(format!("Version {} not found", from_version)))?;

        let mut branched_workflow = base_version.workflow.clone();
        branched_workflow.name = format!("{}_branch_{}", branched_workflow.name, branch_name);

        let branch_version = self.create_version(
            branched_workflow,
            author,
            &format!("Created branch '{}' from version {}", branch_name, from_version)
        )?;

        Ok(branch_version)
    }

    /// Merge versions (simplified)
    pub fn merge_versions(&mut self, workflow_id: &str, source_version: &str, target_version: &str, author: &str) -> Result<String> {
        let source = self.get_version(workflow_id, source_version)
            .ok_or(WorkflowError::InvalidWorkflow(format!("Source version {} not found", source_version)))?;

        let target = self.get_version(workflow_id, target_version)
            .ok_or(WorkflowError::InvalidWorkflow(format!("Target version {} not found", target_version)))?;

        // Simple merge: prefer target version, add source nodes if they don't exist
        let mut merged_workflow = target.workflow.clone();

        for (node_id, node) in &source.workflow.nodes {
            if !merged_workflow.nodes.contains_key(node_id) {
                merged_workflow.nodes.insert(node_id.clone(), node.clone());
            }
        }

        // Create merged version
        let merged_version = self.create_version(
            merged_workflow,
            author,
            &format!("Merged version {} into {}", source_version, target_version)
        )?;

        Ok(merged_version)
    }

    /// Get version history
    pub fn get_history(&self, workflow_id: Option<&str>) -> Vec<&VersionChange> {
        self.history.get_changes(workflow_id)
    }

    /// Tag a version
    pub fn tag_version(&mut self, workflow_id: &str, version_id: &str, tag: &str, author: &str) -> Result<()> {
        if let Some(version) = self.get_version_mut(workflow_id, version_id) {
            version.metadata.insert("tag".to_string(), tag.to_string());

            self.history.record_change(VersionChange {
                change_type: ChangeType::Tagged,
                workflow_id: workflow_id.to_string(),
                version_id: version_id.to_string(),
                author: author.to_string(),
                timestamp: self.current_timestamp(),
                description: format!("Tagged version {} with '{}'", version_id, tag),
            });
        }

        Ok(())
    }

    /// Get version by tag
    pub fn get_version_by_tag(&self, workflow_id: &str, tag: &str) -> Option<&WorkflowVersion> {
        self.versions.get(workflow_id)?
            .iter()
            .find(|v| v.metadata.get("tag").map(|t| t.as_str()) == Some(tag))
    }

    fn version_exists(&self, workflow_id: &str, version_id: &str) -> bool {
        self.get_version(workflow_id, version_id).is_some()
    }

    fn get_version_mut(&mut self, workflow_id: &str, version_id: &str) -> Option<&mut WorkflowVersion> {
        self.versions.get_mut(workflow_id)?
            .iter_mut()
            .find(|v| v.id == version_id)
    }

    fn compute_diff(&self, workflow_a: &Workflow, workflow_b: &Workflow) -> Vec<WorkflowChange> {
        let mut changes = Vec::new();

        // Compare nodes
        for (node_id, node_a) in &workflow_a.nodes {
            if let Some(node_b) = workflow_b.nodes.get(node_id) {
                if node_a.name != node_b.name {
                    changes.push(WorkflowChange::NodeModified {
                        node_id: node_id.clone(),
                        change: "name changed".to_string(),
                    });
                }
            } else {
                changes.push(WorkflowChange::NodeRemoved {
                    node_id: node_id.clone(),
                });
            }
        }

        for node_id in workflow_b.nodes.keys() {
            if !workflow_a.nodes.contains_key(node_id) {
                changes.push(WorkflowChange::NodeAdded {
                    node_id: node_id.clone(),
                });
            }
        }

        // Compare edges
        for edge_a in &workflow_a.edges {
            if !workflow_b.edges.contains(edge_a) {
                changes.push(WorkflowChange::EdgeRemoved {
                    from: edge_a.from.clone(),
                    to: edge_a.to.clone(),
                });
            }
        }

        for edge_b in &workflow_b.edges {
            if !workflow_a.edges.contains(edge_b) {
                changes.push(WorkflowChange::EdgeAdded {
                    from: edge_b.from.clone(),
                    to: edge_b.to.clone(),
                });
            }
        }

        changes
    }

    fn generate_version_id(&self) -> String {
        format!("v_{}", self.current_timestamp())
    }

    fn current_timestamp(&self) -> u64 {
        0 // Placeholder
    }
}

/// Workflow version
#[derive(Debug, Clone)]
pub struct WorkflowVersion {
    pub id: String,
    pub workflow: Workflow,
    pub author: String,
    pub message: String,
    pub timestamp: u64,
    pub parent_version: Option<String>,
    pub metadata: BTreeMap<String, String>,
}

/// Version history
pub struct VersionHistory {
    changes: Vec<VersionChange>,
}

impl VersionHistory {
    pub fn new() -> Self {
        Self {
            changes: Vec::new(),
        }
    }

    pub fn record_change(&mut self, change: VersionChange) {
        self.changes.push(change);
    }

    pub fn get_changes(&self, workflow_id: Option<&str>) -> Vec<&VersionChange> {
        if let Some(workflow_id) = workflow_id {
            self.changes.iter()
                .filter(|c| c.workflow_id == workflow_id)
                .collect()
        } else {
            self.changes.iter().collect()
        }
    }
}

/// Version change record
#[derive(Debug, Clone)]
pub struct VersionChange {
    pub change_type: ChangeType,
    pub workflow_id: String,
    pub version_id: String,
    pub author: String,
    pub timestamp: u64,
    pub description: String,
}

/// Change types
#[derive(Debug, Clone)]
pub enum ChangeType {
    VersionCreated,
    Rollback,
    Tagged,
    Merged,
    Branched,
}

/// Version difference
#[derive(Debug, Clone)]
pub struct VersionDiff {
    pub version_a: String,
    pub version_b: String,
    pub changes: Vec<WorkflowChange>,
}

/// Workflow changes
#[derive(Debug, Clone)]
pub enum WorkflowChange {
    NodeAdded { node_id: String },
    NodeRemoved { node_id: String },
    NodeModified { node_id: String, change: String },
    EdgeAdded { from: String, to: String },
    EdgeRemoved { from: String, to: String },
    PropertyChanged { node_id: String, property: String, old_value: String, new_value: String },
}

/// Workflow template system
pub struct WorkflowTemplateSystem {
    templates: BTreeMap<String, WorkflowTemplate>,
}

impl WorkflowTemplateSystem {
    pub fn new() -> Self {
        Self {
            templates: BTreeMap::new(),
        }
    }

    /// Register a template
    pub fn register_template(&mut self, template: WorkflowTemplate) {
        self.templates.insert(template.id.clone(), template);
    }

    /// Get template
    pub fn get_template(&self, template_id: &str) -> Option<&WorkflowTemplate> {
        self.templates.get(template_id)
    }

    /// Create workflow from template
    pub fn create_from_template(&self, template_id: &str, name: &str, parameters: &BTreeMap<String, String>) -> Result<Workflow> {
        let template = self.get_template(template_id)
            .ok_or(WorkflowError::InvalidWorkflow(format!("Template {} not found", template_id)))?;

        template.create_workflow(name, parameters)
    }

    /// List available templates
    pub fn list_templates(&self) -> Vec<&WorkflowTemplate> {
        self.templates.values().collect()
    }
}

/// Workflow template
pub struct WorkflowTemplate {
    pub id: String,
    pub name: String,
    pub description: String,
    pub category: String,
    pub tags: Vec<String>,
    pub parameters: Vec<TemplateParameter>,
    pub create_workflow: Box<dyn Fn(&str, &BTreeMap<String, String>) -> Workflow>,
}

/// Template parameter
#[derive(Debug, Clone)]
pub struct TemplateParameter {
    pub name: String,
    pub description: String,
    pub parameter_type: ParameterType,
    pub required: bool,
    pub default_value: Option<String>,
}

/// Parameter types
#[derive(Debug, Clone)]
pub enum ParameterType {
    String,
    Number,
    Boolean,
    Selection(Vec<String>),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_version_control_creation() {
        let vc = WorkflowVersionControl::new();
        // Test passes if creation succeeds
    }

    #[test]
    fn test_create_version() {
        let mut vc = WorkflowVersionControl::new();

        let workflow = Workflow::builder("test").build();
        let version_id = vc.create_version(workflow, "test_author", "initial version").unwrap();

        assert!(!version_id.is_empty());

        // Check version was created
        let versions = vc.get_workflow_versions("test");
        assert_eq!(versions.len(), 1);
        assert_eq!(versions[0].author, "test_author");
    }

    #[test]
    fn test_version_comparison() {
        let mut vc = WorkflowVersionControl::new();

        let mut workflow1 = Workflow::builder("test").build();
        let version1 = vc.create_version(workflow1.clone(), "author", "version 1").unwrap();

        // Modify workflow
        workflow1.name = "test_modified".to_string();
        let version2 = vc.create_version(workflow1, "author", "version 2").unwrap();

        let diff = vc.compare_versions("test", &version1, &version2).unwrap();
        assert!(!diff.changes.is_empty());
    }

    #[test]
    fn test_template_system() {
        let mut system = WorkflowTemplateSystem::new();

        let template = WorkflowTemplate {
            id: "simple_pipeline".to_string(),
            name: "Simple Pipeline".to_string(),
            description: "A simple data processing pipeline".to_string(),
            category: "Data Processing".to_string(),
            tags: vec!["pipeline".to_string(), "data".to_string()],
            parameters: vec![],
            create_workflow: Box::new(|name, _params| Workflow::builder(name).build()),
        };

        system.register_template(template);

        let templates = system.list_templates();
        assert_eq!(templates.len(), 1);
        assert_eq!(templates[0].name, "Simple Pipeline");
    }

    #[test]
    fn test_version_history() {
        let mut history = VersionHistory::new();

        let change = VersionChange {
            change_type: ChangeType::VersionCreated,
            workflow_id: "wf1".to_string(),
            version_id: "v1".to_string(),
            author: "test".to_string(),
            timestamp: 0,
            description: "test change".to_string(),
        };

        history.record_change(change);

        let changes = history.get_changes(Some("wf1"));
        assert_eq!(changes.len(), 1);
        assert_eq!(changes[0].author, "test");
    }
}
