#!/usr/bin/env node

/**
 * 覆盖率趋势分析器
 * 分析测试覆盖率的趋势变化，生成趋势图表和改进建议
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

class CoverageTrendAnalyzer {
	constructor() {
		this.currentCoverage = null;
		this.previousCoverage = null;
		this.trends = [];
		this.thresholds = {
			lines: 85,
			functions: 85,
			branches: 85,
			statements: 85,
		};
	}

	async analyze() {
		console.log("📊 分析覆盖率趋势...");

		try {
			await this.loadCoverageData();
			await this.calculateTrends();
			await this.generateTrendReport();
			await this.generateImprovementSuggestions();

			console.log("✅ 覆盖率趋势分析完成");
		} catch (error) {
			console.error("❌ 覆盖率趋势分析失败:", error.message);
			process.exit(1);
		}
	}

	async loadCoverageData() {
		// 加载当前覆盖率数据
		const currentPath = path.join(rootDir, "coverage", "coverage-summary.json");
		if (fs.existsSync(currentPath)) {
			this.currentCoverage = JSON.parse(fs.readFileSync(currentPath, "utf8"));
		} else {
			throw new Error("当前覆盖率数据不存在，请先运行测试");
		}

		// 加载历史趋势数据
		const trendsPath = path.join(
			rootDir,
			"test-results",
			"coverage-trends.json",
		);
		if (fs.existsSync(trendsPath)) {
			this.trends = JSON.parse(fs.readFileSync(trendsPath, "utf8"));
		}

		// 获取上一次的覆盖率数据作为对比
		if (this.trends.length > 0) {
			this.previousCoverage = this.trends[this.trends.length - 1];
		}
	}

	async calculateTrends() {
		const current = this.currentCoverage.total;
		const previous = this.previousCoverage?.coverage || {};

		const trends = {
			timestamp: new Date().toISOString(),
			coverage: current,
			changes: {
				lines: current.lines.pct - (previous.lines?.pct || 0),
				functions: current.functions.pct - (previous.functions?.pct || 0),
				branches: current.branches.pct - (previous.branches?.pct || 0),
				statements: current.statements.pct - (previous.statements?.pct || 0),
			},
			status: {
				lines: this.getStatus(current.lines.pct, previous.lines?.pct),
				functions: this.getStatus(
					current.functions.pct,
					previous.functions?.pct,
				),
				branches: this.getStatus(current.branches.pct, previous.branches?.pct),
				statements: this.getStatus(
					current.statements.pct,
					previous.statements?.pct,
				),
			},
		};

		// 更新趋势数据
		this.trends.push(trends);

		// 只保留最近30天的趋势数据
		const thirtyDaysAgo = new Date();
		thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
		this.trends = this.trends.filter(
			(item) => new Date(item.timestamp) > thirtyDaysAgo,
		);

		// 保存趋势数据
		const trendsPath = path.join(
			rootDir,
			"test-results",
			"coverage-trends.json",
		);
		fs.mkdirSync(path.dirname(trendsPath), { recursive: true });
		fs.writeFileSync(trendsPath, JSON.stringify(this.trends, null, 2));
	}

	getStatus(current, previous) {
		if (!previous) return "new";

		const diff = current - previous;
		if (diff > 1) return "improved";
		if (diff < -1) return "declined";
		return "stable";
	}

	async generateTrendReport() {
		const report = {
			timestamp: new Date().toISOString(),
			summary: {
				current: this.currentCoverage.total,
				previous: this.previousCoverage?.coverage || {},
				trend: this.trends[this.trends.length - 1],
			},
			analysis: this.analyzeCoverageGaps(),
			recommendations: await this.generateRecommendations(),
		};

		const reportPath = path.join(
			rootDir,
			"test-results",
			"coverage-trend-report.json",
		);
		fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

		console.log("📈 覆盖率趋势报告已生成");
	}

	analyzeCoverageGaps() {
		const current = this.currentCoverage;
		const gaps = {
			belowThreshold: [],
			declining: [],
			uncovered: [],
		};

		// 分析各文件的覆盖率
		Object.entries(current).forEach(([file, data]) => {
			if (file === "total") return;

			// 检查是否低于阈值
			if (
				data.lines.pct < this.thresholds.lines ||
				data.functions.pct < this.thresholds.functions ||
				data.branches.pct < this.thresholds.branches
			) {
				gaps.belowThreshold.push({
					file,
					coverage: data,
					issues: this.getCoverageIssues(data),
				});
			}

			// 检查是否正在下降
			if (this.previousCoverage) {
				const prevData = this.previousCoverage[file];
				if (prevData) {
					const declined =
						data.lines.pct < prevData.lines.pct - 2 ||
						data.functions.pct < prevData.functions.pct - 2 ||
						data.branches.pct < prevData.branches.pct - 2;

					if (declined) {
						gaps.declining.push({
							file,
							current: data,
							previous: prevData,
							changes: {
								lines: data.lines.pct - prevData.lines.pct,
								functions: data.functions.pct - prevData.functions.pct,
								branches: data.branches.pct - prevData.branches.pct,
							},
						});
					}
				}
			}
		});

		return gaps;
	}

	getCoverageIssues(data) {
		const issues = [];

		if (data.lines.pct < this.thresholds.lines) {
			issues.push(
				`行覆盖率 ${data.lines.pct}% 低于阈值 ${this.thresholds.lines}%`,
			);
		}
		if (data.functions.pct < this.thresholds.functions) {
			issues.push(
				`函数覆盖率 ${data.functions.pct}% 低于阈值 ${this.thresholds.functions}%`,
			);
		}
		if (data.branches.pct < this.thresholds.branches) {
			issues.push(
				`分支覆盖率 ${data.branches.pct}% 低于阈值 ${this.thresholds.branches}%`,
			);
		}

		return issues;
	}

	async generateRecommendations() {
		const recommendations = [];
		const gaps = this.analyzeCoverageGaps();

		// 基于覆盖率差距生成建议
		if (gaps.belowThreshold.length > 0) {
			recommendations.push({
				priority: "high",
				category: "coverage-gaps",
				title: "提升低覆盖率文件",
				description: `${gaps.belowThreshold.length} 个文件覆盖率低于阈值`,
				actions: gaps.belowThreshold
					.slice(0, 5)
					.map(
						(gap) =>
							`为 ${gap.file} 添加更多测试用例，重点覆盖: ${gap.issues.join(", ")}`,
					),
			});
		}

		if (gaps.declining.length > 0) {
			recommendations.push({
				priority: "medium",
				category: "regression",
				title: "修复覆盖率下降",
				description: `${gaps.declining.length} 个文件的覆盖率出现下降`,
				actions: gaps.declining.map(
					(gap) =>
						`检查 ${gap.file} 的测试是否完整，覆盖率下降: 行${gap.changes.lines.toFixed(1)}%, 函数${gap.changes.functions.toFixed(1)}%, 分支${gap.changes.branches.toFixed(1)}%`,
				),
			});
		}

		// 基于整体趋势的建议
		const currentTotal = this.currentCoverage.total;
		if (currentTotal.lines.pct >= 90) {
			recommendations.push({
				priority: "low",
				category: "excellence",
				title: "维持高覆盖率",
				description: "当前覆盖率表现优秀",
				actions: [
					"继续保持测试质量",
					"关注新代码的测试覆盖",
					"定期审查测试的有效性",
				],
			});
		} else if (currentTotal.lines.pct >= 80) {
			recommendations.push({
				priority: "medium",
				category: "improvement",
				title: "进一步提升覆盖率",
				description: "覆盖率良好，可以进一步提升",
				actions: [
					"为错误处理路径添加测试",
					"增加边界条件测试",
					"完善集成测试覆盖",
				],
			});
		} else {
			recommendations.push({
				priority: "high",
				category: "critical",
				title: "紧急提升覆盖率",
				description: "覆盖率严重不足，需要立即改进",
				actions: [
					"优先为核心业务逻辑添加测试",
					"建立测试覆盖率基线",
					"制定覆盖率提升计划",
				],
			});
		}

		return recommendations;
	}

	async generateImprovementSuggestions() {
		const suggestions = {
			timestamp: new Date().toISOString(),
			quickWins: [],
			mediumTerm: [],
			longTerm: [],
			automation: [],
		};

		const gaps = this.analyzeCoverageGaps();

		// 快速见效的改进
		if (gaps.belowThreshold.length > 0) {
			suggestions.quickWins.push(
				"为简单的getter/setter方法添加基本测试",
				"为主要的用户流程添加冒烟测试",
				"为API端点添加健康检查测试",
			);
		}

		// 中期改进
		suggestions.mediumTerm.push(
			"重构复杂函数，拆分为更小的可测试单元",
			"为异步操作添加适当的等待和超时处理",
			"建立测试数据工厂，避免测试间的耦合",
		);

		// 长期改进
		suggestions.longTerm.push(
			"实施测试驱动开发(TDD)实践",
			"建立自动化测试生成工具",
			"实施持续测试改进流程",
		);

		// 自动化建议
		suggestions.automation.push(
			"设置覆盖率阈值强制检查",
			"自动化测试报告生成",
			"定期覆盖率趋势监控",
		);

		const suggestionsPath = path.join(
			rootDir,
			"test-results",
			"coverage-improvement-suggestions.json",
		);
		fs.writeFileSync(suggestionsPath, JSON.stringify(suggestions, null, 2));

		console.log("💡 覆盖率改进建议已生成");
	}
}

// 执行分析
const analyzer = new CoverageTrendAnalyzer();
await analyzer.analyze();
