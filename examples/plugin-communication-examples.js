/**
 * frys 插件通信总线示例
 * 展示VCPToolBox插件协作功能的实际应用
 */

import { PluginCommunicationBus } from '../src/core/plugin/PluginCommunicationBus.js';

// 示例插件类
class LoggerPlugin {
  constructor(id) {
    this.id = id;
    this.logs = [];
  }

  async initializeCommunication(api) {
    this.api = api;

    // 订阅日志相关消息
    this.api.subscribe('system.log', this.handleLogMessage.bind(this));
    this.api.subscribe('system.error', this.handleErrorMessage.bind(this));

    console.log(`[${this.id}] 日志插件已初始化`);
  }

  async handleMessage(message) {
    // 处理直接消息
    if (message.type === 'direct' && message.payload.type === 'get_logs') {
      await this.api.sendTo(this.id, message.senderId, {
        type: 'logs_response',
        logs: this.logs.slice(-10), // 返回最近10条日志
      });
    }
  }

  handleLogMessage(message) {
    const logEntry = {
      timestamp: new Date(),
      level: 'info',
      message: message.payload.message,
      source: message.publisherId,
    };
    this.logs.push(logEntry);
    console.log(`[LOG] ${message.publisherId}: ${message.payload.message}`);
  }

  handleErrorMessage(message) {
    const logEntry = {
      timestamp: new Date(),
      level: 'error',
      message: message.payload.message,
      source: message.publisherId,
      stack: message.payload.stack,
    };
    this.logs.push(logEntry);
    console.error(`[ERROR] ${message.publisherId}: ${message.payload.message}`);
  }

  async shutdown() {
    console.log(`[${this.id}] 日志插件已关闭`);
  }
}

class DatabasePlugin {
  constructor(id) {
    this.id = id;
    this.data = new Map();
  }

  async initializeCommunication(api) {
    this.api = api;

    // 订阅数据库操作请求
    this.api.subscribe('db.query', this.handleQuery.bind(this));
    this.api.subscribe('db.insert', this.handleInsert.bind(this));

    console.log(`[${this.id}] 数据库插件已初始化`);
  }

  async handleMessage(message) {
    // 处理直接消息
  }

  async handleQuery(message) {
    const { collection, filter, responseTopic } = message.payload;

    try {
      const results = Array.from(this.data.get(collection) || []).filter(
        (item) => this.matchesFilter(item, filter),
      );

      if (responseTopic) {
        await this.api.publish(responseTopic, {
          success: true,
          data: results,
        });
      }
    } catch (error) {
      if (responseTopic) {
        await this.api.publish(responseTopic, {
          success: false,
          error: error.message,
        });
      }
    }
  }

  async handleInsert(message) {
    const { collection, data, responseTopic } = message.payload;

    try {
      if (!this.data.has(collection)) {
        this.data.set(collection, []);
      }

      const collectionData = this.data.get(collection);
      const newItem = { ...data, id: Date.now().toString() };
      collectionData.push(newItem);

      if (responseTopic) {
        await this.api.publish(responseTopic, {
          success: true,
          data: newItem,
        });
      }
    } catch (error) {
      if (responseTopic) {
        await this.api.publish(responseTopic, {
          success: false,
          error: error.message,
        });
      }
    }
  }

  matchesFilter(item, filter) {
    if (!filter) return true;

    for (const [key, value] of Object.entries(filter)) {
      if (item[key] !== value) {
        return false;
      }
    }
    return true;
  }

  async shutdown() {
    console.log(`[${this.id}] 数据库插件已关闭`);
  }
}

class APIServicePlugin {
  constructor(id) {
    this.id = id;
    this.requests = 0;
  }

  async initializeCommunication(api) {
    this.api = api;

    // 订阅API请求
    this.api.subscribe('api.call', this.handleAPICall.bind(this));

    console.log(`[${this.id}] API服务插件已初始化`);
  }

  async handleMessage(message) {
    // 处理直接消息
  }

  async handleAPICall(message) {
    const { endpoint, method = 'GET', data, responseTopic } = message.payload;

    this.requests++;

    try {
      // 模拟API调用
      console.log(`[${this.id}] 处理API请求: ${method} ${endpoint}`);

      // 记录日志
      await this.api.publish('system.log', {
        message: `API调用: ${method} ${endpoint}`,
        requestCount: this.requests,
      });

      // 查询数据库（如果需要）
      if (endpoint.includes('/users')) {
        const response = await this.api.request(this.id, 'database-plugin', {
          type: 'query',
          collection: 'users',
          filter: data?.filter,
        });

        if (responseTopic) {
          await this.api.publish(responseTopic, {
            success: true,
            data: response,
          });
        }
      } else {
        // 模拟其他API响应
        const mockResponse = {
          endpoint,
          method,
          timestamp: new Date(),
          status: 200,
        };

        if (responseTopic) {
          await this.api.publish(responseTopic, {
            success: true,
            data: mockResponse,
          });
        }
      }
    } catch (error) {
      // 记录错误日志
      await this.api.publish('system.error', {
        message: `API调用失败: ${error.message}`,
        endpoint,
        method,
      });

      if (responseTopic) {
        await this.api.publish(responseTopic, {
          success: false,
          error: error.message,
        });
      }
    }
  }

  async shutdown() {
    console.log(`[${this.id}] API服务插件已关闭`);
  }
}

/**
 * 示例1: 基本发布订阅
 */
async function example1_BasicPubSub() {
  console.log('\n📡 示例1: 基本发布订阅');

  const bus = new PluginCommunicationBus({ enableLogging: false });

  // 注册插件
  const logger = new LoggerPlugin('logger-plugin');
  await bus.registerPlugin('logger-plugin', logger);

  // 发布消息
  await bus.publish('system', 'system.log', { message: '系统启动' });
  await bus.publish('system', 'system.log', { message: '服务初始化完成' });

  // 等待消息处理
  await new Promise((resolve) => setTimeout(resolve, 100));

  console.log('日志记录:', logger.logs.length, '条');

  await bus.shutdown();
}

/**
 * 示例2: 请求响应模式
 */
async function example2_RequestResponse() {
  console.log('\n🔄 示例2: 请求响应模式');

  const bus = new PluginCommunicationBus({ enableLogging: false });

  // 注册插件
  const db = new DatabasePlugin('database-plugin');
  const api = new APIServicePlugin('api-plugin');

  await bus.registerPlugin('database-plugin', db);
  await bus.registerPlugin('api-plugin', api);

  // API插件请求数据库
  try {
    const response = await bus.request(
      'api-plugin',
      'database-plugin',
      {
        type: 'query',
        collection: 'users',
        filter: { active: true },
      },
      { timeout: 2000 },
    );

    console.log('数据库响应:', response);
  } catch (error) {
    console.log('请求失败:', error.message);
  }

  await bus.shutdown();
}

/**
 * 示例3: 插件协作工作流
 */
async function example3_PluginWorkflow() {
  console.log('\n🔗 示例3: 插件协作工作流');

  const bus = new PluginCommunicationBus({ enableLogging: false });

  // 注册插件
  const logger = new LoggerPlugin('logger-plugin');
  const db = new DatabasePlugin('database-plugin');
  const api = new APIServicePlugin('api-plugin');

  await bus.registerPlugin('logger-plugin', logger);
  await bus.registerPlugin('database-plugin', db);
  await bus.registerPlugin('api-plugin', api);

  // 模拟完整的工作流
  console.log('🚀 开始工作流...');

  // 1. 记录开始日志
  await bus.publish('workflow', 'system.log', { message: '工作流开始执行' });

  // 2. API处理请求
  const apiResponse = await bus.request('workflow', 'api-plugin', {
    type: 'call',
    endpoint: '/users',
    method: 'GET',
    data: { filter: { active: true } },
  });

  console.log('API响应:', apiResponse);

  // 3. 记录完成日志
  await bus.publish('workflow', 'system.log', { message: '工作流执行完成' });

  // 等待所有消息处理完成
  await new Promise((resolve) => setTimeout(resolve, 200));

  console.log('📊 最终统计:');
  console.log('- 日志条数:', logger.logs.length);
  console.log('- API请求数:', api.requests);

  await bus.shutdown();
}

/**
 * 示例4: 主题通配符和过滤器
 */
async function example4_AdvancedFeatures() {
  console.log('\n🎯 示例4: 高级特性');

  const bus = new PluginCommunicationBus({ enableLogging: false });

  // 注册插件
  const logger = new LoggerPlugin('logger-plugin');
  await bus.registerPlugin('logger-plugin', logger);

  // 订阅通配符主题
  let wildcardCount = 0;
  bus.subscribe('logger-plugin', 'events.*', (message) => {
    wildcardCount++;
    console.log(`通配符收到: ${message.topic}`);
  });

  // 添加消息过滤器
  bus.addMessageFilter('security-filter', (message) => {
    // 过滤掉包含敏感信息的消息
    return !message.payload?.message?.includes('password');
  });

  // 发布各种消息
  await bus.publish('system', 'events.user', {
    message: '用户登录',
    userId: 123,
  });
  await bus.publish('system', 'events.system', { message: '系统重启' });
  await bus.publish('system', 'events.security', {
    message: '密码变更',
    userId: 123,
  }); // 会被过滤

  // 等待消息处理
  await new Promise((resolve) => setTimeout(resolve, 100));

  console.log(`通配符处理的消息数: ${wildcardCount}`);

  // 查看统计
  const stats = bus.getStats();
  console.log('通信统计:', stats);

  await bus.shutdown();
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 frys 插件通信总线示例演示');
  console.log('='.repeat(50));

  try {
    await example1_BasicPubSub();
    await example2_RequestResponse();
    await example3_PluginWorkflow();
    await example4_AdvancedFeatures();

    console.log('\n✅ 所有示例运行完成！');
    console.log('\n📖 更多信息请查看 docs/plugin-communication-guide.md');
  } catch (error) {
    console.error('❌ 示例运行失败:', error);
  }
}

// 运行示例
main();
