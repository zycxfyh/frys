/**
 * 安全重构工具
 * 自动处理路径更新和依赖关系维护，支持备份和回滚
 */

import fs from 'fs';
import path from 'path';

class SafeRefactor {
  constructor() {
    this.changes = [];
    this.backups = new Map();
    this.dependencyMap = null;
    this.featureAssessment = null;
  }

  async initialize() {
    console.log('🔧 初始化安全重构工具...');

    // 加载依赖分析数据
    try {
      const depData = fs.readFileSync('dependency-map.json', 'utf8');
      this.dependencyMap = JSON.parse(depData);
      console.log('✅ 已加载依赖分析数据');
    } catch (error) {
      console.warn('⚠️ 无法加载依赖分析数据，将继续但功能受限');
    }

    // 加载功能评估数据
    try {
      const featureData = fs.readFileSync('feature-value-assessment.json', 'utf8');
      this.featureAssessment = JSON.parse(featureData);
      console.log('✅ 已加载功能评估数据');
    } catch (error) {
      console.warn('⚠️ 无法加载功能评估数据，将继续但功能受限');
    }
  }

  // 安全重命名文件
  async safeRename(oldPath, newPath) {
    const fullOldPath = path.resolve(oldPath);
    const fullNewPath = path.resolve(newPath);

    console.log(`📝 重命名: ${oldPath} → ${newPath}`);

    // 检查源文件是否存在
    if (!fs.existsSync(fullOldPath)) {
      throw new Error(`源文件不存在: ${fullOldPath}`);
    }

    // 检查目标文件是否已存在
    if (fs.existsSync(fullNewPath)) {
      throw new Error(`目标文件已存在: ${fullNewPath}`);
    }

    // 创建备份
    const backupPath = `${fullOldPath}.backup.${Date.now()}`;
    await fs.promises.copyFile(fullOldPath, backupPath);
    this.backups.set(fullOldPath, backupPath);

    // 执行重命名
    await fs.promises.rename(fullOldPath, fullNewPath);

    // 记录变更
    this.changes.push({
      type: 'rename',
      oldPath: fullOldPath,
      newPath: fullNewPath,
      backupPath,
      timestamp: new Date().toISOString()
    });

    console.log(`✅ 重命名完成，已创建备份: ${path.basename(backupPath)}`);
  }

  // 更新导入语句
  async updateImports(oldPath, newPath) {
    console.log(`🔄 更新导入语句: ${oldPath} → ${newPath}`);

    const oldImportPath = this.pathToImport(oldPath);
    const newImportPath = this.pathToImport(newPath);

    const jsFiles = await this.findAllJsFiles('src');

    for (const file of jsFiles) {
      try {
        const content = await fs.promises.readFile(file, 'utf8');

        // 检查是否包含旧的导入路径
        if (content.includes(oldImportPath)) {
          console.log(`  更新文件: ${path.relative('src', file)}`);

          // 创建备份
          const backupPath = `${file}.backup.${Date.now()}`;
          await fs.promises.copyFile(file, backupPath);
          this.backups.set(file, backupPath);

          // 更新导入语句
          const updatedContent = content.replace(
            new RegExp(this.escapeRegex(oldImportPath), 'g'),
            newImportPath
          );

          await fs.promises.writeFile(file, updatedContent);

          // 记录变更
          this.changes.push({
            type: 'update_imports',
            file,
            oldImport: oldImportPath,
            newImport: newImportPath,
            backupPath,
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        console.warn(`  ⚠️ 更新文件失败 ${file}:`, error.message);
      }
    }

    console.log(`✅ 导入语句更新完成`);
  }

  // 批量重命名Inspired文件
  async batchRenameInspired() {
    console.log('🚀 开始批量重命名Inspired文件...');

    if (!this.featureAssessment) {
      throw new Error('需要功能评估数据才能执行批量重命名');
    }

    const renameTasks = this.featureAssessment.recommendations.rename || [];

    console.log(`📋 发现 ${renameTasks.length} 个需要重命名的文件`);

    for (const task of renameTasks) {
      const oldPath = path.join('src', task.name + '.js');
      const newPath = path.join('src', task.name.replace('Inspired', '') + '.js');

      console.log(`🔄 处理: ${task.name} → ${task.name.replace('Inspired', '')}`);
      console.log(`   旧路径: ${oldPath}`);
      console.log(`   新路径: ${newPath}`);

      try {
        // 检查文件是否存在
        if (!fs.existsSync(oldPath)) {
          console.log(`⚠️  源文件不存在: ${oldPath}`);
          continue;
        }

        if (fs.existsSync(newPath)) {
          console.log(`⚠️  目标文件已存在: ${newPath}`);
          continue;
        }

        // 首先更新所有引用这个文件的导入语句
        console.log(`   📝 更新导入语句...`);
        await this.updateImports(oldPath, newPath);

        // 然后重命名文件
        console.log(`   📁 重命名文件...`);
        await this.safeRename(oldPath, newPath);

        console.log(`✅ 完成: ${task.name} → ${task.name.replace('Inspired', '')}`);

      } catch (error) {
        console.error(`❌ 重命名失败 ${task.name}:`, error.message);
        console.error(error.stack);
      }
    }

    console.log('🎉 批量重命名完成！');
  }

  // 移除不需要的文件
  async removeFiles(toRemove) {
    console.log('🗑️ 开始移除不需要的文件...');

    for (const fileName of toRemove) {
      const filePath = path.join('src', fileName + '.js');

      try {
        if (fs.existsSync(filePath)) {
          // 创建备份
          const backupPath = `${filePath}.backup.${Date.now()}`;
          await fs.promises.copyFile(filePath, backupPath);
          this.backups.set(filePath, backupPath);

          // 检查是否被其他文件引用
          const references = await this.findReferences(filePath);
          if (references.length > 0) {
            console.warn(`⚠️ 文件 ${fileName} 仍被以下文件引用:`);
            references.forEach(ref => console.warn(`  - ${ref}`));
            console.warn(`跳过删除 ${fileName}`);
            continue;
          }

          // 删除文件
          await fs.promises.unlink(filePath);

          this.changes.push({
            type: 'remove',
            filePath,
            backupPath,
            timestamp: new Date().toISOString()
          });

          console.log(`✅ 已移除: ${fileName}`);
        } else {
          console.log(`⚠️ 文件不存在: ${fileName}`);
        }
      } catch (error) {
        console.error(`❌ 移除失败 ${fileName}:`, error.message);
      }
    }
  }

  // 查找文件的所有引用
  async findReferences(filePath) {
    const importPath = this.pathToImport(filePath);
    const jsFiles = await this.findAllJsFiles('src');
    const references = [];

    for (const file of jsFiles) {
      if (file === filePath) continue; // 跳过文件本身

      try {
        const content = await fs.promises.readFile(file, 'utf8');
        if (content.includes(importPath)) {
          references.push(path.relative('src', file));
        }
      } catch (error) {
        // 忽略读取错误
      }
    }

    return references;
  }

  // 回滚所有变更
  async rollback() {
    console.log('🔄 开始回滚所有变更...');

    // 反向执行变更
    const reversedChanges = [...this.changes].reverse();

    for (const change of reversedChanges) {
      try {
        switch (change.type) {
          case 'rename':
            // 将新文件重命名回原名
            if (fs.existsSync(change.newPath)) {
              await fs.promises.rename(change.newPath, change.oldPath);
              console.log(`🔄 回滚重命名: ${path.basename(change.newPath)} → ${path.basename(change.oldPath)}`);
            }
            break;

          case 'update_imports':
            // 恢复备份的文件内容
            if (fs.existsSync(change.backupPath)) {
              await fs.promises.copyFile(change.backupPath, change.file);
              console.log(`🔄 恢复文件: ${path.relative('src', change.file)}`);
            }
            break;

          case 'remove':
            // 从备份恢复已删除的文件
            if (fs.existsSync(change.backupPath)) {
              await fs.promises.copyFile(change.backupPath, change.filePath);
              console.log(`🔄 恢复删除的文件: ${path.basename(change.filePath)}`);
            }
            break;
        }
      } catch (error) {
        console.error(`❌ 回滚失败:`, error.message);
      }
    }

    console.log('✅ 回滚完成');
  }

  // 清理备份文件
  async cleanupBackups() {
    console.log('🧹 清理备份文件...');

    for (const [originalPath, backupPath] of this.backups) {
      try {
        if (fs.existsSync(backupPath)) {
          await fs.promises.unlink(backupPath);
          console.log(`🗑️ 删除备份: ${path.basename(backupPath)}`);
        }
      } catch (error) {
        console.warn(`⚠️ 删除备份失败 ${backupPath}:`, error.message);
      }
    }

    this.backups.clear();
    console.log('✅ 备份清理完成');
  }

  // 验证重构结果
  async validateRefactor() {
    console.log('🔍 验证重构结果...');

    const issues = [];

    // 检查所有JavaScript文件是否能正常解析
    const jsFiles = await this.findAllJsFiles('src');
    for (const file of jsFiles) {
      try {
        // 简单的语法检查：尝试读取并解析JSON-like结构
        const content = await fs.promises.readFile(file, 'utf8');

        // 检查是否有明显的语法错误
        if (content.includes('undefined') && content.includes('import')) {
          // 简单的启发式检查
          issues.push({
            type: 'potential_syntax_error',
            file: path.relative('src', file),
            description: '文件可能包含语法错误'
          });
        }
      } catch (error) {
        issues.push({
          type: 'file_read_error',
          file: path.relative('src', file),
          description: error.message
        });
      }
    }

    // 检查导入路径是否正确
    for (const file of jsFiles) {
      try {
        const content = await fs.promises.readFile(file, 'utf8');
        const importMatches = content.match(/import\s+.*?\s+from\s+['"]([^'"]+)['"]/g);

        if (importMatches) {
          for (const match of importMatches) {
            const importPath = match.match(/from\s+['"]([^'"]+)['"]/)[1];

            if (importPath.startsWith('./') || importPath.startsWith('../')) {
              // 检查相对路径是否指向存在的文件
              const fileDir = path.dirname(file);
              const resolvedPath = path.resolve(fileDir, importPath);

              const extensions = ['', '.js', '/index.js'];
              let exists = false;

              for (const ext of extensions) {
                if (fs.existsSync(resolvedPath + ext)) {
                  exists = true;
                  break;
                }
              }

              if (!exists) {
                issues.push({
                  type: 'broken_import',
                  file: path.relative('src', file),
                  importPath,
                  description: `导入路径不存在: ${importPath}`
                });
              }
            }
          }
        }
      } catch (error) {
        // 忽略读取错误
      }
    }

    if (issues.length === 0) {
      console.log('✅ 重构验证通过，没有发现问题');
      return true;
    } else {
      console.log('⚠️ 发现以下问题:');
      issues.forEach(issue => {
        console.log(`  ${issue.type}: ${issue.file} - ${issue.description}`);
      });
      return false;
    }
  }

  // 执行完整的重构流程
  async executeFullRefactor() {
    console.log('🚀 开始执行完整重构流程...');

    try {
      // 初始化
      await this.initialize();

      // 备份重要文件
      console.log('📦 创建项目备份...');
      await this.createProjectBackup();

      // 阶段1: 重命名文件
      console.log('\n📝 阶段1: 重命名Inspired文件...');
      await this.batchRenameInspired();

      // 阶段2: 移除不需要的文件
      console.log('\n🗑️ 阶段2: 移除不需要的文件...');
      const toRemove = ['core/LodashInspiredUtils'];
      await this.removeFiles(toRemove);

      // 阶段3: 验证结果
      console.log('\n🔍 阶段3: 验证重构结果...');
      const isValid = await this.validateRefactor();

      if (isValid) {
        console.log('🎉 重构成功完成！');

        // 生成报告
        this.generateReport();

        // 可选：清理备份
        console.log('\n🧹 是否清理备份文件？(y/N): ');
        // 注意：在实际使用中应该添加用户交互

      } else {
        console.log('❌ 重构验证失败，正在回滚...');
        await this.rollback();
        console.log('✅ 已回滚到重构前的状态');
      }

    } catch (error) {
      console.error('❌ 重构失败:', error.message);
      console.log('正在回滚...');
      await this.rollback();
      throw error;
    }
  }

  // 创建项目备份
  async createProjectBackup() {
    const backupDir = `backup-${Date.now()}`;
    const srcDir = 'src';

    console.log(`📦 创建备份到: ${backupDir}`);

    // 简单的目录复制
    await this.copyDirectory(srcDir, backupDir);

    this.changes.push({
      type: 'project_backup',
      backupDir,
      timestamp: new Date().toISOString()
    });
  }

  // 递归复制目录
  async copyDirectory(src, dest) {
    const entries = await fs.promises.readdir(src, { withFileTypes: true });

    await fs.promises.mkdir(dest, { recursive: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath);
      } else {
        await fs.promises.copyFile(srcPath, destPath);
      }
    }
  }

  // 工具方法
  pathToImport(filePath) {
    // 将文件路径转换为import路径
    const relativePath = path.relative('src', filePath);
    return './' + relativePath.replace(/\.js$/, '').replace(/\\/g, '/');
  }

  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  async findAllJsFiles(dir) {
    const files = [];

    async function scan(currentDir) {
      const items = await fs.promises.readdir(currentDir, { withFileTypes: true });

      for (const item of items) {
        const fullPath = path.join(currentDir, item.name);

        if (item.isDirectory()) {
          await scan(fullPath);
        } else if (item.name.endsWith('.js')) {
          files.push(fullPath);
        }
      }
    }

    await scan(dir);
    return files;
  }

  // 生成重构报告
  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalChanges: this.changes.length,
        renames: this.changes.filter(c => c.type === 'rename').length,
        importUpdates: this.changes.filter(c => c.type === 'update_imports').length,
        removals: this.changes.filter(c => c.type === 'remove').length,
        backupsCreated: this.backups.size
      },
      changes: this.changes,
      backups: Array.from(this.backups.entries()).map(([orig, backup]) => ({
        originalFile: orig,
        backupFile: backup
      }))
    };

    fs.writeFileSync('refactor-report.json', JSON.stringify(report, null, 2));
    console.log('💾 重构报告已保存至: refactor-report.json');
  }
}

// CLI接口
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  const refactor = new SafeRefactor();

  try {
    switch (command) {
      case 'full':
        await refactor.executeFullRefactor();
        break;

      case 'rename':
        await refactor.initialize();
        await refactor.batchRenameInspired();
        break;

      case 'validate':
        await refactor.validateRefactor();
        break;

      case 'rollback':
        await refactor.rollback();
        break;

      case 'cleanup':
        await refactor.cleanupBackups();
        break;

      default:
        console.log('使用方法:');
        console.log('  node safe-refactor.js full     - 执行完整重构');
        console.log('  node safe-refactor.js rename   - 仅重命名文件');
        console.log('  node safe-refactor.js validate - 验证重构结果');
        console.log('  node safe-refactor.js rollback - 回滚变更');
        console.log('  node safe-refactor.js cleanup  - 清理备份');
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

export { SafeRefactor };
