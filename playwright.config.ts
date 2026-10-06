import { defineConfig, devices } from "@playwright/test";

/**
 * QA JOO's own end-to-end suite: the QA platform testing itself with Playwright.
 * Runs against a production build (`npm run build` first) in demo mode with the in-memory store,
 * the rule-based AI provider and the local automation runner targeting the bundled sandbox app.
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    viewport: { width: 1440, height: 900 },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `${BASE_URL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      QA_JOO_DEMO_MODE: "true",
      QA_JOO_DATA_FILE: "memory",
      QA_JOO_ARTIFACT_DIR: ".data/e2e-artifacts",
      QA_JOO_PUBLIC_URL: BASE_URL,
      RUNNER_CALLBACK_SECRET: "e2e-runner-secret",
      ALLOW_PRIVATE_NETWORK_TARGETS: "true",
      AUTOMATION_RUNNER: "local",
      AI_PROVIDER: "heuristic",
      NEXT_PUBLIC_SUPABASE_URL: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
    },
  },
});
