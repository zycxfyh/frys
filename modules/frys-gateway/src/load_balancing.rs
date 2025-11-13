//! Load balancing algorithms and strategies

use crate::*;
use std::collections::HashMap;
use std::hash::{Hash, Hasher};
use std::sync::atomic::{AtomicUsize, Ordering};

/// Load balancer trait
#[async_trait::async_trait(?Send)]
pub trait LoadBalancer: Send + Sync {
    /// Select an upstream for the request
    async fn select_upstream(&self, req: &Request, upstreams: &[Upstream]) -> Result<&Upstream>;

    /// Report request completion for learning-based algorithms
    async fn report_completion(&self, upstream: &Upstream, latency_ms: u64, success: bool) {
        // Default implementation does nothing
        // Learning-based algorithms can override this
    }

    /// Get load balancer statistics
    fn stats(&self) -> LoadBalancerStats {
        LoadBalancerStats::default()
    }
}

/// Load balancer statistics
#[derive(Debug, Clone, Default)]
pub struct LoadBalancerStats {
    /// Total requests processed
    pub total_requests: u64,
    /// Requests per upstream
    pub requests_per_upstream: HashMap<alloc::string::String, u64>,
    /// Current upstream loads
    pub current_loads: HashMap<alloc::string::String, f64>,
    /// Upstream health status
    pub upstream_health: HashMap<alloc::string::String, bool>,
}

/// Round-robin load balancer
#[derive(Debug)]
pub struct RoundRobinBalancer {
    index: AtomicUsize,
}

impl RoundRobinBalancer {
    /// Create a new round-robin balancer
    pub fn new() -> Self {
        Self {
            index: AtomicUsize::new(0),
        }
    }
}

#[async_trait::async_trait(?Send)]
impl LoadBalancer for RoundRobinBalancer {
    async fn select_upstream(&self, _req: &Request, upstreams: &[Upstream]) -> Result<&Upstream> {
        if upstreams.is_empty() {
            return Err(GatewayError::LoadBalancerError {
                lb_type: "RoundRobin".into(),
                reason: "no upstreams available".into(),
            });
        }

        let index = self.index.fetch_add(1, Ordering::Relaxed) % upstreams.len();
        Ok(&upstreams[index])
    }

    fn stats(&self) -> LoadBalancerStats {
        LoadBalancerStats {
            total_requests: self.index.load(Ordering::Relaxed) as u64,
            ..Default::default()
        }
    }
}

/// Weighted round-robin load balancer
#[derive(Debug)]
pub struct WeightedRoundRobinBalancer {
    current_weights: std::sync::Mutex<HashMap<alloc::string::String, i64>>,
    max_weight: u32,
}

impl WeightedRoundRobinBalancer {
    /// Create a new weighted round-robin balancer
    pub fn new() -> Self {
        Self {
            current_weights: std::sync::Mutex::new(HashMap::new()),
            max_weight: 0,
        }
    }

    /// Initialize weights for upstreams
    pub fn with_upstreams(&mut self, upstreams: &[Upstream]) -> &mut Self {
        let mut weights = self.current_weights.lock().unwrap();
        self.max_weight = upstreams.iter().map(|u| u.weight).max().unwrap_or(1);
        for upstream in upstreams {
            weights.insert(upstream.url.to_string(), -(upstream.weight as i64));
        }
        self
    }
}

#[async_trait::async_trait(?Send)]
impl LoadBalancer for WeightedRoundRobinBalancer {
    async fn select_upstream(&self, _req: &Request, upstreams: &[Upstream]) -> Result<&Upstream> {
        if upstreams.is_empty() {
            return Err(GatewayError::LoadBalancerError {
                lb_type: "WeightedRoundRobin".into(),
                reason: "no upstreams available".into(),
            });
        }

        let mut weights = self.current_weights.lock().unwrap();

        // Find upstream with highest current weight
        let mut selected = None;
        let mut max_current_weight = i64::MIN;

        for upstream in upstreams {
            let url = upstream.url.to_string();
            let current_weight = weights.entry(url).or_insert(0);
            *current_weight += upstream.weight as i64;

            if *current_weight > max_current_weight {
                max_current_weight = *current_weight;
                selected = Some(upstream);
            }
        }

        if let Some(selected_upstream) = selected {
            let url = selected_upstream.url.to_string();
            if let Some(weight) = weights.get_mut(&url) {
                *weight -= self.max_weight as i64;
            }
            Ok(selected_upstream)
        } else {
            // Fallback to first upstream
            Ok(&upstreams[0])
        }
    }
}

/// Least loaded load balancer
#[derive(Debug)]
pub struct LeastLoadedBalancer {
    loads: std::sync::Mutex<HashMap<alloc::string::String, usize>>,
}

impl LeastLoadedBalancer {
    /// Create a new least loaded balancer
    pub fn new() -> Self {
        Self {
            loads: std::sync::Mutex::new(HashMap::new()),
        }
    }

    /// Update load for an upstream
    pub fn update_load(&self, upstream_url: &str, load: usize) {
        let mut loads = self.loads.lock().unwrap();
        loads.insert(upstream_url.to_string(), load);
    }

    /// Get current load for an upstream
    pub fn get_load(&self, upstream_url: &str) -> usize {
        let loads = self.loads.lock().unwrap();
        loads.get(upstream_url).copied().unwrap_or(0)
    }
}

#[async_trait::async_trait(?Send)]
impl LoadBalancer for LeastLoadedBalancer {
    async fn select_upstream(&self, _req: &Request, upstreams: &[Upstream]) -> Result<&Upstream> {
        if upstreams.is_empty() {
            return Err(GatewayError::LoadBalancerError {
                lb_type: "LeastLoaded".into(),
                reason: "no upstreams available".into(),
            });
        }

        let mut selected = &upstreams[0];
        let mut min_load = usize::MAX;

        for upstream in upstreams {
            let load = self.get_load(&upstream.url.to_string());
            if load < min_load {
                min_load = load;
                selected = upstream;
            }
        }

        Ok(selected)
    }

    async fn report_completion(&self, upstream: &Upstream, _latency_ms: u64, _success: bool) {
        // Update load based on active connections
        // This is a simplified implementation
        let current_load = self.get_load(&upstream.url.to_string());
        self.update_load(&upstream.url.to_string(), current_load.saturating_sub(1));
    }

    fn stats(&self) -> LoadBalancerStats {
        let loads = self.loads.lock().unwrap();
        LoadBalancerStats {
            current_loads: loads.iter()
                .map(|(url, load)| (url.clone(), *load as f64))
                .collect(),
            ..Default::default()
        }
    }
}

/// IP hash load balancer for session stickiness
#[derive(Debug)]
pub struct IpHashBalancer;

impl IpHashBalancer {
    /// Create a new IP hash balancer
    pub fn new() -> Self {
        Self
    }
}

#[async_trait::async_trait(?Send)]
impl LoadBalancer for IpHashBalancer {
    async fn select_upstream(&self, req: &Request, upstreams: &[Upstream]) -> Result<&Upstream> {
        if upstreams.is_empty() {
            return Err(GatewayError::LoadBalancerError {
                lb_type: "IpHash".into(),
                reason: "no upstreams available".into(),
            });
        }

        // Extract client IP from request
        let client_ip = self.extract_client_ip(req)?;

        // Hash IP to select upstream
        let hash = self.hash_ip(&client_ip);
        let index = hash % upstreams.len();

        Ok(&upstreams[index])
    }
}

impl IpHashBalancer {
    /// Extract client IP from request
    fn extract_client_ip(&self, req: &Request) -> Result<alloc::string::String> {
        // Try X-Forwarded-For header first
        if let Some(x_forwarded_for) = req.headers.get("x-forwarded-for") {
            if let Ok(value) = x_forwarded_for.to_str() {
                // Take first IP in case of multiple
                if let Some(first_ip) = value.split(',').next() {
                    return Ok(first_ip.trim().to_string());
                }
            }
        }

        // Try X-Real-IP header
        if let Some(x_real_ip) = req.headers.get("x-real-ip") {
            if let Ok(value) = x_real_ip.to_str() {
                return Ok(value.to_string());
            }
        }

        // Try X-Client-IP header
        if let Some(x_client_ip) = req.headers.get("x-client-ip") {
            if let Ok(value) = x_client_ip.to_str() {
                return Ok(value.to_string());
            }
        }

        // Fallback to remote address (would need to be passed in request context)
        Err(GatewayError::LoadBalancerError {
            lb_type: "IpHash".into(),
            reason: "could not extract client IP".into(),
        })
    }

    /// Hash IP address to get consistent upstream selection
    fn hash_ip(&self, ip: &str) -> usize {
        use std::collections::hash_map::DefaultHasher;
        let mut hasher = DefaultHasher::new();
        ip.hash(&mut hasher);
        hasher.finish() as usize
    }
}

/// Random load balancer
#[derive(Debug)]
pub struct RandomBalancer {
    rng: std::sync::Mutex<rand::rngs::ThreadRng>,
}

impl RandomBalancer {
    /// Create a new random balancer
    pub fn new() -> Self {
        Self {
            rng: std::sync::Mutex::new(rand::thread_rng()),
        }
    }
}

#[async_trait::async_trait(?Send)]
impl LoadBalancer for RandomBalancer {
    async fn select_upstream(&self, _req: &Request, upstreams: &[Upstream]) -> Result<&Upstream> {
        if upstreams.is_empty() {
            return Err(GatewayError::LoadBalancerError {
                lb_type: "Random".into(),
                reason: "no upstreams available".into(),
            });
        }

        let mut rng = self.rng.lock().unwrap();
        let index = rand::Rng::gen_range(&mut *rng, 0..upstreams.len());
        Ok(&upstreams[index])
    }
}

/// Least response time load balancer (learning-based)
#[derive(Debug)]
pub struct LeastResponseTimeBalancer {
    response_times: std::sync::Mutex<HashMap<alloc::string::String, Vec<u64>>>,
    max_samples: usize,
}

impl LeastResponseTimeBalancer {
    /// Create a new least response time balancer
    pub fn new(max_samples: usize) -> Self {
        Self {
            response_times: std::sync::Mutex::new(HashMap::new()),
            max_samples,
        }
    }
}

#[async_trait::async_trait(?Send)]
impl LoadBalancer for LeastResponseTimeBalancer {
    async fn select_upstream(&self, _req: &Request, upstreams: &[Upstream]) -> Result<&Upstream> {
        if upstreams.is_empty() {
            return Err(GatewayError::LoadBalancerError {
                lb_type: "LeastResponseTime".into(),
                reason: "no upstreams available".into(),
            });
        }

        let response_times = self.response_times.lock().unwrap();

        let mut selected = &upstreams[0];
        let mut min_avg_time = u64::MAX;

        for upstream in upstreams {
            let url = upstream.url.to_string();
            let avg_time = if let Some(times) = response_times.get(&url) {
                if times.is_empty() {
                    0
                } else {
                    times.iter().sum::<u64>() / times.len() as u64
                }
            } else {
                0
            };

            if avg_time < min_avg_time {
                min_avg_time = avg_time;
                selected = upstream;
            }
        }

        Ok(selected)
    }

    async fn report_completion(&self, upstream: &Upstream, latency_ms: u64, success: bool) {
        if !success {
            return; // Don't learn from failed requests
        }

        let mut response_times = self.response_times.lock().unwrap();
        let url = upstream.url.to_string();

        let times = response_times.entry(url).or_insert_with(Vec::new);
        times.push(latency_ms);

        // Keep only recent samples
        if times.len() > self.max_samples {
            times.remove(0);
        }
    }

    fn stats(&self) -> LoadBalancerStats {
        let response_times = self.response_times.lock().unwrap();
        let mut current_loads = HashMap::new();

        for (url, times) in response_times.iter() {
            if !times.is_empty() {
                let avg_time = times.iter().sum::<u64>() as f64 / times.len() as f64;
                current_loads.insert(url.clone(), avg_time);
            }
        }

        LoadBalancerStats {
            current_loads,
            ..Default::default()
        }
    }
}

/// Load balancer factory
#[derive(Debug)]
pub struct LoadBalancerFactory;

impl LoadBalancerFactory {
    /// Create a load balancer based on type
    pub fn create(lb_type: &LoadBalancerType) -> Box<dyn LoadBalancer> {
        match lb_type {
            LoadBalancerType::RoundRobin => Box::new(RoundRobinBalancer::new()),
            LoadBalancerType::WeightedRoundRobin => Box::new(WeightedRoundRobinBalancer::new()),
            LoadBalancerType::LeastLoaded => Box::new(LeastLoadedBalancer::new()),
            LoadBalancerType::IpHash => Box::new(IpHashBalancer::new()),
            LoadBalancerType::Random => Box::new(RandomBalancer::new()),
            LoadBalancerType::Custom => {
                // For custom load balancers, you'd need a registry
                // For now, fallback to round-robin
                Box::new(RoundRobinBalancer::new())
            }
        }
    }

    /// Create a least response time balancer with custom configuration
    pub fn create_least_response_time(max_samples: usize) -> Box<dyn LoadBalancer> {
        Box::new(LeastResponseTimeBalancer::new(max_samples))
    }
}

/// Upstream health tracker
#[derive(Debug)]
pub struct UpstreamHealthTracker {
    health_status: std::sync::Mutex<HashMap<alloc::string::String, UpstreamHealth>>,
}

#[derive(Debug, Clone)]
struct UpstreamHealth {
    healthy: bool,
    consecutive_failures: u32,
    last_check: u64,
    last_success: u64,
    last_failure: u64,
}

impl UpstreamHealthTracker {
    /// Create a new health tracker
    pub fn new() -> Self {
        Self {
            health_status: std::sync::Mutex::new(HashMap::new()),
        }
    }

    /// Check if upstream is healthy
    pub fn is_healthy(&self, upstream_url: &str) -> bool {
        let health_status = self.health_status.lock().unwrap();
        health_status.get(upstream_url)
            .map(|h| h.healthy)
            .unwrap_or(true) // Default to healthy for new upstreams
    }

    /// Report successful request
    pub fn report_success(&self, upstream_url: &str) {
        let mut health_status = self.health_status.lock().unwrap();
        let health = health_status.entry(upstream_url.to_string())
            .or_insert(UpstreamHealth {
                healthy: true,
                consecutive_failures: 0,
                last_check: current_timestamp(),
                last_success: current_timestamp(),
                last_failure: 0,
            });

        health.consecutive_failures = 0;
        health.last_success = current_timestamp();
        health.last_check = current_timestamp();
    }

    /// Report failed request
    pub fn report_failure(&self, upstream_url: &str, failure_threshold: u32) {
        let mut health_status = self.health_status.lock().unwrap();
        let health = health_status.entry(upstream_url.to_string())
            .or_insert(UpstreamHealth {
                healthy: true,
                consecutive_failures: 0,
                last_check: current_timestamp(),
                last_success: 0,
                last_failure: current_timestamp(),
            });

        health.consecutive_failures += 1;
        health.last_failure = current_timestamp();
        health.last_check = current_timestamp();

        if health.consecutive_failures >= failure_threshold {
            health.healthy = false;
        }
    }

    /// Mark upstream as healthy (after recovery)
    pub fn mark_healthy(&self, upstream_url: &str) {
        let mut health_status = self.health_status.lock().unwrap();
        if let Some(health) = health_status.get_mut(upstream_url) {
            health.healthy = true;
            health.consecutive_failures = 0;
            health.last_success = current_timestamp();
            health.last_check = current_timestamp();
        }
    }

    /// Get health statistics
    pub fn health_stats(&self) -> HashMap<alloc::string::String, bool> {
        let health_status = self.health_status.lock().unwrap();
        health_status.iter()
            .map(|(url, health)| (url.clone(), health.healthy))
            .collect()
    }
}

/// Get current timestamp (simplified)
fn current_timestamp() -> u64 {
    0
}

#[cfg(test)]
mod tests {
    use super::*;
    use hyper::{Body, Request};

    fn create_test_request() -> Request<Body> {
        Request::builder()
            .method("GET")
            .uri("http://example.com/test")
            .body(Body::empty())
            .unwrap()
    }

    fn create_test_upstreams() -> Vec<Upstream> {
        vec![
            Upstream {
                url: "http://service1:8080".parse().unwrap(),
                weight: 1,
                ..Default::default()
            },
            Upstream {
                url: "http://service2:8080".parse().unwrap(),
                weight: 2,
                ..Default::default()
            },
            Upstream {
                url: "http://service3:8080".parse().unwrap(),
                weight: 1,
                ..Default::default()
            },
        ]
    }

    #[tokio::test]
    async fn test_round_robin_balancer() {
        let balancer = RoundRobinBalancer::new();
        let upstreams = create_test_upstreams();
        let req = create_test_request();

        // Test multiple selections
        let selected1 = balancer.select_upstream(&req, &upstreams).await.unwrap();
        let selected2 = balancer.select_upstream(&req, &upstreams).await.unwrap();
        let selected3 = balancer.select_upstream(&req, &upstreams).await.unwrap();
        let selected4 = balancer.select_upstream(&req, &upstreams).await.unwrap();

        assert_eq!(selected1.url.to_string(), "http://service1:8080/");
        assert_eq!(selected2.url.to_string(), "http://service2:8080/");
        assert_eq!(selected3.url.to_string(), "http://service3:8080/");
        assert_eq!(selected4.url.to_string(), "http://service1:8080/"); // Round robin
    }

    #[tokio::test]
    async fn test_weighted_round_robin() {
        let mut balancer = WeightedRoundRobinBalancer::new();
        let upstreams = create_test_upstreams();
        balancer.with_upstreams(&upstreams);
        let req = create_test_request();

        // Service2 should be selected more often due to higher weight
        let mut service2_count = 0;
        for _ in 0..10 {
            let selected = balancer.select_upstream(&req, &upstreams).await.unwrap();
            if selected.url.to_string() == "http://service2:8080/" {
                service2_count += 1;
            }
        }

        // Service2 (weight 2) should be selected more than service1 and service3 (weight 1)
        assert!(service2_count > 2);
    }

    #[tokio::test]
    async fn test_least_loaded_balancer() {
        let balancer = LeastLoadedBalancer::new();
        let upstreams = create_test_upstreams();
        let req = create_test_request();

        // Set different loads
        balancer.update_load("http://service1:8080/", 10);
        balancer.update_load("http://service2:8080/", 5);
        balancer.update_load("http://service3:8080/", 15);

        let selected = balancer.select_upstream(&req, &upstreams).await.unwrap();
        assert_eq!(selected.url.to_string(), "http://service2:8080/"); // Lowest load
    }

    #[tokio::test]
    async fn test_ip_hash_balancer() {
        let balancer = IpHashBalancer::new();
        let upstreams = create_test_upstreams();

        // Create request with X-Forwarded-For header
        let req = Request::builder()
            .method("GET")
            .uri("http://example.com/test")
            .header("x-forwarded-for", "192.168.1.100")
            .body(Body::empty())
            .unwrap();

        let selected1 = balancer.select_upstream(&req, &upstreams).await.unwrap();
        let selected2 = balancer.select_upstream(&req, &upstreams).await.unwrap();

        // Same IP should select same upstream
        assert_eq!(selected1.url, selected2.url);
    }

    #[tokio::test]
    async fn test_random_balancer() {
        let balancer = RandomBalancer::new();
        let upstreams = create_test_upstreams();
        let req = create_test_request();

        let mut selections = std::collections::HashSet::new();
        for _ in 0..20 {
            let selected = balancer.select_upstream(&req, &upstreams).await.unwrap();
            selections.insert(selected.url.to_string());
        }

        // Should select different upstreams over time
        assert!(selections.len() > 1);
    }

    #[tokio::test]
    async fn test_least_response_time_balancer() {
        let balancer = LeastResponseTimeBalancer::new(10);
        let upstreams = create_test_upstreams();
        let req = create_test_request();

        // Report different response times
        balancer.report_completion(&upstreams[0], 100, true).await; // service1: 100ms
        balancer.report_completion(&upstreams[1], 50, true).await;  // service2: 50ms
        balancer.report_completion(&upstreams[2], 200, true).await; // service3: 200ms

        let selected = balancer.select_upstream(&req, &upstreams).await.unwrap();
        assert_eq!(selected.url.to_string(), "http://service2:8080/"); // Fastest response time
    }

    #[test]
    fn test_upstream_health_tracker() {
        let tracker = UpstreamHealthTracker::new();
        let upstream_url = "http://service1:8080/";

        // Initially healthy
        assert!(tracker.is_healthy(upstream_url));

        // Report failures
        for _ in 0..5 {
            tracker.report_failure(upstream_url, 3);
        }

        // Should be unhealthy after 3 failures
        assert!(!tracker.is_healthy(upstream_url));

        // Mark as healthy
        tracker.mark_healthy(upstream_url);
        assert!(tracker.is_healthy(upstream_url));

        // Report success
        tracker.report_success(upstream_url);
        assert!(tracker.is_healthy(upstream_url));
    }

    #[test]
    fn test_load_balancer_factory() {
        let rr_balancer = LoadBalancerFactory::create(&LoadBalancerType::RoundRobin);
        let wl_balancer = LoadBalancerFactory::create(&LoadBalancerType::LeastLoaded);
        let lrt_balancer = LoadBalancerFactory::create_least_response_time(100);

        // Just check that they can be created without panicking
        assert!(format!("{:?}", rr_balancer).contains("RoundRobinBalancer"));
        assert!(format!("{:?}", wl_balancer).contains("LeastLoadedBalancer"));
        assert!(format!("{:?}", lrt_balancer).contains("LeastResponseTimeBalancer"));
    }
}
