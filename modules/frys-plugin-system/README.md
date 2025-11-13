# Frys Plugin System

Frys Plugin System is a secure, sandboxed plugin architecture designed for distributed systems. It provides WASM-based plugin isolation, hot loading, and safe inter-plugin communication.

## Features

- **Secure Sandboxing**: Complete isolation using WebAssembly
- **Hot Loading**: Dynamic plugin loading without restart
- **Plugin Registry**: Centralized plugin management and discovery
- **Safe Communication**: Inter-plugin messaging with type safety
- **Version Management**: Plugin versioning and compatibility
- **Resource Limits**: Memory, CPU, and network restrictions
- **Multiple Formats**: WASM, native libraries, JavaScript, Python

## Quick Start

```rust,no_run
use frys_plugin_system::*;

// Create plugin manager
let manager = PluginManager::builder()
    .with_sandbox(true)
    .with_hot_reload(true)
    .build()
    .await?;

// Load a plugin
let plugin_id = manager.load_plugin("./plugins/my-plugin.wasm").await?;

// Execute plugin
let result = manager.execute_plugin(plugin_id, "process_data", b"input").await?;
println!("Result: {:?}", result);
```

## Architecture

The Plugin System consists of several key components:

1. **PluginManager**: Main plugin interface and orchestration
2. **PluginLoader**: Loads plugins from various sources
3. **PluginSandbox**: WASM-based isolation environment
4. **PluginRegistry**: Plugin discovery and metadata management
5. **PluginCommunicator**: Safe inter-plugin communication
6. **IsolationManager**: Plugin security policies and enforcement

## Plugin Development

### WASM Plugin Example

```rust
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct MyPlugin {
    data: Vec<u8>,
}

#[wasm_bindgen]
impl MyPlugin {
    #[wasm_bindgen(constructor)]
    pub fn new() -> MyPlugin {
        MyPlugin { data: Vec::new() }
    }

    #[wasm_bindgen]
    pub fn process(&mut self, input: &[u8]) -> Vec<u8> {
        // Process input data
        input.to_vec()
    }
}
```

### Plugin Metadata

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "A sample plugin",
  "author": "Developer",
  "license": "MIT",
  "capabilities": ["DataProcessing"],
  "permissions": ["Read", "Execute"],
  "resourceLimits": {
    "maxMemory": 67108864,
    "maxCpuTime": 1000,
    "maxExecutionTime": 30000
  }
}
```

## Plugin Loading

### From File
```rust
let plugin_id = manager.load_plugin("./plugins/my-plugin.wasm").await?;
```

### From Registry
```rust
let registry = PluginRegistry::new("https://registry.frys.io".into());
registry.download_plugin(&plugin_id, &version).await?;
```

## Sandboxing

### Security Policies
```rust
let sandbox = SandboxConfig {
    max_memory: 64 * 1024 * 1024, // 64MB
    max_execution_time: 30_000,   // 30 seconds
    allow_network: false,
    allow_fs: false,
    ..Default::default()
};
```

### Resource Monitoring
```rust
// Monitor plugin resource usage
let usage = sandbox.resource_usage();
println!("Memory: {} bytes", usage.memory_usage);
println!("CPU time: {} ms", usage.cpu_time_used);
```

## Inter-Plugin Communication

### Message Passing
```rust
let message = PluginMessage::FunctionCall {
    function: "process".into(),
    args: vec![MessageValue::String("data".into())],
};

broker.send_message(&target_plugin, message).await?;
```

### Event System
```rust
let event = PluginMessage::Event {
    event_type: "data_ready".into(),
    data: MessageValue::Bytes(result_data),
};

broker.broadcast(event).await?;
```

## Registry and Marketplace

### Plugin Discovery
```rust
let plugins = registry.search_plugins("data-processing", 10).await?;
for plugin in plugins {
    println!("Found: {} v{}", plugin.name, plugin.version);
}
```

### Plugin Installation
```rust
let marketplace = PluginMarketplace::new(registry, "./plugins".into());
marketplace.install(&plugin_id, &version).await?;
```

## Isolation Levels

- **Standard**: Basic resource limits
- **High**: Restricted permissions, enhanced monitoring
- **Maximum**: Full sandboxing, minimal permissions

```rust
let isolation = IsolationLevel::Maximum;
// Only explicitly allowed operations permitted
```

## Performance Goals

- **Load time**: < 100ms for typical plugins
- **Execution overhead**: < 5% for sandboxed plugins
- **Memory overhead**: < 2MB per plugin instance
- **Communication latency**: < 1ms inter-plugin messaging

## Error Handling

All operations return `Result<T>` with detailed error information:

```rust
match manager.load_plugin("./bad-plugin.wasm").await {
    Ok(id) => println!("Loaded: {}", id),
    Err(PluginError::LoadFailed { path, reason }) => {
        println!("Failed to load {}: {}", path, reason);
    }
    Err(PluginError::SecurityViolation { plugin_id, violation }) => {
        println!("Security violation in {}: {}", plugin_id, violation);
    }
    _ => println!("Other error occurred"),
}
```

## Testing

```bash
# Test with all features
cargo test --features "wasm sandbox hot_reload registry communication"

# Run example
cargo run --example plugin_example
```

## Security Considerations

- All plugins run in isolated WASM sandboxes
- Network and file system access is restricted by default
- Resource limits prevent abuse
- Plugins are cryptographically verified
- Inter-plugin communication is monitored

## License

MIT License