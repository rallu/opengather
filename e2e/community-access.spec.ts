import { expect, test } from "@playwright/test";
import { Client } from "pg";

test.describe.configure({ mode: "serial" });

const databaseUrl =
	process.env.DATABASE_URL ??
	"postgres://opengather:opengather@127.0.0.1:5433/opengather";

type ConfigSnapshot = {
	serverVisibilityMode: string;
	serverApprovalMode: string;
};

const adminUser = {
	email: "admin@example.com",
	password: "admin-pass-123",
};

async function withDb<T>(callback: (client: Client) => Promise<T>): Promise<T> {
	const client = new Client({
		connectionString: databaseUrl,
	});
	await client.connect();
	try {
		return await callback(client);
	} finally {
		await client.end();
	}
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

async function readCommunityConfig(): Promise<ConfigSnapshot> {
	return withDb(async (client) => {
		const result = await client.query<{ key: string; value: string }>(
			`
				select key, value #>> '{}' as value
				from config
				where key in ('server_visibility_mode', 'server_approval_mode')
			`,
		);
		const values = new Map(result.rows.map((row) => [row.key, row.value]));
		return {
			serverVisibilityMode: values.get("server_visibility_mode") ?? "public",
			serverApprovalMode: values.get("server_approval_mode") ?? "automatic",
		};
	});
}

async function updateConfig(key: string, value: string): Promise<void> {
	await withDb(async (client) => {
		await client.query(
			"update config set value = $2::jsonb, updated_at = now() where key = $1",
			[key, JSON.stringify(value)],
		);
	});
}

async function signInLocal(params: {
	page: import("@playwright/test").Page;
	email: string;
	password: string;
}): Promise<void> {
	await params.page.goto("/feed");
	if (
		await params.page
			.getByTestId("shell-sign-out")
			.isVisible()
			.catch(() => false)
	) {
		return;
	}

	await params.page.goto("/login");
	await params.page.getByTestId("login-email").fill(params.email);
	await params.page.getByTestId("login-password").fill(params.password);
	await params.page.getByTestId("login-submit").click();
	await expect(params.page.getByTestId("shell-sign-out")).toBeVisible();
}

async function signOutIfNeeded(
	page: import("@playwright/test").Page,
): Promise<void> {
	await page.context().clearCookies();
	await page.goto("/feed");
	await page.evaluate(() => {
		window.localStorage.clear();
		window.sessionStorage.clear();
	});
	await page.goto("/");
}

async function getUserIdByEmail(email: string): Promise<string> {
	return withDb(async (client) => {
		const result = await client.query<{ id: string }>(
			'select id from "user" where email = $1 limit 1',
			[email],
		);
		if (result.rowCount === 0 || !result.rows[0]?.id) {
			throw new Error(`User not found for ${email}`);
		}
		return result.rows[0].id;
	});
}

test.describe("community access flow", () => {
	let snapshot: ConfigSnapshot;

	test.beforeAll(async () => {
		snapshot = await readCommunityConfig();
	});

	test.afterAll(async () => {
		await updateConfig("server_visibility_mode", snapshot.serverVisibilityMode);
		await updateConfig("server_approval_mode", snapshot.serverApprovalMode);
	});

	test("guest is redirected from restricted feed to contextual register and login pages", async ({
		page,
	}) => {
		await ensureConfiguredInstance(page);
		await signOutIfNeeded(page);
		await updateConfig("server_visibility_mode", "registered");
		await updateConfig("server_approval_mode", "automatic");

		await page.goto("/feed");
		await expect(page).toHaveURL(/\/register\?/);
		await expect(page.getByTestId("register-context")).toBeVisible();
		await expect(page.getByTestId("register-context-title")).not.toHaveText("");
		await expect(
			page.getByTestId("register-reason-members-only"),
		).toBeVisible();

		await page.getByTestId("register-sign-in-link").click();
		await expect(page).toHaveURL(/\/login\?/);
		await expect(page.getByTestId("login-title")).toBeVisible();
		await expect(page.getByTestId("login-context")).toBeVisible();
	});

	test("shell sign out clears the session for the next page load", async ({
		page,
	}) => {
		await ensureConfiguredInstance(page);
		await signOutIfNeeded(page);
		await signInLocal({
			page,
			email: adminUser.email,
			password: adminUser.password,
		});

		await page.getByTestId("shell-sign-out").click();
		await signOutIfNeeded(page);
		const guestPage = await page.context().newPage();
		await guestPage.goto("/feed");

		await expect(
			guestPage.getByRole("link", { name: /Sign In|Sign in/ }),
		).toBeVisible({
			timeout: 15_000,
		});
		await expect(guestPage.getByTestId("shell-sign-out")).toHaveCount(0);
		await guestPage.close();
	});

	test("manual approval notifies admins and approval unlocks access", async ({
		page,
	}) => {
		await ensureConfiguredInstance(page);
		await signOutIfNeeded(page);
		await updateConfig("server_visibility_mode", "approval");
		await updateConfig("server_approval_mode", "manual");

		const now = Date.now();
		const pendingEmail = `pending-${now}@example.com`;
		await page.goto("/register?next=%2Ffeed&reason=members-only");
		await page.getByTestId("register-name").fill(`Pending ${now}`);
		await page.getByTestId("register-email").fill(pendingEmail);
		await page.getByTestId("register-password").fill("pending-pass-123");
		await page.getByTestId("register-submit").click();

		await expect(page).toHaveURL(/\/feed$/);
		await expect(page.getByTestId("feed-pending-state")).toBeVisible();
		await expect(page.getByTestId("feed-composer")).toHaveCount(0);
		await expect(page.getByTestId("feed-reply-composer")).toHaveCount(0);

		const pendingUserId = await getUserIdByEmail(pendingEmail);
		const requestKey = `instance:singleton:${pendingUserId}`;

		await signOutIfNeeded(page);
		await signInLocal({
			page,
			email: adminUser.email,
			password: adminUser.password,
		});
		await expect(page.getByTestId("shell-nav-approvals")).toBeVisible();
		await expect(page.getByTestId("shell-nav-approvals-badge")).toContainText(
			/\d+/,
		);
		await expect(
			page.getByTestId("shell-nav-notifications-badge"),
		).toContainText(/\d+/);

		await page.goto("/notifications");
		await expect(
			page.getByTestId(`notification-item-${requestKey}`),
		).toContainText(pendingEmail);
		await page.getByTestId(`notification-open-${requestKey}`).click();
		await expect(page).toHaveURL(/\/approvals\?request=/);
		await expect(page.getByTestId(`approvals-row-${requestKey}`)).toContainText(
			pendingEmail,
		);
		await page.getByTestId(`approvals-approve-${requestKey}`).click();
		await expect(page.getByTestId("approvals-action-message")).toContainText(
			"Server membership approved.",
		);
		await expect(page.getByTestId(`approvals-row-${requestKey}`)).toHaveCount(
			0,
		);

		await signOutIfNeeded(page);
		await signInLocal({
			page,
			email: pendingEmail,
			password: "pending-pass-123",
		});
		await page.goto("/feed");
		await expect(page.getByTestId("feed-pending-state")).toHaveCount(0);
		await expect(page.getByTestId("feed-post-button")).toBeVisible();
	});
});
