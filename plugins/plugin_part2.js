                            try {
                                const scriptPath = path.join(pluginPath, manifest.entryPoint.script);
                                const module = require(scriptPath);
                                
                                modulesToInitialize.push({ manifest, module });

                                if (isPreprocessor && typeof module.processMessages === 'function') {
                                    discoveredPreprocessors.set(manifest.name, module);
                                }
                                if (isService) {
                                    this.serviceModules.set(manifest.name, { manifest, module });
                                }
                            } catch (e) {
                                console.error(`[PluginManager] Error loading module for ${manifest.name}:`, e);
                            }
                        }
                    } catch (error) {
                        if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) {
                            console.error(`[PluginManager] Error loading plugin from ${folder.name}:`, error);
                        }
                    }
                }
            }

            // 3. 确定预处理器加载顺序
            const availablePlugins = new Set(discoveredPreprocessors.keys());
            let finalOrder = [];
            try {
                const orderContent = await fs.readFile(PREPROCESSOR_ORDER_FILE, 'utf-8');
                const savedOrder = JSON.parse(orderContent);
                if (Array.isArray(savedOrder)) {
                    savedOrder.forEach(pluginName => {
                        if (availablePlugins.has(pluginName)) {
                            finalOrder.push(pluginName);
                            availablePlugins.delete(pluginName);
                        }
                    });
                }
            } catch (error) {
                if (error.code !== 'ENOENT') console.error(`[PluginManager] Error reading existing ${PREPROCESSOR_ORDER_FILE}:`, error);
            }
            
            finalOrder.push(...Array.from(availablePlugins).sort());
            
            // 4. 注册预处理器
            for (const pluginName of finalOrder) {
                this.messagePreprocessors.set(pluginName, discoveredPreprocessors.get(pluginName));
            }
            this.preprocessorOrder = finalOrder;
            if (finalOrder.length > 0) console.log('[PluginManager] Final message preprocessor order: ' + finalOrder.join(' -> '));

            // 5. 初始化共享服务 (VectorDBManager)
            if (this.vectorDBManager) {
                await this.vectorDBManager.initialize();
            }

            // 6. 按顺序初始化所有模块
            const allModulesMap = new Map(modulesToInitialize.map(m => [m.manifest.name, m]));
            const initializationOrder = [...this.preprocessorOrder];
            allModulesMap.forEach((_, name) => {
                if (!initializationOrder.includes(name)) {
                    initializationOrder.push(name);
                }
            });

            for (const pluginName of initializationOrder) {
                const item = allModulesMap.get(pluginName);
                if (!item || typeof item.module.initialize !== 'function') continue;

                const { manifest, module } = item;
                try {
                    const initialConfig = this._getPluginConfig(manifest);
                    initialConfig.PORT = process.env.PORT;
                    initialConfig.Key = process.env.Key;
                    initialConfig.PROJECT_BASE_PATH = this.projectBasePath;

                    const dependencies = { vcpLogFunctions: this.getVCPLogFunctions() };

                    // --- 注入 VectorDBManager ---
                    if (manifest.name === 'RAGDiaryPlugin') {
                        dependencies.vectorDBManager = this.vectorDBManager;
                    }

                    // --- LightMemo 特殊依赖注入 ---
                    if (manifest.name === 'LightMemo') {
                        const ragPluginModule = this.messagePreprocessors.get('RAGDiaryPlugin');
                        if (ragPluginModule && ragPluginModule.vectorDBManager && typeof ragPluginModule.getSingleEmbedding === 'function') {
                            dependencies.vectorDBManager = ragPluginModule.vectorDBManager;
                            dependencies.getSingleEmbedding = ragPluginModule.getSingleEmbedding.bind(ragPluginModule);
                            if (this.debugMode) console.log(`[PluginManager] Injected VectorDBManager and getSingleEmbedding into LightMemo.`);
                        } else {
                            console.error(`[PluginManager] Critical dependency failure: RAGDiaryPlugin or its components not available for LightMemo injection.`);
                        }
                    }
                    // --- 注入结束 ---

                    await module.initialize(initialConfig, dependencies);
                } catch (e) {
                    console.error(`[PluginManager] Error initializing module for ${manifest.name}:`, e);
                }
            }

            this.buildVCPDescription();
            console.log(`[PluginManager] Plugin discovery finished. Loaded ${this.plugins.size} plugins.`);
        } catch (error) {
            if (error.code === 'ENOENT') console.error(`[PluginManager] Plugin directory ${PLUGIN_DIR} not found.`);
            else console.error('[PluginManager] Error reading plugin directory:', error);
        }
    }

    buildVCPDescription() {
        this.individualPluginDescriptions.clear(); // Clear previous descriptions
        let overallLog = ['[PluginManager] Building individual VCP descriptions:'];

        for (const plugin of this.plugins.values()) {
            if (plugin.capabilities && plugin.capabilities.invocationCommands && plugin.capabilities.invocationCommands.length > 0) {
                let pluginSpecificDescriptions = [];
                plugin.capabilities.invocationCommands.forEach(cmd => {
                    if (cmd.description) {
                        let commandDescription = `- ${plugin.displayName} (${plugin.name}) - 命令: ${cmd.command || 'N/A'}:\n`; // Assuming cmd might have a 'command' field or similar identifier
                        const indentedCmdDescription = cmd.description.split('\n').map(line => `    ${line}`).join('\n');
                        commandDescription += `${indentedCmdDescription}`;
                        
                        if (cmd.example) {
                            const exampleHeader = `\n  调用示例:\n`;
                            const indentedExample = cmd.example.split('\n').map(line => `    ${line}`).join('\n');
                            commandDescription += exampleHeader + indentedExample;
                        }
                        pluginSpecificDescriptions.push(commandDescription);
                    }
                });

                if (pluginSpecificDescriptions.length > 0) {
                    const placeholderKey = `VCP${plugin.name}`;
                    const fullDescriptionForPlugin = pluginSpecificDescriptions.join('\n\n');
                    this.individualPluginDescriptions.set(placeholderKey, fullDescriptionForPlugin);
                    overallLog.push(`  - Generated description for {{${placeholderKey}}} (Length: ${fullDescriptionForPlugin.length})`);
                }
            }
        }

        if (this.individualPluginDescriptions.size === 0) {
            overallLog.push("  - No VCP plugins with invocation commands found to generate descriptions for.");
        }
        if (this.debugMode) console.log(overallLog.join('\n'));
    }

    // New method to get all individual descriptions
    getIndividualPluginDescriptions() {
        return this.individualPluginDescriptions;
    }

    // getVCPDescription() { // This method is no longer needed as VCPDescription is deprecated
    //     return this.vcpDescription;
    // }
    
    getPlugin(name) {
        return this.plugins.get(name);
    }

    getServiceModule(name) {
        return this.serviceModules.get(name)?.module;
    }
    
    // 新增：获取 VCPLog 插件的推送函数，供其他插件依赖注入
    getVCPLogFunctions() {
        const vcpLogModule = this.getServiceModule('VCPLog');
        if (vcpLogModule) {
            return {
                pushVcpLog: vcpLogModule.pushVcpLog,
                pushVcpInfo: vcpLogModule.pushVcpInfo
            };
        }
        return { pushVcpLog: () => {}, pushVcpInfo: () => {} };
    }

    async processToolCall(toolName, toolArgs, requestIp = null) {
        const plugin = this.plugins.get(toolName);
        if (!plugin) {
            throw new Error(`[PluginManager] Plugin "${toolName}" not found for tool call.`);
        }

        // Helper function to generate a timestamp string
        const _getFormattedLocalTimestamp = () => {
            const date = new Date();
            const year = date.getFullYear();
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            const seconds = date.getSeconds().toString().padStart(2, '0');
            const milliseconds = date.getMilliseconds().toString().padStart(3, '0');
            const timezoneOffsetMinutes = date.getTimezoneOffset();
            const offsetSign = timezoneOffsetMinutes > 0 ? "-" : "+";
            const offsetHours = Math.abs(Math.floor(timezoneOffsetMinutes / 60)).toString().padStart(2, '0');
            const offsetMinutes = Math.abs(timezoneOffsetMinutes % 60).toString().padStart(2, '0');
            const timezoneString = `${offsetSign}${offsetHours}:${offsetMinutes}`;
            return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}${timezoneString}`;
        };

        const maidNameFromArgs = toolArgs && toolArgs.maid ? toolArgs.maid : null;
