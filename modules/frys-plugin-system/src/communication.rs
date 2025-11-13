//! Plugin communication and messaging mechanisms

use crate::*;

/// Plugin message types
#[derive(Debug, Clone, serde::Deserialize, serde::Serialize)]
#[cfg_attr(feature = "serde", derive(serde::Deserialize, serde::Serialize))]
pub enum PluginMessage {
    /// Function call request
    FunctionCall {
        function: alloc::string::String,
        args: alloc::vec::Vec<MessageValue>,
    },
    /// Function call response
    FunctionResponse {
        result: MessageValue,
        error: Option<alloc::string::String>,
    },
    /// Event notification
    Event {
        event_type: alloc::string::String,
        data: MessageValue,
    },
    /// Heartbeat message
    Heartbeat {
        timestamp: u64,
    },
    /// Plugin status update
    StatusUpdate {
        status: PluginStatus,
    },
}

/// Message value types
#[derive(Debug, Clone, serde::Deserialize, serde::Serialize)]
#[cfg_attr(feature = "serde", derive(serde::Deserialize, serde::Serialize))]
pub enum MessageValue {
    /// Null value
    Null,
    /// Boolean value
    Bool(bool),
    /// Integer value
    Int(i64),
    /// Float value
    Float(f64),
    /// String value
    String(alloc::string::String),
    /// Binary data
    Bytes(alloc::vec::Vec<u8>),
    /// Array of values
    Array(alloc::vec::Vec<MessageValue>),
    /// Object/map of values
    Object(alloc::collections::BTreeMap<alloc::string::String, MessageValue>),
}

/// Plugin status information
#[derive(Debug, Clone, serde::Deserialize, serde::Serialize)]
#[cfg_attr(feature = "serde", derive(serde::Deserialize, serde::Serialize))]
pub struct PluginStatus {
    /// Plugin state
    pub state: alloc::string::String,
    /// Uptime in seconds
    pub uptime: u64,
    /// Memory usage
    pub memory_usage: u64,
    /// CPU usage percentage
    pub cpu_usage: f32,
    /// Last activity timestamp
    pub last_activity: u64,
}

/// Plugin communication channel
#[derive(Debug)]
pub struct PluginChannel {
    /// Channel ID
    id: alloc::string::String,
    /// Sender plugin ID
    sender: PluginId,
    /// Receiver plugin ID
    receiver: PluginId,
    /// Message queue
    #[cfg(feature = "async")]
    queue: tokio::sync::mpsc::UnboundedSender<PluginMessage>,
    /// Message buffer (for no_std)
    #[cfg(not(feature = "async"))]
    buffer: alloc::collections::VecDeque<PluginMessage>,
    /// Channel statistics
    stats: ChannelStats,
}

impl PluginChannel {
    /// Create a new plugin channel
    #[cfg(feature = "async")]
    pub fn new(sender: PluginId, receiver: PluginId) -> (Self, tokio::sync::mpsc::UnboundedReceiver<PluginMessage>) {
        let (tx, rx) = tokio::sync::mpsc::unbounded_channel();
        let id = alloc::format!("{}-{}", sender, receiver);

        let channel = Self {
            id,
            sender,
            receiver,
            queue: tx,
            stats: ChannelStats::default(),
        };

        (channel, rx)
    }

    #[cfg(not(feature = "async"))]
    pub fn new(sender: PluginId, receiver: PluginId) -> Self {
        let id = alloc::format!("{}-{}", sender, receiver);

        Self {
            id,
            sender,
            receiver,
            buffer: alloc::collections::VecDeque::new(),
            stats: ChannelStats::default(),
        }
    }

    /// Send a message through the channel
    #[cfg(feature = "async")]
    pub fn send(&self, message: PluginMessage) -> Result<()> {
        self.queue.send(message).map_err(|_| PluginError::CommunicationError {
            from_plugin: self.sender.clone(),
            to_plugin: self.receiver.clone(),
            reason: "channel closed".into(),
        })?;
        self.stats.record_send();
        Ok(())
    }

    #[cfg(not(feature = "async"))]
    pub fn send(&mut self, message: PluginMessage) -> Result<()> {
        self.buffer.push_back(message);
        self.stats.record_send();
        Ok(())
    }

    /// Receive a message from the channel (for non-async version)
    #[cfg(not(feature = "async"))]
    pub fn receive(&mut self) -> Option<PluginMessage> {
        let message = self.buffer.pop_front();
        if message.is_some() {
            self.stats.record_receive();
        }
        message
    }

    /// Get channel statistics
    pub fn stats(&self) -> &ChannelStats {
        &self.stats
    }

    /// Get sender plugin ID
    pub fn sender(&self) -> &PluginId {
        &self.sender
    }

    /// Get receiver plugin ID
    pub fn receiver(&self) -> &PluginId {
        &self.receiver
    }
}

/// Channel statistics
#[derive(Debug, Clone, Default)]
pub struct ChannelStats {
    /// Messages sent
    pub messages_sent: u64,
    /// Messages received
    pub messages_received: u64,
    /// Bytes sent
    pub bytes_sent: u64,
    /// Bytes received
    pub bytes_received: u64,
    /// Channel creation timestamp
    pub created_at: u64,
}

impl ChannelStats {
    /// Record a message send
    pub fn record_send(&self) {
        // In real implementation, this would be atomic
    }

    /// Record a message receive
    pub fn record_receive(&self) {
        // In real implementation, this would be atomic
    }

    /// Record bytes sent
    pub fn record_bytes_sent(&self, bytes: u64) {
        // In real implementation, this would be atomic
    }

    /// Record bytes received
    pub fn record_bytes_received(&self, bytes: u64) {
        // In real implementation, this would be atomic
    }

    /// Get messages per second rate
    pub fn messages_per_second(&self) -> f64 {
        let uptime = current_timestamp() - self.created_at;
        if uptime > 0 {
            self.messages_sent as f64 / uptime as f64
        } else {
            0.0
        }
    }
}

/// Plugin communication broker
#[derive(Debug)]
pub struct CommunicationBroker {
    /// Active channels
    #[cfg(feature = "async")]
    channels: alloc::collections::BTreeMap<alloc::string::String, tokio::sync::mpsc::UnboundedSender<PluginMessage>>,
    /// Channel registry
    channel_registry: alloc::collections::BTreeMap<alloc::string::String, PluginChannel>,
    /// Message router
    router: MessageRouter,
    /// Broker statistics
    stats: BrokerStats,
}

impl CommunicationBroker {
    /// Create a new communication broker
    pub fn new() -> Self {
        Self {
            #[cfg(feature = "async")]
            channels: alloc::collections::BTreeMap::new(),
            channel_registry: alloc::collections::BTreeMap::new(),
            router: MessageRouter::new(),
            stats: BrokerStats::default(),
        }
    }

    /// Create a communication channel between two plugins
    #[cfg(feature = "async")]
    pub fn create_channel(&mut self, sender: PluginId, receiver: PluginId) -> Result<tokio::sync::mpsc::UnboundedReceiver<PluginMessage>> {
        let channel_id = alloc::format!("{}-{}", sender, receiver);

        if self.channel_registry.contains_key(&channel_id) {
            return Err(PluginError::CommunicationError {
                from_plugin: sender,
                to_plugin: receiver,
                reason: "channel already exists".into(),
            });
        }

        let (channel, rx) = PluginChannel::new(sender, receiver);
        self.channel_registry.insert(channel_id.clone(), channel);
        self.channels.insert(channel_id, rx);

        self.stats.channels_created += 1;

        Ok(rx)
    }

    #[cfg(not(feature = "async"))]
    pub fn create_channel(&mut self, sender: PluginId, receiver: PluginId) -> Result<()> {
        let channel_id = alloc::format!("{}-{}", sender, receiver);

        if self.channel_registry.contains_key(&channel_id) {
            return Err(PluginError::CommunicationError {
                from_plugin: sender,
                to_plugin: receiver,
                reason: "channel already exists".into(),
            });
        }

        let channel = PluginChannel::new(sender, receiver);
        self.channel_registry.insert(channel_id, channel);

        self.stats.channels_created += 1;

        Ok(())
    }

    /// Send a message to a plugin
    pub async fn send_message(&self, to_plugin: &PluginId, message: PluginMessage) -> Result<()> {
        // Route the message
        let targets = self.router.route_message(to_plugin, &message).await?;

        for target in targets {
            if let Some(channel) = self.channel_registry.get(&target) {
                #[cfg(feature = "async")]
                channel.send(message.clone())?;
                #[cfg(not(feature = "async"))]
                {
                    // For non-async, we can't send directly
                    return Err(PluginError::CommunicationError {
                        from_plugin: "broker".into(),
                        to_plugin: to_plugin.clone(),
                        reason: "async not available".into(),
                    });
                }
            }
        }

        self.stats.record_message();
        Ok(())
    }

    /// Broadcast a message to all plugins
    pub async fn broadcast(&self, message: PluginMessage) -> Result<()> {
        for channel in self.channel_registry.values() {
            #[cfg(feature = "async")]
            channel.send(message.clone())?;
        }

        self.stats.record_broadcast();
        Ok(())
    }

    /// Get broker statistics
    pub fn stats(&self) -> &BrokerStats {
        &self.stats
    }

    /// Close a communication channel
    pub fn close_channel(&mut self, sender: &PluginId, receiver: &PluginId) -> Result<()> {
        let channel_id = alloc::format!("{}-{}", sender, receiver);

        if self.channel_registry.remove(&channel_id).is_some() {
            #[cfg(feature = "async")]
            self.channels.remove(&channel_id);

            self.stats.channels_closed += 1;
            Ok(())
        } else {
            Err(PluginError::CommunicationError {
                from_plugin: sender.clone(),
                to_plugin: receiver.clone(),
                reason: "channel not found".into(),
            })
        }
    }
}

/// Message router for inter-plugin communication
#[derive(Debug)]
pub struct MessageRouter {
    /// Routing rules
    rules: alloc::vec::Vec<RoutingRule>,
}

impl MessageRouter {
    /// Create a new message router
    pub fn new() -> Self {
        Self {
            rules: alloc::vec::Vec::new(),
        }
    }

    /// Add a routing rule
    pub fn add_rule(&mut self, rule: RoutingRule) {
        self.rules.push(rule);
    }

    /// Route a message to target plugins
    pub async fn route_message(&self, target_plugin: &PluginId, message: &PluginMessage) -> Result<alloc::vec::Vec<alloc::string::String>> {
        let mut targets = alloc::vec::Vec::new();

        // Check routing rules
        for rule in &self.rules {
            if rule.matches(target_plugin, message) {
                targets.extend(rule.get_targets().iter().cloned());
            }
        }

        // Default routing - direct to target plugin
        if targets.is_empty() {
            targets.push(target_plugin.clone());
        }

        Ok(targets)
    }
}

/// Routing rule for message routing
#[derive(Debug, Clone)]
pub struct RoutingRule {
    /// Rule condition
    condition: RoutingCondition,
    /// Target channel IDs
    targets: alloc::vec::Vec<alloc::string::String>,
}

impl RoutingRule {
    /// Create a new routing rule
    pub fn new(condition: RoutingCondition, targets: alloc::vec::Vec<alloc::string::String>) -> Self {
        Self { condition, targets }
    }

    /// Check if rule matches the message
    pub fn matches(&self, target_plugin: &PluginId, message: &PluginMessage) -> bool {
        self.condition.evaluate(target_plugin, message)
    }

    /// Get routing targets
    pub fn get_targets(&self) -> &[alloc::string::String] {
        &self.targets
    }
}

/// Routing condition
#[derive(Debug, Clone)]
pub enum RoutingCondition {
    /// Match by plugin ID
    PluginId(alloc::string::String),
    /// Match by message type
    MessageType(alloc::string::String),
    /// Match by event type (for Event messages)
    EventType(alloc::string::String),
    /// Custom condition
    Custom(alloc::string::String),
}

impl RoutingCondition {
    /// Evaluate the condition
    pub fn evaluate(&self, target_plugin: &PluginId, message: &PluginMessage) -> bool {
        match self {
            RoutingCondition::PluginId(plugin_id) => target_plugin == plugin_id,
            RoutingCondition::MessageType(msg_type) => {
                match message {
                    PluginMessage::FunctionCall { .. } if msg_type == "function_call" => true,
                    PluginMessage::FunctionResponse { .. } if msg_type == "function_response" => true,
                    PluginMessage::Event { .. } if msg_type == "event" => true,
                    PluginMessage::Heartbeat { .. } if msg_type == "heartbeat" => true,
                    PluginMessage::StatusUpdate { .. } if msg_type == "status_update" => true,
                    _ => false,
                }
            }
            RoutingCondition::EventType(event_type) => {
                if let PluginMessage::Event { event_type: msg_event_type, .. } = message {
                    msg_event_type == event_type
                } else {
                    false
                }
            }
            RoutingCondition::Custom(_) => {
                // Custom conditions would be evaluated separately
                false
            }
        }
    }
}

/// Broker statistics
#[derive(Debug, Clone, Default)]
pub struct BrokerStats {
    /// Total messages routed
    pub messages_routed: u64,
    /// Total broadcasts sent
    pub broadcasts_sent: u64,
    /// Active channels
    pub channels_active: u64,
    /// Channels created
    pub channels_created: u64,
    /// Channels closed
    pub channels_closed: u64,
}

impl BrokerStats {
    /// Record a message routing
    pub fn record_message(&self) {
        // In real implementation, this would be atomic
    }

    /// Record a broadcast
    pub fn record_broadcast(&self) {
        // In real implementation, this would be atomic
    }

    /// Update active channels count
    pub fn update_active_channels(&mut self) {
        self.channels_active = self.channels_created - self.channels_closed;
    }
}

/// Get current timestamp (simplified)
fn current_timestamp() -> u64 {
    // In a real implementation, this would use system time
    0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_message_value() {
        let bool_val = MessageValue::Bool(true);
        let int_val = MessageValue::Int(42);
        let string_val = MessageValue::String("hello".into());
        let bytes_val = MessageValue::Bytes(vec![1, 2, 3]);

        assert!(matches!(bool_val, MessageValue::Bool(true)));
        assert!(matches!(int_val, MessageValue::Int(42)));
        assert!(matches!(string_val, MessageValue::String(_)));
        assert!(matches!(bytes_val, MessageValue::Bytes(_)));
    }

    #[test]
    fn test_plugin_message() {
        let call_msg = PluginMessage::FunctionCall {
            function: "process".into(),
            args: vec![MessageValue::String("input".into())],
        };

        match call_msg {
            PluginMessage::FunctionCall { function, args } => {
                assert_eq!(function, "process");
                assert_eq!(args.len(), 1);
            }
            _ => panic!("Wrong message type"),
        }

        let event_msg = PluginMessage::Event {
            event_type: "data_ready".into(),
            data: MessageValue::Int(100),
        };

        match event_msg {
            PluginMessage::Event { event_type, .. } => {
                assert_eq!(event_type, "data_ready");
            }
            _ => panic!("Wrong message type"),
        }
    }

    #[cfg(feature = "async")]
    #[tokio::test]
    async fn test_plugin_channel() {
        let (mut channel, mut rx) = PluginChannel::new("sender".into(), "receiver".into());

        let message = PluginMessage::Heartbeat { timestamp: 123456 };
        channel.send(message).unwrap();

        let received = rx.recv().await.unwrap();
        match received {
            PluginMessage::Heartbeat { timestamp } => assert_eq!(timestamp, 123456),
            _ => panic!("Wrong message type"),
        }
    }

    #[test]
    fn test_routing_condition() {
        let plugin_condition = RoutingCondition::PluginId("test-plugin".into());
        let message_condition = RoutingCondition::MessageType("function_call".into());

        let message = PluginMessage::FunctionCall {
            function: "test".into(),
            args: vec![],
        };

        assert!(plugin_condition.evaluate(&"test-plugin".into(), &message));
        assert!(!plugin_condition.evaluate(&"other-plugin".into(), &message));

        assert!(message_condition.evaluate(&"test-plugin".into(), &message));

        let event_message = PluginMessage::Event {
            event_type: "test".into(),
            data: MessageValue::Null,
        };

        assert!(!message_condition.evaluate(&"test-plugin".into(), &event_message));
    }

    #[test]
    fn test_channel_stats() {
        let stats = ChannelStats {
            created_at: 1000,
            ..Default::default()
        };

        // Messages per second should be 0 initially
        assert_eq!(stats.messages_per_second(), 0.0);
    }

    #[test]
    fn test_broker_stats() {
        let mut stats = BrokerStats::default();
        stats.channels_created = 5;
        stats.channels_closed = 2;

        stats.update_active_channels();
        assert_eq!(stats.channels_active, 3);
    }
}
