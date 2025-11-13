//! Plugin loading and unloading mechanisms

use crate::*;

/// Plugin loader trait
#[async_trait::async_trait(?Send)]
pub trait PluginLoaderTrait {
    /// Load a plugin from the given path
    async fn load(&self, path: &str, metadata: &PluginMetadata) -> Result<Box<dyn PluginInstance>>;

    /// Unload a plugin
    async fn unload(&self, plugin: Box<dyn PluginInstance>) -> Result<()>;

    /// Check if the loader supports the given plugin type
    fn supports_format(&self, format: &PluginFormat) -> bool;
}

/// Plugin instance trait
#[async_trait::async_trait(?Send)]
pub trait PluginInstance {
    /// Get plugin metadata
    fn metadata(&self) -> &PluginMetadata;

    /// Execute a function in the plugin
    async fn execute(&self, function: &str, input: &[u8]) -> Result<PluginResult>;

    /// Get resource usage
    fn resource_usage(&self) -> ResourceUsage;

    /// Check if plugin is still alive
    fn is_alive(&self) -> bool;
}

/// Plugin format types
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PluginFormat {
    /// WebAssembly plugin
    Wasm,
    /// Native dynamic library
    Native,
    /// JavaScript plugin
    JavaScript,
    /// Python plugin
    Python,
}

/// Plugin loader implementation
#[derive(Debug)]
pub struct PluginLoader {
    /// Available loaders
    loaders: alloc::vec::Vec<Box<dyn PluginLoaderTrait>>,
    /// Enable sandboxing
    sandbox_enabled: bool,
}

impl PluginLoader {
    /// Create a new plugin loader
    pub fn new(sandbox_enabled: bool) -> Self {
        let mut loaders = alloc::vec::Vec::new();

        // Add WASM loader if available
        #[cfg(feature = "wasm")]
        loaders.push(Box::new(WasmPluginLoader::new(sandbox_enabled)));

        // Add native loader if available
        #[cfg(feature = "native")]
        loaders.push(Box::new(NativePluginLoader::new()));

        Self {
            loaders,
            sandbox_enabled,
        }
    }

    /// Load a plugin from path
    pub async fn load_plugin(&self, path: &str, resource_limits: &ResourceLimits) -> Result<PluginContext> {
        // Detect plugin format from file extension
        let format = self.detect_format(path)?;

        // Find appropriate loader
        let loader = self.loaders.iter()
            .find(|l| l.supports_format(&format))
            .ok_or_else(|| PluginError::InvalidFormat {
                path: path.into(),
                expected: "supported format".into(),
                found: alloc::format!("{:?}", format),
            })?;

        // Load plugin metadata first
        let metadata = self.load_metadata(path).await?;

        // Create plugin instance
        let instance = loader.load(path, &metadata).await?;

        // Create plugin context
        let context = PluginContext {
            metadata,
            state: PluginState::Loaded,
            resource_usage: ResourceUsage::default(),
            last_execution: None,
            execution_count: 0,
            error_count: 0,
        };

        Ok(context)
    }

    /// Unload a plugin
    pub async fn unload_plugin(&self, context: &PluginContext) -> Result<()> {
        // Implementation would unload the actual plugin instance
        Ok(())
    }

    /// Execute a plugin function
    pub async fn execute_plugin(
        &self,
        context: &PluginContext,
        function: &str,
        input: &[u8],
    ) -> Result<PluginResult> {
        // Implementation would execute the actual plugin
        Err(PluginError::ExecutionFailed {
            plugin_id: context.metadata.id.clone(),
            function: function.into(),
            reason: "not implemented".into(),
        })
    }

    /// Detect plugin format from file path
    fn detect_format(&self, path: &str) -> Result<PluginFormat> {
        if path.ends_with(".wasm") {
            Ok(PluginFormat::Wasm)
        } else if path.ends_with(".so") || path.ends_with(".dll") || path.ends_with(".dylib") {
            Ok(PluginFormat::Native)
        } else if path.ends_with(".js") {
            Ok(PluginFormat::JavaScript)
        } else if path.ends_with(".py") {
            Ok(PluginFormat::Python)
        } else {
            Err(PluginError::InvalidFormat {
                path: path.into(),
                expected: "wasm, so, dll, dylib, js, or py".into(),
                found: "unknown".into(),
            })
        }
    }

    /// Load plugin metadata
    async fn load_metadata(&self, path: &str) -> Result<PluginMetadata> {
        // Implementation would read metadata from plugin file or manifest
        // For now, return dummy metadata
        Ok(PluginMetadata {
            id: "test-plugin".into(),
            name: "Test Plugin".into(),
            version: PluginVersion::new(1, 0, 0),
            description: "A test plugin".into(),
            author: "Test Author".into(),
            license: "MIT".into(),
            dependencies: alloc::vec::Vec::new(),
            capabilities: alloc::vec::Vec::new(),
            permissions: alloc::vec::Vec::new(),
            resource_limits: ResourceLimits::default(),
        })
    }
}

/// WASM plugin loader
#[cfg(feature = "wasm")]
#[derive(Debug)]
pub struct WasmPluginLoader {
    /// WASM engine
    engine: wasmtime::Engine,
    /// Enable sandboxing
    sandbox_enabled: bool,
}

#[cfg(feature = "wasm")]
impl WasmPluginLoader {
    /// Create a new WASM plugin loader
    pub fn new(sandbox_enabled: bool) -> Self {
        let engine = wasmtime::Engine::default();
        Self {
            engine,
            sandbox_enabled,
        }
    }
}

#[cfg(feature = "wasm")]
#[async_trait::async_trait(?Send)]
impl PluginLoaderTrait for WasmPluginLoader {
    async fn load(&self, path: &str, metadata: &PluginMetadata) -> Result<Box<dyn PluginInstance>> {
        // Read WASM file
        let wasm_bytes = tokio::fs::read(path).await
            .map_err(|e| PluginError::LoadFailed {
                path: path.into(),
                reason: alloc::format!("{}", e),
            })?;

        // Create WASM module
        let module = wasmtime::Module::from_binary(&self.engine, &wasm_bytes)
            .map_err(|e| PluginError::LoadFailed {
                path: path.into(),
                reason: alloc::format!("WASM compilation failed: {}", e),
            })?;

        // Create store with resource limits
        let mut store = wasmtime::Store::new(&self.engine, ());

        // Apply resource limits if sandboxing is enabled
        if self.sandbox_enabled {
            // Implementation would set up resource limits
        }

        // Instantiate module
        let instance = wasmtime::Instance::new(&mut store, &module, &[])
            .map_err(|e| PluginError::LoadFailed {
                path: path.into(),
                reason: alloc::format!("WASM instantiation failed: {}", e),
            })?;

        // Create WASM plugin instance
        let plugin = WasmPluginInstance {
            metadata: metadata.clone(),
            module,
            store,
            instance,
            resource_usage: ResourceUsage::default(),
        };

        Ok(Box::new(plugin))
    }

    async fn unload(&self, plugin: Box<dyn PluginInstance>) -> Result<()> {
        // WASM plugins are automatically cleaned up when dropped
        drop(plugin);
        Ok(())
    }

    fn supports_format(&self, format: &PluginFormat) -> bool {
        matches!(format, PluginFormat::Wasm)
    }
}

/// WASM plugin instance
#[cfg(feature = "wasm")]
#[derive(Debug)]
pub struct WasmPluginInstance {
    /// Plugin metadata
    metadata: PluginMetadata,
    /// WASM module
    module: wasmtime::Module,
    /// WASM store
    store: wasmtime::Store<()>,
    /// WASM instance
    instance: wasmtime::Instance,
    /// Resource usage
    resource_usage: ResourceUsage,
}

#[cfg(feature = "wasm")]
#[async_trait::async_trait(?Send)]
impl PluginInstance for WasmPluginInstance {
    fn metadata(&self) -> &PluginMetadata {
        &self.metadata
    }

    async fn execute(&self, function: &str, input: &[u8]) -> Result<PluginResult> {
        // Implementation would call WASM function
        Err(PluginError::ExecutionFailed {
            plugin_id: self.metadata.id.clone(),
            function: function.into(),
            reason: "WASM execution not implemented".into(),
        })
    }

    fn resource_usage(&self) -> ResourceUsage {
        self.resource_usage.clone()
    }

    fn is_alive(&self) -> bool {
        true // WASM instances are always alive until dropped
    }
}

/// Native plugin loader
#[cfg(feature = "native")]
#[derive(Debug)]
pub struct NativePluginLoader;

#[cfg(feature = "native")]
impl NativePluginLoader {
    /// Create a new native plugin loader
    pub fn new() -> Self {
        Self
    }
}

#[cfg(feature = "native")]
#[async_trait::async_trait(?Send)]
impl PluginLoaderTrait for NativePluginLoader {
    async fn load(&self, path: &str, metadata: &PluginMetadata) -> Result<Box<dyn PluginInstance>> {
        // Implementation would load native dynamic library
        Err(PluginError::LoadFailed {
            path: path.into(),
            reason: "native plugin loading not implemented".into(),
        })
    }

    async fn unload(&self, plugin: Box<dyn PluginInstance>) -> Result<()> {
        // Implementation would unload native library
        Ok(())
    }

    fn supports_format(&self, format: &PluginFormat) -> bool {
        matches!(format, PluginFormat::Native)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_plugin_format_detection() {
        let loader = PluginLoader::new(false);

        assert_eq!(loader.detect_format("plugin.wasm").unwrap(), PluginFormat::Wasm);
        assert_eq!(loader.detect_format("plugin.so").unwrap(), PluginFormat::Native);
        assert_eq!(loader.detect_format("plugin.js").unwrap(), PluginFormat::JavaScript);
        assert_eq!(loader.detect_format("plugin.py").unwrap(), PluginFormat::Python);

        assert!(loader.detect_format("plugin.unknown").is_err());
    }

    #[test]
    fn test_plugin_loader_creation() {
        let loader = PluginLoader::new(true);
        assert!(loader.sandbox_enabled);
        #[cfg(feature = "wasm")]
        assert!(!loader.loaders.is_empty());
    }

    #[cfg(feature = "wasm")]
    #[test]
    fn test_wasm_loader() {
        let loader = WasmPluginLoader::new(true);
        assert!(loader.sandbox_enabled);
        assert!(loader.supports_format(&PluginFormat::Wasm));
        assert!(!loader.supports_format(&PluginFormat::Native));
    }

    #[cfg(feature = "native")]
    #[test]
    fn test_native_loader() {
        let loader = NativePluginLoader::new();
        assert!(loader.supports_format(&PluginFormat::Native));
        assert!(!loader.supports_format(&PluginFormat::Wasm));
    }
}
