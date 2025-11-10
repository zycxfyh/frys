/**
 * Shared Kernel Module
 * 共享内核模块 - 六边形架构核心
 *
 * 提供应用架构的基础设施和核心抽象：
 * - Domain层：实体、值对象、领域服务
 * - Application层：用例、应用服务
 * - Infrastructure层：控制器、仓库、事件总线
 */

// 领域层核心
export { BaseEntity } from './BaseEntity.js';
export { BaseValueObject } from './BaseValueObject.js';

// 应用层核心
export { BaseUseCase } from './BaseUseCase.js';
export { BaseApplicationService } from './BaseApplicationService.js';

// 基础设施层核心
export { BaseController } from './BaseController.js';
export { BaseRepository } from './BaseRepository.js';
export { DependencyContainer } from './DependencyContainer.js';
export { EventBus } from './EventBus.js';

// 错误处理
export {
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from './errors/index.js';

// 结果类型
export { Failure, Result, Success } from './Result.js';

// 架构常量
export const ARCHITECTURE_CONSTANTS = {
  LAYERS: {
    DOMAIN: 'domain',
    APPLICATION: 'application',
    PRESENTATION: 'presentation',
    INFRASTRUCTURE: 'infrastructure'
  },
  PATTERNS: {
    ENTITY: 'entity',
    VALUE_OBJECT: 'value_object',
    AGGREGATE: 'aggregate',
    REPOSITORY: 'repository',
    SERVICE: 'service',
    USE_CASE: 'use_case',
    CONTROLLER: 'controller',
    FACTORY: 'factory',
    STRATEGY: 'strategy',
    OBSERVER: 'observer'
  }
};

// 架构工具类
export class ArchitectureValidator {
  /**
   * 验证架构约束
   * @param {Object} component - 要验证的组件
   * @param {string} expectedLayer - 期望的层
   * @returns {boolean} 是否符合架构
   */
  static validateLayer(component, expectedLayer) {
    const componentLayer = component.layer || component.constructor.layer;
    return componentLayer === expectedLayer;
  }

  /**
   * 验证依赖方向
   * @param {string} fromLayer - 依赖来源层
   * @param {string} toLayer - 依赖目标层
   * @returns {boolean} 依赖方向是否正确
   */
  static validateDependencyDirection(fromLayer, toLayer) {
    const layerOrder = [
      ARCHITECTURE_CONSTANTS.LAYERS.PRESENTATION,
      ARCHITECTURE_CONSTANTS.LAYERS.APPLICATION,
      ARCHITECTURE_CONSTANTS.LAYERS.DOMAIN,
      ARCHITECTURE_CONSTANTS.LAYERS.INFRASTRUCTURE
    ];

    const fromIndex = layerOrder.indexOf(fromLayer);
    const toIndex = layerOrder.indexOf(toLayer);

    // 外层可以依赖内层，内层不能依赖外层
    return fromIndex <= toIndex;
  }
}

/**
 * 依赖注入容器管理器
 */
export class ContainerManager {
  constructor() {
    this.containers = new Map();
    this.globalContainer = null;
  }

  /**
   * 设置全局容器
   * @param {DependencyContainer} container - 依赖容器
   */
  setGlobalContainer(container) {
    this.globalContainer = container;
  }

  /**
   * 获取全局容器
   * @returns {DependencyContainer} 全局容器
   */
  getGlobalContainer() {
    return this.globalContainer;
  }

  /**
   * 注册容器
   * @param {string} name - 容器名称
   * @param {DependencyContainer} container - 容器实例
   */
  registerContainer(name, container) {
    this.containers.set(name, container);
  }

  /**
   * 获取容器
   * @param {string} name - 容器名称
   * @returns {DependencyContainer} 容器实例
   */
  getContainer(name) {
    return this.containers.get(name);
  }

  /**
   * 创建作用域容器
   * @param {string} parentName - 父容器名称
   * @returns {DependencyContainer} 新作用域容器
   */
  createScopedContainer(parentName = 'global') {
    const parentContainer = this.getContainer(parentName) || this.globalContainer;
    const scopedContainer = new DependencyContainer(parentContainer);
    return scopedContainer;
  }
}

/**
 * 事件总线管理器
 */
export class EventBusManager {
  constructor() {
    this.buses = new Map();
    this.globalBus = null;
  }

  /**
   * 设置全局事件总线
   * @param {EventBus} bus - 事件总线
   */
  setGlobalBus(bus) {
    this.globalBus = bus;
  }

  /**
   * 获取全局事件总线
   * @returns {EventBus} 全局事件总线
   */
  getGlobalBus() {
    return this.globalBus;
  }

  /**
   * 注册事件总线
   * @param {string} name - 总线名称
   * @param {EventBus} bus - 事件总线实例
   */
  registerBus(name, bus) {
    this.buses.set(name, bus);
  }

  /**
   * 获取事件总线
   * @param {string} name - 总线名称
   * @returns {EventBus} 事件总线实例
   */
  getBus(name) {
    return this.buses.get(name) || this.globalBus;
  }
}

// 创建全局实例
export const containerManager = new ContainerManager();
export const eventBusManager = new EventBusManager();

// 默认导出
export default {
  BaseEntity,
  BaseValueObject,
  BaseUseCase,
  BaseApplicationService,
  BaseController,
  BaseRepository,
  DependencyContainer,
  EventBus,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
  Failure,
  Result,
  Success,
  ArchitectureValidator,
  ContainerManager,
  EventBusManager,
  containerManager,
  eventBusManager,
  ARCHITECTURE_CONSTANTS
};
