#!/usr/bin/env zx

/**
 * Redis连接诊断工具
 * 检查Docker网络配置和Redis连接问题
 */

import { $ } from "zx";

console.log("🔍 Redis连接诊断工具");
console.log("=====================================");

// 1. 检查Docker容器状态
console.log("\n📦 1. 检查Docker容器状态...");
try {
	const containers =
		await $`docker ps --filter "name=frys-redis" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"`;
	console.log("✅ Redis容器状态:", containers.stdout);
} catch (error) {
	console.log("❌ 获取容器状态失败:", error.message);
}

// 2. 检查Docker网络
console.log("\n🌐 2. 检查Docker网络配置...");
try {
	const networks = await $`docker network ls`;
	console.log("✅ Docker网络:", networks.stdout);

	// 检查frys默认网络
	const inspect =
		await $`docker network inspect frys_default 2>/dev/null || echo "网络不存在"`;
	console.log("✅ 默认网络详情:", inspect.stdout);
} catch (error) {
	console.log("❌ 检查网络失败:", error.message);
}

// 3. 测试Redis容器内部连接
console.log("\n🔗 3. 测试Redis容器内部连接...");
try {
	const ping =
		await $`docker exec frys-redis redis-cli ping 2>/dev/null || echo "无法连接Redis容器"`;
	console.log("✅ Redis内部ping:", ping.stdout);
} catch (error) {
	console.log("❌ Redis内部连接失败:", error.message);
}

// 4. 测试从应用容器连接Redis
console.log("\n🔗 4. 测试从应用容器连接Redis...");
try {
	const appPing =
		await $`docker exec docker-frys-1 sh -c "echo 'PING' | nc redis 6379 2>/dev/null || echo 'nc连接失败'"`;
	console.log("✅ 应用容器到Redis连接:", appPing.stdout);
} catch (error) {
	console.log("❌ 应用容器连接测试失败:", error.message);
}

// 5. 检查环境变量配置
console.log("\n⚙️ 5. 检查应用环境变量配置...");
try {
	const env =
		await $`docker exec docker-frys-1 env | grep -E "(REDIS|NODE_ENV)" | head -10`;
	console.log("✅ 环境变量:", env.stdout);
} catch (error) {
	console.log("❌ 获取环境变量失败:", error.message);
}

// 6. 测试DNS解析
console.log("\n📡 6. 测试DNS解析...");
try {
	const dns =
		await $`docker exec docker-frys-1 nslookup redis 2>/dev/null || docker exec docker-frys-1 getent hosts redis 2>/dev/null || echo "DNS解析失败"`;
	console.log("✅ DNS解析结果:", dns.stdout);
} catch (error) {
	console.log("❌ DNS解析测试失败:", error.message);
}

// 7. 诊断建议
console.log("\n💡 7. 诊断建议:");
console.log("=====================================");
console.log("🔧 可能的解决方案:");
console.log("1. 重启Docker容器确保网络连接");
console.log("2. 检查docker-compose.yml中的depends_on配置");
console.log("3. 验证Redis容器端口映射");
console.log("4. 检查Docker网络隔离设置");
console.log("5. 考虑使用host网络模式或明确的IP地址");

console.log("\n✅ 诊断完成");
