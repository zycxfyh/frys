/**
 * Zustand 风格的状态管理 (响应式增强版)
 * 借鉴 Zustand 的轻量级状态管理，并集成响应式特性
 */

import { BaseModule } from './BaseModule.js';
import { ReactiveState } from './FunctionalUtils.js';
import { frysError } from './error-handler.js';
import { logger } from '../utils/logger.js';

class ZustandInspiredState extends BaseModule {
  getDefaultConfig() {
    return {
      ...super.getDefaultConfig(),
      enableReactive: true,
      enableLogging: true,
      maxStores: 100,
      enableDevTools: false,
    };
  }

  constructor() {
    super('state');
    // 初始化基本属性，在onInitialize之前可用
    this.stores = new Map();
    this.subscribers = new Map();
    this.middlewares = new Map();
    this.actions = new Map();
  }

  async onInitialize() {
    this.stores = new Map(); // 状态存储
    this.subscribers = new Map(); // 订阅者
    this.middlewares = new Map(); // 中间件
    this.actions = new Map(); // 动作历史

    logger.info('响应式状态管理模块已初始化');
  }

  async onDestroy() {
    // 清理所有订阅
    for (const [storeId, subscribers] of this.subscribers) {
      subscribers.clear();
    }

    this.stores.clear();
    this.subscribers.clear();
    this.middlewares.clear();
    this.actions.clear();
  }

  create(createFn, options = {}) {
    if (this.stores.size >= this.config.maxStores) {
      throw frysError.system('已达到最大状态存储数量限制', 'store_limit');
    }

    const storeId = `store_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 使用响应式状态管理
    const reactiveState = this.config.enableReactive
      ? new ReactiveState()
      : null;

    const setState = (updater, actionName = 'unknown') => {
      const store = this.stores.get(storeId);
      if (!store) {
        throw frysError.system(
          `状态存储不存在: ${storeId}`,
          'store_not_found',
        );
      }

      if (updater === null || updater === undefined) {
        throw frysError.validation('状态更新器不能为空', 'updater');
      }

      const prevState = store.state;
      let newState;

      try {
        if (typeof updater === 'function') {
          const result = updater(prevState);
          newState =
            result && typeof result === 'object' && !Array.isArray(result)
              ? { ...prevState, ...result }
              : result;
        } else {
          newState = { ...prevState, ...updater };
        }

        // 应用中间件
        const middlewares = this.middlewares.get(storeId) || [];
        for (const middleware of middlewares) {
          const result = middleware(newState, prevState, actionName);
          if (result !== undefined) {
            newState = result;
          }
        }

        store.state = newState;

        // 记录动作
        this._recordAction(storeId, actionName, prevState, newState);

        // 通知订阅者
        const subscribers = this.subscribers.get(storeId) || [];
        for (const subscriber of subscribers) {
          try {
            subscriber(newState, prevState);
          } catch (error) {
            logger.error(`状态订阅者执行失败: ${storeId}`, error);
          }
        }

        // 更新响应式状态
        if (reactiveState) {
          reactiveState.setState(() => newState);
        }

        if (this.config.enableLogging) {
          logger.debug(`状态已更新: ${storeId}`, { action: actionName });
        }
      } catch (error) {
        logger.error(`状态更新失败: ${storeId}`, error);
        throw error;
      }
    };

    const getState = () => this.stores.get(storeId).state;

    const store = {
      id: storeId,
      reactiveState,
      setState,
      getState,
      subscribe: (listener) => {
        if (typeof listener !== 'function') {
          throw frysError.validation('订阅者必须是函数', 'subscriber');
        }

        if (!this.subscribers.has(storeId)) {
          this.subscribers.set(storeId, new Set());
        }
        this.subscribers.get(storeId).add(listener);

        return () => {
          const subscribers = this.subscribers.get(storeId);
          if (subscribers) {
            subscribers.delete(listener);
          }
        };
      },
      middleware: options.middleware || [],
      createdAt: Date.now(),
    };

    const initialState = createFn(setState, getState);

    // Zustand风格：createFn返回的状态和actions混合的对象
    // 我们需要将其分离：纯数据状态和函数actions
    if (initialState && typeof initialState === 'object') {
      const stateObj = {};
      const actions = {};

      // 分离数据和函数
      for (const [key, value] of Object.entries(initialState)) {
        if (typeof value === 'function') {
          actions[key] = value;
        } else {
          stateObj[key] = value;
        }
      }

      store.state = stateObj;
      Object.assign(store, actions);
    } else {
      // 如果返回的是基本类型或null，则直接作为state
      store.state = initialState || {};
    }
    this.stores.set(storeId, store);

    // 初始化响应式状态
    if (reactiveState) {
      reactiveState.setState(() => store.state);
    }

    logger.info(`状态存储已创建: ${storeId}`, { reactive: !!reactiveState });
    return store;
  }

  /**
   * 记录动作历史
   */
  _recordAction(storeId, actionName, prevState, newState) {
    if (!this.actions.has(storeId)) {
      this.actions.set(storeId, []);
    }

    const actions = this.actions.get(storeId);
    actions.push({
      action: actionName,
      timestamp: Date.now(),
      prevState: this._shallowClone(prevState),
      newState: this._shallowClone(newState),
    });

    // 限制动作历史长度
    if (actions.length > 100) {
      actions.splice(0, actions.length - 50);
    }
  }

  /**
   * 浅克隆对象
   */
  _shallowClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return [...obj];
    return { ...obj };
  }

  /**
   * 健康检查
   */
  async onHealthCheck() {
    const storeCount = this.stores.size;
    const subscriberCount = Array.from(this.subscribers.values()).reduce(
      (sum, subs) => sum + subs.size,
      0,
    );
    const actionCount = Array.from(this.actions.values()).reduce(
      (sum, actions) => sum + actions.length,
      0,
    );

    return {
      stores: storeCount,
      subscribers: subscriberCount,
      actions: actionCount,
      status: storeCount >= 0 ? 'healthy' : 'error',
    };
  }

  /**
   * 获取统计信息
   */
  getStats() {
    const storeStats = Array.from(this.stores.values()).map((store) => ({
      id: store.id,
      stateSize: JSON.stringify(store.state).length,
      subscribers: this.subscribers.get(store.id)?.size || 0,
      actions: this.actions.get(store.id)?.length || 0,
      createdAt: store.createdAt,
    }));

    return {
      stores: this.stores.size,
      subscribers: Array.from(this.subscribers.values()).reduce(
        (sum, subs) => sum + subs.size,
        0,
      ),
      middlewares: this.middlewares.size,
    };
  }

  /**
   * 获取指定存储的状态历史
   */
  getStoreHistory(storeId, limit = 10) {
    const actions = this.actions.get(storeId) || [];
    return actions.slice(-limit);
  }

  /**
   * 重置指定存储的状态
   */
  resetStore(storeId) {
    const store = this.stores.get(storeId);
    if (!store) {
      throw frysError.system(
        `状态存储不存在: ${storeId}`,
        'store_not_found',
      );
    }

    store.state = {};
    this.actions.get(storeId)?.splice(0);

    if (store.reactiveState) {
      store.reactiveState.setState(() => ({}));
    }

    logger.info(`状态存储已重置: ${storeId}`);
  }

  /**
   * 清理过期状态存储
   */
  cleanupExpiredStores(maxAge = 24 * 60 * 60 * 1000) {
    // 24小时
    const now = Date.now();
    let cleaned = 0;

    for (const [storeId, store] of this.stores) {
      if (now - store.createdAt > maxAge) {
        this.stores.delete(storeId);
        this.subscribers.delete(storeId);
        this.middlewares.delete(storeId);
        this.actions.delete(storeId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info(`清理了 ${cleaned} 个过期状态存储`);
    }
  }
}

export default ZustandInspiredState;
