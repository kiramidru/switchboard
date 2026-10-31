import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testIgnore: 'adapter.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:8001',
    viewport: { width: 1440, height: 1100 },
    browserName: 'chromium',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    } : {},
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'cd .. && uv run uvicorn backend.main:app --host 127.0.0.1 --port 8001',
    url: 'http://127.0.0.1:8001/api/health',
    env: { OPENAI_API_KEY: '' },
    reuseExistingServer: false,
    timeout: 60000,
  },
});
