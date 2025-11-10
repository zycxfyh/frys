import { logger } from '../shared/utils/logger.js';

/**
 * SQLite 风格的轻量数据库
 * 借鉴 SQLite 的嵌入式数据库和ACID事务理念
 */

class SQLiteInspiredDatabase {
  constructor(filename = ':memory:') {
    this.filename = filename;
    this.tables = new Map();
    this.data = new Map();
    this.connected = true;
    logger.info(`��� SQLite数据库已创建: ${filename}`);
  }

  createTable(tableName, schema) {
    const table = {
      name: tableName,
      schema,
      records: [],
      indexes: new Map(),
      createdAt: Date.now(),
    };

    this.tables.set(tableName, table);
    logger.info(`��� 表已创建: ${tableName} (${schema.columns.length} 列)`);
    return table;
  }

  insert(tableName, data) {
    const table = this.tables.get(tableName);
    if (!table) {
      throw new Error(`Table ${tableName} not found`);
    }

    const record = {
      id: Date.now(),
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    table.records.push(record);
    logger.info(`��� 数据已插入: ${tableName}`);
    return record;
  }

  select(tableName, conditions = {}) {
    const table = this.tables.get(tableName);
    if (!table) {
      throw new Error(`Table ${tableName} not found`);
    }

    let results = table.records;
    if (conditions.where) {
      results = results.filter((record) => {
        for (const [key, value] of Object.entries(conditions.where)) {
          if (record[key] !== value) return false;
        }
        return true;
      });
    }

    logger.info(`��� 查询 ${tableName}: 找到 ${results.length} 行`);
    return results;
  }

  getStats() {
    return {
      tables: this.tables.size,
      totalRecords: Array.from(this.tables.values()).reduce(
        (sum, table) => sum + table.records.length,
        0,
      ),
    };
  }
}

export default SQLiteInspiredDatabase;
