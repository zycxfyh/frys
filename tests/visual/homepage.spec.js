import { test, expect } from '@playwright/test';

/**
 * 视觉回归测试
 * 确保UI外观的一致性
 */

test.describe('视觉回归测试', { tags: ['visual', 'regression'] }, () => {
  test('主页视觉快照', async ({ page }) => {
    await page.goto('/');

    // 等待页面完全加载
    await page.waitForLoadState('networkidle');

    // 截取全页面快照
    await expect(page).toHaveScreenshot('homepage-full.png', {
      fullPage: true,
      threshold: 0.1, // 允许10%的差异
    });
  });

  test('导航栏视觉快照', async ({ page }) => {
    await page.goto('/');

    // 聚焦导航栏
    const navbar = page.locator('[data-testid="navbar"]');
    await expect(navbar).toBeVisible();

    // 截取导航栏快照
    await expect(navbar).toHaveScreenshot('navbar.png', {
      threshold: 0.05, // 允许5%的差异
    });
  });

  test('不同屏幕尺寸的响应式设计', async ({ page }) => {
    await page.goto('/');

    // 测试移动端视图
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page).toHaveScreenshot('homepage-mobile.png', {
      fullPage: true,
    });

    // 测试平板视图
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page).toHaveScreenshot('homepage-tablet.png', {
      fullPage: true,
    });

    // 测试桌面视图
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(page).toHaveScreenshot('homepage-desktop.png', {
      fullPage: true,
    });
  });

  test('暗色模式切换', async ({ page }) => {
    await page.goto('/');

    // 检查是否有暗色模式切换按钮
    const themeToggle = page.locator('[data-testid="theme-toggle"]');

    if (await themeToggle.isVisible()) {
      // 截取亮色模式快照
      await expect(page).toHaveScreenshot('homepage-light-theme.png');

      // 切换到暗色模式
      await themeToggle.click();

      // 等待主题切换完成
      await page.waitForTimeout(500);

      // 截取暗色模式快照
      await expect(page).toHaveScreenshot('homepage-dark-theme.png');
    }
  });

  test('悬停状态视觉测试', async ({ page }) => {
    await page.goto('/');

    // 查找可悬停的元素
    const hoverElement = page.locator('[data-testid="hover-element"]').first();

    if (await hoverElement.isVisible()) {
      // 截取默认状态
      await expect(hoverElement).toHaveScreenshot('element-default.png');

      // 悬停元素
      await hoverElement.hover();

      // 截取悬停状态
      await expect(hoverElement).toHaveScreenshot('element-hover.png');
    }
  });
});
