import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  // The games load many local art/audio assets; parallel Chromium workers can exhaust
  // local test resources and turn a real card failure into a spurious navigation error.
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    browserName: 'chromium',
    headless: true,
    viewport: { width: 1280, height: 800 },
  },
  webServer: {
    command: 'python3 -m http.server 4173 --directory .',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
  },
});
