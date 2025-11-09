        const maidNameFromArgs = toolArgs && toolArgs.maid ? toolArgs.maid : null;
        const pluginSpecificArgs = { ...toolArgs };
        if (maidNameFromArgs) {
            // The 'maid' parameter is intentionally passed through for plugins like DeepMemo.
            // delete pluginSpecificArgs.maid;
        }

        try {
            let resultFromPlugin;
            if (plugin.isDistributed) {
                // --- 分布式插件调用逻辑 ---
                if (!this.webSocketServer) {
                    throw new Error('[PluginManager] WebSocketServer is not initialized. Cannot call distributed tool.');
                }
                if (this.debugMode) console.log(`[PluginManager] Processing distributed tool call for: ${toolName} on server ${plugin.serverId}`);
                resultFromPlugin = await this.webSocketServer.executeDistributedTool(plugin.serverId, toolName, pluginSpecificArgs);
                // 分布式工具的返回结果应该已经是JS对象了
            } else if (toolName === 'ChromeControl' && plugin.communication?.protocol === 'direct') {
               // --- ChromeControl 特殊处理逻辑 ---
               if (!this.webSocketServer) {
                   throw new Error('[PluginManager] WebSocketServer is not initialized. Cannot call ChromeControl tool.');
               }
               if (this.debugMode) console.log(`[PluginManager] Processing direct WebSocket tool call for: ${toolName}`);
               const command = pluginSpecificArgs.command;
               delete pluginSpecificArgs.command;
               resultFromPlugin = await this.webSocketServer.forwardCommandToChrome(command, pluginSpecificArgs);

            } else if (plugin.pluginType === 'hybridservice' && plugin.communication?.protocol === 'direct') {
               // --- 混合服务插件直接调用逻辑 ---
               if (this.debugMode) console.log(`[PluginManager] Processing direct tool call for hybrid service: ${toolName}`);
               const serviceModule = this.getServiceModule(toolName);
               if (serviceModule && typeof serviceModule.processToolCall === 'function') {
                   resultFromPlugin = await serviceModule.processToolCall(pluginSpecificArgs);
               } else {
                   throw new Error(`[PluginManager] Hybrid service plugin "${toolName}" does not have a processToolCall function.`);
               }
            } else {
                // --- 本地插件调用逻辑 (现有逻辑) ---
                if (!((plugin.pluginType === 'synchronous' || plugin.pluginType === 'asynchronous') && plugin.communication?.protocol === 'stdio')) {
                    throw new Error(`[PluginManager] Local plugin "${toolName}" (type: ${plugin.pluginType}) is not a supported stdio plugin for direct tool call.`);
                }
                
                let executionParam = null;
                if (Object.keys(pluginSpecificArgs).length > 0) {
                    executionParam = JSON.stringify(pluginSpecificArgs);
                }
                
                const logParam = executionParam ? (executionParam.length > 100 ? executionParam.substring(0, 100) + '...' : executionParam) : null;
                if (this.debugMode) console.log(`[PluginManager] Calling local executePlugin for: ${toolName} with prepared param:`, logParam);

                const pluginOutput = await this.executePlugin(toolName, executionParam, requestIp); // Returns {status, result/error}

                if (pluginOutput.status === "success") {
                    if (typeof pluginOutput.result === 'string') {
                        try {
                            // If the result is a string, try to parse it as JSON.
                            resultFromPlugin = JSON.parse(pluginOutput.result);
                        } catch (parseError) {
                            // If parsing fails, wrap it. This is for plugins that return plain text.
                            if (this.debugMode) console.warn(`[PluginManager] Local plugin ${toolName} result string was not valid JSON. Original: "${pluginOutput.result.substring(0, 100)}"`);
                            resultFromPlugin = { original_plugin_output: pluginOutput.result };
                        }
                    } else {
                        // If the result is already an object (as with our new image plugins), use it directly.
                        resultFromPlugin = pluginOutput.result;
                    }
                } else {
                    // 检查是否是文件未找到的特定错误
                    if (pluginOutput.code === 'FILE_NOT_FOUND_LOCALLY' && pluginOutput.fileUrl && requestIp) {
                        if (this.debugMode) console.log(`[PluginManager] Plugin '${toolName}' reported local file not found. Attempting to fetch via FileFetcherServer...`);
                        
                        try {
                            const { buffer, mimeType } = await FileFetcherServer.fetchFile(pluginOutput.fileUrl, requestIp);
                            const base64Data = buffer.toString('base64');
                            const dataUri = `data:${mimeType};base64,${base64Data}`;
                            
                            if (this.debugMode) console.log(`[PluginManager] Successfully fetched file as data URI. Retrying plugin call...`);
                            
                            // 新的重试逻辑：精确替换失败的参数
                            const newToolArgs = { ...toolArgs };
                            const failedParam = pluginOutput.failedParameter; // e.g., "image_url1"

                            if (failedParam && newToolArgs[failedParam]) {
                                // 删除旧的 file:// url 参数
                                delete newToolArgs[failedParam];
                                
                                // 添加新的 base64 参数。我们使用一个新的键来避免命名冲突，
                                // 并且让插件知道这是一个已经处理过的 base64 数据。
                                // e.g., "image_base64_1"
                               // 关键修复：确保正确地从 "image_url_1" 提取出 "1"
                               const paramIndex = failedParam.replace('image_url_', '');
                               const newParamKey = `image_base64_${paramIndex}`;
                               newToolArgs[newParamKey] = dataUri;
                               
                               if (this.debugMode) console.log(`[PluginManager] Retrying with '${failedParam}' replaced by '${newParamKey}'.`);

                            } else {
                                // 旧的后备逻辑，用于兼容单个 image_url 的情况
                                delete newToolArgs.image_url;
                                newToolArgs.image_base64 = dataUri;
                                if (this.debugMode) console.log(`[PluginManager] 'failedParameter' not specified. Falling back to replacing 'image_url' with 'image_base64'.`);
                            }
                            
                            // 直接返回重试调用的结果
                            return await this.processToolCall(toolName, newToolArgs, requestIp);

                        } catch (fetchError) {
                            throw new Error(JSON.stringify({
                                plugin_error: `Plugin reported local file not found, but remote fetch failed: ${fetchError.message}`,
                                original_plugin_error: pluginOutput.error
                            }));
                        }
                    } else {
                        throw new Error(JSON.stringify({ plugin_error: pluginOutput.error || `Plugin "${toolName}" reported an unspecified error.` }));
                    }
                }
            }

            // --- 通用结果处理 ---
            const finalResultObject = (typeof resultFromPlugin === 'object' && resultFromPlugin !== null) ? resultFromPlugin : { original_plugin_output: resultFromPlugin };

            if (maidNameFromArgs) {
                finalResultObject.MaidName = maidNameFromArgs;
            }
            finalResultObject.timestamp = _getFormattedLocalTimestamp();
            
            return finalResultObject;

        } catch (e) {
            console.error(`[PluginManager processToolCall] Error during execution for plugin ${toolName}:`, e.message);
            let errorObject;
            try {
                errorObject = JSON.parse(e.message);
            } catch (jsonParseError) {
                errorObject = { plugin_execution_error: e.message || 'Unknown plugin execution error' };
            }
            
            if (maidNameFromArgs && !errorObject.MaidName) {
                errorObject.MaidName = maidNameFromArgs;
            }
            if (!errorObject.timestamp) {
                errorObject.timestamp = _getFormattedLocalTimestamp();
            }
            throw new Error(JSON.stringify(errorObject));
        }
    }

    async executePlugin(pluginName, inputData, requestIp = null) {
        const plugin = this.plugins.get(pluginName);
        if (!plugin) {
            // This case should ideally be caught by processToolCall before calling executePlugin
            throw new Error(`[PluginManager executePlugin] Plugin "${pluginName}" not found.`);
        }
        // Validations for pluginType, communication, entryPoint remain important
        if (!((plugin.pluginType === 'synchronous' || plugin.pluginType === 'asynchronous') && plugin.communication?.protocol === 'stdio')) {
            throw new Error(`[PluginManager executePlugin] Plugin "${pluginName}" (type: ${plugin.pluginType}, protocol: ${plugin.communication?.protocol}) is not a supported stdio plugin. Expected synchronous or asynchronous stdio plugin.`);
        }
        if (!plugin.entryPoint || !plugin.entryPoint.command) {
            throw new Error(`[PluginManager executePlugin] Entry point command undefined for plugin "${pluginName}".`);
        }
        
        const pluginConfig = this._getPluginConfig(plugin);
        const envForProcess = { ...process.env };

        for (const key in pluginConfig) {
            if (Object.hasOwn(pluginConfig, key) && pluginConfig[key] !== undefined) {
                envForProcess[key] = String(pluginConfig[key]);
            }
        }
        
        const additionalEnv = {};
        if (this.projectBasePath) {
            additionalEnv.PROJECT_BASE_PATH = this.projectBasePath;
        } else {
            if (this.debugMode) console.warn("[PluginManager executePlugin] projectBasePath not set, PROJECT_BASE_PATH will not be available to plugins.");
        }

        // 如果插件需要管理员权限，则获取解密后的验证码并注入环境变量
        if (plugin.requiresAdmin) {
            const decryptedCode = await this._getDecryptedAuthCode();
            if (decryptedCode) {
                additionalEnv.DECRYPTED_AUTH_CODE = decryptedCode;
                if (this.debugMode) console.log(`[PluginManager] Injected DECRYPTED_AUTH_CODE for admin-required plugin: ${pluginName}`);
            } else {
                if (this.debugMode) console.warn(`[PluginManager] Could not get decrypted auth code for admin-required plugin: ${pluginName}. Execution will proceed without it.`);
            }
        }
        // 将 requestIp 添加到环境变量
        if (requestIp) {
            additionalEnv.VCP_REQUEST_IP = requestIp;
        }
        if (process.env.PORT) {
            additionalEnv.SERVER_PORT = process.env.PORT;
        }
        const imageServerKey = this.getResolvedPluginConfigValue('ImageServer', 'Image_Key');
        if (imageServerKey) {
            additionalEnv.IMAGESERVER_IMAGE_KEY = imageServerKey;
        }

        // Pass CALLBACK_BASE_URL and PLUGIN_NAME to asynchronous plugins
        if (plugin.pluginType === 'asynchronous') {
