/**
 * 数据库迁移管理器
 * 管理数据库模式的版本控制和迁移
 */

import { logger } from '../../shared/utils/logger.js';
import fs from 'fs/promises';
import path from 'path';

export class MigrationManager {
  constructor(connectionPool, options = {}) {
    this.pool = connectionPool;
    this.options = {
      migrationsPath: options.migrationsPath || './migrations',
      schemaTable: options.schemaTable || 'schema_migrations',
      ...options,
    };

    this.migrations = new Map();
    this.executedMigrations = new Set();
  }

  /**
   * 初始化迁移系统
   */
  async initialize() {
    try {
      logger.info('初始化数据库迁移系统...');

      // 创建迁移历史表
      await this.createMigrationsTable();

      // 加载已执行的迁移
      await this.loadExecutedMigrations();

      // 加载可用的迁移文件
      await this.loadMigrationFiles();

      logger.info('数据库迁移系统初始化完成', {
        available: this.migrations.size,
        executed: this.executedMigrations.size,
      });

      return this;
    } catch (error) {
      logger.error('数据库迁移系统初始化失败', error);
      throw error;
    }
  }

  /**
   * 创建迁移历史表
   */
  async createMigrationsTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS ${this.options.schemaTable} (
        version VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        checksum VARCHAR(255),
        execution_time INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_migrations_executed_at
      ON ${this.options.schemaTable} (executed_at);
    `;

    await this.pool.query(query);
    logger.debug('迁移历史表创建完成');
  }

  /**
   * 加载已执行的迁移
   */
  async loadExecutedMigrations() {
    try {
      const result = await this.pool.query(
        `SELECT version, name, executed_at FROM ${this.options.schemaTable} ORDER BY executed_at`,
      );

      this.executedMigrations.clear();
      result.rows.forEach((row) => {
        this.executedMigrations.add(row.version);
      });

      logger.debug('已执行的迁移加载完成', {
        count: this.executedMigrations.size,
      });
    } catch (error) {
      logger.warn('加载已执行的迁移失败', error);
      // 如果表不存在，忽略错误
    }
  }

  /**
   * 加载迁移文件
   */
  async loadMigrationFiles() {
    try {
      const migrationsPath = path.resolve(this.options.migrationsPath);

      // 确保迁移目录存在
      try {
        await fs.access(migrationsPath);
      } catch {
        await fs.mkdir(migrationsPath, { recursive: true });
        logger.info('创建迁移目录', { path: migrationsPath });
        return;
      }

      const files = await fs.readdir(migrationsPath);
      const migrationFiles = files
        .filter((file) => file.endsWith('.js') || file.endsWith('.sql'))
        .sort();

      this.migrations.clear();

      for (const file of migrationFiles) {
        const filePath = path.join(migrationsPath, file);
        const migration = await this.loadMigrationFile(filePath);

        if (migration) {
          this.migrations.set(migration.version, migration);
        }
      }

      logger.info('迁移文件加载完成', {
        path: migrationsPath,
        count: this.migrations.size,
      });
    } catch (error) {
      logger.error('加载迁移文件失败', error);
      throw error;
    }
  }

  /**
   * 加载单个迁移文件
   */
  async loadMigrationFile(filePath) {
    try {
      const fileName = path.basename(filePath, path.extname(filePath));
      const version = fileName.split('_')[0];

      if (!version || isNaN(version)) {
        logger.warn('跳过无效的迁移文件', { file: fileName });
        return null;
      }

      let migration;

      if (filePath.endsWith('.js')) {
        // JavaScript 迁移文件
        const module = await import(filePath);
        migration = {
          version,
          name: fileName,
          up: module.up,
          down: module.down,
          checksum: await this.calculateChecksum(filePath),
        };
      } else if (filePath.endsWith('.sql')) {
        // SQL 迁移文件
        const content = await fs.readFile(filePath, 'utf8');
        const [upSql, downSql] = content.split('-- DOWN');

        migration = {
          version,
          name: fileName,
          up: async (pool) => {
            if (upSql.trim()) {
              await pool.query(upSql.trim());
            }
          },
          down: async (pool) => {
            if (downSql && downSql.trim()) {
              await pool.query(downSql.trim());
            }
          },
          checksum: await this.calculateChecksum(filePath),
        };
      }

      return migration;
    } catch (error) {
      logger.error('加载迁移文件失败', {
        file: filePath,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * 计算文件校验和
   */
  async calculateChecksum(filePath) {
    const crypto = await import('crypto');
    const content = await fs.readFile(filePath);
    return crypto.default.createHash('md5').update(content).digest('hex');
  }

  /**
   * 创建新的迁移文件
   */
  async createMigration(name, type = 'js') {
    const timestamp = Date.now();
    const version = timestamp.toString();
    const fileName = `${version}_${name}.${type}`;
    const filePath = path.join(this.options.migrationsPath, fileName);

    let content;

    if (type === 'js') {
      content = `/**
 * Migration: ${name}
 * Version: ${version}
 */

export async function up(pool) {
  // 在这里编写升级逻辑
  await pool.query(\`
    -- 升级 SQL
  \`);
}

export async function down(pool) {
  // 在这里编写降级逻辑
  await pool.query(\`
    -- 降级 SQL
  \`);
}
`;
    } else if (type === 'sql') {
      content = `-- Migration: ${name}
-- Version: ${version}

-- UP
-- 在这里编写升级 SQL

-- DOWN
-- 在这里编写降级 SQL
`;
    }

    await fs.writeFile(filePath, content, 'utf8');

    logger.info('迁移文件创建成功', {
      name,
      version,
      path: filePath,
    });

    return {
      version,
      name,
      path: filePath,
    };
  }

  /**
   * 执行迁移
   */
  async migrate(targetVersion = null) {
    const pendingMigrations = this.getPendingMigrations();

    if (pendingMigrations.length === 0) {
      logger.info('没有待执行的迁移');
      return { executed: [], skipped: 0 };
    }

    const toExecute = targetVersion
      ? pendingMigrations.filter((m) => m.version <= targetVersion)
      : pendingMigrations;

    const executed = [];
    let skipped = 0;

    for (const migration of toExecute) {
      try {
        logger.info('开始执行迁移', {
          version: migration.version,
          name: migration.name,
        });

        const startTime = Date.now();
        await this.pool.transaction(async (client) => {
          await migration.up(client);
        });
        const executionTime = Date.now() - startTime;

        // 记录迁移执行
        await this.recordMigration(migration, executionTime);

        executed.push({
          version: migration.version,
          name: migration.name,
          executionTime,
        });

        logger.info('迁移执行成功', {
          version: migration.version,
          executionTime: `${executionTime}ms`,
        });
      } catch (error) {
        logger.error('迁移执行失败', {
          version: migration.version,
          name: migration.name,
          error: error.message,
        });
        throw error;
      }
    }

    skipped = pendingMigrations.length - executed.length;

    logger.info('迁移执行完成', {
      executed: executed.length,
      skipped,
      total: pendingMigrations.length,
    });

    return { executed, skipped };
  }

  /**
   * 回滚迁移
   */
  async rollback(steps = 1) {
    const executedMigrations = Array.from(this.executedMigrations)
      .map((version) => this.migrations.get(version))
      .filter((m) => m)
      .sort((a, b) => b.version - a.version);

    if (executedMigrations.length === 0) {
      logger.info('没有可回滚的迁移');
      return { rolledBack: [] };
    }

    const toRollback = executedMigrations.slice(0, steps);
    const rolledBack = [];

    for (const migration of toRollback) {
      try {
        logger.info('开始回滚迁移', {
          version: migration.version,
          name: migration.name,
        });

        const startTime = Date.now();
        await this.pool.transaction(async (client) => {
          await migration.down(client);
        });
        const executionTime = Date.now() - startTime;

        // 删除迁移记录
        await this.removeMigrationRecord(migration.version);

        rolledBack.push({
          version: migration.version,
          name: migration.name,
          executionTime,
        });

        logger.info('迁移回滚成功', {
          version: migration.version,
          executionTime: `${executionTime}ms`,
        });
      } catch (error) {
        logger.error('迁移回滚失败', {
          version: migration.version,
          name: migration.name,
          error: error.message,
        });
        throw error;
      }
    }

    logger.info('迁移回滚完成', {
      rolledBack: rolledBack.length,
    });

    return { rolledBack };
  }

  /**
   * 获取待执行的迁移
   */
  getPendingMigrations() {
    return Array.from(this.migrations.values())
      .filter((migration) => !this.executedMigrations.has(migration.version))
      .sort((a, b) => a.version - b.version);
  }

  /**
   * 获取已执行的迁移
   */
  getExecutedMigrations() {
    return Array.from(this.executedMigrations)
      .map((version) => this.migrations.get(version))
      .filter((m) => m)
      .sort((a, b) => a.version - b.version);
  }

  /**
   * 记录迁移执行
   */
  async recordMigration(migration, executionTime) {
    await this.pool.query(
      `INSERT INTO ${this.options.schemaTable} (version, name, checksum, execution_time) VALUES ($1, $2, $3, $4)`,
      [migration.version, migration.name, migration.checksum, executionTime],
    );

    this.executedMigrations.add(migration.version);
  }

  /**
   * 删除迁移记录
   */
  async removeMigrationRecord(version) {
    await this.pool.query(
      `DELETE FROM ${this.options.schemaTable} WHERE version = $1`,
      [version],
    );

    this.executedMigrations.delete(version);
  }

  /**
   * 获取迁移状态
   */
  getStatus() {
    const pending = this.getPendingMigrations();
    const executed = this.getExecutedMigrations();

    return {
      currentVersion:
        executed.length > 0 ? executed[executed.length - 1].version : '0',
      pendingCount: pending.length,
      executedCount: executed.length,
      totalCount: this.migrations.size,
      pending: pending.map((m) => ({ version: m.version, name: m.name })),
      executed: executed.map((m) => ({
        version: m.version,
        name: m.name,
        executedAt: m.executedAt,
      })),
    };
  }

  /**
   * 验证迁移完整性
   */
  async verifyIntegrity() {
    const issues = [];

    try {
      // 检查迁移文件的校验和
      for (const [version, migration] of this.migrations) {
        if (migration.checksum) {
          const currentChecksum = await this.calculateChecksum(
            path.join(
              this.options.migrationsPath,
              `${version}_${migration.name}${path.extname(migration.name) || '.js'}`,
            ),
          );

          if (currentChecksum !== migration.checksum) {
            issues.push({
              type: 'checksum_mismatch',
              version,
              message: '迁移文件已被修改',
            });
          }
        }
      }

      // 检查执行记录的完整性
      const result = await this.pool.query(
        `SELECT version FROM ${this.options.schemaTable}`,
      );
      const recordedVersions = new Set(result.rows.map((row) => row.version));

      for (const version of this.executedMigrations) {
        if (!recordedVersions.has(version)) {
          issues.push({
            type: 'missing_record',
            version,
            message: '迁移已执行但记录缺失',
          });
        }
      }
    } catch (error) {
      issues.push({
        type: 'verification_error',
        message: `验证过程出错: ${error.message}`,
      });
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  /**
   * 清理迁移系统
   */
  async clean() {
    try {
      // 删除迁移历史表（谨慎使用）
      if (this.options.allowClean) {
        await this.pool.query(
          `DROP TABLE IF EXISTS ${this.options.schemaTable}`,
        );
        this.executedMigrations.clear();
        this.migrations.clear();
        logger.info('迁移系统已清理');
      }
    } catch (error) {
      logger.error('清理迁移系统失败', error);
      throw error;
    }
  }
}

export default MigrationManager;
