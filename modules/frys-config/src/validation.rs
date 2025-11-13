//! Configuration validation and schema checking

use crate::*;

/// Validation rule types
#[derive(Debug, Clone, PartialEq)]
pub enum ValidationRule {
    /// Required field
    Required,
    /// Type check
    Type(ConfigValueType),
    /// Range check for numbers
    Range { min: f64, max: f64 },
    /// Length check for strings/arrays
    Length { min: usize, max: usize },
    /// Pattern match for strings
    Pattern(alloc::string::String),
    /// Custom validation function
    Custom(alloc::string::String), // Would store function identifier
    /// One of predefined values
    OneOf(alloc::vec::Vec<ConfigValue>),
    /// Nested object validation
    Object(alloc::collections::BTreeMap<alloc::string::String, ValidationRule>),
}

/// Configuration value types for validation
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConfigValueType {
    Null,
    Bool,
    Int,
    Float,
    String,
    Array,
    Object,
}

/// Validation schema for configuration
#[derive(Debug, Clone)]
pub struct ValidationSchema {
    /// Schema rules
    rules: alloc::collections::BTreeMap<alloc::string::String, ValidationRule>,
    /// Schema version
    version: alloc::string::String,
}

impl ValidationSchema {
    /// Create a new validation schema
    pub fn new(version: alloc::string::String) -> Self {
        Self {
            rules: alloc::collections::BTreeMap::new(),
            version,
        }
    }

    /// Add a validation rule
    pub fn add_rule(mut self, key: alloc::string::String, rule: ValidationRule) -> Self {
        self.rules.insert(key, rule);
        self
    }

    /// Build the schema
    pub fn build(self) -> Self {
        self
    }

    /// Validate a configuration against this schema
    pub fn validate(&self, config: &ConfigManager) -> Result<ValidationResult> {
        let mut errors = alloc::vec::Vec::new();
        let mut warnings = alloc::vec::Vec::new();

        for (key, rule) in &self.rules {
            match self.validate_rule(key, rule, config) {
                Ok(()) => {}
                Err(e) => errors.push(e),
            }
        }

        // Check for required fields that are missing
        for (key, rule) in &self.rules {
            if matches!(rule, ValidationRule::Required) && !config.exists(key) {
                errors.push(ValidationError::MissingRequiredField {
                    field: key.clone(),
                });
            }
        }

        Ok(ValidationResult {
            is_valid: errors.is_empty(),
            errors,
            warnings,
            schema_version: self.version.clone(),
        })
    }

    /// Validate a single rule
    fn validate_rule(&self, key: &str, rule: &ValidationRule, config: &ConfigManager) -> Result<()> {
        match rule {
            ValidationRule::Required => {
                if !config.exists(key) {
                    return Err(ValidationError::MissingRequiredField {
                        field: key.into(),
                    });
                }
            }
            ValidationRule::Type(expected_type) => {
                if let Ok(value) = config.get(key) {
                    if !self.check_type(&value, expected_type) {
                        return Err(ValidationError::TypeMismatch {
                            field: key.into(),
                            expected: alloc::format!("{:?}", expected_type),
                            actual: alloc::format!("{:?}", self.get_value_type(&value)),
                        });
                    }
                }
            }
            ValidationRule::Range { min, max } => {
                if let Ok(ConfigValue::Int(i)) = config.get(key) {
                    let val = i as f64;
                    if val < min || val > max {
                        return Err(ValidationError::ValueOutOfRange {
                            field: key.into(),
                            value: val,
                            min,
                            max,
                        });
                    }
                } else if let Ok(ConfigValue::Float(f)) = config.get(key) {
                    if f < min || f > max {
                        return Err(ValidationError::ValueOutOfRange {
                            field: key.into(),
                            value: f,
                            min,
                            max,
                        });
                    }
                }
            }
            ValidationRule::Length { min, max } => {
                if let Ok(ConfigValue::String(s)) = config.get(key) {
                    let len = s.len();
                    if len < min || len > max {
                        return Err(ValidationError::InvalidLength {
                            field: key.into(),
                            length: len,
                            min,
                            max,
                        });
                    }
                } else if let Ok(ConfigValue::Array(arr)) = config.get(key) {
                    let len = arr.len();
                    if len < min || len > max {
                        return Err(ValidationError::InvalidLength {
                            field: key.into(),
                            length: len,
                            min,
                            max,
                        });
                    }
                }
            }
            ValidationRule::Pattern(pattern) => {
                if let Ok(ConfigValue::String(s)) = config.get(key) {
                    if !self.matches_pattern(s, pattern) {
                        return Err(ValidationError::PatternMismatch {
                            field: key.into(),
                            value: s.clone(),
                            pattern: pattern.clone(),
                        });
                    }
                }
            }
            ValidationRule::OneOf(values) => {
                if let Ok(value) = config.get(key) {
                    if !values.contains(&value) {
                        return Err(ValidationError::InvalidValue {
                            field: key.into(),
                            value: alloc::format!("{:?}", value),
                            allowed: values.iter().map(|v| alloc::format!("{:?}", v)).collect(),
                        });
                    }
                }
            }
            ValidationRule::Object(nested_rules) => {
                // For nested objects, we would recursively validate
                // This is simplified for now
                let _ = nested_rules;
            }
            ValidationRule::Custom(_) => {
                // Custom validation would be implemented here
                // This is a placeholder
            }
        }

        Ok(())
    }

    /// Check if a value matches the expected type
    fn check_type(&self, value: &ConfigValue, expected: &ConfigValueType) -> bool {
        matches!((value, expected),
            (ConfigValue::Null, ConfigValueType::Null) |
            (ConfigValue::Bool(_), ConfigValueType::Bool) |
            (ConfigValue::Int(_), ConfigValueType::Int) |
            (ConfigValue::Float(_), ConfigValueType::Float) |
            (ConfigValue::String(_), ConfigValueType::String) |
            (ConfigValue::Array(_), ConfigValueType::Array) |
            (ConfigValue::Object(_), ConfigValueType::Object)
        )
    }

    /// Get the type of a configuration value
    fn get_value_type(&self, value: &ConfigValue) -> ConfigValueType {
        match value {
            ConfigValue::Null => ConfigValueType::Null,
            ConfigValue::Bool(_) => ConfigValueType::Bool,
            ConfigValue::Int(_) => ConfigValueType::Int,
            ConfigValue::Float(_) => ConfigValueType::Float,
            ConfigValue::String(_) => ConfigValueType::String,
            ConfigValue::Array(_) => ConfigValueType::Array,
            ConfigValue::Object(_) => ConfigValueType::Object,
        }
    }

    /// Check if string matches pattern
    fn matches_pattern(&self, value: &str, pattern: &str) -> bool {
        // Simple pattern matching (would use regex in real implementation)
        if pattern.starts_with('^') && pattern.ends_with('$') {
            // Simple regex-like matching
            let inner = &pattern[1..pattern.len() - 1];
            if inner == ".*" {
                return true; // Match anything
            }
            if inner.starts_with("[a-zA-Z]+") {
                return value.chars().all(|c| c.is_alphabetic());
            }
            if inner.starts_with("[0-9]+") {
                return value.chars().all(|c| c.is_numeric());
            }
        }

        // Simple wildcard matching
        if pattern.contains('*') {
            let prefix = pattern.split('*').next().unwrap_or("");
            let suffix = pattern.split('*').last().unwrap_or("");
            return value.starts_with(prefix) && value.ends_with(suffix);
        }

        value == pattern
    }
}

/// Configuration validator
#[derive(Debug)]
pub struct ConfigValidator {
    schema: ValidationSchema,
}

impl ConfigValidator {
    /// Create a new validator with schema
    pub fn new(schema: ValidationSchema) -> Self {
        Self { schema }
    }

    /// Validate configuration
    pub fn validate(&self, config: &ConfigManager) -> Result<ValidationResult> {
        self.schema.validate(config)
    }

    /// Create a common application schema
    pub fn common_app_schema() -> ValidationSchema {
        ValidationSchema::new("1.0".into())
            .add_rule("app.name".into(), ValidationRule::Required)
            .add_rule("app.name".into(), ValidationRule::Type(ConfigValueType::String))
            .add_rule("app.version".into(), ValidationRule::Required)
            .add_rule("app.version".into(), ValidationRule::Type(ConfigValueType::String))
            .add_rule("server.host".into(), ValidationRule::Required)
            .add_rule("server.host".into(), ValidationRule::Type(ConfigValueType::String))
            .add_rule("server.port".into(), ValidationRule::Required)
            .add_rule("server.port".into(), ValidationRule::Type(ConfigValueType::Int))
            .add_rule("server.port".into(), ValidationRule::Range { min: 1.0, max: 65535.0 })
            .add_rule("logging.level".into(), ValidationRule::Required)
            .add_rule("logging.level".into(), ValidationRule::OneOf(vec![
                ConfigValue::String("debug".into()),
                ConfigValue::String("info".into()),
                ConfigValue::String("warn".into()),
                ConfigValue::String("error".into()),
            ]))
            .add_rule("database.max_connections".into(), ValidationRule::Type(ConfigValueType::Int))
            .add_rule("database.max_connections".into(), ValidationRule::Range { min: 1.0, max: 1000.0 })
    }
}

/// Validation result
#[derive(Debug, Clone)]
pub struct ValidationResult {
    /// Whether validation passed
    pub is_valid: bool,
    /// Validation errors
    pub errors: alloc::vec::Vec<ValidationError>,
    /// Validation warnings
    pub warnings: alloc::vec::Vec<ValidationWarning>,
    /// Schema version used for validation
    pub schema_version: alloc::string::String,
}

impl ValidationResult {
    /// Check if result has any errors
    pub fn has_errors(&self) -> bool {
        !self.errors.is_empty()
    }

    /// Check if result has any warnings
    pub fn has_warnings(&self) -> bool {
        !self.warnings.is_empty()
    }

    /// Get error count
    pub fn error_count(&self) -> usize {
        self.errors.len()
    }

    /// Get warning count
    pub fn warning_count(&self) -> usize {
        self.warnings.len()
    }
}

/// Validation error types
#[derive(Debug, Clone, PartialEq)]
pub enum ValidationError {
    /// Required field is missing
    MissingRequiredField {
        field: alloc::string::String,
    },
    /// Type mismatch
    TypeMismatch {
        field: alloc::string::String,
        expected: alloc::string::String,
        actual: alloc::string::String,
    },
    /// Value out of allowed range
    ValueOutOfRange {
        field: alloc::string::String,
        value: f64,
        min: f64,
        max: f64,
    },
    /// Invalid length
    InvalidLength {
        field: alloc::string::String,
        length: usize,
        min: usize,
        max: usize,
    },
    /// Pattern mismatch
    PatternMismatch {
        field: alloc::string::String,
        value: alloc::string::String,
        pattern: alloc::string::String,
    },
    /// Invalid value
    InvalidValue {
        field: alloc::string::String,
        value: alloc::string::String,
        allowed: alloc::vec::Vec<alloc::string::String>,
    },
    /// Nested validation error
    NestedError {
        field: alloc::string::String,
        errors: alloc::vec::Vec<Box<ValidationError>>,
    },
}

/// Validation warning types
#[derive(Debug, Clone, PartialEq)]
pub enum ValidationWarning {
    /// Deprecated configuration key
    DeprecatedKey {
        field: alloc::string::String,
        alternative: alloc::string::String,
    },
    /// Value near boundary
    ValueNearBoundary {
        field: alloc::string::String,
        value: alloc::string::String,
        boundary: alloc::string::String,
    },
}

/// Configuration migration manager
#[derive(Debug)]
pub struct ConfigMigration {
    /// Migration rules from version to version
    migrations: alloc::collections::BTreeMap<(alloc::string::String, alloc::string::String), MigrationRule>,
    /// Current version
    current_version: alloc::string::String,
}

impl ConfigMigration {
    /// Create a new migration manager
    pub fn new(current_version: alloc::string::String) -> Self {
        Self {
            migrations: alloc::collections::BTreeMap::new(),
            current_version,
        }
    }

    /// Add a migration rule
    pub fn add_migration(
        &mut self,
        from_version: alloc::string::String,
        to_version: alloc::string::String,
        rule: MigrationRule,
    ) {
        self.migrations.insert((from_version, to_version), rule);
    }

    /// Migrate configuration from one version to another
    pub fn migrate(
        &self,
        config: &mut alloc::collections::BTreeMap<alloc::string::String, ConfigValue>,
        from_version: &str,
        to_version: &str,
    ) -> Result<()> {
        let key = (from_version.into(), to_version.into());

        if let Some(rule) = self.migrations.get(&key) {
            rule.apply(config)?;
            Ok(())
        } else {
            Err(ConfigError::MigrationError {
                from_version: from_version.into(),
                to_version: to_version.into(),
                details: "no migration rule found".into(),
            })
        }
    }

    /// Check if migration is needed
    pub fn needs_migration(&self, config_version: &str) -> bool {
        config_version != self.current_version
    }

    /// Get available migration paths
    pub fn available_migrations(&self) -> alloc::vec::Vec<(&alloc::string::String, &alloc::string::String)> {
        self.migrations.keys().collect()
    }
}

/// Migration rule definition
#[derive(Debug, Clone)]
pub struct MigrationRule {
    /// Key transformations (old_key -> new_key)
    key_transforms: alloc::collections::BTreeMap<alloc::string::String, alloc::string::String>,
    /// Value transformations
    value_transforms: alloc::vec::Vec<ValueTransform>,
    /// Keys to remove
    keys_to_remove: alloc::vec::Vec<alloc::string::String>,
    /// New default values to add
    new_defaults: alloc::collections::BTreeMap<alloc::string::String, ConfigValue>,
}

impl MigrationRule {
    /// Create a new migration rule
    pub fn new() -> Self {
        Self {
            key_transforms: alloc::collections::BTreeMap::new(),
            value_transforms: alloc::vec::Vec::new(),
            keys_to_remove: alloc::vec::Vec::new(),
            new_defaults: alloc::collections::BTreeMap::new(),
        }
    }

    /// Add key transformation
    pub fn transform_key(mut self, old_key: alloc::string::String, new_key: alloc::string::String) -> Self {
        self.key_transforms.insert(old_key, new_key);
        self
    }

    /// Add value transformation
    pub fn transform_value(mut self, transform: ValueTransform) -> Self {
        self.value_transforms.push(transform);
        self
    }

    /// Remove a key
    pub fn remove_key(mut self, key: alloc::string::String) -> Self {
        self.keys_to_remove.push(key);
        self
    }

    /// Add new default value
    pub fn add_default(mut self, key: alloc::string::String, value: ConfigValue) -> Self {
        self.new_defaults.insert(key, value);
        self
    }

    /// Apply the migration rule
    pub fn apply(&self, config: &mut alloc::collections::BTreeMap<alloc::string::String, ConfigValue>) -> Result<()> {
        // Apply key transformations
        let mut new_entries = alloc::collections::BTreeMap::new();

        for (old_key, new_key) in &self.key_transforms {
            if let Some(value) = config.remove(old_key) {
                new_entries.insert(new_key.clone(), value);
            }
        }

        // Add transformed entries back
        for (key, value) in new_entries {
            config.insert(key, value);
        }

        // Apply value transformations
        for transform in &self.value_transforms {
            if let Some(value) = config.get_mut(&transform.key) {
                *value = transform.apply(value.clone());
            }
        }

        // Remove deprecated keys
        for key in &self.keys_to_remove {
            config.remove(key);
        }

        // Add new defaults (only if not already present)
        for (key, value) in &self.new_defaults {
            config.entry(key.clone()).or_insert_with(|| value.clone());
        }

        Ok(())
    }
}

/// Value transformation rule
#[derive(Debug, Clone)]
pub struct ValueTransform {
    /// Key to transform
    pub key: alloc::string::String,
    /// Transformation function identifier
    pub transform_type: TransformType,
    /// Additional parameters
    pub params: alloc::collections::BTreeMap<alloc::string::String, alloc::string::String>,
}

impl ValueTransform {
    /// Create a new value transform
    pub fn new(key: alloc::string::String, transform_type: TransformType) -> Self {
        Self {
            key,
            transform_type,
            params: alloc::collections::BTreeMap::new(),
        }
    }

    /// Add parameter
    pub fn with_param(mut self, name: alloc::string::String, value: alloc::string::String) -> Self {
        self.params.insert(name, value);
        self
    }

    /// Apply transformation
    pub fn apply(&self, value: ConfigValue) -> ConfigValue {
        match self.transform_type {
            TransformType::StringToInt => {
                if let ConfigValue::String(s) = value {
                    if let Ok(i) = s.parse::<i64>() {
                        ConfigValue::Int(i)
                    } else {
                        value // Return original if conversion fails
                    }
                } else {
                    value
                }
            }
            TransformType::ScaleByFactor => {
                if let Some(factor_str) = self.params.get("factor") {
                    if let Ok(factor) = factor_str.parse::<f64>() {
                        match value {
                            ConfigValue::Int(i) => ConfigValue::Int((i as f64 * factor) as i64),
                            ConfigValue::Float(f) => ConfigValue::Float(f * factor),
                            _ => value,
                        }
                    } else {
                        value
                    }
                } else {
                    value
                }
            }
            TransformType::RenameEnumValue => {
                if let (Some(old_value), Some(new_value)) = (self.params.get("old"), self.params.get("new")) {
                    if let ConfigValue::String(s) = value {
                        if s == old_value {
                            ConfigValue::String(new_value.clone())
                        } else {
                            value
                        }
                    } else {
                        value
                    }
                } else {
                    value
                }
            }
            TransformType::Custom => value, // Custom transforms would be implemented separately
        }
    }
}

/// Transformation types
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TransformType {
    /// Convert string to integer
    StringToInt,
    /// Scale numeric value by factor
    ScaleByFactor,
    /// Rename enum value
    RenameEnumValue,
    /// Custom transformation
    Custom,
}

/// Compatibility checker for configuration compatibility
#[derive(Debug)]
pub struct CompatibilityChecker {
    /// Breaking changes between versions
    breaking_changes: alloc::collections::BTreeMap<alloc::string::String, alloc::vec::Vec<BreakingChange>>,
}

impl CompatibilityChecker {
    /// Create a new compatibility checker
    pub fn new() -> Self {
        Self {
            breaking_changes: alloc::collections::BTreeMap::new(),
        }
    }

    /// Add breaking change for a version
    pub fn add_breaking_change(&mut self, version: alloc::string::String, change: BreakingChange) {
        self.breaking_changes
            .entry(version)
            .or_insert_with(alloc::vec::Vec::new)
            .push(change);
    }

    /// Check compatibility between versions
    pub fn check_compatibility(&self, from_version: &str, to_version: &str) -> CompatibilityResult {
        let mut breaking_changes = alloc::vec::Vec::new();

        // Collect all breaking changes between versions
        for (version, changes) in &self.breaking_changes {
            // Simplified version comparison - in real implementation, use proper semver
            if version >= &from_version.to_string() && version <= &to_version.to_string() {
                breaking_changes.extend(changes.clone());
            }
        }

        if breaking_changes.is_empty() {
            CompatibilityResult::Compatible
        } else {
            CompatibilityResult::BreakingChanges(breaking_changes)
        }
    }

    /// Get all breaking changes
    pub fn breaking_changes(&self, version: &str) -> Option<&[BreakingChange]> {
        self.breaking_changes.get(version).map(|v| v.as_slice())
    }
}

/// Breaking change information
#[derive(Debug, Clone)]
pub struct BreakingChange {
    /// Change description
    pub description: alloc::string::String,
    /// Affected configuration keys
    pub affected_keys: alloc::vec::Vec<alloc::string::String>,
    /// Migration guide
    pub migration_guide: alloc::string::String,
    /// Severity level
    pub severity: ChangeSeverity,
}

/// Change severity levels
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ChangeSeverity {
    /// Low impact, easy to migrate
    Low,
    /// Medium impact, requires some changes
    Medium,
    /// High impact, significant changes required
    High,
    /// Critical, may break functionality
    Critical,
}

/// Compatibility check result
#[derive(Debug, Clone)]
pub enum CompatibilityResult {
    /// Fully compatible
    Compatible,
    /// Has breaking changes
    BreakingChanges(alloc::vec::Vec<BreakingChange>),
}

impl CompatibilityResult {
    /// Check if compatible
    pub fn is_compatible(&self) -> bool {
        matches!(self, CompatibilityResult::Compatible)
    }

    /// Get breaking changes if any
    pub fn breaking_changes(&self) -> Option<&[BreakingChange]> {
        match self {
            CompatibilityResult::Compatible => None,
            CompatibilityResult::BreakingChanges(changes) => Some(changes),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validation_schema_creation() {
        let schema = ValidationSchema::new("1.0".into())
            .add_rule("test.field".into(), ValidationRule::Required)
            .add_rule("test.field".into(), ValidationRule::Type(ConfigValueType::String));

        assert_eq!(schema.version, "1.0");
        assert_eq!(schema.rules.len(), 2);
    }

    #[test]
    fn test_common_app_schema() {
        let schema = ConfigValidator::common_app_schema();
        assert_eq!(schema.version, "1.0");
        assert!(schema.rules.contains_key("app.name"));
        assert!(schema.rules.contains_key("server.port"));
        assert!(schema.rules.contains_key("logging.level"));
    }

    #[test]
    fn test_type_checking() {
        let schema = ValidationSchema::new("1.0".into());
        let mut config = ConfigManager::new();

        // Test type validation
        config.set("test.int".into(), ConfigValue::Int(42)).unwrap();
        config.set("test.str".into(), ConfigValue::String("hello".into())).unwrap();

        let int_rule = ValidationRule::Type(ConfigValueType::Int);
        let str_rule = ValidationRule::Type(ConfigValueType::String);

        assert!(schema.validate_rule("test.int", &int_rule, &config).is_ok());
        assert!(schema.validate_rule("test.str", &str_rule, &config).is_ok());

        let wrong_rule = ValidationRule::Type(ConfigValueType::Bool);
        assert!(schema.validate_rule("test.int", &wrong_rule, &config).is_err());
    }

    #[test]
    fn test_range_validation() {
        let schema = ValidationSchema::new("1.0".into());
        let mut config = ConfigManager::new();

        config.set("test.value".into(), ConfigValue::Int(50)).unwrap();

        let range_rule = ValidationRule::Range { min: 0.0, max: 100.0 };
        assert!(schema.validate_rule("test.value", &range_rule, &config).is_ok());

        let out_of_range_rule = ValidationRule::Range { min: 0.0, max: 10.0 };
        assert!(schema.validate_rule("test.value", &out_of_range_rule, &config).is_err());
    }

    #[test]
    fn test_length_validation() {
        let schema = ValidationSchema::new("1.0".into());
        let mut config = ConfigManager::new();

        config.set("test.str".into(), ConfigValue::String("hello".into())).unwrap();

        let length_rule = ValidationRule::Length { min: 1, max: 10 };
        assert!(schema.validate_rule("test.str", &length_rule, &config).is_ok());

        let invalid_length_rule = ValidationRule::Length { min: 10, max: 20 };
        assert!(schema.validate_rule("test.str", &invalid_length_rule, &config).is_err());
    }

    #[test]
    fn test_oneof_validation() {
        let schema = ValidationSchema::new("1.0".into());
        let mut config = ConfigManager::new();

        config.set("test.level".into(), ConfigValue::String("info".into())).unwrap();

        let oneof_rule = ValidationRule::OneOf(vec![
            ConfigValue::String("debug".into()),
            ConfigValue::String("info".into()),
            ConfigValue::String("warn".into()),
        ]);

        assert!(schema.validate_rule("test.level", &oneof_rule, &config).is_ok());

        config.set("test.level".into(), ConfigValue::String("invalid".into())).unwrap();
        assert!(schema.validate_rule("test.level", &oneof_rule, &config).is_err());
    }

    #[test]
    fn test_validation_result() {
        let result = ValidationResult {
            is_valid: false,
            errors: vec![ValidationError::MissingRequiredField { field: "test".into() }],
            warnings: vec![ValidationWarning::DeprecatedKey {
                field: "old.key".into(),
                alternative: "new.key".into(),
            }],
            schema_version: "1.0".into(),
        };

        assert!(!result.is_valid);
        assert!(result.has_errors());
        assert!(result.has_warnings());
        assert_eq!(result.error_count(), 1);
        assert_eq!(result.warning_count(), 1);
    }

    #[test]
    fn test_migration_rule() {
        let rule = MigrationRule::new()
            .transform_key("old.key".into(), "new.key".into())
            .remove_key("deprecated.key".into())
            .add_default("new.default".into(), ConfigValue::String("value".into()));

        let mut config = alloc::collections::BTreeMap::new();
        config.insert("old.key".into(), ConfigValue::String("old_value".into()));
        config.insert("deprecated.key".into(), ConfigValue::String("deprecated".into()));
        config.insert("existing.key".into(), ConfigValue::String("existing".into()));

        rule.apply(&mut config).unwrap();

        assert_eq!(config.get("new.key"), Some(&ConfigValue::String("old_value".into())));
        assert_eq!(config.get("old.key"), None); // Should be removed
        assert_eq!(config.get("deprecated.key"), None); // Should be removed
        assert_eq!(config.get("new.default"), Some(&ConfigValue::String("value".into())));
        assert_eq!(config.get("existing.key"), Some(&ConfigValue::String("existing".into())));
    }

    #[test]
    fn test_value_transform() {
        // Test string to int transformation
        let transform = ValueTransform::new("test.key".into(), TransformType::StringToInt);
        let result = transform.apply(ConfigValue::String("42".into()));
        assert_eq!(result, ConfigValue::Int(42));

        // Test scale by factor
        let transform = ValueTransform::new("test.key".into(), TransformType::ScaleByFactor)
            .with_param("factor".into(), "2.0".into());
        let result = transform.apply(ConfigValue::Int(5));
        assert_eq!(result, ConfigValue::Int(10));

        // Test rename enum value
        let transform = ValueTransform::new("test.key".into(), TransformType::RenameEnumValue)
            .with_param("old".into(), "deprecated".into())
            .with_param("new".into(), "current".into());
        let result = transform.apply(ConfigValue::String("deprecated".into()));
        assert_eq!(result, ConfigValue::String("current".into()));
    }

    #[test]
    fn test_config_migration() {
        let mut migration = ConfigMigration::new("2.0".into());

        let rule = MigrationRule::new()
            .transform_key("old.setting".into(), "new.setting".into());

        migration.add_migration("1.0".into(), "2.0".into(), rule);

        let mut config = alloc::collections::BTreeMap::new();
        config.insert("old.setting".into(), ConfigValue::String("value".into()));

        migration.migrate(&mut config, "1.0", "2.0").unwrap();

        assert_eq!(config.get("new.setting"), Some(&ConfigValue::String("value".into())));
        assert_eq!(config.get("old.setting"), None);

        assert!(migration.needs_migration("1.0"));
        assert!(!migration.needs_migration("2.0"));
    }

    #[test]
    fn test_compatibility_checker() {
        let mut checker = CompatibilityChecker::new();

        let breaking_change = BreakingChange {
            description: "Removed deprecated API".into(),
            affected_keys: vec!["deprecated.api".into()],
            migration_guide: "Use new.api instead".into(),
            severity: ChangeSeverity::Medium,
        };

        checker.add_breaking_change("2.0".into(), breaking_change);

        let result = checker.check_compatibility("1.0", "2.0");
        assert!(!result.is_compatible());

        if let CompatibilityResult::BreakingChanges(changes) = result {
            assert_eq!(changes.len(), 1);
            assert_eq!(changes[0].description, "Removed deprecated API");
        }
    }

    #[test]
    fn test_compatibility_result() {
        let compatible = CompatibilityResult::Compatible;
        assert!(compatible.is_compatible());
        assert!(compatible.breaking_changes().is_none());

        let breaking_changes = vec![BreakingChange {
            description: "Test change".into(),
            affected_keys: vec![],
            migration_guide: "Test guide".into(),
            severity: ChangeSeverity::Low,
        }];

        let incompatible = CompatibilityResult::BreakingChanges(breaking_changes);
        assert!(!incompatible.is_compatible());
        assert_eq!(incompatible.breaking_changes().unwrap().len(), 1);
    }
}
