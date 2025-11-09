/**
 * AI控制器
 * 处理AI对话相关的HTTP请求
 */

import { BaseController } from '../../shared/kernel/BaseController.js';
import { logger } from '../../shared/utils/logger.js';

export class AIController extends BaseController {
  constructor(conversationManager) {
    super();
    this.conversationManager = conversationManager;
  }

  /**
   * 创建新对话
   */
  async createConversation(req, res) {
    try {
      const { model = 'openai', memory = true, context = {} } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return this.unauthorized(res, 'User authentication required');
      }

      const result = await this.conversationManager.createConversation({
        userId,
        sessionId: req.sessionId,
        model,
        memory,
        persistMemory: true,
        context,
      });

      logger.info('AI对话创建成功', {
        userId,
        conversationId: result.conversationId,
        model: result.model,
        ip: req.ip,
      });

      return this.created(res, {
        conversation: {
          id: result.conversationId,
          model: result.model,
          hasChain: result.hasChain,
          hasMemory: result.hasMemory,
          createdAt: result.createdAt,
        },
        message: 'Conversation created successfully',
      });
    } catch (error) {
      logger.error('创建AI对话失败', {
        error: error.message,
        userId: req.user?.id,
        ip: req.ip,
      });

      return this.internalError(res, error);
    }
  }

  /**
   * 发送消息到对话
   */
  async sendMessage(req, res) {
    try {
      const { conversationId } = req.params;
      const { message, stream = false } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return this.unauthorized(res, 'User authentication required');
      }

      if (!conversationId) {
        return this.badRequest(res, 'Conversation ID is required');
      }

      if (!message || typeof message !== 'string') {
        return this.badRequest(res, 'Message is required and must be a string');
      }

      const result = await this.conversationManager.sendMessage(
        conversationId,
        message,
        {
          userId,
          sessionId: req.sessionId,
          stream,
        },
      );

      logger.info('AI消息处理完成', {
        userId,
        conversationId,
        messageLength: message.length,
        responseTime: result.message.responseTime,
        ip: req.ip,
      });

      return this.ok(res, {
        conversationId,
        message: result.message,
        conversation: result.conversation,
        status: 'Message processed successfully',
      });
    } catch (error) {
      logger.error('AI消息处理失败', {
        error: error.message,
        conversationId: req.params.conversationId,
        userId: req.user?.id,
        ip: req.ip,
      });

      if (error.message?.includes('不存在')) {
        return this.notFound(res, 'Conversation not found');
      }

      return this.internalError(res, error);
    }
  }

  /**
   * 获取对话历史
   */
  async getConversationHistory(req, res) {
    try {
      const { conversationId } = req.params;
      const { limit, offset = 0 } = req.query;
      const userId = req.user?.id;

      if (!userId) {
        return this.unauthorized(res, 'User authentication required');
      }

      if (!conversationId) {
        return this.badRequest(res, 'Conversation ID is required');
      }

      const result = await this.conversationManager.getConversationHistory(
        conversationId,
        {
          limit: limit ? parseInt(limit) : undefined,
          offset: parseInt(offset),
        },
      );

      return this.ok(res, {
        conversation: {
          id: result.conversationId,
          messages: result.messages,
          totalMessages: result.totalMessages,
          hasMore: result.hasMore,
          lastActivity: result.lastActivity,
        },
      });
    } catch (error) {
      logger.error('获取对话历史失败', {
        error: error.message,
        conversationId: req.params.conversationId,
        userId: req.user?.id,
        ip: req.ip,
      });

      if (error.message?.includes('不存在')) {
        return this.notFound(res, 'Conversation not found');
      }

      return this.internalError(res, error);
    }
  }

  /**
   * 获取对话统计
   */
  async getConversationStats(req, res) {
    try {
      const { conversationId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return this.unauthorized(res, 'User authentication required');
      }

      if (!conversationId) {
        return this.badRequest(res, 'Conversation ID is required');
      }

      const result =
        await this.conversationManager.getConversationStats(conversationId);

      return this.ok(res, {
        stats: result,
      });
    } catch (error) {
      logger.error('获取对话统计失败', {
        error: error.message,
        conversationId: req.params.conversationId,
        userId: req.user?.id,
        ip: req.ip,
      });

      if (error.message?.includes('不存在')) {
        return this.notFound(res, 'Conversation not found');
      }

      return this.internalError(res, error);
    }
  }

  /**
   * 列出用户的活跃对话
   */
  async listConversations(req, res) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return this.unauthorized(res, 'User authentication required');
      }

      const conversations =
        this.conversationManager.listActiveConversations(userId);

      return this.ok(res, {
        conversations,
        total: conversations.length,
      });
    } catch (error) {
      logger.error('列出对话失败', {
        error: error.message,
        userId: req.user?.id,
        ip: req.ip,
      });

      return this.internalError(res, error);
    }
  }

  /**
   * 结束对话
   */
  async endConversation(req, res) {
    try {
      const { conversationId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return this.unauthorized(res, 'User authentication required');
      }

      if (!conversationId) {
        return this.badRequest(res, 'Conversation ID is required');
      }

      const result =
        await this.conversationManager.endConversation(conversationId);

      logger.info('对话结束成功', {
        userId,
        conversationId,
        messageCount: result.messageCount,
        ip: req.ip,
      });

      return this.ok(res, {
        conversation: {
          id: result.conversationId,
          messageCount: result.messageCount,
          endedAt: result.endedAt,
        },
        message: 'Conversation ended successfully',
      });
    } catch (error) {
      logger.error('结束对话失败', {
        error: error.message,
        conversationId: req.params.conversationId,
        userId: req.user?.id,
        ip: req.ip,
      });

      if (error.message?.includes('不存在')) {
        return this.notFound(res, 'Conversation not found');
      }

      return this.internalError(res, error);
    }
  }

  /**
   * 获取AI服务健康状态
   */
  async getHealth(req, res) {
    try {
      const stats = this.conversationManager.getStats();

      return this.ok(res, {
        status: 'healthy',
        service: 'ai',
        stats,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('AI健康检查失败', {
        error: error.message,
        ip: req.ip,
      });

      return this.ok(res, {
        status: 'unhealthy',
        service: 'ai',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
