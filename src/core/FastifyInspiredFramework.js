/**
 * FastifyInspiredFramework 风格的系统
 * 借鉴 Fastify 的核心理念
 */
class FastifyInspiredFramework {
  /**
   * 构造函数
   * 初始化FastifyInspiredFramework管理器
   */
  constructor() {
    this.apps = new Map(); // 应用实例
    this.routes = new Map(); // 路由
    this.plugins = new Map(); // 插件
    this.hooks = new Map(); // 钩子
  }

  /**
   * 注册路由
   * @param {string} method - HTTP方法
   * @param {string} path - 路径
   * @param {Function} handler - 处理函数
   */
  route(method, path, handler) {
    const routeKey = `${method}:${path}`;
    this.routes.set(routeKey, handler);
    console.log(`🛣️ 路由已注册: ${routeKey}`);
  }

  /**
   * 注册插件
   * @param {string} name - 插件名称
   * @param {Function} plugin - 插件函数
   */
  register(name, plugin) {
    this.plugins.set(name, plugin);
    console.log(`🔌 插件已注册: ${name}`);
  }

  /**
   * 添加钩子
   * @param {string} hook - 钩子名称
   * @param {Function} handler - 处理函数
   */
  addHook(hook, handler) {
    if (!this.hooks.has(hook)) {
      this.hooks.set(hook, []);
    }
    this.hooks.get(hook).push(handler);
    console.log(`🪝 钩子已添加: ${hook}`);
  }

  /**
   * 获取统计信息
   * @returns {Object} 统计数据
   */
  getStats() {
    return {
      routes: this.routes.size,
      plugins: this.plugins.size,
      hooks: this.hooks.size,
    };
  }
}

export default FastifyInspiredFramework;
