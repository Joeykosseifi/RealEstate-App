import { defineConfig, devices } from '@playwright/test';

/**
 * Committed, repeatable admin-web regression suite (Milestone 5, Phase
 * 17 audit gap-closure) — run via `npm run test:admin-web`, which is a
 * thin wrapper (`tests/run-admin-web-tests.mjs`) that also boots the API
 * and admin-web servers and seeds fixture data before invoking
 * `playwright test` with this config. Not a one-off script: every run
 * re-seeds fresh fixtures and re-executes the same 16 scenarios.
 */
export default defineConfig({
  testDir: './tests/specs',
  globalSetup: './tests/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  timeout: 30_000,
  use: {
    baseURL: process.env.ADMIN_WEB_BASE_URL ?? 'http://localhost:3001',
    trace: 'retain-on-failure',
    // Pre-authenticated by global-setup.ts — see its comment on why
    // (the real, unweakened login rate limiter). 01-auth.spec.ts
    // overrides this back to an empty/unauthenticated state, since it
    // specifically tests the real login form and session-expiry handling.
    storageState: './tests/.storage-state.json',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Pre-installed browser in this environment — see AGENTS root
        // notes on PLAYWRIGHT_BROWSERS_PATH; avoids a network download.
        launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
          ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
          : {},
      },
    },
  ],
});
