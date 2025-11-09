#!/usr/bin/env node

/**
 * 🚀 简单批量更新测试文件 - 添加严格快速失败机制
 * GitHub社区最佳实践
 */

import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const __dirname = process.cwd();

/**
 * 获取所有测试文件
 */
function getTestFiles() {
	try {
		const output = execSync('find tests -name "*.test.js"', {
			encoding: "utf8",
		});
		return output.trim().split("\n").filter(Boolean);
	} catch (error) {
		console.error("查找测试文件失败:", error.message);
		return [];
	}
}

/**
 * 计算相对导入路径
 */
function getRelativeImportPath(filePath) {
	const pathParts = filePath.split("/");
	const upLevels = pathParts.length - 1;
	return "../".repeat(upLevels - 1) + "test-helpers.js";
}

/**
 * 更新单个测试文件
 */
function updateTestFile(filePath) {
	const fullPath = join(__dirname, filePath);
	const content = readFileSync(fullPath, "utf8");

	// 跳过已经更新的文件
	if (content.includes("setupStrictTestEnvironment")) {
		console.log(`⏭️  跳过: ${filePath} (已更新)`);
		return;
	}

	const importPath = getRelativeImportPath(filePath);
	const fileName = filePath.split("/").pop().replace(".test.js", "");

	// 添加导入语句
	const importStatement = `import {
  setupStrictTestEnvironment,
  createStrictTestCleanup,
  strictAssert,
  withTimeout,
  createDetailedErrorReporter
} from '${importPath}';
`;

	// 添加头部注释
	const headerComment = `/**
 * ${fileName} 测试
 * 🚀 严格快速失败机制 (GitHub社区最佳实践)
 */
`;

	// 在现有头部注释后或文件开头添加新的头部注释
	let updatedContent = content;
	if (content.startsWith("/**")) {
		// 替换现有的头部注释
		updatedContent =
			headerComment + content.replace(/^\/\*\*[\s\S]*?\*\//m, "").trim();
	} else {
		// 添加新的头部注释
		updatedContent = headerComment + "\n" + content;
	}

	// 添加导入语句
	const firstImportMatch = updatedContent.match(/^import/m);
	if (firstImportMatch) {
		const insertIndex =
			updatedContent.indexOf("\n", firstImportMatch.index) + 1;
		updatedContent =
			updatedContent.slice(0, insertIndex) +
			importStatement +
			updatedContent.slice(insertIndex);
	} else {
		updatedContent = importStatement + "\n" + updatedContent;
	}

	// 查找describe块
	const describeMatch = updatedContent.match(/describe\(['"]([^'"]+)['"]/);
	if (!describeMatch) {
		console.log(`⚠️  跳过: ${filePath} (未找到describe块)`);
		return;
	}

	const testSuiteName = describeMatch[1];
	const isCI = process.env.CI === "true";
	const testTimeout = isCI ? 2000 : 5000;

	// 在describe块内添加环境设置
	const describePattern = /describe\(['"]([^'"]+)['"]\s*,\s*\(\)\s*=>\s*\{/;
	const envSetup = `describe('${testSuiteName}', () => {
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
  });`;

	updatedContent = updatedContent.replace(describePattern, envSetup);

	// 添加afterEach清理
	if (!updatedContent.includes("afterEach")) {
		const beforeEachPattern = /beforeEach\([^}]*\}[;\s]*\n/;
		if (beforeEachPattern.test(updatedContent)) {
			updatedContent = updatedContent.replace(beforeEachPattern, (match) => {
				return (
					match +
					`
  afterEach(() => {
    // 重置系统状态
  });`
				);
			});
		} else {
			// 在describe开始后添加afterEach
			const describeStart = updatedContent.indexOf("describe(");
			const braceIndex = updatedContent.indexOf("{", describeStart) + 1;
			updatedContent =
				updatedContent.slice(0, braceIndex) +
				`\n  afterEach(() => {
    // 重置系统状态
  });` +
				updatedContent.slice(braceIndex);
		}
	}

	// 写入更新后的文件
	writeFileSync(fullPath, updatedContent, "utf8");
	console.log(`✅ 更新: ${filePath}`);
}

/**
 * 主函数
 */
function main() {
	console.log("🚀 开始批量更新测试文件 - 添加严格快速失败机制\n");

	const testFiles = getTestFiles();
	console.log(`找到 ${testFiles.length} 个测试文件\n`);

	let updated = 0;
	const skipped = 0;

	for (const file of testFiles) {
		try {
			updateTestFile(file);
			updated++;
		} catch (error) {
			console.error(`❌ 更新失败 ${file}:`, error.message);
		}
	}

	console.log(`\n✨ 更新完成!`);
	console.log(`📊 统计: ${updated} 个文件已更新, ${skipped} 个文件已跳过`);
	console.log("\n📋 下一步:");
	console.log("1. 运行测试验证更新是否正确: npm test");
	console.log("2. 检查CI环境下的快速失败行为");
	console.log("3. 监控测试性能和内存使用");
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
	main();
}
