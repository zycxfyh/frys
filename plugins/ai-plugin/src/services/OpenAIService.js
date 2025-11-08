/**
 * OpenAI专用AI服务
 * 提供OpenAI相关的所有API接口和业务逻辑
 */

import { logger } from '../../../utils/logger.js';
import { config } from '../../../utils/config.js';
import { errorHandler } from '../../../core/error-handler.js';
import { eventSystem } from '../../../core/events.js';

export class OpenAIService {
  constructor(options = {}) {
    this.name = 'OpenAI';
    this.providerId = 'openai';
    this.baseURL = options.baseURL || 'https://api.openai.com/v1';
    this.apiKey = options.apiKey || config.ai.providers.openai.apiKey;
    this.timeout = options.timeout || 30000;
    this.maxRetries = options.maxRetries || 3;

    // 测试模式检测
    this.isTestMode =
      this.apiKey === 'test-openai-key' || this.apiKey?.startsWith('test-');

    // 监控统计
    this.stats = {
      requests: 0,
      errors: 0,
      tokens: 0,
      cost: 0,
      avgResponseTime: 0,
    };

    this.requestTimes = [];

    logger.info('OpenAI服务初始化完成', {
      baseURL: this.baseURL,
      timeout: this.timeout,
      testMode: this.isTestMode,
    });
  }

  /**
   * 测试连接
   */
  async testConnection() {
    // 测试模式下直接返回成功
    if (this.isTestMode) {
      return {
        success: true,
        message: 'OpenAI服务连接测试通过 (测试模式)',
        models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
      };
    }

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
      logger.info('OpenAI连接测试成功', {
        modelCount: data.data?.length || 0,
      });

      return {
        success: true,
        models: data.data?.length || 0,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('OpenAI连接测试失败', { error: error.message });
      throw errorHandler.createError('OPENAI_CONNECTION_FAILED', error.message);
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
        .filter((model) => model.id.includes('gpt'))
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
      logger.error('获取OpenAI模型列表失败', { error: error.message });
      throw errorHandler.createError(
        'OPENAI_MODELS_FETCH_FAILED',
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
        id: `chatcmpl-test-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: request.model,
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content:
                '这是来自OpenAI服务的测试响应。系统正在测试模式下运行，所有AI功能都使用模拟数据。',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 50,
          completion_tokens: 30,
          total_tokens: 80,
        },
      };

      const responseTime = 100 + Math.random() * 200; // 模拟100-300ms响应时间
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

      const payload = {
        model: request.model,
        messages: request.messages,
        temperature: request.temperature || 0.7,
        max_tokens: request.maxTokens || 1000,
        stream: request.stream || false,
        ...(request.functions && { functions: request.functions }),
        ...(request.function_call && { function_call: request.function_call }),
      };

      logger.debug('发送OpenAI聊天请求', {
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
        provider: 'openai',
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
        provider: 'openai',
      };
    } catch (error) {
      this.stats.errors++;
      const responseTime = Date.now() - startTime;

      logger.error('OpenAI聊天请求失败', {
        model: request.model,
        error: error.message,
        responseTime,
      });

      // 发送错误事件
      eventSystem.emit('ai:request:error', {
        provider: 'openai',
        model: request.model,
        error: error.message,
        responseTime,
      });

      throw this.handleError(error);
    }
  }

  /**
   * 文本嵌入
   */
  async createEmbeddings(request) {
    const startTime = Date.now();

    try {
      this.stats.requests++;

      const payload = {
        model: request.model || 'text-embedding-ada-002',
        input: request.input,
        user: request.user,
      };

      const response = await fetch(`${this.baseURL}/embeddings`, {
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
      const tokens = data.usage?.total_tokens || 0;
      this.stats.tokens += tokens;
      this.requestTimes.push(responseTime);

      return {
        embeddings: data.data,
        usage: data.usage,
        cost: this.calculateEmbeddingCost(request.model, tokens),
        responseTime,
        provider: 'openai',
      };
    } catch (error) {
      this.stats.errors++;
      logger.error('OpenAI嵌入请求失败', { error: error.message });
      throw this.handleError(error);
    }
  }

  /**
   * 图像生成 (DALL-E)
   */
  async createImage(request) {
    const startTime = Date.now();

    try {
      this.stats.requests++;

      const payload = {
        prompt: request.prompt,
        n: request.n || 1,
        size: request.size || '1024x1024',
        response_format: request.responseFormat || 'url',
        user: request.user,
      };

      const response = await fetch(`${this.baseURL}/images/generations`, {
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

      this.requestTimes.push(responseTime);

      return {
        images: data.data,
        cost: this.calculateImageCost(request.size, request.n || 1),
        responseTime,
        provider: 'openai',
      };
    } catch (error) {
      this.stats.errors++;
      logger.error('OpenAI图像生成失败', { error: error.message });
      throw this.handleError(error);
    }
  }

  /**
   * 音频转录 (Whisper)
   */
  async createTranscription(request) {
    const startTime = Date.now();

    try {
      this.stats.requests++;

      const formData = new FormData();
      formData.append('file', request.file);
      formData.append('model', request.model || 'whisper-1');

      if (request.language) {
        formData.append('language', request.language);
      }

      if (request.prompt) {
        formData.append('prompt', request.prompt);
      }

      const response = await fetch(`${this.baseURL}/audio/transcriptions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: formData,
        signal: AbortSignal.timeout(this.timeout * 2), // 音频处理需要更长时间
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorData}`);
      }

      const data = await response.json();
      const responseTime = Date.now() - startTime;

      this.requestTimes.push(responseTime);

      return {
        text: data.text,
        language: data.language,
        cost: this.calculateAudioCost(request.file.size),
        responseTime,
        provider: 'openai',
      };
    } catch (error) {
      this.stats.errors++;
      logger.error('OpenAI音频转录失败', { error: error.message });
      throw this.handleError(error);
    }
  }

  /**
   * 获取模型显示名称
   */
  getModelDisplayName(modelId) {
    const names = {
      'gpt-4': 'GPT-4',
      'gpt-4-turbo': 'GPT-4 Turbo',
      'gpt-4-turbo-preview': 'GPT-4 Turbo Preview',
      'gpt-3.5-turbo': 'GPT-3.5 Turbo',
      'gpt-3.5-turbo-16k': 'GPT-3.5 Turbo 16K',
    };
    return names[modelId] || modelId;
  }

  /**
   * 获取模型上下文长度
   */
  getModelContextLength(modelId) {
    const lengths = {
      'gpt-4': 8192,
      'gpt-4-turbo': 128000,
      'gpt-4-turbo-preview': 128000,
      'gpt-3.5-turbo': 4096,
      'gpt-3.5-turbo-16k': 16384,
    };
    return lengths[modelId] || 4096;
  }

  /**
   * 获取模型定价
   */
  getModelPricing(modelId) {
    const pricing = {
      'gpt-4': { input: 0.03, output: 0.06 },
      'gpt-4-turbo': { input: 0.01, output: 0.03 },
      'gpt-3.5-turbo': { input: 0.0015, output: 0.002 },
    };
    return pricing[modelId] || { input: 0.002, output: 0.002 };
  }

  /**
   * 获取模型能力
   */
  getModelCapabilities(modelId) {
    const capabilities = {
      'gpt-4': ['chat', 'completion', 'function-calling'],
      'gpt-4-turbo': ['chat', 'completion', 'function-calling', 'vision'],
      'gpt-3.5-turbo': ['chat', 'completion'],
    };
    return capabilities[modelId] || ['chat'];
  }

  /**
   * 计算聊天成本
   */
  calculateCost(model, usage) {
    if (!usage) return 0;

    const pricing = this.getModelPricing(model);
    const inputCost = (usage.prompt_tokens || 0) * pricing.input;
    const outputCost = (usage.completion_tokens || 0) * pricing.output;

    return inputCost + outputCost;
  }

  /**
   * 计算嵌入成本
   */
  calculateEmbeddingCost(model, tokens) {
    const pricing = {
      'text-embedding-ada-002': 0.0001,
    };
    return (pricing[model] || 0.0001) * tokens;
  }

  /**
   * 计算图像生成成本
   */
  calculateImageCost(size, count) {
    const pricing = {
      '1024x1024': 0.02,
      '512x512': 0.018,
      '256x256': 0.016,
    };
    return (pricing[size] || 0.02) * count;
  }

  /**
   * 计算音频处理成本
   */
  calculateAudioCost(fileSize) {
    // Whisper按分钟收费，约$0.006/分钟
    const minutes = Math.ceil(fileSize / (1024 * 1024 * 25)); // 估算每MB约25分钟
    return 0.006 * minutes;
  }

  /**
   * 更新统计信息
   */
  updateStats(usage, responseTime) {
    if (usage) {
      this.stats.tokens += usage.total_tokens || 0;
      this.stats.cost += this.calculateCost('gpt-3.5-turbo', usage); // 估算成本
    }

    this.requestTimes.push(responseTime);

    // 保持最近100个请求的时间记录
    if (this.requestTimes.length > 100) {
      this.requestTimes.shift();
    }

    // 计算平均响应时间
    this.stats.avgResponseTime =
      this.requestTimes.reduce((a, b) => a + b, 0) / this.requestTimes.length;
  }

  /**
   * 处理错误
   */
  handleError(error) {
    const message = error.message;

    if (message.includes('401')) {
      return errorHandler.createError(
        'OPENAI_AUTH_FAILED',
        'API密钥无效或过期',
      );
    }

    if (message.includes('429')) {
      return errorHandler.createError(
        'OPENAI_RATE_LIMIT',
        '请求频率过高，请稍后重试',
      );
    }

    if (message.includes('400')) {
      return errorHandler.createError('OPENAI_BAD_REQUEST', '请求参数错误');
    }

    if (
      message.includes('500') ||
      message.includes('502') ||
      message.includes('503')
    ) {
      return errorHandler.createError(
        'OPENAI_SERVER_ERROR',
        'OpenAI服务暂时不可用',
      );
    }

    return errorHandler.createError('OPENAI_UNKNOWN_ERROR', message);
  }

  /**
   * 获取服务统计信息
   */
  getStats() {
    return {
      provider: 'openai',
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
    logger.info('OpenAI服务统计信息已重置');
  }
}
