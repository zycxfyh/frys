/**
 * 指数退避算法实现
 * 基于GitHub开源项目的退避算法
 * 参考: https://github.com/coveooss/exponential-backoff
 */

class ExponentialBackoff {
  constructor(options = {}) {
    this.options = {
      initialDelay: 100,      // 初始延迟 (ms)
      maxDelay: 30000,        // 最大延迟 (ms)
      backoffFactor: 2,       // 退避因子
      maxAttempts: 10,        // 最大尝试次数
      jitter: true,          // 是否添加随机抖动
      jitterFactor: 0.1,     // 抖动因子
      ...options
    };

    this.attempts = 0;
    this.startTime = null;
  }

  /**
   * 执行带退避的重试操作
   */
  async execute(operation, onRetry = null) {
    this.attempts = 0;
    this.startTime = Date.now();

    let lastError;

    while (this.attempts < this.options.maxAttempts) {
      try {
        this.attempts++;
        const result = await operation();
        return result;
      } catch (error) {
        lastError = error;

        if (this.attempts >= this.options.maxAttempts) {
          break;
        }

        const delay = this._calculateDelay();
        await this._wait(delay);

        if (onRetry) {
          await onRetry(error, this.attempts, delay);
        }
      }
    }

    throw lastError;
  }

  /**
   * 计算延迟时间
   */
  _calculateDelay() {
    const exponentialDelay = this.options.initialDelay * Math.pow(this.options.backoffFactor, this.attempts - 1);
    const cappedDelay = Math.min(exponentialDelay, this.options.maxDelay);

    if (this.options.jitter) {
      // 添加随机抖动以避免惊群效应
      const jitter = cappedDelay * this.options.jitterFactor * (Math.random() * 2 - 1);
      return Math.max(0, cappedDelay + jitter);
    }

    return cappedDelay;
  }

  /**
   * 等待指定的延迟时间
   */
  _wait(delay) {
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * 获取统计信息
   */
  get stats() {
    return {
      attempts: this.attempts,
      totalTime: this.startTime ? Date.now() - this.startTime : 0,
      nextDelay: this.attempts < this.options.maxAttempts ? this._calculateDelay() : null
    };
  }

  /**
   * 重置状态
   */
  reset() {
    this.attempts = 0;
    this.startTime = null;
  }
}

/**
 * 创建带退避的重试装饰器
 */
export function withExponentialBackoff(operation, options = {}) {
  const backoff = new ExponentialBackoff(options);

  return async function(...args) {
    return backoff.execute(() => operation(...args));
  };
}

/**
 * 创建带退避和超时的重试装饰器
 */
export function withTimeoutAndBackoff(operation, timeoutMs, backoffOptions = {}) {
  return async function(...args) {
    return new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      try {
        const backoff = new ExponentialBackoff(backoffOptions);
        const result = await backoff.execute(() => operation(...args));
        clearTimeout(timeout);
        resolve(result);
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  };
}

export default ExponentialBackoff;
