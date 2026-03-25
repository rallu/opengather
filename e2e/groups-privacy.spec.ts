import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { Client } from "pg";

test.describe.configure({ mode: "serial" });

const adminUser = {
	email: "admin@example.com",
	password: "admin-pass-123",
};

const memberUser = {
	name: `Member ${Date.now()}`,
	email: `member-${Date.now()}@example.com`,
	password: "member-pass-123",
};
const outsiderUser = {
	name: `Outsider ${Date.now()}`,
	email: `outsider-${Date.now()}@example.com`,
	password: "outsider-pass-123",
};

const publicGroupName = `Public Group ${Date.now()}`;
const publicPostText = `Public announcement ${Date.now()}`;
const privateGroupName = `Private Group ${Date.now()}`;
const privatePostText = `Hidden steering note ${Date.now()}`;

let publicGroupId = "";
let privateGroupId = "";
const databaseUrl =
	process.env.DATABASE_URL ??
	"postgres://opengather:opengather@127.0.0.1:5433/opengather";

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

async function signOutIfNeeded(
	page: import("@playwright/test").Page,
): Promise<void> {
	await page.context().clearCookies();
	await page.goto("/feed");
	await page.evaluate(() => {
		window.localStorage.clear();
		window.sessionStorage.clear();
	});
	await page.goto("/feed");
	await expect(page.getByTestId("shell-sign-in-link")).toBeVisible();
}

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

async function getPostIdByBodyText(bodyText: string): Promise<string> {
	return withDb(async (client) => {
		const result = await client.query<{ id: string }>(
			"select id from post where body_text = $1 order by created_at desc limit 1",
			[bodyText],
		);
		if (result.rowCount === 0 || !result.rows[0]?.id) {
			throw new Error(`Post not found for body text: ${bodyText}`);
		}
		return result.rows[0].id;
	});
}

async function getMaxPostCreatedAt(): Promise<Date> {
	return withDb(async (client) => {
		const result = await client.query<{ created_at: Date | string | null }>(
			"select max(created_at) as created_at from post",
		);
		const value = result.rows[0]?.created_at;
		return value ? new Date(value) : new Date();
	});
}

async function updatePostCreatedAt(params: {
	postId: string;
	createdAt: Date;
}): Promise<void> {
	await withDb(async (client) => {
		await client.query(
			"update post set created_at = $2, updated_at = $2 where id = $1",
			[params.postId, params.createdAt],
		);
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

		const setupResult = await client.query<{ value: string }>(
			"select value #>> '{}' as value from config where key = 'setup_instance_id' limit 1",
		);
		if (setupResult.rowCount === 0 || !setupResult.rows[0]?.value) {
			throw new Error("Setup instance id not found");
		}

		const userId = userResult.rows[0].id;
		const instanceId = setupResult.rows[0].value;
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
				values ($1, $2, $3, 'user', 'admin', 'approved', now(), now())
				on conflict (instance_id, principal_id, principal_type)
				do update
				set role = 'admin',
					approval_status = 'approved',
					updated_at = excluded.updated_at
			`,
			[randomUUID(), instanceId, userId],
		);
	});
}

async function getInstanceRole(email: string): Promise<string | null> {
	return withDb(async (client) => {
		const result = await client.query<{ role: string }>(
			`
				select im.role
				from "user" u
				join instance_membership im
					on im.principal_id = u.id
					and im.principal_type = 'user'
				where u.email = $1
					and im.instance_id = 'singleton'
				limit 1
			`,
			[email],
		);
		return result.rows[0]?.role ?? null;
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
	if ((await page.getByTestId("shell-sign-out").count()) > 0) {
		return;
	}

	if (!(await hasUser(adminUser.email))) {
		await registerLocal({
			page,
			name: "Admin User",
			email: adminUser.email,
			password: adminUser.password,
		});
	}

	await promoteUserToAdmin(adminUser.email);
	if ((await getInstanceRole(adminUser.email)) !== "admin") {
		await promoteUserToAdmin(adminUser.email);
	}
	if ((await getInstanceRole(adminUser.email)) !== "admin") {
		throw new Error("Failed to promote admin user for group privacy test");
	}
	await signOutIfNeeded(page);
	await signInLocal({
		page,
		email: adminUser.email,
		password: adminUser.password,
	});
}

async function createGroup(params: {
	page: import("@playwright/test").Page;
	name: string;
	description: string;
	visibility: "public" | "group_members";
	initialPost: string;
}): Promise<string> {
	await params.page.goto("/groups");
	await expect(params.page.getByTestId("groups-create-form")).toBeVisible();
	await params.page.getByTestId("groups-create-name").fill(params.name);
	await params.page
		.getByTestId("groups-create-description")
		.fill(params.description);
	await params.page
		.getByTestId("groups-create-visibility")
		.selectOption(params.visibility);
	await params.page.getByTestId("groups-create-submit").click();
	await expect(params.page).toHaveURL(/\/groups\/.+$/);
	const groupId = params.page.url().split("/groups/")[1] ?? "";
	await expect(params.page.getByTestId("group-post-body")).toBeVisible();
	await params.page.getByTestId("group-post-body").fill(params.initialPost);
	await params.page.getByTestId("group-post-submit").click();
	await expect(params.page.getByTestId("group-post-list")).toContainText(
		params.initialPost,
	);
	return groupId;
}

test.describe("group privacy", () => {
	test("admin creates public and request-only groups", async ({ page }) => {
		await ensureConfiguredInstance(page);
		await ensureAdminAccess(page);
		await expect(page.getByTestId("shell-nav-groups")).toBeVisible();

		publicGroupId = await createGroup({
			page,
			name: publicGroupName,
			description: "Public updates for everyone",
			visibility: "public",
			initialPost: publicPostText,
		});

		privateGroupId = await createGroup({
			page,
			name: privateGroupName,
			description: "Private coordination space",
			visibility: "group_members",
			initialPost: privatePostText,
		});

		await signOutIfNeeded(page);
	});

	test("guest can only reach public group content", async ({ page }) => {
		await ensureConfiguredInstance(page);

		await page.goto("/groups");
		await expect(page.getByTestId(`group-card-${publicGroupId}`)).toBeVisible();
		await expect(page.getByTestId(`group-card-${privateGroupId}`)).toHaveCount(
			0,
		);

		await page.goto("/feed");
		await expect(page.getByTestId("feed-post-list")).not.toContainText(
			publicPostText,
		);
		await expect(page.getByTestId("feed-post-list")).not.toContainText(
			privatePostText,
		);

		await page.goto(`/feed?q=${encodeURIComponent(privatePostText)}`);
		await expect(page.getByTestId("feed-post-list")).not.toContainText(
			privateGroupName,
		);

		await page.goto(`/groups/${publicGroupId}`);
		await expect(page.getByTestId("group-post-list")).toContainText(
			publicPostText,
		);
		await page
			.getByTestId("group-post-list")
			.locator("[data-testid^='group-comment-action-']")
			.first()
			.click();
		await expect(page.getByTestId("post-detail-reply-body")).toHaveCount(0);

		await page.goto(`/groups/${privateGroupId}`);
		await expect(page.getByTestId("group-requires-auth-state")).toContainText(
			"Sign in to view or request access to this group.",
		);
		await expect(page.getByTestId("group-post-list")).toHaveCount(0);
	});

	test("member can request access and approved membership unlocks the group", async ({
		page,
	}) => {
		await ensureConfiguredInstance(page);
		await registerLocal({
			page,
			name: memberUser.name,
			email: memberUser.email,
			password: memberUser.password,
		});
		await page.goto("/groups");
		await expect(page.getByTestId("shell-nav-groups")).toBeVisible();
		await expect(
			page.getByTestId(`group-card-${privateGroupId}`),
		).toBeVisible();
		await page.goto("/feed");
		await expect(page.getByTestId("feed-post-list")).not.toContainText(
			publicPostText,
		);
		await expect(page.getByTestId("feed-post-list")).not.toContainText(
			privatePostText,
		);

		await page.goto(`/groups/${privateGroupId}`);
		await expect(page.getByTestId("group-request-access")).toBeVisible();
		await page.getByTestId("group-request-access").click();
		await expect(page.getByTestId("group-action-message")).toContainText(
			"Access request sent.",
		);
		await expect(page.getByTestId("group-membership-state")).toContainText(
			"Your membership request is still pending approval.",
		);
		await signOutIfNeeded(page);

		await signInLocal({
			page,
			email: adminUser.email,
			password: adminUser.password,
		});
		await page.goto(`/groups/${privateGroupId}`);
		const memberUserId = await getUserIdByEmail(memberUser.email);
		const requestKey = `group:${privateGroupId}:${memberUserId}`;
		await expect(
			page.getByTestId(`group-pending-request-${memberUserId}`),
		).toContainText(memberUser.email);
		await page.getByTestId(`group-pending-open-${memberUserId}`).click();
		await expect(page).toHaveURL(/\/approvals\?request=/);
		await expect(page.getByTestId(`approvals-row-${requestKey}`)).toContainText(
			memberUser.email,
		);
		await page.getByTestId(`approvals-approve-${requestKey}`).click();
		await expect(page.getByTestId("approvals-action-message")).toContainText(
			"Group membership approved.",
		);
		await signOutIfNeeded(page);

		await signInLocal({
			page,
			email: memberUser.email,
			password: memberUser.password,
		});
		await page.goto(`/groups/${privateGroupId}`);
		await expect(page.getByTestId("group-post-list")).toContainText(
			privatePostText,
		);
		const memberFollowUp = `Member-only follow-up ${Date.now()}`;
		await page.getByTestId("group-post-body").fill(memberFollowUp);
		await page.getByTestId("group-post-submit").click();
		await expect(page.getByTestId("group-post-list")).toContainText(
			memberFollowUp,
		);
		const memberFollowUpPostId = await getPostIdByBodyText(memberFollowUp);
		const maxPostCreatedAt = await getMaxPostCreatedAt();
		await updatePostCreatedAt({
			postId: memberFollowUpPostId,
			createdAt: new Date(maxPostCreatedAt.getTime() + 60_000),
		});
		await page.goto("/feed?sort=newest");
		const memberFeedItems = page
			.getByTestId("feed-post-list")
			.locator("[data-testid^='feed-post-']")
			.filter({ hasText: memberFollowUp });
		await expect(memberFeedItems).toHaveCount(1);
	});

	test("private group posts do not leak through profiles, post pages, or notifications", async ({
		page,
	}) => {
		await ensureConfiguredInstance(page);

		if (!(await hasUser(outsiderUser.email))) {
			await registerLocal({
				page,
				name: outsiderUser.name,
				email: outsiderUser.email,
				password: outsiderUser.password,
			});
			await signOutIfNeeded(page);
		}

		await signInLocal({
			page,
			email: memberUser.email,
			password: memberUser.password,
		});
		const secretPostText = `Secret group ping ${Date.now()} ${outsiderUser.email}`;
		await page.goto(`/groups/${privateGroupId}`);
		await page.getByTestId("group-post-body").fill(secretPostText);
		await expect(page.getByTestId("group-post-body")).toHaveValue(secretPostText);
		await page.getByTestId("group-post-body").press("Control+Enter");
		await expect(page.getByTestId("group-post-list")).toContainText(
			secretPostText,
		);

		const memberUserId = await getUserIdByEmail(memberUser.email);
		const secretPostId = await getPostIdByBodyText(secretPostText);

		await signOutIfNeeded(page);
		await page.goto(`/profiles/${memberUserId}`);
		await expect(page.getByTestId("profile-activity-list")).toBeVisible();
		await expect(page.getByTestId("profile-activity-list")).not.toContainText(
			secretPostText,
		);

		await page.goto(`/posts/${secretPostId}`);
		await expect(page.getByText("Post not found.")).toBeVisible();

		await signInLocal({
			page,
			email: outsiderUser.email,
			password: outsiderUser.password,
		});
		await page.goto(`/profiles/${memberUserId}`);
		await expect(page.getByTestId("profile-activity-list")).toBeVisible();
		await expect(page.getByTestId("profile-activity-list")).not.toContainText(
			secretPostText,
		);

		await page.goto(`/posts/${secretPostId}`);
		await expect(page.getByText("Post not found.")).toBeVisible();

		await page.goto("/notifications");
		await expect(page.locator("body")).not.toContainText(secretPostText);
	});
});
