#!/usr/bin/env node

/**
 * 智能测试运行器
 * 根据标签、优先级和依赖关系智能选择和运行测试
 */

import { execSync, spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

class SmartTestRunner {
	constructor() {
		this.options = {
			tags: [],
			excludeTags: [],
			priority: null,
			environment: "test",
			parallel: true,
			retries: 2,
			timeout: 300000, // 5分钟
			coverage: true,
			report: true,
		};
	}

	async run(args = process.argv.slice(2)) {
		this.parseArgs(args);

		console.log("🚀 启动智能测试运行器");
		console.log(`📋 测试标签: ${this.options.tags.join(", ") || "全部"}`);
		console.log(`🚫 排除标签: ${this.options.excludeTags.join(", ") || "无"}`);
		console.log(`🎯 优先级: ${this.options.priority || "全部"}`);
		console.log(`🔄 重试次数: ${this.options.retries}`);
		console.log(`⏱️  超时时间: ${this.options.timeout}ms`);

		try {
			await this.validateEnvironment();
			await this.analyzeTestSuite();
			await this.runTests();
			await this.generateReport();

			console.log("✅ 测试运行完成");
		} catch (error) {
			console.error("❌ 测试运行失败:", error.message);
			process.exit(1);
		}
	}

	parseArgs(args) {
		for (let i = 0; i < args.length; i++) {
			const arg = args[i];

			switch (arg) {
				case "--tags":
				case "-t":
					this.options.tags = args[++i].split(",");
					break;
				case "--exclude-tags":
				case "-e":
					this.options.excludeTags = args[++i].split(",");
					break;
				case "--priority":
				case "-p":
					this.options.priority = args[++i];
					break;
				case "--environment":
				case "-env":
					this.options.environment = args[++i];
					break;
				case "--no-parallel":
					this.options.parallel = false;
					break;
				case "--retries":
				case "-r":
					this.options.retries = parseInt(args[++i]);
					break;
				case "--timeout":
					this.options.timeout = parseInt(args[++i]);
					break;
				case "--no-coverage":
					this.options.coverage = false;
					break;
				case "--no-report":
					this.options.report = false;
					break;
				case "--smoke":
					this.options.tags = ["smoke"];
					break;
				case "--critical":
					this.options.tags = ["critical"];
					break;
				case "--fast":
					this.options.tags = ["unit", "smoke"];
					this.options.excludeTags = ["slow", "flaky"];
					break;
				case "--full":
					this.options.tags = [];
					this.options.excludeTags = [];
					break;
				default:
					if (arg.startsWith("--")) {
						console.warn(`⚠️  未知参数: ${arg}`);
					}
					break;
			}
		}
	}

	async validateEnvironment() {
		console.log("🔍 验证测试环境...");

		// 检查Node.js版本
		const nodeVersion = process.version;
		const requiredVersion = "16.0.0";
		if (this.compareVersions(nodeVersion, requiredVersion) < 0) {
			throw new Error(
				`Node.js版本过低，需要${requiredVersion}或更高版本，当前版本${nodeVersion}`,
			);
		}

		// 检查必要的依赖
		const packageJson = JSON.parse(
			fs.readFileSync(path.join(rootDir, "package.json"), "utf8"),
		);
		const requiredDeps = ["vitest", "testcontainers"];

		for (const dep of requiredDeps) {
			if (!packageJson.devDependencies[dep]) {
				throw new Error(`缺少必要的依赖: ${dep}`);
			}
		}

		// 检查测试目录存在
		if (!fs.existsSync(path.join(rootDir, "tests"))) {
			throw new Error("测试目录不存在");
		}

		console.log("✅ 环境验证通过");
	}

	async analyzeTestSuite() {
		console.log("📊 分析测试套件...");

		// 扫描测试文件
		const testFiles = this.findTestFiles();
		console.log(`📁 发现 ${testFiles.length} 个测试文件`);

		// 分析测试标签
		const tagStats = {};
		for (const file of testFiles) {
			const tags = await this.extractTagsFromFile(file);
			tags.forEach((tag) => {
				tagStats[tag] = (tagStats[tag] || 0) + 1;
			});
		}

		console.log("🏷️  测试标签统计:");
		Object.entries(tagStats)
			.sort(([, a], [, b]) => b - a)
			.forEach(([tag, count]) => {
				console.log(`  ${tag}: ${count} 个测试`);
			});

		this.testFiles = testFiles;
		this.tagStats = tagStats;
	}

	findTestFiles() {
		const testFiles = [];

		function scanDir(dir) {
			const items = fs.readdirSync(dir);

			for (const item of items) {
				const fullPath = path.join(dir, item);
				const stat = fs.statSync(fullPath);

				if (
					stat.isDirectory() &&
					!item.startsWith(".") &&
					item !== "node_modules"
				) {
					scanDir(fullPath);
				} else if (
					stat.isFile() &&
					(item.endsWith(".test.js") || item.endsWith(".spec.js"))
				) {
					testFiles.push(fullPath);
				}
			}
		}

		scanDir(path.join(rootDir, "tests"));
		return testFiles;
	}

	async extractTagsFromFile(filePath) {
		try {
			const content = fs.readFileSync(filePath, "utf8");
			const tagMatches = content.match(/tags:\s*\[([^\]]+)\]/g);

			if (!tagMatches) return [];

			const tags = [];
			for (const match of tagMatches) {
				const tagContent = match.match(/\[([^\]]+)\]/)[1];
				const extractedTags = tagContent
					.split(",")
					.map((tag) => tag.trim().replace(/['"]/g, ""))
					.filter((tag) => tag);
				tags.push(...extractedTags);
			}

			return [...new Set(tags)]; // 去重
		} catch (error) {
			console.warn(`⚠️  无法分析文件标签: ${filePath}`);
			return [];
		}
	}

	async runTests() {
		console.log("🧪 开始执行测试...");

		// 构建vitest命令
		const command = this.buildVitestCommand();
		console.log(`🚀 执行命令: ${command}`);

		// 设置环境变量
		const env = {
			...process.env,
			NODE_ENV: this.options.environment,
			VITEST_TIMEOUT: this.options.timeout.toString(),
		};

		// 执行测试
		const startTime = Date.now();
		try {
			execSync(command, {
				cwd: rootDir,
				env,
				stdio: "inherit",
				timeout: this.options.timeout * 2, // 命令超时时间是测试超时的2倍
			});
		} catch (error) {
			// 如果是重试次数未用完，则重试
			if (this.options.retries > 0) {
				console.log(`⚠️  测试失败，剩余重试次数: ${this.options.retries}`);
				this.options.retries--;
				return this.runTests();
			}
			throw error;
		}

		const duration = Date.now() - startTime;
		console.log(`✅ 测试执行完成，耗时: ${(duration / 1000).toFixed(1)}秒`);
	}

	buildVitestCommand() {
		const args = ["vitest", "run"];

		// 添加标签过滤
		if (this.options.tags.length > 0) {
			args.push("--tag", this.options.tags.join(","));
		}

		// 添加排除标签
		if (this.options.excludeTags.length > 0) {
			// vitest没有直接的exclude-tag选项，这里通过grep来过滤
			const excludePattern = this.options.excludeTags
				.map((tag) => `(?=.*${tag})`)
				.join("|");
			args.push("--grep-invert", excludePattern);
		}

		// 添加覆盖率
		if (this.options.coverage) {
			args.push("--coverage");
		}

		// 添加并行执行
		if (this.options.parallel) {
			args.push("--pool=threads");
		}

		// 添加重试
		if (this.options.retries > 0) {
			args.push("--retry", this.options.retries.toString());
		}

		// 添加输出文件
		args.push(
			"--reporter=json",
			"--outputFile=test-results/smart-runner-results.json",
		);

		return args.join(" ");
	}

	async generateReport() {
		if (!this.options.report) return;

		console.log("📊 生成测试报告...");

		try {
			// 调用测试报告生成器
			execSync("npm run test:report", {
				cwd: rootDir,
				stdio: "inherit",
			});

			console.log("✅ 测试报告生成完成");
		} catch (error) {
			console.warn("⚠️  测试报告生成失败:", error.message);
		}
	}

	compareVersions(version1, version2) {
		const v1 = version1.replace("v", "").split(".").map(Number);
		const v2 = version2.split(".").map(Number);

		for (let i = 0; i < Math.max(v1.length, v2.length); i++) {
			const num1 = v1[i] || 0;
			const num2 = v2[i] || 0;

			if (num1 > num2) return 1;
			if (num1 < num2) return -1;
		}

		return 0;
	}
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
	const runner = new SmartTestRunner();
	runner.run();
}

export default SmartTestRunner;
