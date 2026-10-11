import { defineConfig, devices } from "@playwright/test";

const isCi = Boolean(process.env["CI"]);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCi,
  retries: isCi ? 2 : 0,
  ...(isCi ? { workers: 1 } : {}),
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: "http://localhost:5173/alhikmah-english-platform/",
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
    {
      name: "Mobile Safari",
      use: {
        ...devices["iPhone 12"],
        viewport: { width: 375, height: 667 },
      },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:5173/alhikmah-english-platform/",
    reuseExistingServer: !isCi,
    timeout: 120 * 1000,
  },
});
