#!/usr/bin/env node

/**
 * 简化的Frys启动脚本
 * 避免复杂的依赖链，只启动核心服务
 */

import { config } from "./src/shared/utils/config.js";
import { logger } from "./src/shared/utils/logger.js";

console.log("🚀 Frys 简化启动脚本");
console.log("📄 配置加载:", config.app.name);
console.log("🌐 端口:", config.app.port);
console.log("📊 环境:", config.app.env);

// 简单的健康检查端点
import express from "express";

const app = express();
app.use(express.json());

app.get("/health", (req, res) => {
	res.json({
		status: "healthy",
		service: "frys-simplified",
		timestamp: new Date().toISOString(),
		version: "1.0.0-simple",
	});
});

app.listen(config.app.port, () => {
	console.log(`✅ Frys 简化服务器运行在 http://localhost:${config.app.port}`);
	console.log(`📊 健康检查: http://localhost:${config.app.port}/health`);
});
