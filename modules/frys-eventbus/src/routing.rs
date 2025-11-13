//! Event routing and filtering system

use crate::*;

/// Filter expression types
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum FilterExpression {
    /// Match exact value
    Equal(alloc::string::String),
    /// Match any value in list
    In(alloc::vec::Vec<alloc::string::String>),
    /// Match range (for numeric values)
    Range { min: alloc::string::String, max: alloc::string::String },
    /// Regular expression match
    Regex(alloc::string::String),
    /// Check if field exists
    Exists,
    /// Logical NOT
    Not(Box<FilterExpression>),
    /// Logical AND
    And(alloc::vec::Vec<FilterExpression>),
    /// Logical OR
    Or(alloc::vec::Vec<FilterExpression>),
}

/// Advanced event filter
#[derive(Debug, Clone, Default)]
pub struct AdvancedFilter {
    /// Header filters
    pub header_filters: alloc::collections::BTreeMap<alloc::string::String, FilterExpression>,
    /// Payload filters (for structured data)
    pub payload_filters: alloc::collections::BTreeMap<alloc::string::String, FilterExpression>,
    /// Priority filter
    pub priority_filter: Option<Priority>,
    /// Time range filter
    pub time_range: Option<TimeRange>,
}

impl AdvancedFilter {
    /// Create a new filter
    pub fn new() -> Self {
        Self::default()
    }

    /// Add header filter
    pub fn with_header_filter(mut self, header: alloc::string::String, expr: FilterExpression) -> Self {
        self.header_filters.insert(header, expr);
        self
    }

    /// Add payload filter
    pub fn with_payload_filter(mut self, field: alloc::string::String, expr: FilterExpression) -> Self {
        self.payload_filters.insert(field, expr);
        self
    }

    /// Set priority filter
    pub fn with_priority(mut self, priority: Priority) -> Self {
        self.priority_filter = Some(priority);
        self
    }

    /// Set time range filter
    pub fn with_time_range(mut self, range: TimeRange) -> Self {
        self.time_range = Some(range);
        self
    }

    /// Check if event matches this filter
    pub fn matches(&self, event: &Event) -> bool {
        // Check priority filter
        if let Some(required_priority) = self.priority_filter {
            if event.priority != required_priority {
                return false;
            }
        }

        // Check time range filter
        if let Some(time_range) = &self.time_range {
            if !time_range.contains(event.timestamp) {
                return false;
            }
        }

        // Check header filters
        for (header_name, expr) in &self.header_filters {
            let header_value = match event.headers.get(header_name) {
                Some(value) => value,
                None => return false, // Header doesn't exist
            };

            if !self.evaluate_expression(expr, header_value) {
                return false;
            }
        }

        // Check payload filters (simplified - assumes JSON payload)
        for (field_name, expr) in &self.payload_filters {
            // In a real implementation, this would parse JSON payload
            // For now, we skip payload filtering
            let _ = (field_name, expr);
        }

        true
    }

    /// Evaluate a filter expression against a value
    fn evaluate_expression(&self, expr: &FilterExpression, value: &str) -> bool {
        match expr {
            FilterExpression::Equal(expected) => value == expected,
            FilterExpression::In(values) => values.contains(&value.into()),
            FilterExpression::Range { min, max } => {
                // Simple string comparison for now
                value >= min && value <= max
            }
            FilterExpression::Regex(pattern) => {
                // Simplified regex matching (would use regex crate in real implementation)
                self.simple_regex_match(pattern, value)
            }
            FilterExpression::Exists => !value.is_empty(),
            FilterExpression::Not(inner) => !self.evaluate_expression(inner, value),
            FilterExpression::And(expressions) => {
                expressions.iter().all(|e| self.evaluate_expression(e, value))
            }
            FilterExpression::Or(expressions) => {
                expressions.iter().any(|e| self.evaluate_expression(e, value))
            }
        }
    }

    /// Simple regex matching (placeholder - would use proper regex in real implementation)
    fn simple_regex_match(&self, pattern: &str, value: &str) -> bool {
        // Very basic wildcard matching
        if pattern.contains('*') {
            let prefix = pattern.split('*').next().unwrap_or("");
            let suffix = pattern.split('*').last().unwrap_or("");
            value.starts_with(prefix) && value.ends_with(suffix)
        } else {
            value.contains(pattern)
        }
    }
}

/// Time range for filtering events by timestamp
#[derive(Debug, Clone)]
pub struct TimeRange {
    /// Start time (inclusive)
    pub start: u64,
    /// End time (inclusive)
    pub end: u64,
}

impl TimeRange {
    /// Create a new time range
    pub fn new(start: u64, end: u64) -> Self {
        Self { start, end }
    }

    /// Check if timestamp is within range
    pub fn contains(&self, timestamp: u64) -> bool {
        timestamp >= self.start && timestamp <= self.end
    }
}

/// Topic pattern matcher with wildcard support
#[derive(Debug)]
pub struct TopicMatcher {
    /// Compiled patterns
    patterns: alloc::vec::Vec<TopicPattern>,
}

impl TopicMatcher {
    /// Create a new topic matcher
    pub fn new() -> Self {
        Self {
            patterns: alloc::vec::Vec::new(),
        }
    }

    /// Add a pattern to match
    pub fn add_pattern(&mut self, pattern: &str) -> Result<()> {
        let compiled = TopicPattern::compile(pattern)?;
        self.patterns.push(compiled);
        Ok(())
    }

    /// Check if topic matches any pattern
    pub fn matches(&self, topic: &str) -> bool {
        self.patterns.iter().any(|pattern| pattern.matches(topic))
    }

    /// Clear all patterns
    pub fn clear(&mut self) {
        self.patterns.clear();
    }
}

/// Compiled topic pattern
#[derive(Debug)]
struct TopicPattern {
    /// Pattern parts (split by dots)
    parts: alloc::vec::Vec<PatternPart>,
}

impl TopicPattern {
    /// Compile a topic pattern
    fn compile(pattern: &str) -> Result<Self> {
        if pattern.is_empty() {
            return Err(EventBusError::InvalidTopic {
                topic: pattern.into(),
                reason: "empty pattern",
            });
        }

        let parts: alloc::vec::Vec<PatternPart> = pattern
            .split('.')
            .map(|part| PatternPart::from_str(part))
            .collect();

        Ok(Self { parts })
    }

    /// Check if topic matches this pattern
    fn matches(&self, topic: &str) -> bool {
        let topic_parts: alloc::vec::Vec<&str> = topic.split('.').collect();

        if self.parts.len() != topic_parts.len() {
            return false;
        }

        for (pattern_part, topic_part) in self.parts.iter().zip(topic_parts.iter()) {
            if !pattern_part.matches(topic_part) {
                return false;
            }
        }

        true
    }
}

/// Pattern part for topic matching
#[derive(Debug)]
enum PatternPart {
    /// Exact match
    Literal(alloc::string::String),
    /// Single level wildcard (+)
    SingleLevel,
    /// Multi-level wildcard (#)
    MultiLevel,
}

impl PatternPart {
    /// Create pattern part from string
    fn from_str(s: &str) -> Self {
        match s {
            "+" => PatternPart::SingleLevel,
            "#" => PatternPart::MultiLevel,
            _ => PatternPart::Literal(s.into()),
        }
    }

    /// Check if this part matches a topic part
    fn matches(&self, topic_part: &str) -> bool {
        match self {
            PatternPart::Literal(literal) => literal == topic_part,
            PatternPart::SingleLevel => !topic_part.is_empty(),
            PatternPart::MultiLevel => true, // Multi-level matches everything from here
        }
    }
}

/// Routing table for efficient event routing
#[derive(Debug)]
pub struct RoutingTable {
    /// Topic to subscriber mapping
    topic_routes: alloc::collections::BTreeMap<alloc::string::String, alloc::vec::Vec<u64>>,
    /// Pattern routes for wildcard matching
    pattern_routes: alloc::vec::Vec<(TopicMatcher, alloc::vec::Vec<u64>)>,
}

impl RoutingTable {
    /// Create a new routing table
    pub fn new() -> Self {
        Self {
            topic_routes: alloc::collections::BTreeMap::new(),
            pattern_routes: alloc::vec::Vec::new(),
        }
    }

    /// Add route for exact topic
    pub fn add_exact_route(&mut self, topic: alloc::string::String, subscriber_id: u64) {
        self.topic_routes
            .entry(topic)
            .or_insert_with(alloc::vec::Vec::new)
            .push(subscriber_id);
    }

    /// Add route for pattern
    pub fn add_pattern_route(&mut self, pattern: &str, subscriber_id: u64) -> Result<()> {
        // Find existing pattern or create new one
        for (matcher, subscribers) in &mut self.pattern_routes {
            if matcher.patterns.len() == 1 {
                // Check if this pattern already exists
                // Simplified - in real implementation, we'd check pattern equality
                subscribers.push(subscriber_id);
                return Ok(());
            }
        }

        // Create new pattern matcher
        let mut matcher = TopicMatcher::new();
        matcher.add_pattern(pattern)?;
        self.pattern_routes.push((matcher, alloc::vec![subscriber_id]));

        Ok(())
    }

    /// Remove route
    pub fn remove_route(&mut self, topic_or_pattern: &str, subscriber_id: u64) {
        // Remove from exact routes
        if let Some(subscribers) = self.topic_routes.get_mut(topic_or_pattern) {
            subscribers.retain(|&id| id != subscriber_id);
            if subscribers.is_empty() {
                self.topic_routes.remove(topic_or_pattern);
            }
        }

        // Remove from pattern routes
        for (_, subscribers) in &mut self.pattern_routes {
            subscribers.retain(|&id| id != subscriber_id);
        }

        // Clean up empty pattern routes
        self.pattern_routes.retain(|(_, subscribers)| !subscribers.is_empty());
    }

    /// Find all subscribers for an event
    pub fn find_subscribers(&self, event: &Event) -> alloc::vec::Vec<u64> {
        let mut subscribers = alloc::vec::Vec::new();

        // Check exact topic matches
        if let Some(subs) = self.topic_routes.get(&event.topic) {
            subscribers.extend_from_slice(subs);
        }

        // Check pattern matches
        for (matcher, subs) in &self.pattern_routes {
            if matcher.matches(&event.topic) {
                subscribers.extend_from_slice(subs);
            }
        }

        // Remove duplicates while preserving order
        let mut seen = alloc::collections::BTreeSet::new();
        subscribers.retain(|&id| seen.insert(id));

        subscribers
    }

    /// Get statistics
    pub fn stats(&self) -> RoutingStats {
        RoutingStats {
            exact_routes: self.topic_routes.len(),
            pattern_routes: self.pattern_routes.len(),
            total_subscribers: self.topic_routes.values().map(|v| v.len()).sum::<usize>() +
                              self.pattern_routes.iter().map(|(_, v)| v.len()).sum::<usize>(),
        }
    }
}

/// Routing statistics
#[derive(Debug, Clone)]
pub struct RoutingStats {
    /// Number of exact topic routes
    pub exact_routes: usize,
    /// Number of pattern routes
    pub pattern_routes: usize,
    /// Total subscribers across all routes
    pub total_subscribers: usize,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_filter_expression() {
        let filter = AdvancedFilter::new()
            .with_header_filter("content-type".into(), FilterExpression::Equal("application/json".into()))
            .with_priority(Priority::High);

        let mut event = Event::new("test.topic".into(), b"data".to_vec())
            .with_priority(Priority::High);
        event.headers.set("content-type".into(), "application/json".into());

        assert!(filter.matches(&event));

        // Test non-matching priority
        event.priority = Priority::Low;
        assert!(!filter.matches(&event));
    }

    #[test]
    fn test_topic_matcher() {
        let mut matcher = TopicMatcher::new();
        matcher.add_pattern("user.*").unwrap();
        matcher.add_pattern("order.created").unwrap();

        assert!(matcher.matches("user.created"));
        assert!(matcher.matches("user.updated"));
        assert!(matcher.matches("order.created"));
        assert!(!matcher.matches("product.created"));
    }

    #[test]
    fn test_topic_pattern() {
        let pattern = TopicPattern::compile("user.*").unwrap();
        assert!(pattern.matches("user.created"));
        assert!(pattern.matches("user.updated"));
        assert!(!pattern.matches("order.created"));

        let exact_pattern = TopicPattern::compile("user.created").unwrap();
        assert!(exact_pattern.matches("user.created"));
        assert!(!exact_pattern.matches("user.updated"));
    }

    #[test]
    fn test_pattern_part() {
        let literal = PatternPart::from_str("user");
        assert!(literal.matches("user"));
        assert!(!literal.matches("order"));

        let single = PatternPart::from_str("+");
        assert!(single.matches("user"));
        assert!(single.matches("order"));
        assert!(!single.matches(""));

        let multi = PatternPart::from_str("#");
        assert!(multi.matches("user"));
        assert!(multi.matches("order.created"));
    }

    #[test]
    fn test_routing_table() {
        let mut table = RoutingTable::new();

        // Add exact route
        table.add_exact_route("user.created".into(), 1);
        table.add_exact_route("user.created".into(), 2);

        // Add pattern route
        table.add_pattern_route("order.*", 3).unwrap();

        // Test routing
        let event1 = Event::new("user.created".into(), b"data".to_vec());
        let subscribers1 = table.find_subscribers(&event1);
        assert_eq!(subscribers1.len(), 2);
        assert!(subscribers1.contains(&1));
        assert!(subscribers1.contains(&2));

        let event2 = Event::new("order.created".into(), b"data".to_vec());
        let subscribers2 = table.find_subscribers(&event2);
        assert_eq!(subscribers2.len(), 1);
        assert!(subscribers2.contains(&3));

        // Test stats
        let stats = table.stats();
        assert_eq!(stats.exact_routes, 1);
        assert_eq!(stats.pattern_routes, 1);
        assert_eq!(stats.total_subscribers, 3);
    }

    #[test]
    fn test_time_range() {
        let range = TimeRange::new(1000, 2000);

        assert!(range.contains(1000));
        assert!(range.contains(1500));
        assert!(range.contains(2000));
        assert!(!range.contains(500));
        assert!(!range.contains(2500));
    }
}
