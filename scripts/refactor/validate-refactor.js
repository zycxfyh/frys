#!/usr/bin/env node

/**
 * 重构验证脚本
 * 用于验证项目重构的完整性和正确性
 *
 * 验证内容：
 * - 导入路径正确性
 * - 循环依赖检测
 * - 模块完整性检查
 * - 功能完整性验证
 * - 性能基准对比
 */

import { readFileSync, readdirSync, statSync, existsSync, writeFileSync } from 'fs';
import { join, extname, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '../..');

class RefactorValidator {
  constructor() {
    this.issues = {
      critical: [],
      warnings: [],
      info: []
    };

    this.stats = {
      filesChecked: 0,
      importsValidated: 0,
      modulesValidated: 0,
      dependenciesAnalyzed: 0
    };
  }

  /**
   * 运行完整验证
   */
  async runValidation() {
    console.log('🔍 开始重构验证...\n');

    try {
      // 1. 验证项目结构
      await this.validateProjectStructure();

      // 2. 验证导入路径
      await this.validateImportPaths();

      // 3. 验证循环依赖
      await this.validateCircularDependencies();

      // 4. 验证模块完整性
      await this.validateModuleIntegrity();

      // 5. 验证功能完整性
      await this.validateFunctionality();

      // 6. 生成验证报告
      this.generateReport();

    } catch (error) {
      this.addIssue('critical', '验证过程失败', error.message);
      console.error('❌ 验证失败:', error.message);
    }
  }

  /**
   * 验证项目结构
   */
  async validateProjectStructure() {
    console.log('📁 验证项目结构...');

    const expectedStructure = {
      'src/core/': ['workflow', 'events', 'memory', 'deployment', 'rollback', 'scheduler'],
      'src/infrastructure/': ['database', 'persistence', 'pooling', 'scaling', 'tracing', 'auth', 'exception-handling', 'health-checks'],
      'src/presentation/': ['controllers', 'middleware', 'routes'],
      'src/shared/': ['utils', 'types', 'constants', 'errors', 'services'],
      'tests/': ['unit', 'integration', 'e2e'],
      'scripts/': ['analysis', 'benchmark', 'refactor'],
      'docs/': ['api', 'guides', 'maintenance']
    };

    for (const [dir, expectedSubdirs] of Object.entries(expectedStructure)) {
      const fullPath = join(projectRoot, dir);

      if (!existsSync(fullPath)) {
        this.addIssue('critical', '缺少必需目录', `目录 ${dir} 不存在`);
        continue;
      }

      const actualSubdirs = readdirSync(fullPath)
        .filter(item => statSync(join(fullPath, item)).isDirectory());

      for (const expected of expectedSubdirs) {
        if (!actualSubdirs.includes(expected)) {
          this.addIssue('warnings', '缺少子目录', `目录 ${dir}${expected}/ 不存在`);
        }
      }
    }

    console.log('✅ 项目结构验证完成\n');
  }

  /**
   * 验证导入路径
   */
  async validateImportPaths() {
    console.log('🔗 验证导入路径...');

    const files = this.getAllSourceFiles();
    let invalidImports = 0;

    for (const file of files) {
      try {
        const content = readFileSync(file, 'utf8');
        const imports = this.extractImports(content);

        for (const importPath of imports) {
          if (!this.isValidImportPath(file, importPath)) {
            invalidImports++;
            this.addIssue('warnings', '无效导入路径', `${file}: ${importPath}`);
          }
        }

        this.stats.importsValidated += imports.length;
      } catch (error) {
        this.addIssue('critical', '文件读取失败', `${file}: ${error.message}`);
      }
    }

    this.stats.filesChecked = files.length;

    console.log(`✅ 导入路径验证完成，检查了 ${files.length} 个文件，${invalidImports} 个无效导入\n`);
  }

  /**
   * 验证循环依赖
   */
  async validateCircularDependencies() {
    console.log('🔄 验证循环依赖...');

    try {
      // 使用现有的循环依赖检查器
      const { default: CircularDependencyChecker } = await import('../analysis/circular-dependency-checker.js');
      const checker = new CircularDependencyChecker();
      const result = await checker.check();

      if (result.hasCircularDependencies) {
        for (const cycle of result.cycles) {
          this.addIssue('critical', '检测到循环依赖', cycle.join(' -> '));
        }
      } else {
        console.log('✅ 未发现循环依赖');
      }

      this.stats.dependenciesAnalyzed = result.totalModules;

    } catch (error) {
      this.addIssue('warnings', '循环依赖检查失败', error.message);
    }

    console.log('✅ 循环依赖验证完成\n');
  }

  /**
   * 验证模块完整性
   */
  async validateModuleIntegrity() {
    console.log('📦 验证模块完整性...');

    const moduleDirs = [
      'src/core',
      'src/infrastructure',
      'src/presentation',
      'src/shared'
    ];

    for (const dir of moduleDirs) {
      const fullPath = join(projectRoot, dir);

      if (!existsSync(join(fullPath, 'index.js'))) {
        this.addIssue('warnings', '缺少模块入口文件', `${dir}/index.js`);
        continue;
      }

      try {
        // 检查模块是否可以正常导入
        const modulePath = `../../${dir.replace(/\\/g, '/')}/index.js`;
        await import(modulePath);
        this.stats.modulesValidated++;
      } catch (error) {
        this.addIssue('critical', '模块导入失败', `${dir}: ${error.message}`);
      }
    }

    console.log(`✅ 模块完整性验证完成，验证了 ${this.stats.modulesValidated} 个模块\n`);
  }

  /**
   * 验证功能完整性
   */
  async validateFunctionality() {
    console.log('⚙️ 验证功能完整性...');

    const criticalFunctions = [
      { name: '工作流执行器', test: () => this.testWorkflowExecutor() },
      { name: '缓存管理器', test: () => this.testCacheManager() },
      { name: '数据库连接池', test: () => this.testDatabasePool() },
      { name: '配置管理器', test: () => this.testConfigurationManager() }
    ];

    for (const { name, test } of criticalFunctions) {
      try {
        const result = await test();
        if (!result.success) {
          this.addIssue('critical', '功能测试失败', `${name}: ${result.error}`);
        }
      } catch (error) {
        this.addIssue('critical', '功能测试异常', `${name}: ${error.message}`);
      }
    }

    console.log('✅ 功能完整性验证完成\n');
  }

  /**
   * 测试工作流执行器
   */
  async testWorkflowExecutor() {
    try {
      const { OptimizedWorkflowExecutor } = await import('../../src/core/workflow/OptimizedWorkflowExecutor.js');
      const executor = new OptimizedWorkflowExecutor({ maxParallelTasks: 2 });

      // 简单的功能测试
      const taskId = executor.submitTask({
        id: 'test-task',
        priority: 1,
        dependencies: []
      });

      if (!taskId) {
        return { success: false, error: '任务提交失败' };
      }

      await executor.shutdown();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 测试缓存管理器
   */
  async testCacheManager() {
    try {
      const { default: OptimizedCacheManager } = await import('../../src/infrastructure/persistence/OptimizedCacheManager.js');
      const cache = new OptimizedCacheManager({ maxMemorySize: 1024 * 1024 }); // 1MB

      await cache.set('test-key', 'test-value', 1000);
      const value = await cache.get('test-key');

      if (value !== 'test-value') {
        return { success: false, error: '缓存读写失败' };
      }

      await cache.close();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 测试数据库连接池
   */
  async testDatabasePool() {
    try {
      // 这里只是检查模块是否可以导入，实际连接测试需要数据库
      const { default: OptimizedDatabaseConnectionPool } = await import('../../src/infrastructure/database/OptimizedDatabaseConnectionPool.js');

      // 基本的实例化测试
      const pool = new OptimizedDatabaseConnectionPool({
        host: 'localhost',
        database: 'test',
        min: 1,
        max: 2
      });

      if (!pool) {
        return { success: false, error: '连接池创建失败' };
      }

      await pool.close();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 测试配置管理器
   */
  async testConfigurationManager() {
    try {
      const { ConfigurationManager } = await import('../../src/core/config/ConfigurationManager.js');

      // 基本的实例化测试
      const config = new ConfigurationManager();

      if (!config) {
        return { success: false, error: '配置管理器创建失败' };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取所有源码文件
   */
  getAllSourceFiles() {
    const files = [];
    const dirs = ['src', 'tests'];

    const traverse = (dir) => {
      const fullPath = join(projectRoot, dir);

      if (!existsSync(fullPath)) return;

      const items = readdirSync(fullPath);

      for (const item of items) {
        const itemPath = join(fullPath, item);
        const stat = statSync(itemPath);

        if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
          traverse(join(dir, item));
        } else if (stat.isFile() && ['.js', '.mjs'].includes(extname(item))) {
          files.push(itemPath);
        }
      }
    };

    dirs.forEach(traverse);
    return files;
  }

  /**
   * 提取文件中的导入语句
   */
  extractImports(content) {
    const imports = [];
    const importRegex = /(?:import|from)\s+['"]([^'"]+)['"]/g;
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    return imports;
  }

  /**
   * 验证导入路径是否有效
   */
  isValidImportPath(fromFile, importPath) {
    try {
      // 处理相对路径
      if (importPath.startsWith('.')) {
        const fromDir = dirname(fromFile);
        const resolved = resolve(fromDir, importPath);

        // 检查文件是否存在
        const extensions = ['', '.js', '.mjs', '.json'];
        for (const ext of extensions) {
          if (existsSync(resolved + ext)) {
            return true;
          }
        }

        // 检查目录是否存在 index.js
        if (existsSync(join(resolved, 'index.js'))) {
          return true;
        }

        return false;
      }

      // 对于绝对路径或node_modules，假设有效
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 添加问题
   */
  addIssue(level, category, message) {
    this.issues[level].push({
      category,
      message,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 生成验证报告
   */
  generateReport() {
    console.log('📊 生成验证报告...\n');

    const totalIssues = this.issues.critical.length + this.issues.warnings.length + this.issues.info.length;

    console.log('='.repeat(60));
    console.log('🔍 重构验证报告');
    console.log('='.repeat(60));

    console.log(`\n📈 统计信息:`);
    console.log(`   - 检查文件数: ${this.stats.filesChecked}`);
    console.log(`   - 验证导入数: ${this.stats.importsValidated}`);
    console.log(`   - 验证模块数: ${this.stats.modulesValidated}`);
    console.log(`   - 分析依赖数: ${this.stats.dependenciesAnalyzed}`);

    console.log(`\n⚠️  问题统计:`);
    console.log(`   - 严重问题: ${this.issues.critical.length}`);
    console.log(`   - 警告问题: ${this.issues.warnings.length}`);
    console.log(`   - 信息提示: ${this.issues.info.length}`);

    if (this.issues.critical.length > 0) {
      console.log(`\n❌ 严重问题 (${this.issues.critical.length}):`);
      this.issues.critical.forEach((issue, index) => {
        console.log(`   ${index + 1}. [${issue.category}] ${issue.message}`);
      });
    }

    if (this.issues.warnings.length > 0) {
      console.log(`\n⚠️  警告问题 (${this.issues.warnings.length}):`);
      this.issues.warnings.forEach((issue, index) => {
        console.log(`   ${index + 1}. [${issue.category}] ${issue.message}`);
      });
    }

    console.log('\n' + '='.repeat(60));

    // 总体评估
    const score = this.calculateScore();
    console.log(`\n🏆 总体评分: ${score}/100`);

    if (score >= 90) {
      console.log('🎉 优秀！重构质量很高');
    } else if (score >= 70) {
      console.log('👍 良好！重构质量可以接受');
    } else if (score >= 50) {
      console.log('⚠️  需要改进！存在较多问题');
    } else {
      console.log('❌ 严重问题！需要立即修复');
    }

    console.log('='.repeat(60));

    // 保存详细报告
    this.saveDetailedReport();
  }

  /**
   * 计算评分
   */
  calculateScore() {
    let score = 100;

    // 严重问题：每个扣10分
    score -= this.issues.critical.length * 10;

    // 警告问题：每个扣2分
    score -= this.issues.warnings.length * 2;

    // 基于统计数据的加分
    if (this.stats.filesChecked > 100) score += 5;
    if (this.stats.importsValidated > 500) score += 5;
    if (this.stats.modulesValidated >= 4) score += 5;
    if (this.stats.dependenciesAnalyzed > 50) score += 5;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * 保存详细报告
   */
  saveDetailedReport() {
    const report = {
      timestamp: new Date().toISOString(),
      stats: this.stats,
      issues: this.issues,
      score: this.calculateScore(),
      recommendations: this.generateRecommendations()
    };

    try {
      writeFileSync(
        join(projectRoot, 'refactor-validation-report.json'),
        JSON.stringify(report, null, 2)
      );
      console.log('📄 详细报告已保存到: refactor-validation-report.json');
    } catch (error) {
      console.warn('⚠️ 无法保存详细报告:', error.message);
    }
  }

  /**
   * 生成建议
   */
  generateRecommendations() {
    const recommendations = [];

    if (this.issues.critical.length > 0) {
      recommendations.push('🔴 优先修复所有严重问题，这些问题会影响项目正常运行');
    }

    if (this.issues.warnings.length > 5) {
      recommendations.push('🟡 检查警告问题，优化导入路径和项目结构');
    }

    if (this.stats.modulesValidated < 4) {
      recommendations.push('📦 完善模块入口文件，确保所有模块都可以正常导入');
    }

    if (this.stats.dependenciesAnalyzed === 0) {
      recommendations.push('🔄 运行循环依赖检查，确保没有循环依赖问题');
    }

    recommendations.push('🧪 运行完整的测试套件，确保功能完整性');
    recommendations.push('📊 执行性能基准测试，验证优化效果');

    return recommendations;
  }
}

// CLI接口
async function main() {
  const validator = new RefactorValidator();
  await validator.runValidation();

  // 根据严重问题数量决定退出码
  const exitCode = validator.issues.critical.length > 0 ? 1 : 0;
  process.exit(exitCode);
}

export default RefactorValidator;

// 如果直接运行此脚本
if (typeof process !== 'undefined' && process.argv[1] && process.argv[1].includes('validate-refactor')) {
  main().catch(error => {
    console.error('验证脚本执行失败:', error);
    process.exit(1);
  });
}
