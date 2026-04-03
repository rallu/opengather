import { expect, test } from "@playwright/test";

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
	await page.getByTestId("setup-name").fill("OpenGather Local");
	await page.getByTestId("setup-description").fill("Local test instance");
	await page.getByTestId("setup-admin-name").fill("Admin User");
	await page.getByTestId("setup-admin-email").fill("admin@example.com");
	await page.getByTestId("setup-admin-password").fill("admin-pass-123");
	await page.getByTestId("setup-submit").click();
	await expect(page).toHaveURL(/\/$|\/feed$/);
}

async function registerUser(params: {
	page: import("@playwright/test").Page;
	name: string;
	email: string;
	password: string;
}): Promise<void> {
	await params.page.goto("/register");
	await params.page.getByTestId("register-name").fill(params.name);
	await params.page.getByTestId("register-email").fill(params.email);
	await params.page.getByTestId("register-password").fill(params.password);
	await params.page.getByTestId("register-submit").click();
	if (
		!(await params.page
			.getByTestId("shell-sign-out")
			.isVisible()
			.catch(() => false))
	) {
		await params.page.goto("/login");
		await params.page.getByTestId("login-email").fill(params.email);
		await params.page.getByTestId("login-password").fill(params.password);
		await params.page.getByTestId("login-submit").click();
	}
	await expect(params.page.getByTestId("shell-sign-out")).toBeVisible();
}

test("profiles route renders a card list and links to profile detail", async ({
	page,
}) => {
	await ensureConfiguredInstance(page);

	const stamp = Date.now();
	const account = {
		name: `List Member ${stamp}`,
		email: `list-member-${stamp}@example.com`,
		password: "list-pass-123",
	};

	await registerUser({ page, ...account });

	await expect(page.getByTestId("shell-nav-profiles")).toBeVisible();
	await page.getByTestId("shell-nav-profiles").click();
	await expect(page).toHaveURL(/\/profiles$/);
	const profileGrid = page.getByTestId("profile-list-grid");
	await expect(profileGrid).toBeVisible();
	await expect(page.getByTestId("profile-list-card-link").first()).toBeVisible();
	await expect(profileGrid).toContainText(account.name);

	await page.getByTestId("profile-list-card-link").first().click();
	await expect(page).toHaveURL(/\/profiles\//);
	await expect(page.getByTestId("profile-detail-header")).toBeVisible();
});
