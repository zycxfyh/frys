#!/usr/bin/env node

/**
 * frys 部署验证脚本
 * 全面验证生产环境部署状态
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

class DeploymentVerifier {
  constructor() {
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      warnings: 0
    };
    this.checks = [];
    this.env = process.env.DEPLOY_ENV || 'production';
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = {
      info: 'ℹ️ ',
      success: '✅ ',
      warning: '⚠️ ',
      error: '❌ ',
      header: '🔍 '
    }[type] || 'ℹ️ ';

    console.log(`${timestamp} ${prefix}${message}`);
  }

  addCheck(name, status, message = '', details = {}) {
    this.checks.push({
      name,
      status,
      message,
      details,
      timestamp: new Date().toISOString()
    });

    this.results.total++;

    switch (status) {
      case 'passed':
        this.results.passed++;
        this.log(`${name} - 通过`, 'success');
        break;
      case 'failed':
        this.results.failed++;
        this.log(`${name} - 失败: ${message}`, 'error');
        break;
      case 'warning':
        this.results.warnings++;
        this.log(`${name} - 警告: ${message}`, 'warning');
        break;
    }
  }

  // 基础设施检查
  async checkDockerServices() {
    try {
      const output = execSync(`docker-compose -f docker-compose.${this.env}.yml ps`, {
        encoding: 'utf8'
      });

      const services = output.split('\n')
        .filter(line => line.includes('Up') || line.includes('running'))
        .map(line => line.trim());

      const expectedServices = [
        'frys-blue', 'frys-green',
        'nginx', 'redis', 'postgres',
        'prometheus', 'grafana'
      ];

      let runningServices = 0;
      expectedServices.forEach(service => {
        if (services.some(line => line.includes(service))) {
          this.addCheck(`Docker服务: ${service}`, 'passed');
          runningServices++;
        } else {
          this.addCheck(`Docker服务: ${service}`, 'warning', '服务未运行');
        }
      });

      return runningServices >= 3; // 至少核心服务运行

    } catch (error) {
      this.addCheck('Docker服务检查', 'failed', error.message);
      return false;
    }
  }

  async checkContainerHealth() {
    const services = ['frys-blue', 'frys-green'];

    for (const service of services) {
      try {
        // 检查容器是否运行
        const psOutput = execSync(`docker-compose -f docker-compose.${this.env}.yml ps ${service}`, {
          encoding: 'utf8'
        });

        if (!psOutput.includes('Up')) {
          this.addCheck(`容器健康: ${service}`, 'warning', '容器未运行');
          continue;
        }

        // 健康检查
        execSync(`docker-compose -f docker-compose.${this.env}.yml exec -T ${service} curl -f --max-time 5 http://localhost:3000/health`, {
          stdio: 'pipe'
        });

        this.addCheck(`容器健康: ${service}`, 'passed');

      } catch (error) {
        this.addCheck(`容器健康: ${service}`, 'failed', '健康检查失败');
      }
    }
  }

  async checkDatabaseConnectivity() {
    try {
      execSync(`docker-compose -f docker-compose.${this.env}.yml exec -T postgres pg_isready -U frys -d frys_prod`, {
        stdio: 'pipe'
      });
      this.addCheck('数据库连接', 'passed');
    } catch (error) {
      this.addCheck('数据库连接', 'failed', 'PostgreSQL 连接失败');
    }
  }

  async checkRedisConnectivity() {
    try {
      execSync(`docker-compose -f docker-compose.${this.env}.yml exec -T redis redis-cli ping`, {
        encoding: 'utf8'
      });
      this.addCheck('Redis连接', 'passed');
    } catch (error) {
      this.addCheck('Redis连接', 'failed', 'Redis 连接失败');
    }
  }

  async checkApplicationEndpoints() {
    const endpoints = [
      { url: 'http://localhost/health', name: '健康检查' },
      { url: 'http://localhost/api/health', name: 'API健康检查' }
    ];

    for (const endpoint of endpoints) {
      try {
        execSync(`curl -f --max-time 10 ${endpoint.url}`, {
          stdio: 'pipe'
        });
        this.addCheck(`应用端点: ${endpoint.name}`, 'passed');
      } catch (error) {
        this.addCheck(`应用端点: ${endpoint.name}`, 'failed', '端点不可访问');
      }
    }
  }

  async checkNginxConfiguration() {
    try {
      // 检查 Nginx 配置语法
      execSync(`docker-compose -f docker-compose.${this.env}.yml exec -T nginx nginx -t`, {
        stdio: 'pipe'
      });
      this.addCheck('Nginx配置', 'passed');
    } catch (error) {
      this.addCheck('Nginx配置', 'failed', '配置语法错误');
    }
  }

  async checkMonitoringStack() {
    const services = [
      { name: 'Prometheus', port: 9090, path: '/-/healthy' },
      { name: 'Grafana', port: 3002, path: '/api/health' }
    ];

    for (const service of services) {
      try {
        execSync(`curl -f --max-time 5 http://localhost:${service.port}${service.path}`, {
          stdio: 'pipe'
        });
        this.addCheck(`监控服务: ${service.name}`, 'passed');
      } catch (error) {
        this.addCheck(`监控服务: ${service.name}`, 'warning', '服务可能未完全启动');
      }
    }
  }

  async checkResourceUsage() {
    try {
      const output = execSync('docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"', {
        encoding: 'utf8'
      });

      const lines = output.split('\n').slice(1); // 跳过表头
      let highUsage = false;

      lines.forEach(line => {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 3) {
          const container = parts[0];
          const cpu = parseFloat(parts[1]);
          const mem = parts[2];

          if (cpu > 80) {
            this.addCheck(`资源使用: ${container} CPU`, 'warning', `CPU使用率过高: ${cpu}%`);
            highUsage = true;
          }

          // 检查内存使用 (简化检查)
          if (mem.includes('GB') && parseFloat(mem) > 1) {
            this.addCheck(`资源使用: ${container} 内存`, 'warning', `内存使用过高: ${mem}`);
            highUsage = true;
          }
        }
      });

      if (!highUsage) {
        this.addCheck('资源使用', 'passed', '所有服务资源使用正常');
      }

    } catch (error) {
      this.addCheck('资源使用检查', 'warning', '无法获取资源统计信息');
    }
  }

  async checkSecurityConfigurations() {
    // 检查环境变量
    const requiredEnvVars = ['JWT_SECRET', 'API_KEY', 'POSTGRES_PASSWORD'];
    let envValid = true;

    requiredEnvVars.forEach(envVar => {
      if (!process.env[envVar] || process.env[envVar].length < 16) {
        this.addCheck(`安全配置: ${envVar}`, 'failed', '环境变量缺失或过短');
        envValid = false;
      }
    });

    if (envValid) {
      this.addCheck('安全配置', 'passed', '关键环境变量已正确配置');
    }

    // 检查文件权限
    try {
      const keyFiles = ['.env.production', '.env.staging'];
      keyFiles.forEach(file => {
        if (fs.existsSync(file)) {
          const stats = fs.statSync(file);
          const permissions = (stats.mode & parseInt('777', 8)).toString(8);

          if (permissions !== '600') {
            this.addCheck(`文件权限: ${file}`, 'warning', `权限应为 600，当前为 ${permissions}`);
          } else {
            this.addCheck(`文件权限: ${file}`, 'passed');
          }
        }
      });
    } catch (error) {
      this.addCheck('文件权限检查', 'warning', '无法检查文件权限');
    }
  }

  async checkLogConfiguration() {
    const logFiles = [
      './logs/deploy.log',
      './logs/application.log'
    ];

    logFiles.forEach(logFile => {
      try {
        if (fs.existsSync(logFile)) {
          const stats = fs.statSync(logFile);
          const sizeMB = stats.size / (1024 * 1024);

          if (sizeMB > 100) {
            this.addCheck(`日志文件: ${logFile}`, 'warning', `日志文件过大: ${sizeMB.toFixed(1)}MB`);
          } else {
            this.addCheck(`日志文件: ${logFile}`, 'passed', `大小: ${sizeMB.toFixed(1)}MB`);
          }
        } else {
          this.addCheck(`日志文件: ${logFile}`, 'warning', '日志文件不存在');
        }
      } catch (error) {
        this.addCheck(`日志文件: ${logFile}`, 'warning', '无法检查日志文件');
      }
    });
  }

  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      environment: this.env,
      summary: {
        total: this.results.total,
        passed: this.results.passed,
        failed: this.results.failed,
        warnings: this.results.warnings,
        successRate: ((this.results.passed / this.results.total) * 100).toFixed(1) + '%'
      },
      checks: this.checks,
      status: this.results.failed === 0 ? 'PASSED' : 'FAILED'
    };

    // 保存报告
    const reportPath = `./reports/deployment-verification-${new Date().toISOString().split('T')[0]}.json`;
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    return report;
  }

  printSummary() {
    console.log('\n' + '='.repeat(80));
    console.log('🔍 frys 部署验证报告');
    console.log('='.repeat(80));

    console.log(`\n📊 验证概览:`);
    console.log(`   环境: ${this.env}`);
    console.log(`   总检查项: ${this.results.total}`);
    console.log(`   ✅ 通过: ${this.results.passed}`);
    console.log(`   ❌ 失败: ${this.results.failed}`);
    console.log(`   ⚠️  警告: ${this.results.warnings}`);

    const successRate = ((this.results.passed / this.results.total) * 100).toFixed(1);
    console.log(`   📈 成功率: ${successRate}%`);

    console.log(`\n🔍 检查详情:`);

    // 按状态分组显示
    const grouped = {
      passed: [],
      failed: [],
      warning: []
    };

    this.checks.forEach(check => {
      grouped[check.status].push(check);
    });

    if (grouped.failed.length > 0) {
      console.log('\n❌ 失败项:');
      grouped.failed.forEach(check => {
        console.log(`   • ${check.name}: ${check.message}`);
      });
    }

    if (grouped.warning.length > 0) {
      console.log('\n⚠️  警告项:');
      grouped.warning.forEach(check => {
        console.log(`   • ${check.name}: ${check.message}`);
      });
    }

    console.log('\n✅ 通过项:');
    grouped.passed.slice(0, 10).forEach(check => {
      console.log(`   • ${check.name}`);
    });

    if (grouped.passed.length > 10) {
      console.log(`   ... 还有 ${grouped.passed.length - 10} 项通过`);
    }

    console.log('\n' + '='.repeat(80));

    const overallStatus = this.results.failed === 0 ? '✅ 部署验证通过' : '❌ 部署验证失败';
    console.log(overallStatus);

    if (this.results.failed > 0) {
      console.log('\n🔧 故障排除建议:');
      console.log('1. 检查 Docker 容器日志: docker-compose logs');
      console.log('2. 验证环境变量配置');
      console.log('3. 检查网络连接和端口占用');
      console.log('4. 确认依赖服务 (PostgreSQL, Redis) 正常运行');
    }
  }

  async run() {
    this.log(`🚀 开始部署验证 - 环境: ${this.env}`, 'header');

    // 执行各项检查
    await this.checkDockerServices();
    await this.checkContainerHealth();
    await this.checkDatabaseConnectivity();
    await this.checkRedisConnectivity();
    await this.checkApplicationEndpoints();
    await this.checkNginxConfiguration();
    await this.checkMonitoringStack();
    await this.checkResourceUsage();
    await this.checkSecurityConfigurations();
    await this.checkLogConfiguration();

    // 生成报告
    const report = this.generateReport();
    this.printSummary();

    // 设置退出码
    process.exit(report.status === 'PASSED' ? 0 : 1);
  }
}

// 执行验证
const verifier = new DeploymentVerifier();
verifier.run().catch(error => {
  console.error('部署验证执行失败:', error);
  process.exit(1);
});
