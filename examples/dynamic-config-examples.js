/**
 * frys 动态配置示例
 * 展示VCP工具占位符系统的实际应用
 */

import { PlaceholderSystem } from '../src/core/utils/PlaceholderSystem.js';

// 创建占位符系统实例
const system = new PlaceholderSystem({
  enableCaching: true,
  strictMode: false, // 非严格模式，保留未解析的占位符
});

/**
 * 示例1: 基本变量替换
 */
function example1_BasicVariables() {
  console.log('📝 示例1: 基本变量替换');

  const template = '欢迎使用 {{productName}} v{{version}}！';
  const context = {
    productName: 'frys',
    version: '1.0.0',
  };

  const result = system.processString(template, context);
  console.log('模板:', template);
  console.log('结果:', result);
  console.log('---');
}

/**
 * 示例2: 条件表达式
 */
function example2_ConditionalExpressions() {
  console.log('🔀 示例2: 条件表达式');

  const template = "用户{{name}}的年龄段: {{age >= 18 ? '成人' : '未成年'}}";
  const context = {
    name: '小明',
    age: 16,
  };

  const result = system.processString(template, context);
  console.log('模板:', template);
  console.log('结果:', result);
  console.log('---');
}

/**
 * 示例3: 函数调用
 */
function example3_FunctionCalls() {
  console.log('🛠️ 示例3: 函数调用');

  const template = '文本长度: {{length(text)}}, 大写: {{uppercase(text)}}';
  const context = {
    text: 'Hello World',
  };

  const result = system.processString(template, context);
  console.log('模板:', template);
  console.log('结果:', result);
  console.log('---');
}

/**
 * 示例4: 工作流配置
 */
function example4_WorkflowConfig() {
  console.log('⚙️ 示例4: 工作流配置');

  const workflowConfig = {
    name: '{{project.name}} 工作流',
    version: '{{project.version}}',
    settings: {
      timeout: '{{env.TIMEOUT || 30000}}',
      retries: '{{system.load > 0.8 ? 1 : 3}}',
      enableCache: "{{env.NODE_ENV === 'production'}}",
    },
    steps: [
      {
        name: '数据验证',
        enabled: '{{validation.enabled}}',
        config: {
          strict: "{{env.NODE_ENV === 'production'}}",
        },
      },
      {
        name: '数据处理',
        batchSize: '{{min(100, max(10, data.length / 10))}}',
      },
    ],
  };

  const context = {
    project: {
      name: '用户管理',
      version: '2.1.0',
    },
    env: {
      TIMEOUT: '5000',
      NODE_ENV: 'development',
    },
    system: {
      load: 0.3,
    },
    validation: {
      enabled: true,
    },
    data: {
      length: 500,
    },
  };

  const result = system.processObject(workflowConfig, context);
  console.log('原始配置:', JSON.stringify(workflowConfig, null, 2));
  console.log('处理后配置:', JSON.stringify(result, null, 2));
  console.log('---');
}

/**
 * 示例5: API配置
 */
function example5_APIConfig() {
  console.log('🌐 示例5: API配置');

  const apiConfig = {
    baseURL: '{{env.API_BASE_URL}}',
    endpoints: {
      users: '{{baseURL}}/users',
      posts: '{{baseURL}}/posts',
      comments: '{{baseURL}}/comments/{{postId}}',
    },
    auth: {
      type: "{{env.AUTH_TYPE || 'Bearer'}}",
      token: '{{auth.token}}',
      header: '{{auth.type}} {{auth.token}}',
    },
    timeout: '{{network.slow ? 30000 : 10000}}',
    retry: {
      attempts: '{{gt(errorRate, 0.1) ? 5 : 3}}',
      delay: '{{retry.attempts * 1000}}',
    },
  };

  const context = {
    env: {
      API_BASE_URL: 'https://jsonplaceholder.typicode.com',
      AUTH_TYPE: 'Bearer',
    },
    auth: {
      token: 'abc123xyz',
    },
    network: {
      slow: false,
    },
    errorRate: 0.05,
    postId: 1,
  };

  const result = system.processObject(apiConfig, context);
  console.log('API配置结果:');
  console.log(JSON.stringify(result, null, 2));
  console.log('---');
}

/**
 * 示例6: 自定义函数
 */
function example6_CustomFunctions() {
  console.log('🎨 示例6: 自定义函数');

  // 注册自定义函数
  system.registerFunction('riskLevel', (amount, score) => {
    if (amount > 10000 && score < 50) return '高风险';
    if (amount > 5000 || score < 70) return '中等风险';
    return '低风险';
  });

  system.registerFunction('formatCurrency', (amount, currency = 'CNY') => {
    return `${amount.toFixed(2)} ${currency}`;
  });

  const template =
    '交易金额: {{formatCurrency(amount)}}, 风险等级: {{riskLevel(amount, creditScore)}}';
  const context = {
    amount: 7500,
    creditScore: 65,
  };

  const result = system.processString(template, context);
  console.log('模板:', template);
  console.log('结果:', result);
  console.log('---');
}

/**
 * 示例7: 数组和对象操作
 */
function example7_ArrayOperations() {
  console.log('📊 示例7: 数组和对象操作');

  const template = {
    summary: '共有 {{length(users)}} 个用户',
    activeUsers: '{{filter(users, (user) => user.active)}}',
    userNames: '{{map(users, (user) => user.name)}}',
    totalAge: '{{reduce(users, (sum, user) => sum + user.age, 0)}}',
    averageAge:
      '{{reduce(users, (sum, user) => sum + user.age, 0) / length(users)}}',
  };

  const context = {
    users: [
      { name: 'Alice', age: 25, active: true },
      { name: 'Bob', age: 30, active: false },
      { name: 'Charlie', age: 35, active: true },
      { name: 'Diana', age: 28, active: true },
    ],
  };

  const result = system.processObject(template, context);
  console.log('模板:', JSON.stringify(template, null, 2));
  console.log('结果:', JSON.stringify(result, null, 2));
  console.log('---');
}

/**
 * 示例8: 日期时间处理
 */
function example8_DateTime() {
  console.log('📅 示例8: 日期时间处理');

  const template = {
    timestamp: '{{timestamp()}}',
    currentDate: "{{formatdate(now(), 'YYYY-MM-DD')}}",
    currentTime: "{{formatdate(now(), 'HH:mm:ss')}}",
    logFile: "app_{{formatdate(now(), 'YYYY-MM-DD_HH-mm-ss')}}.log",
    backupName: "backup_{{timestamp()}}_{{formatdate(now(), 'YYYYMMDD')}}",
  };

  const result = system.processObject(template, {});
  console.log('日期时间处理结果:');
  console.log(JSON.stringify(result, null, 2));
  console.log('---');
}

/**
 * 示例9: 错误处理
 */
function example9_ErrorHandling() {
  console.log('🛡️ 示例9: 错误处理');

  // 严格模式
  const strictSystem = new PlaceholderSystem({ strictMode: true });
  // 非严格模式 (默认)
  const lenientSystem = new PlaceholderSystem({ strictMode: false });

  const template = 'Hello {{name}}! Age: {{age}}';

  console.log('严格模式:');
  try {
    const result = strictSystem.processString(template, { name: 'Alice' });
    console.log('结果:', result);
  } catch (error) {
    console.log('错误:', error.message);
  }

  console.log('非严格模式:');
  try {
    const result = lenientSystem.processString(template, { name: 'Alice' });
    console.log('结果:', result);
  } catch (error) {
    console.log('错误:', error.message);
  }

  console.log('---');
}

/**
 * 主函数
 */
function main() {
  console.log('🚀 frys 动态配置示例演示\n');
  console.log('='.repeat(50));

  try {
    example1_BasicVariables();
    example2_ConditionalExpressions();
    example3_FunctionCalls();
    example4_WorkflowConfig();
    example5_APIConfig();
    example6_CustomFunctions();
    example7_ArrayOperations();
    example8_DateTime();
    example9_ErrorHandling();

    console.log('✅ 所有示例运行完成！');
    console.log('\n📖 更多信息请查看 docs/dynamic-config-guide.md');
  } catch (error) {
    console.error('❌ 示例运行失败:', error);
  }
}

// 运行示例
main();
