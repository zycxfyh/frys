/**
 * 用户仓库接口
 */

import { BaseRepository } from '../../../shared/kernel/BaseRepository.js';

export class UserRepository extends BaseRepository {
  constructor(model) {
    super(model);
  }

  /**
   * 根据用户名查找用户
   */
  async findByUsername(username) {
    throw new Error('Method not implemented');
  }

  /**
   * 根据邮箱查找用户
   */
  async findByEmail(email) {
    throw new Error('Method not implemented');
  }

  /**
   * 根据角色查找用户
   */
  async findByRole(roleId) {
    throw new Error('Method not implemented');
  }

  /**
   * 查找活跃用户
   */
  async findActiveUsers() {
    throw new Error('Method not implemented');
  }

  /**
   * 统计用户数量
   */
  async count() {
    throw new Error('Method not implemented');
  }

  /**
   * 搜索用户
   */
  async search(query, options = {}) {
    throw new Error('Method not implemented');
  }
}
