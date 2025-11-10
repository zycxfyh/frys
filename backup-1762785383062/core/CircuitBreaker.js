/**
 * 断路器模式实现
 * 基于GitHub开源项目的断路器算法
 * 参考: https://github.com/nodeshift/opossum
 */

const EventEmitter = require('events');

class CircuitBreaker extends EventEmitter {
  constructor(action, options = {}) {
    super();

    this.action = action;
    this.options = {
      timeout: 10000,        // 超时时间
      errorThreshold: 50,    // 错误率阈值 (%)
      resetTimeout: 30000,   // 重置超时时间
      rollingCountTimeout: 10000, // 滚动计数窗口
      rollingCountBuckets: 10,     // 滚动计数桶数量
      name: 'CircuitBreaker',
      ...options
    };

    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failures = 0;
    this.successes = 0;
    this.requests = 0;
    this.lastFailureTime = null;
    this.nextAttempt = null;

    // 滚动计数器
    this.rollingCount = {
      failures: new Array(this.options.rollingCountBuckets).fill(0),
      successes: new Array(this.options.rollingCountBuckets).fill(0),
      requests: new Array(this.options.rollingCountBuckets).fill(0),
      lastUpdated: Date.now()
    };

    this.bucketIndex = 0;
  }

  /**
   * 执行带断路器保护的操作
   */
  async execute(...args) {
    this.requests++;

    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN');
      }
      // 尝试半开状态
      this.state = 'HALF_OPEN';
      this.emit('halfOpen');
    }

    try {
      const result = await this._executeWithTimeout(...args);
      this._onSuccess();
      return result;
    } catch (error) {
      this._onFailure(error);
      throw error;
    }
  }

  /**
   * 带超时的执行
   */
  async _executeWithTimeout(...args) {
    return new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Circuit breaker timeout'));
      }, this.options.timeout);

      try {
        const result = await this.action(...args);
        clearTimeout(timeout);
        resolve(result);
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  /**
   * 成功处理
   */
  _onSuccess() {
    this._updateRollingCount('successes');

    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      this.failures = 0;
      this.successes = 0;
      this.emit('close');
    } else {
      this.successes++;
    }
  }

  /**
   * 失败处理
   */
  _onFailure(error) {
    this._updateRollingCount('failures');
    this.failures++;
    this.lastFailureTime = Date.now();

    const errorRate = this._calculateErrorRate();

    if (this.state === 'HALF_OPEN' || errorRate >= this.options.errorThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.options.resetTimeout;
      this.emit('open', error);
    }
  }

  /**
   * 更新滚动计数
   */
  _updateRollingCount(type) {
    const now = Date.now();
    const timeDiff = now - this.rollingCount.lastUpdated;
    const bucketsToAdvance = Math.floor(timeDiff / (this.options.rollingCountTimeout / this.options.rollingCountBuckets));

    if (bucketsToAdvance > 0) {
      for (let i = 0; i < Math.min(bucketsToAdvance, this.options.rollingCountBuckets); i++) {
        this.bucketIndex = (this.bucketIndex + 1) % this.options.rollingCountBuckets;
        this.rollingCount.failures[this.bucketIndex] = 0;
        this.rollingCount.successes[this.bucketIndex] = 0;
        this.rollingCount.requests[this.bucketIndex] = 0;
      }
      this.rollingCount.lastUpdated = now;
    }

    this.rollingCount[type][this.bucketIndex]++;
    this.rollingCount.requests[this.bucketIndex]++;
  }

  /**
   * 计算错误率
   */
  _calculateErrorRate() {
    const totalFailures = this.rollingCount.failures.reduce((a, b) => a + b, 0);
    const totalRequests = this.rollingCount.requests.reduce((a, b) => a + b, 0);

    return totalRequests > 0 ? (totalFailures / totalRequests) * 100 : 0;
  }

  /**
   * 获取状态
   */
  get status() {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      requests: this.requests,
      errorRate: this._calculateErrorRate(),
      nextAttempt: this.nextAttempt
    };
  }

  /**
   * 强制关闭断路器
   */
  close() {
    this.state = 'CLOSED';
    this.failures = 0;
    this.emit('close');
  }

  /**
   * 强制打开断路器
   */
  open() {
    this.state = 'OPEN';
    this.nextAttempt = Date.now() + this.options.resetTimeout;
    this.emit('open');
  }

  /**
   * 重置断路器
   */
  reset() {
    this.state = 'CLOSED';
    this.failures = 0;
    this.successes = 0;
    this.requests = 0;
    this.nextAttempt = null;
    this.emit('reset');
  }
}

export default CircuitBreaker;
