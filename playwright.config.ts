import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5177',
    channel: 'msedge',
    headless: true,
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5177',
      url: 'http://127.0.0.1:5177',
      reuseExistingServer: true,
      timeout: 30000,
    },
    {
      command: 'node --import tsx/esm server/index.ts',
      url: 'http://127.0.0.1:8787/api/site',
      reuseExistingServer: true,
      timeout: 30000,
      env: {
        ADMIN_PASSWORD: 'playwright-admin-password-123456',
        SESSION_SECRET: 'playwright-session-secret-12345678901234567890',
        DATABASE_PATH: './data/playwright.sqlite',
      },
    },
  ],
})
