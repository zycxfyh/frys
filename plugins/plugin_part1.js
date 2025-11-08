// Plugin.js
const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
const schedule = require('node-schedule');
const dotenv = require('dotenv'); // Ensures dotenv is available
const FileFetcherServer = require('./FileFetcherServer.js');
const express = require('express'); // For plugin API routing
const chokidar = require('chokidar');
const { getAuthCode } = require('./modules/captchaDecoder'); // 导入统一的解码函数
const { VectorDBManager } = require('./VectorDBManager.js');

const PLUGIN_DIR = path.join(__dirname, 'Plugin');
const manifestFileName = 'plugin-manifest.json';
const PREPROCESSOR_ORDER_FILE = path.join(__dirname, 'preprocessor_order.json');

class PluginManager {
    constructor() {
        this.plugins = new Map(); // 存储所有插件（本地和分布式）
        this.staticPlaceholderValues = new Map();
        this.scheduledJobs = new Map();
        this.messagePreprocessors = new Map();
        this.preprocessorOrder = []; // 新增：用于存储预处理器的最终加载顺序
        this.serviceModules = new Map();
        this.projectBasePath = null;
        this.individualPluginDescriptions = new Map(); // New map for individual descriptions
        this.debugMode = (process.env.DebugMode || "False").toLowerCase() === "true";
        this.webSocketServer = null; // 为 WebSocketServer 实例占位
        this.isReloading = false;
        this.reloadTimeout = null;
        this.vectorDBManager = new VectorDBManager();
    }

    setWebSocketServer(wss) {
        this.webSocketServer = wss;
        if (this.debugMode) console.log('[PluginManager] WebSocketServer instance has been set.');
    }

    async _getDecryptedAuthCode() {
        try {
            const authCodePath = path.join(__dirname, 'Plugin', 'UserAuth', 'code.bin');
            // 使用正确的 getAuthCode 函数，并传递文件路径
            return await getAuthCode(authCodePath);
        } catch (error) {
            if (this.debugMode) {
                console.error('[PluginManager] Failed to read or decrypt auth code for plugin execution:', error.message);
            }
            return null; // Return null if code cannot be obtained
        }
    }

    setProjectBasePath(basePath) {
        this.projectBasePath = basePath;
        if (this.debugMode) console.log(`[PluginManager] Project base path set to: ${this.projectBasePath}`);
    }

    _getPluginConfig(pluginManifest) {
        const config = {};
        const globalEnv = process.env; 
        const pluginSpecificEnv = pluginManifest.pluginSpecificEnvConfig || {}; 

        if (pluginManifest.configSchema) {
            for (const key in pluginManifest.configSchema) {
                const expectedType = pluginManifest.configSchema[key];
                let rawValue;

                if (pluginSpecificEnv.hasOwnProperty(key)) { 
                    rawValue = pluginSpecificEnv[key];
                } else if (globalEnv.hasOwnProperty(key)) { 
                    rawValue = globalEnv[key];
                } else {
                    continue; 
                }

                let value = rawValue;
                if (expectedType === 'integer') {
                    value = parseInt(value, 10);
                    if (isNaN(value)) {
                       if (this.debugMode) console.warn(`[PluginManager] Config key '${key}' for ${pluginManifest.name} expected integer, got NaN from raw value '${rawValue}'. Using undefined.`);
                       value = undefined;
                    }
                } else if (expectedType === 'boolean') {
                    value = String(value).toLowerCase() === 'true';
                }
                config[key] = value;
            }
        }

        if (pluginSpecificEnv.hasOwnProperty('DebugMode')) {
            config.DebugMode = String(pluginSpecificEnv.DebugMode).toLowerCase() === 'true';
        } else if (globalEnv.hasOwnProperty('DebugMode')) {
            config.DebugMode = String(globalEnv.DebugMode).toLowerCase() === 'true';
        } else if (!config.hasOwnProperty('DebugMode')) { 
            config.DebugMode = false; 
        }
        return config;
    }

    getResolvedPluginConfigValue(pluginName, configKey) {
        const pluginManifest = this.plugins.get(pluginName);
        if (!pluginManifest) {
            return undefined;
        }
        const effectiveConfig = this._getPluginConfig(pluginManifest); 
        return effectiveConfig ? effectiveConfig[configKey] : undefined;
    }

    async _executeStaticPluginCommand(plugin) {
        if (!plugin || plugin.pluginType !== 'static' || !plugin.entryPoint || !plugin.entryPoint.command) {
            console.error(`[PluginManager] Invalid static plugin or command for execution: ${plugin ? plugin.name : 'Unknown'}`);
            return Promise.reject(new Error(`Invalid static plugin or command for ${plugin ? plugin.name : 'Unknown'}`));
        }

        return new Promise((resolve, reject) => {
            const pluginConfig = this._getPluginConfig(plugin); 
            const envForProcess = { ...process.env }; 
            for (const key in pluginConfig) {
                if (pluginConfig.hasOwnProperty(key) && pluginConfig[key] !== undefined) {
                    envForProcess[key] = String(pluginConfig[key]);
                }
            }
            if (this.projectBasePath) { // Add projectBasePath for static plugins too if needed
                envForProcess.PROJECT_BASE_PATH = this.projectBasePath;
            }


            const [command, ...args] = plugin.entryPoint.command.split(' ');
            const pluginProcess = spawn(command, args, { cwd: plugin.basePath, shell: true, env: envForProcess, windowsHide: true });
            let output = '';
            let errorOutput = '';
            let processExited = false;
            const timeoutDuration = plugin.communication?.timeout || 30000;

            const timeoutId = setTimeout(() => {
                if (!processExited) {
                    console.error(`[PluginManager] Static plugin "${plugin.name}" execution timed out after ${timeoutDuration}ms.`); // Keep error
                    pluginProcess.kill('SIGKILL');
                    reject(new Error(`Static plugin "${plugin.name}" execution timed out.`));
                }
            }, timeoutDuration);

            pluginProcess.stdout.on('data', (data) => { output += data.toString(); });
            pluginProcess.stderr.on('data', (data) => { errorOutput += data.toString(); });

            pluginProcess.on('error', (err) => {
                processExited = true;
                clearTimeout(timeoutId);
                console.error(`[PluginManager] Failed to start static plugin ${plugin.name}: ${err.message}`);
                reject(err);
            });
            
            pluginProcess.on('exit', (code, signal) => {
                processExited = true;
                clearTimeout(timeoutId);
                if (signal === 'SIGKILL') { 
                    return;
                }
                if (code !== 0) {
                    const errMsg = `Static plugin ${plugin.name} exited with code ${code}. Stderr: ${errorOutput.trim()}`;
                    console.error(`[PluginManager] ${errMsg}`);
                    reject(new Error(errMsg));
                } else {
                    if (errorOutput.trim() && this.debugMode) {
                        console.warn(`[PluginManager] Static plugin ${plugin.name} produced stderr output: ${errorOutput.trim()}`);
                    }
                    resolve(output.trim());
                }
            });
        });
    }

    async _updateStaticPluginValue(plugin) {
        let newValue = null;
        let executionError = null;
        try {
            if (this.debugMode) console.log(`[PluginManager] Updating static plugin: ${plugin.name}`);
            newValue = await this._executeStaticPluginCommand(plugin);
        } catch (error) {
            console.error(`[PluginManager] Error executing static plugin ${plugin.name} script:`, error.message);
            executionError = error;
        }

        if (plugin.capabilities && plugin.capabilities.systemPromptPlaceholders) {
            plugin.capabilities.systemPromptPlaceholders.forEach(ph => {
                const placeholderKey = ph.placeholder;
                const currentValueEntry = this.staticPlaceholderValues.get(placeholderKey);
                const currentValue = currentValueEntry ? currentValueEntry.value : undefined;

                if (newValue !== null && newValue.trim() !== "") {
                    this.staticPlaceholderValues.set(placeholderKey, { value: newValue.trim(), serverId: 'local' });
                    if (this.debugMode) console.log(`[PluginManager] Placeholder ${placeholderKey} for ${plugin.name} updated with value: "${(newValue.trim()).substring(0,70)}..."`);
                } else if (executionError) {
                    const errorMessage = `[Error updating ${plugin.name}: ${executionError.message.substring(0,100)}...]`;
                    if (!currentValue || (currentValue && currentValue.startsWith("[Error"))) {
                        this.staticPlaceholderValues.set(placeholderKey, { value: errorMessage, serverId: 'local' });
                        if (this.debugMode) console.warn(`[PluginManager] Placeholder ${placeholderKey} for ${plugin.name} set to error state: ${errorMessage}`);
                    } else {
                        if (this.debugMode) console.warn(`[PluginManager] Placeholder ${placeholderKey} for ${plugin.name} failed to update. Keeping stale value: "${(currentValue || "").substring(0,70)}..."`);
                    }
                } else {
