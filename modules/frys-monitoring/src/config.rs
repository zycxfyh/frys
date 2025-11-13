//! Configuration for monitoring system

use alloc::string::String;

/// Main monitoring configuration
#[derive(Debug, Clone)]
pub struct MonitoringConfig {
    /// Enable metrics collection
    pub enable_metrics: bool,
    /// Enable alerting system
    pub enable_alerting: bool,
    /// Enable tracing
    pub enable_tracing: bool,
    /// Enable health checks
    pub enable_health_checks: bool,
    /// Storage backend type
    pub storage_backend: StorageBackend,
    /// Data retention period in days
    pub retention_days: u32,
    /// Metrics scrape interval in seconds
    pub scrape_interval: u64,
    /// Alert evaluation interval in seconds
    pub evaluation_interval: u64,
    /// Maximum concurrent connections
    pub max_connections: usize,
    /// Enable data compression
    pub enable_compression: bool,
    /// HTTP server configuration
    pub http_config: Option<HttpConfig>,
    /// Alerting configuration
    pub alerting_config: Option<AlertingConfig>,
}

impl Default for MonitoringConfig {
    fn default() -> Self {
        Self {
            enable_metrics: true,
            enable_alerting: true,
            enable_tracing: false,
            enable_health_checks: true,
            storage_backend: StorageBackend::Memory,
            retention_days: 30,
            scrape_interval: 15,
            evaluation_interval: 30,
            max_connections: 1000,
            enable_compression: true,
            http_config: Some(HttpConfig::default()),
            alerting_config: Some(AlertingConfig::default()),
        }
    }
}

/// Storage backend types
#[derive(Debug, Clone)]
pub enum StorageBackend {
    /// In-memory storage (for testing/development)
    Memory,
    /// RocksDB storage
    RocksDB,
    /// Redis storage (distributed)
    Redis,
    /// Custom storage implementation
    Custom(String),
}

/// HTTP server configuration
#[derive(Debug, Clone)]
pub struct HttpConfig {
    /// Server bind address
    pub bind_address: String,
    /// Server port
    pub port: u16,
    /// Enable TLS
    pub enable_tls: bool,
    /// TLS certificate path
    pub tls_cert_path: Option<String>,
    /// TLS key path
    pub tls_key_path: Option<String>,
    /// CORS allowed origins
    pub cors_origins: Vec<String>,
    /// Request timeout in seconds
    pub request_timeout: u64,
    /// Maximum request body size in bytes
    pub max_body_size: usize,
}

impl Default for HttpConfig {
    fn default() -> Self {
        Self {
            bind_address: "0.0.0.0".to_string(),
            port: 9090,
            enable_tls: false,
            tls_cert_path: None,
            tls_key_path: None,
            cors_origins: vec!["*".to_string()],
            request_timeout: 30,
            max_body_size: 1024 * 1024, // 1MB
        }
    }
}

/// Alerting configuration
#[derive(Debug, Clone)]
pub struct AlertingConfig {
    /// Default notification channels
    pub default_channels: Vec<String>,
    /// Maximum alerts per rule per hour
    pub max_alerts_per_rule_per_hour: u32,
    /// Alert cleanup interval in hours
    pub cleanup_interval_hours: u32,
    /// Enable alert aggregation
    pub enable_aggregation: bool,
    /// Alert aggregation window in minutes
    pub aggregation_window_minutes: u32,
    /// SMTP configuration for email alerts
    pub smtp_config: Option<SmtpConfig>,
    /// Webhook configurations
    pub webhook_configs: Vec<WebhookConfig>,
}

impl Default for AlertingConfig {
    fn default() -> Self {
        Self {
            default_channels: vec!["console".to_string()],
            max_alerts_per_rule_per_hour: 10,
            cleanup_interval_hours: 24,
            enable_aggregation: true,
            aggregation_window_minutes: 5,
            smtp_config: None,
            webhook_configs: vec![],
        }
    }
}

/// SMTP configuration for email notifications
#[derive(Debug, Clone)]
pub struct SmtpConfig {
    /// SMTP server address
    pub server: String,
    /// SMTP server port
    pub port: u16,
    /// Username for authentication
    pub username: String,
    /// Password for authentication
    pub password: String,
    /// From email address
    pub from_address: String,
    /// Use TLS
    pub use_tls: bool,
    /// Use STARTTLS
    pub use_starttls: bool,
}

/// Webhook configuration
#[derive(Debug, Clone)]
pub struct WebhookConfig {
    /// Webhook name
    pub name: String,
    /// Webhook URL
    pub url: String,
    /// HTTP headers to include
    pub headers: std::collections::HashMap<String, String>,
    /// Request timeout in seconds
    pub timeout_seconds: u64,
    /// Retry configuration
    pub retry_config: RetryConfig,
}

/// Retry configuration
#[derive(Debug, Clone)]
pub struct RetryConfig {
    /// Maximum number of retries
    pub max_retries: u32,
    /// Initial retry delay in seconds
    pub initial_delay_seconds: u64,
    /// Maximum retry delay in seconds
    pub max_delay_seconds: u64,
    /// Backoff multiplier
    pub backoff_multiplier: f64,
}

impl Default for RetryConfig {
    fn default() -> Self {
        Self {
            max_retries: 3,
            initial_delay_seconds: 1,
            max_delay_seconds: 60,
            backoff_multiplier: 2.0,
        }
    }
}

/// Metrics configuration
#[derive(Debug, Clone)]
pub struct MetricsConfig {
    /// Enable Prometheus metrics endpoint
    pub enable_prometheus: bool,
    /// Prometheus endpoint path
    pub prometheus_path: String,
    /// Enable metrics aggregation
    pub enable_aggregation: bool,
    /// Aggregation interval in seconds
    pub aggregation_interval: u64,
    /// Metrics to collect by default
    pub default_metrics: Vec<String>,
    /// Custom metric definitions
    pub custom_metrics: Vec<CustomMetricConfig>,
}

impl Default for MetricsConfig {
    fn default() -> Self {
        Self {
            enable_prometheus: true,
            prometheus_path: "/metrics".to_string(),
            enable_aggregation: true,
            aggregation_interval: 60,
            default_metrics: vec![
                "cpu_usage".to_string(),
                "memory_usage".to_string(),
                "disk_usage".to_string(),
                "network_rx_bytes".to_string(),
                "network_tx_bytes".to_string(),
                "active_connections".to_string(),
            ],
            custom_metrics: vec![],
        }
    }
}

/// Custom metric configuration
#[derive(Debug, Clone)]
pub struct CustomMetricConfig {
    /// Metric name
    pub name: String,
    /// Metric type
    pub metric_type: String,
    /// Metric help text
    pub help: String,
    /// Labels for the metric
    pub labels: Vec<String>,
    /// Collection command/script
    pub collection_command: String,
    /// Collection interval in seconds
    pub collection_interval: u64,
}

/// Tracing configuration
#[derive(Debug, Clone)]
pub struct TracingConfig {
    /// Enable distributed tracing
    pub enable_distributed_tracing: bool,
    /// Tracing service name
    pub service_name: String,
    /// Sampling rate (0.0 to 1.0)
    pub sampling_rate: f64,
    /// Maximum trace duration in seconds
    pub max_trace_duration_seconds: u64,
    /// Jaeger endpoint (if using Jaeger)
    pub jaeger_endpoint: Option<String>,
    /// Zipkin endpoint (if using Zipkin)
    pub zipkin_endpoint: Option<String>,
}

impl Default for TracingConfig {
    fn default() -> Self {
        Self {
            enable_distributed_tracing: false,
            service_name: "frys-monitoring".to_string(),
            sampling_rate: 0.1, // 10% sampling
            max_trace_duration_seconds: 300, // 5 minutes
            jaeger_endpoint: None,
            zipkin_endpoint: None,
        }
    }
}

/// Health check configuration
#[derive(Debug, Clone)]
pub struct HealthCheckConfig {
    /// Enable health checks
    pub enabled: bool,
    /// Health check interval in seconds
    pub check_interval_seconds: u64,
    /// Health check timeout in seconds
    pub timeout_seconds: u64,
    /// Maximum consecutive failures before marking unhealthy
    pub max_consecutive_failures: u32,
    /// Health check endpoints
    pub endpoints: Vec<HealthCheckEndpoint>,
}

impl Default for HealthCheckConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            check_interval_seconds: 30,
            timeout_seconds: 5,
            max_consecutive_failures: 3,
            endpoints: vec![
                HealthCheckEndpoint {
                    name: "metrics".to_string(),
                    url: "http://localhost:9090/health".to_string(),
                    method: "GET".to_string(),
                    expected_status: 200,
                    timeout_seconds: 5,
                },
            ],
        }
    }
}

/// Health check endpoint configuration
#[derive(Debug, Clone)]
pub struct HealthCheckEndpoint {
    /// Endpoint name
    pub name: String,
    /// Endpoint URL
    pub url: String,
    /// HTTP method
    pub method: String,
    /// Expected HTTP status code
    pub expected_status: u16,
    /// Request timeout in seconds
    pub timeout_seconds: u64,
    /// Custom headers
    pub headers: std::collections::HashMap<String, String>,
}

/// Security configuration
#[derive(Debug, Clone)]
pub struct SecurityConfig {
    /// Enable authentication
    pub enable_auth: bool,
    /// Authentication method
    pub auth_method: AuthMethod,
    /// JWT secret key
    pub jwt_secret: Option<String>,
    /// API keys for authentication
    pub api_keys: Vec<String>,
    /// Enable TLS for all connections
    pub enable_tls: bool,
    /// TLS certificate path
    pub tls_cert_path: Option<String>,
    /// TLS key path
    pub tls_key_path: Option<String>,
    /// Allowed origins for CORS
    pub allowed_origins: Vec<String>,
}

impl Default for SecurityConfig {
    fn default() -> Self {
        Self {
            enable_auth: false,
            auth_method: AuthMethod::None,
            jwt_secret: None,
            api_keys: vec![],
            enable_tls: false,
            tls_cert_path: None,
            tls_key_path: None,
            allowed_origins: vec!["*".to_string()],
        }
    }
}

/// Authentication methods
#[derive(Debug, Clone)]
pub enum AuthMethod {
    /// No authentication
    None,
    /// API key authentication
    ApiKey,
    /// JWT token authentication
    JWT,
    /// OAuth2 authentication
    OAuth2,
}

/// Configuration builder for fluent API
pub struct MonitoringConfigBuilder {
    config: MonitoringConfig,
}

impl MonitoringConfigBuilder {
    pub fn new() -> Self {
        Self {
            config: MonitoringConfig::default(),
        }
    }

    pub fn enable_metrics(mut self, enable: bool) -> Self {
        self.config.enable_metrics = enable;
        self
    }

    pub fn enable_alerting(mut self, enable: bool) -> Self {
        self.config.enable_alerting = enable;
        self
    }

    pub fn storage_backend(mut self, backend: StorageBackend) -> Self {
        self.config.storage_backend = backend;
        self
    }

    pub fn retention_days(mut self, days: u32) -> Self {
        self.config.retention_days = days;
        self
    }

    pub fn scrape_interval(mut self, seconds: u64) -> Self {
        self.config.scrape_interval = seconds;
        self
    }

    pub fn http_config(mut self, config: HttpConfig) -> Self {
        self.config.http_config = Some(config);
        self
    }

    pub fn alerting_config(mut self, config: AlertingConfig) -> Self {
        self.config.alerting_config = Some(config);
        self
    }

    pub fn build(self) -> MonitoringConfig {
        self.config
    }
}

impl Default for MonitoringConfigBuilder {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = MonitoringConfig::default();

        assert!(config.enable_metrics);
        assert!(config.enable_alerting);
        assert_eq!(config.retention_days, 30);
        assert_eq!(config.scrape_interval, 15);
        assert_eq!(config.storage_backend, StorageBackend::Memory);
    }

    #[test]
    fn test_config_builder() {
        let config = MonitoringConfigBuilder::new()
            .enable_metrics(true)
            .enable_alerting(true)
            .storage_backend(StorageBackend::RocksDB)
            .retention_days(90)
            .scrape_interval(30)
            .build();

        assert!(config.enable_metrics);
        assert!(config.enable_alerting);
        assert!(matches!(config.storage_backend, StorageBackend::RocksDB));
        assert_eq!(config.retention_days, 90);
        assert_eq!(config.scrape_interval, 30);
    }

    #[test]
    fn test_http_config_defaults() {
        let config = HttpConfig::default();

        assert_eq!(config.bind_address, "0.0.0.0");
        assert_eq!(config.port, 9090);
        assert!(!config.enable_tls);
        assert_eq!(config.request_timeout, 30);
        assert_eq!(config.max_body_size, 1024 * 1024);
    }

    #[test]
    fn test_alerting_config_defaults() {
        let config = AlertingConfig::default();

        assert_eq!(config.default_channels, vec!["console"]);
        assert_eq!(config.max_alerts_per_rule_per_hour, 10);
        assert!(config.enable_aggregation);
        assert_eq!(config.aggregation_window_minutes, 5);
    }

    #[test]
    fn test_retry_config_defaults() {
        let config = RetryConfig::default();

        assert_eq!(config.max_retries, 3);
        assert_eq!(config.initial_delay_seconds, 1);
        assert_eq!(config.max_delay_seconds, 60);
        assert_eq!(config.backoff_multiplier, 2.0);
    }
}
