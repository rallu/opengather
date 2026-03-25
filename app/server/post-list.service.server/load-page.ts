import { Prisma } from "@prisma/client";
import { getDb } from "../db.server.ts";
import { ensurePostRootIds } from "../post-root.server.ts";
import { loadPostAssetSummaries } from "../post-assets.server.ts";
import { loadPostAuthorSummaryMap } from "../post-author.service.server.ts";
import {
	decodePostListCursor,
	encodePostListCursor,
	mapPostListItem,
	type PostListCursor,
	type PostListPage,
	POST_LIST_PAGE_SIZE,
	type PostListRow,
	type PostListScope,
	type PostListSortMode,
} from "./core";

function getScopeCondition(scope: PostListScope) {
	if (scope.kind === "group") {
		return Prisma.sql`p.group_id = ${scope.groupId}`;
	}

	if (scope.readableGroupIds.length === 0) {
		return Prisma.sql`p.group_id IS NULL`;
	}

	return Prisma.sql`(p.group_id IS NULL OR p.group_id IN (${Prisma.join(
		scope.readableGroupIds,
	)}))`;
}

function getVisibilityCondition(includeHidden: boolean) {
	return includeHidden
		? Prisma.sql`TRUE`
		: Prisma.sql`p.deleted_at IS NULL AND p.hidden_at IS NULL AND p.moderation_status <> 'rejected'`;
}

function getCursorCondition(params: {
	sortMode: PostListSortMode;
	cursor: PostListCursor | null;
}) {
	if (!params.cursor) {
		return Prisma.sql`TRUE`;
	}

	if (params.sortMode === "activity" && params.cursor.sortMode === "activity") {
		return Prisma.sql`
			(
				root_posts.latest_activity_at < ${new Date(params.cursor.latestActivityAt)}
				OR (
					root_posts.latest_activity_at = ${new Date(params.cursor.latestActivityAt)}
					AND root_posts.comment_count < ${params.cursor.commentCount}
				)
				OR (
					root_posts.latest_activity_at = ${new Date(params.cursor.latestActivityAt)}
					AND root_posts.comment_count = ${params.cursor.commentCount}
					AND root_posts.created_at < ${new Date(params.cursor.createdAt)}
				)
				OR (
					root_posts.latest_activity_at = ${new Date(params.cursor.latestActivityAt)}
					AND root_posts.comment_count = ${params.cursor.commentCount}
					AND root_posts.created_at = ${new Date(params.cursor.createdAt)}
					AND root_posts.id < ${params.cursor.id}
				)
			)
		`;
	}

	return Prisma.sql`
		(
			root_posts.created_at < ${new Date(params.cursor.createdAt)}
			OR (
				root_posts.created_at = ${new Date(params.cursor.createdAt)}
				AND root_posts.id < ${params.cursor.id}
			)
		)
	`;
}

function getOrderBy(sortMode: PostListSortMode) {
	if (sortMode === "activity") {
		return Prisma.sql`
			root_posts.latest_activity_at DESC,
			root_posts.comment_count DESC,
			root_posts.created_at DESC,
			root_posts.id DESC
		`;
	}

	return Prisma.sql`
		root_posts.created_at DESC,
		root_posts.id DESC
	`;
}

export async function loadPostListPage(params: {
	scope: PostListScope;
	sortMode: PostListSortMode;
	cursor?: string | null;
	limit?: number;
	includeHidden?: boolean;
}): Promise<PostListPage> {
	await ensurePostRootIds();

	const db = getDb();
	const limit = Math.max(1, Math.min(params.limit ?? POST_LIST_PAGE_SIZE, 50));
	const cursor = decodePostListCursor({
		cursor: params.cursor,
		sortMode: params.sortMode,
	});
	const scopeCondition = getScopeCondition(params.scope);
	const visibilityCondition = getVisibilityCondition(
		Boolean(params.includeHidden),
	);
	const cursorCondition = getCursorCondition({
		sortMode: params.sortMode,
		cursor,
	});
	const orderBy = getOrderBy(params.sortMode);

	const rows = await db.$queryRaw<PostListRow[]>(Prisma.sql`
		WITH visible_posts AS (
			SELECT
				p.id,
				p.parent_post_id,
				p.author_id,
				p.body_text,
				p.group_id,
				p.moderation_status,
				p.hidden_at,
				p.deleted_at,
				p.created_at,
				p.root_post_id
			FROM post p
			WHERE
				p.instance_id = ${params.scope.instanceId}
				AND ${scopeCondition}
				AND ${visibilityCondition}
		),
		thread_stats AS (
			SELECT
				v.root_post_id,
				COUNT(*) FILTER (WHERE v.parent_post_id IS NOT NULL) AS comment_count,
				MAX(v.created_at) AS latest_activity_at
			FROM visible_posts v
			GROUP BY v.root_post_id
		),
		root_posts AS (
			SELECT
				v.id,
				v.parent_post_id,
				v.author_id,
				v.body_text,
				v.group_id,
				g.name AS group_name,
				v.moderation_status,
				v.hidden_at,
				v.deleted_at,
				v.created_at,
				ts.comment_count,
				ts.latest_activity_at
			FROM visible_posts v
			INNER JOIN thread_stats ts ON ts.root_post_id = v.id
			LEFT JOIN community_group g ON g.id = v.group_id
			WHERE v.parent_post_id IS NULL
		)
		SELECT
			root_posts.id,
			root_posts.parent_post_id AS "parentPostId",
			root_posts.author_id AS "authorId",
			root_posts.body_text AS "bodyText",
			root_posts.group_id AS "groupId",
			root_posts.group_name AS "groupName",
			root_posts.moderation_status AS "moderationStatus",
			root_posts.hidden_at AS "hiddenAt",
			root_posts.deleted_at AS "deletedAt",
			root_posts.created_at AS "createdAt",
			root_posts.comment_count AS "commentCount",
			root_posts.latest_activity_at AS "latestActivityAt"
		FROM root_posts
		WHERE ${cursorCondition}
		ORDER BY ${orderBy}
		LIMIT ${limit + 1}
	`);

	const hasMore = rows.length > limit;
	const pageRows = rows.slice(0, limit);
	const assetMap = await loadPostAssetSummaries({
		postIds: pageRows.map((row) => row.id),
	});
	const authorMap = await loadPostAuthorSummaryMap({
		authorIds: pageRows.map((row) => row.authorId),
	});
	const items = pageRows.map((row) => ({
		...mapPostListItem(
			row,
			params.sortMode,
			authorMap.get(row.authorId) ?? { name: "Member" },
		),
		assets: assetMap.get(row.id) ?? [],
	}));
	const lastItem = items.at(-1);

	return {
		items,
		hasMore,
		nextCursor:
			hasMore && lastItem ? encodePostListCursor({ item: lastItem }) : undefined,
		sortMode: params.sortMode,
	};
}
