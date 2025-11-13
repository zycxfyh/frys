//! Advanced routing system for the gateway

use crate::*;
use regex::Regex;
use std::collections::{HashMap, HashSet};

/// Router for matching requests to routes
#[derive(Debug)]
pub struct Router {
    /// Routes organized by priority
    routes: alloc::vec::Vec<Route>,
    /// Trie-based path matcher for fast lookups
    path_trie: PathTrie,
    /// Compiled regex cache for pattern matching
    regex_cache: HashMap<alloc::string::String, Regex>,
    /// Host-based routing map
    host_routes: HashMap<alloc::string::String, alloc::vec::Vec<usize>>,
}

impl Router {
    /// Create a new router
    pub fn new() -> Self {
        Self {
            routes: alloc::vec::Vec::new(),
            path_trie: PathTrie::new(),
            regex_cache: HashMap::new(),
            host_routes: HashMap::new(),
        }
    }

    /// Add a route to the router
    pub fn add_route(&mut self, route: Route) -> Result<()> {
        // Validate route
        self.validate_route(&route)?;

        // Compile regex patterns
        self.compile_route_patterns(&route)?;

        // Add to routes list
        let route_index = self.routes.len();
        self.routes.push(route);

        // Add to path trie for fast matching
        self.path_trie.insert(route_index, &self.routes[route_index])?;

        // Add to host routing if host is specified
        if let Some(host) = &self.routes[route_index].host {
            self.host_routes.entry(host.clone())
                .or_insert_with(alloc::vec::Vec::new)
                .push(route_index);
        }

        Ok(())
    }

    /// Find matching route for a request
    pub fn find_route(&self, request: &Request) -> Result<&Route> {
        // First, filter by host if specified
        let candidate_routes = if let Some(host) = request.headers.get("host") {
            self.host_routes.get(host)
                .map(|indices| indices.iter().map(|&i| &self.routes[i]).collect::<alloc::vec::Vec<_>>())
                .unwrap_or_else(|| self.routes.iter().collect())
        } else {
            self.routes.iter().collect()
        };

        // Find matching routes
        let mut matches = alloc::vec::Vec::new();

        for route in candidate_routes {
            if self.route_matches_request(route, request)? {
                matches.push(route);
            }
        }

        // Sort by priority (higher priority first)
        matches.sort_by(|a, b| b.priority.cmp(&a.priority));

        // Return highest priority match
        matches.first()
            .copied()
            .ok_or_else(|| GatewayError::RouteNotFound {
                path: request.uri.path().to_string(),
                method: request.method.to_string(),
            })
    }

    /// Extract path parameters from matched route
    pub fn extract_path_params(&self, route: &Route, path: &str) -> Result<HashMap<alloc::string::String, alloc::string::String>> {
        let mut params = HashMap::new();

        // Split path and pattern
        let path_segments: alloc::vec::Vec<&str> = path.trim_start_matches('/').split('/').collect();
        let pattern_segments: alloc::vec::Vec<&str> = route.path.trim_start_matches('/').split('/').collect();

        if path_segments.len() != pattern_segments.len() {
            return Ok(params); // Length mismatch, no params to extract
        }

        for (pattern_segment, path_segment) in pattern_segments.iter().zip(path_segments.iter()) {
            if pattern_segment.starts_with('{') && pattern_segment.ends_with('}') {
                // This is a parameter
                let param_name = &pattern_segment[1..pattern_segment.len() - 1];
                params.insert(param_name.to_string(), path_segment.to_string());
            }
        }

        Ok(params)
    }

    /// Validate route configuration
    fn validate_route(&self, route: &Route) -> Result<()> {
        // Validate route ID
        if route.id.is_empty() {
            return Err(GatewayError::ValidationError {
                field: "id".into(),
                rule: "not_empty".into(),
                value: route.id.clone(),
            });
        }

        // Validate path
        if route.path.is_empty() {
            return Err(GatewayError::ValidationError {
                field: "path".into(),
                rule: "not_empty".into(),
                value: route.path.clone(),
            });
        }

        // Validate methods
        if route.methods.is_empty() {
            return Err(GatewayError::ValidationError {
                field: "methods".into(),
                rule: "not_empty".into(),
                value: "empty array".into(),
            });
        }

        // Validate upstreams
        if route.upstreams.is_empty() {
            return Err(GatewayError::ValidationError {
                field: "upstreams".into(),
                rule: "not_empty".into(),
                value: "empty array".into(),
            });
        }

        // Validate path parameters
        for param in &route.path_params {
            if param.name.is_empty() {
                return Err(GatewayError::ValidationError {
                    field: "path_params.name".into(),
                    rule: "not_empty".into(),
                    value: param.name.clone(),
                });
            }

            // Validate regex pattern
            if Regex::new(&param.pattern).is_err() {
                return Err(GatewayError::ValidationError {
                    field: "path_params.pattern".into(),
                    rule: "valid_regex".into(),
                    value: param.pattern.clone(),
                });
            }
        }

        // Validate route conditions
        for condition in &route.conditions {
            self.validate_condition(condition)?;
        }

        Ok(())
    }

    /// Validate route condition
    fn validate_condition(&self, condition: &RouteCondition) -> Result<()> {
        match condition {
            RouteCondition::Header { name, operator, .. } => {
                if name.is_empty() {
                    return Err(GatewayError::ValidationError {
                        field: "condition.header.name".into(),
                        rule: "not_empty".into(),
                        value: name.clone(),
                    });
                }
                self.validate_operator(operator)?;
            }
            RouteCondition::Query { name, operator, .. } => {
                if name.is_empty() {
                    return Err(GatewayError::ValidationError {
                        field: "condition.query.name".into(),
                        rule: "not_empty".into(),
                        value: name.clone(),
                    });
                }
                self.validate_operator(operator)?;
            }
            RouteCondition::Body { path, operator, .. } => {
                if path.is_empty() {
                    return Err(GatewayError::ValidationError {
                        field: "condition.body.path".into(),
                        rule: "not_empty".into(),
                        value: path.clone(),
                    });
                }
                self.validate_operator(operator)?;
            }
            RouteCondition::Custom { name, .. } => {
                if name.is_empty() {
                    return Err(GatewayError::ValidationError {
                        field: "condition.custom.name".into(),
                        rule: "not_empty".into(),
                        value: name.clone(),
                    });
                }
            }
        }
        Ok(())
    }

    /// Validate condition operator
    fn validate_operator(&self, operator: &ConditionOperator) -> Result<()> {
        match operator {
            ConditionOperator::Regex => {
                // Regex operator is valid
            }
            _ => {
                // Other operators are valid
            }
        }
        Ok(())
    }

    /// Compile route patterns
    fn compile_route_patterns(&mut self, route: &Route) -> Result<()> {
        // Compile path parameter patterns
        for param in &route.path_params {
            if !self.regex_cache.contains_key(&param.pattern) {
                let regex = Regex::new(&param.pattern).map_err(|e| GatewayError::ValidationError {
                    field: "path_params.pattern".into(),
                    rule: "valid_regex".into(),
                    value: format!("{}: {}", param.pattern, e),
                })?;
                self.regex_cache.insert(param.pattern.clone(), regex);
            }
        }

        // Compile condition patterns
        for condition in &route.conditions {
            match condition {
                RouteCondition::Header { value, operator, .. } |
                RouteCondition::Query { value, operator, .. } => {
                    if *operator == ConditionOperator::Regex {
                        if !self.regex_cache.contains_key(value) {
                            let regex = Regex::new(value).map_err(|e| GatewayError::ValidationError {
                                field: "condition.value".into(),
                                rule: "valid_regex".into(),
                                value: format!("{}: {}", value, e),
                            })?;
                            self.regex_cache.insert(value.clone(), regex);
                        }
                    }
                }
                RouteCondition::Body { value, operator, .. } => {
                    if *operator == ConditionOperator::Regex {
                        if !self.regex_cache.contains_key(value) {
                            let regex = Regex::new(value).map_err(|e| GatewayError::ValidationError {
                                field: "condition.body.value".into(),
                                rule: "valid_regex".into(),
                                value: format!("{}: {}", value, e),
                            })?;
                            self.regex_cache.insert(value.clone(), regex);
                        }
                    }
                }
                _ => {}
            }
        }

        Ok(())
    }

    /// Check if route matches request
    fn route_matches_request(&self, route: &Route, request: &Request) -> Result<bool> {
        // Check method
        if !route.methods.contains(&request.method) {
            return Ok(false);
        }

        // Check path
        if !self.path_matches_pattern(&route.path, request.uri.path()) {
            return Ok(false);
        }

        // Check conditions
        for condition in &route.conditions {
            if !self.condition_matches_request(condition, request)? {
                return Ok(false);
            }
        }

        Ok(true)
    }

    /// Check if path matches pattern
    fn path_matches_pattern(&self, pattern: &str, path: &str) -> bool {
        // Exact match
        if pattern == path {
            return true;
        }

        // Wildcard matching
        if pattern.contains('*') {
            return self.matches_wildcard(pattern, path);
        }

        // Parameter matching
        if pattern.contains('{') {
            return self.matches_with_params(pattern, path);
        }

        false
    }

    /// Match path with wildcards
    fn matches_wildcard(&self, pattern: &str, path: &str) -> bool {
        let pattern = regex::escape(pattern).replace(r"\*", ".*");
        let regex = Regex::new(&format!("^{}$", pattern)).unwrap();
        regex.is_match(path)
    }

    /// Match path with parameters
    fn matches_with_params(&self, pattern: &str, path: &str) -> bool {
        let pattern_segments: alloc::vec::Vec<&str> = pattern.trim_start_matches('/').split('/').collect();
        let path_segments: alloc::vec::Vec<&str> = path.trim_start_matches('/').split('/').collect();

        if pattern_segments.len() != path_segments.len() {
            return false;
        }

        for (pattern_segment, path_segment) in pattern_segments.iter().zip(path_segments.iter()) {
            if pattern_segment.starts_with('{') && pattern_segment.ends_with('}') {
                // This is a parameter, check regex if specified
                let param_name = &pattern_segment[1..pattern_segment.len() - 1];
                if let Some(regex) = self.regex_cache.get(param_name) {
                    if !regex.is_match(path_segment) {
                        return false;
                    }
                }
                // If no regex specified, any value matches
            } else if pattern_segment != path_segment {
                return false;
            }
        }

        true
    }

    /// Check if condition matches request
    fn condition_matches_request(&self, condition: &RouteCondition, request: &Request) -> Result<bool> {
        match condition {
            RouteCondition::Header { name, value, operator } => {
                self.evaluate_condition(
                    &request.headers.get(name).map(|v| v.to_str().unwrap_or("")).unwrap_or(""),
                    value,
                    operator,
                )
            }
            RouteCondition::Query { name, value, operator } => {
                let query_value = request.uri.query()
                    .and_then(|q| url::form_urlencoded::parse(q.as_bytes())
                        .find(|(k, _)| k == name)
                        .map(|(_, v)| v.into_owned()))
                    .unwrap_or_default();
                self.evaluate_condition(&query_value, value, operator)
            }
            RouteCondition::Body { path, value, operator } => {
                // For body conditions, we'd need to parse the body
                // This is a simplified implementation
                let body_value = self.extract_body_value(request, path)?;
                self.evaluate_condition(&body_value, value, operator)
            }
            RouteCondition::Custom { name, params } => {
                // Custom conditions would be evaluated by custom logic
                // For now, return true
                Ok(true)
            }
        }
    }

    /// Evaluate condition value comparison
    fn evaluate_condition(&self, actual: &str, expected: &str, operator: &ConditionOperator) -> Result<bool> {
        match operator {
            ConditionOperator::Equal => Ok(actual == expected),
            ConditionOperator::EqualIgnoreCase => Ok(actual.to_lowercase() == expected.to_lowercase()),
            ConditionOperator::NotEqual => Ok(actual != expected),
            ConditionOperator::Contains => Ok(actual.contains(expected)),
            ConditionOperator::StartsWith => Ok(actual.starts_with(expected)),
            ConditionOperator::EndsWith => Ok(actual.ends_with(expected)),
            ConditionOperator::Regex => {
                if let Some(regex) = self.regex_cache.get(expected) {
                    Ok(regex.is_match(actual))
                } else {
                    Ok(false)
                }
            }
            ConditionOperator::GreaterThan => {
                // Numeric comparison
                match (actual.parse::<f64>(), expected.parse::<f64>()) {
                    (Ok(a), Ok(e)) => Ok(a > e),
                    _ => Ok(false),
                }
            }
            ConditionOperator::LessThan => {
                match (actual.parse::<f64>(), expected.parse::<f64>()) {
                    (Ok(a), Ok(e)) => Ok(a < e),
                    _ => Ok(false),
                }
            }
            ConditionOperator::In => {
                let values: HashSet<&str> = expected.split(',').map(|s| s.trim()).collect();
                Ok(values.contains(actual))
            }
        }
    }

    /// Extract value from request body (simplified)
    fn extract_body_value(&self, request: &Request, path: &str) -> Result<alloc::string::String> {
        // In a real implementation, this would parse JSON/XML and extract values
        // For now, return empty string
        Ok(alloc::string::String::new())
    }
}

/// Trie-based path matching for fast route lookup
#[derive(Debug)]
struct PathTrie {
    root: TrieNode,
}

#[derive(Debug)]
struct TrieNode {
    children: HashMap<alloc::string::String, TrieNode>,
    route_indices: alloc::vec::Vec<usize>,
    is_endpoint: bool,
}

impl PathTrie {
    fn new() -> Self {
        Self {
            root: TrieNode {
                children: HashMap::new(),
                route_indices: alloc::vec::Vec::new(),
                is_endpoint: false,
            },
        }
    }

    fn insert(&mut self, route_index: usize, route: &Route) -> Result<()> {
        let segments: alloc::vec::Vec<&str> = route.path.trim_start_matches('/').split('/').collect();
        self.root.insert_segments(&segments, route_index);
        Ok(())
    }

    fn find(&self, path: &str) -> alloc::vec::Vec<usize> {
        let segments: alloc::vec::Vec<&str> = path.trim_start_matches('/').split('/').collect();
        self.root.find_segments(&segments)
    }
}

impl TrieNode {
    fn insert_segments(&mut self, segments: &[&str], route_index: usize) {
        if segments.is_empty() {
            self.is_endpoint = true;
            if !self.route_indices.contains(&route_index) {
                self.route_indices.push(route_index);
            }
            return;
        }

        let segment = segments[0];
        let remaining = &segments[1..];

        // Handle wildcards and parameters
        let key = if segment.contains('*') || segment.contains('{') {
            "*".to_string() // Use * for all parameterized/wildcard segments
        } else {
            segment.to_string()
        };

        self.children.entry(key)
            .or_insert_with(|| TrieNode {
                children: HashMap::new(),
                route_indices: alloc::vec::Vec::new(),
                is_endpoint: false,
            })
            .insert_segments(remaining, route_index);
    }

    fn find_segments(&self, segments: &[&str]) -> alloc::vec::Vec<usize> {
        let mut result = alloc::vec::Vec::new();

        if segments.is_empty() {
            if self.is_endpoint {
                result.extend(&self.route_indices);
            }
            return result;
        }

        let segment = segments[0];
        let remaining = &segments[1..];

        // Try exact match first
        if let Some(child) = self.children.get(segment) {
            result.extend(child.find_segments(remaining));
        }

        // Try wildcard match
        if let Some(child) = self.children.get("*") {
            result.extend(child.find_segments(remaining));
        }

        result
    }
}

/// Route builder for fluent route construction
#[derive(Debug)]
pub struct RouteBuilder {
    route: Route,
}

impl RouteBuilder {
    /// Create a new route builder
    pub fn new(id: impl Into<alloc::string::String>) -> Self {
        Self {
            route: Route {
                id: id.into(),
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
            },
        }
    }

    /// Set route path
    pub fn path(mut self, path: impl Into<alloc::string::String>) -> Self {
        self.route.path = path.into();
        self
    }

    /// Add HTTP method
    pub fn method(mut self, method: Method) -> Self {
        self.route.methods.push(method);
        self
    }

    /// Add multiple methods
    pub fn methods(mut self, methods: alloc::vec::Vec<Method>) -> Self {
        self.route.methods.extend(methods);
        self
    }

    /// Set host header
    pub fn host(mut self, host: impl Into<alloc::string::String>) -> Self {
        self.route.host = Some(host.into());
        self
    }

    /// Add upstream service
    pub fn upstream(mut self, url: impl Into<alloc::string::String>, weight: u32) -> Result<Self> {
        let upstream = Upstream {
            url: url::Url::parse(&url.into()).map_err(|e| GatewayError::ConfigError {
                parameter: "upstream.url".into(),
                reason: format!("invalid URL: {}", e),
            })?,
            weight,
            ..Default::default()
        };
        self.route.upstreams.push(upstream);
        Ok(self)
    }

    /// Set load balancer type
    pub fn load_balancer(mut self, lb_type: LoadBalancerType) -> Self {
        self.route.load_balancer = lb_type;
        self
    }

    /// Add middleware
    pub fn middleware(mut self, middleware: Middleware) -> Self {
        self.route.middlewares.push(middleware);
        self
    }

    /// Add route condition
    pub fn condition(mut self, condition: RouteCondition) -> Self {
        self.route.conditions.push(condition);
        self
    }

    /// Add path parameter
    pub fn path_param(mut self, name: impl Into<alloc::string::String>, pattern: impl Into<alloc::string::String>) -> Self {
        self.route.path_params.push(PathParam {
            name: name.into(),
            pattern: pattern.into(),
        });
        self
    }

    /// Set protocol
    pub fn protocol(mut self, protocol: Protocol) -> Self {
        self.route.protocol = protocol;
        self
    }

    /// Set priority
    pub fn priority(mut self, priority: i32) -> Self {
        self.route.priority = priority;
        self
    }

    /// Build the route
    pub fn build(self) -> Route {
        self.route
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_route_builder() {
        let route = RouteBuilder::new("test-route")
            .path("/api/v1/users")
            .method(Method::GET)
            .method(Method::POST)
            .upstream("http://api:8080", 100)
            .unwrap()
            .load_balancer(LoadBalancerType::RoundRobin)
            .priority(10)
            .build();

        assert_eq!(route.id, "test-route");
        assert_eq!(route.path, "/api/v1/users");
        assert_eq!(route.methods.len(), 2);
        assert_eq!(route.upstreams.len(), 1);
        assert_eq!(route.priority, 10);
    }

    #[test]
    fn test_path_matching() {
        let router = Router::new();

        // Test exact match
        assert!(router.path_matches_pattern("/api/users", "/api/users"));
        assert!(!router.path_matches_pattern("/api/users", "/api/posts"));

        // Test wildcard
        assert!(router.path_matches_pattern("/api/*", "/api/users"));
        assert!(router.path_matches_pattern("/api/*", "/api/posts"));
        assert!(!router.path_matches_pattern("/api/*", "/admin/users"));

        // Test parameters
        assert!(router.path_matches_pattern("/api/{id}", "/api/123"));
        assert!(router.path_matches_pattern("/api/{id}/posts", "/api/123/posts"));
    }

    #[test]
    fn test_path_param_extraction() {
        let mut router = Router::new();

        let route = RouteBuilder::new("param-route")
            .path("/api/users/{id}")
            .method(Method::GET)
            .upstream("http://api:8080", 100)
            .unwrap()
            .build();

        router.add_route(route).unwrap();

        let params = router.extract_path_params(&router.routes[0], "/api/users/123").unwrap();
        assert_eq!(params.get("id"), Some(&"123".to_string()));
    }

    #[test]
    fn test_route_validation() {
        let router = Router::new();

        // Valid route
        let valid_route = RouteBuilder::new("valid")
            .path("/api/test")
            .method(Method::GET)
            .upstream("http://api:8080", 100)
            .unwrap()
            .build();

        assert!(router.validate_route(&valid_route).is_ok());

        // Invalid route - empty ID
        let invalid_route = Route {
            id: "".into(),
            path: "/api/test".into(),
            methods: vec![Method::GET],
            upstreams: vec![Upstream::default()],
            ..Default::default()
        };

        assert!(router.validate_route(&invalid_route).is_err());
    }

    #[test]
    fn test_condition_evaluation() {
        let router = Router::new();

        // Equal condition
        assert!(router.evaluate_condition("test", "test", &ConditionOperator::Equal).unwrap());

        // Contains condition
        assert!(router.evaluate_condition("hello world", "world", &ConditionOperator::Contains).unwrap());

        // Regex condition
        let mut router_with_regex = Router::new();
        router_with_regex.regex_cache.insert("^test.*".into(), Regex::new("^test.*").unwrap());
        assert!(router_with_regex.evaluate_condition("testing", "^test.*", &ConditionOperator::Regex).unwrap());
    }

    #[test]
    fn test_trie_operations() {
        let mut trie = PathTrie::new();

        // Insert routes
        let route1 = RouteBuilder::new("route1")
            .path("/api/users")
            .method(Method::GET)
            .upstream("http://api:8080", 100)
            .unwrap()
            .build();

        let route2 = RouteBuilder::new("route2")
            .path("/api/posts")
            .method(Method::GET)
            .upstream("http://api:8080", 100)
            .unwrap()
            .build();

        trie.insert(0, &route1).unwrap();
        trie.insert(1, &route2).unwrap();

        // Find routes
        let found1 = trie.find("/api/users");
        let found2 = trie.find("/api/posts");

        assert!(found1.contains(&0));
        assert!(found2.contains(&1));
        assert!(!found1.contains(&1));
    }
}
