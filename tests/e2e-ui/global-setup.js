/**
 * Playwright 全局设置
 * 在所有测试开始前执行
 */

async function globalSetup(config) {
  console.log('🚀 设置 E2E 测试环境...');

  // 这里可以添加全局设置逻辑
  // 例如：准备测试数据库、设置测试数据等

  console.log('✅ E2E 测试环境设置完成');
}

export default globalSetup;
