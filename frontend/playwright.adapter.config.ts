import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "adapter.spec.ts",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5174",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {},
  },
  webServer: [
    {
      command: "cd .. && uv run uvicorn backend.main:app --port 8002",
      url: "http://127.0.0.1:8002/api/health",
      reuseExistingServer: false,
    },
    {
      command: "npm run dev -- --port 5174",
      url: "http://127.0.0.1:5174",
      env: { SWITCHBOARD_API_TARGET: "http://127.0.0.1:8002" },
      reuseExistingServer: false,
    },
  ],
});
