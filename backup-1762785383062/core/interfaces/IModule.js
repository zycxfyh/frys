/**
 * 模块接口定义
 * 定义所有模块必须实现的标准化接口
 */

export class IModule {
  /**
   * 获取模块名称
   * @returns {string}
   */
  get name() {
    throw new Error('IModule.name must be implemented');
  }

  /**
   * 获取模块版本
   * @returns {string}
   */
  get version() {
    throw new Error('IModule.version must be implemented');
  }

  /**
   * 获取模块依赖
   * @returns {Array<{name: string, version?: string, optional?: boolean}>}
   */
  get dependencies() {
    throw new Error('IModule.dependencies must be implemented');
  }

  /**
   * 初始化模块
   * @param {Object} config - 模块配置
   * @param {Object} context - 运行时上下文
   * @returns {Promise<void>}
   */
  async initialize(config, context) {
    throw new Error('IModule.initialize must be implemented');
  }

  /**
   * 启动模块
   * @returns {Promise<void>}
   */
  async start() {
    throw new Error('IModule.start must be implemented');
  }

  /**
   * 停止模块
   * @returns {Promise<void>}
   */
  async stop() {
    throw new Error('IModule.stop must be implemented');
  }

  /**
   * 销毁模块
   * @returns {Promise<void>}
   */
  async destroy() {
    throw new Error('IModule.destroy must be implemented');
  }

  /**
   * 获取模块健康状态
   * @returns {Promise<{healthy: boolean, status: string, details?: Object}>}
   */
  async getHealthStatus() {
    throw new Error('IModule.getHealthStatus must be implemented');
  }

  /**
   * 获取模块统计信息
   * @returns {Object}
   */
  getStats() {
    throw new Error('IModule.getStats must be implemented');
  }

  /**
   * 处理模块事件
   * @param {string} event - 事件名称
   * @param {*} data - 事件数据
   * @returns {Promise<void>}
   */
  async handleEvent(event, data) {
    // 默认实现：忽略事件
  }

  /**
   * 获取模块配置模式
   * @returns {Object}
   */
  static get configSchema() {
    return {};
  }

  /**
   * 获取模块元数据
   * @returns {Object}
   */
  static get metadata() {
    return {
      name: 'unknown',
      version: '1.0.0',
      description: '',
      author: '',
      license: '',
      repository: '',
      keywords: [],
      engines: {},
      os: [],
      cpu: []
    };
  }
}

/**
 * 服务接口定义
 */
export class IService {
  /**
   * 获取服务名称
   * @returns {string}
   */
  get name() {
    throw new Error('IService.name must be implemented');
  }

  /**
   * 获取服务类型
   * @returns {string}
   */
  get type() {
    throw new Error('IService.type must be implemented');
  }

  /**
   * 检查服务是否可用
   * @returns {boolean}
   */
  get isAvailable() {
    throw new Error('IService.isAvailable must be implemented');
  }

  /**
   * 执行服务操作
   * @param {string} operation - 操作名称
   * @param {*} params - 操作参数
   * @returns {Promise<*>}
   */
  async execute(operation, params) {
    throw new Error('IService.execute must be implemented');
  }

  /**
   * 获取服务配置
   * @returns {Object}
   */
  getConfig() {
    throw new Error('IService.getConfig must be implemented');
  }

  /**
   * 更新服务配置
   * @param {Object} config - 新配置
   * @returns {Promise<void>}
   */
  async updateConfig(config) {
    throw new Error('IService.updateConfig must be implemented');
  }
}

/**
 * 插件接口定义
 */
export class IPlugin {
  /**
   * 获取插件名称
   * @returns {string}
   */
  get name() {
    throw new Error('IPlugin.name must be implemented');
  }

  /**
   * 获取插件版本
   * @returns {string}
   */
  get version() {
    throw new Error('IPlugin.version must be implemented');
  }

  /**
   * 激活插件
   * @param {Object} context - 插件上下文
   * @returns {Promise<void>}
   */
  async activate(context) {
    throw new Error('IPlugin.activate must be implemented');
  }

  /**
   * 停用插件
   * @returns {Promise<void>}
   */
  async deactivate() {
    throw new Error('IPlugin.deactivate must be implemented');
  }

  /**
   * 获取插件配置
   * @returns {Object}
   */
  getConfig() {
    throw new Error('IPlugin.getConfig must be implemented');
  }

  /**
   * 更新插件配置
   * @param {Object} config - 新配置
   * @returns {Promise<void>}
   */
  async updateConfig(config) {
    throw new Error('IPlugin.updateConfig must be implemented');
  }

  /**
   * 处理插件钩子
   * @param {string} hook - 钩子名称
   * @param {*} data - 钩子数据
   * @returns {Promise<*>}
   */
  async handleHook(hook, data) {
    // 默认实现：直接返回数据
    return data;
  }
}

/**
 * 适配器接口定义
 */
export class IAdapter {
  /**
   * 获取适配器名称
   * @returns {string}
   */
  get name() {
    throw new Error('IAdapter.name must be implemented');
  }

  /**
   * 获取适配器类型
   * @returns {string}
   */
  get type() {
    throw new Error('IAdapter.type must be implemented');
  }

  /**
   * 连接到目标系统
   * @param {Object} config - 连接配置
   * @returns {Promise<void>}
   */
  async connect(config) {
    throw new Error('IAdapter.connect must be implemented');
  }

  /**
   * 断开连接
   * @returns {Promise<void>}
   */
  async disconnect() {
    throw new Error('IAdapter.disconnect must be implemented');
  }

  /**
   * 发送数据
   * @param {*} data - 要发送的数据
   * @returns {Promise<void>}
   */
  async send(data) {
    throw new Error('IAdapter.send must be implemented');
  }

  /**
   * 接收数据
   * @param {Function} callback - 数据处理回调
   * @returns {Promise<void>}
   */
  async receive(callback) {
    throw new Error('IAdapter.receive must be implemented');
  }

  /**
   * 检查连接状态
   * @returns {boolean}
   */
  get isConnected() {
    throw new Error('IAdapter.isConnected must be implemented');
  }
}

/**
 * 中间件接口定义
 */
export class IMiddleware {
  /**
   * 获取中间件名称
   * @returns {string}
   */
  get name() {
    throw new Error('IMiddleware.name must be implemented');
  }

  /**
   * 获取中间件优先级
   * @returns {number}
   */
  get priority() {
    return 0; // 默认优先级
  }

  /**
   * 处理请求/响应
   * @param {*} input - 输入数据
   * @param {Function} next - 下一个中间件
   * @returns {Promise<*>}
   */
  async handle(input, next) {
    throw new Error('IMiddleware.handle must be implemented');
  }

  /**
   * 初始化中间件
   * @param {Object} config - 配置对象
   * @returns {Promise<void>}
   */
  async initialize(config) {
    // 默认实现：无操作
  }

  /**
   * 销毁中间件
   * @returns {Promise<void>}
   */
  async destroy() {
    // 默认实现：无操作
  }
}

/**
 * 钩子接口定义
 */
export class IHook {
  /**
   * 获取钩子名称
   * @returns {string}
   */
  get name() {
    throw new Error('IHook.name must be implemented');
  }

  /**
   * 执行钩子
   * @param {*} data - 钩子数据
   * @param {Object} context - 执行上下文
   * @returns {Promise<*>}
   */
  async execute(data, context) {
    throw new Error('IHook.execute must be implemented');
  }

  /**
   * 获取钩子优先级
   * @returns {number}
   */
  get priority() {
    return 0;
  }

  /**
   * 检查钩子是否应该执行
   * @param {*} data - 钩子数据
   * @param {Object} context - 执行上下文
   * @returns {boolean}
   */
  shouldExecute(data, context) {
    return true; // 默认总是执行
  }
}

/**
 * 存储接口定义
 */
export class IStorage {
  /**
   * 获取存储类型
   * @returns {string}
   */
  get type() {
    throw new Error('IStorage.type must be implemented');
  }

  /**
   * 存储数据
   * @param {string} key - 键
   * @param {*} value - 值
   * @param {Object} options - 存储选项
   * @returns {Promise<void>}
   */
  async set(key, value, options = {}) {
    throw new Error('IStorage.set must be implemented');
  }

  /**
   * 获取数据
   * @param {string} key - 键
   * @returns {Promise<*>}
   */
  async get(key) {
    throw new Error('IStorage.get must be implemented');
  }

  /**
   * 删除数据
   * @param {string} key - 键
   * @returns {Promise<boolean>}
   */
  async delete(key) {
    throw new Error('IStorage.delete must be implemented');
  }

  /**
   * 检查键是否存在
   * @param {string} key - 键
   * @returns {Promise<boolean>}
   */
  async exists(key) {
    throw new Error('IStorage.exists must be implemented');
  }

  /**
   * 获取所有键
   * @param {string} pattern - 键模式
   * @returns {Promise<Array<string>>}
   */
  async keys(pattern = '*') {
    throw new Error('IStorage.keys must be implemented');
  }

  /**
   * 清空存储
   * @returns {Promise<void>}
   */
  async clear() {
    throw new Error('IStorage.clear must be implemented');
  }

  /**
   * 获取存储统计信息
   * @returns {Promise<Object>}
   */
  async getStats() {
    throw new Error('IStorage.getStats must be implemented');
  }
}
