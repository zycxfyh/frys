import { logger } from '../shared/utils/logger.js';

/**
 * ViteInspiredBuild 风格的系统
 * 借鉴 Vite 的核心理念
 */
class ViteInspiredBuild {
  /**
   * 构造函数
   * 初始化ViteInspiredBuild管理器
   */
  constructor() {
    this.configs = new Map(); // 配置
    this.plugins = new Map(); // 插件
    this.devServer = null; // 开发服务器
    this.builds = []; // 构建历史
  }

  /**
   * 配置构建
   * @param {string} name - 配置名称
   * @param {Object} config - 构建配置
   */
  configure(name, config) {
    this.configs.set(name, config);
    logger.info(`⚙️ 构建配置已设置: ${name}`);
  }

  /**
   * 添加插件
   * @param {string} name - 插件名称
   * @param {Function} plugin - 插件函数
   */
  use(name, plugin) {
    this.plugins.set(name, plugin);
    logger.info(`🔌 构建插件已添加: ${name}`);
  }

  /**
   * 启动开发服务器
   * @param {Object} options - 服务器选项
   */
  async dev(options = {}) {
    logger.info(`🚀 启动开发服务器...`);

    // 模拟开发服务器启动
    this.devServer = {
      port: options.port || 3000,
      host: options.host || 'localhost',
      started: new Date(),
    };

    // 执行插件
    for (const [name, plugin] of this.plugins) {
      try {
        await plugin('dev', this.devServer);
      } catch (error) {
        logger.error(`插件 ${name} 执行失败:`, error);
      }
    }

    logger.info(
      `✅ 开发服务器已启动: http://${this.devServer.host}:${this.devServer.port}`,
    );
    return this.devServer;
  }

  /**
   * 构建生产版本
   * @param {Object} options - 构建选项
   */
  async build(options = {}) {
    logger.info(`🔨 开始构建...`);

    const buildResult = {
      startTime: new Date(),
      output: [],
      errors: [],
      warnings: [],
    };

    try {
      // 执行插件
      for (const [name, plugin] of this.plugins) {
        try {
          const result = await plugin('build', options);
          if (result) {
            buildResult.output.push(...(result.output || []));
            buildResult.warnings.push(...(result.warnings || []));
          }
        } catch (error) {
          buildResult.errors.push(`插件 ${name}: ${error.message}`);
        }
      }

      buildResult.endTime = new Date();
      buildResult.duration = buildResult.endTime - buildResult.startTime;

      this.builds.push(buildResult);

      if (buildResult.errors.length === 0) {
        logger.info(`✅ 构建完成，耗时: ${buildResult.duration}ms`);
      } else {
        logger.error(`❌ 构建失败，错误数量: ${buildResult.errors.length}`);
      }

      return buildResult;
    } catch (error) {
      logger.error('构建过程中发生错误:', error);
      throw error;
    }
  }

  /**
   * 预览构建结果
   * @param {Object} options - 预览选项
   */
  async preview(options = {}) {
    logger.info(`👀 启动预览服务器...`);

    const previewServer = {
      port: options.port || 4173,
      host: options.host || 'localhost',
      build: this.builds[this.builds.length - 1],
    };

    logger.info(
      `✅ 预览服务器已启动: http://${previewServer.host}:${previewServer.port}`,
    );
    return previewServer;
  }

  /**
   * 获取统计信息
   * @returns {Object} 统计数据
   */
  getStats() {
    return {
      configs: this.configs.size,
      plugins: this.plugins.size,
      builds: this.builds.length,
      devServer: this.devServer ? 'running' : 'stopped',
    };
  }
}

export default ViteInspiredBuild;
