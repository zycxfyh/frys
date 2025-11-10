/**
 * NATS 风格的消息队列系统
 * 借鉴 NATS 的轻量级消息传递和发布订阅模式理念
 */

import { logger } from '../shared/utils/logger.js';
import { BaseModule } from './BaseModule.js';

class NATSInspiredMessaging extends BaseModule {
  getDefaultConfig() {
    return {
      ...super.getDefaultConfig(),
      maxSubjects: 1000,
      maxSubscriptions: 10000,
      maxConnections: 100,
      messageTTL: 3600000, // 1小时
    };
  }

  /**
   * 构造函数
   * 初始化消息队列管理器
   */
  constructor() {
    super();
    this.subjects = new Map(); // 主题
    this.subscriptions = new Map(); // 订阅
    this.queues = new Map(); // 队列组
    this.connections = new Map(); // 连接
    this.messages = new Map(); // 已发布的消息
  }

  onInitialize() {
    // 初始化消息队列系统
    logger.info('📡 NATS风格消息队列系统已初始化');
  }

  onDestroy() {
    // 清理所有连接和订阅
    for (const connection of this.connections.values()) {
      // 模拟连接清理
      connection.connected = false;
    }

    this.subjects.clear();
    this.subscriptions.clear();
    this.queues.clear();
    this.connections.clear();
    this.messages.clear();

    logger.info('📡 NATS风格消息队列系统已销毁');
  }

  /**
   * 连接到NATS服务器
   * @param {string} clusterName - 集群名称
   * @returns {Promise<Object>} 连接对象的Promise
   */
  async connect(clusterName) {
    const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const connection = {
      id: connectionId,
      cluster: clusterName,
      connected: true,
      createdAt: Date.now(),
      close: async () => {
        // 清理连接
        this.connections.delete(connectionId);
        connection.connected = false;
        logger.info(`🔌 连接已关闭: ${connectionId}`);
      },
    };

    this.connections.set(connectionId, connection);
    logger.info(`🔌 已连接到NATS集群: ${clusterName}`);
    return connection;
  }

  /**
   * 发布消息
   * @param {string} subject - 主题
   * @param {*} message - 消息内容
   * @param {string} connectionId - 连接ID
   */
  publish(subject, message) {
    const subscribers = this.subscriptions.get(subject) || [];
    const delivered = subscribers.length;

    // 记录已发布的消息
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.messages.set(messageId, { subject, message, timestamp: Date.now() });

    // 模拟消息传递
    for (const subscriber of subscribers) {
      if (subscriber.callback) {
        // 直接传递消息，使用稍微长一点的延迟确保异步处理
        setTimeout(() => subscriber.callback(message), 5);
      }
    }

    logger.info(`📨 消息已发布: ${subject} -> ${delivered} 个订阅者`);
    return { subject, message, delivered };
  }

  /**
   * 订阅主题
   * @param {string} subject - 主题
   * @param {Function} callback - 回调函数
   * @param {string} connectionId - 连接ID
   * @returns {Object} 订阅对象
   */
  subscribe(subject, callback, connectionId = null) {
    if (!this.subscriptions.has(subject)) {
      this.subscriptions.set(subject, []);
    }

    const subscription = {
      id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      subject,
      callback,
      connectionId,
      createdAt: Date.now(),
    };

    this.subscriptions.get(subject).push(subscription);
    logger.info(`📥 订阅已创建: ${subject}`);
    return subscription;
  }

  /**
   * 取消订阅主题
   * @param {string} subject - 主题
   * @param {string} subscriptionId - 订阅ID
   * @returns {boolean} 是否成功取消订阅
   */
  unsubscribe(subject, subscriptionId) {
    const subscribers = this.subscriptions.get(subject);
    if (!subscribers) {
      return false;
    }

    const index = subscribers.findIndex((sub) => sub.id === subscriptionId);
    if (index === -1) {
      return false;
    }

    subscribers.splice(index, 1);
    logger.info(`📤 订阅已取消: ${subject} (${subscriptionId})`);
    return true;
  }

  /**
   * 获取统计信息
   * @returns {Object} 统计数据
   */
  getStats() {
    const totalSubjects = this.subjects.size;
    const totalSubscriptions = Array.from(this.subscriptions.values()).reduce(
      (sum, subs) => sum + subs.length,
      0,
    );
    const totalConnections = this.connections.size;

    return {
      subjects: totalSubjects,
      subscriptions: totalSubscriptions,
      connections: totalConnections,
      messages: this.messages.size, // 已发布的消息数量
    };
  }
}

export default NATSInspiredMessaging;
