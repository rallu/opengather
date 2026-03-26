import { getDb } from "../db.server.ts";
import { getReadableGroupIds } from "../group.service.server.ts";
import {
	getGroupMembership,
	resolveGroupRole,
} from "../group-membership.service.server.ts";
import { canPostToGroup } from "../permissions.server.ts";
import { loadPostAssetSummaries } from "../post-assets.server.ts";
import { loadPostAuthorSummaryMap } from "../post-author.service.server.ts";
import { ensurePostRootIds } from "../post-root.server.ts";
import {
	buildThreadTree,
	normalizeThreadDepths,
} from "../post-thread.server.ts";
import { getSetupStatus } from "../setup.service.server.ts";
import {
	ensureCanPost,
	ensureCanRead,
	ensureInstanceMembershipForUser,
	isAdmin,
} from "./access.ts";
import { type CommunityPost, type CommunityUser, mapPost } from "./shared.ts";

function findPostInThread(params: {
	posts: CommunityPost[];
	postId: string;
}): CommunityPost | null {
	for (const post of params.posts) {
		if (post.id === params.postId) {
			return post;
		}
		const nestedMatch = findPostInThread({
			posts: post.replies,
			postId: params.postId,
		});
		if (nestedMatch) {
			return nestedMatch;
		}
	}

	return null;
}

export async function loadCommunityPostThread(params: {
	user: CommunityUser | null;
	postId: string;
}): Promise<{
	status:
		| "ok"
		| "not_setup"
		| "requires_registration"
		| "pending_membership"
		| "forbidden"
		| "not_found";
	viewerRole: "guest" | "member" | "moderator" | "admin";
	post: CommunityPost | null;
	canReply: boolean;
}> {
	const status = await getSetupStatus();
	if (!status.isSetup || !status.instance) {
		return {
			status: "not_setup",
			viewerRole: "guest",
			post: null,
			canReply: false,
		};
	}

	await ensureInstanceMembershipForUser({
		instanceId: status.instance.id,
		approvalMode: status.instance.approvalMode,
		user: params.user,
	});

	const readAccess = await ensureCanRead({
		instanceId: status.instance.id,
		user: params.user,
	});
	if (!readAccess.allowed) {
		return {
			status:
				readAccess.reason === "requires_registration"
					? "requires_registration"
					: readAccess.reason === "pending_membership"
						? "pending_membership"
						: "forbidden",
			viewerRole: readAccess.viewerRole,
			post: null,
			canReply: false,
		};
	}

	const includeHidden = await isAdmin({
		instanceId: status.instance.id,
		user: params.user,
	});
	await ensurePostRootIds();
	const readableGroupIds = await getReadableGroupIds({
		authUser: params.user
			? {
					id: params.user.id,
					hubUserId: params.user.hubUserId,
				}
			: null,
		instanceViewerRole: readAccess.viewerRole,
	});
	const rows = await getDb().post.findMany({
		where: {
			instanceId: status.instance.id,
			OR:
				readableGroupIds.length > 0
					? [{ groupId: null }, { groupId: { in: readableGroupIds } }]
					: [{ groupId: null }],
		},
		orderBy: { createdAt: "asc" },
		select: {
			id: true,
			parentPostId: true,
			authorId: true,
			bodyText: true,
			groupId: true,
			moderationStatus: true,
			hiddenAt: true,
			deletedAt: true,
			createdAt: true,
			group: {
				select: {
					id: true,
					name: true,
				},
			},
		},
	});

	const visible = rows.filter((row) => {
		if (includeHidden) {
			return true;
		}
		return (
			!row.deletedAt && !row.hiddenAt && row.moderationStatus !== "rejected"
		);
	});
	const assetMap = await loadPostAssetSummaries({
		postIds: visible.map((row) => row.id),
	});
	const authorMap = await loadPostAuthorSummaryMap({
		authorIds: visible.map((row) => row.authorId),
	});
	const threadedPosts = buildThreadTree({
		rows: normalizeThreadDepths({ rows: visible }).map((row) =>
			mapPost({
				row: {
					...row,
					author: authorMap.get(row.authorId) ?? {
						id: row.authorId,
						name: "Member",
					},
					assets: assetMap.get(row.id) ?? [],
				},
			}),
		),
	});
	const post = findPostInThread({
		posts: threadedPosts,
		postId: params.postId,
	});
	const canReply = post
		? post.group
			? canPostToGroup({
					groupRole: resolveGroupRole(
						params.user
							? await getGroupMembership({
									groupId: post.group.id,
									userId: params.user.id,
								})
							: null,
					),
				}).allowed
			: await ensureCanPost({
					instanceId: status.instance.id,
					user: params.user,
				})
		: false;

	return {
		status: post ? "ok" : "not_found",
		viewerRole: readAccess.viewerRole,
		post,
		canReply,
	};
}
