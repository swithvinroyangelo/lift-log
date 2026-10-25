import { defineConfig } from "@playwright/test";

// Builds the app WITH Supabase switched on, pointed at an address nothing listens on, so the sign-in screen
// and the signed-out redirects can be tested without touching a real project.
export default defineConfig({
  testDir: "./e2e",
  testMatch: /remote\.spec\.ts/,
  timeout: 60_000,
  workers: 1,
  use: {
    baseURL: "http://localhost:3200",
    viewport: { width: 390, height: 844 },
    launchOptions: { executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium" },
  },
  webServer: {
    command: "npm run build && npx next start -p 3200",
    url: "http://localhost:3200",
    reuseExistingServer: false,
    timeout: 180_000,
    env: { NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:9", NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_test" },
  },
});
