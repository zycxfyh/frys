//! Performance benchmarks for Frys EventBus

use criterion::{black_box, criterion_group, criterion_main, Criterion};
use frys_eventbus::*;
use std::sync::Arc;
use tokio::runtime::Runtime;

fn bench_segmented_queue(c: &mut Criterion) {
    let mut group = c.benchmark_group("segmented_queue");

    group.bench_function("push_pop_sequential", |b| {
        let queue = SegmentedQueue::<i32>::new(1000, 64);
        let mut counter = 0;

        b.iter(|| {
            // Push operation
            black_box(queue.push(counter).unwrap());
            counter += 1;

            // Pop operation
            let _ = black_box(queue.pop());
        });
    });

    group.bench_function("push_only", |b| {
        let queue = SegmentedQueue::<i32>::new(10000, 64);

        b.iter(|| {
            let _ = black_box(queue.push(black_box(42)));
        });
    });

    group.bench_function("pop_only", |b| {
        let queue = SegmentedQueue::<i32>::new(10000, 64);

        // Pre-fill queue
        for i in 0..10000 {
            queue.push(i).unwrap();
        }

        b.iter(|| {
            let _ = black_box(queue.pop());
        });
    });

    group.finish();
}

fn bench_priority_queue(c: &mut Criterion) {
    let mut group = c.benchmark_group("priority_queue");

    group.bench_function("push_pop_priority", |b| {
        let queue = PriorityQueue::<i32>::new(3, 1000, 64);

        b.iter(|| {
            // Push with different priorities
            black_box(queue.push(1, 2).unwrap()); // High priority
            black_box(queue.push(2, 1).unwrap()); // Medium priority
            black_box(queue.push(3, 0).unwrap()); // Low priority

            // Pop (should get high priority first)
            let _ = black_box(queue.pop());
        });
    });

    group.finish();
}

fn bench_event_creation(c: &mut Criterion) {
    let mut group = c.benchmark_group("event_creation");

    group.bench_function("create_simple_event", |b| {
        b.iter(|| {
            let event = Event::new(
                black_box("test.topic".to_string()),
                black_box(vec![1, 2, 3, 4, 5])
            );
            black_box(event);
        });
    });

    group.bench_function("create_complex_event", |b| {
        b.iter(|| {
            let event = Event::new(
                black_box("user.profile.updated".to_string()),
                black_box(b"{\"user_id\":123,\"action\":\"update\"}".to_vec())
            )
            .with_priority(Priority::High)
            .with_header("content-type".to_string(), "application/json".to_string())
            .with_id(12345);

            black_box(event);
        });
    });

    group.finish();
}

fn bench_topic_matching(c: &mut Criterion) {
    let mut group = c.benchmark_group("topic_matching");

    let event = Event::new("user.account.created".to_string(), vec![]);

    group.bench_function("exact_match", |b| {
        b.iter(|| {
            black_box(event.matches_topic("user.account.created"))
        });
    });

    group.bench_function("wildcard_match", |b| {
        b.iter(|| {
            black_box(event.matches_topic("user.*.created"))
        });
    });

    group.bench_function("multi_wildcard_match", |b| {
        b.iter(|| {
            black_box(event.matches_topic("user.#"))
        });
    });

    group.finish();
}

fn bench_routing_table(c: &mut Criterion) {
    let mut group = c.benchmark_group("routing_table");

    let mut table = RoutingTable::new();

    // Setup: Add various routes
    table.add_exact_route("user.created".to_string(), 1).unwrap();
    table.add_exact_route("user.updated".to_string(), 2).unwrap();
    table.add_pattern_route("order.*", 3).unwrap();
    table.add_pattern_route("product.#", 4).unwrap();

    group.bench_function("find_exact_route", |b| {
        let event = Event::new("user.created".to_string(), vec![]);
        b.iter(|| {
            black_box(table.find_subscribers(&event));
        });
    });

    group.bench_function("find_pattern_route", |b| {
        let event = Event::new("order.placed".to_string(), vec![]);
        b.iter(|| {
            black_box(table.find_subscribers(&event));
        });
    });

    group.bench_function("find_no_route", |b| {
        let event = Event::new("unknown.topic".to_string(), vec![]);
        b.iter(|| {
            black_box(table.find_subscribers(&event));
        });
    });

    group.finish();
}

fn bench_async_processing(c: &mut Criterion) {
    let mut group = c.benchmark_group("async_processing");
    let rt = Runtime::new().unwrap();

    group.bench_function("async_event_processor", |b| {
        rt.block_on(async {
            let processor = AsyncEventProcessor::new(1, 1000);
            processor.start();

            b.iter(|| {
                let event = Event::new("test.topic".to_string(), vec![1, 2, 3]);
                black_box(processor.submit_event(event).await.unwrap());
            });

            processor.stop().await;
        });
    });

    group.finish();
}

async fn bench_eventbus_pubsub() -> Result<(), Box<dyn std::error::Error>> {
    let config = EventBusConfig {
        queue_size: 10000,
        max_subscribers: 1000,
        enable_filtering: false, // Disable for benchmark
        enable_priority: false,
        enable_monitoring: false,
        ..Default::default()
    };

    let mut eventbus = EventBus::new(config).await?;

    // Create multiple subscribers
    let mut subscribers = Vec::new();
    for i in 0..10 {
        let topic = format!("topic{}", i);
        let subscriber = eventbus.subscribe(&topic, Filter::default()).await?;
        subscribers.push(subscriber);
    }

    let publisher = eventbus.create_publisher(Some("benchmark")).await?;

    // Benchmark: Publish events
    for i in 0..1000 {
        let topic = format!("topic{}", i % 10);
        let event = Event::new(topic, vec![i as u8; 100]); // 100 bytes payload
        publisher.publish(event).await?;
    }

    Ok(())
}

fn bench_eventbus_throughput(c: &mut Criterion) {
    let mut group = c.benchmark_group("eventbus_throughput");
    let rt = Runtime::new().unwrap();

    group.bench_function("pubsub_throughput", |b| {
        b.iter(|| {
            black_box(rt.block_on(bench_eventbus_pubsub()).unwrap());
        });
    });

    group.finish();
}

fn bench_memory_usage(c: &mut Criterion) {
    let mut group = c.benchmark_group("memory_usage");

    group.bench_function("queue_memory_per_element", |b| {
        let queue = SegmentedQueue::<Event>::new(10000, 64);

        // Measure memory usage with increasing elements
        for i in 0..1000 {
            let event = Event::new(format!("topic{}", i), vec![0u8; 100]);
            queue.push(event).unwrap();
        }

        black_box(queue);
    });

    group.bench_function("eventbus_memory_overhead", |b| {
        let rt = Runtime::new().unwrap();
        let eventbus = rt.block_on(async {
            EventBus::new(EventBusConfig::default()).await.unwrap()
        });

        black_box(eventbus);
    });

    group.finish();
}

fn bench_concurrent_operations(c: &mut Criterion) {
    let mut group = c.benchmark_group("concurrent_operations");

    group.bench_function("concurrent_queue_operations", |b| {
        let queue = Arc::new(SegmentedQueue::<i32>::new(10000, 64));

        b.iter(|| {
            let queue_clone = Arc::clone(&queue);
            black_box(std::thread::spawn(move || {
                for i in 0..100 {
                    let _ = queue_clone.push(i);
                    let _ = queue_clone.pop();
                }
            }).join());
        });
    });

    group.finish();
}

criterion_group! {
    name = benches;
    config = Criterion::default()
        .sample_size(100)
        .measurement_time(std::time::Duration::from_secs(10));
    targets =
        bench_segmented_queue,
        bench_priority_queue,
        bench_event_creation,
        bench_topic_matching,
        bench_routing_table,
        bench_async_processing,
        bench_eventbus_throughput,
        bench_memory_usage,
        bench_concurrent_operations,
}

criterion_main!(benches);
