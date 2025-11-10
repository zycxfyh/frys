/**
 * 对话管理系统
 * 提供多轮对话管理、上下文保持和记忆集成
 */

// import { errorHandler } from '../../core/error-handler.js';
// import { eventSystem } from '../../core/EventBus.js';
import { config } from '../../shared/utils/config.js';
// AI服务将在运行时通过插件系统注入
import { logger } from '../../shared/utils/logger.js';

export class ConversationManager {
  constructor(options = {}) {
    this.name = 'Conversation Manager';
    this.providerId = 'conversation';

    // 对话存储
    this.conversations = new Map();
    this.activeConversations = new Map();

    // 集成服务
    this.langChainService = null;
    this.cogneeService = null;

    // 统计信息
    this.stats = {
      conversationsCreated: 0,
      messagesProcessed: 0,
      averageResponseTime: 0,
      totalTokens: 0,
      errors: 0,
    };

    this.initializeServices(options);

    logger.info('对话管理系统初始化完成');
  }

  /**
   * 初始化集成服务
   */
  async initializeServices(options) {
    try {
      // 调试：打印AI配置
      logger.info('AI配置检查', {
        openai: !!config.ai.providers.openai?.apiKey,
        claude: !!config.ai.providers.claude?.apiKey,
        gemini: !!config.ai.providers.gemini?.apiKey,
        deepseek: !!config.ai.providers.deepseek?.apiKey,
        openaiKey: `${config.ai.providers.openai?.apiKey?.substring(0, 10)}...`,
        deepseekKey: `${config.ai.providers.deepseek?.apiKey?.substring(0, 10)}...`,
      });

      // 初始化LangChain服务 - 在测试模式下总是初始化
      const isTestMode =
        config.ai.providers.openai?.apiKey === 'test-openai-key' ||
        config.ai.providers.openai?.apiKey?.startsWith('test-');

      if (
        config.ai.providers.openai?.apiKey ||
        config.ai.providers.claude?.apiKey ||
        config.ai.providers.gemini?.apiKey ||
        config.ai.providers.deepseek?.apiKey ||
        isTestMode
      ) {
        try {
          const { LangChainService } = await import('./ai/LangChainService.js');
          this.langChainService = new LangChainService(options.langChain);
          logger.info('LangChain服务集成成功');
        } catch (error) {
          logger.error('LangChain服务初始化失败', error);
          this.langChainService = null;
        }
      }

      // 初始化Cognee记忆服务
      if (config.ai.providers.cognee?.apiKey) {
        // this.cogneeService = new CogneeMemoryService(options.cognee); // TODO: 实现Cognee集成
        logger.info('Cognee记忆服务集成成功');
      }
    } catch (error) {
      logger.error('对话管理服务初始化失败', { error: error.message });
      // 不抛出错误，允许部分服务不可用
    }
  }

  /**
   * 创建新对话
   */
  async createConversation(conversationConfig = {}) {
    try {
      const {
        conversationId,
        userId,
        sessionId,
        model = 'openai',
        memory = true,
        persistMemory = true,
        context = {},
        systemPrompt,
        maxHistory = 50,
      } = conversationConfig;

      const id =
        conversationId ||
        `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // 创建LangChain对话链（如果可用）
      let chainId = null;
      if (this.langChainService) {
        const chainResult = await this.langChainService.createConversationChain(
          {
            model,
            memoryType: memory ? 'buffer' : null,
            promptTemplate: systemPrompt,
            chainId: `${id}_chain`,
          },
        );
        chainId = chainResult.chainId;
      }

      const conversation = {
        id,
        userId,
        sessionId,
        model,
        memory,
        persistMemory,
        context,
        maxHistory,
        messages: [],
        chainId,
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        status: 'active',
      };

      this.conversations.set(id, conversation);
      this.activeConversations.set(id, conversation);
      this.stats.conversationsCreated++;

      // 记录对话创建事件
      logger.info('对话创建', {
        conversationId: id,
        userId,
        sessionId,
        model,
        hasChain: !!chainId,
        timestamp: new Date().toISOString(),
      });

      logger.info('对话创建成功', {
        conversationId: id,
        userId,
        sessionId,
        model,
        hasChain: !!chainId,
      });

      return {
        success: true,
        conversationId: id,
        model,
        hasChain: !!chainId,
        hasMemory: !!this.cogneeService && persistMemory,
        createdAt: conversation.createdAt,
      };
    } catch (error) {
      this.stats.errors++;
      logger.error('创建对话失败', {
        error: error.message,
        conversationConfig,
      });

      logger.info('conversation:error', {
        operation: 'create',
        error: error.message,
        timestamp: new Date().toISOString(),
      });

      throw new Error(
        'CONVERSATION_CREATION_FAILED',
        error.message,
      );
    }
  }

  /**
   * 发送消息到对话
   */
  async sendMessage(conversationId, message, options = {}) {
    try {
      const conversation = this.conversations.get(conversationId);
      if (!conversation) {
        throw new Error(`对话 ${conversationId} 不存在`);
      }

      if (conversation.status !== 'active') {
        throw new Error(`对话 ${conversationId} 状态为 ${conversation.status}`);
      }

      const startTime = Date.now();
      this.stats.messagesProcessed++;

      const {
        userId = conversation.userId,
        sessionId = conversation.sessionId,
        stream = false,
        timeout = 30000,
      } = options;

      // 创建消息对象
      const userMessage = {
        role: 'user',
        content: message,
        timestamp: new Date().toISOString(),
        messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      };

      // 添加到对话历史
      conversation.messages.push(userMessage);

      // 限制历史长度
      if (conversation.messages.length > conversation.maxHistory) {
        conversation.messages = conversation.messages.slice(
          -conversation.maxHistory,
        );
      }

      let response = null;
      let responseTime = 0;

      // 使用LangChain生成回复（如果可用）
      if (this.langChainService && conversation.chainId) {
        const chainResult = await this.langChainService.runConversation(
          conversation.chainId,
          message,
          { timeout },
        );

        response = chainResult.response;
        responseTime = chainResult.responseTime;
      } else {
        // 使用默认回复逻辑
        response = await this.generateDefaultResponse(message, conversation);
        responseTime = Date.now() - startTime;
      }

      // 创建助手消息对象
      const assistantMessage = {
        role: 'assistant',
        content: response,
        timestamp: new Date().toISOString(),
        messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        responseTime,
        model: conversation.model,
      };

      // 添加到对话历史
      conversation.messages.push(assistantMessage);

      // 更新对话最后活动时间
      conversation.lastActivity = new Date().toISOString();

      // 持久化记忆（如果启用）
      if (conversation.persistMemory && this.cogneeService) {
        try {
          await this.persistConversationMemory(conversation, [
            userMessage,
            assistantMessage,
          ]);
        } catch (memoryError) {
          logger.warn('对话记忆持久化失败', {
            conversationId,
            error: memoryError.message,
          });
          // 不影响主要功能
        }
      }

      // 发送事件
      logger.info('conversation:message:processed', {
        conversationId,
        userId,
        sessionId,
        inputLength: message.length,
        outputLength: response.length,
        responseTime,
        model: conversation.model,
        messageCount: conversation.messages.length,
        timestamp: new Date().toISOString(),
      });

      logger.info('消息处理完成', {
        conversationId,
        userId,
        sessionId,
        responseTime,
        messageCount: conversation.messages.length,
      });

      return {
        success: true,
        conversationId,
        message: assistantMessage,
        conversation: {
          totalMessages: conversation.messages.length,
          lastActivity: conversation.lastActivity,
        },
      };
    } catch (error) {
      this.stats.errors++;
      logger.error('消息处理失败', { conversationId, error: error.message });

      logger.info('conversation:error', {
        operation: 'send_message',
        conversationId,
        error: error.message,
        timestamp: new Date().toISOString(),
      });

      throw new Error(
        'CONVERSATION_MESSAGE_FAILED',
        error.message,
      );
    }
  }

  /**
   * 生成默认回复（当LangChain不可用时）
   */
  async generateDefaultResponse(message, conversation) {
    // 简单的基于规则的回复逻辑
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('你好') || lowerMessage.includes('hello')) {
      return '你好！我是Frys智能助手，很高兴为您服务。请问有什么可以帮助您的吗？';
    }

    if (lowerMessage.includes('帮助') || lowerMessage.includes('help')) {
      return '我可以帮助您进行工作流设计、AI模型调用、数据处理等多种任务。请告诉我您具体需要什么帮助。';
    }

    if (lowerMessage.includes('再见') || lowerMessage.includes('bye')) {
      return '再见！如果您还需要帮助，随时可以回来找我。';
    }

    // 基于上下文的简单回复
    if (conversation.messages.length > 2) {
      const lastUserMessage = conversation.messages
        .filter((m) => m.role === 'user')
        .slice(-2)[0]; // 获取倒数第二个用户消息

      if (lastUserMessage) {
        return `我理解您刚才提到"${lastUserMessage.content.slice(0, 20)}..."，请问您希望我如何帮助您？`;
      }
    }

    return '我收到了您的消息。作为Frys智能助手，我可以帮助您进行各种工作流和AI相关的任务。请问您具体需要什么帮助？';
  }

  /**
   * 持久化对话记忆
   */
  async persistConversationMemory(conversation, messages) {
    try {
      if (!this.cogneeService) {
        return;
      }

      await this.cogneeService.storeConversationMemory({
        conversationId: conversation.id,
        messages,
        userId: conversation.userId,
        sessionId: conversation.sessionId,
        context: conversation.context,
      });
    } catch (error) {
      logger.warn('对话记忆持久化失败', {
        conversationId: conversation.id,
        error: error.message,
      });
      // 不抛出错误，避免影响主要功能
    }
  }

  /**
   * 获取对话历史
   */
  async getConversationHistory(conversationId, options = {}) {
    try {
      const conversation = this.conversations.get(conversationId);
      if (!conversation) {
        throw new Error(`对话 ${conversationId} 不存在`);
      }

      const { limit, offset = 0 } = options;
      let messages = conversation.messages;

      // 分页
      if (limit) {
        messages = messages.slice(offset, offset + limit);
      }

      return {
        success: true,
        conversationId,
        messages,
        totalMessages: conversation.messages.length,
        hasMore: limit ? offset + limit < conversation.messages.length : false,
        lastActivity: conversation.lastActivity,
      };
    } catch (error) {
      logger.error('获取对话历史失败', {
        conversationId,
        error: error.message,
      });
      throw new Error(
        'CONVERSATION_HISTORY_FAILED',
        error.message,
      );
    }
  }

  /**
   * 检索相关记忆
   */
  async retrieveRelevantMemory(conversationId, query, options = {}) {
    try {
      const conversation = this.conversations.get(conversationId);
      if (!conversation) {
        throw new Error(`对话 ${conversationId} 不存在`);
      }

      if (!this.cogneeService) {
        return {
          success: true,
          conversationId,
          relevantMemories: [],
          message: 'Cognee记忆服务不可用',
        };
      }

      const memoryResult = await this.cogneeService.retrieveConversationMemory(
        query,
        conversationId,
        {
          userId: conversation.userId,
          sessionId: conversation.sessionId,
          ...options,
        },
      );

      return {
        success: true,
        conversationId,
        relevantMemories: memoryResult.relevantMessages || [],
        totalMemories: memoryResult.results?.length || 0,
      };
    } catch (error) {
      logger.error('检索相关记忆失败', {
        conversationId,
        query,
        error: error.message,
      });
      throw new Error(
        'CONVERSATION_MEMORY_RETRIEVAL_FAILED',
        error.message,
      );
    }
  }

  /**
   * 更新对话上下文
   */
  async updateConversationContext(conversationId, context) {
    try {
      const conversation = this.conversations.get(conversationId);
      if (!conversation) {
        throw new Error(`对话 ${conversationId} 不存在`);
      }

      conversation.context = {
        ...conversation.context,
        ...context,
      };

      logger.info('对话上下文更新成功', {
        conversationId,
        contextKeys: Object.keys(context),
      });

      return {
        success: true,
        conversationId,
        context: conversation.context,
        updatedAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('更新对话上下文失败', {
        conversationId,
        error: error.message,
      });
      throw new Error(
        'CONVERSATION_CONTEXT_UPDATE_FAILED',
        error.message,
      );
    }
  }

  /**
   * 结束对话
   */
  async endConversation(conversationId) {
    try {
      const conversation = this.conversations.get(conversationId);
      if (!conversation) {
        throw new Error(`对话 ${conversationId} 不存在`);
      }

      conversation.status = 'ended';
      conversation.endedAt = new Date().toISOString();

      // 清理活跃对话
      this.activeConversations.delete(conversationId);

      // 清理LangChain链（如果存在）
      if (conversation.chainId && this.langChainService) {
        try {
          await this.langChainService.deleteChain(conversation.chainId);
        } catch (chainError) {
          logger.warn('清理对话链失败', {
            conversationId,
            chainId: conversation.chainId,
            error: chainError.message,
          });
        }
      }

      // 发送事件
      logger.info('conversation:ended', {
        conversationId,
        userId: conversation.userId,
        sessionId: conversation.sessionId,
        duration: conversation.messages.length,
        endedAt: conversation.endedAt,
      });

      logger.info('对话结束成功', {
        conversationId,
        messageCount: conversation.messages.length,
        duration: Date.now() - new Date(conversation.createdAt).getTime(),
      });

      return {
        success: true,
        conversationId,
        messageCount: conversation.messages.length,
        endedAt: conversation.endedAt,
      };
    } catch (error) {
      logger.error('结束对话失败', { conversationId, error: error.message });
      throw new Error('CONVERSATION_END_FAILED', error.message);
    }
  }

  /**
   * 获取对话统计信息
   */
  async getConversationStats(conversationId) {
    try {
      const conversation = this.conversations.get(conversationId);
      if (!conversation) {
        throw new Error(`对话 ${conversationId} 不存在`);
      }

      const userMessages = conversation.messages.filter(
        (m) => m.role === 'user',
      );
      const assistantMessages = conversation.messages.filter(
        (m) => m.role === 'assistant',
      );

      return {
        success: true,
        conversationId,
        totalMessages: conversation.messages.length,
        userMessages: userMessages.length,
        assistantMessages: assistantMessages.length,
        averageUserMessageLength:
          userMessages.length > 0
            ? userMessages.reduce((sum, m) => sum + m.content.length, 0) /
              userMessages.length
            : 0,
        averageAssistantMessageLength:
          assistantMessages.length > 0
            ? assistantMessages.reduce((sum, m) => sum + m.content.length, 0) /
              assistantMessages.length
            : 0,
        averageResponseTime:
          assistantMessages.length > 0
            ? assistantMessages.reduce(
                (sum, m) => sum + (m.responseTime || 0),
                0,
              ) / assistantMessages.length
            : 0,
        createdAt: conversation.createdAt,
        lastActivity: conversation.lastActivity,
        status: conversation.status,
      };
    } catch (error) {
      logger.error('获取对话统计失败', {
        conversationId,
        error: error.message,
      });
      throw new Error(
        'CONVERSATION_STATS_FAILED',
        error.message,
      );
    }
  }

  /**
   * 列出活跃对话
   */
  listActiveConversations(userId = null) {
    const conversations = Array.from(this.activeConversations.values());

    const filtered = userId
      ? conversations.filter((conv) => conv.userId === userId)
      : conversations;

    return filtered.map((conv) => ({
      conversationId: conv.id,
      userId: conv.userId,
      sessionId: conv.sessionId,
      model: conv.model,
      messageCount: conv.messages.length,
      lastActivity: conv.lastActivity,
      createdAt: conv.createdAt,
    }));
  }

  /**
   * 获取服务统计信息
   */
  getStats() {
    return {
      provider: 'conversation',
      name: this.name,
      conversationsCreated: this.stats.conversationsCreated,
      messagesProcessed: this.stats.messagesProcessed,
      activeConversations: this.activeConversations.size,
      totalConversations: this.conversations.size,
      averageResponseTime: this.stats.averageResponseTime,
      totalTokens: this.stats.totalTokens,
      errors: this.stats.errors,
      errorRate:
        this.stats.messagesProcessed > 0
          ? this.stats.errors / this.stats.messagesProcessed
          : 0,
      services: {
        langChain: !!this.langChainService,
        cognee: !!this.cogneeService,
      },
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 重置统计信息
   */
  resetStats() {
    this.stats = {
      conversationsCreated: 0,
      messagesProcessed: 0,
      averageResponseTime: 0,
      totalTokens: 0,
      errors: 0,
    };
    logger.info('对话管理系统统计信息已重置');
  }
}
