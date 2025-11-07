/**
 * WokeFlow 构建脚本
 * 基于Rollup理念的轻量打包工具
 */

import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync } from 'fs';
import { dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class LightweightBundler {
  constructor() {
    this.outputDir = 'dist';
    this.coreModules = [];
  }

  /**
   * 分析依赖关系
   */
  analyzeDependencies() {
    console.log('📦 分析模块依赖...');

    // 只包含重构后的核心模块（排除旧的Inspired模块）
    const coreModules = [
      // 基础模块
      'BaseModule',
      'container',
      'events',
      'error-handler',
      'plugin-system',
      'queue',
      'server',
      // 核心服务
      'AxiosInspiredHTTP',
      'messaging-adapter',
      'ZustandInspiredState',
      'JWTInspiredAuth',
      'DayJSInspiredDate',
      'LodashInspiredUtils'
    ];

    // 工具模块
    const utilsModules = [
      './src/utils/logger.js',
      './src/utils/config.js'
    ];

    // 业务服务模块
    const serviceModules = [
      './src/services/WorkflowEngine.js',
      './src/services/UserService.js'
    ];

    const coreDir = join(__dirname, '..', 'src', 'core');

    // 处理核心模块
    for (const moduleName of coreModules) {
      const modulePath = join(coreDir, `${moduleName}.js`);

      try {
        const content = readFileSync(modulePath, 'utf-8');

        this.coreModules.push({
          name: moduleName,
          path: modulePath,
          content,
          dependencies: this.extractImports(content)
        });
      } catch (error) {
        console.warn(`⚠️  跳过模块: ${moduleName} (${error.message})`);
      }
    }

    // 处理工具模块
    const projectDir = join(__dirname, '..');
    for (const utilsPath of utilsModules) {
      const modulePath = join(projectDir, utilsPath);
      const moduleName = utilsPath.split('/').pop().replace('.js', '');

      try {
        const content = readFileSync(modulePath, 'utf-8');

        this.coreModules.push({
          name: moduleName,
          path: modulePath,
          content,
          dependencies: this.extractImports(content)
        });
      } catch (error) {
        console.warn(`⚠️  跳过工具模块: ${moduleName} (${error.message})`);
      }
    }

    // 处理业务服务模块
    for (const servicePath of serviceModules) {
      const modulePath = join(projectDir, servicePath);
      const moduleName = servicePath.split('/').pop().replace('.js', '');

      try {
        const content = readFileSync(modulePath, 'utf-8');

        this.coreModules.push({
          name: moduleName,
          path: modulePath,
          content,
          dependencies: this.extractImports(content)
        });
      } catch (error) {
        console.warn(`⚠️  跳过业务服务: ${moduleName} (${error.message})`);
      }
    }

    console.log(`   发现 ${this.coreModules.length} 个模块`);
  }

  /**
   * 提取import语句
   * @param {string} content - 文件内容
   * @returns {Array} 依赖列表
   */
  extractImports(content) {
    const imports = [];
    const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];
      // 只处理相对路径的导入
      if (importPath.startsWith('./') || importPath.startsWith('../')) {
        imports.push(importPath);
      }
    }

    return imports;
  }

  /**
   * 创建轻量bundle
   */
  createBundle() {
    console.log('🔗 创建轻量bundle...');

    let bundleContent = `/**
 * WokeFlow 轻量版本
 * 自动生成于 ${new Date().toISOString()}
 * 包含 ${this.coreModules.length} 个核心模块
 */

`;

    // 添加模块映射
    bundleContent += 'const modules = {};\n\n';

    // 按依赖顺序排序（简化版，没有循环依赖检测）
    const sortedModules = this.topologicalSort();

    // 生成每个模块的包装代码
    for (const module of sortedModules) {
      bundleContent += this.wrapModule(module);
    }

    // 添加入口点
    bundleContent += `
// === 导出所有模块 ===
export {
  ${sortedModules.map(m => m.name).join(',\n  ')}
};

export default {
  ${sortedModules.map(m => `${m.name}`).join(',\n  ')}
};
`;

    return bundleContent;
  }

  /**
   * 拓扑排序（简化版）
   */
  topologicalSort() {
    // 简单按文件名排序，确保基础模块在前
    const priorityModules = ['WokeFlowError', 'ErrorHandler'];
    const otherModules = this.coreModules.filter(m => !priorityModules.includes(m.name));

    return [
      ...this.coreModules.filter(m => priorityModules.includes(m.name)),
      ...otherModules
    ];
  }

  /**
   * 包装单个模块
   * @param {Object} module - 模块信息
   */
  wrapModule(module) {
    console.log(`   包装模块: ${module.name}`);

    let content = module.content;

    // 移除ES6 import/export语句（简化处理）
    content = content.replace(/import\s+.*?\s+from\s+['"][^'"]+['"];?\s*/g, '');
    content = content.replace(/export\s+(class|function|const|let|var)\s+/g, '$1 ');
    content = content.replace(/export\s+default\s+/g, '');
    content = content.replace(/export\s*{\s*[^}]*\s*}/g, '');

    // 对于类模块，直接赋值给modules对象
    if (content.includes('class ' + module.name)) {
      return `
modules.${module.name} = (${content});
`;
    } else {
      // 对于其他模块，创建一个包装函数
      return `
modules.${module.name} = (() => {
${content.split('\n').map(line => line ? '  ' + line : line).join('\n')}
  return ${module.name};
})();
`;
    }
  }

  /**
   * 复制静态文件
   */
  copyStaticFiles() {
    console.log('📋 复制静态文件...');

    const filesToCopy = [
      'README.md',
      'package.json',
      'demo-open-source-integration.js'
    ];

    mkdirSync(this.outputDir, { recursive: true });

    for (const file of filesToCopy) {
      const src = join(__dirname, '..', file);
      const dest = join(__dirname, '..', this.outputDir, file);

      try {
        copyFileSync(src, dest);
        console.log(`   复制: ${file}`);
      } catch (error) {
        console.log(`   跳过: ${file} (${error.message})`);
      }
    }
  }

  /**
   * 生成package.json for dist
   */
  generateDistPackageJson() {
    console.log('📄 生成发布配置...');

    const originalPkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));
    const distPkg = {
      name: originalPkg.name + '-dist',
      version: originalPkg.version,
      description: originalPkg.description + ' (轻量bundle版本)',
      main: 'wokeflow-lightweight.js',
      type: 'module',
      scripts: {
        start: 'node demo-open-source-integration.js'
      },
      keywords: originalPkg.keywords,
      author: originalPkg.author,
      license: originalPkg.license,
      engines: originalPkg.engines
    };

    writeFileSync(
      join(__dirname, '..', this.outputDir, 'package.json'),
      JSON.stringify(distPkg, null, 2)
    );
  }

  /**
   * 构建过程
   */
  async build() {
    console.log('🏗️  WokeFlow 轻量构建开始\n');

    try {
      // 确保输出目录存在
      mkdirSync(this.outputDir, { recursive: true });

      // 执行构建步骤
      await this.analyzeDependencies();
      const bundle = this.createBundle();
      this.copyStaticFiles();
      this.generateDistPackageJson();

      // 写入bundle文件
      const bundlePath = join(__dirname, '..', this.outputDir, 'wokeflow-lightweight.js');
      writeFileSync(bundlePath, bundle);

      console.log('\n✅ 构建完成！');
      console.log(`📦 输出目录: ${this.outputDir}/`);
      console.log(`📄 主文件: wokeflow-lightweight.js`);
      console.log(`📊 模块数: ${this.coreModules.length}`);
      console.log(`📏 文件大小: ${this.formatBytes(bundle.length)}\n`);

      console.log('🎯 使用方法:');
      console.log('  cd dist');
      console.log('  npm install  # 如果需要依赖');
      console.log('  npm start\n');

    } catch (error) {
      console.error('❌ 构建失败:', error.message);
      process.exit(1);
    }
  }

  /**
   * 格式化字节数
   * @param {number} bytes - 字节数
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// 运行构建
const bundler = new LightweightBundler();
bundler.build().catch(console.error);
