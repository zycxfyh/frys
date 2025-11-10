/**
 * Modular System Example - 模块化系统示例
 * 展示如何使用解耦机制构建灵活的系统
 */

import { createLightweightSystem, createFullSystem, createModuleAssembler } from '../src/core/config/module-config.js';
import { ServiceLocator } from '../src/shared/kernel/ServiceLocator.js';
import { DependencyInjector, inject } from '../src/shared/kernel/DependencyInjector.js';

/**
 * 示例1: 使用模块装配器创建轻量级系统
 */
async function exampleLightweightSystem() {
  console.log('🚀 创建轻量级系统...\n');

  const system = await createLightweightSystem();

  // 获取组件
  const logger = system.get('logger');
  const eventBus = system.get('eventBus');
  const config = system.get('config');

  // 使用组件
  logger.info('轻量级系统已启动', { config: config?.app?.name });

  eventBus.on('test-event', (data) => {
    logger.info('收到测试事件', data);
  });

  eventBus.emit('test-event', { message: 'Hello from lightweight system!' });

  // 清理
  await system.destroy();

  console.log('✅ 轻量级系统示例完成\n');
}

/**
 * 示例2: 使用服务定位器进行松耦合组件管理
 */
async function exampleServiceLocator() {
  console.log('🔗 服务定位器示例...\n');

  const locator = new ServiceLocator();

  // 注册服务
  locator.register('logger', console);
  locator.registerFactory('cache', () => new Map());
  locator.registerConstructor('eventEmitter', EventEmitter);

  // 使用服务
  const logger = locator.get('logger');
  const cache = locator.get('cache');
  const emitter = locator.get('eventEmitter');

  logger.info('服务已注册');

  // 使用缓存
  cache.set('user:123', { name: 'John', role: 'admin' });
  logger.info('缓存数据:', cache.get('user:123'));

  // 使用事件发射器
  emitter.on('user-login', (userId) => {
    logger.info(`用户 ${userId} 登录`);
  });

  emitter.emit('user-login', '123');

  console.log('✅ 服务定位器示例完成\n');
}

/**
 * 示例3: 使用依赖注入实现组件解耦
 */
async function exampleDependencyInjection() {
  console.log('💉 依赖注入示例...\n');

  const container = new DependencyInjector();

  // 定义接口和实现
  class ILogger {
    log(message) { }
  }

  class ICache {
    get(key) { }
    set(key, value) { }
  }

  class ConsoleLogger extends ILogger {
    log(message) {
      console.log(`[LOG] ${message}`);
    }
  }

  class MemoryCache extends ICache {
    constructor() {
      super();
      this.data = new Map();
    }

    get(key) {
      return this.data.get(key);
    }

    set(key, value) {
      this.data.set(key, value);
    }
  }

  class UserService {
    @inject('ILogger')
    logger;

    @inject('ICache')
    cache;

    getUser(id) {
      const cached = this.cache.get(`user:${id}`);
      if (cached) {
        this.logger.log(`从缓存获取用户 ${id}`);
        return cached;
      }

      const user = { id, name: `User ${id}`, email: `user${id}@example.com` };
      this.cache.set(`user:${id}`, user);
      this.logger.log(`创建新用户 ${id}`);
      return user;
    }
  }

  // 绑定接口到实现
  container.bind('ILogger', ConsoleLogger);
  container.bind('ICache', MemoryCache);

  // 解析服务
  const userService = container.resolve('UserService');

  // 使用服务
  const user1 = userService.getUser(1);
  const user2 = userService.getUser(1); // 从缓存获取

  console.log('用户1:', user1);
  console.log('用户2:', user2);

  console.log('✅ 依赖注入示例完成\n');
}

/**
 * 示例4: 条件模块加载
 */
async function exampleConditionalModules() {
  console.log('🎛️ 条件模块加载示例...\n');

  // 模拟不同环境的配置
  const environments = [
    { name: 'development', config: { app: { environment: 'development' }, cache: { enabled: true } } },
    { name: 'production', config: { app: { environment: 'production' }, cache: { enabled: false } } },
    { name: 'minimal', config: { app: { environment: 'development' }, cache: { enabled: false } } }
  ];

  for (const { name, config } of environments) {
    console.log(`环境: ${name}`);

    const assembler = createModuleAssembler();
    const { filterModulesByConditions } = await import('../src/core/config/module-config.js');

    const enabledModules = filterModulesByConditions(config);
    console.log(`启用的模块: ${enabledModules.join(', ')}`);

    // 只初始化启用的模块
    await assembler.initialize(enabledModules);

    console.log(`已初始化 ${assembler.getStatus().initialized?.length || 0} 个模块\n`);
  }

  console.log('✅ 条件模块加载示例完成\n');
}

/**
 * 示例5: 插件系统扩展
 */
async function examplePluginSystem() {
  console.log('🔌 插件系统示例...\n');

  const { PluginManager } = await import('../src/core/plugins/PluginManager.js');

  class MetricsPlugin {
    name = 'metrics';
    version = '1.0.0';

    initialize(context) {
      console.log('📊 指标插件已初始化');
      this.context = context;

      // 监听事件
      context.eventBus?.on('request', (data) => {
        this.recordMetric('requests', data);
      });
    }

    recordMetric(name, data) {
      console.log(`📈 记录指标: ${name}`, data);
    }

    destroy() {
      console.log('📊 指标插件已销毁');
    }
  }

  class CachePlugin {
    name = 'cache';
    version = '1.0.0';

    initialize(context) {
      console.log('💾 缓存插件已初始化');
      this.cache = new Map();
    }

    get(key) {
      return this.cache.get(key);
    }

    set(key, value) {
      this.cache.set(key, value);
    }

    destroy() {
      this.cache.clear();
      console.log('💾 缓存插件已销毁');
    }
  }

  const pluginManager = new PluginManager();

  // 注册插件
  pluginManager.register(new MetricsPlugin());
  pluginManager.register(new CachePlugin());

  // 初始化插件
  await pluginManager.initializePlugins();

  // 使用插件
  const cachePlugin = pluginManager.getPlugin('cache');
  cachePlugin.set('test', 'value');
  console.log('缓存值:', cachePlugin.get('test'));

  // 销毁插件
  await pluginManager.destroyPlugins();

  console.log('✅ 插件系统示例完成\n');
}

/**
 * 主函数 - 运行所有示例
 */
async function main() {
  console.log('🎯 frys 模块化系统示例\n');
  console.log('=' .repeat(50));

  try {
    await exampleLightweightSystem();
    console.log('-'.repeat(50));

    await exampleServiceLocator();
    console.log('-'.repeat(50));

    await exampleDependencyInjection();
    console.log('-'.repeat(50));

    await exampleConditionalModules();
    console.log('-'.repeat(50));

    await examplePluginSystem();
    console.log('-'.repeat(50));

    console.log('🎉 所有示例运行完成！');
    console.log('=' .repeat(50));

  } catch (error) {
    console.error('❌ 示例运行失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export {
  exampleLightweightSystem,
  exampleServiceLocator,
  exampleDependencyInjection,
  exampleConditionalModules,
  examplePluginSystem
};
