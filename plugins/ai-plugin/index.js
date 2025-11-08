/**
 * frys AI插件
 * 提供多供应商AI集成功能
 */

import { Plugin } from '../../src/core/PluginManager.js';
import { AIProviderManager } from './src/AIProviderManager.js';
import { registerAIRoutes } from './src/ai-routes.js';

export default class AIPlugin extends Plugin {
  constructor() {
    super();
    this.name = 'AIPlugin';
    this.version = '1.0.0';
    this.aiManager = null;
  }

  async install(context) {
    context.logger.info('[AIPlugin] 安装AI插件...');

    // 初始化AI管理器
    this.aiManager = new AIProviderManager({
      cacheTTL: 3600000, // 1小时
      maxRetries: 3,
      timeout: 30000,
    });

    // 注册到容器
    context.container.register('aiManager', this.aiManager);

    context.logger.info('[AIPlugin] AI插件安装完成');
  }

  async start(context) {
    context.logger.info('[AIPlugin] 启动AI插件...');

    // 注册AI路由
    if (context.app) {
      registerAIRoutes(context.app, { enableDocs: true });
    }

    // 启动AI管理器
    await this.aiManager.start();

    context.logger.info('[AIPlugin] AI插件启动完成');
  }

  async stop(context) {
    context.logger.info('[AIPlugin] 停止AI插件...');

    if (this.aiManager) {
      await this.aiManager.stop();
    }

    context.logger.info('[AIPlugin] AI插件已停止');
  }

  async uninstall(context) {
    context.logger.info('[AIPlugin] 卸载AI插件...');

    // 清理资源
    if (this.aiManager) {
      await this.aiManager.stop();
      this.aiManager = null;
    }

    // 从容器中移除
    context.container.unregister('aiManager');

    context.logger.info('[AIPlugin] AI插件卸载完成');
  }

  // 插件API
  async generateText(prompt, options = {}) {
    if (!this.aiManager) {
      throw new Error('AI插件未启动');
    }
    return await this.aiManager.generateText(prompt, options);
  }

  async analyzeText(text, options = {}) {
    if (!this.aiManager) {
      throw new Error('AI插件未启动');
    }
    return await this.aiManager.analyzeText(text, options);
  }

  async getAvailableModels() {
    if (!this.aiManager) {
      throw new Error('AI插件未启动');
    }
    return this.aiManager.getAvailableModels();
  }
}
