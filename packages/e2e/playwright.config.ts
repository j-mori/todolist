import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env.CI;

const browserList = (process.env.PLAYWRIGHT_BROWSERS ?? 'chromium')
  .split(',')
  .map((name) => name.trim())
  .filter((name) => name.length > 0);

const projectByName = {
  chromium: { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  firefox: { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  webkit: { name: 'webkit', use: { ...devices['Desktop Safari'] } },
} as const;

const projects = browserList.map((name) => {
  const project = projectByName[name as keyof typeof projectByName];
  if (!project) throw new Error(`Unknown browser: ${name}. Use chromium, firefox, or webkit.`);
  return project;
});

export default defineConfig({
  testDir: './tests',
  // Tests share the BE's single SQLite database, so they must run serially —
  // parallel `cleanDb` fixtures would race with each other and with in-flight
  // mutations from other tests. The suite is small enough that the runtime
  // cost is negligible.
  fullyParallel: false,
  workers: 1,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  globalSetup: './playwright/global-setup.ts',
  globalTeardown: './playwright/global-teardown.ts',
  expect: { timeout: 5_000 },
  timeout: 30_000,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:8081',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects,
});
