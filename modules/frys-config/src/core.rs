//! Core configuration management types and structures

use crate::*;
#[cfg(feature = "std")]
use crate::providers::ConfigFormat;
#[cfg(feature = "std")]
use std::sync::atomic::{AtomicU64, Ordering};
#[cfg(not(feature = "std"))]
use core::sync::atomic::{AtomicU64, Ordering};

/// Configuration value types
#[derive(Debug, Clone, PartialEq)]
pub enum ConfigValue {
    /// Null value
    Null,
    /// Boolean value
    Bool(bool),
    /// Integer value
    Int(i64),
    /// Float value
    Float(f64),
    /// String value
    String(alloc::string::String),
    /// Array of values
    Array(alloc::vec::Vec<ConfigValue>),
    /// Object/map of values
    Object(alloc::collections::BTreeMap<alloc::string::String, ConfigValue>),
}

/// Configuration source types
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConfigSource {
    /// Default configuration
    Default,
    /// File-based configuration
    File,
    /// Environment variables
    Environment,
    /// Remote configuration
    Remote,
    /// Runtime override
    Runtime,
}

/// Configuration entry with metadata
#[derive(Debug, Clone)]
pub struct ConfigEntry {
    /// Configuration value
    pub value: ConfigValue,
    /// Source of this configuration
    pub source: ConfigSource,
    /// Timestamp when this entry was last modified
    pub timestamp: u64,
    /// Version of this entry
    pub version: u64,
}

/// Configuration manager builder
pub struct ConfigManagerBuilder {
    merger: ConfigMerger,
    enable_hot_reload: bool,
    validation_enabled: bool,
    validation_schema: Option<ValidationSchema>,
}

impl core::fmt::Debug for ConfigManagerBuilder {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        f.debug_struct("ConfigManagerBuilder")
            .field("enable_hot_reload", &self.enable_hot_reload)
            .field("validation_enabled", &self.validation_enabled)
            .finish()
    }
}

impl ConfigManagerBuilder {
    /// Create a new builder
    pub fn new() -> Self {
        Self {
            merger: ConfigMerger::new(),
            enable_hot_reload: false,
            validation_enabled: false,
            validation_schema: None,
        }
    }

    /// Add default configuration provider
    pub fn with_defaults(mut self) -> Self {
        self.merger = self.merger.add_provider(DefaultProvider::with_common_defaults());
        self
    }

    /// Add file configuration provider
    #[cfg(feature = "std")]
    pub fn with_file<P: Into<alloc::string::String>>(mut self, path: P, format: ConfigFormat) -> Self {
        let provider = FileProvider::new(path, format);
        self.merger = self.merger.add_provider(provider);
        self
    }

    /// Add environment variable provider
    #[cfg(feature = "env_support")]
    pub fn with_env_prefix<P: Into<alloc::string::String>>(mut self, prefix: P) -> Self {
        let provider = EnvProvider::new(prefix);
        self.merger = self.merger.add_provider(provider);
        self
    }

    /// Add remote configuration provider
    #[cfg(feature = "remote_config")]
    pub fn with_remote<E: Into<alloc::string::String>>(mut self, endpoint: E, timeout: u64) -> Self {
        let provider = RemoteProvider::new(endpoint, timeout);
        self.merger = self.merger.add_provider(provider);
        self
    }

    /// Enable hot reload
    pub fn with_hot_reload(mut self, enable: bool) -> Self {
        self.enable_hot_reload = enable;
        self
    }

    /// Enable validation with common schema
    pub fn with_validation(mut self, enable: bool) -> Self {
        self.validation_enabled = enable;
        if enable {
            self.validation_schema = Some(ConfigValidator::common_app_schema());
        }
        self
    }

    /// Set custom validation schema
    pub fn with_schema(mut self, schema: ValidationSchema) -> Self {
        self.validation_schema = Some(schema);
        self.validation_enabled = true;
        self
    }

    /// Build the configuration manager
    pub async fn build(self) -> Result<ConfigManager> {
        let mut manager = ConfigManager::new();

        // Merge configurations from all providers
        let merged_config = self.merger.merge().await?;
        manager.entries = merged_config;

        // Initialize hot reload if enabled
        #[cfg(feature = "hot_reload")]
        if self.enable_hot_reload {
            let mut reloader = HotReloader::default();
            // In a real implementation, we would watch the files from providers
            manager.hot_reloader = Some(reloader);
        }

        // Initialize validator if enabled
        if self.validation_enabled {
            if let Some(schema) = self.validation_schema {
                let validator = ConfigValidator::new(schema);
                manager.validator = Some(validator);
                manager.validate().await?;
            }
        }

        Ok(manager)
    }
}

impl Default for ConfigManagerBuilder {
    fn default() -> Self {
        Self::new()
    }
}

/// Main configuration manager
#[derive(Debug)]
pub struct ConfigManager {
    /// Configuration entries
    entries: alloc::collections::BTreeMap<alloc::string::String, ConfigEntry>,
    /// Configuration version
    version: AtomicU64,
    /// Hot reload manager
    hot_reloader: Option<HotReloader>,
    /// Validator
    validator: Option<ConfigValidator>,
}

impl ConfigManager {
    /// Create a new configuration manager
    pub fn new() -> Self {
        Self {
            entries: alloc::collections::BTreeMap::new(),
            version: AtomicU64::new(1),
            hot_reloader: None,
            validator: None,
        }
    }

    /// Create a builder for configuration manager
    pub fn builder() -> ConfigManagerBuilder {
        ConfigManagerBuilder::new()
    }

    /// Load default configuration from path
    pub async fn load_defaults(&mut self, _path: &str) -> Result<()> {
        // Implementation would load default configuration
        // For now, this is a placeholder
        Ok(())
    }

    /// Load configuration from file
    pub async fn load_file(&mut self, _path: &str) -> Result<()> {
        // Implementation would load and parse configuration file
        // For now, this is a placeholder
        Ok(())
    }

    /// Load configuration from environment variables
    pub async fn load_environment(&mut self, _prefix: &str) -> Result<()> {
        // Implementation would load environment variables
        // For now, this is a placeholder
        Ok(())
    }

    /// Load configuration from remote endpoint
    pub async fn load_remote(&mut self, _endpoint: &str) -> Result<()> {
        // Implementation would load remote configuration
        // For now, this is a placeholder
        Ok(())
    }

    /// Enable hot reload functionality
    pub async fn enable_hot_reload(&mut self) -> Result<()> {
        // Implementation would initialize hot reload
        // For now, this is a placeholder
        Ok(())
    }

    /// Validate current configuration
    pub async fn validate(&self) -> Result<ValidationResult> {
        if let Some(validator) = &self.validator {
            validator.validate(self)
        } else {
            Ok(ValidationResult {
                is_valid: true,
                errors: alloc::vec::Vec::new(),
                warnings: alloc::vec::Vec::new(),
                schema_version: "none".into(),
            })
        }
    }

    /// Get a configuration value by key
    pub fn get(&self, key: &str) -> Result<ConfigValue> {
        match self.entries.get(key) {
            Some(entry) => Ok(entry.value.clone()),
            None => Err(ConfigError::KeyNotFound {
                key: key.into(),
            }),
        }
    }

    /// Get a typed configuration value
    pub fn get_typed<T: ConfigDeserialize>(&self, key: &str) -> Result<T> {
        let value = self.get(key)?;
        T::deserialize(value)
    }

    /// Set a configuration value
    pub fn set(&mut self, key: alloc::string::String, value: ConfigValue) -> Result<()> {
        let version = self.version.fetch_add(1, Ordering::AcqRel);

        let entry = ConfigEntry {
            value,
            source: ConfigSource::Runtime,
            timestamp: 0, // Would be current timestamp
            version,
        };

        self.entries.insert(key, entry);
        Ok(())
    }

    /// Check if a configuration key exists
    pub fn exists(&self, key: &str) -> bool {
        self.entries.contains_key(key)
    }

    /// Get all configuration keys
    pub fn keys(&self) -> alloc::vec::Vec<&alloc::string::String> {
        self.entries.keys().collect()
    }

    /// Get configuration snapshot
    pub fn snapshot(&self) -> ConfigSnapshot {
        let entries = self.entries.iter()
            .map(|(k, v)| (k.clone(), v.clone()))
            .collect();

        ConfigSnapshot {
            entries,
            version: self.version.load(Ordering::Acquire),
        }
    }

    /// Watch for configuration changes
    pub async fn watch<F>(&self, mut callback: F) -> Result<()>
    where
        F: FnMut(&alloc::string::String, &ConfigEntry) + Send + 'static,
    {
        // Implementation would set up watching mechanism
        // For now, this is a placeholder
        let _ = callback;
        Ok(())
    }
}

/// Configuration snapshot for atomic access
#[derive(Debug, Clone)]
pub struct ConfigSnapshot {
    /// Configuration entries
    pub entries: alloc::collections::BTreeMap<alloc::string::String, ConfigEntry>,
    /// Snapshot version
    pub version: u64,
}

impl ConfigSnapshot {
    /// Get a value from the snapshot
    pub fn get(&self, key: &str) -> Option<&ConfigEntry> {
        self.entries.get(key)
    }

    /// Check if snapshot contains a key
    pub fn contains(&self, key: &str) -> bool {
        self.entries.contains_key(key)
    }
}

/// Trait for deserializing configuration values into typed structures
pub trait ConfigDeserialize: Sized {
    /// Deserialize a ConfigValue into the target type
    fn deserialize(value: ConfigValue) -> Result<Self>;
}

impl ConfigDeserialize for bool {
    fn deserialize(value: ConfigValue) -> Result<Self> {
        match value {
            ConfigValue::Bool(b) => Ok(b),
            _ => Err(ConfigError::TypeError {
                key: "unknown".into(),
                expected_type: "bool",
                actual_type: "other",
            }),
        }
    }
}

impl ConfigDeserialize for i64 {
    fn deserialize(value: ConfigValue) -> Result<Self> {
        match value {
            ConfigValue::Int(i) => Ok(i),
            _ => Err(ConfigError::TypeError {
                key: "unknown".into(),
                expected_type: "int",
                actual_type: "other",
            }),
        }
    }
}

impl ConfigDeserialize for f64 {
    fn deserialize(value: ConfigValue) -> Result<Self> {
        match value {
            ConfigValue::Float(f) => Ok(f),
            _ => Err(ConfigError::TypeError {
                key: "unknown".into(),
                expected_type: "float",
                actual_type: "other",
            }),
        }
    }
}

impl ConfigDeserialize for alloc::string::String {
    fn deserialize(value: ConfigValue) -> Result<Self> {
        match value {
            ConfigValue::String(s) => Ok(s),
            _ => Err(ConfigError::TypeError {
                key: "unknown".into(),
                expected_type: "string",
                actual_type: "other",
            }),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_value() {
        let bool_val = ConfigValue::Bool(true);
        let int_val = ConfigValue::Int(42);
        let float_val = ConfigValue::Float(3.14);
        let string_val = ConfigValue::String("hello".into());

        assert_eq!(bool_val, ConfigValue::Bool(true));
        assert_eq!(int_val, ConfigValue::Int(42));
        assert_eq!(float_val, ConfigValue::Float(3.14));
        assert_eq!(string_val, ConfigValue::String("hello".into()));
    }

    #[test]
    fn test_config_deserialize() {
        assert_eq!(bool::deserialize(ConfigValue::Bool(true)).unwrap(), true);
        assert_eq!(i64::deserialize(ConfigValue::Int(42)).unwrap(), 42);
        assert_eq!(f64::deserialize(ConfigValue::Float(3.14)).unwrap(), 3.14);
        assert_eq!(alloc::string::String::deserialize(ConfigValue::String("hello".into())).unwrap(), "hello");
    }

    #[test]
    fn test_config_manager_basic() {
        let mut manager = ConfigManager::new();

        // Set a value
        manager.set("test.key".into(), ConfigValue::String("value".into())).unwrap();

        // Get the value
        let value = manager.get("test.key").unwrap();
        assert_eq!(value, ConfigValue::String("value".into()));

        // Check existence
        assert!(manager.exists("test.key"));
        assert!(!manager.exists("nonexistent.key"));
    }

    #[test]
    fn test_config_builder() {
        let builder = ConfigManagerBuilder::new()
            .with_default_path("./config/default.json")
            .with_file_path("./config/app.json")
            .with_env_prefix("MYAPP")
            .with_hot_reload(true)
            .with_validation(true);

        assert_eq!(builder.default_path, Some("./config/default.json".into()));
        assert_eq!(builder.file_paths.len(), 1);
        assert_eq!(builder.env_prefix, Some("MYAPP".into()));
        assert!(builder.enable_hot_reload);
        assert!(builder.validation_enabled);
    }

    #[tokio::test]
    async fn test_config_manager_creation() {
        let manager = ConfigManager::builder().build().await.unwrap();
        assert_eq!(manager.version.load(Ordering::Acquire), 1);
    }
}
