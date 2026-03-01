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
		},
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],
});
