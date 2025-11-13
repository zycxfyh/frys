//! Core gateway types and structures

use crate::*;
use core::time::Duration;
use std::net::SocketAddr;

/// Gateway configuration
#[derive(Debug, Clone)]
pub struct GatewayConfig {
    /// Listen address for the gateway
    pub listen_addr: SocketAddr,
    /// TLS configuration
    pub tls_config: Option<TlsConfig>,
    /// Routes configuration
    pub routes: alloc::vec::Vec<Route>,
    /// Global middlewares applied to all routes
    pub global_middlewares: alloc::vec::Vec<Middleware>,
    /// Service discovery configuration
    pub service_discovery: Option<ServiceDiscoveryConfig>,
    /// Health check configuration
    pub health_check: HealthCheckConfig,
    /// Metrics configuration
    pub metrics: MetricsConfig,
    /// Tracing configuration
    pub tracing: TracingConfig,
    /// Connection limits
    pub connection_limits: ConnectionLimits,
    /// Request timeout
    pub request_timeout: Duration,
    /// Maximum request body size
    pub max_request_size: usize,
    /// Enable compression
    pub compression_enabled: bool,
    /// Circuit breaker configuration
    pub circuit_breaker: CircuitBreakerConfig,
}

impl Default for GatewayConfig {
    fn default() -> Self {
        Self {
            listen_addr: format!("0.0.0.0:{}", DEFAULT_GATEWAY_PORT).parse().unwrap(),
            tls_config: None,
            routes: alloc::vec::Vec::new(),
            global_middlewares: alloc::vec::Vec::new(),
            service_discovery: None,
            health_check: HealthCheckConfig::default(),
            metrics: MetricsConfig::default(),
            tracing: TracingConfig::default(),
            connection_limits: ConnectionLimits::default(),
            request_timeout: Duration::from_secs(DEFAULT_REQUEST_TIMEOUT),
            max_request_size: DEFAULT_MAX_REQUEST_SIZE,
            compression_enabled: true,
            circuit_breaker: CircuitBreakerConfig::default(),
        }
    }
}

/// TLS configuration
#[derive(Debug, Clone)]
pub struct TlsConfig {
    /// Server certificate path
    pub cert_path: alloc::string::String,
    /// Private key path
    pub key_path: alloc::string::String,
    /// Client CA certificate path for mutual TLS
    pub client_ca_path: Option<alloc::string::String>,
    /// TLS version minimum
    pub min_version: TlsVersion,
    /// Cipher suites
    pub cipher_suites: alloc::vec::Vec<alloc::string::String>,
    /// Enable session tickets
    pub session_tickets: bool,
}

impl Default for TlsConfig {
    fn default() -> Self {
        Self {
            cert_path: alloc::string::String::new(),
            key_path: alloc::string::String::new(),
            client_ca_path: None,
            min_version: TlsVersion::V12,
            cipher_suites: alloc::vec::Vec::new(),
            session_tickets: true,
        }
    }
}

/// TLS versions
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TlsVersion {
    /// TLS 1.2
    V12,
    /// TLS 1.3
    V13,
}

/// Route configuration
#[derive(Debug, Clone)]
pub struct Route {
    /// Unique route identifier
    pub id: alloc::string::String,
    /// Route path pattern (supports wildcards and parameters)
    pub path: alloc::string::String,
    /// HTTP methods to match
    pub methods: alloc::vec::Vec<Method>,
    /// Host header to match (optional)
    pub host: Option<alloc::string::String>,
    /// Upstream services
    pub upstreams: alloc::vec::Vec<Upstream>,
    /// Load balancer type
    pub load_balancer: LoadBalancerType,
    /// Route-specific middlewares
    pub middlewares: alloc::vec::Vec<Middleware>,
    /// Route conditions (additional matching criteria)
    pub conditions: alloc::vec::Vec<RouteCondition>,
    /// Path parameters extraction
    pub path_params: alloc::vec::Vec<PathParam>,
    /// Protocol type
    pub protocol: Protocol,
    /// Priority (higher values take precedence)
    pub priority: i32,
    /// Rate limiting configuration
    pub rate_limit: Option<RateLimitConfig>,
    /// Circuit breaker configuration
    pub circuit_breaker: Option<CircuitBreakerConfig>,
    /// Timeout configuration
    pub timeout: Option<Duration>,
    /// Retry configuration
    pub retry: Option<RetryConfig>,
}

impl Default for Route {
    fn default() -> Self {
        Self {
            id: alloc::string::String::new(),
            path: alloc::string::String::new(),
            methods: alloc::vec::Vec::new(),
            host: None,
            upstreams: alloc::vec::Vec::new(),
            load_balancer: LoadBalancerType::RoundRobin,
            middlewares: alloc::vec::Vec::new(),
            conditions: alloc::vec::Vec::new(),
            path_params: alloc::vec::Vec::new(),
            protocol: Protocol::HTTP,
            priority: 0,
            rate_limit: None,
            circuit_breaker: None,
            timeout: None,
            retry: None,
        }
    }
}

/// HTTP methods
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Method {
    /// GET method
    GET,
    /// POST method
    POST,
    /// PUT method
    PUT,
    /// DELETE method
    DELETE,
    /// PATCH method
    PATCH,
    /// HEAD method
    HEAD,
    /// OPTIONS method
    OPTIONS,
    /// CONNECT method
    CONNECT,
    /// TRACE method
    TRACE,
}

/// Upstream service configuration
#[derive(Debug, Clone)]
pub struct Upstream {
    /// Upstream URL
    pub url: url::Url,
    /// Weight for load balancing (only used by weighted algorithms)
    pub weight: u32,
    /// Maximum concurrent connections to this upstream
    pub max_connections: usize,
    /// Connection timeout
    pub connect_timeout: Duration,
    /// Request timeout
    pub request_timeout: Duration,
    /// Health check configuration
    pub health_check: Option<HealthCheckConfig>,
    /// Upstream metadata
    pub metadata: alloc::collections::BTreeMap<alloc::string::String, alloc::string::String>,
}

impl Default for Upstream {
    fn default() -> Self {
        Self {
            url: url::Url::parse("http://localhost:8080").unwrap(),
            weight: 1,
            max_connections: 100,
            connect_timeout: Duration::from_secs(5),
            request_timeout: Duration::from_secs(30),
            health_check: None,
            metadata: alloc::collections::BTreeMap::new(),
        }
    }
}

/// Load balancer types
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LoadBalancerType {
    /// Round robin distribution
    RoundRobin,
    /// Weighted round robin
    WeightedRoundRobin,
    /// Least loaded upstream
    LeastLoaded,
    /// IP hash for session stickiness
    IpHash,
    /// Random selection
    Random,
    /// Custom load balancer
    Custom,
}

/// Route conditions for advanced routing
#[derive(Debug, Clone)]
pub enum RouteCondition {
    /// Header condition
    Header {
        /// Header name
        name: alloc::string::String,
        /// Expected value
        value: alloc::string::String,
        /// Comparison operator
        operator: ConditionOperator,
    },
    /// Query parameter condition
    Query {
        /// Parameter name
        name: alloc::string::String,
        /// Expected value
        value: alloc::string::String,
        /// Comparison operator
        operator: ConditionOperator,
    },
    /// Body content condition (JSON path)
    Body {
        /// JSON path
        path: alloc::string::String,
        /// Expected value
        value: alloc::string::String,
        /// Comparison operator
        operator: ConditionOperator,
    },
    /// Custom condition
    Custom {
        /// Condition name
        name: alloc::string::String,
        /// Condition parameters
        params: alloc::collections::BTreeMap<alloc::string::String, alloc::string::String>,
    },
}

/// Condition operators
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConditionOperator {
    /// Exact equality
    Equal,
    /// Case-insensitive equality
    EqualIgnoreCase,
    /// Not equal
    NotEqual,
    /// Contains substring
    Contains,
    /// Starts with prefix
    StartsWith,
    /// Ends with suffix
    EndsWith,
    /// Regular expression match
    Regex,
    /// Greater than (numeric comparison)
    GreaterThan,
    /// Less than (numeric comparison)
    LessThan,
    /// In array/list
    In,
}

/// Path parameter extraction
#[derive(Debug, Clone)]
pub struct PathParam {
    /// Parameter name
    pub name: alloc::string::String,
    /// Validation regex pattern
    pub pattern: alloc::string::String,
}

/// Protocol types
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Protocol {
    /// HTTP/1.1
    HTTP,
    /// HTTP/2
    HTTP2,
    /// WebSocket
    WebSocket,
    /// gRPC
    GRPC,
}

/// Service discovery configuration
#[derive(Debug, Clone)]
pub struct ServiceDiscoveryConfig {
    /// Discovery backend type
    pub backend: DiscoveryBackend,
    /// Service registration prefix
    pub service_prefix: alloc::string::String,
    /// Health check interval
    pub health_check_interval: Duration,
    /// Service TTL
    pub service_ttl: Duration,
    /// Watch for changes
    pub watch_changes: bool,
}

/// Discovery backend types
#[derive(Debug, Clone)]
pub enum DiscoveryBackend {
    /// etcd backend
    Etcd {
        /// etcd endpoints
        endpoints: alloc::vec::Vec<alloc::string::String>,
    },
    /// Consul backend
    Consul {
        /// Consul endpoint
        endpoint: alloc::string::String,
    },
    /// ZooKeeper backend
    ZooKeeper {
        /// ZooKeeper servers
        servers: alloc::vec::Vec<alloc::string::String>,
    },
    /// Redis backend
    Redis {
        /// Redis URLs
        urls: alloc::vec::Vec<alloc::string::String>,
    },
    /// DNS-based discovery
    DNS {
        /// DNS server
        server: alloc::string::String,
    },
    /// Custom backend
    Custom {
        /// Custom configuration
        config: alloc::collections::BTreeMap<alloc::string::String, alloc::string::String>,
    },
}

/// Health check configuration
#[derive(Debug, Clone)]
pub struct HealthCheckConfig {
    /// Health check interval
    pub interval: Duration,
    /// Health check timeout
    pub timeout: Duration,
    /// Unhealthy threshold
    pub unhealthy_threshold: u32,
    /// Healthy threshold
    pub healthy_threshold: u32,
    /// Health check type
    pub check_type: HealthCheckType,
    /// Initial delay before first check
    pub initial_delay: Duration,
}

impl Default for HealthCheckConfig {
    fn default() -> Self {
        Self {
            interval: Duration::from_secs(30),
            timeout: Duration::from_secs(5),
            unhealthy_threshold: 3,
            healthy_threshold: 2,
            check_type: HealthCheckType::Http {
                path: "/health".into(),
                expected_status: 200,
            },
            initial_delay: Duration::from_secs(10),
        }
    }
}

/// Health check types
#[derive(Debug, Clone)]
pub enum HealthCheckType {
    /// HTTP health check
    Http {
        /// Health check path
        path: alloc::string::String,
        /// Expected HTTP status code
        expected_status: u16,
        /// Expected response body (optional)
        expected_body: Option<alloc::string::String>,
        /// Custom headers
        headers: alloc::collections::BTreeMap<alloc::string::String, alloc::string::String>,
    },
    /// TCP health check
    Tcp {
        /// Port to check
        port: u16,
        /// Data to send
        send_data: Option<alloc::vec::Vec<u8>>,
        /// Expected response data
        expected_response: Option<alloc::vec::Vec<u8>>,
    },
    /// gRPC health check
    Grpc {
        /// gRPC service name
        service: alloc::string::String,
    },
    /// Custom health check
    Custom {
        /// Custom check command
        command: alloc::string::String,
        /// Command arguments
        args: alloc::vec::Vec<alloc::string::String>,
    },
}

/// Metrics configuration
#[derive(Debug, Clone)]
pub struct MetricsConfig {
    /// Enable metrics collection
    pub enabled: bool,
    /// Metrics endpoint path
    pub path: alloc::string::String,
    /// Prometheus export format
    pub prometheus_enabled: bool,
    /// StatsD export configuration
    pub statsd_config: Option<StatsdConfig>,
    /// Metrics collection interval
    pub collection_interval: Duration,
    /// Enable histogram buckets for latency
    pub histogram_buckets: alloc::vec::Vec<f64>,
}

impl Default for MetricsConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            path: "/metrics".into(),
            prometheus_enabled: true,
            statsd_config: None,
            collection_interval: Duration::from_secs(10),
            histogram_buckets: vec![0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0],
        }
    }
}

/// StatsD configuration
#[derive(Debug, Clone)]
pub struct StatsdConfig {
    /// StatsD server address
    pub address: alloc::string::String,
    /// Metric prefix
    pub prefix: alloc::string::String,
    /// Flush interval
    pub flush_interval: Duration,
}

/// Tracing configuration
#[derive(Debug, Clone)]
pub struct TracingConfig {
    /// Enable distributed tracing
    pub enabled: bool,
    /// Tracing backend
    pub backend: TracingBackend,
    /// Service name
    pub service_name: alloc::string::String,
    /// Sampling rate (0.0 to 1.0)
    pub sampling_rate: f64,
    /// Custom tags
    pub tags: alloc::collections::BTreeMap<alloc::string::String, alloc::string::String>,
}

impl Default for TracingConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            backend: TracingBackend::Jaeger {
                endpoint: "http://localhost:14268/api/traces".into(),
            },
            service_name: "frys-gateway".into(),
            sampling_rate: 0.1,
            tags: alloc::collections::BTreeMap::new(),
        }
    }
}

/// Tracing backend types
#[derive(Debug, Clone)]
pub enum TracingBackend {
    /// Jaeger backend
    Jaeger {
        /// Jaeger endpoint
        endpoint: alloc::string::String,
    },
    /// Zipkin backend
    Zipkin {
        /// Zipkin endpoint
        endpoint: alloc::string::String,
    },
    /// OpenTelemetry collector
    OpenTelemetry {
        /// OTLP endpoint
        endpoint: alloc::string::String,
    },
    /// Custom backend
    Custom {
        /// Custom configuration
        config: alloc::collections::BTreeMap<alloc::string::String, alloc::string::String>,
    },
}

/// Connection limits
#[derive(Debug, Clone)]
pub struct ConnectionLimits {
    /// Maximum concurrent connections
    pub max_connections: usize,
    /// Maximum connections per upstream
    pub max_connections_per_upstream: usize,
    /// Connection timeout
    pub connection_timeout: Duration,
    /// Keep-alive timeout
    pub keep_alive_timeout: Duration,
    /// Maximum requests per connection
    pub max_requests_per_connection: usize,
}

impl Default for ConnectionLimits {
    fn default() -> Self {
        Self {
            max_connections: DEFAULT_MAX_CONNECTIONS,
            max_connections_per_upstream: 100,
            connection_timeout: Duration::from_secs(10),
            keep_alive_timeout: Duration::from_secs(60),
            max_requests_per_connection: 1000,
        }
    }
}

/// Circuit breaker configuration
#[derive(Debug, Clone)]
pub struct CircuitBreakerConfig {
    /// Failure threshold
    pub failure_threshold: u32,
    /// Recovery timeout
    pub recovery_timeout: Duration,
    /// Success threshold for recovery
    pub success_threshold: u32,
    /// Monitoring window
    pub monitoring_window: Duration,
    /// Half-open max requests
    pub half_open_max_requests: u32,
}

impl Default for CircuitBreakerConfig {
    fn default() -> Self {
        Self {
            failure_threshold: DEFAULT_CIRCUIT_BREAKER_THRESHOLD,
            recovery_timeout: Duration::from_secs(60),
            success_threshold: 3,
            monitoring_window: Duration::from_secs(10),
            half_open_max_requests: 10,
        }
    }
}

/// Rate limiting configuration
#[derive(Debug, Clone)]
pub struct RateLimitConfig {
    /// Requests per second
    pub requests_per_second: u32,
    /// Burst size
    pub burst_size: u32,
    /// Key strategy for rate limiting
    pub key_strategy: RateLimitKey,
    /// Distributed rate limiting
    pub distributed: bool,
    /// Redis URL for distributed limiting
    pub redis_url: Option<alloc::string::String>,
}

/// Rate limiting key strategies
#[derive(Debug, Clone)]
pub enum RateLimitKey {
    /// Rate limit by IP address
    IP,
    /// Rate limit by user ID (from JWT token)
    UserID,
    /// Rate limit by API key
    APIKey,
    /// Rate limit by custom header
    Header(alloc::string::String),
    /// Rate limit by path
    Path,
    /// Custom key strategy
    Custom(alloc::string::String),
}

/// Retry configuration
#[derive(Debug, Clone)]
pub struct RetryConfig {
    /// Maximum retry attempts
    pub max_attempts: u32,
    /// Retry delay strategy
    pub delay_strategy: RetryDelayStrategy,
    /// Initial delay
    pub initial_delay: Duration,
    /// Maximum delay
    pub max_delay: Duration,
    /// Backoff multiplier
    pub backoff_multiplier: f64,
    /// Retryable status codes
    pub retryable_status_codes: alloc::vec::Vec<u16>,
    /// Retry on network errors
    pub retry_on_network_errors: bool,
}

impl Default for RetryConfig {
    fn default() -> Self {
        Self {
            max_attempts: 3,
            delay_strategy: RetryDelayStrategy::ExponentialBackoff,
            initial_delay: Duration::from_millis(100),
            max_delay: Duration::from_secs(10),
            backoff_multiplier: 2.0,
            retryable_status_codes: vec![500, 502, 503, 504],
            retry_on_network_errors: true,
        }
    }
}

/// Retry delay strategies
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RetryDelayStrategy {
    /// Fixed delay between retries
    Fixed,
    /// Linear backoff
    Linear,
    /// Exponential backoff
    ExponentialBackoff,
    /// Jittered exponential backoff
    JitteredExponential,
}

/// Gateway statistics
#[derive(Debug, Clone, Default)]
pub struct GatewayStats {
    /// Total requests processed
    pub total_requests: u64,
    /// Requests per second
    pub requests_per_second: f64,
    /// Active connections
    pub active_connections: usize,
    /// Total response time
    pub total_response_time_ms: u64,
    /// Error count
    pub error_count: u64,
    /// Error rate (0.0 to 1.0)
    pub error_rate: f64,
    /// P50 latency
    pub p50_latency_ms: u64,
    /// P95 latency
    pub p95_latency_ms: u64,
    /// P99 latency
    pub p99_latency_ms: u64,
    /// Bytes received
    pub bytes_received: u64,
    /// Bytes sent
    pub bytes_sent: u64,
    /// Uptime in seconds
    pub uptime_seconds: u64,
}

impl GatewayStats {
    /// Calculate average latency
    pub fn avg_latency_ms(&self) -> f64 {
        if self.total_requests == 0 {
            0.0
        } else {
            self.total_response_time_ms as f64 / self.total_requests as f64
        }
    }

    /// Calculate throughput (requests per second)
    pub fn throughput_rps(&self) -> f64 {
        if self.uptime_seconds == 0 {
            0.0
        } else {
            self.total_requests as f64 / self.uptime_seconds as f64
        }
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
    fn test_gateway_config_default() {
        let config = GatewayConfig::default();
        assert_eq!(config.listen_addr.port(), DEFAULT_GATEWAY_PORT);
        assert_eq!(config.request_timeout, Duration::from_secs(DEFAULT_REQUEST_TIMEOUT));
        assert_eq!(config.max_request_size, DEFAULT_MAX_REQUEST_SIZE);
        assert!(config.compression_enabled);
    }

    #[test]
    fn test_route_default() {
        let route = Route::default();
        assert_eq!(route.priority, 0);
        assert_eq!(route.protocol, Protocol::HTTP);
        assert_eq!(route.load_balancer, LoadBalancerType::RoundRobin);
    }

    #[test]
    fn test_upstream_default() {
        let upstream = Upstream::default();
        assert_eq!(upstream.weight, 1);
        assert_eq!(upstream.max_connections, 100);
        assert_eq!(upstream.connect_timeout, Duration::from_secs(5));
        assert_eq!(upstream.request_timeout, Duration::from_secs(30));
    }

    #[test]
    fn test_health_check_config_default() {
        let config = HealthCheckConfig::default();
        assert_eq!(config.interval, Duration::from_secs(30));
        assert_eq!(config.timeout, Duration::from_secs(5));
        assert_eq!(config.unhealthy_threshold, 3);
        assert_eq!(config.healthy_threshold, 2);
    }

    #[test]
    fn test_metrics_config_default() {
        let config = MetricsConfig::default();
        assert!(config.enabled);
        assert_eq!(config.path, "/metrics");
        assert!(config.prometheus_enabled);
        assert_eq!(config.collection_interval, Duration::from_secs(10));
    }

    #[test]
    fn test_connection_limits_default() {
        let limits = ConnectionLimits::default();
        assert_eq!(limits.max_connections, DEFAULT_MAX_CONNECTIONS);
        assert_eq!(limits.max_connections_per_upstream, 100);
        assert_eq!(limits.connection_timeout, Duration::from_secs(10));
        assert_eq!(limits.keep_alive_timeout, Duration::from_secs(60));
    }

    #[test]
    fn test_circuit_breaker_config_default() {
        let config = CircuitBreakerConfig::default();
        assert_eq!(config.failure_threshold, DEFAULT_CIRCUIT_BREAKER_THRESHOLD);
        assert_eq!(config.recovery_timeout, Duration::from_secs(60));
        assert_eq!(config.success_threshold, 3);
        assert_eq!(config.monitoring_window, Duration::from_secs(10));
    }

    #[test]
    fn test_retry_config_default() {
        let config = RetryConfig::default();
        assert_eq!(config.max_attempts, 3);
        assert_eq!(config.delay_strategy, RetryDelayStrategy::ExponentialBackoff);
        assert_eq!(config.initial_delay, Duration::from_millis(100));
        assert_eq!(config.max_delay, Duration::from_secs(10));
        assert_eq!(config.backoff_multiplier, 2.0);
    }

    #[test]
    fn test_gateway_stats() {
        let mut stats = GatewayStats::default();
        stats.total_requests = 1000;
        stats.total_response_time_ms = 5000;
        stats.uptime_seconds = 10;

        assert_eq!(stats.avg_latency_ms(), 5.0);
        assert_eq!(stats.throughput_rps(), 100.0);
    }

    #[test]
    fn test_condition_operators() {
        assert_eq!(ConditionOperator::Equal, ConditionOperator::Equal);
        assert_ne!(ConditionOperator::Equal, ConditionOperator::NotEqual);
    }

    #[test]
    fn test_load_balancer_types() {
        assert_eq!(LoadBalancerType::RoundRobin, LoadBalancerType::RoundRobin);
        assert_ne!(LoadBalancerType::RoundRobin, LoadBalancerType::LeastLoaded);
    }

    #[test]
    fn test_protocols() {
        assert_eq!(Protocol::HTTP, Protocol::HTTP);
        assert_ne!(Protocol::HTTP, Protocol::WebSocket);
    }
}
