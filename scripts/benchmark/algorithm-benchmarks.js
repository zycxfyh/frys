/**
 * 核心算法性能基准测试
 * 测试各种算法和数据结构的性能表现
 */

import { performance } from 'perf_hooks';

export class AlgorithmBenchmarks {
  constructor(options = {}) {
    this.options = {
      iterations: options.iterations || 5,
      dataSizes: options.dataSizes || [100, 1000, 10000, 100000],
      ...options
    };
    this.results = {};
  }

  /**
   * 运行所有算法基准测试
   */
  async runAllBenchmarks() {
    console.log('🧮 开始算法性能基准测试...');

    this.results.sorting = await this.benchmarkSortingAlgorithms();
    this.results.searching = await this.benchmarkSearchAlgorithms();
    this.results.dataStructures = await this.benchmarkDataStructures();
    this.results.stringOperations = await this.benchmarkStringOperations();
    this.results.mathOperations = await this.benchmarkMathOperations();

    console.log('✅ 算法性能基准测试完成');
    return this.results;
  }

  /**
   * 排序算法基准测试
   */
  async benchmarkSortingAlgorithms() {
    console.log('  🔄 测试排序算法...');

    const algorithms = {
      'Array.sort': (arr) => [...arr].sort((a, b) => a - b),
      'Bubble Sort': (arr) => this.bubbleSort([...arr]),
      'Quick Sort': (arr) => this.quickSort([...arr]),
      'Merge Sort': (arr) => this.mergeSort([...arr]),
      'Insertion Sort': (arr) => this.insertionSort([...arr])
    };

    const results = {};

    for (const size of this.options.dataSizes) {
      console.log(`    数据大小: ${size}`);
      const testData = this.generateRandomArray(size);

      results[size] = {};

      for (const [name, algorithm] of Object.entries(algorithms)) {
        const times = [];

        // 预热
        for (let i = 0; i < 2; i++) {
          algorithm(testData);
        }

        // 正式测试
        for (let i = 0; i < this.options.iterations; i++) {
          const start = performance.now();
          algorithm(testData);
          const end = performance.now();
          times.push(end - start);
        }

        results[size][name] = {
          average: times.reduce((a, b) => a + b, 0) / times.length,
          min: Math.min(...times),
          max: Math.max(...times),
          p95: this.calculatePercentile(times, 95)
        };

        console.log(`      ${name}: ${results[size][name].average.toFixed(3)}ms`);
      }
    }

    return results;
  }

  /**
   * 搜索算法基准测试
   */
  async benchmarkSearchAlgorithms() {
    console.log('  🔍 测试搜索算法...');

    const algorithms = {
      'Array.indexOf': (arr, target) => arr.indexOf(target),
      'Linear Search': (arr, target) => this.linearSearch(arr, target),
      'Binary Search': (arr, target) => this.binarySearch(arr, target),
      'Hash Lookup': (set, target) => set.has(target)
    };

    const results = {};

    for (const size of this.options.dataSizes) {
      console.log(`    数据大小: ${size}`);
      const testData = this.generateSortedArray(size);
      const hashSet = new Set(testData);
      const searchTargets = this.generateSearchTargets(testData, 100);

      results[size] = {};

      for (const [name, algorithm] of Object.entries(algorithms)) {
        const times = [];

        // 预热
        for (let i = 0; i < 2; i++) {
          const target = searchTargets[i % searchTargets.length];
          if (name === 'Hash Lookup') {
            algorithm(hashSet, target);
          } else {
            algorithm(testData, target);
          }
        }

        // 正式测试
        for (let i = 0; i < this.options.iterations; i++) {
          const start = performance.now();
          for (const target of searchTargets) {
            if (name === 'Hash Lookup') {
              algorithm(hashSet, target);
            } else {
              algorithm(testData, target);
            }
          }
          const end = performance.now();
          times.push(end - start);
        }

        results[size][name] = {
          average: times.reduce((a, b) => a + b, 0) / times.length,
          min: Math.min(...times),
          max: Math.max(...times),
          p95: this.calculatePercentile(times, 95)
        };

        console.log(`      ${name}: ${results[size][name].average.toFixed(3)}ms`);
      }
    }

    return results;
  }

  /**
   * 数据结构基准测试
   */
  async benchmarkDataStructures() {
    console.log('  📊 测试数据结构操作...');

    const structures = {
      'Array': () => [],
      'Set': () => new Set(),
      'Map': () => new Map(),
      'Object': () => ({}),
      'WeakMap': () => new WeakMap()
    };

    const operations = {
      'Array': {
        insert: (ds, key, value) => ds.push(value),
        access: (ds, key) => ds[key],
        delete: (ds, key) => ds.splice(key, 1),
        search: (ds, key, value) => ds.indexOf(value)
      },
      'Set': {
        insert: (ds, key, value) => ds.add(value),
        access: (ds, key) => Array.from(ds)[key],
        delete: (ds, key, value) => ds.delete(value),
        search: (ds, key, value) => ds.has(value)
      },
      'Map': {
        insert: (ds, key, value) => ds.set(key, value),
        access: (ds, key) => ds.get(key),
        delete: (ds, key) => ds.delete(key),
        search: (ds, key, value) => ds.has(key)
      },
      'Object': {
        insert: (ds, key, value) => ds[key] = value,
        access: (ds, key) => ds[key],
        delete: (ds, key) => delete ds[key],
        search: (ds, key) => key in ds
      }
    };

    const results = {};

    for (const size of [1000, 10000, 50000]) {
      console.log(`    数据大小: ${size}`);
      results[size] = {};

      for (const [name, factory] of Object.entries(structures)) {
        if (name === 'WeakMap' && size > 10000) continue; // WeakMap测试较大数据集时跳过

        const ops = operations[name];
        if (!ops) continue;

        const testResults = {};

        // 插入操作测试
        const insertTimes = await this.benchmarkOperation(
          () => factory(),
          (ds) => {
            for (let i = 0; i < size; i++) {
              ops.insert(ds, `key${i}`, `value${i}`);
            }
          }
        );
        testResults.insert = insertTimes;

        // 访问操作测试
        const accessTimes = await this.benchmarkOperation(
          () => {
            const ds = factory();
            for (let i = 0; i < size; i++) {
              ops.insert(ds, `key${i}`, `value${i}`);
            }
            return ds;
          },
          (ds) => {
            for (let i = 0; i < Math.min(size, 1000); i++) {
              ops.access(ds, `key${i % size}`);
            }
          }
        );
        testResults.access = accessTimes;

        // 搜索操作测试
        const searchTimes = await this.benchmarkOperation(
          () => {
            const ds = factory();
            for (let i = 0; i < size; i++) {
              ops.insert(ds, `key${i}`, `value${i}`);
            }
            return ds;
          },
          (ds) => {
            for (let i = 0; i < Math.min(size, 1000); i++) {
              ops.search(ds, `key${i % size}`, `value${i % size}`);
            }
          }
        );
        testResults.search = searchTimes;

        results[size][name] = testResults;
        console.log(`      ${name}: 插入${testResults.insert.average.toFixed(3)}ms, 访问${testResults.access.average.toFixed(3)}ms`);
      }
    }

    return results;
  }

  /**
   * 字符串操作基准测试
   */
  async benchmarkStringOperations() {
    console.log('  📝 测试字符串操作...');

    const operations = {
      'String Concat (+)': (str) => str + 'suffix',
      'Template Literal': (str) => `${str}suffix`,
      'String.slice': (str) => str.slice(0, str.length - 3),
      'String.substring': (str) => str.substring(0, str.length - 3),
      'String.substr': (str) => str.substr(0, str.length - 3),
      'String.replace': (str) => str.replace(/test/g, 'replaced'),
      'String.split': (str) => str.split(' '),
      'String.join': (arr) => arr.join(' '),
      'String.toUpperCase': (str) => str.toUpperCase(),
      'String.toLowerCase': (str) => str.toLowerCase()
    };

    const results = {};

    for (const size of [100, 1000, 10000]) {
      console.log(`    字符串长度: ${size}`);
      const testString = 'test '.repeat(size);
      const testArray = testString.split(' ');

      results[size] = {};

      for (const [name, operation] of Object.entries(operations)) {
        const times = [];

        // 预热
        for (let i = 0; i < 2; i++) {
          if (name === 'String.join') {
            operation(testArray);
          } else {
            operation(testString);
          }
        }

        // 正式测试
        for (let i = 0; i < this.options.iterations; i++) {
          const start = performance.now();
          for (let j = 0; j < 1000; j++) {
            if (name === 'String.join') {
              operation(testArray);
            } else {
              operation(testString);
            }
          }
          const end = performance.now();
          times.push(end - start);
        }

        results[size][name] = {
          average: times.reduce((a, b) => a + b, 0) / times.length,
          min: Math.min(...times),
          max: Math.max(...times),
          p95: this.calculatePercentile(times, 95)
        };
      }

      console.log(`      完成 ${size} 字符测试`);
    }

    return results;
  }

  /**
   * 数学运算基准测试
   */
  async benchmarkMathOperations() {
    console.log('  🔢 测试数学运算...');

    const operations = {
      'Math.sin': (x) => Math.sin(x),
      'Math.cos': (x) => Math.cos(x),
      'Math.sqrt': (x) => Math.sqrt(Math.abs(x)),
      'Math.pow': (x) => Math.pow(x, 2),
      'Math.exp': (x) => Math.exp(x * 0.1),
      'Math.log': (x) => Math.log(Math.abs(x) + 1),
      'Math.random': () => Math.random(),
      'Math.floor': (x) => Math.floor(x),
      'Math.ceil': (x) => Math.ceil(x),
      'Math.round': (x) => Math.round(x)
    };

    const results = {};
    const testData = Array.from({ length: 10000 }, () => Math.random() * 100);

    for (const [name, operation] of Object.entries(operations)) {
      const times = [];

      // 预热
      for (let i = 0; i < 2; i++) {
        for (const value of testData.slice(0, 100)) {
          operation(value);
        }
      }

      // 正式测试
      for (let i = 0; i < this.options.iterations; i++) {
        const start = performance.now();
        for (const value of testData) {
          operation(value);
        }
        const end = performance.now();
        times.push(end - start);
      }

      results[name] = {
        average: times.reduce((a, b) => a + b, 0) / times.length,
        min: Math.min(...times),
        max: Math.max(...times),
        p95: this.calculatePercentile(times, 95),
        operationsPerSecond: testData.length / (results[name].average / 1000)
      };
    }

    console.log('  ✅ 数学运算测试完成');
    return results;
  }

  // 辅助方法
  generateRandomArray(size) {
    return Array.from({ length: size }, () => Math.random());
  }

  generateSortedArray(size) {
    return Array.from({ length: size }, (_, i) => i);
  }

  generateSearchTargets(array, count) {
    const targets = [];
    for (let i = 0; i < count; i++) {
      targets.push(array[Math.floor(Math.random() * array.length)]);
    }
    return targets;
  }

  calculatePercentile(values, percentile) {
    const sorted = [...values].sort((a, b) => a - b);
    const index = (percentile / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index % 1;

    if (upper >= sorted.length) return sorted[sorted.length - 1];
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }

  async benchmarkOperation(setup, operation) {
    const times = [];

    // 预热
    for (let i = 0; i < 2; i++) {
      const data = setup();
      operation(data);
    }

    // 正式测试
    for (let i = 0; i < this.options.iterations; i++) {
      const data = setup();
      const start = performance.now();
      operation(data);
      const end = performance.now();
      times.push(end - start);
    }

    return {
      average: times.reduce((a, b) => a + b, 0) / times.length,
      min: Math.min(...times),
      max: Math.max(...times),
      p95: this.calculatePercentile(times, 95)
    };
  }

  // 排序算法实现
  bubbleSort(arr) {
    for (let i = 0; i < arr.length; i++) {
      for (let j = 0; j < arr.length - i - 1; j++) {
        if (arr[j] > arr[j + 1]) {
          [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];
        }
      }
    }
    return arr;
  }

  quickSort(arr) {
    if (arr.length <= 1) return arr;
    const pivot = arr[Math.floor(arr.length / 2)];
    const left = arr.filter(x => x < pivot);
    const middle = arr.filter(x => x === pivot);
    const right = arr.filter(x => x > pivot);
    return [...this.quickSort(left), ...middle, ...this.quickSort(right)];
  }

  mergeSort(arr) {
    if (arr.length <= 1) return arr;
    const mid = Math.floor(arr.length / 2);
    const left = this.mergeSort(arr.slice(0, mid));
    const right = this.mergeSort(arr.slice(mid));
    return this.merge(left, right);
  }

  merge(left, right) {
    const result = [];
    let i = 0, j = 0;
    while (i < left.length && j < right.length) {
      if (left[i] < right[j]) {
        result.push(left[i++]);
      } else {
        result.push(right[j++]);
      }
    }
    return [...result, ...left.slice(i), ...right.slice(j)];
  }

  insertionSort(arr) {
    for (let i = 1; i < arr.length; i++) {
      const key = arr[i];
      let j = i - 1;
      while (j >= 0 && arr[j] > key) {
        arr[j + 1] = arr[j];
        j--;
      }
      arr[j + 1] = key;
    }
    return arr;
  }

  // 搜索算法实现
  linearSearch(arr, target) {
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] === target) return i;
    }
    return -1;
  }

  binarySearch(arr, target) {
    let left = 0;
    let right = arr.length - 1;
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      if (arr[mid] === target) return mid;
      if (arr[mid] < target) left = mid + 1;
      else right = mid - 1;
    }
    return -1;
  }
}

export default AlgorithmBenchmarks;
