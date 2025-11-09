import { defineConfig, devices } from '@playwright/test';

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests/e2e-ui',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only - 更智能的重试策略 */
  retries: process.env.CI ? 3 : 1,
  /* Workers based on available resources */
  workers: process.env.CI
    ? Math.max(1, Math.floor(require('os').cpus().length / 4))
    : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/playwright-results.json' }],
    ['junit', { outputFile: 'test-results/playwright-junit.xml' }],
    ['github'],
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.BASE_URL || 'http://localhost:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: process.env.CI ? 'retain-on-failure' : 'on-first-retry',

    /* Take screenshot only when test fails */
    screenshot: process.env.CI ? 'only-on-failure' : 'on',

    /* Record video only when test fails */
    video: process.env.CI ? 'retain-on-failure' : 'off',

    /* CI环境优化 */
    ...(process.env.CI && {
      actionTimeout: 10000,
      navigationTimeout: 30000,
      headless: true,
      ignoreHTTPSErrors: true,
    }),
  },

  /* Configure projects for major browsers - CI环境优化 */
  projects: [
    // CI环境只运行Chromium以提高速度
    ...(process.env.CI
      ? [
          {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
          },
        ]
      : [
          {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
          },
          {
            name: 'firefox',
            use: { ...devices['Desktop Firefox'] },
          },
          {
            name: 'webkit',
            use: { ...devices['Desktop Safari'] },
          },
          /* Test against mobile viewports. */
          {
            name: 'Mobile Chrome',
            use: { ...devices['Pixel 5'] },
          },
          {
            name: 'Mobile Safari',
            use: { ...devices['iPhone 12'] },
          },
        ]),
  ],

  /* Run your local dev server before starting the tests */
  webServer: process.env.CI
    ? undefined
    : {
        command: 'npm run dev',
        port: 3000,
        reuseExistingServer: !process.env.CI,
      },

  /* Global Setup */
  globalSetup: require.resolve('./tests/e2e-ui/global-setup'),

  /* Global Teardown */
  globalTeardown: require.resolve('./tests/e2e-ui/global-teardown'),
});
