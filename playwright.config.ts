import { defineConfig, devices } from "@playwright/test";
import { stagingEnabled } from "./e2e/support/env";

// Browser tests. By default the app runs against an unreachable Supabase address, so only
// signed-out screens are tested and nothing real is touched. Signed-in flows run only when
// a staging project is configured (see README, "Browser tests").
const PORT = 3100;
const BASE = `http://localhost:${PORT}`;
const staging = stagingEnabled();

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  globalSetup: "./e2e/support/global-setup.ts",
  globalTeardown: "./e2e/support/global-teardown.ts",
  use: { baseURL: BASE, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "phone",
      use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 812 } },
    },
  ],
  webServer: {
    command: `npx next build && npx next start -p ${PORT}`,
    url: `${BASE}/login`,
    reuseExistingServer: false,
    timeout: 300_000,
    env: {
      NEXT_DIST_DIR: ".next-e2e",
      NEXT_PUBLIC_SUPABASE_URL: staging
        ? process.env.E2E_SUPABASE_URL!
        : "http://127.0.0.1:9",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: staging
        ? process.env.E2E_SUPABASE_ANON_KEY!
        : "e2e-anon-key",
      SUPABASE_SERVICE_ROLE_KEY: staging
        ? process.env.E2E_SUPABASE_SERVICE_ROLE_KEY!
        : "e2e-service-key",
      NEXT_PUBLIC_SITE_URL: BASE,
      // Never send real email from browser tests.
      RESEND_API_KEY: "",
      SAM_EMAIL: "sam@example.test",
      ADMIN_EMAIL: "",
      CRON_SECRET: "e2e-cron-secret",
      DEFAULT_USER_PASSWORD: "E2e-starting-password-1",
    },
  },
});
