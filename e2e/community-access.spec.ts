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
		await updateConfig("server_visibility_mode", "registered");
		await updateConfig("server_approval_mode", "automatic");

		await page.goto("/feed");
		await expect(page).toHaveURL(/\/register\?/);
		await expect(page.getByTestId("register-context")).toBeVisible();
		await expect(page.getByTestId("register-context-title")).not.toHaveText("");
		await expect(
			page.getByText("This community is only available to registered members."),
		).toBeVisible();

		await page.getByRole("link", { name: "Sign in" }).click();
		await expect(page).toHaveURL(/\/login\?/);
		await expect(page.getByTestId("login-title")).toBeVisible();
		await expect(page.getByTestId("login-context")).toBeVisible();
	});

	test("signed-in pending member sees clear pending-access state without posting controls", async ({
		page,
	}) => {
		await ensureConfiguredInstance(page);
		await updateConfig("server_visibility_mode", "approval");
		await updateConfig("server_approval_mode", "manual");

		const now = Date.now();
		await page.goto("/register?next=%2Ffeed&reason=members-only");
		await page.getByTestId("register-name").fill(`Pending ${now}`);
		await page.getByTestId("register-email").fill(`pending-${now}@example.com`);
		await page.getByTestId("register-password").fill("pending-pass-123");
		await page.getByTestId("register-submit").click();

		await expect(page).toHaveURL(/\/feed$/);
		await expect(page.getByTestId("feed-pending-state")).toBeVisible();
		await expect(page.getByTestId("feed-composer")).toHaveCount(0);
		await expect(page.getByPlaceholder("Reply")).toHaveCount(0);
	});
});
