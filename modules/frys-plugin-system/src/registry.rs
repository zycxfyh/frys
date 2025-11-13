//! Plugin registry and discovery mechanisms

use crate::*;

/// Plugin registry for discovery and management
#[derive(Debug)]
pub struct PluginRegistry {
    /// Registry endpoint
    endpoint: alloc::string::String,
    /// HTTP client for registry communication
    #[cfg(feature = "std")]
    client: reqwest::Client,
    /// Local cache of plugin metadata
    cache: alloc::collections::BTreeMap<PluginId, PluginMetadata>,
    /// Cache timestamp
    cache_timestamp: u64,
    /// Cache TTL in seconds
    cache_ttl: u64,
}

impl PluginRegistry {
    /// Create a new plugin registry
    #[cfg(feature = "std")]
    pub fn new(endpoint: alloc::string::String) -> Self {
        Self {
            endpoint,
            client: reqwest::Client::new(),
            cache: alloc::collections::BTreeMap::new(),
            cache_timestamp: 0,
            cache_ttl: 300, // 5 minutes
        }
    }

    #[cfg(not(feature = "std"))]
    pub fn new(endpoint: alloc::string::String) -> Self {
        Self {
            endpoint,
            cache: alloc::collections::BTreeMap::new(),
            cache_timestamp: 0,
            cache_ttl: 300,
        }
    }

    /// Search for plugins by query
    pub async fn search_plugins(&self, query: &str, limit: usize) -> Result<alloc::vec::Vec<PluginMetadata>> {
        // Check cache first
        if self.is_cache_valid() {
            return self.search_cache(query, limit);
        }

        // Fetch from registry
        #[cfg(feature = "std")]
        {
            let url = format!("{}/api/plugins/search?q={}&limit={}", self.endpoint, query, limit);
            let response = self.client.get(&url).send().await
                .map_err(|e| PluginError::RegistryError {
                    endpoint: self.endpoint.clone(),
                    reason: alloc::format!("request failed: {}", e),
                })?;

            if !response.status().is_success() {
                return Err(PluginError::RegistryError {
                    endpoint: self.endpoint.clone(),
                    reason: alloc::format!("HTTP {}", response.status()),
                });
            }

            let plugins: alloc::vec::Vec<PluginMetadata> = response.json().await
                .map_err(|e| PluginError::RegistryError {
                    endpoint: self.endpoint.clone(),
                    reason: alloc::format!("JSON parse failed: {}", e),
                })?;

            // Update cache
            self.update_cache(plugins.clone());

            Ok(plugins)
        }

        #[cfg(not(feature = "std"))]
        Err(PluginError::RegistryError {
            endpoint: self.endpoint.clone(),
            reason: "HTTP client not available".into(),
        })
    }

    /// Get plugin metadata by ID
    pub async fn get_plugin(&self, plugin_id: &PluginId) -> Result<PluginMetadata> {
        // Check cache first
        if let Some(metadata) = self.cache.get(plugin_id) {
            if self.is_cache_valid() {
                return Ok(metadata.clone());
            }
        }

        // Fetch from registry
        #[cfg(feature = "std")]
        {
            let url = format!("{}/api/plugins/{}", self.endpoint, plugin_id);
            let response = self.client.get(&url).send().await
                .map_err(|e| PluginError::RegistryError {
                    endpoint: self.endpoint.clone(),
                    reason: alloc::format!("request failed: {}", e),
                })?;

            if response.status() == reqwest::StatusCode::NOT_FOUND {
                return Err(PluginError::PluginNotFound {
                    id: plugin_id.clone(),
                });
            }

            if !response.status().is_success() {
                return Err(PluginError::RegistryError {
                    endpoint: self.endpoint.clone(),
                    reason: alloc::format!("HTTP {}", response.status()),
                });
            }

            let metadata: PluginMetadata = response.json().await
                .map_err(|e| PluginError::RegistryError {
                    endpoint: self.endpoint.clone(),
                    reason: alloc::format!("JSON parse failed: {}", e),
                })?;

            // Update cache
            self.update_cache_single(metadata.clone());

            Ok(metadata)
        }

        #[cfg(not(feature = "std"))]
        Err(PluginError::RegistryError {
            endpoint: self.endpoint.clone(),
            reason: "HTTP client not available".into(),
        })
    }

    /// Download plugin binary
    pub async fn download_plugin(&self, plugin_id: &PluginId, version: &PluginVersion) -> Result<alloc::vec::Vec<u8>> {
        #[cfg(feature = "std")]
        {
            let url = format!("{}/api/plugins/{}/download/{}",
                self.endpoint, plugin_id, version);
            let response = self.client.get(&url).send().await
                .map_err(|e| PluginError::RegistryError {
                    endpoint: self.endpoint.clone(),
                    reason: alloc::format!("download failed: {}", e),
                })?;

            if !response.status().is_success() {
                return Err(PluginError::RegistryError {
                    endpoint: self.endpoint.clone(),
                    reason: alloc::format!("HTTP {}", response.status()),
                });
            }

            let bytes = response.bytes().await
                .map_err(|e| PluginError::RegistryError {
                    endpoint: self.endpoint.clone(),
                    reason: alloc::format!("download failed: {}", e),
                })?;

            Ok(bytes.to_vec())
        }

        #[cfg(not(feature = "std"))]
        Err(PluginError::RegistryError {
            endpoint: self.endpoint.clone(),
            reason: "HTTP client not available".into(),
        })
    }

    /// Publish a plugin to the registry
    pub async fn publish_plugin(&self, metadata: &PluginMetadata, binary: &[u8]) -> Result<()> {
        #[cfg(feature = "std")]
        {
            use reqwest::multipart;

            let form = multipart::Form::new()
                .text("id", metadata.id.clone())
                .text("name", metadata.name.clone())
                .text("version", metadata.version.to_string())
                .text("description", metadata.description.clone())
                .text("author", metadata.author.clone())
                .text("license", metadata.license.clone())
                .part("binary", multipart::Part::bytes(binary.to_vec())
                    .file_name(format!("{}.wasm", metadata.id)));

            let url = format!("{}/api/plugins/publish", self.endpoint);
            let response = self.client.post(&url)
                .multipart(form)
                .send().await
                .map_err(|e| PluginError::RegistryError {
                    endpoint: self.endpoint.clone(),
                    reason: alloc::format!("publish failed: {}", e),
                })?;

            if !response.status().is_success() {
                return Err(PluginError::RegistryError {
                    endpoint: self.endpoint.clone(),
                    reason: alloc::format!("HTTP {}", response.status()),
                });
            }

            Ok(())
        }

        #[cfg(not(feature = "std"))]
        Err(PluginError::RegistryError {
            endpoint: self.endpoint.clone(),
            reason: "HTTP client not available".into(),
        })
    }

    /// Get plugin statistics
    pub async fn get_stats(&self) -> Result<RegistryStats> {
        #[cfg(feature = "std")]
        {
            let url = format!("{}/api/stats", self.endpoint);
            let response = self.client.get(&url).send().await
                .map_err(|e| PluginError::RegistryError {
                    endpoint: self.endpoint.clone(),
                    reason: alloc::format!("stats request failed: {}", e),
                })?;

            if !response.status().is_success() {
                return Err(PluginError::RegistryError {
                    endpoint: self.endpoint.clone(),
                    reason: alloc::format!("HTTP {}", response.status()),
                });
            }

            let stats: RegistryStats = response.json().await
                .map_err(|e| PluginError::RegistryError {
                    endpoint: self.endpoint.clone(),
                    reason: alloc::format!("JSON parse failed: {}", e),
                })?;

            Ok(stats)
        }

        #[cfg(not(feature = "std"))]
        Err(PluginError::RegistryError {
            endpoint: self.endpoint.clone(),
            reason: "HTTP client not available".into(),
        })
    }

    /// Check if cache is still valid
    fn is_cache_valid(&self) -> bool {
        let now = current_timestamp();
        now - self.cache_timestamp < self.cache_ttl
    }

    /// Search plugins in cache
    fn search_cache(&self, query: &str, limit: usize) -> Result<alloc::vec::Vec<PluginMetadata>> {
        let mut results = alloc::vec::Vec::new();

        for metadata in self.cache.values() {
            if metadata.name.contains(query) ||
               metadata.description.contains(query) ||
               metadata.id.contains(query) {
                results.push(metadata.clone());
                if results.len() >= limit {
                    break;
                }
            }
        }

        Ok(results)
    }

    /// Update cache with new data
    fn update_cache(&self, plugins: alloc::vec::Vec<PluginMetadata>) {
        // In real implementation, this would update the cache atomically
        for metadata in plugins {
            self.cache.insert(metadata.id.clone(), metadata);
        }
        self.cache_timestamp = current_timestamp();
    }

    /// Update cache with single plugin
    fn update_cache_single(&self, metadata: PluginMetadata) {
        self.cache.insert(metadata.id.clone(), metadata);
        self.cache_timestamp = current_timestamp();
    }

    /// Clear cache
    pub fn clear_cache(&mut self) {
        self.cache.clear();
        self.cache_timestamp = 0;
    }

    /// Get cached plugins
    pub fn cached_plugins(&self) -> alloc::vec::Vec<&PluginMetadata> {
        self.cache.values().collect()
    }
}

/// Registry statistics
#[derive(Debug, Clone, serde::Deserialize, serde::Serialize)]
#[cfg_attr(feature = "serde", derive(serde::Deserialize, serde::Serialize))]
pub struct RegistryStats {
    /// Total number of plugins
    pub total_plugins: u64,
    /// Total downloads
    pub total_downloads: u64,
    /// Active publishers
    pub active_publishers: u32,
    /// Recent uploads (last 30 days)
    pub recent_uploads: u32,
}

/// Plugin marketplace for browsing and installing plugins
#[derive(Debug)]
pub struct PluginMarketplace {
    /// Registry instance
    registry: PluginRegistry,
    /// Installed plugins
    installed_plugins: alloc::collections::BTreeSet<PluginId>,
    /// Installation directory
    install_dir: alloc::string::String,
}

impl PluginMarketplace {
    /// Create a new plugin marketplace
    pub fn new(registry: PluginRegistry, install_dir: alloc::string::String) -> Self {
        Self {
            registry,
            installed_plugins: alloc::collections::BTreeSet::new(),
            install_dir,
        }
    }

    /// Browse available plugins
    pub async fn browse(&self, category: Option<&str>, limit: usize) -> Result<alloc::vec::Vec<PluginMetadata>> {
        let query = category.unwrap_or("");
        self.registry.search_plugins(query, limit).await
    }

    /// Install a plugin
    pub async fn install(&mut self, plugin_id: &PluginId, version: &PluginVersion) -> Result<()> {
        if self.installed_plugins.contains(plugin_id) {
            return Err(PluginError::AlreadyLoaded {
                id: plugin_id.clone(),
            });
        }

        // Download plugin
        let binary = self.registry.download_plugin(plugin_id, version).await?;

        // Save to installation directory
        let filename = format!("{}/{}.wasm", self.install_dir, plugin_id);
        #[cfg(feature = "std")]
        {
            std::fs::write(&filename, &binary)
                .map_err(|e| PluginError::ConfigError {
                    parameter: "install_dir".into(),
                    reason: alloc::format!("write failed: {}", e),
                })?;
        }

        self.installed_plugins.insert(plugin_id.clone());
        Ok(())
    }

    /// Uninstall a plugin
    pub async fn uninstall(&mut self, plugin_id: &PluginId) -> Result<()> {
        if !self.installed_plugins.remove(plugin_id) {
            return Err(PluginError::PluginNotFound {
                id: plugin_id.clone(),
            });
        }

        // Remove from filesystem
        let filename = format!("{}/{}.wasm", self.install_dir, plugin_id);
        #[cfg(feature = "std")]
        {
            std::fs::remove_file(&filename)
                .map_err(|e| PluginError::ConfigError {
                    parameter: "install_dir".into(),
                    reason: alloc::format!("remove failed: {}", e),
                })?;
        }

        Ok(())
    }

    /// Update a plugin to latest version
    pub async fn update(&mut self, plugin_id: &PluginId) -> Result<()> {
        // Get latest version
        let metadata = self.registry.get_plugin(plugin_id).await?;
        self.install(plugin_id, &metadata.version).await
    }

    /// List installed plugins
    pub fn installed_plugins(&self) -> alloc::vec::Vec<&PluginId> {
        self.installed_plugins.iter().collect()
    }

    /// Check if plugin is installed
    pub fn is_installed(&self, plugin_id: &PluginId) -> bool {
        self.installed_plugins.contains(plugin_id)
    }
}

/// Plugin dependency resolver
#[derive(Debug)]
pub struct DependencyResolver {
    /// Registry for dependency lookup
    registry: PluginRegistry,
    /// Resolved dependencies
    resolved: alloc::collections::BTreeMap<PluginId, PluginVersion>,
}

impl DependencyResolver {
    /// Create a new dependency resolver
    pub fn new(registry: PluginRegistry) -> Self {
        Self {
            registry,
            resolved: alloc::collections::BTreeMap::new(),
        }
    }

    /// Resolve all dependencies for a plugin
    pub async fn resolve(&mut self, plugin_id: &PluginId, version: &PluginVersion) -> Result<alloc::vec::Vec<PluginDependency>> {
        let mut to_resolve = alloc::vec::Vec::new();
        let mut resolved_deps = alloc::vec::Vec::new();

        to_resolve.push((plugin_id.clone(), version.clone()));

        while let Some((id, ver)) = to_resolve.pop() {
            if self.resolved.contains_key(&id) {
                continue; // Already resolved
            }

            // Get plugin metadata
            let metadata = self.registry.get_plugin(&id).await?;

            // Check version compatibility
            if metadata.version < ver {
                return Err(PluginError::Incompatible {
                    plugin_id: id,
                    required_version: ver.to_string(),
                    current_version: metadata.version.to_string(),
                });
            }

            self.resolved.insert(id.clone(), ver);

            // Add dependencies to resolution queue
            for dep in &metadata.dependencies {
                if !self.resolved.contains_key(&dep.plugin_id) {
                    // Parse version requirement
                    let dep_version = PluginVersion::parse(&dep.version_range)
                        .unwrap_or(PluginVersion::new(0, 0, 0));
                    to_resolve.push((dep.plugin_id.clone(), dep_version));
                }

                resolved_deps.push(dep.clone());
            }
        }

        Ok(resolved_deps)
    }

    /// Get resolution order (dependencies first)
    pub fn resolution_order(&self) -> alloc::vec::Vec<(&PluginId, &PluginVersion)> {
        self.resolved.iter().collect()
    }

    /// Clear resolved dependencies
    pub fn clear(&mut self) {
        self.resolved.clear();
    }
}

/// Get current timestamp (simplified)
fn current_timestamp() -> u64 {
    // In a real implementation, this would use system time
    0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_plugin_version() {
        let version = PluginVersion::new(1, 2, 3);
        assert_eq!(version.to_string(), "1.2.3");

        let parsed = PluginVersion::parse("1.2.3").unwrap();
        assert_eq!(parsed, version);

        assert!(PluginVersion::parse("invalid").is_none());
    }

    #[test]
    fn test_plugin_metadata() {
        let metadata = PluginMetadata {
            id: "test-plugin".into(),
            name: "Test Plugin".into(),
            version: PluginVersion::new(1, 0, 0),
            description: "A test plugin".into(),
            author: "Test Author".into(),
            license: "MIT".into(),
            dependencies: alloc::vec::Vec::new(),
            capabilities: vec![PluginCapability::DataProcessing],
            permissions: vec![PluginPermission::Read],
            resource_limits: ResourceLimits::default(),
        };

        assert_eq!(metadata.id, "test-plugin");
        assert_eq!(metadata.version, PluginVersion::new(1, 0, 0));
        assert_eq!(metadata.capabilities.len(), 1);
    }

    #[cfg(feature = "std")]
    #[test]
    fn test_plugin_registry() {
        let registry = PluginRegistry::new("https://registry.example.com".into());
        assert_eq!(registry.endpoint, "https://registry.example.com");
        assert!(!registry.is_cache_valid()); // Cache should be invalid initially
    }

    #[test]
    fn test_dependency_resolver() {
        let registry = PluginRegistry::new("https://registry.example.com".into());
        let mut resolver = DependencyResolver::new(registry);

        // Initially empty
        assert!(resolver.resolution_order().is_empty());

        resolver.clear();
        assert!(resolver.resolution_order().is_empty());
    }

    #[test]
    fn test_plugin_marketplace() {
        let registry = PluginRegistry::new("https://registry.example.com".into());
        let marketplace = PluginMarketplace::new(registry, "/tmp/plugins".into());

        assert_eq!(marketplace.install_dir, "/tmp/plugins");
        assert!(!marketplace.is_installed(&"test-plugin".into()));
        assert!(marketplace.installed_plugins().is_empty());
    }
}
