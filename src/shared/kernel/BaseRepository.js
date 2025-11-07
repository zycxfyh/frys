/**
 * 基础仓库接口
 * 定义数据访问层的通用接口
 */

export class BaseRepository {
  constructor() {
    if (new.target === BaseRepository) {
      throw new Error('BaseRepository cannot be instantiated directly');
    }
  }

  /**
   * 根据ID查找实体
   */
  async findById(id) {
    throw new Error('findById must be implemented by subclass');
  }

  /**
   * 查找所有实体
   */
  async findAll(options = {}) {
    throw new Error('findAll must be implemented by subclass');
  }

  /**
   * 根据条件查找实体
   */
  async findByCriteria(criteria, options = {}) {
    throw new Error('findByCriteria must be implemented by subclass');
  }

  /**
   * 保存实体
   */
  async save(entity) {
    throw new Error('save must be implemented by subclass');
  }

  /**
   * 更新实体
   */
  async update(entity) {
    throw new Error('update must be implemented by subclass');
  }

  /**
   * 删除实体
   */
  async delete(id) {
    throw new Error('delete must be implemented by subclass');
  }

  /**
   * 批量保存
   */
  async saveMany(entities) {
    const results = [];
    for (const entity of entities) {
      try {
        const result = await this.save(entity);
        results.push({ success: true, result });
      } catch (error) {
        results.push({ success: false, error: error.message, entity });
      }
    }
    return results;
  }

  /**
   * 检查实体是否存在
   */
  async exists(id) {
    try {
      const entity = await this.findById(id);
      return entity !== null && entity !== undefined;
    } catch (error) {
      return false;
    }
  }

  /**
   * 获取实体数量
   */
  async count(criteria = {}) {
    const entities = await this.findByCriteria(criteria);
    return entities.length;
  }

  /**
   * 分页查询
   */
  async findPaginated(criteria = {}, page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    const entities = await this.findByCriteria(criteria, { offset, limit });
    const total = await this.count(criteria);

    return {
      entities,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  /**
   * 健康检查
   */
  async healthCheck() {
    try {
      // 尝试执行一个简单的查询
      await this.findAll({ limit: 1 });
      return { status: 'healthy', latency: 0 };
    } catch (error) {
      return { status: 'unhealthy', error: error.message };
    }
  }
}
