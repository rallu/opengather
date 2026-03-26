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

async function signOut(page: import("@playwright/test").Page): Promise<void> {
	await page.context().clearCookies();
	await page.goto("/feed");
	await page.evaluate(() => {
		window.localStorage.clear();
		window.sessionStorage.clear();
	});
	await page.goto("/feed");
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
	await expect(params.page.getByTestId("shell-sign-out")).toBeVisible();
}

async function signInUser(params: {
	page: import("@playwright/test").Page;
	email: string;
	password: string;
}): Promise<void> {
	await params.page.goto("/login");
	await params.page.getByTestId("login-email").fill(params.email);
	await params.page.getByTestId("login-password").fill(params.password);
	await params.page.getByTestId("login-submit").click();
	await expect(params.page.getByTestId("shell-sign-out")).toBeVisible();
}

test.describe("profile privacy", () => {
	let snapshot: ConfigSnapshot;

	test.beforeAll(async () => {
		snapshot = await readCommunityConfig();
	});

	test.afterAll(async () => {
		await updateConfig("server_visibility_mode", snapshot.serverVisibilityMode);
		await updateConfig("server_approval_mode", snapshot.serverApprovalMode);
	});

	test("public, private, and members-only profile visibility is enforced", async ({
		page,
	}) => {
		await ensureConfiguredInstance(page);
		await updateConfig("server_visibility_mode", "public");
		await updateConfig("server_approval_mode", "automatic");

		const now = Date.now();
		const owner = {
			name: `Owner ${now}`,
			email: `owner-${now}@example.com`,
			password: "owner-pass-123",
		};
		const viewer = {
			name: `Viewer ${now}`,
			email: `viewer-${now}@example.com`,
			password: "viewer-pass-123",
		};
		const profilePost = `Profile hello ${now}`;

		await registerUser({
			page,
			...owner,
		});
		await page.goto("/feed");
		await page.getByTestId("feed-composer").fill(profilePost);
		await page.getByTestId("feed-post-button").click();
		await expect(page.getByTestId("feed-post-list")).toContainText(profilePost);

		const ownerUserId = await getUserIdByEmail(owner.email);

		await signOut(page);
		await page.goto(`/profiles/${ownerUserId}`);
		await expect(page.getByTestId("profile-activity-list")).toBeVisible();
		await expect(page.getByTestId("profile-activity-list")).toContainText(
			profilePost,
		);

		await signInUser({
			page,
			email: owner.email,
			password: owner.password,
		});
		await page.goto("/profile");
		await page
			.getByTestId("settings-profile-visibility")
			.selectOption("private");
		await page.getByTestId("settings-profile-save").click();
		await expect(page.getByTestId("settings-profile-saved")).toBeVisible();

		await signOut(page);
		await page.goto(`/profiles/${ownerUserId}`);
		await expect(page.getByTestId("profile-requires-auth-state")).toContainText(
			"Sign in to view this profile.",
		);
		await expect(page.getByTestId("profile-activity-list")).toHaveCount(0);

		await registerUser({
			page,
			...viewer,
		});
		await page.goto(`/profiles/${ownerUserId}`);
		await expect(page.getByTestId("profile-forbidden-state")).toBeVisible();
		await expect(page.getByTestId("profile-forbidden-state")).not.toContainText(
			profilePost,
		);

		await signOut(page);
		await signInUser({
			page,
			email: owner.email,
			password: owner.password,
		});
		await page.goto("/profile");
		await page
			.getByTestId("settings-profile-visibility")
			.selectOption("instance_members");
		await page.getByTestId("settings-profile-save").click();
		await expect(page.getByTestId("settings-profile-saved")).toBeVisible();

		await signOut(page);
		await signInUser({
			page,
			email: viewer.email,
			password: viewer.password,
		});
		await page.goto("/feed");
		await page.goto(`/profiles/${ownerUserId}`);
		await expect(page.getByTestId("profile-activity-list")).toBeVisible();
		await expect(page.getByTestId("profile-activity-list")).toContainText(
			profilePost,
		);
	});

	test("profiles cannot stay public when the instance is members only", async ({
		page,
	}) => {
		await ensureConfiguredInstance(page);
		await updateConfig("server_visibility_mode", "public");
		await updateConfig("server_approval_mode", "automatic");

		const now = Date.now();
		const owner = {
			name: `Owner Closed ${now}`,
			email: `owner-closed-${now}@example.com`,
			password: "owner-pass-123",
		};
		const viewer = {
			name: `Viewer Closed ${now}`,
			email: `viewer-closed-${now}@example.com`,
			password: "viewer-pass-123",
		};
		const profilePost = `Members only hello ${now}`;

		await registerUser({
			page,
			...owner,
		});
		await page.goto("/feed");
		await page.getByTestId("feed-composer").fill(profilePost);
		await page.getByTestId("feed-post-button").click();
		await expect(page.getByTestId("feed-post-list")).toContainText(profilePost);

		const ownerUserId = await getUserIdByEmail(owner.email);

		await signOut(page);
		await page.goto(`/profiles/${ownerUserId}`);
		await expect(page.getByTestId("profile-activity-list")).toContainText(
			profilePost,
		);

		await updateConfig("server_visibility_mode", "registered");

		await page.goto(`/profiles/${ownerUserId}`);
		await expect(page.getByTestId("profile-requires-auth-state")).toContainText(
			"Sign in to view this profile.",
		);

		await signInUser({
			page,
			email: owner.email,
			password: owner.password,
		});
		await page.goto("/profile");
		await expect(page.getByTestId("settings-profile-visibility")).toHaveValue(
			"instance_members",
		);
		await expect(
			page.getByText(
				"Public profiles are unavailable because this instance is not public.",
			),
		).toBeVisible();

		const profileVisibilityOptions = await page
			.getByTestId("settings-profile-visibility")
			.locator("option")
			.evaluateAll((options) =>
				options.map((option) => ({
					value: option.getAttribute("value"),
					label: option.textContent?.trim(),
				})),
			);
		expect(profileVisibilityOptions).toEqual([
			{ value: "instance_members", label: "Instance members" },
			{ value: "private", label: "Private" },
		]);

		await signOut(page);
		await registerUser({
			page,
			...viewer,
		});
		await page.goto(`/profiles/${ownerUserId}`);
		await expect(page.getByTestId("profile-activity-list")).toContainText(
			profilePost,
		);
	});
});
