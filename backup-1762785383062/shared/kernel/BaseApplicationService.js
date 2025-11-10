/**
 * 基础应用服务类
 * 协调多个用例，处理复杂业务流程
 */

export class BaseApplicationService {
  constructor() {
    if (new.target === BaseApplicationService) {
      throw new Error('BaseApplicationService cannot be instantiated directly');
    }

    this._useCases = new Map();
    this._repositories = new Map();
    this._domainServices = new Map();
  }

  /**
   * 注册用例
   */
  registerUseCase(name, useCase) {
    this._useCases.set(name, useCase);
  }

  /**
   * 获取用例
   */
  getUseCase(name) {
    const useCase = this._useCases.get(name);
    if (!useCase) {
      throw new Error(`Use case not found: ${name}`);
    }
    return useCase;
  }

  /**
   * 注册仓库
   */
  registerRepository(name, repository) {
    this._repositories.set(name, repository);
  }

  /**
   * 获取仓库
   */
  getRepository(name) {
    const repository = this._repositories.get(name);
    if (!repository) {
      throw new Error(`Repository not found: ${name}`);
    }
    return repository;
  }

  /**
   * 注册领域服务
   */
  registerDomainService(name, service) {
    this._domainServices.set(name, service);
  }

  /**
   * 获取领域服务
   */
  getDomainService(name) {
    const service = this._domainServices.get(name);
    if (!service) {
      throw new Error(`Domain service not found: ${name}`);
    }
    return service;
  }

  /**
   * 执行事务
   */
  async executeInTransaction(fn) {
    // 默认实现：直接执行
    // 子类可以重写以提供事务支持
    return await fn();
  }

  /**
   * 发布领域事件
   */
  async publishDomainEvents(entities) {
    const allEntities = Array.isArray(entities) ? entities : [entities];

    for (const entity of allEntities) {
      if (entity && typeof entity.domainEvents !== 'undefined') {
        const events = entity.domainEvents;

        for (const event of events) {
          await this.publishEvent(event);
        }

        entity.clearDomainEvents();
      }
    }
  }

  /**
   * 发布事件
   */
  async publishEvent(event) {
    // 默认实现：记录日志
    // 子类可以重写以提供事件总线
    console.log('Domain event published:', event);
  }

  /**
   * 健康检查
   */
  async healthCheck() {
    const checks = {
      useCases: this._useCases.size,
      repositories: this._repositories.size,
      domainServices: this._domainServices.size,
    };

    // 检查所有依赖的健康状态
    const repoChecks = [];
    for (const [name, repo] of this._repositories) {
      try {
        const health = await repo.healthCheck();
        repoChecks.push({ name, ...health });
      } catch (error) {
        repoChecks.push({ name, status: 'error', error: error.message });
      }
    }

    checks.repositoriesHealth = repoChecks;
    checks.overallStatus = repoChecks.every((r) => r.status === 'healthy')
      ? 'healthy'
      : 'unhealthy';

    return checks;
  }
}
