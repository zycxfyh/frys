#!/usr/bin/env node

/**
 * 修复测试文件中的导入路径问题
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const __dirname = process.cwd();

/**
 * 计算正确的导入路径
 */
function getCorrectImportPath(filePath) {
  const pathParts = filePath.split('/');
  const depth = pathParts.length - 1; // 排除文件名
  const upLevels = Math.max(1, depth - 1); // 至少向上1级到达tests目录
  return '../'.repeat(upLevels) + 'test-helpers.js';
}

/**
 * 修复单个文件的导入路径
 */
function fixImportPath(filePath) {
  const fullPath = join(__dirname, filePath);
  const content = readFileSync(fullPath, 'utf8');

  // 查找错误的导入语句
  const importRegex = /import \{\s*setupStrictTestEnvironment[^}]*\} from ['"]([^'"]*)['"]/;
  const match = content.match(importRegex);

  if (match) {
    const currentPath = match[1];
    const correctPath = getCorrectImportPath(filePath);

    if (currentPath !== correctPath) {
      const newContent = content.replace(
        /import \{\s*setupStrictTestEnvironment[^}]*\} from ['"]([^'"]*)['"]/,
        `import {
  setupStrictTestEnvironment,
  createStrictTestCleanup,
  strictAssert,
  withTimeout,
  createDetailedErrorReporter
} from '${correctPath}'`
      );

      writeFileSync(fullPath, newContent, 'utf8');
      console.log(`✅ 修复: ${filePath} (${currentPath} -> ${correctPath})`);
      return true;
    }
  }

  return false;
}

/**
 * 主函数
 */
function main() {
  console.log('🔧 开始修复测试文件导入路径...\n');

  // 获取所有测试文件
  const testFiles = execSync('find tests -name "*.test.js"', { encoding: 'utf8' })
    .trim()
    .split('\n')
    .filter(Boolean);

  let fixed = 0;
  let skipped = 0;

  for (const file of testFiles) {
    try {
      if (fixImportPath(file)) {
        fixed++;
      } else {
        skipped++;
      }
    } catch (error) {
      console.error(`❌ 修复失败 ${file}:`, error.message);
    }
  }

  console.log(`\n✨ 修复完成!`);
  console.log(`📊 统计: ${fixed} 个文件修复, ${skipped} 个文件跳过`);
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
