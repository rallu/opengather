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

async function insertThread(params: {
	authorId: string;
	groupId?: string;
	bodyPrefix: string;
}): Promise<{
	rootId: string;
	depth1Id: string;
	depth2Id: string;
	depth3Id: string;
}> {
	const rootId = randomUUID();
	const depth1Id = randomUUID();
	const depth2Id = randomUUID();
	const depth3Id = randomUUID();

	await withDb(async (client) => {
		const startedAt = Date.now();
		const timestamps = [
			new Date(startedAt),
			new Date(startedAt + 1_000),
			new Date(startedAt + 2_000),
			new Date(startedAt + 3_000),
		];
		const posts = [
			{
				id: rootId,
				parentPostId: null,
				bodyText: `${params.bodyPrefix} root`,
				createdAt: timestamps[0],
			},
			{
				id: depth1Id,
				parentPostId: rootId,
				bodyText: `${params.bodyPrefix} depth 1`,
				createdAt: timestamps[1],
			},
			{
				id: depth2Id,
				parentPostId: depth1Id,
				bodyText: `${params.bodyPrefix} depth 2`,
				createdAt: timestamps[2],
			},
			{
				id: depth3Id,
				parentPostId: depth2Id,
				bodyText: `${params.bodyPrefix} depth 3`,
				createdAt: timestamps[3],
			},
		];

		for (const post of posts) {
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
					post.id,
					params.authorId,
					params.groupId ?? null,
					post.parentPostId,
					post.bodyText,
					post.createdAt,
				],
			);
		}
	});

	return {
		rootId,
		depth1Id,
		depth2Id,
		depth3Id,
	};
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
				values ($1, 'singleton', $2, 'Threaded group', 'public', now(), now())
			`,
			[groupId, name],
		);
	});
	return groupId;
}

test.describe("threaded discussions", () => {
	let snapshot: ConfigSnapshot;

	test.beforeAll(async () => {
		snapshot = await readCommunityConfig();
	});

	test.afterAll(async () => {
		await updateConfig("server_visibility_mode", snapshot.serverVisibilityMode);
		await updateConfig("server_approval_mode", snapshot.serverApprovalMode);
	});

	test("feed and groups render nested replies with explicit thread depth", async ({
		page,
	}) => {
		await ensureAdminSession(page);
		await updateConfig("server_visibility_mode", "public");
		await updateConfig("server_approval_mode", "automatic");

		const now = Date.now();
		const authorId = randomUUID();

		const feedThread = await insertThread({
			authorId,
			bodyPrefix: `feed-thread-${now}`,
		});
		const groupId = await createPublicGroup(`Thread Group ${now}`);
		const groupThread = await insertThread({
			authorId,
			groupId,
			bodyPrefix: `group-thread-${now}`,
		});

		await page.goto(`/posts/${feedThread.rootId}`);
		await expect(page).toHaveURL(new RegExp(`/posts/${feedThread.rootId}$`));
		await expect(page.getByTestId("post-detail-root")).toContainText(
			`feed-thread-${now} root`,
		);
		await expect(
			page.getByTestId(`post-detail-comment-${feedThread.depth1Id}`),
		).toBeVisible();
		await expect(
			page.getByTestId(`post-detail-comment-${feedThread.depth3Id}`),
		).toHaveAttribute("data-thread-depth", "3");

		await page.goto(`/posts/${groupThread.rootId}`);
		await expect(page).toHaveURL(new RegExp(`/posts/${groupThread.rootId}$`));
		await expect(
			page.getByTestId(`post-detail-comment-${groupThread.depth1Id}`),
		).toBeVisible();
		await expect(
			page.getByTestId(`post-detail-comment-${groupThread.depth3Id}`),
		).toHaveAttribute("data-thread-depth", "3");
	});

	test("post detail replies stay on the root thread and clear composer state", async ({
		page,
	}) => {
		await ensureAdminSession(page);
		await updateConfig("server_visibility_mode", "public");
		await updateConfig("server_approval_mode", "automatic");

		const now = Date.now();
		const authorId = randomUUID();
		const thread = await insertThread({
			authorId,
			bodyPrefix: `inline-reply-thread-${now}`,
		});

		await page.goto(`/posts/${thread.rootId}`);

		const rootReplyText = `root-reply-${now}`;
		await page.getByTestId("post-detail-reply-body").click();
		await page.getByTestId("post-detail-reply-body").fill(rootReplyText);
		await expect(page.getByTestId("post-detail-reply-body")).toHaveValue(
			rootReplyText,
		);
		await page.getByTestId("post-detail-reply-submit").click();
		await expect(page).toHaveURL(new RegExp(`/posts/${thread.rootId}$`));
		await expect(page.getByTestId("post-detail-reply-body")).toHaveValue("");
		await expect(page.getByTestId("post-detail-comments")).toContainText(
			rootReplyText,
		);

		await page
			.getByTestId(`post-detail-reply-action-${thread.depth1Id}`)
			.click();
		await expect(page).toHaveURL(new RegExp(`/posts/${thread.rootId}$`));
		const inlineComposer = page.getByTestId(
			`post-detail-inline-reply-body-${thread.depth1Id}`,
		);
		await expect(inlineComposer).toBeVisible();

		const nestedReplyText = `nested-reply-${now}`;
		await inlineComposer.click();
		await inlineComposer.fill(nestedReplyText);
		await expect(inlineComposer).toHaveValue(nestedReplyText);
		await page
			.getByTestId(`post-detail-inline-reply-submit-${thread.depth1Id}`)
			.click();
		await expect(page).toHaveURL(new RegExp(`/posts/${thread.rootId}$`));
		await expect(
			page.getByTestId(`post-detail-inline-reply-body-${thread.depth1Id}`),
		).toHaveCount(0);
		await expect(page.getByTestId("post-detail-comments")).toContainText(
			nestedReplyText,
		);
	});
});
