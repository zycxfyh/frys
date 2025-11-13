//! # Frys Gateway
//!
//! Frys Gateway is a high-performance, enterprise-grade API gateway designed for microservices
//! architectures with advanced routing, load balancing, security, and observability features.
//!
//! ## Features
//!
//! - **High Performance**: Asynchronous I/O with zero-copy operations and connection pooling
//! - **Advanced Routing**: Path-based, header-based, and content-based routing with regex support
//! - **Load Balancing**: Multiple algorithms (Round-robin, Least-loaded, IP-hash, Weighted)
//! - **Security**: TLS 1.3, JWT authentication, rate limiting, and circuit breakers
//! - **Service Discovery**: Dynamic service registration and health checking
//! - **Observability**: Comprehensive metrics, distributed tracing, and logging
//! - **Traffic Management**: Request/response transformation, compression, and caching
//! - **WebSocket Support**: Full-duplex communication proxying
//! - **API Composition**: GraphQL and REST API aggregation
//! - **Fault Tolerance**: Retry policies, timeouts, and graceful degradation
//!
//! ## Example
//!
//! ```rust,no_run
//! use frys_gateway::*;
//!
//! #[tokio::main]
//! async fn main() -> Result<(), Box<dyn std::error::Error>> {
//!     // Create gateway configuration
//!     let config = GatewayConfig {
//!         listen_addr: "0.0.0.0:8080".parse()?,
//!         tls_config: Some(TlsConfig {
//!             cert_path: "./certs/server.crt".into(),
//!             key_path: "./certs/server.key".into(),
//!             client_ca_path: Some("./certs/ca.crt".into()),
//!         }),
//!         routes: vec![
//!             Route {
//!                 id: "api-v1".into(),
//!                 path: "/api/v1/*".into(),
//!                 methods: vec![Method::GET, Method::POST],
//!                 upstreams: vec![
//!                     Upstream {
//!                         url: "http://service-a:8081".parse()?,
//!                         weight: 70,
//!                     },
//!                     Upstream {
//!                         url: "http://service-b:8082".parse()?,
//!                         weight: 30,
//!                     },
//!                 ],
//!                 load_balancer: LoadBalancerType::WeightedRoundRobin,
//!                 middlewares: vec![
//!                     Middleware::RateLimit(RateLimitConfig {
//!                         requests_per_second: 100,
//!                         burst_size: 20,
//!                     }),
//!                     Middleware::Auth(AuthConfig {
//!                         jwt_secret: "your-secret-key".into(),
//!                         required_claims: vec!["role".into()],
//!                     }),
//!                 ],
//!                 ..Default::default()
//!             },
//!             Route {
//!                 id: "websocket".into(),
//!                 path: "/ws".into(),
//!                 methods: vec![Method::GET],
//!                 upstreams: vec![
//!                     Upstream {
//!                         url: "ws://realtime-service:9001".parse()?,
//!                         weight: 100,
//!                     },
//!                 ],
//!                 protocol: Protocol::WebSocket,
//!                 ..Default::default()
//!             },
//!         ],
//!         service_discovery: Some(ServiceDiscoveryConfig {
//!             etcd_endpoints: vec!["http://etcd-1:2379".into()],
//!             service_prefix: "/services".into(),
//!             health_check_interval: Duration::from_secs(30),
//!         }),
//!         metrics_enabled: true,
//!         tracing_enabled: true,
//!     };
//!
//!     // Create and start gateway
//!     let gateway = Gateway::new(config).await?;
//!     gateway.start().await?;
//!
//!     Ok(())
//! }
//! ```
//!
//! ## Advanced Routing
//!
//! ### Path-Based Routing
//!
//! ```rust,no_run
//! let route = Route {
//!     path: "/api/v{version}/users/{id}".into(),
//!     path_params: vec![
//!         PathParam {
//!             name: "version".into(),
//!             pattern: r"^\d+$".into(),
//!         },
//!         PathParam {
//!             name: "id".into(),
//!             pattern: r"^[a-f0-9-]+$".into(),
//!         },
//!     ],
//!     ..Default::default()
//! };
//! ```
//!
//! ### Header-Based Routing
//!
//! ```rust,no_run
//! let route = Route {
//!     conditions: vec![
//!         RouteCondition::Header {
//!             name: "X-Service-Version".into(),
//!             value: "v2".into(),
//!             operator: ConditionOperator::Equal,
//!         },
//!         RouteCondition::Header {
//!             name: "Authorization".into(),
//!             value: r"^Bearer .+$".into(),
//!             operator: ConditionOperator::Regex,
//!         },
//!     ],
//!     ..Default::default()
//! };
//! ```
//!
//! ### Content-Based Routing
//!
//! ```rust,no_run
//! let route = Route {
//!     conditions: vec![
//!         RouteCondition::Body {
//!             path: "$.type".into(),
//!             value: "premium_request".into(),
//!             operator: ConditionOperator::Equal,
//!         },
//!     ],
//!     ..Default::default()
//! };
//! ```
//!
//! ## Load Balancing Strategies
//!
//! ### Round Robin
//! Distributes requests sequentially across all available upstreams.
//!
//! ### Least Loaded
//! Routes to the upstream with the lowest current load.
//!
//! ### IP Hash
//! Consistent hashing based on client IP address.
//!
//! ### Weighted Round Robin
//! Distributes requests based on configured weights.
//!
//! ### Custom Strategy
//!
//! ```rust,no_run
//! impl LoadBalancer for CustomBalancer {
//!     async fn select_upstream(&self, req: &Request, upstreams: &[Upstream]) -> Result<&Upstream> {
//!         // Custom selection logic
//!         Ok(&upstreams[0])
//!     }
//! }
//! ```
//!
//! ## Security Features
//!
//! ### Authentication & Authorization
//!
//! ```rust,no_run
//! let auth_middleware = Middleware::Auth(AuthConfig {
//!     jwt_secret: env::var("JWT_SECRET")?,
//!     required_scopes: vec!["read:users".into(), "write:users".into()],
//!     role_mapping: HashMap::from([
//!         ("admin".into(), vec!["read:*".into(), "write:*".into()]),
//!         ("user".into(), vec!["read:users".into()]),
//!     ]),
//!     oidc_config: Some(OIDCConfig {
//!         issuer: "https://auth.example.com".into(),
//!         client_id: "gateway".into(),
//!         client_secret: env::var("OIDC_CLIENT_SECRET")?,
//!     }),
//! });
//! ```
//!
//! ### Rate Limiting
//!
//! ```rust,no_run
//! let rate_limit = Middleware::RateLimit(RateLimitConfig {
//!     requests_per_second: 1000,
//!     burst_size: 100,
//!     key_strategy: RateLimitKey::IP,
//!     distributed: true,
//!     redis_url: Some(env::var("REDIS_URL")?),
//! });
//! ```
//!
//! ### Circuit Breaker
//!
//! ```rust,no_run
//! let circuit_breaker = Middleware::CircuitBreaker(CircuitBreakerConfig {
//!     failure_threshold: 5,
//!     recovery_timeout: Duration::from_secs(60),
//!     success_threshold: 3,
//!     monitoring_window: Duration::from_secs(10),
//! });
//! ```
//!
//! ## Service Discovery
//!
//! ### Dynamic Service Registration
//!
//! ```rust,no_run
//! let discovery = ServiceDiscovery::etcd(EtcdConfig {
//!     endpoints: vec!["http://etcd-1:2379".into(), "http://etcd-2:2379".into()],
//!     prefix: "/services".into(),
//!     ttl: Duration::from_secs(30),
//! }).await?;
//!
//! // Services automatically register/deregister
//! discovery.register_service("user-service", "http://user-service:8080").await?;
//! ```
//!
//! ### Health Checking
//!
//! ```rust,no_run
//! let health_checker = HealthChecker::new(HealthCheckConfig {
//!     interval: Duration::from_secs(10),
//!     timeout: Duration::from_secs(5),
//!     unhealthy_threshold: 3,
//!     healthy_threshold: 2,
//!     checks: vec![
//!         HealthCheck::Http {
//!             path: "/health".into(),
//!             expected_status: 200,
//!             expected_body: Some(r#"{"status":"ok"}"#.into()),
//!         },
//!         HealthCheck::Tcp {
//!             port: 8080,
//!         },
//!     ],
//! });
//! ```
//!
//! ## Observability
//!
//! ### Metrics
//!
//! ```rust,no_run
//! let metrics = gateway.metrics().await?;
//! println!("Requests per second: {}", metrics.requests_per_second);
//! println!("Error rate: {:.2}%", metrics.error_rate * 100.0);
//! println!("P95 latency: {}ms", metrics.p95_latency_ms);
//!
//! // Prometheus format
//! let prometheus_metrics = metrics.to_prometheus()?;
//! ```
//!
//! ### Distributed Tracing
//!
//! ```rust,no_run
//! let tracer = Tracer::jaeger(JaegerConfig {
//!     endpoint: "http://jaeger:14268/api/traces".into(),
//!     service_name: "frys-gateway".into(),
//!     tags: HashMap::from([
//!         ("version".into(), env!("CARGO_PKG_VERSION").into()),
//!     ]),
//! }).await?;
//!
//! // Traces automatically include:
//! // - Request/response headers
//! // - Upstream selection
//! // - Middleware execution
//! // - Error details
//! ```
//!
//! ## Performance Goals
//!
//! - **Throughput**: 100,000+ RPS on commodity hardware
//! - **Latency**: P99 < 10ms for simple routing, < 50ms for complex processing
//! - **Memory Usage**: < 100MB base memory, < 1GB under load
//! - **Connection Handling**: 10,000+ concurrent connections
//! - **Scalability**: Horizontal scaling to 100+ instances
//!
//! ## Architecture
//!
//! The Gateway consists of several high-performance components:
//!
//! 1. **Request Router**: Efficient routing with trie-based path matching
//! 2. **Load Balancer**: Pluggable load balancing algorithms
//! 3. **Middleware Pipeline**: Composable request/response processing
//! 4. **Connection Pool**: HTTP/2 connection multiplexing and pooling
//! 5. **Service Discovery**: Dynamic service registry and health checking
//! 6. **Metrics Collector**: High-performance metrics aggregation
//! 7. **Security Engine**: Authentication, authorization, and encryption
//! 8. **Cache Engine**: Response caching and cache invalidation
//!
//! ## Integration
//!
//! The Gateway integrates seamlessly with other Frys components:
//!
//! - **Vector Search**: API endpoints for similarity search
//! - **Workflow Engine**: Orchestration of complex API workflows
//! - **Agent System**: AI-powered API routing and optimization
//! - **Plugin System**: Extensible middleware and routing plugins
//! - **Event Bus**: Real-time API event streaming
//! - **Configuration System**: Dynamic configuration updates

#![cfg_attr(not(feature = "std"), no_std)]
#![warn(missing_docs)]
#![warn(rust_2018_idioms)]
#![warn(clippy::all)]
#![warn(clippy::pedantic)]

// Public API exports
pub mod core;
pub mod handlers;
pub mod middleware;
pub mod routing;
pub mod load_balancing;
pub mod security;

// Re-exports for convenience
pub use core::*;
pub use routing::*;
pub use load_balancing::*;
pub use middleware::*;

// Error types
mod error;
pub use error::*;

// Type aliases
#[cfg(feature = "std")]
pub type Result<T> = std::result::Result<T, GatewayError>;
#[cfg(not(feature = "std"))]
pub type Result<T> = core::result::Result<T, GatewayError>;

// Constants
pub const DEFAULT_GATEWAY_PORT: u16 = 8080;
pub const DEFAULT_MAX_CONNECTIONS: usize = 10_000;
pub const DEFAULT_REQUEST_TIMEOUT: u64 = 30; // seconds
pub const DEFAULT_MAX_REQUEST_SIZE: usize = 10 * 1024 * 1024; // 10MB
pub const DEFAULT_RATE_LIMIT_RPS: u32 = 1000;
pub const DEFAULT_CIRCUIT_BREAKER_THRESHOLD: u32 = 5;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_constants() {
        assert_eq!(DEFAULT_GATEWAY_PORT, 8080);
        assert_eq!(DEFAULT_MAX_CONNECTIONS, 10_000);
        assert_eq!(DEFAULT_REQUEST_TIMEOUT, 30);
        assert_eq!(DEFAULT_MAX_REQUEST_SIZE, 10 * 1024 * 1024);
        assert_eq!(DEFAULT_RATE_LIMIT_RPS, 1000);
        assert_eq!(DEFAULT_CIRCUIT_BREAKER_THRESHOLD, 5);
    }
}
