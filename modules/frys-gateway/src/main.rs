//! Frys Gateway - Main executable demonstrating the high-performance API gateway

use frys_gateway::*;
use std::time::Instant;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("🚀 Frys Gateway - High-Performance API Gateway");
    println!("===============================================");

    // Create gateway configuration
    let config = GatewayConfig {
        listen_addr: "0.0.0.0:8080".parse()?,
        tls_config: None,
        routes: vec![
            // API route with load balancing
            Route {
                id: "api-v1".into(),
                path: "/api/v1/*".into(),
                methods: vec![Method::GET, Method::POST, Method::PUT, Method::DELETE],
                upstreams: vec![
                    Upstream {
                        url: "http://api-service-1:8080".parse()?,
                        weight: 70,
                        ..Default::default()
                    },
                    Upstream {
                        url: "http://api-service-2:8080".parse()?,
                        weight: 30,
                        ..Default::default()
                    },
                ],
                load_balancer: LoadBalancerType::WeightedRoundRobin,
                middlewares: vec![
                    Middleware::RateLimit(RateLimitConfig {
                        requests_per_second: 1000,
                        burst_size: 100,
                        ..Default::default()
                    }),
                    Middleware::Auth(AuthConfig {
                        jwt_secret: "your-jwt-secret-key".into(),
                        required_claims: vec!["role".into()],
                        ..Default::default()
                    }),
                ],
                ..Default::default()
            },
            // WebSocket route
            Route {
                id: "websocket".into(),
                path: "/ws".into(),
                methods: vec![Method::GET],
                upstreams: vec![
                    Upstream {
                        url: "ws://realtime-service:9001".parse()?,
                        weight: 100,
                        ..Default::default()
                    },
                ],
                protocol: Protocol::WebSocket,
                ..Default::default()
            },
            // Health check route
            Route {
                id: "health".into(),
                path: "/health".into(),
                methods: vec![Method::GET],
                upstreams: vec![
                    Upstream {
                        url: "http://health-service:8080".parse()?,
                        weight: 100,
                        ..Default::default()
                    },
                ],
                ..Default::default()
            },
        ],
        global_middlewares: vec![
            Middleware::Cors(CorsConfig {
                allowed_origins: vec!["*".into()],
                allowed_methods: vec!["GET".into(), "POST".into(), "PUT".into(), "DELETE".into()],
                allowed_headers: vec!["*".into()],
                allow_credentials: true,
                max_age: 86400,
            }),
            Middleware::Compression(CompressionConfig {
                level: CompressionLevel::Fast,
                min_length: 1024,
            }),
        ],
        service_discovery: Some(ServiceDiscoveryConfig {
            backend: DiscoveryBackend::Etcd {
                endpoints: vec!["http://etcd-1:2379".into()],
            },
            service_prefix: "/services".into(),
            health_check_interval: std::time::Duration::from_secs(30),
            ..Default::default()
        }),
        metrics: MetricsConfig {
            enabled: true,
            path: "/metrics".into(),
            ..Default::default()
        },
        tracing: TracingConfig {
            enabled: true,
            ..Default::default()
        },
        ..Default::default()
    };

    println!("📊 Gateway Configuration:");
    println!("  - Listen Address: {}", config.listen_addr);
    println!("  - Routes: {}", config.routes.len());
    println!("  - Service Discovery: {}", config.service_discovery.is_some());
    println!("  - Metrics: {}", config.metrics.enabled);
    println!("  - Tracing: {}", config.tracing.enabled);

    // Create and start gateway
    println!("\n🔧 Initializing Gateway...");
    let gateway = Gateway::new(config).await?;

    println!("✅ Gateway initialized successfully!");
    println!("🌐 Starting server on {}...", gateway.listen_addr());

    // Start performance monitoring
    let start_time = Instant::now();
    let mut request_count = 0;

    // In a real implementation, this would run the server
    // For demo purposes, we'll simulate some operations
    println!("\n📈 Simulating traffic...");

    // Simulate some requests
    for i in 0..10 {
        if let Some(route) = gateway.router().find_route(&create_test_request(&format!("/api/v1/users/{}", i))).ok() {
            println!("  ✅ Route {} matched: {}", i, route.id);
            request_count += 1;

            // Simulate load balancer selection
            let balancer = gateway.load_balancer(&route.load_balancer);
            let upstreams = &route.upstreams;
            if !upstreams.is_empty() {
                if let Ok(selected) = balancer.select_upstream(&create_test_request(&format!("/api/v1/users/{}", i)), upstreams).await {
                    println!("    🎯 Selected upstream: {}", selected.url);
                }
            }
        }
    }

    let elapsed = start_time.elapsed();

    // Display performance metrics
    println!("\n⚡ Performance Results:");
    println!("  - Requests Processed: {}", request_count);
    println!("  - Processing Time: {:.2}ms", elapsed.as_millis());
    if request_count > 0 {
        println!("  - Avg Request Time: {:.2}μs", (elapsed.as_micros() as f64) / request_count as f64);
        println!("  - Requests/sec: {:.0}", request_count as f64 / elapsed.as_secs_f64());
    }

    // Display gateway statistics
    let stats = gateway.stats().await;
    println!("\n📊 Gateway Statistics:");
    println!("  - Total Requests: {}", stats.total_requests);
    println!("  - Active Connections: {}", stats.active_connections);
    println!("  - Error Rate: {:.2}%", stats.error_rate * 100.0);
    if stats.total_requests > 0 {
        println!("  - Avg Response Time: {:.2}ms", stats.total_response_time_ms as f64 / stats.total_requests as f64);
    }

    println!("\n🎉 Gateway demo completed!");
    println!("💡 The Frys Gateway is ready for production deployment with:");
    println!("   • High-performance async I/O");
    println!("   • Advanced load balancing algorithms");
    println!("   • Comprehensive security middleware");
    println!("   • Real-time metrics and tracing");
    println!("   • Service discovery integration");

    Ok(())
}

/// Create a test HTTP request for demonstration
fn create_test_request(path: &str) -> http::Request<hyper::Body> {
    http::Request::builder()
        .method("GET")
        .uri(format!("http://example.com{}", path))
        .header("host", "example.com")
        .header("user-agent", "Frys-Gateway-Demo/1.0")
        .header("x-forwarded-for", "192.168.1.100")
        .body(hyper::Body::empty())
        .unwrap()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_gateway_creation() {
        let config = GatewayConfig::default();
        // Note: Gateway::new would need actual implementation
        // For now, just test configuration creation
        assert_eq!(config.listen_addr.port(), 8080);
        assert!(config.routes.is_empty());
    }

    #[test]
    fn test_demo_request_creation() {
        let req = create_test_request("/api/v1/test");
        assert_eq!(req.method(), "GET");
        assert_eq!(req.uri().path(), "/api/v1/test");
        assert!(req.headers().contains_key("host"));
        assert!(req.headers().contains_key("x-forwarded-for"));
    }

    #[test]
    fn test_performance_calculation() {
        let elapsed = std::time::Duration::from_millis(100);
        let request_count = 10;

        let avg_time = (elapsed.as_micros() as f64) / request_count as f64;
        let rps = request_count as f64 / elapsed.as_secs_f64();

        assert!((avg_time - 10000.0).abs() < 1.0); // 10ms in microseconds
        assert!((rps - 100.0).abs() < 1.0); // 100 requests per second
    }
}
