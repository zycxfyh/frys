/**
 * 智能扩容策略模块导出
 * 提供完整的自动扩容解决方案
 */

export { AutoScalingManager } from './AutoScalingManager.js';
export { ScalingMetrics } from './ScalingMetrics.js';
export { LoadBalancer } from './LoadBalancer.js';
export {
  ScalingPolicy,
  CpuScalingPolicy,
  MemoryScalingPolicy,
  RequestScalingPolicy,
  CompositeScalingPolicy,
} from './ScalingPolicy.js';
export { ContainerOrchestrator } from './ContainerOrchestrator.js';
export { DockerContainerOrchestrator } from './DockerContainerOrchestrator.js';
