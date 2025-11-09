#!/usr/bin/env node

/**
 * 测试报告生成器
 * 生成详细的测试报告，包含覆盖率分析、趋势图表等
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

class TestReportGenerator {
	constructor() {
		this.reports = {
			coverage: null,
			testResults: null,
			performance: null,
			trends: null,
		};
	}

	async generate() {
		console.log("📊 生成测试报告...");

		try {
			await this.loadReports();
			await this.generateSummaryReport();
			await this.generateCoverageReport();
			await this.generateTrendReport();
			await this.generateHTMLReport();

			console.log("✅ 测试报告生成完成");
		} catch (error) {
			console.error("❌ 生成测试报告失败:", error.message);
			process.exit(1);
		}
	}

	async loadReports() {
		const coveragePath = path.join(
			rootDir,
			"coverage",
			"coverage-summary.json",
		);
		const testResultsPath = path.join(
			rootDir,
			"test-results",
			"test-results.json",
		);
		const performancePath = path.join(
			rootDir,
			"test-results",
			"performance-results.json",
		);

		if (fs.existsSync(coveragePath)) {
			this.reports.coverage = JSON.parse(fs.readFileSync(coveragePath, "utf8"));
		}

		if (fs.existsSync(testResultsPath)) {
			this.reports.testResults = JSON.parse(
				fs.readFileSync(testResultsPath, "utf8"),
			);
		}

		if (fs.existsSync(performancePath)) {
			this.reports.performance = JSON.parse(
				fs.readFileSync(performancePath, "utf8"),
			);
		}

		// 加载历史趋势数据
		const trendsPath = path.join(rootDir, "test-results", "trends.json");
		if (fs.existsSync(trendsPath)) {
			this.reports.trends = JSON.parse(fs.readFileSync(trendsPath, "utf8"));
		} else {
			this.reports.trends = [];
		}
	}

	async generateSummaryReport() {
		const timestamp = new Date().toISOString();
		const summary = {
			timestamp,
			coverage: this.reports.coverage?.total || {},
			tests: this.reports.testResults?.numTotalTests || 0,
			passed: this.reports.testResults?.numPassedTests || 0,
			failed: this.reports.testResults?.numFailedTests || 0,
			duration: this.reports.testResults?.duration || 0,
			performance: this.reports.performance || {},
		};

		const summaryPath = path.join(rootDir, "test-results", "summary.json");
		fs.mkdirSync(path.dirname(summaryPath), { recursive: true });
		fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

		console.log("📋 摘要报告已生成");
	}

	async generateCoverageReport() {
		if (!this.reports.coverage) {
			console.log("⚠️  未找到覆盖率数据");
			return;
		}

		const coverage = this.reports.coverage;
		const report = {
			timestamp: new Date().toISOString(),
			total: coverage.total,
			files: Object.entries(coverage)
				.filter(([key]) => key !== "total")
				.map(([file, data]) => ({
					file,
					...data,
				})),
		};

		// 计算覆盖率趋势
		if (this.reports.trends.length > 0) {
			const lastTrend = this.reports.trends[this.reports.trends.length - 1];
			report.trend = {
				lines: report.total.lines.pct - (lastTrend.coverage?.lines?.pct || 0),
				functions:
					report.total.functions.pct -
					(lastTrend.coverage?.functions?.pct || 0),
				branches:
					report.total.branches.pct - (lastTrend.coverage?.branches?.pct || 0),
				statements:
					report.total.statements.pct -
					(lastTrend.coverage?.statements?.pct || 0),
			};
		}

		const coverageReportPath = path.join(
			rootDir,
			"test-results",
			"coverage-report.json",
		);
		fs.writeFileSync(coverageReportPath, JSON.stringify(report, null, 2));

		console.log("📈 覆盖率报告已生成");
	}

	async generateTrendReport() {
		const currentSummary = {
			timestamp: new Date().toISOString(),
			coverage: this.reports.coverage?.total || {},
			tests: this.reports.testResults?.numTotalTests || 0,
			passed: this.reports.testResults?.numPassedTests || 0,
			failed: this.reports.testResults?.numFailedTests || 0,
			duration: this.reports.testResults?.duration || 0,
		};

		this.reports.trends.push(currentSummary);

		// 只保留最近30天的趋势数据
		const thirtyDaysAgo = new Date();
		thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
		this.reports.trends = this.reports.trends.filter(
			(item) => new Date(item.timestamp) > thirtyDaysAgo,
		);

		const trendsPath = path.join(rootDir, "test-results", "trends.json");
		fs.writeFileSync(trendsPath, JSON.stringify(this.reports.trends, null, 2));

		console.log("📊 趋势报告已更新");
	}

	async generateHTMLReport() {
		const html = this.generateHTMLContent();
		const htmlPath = path.join(rootDir, "test-results", "test-report.html");
		fs.writeFileSync(htmlPath, html);

		console.log("🌐 HTML报告已生成");
	}

	generateHTMLContent() {
		const coverage = this.reports.coverage?.total || {};
		const testResults = this.reports.testResults || {};

		return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>frys 测试报告</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
        .header h1 { margin: 0; font-size: 2.5em; }
        .header p { margin: 10px 0 0 0; opacity: 0.9; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; padding: 30px; }
        .stat-card { background: #f8f9fa; border-radius: 8px; padding: 20px; text-align: center; border-left: 4px solid #667eea; }
        .stat-card h3 { margin: 0 0 10px 0; color: #333; font-size: 0.9em; text-transform: uppercase; letter-spacing: 1px; }
        .stat-card .value { font-size: 2.5em; font-weight: bold; color: #667eea; margin: 0; }
        .stat-card .unit { font-size: 0.8em; color: #666; margin-left: 5px; }
        .coverage-section { padding: 30px; border-top: 1px solid #eee; }
        .coverage-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-top: 20px; }
        .coverage-item { text-align: center; padding: 20px; background: #f8f9fa; border-radius: 8px; }
        .coverage-item .metric { font-size: 2em; font-weight: bold; }
        .coverage-item .label { color: #666; font-size: 0.9em; margin-top: 5px; }
        .progress-bar { width: 100%; height: 8px; background: #e9ecef; border-radius: 4px; margin-top: 10px; overflow: hidden; }
        .progress-fill { height: 100%; border-radius: 4px; transition: width 0.3s ease; }
        .footer { text-align: center; padding: 20px; color: #666; border-top: 1px solid #eee; }
        .status-passed { border-left-color: #28a745; }
        .status-failed { border-left-color: #dc3545; }
        .status-warning { border-left-color: #ffc107; }
        .lines-fill { background: #28a745; }
        .functions-fill { background: #007bff; }
        .branches-fill { background: #ffc107; }
        .statements-fill { background: #6f42c1; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧪 frys 测试报告</h1>
            <p>生成时间: ${new Date().toLocaleString("zh-CN")}</p>
        </div>

        <div class="stats">
            <div class="stat-card ${testResults.numFailedTests > 0 ? "status-failed" : "status-passed"}">
                <h3>测试总数</h3>
                <div class="value">${testResults.numTotalTests || 0}<span class="unit">个</span></div>
            </div>
            <div class="stat-card status-passed">
                <h3>通过测试</h3>
                <div class="value">${testResults.numPassedTests || 0}<span class="unit">个</span></div>
            </div>
            <div class="stat-card ${testResults.numFailedTests > 0 ? "status-failed" : "status-passed"}">
                <h3>失败测试</h3>
                <div class="value">${testResults.numFailedTests || 0}<span class="unit">个</span></div>
            </div>
            <div class="stat-card status-warning">
                <h3>测试时长</h3>
                <div class="value">${((testResults.duration || 0) / 1000).toFixed(1)}<span class="unit">秒</span></div>
            </div>
        </div>

        <div class="coverage-section">
            <h2>📊 代码覆盖率</h2>
            <div class="coverage-grid">
                <div class="coverage-item">
                    <div class="metric" style="color: #28a745">${coverage.lines?.pct || 0}%</div>
                    <div class="label">行覆盖率</div>
                    <div class="progress-bar">
                        <div class="progress-fill lines-fill" style="width: ${coverage.lines?.pct || 0}%"></div>
                    </div>
                </div>
                <div class="coverage-item">
                    <div class="metric" style="color: #007bff">${coverage.functions?.pct || 0}%</div>
                    <div class="label">函数覆盖率</div>
                    <div class="progress-bar">
                        <div class="progress-fill functions-fill" style="width: ${coverage.functions?.pct || 0}%"></div>
                    </div>
                </div>
                <div class="coverage-item">
                    <div class="metric" style="color: #ffc107">${coverage.branches?.pct || 0}%</div>
                    <div class="label">分支覆盖率</div>
                    <div class="progress-bar">
                        <div class="progress-fill branches-fill" style="width: ${coverage.branches?.pct || 0}%"></div>
                    </div>
                </div>
                <div class="coverage-item">
                    <div class="metric" style="color: #6f42c1">${coverage.statements?.pct || 0}%</div>
                    <div class="label">语句覆盖率</div>
                    <div class="progress-bar">
                        <div class="progress-fill statements-fill" style="width: ${coverage.statements?.pct || 0}%"></div>
                    </div>
                </div>
            </div>
        </div>

        <div class="footer">
            <p>🚀 frys - 企业级工作流管理系统 | <a href="https://github.com/your-org/frys">GitHub</a></p>
        </div>
    </div>
</body>
</html>`;
	}
}

// 执行生成
const generator = new TestReportGenerator();
await generator.generate();
