/**
 * DeepSeek专用AI服务
 * 提供DeepSeek相关的所有API接口和业务逻辑
 */

import { errorHandler } from '../../../core/error-handler.js';
import { eventSystem } from '../../../core/events.js';
import { config } from '../../../utils/config.js';
import { logger } from '../../../utils/logger.js';

export class DeepSeekService {
  constructor(options = {}) {
    this.name = 'DeepSeek';
    this.providerId = 'deepseek';
    this.baseURL = options.baseURL || 'https://api.deepseek.com/v1';
    this.apiKey = options.apiKey || config.ai.providers.deepseek.apiKey;
    this.timeout = options.timeout || 30000;
    this.maxRetries = options.maxRetries || 3;

    // 测试模式检测
    this.isTestMode =
      this.apiKey === 'test-deepseek-key' || this.apiKey?.startsWith('test-');

    // 监控统计
    this.stats = {
      requests: 0,
      errors: 0,
      tokens: 0,
      cost: 0,
      avgResponseTime: 0,
    };

    this.requestTimes = [];

    logger.info('DeepSeek服务初始化完成', {
      baseURL: this.baseURL,
      timeout: this.timeout,
    });
  }

  /**
   * 测试连接
   */
  async testConnection() {
    try {
      const response = await fetch(`${this.baseURL}/models`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      logger.info('DeepSeek连接测试成功', {
        modelCount: data.data?.length || 0,
      });

      return {
        success: true,
        models: data.data?.length || 0,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('DeepSeek连接测试失败', { error: error.message });
      throw errorHandler.createError(
        'DEEPSEEK_CONNECTION_FAILED',
        error.message,
      );
    }
  }

  /**
   * 获取可用模型列表
   */
  async getModels() {
    try {
      const response = await fetch(`${this.baseURL}/models`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // 过滤和格式化模型信息
      const models = data.data
        .filter((model) => model.id.includes('deepseek'))
        .map((model) => ({
          id: model.id,
          name: this.getModelDisplayName(model.id),
          type: 'chat',
          contextLength: this.getModelContextLength(model.id),
          pricing: this.getModelPricing(model.id),
          capabilities: this.getModelCapabilities(model.id),
          status: 'active',
        }));

      return models;
    } catch (error) {
      logger.error('获取DeepSeek模型列表失败', { error: error.message });
      throw errorHandler.createError(
        'DEEPSEEK_MODELS_FETCH_FAILED',
        error.message,
      );
    }
  }

  /**
   * 聊天完成
   */
  async chatCompletion(request) {
    const startTime = Date.now();

    try {
      this.stats.requests++;

      const payload = {
        model: request.model,
        messages: request.messages,
        temperature: request.temperature || 0.7,
        max_tokens: request.maxTokens || 2048,
        stream: request.stream || false,
      };

      logger.debug('发送DeepSeek聊天请求', {
        model: request.model,
        messageCount: request.messages.length,
        stream: request.stream,
      });

      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
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
        provider: 'deepseek',
        model: request.model,
        responseTime,
        tokens: data.usage,
        cost: this.calculateCost(request.model, data.usage),
      });

      return {
        id: data.id,
        model: data.model,
        choices: data.choices,
        usage: data.usage,
        cost: this.calculateCost(request.model, data.usage),
        responseTime,
        provider: 'deepseek',
      };
    } catch (error) {
      this.stats.errors++;
      const responseTime = Date.now() - startTime;

      logger.error('DeepSeek聊天请求失败', {
        model: request.model,
        error: error.message,
        responseTime,
      });

      eventSystem.emit('ai:request:error', {
        provider: 'deepseek',
        model: request.model,
        error: error.message,
        responseTime,
      });

      throw this.handleError(error);
    }
  }

  /**
   * 获取模型显示名称
   */
  getModelDisplayName(modelId) {
    const names = {
      'deepseek-chat': 'DeepSeek Chat',
      'deepseek-coder': 'DeepSeek Coder',
      'deepseek-chat-67b': 'DeepSeek Chat 67B',
      'deepseek-coder-33b': 'DeepSeek Coder 33B',
    };
    return names[modelId] || modelId;
  }

  /**
   * 获取模型上下文长度
   */
  getModelContextLength(modelId) {
    const lengths = {
      'deepseek-chat': 32768,
      'deepseek-coder': 16384,
      'deepseek-chat-67b': 4096,
      'deepseek-coder-33b': 16384,
    };
    return lengths[modelId] || 16384;
  }

  /**
   * 获取模型定价
   */
  getModelPricing(modelId) {
    const pricing = {
      'deepseek-chat': { input: 0.00014, output: 0.00028 },
      'deepseek-coder': { input: 0.00014, output: 0.00028 },
      'deepseek-chat-67b': { input: 0.00028, output: 0.00056 },
      'deepseek-coder-33b': { input: 0.00014, output: 0.00028 },
    };
    return pricing[modelId] || { input: 0.00014, output: 0.00028 };
  }

  /**
   * 获取模型能力
   */
  getModelCapabilities(modelId) {
    const capabilities = {
      'deepseek-chat': ['chat', 'completion'],
      'deepseek-coder': ['chat', 'completion', 'code-generation'],
      'deepseek-chat-67b': ['chat', 'completion'],
      'deepseek-coder-33b': ['chat', 'completion', 'code-generation'],
    };
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
      this.stats.cost += this.calculateCost('deepseek-chat', usage); // 估算
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

    if (message.includes('401') || message.includes('Unauthorized')) {
      return errorHandler.createError('DEEPSEEK_AUTH_FAILED', 'API密钥无效');
    }

    if (message.includes('429') || message.includes('rate limit')) {
      return errorHandler.createError('DEEPSEEK_RATE_LIMIT', '请求频率过高');
    }

    if (message.includes('400')) {
      return errorHandler.createError('DEEPSEEK_BAD_REQUEST', '请求参数错误');
    }

    if (
      message.includes('500') ||
      message.includes('502') ||
      message.includes('503')
    ) {
      return errorHandler.createError(
        'DEEPSEEK_SERVER_ERROR',
        'DeepSeek服务暂时不可用',
      );
    }

    return errorHandler.createError('DEEPSEEK_UNKNOWN_ERROR', message);
  }

  /**
   * 获取服务统计信息
   */
  getStats() {
    return {
      provider: 'deepseek',
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
    logger.info('DeepSeek服务统计信息已重置');
  }
}
