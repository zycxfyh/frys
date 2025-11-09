/**
 * Claude专用AI服务
 * 提供Anthropic Claude相关的所有API接口和业务逻辑
 */

import { errorHandler } from '../../../core/error-handler.js';
import { eventSystem } from '../../../core/events.js';
import { config } from '../../../utils/config.js';
import { logger } from '../../../utils/logger.js';

export class ClaudeService {
  constructor(options = {}) {
    this.name = 'Claude';
    this.providerId = 'claude';
    this.baseURL = options.baseURL || 'https://api.anthropic.com/v1';
    this.apiKey = options.apiKey || config.ai.providers.claude.apiKey;

    // 测试模式检测
    this.isTestMode =
      this.apiKey === 'test-claude-key' || this.apiKey?.startsWith('test-');
    this.timeout = options.timeout || 60000; // Claude响应较慢
    this.maxRetries = options.maxRetries || 3;

    // 监控统计
    this.stats = {
      requests: 0,
      errors: 0,
      tokens: 0,
      cost: 0,
      avgResponseTime: 0,
    };

    this.requestTimes = [];

    logger.info('Claude服务初始化完成', {
      baseURL: this.baseURL,
      timeout: this.timeout,
    });
  }

  /**
   * 测试连接
   */
  async testConnection() {
    try {
      // Claude没有专门的models API，使用一个简单的请求测试
      const response = await fetch(`${this.baseURL}/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hello' }],
        }),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (response.status === 401) {
        throw new Error('Invalid API key');
      }

      logger.info('Claude连接测试成功');

      return {
        success: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Claude连接测试失败', { error: error.message });
      throw errorHandler.createError('CLAUDE_CONNECTION_FAILED', error.message);
    }
  }

  /**
   * 获取可用模型列表
   */
  async getModels() {
    // Claude没有公开的models API，我们返回已知模型
    const models = [
      {
        id: 'claude-3-opus-20240229',
        name: 'Claude 3 Opus',
        type: 'chat',
        contextLength: 200000,
        pricing: { input: 0.015, output: 0.075 },
        capabilities: ['chat', 'completion', 'vision'],
        status: 'active',
      },
      {
        id: 'claude-3-sonnet-20240229',
        name: 'Claude 3 Sonnet',
        type: 'chat',
        contextLength: 200000,
        pricing: { input: 0.003, output: 0.015 },
        capabilities: ['chat', 'completion', 'vision'],
        status: 'active',
      },
      {
        id: 'claude-3-haiku-20240307',
        name: 'Claude 3 Haiku',
        type: 'chat',
        contextLength: 200000,
        pricing: { input: 0.00025, output: 0.00125 },
        capabilities: ['chat', 'completion', 'vision'],
        status: 'active',
      },
      {
        id: 'claude-2.1',
        name: 'Claude 2.1',
        type: 'chat',
        contextLength: 200000,
        pricing: { input: 0.008, output: 0.024 },
        capabilities: ['chat', 'completion'],
        status: 'active',
      },
    ];

    return models;
  }

  /**
   * 聊天完成
   */
  async chatCompletion(request) {
    const startTime = Date.now();

    // 测试模式下返回模拟响应
    if (this.isTestMode) {
      const mockResponse = {
        id: `msg_test_${Date.now()}`,
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: '这是来自Claude服务的测试响应。系统正在测试模式下运行，所有AI功能都使用模拟数据。',
          },
        ],
        model: request.model,
        stop_reason: 'end_turn',
        usage: {
          input_tokens: 50,
          output_tokens: 30,
        },
      };

      const responseTime = 200 + Math.random() * 400; // 模拟200-600ms响应时间
      this.updateStats(mockResponse.usage, responseTime);

      return {
        success: true,
        data: mockResponse,
        responseTime,
        cost: this.calculateCost(request.model, mockResponse.usage),
      };
    }

    try {
      this.stats.requests++;

      // 转换消息格式
      const messages = this.convertMessages(request.messages);

      const payload = {
        model: request.model,
        max_tokens: request.maxTokens || 4096,
        messages,
        system: request.system || undefined,
        temperature: request.temperature || 0.7,
        stream: request.stream || false,
      };

      logger.debug('发送Claude聊天请求', {
        model: request.model,
        messageCount: messages.length,
        stream: request.stream,
      });

      const response = await fetch(`${this.baseURL}/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorData}`);
      }

      const data = await response.json();
      const responseTime = Date.now() - startTime;

      // 更新统计信息
      this.updateStats(data.usage, responseTime);

      // 发送事件
      eventSystem.emit('ai:request:completed', {
        provider: 'claude',
        model: request.model,
        responseTime,
        tokens: data.usage,
        cost: this.calculateCost(request.model, data.usage),
      });

      // 转换响应格式以保持一致性
      return {
        id: data.id,
        model: data.model,
        choices: [
          {
            message: {
              role: 'assistant',
              content: data.content[0]?.text || '',
            },
            finish_reason: data.stop_reason,
          },
        ],
        usage: {
          prompt_tokens: data.usage?.input_tokens || 0,
          completion_tokens: data.usage?.output_tokens || 0,
          total_tokens:
            (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
        },
        cost: this.calculateCost(request.model, data.usage),
        responseTime,
        provider: 'claude',
      };
    } catch (error) {
      this.stats.errors++;
      const responseTime = Date.now() - startTime;

      logger.error('Claude聊天请求失败', {
        model: request.model,
        error: error.message,
        responseTime,
      });

      eventSystem.emit('ai:request:error', {
        provider: 'claude',
        model: request.model,
        error: error.message,
        responseTime,
      });

      throw this.handleError(error);
    }
  }

  /**
   * 转换消息格式到Claude格式
   */
  convertMessages(messages) {
    // Claude不使用system role，需要单独处理
    const systemMessages = messages.filter((msg) => msg.role === 'system');
    const otherMessages = messages.filter((msg) => msg.role !== 'system');

    // 如果有system消息，设置system参数
    if (systemMessages.length > 0) {
      this.systemMessage = systemMessages.map((msg) => msg.content).join('\n');
    }

    // 转换其他消息
    return otherMessages.map((msg) => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content,
    }));
  }

  /**
   * 计算成本
   */
  calculateCost(model, usage) {
    if (!usage) return 0;

    const pricing = this.getModelPricing(model);
    const inputCost = (usage.input_tokens || 0) * pricing.input;
    const outputCost = (usage.output_tokens || 0) * pricing.output;

    return inputCost + outputCost;
  }

  /**
   * 获取模型定价
   */
  getModelPricing(modelId) {
    const pricing = {
      'claude-3-opus-20240229': { input: 0.015, output: 0.075 },
      'claude-3-sonnet-20240229': { input: 0.003, output: 0.015 },
      'claude-3-haiku-20240307': { input: 0.00025, output: 0.00125 },
      'claude-2.1': { input: 0.008, output: 0.024 },
    };
    return pricing[modelId] || { input: 0.008, output: 0.024 };
  }

  /**
   * 更新统计信息
   */
  updateStats(usage, responseTime) {
    if (usage) {
      const totalTokens =
        (usage.input_tokens || 0) + (usage.output_tokens || 0);
      this.stats.tokens += totalTokens;
      this.stats.cost += this.calculateCost('claude-3-haiku-20240307', usage); // 估算
    }

    this.requestTimes.push(responseTime);

    if (this.requestTimes.length > 100) {
      this.requestTimes.shift();
    }

    this.stats.avgResponseTime =
      this.requestTimes.reduce((a, b) => a + b, 0) / this.requestTimes.length;
  }

  /**
   * 处理错误
   */
  handleError(error) {
    const message = error.message;

    if (message.includes('401') || message.includes('Invalid API key')) {
      return errorHandler.createError('CLAUDE_AUTH_FAILED', 'API密钥无效');
    }

    if (message.includes('429') || message.includes('rate limit')) {
      return errorHandler.createError('CLAUDE_RATE_LIMIT', '请求频率过高');
    }

    if (message.includes('400')) {
      return errorHandler.createError('CLAUDE_BAD_REQUEST', '请求参数错误');
    }

    if (
      message.includes('500') ||
      message.includes('502') ||
      message.includes('503')
    ) {
      return errorHandler.createError(
        'CLAUDE_SERVER_ERROR',
        'Claude服务暂时不可用',
      );
    }

    return errorHandler.createError('CLAUDE_UNKNOWN_ERROR', message);
  }

  /**
   * 获取服务统计信息
   */
  getStats() {
    return {
      provider: 'claude',
      name: this.name,
      requests: this.stats.requests,
      errors: this.stats.errors,
      errorRate:
        this.stats.requests > 0 ? this.stats.errors / this.stats.requests : 0,
      tokens: this.stats.tokens,
      cost: this.stats.cost,
      avgResponseTime: this.stats.avgResponseTime,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 重置统计信息
   */
  resetStats() {
    this.stats = {
      requests: 0,
      errors: 0,
      tokens: 0,
      cost: 0,
      avgResponseTime: 0,
    };
    this.requestTimes = [];
    logger.info('Claude服务统计信息已重置');
  }
}
