import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "./e2e",
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: 1,
	reporter: "list",
	use: {
		baseURL: "http://127.0.0.1:4173",
		trace: "on-first-retry",
	},
	webServer: {
		command:
			"bash ./scripts/prepare-e2e-environment.sh && npm run dev -- --host 127.0.0.1 --port 4173",
		port: 4173,
		reuseExistingServer: false,
		timeout: 120000,
		env: {
			APP_BASE_URL: "http://127.0.0.1:4173",
			DATABASE_URL:
				process.env.DATABASE_URL ??
				"postgres://opengather:opengather@127.0.0.1:5433/opengather_e2e",
			BETTER_AUTH_SECRET:
				process.env.BETTER_AUTH_SECRET ?? "opengather-dev-secret",
			HUB_BASE_URL: process.env.HUB_BASE_URL ?? "http://127.0.0.1:9000",
			AUTH_RATE_LIMIT_MAX_REQUESTS:
				process.env.AUTH_RATE_LIMIT_MAX_REQUESTS ?? "500",
			MEDIA_LOCAL_ROOT:
				process.env.MEDIA_LOCAL_ROOT ?? "./.playwright/storage/media",
			STORAGE_ROOT: process.env.STORAGE_ROOT ?? "./.playwright/storage",
		},
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],
});
