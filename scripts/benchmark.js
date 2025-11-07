/**
 * WokeFlow 性能基准测试
 * 测试核心模块的性能表现
 */

import { performance } from 'perf_hooks';

// === 核心模块导入 ===
import NATS from '../src/core/NATSInspiredMessaging.js';
import AxiosInspiredHTTP from '../src/core/AxiosInspiredHTTP.js';
import DayJSInspiredDate from '../src/core/DayJSInspiredDate.js';
import UUIDInspiredId from '../src/core/UUIDInspiredId.js';
import SQLiteInspiredDatabase from '../src/core/SQLiteInspiredDatabase.js';
import PrismaInspiredORM from '../src/core/PrismaInspiredORM.js';
import ZustandInspiredState from '../src/core/ZustandInspiredState.js';
import VitestInspiredTesting from '../src/core/VitestInspiredTesting.js';

class PerformanceBenchmark {
  constructor() {
    this.results = {};
  }

  /**
   * 运行所有基准测试
   */
  async runAllBenchmarks() {
    console.log('🚀 WokeFlow 性能基准测试开始\n');

    await this.benchmarkModule('NATS Messaging', async () => {
      const nats = new NATS();
      const startTime = performance.now();
      await nats.connect('benchmark-cluster');
      await nats.publish('test.topic', { message: 'benchmark' });
      return performance.now() - startTime;
    });

    await this.benchmarkModule('Axios HTTP', async () => {
      const axios = new AxiosInspiredHTTP();
      const instance = axios.create({ baseURL: 'https://httpbin.org' });
      const startTime = performance.now();
      await axios.get(instance.id, '/get');
      return performance.now() - startTime;
    });

    await this.benchmarkModule('Day.js Date', () => {
      const dayjs = new DayJSInspiredDate();
      const startTime = performance.now();
      for (let i = 0; i < 1000; i++) {
        const date = dayjs.day();
        date.add(1, 'day');
        date.format('YYYY-MM-DD');
      }
      return performance.now() - startTime;
    });

    await this.benchmarkModule('UUID Generation', () => {
      const uuid = new UUIDInspiredId();
      const startTime = performance.now();
      for (let i = 0; i < 1000; i++) {
        uuid.v4();
      }
      return performance.now() - startTime;
    });

    await this.benchmarkModule('SQLite Database', async () => {
      const sqlite = new SQLiteInspiredDatabase(':memory:');
      const startTime = performance.now();
      await sqlite.createTable('benchmark', {
        columns: [
          { name: 'id', type: 'INTEGER', primaryKey: true },
          { name: 'data', type: 'TEXT' }
        ]
      });
      for (let i = 0; i < 100; i++) {
        await sqlite.insert('benchmark', { data: `test-${i}` });
      }
      await sqlite.select('benchmark');
      return performance.now() - startTime;
    });

    await this.benchmarkModule('Prisma ORM', async () => {
      const prisma = new PrismaInspiredORM();
      prisma.defineModel('Benchmark', { id: 'Int', data: 'String' });
      prisma.createSchema('benchmark');
      const client = prisma.createClient('benchmark_client', { provider: 'sqlite', url: 'file::memory:' });
      const startTime = performance.now();
      await prisma.connect('benchmark_client');
      for (let i = 0; i < 50; i++) {
        await prisma.create('Benchmark', { data: `test-${i}` });
      }
      await prisma.findMany('Benchmark');
      return performance.now() - startTime;
    });

    await this.benchmarkModule('Zustand State', () => {
      const zustand = new ZustandInspiredState();
      const store = zustand.create((set, get) => ({
        count: 0,
        increment: () => set((state) => ({ count: state.count + 1 })),
        getCount: () => get().count
      }));
      const startTime = performance.now();
      for (let i = 0; i < 1000; i++) {
        store.increment();
      }
      store.getCount();
      return performance.now() - startTime;
    });

    this.printResults();
  }

  /**
   * 测试单个模块性能
   * @param {string} moduleName - 模块名称
   * @param {Function} testFn - 测试函数
   */
  async benchmarkModule(moduleName, testFn) {
    try {
      console.log(`📊 测试 ${moduleName}...`);
      const duration = await testFn();
      this.results[moduleName] = {
        duration: Math.round(duration * 100) / 100,
        status: 'success'
      };
      console.log(`   ✅ ${moduleName}: ${this.results[moduleName].duration}ms\n`);
    } catch (error) {
      this.results[moduleName] = {
        duration: 0,
        status: 'failed',
        error: error.message
      };
      console.log(`   ❌ ${moduleName}: 失败 - ${error.message}\n`);
    }
  }

  /**
   * 打印测试结果
   */
  printResults() {
    console.log('📊 性能基准测试结果汇总\n');
    console.log('━'.repeat(60));

    const successfulTests = Object.entries(this.results).filter(([_, result]) => result.status === 'success');
    const failedTests = Object.entries(this.results).filter(([_, result]) => result.status === 'failed');

    console.log(`✅ 成功测试: ${successfulTests.length}`);
    console.log(`❌ 失败测试: ${failedTests.length}`);
    console.log(`📈 平均性能: ${this.calculateAverage()}ms/测试\n`);

    console.log('详细结果:');
    for (const [moduleName, result] of Object.entries(this.results)) {
      const status = result.status === 'success' ? '✅' : '❌';
      const duration = result.status === 'success' ? `${result.duration}ms` : '失败';
      console.log(`${status} ${moduleName}: ${duration}`);
    }

    console.log('\n🎯 性能评估标准:');
    console.log('• < 10ms: 优秀性能');
    console.log('• 10-50ms: 良好性能');
    console.log('• 50-200ms: 可接受性能');
    console.log('• > 200ms: 需要优化\n');

    console.log('🎉 性能基准测试完成！');
  }

  /**
   * 计算平均性能
   */
  calculateAverage() {
    const successfulResults = Object.values(this.results)
      .filter(result => result.status === 'success')
      .map(result => result.duration);

    if (successfulResults.length === 0) return 0;

    const sum = successfulResults.reduce((a, b) => a + b, 0);
    return Math.round((sum / successfulResults.length) * 100) / 100;
  }
}

// 运行性能测试
const benchmark = new PerformanceBenchmark();
benchmark.runAllBenchmarks().catch(console.error);
