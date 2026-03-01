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

async function moveToInstanceStep(
	page: import("@playwright/test").Page,
): Promise<boolean> {
	const setupRequired = await isSetupRequired(page);
	if (!setupRequired) {
		return false;
	}

	await page.goto("/setup");
	const dbUrlField = page.locator("#setup-database-url");
	const hasDbStep = await dbUrlField.isVisible().catch(() => false);
	if (hasDbStep) {
		await dbUrlField.fill(
			"postgres://opengather:opengather@localhost:5432/opengather",
		);
		await page.getByRole("button", { name: "Save Database URL" }).click();
		await expect(page).toHaveURL(/\/setup$/);
	}
	await expect(page.locator("#setup-name")).toBeVisible();
	return true;
}

test.describe("setup wizard", () => {
	test("navigates to setup from home", async ({ page }) => {
		const setupRequired = await isSetupRequired(page);

		if (setupRequired) {
			await page.getByRole("link", { name: "Run First Setup" }).click();
			await expect(page).toHaveURL(/\/setup$/);
			await expect(
				page.getByRole("heading", { name: "First Run Setup" }),
			).toBeVisible();
			return;
		}

		await page.goto("/setup");
		await expect(page).toHaveURL(/\/$/);
		await expect(page.getByText("Instance ready:")).toBeVisible();
	});

	test("renders setup controls and defaults", async ({ page }) => {
		const setupRequired = await moveToInstanceStep(page);
		test.skip(
			!setupRequired,
			"Instance already configured; setup form not available.",
		);
		await expect(
			page.getByRole("heading", { name: "First Run Setup" }),
		).toBeVisible();

		await page.locator("#setup-name").fill("OpenGather Finland");
		await page.locator("#setup-slug").fill("opengather-fi");
		await page
			.locator("#setup-description")
			.fill("Community for collaborative text posts");
		await page.locator("#setup-admin-name").fill("Admin User");
		await page.locator("#setup-admin-email").fill("admin@example.com");
		await page.locator("#setup-admin-password").fill("admin-pass-123");
		await page.locator("#setup-visibility").selectOption("registered");
		await page.locator("#setup-approval").selectOption("manual");

		await expect(page.locator("#setup-name")).toHaveValue("OpenGather Finland");
		await expect(page.locator("#setup-slug")).toHaveValue("opengather-fi");
		await expect(page.locator("#setup-admin-email")).toHaveValue(
			"admin@example.com",
		);
		await expect(page.locator("#setup-visibility")).toHaveValue("registered");
		await expect(page.locator("#setup-approval")).toHaveValue("manual");
	});

	test("runs setup progress and unlocks login controls", async ({ page }) => {
		const setupRequired = await moveToInstanceStep(page);
		if (!setupRequired) {
			await page.goto("/");
			await expect(page.getByText("Instance ready:")).toBeVisible();
			await expect(
				page.getByRole("link", { name: "Login via Hub (MVP)" }),
			).toBeVisible();
			await expect(
				page.getByRole("link", { name: "Run First Setup" }),
			).not.toBeVisible();
			return;
		}

		await page.locator("#setup-name").fill("OpenGather Local");
		await page.locator("#setup-slug").fill("opengather-local");
		await page.locator("#setup-description").fill("Local test instance");
		await page.locator("#setup-admin-name").fill("Admin User");
		await page.locator("#setup-admin-email").fill("admin@example.com");
		await page.locator("#setup-admin-password").fill("admin-pass-123");
		await page.getByRole("button", { name: "Initialize Instance" }).click();

		await expect(page).toHaveURL(/\/$/);
		await expect(page.getByText("Instance ready:")).toBeVisible();
		await expect(
			page.getByRole("link", { name: "Login via Hub (MVP)" }),
		).toBeVisible();
		await expect(
			page.getByRole("link", { name: "Run First Setup" }),
		).not.toBeVisible();
		await expect(page.getByRole("link", { name: "Sign In" })).toBeVisible();
		await expect(page.getByRole("link", { name: "Sign Up" })).toBeVisible();
	});

	test("keeps google auth hidden when not configured", async ({ page }) => {
		await page.goto("/login");
		await expect(
			page.getByRole("button", { name: "Continue with Google" }),
		).not.toBeVisible();

		await page.goto("/register");
		await expect(
			page.getByRole("button", { name: "Continue with Google" }),
		).not.toBeVisible();
	});

	test("redirects setup page to home after setup is completed", async ({
		page,
	}) => {
		await page.goto("/setup");
		await expect(page).toHaveURL(/\/$/);
		await expect(page.getByText("Instance ready:")).toBeVisible();
	});

	test("community no longer shows setup error after setup", async ({
		page,
	}) => {
		await page.goto("/community");
		await expect(
			page.getByRole("heading", { name: "Community" }),
		).toBeVisible();
		await expect(page.getByText("Setup is not completed.")).not.toBeVisible();
	});
});
