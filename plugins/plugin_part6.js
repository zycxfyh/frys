                } else {
                    if (this.debugMode) console.warn(`[PluginManager] Static plugin ${plugin.name} produced no new output for ${placeholderKey}. Keeping stale value (if any).`);
                    if (!currentValueEntry) {
                        this.staticPlaceholderValues.set(placeholderKey, { value: `[${plugin.name} data currently unavailable]`, serverId: 'local' });
                        if (this.debugMode) console.log(`[PluginManager] Placeholder ${placeholderKey} for ${plugin.name} set to 'unavailable'.`);
                    }
                }
            });
        }
    }

    async initializeStaticPlugins() {
        console.log('[PluginManager] Initializing static plugins...');
        for (const plugin of this.plugins.values()) {
            if (plugin.pluginType === 'static') {
                // Immediately set a "loading" state for the placeholder.
                if (plugin.capabilities && plugin.capabilities.systemPromptPlaceholders) {
                    plugin.capabilities.systemPromptPlaceholders.forEach(ph => {
                        this.staticPlaceholderValues.set(ph.placeholder, { value: `[${plugin.displayName} a-zheng-zai-jia-zai-zhong... ]`, serverId: 'local' });
                    });
                }

                // Trigger the first update in the background (fire and forget).
                this._updateStaticPluginValue(plugin).catch(err => {
                    console.error(`[PluginManager] Initial background update for ${plugin.name} failed: ${err.message}`);
                });

                // Set up the scheduled recurring updates.
                if (plugin.refreshIntervalCron) {
                    if (this.scheduledJobs.has(plugin.name)) {
                        this.scheduledJobs.get(plugin.name).cancel();
                    }
                    try {
                        const job = schedule.scheduleJob(plugin.refreshIntervalCron, () => {
                            if (this.debugMode) console.log(`[PluginManager] Scheduled update for static plugin: ${plugin.name}`);
                            this._updateStaticPluginValue(plugin).catch(err => {
                                 console.error(`[PluginManager] Scheduled background update for ${plugin.name} failed: ${err.message}`);
                            });
                        });
                        this.scheduledJobs.set(plugin.name, job);
                        if (this.debugMode) console.log(`[PluginManager] Scheduled ${plugin.name} with cron: ${plugin.refreshIntervalCron}`);
                    } catch (e) {
                        console.error(`[PluginManager] Invalid cron string for ${plugin.name}: ${plugin.refreshIntervalCron}. Error: ${e.message}`);
                    }
                }
            }
        }
        console.log('[PluginManager] Static plugins initialization process has been started (updates will run in the background).');
    }
    async prewarmPythonPlugins() {
        console.log('[PluginManager] Checking for Python plugins to pre-warm...');
        if (this.plugins.has('SciCalculator')) {
            console.log('[PluginManager] SciCalculator found. Starting pre-warming of Python scientific libraries in the background.');
            try {
                const command = 'python';
                const args = ['-c', 'import sympy, scipy.stats, scipy.integrate, numpy'];
                const prewarmProcess = spawn(command, args, {
                    // 移除 shell: true
                    windowsHide: true
                });

                prewarmProcess.on('error', (err) => {
                    console.warn(`[PluginManager] Python pre-warming process failed to start. Is Python installed and in the system's PATH? Error: ${err.message}`);
                });

                prewarmProcess.stderr.on('data', (data) => {
                    console.warn(`[PluginManager] Python pre-warming process stderr: ${data.toString().trim()}`);
                });

                prewarmProcess.on('exit', (code) => {
                    if (code === 0) {
                        console.log('[PluginManager] Python scientific libraries pre-warmed successfully.');
                    } else {
                        console.warn(`[PluginManager] Python pre-warming process exited with code ${code}. Please ensure required libraries are installed (pip install sympy scipy numpy).`);
                    }
                });
            } catch (e) {
                console.error(`[PluginManager] An exception occurred while spawning the Python pre-warming process: ${e.message}`);
            }
        } else {
            if (this.debugMode) console.log('[PluginManager] SciCalculator not found, skipping Python pre-warming.');
        }
    }
    
    
    getPlaceholderValue(placeholder) {
        const entry = this.staticPlaceholderValues.get(placeholder);
        return entry ? entry.value : `[Placeholder ${placeholder} not found]`;
    }

    async executeMessagePreprocessor(pluginName, messages) {
        const processorModule = this.messagePreprocessors.get(pluginName);
        const pluginManifest = this.plugins.get(pluginName);
        if (!processorModule || !pluginManifest) {
            console.error(`[PluginManager] Message preprocessor plugin "${pluginName}" not found.`);
            return messages;
        }
        if (typeof processorModule.processMessages !== 'function') {
            console.error(`[PluginManager] Plugin "${pluginName}" does not have 'processMessages' function.`);
            return messages;
        }
        try {
            if (this.debugMode) console.log(`[PluginManager] Executing message preprocessor: ${pluginName}`);
            const pluginSpecificConfig = this._getPluginConfig(pluginManifest);
            const processedMessages = await processorModule.processMessages(messages, pluginSpecificConfig);
            if (this.debugMode) console.log(`[PluginManager] Message preprocessor ${pluginName} finished.`);
            return processedMessages;
        } catch (error) {
            console.error(`[PluginManager] Error in message preprocessor ${pluginName}:`, error);
            return messages;
        }
    }
    
    async shutdownAllPlugins() {
        console.log('[PluginManager] Shutting down all plugins...'); // Keep

        // --- Shutdown VectorDBManager first to stop background processing ---
        if (this.vectorDBManager && typeof this.vectorDBManager.shutdown === 'function') {
            try {
                if (this.debugMode) console.log('[PluginManager] Calling shutdown for VectorDBManager...');
                await this.vectorDBManager.shutdown();
            } catch (error) {
                console.error('[PluginManager] Error during shutdown of VectorDBManager:', error);
            }
        }

        for (const [name, pluginModuleData] of this.messagePreprocessors) {
             const pluginModule = pluginModuleData.module || pluginModuleData;
            if (pluginModule && typeof pluginModule.shutdown === 'function') {
                try {
                    if (this.debugMode) console.log(`[PluginManager] Calling shutdown for ${name}...`);
                    await pluginModule.shutdown();
                } catch (error) {
                    console.error(`[PluginManager] Error during shutdown of plugin ${name}:`, error); // Keep error
                }
            }
        }
        for (const [name, serviceData] of this.serviceModules) {
            if (serviceData.module && typeof serviceData.module.shutdown === 'function') {
                try {
                    if (this.debugMode) console.log(`[PluginManager] Calling shutdown for service plugin ${name}...`);
                    await serviceData.module.shutdown();
                } catch (error) {
                    console.error(`[PluginManager] Error during shutdown of service plugin ${name}:`, error); // Keep error
                }
            }
        }
        for (const job of this.scheduledJobs.values()) {
            job.cancel();
        }
        this.scheduledJobs.clear();
        console.log('[PluginManager] All plugin shutdown processes initiated and scheduled jobs cancelled.'); // Keep
    }

    async loadPlugins() {
        console.log('[PluginManager] Starting plugin discovery...');
        // 1. 清理现有插件状态
        const localPlugins = new Map();
        for (const [name, manifest] of this.plugins.entries()) {
            if (!manifest.isDistributed) {
                localPlugins.set(name, manifest);
            }
        }
        this.plugins = localPlugins;
        this.messagePreprocessors.clear();
        this.staticPlaceholderValues.clear();
        this.serviceModules.clear();

        const discoveredPreprocessors = new Map();
        const modulesToInitialize = [];

        try {
            // 2. 发现并加载所有插件模块，但不初始化
            const pluginFolders = await fs.readdir(PLUGIN_DIR, { withFileTypes: true });
            for (const folder of pluginFolders) {
                if (folder.isDirectory()) {
                    const pluginPath = path.join(PLUGIN_DIR, folder.name);
                    const manifestPath = path.join(pluginPath, manifestFileName);
                    try {
                        const manifestContent = await fs.readFile(manifestPath, 'utf-8');
                        const manifest = JSON.parse(manifestContent);
                        if (!manifest.name || !manifest.pluginType || !manifest.entryPoint) continue;
                        if (this.plugins.has(manifest.name)) continue;
                        
                        manifest.basePath = pluginPath;
                        manifest.pluginSpecificEnvConfig = {};
                        try {
                            const pluginEnvContent = await fs.readFile(path.join(pluginPath, 'config.env'), 'utf-8');
                            manifest.pluginSpecificEnvConfig = dotenv.parse(pluginEnvContent);
                        } catch (envError) {
                            if (envError.code !== 'ENOENT') console.warn(`[PluginManager] Error reading config.env for ${manifest.name}:`, envError.message);
                        }

                        this.plugins.set(manifest.name, manifest);
                        console.log(`[PluginManager] Loaded manifest: ${manifest.displayName} (${manifest.name}, Type: ${manifest.pluginType})`);

                        const isPreprocessor = manifest.pluginType === 'messagePreprocessor' || manifest.pluginType === 'hybridservice';
                        const isService = manifest.pluginType === 'service' || manifest.pluginType === 'hybridservice';

                        if ((isPreprocessor || isService) && manifest.entryPoint.script && manifest.communication?.protocol === 'direct') {
                            try {
