//! Advanced EventBus usage example with filtering and async processing

use frys_eventbus::*;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("🚀 Frys EventBus Advanced Usage Example");

    // Create advanced configuration
    let config = EventBusConfig {
        queue_size: 2048,
        max_subscribers: 200,
        enable_filtering: true,
        enable_priority: true,
        enable_monitoring: true,
        enable_backpressure: true,
        backpressure_threshold: 75,
        worker_threads: 2,
        ..Default::default()
    };

    let mut eventbus = EventBus::new(config).await?;
    println!("✅ EventBus initialized with advanced configuration");

    // Demonstrate advanced filtering
    println!("\n🔍 Advanced Filtering Examples");

    // Create filter for high-priority user events with JSON content
    let user_filter = AdvancedFilter::new()
        .with_header_filter("content-type".into(), FilterExpression::Equal("application/json".into()))
        .with_priority(Priority::High);

    let filtered_subscriber = eventbus.subscribe("user.*", user_filter).await?;
    println!("✅ Created filtered subscriber for high-priority JSON user events");

    // Create subscriber with time range filter
    let time_filter = AdvancedFilter::new()
        .with_time_range(TimeRange::new(1000, 2000));

    let time_subscriber = eventbus.subscribe("order.*", time_filter).await?;
    println!("✅ Created time-range filtered subscriber");

    // Create publisher
    let publisher = eventbus.create_publisher(Some("advanced_publisher")).await?;

    // Publish various events to test filtering
    println!("\n📨 Publishing test events for filtering...");

    // This should match filtered subscriber (high priority + JSON)
    let matching_event = Event::new("user.created".into(), b"{\"user_id\": 123}".to_vec())
        .with_priority(Priority::High)
        .with_header("content-type".into(), "application/json".into())
        .with_id(2001);

    publisher.publish(matching_event).await?;
    println!("✅ Published matching event");

    // This should NOT match (wrong priority)
    let non_matching_event1 = Event::new("user.updated".into(), b"{\"user_id\": 123}".to_vec())
        .with_priority(Priority::Low)
        .with_header("content-type".into(), "application/json".into())
        .with_id(2002);

    publisher.publish(non_matching_event1).await?;
    println!("✅ Published non-matching event (wrong priority)");

    // This should NOT match (wrong content type)
    let non_matching_event2 = Event::new("user.deleted".into(), b"user deleted".to_vec())
        .with_priority(Priority::High)
        .with_header("content-type".into(), "text/plain".into())
        .with_id(2003);

    publisher.publish(non_matching_event2).await?;
    println!("✅ Published non-matching event (wrong content type)");

    // Demonstrate async processing with backpressure
    println!("\n⚡ Async Processing with Backpressure");

    let async_processor = AsyncEventProcessor::new(2, 100); // 2 workers, small queue for demo
    async_processor.start();
    println!("✅ Started async event processor");

    // Submit events asynchronously
    for i in 0..5 {
        let event = Event::new(
            format!("async.event.{}", i),
            format!("async payload {}", i).into_bytes()
        );
        async_processor.submit_event(event).await?;
        println!("   Submitted async event {}", i);
    }

    // Check backpressure status
    if async_processor.backpressure_active() {
        println!("⚠️  Backpressure is active - queue is filling up");
    } else {
        println!("✅ No backpressure - processing normally");
    }

    // Demonstrate circuit breaker
    println!("\n🔌 Circuit Breaker Pattern");

    let mut circuit_breaker = CircuitBreaker::new(3, 5000); // 3 failures, 5 second recovery

    // Simulate successful operations
    for i in 0..3 {
        circuit_breaker.record_success();
        println!("   ✅ Recorded success {}", i);
    }

    // Simulate failures
    for i in 0..3 {
        circuit_breaker.record_failure();
        println!("   ❌ Recorded failure {}", i);
    }

    println!("   Circuit breaker state: {}", circuit_breaker.state_string());

    if !circuit_breaker.is_closed() {
        println!("   🔒 Circuit breaker is OPEN - would reject requests");
    }

    // Demonstrate batch processing
    println!("\n📦 Batch Processing");

    let mut batch_processor = EventBatchProcessor::new(3, |events: alloc::vec::Vec<Event>| {
        println!("   📦 Processing batch of {} events", events.len());
        for event in events {
            println!("      - {}", String::from_utf8_lossy(&event.payload));
        }
    });

    for i in 0..7 {
        let event = Event::new(
            "batch.test".into(),
            format!("batch item {}", i).into_bytes()
        );
        batch_processor.add_event(event);
    }

    // Force flush remaining items
    batch_processor.flush();
    println!("✅ Batch processing completed");

    // Demonstrate routing table
    println!("\n🛣️  Advanced Routing");

    let mut routing_table = RoutingTable::new();

    // Add exact routes
    routing_table.add_exact_route("sensor.temperature".into(), 1).unwrap();
    routing_table.add_exact_route("sensor.humidity".into(), 2).unwrap();

    // Add pattern routes
    routing_table.add_pattern_route("sensor.*", 3).unwrap();
    routing_table.add_pattern_route("alert.#", 4).unwrap();

    // Test routing
    let temp_event = Event::new("sensor.temperature".into(), b"25.5".to_vec());
    let temp_subscribers = routing_table.find_subscribers(&temp_event);
    println!("   Temperature event routes to subscribers: {:?}", temp_subscribers);

    let alert_event = Event::new("alert.system.critical".into(), b"System overload".to_vec());
    let alert_subscribers = routing_table.find_subscribers(&alert_event);
    println!("   Alert event routes to subscribers: {:?}", alert_subscribers);

    let unknown_event = Event::new("unknown.topic".into(), b"test".to_vec());
    let unknown_subscribers = routing_table.find_subscribers(&unknown_event);
    println!("   Unknown event routes to subscribers: {:?}", unknown_subscribers);

    // Final metrics and cleanup
    println!("\n📊 Final Metrics");
    let metrics = eventbus.metrics().snapshot();
    println!("   Total events: {}", metrics.events_published);
    println!("   Delivery rate: {:.1}%", metrics.delivery_rate * 100.0);
    println!("   Error rate: {:.1}%", metrics.error_rate * 100.0);

    // Cleanup
    async_processor.stop().await;
    eventbus.shutdown().await?;

    println!("\n🎉 Advanced example completed!");
    println!("   ✅ Advanced filtering demonstrated");
    println!("   ✅ Async processing with backpressure");
    println!("   ✅ Circuit breaker pattern");
    println!("   ✅ Batch processing");
    println!("   ✅ Advanced routing");

    Ok(())
}
