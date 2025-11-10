import { logger } from '../shared/utils/logger.js';

/**
 * OpenAPIInspiredDocs 风格的系统
 * 借鉴 OpenAPI 的核心理念
 */
class OpenAPIInspiredDocs {
  /**
   * 构造函数
   * 初始化OpenAPIInspiredDocs管理器
   */
  constructor() {
    this.specs = new Map(); // OpenAPI规范
    this.paths = new Map(); // API路径
    this.components = new Map(); // 组件定义
    this.servers = []; // 服务器列表
    this.generated = new Map(); // 生成的代码
  }

  /**
   * 添加API路径
   * @param {string} method - HTTP方法
   * @param {string} path - API路径
   * @param {Object} spec - 路径规范
   */
  addPath(method, path, spec) {
    const pathKey = `${method}:${path}`;
    this.paths.set(pathKey, spec);
    logger.info(`📄 API路径已添加: ${pathKey}`);
  }

  /**
   * 添加组件
   * @param {string} name - 组件名称
   * @param {Object} component - 组件定义
   */
  addComponent(name, component) {
    this.components.set(name, component);
    logger.info(`🧩 组件已添加: ${name}`);
  }

  /**
   * 添加服务器
   * @param {Object} server - 服务器配置
   */
  addServer(server) {
    this.servers.push(server);
    logger.info(`🖥️ 服务器已添加: ${server.url}`);
  }

  /**
   * 生成OpenAPI规范
   * @returns {Object} OpenAPI规范对象
   */
  generateSpec() {
    const spec = {
      openapi: '3.0.0',
      info: {
        title: 'frys API',
        version: '1.0.0',
      },
      servers: this.servers,
      paths: {},
      components: {
        schemas: Object.fromEntries(this.components),
      },
    };

    // 转换路径格式
    for (const [pathKey, pathSpec] of this.paths) {
      const [method, path] = pathKey.split(':');
      if (!spec.paths[path]) {
        spec.paths[path] = {};
      }
      spec.paths[path][method.toLowerCase()] = pathSpec;
    }

    logger.info(`📋 OpenAPI规范已生成`);
    return spec;
  }

  /**
   * 获取统计信息
   * @returns {Object} 统计数据
   */
  getStats() {
    return {
      paths: this.paths.size,
      components: this.components.size,
      servers: this.servers.length,
    };
  }
}

export default OpenAPIInspiredDocs;
