import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  timeout: 40_000,
  retries: 0,
  use: {
    baseURL: process.env.TEST_BASE_URL ?? "http://localhost:8080",
    ...devices["Desktop Chrome"],
    trace: "retain-on-failure",
  },
});
