/**
 * Shared Kernel - 共享内核
 * 包含所有模块共享的基础设施和工具
 *
 * 设计原则：
 * - 稳定的共享抽象
 * - 最小化依赖
 * - 高内聚，低耦合
 */

export * from './kernel/index.js';
export * from './utils/index.js';
export * from './types/index.js';
export * from './constants/index.js';
export * from './errors/index.js';

// 便捷导出
export { logger } from './utils/logger.js';
export { config, getConfig, setConfig, getAllConfig, initializeConfig } from './utils/config.js';

// 工具函数导出
export * from './utils/index.js';

// 核心抽象
export { EventBus } from './kernel/EventBus.js';
export { Result } from './kernel/Result.js';
export { BaseEntity } from './kernel/BaseEntity.js';
export { BaseUseCase } from './kernel/BaseUseCase.js';
export { BaseRepository } from './kernel/BaseRepository.js';

// 解耦机制
export { ServiceLocator, globalServiceLocator, registerService, getService } from './kernel/ServiceLocator.js';
export { DependencyInjector, globalContainer, bind, resolve, inject } from './kernel/DependencyInjector.js';