//! Core WebSocket types and structures

use crate::*;
use core::time::Duration;

/// WebSocket configuration
#[derive(Debug, Clone)]
pub struct WebSocketConfig {
    /// Bind address for the WebSocket server
    pub bind_addr: std::net::SocketAddr,
    /// Maximum number of concurrent connections
    pub max_connections: usize,
    /// Message timeout in seconds
    pub message_timeout: Duration,
    /// Heartbeat interval for connection health checks
    pub heartbeat_interval: Duration,
    /// Maximum message size in bytes
    pub max_message_size: usize,
    /// Enable message compression
    pub enable_compression: bool,
    /// Subprotocols to support
    pub subprotocols: alloc::vec::Vec<alloc::string::String>,
    /// TLS configuration
    pub tls_config: Option<TlsConfig>,
    /// Authentication configuration
    pub auth_config: Option<AuthConfig>,
    /// Rate limiting configuration
    pub rate_limit_config: Option<RateLimitConfig>,
    /// Pub/Sub configuration
    pub pubsub_config: Option<PubSubConfig>,
    /// Cluster configuration
    pub cluster_config: Option<ClusterConfig>,
    /// Monitoring configuration
    pub monitoring_config: Option<MonitoringConfig>,
    /// Connection buffer size
    pub connection_buffer_size: usize,
    /// Enable per-message deflate compression
    pub per_message_deflate: bool,
    /// Custom headers to add to handshake response
    pub custom_headers: std::collections::HashMap<alloc::string::String, alloc::string::String>,
}

impl Default for WebSocketConfig {
    fn default() -> Self {
        Self {
            bind_addr: format!("0.0.0.0:{}", DEFAULT_WEBSOCKET_PORT).parse().unwrap(),
            max_connections: DEFAULT_MAX_CONNECTIONS,
            message_timeout: Duration::from_secs(DEFAULT_MESSAGE_TIMEOUT),
            heartbeat_interval: Duration::from_secs(DEFAULT_HEARTBEAT_INTERVAL),
            max_message_size: DEFAULT_MAX_MESSAGE_SIZE,
            enable_compression: false,
            subprotocols: alloc::vec::Vec::new(),
            tls_config: None,
            auth_config: None,
            rate_limit_config: None,
            pubsub_config: None,
            cluster_config: None,
            monitoring_config: Some(MonitoringConfig::default()),
            connection_buffer_size: 65536, // 64KB
            per_message_deflate: false,
            custom_headers: std::collections::HashMap::new(),
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
    /// OCSP stapling
    pub ocsp_stapling: bool,
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
            ocsp_stapling: false,
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

/// Authentication configuration
#[derive(Debug, Clone)]
pub struct AuthConfig {
    /// Authentication method
    pub method: AuthMethod,
    /// JWT secret key
    pub jwt_secret: alloc::string::String,
    /// Required JWT claims
    pub required_claims: alloc::vec::Vec<alloc::string::String>,
    /// API key header name
    pub api_key_header: alloc::string::String,
    /// Valid API keys
    pub api_keys: alloc::collections::HashSet<alloc::string::String>,
    /// OAuth2 configuration
    pub oauth_config: Option<OAuthConfig>,
    /// Custom authentication
    pub custom_auth: Option<CustomAuthConfig>,
}

impl Default for AuthConfig {
    fn default() -> Self {
        Self {
            method: AuthMethod::None,
            jwt_secret: alloc::string::String::new(),
            required_claims: alloc::vec::Vec::new(),
            api_key_header: "X-API-Key".into(),
            api_keys: alloc::collections::HashSet::new(),
            oauth_config: None,
            custom_auth: None,
        }
    }
}

/// Authentication methods
#[derive(Debug, Clone)]
pub enum AuthMethod {
    /// No authentication
    None,
    /// JWT token authentication
    Jwt,
    /// API key authentication
    ApiKey,
    /// OAuth2 authentication
    OAuth2,
    /// Custom authentication
    Custom(alloc::string::String),
}

/// OAuth2 configuration
#[derive(Debug, Clone)]
pub struct OAuthConfig {
    /// OAuth2 issuer URL
    pub issuer: alloc::string::String,
    /// Client ID
    pub client_id: alloc::string::String,
    /// Client secret
    pub client_secret: alloc::string::String,
    /// Required scopes
    pub scopes: alloc::vec::Vec<alloc::string::String>,
    /// JWKS URL for key verification
    pub jwks_url: alloc::string::String,
}

/// Custom authentication configuration
#[derive(Debug, Clone)]
pub struct CustomAuthConfig {
    /// Custom auth header name
    pub header_name: alloc::string::String,
    /// Validation endpoint URL
    pub validation_url: alloc::string::String,
    /// Timeout for validation requests
    pub validation_timeout: Duration,
}

/// Rate limiting configuration
#[derive(Debug, Clone)]
pub struct RateLimitConfig {
    /// Messages per second limit
    pub messages_per_second: u32,
    /// Burst size
    pub burst_size: u32,
    /// Rate limiting key strategy
    pub key_strategy: RateLimitKey,
    /// Time window in seconds
    pub time_window_seconds: u64,
    /// Enable distributed rate limiting
    pub distributed: bool,
    /// Redis URL for distributed limiting
    pub redis_url: Option<alloc::string::String>,
}

impl Default for RateLimitConfig {
    fn default() -> Self {
        Self {
            messages_per_second: DEFAULT_RATE_LIMIT_MESSAGES,
            burst_size: 20,
            key_strategy: RateLimitKey::Connection,
            time_window_seconds: 60,
            distributed: false,
            redis_url: None,
        }
    }
}

/// Rate limiting key strategies
#[derive(Debug, Clone)]
pub enum RateLimitKey {
    /// Rate limit by connection ID
    Connection,
    /// Rate limit by user ID (from authentication)
    User,
    /// Rate limit by IP address
    IP,
    /// Rate limit by custom header
    Header(alloc::string::String),
    /// Rate limit by path/channel
    Path,
    /// Custom key strategy
    Custom(alloc::string::String),
}

/// Pub/Sub configuration
#[derive(Debug, Clone)]
pub struct PubSubConfig {
    /// Redis URL for pub/sub backend
    pub redis_url: alloc::string::String,
    /// Enable cluster mode
    pub cluster_mode: bool,
    /// Key prefix for pub/sub channels
    pub key_prefix: alloc::string::String,
    /// Maximum channel subscriptions per connection
    pub max_subscriptions_per_connection: usize,
    /// Message buffer size for pub/sub forwarding
    pub message_buffer_size: usize,
    /// Enable pattern subscriptions
    pub enable_patterns: bool,
    /// Pub/sub message timeout
    pub message_timeout: Duration,
}

impl Default for PubSubConfig {
    fn default() -> Self {
        Self {
            redis_url: "redis://localhost:6379".into(),
            cluster_mode: false,
            key_prefix: "websocket:pubsub:".into(),
            max_subscriptions_per_connection: 100,
            message_buffer_size: 1000,
            enable_patterns: true,
            message_timeout: Duration::from_secs(30),
        }
    }
}

/// Cluster configuration
#[derive(Debug, Clone)]
pub struct ClusterConfig {
    /// Current node ID
    pub node_id: alloc::string::String,
    /// Peer node addresses
    pub peers: alloc::vec::Vec<alloc::string::String>,
    /// Redis URL for cluster coordination
    pub redis_url: alloc::string::String,
    /// Load balancing strategy
    pub load_balancing_strategy: LoadBalancingStrategy,
    /// Cluster heartbeat interval
    pub heartbeat_interval: Duration,
    /// Cluster reconnect delay
    pub reconnect_delay: Duration,
    /// Enable automatic failover
    pub enable_failover: bool,
    /// Maximum failed heartbeats before marking node as down
    pub max_failed_heartbeats: u32,
}

impl Default for ClusterConfig {
    fn default() -> Self {
        Self {
            node_id: uuid::Uuid::new_v4().to_string(),
            peers: alloc::vec::Vec::new(),
            redis_url: "redis://localhost:6379".into(),
            load_balancing_strategy: LoadBalancingStrategy::RoundRobin,
            heartbeat_interval: Duration::from_secs(10),
            reconnect_delay: Duration::from_secs(DEFAULT_CLUSTER_RECONNECT_DELAY),
            enable_failover: true,
            max_failed_heartbeats: 3,
        }
    }
}

/// Load balancing strategies for cluster
#[derive(Debug, Clone)]
pub enum LoadBalancingStrategy {
    /// Round robin distribution
    RoundRobin,
    /// Least connections
    LeastConnections,
    /// Consistent hashing
    ConsistentHash,
    /// Random selection
    Random,
}

/// Monitoring configuration
#[derive(Debug, Clone)]
pub struct MonitoringConfig {
    /// Enable metrics collection
    pub enabled: bool,
    /// Metrics collection interval
    pub collection_interval: Duration,
    /// Enable detailed connection metrics
    pub detailed_connection_metrics: bool,
    /// Enable message throughput metrics
    pub message_throughput_metrics: bool,
    /// Enable error tracking
    pub error_tracking: bool,
    /// Custom metrics labels
    pub custom_labels: std::collections::HashMap<alloc::string::String, alloc::string::String>,
}

impl Default for MonitoringConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            collection_interval: Duration::from_secs(10),
            detailed_connection_metrics: true,
            message_throughput_metrics: true,
            error_tracking: true,
            custom_labels: std::collections::HashMap::new(),
        }
    }
}

/// WebSocket message
#[derive(Debug, Clone)]
pub struct Message {
    /// Message ID
    pub id: alloc::string::String,
    /// Message type
    pub message_type: MessageType,
    /// Payload data
    pub payload: alloc::vec::Vec<u8>,
    /// Message headers
    pub headers: std::collections::HashMap<alloc::string::String, alloc::string::String>,
    /// Compression flag
    pub compressed: bool,
    /// Timestamp
    pub timestamp: u64,
    /// Source connection ID
    pub connection_id: alloc::string::String,
    /// Target user/room/channel
    pub target: Option<alloc::string::String>,
}

impl Message {
    /// Create a new text message
    pub fn text<S: Into<alloc::string::String>>(content: S) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            message_type: MessageType::Text,
            payload: content.into().into_bytes(),
            headers: std::collections::HashMap::new(),
            compressed: false,
            timestamp: current_timestamp(),
            connection_id: alloc::string::String::new(),
            target: None,
        }
    }

    /// Create a new binary message
    pub fn binary(data: alloc::vec::Vec<u8>) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            message_type: MessageType::Binary,
            payload: data,
            headers: std::collections::HashMap::new(),
            compressed: false,
            timestamp: current_timestamp(),
            connection_id: alloc::string::String::new(),
            target: None,
        }
    }

    /// Add a header
    pub fn with_header(mut self, key: impl Into<alloc::string::String>, value: impl Into<alloc::string::String>) -> Self {
        self.headers.insert(key.into(), value.into());
        self
    }

    /// Set target
    pub fn with_target(mut self, target: impl Into<alloc::string::String>) -> Self {
        self.target = Some(target.into());
        self
    }

    /// Set connection ID
    pub fn with_connection_id(mut self, connection_id: impl Into<alloc::string::String>) -> Self {
        self.connection_id = connection_id.into();
        self
    }

    /// Get text content (if text message)
    pub fn as_text(&self) -> Option<&str> {
        if self.message_type == MessageType::Text {
            std::str::from_utf8(&self.payload).ok()
        } else {
            None
        }
    }

    /// Get payload as string (lossy conversion)
    pub fn as_string_lossy(&self) -> alloc::string::String {
        String::from_utf8_lossy(&self.payload).into_owned()
    }
}

/// Message types
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MessageType {
    /// Text message
    Text,
    /// Binary message
    Binary,
    /// Ping message
    Ping,
    /// Pong message
    Pong,
    /// Close message
    Close,
}

/// Connection information
#[derive(Debug, Clone)]
pub struct ConnectionInfo {
    /// Connection ID
    pub id: alloc::string::String,
    /// Remote address
    pub remote_addr: alloc::string::String,
    /// Local address
    pub local_addr: alloc::string::String,
    /// User ID (if authenticated)
    pub user_id: Option<alloc::string::String>,
    /// Connection start time
    pub connected_at: u64,
    /// Last message time
    pub last_message_at: u64,
    /// Message count
    pub message_count: u64,
    /// Bytes sent
    pub bytes_sent: u64,
    /// Bytes received
    pub bytes_received: u64,
    /// Connection state
    pub state: ConnectionState,
    /// Subprotocol
    pub subprotocol: Option<alloc::string::String>,
    /// Compression enabled
    pub compression_enabled: bool,
    /// User agent
    pub user_agent: Option<alloc::string::String>,
    /// Custom metadata
    pub metadata: std::collections::HashMap<alloc::string::String, alloc::string::String>,
}

impl ConnectionInfo {
    /// Create new connection info
    pub fn new(remote_addr: impl Into<alloc::string::String>) -> Self {
        let id = uuid::Uuid::new_v4().to_string();
        let now = current_timestamp();

        Self {
            id,
            remote_addr: remote_addr.into(),
            local_addr: alloc::string::String::new(),
            user_id: None,
            connected_at: now,
            last_message_at: now,
            message_count: 0,
            bytes_sent: 0,
            bytes_received: 0,
            state: ConnectionState::Connecting,
            subprotocol: None,
            compression_enabled: false,
            user_agent: None,
            metadata: std::collections::HashMap::new(),
        }
    }

    /// Update last message time
    pub fn update_last_message(&mut self) {
        self.last_message_at = current_timestamp();
        self.message_count += 1;
    }

    /// Add bytes sent
    pub fn add_bytes_sent(&mut self, bytes: u64) {
        self.bytes_sent += bytes;
    }

    /// Add bytes received
    pub fn add_bytes_received(&mut self, bytes: u64) {
        self.bytes_received += bytes;
    }

    /// Set user ID
    pub fn set_user_id(&mut self, user_id: impl Into<alloc::string::String>) {
        self.user_id = Some(user_id.into());
    }

    /// Set connection state
    pub fn set_state(&mut self, state: ConnectionState) {
        self.state = state;
    }

    /// Add metadata
    pub fn add_metadata(&mut self, key: impl Into<alloc::string::String>, value: impl Into<alloc::string::String>) {
        self.metadata.insert(key.into(), value.into());
    }

    /// Get metadata value
    pub fn get_metadata(&self, key: &str) -> Option<&alloc::string::String> {
        self.metadata.get(key)
    }

    /// Check if connection is active
    pub fn is_active(&self) -> bool {
        matches!(self.state, ConnectionState::Connected | ConnectionState::Authenticated)
    }
}

/// Connection states
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConnectionState {
    /// Connecting
    Connecting,
    /// Connected
    Connected,
    /// Authenticating
    Authenticating,
    /// Authenticated
    Authenticated,
    /// Closing
    Closing,
    /// Closed
    Closed,
    /// Error
    Error,
}

/// Message response types
#[derive(Debug, Clone)]
pub enum MessageResponse {
    /// Acknowledge message
    Ack,
    /// Reply with message
    Reply(Message),
    /// Broadcast to specific targets
    Broadcast {
        /// Target connections
        targets: alloc::vec::Vec<alloc::string::String>,
        /// Message to broadcast
        message: Message,
    },
    /// Close connection
    Close {
        /// Close code
        code: u16,
        /// Close reason
        reason: alloc::string::String,
    },
    /// No operation
    NoOp,
}

/// Broadcast filter for selective broadcasting
#[derive(Debug, Clone)]
pub struct BroadcastFilter {
    /// Target user IDs
    pub user_ids: Option<alloc::vec::Vec<alloc::string::String>>,
    /// Target room names
    pub rooms: Option<alloc::vec::Vec<alloc::string::String>>,
    /// Target connection IDs
    pub connection_ids: Option<alloc::vec::Vec<alloc::string::String>>,
    /// User metadata filter
    pub user_metadata: Option<serde_json::Value>,
    /// Custom filter function
    pub custom_filter: Option<alloc::boxed::Box<dyn Fn(&ConnectionInfo) -> bool + Send + Sync>>,
}

impl BroadcastFilter {
    /// Create filter for specific users
    pub fn users(user_ids: alloc::vec::Vec<alloc::string::String>) -> Self {
        Self {
            user_ids: Some(user_ids),
            rooms: None,
            connection_ids: None,
            user_metadata: None,
            custom_filter: None,
        }
    }

    /// Create filter for specific rooms
    pub fn rooms(rooms: alloc::vec::Vec<alloc::string::String>) -> Self {
        Self {
            user_ids: None,
            rooms: Some(rooms),
            connection_ids: None,
            user_metadata: None,
            custom_filter: None,
        }
    }

    /// Check if connection matches filter
    pub fn matches(&self, conn: &ConnectionInfo) -> bool {
        // Check user IDs
        if let Some(user_ids) = &self.user_ids {
            if let Some(user_id) = &conn.user_id {
                if !user_ids.contains(user_id) {
                    return false;
                }
            } else {
                return false;
            }
        }

        // Check connection IDs
        if let Some(conn_ids) = &self.connection_ids {
            if !conn_ids.contains(&conn.id) {
                return false;
            }
        }

        // Check rooms (stored in metadata)
        if let Some(rooms) = &self.rooms {
            if let Some(conn_rooms) = conn.get_metadata("rooms") {
                let conn_rooms: alloc::vec::Vec<&str> = conn_rooms.split(',').map(|s| s.trim()).collect();
                if !rooms.iter().any(|r| conn_rooms.contains(&r.as_str())) {
                    return false;
                }
            } else {
                return false;
            }
        }

        // Check custom filter
        if let Some(filter) = &self.custom_filter {
            if !filter(conn) {
                return false;
            }
        }

        true
    }
}

/// WebSocket statistics
#[derive(Debug, Clone, Default)]
pub struct WebSocketStats {
    /// Total connections
    pub total_connections: u64,
    /// Active connections
    pub active_connections: usize,
    /// Total messages sent
    pub messages_sent: u64,
    /// Total messages received
    pub messages_received: u64,
    /// Total bytes sent
    pub bytes_sent: u64,
    /// Total bytes received
    pub bytes_received: u64,
    /// Connection errors
    pub connection_errors: u64,
    /// Message errors
    pub message_errors: u64,
    /// Authentication failures
    pub auth_failures: u64,
    /// Rate limit hits
    pub rate_limit_hits: u64,
    /// Uptime in seconds
    pub uptime_seconds: u64,
    /// Peak connections
    pub peak_connections: usize,
    /// Average message size
    pub avg_message_size: f64,
    /// Messages per second
    pub messages_per_second: f64,
}

impl WebSocketStats {
    /// Update statistics with new connection
    pub fn record_connection(&mut self) {
        self.total_connections += 1;
        self.active_connections += 1;
        if self.active_connections > self.peak_connections {
            self.peak_connections = self.active_connections;
        }
    }

    /// Update statistics with connection close
    pub fn record_disconnection(&mut self) {
        if self.active_connections > 0 {
            self.active_connections -= 1;
        }
    }

    /// Update statistics with message
    pub fn record_message(&mut self, sent: bool, size: usize) {
        if sent {
            self.messages_sent += 1;
            self.bytes_sent += size as u64;
        } else {
            self.messages_received += 1;
            self.bytes_received += size as u64;
        }

        // Update average message size
        let total_messages = self.messages_sent + self.messages_received;
        let total_bytes = self.bytes_sent + self.bytes_received;
        if total_messages > 0 {
            self.avg_message_size = total_bytes as f64 / total_messages as f64;
        }
    }

    /// Record error
    pub fn record_error(&mut self, error_type: ErrorType) {
        match error_type {
            ErrorType::Connection => self.connection_errors += 1,
            ErrorType::Message => self.message_errors += 1,
            ErrorType::Authentication => self.auth_failures += 1,
            ErrorType::RateLimit => self.rate_limit_hits += 1,
        }
    }

    /// Calculate messages per second
    pub fn calculate_mps(&mut self) {
        if self.uptime_seconds > 0 {
            let total_messages = self.messages_sent + self.messages_received;
            self.messages_per_second = total_messages as f64 / self.uptime_seconds as f64;
        }
    }
}

/// Error types for statistics
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ErrorType {
    /// Connection error
    Connection,
    /// Message error
    Message,
    /// Authentication error
    Authentication,
    /// Rate limit error
    RateLimit,
}

/// Get current timestamp (simplified)
fn current_timestamp() -> u64 {
    0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_websocket_config_default() {
        let config = WebSocketConfig::default();
        assert_eq!(config.bind_addr.port(), DEFAULT_WEBSOCKET_PORT);
        assert_eq!(config.max_connections, DEFAULT_MAX_CONNECTIONS);
        assert_eq!(config.message_timeout, Duration::from_secs(DEFAULT_MESSAGE_TIMEOUT));
        assert_eq!(config.heartbeat_interval, Duration::from_secs(DEFAULT_HEARTBEAT_INTERVAL));
    }

    #[test]
    fn test_message_creation() {
        let text_msg = Message::text("Hello, WebSocket!");
        assert_eq!(text_msg.message_type, MessageType::Text);
        assert!(!text_msg.id.is_empty());
        assert_eq!(text_msg.as_text(), Some("Hello, WebSocket!"));

        let binary_msg = Message::binary(vec![1, 2, 3, 4]);
        assert_eq!(binary_msg.message_type, MessageType::Binary);
        assert_eq!(binary_msg.payload, vec![1, 2, 3, 4]);
    }

    #[test]
    fn test_message_with_headers() {
        let msg = Message::text("test")
            .with_header("content-type", "application/json")
            .with_target("room-123")
            .with_connection_id("conn-456");

        assert_eq!(msg.headers.get("content-type"), Some(&"application/json".into()));
        assert_eq!(msg.target, Some("room-123".into()));
        assert_eq!(msg.connection_id, "conn-456");
    }

    #[test]
    fn test_connection_info() {
        let mut conn = ConnectionInfo::new("127.0.0.1:8080");
        assert!(!conn.id.is_empty());
        assert_eq!(conn.remote_addr, "127.0.0.1:8080");
        assert_eq!(conn.state, ConnectionState::Connecting);

        conn.set_user_id("user123");
        conn.set_state(ConnectionState::Authenticated);
        conn.update_last_message();
        conn.add_bytes_sent(1024);

        assert_eq!(conn.user_id, Some("user123".into()));
        assert_eq!(conn.state, ConnectionState::Authenticated);
        assert_eq!(conn.message_count, 1);
        assert_eq!(conn.bytes_sent, 1024);
        assert!(conn.is_active());
    }

    #[test]
    fn test_broadcast_filter() {
        let filter = BroadcastFilter::users(vec!["user1".into(), "user2".into()]);

        let mut conn1 = ConnectionInfo::new("127.0.0.1:8080");
        conn1.set_user_id("user1");

        let mut conn2 = ConnectionInfo::new("127.0.0.1:8081");
        conn2.set_user_id("user3");

        assert!(filter.matches(&conn1)); // user1 matches
        assert!(!filter.matches(&conn2)); // user3 doesn't match
    }

    #[test]
    fn test_websocket_stats() {
        let mut stats = WebSocketStats::default();

        stats.record_connection();
        stats.record_message(true, 100); // sent
        stats.record_message(false, 50); // received
        stats.record_error(ErrorType::Connection);

        assert_eq!(stats.total_connections, 1);
        assert_eq!(stats.active_connections, 1);
        assert_eq!(stats.messages_sent, 1);
        assert_eq!(stats.messages_received, 1);
        assert_eq!(stats.bytes_sent, 100);
        assert_eq!(stats.bytes_received, 50);
        assert_eq!(stats.connection_errors, 1);
        assert_eq!(stats.avg_message_size, 75.0); // (100 + 50) / 2
    }

    #[test]
    fn test_auth_config_default() {
        let config = AuthConfig::default();
        assert_eq!(config.method, AuthMethod::None);
        assert_eq!(config.api_key_header, "X-API-Key");
        assert!(config.required_claims.is_empty());
    }

    #[test]
    fn test_rate_limit_config_default() {
        let config = RateLimitConfig::default();
        assert_eq!(config.messages_per_second, DEFAULT_RATE_LIMIT_MESSAGES);
        assert_eq!(config.burst_size, 20);
        assert_eq!(config.time_window_seconds, 60);
        assert!(!config.distributed);
    }

    #[test]
    fn test_pubsub_config_default() {
        let config = PubSubConfig::default();
        assert_eq!(config.redis_url, "redis://localhost:6379");
        assert!(!config.cluster_mode);
        assert_eq!(config.key_prefix, "websocket:pubsub:");
        assert_eq!(config.max_subscriptions_per_connection, 100);
    }

    #[test]
    fn test_cluster_config_default() {
        let config = ClusterConfig::default();
        assert!(!config.node_id.is_empty());
        assert_eq!(config.heartbeat_interval, Duration::from_secs(10));
        assert_eq!(config.reconnect_delay, Duration::from_secs(DEFAULT_CLUSTER_RECONNECT_DELAY));
        assert!(config.enable_failover);
        assert_eq!(config.max_failed_heartbeats, 3);
    }

    #[test]
    fn test_monitoring_config_default() {
        let config = MonitoringConfig::default();
        assert!(config.enabled);
        assert_eq!(config.collection_interval, Duration::from_secs(10));
        assert!(config.detailed_connection_metrics);
        assert!(config.message_throughput_metrics);
        assert!(config.error_tracking);
    }
}
