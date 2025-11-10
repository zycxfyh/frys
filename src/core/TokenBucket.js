/**
 * 令牌桶算法实现
 * 基于GitHub开源项目的限流算法
 * 参考: https://github.com/jhurliman/node-rate-limiter
 */

class TokenBucket {
  constructor(options = {}) {
    this.options = {
      capacity: 100,         // 桶容量
      refillRate: 10,        // 每秒补充令牌数
      initialTokens: 100,    // 初始令牌数
      ...options
    };

    this.tokens = this.options.initialTokens;
    this.lastRefill = Date.now();
    this.capacity = this.options.capacity;
    this.refillRate = this.options.refillRate;

    // 启动自动补充
    this._startRefillTimer();
  }

  /**
   * 消耗指定数量的令牌
   */
  consume(tokens = 1) {
    this._refill();

    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }

    return false;
  }

  /**
   * 尝试消耗令牌，带超时等待
   */
  async consumeWithWait(tokens = 1, timeout = 0) {
    const startTime = Date.now();

    while (!this.consume(tokens)) {
      if (timeout > 0 && Date.now() - startTime >= timeout) {
        throw new Error('Token bucket timeout');
      }

      // 等待一段时间后重试
      await this._wait(Math.min(100, this._timeToNextToken()));
    }

    return true;
  }

  /**
   * 获取当前令牌数量
   */
  get availableTokens() {
    this._refill();
    return this.tokens;
  }

  /**
   * 获取桶的状态
   */
  get status() {
    this._refill();
    return {
      availableTokens: this.tokens,
      capacity: this.capacity,
      refillRate: this.refillRate,
      timeToNextToken: this._timeToNextToken(),
      utilization: ((this.capacity - this.tokens) / this.capacity) * 100
    };
  }

  /**
   * 补充令牌
   */
  _refill() {
    const now = Date.now();
    const timePassed = (now - this.lastRefill) / 1000; // 转换为秒
    const tokensToAdd = Math.floor(timePassed * this.refillRate);

    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
      this.lastRefill = now;
    }
  }

  /**
   * 计算到下一个令牌的时间
   */
  _timeToNextToken() {
    if (this.tokens >= 1) return 0;
    return (1000 / this.refillRate) * (1 - this.tokens);
  }

  /**
   * 启动自动补充定时器
   */
  _startRefillTimer() {
    // 每秒补充一次
    this.refillTimer = setInterval(() => {
      this._refill();
    }, 1000);
  }

  /**
   * 等待指定的时间
   */
  _wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 销毁实例
   */
  destroy() {
    if (this.refillTimer) {
      clearInterval(this.refillTimer);
      this.refillTimer = null;
    }
  }
}

/**
 * 创建限流中间件
 */
export function createRateLimitMiddleware(bucket) {
  return async (req, res, next) => {
    try {
      const consumed = await bucket.consumeWithWait(1, 5000); // 最多等待5秒

      if (consumed) {
        // 添加限流头信息
        res.set({
          'X-RateLimit-Limit': bucket.capacity,
          'X-RateLimit-Remaining': Math.floor(bucket.availableTokens),
          'X-RateLimit-Reset': Math.ceil(Date.now() / 1000) + 1
        });
        next();
      } else {
        res.status(429).json({
          error: 'Too Many Requests',
          retryAfter: Math.ceil(bucket._timeToNextToken() / 1000)
        });
      }
    } catch (error) {
      res.status(429).json({
        error: 'Rate limit timeout',
        retryAfter: 1
      });
    }
  };
}

/**
 * 创建基于用户ID的分布式限流器
 */
export class DistributedTokenBucket {
  constructor(redis, options = {}) {
    this.redis = redis;
    this.options = {
      capacity: 100,
      refillRate: 10,
      windowSize: 60, // 时间窗口（秒）
      ...options
    };
  }

  /**
   * 检查用户是否允许请求
   */
  async allow(userId, tokens = 1) {
    const key = `ratelimit:${userId}`;
    const now = Math.floor(Date.now() / 1000);

    // 使用Redis的原子操作
    const result = await this.redis.eval(`
      local key = KEYS[1]
      local capacity = tonumber(ARGV[1])
      local refillRate = tonumber(ARGV[2])
      local windowSize = tonumber(ARGV[3])
      local tokens = tonumber(ARGV[4])
      local now = tonumber(ARGV[5])

      -- 获取当前令牌数和最后更新时间
      local data = redis.call('HMGET', key, 'tokens', 'last_update')
      local currentTokens = tonumber(data[1] or capacity)
      local lastUpdate = tonumber(data[2] or now)

      -- 计算需要补充的令牌
      local timePassed = now - lastUpdate
      local tokensToAdd = math.floor(timePassed * refillRate)
      currentTokens = math.min(capacity, currentTokens + tokensToAdd)

      -- 检查是否有足够的令牌
      if currentTokens >= tokens then
        currentTokens = currentTokens - tokens
        redis.call('HMSET', key, 'tokens', currentTokens, 'last_update', now)
        redis.call('EXPIRE', key, windowSize)
        return {1, currentTokens}  -- 允许，剩余令牌
      else
        return {0, currentTokens}  -- 拒绝，剩余令牌
      end
    `,
    1, // key数量
    key, // KEYS[1]
    this.options.capacity, // ARGV[1]
    this.options.refillRate, // ARGV[2]
    this.options.windowSize, // ARGV[3]
    tokens, // ARGV[4]
    now // ARGV[5]
    );

    const allowed = result[0] === 1;
    const remainingTokens = result[1];

    return {
      allowed,
      remainingTokens,
      resetTime: now + this.options.windowSize
    };
  }
}

export default TokenBucket;
