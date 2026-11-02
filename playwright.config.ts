import { defineConfig } from "@playwright/test";
const baseURL = "http://localhost:8080";
export default defineConfig({
  testDir: "./tests/browser",
  testMatch: "**/*.pw.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 90000,
  expect: { timeout: 20000 },
  outputDir: ".tmp/visual/results",
  reporter: [
    ["list"],
    ["html", { outputFolder: ".tmp/visual/report", open: "never" }],
  ],
  use: {
    baseURL,
    channel: "chrome",
    headless: true,
    colorScheme: "dark",
    timezoneId: "Africa/Lagos",
    reducedMotion: "reduce",
    trace: "off",
    video: "off",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 1000 } } },
    {
      name: "mobile",
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});
