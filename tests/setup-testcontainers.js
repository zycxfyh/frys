import {
  GenericContainer,
  PostgreSqlContainer,
  RedisContainer,
} from 'testcontainers';

/**
 * Testcontainers setup for integration tests
 * 使用GitHub开源项目: testcontainers/testcontainers-node
 */
class TestEnvironment {
  constructor() {
    this.postgresContainer = null;
    this.redisContainer = null;
    this.rabbitmqContainer = null;
    this.containers = [];
    this.started = false;
  }

  async start() {
    // 防止重复启动
    if (this.started) {
      return this.getConnectionInfo();
    }

    console.log('🚀 启动测试容器环境 (Testcontainers)...');

    try {
      // 启动PostgreSQL容器
      this.postgresContainer = await new PostgreSqlContainer(
        'postgres:15-alpine',
      )
        .withDatabase('testdb')
        .withUsername('testuser')
        .withPassword('testpass')
        .withExposedPorts(5432)
        .start();

      const postgresHost = this.postgresContainer.getHost();
      const postgresPort = this.postgresContainer.getMappedPort(5432);

      console.log(`✅ PostgreSQL容器启动: ${postgresHost}:${postgresPort}`);

      // 启动Redis容器
      this.redisContainer = await new RedisContainer('redis:7-alpine')
        .withExposedPorts(6379)
        .start();

      const redisHost = this.redisContainer.getHost();
      const redisPort = this.redisContainer.getMappedPort(6379);

      console.log(`✅ Redis容器启动: ${redisHost}:${redisPort}`);

      // 启动RabbitMQ容器
      this.rabbitmqContainer = await new GenericContainer(
        'rabbitmq:3-management-alpine',
      )
        .withExposedPorts(5672, 15672)
        .withEnvironment({
          RABBITMQ_DEFAULT_USER: 'guest',
          RABBITMQ_DEFAULT_PASS: 'guest',
        })
        .start();

      const rabbitmqHost = this.rabbitmqContainer.getHost();
      const rabbitmqPort = this.rabbitmqContainer.getMappedPort(5672);

      console.log(`✅ RabbitMQ容器启动: ${rabbitmqHost}:${rabbitmqPort}`);

      // 设置环境变量供测试使用
      process.env.TEST_POSTGRES_HOST = postgresHost;
      process.env.TEST_POSTGRES_PORT = postgresPort.toString();
      process.env.TEST_POSTGRES_DATABASE = 'testdb';
      process.env.TEST_POSTGRES_USER = 'testuser';
      process.env.TEST_POSTGRES_PASSWORD = 'testpass';

      process.env.TEST_REDIS_HOST = redisHost;
      process.env.TEST_REDIS_PORT = redisPort.toString();

      process.env.TEST_RABBITMQ_HOST = rabbitmqHost;
      process.env.TEST_RABBITMQ_PORT = rabbitmqPort.toString();
      process.env.TEST_RABBITMQ_USER = 'guest';
      process.env.TEST_RABBITMQ_PASS = 'guest';

      this.containers = [
        this.postgresContainer,
        this.redisContainer,
        this.rabbitmqContainer,
      ];
      this.started = true;

      console.log('🎉 测试容器环境启动完成');

      return this.getConnectionInfo();
    } catch (error) {
      console.error('❌ 启动测试容器失败:', error.message);
      // 在CI环境或容器不可用时跳过
      if (process.env.CI || process.env.SKIP_TEST_CONTAINERS) {
        console.log('⚠️ 跳过Testcontainers启动 (CI环境或手动跳过)');
        return null;
      }
      throw error;
    }
  }

  async stop() {
    if (!this.started) return;

    console.log('🛑 停止测试容器环境...');

    try {
      for (const container of this.containers) {
        if (container) {
          await container.stop();
        }
      }
      this.containers = [];
      this.started = false;
      console.log('✅ 测试容器环境已停止');
    } catch (error) {
      console.error('❌ 停止测试容器失败:', error.message);
    }
  }

  getConnectionInfo() {
    if (!this.started) return null;

    return {
      postgres: {
        host: process.env.TEST_POSTGRES_HOST,
        port: process.env.TEST_POSTGRES_PORT,
        database: process.env.TEST_POSTGRES_DATABASE,
        user: process.env.TEST_POSTGRES_USER,
        password: process.env.TEST_POSTGRES_PASSWORD,
      },
      redis: {
        host: process.env.TEST_REDIS_HOST,
        port: process.env.TEST_REDIS_PORT,
      },
      rabbitmq: {
        host: process.env.TEST_RABBITMQ_HOST,
        port: process.env.TEST_RABBITMQ_PORT,
        username: process.env.TEST_RABBITMQ_USER,
        password: process.env.TEST_RABBITMQ_PASS,
        vhost: '/',
      },
    };
  }

  getConnectionStrings() {
    const info = this.getConnectionInfo();
    if (!info) return null;

    return {
      postgres: `postgresql://${info.postgres.user}:${info.postgres.password}@${info.postgres.host}:${info.postgres.port}/${info.postgres.database}`,
      redis: `redis://${info.redis.host}:${info.redis.port}`,
      rabbitmq: `amqp://${info.rabbitmq.username}:${info.rabbitmq.password}@${info.rabbitmq.host}:${info.rabbitmq.port}${info.rabbitmq.vhost}`,
    };
  }
}

// 全局测试环境实例
let globalTestEnvironment = null;

// Vitest全局设置
export async function setup() {
  // 只在需要时启动容器
  if (
    !process.env.CI &&
    !process.env.SKIP_TEST_CONTAINERS &&
    !globalTestEnvironment
  ) {
    globalTestEnvironment = new TestEnvironment();
    await globalTestEnvironment.start();
  }
}

export async function teardown() {
  if (globalTestEnvironment) {
    await globalTestEnvironment.stop();
    globalTestEnvironment = null;
  }
}

// 导出供测试使用的工具函数
export function getTestEnvironment() {
  return globalTestEnvironment;
}

export function getTestConnectionStrings() {
  return globalTestEnvironment?.getConnectionStrings();
}
