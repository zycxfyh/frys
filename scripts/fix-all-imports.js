#!/usr/bin/env node

/**
 * 批量修复所有测试文件的导入路径
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const __dirname = process.cwd();

/**
 * 计算正确的test-helpers.js导入路径
 */
function getCorrectTestHelpersPath(filePath) {
  const pathParts = filePath.split('/');
  const depth = pathParts.length - 1; // 排除文件名

  // tests/test-helpers.js 是基准位置
  // 计算从当前文件到tests目录的相对路径
  const upLevels = Math.max(1, depth - 1); // 至少向上1级到达tests目录
  return '../'.repeat(upLevels) + 'test-helpers.js';
}

/**
 * 修复单个文件的test-helpers导入路径
 */
function fixTestHelpersImport(filePath) {
  const fullPath = join(__dirname, filePath);
  const content = readFileSync(fullPath, 'utf8');

  // 检查是否包含test-helpers导入
  const importRegex =
    /import \{\s*setupStrictTestEnvironment[^}]*\} from ['"]([^'"]*test-helpers\.js)['"]/;
  const match = content.match(importRegex);

  if (match) {
    const currentPath = match[1];
    const correctPath = getCorrectTestHelpersPath(filePath);

    if (currentPath !== correctPath) {
      const newContent = content.replace(
        /import \{\s*setupStrictTestEnvironment[^}]*\} from ['"]([^'"]*test-helpers\.js)['"]/,
        `import {
  setupStrictTestEnvironment,
  createStrictTestCleanup,
  strictAssert,
  withTimeout,
  createDetailedErrorReporter
} from '${correctPath}'`,
      );

      writeFileSync(fullPath, newContent, 'utf8');
      console.log(`✅ 修复: ${filePath}`);
      console.log(`   ${currentPath} -> ${correctPath}`);
      return true;
    }
  }

  return false;
}

/**
 * 修复其他常见的导入路径问题
 */
function fixOtherImports(filePath) {
  const fullPath = join(__dirname, filePath);
  let content = readFileSync(fullPath, 'utf8');
  let changed = false;

  // 修复logger导入路径
  if (content.includes("from '../../src/utils/logger.js'")) {
    content = content.replace(
      /from ['"]\.\.\/\.\.\/src\/utils\/logger\.js['"]/g,
      "from '../../src/shared/utils/logger.js'",
    );
    changed = true;
  }

  // 修复其他可能的路径问题
  if (content.includes("from '../../src/utils/")) {
    content = content.replace(
      /from ['"]\.\.\/\.\.\/src\/utils\//g,
      "from '../../src/shared/utils/",
    );
    changed = true;
  }

  if (changed) {
    writeFileSync(fullPath, content, 'utf8');
    console.log(`🔧 修复其他导入: ${filePath}`);
  }

  return changed;
}

/**
 * 主函数
 */
function main() {
  console.log('🔧 开始批量修复测试文件导入路径...\n');

  // 获取所有测试文件
  const testFiles = execSync('find tests -name "*.test.js"', {
    encoding: 'utf8',
  })
    .trim()
    .split('\n')
    .filter(Boolean);

  console.log(`找到 ${testFiles.length} 个测试文件\n`);

  let fixedCount = 0;
  let otherFixes = 0;

  for (const file of testFiles) {
    try {
      const fixed = fixTestHelpersImport(file);
      const otherFixed = fixOtherImports(file);

      if (fixed) fixedCount++;
      if (otherFixed) otherFixes++;
    } catch (error) {
      console.error(`❌ 修复失败 ${file}:`, error.message);
    }
  }

  console.log(`\n✨ 修复完成!`);
  console.log(`📊 统计:`);
  console.log(`   test-helpers路径修复: ${fixedCount} 个文件`);
  console.log(`   其他导入路径修复: ${otherFixes} 个文件`);
  console.log(`   总计修复: ${fixedCount + otherFixes} 个文件`);
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
