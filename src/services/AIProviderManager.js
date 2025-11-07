/**
 * AI API 供应商管理器
 * 统一管理多供应商AI API，支持动态配置、模型发现、连接测试和智能路由
 */

import { logger } from '../utils/logger.js';
import { config } from '../utils/config.js';
import { eventSystem } from '../core/events.js';
import { errorHandler } from '../core/error-handler.js';

export class AIProviderManager {
  constructor(options = {}) {
    this.providers = new Map();
    this.models = new Map();
    this.cache = new Map();
    this.healthChecks = new Map();

    this.options = {
      cacheTTL: options.cacheTTL || 3600000, // 1小时
      maxRetries: options.maxRetries || 3,
      timeout: options.timeout || 30000,
      healthCheckInterval: options.healthCheckInterval || 300000, // 5分钟
      ...options
    };

    this.initializeHealthChecks();
  }

  /**
   * 初始化健康检查
   */
  initializeHealthChecks() {
    // 定期检查所有供应商的健康状态
    setInterval(() => {
      this.checkAllProvidersHealth();
    }, this.options.healthCheckInterval);
  }

  /**
   * 注册AI供应商
   */
  async registerProvider(providerConfig) {
    try {
      logger.info('注册AI供应商', { providerId: providerConfig.id, name: providerConfig.name });

      // 验证配置
      this.validateProviderConfig(providerConfig);

      // 创建供应商实例
      const provider = this.createProviderInstance(providerConfig);

      // 测试连接
      await this.testProviderConnection(provider);

      // 注册到管理器
      this.providers.set(providerConfig.id, {
        ...providerConfig,
        instance: provider,
        status: 'active',
        registeredAt: new Date(),
        lastHealthCheck: new Date(),
        healthScore: 100
      });

      // 触发模型发现
      await this.discoverProviderModels(providerConfig.id);

      // 发送事件
      eventSystem.emit('ai:provider:registered', {
        providerId: providerConfig.id,
        provider: providerConfig
      });

      logger.info('AI供应商注册成功', { providerId: providerConfig.id });
      return true;
    } catch (error) {
      logger.error('AI供应商注册失败', {
        providerId: providerConfig.id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 验证供应商配置
   */
  validateProviderConfig(config) {
    if (!config.id || typeof config.id !== 'string') {
      throw new Error('供应商ID不能为空且必须是字符串');
    }

    if (!config.name || typeof config.name !== 'string') {
      throw new Error('供应商名称不能为空且必须是字符串');
    }

    if (!config.type || typeof config.type !== 'string') {
      throw new Error('供应商类型不能为空且必须是字符串');
    }

    if (!config.apiKey || typeof config.apiKey !== 'string') {
      throw new Error('API密钥不能为空且必须是字符串');
    }

    // 验证支持的供应商类型
    const supportedTypes = [
      'openai', 'anthropic', 'google', 'deepseek', 'alibaba',
      'baidu', 'zhipu', 'moonshot', 'xfyun', 'minimax'
    ];

    if (!supportedTypes.includes(config.type)) {
      throw new Error(`不支持的供应商类型: ${config.type}`);
    }
  }

  /**
   * 创建供应商实例
   */
  createProviderInstance(config) {
    const ProviderClass = this.getProviderClass(config.type);
    return new ProviderClass(config);
  }

  /**
   * 获取供应商类
   */
  getProviderClass(type) {
    const providerClasses = {
      openai: OpenAIProvider,
      anthropic: AnthropicProvider,
      google: GoogleProvider,
      deepseek: DeepSeekProvider,
      alibaba: AlibabaProvider,
      baidu: BaiduProvider,
      zhipu: ZhipuProvider,
      moonshot: MoonshotProvider,
      xfyun: XunfeiProvider,
      minimax: MiniMaxProvider
    };

    const ProviderClass = providerClasses[type];
    if (!ProviderClass) {
      throw new Error(`未找到供应商类型 ${type} 的实现类`);
    }

    return ProviderClass;
  }

  /**
   * 测试供应商连接
   */
  async testProviderConnection(provider) {
    try {
      const startTime = Date.now();
      await provider.testConnection();
      const responseTime = Date.now() - startTime;

      logger.debug('供应商连接测试成功', {
        providerId: provider.config.id,
        responseTime
      });

      return { success: true, responseTime };
    } catch (error) {
      logger.error('供应商连接测试失败', {
        providerId: provider.config.id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 发现供应商模型
   */
  async discoverProviderModels(providerId) {
    try {
      const provider = this.providers.get(providerId);
      if (!provider) {
        throw new Error(`供应商 ${providerId} 未注册`);
      }

      logger.info('开始模型发现', { providerId });

      const models = await provider.instance.discoverModels();

      // 更新模型缓存
      this.models.set(providerId, models);

      // 发送事件
      eventSystem.emit('ai:models:discovered', {
        providerId,
        models: models.length,
        modelList: models
      });

      logger.info('模型发现完成', { providerId, modelCount: models.length });
      return models;
    } catch (error) {
      logger.error('模型发现失败', { providerId, error: error.message });
      throw error;
    }
  }

  /**
   * 获取可用模型
   */
  getAvailableModels(providerId = null) {
    if (providerId) {
      return this.models.get(providerId) || [];
    }

    // 返回所有供应商的模型
    const allModels = [];
    for (const [provId, models] of this.models) {
      allModels.push(...models.map(model => ({
        ...model,
        providerId: provId
      })));
    }
    return allModels;
  }

  /**
   * 调用AI API
   */
  async call(request) {
    const { providerId, model, ...apiRequest } = request;

    try {
      const provider = this.providers.get(providerId);
      if (!provider) {
        throw new Error(`供应商 ${providerId} 未找到`);
      }

      if (provider.status !== 'active') {
        throw new Error(`供应商 ${providerId} 当前不可用`);
      }

      // 记录调用开始
      const callId = this.generateCallId();
      const startTime = Date.now();

      eventSystem.emit('ai:call:started', {
        callId,
        providerId,
        model,
        request: apiRequest
      });

      // 执行调用
      const response = await provider.instance.call(model, apiRequest);

      // 记录调用完成
      const duration = Date.now() - startTime;
      eventSystem.emit('ai:call:completed', {
        callId,
        providerId,
        model,
        duration,
        tokens: response.usage,
        cost: this.calculateCost(providerId, model, response.usage)
      });

      // 更新健康分数
      this.updateProviderHealth(providerId, true, duration);

      return response;
    } catch (error) {
      // 更新健康分数
      this.updateProviderHealth(providerId, false, 0);

      // 记录错误
      eventSystem.emit('ai:call:error', {
        providerId,
        model,
        error: error.message,
        errorType: this.classifyError(error)
      });

      throw error;
    }
  }

  /**
   * 智能路由选择最佳供应商
   */
  async route(request, strategy = 'smart') {
    const { model, fallback = true } = request;

    // 找到支持该模型的所有活跃供应商
    const availableProviders = this.findProvidersForModel(model);

    if (availableProviders.length === 0) {
      throw new Error(`没有可用的供应商支持模型 ${model}`);
    }

    // 根据策略选择最佳供应商
    const selectedProvider = this.selectProviderByStrategy(availableProviders, strategy);

    try {
      return await this.call({
        providerId: selectedProvider.id,
        model,
        ...request
      });
    } catch (error) {
      if (!fallback) {
        throw error;
      }

      // 降级到其他供应商
      logger.warn('主要供应商调用失败，开始降级', {
        primaryProvider: selectedProvider.id,
        model,
        error: error.message
      });

      return await this.fallbackCall(request, selectedProvider.id);
    }
  }

  /**
   * 查找支持指定模型的供应商
   */
  findProvidersForModel(model) {
    const availableProviders = [];

    for (const [providerId, provider] of this.providers) {
      if (provider.status === 'active') {
        const models = this.models.get(providerId) || [];
        const hasModel = models.some(m => m.id === model || m.name === model);

        if (hasModel) {
          availableProviders.push({
            id: providerId,
            ...provider,
            models
          });
        }
      }
    }

    return availableProviders;
  }

  /**
   * 根据策略选择供应商
   */
  selectProviderByStrategy(providers, strategy) {
    switch (strategy) {
      case 'fastest':
        return providers.sort((a, b) => a.avgResponseTime - b.avgResponseTime)[0];

      case 'cost-effective':
        return providers.sort((a, b) => {
          const aCost = this.calculateModelCost(a.id, 'default');
          const bCost = this.calculateModelCost(b.id, 'default');
          return aCost - bCost;
        })[0];

      case 'most-reliable':
        return providers.sort((a, b) => b.healthScore - a.healthScore)[0];

      case 'smart':
      default:
        return this.smartSelection(providers);
    }
  }

  /**
   * 智能选择算法
   */
  smartSelection(providers) {
    const weights = {
      health: 0.4,
      speed: 0.3,
      cost: 0.3
    };

    const scored = providers.map(provider => {
      const healthScore = provider.healthScore / 100;
      const speedScore = Math.max(0, 1 - (provider.avgResponseTime || 1000) / 5000);
      const costScore = Math.max(0, 1 - this.calculateModelCost(provider.id, 'default') / 0.1);

      const totalScore = (
        healthScore * weights.health +
        speedScore * weights.speed +
        costScore * weights.cost
      );

      return { ...provider, score: totalScore };
    });

    return scored.sort((a, b) => b.score - a.score)[0];
  }

  /**
   * 降级调用
   */
  async fallbackCall(request, excludeProviderId) {
    const { model } = request;

    // 排除失败的供应商
    const fallbackProviders = this.findProvidersForModel(model)
      .filter(p => p.id !== excludeProviderId);

    for (const provider of fallbackProviders) {
      try {
        logger.info('尝试降级调用', { providerId: provider.id, model });

        return await this.call({
          providerId: provider.id,
          model,
          ...request
        });
      } catch (error) {
        logger.warn('降级调用也失败', {
          providerId: provider.id,
          model,
          error: error.message
        });
        continue;
      }
    }

    throw new Error(`所有供应商都无法处理模型 ${model} 的请求`);
  }

  /**
   * 获取供应商统计信息
   */
  async getProviderStats(providerId) {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`供应商 ${providerId} 未找到`);
    }

    return {
      id: providerId,
      name: provider.name,
      status: provider.status,
      healthScore: provider.healthScore,
      avgResponseTime: provider.avgResponseTime || 0,
      totalRequests: provider.totalRequests || 0,
      errorRate: provider.errorRate || 0,
      lastHealthCheck: provider.lastHealthCheck,
      models: this.models.get(providerId) || []
    };
  }

  /**
   * 获取所有供应商统计信息
   */
  async getAllStats() {
    const stats = {};

    for (const providerId of this.providers.keys()) {
      stats[providerId] = await this.getProviderStats(providerId);
    }

    return stats;
  }

  /**
   * 计算调用成本
   */
  calculateCost(providerId, model, usage) {
    const provider = this.providers.get(providerId);
    if (!provider || !provider.pricing) {
      return 0;
    }

    const modelPricing = provider.pricing.models?.[model];
    if (!modelPricing) {
      return 0;
    }

    const inputCost = (usage?.prompt_tokens || 0) * (modelPricing.input || 0);
    const outputCost = (usage?.completion_tokens || 0) * (modelPricing.output || 0);

    return inputCost + outputCost;
  }

  /**
   * 更新供应商健康状态
   */
  updateProviderHealth(providerId, success, responseTime) {
    const provider = this.providers.get(providerId);
    if (!provider) return;

    provider.lastHealthCheck = new Date();

    if (success) {
      // 成功调用，增加健康分数
      provider.healthScore = Math.min(100, provider.healthScore + 1);
      provider.avgResponseTime = provider.avgResponseTime ?
        (provider.avgResponseTime * 0.9 + responseTime * 0.1) : responseTime;
      provider.totalRequests = (provider.totalRequests || 0) + 1;
    } else {
      // 失败调用，降低健康分数
      provider.healthScore = Math.max(0, provider.healthScore - 10);
      provider.errorCount = (provider.errorCount || 0) + 1;
      provider.errorRate = provider.errorCount / (provider.totalRequests || 1);
    }

    // 如果健康分数过低，标记为降级
    if (provider.healthScore < 30) {
      provider.status = 'degraded';
      eventSystem.emit('ai:provider:degraded', { providerId });
    } else if (provider.healthScore < 10) {
      provider.status = 'inactive';
      eventSystem.emit('ai:provider:inactive', { providerId });
    } else {
      provider.status = 'active';
    }
  }

  /**
   * 检查所有供应商健康状态
   */
  async checkAllProvidersHealth() {
    for (const [providerId, provider] of this.providers) {
      try {
        const health = await this.testProviderConnection(provider.instance);
        this.updateProviderHealth(providerId, health.success, health.responseTime);
      } catch (error) {
        this.updateProviderHealth(providerId, false, 0);
      }
    }
  }

  /**
   * 生成调用ID
   */
  generateCallId() {
    return `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 分类错误类型
   */
  classifyError(error) {
    const message = error.message.toLowerCase();

    if (message.includes('authentication') || message.includes('401')) {
      return 'AUTHENTICATION_ERROR';
    }
    if (message.includes('quota') || message.includes('429')) {
      return 'QUOTA_EXCEEDED';
    }
    if (message.includes('network') || message.includes('timeout')) {
      return 'NETWORK_ERROR';
    }
    if (message.includes('model') && message.includes('not found')) {
      return 'MODEL_UNAVAILABLE';
    }

    return 'UNKNOWN_ERROR';
  }

  /**
   * 关闭管理器
   */
  async close() {
    logger.info('关闭AI供应商管理器');

    // 清理缓存
    this.cache.clear();
    this.models.clear();

    // 清理健康检查定时器
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    eventSystem.emit('ai:manager:closed');
  }
}

// 基础供应商类
class BaseAIProvider {
  constructor(config) {
    this.config = config;
    this.httpClient = null; // 将由具体实现设置
  }

  async testConnection() {
    // 基础连接测试，由子类实现
    throw new Error('testConnection must be implemented by subclass');
  }

  async discoverModels() {
    // 模型发现，由子类实现
    throw new Error('discoverModels must be implemented by subclass');
  }

  async call(model, request) {
    // API调用，由子类实现
    throw new Error('call must be implemented by subclass');
  }
}

// OpenAI供应商实现
class OpenAIProvider extends BaseAIProvider {
  constructor(config) {
    super(config);
    // 这里需要注入HTTP客户端
    this.baseURL = config.baseURL || 'https://api.openai.com/v1';
  }

  async testConnection() {
    // 简单的连接测试
    const response = await fetch(`${this.baseURL}/models`, {
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`OpenAI API test failed: ${response.status}`);
    }

    return { success: true };
  }

  async discoverModels() {
    const response = await fetch(`${this.baseURL}/models`, {
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch OpenAI models: ${response.status}`);
    }

    const data = await response.json();
    return data.data.map(model => ({
      id: model.id,
      name: model.id,
      type: 'chat',
      contextLength: model.context_length || 4096,
      pricing: this.getModelPricing(model.id),
      capabilities: ['chat', 'completion'],
      status: 'active'
    }));
  }

  getModelPricing(modelId) {
    const pricing = {
      'gpt-4': { input: 0.03, output: 0.06 },
      'gpt-4-turbo': { input: 0.01, output: 0.03 },
      'gpt-3.5-turbo': { input: 0.0015, output: 0.002 }
    };
    return pricing[modelId] || { input: 0.002, output: 0.002 };
  }

  async call(model, request) {
    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: request.messages,
        temperature: request.temperature || 0.7,
        max_tokens: request.maxTokens || 1000
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API call failed: ${response.status}`);
    }

    return await response.json();
  }
}

// 其他供应商的占位符实现
class AnthropicProvider extends BaseAIProvider {
  async testConnection() { return { success: true }; }
  async discoverModels() { return []; }
  async call(model, request) { throw new Error('Not implemented'); }
}

class GoogleProvider extends BaseAIProvider {
  async testConnection() { return { success: true }; }
  async discoverModels() { return []; }
  async call(model, request) { throw new Error('Not implemented'); }
}

class DeepSeekProvider extends BaseAIProvider {
  async testConnection() { return { success: true }; }
  async discoverModels() { return []; }
  async call(model, request) { throw new Error('Not implemented'); }
}

class AlibabaProvider extends BaseAIProvider {
  async testConnection() { return { success: true }; }
  async discoverModels() { return []; }
  async call(model, request) { throw new Error('Not implemented'); }
}

class BaiduProvider extends BaseAIProvider {
  async testConnection() { return { success: true }; }
  async discoverModels() { return []; }
  async call(model, request) { throw new Error('Not implemented'); }
}

class ZhipuProvider extends BaseAIProvider {
  async testConnection() { return { success: true }; }
  async discoverModels() { return []; }
  async call(model, request) { throw new Error('Not implemented'); }
}

class MoonshotProvider extends BaseAIProvider {
  async testConnection() { return { success: true }; }
  async discoverModels() { return []; }
  async call(model, request) { throw new Error('Not implemented'); }
}

class XunfeiProvider extends BaseAIProvider {
  async testConnection() { return { success: true }; }
  async discoverModels() { return []; }
  async call(model, request) { throw new Error('Not implemented'); }
}

class MiniMaxProvider extends BaseAIProvider {
  async testConnection() { return { success: true }; }
  async discoverModels() { return []; }
  async call(model, request) { throw new Error('Not implemented'); }
}
