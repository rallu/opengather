import { randomUUID } from "node:crypto";
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

async function ensureConfiguredInstance(
	page: import("@playwright/test").Page,
): Promise<void> {
	await page.goto("/setup");
	if (!page.url().includes("/setup")) {
		return;
	}

	await page.getByTestId("setup-name").fill("OpenGather Local");
	await page.getByTestId("setup-description").fill("Local test instance");
	await page.getByTestId("setup-admin-name").fill("Admin User");
	await page.getByTestId("setup-admin-email").fill("admin@example.com");
	await page.getByTestId("setup-admin-password").fill("admin-pass-123");
	await page.getByTestId("setup-submit").click();
	await expect(page).toHaveURL(/\/$|\/feed$/);
}

async function ensureAdminSession(
	page: import("@playwright/test").Page,
): Promise<void> {
	await ensureConfiguredInstance(page);
	await page.goto("/feed");
	const alreadySignedIn = await page
		.getByTestId("shell-sign-out")
		.isVisible()
		.catch(() => false);
	if (alreadySignedIn) {
		return;
	}

	await page.goto("/login");
	await page.getByTestId("login-email").fill("admin@example.com");
	await page.getByTestId("login-password").fill("admin-pass-123");
	await page.getByTestId("login-submit").click();
	await expect(page.getByTestId("shell-sign-out")).toBeVisible();
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

async function getMaxPostCreatedAt(): Promise<Date> {
	return withDb(async (client) => {
		const result = await client.query<{ created_at: Date | string | null }>(
			"select max(created_at) as created_at from post",
		);
		const value = result.rows[0]?.created_at;
		return value ? new Date(value) : new Date();
	});
}

async function insertPost(params: {
	bodyText: string;
	createdAt: Date;
	parentPostId?: string;
	groupId?: string;
	authorId?: string;
}): Promise<string> {
	const postId = randomUUID();
	await withDb(async (client) => {
		await client.query(
			`
				insert into post (
					id,
					instance_id,
					author_id,
					author_type,
					group_id,
					parent_post_id,
					content_type,
					body_text,
					moderation_status,
					hidden_at,
					deleted_at,
					created_at,
					updated_at
				)
				values ($1, 'singleton', $2, 'user', $3, $4, 'text', $5, 'approved', null, null, $6, $6)
			`,
			[
				postId,
				params.authorId ?? randomUUID(),
				params.groupId ?? null,
				params.parentPostId ?? null,
				params.bodyText,
				params.createdAt,
			],
		);
	});
	return postId;
}

async function createPublicGroup(name: string): Promise<string> {
	const groupId = randomUUID();
	await withDb(async (client) => {
		await client.query(
			`
				insert into community_group (
					id,
					instance_id,
					name,
					description,
					visibility_mode,
					created_at,
					updated_at
				)
				values ($1, 'singleton', $2, 'Ranking test group', 'public', now(), now())
			`,
			[groupId, name],
		);
	});
	return groupId;
}

async function getListIndex(params: {
	page: import("@playwright/test").Page;
	listTestId: string;
	itemPrefix: string;
	match: string;
}) {
	return params.page
		.locator(
			`[data-testid="${params.listTestId}"] > [data-testid^="${params.itemPrefix}"]`,
		)
		.evaluateAll(
			(elements, needle) =>
				elements.findIndex((element) =>
					(element.textContent ?? "").includes(String(needle)),
				),
			params.match,
		);
}

test.describe("thread-aware feed ranking", () => {
	let snapshot: ConfigSnapshot;

	test.beforeAll(async () => {
		snapshot = await readCommunityConfig();
	});

	test.afterAll(async () => {
		await updateConfig("server_visibility_mode", snapshot.serverVisibilityMode);
		await updateConfig("server_approval_mode", snapshot.serverApprovalMode);
	});

	test("new root posts appear first in feed and group views", async ({
		page,
	}) => {
		await ensureAdminSession(page);
		await updateConfig("server_visibility_mode", "public");
		await updateConfig("server_approval_mode", "automatic");

		const now = Date.now();
		const olderFeedBody = `older-feed-thread-${now}`;
		await insertPost({
			bodyText: olderFeedBody,
			createdAt: new Date("2026-03-10T09:00:00.000Z"),
		});

		await page.goto("/feed");
		const newFeedBody = `fresh-feed-thread-${now}`;
		await page.getByTestId("feed-composer").click();
		await page.getByTestId("feed-composer").fill(newFeedBody);
		await expect(page.getByTestId("feed-composer")).toHaveValue(newFeedBody);
		await page.getByTestId("feed-post-button").click();
		await expect(page.getByTestId("feed-post-list")).toContainText(newFeedBody);
		await expect(page.getByTestId("feed-composer")).toHaveValue("");
		await expect(
			page
				.locator('[data-testid="feed-post-list"] > [data-testid^="feed-post-"]')
				.first(),
		).toContainText(newFeedBody);

		await page.goto("/groups");
		await page.getByTestId("groups-create-name").fill(`Rank Group ${now}`);
		await page
			.getByTestId("groups-create-description")
			.fill("Group for thread ranking");
		await page.getByTestId("groups-create-visibility").selectOption("public");
		await page.getByTestId("groups-create-submit").click();
		await expect(page).toHaveURL(/\/groups\/.+$/);
		const groupUrl = page.url();
		const groupId = groupUrl.split("/groups/")[1] ?? "";

		const olderGroupBody = `older-group-thread-${now}`;
		await insertPost({
			bodyText: olderGroupBody,
			groupId,
			createdAt: new Date("2026-03-10T10:00:00.000Z"),
		});

		await page.goto(groupUrl);
		const newGroupBody = `fresh-group-thread-${now}`;
		await page.getByTestId("group-post-body").click();
		await page.getByTestId("group-post-body").fill(newGroupBody);
		await expect(page.getByTestId("group-post-body")).toHaveValue(newGroupBody);
		await page.getByTestId("group-post-submit").click();
		await expect(page.getByTestId("group-post-list")).toContainText(
			newGroupBody,
		);
		await expect(page.getByTestId("group-post-body")).toHaveValue("");
		await expect(
			page
				.locator(
					'[data-testid="group-post-list"] > [data-testid^="group-post-"]',
				)
				.first(),
		).toContainText(newGroupBody);
	});

	test("composer shortcut submits a new feed post", async ({ page }) => {
		await ensureAdminSession(page);
		await updateConfig("server_visibility_mode", "public");
		await updateConfig("server_approval_mode", "automatic");

		const bodyText = `shortcut-post-${Date.now()}`;
		await page.goto("/feed");
		await page.getByTestId("feed-composer").click();
		await page.getByTestId("feed-composer").fill(bodyText);
		await page.getByTestId("feed-composer").press("Control+Enter");
		await expect(page.getByTestId("feed-post-list")).toContainText(bodyText);
		await expect(page.getByTestId("feed-composer")).toHaveValue("");
		await expect(
			page
				.locator('[data-testid="feed-post-list"] > [data-testid^="feed-post-"]')
				.first(),
		).toContainText(bodyText);
	});

	test("activity mode bumps replied threads while newest keeps root chronology", async ({
		page,
	}) => {
		await ensureConfiguredInstance(page);
		await updateConfig("server_visibility_mode", "public");
		await updateConfig("server_approval_mode", "automatic");

		const now = Date.now();
		const baseCreatedAt = await getMaxPostCreatedAt();
		const activeRootBody = `activity-root-${now}`;
		const newerRootBody = `newest-root-${now}`;
		const activeRootId = await insertPost({
			bodyText: activeRootBody,
			createdAt: new Date(baseCreatedAt.getTime() + 60_000),
		});
		await insertPost({
			bodyText: newerRootBody,
			createdAt: new Date(baseCreatedAt.getTime() + 120_000),
		});
		await insertPost({
			bodyText: `activity-reply-${now}`,
			parentPostId: activeRootId,
			createdAt: new Date(baseCreatedAt.getTime() + 180_000),
		});

		await page.goto("/feed");
		const activityIndex = await getListIndex({
			page,
			listTestId: "feed-post-list",
			itemPrefix: "feed-post-",
			match: activeRootBody,
		});
		const newerIndexInActivity = await getListIndex({
			page,
			listTestId: "feed-post-list",
			itemPrefix: "feed-post-",
			match: newerRootBody,
		});
		expect(activityIndex).toBeGreaterThanOrEqual(0);
		expect(newerIndexInActivity).toBeGreaterThan(activityIndex);

		await page.getByTestId("feed-sort-newest").click();
		await expect(page).toHaveURL(/sort=newest/);

		const activityIndexInNewest = await getListIndex({
			page,
			listTestId: "feed-post-list",
			itemPrefix: "feed-post-",
			match: activeRootBody,
		});
		const newerIndex = await getListIndex({
			page,
			listTestId: "feed-post-list",
			itemPrefix: "feed-post-",
			match: newerRootBody,
		});
		expect(newerIndex).toBeGreaterThanOrEqual(0);
		expect(activityIndexInNewest).toBeGreaterThan(newerIndex);
	});

	test("feed and group views append more threads after the first 10", async ({
		page,
	}) => {
		await ensureConfiguredInstance(page);
		await updateConfig("server_visibility_mode", "public");
		await updateConfig("server_approval_mode", "automatic");

		const now = Date.now();
		const feedBaseCreatedAt = await getMaxPostCreatedAt();
		const feedPrefix = `feed-scroll-${now}`;
		for (let index = 0; index < 12; index += 1) {
			await insertPost({
				bodyText: `${feedPrefix}-${index}`,
				createdAt: new Date(
					feedBaseCreatedAt.getTime() + (index + 1) * 60_000,
				),
			});
		}

		await page.goto("/feed?sort=newest");
		const feedItems = page
			.locator('[data-testid="feed-post-list"] > [data-testid^="feed-post-"]')
			.filter({ hasText: feedPrefix });
		await expect(feedItems).toHaveCount(10);
		await expect
			.poll(async () => {
				const sentinel = page.getByTestId("feed-post-list-sentinel");
				if ((await sentinel.count()) > 0) {
					await sentinel.evaluate((element) => {
						element.scrollIntoView({ block: "end" });
					});
				}
				return feedItems.count();
			})
			.toBe(12);

		const groupId = await createPublicGroup(`Scroll Group ${now}`);
		const groupBaseCreatedAt = await getMaxPostCreatedAt();
		const groupPrefix = `group-scroll-${now}`;
		for (let index = 0; index < 12; index += 1) {
			await insertPost({
				bodyText: `${groupPrefix}-${index}`,
				groupId,
				createdAt: new Date(
					groupBaseCreatedAt.getTime() + (index + 1) * 60_000,
				),
			});
		}

		await page.goto(`/groups/${groupId}?sort=newest`);
		const groupItems = page
			.locator('[data-testid="group-post-list"] > [data-testid^="group-post-"]')
			.filter({ hasText: groupPrefix });
		await expect(groupItems).toHaveCount(10);
		await expect
			.poll(async () => {
				const sentinel = page.getByTestId("group-post-list-sentinel");
				if ((await sentinel.count()) > 0) {
					await sentinel.evaluate((element) => {
						element.scrollIntoView({ block: "end" });
					});
				}
				return groupItems.count();
			})
			.toBe(12);
	});
});
