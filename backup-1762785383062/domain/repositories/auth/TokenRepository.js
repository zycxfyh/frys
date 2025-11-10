/**
 * 令牌仓库接口
 */

import { BaseRepository } from '../../../shared/kernel/BaseRepository.js';

export class TokenRepository extends BaseRepository {
  constructor(model) {
    super(model);
  }

  /**
   * 根据令牌值查找令牌
   */
  async findByValue(tokenValue) {
    throw new Error('Method not implemented');
  }

  /**
   * 根据用户ID查找令牌
   */
  async findByUserId(userId, type = null) {
    throw new Error('Method not implemented');
  }

  /**
   * 查找过期的令牌
   */
  async findExpiredTokens() {
    throw new Error('Method not implemented');
  }

  /**
   * 撤销用户的所有令牌
   */
  async revokeUserTokens(userId, sessionId = null) {
    throw new Error('Method not implemented');
  }

  /**
   * 清理过期令牌
   */
  async cleanupExpiredTokens() {
    throw new Error('Method not implemented');
  }
}
