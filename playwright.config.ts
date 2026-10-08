import { defineConfig } from '@playwright/test'

const PORT = Number(process.env.E2E_PORT || 3001)
const BASE_URL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  globalSetup: './e2e/global-setup',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npx vite build && npx tsx src/server.ts',
    url: `${BASE_URL}/health`,
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
    env: {
      ...process.env,
      PORT: String(PORT),
      SERVE_STATIC: 'true',
      MP_LOCAL_MODE: 'true',
      APP_URL: BASE_URL,
    },
  },
})