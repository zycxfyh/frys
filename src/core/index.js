/**
 * Core模块入口文件
 * 导出所有核心功能模块
 */

// 基础模块
export { default as Application } from './Application.js';
export { default as BaseModule } from './BaseModule.js';
export { default as BaseService } from './BaseService.js';
export { default as AgentSystem } from './AgentSystem.js';

// 算法和数据结构
export { default as BloomFilter } from './OptimizedBloomFilter.js';
export { default as TokenBucket } from './OptimizedTokenBucket.js';
export { CircuitBreaker } from './CircuitBreaker.js';
export { ExponentialBackoff } from './ExponentialBackoff.js';

// 配置管理
export { ConfigurationManager } from './config/ConfigurationManager.js';

// 工作流引擎
export { OptimizedWorkflowExecutor } from './workflow/OptimizedWorkflowExecutor.js';
export { AsyncWorkflowExecutor } from './workflow/AsyncWorkflowExecutor.js';
export { WorkflowExecutor } from './workflow/WorkflowExecutor.js';

// 事件系统
export { OptimizedEventSystem } from './events/OptimizedEventSystem.js';
export { EventSystem } from './events/EventSystem.js';

// 部署和调度
export { DistributedDeployment } from './deployment/DistributedDeployment.js';

// 内存网络
export { MemoryNetwork } from './memory/MemoryNetwork.js';

// 回滚管理
export { SmartRollbackManager } from './rollback/SmartRollbackManager.js';

// 工具类
export { DayJSDate } from './DayJSDate.js';
export { FunctionalUtils } from './FunctionalUtils.js';
export { HttpClient } from './HttpClient.js';
export { UUIDId } from './UUIDId.js';
export { ZodValidation } from './ZodValidation.js';

// 第三方集成
export { ConsulDiscovery } from './ConsulDiscovery.js';
export { D3Visualization } from './D3Visualization.js';
export { ESLintLinting } from './ESLintLinting.js';
export { FastifyFramework } from './FastifyFramework.js';
export { FluentdLogging } from './FluentdLogging.js';
export { HuskyHooks } from './HuskyHooks.js';
export { JaegerTracing } from './JaegerTracing.js';
export { JWTAuth } from './JWTAuth.js';
export { LernaMonorepo } from './LernaMonorepo.js';
export { LightweightContainer } from './LightweightContainer.js';
export { MessagingAdapter } from './MessagingAdapter.js';
export { MetricsCollector } from './MetricsCollector.js';
export { MicroserviceRegistry } from './MicroserviceRegistry.js';
export { NATSMessaging } from './NATSMessaging.js';
export { OpenAPIDocs } from './OpenAPIDocs.js';
export { PlatformAdapter } from './platform/PlatformAdapter.js';
export { PluginManager } from './plugins/PluginManager.js';
export { PluginSystem } from './PluginSystem.js';
export { PrettierFormatting } from './PrettierFormatting.js';
export { PrismaORM } from './PrismaORM.js';
export { ProtocolBuffersSerialization } from './ProtocolBuffersSerialization.js';
export { RealtimeCommunication } from './RealtimeCommunication.js';
export { SQLiteDatabase } from './SQLiteDatabase.js';
export { ViteBuild } from './ViteBuild.js';
export { VitestTesting } from './VitestTesting.js';
export { ZustandState } from './ZustandState.js';

// 容器和依赖注入
export { Container } from './di/Container.js';
export { ServiceContainer } from './di/ServiceContainer.js';
export { LightweightContainer as LightweightContainerDI } from './LightweightContainer.js';

// 模块系统
export { ModuleSystem } from './modules/ModuleSystem.js';

// 接口定义
export { IModule } from './interfaces/IModule.js';

// 运行时
export { LightweightRuntime } from './runtime/LightweightRuntime.js';

// 自适应框架
export { AdaptiveFramework } from './adaptive/AdaptiveFramework.js';

// API标准
export { APIStandard } from './api/APIStandard.js';

// 事件总线
export { EventBus } from './event/EventBus.js';

// 队列
export { default as Queue } from './queue.js';

// 服务器
export { default as Server } from './server.js';

// 消息处理器
export { SimpleMessageProcessor } from './SimpleMessageProcessor.js';

// 错误处理
export { default as ErrorHandler } from './error-handler.js';
export { ErrorHandlerConfig } from './ErrorHandlerConfig.js';

// 工具
export { PlaceholderSystem } from './utils/PlaceholderSystem.js';

// 解耦机制
export { ModuleComposer, createWorkflowModules } from './modules/ModuleComposer.js';

// 插件系统
export * from './plugins/index.js';

// 接口定义
export * from './interfaces/index.js';

// 模块配置
export * from './config/module-config.js';
