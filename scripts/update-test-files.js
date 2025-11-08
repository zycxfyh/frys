#!/usr/bin/env node

/**
 * 🚀 批量更新测试文件 - 添加严格快速失败机制
 * GitHub社区最佳实践
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 更新单个测试文件
 */
function updateTestFile(filePath) {
  const content = readFileSync(filePath, 'utf8');
  const fileName = basename(filePath, '.test.js');
  const relativePath = filePath.replace(process.cwd() + '/', '');

  // 跳过已经更新的文件
  if (content.includes('setupStrictTestEnvironment')) {
    console.log(`⏭️  跳过: ${relativePath} (已更新)`);
    return;
  }

  // 计算相对导入路径
  const pathParts = relativePath.split('/');
  const upLevels = pathParts.length - 1; // 减去文件名部分
  const importPath = '../'.repeat(upLevels - 1) + 'test-helpers.js';

  // 添加导入语句
  const importStatement = `import {
  setupStrictTestEnvironment,
  createStrictTestCleanup,
  strictAssert,
  withTimeout,
  createDetailedErrorReporter
} from '${importPath}';
`;

  // 查找describe块的开始
  const describeMatch = content.match(/describe\(['"]([^'"]+)['"]/);
  if (!describeMatch) {
    console.log(`⚠️  跳过: ${relativePath} (未找到describe块)`);
    return;
  }

  const testSuiteName = describeMatch[1];

  // 添加头部注释和导入
  let updatedContent = content;

  // 添加头部注释
  if (!content.includes('严格快速失败机制')) {
    const headerComment = `/**
 * ${fileName} 测试
 * 🚀 严格快速失败机制 (GitHub社区最佳实践)
 */
`;
    updatedContent = headerComment + updatedContent.replace(/^\/\*\*[\s\S]*?\*\//m, '');
  }

  // 添加导入语句
  const firstImportMatch = updatedContent.match(/^import/m);
  if (firstImportMatch) {
    const insertIndex = updatedContent.indexOf('\n', firstImportMatch.index) + 1;
    updatedContent = updatedContent.slice(0, insertIndex) + importStatement + updatedContent.slice(insertIndex);
  } else {
    // 如果没有import语句，在文件开头添加
    updatedContent = importStatement + '\n' + updatedContent;
  }

  // 添加严格测试环境设置
  const isCI = process.env.CI === 'true';
  const testTimeout = isCI ? 2000 : 5000;

  const envSetup = `
describe('${testSuiteName}', () => {
  let monitor;
  let cleanup;
  let errorReporter;
  const TEST_TIMEOUT = ${testTimeout};

  beforeAll(() => {
    // 🔧 设置严格测试环境
    const env = setupStrictTestEnvironment({
      timeout: TEST_TIMEOUT,
      testName: '${testSuiteName}'
    });
    monitor = env.monitor;
    cleanup = env.cleanup;
    errorReporter = createDetailedErrorReporter('${testSuiteName}');
  });

  afterAll(async () => {
    // 🧹 严格清理
    await cleanup();
  });
`;

  // 替换describe块
  updatedContent = updatedContent.replace(
    /describe\(['"]([^'"]+)['"]\s*,\s*\(\)\s*=>\s*\{/,
    envSetup
  );

  // 添加afterEach清理
  const beforeEachMatch = updatedContent.match(/beforeEach\([^}]*\}[;\s]*\n/);
  if (beforeEachMatch) {
    const insertPos = beforeEachMatch.index + beforeEachMatch[0].length;
    updatedContent = updatedContent.slice(0, insertPos) +
      `
  afterEach(() => {
    // 重置系统状态
  });
` + updatedContent.slice(insertPos);
  }

  // 写入更新后的文件
  writeFileSync(filePath, updatedContent, 'utf8');
  console.log(`✅ 更新: ${relativePath}`);
}

/**
 * 递归遍历测试目录
 */
function walkTestDirectory(dir) {
  const files = readdirSync(dir);

  for (const file of files) {
    const fullPath = join(dir, file);
    const stat = statSync(fullPath);

    if (stat.isDirectory() && !file.startsWith('.')) {
      walkTestDirectory(fullPath);
    } else if (file.endsWith('.test.js')) {
      updateTestFile(fullPath);
    }
  }
}

/**
 * 主函数
 */
function main() {
  console.log('🚀 开始批量更新测试文件 - 添加严格快速失败机制\n');

  const testsDir = join(__dirname, '..', 'tests');
  walkTestDirectory(testsDir);

  console.log('\n✨ 测试文件更新完成！');
  console.log('\n📋 下一步:');
  console.log('1. 运行测试验证更新是否正确: npm test');
  console.log('2. 检查CI环境下的快速失败行为');
  console.log('3. 监控测试性能和内存使用');
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
