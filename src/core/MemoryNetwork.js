/**
 * 🧠 frys 跨越记忆网络系统
 *
 * 借鉴VCPToolBox的记忆网络理念，实现：
 * - 跨会话记忆：持久化存储对话历史和上下文
 * - 知识图谱：实体关系网络和语义关联
 * - 语义搜索：基于向量相似度和关键词的智能检索
 * - 记忆压缩：自动压缩和归纳长期记忆
 * - 记忆融合：合并相似记忆，减少冗余
 */

import { EventEmitter } from 'events';
import { logger } from '../shared/utils/logger.js';
import { frysError } from './error-handler.js';

class MemoryNode {
  constructor(id, type, content, metadata = {}) {
    this.id = id;
    this.type = type; // conversation, fact, entity, relation, event, insight
    this.content = content;
    this.metadata = {
      createdAt: new Date(),
      updatedAt: new Date(),
      accessCount: 0,
      lastAccessed: new Date(),
      importance: 1.0, // 0-1, 重要性评分
      confidence: 1.0, // 0-1, 置信度
      source: null, // 来源标识
      tags: [],
      ...metadata,
    };

    this.connections = new Map(); // {targetId: {type, strength, createdAt}}
    this.vector = null; // 向量表示，用于语义搜索
    this.summary = null; // 压缩后的摘要
  }

  connect(targetId, connectionType, strength = 1.0) {
    this.connections.set(targetId, {
      type: connectionType,
      strength,
      createdAt: new Date(),
    });
    this.metadata.updatedAt = new Date();
  }

  disconnect(targetId) {
    this.connections.delete(targetId);
    this.metadata.updatedAt = new Date();
  }

  updateAccess() {
    this.metadata.accessCount++;
    this.metadata.lastAccessed = new Date();
  }

  setVector(vector) {
    this.vector = vector;
    this.metadata.updatedAt = new Date();
  }

  setSummary(summary) {
    this.summary = summary;
    this.metadata.updatedAt = new Date();
  }

  calculateRelevance(query) {
    let score = 0;

    // 关键词匹配
    if (typeof this.content === 'string' && typeof query === 'string') {
      const queryWords = query.toLowerCase().split(/\s+/);
      const contentWords = this.content.toLowerCase().split(/\s+/);

      const matches = queryWords.filter((word) =>
        contentWords.some((contentWord) => contentWord.includes(word)),
      );

      score += (matches.length / queryWords.length) * 0.5;
    }

    // 标签匹配
    if (this.metadata.tags && Array.isArray(this.metadata.tags)) {
      const tagMatches = this.metadata.tags.filter((tag) =>
        query.toLowerCase().includes(tag.toLowerCase()),
      );
      score += (tagMatches.length / this.metadata.tags.length) * 0.3;
    }

    // 访问频率加成
    const recencyScore = Math.min(this.metadata.accessCount / 10, 0.2);
    score += recencyScore;

    return Math.min(score, 1.0);
  }

  toJSON() {
    return {
      id: this.id,
      type: this.type,
      content: this.content,
      metadata: this.metadata,
      connections: Array.from(this.connections.entries()),
      hasVector: this.vector !== null,
      hasSummary: this.summary !== null,
    };
  }
}

class KnowledgeGraph {
  constructor() {
    this.nodes = new Map();
    this.edges = new Map(); // {sourceId-targetId: {type, properties}}
    this.entityIndex = new Map(); // 实体名称 -> 节点ID集合
    this.typeIndex = new Map(); // 类型 -> 节点ID集合
    this.tagIndex = new Map(); // 标签 -> 节点ID集合
  }

  addNode(node) {
    this.nodes.set(node.id, node);

    // 更新索引
    if (!this.typeIndex.has(node.type)) {
      this.typeIndex.set(node.type, new Set());
    }
    this.typeIndex.get(node.type).add(node.id);

    if (node.metadata.tags) {
      for (const tag of node.metadata.tags) {
        if (!this.tagIndex.has(tag)) {
          this.tagIndex.set(tag, new Set());
        }
        this.tagIndex.get(tag).add(node.id);
      }
    }

    // 如果是实体类型，添加到实体索引
    if (node.type === 'entity') {
      const entityName = this.extractEntityName(node.content);
      if (entityName) {
        if (!this.entityIndex.has(entityName)) {
          this.entityIndex.set(entityName, new Set());
        }
        this.entityIndex.get(entityName).add(node.id);
      }
    }

    logger.debug(`Added node ${node.id} to knowledge graph`);
  }

  addEdge(sourceId, targetId, type, properties = {}) {
    const edgeKey = `${sourceId}-${targetId}`;
    this.edges.set(edgeKey, {
      sourceId,
      targetId,
      type,
      properties: {
        createdAt: new Date(),
        strength: 1.0,
        ...properties,
      },
    });

    // 更新节点连接
    const sourceNode = this.nodes.get(sourceId);
    const targetNode = this.nodes.get(targetId);

    if (sourceNode) sourceNode.connect(targetId, type);
    if (targetNode) targetNode.connect(sourceId, type);

    logger.debug(`Added edge ${edgeKey} (${type}) to knowledge graph`);
  }

  removeNode(nodeId) {
    const node = this.nodes.get(nodeId);
    if (!node) return false;

    // 移除所有相关边
    for (const [edgeKey, edge] of this.edges) {
      if (edge.sourceId === nodeId || edge.targetId === nodeId) {
        this.edges.delete(edgeKey);
      }
    }

    // 更新索引
    this.typeIndex.get(node.type)?.delete(nodeId);
    if (node.metadata.tags) {
      for (const tag of node.metadata.tags) {
        this.tagIndex.get(tag)?.delete(nodeId);
      }
    }

    // 移除实体索引
    if (node.type === 'entity') {
      const entityName = this.extractEntityName(node.content);
      if (entityName) {
        this.entityIndex.get(entityName)?.delete(nodeId);
      }
    }

    this.nodes.delete(nodeId);
    logger.debug(`Removed node ${nodeId} from knowledge graph`);
    return true;
  }

  findNodesByType(type) {
    const nodeIds = this.typeIndex.get(type) || new Set();
    return Array.from(nodeIds)
      .map((id) => this.nodes.get(id))
      .filter(Boolean);
  }

  findNodesByTag(tag) {
    const nodeIds = this.tagIndex.get(tag) || new Set();
    return Array.from(nodeIds)
      .map((id) => this.nodes.get(id))
      .filter(Boolean);
  }

  findNodesByEntity(entityName) {
    const nodeIds = this.entityIndex.get(entityName) || new Set();
    return Array.from(nodeIds)
      .map((id) => this.nodes.get(id))
      .filter(Boolean);
  }

  findRelatedNodes(nodeId, maxDepth = 2, relationTypes = null) {
    const visited = new Set();
    const related = new Set();

    const traverse = (currentId, depth) => {
      if (depth > maxDepth || visited.has(currentId)) return;
      visited.add(currentId);

      for (const [, edge] of this.edges) {
        if (edge.sourceId === currentId || edge.targetId === currentId) {
          if (relationTypes && !relationTypes.includes(edge.type)) continue;

          const targetId =
            edge.sourceId === currentId ? edge.targetId : edge.sourceId;
          if (!visited.has(targetId)) {
            related.add(targetId);
            traverse(targetId, depth + 1);
          }
        }
      }
    };

    traverse(nodeId, 0);
    return Array.from(related)
      .map((id) => this.nodes.get(id))
      .filter(Boolean);
  }

  extractEntityName(content) {
    // 简单的实体名称提取
    if (typeof content !== 'string') return null;

    // 提取人名、地名、组织名等
    const patterns = [
      /(?:先生|女士|教授|博士)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g, // 英文人名
      /([北京|上海|广州|深圳|杭州|南京|苏州|武汉|西安|成都|重庆][市|省|自治区]?)/g, // 中国城市
      /([腾讯|阿里|百度|字节跳动|京东|美团|滴滴|网易|新浪][公司|集团|科技]?)/g, // 公司名称
    ];

    for (const pattern of patterns) {
      const matches = content.match(pattern);
      if (matches && matches.length > 0) {
        return matches[0];
      }
    }

    return null;
  }

  getStats() {
    const nodeStats = {};
    for (const [type, nodeIds] of this.typeIndex) {
      nodeStats[type] = nodeIds.size;
    }

    return {
      totalNodes: this.nodes.size,
      totalEdges: this.edges.size,
      nodeTypes: nodeStats,
      entities: this.entityIndex.size,
      tags: this.tagIndex.size,
    };
  }
}

class VectorStore {
  constructor() {
    this.vectors = new Map(); // nodeId -> vector
    this.index = null; // 向量索引（可扩展为ANN索引）
  }

  storeVector(nodeId, vector) {
    this.vectors.set(nodeId, vector);
    // 这里可以添加向量索引更新逻辑
    logger.debug(`Stored vector for node ${nodeId}`);
  }

  getVector(nodeId) {
    return this.vectors.get(nodeId);
  }

  findSimilarVectors(queryVector, topK = 5, threshold = 0.7) {
    const similarities = [];

    for (const [nodeId, vector] of this.vectors) {
      const similarity = this.cosineSimilarity(queryVector, vector);
      if (similarity >= threshold) {
        similarities.push({ nodeId, similarity });
      }
    }

    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }

  cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) return 0;

    return dotProduct / (normA * normB);
  }

  removeVector(nodeId) {
    this.vectors.delete(nodeId);
    logger.debug(`Removed vector for node ${nodeId}`);
  }

  getStats() {
    return {
      totalVectors: this.vectors.size,
      averageDimension:
        this.vectors.size > 0
          ? Array.from(this.vectors.values())[0]?.length || 0
          : 0,
    };
  }
}

/**
 * 🧠 MemoryNetwork - 跨越记忆网络系统
 */
export class MemoryNetwork extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      maxMemoryNodes: 10000,
      compressionThreshold: 1000,
      similarityThreshold: 0.8,
      vectorDimension: 384, // 默认向量维度
      ...options,
    };

    this.knowledgeGraph = new KnowledgeGraph();
    this.vectorStore = new VectorStore();
    this.memoryNodes = new Map();
    this.sessions = new Map(); // sessionId -> memory nodes

    this.stats = {
      totalNodes: 0,
      compressedNodes: 0,
      mergedNodes: 0,
      searchQueries: 0,
      averageResponseTime: 0,
    };

    // 启动自动维护任务
    this.startMaintenanceTasks();
  }

  initialize() {
    // 初始化记忆网络
    logger.debug('MemoryNetwork initialized');
  }

  startMaintenanceTasks() {
    // 每小时执行一次内存压缩
    setInterval(
      () => {
        this.compressMemories();
      },
      60 * 60 * 1000,
    );

    // 每30分钟执行一次相似性合并
    setInterval(
      () => {
        this.mergeSimilarMemories();
      },
      30 * 60 * 1000,
    );
  }

  async storeMemory(sessionId, type, content, metadata = {}) {
    const nodeId = `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const memoryNode = new MemoryNode(nodeId, type, content, {
      sessionId,
      ...metadata,
    });

    // 添加到知识图谱
    this.knowledgeGraph.addNode(memoryNode);

    // 存储到会话索引
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, new Set());
    }
    this.sessions.get(sessionId).add(nodeId);

    this.memoryNodes.set(nodeId, memoryNode);
    this.stats.totalNodes++;

    // 生成向量表示（简化实现，实际应调用embedding服务）
    if (this.options.enableVectorization) {
      const vector = await this.generateVector(content);
      memoryNode.setVector(vector);
      await this.vectorStore.storeVector(nodeId, vector);
    }

    this.emit('memory:stored', {
      nodeId,
      sessionId,
      type,
      content:
        typeof content === 'string' ? content.substring(0, 100) : content,
    });

    logger.info(`Stored memory node ${nodeId} for session ${sessionId}`);

    return nodeId;
  }

  /**
   * 解析检索选项
   * @private
   */
  _parseRetrievalOptions(options) {
    return {
      limit: options.limit || 10,
      type: options.type || null,
      tags: options.tags || [],
      useVector: options.useVector !== false,
      minRelevance: options.minRelevance || 0.1,
    };
  }

  /**
   * 获取会话候选节点
   * @private
   */
  _getSessionCandidates(sessionId) {
    const sessionNodes = this.sessions.get(sessionId) || new Set();
    return Array.from(sessionNodes)
      .map((nodeId) => this.memoryNodes.get(nodeId))
      .filter(Boolean);
  }

  /**
   * 按类型筛选候选节点
   * @private
   */
  _filterCandidatesByType(candidates, type) {
    return type ? candidates.filter((node) => node.type === type) : candidates;
  }

  /**
   * 按标签筛选候选节点
   * @private
   */
  _filterCandidatesByTags(candidates, tags) {
    if (!tags.length) return candidates;
    return candidates.filter((node) =>
      tags.some((tag) => node.metadata.tags?.includes(tag)),
    );
  }

  /**
   * 计算文本相关性
   * @private
   */
  _calculateTextRelevance(candidates, query, minRelevance) {
    const results = [];
    for (const node of candidates) {
      const relevance = node.calculateRelevance(query);
      if (relevance >= minRelevance) {
        results.push({ node, relevance, vectorSimilarity: 0 });
      }
    }
    return results;
  }

  /**
   * 合并向量搜索结果
   * @private
   */
  async _mergeVectorResults(results, query, config) {
    const queryVector = await this.generateVector(query);
    const vectorResults = await this.vectorStore.findSimilarVectors(
      queryVector,
      config.limit,
      config.minRelevance,
    );

    for (const { nodeId, similarity } of vectorResults) {
      const node = this.memoryNodes.get(nodeId);
      if (!node) continue;

      const existing = results.find((r) => r.node.id === nodeId);
      if (existing) {
        existing.vectorSimilarity = similarity;
        existing.relevance = Math.max(existing.relevance, similarity);
      } else {
        results.push({
          node,
          relevance: similarity,
          vectorSimilarity: similarity,
        });
      }
    }

    return results;
  }

  /**
   * 格式化和排序结果
   * @private
   */
  _formatAndSortResults(results, limit) {
    return results
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, limit)
      .map((result) => ({
        nodeId: result.node.id,
        type: result.node.type,
        content: result.node.content,
        relevance: result.relevance,
        vectorSimilarity: result.vectorSimilarity,
        metadata: result.node.metadata,
      }));
  }

  async retrieveMemory(sessionId, query, options = {}) {
    const startTime = Date.now();
    this.stats.searchQueries++;

    const config = this._parseRetrievalOptions(options);
    let candidates = this._getSessionCandidates(sessionId);

    candidates = this._filterCandidatesByType(candidates, config.type);
    candidates = this._filterCandidatesByTags(candidates, config.tags);

    let results = this._calculateTextRelevance(
      candidates,
      query,
      config.minRelevance,
    );

    if (config.useVector && this.options.enableVectorization) {
      results = await this._mergeVectorResults(results, query, config);
    }

    const sortedResults = this._formatAndSortResults(results, config.limit);

    const responseTime = Date.now() - startTime;
    this.updateResponseTime(responseTime);

    this.emit('memory:retrieved', {
      sessionId,
      query,
      resultCount: sortedResults.length,
      responseTime,
    });

    return sortedResults;
  }

  async updateMemory(nodeId, updates) {
    const node = this.memoryNodes.get(nodeId);
    if (!node) {
      throw frysError.notFound(`Memory node ${nodeId} not found`);
    }

    // 更新内容
    if (updates.content !== undefined) {
      node.content = updates.content;
      node.metadata.updatedAt = new Date();

      // 重新生成向量
      if (this.options.enableVectorization) {
        const vector = await this.generateVector(updates.content);
        node.setVector(vector);
        await this.vectorStore.storeVector(nodeId, vector);
      }
    }

    // 更新元数据
    if (updates.metadata) {
      Object.assign(node.metadata, updates.metadata);
      node.metadata.updatedAt = new Date();
    }

    // 更新标签
    if (updates.tags) {
      node.metadata.tags = updates.tags;
      // 重新索引标签
      this.knowledgeGraph.addNode(node); // 重新添加会更新索引
    }

    this.emit('memory:updated', { nodeId, updates });
    logger.debug(`Updated memory node ${nodeId}`);

    return node;
  }

  async deleteMemory(nodeId) {
    const node = this.memoryNodes.get(nodeId);
    if (!node) return false;

    // 从知识图谱移除
    this.knowledgeGraph.removeNode(nodeId);

    // 从向量存储移除
    await this.vectorStore.removeVector(nodeId);

    // 从会话索引移除
    const sessionId = node.metadata.sessionId;
    if (sessionId && this.sessions.has(sessionId)) {
      this.sessions.get(sessionId).delete(nodeId);
    }

    this.memoryNodes.delete(nodeId);
    this.stats.totalNodes--;

    this.emit('memory:deleted', { nodeId, sessionId });
    logger.info(`Deleted memory node ${nodeId}`);

    return true;
  }

  generateVector(content) {
    // 简化的向量生成（实际应调用embedding模型）
    if (typeof content !== 'string') {
      content = JSON.stringify(content);
    }

    // 使用简单的hash-based向量生成
    const vector = new Array(this.options.vectorDimension);
    const hash = this.simpleHash(content);

    for (let i = 0; i < this.options.vectorDimension; i++) {
      vector[i] = Math.sin(hash * (i + 1)) * Math.cos(hash / (i + 1));
    }

    // 归一化
    const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    return vector.map((val) => val / norm);
  }

  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // 转换为32位整数
    }
    return hash;
  }

  async compressMemories() {
    // 压缩旧的、不重要的记忆
    const nodesToCompress = Array.from(this.memoryNodes.values()).filter(
      (node) => {
        const age = Date.now() - node.metadata.createdAt.getTime();
        const isOld = age > 7 * 24 * 60 * 60 * 1000; // 7天
        const isLowImportance = node.metadata.importance < 0.3;
        const isLowAccess = node.metadata.accessCount < 3;

        return isOld && (isLowImportance || isLowAccess);
      },
    );

    for (const node of nodesToCompress) {
      if (!node.summary) {
        // 生成摘要
        const summary = await this.generateSummary(node.content);
        node.setSummary(summary);
        this.stats.compressedNodes++;
      }
    }

    logger.info(`Compressed ${nodesToCompress.length} memory nodes`);
  }

  async mergeSimilarMemories() {
    // 合并相似的记忆节点
    const nodeGroups = this.groupSimilarNodes();

    for (const group of nodeGroups) {
      if (group.length > 1) {
        await this.mergeNodeGroup(group);
        this.stats.mergedNodes++;
      }
    }

    logger.info(`Merged ${this.stats.mergedNodes} similar memory groups`);
  }

  groupSimilarNodes() {
    const groups = [];
    const processed = new Set();

    for (const [id1, node1] of this.memoryNodes) {
      if (processed.has(id1)) continue;

      const group = [node1];
      processed.add(id1);

      for (const [id2, node2] of this.memoryNodes) {
        if (processed.has(id2) || id1 === id2) continue;

        const similarity = this.calculateNodeSimilarity(node1, node2);
        if (similarity >= this.options.similarityThreshold) {
          group.push(node2);
          processed.add(id2);
        }
      }

      if (group.length > 1) {
        groups.push(group);
      }
    }

    return groups;
  }

  calculateNodeSimilarity(node1, node2) {
    // 简化的相似度计算
    if (node1.type !== node2.type) return 0;

    let similarity = 0;

    // 内容相似度
    if (
      typeof node1.content === 'string' &&
      typeof node2.content === 'string'
    ) {
      const words1 = new Set(node1.content.toLowerCase().split(/\s+/));
      const words2 = new Set(node2.content.toLowerCase().split(/\s+/));

      const intersection = new Set([...words1].filter((x) => words2.has(x)));
      const union = new Set([...words1, ...words2]);

      similarity += (intersection.size / union.size) * 0.6;
    }

    // 标签相似度
    if (node1.metadata.tags && node2.metadata.tags) {
      const tags1 = new Set(node1.metadata.tags);
      const tags2 = new Set(node2.metadata.tags);

      const intersection = new Set([...tags1].filter((x) => tags2.has(x)));
      const union = new Set([...tags1, ...tags2]);

      similarity += (intersection.size / union.size) * 0.4;
    }

    return similarity;
  }

  async mergeNodeGroup(nodes) {
    // 将相似节点合并为一个
    const primaryNode = nodes[0];
    const mergedContent = nodes.map((n) => n.content).join('\n---\n');
    const mergedTags = [
      ...new Set(nodes.flatMap((n) => n.metadata.tags || [])),
    ];

    // 更新主要节点
    await this.updateMemory(primaryNode.id, {
      content: mergedContent,
      metadata: {
        mergedCount: nodes.length,
        mergedAt: new Date(),
        originalNodes: nodes.slice(1).map((n) => n.id),
      },
      tags: mergedTags,
    });

    // 删除其他节点
    for (let i = 1; i < nodes.length; i++) {
      await this.deleteMemory(nodes[i].id);
    }
  }

  generateSummary(content) {
    // 简化的摘要生成（实际应调用AI模型）
    if (typeof content !== 'string') return content;

    const sentences = content
      .split(/[.!?]+/)
      .filter((s) => s.trim().length > 0);
    if (sentences.length <= 2) return content;

    // 取前两个和最后一个句子作为摘要
    const summary = `${[
      sentences[0],
      sentences[1],
      sentences[sentences.length - 1],
    ].join('. ')}.`;

    return summary;
  }

  updateResponseTime(responseTime) {
    // 滑动平均响应时间
    const alpha = 0.1;
    this.stats.averageResponseTime =
      alpha * responseTime + (1 - alpha) * this.stats.averageResponseTime;
  }

  getSessionMemories(sessionId) {
    const nodeIds = this.sessions.get(sessionId) || new Set();
    return Array.from(nodeIds)
      .map((id) => this.memoryNodes.get(id))
      .filter(Boolean)
      .map((node) => node.toJSON());
  }

  getStats() {
    return {
      ...this.stats,
      knowledgeGraph: this.knowledgeGraph.getStats(),
      vectorStore: this.vectorStore.getStats(),
      activeSessions: this.sessions.size,
      memoryUsage: this.calculateMemoryUsage(),
    };
  }

  calculateMemoryUsage() {
    let totalSize = 0;

    for (const node of this.memoryNodes.values()) {
      totalSize += JSON.stringify(node.toJSON()).length;
    }

    return totalSize;
  }

  cleanup() {
    // 清理资源
    this.memoryNodes.clear();
    this.sessions.clear();
    this.knowledgeGraph = new KnowledgeGraph();
    this.vectorStore = new VectorStore();

    logger.info('Memory network cleaned up');
  }

  /**
   * 关闭记忆网络，清理资源
   */
  shutdown() {
    try {
      // 清理所有记忆节点
      this.memoryNodes.clear();

      // 清理向量存储
      if (this.vectorStore && typeof this.vectorStore.clear === 'function') {
        this.vectorStore.clear();
      }

      // 清理会话
      this.sessions.clear();

      logger.info('MemoryNetwork shut down successfully');
    } catch (error) {
      logger.error('Error during MemoryNetwork shutdown:', error);
      throw error;
    }
  }
}

export default MemoryNetwork;
