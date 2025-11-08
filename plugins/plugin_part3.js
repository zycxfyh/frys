        if (plugin.pluginType === 'asynchronous') {
            const callbackBaseUrl = pluginConfig.CALLBACK_BASE_URL || process.env.CALLBACK_BASE_URL; // Prefer plugin-specific, then global
            if (callbackBaseUrl) {
                additionalEnv.CALLBACK_BASE_URL = callbackBaseUrl;
            } else {
                if (this.debugMode) console.warn(`[PluginManager executePlugin] CALLBACK_BASE_URL not configured for asynchronous plugin ${pluginName}. Callback functionality might be impaired.`);
            }
            additionalEnv.PLUGIN_NAME_FOR_CALLBACK = pluginName; // Pass the plugin's name
        }
        
        // Force Python stdio encoding to UTF-8
        additionalEnv.PYTHONIOENCODING = 'utf-8';
        const finalEnv = { ...envForProcess, ...additionalEnv };

        if (this.debugMode && plugin.pluginType === 'asynchronous') {
            console.log(`[PluginManager executePlugin] Final ENV for async plugin ${pluginName}:`, JSON.stringify(finalEnv, null, 2).substring(0, 500) + "...");
        }

        return new Promise((resolve, reject) => {
            if (this.debugMode) console.log(`[PluginManager executePlugin Internal] For plugin "${pluginName}", manifest entryPoint command is: "${plugin.entryPoint.command}"`);
            const [command, ...args] = plugin.entryPoint.command.split(' ');
            if (this.debugMode) console.log(`[PluginManager executePlugin Internal] Attempting to spawn command: "${command}" with args: [${args.join(', ')}] in cwd: ${plugin.basePath}`);

            const pluginProcess = spawn(command, args, { cwd: plugin.basePath, shell: true, env: finalEnv, windowsHide: true });
            let outputBuffer = ''; // Buffer to accumulate data chunks
            let errorOutput = '';
            let processExited = false;
            let initialResponseSent = false; // Flag for async plugins
            const isAsyncPlugin = plugin.pluginType === 'asynchronous';

            const timeoutDuration = plugin.communication.timeout || (isAsyncPlugin ? 1800000 : 60000); // Use manifest timeout, or 30min for async, 1min for sync
            
            const timeoutId = setTimeout(() => {
                if (!processExited && !initialResponseSent && isAsyncPlugin) {
                    // For async, if initial response not sent by timeout, it's an error for that phase
                     console.error(`[PluginManager executePlugin Internal] Async plugin "${pluginName}" initial response timed out after ${timeoutDuration}ms.`);
                     pluginProcess.kill('SIGKILL'); // Kill if no initial response
                     reject(new Error(`Plugin "${pluginName}" initial response timed out.`));
                } else if (!processExited && !isAsyncPlugin) {
                    // For sync plugins, or if async initial response was sent but process hangs
                    console.error(`[PluginManager executePlugin Internal] Plugin "${pluginName}" execution timed out after ${timeoutDuration}ms.`);
                    pluginProcess.kill('SIGKILL');
                    reject(new Error(`Plugin "${pluginName}" execution timed out.`));
                } else if (!processExited && isAsyncPlugin && initialResponseSent) {
                    // Async plugin's initial response was sent, but the process is still running (e.g. for background tasks)
                    // We let it run, but log if it exceeds the overall timeout.
                    // The process will be managed by its own non-daemon threads.
                    if (this.debugMode) console.log(`[PluginManager executePlugin Internal] Async plugin "${pluginName}" process is still running in background after timeout. This is expected for non-daemon threads.`);
                }
            }, timeoutDuration);

            pluginProcess.stdout.setEncoding('utf8');
            pluginProcess.stdout.on('data', (data) => {
                if (processExited || (isAsyncPlugin && initialResponseSent)) {
                    // If async and initial response sent, or process exited, ignore further stdout for this Promise.
                    // The plugin's background task might still log to its own stdout, but we don't collect it here.
                    if (this.debugMode && isAsyncPlugin && initialResponseSent) console.log(`[PluginManager executePlugin Internal] Async plugin ${pluginName} (initial response sent) produced more stdout: ${data.substring(0,100)}...`);
                    return;
                }
                outputBuffer += data;
                try {
                    // Try to parse a complete JSON object from the buffer.
                    // This is a simple check; for robust streaming JSON, a more complex parser is needed.
                    // We assume the first complete JSON is the one we want for async initial response.
                    const potentialJsonMatch = outputBuffer.match(/(\{[\s\S]*?\})(?:\s|$)/);
                    if (potentialJsonMatch && potentialJsonMatch[1]) {
                        const jsonString = potentialJsonMatch[1];
                        const parsedOutput = JSON.parse(jsonString);

                        if (parsedOutput && (parsedOutput.status === "success" || parsedOutput.status === "error")) {
                            if (isAsyncPlugin) {
                                if (!initialResponseSent) {
                                    if (this.debugMode) console.log(`[PluginManager executePlugin Internal] Async plugin "${pluginName}" sent initial JSON response. Resolving promise.`);
                                    initialResponseSent = true;
                                    // For async, we resolve with the first valid JSON and let the process continue if it has non-daemon threads.
                                    // We don't clear the main timeout here for async, as the process might still need to be killed if it misbehaves badly later.
                                    // However, the primary purpose of this promise is fulfilled.
                                    resolve(parsedOutput);
                                    // We don't return or clear outputBuffer here, as more data might be part of a *synchronous* plugin's single large JSON output.
                                }
                            } else { // Synchronous plugin
                                // For sync plugins, we wait for 'exit' to ensure all output is collected.
                                // This block within 'data' event is more for validating if the output *looks* like our expected JSON.
                                // The actual resolve for sync plugins happens in 'exit'.
                                if (this.debugMode) console.log(`[PluginManager executePlugin Internal] Sync plugin "${pluginName}" current output buffer contains a potential JSON.`);
                            }
                        }
                    }
                } catch (e) {
                    // Incomplete JSON or invalid JSON, wait for more data or 'exit' event.
                    if (this.debugMode && outputBuffer.length > 2) console.log(`[PluginManager executePlugin Internal] Plugin "${pluginName}" stdout buffer not yet a complete JSON or invalid. Buffer: ${outputBuffer.substring(0,100)}...`);
                }
            });

            pluginProcess.stderr.setEncoding('utf8');
            pluginProcess.stderr.on('data', (data) => {
                errorOutput += data;
                if (this.debugMode) console.warn(`[PluginManager executePlugin Internal stderr] Plugin "${pluginName}": ${data.trim()}`);
            });

            pluginProcess.on('error', (err) => {
                processExited = true; clearTimeout(timeoutId);
                if (!initialResponseSent) { // Only reject if initial response (for async) or any response (for sync) hasn't been sent
                    reject(new Error(`Failed to start plugin "${pluginName}": ${err.message}`));
                } else if (this.debugMode) {
                    console.error(`[PluginManager executePlugin Internal] Error after initial response for async plugin "${pluginName}": ${err.message}. Process might have been expected to continue.`);
                }
            });
            
            pluginProcess.on('exit', (code, signal) => {
                processExited = true;
                clearTimeout(timeoutId); // Clear the main timeout once the process exits.

                if (isAsyncPlugin && initialResponseSent) {
                    // For async plugins where initial response was already sent, log exit but don't re-resolve/reject.
                    if (this.debugMode) console.log(`[PluginManager executePlugin Internal] Async plugin "${pluginName}" process exited with code ${code}, signal ${signal} after initial response was sent.`);
                    return;
                }
                
                // If we are here, it's either a sync plugin, or an async plugin whose initial response was NOT sent before exit.

                if (signal === 'SIGKILL') { // Typically means timeout killed it
                    if (!initialResponseSent) reject(new Error(`Plugin "${pluginName}" execution timed out or was killed.`));
                    return;
                }

                try {
                    const parsedOutput = JSON.parse(outputBuffer.trim()); // Use accumulated outputBuffer
                    if (parsedOutput && (parsedOutput.status === "success" || parsedOutput.status === "error")) {
                        if (code !== 0 && parsedOutput.status === "success" && this.debugMode) {
                             console.warn(`[PluginManager executePlugin Internal] Plugin "${pluginName}" exited with code ${code} but reported success in JSON. Trusting JSON.`);
                        }
                        if (code === 0 && parsedOutput.status === "error" && this.debugMode) {
                            console.warn(`[PluginManager executePlugin Internal] Plugin "${pluginName}" exited with code 0 but reported error in JSON. Trusting JSON.`);
                        }
                        if (errorOutput.trim()) parsedOutput.pluginStderr = errorOutput.trim();
                        
                        if (!initialResponseSent) resolve(parsedOutput); // Ensure resolve only once
                        else if (this.debugMode) console.log(`[PluginManager executePlugin Internal] Plugin ${pluginName} exited, initial async response already sent.`);
                        return;
                    }
                    if (this.debugMode) console.warn(`[PluginManager executePlugin Internal] Plugin "${pluginName}" final stdout was not in the expected JSON format: ${outputBuffer.trim().substring(0,100)}`);
                } catch (e) {
                    if (this.debugMode) console.warn(`[PluginManager executePlugin Internal] Failed to parse final stdout JSON from plugin "${pluginName}". Error: ${e.message}. Stdout: ${outputBuffer.trim().substring(0,100)}`);
                }

                if (!initialResponseSent) { // Only reject if no response has been sent yet
                    if (code !== 0) {
                        let detailedError = `Plugin "${pluginName}" exited with code ${code}.`;
                        if (outputBuffer.trim()) detailedError += ` Stdout: ${outputBuffer.trim().substring(0, 200)}`;
                        if (errorOutput.trim()) detailedError += ` Stderr: ${errorOutput.trim().substring(0, 200)}`;
                        reject(new Error(detailedError));
                    } else {
                        // Exit code 0, but no valid initial JSON response was sent/parsed.
                        reject(new Error(`Plugin "${pluginName}" exited successfully but did not provide a valid initial JSON response. Stdout: ${outputBuffer.trim().substring(0,200)}`));
                    }
                }
            });

            try {
                if (inputData !== undefined && inputData !== null) {
                    pluginProcess.stdin.write(inputData.toString());
                }
                pluginProcess.stdin.end();
            } catch (e) {
                console.error(`[PluginManager executePlugin Internal] Stdin write error for "${pluginName}": ${e.message}`);
                if (!initialResponseSent) { // Only reject if no response has been sent yet
                    reject(new Error(`Stdin write error for "${pluginName}": ${e.message}`));
                }
            }
        });
    }

    initializeServices(app, adminApiRouter, projectBasePath) {
        if (!app) {
            console.error('[PluginManager] Cannot initialize services without Express app instance.');
            return;
        }
        if (!adminApiRouter) {
            console.error('[PluginManager] Cannot initialize services without adminApiRouter instance.');
            return;
        }
        if (!projectBasePath) {
            console.error('[PluginManager] Cannot initialize services without projectBasePath.'); // Keep error
            return;
        }
        console.log('[PluginManager] Initializing service plugins...'); // Keep
        for (const [name, serviceData] of this.serviceModules) {
            try {
                const pluginConfig = this._getPluginConfig(serviceData.manifest);
                const manifest = serviceData.manifest;
                const module = serviceData.module;

                // 新的、带命名空间的API路由注册机制
                if (manifest.hasApiRoutes && typeof module.registerApiRoutes === 'function') {
                    if (this.debugMode) console.log(`[PluginManager] Registering namespaced API routes for service plugin: ${name}`);
                    const pluginRouter = express.Router();
                    // 将 router 和其他上下文传递给插件
                    module.registerApiRoutes(pluginRouter, pluginConfig, projectBasePath, this.webSocketServer);
                    // 统一挂载到带命名空间的前缀下
                    app.use(`/api/plugins/${name}`, pluginRouter);
