/**
 * 智能扩容策略模块导出
 * 提供完整的自动扩容解决方案
 */

export { AutoScalingManager } from './AutoScalingManager.js';
export { ContainerOrchestrator } from './ContainerOrchestrator.js';
export { DockerContainerOrchestrator } from './DockerContainerOrchestrator.js';
export { LoadBalancer } from './LoadBalancer.js';
export { ScalingMetrics } from './ScalingMetrics.js';
export {
  CompositeScalingPolicy,
  CpuScalingPolicy,
  MemoryScalingPolicy,
  RequestScalingPolicy,
  ScalingPolicy,
} from './ScalingPolicy.js';
