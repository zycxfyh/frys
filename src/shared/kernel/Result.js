/**
 * Result 类型 - 函数式错误处理
 * 避免抛出异常，使用Result类型处理成功和失败情况
 */

export class Result {
  constructor(success, data, error) {
    this._success = success;
    this._data = data;
    this._error = error;
  }

  /**
   * 是否成功
   */
  get isSuccess() {
    return this._success;
  }

  /**
   * 是否失败
   */
  get isFailure() {
    return !this._success;
  }

  /**
   * 获取数据（成功时）
   */
  get data() {
    if (!this._success) {
      throw new Error('Cannot access data on failed result');
    }
    return this._data;
  }

  /**
   * 获取错误（失败时）
   */
  get error() {
    if (this._success) {
      throw new Error('Cannot access error on successful result');
    }
    return this._error;
  }

  /**
   * 映射成功值
   */
  map(fn) {
    return this._success ? Success(fn(this._data)) : this;
  }

  /**
   * 映射错误值
   */
  mapError(fn) {
    return this._success ? this : Failure(fn(this._error));
  }

  /**
   * 绑定操作
   */
  bind(fn) {
    return this._success ? fn(this._data) : this;
  }

  /**
   * 处理成功情况
   */
  onSuccess(fn) {
    if (this._success) {
      fn(this._data);
    }
    return this;
  }

  /**
   * 处理失败情况
   */
  onFailure(fn) {
    if (!this._success) {
      fn(this._error);
    }
    return this;
  }

  /**
   * 获取值或默认值
   */
  getOrDefault(defaultValue) {
    return this._success ? this._data : defaultValue;
  }

  /**
   * 获取值或抛出错误
   */
  getOrThrow() {
    if (!this._success) {
      throw this._error;
    }
    return this._data;
  }

  /**
   * 转换为Promise
   */
  toPromise() {
    return this._success
      ? Promise.resolve(this._data)
      : Promise.reject(this._error);
  }

  /**
   * 转换为普通对象
   */
  toObject() {
    return {
      success: this._success,
      ...(this._success ? { data: this._data } : { error: this._error }),
    };
  }
}

/**
 * 创建成功结果
 */
export function Success(data) {
  return new Result(true, data, null);
}

/**
 * 创建失败结果
 */
export function Failure(error, details = null) {
  const errorObj =
    typeof error === 'string' ? { message: error, details } : error;

  return new Result(false, null, errorObj);
}

/**
 * 从Promise创建Result
 */
export async function fromPromise(promise) {
  try {
    const data = await promise;
    return Success(data);
  } catch (error) {
    return Failure(error);
  }
}

/**
 * 组合多个Result
 */
export function combine(results) {
  const failures = results.filter((r) => r.isFailure);

  if (failures.length > 0) {
    return Failure({
      message: 'Multiple operations failed',
      failures: failures.map((f) => f.error),
    });
  }

  return Success(results.map((r) => r.data));
}

/**
 * 尝试执行操作
 */
export async function tryCatch(fn) {
  return await fromPromise(fn());
}
