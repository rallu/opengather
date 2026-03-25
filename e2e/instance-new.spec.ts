import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

async function expectConfiguredLanding(
	page: import("@playwright/test").Page,
): Promise<void> {
	if (page.url().endsWith("/feed")) {
		await expect(page.getByTestId("shell-main")).toBeVisible();
		await expect(page.getByTestId("feed-setup-error")).not.toBeVisible();
		return;
	}

	await expect(page.getByTestId("home-instance-ready")).toBeVisible();
}

async function isSetupRequired(
	page: import("@playwright/test").Page,
): Promise<boolean> {
	await page.goto("/");
	return page
		.getByTestId("home-run-setup-link")
		.isVisible()
		.catch(() => false);
}

async function moveToInstanceStep(
	page: import("@playwright/test").Page,
): Promise<boolean> {
	const setupRequired = await isSetupRequired(page);
	if (!setupRequired) {
		return false;
	}

	await page.goto("/setup");
	await expect(page.getByTestId("setup-name")).toBeVisible();
	return true;
}

test.describe("setup wizard", () => {
	test("navigates to setup from home", async ({ page }) => {
		const setupRequired = await isSetupRequired(page);

		if (setupRequired) {
			await page.getByTestId("home-run-setup-link").click();
			await expect(page).toHaveURL(/\/setup$/);
			await expect(page.getByTestId("setup-title")).toBeVisible();
			return;
		}

		await page.goto("/setup");
		await expect(page).toHaveURL(/\/$|\/feed$/);
		await expectConfiguredLanding(page);
	});

	test("renders setup controls and defaults", async ({ page }) => {
		const setupRequired = await moveToInstanceStep(page);
		test.skip(
			!setupRequired,
			"Instance already configured; setup form not available.",
		);
		await expect(page.getByTestId("setup-title")).toBeVisible();

		await page.getByTestId("setup-name").fill("OpenGather Finland");
		await page
			.getByTestId("setup-description")
			.fill("Community for collaborative text posts");
		await page.getByTestId("setup-admin-name").fill("Admin User");
		await page.getByTestId("setup-admin-email").fill("admin@example.com");
		await page.getByTestId("setup-admin-password").fill("admin-pass-123");
		await page.getByTestId("setup-visibility").selectOption("registered");
		await page.getByTestId("setup-approval").selectOption("manual");

		await expect(page.getByTestId("setup-name")).toHaveValue(
			"OpenGather Finland",
		);
		await expect(page.getByTestId("setup-admin-email")).toHaveValue(
			"admin@example.com",
		);
		await expect(page.getByTestId("setup-visibility")).toHaveValue(
			"registered",
		);
		await expect(page.getByTestId("setup-approval")).toHaveValue("manual");
	});

	test("runs setup progress and unlocks login controls", async ({ page }) => {
		const setupRequired = await moveToInstanceStep(page);
		if (!setupRequired) {
			await page.goto("/");
			await expectConfiguredLanding(page);
			await expect(page.getByTestId("home-run-setup-link")).not.toBeVisible();
			const homeSignInLink = page.getByTestId("home-sign-in-link");
			const shellSignInLink = page.getByTestId("shell-sign-in-link");
			await expect(async () => {
				const homeVisible = await homeSignInLink.isVisible().catch(() => false);
				const shellVisible = await shellSignInLink
					.isVisible()
					.catch(() => false);
				expect(homeVisible || shellVisible).toBe(true);
			}).toPass();
			if (await homeSignInLink.isVisible().catch(() => false)) {
				await homeSignInLink.click();
			} else {
				await shellSignInLink.click();
			}
			await expect(page.getByTestId("login-title")).toBeVisible();
			return;
		}

		await page.getByTestId("setup-name").fill("OpenGather Local");
		await page.getByTestId("setup-description").fill("Local test instance");
		await page.getByTestId("setup-admin-name").fill("Admin User");
		await page.getByTestId("setup-admin-email").fill("admin@example.com");
		await page.getByTestId("setup-admin-password").fill("admin-pass-123");
		await page.getByTestId("setup-submit").click();

		await expect(page).toHaveURL(/\/$|\/feed$/);
		await expectConfiguredLanding(page);
		await expect(page.getByTestId("home-run-setup-link")).not.toBeVisible();
		await page.goto("/login");
		await expect(page.getByTestId("login-title")).toBeVisible();
	});

	test("keeps google auth hidden when not configured", async ({ page }) => {
		await page.goto("/login");
		await expect(page.getByTestId("login-google-button")).not.toBeVisible();

		await page.goto("/register");
		await expect(page.getByTestId("register-google-button")).not.toBeVisible();
	});

	test("redirects setup page to home after setup is completed", async ({
		page,
	}) => {
		await page.goto("/setup");
		await expect(page).toHaveURL(/\/$|\/feed$/);
		await expectConfiguredLanding(page);
	});

	test("community no longer shows setup error after setup", async ({
		page,
	}) => {
		await page.goto("/feed");
		await expect(page.getByTestId("shell-main")).toBeVisible();
		await expect(page.getByTestId("feed-setup-error")).not.toBeVisible();
	});
});
