/**
 * 🚀 frys 简单插件管理系统
 *
 * 借鉴VCPToolBox的成功架构，实现：
 * - 文本协议驱动：AI通过文本指令调用工具
 * - 子进程模式：每个插件独立进程，进程隔离
 * - 极简设计：抛弃复杂对象通信，用stdio通信
 * - 语言无关：支持任何编程语言编写插件
 */

import { spawn } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { logger } from '../../shared/utils/logger.js';
import { TextInstructionParser } from './TextInstructionParser.js';

export class SimplePluginManager {
  constructor(options = {}) {
    this.options = {
      pluginDir: options.pluginDir || join(process.cwd(), 'plugins'),
      timeout: options.timeout || 30000,
      maxConcurrent: options.maxConcurrent || 5,
      ...options,
    };

    this.plugins = new Map(); // 插件注册表
    this.activeProcesses = new Map(); // 活跃进程跟踪
    this.instructionParser = new TextInstructionParser(); // 指令解析器
    this.stats = {
      totalPlugins: 0,
      executedTools: 0,
      failedTools: 0,
      avgExecutionTime: 0,
    };

    logger.info('SimplePluginManager initialized', {
      pluginDir: this.options.pluginDir,
      timeout: this.options.timeout,
    });
  }

  /**
   * 发现并注册所有插件
   */
  async discoverPlugins() {
    const pluginDir = this.options.pluginDir;

    if (!existsSync(pluginDir)) {
      logger.warn(`Plugin directory not found: ${pluginDir}`);
      return;
    }

    // 简单的插件发现：查找所有.js文件
    const fs = await import('fs/promises');
    const entries = await fs.readdir(pluginDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        await this._loadPluginFromDirectory(pluginDir, entry.name);
      }
    }

    this.stats.totalPlugins = this.plugins.size;
    logger.info(
      `Plugin discovery completed. Found ${this.plugins.size} plugins`,
    );
  }

  async _loadPluginFromDirectory(pluginDir, pluginName) {
    const pluginPath = join(pluginDir, pluginName);
    const manifestPath = join(pluginPath, 'plugin-manifest.json');

    if (!existsSync(manifestPath)) {
      return;
    }

    try {
      const manifestContent = readFileSync(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestContent);

      if (this.validateManifest(manifest)) {
        this.registerPlugin(manifest);
        logger.info(`Plugin discovered: ${manifest.name}`);
      }
    } catch (error) {
      logger.error(`Failed to load plugin ${pluginName}:`, error.message);
    }
  }

  /**
   * 验证插件清单
   */
  validateManifest(manifest) {
    return (
      manifest.name &&
      manifest.displayName &&
      manifest.entryPoint &&
      manifest.capabilities &&
      manifest.capabilities.invocationCommands
    );
  }

  /**
   * 注册插件
   */
  registerPlugin(manifest) {
    const pluginInfo = {
      ...manifest,
      basePath: join(this.options.pluginDir, manifest.name),
      registeredAt: new Date(),
      executionCount: 0,
      errorCount: 0,
      totalExecutionTime: 0,
    };

    this.plugins.set(manifest.name, pluginInfo);
  }

  /**
   * 执行工具
   * 核心方法：解析文本指令，启动子进程，获取结果
   */
  async executeTool(instruction) {
    const startTime = Date.now();

    try {
      // 1. 解析指令
      const parsedInstruction = this.parseInstruction(instruction);
      if (!parsedInstruction) {
        throw new Error('Invalid instruction format');
      }

      const { toolName, parameters } = parsedInstruction;

      // 2. 查找插件
      const plugin = this.plugins.get(toolName);
      if (!plugin) {
        throw new Error(`Plugin not found: ${toolName}`);
      }

      // 3. 检查并发限制
      if (this.activeProcesses.size >= this.options.maxConcurrent) {
        throw new Error('Too many concurrent plugin executions');
      }

      // 4. 启动子进程
      const result = await this.executePluginProcess(plugin, parameters);

      // 5. 更新统计
      const executionTime = Date.now() - startTime;
      plugin.executionCount++;
      plugin.totalExecutionTime += executionTime;

      this.stats.executedTools++;
      this.updateAvgExecutionTime(executionTime);

      logger.info(`Tool executed: ${toolName}`, {
        executionTime,
        success: true,
      });

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;

      this.stats.failedTools++;
      this.updateAvgExecutionTime(executionTime);

      logger.error('Tool execution failed:', {
        error: error.message,
        executionTime,
      });

      return {
        status: 'error',
        error: error.message,
        executionTime,
      };
    }
  }

  /**
   * 解析指令
   * 使用TextInstructionParser进行解析
   */
  parseInstruction(text) {
    const instructions = this.instructionParser.parseInstructions(text);
    if (instructions.length === 0) {
      return null;
    }

    // 返回第一个指令（可以扩展为批量处理）
    return instructions[0];
  }

  /**
   * 执行插件进程
   */
  async executePluginProcess(plugin, parameters) {
    return new Promise((resolve, reject) => {
      const timeout = this.options.timeout;

      // 准备命令和参数
      const command = plugin.entryPoint.command || 'node';
      const args = plugin.entryPoint.args || [
        join(plugin.basePath, 'index.js'),
      ];

      // 创建子进程
      const child = spawn(command, args, {
        cwd: plugin.basePath,
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout,
      });

      const processId = `${plugin.name}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      this.activeProcesses.set(processId, { child, plugin: plugin.name });

      let stdout = '';
      let stderr = '';

      // 设置超时
      const timeoutId = setTimeout(() => {
        child.kill('SIGTERM');
        this.activeProcesses.delete(processId);
        reject(new Error(`Plugin execution timeout: ${timeout}ms`));
      }, timeout);

      // 监听输出
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      // 处理进程结束
      child.on('exit', (code) => {
        clearTimeout(timeoutId);
        this.activeProcesses.delete(processId);

        try {
          if (code === 0) {
            // 成功：解析JSON输出
            const result = JSON.parse(stdout.trim());
            resolve(result);
          } else {
            // 失败：包含错误信息
            reject(new Error(`Plugin exited with code ${code}: ${stderr}`));
          }
        } catch (error) {
          reject(new Error(`Failed to parse plugin output: ${error.message}`));
        }
      });

      child.on('error', (error) => {
        clearTimeout(timeoutId);
        this.activeProcesses.delete(processId);
        reject(error);
      });

      // 发送输入参数
      try {
        const input = JSON.stringify({
          tool_name: plugin.name,
          ...parameters,
          _metadata: {
            executionId: processId,
            timestamp: new Date().toISOString(),
            pluginVersion: plugin.version,
          },
        });

        child.stdin.write(input);
        child.stdin.end();
      } catch (error) {
        clearTimeout(timeoutId);
        child.kill();
        this.activeProcesses.delete(processId);
        reject(new Error(`Failed to send input to plugin: ${error.message}`));
      }
    });
  }

  /**
   * 获取插件列表
   */
  getPlugins() {
    const pluginList = [];
    for (const [name, plugin] of this.plugins) {
      pluginList.push({
        name,
        displayName: plugin.displayName,
        version: plugin.version,
        description: plugin.description,
        capabilities: plugin.capabilities,
        stats: {
          executionCount: plugin.executionCount,
          errorCount: plugin.errorCount,
          avgExecutionTime:
            plugin.executionCount > 0
              ? plugin.totalExecutionTime / plugin.executionCount
              : 0,
        },
      });
    }
    return pluginList;
  }

  /**
   * 获取插件详情
   */
  getPlugin(name) {
    const plugin = this.plugins.get(name);
    if (!plugin) return null;

    return {
      ...plugin,
      stats: {
        executionCount: plugin.executionCount,
        errorCount: plugin.errorCount,
        successRate:
          plugin.executionCount > 0
            ? ((plugin.executionCount - plugin.errorCount) /
                plugin.executionCount) *
              100
            : 0,
        avgExecutionTime:
          plugin.executionCount > 0
            ? plugin.totalExecutionTime / plugin.executionCount
            : 0,
      },
    };
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      ...this.stats,
      activeProcesses: this.activeProcesses.size,
      plugins: this.getPlugins(),
    };
  }

  /**
   * 更新平均执行时间
   */
  updateAvgExecutionTime(newTime) {
    const totalExecutions = this.stats.executedTools + this.stats.failedTools;
    if (totalExecutions === 1) {
      this.stats.avgExecutionTime = newTime;
    } else {
      // 指数移动平均
      const alpha = 0.1;
      this.stats.avgExecutionTime =
        this.stats.avgExecutionTime * (1 - alpha) + newTime * alpha;
    }
  }

  /**
   * 终止所有活跃进程
   */
  async shutdown() {
    logger.info('Shutting down SimplePluginManager');

    // 终止所有活跃进程
    for (const [processId, processInfo] of this.activeProcesses) {
      try {
        processInfo.child.kill('SIGTERM');

        // 等待一段时间让进程优雅退出
        await new Promise((resolve) => {
          const timeout = setTimeout(() => {
            processInfo.child.kill('SIGKILL'); // 强制终止
            resolve();
          }, 5000);

          processInfo.child.on('exit', () => {
            clearTimeout(timeout);
            resolve();
          });
        });

        logger.debug(`Terminated plugin process: ${processId}`);
      } catch (error) {
        logger.error(
          `Failed to terminate plugin process ${processId}:`,
          error.message,
        );
      }
    }

    this.activeProcesses.clear();
    logger.info('SimplePluginManager shutdown completed');
  }

  /**
   * 重新加载插件
   */
  async reloadPlugins() {
    logger.info('Reloading plugins');
    this.plugins.clear();
    await this.discoverPlugins();
  }
}

export default SimplePluginManager;
