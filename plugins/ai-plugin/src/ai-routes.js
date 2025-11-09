/**
 * AI API路由
 * 为每个AI供应商提供独立的API端点
 */

import fastifySwagger from '@fastify/swagger';
import { AlibabaService } from '../../application/services/ai/AlibabaService.js';
import { ClaudeService } from '../../application/services/ai/ClaudeService.js';
import { CogneeMemoryService } from '../../application/services/ai/CogneeMemoryService.js';
import { DeepSeekService } from '../../application/services/ai/DeepSeekService.js';
import { GeminiService } from '../../application/services/ai/GeminiService.js';
import { LangChainService } from '../../application/services/ai/LangChainService.js';
import { OpenAIService } from '../../application/services/ai/OpenAIService.js';
import { ConversationManager } from '../../application/services/ConversationManager.js';
import { logger } from '../../utils/logger.js';

// 服务实例缓存
const services = new Map();

/**
 * 获取或创建服务实例
 */
function getService(provider, ServiceClass) {
  if (!services.has(provider)) {
    services.set(provider, new ServiceClass());
  }
  return services.get(provider);
}

/**
 * 创建AI API路由
 */
export function createAIRoutes() {
  const routes = [];

  // OpenAI API路由
  routes.push({
    method: 'GET',
    url: '/api/ai/openai/models',
    handler: async (request, reply) => {
      try {
        const service = getService('openai', OpenAIService);
        const models = await service.getModels();

        reply.send({
          success: true,
          data: models,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error('获取OpenAI模型列表失败', { error: error.message });
        reply.code(500).send({
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    },
    schema: {
      description: '获取OpenAI可用模型列表',
      tags: ['AI', 'OpenAI'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'array' },
            timestamp: { type: 'string' },
          },
        },
      },
    },
  });

  routes.push({
    method: 'POST',
    url: '/api/ai/openai/chat',
    handler: async (request, reply) => {
      try {
        const service = getService('openai', OpenAIService);
        const result = await service.chatCompletion(request.body);

        reply.send({
          success: true,
          data: result,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error('OpenAI聊天请求失败', { error: error.message });
        reply.code(500).send({
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    },
    schema: {
      description: 'OpenAI聊天完成API',
      tags: ['AI', 'OpenAI'],
      body: {
        type: 'object',
        properties: {
          model: { type: 'string', default: 'gpt-3.5-turbo' },
          messages: { type: 'array' },
          temperature: { type: 'number', minimum: 0, maximum: 2, default: 0.7 },
          maxTokens: { type: 'integer', default: 1000 },
        },
        required: ['messages'],
      },
    },
  });

  routes.push({
    method: 'POST',
    url: '/api/ai/openai/embeddings',
    handler: async (request, reply) => {
      try {
        const service = getService('openai', OpenAIService);
        const result = await service.createEmbeddings(request.body);

        reply.send({
          success: true,
          data: result,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error('OpenAI嵌入请求失败', { error: error.message });
        reply.code(500).send({
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    },
    schema: {
      description: 'OpenAI文本嵌入API',
      tags: ['AI', 'OpenAI'],
      body: {
        type: 'object',
        properties: {
          input: { type: 'string' },
          model: { type: 'string', default: 'text-embedding-ada-002' },
        },
        required: ['input'],
      },
    },
  });

  routes.push({
    method: 'POST',
    url: '/api/ai/openai/images',
    handler: async (request, reply) => {
      try {
        const service = getService('openai', OpenAIService);
        const result = await service.createImage(request.body);

        reply.send({
          success: true,
          data: result,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error('OpenAI图像生成失败', { error: error.message });
        reply.code(500).send({
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    },
    schema: {
      description: 'OpenAI图像生成API (DALL-E)',
      tags: ['AI', 'OpenAI'],
      body: {
        type: 'object',
        properties: {
          prompt: { type: 'string' },
          n: { type: 'integer', default: 1 },
          size: {
            type: 'string',
            enum: ['256x256', '512x512', '1024x1024'],
            default: '1024x1024',
          },
        },
        required: ['prompt'],
      },
    },
  });

  routes.push({
    method: 'POST',
    url: '/api/ai/openai/audio',
    handler: async (request, reply) => {
      try {
        const service = getService('openai', OpenAIService);
        const result = await service.createTranscription(request.body);

        reply.send({
          success: true,
          data: result,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error('OpenAI音频转录失败', { error: error.message });
        reply.code(500).send({
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    },
    schema: {
      description: 'OpenAI音频转录API (Whisper)',
      tags: ['AI', 'OpenAI'],
      body: {
        type: 'object',
        properties: {
          file: { type: 'string', description: '音频文件' },
          model: { type: 'string', default: 'whisper-1' },
          language: { type: 'string' },
          prompt: { type: 'string' },
        },
        required: ['file'],
      },
    },
  });

  routes.push({
    method: 'GET',
    url: '/api/ai/openai/stats',
    handler: async (request, reply) => {
      try {
        const service = getService('openai', OpenAIService);
        const stats = service.getStats();

        reply.send({
          success: true,
          data: stats,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error('获取OpenAI统计信息失败', { error: error.message });
        reply.code(500).send({
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    },
    schema: {
      description: '获取OpenAI服务统计信息',
      tags: ['AI', 'OpenAI', 'Stats'],
    },
  });

  // Claude API路由
  routes.push({
    method: 'GET',
    url: '/api/ai/claude/models',
    handler: async (request, reply) => {
      try {
        const service = getService('claude', ClaudeService);
        const models = await service.getModels();

        reply.send({
          success: true,
          data: models,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error('获取Claude模型列表失败', { error: error.message });
        reply.code(500).send({
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    },
    schema: {
      description: '获取Claude可用模型列表',
      tags: ['AI', 'Claude'],
    },
  });

  routes.push({
    method: 'POST',
    url: '/api/ai/claude/chat',
    handler: async (request, reply) => {
      try {
        const service = getService('claude', ClaudeService);
        const result = await service.chatCompletion(request.body);

        reply.send({
          success: true,
          data: result,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error('Claude聊天请求失败', { error: error.message });
        reply.code(500).send({
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    },
    schema: {
      description: 'Claude聊天完成API',
      tags: ['AI', 'Claude'],
      body: {
        type: 'object',
        properties: {
          model: { type: 'string', default: 'claude-3-haiku-20240307' },
          messages: { type: 'array' },
          system: { type: 'string' },
          temperature: { type: 'number', minimum: 0, maximum: 1, default: 0.7 },
          maxTokens: { type: 'integer', default: 4096 },
        },
        required: ['messages'],
      },
    },
  });

  routes.push({
    method: 'GET',
    url: '/api/ai/claude/stats',
    handler: async (request, reply) => {
      try {
        const service = getService('claude', ClaudeService);
        const stats = service.getStats();

        reply.send({
          success: true,
          data: stats,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error('获取Claude统计信息失败', { error: error.message });
        reply.code(500).send({
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    },
    schema: {
      description: '获取Claude服务统计信息',
      tags: ['AI', 'Claude', 'Stats'],
    },
  });

  // Gemini API路由
  routes.push({
    method: 'GET',
    url: '/api/ai/gemini/models',
    handler: async (request, reply) => {
      try {
        const service = getService('gemini', GeminiService);
        const models = await service.getModels();

        reply.send({
          success: true,
          data: models,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error('获取Gemini模型列表失败', { error: error.message });
        reply.code(500).send({
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    },
    schema: {
      description: '获取Gemini可用模型列表',
      tags: ['AI', 'Gemini'],
    },
  });

  routes.push({
    method: 'POST',
    url: '/api/ai/gemini/chat',
    handler: async (request, reply) => {
      try {
        const service = getService('gemini', GeminiService);
        const result = await service.chatCompletion(request.body);

        reply.send({
          success: true,
          data: result,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error('Gemini聊天请求失败', { error: error.message });
        reply.code(500).send({
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    },
    schema: {
      description: 'Gemini聊天完成API',
      tags: ['AI', 'Gemini'],
      body: {
        type: 'object',
        properties: {
          model: { type: 'string', default: 'gemini-1.5-flash' },
          messages: { type: 'array' },
          system: { type: 'string' },
          temperature: { type: 'number', minimum: 0, maximum: 1, default: 0.7 },
          maxTokens: { type: 'integer', default: 2048 },
        },
        required: ['messages'],
      },
    },
  });

  routes.push({
    method: 'GET',
    url: '/api/ai/gemini/stats',
    handler: async (request, reply) => {
      try {
        const service = getService('gemini', GeminiService);
        const stats = service.getStats();

        reply.send({
          success: true,
          data: stats,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error('获取Gemini统计信息失败', { error: error.message });
        reply.code(500).send({
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    },
    schema: {
      description: '获取Gemini服务统计信息',
      tags: ['AI', 'Gemini', 'Stats'],
    },
  });

  // DeepSeek API路由
  routes.push({
    method: 'GET',
    url: '/api/ai/deepseek/models',
    handler: async (request, reply) => {
      try {
        const service = getService('deepseek', DeepSeekService);
        const models = await service.getModels();

        reply.send({
          success: true,
          data: models,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error('获取DeepSeek模型列表失败', { error: error.message });
        reply.code(500).send({
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    },
    schema: {
      description: '获取DeepSeek可用模型列表',
      tags: ['AI', 'DeepSeek'],
    },
  });

  routes.push({
    method: 'POST',
    url: '/api/ai/deepseek/chat',
    handler: async (request, reply) => {
      try {
        const service = getService('deepseek', DeepSeekService);
        const result = await service.chatCompletion(request.body);

        reply.send({
          success: true,
          data: result,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error('DeepSeek聊天请求失败', { error: error.message });
        reply.code(500).send({
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    },
    schema: {
      description: 'DeepSeek聊天完成API',
      tags: ['AI', 'DeepSeek'],
      body: {
        type: 'object',
        properties: {
          model: { type: 'string', default: 'deepseek-chat' },
          messages: { type: 'array' },
          temperature: { type: 'number', minimum: 0, maximum: 2, default: 0.7 },
          maxTokens: { type: 'integer', default: 2048 },
        },
        required: ['messages'],
      },
    },
  });

  routes.push({
    method: 'GET',
    url: '/api/ai/deepseek/stats',
    handler: async (request, reply) => {
      try {
        const service = getService('deepseek', DeepSeekService);
        const stats = service.getStats();

        reply.send({
          success: true,
          data: stats,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error('获取DeepSeek统计信息失败', { error: error.message });
        reply.code(500).send({
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    },
    schema: {
      description: '获取DeepSeek服务统计信息',
      tags: ['AI', 'DeepSeek', 'Stats'],
    },
  });

  // Alibaba API路由
  routes.push({
    method: 'GET',
    url: '/api/ai/alibaba/models',
    handler: async (request, reply) => {
      try {
        const service = getService('alibaba', AlibabaService);
        const models = await service.getModels();

        reply.send({
          success: true,
          data: models,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error('获取Alibaba模型列表失败', { error: error.message });
        reply.code(500).send({
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    },
    schema: {
      description: '获取通义千问可用模型列表',
      tags: ['AI', 'Alibaba'],
    },
  });

  routes.push({
    method: 'POST',
    url: '/api/ai/alibaba/chat',
    handler: async (request, reply) => {
      try {
        const service = getService('alibaba', AlibabaService);
        const result = await service.chatCompletion(request.body);

        reply.send({
          success: true,
          data: result,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error('通义千问聊天请求失败', { error: error.message });
        reply.code(500).send({
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    },
    schema: {
      description: '通义千问聊天完成API',
      tags: ['AI', 'Alibaba'],
      body: {
        type: 'object',
        properties: {
          model: { type: 'string', default: 'qwen-turbo' },
          messages: { type: 'array' },
          temperature: { type: 'number', minimum: 0, maximum: 1, default: 0.7 },
          maxTokens: { type: 'integer', default: 1500 },
        },
        required: ['messages'],
      },
    },
  });

  routes.push({
    method: 'GET',
    url: '/api/ai/alibaba/stats',
    handler: async (request, reply) => {
      try {
        const service = getService('alibaba', AlibabaService);
        const stats = service.getStats();

        reply.send({
          success: true,
          data: stats,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error('获取通义千问统计信息失败', { error: error.message });
        reply.code(500).send({
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    },
    schema: {
      description: '获取通义千问服务统计信息',
      tags: ['AI', 'Alibaba', 'Stats'],
    },
  });

  // 通用AI API路由
  routes.push({
    method: 'GET',
    url: '/api/ai/providers',
    handler: async (request, reply) => {
      try {
        const providers = [
          {
            id: 'openai',
            name: 'OpenAI',
            status: 'active',
            models: await getService('openai', OpenAIService)
              .getModels()
              .then((m) => m.length),
            endpoints: [
              '/api/ai/openai/chat',
              '/api/ai/openai/embeddings',
              '/api/ai/openai/images',
              '/api/ai/openai/audio',
            ],
          },
          {
            id: 'claude',
            name: 'Claude',
            status: 'active',
            models: await getService('claude', ClaudeService)
              .getModels()
              .then((m) => m.length),
            endpoints: ['/api/ai/claude/chat'],
          },
          {
            id: 'gemini',
            name: 'Gemini',
            status: 'active',
            models: await getService('gemini', GeminiService)
              .getModels()
              .then((m) => m.length),
            endpoints: ['/api/ai/gemini/chat'],
          },
          {
            id: 'deepseek',
            name: 'DeepSeek',
            status: 'active',
            models: await getService('deepseek', DeepSeekService)
              .getModels()
              .then((m) => m.length),
            endpoints: ['/api/ai/deepseek/chat'],
          },
          {
            id: 'alibaba',
            name: '通义千问',
            status: 'active',
            models: await getService('alibaba', AlibabaService)
              .getModels()
              .then((m) => m.length),
            endpoints: ['/api/ai/alibaba/chat'],
          },
        ];

        reply.send({
          success: true,
          data: providers,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error('获取AI供应商列表失败', { error: error.message });
        reply.code(500).send({
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    },
    schema: {
      description: '获取所有AI供应商信息',
      tags: ['AI', 'Providers'],
    },
  });

  routes.push({
    method: 'GET',
    url: '/api/ai/stats',
    handler: async (request, reply) => {
      try {
        const stats = {
          openai: getService('openai', OpenAIService).getStats(),
          claude: getService('claude', ClaudeService).getStats(),
          gemini: getService('gemini', GeminiService).getStats(),
          deepseek: getService('deepseek', DeepSeekService).getStats(),
          alibaba: getService('alibaba', AlibabaService).getStats(),
        };

        const summary = {
          totalRequests: Object.values(stats).reduce(
            (sum, s) => sum + s.requests,
            0,
          ),
          totalErrors: Object.values(stats).reduce(
            (sum, s) => sum + s.errors,
            0,
          ),
          totalTokens: Object.values(stats).reduce(
            (sum, s) => sum + s.tokens,
            0,
          ),
          totalCost: Object.values(stats).reduce((sum, s) => sum + s.cost, 0),
          avgResponseTime:
            Object.values(stats).reduce(
              (sum, s) => sum + s.avgResponseTime,
              0,
            ) / Object.keys(stats).length,
        };

        reply.send({
          success: true,
          data: {
            providers: stats,
            summary,
            timestamp: new Date().toISOString(),
          },
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error('获取AI统计信息失败', { error: error.message });
        reply.code(500).send({
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    },
    schema: {
      description: '获取所有AI服务统计信息',
      tags: ['AI', 'Stats'],
    },
  });

  // ==========================================
  // LangChain 集成路由
  // ==========================================

  // 创建对话链
  routes.push({
    method: 'POST',
    url: '/api/ai/langchain/chains',
    handler: async (request, reply) => {
      try {
        const langChainService = getService('langchain', LangChainService);
        const result = await langChainService.createConversationChain(
          request.body,
        );

        reply.send({
          success: true,
          data: result,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error('创建对话链失败', { error: error.message });
        reply.code(500).send({
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    },
    schema: {
      description: '创建LangChain对话链',
      tags: ['AI', 'LangChain'],
      body: {
        type: 'object',
        properties: {
          model: { type: 'string', enum: ['openai', 'claude', 'gemini'] },
          memoryType: { type: 'string', enum: ['buffer', 'conversation'] },
          promptTemplate: { type: 'string' },
          chainId: { type: 'string' },
        },
      },
    },
  });

  // 执行对话
  routes.push({
    method: 'POST',
    url: '/api/ai/langchain/chains/:chainId/converse',
    handler: async (request, reply) => {
      try {
        const { chainId } = request.params;
        const { input, options } = request.body;

        const langChainService = getService('langchain', LangChainService);
        const result = await langChainService.runConversation(
          chainId,
          input,
          options,
        );

        reply.send({
          success: true,
          data: result,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error('对话执行失败', {
          chainId: request.params.chainId,
          error: error.message,
        });
        reply.code(500).send({
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    },
    schema: {
      description: '执行LangChain对话',
      tags: ['AI', 'LangChain'],
      params: {
        type: 'object',
        properties: {
          chainId: { type: 'string' },
        },
        required: ['chainId'],
      },
      body: {
        type: 'object',
        properties: {
          input: { type: 'string' },
          options: { type: 'object' },
        },
        required: ['input'],
      },
    },
  });

  // 获取对话历史
  routes.push({
    method: 'GET',
    url: '/api/ai/langchain/chains/:chainId/history',
    handler: async (request, reply) => {
      try {
        const { chainId } = request.params;
        const langChainService = getService('langchain', LangChainService);
        const result = await langChainService.getConversationHistory(chainId);

        reply.send({
          success: true,
          data: result,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error('获取对话历史失败', {
          chainId: request.params.chainId,
          error: error.message,
        });
        reply.code(500).send({
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    },
    schema: {
      description: '获取LangChain对话历史',
      tags: ['AI', 'LangChain'],
    },
  });

  // ==========================================
  // Cognee 记忆系统路由
  // ==========================================

  // 存储记忆
  routes.push({
    method: 'POST',
    url: '/api/ai/memory/store',
    handler: async (request, reply) => {
      try {
        const cogneeService = getService('cognee', CogneeMemoryService);
        const result = await cogneeService.storeMemory(request.body);

        reply.send({
          success: true,
          data: result,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error('存储记忆失败', { error: error.message });
        reply.code(500).send({
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    },
    schema: {
      description: '存储记忆到Cognee',
      tags: ['AI', 'Memory'],
      body: {
        type: 'object',
        properties: {
          content: { type: 'string' },
          type: {
            type: 'string',
            enum: ['conversation', 'fact', 'entity', 'event', 'insight'],
          },
          metadata: { type: 'object' },
          userId: { type: 'string' },
          sessionId: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
        },
        required: ['content'],
      },
    },
  });

  // 检索记忆
  routes.push({
    method: 'POST',
    url: '/api/ai/memory/search',
    handler: async (request, reply) => {
      try {
        const { query, options } = request.body;
        const cogneeService = getService('cognee', CogneeMemoryService);
        const result = await cogneeService.retrieveMemory(query, options);

        reply.send({
          success: true,
          data: result,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error('检索记忆失败', { error: error.message });
        reply.code(500).send({
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    },
    schema: {
      description: '从Cognee检索记忆',
      tags: ['AI', 'Memory'],
      body: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          options: {
            type: 'object',
            properties: {
              userId: { type: 'string' },
              sessionId: { type: 'string' },
              limit: { type: 'number' },
              type: { type: 'string' },
            },
          },
        },
        required: ['query'],
      },
    },
  });

  // ==========================================
  // 对话管理路由
  // ==========================================

  // 创建对话
  routes.push({
    method: 'POST',
    url: '/api/ai/conversations',
    handler: async (request, reply) => {
      try {
        const conversationManager = getService(
          'conversation',
          ConversationManager,
        );
        const result = await conversationManager.createConversation(
          request.body,
        );

        reply.send({
          success: true,
          data: result,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error('创建对话失败', { error: error.message });
        reply.code(500).send({
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    },
    schema: {
      description: '创建新对话',
      tags: ['AI', 'Conversation'],
      body: {
        type: 'object',
        properties: {
          conversationId: { type: 'string' },
          userId: { type: 'string' },
          sessionId: { type: 'string' },
          model: { type: 'string', enum: ['openai', 'claude', 'gemini'] },
          memory: { type: 'boolean' },
          persistMemory: { type: 'boolean' },
          systemPrompt: { type: 'string' },
        },
      },
    },
  });

  // 发送消息
  routes.push({
    method: 'POST',
    url: '/api/ai/conversations/:conversationId/messages',
    handler: async (request, reply) => {
      try {
        const { conversationId } = request.params;
        const { message, options } = request.body;

        const conversationManager = getService(
          'conversation',
          ConversationManager,
        );
        const result = await conversationManager.sendMessage(
          conversationId,
          message,
          options,
        );

        reply.send({
          success: true,
          data: result,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error('发送消息失败', {
          conversationId: request.params.conversationId,
          error: error.message,
        });
        reply.code(500).send({
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    },
    schema: {
      description: '向对话发送消息',
      tags: ['AI', 'Conversation'],
      params: {
        type: 'object',
        properties: {
          conversationId: { type: 'string' },
        },
        required: ['conversationId'],
      },
      body: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          options: { type: 'object' },
        },
        required: ['message'],
      },
    },
  });

  // 获取对话历史
  routes.push({
    method: 'GET',
    url: '/api/ai/conversations/:conversationId/history',
    handler: async (request, reply) => {
      try {
        const { conversationId } = request.params;
        const { limit, offset } = request.query;

        const conversationManager = getService(
          'conversation',
          ConversationManager,
        );
        const result = await conversationManager.getConversationHistory(
          conversationId,
          {
            limit: parseInt(limit) || undefined,
            offset: parseInt(offset) || 0,
          },
        );

        reply.send({
          success: true,
          data: result,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error('获取对话历史失败', {
          conversationId: request.params.conversationId,
          error: error.message,
        });
        reply.code(500).send({
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    },
    schema: {
      description: '获取对话历史',
      tags: ['AI', 'Conversation'],
      params: {
        type: 'object',
        properties: {
          conversationId: { type: 'string' },
        },
        required: ['conversationId'],
      },
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'number' },
          offset: { type: 'number' },
        },
      },
    },
  });

  // 结束对话
  routes.push({
    method: 'POST',
    url: '/api/ai/conversations/:conversationId/end',
    handler: async (request, reply) => {
      try {
        const { conversationId } = request.params;
        const conversationManager = getService(
          'conversation',
          ConversationManager,
        );
        const result =
          await conversationManager.endConversation(conversationId);

        reply.send({
          success: true,
          data: result,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error('结束对话失败', {
          conversationId: request.params.conversationId,
          error: error.message,
        });
        reply.code(500).send({
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    },
    schema: {
      description: '结束对话',
      tags: ['AI', 'Conversation'],
    },
  });

  return routes;
}

/**
 * 注册AI路由到Fastify实例
 */
export function registerAIRoutes(fastify, options = {}) {
  const routes = createAIRoutes();

  logger.info('注册AI API路由', { routeCount: routes.length });

  routes.forEach((route) => {
    fastify.route(route);
  });

  // 添加OpenAPI文档
  if (options.enableDocs) {
    fastify.register(fastifySwagger, {
      exposeRoute: true,
      routePrefix: '/api/docs',
      swagger: {
        info: {
          title: 'frys AI API',
          description: 'frys多AI供应商API接口文档',
          version: '1.0.0',
        },
        externalDocs: {
          url: 'https://github.com/zycxfyh/frys',
          description: '项目主页',
        },
        tags: [
          { name: 'AI', description: 'AI相关接口' },
          { name: 'OpenAI', description: 'OpenAI专用接口' },
          { name: 'Claude', description: 'Claude专用接口' },
          { name: 'Gemini', description: 'Gemini专用接口' },
          { name: 'DeepSeek', description: 'DeepSeek专用接口' },
          { name: 'Alibaba', description: 'Alibaba专用接口' },
          { name: 'LangChain', description: 'LangChain集成接口' },
          { name: 'Memory', description: '记忆系统接口' },
          { name: 'Conversation', description: '对话管理接口' },
          { name: 'Stats', description: '统计信息接口' },
        ],
      },
    });
  }

  logger.info('AI API路由注册完成');
}
