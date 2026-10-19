import { defineConfig, devices } from "@playwright/test";

// E2E runs against a production build on a throwaway database (scripts/e2e/e2e-server.mjs owns
// the stack). One worker, no retries: specs intentionally share the seeded database, so parallel
// runs would race on the same records.
export default defineConfig({
  testDir: "e2e",
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:3210",
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    command: "node scripts/e2e/e2e-server.mjs",
    url: "http://localhost:3210/login",
    timeout: 300_000,
    reuseExistingServer: false,
    stdout: "pipe",
    stderr: "pipe",
  },
});
