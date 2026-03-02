import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

async function isSetupRequired(
	page: import("@playwright/test").Page,
): Promise<boolean> {
	await page.goto("/");
	return page
		.getByRole("link", { name: "Run First Setup" })
		.isVisible()
		.catch(() => false);
}

test.describe("home", () => {
	test("shows setup-first and hub-login controls", async ({ page }) => {
		const setupRequired = await isSetupRequired(page);

		if (setupRequired) {
			await expect(
				page.getByRole("heading", { name: "OpenGather MVP" }),
			).toBeVisible();
			await expect(
				page.getByRole("link", { name: "Run First Setup" }),
			).toBeVisible();
			await expect(
				page.getByRole("link", { name: "Sign In" }),
			).not.toBeVisible();
			return;
		}

		if (page.url().endsWith("/feed")) {
			await expect(page.getByRole("heading", { name: "Feed" })).toBeVisible();
		} else {
			await expect(page.getByText("Instance ready:")).toBeVisible();
			await expect(page.getByRole("link", { name: "Sign In" })).toBeVisible();
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
		await expect(page.getByRole("heading", { name: "Feed" })).toBeVisible();
		await expect(
			page.getByRole("heading", { name: "Create Post" }),
		).toBeVisible();
		await expect(
			page.getByRole("heading", { name: "Semantic Search" }),
		).toBeVisible();
	});
});
