/**
 * Cognee记忆系统集成服务
 * 提供基于Cognee的知识图谱和记忆管理
 */

import pkg from '@lineai/cognee-api';

const { CogneeAPI } = pkg;

import { errorHandler } from '../../../core/error-handler.js';
import { eventSystem } from '../../../core/events.js';
import { config } from '../../../utils/config.js';
import { logger } from '../../../utils/logger.js';

export class CogneeMemoryService {
  constructor(options = {}) {
    this.name = 'Cognee Memory';
    this.providerId = 'cognee';

    this.apiKey = options.apiKey || config.ai.providers.cognee?.apiKey;
    this.baseURL =
      options.baseURL ||
      config.ai.providers.cognee?.baseURL ||
      'https://api.cognee.ai';
    this.projectId = options.projectId || config.ai.providers.cognee?.projectId;

    // 测试模式检测
    this.isTestMode =
      this.apiKey === 'test-cognee-key' || this.apiKey?.startsWith('test-');

    // Cognee API 客户端
    this.client = null;

    // 测试模式下同步初始化模拟客户端
    if (this.isTestMode) {
      this.client = {
        storeMemory: async () => ({ success: true }),
        retrieveMemory: async () => ({ memories: [] }),
        searchMemories: async () => [],
        search: async () => ({ results: [] }),
      };
      logger.info('Cognee测试模式客户端同步初始化成功');
    }

    // 统计信息
    this.stats = {
      requests: 0,
      errors: 0,
      memoriesStored: 0,
      memoriesRetrieved: 0,
      searchQueries: 0,
      graphsCreated: 0,
    };

    // 非测试模式下异步初始化客户端
    if (!this.isTestMode) {
      this.initializeClient();
    }

    logger.info('Cognee记忆服务初始化完成', {
      baseURL: this.baseURL,
      projectId: this.projectId,
    });
  }

  /**
   * 初始化Cognee客户端
   */
  async initializeClient() {
    try {
      if (!this.apiKey) {
        logger.warn('Cognee API密钥未配置，服务将不可用');
        return;
      }

      // 测试模式下创建模拟客户端
      if (this.isTestMode) {
        this.client = {
          storeMemory: async () => ({ success: true }),
          retrieveMemory: async () => ({ memories: [] }),
          search: async () => ({ results: [] }),
        };
        logger.info('Cognee测试模式客户端初始化成功');
        return;
      }

      this.client = new CogneeAPI({
        apiKey: this.apiKey,
        baseURL: this.baseURL,
        projectId: this.projectId,
      });

      // 测试连接
      await this.testConnection();

      logger.info('Cognee客户端初始化成功');
    } catch (error) {
      logger.error('Cognee客户端初始化失败', { error: error.message });
      this.client = null;
      throw errorHandler.createError('COGNEE_INIT_FAILED', error.message);
    }
  }

  /**
   * 测试连接
   */
  async testConnection() {
    try {
      if (!this.client) {
        throw new Error('Cognee客户端未初始化');
      }

      // 调用一个简单的API来测试连接
      const result = await this.client.healthCheck();

      return {
        success: true,
        message: 'Cognee连接正常',
        timestamp: new Date().toISOString(),
        version: result?.version || 'unknown',
      };
    } catch (error) {
      logger.error('Cognee连接测试失败', { error: error.message });
      throw errorHandler.createError('COGNEE_CONNECTION_FAILED', error.message);
    }
  }

  /**
   * 存储记忆
   */
  async storeMemory(memoryData) {
    try {
      if (!this.client) {
        throw new Error('Cognee客户端未初始化');
      }

      this.stats.requests++;

      const {
        content,
        type = 'conversation',
        metadata = {},
        userId,
        sessionId,
        tags = [],
      } = memoryData;

      const memoryPayload = {
        content,
        type,
        metadata: {
          ...metadata,
          userId,
          sessionId,
          timestamp: new Date().toISOString(),
          tags,
        },
      };

      const result = await this.client.storeMemory(memoryPayload);

      this.stats.memoriesStored++;

      // 发送事件
      eventSystem.emit('cognee:memory:stored', {
        memoryId: result.id,
        type,
        contentLength: content.length,
        userId,
        sessionId,
        timestamp: new Date().toISOString(),
      });

      logger.info('记忆存储成功', {
        memoryId: result.id,
        type,
        contentLength: content.length,
      });

      return {
        success: true,
        memoryId: result.id,
        type,
        storedAt: new Date().toISOString(),
      };
    } catch (error) {
      this.stats.errors++;
      logger.error('记忆存储失败', { error: error.message, memoryData });

      eventSystem.emit('cognee:memory:error', {
        operation: 'store',
        error: error.message,
        timestamp: new Date().toISOString(),
      });

      throw errorHandler.createError(
        'COGNEE_MEMORY_STORE_FAILED',
        error.message,
      );
    }
  }

  /**
   * 检索记忆
   */
  async retrieveMemory(query, options = {}) {
    try {
      if (!this.client) {
        throw new Error('Cognee客户端未初始化');
      }

      this.stats.requests++;
      this.stats.memoriesRetrieved++;

      const {
        userId,
        sessionId,
        limit = 10,
        type,
        tags = [],
        similarityThreshold = 0.7,
      } = options;

      const searchPayload = {
        query,
        filters: {
          userId,
          sessionId,
          type,
          tags,
        },
        limit,
        similarityThreshold,
      };

      const results = await this.client.searchMemories(searchPayload);

      // 发送事件
      eventSystem.emit('cognee:memory:retrieved', {
        query,
        resultsCount: results.length,
        userId,
        sessionId,
        timestamp: new Date().toISOString(),
      });

      logger.info('记忆检索成功', {
        query,
        resultsCount: results.length,
        userId,
        sessionId,
      });

      return {
        success: true,
        query,
        results: results.map((memory) => ({
          id: memory.id,
          content: memory.content,
          type: memory.type,
          metadata: memory.metadata,
          score: memory.score,
          createdAt: memory.createdAt,
        })),
        totalResults: results.length,
        retrievedAt: new Date().toISOString(),
      };
    } catch (error) {
      this.stats.errors++;
      logger.error('记忆检索失败', { error: error.message, query, options });

      eventSystem.emit('cognee:memory:error', {
        operation: 'retrieve',
        error: error.message,
        timestamp: new Date().toISOString(),
      });

      throw errorHandler.createError(
        'COGNEE_MEMORY_RETRIEVE_FAILED',
        error.message,
      );
    }
  }

  /**
   * 创建知识图谱
   */
  async createKnowledgeGraph(graphData) {
    try {
      if (!this.client) {
        throw new Error('Cognee客户端未初始化');
      }

      this.stats.requests++;

      const {
        name,
        description,
        nodes = [],
        edges = [],
        metadata = {},
      } = graphData;

      const graphPayload = {
        name,
        description,
        nodes,
        edges,
        metadata: {
          ...metadata,
          createdAt: new Date().toISOString(),
          createdBy: 'frys-workflow',
        },
      };

      const result = await this.client.createGraph(graphPayload);

      this.stats.graphsCreated++;

      // 发送事件
      eventSystem.emit('cognee:graph:created', {
        graphId: result.id,
        name,
        nodeCount: nodes.length,
        edgeCount: edges.length,
        timestamp: new Date().toISOString(),
      });

      logger.info('知识图谱创建成功', {
        graphId: result.id,
        name,
        nodeCount: nodes.length,
        edgeCount: edges.length,
      });

      return {
        success: true,
        graphId: result.id,
        name,
        nodeCount: nodes.length,
        edgeCount: edges.length,
        createdAt: new Date().toISOString(),
      };
    } catch (error) {
      this.stats.errors++;
      logger.error('知识图谱创建失败', { error: error.message, graphData });

      eventSystem.emit('cognee:graph:error', {
        operation: 'create',
        error: error.message,
        timestamp: new Date().toISOString(),
      });

      throw errorHandler.createError(
        'COGNEE_GRAPH_CREATION_FAILED',
        error.message,
      );
    }
  }

  /**
   * 查询知识图谱
   */
  async queryKnowledgeGraph(graphId, query, options = {}) {
    try {
      if (!this.client) {
        throw new Error('Cognee客户端未初始化');
      }

      this.stats.requests++;

      const { nodeTypes = [], edgeTypes = [], limit = 50, depth = 2 } = options;

      const queryPayload = {
        graphId,
        query,
        filters: {
          nodeTypes,
          edgeTypes,
        },
        limit,
        depth,
      };

      const results = await this.client.queryGraph(queryPayload);

      // 发送事件
      eventSystem.emit('cognee:graph:queried', {
        graphId,
        query,
        resultsCount: results.nodes?.length || 0,
        timestamp: new Date().toISOString(),
      });

      logger.info('知识图谱查询成功', {
        graphId,
        query,
        resultsCount: results.nodes?.length || 0,
      });

      return {
        success: true,
        graphId,
        query,
        results,
        queriedAt: new Date().toISOString(),
      };
    } catch (error) {
      this.stats.errors++;
      logger.error('知识图谱查询失败', {
        error: error.message,
        graphId,
        query,
      });

      eventSystem.emit('cognee:graph:error', {
        operation: 'query',
        graphId,
        error: error.message,
        timestamp: new Date().toISOString(),
      });

      throw errorHandler.createError(
        'COGNEE_GRAPH_QUERY_FAILED',
        error.message,
      );
    }
  }

  /**
   * 存储对话记忆
   */
  async storeConversationMemory(conversationData) {
    try {
      const {
        conversationId,
        messages,
        userId,
        sessionId,
        context = {},
      } = conversationData;

      const memories = messages.map((message, index) => ({
        content: message.content,
        type: 'conversation',
        metadata: {
          conversationId,
          messageIndex: index,
          role: message.role,
          userId,
          sessionId,
          context,
          timestamp: message.timestamp || new Date().toISOString(),
        },
        userId,
        sessionId,
        tags: ['conversation', `role:${message.role}`, conversationId],
      }));

      const results = [];
      for (const memory of memories) {
        const result = await this.storeMemory(memory);
        results.push(result);
      }

      logger.info('对话记忆存储成功', {
        conversationId,
        messageCount: messages.length,
        userId,
        sessionId,
      });

      return {
        success: true,
        conversationId,
        messagesStored: messages.length,
        memoryIds: results.map((r) => r.memoryId),
        storedAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('对话记忆存储失败', {
        error: error.message,
        conversationData,
      });
      throw errorHandler.createError(
        'COGNEE_CONVERSATION_STORE_FAILED',
        error.message,
      );
    }
  }

  /**
   * 检索相关对话记忆
   */
  async retrieveConversationMemory(query, conversationId, options = {}) {
    try {
      const searchOptions = {
        ...options,
        type: 'conversation',
        tags: ['conversation', conversationId],
        limit: options.limit || 20,
      };

      const result = await this.retrieveMemory(query, searchOptions);

      // 按时间排序
      result.results.sort((a, b) => {
        const timeA = new Date(a.metadata.timestamp);
        const timeB = new Date(b.metadata.timestamp);
        return timeA - timeB;
      });

      return {
        ...result,
        conversationId,
        relevantMessages: result.results.filter(
          (memory) => memory.metadata.conversationId === conversationId,
        ),
      };
    } catch (error) {
      logger.error('对话记忆检索失败', {
        error: error.message,
        query,
        conversationId,
      });
      throw errorHandler.createError(
        'COGNEE_CONVERSATION_RETRIEVE_FAILED',
        error.message,
      );
    }
  }

  /**
   * 删除记忆
   */
  async deleteMemory(memoryId) {
    try {
      if (!this.client) {
        throw new Error('Cognee客户端未初始化');
      }

      this.stats.requests++;

      await this.client.deleteMemory(memoryId);

      // 发送事件
      eventSystem.emit('cognee:memory:deleted', {
        memoryId,
        timestamp: new Date().toISOString(),
      });

      logger.info('记忆删除成功', { memoryId });

      return {
        success: true,
        memoryId,
        deletedAt: new Date().toISOString(),
      };
    } catch (error) {
      this.stats.errors++;
      logger.error('记忆删除失败', { error: error.message, memoryId });

      eventSystem.emit('cognee:memory:error', {
        operation: 'delete',
        memoryId,
        error: error.message,
        timestamp: new Date().toISOString(),
      });

      throw errorHandler.createError(
        'COGNEE_MEMORY_DELETE_FAILED',
        error.message,
      );
    }
  }

  /**
   * 获取服务统计信息
   */
  getStats() {
    return {
      provider: 'cognee',
      name: this.name,
      requests: this.stats.requests,
      errors: this.stats.errors,
      errorRate:
        this.stats.requests > 0 ? this.stats.errors / this.stats.requests : 0,
      memoriesStored: this.stats.memoriesStored,
      memoriesRetrieved: this.stats.memoriesRetrieved,
      searchQueries: this.stats.searchQueries,
      graphsCreated: this.stats.graphsCreated,
      isConnected: this.client !== null,
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
      memoriesStored: 0,
      memoriesRetrieved: 0,
      searchQueries: 0,
      graphsCreated: 0,
    };
    logger.info('Cognee记忆服务统计信息已重置');
  }
}
