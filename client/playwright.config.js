import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './test/e2e',
  timeout: 30000,
  retries: 0,
  workers: 1, // tests share fixed ports 15555/15556; parallel workers would cause EADDRINUSE
  use: {
    browserName: 'chromium',
    headless: true,
  },
})
