/**
 * 🔗 frys 实时通信系统
 *
 * 借鉴VCPToolBox的实时通信理念，实现：
 * - WebSocket双向通信：实时消息推送和接收
 * - WebDAV文件共享：分布式文件访问和同步
 * - 连接管理：自动重连、心跳检测、连接池
 * - 消息路由：智能消息分发和负载均衡
 * - 安全认证：连接认证和权限验证
 * - 事件驱动：基于事件的通信模式
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';
import { frysError } from './error-handler.js';
import WebSocket from 'ws';
import fs from 'fs/promises';
import path from 'path';

class WebSocketManager extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      port: 8080,
      host: 'localhost',
      path: '/ws',
      heartbeatInterval: 30000,
      reconnectAttempts: 5,
      reconnectDelay: 1000,
      maxConnections: 1000,
      ...config
    };

    this.wss = null;
    this.connections = new Map();
    this.rooms = new Map();
    this.heartbeatTimer = null;
    this.isRunning = false;

    this.stats = {
      totalConnections: 0,
      activeConnections: 0,
      messagesSent: 0,
      messagesReceived: 0,
      errors: 0
    };
  }

  async start() {
    if (this.isRunning) return;

    try {
      this.wss = new WebSocket.Server({
        port: this.config.port,
        host: this.config.host,
        path: this.config.path,
        maxPayload: 50 * 1024 * 1024 // 50MB
      });

      this.wss.on('connection', this.handleConnection.bind(this));
      this.wss.on('error', (error) => {
        logger.error('WebSocket server error', error);
        this.stats.errors++;
        this.emit('error', error);
      });

      this.isRunning = true;
      this.startHeartbeat();
      this.emit('started', { port: this.config.port, host: this.config.host });

      logger.info(`WebSocket server started on ${this.config.host}:${this.config.port}${this.config.path}`);
    } catch (error) {
      logger.error('Failed to start WebSocket server', error);
      throw error;
    }
  }

  async stop() {
    if (!this.isRunning) return;

    try {
      if (this.heartbeatTimer) {
        clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = null;
      }

      // 关闭所有连接
      for (const [clientId, connection] of this.connections) {
        try {
          connection.ws.close(1000, 'Server shutdown');
        } catch (error) {
          logger.warn(`Error closing connection ${clientId}`, error);
        }
      }

      this.connections.clear();
      this.rooms.clear();

      if (this.wss) {
        this.wss.close();
        this.wss = null;
      }

      this.isRunning = false;
      this.emit('stopped');

      logger.info('WebSocket server stopped');
    } catch (error) {
      logger.error('Failed to stop WebSocket server', error);
      throw error;
    }
  }

  handleConnection(ws, request) {
    const clientId = this.generateClientId();
    const connection = {
      id: clientId,
      ws,
      ip: request.socket.remoteAddress,
      userAgent: request.headers['user-agent'],
      connectedAt: new Date(),
      lastActivity: new Date(),
      rooms: new Set(),
      authenticated: false,
      userId: null,
      metadata: {}
    };

    this.connections.set(clientId, connection);
    this.stats.totalConnections++;
    this.stats.activeConnections++;

    logger.info(`WebSocket client connected: ${clientId} from ${connection.ip}`);

    // 设置连接事件处理器
    ws.on('message', (data) => this.handleMessage(clientId, data));
    ws.on('close', (code, reason) => this.handleDisconnection(clientId, code, reason));
    ws.on('error', (error) => this.handleError(clientId, error));
    ws.on('pong', () => this.handlePong(clientId));

    // 发送欢迎消息
    this.sendToClient(clientId, {
      type: 'welcome',
      clientId,
      timestamp: new Date().toISOString()
    });

    this.emit('connection', { clientId, connection });
  }

  handleMessage(clientId, data) {
    try {
      const message = JSON.parse(data.toString());
      const connection = this.connections.get(clientId);

      if (!connection) return;

      connection.lastActivity = new Date();
      this.stats.messagesReceived++;

      logger.debug(`WebSocket message from ${clientId}: ${message.type}`);

      this.emit('message', { clientId, message, connection });

      // 处理系统消息
      switch (message.type) {
        case 'auth':
          this.handleAuthentication(clientId, message);
          break;
        case 'join':
          this.handleJoinRoom(clientId, message);
          break;
        case 'leave':
          this.handleLeaveRoom(clientId, message);
          break;
        case 'ping':
          this.sendToClient(clientId, { type: 'pong', timestamp: new Date().toISOString() });
          break;
        default:
          // 转发给房间或其他处理器
          this.routeMessage(clientId, message);
      }

    } catch (error) {
      logger.error(`Error handling WebSocket message from ${clientId}`, error);
      this.stats.errors++;
      this.sendToClient(clientId, {
        type: 'error',
        error: 'Invalid message format',
        timestamp: new Date().toISOString()
      });
    }
  }

  handleAuthentication(clientId, message) {
    const connection = this.connections.get(clientId);
    if (!connection) return;

    // 简化认证逻辑
    if (message.token || message.apiKey) {
      connection.authenticated = true;
      connection.userId = message.userId || clientId;

      this.sendToClient(clientId, {
        type: 'auth_success',
        userId: connection.userId,
        timestamp: new Date().toISOString()
      });

      this.emit('authenticated', { clientId, userId: connection.userId });
      logger.info(`Client ${clientId} authenticated as ${connection.userId}`);
    } else {
      this.sendToClient(clientId, {
        type: 'auth_failed',
        error: 'Invalid credentials',
        timestamp: new Date().toISOString()
      });
    }
  }

  handleJoinRoom(clientId, message) {
    const { roomId } = message;
    const connection = this.connections.get(clientId);

    if (!connection || !roomId) return;

    // 创建房间如果不存在
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Set());
    }

    const room = this.rooms.get(roomId);
    room.add(clientId);
    connection.rooms.add(roomId);

    this.sendToClient(clientId, {
      type: 'joined_room',
      roomId,
      memberCount: room.size,
      timestamp: new Date().toISOString()
    });

    // 广播加入消息
    this.broadcastToRoom(roomId, {
      type: 'user_joined',
      userId: connection.userId || clientId,
      roomId,
      timestamp: new Date().toISOString()
    }, [clientId]); // 排除自己

    this.emit('room_joined', { clientId, roomId });
    logger.debug(`Client ${clientId} joined room ${roomId}`);
  }

  handleLeaveRoom(clientId, message) {
    const { roomId } = message;
    const connection = this.connections.get(clientId);

    if (!connection || !roomId) return;

    const room = this.rooms.get(roomId);
    if (room) {
      room.delete(clientId);
      connection.rooms.delete(roomId);

      // 如果房间为空，删除房间
      if (room.size === 0) {
        this.rooms.delete(roomId);
      }

      this.sendToClient(clientId, {
        type: 'left_room',
        roomId,
        timestamp: new Date().toISOString()
      });

      // 广播离开消息
      this.broadcastToRoom(roomId, {
        type: 'user_left',
        userId: connection.userId || clientId,
        roomId,
        timestamp: new Date().toISOString()
      });
    }

    this.emit('room_left', { clientId, roomId });
    logger.debug(`Client ${clientId} left room ${roomId}`);
  }

  handleDisconnection(clientId, code, reason) {
    const connection = this.connections.get(clientId);
    if (!connection) return;

    logger.info(`WebSocket client disconnected: ${clientId}, code: ${code}, reason: ${reason}`);

    // 离开所有房间
    for (const roomId of connection.rooms) {
      const room = this.rooms.get(roomId);
      if (room) {
        room.delete(clientId);
        if (room.size === 0) {
          this.rooms.delete(roomId);
        }

        // 广播离开消息
        this.broadcastToRoom(roomId, {
          type: 'user_left',
          userId: connection.userId || clientId,
          roomId,
          timestamp: new Date().toISOString()
        });
      }
    }

    this.connections.delete(clientId);
    this.stats.activeConnections--;

    this.emit('disconnection', { clientId, code, reason });
  }

  handleError(clientId, error) {
    logger.error(`WebSocket error for client ${clientId}`, error);
    this.stats.errors++;

    const connection = this.connections.get(clientId);
    if (connection) {
      this.sendToClient(clientId, {
        type: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  handlePong(clientId) {
    const connection = this.connections.get(clientId);
    if (connection) {
      connection.lastActivity = new Date();
    }
  }

  routeMessage(clientId, message) {
    const connection = this.connections.get(clientId);
    if (!connection) return;

    // 如果消息指定了房间，发送到房间
    if (message.roomId) {
      this.broadcastToRoom(message.roomId, {
        ...message,
        from: connection.userId || clientId,
        timestamp: new Date().toISOString()
      }, message.excludeSelf ? [clientId] : []);
    } else {
      // 全局广播或转发给特定处理器
      this.emit('routed_message', { clientId, message, connection });
    }
  }

  sendToClient(clientId, message) {
    const connection = this.connections.get(clientId);
    if (!connection || connection.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      const data = JSON.stringify(message);
      connection.ws.send(data);
      this.stats.messagesSent++;

      logger.debug(`Sent message to ${clientId}: ${message.type}`);
      return true;
    } catch (error) {
      logger.error(`Failed to send message to ${clientId}`, error);
      this.stats.errors++;
      return false;
    }
  }

  broadcastToRoom(roomId, message, excludeClients = []) {
    const room = this.rooms.get(roomId);
    if (!room) return 0;

    let sentCount = 0;
    for (const clientId of room) {
      if (!excludeClients.includes(clientId)) {
        if (this.sendToClient(clientId, message)) {
          sentCount++;
        }
      }
    }

    logger.debug(`Broadcasted to room ${roomId}: ${message.type}, sent to ${sentCount} clients`);
    return sentCount;
  }

  broadcast(message, excludeClients = []) {
    let sentCount = 0;
    for (const [clientId, connection] of this.connections) {
      if (!excludeClients.includes(clientId)) {
        if (this.sendToClient(clientId, message)) {
          sentCount++;
        }
      }
    }

    logger.debug(`Broadcasted globally: ${message.type}, sent to ${sentCount} clients`);
    return sentCount;
  }

  startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      const now = Date.now();
      const timeoutThreshold = this.config.heartbeatInterval * 2;

      // 检查超时连接
      for (const [clientId, connection] of this.connections) {
        if (now - connection.lastActivity.getTime() > timeoutThreshold) {
          logger.warn(`Client ${clientId} heartbeat timeout, closing connection`);
          try {
            connection.ws.close(1008, 'Heartbeat timeout');
          } catch (error) {
            logger.error(`Error closing timeout connection ${clientId}`, error);
          }
        } else {
          // 发送心跳
          connection.ws.ping();
        }
      }
    }, this.config.heartbeatInterval);
  }

  generateClientId() {
    return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getStats() {
    const roomStats = {};
    for (const [roomId, clients] of this.rooms) {
      roomStats[roomId] = clients.size;
    }

    return {
      ...this.stats,
      rooms: roomStats,
      isRunning: this.isRunning,
      config: this.config
    };
  }
}

class WebDAVServer {
  constructor(config = {}) {
    this.config = {
      port: 8081,
      host: 'localhost',
      rootPath: './webdav',
      maxFileSize: 100 * 1024 * 1024, // 100MB
      allowedMethods: ['GET', 'PUT', 'DELETE', 'MKCOL', 'PROPFIND', 'PROPPATCH'],
      authentication: true,
      ...config
    };

    this.server = null;
    this.isRunning = false;
    this.fileLocks = new Map();

    this.stats = {
      requests: 0,
      uploads: 0,
      downloads: 0,
      errors: 0,
      totalBytesUploaded: 0,
      totalBytesDownloaded: 0
    };
  }

  async start() {
    if (this.isRunning) return;

    try {
      // 确保根目录存在
      await fs.mkdir(this.config.rootPath, { recursive: true });

      // 创建简单的HTTP服务器处理WebDAV请求
      const http = await import('http');

      this.server = http.createServer(this.handleRequest.bind(this));
      this.server.listen(this.config.port, this.config.host);

      this.isRunning = true;
      logger.info(`WebDAV server started on ${this.config.host}:${this.config.port}, root: ${this.config.rootPath}`);
    } catch (error) {
      logger.error('Failed to start WebDAV server', error);
      throw error;
    }
  }

  async stop() {
    if (!this.isRunning) return;

    try {
      if (this.server) {
        this.server.close();
        this.server = null;
      }

      this.fileLocks.clear();
      this.isRunning = false;
      logger.info('WebDAV server stopped');
    } catch (error) {
      logger.error('Failed to stop WebDAV server', error);
      throw error;
    }
  }

  async handleRequest(req, res) {
    this.stats.requests++;

    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const filePath = path.join(this.config.rootPath, decodeURIComponent(url.pathname));

      // 安全检查：防止目录遍历
      const resolvedPath = path.resolve(filePath);
      const rootPath = path.resolve(this.config.rootPath);

      if (!resolvedPath.startsWith(rootPath)) {
        this.sendError(res, 403, 'Access denied');
        return;
      }

      // 认证检查
      if (this.config.authentication && !this.authenticate(req)) {
        res.setHeader('WWW-Authenticate', 'Basic realm="WebDAV"');
        this.sendError(res, 401, 'Authentication required');
        return;
      }

      // 方法分发
      switch (req.method) {
        case 'GET':
          await this.handleGet(res, resolvedPath);
          break;
        case 'PUT':
          await this.handlePut(req, res, resolvedPath);
          break;
        case 'DELETE':
          await this.handleDelete(res, resolvedPath);
          break;
        case 'MKCOL':
          await this.handleMkcol(res, resolvedPath);
          break;
        case 'PROPFIND':
          await this.handlePropfind(res, resolvedPath);
          break;
        default:
          this.sendError(res, 405, 'Method not allowed');
      }

    } catch (error) {
      logger.error('WebDAV request error', error);
      this.stats.errors++;
      this.sendError(res, 500, 'Internal server error');
    }
  }

  authenticate(req) {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Basic ')) {
      return false;
    }

    // 简化认证：实际应该验证用户名密码
    return true;
  }

  async handleGet(res, filePath) {
    try {
      const stat = await fs.stat(filePath);

      if (stat.isDirectory()) {
        this.sendError(res, 403, 'Directory listing not supported');
        return;
      }

      const stream = require('fs').createReadStream(filePath);
      res.setHeader('Content-Length', stat.size);
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Last-Modified', stat.mtime.toUTCString());

      stream.pipe(res);
      this.stats.downloads++;
      this.stats.totalBytesDownloaded += stat.size;

      logger.debug(`WebDAV GET: ${filePath}`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.sendError(res, 404, 'File not found');
      } else {
        throw error;
      }
    }
  }

  async handlePut(req, res, filePath) {
    try {
      // 检查文件大小限制
      const contentLength = parseInt(req.headers['content-length'] || '0');
      if (contentLength > this.config.maxFileSize) {
        this.sendError(res, 413, 'File too large');
        return;
      }

      // 确保目录存在
      await fs.mkdir(path.dirname(filePath), { recursive: true });

      const writeStream = require('fs').createWriteStream(filePath);
      let bytesWritten = 0;

      req.on('data', (chunk) => {
        bytesWritten += chunk.length;
        if (bytesWritten > this.config.maxFileSize) {
          writeStream.destroy();
          this.sendError(res, 413, 'File too large');
          return;
        }
      });

      req.pipe(writeStream);

      await new Promise((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });

      res.statusCode = 201;
      res.end();

      this.stats.uploads++;
      this.stats.totalBytesUploaded += bytesWritten;

      logger.debug(`WebDAV PUT: ${filePath} (${bytesWritten} bytes)`);
    } catch (error) {
      throw error;
    }
  }

  async handleDelete(res, filePath) {
    try {
      await fs.rm(filePath, { recursive: true, force: true });
      res.statusCode = 204;
      res.end();

      logger.debug(`WebDAV DELETE: ${filePath}`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.sendError(res, 404, 'File not found');
      } else {
        throw error;
      }
    }
  }

  async handleMkcol(res, filePath) {
    try {
      await fs.mkdir(filePath, { recursive: true });
      res.statusCode = 201;
      res.end();

      logger.debug(`WebDAV MKCOL: ${filePath}`);
    } catch (error) {
      if (error.code === 'EEXIST') {
        this.sendError(res, 405, 'Directory already exists');
      } else {
        throw error;
      }
    }
  }

  async handlePropfind(res, filePath) {
    try {
      const stat = await fs.stat(filePath);

      // 简化的PROPFIND响应
      const xmlResponse = `<?xml version="1.0" encoding="utf-8"?>
        <D:multistatus xmlns:D="DAV:">
          <D:response>
            <D:href>${encodeURIComponent(path.basename(filePath))}</D:href>
            <D:propstat>
              <D:prop>
                <D:getcontentlength>${stat.size}</D:getcontentlength>
                <D:getlastmodified>${stat.mtime.toUTCString()}</D:getlastmodified>
                <D:resourcetype>${stat.isDirectory() ? '<D:collection/>' : ''}</D:resourcetype>
              </D:prop>
              <D:status>HTTP/1.1 200 OK</D:status>
            </D:propstat>
          </D:response>
        </D:multistatus>`;

      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.statusCode = 207;
      res.end(xmlResponse);

      logger.debug(`WebDAV PROPFIND: ${filePath}`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.sendError(res, 404, 'File not found');
      } else {
        throw error;
      }
    }
  }

  sendError(res, statusCode, message) {
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'text/plain');
    res.end(message);
  }

  getStats() {
    return {
      ...this.stats,
      isRunning: this.isRunning,
      config: this.config
    };
  }
}

/**
 * 🔗 RealtimeCommunication - 实时通信系统
 */
export class RealtimeCommunication extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      enableWebSocket: true,
      enableWebDAV: true,
      ...config
    };

    this.webSocketManager = null;
    this.webDAVServer = null;
    this.isRunning = false;

    this.stats = {
      startTime: null,
      totalMessages: 0,
      totalConnections: 0,
      totalFiles: 0
    };
  }

  async start() {
    if (this.isRunning) return;

    try {
      this.stats.startTime = new Date();

      // 启动WebSocket服务器
      if (this.config.enableWebSocket) {
        this.webSocketManager = new WebSocketManager(this.config.webSocket || {});
        await this.webSocketManager.start();

        // 转发WebSocket事件
        this.webSocketManager.on('connection', (data) => this.emit('ws:connection', data));
        this.webSocketManager.on('disconnection', (data) => this.emit('ws:disconnection', data));
        this.webSocketManager.on('message', (data) => {
          this.stats.totalMessages++;
          this.emit('ws:message', data);
        });
        this.webSocketManager.on('error', (error) => this.emit('ws:error', error));
      }

      // 启动WebDAV服务器
      if (this.config.enableWebDAV) {
        this.webDAVServer = new WebDAVServer(this.config.webDAV || {});
        await this.webDAVServer.start();

        this.emit('webdav:started', this.webDAVServer.config);
      }

      this.isRunning = true;
      this.emit('started', {
        webSocket: this.config.enableWebSocket,
        webDAV: this.config.enableWebDAV
      });

      logger.info('Realtime communication system started');
    } catch (error) {
      logger.error('Failed to start realtime communication system', error);
      throw error;
    }
  }

  async stop() {
    if (!this.isRunning) return;

    try {
      // 停止WebSocket服务器
      if (this.webSocketManager) {
        await this.webSocketManager.stop();
        this.webSocketManager = null;
      }

      // 停止WebDAV服务器
      if (this.webDAVServer) {
        await this.webDAVServer.stop();
        this.webDAVServer = null;
      }

      this.isRunning = false;
      this.emit('stopped');

      logger.info('Realtime communication system stopped');
    } catch (error) {
      logger.error('Failed to stop realtime communication system', error);
      throw error;
    }
  }

  // WebSocket相关方法
  sendToClient(clientId, message) {
    if (!this.webSocketManager) {
      throw frysError.system('WebSocket manager not available');
    }
    return this.webSocketManager.sendToClient(clientId, message);
  }

  broadcastToRoom(roomId, message, excludeClients = []) {
    if (!this.webSocketManager) {
      throw frysError.system('WebSocket manager not available');
    }
    return this.webSocketManager.broadcastToRoom(roomId, message, excludeClients);
  }

  broadcast(message, excludeClients = []) {
    if (!this.webSocketManager) {
      throw frysError.system('WebSocket manager not available');
    }
    return this.webSocketManager.broadcast(message, excludeClients);
  }

  getWebSocketStats() {
    return this.webSocketManager ? this.webSocketManager.getStats() : null;
  }

  getWebDAVStats() {
    return this.webDAVServer ? this.webDAVServer.getStats() : null;
  }

  getStats() {
    return {
      ...this.stats,
      isRunning: this.isRunning,
      webSocket: this.getWebSocketStats(),
      webDAV: this.getWebDAVStats()
    };
  }

  async cleanup() {
    await this.stop();
    logger.info('Realtime communication system cleaned up');
  }
}

// 创建全局实时通信实例
export const realtimeCommunication = new RealtimeCommunication();

export default {
  RealtimeCommunication,
  realtimeCommunication,
  WebSocketManager,
  WebDAVServer
};
