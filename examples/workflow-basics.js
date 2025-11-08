/**
 * frys 工作流基础示例
 *
 * 这个示例展示了如何创建和执行简单的工作流，
 * 包括步骤定义、参数传递和结果处理。
 */

import { WorkflowEngine } from '../src/index.js';

/**
 * 创建基础工作流引擎实例
 */
function createWorkflowEngine() {
  return new WorkflowEngine({
    // 工作流执行配置
    maxConcurrency: 10,        // 最大并发数
    timeout: 30000,           // 执行超时时间
    retryAttempts: 3,         // 重试次数
    enableMetrics: true,      // 启用指标收集
  });
}

/**
 * 定义用户注册工作流
 * 这个工作流包含验证输入、创建用户、发送欢迎邮件等步骤
 */
function createUserRegistrationWorkflow() {
  return {
    id: 'user-registration-workflow',
    name: '用户注册流程',
    version: '1.0.0',
    description: '处理新用户注册的完整流程',

    // 工作流步骤定义
    steps: [
      {
        id: 'validate-input',
        name: '验证输入数据',
        type: 'validation',
        config: {
          schema: {
            email: 'required|email',
            password: 'required|min:8',
            name: 'required|min:2|max:50'
          },
          errorMessages: {
            'email.required': '邮箱地址不能为空',
            'email.email': '邮箱格式不正确',
            'password.required': '密码不能为空',
            'password.min': '密码长度不能少于8位',
            'name.required': '姓名不能为空',
            'name.min': '姓名长度不能少于2位',
            'name.max': '姓名长度不能超过50位'
          }
        }
      },

      {
        id: 'check-user-exists',
        name: '检查用户是否已存在',
        type: 'service',
        config: {
          service: 'userService',
          method: 'findByEmail',
          parameters: {
            email: '${input.email}'
          }
        }
      },

      {
        id: 'create-user-account',
        name: '创建用户账户',
        type: 'condition',
        config: {
          expression: '${steps.check-user-exists.result} === null',
          trueStep: 'do-create-user',
          falseStep: 'user-already-exists'
        }
      },

      {
        id: 'do-create-user',
        name: '执行用户创建',
        type: 'service',
        config: {
          service: 'userService',
          method: 'createUser',
          parameters: {
            email: '${input.email}',
            password: '${input.password}',
            name: '${input.name}',
            status: 'pending_verification'
          }
        }
      },

      {
        id: 'send-verification-email',
        name: '发送验证邮件',
        type: 'service',
        config: {
          service: 'emailService',
          method: 'sendVerificationEmail',
          parameters: {
            to: '${input.email}',
            userId: '${steps.do-create-user.result.id}',
            verificationToken: '${steps.do-create-user.result.verificationToken}'
          }
        }
      },

      {
        id: 'user-already-exists',
        name: '用户已存在错误',
        type: 'error',
        config: {
          message: '用户已存在',
          code: 'USER_ALREADY_EXISTS'
        }
      }
    ],

    // 错误处理策略
    errorHandling: {
      onError: 'cleanup-and-notify',
      retryPolicy: {
        maxAttempts: 3,
        backoff: 'exponential',
        initialDelay: 1000
      }
    },

    // 监控配置
    monitoring: {
      enableMetrics: true,
      logLevel: 'info',
      alertOnFailure: true
    }
  };
}

/**
 * 定义订单处理工作流
 * 展示条件分支和并行执行
 */
function createOrderProcessingWorkflow() {
  return {
    id: 'order-processing-workflow',
    name: '订单处理流程',
    version: '1.0.0',
    description: '处理电商订单的完整流程',

    steps: [
      {
        id: 'validate-order',
        name: '验证订单数据',
        type: 'validation',
        config: {
          schema: {
            orderId: 'required|string',
            customerId: 'required|string',
            items: 'required|array|min:1',
            total: 'required|number|min:0',
            paymentMethod: 'required|in:credit_card,debit_card,paypal'
          }
        }
      },

      {
        id: 'check-inventory',
        name: '检查库存',
        type: 'parallel',
        config: {
          steps: [
            {
              id: 'check-item-1',
              name: '检查商品1库存',
              type: 'service',
              config: {
                service: 'inventoryService',
                method: 'checkStock',
                parameters: {
                  itemId: '${input.items[0].id}',
                  quantity: '${input.items[0].quantity}'
                }
              }
            }
          ],
          maxConcurrency: 5,
          failFast: false
        }
      },

      {
        id: 'calculate-total',
        name: '计算订单总额',
        type: 'service',
        config: {
          service: 'orderService',
          method: 'calculateTotal',
          parameters: {
            items: '${input.items}',
            taxRate: 0.08,
            shipping: '${input.shipping || 0}'
          }
        }
      },

      {
        id: 'process-payment',
        name: '处理支付',
        type: 'condition',
        config: {
          expression: '${input.paymentMethod} === "credit_card"',
          trueStep: 'credit-card-payment',
          falseStep: 'other-payment'
        }
      },

      {
        id: 'credit-card-payment',
        name: '信用卡支付',
        type: 'service',
        config: {
          service: 'paymentService',
          method: 'processCreditCard',
          parameters: {
            amount: '${steps.calculate-total.result.total}',
            cardNumber: '${input.cardNumber}',
            expiryDate: '${input.expiryDate}',
            cvv: '${input.cvv}'
          }
        }
      },

      {
        id: 'other-payment',
        name: '其他支付方式',
        type: 'service',
        config: {
          service: 'paymentService',
          method: 'processPayment',
          parameters: {
            method: '${input.paymentMethod}',
            amount: '${steps.calculate-total.result.total}'
          }
        }
      },

      {
        id: 'update-inventory',
        name: '更新库存',
        type: 'service',
        config: {
          service: 'inventoryService',
          method: 'updateStock',
          parameters: {
            items: '${input.items}'
          }
        }
      },

      {
        id: 'create-shipment',
        name: '创建发货单',
        type: 'service',
        config: {
          service: 'shippingService',
          method: 'createShipment',
          parameters: {
            orderId: '${input.orderId}',
            customerId: '${input.customerId}',
            items: '${input.items}',
            shippingAddress: '${input.shippingAddress}'
          }
        }
      },

      {
        id: 'send-confirmations',
        name: '发送确认通知',
        type: 'parallel',
        config: {
          steps: [
            {
              id: 'email-confirmation',
              name: '发送邮件确认',
              type: 'service',
              config: {
                service: 'emailService',
                method: 'sendOrderConfirmation',
                parameters: {
                  to: '${input.customerEmail}',
                  orderId: '${input.orderId}',
                  items: '${input.items}',
                  total: '${steps.calculate-total.result.total}'
                }
              }
            },
            {
              id: 'sms-confirmation',
              name: '发送短信确认',
              type: 'service',
              config: {
                service: 'smsService',
                method: 'sendOrderNotification',
                parameters: {
                  phone: '${input.customerPhone}',
                  orderId: '${input.orderId}',
                  status: 'confirmed'
                }
              }
            }
          ]
        }
      }
    ],

    // 补偿逻辑（失败时的回滚操作）
    compensation: {
      'process-payment': {
        action: 'refund-payment',
        service: 'paymentService.refund',
        parameters: {
          transactionId: '${steps.process-payment.result.transactionId}'
        }
      },
      'update-inventory': {
        action: 'restore-inventory',
        service: 'inventoryService.restoreStock',
        parameters: {
          items: '${input.items}'
        }
      }
    }
  };
}

/**
 * 演示工作流执行
 */
async function demonstrateWorkflowExecution() {
  console.log('🚀 开始工作流演示...\n');

  try {
    // 创建工作流引擎
    const engine = createWorkflowEngine();
    console.log('✅ 工作流引擎创建成功\n');

    // 注册用户注册工作流
    const userWorkflow = createUserRegistrationWorkflow();
    await engine.registerWorkflow(userWorkflow);
    console.log('✅ 用户注册工作流注册成功\n');

    // 执行用户注册
    console.log('📝 执行用户注册工作流...');
    const userResult = await engine.executeWorkflow('user-registration-workflow', {
      email: 'john.doe@example.com',
      password: 'SecurePass123!',
      name: 'John Doe'
    });

    console.log('✅ 用户注册完成:', {
      userId: userResult.steps['do-create-user']?.result?.id,
      email: userResult.steps['do-create-user']?.result?.email,
      status: userResult.status
    });
    console.log();

    // 注册订单处理工作流
    const orderWorkflow = createOrderProcessingWorkflow();
    await engine.registerWorkflow(orderWorkflow);
    console.log('✅ 订单处理工作流注册成功\n');

    // 执行订单处理
    console.log('🛒 执行订单处理工作流...');
    const orderResult = await engine.executeWorkflow('order-processing-workflow', {
      orderId: 'ORDER-2025-001',
      customerId: 'CUSTOMER-123',
      customerEmail: 'john.doe@example.com',
      customerPhone: '+1234567890',
      items: [
        { id: 'ITEM-001', name: 'Wireless Headphones', quantity: 1, price: 199.99 },
        { id: 'ITEM-002', name: 'Phone Case', quantity: 2, price: 29.99 }
      ],
      total: 259.97,
      paymentMethod: 'credit_card',
      cardNumber: '4111111111111111',
      expiryDate: '12/25',
      cvv: '123',
      shippingAddress: {
        street: '123 Main St',
        city: 'Anytown',
        state: 'CA',
        zipCode: '12345'
      }
    });

    console.log('✅ 订单处理完成:', {
      orderId: orderResult.input.orderId,
      status: orderResult.status,
      total: orderResult.steps['calculate-total']?.result?.total,
      paymentStatus: orderResult.steps['process-payment']?.status,
      shipmentId: orderResult.steps['create-shipment']?.result?.id
    });
    console.log();

    // 显示执行统计
    const stats = engine.getStats();
    console.log('📊 执行统计:', stats);

  } catch (error) {
    console.error('❌ 工作流执行失败:', error.message);

    if (error.details) {
      console.error('错误详情:', error.details);
    }

    if (error.stepId) {
      console.error('失败步骤:', error.stepId);
    }
  }
}

/**
 * 演示工作流监听器
 */
function demonstrateWorkflowEvents() {
  const engine = createWorkflowEngine();

  // 监听工作流事件
  engine.on('workflow.started', (event) => {
    console.log(`🚀 工作流开始: ${event.workflowId}`);
  });

  engine.on('workflow.completed', (event) => {
    console.log(`✅ 工作流完成: ${event.workflowId}`);
    console.log(`   执行时间: ${event.executionTime}ms`);
  });

  engine.on('workflow.failed', (event) => {
    console.error(`❌ 工作流失败: ${event.workflowId}`);
    console.error(`   错误: ${event.error.message}`);
  });

  engine.on('step.started', (event) => {
    console.log(`▶️  步骤开始: ${event.stepId}`);
  });

  engine.on('step.completed', (event) => {
    console.log(`✅ 步骤完成: ${event.stepId} (${event.executionTime}ms)`);
  });

  engine.on('step.failed', (event) => {
    console.error(`❌ 步骤失败: ${event.stepId}`);
    console.error(`   错误: ${event.error.message}`);
  });

  return engine;
}

/**
 * 演示错误处理和重试
 */
async function demonstrateErrorHandling() {
  console.log('🔄 演示错误处理和重试机制...\n');

  const engine = createWorkflowEngine();

  // 定义一个会失败的工作流（模拟网络错误）
  const failingWorkflow = {
    id: 'error-handling-demo',
    name: '错误处理演示',
    steps: [
      {
        id: 'unreliable-service',
        name: '调用不可靠服务',
        type: 'service',
        config: {
          service: 'unreliableService',
          method: 'call',
          retry: {
            maxAttempts: 3,
            backoff: 'exponential',
            initialDelay: 1000
          }
        }
      }
    ]
  };

  try {
    await engine.registerWorkflow(failingWorkflow);

    const result = await engine.executeWorkflow('error-handling-demo', {});
    console.log('✅ 工作流最终成功执行');

  } catch (error) {
    console.log('ℹ️  工作流按预期失败，演示了错误处理机制');
    console.log('错误信息:', error.message);
  }
}

// 主执行函数
async function main() {
  console.log('🎯 frys 工作流基础示例\n');
  console.log('=' .repeat(50));

  // 演示基本工作流执行
  await demonstrateWorkflowExecution();

  console.log('\n' + '='.repeat(50));

  // 演示事件监听
  console.log('📡 演示工作流事件监听...\n');
  const eventEngine = demonstrateWorkflowEvents();

  const simpleWorkflow = {
    id: 'event-demo-workflow',
    name: '事件演示工作流',
    steps: [
      {
        id: 'step1',
        name: '步骤1',
        type: 'log',
        config: { message: '执行步骤1' }
      },
      {
        id: 'step2',
        name: '步骤2',
        type: 'log',
        config: { message: '执行步骤2' }
      }
    ]
  };

  await eventEngine.registerWorkflow(simpleWorkflow);
  await eventEngine.executeWorkflow('event-demo-workflow', {});

  console.log('\n' + '='.repeat(50));

  // 演示错误处理
  await demonstrateErrorHandling();

  console.log('\n🎉 所有示例演示完成！');
}

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export {
  createWorkflowEngine,
  createUserRegistrationWorkflow,
  createOrderProcessingWorkflow,
  demonstrateWorkflowExecution,
  demonstrateWorkflowEvents,
  demonstrateErrorHandling
};
