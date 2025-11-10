/**
 * 高级工作流算法引擎 - 基于GitHub Actions设计理念
 *
 * 实现智能的工作流调度算法，包括：
 * - 事件驱动触发器系统
 * - 条件执行和依赖关系管理
 * - 矩阵构建和并发控制
 * - 缓存优化和状态机管理
 * - 自适应执行策略
 */

export const ADVANCED_WORKFLOW_ENGINE = {
  name: "advanced-workflow-engine",
  version: "2.0.0",
  description: "基于GitHub Actions理念的高级工作流算法引擎",

  // 事件驱动触发器配置 (GitHub Actions风格)
  triggers: {
    push: {
      branches: ["main", "develop"],
      paths: ["src/**", "tests/**", "package.json"]
    },
    pull_request: {
      types: ["opened", "synchronize", "reopened"],
      branches: ["main", "develop"]
    },
    schedule: ["0 2 * * 1"], // 每周一凌晨2点
    workflow_dispatch: {
      inputs: {
        environment: {
          description: "部署环境",
          required: true,
          default: "staging",
          options: ["staging", "production"]
        },
        skip_tests: {
          description: "跳过测试",
          required: false,
          type: "boolean"
        }
      }
    }
  },

  // 环境配置
  env: {
    NODE_ENV: "production",
    CI: "true",
    CACHE_VERSION: "v2"
  },

  // 并发控制 (GitHub Actions风格)
  concurrency: {
    group: "${{ github.workflow }}-${{ github.ref }}",
    cancel_in_progress: true
  },

  // 作业定义 (Jobs - GitHub Actions核心概念)
  jobs: {
    // 环境检测和准备作业
    "env-check": {
      name: "环境检测",
      runs_on: ["ubuntu-latest", "windows-latest"],
      if: "github.event_name != 'schedule'",
      outputs: {
        node_version: "${{ steps.setup-node.outputs.node-version }}",
        cache_hit: "${{ steps.cache-deps.outputs.cache-hit }}"
      },
      steps: [
        {
          name: "Checkout code",
          uses: "actions/checkout@v4",
          with: {
            fetch_depth: 2
          }
        },
        {
          name: "Setup Node.js",
          id: "setup-node",
          uses: "actions/setup-node@v4",
          with: {
            node_version: "18",
            cache: "pnpm"
          }
        },
        {
          name: "Cache dependencies",
          id: "cache-deps",
          uses: "actions/cache@v3",
          with: {
            path: "node_modules\n.pnpm-store",
            key: "${{ runner.os }}-pnpm-${{ hashFiles('**/pnpm-lock.yaml') }}",
            restore_keys: "${{ runner.os }}-pnpm-"
          }
        },
        {
          name: "Install dependencies",
          run: "pnpm install --frozen-lockfile"
        },
        {
          name: "Environment validation",
          run: "node scripts/env-check.js"
        }
      ]
    },

    // 本地验证作业
    "local-validation": {
      name: "本地验证",
      runs_on: "ubuntu-latest",
      needs: "env-check",
      if: "needs.env-check.result == 'success'",
      timeout_minutes: 10,
      strategy: {
        matrix: {
          node: ["16", "18", "20"]
        }
      },
      steps: [
        {
          name: "Checkout code",
          uses: "actions/checkout@v4"
        },
        {
          name: "Setup Node.js ${{ matrix.node }}",
          uses: "actions/setup-node@v4",
          with: {
            node_version: "${{ matrix.node }}",
            cache: "pnpm"
          }
        },
        {
          name: "Install dependencies",
          run: "pnpm install --frozen-lockfile"
        },
        {
          name: "Build",
          run: "npm run build"
        },
        {
          name: "Lint",
          run: "npm run lint"
        },
        {
          name: "Format check",
          run: "npm run format:check"
        },
        {
          name: "Unit tests",
          run: "npm run test:unit"
        }
      ]
    },

    // 自动化测试作业 (支持矩阵构建)
    "test": {
      name: "自动化测试",
      runs_on: "ubuntu-latest",
      needs: ["env-check", "local-validation"],
      if: "needs.env-check.result == 'success' && !inputs.skip_tests",
      timeout_minutes: 30,
      strategy: {
        matrix: {
          test_type: ["unit", "integration", "e2e"],
          database: ["sqlite", "postgres"]
        },
        fail_fast: false
      },
      services: {
        postgres: {
          image: "postgres:15",
          env: {
            POSTGRES_PASSWORD: "password"
          },
          options: "--health-cmd pg_isready --health-interval 10s --health-timeout 5s --health-retries 5"
        }
      },
      steps: [
        {
          name: "Checkout code",
          uses: "actions/checkout@v4"
        },
        {
          name: "Setup Node.js",
          uses: "actions/setup-node@v4",
          with: {
            node_version: "18",
            cache: "pnpm"
          }
        },
        {
          name: "Install dependencies",
          run: "pnpm install --frozen-lockfile"
        },
        {
          name: "Setup test database",
          run: "npm run test:setup-db -- --db=${{ matrix.database }}"
        },
        {
          name: "Run ${{ matrix.test_type }} tests",
          run: "npm run test:${{ matrix.test_type }}",
          env: {
            DATABASE_URL: "${{ matrix.database == 'postgres' && 'postgresql://postgres:password@localhost:5432/test' || 'sqlite:test.db' }}"
          }
        },
        {
          name: "Upload coverage",
          if: "matrix.test_type == 'unit'",
          uses: "codecov/codecov-action@v3",
          with: {
            file: "./coverage/lcov.info"
          }
        }
      ]
    },

    // 安全和质量检查作业
    "security-quality": {
      name: "安全与质量检查",
      runs_on: "ubuntu-latest",
      needs: "env-check",
      if: "needs.env-check.result == 'success'",
      timeout_minutes: 15,
      steps: [
        {
          name: "Checkout code",
          uses: "actions/checkout@v4"
        },
        {
          name: "Setup Node.js",
          uses: "actions/setup-node@v4",
          with: {
            node_version: "18",
            cache: "pnpm"
          }
        },
        {
          name: "Install dependencies",
          run: "pnpm install --frozen-lockfile"
        },
        {
          name: "Security audit",
          run: "npm run security:audit",
          continue_on_error: true
        },
        {
          name: "Code quality check",
          run: "npm run quality:check"
        },
        {
          name: "SonarQube analysis",
          uses: "sonarsource/sonarqube-scan-action@v2",
          env: {
            SONAR_TOKEN: "${{ secrets.SONAR_TOKEN }}"
          }
        }
      ]
    },

    // 性能测试作业
    "performance": {
      name: "性能测试",
      runs_on: "ubuntu-latest",
      needs: ["env-check", "test"],
      if: "needs.test.result == 'success'",
      timeout_minutes: 20,
      steps: [
        {
          name: "Checkout code",
          uses: "actions/checkout@v4"
        },
        {
          name: "Setup Node.js",
          uses: "actions/setup-node@v4",
          with: {
            node_version: "18",
            cache: "pnpm"
          }
        },
        {
          name: "Install dependencies",
          run: "pnpm install --frozen-lockfile"
        },
        {
          name: "Build for performance",
          run: "npm run build:prod"
        },
        {
          name: "Performance tests",
          run: "npm run test:performance"
        },
        {
          name: "Load testing",
          run: "npm run test:load",
          timeout_minutes: 10
        }
      ]
    },

    // 部署准备作业
    "deploy-prep": {
      name: "部署准备",
      runs_on: "ubuntu-latest",
      needs: ["test", "security-quality", "performance"],
      if: "needs.test.result == 'success' && needs.security-quality.result != 'failure'",
      environment: "staging",
      outputs: {
        deploy_version: "${{ steps.version.outputs.version }}",
        artifact_path: "${{ steps.build.outputs.artifact_path }}"
      },
      steps: [
        {
          name: "Checkout code",
          uses: "actions/checkout@v4",
          with: {
            fetch_depth: 0
          }
        },
        {
          name: "Generate version",
          id: "version",
          run: "echo \"version=$(npm run version:patch --silent)\" >> $GITHUB_OUTPUT"
        },
        {
          name: "Build artifacts",
          id: "build",
          run: "npm run build:prod && echo \"artifact_path=$(pwd)/dist\" >> $GITHUB_OUTPUT"
        },
        {
          name: "Create deployment package",
          run: "npm run package:deploy"
        },
        {
          name: "Upload artifacts",
          uses: "actions/upload-artifact@v3",
          with: {
            name: "deployment-package-${{ steps.version.outputs.version }}",
            path: "dist/"
          }
        }
      ]
    },

    // Staging部署作业
    "deploy-staging": {
      name: "部署到Staging",
      runs_on: "ubuntu-latest",
      needs: "deploy-prep",
      if: "needs.deploy-prep.result == 'success' && (github.ref == 'refs/heads/develop' || github.event.inputs.environment == 'staging')",
      environment: "staging",
      timeout_minutes: 30,
      steps: [
        {
          name: "Download artifacts",
          uses: "actions/download-artifact@v3",
          with: {
            name: "deployment-package-${{ needs.deploy-prep.outputs.deploy_version }}"
          }
        },
        {
          name: "Deploy to staging",
          run: "npm run deploy:staging",
          env: {
            DEPLOY_ENV: "staging",
            DEPLOY_VERSION: "${{ needs.deploy-prep.outputs.deploy_version }}"
          }
        },
        {
          name: "Health check",
          run: "npm run verify:staging"
        },
        {
          name: "Integration tests on staging",
          run: "npm run test:staging:e2e"
        }
      ]
    },

    // 生产部署作业 (需要人工批准)
    "deploy-production": {
      name: "部署到生产环境",
      runs_on: "ubuntu-latest",
      needs: ["deploy-staging", "security-quality"],
      if: "needs.deploy-staging.result == 'success' && github.ref == 'refs/heads/main' && github.event.inputs.environment == 'production'",
      environment: "production",
      timeout_minutes: 45,
      steps: [
        {
          name: "Download artifacts",
          uses: "actions/download-artifact@v3",
          with: {
            name: "deployment-package-${{ needs.deploy-prep.outputs.deploy_version }}"
          }
        },
        {
          name: "Deploy to production",
          run: "npm run deploy:production",
          env: {
            DEPLOY_ENV: "production",
            DEPLOY_VERSION: "${{ needs.deploy-prep.outputs.deploy_version }}"
          }
        },
        {
          name: "Production health check",
          run: "npm run verify:production"
        },
        {
          name: "Smoke tests",
          run: "npm run test:smoke:production"
        },
        {
          name: "Performance regression check",
          run: "npm run perf:regression:check"
        }
      ]
    },

    // 监控和回滚作业
    "monitoring-rollback": {
      name: "监控与回滚准备",
      runs_on: "ubuntu-latest",
      needs: "deploy-production",
      if: "always() && needs.deploy-production.result == 'success'",
      steps: [
        {
          name: "Setup monitoring",
          run: "npm run monitoring:setup",
          env: {
            DEPLOY_VERSION: "${{ needs.deploy-prep.outputs.deploy_version }}"
          }
        },
        {
          name: "SLO validation",
          run: "npm run slo:validate"
        },
        {
          name: "Setup rollback plan",
          run: "npm run rollback:prepare",
          if: "needs.deploy-production.result == 'success'"
        },
        {
          name: "Alert configuration",
          run: "npm run alerts:configure"
        }
      ]
    }
  },

  // 工作流算法配置 (核心调度算法)
  algorithm: {
    // 状态机定义
    stateMachine: {
      states: {
        pending: { on: { START: 'running' } },
        running: { on: { SUCCESS: 'completed', FAILURE: 'failed', CANCEL: 'cancelled' } },
        completed: { type: 'final' },
        failed: { on: { RETRY: 'running' } },
        cancelled: { type: 'final' }
      },
      initial: 'pending'
    },

    // 调度策略
    scheduling: {
      // 依赖图分析算法
      dependencyGraph: {
        algorithm: 'topological_sort',
        cycleDetection: true,
        parallelExecution: true
      },

      // 资源分配算法
      resourceAllocation: {
        strategy: 'fair_share',
        maxConcurrency: 4,
        resourcePools: {
          cpu: { limit: 8, priority: 'high' },
          memory: { limit: 16, unit: 'GB' },
          network: { bandwidth: '1Gbps' }
        }
      },

      // 优先级调度
      priorityScheduling: {
        algorithm: 'weighted_fair_queueing',
        weights: {
          critical: 4,
          high: 2,
          medium: 1,
          low: 0.5
        }
      }
    },

    // 智能重试算法
    retryAlgorithm: {
      strategy: 'exponential_backoff',
      baseDelay: 1000, // 1秒
      maxDelay: 300000, // 5分钟
      jitter: true,
      maxRetries: 3,
      retryableErrors: [
        'ECONNRESET',
        'ETIMEDOUT',
        'ENOTFOUND',
        'temporary_failure'
      ]
    },

    // 缓存优化算法
    caching: {
      strategy: 'adaptive_lru',
      layers: {
        memory: { size: 100, ttl: 300000 },
        disk: { size: 1000, ttl: 3600000 },
        remote: { provider: 'redis', ttl: 86400000 }
      },
      invalidationStrategy: 'write_through',
      compression: 'gzip'
    },

    // 自适应执行算法
    adaptiveExecution: {
      learningRate: 0.1,
      feedbackLoop: {
        metrics: ['duration', 'success_rate', 'resource_usage'],
        adjustmentFactors: ['concurrency', 'timeout', 'retry_count']
      },
      optimizationGoals: {
        minimize: ['duration', 'cost'],
        maximize: ['success_rate', 'throughput']
      }
    }
  },

  // 质量门禁和验证规则
  qualityGates: {
    // 测试质量门禁
    testing: {
      unitTestCoverage: 85,
      integrationTestCoverage: 80,
      e2eTestCoverage: 70,
      mutationScore: 75,
      flakyTestThreshold: 5 // 允许的测试波动率%
    },

    // 安全质量门禁
    security: {
      vulnerabilitySeverity: 'medium', // 允许的最大漏洞严重程度
      dependencyAudit: true,
      secretScanning: true,
      codeQLAlerts: 0 // 允许的代码扫描告警数量
    },

    // 性能质量门禁
    performance: {
      responseTimeBudget: 200, // ms
      throughputTarget: 1000, // req/sec
      memoryLeakThreshold: 10, // MB
      cpuUsageThreshold: 80 // %
    },

    // 代码质量门禁
    codeQuality: {
      complexityThreshold: 10,
      duplicationThreshold: 3, // %
      maintainabilityIndex: 70,
      technicalDebtRatio: 5 // %
    }
  },

  // 监控和可观测性
  observability: {
    metrics: {
      collection: {
        interval: 30000, // 30秒
        exporters: ['prometheus', 'datadog', 'cloudwatch']
      },
      alerts: {
        failureRate: { threshold: 5, window: 300000 }, // 5分钟内失败率 > 5%
        durationIncrease: { threshold: 50, window: 3600000 }, // 1小时内持续时间增加 > 50%
        resourceExhaustion: { threshold: 90, resource: 'cpu' } // CPU使用率 > 90%
      }
    },

    tracing: {
      sampling: {
        rate: 0.1, // 10%采样率
        adaptive: true
      },
      exporters: ['jaeger', 'zipkin']
    },

    logging: {
      level: 'info',
      structured: true,
      correlationId: true
    }
  },

  // 回滚和恢复策略
  rollbackStrategy: {
    automatic: {
      triggers: {
        errorRate: 10, // 错误率 > 10%
        responseTime: 5000, // 响应时间 > 5秒
        availability: 95 // 可用性 < 95%
      },
      cooldown: 300000 // 5分钟冷却时间
    },

    manual: {
      approvalRequired: true,
      approvers: ['team_lead', 'devops_engineer']
    },

    recovery: {
      strategy: 'blue_green', // blue_green, canary, rolling
      phases: ['rollback', 'verify', 'monitor', 'complete']
    }
  }
};

/**
 * 高级工作流调度算法引擎
 * 基于GitHub Actions的调度理念，实现智能的工作流执行
 */
export class AdvancedWorkflowScheduler {
  constructor(config = ADVANCED_WORKFLOW_ENGINE) {
    this.config = config;
    this.stateMachine = this.createStateMachine();
    this.dependencyGraph = new Map();
    this.executionQueue = [];
    this.runningJobs = new Map();
    this.completedJobs = new Set();
    this.failedJobs = new Set();
  }

  /**
   * 创建状态机
   */
  createStateMachine() {
    const states = this.config.algorithm.stateMachine.states;

    return {
      current: states.initial,
      transition: (event) => {
        const currentState = states[this.current];
        if (currentState.on && currentState.on[event]) {
          this.current = currentState.on[event];
          return true;
        }
        return false;
      },
      isFinal: () => states[this.current].type === 'final'
    };
  }

  /**
   * 构建依赖图
   */
  buildDependencyGraph() {
    const jobs = this.config.jobs;

    for (const [jobId, job] of Object.entries(jobs)) {
      this.dependencyGraph.set(jobId, {
        job,
        dependencies: job.needs || [],
        dependents: []
      });
    }

    // 建立反向依赖关系
    for (const [jobId, node] of this.dependencyGraph) {
      for (const dep of node.dependencies) {
        if (this.dependencyGraph.has(dep)) {
          this.dependencyGraph.get(dep).dependents.push(jobId);
        }
      }
    }
  }

  /**
   * 拓扑排序算法 - 计算执行顺序
   */
  topologicalSort() {
    const visited = new Set();
    const tempVisited = new Set();
    const order = [];

    const visit = (jobId) => {
      if (tempVisited.has(jobId)) {
        throw new Error(`循环依赖检测: ${jobId}`);
      }
      if (visited.has(jobId)) {
        return;
      }

      tempVisited.add(jobId);

      const node = this.dependencyGraph.get(jobId);
      for (const dep of node.dependencies) {
        visit(dep);
      }

      tempVisited.delete(jobId);
      visited.add(jobId);
      order.push(jobId);
    };

    for (const jobId of this.dependencyGraph.keys()) {
      if (!visited.has(jobId)) {
        visit(jobId);
      }
    }

    return order;
  }

  /**
   * 智能调度算法
   */
  async scheduleWorkflow(trigger, inputs = {}) {
    this.buildDependencyGraph();
    const executionOrder = this.topologicalSort();

    console.log('📋 执行顺序:', executionOrder);

    // 初始化执行队列
    this.executionQueue = executionOrder.filter(jobId => {
      const job = this.config.jobs[jobId];
      return this.evaluateConditions(job.if || 'true', { trigger, inputs });
    });

    // 并行执行算法
    const maxConcurrency = this.config.algorithm.scheduling.resourceAllocation.maxConcurrency;
    const running = new Set();

    while (this.executionQueue.length > 0 || running.size > 0) {
      // 启动新的作业
      while (running.size < maxConcurrency && this.executionQueue.length > 0) {
        const jobId = this.executionQueue.shift();
        if (this.canExecuteJob(jobId)) {
          running.add(jobId);
          this.executeJob(jobId, { trigger, inputs }).catch(error => {
            console.error(`作业执行失败 ${jobId}:`, error);
            this.failedJobs.add(jobId);
          });
        }
      }

      // 等待作业完成
      if (running.size > 0) {
        await this.waitForJobCompletion(running);
      }
    }

    return this.getExecutionResults();
  }

  /**
   * 检查作业是否可以执行 (依赖检查)
   */
  canExecuteJob(jobId) {
    const node = this.dependencyGraph.get(jobId);
    return node.dependencies.every(dep =>
      this.completedJobs.has(dep) && !this.failedJobs.has(dep)
    );
  }

  /**
   * 执行单个作业
   */
  async executeJob(jobId, context) {
    const job = this.config.jobs[jobId];
    console.log(`🚀 开始执行作业: ${job.name}`);

    try {
      this.runningJobs.set(jobId, { startTime: Date.now() });

      // 执行作业步骤
      for (const step of job.steps || []) {
        await this.executeStep(step, context);
      }

      this.completedJobs.add(jobId);
      console.log(`✅ 作业完成: ${job.name}`);

    } catch (error) {
      this.failedJobs.add(jobId);
      console.error(`❌ 作业失败: ${job.name}`, error);

      // 应用重试算法
      await this.handleJobFailure(jobId, error, context);

    } finally {
      this.runningJobs.delete(jobId);
    }
  }

  /**
   * 执行步骤
   */
  async executeStep(step, context) {
    if (step.if && !this.evaluateConditions(step.if, context)) {
      console.log(`⏭️  跳过步骤: ${step.name}`);
      return;
    }

    console.log(`📝 执行步骤: ${step.name}`);

    if (step.run) {
      // 执行shell命令
      await this.executeShellCommand(step.run, step.env || {});
    } else if (step.uses) {
      // 使用GitHub Actions
      await this.executeGitHubAction(step.uses, step.with || {}, step.env || {});
    }
  }

  /**
   * 条件评估算法
   */
  evaluateConditions(condition, context) {
    // 简化的条件评估器
    // 在实际实现中，这里应该是一个完整的表达式解析器
    try {
      const { trigger, inputs } = context;

      // 基础条件评估
      if (condition === 'true') return true;
      if (condition === 'false') return false;

      // GitHub上下文条件
      if (condition.includes('github.event_name')) {
        return trigger.type === 'push'; // 简化示例
      }

      if (condition.includes('needs.')) {
        const jobId = condition.match(/needs\.(\w+)\.result/)[1];
        return this.completedJobs.has(jobId);
      }

      return true; // 默认通过

    } catch (error) {
      console.warn('条件评估失败:', condition, error);
      return false;
    }
  }

  /**
   * 智能重试算法
   */
  async handleJobFailure(jobId, error, context) {
    const retryConfig = this.config.algorithm.retryAlgorithm;
    const job = this.config.jobs[jobId];

    if (!this.isRetryableError(error) || !job.retryConfig) {
      return;
    }

    const retryCount = (job.retryConfig.currentRetries || 0) + 1;
    if (retryCount > retryConfig.maxRetries) {
      return;
    }

    // 指数退避算法
    const delay = this.calculateRetryDelay(retryCount, retryConfig);

    console.log(`🔄 ${retryCount}/${retryConfig.maxRetries} 重试作业 ${jobId}，等待 ${delay}ms`);

    await this.delay(delay);

    job.retryConfig.currentRetries = retryCount;
    this.executionQueue.unshift(jobId); // 重新加入队列
  }

  /**
   * 计算重试延迟 (指数退避 + 抖动)
   */
  calculateRetryDelay(retryCount, config) {
    const baseDelay = config.baseDelay * Math.pow(2, retryCount - 1);
    const jitter = config.jitter ? Math.random() * 0.1 * baseDelay : 0;
    return Math.min(baseDelay + jitter, config.maxDelay);
  }

  /**
   * 检查是否为可重试错误
   */
  isRetryableError(error) {
    const retryableErrors = this.config.algorithm.retryAlgorithm.retryableErrors;
    return retryableErrors.some(pattern =>
      error.message.includes(pattern) || error.code === pattern
    );
  }

  /**
   * 等待作业完成
   */
  async waitForJobCompletion(running) {
    return new Promise(resolve => {
      const checkCompletion = () => {
        for (const jobId of running) {
          if (!this.runningJobs.has(jobId)) {
            running.delete(jobId);
          }
        }

        if (running.size === 0) {
          resolve();
        } else {
          setTimeout(checkCompletion, 100);
        }
      };

      checkCompletion();
    });
  }

  /**
   * 执行Shell命令
   */
  async executeShellCommand(command, env) {
    // 模拟命令执行
    console.log(`$ ${command}`);
    await this.delay(100); // 模拟执行时间
  }

  /**
   * 执行GitHub Action
   */
  async executeGitHubAction(action, params, env) {
    // 模拟GitHub Action执行
    console.log(`🔧 执行Action: ${action}`);
    await this.delay(200); // 模拟执行时间
  }

  /**
   * 延迟函数
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 获取执行结果
   */
  getExecutionResults() {
    return {
      success: this.failedJobs.size === 0,
      completedJobs: Array.from(this.completedJobs),
      failedJobs: Array.from(this.failedJobs),
      totalJobs: Object.keys(this.config.jobs).length,
      executionTime: Date.now() - this.startTime
    };
  }

  /**
   * 启动工作流
   */
  async start(trigger, inputs = {}) {
    this.startTime = Date.now();
    console.log('🚀 启动高级工作流引擎');
    return await this.scheduleWorkflow(trigger, inputs);
  }
}

/**
 * 获取作业配置 (兼容性函数)
 * @param {string} jobId - 作业ID
 * @returns {Object} 作业配置
 */
export function getStageConfig(jobId) {
  return ADVANCED_WORKFLOW_ENGINE.jobs[jobId];
}

/**
 * 高级质量门禁检查算法
 * @param {Object} metrics - 当前指标
 * @param {string} category - 检查类别 (testing, security, performance, codeQuality)
 * @returns {Object} 检查结果
 */
export function checkQualityGates(metrics, category = 'all') {
  const gates = ADVANCED_WORKFLOW_ENGINE.qualityGates;
  const results = {
    passed: true,
    failedGates: [],
    category,
    recommendations: []
  };

  const checkCategory = (categoryName, categoryGates) => {
    for (const [metric, threshold] of Object.entries(categoryGates)) {
      const actualValue = metrics[metric];
      if (actualValue !== undefined) {
        const passed = evaluateMetric(metric, actualValue, threshold);
        if (!passed) {
          results.passed = false;
          results.failedGates.push({
            category: categoryName,
            metric,
            actual: actualValue,
            expected: threshold,
            message: generateFailureMessage(metric, actualValue, threshold)
          });
        }
      }
    }
  };

  if (category === 'all') {
    Object.keys(gates).forEach(cat => checkCategory(cat, gates[cat]));
  } else if (gates[category]) {
    checkCategory(category, gates[category]);
  }

  // 生成修复建议
  results.recommendations = generateRecommendations(results.failedGates);

  return results;
}

/**
 * 指标评估算法
 * @param {string} metric - 指标名称
 * @param {*} actual - 实际值
 * @param {*} expected - 期望值
 * @returns {boolean} 是否通过
 */
function evaluateMetric(metric, actual, expected) {
  switch (metric) {
    case 'unitTestCoverage':
    case 'integrationTestCoverage':
    case 'e2eTestCoverage':
    case 'mutationScore':
    case 'securityScore':
    case 'maintainabilityIndex':
      return actual >= expected;

    case 'vulnerabilitySeverity':
      const severityLevels = { 'low': 1, 'medium': 2, 'high': 3, 'critical': 4 };
      return severityLevels[actual] <= severityLevels[expected];

    case 'responseTimeBudget':
    case 'memoryLeakThreshold':
    case 'complexityThreshold':
    case 'duplicationThreshold':
    case 'technicalDebtRatio':
    case 'flakyTestThreshold':
      return actual <= expected;

    case 'throughputTarget':
      return actual >= expected;

    case 'cpuUsageThreshold':
      return actual <= expected;

    case 'codeQLAlerts':
      return actual <= expected;

    default:
      return actual >= expected;
  }
}

/**
 * 生成失败消息
 * @param {string} metric - 指标名称
 * @param {*} actual - 实际值
 * @param {*} expected - 期望值
 * @returns {string} 失败消息
 */
function generateFailureMessage(metric, actual, expected) {
  const messages = {
    unitTestCoverage: `单元测试覆盖率 ${actual}% 低于最低要求 ${expected}%`,
    integrationTestCoverage: `集成测试覆盖率 ${actual}% 低于最低要求 ${expected}%`,
    e2eTestCoverage: `端到端测试覆盖率 ${actual}% 低于最低要求 ${expected}%`,
    securityScore: `安全评分 ${actual} 低于最低要求 ${expected}`,
    responseTimeBudget: `响应时间 ${actual}ms 超过预算 ${expected}ms`,
    memoryLeakThreshold: `内存泄漏 ${actual}MB 超过阈值 ${expected}MB`,
    complexityThreshold: `代码复杂度 ${actual} 超过阈值 ${expected}`,
    duplicationThreshold: `代码重复率 ${actual}% 超过阈值 ${expected}%`,
    technicalDebtRatio: `技术债务比例 ${actual}% 超过阈值 ${expected}%`,
    cpuUsageThreshold: `CPU使用率 ${actual}% 超过阈值 ${expected}%`
  };

  return messages[metric] || `${metric}: ${actual} 不符合要求 ${expected}`;
}

/**
 * 生成修复建议
 * @param {Array} failedGates - 失败的质量门禁
 * @returns {Array} 修复建议
 */
function generateRecommendations(failedGates) {
  const recommendations = [];

  const categoryRecommendations = {
    testing: {
      unitTestCoverage: '增加单元测试覆盖率，重点测试复杂业务逻辑和边界条件',
      integrationTestCoverage: '添加更多集成测试，确保模块间正确协作',
      e2eTestCoverage: '完善端到端测试场景，覆盖主要用户流程',
      flakyTestThreshold: '修复不稳定的测试用例，提高测试可靠性'
    },
    security: {
      vulnerabilitySeverity: '修复高危安全漏洞，更新依赖包版本',
      dependencyAudit: '运行安全审计，修复已知漏洞',
      secretScanning: '移除硬编码凭据，使用环境变量或密钥管理',
      codeQLAlerts: '修复代码扫描发现的安全问题'
    },
    performance: {
      responseTimeBudget: '优化响应时间，检查数据库查询和缓存策略',
      throughputTarget: '提升系统吞吐量，考虑负载均衡和异步处理',
      memoryLeakThreshold: '修复内存泄漏问题，优化资源管理',
      cpuUsageThreshold: '降低CPU使用率，优化算法复杂度'
    },
    codeQuality: {
      complexityThreshold: '重构高复杂度函数，拆分为更小的方法',
      duplicationThreshold: '消除代码重复，提取公共逻辑',
      maintainabilityIndex: '改进代码可维护性，添加注释和文档',
      technicalDebtRatio: '减少技术债务，逐步重构遗留代码'
    }
  };

  failedGates.forEach(failure => {
    const category = failure.category;
    const metric = failure.metric;

    if (categoryRecommendations[category] && categoryRecommendations[category][metric]) {
      recommendations.push({
        category,
        metric,
        priority: getPriority(failure),
        action: categoryRecommendations[category][metric]
      });
    }
  });

  return recommendations;
}

/**
 * 获取修复优先级
 * @param {Object} failure - 失败信息
 * @returns {string} 优先级
 */
function getPriority(failure) {
  const { category, metric } = failure;

  // 高优先级安全和性能问题
  if (category === 'security' && ['vulnerabilitySeverity', 'codeQLAlerts'].includes(metric)) {
    return 'critical';
  }

  if (category === 'performance' && ['responseTimeBudget', 'cpuUsageThreshold'].includes(metric)) {
    return 'high';
  }

  // 中等优先级质量问题
  if (category === 'testing' || category === 'codeQuality') {
    return 'medium';
  }

  return 'low';
}

/**
 * 工作流算法工厂
 * @param {Object} config - 工作流配置
 * @returns {AdvancedWorkflowScheduler} 调度器实例
 */
export function createWorkflowScheduler(config = ADVANCED_WORKFLOW_ENGINE) {
  return new AdvancedWorkflowScheduler(config);
}

/**
 * 简化API - 快速启动工作流
 * @param {Object} trigger - 触发器信息
 * @param {Object} inputs - 输入参数
 * @returns {Promise<Object>} 执行结果
 */
export async function runWorkflow(trigger, inputs = {}) {
  const scheduler = createWorkflowScheduler();
  return await scheduler.start(trigger, inputs);
}

/**
 * 工作流状态查询
 * @param {string} workflowId - 工作流ID
 * @returns {Object} 状态信息
 */
export function getWorkflowStatus(workflowId) {
  // 在实际实现中，这里应该从持久化存储中查询
  return {
    id: workflowId,
    status: 'running',
    progress: 0.5,
    currentJobs: ['test', 'build'],
    completedJobs: ['env-check', 'local-validation'],
    failedJobs: [],
    startTime: new Date().toISOString()
  };
}

/**
 * 工作流配置验证
 * @param {Object} config - 工作流配置
 * @returns {Object} 验证结果
 */
export function validateWorkflowConfig(config) {
  const errors = [];
  const warnings = [];

  // 验证作业依赖关系
  if (config.jobs) {
    for (const [jobId, job] of Object.entries(config.jobs)) {
      if (job.needs) {
        for (const dep of job.needs) {
          if (!config.jobs[dep]) {
            errors.push(`作业 ${jobId} 依赖不存在的作业 ${dep}`);
          }
        }
      }
    }
  }

  // 验证触发器配置
  if (!config.triggers) {
    warnings.push('未配置触发器，可能需要手动启动工作流');
  }

  // 验证并发控制
  if (config.concurrency && !config.concurrency.group) {
    warnings.push('并发控制缺少group配置');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

export { ADVANCED_WORKFLOW_ENGINE as default };
