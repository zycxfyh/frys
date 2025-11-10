#!/usr/bin/env zx

/**
 * 端口冲突诊断和解决工具
 * 检查端口占用情况并提供解决方案
 */

import { $ } from "zx";

console.log("🔍 端口冲突诊断工具");
console.log("========================");

// 1. 检查Redis端口6379占用情况
console.log("\n📡 1. 检查Redis端口6379占用情况...");
try {
	// Windows下检查端口占用
	const portCheck = await $`netstat -ano | findstr :6379`.nothrow();
	if (portCheck.stdout) {
		console.log("⚠️ 端口6379已被占用:");
		console.log(portCheck.stdout);

		// 尝试获取进程信息
		const lines = portCheck.stdout.trim().split("\n");
		for (const line of lines) {
			const parts = line.trim().split(/\s+/);
			if (parts.length >= 5) {
				const pid = parts[4];
				try {
					const processInfo =
						await $`tasklist /FI "PID eq ${pid}" /FO CSV`.nothrow();
					console.log(`进程PID ${pid}信息:`, processInfo.stdout);
				} catch (error) {
					console.log(`无法获取PID ${pid}的进程信息`);
				}
			}
		}

		console.log("\n💡 解决方案:");
		console.log("1. 停止占用6379端口的进程");
		console.log("2. 或修改docker-compose.yml中的Redis端口映射");
		console.log('3. 例如改为: ports: ["6381:6379"]');
	} else {
		console.log("✅ 端口6379未被占用");
	}
} catch (error) {
	console.log("❌ 检查端口失败:", error.message);
}

// 2. 检查应用端口3001占用情况
console.log("\n🌐 2. 检查应用端口3001占用情况...");
try {
	const appPortCheck = await $`netstat -ano | findstr :3001`.nothrow();
	if (appPortCheck.stdout) {
		console.log("⚠️ 端口3001已被占用:");
		console.log(appPortCheck.stdout);
	} else {
		console.log("✅ 端口3001未被占用");
	}
} catch (error) {
	console.log("❌ 检查应用端口失败:", error.message);
}

// 3. 检查Docker容器端口使用情况
console.log("\n🐳 3. 检查Docker容器端口使用情况...");
try {
	const dockerPorts =
		await $`docker ps --format "table {{.Names}}\t{{.Ports}}"`;
	console.log("当前Docker容器端口映射:");
	console.log(dockerPorts.stdout);
} catch (error) {
	console.log("❌ 获取Docker端口信息失败:", error.message);
}

// 4. 提供解决方案
console.log("\n🛠️ 4. 推荐解决方案:");
console.log("=====================================");
console.log("方案A - 修改Redis端口映射:");
console.log("  在docker-compose.yml中将Redis端口改为6381:6379");
console.log("");
console.log("方案B - 停止冲突进程:");
console.log("  使用任务管理器或命令行停止占用6379端口的进程");
console.log("");
console.log("方案C - 使用不同的端口范围:");
console.log("  修改应用使用其他端口范围，如4000-4999");
console.log("");
console.log("方案D - 清理Docker资源:");
console.log("  docker system prune -a  # 清理未使用的容器和镜像");

console.log("\n✅ 诊断完成");
