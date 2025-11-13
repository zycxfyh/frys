//! Alerting engine and rule management

use crate::*;
use alloc::collections::BTreeMap;
use alloc::string::String;
use alloc::vec::Vec;
use chrono::{DateTime, Utc, Duration};
use dashmap::DashMap;
use tokio::sync::RwLock;

/// Alerting engine for managing alert rules and notifications
pub struct AlertingEngine {
    /// Alert rules
    rules: DashMap<String, AlertRule>,
    /// Active alerts
    active_alerts: DashMap<String, Alert>,
    /// Alert history
    alert_history: RwLock<Vec<Alert>>,
    /// Notification channels
    channels: DashMap<String, Box<dyn NotificationChannel>>,
    /// Evaluation interval
    evaluation_interval: u64,
}

impl AlertingEngine {
    /// Create a new alerting engine
    pub fn new(evaluation_interval: u64) -> Self {
        Self {
            rules: DashMap::new(),
            active_alerts: DashMap::new(),
            alert_history: RwLock::new(Vec::new()),
            channels: DashMap::new(),
            evaluation_interval,
        }
    }

    /// Create a new alert rule
    pub async fn create_rule(&self, rule: AlertRule) -> Result<String> {
        let rule_id = uuid::Uuid::new_v4().to_string();

        // Validate rule
        self.validate_rule(&rule)?;

        let rule_with_id = AlertRule {
            id: rule_id.clone(),
            ..rule
        };

        self.rules.insert(rule_id.clone(), rule_with_id);
        Ok(rule_id)
    }

    /// Update an alert rule
    pub async fn update_rule(&self, rule_id: &str, updates: AlertRuleUpdate) -> Result<()> {
        if let Some(mut rule) = self.rules.get_mut(rule_id) {
            if let Some(name) = updates.name {
                rule.name = name;
            }
            if let Some(description) = updates.description {
                rule.description = description;
            }
            if let Some(condition) = updates.condition {
                rule.condition = condition;
            }
            if let Some(severity) = updates.severity {
                rule.severity = severity;
            }
            if let Some(channels) = updates.channels {
                rule.channels = channels;
            }
            if let Some(enabled) = updates.enabled {
                rule.enabled = enabled;
            }
            if let Some(cooldown) = updates.cooldown {
                rule.cooldown = cooldown;
            }

            // Re-validate rule
            self.validate_rule(&rule)?;
        } else {
            return Err(MonitoringError::NotFound(format!("Alert rule {} not found", rule_id)));
        }

        Ok(())
    }

    /// Delete an alert rule
    pub async fn delete_rule(&self, rule_id: &str) -> Result<()> {
        self.rules.remove(rule_id);
        Ok(())
    }

    /// Get all alert rules
    pub fn get_rules(&self) -> Vec<AlertRule> {
        self.rules.iter().map(|r| r.value().clone()).collect()
    }

    /// Get alert rule by ID
    pub fn get_rule(&self, rule_id: &str) -> Option<AlertRule> {
        self.rules.get(rule_id).map(|r| r.value().clone())
    }

    /// Register a notification channel
    pub fn register_channel(&self, name: &str, channel: Box<dyn NotificationChannel>) {
        self.channels.insert(name.to_string(), channel);
    }

    /// Get all active alerts
    pub fn get_active_alerts(&self) -> Vec<Alert> {
        self.active_alerts.iter().map(|a| a.value().clone()).collect()
    }

    /// Get alert history
    pub async fn get_alert_history(&self, limit: usize) -> Vec<Alert> {
        let history = self.alert_history.read().await;
        history.iter().rev().take(limit).cloned().collect()
    }

    /// Acknowledge an alert
    pub async fn acknowledge_alert(&self, alert_id: &str, user: &str) -> Result<()> {
        if let Some(mut alert) = self.active_alerts.get_mut(alert_id) {
            alert.acknowledged = true;
            alert.acknowledged_by = Some(user.to_string());
            alert.acknowledged_at = Some(Utc::now());
        } else {
            return Err(MonitoringError::NotFound(format!("Alert {} not found", alert_id)));
        }
        Ok(())
    }

    /// Resolve an alert
    pub async fn resolve_alert(&self, alert_id: &str) -> Result<()> {
        if let Some(alert) = self.active_alerts.remove(alert_id) {
            let mut resolved_alert = alert.1;
            resolved_alert.resolved = true;
            resolved_alert.resolved_at = Some(Utc::now());

            // Add to history
            let mut history = self.alert_history.write().await;
            history.push(resolved_alert);
        }
        Ok(())
    }

    /// Evaluate alert rules against metrics/events
    pub async fn evaluate_rules(&self, metrics: &BTreeMap<String, f64>) -> Result<()> {
        for rule_entry in self.rules.iter() {
            let rule = rule_entry.value();
            if !rule.enabled {
                continue;
            }

            // Check if rule should be evaluated (cooldown)
            if self.should_skip_evaluation(&rule).await {
                continue;
            }

            // Evaluate condition
            if self.evaluate_condition(&rule.condition, metrics) {
                self.fire_alert(rule).await?;
            }
        }
        Ok(())
    }

    /// Evaluate alert rules against a monitoring event
    pub async fn evaluate_event(&self, event: &MonitoringEvent) -> Result<()> {
        // Convert event data to metrics format for evaluation
        let metrics = event.data.iter()
            .filter_map(|(key, value)| {
                if let serde_json::Value::Number(num) = value {
                    num.as_f64().map(|v| (key.clone(), v))
                } else {
                    None
                }
            })
            .collect::<BTreeMap<String, f64>>();

        self.evaluate_rules(&metrics).await
    }

    /// Get total number of alerts
    pub fn total_alerts(&self) -> u64 {
        self.active_alerts.len() as u64
    }

    /// Fire an alert
    async fn fire_alert(&self, rule: &AlertRule) -> Result<()> {
        let alert_id = uuid::Uuid::new_v4().to_string();

        let alert = Alert {
            id: alert_id.clone(),
            type_: rule.alert_type.clone(),
            severity: rule.severity.clone(),
            title: rule.name.clone(),
            message: rule.description.clone().unwrap_or_default(),
            source: "monitoring_system".to_string(),
            timestamp: Utc::now(),
            acknowledged: false,
            resolved: false,
            tags: rule.tags.clone(),
            data: BTreeMap::new(),
        };

        // Add to active alerts
        self.active_alerts.insert(alert_id.clone(), alert.clone());

        // Send notifications
        for channel_name in &rule.channels {
            if let Some(channel) = self.channels.get(channel_name) {
                if let Err(e) = channel.send_notification(&alert).await {
                    eprintln!("Failed to send notification via {}: {}", channel_name, e);
                }
            }
        }

        Ok(())
    }

    /// Check if rule evaluation should be skipped due to cooldown
    async fn should_skip_evaluation(&self, rule: &AlertRule) -> bool {
        let history = self.alert_history.read().await;

        // Check recent alerts from this rule
        let recent_alert = history.iter()
            .rev()
            .find(|alert| alert.title == rule.name);

        if let Some(alert) = recent_alert {
            let cooldown_duration = Duration::seconds(rule.cooldown as i64);
            let time_since_alert = Utc::now().signed_duration_since(alert.timestamp);

            return time_since_alert < cooldown_duration;
        }

        false
    }

    /// Evaluate alert condition
    fn evaluate_condition(&self, condition: &AlertCondition, metrics: &BTreeMap<String, f64>) -> bool {
        match condition {
            AlertCondition::Threshold { metric, operator, threshold } => {
                if let Some(value) = metrics.get(metric) {
                    match operator {
                        AlertOperator::GreaterThan => *value > *threshold,
                        AlertOperator::LessThan => *value < *threshold,
                        AlertOperator::Equal => (*value - *threshold).abs() < f64::EPSILON,
                        AlertOperator::NotEqual => (*value - *threshold).abs() >= f64::EPSILON,
                        AlertOperator::GreaterEqual => *value >= *threshold,
                        AlertOperator::LessEqual => *value <= *threshold,
                    }
                } else {
                    false
                }
            }
            AlertCondition::Composite { conditions, operator } => {
                let results: Vec<bool> = conditions.iter()
                    .map(|cond| self.evaluate_condition(cond, metrics))
                    .collect();

                match operator {
                    CompositeOperator::And => results.iter().all(|&r| r),
                    CompositeOperator::Or => results.iter().any(|&r| r),
                }
            }
        }
    }

    /// Validate alert rule
    fn validate_rule(&self, rule: &AlertRule) -> Result<()> {
        if rule.name.is_empty() {
            return Err(MonitoringError::ValidationError("Rule name cannot be empty".to_string()));
        }

        if rule.channels.is_empty() {
            return Err(MonitoringError::ValidationError("Rule must have at least one notification channel".to_string()));
        }

        // Validate condition recursively
        self.validate_condition(&rule.condition)?;

        Ok(())
    }

    /// Validate alert condition
    fn validate_condition(&self, condition: &AlertCondition) -> Result<()> {
        match condition {
            AlertCondition::Threshold { metric, .. } => {
                if metric.is_empty() {
                    return Err(MonitoringError::ValidationError("Metric name cannot be empty".to_string()));
                }
            }
            AlertCondition::Composite { conditions, .. } => {
                if conditions.is_empty() {
                    return Err(MonitoringError::ValidationError("Composite condition must have at least one sub-condition".to_string()));
                }
                for cond in conditions {
                    self.validate_condition(cond)?;
                }
            }
        }
        Ok(())
    }
}

/// Alert rule definition
#[derive(Debug, Clone)]
pub struct AlertRule {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub alert_type: AlertType,
    pub condition: AlertCondition,
    pub severity: AlertSeverity,
    pub channels: Vec<String>,
    pub tags: Vec<String>,
    pub enabled: bool,
    pub cooldown: u64, // seconds
}

/// Alert rule update
#[derive(Debug, Clone)]
pub struct AlertRuleUpdate {
    pub name: Option<String>,
    pub description: Option<String>,
    pub condition: Option<AlertCondition>,
    pub severity: Option<AlertSeverity>,
    pub channels: Option<Vec<String>>,
    pub enabled: Option<bool>,
    pub cooldown: Option<u64>,
}

/// Alert types
#[derive(Debug, Clone)]
pub enum AlertType {
    System,
    Performance,
    Security,
    Business,
    Custom(String),
}

/// Alert severities
#[derive(Debug, Clone)]
pub enum AlertSeverity {
    Low,
    Medium,
    High,
    Critical,
}

/// Alert conditions
#[derive(Debug, Clone)]
pub enum AlertCondition {
    Threshold {
        metric: String,
        operator: AlertOperator,
        threshold: f64,
    },
    Composite {
        conditions: Vec<AlertCondition>,
        operator: CompositeOperator,
    },
}

/// Alert operators
#[derive(Debug, Clone)]
pub enum AlertOperator {
    GreaterThan,
    LessThan,
    Equal,
    NotEqual,
    GreaterEqual,
    LessEqual,
}

/// Composite operators
#[derive(Debug, Clone)]
pub enum CompositeOperator {
    And,
    Or,
}

/// Alert definition
#[derive(Debug, Clone)]
pub struct Alert {
    pub id: String,
    pub type_: AlertType,
    pub severity: AlertSeverity,
    pub title: String,
    pub message: String,
    pub source: String,
    pub timestamp: DateTime<Utc>,
    pub acknowledged: bool,
    pub acknowledged_by: Option<String>,
    pub acknowledged_at: Option<DateTime<Utc>>,
    pub resolved: bool,
    pub resolved_at: Option<DateTime<Utc>>,
    pub tags: Vec<String>,
    pub data: BTreeMap<String, serde_json::Value>,
}

/// Notification channel trait
#[async_trait::async_trait]
pub trait NotificationChannel: Send + Sync {
    async fn send_notification(&self, alert: &Alert) -> Result<()>;
}

/// Email notification channel
pub struct EmailChannel {
    smtp_server: String,
    smtp_port: u16,
    username: String,
    password: String,
    from_address: String,
}

impl EmailChannel {
    pub fn new(
        smtp_server: String,
        smtp_port: u16,
        username: String,
        password: String,
        from_address: String,
    ) -> Self {
        Self {
            smtp_server,
            smtp_port,
            username,
            password,
            from_address,
        }
    }
}

#[async_trait::async_trait]
impl NotificationChannel for EmailChannel {
    async fn send_notification(&self, alert: &Alert) -> Result<()> {
        // Implementation would use lettre crate for email sending
        // For now, just log the alert
        println!("Email notification: {} - {}", alert.title, alert.message);
        Ok(())
    }
}

/// Webhook notification channel
pub struct WebhookChannel {
    url: String,
    headers: BTreeMap<String, String>,
}

impl WebhookChannel {
    pub fn new(url: String, headers: BTreeMap<String, String>) -> Self {
        Self { url, headers }
    }
}

#[async_trait::async_trait]
impl NotificationChannel for WebhookChannel {
    async fn send_notification(&self, alert: &Alert) -> Result<()> {
        // Implementation would send HTTP POST to webhook URL
        // For now, just log the alert
        println!("Webhook notification to {}: {} - {}", self.url, alert.title, alert.message);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_alert_rule_creation() {
        let engine = AlertingEngine::new(30);

        let rule = AlertRule {
            id: String::new(),
            name: "High CPU Usage".to_string(),
            description: Some("CPU usage is too high".to_string()),
            alert_type: AlertType::Performance,
            condition: AlertCondition::Threshold {
                metric: "cpu_usage".to_string(),
                operator: AlertOperator::GreaterThan,
                threshold: 90.0,
            },
            severity: AlertSeverity::High,
            channels: vec!["email".to_string()],
            tags: vec!["system".to_string()],
            enabled: true,
            cooldown: 300,
        };

        let rule_id = engine.create_rule(rule).await.unwrap();
        assert!(!rule_id.is_empty());

        let retrieved_rule = engine.get_rule(&rule_id).unwrap();
        assert_eq!(retrieved_rule.name, "High CPU Usage");
    }

    #[test]
    fn test_condition_evaluation() {
        let engine = AlertingEngine::new(30);

        let condition = AlertCondition::Threshold {
            metric: "cpu_usage".to_string(),
            operator: AlertOperator::GreaterThan,
            threshold: 90.0,
        };

        let mut metrics = BTreeMap::new();
        metrics.insert("cpu_usage".to_string(), 95.0);

        assert!(engine.evaluate_condition(&condition, &metrics));

        metrics.insert("cpu_usage".to_string(), 85.0);
        assert!(!engine.evaluate_condition(&condition, &metrics));
    }

    #[test]
    fn test_composite_condition() {
        let engine = AlertingEngine::new(30);

        let condition = AlertCondition::Composite {
            conditions: vec![
                AlertCondition::Threshold {
                    metric: "cpu_usage".to_string(),
                    operator: AlertOperator::GreaterThan,
                    threshold: 90.0,
                },
                AlertCondition::Threshold {
                    metric: "memory_usage".to_string(),
                    operator: AlertOperator::GreaterThan,
                    threshold: 85.0,
                },
            ],
            operator: CompositeOperator::And,
        };

        let mut metrics = BTreeMap::new();
        metrics.insert("cpu_usage".to_string(), 95.0);
        metrics.insert("memory_usage".to_string(), 90.0);

        assert!(engine.evaluate_condition(&condition, &metrics));

        metrics.insert("cpu_usage".to_string(), 85.0);
        assert!(!engine.evaluate_condition(&condition, &metrics));
    }

    #[tokio::test]
    async fn test_rule_validation() {
        let engine = AlertingEngine::new(30);

        // Valid rule
        let valid_rule = AlertRule {
            id: String::new(),
            name: "Test Alert".to_string(),
            description: None,
            alert_type: AlertType::System,
            condition: AlertCondition::Threshold {
                metric: "test_metric".to_string(),
                operator: AlertOperator::GreaterThan,
                threshold: 10.0,
            },
            severity: AlertSeverity::Medium,
            channels: vec!["email".to_string()],
            tags: vec![],
            enabled: true,
            cooldown: 60,
        };

        assert!(engine.create_rule(valid_rule).await.is_ok());

        // Invalid rule - empty name
        let invalid_rule = AlertRule {
            id: String::new(),
            name: "".to_string(),
            description: None,
            alert_type: AlertType::System,
            condition: AlertCondition::Threshold {
                metric: "test_metric".to_string(),
                operator: AlertOperator::GreaterThan,
                threshold: 10.0,
            },
            severity: AlertSeverity::Medium,
            channels: vec!["email".to_string()],
            tags: vec![],
            enabled: true,
            cooldown: 60,
        };

        assert!(engine.create_rule(invalid_rule).await.is_err());
    }
}
