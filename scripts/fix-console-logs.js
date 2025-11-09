#!/usr/bin/env node
/**
 * 自动化脚本：将 console.* 调用替换为 logger.*
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, '..');
const srcDir = path.join(projectRoot, 'src', 'core');

// 需要排除的文件（测试文件等）
const excludePatterns = [/\.test\.js$/, /\.spec\.js$/, /node_modules/];

// 日志级别映射
const logLevelMap = {
  'console.log': 'logger.info',
  'console.info': 'logger.info',
  'console.warn': 'logger.warn',
  'console.error': 'logger.error',
  'console.debug': 'logger.debug',
};

function shouldExclude(filePath) {
  return excludePatterns.some((pattern) => pattern.test(filePath));
}

function hasLoggerImport(content) {
  return /import\s+.*logger.*from\s+['"].*logger/i.test(content);
}

function addLoggerImport(content) {
  // 查找第一个 import 语句的位置
  const importMatch = content.match(/^import\s+/m);
  if (importMatch) {
    const insertPos = importMatch.index;
    const loggerImport =
      "import { logger } from '../../shared/utils/logger.js';\n";
    return (
      content.slice(0, insertPos) + loggerImport + content.slice(insertPos)
    );
  }
  // 如果没有 import，在文件开头添加
  return "import { logger } from '../../shared/utils/logger.js';\n\n" + content;
}

function replaceConsoleCalls(content) {
  let modified = content;
  let changeCount = 0;

  // 替换 console.log/error/warn/info/debug
  for (const [consoleMethod, loggerMethod] of Object.entries(logLevelMap)) {
    const regex = new RegExp(`\\b${consoleMethod.replace('.', '\\.')}\\(`, 'g');
    const matches = modified.match(regex);
    if (matches) {
      changeCount += matches.length;
      modified = modified.replace(regex, `${loggerMethod}(`);
    }
  }

  return { content: modified, changeCount };
}

function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');

    // 检查是否包含 console 调用
    if (!/\bconsole\.(log|error|warn|info|debug)\(/.test(content)) {
      return { processed: false, changes: 0 };
    }

    let modified = content;

    // 添加 logger import（如果需要）
    if (!hasLoggerImport(modified)) {
      modified = addLoggerImport(modified);
    }

    // 替换 console 调用
    const { content: newContent, changeCount } = replaceConsoleCalls(modified);

    if (changeCount > 0) {
      fs.writeFileSync(filePath, newContent, 'utf-8');
      return { processed: true, changes: changeCount };
    }

    return { processed: false, changes: 0 };
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return { processed: false, changes: 0, error: error.message };
  }
}

function walkDirectory(dir) {
  const results = [];
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      results.push(...walkDirectory(filePath));
    } else if (file.endsWith('.js') && !shouldExclude(filePath)) {
      results.push(filePath);
    }
  }

  return results;
}

function main() {
  console.log('🔍 Scanning for console.* calls...\n');

  const files = walkDirectory(srcDir);
  let totalProcessed = 0;
  let totalChanges = 0;
  const processedFiles = [];

  for (const file of files) {
    const result = processFile(file);
    if (result.processed) {
      totalProcessed++;
      totalChanges += result.changes;
      processedFiles.push({
        file: path.relative(projectRoot, file),
        changes: result.changes,
      });
    }
  }

  console.log('📊 Results:\n');
  console.log(`Total files scanned: ${files.length}`);
  console.log(`Files modified: ${totalProcessed}`);
  console.log(`Total replacements: ${totalChanges}\n`);

  if (processedFiles.length > 0) {
    console.log('Modified files:');
    processedFiles.forEach(({ file, changes }) => {
      console.log(`  ✓ ${file} (${changes} changes)`);
    });
  }

  console.log('\n✅ Console log standardization complete!');
  console.log('💡 Run "npm run lint" to verify the changes.');
}

main();
