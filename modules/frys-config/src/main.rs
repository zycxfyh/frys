//! Example usage of Frys Config

use frys_config::*;
use core::time::Duration;

/// Example server configuration structure
#[derive(Debug)]
struct ServerConfig {
    host: alloc::string::String,
    port: u16,
    max_connections: u32,
}

impl ConfigDeserialize for ServerConfig {
    fn deserialize(value: ConfigValue) -> Result<Self> {
        match value {
            ConfigValue::Object(obj) => {
                let host = match obj.get("host") {
                    Some(ConfigValue::String(s)) => s.clone(),
                    _ => "localhost".into(),
                };

                let port = match obj.get("port") {
                    Some(ConfigValue::Int(i)) => *i as u16,
                    _ => 8080,
                };

                let max_connections = match obj.get("max_connections") {
                    Some(ConfigValue::Int(i)) => *i as u32,
                    _ => 100,
                };

                Ok(ServerConfig {
                    host,
                    port,
                    max_connections,
                })
            }
            _ => Err(ConfigError::TypeError {
                key: "server".into(),
                expected_type: "object",
                actual_type: "other",
            }),
        }
    }
}

/// Example logging configuration
#[derive(Debug)]
struct LoggingConfig {
    level: alloc::string::String,
    file: Option<alloc::string::String>,
}

impl ConfigDeserialize for LoggingConfig {
    fn deserialize(value: ConfigValue) -> Result<Self> {
        match value {
            ConfigValue::Object(obj) => {
                let level = match obj.get("level") {
                    Some(ConfigValue::String(s)) => s.clone(),
                    _ => "info".into(),
                };

                let file = match obj.get("file") {
                    Some(ConfigValue::String(s)) => Some(s.clone()),
                    _ => None,
                };

                Ok(LoggingConfig { level, file })
            }
            _ => Err(ConfigError::TypeError {
                key: "logging".into(),
                expected_type: "object",
                actual_type: "other",
            }),
        }
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    println!("Frys Config Example");
    println!("===================");

    // Create configuration manager with multiple sources
    let config = ConfigManager::builder()
        .with_defaults()
        .with_validation(true)
        .build()
        .await?;

    println!("\nConfiguration loaded successfully!");
    println!("Available keys:");
    for key in config.keys() {
        let value = config.get(key).unwrap();
        println!("  {} = {:?}", key, value);
    }

    // Get typed configurations
    let server_config: ServerConfig = config.get_typed("server")?;
    let logging_config: LoggingConfig = config.get_typed("logging")?;

    println!("\nServer Configuration:");
    println!("  Host: {}", server_config.host);
    println!("  Port: {}", server_config.port);
    println!("  Max Connections: {}", server_config.max_connections);

    println!("\nLogging Configuration:");
    println!("  Level: {}", logging_config.level);
    if let Some(file) = logging_config.file {
        println!("  File: {}", file);
    } else {
        println!("  File: stdout");
    }

    // Validate configuration
    let validation_result = config.validate().await?;
    if validation_result.is_valid {
        println!("\n✓ Configuration validation passed!");
    } else {
        println!("\n✗ Configuration validation failed:");
        for error in validation_result.errors {
            println!("  - {}", error);
        }
    }

    if validation_result.has_warnings() {
        println!("\nWarnings:");
        for warning in validation_result.warnings {
            println!("  - {:?}", warning);
        }
    }

    // Demonstrate hot reload (if enabled)
    #[cfg(feature = "hot_reload")]
    {
        println!("\nHot reload enabled - watching for configuration changes...");

        // Note: In a real application, you would set up proper file watching
        // This is just a demonstration

        tokio::time::sleep(Duration::from_secs(1)).await;
        println!("Hot reload simulation complete.");
    }

    println!("\nExample completed successfully!");

    Ok(())
}
