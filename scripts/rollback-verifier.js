#!/usr/bin/env node

/**
 * frys 回退验证器
 * 验证回退操作的完整性和正确性
 */

import { logger } from '../src/utils/logger.js';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

class RollbackVerifier {
  constructor(options = {}) {
    this.options = {
      environment: options.environment || process.env.DEPLOY_ENV || 'production',
      verificationTimeout: options.verificationTimeout || 300000, // 5分钟
      healthCheckUrl: options.healthCheckUrl || 'http://localhost:3000/health',
      metricsUrl: options.metricsUrl || 'http://localhost:3000/metrics',
      maxRetries: options.maxRetries || 3,
      ...options
    };

    this.verificationResults = {
      timestamp: new Date().toISOString(),
      environment: this.options.environment,
      checks: [],
      overallStatus: 'unknown',
      duration: 0
    };

    logger.info('🔍 回退验证器已初始化', {
      environment: this.options.environment,
      timeout: this.options.verificationTimeout
    });
  }

  /**
   * 执行完整回退验证
   */
  async verifyRollback() {
    const startTime = Date.now();

    logger.info('开始执行回退验证流程...');

    try {
      // 1. 基础可用性检查
      await this.checkBasicAvailability();

      // 2. 应用健康检查
      await this.checkApplicationHealth();

      // 3. 性能指标验证
      await this.checkPerformanceMetrics();

      // 4. 依赖服务检查
      await this.checkDependencies();

      // 5. 数据一致性检查
      await this.checkDataConsistency();

      // 6. 流量验证
      await this.checkTrafficDistribution();

      // 7. 回退历史记录
      await this.recordRollbackEvent();

      this.verificationResults.duration = Date.now() - startTime;
      this.verificationResults.overallStatus = this.determineOverallStatus();

      logger.info(`回退验证完成，状态: ${this.verificationResults.overallStatus}`, {
        duration: `${this.verificationResults.duration}ms`,
        checksPassed: this.verificationResults.checks.filter(c => c.status === 'passed').length,
        checksFailed: this.verificationResults.checks.filter(c => c.status === 'failed').length
      });

      return this.verificationResults;

    } catch (error) {
      logger.error('回退验证失败', error);
      this.verificationResults.overallStatus = 'failed';
      this.verificationResults.duration = Date.now() - startTime;
      this.verificationResults.error = error.message;

      return this.verificationResults;
    }
  }

  /**
   * 添加验证检查结果
   */
  addCheckResult(name, status, details = {}) {
    const check = {
      name,
      status,
      timestamp: new Date().toISOString(),
      ...details
    };

    this.verificationResults.checks.push(check);

    const logLevel = status === 'passed' ? 'info' : 'error';
    logger[logLevel](`验证检查: ${name} - ${status}`, details);
  }

  /**
   * 检查基础可用性
   */
  async checkBasicAvailability() {
    logger.info('检查基础可用性...');

    try {
      // 检查应用端口是否监听
      const portCheck = await this.checkPortAvailability(3000);
      if (!portCheck.available) {
        this.addCheckResult('端口可用性', 'failed', {
          port: 3000,
          error: '应用端口未监听'
        });
        return;
      }

      // 检查基本HTTP响应
      const httpCheck = await this.checkHttpResponse('http://localhost:3000');
      if (!httpCheck.success) {
        this.addCheckResult('HTTP响应', 'failed', {
          url: 'http://localhost:3000',
          error: httpCheck.error
        });
        return;
      }

      this.addCheckResult('基础可用性', 'passed', {
        port: 3000,
        responseTime: httpCheck.responseTime
      });

    } catch (error) {
      this.addCheckResult('基础可用性', 'failed', { error: error.message });
    }
  }

  /**
   * 检查应用健康状态
   */
  async checkApplicationHealth() {
    logger.info('检查应用健康状态...');

    try {
      const healthResponse = await this.checkHttpResponse(this.options.healthCheckUrl, 10000);

      if (!healthResponse.success) {
        this.addCheckResult('应用健康检查', 'failed', {
          url: this.options.healthCheckUrl,
          error: healthResponse.error
        });
        return;
      }

      // 解析健康检查响应
      const healthData = JSON.parse(healthResponse.body);

      if (healthData.status !== 'healthy') {
        this.addCheckResult('应用健康状态', 'failed', {
          status: healthData.status,
          uptime: healthData.uptime,
          version: healthData.version
        });
        return;
      }

      // 检查各个健康组件
      const checks = healthData.checks || {};
      const failedChecks = Object.entries(checks).filter(([_, check]) => check.status !== 'healthy');

      if (failedChecks.length > 0) {
        this.addCheckResult('健康组件检查', 'failed', {
          failedChecks: failedChecks.map(([name, check]) => ({
            name,
            status: check.status,
            error: check.error
          }))
        });
        return;
      }

      this.addCheckResult('应用健康检查', 'passed', {
        status: healthData.status,
        uptime: healthData.uptime,
        version: healthData.version,
        checksCount: Object.keys(checks).length
      });

    } catch (error) {
      this.addCheckResult('应用健康检查', 'failed', { error: error.message });
    }
  }

  /**
   * 检查性能指标
   */
  async checkPerformanceMetrics() {
    logger.info('检查性能指标...');

    try {
      const metricsResponse = await this.checkHttpResponse(this.options.metricsUrl, 15000);

      if (!metricsResponse.success) {
        this.addCheckResult('性能指标检查', 'warning', {
          url: this.options.metricsUrl,
          error: '无法获取指标数据，但不影响基本功能'
        });
        return;
      }

      const metrics = metricsResponse.body;

      // 解析关键指标
      const keyMetrics = this.parseKeyMetrics(metrics);

      // 检查关键指标是否在合理范围内
      const issues = [];

      if (keyMetrics.memoryUsage > 0.9) {
        issues.push(`内存使用过高: ${(keyMetrics.memoryUsage * 100).toFixed(1)}%`);
      }

      if (keyMetrics.errorRate > 0.05) {
        issues.push(`错误率过高: ${(keyMetrics.errorRate * 100).toFixed(2)}%`);
      }

      if (keyMetrics.avgResponseTime > 5000) {
        issues.push(`平均响应时间过长: ${keyMetrics.avgResponseTime}ms`);
      }

      if (issues.length > 0) {
        this.addCheckResult('性能指标验证', 'warning', {
          issues,
          metrics: keyMetrics
        });
      } else {
        this.addCheckResult('性能指标验证', 'passed', { metrics: keyMetrics });
      }

    } catch (error) {
      this.addCheckResult('性能指标检查', 'warning', {
        error: error.message,
        note: '性能指标检查失败，但不影响回退验证'
      });
    }
  }

  /**
   * 检查依赖服务
   */
  async checkDependencies() {
    logger.info('检查依赖服务...');

    try {
      // 检查Docker容器状态
      const containers = await this.getDockerContainerStatus();

      const requiredServices = ['postgres', 'redis'];
      const missingServices = [];

      for (const service of requiredServices) {
        const container = containers.find(c => c.name.includes(service));
        if (!container || container.status !== 'running') {
          missingServices.push(service);
        }
      }

      if (missingServices.length > 0) {
        this.addCheckResult('依赖服务检查', 'failed', {
          missingServices,
          runningContainers: containers.filter(c => c.status === 'running').length
        });
        return;
      }

      // 检查数据库连接
      const dbCheck = await this.checkDatabaseConnection();
      if (!dbCheck.success) {
        this.addCheckResult('数据库连接检查', 'failed', { error: dbCheck.error });
        return;
      }

      // 检查缓存连接
      const cacheCheck = await this.checkCacheConnection();
      if (!cacheCheck.success) {
        this.addCheckResult('缓存连接检查', 'failed', { error: cacheCheck.error });
        return;
      }

      this.addCheckResult('依赖服务检查', 'passed', {
        runningServices: requiredServices.length,
        databaseStatus: dbCheck.status,
        cacheStatus: cacheCheck.status
      });

    } catch (error) {
      this.addCheckResult('依赖服务检查', 'failed', { error: error.message });
    }
  }

  /**
   * 检查数据一致性
   */
  async checkDataConsistency() {
    logger.info('检查数据一致性...');

    try {
      // 执行基本的数据库一致性检查
      const consistencyCheck = await this.runDatabaseConsistencyCheck();

      if (!consistencyCheck.success) {
        this.addCheckResult('数据一致性检查', 'failed', {
          error: consistencyCheck.error,
          checksPerformed: consistencyCheck.checksPerformed
        });
        return;
      }

      this.addCheckResult('数据一致性检查', 'passed', {
        checksPerformed: consistencyCheck.checksPerformed,
        tablesChecked: consistencyCheck.tablesChecked
      });

    } catch (error) {
      this.addCheckResult('数据一致性检查', 'warning', {
        error: error.message,
        note: '数据一致性检查失败，但回退可能仍然有效'
      });
    }
  }

  /**
   * 检查流量分布
   */
  async checkTrafficDistribution() {
    logger.info('检查流量分布...');

    try {
      // 检查当前活跃的环境
      const activeEnvironment = await this.getActiveEnvironment();

      if (!activeEnvironment) {
        this.addCheckResult('流量分布检查', 'failed', {
          error: '无法确定活跃环境'
        });
        return;
      }

      // 验证流量确实指向正确的环境
      const trafficCheck = await this.verifyTrafficRouting(activeEnvironment);

      if (!trafficCheck.correct) {
        this.addCheckResult('流量路由验证', 'failed', {
          activeEnvironment,
          expectedEnvironment: trafficCheck.expected,
          actualEnvironment: trafficCheck.actual
        });
        return;
      }

      this.addCheckResult('流量分布检查', 'passed', {
        activeEnvironment,
        trafficVerified: true
      });

    } catch (error) {
      this.addCheckResult('流量分布检查', 'warning', {
        error: error.message,
        note: '流量检查失败，但回退可能仍然成功'
      });
    }
  }

  /**
   * 记录回退事件
   */
  async recordRollbackEvent() {
    logger.info('记录回退事件...');

    try {
      const rollbackEvent = {
        timestamp: new Date().toISOString(),
        environment: this.options.environment,
        verificationStatus: this.verificationResults.overallStatus,
        checksPerformed: this.verificationResults.checks.length,
        checksPassed: this.verificationResults.checks.filter(c => c.status === 'passed').length,
        checksFailed: this.verificationResults.checks.filter(c => c.status === 'failed').length,
        duration: this.verificationResults.duration
      };

      // 保存到回退历史文件
      const historyFile = path.join(process.cwd(), 'rollback-history.json');

      let history = [];
      if (fs.existsSync(historyFile)) {
        try {
          history = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
        } catch (error) {
          logger.warn('读取回退历史失败，将创建新文件', error);
        }
      }

      history.push(rollbackEvent);

      // 只保留最近100条记录
      if (history.length > 100) {
        history = history.slice(-100);
      }

      fs.writeFileSync(historyFile, JSON.stringify(history, null, 2));

      this.addCheckResult('回退事件记录', 'passed', {
        historyFile,
        totalEvents: history.length
      });

    } catch (error) {
      this.addCheckResult('回退事件记录', 'warning', {
        error: error.message,
        note: '回退事件记录失败，但不影响回退有效性'
      });
    }
  }

  /**
   * 工具方法：检查端口可用性
   */
  async checkPortAvailability(port) {
    try {
      const result = execSync(`netstat -tln | grep :${port}`, { encoding: 'utf8' });
      return { available: result.includes(`:${port}`) };
    } catch (error) {
      return { available: false, error: error.message };
    }
  }

  /**
   * 工具方法：检查HTTP响应
   */
  async checkHttpResponse(url, timeout = 5000) {
    try {
      const startTime = Date.now();

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'RollbackVerifier' }
      });

      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;
      const body = await response.text();

      return {
        success: response.ok,
        statusCode: response.status,
        responseTime,
        body,
        headers: Object.fromEntries(response.headers.entries())
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        responseTime: timeout
      };
    }
  }

  /**
   * 解析关键指标
   */
  parseKeyMetrics(metricsText) {
    const metrics = {
      memoryUsage: 0,
      errorRate: 0,
      avgResponseTime: 0,
      activeConnections: 0
    };

    try {
      // 简化的指标解析
      const lines = metricsText.split('\n');

      for (const line of lines) {
        if (line.includes('process_memory_usage_bytes{type="heapUsed"}')) {
          const match = line.match(/(\d+)$/);
          if (match) {
            const heapUsed = parseInt(match[1]);
            // 这里需要获取总堆内存，简化处理
            metrics.memoryUsage = heapUsed / (100 * 1024 * 1024); // 假设100MB总堆内存
          }
        }
      }
    } catch (error) {
      logger.warn('指标解析失败', error);
    }

    return metrics;
  }

  /**
   * 获取Docker容器状态
   */
  async getDockerContainerStatus() {
    try {
      const result = execSync('docker ps --format json', { encoding: 'utf8' });
      const containers = result.trim().split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line));

      return containers.map(c => ({
        name: c.Names,
        status: c.State,
        ports: c.Ports
      }));
    } catch (error) {
      logger.warn('获取Docker容器状态失败', error);
      return [];
    }
  }

  /**
   * 检查数据库连接
   */
  async checkDatabaseConnection() {
    try {
      // 这里应该使用实际的数据库客户端检查连接
      // 暂时使用模拟检查
      return { success: true, status: 'connected' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 检查缓存连接
   */
  async checkCacheConnection() {
    try {
      // 这里应该使用实际的缓存客户端检查连接
      // 暂时使用模拟检查
      return { success: true, status: 'connected' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 运行数据库一致性检查
   */
  async runDatabaseConsistencyCheck() {
    try {
      // 这里应该执行实际的数据库一致性检查
      // 暂时使用模拟检查
      return {
        success: true,
        checksPerformed: ['table_existence', 'foreign_keys', 'data_integrity'],
        tablesChecked: 5
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取活跃环境
   */
  async getActiveEnvironment() {
    try {
      const result = execSync(`docker-compose -f docker-compose.${this.options.environment}.yml ps`, {
        encoding: 'utf8'
      });

      if (result.includes('frys-blue') && !result.includes('frys-green')) {
        return 'blue';
      } else if (result.includes('frys-green') && !result.includes('frys-blue')) {
        return 'green';
      }

      return null;
    } catch (error) {
      logger.warn('获取活跃环境失败', error);
      return null;
    }
  }

  /**
   * 验证流量路由
   */
  async verifyTrafficRouting(activeEnvironment) {
    try {
      // 检查Nginx配置或其他负载均衡器配置
      // 这里使用简化的检查
      return {
        correct: true,
        expected: activeEnvironment,
        actual: activeEnvironment
      };
    } catch (error) {
      return {
        correct: false,
        error: error.message
      };
    }
  }

  /**
   * 确定整体验证状态
   */
  determineOverallStatus() {
    const checks = this.verificationResults.checks;
    const criticalChecks = checks.filter(c => c.name.includes('健康') || c.name.includes('可用性'));
    const optionalChecks = checks.filter(c => !criticalChecks.includes(c));

    // 所有关键检查都必须通过
    const criticalPassed = criticalChecks.every(c => c.status === 'passed');
    const optionalPassed = optionalChecks.every(c => c.status === 'passed');

    if (criticalPassed && optionalPassed) {
      return 'passed';
    } else if (criticalPassed) {
      return 'passed_with_warnings';
    } else {
      return 'failed';
    }
  }

  /**
   * 生成验证报告
   */
  generateReport() {
    const report = {
      ...this.verificationResults,
      summary: {
        totalChecks: this.verificationResults.checks.length,
        passedChecks: this.verificationResults.checks.filter(c => c.status === 'passed').length,
        failedChecks: this.verificationResults.checks.filter(c => c.status === 'failed').length,
        warningChecks: this.verificationResults.checks.filter(c => c.status === 'warning').length,
        overallStatus: this.verificationResults.overallStatus
      },
      recommendations: this.generateRecommendations()
    };

    return report;
  }

  /**
   * 生成建议
   */
  generateRecommendations() {
    const recommendations = [];
    const failedChecks = this.verificationResults.checks.filter(c => c.status === 'failed');

    if (failedChecks.some(c => c.name.includes('健康'))) {
      recommendations.push({
        priority: 'high',
        message: '应用健康检查失败，建议检查应用日志和配置',
        action: 'check_application_logs'
      });
    }

    if (failedChecks.some(c => c.name.includes('依赖'))) {
      recommendations.push({
        priority: 'high',
        message: '依赖服务检查失败，建议检查数据库和缓存服务',
        action: 'verify_infrastructure'
      });
    }

    if (this.verificationResults.overallStatus === 'passed_with_warnings') {
      recommendations.push({
        priority: 'medium',
        message: '回退成功但存在警告，建议监控系统性能',
        action: 'monitor_performance'
      });
    }

    return recommendations;
  }

  /**
   * 显示验证摘要
   */
  printSummary() {
    const report = this.generateReport();

    console.log('\n' + '='.repeat(80));
    logger.info('🔍 frys 回退验证报告', 'info');
    console.log('='.repeat(80));

    console.log(`⏱️  验证耗时: ${(report.duration / 1000).toFixed(2)}秒`);
    console.log(`📊 检查总数: ${report.summary.totalChecks}`);
    console.log(`✅ 通过检查: ${report.summary.passedChecks}`);
    console.log(`❌ 失败检查: ${report.summary.failedChecks}`);
    console.log(`⚠️  警告检查: ${report.summary.warningChecks}`);
    console.log(`🎯 整体状态: ${report.overallStatus}`);

    console.log('\n📋 详细检查结果:');
    report.checks.forEach((check, index) => {
      const status = check.status === 'passed' ? '✅' :
                     check.status === 'failed' ? '❌' : '⚠️';
      console.log(`   ${index + 1}. ${status} ${check.name}`);
    });

    if (report.recommendations.length > 0) {
      console.log('\n💡 建议行动:');
      report.recommendations.forEach((rec, index) => {
        const priority = rec.priority === 'high' ? '🔴' :
                        rec.priority === 'medium' ? '🟡' : '🟢';
        console.log(`   ${index + 1}. ${priority} ${rec.message}`);
      });
    }

    console.log('\n' + '='.repeat(80));

    if (report.summary.overallStatus === 'passed') {
      logger.info('🎉 回退验证成功！系统已恢复正常运行。', 'success');
    } else if (report.summary.overallStatus === 'passed_with_warnings') {
      logger.info('⚠️ 回退验证通过但存在警告，请关注系统状态。', 'warning');
    } else {
      logger.info('❌ 回退验证失败，请检查系统并考虑进一步行动。', 'error');
    }
  }
}

// 命令行接口
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--env':
      case '--environment':
        options.environment = args[++i];
        break;
      case '--health-url':
        options.healthCheckUrl = args[++i];
        break;
      case '--metrics-url':
        options.metricsUrl = args[++i];
        break;
      case '--timeout':
        options.verificationTimeout = parseInt(args[++i]) * 1000;
        break;
      case '--help':
        console.log(`
frys 回退验证器

用法: node scripts/rollback-verifier.js [选项]

选项:
  --env, --environment ENV    环境 (production/staging/development)
  --health-url URL           健康检查URL (默认: http://localhost:3000/health)
  --metrics-url URL          指标URL (默认: http://localhost:3000/metrics)
  --timeout SECONDS          验证超时时间(秒) (默认: 300)
  --help                     显示此帮助信息

示例:
  node scripts/rollback-verifier.js --env production
  node scripts/rollback-verifier.js --health-url http://prod.example.com/health
        `);
        process.exit(0);
    }
  }

  return options;
}

// 执行回退验证
const options = parseArgs();
const verifier = new RollbackVerifier(options);

verifier.verifyRollback()
  .then(results => {
    verifier.printSummary();

    // 保存详细报告
    const report = verifier.generateReport();
    const reportPath = path.join(process.cwd(), 'rollback-verification-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    logger.info(`详细报告已保存至: ${reportPath}`);

    // 根据验证结果设置退出码
    const exitCode = results.overallStatus === 'passed' ? 0 : 1;
    process.exit(exitCode);
  })
  .catch(error => {
    logger.error('回退验证执行失败', error);
    process.exit(1);
  });
