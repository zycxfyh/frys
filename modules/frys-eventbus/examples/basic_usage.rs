//! Basic EventBus usage example

use frys_eventbus::*;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("🚀 Frys EventBus Basic Usage Example");

    // Create EventBus configuration
    let config = EventBusConfig {
        queue_size: 1024,
        max_subscribers: 100,
        enable_filtering: true,
        enable_priority: true,
        enable_monitoring: true,
        enable_backpressure: true,
        backpressure_threshold: 80,
        ..Default::default()
    };

    println!("📋 Initializing EventBus with config:");
    println!("   Queue size: {}", config.queue_size);
    println!("   Max subscribers: {}", config.max_subscribers);
    println!("   Filtering enabled: {}", config.enable_filtering);
    println!("   Priority enabled: {}", config.enable_priority);

    // Initialize EventBus
    let mut eventbus = EventBus::new(config).await?;
    println!("✅ EventBus initialized successfully");

    // Subscribe to user events
    println!("\n👤 Creating subscriber for user events...");
    let user_subscriber = eventbus.subscribe("user.*", Filter::default()).await?;
    println!("✅ Subscribed to topic: user.*");

    // Subscribe to order events
    println!("📦 Creating subscriber for order events...");
    let order_subscriber = eventbus.subscribe("order.created", Filter::default()).await?;
    println!("✅ Subscribed to topic: order.created");

    // Create publisher
    println!("\n📤 Creating publisher...");
    let publisher = eventbus.create_publisher(Some("example_publisher")).await?;
    println!("✅ Publisher created");

    // Publish some events
    println!("\n📨 Publishing events...");

    // User created event
    let user_event = Event::new("user.created".into(), b"{\"user_id\": 123, \"name\": \"Alice\"}".to_vec())
        .with_priority(Priority::Normal)
        .with_header("content-type".into(), "application/json".into())
        .with_id(1001);

    println!("📤 Publishing user.created event");
    publisher.publish(user_event).await?;

    // User updated event
    let update_event = Event::new("user.updated".into(), b"{\"user_id\": 123, \"email\": \"alice@example.com\"}".to_vec())
        .with_priority(Priority::Low)
        .with_id(1002);

    println!("📤 Publishing user.updated event");
    publisher.publish(update_event).await?;

    // Order created event
    let order_event = Event::new("order.created".into(), b"{\"order_id\": 456, \"amount\": 99.99}".to_vec())
        .with_priority(Priority::High)
        .with_id(1003);

    println!("📤 Publishing order.created event");
    publisher.publish(order_event).await?;

    // Product event (should not match any subscribers)
    let product_event = Event::new("product.added".into(), b"{\"product_id\": 789}".to_vec())
        .with_id(1004);

    println!("📤 Publishing product.added event (no subscribers)");
    publisher.publish(product_event).await?;

    // Check metrics
    println!("\n📊 EventBus Metrics:");
    let metrics = eventbus.metrics().snapshot();
    println!("   Events published: {}", metrics.events_published);
    println!("   Events delivered: {}", metrics.events_delivered);
    println!("   Events dropped: {}", metrics.events_dropped);
    println!("   Active subscribers: {}", metrics.active_subscribers);
    println!("   Delivery rate: {:.1}%", metrics.delivery_rate * 100.0);

    // Health check
    println!("\n🏥 Health Check:");
    match eventbus.health_check().await {
        Ok(_) => println!("   ✅ System is healthy"),
        Err(e) => println!("   ❌ Health check failed: {:?}", e),
    }

    // Demonstrate queue operations
    println!("\n🔄 Demonstrating queue operations...");
    let queue = SegmentedQueue::<i32>::new(10, 4);

    for i in 0..5 {
        queue.push(i).unwrap();
        println!("   Pushed: {}", i);
    }

    while let Some(item) = queue.pop() {
        println!("   Popped: {}", item);
    }

    // Demonstrate priority queue
    println!("\n⭐ Demonstrating priority queue...");
    let priority_queue = PriorityQueue::<&str>::new(3, 10, 4);

    priority_queue.push("Low priority task", 0).unwrap();
    priority_queue.push("High priority task", 2).unwrap();
    priority_queue.push("Normal priority task", 1).unwrap();

    while let Some(item) = priority_queue.pop() {
        println!("   Processed: {}", item);
    }

    // Shutdown
    println!("\n🛑 Shutting down EventBus...");
    eventbus.shutdown().await?;
    println!("✅ EventBus shutdown complete");

    println!("\n🎉 Example completed successfully!");
    println!("   - Demonstrated pub/sub pattern");
    println!("   - Showed event routing and filtering");
    println!("   - Tested queue operations");
    println!("   - Verified metrics and health checks");

    Ok(())
}
