/**
 * 基础模块类
 * 为所有模块提供通用的生命周期管理和配置
 */

import { logger } from '../shared/utils/logger.js';
import { frysError } from './error-handler.js';

/**
 * 基础模块类
 * 提供模块生命周期管理和配置管理
 */
export class BaseModule {
  constructor(config = {}) {
    this.config = { ...this.getDefaultConfig(), ...config };
    this.initialized = false;
    this.name = this.constructor.name;
    this.logger = logger.child({ module: this.name });

    this.logger.info(`${this.name} module created`, { config: this.config });
  }

  /**
   * 获取默认配置
   */
  getDefaultConfig() {
    return {
      enabled: true,
      debug: false,
      timeout: 30000,
    };
  }

  /**
   * 初始化模块
   */
  initialize() {
    try {
      if (this.initialized) {
        this.logger.warn(`${this.name} already initialized`);
        return;
      }

      this.onInitialize();
      this.initialized = true;
      this.logger.info(`${this.name} initialized successfully`);
    } catch (error) {
      this.logger.error(`${this.name} initialization failed`, {
        error: error.message,
      });
      throw frysError.system(
        `${this.name} initialization failed: ${error.message}`,
        'module_init_failed',
        { originalError: error },
      );
    }
  }

  /**
   * 销毁模块
   */
  async destroy() {
    try {
      await this.onDestroy();
      this.initialized = false;
      this.logger.info(`${this.name} destroyed successfully`);
    } catch (error) {
      this.logger.error(`${this.name} destruction failed`, {
        error: error.message,
      });
      throw frysError.system(
        `${this.name} destruction failed: ${error.message}`,
        'module_destroy_failed',
        { originalError: error },
      );
    }
  }

  /**
   * 检查模块是否已初始化
   */
  isInitialized() {
    return this.initialized;
  }

  /**
   * 获取模块配置
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * 更新模块配置
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    this.logger.info(`${this.name} configuration updated`, {
      config: this.config,
    });
  }

  /**
   * 获取模块状态
   */
  getStatus() {
    return {
      name: this.name,
      initialized: this.initialized,
      config: this.config,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 子类实现：初始化逻辑
   */
  onInitialize() {
    // 子类实现具体的初始化逻辑
  }

  /**
   * 子类实现：销毁逻辑
   */
  onDestroy() {
    // 子类实现具体的销毁逻辑
  }

  /**
   * 健康检查
   */
  healthCheck() {
    try {
      const status = this.getStatus();
      return {
        healthy: this.initialized,
        status,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 获取模块指标
   */
  getMetrics() {
    return {
      name: this.name,
      initialized: this.initialized,
      uptime: this.initialized
        ? Date.now() - (this._startTime || Date.now())
        : 0,
      config: this.config,
    };
  }

  /**
   * 记录性能指标
   */
  recordMetric(name, value, tags = {}) {
    this.logger.debug(`Metric recorded: ${name}`, { value, tags });
    // 这里可以集成监控系统
  }

  /**
   * 创建子模块
   */
  createSubModule(SubModuleClass, config = {}) {
    const subModule = new SubModuleClass({ ...this.config, ...config });
    subModule.parent = this;
    return subModule;
  }
}
