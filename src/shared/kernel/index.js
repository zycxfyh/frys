/**
 * frys 架构核心 (Hexagonal Architecture)
 * 提供应用架构的基础设施
 */

// 导出所有核心组件
export { BaseEntity } from './BaseEntity.js';
export { BaseValueObject } from './BaseValueObject.js';
export { BaseRepository } from './BaseRepository.js';
export { BaseUseCase } from './BaseUseCase.js';
export { BaseApplicationService } from './BaseApplicationService.js';
export { BaseController } from './BaseController.js';
export { EventBus } from './EventBus.js';
export { DependencyContainer } from './DependencyContainer.js';
export { Result, Success, Failure } from './Result.js';
export {
  ValidationError,
  NotFoundError,
  UnauthorizedError,
} from './errors/index.js';
