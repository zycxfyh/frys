import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * 无障碍性测试
 * 确保应用符合WCAG标准
 */

test.describe('无障碍性测试', { tags: ['accessibility', 'a11y'] }, () => {
  test('主页无障碍性检查', async ({ page }) => {
    await page.goto('/');

    // 运行axe-core无障碍性检查
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    // 验证没有严重级别的无障碍性问题
    const criticalViolations = accessibilityScanResults.violations.filter(
      violation => violation.impact === 'critical' || violation.impact === 'serious'
    );

    if (criticalViolations.length > 0) {
      console.log('发现严重无障碍性问题:');
      criticalViolations.forEach(violation => {
        console.log(`- ${violation.id}: ${violation.description}`);
        console.log(`  影响: ${violation.impact}`);
        console.log(`  帮助: ${violation.helpUrl}`);
      });
    }

    expect(criticalViolations).toHaveLength(0);
  });

  test('键盘导航测试', async ({ page }) => {
    await page.goto('/');

    // 移除鼠标，强制使用键盘导航
    await page.mouse.move(0, 0);

    // Tab键导航测试
    await page.keyboard.press('Tab');

    // 验证焦点在正确的元素上
    const focusedElement = await page.evaluate(() => document.activeElement);
    const focusedTagName = await page.evaluate(() => document.activeElement.tagName);

    // 焦点应该在可聚焦元素上（链接、按钮、输入框等）
    const focusableTags = ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'];
    expect(focusableTags).toContain(focusedTagName);
  });

  test('语义化HTML结构', async ({ page }) => {
    await page.goto('/');

    // 验证存在主要的语义化元素
    await expect(page.locator('header')).toBeVisible();
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('nav')).toBeVisible();

    // 验证页面有合适的标题
    const title = await page.title();
    expect(title).not.toBe('');
    expect(title.length).toBeGreaterThan(3);

    // 验证图片有alt属性
    const imagesWithoutAlt = await page.locator('img:not([alt])');
    await expect(imagesWithoutAlt).toHaveCount(0);
  });

  test('颜色对比度检查', async ({ page }) => {
    await page.goto('/');

    // 使用axe-core的颜色对比度规则
    const colorContrastResults = await new AxeBuilder({ page })
      .withRules(['color-contrast'])
      .analyze();

    const contrastViolations = colorContrastResults.violations.filter(
      v => v.id === 'color-contrast'
    );

    expect(contrastViolations).toHaveLength(0);
  });

  test('表单无障碍性', async ({ page }) => {
    await page.goto('/login');

    // 验证表单控件有标签
    const inputsWithoutLabels = await page.locator('input:not([aria-label]):not([aria-labelledby]):not([id])');
    const inputsWithIds = await page.locator('input[id]');
    const labelsForInputs = await page.locator('label');

    // 如果有input有id，应该有对应的label
    if (await inputsWithIds.count() > 0) {
      expect(await labelsForInputs.count()).toBeGreaterThan(0);
    }

    // 验证错误消息正确关联
    const errorMessages = await page.locator('[role="alert"], .error-message');
    if (await errorMessages.count() > 0) {
      // 错误消息应该通过aria-describedby关联到表单控件
      const describedBy = await page.locator('[aria-describedby]');
      expect(await describedBy.count()).toBeGreaterThan(0);
    }
  });

  test('屏幕阅读器兼容性', async ({ page }) => {
    await page.goto('/');

    // 验证ARIA属性正确使用
    const ariaElements = await page.locator('[aria-*]');
    const totalAriaElements = await ariaElements.count();

    if (totalAriaElements > 0) {
      // 检查ARIA属性值不为空
      for (let i = 0; i < totalAriaElements; i++) {
        const element = ariaElements.nth(i);
        const ariaLabel = await element.getAttribute('aria-label');
        const ariaLabelledBy = await element.getAttribute('aria-labelledby');

        // 如果有aria-label，值不应该为空
        if (ariaLabel !== null) {
          expect(ariaLabel.trim()).not.toBe('');
        }

        // 如果有aria-labelledby，应该存在对应的元素
        if (ariaLabelledBy) {
          const labelledElement = page.locator(`#${ariaLabelledBy}`);
          await expect(labelledElement).toBeVisible();
        }
      }
    }
  });
});
