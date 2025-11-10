/**
 * 循环依赖检测器
 * 深入分析模块依赖关系，检测和报告循环依赖
 */

import fs from 'fs';
import path from 'path';

class CircularDependencyChecker {
  constructor() {
    this.modules = new Map();
    this.dependencies = new Map();
    this.reverseDeps = new Map();
    this.visited = new Set();
    this.recursionStack = new Set();
    this.cycles = [];
    this.cycleDetails = [];
  }

  /**
   * 执行完整检测
   */
  async check(rootDir = 'src') {
    console.log('🔄 开始循环依赖检测...');

    try {
      // 1. 收集所有模块
      await this.collectModules(rootDir);

      // 2. 分析依赖关系
      await this.analyzeDependencies();

      // 3. 检测循环依赖
      this.detectCycles();

      // 4. 生成报告
      this.generateReport();

      return {
        hasCycles: this.cycles.length > 0,
        cycleCount: this.cycles.length,
        cycles: this.cycles,
        details: this.cycleDetails
      };
    } catch (error) {
      console.error('❌ 循环依赖检测失败:', error.message);
      throw error;
    }
  }

  /**
   * 收集所有模块
   */
  async collectModules(dir) {
    const items = fs.readdirSync(dir);

    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        await this.collectModules(fullPath);
      } else if (item.endsWith('.js')) {
        const relativePath = path.relative('src', fullPath);
        const moduleName = relativePath.replace(/\.js$/, '').replace(/\\/g, '/');

        this.modules.set(moduleName, {
          path: fullPath,
          relativePath,
          imports: [],
          exports: [],
          depth: this.calculateDepth(moduleName)
        });
      }
    }
  }

  /**
   * 计算模块深度
   */
  calculateDepth(moduleName) {
    return moduleName.split('/').length;
  }

  /**
   * 分析依赖关系
   */
  async analyzeDependencies() {
    for (const [moduleName, module] of this.modules) {
      try {
        const content = fs.readFileSync(module.path, 'utf8');

        // 提取所有导入语句
        const imports = this.extractImports(content);
        module.imports = imports;

        // 建立依赖关系图
        for (const importPath of imports) {
          const resolvedPath = this.resolveImportPath(importPath, moduleName);
          if (resolvedPath && this.modules.has(resolvedPath)) {
            // 正向依赖
            if (!this.dependencies.has(moduleName)) {
              this.dependencies.set(moduleName, new Set());
            }
            this.dependencies.get(moduleName).add(resolvedPath);

            // 反向依赖
            if (!this.reverseDeps.has(resolvedPath)) {
              this.reverseDeps.set(resolvedPath, new Set());
            }
            this.reverseDeps.get(resolvedPath).add(moduleName);
          }
        }
      } catch (error) {
        console.warn(`⚠️ 分析模块失败 ${moduleName}:`, error.message);
      }
    }
  }

  /**
   * 提取导入语句
   */
  extractImports(content) {
    const imports = [];
    const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;

    let match;
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    return imports;
  }

  /**
   * 解析导入路径
   */
  resolveImportPath(importPath, currentModule) {
    // 处理相对路径
    if (importPath.startsWith('.')) {
      const currentDir = path.dirname(currentModule);
      const resolved = path.resolve(currentDir, importPath);

      // 尝试不同的扩展名
      const extensions = ['', '.js', '/index.js'];
      for (const ext of extensions) {
        const testPath = resolved + ext;
        const normalizedPath = testPath.replace(/\\/g, '/');
        const relativeToSrc = path.relative('src', testPath).replace(/\.js$/, '').replace(/\\/g, '/');
        if (this.modules.has(relativeToSrc)) {
          return relativeToSrc;
        }
      }
    }

    // 处理绝对路径 (src/开头的)
    if (importPath.startsWith('src/')) {
      return importPath.replace('src/', '').replace(/\.js$/, '');
    }

    // 处理别名路径 (@/开头的)
    if (importPath.startsWith('@/')) {
      const aliasPath = importPath.replace('@/', 'src/');
      return aliasPath.replace(/\.js$/, '');
    }

    return null;
  }

  /**
   * 检测循环依赖
   */
  detectCycles() {
    console.log('🔍 正在检测循环依赖...');

    for (const moduleName of this.modules.keys()) {
      if (!this.visited.has(moduleName)) {
        this.dfs(moduleName, []);
      }
    }

    console.log(`📊 发现 ${this.cycles.length} 个循环依赖`);
  }

  /**
   * 深度优先搜索检测循环
   */
  dfs(moduleName, path) {
    this.visited.add(moduleName);
    this.recursionStack.add(moduleName);

    const newPath = [...path, moduleName];
    const deps = this.dependencies.get(moduleName);

    if (deps) {
      for (const dep of deps) {
        if (!this.visited.has(dep)) {
          this.dfs(dep, newPath);
        } else if (this.recursionStack.has(dep)) {
          // 发现循环依赖
          const cycleStart = newPath.indexOf(dep);
          const cycle = [...newPath.slice(cycleStart), dep];
          this.cycles.push(cycle);
          this.analyzeCycle(cycle);
        }
      }
    }

    this.recursionStack.delete(moduleName);
  }

  /**
   * 分析循环依赖详情
   */
  analyzeCycle(cycle) {
    const cycleInfo = {
      modules: cycle,
      length: cycle.length,
      severity: this.calculateSeverity(cycle),
      suggestions: this.generateSuggestions(cycle),
      details: []
    };

    // 分析每个模块在循环中的角色
    for (let i = 0; i < cycle.length; i++) {
      const current = cycle[i];
      const next = cycle[(i + 1) % cycle.length];
      const module = this.modules.get(current);

      cycleInfo.details.push({
        module: current,
        imports: next,
        depth: module?.depth || 0,
        file: module?.path || 'unknown'
      });
    }

    this.cycleDetails.push(cycleInfo);
  }

  /**
   * 计算循环严重程度
   */
  calculateSeverity(cycle) {
    let severity = 'LOW';

    // 根据循环长度判断严重程度
    if (cycle.length > 5) {
      severity = 'HIGH';
    } else if (cycle.length > 3) {
      severity = 'MEDIUM';
    }

    // 检查是否涉及核心模块
    const hasCore = cycle.some(module => module.startsWith('core/'));
    if (hasCore && severity === 'LOW') {
      severity = 'MEDIUM';
    }

    // 检查是否涉及多个层次
    const depths = cycle.map(module => this.modules.get(module)?.depth || 0);
    const maxDepth = Math.max(...depths);
    const minDepth = Math.min(...depths);
    if (maxDepth - minDepth > 2) {
      severity = severity === 'LOW' ? 'MEDIUM' : 'HIGH';
    }

    return severity;
  }

  /**
   * 生成修复建议
   */
  generateSuggestions(cycle) {
    const suggestions = [];

    // 建议1: 提取共同接口
    suggestions.push({
      type: 'INTERFACE_EXTRACTION',
      description: '提取共同接口或抽象层',
      effort: 'HIGH',
      impact: 'HIGH'
    });

    // 建议2: 依赖注入
    suggestions.push({
      type: 'DEPENDENCY_INJECTION',
      description: '使用依赖注入模式解耦',
      effort: 'MEDIUM',
      impact: 'HIGH'
    });

    // 建议3: 事件驱动
    suggestions.push({
      type: 'EVENT_DRIVEN',
      description: '使用事件驱动架构解耦',
      effort: 'MEDIUM',
      impact: 'MEDIUM'
    });

    // 建议4: 重新组织模块
    suggestions.push({
      type: 'REORGANIZE_MODULES',
      description: '重新组织模块职责划分',
      effort: 'HIGH',
      impact: 'HIGH'
    });

    return suggestions;
  }

  /**
   * 生成报告
   */
  generateReport() {
    console.log('\n📊 循环依赖检测报告');
    console.log('='.repeat(60));

    if (this.cycles.length === 0) {
      console.log('✅ 未发现循环依赖');
      return;
    }

    console.log(`❌ 发现 ${this.cycles.length} 个循环依赖\n`);

    // 按严重程度排序
    const sortedCycles = this.cycleDetails.sort((a, b) => {
      const severityOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });

    sortedCycles.forEach((cycle, index) => {
      console.log(`${index + 1}. 🔴 ${cycle.severity} 严重程度 - ${cycle.length} 个模块`);
      console.log(`   循环路径: ${cycle.modules.join(' → ')}`);
      console.log(`   涉及文件:`);

      cycle.details.forEach(detail => {
        console.log(`     • ${detail.module} (${detail.depth}层)`);
      });

      console.log(`   修复建议:`);
      cycle.suggestions.slice(0, 2).forEach(suggestion => {
        console.log(`     • ${suggestion.description} (难度: ${suggestion.effort})`);
      });

      console.log('');
    });

    // 统计信息
    const severityStats = this.cycleDetails.reduce((acc, cycle) => {
      acc[cycle.severity] = (acc[cycle.severity] || 0) + 1;
      return acc;
    }, {});

    console.log('📈 统计信息:');
    console.log(`   高严重程度: ${severityStats.HIGH || 0} 个`);
    console.log(`   中严重程度: ${severityStats.MEDIUM || 0} 个`);
    console.log(`   低严重程度: ${severityStats.LOW || 0} 个`);

    // 保存详细报告
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalCycles: this.cycles.length,
        severityBreakdown: severityStats,
        modulesAffected: new Set(this.cycles.flat()).size
      },
      cycles: this.cycles,
      detailedCycles: this.cycleDetails,
      dependencyGraph: {
        modules: Object.fromEntries(this.modules),
        dependencies: Object.fromEntries(
          Array.from(this.dependencies.entries()).map(([k, v]) => [k, Array.from(v)])
        ),
        reverseDependencies: Object.fromEntries(
          Array.from(this.reverseDeps.entries()).map(([k, v]) => [k, Array.from(v)])
        )
      }
    };

    fs.writeFileSync('circular-dependencies-report.json', JSON.stringify(report, null, 2));
    console.log('\n💾 详细报告已保存至: circular-dependencies-report.json');
  }

  /**
   * 获取模块的依赖链
   */
  getDependencyChain(moduleName, maxDepth = 5) {
    const chain = [];
    const visited = new Set();

    const traverse = (current, depth = 0) => {
      if (depth >= maxDepth || visited.has(current)) return;

      visited.add(current);
      chain.push({ module: current, depth });

      const deps = this.dependencies.get(current);
      if (deps) {
        for (const dep of deps) {
          traverse(dep, depth + 1);
        }
      }
    };

    traverse(moduleName);
    return chain;
  }

  /**
   * 分析模块耦合度
   */
  analyzeCoupling() {
    const couplingAnalysis = [];

    for (const [moduleName, deps] of this.dependencies) {
      const reverseDeps = this.reverseDeps.get(moduleName) || new Set();
      const module = this.modules.get(moduleName);

      couplingAnalysis.push({
        module: moduleName,
        outgoingDeps: deps.size,
        incomingDeps: reverseDeps.size,
        totalDeps: deps.size + reverseDeps.size,
        depth: module?.depth || 0,
        instability: deps.size / (deps.size + reverseDeps.size) || 0
      });
    }

    // 按耦合度排序
    return couplingAnalysis.sort((a, b) => b.totalDeps - a.totalDeps);
  }
}

// CLI接口
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  const checker = new CircularDependencyChecker();

  try {
    switch (command) {
      case 'check':
      case 'analyze':
        const result = await checker.check();
        if (result.hasCycles) {
          console.log(`\n⚠️ 发现 ${result.cycleCount} 个循环依赖，请检查 circular-dependencies-report.json`);
          process.exit(1);
        } else {
          console.log('\n✅ 未发现循环依赖');
        }
        break;

      case 'coupling':
        await checker.check();
        const coupling = checker.analyzeCoupling();
        console.log('\n📊 模块耦合度分析:');
        coupling.slice(0, 10).forEach((item, index) => {
          console.log(`${index + 1}. ${item.module}: ${item.totalDeps} 依赖 (不稳定性: ${(item.instability * 100).toFixed(1)}%)`);
        });
        break;

      default:
        console.log('循环依赖检测工具');
        console.log('使用方法:');
        console.log('  node circular-dependency-checker.js check    - 检测循环依赖');
        console.log('  node circular-dependency-checker.js analyze  - 分析依赖关系');
        console.log('  node circular-dependency-checker.js coupling - 分析模块耦合度');
        break;
    }
  } catch (error) {
    console.error('❌ 操作失败:', error.message);
    process.exit(1);
  }
}

// 如果直接运行此脚本
const url = new URL(import.meta.url);
const isMainScript = url.pathname.replace(/^\/([A-Z]:)/, '$1').replace(/\//g, '\\') === process.argv[1];

if (isMainScript) {
  main().catch(error => {
    console.error('未处理的错误:', error);
    process.exit(1);
  });
}

export { CircularDependencyChecker };
