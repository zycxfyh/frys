# 🔗 Phase 1.5.3: 第三方集成示例

## 🎯 模块目标

**构建丰富、实用的第三方集成示例，展示frys工作流系统与主流工具和平台的无缝集成能力，降低用户集成门槛，加速业务流程自动化。**

### 核心价值
- **即插即用**：开箱可用的集成模板
- **场景覆盖**：覆盖主流业务场景
- **最佳实践**：集成行业标准和优化方案
- **快速验证**：快速验证集成效果和价值

### 成功标准
- 集成示例覆盖率>70% (主流工具)
- 示例部署成功率>95%
- 用户集成时间减少60%
- 示例使用率>30%

---

## 📊 详细任务分解

### 1.5.3.1 集成框架设计 (2周)

#### 目标
设计标准化、可扩展的集成框架。

#### 具体任务

**1.5.3.1.1 集成适配器架构**
- **适配器设计模式**：
  ```typescript
  interface IntegrationAdapter {
    readonly name: string;
    readonly version: string;
    readonly type: IntegrationType;
    readonly capabilities: IntegrationCapability[];

    // 生命周期方法
    initialize(config: IntegrationConfig): Promise<void>;
    validateConfig(config: IntegrationConfig): Promise<ValidationResult>;
    testConnection(config: IntegrationConfig): Promise<ConnectionTestResult>;
    cleanup(): Promise<void>;

    // 核心功能
    executeAction(action: string, params: any): Promise<ExecutionResult>;
    getData(query: DataQuery): Promise<DataResult>;
    subscribeToEvents(config: EventSubscriptionConfig): Promise<EventSubscription>;
    unsubscribeFromEvents(subscriptionId: string): Promise<void>;
  }

  enum IntegrationType {
    API = 'api',
    DATABASE = 'database',
    MESSAGE_QUEUE = 'message_queue',
    STORAGE = 'storage',
    AUTHENTICATION = 'authentication',
    MONITORING = 'monitoring',
    COMMUNICATION = 'communication',
    PAYMENT = 'payment',
    ANALYTICS = 'analytics',
    CUSTOM = 'custom'
  }

  interface IntegrationCapability {
    name: string;
    description: string;
    inputSchema: JSONSchema;
    outputSchema: JSONSchema;
    authentication: AuthenticationMethod[];
  }

  enum AuthenticationMethod {
    API_KEY = 'api_key',
    OAUTH2 = 'oauth2',
    BASIC_AUTH = 'basic_auth',
    JWT = 'jwt',
    CERTIFICATE = 'certificate',
    NONE = 'none'
  }
  ```

**1.5.3.1.2 集成配置管理系统**
- **配置管理**：
  ```typescript
  class IntegrationConfigManager {
    private configs: Map<string, IntegrationConfig> = new Map();
    private validators: Map<string, ConfigValidator> = new Map();
    private encryptor: DataEncryptor;

    async saveConfig(integrationId: string, config: IntegrationConfig): Promise<void> {
      // 验证配置
      const validator = this.validators.get(config.type);
      if (validator) {
        const validationResult = await validator.validate(config);
        if (!validationResult.isValid) {
          throw new ValidationError('Configuration validation failed', validationResult.errors);
        }
      }

      // 加密敏感数据
      const encryptedConfig = await this.encryptSensitiveData(config);

      // 保存配置
      this.configs.set(integrationId, encryptedConfig);

      // 持久化存储
      await this.persistConfig(integrationId, encryptedConfig);
    }

    async getConfig(integrationId: string): Promise<IntegrationConfig> {
      const encryptedConfig = this.configs.get(integrationId);
      if (!encryptedConfig) {
        throw new NotFoundError(`Integration config not found: ${integrationId}`);
      }

      // 解密敏感数据
      return await this.decryptSensitiveData(encryptedConfig);
    }

    private async encryptSensitiveData(config: IntegrationConfig): Promise<IntegrationConfig> {
      const encrypted = { ...config };

      // 递归加密敏感字段
      await this.traverseAndEncrypt(encrypted, config.schema);

      return encrypted;
    }

    private async traverseAndEncrypt(obj: any, schema: JSONSchema, path: string = ''): Promise<void> {
      if (!obj || typeof obj !== 'object') return;

      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;
        const fieldSchema = this.getFieldSchema(schema, currentPath);

        if (fieldSchema?.sensitive) {
          obj[key] = await this.encryptor.encrypt(String(value));
        } else if (typeof value === 'object') {
          await this.traverseAndEncrypt(value, schema, currentPath);
        }
      }
    }

    async testConnection(integrationId: string): Promise<ConnectionTestResult> {
      const config = await this.getConfig(integrationId);
      const adapter = await this.getAdapter(config.type);

      try {
        const result = await adapter.testConnection(config);
        return {
          success: true,
          responseTime: result.responseTime,
          details: result.details
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
          details: error.details
        };
      }
    }
  }
  ```

**1.5.3.1.3 集成模板系统**
- **模板生成器**：
  ```typescript
  class IntegrationTemplateGenerator {
    private templates: Map<string, IntegrationTemplate> = new Map();

    async generateTemplate(integrationType: string, scenario: IntegrationScenario): Promise<WorkflowTemplate> {
      const template = this.templates.get(integrationType);
      if (!template) {
        throw new Error(`Template not found for integration type: ${integrationType}`);
      }

      // 自定义模板以适应具体场景
      return await this.customizeTemplate(template, scenario);
    }

    private async customizeTemplate(template: IntegrationTemplate, scenario: IntegrationScenario): Promise<WorkflowTemplate> {
      const customized: WorkflowTemplate = {
        name: this.interpolateString(template.name, scenario.variables),
        description: this.interpolateString(template.description, scenario.variables),
        nodes: [],
        connections: []
      };

      // 自定义节点
      for (const nodeTemplate of template.nodes) {
        const customizedNode = await this.customizeNode(nodeTemplate, scenario);
        customized.nodes.push(customizedNode);
      }

      // 生成连接
      customized.connections = this.generateConnections(template.connectionPattern, customized.nodes);

      // 添加场景特定的节点
      const scenarioNodes = await this.addScenarioSpecificNodes(scenario);
      customized.nodes.push(...scenarioNodes);

      return customized;
    }

    private async customizeNode(nodeTemplate: NodeTemplate, scenario: IntegrationScenario): Promise<WorkflowNode> {
      return {
        id: generateNodeId(),
        type: nodeTemplate.type,
        name: this.interpolateString(nodeTemplate.name, scenario.variables),
        config: await this.customizeNodeConfig(nodeTemplate.config, scenario),
        position: nodeTemplate.position
      };
    }

    private async customizeNodeConfig(config: any, scenario: IntegrationScenario): Promise<any> {
      const customized = { ...config };

      // 替换变量
      this.interpolateObject(customized, scenario.variables);

      // 应用场景特定的配置
      if (scenario.customizations) {
        await this.applyCustomizations(customized, scenario.customizations);
      }

      return customized;
    }

    private interpolateString(template: string, variables: Record<string, any>): string {
      return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        const value = variables[key];
        return value !== undefined ? String(value) : match;
      });
    }

    private interpolateObject(obj: any, variables: Record<string, any>): void {
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
          obj[key] = this.interpolateString(value, variables);
        } else if (typeof value === 'object' && value !== null) {
          this.interpolateObject(value, variables);
        }
      }
    }
  }
  ```

#### 验收标准
- ✅ 集成适配器架构完整可扩展
- ✅ 配置管理系统安全可靠
- ✅ 模板生成器自动化程度高
- ✅ 集成验证机制有效

---

### 1.5.3.2 核心集成示例开发 (4周)

#### 目标
开发覆盖主流场景的核心集成示例。

#### 具体任务

**1.5.3.2.1 数据库集成示例**
- **PostgreSQL集成**：
  ```yaml
  integration:
    name: "PostgreSQL 数据库集成"
    type: "database"
    description: "与 PostgreSQL 数据库的完整集成示例"
    version: "1.0.0"

  configuration:
    host: "${DB_HOST}"
    port: "${DB_PORT:-5432}"
    database: "${DB_NAME}"
    username: "${DB_USER}"
    password: "${DB_PASSWORD}"
    ssl: "${DB_SSL:-false}"
    connectionPool:
      min: 2
      max: 10
      idleTimeoutMillis: 30000

  capabilities:
    - name: "query"
      description: "执行 SQL 查询"
      input:
        type: object
        properties:
          sql:
            type: string
            description: "SQL 查询语句"
          parameters:
            type: array
            description: "查询参数"
          timeout:
            type: number
            description: "查询超时时间 (毫秒)"
            default: 30000

    - name: "insert"
      description: "插入数据"
      input:
        type: object
        properties:
          table:
            type: string
            description: "目标表名"
          data:
            type: array
            description: "要插入的数据"
          onConflict:
            type: object
            description: "冲突处理策略"

  example_workflow: "数据库同步流程"
  workflow_template:
    name: "数据库数据同步"
    description: "定期从源数据库同步数据到目标数据库"
    triggers:
      - type: "schedule"
        cron: "0 */6 * * *"  # 每6小时执行
    nodes:
      - id: "source_query"
        type: "postgresql_query"
        name: "查询源数据"
        config:
          connection: "source_db"
          sql: |
            SELECT * FROM users
            WHERE updated_at > (
              SELECT COALESCE(MAX(last_sync), '1970-01-01')
              FROM sync_metadata
              WHERE table_name = 'users'
            )
          parameters: []

      - id: "transform_data"
        type: "data_transform"
        name: "转换数据格式"
        config:
          mappings:
            - source: "full_name"
              target: "display_name"
              transform: "split_and_join"
              params: { separator: " ", joinWith: " " }
            - source: "birth_date"
              target: "age"
              transform: "calculate_age"
            - source: "country_code"
              target: "region"
              transform: "country_to_region"

      - id: "target_insert"
        type: "postgresql_insert"
        name: "插入目标数据库"
        config:
          connection: "target_db"
          table: "user_dimensions"
          data: "{{transform_data.output}}"
          onConflict:
            action: "update"
            conflictFields: ["user_id"]

      - id: "update_sync_metadata"
        type: "postgresql_query"
        name: "更新同步元数据"
        config:
          connection: "target_db"
          sql: "INSERT INTO sync_metadata (table_name, last_sync) VALUES (?, NOW()) ON CONFLICT (table_name) DO UPDATE SET last_sync = EXCLUDED.last_sync"
          parameters: ["users"]
  ```

**1.5.3.2.2 API集成示例**
- **REST API集成**：
  ```yaml
  integration:
    name: "REST API 集成"
    type: "api"
    description: "与 REST API 的通用集成示例"
    version: "1.0.0"

  configuration:
    baseUrl: "${API_BASE_URL}"
    timeout: "${API_TIMEOUT:-30000}"
    retries: "${API_RETRIES:-3}"
    authentication:
      type: "${API_AUTH_TYPE:-api_key}"  # api_key, oauth2, basic, jwt
      apiKey: "${API_KEY}"
      username: "${API_USERNAME}"
      password: "${API_PASSWORD}"
      tokenUrl: "${OAUTH_TOKEN_URL}"
      clientId: "${OAUTH_CLIENT_ID}"
      clientSecret: "${OAUTH_CLIENT_SECRET}"

  capabilities:
    - name: "http_request"
      description: "发送 HTTP 请求"
      input:
        type: object
        properties:
          method:
            type: string
            enum: ["GET", "POST", "PUT", "DELETE", "PATCH"]
          path:
            type: string
            description: "API 路径"
          headers:
            type: object
            description: "请求头"
          body:
            description: "请求体"
          query:
            type: object
            description: "查询参数"

    - name: "webhook_handler"
      description: "处理 Webhook 请求"
      input:
        type: object
        properties:
          path:
            type: string
            description: "Webhook 路径"
          method:
            type: string
            enum: ["POST", "PUT"]
          validation:
            type: object
            description: "请求验证配置"

  example_workflow: "API 数据同步"
  workflow_template:
    name: "API 数据同步工作流"
    description: "从第三方 API 获取数据并处理"
    triggers:
      - type: "webhook"
        path: "/webhooks/api-sync"
        method: "POST"
    nodes:
      - id: "parse_webhook"
        type: "json_parse"
        name: "解析 Webhook 数据"
        config:
          input: "{{webhook.body}}"

      - id: "validate_request"
        type: "data_validate"
        name: "验证请求数据"
        config:
          schema:
            type: object
            required: ["action", "data"]
            properties:
              action:
                type: string
                enum: ["sync", "update", "delete"]
              data:
                type: object

      - id: "api_request"
        type: "http_request"
        name: "调用目标 API"
        config:
          method: "POST"
          url: "{{integrations.target_api.baseUrl}}/sync"
          headers:
            "Content-Type": "application/json"
            "Authorization": "Bearer {{integrations.target_api.apiKey}}"
          body: "{{validate_request.output.data}}"

      - id: "handle_response"
        type: "condition_branch"
        name: "处理 API 响应"
        config:
          conditions:
            - expression: "{{api_request.output.status}} >= 200 and {{api_request.output.status}} < 300"
              nextNode: "process_success"
            - expression: "{{api_request.output.status}} >= 400 and {{api_request.output.status}} < 500"
              nextNode: "handle_client_error"
            - expression: "{{api_request.output.status}} >= 500"
              nextNode: "handle_server_error"

      - id: "process_success"
        type: "data_transform"
        name: "处理成功响应"
        config:
          input: "{{api_request.output.body}}"
          transformations:
            - type: "add_field"
              name: "sync_status"
              value: "success"
            - type: "add_field"
              name: "sync_time"
              value: "{{currentTimestamp()}}"

      - id: "send_notification"
        type: "email_send"
        name: "发送同步通知"
        config:
          to: "{{parse_webhook.output.notification_email}}"
          subject: "数据同步完成"
          template: "sync_completed"
          variables:
            recordCount: "{{process_success.output.count}}"
            syncTime: "{{process_success.output.sync_time}}"
  ```

**1.5.3.2.3 消息队列集成示例**
- **Apache Kafka集成**：
  ```yaml
  integration:
    name: "Apache Kafka 集成"
    type: "message_queue"
    description: "与 Apache Kafka 消息队列的集成示例"
    version: "1.0.0"

  configuration:
    brokers: "${KAFKA_BROKERS}"  # 逗号分隔的 broker 列表
    clientId: "${KAFKA_CLIENT_ID:-frys-integration}"
    groupId: "${KAFKA_GROUP_ID:-frys-group}"
    ssl:
      enabled: "${KAFKA_SSL_ENABLED:-false}"
      ca: "${KAFKA_SSL_CA}"
      cert: "${KAFKA_SSL_CERT}"
      key: "${KAFKA_SSL_KEY}"
    sasl:
      mechanism: "${KAFKA_SASL_MECHANISM}"
      username: "${KAFKA_SASL_USERNAME}"
      password: "${KAFKA_SASL_PASSWORD}"

  capabilities:
    - name: "publish_message"
      description: "发布消息到 Kafka 主题"
      input:
        type: object
        properties:
          topic:
            type: string
            description: "目标主题"
          key:
            description: "消息键"
          value:
            description: "消息值"
          headers:
            type: object
            description: "消息头"
          partition:
            type: number
            description: "指定分区"

    - name: "consume_messages"
      description: "从 Kafka 主题消费消息"
      input:
        type: object
        properties:
          topics:
            type: array
            items: { type: string }
            description: "要订阅的主题列表"
          fromBeginning:
            type: boolean
            description: "是否从头开始消费"
          autoCommit:
            type: boolean
            description: "是否自动提交偏移量"

  example_workflow: "实时数据处理管道"
  workflow_template:
    name: "Kafka 数据处理管道"
    description: "从 Kafka 消费数据，处理后发布到另一个主题"
    triggers:
      - type: "kafka_consumer"
        topics: ["user-events", "order-events"]
        groupId: "data-processing-group"
    nodes:
      - id: "parse_message"
        type: "json_parse"
        name: "解析消息内容"
        config:
          input: "{{kafka_message.value}}"

      - id: "enrich_data"
        type: "data_enrich"
        name: "数据丰富"
        config:
          enrichments:
            - type: "lookup"
              source: "user_profile"
              key: "{{parse_message.output.userId}}"
              fields: ["name", "email", "segment"]
            - type: "lookup"
              source: "product_catalog"
              key: "{{parse_message.output.productId}}"
              fields: ["category", "price"]

      - id: "apply_rules"
        type: "rule_engine"
        name: "应用业务规则"
        config:
          rules:
            - condition: "{{enrich_data.output.userSegment}} == 'premium'"
              actions:
                - type: "set_field"
                  field: "priority"
                  value: "high"
                - type: "set_field"
                  field: "sla_hours"
                  value: 2
            - condition: "{{parse_message.output.eventType}} == 'purchase'"
              actions:
                - type: "set_field"
                  field: "category"
                  value: "sales"
                - type: "calculate"
                  field: "revenue_impact"
                  expression: "{{enrich_data.output.price}} * {{parse_message.output.quantity}}"

      - id: "filter_messages"
        type: "condition_filter"
        name: "过滤消息"
        config:
          conditions:
            - "{{apply_rules.output.revenue_impact}} > 1000"
            - "{{parse_message.output.eventType}} in ['purchase', 'refund']"

      - id: "transform_output"
        type: "data_transform"
        name: "转换输出格式"
        config:
          outputFormat: "json"
          mappings:
            - source: "eventId"
              target: "id"
            - source: "eventType"
              target: "type"
            - source: "enrich_data.output"
              target: "context"
            - source: "apply_rules.output"
              target: "analysis"
            - source: "currentTimestamp()"
              target: "processed_at"

      - id: "publish_result"
        type: "kafka_publish"
        name: "发布处理结果"
        config:
          topic: "processed-events"
          key: "{{transform_output.output.id}}"
          value: "{{transform_output.output}}"
          headers:
            source: "frys-workflow"
            version: "1.0.0"

      - id: "handle_errors"
        type: "error_handler"
        name: "错误处理"
        config:
          onError: "log_and_continue"
          retry:
            count: 3
            delay: 1000
            backoff: "exponential"
          fallback:
            topic: "error-events"
            message: "{{error.message}}"
  ```

#### 验收标准
- ✅ 核心集成场景覆盖率>70%
- ✅ 集成示例功能完整可用
- ✅ 示例配置简单明了
- ✅ 错误处理和恢复机制完善

---

### 1.5.3.3 集成文档和测试平台 (2周)

#### 目标
构建集成示例的展示和测试平台。

#### 具体任务

**1.5.3.3.1 集成示例库**
- **示例浏览器**：
  ```typescript
  interface IntegrationExampleBrowserProps {
    category?: IntegrationCategory;
    searchQuery?: string;
    sortBy?: SortOption;
    onExampleSelect: (example: IntegrationExample) => void;
  }

  const IntegrationExampleBrowser: React.FC<IntegrationExampleBrowserProps> = ({
    category,
    searchQuery,
    sortBy = 'popularity',
    onExampleSelect
  }) => {
    const [examples, setExamples] = useState<IntegrationExample[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      loadExamples();
    }, [category, searchQuery, sortBy]);

    const loadExamples = async () => {
      setLoading(true);
      try {
        const result = await api.getIntegrationExamples({
          category,
          search: searchQuery,
          sort: sortBy,
          limit: 50
        });
        setExamples(result.examples);
      } catch (error) {
        console.error('Failed to load examples:', error);
      } finally {
        setLoading(false);
      }
    };

    return (
      <div className="container mx-auto px-4 py-8">
        {/* 搜索和过滤 */}
        <div className="mb-8">
          <div className="flex items-center space-x-4 mb-4">
            <Input
              placeholder="搜索集成示例..."
              value={searchQuery || ''}
              onChange={(value) => setSearchQuery(value)}
              className="flex-1 max-w-md"
            />
            <Select
              value={category || ''}
              onValueChange={(value) => setCategory(value as IntegrationCategory)}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="选择分类" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">全部</SelectItem>
                <SelectItem value="database">数据库</SelectItem>
                <SelectItem value="api">API</SelectItem>
                <SelectItem value="message_queue">消息队列</SelectItem>
                <SelectItem value="storage">存储</SelectItem>
                <SelectItem value="communication">通信</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 示例网格 */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {examples.map((example) => (
              <Card key={example.id} className="cursor-pointer hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg line-clamp-2">{example.name}</CardTitle>
                      <CardDescription className="mt-1 line-clamp-3">
                        {example.description}
                      </CardDescription>
                    </div>
                    <Badge variant="outline">{example.category}</Badge>
                  </div>
                </CardHeader>

                <CardContent>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                      <Badge variant="secondary" className="text-xs">
                        {example.difficulty}
                      </Badge>
                      <span className="text-sm text-gray-500">
                        {example.installs} 次安装
                      </span>
                    </div>
                    <div className="flex items-center text-sm text-gray-500">
                      <Clock className="w-4 h-4 mr-1" />
                      {example.setupTime}分钟
                    </div>
                  </div>

                  {/* 兼容的集成 */}
                  <div className="mb-4">
                    <div className="flex flex-wrap gap-1">
                      {example.integrations.slice(0, 3).map((integration) => (
                        <Badge key={integration} variant="outline" className="text-xs">
                          {integration}
                        </Badge>
                      ))}
                      {example.integrations.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{example.integrations.length - 3}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <Button
                    className="w-full"
                    onClick={() => onExampleSelect(example)}
                  >
                    查看详情
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  };
  ```

**1.5.3.3.2 在线测试环境**
- **交互式测试平台**：
  ```typescript
  class IntegrationTestEnvironment {
    private containers: Map<string, ContainerInstance> = new Map();
    private networks: Map<string, NetworkInstance> = new Map();

    async createTestEnvironment(example: IntegrationExample): Promise<TestEnvironment> {
      const environmentId = generateEnvironmentId();

      // 创建网络
      const network = await this.createNetwork(environmentId);

      // 启动 frys 容器
      const frysContainer = await this.startFrysContainer(environmentId, network);

      // 启动集成服务容器
      const integrationContainers = await this.startIntegrationContainers(example, environmentId, network);

      // 配置集成
      await this.configureIntegrations(example, frysContainer);

      // 部署示例工作流
      await this.deployExampleWorkflow(example, frysContainer);

      return {
        id: environmentId,
        frysUrl: `http://localhost:${frysContainer.port}`,
        status: 'running',
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2小时后过期
        containers: [frysContainer, ...integrationContainers]
      };
    }

    private async createNetwork(environmentId: string): Promise<NetworkInstance> {
      const networkName = `test_${environmentId}`;

      await execAsync(`docker network create ${networkName}`);

      const network: NetworkInstance = {
        id: networkName,
        name: networkName,
        driver: 'bridge'
      };

      this.networks.set(environmentId, network);
      return network;
    }

    private async startFrysContainer(environmentId: string, network: NetworkInstance): Promise<ContainerInstance> {
      const containerName = `frys_${environmentId}`;
      const port = await this.findAvailablePort(3000, 4000);

      await execAsync(`
        docker run -d
        --name ${containerName}
        --network ${network.name}
        -p ${port}:3000
        -e NODE_ENV=test
        -e TEST_ENVIRONMENT=true
        frys/test:latest
      `);

      // 等待服务启动
      await this.waitForService(`http://localhost:${port}/health`, 60000);

      return {
        id: containerName,
        name: containerName,
        image: 'frys/test:latest',
        port,
        status: 'running'
      };
    }

    private async startIntegrationContainers(
      example: IntegrationExample,
      environmentId: string,
      network: NetworkInstance
    ): Promise<ContainerInstance[]> {
      const containers: ContainerInstance[] = [];

      for (const integration of example.integrations) {
        const container = await this.startIntegrationContainer(integration, environmentId, network);
        containers.push(container);
      }

      return containers;
    }

    private async startIntegrationContainer(
      integration: string,
      environmentId: string,
      network: NetworkInstance
    ): Promise<ContainerInstance> {
      const containerName = `${integration}_${environmentId}`;
      const config = this.getIntegrationContainerConfig(integration);

      await execAsync(`
        docker run -d
        --name ${containerName}
        --network ${network.name}
        ${config.ports ? config.ports.map(p => `-p ${p}`).join(' ') : ''}
        ${config.environment ? config.environment.map(e => `-e ${e}`).join(' ') : ''}
        ${config.image}
      `);

      // 等待服务启动
      if (config.healthCheck) {
        await this.waitForService(config.healthCheck, 60000);
      }

      return {
        id: containerName,
        name: containerName,
        image: config.image,
        port: config.ports?.[0]?.split(':')?.[0],
        status: 'running'
      };
    }

    async runTestScenario(environment: TestEnvironment, scenario: TestScenario): Promise<TestResult> {
      const frysClient = new FrysClient(environment.frysUrl);

      try {
        // 执行测试步骤
        for (const step of scenario.steps) {
          await this.executeTestStep(step, frysClient);
        }

        // 验证结果
        const validationResults = await this.validateTestResults(scenario, frysClient);

        return {
          success: validationResults.every(r => r.passed),
          duration: Date.now() - Date.now(), // 计算执行时间
          steps: scenario.steps.length,
          validations: validationResults
        };

      } catch (error) {
        return {
          success: false,
          error: error.message,
          duration: Date.now() - Date.now(),
          steps: scenario.steps.length
        };
      }
    }

    async cleanupEnvironment(environmentId: string): Promise<void> {
      // 停止并删除容器
      const containers = await this.getEnvironmentContainers(environmentId);
      for (const container of containers) {
        await execAsync(`docker stop ${container.id}`);
        await execAsync(`docker rm ${container.id}`);
      }

      // 删除网络
      const network = this.networks.get(environmentId);
      if (network) {
        await execAsync(`docker network rm ${network.name}`);
        this.networks.delete(environmentId);
      }
    }
  }
  ```

**1.5.3.3.3 集成监控和分析**
- **使用情况统计**：
  ```typescript
  class IntegrationAnalytics {
    private usageStore: UsageDataStore;

    async trackIntegrationUsage(integrationId: string, event: IntegrationUsageEvent): Promise<void> {
      const usageRecord = {
        integrationId,
        eventType: event.type,
        timestamp: new Date(),
        userId: event.userId,
        workflowId: event.workflowId,
        metadata: event.metadata,
        duration: event.duration,
        success: event.success,
        error: event.error
      };

      await this.usageStore.save(usageRecord);

      // 实时更新统计
      await this.updateIntegrationStats(integrationId, usageRecord);
    }

    async getIntegrationStats(integrationId: string, timeRange: TimeRange): Promise<IntegrationStats> {
      const usages = await this.usageStore.getUsages(integrationId, timeRange);

      return {
        totalUsages: usages.length,
        successfulUsages: usages.filter(u => u.success).length,
        failedUsages: usages.filter(u => !u.success).length,
        averageDuration: this.calculateAverageDuration(usages),
        errorRate: usages.filter(u => !u.success).length / usages.length,
        usageByWorkflow: this.groupByWorkflow(usages),
        usageByUser: this.groupByUser(usages),
        usageTrend: this.calculateUsageTrend(usages, timeRange),
        topErrors: this.getTopErrors(usages)
      };
    }

    async getIntegrationHealth(integrationId: string): Promise<IntegrationHealth> {
      const recentUsages = await this.usageStore.getUsages(integrationId, {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000), // 过去24小时
        end: new Date()
      });

      const totalRequests = recentUsages.length;
      const failedRequests = recentUsages.filter(u => !u.success).length;
      const averageResponseTime = this.calculateAverageDuration(recentUsages.filter(u => u.success));

      // 计算健康分数 (0-100)
      let healthScore = 100;

      // 失败率影响健康分数
      const failureRate = failedRequests / totalRequests;
      healthScore -= failureRate * 50;

      // 响应时间影响健康分数
      if (averageResponseTime > 5000) {
        healthScore -= 20;
      } else if (averageResponseTime > 1000) {
        healthScore -= 10;
      }

      return {
        score: Math.max(0, healthScore),
        status: this.getHealthStatus(healthScore),
        metrics: {
          totalRequests,
          failedRequests,
          averageResponseTime,
          uptime: this.calculateUptime(recentUsages)
        },
        issues: await this.identifyHealthIssues(recentUsages)
      };
    }

    private getHealthStatus(score: number): HealthStatus {
      if (score >= 90) return 'excellent';
      if (score >= 70) return 'good';
      if (score >= 50) return 'fair';
      if (score >= 25) return 'poor';
      return 'critical';
    }

    private async identifyHealthIssues(usages: UsageRecord[]): Promise<HealthIssue[]> {
      const issues: HealthIssue[] = [];

      // 检查错误模式
      const errorGroups = this.groupErrorsByType(usages);
      for (const [errorType, count] of errorGroups) {
        if (count > usages.length * 0.1) { // 超过10%的请求失败
          issues.push({
            type: 'high_error_rate',
            severity: 'high',
            description: `错误类型 "${errorType}" 的失败率过高`,
            count,
            percentage: (count / usages.length) * 100
          });
        }
      }

      // 检查响应时间
      const slowRequests = usages.filter(u => u.duration && u.duration > 10000);
      if (slowRequests.length > usages.length * 0.05) {
        issues.push({
          type: 'slow_response',
          severity: 'medium',
          description: '响应时间过长的请求过多',
          count: slowRequests.length,
          percentage: (slowRequests.length / usages.length) * 100
        });
      }

      return issues;
    }
  }
  ```

#### 验收标准
- ✅ 集成示例库功能完善
- ✅ 在线测试环境稳定可用
- ✅ 集成监控数据准确
- ✅ 用户反馈收集有效

---

## 🔧 技术实现方案

### 架构设计

#### 集成示例平台架构
```
集成适配器注册表 → 适配器工厂 → 适配器实例 → 集成服务
    ↓              ↓            ↓          ↓
配置管理器 → 模板生成器 → 示例库 → 测试环境管理器
```

#### 核心组件设计

```typescript
// 集成管理器接口
interface IntegrationManager {
  registerAdapter(adapter: IntegrationAdapter): void;
  getAdapter(type: string): IntegrationAdapter;
  listAdapters(): IntegrationAdapter[];
  testConnection(integrationId: string): Promise<ConnectionTestResult>;
  executeIntegration(integrationId: string, action: string, params: any): Promise<ExecutionResult>;
}

// 示例管理器接口
interface ExampleManager {
  createExample(example: CreateExampleRequest): Promise<IntegrationExample>;
  updateExample(id: string, updates: UpdateExampleRequest): Promise<IntegrationExample>;
  deleteExample(id: string): Promise<void>;
  getExample(id: string): Promise<IntegrationExample>;
  listExamples(filter?: ExampleFilter): Promise<IntegrationExample[]>;
  deployExample(exampleId: string, environment: TestEnvironment): Promise<DeploymentResult>;
}

// 测试环境管理器接口
interface TestEnvironmentManager {
  createEnvironment(example: IntegrationExample): Promise<TestEnvironment>;
  getEnvironment(id: string): Promise<TestEnvironment>;
  listEnvironments(filter?: EnvironmentFilter): Promise<TestEnvironment[]>;
  runTestScenario(environmentId: string, scenario: TestScenario): Promise<TestResult>;
  cleanupEnvironment(id: string): Promise<void>;
}
```

### 集成适配器开发框架

#### 适配器开发模板
```typescript
abstract class BaseIntegrationAdapter implements IntegrationAdapter {
  abstract readonly name: string;
  abstract readonly version: string;
  abstract readonly type: IntegrationType;
  abstract readonly capabilities: IntegrationCapability[];

  protected config: IntegrationConfig;
  protected client: any; // 第三方服务的客户端实例

  async initialize(config: IntegrationConfig): Promise<void> {
    this.config = config;
    await this.setupClient(config);
  }

  async validateConfig(config: IntegrationConfig): Promise<ValidationResult> {
    const errors: ValidationError[] = [];

    // 验证必需字段
    const requiredFields = this.getRequiredFields();
    for (const field of requiredFields) {
      if (!this.getNestedValue(config, field)) {
        errors.push({
          field,
          message: `字段 "${field}" 是必需的`
        });
      }
    }

    // 验证字段格式
    const formatErrors = await this.validateFieldFormats(config);
    errors.push(...formatErrors);

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  async testConnection(config: IntegrationConfig): Promise<ConnectionTestResult> {
    const startTime = Date.now();

    try {
      // 执行连接测试
      await this.performConnectionTest(config);

      return {
        success: true,
        responseTime: Date.now() - startTime,
        message: '连接测试成功'
      };
    } catch (error) {
      return {
        success: false,
        responseTime: Date.now() - startTime,
        error: error.message
      };
    }
  }

  async executeAction(action: string, params: any): Promise<ExecutionResult> {
    const capability = this.capabilities.find(cap => cap.name === action);
    if (!capability) {
      throw new Error(`不支持的操作: ${action}`);
    }

    // 验证输入参数
    const validation = await this.validateActionInput(action, params, capability.inputSchema);
    if (!validation.isValid) {
      throw new ValidationError('输入参数验证失败', validation.errors);
    }

    try {
      // 执行操作
      const result = await this.performAction(action, params);

      // 验证输出
      const outputValidation = await this.validateActionOutput(result, capability.outputSchema);

      return {
        success: true,
        data: result,
        metadata: {
          action,
          executionTime: Date.now(),
          inputValidation: validation,
          outputValidation
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        metadata: {
          action,
          executionTime: Date.now()
        }
      };
    }
  }

  // 抽象方法，由具体适配器实现
  protected abstract setupClient(config: IntegrationConfig): Promise<void>;
  protected abstract getRequiredFields(): string[];
  protected abstract validateFieldFormats(config: IntegrationConfig): Promise<ValidationError[]>;
  protected abstract performConnectionTest(config: IntegrationConfig): Promise<void>;
  protected abstract performAction(action: string, params: any): Promise<any>;

  // 工具方法
  protected getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  protected async validateActionInput(action: string, params: any, schema: JSONSchema): Promise<ValidationResult> {
    // 使用 JSON Schema 验证器验证输入
    const validator = new SchemaValidator(schema);
    return validator.validate(params);
  }
}
```

---

## 📅 时间安排

### Week 1-2: 集成框架设计
- 集成适配器架构设计和实现
- 集成配置管理系统开发
- 集成模板系统构建
- 基础测试和验证

### Week 3-6: 核心集成示例开发
- 数据库集成示例开发
- API集成示例实现
- 消息队列集成示例构建
- 其他集成示例扩展

### Week 7-8: 集成文档和测试平台
- 集成示例库平台开发
- 在线测试环境实现
- 集成监控和分析系统
- 完整集成测试和优化

---

## 🎯 验收标准

### 功能验收
- [ ] 集成框架完整可扩展
- [ ] 核心集成示例功能完整
- [ ] 测试平台稳定可用
- [ ] 文档和示例完善

### 性能验收
- [ ] 集成响应时间<2秒
- [ ] 测试环境启动时间<5分钟
- [ ] 并发测试支持>50用户
- [ ] 资源使用控制合理

### 质量验收
- [ ] 集成成功率>95%
- [ ] 示例代码可运行性>98%
- [ ] 错误处理覆盖率>90%
- [ ] 安全漏洞扫描通过

### 用户验收
- [ ] 集成配置时间<10分钟
- [ ] 用户满意度>4.5/5
- [ ] 学习曲线<30分钟
- [ ] 支持请求减少>50%

---

## 🔍 风险评估与应对

### 技术风险

**1. 第三方服务兼容性问题**
- **风险等级**：高
- **影响**：集成无法正常工作，用户体验差
- **应对策略**：
  - 建立兼容性测试矩阵
  - 实施版本管理和兼容性检查
  - 提供降级和备用方案
  - 持续监控和更新适配器

**2. 集成安全风险**
- **风险等级**：高
- **影响**：敏感数据泄露或安全漏洞
- **应对策略**：
  - 实施严格的安全审查流程
  - 使用加密存储敏感配置
  - 定期安全审计和渗透测试
  - 提供安全最佳实践指南

**3. 性能和稳定性问题**
- **风险等级**：中
- **影响**：集成响应慢或不稳定
- **应对策略**：
  - 实施性能监控和告警
  - 建立连接池和重试机制
  - 提供熔断和降级功能
  - 定期性能测试和优化

### 业务风险

**1. 集成需求多样化**
- **风险等级**：中
- **影响**：无法满足所有用户需求
- **应对策略**：
  - 优先支持主流集成服务
  - 建立用户需求收集机制
  - 提供自定义集成开发框架
  - 社区贡献和扩展机制

**2. 第三方服务变化**
- **风险等级**：中
- **影响**：集成因API变化而失效
- **应对策略**：
  - 监控第三方服务变更
  - 建立适配器更新机制
  - 提供向后兼容性保证
  - 及时响应和修复问题

---

## 👥 团队配置

### 核心团队 (5人)
- **后端工程师**：2人 (适配器开发，集成服务)
- **前端工程师**：1人 (测试平台界面)
- **DevOps工程师**：1人 (环境管理，部署)
- **产品经理**：1人 (需求分析，产品规划)

### 外部支持
- **安全专家**：集成安全评估和审查
- **集成专家**：第三方服务集成咨询
- **测试工程师**：集成测试和验证

---

## 💰 预算规划

### 人力成本 (8周)
- 后端工程师：2人 × ¥28,000/月 × 2个月 = ¥112,000
- 前端工程师：1人 × ¥25,000/月 × 2个月 = ¥50,000
- DevOps工程师：1人 × ¥28,000/月 × 2个月 = ¥56,000
- 产品经理：1人 × ¥22,000/月 × 2个月 = ¥44,000
- **人力小计**：¥262,000

### 技术成本
- 云服务资源：¥100,000 (测试环境，第三方服务)
- 开发工具：¥30,000 (集成开发工具，测试环境)
- 第三方服务：¥50,000 (API访问，服务集成)
- 监控工具：¥25,000 (集成监控，分析工具)
- **技术小计**：¥205,000

### 其他成本
- 内容制作：¥20,000 (集成文档，示例代码)
- 安全评估：¥15,000 (安全审计，渗透测试)
- 法律合规：¥10,000 (API使用协议，合规检查)
- **其他小计**：¥45,000

### 总预算：¥512,000

---

## 📈 关键指标

### 功能完整性指标
- **集成覆盖率**：主流第三方服务集成覆盖>70%
- **示例完整性**：每个集成提供完整的使用示例
- **文档准确性**：集成文档准确率>98%
- **测试覆盖率**：集成测试覆盖率>90%

### 性能稳定性指标
- **集成响应**：平均集成响应时间<2秒，95分位<5秒
- **成功率**：集成调用成功率>95%
- **稳定性**：集成服务正常运行时间>99.5%
- **扩展性**：支持同时运行集成实例>1000个

### 用户体验指标
- **易用性**：配置和使用集成的时间<10分钟
- **可靠性**：集成工作正常率>95%
- **学习成本**：掌握集成使用的时间<30分钟
- **满意度**：用户对集成功能的满意度>4.5/5

### 业务价值指标
- **用户增长**：集成功能带来的用户增长>25%
- **功能使用**：活跃用户使用集成功能的比例>40%
- **效率提升**：用户完成自动化流程的时间减少>60%
- **ROI达成**：集成开发投资回报期<8个月

---

## 🎯 后续规划

### Phase 1.5.4 衔接
- 基于集成示例，收集用户反馈
- 利用测试平台数据，完善社区互动
- 通过集成监控，优化用户支持流程

### 持续优化计划
1. **集成扩展**：支持更多第三方服务和自定义集成
2. **智能化配置**：AI辅助的集成配置和优化建议
3. **性能优化**：集成性能监控和自动优化
4. **生态建设**：建立集成开发者和贡献者社区

### 长期演进
- **企业集成**：支持复杂的企业级集成场景
- **实时集成**：毫秒级实时数据集成和处理
- **AI增强**：AI驱动的智能集成和自动化决策
- **行业解决方案**：针对特定行业的完整集成解决方案

这个详尽的第三方集成示例规划，将为frys工作流系统提供强大的集成能力和丰富的即插即用解决方案，显著提升产品的实用价值和市场竞争力。
