#!/usr/bin/env node

/**
 * 简单的测试服务器 - 用于验证API功能
 */

import cors from "cors";
import express from "express";
import jwt from "jsonwebtoken";

const app = express();
const PORT = 3000;

// 中间件
app.use(cors());
app.use(express.json());

// 模拟数据存储
const users = new Map();
const conversations = new Map();

// JWT密钥
const JWT_SECRET = "test-secret-key";

// 健康检查
app.get("/health", (req, res) => {
	res.json({
		status: "healthy",
		timestamp: new Date().toISOString(),
		version: "1.0.0-test",
	});
});

// 用户注册
app.post("/api/auth/register", (req, res) => {
	try {
		const { username, email, password } = req.body;

		if (!username || !email || !password) {
			return res.status(400).json({
				error: "Username, email, and password are required",
			});
		}

		if (password.length < 8) {
			return res.status(400).json({
				error: "Password must be at least 8 characters long",
			});
		}

		// 检查用户是否已存在
		for (const user of users.values()) {
			if (user.username === username || user.email === email) {
				return res.status(400).json({
					error: "Username or email already exists",
				});
			}
		}

		const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
		const user = {
			id: userId,
			username,
			email,
			passwordHash: `hash_${password}`, // 模拟密码哈希
			isActive: true,
			isEmailVerified: false,
			createdAt: new Date().toISOString(),
		};

		users.set(userId, user);

		console.log(`✅ 用户注册: ${username} (${email})`);

		res.status(201).json({
			user: {
				id: user.id,
				username: user.username,
				email: user.email,
				isActive: user.isActive,
				isEmailVerified: user.isEmailVerified,
				createdAt: user.createdAt,
			},
			message: "User registered successfully",
		});
	} catch (error) {
		console.error("注册错误:", error);
		res.status(500).json({ error: "Internal server error" });
	}
});

// 用户登录
app.post("/api/auth/login", (req, res) => {
	try {
		const { username, password } = req.body;

		if (!username || !password) {
			return res.status(400).json({
				error: "Username and password are required",
			});
		}

		// 查找用户
		let foundUser = null;
		for (const user of users.values()) {
			if (user.username === username) {
				foundUser = user;
				break;
			}
		}

		if (!foundUser) {
			return res.status(401).json({
				error: "Invalid username or password",
			});
		}

		// 验证密码（模拟）
		if (foundUser.passwordHash !== `hash_${password}`) {
			return res.status(401).json({
				error: "Invalid username or password",
			});
		}

		// 生成JWT令牌
		const accessToken = jwt.sign(
			{
				sub: foundUser.id,
				username: foundUser.username,
				email: foundUser.email,
				type: "access",
			},
			JWT_SECRET,
			{ expiresIn: "15m" },
		);

		const refreshToken = jwt.sign(
			{
				sub: foundUser.id,
				username: foundUser.username,
				type: "refresh",
			},
			JWT_SECRET,
			{ expiresIn: "7d" },
		);

		console.log(`✅ 用户登录: ${username}`);

		res.json({
			user: {
				id: foundUser.id,
				username: foundUser.username,
				email: foundUser.email,
				isActive: foundUser.isActive,
				isEmailVerified: foundUser.isEmailVerified,
			},
			tokens: {
				access_token: accessToken,
				refresh_token: refreshToken,
				expires_in: 900,
				token_type: "Bearer",
			},
			message: "Login successful",
		});
	} catch (error) {
		console.error("登录错误:", error);
		res.status(500).json({ error: "Internal server error" });
	}
});

// 创建对话
app.post("/api/ai/conversations", (req, res) => {
	try {
		const authHeader = req.headers.authorization;
		if (!authHeader || !authHeader.startsWith("Bearer ")) {
			return res.status(401).json({ error: "Unauthorized" });
		}

		const token = authHeader.substring(7);
		let decoded;
		try {
			decoded = jwt.verify(token, JWT_SECRET);
		} catch (err) {
			return res.status(401).json({ error: "Invalid token" });
		}

		const { model = "openai", memory = true } = req.body;
		const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

		const conversation = {
			id: conversationId,
			userId: decoded.sub,
			model,
			memory,
			messages: [],
			createdAt: new Date().toISOString(),
			lastActivity: new Date().toISOString(),
			status: "active",
		};

		conversations.set(conversationId, conversation);

		console.log(`✅ 对话创建: ${conversationId} (${model})`);

		res.status(201).json({
			conversation: {
				id: conversation.id,
				model: conversation.model,
				hasMemory: conversation.memory,
				createdAt: conversation.createdAt,
			},
			message: "Conversation created successfully",
		});
	} catch (error) {
		console.error("创建对话错误:", error);
		res.status(500).json({ error: "Internal server error" });
	}
});

// 发送消息
app.post("/api/ai/conversations/:conversationId/messages", (req, res) => {
	try {
		const authHeader = req.headers.authorization;
		if (!authHeader || !authHeader.startsWith("Bearer ")) {
			return res.status(401).json({ error: "Unauthorized" });
		}

		const token = authHeader.substring(7);
		let decoded;
		try {
			decoded = jwt.verify(token, JWT_SECRET);
		} catch (err) {
			return res.status(401).json({ error: "Invalid token" });
		}

		const { conversationId } = req.params;
		const { message } = req.body;

		if (!message || typeof message !== "string") {
			return res.status(400).json({ error: "Message is required" });
		}

		const conversation = conversations.get(conversationId);
		if (!conversation) {
			return res.status(404).json({ error: "Conversation not found" });
		}

		if (conversation.userId !== decoded.sub) {
			return res.status(403).json({ error: "Access denied" });
		}

		// 添加用户消息
		const userMessage = {
			role: "user",
			content: message,
			timestamp: new Date().toISOString(),
			messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
		};

		conversation.messages.push(userMessage);

		// 生成助手回复（模拟）
		let response;
		if (
			message.toLowerCase().includes("你好") ||
			message.toLowerCase().includes("hello")
		) {
			response =
				"你好！我是Frys智能助手，很高兴为您服务。请问有什么可以帮助您的吗？";
		} else if (message.toLowerCase().includes("帮助")) {
			response =
				"我可以帮助您进行工作流设计、AI模型调用、数据处理等多种任务。请告诉我您具体需要什么帮助。";
		} else {
			response = `我收到了您的消息："${message.slice(0, 50)}${message.length > 50 ? "..." : ""}"。作为Frys智能助手，我可以帮助您进行各种工作流和AI相关的任务。`;
		}

		const assistantMessage = {
			role: "assistant",
			content: response,
			timestamp: new Date().toISOString(),
			messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
			responseTime: Math.floor(Math.random() * 1000) + 500, // 模拟响应时间
			model: conversation.model,
		};

		conversation.messages.push(assistantMessage);
		conversation.lastActivity = new Date().toISOString();

		console.log(`✅ 消息处理: ${conversationId} - ${message.length}字符`);

		res.json({
			conversationId,
			message: assistantMessage,
			conversation: {
				totalMessages: conversation.messages.length,
				lastActivity: conversation.lastActivity,
			},
		});
	} catch (error) {
		console.error("发送消息错误:", error);
		res.status(500).json({ error: "Internal server error" });
	}
});

// 获取对话历史
app.get("/api/ai/conversations/:conversationId/history", (req, res) => {
	try {
		const authHeader = req.headers.authorization;
		if (!authHeader || !authHeader.startsWith("Bearer ")) {
			return res.status(401).json({ error: "Unauthorized" });
		}

		const token = authHeader.substring(7);
		let decoded;
		try {
			decoded = jwt.verify(token, JWT_SECRET);
		} catch (err) {
			return res.status(401).json({ error: "Invalid token" });
		}

		const { conversationId } = req.params;
		const conversation = conversations.get(conversationId);

		if (!conversation) {
			return res.status(404).json({ error: "Conversation not found" });
		}

		if (conversation.userId !== decoded.sub) {
			return res.status(403).json({ error: "Access denied" });
		}

		res.json({
			conversation: {
				id: conversation.id,
				messages: conversation.messages,
				totalMessages: conversation.messages.length,
				lastActivity: conversation.lastActivity,
			},
		});
	} catch (error) {
		console.error("获取对话历史错误:", error);
		res.status(500).json({ error: "Internal server error" });
	}
});

// 获取用户对话列表
app.get("/api/ai/conversations", (req, res) => {
	try {
		const authHeader = req.headers.authorization;
		if (!authHeader || !authHeader.startsWith("Bearer ")) {
			return res.status(401).json({ error: "Unauthorized" });
		}

		const token = authHeader.substring(7);
		let decoded;
		try {
			decoded = jwt.verify(token, JWT_SECRET);
		} catch (err) {
			return res.status(401).json({ error: "Invalid token" });
		}

		const userConversations = [];
		for (const conv of conversations.values()) {
			if (conv.userId === decoded.sub) {
				userConversations.push({
					conversationId: conv.id,
					model: conv.model,
					messageCount: conv.messages.length,
					lastActivity: conv.lastActivity,
					createdAt: conv.createdAt,
				});
			}
		}

		res.json({
			conversations: userConversations,
			total: userConversations.length,
		});
	} catch (error) {
		console.error("获取对话列表错误:", error);
		res.status(500).json({ error: "Internal server error" });
	}
});

// 启动服务器
app.listen(PORT, () => {
	console.log(`🚀 Frys测试服务器已启动: http://localhost:${PORT}`);
	console.log(`📊 健康检查: http://localhost:${PORT}/health`);
	console.log(`🔐 用户注册: POST http://localhost:${PORT}/api/auth/register`);
	console.log(`🔑 用户登录: POST http://localhost:${PORT}/api/auth/login`);
	console.log(
		`🤖 创建对话: POST http://localhost:${PORT}/api/ai/conversations`,
	);
	console.log(
		`💬 发送消息: POST http://localhost:${PORT}/api/ai/conversations/{id}/messages`,
	);
});
