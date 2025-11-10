/**
 * 依赖关系映射器
 * 建立完整的模块依赖图谱，为安全重构提供依据
 */

import fs from 'fs';
import path from 'path';

class DependencyMapper {
  constructor() {
    this.modules = new Map();      // 模块信息
    this.dependencies = new Map(); // 依赖关系
    this.reverseDeps = new Map();  // 反向依赖
    this.cycles = [];              // 循环依赖检测
  }

  async analyze(rootDir = 'src') {
    console.log('🔍 开始依赖关系分析...');

    // 第一遍：收集所有模块
    await this.collectModules(rootDir);

    // 第二遍：分析依赖关系
    await this.analyzeDependencies();

    // 第三遍：检测循环依赖
    this.detectCycles();

    // 生成报告
    this.generateReport();
  }

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
          exports: [],
          imports: [],
          complexity: 0,
          lines: 0
        });
      }
    }
  }

  async analyzeDependencies() {
    for (const [moduleName, module] of this.modules) {
      try {
        const content = fs.readFileSync(module.path, 'utf8');
        module.lines = content.split('\n').length;

        // 提取导入语句
        const imports = this.extractImports(content);
        module.imports = imports;

        // 记录依赖关系
        for (const importPath of imports) {
          const resolvedPath = this.resolveImportPath(importPath, moduleName);
          if (resolvedPath && this.modules.has(resolvedPath)) {
            if (!this.dependencies.has(moduleName)) {
              this.dependencies.set(moduleName, new Set());
            }
            this.dependencies.get(moduleName).add(resolvedPath);

            // 记录反向依赖
            if (!this.reverseDeps.has(resolvedPath)) {
              this.reverseDeps.set(resolvedPath, new Set());
            }
            this.reverseDeps.get(resolvedPath).add(moduleName);
          }
        }

        // 提取导出语句
        module.exports = this.extractExports(content);

        // 计算复杂度 (简单度量)
        module.complexity = this.calculateComplexity(content);

      } catch (error) {
        console.warn(`分析模块失败 ${moduleName}:`, error.message);
      }
    }
  }

  extractImports(content) {
    const imports = [];
    const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;

    let match;
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    return imports;
  }

  extractExports(content) {
    const exports = [];
    const exportRegex = /export\s+(?:const|function|class|default)/g;

    let match;
    while ((match = exportRegex.exec(content)) !== null) {
      exports.push(match[0]);
    }

    return exports;
  }

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
        if (this.modules.has(normalizedPath)) {
          return normalizedPath;
        }
      }
    }

    // 处理绝对路径 (src/开头的)
    if (importPath.startsWith('src/')) {
      return importPath.replace('src/', '').replace(/\.js$/, '');
    }

    // 处理@别名或其他别名
    // 这里可以扩展支持更多的路径别名

    return null;
  }

  calculateComplexity(content) {
    // 简单复杂度计算：条件语句、循环、函数数量
    const conditions = (content.match(/if\s*\(|while\s*\(|for\s*\(/g) || []).length;
    const functions = (content.match(/function\s+|=>/g) || []).length;
    const classes = (content.match(/class\s+/g) || []).length;

    return conditions + functions + classes;
  }

  detectCycles() {
    const visited = new Set();
    const recursionStack = new Set();

    const visit = (moduleName) => {
      if (recursionStack.has(moduleName)) {
        // 发现循环依赖
        const cycle = Array.from(recursionStack);
        cycle.push(moduleName);
        this.cycles.push(cycle);
        return;
      }

      if (visited.has(moduleName)) {
        return;
      }

      visited.add(moduleName);
      recursionStack.add(moduleName);

      const deps = this.dependencies.get(moduleName);
      if (deps) {
        for (const dep of deps) {
          visit(dep);
        }
      }

      recursionStack.delete(moduleName);
    };

    for (const moduleName of this.modules.keys()) {
      if (!visited.has(moduleName)) {
        visit(moduleName);
      }
    }
  }

  generateReport() {
    console.log('\n📊 依赖关系分析报告');
    console.log('='.repeat(60));

    console.log(`\n📦 总模块数: ${this.modules.size}`);

    // 按行数排序显示最大文件
    const sortedByLines = Array.from(this.modules.entries())
      .map(([name, module]) => [name, module.lines])
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15);

    console.log('\n📏 代码量最大的模块:');
    sortedByLines.forEach(([name, lines], index) => {
      console.log(`${index + 1}. ${name}: ${lines}行`);
    });

    // 复杂度最高的模块
    const sortedByComplexity = Array.from(this.modules.entries())
      .map(([name, module]) => [name, module.complexity])
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15);

    console.log('\n🧠 复杂度最高的模块:');
    sortedByComplexity.forEach(([name, complexity], index) => {
      console.log(`${index + 1}. ${name}: 复杂度${complexity}`);
    });

    // 依赖最多的模块
    const sortedByDeps = Array.from(this.modules.entries())
      .map(([name, module]) => [name, module.imports.length])
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15);

    console.log('\n🔗 依赖最多的模块:');
    sortedByDeps.forEach(([name, count], index) => {
      console.log(`${index + 1}. ${name}: ${count}个依赖`);
    });

    // 被依赖最多的模块
    const sortedByReverseDeps = Array.from(this.reverseDeps.entries())
      .map(([name, deps]) => [name, deps.size])
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15);

    console.log('\n🎯 被依赖最多的模块:');
    sortedByReverseDeps.forEach(([name, count], index) => {
      console.log(`${index + 1}. ${name}: 被${count}个模块依赖`);
    });

    // 循环依赖警告
    if (this.cycles.length > 0) {
      console.log('\n⚠️  发现循环依赖:');
      this.cycles.forEach((cycle, index) => {
        console.log(`${index + 1}. ${cycle.join(' → ')}`);
      });
    } else {
      console.log('\n✅ 未发现循环依赖');
    }

    // 依赖关系统计
    const totalDeps = Array.from(this.dependencies.values())
      .reduce((sum, deps) => sum + deps.size, 0);

    console.log('\n📈 依赖统计:');
    console.log(`  总依赖关系数: ${totalDeps}`);
    console.log(`  平均每个模块依赖: ${(totalDeps / this.modules.size).toFixed(1)}个`);

    // 生成详细报告
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalModules: this.modules.size,
        totalDependencies: totalDeps,
        cyclesFound: this.cycles.length,
        avgDepsPerModule: totalDeps / this.modules.size
      },
      largestFiles: sortedByLines.slice(0, 10),
      mostComplex: sortedByComplexity.slice(0, 10),
      mostDeps: sortedByDeps.slice(0, 10),
      mostDepended: sortedByReverseDeps.slice(0, 10),
      cycles: this.cycles,
      modules: Object.fromEntries(this.modules),
      dependencies: Object.fromEntries(
        Array.from(this.dependencies.entries())
          .map(([k, v]) => [k, Array.from(v)])
      ),
      reverseDependencies: Object.fromEntries(
        Array.from(this.reverseDeps.entries())
          .map(([k, v]) => [k, Array.from(v)])
      )
    };

    fs.writeFileSync('dependency-map.json', JSON.stringify(report, null, 2));
    console.log('\n💾 详细报告已保存至: dependency-map.json');
  }

  // 获取模块的重构影响范围
  getRefactorImpact(moduleName) {
    const impact = {
      directlyAffected: this.reverseDeps.get(moduleName)?.size || 0,
      indirectlyAffected: 0,
      risk: 'LOW'
    };

    // 计算间接影响 (递归)
    const visited = new Set();
    const queue = [moduleName];

    while (queue.length > 0) {
      const current = queue.shift();
      if (visited.has(current)) continue;

      visited.add(current);

      const deps = this.reverseDeps.get(current);
      if (deps) {
        for (const dep of deps) {
          if (!visited.has(dep)) {
            queue.push(dep);
            impact.indirectlyAffected++;
          }
        }
      }
    }

    // 评估风险等级
    if (impact.directlyAffected > 10 || impact.indirectlyAffected > 50) {
      impact.risk = 'HIGH';
    } else if (impact.directlyAffected > 5 || impact.indirectlyAffected > 20) {
      impact.risk = 'MEDIUM';
    }

    return impact;
  }

  // 生成重构建议
  generateRefactorSuggestions() {
    const suggestions = [];

    // 1. 循环依赖修复建议
    if (this.cycles.length > 0) {
      suggestions.push({
        type: 'CYCLE_DEPENDENCY',
        priority: 'HIGH',
        description: `发现${this.cycles.length}个循环依赖`,
        actions: this.cycles.map((cycle, index) =>
          `循环${index + 1}: ${cycle.join(' → ')} - 建议提取共同接口或使用依赖注入`
        )
      });
    }

    // 2. 高复杂度模块重构建议
    const highComplexityModules = Array.from(this.modules.entries())
      .filter(([_, module]) => module.complexity > 20)
      .map(([name, module]) => ({ name, complexity: module.complexity }));

    if (highComplexityModules.length > 0) {
      suggestions.push({
        type: 'HIGH_COMPLEXITY',
        priority: 'MEDIUM',
        description: `${highComplexityModules.length}个模块复杂度过高`,
        actions: highComplexityModules.map(m =>
          `${m.name}: 复杂度${m.complexity} - 建议拆分为更小的模块`
        )
      });
    }

    // 3. 高依赖模块优化建议
    const highDepModules = Array.from(this.modules.entries())
      .filter(([_, module]) => module.imports.length > 15)
      .map(([name, module]) => ({ name, deps: module.imports.length }));

    if (highDepModules.length > 0) {
      suggestions.push({
        type: 'HIGH_DEPENDENCIES',
        priority: 'MEDIUM',
        description: `${highDepModules.length}个模块依赖过多`,
        actions: highDepModules.map(m =>
          `${m.name}: ${m.deps}个依赖 - 建议使用外观模式或依赖注入`
        )
      });
    }

    // 4. 大文件拆分建议
    const largeFiles = Array.from(this.modules.entries())
      .filter(([_, module]) => module.lines > 500)
      .map(([name, module]) => ({ name, lines: module.lines }));

    if (largeFiles.length > 0) {
      suggestions.push({
        type: 'LARGE_FILES',
        priority: 'LOW',
        description: `${largeFiles.length}个文件过大`,
        actions: largeFiles.map(f =>
          `${f.name}: ${f.lines}行 - 建议拆分为多个小文件`
        )
      });
    }

    return suggestions;
  }
}

// 运行分析
new DependencyMapper().analyze().catch(console.error);
