/**
 * AI API 供应商配置
 * 包含所有支持的AI供应商信息、base URL、价格文档等
 */

export const AI_PROVIDERS = {
  // OpenAI 系列
  openai: {
    name: 'OpenAI',
    description: 'OpenAI GPT系列模型，业界领先的AI模型提供商',
    baseURL: 'https://api.openai.com/v1',
    website: 'https://openai.com',
    pricing: {
      url: 'https://openai.com/pricing/',
      currency: 'USD',
      billing: '按token计费',
      models: {
        'gpt-4': {
          name: 'GPT-4',
          input: 0.03,
          output: 0.06,
          contextLength: 8192,
          capabilities: ['chat', 'completion', 'function-calling']
        },
        'gpt-4-turbo': {
          name: 'GPT-4 Turbo',
          input: 0.01,
          output: 0.03,
          contextLength: 128000,
          capabilities: ['chat', 'completion', 'function-calling', 'vision']
        },
        'gpt-3.5-turbo': {
          name: 'GPT-3.5 Turbo',
          input: 0.0015,
          output: 0.002,
          contextLength: 16385,
          capabilities: ['chat', 'completion']
        }
      }
    },
    features: ['function-calling', 'vision', 'streaming', 'fine-tuning'],
    regions: ['global'],
    reliability: 0.99,
    icon: '🤖'
  },

  // Anthropic Claude 系列
  anthropic: {
    name: 'Anthropic Claude',
    description: '专注于安全和可靠的AI模型，Claude系列以安全性著称',
    baseURL: 'https://api.anthropic.com/v1',
    website: 'https://www.anthropic.com',
    pricing: {
      url: 'https://www.anthropic.com/pricing/',
      currency: 'USD',
      billing: '按token计费',
      models: {
        'claude-3-opus': {
          name: 'Claude 3 Opus',
          input: 0.015,
          output: 0.075,
          contextLength: 200000,
          capabilities: ['chat', 'completion', 'vision', 'function-calling']
        },
        'claude-3-sonnet': {
          name: 'Claude 3 Sonnet',
          input: 0.003,
          output: 0.015,
          contextLength: 200000,
          capabilities: ['chat', 'completion', 'vision', 'function-calling']
        },
        'claude-3-haiku': {
          name: 'Claude 3 Haiku',
          input: 0.00025,
          output: 0.00125,
          contextLength: 200000,
          capabilities: ['chat', 'completion', 'vision']
        }
      }
    },
    features: ['safety-first', 'long-context', 'vision', 'function-calling'],
    regions: ['us', 'eu'],
    reliability: 0.995,
    icon: '🧠'
  },

  // Google Gemini 系列
  google: {
    name: 'Google Gemini',
    description: 'Google的AI模型，集成Google生态，支持多模态',
    baseURL: 'https://generativelanguage.googleapis.com/v1',
    website: 'https://ai.google.dev',
    pricing: {
      url: 'https://ai.google.dev/pricing',
      currency: 'USD',
      billing: '按token计费',
      models: {
        'gemini-1.5-pro': {
          name: 'Gemini 1.5 Pro',
          input: 0.00025,
          output: 0.0005,
          contextLength: 1000000,
          capabilities: ['chat', 'completion', 'vision', 'audio', 'function-calling']
        },
        'gemini-1.5-flash': {
          name: 'Gemini 1.5 Flash',
          input: 0.000075,
          output: 0.0003,
          contextLength: 1000000,
          capabilities: ['chat', 'completion', 'vision', 'audio']
        }
      }
    },
    features: ['multimodal', 'long-context', 'google-ecosystem', 'function-calling'],
    regions: ['global'],
    reliability: 0.98,
    icon: '💎'
  },

  // DeepSeek 系列
  deepseek: {
    name: 'DeepSeek',
    description: 'DeepSeek的开源大模型，提供高性价比的AI服务',
    baseURL: 'https://api.deepseek.com/v1',
    website: 'https://platform.deepseek.com',
    pricing: {
      url: 'https://platform.deepseek.com/api-docs/pricing',
      currency: 'CNY',
      billing: '按token计费',
      models: {
        'deepseek-chat': {
          name: 'DeepSeek Chat',
          input: 0.00014,
          output: 0.00028,
          contextLength: 32768,
          capabilities: ['chat', 'completion']
        },
        'deepseek-coder': {
          name: 'DeepSeek Coder',
          input: 0.00014,
          output: 0.00028,
          contextLength: 16384,
          capabilities: ['chat', 'completion', 'code-generation']
        }
      }
    },
    features: ['cost-effective', 'open-source', 'code-specialized'],
    regions: ['china'],
    reliability: 0.97,
    icon: '🔍'
  },

  // 阿里云通义千问
  alibaba: {
    name: '通义千问 (Alibaba)',
    description: '阿里云的大语言模型，中文能力优秀，企业级服务',
    baseURL: 'https://dashscope.aliyuncs.com/api/v1',
    website: 'https://help.aliyun.com/zh/dashscope',
    pricing: {
      url: 'https://help.aliyun.com/zh/dashscope/developer-reference/tongyi-qianwen',
      currency: 'CNY',
      billing: '按token计费',
      models: {
        'qwen-turbo': {
          name: 'Qwen Turbo',
          input: 0.00014,
          output: 0.00028,
          contextLength: 8192,
          capabilities: ['chat', 'completion']
        },
        'qwen-plus': {
          name: 'Qwen Plus',
          input: 0.00035,
          output: 0.0007,
          contextLength: 32768,
          capabilities: ['chat', 'completion', 'function-calling']
        },
        'qwen-max': {
          name: 'Qwen Max',
          input: 0.002,
          output: 0.004,
          contextLength: 8192,
          capabilities: ['chat', 'completion', 'function-calling', 'multilingual']
        }
      }
    },
    features: ['chinese-excellent', 'enterprise-grade', 'function-calling'],
    regions: ['china'],
    reliability: 0.99,
    icon: '🐉'
  },

  // 百度文心一言
  baidu: {
    name: '文心一言 (Baidu)',
    description: '百度的大语言模型，知识丰富，中文能力强',
    baseURL: 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1',
    website: 'https://ai.baidu.com',
    pricing: {
      url: 'https://ai.baidu.com/ai-doc/PLATFORM/2ah9qbqo9',
      currency: 'CNY',
      billing: '按调用次数',
      models: {
        'ernie-4.0': {
          name: 'ERNIE 4.0',
          input: 0.002,
          output: 0.004,
          contextLength: 8192,
          capabilities: ['chat', 'completion', 'knowledge-base']
        },
        'ernie-3.5': {
          name: 'ERNIE 3.5',
          input: 0.001,
          output: 0.002,
          contextLength: 4096,
          capabilities: ['chat', 'completion']
        }
      }
    },
    features: ['knowledge-rich', 'chinese-excellent', 'baidu-ecosystem'],
    regions: ['china'],
    reliability: 0.98,
    icon: '🦉'
  },

  // 智谱GLM
  zhipu: {
    name: '智谱GLM (Zhipu AI)',
    description: '清华大学孵化的AI公司，提供GLM系列模型',
    baseURL: 'https://open.bigmodel.cn/api/paas/v3',
    website: 'https://open.bigmodel.cn',
    pricing: {
      url: 'https://open.bigmodel.cn/pricing',
      currency: 'CNY',
      billing: '按token计费',
      models: {
        'glm-4': {
          name: 'GLM-4',
          input: 0.001,
          output: 0.001,
          contextLength: 8192,
          capabilities: ['chat', 'completion', 'function-calling']
        },
        'glm-3-turbo': {
          name: 'GLM-3 Turbo',
          input: 0.0005,
          output: 0.0005,
          contextLength: 4096,
          capabilities: ['chat', 'completion']
        }
      }
    },
    features: ['academic-background', 'function-calling', 'cost-effective'],
    regions: ['china'],
    reliability: 0.97,
    icon: '🎓'
  },

  // 月之暗面Kimi
  moonshot: {
    name: '月之暗面Kimi',
    description: '月之暗面出品的AI助手，新兴AI供应商',
    baseURL: 'https://api.moonshot.cn/v1',
    website: 'https://platform.moonshot.cn',
    pricing: {
      url: 'https://platform.moonshot.cn/pricing',
      currency: 'CNY',
      billing: '按token计费',
      models: {
        'moonshot-v1-8k': {
          name: 'Moonshot V1 8K',
          input: 0.001,
          output: 0.001,
          contextLength: 8192,
          capabilities: ['chat', 'completion']
        },
        'moonshot-v1-32k': {
          name: 'Moonshot V1 32K',
          input: 0.002,
          output: 0.002,
          contextLength: 32768,
          capabilities: ['chat', 'completion']
        }
      }
    },
    features: ['emerging-provider', 'long-context'],
    regions: ['china'],
    reliability: 0.96,
    icon: '🌙'
  },

  // 讯飞星火
  xfyun: {
    name: '讯飞星火 (Xunfei)',
    description: '科大讯飞的大语言模型，语音AI领先',
    baseURL: 'https://spark-api.xf-yun.com/v3.1/chat',
    website: 'https://xinghuo.xfyun.cn',
    pricing: {
      url: 'https://xinghuo.xfyun.cn/sparkapi',
      currency: 'CNY',
      billing: '按调用次数',
      models: {
        'spark-3.5': {
          name: 'Spark 3.5 Max',
          input: 0.002,
          output: 0.002,
          contextLength: 8192,
          capabilities: ['chat', 'completion', 'speech']
        },
        'spark-3.0': {
          name: 'Spark 3.0',
          input: 0.001,
          output: 0.001,
          contextLength: 4096,
          capabilities: ['chat', 'completion']
        }
      }
    },
    features: ['speech-ai', 'chinese-excellent', 'education-focused'],
    regions: ['china'],
    reliability: 0.97,
    icon: '✨'
  },

  // MiniMax
  minimax: {
    name: 'MiniMax',
    description: '字节跳动孵化的AI公司，提供娱乐化AI服务',
    baseURL: 'https://api.minimax.chat/v1',
    website: 'https://www.minimax.chat',
    pricing: {
      url: 'https://www.minimax.chat/pricing',
      currency: 'CNY',
      billing: '按token计费',
      models: {
        'speech-01': {
          name: 'Speech-01',
          input: 0.002,
          output: 0.002,
          contextLength: 4096,
          capabilities: ['chat', 'completion', 'speech-synthesis']
        },
        'text-01': {
          name: 'Text-01',
          input: 0.001,
          output: 0.001,
          contextLength: 4096,
          capabilities: ['chat', 'completion']
        }
      }
    },
    features: ['entertainment-ai', 'speech-synthesis', 'byte-dance'],
    regions: ['china'],
    reliability: 0.96,
    icon: '🎭'
  }
};

// 供应商分组
export const PROVIDER_GROUPS = {
  premium: ['openai', 'anthropic', 'google'],
  china: ['deepseek', 'alibaba', 'baidu', 'zhipu', 'moonshot', 'xfyun', 'minimax'],
  costEffective: ['deepseek', 'zhipu', 'moonshot'],
  specialized: {
    vision: ['openai', 'anthropic', 'google'],
    speech: ['xfyun', 'minimax'],
    code: ['openai', 'anthropic', 'deepseek'],
    chinese: ['alibaba', 'baidu', 'zhipu', 'moonshot', 'xfyun']
  }
};

// 供应商特性矩阵
export const PROVIDER_FEATURES = {
  'function-calling': ['openai', 'anthropic', 'google', 'alibaba'],
  'vision': ['openai', 'anthropic', 'google'],
  'streaming': ['openai', 'anthropic', 'google', 'deepseek'],
  'fine-tuning': ['openai', 'anthropic'],
  'long-context': ['anthropic', 'google'],
  'multilingual': ['openai', 'google', 'alibaba'],
  'chinese-excellent': ['alibaba', 'baidu', 'zhipu', 'xfyun'],
  'cost-effective': ['deepseek', 'zhipu', 'moonshot']
};

// 获取供应商信息
export function getProviderInfo(providerId) {
  return AI_PROVIDERS[providerId];
}

// 获取支持特定功能的供应商
export function getProvidersByFeature(feature) {
  const providerIds = PROVIDER_FEATURES[feature] || [];
  return providerIds.map(id => ({ id, ...AI_PROVIDERS[id] }));
}

// 获取特定区域的供应商
export function getProvidersByRegion(region) {
  return Object.entries(AI_PROVIDERS)
    .filter(([_, provider]) => provider.regions.includes(region))
    .map(([id, provider]) => ({ id, ...provider }));
}

// 获取价格最优的供应商
export function getCostEffectiveProviders(limit = 5) {
  return Object.entries(AI_PROVIDERS)
    .map(([id, provider]) => ({ id, ...provider }))
    .sort((a, b) => {
      const aAvgCost = Object.values(a.pricing.models).reduce((sum, model) =>
        sum + (model.input + model.output) / 2, 0) / Object.keys(a.pricing.models).length;
      const bAvgCost = Object.values(b.pricing.models).reduce((sum, model) =>
        sum + (model.input + model.output) / 2, 0) / Object.keys(b.pricing.models).length;
      return aAvgCost - bAvgCost;
    })
    .slice(0, limit);
}

// 获取最可靠的供应商
export function getMostReliableProviders(limit = 5) {
  return Object.entries(AI_PROVIDERS)
    .map(([id, provider]) => ({ id, ...provider }))
    .sort((a, b) => b.reliability - a.reliability)
    .slice(0, limit);
}

// 根据需求推荐供应商
export function recommendProviders(requirements = {}) {
  const {
    features = [],
    region,
    maxCost,
    minReliability = 0.95,
    preferredLanguage = 'chinese'
  } = requirements;

  let candidates = Object.entries(AI_PROVIDERS)
    .map(([id, provider]) => ({ id, ...provider }));

  // 按功能过滤
  if (features.length > 0) {
    candidates = candidates.filter(provider =>
      features.every(feature => PROVIDER_FEATURES[feature]?.includes(provider.id))
    );
  }

  // 按区域过滤
  if (region) {
    candidates = candidates.filter(provider =>
      provider.regions.includes(region) || provider.regions.includes('global')
    );
  }

  // 按成本过滤
  if (maxCost) {
    candidates = candidates.filter(provider => {
      const avgCost = Object.values(provider.pricing.models).reduce((sum, model) =>
        sum + (model.input + model.output) / 2, 0) / Object.keys(provider.pricing.models).length;
      return avgCost <= maxCost;
    });
  }

  // 按可靠性过滤
  candidates = candidates.filter(provider => provider.reliability >= minReliability);

  // 按语言偏好排序
  if (preferredLanguage === 'chinese') {
    candidates.sort((a, b) => {
      const aChinese = a.features.includes('chinese-excellent') ? 1 : 0;
      const bChinese = b.features.includes('chinese-excellent') ? 1 : 0;
      return bChinese - aChinese;
    });
  }

  return candidates.slice(0, 10); // 返回前10个推荐
}
