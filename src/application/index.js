/**
 * Application Layer - 应用层
 * 协调领域对象完成业务用例
 *
 * 职责：
 * - 用例 (Use Cases)
 * - 应用服务 (Application Services)
 * - 命令/查询处理器
 * - DTOs (Data Transfer Objects)
 */

export * from './use-cases/index.js';
export * from './services/index.js';
export * from './dto/index.js';

// 便捷导出
export { BaseUseCase } from '../shared/kernel/BaseUseCase.js';
export { BaseApplicationService } from '../shared/kernel/BaseApplicationService.js';
