#!/usr/bin/env zx

/**
 * ESLint自动修复工具
 * 批量修复代码质量问题
 */

import fs from 'fs';
import { $ } from 'zx';

console.log('🔧 ESLint自动修复工具');
console.log('========================');

// 1. 运行ESLint检查，获取问题列表
console.log('\n📋 1. 获取ESLint问题列表...');
try {
  const eslintResult =
    await $`npx eslint src/core/ --ext .js --format json 2>/dev/null || true`;
  const eslintOutput = eslintResult.stdout || '[]';
  const issues = JSON.parse(eslintOutput);

  console.log(`📊 发现 ${issues.length} 个文件有问题`);

  // 2. 分类问题
  const issueStats = {
    total: 0,
    errors: 0,
    warnings: 0,
    byRule: {},
    byFile: {},
  };

  issues.forEach((file) => {
    const filePath = file.filePath;
    issueStats.byFile[filePath] = file.messages.length;

    file.messages.forEach((msg) => {
      issueStats.total++;
      if (msg.severity === 2) issueStats.errors++;
      if (msg.severity === 1) issueStats.warnings++;

      const rule = msg.ruleId || 'unknown';
      issueStats.byRule[rule] = (issueStats.byRule[rule] || 0) + 1;
    });
  });

  console.log(
    `📈 统计: ${issueStats.total}个问题 (${issueStats.errors}错误, ${issueStats.warnings}警告)`,
  );

  // 3. 自动修复
  console.log('\n🔧 2. 执行自动修复...');
  try {
    await $`npx eslint src/core/ --ext .js --fix`;
    console.log('✅ 自动修复完成');
  } catch (error) {
    console.log('⚠️ 自动修复部分完成，可能需要手动处理');
  }

  // 4. 验证修复结果
  console.log('\n✅ 3. 验证修复结果...');
  try {
    const afterFix =
      await $`npx eslint src/core/ --ext .js --format json 2>/dev/null || true`;
    const afterIssues = JSON.parse(afterFix.stdout || '[]');
    const afterTotal = afterIssues.reduce(
      (sum, file) => sum + file.messages.length,
      0,
    );

    const fixed = issueStats.total - afterTotal;
    console.log(
      `📊 修复结果: ${fixed}/${issueStats.total} 个问题已修复 (${Math.round((fixed / issueStats.total) * 100)}%)`,
    );

    // 5. 生成修复报告
    const report = {
      timestamp: new Date().toISOString(),
      before: issueStats,
      after: {
        total: afterTotal,
        files: afterIssues.length,
      },
      improvement: {
        fixed: fixed,
        remaining: afterTotal,
        successRate: Math.round((fixed / issueStats.total) * 100),
      },
    };

    fs.writeFileSync('eslint-fix-report.json', JSON.stringify(report, null, 2));
    console.log('📄 修复报告已保存: eslint-fix-report.json');
  } catch (error) {
    console.log('❌ 验证修复结果失败:', error.message);
  }
} catch (error) {
  console.log('❌ 获取ESLint问题失败:', error.message);
}

console.log('\n🎯 ESLint修复流程完成');
