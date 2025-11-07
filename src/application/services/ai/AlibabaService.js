/**
 * 阿里云通义千问专用AI服务
 * 提供Alibaba Qwen相关的所有API接口和业务逻辑
 */

import { logger } from '../../../utils/logger.js';
import { config } from '../../../utils/config.js';
import { errorHandler } from '../../../core/error-handler.js';
import { eventSystem } from '../../../core/events.js';

export class AlibabaService {
  constructor(options = {}) {
    this.name = '通义千问 (Alibaba)';
    this.providerId = 'alibaba';
    this.baseURL = options.baseURL || 'https://dashscope.aliyuncs.com/api/v1';
    this.apiKey = options.apiKey || config.ai.providers.alibaba.apiKey;
    this.timeout = options.timeout || 30000;
    this.maxRetries = options.maxRetries || 3;

    // 监控统计
    this.stats = {
      requests: 0,
      errors: 0,
      tokens: 0,
      cost: 0,
      avgResponseTime: 0
    };

    this.requestTimes = [];

    logger.info('阿里云通义千问服务初始化完成', {
      baseURL: this.baseURL,
      timeout: this.timeout
    });
  }

  /**
   * 测试连接
   */
  async testConnection() {
    try {
      // 使用一个简单的请求测试连接
      const response = await fetch(`${this.baseURL}/services/aigc/text-generation/generation`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'qwen-turbo',
          input: {
            messages: [{ role: 'user', content: 'Hello' }]
          },
          parameters: {
            max_tokens: 10
          }
        }),
        signal: AbortSignal.timeout(this.timeout)
      });

      if (response.status === 401) {
        throw new Error('Invalid API key');
      }

      logger.info('阿里云通义千问连接测试成功');

      return {
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('阿里云通义千问连接测试失败', { error: error.message });
      throw errorHandler.createError('ALIBABA_CONNECTION_FAILED', error.message);
    }
  }

  /**
   * 获取可用模型列表
   */
  async getModels() {
    // 通义千问没有公开的models API，我们返回已知模型
    const models = [
      {
        id: 'qwen-turbo',
        name: 'Qwen Turbo',
        type: 'chat',
        contextLength: 8192,
        pricing: { input: 0.00014, output: 0.00028 },
        capabilities: ['chat', 'completion'],
        status: 'active'
      },
      {
        id: 'qwen-plus',
        name: 'Qwen Plus',
        type: 'chat',
        contextLength: 32768,
        pricing: { input: 0.00035, output: 0.0007 },
        capabilities: ['chat', 'completion', 'function-calling'],
        status: 'active'
      },
      {
        id: 'qwen-max',
        name: 'Qwen Max',
        type: 'chat',
        contextLength: 8192,
        pricing: { input: 0.002, output: 0.004 },
        capabilities: ['chat', 'completion', 'function-calling', 'multilingual'],
        status: 'active'
      },
      {
        id: 'qwen-max-longcontext',
        name: 'Qwen Max Long Context',
        type: 'chat',
        contextLength: 131072,
        pricing: { input: 0.002, output: 0.004 },
        capabilities: ['chat', 'completion', 'long-context'],
        status: 'active'
      }
    ];

    return models;
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
        input: {
          messages: request.messages
        },
        parameters: {
          temperature: request.temperature || 0.7,
          max_tokens: request.maxTokens || 1500,
          incremental_output: request.stream || false
        }
      };

      logger.debug('发送阿里云通义千问聊天请求', {
        model: request.model,
        messageCount: request.messages.length,
        stream: request.stream
      });

      const response = await fetch(`${this.baseURL}/services/aigc/text-generation/generation`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.timeout)
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorData}`);
      }

      const data = await response.json();
      const responseTime = Date.now() - startTime;

      // 解析通义千问响应格式
      const output = data.output;
      const usage = output.usage || {};

      // 更新统计信息
      this.updateStats(usage, responseTime);

      // 发送事件
      eventSystem.emit('ai:request:completed', {
        provider: 'alibaba',
        model: request.model,
        responseTime,
        tokens: usage,
        cost: this.calculateCost(request.model, usage)
      });

      // 转换响应格式以保持一致性
      return {
        id: `qwen_${Date.now()}`,
        model: request.model,
        choices: [{
          message: {
            role: 'assistant',
            content: output.text || ''
          },
          finish_reason: output.finish_reason || 'stop'
        }],
        usage: {
          prompt_tokens: usage.input_tokens || 0,
          completion_tokens: usage.output_tokens || 0,
          total_tokens: (usage.input_tokens || 0) + (usage.output_tokens || 0)
        },
        cost: this.calculateCost(request.model, usage),
        responseTime,
        provider: 'alibaba'
      };

    } catch (error) {
      this.stats.errors++;
      const responseTime = Date.now() - startTime;

      logger.error('阿里云通义千问聊天请求失败', {
        model: request.model,
        error: error.message,
        responseTime
      });

      eventSystem.emit('ai:request:error', {
        provider: 'alibaba',
        model: request.model,
        error: error.message,
        responseTime
      });

      throw this.handleError(error);
    }
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
      'qwen-turbo': { input: 0.00014, output: 0.00028 },
      'qwen-plus': { input: 0.00035, output: 0.0007 },
      'qwen-max': { input: 0.002, output: 0.004 },
      'qwen-max-longcontext': { input: 0.002, output: 0.004 }
    };
    return pricing[modelId] || { input: 0.00014, output: 0.00028 };
  }

  /**
   * 更新统计信息
   */
  updateStats(usage, responseTime) {
    if (usage) {
      const totalTokens = (usage.input_tokens || 0) + (usage.output_tokens || 0);
      this.stats.tokens += totalTokens;
      this.stats.cost += this.calculateCost('qwen-turbo', usage); // 估算
    }

    this.requestTimes.push(responseTime);

    if (this.requestTimes.length > 100) {
      this.requestTimes.shift();
    }

    this.stats.avgResponseTime = this.requestTimes.reduce((a, b) => a + b, 0) / this.requestTimes.length;
  }

  /**
   * 处理错误
   */
  handleError(error) {
    const message = error.message;

    if (message.includes('401') || message.includes('Unauthorized')) {
      return errorHandler.createError('ALIBABA_AUTH_FAILED', 'API密钥无效');
    }

    if (message.includes('429') || message.includes('Too Many Requests')) {
      return errorHandler.createError('ALIBABA_RATE_LIMIT', '请求频率过高');
    }

    if (message.includes('400') || message.includes('InvalidParameter')) {
      return errorHandler.createError('ALIBABA_BAD_REQUEST', '请求参数错误');
    }

    if (message.includes('500') || message.includes('502') || message.includes('503')) {
      return errorHandler.createError('ALIBABA_SERVER_ERROR', '阿里云服务暂时不可用');
    }

    return errorHandler.createError('ALIBABA_UNKNOWN_ERROR', message);
  }

  /**
   * 获取服务统计信息
   */
  getStats() {
    return {
      provider: 'alibaba',
      name: this.name,
      requests: this.stats.requests,
      errors: this.stats.errors,
      errorRate: this.stats.requests > 0 ? this.stats.errors / this.stats.requests : 0,
      tokens: this.stats.tokens,
      cost: this.stats.cost,
      avgResponseTime: this.stats.avgResponseTime,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
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
      avgResponseTime: 0
    };
    this.requestTimes = [];
    logger.info('阿里云通义千问服务统计信息已重置');
  }
}
