/**
 * 示例插件 - 演示热加载功能
 */
import { PluginInterface } from '../src/core/PluginManager.js';

export default class ExamplePlugin extends PluginInterface {
  constructor() {
    super();
    this.name = 'example-plugin';
    this.version = '1.0.0';
    this.description = '示例插件，演示热加载功能';
    this.dependencies = [];
  }

  async install(context) {
    console.log('🔧 安装示例插件...');
    // 插件安装逻辑
  }

  async start(context) {
    console.log('🚀 启动示例插件...');
    console.log(`插件上下文: ${JSON.stringify(context.plugin, null, 2)}`);

    // 注册钩子
    context.manager.hook('app:start', async () => {
      console.log('🎯 示例插件钩子被触发: app:start');
    });

    // 注册中间件
    context.manager.middleware('request', async (req, next) => {
      console.log('📨 示例插件中间件处理请求');
      return await next();
    });

    // 注册扩展
    context.manager.extend(
      'logger',
      {
        logExample: (message) => {
          console.log(`📝 [示例插件] ${message}`);
        },
      },
      this.name,
    );
  }

  async stop(context) {
    console.log('🛑 停止示例插件...');
  }

  async uninstall(context) {
    console.log('💥 卸载示例插件...');
  }

  getConfig() {
    return {
      enabled: true,
      features: ['logging', 'middleware', 'hooks'],
    };
  }
}
