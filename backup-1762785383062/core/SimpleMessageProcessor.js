/**
 * 📨 frys 简单消息处理器
 *
 * 借鉴VCPToolBox的核心处理逻辑，实现：
 * - 文本消息处理：解析和执行工具调用
 * - 变量替换：支持{{variable}}语法
 * - AI回复增强：动态注入工具调用结果
 * - 极简设计：专注核心功能
 */

import { logger } from '../shared/utils/logger.js';
import { SimplePluginManager } from './plugin/SimplePluginManager.js';
import { TextInstructionParser } from './plugin/TextInstructionParser.js';
import { PlaceholderSystem } from './utils/PlaceholderSystem.js';

export class SimpleMessageProcessor {
  constructor(options = {}) {
    this.options = {
      enableToolCalls: options.enableToolCalls !== false,
      enableVariableReplacement: options.enableVariableReplacement !== false,
      maxConcurrentTools: options.maxConcurrentTools || 3,
      toolTimeout: options.toolTimeout || 30000,
      ...options,
    };

    // 核心组件
    this.pluginManager = new SimplePluginManager({
      timeout: this.options.toolTimeout,
      maxConcurrent: this.options.maxConcurrentTools,
    });

    this.instructionParser = new TextInstructionParser();
    this.placeholderSystem = new PlaceholderSystem();

    // 处理统计
    this.stats = {
      messagesProcessed: 0,
      toolsExecuted: 0,
      variablesReplaced: 0,
      errors: 0,
    };

    logger.info('SimpleMessageProcessor initialized');
  }

  /**
   * 初始化处理器
   */
  async initialize() {
    await this.pluginManager.discoverPlugins();
    logger.info(
      'Message processor initialized with plugins:',
      this.pluginManager.getPlugins().length,
    );
  }

  /**
   * 处理消息
   * 核心方法：解析指令 -> 执行工具 -> 替换变量 -> 返回结果
   */
  async processMessage(message, context = {}) {
    const startTime = Date.now();

    try {
      if (!message || typeof message !== 'string') {
        return message;
      }

      this.stats.messagesProcessed++;
      let processedMessage = message;

      // 1. 变量替换
      if (this.options.enableVariableReplacement) {
        processedMessage = await this.processVariables(
          processedMessage,
          context,
        );
      }

      // 2. 工具调用处理
      if (this.options.enableToolCalls) {
        processedMessage = await this.processToolCalls(
          processedMessage,
          context,
        );
      }

      const processingTime = Date.now() - startTime;
      logger.debug('Message processed', {
        originalLength: message.length,
        processedLength: processedMessage.length,
        processingTime,
        toolsExecuted: this.stats.toolsExecuted,
      });

      return processedMessage;
    } catch (error) {
      this.stats.errors++;
      logger.error('Message processing failed:', error);

      // 返回错误信息，但不中断处理
      return `${message}\n\n[处理错误: ${error.message}]`;
    }
  }

  /**
   * 处理变量替换
   */
  async processVariables(message, context) {
    if (!message.includes('{{')) {
      return message;
    }

    try {
      // 构建上下文用于变量替换
      const variableContext = {
        ...context,
        timestamp: new Date().toISOString(),
        messageLength: message.length,
        // 可以添加更多动态变量
      };

      const processedMessage = this.placeholderSystem.processString(
        message,
        variableContext,
      );

      if (processedMessage !== message) {
        this.stats.variablesReplaced++;
      }

      return processedMessage;
    } catch (error) {
      logger.warn('Variable replacement failed:', error.message);
      return message; // 返回原文，不中断处理
    }
  }

  /**
   * 处理工具调用
   */
  async processToolCalls(message, context) {
    // 解析指令
    const instructions = this.instructionParser.parseInstructions(message);

    if (instructions.length === 0) {
      return message;
    }

    logger.info(`Found ${instructions.length} tool instructions`);

    // 执行所有工具调用
    const toolResults = [];
    const toolPromises = instructions.map((instruction) =>
      this.executeToolInstruction(instruction, context),
    );

    const results = await Promise.allSettled(toolPromises);

    // 处理结果
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const instruction = instructions[i];

      if (result.status === 'fulfilled') {
        toolResults.push({
          instruction: instruction.toolName,
          success: true,
          result: result.value,
        });
        this.stats.toolsExecuted++;
      } else {
        toolResults.push({
          instruction: instruction.toolName,
          success: false,
          error: result.reason.message,
        });
        logger.error(
          `Tool execution failed: ${instruction.toolName}`,
          result.reason,
        );
      }
    }

    // 生成增强的回复
    const enhancedMessage = this.enhanceMessageWithToolResults(
      message,
      toolResults,
    );

    // 移除已处理的指令
    const cleanedMessage = this.instructionParser.removeProcessedInstructions(
      enhancedMessage,
      instructions,
    );

    return cleanedMessage;
  }

  /**
   * 执行单个工具指令
   */
  async executeToolInstruction(instruction) {
    const { toolName, parameters } = instruction;

    // 格式化为VCPToolBox风格的指令文本
    const instructionText = this.instructionParser.formatInstruction(
      toolName,
      parameters,
    );

    // 执行工具
    const result = await this.pluginManager.executeTool(instructionText);

    if (result.status === 'error') {
      throw new Error(result.error || 'Tool execution failed');
    }

    return result;
  }

  /**
   * 使用工具结果增强消息
   */
  enhanceMessageWithToolResults(originalMessage, toolResults) {
    const successfulResults = toolResults.filter((r) => r.success);
    const failedResults = toolResults.filter((r) => !r.success);

    if (successfulResults.length === 0 && failedResults.length === 0) {
      return originalMessage;
    }

    let enhancedMessage = originalMessage;

    // 添加成功结果
    if (successfulResults.length > 0) {
      enhancedMessage += '\n\n📋 工具执行结果：\n';
      for (const result of successfulResults) {
        enhancedMessage += `✅ ${result.instruction}: ${this.formatToolResult(result.result)}\n`;
      }
    }

    // 添加错误信息
    if (failedResults.length > 0) {
      enhancedMessage += '\n\n⚠️ 工具执行错误：\n';
      for (const result of failedResults) {
        enhancedMessage += `❌ ${result.instruction}: ${result.error}\n`;
      }
    }

    return enhancedMessage;
  }

  /**
   * 格式化工具结果
   */
  formatToolResult(result) {
    if (!result) return '无结果';

    if (typeof result === 'string') {
      return result;
    }

    if (typeof result === 'object') {
      // 尝试提取有意义的信息
      if (result.result) return result.result;
      if (result.data) return JSON.stringify(result.data);
      if (result.message) return result.message;

      // 默认JSON格式化
      try {
        return JSON.stringify(result, null, 2);
      } catch (e) {
        return String(result);
      }
    }

    return String(result);
  }

  /**
   * 处理AI回复中的工具调用
   * 这是主要的入口点，用于处理AI模型的回复
   */
  async processAIResponse(response, context = {}) {
    // AI回复可能包含工具调用指令
    const processedResponse = await this.processMessage(response, {
      ...context,
      source: 'ai_response',
      timestamp: new Date(),
    });

    return processedResponse;
  }

  /**
   * 处理用户输入
   */
  async processUserInput(input, context = {}) {
    const processedInput = await this.processMessage(input, {
      ...context,
      source: 'user_input',
      timestamp: new Date(),
    });

    return processedInput;
  }

  /**
   * 生成工具调用提示
   */
  generateToolPrompt() {
    const plugins = this.pluginManager.getPlugins();
    return this.instructionParser.generateToolPrompt(plugins);
  }

  /**
   * 获取可用工具列表
   */
  getAvailableTools() {
    return this.pluginManager.getPlugins().map((plugin) => ({
      name: plugin.name,
      displayName: plugin.displayName,
      description: plugin.description,
      capabilities: plugin.capabilities,
    }));
  }

  /**
   * 获取处理统计
   */
  getStats() {
    return {
      ...this.stats,
      pluginStats: this.pluginManager.getStats(),
      availableTools: this.getAvailableTools().length,
    };
  }

  /**
   * 重新加载插件
   */
  async reloadPlugins() {
    await this.pluginManager.reloadPlugins();
    logger.info('Plugins reloaded');
  }

  /**
   * 关闭处理器
   */
  async shutdown() {
    logger.info('Shutting down SimpleMessageProcessor');
    await this.pluginManager.shutdown();
    logger.info('SimpleMessageProcessor shutdown completed');
  }
}

export default SimpleMessageProcessor;
