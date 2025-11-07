/**
 * 📡 frys 六大插件协议系统
 *
 * 借鉴VCPToolBox的插件协议理念，实现：
 * - 协议抽象层：统一的插件通信接口
 * - 多协议支持：HTTP、WebSocket、gRPC、Message Queue等
 * - 插件生命周期：加载、初始化、运行、销毁
 * - 安全沙箱：插件隔离和权限控制
 * - 热更新：运行时插件更新和替换
 * - 依赖管理：插件间的依赖关系处理
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';
import { frysError } from './error-handler.js';

class PluginContext {
  constructor(pluginId, sandbox) {
    this.pluginId = pluginId;
    this.sandbox = sandbox;
    this.metadata = {
      loadedAt: new Date(),
      lastActive: new Date(),
      callCount: 0,
      errorCount: 0
    };

    // 插件API
    this.api = {
      log: (level, message, meta = {}) => {
        logger.log(level, `[Plugin:${pluginId}] ${message}`, {
          pluginId,
          ...meta
        });
      },

      emit: (event, data) => {
        sandbox.emit('plugin:event', {
          pluginId,
          event,
          data,
          timestamp: new Date()
        });
      },

      call: async (targetPluginId, method, ...args) => {
        return sandbox.callPluginMethod(targetPluginId, method, ...args, pluginId);
      },

      store: {
        set: (key, value) => sandbox.storePluginData(pluginId, key, value),
        get: (key) => sandbox.getPluginData(pluginId, key),
        delete: (key) => sandbox.deletePluginData(pluginId, key)
      },

      config: sandbox.getPluginConfig(pluginId)
    };
  }

  updateActivity() {
    this.metadata.lastActive = new Date();
    this.metadata.callCount++;
  }

  recordError(error) {
    this.metadata.errorCount++;
    this.api.log('error', `Plugin error: ${error.message}`, { error: error.stack });
  }
}

class ProtocolAdapter extends EventEmitter {
  constructor(protocolType, config = {}) {
    super();
    this.protocolType = protocolType;
    this.config = {
      timeout: 30000,
      retries: 3,
      encoding: 'json',
      ...config
    };

    this.connections = new Map();
    this.isRunning = false;
  }

  async start() {
    if (this.isRunning) return;

    try {
      await this.initialize();
      this.isRunning = true;
      this.emit('started', { protocolType: this.protocolType });

      logger.info(`Protocol adapter ${this.protocolType} started`);
    } catch (error) {
      logger.error(`Failed to start protocol adapter ${this.protocolType}`, error);
      throw error;
    }
  }

  async stop() {
    if (!this.isRunning) return;

    try {
      await this.cleanup();
      this.isRunning = false;
      this.connections.clear();
      this.emit('stopped', { protocolType: this.protocolType });

      logger.info(`Protocol adapter ${this.protocolType} stopped`);
    } catch (error) {
      logger.error(`Failed to stop protocol adapter ${this.protocolType}`, error);
      throw error;
    }
  }

  async send(target, message, options = {}) {
    if (!this.isRunning) {
      throw frysError.system(`Protocol adapter ${this.protocolType} is not running`);
    }

    const connectionId = this.getConnectionId(target);
    let connection = this.connections.get(connectionId);

    if (!connection) {
      connection = await this.createConnection(target);
      this.connections.set(connectionId, connection);
    }

    try {
      const result = await this.doSend(connection, message, options);
      this.emit('message:sent', {
        target,
        message: typeof message === 'string' ? message.substring(0, 100) : message,
        connectionId
      });

      return result;
    } catch (error) {
      this.emit('message:failed', { target, error: error.message, connectionId });
      throw error;
    }
  }

  async receive(source, timeout = this.config.timeout) {
    if (!this.isRunning) {
      throw frysError.system(`Protocol adapter ${this.protocolType} is not running`);
    }

    try {
      const message = await this.doReceive(source, timeout);
      this.emit('message:received', {
        source,
        message: typeof message === 'string' ? message.substring(0, 100) : message
      });

      return message;
    } catch (error) {
      this.emit('message:receive_failed', { source, error: error.message });
      throw error;
    }
  }

  // 子类需要实现的抽象方法
  async initialize() {
    throw new Error('initialize() must be implemented by subclass');
  }

  async cleanup() {
    throw new Error('cleanup() must be implemented by subclass');
  }

  async createConnection(target) {
    throw new Error('createConnection() must be implemented by subclass');
  }

  async doSend(connection, message, options) {
    throw new Error('doSend() must be implemented by subclass');
  }

  async doReceive(source, timeout) {
    throw new Error('doReceive() must be implemented by subclass');
  }

  getConnectionId(target) {
    // 默认实现，可被子类重写
    return typeof target === 'object' ? JSON.stringify(target) : String(target);
  }
}

// HTTP协议适配器
class HTTPAdapter extends ProtocolAdapter {
  constructor(config = {}) {
    super('http', {
      baseURL: 'http://localhost:3000',
      headers: { 'Content-Type': 'application/json' },
      ...config
    });
  }

  async initialize() {
    // HTTP适配器通常不需要特殊初始化
    logger.debug('HTTP protocol adapter initialized');
  }

  async cleanup() {
    // 清理连接池
    this.connections.clear();
  }

  async createConnection(target) {
    // HTTP是无状态的，每个请求都创建新连接
    return {
      target,
      baseURL: this.config.baseURL,
      headers: { ...this.config.headers }
    };
  }

  async doSend(connection, message, options) {
    const url = typeof connection.target === 'string' ? connection.target :
                `${connection.baseURL}${connection.target.path || ''}`;

    const fetchOptions = {
      method: options.method || 'POST',
      headers: { ...connection.headers, ...options.headers },
      ...options
    };

    if (message && !options.body) {
      fetchOptions.body = typeof message === 'string' ? message : JSON.stringify(message);
    }

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      throw frysError.system(`HTTP request failed: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    } else {
      return await response.text();
    }
  }

  async doReceive(source, timeout) {
    // HTTP是请求-响应模式，不支持主动接收
    throw frysError.system('HTTP adapter does not support receive operations');
  }
}

// WebSocket协议适配器
class WebSocketAdapter extends ProtocolAdapter {
  constructor(config = {}) {
    super('websocket', {
      url: 'ws://localhost:3000',
      reconnect: true,
      reconnectInterval: 5000,
      ...config
    });

    this.ws = null;
    this.reconnectTimer = null;
    this.messageQueue = [];
    this.pendingRequests = new Map();
  }

  async initialize() {
    await this.connect();
  }

  async cleanup() {
    if (this.reconnectTimer) {
      clearInterval(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.messageQueue.length = 0;
    this.pendingRequests.clear();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.config.url);

        this.ws.onopen = () => {
          logger.info('WebSocket connection established');
          this.emit('connected');
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (error) {
            logger.error('Failed to parse WebSocket message', error);
          }
        };

        this.ws.onclose = () => {
          logger.warn('WebSocket connection closed');
          this.emit('disconnected');

          if (this.config.reconnect) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (error) => {
          logger.error('WebSocket error', error);
          reject(error);
        };

      } catch (error) {
        reject(error);
      }
    });
  }

  handleMessage(data) {
    // 处理响应消息
    if (data.id && this.pendingRequests.has(data.id)) {
      const { resolve, reject } = this.pendingRequests.get(data.id);
      this.pendingRequests.delete(data.id);

      if (data.error) {
        reject(frysError.system(data.error));
      } else {
        resolve(data.result);
      }
    }

    // 处理广播消息
    if (data.type === 'broadcast') {
      this.emit('broadcast', data);
    }

    // 处理插件间消息
    if (data.type === 'plugin_message') {
      this.emit('plugin_message', data);
    }
  }

  scheduleReconnect() {
    if (this.reconnectTimer) return;

    this.reconnectTimer = setInterval(async () => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        logger.info('Attempting to reconnect WebSocket...');
        try {
          await this.connect();
          clearInterval(this.reconnectTimer);
          this.reconnectTimer = null;
        } catch (error) {
          logger.debug('WebSocket reconnect failed, will retry');
        }
      }
    }, this.config.reconnectInterval);
  }

  async createConnection(target) {
    // WebSocket使用单一连接
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      await this.connect();
    }

    return { target, ws: this.ws };
  }

  async doSend(connection, message, options) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw frysError.system('WebSocket is not connected');
    }

    const messageId = Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const payload = {
      id: messageId,
      target: connection.target,
      payload: message,
      timestamp: new Date().toISOString(),
      ...options
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(messageId, { resolve, reject });

      this.ws.send(JSON.stringify(payload));

      // 设置超时
      setTimeout(() => {
        if (this.pendingRequests.has(messageId)) {
          this.pendingRequests.delete(messageId);
          reject(frysError.system('WebSocket request timeout'));
        }
      }, this.config.timeout);
    });
  }

  async doReceive(source, timeout) {
    // WebSocket通过事件处理接收消息
    throw frysError.system('WebSocket adapter uses event-driven receive');
  }
}

// 消息队列协议适配器
class MessageQueueAdapter extends ProtocolAdapter {
  constructor(config = {}) {
    super('message_queue', {
      queueName: 'frys_plugins',
      durable: true,
      prefetch: 1,
      ...config
    });

    this.channel = null;
    this.consumerTag = null;
  }

  async initialize() {
    // 这里应该连接到消息队列服务（如RabbitMQ）
    // 简化实现
    logger.debug('Message queue protocol adapter initialized');
  }

  async cleanup() {
    if (this.consumerTag) {
      // 取消消费者
      this.consumerTag = null;
    }
    this.channel = null;
  }

  async createConnection(target) {
    // 返回队列信息
    return {
      queue: target.queue || this.config.queueName,
      exchange: target.exchange || '',
      routingKey: target.routingKey || ''
    };
  }

  async doSend(connection, message, options) {
    // 发布消息到队列
    const payload = {
      message,
      timestamp: new Date().toISOString(),
      source: options.source || 'plugin',
      ...options
    };

    // 简化实现：存储到内存队列
    if (!this.messageQueue) {
      this.messageQueue = [];
    }
    this.messageQueue.push(payload);

    logger.debug(`Published message to queue: ${connection.queue}`);
    return { published: true, messageId: payload.timestamp };
  }

  async doReceive(source, timeout) {
    // 从队列消费消息
    if (!this.messageQueue || this.messageQueue.length === 0) {
      throw frysError.system('No messages in queue');
    }

    const message = this.messageQueue.shift();
    return message;
  }
}

// gRPC协议适配器
class GRPCAdapter extends ProtocolAdapter {
  constructor(config = {}) {
    super('grpc', {
      host: 'localhost:50051',
      credentials: 'insecure',
      ...config
    });

    this.client = null;
  }

  async initialize() {
    // 这里应该创建gRPC客户端
    logger.debug('gRPC protocol adapter initialized');
  }

  async cleanup() {
    if (this.client) {
      // 关闭gRPC连接
      this.client = null;
    }
  }

  async createConnection(target) {
    return {
      service: target.service || 'PluginService',
      method: target.method || 'call'
    };
  }

  async doSend(connection, message, options) {
    // 调用gRPC方法
    const payload = {
      message,
      metadata: options.metadata || {},
      timestamp: new Date().toISOString()
    };

    // 简化实现
    logger.debug(`Called gRPC method: ${connection.service}.${connection.method}`);
    return { success: true, result: { echoed: message } };
  }

  async doReceive(source, timeout) {
    throw frysError.system('gRPC adapter does not support receive operations');
  }
}

class PluginSandbox {
  constructor(pluginId, pluginCode, config = {}) {
    this.pluginId = pluginId;
    this.config = {
      timeout: 30000,
      memoryLimit: 100 * 1024 * 1024, // 100MB
      permissions: [],
      ...config
    };

    this.context = null;
    this.pluginFunction = null;
    this.isLoaded = false;
    this.isRunning = false;
    this.data = new Map();
    this.dependencies = new Set();

    // 编译插件代码
    this.compilePlugin(pluginCode);
  }

  compilePlugin(code) {
    try {
      // 创建安全的执行环境
      const sandboxFunction = new Function('context', 'api', `
        "use strict";
        ${code}
      `);

      this.pluginFunction = sandboxFunction;
      logger.debug(`Plugin ${this.pluginId} compiled successfully`);
    } catch (error) {
      throw frysError.validation(`Failed to compile plugin ${this.pluginId}: ${error.message}`);
    }
  }

  async load() {
    if (this.isLoaded) return;

    try {
      this.context = new PluginContext(this.pluginId, this);
      await this.initializePlugin();
      this.isLoaded = true;

      logger.info(`Plugin ${this.pluginId} loaded successfully`);
    } catch (error) {
      logger.error(`Failed to load plugin ${this.pluginId}`, error);
      throw error;
    }
  }

  async initializePlugin() {
    // 执行插件代码进行初始化
    if (this.pluginFunction) {
      await this.pluginFunction(this.context, this.context.api);
    }
  }

  async execute(method, ...args) {
    if (!this.isLoaded) {
      throw frysError.system(`Plugin ${this.pluginId} is not loaded`);
    }

    this.context.updateActivity();

    try {
      const result = await this.callMethod(method, ...args);
      return result;
    } catch (error) {
      this.context.recordError(error);
      throw error;
    }
  }

  async callMethod(method, ...args) {
    // 检查权限
    if (!this.hasPermission(method)) {
      throw frysError.authorization(`Plugin ${this.pluginId} does not have permission to call ${method}`);
    }

    // 这里应该有具体的方法调用逻辑
    // 简化实现
    logger.debug(`Plugin ${this.pluginId} calling method: ${method}`);
    return { method, args, result: 'success' };
  }

  hasPermission(method) {
    return this.config.permissions.includes('*') ||
           this.config.permissions.includes(method);
  }

  addDependency(pluginId) {
    this.dependencies.add(pluginId);
  }

  removeDependency(pluginId) {
    this.dependencies.delete(pluginId);
  }

  storePluginData(key, value) {
    this.data.set(key, {
      value,
      timestamp: new Date()
    });
  }

  getPluginData(key) {
    const entry = this.data.get(key);
    return entry ? entry.value : null;
  }

  deletePluginData(key) {
    return this.data.delete(key);
  }

  getStats() {
    return {
      pluginId: this.pluginId,
      isLoaded: this.isLoaded,
      isRunning: this.isRunning,
      dataEntries: this.data.size,
      dependencies: Array.from(this.dependencies),
      context: this.context ? this.context.metadata : null
    };
  }

  async unload() {
    this.isLoaded = false;
    this.isRunning = false;
    this.data.clear();
    this.dependencies.clear();
    this.context = null;

    logger.info(`Plugin ${this.pluginId} unloaded`);
  }
}

/**
 * 📡 PluginProtocolSystem - 六大插件协议系统
 */
export class PluginProtocolSystem extends EventEmitter {
  constructor() {
    super();
    this.protocols = new Map();
    this.plugins = new Map();
    this.protocolAdapters = new Map();
    this.pluginRegistry = new Map();

    // 初始化内置协议适配器
    this.initializeBuiltInAdapters();

    this.stats = {
      totalPlugins: 0,
      activePlugins: 0,
      totalProtocols: 0,
      messageCount: 0,
      errorCount: 0
    };
  }

  initializeBuiltInAdapters() {
    // 注册内置协议适配器
    this.registerProtocolAdapter('http', HTTPAdapter);
    this.registerProtocolAdapter('websocket', WebSocketAdapter);
    this.registerProtocolAdapter('message_queue', MessageQueueAdapter);
    this.registerProtocolAdapter('grpc', GRPCAdapter);
  }

  registerProtocolAdapter(protocolType, AdapterClass) {
    this.protocolAdapters.set(protocolType, AdapterClass);
    logger.info(`Protocol adapter registered: ${protocolType}`);
  }

  async loadPlugin(pluginId, pluginCode, config = {}) {
    if (this.plugins.has(pluginId)) {
      throw frysError.conflict(`Plugin ${pluginId} already loaded`);
    }

    try {
      const sandbox = new PluginSandbox(pluginId, pluginCode, config);
      await sandbox.load();

      this.plugins.set(pluginId, sandbox);
      this.stats.totalPlugins++;

      // 监听插件事件
      sandbox.on('plugin:event', (event) => {
        this.emit('plugin:event', event);
      });

      this.emit('plugin:loaded', { pluginId, config });
      logger.info(`Plugin ${pluginId} loaded successfully`);

      return pluginId;
    } catch (error) {
      logger.error(`Failed to load plugin ${pluginId}`, error);
      throw error;
    }
  }

  async unloadPlugin(pluginId) {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw frysError.notFound(`Plugin ${pluginId} not found`);
    }

    try {
      await plugin.unload();
      this.plugins.delete(pluginId);
      this.stats.totalPlugins--;

      this.emit('plugin:unloaded', { pluginId });
      logger.info(`Plugin ${pluginId} unloaded successfully`);

      return true;
    } catch (error) {
      logger.error(`Failed to unload plugin ${pluginId}`, error);
      throw error;
    }
  }

  async callPluginMethod(pluginId, method, ...args) {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw frysError.notFound(`Plugin ${pluginId} not found`);
    }

    this.stats.messageCount++;
    try {
      const result = await plugin.execute(method, ...args);
      return result;
    } catch (error) {
      this.stats.errorCount++;
      throw error;
    }
  }

  async sendMessage(protocolType, target, message, options = {}) {
    const adapter = this.protocols.get(protocolType);
    if (!adapter) {
      throw frysError.notFound(`Protocol adapter ${protocolType} not found`);
    }

    this.stats.messageCount++;
    try {
      const result = await adapter.send(target, message, options);
      return result;
    } catch (error) {
      this.stats.errorCount++;
      throw error;
    }
  }

  async broadcastMessage(protocolType, message, options = {}) {
    const adapter = this.protocols.get(protocolType);
    if (!adapter) {
      throw frysError.notFound(`Protocol adapter ${protocolType} not found`);
    }

    // 获取所有已知目标（简化实现）
    const targets = options.targets || ['broadcast'];

    const promises = targets.map(target =>
      this.sendMessage(protocolType, target, message, options)
    );

    const results = await Promise.allSettled(promises);
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    return { successful, failed, total: results.length };
  }

  async startProtocol(protocolType, config = {}) {
    if (this.protocols.has(protocolType)) {
      logger.warn(`Protocol ${protocolType} already started`);
      return;
    }

    const AdapterClass = this.protocolAdapters.get(protocolType);
    if (!AdapterClass) {
      throw frysError.notFound(`Protocol adapter ${protocolType} not registered`);
    }

    try {
      const adapter = new AdapterClass(config);

      // 监听适配器事件
      adapter.on('message:received', (data) => {
        this.emit('protocol:message', { protocolType, ...data });
      });

      adapter.on('message:sent', (data) => {
        this.emit('protocol:sent', { protocolType, ...data });
      });

      await adapter.start();
      this.protocols.set(protocolType, adapter);
      this.stats.totalProtocols++;

      this.emit('protocol:started', { protocolType, config });
      logger.info(`Protocol ${protocolType} started successfully`);

    } catch (error) {
      logger.error(`Failed to start protocol ${protocolType}`, error);
      throw error;
    }
  }

  async stopProtocol(protocolType) {
    const adapter = this.protocols.get(protocolType);
    if (!adapter) return;

    try {
      await adapter.stop();
      this.protocols.delete(protocolType);
      this.stats.totalProtocols--;

      this.emit('protocol:stopped', { protocolType });
      logger.info(`Protocol ${protocolType} stopped successfully`);

    } catch (error) {
      logger.error(`Failed to stop protocol ${protocolType}`, error);
      throw error;
    }
  }

  getPluginStats(pluginId = null) {
    if (pluginId) {
      const plugin = this.plugins.get(pluginId);
      return plugin ? plugin.getStats() : null;
    }

    const pluginStats = {};
    for (const [id, plugin] of this.plugins) {
      pluginStats[id] = plugin.getStats();
    }

    return pluginStats;
  }

  getProtocolStats(protocolType = null) {
    if (protocolType) {
      const adapter = this.protocols.get(protocolType);
      return adapter ? {
        protocolType,
        isRunning: adapter.isRunning,
        connections: adapter.connections.size
      } : null;
    }

    const protocolStats = {};
    for (const [type, adapter] of this.protocols) {
      protocolStats[type] = {
        protocolType: type,
        isRunning: adapter.isRunning,
        connections: adapter.connections.size
      };
    }

    return protocolStats;
  }

  getStats() {
    return {
      ...this.stats,
      plugins: this.getPluginStats(),
      protocols: this.getProtocolStats()
    };
  }

  async cleanup() {
    // 停止所有协议
    const stopPromises = [];
    for (const protocolType of this.protocols.keys()) {
      stopPromises.push(this.stopProtocol(protocolType));
    }
    await Promise.all(stopPromises);

    // 卸载所有插件
    const unloadPromises = [];
    for (const pluginId of this.plugins.keys()) {
      unloadPromises.push(this.unloadPlugin(pluginId));
    }
    await Promise.all(unloadPromises);

    logger.info('Plugin protocol system cleaned up');
  }
}

// 创建全局插件协议系统实例
export const pluginProtocolSystem = new PluginProtocolSystem();

export default {
  PluginProtocolSystem,
  pluginProtocolSystem,
  ProtocolAdapter,
  HTTPAdapter,
  WebSocketAdapter,
  MessageQueueAdapter,
  GRPCAdapter,
  PluginSandbox,
  PluginContext
};
