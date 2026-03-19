import assert from "node:assert/strict";
import test from "node:test";
import {
	decodePostListCursor,
	paginatePostListItems,
	sortPostListItems,
	type PostListItem,
} from "./post-list.service.server.ts";

function buildItem(
	overrides: Partial<PostListItem> & Pick<PostListItem, "id">,
): PostListItem {
	return {
		threadDepth: 0,
		moderationStatus: "approved",
		isHidden: false,
		isDeleted: false,
		createdAt: "2026-03-19T09:00:00.000Z",
		commentCount: 0,
		latestActivityAt: "2026-03-19T09:00:00.000Z",
		sortMode: "activity",
		...overrides,
		id: overrides.id,
	};
}

test("activity sorting prefers latest activity, then comment count, then root freshness", () => {
	const sorted = sortPostListItems(
		[
			buildItem({
				id: "new-root",
				createdAt: "2026-03-19T11:00:00.000Z",
				latestActivityAt: "2026-03-19T11:00:00.000Z",
				commentCount: 1,
			}),
			buildItem({
				id: "older-but-active",
				createdAt: "2026-03-18T08:00:00.000Z",
				latestActivityAt: "2026-03-19T12:00:00.000Z",
				commentCount: 2,
			}),
			buildItem({
				id: "same-activity-more-comments",
				createdAt: "2026-03-17T08:00:00.000Z",
				latestActivityAt: "2026-03-19T11:00:00.000Z",
				commentCount: 4,
			}),
		],
		"activity",
	);

	assert.deepEqual(
		sorted.map((item) => item.id),
		["older-but-active", "same-activity-more-comments", "new-root"],
	);
});

test("newest sorting ignores replies and uses root post creation", () => {
	const sorted = sortPostListItems(
		[
			buildItem({
				id: "recently-replied",
				createdAt: "2026-03-18T08:00:00.000Z",
				latestActivityAt: "2026-03-19T12:00:00.000Z",
				commentCount: 20,
				sortMode: "newest",
			}),
			buildItem({
				id: "latest-root",
				createdAt: "2026-03-19T11:00:00.000Z",
				latestActivityAt: "2026-03-19T11:00:00.000Z",
				commentCount: 0,
				sortMode: "newest",
			}),
		],
		"newest",
	);

	assert.deepEqual(sorted.map((item) => item.id), ["latest-root", "recently-replied"]);
});

test("paginatePostListItems emits stable cursors without duplicates", () => {
	const items = [
		buildItem({
			id: "thread-c",
			createdAt: "2026-03-19T12:00:00.000Z",
			latestActivityAt: "2026-03-19T12:00:00.000Z",
			commentCount: 1,
		}),
		buildItem({
			id: "thread-b",
			createdAt: "2026-03-19T11:00:00.000Z",
			latestActivityAt: "2026-03-19T11:00:00.000Z",
			commentCount: 1,
		}),
		buildItem({
			id: "thread-a",
			createdAt: "2026-03-19T10:00:00.000Z",
			latestActivityAt: "2026-03-19T10:00:00.000Z",
			commentCount: 1,
		}),
	];

	const firstPage = paginatePostListItems({
		items,
		sortMode: "activity",
		limit: 2,
	});
	assert.deepEqual(
		firstPage.items.map((item) => item.id),
		["thread-c", "thread-b"],
	);
	assert.equal(firstPage.hasMore, true);

	const secondPage = paginatePostListItems({
		items,
		sortMode: "activity",
		cursor: firstPage.nextCursor,
		limit: 2,
	});
	assert.deepEqual(secondPage.items.map((item) => item.id), ["thread-a"]);
	assert.equal(secondPage.hasMore, false);
});

test("decodePostListCursor rejects mismatched sort modes", () => {
	const page = paginatePostListItems({
		items: [
			buildItem({
				id: "thread-a",
				sortMode: "activity",
			}),
		],
		sortMode: "activity",
		limit: 1,
	});

	assert.equal(
		decodePostListCursor({
			cursor: page.nextCursor,
			sortMode: "newest",
		}),
		null,
	);
});
