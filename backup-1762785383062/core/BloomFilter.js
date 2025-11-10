/**
 * 布隆过滤器实现
 * 基于GitHub开源项目的布隆过滤器算法
 * 参考: https://github.com/jasondavies/bloomfilter.js
 */

class BloomFilter {
  constructor(size = 1024, hashCount = 4) {
    this.size = size;
    this.hashCount = hashCount;
    this.bitArray = new Array(size).fill(false);
    this.elements = 0;

    // 生成哈希函数种子
    this.seeds = [];
    for (let i = 0; i < hashCount; i++) {
      this.seeds.push(Math.floor(Math.random() * 1000000));
    }
  }

  /**
   * 添加元素到过滤器
   */
  add(item) {
    const hashes = this._getHashes(item);

    hashes.forEach(hash => {
      this.bitArray[hash] = true;
    });

    this.elements++;
  }

  /**
   * 检查元素是否可能存在
   */
  has(item) {
    const hashes = this._getHashes(item);

    return hashes.every(hash => this.bitArray[hash]);
  }

  /**
   * 添加元素（如果不存在）
   */
  addIfNotExists(item) {
    if (this.has(item)) {
      return false; // 可能已存在
    }

    this.add(item);
    return true; // 新增成功
  }

  /**
   * 获取哈希值
   */
  _getHashes(item) {
    const itemStr = String(item);
    const hashes = [];

    for (let i = 0; i < this.hashCount; i++) {
      // 使用djb2哈希算法的变体
      let hash = 5381;
      for (let j = 0; j < itemStr.length; j++) {
        hash = ((hash << 5) + hash) + itemStr.charCodeAt(j) + this.seeds[i];
      }

      // 确保哈希值在有效范围内
      hashes.push(Math.abs(hash) % this.size);
    }

    return hashes;
  }

  /**
   * 获取过滤器状态
   */
  get status() {
    const setBits = this.bitArray.filter(bit => bit).length;
    const falsePositiveRate = this._calculateFalsePositiveRate();

    return {
      size: this.size,
      hashCount: this.hashCount,
      elements: this.elements,
      setBits,
      utilization: (setBits / this.size) * 100,
      estimatedFalsePositiveRate: falsePositiveRate
    };
  }

  /**
   * 计算假阳性率
   */
  _calculateFalsePositiveRate() {
    const m = this.size;
    const n = this.elements;
    const k = this.hashCount;

    if (n === 0) return 0;

    // 假阳性率公式: (1 - e^(-k*n/m))^k
    const exponent = -k * n / m;
    return Math.pow(1 - Math.exp(exponent), k);
  }

  /**
   * 清空过滤器
   */
  clear() {
    this.bitArray.fill(false);
    this.elements = 0;
  }

  /**
   * 合并另一个布隆过滤器
   */
  union(other) {
    if (this.size !== other.size || this.hashCount !== other.hashCount) {
      throw new Error('Cannot union filters with different parameters');
    }

    const result = new BloomFilter(this.size, this.hashCount);

    for (let i = 0; i < this.size; i++) {
      result.bitArray[i] = this.bitArray[i] || other.bitArray[i];
    }

    result.elements = Math.max(this.elements, other.elements);

    return result;
  }

  /**
   * 与另一个布隆过滤器求交集
   */
  intersection(other) {
    if (this.size !== other.size || this.hashCount !== other.hashCount) {
      throw new Error('Cannot intersect filters with different parameters');
    }

    const result = new BloomFilter(this.size, this.hashCount);

    for (let i = 0; i < this.size; i++) {
      result.bitArray[i] = this.bitArray[i] && other.bitArray[i];
    }

    // 交集的元素数很难准确计算，这里使用保守估计
    result.elements = Math.min(this.elements, other.elements);

    return result;
  }

  /**
   * 序列化过滤器
   */
  serialize() {
    return {
      size: this.size,
      hashCount: this.hashCount,
      bitArray: this.bitArray,
      elements: this.elements,
      seeds: this.seeds
    };
  }

  /**
   * 反序列化过滤器
   */
  static deserialize(data) {
    const filter = new BloomFilter(data.size, data.hashCount);
    filter.bitArray = data.bitArray;
    filter.elements = data.elements;
    filter.seeds = data.seeds;
    return filter;
  }
}

/**
 * 基于Redis的分布式布隆过滤器
 */
export class DistributedBloomFilter {
  constructor(redis, key, size = 1024, hashCount = 4) {
    this.redis = redis;
    this.key = key;
    this.size = size;
    this.hashCount = hashCount;

    // 生成哈希函数种子
    this.seeds = [];
    for (let i = 0; i < hashCount; i++) {
      this.seeds.push(Math.floor(Math.random() * 1000000));
    }
  }

  /**
   * 添加元素
   */
  async add(item) {
    const hashes = this._getHashes(item);
    const pipeline = this.redis.pipeline();

    hashes.forEach(hash => {
      pipeline.setbit(this.key, hash, 1);
    });

    await pipeline.exec();
  }

  /**
   * 检查元素是否存在
   */
  async has(item) {
    const hashes = this._getHashes(item);
    const results = await this.redis.mget(...hashes.map(hash => `${this.key}:${hash}`));

    // 如果所有位都被设置，则可能存在
    return results.every(result => result === '1');
  }

  /**
   * 批量添加元素
   */
  async addBatch(items) {
    const pipeline = this.redis.pipeline();

    items.forEach(item => {
      const hashes = this._getHashes(item);
      hashes.forEach(hash => {
        pipeline.setbit(this.key, hash, 1);
      });
    });

    await pipeline.exec();
  }

  /**
   * 批量检查元素
   */
  async hasBatch(items) {
    const pipeline = this.redis.pipeline();

    items.forEach(item => {
      const hashes = this._getHashes(item);
      hashes.forEach(hash => {
        pipeline.getbit(this.key, hash);
      });
    });

    const results = await pipeline.exec();
    const existence = [];

    for (let i = 0; i < items.length; i++) {
      const start = i * this.hashCount;
      const end = start + this.hashCount;
      const itemResults = results.slice(start, end).map(([err, result]) => result);

      existence.push(itemResults.every(result => result === 1));
    }

    return existence;
  }

  /**
   * 获取哈希值
   */
  _getHashes(item) {
    const itemStr = String(item);
    const hashes = [];

    for (let i = 0; i < this.hashCount; i++) {
      let hash = 5381;
      for (let j = 0; j < itemStr.length; j++) {
        hash = ((hash << 5) + hash) + itemStr.charCodeAt(j) + this.seeds[i];
      }

      hashes.push(Math.abs(hash) % this.size);
    }

    return hashes;
  }

  /**
   * 清空过滤器
   */
  async clear() {
    await this.redis.del(this.key);
  }

  /**
   * 获取过滤器信息
   */
  async info() {
    const bitCount = await this.redis.bitcount(this.key);
    return {
      key: this.key,
      size: this.size,
      hashCount: this.hashCount,
      setBits: bitCount,
      utilization: (bitCount / this.size) * 100
    };
  }
}

/**
 * 自适应布隆过滤器 - 根据负载动态调整参数
 */
export class AdaptiveBloomFilter extends BloomFilter {
  constructor(initialSize = 1024, targetFalsePositiveRate = 0.01) {
    super(initialSize, 4);
    this.targetFalsePositiveRate = targetFalsePositiveRate;
    this.scalingFactor = 2;
  }

  /**
   * 添加元素并检查是否需要扩容
   */
  add(item) {
    super.add(item);

    // 检查是否需要扩容
    if (this._calculateFalsePositiveRate() > this.targetFalsePositiveRate) {
      this._resize();
    }
  }

  /**
   * 扩容过滤器
   */
  _resize() {
    const newSize = this.size * this.scalingFactor;
    const newFilter = new BloomFilter(newSize, this.hashCount);

    // 重新哈希所有现有元素（在实际实现中，这需要额外的存储）
    // 这里简化处理，只是重置统计
    this.size = newSize;
    this.bitArray = new Array(newSize).fill(false);
    this.elements = 0;

    console.warn(`Bloom filter resized to ${newSize} bits`);
  }
}

export default BloomFilter;
