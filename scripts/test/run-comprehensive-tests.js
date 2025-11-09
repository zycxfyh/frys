#!/usr/bin/env node

/**
 * 综合测试运行器
 * 同时运行所有测试工具的完整测试套件
 */

import { execSync, spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ComprehensiveTestRunner {
	constructor(options = {}) {
		this.targetUrl = options.targetUrl || "http://localhost:3000";
		this.reportsDir = path.join(__dirname, "../reports");
		this.logsDir = path.join(__dirname, "../logs");
		this.screenshotsDir = path.join(__dirname, "../screenshots");

		// 确保目录存在
		[this.reportsDir, this.logsDir, this.screenshotsDir].forEach((dir) => {
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir, { recursive: true });
			}
		});

		this.results = {
			timestamp: new Date().toISOString(),
			phases: [],
			summary: {
				totalPhases: 0,
				completedPhases: 0,
				failedPhases: 0,
				duration: 0,
			},
		};
	}

	log(message, level = "info") {
		const timestamp = new Date().toISOString();
		const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
		console.log(logMessage);

		// 写入主日志文件
		const logFile = path.join(this.logsDir, "comprehensive-test.log");
		fs.appendFileSync(logFile, logMessage + "\n");
	}

	async runPhase(phaseName, phaseFunction) {
		const phaseStart = Date.now();
		const phase = {
			name: phaseName,
			status: "running",
			duration: 0,
			error: null,
			output: null,
		};

		this.results.phases.push(phase);
		this.results.summary.totalPhases++;

		this.log(`🚀 开始阶段: ${phaseName}`);

		try {
			const result = await phaseFunction();
			phase.status = "completed";
			phase.output = result;
			this.results.summary.completedPhases++;
			this.log(`✅ 阶段完成: ${phaseName}`);
		} catch (error) {
			phase.status = "failed";
			phase.error = error.message;
			this.results.summary.failedPhases++;
			this.log(`❌ 阶段失败: ${phaseName} - ${error.message}`, "error");

			// 决定是否继续执行
			if (phaseName.includes("准备") || phaseName.includes("构建")) {
				throw error; // 关键阶段失败时停止整个测试
			}
		}

		phase.duration = Date.now() - phaseStart;
		this.log(`⏱️  阶段耗时: ${phaseName} (${phase.duration}ms)`);

		return phase;
	}

	// 阶段1: 环境准备
	async phaseEnvironmentSetup() {
		return this.runPhase("环境准备", async () => {
			// 检查Node.js版本
			const nodeVersion = process.version;
			this.log(`Node.js版本: ${nodeVersion}`);

			// 检查依赖
			this.log("检查项目依赖...");
			execSync("npm list --depth=0", { stdio: "pipe" });

			// 检查环境变量
			const requiredEnvVars = ["OPENAI_API_KEY"];
			const missingVars = requiredEnvVars.filter(
				(varName) => !process.env[varName],
			);

			if (missingVars.length > 0) {
				this.log(`⚠️  缺少环境变量: ${missingVars.join(", ")}`, "warn");
				this.log("某些AI功能测试将被跳过", "warn");
			}

			return { nodeVersion, missingEnvVars: missingVars };
		});
	}

	// 阶段2: 代码质量检查
	async phaseCodeQuality() {
		return this.runPhase("代码质量检查", async () => {
			// 运行ESLint
			this.log("运行ESLint代码检查...");
			try {
				execSync("npm run lint", { stdio: "pipe" });
				this.log("✅ ESLint检查通过");
			} catch (error) {
				this.log("⚠️  ESLint发现问题，但继续执行", "warn");
			}

			// 运行单元测试
			this.log("运行单元测试...");
			const testResult = execSync("npm run test:unit", {
				encoding: "utf8",
				stdio: "pipe",
			});

			// 解析测试结果
			const testSummary = this.parseTestResults(testResult);

			if (testSummary.failed > 0) {
				throw new Error(
					`单元测试失败: ${testSummary.failed}/${testSummary.total} 个测试失败`,
				);
			}

			return testSummary;
		});
	}

	// 阶段3: 构建和部署
	async phaseBuildAndDeploy() {
		return this.runPhase("构建和部署", async () => {
			// 构建项目
			this.log("构建项目...");
			execSync("npm run build", { stdio: "pipe" });

			// 启动服务器进行测试
			this.log("启动测试服务器...");
			const serverProcess = spawn("node", ["src/index.js"], {
				cwd: path.join(__dirname, ".."),
				detached: true,
				stdio: ["pipe", "pipe", path.join(this.logsDir, "server.log")],
			});

			// 等待服务器启动
			await this.waitForServer(this.targetUrl, 30000);

			this.serverProcess = serverProcess;

			// 验证服务器健康
			const healthResponse = await fetch(`${this.targetUrl}/health`);
			if (!healthResponse.ok) {
				throw new Error("服务器健康检查失败");
			}

			return { serverPid: serverProcess.pid };
		});
	}

	// 阶段4: 工业级测试
	async phaseIndustrialTests() {
		return this.runPhase("工业级测试", async () => {
			this.log("运行工业级测试套件...");

			const testProcess = spawn("node", ["scripts/run-industrial-tests.js"], {
				cwd: path.join(__dirname, ".."),
				stdio: ["pipe", "pipe", "pipe"],
			});

			return new Promise((resolve, reject) => {
				let output = "";
				let errorOutput = "";

				testProcess.stdout.on("data", (data) => {
					output += data.toString();
				});

				testProcess.stderr.on("data", (data) => {
					errorOutput += data.toString();
				});

				testProcess.on("close", (code) => {
					if (code === 0) {
						resolve({ exitCode: code, output });
					} else {
						reject(
							new Error(`工业级测试失败 (退出码: ${code}): ${errorOutput}`),
						);
					}
				});

				// 设置超时
				setTimeout(
					() => {
						testProcess.kill();
						reject(new Error("工业级测试超时"));
					},
					10 * 60 * 1000,
				); // 10分钟超时
			});
		});
	}

	// 阶段5: 性能测试
	async phasePerformanceTest() {
		return this.runPhase("性能测试", async () => {
			// 启动性能监控
			this.log("启动性能监控...");
			const monitorProcess = spawn(
				"node",
				[
					"scripts/performance-monitor.js",
					"--duration",
					"30000",
					"--server",
					this.targetUrl.replace("http://", "").split(":")[1] || "3000",
				],
				{
					cwd: path.join(__dirname, ".."),
					stdio: ["pipe", "pipe", "pipe"],
				},
			);

			// 等待性能监控启动
			await new Promise((resolve) => setTimeout(resolve, 2000));

			// 运行负载测试
			this.log("运行负载测试...");
			const loadTestProcess = spawn(
				"node",
				[
					"scripts/load-generator.js",
					this.targetUrl,
					"--duration",
					"20000",
					"--concurrency",
					"20",
				],
				{
					cwd: path.join(__dirname, ".."),
					stdio: ["pipe", "pipe", "pipe"],
				},
			);

			// 等待负载测试完成
			await new Promise((resolve, reject) => {
				loadTestProcess.on("close", (code) => {
					if (code === 0) {
						resolve();
					} else {
						reject(new Error(`负载测试失败 (退出码: ${code})`));
					}
				});

				setTimeout(() => {
					loadTestProcess.kill();
					reject(new Error("负载测试超时"));
				}, 60000);
			});

			// 停止性能监控
			monitorProcess.kill();

			// 检查性能报告
			const perfReportPath = path.join(
				this.reportsDir,
				"performance-report.json",
			);
			if (fs.existsSync(perfReportPath)) {
				const perfReport = JSON.parse(fs.readFileSync(perfReportPath, "utf8"));
				return perfReport;
			}

			return { message: "性能测试完成，但未找到详细报告" };
		});
	}

	// 阶段6: 端到端测试
	async phaseE2ETests() {
		return this.runPhase("端到端测试", async () => {
			this.log("运行端到端测试...");

			const e2eProcess = spawn(
				"node",
				[
					"scripts/e2e-test-framework.js",
					"--base-url",
					this.targetUrl,
					"--timeout",
					"15000",
				],
				{
					cwd: path.join(__dirname, ".."),
					stdio: ["pipe", "pipe", "pipe"],
				},
			);

			return new Promise((resolve, reject) => {
				let output = "";
				let errorOutput = "";

				e2eProcess.stdout.on("data", (data) => {
					output += data.toString();
				});

				e2eProcess.stderr.on("data", (data) => {
					errorOutput += data.toString();
				});

				e2eProcess.on("close", (code) => {
					if (code === 0) {
						resolve({ exitCode: code, output });
					} else {
						reject(new Error(`E2E测试失败 (退出码: ${code}): ${errorOutput}`));
					}
				});

				// 设置超时
				setTimeout(
					() => {
						e2eProcess.kill();
						reject(new Error("E2E测试超时"));
					},
					5 * 60 * 1000,
				); // 5分钟超时
			});
		});
	}

	// 阶段7: 压力测试
	async phaseStressTest() {
		return this.runPhase("压力测试", async () => {
			this.log("运行压力测试...");

			const stressProcess = spawn(
				"node",
				["scripts/load-generator.js", this.targetUrl, "--stress"],
				{
					cwd: path.join(__dirname, ".."),
					stdio: ["pipe", "pipe", "pipe"],
				},
			);

			return new Promise((resolve, reject) => {
				stressProcess.on("close", (code) => {
					if (code === 0) {
						resolve({ exitCode: code });
					} else {
						reject(new Error(`压力测试失败 (退出码: ${code})`));
					}
				});

				setTimeout(
					() => {
						stressProcess.kill();
						reject(new Error("压力测试超时"));
					},
					10 * 60 * 1000,
				); // 10分钟超时
			});
		});
	}

	// 阶段8: 清理和报告
	async phaseCleanupAndReport() {
		return this.runPhase("清理和报告生成", async () => {
			// 停止服务器
			if (this.serverProcess) {
				this.log("停止测试服务器...");
				process.kill(-this.serverProcess.pid);
				this.serverProcess = null;
			}

			// 生成综合报告
			this.generateComprehensiveReport();

			return { cleanupCompleted: true };
		});
	}

	async waitForServer(url, timeout = 30000) {
		const startTime = Date.now();

		while (Date.now() - startTime < timeout) {
			try {
				const response = await fetch(`${url}/health`);
				if (response.ok) {
					return;
				}
			} catch (error) {
				// 服务器还没准备好，继续等待
			}

			await new Promise((resolve) => setTimeout(resolve, 1000));
		}

		throw new Error(`服务器启动超时: ${timeout}ms`);
	}

	parseTestResults(output) {
		// 简单的测试结果解析
		const lines = output.split("\n");
		let total = 0,
			passed = 0,
			failed = 0;

		lines.forEach((line) => {
			if (line.includes("Tests  ")) {
				const match = line.match(
					/Tests\s+(\d+)\s+failed\s*\|\s*(\d+)\s+passed/,
				);
				if (match) {
					failed = parseInt(match[1]);
					passed = parseInt(match[2]);
					total = failed + passed;
				}
			}
		});

		return { total, passed, failed };
	}

	generateComprehensiveReport() {
		const endTime = Date.now();
		this.results.summary.duration =
			endTime - new Date(this.results.timestamp).getTime();

		const reportPath = path.join(
			this.reportsDir,
			"comprehensive-test-report.json",
		);
		const htmlReportPath = path.join(
			this.reportsDir,
			"comprehensive-test-report.html",
		);

		// 生成JSON报告
		fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));

		// 生成HTML报告
		const htmlReport = this.generateHTMLReport();
		fs.writeFileSync(htmlReportPath, htmlReport);

		this.log(`📄 综合测试报告: ${reportPath}`);
		this.log(`🌐 HTML报告: ${htmlReportPath}`);
	}

	generateHTMLReport() {
		const { summary, phases } = this.results;

		return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>frys 综合测试报告</title>
    <style>
        body { font-family: 'Segoe UI', sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); padding: 30px; }
        .header { text-align: center; border-bottom: 2px solid #667eea; padding-bottom: 20px; margin-bottom: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; }
        .metric h3 { margin: 0 0 10px 0; color: #667eea; }
        .metric .value { font-size: 2em; font-weight: bold; color: #333; }
        .phases { margin-top: 30px; }
        .phase-item { border: 1px solid #ddd; border-radius: 8px; margin-bottom: 15px; padding: 20px; }
        .phase-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .phase-name { font-weight: bold; font-size: 1.1em; }
        .phase-status { padding: 4px 8px; border-radius: 4px; font-weight: bold; }
        .status-completed { background: #d4edda; color: #155724; }
        .status-failed { background: #f8d7da; color: #721c24; }
        .status-running { background: #fff3cd; color: #856404; }
        .phase-duration { color: #666; font-size: 0.9em; }
        .phase-error { color: #dc3545; margin-top: 10px; }
        .phase-output { background: #f8f9fa; padding: 10px; border-radius: 4px; margin-top: 10px; font-family: monospace; font-size: 0.9em; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #666; }
        .recommendations { background: #e7f3ff; border: 1px solid #b8daff; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .recommendations h3 { color: #004085; margin-top: 0; }
        .recommendations ul { margin: 10px 0 0 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 frys 综合测试报告</h1>
            <p>生成时间: ${new Date().toLocaleString("zh-CN")}</p>
            <p>测试持续时间: ${(summary.duration / 1000).toFixed(2)} 秒</p>
        </div>

        <div class="summary">
            <div class="metric">
                <h3>总阶段数</h3>
                <div class="value">${summary.totalPhases}</div>
            </div>
            <div class="metric">
                <h3>完成阶段</h3>
                <div class="value" style="color: #28a745;">${summary.completedPhases}</div>
            </div>
            <div class="metric">
                <h3>失败阶段</h3>
                <div class="value" style="color: #dc3545;">${summary.failedPhases}</div>
            </div>
            <div class="metric">
                <h3>成功率</h3>
                <div class="value" style="color: ${summary.totalPhases > 0 ? ((summary.completedPhases / summary.totalPhases) * 100 >= 80 ? "#28a745" : "#ffc107") : "#666"};">${summary.totalPhases > 0 ? ((summary.completedPhases / summary.totalPhases) * 100).toFixed(1) : 0}%</div>
            </div>
        </div>

        <div class="phases">
            <h2>📋 测试阶段详情</h2>
            ${phases
							.map(
								(phase) => `
                <div class="phase-item">
                    <div class="phase-header">
                        <span class="phase-name">${phase.name}</span>
                        <div>
                            <span class="phase-status status-${phase.status}">${phase.status.toUpperCase()}</span>
                            <span class="phase-duration">(${phase.duration}ms)</span>
                        </div>
                    </div>
                    ${phase.error ? `<div class="phase-error">❌ ${phase.error}</div>` : ""}
                    ${phase.output ? `<div class="phase-output">${JSON.stringify(phase.output, null, 2)}</div>` : ""}
                </div>
            `,
							)
							.join("")}
        </div>

        ${this.generateRecommendations()}

        <div class="footer">
            <p>🎯 frys - 现代化工作流管理系统</p>
            <p>Generated by Comprehensive Test Runner v1.0</p>
        </div>
    </div>
</body>
</html>`;
	}

	generateRecommendations() {
		const failedPhases = this.results.phases.filter(
			(p) => p.status === "failed",
		);
		const recommendations = [];

		if (failedPhases.length > 0) {
			recommendations.push(
				`${failedPhases.length} 个测试阶段失败，需要检查相关配置和代码`,
			);
		}

		const completedPhases = this.results.phases.filter(
			(p) => p.status === "completed",
		);

		if (completedPhases.length === this.results.phases.length) {
			recommendations.push("🎉 所有测试阶段通过！系统已准备好进行生产部署");
		}

		if (recommendations.length === 0) {
			return "";
		}

		return `
        <div class="recommendations">
            <h3>💡 建议和后续行动</h3>
            <ul>
                ${recommendations.map((rec) => `<li>${rec}</li>`).join("")}
            </ul>
        </div>
    `;
	}

	async runAllTests() {
		const startTime = Date.now();

		console.log("🎯 启动frys综合测试套件");
		console.log(`🎯 目标服务器: ${this.targetUrl}`);
		console.log("=".repeat(80));

		try {
			// 运行所有测试阶段
			await this.phaseEnvironmentSetup();
			await this.phaseCodeQuality();
			await this.phaseBuildAndDeploy();
			await this.phaseIndustrialTests();
			await this.phasePerformanceTest();
			await this.phaseE2ETests();
			await this.phaseStressTest();
			await this.phaseCleanupAndReport();

			this.results.summary.duration = Date.now() - startTime;

			console.log("\n" + "=".repeat(80));
			console.log("📊 综合测试结果总结");
			console.log("=".repeat(80));
			console.log(`总阶段数: ${this.results.summary.totalPhases}`);
			console.log(`完成阶段: ${this.results.summary.completedPhases}`);
			console.log(`失败阶段: ${this.results.summary.failedPhases}`);
			console.log(
				`成功率: ${((this.results.summary.completedPhases / this.results.summary.totalPhases) * 100).toFixed(1)}%`,
			);
			console.log(
				`总耗时: ${(this.results.summary.duration / 1000).toFixed(2)}秒`,
			);
			console.log("=".repeat(80));

			if (this.results.summary.failedPhases === 0) {
				console.log("🎉 所有测试阶段通过！系统已准备好用于生产环境。");
				console.log("📋 查看详细报告: reports/comprehensive-test-report.html");
			} else {
				console.log("⚠️  有测试阶段失败，请检查详细报告。");
				console.log("📋 查看详细报告: reports/comprehensive-test-report.html");
				process.exit(1);
			}
		} catch (error) {
			console.error("❌ 综合测试失败:", error.message);
			await this.phaseCleanupAndReport(); // 确保清理
			process.exit(1);
		}
	}
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
	const args = process.argv.slice(2);
	const options = {};

	// 解析命令行参数
	for (let i = 0; i < args.length; i++) {
		switch (args[i]) {
			case "--target-url":
			case "-u":
				options.targetUrl = args[++i];
				break;
			case "--help":
			case "-h":
				console.log("使用方法:");
				console.log("  node run-comprehensive-tests.js [options]");
				console.log("");
				console.log("选项:");
				console.log(
					"  -u, --target-url <url>    目标服务器URL (默认: http://localhost:3000)",
				);
				console.log("  -h, --help                显示帮助信息");
				console.log("");
				console.log("此脚本将运行完整的测试套件，包括：");
				console.log("  • 环境准备");
				console.log("  • 代码质量检查");
				console.log("  • 构建和部署");
				console.log("  • 工业级测试");
				console.log("  • 性能测试");
				console.log("  • 端到端测试");
				console.log("  • 压力测试");
				console.log("  • 清理和报告生成");
				console.log("");
				console.log("报告将生成在 reports/ 目录中");
				process.exit(0);
		}
	}

	const runner = new ComprehensiveTestRunner(options);
	runner.runAllTests().catch((error) => {
		console.error("❌ 综合测试运行失败:", error.message);
		process.exit(1);
	});

	// 处理退出信号
	process.on("SIGINT", () => {
		console.log("\n⏹️  正在停止测试并生成报告...");
		process.exit(0);
	});
}

export { ComprehensiveTestRunner };
