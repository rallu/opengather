import { randomUUID } from "node:crypto";
import { getDb } from "../db.server.ts";
import { toTextVector } from "../embedding.service.server.ts";
import {
	getGroupMembership,
	resolveGroupRole,
} from "../group-membership.service.server.ts";
import { canPostToGroup } from "../permissions.server.ts";
import {
	loadPostAssetSummaries,
	preparePostAssetsForCreate,
} from "../post-assets.server.ts";
import { loadPostAuthorSummaryMap } from "../post-author.service.server.ts";
import { ensurePostRootIds } from "../post-root.server.ts";
import { getSetupStatus } from "../setup.service.server.ts";
import { ensureCanPost } from "./access.ts";
import { resolveParentPostContext } from "./create-support.ts";
import { sendPostNotifications } from "./notifications.ts";
import type { CommunityUser, CreatedPostSummary } from "./shared.ts";

export async function createPost(params: {
	user: CommunityUser | null;
	text: string;
	parentPostId?: string;
	groupId?: string;
	albumTags?: string[];
	uploads?: Array<{
		fieldName: string;
		filename: string;
		mimeType: string;
		byteSize: number;
		tempFilePath: string;
	}>;
}): Promise<
	{ ok: true; createdPost: CreatedPostSummary } | { ok: false; error: string }
> {
	const status = await getSetupStatus();
	if (!status.isSetup || !status.instance) {
		return { ok: false, error: "Setup not completed" };
	}
	if (!params.user) {
		return { ok: false, error: "Sign in and approved membership required" };
	}
	const user = params.user;

	const text = params.text.trim();
	if (!text) {
		return { ok: false, error: "Text post must include body text" };
	}

	const db = getDb();
	const instanceId = status.instance.id;
	await ensurePostRootIds();
	let effectiveGroupId = params.groupId?.trim() || undefined;
	let rootPostId: string | undefined;
	let targetUrl = "/feed";
	let targetGroupName: string | undefined;
	let notificationGroup:
		| {
				id: string;
				visibilityMode: string;
		  }
		| undefined;

	if (!effectiveGroupId) {
		const canPost = await ensureCanPost({
			instanceId,
			user: params.user,
		});
		if (!canPost) {
			return { ok: false, error: "Sign in and approved membership required" };
		}
	}

	if (params.parentPostId) {
		const parentContext = await resolveParentPostContext({
			instanceId,
			parentPostId: params.parentPostId,
		});
		if (!parentContext.ok) {
			return parentContext;
		}
		const parent = parentContext.parent;

		if (effectiveGroupId && parent.groupId !== effectiveGroupId) {
			return { ok: false, error: "Replies must stay in the same group" };
		}

		effectiveGroupId = parent.groupId ?? effectiveGroupId;
		rootPostId = parent.rootPostId || parent.id;
	}

	if (effectiveGroupId) {
		const group = await db.communityGroup.findFirst({
			where: {
				id: effectiveGroupId,
				instanceId,
			},
			select: {
				id: true,
				name: true,
				visibilityMode: true,
			},
		});
		if (!group) {
			return { ok: false, error: "Group not found" };
		}

		const membership = await getGroupMembership({
			groupId: group.id,
			userId: params.user.id,
		});
		const groupRole = resolveGroupRole(membership);
		if (!canPostToGroup({ groupRole }).allowed) {
			return { ok: false, error: "Group membership required" };
		}

		targetUrl = `/groups/${group.id}`;
		targetGroupName = group.name;
		notificationGroup = {
			id: group.id,
			visibilityMode: group.visibilityMode,
		};
	}

	const now = new Date();
	const postId = randomUUID();
	let assetPersistence: Awaited<ReturnType<typeof preparePostAssetsForCreate>>;
	try {
		assetPersistence = await preparePostAssetsForCreate({
			instanceId,
			postId,
			albumTags: params.albumTags,
			uploads: params.uploads ?? [],
		});
	} catch (error) {
		return {
			ok: false,
			error: error instanceof Error ? error.message : "Asset processing failed",
		};
	}
	const moderationStatus = text.toLowerCase().includes("illegal")
		? "rejected"
		: text.toLowerCase().includes("spam") || text.toLowerCase().includes("scam")
			? "flagged"
			: "approved";

	let created: { id: string } | null = null;
	try {
		created = await db.$transaction(async (trx) => {
			const createdPost = await trx.post.create({
				data: {
					id: postId,
					instanceId,
					authorId: user.hubUserId ?? user.id,
					authorType: "user",
					groupId: effectiveGroupId ?? null,
					rootPostId: rootPostId ?? postId,
					parentPostId: params.parentPostId ?? null,
					contentType: "text",
					bodyText: text,
					moderationStatus,
					hiddenAt: null,
					deletedAt: null,
					createdAt: now,
					updatedAt: now,
				},
			});

			await trx.postEmbedding.create({
				data: {
					id: randomUUID(),
					postId: createdPost.id,
					sourceType: "text",
					modelName: "local-deterministic-embedding",
					vector: toTextVector({ text }),
					summaryText: text,
					createdAt: new Date(),
				},
			});

			await trx.moderationDecision.create({
				data: {
					id: randomUUID(),
					postId: createdPost.id,
					status: moderationStatus,
					reason:
						moderationStatus === "approved"
							? "automated-approval"
							: "automated-policy-hit",
					actorType: "ai",
					actorId: null,
					modelName: "local-rule-moderation",
					createdAt: new Date(),
				},
			});

			await assetPersistence.persist(trx);
			return createdPost;
		});
	} catch (error) {
		await assetPersistence.cleanup();
		return {
			ok: false,
			error: error instanceof Error ? error.message : "Failed to create post",
		};
	}
	if (!created) {
		return { ok: false, error: "Failed to create post" };
	}

	const authorId = user.hubUserId ?? user.id;
	const [assetMap, authorMap] = await Promise.all([
		loadPostAssetSummaries({ postIds: [created.id] }),
		loadPostAuthorSummaryMap({
			authors: [{ id: authorId, type: "user" }],
		}),
	]);
	const createdPost: CreatedPostSummary = {
		id: created.id,
		parentPostId: params.parentPostId ?? undefined,
		author: authorMap.get(authorId) ?? {
			id: authorId,
			name: "Member",
			kind: "user",
		},
		bodyText: text,
		assets: assetMap.get(created.id) ?? [],
		group: effectiveGroupId
			? {
					id: effectiveGroupId,
					name: targetGroupName ?? "Group",
				}
			: undefined,
		moderationStatus,
		isHidden: false,
		isDeleted: false,
		createdAt: now.toISOString(),
		latestActivityAt: now.toISOString(),
		commentCount: 0,
	};

	if (moderationStatus !== "rejected") {
		await sendPostNotifications({
			postId: created.id,
			text,
			user,
			parentPostId: params.parentPostId,
			targetUrl,
			instanceId,
			instanceVisibilityMode: status.instance.visibilityMode,
			group: notificationGroup,
		});
	}

	return { ok: true, createdPost };
}
