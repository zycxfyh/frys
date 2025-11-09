#!/usr/bin/env node

/**
 * frys 智能回退协调器
 * 集成智能回退管理系统，提供命令行接口
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import SmartRollbackManager from '../src/core/SmartRollbackManager.js';
import { logger } from '../src/utils/logger.js';

class SmartRollbackCoordinator {
  constructor(options = {}) {
    this.options = {
      environment:
        options.environment || process.env.DEPLOY_ENV || 'production',
      healthCheckUrl:
        options.healthCheckUrl ||
        process.env.HEALTH_CHECK_URL ||
        'http://localhost:3000/health',
      enableAutoRollback: options.enableAutoRollback !== false,
      monitoringMode: options.monitoringMode || false,
      ...options,
    };

    this.rollbackManager = new SmartRollbackManager({
      environment: this.options.environment,
      healthCheckUrl: this.options.healthCheckUrl,
      enableAutoRollback: this.options.enableAutoRollback,
    });

    this.rollbackStats = {
      totalRollbacks: 0,
      successfulRollbacks: 0,
      failedRollbacks: 0,
      averageRollbackTime: 0,
    };

    logger.info('🎯 智能回退协调器已初始化', {
      environment: this.options.environment,
      autoRollback: this.options.enableAutoRollback,
      monitoringMode: this.options.monitoringMode,
    });
  }

  /**
   * 启动监控模式
   */
  async startMonitoring() {
    logger.info('启动智能回退监控模式...');

    // 处理进程信号
    process.on('SIGINT', () => this.handleShutdown('SIGINT'));
    process.on('SIGTERM', () => this.handleShutdown('SIGTERM'));

    // 启动健康监控
    this.rollbackManager.startMonitoring();

    // 如果是监控模式，保持运行
    if (this.options.monitoringMode) {
      logger.info('进入持续监控模式，按 Ctrl+C 退出');

      // 定期报告状态
      setInterval(() => {
        this.reportStatus();
      }, 60000); // 每分钟报告一次

      // 保持进程运行
      return new Promise(() => {}); // 不会resolve，除非被中断
    }
  }

  /**
   * 处理关闭信号
   */
  handleShutdown(signal) {
    logger.info(`收到关闭信号: ${signal}，正在优雅关闭...`);

    this.rollbackManager.stopMonitoring();

    // 保存回退统计
    this.saveRollbackStats();

    logger.info('智能回退协调器已关闭');
    process.exit(0);
  }

  /**
   * 执行手动回退
   */
  async executeManualRollback(
    strategy = 'environment_switch',
    reason = 'manual',
  ) {
    const startTime = Date.now();

    logger.info(`执行手动回退: ${strategy}`, { reason });

    try {
      const success = await this.rollbackManager.manualRollback(
        strategy,
        reason,
      );

      const duration = Date.now() - startTime;
      this.updateRollbackStats(success, duration);

      if (success) {
        logger.info(`✅ 手动回退成功完成`, {
          strategy,
          reason,
          duration: `${duration}ms`,
        });

        await this.postRollbackVerification();
      } else {
        logger.error(`❌ 手动回退失败`, { strategy, reason });
      }

      return success;
    } catch (error) {
      logger.error('手动回退执行出错', error);
      return false;
    }
  }

  /**
   * 执行健康检查驱动的回退
   */
  async executeHealthTriggeredRollback() {
    logger.info('执行健康检查驱动的回退...');

    // 强制执行一次健康评估
    await this.rollbackManager.performHealthAssessment();

    // 检查是否触发了回退
    const healthStatus = this.rollbackManager.getHealthStatus();

    logger.info('健康状态检查完成', {
      status: healthStatus.status,
      consecutiveFailures: healthStatus.consecutiveFailures,
      isRollingBack: healthStatus.isRollingBack,
    });

    return healthStatus;
  }

  /**
   * 执行紧急回退
   */
  async executeEmergencyRollback(reason = 'emergency') {
    logger.warn(`执行紧急回退: ${reason}`);

    try {
      await this.rollbackManager.triggerEmergencyRollback(reason, {
        triggeredBy: 'coordinator',
        timestamp: new Date().toISOString(),
      });

      logger.warn('紧急回退已执行');
      return true;
    } catch (error) {
      logger.error('紧急回退失败', error);
      return false;
    }
  }

  /**
   * 回退后验证
   */
  async postRollbackVerification() {
    logger.info('执行回退后验证...');

    try {
      // 等待系统稳定
      await this.delay(10000); // 等待10秒

      // 执行健康检查
      const healthCheck = await this.checkSystemHealth();

      if (healthCheck.healthy) {
        logger.info('✅ 回退后验证通过，系统健康');
        return true;
      } else {
        logger.error('❌ 回退后验证失败，系统仍不健康', healthCheck);
        return false;
      }
    } catch (error) {
      logger.error('回退后验证出错', error);
      return false;
    }
  }

  /**
   * 检查系统健康状态
   */
  async checkSystemHealth() {
    try {
      const response = await fetch(this.options.healthCheckUrl, {
        timeout: 10000,
        headers: { 'User-Agent': 'SmartRollback-Verification' },
      });

      if (response.ok) {
        const healthData = await response.json();
        return {
          healthy: healthData.status === 'healthy',
          responseTime: Date.now() - Date.parse(healthData.timestamp),
          data: healthData,
        };
      } else {
        return {
          healthy: false,
          statusCode: response.status,
          error: `Health check returned ${response.status}`,
        };
      }
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
      };
    }
  }

  /**
   * 更新回退统计
   */
  updateRollbackStats(success, duration) {
    this.rollbackStats.totalRollbacks++;

    if (success) {
      this.rollbackStats.successfulRollbacks++;
    } else {
      this.rollbackStats.failedRollbacks++;
    }

    // 更新平均回退时间
    const totalTime =
      this.rollbackStats.averageRollbackTime *
        (this.rollbackStats.totalRollbacks - 1) +
      duration;
    this.rollbackStats.averageRollbackTime =
      totalTime / this.rollbackStats.totalRollbacks;
  }

  /**
   * 报告状态
   */
  reportStatus() {
    const healthStatus = this.rollbackManager.getHealthStatus();
    const rollbackHistory = this.rollbackManager.getRollbackHistory();

    logger.info('📊 智能回退状态报告', {
      healthStatus: healthStatus.status,
      consecutiveFailures: healthStatus.consecutiveFailures,
      isRollingBack: healthStatus.isRollingBack,
      totalRollbacks: this.rollbackStats.totalRollbacks,
      successfulRollbacks: this.rollbackStats.successfulRollbacks,
      failedRollbacks: this.rollbackStats.failedRollbacks,
      averageRollbackTime: `${Math.round(this.rollbackStats.averageRollbackTime)}ms`,
      recentRollbacks: rollbackHistory.slice(-5).length,
    });
  }

  /**
   * 获取回退报告
   */
  generateRollbackReport() {
    const healthStatus = this.rollbackManager.getHealthStatus();
    const rollbackHistory = this.rollbackManager.getRollbackHistory();

    const report = {
      timestamp: new Date().toISOString(),
      coordinator: {
        environment: this.options.environment,
        autoRollbackEnabled: this.options.enableAutoRollback,
        monitoringMode: this.options.monitoringMode,
      },
      healthStatus,
      rollbackStats: this.rollbackStats,
      rollbackHistory: rollbackHistory.slice(-10), // 最近10条记录
      recommendations: this.generateRecommendations(
        healthStatus,
        rollbackHistory,
      ),
    };

    return report;
  }

  /**
   * 生成建议
   */
  generateRecommendations(healthStatus, rollbackHistory) {
    const recommendations = [];

    // 基于健康状态的建议
    if (healthStatus.consecutiveFailures > 5) {
      recommendations.push({
        type: 'critical',
        message: '连续失败次数过多，建议检查系统配置和外部依赖',
        action: 'investigate_system_configuration',
      });
    }

    if (healthStatus.status === 'unhealthy') {
      recommendations.push({
        type: 'urgent',
        message: '系统健康状态不佳，建议立即执行回退',
        action: 'execute_rollback',
      });
    }

    // 基于回退历史的建议
    const recentRollbacks = rollbackHistory.filter(
      (r) => Date.now() - new Date(r.timestamp) < 24 * 60 * 60 * 1000, // 24小时内
    );

    if (recentRollbacks.length > 3) {
      recommendations.push({
        type: 'warning',
        message: '24小时内回退次数过多，建议检查代码质量和部署流程',
        action: 'review_deployment_process',
      });
    }

    // 基于成功率的建议
    const successRate =
      this.rollbackStats.totalRollbacks > 0
        ? this.rollbackStats.successfulRollbacks /
          this.rollbackStats.totalRollbacks
        : 1;

    if (successRate < 0.8) {
      recommendations.push({
        type: 'info',
        message: '回退成功率较低，建议优化回退策略和验证流程',
        action: 'optimize_rollback_strategies',
      });
    }

    return recommendations;
  }

  /**
   * 保存回退统计
   */
  saveRollbackStats() {
    const statsFile = path.join(process.cwd(), 'rollback-stats.json');

    try {
      const report = this.generateRollbackReport();
      fs.writeFileSync(statsFile, JSON.stringify(report, null, 2));
      logger.info(`回退统计已保存至: ${statsFile}`);
    } catch (error) {
      logger.error('保存回退统计失败', error);
    }
  }

  /**
   * 延迟函数
   */
  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 显示帮助信息
   */
  showHelp() {
    console.log(`
frys 智能回退协调器

用法: node scripts/smart-rollback.js [命令] [选项]

命令:
  monitor              启动监控模式
  rollback [策略]      执行手动回退
  emergency [原因]     执行紧急回退
  health               检查系统健康状态
  status               显示当前状态
  report               生成回退报告

选项:
  --env=ENV           环境 (development/staging/production)
  --url=URL           健康检查URL
  --no-auto           禁用自动回退
  --help              显示此帮助信息

策略:
  circuit_breaker     熔断器模式
  traffic_shifting    流量切换
  environment_switch  环境切换 (默认)
  version_rollback    版本回滚
  emergency_shutdown  紧急停止

示例:
  node scripts/smart-rollback.js monitor --env production
  node scripts/smart-rollback.js rollback environment_switch --reason "manual deployment"
  node scripts/smart-rollback.js emergency "database failure"
  node scripts/smart-rollback.js status
    `);
  }

  /**
   * 主执行函数
   */
  async run() {
    const args = process.argv.slice(2);

    if (args.length === 0 || args.includes('--help')) {
      this.showHelp();
      return;
    }

    const command = args[0];

    try {
      switch (command) {
        case 'monitor':
          await this.startMonitoring();
          break;

        case 'rollback': {
          const strategy = args[1] || 'environment_switch';
          const reason =
            args.find((arg) => arg.startsWith('--reason='))?.split('=')[1] ||
            'manual';
          const success = await this.executeManualRollback(strategy, reason);
          process.exit(success ? 0 : 1);
          break;
        }

        case 'emergency': {
          const emergencyReason = args[1] || 'emergency';
          const emergencySuccess =
            await this.executeEmergencyRollback(emergencyReason);
          process.exit(emergencySuccess ? 0 : 1);
          break;
        }

        case 'health': {
          const healthResult = await this.checkSystemHealth();
          console.log(JSON.stringify(healthResult, null, 2));
          process.exit(healthResult.healthy ? 0 : 1);
          break;
        }

        case 'status': {
          this.reportStatus();
          const status = this.rollbackManager.getHealthStatus();
          console.log(JSON.stringify(status, null, 2));
          break;
        }

        case 'report': {
          const report = this.generateRollbackReport();
          console.log(JSON.stringify(report, null, 2));
          break;
        }

        default:
          console.error(`未知命令: ${command}`);
          this.showHelp();
          process.exit(1);
      }
    } catch (error) {
      logger.error('智能回退协调器执行失败', error);
      process.exit(1);
    }
  }
}

// 执行智能回退协调器
const coordinator = new SmartRollbackCoordinator();

// 解析命令行参数
const args = process.argv.slice(2);
const parsedOptions = {};

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg.startsWith('--env=')) {
    parsedOptions.environment = arg.split('=')[1];
  } else if (arg.startsWith('--url=')) {
    parsedOptions.healthCheckUrl = arg.split('=')[1];
  } else if (arg === '--no-auto') {
    parsedOptions.enableAutoRollback = false;
  } else if (arg === '--monitor') {
    parsedOptions.monitoringMode = true;
  }
}

const finalCoordinator = new SmartRollbackCoordinator(parsedOptions);
finalCoordinator.run().catch((error) => {
  console.error('智能回退协调器运行失败:', error);
  process.exit(1);
});
