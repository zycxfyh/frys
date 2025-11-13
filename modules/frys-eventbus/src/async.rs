//! Asynchronous event processing and backpressure handling

use crate::*;
use core::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
#[cfg(feature = "std")]
use tokio::sync::{mpsc, Semaphore};
#[cfg(feature = "std")]
use std::sync::Arc;

/// Async event processor for handling events asynchronously
#[cfg(feature = "std")]
#[derive(Debug)]
pub struct AsyncEventProcessor {
    /// Processing queue
    queue: mpsc::UnboundedSender<Event>,
    /// Worker handles
    workers: alloc::vec::Vec<tokio::task::JoinHandle<()>>,
    /// Running flag
    running: Arc<AtomicBool>,
    /// Worker count
    worker_count: usize,
    /// Processing semaphore for backpressure
    semaphore: Arc<Semaphore>,
}

#[cfg(feature = "std")]
impl AsyncEventProcessor {
    /// Create a new async event processor
    pub fn new(worker_count: usize, queue_capacity: usize) -> Self {
        let (tx, mut rx) = mpsc::unbounded_channel::<Event>();
        let running = Arc::new(AtomicBool::new(false));
        let semaphore = Arc::new(Semaphore::new(queue_capacity));

        let mut workers = alloc::vec::Vec::new();

        for i in 0..worker_count {
            let running_clone = Arc::clone(&running);
            let semaphore_clone = Arc::clone(&semaphore);

            let worker = tokio::spawn(async move {
                Self::worker_loop(i, running_clone, semaphore_clone, rx).await;
            });

            workers.push(worker);
        }

        Self {
            queue: tx,
            workers,
            running: Arc::clone(&running),
            worker_count,
            semaphore,
        }
    }

    /// Start processing events
    pub fn start(&self) {
        self.running.store(true, Ordering::Release);
    }

    /// Stop processing events
    pub async fn stop(&self) {
        self.running.store(false, Ordering::Release);

        // Wait for all workers to finish
        for worker in &self.workers {
            let _ = worker.await;
        }
    }

    /// Submit an event for processing
    pub async fn submit_event(&self, event: Event) -> Result<()> {
        // Acquire semaphore for backpressure
        let permit = self.semaphore.acquire().await.map_err(|_| {
            EventBusError::BackpressureTriggered {
                queue_size: self.worker_count,
                threshold: self.worker_count,
            }
        })?;

        // Send event to processing queue
        self.queue.send(event).map_err(|_| {
            EventBusError::QueueFull {
                current_size: self.worker_count,
                max_size: self.worker_count,
            }
        })?;

        // Release permit (will be consumed by worker)
        drop(permit);

        Ok(())
    }

    /// Worker loop for processing events
    async fn worker_loop(
        worker_id: usize,
        running: Arc<AtomicBool>,
        semaphore: Arc<Semaphore>,
        mut rx: mpsc::UnboundedReceiver<Event>,
    ) {
        while running.load(Ordering::Acquire) {
            match rx.recv().await {
                Some(event) => {
                    // Process the event
                    Self::process_event(worker_id, event).await;

                    // Release semaphore to allow more events
                    semaphore.add_permits(1);
                }
                None => {
                    // Channel closed, exit
                    break;
                }
            }
        }
    }

    /// Process a single event
    async fn process_event(worker_id: usize, event: Event) {
        // Simulate event processing
        // In a real implementation, this would:
        // 1. Apply filters
        // 2. Route to subscribers
        // 3. Handle delivery
        // 4. Update metrics

        let _ = (worker_id, event); // Suppress unused variable warnings

        // Simulate processing time
        tokio::task::yield_now().await;
    }

    /// Get current queue size
    pub fn queue_size(&self) -> usize {
        // In a real implementation, this would return actual queue size
        0
    }

    /// Check if backpressure is active
    pub fn backpressure_active(&self) -> bool {
        self.semaphore.available_permits() == 0
    }
}

/// Backpressure controller for managing system load
#[derive(Debug)]
pub struct BackpressureController {
    /// High water mark
    high_water_mark: usize,
    /// Low water mark
    low_water_mark: usize,
    /// Current pressure level
    current_pressure: AtomicUsize,
    /// Backpressure active flag
    backpressure_active: AtomicBool,
}

impl BackpressureController {
    /// Create a new backpressure controller
    pub fn new(high_water_mark: usize, low_water_mark: usize) -> Self {
        assert!(high_water_mark > low_water_mark);

        Self {
            high_water_mark,
            low_water_mark,
            current_pressure: AtomicUsize::new(0),
            backpressure_active: AtomicBool::new(false),
        }
    }

    /// Record pressure increase
    pub fn increase_pressure(&self) {
        let pressure = self.current_pressure.fetch_add(1, Ordering::AcqRel) + 1;

        if pressure >= self.high_water_mark && !self.backpressure_active.load(Ordering::Acquire) {
            self.backpressure_active.store(true, Ordering::Release);
        }
    }

    /// Record pressure decrease
    pub fn decrease_pressure(&self) {
        let pressure = self.current_pressure.fetch_sub(1, Ordering::AcqRel).saturating_sub(1);

        if pressure <= self.low_water_mark && self.backpressure_active.load(Ordering::Acquire) {
            self.backpressure_active.store(false, Ordering::Release);
        }
    }

    /// Check if backpressure is active
    pub fn is_backpressure_active(&self) -> bool {
        self.backpressure_active.load(Ordering::Acquire)
    }

    /// Get current pressure level
    pub fn current_pressure(&self) -> usize {
        self.current_pressure.load(Ordering::Acquire)
    }

    /// Reset pressure to zero
    pub fn reset(&self) {
        self.current_pressure.store(0, Ordering::Release);
        self.backpressure_active.store(false, Ordering::Release);
    }
}

/// Event batch processor for efficient bulk operations
#[derive(Debug)]
pub struct EventBatchProcessor {
    /// Batch size
    batch_size: usize,
    /// Current batch
    current_batch: alloc::vec::Vec<Event>,
    /// Processing function
    processor: alloc::boxed::Box<dyn Fn(alloc::vec::Vec<Event>) + Send + Sync>,
}

impl EventBatchProcessor {
    /// Create a new batch processor
    pub fn new<F>(batch_size: usize, processor: F) -> Self
    where
        F: Fn(alloc::vec::Vec<Event>) + Send + Sync + 'static,
    {
        Self {
            batch_size,
            current_batch: alloc::vec::Vec::new(),
            processor: alloc::boxed::Box::new(processor),
        }
    }

    /// Add event to batch
    pub fn add_event(&mut self, event: Event) {
        self.current_batch.push(event);

        if self.current_batch.len() >= self.batch_size {
            self.flush();
        }
    }

    /// Flush current batch
    pub fn flush(&mut self) {
        if !self.current_batch.is_empty() {
            let batch = core::mem::take(&mut self.current_batch);
            (self.processor)(batch);
        }
    }

    /// Get current batch size
    pub fn current_batch_size(&self) -> usize {
        self.current_batch.len()
    }

    /// Check if batch is full
    pub fn is_batch_full(&self) -> bool {
        self.current_batch.len() >= self.batch_size
    }
}

impl Drop for EventBatchProcessor {
    fn drop(&mut self) {
        self.flush();
    }
}

/// Async subscriber for receiving events asynchronously
#[cfg(feature = "std")]
#[derive(Debug)]
pub struct AsyncSubscriber {
    /// Subscriber ID
    id: u64,
    /// Event receiver
    receiver: mpsc::UnboundedReceiver<Event>,
    /// Subscriber info
    info: Subscriber,
}

#[cfg(feature = "std")]
impl AsyncSubscriber {
    /// Create a new async subscriber
    pub fn new(id: u64, info: Subscriber) -> (Self, mpsc::UnboundedSender<Event>) {
        let (tx, rx) = mpsc::unbounded_channel();

        (Self { id, receiver: rx, info }, tx)
    }

    /// Receive next event asynchronously
    pub async fn receive(&mut self) -> Option<Event> {
        self.receiver.recv().await
    }

    /// Try to receive event without blocking
    pub fn try_receive(&mut self) -> Option<Event> {
        match self.receiver.try_recv() {
            Ok(event) => Some(event),
            Err(_) => None,
        }
    }

    /// Get subscriber ID
    pub fn id(&self) -> u64 {
        self.id
    }

    /// Get subscriber info
    pub fn info(&self) -> &Subscriber {
        &self.info
    }
}

/// Event stream for reactive programming patterns
#[cfg(feature = "std")]
#[derive(Debug)]
pub struct EventStream {
    /// Stream receiver
    receiver: mpsc::UnboundedReceiver<Event>,
    /// Filters to apply
    filters: alloc::vec::Vec<alloc::boxed::Box<dyn Fn(&Event) -> bool + Send + Sync>>,
}

#[cfg(feature = "std")]
impl EventStream {
    /// Create a new event stream
    pub fn new() -> (Self, mpsc::UnboundedSender<Event>) {
        let (tx, rx) = mpsc::unbounded_channel();

        (Self {
            receiver: rx,
            filters: alloc::vec::Vec::new(),
        }, tx)
    }

    /// Add a filter to the stream
    pub fn filter<F>(&mut self, filter_fn: F)
    where
        F: Fn(&Event) -> bool + Send + Sync + 'static,
    {
        self.filters.push(alloc::boxed::Box::new(filter_fn));
    }

    /// Get the next event from the stream
    pub async fn next(&mut self) -> Option<Event> {
        loop {
            match self.receiver.recv().await {
                Some(event) => {
                    // Apply filters
                    let passes_filters = self.filters.iter().all(|filter| filter(&event));
                    if passes_filters {
                        return Some(event);
                    }
                }
                None => return None,
            }
        }
    }
}

/// Circuit breaker for fault tolerance
#[derive(Debug)]
pub struct CircuitBreaker {
    /// Failure threshold
    failure_threshold: usize,
    /// Recovery timeout (milliseconds)
    recovery_timeout: u64,
    /// Current failure count
    failure_count: AtomicUsize,
    /// Circuit state
    state: AtomicUsize, // 0: Closed, 1: Open, 2: Half-Open
    /// Last failure time
    last_failure_time: AtomicUsize,
}

impl CircuitBreaker {
    /// Circuit states
    const CLOSED: usize = 0;
    const OPEN: usize = 1;
    const HALF_OPEN: usize = 2;

    /// Create a new circuit breaker
    pub fn new(failure_threshold: usize, recovery_timeout: u64) -> Self {
        Self {
            failure_threshold,
            recovery_timeout,
            failure_count: AtomicUsize::new(0),
            state: AtomicUsize::new(Self::CLOSED),
            last_failure_time: AtomicUsize::new(0),
        }
    }

    /// Record a successful operation
    pub fn record_success(&self) {
        self.failure_count.store(0, Ordering::Release);
        self.state.store(Self::CLOSED, Ordering::Release);
    }

    /// Record a failed operation
    pub fn record_failure(&self) {
        let failures = self.failure_count.fetch_add(1, Ordering::AcqRel) + 1;

        if failures >= self.failure_threshold {
            self.state.store(Self::OPEN, Ordering::Release);
            // In real implementation, set last_failure_time
        }
    }

    /// Check if circuit is closed (allowing operations)
    pub fn is_closed(&self) -> bool {
        match self.state.load(Ordering::Acquire) {
            Self::CLOSED => true,
            Self::OPEN => {
                // Check if recovery timeout has passed
                // Simplified - in real implementation, check time
                false
            }
            Self::HALF_OPEN => true, // Allow one operation to test
            _ => false,
        }
    }

    /// Get current state as string
    pub fn state_string(&self) -> &'static str {
        match self.state.load(Ordering::Acquire) {
            Self::CLOSED => "closed",
            Self::OPEN => "open",
            Self::HALF_OPEN => "half-open",
            _ => "unknown",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(feature = "std")]
    #[tokio::test]
    async fn test_async_event_processor() {
        let processor = AsyncEventProcessor::new(2, 10);
        processor.start();

        let event = Event::new("test.topic".into(), b"test data".to_vec());

        // Submit event
        processor.submit_event(event).await.unwrap();

        // Stop processor
        processor.stop().await;
    }

    #[test]
    fn test_backpressure_controller() {
        let controller = BackpressureController::new(10, 5);

        // Initially no backpressure
        assert!(!controller.is_backpressure_active());

        // Increase pressure
        for _ in 0..10 {
            controller.increase_pressure();
        }

        // Should trigger backpressure
        assert!(controller.is_backpressure_active());
        assert_eq!(controller.current_pressure(), 10);

        // Decrease pressure
        for _ in 0..6 {
            controller.decrease_pressure();
        }

        // Should relieve backpressure
        assert!(!controller.is_backpressure_active());
        assert_eq!(controller.current_pressure(), 4);
    }

    #[test]
    fn test_event_batch_processor() {
        let mut processed_batches = alloc::vec::Vec::new();

        let mut processor = EventBatchProcessor::new(3, move |batch| {
            processed_batches.push(batch);
        });

        // Add events
        for i in 0..5 {
            let event = Event::new(format!("topic{}", i), vec![i as u8]);
            processor.add_event(event);
        }

        // Should have processed one batch
        assert_eq!(processed_batches.len(), 1);
        assert_eq!(processed_batches[0].len(), 3);
        assert_eq!(processor.current_batch_size(), 2);

        // Flush remaining
        processor.flush();
        assert_eq!(processed_batches.len(), 2);
        assert_eq!(processed_batches[1].len(), 2);
    }

    #[cfg(feature = "std")]
    #[tokio::test]
    async fn test_async_subscriber() {
        let (mut subscriber, sender) = AsyncSubscriber::new(1, Subscriber::new(
            1,
            "test".into(),
            "*".into(),
            SubscriberConfig::default(),
        ));

        let event = Event::new("test.topic".into(), b"data".to_vec());

        // Send event
        sender.send(event.clone()).unwrap();

        // Receive event
        let received = subscriber.receive().await.unwrap();
        assert_eq!(received.topic, event.topic);
        assert_eq!(received.payload, event.payload);
    }

    #[cfg(feature = "std")]
    #[tokio::test]
    async fn test_event_stream() {
        let (mut stream, sender) = EventStream::new();

        // Add filter
        stream.filter(|event| event.topic.starts_with("user"));

        // Send events
        sender.send(Event::new("user.created".into(), b"data1".to_vec())).unwrap();
        sender.send(Event::new("order.created".into(), b"data2".to_vec())).unwrap();
        sender.send(Event::new("user.updated".into(), b"data3".to_vec())).unwrap();

        // Should receive user events
        let event1 = stream.next().await.unwrap();
        assert_eq!(event1.topic, "user.created");

        let event2 = stream.next().await.unwrap();
        assert_eq!(event2.topic, "user.updated");

        // Order event should be filtered out
    }

    #[test]
    fn test_circuit_breaker() {
        let breaker = CircuitBreaker::new(3, 1000);

        // Initially closed
        assert!(breaker.is_closed());
        assert_eq!(breaker.state_string(), "closed");

        // Record failures
        breaker.record_failure();
        breaker.record_failure();
        assert!(breaker.is_closed()); // Still closed

        breaker.record_failure();
        assert!(!breaker.is_closed()); // Now open
        assert_eq!(breaker.state_string(), "open");

        // Record success
        breaker.record_success();
        assert!(breaker.is_closed()); // Back to closed
        assert_eq!(breaker.state_string(), "closed");
    }
}
