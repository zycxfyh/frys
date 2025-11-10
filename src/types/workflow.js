/**
 * 工作流相关类型定义
 */

/**
 * 工作流定义
 * @typedef {Object} WorkflowDefinition
 * @property {string} name - 工作流名称
 * @property {string} [description] - 工作流描述
 * @property {TaskDefinition[]} tasks - 任务列表
 * @property {Object} [metadata] - 元数据
 */

/**
 * 任务定义
 * @typedef {Object} TaskDefinition
 * @property {string} [id] - 任务ID（可选，会自动生成）
 * @property {string} name - 任务名称
 * @property {TaskType} type - 任务类型
 * @property {Object} [config] - 任务配置
 * @property {string[]} [dependencies] - 依赖的任务ID列表
 * @property {number} [maxRetries] - 最大重试次数
 * @property {number} [retryDelay] - 重试延迟（毫秒）
 */

/**
 * 任务类型
 * @typedef {'http'|'script'|'delay'|'condition'} TaskType
 */

/**
 * 工作流实例
 * @typedef {Object} Workflow
 * @property {string} id - 工作流ID
 * @property {string} name - 工作流名称
 * @property {string} [description] - 工作流描述
 * @property {WorkflowStatus} status - 工作流状态
 * @property {Task[]} tasks - 任务列表
 * @property {Date} createdAt - 创建时间
 * @property {Date} [startedAt] - 开始时间
 * @property {Date} [completedAt] - 完成时间
 * @property {Date} [failedAt] - 失败时间
 * @property {Date} [cancelledAt] - 取消时间
 * @property {Date} updatedAt - 更新时间
 * @property {Object} [params] - 启动参数
 * @property {string} [error] - 错误信息
 * @property {Object} [metadata] - 元数据
 */

/**
 * 工作流状态
 * @typedef {'created'|'running'|'paused'|'completed'|'failed'|'cancelled'} WorkflowStatus
 */

/**
 * 任务实例
 * @typedef {Object} Task
 * @property {string} id - 任务ID
 * @property {string} name - 任务名称
 * @property {TaskType} type - 任务类型
 * @property {Object} config - 任务配置
 * @property {TaskStatus} status - 任务状态
 * @property {string[]} dependencies - 依赖的任务ID列表
 * @property {number} retryCount - 当前重试次数
 * @property {number} maxRetries - 最大重试次数
 * @property {number} retryDelay - 重试延迟（毫秒）
 * @property {Date} createdAt - 创建时间
 * @property {Date} [startedAt] - 开始时间
 * @property {Date} [completedAt] - 完成时间
 * @property {Date} [failedAt] - 失败时间
 * @property {Date} updatedAt - 更新时间
 * @property {any} [result] - 任务执行结果
 * @property {string} [error] - 错误信息
 * @property {Date} [nextRetryAt] - 下次重试时间
 */

/**
 * 任务状态
 * @typedef {'pending'|'running'|'completed'|'failed'|'retrying'} TaskStatus
 */

/**
 * 工作流事件
 * @typedef {Object} WorkflowEvent
 * @property {string} type - 事件类型
 * @property {string} workflowId - 工作流ID
 * @property {Workflow} workflow - 工作流实例
 * @property {Date} timestamp - 事件时间
 */

/**
 * 任务事件
 * @typedef {Object} TaskEvent
 * @property {string} type - 事件类型
 * @property {string} workflowId - 工作流ID
 * @property {string} taskId - 任务ID
 * @property {Task} task - 任务实例
 * @property {Workflow} workflow - 工作流实例
 * @property {any} [result] - 任务结果
 * @property {Error} [error] - 错误信息
 * @property {Date} timestamp - 事件时间
 */

/**
 * 工作流统计信息
 * @typedef {Object} WorkflowStats
 * @property {number} total - 总工作流数
 * @property {number} running - 运行中工作流数
 * @property {Object.<WorkflowStatus, number>} byStatus - 按状态统计
 * @property {number} [completedTasks] - 已完成任务数
 * @property {number} [failedTasks] - 失败任务数
 * @property {number} [runningTasks] - 运行中任务数
 * @property {number} [avgExecutionTime] - 平均执行时间（毫秒）
 */

/**
 * 工作流复杂度分析
 * @typedef {Object} WorkflowComplexity
 * @property {number} taskCount - 任务数量
 * @property {number} dependencyCount - 依赖数量
 * @property {number} maxDepth - 最大依赖深度
 * @property {boolean} hasCycles - 是否有循环依赖
 * @property {'simple'|'medium'|'complex'} complexity - 复杂度等级
 */

/**
 * 工作流验证结果
 * @typedef {Object} WorkflowValidation
 * @property {boolean} isValid - 是否有效
 * @property {string[]} errors - 错误信息列表
 */

export default {};
