/**
 * AI路由
 */

import express from 'express';
import { AIController } from '../controllers/AIController.js';

export function createAIRoutes(conversationManager) {
  const router = express.Router();
  const aiController = new AIController(conversationManager);

  // 健康检查（公开）
  router.get('/health', aiController.getHealth.bind(aiController));

  // 对话管理（需要认证）
  router.post(
    '/conversations',
    aiController.createConversation.bind(aiController),
  );
  router.get(
    '/conversations',
    aiController.listConversations.bind(aiController),
  );
  router.post(
    '/conversations/:conversationId/messages',
    aiController.sendMessage.bind(aiController),
  );
  router.get(
    '/conversations/:conversationId/history',
    aiController.getConversationHistory.bind(aiController),
  );
  router.get(
    '/conversations/:conversationId/stats',
    aiController.getConversationStats.bind(aiController),
  );
  router.post(
    '/conversations/:conversationId/end',
    aiController.endConversation.bind(aiController),
  );

  return router;
}
