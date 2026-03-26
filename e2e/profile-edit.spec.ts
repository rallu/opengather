import { expect, test } from "@playwright/test";
import { Client } from "pg";

const databaseUrl =
	process.env.DATABASE_URL ??
	"postgres://opengather:opengather@127.0.0.1:5433/opengather";

async function withDb<T>(callback: (client: Client) => Promise<T>): Promise<T> {
	const client = new Client({ connectionString: databaseUrl });
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

test("profile details can be edited from profile route", async ({ page }) => {
	await ensureConfiguredInstance(page);

	const stamp = Date.now();
	const account = {
		name: `Profile Owner ${stamp}`,
		email: `profile-owner-${stamp}@example.com`,
		password: "owner-pass-123",
	};
	await registerUser({ page, ...account });
	const userId = await getUserIdByEmail(account.email);

	await page.getByTestId("shell-nav-profile").click();
	await expect(page).toHaveURL(new RegExp(`/profiles/${userId}$`));
	await page.getByTestId("profile-detail-actions-trigger").click();
	await expect(page.getByTestId("profile-detail-actions-menu")).toBeVisible();
	await page.getByTestId("profile-detail-edit-profile").click();
	await expect(page).toHaveURL(/\/profile$/);
	await expect(page.getByTestId("profile-activity-list")).toHaveCount(0);

	await expect(page.getByTestId("profile-name-input")).toBeVisible();
	await page
		.getByTestId("profile-name-input")
		.fill(`Updated Profile Owner ${stamp}`);
	await page
		.getByTestId("profile-image-input")
		.fill("https://example.com/avatar.png");
	await page
		.getByTestId("profile-summary-input")
		.fill("This is my updated profile summary for route verification.");
	await page.getByTestId("profile-save-button").click();
	await expect(page.getByTestId("profile-save-success")).toBeVisible();

	await page.goto(`/profiles/${userId}`);
	const detailHeader = page.getByTestId("profile-detail-header");
	await expect(detailHeader.getByTestId("profile-detail-name")).toHaveText(
		`Updated Profile Owner ${stamp}`,
	);
	await expect(detailHeader.getByTestId("profile-detail-summary")).toHaveText(
		"This is my updated profile summary for route verification.",
	);
});

test("feed post menu links to the author's public profile", async ({ page }) => {
	await ensureConfiguredInstance(page);

	const stamp = Date.now();
	const account = {
		name: `Feed Author ${stamp}`,
		email: `feed-author-${stamp}@example.com`,
		password: "author-pass-123",
	};
	const postText = `Feed post ${stamp}`;

	await registerUser({ page, ...account });
	const userId = await getUserIdByEmail(account.email);

	await page.goto("/feed");
	await page.getByTestId("feed-composer").fill(postText);
	await page.getByTestId("feed-post-button").click();
	await expect(page.getByTestId("feed-post-list")).toContainText(postText);
	await expect(page.getByText("Start discussion")).toHaveCount(0);
	await expect(
		page.locator("[data-testid^='feed-comment-action-']").first(),
	).toContainText("0 comments");

	await page
		.locator("[data-testid^='feed-post-menu-trigger-']")
		.first()
		.click();
	await page.locator("[data-testid^='feed-post-profile-link-']").first().click();
	await expect(page).toHaveURL(new RegExp(`/profiles/${userId}$`));
});

test("feed reply opens inline composer and redirects to post detail after submit", async ({
	page,
}) => {
	await ensureConfiguredInstance(page);

	const stamp = Date.now();
	const account = {
		name: `Reply Author ${stamp}`,
		email: `reply-author-${stamp}@example.com`,
		password: "author-pass-123",
	};
	const replyText = `Inline reply ${stamp}`;

	await registerUser({ page, ...account });

	await page.goto("/feed");
	const firstThreadLink = page.locator("[data-testid^='feed-thread-link-']").first();
	const postPath = await firstThreadLink.getAttribute("href");
	if (!postPath) {
		throw new Error("Expected first feed post to have a thread link");
	}
	const initialCommentText =
		(await page.locator("[data-testid^='feed-comment-action-']").first().textContent()) ??
		"0 comments";
	const initialComments = Number.parseInt(initialCommentText, 10) || 0;

	await page.locator("[data-testid^='feed-reply-action-']").first().click();
	const postCard = page.locator("[data-testid^='feed-post-'][data-thread-depth]").first();
	const inlineReply = postCard.locator("[data-testid^='feed-inline-reply-body-']");
	await expect(inlineReply).toBeVisible();
	await inlineReply.fill(replyText);
	await postCard.locator("[data-testid^='feed-inline-reply-submit-']").click();

	await expect(page).toHaveURL(new RegExp(`${postPath}$`));
	await expect(page.getByTestId("post-detail-comments")).toContainText(replyText);
	await page.goto("/feed");
	await expect(
		page.locator("[data-testid^='feed-comment-action-']").first(),
	).toContainText(
		`${initialComments + 1} ${initialComments + 1 === 1 ? "comment" : "comments"}`,
	);
});
