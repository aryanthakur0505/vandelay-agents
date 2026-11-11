import { defineConfig } from '@playwright/test'

// End-to-end tests drive the built app (`npm run build` first) through Playwright's Electron support.
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list'
})
