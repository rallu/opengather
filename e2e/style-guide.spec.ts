import { expect, test } from "@playwright/test";

test("style guide renders shared component sections without setup", async ({
	page,
}) => {
	await page.goto("/style-guide");

	await expect(page.getByTestId("style-guide-full-layout")).toBeVisible();
	await expect(page.getByTestId("style-guide-page")).toBeVisible();
	await expect(page.getByTestId("style-guide-side-nav")).toBeVisible();
	await expect(
		page.getByTestId("style-guide-group-design-tokens"),
	).toBeVisible();
	await expect(page.getByTestId("style-guide-group-foundations")).toBeVisible();
	await expect(
		page.getByTestId("style-guide-group-forms-and-actions"),
	).toBeVisible();
	await expect(
		page.getByTestId("style-guide-group-navigation-and-wayfinding"),
	).toBeVisible();
	await expect(
		page.getByTestId("style-guide-group-identity-and-media"),
	).toBeVisible();
	await expect(page.getByTestId("style-guide-group-layouts")).toBeVisible();
	await expect(
		page.getByTestId("style-guide-group-posts-and-conversation"),
	).toBeVisible();
	await expect(page.getByTestId("style-guide-tokens-colors")).toBeVisible();
	await expect(page.getByTestId("style-guide-tokens-fonts")).toBeVisible();
	await expect(page.getByTestId("style-guide-tokens-headings")).toBeVisible();
	await expect(page.getByTestId("style-guide-tokens-body-text")).toBeVisible();
	await expect(page.getByTestId("style-guide-tokens-spacing")).toBeVisible();
	await expect(page.getByTestId("style-guide-tokens-radius")).toBeVisible();
	await expect(page.getByTestId("style-guide-button")).toBeVisible();
	await expect(page.getByTestId("style-guide-button-group")).toBeVisible();
	await expect(page.getByTestId("style-guide-input")).toBeVisible();
	await expect(page.getByTestId("style-guide-textarea")).toBeVisible();
	await expect(page.getByTestId("style-guide-selector")).toBeVisible();
	await expect(page.getByTestId("style-guide-dialog")).toBeVisible();
	await expect(page.getByTestId("style-guide-popover")).toBeVisible();
	await expect(page.getByTestId("style-guide-hero-image")).toBeVisible();
	await expect(page.getByTestId("style-guide-navigation")).toBeVisible();
	await expect(page.getByTestId("style-guide-icon")).toBeVisible();
	await expect(page.getByTestId("style-guide-icon-button")).toBeVisible();
	await expect(page.getByTestId("style-guide-breadcrumb")).toBeVisible();
	await expect(page.getByTestId("style-guide-dropdown")).toBeVisible();
	await expect(page.getByTestId("style-guide-label")).toBeVisible();
	await expect(page.getByTestId("style-guide-spinner")).toBeVisible();
	await expect(page.getByTestId("style-guide-navigation-list")).toBeVisible();
	await expect(page.getByTestId("style-guide-badge")).toBeVisible();
	await expect(page.getByTestId("style-guide-card")).toBeVisible();
	await expect(page.getByTestId("style-guide-elevation")).toBeVisible();
	await expect(page.getByTestId("style-guide-profile-image")).toBeVisible();
	await expect(page.getByTestId("style-guide-profile-listing")).toBeVisible();
	await expect(page.getByTestId("style-guide-profile-card")).toBeVisible();
	await expect(page.getByTestId("style-guide-layout-centered")).toBeVisible();
	await expect(
		page.getByTestId("style-guide-layout-right-sidebar"),
	).toBeVisible();
	await expect(page.getByTestId("style-guide-post-heading")).toBeVisible();
	await expect(page.getByTestId("style-guide-post-composer")).toBeVisible();
	await expect(page.getByTestId("style-guide-post-content")).toBeVisible();
	await expect(page.getByTestId("style-guide-rich-text-content")).toBeVisible();
	await expect(page.getByTestId("style-guide-chat-bubble")).toBeVisible();
	await expect(page.getByTestId("style-guide-post-comments")).toBeVisible();
	await expect(page.getByTestId("style-guide-toast")).toBeVisible();
	await expect(page.getByTestId("style-guide-coming-next")).toBeVisible();
});
