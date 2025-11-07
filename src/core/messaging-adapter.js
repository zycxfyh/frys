/**
 * frys 消息适配器
 * 提供向后兼容的接口，让现有代码可以平滑过渡到新的Bull.js消息队列
 */

import { resolve } from './container.js';
import { eventSystem } from './events.js';
import { logger } from '../utils/logger.js';

/**
 * 消息适配器类
 * 提供兼容原有messaging接口的适配器
 */
class MessagingAdapter {
  constructor() {
    this.queue = null;
    this.subscriptions = new Map();
  }

  /**
   * 初始化适配器
   */
  async initialize() {
    try {
      // 延迟获取队列实例，避免循环依赖
      if (!this.queue) {
        const { getQueue } = await import('./queue.js');
        this.queue = getQueue('default');
      }
      logger.debug('消息适配器已初始化');
    } catch (error) {
      logger.error('消息适配器初始化失败', error);
      throw error;
    }
  }

  /**
   * 发布消息 (兼容原有接口)
   */
  async publish(topic, data, options = {}) {
    try {
      if (!this.queue) {
        await this.initialize();
      }

      // 将消息发布到Bull队列
      await this.queue.add(topic, {
        data,
        timestamp: Date.now(),
        source: 'messaging-adapter',
        ...options
      });

      // 同时发射事件
      eventSystem.emit(`message:${topic}`, data);

      logger.debug(`消息已发布: ${topic}`, { data });
      return true;
    } catch (error) {
      logger.error(`消息发布失败: ${topic}`, error);
      throw error;
    }
  }

  /**
   * 订阅消息 (兼容原有接口)
   */
  async subscribe(topic, handler, options = {}) {
    try {
      if (!this.queue) {
        await this.initialize();
      }

      // 创建Bull工作进程来处理消息
      const workerName = `subscriber-${topic}`;
      const { createWorker } = await import('./queue.js');

      const worker = createWorker(workerName, async (job) => {
        try {
          const { data } = job;

          // 调用原始处理器
          if (typeof handler === 'function') {
            await handler(data);
          }

          logger.debug(`消息已处理: ${topic}`, { jobId: job.id });
        } catch (error) {
          logger.error(`消息处理失败: ${topic}`, error);
          throw error; // 让Bull处理重试
        }
      }, {
        concurrency: options.concurrency || 1,
        limiter: options.limiter || {
          max: 10,
          duration: 1000
        }
      });

      // 保存订阅信息以便后续清理
      this.subscriptions.set(topic, {
        worker,
        handler,
        options
      });

      logger.debug(`消息订阅已创建: ${topic}`);
      return worker;
    } catch (error) {
      logger.error(`消息订阅失败: ${topic}`, error);
      throw error;
    }
  }

  /**
   * 取消订阅
   */
  async unsubscribe(topic) {
    try {
      const subscription = this.subscriptions.get(topic);
      if (subscription) {
        // 关闭工作进程
        if (subscription.worker && typeof subscription.worker.close === 'function') {
          await subscription.worker.close();
        }

        this.subscriptions.delete(topic);
        logger.debug(`消息订阅已取消: ${topic}`);
        return true;
      }
      return false;
    } catch (error) {
      logger.error(`取消消息订阅失败: ${topic}`, error);
      return false;
    }
  }

  /**
   * 获取订阅列表
   */
  getSubscriptions() {
    return Array.from(this.subscriptions.keys());
  }

  /**
   * 健康检查
   */
  async healthCheck() {
    try {
      if (!this.queue) {
        await this.initialize();
      }

      const queueStatus = await this.queue.getJobCounts();
      const subscriptions = this.getSubscriptions();

      return {
        healthy: true,
        queue: {
          waiting: queueStatus.waiting || 0,
          active: queueStatus.active || 0,
          completed: queueStatus.completed || 0,
          failed: queueStatus.failed || 0,
          delayed: queueStatus.delayed || 0
        },
        subscriptions: subscriptions.length,
        subscriptionsList: subscriptions,
        timestamp: Date.now()
      };
    } catch (error) {
      logger.error('消息适配器健康检查失败', error);
      return {
        healthy: false,
        error: error.message,
        timestamp: Date.now()
      };
    }
  }

  /**
   * 清理资源
   */
  async destroy() {
    logger.info('清理消息适配器资源...');

    // 取消所有订阅
    for (const topic of this.subscriptions.keys()) {
      await this.unsubscribe(topic);
    }

    this.queue = null;
    this.subscriptions.clear();

    logger.info('消息适配器资源已清理');
  }
}

// 创建全局适配器实例
const messagingAdapter = new MessagingAdapter();

// 导出适配器
export { messagingAdapter, MessagingAdapter };
export default messagingAdapter;
