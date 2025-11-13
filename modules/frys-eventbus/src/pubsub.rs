//! Publish-Subscribe system for EventBus

use crate::*;
use core::sync::atomic::{AtomicU64, Ordering};

/// Subscriber registry for managing subscriptions
#[derive(Debug)]
pub struct SubscriberRegistry {
    /// Active subscribers
    subscribers: alloc::collections::BTreeMap<u64, Subscriber>,
    /// Topic to subscriber mapping
    topic_subscribers: alloc::collections::BTreeMap<alloc::string::String, alloc::vec::Vec<u64>>,
    /// Next subscriber ID
    next_id: AtomicU64,
}

impl SubscriberRegistry {
    /// Create a new subscriber registry
    pub fn new() -> Self {
        Self {
            subscribers: alloc::collections::BTreeMap::new(),
            topic_subscribers: alloc::collections::BTreeMap::new(),
            next_id: AtomicU64::new(1),
        }
    }

    /// Register a new subscriber
    pub fn register(&mut self, name: alloc::string::String, topic_filter: alloc::string::String, config: SubscriberConfig) -> Result<u64> {
        let id = self.next_id.fetch_add(1, Ordering::AcqRel);

        let subscriber = Subscriber::new(id, name, topic_filter.clone(), config);
        self.subscribers.insert(id, subscriber);

        // Add to topic mapping
        self.topic_subscribers
            .entry(topic_filter)
            .or_insert_with(alloc::vec::Vec::new)
            .push(id);

        Ok(id)
    }

    /// Unregister a subscriber
    pub fn unregister(&mut self, id: u64) -> Result<()> {
        if let Some(subscriber) = self.subscribers.remove(&id) {
            // Remove from topic mapping
            if let Some(subscribers) = self.topic_subscribers.get_mut(&subscriber.topic_filter) {
                subscribers.retain(|&sid| sid != id);
                if subscribers.is_empty() {
                    self.topic_subscribers.remove(&subscriber.topic_filter);
                }
            }
            Ok(())
        } else {
            Err(EventBusError::SubscriberNotFound { subscriber_id: id })
        }
    }

    /// Get subscriber by ID
    pub fn get_subscriber(&self, id: u64) -> Option<&Subscriber> {
        self.subscribers.get(&id)
    }

    /// Find subscribers interested in an event
    pub fn find_interested_subscribers(&self, event: &Event) -> alloc::vec::Vec<u64> {
        let mut interested = alloc::vec::Vec::new();

        for subscriber in self.subscribers.values() {
            if subscriber.is_interested(event) {
                interested.push(subscriber.id);
            }
        }

        interested
    }

    /// Get all subscribers
    pub fn all_subscribers(&self) -> alloc::vec::Vec<&Subscriber> {
        self.subscribers.values().collect()
    }

    /// Get subscriber count
    pub fn subscriber_count(&self) -> usize {
        self.subscribers.len()
    }
}

/// Publisher registry for managing publishers
#[derive(Debug)]
pub struct PublisherRegistry {
    /// Active publishers
    publishers: alloc::collections::BTreeMap<u64, Publisher>,
    /// Next publisher ID
    next_id: AtomicU64,
}

impl PublisherRegistry {
    /// Create a new publisher registry
    pub fn new() -> Self {
        Self {
            publishers: alloc::collections::BTreeMap::new(),
            next_id: AtomicU64::new(1),
        }
    }

    /// Register a new publisher
    pub fn register(&mut self, name: alloc::string::String, config: PublisherConfig) -> Result<u64> {
        let id = self.next_id.fetch_add(1, Ordering::AcqRel);

        let publisher = Publisher::new(id, name, config);
        self.publishers.insert(id, publisher);

        Ok(id)
    }

    /// Unregister a publisher
    pub fn unregister(&mut self, id: u64) -> Result<()> {
        if self.publishers.remove(&id).is_some() {
            Ok(())
        } else {
            Err(EventBusError::InvalidConfiguration {
                field: "publisher_id",
                reason: "publisher not found",
            })
        }
    }

    /// Get publisher by ID
    pub fn get_publisher(&self, id: u64) -> Option<&Publisher> {
        self.publishers.get(&id)
    }

    /// Get all publishers
    pub fn all_publishers(&self) -> alloc::vec::Vec<&Publisher> {
        self.publishers.values().collect()
    }

    /// Get publisher count
    pub fn publisher_count(&self) -> usize {
        self.publishers.len()
    }
}

/// Event router for routing events to subscribers
#[derive(Debug)]
pub struct EventRouter {
    /// Subscriber registry reference
    subscriber_registry: *const SubscriberRegistry,
    /// Publisher registry reference
    publisher_registry: *const PublisherRegistry,
}

impl EventRouter {
    /// Create a new event router
    pub fn new(subscriber_registry: &SubscriberRegistry, publisher_registry: &PublisherRegistry) -> Self {
        Self {
            subscriber_registry,
            publisher_registry,
        }
    }

    /// Route an event to interested subscribers
    pub fn route_event(&self, event: &Event) -> alloc::vec::Vec<u64> {
        unsafe {
            if let Some(registry) = self.subscriber_registry.as_ref() {
                registry.find_interested_subscribers(event)
            } else {
                alloc::vec::Vec::new()
            }
        }
    }

    /// Validate an event before routing
    pub fn validate_event(&self, event: &Event) -> Result<()> {
        // Check topic length
        if event.topic.len() > crate::MAX_TOPIC_LENGTH {
            return Err(EventBusError::InvalidTopic {
                topic: event.topic.clone(),
                reason: "topic too long",
            });
        }

        // Check payload size
        if event.payload.len() > crate::MAX_PAYLOAD_SIZE {
            return Err(EventBusError::ResourceLimitExceeded {
                resource: "payload_size",
                limit: crate::MAX_PAYLOAD_SIZE,
                requested: event.payload.len(),
            });
        }

        // Validate topic format (basic check)
        if event.topic.is_empty() || event.topic.contains('\0') {
            return Err(EventBusError::InvalidTopic {
                topic: event.topic.clone(),
                reason: "invalid topic format",
            });
        }

        Ok(())
    }
}

/// Event dispatcher for managing event delivery
#[derive(Debug)]
pub struct EventDispatcher {
    /// Subscriber registry
    subscriber_registry: SubscriberRegistry,
    /// Publisher registry
    publisher_registry: PublisherRegistry,
    /// Event router
    router: EventRouter,
}

impl EventDispatcher {
    /// Create a new event dispatcher
    pub fn new() -> Self {
        let subscriber_registry = SubscriberRegistry::new();
        let publisher_registry = PublisherRegistry::new();
        let router = EventRouter::new(&subscriber_registry, &publisher_registry);

        Self {
            subscriber_registry,
            publisher_registry,
            router,
        }
    }

    /// Subscribe to events
    pub fn subscribe(&mut self, name: alloc::string::String, topic_filter: alloc::string::String, config: SubscriberConfig) -> Result<u64> {
        self.subscriber_registry.register(name, topic_filter, config)
    }

    /// Unsubscribe from events
    pub fn unsubscribe(&mut self, subscriber_id: u64) -> Result<()> {
        self.subscriber_registry.unregister(subscriber_id)
    }

    /// Register a publisher
    pub fn register_publisher(&mut self, name: alloc::string::String, config: PublisherConfig) -> Result<u64> {
        self.publisher_registry.register(name, config)
    }

    /// Dispatch an event to interested subscribers
    pub fn dispatch_event(&self, event: Event) -> Result<alloc::vec::Vec<u64>> {
        // Validate event
        self.router.validate_event(&event)?;

        // Find interested subscribers
        let subscribers = self.router.route_event(&event);

        // In a real implementation, events would be queued for delivery
        // For now, we just return the subscriber IDs

        Ok(subscribers)
    }

    /// Get subscriber registry
    pub fn subscriber_registry(&self) -> &SubscriberRegistry {
        &self.subscriber_registry
    }

    /// Get publisher registry
    pub fn publisher_registry(&self) -> &PublisherRegistry {
        &self.publisher_registry
    }

    /// Get subscriber count
    pub fn subscriber_count(&self) -> usize {
        self.subscriber_registry.subscriber_count()
    }

    /// Get publisher count
    pub fn publisher_count(&self) -> usize {
        self.publisher_registry.publisher_count()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_subscriber_registry() {
        let mut registry = SubscriberRegistry::new();

        // Register subscriber
        let id = registry.register(
            "test_subscriber".into(),
            "test.*".into(),
            SubscriberConfig::default(),
        ).unwrap();

        assert_eq!(id, 1);
        assert_eq!(registry.subscriber_count(), 1);

        // Get subscriber
        let subscriber = registry.get_subscriber(id).unwrap();
        assert_eq!(subscriber.name, "test_subscriber");
        assert_eq!(subscriber.topic_filter, "test.*");

        // Unregister subscriber
        registry.unregister(id).unwrap();
        assert_eq!(registry.subscriber_count(), 0);
        assert!(registry.get_subscriber(id).is_none());
    }

    #[test]
    fn test_publisher_registry() {
        let mut registry = PublisherRegistry::new();

        // Register publisher
        let id = registry.register(
            "test_publisher".into(),
            PublisherConfig::default(),
        ).unwrap();

        assert_eq!(id, 1);
        assert_eq!(registry.publisher_count(), 1);

        // Get publisher
        let publisher = registry.get_publisher(id).unwrap();
        assert_eq!(publisher.name, "test_publisher");

        // Unregister publisher
        registry.unregister(id).unwrap();
        assert_eq!(registry.publisher_count(), 0);
    }

    #[test]
    fn test_event_router() {
        let subscriber_registry = SubscriberRegistry::new();
        let publisher_registry = PublisherRegistry::new();
        let router = EventRouter::new(&subscriber_registry, &publisher_registry);

        // Test event validation
        let valid_event = Event::new("test.topic".into(), b"payload".to_vec());
        assert!(router.validate_event(&valid_event).is_ok());

        // Test invalid topic
        let invalid_event = Event::new("".into(), b"payload".to_vec());
        assert!(router.validate_event(&invalid_event).is_err());

        // Test oversized payload
        let large_payload = alloc::vec![0u8; crate::MAX_PAYLOAD_SIZE + 1];
        let oversized_event = Event::new("test.topic".into(), large_payload);
        assert!(router.validate_event(&oversized_event).is_err());
    }

    #[test]
    fn test_event_dispatcher() {
        let mut dispatcher = EventDispatcher::new();

        // Subscribe to events
        let sub1 = dispatcher.subscribe(
            "subscriber1".into(),
            "user.*".into(),
            SubscriberConfig::default(),
        ).unwrap();

        let sub2 = dispatcher.subscribe(
            "subscriber2".into(),
            "order.*".into(),
            SubscriberConfig::default(),
        ).unwrap();

        assert_eq!(dispatcher.subscriber_count(), 2);

        // Register publisher
        let _pub1 = dispatcher.register_publisher(
            "publisher1".into(),
            PublisherConfig::default(),
        ).unwrap();

        assert_eq!(dispatcher.publisher_count(), 1);

        // Dispatch event
        let event = Event::new("user.created".into(), b"user data".to_vec());
        let subscribers = dispatcher.dispatch_event(event).unwrap();

        // Should match subscriber1 but not subscriber2
        assert_eq!(subscribers.len(), 1);
        assert_eq!(subscribers[0], sub1);
    }
}
