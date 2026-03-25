import type {
	CommunityUser,
	CreatedPostSummary,
} from "~/server/community.service.server";
import type { PostListItem } from "~/server/post-list.service.server";
import type { getAuthUserFromRequest } from "~/server/session.server";

export function toCommunityUser(params: {
	authUser: Awaited<ReturnType<typeof getAuthUserFromRequest>>;
}): CommunityUser | null {
	if (!params.authUser) {
		return null;
	}

	return {
		id: params.authUser.id,
		hubUserId: params.authUser.hubUserId,
		role: "member",
	};
}

export function toPriorityPostListItem(params: {
	post: CreatedPostSummary;
	sortMode: "activity" | "newest";
}): PostListItem {
	return {
		id: params.post.id,
		parentPostId: params.post.parentPostId,
		threadDepth: 0,
		author: params.post.author,
		bodyText: params.post.bodyText,
		assets: params.post.assets,
		group: params.post.group,
		moderationStatus: params.post.moderationStatus,
		isHidden: params.post.isHidden,
		isDeleted: params.post.isDeleted,
		createdAt: params.post.createdAt,
		commentCount: params.post.commentCount,
		latestActivityAt: params.post.latestActivityAt,
		sortMode: params.sortMode,
	};
}
