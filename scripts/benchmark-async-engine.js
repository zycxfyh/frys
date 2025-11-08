/**
 * VCP异步执行引擎性能对比测试
 *
 * 对比原生Promise.all和VCP异步执行引擎的性能差异
 */

import { AsyncExecutionEngine } from '../src/core/workflow/AsyncExecutionEngine.js';
import { performance } from 'perf_hooks';

// 测试任务：模拟不同复杂度的异步操作
function createTestTasks(count, complexity = 'simple') {
  const tasks = [];

  for (let i = 0; i < count; i++) {
    switch (complexity) {
      case 'simple':
        tasks.push({
          id: `task-${i}`,
          execute: async () => {
            // 简单的延迟操作
            await new Promise(resolve => setTimeout(resolve, Math.random() * 10 + 5));
            return `result-${i}`;
          }
        });
        break;

      case 'complex':
        tasks.push({
          id: `task-${i}`,
          execute: async () => {
            // 复杂的计算操作
            const iterations = Math.floor(Math.random() * 1000) + 500;
            let result = 0;
            for (let j = 0; j < iterations; j++) {
              result += Math.sin(j) * Math.cos(j);
            }
            await new Promise(resolve => setTimeout(resolve, Math.random() * 5 + 1));
            return result;
          }
        });
        break;

      case 'io-bound':
        tasks.push({
          id: `task-${i}`,
          execute: async () => {
            // 模拟I/O密集型操作
            const buffers = [];
            for (let j = 0; j < 10; j++) {
              buffers.push(Buffer.alloc(Math.floor(Math.random() * 1024) + 512));
            }
            await new Promise(resolve => setTimeout(resolve, Math.random() * 20 + 10));
            return buffers.length;
          }
        });
        break;
    }
  }

  return tasks;
}

// 基准测试函数
async function benchmark(name, tasks, options = {}) {
  console.log(`\n🔬 运行基准测试: ${name}`);
  console.log(`📊 任务数量: ${tasks.length}`);
  console.log(`⚙️ 选项:`, options);

  const startTime = performance.now();

  try {
    let results;
    if (name.includes('VCP')) {
      const engine = new AsyncExecutionEngine({
        maxConcurrency: options.maxConcurrency || 10,
        monitoring: false
      });

      results = await engine.executeTasks(tasks, {
        strategy: options.strategy || 'parallel'
      });

      engine.cleanup();
    } else if (name.includes('Promise.all')) {
      results = await Promise.all(tasks.map(task => task.execute()));
    } else if (name.includes('Sequential')) {
      results = [];
      for (const task of tasks) {
        const result = await task.execute();
        results.push({ success: true, result });
      }
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    console.log(`✅ 完成时间: ${duration.toFixed(2)}ms`);
    console.log(`🚀 平均任务时间: ${(duration / tasks.length).toFixed(2)}ms`);
    console.log(`📈 吞吐量: ${(tasks.length / (duration / 1000)).toFixed(2)} tasks/sec`);

    return {
      name,
      duration,
      throughput: tasks.length / (duration / 1000),
      avgTaskTime: duration / tasks.length,
      success: true
    };

  } catch (error) {
    const endTime = performance.now();
    const duration = endTime - startTime;

    console.log(`❌ 失败时间: ${duration.toFixed(2)}ms`);
    console.log(`💥 错误: ${error.message}`);

    return {
      name,
      duration,
      error: error.message,
      success: false
    };
  }
}

// 主测试函数
async function runBenchmarks() {
  console.log('🚀 VCP异步执行引擎性能对比测试');
  console.log('=' .repeat(50));

  const testScenarios = [
    { count: 10, complexity: 'simple', name: '小规模简单任务' },
    { count: 50, complexity: 'simple', name: '中规模简单任务' },
    { count: 100, complexity: 'simple', name: '大规模简单任务' },
    { count: 20, complexity: 'complex', name: '计算密集型任务' },
    { count: 20, complexity: 'io-bound', name: 'I/O密集型任务' }
  ];

  const results = [];

  for (const scenario of testScenarios) {
    console.log(`\n🎯 测试场景: ${scenario.name}`);
    console.log('-'.repeat(30));

    const tasks = createTestTasks(scenario.count, scenario.complexity);

    // 测试不同的执行方式
    const sequentialResult = await benchmark(
      `Sequential (${scenario.name})`,
      tasks
    );

    const promiseAllResult = await benchmark(
      `Promise.all (${scenario.name})`,
      tasks
    );

    const vcpResult = await benchmark(
      `VCP Engine (${scenario.name})`,
      tasks,
      { maxConcurrency: 10, strategy: 'parallel' }
    );

    const vcpAdaptiveResult = await benchmark(
      `VCP Adaptive (${scenario.name})`,
      tasks,
      { maxConcurrency: 10, strategy: 'adaptive' }
    );

    results.push({
      scenario: scenario.name,
      sequential: sequentialResult,
      promiseAll: promiseAllResult,
      vcp: vcpResult,
      vcpAdaptive: vcpAdaptiveResult
    });
  }

  // 输出总结报告
  console.log('\n📊 性能对比总结报告');
  console.log('='.repeat(80));

  console.log('| 场景 | Sequential | Promise.all | VCP Engine | VCP Adaptive |');
  console.log('|------|------------|-------------|------------|---------------|');

  results.forEach(result => {
    const seqTime = result.sequential.success ? result.sequential.duration.toFixed(1) : 'FAIL';
    const allTime = result.promiseAll.success ? result.promiseAll.duration.toFixed(1) : 'FAIL';
    const vcpTime = result.vcp.success ? result.vcp.duration.toFixed(1) : 'FAIL';
    const adaptiveTime = result.vcpAdaptive.success ? result.vcpAdaptive.duration.toFixed(1) : 'FAIL';

    console.log(`| ${result.scenario} | ${seqTime}ms | ${allTime}ms | ${vcpTime}ms | ${adaptiveTime}ms |`);

    // 计算性能提升
    if (result.promiseAll.success && result.vcp.success) {
      const improvement = ((result.promiseAll.duration - result.vcp.duration) / result.promiseAll.duration * 100).toFixed(1);
      console.log(`| 性能提升 | - | - | +${improvement}% | +${improvement}% |`);
    }
  });

  console.log('\n✨ 测试完成!');

  // 导出结果为JSON
  const fs = await import('fs');
  fs.writeFileSync(
    'benchmark-results.json',
    JSON.stringify(results, null, 2)
  );
  console.log('📄 详细结果已保存到 benchmark-results.json');
}

// 运行测试
runBenchmarks().catch(console.error);
