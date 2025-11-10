/**
 * 自动扩容策略集成示例
 * 展示如何在 frys 中集成和使用智能扩容功能
 */

import {
  AutoScalingManager,
  CompositeScalingPolicy,
  CpuScalingPolicy,
  DockerContainerOrchestrator,
  LoadBalancer,
  MemoryScalingPolicy,
} from '../src/infrastructure/scaling/index.js';
import { logger } from '../src/utils/logger.js';

/**
 * 基础自动扩容设置示例
 */
async function basicAutoScalingExample() {
  console.log('🚀 启动基础自动扩容示例');

  // 1. 创建容器编排器
  const orchestrator = new DockerContainerOrchestrator({
    imageName: 'frys-app:latest',
    basePort: 3000,
    containerPrefix: 'frys-example-',
    network: 'frys-network',
    environment: {
      NODE_ENV: 'production',
      DATABASE_URL:
        process.env.DATABASE_URL || 'postgresql://localhost:5432/frys',
    },
  });

  // 2. 创建扩容策略
  const cpuPolicy = new CpuScalingPolicy({
    scaleUpThreshold: 0.75, // CPU > 75% 扩容
    scaleDownThreshold: 0.25, // CPU < 25% 缩容
    cooldownPeriod: 120000, // 2分钟冷却期
  });

  const memoryPolicy = new MemoryScalingPolicy({
    scaleUpThreshold: 0.8, // 内存 > 80% 扩容
    scaleDownThreshold: 0.3, // 内存 < 30% 缩容
  });

  // 复合策略：任意指标超过阈值就扩容
  const compositePolicy = new CompositeScalingPolicy([cpuPolicy, memoryPolicy]);

  // 3. 创建自动扩容管理器
  const autoScaler = new AutoScalingManager({
    serviceName: 'frys-app',
    minInstances: 1,
    maxInstances: 5,
    initialInstances: 2,
    policies: [compositePolicy],
    orchestrator,
    metricsInterval: 10000, // 10秒收集一次指标
    healthCheckInterval: 15000, // 15秒健康检查一次
  });

  // 4. 启动自动扩容
  await autoScaler.start();
  console.log('✅ 自动扩容已启动');

  // 5. 监控状态（运行5分钟）
  const monitorInterval = setInterval(() => {
    const stats = autoScaler.getStats();
    console.log(`📊 当前状态:
      - 实例数: ${stats.currentInstances}
      - 健康实例: ${stats.loadBalancer.healthyInstances}/${stats.loadBalancer.totalInstances}
      - CPU 使用率: ${stats.metrics.cpu.avg?.toFixed(2) || 'N/A'}
      - 内存使用率: ${stats.metrics.memory.avg?.toFixed(2) || 'N/A'}`);

    // 检查是否有告警
    const alerts = stats.recentAlerts;
    if (alerts.length > 0) {
      console.log('🚨 最近告警:');
      alerts.forEach((alert) => {
        console.log(`  - [${alert.severity}] ${alert.message}`);
      });
    }
  }, 30000); // 每30秒报告一次状态

  // 6. 运行5分钟后停止
  setTimeout(
    async () => {
      clearInterval(monitorInterval);
      console.log('🛑 停止自动扩容示例');

      await autoScaler.stop();
      console.log('✅ 自动扩容已停止');

      // 显示最终统计
      const finalStats = autoScaler.getStats();
      const history = autoScaler.getScaleHistory();

      console.log('📈 最终统计:');
      console.log(`  - 总扩容事件: ${history.length}`);
      console.log(`  - 最终实例数: ${finalStats.currentInstances}`);
      console.log(`  - 告警总数: ${finalStats.recentAlerts.length}`);

      if (history.length > 0) {
        console.log('🔄 扩容历史:');
        history.forEach((event) => {
          console.log(
            `  - ${new Date(event.timestamp).toLocaleTimeString()}: ${event.type} (${event.fromInstances} → ${event.toInstances}) - ${event.reason}`,
          );
        });
      }
    },
    5 * 60 * 1000,
  ); // 5分钟
}

/**
 * 高级负载均衡示例
 */
async function advancedLoadBalancingExample() {
  console.log('🔄 启动高级负载均衡示例');

  // 1. 创建负载均衡器
  const loadBalancer = new LoadBalancer({
    algorithm: 'weighted_round_robin',
    healthCheckInterval: 10000,
    maxRetries: 3,
  });

  // 2. 添加不同权重的实例
  loadBalancer.addInstance('high-capacity-1', 'http://localhost:3001', {
    weight: 3,
    metadata: { region: 'us-east', capacity: 'high' },
  });
  loadBalancer.addInstance('medium-capacity-1', 'http://localhost:3002', {
    weight: 2,
    metadata: { region: 'us-west', capacity: 'medium' },
  });
  loadBalancer.addInstance('low-capacity-1', 'http://localhost:3003', {
    weight: 1,
    metadata: { region: 'eu-central', capacity: 'low' },
  });

  // 3. 启动健康检查
  await loadBalancer.startHealthChecks();

  // 4. 模拟请求分配
  console.log('🎯 模拟请求分配 (加权轮询):');

  const requests = [];
  for (let i = 0; i < 20; i++) {
    const instance = loadBalancer.getNextInstance();
    requests.push(instance.instanceId);

    // 模拟处理时间
    setTimeout(() => {
      loadBalancer.releaseConnection(instance.instanceId);
    }, Math.random() * 1000);
  }

  // 统计分配结果
  const distribution = {};
  requests.forEach((instanceId) => {
    distribution[instanceId] = (distribution[instanceId] || 0) + 1;
  });

  console.log('📊 请求分配统计:');
  Object.entries(distribution).forEach(([instanceId, count]) => {
    console.log(`  - ${instanceId}: ${count} 次`);
  });

  // 5. 显示统计信息
  setTimeout(() => {
    const stats = loadBalancer.getStats();
    console.log('📈 负载均衡器统计:');
    console.log(`  - 算法: ${stats.algorithm}`);
    console.log(`  - 实例数: ${stats.totalInstances}`);
    console.log(`  - 健康实例: ${stats.healthyInstances}`);
    console.log(`  - 总连接数: ${stats.totalConnections}`);

    loadBalancer.stopHealthChecks();
    console.log('✅ 负载均衡示例完成');
  }, 5000);
}

/**
 * 手动扩容控制示例
 */
async function manualScalingExample() {
  console.log('🎛️ 启动手动扩容控制示例');

  // 模拟自动扩容管理器（不实际启动容器）
  const mockAutoScaler = {
    currentInstances: 2,
    maxInstances: 10,
    minInstances: 1,

    async manualScale(targetInstances, reason) {
      console.log(
        `🔧 手动扩容: ${this.currentInstances} → ${targetInstances} (${reason})`,
      );

      if (targetInstances > this.currentInstances) {
        console.log(
          `  启动 ${targetInstances - this.currentInstances} 个新实例...`,
        );
      } else if (targetInstances < this.currentInstances) {
        console.log(
          `  停止 ${this.currentInstances - targetInstances} 个实例...`,
        );
      }

      this.currentInstances = Math.max(
        this.minInstances,
        Math.min(this.maxInstances, targetInstances),
      );

      return { success: true, finalInstances: this.currentInstances };
    },

    getStats() {
      return {
        currentInstances: this.currentInstances,
        scaleHistory: [
          {
            type: 'manual_scale_up',
            fromInstances: 1,
            toInstances: 2,
            reason: '初始启动',
            timestamp: Date.now() - 60000,
          },
        ],
      };
    },
  };

  // 模拟不同的扩容场景
  console.log('📈 模拟扩容场景:');

  // 场景1: 流量高峰
  await mockAutoScaler.manualScale(5, '流量高峰，增加实例处理负载');
  console.log(`   当前实例数: ${mockAutoScaler.currentInstances}`);

  // 场景2: 维护窗口
  await mockAutoScaler.manualScale(1, '维护窗口，只保留一个实例');
  console.log(`   当前实例数: ${mockAutoScaler.currentInstances}`);

  // 场景3: 恢复正常
  await mockAutoScaler.manualScale(3, '维护完成，恢复到正常水平');
  console.log(`   当前实例数: ${mockAutoScaler.currentInstances}`);

  // 场景4: 超出限制（会被限制在最大值内）
  await mockAutoScaler.manualScale(15, '测试边界情况 - 超出最大值');
  console.log(
    `   当前实例数: ${mockAutoScaler.currentInstances} (限制在最大值 ${mockAutoScaler.maxInstances})`,
  );

  console.log('✅ 手动扩容示例完成');
}

/**
 * 运行所有示例
 */
async function runAllExamples() {
  try {
    console.log('🎬 开始运行自动扩容策略集成示例\n');

    // 检查Docker是否可用
    const { run_terminal_cmd } = await import('../src/shared/utils/terminal.js');
    try {
      await run_terminal_cmd({
        command: 'docker --version',
        is_background: false,
        explanation: '检查Docker是否可用',
      });
      console.log('🐳 Docker可用，将运行完整示例\n');
    } catch (error) {
      console.log('⚠️  Docker不可用，将运行模拟示例\n');
    }

    // 运行示例（根据实际情况选择）
    await manualScalingExample();
    console.log('');

    await advancedLoadBalancingExample();
    console.log('');

    // 注意：基础自动扩容示例需要Docker环境
    // await basicAutoScalingExample();

    console.log('🎉 所有示例运行完成！');
  } catch (error) {
    console.error('❌ 示例运行失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllExamples();
}

export {
  basicAutoScalingExample,
  advancedLoadBalancingExample,
  manualScalingExample,
  runAllExamples,
};
