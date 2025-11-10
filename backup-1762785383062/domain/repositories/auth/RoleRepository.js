/**
 * 角色仓库接口
 */

import { BaseRepository } from '../../../shared/kernel/BaseRepository.js';

export class RoleRepository extends BaseRepository {
  constructor(model) {
    super(model);
  }

  /**
   * 根据用户ID查找角色
   */
  async findByUserId(userId) {
    throw new Error('Method not implemented');
  }

  /**
   * 根据名称查找角色
   */
  async findByName(name) {
    throw new Error('Method not implemented');
  }

  /**
   * 查找系统角色
   */
  async findSystemRoles() {
    throw new Error('Method not implemented');
  }

  /**
   * 查找活跃角色
   */
  async findActiveRoles() {
    throw new Error('Method not implemented');
  }

  /**
   * 统计角色数量
   */
  async count() {
    throw new Error('Method not implemented');
  }
}
