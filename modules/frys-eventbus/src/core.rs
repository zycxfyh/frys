//! Core EventBus structures and types

use crate::*;
use core::time::Duration;

/// Event priority levels
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum Priority {
    Low = 0,
    Normal = 1,
    High = 2,
    Critical = 3,
}

/// Event header for metadata
#[derive(Debug, Clone, Default)]
pub struct EventHeaders {
    /// Custom headers
    pub headers: alloc::collections::BTreeMap<alloc::string::String, alloc::string::String>,
}

impl EventHeaders {
    /// Create new headers
    pub fn new() -> Self {
        Self::default()
    }

    /// Set a header value
    pub fn set(&mut self, key: alloc::string::String, value: alloc::string::String) {
        self.headers.insert(key, value);
    }

    /// Get a header value
    pub fn get(&self, key: &str) -> Option<&alloc::string::String> {
        self.headers.get(key)
    }

    /// Check if header exists
    pub fn contains(&self, key: &str) -> bool {
        self.headers.contains_key(key)
    }
}

/// Event structure
#[derive(Debug, Clone)]
pub struct Event {
    /// Event topic
    pub topic: alloc::string::String,
    /// Event payload (can be any serializable data)
    pub payload: alloc::vec::Vec<u8>,
    /// Event headers/metadata
    pub headers: EventHeaders,
    /// Event priority
    pub priority: Priority,
    /// Event timestamp
    pub timestamp: u64, // Unix timestamp in milliseconds
    /// Event ID (optional, for tracking)
    pub id: Option<u64>,
}

impl Event {
    /// Create a new event
    pub fn new(topic: alloc::string::String, payload: alloc::vec::Vec<u8>) -> Self {
        Self {
            topic,
            payload,
            headers: EventHeaders::new(),
            priority: Priority::Normal,
            timestamp: 0, // Would be set to current time in real implementation
            id: None,
        }
    }

    /// Create event with priority
    pub fn with_priority(mut self, priority: Priority) -> Self {
        self.priority = priority;
        self
    }

    /// Add header
    pub fn with_header(mut self, key: alloc::string::String, value: alloc::string::String) -> Self {
        self.headers.set(key, value);
        self
    }

    /// Set event ID
    pub fn with_id(mut self, id: u64) -> Self {
        self.id = Some(id);
        self
    }

    /// Get payload as string (if valid UTF-8)
    pub fn payload_as_string(&self) -> Option<&str> {
        core::str::from_utf8(&self.payload).ok()
    }

    /// Check if event matches a topic pattern
    pub fn matches_topic(&self, pattern: &str) -> bool {
        // Simple wildcard matching (would be more sophisticated in real implementation)
        if pattern == "*" || pattern == self.topic.as_str() {
            return true;
        }

        // Support for topic.* patterns
        if let Some(stripped) = pattern.strip_suffix(".*") {
            return self.topic.starts_with(stripped) &&
                   (self.topic.len() == stripped.len() || self.topic.as_bytes()[stripped.len()] == b'.');
        }

        false
    }
}

/// Subscriber handle for receiving events
#[derive(Debug)]
pub struct Subscriber {
    /// Subscriber ID
    pub id: u64,
    /// Subscriber name
    pub name: alloc::string::String,
    /// Topic filter
    pub topic_filter: alloc::string::String,
    /// Subscriber configuration
    pub config: SubscriberConfig,
}

impl Subscriber {
    /// Create a new subscriber
    pub fn new(id: u64, name: alloc::string::String, topic_filter: alloc::string::String, config: SubscriberConfig) -> Self {
        Self {
            id,
            name,
            topic_filter,
            config,
        }
    }

    /// Check if this subscriber is interested in an event
    pub fn is_interested(&self, event: &Event) -> bool {
        event.matches_topic(&self.topic_filter)
    }
}

/// Publisher handle for sending events
#[derive(Debug)]
pub struct Publisher {
    /// Publisher ID
    pub id: u64,
    /// Publisher name
    pub name: alloc::string::String,
    /// Publisher configuration
    pub config: PublisherConfig,
}

impl Publisher {
    /// Create a new publisher
    pub fn new(id: u64, name: alloc::string::String, config: PublisherConfig) -> Self {
        Self {
            id,
            name,
            config,
        }
    }
}

/// Main EventBus structure
#[derive(Debug)]
pub struct EventBus {
    /// Configuration
    config: EventBusConfig,
    /// Metrics collector
    metrics: EventBusMetrics,
    /// Subscriber registry
    subscribers: alloc::collections::BTreeMap<u64, Subscriber>,
    /// Publisher registry
    publishers: alloc::collections::BTreeMap<u64, Publisher>,
    /// Next subscriber ID
    next_subscriber_id: core::sync::atomic::AtomicU64,
    /// Next publisher ID
    next_publisher_id: core::sync::atomic::AtomicU64,
    /// Distributed capabilities (optional)
    #[cfg(feature = "distributed")]
    distributed: Option<DistributedEventBus>,
}

/// Distributed EventBus capabilities
#[cfg(feature = "distributed")]
pub struct DistributedEventBus {
    /// Service discovery
    discovery: crate::distributed::ServiceDiscovery,
    /// Cluster manager
    cluster: crate::distributed::ClusterManager,
    /// Distributed routing table
    routing_table: crate::distributed::DistributedRoutingTable,
    /// Replication manager
    replication: crate::distributed::ReplicationManager,
    /// Consensus manager
    consensus: crate::distributed::ConsensusManager,
}

impl EventBus {
    /// Create a new EventBus with configuration
    pub async fn new(config: EventBusConfig) -> Result<Self> {
        // Validate configuration
        Self::validate_config(&config)?;

        #[cfg(feature = "distributed")]
        let distributed = if config.enable_distributed {
            use crate::distributed::*;
            Some(DistributedEventBus {
                discovery: ServiceDiscovery::new(
                    crate::distributed::NodeId::new(config.node_id.clone()),
                    DiscoveryStrategy::Static { nodes: Vec::new() }
                ),
                cluster: ClusterManager::new(
                    config.node_id.clone(),
                    ClusterConfig::default(),
                ),
                routing_table: DistributedRoutingTable::new(config.node_id.clone()),
                replication: ReplicationManager::new(ReplicationConfig {
                    factor: 3,
                    strategy: ReplicationStrategy::MasterSlave,
                    timeout: 5000,
                    max_lag: 1000,
                }),
                consensus: ConsensusManager::new(
                    ConsensusAlgorithm::Raft,
                    config.node_id.clone(),
                    config.cluster_peers.clone(),
                ),
            })
        } else {
            None
        };

        Ok(Self {
            config,
            metrics: EventBusMetrics::new(),
            subscribers: alloc::collections::BTreeMap::new(),
            publishers: alloc::collections::BTreeMap::new(),
            next_subscriber_id: core::sync::atomic::AtomicU64::new(1),
            next_publisher_id: core::sync::atomic::AtomicU64::new(1),
            #[cfg(feature = "distributed")]
            distributed,
        })
    }

    /// Subscribe to events with a topic filter
    pub async fn subscribe(&mut self, topic_filter: &str, _filter: Filter) -> Result<SubscriberHandle> {
        // Register subscription in distributed mode if enabled
        #[cfg(feature = "distributed")]
        if let Some(distributed) = &mut self.distributed {
            // Propose subscription via consensus
            let command = crate::distributed::ConsensusCommand::AddSubscription {
                topic: topic_filter.to_string(),
                subscriber: distributed.routing_table.local_node_id.clone(),
            };
            distributed.consensus.propose_command(command).await?;
        }
        let subscriber_id = self.next_subscriber_id.fetch_add(1, core::sync::atomic::Ordering::AcqRel);
        let subscriber_name = alloc::format!("subscriber_{}", subscriber_id);

        let subscriber = Subscriber::new(
            subscriber_id,
            subscriber_name,
            topic_filter.into(),
            SubscriberConfig::default(),
        );

        self.subscribers.insert(subscriber_id, subscriber);
        self.metrics.record_subscriber_added();

        Ok(SubscriberHandle {
            id: subscriber_id,
            eventbus: self as *const Self,
        })
    }

    /// Create a publisher
    pub async fn create_publisher(&mut self, name: Option<&str>) -> Result<PublisherHandle> {
        let publisher_id = self.next_publisher_id.fetch_add(1, core::sync::atomic::Ordering::AcqRel);
        let publisher_name = name.map(|n| n.into()).unwrap_or_else(|| alloc::format!("publisher_{}", publisher_id));

        let publisher = Publisher::new(
            publisher_id,
            publisher_name,
            PublisherConfig::default(),
        );

        self.publishers.insert(publisher_id, publisher);

        Ok(PublisherHandle {
            id: publisher_id,
            eventbus: self as *const Self,
        })
    }

    /// Publish an event
    pub async fn publish(&mut self, event: Event) -> Result<()> {
        // Handle distributed publishing if enabled
        #[cfg(feature = "distributed")]
        if let Some(distributed) = &mut self.distributed {
            return self.publish_distributed(event, distributed).await;
        }

        // Local publishing
        self.publish_local(event).await
    }

    /// Publish event locally
    async fn publish_local(&mut self, event: Event) -> Result<()> {
        self.metrics.record_event_published();

        // Route event to interested subscribers
        // This is a simplified implementation - real routing would be more sophisticated
        let interested_subscribers: alloc::vec::Vec<&Subscriber> = self.subscribers.values()
            .filter(|sub| sub.is_interested(&event))
            .collect();

        if interested_subscribers.is_empty() {
            self.metrics.record_event_dropped();
            return Ok(());
        }

        // In a real implementation, events would be queued for each subscriber
        // For now, we just record delivery
        for _subscriber in interested_subscribers {
            self.metrics.record_event_delivered();
        }

        Ok(())
    }

    /// Publish event in distributed mode
    #[cfg(feature = "distributed")]
    async fn publish_distributed(&mut self, event: Event, distributed: &mut DistributedEventBus) -> Result<()> {
        // Get routing decisions
        let routing_decisions = distributed.routing_table.route_event(&event);

        // Publish locally first
        self.publish_local(event.clone()).await?;

        // Publish to remote nodes based on routing decisions
        for decision in routing_decisions {
            if decision.node_id != distributed.routing_table.local_node_id.clone() {
                // Send to remote node via cluster manager
                let cluster_message = crate::distributed::ClusterMessage::EventForward {
                    event: event.clone(),
                    source_node: distributed.routing_table.local_node_id.clone(),
                    target_nodes: alloc::vec![decision.node_id.clone()],
                };

                distributed.cluster.send_to_node(&decision.node_id, cluster_message).await?;
            }
        }

        // Replicate event if needed
        let target_nodes = routing_decisions.into_iter()
            .filter(|d| d.node_id != distributed.routing_table.local_node_id)
            .map(|d| d.node_id)
            .collect::<alloc::vec::Vec<_>>();

        if !target_nodes.is_empty() {
            distributed.replication.replicate_event(&event, &target_nodes).await?;
        }

        Ok(())
    }

    /// Get current metrics
    pub fn metrics(&self) -> &EventBusMetrics {
        &self.metrics
    }

    /// Health check
    pub async fn health_check(&self) -> Result<()> {
        // Check subscriber limits
        if self.subscribers.len() >= self.config.max_subscribers {
            return Err(EventBusError::SubscriberLimitExceeded {
                current_count: self.subscribers.len(),
                max_count: self.config.max_subscribers,
            });
        }

        // Check metrics for issues
        let snapshot = self.metrics.snapshot();
        if !snapshot.is_healthy() {
            return Err(EventBusError::ResourceLimitExceeded {
                resource: "event_delivery_rate",
                limit: 95, // 95% delivery rate
                requested: (snapshot.delivery_rate * 100.0) as usize,
            });
        }

        Ok(())
    }

    /// Shutdown the eventbus
    pub async fn shutdown(self) -> Result<()> {
        // Cleanup resources
        // In a real implementation, this would wait for pending operations
        Ok(())
    }

    /// Validate configuration
    fn validate_config(config: &EventBusConfig) -> Result<()> {
        if config.queue_size == 0 {
            return Err(EventBusError::InvalidConfiguration {
                field: "queue_size",
                reason: "must be greater than 0",
            });
        }

        if config.max_subscribers == 0 {
            return Err(EventBusError::InvalidConfiguration {
                field: "max_subscribers",
                reason: "must be greater than 0",
            });
        }

        if config.backpressure_threshold > 100 {
            return Err(EventBusError::InvalidConfiguration {
                field: "backpressure_threshold",
                reason: "must be between 0 and 100",
            });
        }

        Ok(())
    }
}

/// Handle for subscriber operations
#[derive(Debug)]
pub struct SubscriberHandle {
    id: u64,
    eventbus: *const EventBus,
}

impl SubscriberHandle {
    /// Receive an event (blocking)
    pub async fn receive(&self) -> Option<Event> {
        // Simplified - in real implementation, this would dequeue from subscriber's queue
        None
    }

    /// Try to receive an event (non-blocking)
    pub fn try_receive(&self) -> Option<Event> {
        // Simplified - in real implementation, this would try to dequeue from subscriber's queue
        None
    }

    /// Unsubscribe
    pub async fn unsubscribe(self) -> Result<()> {
        // In a real implementation, this would remove the subscriber from the registry
        Ok(())
    }
}

/// Handle for publisher operations
#[derive(Debug)]
pub struct PublisherHandle {
    id: u64,
    eventbus: *const EventBus,
}

impl PublisherHandle {
    /// Publish an event
    pub async fn publish(&self, event: Event) -> Result<()> {
        // In a real implementation, this would call the eventbus publish method
        Ok(())
    }
}

/// Filter for event matching (placeholder)
#[derive(Debug, Clone, Default)]
pub struct Filter {
    // Placeholder for filter implementation
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_event_creation() {
        let event = Event::new("test.topic".into(), b"Hello World".to_vec())
            .with_priority(Priority::High)
            .with_id(123);

        assert_eq!(event.topic, "test.topic");
        assert_eq!(event.payload, b"Hello World");
        assert_eq!(event.priority, Priority::High);
        assert_eq!(event.id, Some(123));
    }

    #[test]
    fn test_event_topic_matching() {
        let event = Event::new("user.created".into(), vec![]);

        assert!(event.matches_topic("user.created"));
        assert!(event.matches_topic("*"));
        assert!(event.matches_topic("user.*"));
        assert!(!event.matches_topic("order.*"));
        assert!(!event.matches_topic("user.updated"));
    }

    #[test]
    fn test_event_headers() {
        let mut headers = EventHeaders::new();
        headers.set("content-type".into(), "application/json".into());

        assert_eq!(headers.get("content-type"), Some(&"application/json".into()));
        assert!(headers.contains("content-type"));
        assert!(!headers.contains("missing"));
    }

    #[tokio::test]
    async fn test_eventbus_creation() {
        let config = EventBusConfig::default();
        let eventbus = EventBus::new(config).await.unwrap();

        assert!(eventbus.subscribers.is_empty());
        assert!(eventbus.publishers.is_empty());
    }

    #[tokio::test]
    async fn test_eventbus_subscribe() {
        let config = EventBusConfig::default();
        let mut eventbus = EventBus::new(config).await.unwrap();

        let subscriber = eventbus.subscribe("test.*", Filter::default()).await.unwrap();
        assert_eq!(subscriber.id, 1);
        assert_eq!(eventbus.subscribers.len(), 1);
    }

    #[tokio::test]
    async fn test_eventbus_publish() {
        let config = EventBusConfig::default();
        let mut eventbus = EventBus::new(config).await.unwrap();

        // Subscribe to events
        let _subscriber = eventbus.subscribe("test.*", Filter::default()).await.unwrap();

        // Publish an event
        let event = Event::new("test.message".into(), b"test payload".to_vec());
        eventbus.publish(event).await.unwrap();

        // Check metrics
        let metrics = eventbus.metrics();
        assert_eq!(metrics.events_published.load(core::sync::atomic::Ordering::Acquire), 1);
        assert_eq!(metrics.events_delivered.load(core::sync::atomic::Ordering::Acquire), 1);
    }
}
