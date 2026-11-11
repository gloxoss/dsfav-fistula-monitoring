import { defineConfig } from "@playwright/test";

// Smoke tests only run when WEB_URL points at a running web app (for example http://localhost:3000).
export default defineConfig({
  testDir: "./tests",
  reporter: [["list"], ["junit", { outputFile: "../reports/junit/e2e.xml" }]],
  use: {
    baseURL: process.env.WEB_URL,
  },
});
