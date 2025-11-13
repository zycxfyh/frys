//! Configuration for network plugin

use alloc::string::String;

/// Main configuration for network plugin
#[derive(Debug, Clone)]
pub struct NetworkPluginConfig {
    /// Enable HTTP client
    pub enable_http_client: bool,
    /// Enable HTTP server
    pub enable_http_server: bool,
    /// Enable WebSocket support
    pub enable_websocket: bool,
    /// Enable messaging
    pub enable_messaging: bool,
    /// Enable load balancing
    pub enable_load_balancing: bool,
    /// Enable service discovery
    pub enable_service_discovery: bool,
    /// Enable API gateway
    pub enable_api_gateway: bool,
    /// Maximum concurrent connections
    pub max_connections: usize,
    /// Connection timeout in seconds
    pub connection_timeout_secs: u64,
    /// Request timeout in seconds
    pub request_timeout_secs: u64,
    /// Rate limit (requests per minute)
    pub rate_limit_requests: u32,
    /// Circuit breaker failure threshold
    pub circuit_breaker_threshold: u32,
    /// Enable TLS
    pub enable_tls: bool,
    /// TLS certificate path
    pub tls_cert_path: Option<String>,
    /// TLS key path
    pub tls_key_path: Option<String>,
    /// Enable monitoring
    pub enable_monitoring: bool,
    /// Monitoring endpoint
    pub monitoring_endpoint: Option<String>,
}

impl Default for NetworkPluginConfig {
    fn default() -> Self {
        Self {
            enable_http_client: true,
            enable_http_server: false,
            enable_websocket: false,
            enable_messaging: false,
            enable_load_balancing: false,
            enable_service_discovery: false,
            enable_api_gateway: false,
            max_connections: 1000,
            connection_timeout_secs: 30,
            request_timeout_secs: 60,
            rate_limit_requests: 100,
            circuit_breaker_threshold: 5,
            enable_tls: false,
            tls_cert_path: None,
            tls_key_path: None,
            enable_monitoring: true,
            monitoring_endpoint: None,
        }
    }
}

/// HTTP configuration
#[derive(Debug, Clone)]
pub struct HttpConfig {
    /// Maximum request body size (bytes)
    pub max_request_body_size: usize,
    /// Enable compression
    pub enable_compression: bool,
    /// User agent string
    pub user_agent: String,
    /// Enable keep-alive
    pub enable_keep_alive: bool,
    /// Pool idle timeout
    pub pool_idle_timeout_secs: u64,
}

/// WebSocket configuration
#[derive(Debug, Clone)]
pub struct WebSocketConfig {
    /// Maximum message size
    pub max_message_size: usize,
    /// Heartbeat interval (seconds)
    pub heartbeat_interval_secs: u64,
    /// Connection timeout
    pub connection_timeout_secs: u64,
    /// Enable compression
    pub enable_compression: bool,
}

/// Messaging configuration
#[derive(Debug, Clone)]
pub struct MessagingConfig {
    /// Message broker URL
    pub broker_url: String,
    /// Client ID
    pub client_id: String,
    /// Group ID (for Kafka)
    pub group_id: Option<String>,
    /// Enable message persistence
    pub enable_persistence: bool,
    /// Quality of service level
    pub qos_level: QoSLevel,
}

/// Quality of service levels
#[derive(Debug, Clone)]
pub enum QoSLevel {
    /// At most once
    AtMostOnce,
    /// At least once
    AtLeastOnce,
    /// Exactly once
    ExactlyOnce,
}

/// Load balancer configuration
#[derive(Debug, Clone)]
pub struct LoadBalancerConfig {
    /// Load balancing algorithm
    pub algorithm: LoadBalancingAlgorithm,
    /// Health check interval (seconds)
    pub health_check_interval_secs: u64,
    /// Health check timeout (seconds)
    pub health_check_timeout_secs: u64,
    /// Maximum failures before marking unhealthy
    pub max_failures: u32,
}

/// Load balancing algorithms
#[derive(Debug, Clone)]
pub enum LoadBalancingAlgorithm {
    /// Round robin
    RoundRobin,
    /// Least connections
    LeastConnections,
    /// IP hash
    IpHash,
    /// Weighted round robin
    WeightedRoundRobin,
}

/// Service discovery configuration
#[derive(Debug, Clone)]
pub struct ServiceDiscoveryConfig {
    /// Discovery backend
    pub backend: DiscoveryBackend,
    /// Service registry URL
    pub registry_url: String,
    /// Service TTL (seconds)
    pub service_ttl_secs: u64,
    /// Heartbeat interval (seconds)
    pub heartbeat_interval_secs: u64,
}

/// Discovery backends
#[derive(Debug, Clone)]
pub enum DiscoveryBackend {
    /// Consul
    Consul,
    /// etcd
    Etcd,
    /// ZooKeeper
    ZooKeeper,
    /// Custom
    Custom,
}

/// API gateway configuration
#[derive(Debug, Clone)]
pub struct ApiGatewayConfig {
    /// Listen address
    pub listen_address: String,
    /// Routes configuration
    pub routes: Vec<RouteConfig>,
    /// Enable authentication
    pub enable_authentication: bool,
    /// Authentication provider
    pub auth_provider: Option<AuthProvider>,
    /// Rate limiting configuration
    pub rate_limiting: RateLimitingConfig,
}

/// Route configuration
#[derive(Debug, Clone)]
pub struct RouteConfig {
    /// Route path pattern
    pub path: String,
    /// Target service
    pub target_service: String,
    /// HTTP methods allowed
    pub methods: Vec<String>,
    /// Authentication required
    pub auth_required: bool,
    /// Rate limit for this route
    pub rate_limit: Option<u32>,
}

/// Authentication providers
#[derive(Debug, Clone)]
pub enum AuthProvider {
    /// JWT authentication
    JWT,
    /// OAuth2
    OAuth2,
    /// Basic authentication
    Basic,
    /// Custom
    Custom,
}

/// Rate limiting configuration
#[derive(Debug, Clone)]
pub struct RateLimitingConfig {
    /// Global rate limit (requests per minute)
    pub global_limit: u32,
    /// IP-based rate limiting
    pub enable_ip_limiting: bool,
    /// User-based rate limiting
    pub enable_user_limiting: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = NetworkPluginConfig::default();
        assert!(config.enable_http_client);
        assert_eq!(config.max_connections, 1000);
        assert_eq!(config.connection_timeout_secs, 30);
    }

    #[test]
    fn test_http_config() {
        let config = HttpConfig {
            max_request_body_size: 10 * 1024 * 1024, // 10MB
            enable_compression: true,
            user_agent: "Frys-Network/1.0".to_string(),
            enable_keep_alive: true,
            pool_idle_timeout_secs: 90,
        };

        assert_eq!(config.max_request_body_size, 10 * 1024 * 1024);
        assert!(config.enable_compression);
        assert_eq!(config.user_agent, "Frys-Network/1.0");
    }

    #[test]
    fn test_load_balancing_config() {
        let config = LoadBalancerConfig {
            algorithm: LoadBalancingAlgorithm::RoundRobin,
            health_check_interval_secs: 30,
            health_check_timeout_secs: 5,
            max_failures: 3,
        };

        matches!(config.algorithm, LoadBalancingAlgorithm::RoundRobin);
        assert_eq!(config.health_check_interval_secs, 30);
    }
}
