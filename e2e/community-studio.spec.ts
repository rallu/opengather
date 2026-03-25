import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

async function isSetupRequired(
	page: import("@playwright/test").Page,
): Promise<boolean> {
	await page.goto("/");
	return page
		.getByTestId("home-run-setup-link")
		.isVisible()
		.catch(() => false);
}

async function ensureConfiguredInstance(
	page: import("@playwright/test").Page,
): Promise<void> {
	const setupRequired = await isSetupRequired(page);
	if (!setupRequired) {
		return;
	}

	await page.goto("/setup");
	await expect(page.getByTestId("setup-name")).toBeVisible();
	await page.getByTestId("setup-name").fill("OpenGather Local");
	await page.getByTestId("setup-description").fill("Local test instance");
	await page.getByTestId("setup-admin-name").fill("Admin User");
	await page.getByTestId("setup-admin-email").fill("admin@example.com");
	await page.getByTestId("setup-admin-password").fill("admin-pass-123");
	await page.getByTestId("setup-submit").click();
	await expect(page).toHaveURL(/\/$|\/feed$/);
}

async function expectGuestShell(
	page: import("@playwright/test").Page,
): Promise<void> {
	await expect(page.getByTestId("shell-nav-feed")).toBeVisible();
	await expect(page.getByTestId("shell-nav-notifications")).toHaveCount(0);
	await expect(page.getByTestId("shell-nav-profile")).toHaveCount(0);
	await expect(page.getByTestId("shell-nav-settings")).toHaveCount(0);
	await expect(page.getByTestId("shell-nav-server")).toHaveCount(0);
	await expect(page.getByTestId("shell-search")).toBeVisible();
	await expect(page.getByTestId("shell-sign-in-link")).toBeVisible();
	await expect(page.getByTestId("shell-register-link")).toBeVisible();
}

test.describe("home", () => {
	test("shows setup-first and hub-login controls", async ({ page }) => {
		const setupRequired = await isSetupRequired(page);

		if (setupRequired) {
			await expect(page.getByTestId("home-title")).toBeVisible();
			await expect(page.getByTestId("home-run-setup-link")).toBeVisible();
			await expect(page.getByTestId("home-sign-in-link")).not.toBeVisible();
			return;
		}

		if (page.url().endsWith("/feed")) {
			await expectGuestShell(page);
			await expect(page.getByTestId("feed-composer")).toHaveCount(0);
			await expect(page.getByTestId("feed-post-button")).toHaveCount(0);
			await expect(page.getByTestId("feed-reply-composer")).toHaveCount(0);
		} else {
			await expect(page.getByTestId("home-instance-ready")).toBeVisible();
			await expect(page.getByTestId("home-sign-in-link")).toBeVisible();
		}
	});

	test("redirects auth pages to setup before setup is completed", async ({
		page,
	}) => {
		const setupRequired = await isSetupRequired(page);

		await page.goto("/login");
		if (setupRequired) {
			await expect(page).toHaveURL(/\/setup$/);
		} else {
			await expect(page).toHaveURL(/\/login$/);
		}

		await page.goto("/register");
		if (setupRequired) {
			await expect(page).toHaveURL(/\/setup$/);
		} else {
			await expect(page).toHaveURL(/\/register$/);
		}
	});

	test("community page renders MVP controls", async ({ page }) => {
		await ensureConfiguredInstance(page);
		await page.goto("/feed");
		await expectGuestShell(page);
		await expect(page.getByTestId("feed-composer")).toHaveCount(0);
		await expect(page.getByTestId("feed-post-button")).toHaveCount(0);
		await expect(page.getByTestId("feed-reply-composer")).toHaveCount(0);
	});

	test("guest shell routes open without exposing member navigation", async ({
		page,
	}) => {
		await ensureConfiguredInstance(page);

		for (const route of [
			"/feed",
			"/notifications",
			"/profile",
			"/settings",
			"/server-settings",
			"/audit-logs",
		]) {
			await page.goto(route);
			await expect(page.getByTestId("shell-main")).toBeVisible();
			await expectGuestShell(page);
		}
	});

	test("mobile shell exposes navigation and details drawers", async ({
		page,
	}) => {
		await ensureConfiguredInstance(page);
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto("/feed");

		await expect(page.getByTestId("shell-mobile-nav-trigger")).toBeVisible();
		await expect(page.getByTestId("shell-mobile-details-trigger")).toBeVisible();

		await page.getByTestId("shell-mobile-nav-trigger").click();
		await expect(page.getByTestId("shell-mobile-nav-drawer")).toBeVisible();
		await expect(page.getByTestId("shell-search-mobile")).toBeVisible();
		await expect(page.getByTestId("shell-sign-in-link-mobile")).toBeVisible();
		await expect(
			page
				.getByTestId("shell-mobile-nav-drawer")
				.getByTestId("shell-nav-feed-mobile"),
		).toBeVisible();

		await page.getByLabel("Close navigation").click();
		await expect(page.getByTestId("shell-mobile-nav-drawer")).not.toBeVisible();

		await page.getByTestId("shell-mobile-details-trigger").click();
		await expect(page.getByTestId("shell-mobile-details-drawer")).toBeVisible();
		await expect(
			page
				.getByTestId("shell-mobile-details-drawer")
				.getByTestId("feed-sort-activity"),
		).toBeVisible();
	});
});
