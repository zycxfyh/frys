/**
 * 任务调度器 - 处理任务的依赖关系和执行顺序
 */

export class TaskScheduler {
  constructor() {
    this.logger = console;
  }

  /**
   * 分析任务依赖关系，生成执行顺序
   */
  analyzeDependencies(tasks) {
    const graph = this.buildDependencyGraph(tasks);
    const sortedTasks = this.topologicalSort(graph);

    return {
      executionOrder: sortedTasks,
      hasCycles: false,
      graph,
    };
  }

  /**
   * 构建依赖图
   */
  buildDependencyGraph(tasks) {
    const graph = new Map();
    const reverseGraph = new Map();

    // 初始化图
    tasks.forEach(task => {
      graph.set(task.id, []);
      reverseGraph.set(task.id, []);
    });

    // 构建依赖关系
    tasks.forEach(task => {
      if (task.dependencies && task.dependencies.length > 0) {
        task.dependencies.forEach(depId => {
          if (graph.has(depId)) {
            graph.get(depId).push(task.id);
            reverseGraph.get(task.id).push(depId);
          }
        });
      }
    });

    return { graph, reverseGraph };
  }

  /**
   * 拓扑排序 - 确定任务执行顺序
   */
  topologicalSort({ graph, reverseGraph }) {
    const visited = new Set();
    const tempVisited = new Set();
    const order = [];
    let hasCycles = false;

    const visit = (taskId) => {
      if (tempVisited.has(taskId)) {
        hasCycles = true;
        return;
      }
      if (visited.has(taskId)) return;

      tempVisited.add(taskId);

      // 访问所有依赖此任务的任务
      const dependents = graph.get(taskId) || [];
      for (const dependent of dependents) {
        visit(dependent);
      }

      tempVisited.delete(taskId);
      visited.add(taskId);
      order.push(taskId);
    };

    // 从没有依赖的任务开始
    for (const taskId of reverseGraph.keys()) {
      const dependencies = reverseGraph.get(taskId);
      if (dependencies.length === 0 && !visited.has(taskId)) {
        visit(taskId);
      }
    }

    // 处理可能还有剩余的任务
    for (const taskId of graph.keys()) {
      if (!visited.has(taskId)) {
        visit(taskId);
      }
    }

    return hasCycles ? [] : order.reverse();
  }

  /**
   * 获取可并行执行的任务组
   */
  getParallelGroups(tasks, executionOrder) {
    const groups = [];
    const completed = new Set();

    executionOrder.forEach(taskId => {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;

      // 检查依赖是否都已完成
      const canExecute = !task.dependencies ||
        task.dependencies.every(dep => completed.has(dep));

      if (canExecute) {
        // 找到当前可执行的任务组
        let currentGroup = groups.find(group =>
          !group.some(groupTaskId => {
            const groupTask = tasks.find(t => t.id === groupTaskId);
            return groupTask && groupTask.dependencies.includes(taskId);
          })
        );

        if (!currentGroup) {
          currentGroup = [];
          groups.push(currentGroup);
        }

        currentGroup.push(taskId);
      }

      completed.add(taskId);
    });

    return groups;
  }

  /**
   * 计算任务优先级
   */
  calculatePriority(task, allTasks) {
    if (!task.dependencies || task.dependencies.length === 0) {
      return 1; // 没有依赖的任务优先级最高
    }

    // 基于依赖深度计算优先级
    const dependencyDepth = this.getDependencyDepth(task, allTasks, new Set());
    return 1 / (dependencyDepth + 1);
  }

  /**
   * 获取任务依赖深度
   */
  getDependencyDepth(task, allTasks, visited) {
    if (visited.has(task.id)) return 0;
    visited.add(task.id);

    if (!task.dependencies || task.dependencies.length === 0) {
      return 0;
    }

    const depths = task.dependencies.map(depId => {
      const depTask = allTasks.find(t => t.id === depId);
      return depTask ? this.getDependencyDepth(depTask, allTasks, visited) : 0;
    });

    return Math.max(...depths) + 1;
  }

  /**
   * 检测循环依赖
   */
  detectCycles(tasks) {
    const { graph } = this.buildDependencyGraph(tasks);
    const visited = new Set();
    const recStack = new Set();

    const hasCycleDFS = (taskId) => {
      if (recStack.has(taskId)) return true;
      if (visited.has(taskId)) return false;

      visited.add(taskId);
      recStack.add(taskId);

      const dependents = graph.get(taskId) || [];
      for (const dependent of dependents) {
        if (hasCycleDFS(dependent)) {
          return true;
        }
      }

      recStack.delete(taskId);
      return false;
    };

    for (const taskId of graph.keys()) {
      if (hasCycleDFS(taskId)) {
        return true;
      }
    }

    return false;
  }
}
