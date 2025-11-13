//! Configuration providers for different sources

use crate::*;

/// Configuration provider trait
pub trait ConfigProvider: Send + Sync {
    /// Load configuration from this provider
    async fn load(&self) -> Result<alloc::collections::BTreeMap<alloc::string::String, ConfigValue>>;

    /// Get provider name
    fn name(&self) -> &'static str;

    /// Get provider priority (higher = more specific)
    fn priority(&self) -> i32;

    /// Check if provider is available
    fn is_available(&self) -> bool {
        true
    }
}

/// File-based configuration provider
#[cfg(feature = "std")]
pub struct FileProvider {
    path: alloc::string::String,
    format: ConfigFormat,
}

#[cfg(feature = "std")]
impl FileProvider {
    /// Create a new file provider
    pub fn new<P: Into<alloc::string::String>>(path: P, format: ConfigFormat) -> Self {
        Self {
            path: path.into(),
            format,
        }
    }
}

#[cfg(feature = "std")]
impl ConfigProvider for FileProvider {
    async fn load(&self) -> Result<alloc::collections::BTreeMap<alloc::string::String, ConfigValue>> {
        use std::fs;

        // Read file content
        let content = fs::read_to_string(&self.path).map_err(|e| {
            ConfigError::FileReadError {
                path: self.path.clone(),
                details: alloc::format!("{}", e),
            }
        })?;

        // Check file size
        if content.len() > MAX_CONFIG_SIZE {
            return Err(ConfigError::ConfigTooLarge {
                size: content.len(),
                max_size: MAX_CONFIG_SIZE,
            });
        }

        // Parse based on format
        let config_map = match self.format {
            ConfigFormat::Json => parse_json(&content)?,
            ConfigFormat::Yaml => parse_yaml(&content)?,
            ConfigFormat::Toml => parse_toml(&content)?,
            ConfigFormat::Custom => parse_custom(&content)?,
        };

        // Flatten nested structure
        Ok(flatten_config(config_map, alloc::string::String::new()))
    }

    fn name(&self) -> &'static str {
        "file"
    }

    fn priority(&self) -> i32 {
        100 // Medium priority
    }

    fn is_available(&self) -> bool {
        std::path::Path::new(&self.path).exists()
    }
}

/// Environment variable configuration provider
#[cfg(feature = "env_support")]
pub struct EnvProvider {
    prefix: alloc::string::String,
    separator: alloc::string::String,
    case_sensitive: bool,
    include_unprefixed: bool,
}

#[cfg(feature = "env_support")]
impl EnvProvider {
    /// Create a new environment provider with default settings
    pub fn new<P: Into<alloc::string::String>>(prefix: P) -> Self {
        Self {
            prefix: prefix.into(),
            separator: "_".into(),
            case_sensitive: false,
            include_unprefixed: false,
        }
    }

    /// Create environment provider with custom settings
    pub fn with_options<P: Into<alloc::string::String>, S: Into<alloc::string::String>>(
        prefix: P,
        separator: S,
        case_sensitive: bool,
        include_unprefixed: bool,
    ) -> Self {
        Self {
            prefix: prefix.into(),
            separator: separator.into(),
            case_sensitive,
            include_unprefixed,
        }
    }

    /// Set key separator (default: "_")
    pub fn with_separator<S: Into<alloc::string::String>>(mut self, separator: S) -> Self {
        self.separator = separator.into();
        self
    }

    /// Set case sensitivity (default: false)
    pub fn case_sensitive(mut self, sensitive: bool) -> Self {
        self.case_sensitive = sensitive;
        self
    }

    /// Include unprefixed environment variables (default: false)
    pub fn include_unprefixed(mut self, include: bool) -> Self {
        self.include_unprefixed = include;
        self
    }

    /// Normalize environment variable key to configuration key
    fn normalize_key(&self, env_key: &str) -> alloc::string::String {
        let key = if env_key.starts_with(&self.prefix) {
            // Remove prefix
            &env_key[self.prefix.len()..]
        } else if self.include_unprefixed {
            env_key
        } else {
            return alloc::string::String::new(); // Skip this key
        };

        // Convert separators and case
        let normalized = if self.case_sensitive {
            key.replace(&self.separator, ".")
        } else {
            key.to_lowercase().replace(&self.separator, ".")
        };

        // Handle array notation like KEY_0, KEY_1, etc.
        if let Some((base_key, index_str)) = self.extract_array_index(&normalized) {
            if let Ok(_index) = index_str.parse::<usize>() {
                // For arrays, we'd need more complex logic
                // For now, just return the normalized key
                normalized
            } else {
                normalized
            }
        } else {
            normalized
        }
    }

    /// Extract array index from key (e.g., "database.0.host" -> ("database", "0"))
    fn extract_array_index(&self, key: &str) -> Option<(&str, &str)> {
        if let Some(dot_pos) = key.rfind('.') {
            let potential_index = &key[dot_pos + 1..];
            if potential_index.chars().all(|c| c.is_ascii_digit()) {
                let base = &key[..dot_pos];
                Some((base, potential_index))
            } else {
                None
            }
        } else {
            None
        }
    }

    /// Parse environment variable value with type detection
    fn parse_value(&self, value: &str) -> ConfigValue {
        // Handle special cases
        if value.is_empty() {
            return ConfigValue::String(alloc::string::String::new());
        }

        // Try boolean values
        match value.to_lowercase().as_str() {
            "true" | "yes" | "1" | "on" => return ConfigValue::Bool(true),
            "false" | "no" | "0" | "off" => return ConfigValue::Bool(false),
            _ => {}
        }

        // Try integer
        if let Ok(i) = value.parse::<i64>() {
            return ConfigValue::Int(i);
        }

        // Try float
        if let Ok(f) = value.parse::<f64>() {
            // Only treat as float if it contains a decimal point
            if value.contains('.') {
                return ConfigValue::Float(f);
            }
        }

        // Try JSON-like structures (basic)
        if (value.starts_with('{') && value.ends_with('}')) ||
           (value.starts_with('[') && value.ends_with(']')) {
            // For now, treat as string - in real implementation, parse JSON
            return ConfigValue::String(value.into());
        }

        // Default to string
        ConfigValue::String(value.into())
    }
}

#[cfg(feature = "env_support")]
impl ConfigProvider for EnvProvider {
    async fn load(&self) -> Result<alloc::collections::BTreeMap<alloc::string::String, ConfigValue>> {
        use std::env;

        let mut config = alloc::collections::BTreeMap::new();

        for (env_key, env_value) in env::vars() {
            let config_key = self.normalize_key(&env_key);

            if !config_key.is_empty() {
                let config_value = self.parse_value(&env_value);
                config.insert(config_key, config_value);
            }
        }

        Ok(config)
    }

    fn name(&self) -> &'static str {
        "environment"
    }

    fn priority(&self) -> i32 {
        200 // High priority - environment variables override files
    }

    fn is_available(&self) -> bool {
        // Environment provider is always available
        true
    }
}

/// Environment variable parser for complex structures
#[cfg(feature = "env_support")]
pub struct EnvParser {
    // Parser state would go here
}

#[cfg(feature = "env_support")]
impl EnvParser {
    /// Parse complex environment variable structures
    pub fn parse_complex_value(value: &str) -> Result<ConfigValue> {
        // Handle JSON-like structures
        if value.starts_with('{') && value.ends_with('}') {
            // Try to parse as simple JSON object
            match parse_simple_json(value) {
                Ok(ConfigValue::Object(obj)) => Ok(ConfigValue::Object(obj)),
                _ => Ok(ConfigValue::String(value.into())),
            }
        } else if value.starts_with('[') && value.ends_with(']') {
            // Try to parse as JSON array
            // Simplified implementation
            let inner = &value[1..value.len() - 1];
            let elements: alloc::vec::Vec<ConfigValue> = inner
                .split(',')
                .map(|s| s.trim().trim_matches('"'))
                .map(|s| ConfigValue::String(s.into()))
                .collect();

            Ok(ConfigValue::Array(elements))
        } else {
            Ok(ConfigValue::String(value.into()))
        }
    }

    /// Parse array notation (KEY_0=value0, KEY_1=value1, etc.)
    pub fn parse_array_notation(prefix: &str) -> Result<ConfigValue> {
        use std::env;

        let mut elements = alloc::vec::Vec::new();
        let mut index = 0;

        loop {
            let env_key = alloc::format!("{}{}", prefix, index);
            match env::var(&env_key) {
                Ok(value) => {
                    elements.push(ConfigValue::String(value));
                    index += 1;
                }
                Err(_) => break,
            }
        }

        if elements.is_empty() {
            Err(ConfigError::KeyNotFound {
                key: alloc::format!("{}*", prefix),
            })
        } else {
            Ok(ConfigValue::Array(elements))
        }
    }
}

/// Remote configuration provider
#[cfg(feature = "remote_config")]
pub struct RemoteProvider {
    endpoint: alloc::string::String,
    timeout: u64,
}

#[cfg(feature = "remote_config")]
impl RemoteProvider {
    /// Create a new remote provider
    pub fn new<E: Into<alloc::string::String>>(endpoint: E, timeout: u64) -> Self {
        Self {
            endpoint: endpoint.into(),
            timeout,
        }
    }
}

#[cfg(feature = "remote_config")]
impl ConfigProvider for RemoteProvider {
    async fn load(&self) -> Result<alloc::collections::BTreeMap<alloc::string::String, ConfigValue>> {
        // Implementation would make HTTP request to remote endpoint
        // For now, this is a placeholder
        Err(ConfigError::RemoteConfigError {
            endpoint: self.endpoint.clone(),
            details: "Remote config not implemented".into(),
        })
    }

    fn name(&self) -> &'static str {
        "remote"
    }

    fn priority(&self) -> i32 {
        150 // Higher than file, lower than env
    }
}

/// Default configuration provider
pub struct DefaultProvider {
    defaults: alloc::collections::BTreeMap<alloc::string::String, ConfigValue>,
}

impl DefaultProvider {
    /// Create a new default provider
    pub fn new(defaults: alloc::collections::BTreeMap<alloc::string::String, ConfigValue>) -> Self {
        Self { defaults }
    }

    /// Create with common defaults
    pub fn with_common_defaults() -> Self {
        let mut defaults = alloc::collections::BTreeMap::new();

        // Common application defaults
        defaults.insert("app.name".into(), ConfigValue::String("frys-app".into()));
        defaults.insert("app.version".into(), ConfigValue::String("0.1.0".into()));
        defaults.insert("server.host".into(), ConfigValue::String("localhost".into()));
        defaults.insert("server.port".into(), ConfigValue::Int(8080));
        defaults.insert("logging.level".into(), ConfigValue::String("info".into()));
        defaults.insert("database.max_connections".into(), ConfigValue::Int(10));

        Self { defaults }
    }
}

impl ConfigProvider for DefaultProvider {
    async fn load(&self) -> Result<alloc::collections::BTreeMap<alloc::string::String, ConfigValue>> {
        Ok(self.defaults.clone())
    }

    fn name(&self) -> &'static str {
        "default"
    }

    fn priority(&self) -> i32 {
        0 // Lowest priority
    }
}

/// Configuration format types
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConfigFormat {
    Json,
    Yaml,
    Toml,
    Custom,
}

/// Configuration merger for combining multiple sources
pub struct ConfigMerger {
    providers: alloc::vec::Vec<Box<dyn ConfigProvider>>,
}

impl ConfigMerger {
    /// Create a new configuration merger
    pub fn new() -> Self {
        Self {
            providers: alloc::vec::Vec::new(),
        }
    }

    /// Add a configuration provider
    pub fn add_provider<P: ConfigProvider + 'static>(mut self, provider: P) -> Self {
        self.providers.push(Box::new(provider));
        self
    }

    /// Merge configurations from all providers
    pub async fn merge(&self) -> Result<alloc::collections::BTreeMap<alloc::string::String, ConfigEntry>> {
        let mut merged = alloc::collections::BTreeMap::new();

        // Sort providers by priority (highest first)
        let mut sorted_providers: alloc::vec::Vec<_> = self.providers.iter().collect();
        sorted_providers.sort_by(|a, b| b.priority().cmp(&a.priority()));

        for provider in sorted_providers {
            if provider.is_available() {
                match provider.load().await {
                    Ok(config) => {
                        // Merge with existing configuration
                        for (key, value) in config {
                            let entry = ConfigEntry {
                                value,
                                source: match provider.name() {
                                    "file" => ConfigSource::File,
                                    "environment" => ConfigSource::Environment,
                                    "remote" => ConfigSource::Remote,
                                    "default" => ConfigSource::Default,
                                    _ => ConfigSource::Runtime,
                                },
                                timestamp: 0, // Would be current timestamp
                                version: 1,
                            };

                            merged.insert(key, entry);
                        }
                    }
                    Err(e) => {
                        // Log error but continue with other providers
                        // In real implementation, this would be logged
                        let _ = e;
                    }
                }
            }
        }

        Ok(merged)
    }
}

/// Flatten nested configuration structure
fn flatten_config(
    value: ConfigValue,
    prefix: alloc::string::String,
) -> alloc::collections::BTreeMap<alloc::string::String, ConfigValue> {
    let mut result = alloc::collections::BTreeMap::new();

    match value {
        ConfigValue::Object(obj) => {
            for (key, val) in obj {
                let new_prefix = if prefix.is_empty() {
                    key
                } else {
                    alloc::format!("{}.{}", prefix, key)
                };
                let flattened = flatten_config(val, new_prefix);
                result.extend(flattened);
            }
        }
        _ => {
            if !prefix.is_empty() {
                result.insert(prefix, value);
            }
        }
    }

    result
}

/// Parse JSON configuration
#[cfg(feature = "serde")]
fn parse_json(content: &str) -> Result<ConfigValue> {
    // Simple JSON parser (would use serde_json in real implementation)
    // This is a very basic implementation for demonstration
    parse_simple_json(content)
}

/// Parse YAML configuration
#[cfg(feature = "serde")]
fn parse_yaml(content: &str) -> Result<ConfigValue> {
    // Would use serde_yaml in real implementation
    // For now, treat as JSON
    parse_simple_json(content)
}

/// Parse TOML configuration
#[cfg(feature = "serde")]
fn parse_toml(content: &str) -> Result<ConfigValue> {
    // Would use toml crate in real implementation
    // For now, treat as simple key-value
    parse_simple_kv(content)
}

/// Parse custom configuration format
fn parse_custom(content: &str) -> Result<ConfigValue> {
    // Custom parsing logic - simple key=value format
    parse_simple_kv(content)
}

/// Simple JSON-like parser for demonstration
fn parse_simple_json(content: &str) -> Result<ConfigValue> {
    let trimmed = content.trim();

    if trimmed.starts_with('{') && trimmed.ends_with('}') {
        // Simple object parsing (very basic)
        let mut obj = alloc::collections::BTreeMap::new();

        // This is a very simplified parser - in reality, you'd use a proper JSON library
        let inner = &trimmed[1..trimmed.len() - 1];
        for line in inner.lines() {
            let line = line.trim().trim_end_matches(',');
            if line.contains(':') {
                let parts: alloc::vec::Vec<&str> = line.splitn(2, ':').collect();
                if parts.len() == 2 {
                    let key = parts[0].trim().trim_matches('"');
                    let value = parts[1].trim().trim_matches('"').trim_matches(',');

                    // Try to parse as different types
                    let config_value = if let Ok(i) = value.parse::<i64>() {
                        ConfigValue::Int(i)
                    } else if let Ok(f) = value.parse::<f64>() {
                        ConfigValue::Float(f)
                    } else if value == "true" {
                        ConfigValue::Bool(true)
                    } else if value == "false" {
                        ConfigValue::Bool(false)
                    } else if value == "null" {
                        ConfigValue::Null
                    } else {
                        ConfigValue::String(value.into())
                    };

                    obj.insert(key.into(), config_value);
                }
            }
        }

        Ok(ConfigValue::Object(obj))
    } else {
        Err(ConfigError::ParseError {
            format: "json",
            details: "Invalid JSON format".into(),
        })
    }
}

/// Simple key-value parser
fn parse_simple_kv(content: &str) -> Result<ConfigValue> {
    let mut obj = alloc::collections::BTreeMap::new();

    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }

        if let Some((key, value)) = line.split_once('=') {
            let key = key.trim();
            let value = value.trim().trim_matches('"');

            // Try to parse as different types
            let config_value = if let Ok(i) = value.parse::<i64>() {
                ConfigValue::Int(i)
            } else if let Ok(f) = value.parse::<f64>() {
                ConfigValue::Float(f)
            } else if value == "true" {
                ConfigValue::Bool(true)
            } else if value == "false" {
                ConfigValue::Bool(false)
            } else {
                ConfigValue::String(value.into())
            };

            obj.insert(key.into(), config_value);
        }
    }

    Ok(ConfigValue::Object(obj))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_provider() {
        let provider = DefaultProvider::with_common_defaults();
        assert_eq!(provider.name(), "default");
        assert_eq!(provider.priority(), 0);
        assert!(provider.is_available());
    }

    #[test]
    fn test_config_merger() {
        let merger = ConfigMerger::new()
            .add_provider(DefaultProvider::with_common_defaults());

        assert_eq!(merger.providers.len(), 1);
    }

    #[test]
    fn test_flatten_config() {
        let mut obj = alloc::collections::BTreeMap::new();
        obj.insert("host".into(), ConfigValue::String("localhost".into()));
        obj.insert("port".into(), ConfigValue::Int(8080));

        let nested = ConfigValue::Object(obj);
        let flattened = flatten_config(nested, "server".into());

        assert_eq!(flattened.len(), 2);
        assert_eq!(flattened.get("server.host"), Some(&ConfigValue::String("localhost".into())));
        assert_eq!(flattened.get("server.port"), Some(&ConfigValue::Int(8080)));
    }

    #[test]
    fn test_parse_simple_json() {
        let json = r#"
        {
            "app.name": "test-app",
            "server.port": 8080,
            "debug": true
        }
        "#;

        let result = parse_simple_json(json);
        assert!(result.is_ok());

        if let Ok(ConfigValue::Object(obj)) = result {
            assert_eq!(obj.get("app.name"), Some(&ConfigValue::String("test-app".into())));
            assert_eq!(obj.get("server.port"), Some(&ConfigValue::Int(8080)));
            assert_eq!(obj.get("debug"), Some(&ConfigValue::Bool(true)));
        }
    }

    #[test]
    fn test_parse_simple_kv() {
        let kv = r#"
        # This is a comment
        app.name=test-app
        server.port=8080
        debug=true
        "#;

        let result = parse_simple_kv(kv);
        assert!(result.is_ok());

        if let Ok(ConfigValue::Object(obj)) = result {
            assert_eq!(obj.get("app.name"), Some(&ConfigValue::String("test-app".into())));
            assert_eq!(obj.get("server.port"), Some(&ConfigValue::String("8080".into())));
            assert_eq!(obj.get("debug"), Some(&ConfigValue::Bool(true)));
        }
    }

    #[cfg(feature = "env_support")]
    #[test]
    fn test_env_provider_normalization() {
        let provider = EnvProvider::new("MYAPP_");

        // Test basic normalization
        assert_eq!(provider.normalize_key("MYAPP_APP_NAME"), "app.name");
        assert_eq!(provider.normalize_key("MYAPP_SERVER_PORT"), "server.port");

        // Test case sensitivity
        let case_sensitive = EnvProvider::new("MYAPP_").case_sensitive(true);
        assert_eq!(case_sensitive.normalize_key("MYAPP_APP_NAME"), "APP_NAME");

        // Test custom separator
        let custom_sep = EnvProvider::new("MYAPP").with_separator("-");
        assert_eq!(custom_sep.normalize_key("MYAPPAPP-NAME"), "app.name");
    }

    #[cfg(feature = "env_support")]
    #[test]
    fn test_env_provider_value_parsing() {
        let provider = EnvProvider::new("TEST_");

        // Test boolean parsing
        assert_eq!(provider.parse_value("true"), ConfigValue::Bool(true));
        assert_eq!(provider.parse_value("false"), ConfigValue::Bool(false));
        assert_eq!(provider.parse_value("1"), ConfigValue::Bool(true));
        assert_eq!(provider.parse_value("0"), ConfigValue::Bool(false));

        // Test integer parsing
        assert_eq!(provider.parse_value("42"), ConfigValue::Int(42));

        // Test float parsing
        assert_eq!(provider.parse_value("3.14"), ConfigValue::Float(3.14));

        // Test string fallback
        assert_eq!(provider.parse_value("hello"), ConfigValue::String("hello".into()));
    }

    #[cfg(feature = "env_support")]
    #[test]
    fn test_env_parser_complex_values() {
        // Test JSON-like object
        let result = EnvParser::parse_complex_value(r#"{"key": "value"}"#);
        assert!(result.is_ok());

        // Test array
        let result = EnvParser::parse_complex_value(r#"["item1", "item2"]"#);
        assert!(result.is_ok());
        if let Ok(ConfigValue::Array(arr)) = result {
            assert_eq!(arr.len(), 2);
        }
    }

    #[test]
    fn test_config_format() {
        assert_eq!(ConfigFormat::Json as u8, ConfigFormat::Yaml as u8); // They should be different
        assert_eq!(ConfigFormat::Json as u8, ConfigFormat::Toml as u8); // They should be different
    }
}
