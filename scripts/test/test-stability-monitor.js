#!/usr/bin/env node

/**
 * 测试稳定性监控器
 * 监控测试的稳定性和可靠性，识别不稳定测试
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

class TestStabilityMonitor {
	constructor() {
		this.runs = 5; // 默认运行5次来评估稳定性
		this.stabilityThreshold = 0.8; // 80%的成功率算稳定
		this.results = [];
		this.flakyTests = new Map();
	}

	async monitor() {
		console.log("🔍 开始测试稳定性监控...");

		try {
			await this.runStabilityTests();
			await this.analyzeResults();
			await this.generateStabilityReport();
			await this.identifyFlakyTests();

			console.log("✅ 测试稳定性监控完成");
		} catch (error) {
			console.error("❌ 测试稳定性监控失败:", error.message);
			process.exit(1);
		}
	}

	async runStabilityTests() {
		console.log(`🏃 运行 ${this.runs} 次测试来评估稳定性...`);

		for (let i = 1; i <= this.runs; i++) {
			console.log(`📊 第 ${i}/${this.runs} 次运行...`);

			try {
				// 运行测试并捕获结果
				const output = execSync("npm run test:ci", {
					cwd: rootDir,
					encoding: "utf8",
					timeout: 300000, // 5分钟超时
				});

				// 解析测试结果
				const result = this.parseTestOutput(output);
				result.runNumber = i;
				result.timestamp = new Date().toISOString();
				result.success = true;

				this.results.push(result);
				console.log(
					`✅ 第 ${i} 次运行成功: ${result.passed}/${result.total} 通过`,
				);
			} catch (error) {
				// 解析失败的测试结果
				const result = this.parseTestOutput(error.stdout || "");
				result.runNumber = i;
				result.timestamp = new Date().toISOString();
				result.success = false;
				result.error = error.message;

				this.results.push(result);
				console.log(`❌ 第 ${i} 次运行失败: ${result.failed || 0} 失败`);
			}

			// 在运行之间稍作等待，避免资源竞争
			await this.sleep(2000);
		}
	}

	parseTestOutput(output) {
		const result = {
			total: 0,
			passed: 0,
			failed: 0,
			skipped: 0,
			duration: 0,
			testResults: [],
		};

		try {
			// 尝试从vitest JSON输出中解析
			const jsonMatch = output.match(/{[\s\S]*}/);
			if (jsonMatch) {
				const jsonData = JSON.parse(jsonMatch[0]);
				if (jsonData.numTotalTests !== undefined) {
					result.total = jsonData.numTotalTests;
					result.passed = jsonData.numPassedTests || 0;
					result.failed = jsonData.numFailedTests || 0;
					result.duration = jsonData.duration || 0;
				}
			}

			// 如果没有JSON输出，从文本中解析
			if (result.total === 0) {
				const passedMatch = output.match(/(\d+)\s+passed/);
				const failedMatch = output.match(/(\d+)\s+failed/);
				const totalMatch = output.match(/(\d+)\s+total/);

				if (passedMatch) result.passed = parseInt(passedMatch[1]);
				if (failedMatch) result.failed = parseInt(failedMatch[1]);
				if (totalMatch) result.total = parseInt(totalMatch[1]);
				else result.total = result.passed + result.failed;

				// 解析测试时长
				const durationMatch = output.match(/(\d+\.?\d*)\s*(s|ms)/);
				if (durationMatch) {
					const time = parseFloat(durationMatch[1]);
					result.duration = durationMatch[2] === "s" ? time * 1000 : time;
				}
			}
		} catch (error) {
			console.warn("解析测试输出失败:", error.message);
		}

		return result;
	}

	async analyzeResults() {
		console.log("📊 分析稳定性结果...");

		const analysis = {
			totalRuns: this.results.length,
			successfulRuns: this.results.filter((r) => r.success).length,
			failedRuns: this.results.filter((r) => !r.success).length,
			successRate: 0,
			averageDuration: 0,
			durationVariance: 0,
			stability: "unknown",
		};

		if (analysis.totalRuns > 0) {
			analysis.successRate = analysis.successfulRuns / analysis.totalRuns;

			// 计算平均时长
			const durations = this.results
				.map((r) => r.duration)
				.filter((d) => d > 0);
			if (durations.length > 0) {
				analysis.averageDuration =
					durations.reduce((a, b) => a + b, 0) / durations.length;

				// 计算时长方差
				const variance =
					durations.reduce((acc, d) => {
						return acc + (d - analysis.averageDuration) ** 2;
					}, 0) / durations.length;
				analysis.durationVariance = Math.sqrt(variance);
			}

			// 评估稳定性
			if (analysis.successRate >= 0.95) {
				analysis.stability = "excellent";
			} else if (analysis.successRate >= 0.85) {
				analysis.stability = "good";
			} else if (analysis.successRate >= 0.7) {
				analysis.stability = "fair";
			} else {
				analysis.stability = "poor";
			}
		}

		this.analysis = analysis;

		console.log(`📈 成功率: ${(analysis.successRate * 100).toFixed(1)}%`);
		console.log(
			`⏱️  平均时长: ${(analysis.averageDuration / 1000).toFixed(1)}秒`,
		);
		console.log(`📊 稳定性: ${analysis.stability}`);
	}

	async identifyFlakyTests() {
		console.log("🔍 识别不稳定测试...");

		// 这里可以实现更复杂的逻辑来识别具体的 flaky 测试
		// 目前基于整体稳定性来判断

		const flakyIndicators = [];

		if (this.analysis.successRate < this.stabilityThreshold) {
			flakyIndicators.push("整体成功率低于阈值");
		}

		if (this.analysis.durationVariance > this.analysis.averageDuration * 0.5) {
			flakyIndicators.push("测试时长波动较大");
		}

		if (this.analysis.failedRuns > 0) {
			flakyIndicators.push(`有 ${this.analysis.failedRuns} 次运行失败`);
		}

		// 分析各次运行的差异
		const runDifferences = [];
		for (let i = 1; i < this.results.length; i++) {
			const prev = this.results[i - 1];
			const curr = this.results[i];

			if (prev.failed !== curr.failed) {
				runDifferences.push(`第 ${i + 1} 次运行的结果与前次不同`);
			}
		}

		this.flakyAnalysis = {
			isFlaky: flakyIndicators.length > 0,
			indicators: flakyIndicators,
			runDifferences: runDifferences,
			recommendations: this.generateStabilityRecommendations(),
		};

		if (this.flakyAnalysis.isFlaky) {
			console.log("⚠️  检测到不稳定因素:");
			flakyIndicators.forEach((indicator) => console.log(`  - ${indicator}`));
		} else {
			console.log("✅ 测试稳定性良好");
		}
	}

	generateStabilityRecommendations() {
		const recommendations = [];

		if (this.analysis.successRate < 0.8) {
			recommendations.push("增加测试重试次数");
			recommendations.push("检查异步操作的等待时间");
			recommendations.push("验证测试数据的一致性");
		}

		if (this.analysis.durationVariance > this.analysis.averageDuration * 0.3) {
			recommendations.push("优化测试并行执行");
			recommendations.push("减少外部依赖");
			recommendations.push("使用更快的测试数据");
		}

		if (this.results.some((r) => !r.success)) {
			recommendations.push("添加更好的错误处理");
			recommendations.push("改进测试隔离");
			recommendations.push("检查资源竞争问题");
		}

		return recommendations;
	}

	async generateStabilityReport() {
		const report = {
			timestamp: new Date().toISOString(),
			configuration: {
				runs: this.runs,
				stabilityThreshold: this.stabilityThreshold,
			},
			results: this.results,
			analysis: this.analysis,
			flakyAnalysis: this.flakyAnalysis,
		};

		const reportPath = path.join(
			rootDir,
			"test-results",
			"stability-report.json",
		);
		fs.mkdirSync(path.dirname(reportPath), { recursive: true });
		fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

		// 生成人类可读的报告
		const summaryPath = path.join(
			rootDir,
			"test-results",
			"stability-summary.txt",
		);
		const summary = this.generateStabilitySummary();
		fs.writeFileSync(summaryPath, summary);

		console.log("📋 稳定性报告已生成");
	}

	generateStabilitySummary() {
		const analysis = this.analysis;
		const flaky = this.flakyAnalysis;

		return `
测试稳定性报告
================

生成时间: ${new Date().toLocaleString("zh-CN")}
运行次数: ${analysis.totalRuns}
成功次数: ${analysis.successfulRuns}
失败次数: ${analysis.failedRuns}
成功率: ${(analysis.successRate * 100).toFixed(1)}%
平均时长: ${(analysis.averageDuration / 1000).toFixed(1)}秒
稳定性评估: ${analysis.stability}

${flaky.isFlaky ? "⚠️  不稳定因素:" : "✅ 稳定性良好"}

${flaky.indicators.map((indicator) => `• ${indicator}`).join("\n")}

建议改进:
${flaky.recommendations.map((rec) => `• ${rec}`).join("\n")}

运行详情:
${this.results
	.map(
		(result, index) =>
			`${index + 1}. ${result.success ? "✅" : "❌"} ${result.passed}/${result.total} 通过 (${(result.duration / 1000).toFixed(1)}s)`,
	)
	.join("\n")}
`;
	}

	sleep(ms) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
	const monitor = new TestStabilityMonitor();

	// 解析命令行参数
	const args = process.argv.slice(2);
	if (args.includes("--runs")) {
		const runsIndex = args.indexOf("--runs");
		monitor.runs = parseInt(args[runsIndex + 1]) || 5;
	}

	monitor.monitor();
}

export default TestStabilityMonitor;
