/**
 * frys 依赖注入容器配置
 * 使用 Awilix 替代自建的 LightweightContainer
 */

import { createContainer, asClass, asFunction, asValue, Lifetime } from 'awilix';
import { logger } from '../utils/logger.js';
import { config } from '../utils/config.js';

// 导入服务
import { WorkflowEngine } from '../services/WorkflowEngine.js';
import { UserService } from '../services/UserService.js';

// 创建 Awilix 容器
const container = createContainer({
  injectionMode: 'CLASSIC', // 使用经典注入模式（构造函数参数）
});

// 注册值类型依赖
container.register({
  config: asValue(config),
  logger: asValue(logger),
});

// 动态导入和注册核心模块
let modulesLoaded = false;
async function loadCoreModules() {
  if (modulesLoaded) return;

  // 动态导入核心模块
  const [
    { default: AxiosInspiredHTTP },
    { default: messagingAdapter },
    { default: ZustandInspiredState },
    { default: JWTInspiredAuth },
    { default: DayJSInspiredDate },
    { default: LodashInspiredUtils },
    { eventSystem },
    { default: errorHandler },
    { default: pluginManager }
  ] = await Promise.all([
    import('./AxiosInspiredHTTP.js'),
    import('./messaging-adapter.js'),
    import('./ZustandInspiredState.js'),
    import('./JWTInspiredAuth.js'),
    import('./DayJSInspiredDate.js'),
    import('./LodashInspiredUtils.js'),
    import('./events.js'),
    import('./error-handler.js'),
    import('./plugin-system.js')
  ]);

  // 注册类类型依赖 - 单例生命周期
  container.register({
    http: asClass(AxiosInspiredHTTP).singleton(),
    messaging: asValue(messagingAdapter),
    state: asClass(ZustandInspiredState).singleton(),
    auth: asClass(JWTInspiredAuth).singleton(),
    date: asClass(DayJSInspiredDate).singleton(),
    utils: asClass(LodashInspiredUtils).singleton(),

    // 系统服务
    eventSystem: asValue(eventSystem),
    errorHandler: asValue(errorHandler),
    pluginManager: asValue(pluginManager),
  });

  // 注册业务服务 - 在核心服务注册之后
  container.register({
    workflowEngine: asClass(WorkflowEngine).singleton(),
    userService: asClass(UserService).singleton(),
  });

  modulesLoaded = true;
}

// 注册瞬时生命周期的服务（如果需要）
// container.register({
//   someTransientService: asClass(SomeService).transient(),
// });

/**
 * 获取容器实例
 */
export async function getContainer() {
  await loadCoreModules();
  return container;
}

/**
 * 解析服务
 */
export function resolve(name) {
  return container.resolve(name);
}

/**
 * 注册新服务
 */
export function registerService(name, serviceClass, lifetime = Lifetime.SINGLETON) {
  container.register(name, asClass(serviceClass)[lifetime]());
  logger.debug(`✅ 服务已注册: ${name}`);
}

/**
 * 注册值
 */
export function registerValue(name, value) {
  container.register(name, asValue(value));
  logger.debug(`✅ 值已注册: ${name}`);
}

/**
 * 注册工厂函数
 */
export function registerFactory(name, factoryFn, lifetime = Lifetime.SINGLETON) {
  container.register(name, asFunction(factoryFn)[lifetime]());
  logger.debug(`✅ 工厂函数已注册: ${name}`);
}

/**
 * 检查服务是否存在
 */
export function hasService(name) {
  return container.hasRegistration(name);
}

/**
 * 获取容器状态
 */
export function getContainerStatus() {
  const registrations = container.registrations;
  return {
    servicesCount: Object.keys(registrations).length,
    services: Object.keys(registrations),
    registrations: registrations,
  };
}

/**
 * 获取容器注册信息
 */
export function getRegistrations() {
  return container.registrations;
}

/**
 * 创建子容器（用于测试或隔离作用域）
 */
export function createScope() {
  return container.createScope();
}

export default container;
