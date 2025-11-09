#!/usr/bin/env node

/**
 * 🔐 认证服务诊断工具
 *
 * 分析认证服务的初始化和运行时问题：
 * - 服务初始化流程诊断
 * - 依赖注入问题分析
 * - 仓库实现状态检查
 * - 认证流程完整性验证
 * - 安全配置审查
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(fileURLToPath(import.meta.url), '..');

class AuthServiceDiagnostic {
  constructor() {
    this.diagnostics = {
      service: {},
      repositories: {},
      dependencies: {},
      configuration: {},
      security: {},
      issues: [],
      recommendations: []
    };
  }

  /**
   * 运行完整诊断
   */
  async run() {
    console.log('🔐 启动认证服务诊断...');

    try {
      await this.diagnoseServiceInitialization();
      await this.diagnoseRepositoryImplementation();
      await this.diagnoseDependencyInjection();
      await this.diagnoseConfiguration();
      await this.diagnoseSecuritySetup();

      this.analyzeIssues();
      this.generateRecommendations();

      this.printReport();

      return this.diagnostics;
    } catch (error) {
      console.error('❌ 认证服务诊断失败:', error.message);
      throw error;
    }
  }

  /**
   * 诊断服务初始化
   */
  async diagnoseServiceInitialization() {
    console.log('🔍 诊断服务初始化...');

    const serviceFiles = [
      'src/domain/services/auth/AuthenticationService.js',
      'src/domain/services/auth/AuthorizationService.js',
      'src/core/container.js'
    ];

    for (const file of serviceFiles) {
      const filePath = join(process.cwd(), file);

      if (!existsSync(filePath)) {
        this.diagnostics.issues.push({
          type: 'missing_file',
          severity: 'critical',
          file: file,
          message: `认证服务文件不存在: ${file}`
        });
        continue;
      }

      try {
        const content = readFileSync(filePath, 'utf8');

        // 检查类定义
        if (content.includes('class AuthenticationService')) {
          this.diagnostics.service.authentication = {
            exists: true,
            hasConstructor: content.includes('constructor('),
            hasRegister: content.includes('async register('),
            hasLogin: content.includes('async login('),
            hasVerifyToken: content.includes('verifyAccessToken(')
          };
        }

        if (content.includes('class AuthorizationService')) {
          this.diagnostics.service.authorization = {
            exists: true,
            hasConstructor: content.includes('constructor('),
            hasPermissionCheck: content.includes('checkPermission')
          };
        }

        // 检查容器注册
        if (file.includes('container.js')) {
          this.diagnostics.service.container = {
            hasAuthService: content.includes('authenticationService'),
            hasAuthzService: content.includes('authorizationService'),
            usesMockRepos: content.includes('MockUserRepository')
          };
        }

      } catch (error) {
        this.diagnostics.issues.push({
          type: 'file_read_error',
          severity: 'high',
          file: file,
          message: `无法读取文件: ${error.message}`
        });
      }
    }
  }

  /**
   * 诊断仓库实现
   */
  async diagnoseRepositoryImplementation() {
    console.log('🔍 诊断仓库实现...');

    const repoFiles = [
      'src/domain/repositories/auth/UserRepository.js',
      'src/domain/repositories/auth/TokenRepository.js',
      'src/domain/repositories/auth/SessionRepository.js'
    ];

    for (const file of repoFiles) {
      const filePath = join(process.cwd(), file);

      if (!existsSync(filePath)) {
        this.diagnostics.repositories[file.split('/').pop().replace('.js', '')] = {
          exists: false,
          implemented: false
        };
        continue;
      }

      try {
        const content = readFileSync(filePath, 'utf8');

        const repoName = file.split('/').pop().replace('Repository.js', '').toLowerCase();

        this.diagnostics.repositories[repoName] = {
          exists: true,
          hasInterface: content.includes('class') || content.includes('interface'),
          methods: this.extractMethods(content),
          implemented: this.checkImplementation(content)
        };

      } catch (error) {
        this.diagnostics.issues.push({
          type: 'repository_error',
          severity: 'high',
          file: file,
          message: `仓库文件读取失败: ${error.message}`
        });
      }
    }

    // 检查Mock实现
    const containerFile = join(process.cwd(), 'src/core/container.js');
    if (existsSync(containerFile)) {
      const content = readFileSync(containerFile, 'utf8');

      this.diagnostics.repositories.mocks = {
        userRepository: content.includes('class MockUserRepository'),
        tokenRepository: content.includes('class MockTokenRepository'),
        sessionRepository: content.includes('class MockSessionRepository'),
        methods: this.extractMockMethods(content)
      };
    }
  }

  /**
   * 诊断依赖注入
   */
  async diagnoseDependencyInjection() {
    console.log('🔍 诊断依赖注入...');

    const containerFile = join(process.cwd(), 'src/core/container.js');

    if (!existsSync(containerFile)) {
      this.diagnostics.issues.push({
        type: 'missing_container',
        severity: 'critical',
        message: '依赖注入容器文件不存在'
      });
      return;
    }

    try {
      const content = readFileSync(containerFile, 'utf8');

      this.diagnostics.dependencies = {
        container: {
          usesAwilix: content.includes('awilix'),
          hasGetContainer: content.includes('getContainer'),
          registersAuth: content.includes('authenticationService') && content.includes('authorizationService')
        },
        injection: {
          authServiceGetsRepos: this.checkAuthServiceInjection(content),
          reposProperlyInjected: this.checkRepositoryInjection(content)
        }
      };

    } catch (error) {
      this.diagnostics.issues.push({
        type: 'container_error',
        severity: 'high',
        message: `容器文件读取失败: ${error.message}`
      });
    }
  }

  /**
   * 诊断配置
   */
  async diagnoseConfiguration() {
    console.log('🔍 诊断配置...');

    const configFiles = [
      'src/shared/utils/config.js',
      '.env',
      '.env.local',
      'test.env'
    ];

    this.diagnostics.configuration = {
      files: {},
      security: {},
      database: {},
      jwt: {}
    };

    for (const file of configFiles) {
      const filePath = join(process.cwd(), file);

      if (existsSync(filePath)) {
        try {
          const content = readFileSync(filePath, 'utf8');

          this.diagnostics.configuration.files[file] = {
            exists: true,
            hasAuthConfig: this.checkAuthConfig(content),
            hasSecurityConfig: this.checkSecurityConfig(content),
            hasDatabaseConfig: this.checkDatabaseConfig(content)
          };

          // 检查敏感信息
          if (file.includes('.env')) {
            this.diagnostics.configuration.security[file] = {
              hasJwtSecret: content.includes('JWT_SECRET'),
              hasDatabaseUrl: content.includes('DATABASE_URL'),
              hasRedisUrl: content.includes('REDIS_URL'),
              exposedSecrets: this.checkExposedSecrets(content)
            };
          }

        } catch (error) {
          this.diagnostics.configuration.files[file] = {
            exists: true,
            error: error.message
          };
        }
      } else {
        this.diagnostics.configuration.files[file] = {
          exists: false
        };
      }
    }
  }

  /**
   * 诊断安全设置
   */
  async diagnoseSecuritySetup() {
    console.log('🔍 诊断安全设置...');

    const securityFiles = [
      'src/core/ZodInspiredValidation.js',
      'src/presentation/middleware/input-validation.middleware.js',
      'src/infrastructure/auth/AuthenticationMiddleware.js'
    ];

    for (const file of securityFiles) {
      const filePath = join(process.cwd(), file);

      if (!existsSync(filePath)) {
        this.diagnostics.security[file.split('/').pop().replace('.js', '')] = {
          exists: false
        };
        continue;
      }

      try {
        const content = readFileSync(filePath, 'utf8');

        const component = file.split('/').pop().replace('.js', '');

        this.diagnostics.security[component] = {
          exists: true,
          hasValidation: this.checkValidationImplementation(content),
          hasSanitization: this.checkSanitization(content),
          hasAuthMiddleware: this.checkAuthMiddleware(content)
        };

      } catch (error) {
        this.diagnostics.security[file.split('/').pop().replace('.js', '')] = {
          exists: true,
          error: error.message
        };
      }
    }
  }

  /**
   * 辅助方法
   */
  extractMethods(content) {
    const methods = [];
    const methodRegex = /(?:async\s+)?(\w+)\s*\(/g;
    let match;

    while ((match = methodRegex.exec(content)) !== null) {
      methods.push(match[1]);
    }

    return [...new Set(methods)]; // 去重
  }

  checkImplementation(content) {
    // 检查是否有实际的方法实现，而不仅仅是接口定义
    return content.includes('return') || content.includes('throw') || content.length > 1000;
  }

  extractMockMethods(content) {
    const mockSection = content.substring(
      content.indexOf('class MockUserRepository'),
      content.indexOf('class MockTokenRepository') || content.length
    );

    return this.extractMethods(mockSection);
  }

  checkAuthServiceInjection(content) {
    const authServiceSection = content.substring(
      content.indexOf('authenticationService:'),
      content.indexOf('authorizationService:') || content.length
    );

    return authServiceSection.includes('userRepository') &&
           authServiceSection.includes('tokenRepository') &&
           authServiceSection.includes('sessionRepository');
  }

  checkRepositoryInjection(content) {
    return content.includes('new MockUserRepository()') &&
           content.includes('new MockTokenRepository()') &&
           content.includes('new MockSessionRepository()');
  }

  checkAuthConfig(content) {
    return content.includes('auth') || content.includes('jwt') || content.includes('session');
  }

  checkSecurityConfig(content) {
    return content.includes('secret') || content.includes('password') || content.includes('token');
  }

  checkDatabaseConfig(content) {
    return content.includes('database') || content.includes('postgres') || content.includes('redis');
  }

  checkExposedSecrets(content) {
    const secrets = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('SECRET') || line.includes('PASSWORD') || line.includes('KEY')) {
        if (!line.includes('process.env') && !line.includes('=') && line.trim().length > 0) {
          secrets.push({
            line: i + 1,
            content: line.trim()
          });
        }
      }
    }

    return secrets;
  }

  checkValidationImplementation(content) {
    return content.includes('validate') || content.includes('schema') || content.includes('zod');
  }

  checkSanitization(content) {
    return content.includes('sanitize') || content.includes('escape') || content.includes('clean');
  }

  checkAuthMiddleware(content) {
    return content.includes('Bearer') || content.includes('Authorization') || content.includes('token');
  }

  /**
   * 分析问题
   */
  analyzeIssues() {
    console.log('🔍 分析诊断结果...');

    // 检查服务是否存在
    if (!this.diagnostics.service.authentication?.exists) {
      this.diagnostics.issues.push({
        type: 'missing_service',
        severity: 'critical',
        message: 'AuthenticationService 类不存在'
      });
    }

    if (!this.diagnostics.service.authorization?.exists) {
      this.diagnostics.issues.push({
        type: 'missing_service',
        severity: 'high',
        message: 'AuthorizationService 类不存在'
      });
    }

    // 检查仓库实现
    const requiredRepos = ['user', 'token', 'session'];
    for (const repo of requiredRepos) {
      if (!this.diagnostics.repositories[repo]?.exists) {
        this.diagnostics.issues.push({
          type: 'missing_repository',
          severity: 'high',
          message: `${repo}Repository 接口不存在`
        });
      }
    }

    // 检查Mock实现
    if (!this.diagnostics.repositories.mocks?.userRepository) {
      this.diagnostics.issues.push({
        type: 'missing_mock',
        severity: 'medium',
        message: 'MockUserRepository 实现不存在'
      });
    }

    // 检查依赖注入
    if (!this.diagnostics.dependencies.injection?.authServiceGetsRepos) {
      this.diagnostics.issues.push({
        type: 'injection_error',
        severity: 'high',
        message: 'AuthenticationService 依赖注入配置不正确'
      });
    }

    // 检查安全配置
    const exposedSecrets = Object.values(this.diagnostics.configuration.security)
      .flatMap(config => config.exposedSecrets || []);

    if (exposedSecrets.length > 0) {
      this.diagnostics.issues.push({
        type: 'security_risk',
        severity: 'critical',
        message: `发现 ${exposedSecrets.length} 个可能暴露的敏感信息`
      });
    }
  }

  /**
   * 生成建议
   */
  generateRecommendations() {
    console.log('💡 生成修复建议...');

    this.diagnostics.issues.forEach(issue => {
      switch (issue.type) {
        case 'missing_service':
          this.diagnostics.recommendations.push({
            type: 'implementation',
            priority: 'high',
            message: `创建 ${issue.message.replace(' 类不存在', '')} 类`,
            actions: [
              '实现类的基本结构',
              '添加必要的构造函数',
              '实现核心业务方法'
            ]
          });
          break;

        case 'missing_repository':
          this.diagnostics.recommendations.push({
            type: 'implementation',
            priority: 'medium',
            message: `创建 ${issue.message.replace(' 接口不存在', '')} 接口`,
            actions: [
              '定义仓库接口方法',
              '创建Mock实现用于测试',
              '实现实际的数据访问逻辑'
            ]
          });
          break;

        case 'injection_error':
          this.diagnostics.recommendations.push({
            type: 'configuration',
            priority: 'high',
            message: '修复依赖注入配置',
            actions: [
              '检查容器注册代码',
              '确保所有依赖正确注入',
              '验证服务初始化顺序'
            ]
          });
          break;

        case 'security_risk':
          this.diagnostics.recommendations.push({
            type: 'security',
            priority: 'critical',
            message: '修复安全配置问题',
            actions: [
              '将敏感信息移到环境变量',
              '使用强密码和密钥',
              '启用安全头部和CORS'
            ]
          });
          break;
      }
    });
  }

  /**
   * 打印诊断报告
   */
  printReport() {
    console.log('\n📊 认证服务诊断报告');
    console.log('='.repeat(50));

    console.log('\n🔧 服务状态:');
    console.log(`  AuthenticationService: ${this.diagnostics.service.authentication?.exists ? '✅' : '❌'} 存在`);
    console.log(`  AuthorizationService: ${this.diagnostics.service.authorization?.exists ? '✅' : '❌'} 存在`);
    console.log(`  容器注册: ${this.diagnostics.service.container?.hasAuthService ? '✅' : '❌'} 完成`);

    console.log('\n💾 仓库状态:');
    const repos = ['user', 'token', 'session'];
    repos.forEach(repo => {
      const status = this.diagnostics.repositories[repo];
      console.log(`  ${repo}Repository: ${status?.exists ? '✅' : '❌'} ${status?.implemented ? '已实现' : '未实现'}`);
    });

    console.log('\n🔗 依赖注入:');
    console.log(`  服务注入: ${this.diagnostics.dependencies.injection?.authServiceGetsRepos ? '✅' : '❌'} 正确`);
    console.log(`  仓库注入: ${this.diagnostics.dependencies.injection?.reposProperlyInjected ? '✅' : '❌'} 正确`);

    console.log('\n🔒 安全状态:');
    const securityComponents = Object.keys(this.diagnostics.security);
    securityComponents.forEach(component => {
      const status = this.diagnostics.security[component];
      console.log(`  ${component}: ${status?.exists ? '✅' : '❌'} ${status?.hasValidation ? '验证' : '无验证'}`);
    });

    console.log('\n⚠️  发现问题:');
    if (this.diagnostics.issues.length === 0) {
      console.log('  ✅ 没有发现问题');
    } else {
      this.diagnostics.issues.forEach((issue, i) => {
        const severity = issue.severity === 'critical' ? '🔴' :
                        issue.severity === 'high' ? '🟠' : '🟢';
        console.log(`  ${i + 1}. ${severity} ${issue.message}`);
      });
    }

    console.log('\n💡 建议修复:');
    if (this.diagnostics.recommendations.length === 0) {
      console.log('  ✅ 没有建议');
    } else {
      this.diagnostics.recommendations.forEach((rec, i) => {
        const priority = rec.priority === 'critical' ? '🔴' :
                        rec.priority === 'high' ? '🟠' : '🟢';
        console.log(`  ${i + 1}. ${priority} ${rec.message}`);
        if (rec.actions) {
          rec.actions.forEach(action => {
            console.log(`     - ${action}`);
          });
        }
      });
    }

    console.log('\n' + '='.repeat(50));
  }

  /**
   * 保存诊断报告
   */
  saveReport() {
    const reportPath = join(process.cwd(), 'auth-service-diagnostic-report.json');
    const report = {
      timestamp: new Date().toISOString(),
      ...this.diagnostics
    };

    try {
      writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(`📄 诊断报告已保存到: ${reportPath}`);
    } catch (error) {
      console.error('保存报告失败:', error.message);
    }
  }
}

// CLI 接口
async function main() {
  const diagnostic = new AuthServiceDiagnostic();

  try {
    await diagnostic.run();
    diagnostic.saveReport();

    // 如果有严重问题，返回非零退出码
    const criticalIssues = diagnostic.diagnostics.issues.filter(
      issue => issue.severity === 'critical'
    );

    if (criticalIssues.length > 0) {
      console.log(`\n❌ 发现 ${criticalIssues.length} 个严重问题，需要立即修复`);
      process.exit(1);
    } else {
      console.log('\n✅ 认证服务诊断完成');
    }

  } catch (error) {
    console.error('❌ 诊断工具执行失败:', error.message);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (import.meta.url.includes('auth-service-diagnostic.mjs') ||
    process.argv[1]?.includes('auth-service-diagnostic.mjs')) {
  main();
}

export { AuthServiceDiagnostic };
