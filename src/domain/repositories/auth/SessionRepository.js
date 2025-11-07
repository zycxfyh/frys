/**
 * 会话仓库接口
 */

import { BaseRepository } from '../../../shared/kernel/BaseRepository.js';

export class SessionRepository extends BaseRepository {
  constructor(model) {
    super(model);
  }

  /**
   * 根据会话ID查找会话
   */
  async findBySessionId(sessionId) {
    throw new Error('Method not implemented');
  }

  /**
   * 根据用户ID查找会话
   */
  async findByUserId(userId) {
    throw new Error('Method not implemented');
  }

  /**
   * 查找活跃会话
   */
  async findActiveSessions(userId = null) {
    throw new Error('Method not implemented');
  }

  /**
   * 查找过期的会话
   */
  async findExpiredSessions() {
    throw new Error('Method not implemented');
  }

  /**
   * 终止用户的所有会话
   */
  async terminateUserSessions(userId, excludeSessionId = null) {
    throw new Error('Method not implemented');
  }

  /**
   * 清理过期会话
   */
  async cleanupExpiredSessions() {
    throw new Error('Method not implemented');
  }
}
