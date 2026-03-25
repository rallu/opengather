import type { PostAssetSummary } from "../post-assets.server.ts";
import type { PostAuthorSummary } from "../post-author.service.server.ts";

export type CommunityUser = {
	id: string;
	hubUserId?: string;
	role: "admin" | "member" | "moderator";
};

export type CommunityPost = {
	id: string;
	parentPostId?: string;
	threadDepth: number;
	author: PostAuthorSummary;
	bodyText?: string;
	assets: PostAssetSummary[];
	group?: {
		id: string;
		name: string;
	};
	moderationStatus: "pending" | "approved" | "rejected" | "flagged";
	isHidden: boolean;
	isDeleted: boolean;
	createdAt: string;
	replies: CommunityPost[];
};

export type CreatedPostSummary = {
	id: string;
	parentPostId?: string;
	author: PostAuthorSummary;
	bodyText?: string;
	assets: PostAssetSummary[];
	group?: {
		id: string;
		name: string;
	};
	moderationStatus: "pending" | "approved" | "rejected" | "flagged";
	isHidden: boolean;
	isDeleted: boolean;
	createdAt: string;
	latestActivityAt: string;
	commentCount: number;
};

export function asModerationStatus(params: {
	value: string;
}): "pending" | "approved" | "rejected" | "flagged" {
	if (
		params.value === "pending" ||
		params.value === "approved" ||
		params.value === "rejected" ||
		params.value === "flagged"
	) {
		return params.value;
	}
	return "pending";
}

export function toIsoString(params: { value: Date | string }): string {
	return params.value instanceof Date
		? params.value.toISOString()
		: new Date(params.value).toISOString();
}

export function mapPost(params: {
	row: {
		id: string;
		parentPostId: string | null;
		threadDepth?: number;
		author: PostAuthorSummary;
		bodyText: string | null;
		assets?: PostAssetSummary[];
		groupId?: string | null;
		moderationStatus: string;
		hiddenAt: Date | string | null;
		deletedAt: Date | string | null;
		createdAt: Date | string;
		group?: {
			id: string;
			name: string;
		} | null;
	};
}): CommunityPost {
	return {
		id: params.row.id,
		parentPostId: params.row.parentPostId ?? undefined,
		threadDepth: params.row.threadDepth ?? 0,
		author: params.row.author,
		bodyText: params.row.bodyText ?? undefined,
		assets: params.row.assets ?? [],
		group:
			params.row.groupId && params.row.group
				? {
						id: params.row.group.id,
						name: params.row.group.name,
					}
				: undefined,
		moderationStatus: asModerationStatus({
			value: params.row.moderationStatus,
		}),
		isHidden: Boolean(params.row.hiddenAt),
		isDeleted: Boolean(params.row.deletedAt),
		createdAt: toIsoString({ value: params.row.createdAt }),
		replies: [],
	};
}
