/**
 * 阈值管理器
 * 统一管理各种阈值设置和验证
 */

import { logger } from '../utils/logger.js';

export class ThresholdManager {
  constructor(options = {}) {
    this.options = {
      enableValidation: options.enableValidation !== false,
      enableMonitoring: options.enableMonitoring !== false,
      alertOnViolation: options.alertOnViolation !== false,
      ...options
    };

    this.thresholds = new Map();
    this.violations = new Map();
    this.alertHistory = [];
    this.monitoringIntervals = new Map();
  }

  /**
   * 定义阈值
   */
  defineThreshold(name, config) {
    const {
      type = 'numeric', // numeric, percentage, boolean, custom
      operator = 'gt', // gt, gte, lt, lte, eq, ne, between
      value,
      minValue,
      maxValue,
      severity = 'warning', // warning, error, critical
      description = '',
      category = 'general',
      enabled = true,
      cooldownMs = 300000, // 5分钟冷却时间
      alertCallback = null,
      metadata = {}
    } = config;

    // 验证配置
    if (type === 'numeric' || type === 'percentage') {
      if (operator === 'between' && (minValue === undefined || maxValue === undefined)) {
        throw new Error(`Threshold '${name}': between operator requires minValue and maxValue`);
      } else if (operator !== 'between' && value === undefined) {
        throw new Error(`Threshold '${name}': value is required for operator '${operator}'`);
      }
    }

    const threshold = {
      name,
      type,
      operator,
      value,
      minValue,
      maxValue,
      severity,
      description,
      category,
      enabled,
      cooldownMs,
      alertCallback,
      metadata,
      createdAt: Date.now(),
      lastViolation: null,
      violationCount: 0
    };

    this.thresholds.set(name, threshold);
    logger.debug(`Defined threshold: ${name}`, {
      type,
      operator,
      value,
      severity,
      category
    });

    return threshold;
  }

  /**
   * 批量定义阈值
   */
  defineThresholds(thresholdsConfig) {
    const results = [];

    for (const [name, config] of Object.entries(thresholdsConfig)) {
      try {
        const threshold = this.defineThreshold(name, config);
        results.push({ name, success: true, threshold });
      } catch (error) {
        logger.error(`Failed to define threshold '${name}'`, {
          error: error.message
        });
        results.push({ name, success: false, error: error.message });
      }
    }

    const successful = results.filter(r => r.success).length;
    logger.info(`Defined ${successful}/${results.length} thresholds`);

    return results;
  }

  /**
   * 预定义阈值模板
   */
  static getThresholdTemplates() {
    return {
      // 性能阈值
      performance: {
        responseTime: {
          type: 'numeric',
          operator: 'gt',
          value: 1000,
          severity: 'warning',
          description: 'Response time exceeds 1 second',
          category: 'performance'
        },
        throughput: {
          type: 'numeric',
          operator: 'lt',
          value: 10,
          severity: 'error',
          description: 'Throughput below minimum threshold',
          category: 'performance'
        },
        errorRate: {
          type: 'percentage',
          operator: 'gt',
          value: 5,
          severity: 'error',
          description: 'Error rate exceeds 5%',
          category: 'performance'
        }
      },

      // 系统资源阈值
      system: {
        memoryUsage: {
          type: 'percentage',
          operator: 'gt',
          value: 85,
          severity: 'warning',
          description: 'Memory usage exceeds 85%',
          category: 'system'
        },
        cpuUsage: {
          type: 'percentage',
          operator: 'gt',
          value: 90,
          severity: 'error',
          description: 'CPU usage exceeds 90%',
          category: 'system'
        },
        diskUsage: {
          type: 'percentage',
          operator: 'gt',
          value: 95,
          severity: 'critical',
          description: 'Disk usage exceeds 95%',
          category: 'system'
        }
      },

      // 网络阈值
      network: {
        latency: {
          type: 'numeric',
          operator: 'gt',
          value: 500,
          severity: 'warning',
          description: 'Network latency exceeds 500ms',
          category: 'network'
        },
        packetLoss: {
          type: 'percentage',
          operator: 'gt',
          value: 1,
          severity: 'error',
          description: 'Packet loss exceeds 1%',
          category: 'network'
        }
      },

      // 数据库阈值
      database: {
        connectionPoolUsage: {
          type: 'percentage',
          operator: 'gt',
          value: 80,
          severity: 'warning',
          description: 'Connection pool usage exceeds 80%',
          category: 'database'
        },
        slowQueryCount: {
          type: 'numeric',
          operator: 'gt',
          value: 10,
          severity: 'warning',
          description: 'Slow query count exceeds 10',
          category: 'database'
        }
      },

      // 缓存阈值
      cache: {
        hitRate: {
          type: 'percentage',
          operator: 'lt',
          value: 70,
          severity: 'warning',
          description: 'Cache hit rate below 70%',
          category: 'cache'
        },
        evictionRate: {
          type: 'numeric',
          operator: 'gt',
          value: 100,
          severity: 'warning',
          description: 'Cache eviction rate exceeds 100 per minute',
          category: 'cache'
        }
      }
    };
  }

  /**
   * 应用预定义阈值模板
   */
  applyTemplate(templateName, categories = null) {
    const templates = ThresholdManager.getThresholdTemplates();

    if (!templates[templateName]) {
      throw new Error(`Unknown threshold template: ${templateName}`);
    }

    const template = templates[templateName];
    let configsToApply = template;

    // 如果指定了类别，只应用这些类别的阈值
    if (categories) {
      configsToApply = {};
      for (const category of categories) {
        if (template[category]) {
          configsToApply = { ...configsToApply, ...template[category] };
        }
      }
    }

    return this.defineThresholds(configsToApply);
  }

  /**
   * 检查值是否违反阈值
   */
  checkThreshold(name, value, context = {}) {
    const threshold = this.thresholds.get(name);

    if (!threshold || !threshold.enabled) {
      return { violated: false, threshold: null };
    }

    const now = Date.now();
    let violated = false;
    let violationDetails = null;

    // 检查冷却时间
    if (threshold.lastViolation && (now - threshold.lastViolation) < threshold.cooldownMs) {
      return { violated: false, threshold, cooldown: true };
    }

    // 根据类型和操作符检查值
    switch (threshold.type) {
      case 'numeric':
      case 'percentage':
        violated = this.checkNumericThreshold(threshold, value);
        break;
      case 'boolean':
        violated = this.checkBooleanThreshold(threshold, value);
        break;
      case 'custom':
        violated = this.checkCustomThreshold(threshold, value);
        break;
      default:
        logger.warn(`Unknown threshold type: ${threshold.type}`);
        return { violated: false, threshold: null };
    }

    if (violated) {
      violationDetails = {
        threshold: threshold.name,
        value,
        expected: this.getExpectedValueDescription(threshold),
        severity: threshold.severity,
        timestamp: now,
        context
      };

      // 更新阈值状态
      threshold.lastViolation = now;
      threshold.violationCount++;

      // 记录违规
      this.recordViolation(threshold, violationDetails);

      // 触发告警
      if (this.options.alertOnViolation) {
        this.triggerAlert(threshold, violationDetails);
      }

      logger.warn(`Threshold violation: ${name}`, violationDetails);
    }

    return { violated, threshold, violation: violationDetails };
  }

  /**
   * 检查数值阈值
   */
  checkNumericThreshold(threshold, value) {
    const numValue = Number(value);
    if (isNaN(numValue)) return false;

    switch (threshold.operator) {
      case 'gt': return numValue > threshold.value;
      case 'gte': return numValue >= threshold.value;
      case 'lt': return numValue < threshold.value;
      case 'lte': return numValue <= threshold.value;
      case 'eq': return numValue === threshold.value;
      case 'ne': return numValue !== threshold.value;
      case 'between': return numValue >= threshold.minValue && numValue <= threshold.maxValue;
      default: return false;
    }
  }

  /**
   * 检查布尔阈值
   */
  checkBooleanThreshold(threshold, value) {
    const boolValue = Boolean(value);

    switch (threshold.operator) {
      case 'eq': return boolValue === threshold.value;
      case 'ne': return boolValue !== threshold.value;
      default: return false;
    }
  }

  /**
   * 检查自定义阈值
   */
  checkCustomThreshold(threshold, value) {
    if (typeof threshold.value === 'function') {
      try {
        return threshold.value(value);
      } catch (error) {
        logger.error(`Custom threshold check failed: ${threshold.name}`, {
          error: error.message
        });
        return false;
      }
    }
    return false;
  }

  /**
   * 获取期望值的描述
   */
  getExpectedValueDescription(threshold) {
    switch (threshold.operator) {
      case 'gt': return `> ${threshold.value}`;
      case 'gte': return `>= ${threshold.value}`;
      case 'lt': return `< ${threshold.value}`;
      case 'lte': return `<= ${threshold.value}`;
      case 'eq': return `= ${threshold.value}`;
      case 'ne': return `!= ${threshold.value}`;
      case 'between': return `between ${threshold.minValue} and ${threshold.maxValue}`;
      default: return threshold.value;
    }
  }

  /**
   * 批量检查阈值
   */
  checkThresholds(values, category = null) {
    const results = [];

    for (const [name, value] of Object.entries(values)) {
      const threshold = this.thresholds.get(name);

      if (!threshold) continue;
      if (category && threshold.category !== category) continue;

      const result = this.checkThreshold(name, value, { batch: true });
      if (result.violated) {
        results.push(result);
      }
    }

    return results;
  }

  /**
   * 记录违规
   */
  recordViolation(threshold, violationDetails) {
    const key = threshold.name;

    if (!this.violations.has(key)) {
      this.violations.set(key, []);
    }

    const violations = this.violations.get(key);
    violations.push(violationDetails);

    // 保持违规记录大小
    if (violations.length > 1000) {
      violations.splice(0, 500);
    }

    this.violations.set(key, violations);
  }

  /**
   * 触发告警
   */
  async triggerAlert(threshold, violationDetails) {
    // 记录告警历史
    this.alertHistory.push({
      ...violationDetails,
      alertId: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    });

    // 保持告警历史大小
    if (this.alertHistory.length > 5000) {
      this.alertHistory.splice(0, 2500);
    }

    // 调用阈值特定的回调
    if (threshold.alertCallback) {
      try {
        await threshold.alertCallback(violationDetails);
      } catch (error) {
        logger.error(`Threshold alert callback failed: ${threshold.name}`, {
          error: error.message
        });
      }
    }

    // 调用全局告警回调
    if (this.options.globalAlertCallback) {
      try {
        await this.options.globalAlertCallback(threshold, violationDetails);
      } catch (error) {
        logger.error('Global threshold alert callback failed', {
          error: error.message
        });
      }
    }
  }

  /**
   * 开始监控阈值
   */
  startMonitoring(intervalMs = 30000) {
    if (this.monitoringIntervals.has('main')) {
      logger.warn('Threshold monitoring already running');
      return;
    }

    const intervalId = setInterval(() => {
      this.performMonitoringCheck();
    }, intervalMs);

    this.monitoringIntervals.set('main', intervalId);

    logger.info('Started threshold monitoring', { intervalMs });
  }

  /**
   * 停止监控
   */
  stopMonitoring() {
    for (const [name, intervalId] of this.monitoringIntervals) {
      clearInterval(intervalId);
      logger.debug(`Stopped monitoring interval: ${name}`);
    }

    this.monitoringIntervals.clear();
    logger.info('Stopped threshold monitoring');
  }

  /**
   * 执行监控检查
   */
  async performMonitoringCheck() {
    if (!this.options.enableMonitoring) return;

    // 收集系统指标
    const systemMetrics = this.collectSystemMetrics();

    // 检查所有启用的阈值
    const violations = this.checkThresholds(systemMetrics);

    if (violations.length > 0) {
      logger.info(`Found ${violations.length} threshold violations during monitoring`);
    }
  }

  /**
   * 收集系统指标
   */
  collectSystemMetrics() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    return {
      memoryUsagePercent: (memUsage.heapUsed / memUsage.heapTotal) * 100,
      cpuUsagePercent: ((cpuUsage.user + cpuUsage.system) / 1000000) * 100,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      externalMemory: memUsage.external,
      uptime: process.uptime(),
      activeHandles: process._getActiveHandles ? process._getActiveHandles().length : 0,
      activeRequests: process._getActiveRequests ? process._getActiveRequests().length : 0
    };
  }

  /**
   * 获取阈值信息
   */
  getThreshold(name) {
    return this.thresholds.get(name) || null;
  }

  /**
   * 获取所有阈值
   */
  getAllThresholds(category = null) {
    const thresholds = Array.from(this.thresholds.values());

    if (category) {
      return thresholds.filter(t => t.category === category);
    }

    return thresholds;
  }

  /**
   * 获取违规历史
   */
  getViolations(name = null, limit = 100) {
    if (name) {
      const violations = this.violations.get(name) || [];
      return violations.slice(-limit);
    }

    // 返回所有违规
    const allViolations = [];
    for (const violations of this.violations.values()) {
      allViolations.push(...violations);
    }

    return allViolations
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * 获取告警历史
   */
  getAlertHistory(limit = 100) {
    return this.alertHistory
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * 获取统计信息
   */
  getStats() {
    const thresholds = Array.from(this.thresholds.values());
    const totalViolations = Array.from(this.violations.values())
      .reduce((sum, violations) => sum + violations.length, 0);

    const statsByCategory = {};
    const statsBySeverity = {};

    for (const threshold of thresholds) {
      // 按类别统计
      if (!statsByCategory[threshold.category]) {
        statsByCategory[threshold.category] = { total: 0, enabled: 0, violations: 0 };
      }
      statsByCategory[threshold.category].total++;
      if (threshold.enabled) {
        statsByCategory[threshold.category].enabled++;
        statsByCategory[threshold.category].violations += threshold.violationCount;
      }

      // 按严重程度统计
      if (!statsBySeverity[threshold.severity]) {
        statsBySeverity[threshold.severity] = { total: 0, enabled: 0, violations: 0 };
      }
      statsBySeverity[threshold.severity].total++;
      if (threshold.enabled) {
        statsBySeverity[threshold.severity].enabled++;
        statsBySeverity[threshold.severity].violations += threshold.violationCount;
      }
    }

    return {
      total: thresholds.length,
      enabled: thresholds.filter(t => t.enabled).length,
      disabled: thresholds.filter(t => !t.enabled).length,
      totalViolations,
      alertsTriggered: this.alertHistory.length,
      byCategory: statsByCategory,
      bySeverity: statsBySeverity,
      monitoringActive: this.monitoringIntervals.size > 0
    };
  }

  /**
   * 启用阈值
   */
  enableThreshold(name) {
    const threshold = this.thresholds.get(name);
    if (threshold) {
      threshold.enabled = true;
      logger.debug(`Enabled threshold: ${name}`);
      return true;
    }
    return false;
  }

  /**
   * 禁用阈值
   */
  disableThreshold(name) {
    const threshold = this.thresholds.get(name);
    if (threshold) {
      threshold.enabled = false;
      logger.debug(`Disabled threshold: ${name}`);
      return true;
    }
    return false;
  }

  /**
   * 更新阈值配置
   */
  updateThreshold(name, updates) {
    const threshold = this.thresholds.get(name);
    if (!threshold) return false;

    // 验证更新
    const updatedConfig = { ...threshold, ...updates };
    try {
      this.validateThresholdConfig(updatedConfig);
    } catch (error) {
      logger.error(`Invalid threshold update for '${name}'`, {
        error: error.message
      });
      return false;
    }

    // 应用更新
    Object.assign(threshold, updates);
    threshold.updatedAt = Date.now();

    logger.debug(`Updated threshold: ${name}`, updates);
    return true;
  }

  /**
   * 验证阈值配置
   */
  validateThresholdConfig(config) {
    const required = ['name', 'type', 'operator'];
    for (const field of required) {
      if (!config[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // 类型特定的验证
    if (config.type === 'numeric' || config.type === 'percentage') {
      if (config.operator === 'between') {
        if (config.minValue === undefined || config.maxValue === undefined) {
          throw new Error('between operator requires minValue and maxValue');
        }
      } else if (config.value === undefined) {
        throw new Error(`value is required for operator '${config.operator}'`);
      }
    }
  }

  /**
   * 删除阈值
   */
  removeThreshold(name) {
    const removed = this.thresholds.delete(name);
    if (removed) {
      this.violations.delete(name);
      logger.debug(`Removed threshold: ${name}`);
    }
    return removed;
  }

  /**
   * 清空所有阈值
   */
  clearAll() {
    const count = this.thresholds.size;
    this.thresholds.clear();
    this.violations.clear();
    this.alertHistory.length = 0;
    logger.info(`Cleared all thresholds and history (${count} thresholds removed)`);
  }

  /**
   * 导出配置
   */
  exportConfig() {
    const config = {
      options: this.options,
      thresholds: {},
      exportedAt: new Date().toISOString(),
      version: '1.0'
    };

    for (const [name, threshold] of this.thresholds) {
      config.thresholds[name] = { ...threshold };
      // 移除函数属性
      delete config.thresholds[name].alertCallback;
    }

    return config;
  }

  /**
   * 导入配置
   */
  importConfig(config) {
    if (!config.thresholds) {
      throw new Error('Invalid configuration: missing thresholds');
    }

    this.clearAll();

    if (config.options) {
      this.options = { ...this.options, ...config.options };
    }

    for (const [name, thresholdConfig] of Object.entries(config.thresholds)) {
      try {
        this.defineThreshold(name, thresholdConfig);
      } catch (error) {
        logger.error(`Failed to import threshold '${name}'`, {
          error: error.message
        });
      }
    }

    const imported = Object.keys(config.thresholds).length;
    logger.info(`Imported ${imported} thresholds from configuration`);
  }
}
