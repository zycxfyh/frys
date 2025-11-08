/**
 * Gemini专用AI服务
 * 提供Google Gemini相关的所有API接口和业务逻辑
 */

import { logger } from '../../../utils/logger.js';
import { config } from '../../../utils/config.js';
import { errorHandler } from '../../../core/error-handler.js';
import { eventSystem } from '../../../core/events.js';

export class GeminiService {
  constructor(options = {}) {
    this.name = 'Gemini';
    this.providerId = 'gemini';
    this.baseURL =
      options.baseURL || 'https://generativelanguage.googleapis.com/v1';
    this.apiKey = options.apiKey || config.ai.providers.gemini.apiKey;

    // 测试模式检测
    this.isTestMode =
      this.apiKey === 'test-gemini-key' || this.apiKey?.startsWith('test-');
    this.timeout = options.timeout || 30000;
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

    logger.info('Gemini服务初始化完成', {
      baseURL: this.baseURL,
      timeout: this.timeout,
    });
  }

  /**
   * 测试连接
   */
  async testConnection() {
    try {
      const response = await fetch(
        `${this.baseURL}/models?key=${this.apiKey}`,
        {
          method: 'GET',
          signal: AbortSignal.timeout(this.timeout),
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      logger.info('Gemini连接测试成功', {
        modelCount: data.models?.length || 0,
      });

      return {
        success: true,
        models: data.models?.length || 0,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Gemini连接测试失败', { error: error.message });
      throw errorHandler.createError('GEMINI_CONNECTION_FAILED', error.message);
    }
  }

  /**
   * 获取可用模型列表
   */
  async getModels() {
    try {
      const response = await fetch(
        `${this.baseURL}/models?key=${this.apiKey}`,
        {
          method: 'GET',
          signal: AbortSignal.timeout(this.timeout),
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // 过滤和格式化模型信息
      const models = data.models
        .filter((model) => model.name.includes('gemini'))
        .map((model) => ({
          id: model.name.split('/').pop(),
          name: this.getModelDisplayName(model.name),
          type: 'chat',
          contextLength: this.getModelContextLength(model.name),
          pricing: this.getModelPricing(model.name),
          capabilities: this.getModelCapabilities(model.name),
          status: 'active',
        }));

      return models;
    } catch (error) {
      logger.error('获取Gemini模型列表失败', { error: error.message });
      throw errorHandler.createError(
        'GEMINI_MODELS_FETCH_FAILED',
        error.message,
      );
    }
  }

  /**
   * 聊天完成
   */
  async chatCompletion(request) {
    const startTime = Date.now();

    // 测试模式下返回模拟响应
    if (this.isTestMode) {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: '这是来自Gemini服务的测试响应。系统正在测试模式下运行，所有AI功能都使用模拟数据。',
                },
              ],
            },
            finishReason: 'STOP',
            index: 0,
          },
        ],
        usageMetadata: {
          promptTokenCount: 50,
          candidatesTokenCount: 30,
          totalTokenCount: 80,
        },
      };

      const responseTime = 150 + Math.random() * 300; // 模拟150-450ms响应时间
      this.updateStats(mockResponse.usageMetadata, responseTime);

      return {
        success: true,
        data: mockResponse,
        responseTime,
        cost: this.calculateCost(request.model, mockResponse.usageMetadata),
      };
    }

    try {
      this.stats.requests++;

      // 转换消息格式到Gemini格式
      const contents = this.convertMessagesToGemini(request.messages);

      const payload = {
        contents,
        generationConfig: {
          temperature: request.temperature || 0.7,
          maxOutputTokens: request.maxTokens || 2048,
          topP: 0.8,
          topK: 10,
        },
      };

      // 添加系统指令（如果有）
      if (request.system) {
        payload.systemInstruction = {
          parts: [{ text: request.system }],
        };
      }

      const modelName = request.model || 'gemini-1.5-flash';
      const url = `${this.baseURL}/models/${modelName}:generateContent?key=${this.apiKey}`;

      logger.debug('发送Gemini聊天请求', {
        model: modelName,
        messageCount: contents.length,
      });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
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

      // 解析Gemini响应
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const finishReason = data.candidates?.[0]?.finishReason || 'STOP';

      // 估算token使用量
      const usage = this.estimateTokenUsage(request.messages, content);

      // 更新统计信息
      this.updateStats(usage, responseTime);

      // 发送事件
      eventSystem.emit('ai:request:completed', {
        provider: 'gemini',
        model: modelName,
        responseTime,
        tokens: usage,
        cost: this.calculateCost(modelName, usage),
      });

      // 转换响应格式以保持一致性
      return {
        id: data.candidates?.[0]?.content?.name || `gemini_${Date.now()}`,
        model: modelName,
        choices: [
          {
            message: {
              role: 'assistant',
              content,
            },
            finish_reason: finishReason.toLowerCase(),
          },
        ],
        usage,
        cost: this.calculateCost(modelName, usage),
        responseTime,
        provider: 'gemini',
      };
    } catch (error) {
      this.stats.errors++;
      const responseTime = Date.now() - startTime;

      logger.error('Gemini聊天请求失败', {
        model: request.model,
        error: error.message,
        responseTime,
      });

      eventSystem.emit('ai:request:error', {
        provider: 'gemini',
        model: request.model,
        error: error.message,
        responseTime,
      });

      throw this.handleError(error);
    }
  }

  /**
   * 转换消息格式到Gemini格式
   */
  convertMessagesToGemini(messages) {
    return messages.map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));
  }

  /**
   * 估算token使用量
   */
  estimateTokenUsage(inputMessages, outputContent) {
    // Gemini没有提供准确的token计数，我们基于字符数估算
    const inputChars = inputMessages.reduce(
      (total, msg) => total + msg.content.length,
      0,
    );
    const outputChars = outputContent.length;

    // 粗略估算：1个中文字符≈1.5个token，英文≈0.3个token
    const inputTokens = Math.ceil(inputChars * 0.8); // 中英混合估算
    const outputTokens = Math.ceil(outputChars * 0.8);

    return {
      prompt_tokens: inputTokens,
      completion_tokens: outputTokens,
      total_tokens: inputTokens + outputTokens,
    };
  }

  /**
   * 获取模型显示名称
   */
  getModelDisplayName(modelName) {
    const names = {
      'gemini-1.5-pro': 'Gemini 1.5 Pro',
      'gemini-1.5-flash': 'Gemini 1.5 Flash',
      'gemini-pro': 'Gemini Pro',
      'gemini-pro-vision': 'Gemini Pro Vision',
    };

    const modelId = modelName.split('/').pop();
    return names[modelId] || modelId;
  }

  /**
   * 获取模型上下文长度
   */
  getModelContextLength(modelName) {
    const lengths = {
      'gemini-1.5-pro': 1000000,
      'gemini-1.5-flash': 1000000,
      'gemini-pro': 32768,
      'gemini-pro-vision': 16384,
    };

    const modelId = modelName.split('/').pop();
    return lengths[modelId] || 32768;
  }

  /**
   * 获取模型定价
   */
  getModelPricing(modelName) {
    const pricing = {
      'gemini-1.5-pro': { input: 0.00025, output: 0.0005 },
      'gemini-1.5-flash': { input: 0.000075, output: 0.0003 },
      'gemini-pro': { input: 0.00025, output: 0.0005 },
      'gemini-pro-vision': { input: 0.00025, output: 0.0005 },
    };

    const modelId = modelName.split('/').pop();
    return pricing[modelId] || { input: 0.00025, output: 0.0005 };
  }

  /**
   * 获取模型能力
   */
  getModelCapabilities(modelName) {
    const capabilities = {
      'gemini-1.5-pro': [
        'chat',
        'completion',
        'vision',
        'audio',
        'function-calling',
      ],
      'gemini-1.5-flash': ['chat', 'completion', 'vision', 'audio'],
      'gemini-pro': ['chat', 'completion'],
      'gemini-pro-vision': ['chat', 'completion', 'vision'],
    };

    const modelId = modelName.split('/').pop();
    return capabilities[modelId] || ['chat'];
  }

  /**
   * 计算成本
   */
  calculateCost(model, usage) {
    if (!usage) return 0;

    const pricing = this.getModelPricing(model);
    const inputCost = (usage.prompt_tokens || 0) * pricing.input;
    const outputCost = (usage.completion_tokens || 0) * pricing.output;

    return inputCost + outputCost;
  }

  /**
   * 更新统计信息
   */
  updateStats(usage, responseTime) {
    if (usage) {
      this.stats.tokens += usage.total_tokens || 0;
      this.stats.cost += this.calculateCost('gemini-1.5-flash', usage); // 估算
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

    if (
      message.includes('PERMISSION_DENIED') ||
      message.includes('API_KEY_INVALID')
    ) {
      return errorHandler.createError('GEMINI_AUTH_FAILED', 'API密钥无效');
    }

    if (message.includes('RESOURCE_EXHAUSTED') || message.includes('429')) {
      return errorHandler.createError('GEMINI_RATE_LIMIT', '请求频率过高');
    }

    if (message.includes('INVALID_ARGUMENT')) {
      return errorHandler.createError('GEMINI_BAD_REQUEST', '请求参数错误');
    }

    if (
      message.includes('500') ||
      message.includes('502') ||
      message.includes('503')
    ) {
      return errorHandler.createError(
        'GEMINI_SERVER_ERROR',
        'Gemini服务暂时不可用',
      );
    }

    return errorHandler.createError('GEMINI_UNKNOWN_ERROR', message);
  }

  /**
   * 获取服务统计信息
   */
  getStats() {
    return {
      provider: 'gemini',
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
    logger.info('Gemini服务统计信息已重置');
  }
}
