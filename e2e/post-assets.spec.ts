import { expect, test } from "@playwright/test";
import sharp from "sharp";

const adminUser = {
	email: "admin@example.com",
	password: "admin-pass-123",
};

async function buildPngBuffer() {
	return sharp({
		create: {
			width: 12,
			height: 12,
			channels: 3,
			background: { r: 225, g: 80, b: 80 },
		},
	})
		.png()
		.toBuffer();
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
}): Promise<void> {
	await params.page.goto("/login");
	await params.page.getByTestId("login-email").fill(params.email);
	await params.page.getByTestId("login-password").fill(params.password);
	await params.page.getByTestId("login-submit").click();
	await expect(params.page.getByTestId("shell-sign-out")).toBeVisible();
}

async function uploadImageToComposer(params: {
	page: import("@playwright/test").Page;
	bodyTestId: string;
	inputTestId: string;
	submitTestId: string;
	text: string;
	filename: string;
}) {
	const pngBuffer = await buildPngBuffer();
	await params.page.getByTestId(params.bodyTestId).fill(params.text);
	await params.page.getByTestId(params.inputTestId).setInputFiles({
		name: params.filename,
		mimeType: "image/png",
		buffer: pngBuffer,
	});
	await params.page.getByTestId(params.submitTestId).click();
}

test("media endpoint keeps public images public and private group images private", async ({
	page,
	request,
}) => {
	await ensureConfiguredInstance(page);
	await signInLocal({
		page,
		email: adminUser.email,
		password: adminUser.password,
	});

	const publicPostText = `Public image post ${Date.now()}`;
	await page.goto("/feed");
	await uploadImageToComposer({
		page,
		bodyTestId: "feed-composer",
		inputTestId: "feed-assets-input",
		submitTestId: "feed-post-button",
		text: publicPostText,
		filename: "public-image.png",
	});
	await expect(page.getByTestId("feed-post-list")).toContainText(
		publicPostText,
	);

	const publicPost = page
		.getByTestId("feed-post-list")
		.locator("[data-testid^='feed-post-']")
		.filter({ hasText: publicPostText })
		.first();
	const publicImageSrc = await publicPost
		.locator("img")
		.first()
		.getAttribute("src");
	expect(publicImageSrc).toBeTruthy();
	if (!publicImageSrc) {
		throw new Error("Public image src missing");
	}
	await expect(async () => {
		const response = await request.get(publicImageSrc);
		expect(response.status()).toBe(200);
	}).toPass();

	const groupName = `Private Image Group ${Date.now()}`;
	const privatePostText = `Private image post ${Date.now()}`;
	await page.goto("/groups");
	await page.getByTestId("groups-create-name").fill(groupName);
	await page
		.getByTestId("groups-create-description")
		.fill("Private image group");
	await page
		.getByTestId("groups-create-visibility")
		.selectOption("group_members");
	await page.getByTestId("groups-create-submit").click();
	await expect(page).toHaveURL(/\/groups\/.+$/);

	await uploadImageToComposer({
		page,
		bodyTestId: "group-post-body",
		inputTestId: "group-assets-input",
		submitTestId: "group-post-submit",
		text: privatePostText,
		filename: "private-image.png",
	});
	await expect(page.getByTestId("group-post-list")).toContainText(
		privatePostText,
	);

	const privatePost = page
		.getByTestId("group-post-list")
		.locator("[data-testid^='group-post-']")
		.filter({ hasText: privatePostText })
		.first();
	const privateImageSrc = await privatePost
		.locator("img")
		.first()
		.getAttribute("src");
	expect(privateImageSrc).toBeTruthy();
	if (!privateImageSrc) {
		throw new Error("Private image src missing");
	}

	const anonymousPrivateResponse = await request.get(privateImageSrc);
	expect(anonymousPrivateResponse.status()).toBe(404);

	const authorizedPrivateResponse = await page.request.get(privateImageSrc);
	expect(authorizedPrivateResponse.status()).toBe(200);
});
