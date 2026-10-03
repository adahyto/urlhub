import { defineConfig, devices } from '@playwright/test';

// The app as built for production, talking to a fake ldb-api (tests/e2e/fake-ldb-api.mjs) instead of the real
// one: CI has no ldb-api, and real pages would make the results change from run to run
export const API_PORT = 13901;
const APP_PORT = 4173;

export default defineConfig({
	testDir: 'tests/e2e',
	// The fake API keeps the requests it got; tests read them, so one at a time
	workers: 1,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
	use: {
		baseURL: `http://127.0.0.1:${APP_PORT}`,
		trace: 'retain-on-failure'
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	webServer: [
		{
			command: 'node tests/e2e/fake-ldb-api.mjs',
			url: `http://127.0.0.1:${API_PORT}/health`,
			env: { FAKE_API_PORT: String(API_PORT) },
			reuseExistingServer: !process.env.CI
		},
		{
			command: 'npm run build && node build',
			url: `http://127.0.0.1:${APP_PORT}/health`,
			timeout: 180_000,
			env: {
				PORT: String(APP_PORT),
				ORIGIN: `http://127.0.0.1:${APP_PORT}`,
				HOST: '127.0.0.1',
				LDB_API_URL: `http://127.0.0.1:${API_PORT}/json`,
				// Short links of the tests, out of the repository's way (test-results is ignored by git)
				DATA_DIR: 'test-results/data',
				// The fake ldb-api's pictures are on 127.0.0.1, which /img refuses on the server
				IMAGE_PROXY_ALLOW_PRIVATE: '1'
			},
			reuseExistingServer: !process.env.CI
		}
	]
});
