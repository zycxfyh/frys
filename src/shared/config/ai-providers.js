/**
 * AI API 供应商配置
 * 包含所有支持的AI供应商的信息和配置
 */

export const AI_PROVIDERS = {
  openai: {
    name: 'OpenAI',
    models: ['gpt-4', 'gpt-3.5-turbo', 'gpt-4-turbo'],
    baseUrl: 'https://api.openai.com/v1',
    rateLimits: {
      requestsPerMinute: 60,
      tokensPerMinute: 40000
    },
    pricing: {
      input: 0.0015, // per 1K tokens
      output: 0.002  // per 1K tokens
    }
  },

  anthropic: {
    name: 'Anthropic',
    models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
    baseUrl: 'https://api.anthropic.com/v1',
    rateLimits: {
      requestsPerMinute: 50,
      tokensPerMinute: 25000
    },
    pricing: {
      input: 0.015, // per 1K tokens
      output: 0.075  // per 1K tokens
    }
  },

  google: {
    name: 'Google AI',
    models: ['gemini-pro', 'gemini-pro-vision', 'palm-2'],
    baseUrl: 'https://generativelanguage.googleapis.com/v1',
    rateLimits: {
      requestsPerMinute: 60,
      tokensPerMinute: 32000
    },
    pricing: {
      input: 0.00025, // per 1K characters
      output: 0.0005  // per 1K characters
    }
  },

  local: {
    name: 'Local Model',
    models: ['llama-2-7b', 'llama-2-13b', 'mistral-7b'],
    baseUrl: 'http://localhost:11434/v1',
    rateLimits: {
      requestsPerMinute: 1000,
      tokensPerMinute: 100000
    },
    pricing: {
      input: 0, // free
      output: 0  // free
    }
  }
};

/**
 * 获取供应商信息
 */
export function getProviderInfo(providerId) {
  return AI_PROVIDERS[providerId] || null;
}

/**
 * 根据使用场景推荐供应商
 */
export function recommendProviders(useCase) {
  const recommendations = {
    coding: ['anthropic', 'openai', 'google'],
    creative: ['openai', 'anthropic', 'google'],
    analysis: ['openai', 'anthropic', 'google'],
    chat: ['openai', 'anthropic', 'google'],
    fast: ['google', 'openai', 'anthropic'],
    cheap: ['google', 'local', 'openai']
  };

  return recommendations[useCase] || ['openai'];
}

/**
 * 获取供应商状态
 */
export function getProviderStatus(providerId) {
  const provider = AI_PROVIDERS[providerId];
  if (!provider) return null;

  return {
    id: providerId,
    name: provider.name,
    status: 'available', // 可以扩展为更复杂的状态检查
    models: provider.models,
    rateLimits: provider.rateLimits,
    pricing: provider.pricing
  };
}

/**
 * 获取所有可用供应商
 */
export function getAvailableProviders() {
  return Object.keys(AI_PROVIDERS).map(getProviderStatus);
}

/**
 * 验证API密钥格式
 */
export function validateApiKey(providerId, apiKey) {
  if (!apiKey || typeof apiKey !== 'string') return false;

  const validations = {
    openai: (key) => key.startsWith('sk-') && key.length > 20,
    anthropic: (key) => key.startsWith('sk-ant-') && key.length > 20,
    google: (key) => key.length > 10,
    local: (key) => true // 本地模型不需要API密钥
  };

  const validator = validations[providerId];
  return validator ? validator(apiKey) : false;
}

export default {
  AI_PROVIDERS,
  getProviderInfo,
  recommendProviders,
  getProviderStatus,
  getAvailableProviders,
  validateApiKey
};
