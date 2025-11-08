import { test, expect } from '@playwright/test';

/**
 * 示例 E2E 测试
 * 演示基本的页面交互和断言
 */

test.describe('frys 应用', { tags: ['e2e', 'ui'] }, () => {
  test('应该能够加载主页', async ({ page }) => {
    // 导航到应用主页
    await page.goto('/');

    // 验证页面标题
    await expect(page).toHaveTitle(/frys/);

    // 验证主要内容区域存在
    const mainContent = page.locator('main');
    await expect(mainContent).toBeVisible();
  });

  test('应该能够处理用户登录流程', async ({ page }) => {
    // 导航到登录页面
    await page.goto('/login');

    // 填写登录表单
    await page.fill('[data-testid="username"]', 'testuser');
    await page.fill('[data-testid="password"]', 'testpass');

    // 点击登录按钮
    await page.click('[data-testid="login-button"]');

    // 验证登录成功（检查重定向或成功消息）
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('应该支持响应式设计', async ({ page, isMobile }) => {
    await page.goto('/');

    if (isMobile) {
      // 在移动设备上验证移动菜单
      const mobileMenu = page.locator('[data-testid="mobile-menu"]');
      await expect(mobileMenu).toBeVisible();
    } else {
      // 在桌面设备上验证导航栏
      const navBar = page.locator('[data-testid="navbar"]');
      await expect(navBar).toBeVisible();
    }
  });

  test('应该正确处理错误状态', async ({ page }) => {
    // 导航到不存在的页面
    await page.goto('/nonexistent-page');

    // 验证显示404错误页面
    const errorMessage = page.locator('[data-testid="error-message"]');
    await expect(errorMessage).toContainText('404');
  });

  test('应该支持搜索功能', async ({ page }) => {
    await page.goto('/search');

    // 输入搜索查询
    await page.fill('[data-testid="search-input"]', 'workflow');

    // 点击搜索按钮
    await page.click('[data-testid="search-button"]');

    // 验证搜索结果
    const results = page.locator('[data-testid="search-results"]');
    await expect(results).toBeVisible();

    // 验证至少有一个结果
    const resultItems = page.locator('[data-testid="result-item"]');
    await expect(resultItems.first()).toBeVisible();
  });

  test('性能测试 - 页面加载时间', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/');

    // 等待页面完全加载
    await page.waitForLoadState('networkidle');

    const loadTime = Date.now() - startTime;

    // 验证页面加载时间不超过5秒
    expect(loadTime).toBeLessThan(5000);
  });
});
