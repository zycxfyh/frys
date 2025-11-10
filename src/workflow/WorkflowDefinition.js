/**
 * 工作流定义验证器和工具类
 */

export class WorkflowDefinition {
  /**
   * 验证工作流定义
   */
  static validate(definition) {
    const errors = [];

    // 基本字段验证
    if (!definition.name || typeof definition.name !== 'string') {
      errors.push('工作流名称(name)是必需的字符串');
    }

    if (!definition.tasks || !Array.isArray(definition.tasks)) {
      errors.push('工作流任务(tasks)是必需的数组');
    } else {
      // 验证任务
      definition.tasks.forEach((task, index) => {
        const taskErrors = this.validateTask(task, index, definition.tasks);
        errors.push(...taskErrors);
      });
    }

    // 验证依赖关系
    if (definition.tasks && definition.tasks.length > 0) {
      const dependencyErrors = this.validateDependencies(definition.tasks);
      errors.push(...dependencyErrors);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * 验证单个任务
   */
  static validateTask(task, index, allTasks) {
    const errors = [];

    if (!task.name || typeof task.name !== 'string') {
      errors.push(`任务 ${index} 名称(name)是必需的字符串`);
    }

    if (!task.type || typeof task.type !== 'string') {
      errors.push(`任务 ${index} 类型(type)是必需的字符串`);
    } else {
      // 验证任务类型
      const validTypes = ['http', 'script', 'delay', 'condition'];
      if (!validTypes.includes(task.type)) {
        errors.push(`任务 ${index} 类型无效: ${task.type}，支持的类型: ${validTypes.join(', ')}`);
      }

      // 验证任务配置
      const configErrors = this.validateTaskConfig(task.type, task.config, index);
      errors.push(...configErrors);
    }

    // 验证依赖
    if (task.dependencies) {
      if (!Array.isArray(task.dependencies)) {
        errors.push(`任务 ${index} 依赖(dependencies)必须是数组`);
      } else {
        task.dependencies.forEach(depId => {
          if (!allTasks.some(t => t.id === depId)) {
            errors.push(`任务 ${index} 依赖的任务不存在: ${depId}`);
          }
        });
      }
    }

    return errors;
  }

  /**
   * 验证任务配置
   */
  static validateTaskConfig(type, config, taskIndex) {
    const errors = [];
    const prefix = `任务 ${taskIndex} 配置`;

    if (!config || typeof config !== 'object') {
      errors.push(`${prefix}必须是对象`);
      return errors;
    }

    switch (type) {
      case 'http':
        if (!config.url || typeof config.url !== 'string') {
          errors.push(`${prefix} url是必需的字符串`);
        }
        if (config.method && typeof config.method !== 'string') {
          errors.push(`${prefix} method必须是字符串`);
        }
        break;

      case 'script':
        if (!config.script || typeof config.script !== 'string') {
          errors.push(`${prefix} script是必需的字符串`);
        }
        break;

      case 'delay':
        if (typeof config.duration !== 'number' || config.duration < 0) {
          errors.push(`${prefix} duration必须是非负数`);
        }
        break;

      case 'condition':
        if (!config.condition || typeof config.condition !== 'string') {
          errors.push(`${prefix} condition是必需的字符串`);
        }
        break;
    }

    return errors;
  }

  /**
   * 验证依赖关系（检测循环依赖）
   */
  static validateDependencies(tasks) {
    const errors = [];
    const graph = new Map();

    // 构建依赖图
    tasks.forEach(task => {
      graph.set(task.id, task.dependencies || []);
    });

    // 检测循环依赖
    const visited = new Set();
    const recStack = new Set();

    const hasCycle = (taskId, path = []) => {
      if (recStack.has(taskId)) {
        const cycleStart = path.indexOf(taskId);
        const cycle = [...path.slice(cycleStart), taskId];
        errors.push(`检测到循环依赖: ${cycle.join(' -> ')}`);
        return true;
      }

      if (visited.has(taskId)) return false;

      visited.add(taskId);
      recStack.add(taskId);

      const dependencies = graph.get(taskId) || [];
      for (const depId of dependencies) {
        if (hasCycle(depId, [...path, taskId])) {
          return true;
        }
      }

      recStack.delete(taskId);
      return false;
    };

    for (const taskId of graph.keys()) {
      if (!visited.has(taskId)) {
        hasCycle(taskId);
      }
    }

    return errors;
  }

  /**
   * 规范化工作流定义
   */
  static normalize(definition) {
    const normalized = {
      name: definition.name,
      description: definition.description || '',
      metadata: definition.metadata || {},
      tasks: [],
    };

    // 规范化任务
    normalized.tasks = definition.tasks.map(task => ({
      id: task.id || this.generateTaskId(),
      name: task.name,
      type: task.type,
      config: task.config || {},
      dependencies: task.dependencies || [],
      maxRetries: task.maxRetries || 3,
      retryDelay: task.retryDelay || 1000,
    }));

    return normalized;
  }

  /**
   * 生成任务ID
   */
  static generateTaskId() {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 分析工作流复杂度
   */
  static analyzeComplexity(definition) {
    const analysis = {
      taskCount: definition.tasks.length,
      dependencyCount: 0,
      maxDepth: 0,
      hasCycles: false,
      complexity: 'simple', // simple, medium, complex
    };

    // 计算依赖数量和最大深度
    const depths = new Map();

    definition.tasks.forEach(task => {
      const deps = task.dependencies || [];
      analysis.dependencyCount += deps.length;

      if (deps.length === 0) {
        depths.set(task.id, 0);
      } else {
        const depDepths = deps.map(depId => depths.get(depId) || 0);
        const depth = Math.max(...depDepths) + 1;
        depths.set(task.id, depth);
        analysis.maxDepth = Math.max(analysis.maxDepth, depth);
      }
    });

    // 检测循环依赖
    const validation = this.validateDependencies(definition.tasks);
    analysis.hasCycles = validation.length > 0;

    // 计算复杂度
    if (analysis.taskCount > 20 || analysis.maxDepth > 5 || analysis.hasCycles) {
      analysis.complexity = 'complex';
    } else if (analysis.taskCount > 10 || analysis.maxDepth > 2) {
      analysis.complexity = 'medium';
    }

    return analysis;
  }

  /**
   * 工作流定义示例
   */
  static createExample(name = '示例工作流') {
    return {
      name,
      description: '一个简单的工作流示例',
      tasks: [
          {
          id: 'task_1',
          name: '初始化',
          type: 'script',
          config: {
            script: 'console.log("工作流开始"); return { status: "initialized" };',
          },
        },
        {
          id: 'task_2',
          name: 'API调用',
          type: 'http',
          config: {
            url: 'https://api.example.com/data',
            method: 'GET',
          },
          dependencies: ['task_1'],
        },
        {
          id: 'task_3',
          name: '处理结果',
          type: 'script',
          config: {
            script: 'console.log("处理API结果:", context.apiResult); return { processed: true };',
          },
          dependencies: ['task_2'],
        },
        {
          id: 'task_4',
          name: '延迟等待',
          type: 'delay',
          config: {
            duration: 2000,
          },
          dependencies: ['task_3'],
        },
        {
          id: 'task_5',
          name: '条件检查',
          type: 'condition',
          config: {
            condition: 'workflow.tasks.find(t => t.id === "task_3").result.processed === true',
          },
          dependencies: ['task_4'],
        },
      ],
    };
  }
}
