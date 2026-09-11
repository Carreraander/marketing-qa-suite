import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  globalSetup: './lib/preflight.ts',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // Layout measurement is memory-heavy: concurrent browsers crash the renderer
  // on a modest host, and a crashed page reports as a site defect. Determinism
  // beats speed for a measurement suite, so this runs serial by default.
  // Raise it on a bigger runner with PW_WORKERS.
  fullyParallel: false,
  workers: process.env.PW_WORKERS ? Number(process.env.PW_WORKERS) : 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.BASE_URL ?? 'https://example.com',
    // /dev/shm is tiny on most CI containers and small VPSes; without this the
    // renderer runs out of shared memory and the page dies mid-test, which looks
    // like a site defect and is not one.
    launchOptions: {
      args: [
        // Wide viewports crash the renderer on constrained hosts; these three
        // keep it alive. A crashed page reports as a site defect and is not one,
        // so this is a correctness setting, not a performance tweak.
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
      ],
    },
    reducedMotion: 'reduce',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // Enable once the client provides a WebKit-capable runner (BrowserStack or local macOS).
    // Emulated Safari is not Safari; keep this opt-in so reports never overclaim coverage.
    // { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
