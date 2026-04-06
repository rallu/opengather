import type { PostAssetSummary } from "../post-assets.server.ts";
import type { PostAuthorSummary } from "../post-author.service.server.ts";

export const POST_LIST_PAGE_SIZE = 10;

export type PostListSortMode = "activity" | "newest";

export type PostListScope =
	| {
			kind: "community";
			instanceId: string;
			readableGroupIds: string[];
	  }
	| {
			kind: "group";
			instanceId: string;
			groupId: string;
	  };

export type PostGroup = {
	id: string;
	name: string;
};

export type PostListItem = {
	id: string;
	parentPostId?: string;
	threadDepth: number;
	author: PostAuthorSummary;
	bodyText?: string;
	assets: PostAssetSummary[];
	group?: PostGroup;
	moderationStatus: "pending" | "approved" | "rejected" | "flagged";
	isHidden: boolean;
	isDeleted: boolean;
	createdAt: string;
	commentCount: number;
	latestActivityAt: string;
	sortMode: PostListSortMode;
};

export type PostListPage = {
	items: PostListItem[];
	nextCursor?: string;
	hasMore: boolean;
	sortMode: PostListSortMode;
};

type ActivityCursor = {
	sortMode: "activity";
	latestActivityAt: string;
	commentCount: number;
	createdAt: string;
	id: string;
};

type NewestCursor = {
	sortMode: "newest";
	createdAt: string;
	id: string;
};

export type PostListCursor = ActivityCursor | NewestCursor;

export type PostListRow = {
	id: string;
	parentPostId: string | null;
	authorId: string;
	authorType: string;
	bodyText: string | null;
	groupId: string | null;
	groupName: string | null;
	moderationStatus: string;
	hiddenAt: Date | null;
	deletedAt: Date | null;
	createdAt: Date;
	commentCount: bigint | number;
	latestActivityAt: Date;
};

function asModerationStatus(value: string): PostListItem["moderationStatus"] {
	if (
		value === "pending" ||
		value === "approved" ||
		value === "rejected" ||
		value === "flagged"
	) {
		return value;
	}
	return "pending";
}

function toIsoString(value: Date | string): string {
	return value instanceof Date
		? value.toISOString()
		: new Date(value).toISOString();
}

export function parsePostListSortMode(value?: string | null): PostListSortMode {
	return value === "newest" ? "newest" : "activity";
}

export function comparePostListItems(
	left: Pick<
		PostListItem,
		"id" | "createdAt" | "commentCount" | "latestActivityAt"
	>,
	right: Pick<
		PostListItem,
		"id" | "createdAt" | "commentCount" | "latestActivityAt"
	>,
	sortMode: PostListSortMode,
): number {
	if (sortMode === "activity") {
		if (left.latestActivityAt !== right.latestActivityAt) {
			return right.latestActivityAt.localeCompare(left.latestActivityAt);
		}
		if (left.commentCount !== right.commentCount) {
			return right.commentCount - left.commentCount;
		}
	}

	if (left.createdAt !== right.createdAt) {
		return right.createdAt.localeCompare(left.createdAt);
	}

	return right.id.localeCompare(left.id);
}

export function sortPostListItems(
	items: PostListItem[],
	sortMode: PostListSortMode,
): PostListItem[] {
	return [...items].sort((left, right) =>
		comparePostListItems(left, right, sortMode),
	);
}

export function encodePostListCursor(params: {
	item: Pick<
		PostListItem,
		"id" | "createdAt" | "commentCount" | "latestActivityAt" | "sortMode"
	>;
}): string {
	const payload: PostListCursor =
		params.item.sortMode === "activity"
			? {
					sortMode: "activity",
					latestActivityAt: params.item.latestActivityAt,
					commentCount: params.item.commentCount,
					createdAt: params.item.createdAt,
					id: params.item.id,
				}
			: {
					sortMode: "newest",
					createdAt: params.item.createdAt,
					id: params.item.id,
				};

	return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodePostListCursor(params: {
	cursor?: string | null;
	sortMode: PostListSortMode;
}): PostListCursor | null {
	if (!params.cursor) {
		return null;
	}

	try {
		const parsed = JSON.parse(
			Buffer.from(params.cursor, "base64url").toString("utf8"),
		) as Partial<PostListCursor>;
		if (parsed.sortMode !== params.sortMode) {
			return null;
		}

		if (parsed.sortMode === "activity") {
			if (
				typeof parsed.latestActivityAt !== "string" ||
				typeof parsed.commentCount !== "number" ||
				typeof parsed.createdAt !== "string" ||
				typeof parsed.id !== "string"
			) {
				return null;
			}

			return {
				sortMode: "activity",
				latestActivityAt: parsed.latestActivityAt,
				commentCount: parsed.commentCount,
				createdAt: parsed.createdAt,
				id: parsed.id,
			};
		}

		if (typeof parsed.createdAt !== "string" || typeof parsed.id !== "string") {
			return null;
		}
		return {
			sortMode: "newest",
			createdAt: parsed.createdAt,
			id: parsed.id,
		};
	} catch {
		return null;
	}
}

export function paginatePostListItems(params: {
	items: PostListItem[];
	sortMode: PostListSortMode;
	cursor?: string | null;
	limit: number;
}): PostListPage {
	const sorted = sortPostListItems(params.items, params.sortMode);
	const decodedCursor = decodePostListCursor({
		cursor: params.cursor,
		sortMode: params.sortMode,
	});
	const filtered =
		decodedCursor === null
			? sorted
			: sorted.filter((item) => {
					if (
						params.sortMode === "activity" &&
						decodedCursor.sortMode === "activity"
					) {
						return (
							item.latestActivityAt < decodedCursor.latestActivityAt ||
							(item.latestActivityAt === decodedCursor.latestActivityAt &&
								(item.commentCount < decodedCursor.commentCount ||
									(item.commentCount === decodedCursor.commentCount &&
										(item.createdAt < decodedCursor.createdAt ||
											(item.createdAt === decodedCursor.createdAt &&
												item.id < decodedCursor.id)))))
						);
					}

					return (
						item.createdAt < decodedCursor.createdAt ||
						(item.createdAt === decodedCursor.createdAt &&
							item.id < decodedCursor.id)
					);
				});
	const pageItems = filtered.slice(0, params.limit);
	const hasMore = filtered.length > params.limit;
	const lastItem = pageItems.at(-1);

	return {
		items: pageItems,
		hasMore,
		nextCursor:
			hasMore && lastItem
				? encodePostListCursor({ item: lastItem })
				: undefined,
		sortMode: params.sortMode,
	};
}

export function mapPostListItem(
	row: PostListRow,
	sortMode: PostListSortMode,
	author: PostAuthorSummary,
): PostListItem {
	return {
		id: row.id,
		parentPostId: row.parentPostId ?? undefined,
		threadDepth: 0,
		author,
		bodyText: row.bodyText ?? undefined,
		assets: [],
		group:
			row.groupId && row.groupName
				? {
						id: row.groupId,
						name: row.groupName,
					}
				: undefined,
		moderationStatus: asModerationStatus(row.moderationStatus),
		isHidden: Boolean(row.hiddenAt),
		isDeleted: Boolean(row.deletedAt),
		createdAt: toIsoString(row.createdAt),
		commentCount: Number(row.commentCount),
		latestActivityAt: toIsoString(row.latestActivityAt),
		sortMode,
	};
}
