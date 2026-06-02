import { defineConfig } from "@playwright/test";
import { dirname } from "path";
import { fileURLToPath } from "url";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  testDir: "tests",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: "http://127.0.0.1:8812",
    trace: "on-first-retry",
  },
  webServer: {
    command: "python3 -m http.server 8812",
    cwd: root,
    url: "http://127.0.0.1:8812/",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
