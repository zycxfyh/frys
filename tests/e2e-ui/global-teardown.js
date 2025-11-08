/**
 * Playwright 全局清理
 * 在所有测试结束后执行
 */

async function globalTeardown(config) {
  console.log('🧹 清理 E2E 测试环境...');

  // 这里可以添加全局清理逻辑
  // 例如：清理测试数据、重置数据库状态等

  console.log('✅ E2E 测试环境清理完成');
}

export default globalTeardown;
