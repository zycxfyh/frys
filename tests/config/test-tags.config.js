/**
 * 测试标签配置
 * 定义测试的分类和标签系统
 */

export const TEST_TAGS = {
  // 测试类型
  unit: 'unit',
  integration: 'integration',
  e2e: 'e2e',
  performance: 'performance',
  security: 'security',
  redteam: 'red-team',

  // 组件分类
  core: 'core',
  infrastructure: 'infrastructure',
  application: 'application',
  domain: 'domain',
  presentation: 'presentation',
  services: 'services',

  // 功能分类
  http: 'http',
  auth: 'auth',
  database: 'database',
  messaging: 'messaging',
  caching: 'caching',
  state: 'state',
  utils: 'utils',
  workflow: 'workflow',
  ai: 'ai',
  vcp: 'vcp',

  // 测试特性
  smoke: 'smoke',
  regression: 'regression',
  critical: 'critical',
  slow: 'slow',
  flaky: 'flaky',
  network: 'network',
  container: 'container',
};

export const TAG_DESCRIPTIONS = {
  [TEST_TAGS.unit]: '单元测试 - 测试单个函数/组件',
  [TEST_TAGS.integration]: '集成测试 - 测试组件间协作',
  [TEST_TAGS.e2e]: '端到端测试 - 完整用户流程',
  [TEST_TAGS.performance]: '性能测试 - 响应时间和吞吐量',
  [TEST_TAGS.security]: '安全测试 - 漏洞和权限检查',
  [TEST_TAGS.redteam]: '红队测试 - 攻击模拟和渗透测试',

  [TEST_TAGS.core]: '核心组件 - 基础功能模块',
  [TEST_TAGS.infrastructure]: '基础设施 - 数据库、消息队列等',
  [TEST_TAGS.application]: '应用层 - 业务逻辑',
  [TEST_TAGS.domain]: '领域层 - 业务规则',
  [TEST_TAGS.presentation]: '表现层 - API和界面',
  [TEST_TAGS.services]: '服务层 - 外部服务集成',

  [TEST_TAGS.smoke]: '冒烟测试 - 快速验证基础功能',
  [TEST_TAGS.regression]: '回归测试 - 防止功能退化',
  [TEST_TAGS.critical]: '关键路径测试 - 核心业务流程',
  [TEST_TAGS.slow]: '慢速测试 - 需要较长时间',
  [TEST_TAGS.flaky]: '不稳定测试 - 可能间歇性失败',
  [TEST_TAGS.network]: '网络测试 - 需要网络连接',
  [TEST_TAGS.container]: '容器测试 - 需要Docker环境',
};

export const TAG_PRIORITIES = {
  [TEST_TAGS.critical]: 1,
  [TEST_TAGS.smoke]: 2,
  [TEST_TAGS.unit]: 3,
  [TEST_TAGS.integration]: 4,
  [TEST_TAGS.e2e]: 5,
  [TEST_TAGS.performance]: 6,
  [TEST_TAGS.security]: 7,
  [TEST_TAGS.redteam]: 8,
  [TEST_TAGS.regression]: 9,
  [TEST_TAGS.slow]: 10,
  [TEST_TAGS.flaky]: 10,
};

/**
 * 获取测试的优先级分数
 * @param {string[]} tags - 测试标签数组
 * @returns {number} 优先级分数，越小越优先
 */
export function getTestPriority(tags) {
  const priorities = tags.map(tag => TAG_PRIORITIES[tag] || 999);
  return Math.min(...priorities);
}

/**
 * 检查测试是否包含指定标签
 * @param {string[]} testTags - 测试标签数组
 * @param {string|string[]} requiredTags - 必需标签
 * @returns {boolean}
 */
export function hasTags(testTags, requiredTags) {
  const required = Array.isArray(requiredTags) ? requiredTags : [requiredTags];
  return required.every(tag => testTags.includes(tag));
}

/**
 * 获取标签的描述
 * @param {string} tag - 标签名
 * @returns {string} 标签描述
 */
export function getTagDescription(tag) {
  return TAG_DESCRIPTIONS[tag] || `未知标签: ${tag}`;
}

/**
 * 按优先级排序测试标签
 * @param {string[]} tags - 测试标签数组
 * @returns {string[]} 排序后的标签数组
 */
export function sortTagsByPriority(tags) {
  return tags.sort((a, b) => {
    const priorityA = TAG_PRIORITIES[a] || 999;
    const priorityB = TAG_PRIORITIES[b] || 999;
    return priorityA - priorityB;
  });
}
