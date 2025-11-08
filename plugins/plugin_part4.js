                    app.use(`/api/plugins/${name}`, pluginRouter);
                    if (this.debugMode) console.log(`[PluginManager] Mounted API routes for ${name} at /api/plugins/${name}`);
                }
                
                // VCPLog 特殊处理：注入 WebSocketServer 的广播函数
                if (name === 'VCPLog' && this.webSocketServer && typeof module.setBroadcastFunctions === 'function') {
                    if (typeof this.webSocketServer.broadcastVCPInfo === 'function') {
                        module.setBroadcastFunctions(this.webSocketServer.broadcastVCPInfo);
                        if (this.debugMode) console.log(`[PluginManager] Injected broadcastVCPInfo into VCPLog.`);
                    } else {
                        console.warn(`[PluginManager] WebSocketServer is missing broadcastVCPInfo function. VCPInfo will not be broadcastable.`);
                    }
                }

                // 兼容旧的、直接在 app 上注册的 service 插件
                if (typeof module.registerRoutes === 'function') {
                    if (this.debugMode) console.log(`[PluginManager] Registering legacy routes for service plugin: ${name}`);
                    if (module.registerRoutes.length >= 4) {
                        if (this.debugMode) console.log(`[PluginManager] Calling new-style legacy registerRoutes for ${name} (4+ args).`);
                        module.registerRoutes(app, adminApiRouter, pluginConfig, projectBasePath);
                    } else {
                        if (this.debugMode) console.log(`[PluginManager] Calling legacy-style registerRoutes for ${name} (3 args).`);
                        module.registerRoutes(app, pluginConfig, projectBasePath);
                    }
                }

            } catch (e) {
                console.error(`[PluginManager] Error initializing service plugin ${name}:`, e); // Keep error
            }
        }
        console.log('[PluginManager] Service plugins initialized.'); // Keep
    }
    // --- 新增分布式插件管理方法 ---
    registerDistributedTools(serverId, tools) {
        if (this.debugMode) console.log(`[PluginManager] Registering ${tools.length} tools from distributed server: ${serverId}`);
        for (const toolManifest of tools) {
            if (!toolManifest.name || !toolManifest.pluginType || !toolManifest.entryPoint) {
                if (this.debugMode) console.warn(`[PluginManager] Invalid manifest from ${serverId} for tool '${toolManifest.name}'. Skipping.`);
                continue;
            }
            if (this.plugins.has(toolManifest.name)) {
                if (this.debugMode) console.warn(`[PluginManager] Distributed tool '${toolManifest.name}' from ${serverId} conflicts with an existing tool. Skipping.`);
                continue;
            }
            
            // 标记为分布式插件并存储其来源服务器ID
            toolManifest.isDistributed = true;
            toolManifest.serverId = serverId;
            
            // 在显示名称前加上[云端]前缀
            toolManifest.displayName = `[云端] ${toolManifest.displayName || toolManifest.name}`;

            this.plugins.set(toolManifest.name, toolManifest);
            console.log(`[PluginManager] Registered distributed tool: ${toolManifest.displayName} (${toolManifest.name}) from ${serverId}`);
        }
        // 注册后重建描述，以包含新插件
        this.buildVCPDescription();
    }

    unregisterAllDistributedTools(serverId) {
        if (this.debugMode) console.log(`[PluginManager] Unregistering all tools from distributed server: ${serverId}`);
        let unregisteredCount = 0;
        for (const [name, manifest] of this.plugins.entries()) {
            if (manifest.isDistributed && manifest.serverId === serverId) {
                this.plugins.delete(name);
                unregisteredCount++;
                if (this.debugMode) console.log(`  - Unregistered: ${name}`);
            }
        }
        if (unregisteredCount > 0) {
            console.log(`[PluginManager] Unregistered ${unregisteredCount} tools from server ${serverId}.`);
            // 注销后重建描述
            this.buildVCPDescription();
        }
        
        // 新增：清理分布式静态占位符
        this.clearDistributedStaticPlaceholders(serverId);
    }

    // 新增：更新分布式静态占位符
    updateDistributedStaticPlaceholders(serverId, serverName, placeholders) {
        if (this.debugMode) {
            console.log(`[PluginManager] Updating static placeholders from distributed server ${serverName} (${serverId})`);
        }
        
        for (const [placeholder, value] of Object.entries(placeholders)) {
            // 为分布式占位符添加服务器来源标识
            this.staticPlaceholderValues.set(placeholder, { value: value, serverId: serverId });
            
            if (this.debugMode) {
                console.log(`[PluginManager] Updated distributed placeholder ${placeholder} from ${serverName}: ${value.substring(0, 100)}${value.length > 100 ? '...' : ''}`);
            }
        }
        
        // 强制日志记录分布式静态占位符更新
        console.log(`[PluginManager] Updated ${Object.keys(placeholders).length} static placeholders from distributed server ${serverName}.`);
    }

    // 新增：清理分布式静态占位符
    clearDistributedStaticPlaceholders(serverId) {
        const placeholdersToRemove = [];
        
        for (const [placeholder, entry] of this.staticPlaceholderValues.entries()) {
            if (entry && entry.serverId === serverId) {
                placeholdersToRemove.push(placeholder);
            }
        }
        
        for (const placeholder of placeholdersToRemove) {
            this.staticPlaceholderValues.delete(placeholder);
            if (this.debugMode) {
                console.log(`[PluginManager] Removed distributed placeholder ${placeholder} from disconnected server ${serverId}`);
            }
        }
        
        if (placeholdersToRemove.length > 0) {
            console.log(`[PluginManager] Cleared ${placeholdersToRemove.length} static placeholders from disconnected server ${serverId}.`);
        }
    }

    // --- 新增方法 ---
    async hotReloadPluginsAndOrder() {
        console.log('[PluginManager] Hot reloading plugins and preprocessor order...');
        // 重新加载所有插件，这将自动应用新的顺序
        await this.loadPlugins();
        console.log('[PluginManager] Hot reload complete.');
        return this.getPreprocessorOrder();
    }

    getPreprocessorOrder() {
        // 返回所有已发现、已排序的预处理器信息
        return this.preprocessorOrder.map(name => {
            const manifest = this.plugins.get(name);
            return {
                name: name,
                displayName: manifest ? manifest.displayName : name,
                description: manifest ? manifest.description : 'N/A'
            };
        });
    }
    startPluginWatcher() {
        if (this.debugMode) console.log('[PluginManager] Starting plugin file watcher...');
        
        const pathsToWatch = [
            path.join(PLUGIN_DIR, '**/plugin-manifest.json'),
            path.join(PLUGIN_DIR, '**/plugin-manifest.json.block')
        ];

        const watcher = chokidar.watch(pathsToWatch, {
            persistent: true,
            ignoreInitial: true, // Don't fire on initial scan
            awaitWriteFinish: {
                stabilityThreshold: 500,
                pollInterval: 100
            }
        });

        watcher
            .on('add', filePath => this.handlePluginManifestChange('add', filePath))
            .on('change', filePath => this.handlePluginManifestChange('change', filePath))
            .on('unlink', filePath => this.handlePluginManifestChange('unlink', filePath));
            
        console.log(`[PluginManager] Chokidar is now watching for manifest changes in: ${PLUGIN_DIR}`);
    }

    handlePluginManifestChange(eventType, filePath) {
        if (this.isReloading) {
            if (this.debugMode) console.log(`[PluginManager] Already reloading, skipping event '${eventType}' for: ${filePath}`);
            return;
        }
        
        clearTimeout(this.reloadTimeout);
        
        if (this.debugMode) console.log(`[PluginManager] Debouncing plugin reload trigger due to '${eventType}' event on: ${path.basename(filePath)}`);

        this.reloadTimeout = setTimeout(async () => {
            this.isReloading = true;
            console.log(`[PluginManager] Manifest file change detected ('${eventType}'). Hot-reloading plugins...`);
            
            try {
                await this.loadPlugins();
                console.log('[PluginManager] Hot-reload complete.');

                if (this.webSocketServer && typeof this.webSocketServer.broadcastToAdminPanel === 'function') {
                    this.webSocketServer.broadcastToAdminPanel({
                        type: 'plugins-reloaded',
                        message: 'Plugin list has been updated due to file changes.'
                    });
                    if (this.debugMode) console.log('[PluginManager] Notified admin panel about plugin reload.');
                }
            } catch (error) {
                console.error('[PluginManager] Error during hot-reload:', error);
            } finally {
                this.isReloading = false;
            }
        }, 500); // 500ms debounce window
    }
}

const pluginManager = new PluginManager();

// 新增：获取所有静态占位符值
pluginManager.getAllPlaceholderValues = function() {
    const valuesMap = new Map();
    for (const [key, entry] of this.staticPlaceholderValues.entries()) {
        valuesMap.set(key, entry.value || `[Placeholder ${key} not found]`);
    }
    return valuesMap;
};

