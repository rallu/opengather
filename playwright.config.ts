import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "./e2e",
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: 1,
	reporter: "list",
	use: {
		baseURL: "http://127.0.0.1:5173",
		trace: "on-first-retry",
	},
	webServer: {
		command: "npm run dev -- --host 127.0.0.1 --port 5173",
		port: 5173,
		reuseExistingServer: true,
		timeout: 120000,
		env: {
			DATABASE_URL:
				process.env.DATABASE_URL ??
				"postgres://opengather:opengather@localhost:5432/opengather",
			BETTER_AUTH_SECRET:
				process.env.BETTER_AUTH_SECRET ?? "opengather-dev-secret",
			HUB_BASE_URL: process.env.HUB_BASE_URL ?? "http://127.0.0.1:9000",
		},
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],
});
