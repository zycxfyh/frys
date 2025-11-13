# Frys Config

Frys Config is a hierarchical configuration management system designed for distributed systems. It provides:

- **Hierarchical configuration**: Multi-layer configuration merging
- **Hot reload**: Automatic configuration updates without restart
- **Type safety**: Compile-time and runtime configuration validation
- **Multiple sources**: File, environment variables, remote configs
- **Version management**: Smooth upgrades and backward compatibility

## Features

- **Zero-copy configuration**: Minimal memory allocations
- **Type-safe access**: Strongly typed configuration values
- **Hot reloading**: File system watching for config changes
- **Validation**: Schema-based validation with detailed errors
- **Migration support**: Automatic config migration between versions
- **Multi-format support**: JSON, YAML, TOML, custom formats

## Quick Start

```rust
use frys_config::*;

// Create configuration manager
let config = ConfigManager::builder()
    .with_defaults()
    .with_file("./config/app.json", ConfigFormat::Json)
    .with_env_prefix("MYAPP_")
    .with_hot_reload(true)
    .with_validation(true)
    .build()
    .await?;

// Get typed configuration
let server_config: ServerConfig = config.get_typed("server")?;
println!("Server port: {}", server_config.port);
```

## Architecture

The Config system consists of several key components:

1. **ConfigManager**: Main configuration interface
2. **ConfigProviders**: Different configuration sources
3. **ConfigValidator**: Validation and type checking
4. **HotReloader**: File watching and hot reload
5. **ConfigMigration**: Version management and migration

## Configuration Sources

### File Provider
```rust
let config = ConfigManager::builder()
    .with_file("./config/app.json", ConfigFormat::Json)
    .with_file("./config/secrets.toml", ConfigFormat::Toml)
    .build()
    .await?;
```

### Environment Variables
```rust
let config = ConfigManager::builder()
    .with_env_prefix("MYAPP_")
    .build()
    .await?;
```

Environment variables are normalized:
- `MYAPP_SERVER_PORT=8080` → `server.port`
- `MYAPP_DATABASE_URL=...` → `database.url`

### Remote Configuration
```rust
let config = ConfigManager::builder()
    .with_remote("http://config-server/api/config", 5000)
    .build()
    .await?;
```

## Validation

```rust
let schema = ValidationSchema::new("1.0".into())
    .add_rule("server.port".into(), ValidationRule::Required)
    .add_rule("server.port".into(), ValidationRule::Type(ConfigValueType::Int))
    .add_rule("server.port".into(), ValidationRule::Range { min: 1.0, max: 65535.0 });

let validator = ConfigValidator::new(schema);
let result = validator.validate(&config)?;

if !result.is_valid {
    for error in result.errors {
        println!("Validation error: {}", error);
    }
}
```

## Hot Reload

```rust
let mut reloader = HotReloader::new(Duration::from_secs(1));
reloader.watch_file("./config/app.json", ConfigFormat::Json)?;

reloader.on_change(|event| {
    match event {
        HotReloadEvent::ConfigReloaded { path, success, error } => {
            if success {
                println!("Config {} reloaded successfully", path);
            } else {
                println!("Failed to reload {}: {:?}", path, error);
            }
        }
    }
});

reloader.start().await?;
```

## Migration Support

```rust
let mut migration = ConfigMigration::new("2.0".into());

let rule = MigrationRule::new()
    .transform_key("old.api.endpoint".into(), "api.endpoint".into())
    .transform_value(ValueTransform::new("timeout".into(), TransformType::ScaleByFactor)
        .with_param("factor".into(), "1000".into())) // Convert seconds to milliseconds
    .remove_key("deprecated.feature".into());

migration.add_migration("1.0".into(), "2.0".into(), rule);

// Apply migration
migration.migrate(&mut config, "1.0", "2.0")?;
```

## Compatibility Checking

```rust
let mut checker = CompatibilityChecker::new();

let breaking_change = BreakingChange {
    description: "Removed legacy API".into(),
    affected_keys: vec!["legacy.api".into()],
    migration_guide: "Use new.api instead".into(),
    severity: ChangeSeverity::High,
};

checker.add_breaking_change("2.0".into(), breaking_change);

let compatibility = checker.check_compatibility("1.0", "2.0");
match compatibility {
    CompatibilityResult::Compatible => println!("Fully compatible"),
    CompatibilityResult::BreakingChanges(changes) => {
        println!("Breaking changes detected:");
        for change in changes {
            println!("- {} ({:?})", change.description, change.severity);
        }
    }
}
```

## Performance Goals

- **Load time**: < 10ms for typical configurations
- **Memory usage**: < 1MB for complex configurations
- **Reload latency**: < 100ms for hot reload
- **Validation speed**: > 10K validations/second

## Error Handling

All operations return `Result<T>` with detailed error information:

```rust
match config.get("server.port") {
    Ok(value) => println!("Port: {:?}", value),
    Err(ConfigError::KeyNotFound { key }) => {
        println!("Configuration key '{}' not found", key);
    }
    Err(ConfigError::ValidationError { field, expected, actual }) => {
        println!("Validation failed for '{}': expected {}, got {}", field, expected, actual);
    }
    _ => println!("Other error occurred"),
}
```

## Testing

```bash
cargo test --features hot_reload,env_support
```

## License

MIT License