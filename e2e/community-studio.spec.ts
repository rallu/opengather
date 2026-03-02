import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

async function isSetupRequired(
	page: import("@playwright/test").Page,
): Promise<boolean> {
	await page.goto("/");
	return page.getByTestId("home-run-setup-link").isVisible().catch(() => false);
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
			await expect(page.getByTestId("feed-composer")).toBeVisible();
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
		await page.goto("/feed");
		await expect(page.getByTestId("feed-composer")).toBeVisible();
		await expect(page.getByTestId("feed-post-button")).toBeVisible();
		await expect(page.getByTestId("shell-search")).toBeVisible();
	});
});
