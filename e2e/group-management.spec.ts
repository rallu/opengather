import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { Client } from "pg";

test.describe.configure({ mode: "serial" });

const adminUser = {
	email: "admin@example.com",
	password: "admin-pass-123",
};

const databaseUrl =
	process.env.DATABASE_URL ??
	"postgres://opengather:opengather@127.0.0.1:5433/opengather";

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
	await page.getByTestId("setup-admin-email").fill(adminUser.email);
	await page.getByTestId("setup-admin-password").fill(adminUser.password);
	await page.getByTestId("setup-submit").click();
	await expect(page).toHaveURL(/\/$|\/feed$/);
}

async function signInLocal(params: {
	page: import("@playwright/test").Page;
	email: string;
	password: string;
	expectSuccess?: boolean;
}): Promise<void> {
	await params.page.goto("/login");
	await params.page.getByTestId("login-email").fill(params.email);
	await params.page.getByTestId("login-password").fill(params.password);
	await params.page.getByTestId("login-submit").click();
	await params.page.waitForLoadState("networkidle").catch(() => undefined);
	if (params.expectSuccess === false) {
		return;
	}
	await expect(params.page.getByTestId("shell-sign-out")).toBeVisible();
}

async function registerLocal(params: {
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

async function signOut(page: import("@playwright/test").Page): Promise<void> {
	await page.context().clearCookies();
	await page.goto("/feed");
	await page.evaluate(() => {
		window.localStorage.clear();
		window.sessionStorage.clear();
	});
	await page.goto("/feed");
	await expect(page.getByTestId("shell-sign-in-link")).toBeVisible();
}

async function hasUser(email: string): Promise<boolean> {
	return withDb(async (client) => {
		const result = await client.query<{ id: string }>(
			'select id from "user" where email = $1 limit 1',
			[email],
		);
		return result.rowCount > 0;
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

async function promoteUserToAdmin(email: string): Promise<void> {
	await withDb(async (client) => {
		const userResult = await client.query<{ id: string }>(
			'select id from "user" where email = $1 limit 1',
			[email],
		);
		if (userResult.rowCount === 0) {
			throw new Error(`User not found for admin promotion: ${email}`);
		}
		const userId = userResult.rows[0].id;
		await client.query(
			`
				insert into instance_membership (
					id,
					instance_id,
					principal_id,
					principal_type,
					role,
					approval_status,
					created_at,
					updated_at
				)
				values ($1, 'singleton', $2, 'user', 'admin', 'approved', now(), now())
				on conflict (instance_id, principal_id, principal_type)
				do update
				set role = 'admin',
					approval_status = 'approved',
					updated_at = excluded.updated_at
			`,
			[randomUUID(), userId],
		);
	});
}

async function ensureAdminAccess(
	page: import("@playwright/test").Page,
): Promise<void> {
	await signInLocal({
		page,
		email: adminUser.email,
		password: adminUser.password,
		expectSuccess: false,
	});

	if (!(await hasUser(adminUser.email))) {
		await registerLocal({
			page,
			name: "Admin User",
			email: adminUser.email,
			password: adminUser.password,
		});
	}

	await promoteUserToAdmin(adminUser.email);
	await signOut(page);
	await signInLocal({
		page,
		email: adminUser.email,
		password: adminUser.password,
	});
}

test.describe("group management", () => {
	test("manager can update visibility, assign roles, and remove members", async ({
		page,
	}) => {
		await ensureConfiguredInstance(page);
		await ensureAdminAccess(page);

		const now = Date.now();
		const groupName = `Managed Group ${now}`;
		const member = {
			name: `Manager Candidate ${now}`,
			email: `manager-candidate-${now}@example.com`,
			password: "member-pass-123",
		};

		await page.goto("/groups");
		await page.getByTestId("groups-create-name").fill(groupName);
		await page
			.getByTestId("groups-create-description")
			.fill("Group used for management controls");
		await page.getByTestId("groups-create-visibility").selectOption("public");
		await page.getByTestId("groups-create-submit").click();
		await expect(page).toHaveURL(/\/groups\/.+$/);
		const groupUrl = page.url();
		const groupId = groupUrl.split("/groups/")[1] ?? "";

		await signOut(page);
		await registerLocal({
			page,
			...member,
		});
		await page.goto(groupUrl);
		await expect(page.getByTestId("group-join-visible")).toBeVisible();
		await page.getByTestId("group-join-visible").click();
		await expect(page.getByTestId("group-action-message")).toContainText(
			"You joined the group.",
		);
		await expect(page.getByTestId("group-post-body")).toBeVisible();
		const memberUserId = await getUserIdByEmail(member.email);

		await signOut(page);
		await signInLocal({
			page,
			email: adminUser.email,
			password: adminUser.password,
		});
		await page.goto(groupUrl);
		await expect(
			page.getByTestId(`group-member-${memberUserId}`),
		).toContainText(member.email);
		await page
			.getByTestId(`group-member-role-${memberUserId}`)
			.selectOption("moderator");
		await page.getByTestId(`group-member-role-submit-${memberUserId}`).click();
		await expect(page.getByTestId("group-action-message")).toContainText(
			"Member role updated.",
		);
		await expect(
			page.getByTestId(`group-member-${memberUserId}`),
		).toContainText("moderator");

		await page
			.getByTestId("group-settings-visibility")
			.selectOption("group_members");
		await page.getByTestId("group-settings-save").click();
		await expect(page.getByTestId("group-action-message")).toContainText(
			"Group visibility updated.",
		);
		await expect(page.getByTestId("group-visibility-mode")).toContainText(
			"group_members",
		);

		await signOut(page);
		await page.goto("/groups");
		await expect(page.getByTestId(`group-card-${groupId}`)).toHaveCount(0);

		await signInLocal({
			page,
			email: adminUser.email,
			password: adminUser.password,
		});
		await page.goto(groupUrl);
		await page.getByTestId(`group-member-remove-${memberUserId}`).click();
		await expect(page.getByTestId("group-action-message")).toContainText(
			"Member removed from group.",
		);

		await signOut(page);
		await signInLocal({
			page,
			email: member.email,
			password: member.password,
		});
		await page.goto(groupUrl);
		await expect(page.getByTestId("group-membership-state")).toContainText(
			"You do not have access to this group yet.",
		);
		await expect(page.getByTestId("group-request-access")).toBeVisible();
	});
});
