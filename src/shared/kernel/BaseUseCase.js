/**
 * 基础用例类
 * 用例代表应用层的业务逻辑
 */

import { Result, Success, Failure } from './Result.js';

export class BaseUseCase {
  constructor() {
    if (new.target === BaseUseCase) {
      throw new Error('BaseUseCase cannot be instantiated directly');
    }
  }

  /**
   * 执行用例
   */
  async execute(input) {
    try {
      // 输入验证
      const validationResult = await this.validate(input);
      if (!validationResult.isSuccess) {
        return validationResult;
      }

      // 权限检查
      const authResult = await this.authorize(input);
      if (!authResult.isSuccess) {
        return authResult;
      }

      // 执行业务逻辑
      const result = await this.perform(input);

      // 后处理
      await this.postProcess(result, input);

      return Success(result);
    } catch (error) {
      return await this.handleError(error, input);
    }
  }

  /**
   * 验证输入
   */
  async validate(input) {
    // 默认实现：无验证
    return Success(true);
  }

  /**
   * 检查权限
   */
  async authorize(input) {
    // 默认实现：允许所有
    return Success(true);
  }

  /**
   * 执行核心业务逻辑
   */
  async perform(input) {
    throw new Error('perform must be implemented by subclass');
  }

  /**
   * 后处理
   */
  async postProcess(result, input) {
    // 默认实现：无后处理
  }

  /**
   * 错误处理
   */
  async handleError(error, input) {
    // 记录错误
    console.error('Use case execution failed:', error);

    // 返回失败结果
    return Failure(error.message, error);
  }

  /**
   * 创建子用例
   */
  createSubUseCase(useCaseClass, input) {
    const useCase = new useCaseClass();
    return useCase.execute(input);
  }

  /**
   * 验证必填字段
   */
  validateRequired(input, fields) {
    const missing = fields.filter((field) => !input[field]);
    if (missing.length > 0) {
      return Failure(`Missing required fields: ${missing.join(', ')}`);
    }
    return Success(true);
  }

  /**
   * 验证数据类型
   */
  validateType(value, type, fieldName) {
    const actualType = typeof value;
    if (actualType !== type) {
      return Failure(
        `Field ${fieldName} must be of type ${type}, got ${actualType}`,
      );
    }
    return Success(true);
  }
}
