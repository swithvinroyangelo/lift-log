import { defineConfig } from "@playwright/test";

// Uses the Chromium that is already installed in this workspace. Do not download browsers.
export default defineConfig({
  testDir: "./e2e",
  testIgnore: /remote\.spec\.ts/,
  timeout: 60_000,
  retries: 0,
  workers: 1,
  use: {
    baseURL: "http://localhost:3100",
    viewport: { width: 390, height: 844 },
    launchOptions: { executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium" },
  },
  webServer: {
    command: "npm run build && npx next start -p 3100",
    env: { NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_ANON_KEY: "" }, // these tests run on browser storage
    url: "http://localhost:3100",
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
