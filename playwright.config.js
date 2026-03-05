import { defineConfig } from '@playwright/test';

const PORT = process.env.E2E_PORT || '5173';
const HOST = process.env.E2E_HOST || 'localhost';
const BASE_URL = `http://${HOST}:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: BASE_URL,
    headless: true,
    viewport: { width: 1280, height: 800 },
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'npm run start --prefix server',
      url: 'http://localhost:3000/health',
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: `npm run start -- --host ${HOST} --port ${PORT}`,
      url: BASE_URL,
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
